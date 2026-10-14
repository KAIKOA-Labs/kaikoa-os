# Artwork physical-print registry — 2026-10-14 checkpoint

## Scope delivered
- Preserved the existing protected Artwork workspace, three operational artwork entities, and existing version-1 edition metadata editor.
- Added `lib/artwork-print-registry.ts` for validated per-print identifiers (edition, numbered/AP kind and number), independent production, location, allocation, fulfillment and payment-evidence states, and source note requirements.
- Added authenticated, read-only `/private-memory/artwork/[slug]/prints`, linked from existing artwork details. No private records or sensitive location/collector details are committed to Git.
- Added tests covering unique numbers, edition/AP bounds, reserved allocation, separate custody/delivery, missing records and locked one-of-one reproductions. Tests are committed; local npm test execution was not completed in this session.
- Vercel preview `dpl_FpfpzH5PPjh7eUtN69ZrgYi7p6ou` reported READY matching commit `d189233ef16e220ecfc9ae96031eff96918c3984`. READY is build/deployment evidence, not owner browser acceptance.

## Current limits
- The three existing live artwork entities had null `artwork_inventory` and null `artwork_print_registry` at read-only inspection.
- The screen displays an explicit awaiting-reconciliation state until authorized records exist; it is not yet a live populated inventory.
- The validation model's reproduction lock is not a database/server-side mutation guard; do not claim the one-of-one promise is technologically enforced.
- The existing `update_artwork_inventory` RPC is owner-authenticated, audited and accepts only the original edition-total shape. Do not bypass it or directly mutate `entities` using an unaudited agent account. Preserve owner identity and provenance.
- The supplied historical screenshot source may not remain available in subsequent contexts. Request re-upload if exact-row fresh extraction is needed; do not invent unsupplied print/financial facts.
- No Google Drive archival or DocuSign signed agreement completeness was verified by this development increment.

## Next bounded operation
Build a separate owner-authenticated, server-validated and audited print-registry write endpoint and a small owner-operated editor or controlled import preview, reusing existing metadata/history/RLS/stale-version patterns. Verify new and unrelated record preservation, no-op/idempotency, wrong-user/anonymous denial, duplicate numbers, locked one-of-one immutability, edition AP zero, and conflicting stale writes. Only then enter founder-confirmed individual-print facts privately. Do not broaden scope to sales/accounting/automatic outreach.

## Verification and handoff
Continue on `milestone-001-hull`, never write directly to `main`. Request founder browser acceptance for new `/private-memory/artwork/la-vie-en-rose/prints`. No full local npm test or signed-document verification claimed.
