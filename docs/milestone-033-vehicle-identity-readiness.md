# Milestone 033 — Vehicle identity and readiness

Reviewed: 2026-10-11, Asia/Manila. The founder requests a plate visible on the vehicle card, correction of inconsistent location labels across all vehicles and a simple green indicator for four explicitly confirmed checks.

## Result

Six vehicles share the same read-only card/detail layout: clean display name, one base tag, one registration-plate tag, readiness text/symbol/color and a dated owner check. One owner-confirmed vehicle is ready; the other five retain unknown plates/checks. Search includes displayed plate/base/name. Previous inventory prose is retained as earlier notes; insurer registration/full-policy and missing-service-receipt review points remain with the original document evidence.

Green requires condition good/excellent, registration current, insurance paid and completed annual service, with a valid past/current check date. Known past expiry and the annual-service anniversary remove green on display. Invalid, missing, duplicate or ambiguous profiles fail closed. The annual calculation is not a dealer booking, obligation or notification. Payment and condition are owner confirmations, not newly certified bank/inspection/insurer evidence.

## Persistence and preserved boundaries

One versioned owner-statement profile per vehicle is saved in existing documents.metadata.vehicle_profile and linked through existing document_links. This is the single source for the new current-base/name/plate/check display; prior universal entity fields are preserved. The profile records are not Drive originals or certificates, and file-oriented views exclude them while retaining original file references.

One conflict-stopping atomic transaction creates six snapshots/six links/12 explicit agent creation/link audits with null changed_by. Exact private six-row metadata/ID/link/audit readback passes; matching retry is a no-op. Full-content comparisons preserve all prior entities/entity history, obligations/history and documents/links/history. Totals: 19 documents, 16 links, 35 document audits; 26 entities/38 entity audits and eight obligations/15 obligation audits are unchanged.

Automatic approval review rejected a proposed migration that relaxed a shared audit field and granted a new authenticated write endpoint. It was not applied or retried. The editor/migration were removed, and the delivered alternative completes the display using existing read-only evidence access. No schema, RPC, grants, RLS, Auth, protection or Drive change is made. The original non-null actor contract and absence of the proposed endpoint were verified.

## Verification and next step

80 unit tests, TypeScript and final production build pass. Coverage includes all-four green requirements, expiry/annual boundaries, leap-year anniversary, unknown/future/invalid states, plate/base search and ambiguous-source handling. All six private profiles validate with the production parser; exactly one is ready. Existing owner-only RLS/policy and SELECT-only grant/no-anonymous-read inspection passes. React review preserves parallel independent reads, private projections, identity/stale-response guards, escaped values, native disclosure and text/symbols with color.

Baseline `c135a5266e4599ee570027bdabc548867a44f473`, READY preview `dpl_4QDt4rDpF8HbfAyaQwsVWar1Npu2`. Resolve feature subject `Milestone 033: clarify vehicle identity and readiness` and its matching READY deployment. No new browser acceptance, real-session authorization, identity simulation, full recovery or automatic provider reading is claimed.

Next: inspect Assets in the founder browser and gather unreported checks when supplied. Read profiles before future updates and preserve agent/owner attribution. Interactive editing requires a separately approved write/audit contract; do not retry the rejected migration as part of this increment. Wider sensitive imports and coordinated database/Auth/provider recovery remain gated.
