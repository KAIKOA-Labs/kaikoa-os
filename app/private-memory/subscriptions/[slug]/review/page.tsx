"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { intentionOptions, parseSubscriptionReview, subscriptionReviewLabel, usageOptions, type SubscriptionReview } from "@/lib/subscription-review";
type RecordSummary = { id: string; name: string; subscription_review: unknown };
export default function ReviewSubscription() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const [item, setItem] = useState<RecordSummary | null>(null);
  const [usage, setUsage] = useState<SubscriptionReview["usage"]>("unknown");
  const [intention, setIntention] = useState<SubscriptionReview["intention"]>("undecided");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Checking access…");
  const saving = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    setBusy(false); saving.current = false; setItem(null); setConfirmed(false); setMessage("Checking access…");
    (async () => {
      const db = getBrowserSupabase();
      if (!db) { setMessage("Authentication unavailable."); return; }
      const { data: user, error: authError } = await db.auth.getUser();
      if (generation.current !== current) return;
      if (authError || !user.user) { setMessage("Sign in required."); return; }
      const { data, error } = await db.from("entities").select("id,name,subscription_review:metadata->subscription_review").eq("slug", slug).eq("subtype", "subscription").neq("status", "ARCHIVED").maybeSingle();
      if (generation.current !== current) return;
      if (error || !data) { setMessage("Subscription unavailable or archived. Return to Subscriptions."); return; }
      const record = data as RecordSummary;
      const review = parseSubscriptionReview(record.subscription_review);
      setItem(record); setUsage(review?.usage ?? "unknown"); setIntention(review?.intention ?? "undecided"); setNote(review?.note ?? ""); setMessage("");
    })().catch(() => { if (generation.current === current) setMessage("Unable to check access. Reload to try again."); });
    return () => { generation.current++; };
  }, [slug]);
  const recorded = parseSubscriptionReview(item?.subscription_review);
  const changed = !!item && (!recorded || usage !== recorded.usage || intention !== recorded.intention || note.trim() !== recorded.note);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const db = getBrowserSupabase();
    if (!db || !item || saving.current || !changed || !confirmed || note.trim().length < 4) return;
    const current = generation.current;
    saving.current = true; setBusy(true); setMessage("Saving…");
    try {
      const { data, error } = await db.rpc("update_subscription_review", {
        p_entity_id: item.id, p_expected_review: item.subscription_review ?? null,
        p_usage: usage, p_intention: intention, p_note: note, p_confirm_review: confirmed,
      });
      if (generation.current !== current) return;
      if (error) { setMessage(error.code === "40001" ? "This review changed. Reload before saving." : "Save failed. No change confirmed. Check access and required fields."); return; }
      const review = parseSubscriptionReview(data?.review);
      if (!review || typeof data?.changed !== "boolean") throw new Error("Unconfirmed response");
      setItem({ ...item, subscription_review: review }); setUsage(review.usage); setIntention(review.intention); setNote(review.note); setConfirmed(false);
      setMessage(data.changed ? "Review saved and recorded in Change History." : "No change needed.");
    } catch { if (generation.current === current) setMessage("The save could not be confirmed. Reload to check the latest review before retrying."); }
    finally { if (generation.current === current) { saving.current = false; setBusy(false); } }
  }
  return <main className="shell"><header><p className="eyebrow">KAIKOA OS · SUBSCRIPTION REVIEW</p><h1>Review usage and decision.</h1>{item && <p className="muted">{item.name}</p>}</header>
    <section className="panel workflowForm" aria-busy={busy}>{item && <form onSubmit={event => void save(event)}>
      <p className="muted">Recorded: {subscriptionReviewLabel(item.subscription_review)}</p>
      <label htmlFor="subscription-usage">How often do you use it?</label><select id="subscription-usage" value={usage} disabled={busy} onChange={event => { setUsage(event.target.value as SubscriptionReview["usage"]); setConfirmed(false); }}>{usageOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      <label htmlFor="subscription-intention">Your decision</label><select id="subscription-intention" value={intention} disabled={busy} onChange={event => { setIntention(event.target.value as SubscriptionReview["intention"]); setConfirmed(false); }}>{intentionOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      <p className="muted">“Intend to cancel” is your review decision. Complete any cancellation with the provider separately.</p>
      <label htmlFor="subscription-note">Review note (required)</label><textarea id="subscription-note" required minLength={4} maxLength={1000} rows={4} value={note} disabled={busy} onChange={event => { setNote(event.target.value); setConfirmed(false); }} />
      <label className="confirmCompletion"><input type="checkbox" checked={confirmed} disabled={busy || !changed} onChange={event => setConfirmed(event.target.checked)} />I confirm this reflects my current usage and decision.</label>
      <button type="submit" disabled={busy || !changed || !confirmed || note.trim().length < 4}>{busy ? "Saving…" : "Save review"}</button>
      {recorded && <p className="muted"><time dateTime={new Date(recorded.reviewed_at).toISOString()}>Last review recorded: {new Date(recorded.reviewed_at).toLocaleString(undefined, { timeZoneName: "short" })}</time></p>}
    </form>}{message && <p role="status" className="muted">{message}</p>}<p><Link href="/private-memory/subscriptions">Back to Subscriptions →</Link> · <Link href="/private-memory/history">Change History →</Link></p></section>
  </main>;
}
