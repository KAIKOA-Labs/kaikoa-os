import { credentialFromMetadata, isIsoDate } from "./credential-record.ts";
import { parseEvidenceSummary } from "./document-evidence.ts";
import { safeDriveLink } from "./drive-reference.ts";

export type PassportRecord = {
  version: 1; issued_on: string; expires_on: string; recorded_on: string; source_note: string;
  notification: { provider: "chatgpt_tasks"; task_id: string; configured_on: string } | null;
};
export type PassportDocument = { id: string; document_type: string; status: string; source_url: string | null; passport_record: unknown; evidence_summary: unknown };
export type PassportPlan = { record: PassportRecord; renew_on: string; travel_review_on: string; source_url: string; conflict: boolean };
export const passportRenewalMonths = 12;

export function monthsBefore(date: string, months: number): string {
  if (!isIsoDate(date) || !Number.isInteger(months) || months < 0 || months > 120) throw new Error("Invalid calendar date or interval");
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 - months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}
export function parsePassportRecord(value: unknown): PassportRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const keys = ["version", "issued_on", "expires_on", "recorded_on", "source_note", "notification"];
  if (Object.keys(v).length !== keys.length || keys.some(key => !Object.hasOwn(v, key)) || v.version !== 1 ||
      !isIsoDate(v.issued_on) || !isIsoDate(v.expires_on) || !isIsoDate(v.recorded_on) || v.issued_on >= v.expires_on ||
      typeof v.source_note !== "string" || v.source_note.trim() !== v.source_note || v.source_note.length < 4 || v.source_note.length > 300 || /[\u0000-\u001f\u007f]/.test(v.source_note)) return null;
  const n = v.notification;
  if (n === null) return v as PassportRecord;
  if (!n || typeof n !== "object" || Array.isArray(n)) return null;
  const notification = n as Record<string, unknown>;
  if (Object.keys(notification).length !== 3 || notification.provider !== "chatgpt_tasks" ||
      typeof notification.task_id !== "string" || !/^[a-f0-9]{32}$/.test(notification.task_id) || !isIsoDate(notification.configured_on)) return null;
  return v as PassportRecord;
}
export function passportPlansByEntity(
  entities: { id: string; subtype: string | null; credential_record: unknown }[],
  documents: PassportDocument[], links: { document_id: string; entity_id: string | null; obligation_id: string | null }[],
): Map<string, PassportPlan> {
  const eligible = new Map(entities.filter(entity => ["credential", "passport"].includes(entity.subtype ?? "") &&
    (credentialFromMetadata(entity.credential_record)?.credential_type === "passport" || entity.subtype === "passport")).map(entity => [entity.id, entity]));
  const candidates = new Map<string, PassportPlan[]>();
  for (const document of documents) {
    const record = parsePassportRecord(document.passport_record);
    const summary = parseEvidenceSummary(document.evidence_summary);
    const source = safeDriveLink(document.source_url);
    if (document.document_type !== "passport_evidence" || document.status === "ARCHIVED" || !record || !source || summary?.category !== "passport" || summary.role !== "primary") continue;
    const expiryFields = summary.fields.filter(field => field.label === "Expiry date");
    if (expiryFields.length !== 1 || expiryFields[0].value !== record.expires_on) continue;
    for (const link of links) {
      if (link.document_id !== document.id || !link.entity_id || link.obligation_id !== null || !eligible.has(link.entity_id)) continue;
      const plan = { record, source_url: source, renew_on: monthsBefore(record.expires_on, passportRenewalMonths), travel_review_on: monthsBefore(record.expires_on, 6), conflict: false };
      candidates.set(link.entity_id, [...(candidates.get(link.entity_id) ?? []), plan]);
    }
  }
  const result = new Map<string, PassportPlan>();
  for (const [id, plans] of candidates) {
    // Keep ambiguous evidence visible for review without claiming one source is current.
    const plan = plans[0];
    const ownerExpiry = credentialFromMetadata(eligible.get(id)!.credential_record)?.expires_on;
    result.set(id, { ...plan, conflict: plans.some(other => other.record.expires_on !== plan.record.expires_on) || Boolean(ownerExpiry && ownerExpiry !== plan.record.expires_on) });
  }
  return result;
}
export function passportAttention(plan: PassportPlan, today: string): string {
  if (plan.conflict) return "Expiry sources disagree · review";
  if (!isIsoDate(today)) return "Check passport dates";
  if (today >= plan.record.expires_on) return "Recorded expiry reached · renew";
  if (today > plan.travel_review_on) return "Under six months remaining · renew before travel";
  if (today === plan.travel_review_on) return "Six months remaining · renew before travel";
  if (today >= plan.renew_on) return "Renewal window reached";
  return "Renewal planned before six-month threshold";
}

export function passportReadiness(plan: PassportPlan | undefined, today: string): { state: "ready" | "attention" | "expired" | "unknown"; label: string; detail: string } {
  if (!plan || !isIsoDate(today)) return { state: "unknown", label: "Needs verification", detail: "A source-backed passport expiry is needed for the date check." };
  if (plan.conflict) return { state: "attention", label: "Review passport dates", detail: "Recorded expiry sources disagree." };
  if (plan.record.issued_on > today || plan.record.recorded_on > today) return { state: "unknown", label: "Check source dates", detail: "The issue or evidence date is in the future." };
  if (today >= plan.record.expires_on) return { state: "expired", label: "Expired", detail: "The recorded expiry date has been reached." };
  if (today >= plan.travel_review_on) return { state: "attention", label: "Renew before travel", detail: "Six months or less remain before recorded expiry." };
  return { state: "ready", label: "Ready to travel", detail: "Passport date check: more than six months remain. Check the dates and requirements of your planned trip." };
}
