import { classifyObligation, obligationStatusLabel, visibleObligations, type ObligationFilter, type WorkflowRecord } from "./obligation-workflow.ts";

export type ObligationSummary = WorkflowRecord & {
  id: string; title: string; related_entity_id: string | null;
  next_action: string | null; workflow_note: string | null; scheduled_at: string | null;
};
export type LinkedRecord = { id: string; slug: string; name: string; status: string };
export const unlinkedFilter = "__unlinked__";
function priority(record: WorkflowRecord, now: number) {
  const flags = classifyObligation(record, now);
  if (flags.overdue) return 0;
  if (flags.soon) return 1;
  if (flags.requires) return 2;
  if (flags.review) return 3;
  if (flags.progress) return 4;
  if (flags.scheduled) return 5;
  if (flags.waiting) return 6;
  if (flags.deferred) return 7;
  return flags.completed ? 9 : 8;
}
function dueOrder(value: string | null) {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : Infinity;
}
export function obligationWorkspaceRows(records: ObligationSummary[], linked: LinkedRecord[], query: string, filter: ObligationFilter, related: string, now: number) {
  const names = new Map(linked.map(record => [record.id, record.name]));
  const search = query.trim().toLowerCase();
  return visibleObligations(records, filter, now).filter(record => {
    const name = record.related_entity_id ? names.get(record.related_entity_id) : undefined;
    const matchesRelated = !related || (related === unlinkedFilter ? !name : record.related_entity_id === related);
    return matchesRelated && (!search || [record.title, record.next_action ?? "", record.workflow_note ?? "", name ?? "", obligationStatusLabel(record.status, record.requires_owner_attention)]
      .some(value => value.toLowerCase().includes(search)));
  }).sort((a, b) => {
    const rank = priority(a, now) - priority(b, now);
    if (rank) return rank;
    const aDue = dueOrder(a.due_at), bDue = dueOrder(b.due_at);
    if (aDue !== bDue) return aDue < bDue ? -1 : 1;
    return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
  });
}
export function obligationSchedule(value: string | null, timeZone?: string) {
  if (!value) return { label: "No scheduled date recorded", dateTime: null };
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return { label: "Scheduled date needs review", dateTime: null };
  return { label: "Scheduled · " + new Intl.DateTimeFormat("en-GB", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short", timeZone,
  }).format(date), dateTime: date.toISOString() };
}
