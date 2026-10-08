"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const requesting = useRef(false);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requesting.current) return;
    const client = getBrowserSupabase();
    if (!client) { setMessage("Sign-in is temporarily unavailable. Please try again later."); return; }
    requesting.current = true; setBusy(true); setMessage("");
    try {
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setMessage(error.message.toLowerCase().includes("rate limit")
          ? "Please wait before trying again."
          : "That email or password wasn’t accepted. Try again or use a secure email link.");
      } else {
        setMessage("Signed in. Opening your private workspace…");
      }
    } catch { setMessage("Unable to sign in right now."); }
    finally { requesting.current = false; setBusy(false); }
  }

  async function requestLink() {
    if (requesting.current || !email.trim()) {
      if (!email.trim()) setMessage("Enter your approved email address first.");
      return;
    }
    const client = getBrowserSupabase();
    if (!client) { setMessage("Sign-in is temporarily unavailable. Please try again later."); return; }
    requesting.current = true; setBusy(true); setMessage("");
    try {
      const redirectTo = new URL("/auth/callback", window.location.origin).toString();
      const { error } = await client.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
      });
      if (error) {
        setMessage(error.message.toLowerCase().includes("rate limit")
          ? "Please wait before requesting another sign-in link."
          : "Unable to send a sign-in link. Check your address or try again later.");
      } else {
        setMessage("If this address is approved, a sign-in link will arrive in your inbox. Open it in this browser.");
      }
    } catch { setMessage("Unable to request a sign-in link right now."); }
    finally { requesting.current = false; setBusy(false); }
  }
  return <main className="authScreen">
    <div className="authContent">
      <Link className="authBrand" href="/">KAIKOA OS</Link>
      <section className="authCard" aria-labelledby="sign-in-title" aria-busy={busy}>
        <header><p className="eyebrow">YOUR PRIVATE OPERATING SYSTEM</p><h1 id="sign-in-title">Welcome back.</h1>
          <p className="muted">Sign in to your private workspace.</p></header>
        <form onSubmit={signIn}>
          <label htmlFor="sign-in-email">Email address</label>
          <input id="sign-in-email" type="email" autoComplete="email" placeholder="you@example.com" required
            value={email} disabled={busy} onChange={event => setEmail(event.target.value)} aria-describedby="sign-in-help" />
          <label htmlFor="sign-in-password">KAIKOA OS password</label>
          <input id="sign-in-password" type="password" autoComplete="current-password" required
            value={password} disabled={busy} onChange={event => setPassword(event.target.value)} />
          <button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <div className="authAlternate" aria-hidden="true"><span>or</span></div>
          <button className="authSecondary" type="button" disabled={busy} onClick={() => { void requestLink(); }}>
            Email me a secure sign-in link
          </button>
          <p id="sign-in-help" className="authHelp">Approved accounts only. The email link remains available as a secure fallback.</p>
          {message && <p role="status" className="authMessage">{message}</p>}
        </form>
      </section>
      <p className="authPrivacy"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/></svg>Private access · Approved accounts only</p>
    </div>
  </main>;
}
