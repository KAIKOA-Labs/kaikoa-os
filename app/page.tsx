"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
type Asset={id:string;slug:string;name:string;subtype:string|null;status:string;location:string|null};
type Obligation={id:string;title:string;status:string;related_entity_id:string|null;requires_owner_attention:boolean;due_at:string|null;next_action:string|null};
type Filter="requires"|"overdue"|"waiting"|"soon"|null;
const statusLabels:Record<string,string>={ATTENTION:"Needs Attention",UPCOMING:"Upcoming",IN_PROGRESS:"In Progress",WAITING_ON:"Waiting On"};
function classify(o:Obligation,now:number){
 const due=o.due_at?Date.parse(o.due_at):NaN,active=o.status!=="COMPLETED";
 return {requires:active&&o.requires_owner_attention&&o.status!=="WAITING_ON",overdue:active&&Number.isFinite(due)&&due<now,waiting:active&&(o.status==="WAITING_ON"||o.status==="WAITING"),soon:active&&Number.isFinite(due)&&due>=now&&due<=now+14*86400000};
}
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
  const [a,o]=await Promise.all([db.from("entities").select("id,slug,name,subtype,status,location").order("name"),db.from("obligations").select("id,title,status,related_entity_id,requires_owner_attention,due_at,next_action").order("title")]);
  if(!active)return;
  if(a.error||o.error){setState("error");return;}
  setAssets(a.data??[]);setObligations(o.data??[]);setNow(Date.now());setState("ready");
 })().catch(()=>{if(active)setState("error")});return()=>{active=false};},[]);
 const metrics=[{key:"requires",label:"Requires You"},{key:"overdue",label:"Overdue"},{key:"waiting",label:"Waiting On"},{key:"soon",label:"Due Soon"}] as const;
 const visible=obligations.filter(o=>!filter||classify(o,now)[filter]);
 return <main className="shell"><Nav/>
 {state!=="ready"?<><header><p className="eyebrow">KAIKOA OS · PRIVATE ACCESS</p><h1>{state==="signed-out"?"Welcome to KAIKOA OS.":"KAIKOA OS."}</h1></header><section className="panel"><p role="status">{state==="checking"?"Checking private access…":state==="signed-out"?"Sign in to view your private dashboard.":"The private dashboard is unavailable. Please retry."}</p>{state==="signed-out"&&<Link href="/auth/sign-in">Sign in →</Link>}</section></>:
 <><header><p className="eyebrow">KAIKOA OS · LIVE DASHBOARD</p><h1>Good morning, Eddie.</h1><p className="muted">Your private assets and obligations, connected to live records.</p></header>
 <section className="metrics" aria-label="Obligation summary">{metrics.map(m=><button type="button" key={m.key} className="metric" aria-pressed={filter===m.key} onClick={()=>{setFilter(f=>f===m.key?null:m.key);document.getElementById("home-obligations")?.scrollIntoView({behavior:"smooth",block:"start"})}} style={{textAlign:"left",cursor:"pointer",color:"inherit",background:filter===m.key?"#202831":undefined}}><strong>{obligations.filter(o=>classify(o,now)[m.key]).length}</strong><span>{m.label}</span></button>)}</section>
 <section className="panel" id="home-obligations"><div className="sectionHead"><h2>{filter?metrics.find(m=>m.key===filter)?.label:"Obligations"} · {visible.length}</h2>{filter&&<button type="button" onClick={()=>setFilter(null)}>Show All</button>}</div>
 {visible.length===0?<p className="muted">No obligations in this category.</p>:visible.map(o=>{const asset=assets.find(a=>a.id===o.related_entity_id);return <Link key={o.id} className="item itemLink" href={asset?"/private-memory/assets/"+encodeURIComponent(asset.slug)+"#obligations":"/private-memory"}><div><strong>{o.title} →</strong><p>{asset?.name??"Unlinked"} · {statusLabels[o.status]??o.status}</p></div>{o.next_action&&<small>{o.next_action}</small>}</Link>})}</section>
 <section className="panel"><div className="sectionHead"><h2>Assets & Records · {assets.length}</h2><Link href="/private-memory">Private OS →</Link></div><div className="assetGrid">{assets.map(a=><Link key={a.id} className="asset assetLink" href={"/private-memory/assets/"+encodeURIComponent(a.slug)}><span className="eyebrow">{a.subtype?.replaceAll("_"," ")??"Record"}</span><strong>{a.name}</strong><span>{a.status}</span>{a.location&&<small>{a.location}</small>}</Link>)}</div></section></>}
 </main>;
}