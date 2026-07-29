import {
  annotationTemplateDownloadFile,
  applyAnnotationTemplateFormatting,
  captureAnnotationTemplate,
  instantiateAnnotationTemplate,
  parseAnnotationTemplateUpload,
  portableAnnotationTemplate,
  restoreAnnotationDefaultTemplates
} from "../../components/image-annotation.js?v=20260729-diagram2-d1-relationships-v1";
import {
  loadDiagram2DefaultTemplateLibrary,
  loadDiagram2TemplateLibrary,
  normalizeDiagram2TemplateLibrary,
  saveDiagram2TemplateLibrary
} from "./diagram2-compatibility.js?v=20260729-diagram2-d1-relationships-v1";

const maximumDiagram2Templates = 50;

export async function createDiagram2TemplateState(options = {}) {
  const state = {
    library: normalizeDiagram2TemplateLibrary(null),
    defaultLibrary: normalizeDiagram2TemplateLibrary(null),
    loaded: false,
    defaultLoaded: false,
    busy: false,
    error: "",
    message: ""
  };

  try {
    state.library = await loadDiagram2TemplateLibrary(options.loadTemplateLibrary);
    state.loaded = true;
  } catch (error) {
    state.error = error?.message || "Diagram 2 templates could not be loaded.";
  }

  if (typeof options.loadDefaultTemplateLibrary === "function") {
    try {
      state.defaultLibrary = await loadDiagram2DefaultTemplateLibrary(options.loadDefaultTemplateLibrary);
      state.defaultLoaded = true;
    } catch {
      state.defaultLoaded = false;
    }
  }

  return state;
}

export function diagram2TemplateStateFromLibrary(libraryInput = null) {
  return {
    library: normalizeDiagram2TemplateLibrary(libraryInput),
    defaultLibrary: normalizeDiagram2TemplateLibrary(null),
    loaded: true,
    defaultLoaded: false,
    busy: false,
    error: "",
    message: ""
  };
}

export async function persistDiagram2TemplateLibrary(templateState, saveTemplateLibrary, nextLibrary, message = "") {
  if (!templateState || templateState.busy === true) return null;
  templateState.busy = true;
  templateState.message = "Saving templates...";
  try {
    const saved = await saveDiagram2TemplateLibrary(saveTemplateLibrary, nextLibrary);
    templateState.library = normalizeDiagram2TemplateLibrary(saved || nextLibrary);
    templateState.loaded = true;
    templateState.error = "";
    templateState.message = message;
    return templateState.library;
  } catch (error) {
    templateState.error = error?.message || "The Diagram 2 template library could not be saved.";
    templateState.message = templateState.error;
    return null;
  } finally {
    templateState.busy = false;
  }
}

export async function captureDiagram2SelectionTemplate(state, selectedObjectIds, name) {
  const template = captureAnnotationTemplate(state, selectedObjectIds, "", name);
  return template ? portableAnnotationTemplate(template) : null;
}

export function instantiateDiagram2TemplateObjects(template, center, existingObjectIds = []) {
  const usedIds = new Set((Array.isArray(existingObjectIds) ? existingObjectIds : [])
    .map(id => String(id || "").trim())
    .filter(Boolean));
  const groupId = diagram2TemplateGroupId();
  const objects = instantiateAnnotationTemplate(
    template,
    center,
    type => diagram2TemplateObjectId(type, usedIds),
    groupId
  );
  const hasGroup = objects.some(object => object.groupId);
  return {
    objects,
    groupNames: hasGroup && template?.groupName ? { [groupId]: String(template.groupName) } : {},
    groupVisibility: hasGroup ? { [groupId]: template?.groupVisible !== false } : {}
  };
}

export function applyDiagram2TemplateFormat(template, objectsInput = []) {
  const objects = (Array.isArray(objectsInput) ? objectsInput : [])
    .map(object => object && typeof object === "object" ? structuredCloneValue(object) : null)
    .filter(Boolean);
  const result = applyAnnotationTemplateFormatting(template, objects);
  return {
    result,
    objects
  };
}

export function diagram2TemplateDownload(template) {
  return annotationTemplateDownloadFile(template);
}

export function parseDiagram2TemplateUpload(sourceText) {
  return parseAnnotationTemplateUpload(sourceText);
}

export function restoreDiagram2DefaultTemplates(library, defaults) {
  return restoreAnnotationDefaultTemplates(library, defaults);
}

export function diagram2TemplateCapacityReached(library) {
  return normalizeDiagram2TemplateLibrary(library).templates.length >= maximumDiagram2Templates;
}

export function diagram2DrawingDefaultFromObject(object) {
  if (!object || object.locked === true) return null;
  if (object.type === "arrow") {
    return {
      stroke: safeColor(object.stroke, "#3f7f0d"),
      strokeWidth: clampNumber(positiveNumber(object.strokeWidth, 4), 1, 40),
      arrowSize: clampNumber(positiveNumber(object.arrowSize, 24), 6, 160),
      opacity: safeOpacity(object.opacity)
    };
  }
  if (object.type === "rectangle") {
    return {
      fill: object.fill === "none" ? "none" : safeColor(object.fill, "none"),
      stroke: safeColor(object.stroke, "#3f7f0d"),
      outlineVisible: object.outlineVisible !== false,
      strokeWidth: clampNumber(positiveNumber(object.strokeWidth, 4), 1, 40),
      opacity: safeOpacity(object.opacity)
    };
  }
  return null;
}

export function normalizeDiagram2DrawingDefaults(input) {
  const source = input && typeof input === "object" ? input : {};
  return {
    arrow: normalizeDiagram2DrawingDefault("arrow", source.arrow),
    rectangle: normalizeDiagram2DrawingDefault("rectangle", source.rectangle)
  };
}

export function applyDiagram2DrawingDefault(objectInput, defaultsInput) {
  const object = objectInput && typeof objectInput === "object" ? { ...objectInput } : null;
  if (!object) return object;
  const defaults = normalizeDiagram2DrawingDefaults(defaultsInput);
  const defaultStyle = object.type === "arrow"
    ? defaults.arrow
    : object.type === "rectangle"
      ? defaults.rectangle
      : null;
  return defaultStyle ? { ...object, ...defaultStyle } : object;
}

function normalizeDiagram2DrawingDefault(type, input) {
  const value = input && typeof input === "object" ? input : null;
  if (!value) return null;
  return diagram2DrawingDefaultFromObject({
    type,
    ...value,
    locked: false
  });
}

function diagram2TemplateObjectId(type, usedIds) {
  const prefix = String(type || "object").replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "") || "object";
  let id = "";
  do {
    id = `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  } while (usedIds.has(id));
  usedIds.add(id);
  return id;
}

function diagram2TemplateGroupId() {
  return `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function structuredCloneValue(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function safeColor(value, fallback) {
  const text = String(value || "").trim();
  if (text === "none") return "none";
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(text)) return text;
  return fallback;
}

function safeOpacity(value) {
  return clampNumber(Number(value ?? 1), 0, 1);
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}
