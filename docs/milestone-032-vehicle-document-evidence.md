# Milestone 032 — Vehicle document evidence and annual service plan

Reviewed: 2026-10-11, Asia/Manila. The founder requests a bounded manual registration/insurance import and annual official-dealer service record for one existing vehicle. Private operational facts, source files and identifiers remain outside this repository.

## Result

The existing protected Documents and vehicle detail show an uploaded registration photo, the latest renewal notice located in scoped Gmail correspondence and an owner-reported service history/annual plan. Each uses per-field provenance, unknown preservation, review points and a private Drive link. Registration email provenance is not claimed. First circulation does not establish manufacture year; the printed insurance balance does not establish a current payment ledger. Insurer registration confirmation and full-policy terms remain open.

The service entry preserves the founder’s reported completed service date, annual frequency and official-dealer description. No supporting invoice is supplied. Its linked text is explicitly a generated transcription, not dealer evidence. The next appointment remains unknown; no booking, exact future date, reminder delivery or dealer message is created.

## Copies, recovery and data

The photograph, renewal PDF and generated owner statement are saved in a private vehicle folder. Expected parent/size, owner-only permission metadata and exact downloaded Drive bytes pass for all three. A separately saved archive is recovered into an isolated local location; archive/member bytes match, recovered PDF/JPG reopen and a private association manifest maps source/provider/recovery members to the same document IDs saved in the database. This verifies selected file-byte recovery only, not current coordinated database/Auth restoration or independent provider denial.

One atomic conflict-stopping transaction adds three NEEDS_REVIEW document records, three existing-vehicle links and six explicitly agent-attributed audits with null changed_by. Exact private metadata/ID/link/audit readback and a rolled-back matching no-op retry pass. Totals: 13 documents, ten links, 23 document audits. Full-content transaction comparisons preserve all previous document/link/history rows and the existing 26 entities/38 entity audits/eight obligations/15 obligation audits.

The annual plan is source evidence. Asset/obligation audit contracts require named actors; no operational write is falsely attributed to the owner. Schema, RPCs, grants, RLS, authentication and protection are unchanged. The reference-only non-sensitive RPC is not used to misdeclare these files.

## Verification and publication

- All 74 unit tests pass; unknown appointment/category/search behavior is covered.
- TypeScript and production build pass; all three private summaries pass the production parser.
- Exact readback, no-op retry, Drive checksums and isolated archive/member/PDF/JPG recovery pass.
- Catalog inspection confirms existing owner-only read policies/RLS, authenticated SELECT without direct writes, and no anonymous SELECT for documents, links and history.
- Automatic approval review rejected a fresh owner-JWT simulation as impersonation. It was not retried; no fresh simulated or real-session authorization result is claimed.
- React review retains native disclosure, accessible labels, escaped values, safe external links and the existing private-session projections/guards.

Baseline: `5decb9ebd036b436a3a0227751e0cb172cb3a55a`, matching prior READY preview `dpl_9sPhKMoezPFykBJiqoWQUyxVdwv8`. Resolve `Milestone 032: add vehicle evidence and annual service plan` and the exact matching READY development preview. Founder browser/mobile acceptance is pending; no agent-controlled browser or protected HTTP capture is claimed.

Next: inspect the vehicle cards in the founder’s normal browser, resolve insurer registration confirmation and record a concrete future dealer appointment when supplied. Do not repeat the completed import by default.
