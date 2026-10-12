import { parseEvidenceSummary } from "./document-evidence.ts";
import { safeDriveLink } from "./drive-reference.ts";

export type LeaseRecord = {
  version: 1; currency: "PHP"; tenant: string; unit: string; location: string;
  starts_on: string; ends_on: string; execution_evidence: "signed_copy" | "signed_notarized_copy";
  cadence: "quarterly" | "annual"; payment_method: string; deposit_amount: string | null;
  rent_periods: { from: string; through: string; monthly_amount: string; instalment_amount: string }[];
  payments: { due_on: string | null; trigger: string | null; amount: string; period_from: string; period_through: string; receipt_status: "unverified" }[];
  renewal_notice_days: number; renewal_note: string; termination_note: string;
};
function object(v: unknown): v is Record<string, unknown> { return !!v && typeof v === "object" && !Array.isArray(v); }
function exact(v: Record<string, unknown>, keys: string[]) { return Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k)); }
function text(v: unknown): v is string { return typeof v === "string" && v.trim() === v && v.length > 0 && v.length <= 700 && !/[\u0000-\u001f\u007f]/.test(v); }
function date(v: unknown): v is string { if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false; const d = new Date(v + "T00:00:00Z"); return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === v; }
function money(v: unknown): v is string { return typeof v === "string" && /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(v) && Number(v) > 0; }
function nextDay(v: string) { const d = new Date(v + "T00:00:00Z"); d.setUTCDate(d.getUTCDate()+1); return d.toISOString().slice(0,10); }
export function parseLeaseRecord(v: unknown): LeaseRecord | null {
  if (!object(v) || !exact(v,["version","currency","tenant","unit","location","starts_on","ends_on","execution_evidence","cadence","payment_method","deposit_amount","rent_periods","payments","renewal_notice_days","renewal_note","termination_note"])) return null;
  if (v.version !== 1 || v.currency !== "PHP" || !["tenant","unit","location","payment_method","renewal_note","termination_note"].every(k=>text(v[k])) || !date(v.starts_on) || !date(v.ends_on) || v.starts_on > v.ends_on) return null;
  if (!["signed_copy","signed_notarized_copy"].includes(String(v.execution_evidence)) || !["quarterly","annual"].includes(String(v.cadence)) || (v.deposit_amount !== null && !money(v.deposit_amount)) || !Number.isInteger(v.renewal_notice_days) || Number(v.renewal_notice_days)<1 || Number(v.renewal_notice_days)>365) return null;
  if (!Array.isArray(v.rent_periods) || !v.rent_periods.length || v.rent_periods.length>12 || !Array.isArray(v.payments) || !v.payments.length || v.payments.length>48) return null;
  for (const p of v.rent_periods) if (!object(p) || !exact(p,["from","through","monthly_amount","instalment_amount"]) || !date(p.from) || !date(p.through) || p.from>p.through || p.from<v.starts_on || p.through>v.ends_on || !money(p.monthly_amount) || !money(p.instalment_amount) || Number(p.monthly_amount)*(v.cadence==="quarterly"?3:12)!==Number(p.instalment_amount)) return null;
  const periods = v.rent_periods as LeaseRecord["rent_periods"];
  if (periods[0].from!==v.starts_on || periods.at(-1)!.through!==v.ends_on || periods.some((p,i)=>i>0 && p.from!==nextDay(periods[i-1].through))) return null;
  for (const p of v.payments) {
    if (!object(p) || !exact(p,["due_on","trigger","amount","period_from","period_through","receipt_status"]) || p.receipt_status!=="unverified" || !money(p.amount) || !date(p.period_from) || !date(p.period_through) || p.period_from>p.period_through || (p.due_on===null ? !text(p.trigger) : !date(p.due_on) || p.trigger!==null)) return null;
    const period=periods.find(r=>(p.period_from as string)>=r.from && (p.period_through as string)<=r.through);
    if (!period || p.amount!==period.instalment_amount || (p.due_on!==null && p.due_on!==p.period_from)) return null;
  }
  const payments=v.payments as LeaseRecord["payments"];
  if (payments[0].period_from!==v.starts_on || payments.at(-1)!.period_through!==v.ends_on || payments.some((p,i)=>i>0 && p.period_from!==nextDay(payments[i-1].period_through))) return null;
  return v as LeaseRecord;
}
export function manilaDate(now = new Date()): string { const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now); return ["year","month","day"].map(k=>parts.find(p=>p.type===k)!.value).join("-"); }
export function leasePosition(record: LeaseRecord, today = manilaDate()) {
  if (!date(today)) return { rent: null, next: null };
  return { rent: record.rent_periods.find(p=>p.from<=today && today<=p.through)??null, next: record.payments.find(p=>p.due_on!==null && p.due_on>=today)??null };
}
export function leaseMoney(amount: string) { return "₱" + Number(amount).toLocaleString("en-PH",{maximumFractionDigits:2}); }
export function leaseDate(value: string) { return new Date(value+"T00:00:00Z").toLocaleDateString("en-GB",{timeZone:"UTC",day:"numeric",month:"short",year:"numeric"}); }
export type LeaseEvidenceRow = { id: string; document_type: string; status: string; source_url: string | null; evidence_summary: unknown; lease_record: unknown };
export function leasesByEntity(rows: LeaseEvidenceRow[], links: {document_id:string;entity_id:string|null}[]): Map<string,LeaseRecord> {
  const candidates=new Map<string,(LeaseRecord|null)[]>();
  for (const row of rows) {
    if (row.document_type!=="property_lease" || row.status==="ARCHIVED") continue;
    const summary=parseEvidenceSummary(row.evidence_summary);
    const record=safeDriveLink(row.source_url) && summary?.category==="lease" && summary.role==="primary" ? parseLeaseRecord(row.lease_record) : null;
    for (const id of new Set(links.filter(l=>l.document_id===row.id && l.entity_id).map(l=>l.entity_id!))) candidates.set(id,[...(candidates.get(id)??[]),record]);
  }
  return new Map([...candidates].filter(([,v])=>v.length===1 && v[0]!==null).map(([id,v])=>[id,v[0]!]));
}
