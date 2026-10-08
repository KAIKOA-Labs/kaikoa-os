import assert from "node:assert/strict";
import test from "node:test";
import { artworkCreationPayload } from "../lib/artwork-create.ts";
test("artwork creation sends a trimmed title and description to the dedicated category without invented edition or financial metadata", () => {
  assert.deepEqual(artworkCreationPayload("  Ocean Study  ", "  Original illustration  "),
    { p_name: "Ocean Study", p_subtype: "artwork", p_description: "Original illustration" });
  assert.deepEqual(artworkCreationPayload("Untitled", "  "),
    { p_name: "Untitled", p_subtype: "artwork", p_description: "" });
});
test("empty and oversized artwork fields are rejected before a write while exact limits remain accepted", () => {
  for (const name of ["", "  ", " A ", "x".repeat(121)]) assert.throws(() => artworkCreationPayload(name, ""));
  assert.throws(() => artworkCreationPayload("Study", "x".repeat(1001)));
  assert.equal(artworkCreationPayload("x".repeat(120), "x".repeat(1000)).p_name.length, 120);
});
