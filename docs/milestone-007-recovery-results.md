# Milestone 007 — isolated database recovery results

Verified on 2026-10-09, Asia/Manila. Database recovery verification and disposable-copy cleanup passed within the scope below. Milestone 007 is complete for its bounded authorization/database-recovery/document-plan scope; final documentation publication and preview verification follow this snapshot.

## Recovery point and evidence

- Source: original `kaikoa-os`. Physical backup: 2026-10-08 18:24:25 UTC (October 9, 02:24:25 Manila), explicitly COMPLETED in the founder's inspected dashboard screenshot.
- Founder created `kaikoa-os-recovery-test-2026-10-09` after reviewing $9.68/month additional compute and $0 disk. It is a separate project in the original organization and Singapore region; the live application was not repointed.
- Creation timestamp: 05:37:32 Manila. Source dashboard screenshot at 05:45:52 explicitly marks this restoration COMPLETED. Exact completion time was not captured; creation-to-confirmation is an observed upper bound of approximately 8 minutes 20 seconds, not exact restoration duration.
- A private source snapshot was saved durably before creation, at 05:36:04 Manila. Target snapshot executed at 05:43:31. Snapshot outputs contain no row bodies or credentials and remain outside Git.
- All eight tables/columns/defaults, table permissions, RLS flags, policies, constraints and nine public/private function definitions and execute grants match the source baseline. Exact row counts and canonical content fingerprints match for all eight tables, including complete entity and obligation audit histories. Auth account count and Storage bucket/object counts also match.
- All five readiness assertions passed: required tables present, RLS enabled, authenticated SELECT enabled, no authenticated direct writes and no anonymous reads.
- Restored owner reads passed for all eight tables against administrative expected counts, using the restored account identity in a simulated authenticated JWT/role. Non-owner reads, all eight public RPC denials, anonymous reads/execute restrictions and absence of direct-write grants passed in a read-only rolled-back transaction.
- Stable owner identity, email confirmation, role and app-metadata fingerprints match between original and copy. Source Auth updated_at is later than the backup, while target updated_at is not. The cause remains unverified; password hashes, sessions and complete Auth state were not compared. Auth settings/API keys are not certified by these checks.
- Original source remains ACTIVE_HEALTHY at the closeout inspection. No source schema/data, migrations, provider settings or live environment variables were changed by this recovery test.

## Interpretation and limits

The source baseline postdates the recovery point. Timestamp preflight found no surviving application rows changed afterward; timestamps alone cannot exclude deletions or schema changes. The subsequent exact snapshot comparisons establish equality of the compared application data and metadata at the two inspection points, not continuous write history or whole-instance equality. No measured loss was found in the compared application state. No RPO/RTO service promise is inferred.

Database role/JWT assertions are simulations, not restored-project browser acceptance. Yesterday's 16 real-session HTTP authorization checks remain their separately recorded evidence; no claim is made that they were rerun today. The newer conventional password-login interface's live acceptance remains pending separately.

The separate document recovery plan has been reviewed for architectural consistency: actual bytes, independent private copies, provenance/checksums, paired database references and isolated access checks remain required. Authoritative provider, destination, export formats, access, retention and recovery targets remain explicitly undecided. No document objects or external provider files were restored. Sensitive imports remain blocked until the separate file-recovery prerequisites pass.

## Closure

Founder deleted the exact disposable copy at 05:49. At 05:50 the connector list contains only the original ACTIVE_HEALTHY source; all eight source tables, inventory, obligations, both audit histories and one owner account remain present. Cleanup is verified; exact billing settlement is not. Source presence is not an extra complete before/after comparison. The private baseline and target verification record are saved durably outside Git. One coherent documentation publication and matching preview verification follow this snapshot. Do not repeat the passed restoration merely to close the session.

References: [procedure](milestone-007-recovery-procedure.md), [document plan](milestone-007-document-recovery-plan.md), [current state](control-pack/CURRENT_STATE.md).
