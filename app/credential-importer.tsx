"use client";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { credentialTypeLabels } from "@/lib/credential-record";
import { maxCredentialImportBytes, parseCredentialImport, runCredentialImport, type CredentialImportRow, type ExistingCredential, type ImportProgress } from "@/lib/credential-import";

const projection = "id,slug,subtype,status,credential_record:metadata->credential_record";
export default function CredentialImporter() {
  const [rows, setRows] = useState<CredentialImportRow[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const generation = useRef(0);
  const mounted = useRef(false);
  const saving = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; generation.current++; };
  }, []);

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    if (saving.current) return;
    const file = event.target.files?.[0];
    const request = ++generation.current;
    setRows([]); setConfirmed(false); setComplete(false); setMessage(""); setProgress(null); setLoadingFile(Boolean(file));
    if (!file) return;
    try {
      if (file.size > maxCredentialImportBytes) throw new Error("Use an inventory file smaller than 64 KB.");
      const text = await file.text();
      if (!mounted.current || request !== generation.current) return;
      setRows(parseCredentialImport(text));
    } catch (error) {
      if (mounted.current && request === generation.current) setMessage(error instanceof Error ? error.message : "Unable to read this file.");
    } finally { if (mounted.current && request === generation.current) setLoadingFile(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || !confirmed || !rows.length || loadingFile || complete) return;
    const db = getBrowserSupabase();
    if (!db) { setMessage("Sign-in is unavailable. Please try again later."); return; }
    saving.current = true; setBusy(true); setConfirmed(false); setMessage("Importing inventory…");
    setProgress({ added: 0, skipped: 0, total: rows.length });
    const request = generation.current;
    let sessionChanged = false;
    let userId: string | null = null;
    const { data: { subscription } } = db.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || userId !== null && session?.user.id !== userId) sessionChanged = true;
    });
    const checkSession = async () => {
      if (!mounted.current || request !== generation.current || sessionChanged) throw new Error("Import stopped because the session changed. Sign in and check IDs & Licenses before retrying.");
      const { data, error } = await db.auth.getUser();
      if (error || !data.user || userId !== null && data.user.id !== userId || !mounted.current || sessionChanged || request !== generation.current) {
        throw new Error("Import stopped because private access could not be verified. Check IDs & Licenses before retrying.");
      }
      userId = data.user.id;
    };
    try {
      const result = await runCredentialImport(rows, {
        checkSession,
        findBySlug: async slug => {
          const { data, error } = await db.from("entities").select(projection).eq("slug", slug).maybeSingle();
          if (error) throw new Error("Unable to check existing inventory. No further records were added.");
          return data as ExistingCredential | null;
        },
        create: async row => {
          const { data, error } = await db.rpc("create_credential_record", {
            p_name: row.name, p_credential_type: row.credential_type, p_issuer: row.issuer, p_last_four: row.last_four,
            p_expires_on: row.expires_on, p_reminder_on: row.reminder_on, p_record_state: "needs_review",
            p_source_note: row.source_note, p_confirm: true,
          });
          if (error || typeof data !== "string") throw new Error("Import stopped at a save that could not be confirmed. Check IDs & Licenses before retrying; earlier saves are retained.");
          return data;
        },
        readById: async id => {
          const { data, error } = await db.from("entities").select(projection).eq("id", id).maybeSingle();
          if (error) throw new Error("A record may be saved, but confirmation failed. Check IDs & Licenses before retrying.");
          return data as ExistingCredential | null;
        },
      }, value => { if (mounted.current && request === generation.current) setProgress(value); });
      if (mounted.current && request === generation.current) {
        setComplete(true); setMessage(`Inventory confirmed: ${result.added} added, ${result.skipped} already recorded. Open IDs & Licenses to view your cards.`);
      }
    } catch (error) {
      if (mounted.current && request === generation.current) setMessage(error instanceof Error ? error.message : "Import stopped. Check IDs & Licenses before retrying.");
    } finally { subscription.unsubscribe(); saving.current = false; if (mounted.current) setBusy(false); }
  }

  return <main className="shell"><header><p className="eyebrow">KAIKOA OS · IDS & LICENSES</p><h1>Import listed inventory.</h1>
    <p className="muted">Choose your prepared inventory file, review the list, then save it in one action.</p>
    <Link className="back" href="/private-memory/credentials">View IDs & Licenses →</Link></header>
    <section className="panel workflowForm" aria-busy={busy || loadingFile}><form onSubmit={event => void save(event)}>
      <label htmlFor="credential-import-file">Inventory file (.json)</label>
      <input id="credential-import-file" type="file" accept=".json,application/json" disabled={busy} onChange={event => void chooseFile(event)} aria-describedby="credential-import-help" />
      <p id="credential-import-help" className="muted">Up to 50 records. All entries start as Needs verification. Unknown dates remain blank; only an optional four-digit number suffix is accepted.</p>
      {rows.length > 0 && <><h2>Review {rows.length} records</h2><div className="credentialImportTable" role="region" aria-label="Inventory preview" tabIndex={0}><table>
        <thead><tr><th scope="col">Record</th><th scope="col">Type</th><th scope="col">Issuer</th><th scope="col">Number</th><th scope="col">Expiry</th><th scope="col">Reminder</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.name}><td>{row.name}<small className="muted">{row.source_note}</small></td><td>{credentialTypeLabels[row.credential_type]}</td><td>{row.issuer ?? "Unknown"}</td><td>{row.last_four ? `···· ${row.last_four}` : "Not recorded"}</td><td>{row.expires_on ?? "Not recorded"}</td><td>{row.reminder_on ?? "Not set"}</td></tr>)}</tbody>
      </table></div><p className="muted">Matching entries are skipped. Conflicting entries stop the import for review. If it stops, records already saved remain in your inventory.</p>
        <label className="checkboxLabel"><input type="checkbox" checked={confirmed} disabled={busy || complete} onChange={event => setConfirmed(event.target.checked)} />I reviewed this list and want to add these records as Needs verification.</label>
        <button type="submit" disabled={busy || complete || !confirmed}>{busy ? "Importing…" : complete ? "Inventory confirmed" : `Import ${rows.length} records`}</button></>}
      {progress && <p role="status">{progress.added} added · {progress.skipped} already recorded · {progress.total} in this list</p>}
      {message && <p role="status">{message}</p>}
      {complete && <p><Link href="/private-memory/credentials">View your IDs & Licenses →</Link></p>}
    </form></section></main>;
}
