# Milestone 005 — Obligation workflow

This extends the existing obligation model and owner-only RPC architecture. The locked Phase A → B → C → D sequence in ARCHITECTURE.md remains authoritative; no new service or subscription is required.

## Inspection

- Starting development head: `53f0a81944f67e89839f5924041a4957233acb7f`, successfully deployed to the milestone-001-hull Vercel preview.
- Supabase: PostgreSQL 17, healthy, organization plan Pro.
- Eight application tables with RLS and owner-restricted SELECT; authenticated clients have SELECT-only table grants and use audited RPCs for writes.
- Four existing maintenance obligations were present, with archived test records and prior history retained.
- The old editor filtered on presentation visibility, excluding private obligations.
- GitHub reports the repository as public, main unprotected and no rulesets. This milestone does not change main, repository visibility or permissions.
- database/schema.sql is the original conceptual schema; it is not the live database schema. See current-database-schema.md.
- Earlier Free-plan wording in security-recovery-checklist.md was superseded by the verified Pro upgrade.

## Result

Six supported workflow states: Requires You, Waiting On, In Progress, Scheduled, Completed, Deferred / Awaiting Funding.

The editor accepts active private and safe_preview obligations, and saves state, next action and context atomically. It rejects stale versions. Completed requires explicit owner confirmation and a supporting note. Scheduled requires a finite owner-entered timestamp and context, stored separately from due_at. Completion time records when the completion was declared, not an inferred repair/payment date.

Waiting and deferred work do not count as Requires You. Existing unassigned ATTENTION records show Needs Review until an owner action is assigned. Existing UPCOMING records remain Upcoming without an invented schedule. Completed work has its own filter and remains in history; archived records are excluded from active views and editing.

The new public RPC is SECURITY INVOKER and delegates to an owner-guarded private function. No direct write grants, additional owner privileges or anon execution grants were introduced. Audit entries record every changed workflow field in the existing history table. The previous safe status RPC delegates to the same validation.

## Verification

- Production build and TypeScript validation pass.
- Classification regression tests pass.
- Rolled-back SQL tests exercise all six transitions, attention flags, schedule/completion timestamps, unchanged provenance/deadlines, no-op saves, completion confirmation, required dependency context, null input rejection, stale writes and archived-record rejection.
- Simulated non-owner SELECT checks cover all eight tables; workflow and legacy status writes are denied. Anonymous workflow execution is denied.
- Baseline comparison confirms all existing entities and history entries are retained, with only the specifically authorized maintenance state/context changes.
- Security advisor retains the seven prior intentional authenticated SECURITY DEFINER RPC warnings and the prior leaked-password warning; the new public workflow RPC adds no such warning.
- Signed-in browser testing, a real second-account HTTP test, isolated restoration and separate document-object backups remain outstanding.

## Navigation

Home → an obligation, or Private OS → Manage Records → Update Obligations → select record → choose state and supply required context → Save obligation.

View recorded edits in Private OS → Change History.

## Next inventory wave

Continue non-sensitive financial/administrative obligations from authoritative records: verified service billing, existing acquisition-payment reconciliation, vessel operational readiness and permit/insurance review. Preserve unknown dates and costs as unknown. Subscription discovery stays in the backlog. Sensitive imports remain subject to the existing security/recovery gate.
