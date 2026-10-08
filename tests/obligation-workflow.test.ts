import assert from "node:assert/strict";
import test from "node:test";
// Node's type stripping runs this without adding a test framework dependency.
// @ts-ignore Node runs source files directly.
import { classifyObligation, visibleObligations, obligationStatusLabel, obligationDeadline } from "../lib/obligation-workflow.ts";
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

test("Needs Review isolates unassigned attention work without changing deadline alerts", () => {
  const review = record("ATTENTION", false, "2026-10-07");
  const records = [review, record("ATTENTION"), ...["WAITING", "WAITING_ON", "IN_PROGRESS", "SCHEDULED", "DEFERRED", "COMPLETED", "ARCHIVED", "UPCOMING"].map(state => record(state, false))];
  assert.deepEqual(visibleObligations(records, "review", now), [review]);
  assert.equal(classifyObligation(review, now).requires, false);
  assert.equal(classifyObligation(review, now).overdue, true);
  assert.equal(obligationStatusLabel(review.status, review.requires_owner_attention), "Needs Review");
  assert.equal(visibleObligations(records, null, now).includes(review), true);
});

test("deadline display preserves missing/invalid values and renders the same instant in the chosen timezone", () => {
  assert.deepEqual(obligationDeadline(record("ATTENTION", true), now, "UTC"), { label: "No deadline recorded", dateTime: null });
  assert.deepEqual(obligationDeadline(record("ATTENTION", true, "not-a-date"), now, "UTC"), { label: "Deadline needs review", dateTime: null });
  const due = "2026-10-08T23:30:00Z";
  const utc = obligationDeadline(record("ATTENTION", true, due), now, "UTC");
  const manila = obligationDeadline(record("ATTENTION", true, due), now, "Asia/Manila");
  assert.match(utc.label, /Due · 8 Oct 2026, 23:30 UTC/);
  assert.match(manila.label, /Due · 9 Oct 2026, 07:30 GMT\+8/);
  assert.equal(manila.dateTime, utc.dateTime);
  assert.equal(utc.dateTime, "2026-10-08T23:30:00.000Z");
});
test("deadline display marks real overdue work while completed work retains a neutral historical deadline", () => {
  const due = "2026-10-07T00:00:00Z";
  for (const state of ["ATTENTION", "WAITING_ON", "DEFERRED"]) {
    assert.match(obligationDeadline(record(state, false, due), now, "UTC").label, /^Overdue ·/);
  }
  for (const state of ["COMPLETED", "ARCHIVED"]) {
    assert.match(obligationDeadline(record(state, true, due), now, "UTC").label, /^Deadline ·/);
  }
  assert.match(obligationDeadline(record("ATTENTION", true, "2026-10-08T00:00:00Z"), now, "UTC").label, /^Due ·/);
});
