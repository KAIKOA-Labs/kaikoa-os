import test from "node:test";
import assert from "node:assert/strict";
import { parseVaccinationRecord, tetanusPlan, tetanusStatus, yearsAfter, type MedicalDocument } from "../lib/medical-record.ts";
import { parseRenewalNotifications, safeCalendarLink } from "../lib/renewal-notifications.ts";
const record = {version:1,vaccine:"tetanus",product:"Example Tdap",dose_on:"2024-02-29",dose_confirmed:true,primary_series_complete:true,recorded_on:"2024-03-01",source_note:"Example invoice and confirmation"};
const doc: MedicalDocument = {id:"dose",title:"Example vaccine",document_type:"medical_evidence",status:"NEEDS_REVIEW",source_url:"https://drive.google.com/file/d/ExampleMedicalPhoto123/view",vaccination_record:record,evidence_summary:{version:1,category:"medical",bundle_id:"00000000-0000-0000-0000-000000000001",role:"primary",extracted_on:"2024-03-01",fields:[{label:"Dose date",value:record.dose_on,source:"Example invoice"}],notes:[],sources:[]}};
test("vaccine evidence rejects identifiers, impossible dates and untyped confirmation",()=>{
 assert.ok(parseVaccinationRecord(record));
 for(const v of [{...record,patient_id:"PRIVATE"},{...record,dose_on:"2023-02-29"},{...record,dose_confirmed:"yes"},{...record,primary_series_complete:1}]) assert.equal(parseVaccinationRecord(v),null);
});
test("calendar-year schedule clamps leap days and five-year wound threshold is not routine expiry",()=>{
 assert.equal(yearsAfter("2024-02-29",10),"2034-02-28");
 assert.equal(yearsAfter("2024-02-29",5),"2029-02-28");
 const plan=tetanusPlan([doc])!;
 assert.equal(plan.remind_on,"2033-11-28");
 assert.equal(tetanusStatus(plan,"2029-02-28").state,"ready");
 assert.equal(tetanusStatus(plan,"2033-11-28").state,"ready");
 assert.equal(tetanusStatus(plan,"2034-02-28").label,"Routine booster due");
});
test("missing, incomplete, unconfirmed, conflicting and future histories do not show green",()=>{
 const plan=tetanusPlan([doc])!;
 assert.equal(tetanusStatus(undefined,"2026-01-01").state,"unknown");
 for(const v of [{...plan,conflict:true},{...plan,record:{...plan.record,dose_confirmed:false}},{...plan,record:{...plan.record,primary_series_complete:null}},{...plan,record:{...plan.record,primary_series_complete:false}},{...plan,record:{...plan.record,dose_on:"2027-01-01"}},{...plan,record:{...plan.record,recorded_on:"2027-01-01"}}]) assert.notEqual(tetanusStatus(v,"2026-01-01").state,"ready");
});
test("archived, wrong-kind, unsafe and mismatched evidence cannot set vaccine dates",()=>{
 for(const v of [{...doc,status:"ARCHIVED"},{...doc,document_type:"passport_evidence"},{...doc,source_url:"https://example.com/medical"},{...doc,evidence_summary:{...doc.evidence_summary as object,fields:[{label:"Dose date",value:"2024-01-01",source:"Example"}]}}]) assert.equal(tetanusPlan([v]),undefined);
});
test("a newer dose supersedes older doses, but conflicting confirmations for the same dose need review",()=>{
 const newer={...doc,id:"new",vaccination_record:{...record,dose_on:"2025-01-01"},evidence_summary:{...doc.evidence_summary as object,fields:[{label:"Dose date",value:"2025-01-01",source:"Example new dose"}]}};
 assert.equal(tetanusPlan([doc,newer])?.record.dose_on,"2025-01-01");
 assert.equal(tetanusPlan([doc,newer])?.conflict,false);
 assert.equal(tetanusPlan([doc,{...doc,id:"contradiction",vaccination_record:{...record,primary_series_complete:false}}])?.conflict,true);
});
test("notification setup keeps receipt unconfirmed and rejects unsafe Calendar URLs",()=>{
 const url="https://www.google.com/calendar/event?eid=ExampleCalendarEvent123";
 const value={version:1,configured_on:"2026-01-01",task_id:"a".repeat(32),calendar_events:[{id:"example123",label:"Routine review",on:"2034-02-28",url}],delivery_confirmed_on:null};
 assert.equal(parseRenewalNotifications(value)?.delivery_confirmed_on,null);
 for(const bad of ["javascript:alert(1)",url+"&token=secret",url.replace("www.google.com","evil.example"),url+"#fragment"]) assert.equal(safeCalendarLink(bad),null);
 assert.equal(parseRenewalNotifications({...value,calendar_events:[{...value.calendar_events[0],url:"https://example.com"}]}),null);
});
