export type InventoryRecord = {
  id: string; slug: string; name: string; subtype: string | null;
  status: string; location: string | null; data_quality: string | null;
  artwork_inventory?: unknown;
};
const categoryLabels: Record<string, string> = {
  vessel: "Vessels", property: "Properties", vehicle: "Vehicles",
  digital_asset: "Digital Assets", subscription: "Subscriptions", artwork: "Artwork",
  business: "Businesses", equipment: "Equipment", passport: "Passports", credential: "Credentials",
};
export function inventoryCategoryKey(subtype: string | null) {
  return subtype ?? "__uncategorized__";
}
export function inventoryCategoryLabel(subtype: string | null) {
  return subtype ? categoryLabels[subtype] ?? subtype.replaceAll("_", " ") : "Uncategorized";
}
export function inventoryQualityLabel(value: string | null) {
  if (!value) return "Not recorded";
  return ({ verified: "Verified", partial: "Partial", unverified: "Unverified" } as Record<string, string>)[value.toLowerCase()] ?? value;
}
export function inventoryCategories(records: InventoryRecord[]) {
  const categories = new Map<string, { key: string; label: string; count: number }>();
  for (const record of records) {
    if (record.status === "ARCHIVED") continue;
    const key = inventoryCategoryKey(record.subtype);
    const category = categories.get(key) ?? { key, label: inventoryCategoryLabel(record.subtype), count: 0 };
    category.count += 1;
    categories.set(key, category);
  }
  return [...categories.values()].sort((a, b) => a.label.localeCompare(b.label));
}
export function groupInventoryByCategory(records: InventoryRecord[]) {
  const active = records.filter(record => record.status !== "ARCHIVED");
  return inventoryCategories(active).map(category => ({
    ...category,
    records: active.filter(record => inventoryCategoryKey(record.subtype) === category.key),
  }));
}
export function filterInventory(records: InventoryRecord[], query: string, category: string | null) {
  const search = query.trim().toLowerCase();
  return records.filter(record => record.status !== "ARCHIVED" &&
    (category === null || inventoryCategoryKey(record.subtype) === category) &&
    (!search || [record.name, record.location ?? "", record.subtype ?? "", inventoryCategoryLabel(record.subtype)]
      .some(value => value.toLowerCase().includes(search))));
}
