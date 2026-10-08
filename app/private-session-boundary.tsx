"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { createPrivateSession, needsPrivateSession, type PrivateAccess } from "@/lib/private-session";
import SignInScreen from "./sign-in-screen";

export default function PrivateSessionBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [access, setAccess] = useState<PrivateAccess>({ stage: "checking", userId: null, revision: 0 });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const db = getBrowserSupabase();
    if (!db) { setAccess({ stage: "error", userId: null, revision: 0 }); return; }
    const controller = createPrivateSession(async () => {
      const [{ data: identity, error }, { data: local, error: sessionError }] = await Promise.all([
        db.auth.getUser(), db.auth.getSession(),
      ]);
      if (!local.session && !sessionError) return null;
      if (error || sessionError) throw error ?? sessionError;
      if (!identity.user || !local.session) return null;
      if (identity.user.id !== local.session.user.id) throw new Error("Session changed during verification");
      return { userId: identity.user.id, expiresAt: (local.session.expires_at ?? 0) * 1000 };
    }, setAccess);
    const { data: { subscription } } = db.auth.onAuthStateChange((_event, session) => {
      controller.observe(session?.user.id ?? null);
    });
    const onFocus = () => controller.check();
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) controller.check(true); };
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);
    controller.check(true);
    return () => {
      controller.dispose(); subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [retry]);
  if (!needsPrivateSession(pathname)) return children;
  if (access.stage === "ready") return <div key={access.revision}>{children}</div>;
  if (access.stage === "signed-out") return <SignInScreen />;
  return <main className="shell">
    <nav className="nav"><Link className="brand" href="/">KAIKOA OS</Link></nav>
    <header><p className="eyebrow">KAIKOA OS · PRIVATE ACCESS</p><h1>Private workspace.</h1></header>
    <section className="panel"><p role="status">{access.stage === "checking" ? "Checking private access…" : "Private access could not be verified. Please retry."}</p>
      {access.stage === "checking" ? null : <p><Link href="/auth/sign-in">Sign in →</Link></p>}
      {access.stage === "error" && <button type="button" onClick={() => { setAccess({ stage: "checking", userId: null, revision: access.revision + 1 }); setRetry(value => value + 1); }}>Retry access check</button>}
    </section>
  </main>;
}
