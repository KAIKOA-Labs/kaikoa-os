"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase-browser";

type Asset = {id:string;name:string;description:string|null};
export default function EditAssetPage(){
 const searchParams=useSearchParams();
 const initialSlug=searchParams.get("asset");
 const [assets,setAssets]=useState<Asset[]>([]);
 const [selected,setSelected]=useState("");
 const [description,setDescription]=useState("");
 const [status,setStatus]=useState("Checking access…");
 const [busy,setBusy]=useState(false);
 async function load(){
  const db=getBrowserSupabase();
  if(!db){setStatus("Authentication is not configured.");return;}
  const {data:user,error:authError}=await db.auth.getUser();
  if(authError||!user.user){setStatus("Please sign in before editing.");return;}
  const {data,error}=await db.from("entities").select("id,name,description").eq("visibility","safe_preview").order("name");
  if(error){setStatus("Unable to retrieve editable assets.");return;}
  setAssets(data??[]);
  setSelected(previous=>previous||(data?.find(a=>a.name.toLowerCase().replaceAll(" ","-")===initialSlug)?.id??data?.[0]?.id??""));
  setStatus(data?.length?"":"No editable records found.");
 }
 useEffect(()=>{void load();},[]);
 useEffect(()=>{setDescription(assets.find(a=>a.id===selected)?.description??"");},[selected,assets]);
 async function save(){
  const db=getBrowserSupabase();
  if(!db||!selected||busy)return;
  setBusy(true);setStatus("Saving…");
  const {data,error}=await db.rpc("update_safe_entity_description",{p_entity_id:selected,p_description:description});
  if(error){setStatus("Save failed. No change was confirmed.");setBusy(false);return;}
  setStatus(data?"Saved. Change recorded in history.":"No changes to save.");
  await load();
  setBusy(false);
 }
 return <main className="shell"><header><p className="eyebrow">KAIKOA OS · MILESTONE 003B</p><h1>Edit an asset.</h1><p className="muted">Controlled editing · description only · audited changes</p></header>
 <section className="panel" style={{maxWidth:800}}>
 <label htmlFor="asset">Asset</label><select id="asset" value={selected} onChange={e=>setSelected(e.target.value)} style={{display:"block",margin:"12px 0 24px",padding:12,background:"#15191f",color:"white",border:"1px solid #3a404a",borderRadius:8}}>{assets.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
 <label htmlFor="description">Description</label><textarea id="description" maxLength={1000} rows={5} value={description} onChange={e=>setDescription(e.target.value)} disabled={!selected||busy} style={{display:"block",width:"100%",margin:"12px 0 20px",padding:14,background:"#15191f",color:"white",border:"1px solid #3a404a",borderRadius:8}}/>
 <button type="button" disabled={!selected||busy} onClick={()=>void save()} style={{padding:"12px 20px",borderRadius:8,border:0,fontWeight:700,cursor:"pointer"}}>{busy?"Saving…":"Save description"}</button>
 {status && <p role="status" className="muted">{status}</p>}
 </section></main>;
}