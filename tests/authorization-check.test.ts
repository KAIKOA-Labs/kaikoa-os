import test from "node:test";
import assert from "node:assert/strict";
import { runAccessChecks, accessWrites, type AccessDriver } from "../lib/authorization-check.ts";
const user = { id: "test-user", email: "fixture+kaikoa-os-test@example.invalid" };
function fixture() {
  const writes: string[] = [];
  const driver: AccessDriver = {
    identity: async () => user,
    read: async () => ({ status: 200, count: 0, error: null }),
    write: async name => { writes.push(name); return { status: 403, error: { code: "42501", message: "Not authorized" } }; },
  };
  return { driver, writes };
}
test("real-session batch requires all eight successful empty reads and explicit write denials", async () => {
  const { driver, writes } = fixture();
  const results = await runAccessChecks(driver, () => {}, new AbortController().signal);
  assert.equal(results.length, 16); assert.ok(results.every(x => x.passed)); assert.equal(writes.length, 8);
});
test("signed-out and ordinary accounts cannot send test requests", async () => {
  for (const identity of [null, { id: "owner", email: "owner@example.invalid" }]) {
    const { driver, writes } = fixture(); driver.identity = async () => identity;
    driver.read = async () => { throw new Error("must not read"); };
    await assert.rejects(runAccessChecks(driver, () => {}, new AbortController().signal), /temporary test account/);
    assert.equal(writes.length, 0);
  }
});
test("nonempty, failed or indeterminate reads prevent every write", async () => {
  for (const response of [{ status: 200, count: 1, error: null }, { status: 200, count: null, error: null }, { status: 401, count: 0, error: { code: "401", message: "Expired" } }]) {
    const { driver, writes } = fixture(); driver.read = async () => response;
    await assert.rejects(runAccessChecks(driver, () => {}, new AbortController().signal), /Read check failed/);
    assert.equal(writes.length, 0);
  }
});
test("validation, network and unexpected success responses never pass and stop remaining RPCs", async () => {
  for (const response of [{ status: 400, error: { code: "P0001", message: "Name must be 2 to 120 characters" } }, { status: 0, error: { code: "", message: "Failed to fetch" } }, { status: 200, error: null }]) {
    const { driver, writes } = fixture(); driver.write = async name => { writes.push(name); return response; };
    await assert.rejects(runAccessChecks(driver, () => {}, new AbortController().signal), /Write check failed/);
    assert.equal(writes.length, 1);
  }
});
test("changed identity discards a pending response and stops requests", async () => {
  const { driver, writes } = fixture(); let current = user;
  driver.identity = async () => current;
  driver.write = async name => { writes.push(name); current = { ...user, id: "other-user" }; return { status: 403, error: { code: "42501", message: "Not authorized" } }; };
  const published: number[] = [];
  await assert.rejects(runAccessChecks(driver, checks => published.push(checks.length), new AbortController().signal), /Session changed/);
  assert.deepEqual(published, [8]); assert.equal(writes.length, 1);
});
test("creation payloads cannot create fixtures if an owner guard regresses", () => {
  assert.equal(accessWrites.find(x => x.name === "create_inventory_asset")!.args.p_name, "");
  assert.equal(accessWrites.find(x => x.name === "create_inventory_obligation")!.args.p_title, "");
});
test("default raised exceptions are recognized only with the exact authorization message", async () => {
  const { driver } = fixture();
  driver.write = async () => ({ status: 400, error: { code: "P0001", message: "Not authorized" } });
  const results = await runAccessChecks(driver, () => {}, new AbortController().signal);
  assert.ok(results.every(x => x.passed));
});
test("cancellation during reads discards results and prevents every RPC", async () => {
  const { driver, writes } = fixture(); const controller = new AbortController();
  driver.read = async () => { controller.abort(); return { status: 200, count: 0, error: null }; };
  await assert.rejects(runAccessChecks(driver, () => { assert.fail("cancelled results published"); }, controller.signal), /cancelled/);
  assert.equal(writes.length, 0);
});
