"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
type Obligation = { id: string; title: string; related_entity_id: string | null; status: string; updated_at: string };
type RelatedRecord = { id: string; name: string; status: string };
type SavedDetails = Pick<Obligation, "id" | "title" | "related_entity_id" | "updated_at"> & { changed: boolean };
export default function EditDetails() {
  const [items, setItems] = useState<Obligation[]>([]);
  const [records, setRecords] = useState<RelatedRecord[]>([]);
  const [selected, setSelected] = useState("");
  const [title, setTitle] = useState("");
  const [related, setRelated] = useState("");
  const [context, setContext] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Checking access…");
  const saving = useRef(false);
  const mounted = useRef(false);
  const item = items.find(record => record.id === selected);
  const currentParent = records.find(record => record.id === item?.related_entity_id);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    (async () => {
      const db = getBrowserSupabase();
      if (!db) { setMessage("Authentication unavailable."); return; }
      const { data: user, error: authError } = await db.auth.getUser();
      if (!active) return;
      if (authError || !user.user) { setMessage("Sign in required."); return; }
      const [obligations, entities] = await Promise.all([
        db.from("obligations").select("id,title,related_entity_id,status,updated_at").neq("status", "ARCHIVED").neq("status", "COMPLETED").order("title"),
        db.from("entities").select("id,name,status").order("name"),
      ]);
      if (!active) return;
      if (obligations.error || entities.error) { setMessage("Unable to load records. Reload to try again."); return; }
      const loaded = (obligations.data ?? []) as Obligation[];
      const requested = new URLSearchParams(window.location.search).get("id");
      const initial = requested ? loaded.find(record => record.id === requested) : loaded[0];
      setItems(loaded); setRecords(entities.data ?? []); setReady(true);
      if (initial) { setSelected(initial.id); setTitle(initial.title); setRelated(initial.related_entity_id ?? ""); setMessage(""); }
      else setMessage(requested ? "This obligation is unavailable, completed or archived. Select an active record." : "No active obligations found.");
    })().catch(() => { if (active) setMessage("Unable to check access. Reload to try again."); });
    return () => { active = false; mounted.current = false; };
  }, []);
  function selectRecord(id: string) {
    const record = items.find(candidate => candidate.id === id);
    setSelected(id); setTitle(record?.title ?? ""); setRelated(record?.related_entity_id ?? "");
    setContext(""); setConfirmed(false); setMessage("");
  }
  const changed = !!item && (title.trim() !== item.title || (related || null) !== item.related_entity_id);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const db = getBrowserSupabase();
    if (!db || !item || saving.current || !changed || !confirmed || title.trim().length < 4 || context.trim().length < 4) return;
    saving.current = true; setBusy(true); setMessage("Saving…");
    try {
      const { data, error } = await db.rpc("update_obligation_details", {
        p_obligation_id: item.id, p_title: title, p_related_entity_id: related || null,
        p_context: context, p_confirm_change: confirmed, p_expected_updated_at: item.updated_at,
      });
      if (!mounted.current) return;
      if (error) {
        setMessage(error.code === "40001" ? "This record changed. Reload before editing." : error.code === "23505" ? "This title already exists for the proposed related record or general responsibilities, including completed/archived entries. Choose a distinct title or check existing records." : error.code === "P0002" ? "The obligation or proposed related record is unavailable. Reload before editing." : "Save failed. No change confirmed. Check access and the required fields.");
        return;
      }
      const saved = data as SavedDetails;
      if (!saved || saved.id !== item.id || typeof saved.title !== "string" || typeof saved.updated_at !== "string" || typeof saved.changed !== "boolean" || (saved.related_entity_id !== null && typeof saved.related_entity_id !== "string")) throw new Error("Unconfirmed response");
      setItems(previous => previous.map(record => record.id === saved.id ? { ...record, ...saved } : record));
      setTitle(saved.title); setRelated(saved.related_entity_id ?? ""); setContext(""); setConfirmed(false);
      setMessage(saved.changed ? "Title and related record saved. Changes and reason recorded in Change History." : "No change needed.");
    } catch { if (mounted.current) setMessage("The save could not be confirmed. Reload to check the latest record before retrying."); }
    finally { saving.current = false; if (mounted.current) setBusy(false); }
  }
  const parentName = (id: string) => records.find(record => record.id === id)?.name ?? "Related record unavailable";
  return <main className="shell"><header><p className="eyebrow">KAIKOA OS · OBLIGATIONS</p><h1>Edit title and related record.</h1><p className="muted">Correct a title or associate a responsibility with an existing record.</p></header>
    <section className="panel workflowForm" aria-busy={busy}>
      {ready && <><label htmlFor="details-obligation">Active obligation</label><select id="details-obligation" value={selected} disabled={busy} onChange={event => selectRecord(event.target.value)}>
        <option value="">Select an obligation…</option>{items.map(record => <option key={record.id} value={record.id}>{record.title}</option>)}
      </select></>}
      {item && <form onSubmit={event => void save(event)}>
        <p className="muted">Recorded: {item.title} · {item.related_entity_id ? parentName(item.related_entity_id) : "General responsibility"}</p>
        <label htmlFor="details-title">Title</label><input id="details-title" required minLength={4} maxLength={160} value={title} disabled={busy} onChange={event => { setTitle(event.target.value); setConfirmed(false); }} />
        <label htmlFor="details-related">Related record (optional)</label><select id="details-related" value={related} disabled={busy} onChange={event => { setRelated(event.target.value); setConfirmed(false); }}>
          <option value="">General responsibility — no linked record</option>
          {item.related_entity_id && (!currentParent || currentParent.status === "ARCHIVED") && <option value={item.related_entity_id} disabled>{currentParent ? `${currentParent.name} (archived · current link)` : "Current related record unavailable"}</option>}
          {records.filter(record => record.status !== "ARCHIVED").map(record => <option key={record.id} value={record.id}>{record.name}</option>)}
        </select>
        <p className="muted">Proposed: {title.trim() || "Title required"} · {related ? parentName(related) : "General responsibility"}</p>
        <label htmlFor="details-context">Reason for this correction (required)</label><textarea id="details-context" required minLength={4} maxLength={1000} rows={3} value={context} disabled={busy} onChange={event => { setContext(event.target.value); setConfirmed(false); }} />
        <label className="confirmCompletion"><input type="checkbox" checked={confirmed} disabled={busy || !changed} onChange={event => setConfirmed(event.target.checked)} />I confirm the proposed title and related record.</label>
        <button type="submit" disabled={busy || !changed || !confirmed || title.trim().length < 4 || context.trim().length < 4}>{busy ? "Saving…" : "Save title and related record"}</button>
        <p><Link href={`/private-memory/obligations/edit?id=${encodeURIComponent(item.id)}`}>Update workflow →</Link> · <Link href={`/private-memory/obligations/deadline?id=${encodeURIComponent(item.id)}`}>Manage deadline →</Link></p>
      </form>}
      {message && <p role="status" className="muted">{message}</p>}
      <p><Link href="/private-memory/obligations">Back to Obligations →</Link> · <Link href="/private-memory/history">Change History →</Link></p>
    </section></main>;
}
