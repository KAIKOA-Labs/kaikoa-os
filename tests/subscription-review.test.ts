import test from "node:test";
import assert from "node:assert/strict";
import { parseSubscriptionReview, recordedBillingLabel, subscriptionReviewLabel, subscriptionRows } from "../lib/subscription-review.ts";
const review = { version: 1, usage: "daily", intention: "keep", note: "Owner review note", reviewed_at: "2026-10-09T14:30:42.123456+00:00" };
test("review shape preserves unknowns and distinguishes missing from malformed records", () => {
  assert.deepEqual(parseSubscriptionReview(review), review);
  assert.equal(subscriptionReviewLabel(null), "Usage: Unknown · Decision: Undecided");
  assert.equal(subscriptionReviewLabel({}), "Review details need attention");
  for (const invalid of [{ ...review, version: 2 }, { ...review, usage: "cancelled" }, { ...review, intention: "cancelled" }, { ...review, note: "   " }, { ...review, note: " x note " }, { ...review, billing: 50 }, { ...review, reviewed_at: "infinity" }, { ...review, reviewed_at: "2026-02-30T12:00:00Z" }, { ...review, reviewed_at: "2026-10-09T24:00:00Z" }, { ...review, reviewed_at: "0000-01-01T00:00:00Z" }]) assert.equal(parseSubscriptionReview(invalid), null);
  assert.match(subscriptionReviewLabel({ ...review, usage: "unknown", intention: "cancel" }), /Unknown.*Intend to cancel/);
});
test("subscription review filters combine with search without mutating records or implying cancellation", () => {
  const row = (id: string, value: unknown, status = "ACTIVE") => ({ id, name: id, slug: id, status, subscription_review: value, billing: null });
  const rows = [row("daily service", review), row("unused service", { ...review, usage: "not_using", intention: "cancel" }), row("unknown service", null), row("malformed service", {}), row("archived", review, "ARCHIVED")];
  const original = structuredClone(rows);
  assert.deepEqual(subscriptionRows(rows, "service", "cancel").map(row => row.id), ["unused service"]);
  assert.deepEqual(subscriptionRows(rows, "", "not_using").map(row => row.id), ["unused service"]);
  assert.deepEqual(subscriptionRows(rows, "", "unreviewed").map(row => row.id), ["unknown service", "malformed service"]);
  assert.deepEqual(subscriptionRows(rows, " DAILY ", "keep").map(row => row.id), ["daily service"]);
  assert.equal(subscriptionRows(rows, "", "").length, 4);
  assert.deepEqual(rows, original);
});
test("billing labels preserve currencies and unknown cadence without claiming verified totals", () => {
  assert.equal(recordedBillingLabel({ amount: 0.00000001, currency: "USD", cadence: "monthly" }), "Recorded base: 0.00000001 USD · monthly");
  assert.equal(recordedBillingLabel(null), "No billing details recorded");
  assert.equal(recordedBillingLabel({ amount: 120, currency: "PHP", cadence: "monthly" }), "Recorded base: 120 PHP · monthly");
  assert.equal(recordedBillingLabel({ amount: 0, currency: "EUR", cadence: "annual" }), "Recorded base: 0 EUR · annual");
  assert.equal(recordedBillingLabel({ amount: 10, currency: "USD", cadence: "unknown", verification: "UNVERIFIED" }), "Recorded base: 10 USD · cadence unconfirmed");
  for (const value of [{ amount: -1, currency: "USD" }, { amount: Infinity, currency: "USD" }, { amount: 10 }, { amount: "10", currency: "USD" }]) assert.equal(recordedBillingLabel(value), "Billing details need review");
});
