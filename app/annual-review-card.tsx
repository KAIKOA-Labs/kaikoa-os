import { annualReviewStatus, type AnnualReviewPlan } from "@/lib/annual-review";
import RenewalNotifications from "./renewal-notifications";
export default function AnnualReviewCard({plan,today,notifications,kind}:{plan:AnnualReviewPlan|undefined;today:string;notifications:unknown;kind:"medical"|"dental"}){
  const status=annualReviewStatus(plan,today);
  return <article className="asset evidenceCard"><div className="sectionHead"><h3>{kind==="medical"?"Annual medical review":"Dental exam & cleaning"}</h3><span className={`vehicleReadiness ${status.state}`}><span aria-hidden="true">●</span> {status.label}</span></div>
    {plan ? <><dl className="evidenceFacts"><div><dt>Last completed review</dt><dd>{plan.record.completed_on}</dd></div><div><dt>Provider</dt><dd>{plan.record.provider}</dd></div><div><dt>Next planned review</dt><dd>{plan.conflict?"Needs review":plan.record.next_review_on}</dd></div><div><dt>Booking reminder</dt><dd>{plan.conflict?"Needs review":plan.remind_on}</dd></div></dl>
      {plan.record.clinician_feedback==="reassuring_owner_report" && <p>Clinician feedback: reassuring · reported by you.</p>}
      {plan.record.archive_state==="complete" && <p>Archive complete · supplied report set received.</p>}
      {plan.record.archive_state==="partial" && <div className="evidenceNote review"><strong>Complete report pending</strong><ul>{plan.record.missing_items.map(item=><li key={item}>{item}</li>)}</ul></div>}
      {plan.record.treatment_ongoing && <p className="credentialAttention">Dental treatment remains open · separate from the completed routine examination.</p>}
      <small>Green tracks completed review and the planned review cycle. Individual results and clinical findings stay in the source records.</small>
      <small>The next date is a personal planning target; your clinician may recommend an earlier review. It is not a booked appointment.</small>
      <a href={plan.archive_url ?? plan.source_url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open review archive ↗</a><RenewalNotifications value={notifications}/>
    </> : <p>Review completion needs confirmation.</p>}
  </article>;
}
