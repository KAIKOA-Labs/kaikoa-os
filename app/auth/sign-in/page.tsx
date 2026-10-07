"use client";
import { useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function requestLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const client = getBrowserSupabase();
    if (!client) { setMessage("Authentication is not configured. Please contact the administrator."); return; }
    setBusy(true);
    setMessage("");
    try {
      const redirectTo = new URL("/auth/callback", window.location.origin).toString();
      const { error } = await client.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
      });
      if (error) {
        setMessage(error.message.toLowerCase().includes("rate limit")
          ? "Supabase has temporarily limited email delivery. Please wait before trying again."
          : "Unable to send a sign-in link. Check your address or try again later.");
      } else {
        setMessage("If this account is authorized, a sign-in link will arrive by email. Open it in this browser.");
      }
    } catch {
      setMessage("Unable to request a sign-in link right now.");
    } finally { setBusy(false); }
  }
  return <main className="shell">
    <header><p className="eyebrow">KAIKOA OS · PRIVATE ACCESS</p><h1>Sign in.</h1>
      <p className="muted">Access is invitation-only. Existing approved accounts only.</p></header>
    <section className="panel" style={{maxWidth:520}}>
      <form onSubmit={requestLink}>
        <label htmlFor="email" style={{display:"block",marginBottom:12}}>Email address</label>
        <input id="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}
          style={{width:"100%",padding:14,borderRadius:10,background:"#0a0c0f",border:"1px solid #343c46",color:"white",fontSize:16}}/>
        <button type="submit" disabled={busy} style={{marginTop:18,padding:"12px 20px",borderRadius:10,cursor:busy?"wait":"pointer",border:0,fontWeight:700}}>
          {busy?"Requesting…":"Email me a sign-in link"}
        </button>
        {message&&<p role="status" className="muted">{message}</p>}
      </form>
    </section>
    <p><Link href="/auth/status">Check account status →</Link></p>
    <p><Link href="/">← Return to preview</Link></p>
  </main>;
}
