export const evidenceCategories = { registration: "Registration", import: "Import & customs", insurance: "Insurance", maintenance: "Service history & annual plan", passport: "Passport dates & renewal", credential: "ID & licence evidence", medical: "Medical record", lease: "Rental agreement" } as const;
export type EvidenceCategory = keyof typeof evidenceCategories;
export type EvidenceSummary = {
  version: 1; category: EvidenceCategory; bundle_id: string; role: "primary" | "supporting"; extracted_on: string;
  fields: { label: string; value: string | null; source: string }[];
  notes: { kind: "owner" | "review" | "source"; text: string; source: string }[];
  sources: { label: string; url: string }[];
};
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function exact(value: Record<string, unknown>, keys: string[]) { return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)); }
function text(value: unknown, max: number): value is string { return typeof value === "string" && value.length > 0 && value.length <= max && value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value); }
function date(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function safeGmailSource(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 400) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "mail.google.com" || url.port || url.username || url.password) return null;
    if (!/^\/mail\/u\/(?:\d+\/)?$/.test(url.pathname) || !/^#all\/[a-f0-9]{8,32}$/i.test(url.hash)) return null;
    const keys = [...url.searchParams.keys()];
    if (keys.some(key => key !== "authuser") || url.searchParams.getAll("authuser").length > 1) return null;
    const account = url.searchParams.get("authuser");
    if (account !== null && !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(account)) return null;
    return url.href;
  } catch { return null; }
}
export function parseEvidenceSummary(value: unknown): EvidenceSummary | null {
  if (!object(value) || !exact(value, ["version", "category", "bundle_id", "role", "extracted_on", "fields", "notes", "sources"])) return null;
  if (value.version !== 1 || typeof value.category !== "string" || !Object.hasOwn(evidenceCategories, value.category) || !["primary", "supporting"].includes(String(value.role))) return null;
  if (typeof value.bundle_id !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value.bundle_id) || !date(value.extracted_on)) return null;
  if (!Array.isArray(value.fields) || value.fields.length > 16 || !Array.isArray(value.notes) || value.notes.length > 8 || !Array.isArray(value.sources) || value.sources.length > 8) return null;
  if (value.fields.some(field => !object(field) || !exact(field, ["label", "value", "source"]) || !text(field.label, 70) || (field.value !== null && !text(field.value, 400)) || !text(field.source, 180))) return null;
  if (new Set(value.fields.map(field => field.label.toLowerCase())).size !== value.fields.length) return null;
  if (value.notes.some(note => !object(note) || !exact(note, ["kind", "text", "source"]) || !["owner", "review", "source"].includes(String(note.kind)) || !text(note.text, 700) || !text(note.source, 180))) return null;
  if (value.sources.some(source => !object(source) || !exact(source, ["label", "url"]) || !text(source.label, 100) || !safeGmailSource(source.url))) return null;
  return value as EvidenceSummary;
}
export type EvidenceRow = { id: string; title: string; status: string; source_url: string | null; evidence_summary?: unknown; source_note?: unknown; recorded_by?: unknown; lease_record?: unknown };
export type EvidenceGroup<T extends EvidenceRow> = { primary: T; supporting: T[]; summary: EvidenceSummary | null };
export function groupEvidence<T extends EvidenceRow>(rows: T[]): EvidenceGroup<T>[] {
  const parsed = new Map(rows.map(row => [row.id, parseEvidenceSummary(row.evidence_summary)]));
  const bundles = new Map<string, T[]>();
  for (const row of rows) {
    const summary = parsed.get(row.id);
    if (summary) bundles.set(summary.bundle_id, [...(bundles.get(summary.bundle_id) ?? []), row]);
  }
  const consumed = new Set<string>();
  const result: EvidenceGroup<T>[] = [];
  for (const row of rows) {
    if (consumed.has(row.id)) continue;
    const summary = parsed.get(row.id) ?? null;
    const bundle = summary ? bundles.get(summary.bundle_id)! : [];
    const primaries = bundle.filter(item => parsed.get(item.id)?.role === "primary");
    if (summary && primaries.length === 1 && bundle.every(item => parsed.get(item.id)?.category === summary.category)) {
      const primary = primaries[0];
      bundle.forEach(item => consumed.add(item.id));
      result.push({ primary, supporting: bundle.filter(item => item.id !== primary.id), summary: parsed.get(primary.id)! });
    } else {
      consumed.add(row.id); result.push({ primary: row, supporting: [], summary });
    }
  }
  return result;
}
export function filterEvidenceGroups<T extends EvidenceRow>(groups: EvidenceGroup<T>[], query: string): EvidenceGroup<T>[] {
  const search = query.trim().toLowerCase();
  if (!search) return groups;
  return groups.filter(group => [group.primary.title, ...group.supporting.map(row => row.title), ...(group.summary?.fields.flatMap(field => [field.label, field.value ?? ""]) ?? []), ...(group.summary?.notes.map(note => note.text) ?? [])].join(" ").toLowerCase().includes(search));
}
