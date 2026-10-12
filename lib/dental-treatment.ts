import { isIsoDate } from "./credential-record.ts";
import { safeCalendarLink } from "./renewal-notifications.ts";
import { parseEvidenceSummary } from "./document-evidence.ts";
import { safeDriveLink } from "./drive-reference.ts";
export type DentalTreatment = { version: 1; kind: "root_canal"; provider: string; referring_provider: string; location: string; recorded_on: string; source_note: string; appointments: {starts_at:string;calendar_url:string|null}[] };
export function parseDentalTreatment(value: unknown): DentalTreatment|null {
  if(!value || typeof value!=="object" || Array.isArray(value))return null;
  const v=value as Record<string,unknown>;const keys=["version","kind","provider","referring_provider","location","recorded_on","source_note","appointments"];
  if(Object.keys(v).length!==keys.length || keys.some(k=>!Object.hasOwn(v,k)) || v.version!==1 || v.kind!=="root_canal" || !isIsoDate(v.recorded_on) || !Array.isArray(v.appointments) || v.appointments.length<1 || v.appointments.length>8)return null;
  for(const key of ["provider","referring_provider","location","source_note"]){const s=v[key];if(typeof s!=="string" || !s.trim() || s.length>300 || /[\u0000-\u001f\u007f]/.test(s))return null;}
  for(const a of v.appointments){if(!a || typeof a!=="object" || Array.isArray(a) || Object.keys(a).length!==2 || typeof a.starts_at!=="string" || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\+08:00$/.test(a.starts_at) || !isIsoDate(a.starts_at.slice(0,10)) || !(a.calendar_url===null || safeCalendarLink(a.calendar_url)))return null;}
  if(new Set(v.appointments.map(a=>a.starts_at)).size!==v.appointments.length)return null;
  return v as DentalTreatment;
}
export function dentalTreatmentFromDocument(doc: {document_type:string;status:string;source_url:string|null;evidence_summary:unknown;dental_treatment_record?:unknown}): DentalTreatment|null {
  const record=parseDentalTreatment(doc.dental_treatment_record),summary=parseEvidenceSummary(doc.evidence_summary);
  return doc.document_type==="medical_evidence" && doc.status!=="ARCHIVED" && safeDriveLink(doc.source_url) && record && summary?.category==="medical" && summary.role==="primary" && summary.fields.filter(f=>f.label==="Record date" && f.value===record.recorded_on).length===1 ? record : null;
}
