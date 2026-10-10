export const credentialTypeLabels = {
  passport: "Passport",
  national_id: "National ID",
  driver_license: "Driver license",
  pilot_license: "Pilot license",
  radio_license: "Radio license",
  boating_license: "Boating license",
  professional_license: "Professional license",
  certification: "Certification",
  other: "Other credential",
} as const;

export type CredentialType = keyof typeof credentialTypeLabels;
export const credentialGroups = [
  { key: "passports", label: "Passports" },
  { key: "national_ids", label: "National IDs" },
  { key: "driving_licenses", label: "Driving Licenses" },
  { key: "philippines_ppl", label: "Philippines PPL" },
  { key: "licenses", label: "Other Licenses" },
  { key: "certificates", label: "Certificates" },
  { key: "other", label: "Other Credentials" },
] as const;
export type CredentialGroup = typeof credentialGroups[number]["key"];

export function isCredentialGroup(value: unknown): value is CredentialGroup {
  return typeof value === "string" && credentialGroups.some(group => group.key === value);
}
export function credentialGroup(type: CredentialType | undefined, subtype?: string | null, savedGroup?: unknown): CredentialGroup {
  if (isCredentialGroup(savedGroup)) return savedGroup;
  if (type === "passport" || type === undefined && subtype === "passport") return "passports";
  if (type === "national_id") return "national_ids";
  if (type === "driver_license") return "driving_licenses";
  if (type === "certification") return "certificates";
  if (type === "pilot_license" || type === "radio_license" ||
      type === "boating_license" || type === "professional_license") return "licenses";
  return "other";
}

export type CredentialState = "needs_review" | "owner_confirmed" | "in_progress" | "unknown";
export type CredentialRecord = {
  version: 1;
  credential_type: CredentialType;
  issuer: string | null;
  last_four: string | null;
  expires_on: string | null;
  reminder_on: string | null;
  record_state: CredentialState;
  source_note: string;
  recorded_at: string;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const states = new Set<CredentialState>(["needs_review", "owner_confirmed", "in_progress", "unknown"]);

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function credentialFromMetadata(value: unknown): CredentialRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (v.version !== 1 || typeof v.credential_type !== "string" || !(v.credential_type in credentialTypeLabels) ||
      !(typeof v.issuer === "string" || v.issuer === null) ||
      !(typeof v.last_four === "string" && /^\d{4}$/.test(v.last_four) || v.last_four === null) ||
      !(isIsoDate(v.expires_on) || v.expires_on === null) ||
      !(isIsoDate(v.reminder_on) || v.reminder_on === null) ||
      !(typeof v.record_state === "string" && states.has(v.record_state as CredentialState)) ||
      typeof v.source_note !== "string" || typeof v.recorded_at !== "string" ||
      (v.reminder_on !== null && v.expires_on === null) ||
      (typeof v.reminder_on === "string" && typeof v.expires_on === "string" && v.reminder_on > v.expires_on)) return null;
  return v as CredentialRecord;
}

export function credentialStateLabel(state: CredentialState) {
  return ({ needs_review: "Needs verification", owner_confirmed: "Owner confirmed", in_progress: "In progress", unknown: "Unknown" } as const)[state];
}

export function renewalAttention(record: CredentialRecord, today: string) {
  if (record.record_state === "in_progress") return "In progress";
  if (!record.expires_on) return "No expiry recorded";
  if (record.expires_on < today) return "Recorded expiry passed · verify";
  if (record.reminder_on && record.reminder_on <= today) return "Reminder date reached";
  if (record.reminder_on) return "Reminder scheduled";
  return "Expiry recorded · reminder not set";
}
