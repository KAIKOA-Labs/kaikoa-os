export const workflowOptions = [
  { value: "ATTENTION", label: "Requires You" },
  { value: "WAITING_ON", label: "Waiting On" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "COMPLETED", label: "Completed" },
  { value: "DEFERRED", label: "Deferred / Awaiting Funding" },
] as const;
export type WorkflowStatus = typeof workflowOptions[number]["value"];
export type WorkflowRecord = { status: string; requires_owner_attention: boolean; due_at: string | null };
export const obligationFilters = [
  { key: "requires", label: "Requires You" }, { key: "review", label: "Needs Review" },
  { key: "waiting", label: "Waiting On" },
  { key: "progress", label: "In Progress" }, { key: "scheduled", label: "Scheduled" },
  { key: "completed", label: "Completed" }, { key: "deferred", label: "Deferred / Awaiting Funding" },
  { key: "overdue", label: "Overdue" }, { key: "soon", label: "Due Soon" },
] as const;
export type ObligationFilter = typeof obligationFilters[number]["key"] | null;
export function obligationStatusLabel(status: string, ownerAttention?: boolean): string {
  if (status === "ATTENTION" && ownerAttention === false) return "Needs Review";
  if (status === "WAITING") return "Waiting On";
  if (status === "UPCOMING") return "Upcoming";
  return workflowOptions.find(option => option.value === status)?.label ?? status;
}
export function classifyObligation(record: WorkflowRecord, now: number) {
  const active = record.status !== "COMPLETED" && record.status !== "ARCHIVED";
  const waiting = active && ["WAITING_ON", "WAITING"].includes(record.status);
  const deferred = active && record.status === "DEFERRED";
  const due = record.due_at ? Date.parse(record.due_at) : NaN;
  return {
    requires: active && record.requires_owner_attention && !waiting && !deferred,
    // Match the existing Needs Review label without assigning owner attention.
    review: active && record.status === "ATTENTION" && record.requires_owner_attention === false,
    waiting, progress: active && record.status === "IN_PROGRESS",
    scheduled: active && record.status === "SCHEDULED", completed: record.status === "COMPLETED", deferred,
    // A deferred task can still have a real overdue deadline.
    overdue: active && Number.isFinite(due) && due < now,
    soon: active && Number.isFinite(due) && due >= now && due <= now + 14 * 86400000,
  };
}
export function visibleObligations<T extends WorkflowRecord>(records: T[], filter: ObligationFilter, now: number): T[] {
  return records.filter(record => record.status !== "ARCHIVED" &&
    (filter ? classifyObligation(record, now)[filter] : record.status !== "COMPLETED"));
}
export function toLocalDateTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function obligationDeadline(record: WorkflowRecord, now: number, timeZone?: string) {
  if (!record.due_at) return { label: "No deadline recorded", dateTime: null };
  const date = new Date(record.due_at);
  if (!Number.isFinite(date.getTime())) return { label: "Deadline needs review", dateTime: null };
  const formatted = new Intl.DateTimeFormat("en-GB", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short", timeZone,
  }).format(date);
  const prefix = record.status === "COMPLETED" || record.status === "ARCHIVED"
    ? "Deadline" : classifyObligation(record, now).overdue ? "Overdue" : "Due";
  return { label: `${prefix} · ${formatted}`, dateTime: date.toISOString() };
}
