"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";

export default function AuthCallback() {
  const [message, setMessage] = useState("Verifying your invitation…");
  useEffect(() => {
    let alive = true;
    async function verify() {
      const supabase = getBrowserSupabase();
      if (!supabase) { if (alive) setMessage("Authentication setup is not complete. Please contact the KAIKOA OS administrator."); return; }
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!alive) return;
        if (error || !data.session) {
          setMessage("This invitation could not be verified. It may have expired or already been used. Request a fresh invitation.");
          return;
        }
        // No private application data is shown until authorization and owner-specific RLS are verified.
        window.history.replaceState(null, "", "/auth/callback");
        setMessage("Invitation verified. Private account access is being configured; the application remains in safe preview mode.");
      } catch {
        if (alive) setMessage("Unable to complete verification. Please request a fresh invitation.");
      }
    }
    void verify();
    return () => { alive = false; };
  }, []);
  return <main className="shell"><header><p className="eyebrow">KAIKOA OS · ACCOUNT ACCESS</p><h1>Account verification.</h1><p className="muted" role="status">{message}</p><p><Link href="/">← Return to preview</Link></p></header></main>;
}
