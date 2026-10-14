"use client";
import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase-browser";

const BUCKET="kaikoa-private-art-previews";
const IMAGES: Record<string,readonly { label:string;path:string }[]> = {
  "karmic-bloom":[{label:"White background",path:"karmic-bloom/primary.webp"}],
  "la-vie-en-rose":[{label:"White background",path:"la-vie-en-rose/white.webp"},{label:"Black background · 1/1",path:"la-vie-en-rose/black.webp"}],
  "king-of-the-air":[{label:"Original edition",path:"king-of-the-air/primary.webp"}]
};
export type ArtworkPreview={label:string;url:string};
export function approvedImageSlots(slug:string){return IMAGES[slug]??[];}
export function usePrivateArtworkPreviews(slugs:string[]) {
  const [images,setImages]=useState<Record<string,ArtworkPreview[]>>({});
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    async function load(){
      const client=getBrowserSupabase();
      if(!client) {if(active)setError("Private image connection unavailable.");return;}
      const {data:identity,error:authError}=await client.auth.getUser();
      if(authError||!identity.user) {if(active)setError("Sign in to view private images.");return;}
      const next:Record<string,ArtworkPreview[]>={};
      for(const slug of slugs){
        next[slug]=[];
        for(const slot of approvedImageSlots(slug)){
          const {data,error}=await client.storage.from(BUCKET).createSignedUrl(slot.path,300);
          if(!error && data?.signedUrl)next[slug].push({label:slot.label,url:data.signedUrl});
        }
      }
      if(active){setImages(next);setError("");}
    }
    void load();
    const interval=setInterval(()=>{if(active)void load();},240000);
    return()=>{active=false;clearInterval(interval);};
  },[slugs.join("|")]);
  return {images,error};
}
export async function uploadPrivateArtworkPreview(path:string,file:File){
  if(!Object.values(IMAGES).flat().some(v=>v.path===path))throw Error("Unrecognized artwork image slot.");
  if(file.type!=="image/webp" || file.size<=0 || file.size>524288)throw Error("Select a WebP image no larger than 512 KB.");
  const header=new Uint8Array(await file.slice(0,12).arrayBuffer());
  const string=String.fromCharCode(...header);
  if(!string.startsWith("RIFF")||string.slice(8,12)!=="WEBP")throw Error("Invalid WebP file signature.");
  const client=getBrowserSupabase();
  if(!client)throw Error("Private image connection unavailable.");
  const {data:identity,error:authError}=await client.auth.getUser();
  if(authError||!identity.user)throw Error("Sign in before uploading private artwork.");
  const {error}=await client.storage.from(BUCKET).upload(path,file,{contentType:"image/webp",cacheControl:"60",upsert:false});
  if(error)throw Error(error.message);
}
