import assert from "node:assert/strict";
import test from "node:test";
import { parseCredentialSource, credentialEvidenceByEntity, type CredentialEvidenceDocument } from "../lib/credential-evidence.ts";

const record = { version: 1, credential_type: "driver_license", issuer: "Example authority", issued_on: null, expires_on: "2033-03-01", last_four: "1234", recorded_on: "2026-01-01", source_note: "Example supplied card", restrictions: [] };
const owner = { version: 1, credential_type: "driver_license", issuer: "Example authority", last_four: null, expires_on: null, reminder_on: null, record_state: "needs_review", source_note: "Example inventory", recorded_at: "2026-01-01" };
const entity = { id: "credential", subtype: "credential", credential_record: owner, credential_group: null };
const document: CredentialEvidenceDocument = { id: "front", document_type: "credential_evidence", status: "NEEDS_REVIEW", source_url: "https://drive.google.com/file/d/ExampleCredentialPhoto123/view", credential_source_record: record, evidence_summary: { version: 1, category: "credential", bundle_id: "00000000-0000-0000-0000-000000000001", role: "primary", extracted_on: "2026-01-01", fields: [{ label: "Expiry date", value: record.expires_on, source: "Example photo" }], notes: [], sources: [] } };
const link = { document_id: "front", entity_id: "credential", obligation_id: null };
test("credential source preserves unknown issue dates and rejects full identifiers or impossible dates", () => {
  assert.ok(parseCredentialSource(record));
  for (const invalid of [{ ...record, full_number: "PRIVATE" }, { ...record, last_four: "123456" }, { ...record, expires_on: "2031-02-29" }, { ...record, issued_on: "2034-01-01" }]) assert.equal(parseCredentialSource(invalid), null);
});
test("only an active primary source linked to the matching credential type supplies expiry", () => {
  assert.equal(credentialEvidenceByEntity([entity], [document], [link]).get(entity.id)?.record.expires_on, record.expires_on);
  for (const bad of [{ ...document, status: "ARCHIVED" }, { ...document, document_type: "passport_evidence" }, { ...document, source_url: "https://example.com/photo" }, { ...document, evidence_summary: { ...document.evidence_summary as object, role: "supporting" } }]) assert.equal(credentialEvidenceByEntity([entity], [bad], [link]).size, 0);
  assert.equal(credentialEvidenceByEntity([{ ...entity, credential_record: { ...owner, credential_type: "national_id" } }], [document], [link]).size, 0);
  assert.equal(credentialEvidenceByEntity([entity], [document], [{ ...link, obligation_id: "other" }]).size, 0);
});
test("legacy CAAP bundle source can be labelled pilot licence without changing the saved owner type or medical record", () => {
  const caap = { ...entity, credential_record: { ...owner, credential_type: "other", issuer: "Philippines · CAAP" }, credential_group: "philippines_ppl" };
  const source = { ...document, credential_source_record: { ...record, credential_type: "pilot_license", restrictions: ["Current Class 2 medical required"] } };
  assert.equal(credentialEvidenceByEntity([caap], [source], [link]).get(entity.id)?.record.credential_type, "pilot_license");
  assert.equal(credentialEvidenceByEntity([{ ...caap, credential_record: { ...caap.credential_record, issuer: "Philippines · NTC" } }], [source], [link]).size, 0);
  assert.equal(credentialEvidenceByEntity([{ ...caap, credential_group: null }], [source], [link]).size, 0);
  assert.equal(caap.credential_record.credential_type, "other");
});
test("owner/source or multiple-source expiry and suffix conflicts stay visible for review", () => {
  const changed = { ...document, id: "replacement", credential_source_record: { ...record, last_four: "9999" } };
  assert.equal(credentialEvidenceByEntity([entity], [document, changed], [link, { ...link, document_id: "replacement" }]).get(entity.id)?.conflict, true);
  assert.equal(credentialEvidenceByEntity([{ ...entity, credential_record: { ...owner, expires_on: "2034-01-01" } }], [document], [link]).get(entity.id)?.conflict, true);
});
test("back-image links require one safe matching bundle and the same credential association", () => {
  const back = { ...document, id: "back", source_url: "https://drive.google.com/file/d/ExampleCredentialBack123/view", credential_source_record: null, evidence_summary: { ...document.evidence_summary as object, role: "supporting" } };
  const backLink = { ...link, document_id: "back" };
  assert.equal(credentialEvidenceByEntity([entity], [document, back], [link, backLink]).get(entity.id)?.back_source_url, back.source_url);
  assert.equal(credentialEvidenceByEntity([entity], [document, back], [link, { ...backLink, entity_id: "other" }]).get(entity.id)?.back_source_url, null);
  assert.equal(credentialEvidenceByEntity([entity], [document, { ...back, source_url: "https://example.com/back" }], [link, backLink]).get(entity.id)?.back_source_url, null);
});

test("Asturias boating card is recognized as a private source-backed licence without extending professional privileges", () => {
  const boating = { ...record, credential_type: "boating_license", issuer: "Gobierno del Principado de Asturias", issued_on: "2022-09-20", expires_on: "2032-09-20", last_four: "1276", restrictions: ["Recreational only; not a professional or charter authorization"] };
  const holder = { ...entity, credential_record: { ...owner, credential_type: "boating_license", issuer: boating.issuer, last_four: "1276", expires_on: "2032-09-20", reminder_on: "2032-03-20" }, credential_group: "boating_licenses" };
  const pdf = { ...document, source_url: "https://drive.google.com/file/d/ExampleBoatingCertificate123/view", status: "VERIFIED", credential_source_record: boating, evidence_summary: { ...document.evidence_summary as object, fields: [{ label: "Expiry date", value: "2032-09-20", source: "Official Asturias card" }] } };
  assert.equal(parseCredentialSource(boating)?.credential_type, "boating_license");
  const displayed = credentialEvidenceByEntity([holder], [pdf], [link]).get(entity.id);
  assert.equal(displayed?.record.expires_on, "2032-09-20");
  assert.equal(displayed?.record.last_four, "1276");
  assert.equal(displayed?.conflict, false);
  assert.equal(credentialEvidenceByEntity([{ ...holder, credential_record: { ...holder.credential_record, credential_type: "pilot_license" } }], [pdf], [link]).size, 0);
});
