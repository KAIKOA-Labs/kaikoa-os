import test from "node:test";
import assert from "node:assert/strict";
import { emptyInventory } from "../lib/artwork-inventory.ts";
import { artworkOverview } from "../lib/artwork-overview.ts";

test("overview distinguishes missing, empty and malformed source data without inventing stock", () => {
  assert.equal(artworkOverview(undefined).state, "missing");
  assert.equal(artworkOverview(null).state, "missing");
  assert.equal(artworkOverview({ version: 2 }).state, "needs-review");
  const empty = artworkOverview(emptyInventory());
  assert.equal(empty.state, "recorded");
  if (empty.state !== "recorded") throw new Error("Expected a recorded empty inventory");
  assert.equal(empty.editions.length, 0);
  assert.deepEqual(empty.proofs, { allowance: null, printed: null });
});
test("overview preserves unknowns per version and separates AP allowance from numbered copies", () => {
  const edition = { label: "Large version", image_size: "", edition_limit: 10, printed_count: null, source_note: "Synthetic source", source_date: null };
  const value = { ...emptyInventory(), editions: [edition, { ...edition, label: "Small version", printed_count: 0 }], artist_proofs: { ...emptyInventory().artist_proofs, allowance: 2, printed_count: 1, source_note: "Synthetic source" } };
  const result = artworkOverview(value);
  assert.equal(result.state, "recorded");
  if (result.state !== "recorded") throw new Error("Expected inventory");
  assert.deepEqual(result.editions.map(row => row.stillToPrint), [null, 10]);
  assert.deepEqual(result.editions.map(row => row.printed), [null, 0]);
  assert.deepEqual(result.proofs, { allowance: 2, printed: 1 });
  assert.equal("availableForSale" in result, false);
  assert.equal("source_note" in result.editions[0], false);
});
