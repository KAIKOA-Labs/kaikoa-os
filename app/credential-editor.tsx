"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { credentialFromMetadata, credentialTypeLabels, type CredentialRecord, type CredentialState, type CredentialType } from "@/lib/credential-record";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const states: { value: CredentialState; label: string }[] = [
  { value: "needs_review", label: "Needs verification" }, { value: "owner_confirmed", label: "Owner confirmed" },
  { value: "in_progress", label: "In progress · not yet issued" }, { value: "unknown", label: "Unknown" },
];
type Loaded = { id: string; name: string; slug: string; record: CredentialRecord };

export default function CredentialEditor({ slug }: { slug?: string }) {
  const editing = Boolean(slug);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<CredentialType>("passport");
  const [issuer, setIssuer] = useState("");
  const [suffix, setSuffix] = useState("");
  const [expiry, setExpiry] = useState("");
  const [reminder, setReminder] = useState("");
  const [recordState, setRecordState] = useState<CredentialState>("needs_review");
  const [sourceNote, setSourceNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(editing ? "Loading credential…" : "");
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const saving = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    if (!editing || !slug) return () => { active = false; mounted.current = false; };
    (async () => {
      const db = getBrowserSupabase();
      if (!db) { setMessage("Authentication configuration unavailable."); return; }
      const { data: user, error: authError } = await db.auth.getUser();
      if (!active) return;
      if (authError || !user.user) { setMessage("Sign in required."); return; }
      const { data, error } = await db.from("entities").select("id,slug,name,status,subtype,credential_record:metadata->credential_record").eq("slug", slug).maybeSingle();
      if (!active) return;
      if (error || !data || data.status === "ARCHIVED" || !["credential", "passport"].includes(data.subtype ?? "")) { setMessage("Credential not found or access denied."); return; }
      const record = credentialFromMetadata(data.credential_record);
      if (!record) { setMessage("This credential needs source review before it can be edited. No values were changed."); return; }
      setLoaded({ id: data.id, slug: data.slug, name: data.name, record });
      setName(data.name); setType(record.credential_type); setIssuer(record.issuer ?? "");
      setSuffix(record.last_four ?? ""); setExpiry(record.expires_on ?? ""); setReminder(record.reminder_on ?? "");
      setRecordState(record.record_state); setSourceNote(record.source_note); setMessage("");
    })().catch(() => { if (active) setMessage("Unable to load this credential. Reload to try again."); });
    return () => { active = false; mounted.current = false; };
  }, [editing, slug]);

  function change<T>(setter: (value: T) => void, value: T) { setter(value); setConfirmed(false); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || busy || !confirmed || name.trim().length < 2 || sourceNote.trim().length < 4) return;
    const db = getBrowserSupabase();
    if (!db) { setMessage("Authentication unavailable."); return; }
    saving.current = true; setBusy(true); setMessage("Saving…");
    try {
      const args = { p_credential_type: type, p_issuer: issuer.trim() || null, p_last_four: suffix.trim() || null,
        p_expires_on: expiry || null, p_reminder_on: reminder || null, p_record_state: recordState,
        p_source_note: sourceNote.trim(), p_confirm: true };
      if (editing && loaded) {
        const { data, error } = await db.rpc("update_credential_record", { p_entity_id: loaded.id, p_expected_record: loaded.record, ...args });
        if (!mounted.current) return;
        if (error) { setMessage(error.code === "40001" ? "This record changed in another session. Reload before saving." : "Not saved. Check the masked suffix, dates and source note."); return; }
        if (!data || typeof data !== "object" || !(data as { credential_record?: unknown }).credential_record) throw new Error("Unconfirmed save");
        setMessage("Credential details updated. Change History records the edit.");
      } else {
        const { data, error } = await db.rpc("create_credential_record", { p_name: name.trim(), ...args });
        if (!mounted.current) return;
        if (error) { setMessage(error.code === "23505" ? "A record with that name already exists. Check IDs & Licenses before adding it again." : "Not saved. Check the masked suffix, dates and source note."); return; }
        if (typeof data !== "string" || !uuidPattern.test(data)) throw new Error("Unconfirmed save");
        const { data: entity, error: entityError } = await db.from("entities").select("slug").eq("id", data).maybeSingle();
        if (!mounted.current) return;
        if (entityError || !entity?.slug) throw new Error("Created but not fully confirmed");
        setSavedSlug(entity.slug); setMessage("Credential record created as Unverified. Full numbers and document images are not stored.");
      }
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error && error.message === "Created but not fully confirmed"
        ? "The record may have been created, but confirmation was incomplete. Check IDs & Licenses before retrying."
        : "Save could not be confirmed. Check IDs & Licenses before retrying.");
    } finally { saving.current = false; if (mounted.current) setBusy(false); }
  }

  const disabled = busy || (editing && !loaded) || Boolean(savedSlug);
  return <main className="shell"><header><p className="eyebrow">KAIKOA OS · IDS & LICENSES</p><h1>{editing ? "Update credential." : "Add ID or license."}</h1>
    <p className="muted">Store issuer, four digits, and source-backed expiry and reminder dates.</p></header>
    <section className="panel workflowForm" aria-busy={busy}>
      {(!editing || loaded) && <form onSubmit={event => void save(event)}>
        <label htmlFor="credential-name">Record name</label><input id="credential-name" required minLength={2} maxLength={120} value={name} disabled={disabled} onChange={event => change(setName,event.target.value)} />
        <label htmlFor="credential-type">Type</label><select id="credential-type" value={type} disabled={disabled} onChange={event => change(setType,event.target.value as CredentialType)}>{Object.entries(credentialTypeLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
        <label htmlFor="credential-issuer">Issuer or jurisdiction</label><input id="credential-issuer" maxLength={120} value={issuer} disabled={disabled} onChange={event => change(setIssuer,event.target.value)} />
        <label htmlFor="credential-last-four">Last four digits (optional)</label><input id="credential-last-four" inputMode="numeric" autoComplete="off" maxLength={4} pattern="[0-9]{4}" value={suffix} disabled={disabled} onChange={event => change(setSuffix,event.target.value.replace(/\D/g,""))} aria-describedby="credential-mask-help" />
        <p id="credential-mask-help" className="muted">Enter exactly four digits. Never enter a complete number, scan, photo or document link.</p>
        <label htmlFor="credential-expiry">Expiry date</label><input id="credential-expiry" type="date" value={expiry} disabled={disabled} onChange={event => { const value = event.target.value; change(setExpiry,value); if (!value) change(setReminder,""); }} />
        <label htmlFor="credential-reminder">Renewal reminder date</label><input id="credential-reminder" type="date" max={expiry || undefined} value={reminder} disabled={disabled || !expiry} onChange={event => change(setReminder,event.target.value)} />
        <p className="muted">Choose dates from a current source. Reminder dates are stored for review; this app does not send notifications.</p>
        <label htmlFor="credential-state">Record status</label><select id="credential-state" value={recordState} disabled={disabled} onChange={event => change(setRecordState,event.target.value as CredentialState)}>{states.map(state=><option key={state.value} value={state.value}>{state.label}</option>)}</select>
        <label htmlFor="credential-source">Source and verification note</label><textarea id="credential-source" required minLength={4} maxLength={1000} rows={4} value={sourceNote} disabled={disabled} onChange={event => change(setSourceNote,event.target.value)} />
        <p className="muted">Keep the source note free of full numbers. Old tracker values should remain marked Needs verification until checked against the current credential.</p>
        <label className="confirmCompletion"><input type="checkbox" checked={confirmed} disabled={disabled} onChange={event => setConfirmed(event.target.checked)} />I confirm this record contains only a four-digit suffix and dates supported by the noted source.</label>
        <button type="submit" disabled={disabled || !confirmed || name.trim().length < 2 || sourceNote.trim().length < 4}>{busy ? "Saving…" : editing ? "Save credential" : "Create credential"}</button>
      </form>}
      {message && <p role="status" className="muted">{message}</p>}
      {savedSlug && <p><Link href={`/private-memory/credentials/${encodeURIComponent(savedSlug)}/edit`}>Open this record →</Link> · <Link href="/private-memory/credentials">IDs & Licenses →</Link></p>}
      <p><Link href="/private-memory/credentials">Back to IDs & Licenses →</Link> · <Link href="/private-memory/history">Change History →</Link></p>
    </section>
  </main>;
}
