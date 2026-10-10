"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { credentialFromMetadata, credentialTypeLabels, renewalAttention, credentialStateLabel, type CredentialRecord } from "@/lib/credential-record";

type Row = { id: string; slug: string; name: string; subtype: string | null; status: string; data_quality: string | null; credential_record: unknown };
export default function CredentialInventory() {
  const [rows, setRows] = useState<Row[]>([]);
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
      const { data, error } = await db.from("entities")
        .select("id,slug,name,subtype,status,data_quality,credential_record:metadata->credential_record")
        .in("subtype", ["credential", "passport"]).neq("status", "ARCHIVED").order("name");
      if (!active) return;
      if (error) { setStage("error"); return; }
      setRows(data ?? []); setStage("ready");
    })().catch(() => { if (active) setStage("error"); });
    return () => { active = false; };
  }, []);

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  const visible = useMemo(() => rows.filter(row => {
    const record = credentialFromMetadata(row.credential_record);
    const label = record ? credentialTypeLabels[record.credential_type] : "Needs setup";
    const text = `${row.name} ${label} ${record?.issuer ?? ""}`.toLowerCase();
    return (!query.trim() || text.includes(query.trim().toLowerCase())) && (!kind || record?.credential_type === kind);
  }).sort((a, b) => {
    const aRecord = credentialFromMetadata(a.credential_record);
    const bRecord = credentialFromMetadata(b.credential_record);
    const aDate = aRecord?.reminder_on ?? aRecord?.expires_on ?? "9999-12-31";
    const bDate = bRecord?.reminder_on ?? bRecord?.expires_on ?? "9999-12-31";
    return aDate.localeCompare(bDate) || a.name.localeCompare(b.name);
  }), [rows, query, kind]);
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
        <div className="assetGrid">{visible.map(row => {
          const record: CredentialRecord | null = credentialFromMetadata(row.credential_record);
          const attention = record ? renewalAttention(record, today) : "Details need setup";
          return <article className="asset credentialCard" key={row.id}>
            <span className="eyebrow">{record ? credentialTypeLabels[record.credential_type] : row.subtype === "passport" ? "Passport · needs setup" : "Credential · needs setup"}</span>
            <strong>{row.name}</strong>
            <span>{record?.issuer || "Issuer not recorded"}</span>
            <span className="credentialAttention">{attention}</span>
            <small>{record?.last_four ? `Ending ···· ${record.last_four}` : "Number suffix not recorded"}</small>
            <small>Expires: {record?.expires_on ?? "Not recorded"}</small>
            <small>Reminder: {record?.reminder_on ?? "Not set"}</small>
            <small>{record ? credentialStateLabel(record.record_state) : "Needs verification"} · data quality: {row.data_quality ?? "not recorded"}</small>
            {record?.source_note && <small className="muted">Source: {record.source_note}</small>}
            <Link href={`/private-memory/credentials/${encodeURIComponent(row.slug)}/edit`}>Update record →</Link>
          </article>;
        })}</div>}
      <p className="muted">Dates from older sources need checking against the current credential. This workspace records dates; it does not send notifications.</p>
    </section>}
  </main>;
}
