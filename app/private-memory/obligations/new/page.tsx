"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {getBrowserSupabase} from "@/lib/supabase-browser";
type Asset={id:string;name:string;status:string};
const vesselDrafts=[
 {title:"KAIKOA — Hatch and window leak repairs",action:"Specialist inspecting aboard on 8 October 2026. Await written repair quotation (devis), review scope and cost, then approve work only after funding and owner authorization."},
 {title:"KAIKOA — Windlass engagement repair",action:"Issue remains unresolved. Request assessment of clutch/gypsy engagement and a targeted repair quotation before authorizing parts or labor; schedule when funding permits."},
 {title:"KAIKOA — Propeller anode replacement",action:"Replacement remains outstanding. Obtain inspection and replacement quotation; plan safe access/haul-out or diver intervention as appropriate when funding permits."},
 {title:"KAIKOA — Dinghy line replacement",action:"Lines remain worn. Confirm sizes and quantities, obtain replacement cost and arrange replacement when funds permit."}
] as const;
export default function NewObligation(){
 const [assets,setAssets]=useState<Asset[]>([]);
 const [entityId,setEntityId]=useState("");
 const [title,setTitle]=useState("");
 const [nextAction,setNextAction]=useState("");
 const [requiresOwner,setRequiresOwner]=useState(true);
 const [busy,setBusy]=useState(false);
 const [created,setCreated]=useState(false);
 const [savedCount,setSavedCount]=useState(0);
 const [message,setMessage]=useState("Checking access…");
 useEffect(()=>{let active=true;(async()=>{
  const db=getBrowserSupabase();if(!db){setMessage("Authentication unavailable.");return;}
  const {data:user,error:authError}=await db.auth.getUser();if(!active)return;
  if(authError||!user.user){setMessage("Sign in required.");return;}
  const {data,error}=await db.from("entities").select("id,name,status").neq("status","ARCHIVED").order("name");
  if(!active)return;
  if(error){setMessage("Unable to load assets.");return;}
  setAssets(data??[]);setMessage("");
 })().catch(()=>{if(active)setMessage("Unable to load assets.");});return()=>{active=false};},[]);
 async function save(){
  if(busy||created||!entityId||title.trim().length<4||nextAction.trim().length<4)return;
  setBusy(true);setMessage("Saving…");
  const db=getBrowserSupabase();
  if(!db){setMessage("Authentication unavailable.");setBusy(false);return;}
  const {error}=await db.rpc("create_inventory_obligation",{p_entity_id:entityId,p_title:title,p_next_action:nextAction,p_requires_owner_attention:requiresOwner});
  if(error){setMessage("Not saved. Check for duplicate titles, invalid input or authorization.");setBusy(false);return;}
  setCreated(true);setSavedCount(n=>n+1);setMessage("Obligation created as Unverified. No due date assigned. Change History updated.");setBusy(false);
 }
 return <main className="shell"><header><p className="eyebrow">KAIKOA OS · OBLIGATIONS</p><h1>Add an obligation.</h1><p className="muted">Controlled entry · owner-only · no assumed deadlines</p></header>
 <section className="panel" style={{maxWidth:800}}>
 <div style={{marginBottom:24}}><h2>KAIKOA maintenance drafts</h2><p className="muted">Reported 8 October 2026. Choose a draft to review; nothing is saved until you click Create.</p>
 {vesselDrafts.map(d=><button type="button" key={d.title} disabled={busy} onClick={()=>{setEntityId(assets.find(a=>a.name==="KAIKOA")?.id??"");setTitle(d.title);setNextAction(d.action);setRequiresOwner(false);setCreated(false);setMessage("");}} style={{display:"block",width:"100%",textAlign:"left",padding:"12px 14px",marginBottom:8,borderRadius:8,border:"1px solid #343b44",background:"#15191f",color:"white",cursor:"pointer"}}>{d.title} →</button>)}</div>
 <label htmlFor="related-asset">Related asset</label><select id="related-asset" value={entityId} onChange={e=>setEntityId(e.target.value)} disabled={busy||created} style={{display:"block",margin:"12px 0 24px",padding:12,background:"#15191f",color:"white",border:"1px solid #3a404a",borderRadius:8}}><option value="">Select an asset…</option>{assets.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select>
 <label htmlFor="obligation-title">What needs attention?</label><input id="obligation-title" maxLength={160} value={title} onChange={e=>setTitle(e.target.value)} disabled={busy||created} placeholder="Describe the obligation" style={{display:"block",width:"100%",margin:"12px 0 24px",padding:12,background:"#15191f",color:"white",border:"1px solid #3a404a",borderRadius:8}}/>
 <label htmlFor="next-action">Next action</label><textarea id="next-action" maxLength={1000} rows={5} value={nextAction} onChange={e=>setNextAction(e.target.value)} disabled={busy||created} placeholder="What needs to happen next?" style={{display:"block",width:"100%",margin:"12px 0 20px",padding:14,background:"#15191f",color:"white",border:"1px solid #3a404a",borderRadius:8}}/>
 <label style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}><input type="checkbox" checked={requiresOwner} onChange={e=>setRequiresOwner(e.target.checked)} disabled={busy||created}/>Requires your attention</label>
 <p className="muted">Starts as Needs Attention / Unverified. No payment state, due date or completion is inferred. Avoid sensitive information.</p>
 <button type="button" disabled={busy||created||!entityId||title.trim().length<4||nextAction.trim().length<4} onClick={()=>void save()} style={{padding:"12px 20px",borderRadius:8,border:0,fontWeight:700}}>{busy?"Saving…":"Create unverified obligation"}</button>
 {message&&<p role="status" className="muted">{message}</p>}
 {created&&<p><button type="button" onClick={()=>{setCreated(false);setTitle("");setNextAction("");setMessage("");}} style={{padding:"10px 14px",borderRadius:8}}>Add another obligation</button> <Link href="/private-memory">View obligations →</Link></p>}
 {savedCount>0&&<p className="muted">Saved this session: {savedCount}</p>}
 </section></main>;
}