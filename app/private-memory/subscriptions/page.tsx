"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {getBrowserSupabase} from "@/lib/supabase-browser";
type Subscription={id:string;name:string;slug:string;status:string;metadata:{billing?:{amount?:number;currency?:string;cadence?:string;verification?:string;price_type?:string}}};
export default function Subscriptions(){
 const [state,setState]=useState("Checking access…");
 const [items,setItems]=useState<Subscription[]>([]);
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
 <section className="panel"><h2>To investigate</h2><p className="muted">ChatGPT, Claude, Netflix, Disney+, Adobe, music software and other services. These are discovery candidates, not verified active subscriptions or charges.</p></section></>}
 </main>;
}