"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {getBrowserSupabase} from "@/lib/supabase-browser";
type Item={id:string;title:string};
export default function ArchiveObligation(){
 const [items,setItems]=useState<Item[]>([]);
 const [selected,setSelected]=useState("");
 const [busy,setBusy]=useState(false);
 const [done,setDone]=useState(false);
 const [message,setMessage]=useState("Checking access…");
 useEffect(()=>{let active=true;(async()=>{
 const db=getBrowserSupabase();if(!db){setMessage("Authentication unavailable.");return;}
 const {data:user,error:authError}=await db.auth.getUser();if(!active)return;
 if(authError||!user.user){setMessage("Sign in required.");return;}
 const {data,error}=await db.from("obligations").select("id,title").eq("source_state","UNVERIFIED").neq("status","ARCHIVED").order("title");
 if(!active)return;
 if(error){setMessage("Unable to load obligations.");return;}
 setItems(data??[]);setMessage("");
 })().catch(()=>{if(active)setMessage("Unable to load obligations.");});return()=>{active=false};},[]);
 async function archive(){
 if(!selected||busy||done||!window.confirm("Archive this unverified obligation? Its record and history will remain."))return;
 setBusy(true);setMessage("Archiving…");
 const db=getBrowserSupabase();if(!db){setMessage("Authentication unavailable.");setBusy(false);return;}
 const {data,error}=await db.rpc("archive_unverified_obligation",{p_obligation_id:selected});
 if(error){setMessage("Archive failed. Linked evidence or eligibility may prevent archiving.");setBusy(false);return;}
 setDone(true);setMessage(data?"Archived. Change History preserved.":"Already archived.");setBusy(false);
 }
 return <main className="shell"><header><p className="eyebrow">KAIKOA OS · OBLIGATION LIFECYCLE</p><h1>Archive an obligation.</h1><p className="muted">Owner-only · unverified obligations · audited</p></header>
 <section className="panel" style={{maxWidth:800}}>
 <p>Archive an eligible obligation without deleting its record or history.</p>
 <label htmlFor="obligation">Unverified obligation</label><select id="obligation" value={selected} onChange={e=>setSelected(e.target.value)} disabled={busy||done} style={{display:"block",margin:"12px 0 24px",padding:12,background:"#15191f",color:"white",border:"1px solid #3a404a",borderRadius:8}}><option value="">Select an obligation…</option>{items.map(i=><option value={i.id} key={i.id}>{i.title}</option>)}</select>
 <button type="button" disabled={!selected||busy||done} onClick={()=>void archive()} style={{padding:"12px 20px",borderRadius:8,border:0,fontWeight:700}}>{busy?"Archiving…":"Archive selected obligation"}</button>
 {message&&<p role="status" className="muted">{message}</p>}
 {done&&<p><Link href="/private-memory">View active obligations →</Link></p>}
 </section></main>;
}