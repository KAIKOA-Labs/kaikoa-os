import assert from "node:assert/strict";
import test from "node:test";
import { filterInventory, groupInventoryByCategory, inventoryCategories, inventoryQualityLabel, type InventoryRecord } from "../lib/inventory-view.ts";
const record = (name: string, subtype: string | null, location: string | null, status = "ACTIVE"): InventoryRecord =>
  ({ id: name, slug: name, name, subtype, location, status, data_quality: null });
const rows = [record("Sample boat", "vessel", "Port A"), record("Sample home", "property", "Port B"), record("Former home", "property", "Port B", "ARCHIVED"), record("Unknown category", null, null)];
test("inventory search and category combine, preserve order and exclude archived records", () => {
  assert.deepEqual(filterInventory(rows, "  SAMPLE  ", null).map(r => r.name), ["Sample boat", "Sample home"]);
  assert.deepEqual(filterInventory(rows, "Port B", "property").map(r => r.name), ["Sample home"]);
  assert.deepEqual(filterInventory(rows, "boat", "property"), []);
  assert.deepEqual(filterInventory(rows, "digital assets", null), []);
  assert.deepEqual(filterInventory(rows, "vessels", null).map(r => r.name), ["Sample boat"]);
  assert.equal(filterInventory(rows, "", null).length, 3);
  assert.equal(rows.length, 4);
});
test("categories reflect only present active records and missing quality is never promoted to verified", () => {
  const categories = inventoryCategories(rows);
  assert.deepEqual(categories.map(c => [c.label, c.count]), [["Properties", 1], ["Uncategorized", 1], ["Vessels", 1]]);
  assert.deepEqual(filterInventory(rows, "", "__uncategorized__").map(r => r.name), ["Unknown category"]);
  assert.deepEqual(inventoryCategories([]), []);
  assert.equal(inventoryQualityLabel(null), "Not recorded");
  assert.equal(inventoryQualityLabel("PARTIAL"), "Partial");
  assert.equal(inventoryQualityLabel("unverified"), "Unverified");
  assert.equal(inventoryQualityLabel("pending-source"), "pending-source");
});

test("asset cards are grouped by subtype with counts and archived records excluded", () => {
  const groups = groupInventoryByCategory([
    record("Home one", "property", "Port B"),
    record("Boat", "vessel", "Port A"),
    record("Home two", "property", "Port C"),
    record("Former home", "property", "Port B", "ARCHIVED"),
  ]);
  assert.deepEqual(groups.map(group => [group.key, group.count]), [["Properties", 2], ["Vessels", 1]]);
  assert.deepEqual(groups.find(group => group.label === "Properties")?.records.map(item => item.name), ["Home one", "Home two"]);
  assert.equal(groups.reduce((total, group) => total + group.records.length, 0), 3);
});
