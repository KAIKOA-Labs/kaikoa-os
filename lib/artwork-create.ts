export function artworkCreationPayload(name: string, description: string) {
  const title = name.trim();
  const note = description.trim();
  if (title.length < 2 || title.length > 120) throw new Error("Use a title between 2 and 120 characters.");
  if (note.length > 1000) throw new Error("Keep the description within 1,000 characters.");
  return { p_name: title, p_subtype: "artwork", p_description: note } as const;
}
