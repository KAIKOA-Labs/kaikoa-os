import assert from "node:assert/strict";
import test from "node:test";
import { billingDraft, ownerBillingLabel, parseSubscriptionBilling } from "../lib/subscription-billing.ts";
const base = { version: 1, amount: "999999999999.999999", currency: "PHP", cadence: "monthly", source_note: "Synthetic source note", recorded_at: "2026-10-09T14:00:00.123456+00:00" };
test("billing entry preserves decimal precision, zero and independent unknowns", () => {
  assert.equal(billingDraft(base.amount, "php", "monthly", "  Synthetic source note  ").amount, base.amount);
  assert.equal(billingDraft("000.000000", "", "unknown", "Source note").amount, "0");
  assert.equal(billingDraft("0012.340000", "eur", "annual", "Source note").amount, "12.34");
  assert.deepEqual(billingDraft("", "", "unknown", "Source note"), { amount: null, currency: null, cadence: "unknown", source_note: "Source note" });
  for (const amount of ["-1", "1e3", "1,000", "0.0000001", "1000000000000", ".50", "NaN", "Infinity"]) assert.throws(() => billingDraft(amount, "EUR", "monthly", "Source note"));
  assert.throws(() => billingDraft("1", "$", "monthly", "Source note"));
  assert.throws(() => billingDraft("1", "USD", "weekly", "Source note"));
  assert.throws(() => billingDraft("1", "USD", "monthly", "bad"));
});
test("stored billing strictly validates types, canonical decimals and dates without claiming paid costs", () => {
  assert.deepEqual(parseSubscriptionBilling(base), base);
  for (const value of [null, [], {}, { ...base, amount: 5 }, { ...base, amount: "01" }, { ...base, currency: "php" }, { ...base, paid: true }, { ...base, recorded_at: "2026-02-30T12:00:00Z" }, { ...base, source_note: 12345 }]) assert.equal(parseSubscriptionBilling(value), null);
  assert.match(ownerBillingLabel(base), /999,999,999,999\.999999.*PHP.*Unverified/);
  assert.match(ownerBillingLabel({ ...base, amount: null, currency: null, cadence: "unknown" }), /Amount unknown.*currency unknown.*cadence unknown/);
  assert.equal(ownerBillingLabel({}), "Owner billing details need review");
});
