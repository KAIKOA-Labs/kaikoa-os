"use client";
import { useState, type ChangeEvent } from "react";
import Link from "next/link";
import { approvedImageSlots, uploadPrivateArtworkPreview } from "@/lib/private-artwork-images";

const WORKS=[
 {slug:"karmic-bloom",title:"Karmic Bloom"},
 {slug:"la-vie-en-rose",title:"La Vie en Rose"},
 {slug:"king-of-the-air",title:"King of the Air"}
];
export default function ArtworkImagesPage(){
 const [files,setFiles]=useState<Record<string,File|null>>({});
 const [status,setStatus]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState("");
 function choose(path:string,e:ChangeEvent<HTMLInputElement>){
   setFiles(s=>({...s,[path]:e.target.files?.[0]??null}));
   setStatus(s=>({...s,[path]:""}));
 }
 async function upload(path:string){
   const file=files[path];if(!file||busy)return;
   if(!window.confirm("Upload this selected lightweight image to your private artwork preview storage? Existing image slots will not be overwritten."))return;
   setBusy(path);setStatus(s=>({...s,[path]:"Checking private owner access and uploading…"}));
   try{
     await uploadPrivateArtworkPreview(path,file);
     setStatus(s=>({...s,[path]:"Uploaded to private storage. Return to Artwork to see it."}));
   }catch(err){setStatus(s=>({...s,[path]:err instanceof Error?err.message:"Upload failed. No success confirmed."}));}
   finally{setBusy("");}
 }
 return <main className="shell">
   <header><p className="eyebrow">KAIKOA OS · PRIVATE ARTWORK</p><h1>Artwork images.</h1>
     <p className="muted">Upload only lightweight WebP previews. Your original TIFF masters belong in the private Drive archive, never here or in public GitHub. Each preview remains owner-access restricted.</p></header>
   <section className="panel">
     {WORKS.map(work=><div className="detail" style={{marginBottom:16}} key={work.slug}>
       <h2>{work.title}</h2>
       {approvedImageSlots(work.slug).map(slot=><div key={slot.path} style={{marginBottom:16}}>
         <p><strong>{slot.label}</strong></p>
         <label htmlFor={slot.path}>Choose preview (WebP, 512 KB maximum)</label>
         <input id={slot.path} type="file" accept="image/webp,.webp" disabled={Boolean(busy)} onChange={e=>choose(slot.path,e)}/>
         {files[slot.path] && <p className="muted">{files[slot.path]!.name} · {Math.round(files[slot.path]!.size/1024)} KB</p>}
         <p><button type="button" disabled={!files[slot.path]||Boolean(busy)} onClick={()=>void upload(slot.path)}>Upload private preview</button></p>
         {status[slot.path] && <p role="status">{status[slot.path]}</p>}
       </div>)}
     </div>)}
   </section>
   <p><Link href="/private-memory/artwork">Back to Artwork →</Link></p>
 </main>;
}
