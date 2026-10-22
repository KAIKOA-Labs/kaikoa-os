"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { draftFromProfile, parseVehicleProfile, type VehicleDraft } from "@/lib/vehicle-profile";

type Draft = VehicleDraft & {owner_ready:boolean;maintenance_note:string|null};
const fields: Array<{key: keyof Draft;label:string}> = [
 {key:"registration_plate",label:"Registration plate"},
 {key:"registration_expires_on",label:"Registration valid through"},
 {key:"insurance_expires_on",label:"Insurance valid through"},
 {key:"checked_on",label:"Owner inspection date"},
 {key:"serviced_on",label:"Last completed workshop service (leave blank if unverified)"}
];
export default function VehicleReviewPage(){
 const params=useParams(), slug=typeof params.slug==="string"?params.slug:"";
 const [entityId,setEntityId]=useState("");
 const [existing,setExisting]=useState<unknown>(null);
 const [draft,setDraft]=useState<Draft|null>(null);
 const [source,setSource]=useState("");
 const [status,setStatus]=useState("Checking private access…");
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  let active=true;
  (async()=>{
   const db=getBrowserSupabase();
   if(!db){setStatus("Authentication unavailable.");return;}
   const {data:auth,error:authErr}=await db.auth.getUser();
   if(!active)return;
   if(authErr||!auth.user){setStatus("Sign in to edit.");return;}
   const {data:e,error:ee}=await db.from("entities").select("id,slug,subtype,status").eq("slug",slug).maybeSingle();
   if(!active)return;
   if(ee||!e||e.subtype!=="vehicle"||e.status==="ARCHIVED"){setStatus("Active vehicle not found.");return;}
   const {data:links,error:le}=await db.from("document_links").select("document_id").eq("entity_id",e.id).is("obligation_id",null);
   if(!active)return;
   if(le){setStatus("Could not load linked records.");return;}
   const ids=(links??[]).map(l=>l.document_id);
   if(!ids.length){setStatus("Vehicle profile not found.");return;}
   const {data:docs,error:de}=await db.from("documents").select("id,document_type,metadata").in("id",ids).eq("document_type","vehicle_profile").neq("status","ARCHIVED");
   if(!active)return;
   if(de||docs?.length!==1){setStatus("Vehicle profile is missing or ambiguous.");return;}
   const raw=docs[0].metadata?.vehicle_profile, profile=parseVehicleProfile(raw);
   if(!profile){setStatus("Existing vehicle profile requires review.");return;}
   setEntityId(e.id);setExisting(raw);
   const base:Draft={...draftFromProfile(profile),owner_ready:profile.owner_ready??false,maintenance_note:profile.maintenance_note??null};
   // Owner-submitted October 23 inspection and archival evidence; editable review, not an automatic write.
   if((!profile.checked_on || profile.checked_on < "2026-10-23") && slug==="ktm-duke-690-siargao"){
    Object.assign(base,{registration_plate:"N899HG",registration:"current",registration_expires_on:"2027-09-30",insurance:"paid",insurance_expires_on:"2027-10-14",condition:"good",checked_on:"2026-10-23",owner_ready:true,maintenance_note:"Front headlight: only high beam works. Check and repair low-beam/other position; avoid low-light riding until corrected."});
   }
   if((!profile.checked_on || profile.checked_on < "2026-10-23") && slug==="ktm-freeride-350-siargao"){
    Object.assign(base,{registration_plate:"N941HG",registration:"current",registration_expires_on:"2027-01-14",insurance:"paid",insurance_expires_on:"2027-02-14",condition:"good",checked_on:"2026-10-23",owner_ready:true,maintenance_note:"Replace chain guard; replacement is with owner. Avoid riding if exposed chain creates an entanglement hazard."});
   }
   setDraft(base);
   setSource("Owner confirmation and reviewed insurance / LTO receipts, 2026-10-23. Service completion not inferred.");
   setStatus("");
  })().catch(()=>{if(active)setStatus("Could not load the vehicle.");});
  return ()=>{active=false;};
 },[slug]);
 function field<K extends keyof Draft>(key:K,value:Draft[K]){setDraft(p=>p?{...p,[key]:value}:p);}
 async function save(){
  if(!draft||!entityId||busy)return;
  setBusy(true);setStatus("Saving with owner audit…");
  const db=getBrowserSupabase();
  if(!db){setStatus("Authentication unavailable.");setBusy(false);return;}
  const {data,error}=await db.rpc("update_vehicle_profile",{p_entity_id:entityId,p_expected_profile:existing,p_next_profile:draft,p_source_note:source,p_confirm:true});
  if(error){setStatus("Save not confirmed: "+error.message);setBusy(false);return;}
  const saved=data?.vehicle_profile;
  const {data:check,error:checkError}=await db.from("documents").select("metadata").eq("document_type","vehicle_profile").contains("metadata",{vehicle_profile:saved}).limit(1);
  if(checkError||!check?.length){setStatus("Save returned, but readback could not be verified.");setBusy(false);return;}
  setExisting(saved);setStatus(data.changed?"Saved and verified. Return to the vehicle card.":"No changes. Profile matches.");
  setBusy(false);
 }
 return <main className="shell"><header><p className="eyebrow">KAIKOA OS · Owner vehicle review</p><h1>Vehicle inspection & documentation</h1><p className="muted">Owner-confirmed condition is separate from a completed workshop service. Outstanding repairs remain open notes.</p></header>
 <section className="panel" style={{maxWidth:820}}>
 {draft&&<>
 <p><strong>{draft.display_name}</strong> · {draft.current_base}</p>
 <div className="vehicleTags"><label>Condition <select value={draft.condition} onChange={e=>field("condition",e.target.value as Draft["condition"])}><option value="unknown">Not checked</option><option value="good">Good</option><option value="excellent">Excellent</option><option value="needs_work">Needs repair</option></select></label>
 <label>Registration <select value={draft.registration} onChange={e=>field("registration",e.target.value as Draft["registration"])}><option value="unknown">Unknown</option><option value="current">Current</option><option value="needs_review">Needs review</option></select></label>
 <label>Insurance <select value={draft.insurance} onChange={e=>field("insurance",e.target.value as Draft["insurance"])}><option value="unknown">Unknown</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option></select></label></div>
 {fields.map(f=><label key={f.key} style={{display:"block",marginTop:16}}>{f.label}<input style={{display:"block",width:"100%",padding:10,marginTop:5}} type={String(f.key).endsWith("_on")?"date":"text"} value={String(draft[f.key]??"")} onChange={e=>field(f.key,e.target.value||null as never)}/></label>)}
 <label style={{display:"block",marginTop:16}}>Service interval <select value={draft.service_interval} onChange={e=>field("service_interval",e.target.value as Draft["service_interval"])}><option value="unknown">Not verified</option><option value="annual">Annual service</option></select></label>
 <label style={{display:"block",marginTop:16}}><input type="checkbox" checked={draft.owner_ready} onChange={e=>field("owner_ready",e.target.checked)}/> I have personally inspected this motorcycle and confirm it is ready to use, with the following repairs noted.</label>
 <label style={{display:"block",marginTop:16}}>Outstanding repairs (not marked complete)<textarea style={{display:"block",width:"100%",padding:10,marginTop:5}} value={draft.maintenance_note??""} maxLength={500} onChange={e=>field("maintenance_note",e.target.value||null)}/></label>
 <label style={{display:"block",marginTop:16}}>Source and confirmation note<textarea style={{display:"block",width:"100%",padding:10,marginTop:5}} maxLength={1000} value={source} onChange={e=>setSource(e.target.value)}/></label>
 <button type="button" onClick={()=>void save()} disabled={busy||source.trim().length<8} style={{marginTop:18,padding:"12px 18px"}}>{busy?"Saving…":"Confirm and save audited vehicle review"}</button>
 </>}
 <p role="status">{status}</p>
 <p><Link href={"/private-memory/assets/"+encodeURIComponent(slug)}>← Vehicle details</Link></p>
 </section></main>;
}