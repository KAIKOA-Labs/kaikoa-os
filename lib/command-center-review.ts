import { inventoryQualityLabel } from "./inventory-view.ts";
import { inventorySectionForRecord } from "./inventory-sections.ts";

export type CommandCenterRecord = {
  id: string;
  slug: string;
  name: string;
  subtype: string | null;
  status: string;
  data_quality: string | null;
  artwork_inventory_version?: string | null;
  subscription_review_version?: string | null;
  subscription_billing_version?: string | null;
};

export type CommandCenterReviewItem = {
  id: string;
  name: string;
  section: string;
  reason: string;
  href: string;
};

export function commandCenterReviewItems(records: CommandCenterRecord[]): CommandCenterReviewItem[] {
  const items: CommandCenterReviewItem[] = [];
  for (const record of records) {
    if (record.status === "ARCHIVED") continue;
    const section = inventorySectionForRecord(record);
    const detail = `/private-memory/assets/${encodeURIComponent(record.slug)}`;
    if ((section === "assets" || section === "credentials" || section === "other") && record.data_quality?.toLowerCase() !== "verified") {
      const sectionName = section === "assets" ? "Assets" : section === "credentials" ? "IDs & Licenses" : "Other Records";
      const href = section === "credentials" ? `/private-memory/credentials/${encodeURIComponent(record.slug)}/edit` : detail;
      items.push({ id: `${record.id}:quality`, name: record.name, section: sectionName, reason: `Record quality: ${inventoryQualityLabel(record.data_quality)}`, href });
    }
    if (section === "artwork") {
      if (record.artwork_inventory_version !== "1") items.push({ id: `${record.id}:editions`, name: record.name, section: "Artwork", reason: "Edition inventory not recorded or needs review", href: `/private-memory/artwork/${encodeURIComponent(record.slug)}/editions` });
    }
    if (section === "subscriptions") {
      if (record.subscription_review_version !== "1") items.push({ id: `${record.id}:review`, name: record.name, section: "Subscriptions", reason: "Usage and decision not recorded or needs review", href: `/private-memory/subscriptions/${encodeURIComponent(record.slug)}/review` });
      if (record.subscription_billing_version !== "1") items.push({ id: `${record.id}:billing`, name: record.name, section: "Subscriptions", reason: "Owner billing not recorded or needs review", href: `/private-memory/subscriptions/${encodeURIComponent(record.slug)}/billing` });
    }
  }
  return items.sort((a, b) => a.section.localeCompare(b.section) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
