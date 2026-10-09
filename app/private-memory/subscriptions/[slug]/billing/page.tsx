"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { recordedBillingLabel } from "@/lib/subscription-review";
import { billingCadences, billingDraft, ownerBillingLabel, parseSubscriptionBilling, type SubscriptionBilling } from "@/lib/subscription-billing";
type RecordSummary = { id: string; name: string; billing: unknown; subscription_billing: unknown };
export default function SubscriptionBillingPage() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const [item, setItem] = useState<RecordSummary | null>(null);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("");
  const [cadence, setCadence] = useState<SubscriptionBilling["cadence"]>("unknown");
  const [source, setSource] = useState("");
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
      const { data, error } = await db.from("entities").select("id,name,billing:metadata->billing,subscription_billing:metadata->subscription_billing").eq("slug", slug).eq("subtype", "subscription").neq("status", "ARCHIVED").maybeSingle();
      if (generation.current !== current) return;
      if (error || !data) { setMessage("Subscription unavailable or archived. Return to Subscriptions."); return; }
      const record = data as RecordSummary;
      const billing = parseSubscriptionBilling(record.subscription_billing);
      setItem(record); setAmount(billing?.amount ?? ""); setCurrency(billing?.currency ?? ""); setCadence(billing?.cadence ?? "unknown"); setSource(billing?.source_note ?? ""); setMessage("");
    })().catch(() => { if (generation.current === current) setMessage("Unable to check access. Reload to try again."); });
    return () => { generation.current++; };
  }, [slug]);
  const recorded = parseSubscriptionBilling(item?.subscription_billing);
  let draft: ReturnType<typeof billingDraft> | null = null;
  let validation = "";
  try { draft = billingDraft(amount, currency, cadence, source); } catch (error) { validation = error instanceof Error ? error.message : "Check billing fields."; }
  const changed = !!item && !!draft && (!recorded || draft.amount !== recorded.amount || draft.currency !== recorded.currency || draft.cadence !== recorded.cadence || draft.source_note !== recorded.source_note);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const db = getBrowserSupabase();
    if (!db || !item || !draft || saving.current || !changed || !confirmed) return;
    const current = generation.current;
    saving.current = true; setBusy(true); setMessage("Saving…");
    try {
      const { data, error } = await db.rpc("update_subscription_billing", {
        p_entity_id: item.id, p_expected_billing: item.subscription_billing ?? null,
        p_amount: draft.amount, p_currency: draft.currency, p_cadence: draft.cadence, p_source_note: draft.source_note, p_confirm_billing: confirmed,
      });
      if (generation.current !== current) return;
      if (error) { setMessage(error.code === "40001" ? "Billing details changed. Reload before saving." : "Save failed. No change confirmed. Check access and required fields."); return; }
      const billing = parseSubscriptionBilling(data?.billing);
      if (!billing || typeof data?.changed !== "boolean") throw new Error("Unconfirmed response");
      setItem({ ...item, subscription_billing: billing }); setAmount(billing.amount ?? ""); setCurrency(billing.currency ?? ""); setCadence(billing.cadence); setSource(billing.source_note); setConfirmed(false);
      setMessage(data.changed ? "Billing details saved as Unverified and recorded in Change History." : "No change needed.");
    } catch { if (generation.current === current) setMessage("The save could not be confirmed. Reload to check the latest billing details before retrying."); }
    finally { if (generation.current === current) { saving.current = false; setBusy(false); } }
  }
  return <main className="shell"><header><p className="eyebrow">KAIKOA OS · SUBSCRIPTION BILLING</p><h1>Record billing details.</h1>{item && <p className="muted">{item.name}</p>}</header>
    <section className="panel workflowForm" aria-busy={busy}>{item && <form onSubmit={event => void save(event)}>
      <p className="muted">{ownerBillingLabel(item.subscription_billing)}</p><p className="muted">Earlier billing reference: {recordedBillingLabel(item.billing)}</p>
      <p className="muted">Record the base amount and where it came from. Earlier source details are preserved. This entry stays Unverified and does not establish an actual charge or payment.</p>
      <label htmlFor="billing-amount">Base amount (leave blank if unknown)</label><input id="billing-amount" type="text" inputMode="decimal" value={amount} maxLength={19} disabled={busy} onChange={event => { setAmount(event.target.value); setConfirmed(false); }} />
      <p className="muted">Use a decimal point, without currency symbols or commas. Up to 12 whole digits and 6 decimal places.</p>
      <label htmlFor="billing-currency">Currency code (leave blank if unknown)</label><input id="billing-currency" value={currency} maxLength={3} placeholder="e.g. PHP, EUR, USD, XPF" disabled={busy} onChange={event => { setCurrency(event.target.value); setConfirmed(false); }} />
      <label htmlFor="billing-cadence">Billing cadence</label><select id="billing-cadence" value={cadence} disabled={busy} onChange={event => { setCadence(event.target.value as SubscriptionBilling["cadence"]); setConfirmed(false); }}>{billingCadences.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      <label htmlFor="billing-source">Source note (required)</label><textarea id="billing-source" required rows={4} value={source} disabled={busy} placeholder="Where and when you checked this amount, or what still needs checking." onChange={event => { setSource(event.target.value); setConfirmed(false); }} />
      {validation && <p className="muted">{validation}</p>}
      <label className="confirmCompletion"><input type="checkbox" checked={confirmed} disabled={busy || !changed} onChange={event => setConfirmed(event.target.checked)} />I confirm these details and the source note.</label>
      <button type="submit" disabled={busy || !changed || !confirmed}>{busy ? "Saving…" : "Save billing details"}</button>
      {recorded && <p className="muted"><time dateTime={recorded.recorded_at}>Last recorded: {new Date(recorded.recorded_at).toLocaleString(undefined, { timeZoneName: "short" })}</time><br />{recorded.source_note}</p>}
    </form>}{message && <p role="status" className="muted">{message}</p>}<p><Link href="/private-memory/subscriptions">Back to Subscriptions →</Link> · <Link href="/private-memory/history">Change History →</Link></p></section>
  </main>;
}
