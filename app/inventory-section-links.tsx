import Link from "next/link";
import { inventorySections, recordsForInventorySection, type SectionRecord } from "@/lib/inventory-sections";

export default function InventorySectionLinks({ records }: { records: SectionRecord[] }) {
  return <section className="panel" aria-label="Record sections">
    <h2>Your workspace</h2>
    <div className="assetGrid">{inventorySections.map(section => <Link className="asset assetLink" key={section.key} href={section.href}>
      <strong>{section.title} →</strong>
      <span>{recordsForInventorySection(records, section.key).length} recorded</span>
      <small>{section.description}</small>
    </Link>)}</div>
  </section>;
}
