import { isIsoDate } from "./credential-record.ts";
import { parseEvidenceSummary } from "./document-evidence.ts";
import { safeDriveLink } from "./drive-reference.ts";
import { monthsBefore } from "./passport-renewal.ts";
export type AnnualReviewRecord = {
  version: 1; review_kind: "medical" | "dental"; completed_on: string; completion_confirmed: boolean;
  provider: string; clinician_feedback: "reassuring_owner_report" | null; archive_state: "partial" | "complete" | "appointment_confirmation";
  missing_items: string[]; cleaning_completed: boolean | null; treatment_ongoing: boolean | null;
  next_review_on: string; recorded_on: string; source_note: string;
};
export type AnnualReviewDocument = { id: string; document_type: string; status: string; source_url: string | null; evidence_summary: unknown; annual_review_record?: unknown; archive_folder_url?: unknown };
export type AnnualReviewPlan = { record: AnnualReviewRecord; source_url: string; archive_url: string | null; document_id: string; remind_on: string; conflict: boolean };
function text(v: unknown,max: number): v is string { return typeof v === "string" && v.trim() === v && v.length > 0 && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v); }
export function parseAnnualReview(value: unknown): AnnualReviewRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v=value as Record<string,unknown>;
  const keys=["version","review_kind","completed_on","completion_confirmed","provider","clinician_feedback","archive_state","missing_items","cleaning_completed","treatment_ongoing","next_review_on","recorded_on","source_note"];
  if(Object.keys(v).length!==keys.length || keys.some(key=>!Object.hasOwn(v,key)) || v.version!==1 || !["medical","dental"].includes(String(v.review_kind)) ||
    !isIsoDate(v.completed_on) || !isIsoDate(v.next_review_on) || !isIsoDate(v.recorded_on) || v.next_review_on<=v.completed_on || typeof v.completion_confirmed!=="boolean" ||
    !text(v.provider,120) || !(v.clinician_feedback===null || v.clinician_feedback==="reassuring_owner_report") || !["partial","complete","appointment_confirmation"].includes(String(v.archive_state)) ||
    !Array.isArray(v.missing_items) || v.missing_items.length>10 || v.missing_items.some(item=>!text(item,250)) ||
    !(v.cleaning_completed===null || typeof v.cleaning_completed==="boolean") || !(v.treatment_ongoing===null || typeof v.treatment_ongoing==="boolean") || !text(v.source_note,300))return null;
  if(v.archive_state==="complete" && v.missing_items.length>0 || v.review_kind==="medical" && v.cleaning_completed!==null)return null;
  return v as AnnualReviewRecord;
}
export function latestAnnualReview(documents: AnnualReviewDocument[],kind: "medical"|"dental"): AnnualReviewPlan | undefined {
  const plans: AnnualReviewPlan[]=[];
  for(const doc of documents){
    const record=parseAnnualReview(doc.annual_review_record),summary=parseEvidenceSummary(doc.evidence_summary),source_url=safeDriveLink(doc.source_url);
    if(doc.document_type!=="medical_evidence" || doc.status==="ARCHIVED" || !record || record.review_kind!==kind || !source_url || summary?.category!=="medical" || summary.role!=="primary" ||
      summary.fields.filter(field=>field.label==="Review date" && field.value===record.completed_on).length!==1)continue;
    plans.push({record,source_url,archive_url:safeDriveLink(doc.archive_folder_url),document_id:doc.id,remind_on:monthsBefore(record.next_review_on,1),conflict:false});
  }
  plans.sort((a,b)=>b.record.completed_on.localeCompare(a.record.completed_on));const current=plans[0];if(!current)return undefined;
  return {...current,conflict:plans.some(p=>p.record.completed_on===current.record.completed_on && (p.record.completion_confirmed!==current.record.completion_confirmed || p.record.next_review_on!==current.record.next_review_on || p.record.cleaning_completed!==current.record.cleaning_completed))};
}
export function annualReviewStatus(plan: AnnualReviewPlan | undefined,today: string){
  if(!plan || !isIsoDate(today))return {state:"unknown",label:"Needs confirmation"};
  if(plan.conflict)return {state:"attention",label:"Review records"};
  if(!plan.record.completion_confirmed || plan.record.completed_on>today || plan.record.recorded_on>today)return {state:"unknown",label:"Needs confirmation"};
  if(today>=plan.record.next_review_on)return {state:"attention",label:"Review due"};
  if(plan.record.review_kind==="dental" && plan.record.cleaning_completed!==true)return {state:"attention",label:"Exam recorded · cleaning unconfirmed"};
  return {state:"ready",label:plan.record.review_kind==="dental"?"Exam & cleaning completed":"Review completed"};
}
