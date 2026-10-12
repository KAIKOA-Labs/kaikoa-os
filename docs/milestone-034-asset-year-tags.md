# Milestone 034 — Available vehicle and vessel years

Reviewed: 2026-10-11, Asia/Manila. The founder requests the vehicle or boat year on its tag when available.

Vehicle and vessel cards and detail pages share a `Year · YYYY` tag. The existing protected registration summaries supply explicit model/manufacture or vessel build years through their existing entity links. The displayed year is searchable in Assets. Unknown years are omitted. First circulation, issue, declaration, expiry, insurance and service dates never substitute for model/build years. Conflicting recorded years are omitted rather than choosing a document arbitrarily. No asset-specific fact is compiled into the interface.

Live inspection of the seven existing vehicle/vessel records and their registration evidence finds one explicit vessel build year and no confirmed vehicle model/manufacture years. The private source readback passes through the production helper with that exact result. Existing vehicle-profile parsing is unchanged; registration summaries are excluded from the profile projection to preserve its one-profile ambiguity rule. Cards and details use the same year resolver and tag.

Verification: 84 tests, production build and TypeScript pass. Four new tests cover model/build extraction, first-circulation exclusion, source type/link/category boundaries, malformed and missing evidence, conflicting years and year search. React review preserves existing protected reads, explicit projections, parallel independent requests, identity/mounted guards, escaped values and wrapping tags. No database/provider write, schema, RPC, grant, RLS, Auth or protection change is made. Private sources and identifiers stay outside Git.

Baseline is clean/aligned at `9be9aa4b83a937fc9922cbc851409e3d270d833e`, tree `4e9ae49108cb928c50e4a5b279e643f7c1218329`, with matching READY preview `dpl_BcQNobpp8BCjpk9BupNY54yX93nH`. Publication follows under `Milestone 034: show available vehicle and vessel years`; resolve that subject and matching READY deployment. Browser acceptance remains pending; no real-session authorization or recovery gate is newly certified.

## Closeout — 2026-10-12

Delivered feature `2d6c9ec029603529a3285157ea9abeddc876b200`, tree `4834bb7ea5db930e84ede0301bd7cf47e4547331`, is clean/aligned with the remote development branch. Matching preview `dpl_LcG2PHc8GNoM9yj1DkFEzNPyB6BV` is rechecked READY.

The founder's 2026-10-11 desktop screenshots show the selected vehicle base/plate/readiness/four checks and the vessel year tag. The founder confirms the selected vehicle tag looks good. Acceptance is limited to that card/display scope; other cards, detail pages, mobile layout and source validity are not independently certified. On 2026-10-12 the founder explicitly defers the selected vehicle year until a registration scan/photo confirms it. The existing supplied registration photo remains evidence, with first circulation kept separate from model/manufacture year.

All 84 tests and TypeScript pass again at closeout. The production build passed during implementation; closeout edits are documentation only, with no code/database/provider/access changes. Documentation publishes under `Milestone 034: record acceptance and close session`; resolve its latest head and matching READY preview. Existing source review and coordinated recovery gates remain open.

Next: begin the founder's fresh task after reading the Control Pack and checking the current remote checkpoint. Do not repeat imports or the accepted selected-card check. Keep the vehicle year blank pending suitable evidence, and do not infer it from first circulation or identifiers.
