import assert from "node:assert/strict";
import test from "node:test";
import { filterEvidenceGroups, groupEvidence, parseEvidenceSummary, safeGmailSource, type EvidenceRow } from "../lib/document-evidence.ts";
const bundle = "00000000-0000-0000-0000-000000000001";
function summary(role: "primary" | "supporting" = "primary") {
  return { version: 1, category: "insurance", role, bundle_id: bundle, extracted_on: "2026-01-01", fields: [{ label: "Payment arrangement", value: "Automatic instalments", source: "Owner instruction" }, { label: "Next collection", value: null, source: "Not provided" }], notes: [{ kind: "review", text: "Balance remains unknown.", source: "Source comparison" }], sources: [{ label: "Source email", url: "https://mail.google.com/mail/u/0/#all/abcdef0123456789" }] };
}
function row(id: string, value: unknown = summary(), title = "Issued schedule"): EvidenceRow { return { id, title, status: "NEEDS_REVIEW", source_url: null, evidence_summary: value }; }
test("evidence preserves unknown dates/payments and rejects malformed or unsupported summaries", () => {
  assert.equal(parseEvidenceSummary(summary())?.fields[1].value, null);
  for (const bad of [null, [], { ...summary(), version: 2 }, { ...summary(), category: "constructor" }, { ...summary(), extracted_on: "2026-02-31" }, { ...summary(), fields: [...summary().fields, summary().fields[0]] }, { ...summary(), automatic_payment_verified: true }, { ...summary(), notes: [{kind:"review",text:"a\nb",source:"Source"}] }]) assert.equal(parseEvidenceSummary(bad), null);
});
test("source links never accept tokens, arbitrary hosts, credentials or non-message navigation", () => {
  assert.equal(safeGmailSource("https://mail.google.com/mail/u/?authuser=owner%40example.test#all/abcdef0123456789"), "https://mail.google.com/mail/u/?authuser=owner%40example.test#all/abcdef0123456789");
  for (const url of ["javascript:alert(1)", "https://mail.google.com.evil.test/mail/u/0/#all/abcdef0123456789", "https://user:pass@mail.google.com/mail/u/0/#all/abcdef0123456789", "https://mail.google.com:444/mail/u/0/#all/abcdef0123456789", "https://mail.google.com/mail/u/0/?token=secret#all/abcdef0123456789", "https://mail.google.com/mail/u/0/#settings", "https://mail.google.com/mail/u/0/?authuser=a@example.test&authuser=b@example.test#all/abcdef0123456789"]) assert.equal(safeGmailSource(url), null);
});
test("bundle grouping keeps supporting files and search returns the complete evidence set", () => {
  const groups = groupEvidence([row("support",summary("supporting"),"Yacht clauses"), row("primary"), row("legacy",null,"Other file")]);
  assert.equal(groups.length, 2); assert.equal(groups[0].primary.id, "primary"); assert.equal(groups[0].supporting[0].id, "support");
  for (const query of ["clauses", "automatic", "balance"]) { const found = filterEvidenceGroups(groups,query); assert.equal(found.length,1); assert.equal(found[0].supporting.length,1); }
  assert.equal(filterEvidenceGroups(groups,"missing").length,0);
});
test("ambiguous primaries, orphan support and invalid metadata never hide original references", () => {
  for (const rows of [[row("a"),row("b")],[row("orphan",summary("supporting"))],[row("bad",{version:99}),row("good")],[row("a"),row("b",{...summary("supporting"),category:"import"})]]) {
    const groups=groupEvidence(rows);
    assert.deepEqual(new Set(groups.flatMap(g=>[g.primary.id,...g.supporting.map(r=>r.id)])),new Set(rows.map(r=>r.id)));
  }
});
test("owner service notes preserve a missing booking and stay separate from insurance", () => {
  const service = { ...summary(), category: "maintenance", bundle_id: "00000000-0000-0000-0000-000000000002", fields: [{ label: "Next appointment", value: null, source: "Owner has not confirmed a booking" }], sources: [] };
  assert.equal(parseEvidenceSummary(service)?.fields[0].value, null);
  const groups=groupEvidence([row("insurance"),row("service",service,"Annual service owner note")]);
  assert.equal(groups.length,2);
  assert.equal(filterEvidenceGroups(groups,"annual")[0].summary?.category,"maintenance");
});
