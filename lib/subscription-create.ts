export function subscriptionCreationPayload(name: string, description: string, confirmed: boolean) {
  const title = name.trim();
  const note = description.trim();
  if (Array.from(title).length < 2 || Array.from(title).length > 120) throw new Error("Use a service name between 2 and 120 characters.");
  if (!/[a-zA-Z0-9]/.test(title)) throw new Error("Include a letter or number in the service name.");
  if (Array.from(note).length > 1000) throw new Error("Keep the description within 1,000 characters.");
  if (!confirmed) throw new Error("Confirm that you want to record this service.");
  return { p_name: title, p_subtype: "subscription", p_description: note } as const;
}
