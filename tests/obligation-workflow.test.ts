import assert from "node:assert/strict";
import test from "node:test";
// Node's type stripping runs this without adding a test framework dependency.
// @ts-ignore Node runs source files directly.
import { classifyObligation, visibleObligations, obligationStatusLabel } from "../lib/obligation-workflow.ts";
const now = Date.parse("2026-10-08T00:00:00Z");
const record = (status: string, attention = true, due: string | null = null) =>
  ({ status, requires_owner_attention: attention, due_at: due });
test("waiting and deferred work never inflate owner-action counts", () => {
  for (const state of ["WAITING", "WAITING_ON", "DEFERRED", "COMPLETED", "ARCHIVED"]) {
    assert.equal(classifyObligation(record(state), now).requires, false);
  }
  assert.equal(classifyObligation(record("ATTENTION"), now).requires, true);
  assert.equal(classifyObligation(record("ATTENTION", false), now).requires, false);
});
test("completed and archived records do not produce deadline alerts", () => {
  for (const state of ["COMPLETED", "ARCHIVED"]) {
    assert.equal(classifyObligation(record(state, true, "2026-10-07"), now).overdue, false);
    assert.equal(classifyObligation(record(state, true, "2026-10-09"), now).soon, false);
  }
});
test("deferral does not hide a genuine overdue deadline", () => {
  assert.equal(classifyObligation(record("DEFERRED", false, "2026-10-07"), now).overdue, true);
  assert.equal(classifyObligation(record("SCHEDULED", false), now).soon, false);
  assert.equal(classifyObligation(record("ATTENTION", true, "not-a-date"), now).overdue, false);
});
test("completed work is available through its filter and excluded from the active list", () => {
  const records = [record("ATTENTION"), record("WAITING_ON"), record("COMPLETED"), record("ARCHIVED")];
  assert.equal(visibleObligations(records, null, now).length, 2);
  assert.equal(visibleObligations(records, "completed", now).length, 1);
  assert.equal(visibleObligations(records, "waiting", now).length, 1);
});
test("legacy records retain honest labels without invented schedules or assignments", () => {
  assert.equal(obligationStatusLabel("UPCOMING"), "Upcoming");
  assert.equal(obligationStatusLabel("ATTENTION", false), "Needs Review");
  assert.equal(obligationStatusLabel("DEFERRED"), "Deferred / Awaiting Funding");
});
