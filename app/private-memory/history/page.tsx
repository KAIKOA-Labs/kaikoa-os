"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
type Change = {id:string;entity_id:string;field_name:string;previous_value:string|null;new_value:string|null;changed_at:string};
type Asset = {id:string;name:string};
export default function HistoryPage(){
 const [state,setState]=useState("Checking account…");
 const [changes,setChanges]=useState<Change[]>([]);
 const [assets,setAssets]=useState<Asset[]>([]);
 useEffect(()=>{
  let active=true;
  (async()=>{
   const db=getBrowserSupabase();
   if(!db){setState("Authentication configuration unavailable.");return;}
   const {data:user,error:authError}=await db.auth.getUser();
   if(!active)return;
   if(authError||!user.user){setState("Authentication required. Please sign in.");return;}
   const [history,entities]=await Promise.all([
    db.from("entity_change_history").select("id,entity_id,field_name,previous_value,new_value,changed_at").order("changed_at",{ascending:false}).limit(50),
    db.from("entities").select("id,name")
   ]);
   if(!active)return;
   if(history.error||entities.error){setState("Could not retrieve history.");return;}
   setChanges(history.data??[]);setAssets(entities.data??[]);setState("ready");
  })().catch(()=>{if(active)setState("History check failed.");});
  return()=>{active=false;};
 },[]);
 return <main className="shell"><header><p className="eyebrow">KAIKOA OS · MILESTONE 003C</p><h1>Change history.</h1><p className="muted">Read-only audit trail · latest 50 recorded edits</p></header>
 {state!=="ready"?<section className="panel"><p role="status">{state}</p>{state.includes("Authentication")&&<Link href="/auth/sign-in">Sign in →</Link>}</section>:
 <section className="panel"><h2>Recorded changes · {changes.length}</h2>{changes.length===0?<p className="muted">No changes recorded yet.</p>:changes.map(change=><div className="item" key={change.id}>
 <strong>{assets.find(a=>a.id===change.entity_id)?.name??"Unknown asset"} · {change.field_name}</strong>
 <p className="muted">{new Date(change.changed_at).toLocaleString()}</p>
 <p><small>Before</small></p><p style={{whiteSpace:"pre-wrap"}}>{change.previous_value||"(empty)"}</p>
 <p><small>After</small></p><p style={{whiteSpace:"pre-wrap"}}>{change.new_value||"(empty)"}</p>
 </div>)}</section>}
 </main>;
}