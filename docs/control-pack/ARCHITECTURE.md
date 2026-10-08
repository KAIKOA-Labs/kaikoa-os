# KAIKOA OS — Architecture

Reviewed: 2026-10-08, Asia/Manila. Source structure inspected; live database descriptions are historical reports.

## Implemented stack

Next.js 15.5.27 App Router, React 19.1.1, TypeScript and Supabase JavaScript client 2.117.3; Vercel branch-preview hosting. Versions are the inspected package baseline, not a promise of future versions. No Python backend or Captain AI integration is implemented in this baseline.

## Inventory interface

`/assets` is a redirect alias to `/private-memory/inventory`. This focused read-only view is inside the existing private-session boundary and reads entity summary fields through the authenticated Supabase client and existing RLS. Search and category selection operate on already-loaded records; no public seed inventory, new entity table or valuation/rent inference is introduced. Detail navigation uses existing private asset routes.

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
