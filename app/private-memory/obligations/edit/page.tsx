"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { obligationStatusLabel, toLocalDateTime, workflowOptions } from "@/lib/obligation-workflow";
type Obligation = {
  id: string; title: string; status: string; next_action: string | null;
  workflow_note: string | null; scheduled_at: string | null; completed_at: string | null;
  requires_owner_attention: boolean; updated_at: string;
};
type Draft = { status: string; action: string; note: string; schedule: string; confirm: boolean };
function draftFrom(item: Obligation): Draft {
  return { status: item.status, action: item.next_action ?? "", note: item.workflow_note ?? "", schedule: toLocalDateTime(item.scheduled_at), confirm: false };
}
export default function EditObligation() {
  const [items, setItems] = useState<Obligation[]>([]);
  const [selected, setSelected] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState("Checking access…");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const saving = useRef(false);
  const item = items.find(record => record.id === selected);
  useEffect(() => {
    let active = true;
    (async () => {
      const db = getBrowserSupabase();
      if (!db) { setMessage("Authentication unavailable."); return; }
      const { data: user, error: authError } = await db.auth.getUser();
      if (!active) return;
      if (authError || !user.user) { setMessage("Authentication required. Please sign in."); return; }
      const { data, error } = await db.from("obligations")
        .select("id,title,status,next_action,workflow_note,scheduled_at,completed_at,requires_owner_attention,updated_at")
        .neq("status", "ARCHIVED").order("title");
      if (!active) return;
      if (error) { setMessage("Unable to load obligations. Please retry."); return; }
      const records = (data ?? []) as Obligation[];
      const requested = new URLSearchParams(window.location.search).get("id");
      const initial = requested ? records.find(record => record.id === requested) : records[0];
      setItems(records); setReady(true);
      if (initial) { setSelected(initial.id); setDraft(draftFrom(initial)); setMessage(""); }
      else setMessage(requested ? "This obligation is unavailable or archived. Select an accessible record." : "No editable obligations found.");
    })().catch(() => { if (active) setMessage("Unable to check access. Please retry."); });
    return () => { active = false; };
  }, []);
  function selectRecord(id: string) {
    const record = items.find(candidate => candidate.id === id);
    setSelected(id); setDraft(record ? draftFrom(record) : null); setMessage("");
  }
  async function save() {
    const db = getBrowserSupabase();
    if (!db || !item || !draft || saving.current) return;
    saving.current = true; setBusy(true); setMessage("Saving…");
    try {
      const schedule = draft.status === "SCHEDULED"
        ? draft.schedule === toLocalDateTime(item.scheduled_at) ? item.scheduled_at : new Date(draft.schedule).toISOString()
        : null;
      const { data, error } = await db.rpc("update_obligation_workflow", {
        p_obligation_id: item.id, p_status: draft.status, p_next_action: draft.action,
        p_workflow_note: draft.note, p_scheduled_at: schedule,
        p_confirm_completion: draft.confirm, p_expected_updated_at: item.updated_at,
      });
      if (error) {
        setMessage(error.code === "40001" ? "This record changed since you opened it. Reload the page before editing." : "Save failed. No change confirmed. Check access and the required fields.");
        return;
      }
      const saved = data as Obligation;
      setItems(previous => previous.map(record => record.id === saved.id ? saved : record));
      setDraft(draftFrom(saved)); setMessage("Saved. Changes recorded in Change History.");
    } catch { setMessage("The save could not be confirmed. Reload to check the latest record before retrying."); }
    finally { saving.current = false; setBusy(false); }
  }
  const completionTransition = draft?.status === "COMPLETED" && item?.status !== "COMPLETED";
  const noteRequired = !!draft && ["WAITING_ON", "SCHEDULED", "COMPLETED", "DEFERRED"].includes(draft.status);
  const valid = !!draft && !!item && draft.action.trim().length > 0 &&
    (!noteRequired || draft.note.trim().length >= 4) &&
    (draft.status !== "SCHEDULED" || !!draft.schedule) && (!completionTransition || draft.confirm);
  return <main className="shell"><header><p className="eyebrow">KAIKOA OS · OBLIGATIONS</p><h1>Update obligation.</h1><p className="muted">Current state, next action and context</p></header>
    <section className="panel workflowForm" aria-busy={busy}>
      {ready && <><label htmlFor="obligation">Obligation</label><select id="obligation" value={selected} disabled={busy} onChange={event => selectRecord(event.target.value)}>
        <option value="">Select an obligation…</option>{items.map(record => <option key={record.id} value={record.id}>{record.title}</option>)}
      </select></>}
      {item && draft && <>
        <p className="muted">Recorded state: {obligationStatusLabel(item.status, item.requires_owner_attention)}</p>
        <label htmlFor="obligation-status">Workflow state</label>
        <select id="obligation-status" value={draft.status} disabled={busy} onChange={event => setDraft({ ...draft, status: event.target.value, confirm: false })}>
          {!workflowOptions.some(option => option.value === draft.status) && <option value={draft.status}>{obligationStatusLabel(draft.status)} (existing)</option>}
          {workflowOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <label htmlFor="next-action">Next action</label><textarea id="next-action" maxLength={1000} rows={5} value={draft.action} disabled={busy} onChange={event => setDraft({ ...draft, action: event.target.value })} />
        <label htmlFor="workflow-note">{draft.status === "WAITING_ON" ? "Who or what are you waiting on?" : draft.status === "DEFERRED" ? "Reason for deferral / funding dependency" : draft.status === "COMPLETED" ? "Completion confirmation / evidence" : "Context / supporting evidence"}{noteRequired ? " (required)" : " (optional)"}</label>
        <textarea id="workflow-note" maxLength={1000} rows={3} value={draft.note} disabled={busy} onChange={event => setDraft({ ...draft, note: event.target.value })} />
        {draft.status === "SCHEDULED" && <><label htmlFor="scheduled-at">Confirmed scheduled time (required)</label><input id="scheduled-at" type="datetime-local" value={draft.schedule} disabled={busy} onChange={event => setDraft({ ...draft, schedule: event.target.value })} /><p className="muted">Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}. This records a schedule separately from the obligation’s deadline.</p></>}
        {completionTransition && <label className="confirmCompletion"><input type="checkbox" checked={draft.confirm} disabled={busy} onChange={event => setDraft({ ...draft, confirm: event.target.checked })} />I confirm this obligation is completed.</label>}
        {item.completed_at && <p className="muted">Completion recorded: {new Date(item.completed_at).toLocaleString()}</p>}
        <p className="muted">Changes are saved when you click Save. Use confirmed facts; record only the context needed for this task.</p>
        <button type="button" disabled={busy || !valid} onClick={() => void save()}>{busy ? "Saving…" : "Save obligation"}</button>
      </>}
      {message && <p role="status" className="muted">{message}</p>}
      {item && item.status !== "COMPLETED" && <p><Link href={`/private-memory/obligations/deadline?id=${encodeURIComponent(item.id)}`}>Manage deadline →</Link></p>}
      <p><Link href="/private-memory/history">Change History →</Link></p>
    </section></main>;
}
