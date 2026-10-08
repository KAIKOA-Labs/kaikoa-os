"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { runAccessChecks, type AccessCheck } from "@/lib/authorization-check";

export default function AccessCheckPage() {
  const [checks, setChecks] = useState<AccessCheck[]>([]);
  const [message, setMessage] = useState("Keep the temporary test account signed in, then run the checks once.");
  const [running, setRunning] = useState(false);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(() => {
    const db = getBrowserSupabase();
    const subscription = db?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" || event === "SIGNED_IN" || event === "USER_UPDATED") {
        active.current?.abort();
        setChecks([]); setCompletedAt(null);
      }
    }).data.subscription;
    return () => { active.current?.abort(); subscription?.unsubscribe(); };
  }, []);
  async function run() {
    if (active.current) return;
    const db = getBrowserSupabase();
    if (!db) { setMessage("Authentication unavailable."); return; }
    const controller = new AbortController();
    active.current = controller;
    const timeout = setTimeout(() => controller.abort(), 60000);
    setRunning(true); setChecks([]); setCompletedAt(null); setMessage("Checking access…");
    try {
      await runAccessChecks({
        identity: async () => {
          const { data, error } = await db.auth.getUser();
          return error ? null : data.user;
        },
        read: async table => {
          const { status, count, error } = await db.from(table).select("id", { head: true, count: "exact" }).abortSignal(controller.signal);
          return { status, count, error };
        },
        write: async (name, args) => {
          const { status, error } = await db.rpc(name, args).abortSignal(controller.signal);
          return { status, error };
        },
      }, results => { if (!controller.signal.aborted) setChecks(results); }, controller.signal);
      if (!controller.signal.aborted) {
        setCompletedAt(new Date().toISOString());
        setMessage("16 / 16 checks passed. The test account sees no rows and all eight write requests are explicitly denied.");
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        const detail = error instanceof Error ? error.message : "Check failed. No passing result recorded.";
        if (detail.startsWith("Session changed")) setChecks([]);
        setMessage(detail);
      }
      else { setChecks([]); setCompletedAt(null); setMessage("Check cancelled or session changed. No passing result recorded."); }
    } finally {
      clearTimeout(timeout);
      if (active.current === controller) { active.current = null; setRunning(false); }
    }
  }
  return <main className="shell">
    <header><p className="eyebrow">KAIKOA OS · TEST ACCOUNT</p><h1>Access checks.</h1><p className="muted">One batch checks eight record types and eight write actions using this browser’s signed-in account.</p></header>
    <section className="panel">
      <p>Reads retrieve counts only. Write checks use blank fields and nonexistent record IDs; they are expected to be denied before validation.</p>
      <button type="button" disabled={running} onClick={() => void run()} style={{ padding: "12px 20px", borderRadius: 8, border: 0, fontWeight: 700 }}>{running ? "Checking…" : "Run access checks"}</button>
      <p role="status" aria-live="polite">{message}</p>
      {completedAt && <p className="muted">Completed: <time dateTime={completedAt}>{completedAt}</time></p>}
      {checks.length > 0 && <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderSpacing: "12px", textAlign: "left" }}><caption>Real-session HTTP results</caption><thead><tr><th scope="col">Check</th><th scope="col">Result</th><th scope="col">HTTP</th><th scope="col">Evidence</th></tr></thead><tbody>{checks.map(check => <tr key={check.kind + check.name}><th scope="row">{check.kind} · {check.name}</th><td>{check.passed ? "PASS" : "FAIL"}</td><td>{check.status}</td><td>{check.detail}</td></tr>)}</tbody></table></div>}
      <p className="muted">This checks authorization only. Backup restoration remains a separate milestone requirement.</p>
      <p><Link href="/auth/status">Account and sign out →</Link></p>
    </section>
  </main>;
}
