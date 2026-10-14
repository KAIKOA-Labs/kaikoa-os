import test from "node:test";
import assert from "node:assert/strict";
import { canAuthorizeNewPrint, registryFromMetadata, validatePrintRegistry } from "../lib/artwork-print-registry.ts";

const black = { edition_label: "Black background", numbered_limit: 1, artist_proof_limit: 0, reproduction_locked: true };
const white = { edition_label: "White background", numbered_limit: 20, artist_proof_limit: 2, reproduction_locked: false };
const print = { edition_label: "White background", kind: "numbered", number: 4, production: "framed_boxed", location: "ORT basement archival storage", availability: "reserved", fulfillment: "awaiting_handover", payment: "reported_paid", allocation: "Egg Fiasco", source_note: "Founder confirms current storage and pending delivery, 2026-10-14." };
const example = () => ({ version: 1, rules: [white, black], prints: [print] });

test("preserves the separately recorded ready-to-handover print", () => {
  const entry = validatePrintRegistry(example()).prints[0];
  assert.equal(entry.number, 4);
  assert.equal(entry.availability, "reserved");
  assert.equal(entry.fulfillment, "awaiting_handover");
  assert.equal(entry.location, "ORT basement archival storage");
  assert.equal(entry.payment, "reported_paid");
});
test("rejects duplicates and print numbers beyond edition bounds", () => {
  assert.throws(() => validatePrintRegistry({ ...example(), prints: [print, print] }));
  assert.throws(() => validatePrintRegistry({ ...example(), prints: [{ ...print, number: 21 }] }));
  assert.throws(() => validatePrintRegistry({ ...example(), prints: [{ ...print, kind: "artist_proof", number: 3 }] }));
  assert.throws(() => validatePrintRegistry({ ...example(), rules: [white, white] }));
});
test("requires allocation and source evidence; never infers delivery", () => {
  assert.throws(() => validatePrintRegistry({ ...example(), prints: [{ ...print, allocation: null }] }));
  assert.throws(() => validatePrintRegistry({ ...example(), prints: [{ ...print, source_note: "" }] }));
  assert.throws(() => validatePrintRegistry({ ...example(), prints: [{ ...print, fulfillment: "delivered", location: null }] }));
});
test("black edition forbids future duplicates and artist proofs", () => {
  assert.equal(canAuthorizeNewPrint(black, "numbered", 0), false);
  assert.equal(canAuthorizeNewPrint(black, "artist_proof", 0), false);
  assert.equal(canAuthorizeNewPrint(white, "numbered", 3), true);
  assert.equal(canAuthorizeNewPrint(white, "artist_proof", 2), false);
  assert.throws(() => validatePrintRegistry({ ...example(), prints: [{ ...print, edition_label: "Black background", kind: "artist_proof" }] }));
});
test("no registry remains unknown, and malformed registry is never accepted", () => {
  assert.equal(registryFromMetadata({ artwork_inventory: { version: 1 } }), null);
  assert.throws(() => registryFromMetadata({ artwork_print_registry: { version: 5 } }));
  assert.equal(registryFromMetadata({ artwork_print_registry: example() })?.prints.length, 1);
});
