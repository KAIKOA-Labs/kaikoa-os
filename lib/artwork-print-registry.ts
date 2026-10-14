/** Read-only validation model for physical fine-art prints. Separate from existing artwork_inventory v1. */
export type PrintKind = "numbered" | "artist_proof";
export type PrintRecord = {
  edition_label: string;
  kind: PrintKind;
  number: number;
  production: "unknown" | "printed_signed" | "framed_boxed";
  location: string | null;
  availability: "unknown" | "available" | "reserved" | "sold" | "gift";
  fulfillment: "unknown" | "held" | "awaiting_handover" | "shipped" | "delivered";
  payment: "unverified" | "reported_paid" | "verified_paid" | "not_applicable";
  allocation: string | null;
  source_note: string;
};
export type EditionRule = { edition_label: string; numbered_limit: number; artist_proof_limit: number; reproduction_locked: boolean };
export type PrintRegistry = { version: 1; rules: EditionRule[]; prints: PrintRecord[] };
function record(value: unknown, fields: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid physical print record.");
  const result = value as Record<string, unknown>;
  if (Object.keys(result).length !== fields.length || fields.some(key => !Object.prototype.hasOwnProperty.call(result, key))) throw new Error("Unexpected physical print fields.");
  return result;
}
function textField(value: unknown, max: number, required = false): string {
  if (typeof value !== "string" || value.trim() !== value || value.length > max || (required && !value)) throw new Error("Missing or invalid source text.");
  return value;
}
function optionalText(value: unknown, max: number): string | null { return value === null ? null : textField(value, max, true); }
function whole(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) throw new Error("Print number outside edition allowance.");
  return value;
}
function choice<T extends string>(value: unknown, allowed: readonly string[]): T {
  if (typeof value !== "string" || !allowed.includes(value)) throw new Error("Unsupported print status.");
  return value as T;
}
export function validatePrintRegistry(value: unknown): PrintRegistry {
  const input = record(value, ["version", "rules", "prints"]);
  if (input.version !== 1 || !Array.isArray(input.rules) || !Array.isArray(input.prints) || input.rules.length > 50 || input.prints.length > 1000) throw new Error("Invalid registry version or size.");
  const byLabel = new Map<string, EditionRule>();
  const rules = input.rules.map(item => {
    const row = record(item, ["edition_label", "numbered_limit", "artist_proof_limit", "reproduction_locked"]);
    const edition_label = textField(row.edition_label, 120, true);
    if (byLabel.has(edition_label.toLowerCase()) || typeof row.reproduction_locked !== "boolean") throw new Error("Duplicate or invalid edition rule.");
    const rule: EditionRule = { edition_label, numbered_limit: whole(row.numbered_limit, 1, 1000000), artist_proof_limit: whole(row.artist_proof_limit, 0, 1000000), reproduction_locked: row.reproduction_locked };
    byLabel.set(edition_label.toLowerCase(), rule);
    return rule;
  });
  const seen = new Set<string>();
  const prints = input.prints.map(item => {
    const row = record(item, ["edition_label", "kind", "number", "production", "location", "availability", "fulfillment", "payment", "allocation", "source_note"]);
    const edition_label = textField(row.edition_label, 120, true);
    const rule = byLabel.get(edition_label.toLowerCase());
    if (!rule) throw new Error("Print has no authorized edition rule.");
    const kind = choice<PrintKind>(row.kind, ["numbered", "artist_proof"]);
    const number = whole(row.number, 1, kind === "numbered" ? rule.numbered_limit : rule.artist_proof_limit);
    const key = edition_label.toLowerCase() + "|" + kind + "|" + number;
    if (seen.has(key)) throw new Error("Duplicate print identity.");
    seen.add(key);
    const production = choice<PrintRecord["production"]>(row.production, ["unknown", "printed_signed", "framed_boxed"]);
    const availability = choice<PrintRecord["availability"]>(row.availability, ["unknown", "available", "reserved", "sold", "gift"]);
    const fulfillment = choice<PrintRecord["fulfillment"]>(row.fulfillment, ["unknown", "held", "awaiting_handover", "shipped", "delivered"]);
    const location = optionalText(row.location, 240);
    const allocation = optionalText(row.allocation, 240);
    if (availability === "reserved" && !allocation) throw new Error("A reservation requires its intended recipient.");
    if (fulfillment === "delivered" && !location) throw new Error("Delivery requires a custody reference.");
    return { edition_label: rule.edition_label, kind, number, production, location, availability, fulfillment, payment: choice<PrintRecord["payment"]>(row.payment, ["unverified", "reported_paid", "verified_paid", "not_applicable"]), allocation, source_note: textField(row.source_note, 1000, true) };
  });
  return { version: 1, rules, prints };
}
/** A locked edition may be catalogued, but must never authorize another physical reproduction. */
export function canAuthorizeNewPrint(rule: EditionRule, kind: PrintKind, printedCount: number): boolean {
  return !rule.reproduction_locked && printedCount < (kind === "numbered" ? rule.numbered_limit : rule.artist_proof_limit);
}
export function registryFromMetadata(metadata: unknown): PrintRegistry | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata) || !("artwork_print_registry" in metadata)) return null;
  return validatePrintRegistry((metadata as Record<string, unknown>).artwork_print_registry);
}
