import test from "node:test";
import assert from "node:assert/strict";
import { commandCenterReviewItems, type CommandCenterRecord } from "../lib/command-center-review.ts";

const make = (patch: Partial<CommandCenterRecord> = {}): CommandCenterRecord => ({
  id: "record", slug: "record", name: "Record", subtype: "property", status: "ACTIVE", data_quality: "verified", ...patch,
});

test("review queue identifies unverified assets and skips verified and archived records", () => {
  const items = commandCenterReviewItems([
    make({ id: "asset", name: "Boat", subtype: "vessel", data_quality: "partial" }),
    make({ id: "verified", data_quality: "verified" }),
    make({ id: "archived", status: "ARCHIVED", data_quality: "unverified" }),
  ]);
  assert.deepEqual(items.map(item => [item.name, item.section, item.reason]), [["Boat", "Assets", "Record quality: Partial"]]);
  assert.equal(items[0].href, "/private-memory/assets/record");
});

test("artwork coverage gaps link to the edition editor", () => {
  const items = commandCenterReviewItems([
    make({ id: "missing", slug: "missing-work", name: "Missing work", subtype: "artwork" }),
    make({ id: "present", slug: "present-work", name: "Present work", subtype: "artwork", artwork_inventory_version: "1" }),
  ]);
  assert.deepEqual(items.map(item => item.reason), ["Edition inventory not recorded or needs review"]);
  assert.ok(items.every(item => item.href.endsWith("/editions")));
});

test("subscription coverage surfaces missing review and billing markers without requesting private values", () => {
  const items = commandCenterReviewItems([make({ id: "service", slug: "streaming", name: "Streaming", subtype: "subscription", data_quality: "unverified" })]);
  assert.deepEqual(items.map(item => item.reason), ["Owner billing not recorded or needs review", "Usage and decision not recorded or needs review"]);
  assert.ok(items.every(item => item.href.includes("/private-memory/subscriptions/streaming/")));
  assert.ok(items.every(item => !JSON.stringify(item).includes("amount")));
  const present = commandCenterReviewItems([make({ subtype: "subscription", subscription_review_version: "1", subscription_billing_version: "1" })]);
  assert.deepEqual(present, []);
});

test("other records with unknown quality remain visible through the fallback section", () => {
  const items = commandCenterReviewItems([make({ subtype: "credential", data_quality: null })]);
  assert.equal(items.length, 1);
  assert.equal(items[0].section, "Other Records");
  assert.equal(items[0].reason, "Record quality: Not recorded");
});
