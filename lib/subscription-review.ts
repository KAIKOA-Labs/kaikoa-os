export const usageOptions = [
  { value: "unknown", label: "Unknown" }, { value: "daily", label: "Daily" },
  { value: "regularly", label: "Regularly" }, { value: "rarely", label: "Rarely" },
  { value: "not_using", label: "Not using" },
] as const;
export const intentionOptions = [
  { value: "undecided", label: "Undecided" }, { value: "keep", label: "Keep" },
  { value: "review", label: "Review further" }, { value: "cancel", label: "Intend to cancel" },
] as const;
export type SubscriptionReview = {
  version: 1; usage: typeof usageOptions[number]["value"]; intention: typeof intentionOptions[number]["value"];
  note: string; reviewed_at: string;
};
export function parseSubscriptionReview(value: unknown): SubscriptionReview | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const keys = ["version", "usage", "intention", "note", "reviewed_at"];
  if (Object.keys(row).length !== keys.length || !keys.every(key => key in row) || row.version !== 1 ||
    !usageOptions.some(option => option.value === row.usage) || !intentionOptions.some(option => option.value === row.intention) ||
    typeof row.note !== "string" || row.note.trim() !== row.note || row.note.length < 4 || row.note.length > 1000 ||
    typeof row.reviewed_at !== "string" || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(row.reviewed_at) || !Number.isFinite(Date.parse(row.reviewed_at)) || row.reviewed_at.startsWith("0000-") ||
    !Number.isFinite(Date.parse(row.reviewed_at.slice(0, 10) + "T00:00:00Z")) ||
    new Date(row.reviewed_at.slice(0, 10) + "T00:00:00Z").toISOString().slice(0, 10) !== row.reviewed_at.slice(0, 10)) return null;
  return row as SubscriptionReview;
}
export function subscriptionReviewLabel(value: unknown) {
  const review = parseSubscriptionReview(value);
  if (!review) return value == null ? "Usage: Unknown · Decision: Undecided" : "Review details need attention";
  return `Usage: ${usageOptions.find(option => option.value === review.usage)!.label} · Decision: ${intentionOptions.find(option => option.value === review.intention)!.label}`;
}
export type SubscriptionSummary = { id: string; name: string; slug: string; status: string; subscription_review: unknown; billing: unknown; subscription_billing?: unknown };
export function subscriptionRows<T extends SubscriptionSummary>(rows: T[], query: string, filter: string): T[] {
  const search = query.trim().toLowerCase();
  return rows.filter(row => {
    const review = parseSubscriptionReview(row.subscription_review);
    const match = !filter || (filter === "unreviewed" ? !review : filter === "not_using" ? review?.usage === filter : review?.intention === filter);
    return row.status !== "ARCHIVED" && match && (!search || row.name.toLowerCase().includes(search));
  });
}
export function recordedBillingLabel(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "No billing details recorded";
  const row = value as Record<string, unknown>;
  if (typeof row.amount !== "number" || !Number.isFinite(row.amount) || row.amount < 0 || typeof row.currency !== "string" || !/^[A-Z]{3}$/.test(row.currency)) return "Billing details need review";
  const cadence = row.cadence === "monthly" ? "monthly" : row.cadence === "annual" ? "annual" : "cadence unconfirmed";
  return `Recorded base: ${row.amount.toLocaleString("en-GB", { maximumFractionDigits: 20 })} ${row.currency} · ${cadence}`;
}
