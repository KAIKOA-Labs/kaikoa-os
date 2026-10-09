"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { obligationStatusLabel } from "@/lib/obligation-workflow";
type Change={id:string;record_id:string;kind:"asset"|"obligation";field_name:string;previous_value:string|null;new_value:string|null;changed_at:string};
type Named={id:string;name?:string;title?:string};
function displayValue(change:Change,value:string|null){
 if(value===null||value==="")return "(empty)";
 if(change.kind==="obligation"&&change.field_name==="status")return obligationStatusLabel(value);
 if(change.field_name==="requires_owner_attention")return value==="true"?"Yes":"No";
 if(["due_at","scheduled_at","completed_at"].includes(change.field_name))return new Date(value).toLocaleString(undefined,{timeZoneName:"short"});
 return value;
}
export default function HistoryPage(){
 const [state,setState]=useState("Checking account…");
 const [changes,setChanges]=useState<Change[]>([]);
 const [names,setNames]=useState<Record<string,string>>({});
 useEffect(()=>{let active=true;(async()=>{
  const db=getBrowserSupabase();if(!db){setState("Authentication configuration unavailable.");return;}
  const {data:user,error:authError}=await db.auth.getUser();if(!active)return;
  if(authError||!user.user){setState("Authentication required. Please sign in.");return;}
  const [assetHistory,obligationHistory,assets,obligations]=await Promise.all([
   db.from("entity_change_history").select("id,entity_id,field_name,previous_value,new_value,changed_at").order("changed_at",{ascending:false}).limit(50),
   db.from("obligation_change_history").select("id,obligation_id,field_name,previous_value,new_value,changed_at").order("changed_at",{ascending:false}).limit(50),
   db.from("entities").select("id,name"),
   db.from("obligations").select("id,title")
  ]);
  if(!active)return;
  if(assetHistory.error||obligationHistory.error||assets.error||obligations.error){setState("Could not retrieve history.");return;}
  const assetChanges:Change[]=(assetHistory.data??[]).map(x=>({id:x.id,record_id:x.entity_id,kind:"asset",field_name:x.field_name,previous_value:x.previous_value,new_value:x.new_value,changed_at:x.changed_at}));
  const obligationChanges:Change[]=(obligationHistory.data??[]).map(x=>({id:x.id,record_id:x.obligation_id,kind:"obligation",field_name:x.field_name,previous_value:x.previous_value,new_value:x.new_value,changed_at:x.changed_at}));
  setChanges([...assetChanges,...obligationChanges].sort((a,b)=>Date.parse(b.changed_at)-Date.parse(a.changed_at)).slice(0,50));
  const labels:Record<string,string>={};
  for(const a of (assets.data??[]) as Named[])labels[a.id]=a.name??"Asset";
  for(const o of (obligations.data??[]) as Named[])labels[o.id]=o.title??"Obligation";
  setNames(labels);setState("ready");
 })().catch(()=>{if(active)setState("History check failed.");});return()=>{active=false};},[]);
 return <main className="shell"><header><p className="eyebrow">KAIKOA OS · CHANGE HISTORY</p><h1>Change history.</h1><p className="muted">Read-only audit trail · latest 50 recorded edits</p></header>
 {state!=="ready"?<section className="panel"><p role="status">{state}</p>{state.includes("Authentication")&&<Link href="/auth/sign-in">Sign in →</Link>}</section>:
 <section className="panel"><h2>Recorded changes · {changes.length}</h2>{changes.length===0?<p className="muted">No changes recorded yet.</p>:changes.map(change=><div className="item" key={change.kind+change.id}>
 <strong>{names[change.record_id]??"Unknown record"} · {change.field_name.replaceAll("_"," ")}</strong>
 <p className="muted">{new Date(change.changed_at).toLocaleString()}</p>
 <p><small>Before</small></p><p style={{whiteSpace:"pre-wrap"}}>{displayValue(change,change.previous_value)}</p>
 <p><small>After</small></p><p style={{whiteSpace:"pre-wrap"}}>{displayValue(change,change.new_value)}</p>
 </div>)}</section>}</main>;
}