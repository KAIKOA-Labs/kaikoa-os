import test from "node:test";
import assert from "node:assert/strict";
import { obligationSchedule, obligationWorkspaceRows, unlinkedFilter, type ObligationSummary } from "../lib/obligations-view.ts";
const now = Date.parse("2026-10-09T00:00:00Z");
const make = (id: string, patch: Partial<ObligationSummary> = {}): ObligationSummary => ({ id, title: id, status: "ATTENTION", requires_owner_attention: true, due_at: null, scheduled_at: null, next_action: null, workflow_note: null, related_entity_id: null, ...patch });
const linked = [{ id: "vessel", name: "Test vessel", slug: "test-vessel", status: "ACTIVE" }];
test("priority orders real overdue/soon deadlines ahead of attention while preserving waiting and deferred semantics", () => {
  const rows = [make("waiting", { status: "WAITING_ON" }), make("requires"), make("review", { requires_owner_attention: false }), make("soon", { status: "DEFERRED", due_at: "2026-10-10T00:00:00Z" }), make("overdue", { status: "WAITING_ON", due_at: "2026-10-08T00:00:00Z" }), make("invalid", { status: "DEFERRED", due_at: "bad-date" }), make("scheduled", { status: "SCHEDULED", requires_owner_attention: false, scheduled_at: "2026-10-08T00:00:00Z" })];
  const original = structuredClone(rows);
  assert.deepEqual(obligationWorkspaceRows(rows, [], "", null, "", now).map(row => row.id), ["overdue", "soon", "requires", "review", "scheduled", "waiting", "invalid"]);
  assert.deepEqual(obligationWorkspaceRows(rows, [], "", "requires", "", now).map(row => row.id), ["requires"]);
  assert.deepEqual(obligationWorkspaceRows(rows, [], "", "overdue", "", now).map(row => row.id), ["overdue"]);
  assert.deepEqual(rows, original);
});
test("search, workflow and linked-record filters combine; completed and unknown workflow states stay reachable", () => {
  const rows = [make("review", { requires_owner_attention: false, related_entity_id: "vessel", next_action: "Call specialist", workflow_note: "Awaiting estimate" }), make("done", { status: "COMPLETED", related_entity_id: "vessel" }), make("legacy", { status: "FUTURE_STATE", requires_owner_attention: false }), make("missing-parent", { related_entity_id: "unavailable" }), make("archived", { status: "ARCHIVED" })];
  assert.deepEqual(obligationWorkspaceRows(rows, linked, "specialist", "review", "vessel", now).map(row => row.id), ["review"]);
  assert.deepEqual(obligationWorkspaceRows(rows, linked, "estimate", null, "vessel", now).map(row => row.id), ["review"]);
  assert.deepEqual(obligationWorkspaceRows(rows, linked, "Test vessel", "completed", "", now).map(row => row.id), ["done"]);
  assert.deepEqual(obligationWorkspaceRows(rows, linked, "", null, unlinkedFilter, now).map(row => row.id), ["missing-parent", "legacy"]);
  assert.equal(obligationWorkspaceRows(rows, linked, "", null, "", now).some(row => row.id === "legacy"), true);
  assert.equal(obligationWorkspaceRows(rows, linked, "", "completed", "", now).some(row => row.id === "archived"), false);
});
test("schedule formatting preserves unknown/invalid values and exact timezone instants without creating a deadline", () => {
  assert.deepEqual(obligationSchedule(null), { label: "No scheduled date recorded", dateTime: null });
  assert.deepEqual(obligationSchedule("bad-date"), { label: "Scheduled date needs review", dateTime: null });
  const value = "2026-10-09T23:30:00Z";
  const utc = obligationSchedule(value, "UTC");
  const manila = obligationSchedule(value, "Asia/Manila");
  assert.match(utc.label, /9 Oct 2026, 23:30 UTC/);
  assert.match(manila.label, /10 Oct 2026, 07:30 GMT\+8/);
  assert.equal(utc.dateTime, manila.dateTime);
});
