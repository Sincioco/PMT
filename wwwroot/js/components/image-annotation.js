import { sharedRichColorPickerHtml } from "./forms.js?v=20260719-diagram-outline-icon";
import { copyTextToClipboard } from "./clipboard.js?v=20260714-invite-email-body";

const svgNamespace = "http://www.w3.org/2000/svg";
const annotationVersion = 1;
const minimumObjectSize = 8;
const minimumZoom = 0.1;
const maximumZoom = 3;
const annotationZoomStep = 0.05;
const annotationZoomSmoothingMilliseconds = 30;
const annotationZoomIdleMilliseconds = 90;
const annotationZoomPercentages = Array.from({ length: 59 }, (_, index) => 10 + (index * 5));
const maximumAnnotationPlaneDevicePixels = 7680;
const defaultGridSize = 20;
const minimumScaledStrokeWidth = 0.001;
const maximumScaledStrokeWidth = 1000000;
const minimumScaledArrowSize = 0.001;
const maximumScaledArrowSize = 1000000;
const annotationCoordinateScale = 1000;
const annotationCoordinateTolerance = 1 / annotationCoordinateScale;
let annotationEditorRenderSequence = 0;
const minimumEntityRelationshipClearance = 24;
const maximumAnnotationTemplates = 50;
const maximumAnnotationTemplateFileBytes = 50 * 1024 * 1024;
const annotationTemplateVersion = 1;
const annotationTemplateFileFormat = "pmt-image-annotation-template";
const defaultEntityWidth = 520;
const defaultEntityFill = "#ffffff";
const defaultEntityStroke = "#42526b";
const defaultEntityTextColor = "#172b4d";
const defaultEntityFontSize = 18;
const defaultEntityShowKeyColumn = true;
const defaultEntityShowDataTypes = false;
const entityRelationshipsSelectionId = "entity-relationships";
const entityRelationshipsObjectType = "entity-relationships";
const entityRelationshipSelectionPrefix = "entity-relationship:";
const entityRelationshipObjectType = "entity-relationship";
const annotationEntityRelationshipGeometryCache = new WeakMap();
const defaultEntityRelationshipStyle = {
  stroke: defaultEntityStroke,
  strokeWidth: 2,
  arrowSize: 10,
  showSymbols: false
};
const defaultStyles = {
  fill: "#5aa315",
  stroke: "#3f7f0d",
  textColor: "#ffffff",
  entityNameTextColor: defaultEntityTextColor,
  entityHeaderFill: defaultEntityFill,
  fontFamily: "Arial",
  fontSize: 28,
  textAlign: "left",
  textVerticalAlign: "top",
  outlineVisible: true,
  opacity: 1,
  strokeWidth: 4,
  arrowSize: 24
};
const annotationTemplateStyleFields = {
  arrow: ["stroke", "strokeWidth", "arrowSize", "opacity"],
  line: ["stroke", "strokeWidth", "opacity"],
  [entityRelationshipsObjectType]: ["stroke", "strokeWidth", "arrowSize", "showSymbols"],
  [entityRelationshipObjectType]: ["stroke", "strokeWidth", "arrowSize", "showSymbols"],
  rectangle: ["fill", "stroke", "outlineVisible", "strokeWidth", "opacity"],
  circle: ["fill", "stroke", "outlineVisible", "strokeWidth", "opacity"],
  entity: [
    "fill",
    "stroke",
    "outlineVisible",
    "strokeWidth",
    "opacity",
    "textColor",
    "entityNameTextColor",
    "entityHeaderFill",
    "fontFamily",
    "fontSize",
    "showKeyColumn",
    "showDataTypes",
    "foreignKeysAtTop",
    "showSelfRelationships"
  ],
  textbox: [
    "fill",
    "stroke",
    "outlineVisible",
    "strokeWidth",
    "opacity",
    "textColor",
    "fontFamily",
    "fontSize",
    "textAlign",
    "textVerticalAlign"
  ]
};

export async function openImageAnnotationDialog(options) {
  const originalReference = String(options?.originalReference || "").trim();
  const originalUrl = String(options?.originalUrl || "").trim();
  const original = originalUrl
    ? await loadOriginalImage(originalUrl)
    : {
        source: "",
        width: positiveNumber(options?.canvasWidth, 1600),
        height: positiveNumber(options?.canvasHeight, 900)
      };
  let state = null;
  if (options?.annotationUrl) {
    state = await loadExistingAnnotation(options.annotationUrl);
    if (!state) throw new Error("The editable annotation data could not be loaded. The image was left unchanged.");
  }
  state = normalizeAnnotationState(state, {
    width: original.width,
    height: original.height,
    originalReference,
    seedImageSource: original.source
  });
  resolveAnnotationEntityOverlaps(state);

  let templateLibrary = normalizeAnnotationTemplateLibrary(null);
  let templateLibraryError = "";
  if (typeof options?.loadTemplateLibrary === "function") {
    try {
      templateLibrary = normalizeAnnotationTemplateLibrary(await options.loadTemplateLibrary());
    } catch (error) {
      templateLibraryError = error?.message || "Your annotation templates could not be loaded.";
    }
  }

  const initialTemplateName = String(options?.initialTemplateName || "").trim().toLowerCase();
  let initialTemplate = initialTemplateName
    ? templateLibrary.templates.find(template => String(template.name || "").trim().toLowerCase() === initialTemplateName) || null
    : null;
  if (initialTemplateName && !initialTemplate && typeof options?.loadDefaultTemplateLibrary === "function") {
    try {
      const defaultLibrary = normalizeAnnotationTemplateLibrary(await options.loadDefaultTemplateLibrary());
      initialTemplate = defaultLibrary.templates.find(template =>
        String(template.name || "").trim().toLowerCase() === initialTemplateName
      ) || null;
    } catch {
      // The normal template-library error handling remains authoritative.
    }
  }

  return createAnnotationDialog({
    state,
    originalReference: state.originalReference || originalReference,
    originalFileName: options?.originalFileName || "image",
    title: options?.title,
    subtitle: options?.subtitle,
    applyLabel: options?.applyLabel,
    applyingMessage: options?.applyingMessage,
    initialSelection: options?.initialSelection,
    askForColor: options?.askForColor,
    askForText: options?.askForText,
    confirm: options?.confirm,
    notify: options?.notify,
    uploadEmbeddedImage: options?.uploadEmbeddedImage,
    persistCroppedOriginal: options?.persistCroppedOriginal,
    loadDefaultTemplateLibrary: options?.loadDefaultTemplateLibrary,
    saveTemplateLibrary: options?.saveTemplateLibrary,
    generatePmtDatabaseSchema: options?.generatePmtDatabaseSchema,
    templateLibrary,
    templateLibraryError,
    apply: options?.apply,
    embedded: options?.embedded === true,
    initiallyMaximized: options?.initiallyMaximized === true,
    initialZoom: options?.initialZoom == null ? null : Number(options.initialZoom),
    initialTemplate,
    entityHeaderActionsOnHover: options?.entityHeaderActionsOnHover === true,
    host: options?.host,
    signal: options?.signal
  });
}

export function buildAnnotationSvg(inputState, options = {}) {
  const state = normalizeAnnotationState(inputState);
  syncAnnotationEntityAnnotationArrows(state);
  const visibleObjects = annotationVisibleObjects(state);
  const relationshipRenderModel = state.hideAllEntityRelationships
    ? null
    : annotationEntityRelationshipRenderModel(visibleObjects, state.relationshipStyle, {
        allowOverlappingLines: state.allowOverlappingEntityLines
      });
  const outputBounds = annotationOutputBounds(state, { relationshipRenderModel });
  const relationshipLayers = annotationObjectsAroundRelationshipLayer(visibleObjects);
  const metadata = escapeXmlText(JSON.stringify(state));
  const background = annotationCanvasBackgroundSvg(state, outputBounds);
  const relationships = annotationEntityRelationshipsSvg(visibleObjects, state.relationshipStyle, {
    allowOverlappingLines: state.allowOverlappingEntityLines,
    hidden: state.hideAllEntityRelationships,
    relationshipRenderModel
  });
  const belowRelationships = relationshipLayers.below
    .map(object => annotationObjectSvg(object, {
      exportMode: true,
      interactiveEntityHeaders: options?.interactiveEntityHeaders === true
    }))
    .join("");
  const aboveRelationships = relationshipLayers.above
    .map(object => annotationObjectSvg(object, {
      exportMode: true,
      interactiveEntityHeaders: options?.interactiveEntityHeaders === true
    }))
    .join("");

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="${svgNamespace}" width="${formatNumber(outputBounds.width)}" height="${formatNumber(outputBounds.height)}" viewBox="${formatNumber(outputBounds.x)} ${formatNumber(outputBounds.y)} ${formatNumber(outputBounds.width)} ${formatNumber(outputBounds.height)}" role="img" aria-label="Annotated image" data-pmt-image-annotation-version="${annotationVersion}">`,
    `<metadata data-pmt-image-annotation-state="true">${metadata}</metadata>`,
    background,
    belowRelationships,
    relationships,
    aboveRelationships,
    `</svg>`
  ].join("");
}

function annotationObjectsAroundRelationshipLayer(objects) {
  const source = Array.isArray(objects) ? objects : [];
  const originalImageIndex = source.findIndex(object => object.type === "embedded-image"
    && object.isOriginalImage);
  const splitIndex = originalImageIndex >= 0 ? originalImageIndex + 1 : 0;
  return {
    below: source.slice(0, splitIndex),
    above: source.slice(splitIndex)
  };
}

export function buildAnnotationSelectionSvg(inputState, selectedObjectIds) {
  return annotationSelectionClipboardExport(inputState, selectedObjectIds).svg;
}

export async function buildPortableAnnotationSelectionSvg(inputState, selectedObjectIds, options = {}) {
  return (await annotationPortableSelectionClipboardExport(inputState, selectedObjectIds, options)).svg;
}

async function annotationPortableSelectionClipboardExport(inputState, selectedObjectIds, options = {}) {
  const state = normalizeAnnotationState(inputState);
  const ids = new Set(
    selectedObjectIds && typeof selectedObjectIds[Symbol.iterator] === "function"
      ? selectedObjectIds
      : []
  );
  const selectedImages = annotationVisibleObjects(state)
    .filter(object => object.type === "embedded-image" && ids.has(object.id));
  if (!selectedImages.length) return annotationSelectionClipboardExport(state, ids);

  const fetchImage = options.fetch || globalThis.fetch;
  await Promise.all(selectedImages.map(async object => {
    object.source = await portableAnnotationImageSource(object.source, object.name, fetchImage);
  }));
  return annotationSelectionClipboardExport(state, ids);
}

async function portableAnnotationImageSource(source, name, fetchImage) {
  const current = String(source || "").trim();
  if (/^data:image\//i.test(current)) return current;
  if (typeof fetchImage !== "function") {
    throw new Error(`The selected image${name ? ` \"${name}\"` : ""} could not be loaded for copying.`);
  }

  let response;
  try {
    response = await fetchImage(current, { cache: "no-store", credentials: "same-origin" });
  } catch {
    response = null;
  }
  if (!response?.ok) {
    throw new Error(`The selected image${name ? ` \"${name}\"` : ""} could not be loaded for copying.`);
  }

  const blob = await response.blob();
  const contentType = portableAnnotationImageContentType(blob.type, current);
  if (!contentType) {
    throw new Error(`The selected image${name ? ` \"${name}\"` : ""} is not a supported image.`);
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunkSize = 32768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}

function portableAnnotationImageContentType(blobType, source) {
  const supplied = String(blobType || "").split(";", 1)[0].trim().toLowerCase();
  if (/^image\/[a-z0-9.+-]+$/.test(supplied)) return supplied;
  const extension = String(source || "").split(/[?#]/, 1)[0].match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  return {
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp"
  }[extension] || "";
}

function annotationSelectionClipboardExport(inputState, selectedObjectIds) {
  const state = normalizeAnnotationState(inputState);
  syncAnnotationEntityAnnotationArrows(state);
  const ids = new Set(
    selectedObjectIds && typeof selectedObjectIds[Symbol.iterator] === "function"
      ? selectedObjectIds
      : []
  );
  const objects = annotationVisibleObjects(state).filter(object => ids.has(object.id));
  if (!objects.length) return { svg: "", width: 0, height: 0 };

  const relationshipRenderModel = state.hideAllEntityRelationships
    ? null
    : annotationEntityRelationshipRenderModel(objects, state.relationshipStyle, {
        allowOverlappingLines: state.allowOverlappingEntityLines
      });

  const bounds = unionAnnotationBounds(
    [
      ...objects.map(object => annotationObjectVisualBounds(object)),
      ...annotationEntityRelationshipVisualBounds(objects, state.relationshipStyle, {
        allowOverlappingLines: state.allowOverlappingEntityLines,
        relationshipRenderModel
      })
    ].filter(Boolean)
  );
  if (!bounds) return { svg: "", width: 0, height: 0 };
  const relationships = annotationEntityRelationshipsSvg(objects, state.relationshipStyle, {
    allowOverlappingLines: state.allowOverlappingEntityLines,
    hidden: state.hideAllEntityRelationships,
    relationshipRenderModel
  });
  const body = annotationClipboardObjectsSvg(objects);
  const svg = cleanAnnotationClipboardSvgMarkup([
    `<svg xmlns="${svgNamespace}" width="${formatNumber(bounds.width)}" height="${formatNumber(bounds.height)}" viewBox="${formatNumber(bounds.x)} ${formatNumber(bounds.y)} ${formatNumber(bounds.width)} ${formatNumber(bounds.height)}">`,
    relationships,
    body,
    `</svg>`
  ].join(""));
  return { svg, width: bounds.width, height: bounds.height };
}

function annotationClipboardObjectsSvg(objects) {
  const parts = [];
  for (let index = 0; index < objects.length;) {
    const object = objects[index];
    if (!object.groupId) {
      parts.push(annotationObjectSvg(object, { exportMode: true, clipboardMode: true }));
      index += 1;
      continue;
    }

    const groupId = object.groupId;
    const members = [];
    while (index < objects.length && objects[index].groupId === groupId) {
      members.push(annotationObjectSvg(objects[index], { exportMode: true, clipboardMode: true }));
      index += 1;
    }
    parts.push(`<g>${members.join("")}</g>`);
  }
  return parts.join("");
}

function cleanAnnotationClipboardSvgMarkup(svg) {
  return String(svg || "")
    .replace(/<title>[\s\S]*?<\/title>/g, "")
    .replace(/\s+(?:class|role|tabindex|aria-[\w-]+|data-(?:annotation|pmt)-[\w-]+|pointer-events)="[^"]*"/g, "")
    .replace(/\s+rx="0"/g, "")
    .replace(/\s+opacity="1"/g, "")
    .replace(/<g><\/g>/g, "");
}

export function parseAnnotationSvg(svgMarkup) {
  const source = String(svgMarkup || "");
  const match = source.match(/<metadata\b[^>]*data-pmt-image-annotation-state=(?:"true"|'true')[^>]*>([\s\S]*?)<\/metadata>/i);
  if (!match) return null;

  try {
    return normalizeAnnotationState(JSON.parse(decodeXmlText(match[1])));
  } catch {
    return null;
  }
}

export function annotationSvgDataUrl(svgMarkup) {
  const bytes = new TextEncoder().encode(String(svgMarkup || ""));
  let binary = "";
  const chunkSize = 32768;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

export function parseAnnotationEntityDefinition(sourceText, manualEntityName = "") {
  const originalSource = String(sourceText || "").trim();
  const sql = stripAnnotationSqlComments(originalSource);
  const identifier = String.raw`(?:\[[^\]]+\]|[A-Za-z_@#][A-Za-z0-9_$#@]*)`;
  const qualifiedIdentifier = `${identifier}(?:\\s*\\.\\s*${identifier}){0,2}`;
  const createTable = new RegExp(`\\bCREATE\\s+TABLE\\s+(${qualifiedIdentifier})\\s*\\(`, "i").exec(sql);

  if (!createTable) {
    const nameParts = annotationEntityIdentifierParts(manualEntityName);
    const fields = originalSource
      .split(/[,\r\n]+/)
      .map(value => unquoteAnnotationSqlIdentifier(value.trim()))
      .filter(Boolean)
      .map(name => ({
        name,
        dataType: "",
        nullable: null,
        isPrimaryKey: false,
        isForeignKey: false,
        isImportant: false,
        isIdentity: false,
        identity: ""
      }));
    if (!nameParts.length) throw new Error("Enter an Entity Name.");
    if (!fields.length) throw new Error("Enter at least one field name or paste a CREATE TABLE script.");
    return {
      schema: nameParts.length > 1 ? nameParts.at(-2) : "",
      name: nameParts.at(-1),
      fields,
      foreignKeys: [],
      sourceText: originalSource
    };
  }

  const tableParts = annotationEntityIdentifierParts(createTable[1]);
  const openingParenthesis = createTable.index + createTable[0].lastIndexOf("(");
  const body = extractAnnotationSqlParenthesizedBody(sql, openingParenthesis);
  if (body === null) throw new Error("The CREATE TABLE column list is incomplete.");

  const fields = [];
  const primaryKeyNames = new Set();
  const foreignKeys = [];
  splitAnnotationSqlTopLevel(body).forEach(definition => {
    const constraint = annotationSqlTableConstraint(definition);
    if (constraint) {
      if (constraint.primaryKeyColumns) {
        constraint.primaryKeyColumns.forEach(name => primaryKeyNames.add(name.toLowerCase()));
      }
      if (constraint.foreignKey) foreignKeys.push(constraint.foreignKey);
      return;
    }

    const column = parseAnnotationSqlColumn(definition, qualifiedIdentifier);
    if (!column) return;
    if (column.isPrimaryKey) primaryKeyNames.add(column.field.name.toLowerCase());
    if (column.foreignKey) foreignKeys.push(column.foreignKey);
    fields.push(column.field);
  });

  annotationSqlAlterForeignKeys(sql, tableParts, identifier, qualifiedIdentifier).forEach(foreignKey => {
    const signature = annotationSqlForeignKeySignature(foreignKey);
    if (!foreignKeys.some(existing => annotationSqlForeignKeySignature(existing) === signature)) {
      foreignKeys.push(foreignKey);
    }
  });

  if (!fields.length) throw new Error("No fields were found in the CREATE TABLE script.");
  fields.forEach(field => {
    if (primaryKeyNames.has(field.name.toLowerCase())) {
      field.isPrimaryKey = true;
      field.nullable = false;
    }
  });
  foreignKeys.forEach(foreignKey => {
    foreignKey.columns.forEach(columnName => {
      const field = fields.find(item => item.name.toLowerCase() === columnName.toLowerCase());
      if (field) field.isForeignKey = true;
    });
  });

  return {
    schema: tableParts.length > 1 ? tableParts.at(-2) : "",
    name: tableParts.at(-1),
    fields,
    foreignKeys,
    sourceText: originalSource
  };
}

export function formatAnnotationEntityIdentifier(value, name = undefined) {
  const parts = name === undefined
    ? Array.isArray(value) ? value : annotationEntityIdentifierParts(value)
    : [value, name];
  return parts
    .map(part => String(part || "").trim())
    .filter(Boolean)
    .map(part => /\s/.test(part) ? `[${part.replaceAll("]", "]]")}]` : part)
    .join(".");
}

export function reorderAnnotationEntityFields(fieldsInput, draggedIndex, targetIndex, placement = "before") {
  const fields = Array.isArray(fieldsInput) ? fieldsInput.slice() : [];
  const sourceIndex = Number.parseInt(draggedIndex, 10);
  const destinationIndex = Number.parseInt(targetIndex, 10);
  if (!Number.isInteger(sourceIndex)
    || !Number.isInteger(destinationIndex)
    || sourceIndex < 0
    || sourceIndex >= fields.length
    || destinationIndex < 0
    || destinationIndex >= fields.length
    || sourceIndex === destinationIndex) {
    return fields;
  }

  const [field] = fields.splice(sourceIndex, 1);
  let insertionIndex = destinationIndex;
  if (sourceIndex < destinationIndex) insertionIndex -= 1;
  if (placement === "after") insertionIndex += 1;
  fields.splice(Math.max(0, Math.min(insertionIndex, fields.length)), 0, field);
  return fields;
}

export function orderAnnotationEntityForeignKeysAtTop(fieldsInput) {
  const fields = Array.isArray(fieldsInput) ? fieldsInput.slice() : [];
  return [
    ...fields.filter(field => field?.isPrimaryKey),
    ...fields.filter(field => !field?.isPrimaryKey && field?.isForeignKey),
    ...fields.filter(field => !field?.isPrimaryKey && !field?.isForeignKey)
  ];
}

export function annotationEntityVisibleFields(entity) {
  const source = Array.isArray(entity?.fields) ? entity.fields : [];
  const fields = entity?.foreignKeysAtTop === true
    ? orderAnnotationEntityForeignKeysAtTop(source)
    : source.slice();
  return entity?.collapsed === true
    ? fields.filter(field => field.isPrimaryKey || field.isForeignKey || field.isImportant)
    : fields;
}

export function setAnnotationEntityFieldForeignKeyMapping(
  foreignKeysInput,
  fieldNameInput,
  mappingInput = null
) {
  const fieldName = unquoteAnnotationSqlIdentifier(fieldNameInput);
  if (!fieldName) return deepCopy(Array.isArray(foreignKeysInput) ? foreignKeysInput : []);
  const foreignKeys = Array.isArray(foreignKeysInput)
    ? foreignKeysInput.map(normalizeAnnotationEntityForeignKey).filter(Boolean)
    : [];
  const remaining = [];
  let previousStyleOverride = null;

  foreignKeys.forEach(foreignKey => {
    const fieldIndex = foreignKey.columns.findIndex(column => column.toLowerCase() === fieldName.toLowerCase());
    if (fieldIndex < 0) {
      remaining.push(foreignKey);
      return;
    }
    previousStyleOverride ||= normalizeAnnotationEntityRelationshipStyleOverride(foreignKey.styleOverride);
    if (foreignKey.columns.length <= 1) return;
    remaining.push({
      ...foreignKey,
      columns: foreignKey.columns.filter((_, index) => index !== fieldIndex),
      referencedColumns: foreignKey.referencedColumns.length === foreignKey.columns.length
        ? foreignKey.referencedColumns.filter((_, index) => index !== fieldIndex)
        : foreignKey.referencedColumns
    });
  });

  const referencedParts = annotationEntityIdentifierParts(mappingInput?.referencedEntity || "");
  const referencedField = unquoteAnnotationSqlIdentifier(mappingInput?.referencedField);
  if (!referencedParts.length || !referencedField) return remaining;
  remaining.push({
    name: "",
    columns: [fieldName],
    referencedSchema: referencedParts.length > 1 ? referencedParts.at(-2) : "",
    referencedTable: referencedParts.at(-1),
    referencedColumns: [referencedField],
    relationshipType: safeAnnotationEntityRelationshipType(mappingInput?.relationshipType),
    ...(previousStyleOverride ? { styleOverride: previousStyleOverride } : {})
  });
  return remaining;
}

function annotationEntityFieldForeignKeyMapping(entity, fieldName) {
  const normalizedName = String(fieldName || "").toLowerCase();
  return (entity?.foreignKeys || []).map(normalizeAnnotationEntityForeignKey).filter(Boolean)
    .find(foreignKey => foreignKey.columns.some(column => column.toLowerCase() === normalizedName)) || null;
}

function safeAnnotationEntityRelationshipType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["one-to-one", "one-to-many"].includes(normalized) ? normalized : "";
}

function stripAnnotationSqlComments(source) {
  let output = "";
  let index = 0;
  let quote = "";
  while (index < source.length) {
    const current = source[index];
    const next = source[index + 1];
    if (quote) {
      output += current;
      if (current === quote) {
        if (source[index + 1] === quote) {
          output += source[index + 1];
          index += 2;
          continue;
        }
        quote = "";
      }
      index += 1;
      continue;
    }
    if (current === "'" || current === '"') {
      quote = current;
      output += current;
      index += 1;
      continue;
    }
    if (current === "-" && next === "-") {
      while (index < source.length && source[index] !== "\n") index += 1;
      output += "\n";
      index += 1;
      continue;
    }
    if (current === "/" && next === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) index += 1;
      index = Math.min(source.length, index + 2);
      output += " ";
      continue;
    }
    output += current;
    index += 1;
  }
  return output;
}

function annotationEntityIdentifierParts(value) {
  const source = String(value || "").trim();
  if (!source) return [];
  const parts = [];
  let current = "";
  let bracketed = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === "[") bracketed = true;
    if (character === "]") bracketed = false;
    if (character === "." && !bracketed) {
      if (current.trim()) parts.push(unquoteAnnotationSqlIdentifier(current));
      current = "";
      continue;
    }
    current += character;
  }
  if (current.trim()) parts.push(unquoteAnnotationSqlIdentifier(current));
  return parts.filter(Boolean);
}

function unquoteAnnotationSqlIdentifier(value) {
  const text = String(value || "").trim();
  return text.startsWith("[") && text.endsWith("]")
    ? text.slice(1, -1).replaceAll("]]", "]").trim()
    : text;
}

function extractAnnotationSqlParenthesizedBody(source, openingParenthesis) {
  let depth = 0;
  let quote = "";
  let bracketed = false;
  for (let index = openingParenthesis; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote) {
        if (source[index + 1] === quote) {
          index += 1;
        } else {
          quote = "";
        }
      }
      continue;
    }
    if (bracketed) {
      if (character === "]") bracketed = false;
      continue;
    }
    if (character === "[") {
      bracketed = true;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === "(") depth += 1;
    if (character === ")") {
      depth -= 1;
      if (depth === 0) return source.slice(openingParenthesis + 1, index);
    }
  }
  return null;
}

function splitAnnotationSqlTopLevel(source) {
  const values = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  let bracketed = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote) {
        if (source[index + 1] === quote) index += 1;
        else quote = "";
      }
      continue;
    }
    if (bracketed) {
      if (character === "]") bracketed = false;
      continue;
    }
    if (character === "[") {
      bracketed = true;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === "(") depth += 1;
    else if (character === ")") depth = Math.max(0, depth - 1);
    else if (character === "," && depth === 0) {
      values.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  values.push(source.slice(start).trim());
  return values.filter(Boolean);
}

function annotationSqlIdentifierList(source) {
  return splitAnnotationSqlTopLevel(source)
    .map(value => value.replace(/\s+(?:ASC|DESC)\s*$/i, "").trim())
    .map(unquoteAnnotationSqlIdentifier)
    .filter(Boolean);
}

function annotationSqlTableConstraint(definition) {
  const identifier = String.raw`(?:\[[^\]]+\]|[A-Za-z_@#][A-Za-z0-9_$#@]*)`;
  const qualifiedIdentifier = `${identifier}(?:\\s*\\.\\s*${identifier}){0,2}`;
  let source = String(definition || "").trim();
  let constraintName = "";
  const named = new RegExp(`^CONSTRAINT\\s+(${identifier})\\s+`, "i").exec(source);
  if (named) {
    constraintName = unquoteAnnotationSqlIdentifier(named[1]);
    source = source.slice(named[0].length).trim();
  }

  const primaryKey = /^PRIMARY\s+KEY\b[^()]*\(([^)]*)\)/i.exec(source);
  if (primaryKey) return { primaryKeyColumns: annotationSqlIdentifierList(primaryKey[1]) };

  const foreignKey = new RegExp(
    `^FOREIGN\\s+KEY\\s*\\(([^)]*)\\)\\s+REFERENCES\\s+(${qualifiedIdentifier})\\s*\\(([^)]*)\\)`,
    "i"
  ).exec(source);
  if (foreignKey) {
    const referencedParts = annotationEntityIdentifierParts(foreignKey[2]);
    return {
      foreignKey: {
        name: constraintName,
        columns: annotationSqlIdentifierList(foreignKey[1]),
        referencedSchema: referencedParts.length > 1 ? referencedParts.at(-2) : "",
        referencedTable: referencedParts.at(-1) || "",
        referencedColumns: annotationSqlIdentifierList(foreignKey[3]),
        relationshipType: "one-to-many"
      }
    };
  }

  return /^(?:PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK)\b/i.test(source) || Boolean(named)
    ? {}
    : null;
}

function annotationSqlAlterForeignKeys(sql, tableParts, identifier, qualifiedIdentifier) {
  const pattern = new RegExp(
    `\\bALTER\\s+TABLE\\s+(${qualifiedIdentifier})\\s+(?:WITH\\s+(?:CHECK|NOCHECK)\\s+)?ADD\\s+((?:CONSTRAINT\\s+${identifier}\\s+)?FOREIGN\\s+KEY\\s*\\([^)]*\\)\\s+REFERENCES\\s+${qualifiedIdentifier}\\s*\\([^)]*\\))`,
    "gi"
  );
  const foreignKeys = [];
  let match = pattern.exec(sql);
  while (match) {
    const alteredTableParts = annotationEntityIdentifierParts(match[1]);
    if (annotationSqlTableNamesMatch(tableParts, alteredTableParts)) {
      const constraint = annotationSqlTableConstraint(match[2]);
      if (constraint?.foreignKey) foreignKeys.push(constraint.foreignKey);
    }
    match = pattern.exec(sql);
  }
  return foreignKeys;
}

function annotationSqlTableNamesMatch(firstParts, secondParts) {
  const firstTable = String(firstParts?.at(-1) || "").toLowerCase();
  const secondTable = String(secondParts?.at(-1) || "").toLowerCase();
  if (!firstTable || firstTable !== secondTable) return false;
  const firstSchema = String(firstParts?.at(-2) || "").toLowerCase();
  const secondSchema = String(secondParts?.at(-2) || "").toLowerCase();
  return !firstSchema || !secondSchema || firstSchema === secondSchema;
}

function annotationSqlForeignKeySignature(foreignKey) {
  return [
    ...(foreignKey?.columns || []),
    foreignKey?.referencedSchema || "",
    foreignKey?.referencedTable || "",
    ...(foreignKey?.referencedColumns || [])
  ].map(value => String(value).toLowerCase()).join("|");
}

function parseAnnotationSqlColumn(definition, qualifiedIdentifier) {
  const identifier = String.raw`(?:\[[^\]]+\]|[A-Za-z_@#][A-Za-z0-9_$#@]*)`;
  const match = new RegExp(`^(${identifier})(?:\\s+)([\\s\\S]+)$`).exec(String(definition || "").trim());
  if (!match) return null;
  const name = unquoteAnnotationSqlIdentifier(match[1]);
  const remainder = match[2].trim();
  const constraintStart = /\s+(?=(?:COLLATE|CONSTRAINT|IDENTITY|NOT\s+NULL|NULL|PRIMARY\s+KEY|UNIQUE|REFERENCES|CHECK|DEFAULT|ROWGUIDCOL|SPARSE|MASKED|ENCRYPTED|GENERATED)\b)/i.exec(remainder);
  const dataType = normalizeAnnotationSqlDataType(
    (constraintStart ? remainder.slice(0, constraintStart.index) : remainder).trim(),
    qualifiedIdentifier
  );
  if (!dataType) return null;
  const explicitlyNotNull = /\bNOT\s+NULL\b/i.test(remainder);
  const explicitlyNull = !explicitlyNotNull && /\bNULL\b/i.test(remainder);
  const isPrimaryKey = /\bPRIMARY\s+KEY\b/i.test(remainder);
  const identity = /\bIDENTITY\s*(?:\([^)]*\))?/i.exec(remainder)?.[0] || "";
  const references = new RegExp(
    `\\bREFERENCES\\s+(${qualifiedIdentifier})\\s*\\(([^)]*)\\)`,
    "i"
  ).exec(remainder);
  let foreignKey = null;
  if (references) {
    const referencedParts = annotationEntityIdentifierParts(references[1]);
    foreignKey = {
      name: "",
      columns: [name],
      referencedSchema: referencedParts.length > 1 ? referencedParts.at(-2) : "",
      referencedTable: referencedParts.at(-1) || "",
      referencedColumns: annotationSqlIdentifierList(references[2]),
      relationshipType: "one-to-many"
    };
  }
  return {
    field: {
      name,
      dataType,
      nullable: isPrimaryKey || explicitlyNotNull ? false : explicitlyNull ? true : true,
      isPrimaryKey,
      isForeignKey: Boolean(foreignKey),
      isImportant: false,
      isIdentity: Boolean(identity),
      identity
    },
    isPrimaryKey,
    foreignKey
  };
}

function normalizeAnnotationSqlDataType(value, qualifiedIdentifier) {
  const source = String(value || "").trim();
  const match = new RegExp(`^(${qualifiedIdentifier})([\\s\\S]*)$`, "i").exec(source);
  if (!match) return source;
  return `${formatAnnotationEntityIdentifier(match[1])}${match[2]}`;
}

function openAnnotationEntityDialog(entity = null) {
  return new Promise(resolve => {
    const currentName = entity
      ? formatAnnotationEntityIdentifier(entity.entitySchema, entity.entityName)
      : "";
    const currentSource = String(entity?.sourceText || "");
    const dialog = document.createElement("dialog");
    dialog.className = "dialog image-annotation-entity-dialog";
    dialog.setAttribute("aria-labelledby", "annotationEntityDialogTitle");
    dialog.innerHTML = `
      <form data-annotation-entity-form>
        <div class="dialog-head">
          <div>
            <h2 id="annotationEntityDialogTitle">${entity?.entityName ? "Edit Entity" : "Add Entity"}</h2>
            <p>Paste a SQL Server CREATE TABLE script or enter field names separated by commas or new lines.</p>
          </div>
          <button type="button" class="icon-btn" data-annotation-entity-cancel title="Close" aria-label="Close">Close</button>
        </div>
        <div class="image-annotation-entity-dialog-body">
          <label class="field">
            <span>Entity Name</span>
            <input type="text" value="${escapeXmlAttr(currentName)}" placeholder="schema.EntityName" autocomplete="off" data-annotation-entity-name>
          </label>
          <label class="field">
            <span>Fields or CREATE TABLE script</span>
            <textarea rows="18" spellcheck="false" wrap="off" placeholder="CREATE TABLE [pmt].[Projects] (...)" data-annotation-entity-source>${escapeXmlText(currentSource)}</textarea>
          </label>
          <label class="inline-check"><input type="checkbox" data-annotation-entity-fk-at-top${entity?.foreignKeysAtTop === true ? " checked" : ""}><span>FK at the Top</span></label>
          <p class="image-annotation-entity-hint">A table name in the SQL script replaces the Entity Name above. Foreign keys are retained for future relationship lines.</p>
          <p class="image-annotation-entity-status" role="status" aria-live="polite" data-annotation-entity-status></p>
        </div>
        <div class="dialog-actions">
          <button type="button" class="secondary text-icon-button" data-annotation-entity-cancel><span class="button-icon" aria-hidden="true">&#10005;</span><span>Cancel</span></button>
          <button type="submit" class="primary text-icon-button" data-annotation-entity-apply><span class="button-icon" aria-hidden="true">&#10003;</span><span>${entity?.entityName ? "Update Entity" : "Add Entity"}</span></button>
        </div>
      </form>
    `;
    document.body.appendChild(dialog);
    const form = dialog.querySelector("[data-annotation-entity-form]");
    const nameInput = dialog.querySelector("[data-annotation-entity-name]");
    const sourceInput = dialog.querySelector("[data-annotation-entity-source]");
    const foreignKeysAtTopInput = dialog.querySelector("[data-annotation-entity-fk-at-top]");
    const status = dialog.querySelector("[data-annotation-entity-status]");
    let finished = false;

    const finish = value => {
      if (finished) return;
      finished = true;
      if (dialog.open) dialog.close();
      dialog.remove();
      resolve(value);
    };

    dialog.querySelectorAll("[data-annotation-entity-cancel]").forEach(button => {
      button.addEventListener("click", () => finish(null));
    });
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      finish(null);
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      try {
        const definition = parseAnnotationEntityDefinition(sourceInput.value, nameInput.value);
        finish({ ...definition, foreignKeysAtTop: foreignKeysAtTopInput.checked });
      } catch (error) {
        status.textContent = error?.message || "The Entity could not be parsed.";
        (nameInput.value.trim() ? sourceInput : nameInput).focus();
      }
    });

    dialog.showModal();
    (currentName ? sourceInput : nameInput).focus();
  });
}

function openAnnotationInformationDialog(message, title = "Diagram Information") {
  return new Promise(resolve => {
    const dialog = document.createElement("dialog");
    dialog.className = "dialog detail-dialog image-annotation-information-dialog";
    dialog.setAttribute("aria-labelledby", "annotationInformationDialogTitle");
    dialog.innerHTML = `
      <div class="dialog-head">
        <div>
          <h2 id="annotationInformationDialogTitle">${escapeXmlText(title)}</h2>
        </div>
      </div>
      <div class="dialog-body">
        <p>${escapeXmlText(message)}</p>
      </div>
      <div class="dialog-actions">
        <button type="button" class="primary text-icon-button" data-annotation-information-ok><span class="button-icon" aria-hidden="true">&#10003;</span><span>OK</span></button>
      </div>
    `;
    document.body.appendChild(dialog);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (dialog.open) dialog.close();
      dialog.remove();
      resolve();
    };
    dialog.querySelector("[data-annotation-information-ok]").addEventListener("click", finish);
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      finish();
    });
    dialog.showModal();
    dialog.querySelector("[data-annotation-information-ok]").focus();
  });
}

function openAnnotationCropOptionsDialog() {
  return new Promise(resolve => {
    const dialog = document.createElement("dialog");
    dialog.className = "dialog mini-dialog image-annotation-crop-options-dialog";
    dialog.setAttribute("aria-labelledby", "annotationCropOptionsTitle");
    dialog.innerHTML = `
      <div class="dialog-head">
        <h2 id="annotationCropOptionsTitle">Crop Options</h2>
      </div>
      <div class="dialog-body">
        <p>This image already has a crop. You can remove the crop or permanently replace the source with only the cropped area.</p>
        <p class="image-annotation-crop-warning">Applying the crop permanently cannot be undone.</p>
      </div>
      <div class="dialog-actions">
        <button type="button" class="secondary text-icon-button" data-annotation-crop-choice=""><span class="button-icon" aria-hidden="true">&#10005;</span><span>Cancel</span></button>
        <button type="button" class="secondary text-icon-button" data-annotation-crop-choice="remove"><span class="button-icon" aria-hidden="true">&#8634;</span><span>Remove Crop</span></button>
        <button type="button" class="danger text-icon-button" data-annotation-crop-choice="permanent"><span class="button-icon" aria-hidden="true">&#9888;</span><span>Apply Crop Permanently</span></button>
      </div>
    `;
    document.body.appendChild(dialog);
    let finished = false;
    const finish = value => {
      if (finished) return;
      finished = true;
      if (dialog.open) dialog.close();
      dialog.remove();
      resolve(value);
    };
    dialog.querySelectorAll("[data-annotation-crop-choice]").forEach(button => {
      button.addEventListener("click", () => finish(button.dataset.annotationCropChoice || ""));
    });
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      finish("");
    });
    dialog.showModal();
    dialog.querySelector("[data-annotation-crop-choice='']")?.focus();
  });
}

function openAnnotationPermanentCropWarningDialog() {
  return new Promise(resolve => {
    const dialog = document.createElement("dialog");
    dialog.className = "dialog mini-dialog image-annotation-crop-options-dialog";
    dialog.setAttribute("aria-labelledby", "annotationPermanentCropTitle");
    dialog.innerHTML = `
      <div class="dialog-head">
        <h2 id="annotationPermanentCropTitle">Apply Crop Permanently?</h2>
      </div>
      <div class="dialog-body">
        <p>The source stored with this annotation will be replaced by only the cropped pixels.</p>
        <p class="image-annotation-crop-warning"><strong>This action is irreversible.</strong> The removed area cannot be restored inside the annotation.</p>
      </div>
      <div class="dialog-actions">
        <button type="button" class="secondary text-icon-button" data-annotation-permanent-crop="false"><span class="button-icon" aria-hidden="true">&#10005;</span><span>Cancel</span></button>
        <button type="button" class="danger text-icon-button" data-annotation-permanent-crop="true"><span class="button-icon" aria-hidden="true">&#9888;</span><span>Apply Permanently</span></button>
      </div>
    `;
    document.body.appendChild(dialog);
    let finished = false;
    const finish = value => {
      if (finished) return;
      finished = true;
      if (dialog.open) dialog.close();
      dialog.remove();
      resolve(value);
    };
    dialog.querySelector("[data-annotation-permanent-crop='false']").addEventListener("click", () => finish(false));
    dialog.querySelector("[data-annotation-permanent-crop='true']").addEventListener("click", () => finish(true));
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      finish(false);
    });
    dialog.showModal();
    dialog.querySelector("[data-annotation-permanent-crop='false']")?.focus();
  });
}

function openAnnotationEntityForeignKeyDialog(entity, field) {
  return new Promise(resolve => {
    const mapping = annotationEntityFieldForeignKeyMapping(entity, field?.name);
    const sourceIndex = mapping?.columns.findIndex(column => column.toLowerCase() === String(field?.name || "").toLowerCase()) ?? -1;
    const currentEntity = mapping
      ? formatAnnotationEntityIdentifier(mapping.referencedSchema, mapping.referencedTable)
      : "";
    const currentField = sourceIndex >= 0
      ? mapping?.referencedColumns[sourceIndex] || mapping?.referencedColumns[0] || ""
      : "";
    const currentRelationshipType = safeAnnotationEntityRelationshipType(mapping?.relationshipType);
    const sourceLabel = `${formatAnnotationEntityIdentifier(entity?.entitySchema, entity?.entityName)}.${formatAnnotationEntityIdentifier(field?.name)}`;
    const dialog = document.createElement("dialog");
    dialog.className = "dialog image-annotation-foreign-key-dialog";
    dialog.setAttribute("aria-labelledby", "annotationForeignKeyDialogTitle");
    dialog.innerHTML = `
      <form data-annotation-foreign-key-form>
        <div class="dialog-head">
          <div>
            <h2 id="annotationForeignKeyDialogTitle">Map Foreign Key</h2>
            <p>${escapeXmlText(sourceLabel)}</p>
          </div>
          <button type="button" class="icon-btn" data-annotation-foreign-key-cancel title="Close" aria-label="Close">Close</button>
        </div>
        <div class="image-annotation-foreign-key-dialog-body">
          <label class="field">
            <span>Referenced Entity</span>
            <input type="text" value="${escapeXmlAttr(currentEntity)}" placeholder="pmt.Blogs" autocomplete="off" data-annotation-foreign-key-entity>
          </label>
          <label class="field">
            <span>Referenced Field</span>
            <input type="text" value="${escapeXmlAttr(currentField)}" placeholder="BlogId" autocomplete="off" data-annotation-foreign-key-field>
          </label>
          <label class="field">
            <span>Relationship</span>
            <select data-annotation-foreign-key-relationship>
              <option value=""${currentRelationshipType ? "" : " selected"}>Simple arrow</option>
              <option value="one-to-one"${currentRelationshipType === "one-to-one" ? " selected" : ""}>One-to-one</option>
              <option value="one-to-many"${currentRelationshipType === "one-to-many" ? " selected" : ""}>One-to-many</option>
            </select>
          </label>
          <p class="image-annotation-entity-hint">The dependent Entity points to this parent/source. Clear both target values to remove the mapping.</p>
          <p class="image-annotation-entity-status" role="status" aria-live="polite" data-annotation-foreign-key-status></p>
        </div>
        <div class="dialog-actions">
          <button type="button" class="secondary text-icon-button" data-annotation-foreign-key-cancel><span class="button-icon" aria-hidden="true">&#10005;</span><span>Cancel</span></button>
          <button type="submit" class="primary text-icon-button"><span class="button-icon" aria-hidden="true">&#10003;</span><span>Save Mapping</span></button>
        </div>
      </form>
    `;
    document.body.appendChild(dialog);
    const form = dialog.querySelector("[data-annotation-foreign-key-form]");
    const entityInput = dialog.querySelector("[data-annotation-foreign-key-entity]");
    const fieldInput = dialog.querySelector("[data-annotation-foreign-key-field]");
    const relationshipInput = dialog.querySelector("[data-annotation-foreign-key-relationship]");
    const status = dialog.querySelector("[data-annotation-foreign-key-status]");
    let finished = false;
    const finish = value => {
      if (finished) return;
      finished = true;
      if (dialog.open) dialog.close();
      dialog.remove();
      resolve(value);
    };

    dialog.querySelectorAll("[data-annotation-foreign-key-cancel]").forEach(button => {
      button.addEventListener("click", () => finish(null));
    });
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      finish(null);
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      const referencedEntity = entityInput.value.trim();
      const referencedField = fieldInput.value.trim();
      if (Boolean(referencedEntity) !== Boolean(referencedField)) {
        status.textContent = "Enter both a referenced Entity and field, or clear both to remove the mapping.";
        (referencedEntity ? fieldInput : entityInput).focus();
        return;
      }
      if (referencedEntity && !annotationEntityIdentifierParts(referencedEntity).length) {
        status.textContent = "Enter a valid referenced Entity name.";
        entityInput.focus();
        return;
      }
      finish({
        referencedEntity,
        referencedField,
        relationshipType: safeAnnotationEntityRelationshipType(relationshipInput.value)
      });
    });

    dialog.showModal();
    entityInput.focus();
    entityInput.select();
  });
}

export function applyAnnotationEntityDefinition(object, definition) {
  const nextSourceText = String(definition?.sourceText || "");
  const sourceMatches = annotationEntitySourceMatches(object.sourceText, nextSourceText);
  const fields = sourceMatches
    ? annotationEntityFieldsInExistingOrder(definition?.fields, object.fields)
    : annotationEntityFieldsWithExistingDesignations(definition?.fields, object.fields);
  object.entitySchema = String(definition?.schema || "").trim();
  object.entityName = String(definition?.name || "Entity").trim() || "Entity";
  object.fields = fields;
  object.foreignKeys = sourceMatches
    ? deepCopy(object.foreignKeys || [])
    : annotationEntityForeignKeysWithExistingMappings(
        definition?.foreignKeys,
        object.foreignKeys,
        fields
      );
  object.foreignKeysAtTop = definition?.foreignKeysAtTop === true;
  object.sourceText = nextSourceText;
  object.name = formatAnnotationEntityIdentifier(object.entitySchema, object.entityName);
}

function annotationEntitySourceMatches(first, second) {
  const normalize = value => String(value || "").replace(/\r\n?/g, "\n").trim();
  return normalize(first) === normalize(second);
}

function annotationEntityFieldsInExistingOrder(fieldsInput, existingFieldsInput) {
  const fields = deepCopy(Array.isArray(fieldsInput) ? fieldsInput : []);
  const existingFields = Array.isArray(existingFieldsInput) ? existingFieldsInput : [];
  if (!fields.length || !existingFields.length) return fields;
  const fieldsByName = new Map(fields.map(field => [field.name.toLowerCase(), field]));
  const ordered = existingFields
    .map(existingField => {
      const field = fieldsByName.get(String(existingField.name || "").toLowerCase());
      if (!field) return null;
      field.isPrimaryKey = existingField.isPrimaryKey === true;
      field.isForeignKey = existingField.isForeignKey === true;
      field.isImportant = existingField.isImportant === true;
      return field;
    })
    .filter(Boolean);
  const used = new Set(ordered);
  fields.forEach(field => {
    if (!used.has(field)) ordered.push(field);
  });
  return ordered;
}

function annotationEntityFieldsWithExistingDesignations(fieldsInput, existingFieldsInput) {
  const fields = deepCopy(Array.isArray(fieldsInput) ? fieldsInput : []);
  const existingByName = new Map((Array.isArray(existingFieldsInput) ? existingFieldsInput : [])
    .map(field => [String(field.name || "").toLowerCase(), field]));
  fields.forEach(field => {
    const existing = existingByName.get(String(field.name || "").toLowerCase());
    if (!existing) return;
    field.isPrimaryKey = existing.isPrimaryKey === true;
    field.isForeignKey = existing.isForeignKey === true;
    field.isImportant = existing.isImportant === true;
  });
  return fields;
}

function annotationEntityForeignKeysWithExistingMappings(parsedInput, existingInput, fieldsInput) {
  const validFields = new Set((Array.isArray(fieldsInput) ? fieldsInput : [])
    .map(field => String(field?.name || "").toLowerCase())
    .filter(Boolean));
  const trimToExistingFields = foreignKey => {
    const normalized = normalizeAnnotationEntityForeignKey(foreignKey);
    if (!normalized) return null;
    const indexes = normalized.columns
      .map((column, index) => validFields.has(column.toLowerCase()) ? index : -1)
      .filter(index => index >= 0);
    if (!indexes.length) return null;
    return {
      ...normalized,
      columns: indexes.map(index => normalized.columns[index]),
      referencedColumns: normalized.referencedColumns.length === normalized.columns.length
        ? indexes.map(index => normalized.referencedColumns[index])
        : normalized.referencedColumns
    };
  };

  const existing = (Array.isArray(existingInput) ? existingInput : [])
    .map(trimToExistingFields)
    .filter(Boolean);
  const existingColumns = new Set(existing
    .flatMap(foreignKey => foreignKey.columns)
    .map(column => column.toLowerCase()));
  const parsed = (Array.isArray(parsedInput) ? parsedInput : [])
    .map(normalizeAnnotationEntityForeignKey)
    .filter(Boolean)
    .map(foreignKey => {
      const indexes = foreignKey.columns
        .map((column, index) => !existingColumns.has(column.toLowerCase()) ? index : -1)
        .filter(index => index >= 0);
      if (!indexes.length) return null;
      return {
        ...foreignKey,
        columns: indexes.map(index => foreignKey.columns[index]),
        referencedColumns: foreignKey.referencedColumns.length === foreignKey.columns.length
          ? indexes.map(index => foreignKey.referencedColumns[index])
          : foreignKey.referencedColumns
      };
    })
    .filter(Boolean);
  return [...existing, ...parsed];
}

function annotationEntityMetrics(object) {
  const fontSize = clampNumber(positiveNumber(object?.fontSize, defaultEntityFontSize), 6, 240);
  return {
    fontSize,
    padding: Math.max(7, fontSize * 0.5),
    headerHeight: Math.max(28, fontSize * 1.85),
    rowHeight: Math.max(23, fontSize * 1.45),
    keyColumnWidth: Math.max(42, fontSize * 2.8),
    dataTypeColumnWidth: Math.max(155, fontSize * 9.5),
    notColumnWidth: Math.max(42, fontSize * 2.8),
    nullColumnWidth: Math.max(48, fontSize * 3.2)
  };
}

function ensureAnnotationEntitySize(object) {
  const compactWidth = annotationEntityCompactMinimumWidth(object);
  const detailWidth = annotationEntityDataTypeColumnsWidth(object);
  const expandedMinimumWidth = Math.max(defaultEntityWidth, compactWidth + detailWidth);
  object.width = Math.max(
    object.showDataTypes === true ? expandedMinimumWidth : compactWidth,
    positiveNumber(object.width, defaultEntityWidth)
  );
  if (object.showDataTypes === true) object.dataTypeExpandedWidth = object.width;
  else if (!positiveNumber(object.dataTypeExpandedWidth, 0)) {
    object.dataTypeExpandedWidth = object.width >= expandedMinimumWidth
      ? object.width
      : object.width + detailWidth;
  }
  const expandedHeight = annotationEntityNaturalHeight(object, object.fields);
  if (object.collapsed === true) {
    object.expandedHeight = Math.max(
      expandedHeight,
      positiveNumber(object.expandedHeight, Math.max(expandedHeight, positiveNumber(object.height, 1)))
    );
    object.height = annotationEntityNaturalHeight(object, annotationEntityVisibleFields(object));
    return;
  }
  object.height = Math.max(expandedHeight, positiveNumber(object.height, 1));
  object.expandedHeight = object.height;
}

function annotationEntityDataTypeColumnsWidth(object) {
  const metrics = annotationEntityMetrics(object);
  return metrics.dataTypeColumnWidth + metrics.notColumnWidth + metrics.nullColumnWidth;
}

function annotationEntityCompactMinimumWidth(object) {
  const metrics = annotationEntityMetrics(object);
  const fields = annotationEntityVisibleFields(object);
  const longestFieldName = fields.reduce(
    (longest, field) => Math.max(longest, formatAnnotationEntityIdentifier(field?.name).length),
    0
  );
  const fieldWidth = Math.max(180, (longestFieldName * metrics.fontSize * 0.62) + (metrics.padding * 2));
  const keyWidth = object?.showKeyColumn === false ? 0 : metrics.keyColumnWidth;
  const entityName = formatAnnotationEntityIdentifier(object?.entitySchema, object?.entityName) || "Entity";
  const titleWidth = (entityName.length * metrics.fontSize * 1.05 * 0.62) + (metrics.headerHeight * 2.4);
  return Math.ceil(Math.max(240, keyWidth + fieldWidth, titleWidth));
}

export function setAnnotationEntityDataTypeVisibility(object, visible) {
  if (!object || object.type !== "entity") return object;
  const nextVisible = visible === true;
  if (nextVisible === (object.showDataTypes === true)) return object;
  const right = object.x + object.width;
  const detailWidth = annotationEntityDataTypeColumnsWidth(object);
  const compactWidth = annotationEntityCompactMinimumWidth(object);
  const expandedMinimumWidth = Math.max(defaultEntityWidth, compactWidth + detailWidth);
  if (nextVisible) {
    const storedExpandedWidth = positiveNumber(object.dataTypeExpandedWidth, 0);
    object.width = Math.max(
      expandedMinimumWidth,
      storedExpandedWidth > object.width ? storedExpandedWidth : object.width >= expandedMinimumWidth
        ? object.width
        : object.width + detailWidth
    );
    object.dataTypeExpandedWidth = object.width;
  } else {
    object.dataTypeExpandedWidth = Math.max(expandedMinimumWidth, object.width);
    object.width = Math.max(compactWidth, object.width - detailWidth);
  }
  object.showDataTypes = nextVisible;
  object.x = right - object.width;
  return object;
}

export function setAnnotationEntitiesUnanchored(inputState, unanchored) {
  const entities = Array.isArray(inputState?.objects)
    ? inputState.objects.filter(object => object?.type === "entity")
    : [];
  const anchorTable = unanchored !== true;
  let changedCount = 0;
  entities.forEach(entity => {
    if (entity.anchorTable === anchorTable) return;
    entity.anchorTable = anchorTable;
    changedCount += 1;
  });
  return {
    entityCount: entities.length,
    changedCount,
    anchorTable
  };
}

export function annotationEntityGlobalUnanchorControlState(inputState) {
  const entities = Array.isArray(inputState?.objects)
    ? inputState.objects.filter(object => object?.type === "entity")
    : [];
  const anchoredEntityCount = entities.filter(entity => entity.anchorTable === true).length;
  return {
    entityCount: entities.length,
    anchoredEntityCount,
    checked: entities.length > 0 && anchoredEntityCount === 0,
    indeterminate: anchoredEntityCount > 0 && anchoredEntityCount < entities.length,
    disabled: entities.length === 0
  };
}

export function annotationEntityAnchorShortcutWarningAllowed(inputState) {
  return !annotationEntityGlobalUnanchorControlState(inputState).checked;
}

export function resolveAnnotationEntityOverlaps(inputState, options = {}) {
  return resolveAnnotationEntitySizeChangeLayout(inputState, null, {
    ...options,
    separateRoutes: false
  });
}

export function resolveAnnotationEntitySizeChangeLayout(inputState, resizedEntityOrId, options = {}) {
  const state = inputState && typeof inputState === "object" ? inputState : {};
  const entities = annotationVisibleObjects(state).filter(object => object.type === "entity");
  const resolveAll = resizedEntityOrId == null;
  const resizedEntity = resolveAll
    ? null
    : typeof resizedEntityOrId === "object"
      ? resizedEntityOrId
      : entities.find(entity => entity.id === resizedEntityOrId);
  if (!entities.length || (!resolveAll && (!resizedEntity || !entities.includes(resizedEntity)))) {
    return { movedCount: 0, unresolvedOverlapCount: 0, unresolvedRouteContactCount: 0 };
  }

  const clearance = Math.max(48, positiveNumber(options?.clearance, state.gridSize || defaultGridSize));
  const queuedIds = resolveAll ? entities.map(entity => entity.id) : [resizedEntity.id];
  const movedIds = new Set();
  let unresolvedOverlapCount = 0;
  let passCount = 0;
  const maximumPasses = Math.max(8, entities.length * 3);

  while (queuedIds.length && passCount < maximumPasses) {
    passCount += 1;
    const currentId = queuedIds.shift();
    const current = entities.find(entity => entity.id === currentId);
    if (!current) continue;
    entities.filter(entity => entity !== current).forEach(other => {
      const currentBounds = annotationObjectBounds(current);
      const otherBounds = annotationObjectBounds(other);
      const overlapX = Math.min(
        currentBounds.x + currentBounds.width,
        otherBounds.x + otherBounds.width
      ) - Math.max(currentBounds.x, otherBounds.x);
      const overlapY = Math.min(
        currentBounds.y + currentBounds.height,
        otherBounds.y + otherBounds.height
      ) - Math.max(currentBounds.y, otherBounds.y);
      if (overlapX <= 0 || overlapY <= 0) return;

      const currentMovable = current.anchorTable !== true && current.locked !== true;
      const otherMovable = other.anchorTable !== true && other.locked !== true;
      const moveEntity = resolveAll
        ? otherMovable
          ? other
          : currentMovable
            ? current
            : null
        : other !== resizedEntity && otherMovable
          ? other
          : current !== resizedEntity && currentMovable
            ? current
            : otherMovable
              ? other
              : currentMovable
                ? current
                : null;
      if (!moveEntity) {
        unresolvedOverlapCount += 1;
        return;
      }
      const fixedEntity = moveEntity === current ? other : current;
      const moveCenter = moveEntity.x + (moveEntity.width / 2);
      const fixedCenter = fixedEntity.x + (fixedEntity.width / 2);
      const direction = moveCenter < fixedCenter ? -1 : 1;
      const deltaX = direction * (overlapX + clearance);
      translateAnnotationObjectsWithEntityCallouts(state, [moveEntity], deltaX, 0);
      movedIds.add(moveEntity.id);
      queuedIds.push(moveEntity.id);
    });
  }

  let routeResult = { unresolvedContactCount: 0 };
  if (options?.separateRoutes !== false) {
    const positionsBeforeRouting = new Map(entities.map(entity => [
      entity.id,
      { x: entity.x, y: entity.y }
    ]));
    const relationships = resolveAnnotationEntityRelationships(entities);
    routeResult = separateAnnotationEntitiesFromRelationshipRoutes(entities, relationships, {
      allowOverlappingLines: state.allowOverlappingEntityLines,
      gridSize: state.gridSize,
      relationshipStyle: state.relationshipStyle
    });
    entities.forEach(entity => {
      const previous = positionsBeforeRouting.get(entity.id);
      const deltaX = entity.x - previous.x;
      const deltaY = entity.y - previous.y;
      if (!deltaX && !deltaY) return;
      translateAllAnnotationObjects(annotationEntityAnnotationChildren(state, entity), deltaX, deltaY);
      movedIds.add(entity.id);
    });
  }
  syncAnnotationEntityAnnotationArrows(state);
  return {
    movedCount: movedIds.size,
    unresolvedOverlapCount,
    unresolvedRouteContactCount: routeResult.unresolvedContactCount
  };
}

function annotationEntityNaturalHeight(object, fieldsInput) {
  const metrics = annotationEntityMetrics(object);
  const rowCount = Array.isArray(fieldsInput) ? fieldsInput.length : 0;
  return metrics.headerHeight + (rowCount * metrics.rowHeight);
}

export function setAnnotationEntityCollapsedState(object, collapsed) {
  if (!object || object.type !== "entity") return object;
  const nextCollapsed = collapsed === true;
  if (nextCollapsed === (object.collapsed === true)) return object;
  const expandedHeight = annotationEntityNaturalHeight(object, object.fields);
  if (nextCollapsed) {
    object.expandedHeight = Math.max(expandedHeight, positiveNumber(object.height, expandedHeight));
    object.collapsed = true;
    object.height = annotationEntityNaturalHeight(object, annotationEntityVisibleFields(object));
    return object;
  }
  object.collapsed = false;
  object.height = Math.max(expandedHeight, positiveNumber(object.expandedHeight, expandedHeight));
  object.expandedHeight = object.height;
  return object;
}

function annotationEntityAnnotationOwnerId(object) {
  return String(object?.entityAnnotationOwnerId || "").trim();
}

function annotationEntityAnnotationChildren(state, entityOrId) {
  const entityId = typeof entityOrId === "object"
    ? String(entityOrId?.id || "")
    : String(entityOrId || "");
  return (state?.objects || []).filter(object => annotationEntityAnnotationOwnerId(object) === entityId);
}

function annotationEntityAnnotationConnection(entity, callout) {
  const entityCenter = {
    x: entity.x + (entity.width / 2),
    y: entity.y + (entity.height / 2)
  };
  const calloutCenter = {
    x: callout.x + (callout.width / 2),
    y: callout.y + (callout.height / 2)
  };
  const horizontal = Math.abs(entityCenter.x - calloutCenter.x)
    >= Math.abs(entityCenter.y - calloutCenter.y);
  if (horizontal) {
    const calloutOnRight = calloutCenter.x >= entityCenter.x;
    const y = clampNumber(calloutCenter.y, entity.y, entity.y + entity.height);
    return {
      start: {
        x: calloutOnRight ? callout.x : callout.x + callout.width,
        y: clampNumber(entityCenter.y, callout.y, callout.y + callout.height)
      },
      end: { x: calloutOnRight ? entity.x + entity.width : entity.x, y }
    };
  }
  const calloutBelow = calloutCenter.y >= entityCenter.y;
  const x = clampNumber(calloutCenter.x, entity.x, entity.x + entity.width);
  return {
    start: {
      x: clampNumber(entityCenter.x, callout.x, callout.x + callout.width),
      y: calloutBelow ? callout.y : callout.y + callout.height
    },
    end: { x, y: calloutBelow ? entity.y + entity.height : entity.y }
  };
}

export function syncAnnotationEntityAnnotationArrows(inputState) {
  const state = inputState && typeof inputState === "object" ? inputState : {};
  const objects = Array.isArray(state.objects) ? state.objects : [];
  objects.filter(object => object?.type === "entity").forEach(entity => {
    const children = annotationEntityAnnotationChildren(state, entity);
    const callout = children.find(object => object.type === "textbox"
      && object.entityAnnotationRole === "callout");
    const arrow = children.find(object => object.type === "arrow"
      && object.entityAnnotationRole === "arrow");
    if (!callout || !arrow) return;
    const groupId = safeGroupId(entity.entityAnnotationGroupId)
      || safeGroupId(callout.groupId)
      || safeGroupId(arrow.groupId);
    if (groupId) {
      entity.entityAnnotationGroupId = groupId;
      entity.groupId = groupId;
      entity.groupHitTransparent = true;
      children.forEach(child => {
        child.groupId = groupId;
        child.groupHitTransparent = true;
      });
    }
    const connection = annotationEntityAnnotationConnection(entity, callout);
    Object.assign(arrow, fitAnnotationArrowToHead({
      ...arrow,
      x1: connection.start.x,
      y1: connection.start.y,
      x2: connection.end.x,
      y2: connection.end.y
    }));
  });
  return state;
}

export function setAnnotationEntityAnnotation(inputState, entityOrId, value) {
  const state = inputState && typeof inputState === "object" ? inputState : {};
  state.objects ||= [];
  const entity = typeof entityOrId === "object"
    ? entityOrId
    : state.objects.find(object => object.id === entityOrId && object.type === "entity");
  if (!entity || entity.type !== "entity") return { createdCount: 0, removedCount: 0 };

  const text = String(value || "").slice(0, 10000);
  const children = annotationEntityAnnotationChildren(state, entity);
  if (!text.trim()) {
    const removedIds = new Set(children.map(object => object.id));
    state.objects = state.objects.filter(object => !removedIds.has(object.id));
    if (entity.entityAnnotationGroupId) {
      delete state.groupNames?.[entity.entityAnnotationGroupId];
      delete state.groupVisibility?.[entity.entityAnnotationGroupId];
    }
    entity.entityAnnotation = "";
    entity.entityAnnotationGroupId = "";
    entity.groupId = "";
    delete entity.groupHitTransparent;
    return { createdCount: 0, removedCount: removedIds.size, removedIds };
  }

  const entityLabel = formatAnnotationEntityIdentifier(entity.entitySchema, entity.entityName) || "Entity";
  const groupId = safeGroupId(entity.entityAnnotationGroupId)
    || safeGroupId(children[0]?.groupId)
    || annotationObjectId("group");
  entity.entityAnnotation = text;
  entity.entityAnnotationGroupId = groupId;
  entity.groupId = groupId;
  entity.groupHitTransparent = true;
  state.groupNames ||= {};
  state.groupVisibility ||= {};
  state.groupNames[groupId] = `${entityLabel} Annotation`;
  if (!Object.hasOwn(state.groupVisibility, groupId)) state.groupVisibility[groupId] = true;

  let createdCount = 0;
  let callout = children.find(object => object.type === "textbox"
    && object.entityAnnotationRole === "callout");
  if (!callout) {
    callout = normalizeAnnotationObject({
      id: annotationObjectId("textbox"),
      type: "textbox",
      name: `${entityLabel} Annotation`,
      x: entity.x + entity.width + 96,
      y: entity.y,
      width: 360,
      height: Math.max(110, (text.split(/\r?\n/).length * defaultEntityFontSize * 1.4) + 24),
      fill: "#eef4ff",
      stroke: entity.stroke || defaultEntityStroke,
      outlineVisible: true,
      strokeWidth: 2,
      opacity: 1,
      text,
      textColor: entity.textColor || defaultEntityTextColor,
      fontFamily: entity.fontFamily || defaultStyles.fontFamily,
      fontSize: defaultEntityFontSize,
      textAlign: "left",
      textVerticalAlign: "top",
      groupId,
      groupHitTransparent: true,
      entityAnnotationOwnerId: entity.id,
      entityAnnotationRole: "callout"
    });
    state.objects.push(callout);
    createdCount += 1;
  } else {
    callout.text = text;
    callout.groupId = groupId;
    callout.groupHitTransparent = true;
    callout.entityAnnotationOwnerId = entity.id;
    callout.entityAnnotationRole = "callout";
  }

  let arrow = children.find(object => object.type === "arrow"
    && object.entityAnnotationRole === "arrow");
  if (!arrow) {
    const connection = annotationEntityAnnotationConnection(entity, callout);
    arrow = normalizeAnnotationObject({
      id: annotationObjectId("arrow"),
      type: "arrow",
      name: `${entityLabel} Annotation Arrow`,
      x1: connection.start.x,
      y1: connection.start.y,
      x2: connection.end.x,
      y2: connection.end.y,
      stroke: entity.stroke || defaultEntityStroke,
      strokeWidth: defaultStyles.strokeWidth,
      arrowSize: defaultStyles.arrowSize,
      opacity: 1,
      groupId,
      groupHitTransparent: true,
      entityAnnotationOwnerId: entity.id,
      entityAnnotationRole: "arrow"
    });
    state.objects.push(arrow);
    createdCount += 1;
  } else {
    arrow.groupId = groupId;
    arrow.groupHitTransparent = true;
    arrow.entityAnnotationOwnerId = entity.id;
    arrow.entityAnnotationRole = "arrow";
  }
  syncAnnotationEntityAnnotationArrows(state);
  return { createdCount, removedCount: 0, groupId, callout, arrow };
}

export function annotationEntityRelationshipRoutingObstacles(objectsInput) {
  return (Array.isArray(objectsInput) ? objectsInput : []).filter(object =>
    object?.visible !== false
    && (object.type === "entity"
      || (object.type === "textbox" && object.entityAnnotationRole === "callout")
      || (object.type === "arrow" && object.entityAnnotationRole === "arrow"))
  );
}

function translateAnnotationObjectsWithEntityCallouts(state, objects, deltaX, deltaY) {
  const moving = Array.isArray(objects) ? objects : [];
  const movingIds = new Set(moving.map(object => object.id));
  const linkedEntityIds = new Set(moving.flatMap(object => {
    if (object.type === "entity") return [object.id];
    const ownerId = annotationEntityAnnotationOwnerId(object);
    return ownerId ? [ownerId] : [];
  }));
  const linked = [...linkedEntityIds]
    .flatMap(entityId => {
      const entity = state.objects.find(object => object.id === entityId && object.type === "entity");
      return entity ? [entity, ...annotationEntityAnnotationChildren(state, entity)] : [];
    })
    .filter(object => !movingIds.has(object.id));
  translateAllAnnotationObjects([...moving, ...linked], deltaX, deltaY);
  syncAnnotationEntityAnnotationArrows(state);
}

function annotationRemovalIdsWithEntityCallouts(state, objectIds) {
  const ids = new Set(objectIds || []);
  const ownersToClear = new Set();
  (state?.objects || []).forEach(object => {
    if (ids.has(object.id) && object.type === "entity") {
      annotationEntityAnnotationChildren(state, object).forEach(child => ids.add(child.id));
    }
    if (ids.has(object.id) && annotationEntityAnnotationOwnerId(object)) {
      ownersToClear.add(annotationEntityAnnotationOwnerId(object));
    }
  });
  ownersToClear.forEach(ownerId => {
    annotationEntityAnnotationChildren(state, ownerId).forEach(child => ids.add(child.id));
    const entity = state.objects.find(object => object.id === ownerId && object.type === "entity");
    if (!entity) return;
    delete state.groupNames?.[entity.entityAnnotationGroupId];
    delete state.groupVisibility?.[entity.entityAnnotationGroupId];
    entity.entityAnnotation = "";
    entity.entityAnnotationGroupId = "";
    entity.groupId = "";
    delete entity.groupHitTransparent;
  });
  return ids;
}

export function normalizeAnnotationState(input, fallback = {}) {
  const source = input && typeof input === "object" ? input : {};
  const width = positiveNumber(source.width, positiveNumber(fallback.width, 1));
  const height = positiveNumber(source.height, positiveNumber(fallback.height, 1));
  const objects = Array.isArray(source.objects)
    ? source.objects.map(normalizeAnnotationObject).filter(Boolean)
    : [];
  const originalReference = String(
    source.originalReference || fallback.originalReference || ""
  ).trim();
  const isNewState = !Array.isArray(source.objects);
  if (isNewState && safeEmbeddedImageSource(fallback.seedImageSource)) {
    objects.unshift(normalizeAnnotationObject({
      id: annotationObjectId("embedded-image"),
      type: "embedded-image",
      x: 0,
      y: 0,
      width,
      height,
      source: safeEmbeddedImageSource(fallback.seedImageSource),
      name: "Original Image",
      isOriginalImage: true,
      locked: false,
      groupId: ""
    }));
  }
  compactAnnotationGroupLayers(objects);

  const suppliedCanvasBounds = source.canvasBounds && typeof source.canvasBounds === "object"
    ? {
        x: finiteNumber(source.canvasBounds.x, 0),
        y: finiteNumber(source.canvasBounds.y, 0),
        width: positiveNumber(source.canvasBounds.width, width),
        height: positiveNumber(source.canvasBounds.height, height)
      }
    : null;
  const canvasBounds = suppliedCanvasBounds || { x: 0, y: 0, width, height };
  const groupIds = new Set(objects.map(object => object.groupId).filter(Boolean));
  const suppliedGroupNames = source.groupNames && typeof source.groupNames === "object"
    ? source.groupNames
    : {};
  const groupNames = {};
  groupIds.forEach(groupId => {
    const name = safeAnnotationName(suppliedGroupNames[groupId]);
    if (name) groupNames[groupId] = name;
  });
  const suppliedGroupVisibility = source.groupVisibility && typeof source.groupVisibility === "object"
    ? source.groupVisibility
    : {};
  const groupVisibility = {};
  groupIds.forEach(groupId => {
    groupVisibility[groupId] = suppliedGroupVisibility[groupId] !== false;
  });

  return {
    version: annotationVersion,
    width,
    height,
    originalReference,
    canvasBounds,
    gridVisible: source.gridVisible === true,
    snapToGrid: source.snapToGrid === true,
    allowOverlappingEntityLines: source.allowOverlappingEntityLines === true,
    hideAllEntityRelationships: source.hideAllEntityRelationships === true,
    gridSize: clampNumber(positiveNumber(source.gridSize, defaultGridSize), 4, 200),
    relationshipStyle: normalizeAnnotationEntityRelationshipStyle(source.relationshipStyle),
    groupNames,
    groupVisibility,
    objects
  };
}

function normalizeAnnotationEntityRelationshipStyle(input) {
  const source = input && typeof input === "object" ? input : {};
  return {
    id: entityRelationshipsSelectionId,
    type: entityRelationshipsObjectType,
    name: "Entity Relationships",
    locked: false,
    groupId: "",
    stroke: safeColor(source.stroke, defaultEntityRelationshipStyle.stroke),
    strokeWidth: clampNumber(
      positiveNumber(source.strokeWidth, defaultEntityRelationshipStyle.strokeWidth),
      1,
      40
    ),
    arrowSize: clampNumber(
      positiveNumber(source.arrowSize, defaultEntityRelationshipStyle.arrowSize),
      6,
      160
    ),
    showSymbols: source.showSymbols === true
  };
}

function normalizeAnnotationEntityRelationshipStyleOverride(input) {
  if (!input || typeof input !== "object") return null;
  const normalized = {};
  if (Object.hasOwn(input, "stroke")) {
    const stroke = safeColor(input.stroke, "");
    if (stroke) normalized.stroke = stroke;
  }
  if (Object.hasOwn(input, "strokeWidth")) {
    normalized.strokeWidth = clampNumber(
      positiveNumber(input.strokeWidth, defaultEntityRelationshipStyle.strokeWidth),
      1,
      40
    );
  }
  if (Object.hasOwn(input, "arrowSize")) {
    normalized.arrowSize = clampNumber(
      positiveNumber(input.arrowSize, defaultEntityRelationshipStyle.arrowSize),
      6,
      160
    );
  }
  return Object.keys(normalized).length ? normalized : null;
}

function isAnnotationEntityRelationshipSelectionId(id) {
  return String(id || "").startsWith(entityRelationshipSelectionPrefix);
}

function isAnnotationEntityRelationshipSelectionType(type) {
  return [entityRelationshipsObjectType, entityRelationshipObjectType].includes(type);
}

export function applyAnnotationEntityRelationshipGroupStyle(inputState, patchInput) {
  const state = inputState && typeof inputState === "object" ? inputState : {};
  const patch = patchInput && typeof patchInput === "object" ? patchInput : {};
  const fields = ["stroke", "strokeWidth", "arrowSize", "showSymbols"]
    .filter(field => Object.hasOwn(patch, field));
  if (!fields.length) return;
  state.relationshipStyle ||= normalizeAnnotationEntityRelationshipStyle(null);
  const normalized = normalizeAnnotationEntityRelationshipStyle({ ...state.relationshipStyle, ...patch });
  fields.forEach(field => { state.relationshipStyle[field] = normalized[field]; });
  (state.objects || [])
    .filter(object => object?.type === "entity")
    .flatMap(entity => entity.foreignKeys || [])
    .forEach(foreignKey => {
      if (!foreignKey.styleOverride) return;
      fields.forEach(field => { delete foreignKey.styleOverride[field]; });
      if (!Object.keys(foreignKey.styleOverride).length) delete foreignKey.styleOverride;
    });
}

export function normalizeAnnotationTemplateLibrary(input) {
  const source = input && typeof input === "object" ? input : {};
  const templates = Array.isArray(source.templates)
    ? source.templates.map(normalizeAnnotationTemplate).filter(Boolean).slice(0, maximumAnnotationTemplates)
    : [];
  const defaults = source.defaults && typeof source.defaults === "object" ? source.defaults : {};
  return {
    version: annotationTemplateVersion,
    templates,
    defaults: {
      arrow: normalizeAnnotationDrawingDefault("arrow", defaults.arrow),
      rectangle: normalizeAnnotationDrawingDefault("rectangle", defaults.rectangle)
    }
  };
}

export function restoreAnnotationDefaultTemplates(inputLibrary, inputDefaults) {
  const library = normalizeAnnotationTemplateLibrary(inputLibrary);
  const defaults = normalizeAnnotationTemplateLibrary(inputDefaults);
  const signatures = new Set(library.templates.map(annotationTemplateSignature));
  const missing = [];
  defaults.templates.forEach(template => {
    const signature = annotationTemplateSignature(template);
    if (signatures.has(signature)) return;
    signatures.add(signature);
    missing.push(template);
  });

  if (library.templates.length + missing.length > maximumAnnotationTemplates) {
    return {
      library,
      addedCount: 0,
      missingCount: missing.length,
      requiredSlots: library.templates.length + missing.length - maximumAnnotationTemplates,
      capacityExceeded: true
    };
  }

  const usedIds = new Set(library.templates.map(template => template.id));
  const restored = missing.map(template => {
    const copy = deepCopy(template);
    copy.id = uniqueRestoredTemplateId(copy.id, usedIds);
    usedIds.add(copy.id);
    return copy;
  });

  return {
    library: {
      ...library,
      templates: [...restored, ...library.templates]
    },
    addedCount: restored.length,
    missingCount: restored.length,
    requiredSlots: 0,
    capacityExceeded: false
  };
}

function annotationTemplateSignature(template) {
  const normalized = normalizeAnnotationTemplate(template);
  if (!normalized) return "";
  return JSON.stringify({
    name: normalized.name,
    grouped: normalized.grouped,
    groupName: normalized.groupName,
    groupVisible: normalized.groupVisible,
    width: normalized.width,
    height: normalized.height,
    relationshipStyle: normalized.relationshipStyle
      ? {
          stroke: normalized.relationshipStyle.stroke,
          strokeWidth: normalized.relationshipStyle.strokeWidth,
          arrowSize: normalized.relationshipStyle.arrowSize,
          showSymbols: normalized.relationshipStyle.showSymbols
        }
      : null,
    objects: normalized.objects.map(object => {
      const { id, groupId, locked, ...definition } = object;
      return definition;
    })
  });
}

function uniqueRestoredTemplateId(templateId, usedIds) {
  if (!usedIds.has(templateId)) return templateId;
  const base = `${String(templateId || "template").slice(0, 108)}-default`;
  let candidate = base;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base.slice(0, 116 - String(suffix).length)}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export function captureAnnotationTemplate(inputState, selectedObjectIds, _unusedImageSource, name = "Template") {
  const state = normalizeAnnotationState(inputState);
  const ids = new Set(
    selectedObjectIds && typeof selectedObjectIds[Symbol.iterator] === "function"
      ? selectedObjectIds
      : []
  );
  const selected = state.objects.filter(object => ids.has(object.id));
  const selectedRelationship = resolveAnnotationEntityRelationships(state.objects)
    .find(relationship => ids.has(relationship.id));
  const relationshipStyle = ids.has(entityRelationshipsSelectionId)
    ? deepCopy(state.relationshipStyle)
    : selectedRelationship
      ? deepCopy(annotationEntityRelationshipEffectiveStyle(selectedRelationship, state.relationshipStyle))
      : null;
  const selectedGroupIds = new Set(selected.map(object => object.groupId).filter(Boolean));
  const selectedGroupId = selectedGroupIds.size === 1 ? [...selectedGroupIds][0] : "";
  const grouped = Boolean(selectedGroupId)
    && selected.every(object => object.groupId === selectedGroupId)
    && selected.length === state.objects.filter(object => object.groupId === selectedGroupId).length;
  const groupName = grouped
    ? state.groupNames[selectedGroupId] || ""
    : "";
  const groupVisible = grouped
    ? state.groupVisibility[selectedGroupId] !== false
    : true;
  const objects = selected
    .map(object => {
      const copy = { ...deepCopy(object), locked: false, groupId: "" };
      if (copy.type === "embedded-image") copy.isOriginalImage = false;
      return copy;
    })
    .filter(Boolean);
  if (!objects.length && !relationshipStyle) return null;

  const bounds = unionAnnotationBounds(objects.map(object => annotationObjectVisualBounds(object)).filter(Boolean));
  if (bounds) translateAllAnnotationObjects(objects, -bounds.x, -bounds.y);
  return normalizeAnnotationTemplate({
    id: annotationObjectId("template"),
    name,
    width: bounds?.width || 240,
    height: bounds?.height || 80,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    grouped,
    groupName,
    groupVisible,
    relationshipStyle,
    objects
  });
}

export function annotationTemplateDownloadFile(templateInput) {
  const template = normalizeAnnotationTemplate(templateInput);
  if (!template) throw new Error("The annotation template is invalid.");
  const fileStem = String(template.name || "annotation-template")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/[.\s]+$/g, "")
    .slice(0, 100) || "annotation-template";
  return {
    fileName: `${fileStem}.pmt-template.json`,
    contents: JSON.stringify({
      format: annotationTemplateFileFormat,
      version: annotationTemplateVersion,
      template
    }, null, 2)
  };
}

export function parseAnnotationTemplateUpload(sourceText) {
  let parsed;
  try {
    parsed = JSON.parse(String(sourceText || ""));
  } catch {
    throw new Error("Choose a valid PMT template JSON file.");
  }
  if (parsed?.format === annotationTemplateFileFormat && parsed?.version !== annotationTemplateVersion) {
    throw new Error("This PMT template file version is not supported.");
  }
  const candidate = parsed?.format === annotationTemplateFileFormat ? parsed.template : parsed;
  const template = normalizeAnnotationTemplate(candidate);
  if (!template) throw new Error("The file does not contain a valid annotation template.");
  return template;
}

export function instantiateAnnotationTemplate(templateInput, center, idFactory = annotationObjectId, groupId = "") {
  const template = normalizeAnnotationTemplate(templateInput);
  if (!template) return [];
  const offsetX = finiteNumber(center?.x, 0) - (template.width / 2);
  const offsetY = finiteNumber(center?.y, 0) - (template.height / 2);
  const instanceGroupId = template.objects.length > 1 || template.grouped
    ? safeGroupId(groupId) || annotationObjectId("group")
    : "";
  const objects = template.objects.map(object => {
    const copy = deepCopy(object);
    copy.id = String(idFactory(copy.type) || annotationObjectId(copy.type));
    copy.locked = false;
    copy.groupId = instanceGroupId;
    return copy;
  });
  translateAllAnnotationObjects(objects, offsetX, offsetY);
  return objects;
}

function annotationTemplateFormattingPlan(templateInput, destinationObjectsInput) {
  const template = normalizeAnnotationTemplate(templateInput);
  const destinations = Array.isArray(destinationObjectsInput)
    ? destinationObjectsInput.filter(object => object && typeof object === "object")
    : [];
  const sources = [
    ...(template?.objects || []),
    ...(template?.relationshipStyle ? [template.relationshipStyle] : [])
  ];
  const comparableType = type => type === entityRelationshipObjectType ? entityRelationshipsObjectType : type;
  const structureMatches = destinations.length === sources.length
    && destinations.every((object, index) => comparableType(object.type) === comparableType(sources[index]?.type));
  const sourcesByType = new Map();
  sources.forEach(source => {
    if (!annotationTemplateStyleFields[source.type]) return;
    const type = comparableType(source.type);
    const matches = sourcesByType.get(type) || [];
    matches.push(source);
    sourcesByType.set(type, matches);
  });

  const typeIndexes = new Map();
  const matches = [];
  destinations.forEach((destination, index) => {
    if (!annotationTemplateStyleFields[destination.type]) return;
    let source = null;
    if (structureMatches) {
      source = sources[index];
    } else {
      const type = comparableType(destination.type);
      const candidates = sourcesByType.get(type) || [];
      const typeIndex = typeIndexes.get(type) || 0;
      source = candidates[Math.min(typeIndex, Math.max(0, candidates.length - 1))] || null;
      typeIndexes.set(type, typeIndex + 1);
    }
    if (comparableType(source?.type) === comparableType(destination.type)) matches.push({ destination, source });
  });

  return {
    structureMatches,
    selectedCount: destinations.length,
    matches,
    editableMatchCount: matches.filter(match => !match.destination.locked).length
  };
}

export function applyAnnotationTemplateFormatting(templateInput, destinationObjectsInput) {
  const plan = annotationTemplateFormattingPlan(templateInput, destinationObjectsInput);
  let appliedCount = 0;
  let changedCount = 0;
  let lockedCount = 0;
  let geometryConstrainedCount = 0;

  plan.matches.forEach(({ destination, source }) => {
    if (destination.locked) {
      lockedCount += 1;
      return;
    }
    const fields = annotationTemplateStyleFields[destination.type];
    const before = JSON.stringify([
      ...fields.map(field => destination[field]),
      ...(destination.type === "entity" ? [destination.height, destination.expandedHeight] : [])
    ]);
    let geometryConstrained = false;

    if (destination.type === "arrow") {
      const requestedStrokeWidth = annotationArrowStrokeWidth(source);
      const requestedArrowSize = annotationArrowRequestedHeadLength(source);
      const length = Math.hypot(destination.x2 - destination.x1, destination.y2 - destination.y1);
      const maximumHeadSpan = Math.max(minimumScaledArrowSize, (length * 0.8) - 0.000001);
      const maximumStrokeWidth = Math.max(minimumScaledStrokeWidth, maximumHeadSpan / 1.5);
      destination.stroke = source.stroke;
      destination.strokeWidth = Math.min(requestedStrokeWidth, maximumStrokeWidth);
      destination.arrowSize = Math.min(requestedArrowSize, maximumHeadSpan);
      destination.opacity = source.opacity;
      geometryConstrained = destination.strokeWidth !== requestedStrokeWidth
        || destination.arrowSize !== requestedArrowSize;
    } else {
      fields.forEach(field => { destination[field] = source[field]; });
    }

    appliedCount += 1;
    const after = JSON.stringify([
      ...fields.map(field => destination[field]),
      ...(destination.type === "entity" ? [destination.height, destination.expandedHeight] : [])
    ]);
    if (before !== after) changedCount += 1;
    if (geometryConstrained) geometryConstrainedCount += 1;
  });

  return {
    structureMatches: plan.structureMatches,
    selectedCount: plan.selectedCount,
    matchedCount: plan.matches.length,
    appliedCount,
    changedCount,
    lockedCount,
    geometryConstrainedCount
  };
}

export function annotationWorkspaceBounds(inputState, viewportWidth = 0, viewportHeight = 0) {
  const state = normalizeAnnotationState(inputState);
  const content = annotationOutputBounds(state);
  const minimumWidth = (Math.max(0, finiteNumber(viewportWidth, 0)) + 96) / minimumZoom;
  const minimumHeight = (Math.max(0, finiteNumber(viewportHeight, 0)) + 96) / minimumZoom;
  const width = Math.max(content.width * 3, minimumWidth, 1);
  const height = Math.max(content.height * 3, minimumHeight, 1);
  const centerX = content.x + (content.width / 2);
  const centerY = content.y + (content.height / 2);
  return {
    x: centerX - (width / 2),
    y: centerY - (height / 2),
    width,
    height
  };
}

export function annotationExpandedWorkspaceBounds(currentBounds, inputState, viewportWidth = 0, viewportHeight = 0) {
  const content = annotationOutputBounds(inputState);
  const existing = currentBounds && typeof currentBounds === "object"
    ? {
        x: finiteNumber(currentBounds.x, 0),
        y: finiteNumber(currentBounds.y, 0),
        width: positiveNumber(currentBounds.width, 1),
        height: positiveNumber(currentBounds.height, 1)
      }
    : null;
  if (existing && annotationBoundsContain(existing, content)) return existing;
  const extension = annotationWorkspaceBounds(inputState, viewportWidth, viewportHeight);
  return unionAnnotationBounds([existing, extension, content]) || extension;
}

export function annotationOutputBounds(inputState, options = {}) {
  const state = normalizeAnnotationState(inputState);
  syncAnnotationEntityAnnotationArrows(state);
  const visibleObjects = annotationVisibleObjects(state);
  const bounds = [
    state.canvasBounds,
    ...visibleObjects
    .map(object => annotationObjectVisualBounds(object)),
    ...(state.hideAllEntityRelationships
      ? []
      : annotationEntityRelationshipVisualBounds(visibleObjects, state.relationshipStyle, {
          allowOverlappingLines: state.allowOverlappingEntityLines,
          relationshipRenderModel: options?.relationshipRenderModel
        }))
  ].filter(Boolean);
  return unionAnnotationBounds(bounds) || state.canvasBounds;
}

function annotationCropImage(state, imageOrId = null) {
  if (imageOrId && typeof imageOrId === "object") return imageOrId;
  const requestedId = String(imageOrId || "");
  if (requestedId) return state?.objects?.find(object => object.id === requestedId) || null;
  return state?.objects?.find(object => object.type === "embedded-image" && object.isOriginalImage)
    || state?.objects?.find(object => object.type === "embedded-image")
    || null;
}

function annotationEmbeddedImageEffectiveClip(object) {
  const fullBounds = annotationObjectBounds(object);
  if (!fullBounds) return null;
  if (object?.cropVisible === false) return fullBounds;
  return intersectAnnotationBounds(fullBounds, object?.imageClip || fullBounds) || fullBounds;
}

export function annotationImageHasReversibleCrop(inputState, imageOrId = null) {
  const state = normalizeAnnotationState(inputState);
  const image = annotationCropImage(state, imageOrId);
  return image?.type === "embedded-image"
    && !annotationBoundsEqual(image.imageClip, annotationObjectBounds(image));
}

export function setAnnotationImageCropVisibility(state, visible, imageOrId = null) {
  if (!state) return false;
  const image = annotationCropImage(state, imageOrId);
  if (!image || !annotationImageHasReversibleCrop(state, image)) return false;
  image.cropVisible = visible !== false;
  return true;
}

export function annotationObjectIsVisible(object, groupVisibility = {}) {
  if (!object || object.visible === false) return false;
  return !object.groupId || groupVisibility?.[object.groupId] !== false;
}

function annotationVisibleObjects(state) {
  return (state?.objects || []).filter(object => annotationObjectIsVisible(object, state?.groupVisibility));
}

export function annotationObjectsIntersectingRect(objects, rect, imageFrame = null, groupVisibility = {}) {
  const selectionRect = normalizedRect(
    { x: finiteNumber(rect?.x, 0), y: finiteNumber(rect?.y, 0) },
    {
      x: finiteNumber(rect?.x, 0) + Math.max(0, finiteNumber(rect?.width, 0)),
      y: finiteNumber(rect?.y, 0) + Math.max(0, finiteNumber(rect?.height, 0))
    }
  );
  const source = (Array.isArray(objects) ? objects : [])
    .filter(object => annotationObjectIsVisible(object, groupVisibility));
  const directlyTouched = source.filter(object => {
    const bounds = annotationObjectVisualBounds(object, imageFrame);
    if (!bounds) return false;
    return ["arrow", "line"].includes(object.type)
      ? annotationArrowIntersectsRect(object, selectionRect)
      : annotationBoundsIntersect(selectionRect, bounds);
  });
  const groupIds = new Set(directlyTouched
    .filter(object => object.groupHitTransparent !== true)
    .map(object => object.groupId)
    .filter(Boolean));
  return source.filter(object => directlyTouched.includes(object) || (object.groupId && groupIds.has(object.groupId)));
}

export function annotationSelectionIdsForObject(objects, object, groupVisibility = null) {
  if (!object?.id) return [];
  const source = Array.isArray(objects) ? objects : [];
  const selectable = groupVisibility && typeof groupVisibility === "object"
    ? source.filter(item => annotationObjectIsVisible(item, groupVisibility))
    : source;
  return object.groupId && object.groupHitTransparent !== true
    ? selectable.filter(item => item.groupId === object.groupId).map(item => item.id)
    : [object.id];
}

export function buildAnnotationObjectTree(inputState) {
  const state = normalizeAnnotationState(inputState);
  const topmostFirst = [...state.objects].reverse();
  const renderedGroups = new Set();
  let unnamedGroupSequence = 0;
  const objectNode = object => {
    const image = object.type === "embedded-image";
    const reversibleCrop = image && annotationImageHasReversibleCrop(state, object);
    const permanentCrop = image && object.cropPermanent === true;
    const cropVisible = image && object.cropVisible !== false;
    return {
      kind: "object",
      id: object.id,
      name: object.name || annotationObjectLabel(object),
      visible: object.visible !== false,
      effectiveVisible: annotationObjectIsVisible(object, state.groupVisibility),
      cropped: image && (reversibleCrop || permanentCrop),
      reversibleCrop,
      cropVisible,
      permanentCrop,
      object
    };
  };

  const nodes = topmostFirst.flatMap(object => {
    if (!object.groupId) return [objectNode(object)];
    if (renderedGroups.has(object.groupId)) return [];
    renderedGroups.add(object.groupId);
    unnamedGroupSequence += 1;
    const children = topmostFirst
      .filter(member => member.groupId === object.groupId)
      .map(objectNode);
    return [{
      kind: "group",
      id: object.groupId,
      name: state.groupNames[object.groupId] || `Group ${unnamedGroupSequence}`,
      visible: state.groupVisibility[object.groupId] !== false,
      effectiveVisible: state.groupVisibility[object.groupId] !== false,
      hitTransparent: children.length > 0
        && children.every(child => child.object.groupHitTransparent === true),
      children,
      allChildren: children
    }];
  });
  const relationships = resolveAnnotationEntityRelationships(annotationVisibleObjects(state))
    .sort(compareAnnotationEntityRelationships);
  if (relationships.length) {
    const children = relationships.map(relationship => ({
      kind: "relationship",
      id: relationship.id,
      name: annotationEntityRelationshipName(relationship),
      object: annotationEntityRelationshipSelectionObject(relationship, state.relationshipStyle),
      fixed: true,
      relationship
    }));
    const relationshipNode = {
      kind: "relationships",
      id: entityRelationshipsSelectionId,
      name: "Entity Relationships",
      object: state.relationshipStyle,
      fixed: true,
      count: relationships.length,
      children,
      allChildren: children
    };
    const imageIndex = nodes.findIndex(node => node.kind === "object"
      && node.object?.type === "embedded-image"
      && node.object?.isOriginalImage);
    nodes.splice(imageIndex >= 0 ? imageIndex : nodes.length, 0, relationshipNode);
  }
  return nodes;
}

export function filterAnnotationObjectTree(nodes, query) {
  const needle = String(query || "").trim().toLocaleLowerCase();
  if (!needle) return Array.isArray(nodes) ? nodes : [];
  return (Array.isArray(nodes) ? nodes : []).flatMap(node => {
    if (String(node.name || "").toLocaleLowerCase().includes(needle)) return [node];
    if (!["group", "relationships"].includes(node.kind)) return [];
    const children = node.children.filter(child => String(child.name || "").toLocaleLowerCase().includes(needle));
    return children.length ? [{ ...node, children }] : [];
  });
}

export function reorderAnnotationObjectTree(inputState, move = {}) {
  const state = normalizeAnnotationState(inputState);
  const draggedKind = move.draggedKind === "group" ? "group" : "object";
  const draggedId = String(move.draggedId || "");
  const targetKind = ["group", "object", "root"].includes(move.targetKind)
    ? move.targetKind
    : "root";
  const targetId = String(move.targetId || "");
  const requestedPlacement = ["before", "after", "inside"].includes(move.targetPlacement)
    ? move.targetPlacement
    : targetKind === "group" ? "inside" : "before";
  const targetPlacement = targetKind === "group" && requestedPlacement === "after"
    ? "inside"
    : requestedPlacement;
  const moving = draggedKind === "group"
    ? state.objects.filter(object => object.groupId === draggedId)
    : state.objects.filter(object => object.id === draggedId);
  if (!moving.length || moving.some(object => object.locked)) return state;
  if (targetKind !== "root" && moving.some(object => object.id === targetId)) return state;
  if (targetKind === "group" && draggedKind === "group" && draggedId === targetId) return state;

  const targetObject = targetKind === "object"
    ? state.objects.find(object => object.id === targetId) || null
    : null;
  const targetGroupId = targetKind === "group"
    ? safeGroupId(targetId)
    : targetKind === "object"
      ? targetObject?.groupId || ""
      : "";
  const destinationGroupId = targetKind === "group" && targetPlacement !== "inside"
    ? ""
    : targetGroupId;
  if (targetKind === "group" && !state.objects.some(object => object.groupId === targetGroupId)) return state;
  if (targetKind === "object" && !targetObject) return state;
  if (targetObject && moving.some(object => object.id === targetObject.id)) return state;

  const movingIds = new Set(moving.map(object => object.id));
  const sourceGroupId = draggedKind === "group" ? draggedId : moving[0].groupId;
  if (draggedKind === "object") {
    moving[0].groupId = destinationGroupId;
  } else if (destinationGroupId && destinationGroupId !== draggedId) {
    moving.forEach(object => { object.groupId = destinationGroupId; });
    delete state.groupNames[draggedId];
  }

  const movingLayers = moving;
  const remainingLayers = state.objects.filter(object => !movingIds.has(object.id));
  let insertionIndex = remainingLayers.length;
  if (targetKind === "object") {
    const targetIndex = remainingLayers.findIndex(object => object.id === targetId);
    insertionIndex = targetIndex < 0
      ? 0
      : targetIndex + (targetPlacement === "after" ? 0 : 1);
  } else if (targetKind === "group") {
    const groupIndexes = remainingLayers
      .map((object, index) => object.groupId === targetGroupId ? index : -1)
      .filter(index => index >= 0);
    insertionIndex = groupIndexes.length ? Math.max(...groupIndexes) + 1 : remainingLayers.length;
  }
  remainingLayers.splice(insertionIndex, 0, ...movingLayers);
  state.objects = remainingLayers;
  compactAnnotationGroupLayers(state.objects);

  if (draggedKind === "object" && sourceGroupId && sourceGroupId !== destinationGroupId
    && !state.objects.some(object => object.groupId === sourceGroupId)) {
    delete state.groupNames[sourceGroupId];
  }
  pruneAnnotationGroupMetadata(state);
  return state;
}

export function compactAnnotationGroupLayers(objects) {
  if (!Array.isArray(objects) || objects.length < 2) return objects;
  const grouped = new Map();
  objects.forEach((object, index) => {
    if (!object.groupId) return;
    const entry = grouped.get(object.groupId) || { members: [], topmostIndex: index };
    entry.members.push(object);
    entry.topmostIndex = index;
    grouped.set(object.groupId, entry);
  });
  const compacted = [];
  objects.forEach((object, index) => {
    if (!object.groupId) {
      compacted.push(object);
      return;
    }
    const entry = grouped.get(object.groupId);
    if (entry?.topmostIndex === index) compacted.push(...entry.members);
  });
  objects.splice(0, objects.length, ...compacted);
  return objects;
}

export function snapAnnotationValue(value, enabled, gridSize = defaultGridSize) {
  const numeric = finiteNumber(value, 0);
  if (!enabled) return numeric;
  const size = positiveNumber(gridSize, defaultGridSize);
  return Math.round(numeric / size) * size;
}

export function snapAnnotationCropPoint(point, imageClip, enabled, gridSize = defaultGridSize) {
  const clip = {
    x: finiteNumber(imageClip?.x, 0),
    y: finiteNumber(imageClip?.y, 0),
    width: positiveNumber(imageClip?.width, 1),
    height: positiveNumber(imageClip?.height, 1)
  };
  const snapCoordinate = (value, start, length) => {
    const end = start + length;
    const bounded = clampNumber(finiteNumber(value, start), start, end);
    if (bounded === start || bounded === end) return bounded;
    return clampNumber(
      start + snapAnnotationValue(bounded - start, enabled, gridSize),
      start,
      end
    );
  };
  return {
    x: snapCoordinate(point?.x, clip.x, clip.width),
    y: snapCoordinate(point?.y, clip.y, clip.height)
  };
}

export function adjustAnnotationArrowEndpoint(inputArrow, endpoint, point, snapEnabled = false, gridSize = defaultGridSize) {
  const arrow = { ...inputArrow };
  const movingBase = endpoint === "base" || endpoint === "arrow-base";
  const anchor = movingBase
    ? { x: finiteNumber(arrow.x2, 0), y: finiteNumber(arrow.y2, 0) }
    : { x: finiteNumber(arrow.x1, 0), y: finiteNumber(arrow.y1, 0) };
  const candidate = {
    x: snapAnnotationValue(point?.x, snapEnabled, gridSize),
    y: snapAnnotationValue(point?.y, snapEnabled, gridSize)
  };
  let deltaX = candidate.x - anchor.x;
  let deltaY = candidate.y - anchor.y;
  let length = Math.hypot(deltaX, deltaY);
  const minimumLength = arrow.type === "line" ? minimumObjectSize : annotationMinimumArrowLength(arrow);
  if (length < minimumLength) {
    if (!length) {
      const originalX = movingBase
        ? finiteNumber(arrow.x1, anchor.x) - anchor.x
        : finiteNumber(arrow.x2, anchor.x) - anchor.x;
      const originalY = movingBase
        ? finiteNumber(arrow.y1, anchor.y) - anchor.y
        : finiteNumber(arrow.y2, anchor.y) - anchor.y;
      const originalLength = Math.hypot(originalX, originalY);
      deltaX = originalLength ? originalX / originalLength : movingBase ? -1 : 1;
      deltaY = originalLength ? originalY / originalLength : 0;
    } else {
      deltaX /= length;
      deltaY /= length;
    }
    length = minimumLength;
    candidate.x = anchor.x + (deltaX * length);
    candidate.y = anchor.y + (deltaY * length);
  }
  if (movingBase) {
    arrow.x1 = candidate.x;
    arrow.y1 = candidate.y;
  } else {
    arrow.x2 = candidate.x;
    arrow.y2 = candidate.y;
  }
  return arrow;
}

export function zoomAnnotationAtPoint({
  oldZoom,
  newZoom,
  scrollLeft,
  scrollTop,
  pointX,
  pointY,
  contentOffsetX = 0,
  contentOffsetY = 0
}) {
  const before = clampNumber(positiveNumber(oldZoom, 1), minimumZoom, maximumZoom);
  const after = clampNumber(positiveNumber(newZoom, before), minimumZoom, maximumZoom);
  const x = finiteNumber(pointX, 0);
  const y = finiteNumber(pointY, 0);
  const offsetX = finiteNumber(contentOffsetX, 0);
  const offsetY = finiteNumber(contentOffsetY, 0);
  return {
    zoom: after,
    scrollLeft: (((finiteNumber(scrollLeft, 0) + x - offsetX) / before) * after) - x + offsetX,
    scrollTop: (((finiteNumber(scrollTop, 0) + y - offsetY) / before) * after) - y + offsetY
  };
}

export function annotationSvgPlaneMetrics(widthInput, heightInput, devicePixelRatioInput = 1) {
  const width = Math.max(1, positiveNumber(widthInput, 1));
  const height = Math.max(1, positiveNumber(heightInput, 1));
  const devicePixelRatio = Math.max(1, positiveNumber(devicePixelRatioInput, 1));
  const maximumCssDimension = maximumAnnotationPlaneDevicePixels / devicePixelRatio;
  const baseScale = Math.min(1, maximumCssDimension / width, maximumCssDimension / height);
  return {
    width: width * baseScale,
    height: height * baseScale,
    baseScale
  };
}

export function wrapAnnotationText(text, width, fontSize) {
  const value = String(text ?? "").replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const size = clampNumber(positiveNumber(fontSize, defaultStyles.fontSize), 6, 240);
  const availableWidth = Math.max(size, positiveNumber(width, size) - (size * 0.7));
  const maximumCharacters = Math.max(1, Math.floor(availableWidth / (size * 0.58)));
  const lines = [];

  value.split("\n").forEach(paragraph => {
    if (!paragraph) {
      lines.push("");
      return;
    }

    let current = "";
    paragraph.split(/\s+/).forEach(word => {
      const pieces = splitLongWord(word, maximumCharacters);
      pieces.forEach(piece => {
        const candidate = current ? `${current} ${piece}` : piece;
        if (candidate.length <= maximumCharacters) {
          current = candidate;
          return;
        }

        if (current) lines.push(current);
        current = piece;
      });
    });
    if (current) lines.push(current);
  });

  return lines.length ? lines : [""];
}

function createAnnotationDialog(context) {
  return new Promise(resolve => {
    let state = deepCopy(context.state);
    let originalReference = context.originalReference;
    let pendingPermanentCrop = null;
    let templateLibrary = normalizeAnnotationTemplateLibrary(context.templateLibrary);
    let templateBusy = false;
    let pmtSchemaBusy = false;
    let clipboardImageBusy = false;
    const templateLibraryAvailable = !context.templateLibraryError
      && typeof context.saveTemplateLibrary === "function";
    const defaultTemplateLibraryAvailable = typeof context.loadDefaultTemplateLibrary === "function";
    let activeInspectorTab = "format";
    let nativeClipboard = null;
    let pasteSequence = 0;
    let lastTreeSelectionKey = "";
    let treeRangeAnchorKey = "";
    let draggedTreeNode = null;
    let draggedEntityField = null;
    let objectTreeSearchQuery = "";
    let zoom = 1;
    let activeTool = "select";
    const initialObject = context.initialSelection === "none"
      ? null
      : state.objects.find(object => object.type === "embedded-image" && object.isOriginalImage)
        || null;
    let selectedIds = new Set(annotationSelectionIdsForObject(state.objects, initialObject, state.groupVisibility));
    let transientInvisibleSelectionIds = new Set();
    let lastSelectedObjectId = initialObject?.id || "";
    let gesture = null;
    let panGesture = null;
    const embeddedSources = annotationEmbeddedSourceRegistry(state.objects);
    let history = [annotationSnapshot(state, embeddedSources)];
    let historyIndex = 0;
    let historyTimer = 0;
    let objectSequence = state.objects.length;
    let groupSequence = 0;
    let cropPreview = null;
    let marqueePreview = null;
    let workspaceBounds = annotationWorkspaceBounds(state);
    let lastZoomPoint = null;
    let applying = false;
    let copying = false;
    let cropBusy = false;
    let inspectorVisible = true;
    let inspectorWidth = 320;
    let maximized = false;
    let resolved = false;
    let contextMenuScrollGuardToken = 0;
    let contextMenuScrollGuardActive = false;
    let cancelPendingCanvasZoom = () => {};
    let disconnectCanvasResizeObserver = () => {};
    let disposeCanvasZoom = () => {};
    let finishInspectorResize = () => {};
    const styles = { ...defaultStyles };

    const embedded = context.embedded === true && context.host?.appendChild;
    const dialog = document.createElement("dialog");
    dialog.className = "dialog image-annotation-dialog";
    dialog.classList.toggle("is-annotation-embedded", Boolean(embedded));
    dialog.classList.toggle("is-diagram-editor", context.entityHeaderActionsOnHover === true);
    dialog.setAttribute("aria-labelledby", "imageAnnotationTitle");
    dialog.innerHTML = annotationDialogHtml(context);
    if (embedded) {
      context.host.replaceChildren(dialog);
    } else {
      document.body.appendChild(dialog);
    }

    const canvas = dialog.querySelector("[data-annotation-canvas]");
    const canvasStage = dialog.querySelector("[data-annotation-canvas-stage]");
    const workspace = dialog.querySelector("[data-annotation-workspace]");
    const zoomShield = dialog.querySelector("[data-annotation-zoom-shield]");
    const zoomSelect = dialog.querySelector("[data-annotation-zoom-select]");
    const statusRegions = [...dialog.querySelectorAll("[data-annotation-status], [data-annotation-maximized-status]")];
    const textInput = dialog.querySelector("[data-annotation-text]");
    const toolbar = dialog.querySelector(".image-annotation-toolbar");
    const main = dialog.querySelector("[data-annotation-main]");
    const inspector = dialog.querySelector("[data-annotation-inspector]");
    const inspectorSplitter = dialog.querySelector("[data-annotation-inspector-splitter]");
    const inspectorToggle = dialog.querySelector("[data-annotation-toggle-inspector]");
    const contextMenu = dialog.querySelector("[data-annotation-context-menu]");
    const maximizeButton = dialog.querySelector("[data-annotation-maximize]");
    const restoreButton = dialog.querySelector("[data-annotation-restore]");
    const maximizedActions = dialog.querySelector("[data-annotation-maximized-actions]");
    const templateList = dialog.querySelector("[data-annotation-template-list]");
    const templateStatus = dialog.querySelector("[data-annotation-template-status]");
    const templateUploadInput = dialog.querySelector("[data-annotation-template-upload-input]");
    const objectTree = dialog.querySelector("[data-annotation-object-tree]");
    const objectTreeSearch = dialog.querySelector("[data-annotation-object-tree-search]");
    const entityInspectorTab = dialog.querySelector("[data-annotation-inspector-tab='entity']");
    const entityInspectorPanel = dialog.querySelector("[data-annotation-inspector-panel='entity']");
    const entityFieldList = dialog.querySelector("[data-annotation-entity-fields]");
    const entityAnnotationInput = dialog.querySelector("[data-annotation-entity-annotation]");

    const abortEditor = () => finish(null);
    const finish = value => {
      if (resolved) return;
      resolved = true;
      if (historyTimer) window.clearTimeout(historyTimer);
      cancelPendingCanvasZoom();
      disposeCanvasZoom();
      disconnectCanvasResizeObserver();
      finishInspectorResize();
      window.removeEventListener("resize", closeAnnotationContextMenu);
      context.signal?.removeEventListener?.("abort", abortEditor);
      if (dialog.open) dialog.close();
      dialog.remove();
      resolve(value);
    };
    context.signal?.addEventListener?.("abort", abortEditor, { once: true });

    const setStatus = message => {
      statusRegions.forEach(region => { region.textContent = message || ""; });
    };

    const updateLayoutPreservingWorkspaceCenter = (update, focusTarget) => {
      const centerX = workspace.scrollLeft + (workspace.clientWidth / 2);
      const centerY = workspace.scrollTop + (workspace.clientHeight / 2);
      update();
      window.requestAnimationFrame(() => {
        scrollWorkspaceTo(
          centerX - (workspace.clientWidth / 2),
          centerY - (workspace.clientHeight / 2),
          true
        );
        focusTarget?.focus({ preventScroll: true });
      });
    };

    const setInspectorVisible = visible => {
      inspectorVisible = visible !== false;
      updateLayoutPreservingWorkspaceCenter(() => {
        inspector.hidden = !inspectorVisible;
        inspectorSplitter.hidden = !inspectorVisible;
        main.classList.toggle("is-inspector-hidden", !inspectorVisible);
        inspectorToggle.textContent = inspectorVisible ? "Hide Right Pane" : "Show Right Pane";
        inspectorToggle.title = inspectorVisible ? "Hide Right Pane" : "Show Right Pane";
        inspectorToggle.setAttribute("aria-label", inspectorToggle.title);
        inspectorToggle.setAttribute("aria-expanded", String(inspectorVisible));
      }, inspectorToggle);
    };

    const inspectorWidthLimits = () => {
      const mainWidth = main.getBoundingClientRect().width || window.innerWidth;
      return {
        minimum: 300,
        maximum: Math.max(300, Math.min(720, mainWidth - 360))
      };
    };

    const setInspectorWidth = value => {
      const limits = inspectorWidthLimits();
      inspectorWidth = Math.round(clampNumber(value, limits.minimum, limits.maximum));
      main.style.setProperty("--image-annotation-inspector-width", `${inspectorWidth}px`);
      inspectorSplitter.setAttribute("aria-valuemin", String(limits.minimum));
      inspectorSplitter.setAttribute("aria-valuemax", String(limits.maximum));
      inspectorSplitter.setAttribute("aria-valuenow", String(inspectorWidth));
    };

    const beginInspectorResize = event => {
      if (!inspectorVisible || window.matchMedia("(max-width: 900px)").matches) return;
      event.preventDefault();
      finishInspectorResize();
      const startX = event.clientX;
      const startWidth = inspector.getBoundingClientRect().width || inspectorWidth;
      dialog.classList.add("is-resizing-inspector");

      const resize = moveEvent => {
        setInspectorWidth(startWidth + startX - moveEvent.clientX);
      };
      const finishResize = () => {
        dialog.classList.remove("is-resizing-inspector");
        window.removeEventListener("pointermove", resize);
        window.removeEventListener("pointerup", finishResize);
        window.removeEventListener("pointercancel", finishResize);
        finishInspectorResize = () => {};
      };
      finishInspectorResize = finishResize;
      window.addEventListener("pointermove", resize);
      window.addEventListener("pointerup", finishResize);
      window.addEventListener("pointercancel", finishResize);
    };

    const setInspectorTab = tabName => {
      const requestedTab = dialog.querySelector(`[data-annotation-inspector-tab='${tabName}']`);
      activeInspectorTab = ["format", "entity", "template", "objects"].includes(tabName)
        && requestedTab?.hidden !== true
        ? tabName
        : "format";
      dialog.querySelectorAll("[data-annotation-inspector-tab]").forEach(tab => {
        const selected = tab.dataset.annotationInspectorTab === activeInspectorTab;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected && !tab.hidden ? 0 : -1;
      });
      dialog.querySelectorAll("[data-annotation-inspector-panel]").forEach(panel => {
        panel.hidden = panel.dataset.annotationInspectorPanel !== activeInspectorTab;
      });
    };

    const focusAnnotationTextEditor = () => {
      if (!inspectorVisible) setInspectorVisible(true);
      setInspectorTab("format");
      window.requestAnimationFrame(() => {
        textInput.closest("[data-annotation-text-field]")?.scrollIntoView({
          block: "center",
          inline: "nearest"
        });
        textInput.focus({ preventScroll: true });
        textInput.select();
      });
    };

    const setMaximized = value => {
      maximized = value === true;
      closeAnnotationContextMenu();
      updateLayoutPreservingWorkspaceCenter(() => {
        dialog.classList.toggle("is-annotation-maximized", maximized);
        restoreButton.hidden = !maximized;
        maximizedActions.hidden = !maximized;
      }, maximized ? restoreButton : maximizeButton);
    };

    function closeAnnotationContextMenu() {
      contextMenuScrollGuardToken += 1;
      contextMenuScrollGuardActive = false;
      const restoreSelectionFocus = !contextMenu.hidden && contextMenu.contains(document.activeElement);
      contextMenu.hidden = true;
      dialog.classList.remove("rich-image-menu-open");
      if (restoreSelectionFocus) focusLastSelectedObject();
    }

    const positionAnnotationContextMenu = event => {
      const margin = 8;
      contextMenu.hidden = false;
      dialog.classList.add("rich-image-menu-open");
      const maximumLeft = Math.max(margin, window.innerWidth - contextMenu.offsetWidth - margin);
      const maximumTop = Math.max(margin, window.innerHeight - contextMenu.offsetHeight - margin);
      contextMenu.style.left = `${Math.round(Math.max(margin, Math.min(event.clientX, maximumLeft)))}px`;
      contextMenu.style.top = `${Math.round(Math.max(margin, Math.min(event.clientY, maximumTop)))}px`;
    };

    const setTool = tool => {
      activeTool = ["select", "crop", "rectangle", "circle", "arrow", "line", "textbox", "entity"].includes(tool) ? tool : "select";
      if (activeTool !== "select") marqueePreview = null;
      dialog.querySelectorAll("button[data-annotation-tool]").forEach(button => {
        const pressed = button.dataset.annotationTool === activeTool;
        button.classList.toggle("is-active", pressed);
        button.setAttribute("aria-pressed", String(pressed));
      });
      workspace.dataset.annotationTool = activeTool;
      setStatus(activeTool === "select"
        ? "Select, move, resize, or drag from blank canvas to marquee-select objects."
        : activeTool === "crop"
          ? "Drag over the area to keep. Cropping is non-destructive and can be reset."
          : activeTool === "entity"
            ? "Draw an Entity."
            : `Draw a ${activeTool === "textbox" ? "text box" : activeTool}.`);
    };

    const selectedObjects = () => {
      const relationships = state.hideAllEntityRelationships
        ? []
        : resolveAnnotationEntityRelationships(annotationVisibleObjects(state));
      return [
        ...state.objects.filter(object => selectedIds.has(object.id)),
        ...(selectedIds.has(entityRelationshipsSelectionId) ? [state.relationshipStyle] : []),
        ...relationships
          .filter(relationship => selectedIds.has(relationship.id))
          .map(relationship => annotationEntityRelationshipSelectionObject(relationship, state.relationshipStyle))
      ];
    };
    const editableSelection = () => selectedObjects()
      .filter(object => !object.locked && !isAnnotationEntityRelationshipSelectionType(object.type));
    const selectedCropImage = () => {
      const selection = selectedObjects();
      return selection.length === 1 && selection[0]?.type === "embedded-image"
        ? selection[0]
        : null;
    };

    const syncControls = () => {
      const selection = selectedObjects();
      const first = selection[0] || null;
      const singleText = selection.length === 1 && first?.type === "textbox" ? first : null;
      const singleEntity = selection.length === 1 && first?.type === "entity" ? first : null;
      const hasSelection = selection.length > 0;
      const hasRelationshipSelection = selection.some(object => isAnnotationEntityRelationshipSelectionType(object.type));
      const annotationCount = selection.filter(object => !isAnnotationEntityRelationshipSelectionType(object.type)).length;
      const allLocked = hasSelection && selection.every(object => object.locked);
      const hasLocked = selection.some(object => object.locked);
      const image = selectedCropImage();
      const containsImage = Boolean(image);
      const imageLocked = image?.locked === true;
      const groupIds = new Set(selection.map(object => object.groupId).filter(Boolean));
      const alreadyOneGroup = groupIds.size === 1
        && selection.every(object => object.groupId && groupIds.has(object.groupId));

      dialog.querySelector("[data-annotation-selection-label]").textContent = !hasSelection
        ? "No selection"
        : selection.length === 1
          ? `${annotationObjectLabel(first)}${first.locked ? " (Locked)" : ""}`
          : `${selection.length} objects selected`;

      const relationshipFormatHint = dialog.querySelector("[data-annotation-relationship-format-hint]");
      if (relationshipFormatHint) {
        relationshipFormatHint.hidden = !hasRelationshipSelection;
        relationshipFormatHint.textContent = first?.type === entityRelationshipObjectType
          ? "Line color, line width, and arrow head apply only to this Entity relationship. Relationship symbols apply to every relationship on the canvas."
          : "Line color, line width, arrow head, and relationship symbols apply to every Entity relationship on this canvas.";
      }
      const relationshipSymbolsField = dialog.querySelector("[data-annotation-relationship-symbols-field]");
      const relationshipShowSymbols = dialog.querySelectorAll(
        "[data-annotation-relationship-show-symbols], [data-annotation-entity-relationship-show-symbols]"
      );
      if (relationshipSymbolsField) relationshipSymbolsField.hidden = !hasRelationshipSelection;
      relationshipShowSymbols.forEach(control => {
        control.checked = state.relationshipStyle.showSymbols === true;
      });
      const fillColorField = dialog.querySelector("[data-annotation-color-picker='fill']")
        ?.closest(".image-annotation-color-field");
      if (fillColorField) fillColorField.hidden = hasRelationshipSelection;
      const strokeColorField = dialog.querySelector("[data-annotation-color-picker='stroke']")
        ?.closest(".image-annotation-color-field");
      const strokeColorLabel = strokeColorField?.querySelector(":scope > span");
      if (strokeColorLabel) strokeColorLabel.textContent = hasRelationshipSelection ? "Line color" : "Outline color";
      const strokeColorTrigger = strokeColorField?.querySelector("[data-annotation-color-trigger]");
      if (strokeColorTrigger) {
        strokeColorTrigger.title = hasRelationshipSelection ? "Line Color" : "Outline Color";
        strokeColorTrigger.setAttribute("aria-label", strokeColorTrigger.title);
      }
      const textFormatSection = dialog.querySelector("[aria-labelledby='imageAnnotationTextFormat']");
      if (textFormatSection) textFormatSection.hidden = hasRelationshipSelection;

      setControlValue(textInput, singleText?.text || "");
      textInput.disabled = !singleText || singleText.locked;
      dialog.querySelector("[data-annotation-text-field]").hidden = !singleText;
      entityInspectorTab.hidden = !singleEntity;
      if (!singleEntity && activeInspectorTab === "entity") setInspectorTab("format");
      else setInspectorTab(activeInspectorTab);
      entityInspectorPanel.setAttribute("aria-label", singleEntity
        ? `${annotationObjectLabel(singleEntity)} Entity settings`
        : "Entity settings");
      const showKeyColumn = dialog.querySelector("[data-annotation-entity-show-keys]");
      const showDataTypes = dialog.querySelector("[data-annotation-entity-show-data-types]");
      const foreignKeysAtTop = dialog.querySelector("[data-annotation-entity-fk-at-top]");
      const showSelfRelationships = dialog.querySelector("[data-annotation-entity-show-self-relationships]");
      const entityRelationshipShowSymbols = dialog.querySelector("[data-annotation-entity-relationship-show-symbols]");
      const hideAllEntityRelationships = dialog.querySelector("[data-annotation-entity-hide-all-relationships]");
      const unanchorAllEntities = dialog.querySelector("[data-annotation-entity-unanchor-all]");
      const anchorTable = dialog.querySelector("[data-annotation-entity-anchor-table]");
      const allowOverlappingLines = dialog.querySelector("[data-annotation-entity-allow-overlapping-lines]");
      const autoFormatOrgTree = dialog.querySelector("[data-annotation-entity-auto-format-org-tree]");
      const generatePmtSchema = dialog.querySelector("[data-annotation-generate-pmt-schema]");
      showKeyColumn.checked = singleEntity?.showKeyColumn !== false;
      showDataTypes.checked = singleEntity?.showDataTypes === true;
      foreignKeysAtTop.checked = singleEntity?.foreignKeysAtTop === true;
      showSelfRelationships.checked = singleEntity?.showSelfRelationships === true;
      entityRelationshipShowSymbols.checked = state.relationshipStyle.showSymbols === true;
      hideAllEntityRelationships.checked = state.hideAllEntityRelationships === true;
      anchorTable.checked = singleEntity?.anchorTable === true;
      allowOverlappingLines.checked = state.allowOverlappingEntityLines === true;
      showKeyColumn.disabled = !singleEntity || singleEntity.locked;
      showDataTypes.disabled = !singleEntity || singleEntity.locked;
      foreignKeysAtTop.disabled = !singleEntity || singleEntity.locked;
      showSelfRelationships.disabled = !singleEntity || singleEntity.locked;
      entityRelationshipShowSymbols.disabled = !singleEntity;
      hideAllEntityRelationships.disabled = !singleEntity;
      anchorTable.disabled = !singleEntity || singleEntity.locked;
      allowOverlappingLines.disabled = !singleEntity;
      const canvasEntities = state.objects.filter(object => object.type === "entity");
      const globalUnanchorState = annotationEntityGlobalUnanchorControlState(state);
      unanchorAllEntities.checked = globalUnanchorState.checked;
      unanchorAllEntities.indeterminate = globalUnanchorState.indeterminate;
      unanchorAllEntities.disabled = globalUnanchorState.disabled;
      autoFormatOrgTree.disabled = !singleEntity
        || canvasEntities.length < 2
        || canvasEntities.some(entity => entity.locked);
      if (generatePmtSchema) generatePmtSchema.disabled = pmtSchemaBusy;
      const entityFieldScrollTop = entityFieldList.scrollTop;
      entityFieldList.innerHTML = singleEntity ? annotationEntityFieldListHtml(singleEntity) : "";
      entityFieldList.scrollTop = entityFieldScrollTop;
      setControlValue(entityAnnotationInput, singleEntity?.entityAnnotation || "");
      entityAnnotationInput.disabled = !singleEntity || singleEntity.locked;

      const firstOpacityObject = selection.find(object => ["rectangle", "circle", "textbox", "arrow", "line", "entity"].includes(object.type));
      syncStyleControl("fill", first?.fill === "none" ? styles.fill : first?.fill || styles.fill);
      syncStyleControl("stroke", first?.stroke || styles.stroke);
      syncStyleControl("textColor", first?.textColor || styles.textColor);
      syncStyleControl("entityNameTextColor", singleEntity?.entityNameTextColor || styles.entityNameTextColor);
      syncStyleControl("entityHeaderFill", singleEntity?.entityHeaderFill || styles.entityHeaderFill);
      syncStyleControl("fontFamily", first?.fontFamily || styles.fontFamily);
      syncStyleControl("fontSize", first?.fontSize || styles.fontSize);
      syncStyleControl("textAlign", first?.textAlign || styles.textAlign);
      syncStyleControl("textVerticalAlign", first?.textVerticalAlign || styles.textVerticalAlign);
      syncStyleControl("opacity", Math.round((firstOpacityObject?.opacity ?? styles.opacity) * 100));
      syncStyleControl("strokeWidth", first?.strokeWidth || styles.strokeWidth);
      syncStyleControl("arrowSize", first?.arrowSize || styles.arrowSize);
      const opacityControl = dialog.querySelector("[data-annotation-style='opacity']");
      if (opacityControl) {
        opacityControl.disabled = hasSelection
          && !selection.some(object => ["rectangle", "circle", "textbox", "arrow", "line", "entity"].includes(object.type) && !object.locked);
      }
      const outlineObjects = selection.filter(object => ["rectangle", "circle", "textbox", "entity"].includes(object.type));
      const outline = dialog.querySelector("[data-annotation-outline]");
      const outlineLabel = outline?.closest("label");
      if (outlineLabel) outlineLabel.hidden = hasRelationshipSelection;
      outline.checked = outlineObjects.length
        ? outlineObjects.every(object => object.outlineVisible !== false)
        : styles.outlineVisible !== false;
      outline.indeterminate = outlineObjects.some(object => object.outlineVisible === false)
        && outlineObjects.some(object => object.outlineVisible !== false);
      outline.disabled = !outlineObjects.some(object => !object.locked);
      const transparent = dialog.querySelector("[data-annotation-transparent-fill]");
      const transparentLabel = transparent?.closest("label");
      if (transparentLabel) transparentLabel.hidden = hasRelationshipSelection;
      transparent.checked = first?.fill === "none";
      transparent.disabled = !selection.some(object => ["rectangle", "circle", "textbox", "entity"].includes(object.type));
      const opacityLabel = opacityControl?.closest("label");
      if (opacityLabel) opacityLabel.hidden = hasRelationshipSelection;

      dialog.querySelectorAll("[data-annotation-requires-selection]").forEach(button => {
        button.disabled = !hasSelection;
      });
      dialog.querySelector("[data-annotation-action='delete']").disabled = annotationCount === 0;
      dialog.querySelector("button[data-annotation-tool='crop']").disabled = !image || imageLocked;
      dialog.querySelector("[data-annotation-context-tool='crop']").disabled = !image || imageLocked;
      dialog.querySelector("[data-annotation-action='group']").disabled = hasRelationshipSelection || selection.length < 2 || hasLocked || alreadyOneGroup;
      dialog.querySelector("[data-annotation-action='ungroup']").disabled = hasRelationshipSelection || groupIds.size === 0 || hasLocked;
      ["back", "backward", "forward", "front"].forEach(action => {
        dialog.querySelector(`[data-annotation-action='${action}']`).disabled = hasRelationshipSelection || annotationCount === 0 || hasLocked;
      });
      const lockButton = dialog.querySelector("[data-annotation-action='lock']");
      const lockLabel = lockButton.querySelector(".dropdown-menu-label");
      if (lockLabel) lockLabel.textContent = allLocked ? "Unlock" : "Lock";
      else lockButton.textContent = allLocked ? "Unlock" : "Lock";
      lockButton.title = allLocked ? "Unlock selected objects" : "Lock selected objects";
      lockButton.setAttribute("aria-label", lockButton.title);
      lockButton.disabled = !hasSelection || hasRelationshipSelection;
      dialog.querySelector("[data-annotation-action='reset-crop']").disabled = !containsImage
        || imageLocked
        || !annotationImageHasReversibleCrop(state, image);
      dialog.querySelector("[data-annotation-action='undo']").disabled = historyIndex <= 0;
      dialog.querySelector("[data-annotation-action='redo']").disabled = historyIndex >= history.length - 1;
      zoomSelect.value = String(Math.round(zoom * 100));
      dialog.querySelector("[data-annotation-grid]").checked = state.gridVisible;
      dialog.querySelector("[data-annotation-snap]").checked = state.snapToGrid;
      const saveTemplateButton = dialog.querySelector("[data-annotation-template-save]");
      if (saveTemplateButton) saveTemplateButton.disabled = !hasSelection || templateBusy || !templateLibraryAvailable;
      const uploadTemplateButton = dialog.querySelector("[data-annotation-template-upload]");
      if (uploadTemplateButton) uploadTemplateButton.disabled = templateBusy
        || !templateLibraryAvailable
        || templateLibrary.templates.length >= maximumAnnotationTemplates;
      const selectedArrow = selection.length === 1 && first?.type === "arrow" && !first.locked;
      const selectedRectangle = selection.length === 1 && first?.type === "rectangle" && !first.locked;
      const setArrowDefault = dialog.querySelector("[data-annotation-template-default='arrow']");
      const setRectangleDefault = dialog.querySelector("[data-annotation-template-default='rectangle']");
      if (setArrowDefault) setArrowDefault.disabled = !selectedArrow || templateBusy || !templateLibraryAvailable;
      if (setRectangleDefault) setRectangleDefault.disabled = !selectedRectangle || templateBusy || !templateLibraryAvailable;
      const resetArrowDefault = dialog.querySelector("[data-annotation-template-reset-default='arrow']");
      const resetRectangleDefault = dialog.querySelector("[data-annotation-template-reset-default='rectangle']");
      if (resetArrowDefault) resetArrowDefault.disabled = !templateLibrary.defaults.arrow || templateBusy || !templateLibraryAvailable;
      if (resetRectangleDefault) resetRectangleDefault.disabled = !templateLibrary.defaults.rectangle || templateBusy || !templateLibraryAvailable;
      dialog.querySelectorAll("[data-annotation-template-action]").forEach(button => {
        button.disabled = templateBusy || !templateLibraryAvailable
          || (button.dataset.annotationTemplateAction === "restore-defaults" && !defaultTemplateLibraryAvailable)
          || button.dataset.annotationTemplateBoundaryDisabled === "true";
      });
      const selectedTreeTarget = resolveSelectedTreeTarget();
      const treeRenameButton = dialog.querySelector("[data-annotation-tree-action='rename']");
      const treeCopyButton = dialog.querySelector("[data-annotation-tree-action='copy']");
      const treePasteButton = dialog.querySelector("[data-annotation-tree-action='paste']");
      const treeDeleteButton = dialog.querySelector("[data-annotation-tree-action='delete']");
      if (treeRenameButton) treeRenameButton.disabled = !selectedTreeTarget
        || ["relationships", "relationship"].includes(selectedTreeTarget.kind);
      if (treeCopyButton) treeCopyButton.disabled = !hasSelection || hasRelationshipSelection;
      if (treePasteButton) treePasteButton.disabled = !nativeClipboard;
      if (treeDeleteButton) treeDeleteButton.disabled = !selection.some(object => !isAnnotationEntityRelationshipSelectionType(object.type)
        && object.isOriginalImage !== true
        && !object.locked);
      const rootDropButton = dialog.querySelector("[data-annotation-tree-root-drop]");
      if (rootDropButton) {
        const canMoveToRoot = treeTargetCanMoveToRoot(selectedTreeTarget);
        rootDropButton.setAttribute("aria-disabled", String(!canMoveToRoot));
        rootDropButton.classList.toggle("is-disabled", !canMoveToRoot);
      }
    };

    const syncStyleControl = (name, value) => {
      const colorPicker = dialog.querySelector(`[data-annotation-color-picker='${name}']`);
      if (colorPicker) {
        colorPicker.style.setProperty("--rich-selected-color", String(value));
        const trigger = colorPicker.querySelector("[data-annotation-color-trigger]");
        if (trigger) trigger.dataset.richSelectedColor = String(value);
        return;
      }
      const control = dialog.querySelector(`[data-annotation-style='${name}']`);
      if (control) setControlValue(control, String(value));
    };

    const renderObjectTree = () => {
      if (!objectTree) return;
      pruneAnnotationGroupMetadata(state);
      objectTree.innerHTML = annotationObjectTreeHtml(
        filterAnnotationObjectTree(buildAnnotationObjectTree(state), objectTreeSearchQuery),
        selectedIds,
        objectTreeSearchQuery.trim() ? "No matching objects." : "No canvas objects."
      );
    };

    let canvasWorkspaceOffset = null;
    let workspaceClientRect = null;
    let zoomHandles = [];
    let zoomRelationshipSelections = [];
    let zoomRelationshipHits = [];
    let zoomGridPath = null;
    let transientZoomFrame = 0;
    let transientZoomTimer = 0;
    let transientZoomGesture = null;
    let selectionUiSyncToken = 0;

    const refreshZoomTargets = () => {
      zoomHandles = [...canvas.querySelectorAll(".image-annotation-handle")];
      zoomRelationshipSelections = [...canvas.querySelectorAll(".image-annotation-entity-relationship-selection")]
        .map(selection => ({
          selection,
          strokeWidth: positiveNumber(
            selection.dataset.annotationRelationshipStrokeWidth
              || selection.closest("[data-annotation-relationship-stroke-width]")
                ?.dataset.annotationRelationshipStrokeWidth,
            1
          )
        }));
      zoomRelationshipHits = [...canvas.querySelectorAll(".image-annotation-entity-relationship-hit")]
        .map(hit => ({
          hit,
          strokeWidth: positiveNumber(
            hit.closest("[data-annotation-relationship-stroke-width]")
              ?.dataset.annotationRelationshipStrokeWidth,
            1
          )
        }));
      zoomGridPath = canvas.querySelector("#pmt-annotation-grid path");
    };

    const applyCanvasInteractionZoom = effectiveZoom => {
      const handleRadius = formatNumber(3.5 / effectiveZoom);
      zoomHandles.forEach(handle => handle.setAttribute("r", handleRadius));
      if (zoomGridPath) {
        zoomGridPath.setAttribute("stroke-width", formatNumber(Math.max(0.5, 1 / effectiveZoom)));
      }
      zoomRelationshipSelections.forEach(target => {
        target.selection.setAttribute("stroke-width", formatNumber(target.strokeWidth + (4 / effectiveZoom)));
      });
      zoomRelationshipHits.forEach(target => {
        target.hit.setAttribute("stroke-width", formatNumber(Math.max(
            target.strokeWidth + (10 / effectiveZoom),
            14 / effectiveZoom
          )));
      });
    };

    const applyCanvasZoom = () => {
      const effectiveZoom = Math.max(minimumZoom, zoom);
      const displayWidth = formatNumber(workspaceBounds.width * effectiveZoom);
      const displayHeight = formatNumber(workspaceBounds.height * effectiveZoom);
      const plane = annotationSvgPlaneMetrics(
        workspaceBounds.width,
        workspaceBounds.height,
        window.devicePixelRatio
      );
      canvasStage.style.width = `${displayWidth}px`;
      canvasStage.style.height = `${displayHeight}px`;
      canvas.style.width = `${formatNumber(plane.width)}px`;
      canvas.style.height = `${formatNumber(plane.height)}px`;
      canvas.style.transform = `scale(${effectiveZoom / plane.baseScale})`;
      applyCanvasInteractionZoom(effectiveZoom);
      zoomSelect.value = String(Math.round(effectiveZoom * 100));
    };

    const measureWorkspaceClientRect = () => {
      if (!workspaceClientRect) workspaceClientRect = workspace.getBoundingClientRect();
      return workspaceClientRect;
    };

    const measureCanvasWorkspaceOffset = () => {
      if (canvasWorkspaceOffset) return canvasWorkspaceOffset;
      const workspaceRect = workspace.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      canvasWorkspaceOffset = {
        x: canvasRect.left - workspaceRect.left + workspace.scrollLeft,
        y: canvasRect.top - workspaceRect.top + workspace.scrollTop
      };
      return canvasWorkspaceOffset;
    };

    const hideCanvasZoomShield = () => {
      zoomShield.classList.remove("is-active");
      zoomShield.hidden = true;
    };

    const showCanvasZoomShield = () => {
      const workspaceRect = measureWorkspaceClientRect();
      zoomShield.style.left = `${formatNumber(workspaceRect.left)}px`;
      zoomShield.style.top = `${formatNumber(workspaceRect.top)}px`;
      zoomShield.style.width = `${formatNumber(workspace.clientWidth)}px`;
      zoomShield.style.height = `${formatNumber(workspace.clientHeight)}px`;
      zoomShield.hidden = false;
      zoomShield.classList.add("is-active");
    };

    const renderTransientCanvasZoom = timestamp => {
      transientZoomFrame = 0;
      if (!transientZoomGesture) return;
      const gesture = transientZoomGesture;
      const frameTime = finiteNumber(timestamp, performance.now());
      const elapsed = clampNumber(frameTime - gesture.lastFrameAt, 1, 50);
      const blend = 1 - Math.exp(-elapsed / annotationZoomSmoothingMilliseconds);
      gesture.lastFrameAt = frameTime;
      gesture.displayZoom += (gesture.targetZoom - gesture.displayZoom) * blend;
      gesture.displayScrollLeft += (gesture.targetScrollLeft - gesture.displayScrollLeft) * blend;
      gesture.displayScrollTop += (gesture.targetScrollTop - gesture.displayScrollTop) * blend;
      const zoomRemaining = Math.abs(gesture.targetZoom - gesture.displayZoom);
      const scrollRemaining = Math.max(
        Math.abs(gesture.targetScrollLeft - gesture.displayScrollLeft),
        Math.abs(gesture.targetScrollTop - gesture.displayScrollTop)
      );
      const complete = zoomRemaining < 0.00005 && scrollRemaining < 0.1;
      if (complete) {
        gesture.displayZoom = gesture.targetZoom;
        gesture.displayScrollLeft = gesture.targetScrollLeft;
        gesture.displayScrollTop = gesture.targetScrollTop;
      }
      const translateX = gesture.scrollLeft - gesture.displayScrollLeft;
      const translateY = gesture.scrollTop - gesture.displayScrollTop;
      const scale = gesture.displayZoom / gesture.planeScale;
      canvas.style.transform = `translate3d(${formatNumber(translateX)}px, ${formatNumber(translateY)}px, 0) scale(${scale})`;
      if (!complete) {
        transientZoomFrame = window.requestAnimationFrame(renderTransientCanvasZoom);
      } else if (gesture.inputIdle) {
        settleCanvasZoom();
      }
    };

    let suppressWorkspaceZoomScroll = false;
    const scrollWorkspaceTo = (left, top) => {
      suppressWorkspaceZoomScroll = true;
      if (typeof workspace.scrollTo === "function") workspace.scrollTo(left, top);
      else {
        workspace.scrollLeft = left;
        workspace.scrollTop = top;
      }
      window.requestAnimationFrame(() => {
        suppressWorkspaceZoomScroll = false;
      });
    };

    const settleCanvasZoom = () => {
      if (!transientZoomGesture) return;
      const gesture = transientZoomGesture;
      transientZoomGesture = null;
      if (transientZoomFrame) window.cancelAnimationFrame(transientZoomFrame);
      if (transientZoomTimer) window.clearTimeout(transientZoomTimer);
      transientZoomFrame = 0;
      transientZoomTimer = 0;
      applyCanvasZoom();
      scrollWorkspaceTo(gesture.targetScrollLeft, gesture.targetScrollTop);
      hideCanvasZoomShield();
      canvas.classList.remove("is-zooming");
      canvas.style.willChange = "";
    };

    const settleCanvasZoomAtCurrentDisplay = () => {
      if (!transientZoomGesture) return;
      const gesture = transientZoomGesture;
      const currentZoom = Math.round(
        clampNumber(gesture.displayZoom, minimumZoom, maximumZoom) / annotationZoomStep
      ) * annotationZoomStep;
      const currentView = zoomAnnotationAtPoint({
        oldZoom: gesture.displayZoom,
        newZoom: currentZoom,
        scrollLeft: gesture.displayScrollLeft,
        scrollTop: gesture.displayScrollTop,
        pointX: gesture.pointX,
        pointY: gesture.pointY,
        contentOffsetX: gesture.contentOffset.x,
        contentOffsetY: gesture.contentOffset.y
      });
      const maximumScrollLeft = Math.max(
        0,
        gesture.contentOffset.x
          + (workspaceBounds.width * currentZoom)
          + gesture.paddingRight
          - gesture.viewportWidth
      );
      const maximumScrollTop = Math.max(
        0,
        gesture.contentOffset.y
          + (workspaceBounds.height * currentZoom)
          + gesture.paddingBottom
          - gesture.viewportHeight
      );
      gesture.targetZoom = currentZoom;
      gesture.targetScrollLeft = clampNumber(currentView.scrollLeft, 0, maximumScrollLeft);
      gesture.targetScrollTop = clampNumber(currentView.scrollTop, 0, maximumScrollTop);
      zoom = currentZoom;
      settleCanvasZoom();
    };

    const queueCanvasZoom = (nextZoom, pointX, pointY) => {
      const steppedZoom = Math.round(clampNumber(nextZoom, minimumZoom, maximumZoom) / annotationZoomStep)
        * annotationZoomStep;
      if (Math.abs(steppedZoom - zoom) < 0.000001) return;
      if (!transientZoomGesture) {
        const contentOffset = measureCanvasWorkspaceOffset();
        const plane = annotationSvgPlaneMetrics(
          workspaceBounds.width,
          workspaceBounds.height,
          window.devicePixelRatio
        );
        transientZoomGesture = {
          zoom,
          planeScale: plane.baseScale,
          scrollLeft: workspace.scrollLeft,
          scrollTop: workspace.scrollTop,
          pointX,
          pointY,
          contentOffset,
          viewportWidth: workspace.clientWidth,
          viewportHeight: workspace.clientHeight,
          paddingRight: finiteNumber(window.parseFloat(window.getComputedStyle(workspace).paddingRight), 0),
          paddingBottom: finiteNumber(window.parseFloat(window.getComputedStyle(workspace).paddingBottom), 0),
          targetZoom: zoom,
          targetScrollLeft: workspace.scrollLeft,
          targetScrollTop: workspace.scrollTop,
          displayZoom: zoom,
          displayScrollLeft: workspace.scrollLeft,
          displayScrollTop: workspace.scrollTop,
          lastFrameAt: performance.now(),
          inputIdle: false
        };
        showCanvasZoomShield();
        canvas.classList.add("is-zooming");
      }
      const gesture = transientZoomGesture;
      const nextView = zoomAnnotationAtPoint({
        oldZoom: gesture.targetZoom,
        newZoom: steppedZoom,
        scrollLeft: gesture.targetScrollLeft,
        scrollTop: gesture.targetScrollTop,
        pointX,
        pointY,
        contentOffsetX: gesture.contentOffset.x,
        contentOffsetY: gesture.contentOffset.y
      });
      const maximumScrollLeft = Math.max(
        0,
        gesture.contentOffset.x
          + (workspaceBounds.width * nextView.zoom)
          + gesture.paddingRight
          - gesture.viewportWidth
      );
      const maximumScrollTop = Math.max(
        0,
        gesture.contentOffset.y
          + (workspaceBounds.height * nextView.zoom)
          + gesture.paddingBottom
          - gesture.viewportHeight
      );
      gesture.pointX = pointX;
      gesture.pointY = pointY;
      gesture.targetZoom = nextView.zoom;
      gesture.targetScrollLeft = clampNumber(nextView.scrollLeft, 0, maximumScrollLeft);
      gesture.targetScrollTop = clampNumber(nextView.scrollTop, 0, maximumScrollTop);
      gesture.inputIdle = false;
      zoom = gesture.targetZoom;
      if (!transientZoomFrame) {
        transientZoomFrame = window.requestAnimationFrame(renderTransientCanvasZoom);
      }
      if (transientZoomTimer) window.clearTimeout(transientZoomTimer);
      transientZoomTimer = window.setTimeout(() => {
        if (!transientZoomGesture) return;
        transientZoomGesture.inputIdle = true;
        if (!transientZoomFrame) settleCanvasZoom();
      }, annotationZoomIdleMilliseconds);
    };

    cancelPendingCanvasZoom = () => {
      if (transientZoomFrame) window.cancelAnimationFrame(transientZoomFrame);
      if (transientZoomTimer) window.clearTimeout(transientZoomTimer);
      transientZoomFrame = 0;
      transientZoomTimer = 0;
      transientZoomGesture = null;
      hideCanvasZoomShield();
      canvas.classList.remove("is-zooming");
      canvas.style.transform = "";
      canvas.style.willChange = "";
    };

    disposeCanvasZoom = () => {
      hideCanvasZoomShield();
    };

    if (typeof ResizeObserver === "function") {
      const canvasResizeObserver = new ResizeObserver(() => {
        workspaceClientRect = null;
        canvasWorkspaceOffset = null;
      });
      canvasResizeObserver.observe(workspace);
      disconnectCanvasResizeObserver = () => canvasResizeObserver.disconnect();
    }

    const render = () => {
      selectionUiSyncToken += 1;
      settleCanvasZoom();
      syncAnnotationEntityAnnotationArrows(state);
      const currentRelationships = state.hideAllEntityRelationships
        ? []
        : resolveAnnotationEntityRelationships(annotationVisibleObjects(state));
      if (!currentRelationships.length) {
        selectedIds.delete(entityRelationshipsSelectionId);
      }
      const currentRelationshipIds = new Set(currentRelationships.map(relationship => relationship.id));
      [...selectedIds]
        .filter(id => isAnnotationEntityRelationshipSelectionId(id) && !currentRelationshipIds.has(id))
        .forEach(id => selectedIds.delete(id));
      pruneAnnotationGroupMetadata(state);
      compactAnnotationGroupLayers(state.objects);
      canvas.setAttribute("viewBox", `${formatNumber(workspaceBounds.x)} ${formatNumber(workspaceBounds.y)} ${formatNumber(workspaceBounds.width)} ${formatNumber(workspaceBounds.height)}`);
      canvas.setAttribute("width", formatNumber(workspaceBounds.width));
      canvas.setAttribute("height", formatNumber(workspaceBounds.height));
      canvas.dataset.annotationTransientInvisibleGroup = transientInvisibleSelectionIds.size > 1
        ? "true"
        : "false";
      canvas.innerHTML = annotationCanvasSvg(
        state,
        selectedIds,
        zoom,
        workspaceBounds,
        cropPreview,
        marqueePreview
      );
      refreshZoomTargets();
      applyCanvasZoom();
      canvasWorkspaceOffset = null;
      renderObjectTree();
      syncControls();
      measureCanvasWorkspaceOffset();
    };

    const scheduleSelectionUiSync = () => {
      const token = ++selectionUiSyncToken;
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        if (token !== selectionUiSyncToken || resolved) return;
        renderObjectTree();
        syncControls();
      }));
    };

    const renderSelectionOnly = () => {
      settleCanvasZoom();
      canvas.dataset.annotationTransientInvisibleGroup = transientInvisibleSelectionIds.size > 1
        ? "true"
        : "false";
      canvas.querySelectorAll(
        ".image-annotation-selection-group, .image-annotation-entity-relationship-selection"
      ).forEach(element => element.remove());
      canvas.querySelectorAll(
        ".image-annotation-entity-relationships.is-selected, .image-annotation-entity-relationship.is-selected"
      ).forEach(element => element.classList.remove("is-selected"));
      annotationVisibleObjects(state)
        .filter(object => object.type === "entity" && selectedIds.has(object.id))
        .forEach(object => {
          const element = [...canvas.querySelectorAll("[data-annotation-object-id]")]
            .find(candidate => candidate.dataset.annotationObjectId === object.id);
          if (element) canvas.appendChild(element);
        });
      const markup = annotationSelectionSvg(
        annotationVisibleObjects(state).filter(object => selectedIds.has(object.id)),
        zoom
      );
      if (markup) canvas.insertAdjacentHTML("beforeend", markup);
      zoomHandles = [...canvas.querySelectorAll(".image-annotation-handle")];
      zoomRelationshipSelections = [];
      applyCanvasInteractionZoom(Math.max(minimumZoom, zoom));
      scheduleSelectionUiSync();
    };

    const prepareMovePreview = currentGesture => {
      const objectElements = [...canvas.querySelectorAll("[data-annotation-object-id]")];
      currentGesture.previewElements = currentGesture.originals.map(original => {
        const element = objectElements.find(candidate => candidate.dataset.annotationObjectId === original.id);
        if (!element) return null;
        const clippedElements = original.type === "entity"
          ? [...element.querySelectorAll("[clip-path]")].map(clippedElement => ({
              element: clippedElement,
              clipPath: clippedElement.getAttribute("clip-path") || ""
            }))
          : [];
        clippedElements.forEach(item => item.element.removeAttribute("clip-path"));
        return {
          element,
          transform: element.getAttribute("transform") || "",
          clippedElements
        };
      }).filter(Boolean);
      const selection = canvas.querySelector(".image-annotation-selection-group");
      currentGesture.previewSelection = selection
        ? { element: selection, transform: selection.getAttribute("transform") || "" }
        : null;
      currentGesture.previewFrame = 0;
      currentGesture.previewDelta = { x: 0, y: 0 };
      const movingEntityIds = new Set(currentGesture.originals
        .filter(original => original.type === "entity")
        .map(original => original.id));
      if (!movingEntityIds.size || state.hideAllEntityRelationships) return;
      const relationshipModel = annotationEntityRelationshipRenderModel(
        annotationVisibleObjects(state),
        state.relationshipStyle,
        { allowOverlappingLines: state.allowOverlappingEntityLines }
      );
      if (!relationshipModel.renderedRelationships.some(item => movingEntityIds.has(item.relationship.source?.id)
        || movingEntityIds.has(item.relationship.target?.id))) return;
      const relationshipLayer = canvas.querySelector(".image-annotation-entity-relationships");
      if (!relationshipLayer) return;
      const overlay = document.createElementNS(svgNamespace, "g");
      overlay.classList.add("image-annotation-move-relationship-preview");
      overlay.setAttribute("pointer-events", "none");
      relationshipLayer.parentNode.insertBefore(overlay, relationshipLayer.nextSibling);
      relationshipLayer.style.visibility = "hidden";
      currentGesture.relationshipPreview = {
        movingEntityIds,
        items: relationshipModel.renderedRelationships,
        relationshipLayer,
        overlay
      };
      renderMoveRelationshipPreview(currentGesture, { x: 0, y: 0 });
    };

    const movePreviewRelationshipPoints = (item, movingEntityIds, delta) => {
      const points = item.geometry.points.map(point => ({ ...point }));
      if (!points.length) return points;
      const sourceMoves = movingEntityIds.has(item.relationship.source?.id);
      const targetMoves = movingEntityIds.has(item.relationship.target?.id);
      if (sourceMoves && targetMoves) {
        return points.map(point => ({ x: point.x + delta.x, y: point.y + delta.y }));
      }
      if (sourceMoves) {
        const start = { x: points[0].x + delta.x, y: points[0].y + delta.y };
        if (points.length === 1) return [start];
        const next = points[1];
        const bridge = points[0].x === next.x
          ? { x: start.x, y: next.y }
          : { x: next.x, y: start.y };
        return compactAnnotationEntityRelationshipPoints([start, bridge, ...points.slice(1)]);
      }
      if (targetMoves) {
        const endIndex = points.length - 1;
        const end = { x: points[endIndex].x + delta.x, y: points[endIndex].y + delta.y };
        if (points.length === 1) return [end];
        const previous = points[endIndex - 1];
        const bridge = previous.x === points[endIndex].x
          ? { x: end.x, y: previous.y }
          : { x: previous.x, y: end.y };
        return compactAnnotationEntityRelationshipPoints([...points.slice(0, -1), bridge, end]);
      }
      return points;
    };

    const renderMoveRelationshipPreview = (currentGesture, delta) => {
      const preview = currentGesture.relationshipPreview;
      if (!preview) return;
      const adjusted = preview.items.map(item => {
        const points = movePreviewRelationshipPoints(item, preview.movingEntityIds, delta);
        return {
          ...item,
          geometry: {
            ...item.geometry,
            points,
            path: annotationEntityRelationshipPath(points)
          }
        };
      });
      preview.overlay.innerHTML = annotationEntityRelationshipMergedRouteGroups(adjusted)
        .map(group => `<path d="${group.path}" fill="none" stroke="${escapeXmlAttr(group.style.stroke)}" stroke-width="${formatNumber(group.style.strokeWidth)}" stroke-linejoin="round"></path>`)
        .join("");
    };

    const applyMovePreview = currentGesture => {
      currentGesture.previewFrame = 0;
      const delta = currentGesture.previewDelta || { x: 0, y: 0 };
      const translation = `translate(${formatNumber(delta.x)} ${formatNumber(delta.y)})`;
      (currentGesture.previewElements || []).forEach(preview => {
        preview.element.setAttribute("transform", preview.transform ? `${preview.transform} ${translation}` : translation);
      });
      const selection = currentGesture.previewSelection;
      if (selection) {
        selection.element.setAttribute("transform", selection.transform ? `${selection.transform} ${translation}` : translation);
      }
      renderMoveRelationshipPreview(currentGesture, delta);
    };

    const scheduleMovePreview = (currentGesture, delta) => {
      currentGesture.previewDelta = { x: delta.x, y: delta.y };
      if (currentGesture.previewFrame) return;
      currentGesture.previewFrame = window.requestAnimationFrame(() => applyMovePreview(currentGesture));
    };

    const stopMovePreview = (currentGesture, restore = false) => {
      if (currentGesture.previewFrame) window.cancelAnimationFrame(currentGesture.previewFrame);
      currentGesture.previewFrame = 0;
      if (currentGesture.relationshipPreview) {
        currentGesture.relationshipPreview.relationshipLayer.style.visibility = "";
        currentGesture.relationshipPreview.overlay.remove();
        currentGesture.relationshipPreview = null;
      }
      if (!restore) return;
      (currentGesture.previewElements || []).forEach(preview => {
        if (preview.transform) preview.element.setAttribute("transform", preview.transform);
        else preview.element.removeAttribute("transform");
        (preview.clippedElements || []).forEach(item => {
          if (item.clipPath) item.element.setAttribute("clip-path", item.clipPath);
        });
      });
      const selection = currentGesture.previewSelection;
      if (selection) {
        if (selection.transform) selection.element.setAttribute("transform", selection.transform);
        else selection.element.removeAttribute("transform");
      }
    };

    const focusLastSelectedObject = () => {
      const selectedId = selectedIds.has(lastSelectedObjectId)
        ? lastSelectedObjectId
        : [...selectedIds].at(-1);
      const selectedElement = selectedId
        ? [...canvas.querySelectorAll("[data-annotation-object-id]")]
            .find(element => element.dataset.annotationObjectId === selectedId)
        : null;
      if (!selectedElement) {
        workspace.focus({ preventScroll: true });
        return;
      }
      lastSelectedObjectId = selectedId;
      selectedElement.setAttribute("tabindex", "-1");
      selectedElement.focus({ preventScroll: true });
    };

    const renderWithWorkspaceExpansion = () => {
      const previous = workspaceBounds;
      const next = annotationExpandedWorkspaceBounds(
        previous,
        state,
        workspace.clientWidth,
        workspace.clientHeight
      );
      const changed = !annotationBoundsEqual(previous, next);
      if (changed) workspaceBounds = next;
      render();
      if (changed) {
        scrollWorkspaceTo(
          workspace.scrollLeft + ((previous.x - next.x) * zoom),
          workspace.scrollTop + ((previous.y - next.y) * zoom),
          true
        );
      }
    };

    const restoreHistory = nextIndex => {
      if (nextIndex < 0 || nextIndex >= history.length) return;
      historyIndex = nextIndex;
      const restoredState = JSON.parse(history[historyIndex]);
      restoreAnnotationEmbeddedSources(restoredState.objects, embeddedSources);
      state = normalizeAnnotationState(restoredState, {
        width: state.width,
        height: state.height,
        originalReference
      });
      selectedIds.clear();
      gesture = null;
      marqueePreview = null;
      renderWithWorkspaceExpansion();
      workspace.focus({ preventScroll: true });
    };

    const pushHistory = () => {
      if (historyTimer) {
        window.clearTimeout(historyTimer);
        historyTimer = 0;
      }
      const snapshot = annotationSnapshot(state, embeddedSources);
      if (history[historyIndex] === snapshot) return;
      history = history.slice(0, historyIndex + 1);
      history.push(snapshot);
      if (history.length > 100) history.shift();
      historyIndex = history.length - 1;
      syncControls();
    };

    const scheduleHistory = () => {
      if (historyTimer) window.clearTimeout(historyTimer);
      historyTimer = window.setTimeout(pushHistory, 350);
    };

    const activateCropTool = async () => {
      if (cropBusy) return;
      let cropTemporarilyShown = false;
      const image = selectedCropImage();
      if (!image) {
        setTool("select");
        setStatus("Select one image before cropping it.");
        return;
      }
      if (image.locked) {
        setTool("select");
        setStatus("Unlock the image before cropping it.");
        return;
      }
      if (!annotationImageHasReversibleCrop(state, image)) {
        setTool("crop");
        workspace.focus({ preventScroll: true });
        return;
      }

      cropBusy = true;
      setTool("select");
      try {
        const choice = await openAnnotationCropOptionsDialog();
        if (choice === "remove") {
          pushHistory();
          resetAnnotationCrop(state, image);
          pushHistory();
          setStatus("Crop removed. The full source is visible again.");
          renderWithWorkspaceExpansion();
          workspace.focus({ preventScroll: true });
          return;
        }
        if (choice !== "permanent") {
          setStatus("Crop left unchanged.");
          workspace.focus({ preventScroll: true });
          return;
        }
        const cropWasVisible = image.cropVisible !== false;
        if (!cropWasVisible) {
          setAnnotationImageCropVisibility(state, true, image);
          cropTemporarilyShown = true;
          setStatus("The saved crop is shown so you can verify the pixels that will remain.");
          renderWithWorkspaceExpansion();
        }
        if (!await openAnnotationPermanentCropWarningDialog()) {
          if (cropTemporarilyShown) {
            setAnnotationImageCropVisibility(state, false, image);
            cropTemporarilyShown = false;
            renderWithWorkspaceExpansion();
          }
          setStatus("Crop left unchanged.");
          workspace.focus({ preventScroll: true });
          return;
        }

        setStatus("Applying the crop permanently...");
        const cropped = await permanentlyCropAnnotationImage(state, image.id);
        embeddedSources.set(image.id, cropped.dataUrl);
        if (image.isOriginalImage && typeof context.persistCroppedOriginal === "function") {
          pendingPermanentCrop = {
            blob: cropped.blob,
            fileName: annotationPermanentCropFileName(context.originalFileName),
            reference: ""
          };
        }
        cropTemporarilyShown = false;
        if (historyTimer) {
          window.clearTimeout(historyTimer);
          historyTimer = 0;
        }
        history = [annotationSnapshot(state, embeddedSources)];
        historyIndex = 0;
        selectedIds = new Set([image.id]);
        lastSelectedObjectId = image.id;
        setStatus(pendingPermanentCrop
          ? "Crop permanently applied. The previous image source will become an orphan after you save the record."
          : "Crop permanently applied to this Diagram image.");
        renderWithWorkspaceExpansion();
        focusLastSelectedObject();
      } catch (error) {
        if (cropTemporarilyShown) setAnnotationImageCropVisibility(state, false, image);
        setStatus(error?.message || "The crop could not be applied permanently.");
        renderWithWorkspaceExpansion();
        workspace.focus({ preventScroll: true });
      } finally {
        cropBusy = false;
      }
    };

    const clearEntityRelationshipSelection = () => {
      [...selectedIds]
        .filter(id => id === entityRelationshipsSelectionId || isAnnotationEntityRelationshipSelectionId(id))
        .forEach(id => selectedIds.delete(id));
    };

    const selectObject = (object, additive = false) => {
      transientInvisibleSelectionIds.clear();
      clearEntityRelationshipSelection();
      const ids = annotationSelectionIdsForObject(state.objects, object, state.groupVisibility);
      if (!additive) selectedIds.clear();
      const shouldRemove = additive && ids.every(id => selectedIds.has(id));
      ids.forEach(id => shouldRemove ? selectedIds.delete(id) : selectedIds.add(id));
      lastSelectedObjectId = selectedIds.has(object.id)
        ? object.id
        : [...selectedIds].at(-1) || "";
    };

    const selectEntityRelationships = () => {
      if (state.hideAllEntityRelationships) return false;
      if (!resolveAnnotationEntityRelationships(annotationVisibleObjects(state)).length) return false;
      selectedIds = new Set([entityRelationshipsSelectionId]);
      lastSelectedObjectId = entityRelationshipsSelectionId;
      lastTreeSelectionKey = `relationships:${entityRelationshipsSelectionId}`;
      setTool("select");
      setStatus("Entity Relationships selected. Use Format to change every connector line and arrow.");
      return true;
    };

    const selectEntityRelationship = relationshipId => {
      if (state.hideAllEntityRelationships) return false;
      const relationship = resolveAnnotationEntityRelationships(annotationVisibleObjects(state))
        .find(candidate => candidate.id === relationshipId);
      if (!relationship) return false;
      selectedIds = new Set([relationship.id]);
      lastSelectedObjectId = relationship.id;
      lastTreeSelectionKey = `relationship:${relationship.id}`;
      setTool("select");
      setStatus(`${annotationEntityRelationshipName(relationship)} selected. Use Format to style only this connector.`);
      return true;
    };

    const openAnnotationContextMenuAt = (point, refreshSelection = false) => {
      setTool("select");
      if (refreshSelection) render();
      positionAnnotationContextMenu(point);
      contextMenu.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
      const guardToken = ++contextMenuScrollGuardToken;
      contextMenuScrollGuardActive = true;
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        if (contextMenuScrollGuardToken === guardToken) contextMenuScrollGuardActive = false;
      }));
    };

    const showAnnotationContextMenu = event => {
      event.preventDefault();
      event.stopPropagation();
      closeAnnotationContextMenu();

      const objectElement = event.target.closest?.("[data-annotation-object-id]");
      const object = state.objects.find(item => item.id === objectElement?.dataset.annotationObjectId);
      const selectionHandle = event.target.closest?.("[data-annotation-handle]");
      const refreshSelection = Boolean(object && !selectedIds.has(object.id));
      if (refreshSelection) selectObject(object);
      if (!object && !selectionHandle) return;
      if (!selectedIds.size) return;

      openAnnotationContextMenuAt({ clientX: event.clientX, clientY: event.clientY }, refreshSelection);
    };

    const addObject = (type, point) => {
      objectSequence += 1;
      const id = `${type}-${Date.now().toString(36)}-${objectSequence}`;
      const base = {
        id,
        type,
        locked: false,
        groupId: ""
      };
      if (["arrow", "line"].includes(type)) {
        const preset = templateLibrary.defaults.arrow || annotationFactoryDrawingDefault("arrow");
        const connector = {
          ...base,
          x1: point.x,
          y1: point.y,
          x2: point.x,
          y2: point.y,
          stroke: preset.stroke,
          strokeWidth: preset.strokeWidth,
          opacity: preset.opacity ?? styles.opacity
        };
        if (type === "arrow") connector.arrowSize = preset.arrowSize;
        return connector;
      }
      if (type === "entity") {
        return {
          ...base,
          x: point.x,
          y: point.y,
          width: 1,
          height: 1,
          fill: defaultEntityFill,
          stroke: defaultEntityStroke,
          outlineVisible: true,
          strokeWidth: 2,
          opacity: 1,
          textColor: defaultEntityTextColor,
          entityNameTextColor: defaultEntityTextColor,
          entityHeaderFill: defaultEntityFill,
          fontFamily: styles.fontFamily,
          fontSize: defaultEntityFontSize,
          entitySchema: "",
          entityName: "Entity",
          fields: [],
          foreignKeys: [],
          foreignKeysAtTop: false,
          showSelfRelationships: false,
          anchorTable: false,
          collapsed: false,
          expandedHeight: 1,
          sourceText: "",
          entityAnnotation: "",
          entityAnnotationGroupId: "",
          showKeyColumn: defaultEntityShowKeyColumn,
          showDataTypes: defaultEntityShowDataTypes,
          dataTypeExpandedWidth: defaultEntityWidth
        };
      }
      const rectanglePreset = ["rectangle", "circle"].includes(type)
        ? templateLibrary.defaults.rectangle || annotationFactoryDrawingDefault("rectangle")
        : null;
      return {
        ...base,
        x: point.x,
        y: point.y,
        width: 1,
        height: 1,
        fill: type === "textbox" ? styles.fill : rectanglePreset?.fill || "none",
        stroke: rectanglePreset?.stroke || styles.stroke,
        outlineVisible: rectanglePreset?.outlineVisible ?? styles.outlineVisible,
        strokeWidth: rectanglePreset?.strokeWidth || styles.strokeWidth,
        opacity: rectanglePreset?.opacity ?? styles.opacity,
        text: type === "textbox" ? "Text" : "",
        textColor: styles.textColor,
        fontFamily: styles.fontFamily,
        fontSize: styles.fontSize,
        textAlign: styles.textAlign,
        textVerticalAlign: styles.textVerticalAlign
      };
    };

    const canvasPoint = event => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: workspaceBounds.x + (((event.clientX - rect.left) / Math.max(1, rect.width)) * workspaceBounds.width),
        y: workspaceBounds.y + (((event.clientY - rect.top) / Math.max(1, rect.height)) * workspaceBounds.height)
      };
    };

    const cropPoint = (point, image) => snapAnnotationCropPoint(
      point,
      annotationObjectBounds(image),
      state.snapToGrid,
      state.gridSize
    );

    const startCanvasGesture = event => {
      if (event.button !== 0) return;
      const entityHeaderAction = event.target.closest?.("[data-annotation-entity-header-action]");
      if (entityHeaderAction) {
        event.preventDefault();
        event.stopPropagation();
        activateEntityHeaderAction(entityHeaderAction);
        return;
      }
      workspace.focus({ preventScroll: true });
      const point = canvasPoint(event);
      const handle = event.target.closest?.("[data-annotation-handle]");
      const objectElement = event.target.closest?.("[data-annotation-object-id]");

      if (activeTool === "select"
        && isAnnotationEntityRelationshipSelectionId(objectElement?.dataset.annotationObjectId)) {
        selectEntityRelationship(objectElement.dataset.annotationObjectId);
        render();
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (activeTool === "select"
        && objectElement?.dataset.annotationObjectId === entityRelationshipsSelectionId) {
        selectEntityRelationships();
        render();
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (activeTool === "select" && handle) {
        const selection = editableSelection();
        if (!selection.length || selection.length !== selectedIds.size) {
          setStatus("Unlock the selection before resizing it.");
          return;
        }
        const handleName = handle.dataset.annotationHandle;
        if (handleName === "arrow-base" || handleName === "arrow-tip") {
          const arrow = selection.length === 1 && ["arrow", "line"].includes(selection[0].type) ? selection[0] : null;
          if (!arrow) return;
          gesture = {
            type: "arrow-endpoint",
            pointerId: event.pointerId,
            endpoint: handleName,
            objectId: arrow.id,
            original: deepCopy(arrow)
          };
          canvas.setPointerCapture?.(event.pointerId);
          event.preventDefault();
          return;
        }
        gesture = {
          type: "resize",
          pointerId: event.pointerId,
          direction: handle.dataset.annotationHandle,
          startPoint: point,
          startBounds: annotationSelectionBounds(selection),
          originals: annotationGestureObjects(selection)
        };
        canvas.setPointerCapture?.(event.pointerId);
        event.preventDefault();
        return;
      }

      if (activeTool === "select" && objectElement) {
        const object = state.objects.find(item => item.id === objectElement.dataset.annotationObjectId);
        if (!object) return;
        const additive = event.shiftKey || event.metaKey || (event.ctrlKey && !["arrow", "line"].includes(object.type));
        selectObject(object, additive);
        const selection = editableSelection();
        const objectRemainsSelected = selectedIds.has(object.id);
        if (objectRemainsSelected && !object.locked && selection.length && selection.length === selectedIds.size) {
          gesture = {
            type: "move",
            pointerId: event.pointerId,
            startPoint: point,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startBounds: annotationSelectionBounds(selection),
            originals: annotationMoveGestureObjects(state, selection),
            moved: false
          };
          canvas.setPointerCapture?.(event.pointerId);
        } else if (objectRemainsSelected && object.locked) {
          setStatus("This object is locked. Select Unlock to move or resize it.");
        }
        renderSelectionOnly();
        if (gesture?.type === "move") prepareMovePreview(gesture);
        event.preventDefault();
        return;
      }

      if (activeTool === "select") {
        const additive = event.shiftKey || event.ctrlKey || event.metaKey;
        if (!additive) transientInvisibleSelectionIds.clear();
        const baseIds = additive ? new Set(selectedIds) : new Set();
        selectedIds = new Set(baseIds);
        marqueePreview = null;
        gesture = {
          type: "marquee",
          pointerId: event.pointerId,
          startPoint: point,
          startClientX: event.clientX,
          startClientY: event.clientY,
          baseIds,
          moved: false
        };
        canvas.setPointerCapture?.(event.pointerId);
        render();
        event.preventDefault();
        return;
      }

      if (activeTool === "crop") {
        const image = selectedCropImage();
        if (!image) {
          setTool("select");
          setStatus("Select one image before cropping it.");
          return;
        }
        if (image?.locked) {
          setStatus("Unlock the image before cropping it.");
          return;
        }
        const start = cropPoint(point, image);
        cropPreview = { x: start.x, y: start.y, width: 1, height: 1, imageId: image.id };
        gesture = {
          type: "crop",
          pointerId: event.pointerId,
          startPoint: start,
          imageId: image.id
        };
        canvas.setPointerCapture?.(event.pointerId);
        render();
        event.preventDefault();
        return;
      }

      const start = snappedPoint(point, state);
      if (historyTimer) pushHistory();
      const object = addObject(activeTool, start);
      state.objects.push(object);
      selectedIds = new Set([object.id]);
      lastSelectedObjectId = object.id;
      gesture = {
        type: "create",
        pointerId: event.pointerId,
        objectId: object.id,
        startPoint: start
      };
      canvas.setPointerCapture?.(event.pointerId);
      render();
      event.preventDefault();
    };

    const continueCanvasGesture = event => {
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      const point = canvasPoint(event);
      if (gesture.type === "create") {
        const object = state.objects.find(item => item.id === gesture.objectId);
        if (!object) return;
        updateCreatedObject(object, gesture.startPoint, snappedPoint(point, state));
      } else if (gesture.type === "crop") {
        const image = annotationCropImage(state, gesture.imageId);
        cropPreview = {
          ...normalizedRect(gesture.startPoint, cropPoint(point, image)),
          imageId: gesture.imageId
        };
      } else if (gesture.type === "marquee") {
        gesture.moved = Math.hypot(
          event.clientX - gesture.startClientX,
          event.clientY - gesture.startClientY
        ) >= 3;
        marqueePreview = gesture.moved ? normalizedRect(gesture.startPoint, point) : null;
        const touched = marqueePreview
          ? annotationObjectsIntersectingRect(
              state.objects,
              marqueePreview,
              null,
              state.groupVisibility
            )
          : [];
        selectedIds = new Set([
          ...gesture.baseIds,
          ...touched.map(object => object.id)
        ]);
        lastSelectedObjectId = [...selectedIds].at(-1) || "";
      } else if (gesture.type === "move") {
        const pointerMoved = Math.hypot(
          event.clientX - gesture.startClientX,
          event.clientY - gesture.startClientY
        ) >= 2;
        if (!pointerMoved && !gesture.moved) {
          event.preventDefault();
          return;
        }
        const delta = moveAnnotationObjects(state, gesture, point, event.shiftKey, event.altKey);
        gesture.moved = Math.abs(delta.x) > 0.001 || Math.abs(delta.y) > 0.001;
        scheduleMovePreview(gesture, delta);
        event.preventDefault();
        return;
      } else if (gesture.type === "resize") {
        resizeAnnotationObjects(state, gesture, point, event.ctrlKey);
      } else if (gesture.type === "arrow-endpoint") {
        const object = state.objects.find(item => item.id === gesture.objectId);
        if (object) {
          Object.assign(object, adjustAnnotationArrowEndpoint(
            gesture.original,
            gesture.endpoint,
            point,
            state.snapToGrid,
            state.gridSize
          ));
        }
      }
      render();
      event.preventDefault();
    };

    const finishCanvasGesture = async event => {
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      const completed = gesture;
      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      gesture = null;
      event.preventDefault();
      if (completed.type === "move") {
        const finalDelta = completed.previewDelta || { x: 0, y: 0 };
        completed.moved = Math.abs(finalDelta.x) > 0.001 || Math.abs(finalDelta.y) > 0.001;
        stopMovePreview(completed, !completed.moved);
        if (!completed.moved) {
          setStatus(selectedIds.size === 1 ? "Object selected." : `${selectedIds.size} objects selected.`);
          return;
        }
        const movedEntity = completed.originals
          .map(original => state.objects.find(object => object.id === original.id))
          .find(object => object?.type === "entity");
        if (movedEntity) resolveAnnotationEntitySizeChangeLayout(state, movedEntity);
        pushHistory();
        renderWithWorkspaceExpansion();
        return;
      }
      if (completed.type === "resize") {
        const resizedEntity = completed.originals
          .map(original => state.objects.find(object => object.id === original.id))
          .find(object => object?.type === "entity");
        if (resizedEntity) resolveAnnotationEntitySizeChangeLayout(state, resizedEntity);
      }
      if (completed.type === "create") {
        const object = state.objects.find(item => item.id === completed.objectId);
        ensureCreatedObjectSize(object, state);
        setTool("select");
        if (object?.type === "entity") {
          renderWithWorkspaceExpansion();
          const definition = await openAnnotationEntityDialog();
          if (!definition) {
            const objectIndex = state.objects.findIndex(item => item.id === completed.objectId);
            if (objectIndex >= 0) state.objects.splice(objectIndex, 1);
            selectedIds.delete(completed.objectId);
            lastSelectedObjectId = [...selectedIds].at(-1) || "";
            setStatus("Entity creation canceled.");
            renderWithWorkspaceExpansion();
            return;
          }
          applyAnnotationEntityDefinition(object, definition);
          ensureAnnotationEntitySize(object);
          resolveAnnotationEntitySizeChangeLayout(state, object);
          pushHistory();
          setStatus(`${formatAnnotationEntityIdentifier(object.entitySchema, object.entityName)} added.`);
          renderWithWorkspaceExpansion();
          return;
        }
        if (object?.type === "textbox") {
          window.setTimeout(() => {
            textInput.focus();
            textInput.select();
          }, 0);
        }
      } else if (completed.type === "marquee") {
        if (!completed.moved) {
          selectedIds = new Set(completed.baseIds);
          lastSelectedObjectId = [...selectedIds].at(-1) || "";
        }
        transientInvisibleSelectionIds = completed.moved && selectedIds.size > 1
          ? new Set(selectedIds)
          : new Set();
        marqueePreview = null;
        setStatus(selectedIds.size ? `${selectedIds.size} objects selected.` : "Selection cleared.");
      } else if (completed.type === "crop") {
        if (cropPreview && cropPreview.width >= minimumObjectSize && cropPreview.height >= minimumObjectSize) {
          applyAnnotationCrop(state, cropPreview, completed.imageId);
          selectedIds = new Set([completed.imageId]);
          lastSelectedObjectId = completed.imageId;
          setStatus("Crop applied. Use Reset Crop to restore the full source.");
        } else {
          setStatus("Drag a larger crop area.");
        }
        cropPreview = null;
        setTool("select");
      }
      pushHistory();
      renderWithWorkspaceExpansion();
    };

    canvas.addEventListener("pointerdown", startCanvasGesture);
    canvas.addEventListener("pointermove", continueCanvasGesture);
    canvas.addEventListener("pointerup", finishCanvasGesture);
    canvas.addEventListener("pointercancel", finishCanvasGesture);
    canvas.addEventListener("contextmenu", showAnnotationContextMenu);
    canvas.addEventListener("dblclick", async event => {
      if (event.target.closest?.("[data-annotation-entity-header-action]")) return;
      const objectElement = event.target.closest?.("[data-annotation-object-id]");
      const object = state.objects.find(item => item.id === objectElement?.dataset.annotationObjectId);
      if (object?.type === "entity" && !object.locked) {
        selectObject(object);
        renderWithWorkspaceExpansion();
        const definition = await openAnnotationEntityDialog(object);
        if (!definition) return;
        applyAnnotationEntityDefinition(object, definition);
        ensureAnnotationEntitySize(object);
        resolveAnnotationEntitySizeChangeLayout(state, object);
        pushHistory();
        renderWithWorkspaceExpansion();
        return;
      }
      if (object?.type === "textbox" && !object.locked) {
        event.preventDefault();
        selectObject(object);
        renderWithWorkspaceExpansion();
        focusAnnotationTextEditor();
      }
    });

    workspace.addEventListener("pointerdown", event => {
      if (event.button !== 1) return;
      settleCanvasZoom();
      panGesture = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        scrollLeft: workspace.scrollLeft,
        scrollTop: workspace.scrollTop
      };
      workspace.classList.add("is-panning");
      workspace.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });
    workspace.addEventListener("pointermove", event => {
      const rect = measureWorkspaceClientRect();
      lastZoomPoint = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
      if (!panGesture || panGesture.pointerId !== event.pointerId) return;
      scrollWorkspaceTo(
        panGesture.scrollLeft - (event.clientX - panGesture.startX),
        panGesture.scrollTop - (event.clientY - panGesture.startY)
      );
      event.preventDefault();
    });
    workspace.addEventListener("scroll", () => {
      if (!suppressWorkspaceZoomScroll) settleCanvasZoomAtCurrentDisplay();
    });
    workspace.addEventListener("pointerenter", () => {
      workspaceClientRect = null;
    });
    const finishPan = event => {
      if (!panGesture || panGesture.pointerId !== event.pointerId) return;
      if (workspace.hasPointerCapture?.(event.pointerId)) workspace.releasePointerCapture(event.pointerId);
      panGesture = null;
      workspace.classList.remove("is-panning");
      event.preventDefault();
    };
    workspace.addEventListener("pointerup", finishPan);
    workspace.addEventListener("pointercancel", finishPan);
    workspace.addEventListener("auxclick", event => {
      if (event.button === 1) event.preventDefault();
    });
    workspace.addEventListener("scroll", () => {
      if (!contextMenuScrollGuardActive) closeAnnotationContextMenu();
    });
    const handleCanvasZoomWheel = event => {
      if (!event.ctrlKey) {
        if (!transientZoomGesture) return;
        event.preventDefault();
        settleCanvasZoomAtCurrentDisplay();
        const deltaScale = event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? workspace.clientHeight
            : 1;
        scrollWorkspaceTo(
          workspace.scrollLeft + (event.deltaX * deltaScale),
          workspace.scrollTop + (event.deltaY * deltaScale)
        );
        return;
      }
      event.preventDefault();
      const rect = measureWorkspaceClientRect();
      const pointX = event.clientX - rect.left;
      const pointY = event.clientY - rect.top;
      lastZoomPoint = { x: pointX, y: pointY };
      const direction = event.deltaY < 0 ? 1 : -1;
      queueCanvasZoom(zoom + (direction * annotationZoomStep), pointX, pointY);
    };
    workspace.addEventListener("wheel", handleCanvasZoomWheel, { passive: false });
    zoomShield.addEventListener("wheel", handleCanvasZoomWheel, { passive: false });
    zoomShield.addEventListener("pointerdown", event => {
      if (!zoomShield.classList.contains("is-active")) return;
      settleCanvasZoomAtCurrentDisplay();
      event.preventDefault();
      event.stopPropagation();
    });

    const centerCanvasAtZoom = nextZoom => {
      settleCanvasZoom();
      hideCanvasZoomShield();
      canvas.classList.remove("is-zooming");
      const contentBounds = annotationOutputBounds(state);
      zoom = Math.round(clampNumber(nextZoom, minimumZoom, maximumZoom) / annotationZoomStep)
        * annotationZoomStep;
      applyCanvasZoom();
      const contentOffset = measureCanvasWorkspaceOffset();
      scrollWorkspaceTo(
        contentOffset.x
          + ((contentBounds.x + (contentBounds.width / 2) - workspaceBounds.x) * zoom)
          - (workspace.clientWidth / 2),
        contentOffset.y
          + ((contentBounds.y + (contentBounds.height / 2) - workspaceBounds.y) * zoom)
          - (workspace.clientHeight / 2),
        true
      );
      lastZoomPoint = { x: workspace.clientWidth / 2, y: workspace.clientHeight / 2 };
    };

    const fitCanvas = () => {
      const contentBounds = annotationOutputBounds(state);
      const horizontal = Math.max(1, workspace.clientWidth - 40) / contentBounds.width;
      const vertical = Math.max(1, workspace.clientHeight - 40) / contentBounds.height;
      centerCanvasAtZoom(Math.min(horizontal, vertical));
    };

    const renderTemplateList = () => {
      if (!templateList) return;
      if (!templateLibrary.templates.length) {
        templateList.innerHTML = `<p class="image-annotation-template-empty">No saved templates yet.</p>`;
        return;
      }
      templateList.innerHTML = templateLibrary.templates
        .map((template, index) => annotationTemplateCardHtml(template, index, templateLibrary.templates.length))
        .join("");
    };

    const persistTemplateLibrary = async (nextLibrary, successMessage) => {
      if (templateBusy) return false;
      if (!templateLibraryAvailable) {
        const message = "Template storage is unavailable. Your canvas was not changed.";
        if (templateStatus) templateStatus.textContent = message;
        setStatus(message);
        return false;
      }
      templateBusy = true;
      if (templateStatus) templateStatus.textContent = "Saving templates...";
      syncControls();
      try {
        const normalized = normalizeAnnotationTemplateLibrary(nextLibrary);
        const saved = await context.saveTemplateLibrary(normalized);
        templateLibrary = normalizeAnnotationTemplateLibrary(saved || normalized);
        renderTemplateList();
        if (templateStatus) templateStatus.textContent = successMessage;
        setStatus(successMessage);
        return true;
      } catch (error) {
        const message = error?.message || "The template library could not be saved. Your canvas was not changed.";
        if (templateStatus) templateStatus.textContent = message;
        setStatus(message);
        return false;
      } finally {
        templateBusy = false;
        syncControls();
      }
    };

    const restoreDefaultTemplates = async () => {
      if (templateBusy) return false;
      if (!templateLibraryAvailable || !defaultTemplateLibraryAvailable) {
        const message = "Default template storage is unavailable. Your templates were not changed.";
        if (templateStatus) templateStatus.textContent = message;
        setStatus(message);
        return false;
      }

      templateBusy = true;
      if (templateStatus) templateStatus.textContent = "Checking default templates...";
      syncControls();
      try {
        const defaults = await context.loadDefaultTemplateLibrary();
        const restored = restoreAnnotationDefaultTemplates(templateLibrary, defaults);
        if (restored.capacityExceeded) {
          const message = `Restore needs ${restored.requiredSlots} more template slot${restored.requiredSlots === 1 ? "" : "s"}. Delete that many templates and try again.`;
          if (templateStatus) templateStatus.textContent = message;
          setStatus(message);
          return false;
        }
        if (!restored.addedCount) {
          const message = "All default templates are already in your library.";
          if (templateStatus) templateStatus.textContent = message;
          setStatus(message);
          return true;
        }

        const saved = await context.saveTemplateLibrary(restored.library);
        templateLibrary = normalizeAnnotationTemplateLibrary(saved || restored.library);
        renderTemplateList();
        const message = `${restored.addedCount} default template${restored.addedCount === 1 ? "" : "s"} restored at the top of your library.`;
        if (templateStatus) templateStatus.textContent = message;
        setStatus(message);
        return true;
      } catch (error) {
        const message = error?.message || "The default templates could not be restored. Your templates were not changed.";
        if (templateStatus) templateStatus.textContent = message;
        setStatus(message);
        return false;
      } finally {
        templateBusy = false;
        syncControls();
      }
    };

    const askTemplateName = async (title, currentName) => {
      const value = typeof context.askForText === "function"
        ? await context.askForText("Template name", title, currentName)
        : window.prompt("Template name", currentName);
      return String(value || "").trim().slice(0, 120);
    };

    const saveSelectionAsTemplate = async () => {
      if (!selectedIds.size) return;
      if (templateLibrary.templates.length >= maximumAnnotationTemplates) {
        const message = `You can save up to ${maximumAnnotationTemplates} annotation templates.`;
        if (templateStatus) templateStatus.textContent = message;
        setStatus(message);
        return;
      }
      const name = await askTemplateName("Save Annotation Template", `Template ${templateLibrary.templates.length + 1}`);
      if (!name) return;
      const template = captureAnnotationTemplate(state, selectedIds, "", name);
      if (!template) {
        setStatus("Select one or more canvas objects to create a template.");
        return;
      }
      await persistTemplateLibrary({
        ...templateLibrary,
        templates: [...templateLibrary.templates, template]
      }, `Template “${name}” saved for your PMT account.`);
    };

    const uploadTemplate = async file => {
      if (!file) return;
      if (templateLibrary.templates.length >= maximumAnnotationTemplates) {
        const message = `You can save up to ${maximumAnnotationTemplates} annotation templates.`;
        if (templateStatus) templateStatus.textContent = message;
        setStatus(message);
        return;
      }
      if (file.size > maximumAnnotationTemplateFileBytes) {
        const message = "The template file cannot exceed 50 MiB.";
        if (templateStatus) templateStatus.textContent = message;
        setStatus(message);
        return;
      }
      try {
        const template = parseAnnotationTemplateUpload(await file.text());
        const now = new Date().toISOString();
        template.id = annotationObjectId("template");
        template.createdAt = now;
        template.updatedAt = now;
        await persistTemplateLibrary({
          ...templateLibrary,
          templates: [...templateLibrary.templates, template]
        }, `Template "${template.name}" uploaded.`);
      } catch (error) {
        const message = error?.message || "The template could not be uploaded.";
        if (templateStatus) templateStatus.textContent = message;
        setStatus(message);
      }
    };

    const downloadTemplate = templateId => {
      const template = templateLibrary.templates.find(item => item.id === templateId);
      if (!template) return;
      downloadAnnotationTemplate(template);
      const message = `Template "${template.name}" downloaded.`;
      if (templateStatus) templateStatus.textContent = message;
      setStatus(message);
    };

    const replaceTemplateFromSelection = async templateId => {
      if (!selectedIds.size) {
        setStatus("Select the canvas objects that should replace this template.");
        return;
      }
      const existing = templateLibrary.templates.find(template => template.id === templateId);
      if (!existing) return;
      const replacement = captureAnnotationTemplate(state, selectedIds, "", existing.name);
      if (!replacement) return;
      replacement.id = existing.id;
      replacement.createdAt = existing.createdAt;
      replacement.updatedAt = new Date().toISOString();
      await persistTemplateLibrary({
        ...templateLibrary,
        templates: templateLibrary.templates.map(template => template.id === templateId ? replacement : template)
      }, `Template “${existing.name}” updated from the current selection.`);
    };

    const renameTemplate = async templateId => {
      const existing = templateLibrary.templates.find(template => template.id === templateId);
      if (!existing) return;
      const name = await askTemplateName("Rename Annotation Template", existing.name);
      if (!name || name === existing.name) return;
      await persistTemplateLibrary({
        ...templateLibrary,
        templates: templateLibrary.templates.map(template => template.id === templateId
          ? { ...template, name, updatedAt: new Date().toISOString() }
          : template)
      }, `Template renamed to “${name}”.`);
    };

    const deleteTemplate = async templateId => {
      const existing = templateLibrary.templates.find(template => template.id === templateId);
      if (!existing) return;
      const confirmed = typeof context.confirm === "function"
        ? await context.confirm(`Delete the “${existing.name}” annotation template?`, "Delete Annotation Template", "Delete")
        : window.confirm(`Delete the “${existing.name}” annotation template?`);
      if (!confirmed) return;
      await persistTemplateLibrary({
        ...templateLibrary,
        templates: templateLibrary.templates.filter(template => template.id !== templateId)
      }, `Template “${existing.name}” deleted.`);
    };

    const moveTemplate = async (templateId, direction) => {
      const index = templateLibrary.templates.findIndex(template => template.id === templateId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= templateLibrary.templates.length) return;
      const templates = [...templateLibrary.templates];
      [templates[index], templates[nextIndex]] = [templates[nextIndex], templates[index]];
      await persistTemplateLibrary({ ...templateLibrary, templates }, "Template order saved.");
    };

    const setDrawingDefault = async type => {
      const object = selectedObjects()[0];
      if (selectedIds.size !== 1 || object?.type !== type || object.locked) return;
      const drawingDefault = annotationDrawingDefaultFromObject(object);
      await persistTemplateLibrary({
        ...templateLibrary,
        defaults: { ...templateLibrary.defaults, [type]: drawingDefault }
      }, `${type === "arrow" ? "Arrow" : "Rectangle"} is now the default style for new drawings.`);
    };

    const resetDrawingDefault = async type => {
      await persistTemplateLibrary({
        ...templateLibrary,
        defaults: { ...templateLibrary.defaults, [type]: null }
      }, `${type === "arrow" ? "Arrow" : "Rectangle"} drawing style reset to the PMT default.`);
    };

    const templateInsertionCenter = () => {
      const rect = workspace.getBoundingClientRect();
      return canvasPoint({
        clientX: rect.left + (workspace.clientWidth / 2),
        clientY: rect.top + (workspace.clientHeight / 2)
      });
    };

    const insertToolbarObject = async type => {
      if (!["rectangle", "circle", "arrow", "line", "textbox", "entity"].includes(type)) return;
      const center = templateInsertionCenter();
      pushHistory();
      const object = addObject(type, center);

      if (["arrow", "line"].includes(type)) {
        const start = snappedPoint({ x: center.x - 90, y: center.y - 90 }, state);
        const end = snappedPoint({ x: center.x + 90, y: center.y + 90 }, state);
        object.x1 = start.x;
        object.y1 = start.y;
        object.x2 = end.x;
        object.y2 = end.y;
      } else {
        object.width = type === "textbox" ? 320 : type === "entity" ? defaultEntityWidth : type === "circle" ? 180 : 240;
        object.height = type === "entity" ? 1 : type === "circle" ? 180 : 140;
        if (type === "entity") ensureAnnotationEntitySize(object);
        const topLeft = snappedPoint({
          x: center.x - (object.width / 2),
          y: center.y - (object.height / 2)
        }, state);
        object.x = topLeft.x;
        object.y = topLeft.y;
      }

      state.objects.push(object);
      selectedIds = new Set([object.id]);
      lastSelectedObjectId = object.id;
      setTool("select");
      setInspectorTab("format");

      if (type === "entity") {
        renderWithWorkspaceExpansion();
        const definition = await openAnnotationEntityDialog();
        if (!definition) {
          state.objects = state.objects.filter(item => item.id !== object.id);
          selectedIds.clear();
          lastSelectedObjectId = "";
          setStatus("Entity creation canceled.");
          renderWithWorkspaceExpansion();
          return;
        }
        applyAnnotationEntityDefinition(object, definition);
        ensureAnnotationEntitySize(object);
        const topLeft = snappedPoint({
          x: center.x - (object.width / 2),
          y: center.y - (object.height / 2)
        }, state);
        object.x = topLeft.x;
        object.y = topLeft.y;
        resolveAnnotationEntitySizeChangeLayout(state, object);
        pushHistory();
        setStatus(`${formatAnnotationEntityIdentifier(object.entitySchema, object.entityName)} added.`);
        renderWithWorkspaceExpansion();
        window.setTimeout(focusLastSelectedObject, 0);
        return;
      }

      pushHistory();
      setStatus(`${type === "textbox" ? "Text Box" : type[0].toUpperCase() + type.slice(1)} added.`);
      renderWithWorkspaceExpansion();
      if (type === "textbox") {
        window.setTimeout(() => {
          textInput.focus();
          textInput.select();
        }, 0);
      } else {
        window.setTimeout(focusLastSelectedObject, 0);
      }
    };

    const insertUploadedImage = async file => {
      if (!file || typeof context.uploadEmbeddedImage !== "function") {
        throw new Error("Image uploads are not available in this Diagram.");
      }

      const stored = await context.uploadEmbeddedImage(file);
      const source = String(stored?.url || stored || "").trim();
      if (!safeEmbeddedImageSource(source)) throw new Error("The uploaded image URL is invalid.");
      const dimensions = await imageDimensions(source);
      const center = templateInsertionCenter();
      const object = normalizeAnnotationObject({
        id: annotationObjectId("embedded-image"),
        type: "embedded-image",
        name: file.name || "Image",
        x: center.x - (dimensions.width / 2),
        y: center.y - (dimensions.height / 2),
        width: dimensions.width,
        height: dimensions.height,
        source,
        imageClip: {
          x: center.x - (dimensions.width / 2),
          y: center.y - (dimensions.height / 2),
          width: dimensions.width,
          height: dimensions.height
        },
        isOriginalImage: false,
        locked: false,
        groupId: ""
      });
      if (!object) throw new Error("The uploaded image could not be added to the canvas.");

      pushHistory();
      state.objects.push(object);
      embeddedSources.set(object.id, source);
      selectedIds = new Set([object.id]);
      lastSelectedObjectId = object.id;
      setTool("select");
      setInspectorTab("format");
      pushHistory();
      renderWithWorkspaceExpansion();
      window.setTimeout(focusLastSelectedObject, 0);
      return object;
    };

    const insertTemplate = (template, center = templateInsertionCenter()) => {
      pushHistory();
      const normalizedTemplate = normalizeAnnotationTemplate(template);
      if (!normalizedTemplate) return [];
      if (normalizedTemplate.relationshipStyle) {
        applyAnnotationEntityRelationshipGroupStyle(state, normalizedTemplate.relationshipStyle);
      }
      const insertionGroupId = normalizedTemplate.objects.length > 1 || normalizedTemplate.grouped
        ? `group-${Date.now().toString(36)}-${++groupSequence}`
        : "";
      const objects = instantiateAnnotationTemplate(
        normalizedTemplate,
        center,
        type => `${type}-${Date.now().toString(36)}-${++objectSequence}`,
        insertionGroupId
      );
      if (!objects.length) {
        if (!normalizedTemplate.relationshipStyle) return [];
        selectedIds = new Set([entityRelationshipsSelectionId]);
        lastSelectedObjectId = entityRelationshipsSelectionId;
        setTool("select");
        pushHistory();
        renderWithWorkspaceExpansion();
        window.setTimeout(focusLastSelectedObject, 0);
        return [state.relationshipStyle];
      }
      state.objects.push(...objects);
      if (objects.some(object => object.type === "entity")) resolveAnnotationEntityOverlaps(state);
      if (insertionGroupId && normalizedTemplate.groupName) {
        state.groupNames[insertionGroupId] = normalizedTemplate.groupName;
      }
      if (insertionGroupId) {
        state.groupVisibility[insertionGroupId] = normalizedTemplate.groupVisible !== false;
      }
      selectedIds = new Set(objects.map(object => object.id));
      lastSelectedObjectId = objects.at(-1)?.id || "";
      setTool("select");
      pushHistory();
      renderWithWorkspaceExpansion();
      window.setTimeout(focusLastSelectedObject, 0);
      return objects;
    };

    const useTemplate = async template => {
      const selection = selectedObjects();
      if (!selection.length) {
        const objects = insertTemplate(template);
        if (objects.length) setStatus(objects.length === 1 && objects[0].type === entityRelationshipsObjectType
          ? `Template "${template.name}" applied to all Entity relationship lines and arrows.`
          : `Template "${template.name}" added to the canvas.`);
        return objects.length > 0;
      }

      const plan = annotationTemplateFormattingPlan(template, selection);
      if (plan.matches.length && !plan.editableMatchCount) {
        const message = "Unlock the selected objects before applying template formatting.";
        if (templateStatus) templateStatus.textContent = message;
        setStatus(message);
        return false;
      }
      if (!plan.structureMatches) {
        const message = `The selected objects do not have the same structure as the "${template.name}" template. Applying it may not produce the same result. PMT will match objects by type and apply the formatting it can without changing text or geometry.`;
        const confirmed = typeof context.confirm === "function"
          ? await context.confirm(message, "Apply Template Formatting", "Apply Formatting")
          : window.confirm(message);
        if (!confirmed) {
          const canceledMessage = "Template formatting was not applied.";
          if (templateStatus) templateStatus.textContent = canceledMessage;
          setStatus(canceledMessage);
          return false;
        }
      }

      pushHistory();
      const result = applyAnnotationTemplateFormatting(template, selection);
      if (selection.some(object => object.type === entityRelationshipsObjectType)
        && template.relationshipStyle) {
        applyAnnotationEntityRelationshipGroupStyle(state, template.relationshipStyle);
      }
      if (!result.appliedCount) {
        const message = `Template "${template.name}" has no formatting compatible with the selected objects.`;
        if (templateStatus) templateStatus.textContent = message;
        setStatus(message);
        return false;
      }

      if (result.changedCount) {
        setTool("select");
        pushHistory();
        renderWithWorkspaceExpansion();
        window.setTimeout(focusLastSelectedObject, 0);
      }
      const changedMessage = result.changedCount
        ? `Template "${template.name}" formatting applied to ${result.appliedCount} selected object${result.appliedCount === 1 ? "" : "s"}.`
        : `The selected objects already use the formatting from template "${template.name}".`;
      const lockedMessage = result.lockedCount
        ? ` ${result.lockedCount} locked object${result.lockedCount === 1 ? " was" : "s were"} left unchanged.`
        : "";
      const constrainedMessage = result.geometryConstrainedCount
        ? " Some arrow formatting was limited to preserve the destination geometry."
        : "";
      const message = `${changedMessage}${lockedMessage}${constrainedMessage}`;
      if (templateStatus) templateStatus.textContent = message;
      setStatus(message);
      return result.changedCount > 0;
    };

    const copyNativeSelection = () => {
      if (!selectedIds.size) return false;
      if ([...selectedIds].some(id => id === entityRelationshipsSelectionId || isAnnotationEntityRelationshipSelectionId(id))) {
        setStatus("Save the selected Entity relationship as a template to reuse its connector formatting.");
        return false;
      }
      const template = captureAnnotationTemplate(state, selectedIds, "", "Clipboard");
      const bounds = annotationSelectionVisualBounds(selectedObjects());
      if (!template || !bounds) return false;
      nativeClipboard = {
        template,
        center: { x: bounds.x + (bounds.width / 2), y: bounds.y + (bounds.height / 2) }
      };
      pasteSequence = 0;
      setStatus(`${template.objects.length} object${template.objects.length === 1 ? "" : "s"} copied. Press Ctrl+V to paste.`);
      syncControls();
      return true;
    };

    const pasteNativeSelection = () => {
      if (!nativeClipboard) {
        setStatus("Copy canvas objects with Ctrl+C before pasting.");
        return false;
      }
      pasteSequence += 1;
      const distance = state.gridVisible ? state.gridSize : 10;
      const objects = insertTemplate(nativeClipboard.template, {
        x: nativeClipboard.center.x + (distance * pasteSequence),
        y: nativeClipboard.center.y + (distance * pasteSequence)
      });
      if (objects.length) setStatus(`${objects.length} object${objects.length === 1 ? "" : "s"} pasted.`);
      return objects.length > 0;
    };

    const duplicateSelection = () => {
      if (!selectedIds.size) return false;
      if ([...selectedIds].some(id => id === entityRelationshipsSelectionId || isAnnotationEntityRelationshipSelectionId(id))) {
        setStatus("Entity Relationships are fixed connectors and cannot be duplicated.");
        return false;
      }
      const template = captureAnnotationTemplate(state, selectedIds, "", "Duplicate");
      const bounds = annotationSelectionVisualBounds(selectedObjects());
      if (!template || !bounds) return false;
      const distance = state.gridVisible ? state.gridSize : 10;
      const objects = insertTemplate(template, {
        x: bounds.x + (bounds.width / 2) + distance,
        y: bounds.y + (bounds.height / 2) + distance
      });
      if (!objects.length) return false;
      const message = `${objects.length === 1 ? "Item" : "Items"} duplicated.`;
      setStatus(message);
      context.notify?.(message);
      return true;
    };

    const treeNodeIds = (kind, id) => {
      if (kind === "relationships") {
        return id === entityRelationshipsSelectionId && resolveAnnotationEntityRelationships(state.objects).length
          ? [entityRelationshipsSelectionId]
          : [];
      }
      if (kind === "relationship") {
        return resolveAnnotationEntityRelationships(state.objects).some(relationship => relationship.id === id)
          ? [id]
          : [];
      }
      if (kind === "group") {
        return state.objects.filter(object => object.groupId === id).map(object => object.id);
      }
      return state.objects.some(object => object.id === id) ? [id] : [];
    };

    const resolveSelectedTreeTarget = () => {
      if (selectedIds.size === 1) {
        const selectedId = [...selectedIds][0];
        if (selectedId === entityRelationshipsSelectionId) {
          return { kind: "relationships", id: entityRelationshipsSelectionId, ids: [entityRelationshipsSelectionId] };
        }
        if (isAnnotationEntityRelationshipSelectionId(selectedId)) {
          return { kind: "relationship", id: selectedId, ids: [selectedId] };
        }
      }
      if (lastTreeSelectionKey) {
        const [kind, ...idParts] = lastTreeSelectionKey.split(":");
        const id = idParts.join(":");
        const ids = treeNodeIds(kind, id);
        if (ids.length === selectedIds.size && ids.every(objectId => selectedIds.has(objectId))) return { kind, id, ids };
      }
      if (selectedIds.size === 1) {
        const id = [...selectedIds][0];
        return state.objects.some(object => object.id === id) ? { kind: "object", id, ids: [id] } : null;
      }
      const matchingGroup = buildAnnotationObjectTree(state)
        .filter(node => node.kind === "group")
        .find(node => node.children.length === selectedIds.size
          && node.children.every(child => selectedIds.has(child.id)));
      return matchingGroup
        ? { kind: "group", id: matchingGroup.id, ids: matchingGroup.children.map(child => child.id) }
        : null;
    };

    const treeTargetCanMoveToRoot = target => {
      if (!target?.ids?.length) return false;
      if (["relationships", "relationship"].includes(target.kind)) return false;
      if (state.objects.some(object => target.ids.includes(object.id) && object.isOriginalImage === true)) return false;
      const nextState = reorderAnnotationObjectTree(state, {
        draggedKind: target.kind,
        draggedId: target.id,
        targetKind: "root"
      });
      return annotationSnapshot(nextState, embeddedSources) !== annotationSnapshot(state, embeddedSources);
    };

    const setRootMoveNoopStatus = target => {
      setStatus(target ? "That object or group is already at the top of the root." : "Select one object or one group before moving it to the root.");
    };

    const focusTreeNode = (kind, id) => {
      const row = [...objectTree.querySelectorAll("[data-annotation-tree-node]")]
        .find(element => element.dataset.annotationTreeKind === kind && element.dataset.annotationTreeId === id);
      row?.focus({ preventScroll: true });
    };

    const selectTreeNode = (kind, id, event = {}) => {
      const ids = treeNodeIds(kind, id);
      if (!ids.length) return;
      if (kind === "relationships") {
        selectEntityRelationships();
        render();
        window.setTimeout(() => focusTreeNode(kind, id), 0);
        return;
      }
      if (kind === "relationship") {
        selectEntityRelationship(id);
        render();
        window.setTimeout(() => focusTreeNode(kind, id), 0);
        return;
      }
      const key = `${kind}:${id}`;
      if ([...selectedIds].some(selectedId => selectedId === entityRelationshipsSelectionId
        || isAnnotationEntityRelationshipSelectionId(selectedId))) selectedIds.clear();
      const additive = event.ctrlKey || event.metaKey;
      if (event.shiftKey && treeRangeAnchorKey) {
        const rows = [...objectTree.querySelectorAll("[data-annotation-tree-node]")];
        const keys = rows.map(row => `${row.dataset.annotationTreeKind}:${row.dataset.annotationTreeId}`);
        const anchorIndex = keys.indexOf(treeRangeAnchorKey);
        const targetIndex = keys.indexOf(key);
        if (!additive) selectedIds.clear();
        if (anchorIndex >= 0 && targetIndex >= 0) {
          const start = Math.min(anchorIndex, targetIndex);
          const end = Math.max(anchorIndex, targetIndex);
          rows.slice(start, end + 1).forEach(row => {
            treeNodeIds(row.dataset.annotationTreeKind, row.dataset.annotationTreeId)
              .forEach(objectId => selectedIds.add(objectId));
          });
        } else {
          ids.forEach(objectId => selectedIds.add(objectId));
        }
      } else if (additive) {
        const remove = ids.every(objectId => selectedIds.has(objectId));
        ids.forEach(objectId => remove ? selectedIds.delete(objectId) : selectedIds.add(objectId));
        treeRangeAnchorKey = key;
      } else {
        selectedIds = new Set(ids);
        treeRangeAnchorKey = key;
      }
      lastTreeSelectionKey = key;
      lastSelectedObjectId = ids.find(objectId => selectedIds.has(objectId)) || [...selectedIds].at(-1) || "";
      setTool("select");
      setStatus(selectedIds.size
        ? `${selectedIds.size} object${selectedIds.size === 1 ? "" : "s"} selected from the object tree.`
        : "Selection cleared.");
      render();
      window.setTimeout(() => focusTreeNode(kind, id), 0);
    };

    const treeNodeVisualBounds = (kind, id) => {
      if (["relationship", "relationships"].includes(kind)) {
        const model = annotationEntityRelationshipRenderModel(
          annotationVisibleObjects(state),
          state.relationshipStyle,
          { allowOverlappingLines: state.allowOverlappingEntityLines }
        );
        const items = kind === "relationship"
          ? model.renderedRelationships.filter(item => item.relationship.id === id)
          : model.renderedRelationships;
        return unionAnnotationBounds(items.map(item =>
          annotationEntityRelationshipGeometryVisualBounds(item.geometry, item.style)
        ));
      }
      const ids = new Set(treeNodeIds(kind, id));
      return unionAnnotationBounds(state.objects
        .filter(object => ids.has(object.id))
        .map(object => annotationObjectVisualBounds(object)));
    };

    const zoomToTreeNode = (kind, id) => {
      const bounds = treeNodeVisualBounds(kind, id);
      if (!bounds) return false;
      settleCanvasZoomAtCurrentDisplay();
      const availableWidth = Math.max(1, workspace.clientWidth - 96);
      const availableHeight = Math.max(1, workspace.clientHeight - 96);
      const fittedZoom = Math.min(
        availableWidth / Math.max(1, bounds.width),
        availableHeight / Math.max(1, bounds.height)
      );
      zoom = Math.round(clampNumber(fittedZoom, minimumZoom, maximumZoom) / annotationZoomStep)
        * annotationZoomStep;
      applyCanvasZoom();
      canvasWorkspaceOffset = null;
      const offset = measureCanvasWorkspaceOffset();
      const centerX = bounds.x + (bounds.width / 2);
      const centerY = bounds.y + (bounds.height / 2);
      const targetLeft = offset.x + ((centerX - workspaceBounds.x) * zoom) - (workspace.clientWidth / 2);
      const targetTop = offset.y + ((centerY - workspaceBounds.y) * zoom) - (workspace.clientHeight / 2);
      scrollWorkspaceTo(
        clampNumber(targetLeft, 0, Math.max(0, workspace.scrollWidth - workspace.clientWidth)),
        clampNumber(targetTop, 0, Math.max(0, workspace.scrollHeight - workspace.clientHeight))
      );
      setStatus("Selection centered and fitted in the viewport.");
      return true;
    };

    const renameTreeNode = async (kind, id) => {
      if (["relationships", "relationship"].includes(kind)) return;
      const current = kind === "group"
        ? state.groupNames[id] || buildAnnotationObjectTree(state).find(node => node.kind === "group" && node.id === id)?.name || "Group"
        : state.objects.find(object => object.id === id)?.name || annotationObjectLabel(state.objects.find(object => object.id === id));
      if (!current) return;
      const name = safeAnnotationName(typeof context.askForText === "function"
        ? await context.askForText("Name", kind === "group" ? "Rename Object Group" : "Rename Canvas Object", current)
        : window.prompt(kind === "group" ? "Group name" : "Object name", current));
      if (!name) return;
      pushHistory();
      if (kind === "group") {
        if (!state.objects.some(object => object.groupId === id)) return;
        state.groupNames[id] = name;
      } else {
        const object = state.objects.find(item => item.id === id);
        if (!object) return;
        object.name = name;
      }
      pushHistory();
      setStatus(`${kind === "group" ? "Group" : "Object"} renamed to “${name}”.`);
      render();
      window.setTimeout(() => focusTreeNode(kind, id), 0);
    };

    const toggleTreeNodeVisibility = (kind, id) => {
      if (!["group", "object"].includes(kind)) return false;
      const object = kind === "object" ? state.objects.find(item => item.id === id) : null;
      if (kind === "group" && !state.objects.some(item => item.groupId === id)) return false;
      if (kind === "object" && !object) return false;
      const currentlyVisible = kind === "group"
        ? state.groupVisibility[id] !== false
        : object.visible !== false;
      pushHistory();
      if (kind === "group") state.groupVisibility[id] = !currentlyVisible;
      else object.visible = !currentlyVisible;
      pushHistory();
      const treeNode = buildAnnotationObjectTree(state)
        .flatMap(node => node.kind === "group" ? [node, ...node.children] : [node])
        .find(node => node.kind === kind && node.id === id);
      const name = treeNode?.name || (kind === "group" ? "Group" : annotationObjectLabel(object));
      setStatus(`${kind === "group" ? "Group" : "Object"} "${name}" ${currentlyVisible ? "hidden" : "shown"}.`);
      renderWithWorkspaceExpansion();
      window.setTimeout(() => {
        const row = [...objectTree.querySelectorAll("[data-annotation-tree-node]")]
          .find(element => element.dataset.annotationTreeKind === kind && element.dataset.annotationTreeId === id);
        row?.querySelector("[data-annotation-tree-node-action='visibility']")?.focus({ preventScroll: true });
      }, 0);
      return true;
    };

    const deleteTreeSelection = () => {
      const removable = new Set(selectedObjects()
        .filter(object => !isAnnotationEntityRelationshipSelectionType(object.type)
          && object.isOriginalImage !== true
          && !object.locked)
        .map(object => object.id));
      if (!removable.size) {
        setStatus("Unlock the selected objects before deleting them.");
        return false;
      }
      pushHistory();
      const removalIds = annotationRemovalIdsWithEntityCallouts(state, removable);
      state.objects = state.objects.filter(object => !removalIds.has(object.id));
      removalIds.forEach(id => selectedIds.delete(id));
      pruneAnnotationGroupMetadata(state);
      pushHistory();
      lastTreeSelectionKey = "";
      treeRangeAnchorKey = "";
      setStatus(`${removalIds.size} object${removalIds.size === 1 ? "" : "s"} deleted from the object tree.`);
      renderWithWorkspaceExpansion();
      objectTree.focus({ preventScroll: true });
      return true;
    };

    const moveTreeNode = (dragged, targetKind, targetId = "", targetPlacement = "before") => {
      if (!dragged) return false;
      if (dragged.kind === "relationships" || targetKind === "relationships") return false;
      const draggedObjectIds = treeNodeIds(dragged.kind, dragged.id);
      const before = annotationSnapshot(state, embeddedSources);
      const nextState = reorderAnnotationObjectTree(state, {
        draggedKind: dragged.kind,
        draggedId: dragged.id,
        targetKind,
        targetId,
        targetPlacement
      });
      const after = annotationSnapshot(nextState, embeddedSources);
      if (before === after) return false;
      pushHistory();
      state = nextState;
      const movedObject = state.objects.find(object => draggedObjectIds.includes(object.id));
      const movedIds = dragged.kind === "group" && movedObject?.groupId
        ? annotationSelectionIdsForObject(state.objects, movedObject)
        : draggedObjectIds.filter(id => state.objects.some(object => object.id === id));
      selectedIds = new Set(movedIds);
      lastSelectedObjectId = [...selectedIds].at(-1) || "";
      lastTreeSelectionKey = dragged.kind === "group" && movedObject?.groupId
        ? `group:${movedObject.groupId}`
        : `${dragged.kind}:${dragged.id}`;
      pushHistory();
      setStatus(targetKind === "root"
        ? "Object moved to the top of the root. Canvas z-order updated."
        : targetKind === "group" && targetPlacement === "inside"
          ? "Object moved to the top of the selected group. Canvas z-order updated."
          : `Object moved directly ${targetPlacement === "after" ? "below" : "above"} the target. Canvas z-order updated.`);
      render();
      return true;
    };

    const moveEntityField = (dragged, targetIndex, placement) => {
      const entity = state.objects.find(object => object.id === dragged?.entityId && object.type === "entity");
      if (!entity || entity.locked) return false;
      const sourceIndex = Number.parseInt(dragged.index, 10);
      const movedField = entity.fields?.[sourceIndex];
      const nextFields = reorderAnnotationEntityFields(entity.fields, sourceIndex, targetIndex, placement);
      if (!movedField
        || nextFields.length !== entity.fields.length
        || nextFields.every((field, index) => field === entity.fields[index])) {
        return false;
      }

      pushHistory();
      entity.fields = nextFields;
      const nextIndex = entity.fields.indexOf(movedField);
      pushHistory();
      setStatus(`${formatAnnotationEntityIdentifier(movedField.name)} moved to field ${nextIndex + 1}.`);
      render();
      window.setTimeout(() => {
        entityFieldList.querySelector(`[data-annotation-entity-field-index='${nextIndex}']`)?.focus({ preventScroll: true });
      }, 0);
      return true;
    };

    const updateEntityFieldProperty = (entityId, fieldIndex, property, checked) => {
      if (!["isPrimaryKey", "isForeignKey", "isImportant"].includes(property)) return false;
      const entity = state.objects.find(object => object.id === entityId && object.type === "entity");
      const field = entity?.fields?.[fieldIndex];
      if (!entity || !field || entity.locked) return false;
      pushHistory();
      field[property] = checked === true;
      ensureAnnotationEntitySize(entity);
      pushHistory();
      const label = property === "isPrimaryKey" ? "Primary key" : property === "isForeignKey" ? "Foreign key" : "Important field";
      setStatus(`${label} ${field[property] ? "set" : "cleared"} for ${formatAnnotationEntityIdentifier(field.name)}.`);
      renderWithWorkspaceExpansion();
      window.setTimeout(() => {
        entityFieldList.querySelector(`[data-annotation-entity-field-property='${property}'][data-annotation-entity-field-index='${fieldIndex}']`)?.focus({ preventScroll: true });
      }, 0);
      return true;
    };

    const mapEntityFieldForeignKey = async (entityId, fieldIndex) => {
      const entity = state.objects.find(object => object.id === entityId && object.type === "entity");
      const field = entity?.fields?.[fieldIndex];
      if (!entity || !field || entity.locked || !field.isForeignKey) return false;
      const mapping = await openAnnotationEntityForeignKeyDialog(entity, field);
      if (!mapping) return false;
      pushHistory();
      entity.foreignKeys = setAnnotationEntityFieldForeignKeyMapping(entity.foreignKeys, field.name, mapping);
      if (mapping.referencedEntity && mapping.referencedField) field.isForeignKey = true;
      ensureAnnotationEntitySize(entity);
      pushHistory();
      setStatus(mapping.referencedEntity
        ? `${formatAnnotationEntityIdentifier(field.name)} mapped to ${formatAnnotationEntityIdentifier(mapping.referencedEntity)}.${formatAnnotationEntityIdentifier(mapping.referencedField)}.`
        : `Foreign key mapping cleared for ${formatAnnotationEntityIdentifier(field.name)}.`);
      renderWithWorkspaceExpansion();
      window.setTimeout(() => {
        entityFieldList.querySelector(`[data-annotation-entity-field-map][data-annotation-entity-field-index='${fieldIndex}']`)?.focus({ preventScroll: true });
      }, 0);
      return true;
    };

    const activateEntityHeaderAction = actionElement => {
      const objectElement = actionElement?.closest?.("[data-annotation-object-id]");
      const entity = state.objects.find(object => object.id === objectElement?.dataset.annotationObjectId && object.type === "entity");
      if (!entity) return false;
      selectObject(entity);
      if (entity.locked) {
        setStatus("Unlock the Entity before changing its view.");
        renderWithWorkspaceExpansion();
        return false;
      }
      const action = actionElement.dataset.annotationEntityHeaderAction;
      if (!["collapsed", "showDataTypes"].includes(action)) return false;
      pushHistory();
      if (action === "collapsed") setAnnotationEntityCollapsedState(entity, entity.collapsed !== true);
      else setAnnotationEntityDataTypeVisibility(entity, entity.showDataTypes !== true);
      const layoutResult = resolveAnnotationEntitySizeChangeLayout(state, entity);
      pushHistory();
      setStatus(action === "collapsed"
        ? `Entity ${entity.collapsed ? "collapsed to key and important fields" : "expanded to all fields"}.`
        : `Data types ${entity.showDataTypes ? "shown" : "hidden"}.`);
      renderWithWorkspaceExpansion();
      if (annotationEntityAnchorShortcutWarningAllowed(state)
        && (layoutResult.unresolvedOverlapCount || layoutResult.unresolvedRouteContactCount)) {
        void openAnnotationInformationDialog(
          "Because an Anchor or otherwise fixed table could not be moved, PMT kept the fixed table in place and rendered the affected relationships using the best available route.",
          "Anchor Table Shortcut"
        );
      }
      window.setTimeout(() => {
        const renderedEntity = [...canvas.querySelectorAll("[data-annotation-object-id]")]
          .find(element => element.dataset.annotationObjectId === entity.id);
        renderedEntity?.querySelector(`[data-annotation-entity-header-action='${action}']`)?.focus({ preventScroll: true });
      }, 0);
      return true;
    };

    const copyAnnotationSelection = async format => {
      if (copying) {
        setStatus("Wait for the current clipboard copy to finish.");
        return;
      }
      const copiedObjects = selectedObjects();
      if (!copiedObjects.length) {
        setStatus("Select an object to copy.");
        return;
      }

      copying = true;
      setStatus(format === "image" ? "Copying the selection as an image..." : "Copying the selection as SVG...");
      try {
        const selectionExport = await annotationPortableSelectionClipboardExport(
          state,
          selectedIds
        );
        if (!selectionExport.svg) throw new Error("Select an object to copy.");
        if (format === "image") await copyAnnotationPngToClipboard(selectionExport);
        else await copyAnnotationSvgToClipboard(selectionExport.svg);
        const objectLabel = copiedObjects.length === 1 ? "object" : `${copiedObjects.length} objects`;
        setStatus(`${objectLabel[0].toUpperCase()}${objectLabel.slice(1)} copied as ${format === "image" ? "an image" : "SVG"}.`);
      } catch (error) {
        setStatus(error?.message || `The selection could not be copied as ${format === "image" ? "an image" : "SVG"}.`);
      } finally {
        copying = false;
        focusLastSelectedObject();
      }
    };

    dialog.addEventListener("click", async event => {
      if (event.target.closest("[data-annotation-generate-pmt-schema]")) {
        if (pmtSchemaBusy || typeof context.generatePmtDatabaseSchema !== "function") return;
        pmtSchemaBusy = true;
        syncControls();
        setStatus("Generating PMT's latest database schema...");
        try {
          const result = await context.generatePmtDatabaseSchema();
          setStatus(result
            ? "PMT's Database Schema was created as a separate Diagram."
            : "The PMT database schema was not created.");
        } catch (error) {
          setStatus(error?.message || "The PMT database schema could not be generated.");
        } finally {
          pmtSchemaBusy = false;
          syncControls();
        }
        return;
      }

      const fieldMapButton = event.target.closest("[data-annotation-entity-field-map]");
      if (fieldMapButton) {
        await mapEntityFieldForeignKey(
          fieldMapButton.dataset.annotationEntityId,
          Number.parseInt(fieldMapButton.dataset.annotationEntityFieldIndex, 10)
        );
        return;
      }

      if (event.target.closest("[data-annotation-entity-auto-format-org-tree]")) {
        const entity = selectedObjects().length === 1 && selectedObjects()[0]?.type === "entity"
          ? selectedObjects()[0]
          : null;
        const entities = state.objects.filter(object => object.type === "entity");
        if (!entity || entities.length < 2) {
          setStatus("Add at least two Entities before using Auto Format - Org Tree.");
          return;
        }
        if (entities.some(item => item.locked)) {
          setStatus("Unlock every Entity before using Auto Format - Org Tree.");
          return;
        }
        pushHistory();
        const originalEntityPositions = new Map(entities.map(item => [item.id, { x: item.x, y: item.y }]));
        const result = autoFormatAnnotationEntitiesOrgTree(state.objects, {
          preferredRootId: entity.id,
          allowOverlappingLines: state.allowOverlappingEntityLines,
          relationshipStyle: state.relationshipStyle,
          gridSize: state.gridSize
        });
        entities.forEach(item => {
          const original = originalEntityPositions.get(item.id);
          const deltaX = item.x - original.x;
          const deltaY = item.y - original.y;
          if (!deltaX && !deltaY) return;
          translateAllAnnotationObjects(annotationEntityAnnotationChildren(state, item), deltaX, deltaY);
        });
        syncAnnotationEntityAnnotationArrows(state);
        pushHistory();
        const cycleMessage = result.cycleBreakCount
          ? ` ${result.cycleBreakCount} dependency cycle${result.cycleBreakCount === 1 ? " was" : "s were"} placed deterministically.`
          : "";
        const anchorMessage = result.anchorCount
          ? ` ${result.anchorCount} anchor table${result.anchorCount === 1 ? " stayed" : "s stayed"} in place.`
          : "";
        setStatus(`${result.movedCount} Entit${result.movedCount === 1 ? "y" : "ies"} arranged in ${result.levelCount} org-tree level${result.levelCount === 1 ? "" : "s"}.${anchorMessage}${cycleMessage}`);
        renderWithWorkspaceExpansion();
        if (annotationEntityAnchorShortcutWarningAllowed(state)
          && annotationOrgTreeShortcutWarningRequired(result)) {
          const unresolvedMessage = result.unresolvedRouteContactCount
            ? ` ${result.unresolvedRouteContactCount} relationship contact${result.unresolvedRouteContactCount === 1 ? "" : "s"} could not be fully separated from an Anchor or otherwise fixed table.`
            : "";
          await openAnnotationInformationDialog(
            `Because an Anchor or otherwise fixed table could not be moved, Auto Format used a routing shortcut to avoid an infinite loop. Fixed tables stayed in place, and affected relationships were rendered using the best available route.${unresolvedMessage}`,
            "Anchor Table Shortcut"
          );
        }
        window.setTimeout(focusLastSelectedObject, 0);
        return;
      }

      const inspectorTab = event.target.closest("[data-annotation-inspector-tab]");
      if (inspectorTab) {
        setInspectorTab(inspectorTab.dataset.annotationInspectorTab);
        return;
      }

      const treeNodeAction = event.target.closest("[data-annotation-tree-node-action]");
      if (treeNodeAction) {
        const row = treeNodeAction.closest("[data-annotation-tree-node]");
        const kind = row?.dataset.annotationTreeKind;
        const id = row?.dataset.annotationTreeId;
        if (!kind || !id) return;
        if (treeNodeAction.dataset.annotationTreeNodeAction === "crop-toggle") {
          const image = kind === "object"
            ? state.objects.find(object => object.id === id && object.type === "embedded-image")
            : null;
          if (!image || !annotationImageHasReversibleCrop(state, image)) return;
          pushHistory();
          const nextVisible = image.cropVisible === false;
          setAnnotationImageCropVisibility(state, nextVisible, image);
          pushHistory();
          setStatus(nextVisible
            ? "Crop shown. Only the cropped area is visible."
            : "Crop hidden. The full source is visible; the crop is still saved.");
          renderWithWorkspaceExpansion();
          window.setTimeout(() => {
            const imageRow = [...objectTree.querySelectorAll("[data-annotation-tree-node]")]
              .find(candidate => candidate.dataset.annotationTreeId === id);
            imageRow?.querySelector("[data-annotation-tree-node-action='crop-toggle']")?.focus({ preventScroll: true });
          }, 0);
          return;
        }
        if (treeNodeAction.dataset.annotationTreeNodeAction === "visibility") {
          toggleTreeNodeVisibility(kind, id);
          return;
        }
        selectTreeNode(kind, id);
        if (treeNodeAction.dataset.annotationTreeNodeAction === "rename") await renameTreeNode(kind, id);
        else if (treeNodeAction.dataset.annotationTreeNodeAction === "delete") deleteTreeSelection();
        return;
      }

      const treeAction = event.target.closest("[data-annotation-tree-action]");
      if (treeAction) {
        const action = treeAction.dataset.annotationTreeAction;
        if (action === "rename") {
          const target = resolveSelectedTreeTarget();
          if (target) await renameTreeNode(target.kind, target.id);
        } else if (action === "copy") copyNativeSelection();
        else if (action === "paste") pasteNativeSelection();
        else if (action === "delete") deleteTreeSelection();
        return;
      }

      if (event.target.closest("[data-annotation-tree-root-drop]")) {
        const target = resolveSelectedTreeTarget();
        if (!target || !moveTreeNode({ kind: target.kind, id: target.id }, "root")) {
          setRootMoveNoopStatus(target);
        }
        return;
      }

      const treeRow = event.target.closest("[data-annotation-tree-node]");
      if (treeRow) {
        if (event.detail > 1) return;
        selectTreeNode(
          treeRow.dataset.annotationTreeKind,
          treeRow.dataset.annotationTreeId,
          event
        );
        return;
      }

      if (event.target.closest("[data-annotation-toggle-inspector]")) {
        setInspectorVisible(!inspectorVisible);
        return;
      }

      if (event.target.closest("[data-annotation-maximize]")) {
        setMaximized(true);
        return;
      }

      if (event.target.closest("[data-annotation-restore]")) {
        setMaximized(false);
        return;
      }

      if (event.target.closest("[data-annotation-template-save]")) {
        await saveSelectionAsTemplate();
        return;
      }

      if (event.target.closest("[data-annotation-template-upload]")) {
        templateUploadInput?.click();
        return;
      }

      const drawingDefaultButton = event.target.closest("[data-annotation-template-default]");
      if (drawingDefaultButton) {
        await setDrawingDefault(drawingDefaultButton.dataset.annotationTemplateDefault);
        return;
      }

      const resetDefaultButton = event.target.closest("[data-annotation-template-reset-default]");
      if (resetDefaultButton) {
        await resetDrawingDefault(resetDefaultButton.dataset.annotationTemplateResetDefault);
        return;
      }

      const templateActionButton = event.target.closest("[data-annotation-template-action]");
      if (templateActionButton) {
        const action = templateActionButton.dataset.annotationTemplateAction;
        if (action === "restore-defaults") {
          await restoreDefaultTemplates();
          return;
        }
        const templateId = templateActionButton.dataset.annotationTemplateId || "";
        const template = templateLibrary.templates.find(item => item.id === templateId);
        if (action === "create" && template) await useTemplate(template);
        else if (action === "download") downloadTemplate(templateId);
        else if (action === "rename") await renameTemplate(templateId);
        else if (action === "replace") await replaceTemplateFromSelection(templateId);
        else if (action === "delete") await deleteTemplate(templateId);
        else if (action === "up") await moveTemplate(templateId, -1);
        else if (action === "down") await moveTemplate(templateId, 1);
        return;
      }

      const contextTool = event.target.closest("[data-annotation-context-tool]");
      if (contextTool) {
        closeAnnotationContextMenu();
        if (contextTool.dataset.annotationContextTool === "crop") await activateCropTool();
        else setTool(contextTool.dataset.annotationContextTool);
        workspace.focus({ preventScroll: true });
        return;
      }

      const tool = event.target.closest("button[data-annotation-tool]");
      if (tool) {
        closeAnnotationContextMenu();
        const toolName = tool.dataset.annotationTool;
        if (["rectangle", "circle", "arrow", "line", "textbox", "entity"].includes(toolName)) {
          await insertToolbarObject(toolName);
        } else if (toolName === "crop") {
          await activateCropTool();
        } else {
          setTool(toolName);
        }
        return;
      }

      const actionButton = event.target.closest("[data-annotation-action]");
      if (actionButton) {
        const contextAction = contextMenu.contains(actionButton);
        if (contextAction) closeAnnotationContextMenu();
        const action = actionButton.dataset.annotationAction;
        if (["copy-svg", "copy-image"].includes(action)) {
          await copyAnnotationSelection(action === "copy-image" ? "image" : "svg");
          return;
        }
        handleAnnotationAction(action, {
          state,
          selectedIds,
          selectedObjects,
          setStatus,
          pushHistory,
          restoreHistory,
          historyIndex: () => historyIndex,
          historyLength: () => history.length,
          nextGroupId: () => `group-${Date.now().toString(36)}-${++groupSequence}`
        });
        renderWithWorkspaceExpansion();
        if (contextAction) {
          if (selectedIds.size) focusLastSelectedObject();
          else workspace.focus({ preventScroll: true });
        }
        return;
      }

      const zoomAction = event.target.closest("[data-annotation-zoom]")?.dataset.annotationZoom;
      const zoomPoint = lastZoomPoint || { x: workspace.clientWidth / 2, y: workspace.clientHeight / 2 };
      if (zoomAction === "in") queueCanvasZoom(zoom + annotationZoomStep, zoomPoint.x, zoomPoint.y);
      else if (zoomAction === "out") queueCanvasZoom(zoom - annotationZoomStep, zoomPoint.x, zoomPoint.y);
      else if (zoomAction === "fit") fitCanvas();
    });

    dialog.addEventListener("pointerdown", event => {
      if (!contextMenu.hidden && !contextMenu.contains(event.target)) closeAnnotationContextMenu();
    });
    const clearTreeDropStyles = () => {
      dialog.querySelectorAll(".is-drop-target, .reorder-before, .reorder-after").forEach(element => {
        element.classList.remove("is-drop-target", "reorder-before", "reorder-after");
      });
    };
    const clearTreeDragStyles = () => {
      clearTreeDropStyles();
      dialog.querySelectorAll(".is-dragging").forEach(element => element.classList.remove("is-dragging"));
    };
    const treeDropPlacement = (target, clientY) => {
      const targetObject = target.matches?.("[data-annotation-tree-node-type='object']")
        ? state.objects.find(object => object.id === target.dataset.annotationTreeNodeId)
        : null;
      if (targetObject?.type === "embedded-image" && targetObject.isOriginalImage === true) {
        return "before";
      }
      const bounds = target.getBoundingClientRect();
      return clientY > bounds.top + (bounds.height / 2) ? "after" : "before";
    };
    dialog.addEventListener("dragstart", event => {
      const fieldRow = event.target.closest?.(".image-annotation-entity-field-row[data-annotation-entity-field-index]");
      if (fieldRow) {
        if (event.target.closest?.("[data-annotation-entity-field-property], [data-annotation-entity-field-map]")) {
          event.preventDefault();
          return;
        }
        if (fieldRow.getAttribute("draggable") !== "true") {
          event.preventDefault();
          return;
        }
        draggedEntityField = {
          entityId: fieldRow.dataset.annotationEntityId,
          index: Number.parseInt(fieldRow.dataset.annotationEntityFieldIndex, 10)
        };
        draggedTreeNode = null;
        fieldRow.classList.add("is-dragging");
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", `entity-field:${draggedEntityField.index}`);
        }
        return;
      }
      const row = event.target.closest?.("[data-annotation-tree-node]");
      if (!row || row.getAttribute("draggable") !== "true") {
        event.preventDefault();
        return;
      }
      draggedTreeNode = {
        kind: row.dataset.annotationTreeKind,
        id: row.dataset.annotationTreeId
      };
      row.classList.add("is-dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", `${draggedTreeNode.kind}:${draggedTreeNode.id}`);
      }
    });
    dialog.addEventListener("dragover", event => {
      if (draggedEntityField) {
        clearTreeDropStyles();
        const target = event.target.closest?.(".image-annotation-entity-field-row[data-annotation-entity-field-index]");
        if (!target || target.dataset.annotationEntityId !== draggedEntityField.entityId) return;
        event.preventDefault();
        target.classList.add(`reorder-${treeDropPlacement(target, event.clientY)}`);
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        return;
      }
      if (!draggedTreeNode) return;
      clearTreeDropStyles();
      const target = event.target.closest?.("[data-annotation-tree-node], [data-annotation-tree-root-drop]");
      if (!target) return;
      event.preventDefault();
      const placement = target.matches("[data-annotation-tree-root-drop]")
        ? "after"
        : treeDropPlacement(target, event.clientY);
      target.classList.add(`reorder-${placement}`);
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    });
    dialog.addEventListener("drop", event => {
      if (draggedEntityField) {
        const target = event.target.closest?.(".image-annotation-entity-field-row[data-annotation-entity-field-index]");
        if (!target || target.dataset.annotationEntityId !== draggedEntityField.entityId) return;
        event.preventDefault();
        const dragged = draggedEntityField;
        draggedEntityField = null;
        const placement = treeDropPlacement(target, event.clientY);
        const moved = moveEntityField(
          dragged,
          Number.parseInt(target.dataset.annotationEntityFieldIndex, 10),
          placement
        );
        clearTreeDragStyles();
        if (!moved) setStatus("That field is already in that position.");
        return;
      }
      if (!draggedTreeNode) return;
      const target = event.target.closest?.("[data-annotation-tree-node], [data-annotation-tree-root-drop]");
      if (!target) return;
      event.preventDefault();
      const dragged = draggedTreeNode;
      draggedTreeNode = null;
      clearTreeDragStyles();
      if (target.matches("[data-annotation-tree-root-drop]")) {
        if (!moveTreeNode(dragged, "root")) {
          setRootMoveNoopStatus({ ...dragged, ids: treeNodeIds(dragged.kind, dragged.id) });
        }
        return;
      }
      const placement = treeDropPlacement(target, event.clientY);
      moveTreeNode(
        dragged,
        target.dataset.annotationTreeKind,
        target.dataset.annotationTreeId,
        target.dataset.annotationTreeKind === "group" && placement === "after" ? "inside" : placement
      );
    });
    dialog.addEventListener("dragend", () => {
      draggedTreeNode = null;
      draggedEntityField = null;
      clearTreeDragStyles();
    });
    dialog.addEventListener("dragleave", event => {
      if (!dialog.contains(event.relatedTarget)) clearTreeDropStyles();
    });
    contextMenu.addEventListener("contextmenu", event => event.preventDefault());
    inspectorSplitter.addEventListener("pointerdown", beginInspectorResize);
    inspectorSplitter.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const limits = inspectorWidthLimits();
      if (event.key === "Home") setInspectorWidth(limits.minimum);
      else if (event.key === "End") setInspectorWidth(limits.maximum);
      else setInspectorWidth(inspectorWidth + (event.key === "ArrowLeft" ? 16 : -16));
    });
    window.addEventListener("resize", closeAnnotationContextMenu);

    dialog.querySelector("[data-annotation-grid]").addEventListener("change", event => {
      const restoreSelectionFocus = selectedIds.size > 0;
      state.gridVisible = event.target.checked;
      pushHistory();
      render();
      if (restoreSelectionFocus) focusLastSelectedObject();
    });
    dialog.querySelector("[data-annotation-snap]").addEventListener("change", event => {
      const restoreSelectionFocus = selectedIds.size > 0;
      state.snapToGrid = event.target.checked;
      pushHistory();
      render();
      if (restoreSelectionFocus) focusLastSelectedObject();
    });
    zoomSelect.addEventListener("change", event => {
      const zoomPoint = lastZoomPoint || { x: workspace.clientWidth / 2, y: workspace.clientHeight / 2 };
      queueCanvasZoom(Number(event.target.value) / 100, zoomPoint.x, zoomPoint.y);
    });
    templateUploadInput?.addEventListener("change", async event => {
      const file = event.target.files?.[0] || null;
      event.target.value = "";
      await uploadTemplate(file);
    });
    dialog.querySelector("[data-annotation-entity-allow-overlapping-lines]").addEventListener("change", event => {
      pushHistory();
      state.allowOverlappingEntityLines = event.target.checked;
      pushHistory();
      setStatus(event.target.checked
        ? "Relationship lines may share perfectly aligned routes. Select Auto Format - Org Tree to tighten the layout."
        : "Relationship lines use separate ports and lanes. Select Auto Format - Org Tree to add routing space.");
      renderWithWorkspaceExpansion();
    });
    dialog.querySelector("[data-annotation-entity-hide-all-relationships]").addEventListener("change", event => {
      pushHistory();
      state.hideAllEntityRelationships = event.target.checked;
      pushHistory();
      setStatus(event.target.checked
        ? "All Entity relationship lines are hidden."
        : "All Entity relationship lines are visible.");
      renderWithWorkspaceExpansion();
    });
    entityAnnotationInput.addEventListener("input", event => {
      const entity = selectedObjects().length === 1 && selectedObjects()[0]?.type === "entity"
        ? selectedObjects()[0]
        : null;
      if (!entity || entity.locked) return;
      const result = setAnnotationEntityAnnotation(state, entity, event.target.value);
      result.removedIds?.forEach(id => selectedIds.delete(id));
      scheduleHistory();
      setStatus(event.target.value.trim()
        ? `${annotationObjectLabel(entity)} annotation updated.`
        : `${annotationObjectLabel(entity)} annotation removed.`);
      renderWithWorkspaceExpansion();
    });
    entityAnnotationInput.addEventListener("change", pushHistory);
    dialog.querySelector("[data-annotation-entity-anchor-table]").addEventListener("change", event => {
      const entity = selectedObjects().length === 1 && selectedObjects()[0]?.type === "entity"
        ? selectedObjects()[0]
        : null;
      if (!entity || entity.locked) return;
      entity.anchorTable = event.target.checked;
      pushHistory();
      setStatus(event.target.checked
        ? `${annotationObjectLabel(entity)} is now an anchor table and will not move during Auto Format.`
        : `${annotationObjectLabel(entity)} can now move during Auto Format.`);
      renderWithWorkspaceExpansion();
    });
    dialog.querySelector("[data-annotation-entity-unanchor-all]").addEventListener("change", event => {
      pushHistory();
      const result = setAnnotationEntitiesUnanchored(state, event.target.checked);
      pushHistory();
      setStatus(event.target.checked
        ? `${result.entityCount} Entit${result.entityCount === 1 ? "y is" : "ies are"} now unanchored.`
        : `${result.entityCount} Entit${result.entityCount === 1 ? "y is" : "ies are"} now anchored at their current positions.`);
      renderWithWorkspaceExpansion();
    });
    objectTreeSearch?.addEventListener("input", event => {
      objectTreeSearchQuery = event.target.value;
      renderObjectTree();
    });
    entityFieldList.addEventListener("change", event => {
      const control = event.target.closest?.("[data-annotation-entity-field-property]");
      if (!control) return;
      updateEntityFieldProperty(
        control.dataset.annotationEntityId,
        Number.parseInt(control.dataset.annotationEntityFieldIndex, 10),
        control.dataset.annotationEntityFieldProperty,
        control.checked
      );
    });
    dialog.querySelector("[data-annotation-entity-show-data-types]").addEventListener("change", event => {
      const entity = selectedObjects().length === 1 && selectedObjects()[0]?.type === "entity"
        ? selectedObjects()[0]
        : null;
      if (!entity || entity.locked) return;
      setAnnotationEntityDataTypeVisibility(entity, event.target.checked);
      const layoutResult = resolveAnnotationEntitySizeChangeLayout(state, entity);
      pushHistory();
      setStatus(`Data types ${event.target.checked ? "shown" : "hidden"}.`);
      renderWithWorkspaceExpansion();
      if (annotationEntityAnchorShortcutWarningAllowed(state)
        && (layoutResult.unresolvedOverlapCount || layoutResult.unresolvedRouteContactCount)) {
        void openAnnotationInformationDialog(
          "Because an Anchor or otherwise fixed table could not be moved, PMT kept the fixed table in place and rendered the affected relationships using the best available route.",
          "Anchor Table Shortcut"
        );
      }
    });
    [
      ["[data-annotation-entity-show-keys]", "showKeyColumn", "PK/FK column"],
      ["[data-annotation-entity-fk-at-top]", "foreignKeysAtTop", "foreign keys"],
      ["[data-annotation-entity-show-self-relationships]", "showSelfRelationships", "self-referencing relationships"]
    ].forEach(([selector, property, label]) => {
      dialog.querySelector(selector).addEventListener("change", event => {
        const entity = selectedObjects().length === 1 && selectedObjects()[0]?.type === "entity"
          ? selectedObjects()[0]
          : null;
        if (!entity || entity.locked) return;
        entity[property] = event.target.checked;
        pushHistory();
        setStatus(property === "foreignKeysAtTop"
          ? `Foreign keys shown ${event.target.checked ? "at the top below primary keys" : "in their original positions"}.`
          : `${label[0].toUpperCase()}${label.slice(1)} ${event.target.checked ? "shown" : "hidden"}.`);
        renderWithWorkspaceExpansion();
      });
    });
    dialog.querySelectorAll(
      "[data-annotation-relationship-show-symbols], [data-annotation-entity-relationship-show-symbols]"
    ).forEach(control => {
      control.addEventListener("change", event => {
        applyAnnotationEntityRelationshipGroupStyle(state, { showSymbols: event.target.checked });
        pushHistory();
        setStatus(event.target.checked
          ? "Relationship arrows and symbols shown."
          : "Relationship arrows and symbols hidden.");
        renderWithWorkspaceExpansion();
      });
    });
    dialog.querySelector("[data-annotation-outline]").addEventListener("change", event => {
      const visible = event.target.checked;
      event.target.indeterminate = false;
      styles.outlineVisible = visible;
      selectedObjects().forEach(object => {
        if (["rectangle", "circle", "textbox", "entity"].includes(object.type) && !object.locked) {
          object.outlineVisible = visible;
        }
      });
      pushHistory();
      renderWithWorkspaceExpansion();
    });
    dialog.querySelector("[data-annotation-transparent-fill]").addEventListener("change", event => {
      selectedObjects().forEach(object => {
        if (["rectangle", "circle", "textbox", "entity"].includes(object.type) && !object.locked) {
          object.fill = event.target.checked ? "none" : styles.fill;
        }
      });
      pushHistory();
      render();
    });
    dialog.querySelectorAll("[data-annotation-style]").forEach(control => {
      control.addEventListener("input", () => {
        applyAnnotationStyle(control.dataset.annotationStyle, control.value, selectedObjects(), styles, state);
        scheduleHistory();
        renderWithWorkspaceExpansion();
      });
      control.addEventListener("change", pushHistory);
    });
    bindAnnotationColorPickers(dialog, {
      apply(name, color) {
        applyAnnotationStyle(name, color, selectedObjects(), styles, state);
        pushHistory();
        renderWithWorkspaceExpansion();
      },
      askForColor: context.askForColor,
      setStatus
    });
    textInput.addEventListener("input", () => {
      const object = selectedObjects()[0];
      if (selectedIds.size === 1 && object?.type === "textbox" && !object.locked) {
        object.text = textInput.value;
        scheduleHistory();
        render();
      }
    });
    textInput.addEventListener("change", pushHistory);

    const cancelButtons = [...dialog.querySelectorAll("[data-annotation-cancel]")];
    cancelButtons.forEach(button => {
      button.addEventListener("click", () => finish(null));
    });
    const applyButtons = [...dialog.querySelectorAll("[data-annotation-apply]")];
    const setApplyingUi = value => {
      applying = value === true;
      applyButtons.forEach(button => { button.disabled = applying; });
      cancelButtons.forEach(button => { button.disabled = applying; });
      maximizeButton.disabled = applying;
      restoreButton.disabled = applying;
      toolbar.inert = applying;
      main.inert = applying;
      if (applying) closeAnnotationContextMenu();
    };
    const applyAnnotation = async event => {
      if (applying) return;
      const applyButton = event.currentTarget;
      pushHistory();
      setApplyingUi(true);
      setStatus(context.applyingMessage || "Applying the annotation...");
      try {
        const hasOriginalImage = state.objects.some(object => object.type === "embedded-image"
          && object.isOriginalImage);
        if (!hasOriginalImage) {
          pendingPermanentCrop = null;
          originalReference = "";
          state.originalReference = "";
        }
        if (pendingPermanentCrop && !pendingPermanentCrop.reference) {
          const stored = await context.persistCroppedOriginal({
            blob: pendingPermanentCrop.blob,
            fileName: pendingPermanentCrop.fileName
          });
          const storedReference = String(stored?.reference || stored?.url || stored || "").trim();
          const storedSource = String(stored?.url || storedReference).trim();
          if (!storedReference) throw new Error("The permanently cropped image could not be stored.");
          pendingPermanentCrop.reference = storedReference;
          originalReference = storedReference;
          state.originalReference = storedReference;
          const originalImage = state.objects.find(object => object.type === "embedded-image"
            && object.isOriginalImage);
          if (originalImage) {
            originalImage.source = storedSource;
            embeddedSources.set(originalImage.id, storedSource);
          }
        }
        const finalState = normalizeAnnotationState(state, {
          width: state.width,
          height: state.height,
          originalReference
        });
        const result = {
          state: finalState,
          svg: buildAnnotationSvg(finalState),
          originalReference,
          fileName: annotationFileName(context.originalFileName)
        };
        if (typeof context.apply === "function") await context.apply(result);
        finish(result);
      } catch (error) {
        setApplyingUi(false);
        setStatus(error?.message || "The annotation could not be applied. Your edits are still open.");
        applyButton?.focus({ preventScroll: true });
      }
    };
    applyButtons.forEach(button => button.addEventListener("click", applyAnnotation));
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      if (applying) {
        setStatus("Wait for the annotation upload to finish.");
        return;
      }
      finish(null);
    });
    dialog.addEventListener("dblclick", event => {
      const treeRow = event.target.closest?.("[data-annotation-tree-node]");
      if (!treeRow || event.target.closest?.("button, input, select, textarea")) return;
      const kind = treeRow.dataset.annotationTreeKind;
      const id = treeRow.dataset.annotationTreeId;
      if (!kind || !id) return;
      event.preventDefault();
      const ids = treeNodeIds(kind, id);
      if (ids.length !== selectedIds.size || !ids.every(objectId => selectedIds.has(objectId))) {
        selectTreeNode(kind, id);
      }
      zoomToTreeNode(kind, id);
    });
    dialog.addEventListener("paste", async event => {
      if (event.target.closest?.("input, textarea, select")) return;

      const hasClipboardImage = annotationClipboardHasImage(event.clipboardData);
      if (hasClipboardImage) event.preventDefault();
      const file = await annotationClipboardImageFile(event.clipboardData);
      if (!file) {
        if (!nativeClipboard) return;
        event.preventDefault();
        pasteNativeSelection();
        return;
      }

      event.preventDefault();
      if (clipboardImageBusy) {
        setStatus("Wait for the current image upload to finish.");
        return;
      }

      clipboardImageBusy = true;
      setStatus("Uploading the pasted image...");
      try {
        await insertUploadedImage(file);
        setStatus(`${file.name || "Image"} uploaded and added to the canvas.`);
      } catch (error) {
        setStatus(error?.message || "The pasted image could not be uploaded.");
      } finally {
        clipboardImageBusy = false;
      }
    });

    dialog.addEventListener("keydown", event => {
      if (applying) {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setStatus("Wait for the annotation upload to finish.");
        }
        return;
      }

      const entityHeaderAction = event.target.closest?.("[data-annotation-entity-header-action]");
      if (entityHeaderAction && ["Enter", " "].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        activateEntityHeaderAction(entityHeaderAction);
        return;
      }

      const inspectorTab = event.target.closest?.("[data-annotation-inspector-tab]");
      if (inspectorTab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        const tabs = [...dialog.querySelectorAll("[data-annotation-inspector-tab]:not([hidden])")];
        const currentIndex = Math.max(0, tabs.indexOf(inspectorTab));
        const nextIndex = event.key === "Home"
          ? 0
          : event.key === "End"
            ? tabs.length - 1
            : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        event.preventDefault();
        setInspectorTab(tabs[nextIndex].dataset.annotationInspectorTab);
        tabs[nextIndex].focus({ preventScroll: true });
        return;
      }

      const treeRow = event.target.closest?.("[data-annotation-tree-node]");
      if (treeRow && event.target === treeRow) {
        const rows = [...objectTree.querySelectorAll("[data-annotation-tree-node]")];
        const currentIndex = rows.indexOf(treeRow);
        if (["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
          const nextIndex = event.key === "Home"
            ? 0
            : event.key === "End"
              ? rows.length - 1
              : Math.max(0, Math.min(rows.length - 1, currentIndex + (event.key === "ArrowDown" ? 1 : -1)));
          event.preventDefault();
          rows[nextIndex]?.focus({ preventScroll: true });
          return;
        }
        if (["Enter", " "].includes(event.key)) {
          event.preventDefault();
          selectTreeNode(treeRow.dataset.annotationTreeKind, treeRow.dataset.annotationTreeId, event);
          return;
        }
        if (event.key === "F2") {
          event.preventDefault();
          renameTreeNode(treeRow.dataset.annotationTreeKind, treeRow.dataset.annotationTreeId);
          return;
        }
        if (["Delete", "Backspace"].includes(event.key)) {
          event.preventDefault();
          if (!treeNodeIds(treeRow.dataset.annotationTreeKind, treeRow.dataset.annotationTreeId)
            .some(id => selectedIds.has(id))) {
            selectTreeNode(treeRow.dataset.annotationTreeKind, treeRow.dataset.annotationTreeId);
          }
          deleteTreeSelection();
          return;
        }
      }

      if (!contextMenu.hidden) {
        if (event.key === "Tab") {
          event.preventDefault();
          closeAnnotationContextMenu();
          return;
        }
        const menuItems = [...contextMenu.querySelectorAll("button:not(:disabled)")];
        const currentIndex = menuItems.indexOf(document.activeElement);
        let nextIndex = -1;
        if (event.key === "ArrowDown") nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % menuItems.length;
        else if (event.key === "ArrowUp") nextIndex = currentIndex < 0 ? menuItems.length - 1 : (currentIndex - 1 + menuItems.length) % menuItems.length;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = menuItems.length - 1;
        if (nextIndex >= 0 && menuItems.length) {
          event.preventDefault();
          event.stopPropagation();
          menuItems[nextIndex].focus({ preventScroll: true });
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          closeAnnotationContextMenu();
          return;
        }
      }

      const requestsContextMenu = event.key === "ContextMenu" || (event.shiftKey && event.key === "F10");
      const formControl = event.target.closest?.("input, textarea, select, button");
      if (requestsContextMenu && selectedIds.size && !formControl) {
        const selectedId = selectedIds.has(lastSelectedObjectId)
          ? lastSelectedObjectId
          : [...selectedIds].at(-1);
        const selectedElement = selectedId
          ? [...canvas.querySelectorAll("[data-annotation-object-id]")]
              .find(element => element.dataset.annotationObjectId === selectedId)
          : null;
        if (selectedElement) {
          const bounds = selectedElement.getBoundingClientRect();
          event.preventDefault();
          event.stopPropagation();
          closeAnnotationContextMenu();
          openAnnotationContextMenuAt({
            clientX: Math.min(bounds.right, bounds.left + 32),
            clientY: Math.min(bounds.bottom, bounds.top + 32)
          });
          return;
        }
      }

      handleAnnotationKeyDown(event, {
        state,
        selectedIds,
        selectedObjects,
        setTool,
        setStatus,
        pushHistory,
        restoreHistory,
        historyIndex: () => historyIndex,
        historyLength: () => history.length,
        render: renderWithWorkspaceExpansion,
        copySelection: copyNativeSelection,
        pasteSelection: pasteNativeSelection,
        duplicateSelection,
        insertObject: insertToolbarObject,
        activateCropTool,
        focusSelection: focusLastSelectedObject,
        focusWorkspace: () => workspace.focus({ preventScroll: true })
      });
    });

    if (context.signal?.aborted) {
      finish(null);
      return;
    }
    if (embedded) {
      dialog.show();
    } else {
      dialog.showModal();
    }
    if (context.initiallyMaximized === true) setMaximized(true);
    workspaceBounds = annotationWorkspaceBounds(state, workspace.clientWidth, workspace.clientHeight);
    setInspectorWidth(inspectorWidth);
    setTool("select");
    setInspectorTab("format");
    renderTemplateList();
    if (templateStatus && context.templateLibraryError) templateStatus.textContent = context.templateLibraryError;
    render();
    window.setTimeout(() => {
      if (Number.isFinite(context.initialZoom)) centerCanvasAtZoom(context.initialZoom);
      else fitCanvas();
      if (context.initialTemplate) {
        const objects = insertTemplate(context.initialTemplate, templateInsertionCenter());
        if (objects.length) setStatus(`Template "${context.initialTemplate.name}" added to the canvas.`);
      }
    }, 0);
  });
}

function annotationDialogHtml(context = {}) {
  const title = escapeXmlText(context.title || "Image Annotation");
  const subtitle = escapeXmlText(context.subtitle || "Original image plus editable vector annotations");
  const applyLabel = escapeXmlText(context.applyLabel || "Apply to RTE");
  return `
    <div class="image-annotation-window">
      <div class="dialog-head image-annotation-head" data-dialog-drag-ignore>
        <div>
          <h2 id="imageAnnotationTitle">${title}</h2>
          <p>${subtitle}</p>
        </div>
        <div class="image-annotation-head-actions">
          <button type="button" class="icon-btn dialog-maximize-button" data-annotation-maximize title="Maximize" aria-label="Maximize">Maximize</button>
          <button type="button" class="icon-btn" data-annotation-cancel title="Close" aria-label="Close">Close</button>
        </div>
      </div>
      <div class="image-annotation-toolbar" role="toolbar" aria-label="Image annotation tools">
        <div class="image-annotation-tool-group" aria-label="Drawing tools">
          ${annotationToolButton("select", "Select (V)", true)}
          ${annotationToolButton("crop", "Crop (C)")}
          ${annotationToolButton("rectangle", "Rectangle (R)")}
          ${annotationToolButton("circle", "Circle (O)")}
          ${annotationToolButton("arrow", "Arrow (A)")}
          ${annotationToolButton("line", "Line (L)")}
          ${annotationToolButton("textbox", "Text Box (T)")}
          ${annotationToolButton("entity", "Entity (E)")}
        </div>
        <div class="image-annotation-tool-group" aria-label="History">
          ${annotationActionButton("undo", "Undo", "Undo (Ctrl+Z)")}
          ${annotationActionButton("redo", "Redo", "Redo (Ctrl+Y)")}
          ${annotationActionButton("delete", "Delete", "Delete selected annotations", true)}
        </div>
        <div class="image-annotation-tool-group image-annotation-view-tools" aria-label="Canvas view">
          <label class="inline-check"><input type="checkbox" data-annotation-grid checked><span>Grid</span></label>
          <label class="inline-check"><input type="checkbox" data-annotation-snap checked><span>Snap</span></label>
          <button type="button" data-annotation-zoom="out" title="Zoom Out" aria-label="Zoom Out">-</button>
          <select data-annotation-zoom-select class="image-annotation-zoom-select" aria-label="Zoom percentage">
            ${annotationZoomPercentages.map(percent => `<option value="${percent}"${percent === 100 ? " selected" : ""}>${percent}%</option>`).join("")}
          </select>
          <button type="button" data-annotation-zoom="in" title="Zoom In" aria-label="Zoom In">+</button>
          <button type="button" data-annotation-zoom="fit">Fit</button>
          <button type="button" data-annotation-toggle-inspector aria-controls="imageAnnotationInspector" aria-expanded="true" title="Hide Right Pane" aria-label="Hide Right Pane">Hide Right Pane</button>
        </div>
        <div class="image-annotation-tool-group image-annotation-maximized-actions" data-annotation-maximized-actions hidden aria-label="Dialog actions">
          <span class="image-annotation-maximized-status" data-annotation-maximized-status role="status" aria-live="polite"></span>
          <button type="button" class="secondary text-icon-button" data-annotation-cancel><span class="button-icon" aria-hidden="true">&#10005;</span><span>Cancel</span></button>
          <button type="button" class="primary text-icon-button" data-annotation-apply><span class="button-icon" aria-hidden="true">&#10003;</span><span>${applyLabel}</span></button>
        </div>
      </div>
      <div class="image-annotation-main" data-annotation-main>
        <div class="image-annotation-workspace" data-annotation-workspace tabindex="0" aria-label="Annotation canvas. Mouse wheel scrolls. Control plus mouse wheel zooms. Middle mouse drag pans.">
          <div class="image-annotation-canvas-stage" data-annotation-canvas-stage>
            <svg class="image-annotation-canvas" data-annotation-canvas xmlns="${svgNamespace}" role="group" aria-label="Image annotation canvas"></svg>
          </div>
        </div>
        <div class="image-annotation-zoom-shield" data-annotation-zoom-shield aria-hidden="true" hidden></div>
        <div class="image-annotation-inspector-splitter" data-annotation-inspector-splitter role="separator" aria-orientation="vertical" aria-label="Resize right pane" tabindex="0"></div>
        <aside class="image-annotation-inspector" id="imageAnnotationInspector" data-annotation-inspector aria-label="Annotation right pane">
          <div class="image-annotation-inspector-tabs" role="tablist" aria-label="Annotation right pane">
            <button type="button" id="imageAnnotationFormatTab" role="tab" aria-selected="true" aria-controls="imageAnnotationFormatPanel" data-annotation-inspector-tab="format">Format</button>
            <button type="button" id="imageAnnotationEntityTab" role="tab" aria-selected="false" aria-controls="imageAnnotationEntityPanel" tabindex="-1" data-annotation-inspector-tab="entity" hidden>Entity</button>
            <button type="button" id="imageAnnotationTemplateTab" role="tab" aria-selected="false" aria-controls="imageAnnotationTemplatePanel" tabindex="-1" data-annotation-inspector-tab="template">Template</button>
            <button type="button" id="imageAnnotationObjectsTab" role="tab" aria-selected="false" aria-controls="imageAnnotationObjectsPanel" tabindex="-1" data-annotation-inspector-tab="objects">Objects</button>
          </div>
          <p class="image-annotation-selection-label" data-annotation-selection-label>No selection</p>
          <div id="imageAnnotationFormatPanel" role="tabpanel" aria-labelledby="imageAnnotationFormatTab" data-annotation-inspector-panel="format">
          <section class="image-annotation-format-section" aria-labelledby="imageAnnotationShapeFormat">
            <h4 id="imageAnnotationShapeFormat">Shape</h4>
            <p class="image-annotation-entity-hint" data-annotation-relationship-format-hint hidden>Line color, line width, and arrow head apply to every Entity relationship on this canvas.</p>
            <div class="image-annotation-inspector-grid">
              ${annotationColorFieldHtml("fill", "Fill", "Background Color", defaultStyles.fill, "background")}
              ${annotationColorFieldHtml("stroke", "Outline color", "Outline Color", defaultStyles.stroke, "outline")}
              <label class="inline-check image-annotation-wide"><input type="checkbox" data-annotation-outline checked><span>Outline</span></label>
              <label class="inline-check image-annotation-wide"><input type="checkbox" data-annotation-transparent-fill><span>Transparent fill</span></label>
              <label class="field image-annotation-wide"><span>Opacity (%)</span><input type="number" min="0" max="100" step="1" value="100" data-annotation-style="opacity"></label>
              <label class="field"><span>Line width</span><input type="number" min="1" max="40" step="1" value="${defaultStyles.strokeWidth}" data-annotation-style="strokeWidth"></label>
              <label class="field"><span>Arrow head</span><input type="number" min="6" max="160" step="2" value="${defaultStyles.arrowSize}" data-annotation-style="arrowSize"></label>
              <label class="inline-check image-annotation-wide" data-annotation-relationship-symbols-field hidden><input type="checkbox" data-annotation-relationship-show-symbols><span>Show arrows and relationship symbols (global)</span></label>
            </div>
          </section>
          <section class="image-annotation-format-section" aria-labelledby="imageAnnotationTextFormat">
            <h4 id="imageAnnotationTextFormat">Text</h4>
            <div class="image-annotation-inspector-grid">
              ${annotationColorFieldHtml("textColor", "Text color", "Font Color", defaultStyles.textColor, "font")}
              <label class="field"><span>Font</span><select data-annotation-style="fontFamily">${annotationFontOptions(defaultStyles.fontFamily)}</select></label>
              <label class="field"><span>Font size</span><input type="number" min="6" max="240" step="1" value="${defaultStyles.fontSize}" data-annotation-style="fontSize"></label>
              <label class="field"><span>Horizontal alignment</span><select aria-label="Horizontal alignment" data-annotation-style="textAlign"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
              <label class="field"><span>Vertical alignment</span><select aria-label="Vertical alignment" data-annotation-style="textVerticalAlign"><option value="top">Top</option><option value="middle">Middle</option><option value="bottom">Bottom</option></select></label>
              <label class="field image-annotation-wide" data-annotation-text-field hidden><span>Text</span><textarea rows="5" data-annotation-text></textarea></label>
            </div>
          </section>
          <div class="image-annotation-help">
            <strong>Canvas controls</strong>
            <span>Wheel: scroll</span>
            <span>Ctrl + wheel: zoom at cursor</span>
            <span>Middle drag: pan</span>
            <span>Shift/Ctrl + click: multi-select</span>
            <span>Shift drag: horizontal only</span>
            <span>Alt drag: vertical only</span>
            <span>Corner handles: proportional resize</span>
            <span>Side handles: resize width or height</span>
            <span>Double-click an Entity to edit its definition</span>
            <span>Ctrl + A: select all canvas objects</span>
            <span>Ctrl + C/V/D: copy, paste, duplicate</span>
            <span>Blank-canvas drag: marquee-select</span>
          </div>
          </div>
          <div id="imageAnnotationEntityPanel" role="tabpanel" aria-labelledby="imageAnnotationEntityTab" data-annotation-inspector-panel="entity" hidden>
            <section class="image-annotation-format-section image-annotation-entity-format" aria-labelledby="imageAnnotationEntityFormat" data-annotation-entity-format>
              <h4 id="imageAnnotationEntityFormat">Entity</h4>
              <label class="field image-annotation-entity-annotation-field"><span>Entity Annotation</span><textarea rows="5" maxlength="10000" spellcheck="true" data-annotation-entity-annotation></textarea></label>
              <div class="image-annotation-inspector-grid">
                ${annotationColorFieldHtml("entityNameTextColor", "Entity name text color", "Entity Name Text Color", defaultEntityTextColor, "font")}
                ${annotationColorFieldHtml("entityHeaderFill", "Header background color", "Entity Header Background Color", defaultEntityFill, "background")}
              </div>
              <div class="image-annotation-entity-display-options">
                <button type="button" data-annotation-entity-auto-format-org-tree>Auto Format - Org Tree</button>
                <label class="inline-check"><input type="checkbox" data-annotation-entity-anchor-table><span>Anchor table (do not move)</span></label>
                <label class="inline-check"><input type="checkbox" data-annotation-entity-allow-overlapping-lines><span>Allow Overlapping Lines</span></label>
                <label class="inline-check"><input type="checkbox" data-annotation-entity-show-keys checked><span>Show PK/FK column</span></label>
                <label class="inline-check"><input type="checkbox" data-annotation-entity-show-data-types><span>Show data types</span></label>
                <label class="inline-check"><input type="checkbox" data-annotation-entity-fk-at-top><span>FK at the Top</span></label>
                <label class="inline-check"><input type="checkbox" data-annotation-entity-show-self-relationships><span>Show self-referencing relationships</span></label>
                <label class="inline-check"><input type="checkbox" data-annotation-entity-relationship-show-symbols><span>Show arrows and relationship symbols (global)</span></label>
                <label class="inline-check"><input type="checkbox" data-annotation-entity-hide-all-relationships><span>Turn off all relationship lines (global)</span></label>
                <label class="inline-check"><input type="checkbox" data-annotation-entity-unanchor-all><span>Unachor all Entities (global)</span></label>
              </div>
              <p class="image-annotation-entity-fields-help">Drag fields to set their original order. Mark PK, FK, or Important fields here; map FK targets with Map. FK at the Top changes only the Entity view.</p>
              <div class="image-annotation-entity-field-columns" aria-hidden="true"><span></span><span>Field</span><span>PK</span><span>FK</span><span>Imp.</span><span></span></div>
              <div class="image-annotation-entity-fields" role="list" aria-label="Entity fields" data-annotation-entity-fields></div>
              ${typeof context.generatePmtDatabaseSchema === "function"
                ? `<button type="button" class="image-annotation-generate-pmt-schema" data-annotation-generate-pmt-schema>Generate PMT Database Schema</button>`
                : ""}
            </section>
          </div>
          <div id="imageAnnotationTemplatePanel" role="tabpanel" aria-labelledby="imageAnnotationTemplateTab" data-annotation-inspector-panel="template" hidden>
            <div class="image-annotation-template-actions">
              <p>With no selection, a template adds new objects. With a selection, it applies formatting only. You can also save personal templates or restore missing shared defaults.</p>
              <button type="button" class="primary" data-annotation-template-save>Save Selection as Template</button>
              <button type="button" data-annotation-template-upload>Upload Template</button>
              <input type="file" accept=".json,.pmt-template.json,application/json" data-annotation-template-upload-input hidden>
              <button type="button" data-annotation-template-action="restore-defaults">Restore Default Templates</button>
            </div>
            <section class="image-annotation-format-section" aria-labelledby="imageAnnotationDrawingDefaults">
              <h4 id="imageAnnotationDrawingDefaults">Drawing defaults</h4>
              <div class="image-annotation-template-defaults">
                <button type="button" data-annotation-template-default="arrow">Use Selected Arrow</button>
                <button type="button" data-annotation-template-reset-default="arrow">Reset Arrow</button>
                <button type="button" data-annotation-template-default="rectangle">Use Selected Rectangle</button>
                <button type="button" data-annotation-template-reset-default="rectangle">Reset Rectangle</button>
              </div>
            </section>
            <p class="image-annotation-template-status" data-annotation-template-status role="status" aria-live="polite"></p>
            <div class="image-annotation-template-list" data-annotation-template-list aria-label="Saved annotation templates"></div>
          </div>
          <div id="imageAnnotationObjectsPanel" role="tabpanel" aria-labelledby="imageAnnotationObjectsTab" data-annotation-inspector-panel="objects" hidden>
            <div class="image-annotation-object-tree-actions" role="toolbar" aria-label="Object tree actions">
              <button type="button" data-annotation-tree-action="rename">Rename</button>
              <button type="button" data-annotation-tree-action="copy">Copy</button>
              <button type="button" data-annotation-tree-action="paste">Paste</button>
              <button type="button" data-annotation-tree-action="delete">Delete</button>
            </div>
            <label class="image-annotation-object-tree-search"><span>Search objects</span><input type="search" placeholder="Search objects" aria-label="Search objects" autocomplete="off" data-annotation-object-search data-annotation-object-tree-search data-annotation-tree-search></label>
            <p class="image-annotation-object-tree-help">Top items appear in front. The line shows where a dragged row will land. Drop above a group header to keep it at the root, or below the header to move it into that group.</p>
            <button type="button" class="image-annotation-object-tree-root-drop" data-annotation-tree-root-drop aria-label="Move selected object or group to the top of the root object list">Move to root (top)</button>
            <div class="image-annotation-object-tree" data-annotation-object-tree role="tree" tabindex="0" aria-label="Canvas objects, topmost first"></div>
          </div>
        </aside>
      </div>
      ${annotationContextMenuHtml()}
      <div class="dialog-actions image-annotation-actions">
        <span class="image-annotation-status" data-annotation-status role="status" aria-live="polite"></span>
        <div class="dialog-action-group">
          <button type="button" class="secondary text-icon-button" data-annotation-cancel><span class="button-icon" aria-hidden="true">&#10005;</span><span>Cancel</span></button>
          <button type="button" class="primary text-icon-button" data-annotation-apply><span class="button-icon" aria-hidden="true">&#10003;</span><span>${applyLabel}</span></button>
        </div>
      </div>
      <button type="button" class="image-annotation-restore-button" data-annotation-restore title="Restore" aria-label="Restore" hidden><span class="button-icon" aria-hidden="true"><svg class="button-svg-icon" viewBox="0 0 24 24" focusable="false"><rect x="4" y="7" width="13" height="13" rx="1"></rect><rect x="7" y="4" width="13" height="13" rx="1"></rect></svg></span></button>
    </div>
  `;
}

function annotationToolButton(tool, label, pressed = false) {
  return `<button type="button" data-annotation-tool="${tool}" title="${label}" aria-label="${label}" aria-pressed="${pressed}" class="${pressed ? "is-active" : ""}"><span class="button-icon" aria-hidden="true">${annotationToolIconSvg(tool)}</span></button>`;
}

function annotationColorFieldHtml(name, label, title, selectedColor, icon) {
  return `<div class="image-annotation-color-field"><span>${label}</span><div class="image-annotation-color-controls">${sharedRichColorPickerHtml({ name, title, selectedColor, icon })}<div class="image-annotation-recent-colors" data-annotation-recent-colors="${name}" aria-label="Recent ${label} colors" hidden></div></div></div>`;
}

function annotationEntityFieldListHtml(entity) {
  const fields = Array.isArray(entity?.fields) ? entity.fields : [];
  if (!fields.length) return `<p class="image-annotation-object-tree-empty">No fields.</p>`;
  return fields.map((field, index) => {
    const fieldName = formatAnnotationEntityIdentifier(field.name) || `Field ${index + 1}`;
    const draggable = entity.locked !== true;
    const mapping = annotationEntityFieldForeignKeyMapping(entity, field.name);
    const sourceIndex = mapping?.columns.findIndex(column => column.toLowerCase() === String(field.name || "").toLowerCase()) ?? -1;
    const referencedField = sourceIndex >= 0
      ? mapping?.referencedColumns[sourceIndex] || mapping?.referencedColumns[0] || ""
      : "";
    const mappingLabel = mapping
      ? `${formatAnnotationEntityIdentifier(mapping.referencedSchema, mapping.referencedTable)}.${formatAnnotationEntityIdentifier(referencedField)}`
      : "";
    const relationshipLabel = safeAnnotationEntityRelationshipType(mapping?.relationshipType) === "one-to-one"
      ? "1 to 1"
      : safeAnnotationEntityRelationshipType(mapping?.relationshipType) === "one-to-many"
        ? "1 to many"
        : "arrow";
    const checkbox = (property, label, checked) => `<input class="image-annotation-entity-field-checkbox" type="checkbox" draggable="false" title="${escapeXmlAttr(label)}" aria-label="${escapeXmlAttr(label)} for ${escapeXmlAttr(fieldName)}" data-annotation-entity-field-property="${property}" data-annotation-entity-field-index="${index}" data-annotation-entity-id="${escapeXmlAttr(entity.id)}"${checked ? " checked" : ""}${entity.locked ? " disabled" : ""}>`;
    const mapTitle = mappingLabel
      ? `Map foreign key. Current target: ${mappingLabel} (${relationshipLabel}).`
      : "Map foreign key";
    const mapControl = field.isForeignKey
      ? `<button type="button" class="image-annotation-entity-field-map" draggable="false" title="${escapeXmlAttr(mapTitle)}" aria-label="Map foreign key for ${escapeXmlAttr(fieldName)}" data-annotation-entity-field-map data-annotation-entity-field-index="${index}" data-annotation-entity-id="${escapeXmlAttr(entity.id)}"${entity.locked ? " disabled" : ""}>Map</button>`
      : `<span aria-hidden="true"></span>`;
    return `<div class="image-annotation-object-tree-row image-annotation-entity-field-row" role="listitem" tabindex="0" draggable="${draggable}" aria-label="${escapeXmlAttr(fieldName)}" data-annotation-entity-field-index="${index}" data-annotation-entity-id="${escapeXmlAttr(entity.id)}"><span class="image-annotation-object-tree-icon image-annotation-entity-field-drag" aria-hidden="true">&#8942;&#8942;</span><span class="image-annotation-object-tree-label" title="${escapeXmlAttr(fieldName)}">${escapeXmlText(fieldName)}</span>${checkbox("isPrimaryKey", "PK", field.isPrimaryKey)}${checkbox("isForeignKey", "FK", field.isForeignKey)}${checkbox("isImportant", "Important", field.isImportant)}${mapControl}</div>`;
  }).join("");
}

export function annotationObjectTreeHtml(nodes, selectedIds, emptyMessage = "No canvas objects.") {
  if (!nodes.length) return `<p class="image-annotation-object-tree-empty">${escapeXmlText(emptyMessage)}</p>`;
  const selected = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  const row = (node, level) => {
    const object = node.kind === "object" ? node.object : null;
    const fixedRelationships = ["relationships", "relationship"].includes(node.kind);
    const fixedOriginalImage = object?.type === "embedded-image" && object.isOriginalImage === true;
    const fixedNode = fixedRelationships || fixedOriginalImage;
    const groupChildren = node.kind === "group" ? node.allChildren || node.children : [];
    const relationshipChildren = node.kind === "relationships" ? node.allChildren || node.children : [];
    const nodeIds = node.kind === "group" ? groupChildren.map(child => child.id) : [node.id];
    const selectedCount = nodeIds.filter(id => selected.has(id)).length;
    const isSelected = selectedCount === nodeIds.length;
    const isPartial = (selectedCount > 0 && !isSelected)
      || (node.kind === "relationships" && !isSelected && relationshipChildren.some(child => selected.has(child.id)));
    const canDrag = fixedNode
      ? false
      : node.kind === "group"
      ? groupChildren.every(child => !child.object.locked)
      : !object.locked;
    const canDelete = fixedNode
      ? false
      : node.kind === "group"
      ? groupChildren.some(child => !child.object.locked)
      : !object.locked;
    const ownVisible = node.visible !== false;
    const effectiveVisible = node.effectiveVisible !== false;
    const isLocked = object?.locked === true;
    const isAnchored = object?.type === "entity" && object.anchorTable === true;
    const visibilityAction = fixedRelationships
      ? ""
      : `<button type="button" class="image-annotation-object-tree-visibility${ownVisible ? "" : " is-hidden"}" data-annotation-tree-node-action="visibility" title="${ownVisible ? "Hide" : "Show"} ${escapeXmlAttr(node.name)}" aria-label="${ownVisible ? "Hide" : "Show"} ${escapeXmlAttr(node.name)}" aria-pressed="${ownVisible}"><span aria-hidden="true">&#128065;</span></button>`;
    const cropStatus = object?.type === "embedded-image" && node.cropped
      ? `<span class="image-annotation-object-tree-crop-status${node.permanentCrop && !node.reversibleCrop ? " is-permanent" : ""}" title="${node.permanentCrop && !node.reversibleCrop ? "This source was permanently cropped" : "This image has a reversible crop"}">${node.permanentCrop && !node.reversibleCrop ? "Permanent crop" : "Cropped"}</span>`
      : "";
    const cropAction = object?.type === "embedded-image" && node.reversibleCrop
      ? `<button type="button" class="image-annotation-object-tree-crop-toggle${node.cropVisible ? "" : " is-disabled"}" data-annotation-tree-node-action="crop-toggle" title="Turn crop ${node.cropVisible ? "off" : "on"} for ${escapeXmlAttr(node.name)}" aria-label="Turn crop ${node.cropVisible ? "off" : "on"} for ${escapeXmlAttr(node.name)}" aria-pressed="${node.cropVisible}"><span aria-hidden="true">&#9635;</span></button>`
      : "";
    const lockStatus = isLocked || isAnchored
      ? `<span class="image-annotation-object-tree-lock-status" data-annotation-tree-lock-status title="${isLocked && isAnchored ? "Locked and anchored" : isLocked ? "Locked" : "Anchor table"}" aria-label="${isLocked && isAnchored ? "Locked and anchored" : isLocked ? "Locked" : "Anchor table"}">${annotationObjectTreeLockIconHtml()}</span>`
      : "";
    const icon = fixedRelationships ? "&#8644;" : node.kind === "group" ? "&#9638;" : annotationObjectTreeIcon(node.object.type);
    const actions = fixedNode
      ? `<span class="image-annotation-object-tree-row-actions" aria-hidden="true"></span>`
      : `<span class="image-annotation-object-tree-row-actions"><button type="button" data-annotation-tree-node-action="rename" title="Rename ${escapeXmlAttr(node.name)}" aria-label="Rename ${escapeXmlAttr(node.name)}">&#9998;</button><button type="button" data-annotation-tree-node-action="delete" title="Delete ${escapeXmlAttr(node.name)}" aria-label="Delete ${escapeXmlAttr(node.name)}"${canDelete ? "" : " disabled"}>&#10005;</button></span>`;
    const label = node.kind === "relationships" ? `${node.name} (${node.count})` : node.name;
    const cropAttributes = object?.type === "embedded-image"
      ? ` data-annotation-tree-cropped="${node.cropped === true}" data-annotation-tree-crop-enabled="${node.cropVisible === true}"`
      : "";
    return `<div class="image-annotation-object-tree-row${isSelected ? " is-selected" : ""}${isPartial ? " is-partially-selected" : ""}${effectiveVisible ? "" : " is-hidden"}" role="treeitem" aria-level="${level}" aria-selected="${isSelected}"${["group", "relationships"].includes(node.kind) ? ` aria-expanded="true"` : ""} tabindex="0" draggable="${canDrag}" data-annotation-tree-node data-annotation-tree-id="${escapeXmlAttr(node.id)}" data-annotation-tree-kind="${node.kind}" data-annotation-tree-node-id="${escapeXmlAttr(node.id)}" data-annotation-tree-node-type="${node.kind}" data-annotation-tree-visible="${ownVisible}" data-annotation-tree-effective-visible="${effectiveVisible}" data-annotation-tree-locked="${isLocked}" data-annotation-tree-anchored="${isAnchored}"${node.kind === "group" ? ` data-annotation-tree-hit-transparent="${node.hitTransparent === true}"` : ""}${cropAttributes}><span class="image-annotation-object-tree-icon" aria-hidden="true">${icon}</span><span class="image-annotation-object-tree-label">${escapeXmlText(label)}</span>${lockStatus}${cropStatus}${cropAction}${visibilityAction}${actions}</div>`;
  };
  return nodes.map(node => ["group", "relationships"].includes(node.kind)
    ? `<div class="image-annotation-object-tree-group" data-annotation-tree-group-id="${escapeXmlAttr(node.id)}">${row(node, 1)}<div class="image-annotation-object-tree-group-children" role="group">${node.children.map(child => row(child, 2)).join("")}</div></div>`
    : row(node, 1)).join("");
}

function annotationObjectTreeLockIconHtml() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5" y="10" width="14" height="10" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path><path d="M12 14v3"></path></svg>`;
}

function annotationObjectTreeIcon(type) {
  return {
    "embedded-image": "&#128444;",
    rectangle: "&#9633;",
    circle: "&#9711;",
    arrow: "&#8599;",
    line: "&#9585;",
    textbox: "T",
    entity: "&#8862;"
  }[type] || "&#9675;";
}

function annotationActionButton(action, label, title, requiresSelection = false) {
  return `<button type="button" data-annotation-action="${action}" title="${title}" aria-label="${title}" ${requiresSelection ? "data-annotation-requires-selection" : ""}>${label}</button>`;
}

function annotationToolIconSvg(tool) {
  const paths = {
    select: `<path d="M5 3l13 8-6 2-3 6z" fill="currentColor" stroke="currentColor" stroke-linejoin="round"></path>`,
    crop: `<path d="M6 3v13a2 2 0 0 0 2 2h13M3 6h13a2 2 0 0 1 2 2v13"></path>`,
    rectangle: `<rect x="4" y="5" width="16" height="14"></rect>`,
    circle: `<circle cx="12" cy="12" r="8"></circle>`,
    arrow: `<path d="M5 19 19 5M11 5h8v8"></path>`,
    line: `<path d="M5 19 19 5"></path>`,
    textbox: `<path d="M4 5h16v14H4zM8 9h8M12 9v6M9.5 15h5"></path>`,
    entity: `<rect x="4" y="3" width="16" height="18"></rect><path d="M4 8h16M9 8v13M4 13h16M4 17h16"></path>`
  };
  return `<svg class="button-svg-icon image-annotation-tool-icon" viewBox="0 0 24 24" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[tool] || ""}</svg>`;
}

function annotationContextMenuHtml() {
  return `
    <div class="image-annotation-context-menu rich-image-menu dropdown-menu" data-annotation-context-menu role="menu" aria-label="Selected object actions" hidden>
      ${annotationContextMenuItemHtml("crop", "Crop", annotationToolIconSvg("crop"), { tool: true })}
      ${annotationContextMenuItemHtml("front", "To Front", "&#8677;")}
      ${annotationContextMenuItemHtml("back", "To Back", "&#8676;")}
      ${annotationContextMenuItemHtml("forward", "Forward", "&#8593;")}
      ${annotationContextMenuItemHtml("backward", "Backward", "&#8595;")}
      <div class="rich-image-menu-separator" role="separator"></div>
      ${annotationContextMenuItemHtml("group", "Group", "&#9719;")}
      ${annotationContextMenuItemHtml("ungroup", "Ungroup", "&#9711;")}
      ${annotationContextMenuItemHtml("reset-crop", "Reset Crop", "&#8634;")}
      ${annotationContextMenuItemHtml("lock", "Lock", "&#9744;")}
      <div class="rich-image-menu-separator" role="separator"></div>
      ${annotationContextMenuItemHtml("copy-svg", "Copy as SVG", "&#10697;")}
      ${annotationContextMenuItemHtml("copy-image", "Copy as Image", "&#9635;")}
    </div>
  `;
}

function annotationContextMenuItemHtml(action, label, icon, options = {}) {
  const actionAttribute = options.tool
    ? `data-annotation-context-tool="${action}"`
    : `data-annotation-action="${action}"`;
  return `
    <button type="button" class="rich-image-menu-item dropdown-menu-item" ${actionAttribute} data-annotation-requires-selection role="menuitem" title="${label}" aria-label="${label}">
      <span class="dropdown-menu-icon" aria-hidden="true">${icon}</span>
      <span class="dropdown-menu-label">${label}</span>
      <span class="dropdown-menu-check" aria-hidden="true"></span>
    </button>
  `;
}

function annotationTemplateCardHtml(template, index, templateCount) {
  const name = escapeXmlAttr(template.name);
  const id = escapeXmlAttr(template.id);
  const preview = escapeXmlAttr(annotationTemplatePreviewDataUrl(template));
  const upDisabled = index === 0;
  const downDisabled = index === templateCount - 1;
  return `
    <article class="image-annotation-template-card" data-annotation-template-card="${id}">
      <button type="button" class="image-annotation-template-preview" data-annotation-template-action="create" data-annotation-template-id="${id}" aria-label="Use ${name} template">
        <img src="${preview}" alt="${name} template preview">
      </button>
      <strong title="${name}">${name}</strong>
      <div class="image-annotation-template-card-actions" aria-label="${name} template actions">
        <button type="button" data-annotation-template-action="rename" data-annotation-template-id="${id}" title="Rename ${name}">Rename</button>
        <button type="button" data-annotation-template-action="replace" data-annotation-template-id="${id}" title="Replace ${name} from current selection">Update</button>
        <button type="button" data-annotation-template-action="up" data-annotation-template-id="${id}" data-annotation-template-boundary-disabled="${upDisabled}" ${upDisabled ? "disabled" : ""} title="Move ${name} up">Up</button>
        <button type="button" data-annotation-template-action="down" data-annotation-template-id="${id}" data-annotation-template-boundary-disabled="${downDisabled}" ${downDisabled ? "disabled" : ""} title="Move ${name} down">Down</button>
        <button type="button" data-annotation-template-action="download" data-annotation-template-id="${id}" title="Download ${name}">Download</button>
        <button type="button" data-annotation-template-action="delete" data-annotation-template-id="${id}" title="Delete ${name}">Delete</button>
      </div>
    </article>
  `;
}

function downloadAnnotationTemplate(template) {
  const file = annotationTemplateDownloadFile(template);
  const url = URL.createObjectURL(new Blob([file.contents], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = file.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function annotationTemplatePreviewDataUrl(template) {
  const width = positiveNumber(template?.width, 1);
  const height = positiveNumber(template?.height, 1);
  const visibleObjects = template?.groupVisible === false
    ? []
    : (template?.objects || []).filter(object => object.visible !== false);
  const body = visibleObjects
    .map(object => annotationObjectSvg(object, { exportMode: true, previewMode: true }))
    .join("");
  const relationships = annotationEntityRelationshipsSvg(visibleObjects, template?.relationshipStyle);
  const relationshipSample = !body && template?.relationshipStyle
    ? annotationEntityRelationshipStylePreviewSvg(template.relationshipStyle, width, height)
    : "";
  const svg = `<svg xmlns="${svgNamespace}" width="${formatNumber(width)}" height="${formatNumber(height)}" viewBox="0 0 ${formatNumber(width)} ${formatNumber(height)}" preserveAspectRatio="xMidYMid meet">${relationships}${body}${relationshipSample}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function annotationEntityRelationshipStylePreviewSvg(styleInput, width, height) {
  const style = normalizeAnnotationEntityRelationshipStyle(styleInput);
  const start = { x: Math.max(12, width * 0.12), y: height / 2 };
  const end = { x: Math.max(start.x + 24, width * 0.88), y: height / 2 };
  const pathEnd = style.showSymbols ? end.x - style.arrowSize : end.x;
  return `<g class="image-annotation-entity-relationships"><path class="image-annotation-entity-relationship-path" d="M ${formatNumber(start.x)} ${formatNumber(start.y)} H ${formatNumber(pathEnd)}" fill="none" stroke="${escapeXmlAttr(style.stroke)}" stroke-width="${formatNumber(style.strokeWidth)}" stroke-linecap="round"></path>${annotationEntityRelationshipMarkers(start, end, { x: 1, y: 0 }, { x: 1, y: 0 }, "", style)}</g>`;
}

async function copyAnnotationSvgToClipboard(svg) {
  try {
    if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      const clipboardData = {
        "text/plain": new Blob([svg], { type: "text/plain" }),
        "text/html": new Blob([svg], { type: "text/html" })
      };
      if (typeof ClipboardItem.supports === "function" && ClipboardItem.supports("image/svg+xml")) {
        clipboardData["image/svg+xml"] = new Blob([svg], { type: "image/svg+xml" });
      }
      await navigator.clipboard.write([new ClipboardItem(clipboardData)]);
      return;
    }
  } catch {
    // Fall through to the plain SVG source copy supported by older browsers.
  }

  if (await copyTextToClipboard(svg)) return;
  throw new Error("Clipboard access is unavailable. The SVG was not copied.");
}

async function copyAnnotationPngToClipboard(selectionExport) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("This browser does not support copying images to the clipboard.");
  }
  const pngBlob = annotationSelectionPngBlob(selectionExport);
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
  } catch {
    throw new Error("Clipboard image access was denied. The image was not copied.");
  }
}

async function annotationSelectionPngBlob(selectionExport) {
  const width = positiveNumber(selectionExport?.width, 1);
  const height = positiveNumber(selectionExport?.height, 1);
  const maximumDimension = 8192;
  const scale = Math.min(1, maximumDimension / width, maximumDimension / height);
  const outputWidth = Math.max(1, Math.ceil(width * scale));
  const outputHeight = Math.max(1, Math.ceil(height * scale));
  const svgBlob = new Blob([selectionExport.svg], { type: "image/svg+xml" });
  const objectUrl = URL.createObjectURL(svgBlob);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.addEventListener("load", () => resolve(element), { once: true });
      element.addEventListener("error", () => reject(new Error("The selected artwork could not be rendered.")), { once: true });
      element.src = objectUrl;
    });
    const raster = document.createElement("canvas");
    raster.width = outputWidth;
    raster.height = outputHeight;
    const context = raster.getContext("2d");
    if (!context) throw new Error("The selected artwork could not be rendered.");
    context.drawImage(image, 0, 0, outputWidth, outputHeight);
    return await new Promise((resolve, reject) => {
      raster.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error("The selected artwork could not be converted to PNG."));
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function annotationFontOptions(selectedFont) {
  return ["Arial", "Georgia", "Times New Roman", "Verdana", "Tahoma", "Trebuchet MS", "Courier New"]
    .map(font => `<option value="${font}" ${font === selectedFont ? "selected" : ""}>${font}</option>`)
    .join("");
}

function annotationCanvasSvg(
  state,
  selectedIds,
  zoom,
  workspaceBounds,
  cropPreview,
  marqueePreview
) {
  const clipKey = `editor-${++annotationEditorRenderSequence}`;
  const background = annotationCanvasBackgroundSvg(state, workspaceBounds);
  const allVisibleObjects = annotationVisibleObjects(state);
  const raisedEntities = allVisibleObjects.filter(object => object.type === "entity" && selectedIds.has(object.id));
  const raisedEntityIds = new Set(raisedEntities.map(object => object.id));
  const relationshipLayers = annotationObjectsAroundRelationshipLayer(allVisibleObjects);
  const relationshipRenderModel = state.hideAllEntityRelationships
    ? null
    : annotationEntityRelationshipRenderModel(allVisibleObjects, state.relationshipStyle, {
        allowOverlappingLines: state.allowOverlappingEntityLines
      });
  const relationships = annotationEntityRelationshipsSvg(allVisibleObjects, state.relationshipStyle, {
    interactive: true,
    selected: selectedIds.has(entityRelationshipsSelectionId),
    selectedIds,
    zoom,
    allowOverlappingLines: state.allowOverlappingEntityLines,
    hidden: state.hideAllEntityRelationships,
    relationshipRenderModel
  });
  const belowRelationships = relationshipLayers.below
    .filter(object => !raisedEntityIds.has(object.id))
    .map(object => annotationObjectSvg(object, { exportMode: false, zoom, clipKey }))
    .join("");
  const aboveRelationships = relationshipLayers.above
    .filter(object => !raisedEntityIds.has(object.id))
    .map(object => annotationObjectSvg(object, { exportMode: false, zoom, clipKey }))
    .join("");
  const raised = raisedEntities
    .map(object => annotationObjectSvg(object, { exportMode: false, zoom, clipKey }))
    .join("");
  const grid = state.gridVisible ? annotationGridSvg(workspaceBounds) : "";
  const selection = annotationSelectionSvg(
    allVisibleObjects.filter(object => selectedIds.has(object.id)),
    zoom
  );
  const crop = cropPreview ? annotationCropPreviewSvg(cropPreview, state) : "";
  const marquee = marqueePreview ? annotationMarqueeSvg(marqueePreview) : "";
  return `${annotationCanvasDefs(state, zoom)}${background}${belowRelationships}${relationships}${aboveRelationships}${grid}${raised}${selection}${marquee}${crop}`;
}

export function annotationEntityRelationshipsSvg(objectsInput, relationshipStyleInput = null, options = {}) {
  if (options?.hidden === true) return "";
  const relationshipRenderModel = options?.relationshipRenderModel
    || annotationEntityRelationshipRenderModel(objectsInput, relationshipStyleInput, options);
  const { renderedRelationships, visibleRouteGroups } = relationshipRenderModel;
  if (!renderedRelationships.length) return "";
  const interactive = options?.interactive === true;
  const selected = interactive && options?.selected === true;
  const selectedIds = options?.selectedIds instanceof Set ? options.selectedIds : new Set(options?.selectedIds || []);
  const zoom = Math.max(minimumZoom, positiveNumber(options?.zoom, 1));
  const visibleRoutes = annotationEntityRelationshipVisibleRoutesSvg(visibleRouteGroups);
  const groupSelection = selected
    ? annotationEntityRelationshipGroupSelectionSvg(visibleRouteGroups, zoom)
    : "";
  const body = renderedRelationships
    .map(item => annotationEntityRelationshipSvg(
      item.relationship,
      item.style,
      item.geometry,
      {
        interactive,
        selected: selectedIds.has(item.relationship.id),
        zoom
      }
    ))
    .join("");
  const interaction = interactive
    ? ` data-annotation-object-id="${entityRelationshipsSelectionId}" data-annotation-object-type="${entityRelationshipsObjectType}" role="button" tabindex="0" aria-label="Entity Relationships"`
    : "";
  return `<g class="image-annotation-entity-relationships${selected ? " is-selected" : ""}"${interaction}>${visibleRoutes}${groupSelection}${body}</g>`;
}

function annotationEntityRelationshipRenderModel(objectsInput, relationshipStyleInput = null, options = {}) {
  const relationships = resolveAnnotationEntityRelationships(objectsInput);
  if (!relationships.length) return { relationships, renderedRelationships: [], visibleRouteGroups: [] };
  const entities = annotationEntityRelationshipRoutingObstacles(objectsInput);
  const style = normalizeAnnotationEntityRelationshipStyle(relationshipStyleInput);
  const relationshipItems = relationships.map(relationship => ({
    relationship,
    style: annotationEntityRelationshipEffectiveStyle(relationship, style)
  }));
  const allowOverlappingLines = options?.allowOverlappingLines === true;
  const cacheOwner = entities.find(entity => entity && typeof entity === "object") || null;
  const cacheKey = annotationEntityRelationshipGeometryCacheKey(
    entities,
    relationshipItems,
    allowOverlappingLines
  );
  const cached = cacheOwner ? annotationEntityRelationshipGeometryCache.get(cacheOwner) : null;
  let geometryById = cached?.key === cacheKey ? cached.geometryById : null;
  if (!geometryById) {
    const obstacleIndex = annotationEntityRelationshipObstacleIndex(entities);
    geometryById = new Map(relationshipItems.map(({ relationship, style: effectiveStyle }, index) => [
      relationship.id,
      annotationEntityRelationshipGeometry(relationship, effectiveStyle, {
        index,
        relationships,
        entities,
        obstacleIndex,
        allowOverlappingLines
      })
    ]));
    if (cacheOwner) {
      annotationEntityRelationshipGeometryCache.set(cacheOwner, { key: cacheKey, geometryById });
    }
  }
  const renderedRelationships = relationshipItems
    .map(item => ({ ...item, geometry: geometryById.get(item.relationship.id) }))
    .filter(item => item.geometry);
  const visibleRouteGroups = annotationEntityRelationshipMergedRouteGroups(renderedRelationships);
  return { relationships, renderedRelationships, visibleRouteGroups };
}

function annotationEntityRelationshipGeometryVisualBounds(geometry, styleInput) {
  const style = normalizeAnnotationEntityRelationshipStyle(styleInput);
  const markerGeometry = style.showSymbols
    ? annotationEntityRelationshipMarkerGeometry(
        geometry.start,
        geometry.end,
        geometry.sourceUnit,
        geometry.targetUnit,
        geometry.relationshipType,
        style
      )
    : null;
  const points = [
    ...(geometry?.points || []),
    ...(markerGeometry?.arrowPoints || []),
    ...(markerGeometry?.lineSegments?.flat() || [])
  ];
  if (!points.length) return { x: 0, y: 0, width: 1, height: 1 };
  const strokeRadius = style.strokeWidth / 2;
  const left = Math.min(...points.map(point => point.x)) - strokeRadius;
  const top = Math.min(...points.map(point => point.y)) - strokeRadius;
  const right = Math.max(...points.map(point => point.x)) + strokeRadius;
  const bottom = Math.max(...points.map(point => point.y)) + strokeRadius;
  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top)
  };
}

function annotationEntityRelationshipGeometryCacheKey(obstacles, relationshipItems, allowOverlappingLines) {
  return JSON.stringify([
    allowOverlappingLines ? 1 : 0,
    obstacles.map(object => {
      const bounds = annotationObjectBounds(object);
      return [
        object.type,
        object.id || "",
        bounds?.x,
        bounds?.y,
        bounds?.width,
        bounds?.height
      ];
    }),
    relationshipItems.map(({ relationship, style }) => [
      relationship.id,
      relationship.source?.x,
      relationship.source?.y,
      relationship.source?.width,
      relationship.source?.height,
      relationship.source?.anchorTable === true ? 1 : 0,
      annotationEntityFieldAnchorY(relationship.source, relationship.sourceField),
      relationship.target?.x,
      relationship.target?.y,
      relationship.target?.width,
      relationship.target?.height,
      relationship.target?.anchorTable === true ? 1 : 0,
      annotationEntityFieldAnchorY(relationship.target, relationship.targetField),
      safeAnnotationEntityRelationshipType(relationship.foreignKey?.relationshipType),
      formatNumber(style.strokeWidth),
      formatNumber(style.arrowSize)
    ])
  ]);
}

function resolveAnnotationEntityRelationships(objectsInput) {
  const entities = (Array.isArray(objectsInput) ? objectsInput : [])
    .filter(object => object?.type === "entity" && object.visible !== false);
  const relationships = [];
  entities.forEach(source => {
    (source.foreignKeys || []).forEach((foreignKeySource, foreignKeyIndex) => {
      const foreignKey = normalizeAnnotationEntityForeignKey(foreignKeySource);
      if (!foreignKey) return;
      const sourceField = source.fields?.find(field => foreignKey.columns
        .some(column => column.toLowerCase() === String(field.name || "").toLowerCase()));
      if (!sourceField?.isForeignKey) return;
      const target = entities.find(candidate =>
        annotationEntityMatchesReference(candidate, foreignKey.referencedSchema, foreignKey.referencedTable));
      if (!target || (target === source && source.showSelfRelationships !== true)) return;
      const targetField = target.fields?.find(field => foreignKey.referencedColumns
        .some(column => column.toLowerCase() === String(field.name || "").toLowerCase())) || null;
      if (!targetField
        || annotationEntityVisibleFieldIndex(source, sourceField) < 0
        || annotationEntityVisibleFieldIndex(target, targetField) < 0) return;
      const relationship = {
        source,
        sourceField,
        target,
        targetField,
        foreignKey,
        foreignKeySource,
        foreignKeyIndex
      };
      relationship.id = annotationEntityRelationshipId(relationship);
      relationships.push(relationship);
    });
  });
  return relationships;
}

function annotationEntityRelationshipId(relationship) {
  const parts = [
    relationship.source?.id,
    ...(relationship.foreignKey?.columns || []),
    relationship.target?.id,
    ...(relationship.foreignKey?.referencedColumns || []),
    relationship.foreignKey?.name || ""
  ].map(value => encodeURIComponent(String(value || "").toLocaleLowerCase()));
  return `${entityRelationshipSelectionPrefix}${parts.join(":")}`;
}

function annotationEntityRelationshipName(relationship) {
  const source = `${formatAnnotationEntityIdentifier(relationship.source?.entitySchema, relationship.source?.entityName)}.${formatAnnotationEntityIdentifier(relationship.sourceField?.name)}`;
  const target = `${formatAnnotationEntityIdentifier(relationship.target?.entitySchema, relationship.target?.entityName)}.${formatAnnotationEntityIdentifier(relationship.targetField?.name)}`;
  return `${source} → ${target}`;
}

function annotationEntityRelationshipEffectiveStyle(relationship, globalStyleInput) {
  return normalizeAnnotationEntityRelationshipStyle({
    ...normalizeAnnotationEntityRelationshipStyle(globalStyleInput),
    ...(normalizeAnnotationEntityRelationshipStyleOverride(relationship?.foreignKeySource?.styleOverride)
      || normalizeAnnotationEntityRelationshipStyleOverride(relationship?.foreignKey?.styleOverride)
      || {})
  });
}

function annotationEntityRelationshipSelectionObject(relationship, globalStyleInput) {
  const object = {
    id: relationship.id,
    type: entityRelationshipObjectType,
    name: annotationEntityRelationshipName(relationship),
    locked: false,
    groupId: ""
  };
  const foreignKey = relationship.foreignKeySource;
  ["stroke", "strokeWidth", "arrowSize"].forEach(field => {
    Object.defineProperty(object, field, {
      enumerable: true,
      get() {
        return annotationEntityRelationshipEffectiveStyle(relationship, globalStyleInput)[field];
      },
      set(value) {
        const override = normalizeAnnotationEntityRelationshipStyleOverride({
          ...(foreignKey.styleOverride || {}),
          [field]: value
        });
        if (override) foreignKey.styleOverride = override;
        else delete foreignKey.styleOverride;
      }
    });
  });
  Object.defineProperty(object, "showSymbols", {
    enumerable: true,
    get() {
      return globalStyleInput?.showSymbols === true;
    },
    set(value) {
      if (globalStyleInput && typeof globalStyleInput === "object") {
        globalStyleInput.showSymbols = value === true;
      }
    }
  });
  return object;
}

export function autoFormatAnnotationEntitiesOrgTree(objectsInput, options = {}) {
  const entities = (Array.isArray(objectsInput) ? objectsInput : [])
    .filter(object => object?.type === "entity");
  if (entities.length < 2) {
    return {
      movedCount: 0,
      levelCount: entities.length,
      cycleBreakCount: 0,
      relationshipCount: 0,
      anchorCount: entities.filter(entity => entity.anchorTable === true).length,
      anchoredRelationshipCount: 0,
      routeAdjustedCount: 0,
      unresolvedRouteContactCount: 0,
      fixedConstraintShortcutCount: 0
    };
  }

  const entityById = new Map(entities.map(entity => [entity.id, entity]));
  const parents = new Map(entities.map(entity => [entity.id, new Set()]));
  const children = new Map(entities.map(entity => [entity.id, new Set()]));
  const neighbors = new Map(entities.map(entity => [entity.id, new Set()]));
  const relationshipPairs = new Set();
  const resolvedRelationships = resolveAnnotationEntityRelationships(entities);
  const anchoredRelationshipCount = resolvedRelationships
    .filter(relationship => relationship.source.anchorTable === true && relationship.target.anchorTable === true)
    .length;
  resolvedRelationships.forEach(relationship => {
    if (relationship.source === relationship.target) return;
    const pair = `${relationship.target.id}->${relationship.source.id}`;
    if (relationshipPairs.has(pair)) return;
    relationshipPairs.add(pair);
    parents.get(relationship.source.id)?.add(relationship.target.id);
    children.get(relationship.target.id)?.add(relationship.source.id);
    neighbors.get(relationship.source.id)?.add(relationship.target.id);
    neighbors.get(relationship.target.id)?.add(relationship.source.id);
  });

  const entityKey = entity => formatAnnotationEntityIdentifier(entity.entitySchema, entity.entityName)
    .toLocaleLowerCase();
  const descendantCount = entity => {
    const seen = new Set();
    const pending = [...(children.get(entity.id) || [])];
    while (pending.length) {
      const id = pending.shift();
      if (seen.has(id)) continue;
      seen.add(id);
      (children.get(id) || []).forEach(childId => pending.push(childId));
    }
    seen.delete(entity.id);
    return seen.size;
  };
  const preferredRootId = String(options?.preferredRootId || "");
  const compareImportance = (first, second) => {
    const firstPreferred = first.id === preferredRootId;
    const secondPreferred = second.id === preferredRootId;
    if (firstPreferred !== secondPreferred) return firstPreferred ? -1 : 1;
    const descendantDifference = descendantCount(second) - descendantCount(first);
    if (descendantDifference) return descendantDifference;
    const childDifference = (children.get(second.id)?.size || 0) - (children.get(first.id)?.size || 0);
    return childDifference || entityKey(first).localeCompare(entityKey(second));
  };

  const levels = new Map();
  const remaining = new Set(entities.map(entity => entity.id));
  let cycleBreakCount = 0;
  const preferredRoot = entityById.get(preferredRootId) || null;
  if (preferredRoot) {
    const assignConnectedLevels = (rootId, startLevel) => {
      const queue = [rootId];
      levels.set(rootId, startLevel);
      remaining.delete(rootId);
      while (queue.length) {
        const currentId = queue.shift();
        const nextLevel = levels.get(currentId) + 1;
        [...(neighbors.get(currentId) || [])]
          .filter(id => remaining.has(id))
          .map(id => entityById.get(id))
          .sort(compareImportance)
          .forEach(entity => {
            levels.set(entity.id, nextLevel);
            remaining.delete(entity.id);
            queue.push(entity.id);
          });
      }
    };
    assignConnectedLevels(preferredRoot.id, 0);
    while (remaining.size) {
      const root = [...remaining].map(id => entityById.get(id)).sort(compareImportance)[0];
      assignConnectedLevels(root.id, Math.max(...levels.values()) + 1);
    }
  } else {
    while (remaining.size) {
      let ready = [...remaining]
        .map(id => entityById.get(id))
        .filter(entity => [...(parents.get(entity.id) || [])].every(parentId => levels.has(parentId)));
      if (!ready.length) {
        ready = [[...remaining].map(id => entityById.get(id)).sort(compareImportance)[0]];
        cycleBreakCount += 1;
      } else {
        ready.sort(compareImportance);
      }
      ready.forEach(entity => {
        const processedParentLevels = [...(parents.get(entity.id) || [])]
          .filter(parentId => levels.has(parentId))
          .map(parentId => levels.get(parentId));
        levels.set(entity.id, processedParentLevels.length ? Math.max(...processedParentLevels) + 1 : 0);
        remaining.delete(entity.id);
      });
    }
  }

  const rows = new Map();
  entities.forEach(entity => {
    const level = levels.get(entity.id) || 0;
    const row = rows.get(level) || [];
    row.push(entity);
    rows.set(level, row);
  });
  const orderedLevels = [...rows.keys()].sort((first, second) => first - second);
  const orderIndex = new Map();
  orderedLevels.forEach(level => {
    const row = rows.get(level);
    row.sort((first, second) => {
      if (level === 0) return compareImportance(first, second);
      const parentOrder = entity => {
        const layoutParents = preferredRoot
          ? [...(neighbors.get(entity.id) || [])].filter(id => levels.get(id) === level - 1)
          : [...(parents.get(entity.id) || [])];
        const indexes = layoutParents
          .map(parentId => orderIndex.get(parentId))
          .filter(Number.isFinite);
        return indexes.length ? indexes.reduce((sum, value) => sum + value, 0) / indexes.length : Number.MAX_SAFE_INTEGER;
      };
      return parentOrder(first) - parentOrder(second) || compareImportance(first, second);
    });
    row.forEach((entity, index) => orderIndex.set(entity.id, index));
  });

  const allowOverlappingLines = options?.allowOverlappingLines === true;
  const horizontalGap = allowOverlappingLines ? 90 : 150;
  const verticalGap = allowOverlappingLines ? 150 : 240;
  const rowWidths = new Map(orderedLevels.map(level => {
    const row = rows.get(level);
    return [level, row.reduce((sum, entity) => sum + entity.width, 0) + (horizontalGap * Math.max(0, row.length - 1))];
  }));
  const layoutWidth = Math.max(...rowWidths.values(), 1);
  const originX = Math.min(...entities.map(entity => entity.x));
  const originY = Math.min(...entities.map(entity => entity.y));
  const originalPositions = new Map(entities.map(entity => [entity.id, { x: entity.x, y: entity.y }]));
  const plannedPositions = new Map();
  let y = originY;
  orderedLevels.forEach(level => {
    const row = rows.get(level);
    const rowHeight = Math.max(...row.map(entity => entity.height), 1);
    let x = originX + ((layoutWidth - rowWidths.get(level)) / 2);
    row.forEach(entity => {
      plannedPositions.set(entity.id, { x: Math.round(x), y: Math.round(y) });
      x += entity.width + horizontalGap;
    });
    y += rowHeight + verticalGap;
  });

  const anchoredEntities = entities.filter(entity => entity.anchorTable === true);
  const referenceAnchor = anchoredEntities.find(entity => entity.id === preferredRootId)
    || [...anchoredEntities].sort(compareImportance)[0]
    || null;
  const referencePlan = referenceAnchor ? plannedPositions.get(referenceAnchor.id) : null;
  const referenceOriginal = referenceAnchor ? originalPositions.get(referenceAnchor.id) : null;
  const translation = referencePlan && referenceOriginal
    ? { x: referenceOriginal.x - referencePlan.x, y: referenceOriginal.y - referencePlan.y }
    : { x: 0, y: 0 };
  entities.forEach(entity => {
    if (entity.anchorTable === true) return;
    const planned = plannedPositions.get(entity.id);
    entity.x = Math.round(planned.x + translation.x);
    entity.y = Math.round(planned.y + translation.y);
  });

  const routeAdjustment = separateAnnotationEntitiesFromRelationshipRoutes(
    entities,
    resolvedRelationships,
    {
      allowOverlappingLines,
      gridSize: options?.gridSize,
      relationshipStyle: options?.relationshipStyle
    }
  );
  if (!anchoredEntities.length) {
    const adjustedOriginX = Math.min(...entities.map(entity => entity.x));
    const originCorrectionX = originX - adjustedOriginX;
    if (originCorrectionX) {
      entities.forEach(entity => {
        entity.x = Math.round(entity.x + originCorrectionX);
      });
    }
  }

  return {
    movedCount: entities.filter(entity => {
      const original = originalPositions.get(entity.id);
      return original.x !== entity.x || original.y !== entity.y;
    }).length,
    levelCount: orderedLevels.length,
    cycleBreakCount,
    relationshipCount: relationshipPairs.size,
    anchorCount: anchoredEntities.length,
    anchoredRelationshipCount,
    routeAdjustedCount: routeAdjustment.adjustedCount,
    unresolvedRouteContactCount: routeAdjustment.unresolvedContactCount,
    fixedConstraintShortcutCount: routeAdjustment.fixedConstraintShortcutCount
  };
}

export function annotationOrgTreeShortcutWarningRequired(result) {
  return positiveNumber(result?.anchoredRelationshipCount, 0) > 0
    || positiveNumber(result?.fixedConstraintShortcutCount, 0) > 0;
}

function separateAnnotationEntitiesFromRelationshipRoutes(entitiesInput, relationshipsInput, options = {}) {
  const entities = (Array.isArray(entitiesInput) ? entitiesInput : [])
    .filter(entity => entity?.type === "entity" && entity.visible !== false);
  const relationships = Array.isArray(relationshipsInput) ? relationshipsInput : [];
  if (!entities.length || !relationships.length) {
    return { adjustedCount: 0, unresolvedContactCount: 0, fixedConstraintShortcutCount: 0 };
  }

  const relationshipStyle = normalizeAnnotationEntityRelationshipStyle(options?.relationshipStyle);
  const gridSize = clampNumber(positiveNumber(options?.gridSize, defaultGridSize), 4, 200);
  const chosenDirections = new Map();
  const adjustedIds = new Set();
  const fixedConstraintIds = new Set();
  const maximumPasses = 8;
  let contacts = [];

  for (let pass = 0; pass < maximumPasses; pass += 1) {
    contacts = annotationEntityRelationshipRouteContacts(
      entities,
      relationships,
      relationshipStyle,
      options?.allowOverlappingLines === true
    );
    const movableEntities = [...new Set(contacts
      .map(contact => contact.entity)
      .filter(entity => entity.anchorTable !== true && entity.locked !== true))]
      .sort((first, second) => first.y - second.y
        || first.x - second.x
        || annotationEntityStableKey(first).localeCompare(annotationEntityStableKey(second)));
    if (!movableEntities.length) break;

    let movedThisPass = 0;
    movableEntities.forEach(entity => {
      const chosenDirection = chosenDirections.get(entity.id);
      const preferredDirection = chosenDirection
        || annotationEntityRouteNudgeDirection(entity, entities, gridSize);
      const directions = chosenDirection
        ? [chosenDirection]
        : [preferredDirection, -preferredDirection];
      const direction = directions.find(candidate => annotationEntityCanNudgeHorizontally(
        entity,
        entities,
        candidate * gridSize
      ));
      if (!direction) {
        directions.flatMap(candidate => annotationEntityHorizontalNudgeBlockers(
          entity,
          entities,
          candidate * gridSize
        )).filter(blocker => blocker.anchorTable === true || blocker.locked === true)
          .forEach(blocker => fixedConstraintIds.add(blocker.id));
        return;
      }
      chosenDirections.set(entity.id, direction);
      entity.x = Math.round(entity.x + (direction * gridSize));
      adjustedIds.add(entity.id);
      movedThisPass += 1;
    });
    if (!movedThisPass) break;
  }

  contacts = annotationEntityRelationshipRouteContacts(
    entities,
    relationships,
    relationshipStyle,
    options?.allowOverlappingLines === true
  );
  contacts.filter(contact => contact.entity.anchorTable === true || contact.entity.locked === true)
    .forEach(contact => fixedConstraintIds.add(contact.entity.id));
  return {
    adjustedCount: adjustedIds.size,
    unresolvedContactCount: contacts.length,
    fixedConstraintShortcutCount: fixedConstraintIds.size
  };
}

function annotationEntityRelationshipRouteContacts(entities, relationships, globalStyle, allowOverlappingLines) {
  const contacts = [];
  relationships.forEach((relationship, index) => {
    const style = annotationEntityRelationshipEffectiveStyle(relationship, globalStyle);
    const geometry = annotationEntityRelationshipGeometry(relationship, style, {
      index,
      relationships,
      entities,
      allowOverlappingLines,
      skipObstacleRouting: true
    });
    if (!geometry) return;
    entities.forEach(entity => {
      if (entity === relationship.source || entity === relationship.target) return;
      const clearance = annotationEntityRelationshipClearance(style);
      if (!annotationEntityRelationshipRouteTouchesObstacle(geometry.points, entity, clearance)) return;
      if (annotationEntityRelationshipRouteCrossesEntity(geometry.points, [entity])) return;
      contacts.push({ relationship, entity });
    });
  });
  return contacts;
}

function annotationEntityStableKey(entity) {
  return `${formatAnnotationEntityIdentifier(entity?.entitySchema, entity?.entityName)}|${entity?.id || ""}`
    .toLocaleLowerCase();
}

function annotationEntityRouteNudgeDirection(entity, entities, gridSize) {
  const verticalTop = entity.y;
  const verticalBottom = entity.y + entity.height;
  const rowNeighbors = entities.filter(candidate => candidate !== entity
    && candidate.y < verticalBottom
    && candidate.y + candidate.height > verticalTop);
  const leftNeighborRight = Math.max(
    0,
    ...rowNeighbors
      .filter(candidate => candidate.x + candidate.width <= entity.x)
      .map(candidate => candidate.x + candidate.width)
  );
  const rightNeighborLeft = Math.min(
    Number.POSITIVE_INFINITY,
    ...rowNeighbors
      .filter(candidate => candidate.x >= entity.x + entity.width)
      .map(candidate => candidate.x)
  );
  const leftSpace = entity.x - leftNeighborRight;
  const rightSpace = rightNeighborLeft - (entity.x + entity.width);
  if (entity.x - gridSize < 0) return 1;
  return rightSpace >= leftSpace ? 1 : -1;
}

function annotationEntityCanNudgeHorizontally(entity, entities, deltaX) {
  if (entity.x + deltaX < 0) return false;
  return annotationEntityHorizontalNudgeBlockers(entity, entities, deltaX).length === 0;
}

function annotationEntityHorizontalNudgeBlockers(entity, entities, deltaX) {
  const candidate = {
    x: entity.x + deltaX,
    y: entity.y,
    width: entity.width,
    height: entity.height
  };
  if (candidate.x < 0) return [];
  return entities.filter(other => other !== entity
    && candidate.x < other.x + other.width
    && candidate.x + candidate.width > other.x
    && candidate.y < other.y + other.height
    && candidate.y + candidate.height > other.y);
}

function annotationEntityRelationshipVisualBounds(objectsInput, relationshipStyleInput = null, options = {}) {
  const relationshipRenderModel = options?.relationshipRenderModel
    || annotationEntityRelationshipRenderModel(objectsInput, relationshipStyleInput, options);
  return relationshipRenderModel.renderedRelationships
    .map(({ style, geometry }) => annotationEntityRelationshipGeometryVisualBounds(geometry, style));
}

function annotationEntitySelfRelationshipMargin(entity, relationshipStyleInput = null) {
  const style = normalizeAnnotationEntityRelationshipStyle(relationshipStyleInput);
  return Math.max(
    48,
    annotationEntityMetrics(entity).rowHeight * 2,
    style.arrowSize * 2,
    style.strokeWidth * 4
  );
}

function annotationEntityMatchesReference(entity, referencedSchema, referencedTable) {
  if (String(entity?.entityName || "").toLowerCase() !== String(referencedTable || "").toLowerCase()) return false;
  return !referencedSchema
    || String(entity?.entitySchema || "").toLowerCase() === String(referencedSchema || "").toLowerCase();
}

function annotationEntityRelationshipPaintKey(style) {
  return JSON.stringify({
    stroke: String(style.stroke || ""),
    strokeWidth: formatNumber(style.strokeWidth)
  });
}

function annotationEntityRelationshipMergedRouteGroups(renderedRelationships) {
  const paintGroups = new Map();
  renderedRelationships.forEach(item => {
    const paintKey = annotationEntityRelationshipPaintKey(item.style);
    let group = paintGroups.get(paintKey);
    if (!group) {
      group = {
        style: item.style,
        routes: [],
        horizontal: new Map(),
        vertical: new Map(),
        diagonal: new Map()
      };
      paintGroups.set(paintKey, group);
    }
    group.routes.push(item.geometry.path);

    item.geometry.points.slice(1).forEach((point, index) => {
      const previous = item.geometry.points[index];
      if (previous.x === point.x) {
        const key = formatNumber(previous.x);
        const intervals = group.vertical.get(key) || [];
        intervals.push([Math.min(previous.y, point.y), Math.max(previous.y, point.y)]);
        group.vertical.set(key, intervals);
        return;
      }
      if (previous.y === point.y) {
        const key = formatNumber(previous.y);
        const intervals = group.horizontal.get(key) || [];
        intervals.push([Math.min(previous.x, point.x), Math.max(previous.x, point.x)]);
        group.horizontal.set(key, intervals);
        return;
      }
      const firstKey = `${formatNumber(previous.x)},${formatNumber(previous.y)}`;
      const secondKey = `${formatNumber(point.x)},${formatNumber(point.y)}`;
      const key = firstKey < secondKey ? `${firstKey}|${secondKey}` : `${secondKey}|${firstKey}`;
      group.diagonal.set(key, [previous, point]);
    });
  });

  const mergeIntervals = intervals => intervals
    .sort((first, second) => first[0] - second[0] || first[1] - second[1])
    .reduce((merged, interval) => {
      const previous = merged.at(-1);
      if (previous && interval[0] <= previous[1]) {
        previous[1] = Math.max(previous[1], interval[1]);
      } else {
        merged.push([...interval]);
      }
      return merged;
    }, []);

  return [...paintGroups.values()].map(group => {
    if (group.routes.length === 1) return { style: group.style, path: group.routes[0] };
    const commands = [];
    group.horizontal.forEach((intervals, y) => {
      mergeIntervals(intervals).forEach(([start, end]) => {
        commands.push(`M ${formatNumber(start)} ${y} H ${formatNumber(end)}`);
      });
    });
    group.vertical.forEach((intervals, x) => {
      mergeIntervals(intervals).forEach(([start, end]) => {
        commands.push(`M ${x} ${formatNumber(start)} V ${formatNumber(end)}`);
      });
    });
    group.diagonal.forEach(([first, second]) => {
      commands.push(`M ${formatNumber(first.x)} ${formatNumber(first.y)} L ${formatNumber(second.x)} ${formatNumber(second.y)}`);
    });
    return { style: group.style, path: commands.join(" ") };
  }).filter(group => group.path);
}

function annotationEntityRelationshipVisibleRoutesSvg(routeGroups) {
  return routeGroups
    .map(group => `<path class="image-annotation-entity-relationship-path" d="${group.path}" fill="none" stroke="${escapeXmlAttr(group.style.stroke)}" stroke-width="${formatNumber(group.style.strokeWidth)}" stroke-linejoin="round" pointer-events="none"></path>`)
    .join("");
}

function annotationEntityRelationshipGroupSelectionSvg(routeGroups, zoom) {
  return routeGroups
    .map(group => `<path class="image-annotation-entity-relationship-selection" d="${group.path}" fill="none" stroke-width="${formatNumber(group.style.strokeWidth + (4 / zoom))}" stroke-linejoin="round" pointer-events="none" data-annotation-relationship-stroke-width="${formatNumber(group.style.strokeWidth)}"></path>`)
    .join("");
}

function annotationEntityRelationshipSvg(relationship, style, geometry, options = {}) {
  const { source, sourceField, target, targetField, foreignKey } = relationship;
  const { start, end, sourceUnit, targetUnit, path, relationshipType } = geometry;
  const markers = annotationEntityRelationshipMarkers(
    start,
    end,
    sourceUnit,
    targetUnit,
    relationshipType,
    style
  );
  const sourceName = `${formatAnnotationEntityIdentifier(source.entitySchema, source.entityName)}.${formatAnnotationEntityIdentifier(sourceField.name)}`;
  const targetName = `${formatAnnotationEntityIdentifier(target.entitySchema, target.entityName)}.${formatAnnotationEntityIdentifier(targetField?.name || foreignKey.referencedColumns[0])}`;
  const selection = options.selected
    ? `<path class="image-annotation-entity-relationship-selection" d="${path}" fill="none" stroke-width="${formatNumber(style.strokeWidth + (4 / options.zoom))}" stroke-linejoin="round" pointer-events="none"></path>`
    : "";
  const hit = options.interactive
    ? `<path class="image-annotation-entity-relationship-hit" d="${path}" fill="none" stroke="transparent" stroke-width="${formatNumber(Math.max(style.strokeWidth + (10 / options.zoom), 14 / options.zoom))}" stroke-linejoin="round" pointer-events="stroke"></path>`
    : "";
  const interaction = options.interactive
    ? ` data-annotation-object-id="${escapeXmlAttr(relationship.id)}" data-annotation-object-type="${entityRelationshipObjectType}" role="button" tabindex="0" aria-label="${escapeXmlAttr(annotationEntityRelationshipName(relationship))}"`
    : "";
  return `<g class="image-annotation-entity-relationship${options.selected ? " is-selected" : ""}"${interaction} data-annotation-relationship-stroke-width="${formatNumber(style.strokeWidth)}" data-pmt-relationship-type="${relationshipType || "arrow"}" data-pmt-relationship-source="${escapeXmlAttr(sourceName)}" data-pmt-relationship-target="${escapeXmlAttr(targetName)}"><title>${escapeXmlText(`${sourceName} points to ${targetName}`)}</title>${selection}${markers}${hit}</g>`;
}

function annotationEntityRelationshipGeometry(relationship, style, options = {}) {
  const { source, sourceField, target, targetField, foreignKey } = relationship;
  const sourceCenter = { x: source.x + (source.width / 2), y: source.y + (source.height / 2) };
  const targetCenter = { x: target.x + (target.width / 2), y: target.y + (target.height / 2) };
  const obstacles = (Array.isArray(options.entities) ? options.entities : [])
    .filter(Boolean);
  const skipObstacleRouting = options.skipObstacleRouting === true;
  const obstacleRouteOptions = {
    obstacleIndex: options.obstacleIndex,
    excludedObjects: new Set([source, target]),
    sourceObject: source,
    targetObject: target
  };
  const allowSharedRoute = options.allowOverlappingLines === true
    || (source.anchorTable === true && target.anchorTable === true);
  let start;
  let end;
  let sourceUnit;
  let targetUnit;
  let points;
  if (source === target) {
    const margin = annotationEntitySelfRelationshipMargin(source, style);
    start = {
      x: source.x + source.width,
      y: annotationEntityFieldAnchorY(source, sourceField)
    };
    end = {
      x: source.x,
      y: annotationEntityFieldAnchorY(target, targetField)
    };
    sourceUnit = { x: 1, y: 0 };
    targetUnit = { x: 1, y: 0 };
    points = compactAnnotationEntityRelationshipPoints([
      start,
      { x: source.x + source.width + margin, y: start.y },
      { x: source.x + source.width + margin, y: source.y - margin },
      { x: source.x - margin, y: source.y - margin },
      { x: source.x - margin, y: end.y },
      end
    ]);
    if (!skipObstacleRouting) {
      points = annotationEntityRelationshipObstacleRoute(
        points,
        sourceUnit,
        targetUnit,
        obstacles,
        style,
        obstacleRouteOptions
      );
    }
  } else if (target.x >= source.x + source.width || source.x >= target.x + target.width) {
    const direction = targetCenter.x >= sourceCenter.x ? 1 : -1;
    start = {
      x: direction > 0 ? source.x + source.width : source.x,
      y: annotationEntityFieldAnchorY(source, sourceField)
    };
    end = {
      x: direction > 0 ? target.x : target.x + target.width,
      y: annotationEntityFieldAnchorY(target, targetField)
    };
    sourceUnit = { x: direction, y: 0 };
    targetUnit = { x: direction, y: 0 };
    const middleX = snapAnnotationValue(
      allowSharedRoute
        ? (start.x + end.x) / 2
        : annotationEntityRelationshipLane(start.x, end.x, relationship, options.relationships),
      true,
      defaultGridSize
    );
    const basePoints = [start, { x: middleX, y: start.y }, { x: middleX, y: end.y }, end];
    points = skipObstacleRouting
      ? compactAnnotationEntityRelationshipPoints(basePoints)
      : annotationEntityRelationshipObstacleRoute(
        basePoints,
        sourceUnit,
        targetUnit,
        obstacles,
        style,
        obstacleRouteOptions
      );
  } else {
    const margin = Math.max(48, style.arrowSize * 2, style.strokeWidth * 4);
    const leftLane = Math.min(source.x, target.x) - margin;
    const rightLane = Math.max(source.x + source.width, target.x + target.width) + margin;
    const leftDistance = (source.x - leftLane) + (target.x - leftLane);
    const rightDistance = (rightLane - (source.x + source.width)) + (rightLane - (target.x + target.width));
    const useRightLane = rightDistance <= leftDistance;
    const laneIndex = allowSharedRoute
      ? 0
      : annotationEntityRelationshipPairIndex(relationship, options.relationships);
    const laneOffset = laneIndex * Math.max(24, style.arrowSize * 2, style.strokeWidth * 4);
    const middleX = snapAnnotationValue(
      useRightLane ? rightLane + laneOffset : leftLane - laneOffset,
      true,
      defaultGridSize
    );
    start = {
      x: useRightLane ? source.x + source.width : source.x,
      y: annotationEntityFieldAnchorY(source, sourceField)
    };
    end = {
      x: useRightLane ? target.x + target.width : target.x,
      y: annotationEntityFieldAnchorY(target, targetField)
    };
    sourceUnit = { x: useRightLane ? 1 : -1, y: 0 };
    targetUnit = { x: useRightLane ? -1 : 1, y: 0 };
    const basePoints = [start, { x: middleX, y: start.y }, { x: middleX, y: end.y }, end];
    points = skipObstacleRouting
      ? compactAnnotationEntityRelationshipPoints(basePoints)
      : annotationEntityRelationshipObstacleRoute(
        basePoints,
        sourceUnit,
        targetUnit,
        obstacles,
        style,
        obstacleRouteOptions
      );
  }

  if (!points?.length && !skipObstacleRouting && source !== target) {
    const sourceSide = start.x === source.x ? "left" : "right";
    const targetSide = end.x === target.x ? "left" : "right";
    const oppositeSide = side => side === "left" ? "right" : "left";
    const alternatives = [
      [oppositeSide(sourceSide), oppositeSide(targetSide)],
      [sourceSide, oppositeSide(targetSide)],
      [oppositeSide(sourceSide), targetSide]
    ];
    for (const [alternateSourceSide, alternateTargetSide] of alternatives) {
      const alternateStart = {
        x: alternateSourceSide === "right" ? source.x + source.width : source.x,
        y: annotationEntityFieldAnchorY(source, sourceField)
      };
      const alternateEnd = {
        x: alternateTargetSide === "right" ? target.x + target.width : target.x,
        y: annotationEntityFieldAnchorY(target, targetField)
      };
      const alternateSourceUnit = { x: alternateSourceSide === "right" ? 1 : -1, y: 0 };
      const alternateTargetUnit = { x: alternateTargetSide === "left" ? 1 : -1, y: 0 };
      const escapeDistance = annotationEntityRelationshipClearance(style);
      const alternateStartEscape = {
        x: alternateStart.x + (alternateSourceUnit.x * escapeDistance),
        y: alternateStart.y
      };
      const alternateEndEscape = {
        x: alternateEnd.x - (alternateTargetUnit.x * escapeDistance),
        y: alternateEnd.y
      };
      const alternateBasePoints = [
        alternateStart,
        alternateStartEscape,
        { x: alternateStartEscape.x, y: alternateEndEscape.y },
        alternateEndEscape,
        alternateEnd
      ];
      const alternatePoints = annotationEntityRelationshipObstacleRoute(
        alternateBasePoints,
        alternateSourceUnit,
        alternateTargetUnit,
        obstacles,
        style,
        obstacleRouteOptions
      );
      if (!alternatePoints?.length) continue;
      start = alternateStart;
      end = alternateEnd;
      sourceUnit = alternateSourceUnit;
      targetUnit = alternateTargetUnit;
      points = alternatePoints;
      break;
    }
  }

  const relationshipType = safeAnnotationEntityRelationshipType(foreignKey.relationshipType);
  if (!points?.length) return null;
  return {
    start,
    end,
    sourceUnit,
    targetUnit,
    points,
    path: annotationEntityRelationshipPath(points),
    relationshipType
  };
}

function annotationEntityRelationshipPairIndex(relationship, relationshipsInput) {
  const relationships = (relationshipsInput || [])
    .filter(candidate => candidate.source === relationship.source && candidate.target === relationship.target)
    .sort(compareAnnotationEntityRelationships);
  return Math.max(0, relationships.indexOf(relationship));
}

function annotationEntityRelationshipLane(start, end, relationship, relationshipsInput) {
  const samePair = (relationshipsInput || [])
    .filter(candidate => candidate.source === relationship.source
      && candidate.target === relationship.target)
    .sort(compareAnnotationEntityRelationships);
  const index = Math.max(0, samePair.indexOf(relationship));
  return start + ((end - start) * ((index + 1) / (samePair.length + 1)));
}

function annotationEntityRelationshipObstacleIndex(objectsInput) {
  const cellSize = 512;
  const entries = (Array.isArray(objectsInput) ? objectsInput : [])
    .map((object, index) => ({ object, bounds: annotationObjectBounds(object), index }))
    .filter(entry => entry.bounds);
  const buckets = new Map();
  const cellRange = bounds => ({
    left: Math.floor(bounds.x / cellSize),
    right: Math.floor((bounds.x + Math.max(0, bounds.width)) / cellSize),
    top: Math.floor(bounds.y / cellSize),
    bottom: Math.floor((bounds.y + Math.max(0, bounds.height)) / cellSize)
  });
  entries.forEach(entry => {
    const range = cellRange(entry.bounds);
    for (let y = range.top; y <= range.bottom; y += 1) {
      for (let x = range.left; x <= range.right; x += 1) {
        const key = `${x}|${y}`;
        const bucket = buckets.get(key) || [];
        bucket.push(entry);
        buckets.set(key, bucket);
      }
    }
  });
  return {
    entries,
    query(bounds, excludedObjects = null) {
      const range = cellRange(bounds);
      const found = new Map();
      for (let y = range.top; y <= range.bottom; y += 1) {
        for (let x = range.left; x <= range.right; x += 1) {
          (buckets.get(`${x}|${y}`) || []).forEach(entry => {
            if (excludedObjects?.has(entry.object)) return;
            if (!annotationBoundsIntersect(bounds, entry.bounds)) return;
            found.set(entry.index, entry);
          });
        }
      }
      return [...found.values()].sort((first, second) => first.index - second.index);
    }
  };
}

function annotationEntityRelationshipPointsBounds(pointsInput, padding = 0) {
  const points = Array.isArray(pointsInput) ? pointsInput : [];
  if (!points.length) return null;
  const left = Math.min(...points.map(point => point.x)) - padding;
  const top = Math.min(...points.map(point => point.y)) - padding;
  const right = Math.max(...points.map(point => point.x)) + padding;
  const bottom = Math.max(...points.map(point => point.y)) + padding;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function annotationEntityRelationshipIndexedRouteContacts(
  pointsInput,
  obstacleIndex,
  excludedObjects,
  clearance = 0
) {
  if (!obstacleIndex?.query) return [];
  const points = Array.isArray(pointsInput) ? pointsInput : [];
  const contacts = new Map();
  const queryPadding = Math.max(annotationCoordinateTolerance, clearance);
  points.slice(1).forEach((point, index) => {
    const previous = points[index];
    const segmentBounds = {
      x: Math.min(previous.x, point.x) - queryPadding,
      y: Math.min(previous.y, point.y) - queryPadding,
      width: Math.abs(point.x - previous.x) + (queryPadding * 2),
      height: Math.abs(point.y - previous.y) + (queryPadding * 2)
    };
    obstacleIndex.query(segmentBounds, excludedObjects).forEach(entry => {
      const routingBounds = annotationEntityRelationshipRoutingObstacleBounds(
        entry.object,
        entry.bounds,
        clearance
      );
      if (!annotationOrthogonalSegmentTouchesObstacle(previous, point, routingBounds)) return;
      contacts.set(entry.index, entry);
    });
  });
  return [...contacts.values()].sort((first, second) => first.index - second.index);
}

function annotationEntityRelationshipObstacleRoute(
  basePointsInput,
  sourceUnit,
  targetUnit,
  entitiesInput,
  style,
  options = {}
) {
  const basePoints = compactAnnotationEntityRelationshipPoints(basePointsInput);
  const allObstacles = (Array.isArray(entitiesInput) ? entitiesInput : []).filter(Boolean);
  const allEntries = allObstacles
    .map((object, index) => ({ object, bounds: annotationObjectBounds(object), index }))
    .filter(entry => entry.bounds);
  const allEntities = allEntries.map(entry => entry.bounds);
  const obstacleIndex = options?.obstacleIndex;
  const excludedObjects = options?.excludedObjects;
  const sourceObject = options?.sourceObject;
  const targetObject = options?.targetObject;
  const clearance = annotationEntityRelationshipClearance(style);
  const start = basePoints[0];
  const end = basePoints.at(-1);
  const isEndpointObject = object => object === sourceObject || object === targetObject;
  const routeTouchesEntries = (points, entries, requiredClearance) => entries.some(entry => {
    const routingBounds = annotationEntityRelationshipRoutingObstacleBounds(
      entry.object,
      entry.bounds,
      requiredClearance
    );
    if (!routingBounds) return false;
    if (isEndpointObject(entry.object)) {
      return annotationEntityRelationshipRouteTouchesEndpointAwayFromField(
        points,
        routingBounds,
        {
          allowStart: entry.object === sourceObject,
          allowEnd: entry.object === targetObject,
          sourceUnit,
          targetUnit
        }
      );
    }
    return points.slice(1)
      .some((point, index) => annotationOrthogonalSegmentTouchesObstacle(points[index], point, routingBounds));
  });
  const routeWithEntries = (entries, requiredClearance) => {
    const entities = entries.map(entry => entry.bounds);
    const routingObstacles = entries
      .filter(entry => !isEndpointObject(entry.object))
      .map(entry => annotationEntityRelationshipRoutingObstacleBounds(
        entry.object,
        entry.bounds,
        requiredClearance
      ));
    const startEscape = annotationEntityRelationshipEscapePoint(start, sourceUnit, clearance, entities);
    const endEscape = annotationEntityRelationshipEscapePoint(
      end,
      { x: -targetUnit.x, y: -targetUnit.y },
      clearance,
      entities
    );
    const directRoutes = [
      [start, startEscape, { x: endEscape.x, y: startEscape.y }, endEscape, end],
      [start, startEscape, { x: startEscape.x, y: endEscape.y }, endEscape, end]
    ]
      .map(compactAnnotationEntityRelationshipPoints)
      .filter(route => !routeTouchesEntries(route, entries, requiredClearance))
      .sort((first, second) => annotationEntityRelationshipRouteLength(first)
        - annotationEntityRelationshipRouteLength(second)
        || annotationEntityRelationshipPath(first).localeCompare(annotationEntityRelationshipPath(second)));
    if (directRoutes.length) return directRoutes[0];
    const middle = annotationEntityRelationshipVisibilityRoute(
      startEscape,
      endEscape,
      entities,
      clearance,
      basePoints,
      routingObstacles
    );
    if (middle) {
      const routed = compactAnnotationEntityRelationshipPoints([start, ...middle, end]);
      if (!routeTouchesEntries(routed, entries, requiredClearance)) return routed;
    }
    const exteriorRoute = annotationEntityRelationshipExteriorFallbackRoute(
      start,
      end,
      startEscape,
      endEscape,
      entities,
      clearance,
      route => routeTouchesEntries(route, entries, requiredClearance)
    );
    return exteriorRoute || null;
  };

  const routeContacts = (points, requiredClearance) => {
    const contacts = obstacleIndex?.query
      ? annotationEntityRelationshipIndexedRouteContacts(
          points,
          obstacleIndex,
          excludedObjects,
          requiredClearance
        )
      : annotationEntityRelationshipRouteTouchesAnyRoutingObstacle(
          points,
          allObstacles.filter(object => !isEndpointObject(object)),
          requiredClearance
        )
        ? allEntries.filter(entry => !isEndpointObject(entry.object))
        : [];
    allEntries.filter(entry => isEndpointObject(entry.object)).forEach(entry => {
      if (routeTouchesEntries(points, [entry], requiredClearance)) contacts.push(entry);
    });
    return [...new Map(contacts.map(entry => [entry.index, entry])).values()]
      .sort((first, second) => first.index - second.index);
  };
  const findRoute = requiredClearance => {
    const baseContacts = routeContacts(basePoints, requiredClearance);
    if (!baseContacts.length) return basePoints;

    // Small diagrams keep the original all-obstacle route exactly. Larger diagrams
    // search only the route corridor, then validate against the shared spatial index.
    if (!obstacleIndex?.query || allEntities.length <= 32) {
      const route = routeWithEntries(allEntries, requiredClearance);
      return route && !routeContacts(route, requiredClearance).length ? route : null;
    }

    const candidates = new Map();
    const addCandidates = entries => entries.forEach(entry => candidates.set(entry.index, entry));
    addCandidates(baseContacts);
    let padding = Math.max(384, clearance * 8);
    for (let pass = 0; pass < 5; pass += 1) {
      const searchBounds = annotationEntityRelationshipPointsBounds(basePoints, padding);
      addCandidates(obstacleIndex.query(searchBounds, excludedObjects));
      const candidateEntries = [...candidates.values()]
        .sort((first, second) => first.index - second.index);
      const route = routeWithEntries(candidateEntries, requiredClearance);
      if (route) {
        const contacts = routeContacts(route, requiredClearance);
        if (!contacts.length) return route;
        const previousSize = candidates.size;
        addCandidates(contacts);
        if (candidates.size > previousSize) continue;
      }
      if (candidates.size >= allEntities.length) break;
      padding *= 2;
    }
    const route = routeWithEntries(allEntries, requiredClearance);
    return route && !routeContacts(route, requiredClearance).length ? route : null;
  };

  // Prefer the full visible corridor. If adjacent/anchored geometry makes it
  // impossible, retain the prior raw-obstacle-safe route instead of dropping the line.
  return findRoute(clearance) || findRoute(0);
}

function annotationEntityRelationshipClearance(styleInput) {
  const style = normalizeAnnotationEntityRelationshipStyle(styleInput);
  return Math.max(
    minimumEntityRelationshipClearance,
    style.arrowSize * 2,
    style.strokeWidth * 4
  );
}

function annotationEntityRelationshipRoutingObstacleBounds(object, boundsInput, clearance = 0) {
  const bounds = boundsInput || annotationObjectBounds(object);
  if (!bounds || object?.type !== "entity" || clearance <= 0) return bounds;
  const padding = Math.max(0, clearance - (annotationCoordinateTolerance * 2));
  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + (padding * 2),
    height: bounds.height + (padding * 2)
  };
}

function annotationEntityRelationshipRouteTouchesAnyRoutingObstacle(points, obstacles, clearance = 0) {
  return (Array.isArray(obstacles) ? obstacles : []).some(obstacle => {
    const bounds = annotationEntityRelationshipRoutingObstacleBounds(
      obstacle,
      annotationObjectBounds(obstacle),
      clearance
    );
    return bounds && points.slice(1)
      .some((point, index) => annotationOrthogonalSegmentTouchesObstacle(points[index], point, bounds));
  });
}

function annotationEntityRelationshipEscapePoint(point, unit, clearance, entities) {
  let distance = clearance;
  entities.forEach(entity => {
    let gap = Number.POSITIVE_INFINITY;
    if (unit.x && point.y > entity.y + annotationCoordinateTolerance
      && point.y < entity.y + entity.height - annotationCoordinateTolerance) {
      const boundary = unit.x > 0 ? entity.x : entity.x + entity.width;
      gap = unit.x > 0 ? boundary - point.x : point.x - boundary;
    } else if (unit.y && point.x > entity.x + annotationCoordinateTolerance
      && point.x < entity.x + entity.width - annotationCoordinateTolerance) {
      const boundary = unit.y > 0 ? entity.y : entity.y + entity.height;
      gap = unit.y > 0 ? boundary - point.y : point.y - boundary;
    }
    if (gap >= 0 && gap <= distance) distance = gap / 2;
  });
  return {
    x: point.x + (unit.x * distance),
    y: point.y + (unit.y * distance)
  };
}

function annotationEntityRelationshipExteriorFallbackRoute(
  start,
  end,
  startEscape,
  endEscape,
  entities,
  clearance,
  routeTouchesObstacle = route => annotationEntityRelationshipRouteTouchesAnyObstacle(route, entities)
) {
  if (!entities.length) return compactAnnotationEntityRelationshipPoints([start, startEscape, endEscape, end]);
  const left = Math.min(...entities.map(entity => entity.x)) - clearance;
  const right = Math.max(...entities.map(entity => entity.x + entity.width)) + clearance;
  const top = Math.min(...entities.map(entity => entity.y)) - clearance;
  const bottom = Math.max(...entities.map(entity => entity.y + entity.height)) + clearance;
  const candidates = [
    [start, startEscape, { x: startEscape.x, y: top }, { x: endEscape.x, y: top }, endEscape, end],
    [start, startEscape, { x: startEscape.x, y: bottom }, { x: endEscape.x, y: bottom }, endEscape, end],
    [start, startEscape, { x: left, y: startEscape.y }, { x: left, y: endEscape.y }, endEscape, end],
    [start, startEscape, { x: right, y: startEscape.y }, { x: right, y: endEscape.y }, endEscape, end]
  ];
  [left, right].forEach(outerX => {
    [top, bottom].forEach(outerY => {
      candidates.push(
        [
          start,
          startEscape,
          { x: outerX, y: startEscape.y },
          { x: outerX, y: outerY },
          { x: endEscape.x, y: outerY },
          endEscape,
          end
        ],
        [
          start,
          startEscape,
          { x: startEscape.x, y: outerY },
          { x: outerX, y: outerY },
          { x: outerX, y: endEscape.y },
          endEscape,
          end
        ]
      );
    });
  });
  const safeRoutes = candidates
    .map(compactAnnotationEntityRelationshipPoints)
    .filter(route => !routeTouchesObstacle(route));
  safeRoutes.sort((first, second) => annotationEntityRelationshipRouteLength(first)
    - annotationEntityRelationshipRouteLength(second)
    || annotationEntityRelationshipPath(first).localeCompare(annotationEntityRelationshipPath(second)));
  return safeRoutes[0] || null;
}

function annotationEntityRelationshipRouteTouchesEndpointAwayFromField(pointsInput, bounds, options = {}) {
  const points = Array.isArray(pointsInput) ? pointsInput : [];
  const connectorSegmentAllowed = (first, second, unit) => {
    if (!unit?.x || Math.abs(first.y - second.y) >= annotationCoordinateTolerance) return false;
    return ((second.x - first.x) * unit.x) > annotationCoordinateTolerance;
  };
  return points.slice(1).some((point, index) => {
    const previous = points[index];
    if (!annotationOrthogonalSegmentTouchesObstacle(previous, point, bounds)) return false;
    if (options.allowStart === true
      && index === 0
      && connectorSegmentAllowed(previous, point, options.sourceUnit)) return false;
    if (options.allowEnd === true
      && index === points.length - 2
      && connectorSegmentAllowed(previous, point, options.targetUnit)) return false;
    return true;
  });
}

function annotationEntityRelationshipRouteLength(points) {
  return points.slice(1).reduce((total, point, index) => total
    + Math.abs(point.x - points[index].x)
    + Math.abs(point.y - points[index].y), 0);
}

function annotationEntityRelationshipVisibilityRoute(
  start,
  end,
  entities,
  clearance,
  preferredPoints,
  routingObstacles = entities
) {
  const uniqueCoordinates = values => [...new Set(values.map(value => Number(formatNumber(value))))]
    .sort((first, second) => first - second);
  const xs = uniqueCoordinates([
    start.x,
    end.x,
    ...preferredPoints.map(point => point.x),
    ...entities.flatMap(entity => [entity.x - clearance, entity.x + entity.width + clearance])
  ]);
  const ys = uniqueCoordinates([
    start.y,
    end.y,
    ...preferredPoints.map(point => point.y),
    ...entities.flatMap(entity => [entity.y - clearance, entity.y + entity.height + clearance])
  ]);
  const nodes = [];
  const nodeIndexByPoint = new Map();
  const pointKey = (x, y) => `${formatNumber(x)}|${formatNumber(y)}`;
  ys.forEach(y => xs.forEach(x => {
    const point = { x, y };
    if (routingObstacles.some(entity => annotationPointInsideEntity(point, entity))) return;
    nodeIndexByPoint.set(pointKey(x, y), nodes.length);
    nodes.push(point);
  }));

  const startIndex = nodeIndexByPoint.get(pointKey(start.x, start.y));
  const endIndex = nodeIndexByPoint.get(pointKey(end.x, end.y));
  if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex)) return null;

  const neighbors = new Map(nodes.map((_, index) => [index, []]));
  const connect = (firstIndex, secondIndex) => {
    if (!Number.isInteger(firstIndex) || !Number.isInteger(secondIndex)) return;
    const first = nodes[firstIndex];
    const second = nodes[secondIndex];
    if (routingObstacles.some(entity => annotationOrthogonalSegmentTouchesObstacle(first, second, entity))) return;
    const distance = Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
    if (!distance) return;
    neighbors.get(firstIndex).push({ index: secondIndex, distance });
    neighbors.get(secondIndex).push({ index: firstIndex, distance });
  };
  ys.forEach(y => {
    const row = xs.map(x => nodeIndexByPoint.get(pointKey(x, y))).filter(Number.isInteger);
    for (let index = 1; index < row.length; index += 1) connect(row[index - 1], row[index]);
  });
  xs.forEach(x => {
    const column = ys.map(y => nodeIndexByPoint.get(pointKey(x, y))).filter(Number.isInteger);
    for (let index = 1; index < column.length; index += 1) connect(column[index - 1], column[index]);
  });

  const stateKey = (nodeIndex, direction) => `${nodeIndex}|${direction}`;
  const startKey = stateKey(startIndex, "");
  const best = new Map([[startKey, 0]]);
  const previous = new Map();
  const pending = [{ key: startKey, nodeIndex: startIndex, direction: "", cost: 0 }];
  let endState = null;
  while (pending.length) {
    pending.sort((first, second) => first.cost - second.cost
      || nodes[first.nodeIndex].y - nodes[second.nodeIndex].y
      || nodes[first.nodeIndex].x - nodes[second.nodeIndex].x
      || first.direction.localeCompare(second.direction));
    const current = pending.shift();
    if (current.cost !== best.get(current.key)) continue;
    if (current.nodeIndex === endIndex) {
      endState = current;
      break;
    }
    neighbors.get(current.nodeIndex).forEach(next => {
      const first = nodes[current.nodeIndex];
      const second = nodes[next.index];
      const direction = first.x === second.x ? "v" : "h";
      const bendCost = current.direction && current.direction !== direction ? clearance / 2 : 0;
      const cost = current.cost + next.distance + bendCost;
      const key = stateKey(next.index, direction);
      if (cost >= (best.get(key) ?? Number.POSITIVE_INFINITY)) return;
      best.set(key, cost);
      previous.set(key, current.key);
      pending.push({ key, nodeIndex: next.index, direction, cost });
    });
  }
  if (!endState) return null;

  const route = [];
  let key = endState.key;
  while (key) {
    const nodeIndex = Number(key.split("|")[0]);
    route.push(nodes[nodeIndex]);
    key = previous.get(key) || "";
  }
  return route.reverse();
}

function annotationPointInsideEntity(point, entity) {
  return point.x > entity.x + annotationCoordinateTolerance
    && point.x < entity.x + entity.width - annotationCoordinateTolerance
    && point.y > entity.y + annotationCoordinateTolerance
    && point.y < entity.y + entity.height - annotationCoordinateTolerance;
}

function annotationOrthogonalSegmentCrossesEntity(first, second, entity) {
  const left = entity.x + annotationCoordinateTolerance;
  const right = entity.x + entity.width - annotationCoordinateTolerance;
  const top = entity.y + annotationCoordinateTolerance;
  const bottom = entity.y + entity.height - annotationCoordinateTolerance;
  if (Math.abs(first.x - second.x) < annotationCoordinateTolerance) {
    return first.x > left
      && first.x < right
      && Math.max(Math.min(first.y, second.y), top) < Math.min(Math.max(first.y, second.y), bottom);
  }
  if (Math.abs(first.y - second.y) >= annotationCoordinateTolerance) return true;
  return first.y > top
    && first.y < bottom
    && Math.max(Math.min(first.x, second.x), left) < Math.min(Math.max(first.x, second.x), right);
}

function annotationEntityRelationshipRouteCrossesEntity(points, entities) {
  return points.slice(1).some((point, index) => entities
    .some(entity => annotationOrthogonalSegmentCrossesEntity(points[index], point, entity)));
}

function annotationEntityRelationshipRouteTouchesObstacle(points, obstacle, clearance = 0) {
  const bounds = annotationEntityRelationshipRoutingObstacleBounds(
    obstacle,
    annotationObjectBounds(obstacle),
    clearance
  );
  return Boolean(bounds) && points.slice(1)
    .some((point, index) => annotationOrthogonalSegmentTouchesObstacle(points[index], point, bounds));
}

function annotationEntityRelationshipRouteTouchesAnyObstacle(points, obstacles) {
  return points.slice(1).some((point, index) => obstacles
    .some(obstacle => annotationOrthogonalSegmentTouchesObstacle(points[index], point, obstacle)));
}

function annotationOrthogonalSegmentTouchesObstacle(first, second, obstacle) {
  const left = obstacle.x - annotationCoordinateTolerance;
  const right = obstacle.x + obstacle.width + annotationCoordinateTolerance;
  const top = obstacle.y - annotationCoordinateTolerance;
  const bottom = obstacle.y + obstacle.height + annotationCoordinateTolerance;
  if (Math.abs(first.x - second.x) < annotationCoordinateTolerance) {
    return first.x >= left
      && first.x <= right
      && Math.max(Math.min(first.y, second.y), top) <= Math.min(Math.max(first.y, second.y), bottom);
  }
  if (Math.abs(first.y - second.y) >= annotationCoordinateTolerance) return true;
  return first.y >= top
    && first.y <= bottom
    && Math.max(Math.min(first.x, second.x), left) <= Math.min(Math.max(first.x, second.x), right);
}

function compactAnnotationEntityRelationshipPoints(pointsInput) {
  const points = [];
  (Array.isArray(pointsInput) ? pointsInput : []).forEach(point => {
    const normalized = { x: Number(formatNumber(point.x)), y: Number(formatNumber(point.y)) };
    const previous = points.at(-1);
    if (previous && previous.x === normalized.x && previous.y === normalized.y) return;
    points.push(normalized);
    while (points.length >= 3) {
      const first = points.at(-3);
      const middle = points.at(-2);
      const last = points.at(-1);
      if ((first.x === middle.x && middle.x === last.x)
        || (first.y === middle.y && middle.y === last.y)) {
        points.splice(points.length - 2, 1);
      } else break;
    }
  });
  return points;
}

function annotationEntityRelationshipPath(pointsInput) {
  const points = compactAnnotationEntityRelationshipPoints(pointsInput);
  if (!points.length) return "";
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    return previous.y === point.y
      ? `${path} H ${formatNumber(point.x)}`
      : `${path} V ${formatNumber(point.y)}`;
  }, `M ${formatNumber(points[0].x)} ${formatNumber(points[0].y)}`);
}

function compareAnnotationEntityRelationships(first, second) {
  const key = relationship => [
    formatAnnotationEntityIdentifier(relationship.source?.entitySchema, relationship.source?.entityName),
    relationship.sourceField?.name || "",
    formatAnnotationEntityIdentifier(relationship.target?.entitySchema, relationship.target?.entityName),
    relationship.targetField?.name || ""
  ].join(".").toLocaleLowerCase();
  return key(first).localeCompare(key(second));
}

function annotationEntityFieldAnchorY(entity, field) {
  const index = annotationEntityVisibleFieldIndex(entity, field);
  const metrics = annotationEntityMetrics(entity);
  return index >= 0
    ? entity.y + metrics.headerHeight + ((index + 0.5) * metrics.rowHeight)
    : null;
}

function annotationEntityVisibleFieldIndex(entity, field) {
  return annotationEntityVisibleFields(entity)
    .findIndex(candidate => String(candidate.name || "").toLowerCase() === String(field?.name || "").toLowerCase());
}

function annotationEntityRelationshipMarkerGeometry(start, end, sourceUnit, targetUnit, relationshipType, styleInput) {
  const style = normalizeAnnotationEntityRelationshipStyle(styleInput);
  const size = style.arrowSize;
  const perpendicular = unit => ({ x: -unit.y, y: unit.x });
  const point = (origin, unit, along, across = 0) => {
    const acrossUnit = perpendicular(unit);
    return {
      x: origin.x + (unit.x * along) + (acrossUnit.x * across),
      y: origin.y + (unit.y * along) + (acrossUnit.y * across)
    };
  };
  const arrowTip = end;
  const targetPerpendicular = perpendicular(targetUnit);
  const sourcePerpendicular = perpendicular(sourceUnit);
  const arrowBase = point(end, targetUnit, -size);
  const arrowLeft = { x: arrowBase.x + (targetPerpendicular.x * (size / 2)), y: arrowBase.y + (targetPerpendicular.y * (size / 2)) };
  const arrowRight = { x: arrowBase.x - (targetPerpendicular.x * (size / 2)), y: arrowBase.y - (targetPerpendicular.y * (size / 2)) };
  const geometry = {
    arrowPoints: [arrowTip, arrowLeft, arrowRight],
    lineSegments: []
  };
  if (!relationshipType) return geometry;

  const targetBarCenter = point(end, targetUnit, -(size * 1.4));
  geometry.lineSegments.push([
    { x: targetBarCenter.x + (targetPerpendicular.x * (size * 0.7)), y: targetBarCenter.y + (targetPerpendicular.y * (size * 0.7)) },
    { x: targetBarCenter.x - (targetPerpendicular.x * (size * 0.7)), y: targetBarCenter.y - (targetPerpendicular.y * (size * 0.7)) }
  ]);
  if (relationshipType === "one-to-one") {
    const sourceBarCenter = point(start, sourceUnit, size * 0.8);
    geometry.lineSegments.push([
      { x: sourceBarCenter.x + (sourcePerpendicular.x * (size * 0.7)), y: sourceBarCenter.y + (sourcePerpendicular.y * (size * 0.7)) },
      { x: sourceBarCenter.x - (sourcePerpendicular.x * (size * 0.7)), y: sourceBarCenter.y - (sourcePerpendicular.y * (size * 0.7)) }
    ]);
    return geometry;
  }

  const crowVertex = point(start, sourceUnit, size * 1.1);
  const crowTop = { x: start.x + (sourcePerpendicular.x * (size * 0.8)), y: start.y + (sourcePerpendicular.y * (size * 0.8)) };
  const crowBottom = { x: start.x - (sourcePerpendicular.x * (size * 0.8)), y: start.y - (sourcePerpendicular.y * (size * 0.8)) };
  geometry.lineSegments.push([crowVertex, crowTop], [crowVertex, start], [crowVertex, crowBottom]);
  return geometry;
}

function annotationEntityRelationshipMarkers(start, end, sourceUnit, targetUnit, relationshipType, styleInput) {
  const style = normalizeAnnotationEntityRelationshipStyle(styleInput);
  if (!style.showSymbols) return "";
  const color = style.stroke;
  const geometry = annotationEntityRelationshipMarkerGeometry(
    start,
    end,
    sourceUnit,
    targetUnit,
    relationshipType,
    style
  );
  const lines = geometry.lineSegments.length
    ? `<path class="image-annotation-entity-relationship-marker" d="${geometry.lineSegments.map(([first, second]) => `M ${formatNumber(first.x)} ${formatNumber(first.y)} L ${formatNumber(second.x)} ${formatNumber(second.y)}`).join(" ")}" fill="none" stroke="${escapeXmlAttr(color)}" stroke-width="${formatNumber(style.strokeWidth)}" pointer-events="none"></path>`
    : "";
  const arrow = `<polygon class="image-annotation-entity-relationship-marker" points="${geometry.arrowPoints.map(point => `${formatNumber(point.x)},${formatNumber(point.y)}`).join(" ")}" fill="${escapeXmlAttr(color)}" pointer-events="none"></polygon>`;
  return `${lines}${arrow}`;
}

function annotationCanvasDefs(state, zoom) {
  const size = state.gridSize;
  const lineWidth = Math.max(0.5, 1 / zoom);
  return `
    <defs>
      <pattern id="pmt-annotation-grid" width="${formatNumber(size)}" height="${formatNumber(size)}" patternUnits="userSpaceOnUse">
        <path d="M ${formatNumber(size)} 0 L 0 0 0 ${formatNumber(size)}" fill="none" stroke="currentColor" stroke-width="${formatNumber(lineWidth)}" opacity="0.34"></path>
      </pattern>
    </defs>
  `;
}

function annotationCanvasBackgroundSvg(state, requestedBounds = null) {
  const bounds = requestedBounds || state.canvasBounds;
  return `<rect class="image-annotation-canvas-background" x="${formatNumber(bounds.x)}" y="${formatNumber(bounds.y)}" width="${formatNumber(bounds.width)}" height="${formatNumber(bounds.height)}" fill="#ffffff" pointer-events="none"></rect>`;
}

function annotationGridSvg(bounds) {
  return `<rect class="image-annotation-grid" x="${formatNumber(bounds.x)}" y="${formatNumber(bounds.y)}" width="${formatNumber(bounds.width)}" height="${formatNumber(bounds.height)}" fill="url(#pmt-annotation-grid)" pointer-events="none"></rect>`;
}

function annotationObjectSvg(object, options = {}) {
  const id = options.exportMode ? "" : ` data-annotation-object-id="${escapeXmlAttr(object.id)}"`;
  const type = options.exportMode ? "" : ` data-annotation-object-type="${escapeXmlAttr(object.type)}"`;
  const classes = options.exportMode ? "" : ` class="image-annotation-object${object.locked ? " is-locked" : ""}"`;
  const group = object.groupId ? ` data-pmt-annotation-group="${escapeXmlAttr(object.groupId)}"` : "";
  const locked = object.locked ? ` data-pmt-annotation-locked="true"` : "";
  const clipSuffix = options.clipKey ? `-${safeSvgId(options.clipKey)}` : "";
  if (object.type === "embedded-image") {
    const clip = annotationEmbeddedImageEffectiveClip(object);
    const fullBounds = annotationObjectBounds(object);
    const cropped = object.cropVisible !== false && !annotationBoundsEqual(clip, fullBounds);
    const clipId = `pmt-annotation-image-clip-${safeSvgId(object.id)}${clipSuffix}`;
    const definition = cropped
      ? `<defs><clipPath id="${clipId}"><rect x="${formatNumber(clip.x)}" y="${formatNumber(clip.y)}" width="${formatNumber(clip.width)}" height="${formatNumber(clip.height)}"></rect></clipPath></defs>`
      : "";
    const clipPath = cropped ? ` clip-path="url(#${clipId})"` : "";
    return `${definition}<image${id}${type}${classes}${group}${locked} href="${escapeXmlAttr(object.source)}" x="${formatNumber(object.x)}" y="${formatNumber(object.y)}" width="${formatNumber(object.width)}" height="${formatNumber(object.height)}" preserveAspectRatio="none"${clipPath}></image>`;
  }
  if (object.type === "rectangle") {
    const stroke = object.outlineVisible === false ? "none" : object.stroke;
    return `<rect${id}${type}${classes}${group}${locked} x="${formatNumber(object.x)}" y="${formatNumber(object.y)}" width="${formatNumber(object.width)}" height="${formatNumber(object.height)}" rx="0" fill="${escapeXmlAttr(object.fill)}" stroke="${escapeXmlAttr(stroke)}" stroke-width="${formatNumber(object.strokeWidth)}" opacity="${formatNumber(object.opacity)}"></rect>`;
  }
  if (object.type === "circle") {
    const stroke = object.outlineVisible === false ? "none" : object.stroke;
    return `<ellipse${id}${type}${classes}${group}${locked} cx="${formatNumber(object.x + (object.width / 2))}" cy="${formatNumber(object.y + (object.height / 2))}" rx="${formatNumber(object.width / 2)}" ry="${formatNumber(object.height / 2)}" fill="${escapeXmlAttr(object.fill)}" stroke="${escapeXmlAttr(stroke)}" stroke-width="${formatNumber(object.strokeWidth)}" opacity="${formatNumber(object.opacity)}"></ellipse>`;
  }
  if (object.type === "entity") {
    return annotationEntitySvg(object, {
      id,
      type,
      classes,
      group,
      locked,
      exportMode: options.exportMode,
      clipboardMode: options.clipboardMode === true,
      clipKey: options.clipKey,
      interactiveEntityHeaders: options.interactiveEntityHeaders === true
    });
  }
  if (object.type === "arrow") {
    const geometry = annotationArrowGeometry(object);
    const head = geometry.headPoints
      .map(point => `${formatNumber(point.x)},${formatNumber(point.y)}`)
      .join(" ");
    const hitTargets = options.exportMode ? "" : `<line class="image-annotation-arrow-hit" x1="${formatNumber(object.x1)}" y1="${formatNumber(object.y1)}" x2="${formatNumber(geometry.shaftEnd.x)}" y2="${formatNumber(geometry.shaftEnd.y)}" stroke="transparent" stroke-width="${formatNumber(object.strokeWidth)}" stroke-linecap="round" pointer-events="stroke"></line><polygon class="image-annotation-arrow-head-hit" points="${head}" fill="transparent" pointer-events="fill"></polygon>`;
    return `<g${id}${type}${classes}${group}${locked} opacity="${formatNumber(object.opacity)}">${hitTargets}<line class="image-annotation-arrow-shaft" x1="${formatNumber(object.x1)}" y1="${formatNumber(object.y1)}" x2="${formatNumber(geometry.shaftEnd.x)}" y2="${formatNumber(geometry.shaftEnd.y)}" stroke="${escapeXmlAttr(object.stroke)}" stroke-width="${formatNumber(object.strokeWidth)}" stroke-linecap="round" pointer-events="none"></line><polygon class="image-annotation-arrow-head" points="${head}" fill="${escapeXmlAttr(object.stroke)}" pointer-events="none"></polygon></g>`;
  }
  if (object.type === "line") {
    const hitTarget = options.exportMode ? "" : `<line class="image-annotation-arrow-hit image-annotation-line-hit" x1="${formatNumber(object.x1)}" y1="${formatNumber(object.y1)}" x2="${formatNumber(object.x2)}" y2="${formatNumber(object.y2)}" stroke="transparent" stroke-width="${formatNumber(object.strokeWidth)}" stroke-linecap="round" pointer-events="stroke"></line>`;
    return `<g${id}${type}${classes}${group}${locked} opacity="${formatNumber(object.opacity)}">${hitTarget}<line class="image-annotation-line" x1="${formatNumber(object.x1)}" y1="${formatNumber(object.y1)}" x2="${formatNumber(object.x2)}" y2="${formatNumber(object.y2)}" stroke="${escapeXmlAttr(object.stroke)}" stroke-width="${formatNumber(object.strokeWidth)}" stroke-linecap="round" pointer-events="none"></line></g>`;
  }
  if (object.type === "textbox") {
    return annotationTextBoxSvg(object, {
      id,
      type,
      classes,
      group,
      locked,
      exportMode: options.exportMode,
      clipKey: options.clipKey
    });
  }
  return "";
}

function annotationTextBoxSvg(object, attributes) {
  const lines = wrapAnnotationText(object.text, object.width, object.fontSize);
  const padding = Math.max(4, object.fontSize * 0.35);
  const lineHeight = object.fontSize * 1.2;
  const maximumLines = Math.max(1, Math.floor(Math.max(1, object.height - (padding * 2)) / lineHeight));
  const visibleLines = lines.slice(0, maximumLines);
  const textAlign = safeTextAlign(object.textAlign);
  const textVerticalAlign = safeTextVerticalAlign(object.textVerticalAlign);
  const textX = textAlign === "center"
    ? object.x + (object.width / 2)
    : textAlign === "right"
      ? object.x + object.width - padding
      : object.x + padding;
  const textAnchor = textAlign === "center" ? "middle" : textAlign === "right" ? "end" : "start";
  const textAscent = object.fontSize * 0.8;
  const textBlockHeight = object.fontSize + (Math.max(0, visibleLines.length - 1) * lineHeight);
  const innerHeight = Math.max(0, object.height - (padding * 2));
  const freeSpace = Math.max(0, innerHeight - textBlockHeight);
  const verticalOffset = textVerticalAlign === "middle"
    ? freeSpace / 2
    : textVerticalAlign === "bottom"
      ? freeSpace
      : 0;
  const textY = object.y + padding + verticalOffset + textAscent;
  const clipSuffix = attributes.clipKey ? `-${safeSvgId(attributes.clipKey)}` : "";
  const clipId = `pmt-annotation-clip-${safeSvgId(object.id)}${clipSuffix}`;
  const tspans = visibleLines.map((line, index) =>
    `<tspan x="${formatNumber(textX)}" dy="${index === 0 ? 0 : formatNumber(lineHeight)}">${escapeXmlText(line)}</tspan>`
  ).join("");
  const stroke = object.outlineVisible === false ? "none" : object.stroke;
  return `<g${attributes.id}${attributes.type}${attributes.classes}${attributes.group}${attributes.locked} opacity="${formatNumber(object.opacity)}"><defs><clipPath id="${clipId}"><rect x="${formatNumber(object.x)}" y="${formatNumber(object.y)}" width="${formatNumber(object.width)}" height="${formatNumber(object.height)}"></rect></clipPath></defs><rect x="${formatNumber(object.x)}" y="${formatNumber(object.y)}" width="${formatNumber(object.width)}" height="${formatNumber(object.height)}" fill="${escapeXmlAttr(object.fill)}" stroke="${escapeXmlAttr(stroke)}" stroke-width="${formatNumber(object.strokeWidth)}"></rect><text x="${formatNumber(textX)}" y="${formatNumber(textY)}" text-anchor="${textAnchor}" fill="${escapeXmlAttr(object.textColor)}" font-family="${escapeXmlAttr(object.fontFamily)}" font-size="${formatNumber(object.fontSize)}" clip-path="url(#${clipId})">${tspans}</text></g>`;
}

function annotationEntitySvg(object, attributes) {
  const metrics = annotationEntityMetrics(object);
  const clipSuffix = attributes.clipKey ? `-${safeSvgId(attributes.clipKey)}` : "";
  const clipId = `pmt-annotation-entity-clip-${safeSvgId(object.id)}${clipSuffix}`;
  const headerTitleClipId = `${clipId}-header-title`;
  const keyClipId = `${clipId}-keys`;
  const fieldClipId = `${clipId}-fields`;
  const dataTypeClipId = `${clipId}-data-types`;
  const notClipId = `${clipId}-not`;
  const nullClipId = `${clipId}-null`;
  const stroke = object.outlineVisible === false ? "none" : object.stroke;
  const headerFill = object.entityHeaderFill || (object.fill === "none" ? defaultEntityFill : object.fill);
  const entityNameTextColor = object.entityNameTextColor || object.textColor;
  const entityName = formatAnnotationEntityIdentifier(object.entitySchema, object.entityName) || "Entity";
  const headerY = object.y + metrics.headerHeight;
  const fields = annotationEntityVisibleFields(object);
  const showKeyColumn = object.showKeyColumn !== false;
  const showDataTypes = object.showDataTypes === true;
  const keyColumnWidth = showKeyColumn
    ? Math.min(metrics.keyColumnWidth, object.width * 0.22)
    : 0;
  const detailWidth = Math.max(0, object.width - keyColumnWidth);
  const notColumnWidth = showDataTypes
    ? Math.min(metrics.notColumnWidth, detailWidth * 0.13)
    : 0;
  const nullColumnWidth = showDataTypes
    ? Math.min(metrics.nullColumnWidth, detailWidth * 0.15)
    : 0;
  const dataTypeColumnWidth = showDataTypes
    ? Math.min(metrics.dataTypeColumnWidth, detailWidth * 0.38)
    : 0;
  const fieldX = object.x + keyColumnWidth;
  const dataTypeX = object.x + object.width - dataTypeColumnWidth - notColumnWidth - nullColumnWidth;
  const notX = dataTypeX + dataTypeColumnWidth;
  const nullX = notX + notColumnWidth;
  const fieldWidth = Math.max(0, dataTypeX - fieldX);
  const bodyHeight = Math.max(0, object.height - metrics.headerHeight);
  const gridLineWidth = Math.max(0.5, object.strokeWidth * 0.55);
  const firstNonPrimaryKeyIndex = fields.findIndex(field => !field.isPrimaryKey);
  const leadingPrimaryKeyCount = firstNonPrimaryKeyIndex < 0 ? fields.length : firstNonPrimaryKeyIndex;
  const rows = fields.map((field, index) => {
    const rowTop = headerY + (index * metrics.rowHeight);
    const textY = rowTop + (metrics.rowHeight * 0.68);
    const keys = [field.isPrimaryKey ? "PK" : "", field.isForeignKey ? "FK" : ""].filter(Boolean).join("/");
    const fieldName = formatAnnotationEntityIdentifier(field.name);
    const details = [fieldName,
      field.dataType,
      field.identity || (field.isIdentity ? "IDENTITY" : ""),
      field.nullable === false ? "NOT NULL" : field.nullable === true ? "NULL" : "",
      field.isPrimaryKey ? "PRIMARY KEY" : "",
      field.isForeignKey ? "FOREIGN KEY" : ""
    ].filter(Boolean).join(" - ");
    const keyText = showKeyColumn && keys
      ? `<text x="${formatNumber(object.x + (keyColumnWidth / 2))}" y="${formatNumber(textY)}" text-anchor="middle" clip-path="url(#${keyClipId})" fill="${escapeXmlAttr(object.textColor)}" font-family="${escapeXmlAttr(object.fontFamily)}" font-size="${formatNumber(metrics.fontSize * 0.82)}">${escapeXmlText(keys)}</text>`
      : "";
    const visibleDataType = [
      field.dataType,
      field.identity || (field.isIdentity ? "IDENTITY" : "")
    ].filter(Boolean).join(" ");
    const dataTypeText = showDataTypes
      ? `<text x="${formatNumber(dataTypeX + metrics.padding)}" y="${formatNumber(textY)}" clip-path="url(#${dataTypeClipId})" fill="${escapeXmlAttr(object.textColor)}" font-family="${escapeXmlAttr(object.fontFamily)}" font-size="${formatNumber(metrics.fontSize * 0.86)}">${escapeXmlText(visibleDataType)}</text>`
      : "";
    const notText = showDataTypes && field.nullable === false
      ? `<text x="${formatNumber(notX + (notColumnWidth / 2))}" y="${formatNumber(textY)}" text-anchor="middle" clip-path="url(#${notClipId})" fill="${escapeXmlAttr(object.textColor)}" font-family="${escapeXmlAttr(object.fontFamily)}" font-size="${formatNumber(metrics.fontSize * 0.82)}">NOT</text>`
      : "";
    const nullText = showDataTypes && field.nullable !== null
      ? `<text x="${formatNumber(nullX + (nullColumnWidth / 2))}" y="${formatNumber(textY)}" text-anchor="middle" clip-path="url(#${nullClipId})" fill="${escapeXmlAttr(object.textColor)}" font-family="${escapeXmlAttr(object.fontFamily)}" font-size="${formatNumber(metrics.fontSize * 0.82)}">NULL</text>`
      : "";
    return `<g><title>${escapeXmlText(details)}</title>${keyText}<text x="${formatNumber(fieldX + metrics.padding)}" y="${formatNumber(textY)}" clip-path="url(#${fieldClipId})" fill="${escapeXmlAttr(object.textColor)}" font-family="${escapeXmlAttr(object.fontFamily)}" font-size="${formatNumber(metrics.fontSize)}"${field.isPrimaryKey ? ` font-weight="700" text-decoration="underline"` : ""}>${escapeXmlText(fieldName)}</text>${dataTypeText}${notText}${nullText}</g>`;
  }).join("");
  const keyDivider = showKeyColumn
    ? `<line x1="${formatNumber(fieldX)}" y1="${formatNumber(headerY)}" x2="${formatNumber(fieldX)}" y2="${formatNumber(object.y + object.height)}" stroke="${escapeXmlAttr(stroke)}" stroke-width="${formatNumber(gridLineWidth)}"></line>`
    : "";
  const dataTypeDivider = showDataTypes && dataTypeColumnWidth > 0
    ? `<line x1="${formatNumber(dataTypeX)}" y1="${formatNumber(headerY)}" x2="${formatNumber(dataTypeX)}" y2="${formatNumber(object.y + object.height)}" stroke="${escapeXmlAttr(stroke)}" stroke-width="${formatNumber(gridLineWidth)}"></line>`
    : "";
  const notDivider = showDataTypes && notColumnWidth > 0
    ? `<line x1="${formatNumber(notX)}" y1="${formatNumber(headerY)}" x2="${formatNumber(notX)}" y2="${formatNumber(object.y + object.height)}" stroke="${escapeXmlAttr(stroke)}" stroke-width="${formatNumber(gridLineWidth)}"></line>`
    : "";
  const nullDivider = showDataTypes && nullColumnWidth > 0
    ? `<line x1="${formatNumber(nullX)}" y1="${formatNumber(headerY)}" x2="${formatNumber(nullX)}" y2="${formatNumber(object.y + object.height)}" stroke="${escapeXmlAttr(stroke)}" stroke-width="${formatNumber(gridLineWidth)}"></line>`
    : "";
  const primaryKeyDividerY = headerY + (leadingPrimaryKeyCount * metrics.rowHeight);
  const primaryKeyDivider = leadingPrimaryKeyCount > 0 && leadingPrimaryKeyCount < fields.length
    ? `<line x1="${formatNumber(object.x)}" y1="${formatNumber(primaryKeyDividerY)}" x2="${formatNumber(object.x + object.width)}" y2="${formatNumber(primaryKeyDividerY)}" stroke="${escapeXmlAttr(stroke)}" stroke-width="${formatNumber(gridLineWidth)}"></line>`
    : "";

  const headerButtonSize = Math.max(16, Math.min(20, metrics.headerHeight - 8));
  const headerButtonY = object.y + ((metrics.headerHeight - headerButtonSize) / 2);
  const collapseButton = annotationEntityHeaderButtonSvg(object, attributes, {
    action: "collapsed",
    x: object.x + 5,
    y: headerButtonY,
    size: headerButtonSize,
    label: object.collapsed ? "&#8595;" : "&#8593;",
    title: object.collapsed ? "Expand Entity" : "Collapse Entity",
    pressed: object.collapsed === true
  });
  const dataTypeButton = annotationEntityHeaderButtonSvg(object, attributes, {
    action: "showDataTypes",
    x: object.x + object.width - headerButtonSize - 5,
    y: headerButtonY,
    size: headerButtonSize,
    label: object.showDataTypes ? "&#8592;" : "&#8594;",
    title: object.showDataTypes ? "Hide data types" : "Show data types",
    pressed: object.showDataTypes === true
  });
  const titleInset = headerButtonSize + 12;

  const keyClip = showKeyColumn
    ? `<clipPath id="${keyClipId}"><rect x="${formatNumber(object.x)}" y="${formatNumber(headerY)}" width="${formatNumber(keyColumnWidth)}" height="${formatNumber(bodyHeight)}"></rect></clipPath>`
    : "";
  const dataTypeClips = showDataTypes
    ? `<clipPath id="${dataTypeClipId}"><rect x="${formatNumber(dataTypeX)}" y="${formatNumber(headerY)}" width="${formatNumber(dataTypeColumnWidth)}" height="${formatNumber(bodyHeight)}"></rect></clipPath><clipPath id="${notClipId}"><rect x="${formatNumber(notX)}" y="${formatNumber(headerY)}" width="${formatNumber(notColumnWidth)}" height="${formatNumber(bodyHeight)}"></rect></clipPath><clipPath id="${nullClipId}"><rect x="${formatNumber(nullX)}" y="${formatNumber(headerY)}" width="${formatNumber(nullColumnWidth)}" height="${formatNumber(bodyHeight)}"></rect></clipPath>`
    : "";

  return `<g${attributes.id}${attributes.type}${attributes.classes}${attributes.group}${attributes.locked} opacity="${formatNumber(object.opacity)}"><defs><clipPath id="${headerTitleClipId}"><rect x="${formatNumber(object.x + titleInset)}" y="${formatNumber(object.y)}" width="${formatNumber(Math.max(0, object.width - (titleInset * 2)))}" height="${formatNumber(metrics.headerHeight)}"></rect></clipPath>${keyClip}<clipPath id="${fieldClipId}"><rect x="${formatNumber(fieldX)}" y="${formatNumber(headerY)}" width="${formatNumber(fieldWidth)}" height="${formatNumber(bodyHeight)}"></rect></clipPath>${dataTypeClips}</defs><g><rect x="${formatNumber(object.x)}" y="${formatNumber(object.y)}" width="${formatNumber(object.width)}" height="${formatNumber(object.height)}" fill="${escapeXmlAttr(object.fill)}"></rect><rect x="${formatNumber(object.x)}" y="${formatNumber(object.y)}" width="${formatNumber(object.width)}" height="${formatNumber(metrics.headerHeight)}" fill="${escapeXmlAttr(headerFill)}"></rect><text x="${formatNumber(object.x + (object.width / 2))}" y="${formatNumber(object.y + (metrics.headerHeight * 0.68))}" text-anchor="middle" clip-path="url(#${headerTitleClipId})" fill="${escapeXmlAttr(entityNameTextColor)}" font-family="${escapeXmlAttr(object.fontFamily)}" font-size="${formatNumber(metrics.fontSize * 1.05)}" font-weight="700">${escapeXmlText(entityName)}</text><line x1="${formatNumber(object.x)}" y1="${formatNumber(headerY)}" x2="${formatNumber(object.x + object.width)}" y2="${formatNumber(headerY)}" stroke="${escapeXmlAttr(stroke)}" stroke-width="${formatNumber(gridLineWidth)}"></line>${keyDivider}${dataTypeDivider}${notDivider}${nullDivider}${primaryKeyDivider}${rows}</g>${collapseButton}${dataTypeButton}<rect x="${formatNumber(object.x)}" y="${formatNumber(object.y)}" width="${formatNumber(object.width)}" height="${formatNumber(object.height)}" fill="none" stroke="${escapeXmlAttr(stroke)}" stroke-width="${formatNumber(object.strokeWidth)}" pointer-events="none"></rect></g>`;
}

function annotationEntityHeaderButtonSvg(object, attributes, options) {
  if (attributes.clipboardMode) return "";
  const active = options.pressed === true;
  const headerFill = object.entityHeaderFill || (object.fill === "none" ? defaultEntityFill : object.fill);
  const headerTextColor = object.entityNameTextColor || object.textColor;
  const fill = active ? object.stroke : headerFill;
  const textColor = active ? headerFill : headerTextColor;
  const interactive = !attributes.exportMode || attributes.interactiveEntityHeaders === true;
  const interaction = interactive
    ? ` data-annotation-entity-header-action="${options.action}" data-annotation-entity-id="${escapeXmlAttr(object.id)}" role="button" tabindex="0" aria-label="${escapeXmlAttr(options.title)}" aria-pressed="${active}"${object.locked ? ` aria-disabled="true"` : ""}`
    : "";
  return `<g class="image-annotation-entity-header-button"${interaction}><title>${escapeXmlText(options.title)}</title><rect x="${formatNumber(options.x)}" y="${formatNumber(options.y)}" width="${formatNumber(options.size)}" height="${formatNumber(options.size)}" fill="${escapeXmlAttr(fill)}" stroke="${escapeXmlAttr(object.stroke)}" stroke-width="1"></rect><text x="${formatNumber(options.x + (options.size / 2))}" y="${formatNumber(options.y + (options.size * 0.7))}" text-anchor="middle" fill="${escapeXmlAttr(textColor)}" font-family="${escapeXmlAttr(object.fontFamily)}" font-size="${formatNumber(options.size * 0.72)}" font-weight="700" pointer-events="none">${options.label}</text></g>`;
}

function annotationSelectionSvg(objects, zoom, imageFrame = null) {
  if (!objects.length) return "";
  if (objects.length === 1 && ["arrow", "line"].includes(objects[0].type)) {
    return annotationArrowSelectionSvg(objects[0], zoom);
  }
  const bounds = annotationSelectionBounds(objects, imageFrame);
  if (!bounds) return "";
  const locked = objects.some(object => object.locked);
  const handleRadius = 3.5 / Math.max(minimumZoom, zoom);
  const memberGuides = annotationGroupMemberGuidesSvg(objects, imageFrame);
  const outline = `<rect class="image-annotation-selection${locked ? " is-locked" : ""}" x="${formatNumber(bounds.x)}" y="${formatNumber(bounds.y)}" width="${formatNumber(bounds.width)}" height="${formatNumber(bounds.height)}" fill="none" stroke-width="1" pointer-events="none"></rect>`;
  if (locked) return `<g class="image-annotation-selection-group">${memberGuides}${outline}</g>`;

  const handles = annotationHandlePoints(bounds).map(handle =>
    `<circle class="image-annotation-handle" data-annotation-handle="${handle.direction}" cx="${formatNumber(handle.x)}" cy="${formatNumber(handle.y)}" r="${formatNumber(handleRadius)}" stroke-width="0.75"></circle>`
  ).join("");
  return `<g class="image-annotation-selection-group">${memberGuides}${outline}${handles}</g>`;
}

function annotationGroupMemberGuidesSvg(objects, imageFrame) {
  const groupCounts = new Map();
  objects.forEach(object => {
    if (!object.groupId) return;
    groupCounts.set(object.groupId, (groupCounts.get(object.groupId) || 0) + 1);
  });
  return objects
    .filter(object => object.groupId && groupCounts.get(object.groupId) > 1)
    .map(object => {
      const id = ` data-annotation-group-member-id="${escapeXmlAttr(object.id)}"`;
      if (["arrow", "line"].includes(object.type)) {
        return `<line class="image-annotation-group-member-guide is-arrow"${id} x1="${formatNumber(object.x1)}" y1="${formatNumber(object.y1)}" x2="${formatNumber(object.x2)}" y2="${formatNumber(object.y2)}" pointer-events="none"></line>`;
      }
      const bounds = annotationObjectVisualBounds(object);
      if (!bounds) return "";
      return `<rect class="image-annotation-group-member-guide"${id} x="${formatNumber(bounds.x)}" y="${formatNumber(bounds.y)}" width="${formatNumber(bounds.width)}" height="${formatNumber(bounds.height)}" fill="none" pointer-events="none"></rect>`;
    })
    .join("");
}

function annotationArrowSelectionSvg(object, zoom) {
  const handleRadius = 3.5 / Math.max(minimumZoom, zoom);
  const lockedClass = object.locked ? " is-locked" : "";
  const baseHandle = object.locked ? "" : ` data-annotation-handle="arrow-base"`;
  const tipHandle = object.locked ? "" : ` data-annotation-handle="arrow-tip"`;
  return `<g class="image-annotation-selection-group image-annotation-arrow-selection${lockedClass}"><circle class="image-annotation-handle image-annotation-arrow-handle${lockedClass}"${baseHandle} cx="${formatNumber(object.x1)}" cy="${formatNumber(object.y1)}" r="${formatNumber(handleRadius)}" stroke-width="0.75"></circle><circle class="image-annotation-handle image-annotation-arrow-handle${lockedClass}"${tipHandle} cx="${formatNumber(object.x2)}" cy="${formatNumber(object.y2)}" r="${formatNumber(handleRadius)}" stroke-width="0.75"></circle></g>`;
}

function annotationCropPreviewSvg(rect, state) {
  const image = annotationCropImage(state, rect.imageId);
  const clip = annotationObjectBounds(image) || rect;
  return `<path class="image-annotation-crop-mask" d="M${formatNumber(clip.x)} ${formatNumber(clip.y)}H${formatNumber(clip.x + clip.width)}V${formatNumber(clip.y + clip.height)}H${formatNumber(clip.x)}Z M${formatNumber(rect.x)} ${formatNumber(rect.y)}V${formatNumber(rect.y + rect.height)}H${formatNumber(rect.x + rect.width)}V${formatNumber(rect.y)}Z" fill-rule="evenodd" pointer-events="none"></path><rect class="image-annotation-crop-outline image-annotation-marquee" x="${formatNumber(rect.x)}" y="${formatNumber(rect.y)}" width="${formatNumber(rect.width)}" height="${formatNumber(rect.height)}" pointer-events="none"></rect>`;
}

function annotationMarqueeSvg(rect) {
  return `<rect class="image-annotation-marquee" x="${formatNumber(rect.x)}" y="${formatNumber(rect.y)}" width="${formatNumber(rect.width)}" height="${formatNumber(rect.height)}" pointer-events="none"></rect>`;
}

function annotationHandlePoints(bounds) {
  const left = bounds.x;
  const centerX = bounds.x + (bounds.width / 2);
  const right = bounds.x + bounds.width;
  const top = bounds.y;
  const centerY = bounds.y + (bounds.height / 2);
  const bottom = bounds.y + bounds.height;
  return [
    { direction: "nw", x: left, y: top },
    { direction: "n", x: centerX, y: top },
    { direction: "ne", x: right, y: top },
    { direction: "e", x: right, y: centerY },
    { direction: "se", x: right, y: bottom },
    { direction: "s", x: centerX, y: bottom },
    { direction: "sw", x: left, y: bottom },
    { direction: "w", x: left, y: centerY }
  ];
}

export function annotationSelectionBounds(objects, imageFrame = null) {
  const boxes = (objects || []).map(object => object?.type === "embedded-image"
    ? annotationObjectVisualBounds(object)
    : annotationObjectBounds(object)).filter(Boolean);
  if (!boxes.length) return null;
  const left = Math.min(...boxes.map(box => box.x));
  const top = Math.min(...boxes.map(box => box.y));
  const right = Math.max(...boxes.map(box => box.x + box.width));
  const bottom = Math.max(...boxes.map(box => box.y + box.height));
  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top)
  };
}

function annotationObjectBounds(object) {
  if (!object) return null;
  if (["arrow", "line"].includes(object.type)) {
    const left = Math.min(object.x1, object.x2);
    const top = Math.min(object.y1, object.y2);
    return {
      x: left,
      y: top,
      width: Math.max(1, Math.abs(object.x2 - object.x1)),
      height: Math.max(1, Math.abs(object.y2 - object.y1))
    };
  }
  return {
    x: finiteNumber(object.x, 0),
    y: finiteNumber(object.y, 0),
    width: positiveNumber(object.width, 1),
    height: positiveNumber(object.height, 1)
  };
}

function annotationObjectVisualBounds(object, imageFrame = null) {
  if (!object) return null;
  if (object.type === "embedded-image") return annotationEmbeddedImageEffectiveClip(object);
  if (object.type === "arrow") {
    const geometry = annotationArrowGeometry(object);
    const strokeRadius = annotationArrowStrokeWidth(object) / 2;
    const shaft = {
      x: Math.min(finiteNumber(object.x1, 0), geometry.shaftEnd.x) - strokeRadius,
      y: Math.min(finiteNumber(object.y1, 0), geometry.shaftEnd.y) - strokeRadius,
      width: Math.abs(geometry.shaftEnd.x - finiteNumber(object.x1, 0)) + (strokeRadius * 2),
      height: Math.abs(geometry.shaftEnd.y - finiteNumber(object.y1, 0)) + (strokeRadius * 2)
    };
    const headX = geometry.headPoints.map(point => point.x);
    const headY = geometry.headPoints.map(point => point.y);
    const head = {
      x: Math.min(...headX),
      y: Math.min(...headY),
      width: Math.max(...headX) - Math.min(...headX),
      height: Math.max(...headY) - Math.min(...headY)
    };
    return unionAnnotationBounds([shaft, head]);
  }
  if (object.type === "line") {
    const strokeRadius = annotationArrowStrokeWidth(object) / 2;
    return {
      x: Math.min(finiteNumber(object.x1, 0), finiteNumber(object.x2, 0)) - strokeRadius,
      y: Math.min(finiteNumber(object.y1, 0), finiteNumber(object.y2, 0)) - strokeRadius,
      width: Math.abs(finiteNumber(object.x2, 0) - finiteNumber(object.x1, 0)) + (strokeRadius * 2),
      height: Math.abs(finiteNumber(object.y2, 0) - finiteNumber(object.y1, 0)) + (strokeRadius * 2)
    };
  }
  const strokeRadius = ["rectangle", "circle", "textbox", "entity"].includes(object.type) && object.outlineVisible !== false
    ? clampNumber(positiveNumber(object.strokeWidth, defaultStyles.strokeWidth), 1, 40) / 2
    : 0;
  return {
    x: finiteNumber(object.x, 0) - strokeRadius,
    y: finiteNumber(object.y, 0) - strokeRadius,
    width: positiveNumber(object.width, 1) + (strokeRadius * 2),
    height: positiveNumber(object.height, 1) + (strokeRadius * 2)
  };
}

function annotationBoundsIntersect(first, second) {
  return first.x <= second.x + second.width
    && first.x + first.width >= second.x
    && first.y <= second.y + second.height
    && first.y + first.height >= second.y;
}

function annotationArrowIntersectsRect(object, rect) {
  const geometry = object.type === "line"
    ? { shaftEnd: { x: finiteNumber(object.x2, 0), y: finiteNumber(object.y2, 0) }, headPoints: [] }
    : annotationArrowGeometry(object);
  const strokeRadius = annotationArrowStrokeWidth(object) / 2;
  if (annotationLineDistanceToBounds(
    { x: finiteNumber(object.x1, 0), y: finiteNumber(object.y1, 0) },
    geometry.shaftEnd,
    rect
  ) <= strokeRadius) return true;
  return geometry.headPoints.length > 0 && annotationPolygonIntersectsBounds(geometry.headPoints, rect);
}

function annotationLineDistanceToBounds(start, end, bounds) {
  if (annotationLineIntersectsBounds(start, end, bounds)) return 0;
  const corners = annotationBoundsCorners(bounds);
  return Math.min(
    annotationPointDistanceToBounds(start, bounds),
    annotationPointDistanceToBounds(end, bounds),
    ...corners.map(point => annotationPointDistanceToLine(point, start, end))
  );
}

function annotationPointDistanceToBounds(point, bounds) {
  const deltaX = Math.max(bounds.x - point.x, 0, point.x - (bounds.x + bounds.width));
  const deltaY = Math.max(bounds.y - point.y, 0, point.y - (bounds.y + bounds.height));
  return Math.hypot(deltaX, deltaY);
}

function annotationPointDistanceToLine(point, start, end) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const lengthSquared = (deltaX * deltaX) + (deltaY * deltaY);
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const position = clampNumber(
    (((point.x - start.x) * deltaX) + ((point.y - start.y) * deltaY)) / lengthSquared,
    0,
    1
  );
  return Math.hypot(
    point.x - (start.x + (deltaX * position)),
    point.y - (start.y + (deltaY * position))
  );
}

function annotationLineIntersectsBounds(start, end, bounds) {
  if (annotationPointInBounds(start, bounds) || annotationPointInBounds(end, bounds)) return true;
  const corners = annotationBoundsCorners(bounds);
  return corners.some((corner, index) => annotationLineSegmentsIntersect(
    start,
    end,
    corner,
    corners[(index + 1) % corners.length]
  ));
}

function annotationPolygonIntersectsBounds(points, bounds) {
  if (points.some(point => annotationPointInBounds(point, bounds))) return true;
  const corners = annotationBoundsCorners(bounds);
  const area = Math.abs(annotationCrossProduct(points[0], points[1], points[2]));
  if (area > 0.000001 && corners.some(point => annotationPointInTriangle(point, points))) return true;
  return points.some((point, index) => annotationLineIntersectsBounds(
    point,
    points[(index + 1) % points.length],
    bounds
  ));
}

function annotationBoundsCorners(bounds) {
  return [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height }
  ];
}

function annotationPointInBounds(point, bounds) {
  return point.x >= bounds.x
    && point.x <= bounds.x + bounds.width
    && point.y >= bounds.y
    && point.y <= bounds.y + bounds.height;
}

function annotationPointInTriangle(point, triangle) {
  const first = annotationCrossProduct(point, triangle[0], triangle[1]);
  const second = annotationCrossProduct(point, triangle[1], triangle[2]);
  const third = annotationCrossProduct(point, triangle[2], triangle[0]);
  const hasNegative = first < 0 || second < 0 || third < 0;
  const hasPositive = first > 0 || second > 0 || third > 0;
  return !(hasNegative && hasPositive);
}

function annotationLineSegmentsIntersect(firstStart, firstEnd, secondStart, secondEnd) {
  const firstDirection = annotationCrossProduct(firstStart, firstEnd, secondStart);
  const secondDirection = annotationCrossProduct(firstStart, firstEnd, secondEnd);
  const thirdDirection = annotationCrossProduct(secondStart, secondEnd, firstStart);
  const fourthDirection = annotationCrossProduct(secondStart, secondEnd, firstEnd);
  const crosses = ((firstDirection > 0 && secondDirection < 0) || (firstDirection < 0 && secondDirection > 0))
    && ((thirdDirection > 0 && fourthDirection < 0) || (thirdDirection < 0 && fourthDirection > 0));
  if (crosses) return true;
  const epsilon = 0.000001;
  if (Math.abs(firstDirection) <= epsilon && annotationPointOnSegment(secondStart, firstStart, firstEnd)) return true;
  if (Math.abs(secondDirection) <= epsilon && annotationPointOnSegment(secondEnd, firstStart, firstEnd)) return true;
  if (Math.abs(thirdDirection) <= epsilon && annotationPointOnSegment(firstStart, secondStart, secondEnd)) return true;
  return Math.abs(fourthDirection) <= epsilon && annotationPointOnSegment(firstEnd, secondStart, secondEnd);
}

function annotationPointOnSegment(point, start, end) {
  const epsilon = 0.000001;
  return point.x >= Math.min(start.x, end.x) - epsilon
    && point.x <= Math.max(start.x, end.x) + epsilon
    && point.y >= Math.min(start.y, end.y) - epsilon
    && point.y <= Math.max(start.y, end.y) + epsilon;
}

function annotationCrossProduct(origin, first, second) {
  return ((first.x - origin.x) * (second.y - origin.y))
    - ((first.y - origin.y) * (second.x - origin.x));
}

function annotationBoundsContain(outer, inner) {
  return inner.x >= outer.x
    && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function annotationBoundsEqual(first, second) {
  return Math.abs(first.x - second.x) < 0.001
    && Math.abs(first.y - second.y) < 0.001
    && Math.abs(first.width - second.width) < 0.001
    && Math.abs(first.height - second.height) < 0.001;
}

function intersectAnnotationBounds(first, second) {
  const left = Math.max(first.x, second.x);
  const top = Math.max(first.y, second.y);
  const right = Math.min(first.x + first.width, second.x + second.width);
  const bottom = Math.min(first.y + first.height, second.y + second.height);
  if (right <= left || bottom <= top) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function unionAnnotationBounds(bounds) {
  const valid = (bounds || []).filter(bound => bound && bound.width >= 0 && bound.height >= 0);
  if (!valid.length) return null;
  const left = Math.min(...valid.map(bound => bound.x));
  const top = Math.min(...valid.map(bound => bound.y));
  const right = Math.max(...valid.map(bound => bound.x + bound.width));
  const bottom = Math.max(...valid.map(bound => bound.y + bound.height));
  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top)
  };
}

export function moveAnnotationObjects(state, gesture, point, horizontalOnly = false, verticalOnly = false) {
  const rawDeltaX = verticalOnly ? 0 : point.x - gesture.startPoint.x;
  const rawDeltaY = horizontalOnly ? 0 : point.y - gesture.startPoint.y;
  const desiredX = verticalOnly
    ? gesture.startBounds.x
    : snapAnnotationValue(gesture.startBounds.x + rawDeltaX, state.snapToGrid, state.gridSize);
  const desiredY = horizontalOnly
    ? gesture.startBounds.y
    : snapAnnotationValue(gesture.startBounds.y + rawDeltaY, state.snapToGrid, state.gridSize);
  const deltaX = desiredX - gesture.startBounds.x;
  const deltaY = desiredY - gesture.startBounds.y;
  const movingIds = new Set(gesture.originals.map(original => original.id));
  gesture.originals.forEach(original => {
    const object = state.objects.find(item => item.id === original.id);
    if (!object) return;
    if (["arrow", "line"].includes(object.type)) {
      object.x1 = original.x1 + deltaX;
      object.y1 = original.y1 + deltaY;
      object.x2 = original.x2 + deltaX;
      object.y2 = original.y2 + deltaY;
    } else {
      object.x = original.x + deltaX;
      object.y = original.y + deltaY;
      if (object.type === "embedded-image" && original.imageClip) {
        object.imageClip = translatedAnnotationBounds(original.imageClip, deltaX, deltaY);
      }
    }
  });
  const linkedEntityIds = new Set(gesture.originals.flatMap(original => {
    if (original.type === "entity") return [original.id];
    const ownerId = annotationEntityAnnotationOwnerId(original);
    return ownerId ? [ownerId] : [];
  }));
  const linked = [...linkedEntityIds]
    .flatMap(entityId => {
      const entity = state.objects.find(object => object.id === entityId && object.type === "entity");
      return entity ? [entity, ...annotationEntityAnnotationChildren(state, entity)] : [];
    })
    .filter(object => !movingIds.has(object.id));
  if (!gesture.linkedOriginals) gesture.linkedOriginals = annotationGestureObjects(linked);
  gesture.linkedOriginals.forEach(original => {
    const object = state.objects.find(item => item.id === original.id);
    if (!object) return;
    if (["arrow", "line"].includes(object.type)) {
      object.x1 = original.x1 + deltaX;
      object.y1 = original.y1 + deltaY;
      object.x2 = original.x2 + deltaX;
      object.y2 = original.y2 + deltaY;
    } else {
      object.x = original.x + deltaX;
      object.y = original.y + deltaY;
    }
  });
  syncAnnotationEntityAnnotationArrows(state);
  return { x: deltaX, y: deltaY };
}

export function resizeAnnotationObjects(
  state,
  gesture,
  point,
  centerAnchored = false
) {
  const bounds = resizedAnnotationBounds(
    gesture.startBounds,
    gesture.direction,
    point,
    state,
    centerAnchored
  );
  const scaleX = bounds.width / Math.max(1, gesture.startBounds.width);
  const scaleY = bounds.height / Math.max(1, gesture.startBounds.height);
  const proportionalResize = (gesture.direction.includes("w") || gesture.direction.includes("e"))
    && (gesture.direction.includes("n") || gesture.direction.includes("s"));
  gesture.originals.forEach(original => {
    const object = state.objects.find(item => item.id === original.id);
    if (!object) return;
    if (["arrow", "line"].includes(object.type)) {
      const arrowScale = Math.min(Math.abs(scaleX), Math.abs(scaleY));
      const originalCenterX = (original.x1 + original.x2) / 2;
      const originalCenterY = (original.y1 + original.y2) / 2;
      const centerX = bounds.x + ((originalCenterX - gesture.startBounds.x) * scaleX);
      const centerY = bounds.y + ((originalCenterY - gesture.startBounds.y) * scaleY);
      const halfDeltaX = ((original.x2 - original.x1) * arrowScale) / 2;
      const halfDeltaY = ((original.y2 - original.y1) * arrowScale) / 2;
      object.x1 = centerX - halfDeltaX;
      object.y1 = centerY - halfDeltaY;
      object.x2 = centerX + halfDeltaX;
      object.y2 = centerY + halfDeltaY;
      if (object.type === "arrow") Object.assign(object, scaleGroupedAnnotationArrowStyle(original, arrowScale));
      else object.strokeWidth = clampNumber(
        annotationArrowStrokeWidth(original) * arrowScale,
        minimumScaledStrokeWidth,
        maximumScaledStrokeWidth
      );
      return;
    }

    object.x = bounds.x + ((original.x - gesture.startBounds.x) * scaleX);
    object.y = bounds.y + ((original.y - gesture.startBounds.y) * scaleY);
    object.width = Math.max(1, original.width * scaleX);
    object.height = Math.max(1, original.height * scaleY);
    if (object.type === "embedded-image" && original.imageClip) {
      object.imageClip = scaledAnnotationBounds(
        original.imageClip,
        gesture.startBounds,
        bounds,
        scaleX,
        scaleY
      );
    }
    if (["textbox", "entity"].includes(object.type)) {
      object.fontSize = proportionalResize
        ? clampNumber(original.fontSize * Math.max(0.1, Math.min(scaleX, scaleY)), 6, 240)
        : original.fontSize;
    }
    if (object.type === "entity") {
      object.expandedHeight = object.collapsed === true
        ? Math.max(1, positiveNumber(original.expandedHeight, original.height) * scaleY)
        : object.height;
      object.dataTypeExpandedWidth = object.showDataTypes === true
        ? object.width
        : object.width + annotationEntityDataTypeColumnsWidth(object);
    }
  });
  syncAnnotationEntityAnnotationArrows(state);
}

export function resizedAnnotationBounds(
  start,
  direction,
  point,
  state,
  centerAnchored = false
) {
  const snap = value => snapAnnotationValue(value, state.snapToGrid, state.gridSize);
  const width = positiveNumber(start?.width, 1);
  const height = positiveNumber(start?.height, 1);
  const left = finiteNumber(start?.x, 0);
  const top = finiteNumber(start?.y, 0);
  const right = left + width;
  const bottom = top + height;
  const centerX = left + (width / 2);
  const centerY = top + (height / 2);
  const snappedX = snap(point?.x);
  const snappedY = snap(point?.y);
  const horizontal = direction.includes("w") || direction.includes("e");
  const vertical = direction.includes("n") || direction.includes("s");
  if (!horizontal && !vertical) return { x: left, y: top, width, height };

  const requestedWidth = direction.includes("w")
    ? (centerAnchored ? (centerX - snappedX) * 2 : right - snappedX)
    : direction.includes("e")
      ? (centerAnchored ? (snappedX - centerX) * 2 : snappedX - left)
      : width;
  const requestedHeight = direction.includes("n")
    ? (centerAnchored ? (centerY - snappedY) * 2 : bottom - snappedY)
    : direction.includes("s")
      ? (centerAnchored ? (snappedY - centerY) * 2 : snappedY - top)
      : height;
  if (horizontal !== vertical) {
    const nextWidth = Math.max(minimumObjectSize, Math.max(0, requestedWidth));
    const nextHeight = Math.max(minimumObjectSize, Math.max(0, requestedHeight));
    if (centerAnchored) {
      return {
        x: centerX - (nextWidth / 2),
        y: centerY - (nextHeight / 2),
        width: nextWidth,
        height: nextHeight
      };
    }
    return {
      x: direction.includes("w") ? right - nextWidth : direction.includes("e") ? left : centerX - (nextWidth / 2),
      y: direction.includes("n") ? bottom - nextHeight : direction.includes("s") ? top : centerY - (nextHeight / 2),
      width: nextWidth,
      height: nextHeight
    };
  }
  const scaleX = Math.max(0, requestedWidth) / width;
  const scaleY = Math.max(0, requestedHeight) / height;
  let scale = horizontal && vertical
    ? (Math.abs(scaleX - 1) >= Math.abs(scaleY - 1) ? scaleX : scaleY)
    : horizontal
      ? scaleX
      : scaleY;
  const minimumScale = Math.max(minimumObjectSize / width, minimumObjectSize / height);
  scale = Math.max(minimumScale, scale);
  const nextWidth = width * scale;
  const nextHeight = height * scale;

  if (centerAnchored) {
    return {
      x: centerX - (nextWidth / 2),
      y: centerY - (nextHeight / 2),
      width: nextWidth,
      height: nextHeight
    };
  }
  return {
    x: direction.includes("w") ? right - nextWidth : direction.includes("e") ? left : centerX - (nextWidth / 2),
    y: direction.includes("n") ? bottom - nextHeight : direction.includes("s") ? top : centerY - (nextHeight / 2),
    width: nextWidth,
    height: nextHeight
  };
}

function updateCreatedObject(object, start, current) {
  if (["arrow", "line"].includes(object.type)) {
    object.x2 = current.x;
    object.y2 = current.y;
    return;
  }
  const rect = normalizedRect(start, current);
  object.x = rect.x;
  object.y = rect.y;
  object.width = rect.width;
  object.height = rect.height;
}

function ensureCreatedObjectSize(object, state) {
  if (!object) return;
  if (["arrow", "line"].includes(object.type)) {
    const length = Math.hypot(object.x2 - object.x1, object.y2 - object.y1);
    const minimumLength = object.type === "line" ? minimumObjectSize : annotationMinimumArrowLength(object);
    if (length < minimumLength) {
      const directionX = length ? (object.x2 - object.x1) / length : 1;
      const directionY = length ? (object.y2 - object.y1) / length : 0;
      object.x2 = object.x1 + (directionX * minimumLength);
      object.y2 = object.y1 + (directionY * minimumLength);
    }
    return;
  }
  if (object.width < minimumObjectSize) object.width = state.gridSize * 8;
  if (object.height < minimumObjectSize) object.height = state.gridSize * 4;
  if (object.type === "entity") ensureAnnotationEntitySize(object);
}

function applyAnnotationCrop(state, crop, imageOrId = null) {
  const image = annotationCropImage(state, imageOrId);
  if (!image || image.type !== "embedded-image") return false;
  const rect = intersectAnnotationBounds(annotationObjectBounds(image), crop);
  if (!rect || rect.width < minimumObjectSize || rect.height < minimumObjectSize) return false;
  image.imageClip = rect;
  image.cropVisible = true;
  return true;
}

function resetAnnotationCrop(state, imageOrId = null) {
  const image = annotationCropImage(state, imageOrId);
  if (!image || image.type !== "embedded-image") return false;
  const fullImage = annotationObjectBounds(image);
  if (annotationBoundsEqual(image.imageClip, fullImage)) return false;
  image.imageClip = fullImage;
  image.cropVisible = true;
  return true;
}

export async function permanentlyCropAnnotationImage(state, imageOrId = null) {
  const imageObject = annotationCropImage(state, imageOrId);
  if (!imageObject || imageObject.type !== "embedded-image"
    || !annotationImageHasReversibleCrop(state, imageObject)) {
    throw new Error("Apply a crop before making it permanent.");
  }

  const fullBounds = annotationObjectBounds(imageObject);
  const visibleBounds = intersectAnnotationBounds(fullBounds, imageObject.imageClip);
  const decoded = await decodeAnnotationImage(imageObject.source);
  const scaleX = decoded.naturalWidth / Math.max(1, fullBounds.width);
  const scaleY = decoded.naturalHeight / Math.max(1, fullBounds.height);
  const sourceX = clampNumber((visibleBounds.x - fullBounds.x) * scaleX, 0, Math.max(0, decoded.naturalWidth - 1));
  const sourceY = clampNumber((visibleBounds.y - fullBounds.y) * scaleY, 0, Math.max(0, decoded.naturalHeight - 1));
  const sourceWidth = clampNumber(visibleBounds.width * scaleX, 1, decoded.naturalWidth - sourceX);
  const sourceHeight = clampNumber(visibleBounds.height * scaleY, 1, decoded.naturalHeight - sourceY);
  const outputWidth = Math.max(1, Math.round(sourceWidth));
  const outputHeight = Math.max(1, Math.round(sourceHeight));
  const raster = document.createElement("canvas");
  raster.width = outputWidth;
  raster.height = outputHeight;
  const drawing = raster.getContext("2d");
  if (!drawing) throw new Error("The cropped image could not be rendered.");
  drawing.drawImage(
    decoded,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    outputWidth,
    outputHeight
  );
  const blob = await new Promise((resolve, reject) => {
    raster.toBlob(result => {
      if (result) resolve(result);
      else reject(new Error("The cropped image could not be saved."));
    }, "image/png");
  });
  const dataUrl = await blobToDataUrl(blob);
  imageObject.x = visibleBounds.x;
  imageObject.y = visibleBounds.y;
  imageObject.width = visibleBounds.width;
  imageObject.height = visibleBounds.height;
  imageObject.source = dataUrl;
  imageObject.imageClip = annotationObjectBounds(imageObject);
  imageObject.cropVisible = true;
  imageObject.cropPermanent = true;
  return { blob, dataUrl, width: outputWidth, height: outputHeight };
}

function decodeAnnotationImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(new Error("The cropped image could not be decoded.")), { once: true });
    image.src = source;
  });
}

function translatedAnnotationBounds(bounds, deltaX, deltaY) {
  return {
    x: bounds.x + deltaX,
    y: bounds.y + deltaY,
    width: bounds.width,
    height: bounds.height
  };
}

function scaledAnnotationBounds(bounds, startBounds, resizedBounds, scaleX, scaleY) {
  return {
    x: resizedBounds.x + ((bounds.x - startBounds.x) * scaleX),
    y: resizedBounds.y + ((bounds.y - startBounds.y) * scaleY),
    width: Math.max(1, bounds.width * scaleX),
    height: Math.max(1, bounds.height * scaleY)
  };
}

function translateAllAnnotationObjects(objects, deltaX, deltaY) {
  objects.forEach(object => {
    if (["arrow", "line"].includes(object.type)) {
      object.x1 += deltaX;
      object.y1 += deltaY;
      object.x2 += deltaX;
      object.y2 += deltaY;
    } else {
      object.x += deltaX;
      object.y += deltaY;
      if (object.type === "embedded-image" && object.imageClip) {
        object.imageClip = translatedAnnotationBounds(object.imageClip, deltaX, deltaY);
      }
    }
  });
  return { x: deltaX, y: deltaY };
}

function handleAnnotationAction(action, context) {
  if (action === "undo") {
    context.pushHistory();
    context.restoreHistory(context.historyIndex() - 1);
    return;
  }
  if (action === "redo") {
    context.pushHistory();
    context.restoreHistory(context.historyIndex() + 1);
    return;
  }
  if (action === "reset-crop") {
    const image = context.selectedObjects().length === 1
      && context.selectedObjects()[0]?.type === "embedded-image"
      ? context.selectedObjects()[0]
      : null;
    if (image && resetAnnotationCrop(context.state, image)) {
      context.pushHistory();
      context.setStatus("Full source restored.");
    } else {
      context.setStatus("The full source is already visible.");
    }
    return;
  }

  const selection = context.selectedObjects();
  if (!selection.length) return;
  if (selection.some(object => isAnnotationEntityRelationshipSelectionType(object.type))
    && ["delete", "lock", "group", "ungroup", "front", "forward", "backward", "back"].includes(action)) {
    context.setStatus("Entity relationships are fixed connectors. Use the Format tab to change their appearance.");
    return;
  }
  if (action === "delete") {
    const deletedIds = new Set(selection
      .filter(object => !isAnnotationEntityRelationshipSelectionType(object.type)
        && !object.locked)
      .map(object => object.id));
    const removalIds = annotationRemovalIdsWithEntityCallouts(context.state, deletedIds);
    context.state.objects = context.state.objects.filter(object => !removalIds.has(object.id));
    removalIds.forEach(id => context.selectedIds.delete(id));
    context.setStatus(removalIds.size ? "Selected annotations deleted." : "Unlock annotations before deleting them.");
    if (removalIds.size) {
      pruneAnnotationGroupMetadata(context.state);
      context.pushHistory();
    }
    return;
  }
  if (action === "lock") {
    const shouldLock = !selection.every(object => object.locked);
    selection.forEach(object => { object.locked = shouldLock; });
    context.setStatus(shouldLock ? "Selection locked." : "Selection unlocked.");
    context.pushHistory();
    return;
  }
  if (["group", "ungroup", "front", "forward", "backward", "back"].includes(action)
    && selection.some(object => object.locked)) {
    context.setStatus("Unlock the selection before grouping or arranging it.");
    return;
  }
  if (action === "group") {
    if (selection.length < 2) return;
    const groupId = context.nextGroupId();
    selection.forEach(object => { object.groupId = groupId; });
    compactAnnotationGroupLayers(context.state.objects);
    pruneAnnotationGroupMetadata(context.state);
    context.setStatus("Selection grouped.");
    context.pushHistory();
    return;
  }
  if (action === "ungroup") {
    const groupIds = new Set(selection.map(object => object.groupId).filter(Boolean));
    if (!groupIds.size) return;
    context.state.objects.forEach(object => {
      if (groupIds.has(object.groupId)) object.groupId = "";
    });
    pruneAnnotationGroupMetadata(context.state);
    context.setStatus("Selection ungrouped.");
    context.pushHistory();
    return;
  }
  if (["front", "forward", "backward", "back"].includes(action)) {
    moveAnnotationLayers(context.state.objects, context.selectedIds, action);
    compactAnnotationGroupLayers(context.state.objects);
    context.pushHistory();
  }
}

export function moveAnnotationLayers(objects, selectedIds, action) {
  const selected = id => selectedIds instanceof Set ? selectedIds.has(id) : selectedIds.includes(id);
  const layers = objects;
  if (action === "front" || action === "back") {
    const moving = layers.filter(object => selected(object.id));
    const remaining = layers.filter(object => !selected(object.id));
    objects.splice(0, objects.length, ...(action === "front" ? [...remaining, ...moving] : [...moving, ...remaining]));
    return objects;
  }
  if (action === "forward") {
    for (let index = layers.length - 2; index >= 0; index -= 1) {
      if (selected(layers[index].id) && !selected(layers[index + 1].id)) {
        [layers[index], layers[index + 1]] = [layers[index + 1], layers[index]];
      }
    }
    objects.splice(0, objects.length, ...layers);
    return objects;
  }
  if (action === "backward") {
    for (let index = 1; index < layers.length; index += 1) {
      if (selected(layers[index].id) && !selected(layers[index - 1].id)) {
        [layers[index], layers[index - 1]] = [layers[index - 1], layers[index]];
      }
    }
    objects.splice(0, objects.length, ...layers);
  }
  return objects;
}

function handleAnnotationKeyDown(event, context) {
  if (event.defaultPrevented) return;
  const control = event.target.closest?.("input, textarea, select, button");
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === "z") {
    event.preventDefault();
    context.pushHistory();
    context.restoreHistory(context.historyIndex() + (event.shiftKey ? 1 : -1));
    return;
  }
  if ((event.ctrlKey || event.metaKey) && key === "y") {
    event.preventDefault();
    context.pushHistory();
    context.restoreHistory(context.historyIndex() + 1);
    return;
  }
  if (!control && (event.ctrlKey || event.metaKey) && key === "c") {
    event.preventDefault();
    context.copySelection?.();
    return;
  }
  if (!control && (event.ctrlKey || event.metaKey) && key === "d") {
    event.preventDefault();
    context.duplicateSelection?.();
    return;
  }
  if (key === "escape" && context.selectedIds.size) {
    event.preventDefault();
    event.stopPropagation();
    context.selectedIds.clear();
    context.setStatus("Selection cleared.");
    context.render();
    context.focusWorkspace?.();
    return;
  }
  if (control) return;
  if ((event.ctrlKey || event.metaKey) && key === "a") {
    event.preventDefault();
    context.selectedIds.clear();
    context.state.objects.forEach(object => context.selectedIds.add(object.id));
    context.setStatus(`${context.selectedIds.size} object${context.selectedIds.size === 1 ? "" : "s"} selected.`);
    context.render();
    context.focusSelection?.();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && key === "g") {
    event.preventDefault();
    const action = event.shiftKey ? "ungroup" : "group";
    const selected = context.selectedObjects();
    if (selected.some(object => object.locked)) {
      context.setStatus("Unlock the selection before grouping it.");
      return;
    }
    if (action === "group" && selected.length >= 2) {
      const groupId = `group-${Date.now().toString(36)}`;
      selected.forEach(object => { object.groupId = groupId; });
      context.pushHistory();
      context.render();
      context.focusSelection?.();
    } else if (action === "ungroup") {
      const groupIds = new Set(selected.map(object => object.groupId).filter(Boolean));
      context.state.objects.forEach(object => {
        if (groupIds.has(object.groupId)) object.groupId = "";
      });
      context.pushHistory();
      context.render();
      context.focusSelection?.();
    }
    return;
  }
  if (["delete", "backspace"].includes(key)) {
    event.preventDefault();
    const removable = new Set(context.selectedObjects()
      .filter(object => !isAnnotationEntityRelationshipSelectionType(object.type)
        && !object.locked)
      .map(object => object.id));
    if (!removable.size && [...context.selectedIds].some(id => id === entityRelationshipsSelectionId
      || isAnnotationEntityRelationshipSelectionId(id))) {
      context.setStatus("Entity relationships are fixed connectors and cannot be deleted.");
      return;
    }
    const removalIds = annotationRemovalIdsWithEntityCallouts(context.state, removable);
    context.state.objects = context.state.objects.filter(object => !removalIds.has(object.id));
    removalIds.forEach(id => context.selectedIds.delete(id));
    if (removalIds.size) {
      context.pushHistory();
      context.setStatus(`${removalIds.size} object${removalIds.size === 1 ? "" : "s"} deleted.`);
    }
    context.render();
    if (context.selectedIds.size) context.focusSelection?.();
    else context.focusWorkspace?.();
    return;
  }
  if (["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) {
    const selection = context.selectedObjects()
      .filter(object => !object.locked && !isAnnotationEntityRelationshipSelectionType(object.type));
    if (!selection.length || selection.length !== context.selectedIds.size) return;
    event.preventDefault();
    const distance = context.state.gridVisible ? context.state.gridSize : 1;
    const deltaX = key === "arrowleft" ? -distance : key === "arrowright" ? distance : 0;
    const deltaY = key === "arrowup" ? -distance : key === "arrowdown" ? distance : 0;
    translateAnnotationObjectsWithEntityCallouts(context.state, selection, deltaX, deltaY);
    context.pushHistory();
    context.render();
    context.focusSelection?.();
    return;
  }
  const shortcutTool = { v: "select", c: "crop", r: "rectangle", o: "circle", a: "arrow", l: "line", t: "textbox", e: "entity" }[key];
  if (shortcutTool && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    if (["rectangle", "circle", "arrow", "line", "textbox", "entity"].includes(shortcutTool)) {
      if (!event.repeat) void context.insertObject?.(shortcutTool);
    } else if (shortcutTool === "crop") {
      if (!event.repeat) void context.activateCropTool?.();
    } else {
      context.setTool(shortcutTool);
    }
  }
}

function bindAnnotationColorPickers(root, options) {
  const tools = [...root.querySelectorAll("[data-annotation-color-picker]")];
  const closeAll = except => tools.forEach(tool => {
    if (tool !== except) closeAnnotationColorPicker(tool);
  });
  const renderMemory = () => renderAnnotationColorMemory(root);

  tools.forEach(tool => {
    const name = tool.dataset.annotationColorPicker;
    const trigger = tool.querySelector("[data-annotation-color-trigger]");
    const palette = tool.querySelector("[data-rich-color-palette]");
    const recentColors = tool.closest(".image-annotation-color-controls")?.querySelector("[data-annotation-recent-colors]");
    if (!name || !trigger || !palette) return;
    const defaultColor = normalizePickerColor(trigger.dataset.richColorDefault) || "#111827";
    const memoryKey = annotationColorMemoryKey(name);
    const apply = color => {
      const normalized = normalizePickerColor(color) || defaultColor;
      tool.style.setProperty("--rich-selected-color", normalized);
      trigger.dataset.richSelectedColor = normalized;
      rememberAnnotationColor(memoryKey, normalized);
      renderMemory();
      closeAnnotationColorPicker(tool);
      options.apply(name, normalized);
      return normalized;
    };

    trigger.dataset.richSelectedColor = readAnnotationLastColor(memoryKey, defaultColor);
    tool.style.setProperty("--rich-selected-color", trigger.dataset.richSelectedColor);
    trigger.addEventListener("click", event => {
      event.preventDefault();
      const rect = trigger.getBoundingClientRect();
      if (event.clientX && event.clientX <= rect.left + (rect.width / 2)) {
        apply(trigger.dataset.richSelectedColor || defaultColor);
        return;
      }
      const shouldOpen = !tool.classList.contains("is-open");
      closeAll();
      if (shouldOpen) openAnnotationColorPicker(tool);
    });
    palette.addEventListener("click", async event => {
      const colorButton = event.target.closest("[data-rich-color-value]");
      if (colorButton && palette.contains(colorButton)) {
        event.preventDefault();
        apply(colorButton.dataset.richColorValue || defaultColor);
        trigger.focus({ preventScroll: true });
        return;
      }
      if (!event.target.closest("[data-rich-color-custom]")) return;
      event.preventDefault();
      closeAnnotationColorPicker(tool);
      const current = trigger.dataset.richSelectedColor || defaultColor;
      const custom = typeof options.askForColor === "function"
        ? await options.askForColor(current)
        : await chooseNativeAnnotationColor(current);
      if (!custom) return;
      const normalized = normalizePickerColor(custom);
      if (!normalized) {
        options.setStatus("Enter a valid HEX or RGB color.");
        return;
      }
      rememberAnnotationCustomColor(normalized);
      apply(normalized);
      trigger.focus({ preventScroll: true });
    });
    recentColors?.addEventListener("click", event => {
      const colorButton = event.target.closest("[data-rich-color-value]");
      if (!colorButton || !recentColors.contains(colorButton)) return;
      event.preventDefault();
      const normalized = apply(colorButton.dataset.richColorValue || defaultColor);
      [...recentColors.querySelectorAll("[data-rich-color-value]")]
        .find(button => button.dataset.richColorValue === normalized)
        ?.focus({ preventScroll: true });
    });
  });

  renderMemory();
  root.addEventListener("pointerdown", event => {
    if (!event.target.closest("[data-annotation-color-picker]")) closeAll();
  });
  root.addEventListener("keydown", event => {
    if (event.key === "Escape" && root.querySelector("[data-annotation-color-picker].is-open")) {
      event.preventDefault();
      event.stopPropagation();
      closeAll();
    }
  });
}

function openAnnotationColorPicker(tool) {
  const palette = tool.querySelector("[data-rich-color-palette]");
  const trigger = tool.querySelector("[data-annotation-color-trigger]");
  if (!palette || !trigger) return;
  tool.classList.add("is-open");
  palette.hidden = false;
  trigger.setAttribute("aria-expanded", "true");
  const triggerRect = trigger.getBoundingClientRect();
  const paletteRect = palette.getBoundingClientRect();
  const padding = 8;
  const gap = 4;
  const left = clampNumber(triggerRect.left, padding, Math.max(padding, window.innerWidth - paletteRect.width - padding));
  const below = triggerRect.bottom + gap;
  const above = triggerRect.top - paletteRect.height - gap;
  const top = below + paletteRect.height <= window.innerHeight - padding ? below : Math.max(padding, above);
  palette.style.setProperty("--rich-palette-left", `${Math.round(left)}px`);
  palette.style.setProperty("--rich-palette-top", `${Math.round(top)}px`);
}

function closeAnnotationColorPicker(tool) {
  const palette = tool.querySelector("[data-rich-color-palette]");
  tool.classList.remove("is-open");
  if (palette) {
    palette.hidden = true;
    palette.style.removeProperty("--rich-palette-left");
    palette.style.removeProperty("--rich-palette-top");
  }
  tool.querySelector("[data-annotation-color-trigger]")?.setAttribute("aria-expanded", "false");
}

function renderAnnotationColorMemory(root) {
  const lastColors = readAnnotationColorList("pmt-rich-last-colors");
  const recentColors = lastColors.slice(0, 6);
  const customColors = readAnnotationColorList("pmt-rich-custom-colors");
  root.querySelectorAll("[data-annotation-recent-colors]").forEach(container => {
    const title = container.closest(".image-annotation-color-controls")
      ?.querySelector("[data-annotation-color-trigger]")
      ?.getAttribute("aria-label") || "Color";
    container.hidden = recentColors.length === 0;
    container.innerHTML = recentColors.map(color => annotationColorSwatch(color, title)).join("");
  });
  root.querySelectorAll("[data-rich-last-colors]").forEach(container => {
    container.hidden = lastColors.length === 0;
    const title = container.closest("[data-rich-color-palette]")?.previousElementSibling?.getAttribute("aria-label") || "Color";
    const section = container.closest("[data-rich-color-palette]")?.querySelector("[data-rich-last-colors-title]");
    if (section) section.hidden = lastColors.length === 0;
    container.innerHTML = lastColors.map(color => annotationColorSwatch(color, title)).join("");
  });
  root.querySelectorAll("[data-rich-custom-colors]").forEach(container => {
    container.hidden = customColors.length === 0;
    const title = container.closest("[data-rich-color-palette]")?.previousElementSibling?.getAttribute("aria-label") || "Color";
    container.innerHTML = customColors.map(color => annotationColorSwatch(color, title)).join("");
  });
}

function annotationColorSwatch(color, title) {
  const label = `${title} ${color} ${annotationRgbText(color)}`;
  return `<button type="button" class="rich-color-swatch" data-rich-color-value="${color}" title="${label}" aria-label="${label}" style="--rich-swatch-color: ${color}"></button>`;
}

function annotationColorMemoryKey(name) {
  return name === "textColor" ? "foreColor" : name === "fill" ? "hiliteColor" : "annotationStroke";
}

function readAnnotationLastColor(key, fallback) {
  try {
    return normalizePickerColor(localStorage.getItem(`pmt-rich-last-color-${key}`)) || fallback;
  } catch {
    return fallback;
  }
}

function rememberAnnotationColor(key, color) {
  const colors = [color, ...readAnnotationColorList("pmt-rich-last-colors").filter(item => item !== color)].slice(0, 10);
  try {
    localStorage.setItem("pmt-rich-last-colors", JSON.stringify(colors));
    localStorage.setItem(`pmt-rich-last-color-${key}`, color);
  } catch {
    // Color memory is optional when browser storage is unavailable.
  }
}

function rememberAnnotationCustomColor(color) {
  const colors = [color, ...readAnnotationColorList("pmt-rich-custom-colors").filter(item => item !== color)].slice(0, 10);
  try {
    localStorage.setItem("pmt-rich-custom-colors", JSON.stringify(colors));
  } catch {
    // Color memory is optional when browser storage is unavailable.
  }
}

function readAnnotationColorList(key) {
  try {
    const values = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(values)
      ? [...new Set(values.map(normalizePickerColor).filter(Boolean))].slice(0, 10)
      : [];
  } catch {
    return [];
  }
}

function normalizePickerColor(value) {
  const text = String(value || "").trim();
  const hex = text.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const digits = hex[1].length === 3 ? hex[1].split("").map(part => part + part).join("") : hex[1];
    return `#${digits.toUpperCase()}`;
  }
  const rgb = text.match(/^(?:rgb\s*\()?\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*\)?$/i);
  if (!rgb) return "";
  const channels = rgb.slice(1).map(Number);
  if (channels.some(channel => channel < 0 || channel > 255)) return "";
  return `#${channels.map(channel => channel.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function annotationRgbText(color) {
  const normalized = normalizePickerColor(color);
  if (!normalized) return "";
  return `rgb(${Number.parseInt(normalized.slice(1, 3), 16)}, ${Number.parseInt(normalized.slice(3, 5), 16)}, ${Number.parseInt(normalized.slice(5, 7), 16)})`;
}

function chooseNativeAnnotationColor(current) {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "color";
    input.value = normalizePickerColor(current) || "#126BFF";
    input.hidden = true;
    document.body.appendChild(input);
    const finish = value => {
      input.remove();
      resolve(value);
    };
    input.addEventListener("change", () => finish(input.value), { once: true });
    input.addEventListener("cancel", () => finish(""), { once: true });
    input.click();
  });
}

function applyAnnotationStyle(name, rawValue, selection, styles, state = null) {
  if (!Object.hasOwn(styles, name)) return;
  let value = rawValue;
  if (["fontSize", "strokeWidth", "arrowSize"].includes(name)) {
    const limits = name === "fontSize" ? [6, 240] : name === "strokeWidth" ? [1, 40] : [6, 160];
    value = clampNumber(positiveNumber(rawValue, styles[name]), limits[0], limits[1]);
  } else if (name === "opacity") {
    const percentage = String(rawValue ?? "").trim()
      ? finiteNumber(rawValue, styles.opacity * 100)
      : styles.opacity * 100;
    value = clampNumber(percentage, 0, 100) / 100;
  } else if (name === "textAlign") {
    value = safeTextAlign(rawValue);
  } else if (name === "textVerticalAlign") {
    value = safeTextVerticalAlign(rawValue);
  }
  styles[name] = value;
  if (selection.some(object => object.type === entityRelationshipsObjectType)
    && ["stroke", "strokeWidth", "arrowSize"].includes(name)) {
    applyAnnotationEntityRelationshipGroupStyle(state, { [name]: value });
  }
  selection.filter(object => !object.locked).forEach(object => {
    if (object.type === entityRelationshipsObjectType) return;
    if (name === "fill" && ["rectangle", "circle", "textbox", "entity"].includes(object.type)) object.fill = value;
    else if (name === "stroke" && ["rectangle", "circle", "textbox", "arrow", "line", "entity", entityRelationshipObjectType].includes(object.type)) object.stroke = value;
    else if (name === "strokeWidth" && ["rectangle", "circle", "textbox", "arrow", "line", "entity", entityRelationshipObjectType].includes(object.type)) object.strokeWidth = value;
    else if (name === "arrowSize" && ["arrow", entityRelationshipObjectType].includes(object.type)) object.arrowSize = value;
    else if (name === "opacity" && ["rectangle", "circle", "textbox", "arrow", "line", "entity"].includes(object.type)) object.opacity = value;
    else if (["textColor", "fontFamily", "fontSize"].includes(name) && ["textbox", "entity"].includes(object.type)) object[name] = value;
    else if (name === "entityNameTextColor" && object.type === "entity") object.entityNameTextColor = value;
    else if (name === "entityHeaderFill" && object.type === "entity") object.entityHeaderFill = value;
    else if (["textAlign", "textVerticalAlign"].includes(name) && object.type === "textbox") object[name] = value;
    if (object.type === "arrow" && ["strokeWidth", "arrowSize"].includes(name)) {
      Object.assign(object, fitAnnotationArrowToHead(object));
    }
    if (object.type === "entity" && name === "fontSize") ensureAnnotationEntitySize(object);
  });
}

function normalizeAnnotationTemplate(input) {
  if (!input || typeof input !== "object") return null;
  const objects = Array.isArray(input.objects)
    ? input.objects
        .map(normalizeAnnotationObject)
        .filter(Boolean)
        .map(object => ({
          ...object,
          locked: false,
          groupId: "",
          ...(object.type === "embedded-image" ? { isOriginalImage: false } : {})
        }))
    : [];
  const relationshipStyle = input.relationshipStyle && typeof input.relationshipStyle === "object"
    ? normalizeAnnotationEntityRelationshipStyle(input.relationshipStyle)
    : null;
  if (!objects.length && !relationshipStyle) return null;
  const bounds = unionAnnotationBounds(objects.map(object => annotationObjectVisualBounds(object)).filter(Boolean));
  const name = String(input.name || "Template").trim().slice(0, 120) || "Template";
  return {
    id: safeObjectId(input.id, "template"),
    name,
    grouped: input.grouped === true,
    groupName: safeAnnotationName(input.groupName),
    groupVisible: input.groupVisible !== false,
    width: positiveNumber(input.width, bounds?.width || 240),
    height: positiveNumber(input.height, bounds?.height || 80),
    createdAt: safeAnnotationTimestamp(input.createdAt),
    updatedAt: safeAnnotationTimestamp(input.updatedAt),
    relationshipStyle,
    objects
  };
}

function annotationFactoryDrawingDefault(type) {
  if (type === "arrow") {
    return {
      stroke: defaultStyles.stroke,
      strokeWidth: defaultStyles.strokeWidth,
      arrowSize: defaultStyles.arrowSize,
      opacity: defaultStyles.opacity
    };
  }
  return {
    fill: "none",
    stroke: defaultStyles.stroke,
    outlineVisible: true,
    strokeWidth: defaultStyles.strokeWidth,
    opacity: defaultStyles.opacity
  };
}

function normalizeAnnotationDrawingDefault(type, input) {
  if (!input || typeof input !== "object") return null;
  const factory = annotationFactoryDrawingDefault(type);
  if (type === "arrow") {
    return {
      stroke: safeColor(input.stroke, factory.stroke),
      strokeWidth: clampNumber(positiveNumber(input.strokeWidth, factory.strokeWidth), 1, 40),
      arrowSize: clampNumber(positiveNumber(input.arrowSize, factory.arrowSize), 6, 160),
      opacity: safeAnnotationOpacity(input.opacity)
    };
  }
  if (type === "rectangle") {
    return {
      fill: input.fill === "none" ? "none" : safeColor(input.fill, factory.fill),
      stroke: safeColor(input.stroke, factory.stroke),
      outlineVisible: input.outlineVisible !== false,
      strokeWidth: clampNumber(positiveNumber(input.strokeWidth, factory.strokeWidth), 1, 40),
      opacity: safeAnnotationOpacity(input.opacity)
    };
  }
  return null;
}

function annotationDrawingDefaultFromObject(object) {
  return normalizeAnnotationDrawingDefault(object?.type, object);
}

function annotationSelectionVisualBounds(objects, imageFrame = null) {
  return unionAnnotationBounds((objects || [])
    .map(object => annotationObjectVisualBounds(object))
    .filter(Boolean));
}

function safeAnnotationTimestamp(value) {
  const parsed = new Date(String(value || ""));
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
}

function safeEmbeddedImageSource(value) {
  const source = String(value || "").trim();
  if (/^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,/i.test(source)) return source;
  if (/^(?:https?:)?\/\//i.test(source) || /^(?:\/|\.\/|\.\.\/)/.test(source)) return source;
  return "";
}

function annotationClipboardHasImage(clipboardData) {
  if (!clipboardData) return false;
  if ([...(clipboardData.items || [])].some(item => item.kind === "file"
      && /^image\//i.test(item.type || ""))) return true;
  if ([...(clipboardData.files || [])].some(file => /^image\//i.test(file.type || "")
      || /\.(?:png|jpe?g|gif|webp|svg)$/i.test(file.name || ""))) return true;
  if ((clipboardData.getData?.("image/svg+xml") || "").trim()) return true;
  if (annotationSvgMarkupFromClipboardText(clipboardData.getData?.("text/plain") || "")) return true;

  const html = clipboardData.getData?.("text/html") || "";
  return /<img\b[^>]*\bsrc\s*=\s*["']?data:image\//i.test(html);
}

async function annotationClipboardImageFile(clipboardData) {
  if (!clipboardData) return null;

  const files = [
    ...[...(clipboardData.items || [])]
      .filter(item => item.kind === "file" && /^image\//i.test(item.type || ""))
      .map(item => item.getAsFile()),
    ...(clipboardData.files || [])
  ].filter(file => file && (/^image\//i.test(file.type || "") || /\.(?:png|jpe?g|gif|webp|svg)$/i.test(file.name || "")));
  if (files.length) return annotationSafeClipboardImageFile(files[0]);

  const directSvg = clipboardData.getData?.("image/svg+xml") || "";
  const svgMarkup = annotationSvgMarkupFromClipboardText(directSvg)
    || annotationSvgMarkupFromClipboardText(clipboardData.getData?.("text/plain") || "");
  if (svgMarkup) {
    return annotationSafeClipboardImageFile(new File(
      [svgMarkup],
      annotationClipboardImageFileName("svg"),
      { type: "image/svg+xml" }
    ));
  }

  const html = clipboardData.getData?.("text/html") || "";
  const container = document.createElement("div");
  container.innerHTML = html;
  const dataSource = [...container.querySelectorAll("img[src]")]
    .map(image => image.getAttribute("src") || "")
    .find(source => /^data:image\//i.test(source));
  return annotationImageFileFromDataUrl(dataSource);
}

async function annotationSafeClipboardImageFile(file) {
  if (!file || !(/\.(?:svg)$/i.test(file.name || "") || /^image\/svg(?:\+xml)?$/i.test(file.type || ""))) {
    return file;
  }

  const svg = annotationSvgMarkupFromClipboardText(await file.text());
  if (!svg) throw new Error("The pasted SVG is invalid.");
  return new File([svg], file.name || annotationClipboardImageFileName("svg"), { type: "image/svg+xml" });
}

function annotationSvgMarkupFromClipboardText(value) {
  const source = String(value || "").trim();
  if (!source) return "";
  const start = source.search(/<svg(?:\s|>)/i);
  const end = source.toLowerCase().lastIndexOf("</svg>");
  if (start < 0 || end < start) return "";

  const documentNode = new DOMParser().parseFromString(
    source.slice(start, end + "</svg>".length),
    "image/svg+xml"
  );
  if (documentNode.querySelector("parsererror")) return "";
  const svg = documentNode.documentElement;
  svg.querySelectorAll("script").forEach(element => element.remove());
  svg.querySelectorAll("*").forEach(element => {
    [...element.attributes].forEach(attribute => {
      if (attribute.name.toLowerCase().startsWith("on")
          || /^\s*javascript:/i.test(attribute.value || "")) {
        element.removeAttribute(attribute.name);
      }
    });
  });
  if (!svg.getAttribute("xmlns")) svg.setAttribute("xmlns", svgNamespace);
  return new XMLSerializer().serializeToString(svg);
}

function annotationImageFileFromDataUrl(source) {
  const match = /^data:(image\/[a-z0-9.+-]+)((?:;[^,]*)?),(.*)$/is.exec(String(source || ""));
  if (!match) return null;

  const contentType = match[1].toLowerCase();
  const metadata = match[2].toLowerCase();
  const payload = match[3] || "";
  let blob;
  if (metadata.includes(";base64")) {
    const binary = atob(payload.replace(/\s+/g, ""));
    blob = new Blob([Uint8Array.from(binary, character => character.charCodeAt(0))], { type: contentType });
  } else {
    try {
      blob = new Blob([decodeURIComponent(payload)], { type: contentType });
    } catch {
      return null;
    }
  }
  const extension = contentType === "image/svg+xml"
    ? "svg"
    : contentType === "image/jpeg" ? "jpg" : contentType.split("/").pop() || "png";
  return new File([blob], annotationClipboardImageFileName(extension), { type: contentType });
}

function annotationClipboardImageFileName(extension) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `diagram-image-${stamp}.${extension}`;
}

function annotationEmbeddedSourceRegistry(objects) {
  return new Map((objects || [])
    .filter(object => object?.type === "embedded-image" && object.source)
    .map(object => [object.id, object.source]));
}

function restoreAnnotationEmbeddedSources(objects, sourceRegistry) {
  (objects || []).forEach(object => {
    if (object?.type !== "embedded-image" || object.source) return;
    object.source = sourceRegistry.get(object.id) || "";
  });
}

function annotationGestureObjects(objects) {
  return (objects || []).map(object => {
    const copy = { ...object };
    if (copy.type === "embedded-image") {
      delete copy.source;
      copy.imageClip = deepCopy(object.imageClip);
    }
    return copy;
  });
}

function annotationMoveGestureObjects(state, objects) {
  const moving = [...(objects || [])];
  const movingIds = new Set(moving.map(object => object.id));
  moving.filter(object => object.groupId && object.groupHitTransparent === true).forEach(object => {
    state.objects
      .filter(member => member.groupId === object.groupId && member.groupHitTransparent === true)
      .forEach(member => {
        if (movingIds.has(member.id)) return;
        movingIds.add(member.id);
        moving.push(member);
      });
  });
  moving.filter(object => object.type === "entity").forEach(entity => {
    annotationEntityAnnotationChildren(state, entity).forEach(child => {
      if (movingIds.has(child.id)) return;
      movingIds.add(child.id);
      moving.push(child);
    });
  });
  return annotationGestureObjects(moving);
}

function normalizeAnnotationObject(input) {
  if (!input || typeof input !== "object") return null;
  const type = String(input.type || "").toLowerCase();
  if (!["embedded-image", "rectangle", "circle", "arrow", "line", "textbox", "entity"].includes(type)) return null;
  const common = {
    id: safeObjectId(input.id, type),
    type,
    name: safeAnnotationName(input.name),
    visible: input.visible !== false,
    locked: input.locked === true,
    groupId: safeGroupId(input.groupId)
  };
  if (input.groupHitTransparent === true) common.groupHitTransparent = true;
  const entityAnnotationOwnerId = String(input.entityAnnotationOwnerId || "").trim().slice(0, 160);
  const entityAnnotationRole = ["callout", "arrow"].includes(input.entityAnnotationRole)
    ? input.entityAnnotationRole
    : "";
  if (entityAnnotationOwnerId) common.entityAnnotationOwnerId = entityAnnotationOwnerId;
  if (entityAnnotationRole) common.entityAnnotationRole = entityAnnotationRole;
  if (["arrow", "line"].includes(type)) {
    const connector = {
      ...common,
      x1: finiteNumber(input.x1, 0),
      y1: finiteNumber(input.y1, 0),
      x2: finiteNumber(input.x2, 100),
      y2: finiteNumber(input.y2, 0),
      stroke: safeColor(input.stroke, defaultStyles.stroke),
      strokeWidth: annotationArrowStrokeWidth(input),
      opacity: safeAnnotationOpacity(input.opacity)
    };
    if (type === "arrow") {
      connector.arrowSize = annotationArrowRequestedHeadLength(input);
      return fitAnnotationArrowToHead(connector);
    }
    return connector;
  }
  const normalized = {
    ...common,
    x: finiteNumber(input.x, 0),
    y: finiteNumber(input.y, 0),
    width: positiveNumber(input.width, 1),
    height: positiveNumber(input.height, 1)
  };
  if (type === "embedded-image") {
    const source = safeEmbeddedImageSource(input.source);
    if (!source) return null;
    const fullBounds = annotationObjectBounds(normalized);
    const requestedClip = input.imageClip && typeof input.imageClip === "object"
      ? {
          x: finiteNumber(input.imageClip.x, fullBounds.x),
          y: finiteNumber(input.imageClip.y, fullBounds.y),
          width: positiveNumber(input.imageClip.width, fullBounds.width),
          height: positiveNumber(input.imageClip.height, fullBounds.height)
        }
      : fullBounds;
    return {
      ...normalized,
      source,
      imageClip: intersectAnnotationBounds(fullBounds, requestedClip) || fullBounds,
      cropVisible: input.cropVisible !== false,
      cropPermanent: input.cropPermanent === true,
      isOriginalImage: input.isOriginalImage === true
    };
  }
  const fillFallback = type === "textbox"
    ? defaultStyles.fill
    : type === "entity"
      ? defaultEntityFill
      : "none";
  normalized.fill = input.fill === "none" ? "none" : safeColor(input.fill, fillFallback);
  normalized.stroke = safeColor(input.stroke, type === "entity" ? defaultEntityStroke : defaultStyles.stroke);
  normalized.outlineVisible = input.outlineVisible !== false;
  normalized.strokeWidth = clampNumber(positiveNumber(input.strokeWidth, defaultStyles.strokeWidth), 1, 40);
  normalized.opacity = safeAnnotationOpacity(input.opacity);
  if (type === "textbox") {
    normalized.text = String(input.text ?? "Text").slice(0, 10000);
    normalized.textColor = safeColor(input.textColor, defaultStyles.textColor);
    normalized.fontFamily = safeFont(input.fontFamily);
    normalized.fontSize = clampNumber(positiveNumber(input.fontSize, defaultStyles.fontSize), 6, 240);
    normalized.textAlign = safeTextAlign(input.textAlign);
    normalized.textVerticalAlign = safeTextVerticalAlign(input.textVerticalAlign);
  }
  if (type === "entity") {
    normalized.entitySchema = unquoteAnnotationSqlIdentifier(input.entitySchema).slice(0, 240);
    normalized.entityName = unquoteAnnotationSqlIdentifier(input.entityName || "Entity").slice(0, 240) || "Entity";
    normalized.fields = Array.isArray(input.fields)
      ? input.fields.map(normalizeAnnotationEntityField).filter(Boolean).slice(0, 500)
      : [];
    normalized.foreignKeys = Array.isArray(input.foreignKeys)
      ? input.foreignKeys.map(normalizeAnnotationEntityForeignKey).filter(Boolean).slice(0, 500)
      : [];
    normalized.foreignKeysAtTop = input.foreignKeysAtTop === true;
    normalized.showSelfRelationships = input.showSelfRelationships === true;
    normalized.anchorTable = input.anchorTable === true;
    normalized.collapsed = input.collapsed === true;
    normalized.expandedHeight = positiveNumber(input.expandedHeight, normalized.height);
    normalized.sourceText = String(input.sourceText || "").slice(0, 500000);
    normalized.textColor = safeColor(input.textColor, defaultEntityTextColor);
    normalized.entityNameTextColor = safeColor(input.entityNameTextColor, normalized.textColor);
    normalized.entityHeaderFill = safeColor(
      input.entityHeaderFill,
      normalized.fill === "none" ? defaultEntityFill : normalized.fill
    );
    normalized.entityAnnotation = String(input.entityAnnotation || "").slice(0, 10000);
    normalized.entityAnnotationGroupId = safeGroupId(input.entityAnnotationGroupId);
    normalized.fontFamily = safeFont(input.fontFamily);
    normalized.fontSize = clampNumber(positiveNumber(input.fontSize, defaultEntityFontSize), 6, 240);
    normalized.showKeyColumn = input.showKeyColumn !== false;
    normalized.showDataTypes = input.showDataTypes === true;
    normalized.dataTypeExpandedWidth = positiveNumber(
      input.dataTypeExpandedWidth,
      normalized.showDataTypes ? normalized.width : 0
    );
  }
  return normalized;
}

function normalizeAnnotationEntityField(input) {
  if (!input || typeof input !== "object") return null;
  const name = unquoteAnnotationSqlIdentifier(input.name).slice(0, 240);
  if (!name) return null;
  return {
    name,
    dataType: String(input.dataType || "").trim().slice(0, 240),
    nullable: input.nullable === true ? true : input.nullable === false ? false : null,
    isPrimaryKey: input.isPrimaryKey === true,
    isForeignKey: input.isForeignKey === true,
    isImportant: input.isImportant === true,
    isIdentity: input.isIdentity === true,
    identity: String(input.identity || (input.isIdentity === true ? "IDENTITY" : "")).trim().slice(0, 80)
  };
}

function normalizeAnnotationEntityForeignKey(input) {
  if (!input || typeof input !== "object") return null;
  const columns = Array.isArray(input.columns)
    ? input.columns.map(unquoteAnnotationSqlIdentifier).filter(Boolean).slice(0, 32)
    : [];
  const referencedColumns = Array.isArray(input.referencedColumns)
    ? input.referencedColumns.map(unquoteAnnotationSqlIdentifier).filter(Boolean).slice(0, 32)
    : [];
  const referencedTable = unquoteAnnotationSqlIdentifier(input.referencedTable).slice(0, 240);
  if (!columns.length || !referencedTable) return null;
  const styleOverride = normalizeAnnotationEntityRelationshipStyleOverride(input.styleOverride);
  return {
    name: unquoteAnnotationSqlIdentifier(input.name).slice(0, 240),
    columns,
    referencedSchema: unquoteAnnotationSqlIdentifier(input.referencedSchema).slice(0, 240),
    referencedTable,
    referencedColumns,
    relationshipType: safeAnnotationEntityRelationshipType(input.relationshipType),
    ...(styleOverride ? { styleOverride } : {})
  };
}

function annotationArrowStrokeWidth(object) {
  return clampNumber(
    positiveNumber(object?.strokeWidth, defaultStyles.strokeWidth),
    minimumScaledStrokeWidth,
    maximumScaledStrokeWidth
  );
}

function annotationArrowRequestedHeadLength(object) {
  return clampNumber(
    positiveNumber(object?.arrowSize, defaultStyles.arrowSize),
    minimumScaledArrowSize,
    maximumScaledArrowSize
  );
}

function annotationArrowRequiredLength(object) {
  return Math.max(
    annotationArrowRequestedHeadLength(object),
    annotationArrowStrokeWidth(object) * 1.5
  ) / 0.8;
}

function annotationMinimumArrowLength(object) {
  return Math.max(minimumObjectSize, annotationArrowRequiredLength(object));
}

export function fitAnnotationArrowToHead(inputArrow) {
  const arrow = { ...inputArrow };
  arrow.strokeWidth = annotationArrowStrokeWidth(arrow);
  arrow.arrowSize = annotationArrowRequestedHeadLength(arrow);
  const x1 = finiteNumber(arrow.x1, 0);
  const y1 = finiteNumber(arrow.y1, 0);
  const x2 = finiteNumber(arrow.x2, x1);
  const y2 = finiteNumber(arrow.y2, y1);
  const deltaX = x2 - x1;
  const deltaY = y2 - y1;
  const length = Math.hypot(deltaX, deltaY);
  const requiredLength = annotationArrowRequiredLength(arrow);
  if (length >= requiredLength) return arrow;
  const directionX = length ? deltaX / length : 1;
  const directionY = length ? deltaY / length : 0;
  arrow.x1 = x2 - (directionX * requiredLength);
  arrow.y1 = y2 - (directionY * requiredLength);
  return arrow;
}

export function scaleGroupedAnnotationArrowStyle(inputArrow, scale) {
  const factor = positiveNumber(Math.abs(scale), 1);
  return {
    strokeWidth: clampNumber(
      annotationArrowStrokeWidth(inputArrow) * factor,
      minimumScaledStrokeWidth,
      maximumScaledStrokeWidth
    ),
    arrowSize: clampNumber(
      annotationArrowRequestedHeadLength(inputArrow) * factor,
      minimumScaledArrowSize,
      maximumScaledArrowSize
    )
  };
}

export function annotationArrowGeometry(object) {
  const x1 = finiteNumber(object?.x1, 0);
  const y1 = finiteNumber(object?.y1, 0);
  const x2 = finiteNumber(object?.x2, x1);
  const y2 = finiteNumber(object?.y2, y1);
  const deltaX = x2 - x1;
  const deltaY = y2 - y1;
  const length = Math.hypot(deltaX, deltaY);
  if (!length) {
    const tip = { x: x2, y: y2 };
    return { shaftEnd: tip, headPoints: [tip, tip, tip] };
  }

  const directionX = deltaX / length;
  const directionY = deltaY / length;
  const strokeWidth = annotationArrowStrokeWidth(object);
  const requestedHeadLength = annotationArrowRequestedHeadLength(object);
  const headLength = Math.min(
    Math.max(requestedHeadLength, strokeWidth * 1.5),
    length * 0.8
  );
  const halfWidth = Math.max(
    headLength * 0.48,
    Math.min(strokeWidth * 0.75, headLength * 0.75)
  );
  const baseX = x2 - (directionX * headLength);
  const baseY = y2 - (directionY * headLength);
  const perpendicularX = -directionY * halfWidth;
  const perpendicularY = directionX * halfWidth;

  return {
    shaftEnd: { x: baseX, y: baseY },
    headPoints: [
      { x: x2, y: y2 },
      { x: baseX + perpendicularX, y: baseY + perpendicularY },
      { x: baseX - perpendicularX, y: baseY - perpendicularY }
    ]
  };
}

async function loadOriginalImage(url) {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) throw new Error("The original image could not be loaded.");
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("Only image files can be annotated.");
  const dimensions = await imageDimensions(url);
  return { source: url, ...dimensions };
}

async function loadExistingAnnotation(url) {
  try {
    const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) return null;
    return parseAnnotationSvg(await response.text());
  } catch {
    return null;
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")), { once: true });
    reader.addEventListener("error", () => reject(new Error("The original image could not be read.")), { once: true });
    reader.readAsDataURL(blob);
  });
}

function imageDimensions(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (!width || !height) {
        reject(new Error("The image dimensions could not be read."));
        return;
      }
      resolve({ width, height });
    }, { once: true });
    image.addEventListener("error", () => reject(new Error("The original image could not be decoded.")), { once: true });
    image.src = source;
  });
}

function annotationSnapshot(state, sourceRegistry = null) {
  const snapshot = normalizeAnnotationState(state);
  snapshot.objects.forEach(object => {
    if (object.type !== "embedded-image") return;
    if (sourceRegistry && object.source) sourceRegistry.set(object.id, object.source);
    delete object.source;
  });
  return JSON.stringify(snapshot);
}

function annotationFileName(originalFileName) {
  const baseName = String(originalFileName || "image")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "image";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${baseName}-annotation-${stamp}.svg`;
}

function annotationPermanentCropFileName(originalFileName) {
  const baseName = String(originalFileName || "image")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "image";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${baseName}-permanent-crop-${stamp}.png`;
}

function annotationObjectId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function annotationObjectLabel(object) {
  if (!object) return "No selection";
  const customName = safeAnnotationName(object.name);
  if (customName) return customName;
  if (object.type === "entity") {
    return formatAnnotationEntityIdentifier(object.entitySchema, object.entityName) || "Entity";
  }
  return {
    image: "Original image",
    "embedded-image": "Image",
    rectangle: "Rectangle",
    circle: "Circle",
    arrow: "Arrow",
    line: "Line",
    textbox: "Text box",
    entity: "Entity",
    [entityRelationshipsObjectType]: "Entity Relationships"
  }[object.type] || "Object";
}

function snappedPoint(point, state) {
  return {
    x: snapAnnotationValue(point.x, state.snapToGrid, state.gridSize),
    y: snapAnnotationValue(point.y, state.snapToGrid, state.gridSize)
  };
}

function normalizedRect(start, end) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y)
  };
}

function setControlValue(control, value) {
  if (!control || control.value === value) return;
  if (document.activeElement === control && control.matches("input[type='text'], textarea")) return;
  control.value = value;
}

function safeColor(value, fallback) {
  const text = String(value || "").trim();
  if (text === "none") return "none";
  return /^#[0-9a-f]{6}$/i.test(text) ? text.toLowerCase() : fallback;
}

function safeFont(value) {
  const font = String(value || "").trim();
  return ["Arial", "Georgia", "Times New Roman", "Verdana", "Tahoma", "Trebuchet MS", "Courier New"].includes(font)
    ? font
    : defaultStyles.fontFamily;
}

function safeTextAlign(value) {
  const alignment = String(value || "").trim().toLowerCase();
  return ["left", "center", "right"].includes(alignment) ? alignment : defaultStyles.textAlign;
}

function safeTextVerticalAlign(value) {
  const alignment = String(value || "").trim().toLowerCase();
  return ["top", "middle", "bottom"].includes(alignment) ? alignment : defaultStyles.textVerticalAlign;
}

function safeAnnotationOpacity(value) {
  return clampNumber(finiteNumber(value, defaultStyles.opacity), 0, 1);
}

function safeObjectId(value, prefix) {
  const id = String(value || "").trim();
  return /^[a-z0-9_-]{1,120}$/i.test(id) ? id : annotationObjectId(prefix);
}

function safeGroupId(value) {
  const id = String(value || "").trim();
  return /^[a-z0-9_-]{1,120}$/i.test(id) ? id : "";
}

function safeAnnotationName(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 120);
}

function pruneAnnotationGroupMetadata(state) {
  if (!state || typeof state !== "object") return;
  const groupIds = new Set((state.objects || []).map(object => object.groupId).filter(Boolean));
  const nameSource = state.groupNames && typeof state.groupNames === "object" ? state.groupNames : {};
  const visibilitySource = state.groupVisibility && typeof state.groupVisibility === "object"
    ? state.groupVisibility
    : {};
  const groupNames = {};
  const groupVisibility = {};
  groupIds.forEach(groupId => {
    const name = safeAnnotationName(nameSource[groupId]);
    if (name) groupNames[groupId] = name;
    groupVisibility[groupId] = visibilitySource[groupId] !== false;
  });
  state.groupNames = groupNames;
  state.groupVisibility = groupVisibility;
}

function safeSvgId(value) {
  return String(value || "object").replace(/[^a-z0-9_-]/gi, "-");
}

function splitLongWord(word, maximumCharacters) {
  const pieces = [];
  for (let index = 0; index < word.length; index += maximumCharacters) {
    pieces.push(word.slice(index, index + maximumCharacters));
  }
  return pieces.length ? pieces : [""];
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampNumber(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function formatNumber(value) {
  return String(Math.round(finiteNumber(value, 0) * annotationCoordinateScale) / annotationCoordinateScale);
}

function deepCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeXmlAttr(value) {
  return escapeXmlText(value).replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function escapeXmlText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function decodeXmlText(value) {
  return String(value || "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}
