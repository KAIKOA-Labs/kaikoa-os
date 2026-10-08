"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { artworkCreationPayload } from "@/lib/artwork-create";

export default function NewArtworkPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(false);
  const [message, setMessage] = useState("");
  const mounted = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || created) return;
    let payload;
    try { payload = artworkCreationPayload(name, description); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Check your artwork details."); return; }
    inFlight.current = true;
    setBusy(true); setMessage("Saving artwork…");
    try {
      const db = getBrowserSupabase();
      if (!db) throw new Error("Connection unavailable. Please try again.");
      const { data, error: authError } = await db.auth.getUser();
      if (!mounted.current) return;
      if (authError || !data.user) throw new Error("Sign in to create artwork.");
      const { error } = await db.rpc("create_inventory_asset", payload);
      if (!mounted.current) return;
      if (error) throw new Error("Unable to create artwork. Check for a duplicate title or invalid details, then try again.");
      setCreated(true);
      setMessage("Artwork created as Unverified. Creation is recorded in Change History.");
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error ? error.message : "Unable to save artwork. Please try again.");
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return <main className="shell">
    <header><p className="eyebrow">KAIKOA OS · ARTWORK</p><h1>Add artwork.</h1>
      <p className="muted">Start with a title and optional description. New work is recorded as Unverified.</p></header>
    <form className="panel workflowForm" onSubmit={event => void save(event)}>
      <label htmlFor="artwork-title">Artwork title</label>
      <input id="artwork-title" value={name} onChange={event => setName(event.target.value)} maxLength={120} required disabled={busy || created} />
      <label htmlFor="artwork-description">Description (optional)</label>
      <textarea id="artwork-description" value={description} onChange={event => setDescription(event.target.value)} maxLength={1000} rows={4} disabled={busy || created} />
      <p className="muted">Use a short description of the work. Edition quantities, prices and sales can be recorded in a later step.</p>
      <button type="submit" disabled={busy || created || name.trim().length < 2}>{busy ? "Saving…" : "Create artwork"}</button>
      {message && <p role="status">{message}</p>}
      <p><Link href="/private-memory/artwork">{created ? "View Artwork →" : "Back to Artwork"}</Link></p>
    </form>
  </main>;
}
