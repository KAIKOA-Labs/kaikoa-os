"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
type Asset={id:string;slug:string;name:string;subtype:string|null;status:string;description:string|null;location:string|null};
type Obligation={id:string;title:string;status:string;next_action:string|null};
export default function PrivateAssetDetail(){
 const params=useParams();
 const slug=typeof params.slug==="string"?params.slug:"";
 const [asset,setAsset]=useState<Asset|null>(null);
 const [items,setItems]=useState<Obligation[]>([]);
 const [state,setState]=useState("Checking private access…");
 useEffect(()=>{
  let active=true;
  (async()=>{
   const db=getBrowserSupabase();
   if(!db){setState("Authentication configuration unavailable.");return;}
   const {data:user,error:authError}=await db.auth.getUser();
   if(!active)return;
   if(authError||!user.user){setState("Authentication required.");return;}
   const {data:entity,error:entityError}=await db.from("entities").select("id,slug,name,subtype,status,description,location").eq("slug",slug).maybeSingle();
   if(!active)return;
   if(entityError){setState("Could not load this asset.");return;}
   if(!entity){setState("Asset not found or access denied.");return;}
   const {data:obligations,error:obligationError}=await db.from("obligations").select("id,title,status,next_action").eq("related_entity_id",entity.id).order("title");
   if(!active)return;
   if(obligationError){setState("Could not load linked obligations.");return;}
   setAsset(entity);setItems(obligations??[]);setState("ready");
  })().catch(()=>{if(active)setState("Could not complete the request.");});
  return()=>{active=false;};
 },[slug]);
 return <main className="shell">
 {state!=="ready"?<section className="panel"><p role="status">{state}</p>{state==="Authentication required."&&<Link href="/auth/sign-in">Sign in →</Link>}</section>:asset&&<>
 <header><p className="eyebrow">{asset.subtype?.replaceAll("_"," ")??"Asset"} · Private inventory</p><h1>{asset.name}</h1><p className="muted">{asset.status}</p></header>
 <section className="panel"><h2>Asset details</h2><p style={{whiteSpace:"pre-wrap"}}>{asset.description||"No description recorded."}</p>{asset.location&&<p className="muted">Location: {asset.location}</p>}<p><Link href={"/private-memory/edit?asset="+encodeURIComponent(asset.slug)}>Edit description →</Link></p></section>
 <section className="panel" id="obligations"><h2>Linked obligations · {items.length}</h2>{items.length===0?<p className="muted">No linked obligations recorded.</p>:items.map(o=><div className="item" key={o.id}><div><strong>{o.title}</strong><p>{o.next_action}</p></div><span className="status">{o.status}</span></div>)}</section>
 </>}
 </main>;
}