import Link from "next/link";
import { commandCenterReviewItems, type CommandCenterRecord } from "@/lib/command-center-review";

export default function CommandCenterReview({ records }: { records: CommandCenterRecord[] }) {
  const items = commandCenterReviewItems(records);
  const visible = items.slice(0, 6);
  const remaining = items.slice(6);
  return <section className="panel commandCenterReview" aria-labelledby="record-review-title">
    <div className="sectionHead"><div><p className="eyebrow">RECORD COVERAGE</p><h2 id="record-review-title">Review & completeness · {items.length}</h2></div><Link href="/private-memory">Private OS →</Link></div>
    <p className="muted">Gaps in recorded details across your sections. These prompts do not create obligations, deadlines or verified facts.</p>
    {items.length === 0 ? <p className="muted">No recorded review gaps in these sections.</p> : <>
      <div className="commandCenterReviewList">{visible.map(item => <article className="commandCenterReviewItem" key={item.id}>
        <div><strong>{item.name}</strong><small>{item.section} · {item.reason}</small></div>
        <Link href={item.href}>Review →</Link>
      </article>)}</div>
      {remaining.length > 0 && <details className="commandCenterMore"><summary>Show {remaining.length} more</summary><div className="commandCenterReviewList">{remaining.map(item => <article className="commandCenterReviewItem" key={item.id}>
        <div><strong>{item.name}</strong><small>{item.section} · {item.reason}</small></div>
        <Link href={item.href}>Review →</Link>
      </article>)}</div></details>}
    </>}
  </section>;
}
