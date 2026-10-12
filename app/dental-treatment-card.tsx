import { parseDentalTreatment } from "@/lib/dental-treatment";
export default function DentalTreatmentCard({value}:{value:unknown}){
  const record=parseDentalTreatment(value);if(!record)return null;
  return <section className="panel"><div className="sectionHead"><h2>Dental treatment</h2><span className="credentialAttention">Treatment open</span></div><p>{record.provider} · referred by {record.referring_provider}</p><p>{record.location}</p>
    {record.appointments.map((a,index)=><div className="item" key={a.starts_at}><strong>Root canal · session {index+1}</strong><p>{new Intl.DateTimeFormat("en-GB",{dateStyle:"full",timeStyle:"short",timeZone:"Asia/Manila"}).format(new Date(a.starts_at))} · Manila</p><small>Clinic-confirmed start · duration and completion not recorded.</small>{a.calendar_url && <a href={a.calendar_url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open start reminder in Calendar ↗</a>}</div>)}
    <small>Scheduled appointments do not confirm treatment completion. Source screenshots remain in the dental archive.</small>
  </section>;
}
