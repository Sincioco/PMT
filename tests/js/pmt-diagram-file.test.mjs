import assert from "node:assert/strict";
import test from "node:test";
import {
  createPmtDiagramFile,
  parsePmtDiagramFile,
  pmtDiagramFileFormat,
  pmtDiagramFileVersion
} from "../../wwwroot/js/features/diagram/pmt-diagram-file.js";

test("PMT Diagram files preserve editable state and reject unsupported versions", () => {
  const state = {
    width: 900,
    height: 600,
    objects: [{ id: "text-1", type: "textbox", x: 10, y: 20, width: 200, height: 90, text: "Portable" }]
  };
  const contents = createPmtDiagramFile({
    title: "Portable Diagram",
    state,
    exportedAt: "2026-07-21T00:00:00.000Z"
  });
  const raw = JSON.parse(contents);
  assert.equal(raw.format, pmtDiagramFileFormat);
  assert.equal(raw.formatVersion, pmtDiagramFileVersion);
  assert.deepEqual(raw.extensions, {});
  assert.deepEqual(raw.diagram.extensions, {});

  const restored = parsePmtDiagramFile(contents);
  assert.equal(restored.title, "Portable Diagram");
  assert.equal(restored.state.objects[0].text, "Portable");
  assert.match(restored.svg, /data-pmt-image-annotation-state="true"/);

  raw.formatVersion = pmtDiagramFileVersion + 1;
  assert.throws(() => parsePmtDiagramFile(JSON.stringify(raw)), /not supported/);
  assert.throws(() => parsePmtDiagramFile("not json"), /not valid PMT Diagram JSON/);
});
