import { isIsoDate } from "./credential-record.ts";
export type RenewalNotifications = { version: 1; configured_on: string; task_id: string | null; calendar_events: { id: string; label: string; on: string; url: string }[]; delivery_confirmed_on: string | null };
export function safeCalendarLink(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 600) return null;
  try { const url = new URL(value);
    return url.protocol === "https:" && ["www.google.com","calendar.google.com"].includes(url.hostname) && !url.port && !url.username && !url.password && url.pathname === "/calendar/event" &&
      [...url.searchParams.keys()].every(key => key === "eid") && url.searchParams.getAll("eid").length === 1 && /^[a-zA-Z0-9_=-]{10,500}$/.test(url.searchParams.get("eid") ?? "") && !url.hash ? url.href : null;
  } catch { return null; }
}
export function parseRenewalNotifications(value: unknown): RenewalNotifications | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string,unknown>;
  if (Object.keys(v).length !== 5 || v.version !== 1 || !isIsoDate(v.configured_on) || !(v.task_id === null || typeof v.task_id === "string" && /^[a-f0-9]{32}$/.test(v.task_id)) ||
    !(v.delivery_confirmed_on === null || isIsoDate(v.delivery_confirmed_on)) || !Array.isArray(v.calendar_events) || v.calendar_events.length > 12) return null;
  for (const event of v.calendar_events) {
    if (!event || typeof event !== "object" || Array.isArray(event) || Object.keys(event).length !== 4 || typeof event.id !== "string" || !/^[a-z0-9]{5,200}$/.test(event.id) ||
      typeof event.label !== "string" || !event.label.trim() || event.label.length > 120 || /[\u0000-\u001f\u007f]/.test(event.label) || !isIsoDate(event.on) || !safeCalendarLink(event.url)) return null;
  }
  return v as RenewalNotifications;
}
