"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import InventorySectionLinks from "@/app/inventory-section-links";
import CommandCenterReview from "@/app/command-center-review";
import type { CommandCenterRecord } from "@/lib/command-center-review";
import ObligationDeadline from "@/app/obligation-deadline";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { classifyObligation as classify, obligationFilters, obligationStatusLabel, visibleObligations, type ObligationFilter as Filter } from "@/lib/obligation-workflow";
type Asset=CommandCenterRecord & {location:string|null};
type Obligation={id:string;title:string;status:string;related_entity_id:string|null;requires_owner_attention:boolean;due_at:string|null;next_action:string|null};
const Nav=()=> <nav className="nav"><Link className="brand" href="/">KAIKOA OS</Link><div><Link href="/">Home</Link><Link href="/assets">Assets</Link><Link href="/operations">Operations</Link><Link href="/private-memory">Private OS →</Link></div></nav>;
export default function Home(){
 const [state,setState]=useState("checking");
 const [assets,setAssets]=useState<Asset[]>([]);
 const [obligations,setObligations]=useState<Obligation[]>([]);
 const [filter,setFilter]=useState<Filter>(null);
 const [now,setNow]=useState(0);
 useEffect(()=>{let active=true;(async()=>{
  const db=getBrowserSupabase();if(!db){setState("unavailable");return;}
  const {data:user,error:authError}=await db.auth.getUser();if(!active)return;
  if(authError||!user.user){setState("signed-out");return;}
  const [a,o]=await Promise.all([db.from("entities").select("id,slug,name,subtype,status,location,data_quality,artwork_inventory_version:metadata->artwork_inventory->>version,subscription_review_version:metadata->subscription_review->>version,subscription_billing_version:metadata->subscription_billing->>version").neq("status","ARCHIVED").order("name"),db.from("obligations").select("id,title,status,related_entity_id,requires_owner_attention,due_at,next_action").neq("status","ARCHIVED").order("title")]);
  if(!active)return;
  if(a.error||o.error){setState("error");return;}
  setAssets(a.data??[]);setObligations(o.data??[]);setNow(Date.now());setState("ready");
 })().catch(()=>{if(active)setState("error")});return()=>{active=false};},[]);
 const metrics=obligationFilters;
 const visible=visibleObligations(obligations,filter,now);
 return <main className="shell"><Nav/>
 {state!=="ready"?<><header><p className="eyebrow">KAIKOA OS · PRIVATE ACCESS</p><h1>{state==="signed-out"?"Welcome to KAIKOA OS.":"KAIKOA OS."}</h1></header><section className="panel"><p role="status">{state==="checking"?"Checking private access…":state==="signed-out"?"Sign in to view your private dashboard.":"The private dashboard is unavailable. Please retry."}</p>{state==="signed-out"&&<Link href="/auth/sign-in">Sign in →</Link>}</section></>:
 <><header><p className="eyebrow">KAIKOA OS · LIVE DASHBOARD</p><h1>Good morning, Eddie.</h1><p className="muted">Your private assets and obligations, connected to live records.</p></header>
 <section className="metrics workflowMetrics" aria-label="Obligation summary">{metrics.map(m=><button type="button" key={m.key} className="metric" aria-pressed={filter===m.key} onClick={()=>{setFilter(f=>f===m.key?null:m.key);document.getElementById("home-obligations")?.scrollIntoView({behavior:"smooth",block:"start"})}} style={{textAlign:"left",cursor:"pointer",color:"inherit",background:filter===m.key?"#202831":undefined}}><strong>{obligations.filter(o=>classify(o,now)[m.key]).length}</strong><span>{m.label}</span></button>)}</section>
 <section className="panel" id="home-obligations"><div className="sectionHead"><h2>{filter?metrics.find(m=>m.key===filter)?.label:"Active obligations"} · {visible.length}</h2>{filter&&<button type="button" onClick={()=>setFilter(null)}>Show All</button>}</div>
 {visible.length===0?<p className="muted">No obligations in this category.</p>:visible.map(o=>{const asset=assets.find(a=>a.id===o.related_entity_id);return <Link key={o.id} className="item itemLink" href={"/private-memory/obligations/edit?id="+encodeURIComponent(o.id)}><div><strong>{o.title} →</strong><p>{asset?.name??(o.related_entity_id?"Related record unavailable":"General responsibility")} · {obligationStatusLabel(o.status,o.requires_owner_attention)}</p></div><ObligationDeadline record={o} now={now}/>{o.next_action&&<small>{o.next_action}</small>}</Link>})}</section>
 <p><Link className="back" href="/private-memory/obligations">Open Obligations workspace →</Link></p>
 <CommandCenterReview records={assets}/>
 <InventorySectionLinks records={assets}/></>}
 </main>;
}