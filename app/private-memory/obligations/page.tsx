"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import ObligationDeadline from "@/app/obligation-deadline";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { obligationFilters, obligationStatusLabel, type ObligationFilter } from "@/lib/obligation-workflow";
import { obligationSchedule, obligationWorkspaceRows, unlinkedFilter, type ObligationSummary, type LinkedRecord } from "@/lib/obligations-view";

export default function ObligationsPage() {
  const [stage, setStage] = useState<"loading" | "ready" | "error" | "signed-out">("loading");
  const [records, setRecords] = useState<ObligationSummary[]>([]);
  const [linked, setLinked] = useState<LinkedRecord[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ObligationFilter>(null);
  const [related, setRelated] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let active = true;
    (async () => {
      const db = getBrowserSupabase();
      if (!db) { setStage("error"); return; }
      const { data: identity, error: authError } = await db.auth.getUser();
      if (!active) return;
      if (authError || !identity.user) { setStage("signed-out"); return; }
      const [obligations, entities] = await Promise.all([
        db.from("obligations").select("id,title,status,related_entity_id,requires_owner_attention,due_at,scheduled_at,next_action,workflow_note").neq("status", "ARCHIVED"),
        db.from("entities").select("id,slug,name,status").order("name"),
      ]);
      if (!active) return;
      if (obligations.error || entities.error) { setStage("error"); return; }
      setRecords(obligations.data ?? []); setLinked(entities.data ?? []); setNow(Date.now()); setStage("ready");
    })().catch(() => { if (active) setStage("error"); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = window.setInterval(tick, 60000);
    window.addEventListener("focus", tick);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", tick); };
  }, []);
  const names = new Map(linked.map(record => [record.id, record]));
  const relatedIds = new Set(records.map(record => record.related_entity_id));
  const visible = obligationWorkspaceRows(records, linked, query, filter, related, now);
  const reset = () => { setQuery(""); setFilter(null); setRelated(""); };
  return <main className="shell">
    <header><p className="eyebrow">KAIKOA OS · OBLIGATIONS</p><h1>Obligations.</h1><p className="muted">Find what needs attention and the next action across your recorded life.</p>
      {stage === "ready" && <Link className="back" href="/private-memory/obligations/new">Add obligation →</Link>}</header>
    {stage === "loading" && <p role="status">Loading obligations…</p>}
    {stage === "signed-out" && <section className="panel"><p>Sign in to view obligations.</p><Link href="/auth/sign-in">Sign in →</Link></section>}
    {stage === "error" && <section className="panel" role="alert"><h2>Unable to load obligations</h2><p>Check your connection and reload. No changes have been made.</p></section>}
    {stage === "ready" && <section className="panel">
      <div className="obligationControls">
        <div><label htmlFor="obligation-search">Search obligations</label><input id="obligation-search" type="search" maxLength={160} placeholder="Title, next action, note or linked record" value={query} onChange={event => setQuery(event.target.value)} /></div>
        <div><label htmlFor="obligation-view">View</label><select id="obligation-view" value={filter ?? ""} onChange={event => setFilter((event.target.value || null) as ObligationFilter)}><option value="">All active</option>{obligationFilters.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></div>
        <div><label htmlFor="obligation-record">Related record</label><select id="obligation-record" value={related} onChange={event => setRelated(event.target.value)}><option value="">All records</option>{linked.filter(record => relatedIds.has(record.id)).map(record => <option key={record.id} value={record.id}>{record.name}{record.status === "ARCHIVED" ? " (archived record)" : ""}</option>)}<option value={unlinkedFilter}>General / unavailable record</option></select></div>
      </div>
      <div className="sectionHead"><p className="muted" role="status">Showing {visible.length} of {records.length} non-archived obligations</p>{(query || filter || related) && <button type="button" onClick={reset}>Clear filters</button>}</div>
      <p className="muted">Overdue, due within 14 days, then Requires You and Needs Review. Dates display in your browser timezone. Scheduled dates remain separate from deadlines.</p>
      {visible.length === 0 ? <p className="muted">{records.length === 0 ? "No obligations recorded. Add one when you have a confirmed responsibility." : "No obligations match this view. Clear filters or choose another view."}</p> : visible.map(record => {
        const entity = record.related_entity_id ? names.get(record.related_entity_id) : undefined;
        const schedule = obligationSchedule(record.scheduled_at);
        return <article className="item obligationWorkspaceItem" key={record.id}>
          <div><Link href={"/private-memory/obligations/edit?id=" + encodeURIComponent(record.id)}><strong>{record.title} →</strong></Link>
            <p className="muted">{obligationStatusLabel(record.status, record.requires_owner_attention)}</p>
            <p>{entity ? <Link href={"/private-memory/assets/" + encodeURIComponent(entity.slug)}>{entity.name}{entity.status === "ARCHIVED" ? " (archived record)" : ""}</Link> : record.related_entity_id ? "Related record unavailable" : "General responsibility"}</p></div>
          <ObligationDeadline record={record} now={now} />
          {record.status !== "COMPLETED" && <small><Link href={"/private-memory/obligations/deadline?id=" + encodeURIComponent(record.id)}>Manage deadline →</Link></small>}
          <small style={{ whiteSpace: "pre-wrap" }}>Next action: {record.next_action || "Not recorded"}</small>
          {record.workflow_note && <small style={{ whiteSpace: "pre-wrap" }}>Context: {record.workflow_note}</small>}
          {(record.scheduled_at || record.status === "SCHEDULED") && <small>{schedule.dateTime ? <time dateTime={schedule.dateTime}>{schedule.label}</time> : schedule.label}</small>}
        </article>;
      })}
    </section>}
  </main>;
}
