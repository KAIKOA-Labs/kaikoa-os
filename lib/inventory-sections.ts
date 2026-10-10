export type InventorySection = "assets" | "artwork" | "subscriptions" | "credentials" | "other";
export type SectionRecord = { subtype: string | null; status: string };

export const inventorySections = [
  { key: "assets", title: "Assets", href: "/private-memory/inventory", description: "Properties, vehicles, vessels, equipment and digital assets.", empty: "No asset records found." },
  { key: "artwork", title: "Artwork", href: "/private-memory/artwork", description: "Your recorded creative works.", empty: "No artwork records found. Your creative work will appear here once recorded." },
  { key: "subscriptions", title: "Subscriptions", href: "/private-memory/subscriptions", description: "Recurring services and their recorded billing details.", empty: "No subscription records found." },
  { key: "credentials", title: "IDs & Licenses", href: "/private-memory/credentials", description: "Masked identity and license records with renewal dates.", empty: "No IDs or licenses recorded." },
  { key: "other", title: "Other Records", href: "/private-memory/records", description: "Businesses and records outside these sections.", empty: "No other records found." },
] as const;

const assetSubtypes = new Set(["property", "vehicle", "vessel", "equipment", "digital_asset"]);
export function inventorySectionForRecord(record: SectionRecord): InventorySection {
  if (record.subtype === "artwork") return "artwork";
  if (record.subtype === "subscription") return "subscriptions";
  if (record.subtype === "credential" || record.subtype === "passport") return "credentials";
  if (record.subtype !== null && assetSubtypes.has(record.subtype)) return "assets";
  return "other";
}
export function recordsForInventorySection<T extends SectionRecord>(records: T[], section: InventorySection): T[] {
  return records.filter(record => record.status !== "ARCHIVED" && inventorySectionForRecord(record) === section);
}
