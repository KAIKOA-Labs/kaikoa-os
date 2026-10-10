"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { referenceKindLabels, safeDriveLink } from "@/lib/drive-reference";

type DocumentRow = { id: string; title: string; document_type: string; status: string; source_url: string | null; source_note: unknown; recorded_by: unknown };
type EntityRow = { id: string; slug: string; name: string };
type LinkRow = { document_id: string; entity_id: string | null };
type AuditRow = { id: string; document_id: string; actor_kind: string; field_name: string; changed_at: string };
export default function DocumentsPage() {
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [history, setHistory] = useState<AuditRow[]>([]);
  const [stage, setStage] = useState("loading");
  const [query, setQuery] = useState("");
  useEffect(() => {
    let active = true;
    (async () => {
      const db = getBrowserSupabase();
      if (!db) throw new Error("Unavailable");
      const { data: identity, error: authError } = await db.auth.getUser();
      if (!active) return;
      if (authError || !identity.user) { setStage("signed-out"); return; }
      const results = await Promise.all([
        db.from("documents").select("id,title,document_type,status,source_url,source_note:metadata->source_note,recorded_by:metadata->recorded_by").neq("status", "ARCHIVED").order("title"),
        db.from("document_links").select("document_id,entity_id").not("entity_id", "is", null),
        db.from("entities").select("id,slug,name").order("name"),
        db.from("document_change_history").select("id,document_id,actor_kind,field_name,changed_at").order("changed_at", { ascending: false }).limit(20),
      ]);
      if (!active) return;
      if (results.some(result => result.error)) throw new Error("Unavailable");
      setRows(results[0].data as DocumentRow[] ?? []);
      setLinks(results[1].data as LinkRow[] ?? []);
      setEntities(results[2].data as EntityRow[] ?? []);
      setHistory(results[3].data as AuditRow[] ?? []);
      setStage("ready");
    })().catch(() => { if (active) setStage("error"); });
    return () => { active = false; };
  }, []);
  const locations = rows.filter(row => ["drive_library", "drive_private_vault"].includes(row.document_type));
  const references = useMemo(() => rows.filter(row => !["drive_library", "drive_private_vault"].includes(row.document_type) && row.title.toLowerCase().includes(query.trim().toLowerCase())), [rows, query]);
  return <main className="shell">
    <header><p className="eyebrow">KAIKOA OS · DOCUMENTS</p><h1>Documents.</h1><p className="muted">Your Drive locations and reviewed file references, connected to your records.</p></header>
    {stage === "loading" && <p role="status">Loading private documents…</p>}
    {stage === "signed-out" && <p role="status">Sign in to view your document references.</p>}
    {stage === "error" && <section className="panel" role="alert"><p>Unable to load your documents. Reload to retry.</p></section>}
    {stage === "ready" && <>
      <section className="panel"><h2>Google Drive locations</h2>
        <p className="muted">Folder links are connected. Automatic Drive reading is awaiting separate Google authorization.</p>
        <div className="assetGrid">{locations.map(row => {
          const href = safeDriveLink(row.source_url);
          return <article className="asset" key={row.id}><span className="eyebrow">{referenceKindLabels[row.document_type]}</span><strong>{row.title}</strong><small>Folder reference · files remain in Google Drive</small>{href ? <a href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open folder in Drive ↗</a> : <small>Link needs review</small>}</article>;
        })}</div>
        {locations.length === 0 && <p>No Drive locations recorded yet.</p>}
      </section>
      <section className="panel"><div className="sectionHead"><h2>Document references</h2><Link href="/private-memory/documents/new">Add document link →</Link></div>
        <div className="inventoryControls"><div><label htmlFor="document-search">Search documents</label><input id="document-search" type="search" value={query} onChange={event => setQuery(event.target.value)} maxLength={120} placeholder="Document title" /></div></div>
        <p className="muted">References preserve the source. Their contents and dates still need review.</p>
        {references.length === 0 && <p>No document references match.</p>}
        <div className="assetGrid">{references.map(row => {
          const href = safeDriveLink(row.source_url);
          const related = links.filter(link => link.document_id === row.id).map(link => entities.find(entity => entity.id === link.entity_id)).filter((value): value is EntityRow => !!value);
          return <article className="asset" key={row.id}><strong>{row.title}</strong><span className="status">{row.status === "NEEDS_REVIEW" ? "Needs review" : "Reference only"}</span>
            <small>File contents have not been imported</small>
            {typeof row.source_note === "string" && <small>Source: {row.source_note}</small>}
            <small>{row.recorded_by === "agent" ? "Connected by assistant with your authorization" : "Owner-entered reference"}</small>
            {related.map(entity => <Link key={entity.id} href={`/private-memory/assets/${encodeURIComponent(entity.slug)}`}>Linked record: {entity.name} →</Link>)}
            {href ? <a href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open file in Drive ↗</a> : <small>Link needs review</small>}
          </article>;
        })}</div>
      </section>
      <section className="panel"><details><summary>Recent reference history</summary>
        {history.length === 0 ? <p>No reference changes recorded.</p> : history.map(item => <div className="item" key={item.id}><strong>{rows.find(row => row.id === item.document_id)?.title ?? "Document reference"}</strong><span className="status">{item.field_name === "entity_link_created" ? "Record linked" : "Reference added"}</span><small>{item.actor_kind === "agent" ? "Assistant · founder-authorized connection" : "Owner"} · {new Date(item.changed_at).toLocaleString()} ({Intl.DateTimeFormat().resolvedOptions().timeZone})</small></div>)}
      </details></section>
      <p className="muted">Start with non-sensitive documents. Sensitive document imports remain pending the private backup and recovery checks.</p>
    </>}
  </main>;
}
