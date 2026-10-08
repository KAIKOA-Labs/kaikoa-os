# Milestone 007 — real-session authorization check

## Prepared implementation

Open the development alias at `/private-memory/access-check` in the existing temporary-account browser session. Click **Run access checks** once. This route uses the existing private-session boundary; it is a diagnostic route with no new primary navigation entry or access grants.

The browser validates its identity through Supabase Auth. Only the approved test-alias pattern is accepted. Eight parallel authenticated HEAD requests obtain exact counts for all application tables, without fetching row contents. All must return successful HTTP statuses and exactly zero visible rows before any RPC probe runs.

Eight sequential RPC calls must each return the exact `Not authorized` message: `P0001` with HTTP 400 or `42501` with HTTP 403, as applicable to the inspected functions. Blank creation fields, invalid update fields and a confirmed nonexistent fixture UUID prevent mutations if an owner guard regresses. Live source inspection establishes that authorization precedes validation. A validation error is a failed test, even though it prevents mutation. The batch stops on any unexpected result and invalidates results on account changes or cancellation.

Results show endpoint names, pass/fail, HTTP status and sanitized evidence only. No tokens, private row contents or account identifiers are exported. Capture the results and completion timestamp in one screenshot (or full-page capture). The runner does not send evidence anywhere.

## Verification and limits

- Local verification: 20 unit tests, TypeScript and production build passed on 2026-10-08.
- Live execution: pending. Local unit tests use fixtures and do not close the real-account gate.
- Before execution, use a read-only administrative connector to verify the fixture UUID is absent and capture aggregate row counts/content fingerprints for all eight tables. Compare after execution, including both audit histories; do not put private contents or fingerprints in the public repository.
- If any response unexpectedly succeeds, stop and investigate before further writes. Do not automatically delete records or audit entries.
- Empty reads establish the observed session's visibility. Tables without existing data provide limited evidence; policy inspection complements these checks. RPC probes establish the guard before validation, rather than a full valid-input mutation test matrix.
- After tests, sign out the temporary account and verify owner re-entry. Temporary account deletion/session cleanup requires an explicit approved scope.
- Isolated restoration, document-object recovery and repository governance remain separate open gates. No production restoration or additional paid infrastructure is authorized by this check.

Sources: live RPC/grant review, `database/tests/authorization-boundary.sql`, `lib/authorization-check.ts` and current-session founder authorization. Supabase RPC reference: https://supabase.com/docs/reference/javascript/rpc.
