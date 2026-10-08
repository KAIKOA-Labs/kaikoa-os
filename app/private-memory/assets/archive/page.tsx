"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {getBrowserSupabase} from "@/lib/supabase-browser";
type Asset={id:string;name:string;status:string;data_quality:string};
export default function ArchiveAsset(){
 const [items,setItems]=useState<Asset[]>([]);
 const [selected,setSelected]=useState("");
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [archived,setArchived]=useState(false);
 useEffect(()=>{let active=true;(async()=>{
 const db=getBrowserSupabase();if(!db){setMessage("Authentication unavailable.");setLoading(false);return;}
 const {data:user,error:authError}=await db.auth.getUser();if(!active)return;
 if(authError||!user.user){setMessage("Sign in required.");setLoading(false);return;}
 const {data,error}=await db.from("entities").select("id,name,status,data_quality").eq("entity_type","asset").eq("data_quality","unverified").neq("status","ARCHIVED").order("name");
 if(!active)return;
 if(error){setMessage("Unable to load eligible assets.");setLoading(false);return;}
 setItems(data??[]);setLoading(false);
 })().catch(()=>{if(active){setMessage("Unable to load eligible assets.");setLoading(false);}});return()=>{active=false};},[]);
 async function archive(){
 if(!selected||busy||!window.confirm("Archive this unverified asset? It will disappear from active inventory, but its record and audit history will remain."))return;
 setBusy(true);setMessage("Archiving…");
 const db=getBrowserSupabase();
 if(!db){setMessage("Authentication unavailable.");setBusy(false);return;}
 const {data,error}=await db.rpc("archive_unverified_asset",{p_entity_id:selected});
 if(error){setMessage("Archive not completed. This asset may have linked records or be ineligible.");setBusy(false);return;}
 setArchived(true);setMessage(data?"Archived. Record and change history preserved.":"Already archived.");setBusy(false);
 }
 return <main className="shell"><header><p className="eyebrow">KAIKOA OS · INVENTORY LIFECYCLE</p><h1>Archive an asset.</h1><p className="muted">Owner-only · unverified assets without linked records · audited</p></header><section className="panel" style={{maxWidth:800}}>
 <p>Archiving hides an eligible asset from active inventory. It does not delete the record or its change history.</p>
 <label htmlFor="archive-asset">Unverified asset</label><select id="archive-asset" value={selected} onChange={e=>setSelected(e.target.value)} disabled={busy||archived||loading} style={{display:"block",margin:"12px 0 24px",padding:12,background:"#15191f",color:"white",border:"1px solid #3a404a",borderRadius:8}}><option value="">Select an asset…</option>{items.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select>
 <button type="button" disabled={!selected||busy||archived} onClick={()=>void archive()} style={{padding:"12px 20px",borderRadius:8,border:0,fontWeight:700}}>{busy?"Archiving…":"Archive selected asset"}</button>
 {message&&<p role="status" className="muted">{message}</p>}
 {archived&&<p><Link href="/private-memory">View active inventory →</Link></p>}
 </section></main>;
}