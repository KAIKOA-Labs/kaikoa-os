import test from "node:test";
import assert from "node:assert/strict";
import { createPrivateSession, needsPrivateSession, type PrivateAccess, type VerifiedSession } from "../lib/private-session.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function harness() {
  let now = 1000;
  let next = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const requests: ReturnType<typeof deferred<VerifiedSession | null>>[] = [];
  const states: PrivateAccess[] = [];
  const controller = createPrivateSession(() => {
    const request = deferred<VerifiedSession | null>(); requests.push(request); return request.promise;
  }, state => states.push(state), {
    now: () => now,
    schedule: (callback, delay) => { const id = ++next; timers.set(id, { at: now + delay, callback }); return id as unknown as ReturnType<typeof setTimeout>; },
    cancel: id => { timers.delete(id as unknown as number); },
  });
  function advance(time = 0) {
    now += time;
    for (const [id, timer] of [...timers]) {
      if (timer.at <= now && timers.delete(id)) timer.callback();
    }
  }
  return { controller, requests, states, advance, latest: () => states.at(-1)!, timers };
}
const owner = { userId: "fixture-owner", expiresAt: 60000 };

test("sign-out immediately hides private state and a late request cannot restore it", async () => {
  const h = harness(); h.controller.check(true); h.advance();
  h.controller.observe(null);
  assert.equal(h.latest().stage, "signed-out");
  h.requests[0].resolve(owner); await flush();
  assert.equal(h.latest().stage, "signed-out");
  assert.equal(h.timers.size, 0);
});
test("an account switch clears the previous view before verifying the replacement", async () => {
  const h = harness(); h.controller.observe(owner.userId); h.advance();
  h.requests[0].resolve(owner); await flush();
  const revision = h.latest().revision;
  h.controller.observe("fixture-other");
  assert.equal(h.latest().stage, "checking"); assert.equal(h.latest().userId, null);
  h.advance(); h.requests[1].resolve({ ...owner, userId: "fixture-other" }); await flush();
  assert.equal(h.latest().userId, "fixture-other"); assert.ok(h.latest().revision > revision);
});
test("routine same-account refresh preserves drafts but failed verification clears access", async () => {
  const h = harness(); h.controller.check(true); h.advance();
  h.requests[0].resolve(owner); await flush(); const revision = h.latest().revision;
  h.controller.observe(owner.userId); h.advance();
  h.requests[1].resolve({ ...owner, expiresAt: 120000 }); await flush();
  assert.equal(h.latest().revision, revision);
  h.controller.check(); h.advance(); h.requests[2].reject(new Error("Revoked")); await flush();
  assert.equal(h.latest().stage, "error"); assert.equal(h.latest().userId, null);
});
test("expiry still hides records when a focus verification is stalled", async () => {
  const h = harness(); h.controller.check(true); h.advance();
  h.requests[0].resolve({ ...owner, expiresAt: 2000 }); await flush();
  h.controller.check(); h.advance(); h.advance(1000);
  assert.equal(h.latest().stage, "checking");
  h.requests[1].resolve(owner); await flush(); assert.equal(h.latest().stage, "checking");
});
test("verification timeout and disposal reject late success", async () => {
  const h = harness(); h.controller.check(true); h.advance(); h.advance(10000);
  assert.equal(h.latest().stage, "error");
  h.requests[0].resolve(owner); await flush(); assert.equal(h.latest().stage, "error");
  h.controller.check(true); h.advance(); const count = h.states.length; h.controller.dispose();
  h.requests[1].resolve(owner); await flush(); assert.equal(h.states.length, count);
  assert.equal(h.timers.size, 0);
});
test("missing and expired sessions never mount private records", async () => {
  for (const session of [null, { ...owner, expiresAt: 0 }]) {
    const h = harness(); h.controller.check(true); h.advance(); h.requests[0].resolve(session); await flush();
    assert.equal(h.latest().stage, "signed-out"); assert.equal(h.latest().userId, null);
  }
});
test("all record routes are guarded while sign-in and callbacks remain reachable", () => {
  for (const path of ["/", "/auth/status", "/private-memory", "/private-memory/history", "/private-memory/inventory", "/private-memory/obligations/edit", "/private-memory/assets/example"]) assert.equal(needsPrivateSession(path), true);
  for (const path of ["/auth/sign-in", "/auth/callback", "/assets", "/operations", "/private-memory-other"]) assert.equal(needsPrivateSession(path), false);
});
