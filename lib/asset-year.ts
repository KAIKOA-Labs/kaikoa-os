import { parseEvidenceSummary } from "./document-evidence.ts";

export type AssetYearDocument = { id: string; document_type: string; evidence_summary?: unknown };
type AssetYearLink = { document_id: string; entity_id: string | null };
type AssetYearEntity = { id: string; subtype: string | null };

// Only explicit model/build fields count. Registration, insurance and service dates do not.
function documentYears(document: AssetYearDocument): number[] {
  const summary = parseEvidenceSummary(document.evidence_summary);
  if (!summary || summary.category !== "registration") return [];
  const years = new Set<number>();
  const labels = document.document_type === "vessel_registration"
    ? ["build year", "year built", "year of build", "year of construction"]
    : ["model year", "manufacture year", "year of manufacture"];
  for (const field of summary.fields) {
    const label = field.label.toLowerCase();
    if (!labels.includes(label) && !(document.document_type === "vessel_registration" && label === "vessel / build")) continue;
    if (field.value === null) continue;
    const value = label === "vessel / build" ? field.value.match(/^.+ \/ (\d{4})$/)?.[1] : field.value;
    if (!value || !/^\d{4}$/.test(value) || Number(value) < 1000) return [];
    years.add(Number(value));
  }
  return [...years];
}

export function assetYearsByEntity(entities: AssetYearEntity[], documents: AssetYearDocument[], links: AssetYearLink[]): Map<string, number> {
  const result = new Map<string, number>();
  const documentsById = new Map(documents.map(document => [document.id, document]));
  for (const entity of entities) {
    if (entity.subtype !== "vehicle" && entity.subtype !== "vessel") continue;
    const expectedType = entity.subtype + "_registration";
    const years = new Set<number>();
    for (const link of links) {
      const document = documentsById.get(link.document_id);
      if (link.entity_id !== entity.id || document?.document_type !== expectedType) continue;
      for (const year of documentYears(document)) years.add(year);
    }
    // Conflicting recorded years stay unknown instead of choosing the latest file.
    if (years.size === 1) result.set(entity.id, [...years][0]);
  }
  return result;
}
