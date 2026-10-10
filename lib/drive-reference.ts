export type DriveReferenceKind = "drive_library" | "drive_private_vault" | "drive_reference";
export type DriveTarget = { id: string; url: string; folder: boolean };

// A stored link grants no Drive access. Never fetch a user-supplied URL here.
export function driveTarget(value: string): DriveTarget {
  if (value.length > 500) throw new Error("Use a Google Drive file or folder link.");
  let parsed: URL;
  try { parsed = new URL(value.trim()); } catch { throw new Error("Use a Google Drive file or folder link."); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port || parsed.hash ||
      [...parsed.searchParams.keys()].some(key => !["usp", "authuser"].includes(key)))
    throw new Error("Use a standard Google Drive sharing link without extra access parameters.");
  let match: RegExpMatchArray | null = null;
  let folder = false;
  if (parsed.hostname === "drive.google.com") {
    match = parsed.pathname.match(/^\/drive\/folders\/([A-Za-z0-9_-]{10,200})\/?$/);
    if (match) folder = true;
    else match = parsed.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]{10,200})(?:\/view)?\/?$/);
  } else if (parsed.hostname === "docs.google.com") {
    match = parsed.pathname.match(/^\/(?:document|spreadsheets|presentation)\/d\/([A-Za-z0-9_-]{10,200})(?:\/(?:edit|view|preview))?\/?$/);
  }
  if (!match) throw new Error("Use the full Google Drive file or folder sharing link.");
  return { id: match[1], folder, url: folder ? `https://drive.google.com/drive/folders/${match[1]}` : `https://drive.google.com/file/d/${match[1]}/view` };
}

export function referencePayload(title: string, url: string, note: string, entityId: string, confirmed: boolean, nonSensitive: boolean) {
  const target = driveTarget(url);
  if (target.folder) throw new Error("Add a file link here; the connected folders are listed separately.");
  const name = title.trim(), source = note.trim();
  if (name.length < 2 || name.length > 120 || source.length < 4 || source.length > 1000 || /[\u0000-\u001f\u007f]/.test(name) || /[\u0000-\u001f\u007f]/.test(source))
    throw new Error("Enter a title of 2–120 characters and a source note of 4–1,000 characters.");
  if (entityId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entityId)) throw new Error("Choose a recorded asset.");
  if (!confirmed || !nonSensitive) throw new Error("Confirm this is a non-sensitive document reference before saving.");
  return { p_title: name, p_document_type: "drive_reference", p_drive_url: target.url, p_source_note: source, p_entity_id: entityId || null, p_confirm: true, p_non_sensitive: true };
}

export function safeDriveLink(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try { return driveTarget(value).url; } catch { return null; }
}

export const referenceKindLabels: Record<string, string> = {
  drive_library: "Document Library", drive_private_vault: "Private Vault", drive_reference: "Document reference",
};
