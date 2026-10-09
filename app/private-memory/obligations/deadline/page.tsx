"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { obligationDeadline } from "@/lib/obligation-workflow";
import { deadlineInput, deadlineValue } from "@/lib/obligation-deadline-edit";
type Obligation = { id: string; title: string; status: string; requires_owner_attention: boolean; due_at: string | null; updated_at: string };
type SavedDeadline = { id: string; due_at: string | null; updated_at: string; changed: boolean };
export default function EditDeadline() {
  const [items, setItems] = useState<Obligation[]>([]);
  const [selected, setSelected] = useState("");
  const [input, setInput] = useState("");
  const [context, setContext] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Checking access…");
  const [now, setNow] = useState(0);
  const saving = useRef(false);
  const mounted = useRef(false);
  const item = items.find(record => record.id === selected);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    setNow(Date.now());
    (async () => {
      const db = getBrowserSupabase();
      if (!db) { setMessage("Authentication unavailable."); return; }
      const { data: user, error: authError } = await db.auth.getUser();
      if (!active) return;
      if (authError || !user.user) { setMessage("Authentication required. Please sign in."); return; }
      const { data, error } = await db.from("obligations")
        .select("id,title,status,requires_owner_attention,due_at,updated_at")
        .neq("status", "ARCHIVED").neq("status", "COMPLETED").order("title");
      if (!active) return;
      if (error) { setMessage("Unable to load obligations. Please retry."); return; }
      const records = (data ?? []) as Obligation[];
      const requested = new URLSearchParams(window.location.search).get("id");
      const initial = requested ? records.find(record => record.id === requested) : records[0];
      setItems(records); setReady(true);
      if (initial) { setSelected(initial.id); setInput(deadlineInput(initial.due_at)); setMessage(""); }
      else setMessage(requested ? "This obligation is unavailable, completed or archived. Select an active record." : "No active obligations found.");
    })().catch(() => { if (active) setMessage("Unable to check access. Please retry."); });
    return () => { active = false; mounted.current = false; };
  }, []);
  function selectRecord(id: string) {
    const record = items.find(candidate => candidate.id === id);
    setSelected(id); setInput(deadlineInput(record?.due_at ?? null));
    setContext(""); setConfirmed(false); setMessage("");
  }
  let proposed: string | null = null;
  let invalid = "";
  try { proposed = deadlineValue(input, item?.due_at ?? null); }
  catch (error) { invalid = error instanceof Error ? error.message : "Check the date and time."; }
  const changed = !!item && !invalid && proposed !== item.due_at;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const db = getBrowserSupabase();
    if (!db || !item || saving.current || !changed || !confirmed || context.trim().length < 4) return;
    saving.current = true; setBusy(true); setMessage("Saving…");
    try {
      const { data, error } = await db.rpc("update_obligation_deadline", {
        p_obligation_id: item.id, p_due_at: proposed, p_context: context,
        p_confirm_change: confirmed, p_expected_updated_at: item.updated_at,
      });
      if (!mounted.current) return;
      if (error) {
        setMessage(error.code === "40001" ? "This record changed. Reload before editing its deadline." : "Save failed. No change confirmed. Check access and the required fields.");
        return;
      }
      const saved = data as SavedDeadline;
      if (!saved || saved.id !== item.id || typeof saved.updated_at !== "string" || typeof saved.changed !== "boolean" || (saved.due_at !== null && typeof saved.due_at !== "string")) throw new Error("Unconfirmed response");
      setItems(previous => previous.map(record => record.id === saved.id ? { ...record, due_at: saved.due_at, updated_at: saved.updated_at } : record));
      setInput(deadlineInput(saved.due_at)); setContext(""); setConfirmed(false); setNow(Date.now());
      setMessage(saved.changed ? "Deadline saved. Date and reason recorded in Change History." : "No change needed.");
    } catch { if (mounted.current) setMessage("The save could not be confirmed. Reload to check the latest record before retrying."); }
    finally { saving.current = false; if (mounted.current) setBusy(false); }
  }
  const current = item ? obligationDeadline(item, now) : null;
  const preview = item && !invalid ? obligationDeadline({ ...item, due_at: proposed }, now) : null;
  return <main className="shell"><header><p className="eyebrow">KAIKOA OS · OBLIGATIONS</p><h1>Manage deadline.</h1><p className="muted">Record a confirmed deadline or clear an outdated one.</p></header>
    <section className="panel workflowForm" aria-busy={busy}>
      {ready && <><label htmlFor="deadline-obligation">Active obligation</label><select id="deadline-obligation" value={selected} disabled={busy} onChange={event => selectRecord(event.target.value)}>
        <option value="">Select an obligation…</option>{items.map(record => <option key={record.id} value={record.id}>{record.title}</option>)}
      </select></>}
      {item && <form onSubmit={event => void save(event)}>
        <p className="muted">Recorded: {current?.dateTime ? <time dateTime={current.dateTime}>{current.label}</time> : current?.label}</p>
        <label htmlFor="deadline-time">Deadline date and time (optional)</label>
        <input id="deadline-time" type="datetime-local" step="1" min="0001-01-01T00:00:00" max="9999-12-31T23:59:59" value={input} disabled={busy} onChange={event => { setInput(event.target.value); setConfirmed(false); }} aria-describedby="deadline-time-help" />
        <p id="deadline-time-help" className="muted">Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}. A deadline is when this obligation is due; its scheduled time is managed separately. Leave blank for no recorded deadline.</p>
        <button type="button" disabled={busy || (!input && !item.due_at)} onClick={() => { setInput(""); setConfirmed(false); }}>Clear deadline</button>
        {invalid ? <p role="alert">{invalid}</p> : <p className="muted">Proposed: {preview?.dateTime ? <time dateTime={preview.dateTime}>{preview.label}</time> : preview?.label}</p>}
        <label htmlFor="deadline-context">Reason or source for this change (required)</label>
        <textarea id="deadline-context" required minLength={4} maxLength={1000} rows={3} value={context} disabled={busy} onChange={event => { setContext(event.target.value); setConfirmed(false); }} />
        <label className="confirmCompletion"><input type="checkbox" checked={confirmed} disabled={busy || !changed} onChange={event => setConfirmed(event.target.checked)} />{proposed === null ? "I confirm removal of the recorded deadline." : "I confirm the proposed deadline and timezone."}</label>
        <p className="muted">Nothing is saved until you click Save. Completed and archived obligations retain their historical deadlines.</p>
        <button type="submit" disabled={busy || !changed || !confirmed || context.trim().length < 4}>{busy ? "Saving…" : "Save deadline"}</button>
        <p><Link href={`/private-memory/obligations/edit?id=${encodeURIComponent(item.id)}`}>Update workflow →</Link></p>
      </form>}
      {message && <p role="status" className="muted">{message}</p>}
      <p><Link href="/private-memory/obligations">Back to Obligations →</Link> · <Link href="/private-memory/history">Change History →</Link></p>
    </section></main>;
}
