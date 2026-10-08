import { obligationDeadline, type WorkflowRecord } from "@/lib/obligation-workflow";

export default function ObligationDeadline({ record, now }: { record: WorkflowRecord; now: number }) {
  const deadline = obligationDeadline(record, now);
  return <small>{deadline.dateTime
    ? <time dateTime={deadline.dateTime}>{deadline.label}</time>
    : deadline.label}</small>;
}
