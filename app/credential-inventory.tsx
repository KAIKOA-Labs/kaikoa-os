"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { credentialFromMetadata, credentialTypeLabels, credentialGroups, credentialGroup, renewalAttention, credentialStateLabel, type CredentialRecord } from "@/lib/credential-record";
import { passportPlansByEntity, passportAttention, type PassportPlan } from "@/lib/passport-renewal";

type Row = { id: string; slug: string; name: string; subtype: string | null; status: string; data_quality: string | null; credential_record: unknown; credential_group: unknown };
export default function CredentialInventory() {
  const [rows, setRows] = useState<Row[]>([]);
  const [passportPlans, setPassportPlans] = useState<Map<string, PassportPlan>>(new Map());
  const [stage, setStage] = useState<"loading" | "ready" | "error" | "signed-out">("loading");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  useEffect(() => {
    let active = true;
    (async () => {
      const db = getBrowserSupabase();
      if (!db) { setStage("error"); return; }
      const { data: identity, error: authError } = await db.auth.getUser();
      if (!active) return;
      if (authError || !identity.user) { setStage("signed-out"); return; }
      const [entities, documents, links] = await Promise.all([
        db.from("entities").select("id,slug,name,subtype,status,data_quality,credential_record:metadata->credential_record,credential_group:metadata->credential_group")
          .in("subtype", ["credential", "passport"]).neq("status", "ARCHIVED").order("name"),
        db.from("documents").select("id,document_type,status,source_url,passport_record:metadata->passport_record,evidence_summary:metadata->evidence_summary")
          .eq("document_type", "passport_evidence").neq("status", "ARCHIVED"),
        db.from("document_links").select("document_id,entity_id,obligation_id").is("obligation_id", null),
      ]);
      if (!active) return;
      if (entities.error || documents.error || links.error) { setStage("error"); return; }
      const { data: current, error: identityError } = await db.auth.getUser();
      if (!active) return;
      if (identityError || current.user?.id !== identity.user.id) { setStage("signed-out"); return; }
      setRows(entities.data ?? []);
      setPassportPlans(passportPlansByEntity(entities.data ?? [], documents.data ?? [], links.data ?? []));
      setStage("ready");
    })().catch(() => { if (active) setStage("error"); });
    return () => { active = false; };
  }, []);

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  const visible = useMemo(() => rows.filter(row => {
    const record = credentialFromMetadata(row.credential_record);
    const label = record ? credentialTypeLabels[record.credential_type] : "Needs setup";
    const group = credentialGroups.find(group => group.key === credentialGroup(record?.credential_type, row.subtype, row.credential_group));
    const text = `${row.name} ${label} ${record?.issuer ?? ""} ${group?.label ?? ""}`.toLowerCase();
    return (!query.trim() || text.includes(query.trim().toLowerCase())) && (!kind || record?.credential_type === kind);
  }).sort((a, b) => {
    const aRecord = credentialFromMetadata(a.credential_record);
    const bRecord = credentialFromMetadata(b.credential_record);
    const aPlan = passportPlans.get(a.id); const bPlan = passportPlans.get(b.id);
    const aDate = aPlan && !aPlan.conflict ? aPlan.renew_on : aRecord?.reminder_on ?? aRecord?.expires_on ?? "9999-12-31";
    const bDate = bPlan && !bPlan.conflict ? bPlan.renew_on : bRecord?.reminder_on ?? bRecord?.expires_on ?? "9999-12-31";
    return aDate.localeCompare(bDate) || a.name.localeCompare(b.name);
  }), [rows, query, kind, passportPlans]);
  return <main className="shell"><header><p className="eyebrow">KAIKOA OS · PRIVATE INVENTORY</p><h1>IDs & Licenses.</h1>
    <p className="muted">Masked identity and license records, with recorded expiry and reminder dates.</p>
    <Link className="back" href="/private-memory/credentials/new">Add ID or license →</Link>
    <p><Link href="/private-memory/credentials/import">Import listed inventory →</Link></p></header>
    {stage === "loading" && <p role="status">Loading IDs and licenses…</p>}
    {stage === "signed-out" && <section className="panel"><p>Sign in to view private credentials.</p><Link href="/auth/sign-in">Sign in →</Link></section>}
    {stage === "error" && <section className="panel" role="alert"><h2>Unable to load IDs and licenses</h2><p>Check your connection and try again.</p></section>}
    {stage === "ready" && <section className="panel">
      <div className="inventoryControls"><div><label htmlFor="credential-search">Search</label><input id="credential-search" type="search" maxLength={120} placeholder="Name, type or issuer" value={query} onChange={event => setQuery(event.target.value)} /></div>
        <div><label htmlFor="credential-kind">Type</label><select id="credential-kind" value={kind} onChange={event => setKind(event.target.value)}><option value="">All types</option>{Object.entries(credentialTypeLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      </div>
      <p className="muted" role="status">Showing {visible.length} of {rows.length} records. Only the last four digits are stored.</p>
      {visible.length === 0 ? <p className="muted">{rows.length ? "No records match these filters." : "No IDs or licenses recorded yet."}</p> :
        <div>{credentialGroups.map(group => {
          const members = visible.filter(row => credentialGroup(credentialFromMetadata(row.credential_record)?.credential_type, row.subtype, row.credential_group) === group.key);
          if (members.length === 0) return null;
          return <section className="inventoryCategoryGroup" key={group.key} aria-labelledby={`credential-group-${group.key}`}>
            <div className="sectionHead"><h2 id={`credential-group-${group.key}`}>{group.label}</h2><span className="muted">{members.length} {members.length === 1 ? "record" : "records"}</span></div>
            {group.key === "philippines_ppl" && <p className="muted">Private Pilot Licence · related pilot, radio and medical records.</p>}
            <div className="assetGrid">{members.map(row => {
          const record: CredentialRecord | null = credentialFromMetadata(row.credential_record);
          const plan = passportPlans.get(row.id);
          const attention = plan ? passportAttention(plan, today) : record ? renewalAttention(record, today) : "Details need setup";
          return <article className="asset credentialCard" key={row.id}>
            <span className="eyebrow">{record ? credentialTypeLabels[record.credential_type] : row.subtype === "passport" ? "Passport · needs setup" : "Credential · needs setup"}</span>
            <strong>{row.name}</strong>
            <span>{record?.issuer || "Issuer not recorded"}</span>
            <span className="credentialAttention">{attention}</span>
            <small>{record?.last_four ? `Ending ···· ${record.last_four}` : "Number suffix not recorded"}</small>
            <small>Expires: {plan?.conflict ? "Sources disagree · review linked documents" : plan?.record.expires_on ?? record?.expires_on ?? "Not recorded"}{plan && !plan.conflict ? " · passport photo" : ""}</small>
            {plan && !plan.conflict ? <>
              <small>Start renewal: {plan.renew_on}</small>
              <small>Six-month travel threshold: {plan.travel_review_on}</small>
              <small>{plan.record.notification ? "ChatGPT reminders set up · monthly checks" : "Notifications not configured"}</small>
              <small className="muted">{plan.record.source_note}</small>
              <a href={plan.source_url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open passport in Drive ↗</a>
            </> : <small>Reminder: {record?.reminder_on ?? "Not set"}</small>}
            <small>{record ? credentialStateLabel(record.record_state) : "Needs verification"} · data quality: {row.data_quality ?? "not recorded"}</small>
            {record?.source_note && <small className="muted">{plan ? "Earlier record note" : "Source"}: {record.source_note}</small>}
            <Link href={`/private-memory/credentials/${encodeURIComponent(row.slug)}/edit`}>Update record →</Link>
          </article>;
            })}</div>
          </section>;
        })}</div>}
      <p className="muted">Passport planning starts nine months before expiry, with a six-month travel threshold. Configured passport reminders run in ChatGPT; other reminder dates here are records only. Update the source after renewal. Dates do not certify current validity or destination entry requirements.</p>
    </section>}
  </main>;
}
