"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";

type CheckState = { stage: "checking" | "signed-out" | "signed-in" | "error" | "unconfigured"; email?: string; access?: "allowed" | "denied" | "error"; detail?: string };

export default function AuthStatusPage() {
  const [state, setState] = useState<CheckState>({ stage: "checking" });
  useEffect(() => {
    let active = true;
    const supabase = getBrowserSupabase();
    if (!supabase) { setState({ stage: "unconfigured" }); return; }
    const inspect = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!active) return;
        if (error || !data.user) { setState({ stage: "signed-out" }); return; }
        const { error: dbError } = await supabase.from("entities").select("id", { head: true, count: "exact" });
        if (!active) return;
        setState({ stage: "signed-in", email: data.user.email, access: dbError ? "error" : "allowed", detail: dbError ? "Database query failed. Check access configuration." : undefined });
      } catch {
        if (active) setState({ stage: "error", detail: "Could not complete the authentication check." });
      }
    };
    void inspect();
    const { data: subscription } = supabase.auth.onAuthStateChange(() => { void inspect(); });
    return () => { active = false; subscription.subscription.unsubscribe(); };
  }, []);
  return <main className="shell">
    <header>
      <p className="eyebrow">KAIKOA OS · SECURITY CHECK</p>
      <h1>Account status.</h1>
      {state.stage === "checking" && <p className="muted" role="status">Checking your session…</p>}
      {state.stage === "unconfigured" && <p className="muted" role="status">Authentication configuration is incomplete.</p>}
      {state.stage === "signed-out" && <p className="muted" role="status">Not signed in. No active KAIKOA OS session was found.</p>}
      {state.stage === "signed-in" && <section className="panel" role="status">
        <h2>Signed in</h2><p>Account: {state.email ?? "Verified user"}</p>
        <p>Database read test: {state.access === "allowed" ? "Query successful" : "Query failed"}</p>
        {state.detail && <p className="muted">{state.detail}</p>}
        <p className="muted">A successful query confirms this session can access the endpoint, not that unauthorized users are denied. Owner-only policy testing remains a separate security checkpoint.</p>
      </section>}
      {state.stage === "error" && <p className="muted" role="status">{state.detail}</p>}
      <p><Link href="/">← Return to preview</Link></p>
    </header>
  </main>;
}
