import test from "node:test";
import assert from "node:assert/strict";
import { credentialFromMetadata, renewalAttention } from "../lib/credential-record.ts";

const fixture = {
  version: 1, credential_type: "passport", issuer: "Spain", last_four: "0805",
  expires_on: "2029-11-18", reminder_on: "2029-10-19", record_state: "needs_review",
  source_note: "Source tracker; verify against current document.", recorded_at: "2026-10-10T00:00:00Z",
};

test("credential metadata accepts only masked four digit suffixes and valid dates", () => {
  assert.equal(credentialFromMetadata(fixture)?.last_four, "0805");
  assert.equal(credentialFromMetadata({ ...fixture, last_four: "XDD490805" }), null);
  assert.equal(credentialFromMetadata({ ...fixture, last_four: "805" }), null);
  assert.equal(credentialFromMetadata({ ...fixture, expires_on: "2029-02-30" }), null);
  assert.equal(credentialFromMetadata({ ...fixture, reminder_on: "2029-12-01" }), null);
});

test("renewal labels preserve unknown and review states without asserting validity", () => {
  const record = credentialFromMetadata(fixture)!;
  assert.equal(renewalAttention(record, "2030-01-01"), "Recorded expiry passed · verify");
  assert.equal(renewalAttention({ ...record, expires_on: null, reminder_on: null }, "2026-10-10"), "No expiry recorded");
  assert.equal(renewalAttention({ ...record, reminder_on: "2026-10-10" }, "2026-10-10"), "Reminder date reached");
  assert.equal(renewalAttention({ ...record, record_state: "in_progress" }, "2026-10-10"), "In progress");
});
