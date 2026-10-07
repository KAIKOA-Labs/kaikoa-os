import { notFound, redirect } from "next/navigation";
const legacySlugs:Record<string,string>={"kaikoa":"kaikoa","burgos":"burgos","kaikoa-com":"kaikoa-com"};
export default async function EntityPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const slug=legacySlugs[id];
 if(!slug)notFound();
 redirect("/private-memory/assets/"+encodeURIComponent(slug));
}
