"use client";
import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase-browser";
type Obligation={id:string;title:string;status:string;next_action:string|null};
export default function EditObligation(){
 const [items,setItems]=useState<Obligation[]>([]);
 const [selected,setSelected]=useState("");
 const [action,setAction]=useState("");
 const [message,setMessage]=useState("Checking access…");
 const [busy,setBusy]=useState(false);
 async function load(){
  const db=getBrowserSupabase();if(!db){setMessage("Authentication unavailable.");return;}
  const {data:user,error:authError}=await db.auth.getUser();
  if(authError||!user.user){setMessage("Authentication required.");return;}
  const {data,error}=await db.from("obligations").select("id,title,status,next_action").eq("visibility","safe_preview").order("title");
  if(error){setMessage("Unable to load obligations.");return;}
  setItems(data??[]);setSelected(previous=>previous||(data?.find(i=>i.id===new URLSearchParams(window.location.search).get("id"))?.id??data?.[0]?.id??""));
  setMessage(data?.length?"":"No editable obligations found.");
 }
 useEffect(()=>{void load();},[]);
 useEffect(()=>{setAction(items.find(i=>i.id===selected)?.next_action??"");},[items,selected]);
 async function save(){
  const db=getBrowserSupabase();if(!db||!selected||busy)return;
  setBusy(true);setMessage("Saving…");
  const {data,error}=await db.rpc("update_safe_obligation_next_action",{p_obligation_id:selected,p_next_action:action});
  if(error){setMessage("Save failed. No change confirmed.");setBusy(false);return;}
  setMessage(data?"Saved. Change recorded in history.":"No changes to save.");
  await load();setBusy(false);
 }
 return <main className="shell"><header><p className="eyebrow">KAIKOA OS · MILESTONE 003H</p><h1>Edit next action.</h1><p className="muted">Controlled editing · status and payment state unchanged</p></header>
 <section className="panel" style={{maxWidth:800}}>
 <label htmlFor="obligation">Obligation</label><select id="obligation" value={selected} onChange={e=>setSelected(e.target.value)} style={{display:"block",margin:"12px 0 24px",padding:12,background:"#15191f",color:"white",border:"1px solid #3a404a",borderRadius:8}}>{items.map(i=><option key={i.id} value={i.id}>{i.title}</option>)}</select>
 {selected&&<p className="muted">Current status: {items.find(i=>i.id===selected)?.status}</p>}
 <label htmlFor="next-action">Next Action</label><textarea id="next-action" maxLength={1000} rows={5} value={action} onChange={e=>setAction(e.target.value)} disabled={!selected||busy} style={{display:"block",width:"100%",margin:"12px 0 20px",padding:14,background:"#15191f",color:"white",border:"1px solid #3a404a",borderRadius:8}}/>
 <button type="button" disabled={!selected||busy||!action.trim()} onClick={()=>void save()} style={{padding:"12px 20px",borderRadius:8,border:0,fontWeight:700,cursor:"pointer"}}>{busy?"Saving…":"Save next action"}</button>
 {message&&<p role="status" className="muted">{message}</p>}
 </section></main>;
}