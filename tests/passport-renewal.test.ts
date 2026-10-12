import assert from "node:assert/strict";
import test from "node:test";
import { monthsBefore, parsePassportRecord, passportPlansByEntity, passportAttention, passportReadiness, type PassportDocument } from "../lib/passport-renewal.ts";

const record = { version: 1, issued_on: "2020-01-01", expires_on: "2032-08-31", recorded_on: "2026-01-01", source_note: "Example supplied passport photo", notification: { provider: "chatgpt_tasks", task_id: "a".repeat(32), configured_on: "2026-01-01" } };
const credential = { version: 1, credential_type: "passport", issuer: null, last_four: null, expires_on: null, reminder_on: null, record_state: "needs_review", source_note: "Example credential", recorded_at: "2026-01-01" };
const entities = [{ id: "passport", subtype: "credential", credential_record: credential }, { id: "car", subtype: "vehicle", credential_record: credential }];
const document: PassportDocument = { id: "photo", document_type: "passport_evidence", status: "NEEDS_REVIEW", source_url: "https://drive.google.com/file/d/ExamplePassportPhoto123/view", passport_record: record, evidence_summary: { version: 1, category: "passport", bundle_id: "00000000-0000-0000-0000-000000000001", role: "primary", extracted_on: "2026-01-01", fields: [{ label: "Expiry date", value: record.expires_on, source: "Example photo" }], notes: [], sources: [] } };
const link = { document_id: "photo", entity_id: "passport", obligation_id: null };

test("renewal policy uses calendar months with clamped month ends and leap days", () => {
  assert.equal(monthsBefore("2032-08-31", 6), "2032-02-29");
  assert.equal(monthsBefore("2031-08-31", 6), "2031-02-28");
  assert.equal(monthsBefore("2032-08-31", 9), "2031-11-30");
  assert.throws(() => monthsBefore("2031-02-29", 6));
});
test("source model rejects private identifier fields, impossible dates and unsupported notification declarations", () => {
  assert.ok(parsePassportRecord(record));
  for (const invalid of [{ ...record, passport_number: "EXAMPLE" }, { ...record, expires_on: "2031-02-29" }, { ...record, issued_on: "2033-01-01" }, { ...record, notification: { ...record.notification, provider: "email" } }]) assert.equal(parsePassportRecord(invalid), null);
});
test("only matching linked passport source dates are projected", () => {
  const plan = passportPlansByEntity(entities, [document], [link]).get("passport")!;
  assert.equal(plan.renew_on, "2031-08-31");
  assert.equal(plan.travel_review_on, "2032-02-29");
  assert.equal(plan.conflict, false);
  for (const doc of [{ ...document, status: "ARCHIVED" }, { ...document, document_type: "vehicle_registration" }, { ...document, source_url: "https://example.com/photo" }, { ...document, evidence_summary: { ...document.evidence_summary as object, fields: [{ label: "Expiry date", value: "2033-01-01", source: "Example photo" }] } }]) assert.equal(passportPlansByEntity(entities, [doc], [link]).size, 0);
  for (const badLink of [{ ...link, entity_id: "car" }, { ...link, obligation_id: "obligation" }, { ...link, document_id: "unrelated" }]) assert.equal(passportPlansByEntity(entities, [document], [badLink]).size, 0);
});
test("conflicting owner/source or two photo dates require review rather than choosing an expiry", () => {
  const changed = { ...document, id: "replacement", passport_record: { ...record, expires_on: "2033-01-01" }, evidence_summary: { ...document.evidence_summary as object, fields: [{ label: "Expiry date", value: "2033-01-01", source: "Example replacement" }] } };
  assert.equal(passportPlansByEntity(entities, [document, changed], [link, { ...link, document_id: "replacement" }]).get("passport")?.conflict, true);
  assert.equal(passportPlansByEntity([{ ...entities[0], credential_record: { ...credential, expires_on: "2033-01-01" } }], [document], [link]).get("passport")?.conflict, true);
});
test("attention distinguishes early renewal, exact six-month threshold, under six months and expiry", () => {
  const plan = passportPlansByEntity(entities, [document], [link]).get("passport")!;
  assert.equal(passportAttention(plan, "2031-08-30"), "Renewal planned before six-month threshold");
  assert.equal(passportAttention(plan, "2031-08-31"), "Renewal window reached");
  assert.equal(passportAttention(plan, "2032-02-29"), "Six months remaining · renew before travel");
  assert.equal(passportAttention(plan, "2032-03-01"), "Under six months remaining · renew before travel");
  assert.equal(passportAttention(plan, "2032-08-31"), "Recorded expiry reached · renew");
  assert.equal(passportAttention({ ...plan, conflict: true }, "2032-01-01"), "Expiry sources disagree · review");
});

test("travel date readiness stays green during the renewal window, then stops at the exact six-month threshold", () => {
  const plan = passportPlansByEntity(entities, [document], [link]).get("passport")!;
  assert.equal(passportReadiness(plan, "2031-08-30").state, "ready");
  assert.equal(passportReadiness(plan, "2031-08-31").state, "ready");
  assert.equal(passportReadiness(plan, "2032-02-28").state, "ready");
  assert.equal(passportReadiness(plan, "2032-02-29").label, "Renew before travel");
  assert.equal(passportReadiness(plan, "2032-03-01").state, "attention");
  assert.equal(passportReadiness(plan, "2032-08-31").state, "expired");
});
test("missing, conflicting, future-issued or future-recorded evidence never shows a green passport", () => {
  const plan = passportPlansByEntity(entities, [document], [link]).get("passport")!;
  assert.equal(passportReadiness(undefined, "2031-01-01").state, "unknown");
  assert.equal(passportReadiness(plan, "not-a-date").state, "unknown");
  assert.equal(passportReadiness({ ...plan, conflict: true }, "2031-01-01").state, "attention");
  assert.equal(passportReadiness({ ...plan, record: { ...plan.record, issued_on: "2031-01-02" } }, "2031-01-01").state, "unknown");
  assert.equal(passportReadiness({ ...plan, record: { ...plan.record, recorded_on: "2031-01-02" } }, "2031-01-01").state, "unknown");
});
