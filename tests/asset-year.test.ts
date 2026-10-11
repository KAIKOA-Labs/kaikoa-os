import assert from "node:assert/strict";
import test from "node:test";
import { assetYearsByEntity, type AssetYearDocument } from "../lib/asset-year.ts";
import { filterInventory } from "../lib/inventory-view.ts";

const entities = [{id:"boat",subtype:"vessel"},{id:"car",subtype:"vehicle"},{id:"other",subtype:"equipment"}];
function document(id: string, document_type: string, fields: {label:string;value:string|null}[], category = "registration"): AssetYearDocument {
  return {id,document_type,evidence_summary:{version:1,category,role:"primary",bundle_id:"00000000-0000-0000-0000-000000000001",extracted_on:"2026-01-01",fields:fields.map(field=>({...field,source:"Example registration"})),notes:[],sources:[]}};
}
const linked = (document_id:string,entity_id:string|null)=>({document_id,entity_id});
test("year tags use explicit linked model/build evidence rather than circulation or document dates",()=>{
  const documents=[document("b","vessel_registration",[{label:"Vessel / build",value:"Example vessel / 2020"},{label:"Issued",value:"2021"}]),document("c","vehicle_registration",[{label:"First circulation",value:"2025"},{label:"Declaration date",value:"12 June 2025"}])];
  const links=[linked("b","boat"),linked("c","car")];
  assert.deepEqual([...assetYearsByEntity(entities,documents,links)],[["boat",2020]]);
  documents.push(document("model","vehicle_registration",[{label:"Model year",value:"2024"}]));
  assert.equal(assetYearsByEntity(entities,documents,[...links,linked("model","car")]).get("car"),2024);
});
test("missing, malformed, unrelated and wrong-category evidence cannot supply a year",()=>{
  for(const doc of [document("d","insurance",[{label:"Model year",value:"2024"}]),document("d","vehicle_registration",[{label:"Model year",value:"2024"}],"insurance"),document("d","vehicle_registration",[{label:"Model year",value:null}]),document("d","vehicle_registration",[{label:"Model year",value:"12 June 2024"}]),document("d","vehicle_registration",[{label:"Model year",value:"99"}]),{id:"d",document_type:"vehicle_registration",evidence_summary:{version:99}}]){
    assert.equal(assetYearsByEntity(entities,[doc],[linked("d","car")]).size,0);
  }
  const doc=document("d","vehicle_registration",[{label:"Year of manufacture",value:"2023"}]);
  for(const link of [linked("d",null),linked("d","boat"),linked("d","other"),linked("different","car")]) assert.equal(assetYearsByEntity(entities,[doc],[link]).size,0);
});
test("conflicting years within or across linked sources remain unknown; matching sources agree",()=>{
  const first=document("a","vessel_registration",[{label:"Year built",value:"2020"}]);
  const second=document("b","vessel_registration",[{label:"Build year",value:"2021"}]);
  const links=[linked("a","boat"),linked("b","boat")];
  assert.equal(assetYearsByEntity(entities,[first,second],links).size,0);
  assert.equal(assetYearsByEntity(entities,[first,{...first,id:"b"}],links).get("boat"),2020);
  assert.equal(assetYearsByEntity(entities,[document("a","vessel_registration",[{label:"Year built",value:"2020"},{label:"Build year",value:"2021"}])],links).size,0);
});
test("inventory search includes the displayed year without inventing a year for missing evidence",()=>{
  const records=[{id:"boat",slug:"example",name:"Example vessel",subtype:"vessel",status:"ACTIVE",location:null,data_quality:null,asset_year:2020},{id:"car",slug:"other",name:"Example car",subtype:"vehicle",status:"ACTIVE",location:null,data_quality:null}];
  assert.deepEqual(filterInventory(records,"2020",null).map(record=>record.id),["boat"]);
  assert.equal(filterInventory(records,"2025",null).length,0);
});
