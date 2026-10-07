"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";

type RecordRow = { id: string; slug: string; name: string; subtype: string | null; status: string };
type ObligationRow = { id: string; title: string; status: string; related_entity_id: string | null };
type ViewState = "checking" | "signed-out" | "loading" | "ready" | "error";
export default function PrivateMemoryPage() {
 const [stage,setStage]=useState<ViewState>("checking");
 const [records,setRecords]=useState<RecordRow[]>([]);
 const [obligations,setObligations]=useState<ObligationRow[]>([]);
 const [errorText,setErrorText]=useState("");
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
       client.from("entities").select("id,slug,name,subtype,status").order("name"),
       client.from("obligations").select("id,title,status,related_entity_id").order("title")
     ]);
     if(!active)return;
     if(entitiesResult.error||obligationsResult.error){
       setStage("error");setErrorText("Unable to read private records. Authorization or connectivity needs checking.");return;
     }
     setRecords(entitiesResult.data??[]);
     setObligations(obligationsResult.data??[]);
     setStage("ready");
   })().catch(()=>{if(active){setStage("error");setErrorText("Database check could not complete.");}});
   return()=>{active=false;};
 },[]);
 return <main className="shell"><header><p className="eyebrow">KAIKOA OS · MILESTONE 003</p><h1>Private memory.</h1>
 <p className="muted">Your authenticated workspace · records from PostgreSQL</p></header>
 {stage==="checking"||stage==="loading"?<p role="status">Checking private access…</p>:null}
 {stage==="signed-out"?<section className="panel"><h2>Authentication required</h2><p>This page requires a signed-in account.</p><Link href="/auth/sign-in">Sign in →</Link></section>:null}
 {stage==="error"?<section className="panel" role="alert"><h2>Unable to load records</h2><p>{errorText}</p></section>:null}
 {stage==="ready"?<><section className="panel"><h2>Assets & Records · {records.length}</h2>{records.length===0?<p>No accessible records found.</p>:records.map(r=><Link className="item itemLink" href={"/private-memory/assets/"+encodeURIComponent(r.slug)} key={r.id}><strong>{r.name} →</strong><p>{r.subtype?.replaceAll("_"," ")??"Entity"} · {r.status}</p></Link>)}</section><section className="panel"><h2>Obligations · {obligations.length}</h2>{obligations.map(o=>{const linked=records.find(r=>r.id===o.related_entity_id);return linked?<Link className="item itemLink" key={o.id} href={"/private-memory/assets/"+encodeURIComponent(linked.slug)+"#obligations"}><strong>{o.title} →</strong><p>{linked.name} · {o.status}</p></Link>:<div className="item" key={o.id}><strong>{o.title}</strong><p>{o.status} · Unlinked</p></div>})}</section></>:null}
</main>;
}
