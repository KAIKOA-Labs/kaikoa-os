# KAIKOA OS — Bounded isolated recovery procedure

Prepared on 2026-10-08 after the first backup proved too old. This procedure is ready for review; no new restoration, resource creation or deployment is authorized by its existence.

## 1. Source and backup preflight

- Use the original `kaikoa-os` project. Inspect the actual newest COMPLETED backup timestamp, with UTC/Manila conversion, before creating any copy.
- Confirm the backup includes the current schema, owner account, inventory, obligations and both audit histories. The October 8 02:25:11 Manila snapshot predates the earliest surviving inventory rows at 03:38:25 and is unsuitable.
- Capture a read-only source snapshot with [recovery-snapshot.sql](../database/tests/recovery-snapshot.sql). It captures metadata, exact row counts and content fingerprints for all eight tables in the same read-only, repeatable-read transaction. Rows are sorted by primary key and timestamps use UTC. Use the same query on source and target; do not export row bodies to chat or Git. These MD5 fingerprints detect comparison differences; they are not encryption or a security signature. Missing required tables cause an error and stop acceptance.
- Save the baseline in an approved private durable location before starting restoration. Tool/session memory alone is insufficient. Snapshot output is private; the repository contains only the query and procedure. Today's source syntax check is not the baseline for a future backup.
- Coordinate the baseline with the backup recovery point. If writes occurred between that point and the baseline, explain the differences from evidence; do not claim exact equality or data loss without resolving them. Record the recovery point and observed data-loss window.

## 2. Approved isolated copy

- Review the current dashboard cost and the exact new project name. The previous $9.68/month estimate is historical; inspect the new estimate before approval.
- Use **Restore to new project**, operated by the founder. Never click a restore that replaces the original database. Confirm the new project reference differs from the source.
- Record restoration start, completion status and readiness independently. ACTIVE_HEALTHY alone does not prove restoration completed.
- Keep the live application's environment pointed at the original project. Do not replay repository migrations or seed records into the copy to conceal a failed or outdated recovery point.

## 3. One bounded verification pass

- Run the same snapshot and exact row-count/content-fingerprint queries against the isolated copy. Compare tables/columns/defaults, policies, grants, constraints and public/private function definitions, then inventory, obligations, document links and both complete audit histories.
- All eight tables must exist, have RLS and authenticated SELECT, and deny anonymous reads and authenticated direct writes. Verify all eight public write endpoints and the private workflow function retain the expected definitions and execute grants.
- Verify the restored owner identity internally against the owner policies without publishing the identifier. Demonstrate owner reads and non-owner denial on the restored database; label SQL role/JWT simulations as simulations. Administrative SELECT results alone do not prove owner access.
- Verify actual owner access through an explicitly approved isolated client when required by the recovery acceptance scope. Restore-to-new-project does not copy Auth settings/API keys; review any needed isolated configuration first. Never repoint the live application as a shortcut.
- If a baseline is lost or a comparison fails, stop and preserve evidence. Do not mark recovery passed based on table presence, a green project badge or a READY deployment.

## 4. Evidence, cleanup and closure

- Record source recovery point, target, checks, exact comparison outcome, observed recovery duration and limitations. Commit only public-safe summaries; keep private manifests separately.
- Obtain approval for deletion of the exact disposable copy, then verify its absence and original-project health. Retain the approved private evidence according to the agreed policy.
- Close Milestone 007 only when the applicable recovery acceptance checks pass and the [separate document recovery plan](milestone-007-document-recovery-plan.md) is reviewed with outstanding provider choices explicitly recorded. File-object recovery testing remains a separate sensitive-import prerequisite; no files are covered by database physical backups alone.

References: [Current State](control-pack/CURRENT_STATE.md), [security/recovery gate](security-recovery-checklist.md), and https://supabase.com/docs/guides/platform/clone-project.
