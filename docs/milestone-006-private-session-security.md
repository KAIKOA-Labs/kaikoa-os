# Milestone 006 — Private-session security

Date: 2026-10-08 (Asia/Manila). Extends Milestone 005 on milestone-001-hull.

## Problem and result

Private pages checked authentication only when mounted. A dashboard already open in another tab could retain previously loaded records after sign-out elsewhere. A shared boundary now guards Home, Account and every Private OS route. It unmounts private views and unsaved editor state on sign-out or identity change, ignores old verification responses, and requires server-verified identity before remounting. Account navigation now uses the established Manage Records label.

Auth events schedule verification outside the synchronous Supabase notification callback. Routine same-account refresh preserves editor drafts. Token expiry hides private views, focus rechecks access, and browser history restoration rechecks before allowing the private subtree. Failed or stalled verification closes the view, with a retry action. RLS remains the authority for which records an authenticated identity may read or change; this browser boundary does not grant owner access or replace database authorization.

No schema migration, real-record mutation, new dependency, paid service, change to Vercel protection, repository visibility or main-branch policy is included.

## Verification

- Production Next.js build and TypeScript checks passed.
- Twelve automated tests passed: five existing obligation regressions plus seven session-boundary regressions covering late-response/sign-out races, identity switching, draft preservation on refresh, failed checks, expiry during a stalled request, timeouts/disposal, missing/expired sessions and route coverage.
- database/tests/authorization-boundary.sql passed against the existing database in a rolled-back transaction. Synthetic non-owner JWT/role checks cover SELECT on all eight application tables and rejection by all eight public write RPCs. Anonymous reads/execute and authenticated direct INSERT/UPDATE/DELETE grants are checked.
- Live data and audit fingerprints are compared before/after verification; no record changes are authorized in this milestone.
- Browser inspection reaches Vercel's authentication wall. Local automated browser launch is unavailable in this execution environment. Unit and database checks do not prove the browser interaction or independent real-account HTTP authorization.

## Essential acceptance test

Follow-up from the owner's signed-out screenshot: the private records were absent, but the generic access gate added an unnecessary click. Signed-out protected routes now show the same full sign-in form as /auth/sign-in, with a compact responsive card and the existing approved-account email-link flow. Gmail works as an email address; native Google OAuth has not been configured or added. The earlier Google/provider choices belonged to Vercel deployment access. Session clearing, RLS and shouldCreateUser=false are preserved. A screenshot of one signed-out view does not establish the full two-tab or re-entry test.

Open Home in one signed-in tab. In a second tab on the same development URL, open Private OS → Account → Sign out. Return to the first tab without reloading: private record cards must be gone and the Welcome back sign-in form visible. Sign in again and confirm the existing records return. This uses no data edits.

## References used

- https://supabase.com/docs/reference/javascript/auth-onauthstatechange
- https://supabase.com/docs/reference/javascript/auth-getuser
- https://supabase.com/docs/guides/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0

The changelog Markdown endpoint could not be fetched in this environment; current official API documentation and the installed pinned client were checked. No client upgrade was made.
