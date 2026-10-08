export type VerifiedSession = { userId: string; expiresAt: number };
export type PrivateAccess = { stage: "checking" | "ready" | "signed-out" | "error"; userId: string | null; revision: number };

// Auth events are hints. Only a server-verified identity can mount private UI.
export function createPrivateSession(
  verify: () => Promise<VerifiedSession | null>,
  publish: (access: PrivateAccess) => void,
  clock = {
    now: () => Date.now(),
    schedule: (callback: () => void, delay: number) => setTimeout(callback, delay),
    cancel: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer),
  },
) {
  let access: PrivateAccess = { stage: "checking", userId: null, revision: 0 };
  let generation = 0;
  let disposed = false;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  let pending: ReturnType<typeof setTimeout> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  function cancelCheck() {
    if (pending !== undefined) clock.cancel(pending);
    if (timeout !== undefined) clock.cancel(timeout);
    pending = timeout = undefined;
  }
  function clearExpiry() {
    if (expiry !== undefined) clock.cancel(expiry);
    expiry = undefined;
  }
  function hide(stage: PrivateAccess["stage"]) {
    clearExpiry();
    access = { stage, userId: null, revision: access.revision + 1 };
    publish(access);
  }
  function check(reset = false) {
    if (disposed) return;
    const request = ++generation;
    cancelCheck();
    if (reset) hide("checking");
    // Run outside Supabase's synchronous auth notification lock.
    pending = clock.schedule(() => {
      pending = undefined;
      timeout = clock.schedule(() => {
        if (!disposed && request === generation) { ++generation; hide("error"); }
      }, 10000);
      void verify().then(session => {
        if (disposed || request !== generation) return;
        cancelCheck();
        if (!session) { hide("signed-out"); return; }
        const remaining = session.expiresAt - clock.now();
        if (!Number.isFinite(remaining) || remaining <= 0) { hide("signed-out"); return; }
        const revision = access.revision + (access.userId === session.userId ? 0 : 1);
        access = { stage: "ready", userId: session.userId, revision };
        publish(access);
        clearExpiry();
        expiry = clock.schedule(() => check(true), Math.min(remaining, 2147483647));
      }).catch(() => {
        if (!disposed && request === generation) { cancelCheck(); hide("error"); }
      });
    }, 0);
  }
  return {
    check,
    observe(userId: string | null) {
      if (disposed) return;
      if (!userId) { ++generation; cancelCheck(); hide("signed-out"); return; }
      check(access.userId !== userId);
    },
    dispose() { disposed = true; ++generation; cancelCheck(); clearExpiry(); },
  };
}

export function needsPrivateSession(pathname: string) {
  return pathname === "/" || pathname === "/auth/status" ||
    pathname === "/private-memory" || pathname.startsWith("/private-memory/");
}
