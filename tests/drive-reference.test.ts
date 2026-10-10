import test from "node:test";
import assert from "node:assert/strict";
import { driveTarget, referencePayload, safeDriveLink } from "../lib/drive-reference.ts";
const id = "example_file_id_12345";
test("Drive reference normalization accepts expected Google forms and drops tracking parameters", () => {
  assert.deepEqual(driveTarget(`https://drive.google.com/drive/folders/${id}?usp=sharing`), { id, folder: true, url: `https://drive.google.com/drive/folders/${id}` });
  for (const value of [`https://drive.google.com/file/d/${id}/view?usp=drivesdk`, `https://docs.google.com/document/d/${id}/edit`, `https://docs.google.com/spreadsheets/d/${id}/edit`, `https://docs.google.com/presentation/d/${id}/preview`])
    assert.equal(driveTarget(value).url, `https://drive.google.com/file/d/${id}/view`);
});
test("external links, credentials, resource keys, unexpected paths and unsafe schemes are rejected", () => {
  for (const value of ["javascript:alert(1)", `https://drive.google.com.evil.example/file/d/${id}/view`, `https://owner:secret@drive.google.com/file/d/${id}/view`, `http://drive.google.com/file/d/${id}/view`, `https://drive.google.com/file/d/${id}/view?resourcekey=secret`, `https://drive.google.com/file/d/${id}/view#secret`, `https://drive.google.com/file/d/${id}/view/other`, `https://drive.google.com:444/file/d/${id}/view`, "https://drive.google.com/file/d/short/view"])
    assert.equal(safeDriveLink(value), null);
  assert.equal(safeDriveLink({}), null);
});
test("reference creation requires a file, source, non-sensitive declaration and confirmation", () => {
  const valid = `https://drive.google.com/file/d/${id}/view`;
  const p = referencePayload(" Sample ", valid, " Benign fixture. ", "", true, true);
  assert.equal(p.p_title, "Sample"); assert.equal(p.p_source_note, "Benign fixture."); assert.equal(p.p_entity_id, null);
  assert.throws(() => referencePayload("Sample", valid, "Source", "", false, true));
  assert.throws(() => referencePayload("Sample", valid, "Source", "", true, false));
  assert.throws(() => referencePayload("Sample", `https://drive.google.com/drive/folders/${id}`, "Source", "", true, true));
  assert.throws(() => referencePayload("Sample", valid, "Source", "untrusted", true, true));
  assert.throws(() => referencePayload("Sample\u0000", valid, "Source", "", true, true));
});
