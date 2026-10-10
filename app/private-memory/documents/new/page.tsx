"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { referencePayload } from "@/lib/drive-reference";

type EntityOption = { id: string; name: string };
export default function NewDocumentReferencePage() {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [entityId, setEntityId] = useState("");
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [nonSensitive, setNonSensitive] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const mounted = useRef(true), inFlight = useRef(false), userId = useRef<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    (async () => {
      const db = getBrowserSupabase();
      if (!db) throw new Error("Unavailable");
      const { data: identity, error: authError } = await db.auth.getUser();
      if (!mounted.current) return;
      if (authError || !identity.user) throw new Error("Sign in first.");
      userId.current = identity.user.id;
      const { data, error } = await db.from("entities").select("id,name").neq("status", "ARCHIVED").order("name");
      if (!mounted.current) return;
      if (error) throw new Error("Unavailable");
      setEntities(data ?? []); setReady(true);
    })().catch(() => { if (mounted.current) setMessage("Unable to prepare this form. Reload to retry."); });
    return () => { mounted.current = false; userId.current = null; };
  }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || saved || !ready) return;
    let payload;
    try { payload = referencePayload(title, url, note, entityId, confirmed, nonSensitive); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Check these details."); return; }
    inFlight.current = true; setBusy(true); setMessage("Saving document reference…");
    try {
      const db = getBrowserSupabase();
      if (!db) throw new Error("Connection unavailable.");
      const { data: identity, error: authError } = await db.auth.getUser();
      if (!mounted.current) return;
      if (authError || !identity.user || identity.user.id !== userId.current) throw new Error("Your account changed. Reload before saving.");
      const { data, error } = await db.rpc("register_drive_reference", payload);
      if (!mounted.current) return;
      if (error || !data?.id) throw new Error("The reference could not be saved. Check for a conflicting link, then reload before retrying.");
      const { data: identityAfter, error: identityError } = await db.auth.getUser();
      if (!mounted.current) return;
      if (identityError || identityAfter.user?.id !== userId.current) throw new Error("Account changed after saving. Reload to check the result.");
      const { data: document, error: readError } = await db.from("documents").select("id,title,external_provider,source_url,document_type,source_note:metadata->source_note").eq("id", data.id).single();
      if (!mounted.current) return;
      if (readError || document.title !== payload.p_title || document.external_provider !== "google_drive" || document.source_url !== payload.p_drive_url || document.document_type !== payload.p_document_type || document.source_note !== payload.p_source_note)
        throw new Error("The save needs verification. Reload Documents before retrying.");
      if (payload.p_entity_id) {
        const { data: link, error: linkError } = await db.from("document_links").select("document_id,entity_id").eq("document_id", data.id).eq("entity_id", payload.p_entity_id).maybeSingle();
        if (!mounted.current) return;
        if (linkError || !link) throw new Error("The related record needs verification. Reload Documents before retrying.");
      }
      setSaved(true); setMessage("Document reference saved and checked. Its contents remain unverified.");
    } catch (error) { if (mounted.current) setMessage(error instanceof Error ? error.message : "Unable to save. Reload to check the result."); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  return <main className="shell"><header><p className="eyebrow">KAIKOA OS · DOCUMENTS</p><h1>Add document link.</h1><p className="muted">Save a non-sensitive file reference and optionally connect it to a recorded asset. Google Drive keeps the file.</p></header>
    <form className="panel workflowForm" onSubmit={event => void save(event)}>
      <fieldset className="editionFieldset" disabled={!ready || busy || saved}>
        <label htmlFor="document-title">Document title</label><input id="document-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={120} required />
        <label htmlFor="document-url">Google Drive file link</label><input id="document-url" type="url" value={url} onChange={event => setUrl(event.target.value)} maxLength={500} required />
        <label htmlFor="document-entity">Related record (optional)</label><select id="document-entity" value={entityId} onChange={event => setEntityId(event.target.value)}><option value="">No related record yet</option>{entities.map(entity => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select>
        <label htmlFor="document-source">Source note</label><textarea id="document-source" value={note} onChange={event => setNote(event.target.value)} maxLength={1000} rows={3} required />
        <p className="muted">The link does not grant access to Google Drive or verify the file's contents. Keep sensitive details out of the title and source note.</p>
        <label className="confirmCompletion"><input type="checkbox" checked={nonSensitive} onChange={event => setNonSensitive(event.target.checked)} />This file and its reference details are non-sensitive.</label>
        <label className="confirmCompletion"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I confirm this reference and optional related record.</label>
        <button type="submit" disabled={!confirmed || !nonSensitive}>{busy ? "Saving…" : "Save reference"}</button>
      </fieldset>
      {message && <p role="status">{message}</p>}
      <p><Link href="/private-memory/documents">{saved ? "View Documents →" : "Back to Documents"}</Link></p>
    </form>
  </main>;
}
