import { credentialFromMetadata, isIsoDate } from "./credential-record.ts";
import { parseEvidenceSummary } from "./document-evidence.ts";
import { safeDriveLink } from "./drive-reference.ts";

export type CredentialSourceRecord = {
  version: 1; credential_type: "national_id" | "driver_license" | "pilot_license" | "boating_license"; issuer: string;
  issued_on: string | null; expires_on: string | null; last_four: string | null; recorded_on: string;
  source_note: string; restrictions: string[];
};
export type CredentialEvidenceDocument = { id: string; document_type: string; status: string; source_url: string | null; credential_source_record: unknown; evidence_summary: unknown };
export type CredentialEvidence = { record: CredentialSourceRecord; source_url: string; back_source_url: string | null; conflict: boolean };
function text(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim() === value && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
}
export function parseCredentialSource(value: unknown): CredentialSourceRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const keys = ["version", "credential_type", "issuer", "issued_on", "expires_on", "last_four", "recorded_on", "source_note", "restrictions"];
  if (Object.keys(v).length !== keys.length || keys.some(key => !Object.hasOwn(v, key)) || v.version !== 1 ||
      !["national_id", "driver_license", "pilot_license", "boating_license"].includes(String(v.credential_type)) || !text(v.issuer, 120) ||
      !(v.issued_on === null || isIsoDate(v.issued_on)) || !(v.expires_on === null || isIsoDate(v.expires_on)) ||
      (typeof v.issued_on === "string" && typeof v.expires_on === "string" && v.issued_on >= v.expires_on) ||
      !(v.last_four === null || typeof v.last_four === "string" && /^[0-9]{4}$/.test(v.last_four)) || !isIsoDate(v.recorded_on) ||
      !text(v.source_note, 300) || !Array.isArray(v.restrictions) || v.restrictions.length > 8 || v.restrictions.some(r => !text(r, 180))) return null;
  return v as CredentialSourceRecord;
}
export function credentialEvidenceByEntity(
  entities: { id: string; subtype: string | null; credential_record: unknown; credential_group: unknown }[],
  documents: CredentialEvidenceDocument[], links: { document_id: string; entity_id: string | null; obligation_id: string | null }[],
): Map<string, CredentialEvidence> {
  const records = new Map(entities.filter(e => e.subtype === "credential").map(e => [e.id, e]));
  const candidates = new Map<string, CredentialEvidence[]>();
  for (const document of documents) {
    const record = parseCredentialSource(document.credential_source_record);
    const summary = parseEvidenceSummary(document.evidence_summary);
    const source = safeDriveLink(document.source_url);
    if (document.document_type !== "credential_evidence" || document.status === "ARCHIVED" || !record || !source || summary?.category !== "credential" || summary.role !== "primary") continue;
    const expiry = summary.fields.filter(f => f.label === "Expiry date");
    if (expiry.length !== 1 || expiry[0].value !== record.expires_on) continue;
    for (const link of links) {
      if (link.document_id !== document.id || !link.entity_id || link.obligation_id !== null) continue;
      const entity = records.get(link.entity_id), owner = credentialFromMetadata(entity?.credential_record);
      if (!entity || !owner) continue;
      const legacyCaap = record.credential_type === "pilot_license" && owner.credential_type === "other" && entity.credential_group === "philippines_ppl" && owner.issuer?.includes("CAAP");
      if (owner.credential_type !== record.credential_type && !legacyCaap) continue;
      const backs = documents.filter(back => {
        const backSummary = parseEvidenceSummary(back.evidence_summary);
        return back.document_type === "credential_evidence" && back.status !== "ARCHIVED" && backSummary?.category === "credential" &&
          backSummary.role === "supporting" && backSummary.bundle_id === summary.bundle_id &&
          links.some(backLink => backLink.document_id === back.id && backLink.entity_id === entity.id && backLink.obligation_id === null);
      }).map(back => safeDriveLink(back.source_url)).filter((url): url is string => Boolean(url));
      candidates.set(entity.id, [...(candidates.get(entity.id) ?? []), { record, source_url: source, back_source_url: backs.length === 1 ? backs[0] : null, conflict: false }]);
    }
  }
  const result = new Map<string, CredentialEvidence>();
  for (const [id, sources] of candidates) {
    const owner = credentialFromMetadata(records.get(id)!.credential_record)!;
    const first = sources[0];
    const conflict = sources.some(other => other.record.expires_on !== first.record.expires_on || other.record.credential_type !== first.record.credential_type || other.record.last_four !== first.record.last_four) ||
      Boolean(owner.expires_on && owner.expires_on !== first.record.expires_on) || Boolean(owner.last_four && first.record.last_four && owner.last_four !== first.record.last_four);
    result.set(id, { ...first, conflict });
  }
  return result;
}
