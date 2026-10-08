# KAIKOA OS — Security and recovery gate (Milestone 003P)

## Verified on 2026-10-08
- All eight application tables have RLS enabled.
- All eight tables expose owner-restricted SELECT policies to authenticated users; none expose anon table grants.
- The three audited editor RPC functions explicitly check the authenticated owner UID, validate inputs, restrict eligible records and append audit entries.
- Vercel deployment protection stopped unauthenticated incognito requests before reaching the application.

## Remaining verification — do not mark complete without evidence
- Independently test unauthorized authenticated-user access to SELECT and each RPC; do not infer this solely from policy inspection.
- Independently test signed-out application behavior without bypassing deployment protection on a production endpoint.
- Confirm Supabase backup availability, retention, restore mechanism and whether point-in-time recovery is enabled; no verified restore yet.
- Create and test a recovery procedure in a non-production environment before importing sensitive personal data.
- Review Supabase security advisor warning for SECURITY DEFINER RPC exposure. These RPCs are intentionally authenticated-callable; confirm their owner guard with negative tests.
- Review leaked-password protection configuration. Current advisor reports it disabled; evaluate password-based login use before changing settings.
- Review GitHub/Vercel access and secret handling; never commit service-role keys or private data.
- Confirm recovery roles, incident response contacts and change approval process.

## Release gate
No import of sensitive health, identity, family or financial documents until independent authorization testing and a tested restore procedure are complete.

## Backup assessment — 2026-10-08
- Supabase organization subscription is **Free** (confirmed through project organization API).
- Official Supabase documentation says managed automatic daily backups are included on Pro, Team, and Enterprise, **not Free**. Free projects should maintain external exports with the Supabase CLI `db dump` command.
- No independent database export or restore test has been completed; recovery remains **unverified**.
- Do not assume backup availability or retention based on a green deployment.
- Recommendation: establish managed daily backups or independently encrypted off-site logical exports, then test restore in a separate environment before importing sensitive information.
- Documentation: https://supabase.com/docs/guides/platform/backups

## Managed backups observed — 2026-10-08
- Supabase dashboard screenshot confirms two physical backups listed, dated 2026-10-07 18:25:11 UTC and 2026-10-07 16:24:59 UTC, each with a Restore action.
- **Backup availability confirmed; restoration NOT tested.** Do not restore production for testing.
- The backup list does not itself prove ongoing schedule success, file-object backup coverage, or that all recent changes are included. Recheck after the next scheduled backup.
- Database physical backups exclude actual Supabase Storage objects. Plan separate object backups before document imports.
- Next gate: controlled restoration to an isolated environment and validation of row counts, owner-only access and audit trail before treating recovery as fully verified.

## Simulated authorization negative tests — 2026-10-08
- Within rolled-back SQL transactions, impersonated the `authenticated` database role with a synthetic non-owner JWT subject. SELECT returned zero rows for entities, obligations, entity_change_history and obligation_change_history; assertions passed.
- The same synthetic non-owner was denied by all three privileged editing RPCs: entity description, obligation next action and obligation status; assertions passed. Dummy IDs were used; no records were changed.
- Within a rolled-back transaction, impersonated `anon` and verified all eight public tables cannot be read (either insufficient privilege or RLS zero rows); assertions passed.
- **Limit:** these are simulated SQL role/JWT tests, not a real second-account HTTP test. Real-user authorization, deployment-protection bypass testing and isolated restore verification remain pending.
