"use client";
import {useState} from "react";
import Link from "next/link";
import {getBrowserSupabase} from "@/lib/supabase-browser";
export default function NewAsset(){
 const [name,setName]=useState("");
 const [category,setCategory]=useState("property");
 const [description,setDescription]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [created,setCreated]=useState(false);
 async function save(){
  if(busy||!name.trim())return;
  setBusy(true);setMessage("Saving…");
  const db=getBrowserSupabase();
  if(!db){setMessage("Authentication unavailable.");setBusy(false);return;}
  const {data:user,error:authError}=await db.auth.getUser();
  if(authError||!user.user){setMessage("Sign in required.");setBusy(false);return;}
  const {error}=await db.rpc("create_inventory_asset",{p_name:name,p_subtype:category,p_description:description});
  if(error){setMessage("Unable to create asset. Check for duplicate names or invalid details.");setBusy(false);return;}
  setCreated(true);setMessage("Asset created as Unverified. Creation recorded in Change History.");setBusy(false);
 }
 return <main className="shell"><header><p className="eyebrow">KAIKOA OS · INVENTORY</p><h1>Add an asset.</h1><p className="muted">Owner-only creation · new records start unverified · audited changes</p></header>
 <section className="panel" style={{maxWidth:800}}>
 <label htmlFor="asset-name">Asset name</label><input id="asset-name" value={name} onChange={e=>setName(e.target.value)} maxLength={120} disabled={busy||created} placeholder="e.g. A new property or vessel" style={{display:"block",width:"100%",margin:"12px 0 24px",padding:12,background:"#15191f",color:"white",border:"1px solid #3a404a",borderRadius:8}}/>
 <label htmlFor="asset-category">Category</label><select id="asset-category" value={category} onChange={e=>setCategory(e.target.value)} disabled={busy||created} style={{display:"block",margin:"12px 0 24px",padding:12,background:"#15191f",color:"white",border:"1px solid #3a404a",borderRadius:8}}>{[["property","Property"],["vehicle","Vehicle"],["vessel","Vessel"],["digital_asset","Digital asset"],["business","Business"],["equipment","Equipment"],["other","Other"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
 <label htmlFor="asset-description">Description (optional)</label><textarea id="asset-description" value={description} onChange={e=>setDescription(e.target.value)} maxLength={1000} rows={4} disabled={busy||created} style={{display:"block",width:"100%",margin:"12px 0 20px",padding:14,background:"#15191f",color:"white",border:"1px solid #3a404a",borderRadius:8}}/>
 <p className="muted">Do not enter passport numbers, bank details, health information or sensitive documents. A new record is not considered verified.</p>
 <button type="button" disabled={busy||created||name.trim().length<2} onClick={()=>void save()} style={{padding:"12px 20px",borderRadius:8,border:0,fontWeight:700}}>{busy?"Saving…":"Create unverified asset"}</button>
 {message&&<p role="status" className="muted">{message}</p>}
 {created&&<Link href="/private-memory">View inventory →</Link>}
 </section></main>;
}