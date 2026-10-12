# Milestone 036 — twelve-month renewal and passport date readiness

Delivered scope, 2026-10-12 Asia/Manila. The founder explicitly requests moving first renewal notifications to twelve months before expiry and adding a green Ready to travel indicator beside passports, following the vehicle visual style.

## Baseline and behavior

The development tree is clean/aligned at `f44b57980bd6010d06f386e4e10c46b432dbf8fc`, with matching READY preview `dpl_CWFZBRUPNAKTkC2F95hL71mNstgD`. AGENTS.md, the session's complete Control Pack and the latest Current State/source/task records are inspected. Previously copied originals and linked passport evidence are reused; no import or recovery test is repeated.

The shared passport resolver now starts planning twelve calendar months before expiry. Existing monthly ChatGPT watches are updated in place, preserving their identity, cadence and Asia/Manila timezone. They remain quiet before twelve months; follow-up guidance targets replacement by nine months and urgent action at seven months, while six-month and expired alerts remain. No duplicate automation or one-off beyond the scheduler's two-year horizon is created. Task update success/enabled state is confirmed; delivery is not independently tested.

Passport cards show a wrapping, textual readiness indicator beside the name using the existing vehicle green/amber/grey visual style, plus red for expired. A visible date-check qualifier and explanation scope it to recorded passport dates, rather than immigration clearance or issuer validity certification. More than six months remaining is green Ready to travel. Exactly six months or less is amber Renew before travel; reached expiry is red Expired. Missing/invalid dates are grey, and conflicting expiry sources require review. Future-issued or future-recorded evidence never produces green. Renewal reminders are independent: green may remain during the early renewal window. The earlier always-amber planning pill is hidden until the renewal window opens.

## Saved policy and verification

The two existing document evidence summaries are corrected to twelve-month renewal-start dates and corresponding owner planning notes. An atomic management transaction uses expected-metadata checks, preserves everything outside those planning summaries and appends exactly two before/after agent audits with null changed_by. Original issue/expiry facts, provider references, backup associations and owner credential metadata remain intact. Prior records/history fingerprints match, exact metadata readback passes, and a rolled-back matching retry adds nothing. Totals remain 26 entities/38 entity audits, eight obligations/15 obligation audits, 21 documents and 18 links; document audits increase from 39 to 41.

All 91 tests and TypeScript pass. Coverage includes the twelve-month start, month ends/leap days, green during renewal, the exact six-month boundary, expiry and missing/conflicting/future source failures. Both saved private source plans pass the production parser/resolver, match their revised summary dates and classify green on the inspected date. Production build and matching deployment results are verified before handover. React review preserves parallel explicit protected projections, session/mounted guards, wrapping layout, text accompanying color and escaped safe links.

No Drive/file mutation, entity/obligation write, schema, RPC, grant, RLS, Auth, provider consent, paid infrastructure or new sensitive import is introduced. Independent provider denial, coordinated recovery, original evidence review, vehicle-year and other readiness/source pending items remain open. Founder browser acceptance of these cards and actual notification delivery are not claimed.

Publish under `Milestone 036: show passport date readiness and twelve-month renewal`. Resolve that exact development head and matching READY preview. Next: inspect the passport cards in the founder's normal browser, preserving existing pending items; do not repeat completed copy/import/recovery or rejected migration/identity tests.
