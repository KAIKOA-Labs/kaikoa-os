"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import ArtworkInventorySummary from "@/app/artwork-inventory-summary";
import LinkedDocumentReferences from "@/app/linked-document-references";
import { obligationStatusLabel } from "@/lib/obligation-workflow";
import VehicleSummary from "@/app/vehicle-summary";
import AssetYearTag from "@/app/asset-year-tag";
import { assetYearsByEntity } from "@/lib/asset-year";
import { parseVehicleProfile, vehicleProfilesByEntity, type VehicleProfile } from "@/lib/vehicle-profile";
type Asset={id:string;slug:string;name:string;subtype:string|null;status:string;description:string|null;location:string|null;metadata:unknown};
type Obligation={id:string;title:string;status:string;next_action:string|null;requires_owner_attention:boolean;workflow_note:string|null;scheduled_at:string|null};
export default function PrivateAssetDetail(){
 const params=useParams();
 const slug=typeof params.slug==="string"?params.slug:"";
 const [asset,setAsset]=useState<Asset|null>(null);
 const [vehicleProfile,setVehicleProfile]=useState<VehicleProfile|null>(null);
 const [assetYear,setAssetYear]=useState<number|undefined>(undefined);
 const [items,setItems]=useState<Obligation[]>([]);
 const [state,setState]=useState("Checking private access…");
 useEffect(()=>{
  let active=true;setState("Checking private access…");setAsset(null);setVehicleProfile(null);setAssetYear(undefined);
  (async()=>{
   const db=getBrowserSupabase();
   if(!db){setState("Authentication configuration unavailable.");return;}
   const {data:user,error:authError}=await db.auth.getUser();
   if(!active)return;
   if(authError||!user.user){setState("Authentication required.");return;}
   const {data:entity,error:entityError}=await db.from("entities").select("id,slug,name,subtype,status,description,location,metadata").eq("slug",slug).maybeSingle();
   if(!active)return;
   if(entityError){setState("Could not load this asset.");return;}
   if(!entity){setState("Asset not found or access denied.");return;}
   const [obligations,profiles,links]=await Promise.all([
    db.from("obligations").select("id,title,status,next_action,requires_owner_attention,workflow_note,scheduled_at").neq("status","ARCHIVED").eq("related_entity_id",entity.id).order("title"),
    ["vehicle","vessel"].includes(entity.subtype??"")?db.from("documents").select("id,document_type,vehicle_profile:metadata->vehicle_profile,evidence_summary:metadata->evidence_summary").in("document_type",entity.subtype==="vehicle"?["vehicle_profile","vehicle_registration"]:["vessel_registration"]).neq("status","ARCHIVED"):Promise.resolve({data:[],error:null}),
    ["vehicle","vessel"].includes(entity.subtype??"")?db.from("document_links").select("document_id,entity_id").eq("entity_id",entity.id).is("obligation_id",null):Promise.resolve({data:[],error:null}),
   ]);
   if(!active)return;
   if(obligations.error||profiles.error||links.error){setState("Could not load this asset’s details.");return;}
   setAsset(entity);setAssetYear(assetYearsByEntity([entity],profiles.data??[],links.data??[]).get(entity.id));setVehicleProfile(vehicleProfilesByEntity((profiles.data??[]).filter(document=>document.document_type==="vehicle_profile"),links.data??[]).get(entity.id)??null);setItems(obligations.data??[]);setState("ready");
  })().catch(()=>{if(active)setState("Could not complete the request.");});
  return()=>{active=false;};
 },[slug]);
 return <main className="shell">
 {state!=="ready"?<section className="panel"><p role="status">{state}</p>{state==="Authentication required."&&<Link href="/auth/sign-in">Sign in →</Link>}</section>:asset&&<>
 <header><p className="eyebrow">{asset.subtype?.replaceAll("_"," ")??"Asset"} · Private inventory</p><h1>{asset.subtype==="vehicle"?parseVehicleProfile(vehicleProfile)?.display_name??asset.name:asset.name}</h1>{asset.subtype!=="vehicle"&&<p className="muted">{asset.status}</p>}</header>
 {asset.subtype==="vehicle"?<section className="panel"><h2>Vehicle details</h2><VehicleSummary profile={vehicleProfile} location={asset.location} year={assetYear}/><p><Link href={"/private-memory/assets/"+encodeURIComponent(asset.slug)+"/review"}>Update inspection and insurance →</Link></p>{asset.description&&<details><summary>Earlier inventory notes</summary><p style={{whiteSpace:"pre-wrap"}}>{asset.description}</p></details>}</section>:<section className="panel"><h2>{asset.subtype==="property"?"Earlier inventory notes":"Asset details"}</h2>{asset.subtype==="vessel"&&assetYear&&<div className="vehicleTags"><AssetYearTag year={assetYear}/></div>}{asset.subtype==="property"&&<p className="muted">Use the linked source documents below when they supersede these earlier notes. These notes remain as history.</p>}<p style={{whiteSpace:"pre-wrap"}}>{asset.description||"No description recorded."}</p>{asset.location&&<p className="muted">Location: {asset.location}</p>}<p><Link href={"/private-memory/edit?asset="+encodeURIComponent(asset.slug)}>Edit description →</Link></p></section>}
 {asset.subtype==="subscription"&&<section className="panel"><h2>Usage and decision</h2><Link href={"/private-memory/subscriptions/"+encodeURIComponent(asset.slug)+"/review"}>Review subscription →</Link></section>}
 {asset.subtype==="artwork"&&<ArtworkInventorySummary slug={asset.slug} metadata={asset.metadata}/>}
 <LinkedDocumentReferences key={asset.id} entityId={asset.id}/>
 <section className="panel" id="obligations"><h2>Linked obligations · {items.length}</h2>{items.length===0?<p className="muted">No linked obligations recorded.</p>:items.map(o=><div className="item" key={o.id}><div><strong>{o.title}</strong><p>{o.next_action}</p>{o.workflow_note&&<p className="muted">{o.workflow_note}</p>}{o.scheduled_at&&<p className="muted">Scheduled: {new Date(o.scheduled_at).toLocaleString()}</p>}</div><span className="status">{obligationStatusLabel(o.status,o.requires_owner_attention)}</span><small><Link href={"/private-memory/obligations/edit?id="+encodeURIComponent(o.id)}>Update obligation →</Link></small></div>)}</section>
 </>}
 </main>;
}
