export type Edition = {
  label: string;
  image_size: string;
  edition_limit: number | null;
  printed_count: number | null;
  source_note: string;
  source_date: string | null;
};
export type ArtistProofs = {
  allowance: number | null;
  printed_count: number | null;
  image_size: string;
  source_note: string;
  source_date: string | null;
};
export type ArtworkInventory = { version: 1; editions: Edition[]; artist_proofs: ArtistProofs };
export const emptyProofs = (): ArtistProofs => ({ allowance: null, printed_count: null, image_size: "", source_note: "", source_date: null });
export const emptyInventory = (): ArtworkInventory => ({ version: 1, editions: [], artist_proofs: emptyProofs() });
export const emptyEdition = (): Edition => ({ label: "", image_size: "", edition_limit: null, printed_count: null, source_note: "", source_date: null });

export function countInput(value: string): number | null {
  if (value.trim() === "") return null;
  if (!/^\d+$/.test(value)) throw new Error("Use a whole count or leave it blank for Unknown.");
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count > 1000000) throw new Error("Counts must be between 0 and 1,000,000.");
  return count;
}
function count(value: unknown, positive = false): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < (positive ? 1 : 0) || value > 1000000) throw new Error("Check your edition limits and whole counts.");
  return value;
}
function text(value: unknown, max: number, required = false): string {
  if (typeof value !== "string") throw new Error("Invalid inventory text.");
  const result = value.trim();
  if (result.length > max || (required && !result)) throw new Error(required ? "Each edition needs a label and source note." : "Inventory text is too long.");
  return result;
}
function date(value: unknown): string | null {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000") || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error("Use a valid source date or leave it blank.");
  return value;
}
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid artwork inventory.");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== keys.length || keys.some(key => !(key in record))) throw new Error("Unsupported inventory fields.");
  return record;
}
export function validateInventory(value: unknown): ArtworkInventory {
  const root = object(value, ["version", "editions", "artist_proofs"]);
  if (root.version !== 1 || !Array.isArray(root.editions) || root.editions.length > 50) throw new Error("Use at most 50 editions.");
  const labels = new Set<string>();
  const editions = root.editions.map(value => {
    const row = object(value, ["label", "image_size", "edition_limit", "printed_count", "source_note", "source_date"]);
    const label = text(row.label, 120, true);
    if (labels.has(label.toLowerCase())) throw new Error("Edition labels must be unique within this artwork.");
    labels.add(label.toLowerCase());
    const edition_limit = count(row.edition_limit, true);
    const printed_count = count(row.printed_count);
    if (edition_limit !== null && printed_count !== null && printed_count > edition_limit) throw new Error("Printed numbered copies cannot exceed the edition limit.");
    return { label, image_size: text(row.image_size, 120), edition_limit, printed_count, source_note: text(row.source_note, 1000, true), source_date: date(row.source_date) };
  });
  const ap = object(root.artist_proofs, ["allowance", "printed_count", "image_size", "source_note", "source_date"]);
  const artist_proofs = { allowance: count(ap.allowance), printed_count: count(ap.printed_count), image_size: text(ap.image_size, 120), source_note: text(ap.source_note, 1000), source_date: date(ap.source_date) };
  if (artist_proofs.allowance !== null && artist_proofs.printed_count !== null && artist_proofs.printed_count > artist_proofs.allowance) throw new Error("Printed artist proofs cannot exceed their recorded allowance.");
  if ((artist_proofs.allowance !== null || artist_proofs.printed_count !== null || artist_proofs.image_size || artist_proofs.source_date) && !artist_proofs.source_note) throw new Error("Add a source note for the artist-proof information.");
  return { version: 1, editions, artist_proofs };
}
export function inventoryFromMetadata(metadata: unknown): ArtworkInventory | null {
  if (!metadata || typeof metadata !== "object" || !("artwork_inventory" in metadata)) return null;
  return validateInventory((metadata as Record<string, unknown>).artwork_inventory);
}
export function copiesStillToPrint(edition: Pick<Edition, "edition_limit" | "printed_count">): number | null {
  const { edition_limit, printed_count } = edition;
  return edition_limit === null || printed_count === null || printed_count > edition_limit ? null : edition_limit - printed_count;
}
