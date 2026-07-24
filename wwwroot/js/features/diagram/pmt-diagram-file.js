import {
  buildAnnotationSvg,
  normalizeAnnotationState,
  parseAnnotationSvg
} from "../../components/image-annotation.js?v=20260725-field-mapping-v3";

export const pmtDiagramFileFormat = "pmt-diagram";
export const pmtDiagramFileVersion = 1;

export function createPmtDiagramFile({ title, state: stateInput, svg: svgInput, exportedAt } = {}) {
  const state = normalizeAnnotationState(stateInput || parseAnnotationSvg(svgInput));
  const svg = String(svgInput || buildAnnotationSvg(state));
  return JSON.stringify({
    format: pmtDiagramFileFormat,
    formatVersion: pmtDiagramFileVersion,
    minimumReaderVersion: 1,
    exportedAt: String(exportedAt || new Date().toISOString()),
    generator: { name: "PMT", feature: "Diagram" },
    diagram: {
      title: String(title || "Diagram").trim() || "Diagram",
      editorState: state,
      svg,
      extensions: {}
    },
    extensions: {}
  }, null, 2);
}

export function parsePmtDiagramFile(contents) {
  let file;
  try {
    file = JSON.parse(String(contents || ""));
  } catch {
    throw new Error("The selected file is not valid PMT Diagram JSON.");
  }
  if (file?.format !== pmtDiagramFileFormat) throw new Error("The selected file is not a PMT Diagram file.");
  const version = Number(file?.formatVersion || 0);
  if (!Number.isInteger(version) || version < 1 || version > pmtDiagramFileVersion) {
    throw new Error(`PMT Diagram file version ${version || "unknown"} is not supported.`);
  }
  const state = file?.diagram?.editorState
    ? normalizeAnnotationState(file.diagram.editorState)
    : parseAnnotationSvg(file?.diagram?.svg);
  if (!state) throw new Error("The PMT Diagram file does not contain editable Diagram data.");
  return {
    title: String(file?.diagram?.title || "Imported Diagram").trim() || "Imported Diagram",
    state,
    svg: buildAnnotationSvg(state),
    formatVersion: version
  };
}
