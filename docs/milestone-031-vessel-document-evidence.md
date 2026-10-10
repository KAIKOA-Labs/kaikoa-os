# Milestone 031 — Vessel document evidence

Reviewed: 2026-10-11, Asia/Manila. Founder-requested, bounded manual Gmail review and copy/extraction of vessel registration, Tahiti import documents and latest issued insurance. Source values, provider identifiers, personal details and the private association manifest remain outside this repository.

## Result

Three grouped document sets appear in the existing protected Documents workspace and vessel detail. Each has key facts, per-field provenance, original links, supporting files, source-email links and expandable details. Owner corrections and evidence conflicts remain prominent. Search keeps supporting files with their primary summary. Invalid or ambiguous metadata never hides the original reference.

Registration preserves source dates and dimensions, separates tonnage from actual mass and retains the owner's weight correction with actual mass unknown. Import evidence keeps the declaration/invoice distinct and exposes the printed-balance versus broker-message conflict. Insurance preserves the issued policy period/terms, policy extensions and recorded-location review points. The owner's automatic-instalment arrangement is distinct from the older payment-plan email and located payment receipts. Current balance, next debit and paid-in-full status remain unknown.

Document dates do not certify current legal validity, coverage or compliance. No reminders, payments, responsibilities or universal asset facts are inferred or changed.

## Copies and recovery

Six source PDFs and a clearly labelled payment-email transcript were copied into the existing private vessel folders. Metadata verifies the expected parent, size, shared=false and only the established owner permission. Downloading every Drive copy produces an exact source checksum/size match.

A separate checksum-preserving archive was saved and recovered into an isolated local directory. All seven members match their original bytes and every recovered PDF reopens. Some separately materialized individual PDFs had changed bytes; those are not the byte-preserving recovery artifact. The archive and a private association manifest retain member/checksum/provider/database mapping. No original was deleted or overwritten.

This verifies bounded file-byte recovery for the selected set only. It does not establish a coordinated restore of the current nine-table database/Auth state, independent unauthorized-user denial at the provider, a recurring backup or retention/data-loss target. Broader sensitive imports and provider automation retain those gates.

## Data and access

The existing documents/link/audit tables are reused. One atomic management transaction creates seven NEEDS_REVIEW documents, seven vessel links and 14 explicit agent-attributed creation/link audits. Agent audit actors are null, with founder-request provenance; no owner JWT impersonation or false non-sensitive declaration is used. Conflicting existing references stop rather than overwrite, provider-key serialization prevents duplicate creation, and matching retries are no-ops.

Independent exact private metadata readback passes. Totals after import are 10 documents, seven links and 17 document audits. Existing 26 entities/38 entity audits and eight obligations/15 obligation audits remain unchanged; transaction checks compare their full content. The schema, reference RPC, grants, RLS, authentication and deployment protection are unchanged. Private source files and identifiers are not compiled into the app.

## Verification and publication

- All 73 unit tests pass, including exact summary/link validation, unknown preservation, complete bundle search and ambiguous/orphan fallback.
- TypeScript and production build pass using the baseline dependency versions.
- Rolled-back owner/non-owner/anonymous role/JWT read checks pass for saved summaries, zero non-owner disclosure, anonymous denial and denied direct browser writes. These are simulations, not real browser sessions.
- Exact metadata comparison, conflict-safe no-op retry, Drive roundtrip hashes and isolated archive/member/PDF recovery pass.
- React review covers explicit protected projections, existing identity/stale-response guards, escaped strings, native disclosure controls and allowlisted no-referrer links.

Baseline: `e7b62fb6db1299396d474f64d3ecad68dd7ef04c`, matching READY preview `dpl_6m3dAyGQV9YhnTg7La5grhXkLUbZ`. Resolve feature subject `Milestone 031: add vessel document evidence summaries` and its matching READY development preview. No agent-controlled browser, founder visible/mobile acceptance or protected HTTP-flow capture is claimed.

Next: inspect the three document sets in the founder's normal authenticated browser and resolve the source/owner review points when authoritative evidence is available. Do not repeat the seven-file import by default.
