import assert from "node:assert/strict";
import test from "node:test";
import { annualServiceReview, draftFromProfile, emptyVehicleDraft, parseVehicleProfile, vehicleBase, vehicleDraft, vehicleProfilesByEntity, vehicleReadiness } from "../lib/vehicle-profile.ts";
import { filterInventory } from "../lib/inventory-view.ts";
const profile = { ...emptyVehicleDraft("Example pickup"), version: 1, current_base: "Island", registration_plate: "EX 123", condition: "excellent", registration: "current", insurance: "paid", insurance_expires_on: "2027-01-05", serviced_on: "2026-08-11", service_interval: "annual", checked_on: "2026-10-11", source_note: "Owner confirmation and source documents.", recorded_at: "2026-10-11T00:00:00Z" };
test("four confirmed checks are needed for green; plate/location alone never indicate readiness", () => {
  assert.equal(vehicleReadiness(profile,"2026-10-11").state,"ready");
  for(const key of ["condition","registration","insurance","service_interval"]) assert.notEqual(vehicleReadiness({...profile,[key]:"unknown"},"2026-10-11").state,"ready");
  assert.equal(vehicleReadiness({...profile,...emptyVehicleDraft("Example pickup")},"2026-10-11").state,"unknown");
  assert.equal(vehicleReadiness({...profile,checked_on:null},"2026-10-11").state,"unknown");
});
test("past expiry and annual review remove green without creating an appointment", () => {
  assert.equal(vehicleReadiness(profile,"2027-01-05").state,"ready");
  assert.equal(vehicleReadiness(profile,"2027-01-06").state,"attention");
  assert.equal(vehicleReadiness({...profile,insurance_expires_on:null},"2027-08-10").state,"ready");
  const annual=vehicleReadiness({...profile,insurance_expires_on:null},"2027-08-11");
  assert.equal(annual.state,"attention");assert.equal(annual.checks[3].label,"Annual service needs review");
  assert.equal(annualServiceReview("2024-02-29"),"2025-02-28");
});
test("invalid, extra and future-check records fail closed", () => {
  for(const p of [null,[],{...profile,version:2},{...profile,registration:"verified"},{...profile,insurance:null},{...profile,checked_on:"2026-02-31"},{...profile,recorded_at:"2026-02-31T00:00:00Z"},{...profile,service_interval:"monthly"},{...profile,secret:"unwanted"},{...profile,display_name:"invalid\nname"},{...profile,serviced_on:"2026-11-01"}]) assert.equal(parseVehicleProfile(p),null);
  assert.equal(vehicleReadiness({...profile,checked_on:"2026-11-01"},"2026-10-11").state,"unknown");
  assert.equal(vehicleReadiness(profile,"invalid").state,"unknown");
});
test("a future service cannot become green even without a check date", () => {
  assert.equal(vehicleReadiness({...profile,serviced_on:"2026-10-11",checked_on:"2026-10-11"},"2026-10-10").state,"unknown");
  assert.equal(vehicleReadiness({...profile,condition:"needs_work"},"2026-10-11").checks[0].state,"attention");
});
test("validated profile preserves unknowns and inventory can find the displayed plate", () => {
  const saved=parseVehicleProfile(profile)!;assert.ok(saved);
  assert.equal(vehicleDraft(draftFromProfile(saved)).registration_expires_on,null);
  assert.throws(()=>vehicleDraft({...draftFromProfile(saved),recorded_at:"extra"}));
  const row={id:"test",slug:"test",name:"Old title",subtype:"vehicle",status:"REVIEW REQUIRED",location:"Island",data_quality:"unverified",vehicle_profile:profile};
  assert.equal(filterInventory([row],"ex 123",null).length,1);
  assert.equal(filterInventory([row],"example pickup",null).length,1);
  assert.equal(filterInventory([row],"island",null).length,1);
});
test("one linked profile supplies the same current base; malformed or duplicate profiles never show green", () => {
  const links=[{document_id:"a",entity_id:"vehicle"}];
  const one=vehicleProfilesByEntity([{id:"a",vehicle_profile:profile}],links);
  assert.equal(one.get("vehicle")?.current_base,"Island");
  assert.equal(vehicleBase(one.get("vehicle"),"Old base"),"Island");
  assert.equal(vehicleBase({...profile,current_base:null},"Old base"),null);
  assert.equal(vehicleProfilesByEntity([{id:"a",vehicle_profile:{...profile,extra:true}}],links).size,0);
  assert.equal(vehicleProfilesByEntity([{id:"a",vehicle_profile:profile},{id:"b",vehicle_profile:profile}],[...links,{document_id:"b",entity_id:"vehicle"}]).size,0);
});

test("expired registration blocks use even when other checks are unknown; expiry day remains inclusive", () => {
  const p = { ...profile, condition: "unknown", insurance: "unknown", serviced_on: null, service_interval: "unknown", registration: "needs_review", registration_expires_on: "2026-08-31" };
  const expired = vehicleReadiness(p, "2026-10-13");
  assert.equal(expired.state, "blocked");
  assert.equal(expired.label, "Not ready to use");
  assert.equal(expired.checks[1].label, "Registration expired · renewal pending");
  assert.equal(vehicleReadiness({...profile, registration_expires_on: "2026-10-11"}, "2026-10-11").state, "ready");
  assert.equal(vehicleReadiness({...profile, registration_expires_on: "2026-10-11"}, "2026-10-12").state, "blocked");
  assert.equal(vehicleReadiness({...p, checked_on: null}, "2026-10-13").state, "unknown");
  assert.equal(vehicleReadiness({...p, checked_on: "2026-11-01"}, "2026-10-13").state, "unknown");
  assert.equal(vehicleReadiness({...p, registration_expires_on: null}, "2026-10-13").state, "attention");
});
