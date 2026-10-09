"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { countInput, emptyEdition, emptyInventory, inventoryFromMetadata, validateInventory, type ArtworkInventory, type Edition, type ArtistProofs } from "@/lib/artwork-inventory";

type Artwork = { id: string; name: string; metadata: Record<string, unknown> };
type DraftEdition = Edition & { key: number };
function CountField({ id, label, value, positive, disabled, onChange }: { id: string; label: string; value: number | null; positive?: boolean; disabled: boolean; onChange: (value: number | null) => void }) {
  return <><label htmlFor={id}>{label} (blank = Unknown)</label><input id={id} type="number" min={positive ? 1 : 0} max={1000000} step={1} value={value ?? ""} disabled={disabled} onChange={event => { try { onChange(countInput(event.target.value)); } catch { event.target.setCustomValidity("Use a whole count between 0 and 1,000,000."); return; } event.target.setCustomValidity(""); }} /></>;
}
export default function ArtworkEditionsPage() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const [artwork, setArtwork] = useState<Artwork | null>(null);
  const [expected, setExpected] = useState<ArtworkInventory | null>(null);
  const [editions, setEditions] = useState<DraftEdition[]>([]);
  const [proofs, setProofs] = useState<ArtistProofs>(emptyInventory().artist_proofs);
  const [state, setState] = useState("Loading artwork…");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const nextKey = useRef(0);
  const inFlight = useRef(false);
  useEffect(() => {
    const request = ++generation.current;
    setArtwork(null); setBusy(false); setState("Loading artwork…"); setMessage("");
    (async () => {
      const db = getBrowserSupabase();
      if (!db) throw new Error("Connection unavailable.");
      const { data: identity, error: authError } = await db.auth.getUser();
      if (generation.current !== request) return;
      if (authError || !identity.user) throw new Error("Sign in to manage artwork editions.");
      const { data, error } = await db.from("entities").select("id,name,metadata").eq("slug", slug).eq("subtype", "artwork").neq("status", "ARCHIVED").maybeSingle();
      if (generation.current !== request) return;
      if (error || !data) throw new Error("Artwork not found or access denied.");
      const inventory = inventoryFromMetadata(data.metadata);
      setArtwork(data); setExpected(inventory);
      setEditions((inventory?.editions ?? []).map(edition => ({ ...edition, key: nextKey.current++ })));
      setProofs(inventory?.artist_proofs ?? emptyInventory().artist_proofs);
      setState("ready");
    })().catch(error => { if (generation.current === request) setState(error instanceof Error ? error.message : "Unable to load editions."); });
    return () => { ++generation.current; };
  }, [slug]);
  function updateEdition(key: number, patch: Partial<Edition>) { setEditions(rows => rows.map(row => row.key === key ? { ...row, ...patch } : row)); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!artwork || inFlight.current) return;
    let inventory: ArtworkInventory;
    try { inventory = validateInventory({ version: 1, editions: editions.map(({ key: _key, ...edition }) => edition), artist_proofs: proofs }); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Check edition details."); return; }
    const request = generation.current;
    inFlight.current = true; setBusy(true); setMessage("Saving editions…");
    try {
      const db = getBrowserSupabase();
      if (!db) throw new Error("Connection unavailable.");
      const { data: identity, error: authError } = await db.auth.getUser();
      if (generation.current !== request) return;
      if (authError || !identity.user) throw new Error("Sign in to save editions.");
      const { data, error } = await db.rpc("update_artwork_inventory", { p_entity_id: artwork.id, p_expected_inventory: expected, p_inventory: inventory });
      if (generation.current !== request) return;
      if (error) throw new Error(error.message === "Artwork inventory changed; reload before saving" ? "This artwork changed in another session. Reload before saving; your current entries remain here for comparison." : "Unable to save. Check the source notes and counts, then retry. No save was confirmed.");
      setExpected(inventory);
      setEditions(rows => inventory.editions.map((edition, index) => ({ ...edition, key: rows[index].key })));
      setProofs(inventory.artist_proofs);
      setMessage(data ? "Saved as unverified source information. Change recorded in History." : "No changes to save.");
    } catch (error) { if (generation.current === request) setMessage(error instanceof Error ? error.message : "Unable to save."); }
    finally { inFlight.current = false; if (generation.current === request) setBusy(false); }
  }
  if (state !== "ready" || !artwork) return <main className="shell"><section className="panel"><p role="status">{state}</p><Link href="/private-memory/artwork">Back to Artwork →</Link></section></main>;
  return <main className="shell">
    <header><p className="eyebrow">KAIKOA OS · ARTWORK</p><h1>Editions.</h1><p>{artwork.name}</p><p className="muted">Leave unconfirmed quantities blank. Record accepted distinct numbered copies; replacements, trial prints and defective copies do not add to that count.</p></header>
    <form className="workflowForm" onSubmit={event => void save(event)}>
      <fieldset disabled={busy} className="editionFieldset">
        {editions.map((edition, index) => <section className="panel" key={edition.key}>
          <h2>Edition / version {index + 1}</h2>
          <label htmlFor={`label-${edition.key}`}>Edition / version label</label><input id={`label-${edition.key}`} value={edition.label} maxLength={120} required onChange={event => updateEdition(edition.key, { label: event.target.value })} />
          <label htmlFor={`size-${edition.key}`}>Image size, including unit (optional)</label><input id={`size-${edition.key}`} value={edition.image_size} maxLength={120} onChange={event => updateEdition(edition.key, { image_size: event.target.value })} />
          <CountField id={`limit-${edition.key}`} label="Numbered edition limit" value={edition.edition_limit} positive disabled={busy} onChange={edition_limit => updateEdition(edition.key, { edition_limit })} />
          <CountField id={`printed-${edition.key}`} label="Accepted numbered copies printed" value={edition.printed_count} disabled={busy} onChange={printed_count => updateEdition(edition.key, { printed_count })} />
          <label htmlFor={`note-${edition.key}`}>Source note (required)</label><textarea id={`note-${edition.key}`} value={edition.source_note} rows={3} maxLength={1000} required onChange={event => updateEdition(edition.key, { source_note: event.target.value })} />
          <label htmlFor={`date-${edition.key}`}>Source date (optional)</label><input id={`date-${edition.key}`} type="date" min="0001-01-01" max="9999-12-31" value={edition.source_date ?? ""} onChange={event => updateEdition(edition.key, { source_date: event.target.value || null })} />
          <button type="button" onClick={() => setEditions(rows => rows.filter(row => row.key !== edition.key))}>Remove this edition from draft</button>
        </section>)}
        <button type="button" disabled={editions.length >= 50} onClick={() => setEditions(rows => [...rows, { ...emptyEdition(), key: nextKey.current++ }])}>Add edition / version</button>
        <section className="panel"><h2>Artist proofs · artwork-wide</h2><p className="muted">Separate from numbered editions. Record an intended allowance independently of copies printed. Allocation between versions remains a source note.</p>
          <CountField id="ap-allowance" label="AP allowance" value={proofs.allowance} disabled={busy} onChange={allowance => setProofs(row => ({ ...row, allowance }))} />
          <CountField id="ap-printed" label="Accepted artist proofs printed" value={proofs.printed_count} disabled={busy} onChange={printed_count => setProofs(row => ({ ...row, printed_count }))} />
          <label htmlFor="ap-size">AP image size, including unit (optional)</label><input id="ap-size" value={proofs.image_size} maxLength={120} onChange={event => setProofs(row => ({ ...row, image_size: event.target.value }))} />
          <label htmlFor="ap-note">AP source note (required when recording AP details)</label><textarea id="ap-note" rows={3} value={proofs.source_note} maxLength={1000} onChange={event => setProofs(row => ({ ...row, source_note: event.target.value }))} />
          <label htmlFor="ap-date">AP source date (optional)</label><input id="ap-date" type="date" min="0001-01-01" max="9999-12-31" value={proofs.source_date ?? ""} onChange={event => setProofs(row => ({ ...row, source_date: event.target.value || null }))} />
        </section>
        <p className="muted">Save applies the entire draft, including removals. Previous information remains in Change History. Still to print is calculated only from known counts and is not available-for-sale stock.</p>
        <button type="submit">{busy ? "Saving…" : "Save editions"}</button>
      </fieldset>
      {message && <p role="status">{message}</p>}
    </form>
    <p><Link href={"/private-memory/assets/" + encodeURIComponent(slug)}>Back to artwork details →</Link></p>
  </main>;
}
