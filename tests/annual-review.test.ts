import test from "node:test";
import assert from "node:assert/strict";
import {parseAnnualReview,latestAnnualReview,annualReviewStatus} from "../lib/annual-review.ts";
import {parseDentalTreatment,dentalTreatmentFromDocument} from "../lib/dental-treatment.ts";
const record={version:1,review_kind:"medical",completed_on:"2025-05-20",completion_confirmed:true,provider:"Example clinic",clinician_feedback:"reassuring_owner_report",archive_state:"partial",missing_items:["Remaining report pages"],cleaning_completed:null,treatment_ongoing:null,next_review_on:"2026-05-20",recorded_on:"2025-05-21",source_note:"Example source with owner confirmation"};
const doc={id:"example",document_type:"medical_evidence",status:"NEEDS_REVIEW",source_url:"https://drive.google.com/file/d/ExampleMedicalReview123/view",annual_review_record:record,evidence_summary:{version:1,category:"medical",bundle_id:"00000000-0000-0000-0000-000000000001",role:"primary",extracted_on:"2025-05-21",fields:[{label:"Review date",value:record.completed_on,source:"Example record"}],notes:[],sources:[]}};
test("review model rejects clinical certification, identifiers and impossible or inconsistent dates",()=>{
 assert.ok(parseAnnualReview(record));
 for(const v of [{...record,all_clear:true},{...record,patient_id:"PRIVATE"},{...record,completed_on:"2025-02-29"},{...record,next_review_on:"2024-01-01"},{...record,archive_state:"complete"}])assert.equal(parseAnnualReview(v),null);
});
test("green means completed cycle even while the archive is partial; planned date changes attention",()=>{
 const plan=latestAnnualReview([doc],"medical")!;assert.equal(plan.remind_on,"2026-04-20");
 assert.equal(annualReviewStatus(plan,"2026-04-20").label,"Review completed");assert.equal(plan.record.archive_state,"partial");
 assert.equal(annualReviewStatus(plan,"2026-05-20").label,"Review due");
});
test("unconfirmed, future and conflicting reviews cannot turn green",()=>{
 const plan=latestAnnualReview([doc],"medical")!;
 for(const v of [{...plan,conflict:true},{...plan,record:{...plan.record,completion_confirmed:false}},{...plan,record:{...plan.record,completed_on:"2027-01-01"}},{...plan,record:{...plan.record,recorded_on:"2027-01-01"}}])assert.notEqual(annualReviewStatus(v,"2025-06-01").state,"ready");
 assert.equal(latestAnnualReview([doc,{...doc,id:"other",annual_review_record:{...record,next_review_on:"2026-04-20"}}],"medical")?.conflict,true);
});
test("unsafe, archived, wrong-kind and mismatched sources cannot establish completion",()=>{
 for(const v of [{...doc,status:"ARCHIVED"},{...doc,source_url:"https://evil.example"},{...doc,document_type:"passport_evidence"},{...doc,evidence_summary:{...doc.evidence_summary,fields:[{label:"Review date",value:"2024-01-01",source:"Example"}]}}])assert.equal(latestAnnualReview([v],"medical"),undefined);
 assert.equal(latestAnnualReview([doc],"dental"),undefined);
});
test("dental cleaning and open treatment remain distinct from the completed examination",()=>{
 const dental={...doc,annual_review_record:{...record,review_kind:"dental",clinician_feedback:null,archive_state:"appointment_confirmation",missing_items:[],cleaning_completed:true,treatment_ongoing:true}};
 const plan=latestAnnualReview([dental],"dental")!;assert.equal(annualReviewStatus(plan,"2025-06-01").state,"ready");assert.equal(plan.record.treatment_ongoing,true);
 assert.equal(annualReviewStatus({...plan,record:{...plan.record,cleaning_completed:null}},"2025-06-01").state,"attention");
});
test("newer reviews supersede older planning dates",()=>{
 const newer={...doc,id:"new",annual_review_record:{...record,completed_on:"2026-05-20",next_review_on:"2027-05-20"},evidence_summary:{...doc.evidence_summary,fields:[{label:"Review date",value:"2026-05-20",source:"Example new review"}]}};
 assert.equal(latestAnnualReview([doc,newer],"medical")?.record.next_review_on,"2027-05-20");
});
test("treatment only records start times; it cannot silently introduce duration or completed status",()=>{
 const treatment={version:1,kind:"root_canal",provider:"Example dentist",referring_provider:"Example referrer",location:"Example clinic",recorded_on:"2025-05-20",source_note:"Example confirmation",appointments:[{starts_at:"2025-05-24T14:15:00+08:00",calendar_url:null}]};
 assert.ok(parseDentalTreatment(treatment));
 for(const v of [{...treatment,completed:true},{...treatment,appointments:[{...treatment.appointments[0],ends_at:"2025-05-24T15:15:00+08:00"}]},{...treatment,appointments:[{...treatment.appointments[0],starts_at:"2025-05-24T25:15:00+08:00"}]}])assert.equal(parseDentalTreatment(v),null);
 const source={...doc,dental_treatment_record:treatment,evidence_summary:{...doc.evidence_summary,fields:[{label:"Record date",value:treatment.recorded_on,source:"Example"}]}};
 assert.ok(dentalTreatmentFromDocument(source));assert.equal(dentalTreatmentFromDocument({...source,status:"ARCHIVED"}),null);assert.equal(dentalTreatmentFromDocument({...source,source_url:"https://evil.example"}),null);
});
