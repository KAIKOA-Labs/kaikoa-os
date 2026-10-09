import Link from "next/link";
import { copiesStillToPrint, inventoryFromMetadata } from "@/lib/artwork-inventory";

export default function ArtworkInventorySummary({ slug, metadata }: { slug: string; metadata: unknown }) {
  let inventory;
  try { inventory = inventoryFromMetadata(metadata); }
  catch { return <section className="panel"><h2>Artwork editions</h2><p role="status">Stored edition information needs review. No counts are inferred.</p></section>; }
  const show = (value: number | null) => value === null ? "Unknown" : value;
  return <section className="panel">
    <h2>Editions and artist proofs</h2>
    <p className="muted">Recorded source information · unverified. Printed counts describe accepted distinct numbered copies, including sold or allocated copies.</p>
    {!inventory || inventory.editions.length === 0 ? <p>No edition versions recorded.</p> : inventory.editions.map(edition => <article className="item" key={edition.label}>
      <strong>{edition.label}</strong><span className="status">Unverified</span>
      <p>Image size: {edition.image_size || "Unknown"}</p>
      <small>Edition limit: {show(edition.edition_limit)} · Printed: {show(edition.printed_count)} · Still to print: {show(copiesStillToPrint(edition))}</small>
      <small style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>Source: {edition.source_note} · Date: {edition.source_date || "Unknown"}</small>
    </article>)}
    <h3>Artist proofs · artwork-wide</h3>
    <p>Allowance: {show(inventory?.artist_proofs.allowance ?? null)} · Printed: {show(inventory?.artist_proofs.printed_count ?? null)}</p>
    <p className="muted">Outside the numbered editions. An allowance does not mean copies have been printed; allocation between versions is not inferred.</p>
    {inventory?.artist_proofs.image_size && <p>AP image size: {inventory.artist_proofs.image_size}</p>}
    {inventory?.artist_proofs.source_note && <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>Source: {inventory.artist_proofs.source_note} · Date: {inventory.artist_proofs.source_date || "Unknown"}</p>}
    <p className="muted">Still to print is not stock available for sale.</p>
    <Link href={"/private-memory/artwork/" + encodeURIComponent(slug) + "/editions"}>Manage editions →</Link>
  </section>;
}
