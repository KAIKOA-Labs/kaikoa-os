import { isIsoDate } from "./credential-record.ts";
import { parseEvidenceSummary } from "./document-evidence.ts";
import { safeDriveLink } from "./drive-reference.ts";
import { monthsBefore } from "./passport-renewal.ts";

export type VaccinationRecord = {
  version: 1; vaccine: "tetanus"; product: string; dose_on: string; dose_confirmed: boolean;
  primary_series_complete: boolean | null; recorded_on: string; source_note: string;
};
export type MedicalDocument = { id: string; title: string; document_type: string; status: string; source_url: string | null; vaccination_record: unknown; evidence_summary: unknown };
export type TetanusPlan = { record: VaccinationRecord; source_url: string; document_id: string; due_on: string; remind_on: string; wound_review_on: string; conflict: boolean };
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
export function parseVaccinationRecord(value: unknown): VaccinationRecord | null {
  const keys = ["version", "vaccine", "product", "dose_on", "dose_confirmed", "primary_series_complete", "recorded_on", "source_note"];
  if (!object(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value,key)) || value.version !== 1 || value.vaccine !== "tetanus" ||
    typeof value.product !== "string" || !value.product.trim() || value.product.length > 80 ||
    !isIsoDate(value.dose_on) || !isIsoDate(value.recorded_on) || typeof value.dose_confirmed !== "boolean" ||
    !(typeof value.primary_series_complete === "boolean" || value.primary_series_complete === null) ||
    typeof value.source_note !== "string" || value.source_note.trim() !== value.source_note || value.source_note.length < 4 || value.source_note.length > 300 ||
    /[\u0000-\u001f\u007f]/.test(value.product + value.source_note)) return null;
  return value as VaccinationRecord;
}
export function yearsAfter(date: string, years: number): string {
  if (!isIsoDate(date) || !Number.isInteger(years) || years < 0 || years > 20) throw new Error("Invalid date interval");
  const [year, month, day] = date.split("-").map(Number);
  const last = new Date(Date.UTC(year + years, month, 0)).getUTCDate();
  return `${year + years}-${String(month).padStart(2,"0")}-${String(Math.min(day,last)).padStart(2,"0")}`;
}
export function tetanusPlan(documents: MedicalDocument[]): TetanusPlan | undefined {
  const plans: TetanusPlan[] = [];
  for (const document of documents) {
    const record = parseVaccinationRecord(document.vaccination_record);
    const summary = parseEvidenceSummary(document.evidence_summary);
    const source_url = safeDriveLink(document.source_url);
    if (document.document_type !== "medical_evidence" || document.status === "ARCHIVED" || !record || !source_url || summary?.category !== "medical" || summary.role !== "primary" ||
      summary.fields.filter(field => field.label === "Dose date" && field.value === record.dose_on).length !== 1) continue;
    const due_on = yearsAfter(record.dose_on,10);
    plans.push({ record, source_url, document_id: document.id, due_on, remind_on: monthsBefore(due_on,3), wound_review_on: yearsAfter(record.dose_on,5), conflict: false });
  }
  plans.sort((a,b) => b.record.dose_on.localeCompare(a.record.dose_on));
  const current = plans[0];
  if (!current) return undefined;
  return { ...current, conflict: plans.some(plan => plan.record.dose_on === current.record.dose_on &&
    (plan.record.dose_confirmed !== current.record.dose_confirmed || plan.record.primary_series_complete !== current.record.primary_series_complete)) };
}
export function tetanusStatus(plan: TetanusPlan | undefined, today: string) {
  if (!plan || !isIsoDate(today)) return { state: "unknown", label: "Needs confirmation", detail: "Record the last dose and initial vaccine course." };
  if (plan.conflict) return { state: "attention", label: "Review vaccine history", detail: "Confirmation records for the latest dose disagree." };
  if (plan.record.dose_on > today || plan.record.recorded_on > today) return { state: "unknown", label: "Check source dates", detail: "A recorded date is in the future." };
  if (!plan.record.dose_confirmed || plan.record.primary_series_complete !== true) return { state: "unknown", label: "Confirm vaccine history", detail: "Confirm the dose and completed initial course with your clinician." };
  if (today >= plan.due_on) return { state: "attention", label: "Routine booster due", detail: "The ten-year routine booster date has been reached." };
  return { state: "ready", label: "Up to date", detail: "Routine tetanus schedule based on the last confirmed dose and completed initial course." };
}
export function medicalYear(document: MedicalDocument): string {
  const record = parseVaccinationRecord(document.vaccination_record);
  return record?.dose_on.slice(0,4) ?? "Date needs review";
}
