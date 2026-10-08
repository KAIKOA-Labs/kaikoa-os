"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import ObligationDeadline from "@/app/obligation-deadline";
import { getBrowserSupabase } from "@/lib/supabase-browser";

import { classifyObligation as classify, obligationFilters, obligationStatusLabel, visibleObligations, type ObligationFilter as Filter } from "@/lib/obligation-workflow";
type RecordRow = { id: string; slug: string; name: string; subtype: string | null; status: string };
type ObligationRow = { id: string; title: string; status: string; related_entity_id: string | null; requires_owner_attention: boolean; due_at: string | null };
const categoryLabels: Record<string,string> = {vessel:"Vessels",property:"Properties",digital_asset:"Digital Assets",vehicle:"Vehicles",passport:"Passports",credential:"Credentials"};
const categoryOrder = ["vessel","property","vehicle","digital_asset","passport","credential"];
type ViewState = "checking" | "signed-out" | "loading" | "ready" | "error";
export default function PrivateMemoryPage() {
 const [stage,setStage]=useState<ViewState>("checking");
 const [records,setRecords]=useState<RecordRow[]>([]);
 const [obligations,setObligations]=useState<ObligationRow[]>([]);
 const [errorText,setErrorText]=useState("");
 const [filter,setFilter]=useState<Filter>(null);
 const [now,setNow]=useState<number|null>(null);
 useEffect(()=>{
   let active=true;
   const client=getBrowserSupabase();
   if(!client){setStage("error");setErrorText("Authentication configuration is unavailable.");return;}
   (async()=>{
     const {data:user,error:userError}=await client.auth.getUser();
     if(!active)return;
     if(userError||!user.user){setStage("signed-out");return;}
     setStage("loading");
     const [entitiesResult,obligationsResult]=await Promise.all([
       client.from("entities").select("id,slug,name,subtype,status").neq("status","ARCHIVED").order("name"),
       client.from("obligations").select("id,title,status,related_entity_id,requires_owner_attention,due_at").neq("status","ARCHIVED").order("title")
     ]);
     if(!active)return;
     if(entitiesResult.error||obligationsResult.error){
       setStage("error");setErrorText("Unable to read private records. Authorization or connectivity needs checking.");return;
     }
     setRecords(entitiesResult.data??[]);
     setObligations(obligationsResult.data??[]);
     setNow(Date.now());
     setStage("ready");
   })().catch(()=>{if(active){setStage("error");setErrorText("Database check could not complete.");}});
   return()=>{active=false;};
 },[]);
 return <main className="shell"><header><p className="eyebrow">KAIKOA OS · PRIVATE WORKSPACE</p><h1>Private OS.</h1>
 <p className="muted">Your authenticated workspace · records from PostgreSQL</p></header>
 {stage==="checking"||stage==="loading"?<p role="status">Checking private access…</p>:null}
 {stage==="signed-out"?<section className="panel"><h2>Authentication required</h2><p>This page requires a signed-in account.</p><Link href="/auth/sign-in">Sign in →</Link></section>:null}
 {stage==="error"?<section className="panel" role="alert"><h2>Unable to load records</h2><p>{errorText}</p></section>:null}
 {stage==="ready"?<><section className="metrics workflowMetrics" aria-label="Live obligation summary">{obligationFilters.map(m=><button type="button" key={m.key} onClick={()=>{setFilter(current=>current===m.key?null:m.key);document.getElementById("private-obligations")?.scrollIntoView({behavior:"smooth",block:"start"});}} aria-pressed={filter===m.key} className="metric" style={{textAlign:"left",cursor:"pointer",color:"inherit",background:filter===m.key?"#202831":undefined}}><strong>{obligations.filter(o=>classify(o,now??Date.now())[m.key]).length}</strong><span>{m.label}</span></button>)}</section><section className="panel" id="assets-and-records"><h2>Assets & Records · {records.length}</h2>{records.length===0?<p>No accessible records found.</p>:[...new Set(records.map(r=>r.subtype??"other"))].sort((a,b)=>{const ai=categoryOrder.indexOf(a),bi=categoryOrder.indexOf(b);return (ai<0?999:ai)-(bi<0?999:bi)||a.localeCompare(b)}).map(category=><div key={category}><h3 className="eyebrow" style={{marginTop:26,marginBottom:6}}>{categoryLabels[category]??category.replaceAll("_"," ")}</h3>{records.filter(r=>(r.subtype??"other")===category).map(r=><Link className="item itemLink" href={"/private-memory/assets/"+encodeURIComponent(r.slug)} key={r.id}><strong>{r.name} →</strong><p>{r.status}</p></Link>)}</div>)}</section><section className="panel" id="private-obligations"><div className="sectionHead"><h2>{filter?obligationFilters.find(metric=>metric.key===filter)?.label:"Active obligations"} · {visibleObligations(obligations,filter,now??Date.now()).length}</h2>{filter&&<button type="button" onClick={()=>setFilter(null)}>Show All</button>}</div>{visibleObligations(obligations,filter,now??Date.now()).map(o=>{const linked=records.find(r=>r.id===o.related_entity_id);return linked?<Link className="item itemLink" key={o.id} href={"/private-memory/obligations/edit?id="+encodeURIComponent(o.id)}><strong>{o.title} →</strong><p>{linked.name} · {obligationStatusLabel(o.status,o.requires_owner_attention)}</p><ObligationDeadline record={o} now={now??Date.now()}/></Link>:<div className="item" key={o.id}><strong>{o.title}</strong><p>{obligationStatusLabel(o.status,o.requires_owner_attention)} · Unlinked</p><ObligationDeadline record={o} now={now??Date.now()}/></div>})}</section></>:null}
</main>;
}
