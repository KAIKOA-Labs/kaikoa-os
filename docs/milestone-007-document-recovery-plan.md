# KAIKOA OS — Separate document recovery plan

Prepared locally on 2026-10-08. Proposed procedure; no files have been imported, copied, restored or deleted under this plan. Destination, access and retention choices require founder review before execution.

## Preserve the architecture

Authoritative documents, operational database and secret vault remain separate. `documents` records provider references and provenance; `document_links` connects evidence to records. A database restore recovers these references, not the referenced file bytes. Never store secret-vault contents in KAIKOA OS or commit private files, manifests, provider identifiers or exports to this public repository.

The live Supabase metadata inspection during the recovery attempt found zero Storage buckets and objects. This is not an inventory of external document providers. The 15:39 dashboard screenshot explicitly states that Storage objects are excluded from database backups. No document-object restoration has been tested.

## Backup procedure proposed for review

1. Identify the authoritative provider and exact in-scope files before an import. Preserve each file's provider reference, version, provenance and access rules; treat unverified values as unknown.
2. Choose a private recovery destination independent of the original files, with owner-controlled access and encryption. Provider trash or version history alone is not the separate recovery copy. No destination or new paid service is authorized by this document.
3. Copy the actual bytes and required export formats. For native provider documents, choose and test the export format needed to preserve their content; do not assume a link or metadata row is a backup.
4. Keep a private manifest mapping the database document/link references to original provider versions, recovery paths, file sizes, checksums and backup time. Compare checksums for byte-preserving copies. Store this manifest with the protected recovery copy, never in Git.
5. Pair the verified file set with a database recovery point containing its references. Record the times and any gap. Preserve the previous verified recovery set until its replacement passes checks; agree retention and allowed data-loss/recovery-time targets before sensitive imports.

Drive mutations require approval identifying exact source files, destination and consequences. Backup scheduling, automatic overwrite/deletion and additional paid infrastructure are not authorized here.

## Isolated acceptance test before sensitive imports

Use one benign test document in an explicitly approved test location. Create its reference through the approved application path, back up the bytes and private manifest, then restore into a different isolated location. Do not delete or overwrite the original to demonstrate recovery.

Verify recovered bytes/checksum, readability, provenance and reference mapping, owner access and unauthorized-user denial. If provider-native export changes the bytes, define the content/format acceptance check in advance and record its limits. Coordinate this with a successful database restore so restored links resolve to recovered files. Updating provider references requires a separately reviewed write path; do not silently edit production rows.

Record the observed backup and recovery times, pass/fail results and limitations without private identifiers. After evidence is captured, obtain approval for deletion of the exact disposable test artifacts and verify cleanup. A written plan is not a passed restoration test.

## Open decisions and gates

- Authoritative provider, private backup destination, permitted export formats, access configuration and retention/recovery targets are undecided.
- Database recovery of the current application remains unverified. The first copy used a backup predating current inventory/Auth records and was deleted, with cleanup verified at 15:37 Manila.
- Document recovery execution and sensitive imports remain blocked pending the applicable approvals and successful isolated checks.

References: [architecture](control-pack/ARCHITECTURE.md), [working protocol](control-pack/WORKING_PROTOCOL.md), [security and recovery gate](security-recovery-checklist.md), and https://supabase.com/docs/guides/platform/backups.
