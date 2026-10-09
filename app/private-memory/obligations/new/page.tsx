"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
type RelatedRecord = { id: string; name: string; status: string };
export default function NewObligation() {
  const [records, setRecords] = useState<RelatedRecord[]>([]);
  const [entityId, setEntityId] = useState("");
  const [title, setTitle] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [requiresOwner, setRequiresOwner] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [message, setMessage] = useState("Checking access…");
  const saving = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    (async () => {
      const db = getBrowserSupabase();
      if (!db) { setMessage("Authentication unavailable."); return; }
      const { data: user, error: authError } = await db.auth.getUser();
      if (!active) return;
      if (authError || !user.user) { setMessage("Sign in required."); return; }
      const { data, error } = await db.from("entities").select("id,name,status").neq("status", "ARCHIVED").order("name");
      if (!active) return;
      if (error) { setMessage("Unable to load related records. Reload to try again."); return; }
      setRecords(data ?? []); setReady(true); setMessage("");
    })().catch(() => { if (active) setMessage("Unable to check access. Reload to try again."); });
    return () => { active = false; mounted.current = false; };
  }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || saving.current || createdId || title.trim().length < 4 || nextAction.trim().length < 4) return;
    const db = getBrowserSupabase();
    if (!db) { setMessage("Authentication unavailable."); return; }
    saving.current = true; setBusy(true); setMessage("Saving…");
    try {
      const { data, error } = await db.rpc("create_inventory_obligation", {
        p_entity_id: entityId || null, p_title: title, p_next_action: nextAction,
        p_requires_owner_attention: requiresOwner,
      });
      if (!mounted.current) return;
      if (error) {
        setMessage(error.code === "23505" ? "An obligation with this title already exists for this record or general responsibilities. Check existing obligations, including completed or archived entries, before creating another." : error.code === "P0002" ? "This related record is unavailable or archived. Reload and choose an active record." : "Not saved. Check access and the required fields.");
        return;
      }
      if (typeof data !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data)) throw new Error("Unconfirmed response");
      setCreatedId(data); setMessage(`Obligation created as Unverified in ${requiresOwner ? "Requires You" : "Needs Review"}. No deadline assigned. Creation recorded in Change History.`);
    } catch { if (mounted.current) setMessage("Creation could not be confirmed. Check the Obligations workspace before retrying."); }
    finally { saving.current = false; if (mounted.current) setBusy(false); }
  }
  function reset() {
    setCreatedId(null); setEntityId(""); setTitle(""); setNextAction(""); setRequiresOwner(true); setMessage("");
  }
  return <main className="shell"><header><p className="eyebrow">KAIKOA OS · OBLIGATIONS</p><h1>Add an obligation.</h1><p className="muted">Capture a responsibility and its next action.</p></header>
    <section className="panel workflowForm" aria-busy={busy}>
      {ready && <form onSubmit={event => void save(event)}>
        <label htmlFor="related-record">Related record (optional)</label>
        <select id="related-record" value={entityId} disabled={busy || !!createdId} onChange={event => setEntityId(event.target.value)} aria-describedby="related-record-help">
          <option value="">General responsibility — no linked record</option>{records.map(record => <option key={record.id} value={record.id}>{record.name}</option>)}
        </select>
        <p id="related-record-help" className="muted">Link it to an existing record when relevant, or leave it as a general responsibility.</p>
        <label htmlFor="obligation-title">What needs attention?</label>
        <input id="obligation-title" required minLength={4} maxLength={160} value={title} disabled={busy || !!createdId} onChange={event => setTitle(event.target.value)} />
        <label htmlFor="next-action">Next action</label>
        <textarea id="next-action" required minLength={4} maxLength={1000} rows={5} value={nextAction} disabled={busy || !!createdId} onChange={event => setNextAction(event.target.value)} />
        <label className="confirmCompletion"><input type="checkbox" checked={requiresOwner} disabled={busy || !!createdId} onChange={event => setRequiresOwner(event.target.checked)} />Requires your attention</label>
        <p className="muted">{requiresOwner ? "Starts in Requires You." : "Starts in Needs Review until you choose its workflow."} New entries are Unverified. You can add a confirmed deadline or update the workflow after creation. Use only the context needed for this responsibility.</p>
        <button type="submit" disabled={busy || !!createdId || title.trim().length < 4 || nextAction.trim().length < 4}>{busy ? "Saving…" : "Create obligation"}</button>
      </form>}
      {message && <p role="status" className="muted">{message}</p>}
      {createdId && <><p><Link href={`/private-memory/obligations/edit?id=${encodeURIComponent(createdId)}`}>Update workflow →</Link> · <Link href={`/private-memory/obligations/deadline?id=${encodeURIComponent(createdId)}`}>Manage deadline →</Link></p><button type="button" onClick={reset}>Add another obligation</button></>}
      <p><Link href="/private-memory/obligations">Back to Obligations →</Link> · <Link href="/private-memory/history">Change History →</Link></p>
    </section></main>;
}
