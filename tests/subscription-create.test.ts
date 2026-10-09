import assert from "node:assert/strict";
import test from "node:test";
import { subscriptionCreationPayload } from "../lib/subscription-create.ts";
test("confirmed subscription entry trims fields and sends no billing, usage or provider state", () => {
  assert.deepEqual(subscriptionCreationPayload("  Example service  ", "  Owner description  ", true), { p_name: "Example service", p_subtype: "subscription", p_description: "Owner description" });
  assert.deepEqual(subscriptionCreationPayload("Service", "  ", true), { p_name: "Service", p_subtype: "subscription", p_description: "" });
});
test("subscription entry requires confirmation and matches database character and slug limits", () => {
  for (const name of ["", " ", "A", "!!!", "x".repeat(121)]) assert.throws(() => subscriptionCreationPayload(name, "", true));
  assert.throws(() => subscriptionCreationPayload("Service", "", false));
  assert.throws(() => subscriptionCreationPayload("Service", "x".repeat(1001), true));
  assert.equal(subscriptionCreationPayload("A" + "🌊".repeat(119), "🌊".repeat(1000), true).p_description.length, 2000);
});
