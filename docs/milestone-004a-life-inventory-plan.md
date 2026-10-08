# KAIKOA OS — Milestone 004A: Life Inventory Expansion

Status: **Inventory planning, not a verified import**. Created 2026-10-08.

## Objective
Expand from three core asset records and two obligations into a useful, auditable operational inventory. Preserve the universal entity / obligation / event / document / relationship architecture. No speculative deadlines, payment completions or credential statuses.

## Import sequence
### Wave 1 — Operationally important, low-sensitivity
1. **KAIKOA vessel** (existing entity): Outremer 45 (2022), UK flag, Tahiti CM4 mooring. Candidate maintenance obligations: hatch/window water ingress, windlass clutch/engagement, prop anodes, dinghy lines, haul-out planning. Mark current condition and ownership of tasks as **unverified until reconfirmed**; do not create hard due dates.
2. **Burgos Ocean View** (existing entity): land acquisition and development. Candidate obligations: reconcile seller balance and due schedule from purchase documents; access-road completion and title/transfer evidence; phase-1 construction budget and project milestones. Never label outstanding payments paid without receipt.
3. **kaikoa.com** (existing entity): confirm registrar, expiration date, auto-renew, billing method and recovery contacts before marking domain protection verified.
4. **Supabase Pro** (existing subscription entity): $25/month base plan verified from 2026-10-08 billing screenshot; projected $28 at that moment, not necessarily the final invoice. Keep spend cap enabled and verify next invoice.

### Wave 2 — Credential and administration inventory (metadata only pending sensitive-data gate)
- PADI Divemaster credential and membership status: identifiers, issuing body, renewal and teaching authorization require independent confirmation.
- Pilot licence and related privileges: validity, medical/currency and instructor authority are separate concepts; do not infer one from another.
- Boat commercial permits and insurance: provider, coverage period, jurisdiction, and actual document evidence.
- Passport and identity records: **do not import identifying document numbers or scans until security/restore gates pass**.

### Wave 3 — Other properties, business and financial commitments
- Siargao land opportunities, Moorea property search, Manila leases, charter business, art commissions and renewable-energy ventures.
- Record opportunities separately from owned assets and binding obligations.
- Financial values require currency, source, as-of date, and confirmed/estimated status.
- Recurring subscriptions: maintain review queue; no guessed charges.

### Wave 4 — Sensitive records (blocked pending security gate)
- Health records, vaccination history, legal/family records, financial account statements, IDs and supporting scans.
- Need verified independent account isolation, successful isolated restore, separate object backups and explicit consent on each import.

## Data quality rubric
- **Verified:** backed by a dated source, owner confirmation or official record.
- **Partial:** some supported facts, missing essential attributes.
- **Unverified:** recollection, estimates, provisional proposals or stale status.
- Each obligation: title, related entity, current state, next action, owner attention flag, due date only when supported, provenance and last verified timestamp.
- Avoid storing private information in GitHub markdown, deployment logs or public routes.

## Next implementation gates
1. Inspect existing entities/obligations and ensure no duplicate records.
2. Design owner-only audited create/update workflows for new non-sensitive entities and obligations.
3. Seed a **small** batch of user-approved, low-sensitivity facts with provenance and no fabricated deadlines.
4. Test dashboard grouping, direct links and audit history after each batch.
5. Complete security and restore requirements before sensitive imports.

## Working rule
Architecture before bulk import; confirmed facts before deadlines; no extra paid infrastructure without budget approval.
