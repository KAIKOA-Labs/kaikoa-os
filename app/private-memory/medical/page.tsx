"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { safeDriveLink } from "@/lib/drive-reference";
import { filterEvidenceGroups, groupEvidence } from "@/lib/document-evidence";
import { medicalYear, tetanusPlan, tetanusStatus, type MedicalDocument } from "@/lib/medical-record";
import DocumentEvidenceCard from "@/app/document-evidence-card";
import RenewalNotifications from "@/app/renewal-notifications";
import { latestAnnualReview } from "@/lib/annual-review";
import AnnualReviewCard from "@/app/annual-review-card";
import DentalTreatmentCard from "@/app/dental-treatment-card";
import { dentalTreatmentFromDocument } from "@/lib/dental-treatment";
type Row = MedicalDocument & { renewal_notifications: unknown; source_note: unknown; recorded_by: unknown; record_year: unknown };
export default function MedicalPage() {
  const [rows,setRows] = useState<Row[]>([]);
  const [folder,setFolder] = useState<string|null>(null);
  const [yearFolders,setYearFolders] = useState<{year:string;url:string}[]>([]);
  const [stage,setStage] = useState("loading");
  const [query,setQuery] = useState("");
  useEffect(() => {
    let active = true;
    (async () => {
      const db = getBrowserSupabase(); if (!db) throw new Error("Unavailable");
      const {data:identity,error:authError} = await db.auth.getUser(); if (!active) return;
      if (authError || !identity.user) {setStage("signed-out");return;}
      const result = await db.from("documents").select("id,title,document_type,status,source_url,vaccination_record:metadata->vaccination_record,annual_review_record:metadata->annual_review_record,dental_treatment_record:metadata->dental_treatment_record,archive_folder_url:metadata->archive_folder_url,evidence_summary:metadata->evidence_summary,renewal_notifications:metadata->renewal_notifications,source_note:metadata->source_note,recorded_by:metadata->recorded_by,record_year:metadata->record_year").in("document_type",["medical_evidence","medical_folder","medical_year_folder"]).neq("status","ARCHIVED").order("title");
      if (!active) return; if (result.error) throw new Error("Unavailable");
      const {data:current,error:identityError} = await db.auth.getUser(); if (!active) return;
      if (identityError || current.user?.id !== identity.user.id) {setStage("signed-out");return;}
      const data = result.data as Row[] ?? [];
      setRows(data.filter(row => row.document_type === "medical_evidence"));
      setYearFolders(data.flatMap(row => {const url=safeDriveLink(row.source_url);return row.document_type === "medical_year_folder" && typeof row.record_year === "string" && /^[12]\d{3}$/.test(row.record_year) && url ? [{year:row.record_year,url}] : [];}));
      setFolder(safeDriveLink(data.find(row => row.document_type === "medical_folder")?.source_url));setStage("ready");
    })().catch(() => {if(active)setStage("error");});
    return () => {active=false;};
  },[]);
  const today = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila"}).format(new Date());
  const plan = useMemo(() => tetanusPlan(rows),[rows]); const status = tetanusStatus(plan,today);
  const source = rows.find(row => row.id === plan?.document_id);
  const groups = useMemo(() => filterEvidenceGroups(groupEvidence(rows),query),[rows,query]);
  const years = [...new Set([...groups.map(group => medicalYear(group.primary)),...(!query.trim() ? yearFolders.map(folder=>folder.year) : [])])].sort().reverse();
  return <main className="shell"><header><p className="eyebrow">KAIKOA OS · PRIVATE HEALTH</p><h1>Medical.</h1><p className="muted">Vaccination dates and medical originals, organized by year.</p></header>
    {stage === "loading" && <p role="status">Loading medical records…</p>}
    {stage === "signed-out" && <p>Sign in to view your medical records. <Link href="/auth/sign-in">Sign in →</Link></p>}
    {stage === "error" && <p role="alert">Unable to load medical records. Reload to retry.</p>}
    {stage === "ready" && <>
      <section className="panel"><h2>Preventive reviews</h2><div className="assetGrid">{(["medical","dental"] as const).map(kind=>{const review=latestAnnualReview(rows,kind);return <AnnualReviewCard key={kind} kind={kind} today={today} plan={review} notifications={rows.find(row=>row.id===review?.document_id)?.renewal_notifications}/>;})}</div>
        <details className="evidenceDetails"><summary>How often to review</summary><p>An annual review is your planning anchor. The clinician chooses tests and earlier follow-ups based on symptoms, history and risks; repeating a broad test panel every year is not a universal requirement.</p><p>STI testing depends on exposures, tests and timing. New exposures or symptoms can require earlier testing; a partial report does not establish a complete negative screen.</p><p>Adult dental recall is individualized, commonly within 3–24 months. Your dentist may recommend earlier recall during active disease or treatment.</p><p><a href="https://www.cochrane.org/evidence/CD009009_general-health-checks-reducing-illness-and-mortality" target="_blank" rel="noopener noreferrer">General health-check evidence ↗</a></p><p><a href="https://www.cdc.gov/std/treatment-guidelines/screening-recommendations.htm" target="_blank" rel="noopener noreferrer">CDC STI screening recommendations ↗</a></p><p><a href="https://www.nice.org.uk/guidance/cg19/chapter/recommendations" target="_blank" rel="noopener noreferrer">NICE dental recall guidance ↗</a></p></details>
      </section>
      {rows.filter(row=>dentalTreatmentFromDocument(row)).map(row=><DentalTreatmentCard key={row.id} value={row.dental_treatment_record}/>)}
      <section className="panel"><div className="sectionHead"><h2>Tetanus</h2><span className={`vehicleReadiness ${status.state}`} title={status.detail}><span aria-hidden="true">●</span> {status.label} · routine schedule</span></div>
        {plan ? <><dl className="evidenceFacts"><div><dt>Last recorded dose</dt><dd>{plan.record.dose_on} · {plan.record.product}</dd></div><div><dt>Routine booster</dt><dd>{plan.conflict ? "Needs review" : plan.due_on}</dd></div><div><dt>First reminder</dt><dd>{plan.conflict ? "Needs review" : plan.remind_on}</dd></div><div><dt>Initial vaccine course</dt><dd>{plan.record.primary_series_complete === true && !plan.conflict ? "Complete · confirmed by you" : "Needs confirmation"}</dd></div></dl>
          <p className="muted">{status.detail}</p><p className="muted">{plan.record.dose_confirmed ? "Dose evidence: invoice, with administration confirmed by you." : "Dose evidence: invoice; administration needs confirmation."} This card tracks the routine schedule.</p>
          <p>For a dirty or major wound, seek wound care promptly; an earlier booster can be needed after five years ({plan.wound_review_on}). Do not wait for the routine reminder after an injury.</p>
          <a href={plan.source_url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open vaccination evidence in Drive ↗</a>
          <RenewalNotifications value={source?.renewal_notifications}/></> : <p>Last dose needs confirmation before showing an up-to-date status.</p>}
        <details className="evidenceDetails"><summary>Schedule guidance</summary><p>CDC recommends a ten-year adult booster interval after the initial course. Wound care uses separate five- or ten-year thresholds and individual clinical assessment.</p><a href="https://www.cdc.gov/tetanus/hcp/vaccine-recommendations/index.html" target="_blank" rel="noopener noreferrer">CDC vaccine recommendations ↗</a><p><a href="https://www.cdc.gov/tetanus/hcp/clinical-guidance/index.html" target="_blank" rel="noopener noreferrer">CDC wound guidance ↗</a></p></details>
      </section>
      <section className="panel"><div className="sectionHead"><h2>Medical records</h2>{folder && <a href={folder} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open Health folder ↗</a>}</div><p className="muted">Originals stay in the private Health folder. Year folders use dated filenames.</p>
        <div className="inventoryControls"><div><label htmlFor="medical-search">Search medical records</label><input id="medical-search" type="search" value={query} onChange={event=>setQuery(event.target.value)} maxLength={120} placeholder="Vaccine, date or provider"/></div></div>
        {years.map(year=><section className="inventoryCategoryGroup" key={year}><div className="sectionHead"><h3>{year}</h3>{yearFolders.filter(folder=>folder.year===year).map(folder=><a key={folder.url} href={folder.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open year in Drive ↗</a>)}</div><div className="assetGrid">{groups.filter(group=>medicalYear(group.primary)===year).map(group=><DocumentEvidenceCard key={group.primary.id} group={group}/>)}</div>{groups.every(group=>medicalYear(group.primary)!==year) && <p className="muted">Original records are available in the year folder.</p>}</section>)}
        {years.length === 0 && <p>No medical records match.</p>}
      </section>
    </>}
  </main>;
}
