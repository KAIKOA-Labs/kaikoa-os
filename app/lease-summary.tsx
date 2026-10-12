import { leaseDate, leaseMoney, leasePosition, type LeaseRecord } from "@/lib/lease-record";
export default function LeaseSummary({record,compact=false}:{record:LeaseRecord;compact?:boolean}) {
  const {rent,next}=leasePosition(record);
  return <div className="leaseSummary">
    <small>{record.unit} · {record.location}</small>
    <span>{rent ? `${leaseMoney(rent.monthly_amount)}/month${record.cadence==="annual"?" equivalent":""} · ${record.cadence} payments` : "Outside the recorded initial term"}</span>
    <small>Initial term ends {leaseDate(record.ends_on)}</small>
    <small>{next ? `Next scheduled rent: ${leaseMoney(next.amount)} · ${leaseDate(next.due_on!)}` : "No future payment date in this schedule"}</small>
    <small className="muted">Contract schedule · receipts unverified</small>
    {!compact && <details className="evidenceDetails"><summary>Rent schedule and lease terms</summary>
      <p>Tenant: {record.tenant}. {record.execution_evidence==="signed_notarized_copy"?"Signed, notarized copy":"Signed copy"}.</p>
      <p>{leaseDate(record.starts_on)} – {leaseDate(record.ends_on)}. Payment method: {record.payment_method}.</p>
      <div className="leaseTable"><table><caption>Contract rent schedule · PHP</caption><thead><tr><th scope="col">Date / trigger</th><th scope="col">Rent</th><th scope="col">Period covered</th></tr></thead><tbody>{record.payments.map(p=><tr key={p.period_from}><td>{p.due_on?leaseDate(p.due_on):p.trigger}</td><td>{leaseMoney(p.amount)}</td><td>{leaseDate(p.period_from)} – {leaseDate(p.period_through)}</td></tr>)}</tbody></table></div>
      <p>{record.deposit_amount?`Contract deposit: ${leaseMoney(record.deposit_amount)}; receipt not verified.`:"Deposit amount not recorded in the supplied lease."}</p>
      <p>Renewal: {record.renewal_note} Written renewal notice: {record.renewal_notice_days} days.</p>
      <p>Termination: {record.termination_note}</p>
      <p className="muted">Scheduled amounts do not establish receipts, arrears, current occupancy or an exercised renewal option.</p>
    </details>}
  </div>;
}
