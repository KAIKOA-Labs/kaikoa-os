"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { parseSubscriptionReview, recordedBillingLabel, subscriptionReviewLabel, subscriptionRows, type SubscriptionSummary } from "@/lib/subscription-review";
import { ownerBillingLabel, parseSubscriptionBilling } from "@/lib/subscription-billing";
export default function Subscriptions() {
  const [state, setState] = useState("Checking access…");
  const [items, setItems] = useState<SubscriptionSummary[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  useEffect(() => {
    let active = true;
    (async () => {
      const db = getBrowserSupabase();
      if (!db) { setState("Database unavailable."); return; }
      const { data: user, error: authError } = await db.auth.getUser();
      if (!active) return;
      if (authError || !user.user) { setState("Sign in required."); return; }
      const { data, error } = await db.from("entities").select("id,name,slug,status,billing:metadata->billing,subscription_review:metadata->subscription_review,subscription_billing:metadata->subscription_billing").eq("subtype", "subscription").neq("status", "ARCHIVED").order("name");
      if (!active) return;
      if (error) { setState("Unable to load subscriptions. Reload to try again."); return; }
      setItems((data ?? []) as SubscriptionSummary[]); setState("ready");
    })().catch(() => { if (active) setState("Unable to load subscriptions. Reload to try again."); });
    return () => { active = false; };
  }, []);
  const visible = subscriptionRows(items, query, filter);
  return <main className="shell"><header><p className="eyebrow">KAIKOA OS · SUBSCRIPTIONS</p><h1>Subscriptions.</h1><p className="muted">Review what you use and what you intend to keep or cancel. Recorded billing is shown separately.</p></header>
    {state !== "ready" ? <section className="panel"><p role="status">{state}</p>{state === "Sign in required." && <Link href="/auth/sign-in">Sign in →</Link>}</section> : <section className="panel">
      <p><Link href="/private-memory/subscriptions/new">Add subscription →</Link></p>
      <div className="obligationControls"><div><label htmlFor="subscription-search">Search subscriptions</label><input id="subscription-search" type="search" maxLength={160} value={query} onChange={event => setQuery(event.target.value)} /></div>
        <div><label htmlFor="subscription-filter">Review view</label><select id="subscription-filter" value={filter} onChange={event => setFilter(event.target.value)}><option value="">All recorded</option><option value="unreviewed">Not yet reviewed / needs attention</option><option value="not_using">Not using</option><option value="keep">Keep</option><option value="review">Review further</option><option value="cancel">Intend to cancel</option></select></div></div>
      <div className="sectionHead"><p className="muted" role="status">Showing {visible.length} of {items.length} recorded subscriptions</p>{(query || filter) && <button type="button" onClick={() => { setQuery(""); setFilter(""); }}>Clear filters</button>}</div>
      <p className="muted">A recorded service may still need verification. “Intend to cancel” records your decision; cancellation must be completed with the provider.</p>
      {visible.length === 0 ? <p className="muted">{items.length === 0 ? "No subscriptions recorded." : "No subscriptions match this view. Clear filters or choose another view."}</p> : visible.map(item => {
        const review = parseSubscriptionReview(item.subscription_review);
        const billing = parseSubscriptionBilling(item.subscription_billing);
        return <article className="item obligationWorkspaceItem" key={item.id}><div><Link href={`/private-memory/assets/${encodeURIComponent(item.slug)}`}><strong>{item.name} →</strong></Link><p className="muted">Recorded status: {item.status}</p></div>
          <p>{subscriptionReviewLabel(item.subscription_review)}</p>{review && <><small><time dateTime={new Date(review.reviewed_at).toISOString()}>Review recorded: {new Date(review.reviewed_at).toLocaleString(undefined, { timeZoneName: "short" })}</time></small><small style={{ whiteSpace: "pre-wrap" }}>{review.note}</small></>}
          <small>{ownerBillingLabel(item.subscription_billing)}</small>{billing && <small><time dateTime={billing.recorded_at}>Billing recorded: {new Date(billing.recorded_at).toLocaleString(undefined, { timeZoneName: "short" })}</time></small>}
          <small>Earlier billing reference: {recordedBillingLabel(item.billing)}</small><small><Link href={`/private-memory/subscriptions/${encodeURIComponent(item.slug)}/billing`}>Record billing details →</Link></small><small><Link href={`/private-memory/subscriptions/${encodeURIComponent(item.slug)}/review`}>Review usage / decision →</Link></small>
        </article>;
      })}
    </section>}
  </main>;
}
