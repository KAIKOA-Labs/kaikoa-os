import assert from "node:assert/strict";
import test from "node:test";
import { inventorySections, recordsForInventorySection } from "../lib/inventory-sections.ts";
import { filterInventory, inventoryCategories, type InventoryRecord } from "../lib/inventory-view.ts";
const record = (id: string, subtype: string | null, status = "ACTIVE"): InventoryRecord =>
  ({ id, slug: id, name: id, subtype, status, location: null, data_quality: null });
const rows = [
  record("Rental home", "property", "OPPORTUNITY"), record("Boat", "vessel"), record("Car", "vehicle"),
  record("Domain", "digital_asset"), record("Camera", "equipment"), record("Creative work", "artwork"),
  record("Streaming service", "subscription"), record("Passport", "passport"), record("License", "credential"), record("Business", "business"),
  record("Person", "person"), record("Unclassified", null), record("New category", "future_category"),
  record("Archived art", "artwork", "ARCHIVED"),
];
test("every non-archived record has exactly one home; creative work and services stay outside possessions", () => {
  const sections = inventorySections.map(section => recordsForInventorySection(rows, section.key));
  assert.deepEqual(sections[0].map(r => r.id), ["Rental home", "Boat", "Car", "Domain", "Camera"]);
  assert.deepEqual(sections[1].map(r => r.id), ["Creative work"]);
  assert.deepEqual(sections[2].map(r => r.id), ["Streaming service"]);
  assert.deepEqual(sections[3].map(r => r.id), ["Passport", "License"]);
  assert.deepEqual(sections[4].map(r => r.id), ["Business", "Person", "Unclassified", "New category"]);
  const ids = sections.flat().map(r => r.id);
  assert.equal(ids.length, rows.length - 1);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(sections[0][0].status, "OPPORTUNITY");
  assert.equal(rows.length, 14);
});
test("section-local categories and search cannot expose records from another section, even after clearing filters", () => {
  const assets = recordsForInventorySection(rows, "assets");
  assert.deepEqual(filterInventory(assets, "Creative", null), []);
  assert.deepEqual(filterInventory(assets, "", "subscription"), []);
  assert.equal(filterInventory(assets, "", null).length, 5);
  assert.ok(inventoryCategories(assets).every(c => c.key !== "artwork" && c.key !== "subscription"));
  assert.deepEqual(recordsForInventorySection([record("Boat", "vessel")], "artwork"), []);
  const other = recordsForInventorySection(rows, "other");
  assert.deepEqual(filterInventory(other, "", "__uncategorized__").map(r => r.id), ["Unclassified"]);
});
