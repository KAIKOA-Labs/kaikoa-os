"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { subscriptionCreationPayload } from "@/lib/subscription-create";

export default function NewSubscriptionPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(false);
  const [message, setMessage] = useState("");
  const mounted = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || created) return;
    let payload;
    try { payload = subscriptionCreationPayload(name, description, confirmed); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Check the service details."); return; }
    inFlight.current = true;
    setBusy(true); setMessage("Recording subscription…");
    try {
      const db = getBrowserSupabase();
      if (!db) throw new Error("Connection unavailable. Please try again.");
      const { data: user, error: authError } = await db.auth.getUser();
      if (!mounted.current) return;
      if (authError || !user.user) throw new Error("Sign in to record a subscription.");
      const { data, error } = await db.rpc("create_inventory_asset", payload);
      if (!mounted.current) return;
      if (error) {
        if (error.code === "23505" || error.message === "An asset with this name already exists") throw new Error("A record with this name already exists. Check Subscriptions and the other inventory sections before adding it again.");
        throw new Error("Unable to confirm creation. Check Subscriptions before retrying, and review the service name and description.");
      }
      if (typeof data !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data)) throw new Error("Creation response was not confirmed. Check Subscriptions before retrying.");
      setCreated(true);
      setMessage("Subscription recorded as Unverified. Open Subscriptions to review its usage and your decision. Creation is recorded in Change History.");
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error ? error.message : "Creation was not confirmed. Check Subscriptions before retrying.");
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return <main className="shell">
    <header><p className="eyebrow">KAIKOA OS · SUBSCRIPTIONS</p><h1>Add subscription.</h1><p className="muted">Record a service you want to track. New entries start as Unverified.</p></header>
    <form className="panel workflowForm" onSubmit={event => void save(event)}>
      <label htmlFor="subscription-name">Service name</label>
      <input id="subscription-name" value={name} onChange={event => { setName(event.target.value); setConfirmed(false); }} required disabled={busy || created} />
      <label htmlFor="subscription-description">Description (optional)</label>
      <textarea id="subscription-description" value={description} onChange={event => { setDescription(event.target.value); setConfirmed(false); }} rows={4} disabled={busy || created} />
      <p className="muted">Use the service name and a short description. Billing, renewal dates and usage stay unknown until recorded separately. This does not start or change a provider subscription.</p>
      <label className="confirmCompletion"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required disabled={busy || created} /> I confirm I want to record this service.</label>
      <button type="submit" disabled={busy || created || !confirmed || Array.from(name.trim()).length < 2}>{busy ? "Recording…" : "Record subscription"}</button>
      {message && <p role="status">{message}</p>}
      {created && <button type="button" onClick={() => { setName(""); setDescription(""); setConfirmed(false); setCreated(false); setMessage(""); }}>Add another subscription</button>}
      <p><Link href="/private-memory/subscriptions">{created ? "View Subscriptions →" : "Back to Subscriptions"}</Link> · <Link href="/private-memory/history">Change History</Link></p>
    </form>
  </main>;
}
