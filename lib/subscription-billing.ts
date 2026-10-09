export const billingCadences = [
  { value: "unknown", label: "Unknown" }, { value: "monthly", label: "Monthly" }, { value: "annual", label: "Annual" },
] as const;
export type SubscriptionBilling = { version: 1; amount: string | null; currency: string | null; cadence: typeof billingCadences[number]["value"]; source_note: string; recorded_at: string };
export function billingDraft(amount: string, currency: string, cadence: string, source: string) {
  let cleanAmount: string | null = amount.trim() || null;
  if (cleanAmount !== null) {
    if (!/^\d{1,12}(\.\d{1,6})?$/.test(cleanAmount)) throw new Error("Use a non-negative amount with up to 12 whole digits and 6 decimal places, or leave it unknown.");
    const [whole, fraction] = cleanAmount.split(".");
    const decimals = fraction?.replace(/0+$/, "");
    cleanAmount = (whole.replace(/^0+(?=\d)/, "")) + (decimals ? "." + decimals : "");
  }
  const cleanCurrency = currency.trim().toUpperCase() || null;
  if (cleanCurrency !== null && !/^[A-Z]{3}$/.test(cleanCurrency)) throw new Error("Use a three-letter currency code, or leave it unknown.");
  if (!billingCadences.some(option => option.value === cadence)) throw new Error("Choose Unknown, Monthly or Annual.");
  const note = source.trim();
  if (Array.from(note).length < 4 || Array.from(note).length > 1000) throw new Error("Enter a source note between 4 and 1,000 characters.");
  return { amount: cleanAmount, currency: cleanCurrency, cadence: cadence as SubscriptionBilling["cadence"], source_note: note };
}
export function parseSubscriptionBilling(value: unknown): SubscriptionBilling | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const keys = ["version", "amount", "currency", "cadence", "source_note", "recorded_at"];
  if (Object.keys(row).length !== keys.length || !keys.every(key => key in row) || row.version !== 1 ||
    !(row.amount === null || typeof row.amount === "string") || !(row.currency === null || typeof row.currency === "string") || typeof row.cadence !== "string" || typeof row.source_note !== "string" ||
    typeof row.recorded_at !== "string" || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(row.recorded_at) || row.recorded_at.startsWith("0000-") || !Number.isFinite(Date.parse(row.recorded_at))) return null;
  const day = row.recorded_at.slice(0, 10) + "T00:00:00Z";
  if (!Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== row.recorded_at.slice(0, 10)) return null;
  try {
    const draft = billingDraft(row.amount ?? "", row.currency ?? "", row.cadence, row.source_note);
    if (draft.amount !== row.amount || draft.currency !== row.currency || draft.source_note !== row.source_note) return null;
  } catch { return null; }
  return row as SubscriptionBilling;
}
export function ownerBillingLabel(value: unknown): string {
  const billing = parseSubscriptionBilling(value);
  if (!billing) return value == null ? "No owner billing record" : "Owner billing details need review";
  const [whole, fraction] = (billing.amount ?? "").split(".");
  const amount = billing.amount === null ? "Amount unknown" : whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (fraction ? "." + fraction : "");
  return `Owner-recorded base: ${amount} · ${billing.currency ?? "currency unknown"} · ${billing.cadence === "unknown" ? "cadence unknown" : billing.cadence} · Unverified`;
}
