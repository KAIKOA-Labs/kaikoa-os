import assert from "node:assert/strict";
import test from "node:test";
import { leasePosition, leasesByEntity, manilaDate, parseLeaseRecord, type LeaseRecord } from "../lib/lease-record.ts";
function record():LeaseRecord { return {version:1,currency:"PHP",tenant:"Example tenant",unit:"Example unit",location:"Example city",starts_on:"2026-01-01",ends_on:"2027-12-31",execution_evidence:"signed_copy",cadence:"annual",payment_method:"EFT",deposit_amount:null,rent_periods:[{from:"2026-01-01",through:"2026-12-31",monthly_amount:"100",instalment_amount:"1200"},{from:"2027-01-01",through:"2027-12-31",monthly_amount:"110",instalment_amount:"1320"}],payments:[{due_on:"2026-01-01",trigger:null,amount:"1200",period_from:"2026-01-01",period_through:"2026-12-31",receipt_status:"unverified"},{due_on:"2027-01-01",trigger:null,amount:"1320",period_from:"2027-01-01",period_through:"2027-12-31",receipt_status:"unverified"}],renewal_notice_days:30,renewal_note:"Option exercise unknown",termination_note:"Written notice required"}; }
const summary={version:1,category:"lease",bundle_id:"00000000-0000-0000-0000-000000000001",role:"primary",extracted_on:"2026-01-01",fields:[],notes:[],sources:[]};
test("scheduled rent changes on its source date; past dates never imply receipts or arrears",()=>{
 const r=record();assert.ok(parseLeaseRecord(r));
 assert.equal(leasePosition(r,"2026-12-31").rent?.monthly_amount,"100");
 assert.equal(leasePosition(r,"2027-01-01").rent?.monthly_amount,"110");
 assert.equal(leasePosition(r,"2026-12-31").next?.due_on,"2027-01-01");
 assert.equal(leasePosition(r,"2027-01-01").next?.due_on,"2027-01-01");
 assert.equal(leasePosition(r,"2028-01-01").rent,null);assert.equal(leasePosition(r,"2028-01-01").next,null);
 assert.equal(leasePosition(r,"2026-02-31").next,null);assert.equal(r.payments[0].receipt_status,"unverified");
 assert.equal(manilaDate(new Date("2026-12-31T16:00:00Z")),"2027-01-01");
});
test("reject malformed, overlapping, incomplete, inconsistent-money and invented receipt data",()=>{
 const r=record();
 for(const bad of [{...r,version:2},{...r,currency:"USD"},{...r,ends_on:"2027-02-31"},{...r,deposit_amount:"-1"},{...r,rent_periods:[r.rent_periods[0]]},{...r,rent_periods:[r.rent_periods[0],{...r.rent_periods[1],from:"2026-12-31"}]},{...r,rent_periods:[{...r.rent_periods[0],monthly_amount:"99"},r.rent_periods[1]]},{...r,payments:[{...r.payments[0],receipt_status:"paid"},r.payments[1]]},{...r,payments:[r.payments[0],{...r.payments[1],due_on:"2027-01-02"}]},{...r,current_occupancy:true}]) assert.equal(parseLeaseRecord(bad),null);
 const signing={...r,payments:[{...r.payments[0],due_on:null,trigger:"Upon signing"},r.payments[1]]};assert.ok(parseLeaseRecord(signing));assert.equal(leasePosition(signing,"2025-12-01").next?.due_on,"2027-01-01");
});
test("only one safe active linked primary can project property terms; conflict and wrong sources fail closed",()=>{
 const row={id:"source",document_type:"property_lease",status:"NEEDS_REVIEW",source_url:"https://drive.google.com/file/d/EXAMPLE_SOURCE_ID/view",evidence_summary:summary,lease_record:record()};const links=[{document_id:"source",entity_id:"property"}];
 assert.equal(leasesByEntity([row],links).get("property")?.unit,"Example unit");
 for(const bad of [{...row,status:"ARCHIVED"},{...row,document_type:"property_lease_schedule"},{...row,source_url:"https://evil.test/source"},{...row,evidence_summary:{...summary,role:"supporting"}},{...row,evidence_summary:{...summary,category:"insurance"}},{...row,lease_record:{...record(),version:2}}]) assert.equal(leasesByEntity([bad],links).size,0);
 assert.equal(leasesByEntity([row],[]).size,0);
 assert.equal(leasesByEntity([row,{...row,id:"conflict"}],[...links,{document_id:"conflict",entity_id:"property"}]).size,0);
});
