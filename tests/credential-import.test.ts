import test from "node:test";
import assert from "node:assert/strict";
import { credentialSlug, parseCredentialImport, runCredentialImport, type CredentialImportAdapter, type CredentialImportRow, type ExistingCredential } from "../lib/credential-import.ts";

const row: CredentialImportRow = { name: "Example credential Alpha", credential_type: "other", issuer: null, last_four: null, expires_on: null, reminder_on: null, record_state: "needs_review", source_note: "Example inventory awaiting verification." };
const encode = (records: unknown[]) => JSON.stringify({ version: 1, records });
const id = "11111111-2222-3333-4444-555555555555";
function stored(input: CredentialImportRow): ExistingCredential {
  const { name, ...record } = input;
  return { id, slug: credentialSlug(name), subtype: "credential", status: "REVIEW REQUIRED", credential_record: { ...record, version: 1, recorded_at: "2026-10-10T00:00:00Z" } };
}
function harness() {
  const entries = new Map<string, ExistingCredential>();
  let writes = 0;
  const adapter: CredentialImportAdapter = {
    checkSession: async () => {},
    findBySlug: async slug => entries.get(slug) ?? null,
    create: async input => { writes++; entries.set(credentialSlug(input.name), stored(input)); return id; },
    readById: async () => [...entries.values()].at(-1) ?? null,
  };
  return { adapter, entries, writes: () => writes };
}
test("import preserves unknowns, trims text, and never confirms validity", () => {
  const [actual] = parseCredentialImport(encode([{ ...row, name: ` ${row.name} `, source_note: ` ${row.source_note} ` }]));
  assert.deepEqual(actual, row);
  assert.equal(credentialSlug("Example  /  Credential"), "example-credential");
});
test("import rejects secret/full-number fields, inherited types and invalid source dates before writing", () => {
  for (const change of [{ document_number: "example" }, { password: "example" }, { last_four: "ABC1234567" }, { name: "Example 12345678" },
    { issuer: "Example 12345678" }, { source_note: "Example 12345678" }, { credential_type: "toString" }, { record_state: "owner_confirmed" },
    { expires_on: "2028-02-30" }, { reminder_on: "2028-01-01" }, { expires_on: "2028-01-01", reminder_on: "2028-01-02" }]) {
    assert.throws(() => parseCredentialImport(encode([{ ...row, ...change }])));
  }
  assert.throws(() => parseCredentialImport(JSON.stringify({ version: 1, records: [row], unexpected: "value" })));
  assert.throws(() => parseCredentialImport(encode([])));
  assert.throws(() => parseCredentialImport("x".repeat(65537)));
  assert.throws(() => parseCredentialImport(encode([{ ...row, source_note: "é".repeat(1000), name: "💡".repeat(120) }])));
});
test("import rejects duplicate normalized names and requires every field", () => {
  assert.throws(() => parseCredentialImport(encode([row, { ...row, name: "Example-credential-alpha" }])));
  const { last_four: _suffix, ...incomplete } = row;
  assert.throws(() => parseCredentialImport(encode([incomplete])));
});
test("confirmed saved details are read back and identical retry skips the write", async () => {
  const h = harness(); const updates: unknown[] = [];
  assert.deepEqual(await runCredentialImport([row], h.adapter, value => updates.push(value)), { added: 1, skipped: 0, total: 1 });
  assert.deepEqual(await runCredentialImport([row], h.adapter, () => {}), { added: 0, skipped: 1, total: 1 });
  assert.equal(h.writes(), 1); assert.equal(updates.length, 1);
});
test("archived, conflicting and unrelated names never get overwritten or skipped as matches", async () => {
  for (const change of [{ status: "ARCHIVED" }, { subtype: "other" }, { credential_record: { ...stored(row).credential_record as object, issuer: "Different issuer" } }]) {
    const h = harness(); h.entries.set(credentialSlug(row.name), { ...stored(row), ...change });
    await assert.rejects(runCredentialImport([row], h.adapter, () => {}), /different details/);
    assert.equal(h.writes(), 0);
  }
});
test("partial save failure stops the batch and retry only adds the missing rows", async () => {
  const h = harness(); const second = { ...row, name: "Example credential Beta" }; const third = { ...row, name: "Example credential Gamma" };
  const create = h.adapter.create;
  h.adapter.create = async input => { if (input.name === second.name) throw new Error("connection lost"); return create(input); };
  await assert.rejects(runCredentialImport([row, second, third], h.adapter, () => {}), /connection lost/);
  assert.equal(h.entries.size, 1);
  h.adapter.create = create;
  assert.deepEqual(await runCredentialImport([row, second, third], h.adapter, () => {}), { added: 2, skipped: 1, total: 3 });
  assert.equal(h.writes(), 3);
});
test("session loss between duplicate check and write stops immediately", async () => {
  const h = harness(); let checks = 0;
  h.adapter.checkSession = async () => { if (++checks === 2) throw new Error("session changed"); };
  await assert.rejects(runCredentialImport([row], h.adapter, () => {}), /session changed/);
  assert.equal(h.writes(), 0);
});
test("an uncertain response or read-back stops before writing the next row", async () => {
  for (const mode of ["uuid", "read", "mismatch"]) {
    const h = harness();
    if (mode === "uuid") h.adapter.create = async () => "unexpected";
    if (mode === "read") h.adapter.readById = async () => null;
    if (mode === "mismatch") h.adapter.readById = async () => stored({ ...row, last_four: "1234" });
    await assert.rejects(runCredentialImport([row, { ...row, name: "Example credential Beta" }], h.adapter, () => {}), /could not be confirmed/);
    assert.ok(h.writes() <= 1);
  }
});
