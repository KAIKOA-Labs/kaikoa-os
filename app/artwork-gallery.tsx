import Link from "next/link";
import { artGalleryStats } from "@/lib/art-gallery-stats";
import type { InventoryRecord } from "@/lib/inventory-view";

export default function ArtworkGallery({ records }: { records: InventoryRecord[] }) {
 return <div className="fineArtGallery">
   <div className="fineArtGalleryIntro">
     <div><p className="eyebrow">KAIKOA · PRIVATE COLLECTION</p><h2>Works and editions</h2>
       <p className="muted">Each numbered work has its own location, production and delivery history. Actual artwork images will be added when verified.</p></div>
     <span className="fineArtGalleryTotal">{records.length} {records.length === 1 ? "artwork" : "artworks"}</span>
   </div>
   <div className="fineArtGrid">
     {records.map(item => {
       const stats=artGalleryStats(item.artwork_print_registry);
       const url="/private-memory/artwork/"+encodeURIComponent(item.slug)+"/prints";
       return <article className="fineArtCard" key={item.id}>
         <Link href={url} className="fineArtCanvas" aria-label={"Open "+item.name+" inventory"}>
           <span className="fineArtCanvasEyebrow">KAIKOA · FINE ART</span>
           <span className="fineArtCanvasTitle">{item.name}</span>
           <small>Image awaiting verified source</small>
         </Link>
         <div className="fineArtCardBody">
           <p className="eyebrow">ARTWORK</p><h3>{item.name}</h3>
           {stats.state === "recorded" ? <>
             <div className="fineArtMetrics">
               <div><strong>{stats.versions}</strong><small>Versions</small></div>
               <div><strong>{stats.recorded}</strong><small>Print records</small></div>
               <div><strong>{stats.proofs}</strong><small>Artist proofs</small></div>
             </div>
             <div className="fineArtHighlights">
               {stats.held>0 && <span>{stats.held} held</span>}
               {stats.awaitingHandover>0 && <span>{stats.awaitingHandover} awaiting handover</span>}
               {stats.delivered>0 && <span>{stats.delivered} delivered</span>}
               {stats.sold>0 && <span>{stats.sold} sold</span>}
               {stats.locked>0 && <span>{stats.locked} locked edition</span>}
             </div>
             <div className="fineArtEditions">
               {stats.registry!.rules.map(rule => {
                 const list=stats.registry!.prints.filter(p=>p.edition_label===rule.edition_label);
                 return <div className="fineArtEditionRow" key={rule.edition_label}>
                   <div><strong>{rule.edition_label}</strong><small>{list.length} recorded · {list.filter(p=>p.kind==="artist_proof").length} AP</small></div>
                   <span>{rule.reproduction_locked ? "1/1 · locked" : "Edition of "+rule.numbered_limit}</span>
                 </div>;
               })}
             </div>
             <p className="muted fineArtFootnote">These are recorded physical prints, not verified available-for-sale stock.</p>
           </> : <div className="fineArtEmpty">
             <strong>{stats.state==="missing"?"Inventory awaiting import":"Inventory requires review"}</strong>
             <p className="muted">{stats.state==="missing"?"No physical print records have been saved for this artwork.":"Saved data could not be validated; no quantities are inferred."}</p>
           </div>}
           <div className="fineArtActions"><Link href={url}>View prints →</Link><Link href={"/private-memory/assets/"+encodeURIComponent(item.slug)}>Artwork details</Link></div>
         </div>
       </article>;
     })}
   </div>
 </div>;
}
