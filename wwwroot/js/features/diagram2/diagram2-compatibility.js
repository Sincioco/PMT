import {
  buildAnnotationSvg
} from "../../components/image-annotation.js?v=20260726-annotation-rte-composition-v2";
import {
  canDiagramFeatureReadPmtDiagramFile,
  createDiagramSelectionClipboardPackage,
  createPmtDiagramFile,
  diagramCompatibilityCapabilities,
  diagramSelectionClipboardFormat,
  diagramSelectionClipboardPlainTextHeader,
  diagramSelectionClipboardVersion,
  diagramSharedDocumentContract,
  normalizeDiagramTemplateLibrary,
  parseDiagramSelectionClipboardPackage,
  parsePmtDiagramFile,
  pmtDiagramFileFormat,
  pmtDiagramFileVersion,
  remapDiagramSelectionClipboardPackageIds,
  serializeDiagramSelectionClipboardPackage
} from "../../shared/diagram-contracts.js?v=20260725-diagram2-day3-v1";

export const diagram2CompatibilityFeatureName = "Diagram 2";

export const diagram2CompatibilityContract = Object.freeze({
  feature: diagram2CompatibilityFeatureName,
  documentType: diagramSharedDocumentContract.documentType,
  resource: diagramSharedDocumentContract.resource,
  duplicateDatabaseRecords: diagramSharedDocumentContract.duplicateDatabaseRecords,
  endpoints: diagramSharedDocumentContract.endpoints,
  fileFormat: pmtDiagramFileFormat,
  fileFormatVersion: pmtDiagramFileVersion,
  selectionClipboardFormat: diagramSelectionClipboardFormat,
  selectionClipboardVersion: diagramSelectionClipboardVersion,
  selectionClipboardHeader: diagramSelectionClipboardPlainTextHeader,
  objectTemplates: diagramCompatibilityCapabilities.objectTemplates,
  persistedRendererCaches: diagramCompatibilityCapabilities.persistedRendererCaches
});

export function diagram2CompatibilitySummary() {
  return {
    ...diagram2CompatibilityContract,
    compatibleFeatures: [...diagramCompatibilityCapabilities.compatibleFeatures]
  };
}

export function normalizeDiagram2TemplateLibrary(input) {
  return normalizeDiagramTemplateLibrary(input);
}

export async function loadDiagram2TemplateLibrary(loadTemplateLibrary) {
  if (typeof loadTemplateLibrary !== "function") {
    throw new Error("Diagram 2 requires the shared Diagram template-library loader.");
  }
  return normalizeDiagram2TemplateLibrary(await loadTemplateLibrary());
}

export async function loadDiagram2DefaultTemplateLibrary(loadDefaultTemplateLibrary) {
  if (typeof loadDefaultTemplateLibrary !== "function") {
    throw new Error("Diagram 2 requires the shared Diagram default-template-library loader.");
  }
  return normalizeDiagram2TemplateLibrary(await loadDefaultTemplateLibrary());
}

export async function saveDiagram2TemplateLibrary(saveTemplateLibrary, library) {
  if (typeof saveTemplateLibrary !== "function") {
    throw new Error("Diagram 2 requires the shared Diagram template-library saver.");
  }
  const normalized = normalizeDiagram2TemplateLibrary(library);
  return normalizeDiagram2TemplateLibrary(await saveTemplateLibrary(normalized));
}

export function createDiagram2PmtDiagramFile(options = {}) {
  return createPmtDiagramFile({
    ...options,
    generatorFeature: diagram2CompatibilityFeatureName
  });
}

export function parseDiagram2PmtDiagramFile(contents) {
  return parsePmtDiagramFile(contents);
}

export function canDiagram2ReadPmtDiagramFile(contents) {
  return canDiagramFeatureReadPmtDiagramFile(diagram2CompatibilityFeatureName, contents);
}

export function createDiagram2SelectionClipboardPackage(options = {}) {
  return createDiagramSelectionClipboardPackage({
    ...options,
    sourceFeature: diagram2CompatibilityFeatureName
  });
}

export function serializeDiagram2SelectionClipboardPackage(packageInput) {
  return serializeDiagramSelectionClipboardPackage(packageInput);
}

export function createDiagram2SelectionClipboardText(options = {}) {
  return serializeDiagram2SelectionClipboardPackage(createDiagram2SelectionClipboardPackage(options));
}

export function parseDiagram2SelectionClipboardText(contents) {
  return parseDiagramSelectionClipboardPackage(contents);
}

export function remapDiagram2SelectionClipboardPackageIds(packageInput, options = {}) {
  return remapDiagramSelectionClipboardPackageIds(packageInput, options);
}

export function diagram2CompatibilityProbe(stateInput, options = {}) {
  const state = stateInput && typeof stateInput === "object" ? stateInput : { width: 1, height: 1, objects: [] };
  const selectedObjectIds = Array.isArray(options.selectedObjectIds)
    ? options.selectedObjectIds
    : (state.objects || []).slice(0, Math.min(2, state.objects?.length || 0)).map(object => object.id);
  const fileContents = createDiagram2PmtDiagramFile({
    title: options.title || "Diagram 2 Compatibility Probe",
    state,
    svg: buildAnnotationSvg(state),
    exportedAt: options.exportedAt || "2026-07-25T00:00:00.000Z"
  });
  const parsedFile = parseDiagram2PmtDiagramFile(fileContents);
  const clipboardText = createDiagram2SelectionClipboardText({
    state,
    selectedObjectIds
  });
  const parsedClipboard = parseDiagram2SelectionClipboardText(clipboardText);

  return {
    feature: diagram2CompatibilityFeatureName,
    fileFormat: pmtDiagramFileFormat,
    fileFormatVersion: pmtDiagramFileVersion,
    fileReadableByDiagram: canDiagramFeatureReadPmtDiagramFile("Diagram", fileContents),
    fileReadableByDiagram2: canDiagram2ReadPmtDiagramFile(fileContents),
    fileObjectCount: parsedFile.state.objects.length,
    selectionClipboardFormat: parsedClipboard.format,
    selectionClipboardVersion: parsedClipboard.formatVersion,
    selectionClipboardObjectCount: parsedClipboard.selection.objects.length,
    selectionClipboardSourceFeature: parsedClipboard.source.feature,
    templateLibraryEndpoint: diagramSharedDocumentContract.endpoints.templateLibrary,
    defaultTemplateLibraryEndpoint: diagramSharedDocumentContract.endpoints.defaultTemplateLibrary,
    persistedRendererCaches: diagramCompatibilityCapabilities.persistedRendererCaches
  };
}
