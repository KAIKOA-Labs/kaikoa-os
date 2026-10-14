import test from "node:test";
import assert from "node:assert/strict";
import { artGalleryStats } from "../lib/art-gallery-stats.ts";

const rule = { edition_label:"White", numbered_limit:20, artist_proof_limit:2, reproduction_locked:false };
const black = { edition_label:"Black", numbered_limit:1, artist_proof_limit:0, reproduction_locked:true };
const item = (kind:"numbered"|"artist_proof", number:number, fulfillment:"held"|"delivered"|"awaiting_handover", availability:"unknown"|"reserved"|"sold", edition_label="White") => ({
 edition_label,kind,number,production:"framed_boxed",location:"Verified source location",
 availability,fulfillment,payment:"reported_paid",allocation:availability==="reserved"?"Recipient":null,source_note:"Original inventory / founder confirmation"
});
test("gallery reports actual physical records, not authorized edition capacity",()=>{
 const data={version:1,rules:[rule,black],prints:[
 item("artist_proof",2,"held","unknown"),
 item("numbered",4,"awaiting_handover","reserved"),
 item("numbered",1,"delivered","unknown"),
 item("numbered",1,"delivered","sold","Black")]};
 const stats=artGalleryStats(data);
 assert.equal(stats.state,"recorded");assert.equal(stats.versions,2);
 assert.equal(stats.recorded,4);assert.equal(stats.proofs,1);
 assert.equal(stats.held,1);assert.equal(stats.awaitingHandover,1);
 assert.equal(stats.delivered,2);assert.equal(stats.sold,1);assert.equal(stats.locked,1);
});
test("missing and malformed inventory never show fictional counts",()=>{
 const missing=artGalleryStats(null);assert.equal(missing.state,"missing");assert.equal(missing.recorded,0);
 const invalid=artGalleryStats({version:5});assert.equal(invalid.state,"invalid");assert.equal(invalid.recorded,0);
});
