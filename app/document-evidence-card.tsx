import type { ReactNode } from "react";
import { evidenceCategories, safeGmailSource, type EvidenceGroup, type EvidenceRow } from "@/lib/document-evidence";
import { safeDriveLink } from "@/lib/drive-reference";
function DriveFile({ row, label }: { row: EvidenceRow; label?: string }) {
  const href = safeDriveLink(row.source_url);
  return href ? <a href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{label ?? row.title} ↗</a> : <span>{row.title} · link needs review</span>;
}
export default function DocumentEvidenceCard({ group, related }: { group: EvidenceGroup<EvidenceRow>; related?: ReactNode }) {
  const { primary, supporting, summary } = group;
  return <article className="asset evidenceCard">
    {summary && <span className="eyebrow">{evidenceCategories[summary.category]}</span>}
    <h3>{primary.title}</h3>
    <span className="status">{summary ? "Source summary · review pending" : primary.status === "NEEDS_REVIEW" ? "Needs review" : "Reference only"}</span>
    {summary ? <>
      <dl className="evidenceFacts">{summary.fields.slice(0, 4).map(field => <div key={field.label}><dt>{field.label}</dt><dd>{field.value ?? "Not recorded"}</dd></div>)}</dl>
      {summary.notes.filter(note => note.kind !== "source").map((note, index) => <div className={note.kind === "review" ? "evidenceNote review" : "evidenceNote"} key={index}><strong>{note.kind === "owner" ? "Your note" : "Review point"}</strong><p>{note.text}</p><small>{note.source}</small></div>)}
      <details className="evidenceDetails"><summary>More facts and sources</summary>
        <dl className="evidenceFacts">{summary.fields.map(field => <div key={field.label}><dt>{field.label}</dt><dd>{field.value ?? "Not recorded"}<small>Source: {field.source}</small></dd></div>)}</dl>
        {summary.notes.filter(note => note.kind === "source").map((note, index) => <p className="muted" key={index}>{note.text}<small className="evidenceSource">{note.source}</small></p>)}
        <p className="muted">Extracted {summary.extracted_on}. Source statements remain subject to your review; dates shown do not certify current validity or coverage.</p>
        {summary.sources.map(source => <p key={source.url}><a href={safeGmailSource(source.url)!} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{source.label} in Gmail ↗</a></p>)}
      </details>
    </> : <small>{primary.evidence_summary != null ? "Saved summary needs review; open the original." : "File contents have not been imported"}</small>}
    <DriveFile row={primary} label={summary ? "Open digital original in Drive" : "Open file in Drive"} />
    {supporting.length > 0 && <details className="evidenceDetails"><summary>Supporting files · {supporting.length}</summary><ul className="evidenceFiles">{supporting.map(row => <li key={row.id}><DriveFile row={row} /></li>)}</ul></details>}
    {related}
    {typeof primary.source_note === "string" && <small>Source: {primary.source_note}</small>}
    <small>{primary.recorded_by === "agent" ? "Added by assistant with your authorization" : "Owner-entered reference"}</small>
  </article>;
}
