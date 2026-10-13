# Milestone 042 — Vehicle registration evidence and blocked readiness

Reviewed: 2026-10-13, Asia/Manila. The founder supplies three selected vehicle photographs and explicitly requests private Drive originals, corresponding existing KAIKOA OS evidence, and not-ready indicators until updated registration is supplied. This is a bounded selected-file authorization; broader recovery/import gates remain intact.

## Delivered scope

Two historical registration certificates with latest available renewal receipts join the matching existing vehicles. The third photograph contains source file labels and is linked to both records. Source summaries distinguish model year, certificate/receipt dates, printed renewal deadlines, founder-confirmed overdue registration and missing updated receipts. Different receipt/file-label plate values are retained for review; current card plates remain unknown. Condition, insurance and service are not inferred.

Existing document profiles receive only the two registration checks, source-backed expiry dates and dated provenance. One shared readiness resolver returns a red Not ready to use indicator for expired registration, with Registration expired / renewal pending underneath. Other incomplete checks stay unknown and existing all-four-check green behavior remains intact. Both explicit source model years use the existing year resolver without entity rewrites. New registration evidence will need a separately attributed reconciliation; receiving a file does not automatically establish all readiness checks.

## Evidence, audit and preservation

Three original copies occupy one private subfolder under the existing Vehicles archive. Owner-only permissions, expected parent and sizes are verified. Downloaded copies match source bytes and reopen as images. A separately saved recovery archive restores all three exact images and their private association mappings. This selected-file check does not certify coordinated database/Auth/provider-denial recovery.

One conflict-safe atomic management transaction creates three document references, four links and seven agent creation/link audits, then updates two existing profiles with two explicit before/after agent audits. changed_by stays null; no owner impersonation. Rollback preflight, actual commit, independent exact metadata/link/audit readback and rolled-back matching no-op retry pass. Final totals: 53 documents, 34 links and 106 document audits. Full-content fingerprints preserve all 26 entities/38 entity audits, eight obligations/15 obligation audits, other documents and prior links/document history. No schema, RPC, grants, Auth or provider configuration changes.

## Verification and publication

Unit suite, TypeScript and completed production build pass. Boundary coverage verifies inclusive expiry day, red after expiry even with unknown condition/service/insurance, unknown or future check dates, and unchanged amber review states. Private production-parser checks against independent live readback prove two red registration statuses, two explicit model years and preservation of the existing green vehicle. No agent-controlled browser is used; founder visual acceptance remains pending.

Baseline `652f4503d2bd59b2e1e08e9c76eff2db399f297d`, tree `b9fff12789f7430af7f5d1a3d04fd77b620bbe80`, matches READY preview `dpl_DSUkMQSaME9NCNyo8798c4iWc3B4`. Publish only the shared readiness resolver, its CSS/test changes, this checkpoint and Index continuation pointer under `Milestone 042: flag expired vehicle registration`. Verify the exact successor head and matching READY preview before handover. Main and unrelated Control Pack history remain untouched.

Next: founder inspects the Vehicles cards. Reconcile updated registration only when supplied, retaining these historical originals and audit history; resolve plate discrepancies from authoritative evidence. Existing Medical, credentials, rental, notification and broader restoration acceptance limits remain preserved.
