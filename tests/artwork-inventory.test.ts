import test from "node:test";
import assert from "node:assert/strict";
import { countInput, copiesStillToPrint, emptyInventory, inventoryFromMetadata, validateInventory } from "../lib/artwork-inventory.ts";
const example = () => ({ ...emptyInventory(), editions: [{ label: "White", image_size: "45 × 60 cm", edition_limit: 20, printed_count: null, source_note: "Owner report; current production unconfirmed", source_date: null }] });
test("unknown print counts stay unknown; zero is known and APs never consume numbered capacity", () => {
  const data = validateInventory(example());
  assert.equal(copiesStillToPrint(data.editions[0]), null);
  data.editions[0].printed_count = 0;
  data.artist_proofs = { allowance: 2, printed_count: 2, image_size: "", source_note: "Owner", source_date: null };
  assert.equal(copiesStillToPrint(data.editions[0]), 20);
  data.editions[0].printed_count = 7;
  assert.equal(copiesStillToPrint(data.editions[0]), 13);
  assert.equal(copiesStillToPrint({ edition_limit: null, printed_count: 7 }), null);
  assert.equal(countInput(""), null); assert.equal(countInput("0"), 0);
  for (const value of ["-1", "1.5", "1e3", "1000001"]) assert.throws(() => countInput(value));
});
test("limits, distinct versions and required provenance reject misleading data", () => {
  for (const patch of [{ printed_count: 21 }, { edition_limit: 0 }, { printed_count: -1 }, { printed_count: 0.5 }, { source_note: " " }, { source_date: "2026-02-30" }]) {
    const value = example(); Object.assign(value.editions[0], patch); assert.throws(() => validateInventory(value));
  }
  const value = example(); value.editions.push({ ...value.editions[0], label: " white " }); assert.throws(() => validateInventory(value));
  assert.throws(() => validateInventory({ ...example(), price: 100 }));
  assert.throws(() => validateInventory({ ...example(), artist_proofs: { ...emptyInventory().artist_proofs, allowance: 2 } }));
  assert.throws(() => validateInventory({ ...example(), artist_proofs: { ...emptyInventory().artist_proofs, allowance: 2, printed_count: 3, source_note: "Owner" } }));
});
test("metadata reader distinguishes absent information from malformed information", () => {
  assert.equal(inventoryFromMetadata({ unrelated: "preserved" }), null);
  assert.throws(() => inventoryFromMetadata({ artwork_inventory: { version: 2 } }));
  const value = { ...example(), editions: [{ ...example().editions[0], source_date: "2026-10-09" }] };
  assert.deepEqual(inventoryFromMetadata({ artwork_inventory: value, unrelated: "preserved" }), validateInventory(value));
});
