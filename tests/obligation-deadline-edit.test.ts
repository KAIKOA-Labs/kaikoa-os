import test from "node:test";
import assert from "node:assert/strict";
import { deadlineInput, deadlineValue } from "../lib/obligation-deadline-edit.ts";

test("empty deadline stays unknown and unchanged instants retain precision", () => {
  assert.equal(deadlineInput(null), "");
  assert.equal(deadlineInput("infinity"), "");
  assert.equal(deadlineValue("", "2026-10-09T00:00:00Z"), null);
  const original = "2026-10-09T23:30:42.123456+00:00";
  assert.equal(deadlineValue(deadlineInput(original), original), original);
});
test("local date entry records the intended instant in Manila and UTC", () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = "Asia/Manila";
    assert.equal(deadlineInput("2026-10-09T23:30:42Z"), "2026-10-10T07:30:42");
    assert.equal(deadlineValue("2026-10-10T07:30", null), "2026-10-09T23:30:00.000Z");
    assert.equal(deadlineValue("2026-10-10T07:30:42", null), "2026-10-09T23:30:42.000Z");
    process.env.TZ = "UTC";
    assert.equal(deadlineValue("2026-10-10T07:30:42", null), "2026-10-10T07:30:42.000Z");
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});
test("impossible dates and skipped daylight-saving times are rejected", () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = "UTC";
    for (const input of ["2026-02-30T10:00", "2026-13-01T10:00", "2026-10-09T24:00", "2026-10-09", "2026-10-09T10:00Z", "0000-01-01T00:00", "infinity"]) assert.throws(() => deadlineValue(input, null));
    assert.equal(deadlineValue("2028-02-29T10:00", null), "2028-02-29T10:00:00.000Z");
    process.env.TZ = "America/New_York";
    assert.throws(() => deadlineValue("2026-03-08T02:30", null));
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});
