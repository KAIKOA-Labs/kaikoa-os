"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { safeDriveLink } from "@/lib/drive-reference";
type Row = { id: string; title: string; status: string; source_url: string | null };
export default function LinkedDocumentReferences({ entityId }: { entityId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [state, setState] = useState("loading");
  useEffect(() => {
    let active = true;
    setRows([]); setState("loading");
    (async () => {
      const db = getBrowserSupabase();
      if (!db) throw new Error("Unavailable");
      const { data: identity, error: authError } = await db.auth.getUser();
      if (authError || !identity.user) throw new Error("Unavailable");
      const { data: links, error: linkError } = await db.from("document_links").select("document_id").eq("entity_id", entityId);
      if (!active) return;
      if (linkError) throw new Error("Unavailable");
      const ids = [...new Set((links ?? []).map(link => link.document_id))];
      if (ids.length) {
        const { data, error } = await db.from("documents").select("id,title,status,source_url").in("id", ids).neq("status", "ARCHIVED").order("title");
        if (!active) return;
        if (error) throw new Error("Unavailable");
        setRows(data ?? []);
      }
      setState("ready");
    })().catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, [entityId]);
  return <section className="panel"><div className="sectionHead"><h2>Linked documents</h2><Link href="/private-memory/documents">Documents →</Link></div>
    {state === "loading" && <p role="status">Loading document references…</p>}
    {state === "error" && <p role="status">Unable to load linked documents. Reload to retry.</p>}
    {state === "ready" && (rows.length ? rows.map(row => {
      const url = safeDriveLink(row.source_url);
      return <div className="item" key={row.id}><strong>{row.title}</strong><span className="status">{row.status === "NEEDS_REVIEW" ? "Needs review" : "Reference only"}</span><small>{url ? <a href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open file in Drive ↗</a> : "Link needs review"}</small></div>;
    }) : <p className="muted">No document references linked yet.</p>)}
  </section>;
}
