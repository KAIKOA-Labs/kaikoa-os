"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {getBrowserSupabase} from "@/lib/supabase-browser";
type Subscription={id:string;name:string;slug:string;status:string;metadata:{billing?:{amount?:number;currency?:string;cadence?:string;verification?:string;price_type?:string}}};
const reviewCandidates=[
 {name:"ChatGPT",hint:"Confirm plan and billing channel"},
 {name:"Claude",hint:"Check current plan and actual usage"},
 {name:"Adobe",hint:"Identify products and billing frequency"},
 {name:"Netflix",hint:"Check active account and payment method"},
 {name:"Disney+",hint:"Check active account and payment method"},
 {name:"Music & DJ software",hint:"Identify each separately billed service"}
] as const;
export default function Subscriptions(){
 const [state,setState]=useState("Checking access…");
 const [items,setItems]=useState<Subscription[]>([]);
 const [expanded,setExpanded]=useState<string|null>(null);
 useEffect(()=>{let active=true;(async()=>{
 const db=getBrowserSupabase();if(!db){setState("Database unavailable.");return;}
 const {data:user,error:authError}=await db.auth.getUser();if(!active)return;
 if(authError||!user.user){setState("Sign in required.");return;}
 const {data,error}=await db.from("entities").select("id,name,slug,status,metadata").eq("subtype","subscription").order("name");
 if(!active)return;
 if(error){setState("Unable to load subscriptions.");return;}
 setItems((data??[]) as Subscription[]);setState("ready");
 })().catch(()=>{if(active)setState("Unable to load subscriptions.");});return()=>{active=false};},[]);
 const confirmed=items.filter(x=>x.metadata?.billing?.verification&&typeof x.metadata.billing.amount==="number");
 const monthly=confirmed.reduce((sum,x)=>{const b=x.metadata.billing!;return sum+(b.cadence==="monthly"?b.amount!:b.cadence==="annual"?b.amount!/12:0)},0);
 return <main className="shell"><header><p className="eyebrow">KAIKOA OS · FINANCIAL OPERATIONS</p><h1>Subscriptions.</h1><p className="muted">Verified recurring services only. Unknown expenses are not included in totals.</p></header>
 {state!=="ready"?<section className="panel"><p role="status">{state}</p>{state==="Sign in required."&&<Link href="/auth/sign-in">Sign in →</Link>}</section>:
 <><section className="panel"><p className="eyebrow">Confirmed monthly base commitments · USD</p><h2>${monthly.toFixed(2)} / month</h2><p className="muted">Annualized base: ${(monthly*12).toFixed(2)}. Excludes tax, usage-based charges and unverified subscriptions.</p></section>
 <section className="panel"><h2>Verified services · {confirmed.length}</h2>{confirmed.map(x=><div className="item" key={x.id}><div><strong>{x.name}</strong><p className="muted">{x.status} · {x.metadata.billing?.cadence??"Cadence unknown"} · Base plan</p></div><strong>${x.metadata.billing?.amount?.toFixed(2)} {x.metadata.billing?.currency}</strong></div>)}</section>
 <section className="panel"><h2>Needs Verification · {reviewCandidates.filter(c=>!items.some(i=>i.name.toLowerCase()===c.name.toLowerCase())).length}</h2><p className="muted">Possible subscriptions only. These are not confirmed active and do not count toward monthly totals. Review details below; no changes are saved yet.</p>
 {reviewCandidates.filter(c=>!items.some(i=>i.name.toLowerCase()===c.name.toLowerCase())).map(candidate=><div className="item" key={candidate.name} style={{display:"block"}}>
 <button type="button" onClick={()=>setExpanded(v=>v===candidate.name?null:candidate.name)} aria-expanded={expanded===candidate.name} style={{display:"flex",width:"100%",alignItems:"center",justifyContent:"space-between",textAlign:"left",color:"inherit",background:"transparent",border:0,cursor:"pointer",padding:0}}>
 <span><strong>{candidate.name}</strong><span className="muted" style={{display:"block",marginTop:6}}>{candidate.hint}</span></span><span className="muted">{expanded===candidate.name?"Hide details −":"Review →"}</span></button>
 {expanded===candidate.name&&<div style={{marginTop:18}}><p><strong>Verification checklist</strong></p><ul><li>Is this service currently active?</li><li>What is the actual charged amount and currency?</li><li>Is billing monthly or annual, and through which provider?</li><li>Which account pays, and when is the next confirmed renewal?</li><li>Are you using it enough to keep it?</li></ul><p className="muted">Evidence: invoice, account billing screen or receipt. Do not enter passwords or full payment-card numbers.</p></div>}
 </div>)}
 </section></>}
 </main>;
}