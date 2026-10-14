"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { registryFromMetadata, validatePrintRegistry, type PrintRecord, type EditionRule, type PrintRegistry } from "@/lib/artwork-print-registry";

const defaultPrint = (label: string): PrintRecord => ({
  edition_label: label, kind: "numbered", number: 1, production: "unknown",
  location: null, availability: "unknown", fulfillment: "unknown",
  payment: "unverified", allocation: null, source_note: ""
});
const defaultRule = (): EditionRule => ({ edition_label: "", numbered_limit: 1, artist_proof_limit: 0, reproduction_locked: false });
const production = ["unknown", "printed_signed", "framed_boxed"] as const;
const availability = ["unknown", "available", "reserved", "sold", "gift"] as const;
const fulfillment = ["unknown", "held", "awaiting_handover", "shipped", "delivered"] as const;
const payments = ["unverified", "reported_paid", "verified_paid", "not_applicable"] as const;
function Selector<T extends string>({ caption, value, values, onChange }: { caption: string; value: T; values: readonly T[]; onChange: (value: T) => void }) {
  return <label>{caption}<select value={value} onChange={e => onChange(e.target.value as T)}>{values.map(v => <option key={v} value={v}>{v.replaceAll("_", " ")}</option>)}</select></label>;
}
export default function ManagePhysicalPrints() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const [entity, setEntity] = useState<{ id: string; name: string } | null>(null);
  const [expected, setExpected] = useState<PrintRegistry | null>(null);
  const [rules, setRules] = useState<EditionRule[]>([]);
  const [prints, setPrints] = useState<PrintRecord[]>([]);
  const [state, setState] = useState("Loading print records…");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const inFlight = useRef(false);
  useEffect(() => {
    const request = ++generation.current;
    setEntity(null); setMessage(""); setState("Loading print records…"); setBusy(false);
    (async () => {
      const db = getBrowserSupabase();
      if (!db) throw new Error("Connection unavailable.");
      const { data: session, error: identityError } = await db.auth.getUser();
      if (request !== generation.current) return;
      if (identityError || !session.user) throw new Error("Sign in before editing artwork.");
      const { data, error } = await db.from("entities").select("id,name,metadata").eq("slug", slug).eq("subtype", "artwork").neq("status", "ARCHIVED").maybeSingle();
      if (request !== generation.current) return;
      if (error || !data) throw new Error("Artwork not found or access denied.");
      const existing = registryFromMetadata(data.metadata);
      setEntity({ id: data.id, name: data.name });
      setExpected(existing);
      setRules(existing?.rules ?? []);
      setPrints(existing?.prints ?? []);
      setState("ready");
    })().catch(err => { if (request === generation.current) setState(err instanceof Error ? err.message : "Unable to load artwork."); });
    return () => { ++generation.current; };
  }, [slug]);
  const patchRule = (index: number, patch: Partial<EditionRule>) => setRules(rows => rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  const patchPrint = (index: number, patch: Partial<PrintRecord>) => setPrints(rows => rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!entity || inFlight.current) return;
    let proposed: PrintRegistry;
    try { proposed = validatePrintRegistry({ version: 1, rules, prints }); }
    catch (err) { setMessage(err instanceof Error ? err.message : "Check registry data."); return; }
    if (!window.confirm("Save these print identities and status records to your private KAIKOA OS? Every change is audited."))
      return;
    const request = generation.current;
    inFlight.current = true; setBusy(true); setMessage("Saving and auditing print records…");
    try {
      const db = getBrowserSupabase();
      if (!db) throw new Error("Connection unavailable.");
      const { data: identity, error: identityError } = await db.auth.getUser();
      if (generation.current !== request) return;
      if (identityError || !identity.user) throw new Error("Please sign in again.");
      const { data, error } = await db.rpc("update_artwork_print_registry", {
        p_entity_id: entity.id, p_expected_registry: expected, p_registry: proposed
      });
      if (generation.current !== request) return;
      if (error) throw new Error(error.message.includes("Print registry changed")
        ? "Another session changed this inventory. Reload and compare before saving."
        : "Save rejected. Existing records were preserved; review edition locks, print numbers, or ownership.");
      setExpected(proposed); setRules(proposed.rules); setPrints(proposed.prints);
      setMessage(data ? "Saved and audited. Open Physical Prints to verify." : "No change required; current registry already matches.");
    } catch (err) { if (generation.current === request) setMessage(err instanceof Error ? err.message : "Save failed."); }
    finally { inFlight.current = false; if (generation.current === request) setBusy(false); }
  }
  if (state !== "ready" || !entity) return <main className="shell"><section className="panel"><p role="status">{state}</p><Link href="/private-memory/artwork">Back to Artwork →</Link></section></main>;
  return <main className="shell">
    <header><p className="eyebrow">KAIKOA OS · ARTWORK · OWNER EDITOR</p><h1>Manage physical prints.</h1>
      <p>{entity.name}</p><p className="muted">One print identity per edition, number and kind. Production, storage, reservation, fulfillment and payment evidence stay independent. Source notes are required.</p>
    </header>
    <form className="workflowForm" onSubmit={save}>
      <fieldset disabled={busy} className="editionFieldset">
        <section className="panel"><h2>Authorized editions</h2>
          <p className="muted">Lock a one-of-one edition permanently. Once a locked rule is saved, it cannot be unlocked or removed through this editor.</p>
          {rules.map((rule, index) => <div key={index} className="detail" style={{ marginBottom: 14 }}>
            <label>Edition name<input required maxLength={120} value={rule.edition_label} onChange={e => {
              const prior = rule.edition_label;
              patchRule(index, { edition_label: e.target.value });
              setPrints(rows => rows.map(p => p.edition_label === prior ? { ...p, edition_label: e.target.value } : p));
            }}/></label>
            <label>Numbered copies authorized<input type="number" min={1} max={1000000} required value={rule.numbered_limit} onChange={e => patchRule(index, { numbered_limit: Number(e.target.value) })}/></label>
            <label>Artist proofs authorized<input type="number" min={0} max={1000000} required value={rule.artist_proof_limit} onChange={e => patchRule(index, { artist_proof_limit: Number(e.target.value) })}/></label>
            <label className="confirmCompletion"><input type="checkbox" checked={rule.reproduction_locked} onChange={e => patchRule(index, { reproduction_locked: e.target.checked })}/> Lock edition against additional reproductions</label>
            <button type="button" onClick={() => setRules(rows => rows.filter((_, i) => i !== index))}>Remove edition from draft</button>
          </div>)}
          <button type="button" disabled={rules.length >= 50} onClick={() => setRules(rows => [...rows, defaultRule()])}>Add edition</button>
        </section>
        <section className="panel"><h2>Individual physical prints</h2>
          {prints.map((p, index) => <div key={index} className="detail" style={{ marginBottom: 14 }}>
            <h3 style={{ margin: 0 }}>Print {index + 1}</h3>
            <label>Edition<select required value={p.edition_label} onChange={e => patchPrint(index, { edition_label: e.target.value })}>
              <option value="">Select edition</option>{rules.filter(r => r.edition_label).map(r => <option key={r.edition_label} value={r.edition_label}>{r.edition_label}</option>)}
            </select></label>
            <Selector caption="Print kind" value={p.kind} values={["numbered", "artist_proof"]} onChange={kind => patchPrint(index, { kind })}/>
            <label>Number<input type="number" required min={1} max={1000000} value={p.number} onChange={e => patchPrint(index, { number: Number(e.target.value) })}/></label>
            <Selector caption="Production" value={p.production} values={production} onChange={production => patchPrint(index, { production })}/>
            <Selector caption="Availability" value={p.availability} values={availability} onChange={availability => patchPrint(index, { availability })}/>
            <Selector caption="Fulfillment" value={p.fulfillment} values={fulfillment} onChange={fulfillment => patchPrint(index, { fulfillment })}/>
            <Selector caption="Payment evidence" value={p.payment} values={payments} onChange={payment => patchPrint(index, { payment })}/>
            <label>Physical location (blank if unknown)<input maxLength={240} value={p.location ?? ""} onChange={e => patchPrint(index, { location: e.target.value || null })}/></label>
            <label>Recipient / allocation (required if reserved)<input maxLength={240} value={p.allocation ?? ""} onChange={e => patchPrint(index, { allocation: e.target.value || null })}/></label>
            <label>Source and correction note<textarea required rows={2} maxLength={1000} value={p.source_note} onChange={e => patchPrint(index, { source_note: e.target.value })}/></label>
            <button type="button" onClick={() => setPrints(rows => rows.filter((_, i) => i !== index))}>Remove print from draft</button>
          </div>)}
          <button type="button" disabled={prints.length >= 1000 || rules.length === 0} onClick={() => setPrints(rows => [...rows, defaultPrint(rules[0].edition_label)])}>Add numbered print</button>
        </section>
        <p className="muted">This owner action saves the entire validated registry atomically and records change history. Existing edition totals remain separate.</p>
        <button type="submit">{busy ? "Saving…" : "Review and save print registry"}</button>
      </fieldset>
      {message && <p role="status">{message}</p>}
    </form>
    <p><Link href={"/private-memory/artwork/" + encodeURIComponent(slug) + "/prints"}>Physical Prints →</Link></p>
  </main>;
}
