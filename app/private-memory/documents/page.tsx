"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { referenceKindLabels, safeDriveLink } from "@/lib/drive-reference";
import { filterEvidenceGroups, groupEvidence } from "@/lib/document-evidence";
import DocumentEvidenceCard from "@/app/document-evidence-card";

type DocumentRow = { id: string; title: string; document_type: string; status: string; source_url: string | null; source_note: unknown; recorded_by: unknown; evidence_summary: unknown; lease_record: unknown };
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
        db.from("documents").select("id,title,document_type,status,source_url,source_note:metadata->source_note,recorded_by:metadata->recorded_by,evidence_summary:metadata->evidence_summary,lease_record:metadata->lease_record").neq("status", "ARCHIVED").order("title"),
        db.from("document_links").select("document_id,entity_id").not("entity_id", "is", null),
        db.from("entities").select("id,slug,name").order("name"),
        db.from("document_change_history").select("id,document_id,actor_kind,field_name,changed_at").order("changed_at", { ascending: false }).limit(20),
      ]);
      if (!active) return;
      if (results.some(result => result.error)) throw new Error("Unavailable");
      const fileRows = (results[0].data as DocumentRow[] ?? []).filter(row => !["vehicle_profile","medical_year_folder"].includes(row.document_type));
      setRows(fileRows);
      setLinks(results[1].data as LinkRow[] ?? []);
      setEntities(results[2].data as EntityRow[] ?? []);
      const visibleIds = new Set(fileRows.map(row => row.id));
      setHistory((results[3].data as AuditRow[] ?? []).filter(row => visibleIds.has(row.document_id)));
      setStage("ready");
    })().catch(() => { if (active) setStage("error"); });
    return () => { active = false; };
  }, []);
  const locations = rows.filter(row => ["drive_library", "drive_private_vault", "medical_folder"].includes(row.document_type));
  const references = useMemo(() => filterEvidenceGroups(groupEvidence(rows.filter(row => !["drive_library", "drive_private_vault", "medical_folder"].includes(row.document_type))), query), [rows, query]);
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
        <div className="inventoryControls"><div><label htmlFor="document-search">Search documents</label><input id="document-search" type="search" value={query} onChange={event => setQuery(event.target.value)} maxLength={120} placeholder="Title, policy, date or source fact" /></div></div>
        <p className="muted">Digital originals stay in Drive. Source summaries preserve the document statements and your corrections.</p>
        {references.length === 0 && <p>No document references match.</p>}
        <div className="assetGrid">{references.map(group => {
          const ids = new Set([group.primary.id, ...group.supporting.map(row => row.id)]);
          const relatedIds = new Set(links.filter(link => ids.has(link.document_id)).map(link => link.entity_id));
          const related = entities.filter(entity => relatedIds.has(entity.id));
          return <DocumentEvidenceCard key={group.primary.id} group={group} related={related.map(entity => <Link key={entity.id} href={`/private-memory/assets/${encodeURIComponent(entity.slug)}`}>Linked record: {entity.name} →</Link>)} />;
        })}</div>
      </section>
      <section className="panel"><details><summary>Recent reference history</summary>
        {history.length === 0 ? <p>No reference changes recorded.</p> : history.map(item => <div className="item" key={item.id}><strong>{rows.find(row => row.id === item.document_id)?.title ?? "Document reference"}</strong><span className="status">{item.field_name === "entity_link_created" ? "Record linked" : "Reference added"}</span><small>{item.actor_kind === "agent" ? "Assistant · founder-authorized connection" : "Owner"} · {new Date(item.changed_at).toLocaleString()} ({Intl.DateTimeFormat().resolvedOptions().timeZone})</small></div>)}
      </details></section>
      <p className="muted">Source summaries do not create payments, reminders or obligations automatically.</p>
    </>}
  </main>;
}
