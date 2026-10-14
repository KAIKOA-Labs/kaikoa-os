import { validatePrintRegistry, type PrintKind, type PrintRecord, type PrintRegistry } from "./artwork-print-registry.ts";

/**
 * Pure, source-attributed correction planner. No database access and no privilege escalation.
 * A write adapter must independently authenticate the actor, require owner authorization,
 * perform an atomic expected-state comparison and persist a before/after audit.
 */
export type PrintIdentity = { edition_label: string; kind: PrintKind; number: number };
export type PrintCorrection = {
  identity: PrintIdentity;
  expected: PrintRecord;
  set?: Partial<Pick<PrintRecord, "production" | "location" | "availability" | "fulfillment" | "payment" | "allocation">>;
  remove_unproduced?: boolean;
  reason: string;
};
export type CorrectionPlan = {
  version: 1;
  artwork_slug: string;
  expected_registry: PrintRegistry;
  corrections: PrintCorrection[];
  source_label: string;
};
export type PlannedCorrection = {
  before: PrintRegistry;
  after: PrintRegistry;
  changes: Array<{ identity: PrintIdentity; previous: PrintRecord; next: PrintRecord | null; reason: string }>;
};
const same = (a: unknown,b:unknown) => JSON.stringify(a) === JSON.stringify(b);
const key = (v:PrintIdentity) => `${v.edition_label.toLowerCase()}|${v.kind}|${v.number}`;
const editableFields = new Set(["production","location","availability","fulfillment","payment","allocation"]);

export function planPrintCorrections(liveInput: unknown, intent: CorrectionPlan): PlannedCorrection {
  if (intent.version !== 1 || typeof intent.artwork_slug !== "string" || !/^[a-z0-9-]{2,120}$/.test(intent.artwork_slug)) throw new Error("Missing artwork identity.");
  if (!intent.source_label?.trim() || intent.source_label.trim().length > 240) throw new Error("Corrections need an identifiable source.");
  if (!Array.isArray(intent.corrections) || intent.corrections.length < 1 || intent.corrections.length > 100) throw new Error("Use one to one hundred corrections.");
  const live = validatePrintRegistry(liveInput);
  const expected = validatePrintRegistry(intent.expected_registry);
  if (!same(live,expected)) throw new Error("Stale artwork inventory. Reload before planning corrections.");
  const prints = live.prints.map(p => ({...p}));
  const touched = new Set<string>();
  const changes:PlannedCorrection["changes"] = [];
  for (const change of intent.corrections) {
    if (!change || typeof change !== "object" || !change.identity) throw new Error("Invalid correction.");
    const reason = change.reason?.trim();
    if (!reason || reason.length > 800) throw new Error("Every correction requires a source-backed reason.");
    const id = change.identity;
    const lookup = key(id);
    if (touched.has(lookup)) throw new Error("Duplicate correction for the same physical print.");
    touched.add(lookup);
    const index=prints.findIndex(row=>key(row)===lookup);
    if(index<0) throw new Error("Print not found: "+lookup);
    const before=prints[index];
    if (!same(before,change.expected)) throw new Error("Print record changed since proposal: "+lookup);
    if (change.remove_unproduced) {
      if (change.set && Object.keys(change.set).length>0) throw new Error("Cannot edit and withdraw a physical record simultaneously.");
      // An explicit founder correction can retract a mistakenly recorded physical copy.
      // Authorized edition capacity is preserved separately in rules.
      prints.splice(index,1);
      changes.push({identity:id,previous:before,next:null,reason});
      continue;
    }
    if (!change.set || typeof change.set !== "object" || Array.isArray(change.set) || Object.keys(change.set).length===0) throw new Error("No fields to correct.");
    if (Object.keys(change.set).some(field=>!editableFields.has(field))) throw new Error("Correction attempted to change print identity or unauthorized fields.");
    const next={...before,...change.set,source_note:`${before.source_note}\nCorrection (${intent.source_label}): ${reason}`};
    if(next.source_note.length>1000) throw new Error("Source note would exceed registry limits.");
    if(same(before,next)) throw new Error("Correction had no effect.");
    prints[index]=next;
    changes.push({identity:id,previous:before,next,reason});
  }
  const after=validatePrintRegistry({version:1,rules:live.rules,prints});
  // Only the existing edition definitions survive; no changes to one-of-one locks or allowances.
  if(!same(after.rules,live.rules)) throw new Error("Edition rules cannot change in a print correction.");
  return {before:live,after,changes};
}
