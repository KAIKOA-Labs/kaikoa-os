# Milestone 030 — private Drive document references

The founder asks to connect the prepared Drive document foundation to the existing application. The first bounded connection preserves Drive originals and the universal documents/document_links model. Source references stay private; the application never receives ChatGPT's provider credentials.

## Result

- `/private-memory/documents`: operational-library and separate-private-vault folder links; source-labelled document references; search and recent reference history.
- `/private-memory/documents/new`: owner-confirmed non-sensitive file reference and optional active entity association, followed by reference/link readback.
- Asset details: linked document references through existing RLS.
- One benign TXT fixture is saved in the prepared operational Drive inbox. Its exact text and owner-only file permission are verified through the connected Drive tool.
- Three precise folder/test-file references are connected with explicit agent attribution and founder authorization. No owner JWT is impersonated for these saves.

## Backend contract

The incremental migration adds only `document_change_history` and narrow reference/link indexes/RPCs. Existing tables, authentication, RLS and operational inventory are preserved. The new audit table is owner-readable and denies direct browser mutation. A public SECURITY INVOKER wrapper invokes the private owner-guarded definer with an empty search path and no anonymous execution. Its owner is resolved from a checksum-verified existing function at migration time, without putting the identity in Git.

The endpoint validates title, source note, canonical provider URL, type, explicit confirmation, non-sensitive declaration and optional active parent. It locks the parent, serializes duplicate provider references and uses unique indexes. Exact retries preserve rows/version/audit; conflicting facts stop without overwriting. A later link to another active entity reuses the document and appends only the new link audit. Creation and link audit writes are atomic with the corresponding mutation. No source text, dates, validity, payment state or obligation is inferred.

## Verification and limits

69 unit tests passed. TypeScript and the final production build passed. The committed rolled-back SQL suite checks owner/non-owner/anonymous access, direct-write denial, malicious/invalid links, declaration/confirmation, duplicates/conflicts, optional links and attribution. These role/JWT assertions are simulations; they do not establish browser acceptance or newly observed real-account HTTP denial.

Drive metadata verifies both folder roots and the synthetic file are restricted to the existing owner. Actual Drive text matches the original fixture. Aggregate database readback confirms one reference of each supported type and three matching agent audits. The prior entity, obligation and audit counts remain unchanged, and no actual asset association is invented. Security advisors retain only the known baseline warnings. No new provider, OAuth, authentication or protection settings are changed.

This is a **reference connection**, not an automatic Drive integration. App-specific Google authorization, scoped provider access, exact folder/file allowlisting, reading/extraction and independent file recovery remain unfinished. A private folder is not an OAuth scope boundary or an independent backup. Sensitive imports remain gated. Future restoration coverage must include the new audit table alongside the previous eight tables.

## Next founder check

Open the Documents workspace in the normal authenticated browser. Confirm the two location cards and the harmless test reference; verify their Open in Drive links. Continue with a separately scoped read-only Google authorization/read-review increment after that checkpoint. Keep secrets out of chat and preserve unknown source facts.

See [Current State](control-pack/CURRENT_STATE.md) for the active checkpoint, development publication and remaining gates.
