# KAIKOA OS — Current State

Reviewed: 2026-10-10, Asia/Manila. This is the active checkpoint; historical narratives are linked below.

## Verified baseline

- Development branch: `milestone-001-hull`; `main` remains protected from this work.
- Local and remote were clean and aligned at `c26e1b9d9b46318cece0ad6e1e3086c6f6660c56`, with matching READY preview `dpl_DdTzNKoqcCJkE1fGKMWvbyGTFGT6` before Milestone 029.
- Earlier read-only comparison confirmed all nine original saved credential entities and their creation/metadata audits. Current count/type verification confirms ten saved credentials including two certifications, following the owner-requested addition. Original unknown dates/suffixes and Needs verification state were preserved in the private source file. The founder gives general inventory/interface feedback on 2026-10-10; individual field interactions are not independently certified.
- No agent credential write was performed. Existing records and audit history are preserved.
- Existing credential RPC signatures remain intact. Milestone 029 adds only the separately audited grouping RPC described below; Auth, RLS, protection and provider settings are unchanged.

## Milestone 029 — specific credential groups

The founder requests separate national-ID and driving-license groups and a country-specific aviation bundle, delegating cleaner naming. Use National IDs, Driving Licenses and Philippines PPL (Private Pilot Licence), alongside Passports, Other Licenses, Certificates and Other Credentials. Existing credential types automatically determine the first two groups. Explicit membership is stored separately in `entities.metadata.credential_group`; it overrides the automatic group without altering credential type or other facts. Search includes the group label; empty groups remain hidden and filters/renewal sorting still apply.

Migration `20261010035736_milestone_029_credential_groups` adds `public.update_credential_group(uuid,jsonb,text,boolean)` as an invoker wrapper around the private owner-guarded definer. It uses an empty search path, denied anonymous execute, row lock, expected-group comparison, confirmation, enum validation, no-op preservation and atomic before/after audit. Null clears an assignment. Only active credential/passport records are accepted; no new table or data assignments are made by the migration.

The generic importer accepts an optional validated group, previews it and assigns it through the same authenticated browser session only after exact existing-record comparison or verified creation. Read-back verifies the assigned group and retained facts. Absent group leaves existing membership untouched. Stale/uncertain writes stop the batch; repeat matching assignments are skipped. The private file was replaced in place with three owner-requested aviation memberships; all ten source rows and their previous metadata remain intact. Grouping is prepared, not yet applied to those live records.

Verification: 66 unit tests, TypeScript and production build passed. Rolled-back synthetic role/JWT SQL assertions passed for owner/non-owner/anonymous access, confirmation, stale/no-op/audit, clear, legacy passport, archived/missing/unrelated targets and preservation of existing entities/history. These are database simulations, not real browser-session checks. Live function grants/security attributes were inspected; security advisors show only the previous eight public definer warnings and existing password-protection warning, with no new grouping warning. Private file validation passed locally. Automatic review rejected sending the private source list to Supabase for an exact ten-row comparison; that check was abandoned. Owner-browser importer comparison remains the completion path.

Publication subject: `Milestone 029: add explicit credential groups`. Resolve its exact matching READY development preview after publication; do not use a protected-page bypass. Owner-visible updated-layout acceptance and the three audited group assignments remain pending.

## Milestone 028 — prior credential groups

Published at `c26e1b9d9b46318cece0ad6e1e3086c6f6660c56`, with matching READY preview `dpl_DdTzNKoqcCJkE1fGKMWvbyGTFGT6`. The original four display groups were verified with 63 tests, TypeScript and production build, without schema/data mutation. Its privately prepared addition is now saved as the tenth credential by count/type evidence. Milestone 029 refines the four-group taxonomy; exact owner save interaction and mobile acceptance are not independently certified.

## Milestone 027 — protected inventory import

The founder requests continued development, removal of bottlenecks and upload of their previously listed ID/license inventory. Routine implementation and verified development publication are authorized; this does not authorize bypassing owner authentication.

The protected `/private-memory/credentials/import` route accepts a local JSON metadata list, previews every record and requires confirmation. It calls the existing `create_credential_record` endpoint through the current owner's browser session. It adds no database endpoint, table or migration. The workspace navigation now includes IDs & Licenses, and its inventory links directly to Import listed inventory.

Each input is strictly validated before any write: versioned shape, supported keys/types, 1–50 records, 64 KB cap, source note, four-digit suffix only, valid dates, normalized-name uniqueness and Needs verification state. Unknown numbers/dates remain null. No validity, issuer detail, expiry, reminder or operational privilege is inferred.

Saves are sequential and individually audited by the existing endpoint. Identity is reverified between requests; unmount/account change stops remaining work. Each new row is read back and compared with the preview. Exact matching records are skipped on retry; archived, unrelated or conflicting records stop without overwrite. A failed or uncertain response stops the batch. Earlier successful saves are retained, so the batch is not an all-or-nothing transaction. In-flight duplicate submission and stale file reads are suppressed. The file and preview are not stored in URLs, logs, browser persistence or the repository.

Verification: 62 unit tests passed, including eight new parser/import-runner tests covering privacy validation, duplicate/conflict handling, interrupted retry, session loss and uncertain read-back. TypeScript and production build passed with the baseline dependency versions. The private import file was separately validated with this same parser; all source dates and suffixes are left unknown pending current-document evidence. React review covers native labels/table headers, explicit confirmation, keyboard-accessible scroll, stale response guards and shared private-session protection. At the original publication checkpoint, no owner-browser import or visible card acceptance was claimed. Subsequent read-only verification now confirms the nine matching records and their audits; the founder provides general visible inventory feedback. No agent-operated browser or raw HTTP save capture is claimed.

Milestone 027 was published at `9498af431896cf972f8f773a2de35657e38eeeb0`, with matching READY preview `dpl_3gpyRHkzbb5nZgDU9DBdZrUjvFhh`. Use the stable branch alias rather than historical per-deployment links:

`https://kaikoa-os-git-milestone-001-hull-ehzobel-4943.vercel.app/private-memory/credentials/import`

## Exact next operation

1. The founder opens the import route in their own authenticated browser, using normal KAIKOA OS login within the existing protection boundary.
2. Download the revised private inventory file, review the Group column, confirm and select Import records. Exact matching saved rows are skipped while the three listed group changes are applied; conflicting credential details stop for review rather than overwrite.
3. Verify the importer read-back and protected cards under the new groups. A scoped read-only aggregate check can confirm counts and group-change audits without disclosing private row bodies or owner identifiers.
4. Record owner-visible acceptance and group assignment evidence. Ten credential records are saved; the three aviation memberships are still prepared. No agent credential/group data write is claimed.

Google rejected sign-in in the earlier cloud browser as an unrecognized device. Do not retry it, weaken Vercel protection, impersonate the owner with SQL, or use a management connector as an alternate credential-write path. The founder's local browser session does not transfer to this agent. No agent-controlled parallel browser is needed for this operation.

## Preserved gates and scope

- Milestone 026 delivered the masked workspace and audited create/update path. Reminder dates are in-app records; notification delivery is not implemented.
- Milestone 007 is complete only within the recovery/authorization scope recorded in ROADMAP.md. Actual restored browser login/full Auth credential state and document-object recovery are not certified. Do not repeat passed checks without a relevant change or unresolved failure.
- Full ID numbers, scans, sensitive file-image imports and notification automation remain outside this increment. File recovery/provider decisions retain their documented gates.
- Additional paid infrastructure, production restoration and repository governance changes need their own concrete scope. Preserve existing universal entities, audit history, architecture and Phase A–G sequence.

## Historical evidence

The previous Current State file already contained truncated tool-output text and incomplete older narratives. Its exact bytes are preserved in [the pre-027 archive](archive/2026-10-10-pre-027-current-state.md); this active checkpoint does not invent or certify its missing content. ROADMAP.md, DECISIONS.md and individual milestone/recovery documents retain the earlier evidence and acceptance limits. Read historical narratives as dated reports, not competing next-session instructions.
