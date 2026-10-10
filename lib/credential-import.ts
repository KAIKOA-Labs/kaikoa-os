import { credentialFromMetadata, credentialTypeLabels, isCredentialGroup, isIsoDate, type CredentialGroup, type CredentialRecord, type CredentialType } from "./credential-record.ts";

export type CredentialImportRow = {
  name: string;
  credential_type: CredentialType;
  issuer: string | null;
  last_four: string | null;
  expires_on: string | null;
  reminder_on: string | null;
  record_state: "needs_review";
  source_note: string;
  group?: CredentialGroup;
};
export const maxCredentialImportBytes = 64 * 1024;
const keys = ["name", "credential_type", "issuer", "last_four", "expires_on", "reminder_on", "record_state", "source_note"];
export function credentialSlug(name: string) {
  return name.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase().replace(/^-+|-+$/g, "");
}
function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function safeText(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && Array.from(value.trim()).length >= min && Array.from(value.trim()).length <= max && !/[0-9]{7,}/.test(value);
}
export function parseCredentialImport(text: string): CredentialImportRow[] {
  if (new TextEncoder().encode(text).length > maxCredentialImportBytes) throw new Error("Use an inventory file smaller than 64 KB.");
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error("Choose a valid JSON inventory file."); }
  if (!object(value) || value.version !== 1 || Object.keys(value).some(key => !["version", "records"].includes(key)) ||
      !Array.isArray(value.records) || value.records.length < 1 || value.records.length > 50) {
    throw new Error("Use a version 1 inventory with 1 to 50 records.");
  }
  const slugs = new Set<string>();
  return value.records.map((row: unknown, index: number) => {
    const invalid = () => new Error(`Record ${index + 1} needs correction. Use supported fields, descriptive text, four digits only, valid dates and Needs verification.`);
    if (!object(row) || keys.some(key => !Object.hasOwn(row, key)) || Object.keys(row).some(key => !keys.includes(key) && key !== "group") ||
        (Object.hasOwn(row, "group") && !isCredentialGroup(row.group)) ||
        !safeText(row.name, 2, 120) || !safeText(row.source_note, 4, 1000) ||
        !(row.issuer === null || safeText(row.issuer, 1, 120)) ||
        typeof row.credential_type !== "string" || !Object.hasOwn(credentialTypeLabels, row.credential_type) ||
        !(row.last_four === null || typeof row.last_four === "string" && /^[0-9]{4}$/.test(row.last_four)) ||
        !(row.expires_on === null || isIsoDate(row.expires_on)) || !(row.reminder_on === null || isIsoDate(row.reminder_on)) ||
        row.record_state !== "needs_review" || (row.reminder_on !== null && (row.expires_on === null || String(row.reminder_on) > String(row.expires_on)))) throw invalid();
    const slug = credentialSlug(row.name);
    if (!slug) throw invalid();
    if (slugs.has(slug)) throw new Error(`Record ${index + 1} duplicates another name in this inventory.`);
    slugs.add(slug);
    return { ...row, name: row.name.trim(), issuer: row.issuer?.trim() ?? null, source_note: row.source_note.trim() } as CredentialImportRow;
  });
}

export type ExistingCredential = { id: string; slug: string; subtype: string | null; status: string; credential_record: unknown; credential_group?: unknown };
export type ImportProgress = { added: number; skipped: number; total: number; grouped?: number };
export type CredentialImportAdapter = {
  checkSession: () => Promise<void>;
  findBySlug: (slug: string) => Promise<ExistingCredential | null>;
  create: (row: CredentialImportRow) => Promise<string>;
  readById: (id: string) => Promise<ExistingCredential | null>;
  setGroup?: (id: string, expectedGroup: unknown, group: CredentialGroup) => Promise<void>;
};
function matches(row: CredentialImportRow, stored: ExistingCredential | null) {
  if (!stored || stored.status === "ARCHIVED" || !["credential", "passport"].includes(stored.subtype ?? "") || stored.slug !== credentialSlug(row.name)) return false;
  const record: CredentialRecord | null = credentialFromMetadata(stored.credential_record);
  return record !== null && keys.filter(key => key !== "name").every(key => record[key as keyof CredentialRecord] === row[key as keyof CredentialImportRow]);
}
// Individual owner-audited saves; a failed batch never silently retries a write.
export async function runCredentialImport(rows: CredentialImportRow[], adapter: CredentialImportAdapter, progress: (value: ImportProgress) => void) {
  const result: ImportProgress = { added: 0, skipped: 0, total: rows.length };
  for (const row of rows) {
    await adapter.checkSession();
    const existing = await adapter.findBySlug(credentialSlug(row.name));
    let current = existing;
    await adapter.checkSession();
    if (existing) {
      if (!matches(row, existing)) throw new Error("A name already exists with different details. Review IDs & Licenses before continuing; nothing was overwritten.");
      result.skipped++;
    } else {
      const id = await adapter.create(row);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error("A save could not be confirmed. Check IDs & Licenses before retrying.");
      await adapter.checkSession();
      const saved = await adapter.readById(id);
      await adapter.checkSession();
      if (!saved || saved.id !== id || !matches(row, saved)) throw new Error("A record may be saved, but its details could not be confirmed. Check IDs & Licenses before retrying.");
      result.added++;
      current = saved;
    }
    if (row.group !== undefined && current?.credential_group !== row.group) {
      if (!current || !adapter.setGroup) throw new Error("Grouping is unavailable. No credential details were overwritten.");
      await adapter.checkSession();
      await adapter.setGroup(current.id, current.credential_group ?? null, row.group);
      await adapter.checkSession();
      const grouped = await adapter.readById(current.id);
      await adapter.checkSession();
      if (!grouped || grouped.id !== current.id || !matches(row, grouped) || grouped.credential_group !== row.group) throw new Error("A group change could not be confirmed. Check IDs & Licenses before retrying.");
      result.grouped = (result.grouped ?? 0) + 1;
    }
    progress({ ...result });
  }
  return result;
}
