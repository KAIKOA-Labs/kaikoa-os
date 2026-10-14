import test from "node:test";
import assert from "node:assert/strict";
import { planPrintCorrections } from "../lib/artwork-correction-plan.ts";
const rule={edition_label:"White background",numbered_limit:20,artist_proof_limit:2,reproduction_locked:false};
const row={edition_label:"White background",kind:"numbered" as const,number:1,production:"framed_boxed" as const,location:"With Eddie",availability:"unknown" as const,fulfillment:"held" as const,payment:"reported_paid" as const,allocation:null,source_note:"Johan source"};
const original={version:1 as const,rules:[rule],prints:[row]};
const correction={identity:{edition_label:"White background",kind:"numbered" as const,number:1},expected:row,set:{availability:"sold" as const,fulfillment:"delivered" as const,location:"With client"},reason:"Founder confirms sale and delivery"};
const plan={version:1 as const,artwork_slug:"karmic-bloom",expected_registry:original,corrections:[correction],source_label:"Founder statement 2026-10-14"};
test("updates only selected print with explicit source attribution",()=>{
 const result=planPrintCorrections(original,plan);
 assert.equal(result.after.prints[0].availability,"sold");
 assert.equal(result.after.prints[0].fulfillment,"delivered");
 assert.equal(result.after.prints[0].location,"With client");
 assert.equal(result.after.rules[0].numbered_limit,20);
 assert.match(result.after.prints[0].source_note,/Founder confirms sale and delivery/);
 assert.equal(original.prints[0].availability,"unknown");
});
test("rejects stale snapshot and stale individual print",()=>{
 assert.throws(()=>planPrintCorrections({...original,prints:[{...row,location:"New custodian"}]},plan),/Stale/);
 assert.throws(()=>planPrintCorrections(original,{...plan,corrections:[{...correction,expected:{...row,location:"Other"}}]}),/changed/);
});
test("rejects duplicate identities and edition changes",()=>{
 assert.throws(()=>planPrintCorrections(original,{...plan,corrections:[correction,correction]}),/Duplicate correction/);
 assert.throws(()=>planPrintCorrections(original,{...plan,corrections:[{...correction,set:{number:2} as never}]}),/unauthorized/);
});
test("explicit correction can retract a physically nonexistent proof without changing allowance",()=>{
 const ap={...row,kind:"artist_proof" as const,number:2};
 const r={...original,prints:[row,ap]};
 const result=planPrintCorrections(r,{...plan,expected_registry:r,corrections:[{identity:{edition_label:"White background",kind:"artist_proof",number:2},expected:ap,remove_unproduced:true,reason:"Founder verifies this copy was never printed"}]});
 assert.equal(result.after.prints.length,1);
 assert.equal(result.after.rules[0].artist_proof_limit,2);
});
