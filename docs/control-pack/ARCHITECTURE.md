# KAIKOA OS — Architecture

Reviewed: 2026-10-09, Asia/Manila. Source structure inspected; live database descriptions are historical reports.

## Implemented stack

Next.js 15.5.27 App Router, React 19.1.1, TypeScript and Supabase JavaScript client 2.117.3; Vercel branch-preview hosting. Versions are the inspected package baseline, not a promise of future versions. No Python backend or Captain AI integration is implemented in this baseline.

## Inventory interface

`/assets` is a redirect alias to `/private-memory/inventory`. This focused read-only view is inside the existing private-session boundary and reads entity summary fields through the authenticated Supabase client and existing RLS. Search and category selection operate on already-loaded records; no public seed inventory, new entity table or valuation/rent inference is introduced. Detail navigation uses existing private asset routes. Milestone 011 scopes this browser to Assets and adds shared protected Artwork and Other Records pages. The subtype classifier is shared with Home/Overview section links; unknown and unrelated subtypes remain in Other Records. Subscriptions retains its existing dedicated page. This is interface grouping, not a new data hierarchy or an inference of income/ownership. All new routes remain under the existing private-memory session boundary; section route keys reset filters.

Milestone 012 adds `/private-memory/artwork/new`, a protected title/description form using the existing audited `create_inventory_asset` RPC. The installed function's subtype allowlist is extended to artwork with security attributes preserved; no new table or direct browser write is introduced. Edition counts, sales and financial detail are not fields delivered by the 012 form.

Milestone 013 adds protected `/private-memory/artwork/[slug]/editions` and a summary on existing artwork detail routes. Versioned `entities.metadata.artwork_inventory` contains edition entries and one separate artwork-wide artist-proof object. No new entity subtype or table is required for this bounded extension. `update_artwork_inventory(uuid,jsonb,jsonb)` follows the established fixed-owner, guarded SECURITY DEFINER write pattern with empty search path and no anonymous execute. Expected-subtree comparison, row locking and atomic `entity_change_history` before/after entries protect edits while preserving unrelated metadata and review/visibility fields. Unknown counts remain null; remaining-to-print is a display calculation and never sale stock. No source counts, costs or payment data were imported.

Milestone 014 exposes compact edition/AP summaries on Artwork cards. Its query adds only the artwork-inventory JSON subtree and an exact artwork subtype filter; other sections retain the seven-column summary projection. It validates the subtree before display, keeps malformed/missing/empty information distinct, and preserves per-version unknowns without aggregating sale availability.

Milestone 015 adds protected `/private-memory/obligations`, linked from Home and private workspace navigation. It uses explicit parallel obligation/entity summary reads through existing RLS, shares workflow/deadline classification, and derives search/filter/priority ordering in the browser. Schedule labels remain distinct from deadlines. Existing audited editor/create routes handle mutations; this milestone adds no endpoint or database field.

Milestone 016 adds protected `/private-memory/obligations/deadline`, linked from workspace rows and the workflow editor. It edits only active obligations' existing due_at through a public invoker RPC over a private owner-guarded definer, sharing updated_at stale protection with workflow writes. Required reason/source and confirmation accompany changes; deadline before/after and context are audited atomically. No-op saves preserve version/history; completed/archive deadlines are read-only. New local times validate round trips and show an explicit browser timezone; unchanged instants preserve precision. No deadline is inferred from a schedule. The client reads six explicit summary fields; the RPC returns only the updated deadline/version summary.

Milestone 017 extends the existing audited creation RPC to permit a null related entity or an active linked record, preserving private/Unverified defaults and no inferred dates. A shared parent row lock protects active-link validation; an advisory transaction lock plus null-safe scoped title comparison protects duplicate submissions. The general Add obligation form replaces hardcoded domain drafts and reads only entity summaries. Home, Overview and the workspace label general responsibilities explicitly; every item can reach workflow/deadline management. No new endpoint, table or record is introduced by the migration.

Milestone 018 adds protected `/private-memory/obligations/details`, linked from the workspace/editor, plus a public invoker/private owner-guarded definer correction RPC. It updates title and related_entity_id independently of workflow/deadlines, using shared updated_at stale protection and the creation endpoint's target-scope advisory lock for duplicate checks. Changed fields and required correction context are audited atomically; no-ops preserve history/version. Active new parent links are row-locked; retained archived links are allowed, while completed/archive obligations stay protected. Change History renders current related-record names or General responsibility. No operational records or existing RPCs are changed by the migration.

Milestone 019 adds versioned subscription_review metadata, a protected per-service review form and a filtered Subscriptions workspace. Reads project only summary fields plus billing/review subtrees. The public invoker/private guarded-definer RPC uses expected-subtree stale protection and atomic entity audit, preserves unrelated fields/billing and assigns the review timestamp server-side. Owner usage and keep/review/cancel intention remain distinct from provider/payment state. Invalid/missing reviews stay explicit; existing unsupported mixed-currency/truthy-verification totals are replaced by per-record native billing labels. No operational subscriptions or reviews are imported.

Milestone 020 adds protected `/private-memory/subscriptions/new`, linked from Subscriptions. A blank confirmed service-name/description form uses the existing audited creation RPC with the subscription subtype added to its allowlist. Existing private/Unverified provenance defaults, global slug uniqueness, owner guard and audit remain intact; billing/review/renewal facts are not assigned. No new table or endpoint is introduced.

Milestone 021 adds a protected billing editor and versioned subscription_billing metadata, separate from legacy billing evidence/projections and actual charges/payments. Exact canonical decimal strings, independent null unknowns, native currency-code format, cadence/source note and a server timestamp are saved through a public invoker/private guarded-definer RPC. Expected-subtree comparison, row locking and atomic audit preserve legacy billing, usage review and unrelated fields; no-op saves preserve version/history. Cards expose the owner record and earlier source reference separately, without conversions or totals.

## Model and persistence

Entities, relationships, events, obligations and evidence form the universal model. Current TypeScript entity types are a narrower implementation subset; conceptual domains are not all separate implemented modules.

The [documented database schema](../current-database-schema.md) describes eight tables:

| Table | Responsibility |
| --- | --- |
| entities | Universal inventory |
| relationships | Typed entity links |
| obligations | Responsibility and workflow |
| documents | Evidence references |
| document_links | Evidence-to-record links |
| events | Dated occurrences |
| entity_change_history | Inventory audit |
| obligation_change_history | Obligation audit |

`database/schema.sql` is conceptual. Repository migrations are incremental and do not yet form a complete clean-room restoration set.

## Access boundaries

- Supabase email/password authentication is the primary login, with approved-account email links retained as a fallback. Neither flow creates arbitrary new users.
- The browser private-session boundary verifies identity, hides/unmounts protected views on sign-out or identity change, and suppresses stale responses.
- Database RLS and owner guards remain the authority for record access. The browser boundary does not grant ownership.
- Historical inspections report authenticated SELECT-only table grants, no anon table grants and controlled audited RPC writes.
- Vercel deployment protection is a separate access layer; it must not be mistaken for application authorization.

## Obligation semantics

Six workflow choices: Requires You, Waiting On, In Progress, Scheduled, Completed, Deferred / Awaiting Funding. Legacy states remain supported where documented.

Owner attention is separate from workflow. Waiting/deferred items do not inflate Requires You. Real due dates can still be overdue while work is deferred. Scheduled dates are separate from deadlines. Unassigned attention records can show Needs Review. Archived records remain in history and leave active views.

Workflow saves use validation, stale-version protection and atomic audit entries. Preserve provenance, financial metadata and unsupported dates rather than infer changes.

## Evidence and recovery

Operational database, authoritative document repository and secret vault are separate. Captain AI is a future interpreter of evidence, not storage authority. Database backup availability does not prove restoration or document-object recovery.

Sources: inspected package.json, model and workflow/session source; existing architecture, schema, milestone and security documents. See [Current State](CURRENT_STATE.md) for verification limits.
