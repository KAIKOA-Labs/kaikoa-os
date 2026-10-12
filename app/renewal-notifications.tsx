import { parseRenewalNotifications } from "@/lib/renewal-notifications";
export default function RenewalNotifications({ value }: { value: unknown }) {
  const plan = parseRenewalNotifications(value);
  if (!plan) return null;
  return <details className="evidenceDetails"><summary>Renewal reminders · {plan.calendar_events.length ? "Calendar + ChatGPT" : "ChatGPT"}</summary>
    {plan.task_id && <p className="muted">ChatGPT checks are configured.</p>}
    {plan.calendar_events.map(event => <p key={event.id}><a href={event.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{event.label} · {event.on} ↗</a></p>)}
    <small>{plan.delivery_confirmed_on ? `Notification receipt confirmed by you · ${plan.delivery_confirmed_on}` : "Calendar reminders saved · Apple Calendar notification receipt awaiting your confirmation."}</small>
    <small>After renewal, update the source and reconcile the dated Calendar reminders.</small>
  </details>;
}
