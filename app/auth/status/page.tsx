"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";

type CheckState = { stage: "checking" | "signed-out" | "signed-in" | "error" | "unconfigured"; email?: string; access?: "allowed" | "denied" | "error"; detail?: string };

export default function AuthStatusPage() {
  const [state, setState] = useState<CheckState>({ stage: "checking" });
  const [signingOut, setSigningOut] = useState(false);
  async function signOut() {
    const client = getBrowserSupabase();
    if (!client) return;
    setSigningOut(true);
    const { error } = await client.auth.signOut();
    setSigningOut(false);
    setState(error ? { stage: "error", detail: "Sign-out failed. Please try again." } : { stage: "signed-out" });
  }
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
    return () => { active = false; };
  }, []);
  return <><div className="workspaceNavWrap"><nav className="workspaceNav" aria-label="Private workspace navigation"><Link className="workspaceBrand" href="/">KAIKOA OS</Link><div className="workspaceNavLinks"><Link className="workspaceNavLink" href="/private-memory">Overview</Link><Link className="workspaceNavLink" href="/private-memory/edit">Edit Assets</Link><Link className="workspaceNavLink" href="/private-memory/history">Change History</Link><Link className="workspaceNavLink active" aria-current="page" href="/auth/status">Account</Link></div></nav></div><main className="shell">
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
        <p className="muted">A successful query confirms endpoint access, not that other users are denied. Owner-only authorization must be tested separately.</p>
        <button type="button" disabled={signingOut} onClick={() => { void signOut(); }} style={{padding:"12px 18px",borderRadius:10,border:0,cursor:"pointer"}}>{signingOut ? "Signing out…" : "Sign out"}</button>
      </section>}
      {state.stage === "error" && <p className="muted" role="status">{state.detail}</p>}
      {state.stage === "signed-out" && <p><Link href="/auth/sign-in">Go to sign in →</Link></p>}
      <p><Link href="/private-memory">← Back to Overview</Link></p>
    </header>
  </main></>;
}
