export const vehicleConditions = { unknown: "Condition not checked", excellent: "Excellent condition", good: "Good condition", needs_work: "Needs repair" } as const;
export const registrationStates = { unknown: "Registration not checked", current: "Registration current", needs_review: "Registration needs review" } as const;
export const insuranceStates = { unknown: "Insurance not checked", paid: "Insurance paid", unpaid: "Insurance unpaid" } as const;
export type VehicleDraft = {
  display_name: string; current_base: string | null; registration_plate: string | null;
  condition: keyof typeof vehicleConditions; registration: keyof typeof registrationStates; insurance: keyof typeof insuranceStates;
  registration_expires_on: string | null; insurance_expires_on: string | null;
  serviced_on: string | null; service_interval: "unknown" | "annual"; checked_on: string | null;
};
export type VehicleProfile = VehicleDraft & { version: 1; source_note: string; recorded_at: string };
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function text(value: unknown, max: number): value is string { return typeof value === "string" && value.trim() === value && value.length > 0 && Array.from(value).length <= max && !/[\u0000-\u001f\u007f]/.test(value); }
export function vehicleDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === value;
}
export function vehicleToday(now = new Date()) { return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-"); }
export function vehicleDraft(value: unknown): VehicleDraft {
  const keys = ["display_name", "current_base", "registration_plate", "condition", "registration", "insurance", "registration_expires_on", "insurance_expires_on", "serviced_on", "service_interval", "checked_on"];
  if (!object(value) || Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key))) throw Error("Review the vehicle fields before saving.");
  if (!text(value.display_name, 120) || !(value.registration_plate === null || text(value.registration_plate, 30))) throw Error("Enter a vehicle name and a plate up to 30 characters, or leave the plate unknown.");
  if (!(value.current_base === null || text(value.current_base,120))) throw Error("Use a base up to 120 characters, or leave it unknown.");
  for (const [key, options] of [["condition", vehicleConditions], ["registration", registrationStates], ["insurance", insuranceStates]] as const) {
    if (typeof value[key] !== "string" || !Object.hasOwn(options, value[key])) throw Error("Choose a supported vehicle check status.");
  }
  if (!["unknown", "annual"].includes(String(value.service_interval))) throw Error("Choose an annual service interval or leave it unknown.");
  for (const key of ["registration_expires_on", "insurance_expires_on", "serviced_on", "checked_on"] as const) if (!(value[key] === null || vehicleDate(value[key]))) throw Error("Use valid calendar dates or leave them unknown.");
  if (value.serviced_on !== null && value.checked_on !== null && String(value.serviced_on) > String(value.checked_on)) throw Error("A completed service cannot be later than the check date.");
  return value as VehicleDraft;
}
export function parseVehicleProfile(value: unknown): VehicleProfile | null {
  if (!object(value) || value.version !== 1 || !text(value.source_note, 1000) || value.source_note.length < 4 || typeof value.recorded_at !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value.recorded_at) || !vehicleDate(value.recorded_at.slice(0, 10)) || !Number.isFinite(Date.parse(value.recorded_at))) return null;
  const { version, source_note, recorded_at, ...draft } = value;
  void version; void source_note; void recorded_at;
  try { vehicleDraft(draft); } catch { return null; }
  return value as VehicleProfile;
}
export function emptyVehicleDraft(name: string): VehicleDraft { return { display_name: name, current_base: null, registration_plate: null, condition: "unknown", registration: "unknown", insurance: "unknown", registration_expires_on: null, insurance_expires_on: null, serviced_on: null, service_interval: "unknown", checked_on: null }; }
export function draftFromProfile(profile: VehicleProfile): VehicleDraft { const { version, source_note, recorded_at, ...draft } = profile; void version; void source_note; void recorded_at; return draft; }
export type VehicleProfileDocument = { id: string; vehicle_profile: unknown };
export function vehicleProfilesByEntity(documents: VehicleProfileDocument[], links: { document_id: string; entity_id: string | null }[]): Map<string, VehicleProfile> {
  const byDocument = new Map(documents.map(row => [row.id,row.vehicle_profile]));
  const candidates = new Map<string, unknown[]>();
  for (const link of links) if (link.entity_id && byDocument.has(link.document_id)) candidates.set(link.entity_id,[...(candidates.get(link.entity_id) ?? []),byDocument.get(link.document_id)]);
  const result = new Map<string, VehicleProfile>();
  for (const [entityId, values] of candidates) { const p = values.length === 1 ? parseVehicleProfile(values[0]) : null; if(p) result.set(entityId,p); }
  return result;
}
export function vehicleBase(profile: unknown, legacy: string | null) { const p = parseVehicleProfile(profile); return p ? p.current_base : legacy; }
export function annualServiceReview(servicedOn: string): string {
  const d = new Date(servicedOn + "T00:00:00Z");
  const year = d.getUTCFullYear() + 1, month = d.getUTCMonth();
  const day = Math.min(d.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}
export type VehicleCheck = { label: string; state: "good" | "unknown" | "attention" };
export function vehicleReadiness(value: unknown, today: string): { state: "ready" | "unknown" | "attention" | "blocked"; label: string; checks: VehicleCheck[] } {
  const p = parseVehicleProfile(value);
  if (!p || !vehicleDate(today) || p.checked_on === null || p.checked_on > today) return { state: "unknown", label: "Readiness not checked", checks: [] };
  const expired = (date: string | null) => date !== null && date < today;
  const checks: VehicleCheck[] = [
    { label: vehicleConditions[p.condition], state: p.condition === "excellent" || p.condition === "good" ? "good" : p.condition === "needs_work" ? "attention" : "unknown" },
    { label: expired(p.registration_expires_on) ? "Registration expired · renewal pending" : registrationStates[p.registration], state: expired(p.registration_expires_on) || p.registration === "needs_review" ? "attention" : p.registration === "current" ? "good" : "unknown" },
    { label: expired(p.insurance_expires_on) ? "Insurance renewal needed" : insuranceStates[p.insurance], state: expired(p.insurance_expires_on) || p.insurance === "unpaid" ? "attention" : p.insurance === "paid" ? "good" : "unknown" },
    { label: p.serviced_on === null ? "Service not checked" : p.serviced_on > today ? "Service date needs review" : p.service_interval === "annual" && annualServiceReview(p.serviced_on) <= today ? "Annual service needs review" : p.service_interval === "annual" ? "Annual service done" : "Service date recorded", state: p.serviced_on === null || p.service_interval === "unknown" ? "unknown" : p.serviced_on > today || annualServiceReview(p.serviced_on) <= today ? "attention" : "good" },
  ];
  const ready = checks.every(check => check.state === "good");
  const unknown = checks.every(check => check.state === "unknown");
  const blocked = expired(p.registration_expires_on);
  return { state: blocked ? "blocked" : ready ? "ready" : unknown ? "unknown" : "attention", label: blocked ? "Not ready to use" : ready ? "Ready to use" : unknown ? "Readiness not checked" : "Check before use", checks };
}
