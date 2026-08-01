import {
  richTextToolsHtml,
  sharedRichColorPickerHtml
} from "../../components/forms.js?v=20260801-diagram2-mapping-view-v3";
import { buttonContent } from "../../components/buttons.js?v=20260701-unified-dropdowns";
import {
  annotationTemplatePreviewDataUrl,
  buildPortableAnnotationSelectionSvg,
  copyAnnotationPngToClipboard,
  copyAnnotationSvgToClipboard
} from "../../components/image-annotation.js?v=20260731-rte-checkbox-layout-v2";
import { appUrl } from "../../shared/app-urls.js";
import {
  downloadCsv,
  downloadXlsx,
  exportFileName,
  exportIconHtml
} from "../../shared/table-export.js?v=20260801-diagram2-mapping-download-v2";
import { escapeAttr, escapeHtml, normalizeRichHtml } from "../../shared/text-and-links.js?v=20260722-rte-toggle-state-v1";
import {
  diagram2EntityDialogDefaults,
  parseDiagram2EntityDefinition
} from "./diagram2-editor-entities.js?v=20260731-rte-checkbox-layout-v2";
import {
  diagram2ImageCropCornerRadii,
  diagram2ImageCropInsets,
  diagram2ImageHasReversibleCrop
} from "./diagram2-editor-crop.js?v=20260731-diagram2-crop-preview-v1";
import {
  diagram2FieldRectangleMapping,
  isDiagram2FieldRectangle
} from "./diagram2-editor-field-rectangles.js?v=20260731-rte-checkbox-layout-v2";
import {
  createDiagram2FieldMappingIndexes,
  diagram2FieldMappingExportRows,
  diagram2FieldMappingPaneGroups
} from "./diagram2-editor-field-mappings.js?v=20260801-diagram2-mapping-download-v2";
import { diagram2ObjectTreeNodes } from "./diagram2-editor-structure.js?v=20260731-rte-checkbox-layout-v2";

const diagram2LastColorsStorageKey = "pmt-rich-last-colors";
const diagram2CustomColorsStorageKey = "pmt-rich-custom-colors";
const diagram2LastColorStoragePrefix = "pmt-rich-last-color-";
const diagram2StoredColorLimit = 10;
const diagram2RecentColorLimit = 6;
const defaultDiagram2ShellStyles = {
  fill: "#5aa315",
  stroke: "#3f7f0d",
  textColor: "#ffffff",
  fontFamily: "Arial",
  fontSize: 28,
  textAlign: "left",
  textVerticalAlign: "top",
  outlineVisible: true,
  opacity: 1,
  strokeWidth: 4,
  arrowSize: 24,
  entityNameTextColor: "#172b4d",
  entityHeaderFill: "#ffffff",
  headerTextColor: "#000000",
  headerFill: "#d9ecff",
  uiTextColor: "#172b4d",
  uiFill: "#ffffff",
  databaseTextColor: "#172b4d",
  databaseFill: "#ffffff",
  fieldMappingRowHoverFill: "#fff59d",
  fieldMappingHighlightColor: "#facc15",
  fieldMappingHighlightStrokeWidth: 9,
  showSymbols: false
};
const diagram2ShellStyleTargets = new Map([
  ["fill", new Set(["rectangle", "circle", "textbox", "rich-text", "entity", "field-rectangle"])],
  ["stroke", new Set(["rectangle", "circle", "textbox", "rich-text", "entity", "field-rectangle", "field-mapping-table", "arrow", "line", "entity-relationship", "entity-relationships"])],
  ["outlineVisible", new Set(["rectangle", "circle", "textbox", "rich-text", "entity", "field-rectangle", "field-mapping-table"])],
  ["strokeWidth", new Set(["rectangle", "circle", "textbox", "rich-text", "entity", "field-rectangle", "field-mapping-table", "arrow", "line", "entity-relationship", "entity-relationships"])],
  ["arrowSize", new Set(["arrow", "entity-relationship", "entity-relationships"])],
  ["opacity", new Set(["rectangle", "circle", "textbox", "rich-text", "entity", "field-rectangle", "field-mapping-table", "arrow", "line", "entity-relationship", "entity-relationships"])],
  ["textColor", new Set(["textbox", "entity", "field-mapping-table"])],
  ["fontFamily", new Set(["textbox", "entity", "field-mapping-table"])],
  ["fontSize", new Set(["textbox", "entity", "field-mapping-table"])],
  ["textAlign", new Set(["textbox"])],
  ["textVerticalAlign", new Set(["textbox"])],
  ["entityNameTextColor", new Set(["entity"])],
  ["entityHeaderFill", new Set(["entity"])],
  ["headerTextColor", new Set(["field-mapping-table"])],
  ["headerFill", new Set(["field-mapping-table"])],
  ["uiTextColor", new Set(["field-mapping-table"])],
  ["uiFill", new Set(["field-mapping-table"])],
  ["databaseTextColor", new Set(["field-mapping-table"])],
  ["databaseFill", new Set(["field-mapping-table"])],
  ["fieldMappingRowHoverFill", new Set(["field-mapping-table"])],
  ["fieldMappingHighlightColor", new Set(["field-mapping-table"])],
  ["fieldMappingHighlightStrokeWidth", new Set(["field-mapping-table"])],
  ["showSymbols", new Set(["entity-relationship", "entity-relationships"])]
]);
const diagram2ShellFontFamilies = [
  "Arial",
  "Georgia",
  "Times New Roman",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Courier New"
];

export function diagram2EditorShellHtml(options = {}) {
  const status = options.status || {};
  const title = escapeHtml(options.title || "Diagram 2");
  const subtitle = escapeHtml(options.subtitle || "Editable high-performance diagram");
  const includeHeader = options.includeHeader === true;
  const includeFooter = options.includeFooter === true;
  const selectedZoom = String(options.selectedZoom || "fit");
  const canUse = options.canUse !== false;
  const state = options.state || null;
  const selectedIds = Array.isArray(options.selectedObjectIds) ? options.selectedObjectIds : [];
  const includeMappingPane = options.includeMappingPane === true;

  return `
    <div class="diagram2-editor-shell image-annotation-window ${includeHeader ? "has-editor-head" : ""} ${includeFooter ? "has-editor-footer" : ""}" data-diagram2-editor-shell data-diagram2-host-kind="${escapeAttr(status.hostKind || options.hostKind || "diagram-document")}">
      ${includeHeader ? `
        <div class="dialog-head image-annotation-head diagram2-editor-head" data-dialog-drag-ignore>
          <div>
            <h2>${title}</h2>
            <p>${subtitle}</p>
          </div>
          <div class="image-annotation-head-actions">
            ${options.allowMaximize ? `<button type="button" class="icon-btn dialog-maximize-button" data-action="maximize-diagram2-editor" title="Maximize" aria-label="Maximize">Maximize</button>` : ""}
            <button type="button" class="icon-btn" data-action="cancel-diagram2-editor" title="Close" aria-label="Close">Close</button>
          </div>
        </div>
      ` : ""}
      ${diagram2ToolbarHtml({
        canUse,
        includeActions: options.includeToolbarActions === true || !includeFooter,
        includeMappingPane,
        selectedZoom
      })}
      <div class="image-annotation-main diagram2-editor-main is-left-pane-open is-tools-open" data-diagram2-editor-main data-diagram2-left-pane-mode="tools">
        ${diagram2ToolsPaneHtml({ canUse })}
        ${diagram2ObjectsPaneHtml(state, selectedIds, { search: options.objectSearch })}
        ${diagram2TemplatePaneHtml(options.templateState, state, selectedIds)}
        ${includeMappingPane ? diagram2MappingPaneHtml(state) : ""}
        <div class="diagram2-editor-center" data-diagram2-editor-center>
          <div class="image-annotation-workspace diagram2-editor-workspace" data-diagram2-workspace tabindex="0" aria-label="Diagram 2 canvas">
            <div class="image-annotation-canvas-stage diagram2-editor-canvas-stage" data-diagram2-canvas-stage>
              <div class="diagram2-viewer-canvas" data-diagram2-viewer-canvas>
                <div class="diagram2-renderer-surface ${selectedZoom === "fit" ? "is-fit" : ""}" data-diagram2-renderer-surface></div>
              </div>
            </div>
          </div>
          ${options.showDiagnostics === true ? diagram2DiagnosticsShellHtml(options.diagnosticsHtml || "") : ""}
        </div>
        <div class="image-annotation-inspector-splitter diagram2-editor-inspector-splitter" data-diagram2-inspector-splitter role="separator" aria-orientation="vertical" aria-label="Resize right pane" tabindex="0"></div>
        <aside class="image-annotation-inspector diagram2-editor-inspector" data-diagram2-inspector aria-label="Diagram 2 right pane">
          ${diagram2InspectorHtml(status, state, selectedIds, {
            templateState: options.templateState
          })}
        </aside>
      </div>
      ${diagram2ContextMenuHtml()}
      ${includeFooter ? diagram2FooterHtml(options.applyLabel || "Save") : ""}
    </div>
  `;
}

export function diagram2ObjectsPaneHtml(state, selectedObjectIds = [], options = {}) {
  const query = String(options.search || "").trim();
  const nodes = diagram2ObjectTreeNodes(state, query);
  const selected = new Set(selectedObjectIds.map(String));
  const rows = nodes.map(node => diagram2ObjectTreeNodeHtml(node, selected, 1)).join("");

  return `
    <aside class="diagram2-editor-left-pane diagram2-editor-objects-pane" data-diagram2-left-pane data-diagram2-left-pane-name="objects" data-diagram2-objects-pane aria-label="Diagram 2 objects">
      <div class="diagram2-editor-left-pane-scroll">
        <div class="image-annotation-object-tree-actions" role="toolbar" aria-label="Object tree actions">
          <button type="button" data-action="group-diagram2-selection" data-diagram2-requires-multi-selection data-diagram2-requires-update>Group</button>
          <button type="button" data-action="ungroup-diagram2-selection" data-diagram2-requires-selection data-diagram2-requires-update>Ungroup</button>
          <button type="button" data-action="rename-diagram2-object" data-diagram2-requires-selection data-diagram2-requires-update>Rename</button>
          <button type="button" data-action="toggle-diagram2-selection-visibility" data-diagram2-requires-selection data-diagram2-requires-update>Hide/Show</button>
          <button type="button" data-action="copy-diagram2-selection" data-diagram2-requires-selection>Copy</button>
          <button type="button" data-action="paste-diagram2-selection" data-diagram2-requires-update>Paste</button>
          <button type="button" data-action="duplicate-diagram2-selection" data-diagram2-requires-selection data-diagram2-requires-update>Duplicate</button>
          <button type="button" data-action="delete-diagram2-selection" data-diagram2-requires-selection data-diagram2-requires-update>Delete</button>
        </div>
        <div class="image-annotation-object-tree-actions diagram2-layer-actions" role="toolbar" aria-label="Layer order actions">
          <button type="button" data-action="arrange-diagram2-selection-front" data-diagram2-requires-selection data-diagram2-requires-update>To Front</button>
          <button type="button" data-action="arrange-diagram2-selection-forward" data-diagram2-requires-selection data-diagram2-requires-update>Forward</button>
          <button type="button" data-action="arrange-diagram2-selection-backward" data-diagram2-requires-selection data-diagram2-requires-update>Backward</button>
          <button type="button" data-action="arrange-diagram2-selection-back" data-diagram2-requires-selection data-diagram2-requires-update>To Back</button>
        </div>
        <label class="image-annotation-object-tree-search">
          <span>Search objects</span>
          <input type="search" placeholder="Search objects" aria-label="Search objects" autocomplete="off" data-filter="diagram2-object-search" value="${escapeAttr(query)}">
        </label>
        <button type="button" class="image-annotation-object-tree-root-drop" data-diagram2-object-tree-root-drop data-action="reorder-diagram2-object-root">Move to root (top)</button>
        <div class="image-annotation-object-tree diagram2-object-tree" data-diagram2-object-tree role="tree" tabindex="0" aria-label="Diagram 2 objects, topmost first">
          ${rows || `<p class="image-annotation-object-tree-empty">No objects.</p>`}
        </div>
      </div>
      ${diagram2LeftPaneResizerHtml("Objects")}
    </aside>
  `;
}

export function openDiagram2TextEditor(options = {}) {
  const object = options.object;
  if (!object || !["textbox", "rich-text"].includes(object.type)) return Promise.resolve(null);
  const richText = object.type === "rich-text";
  const dialog = document.createElement("dialog");
  dialog.className = richText
    ? "dialog image-annotation-rich-text-dialog diagram2-text-editor-dialog"
    : "dialog diagram2-text-editor-dialog";
  dialog.innerHTML = `
    <form method="dialog" data-diagram2-text-editor-form>
      <div class="dialog-head">
        <div>
          <h2>${richText ? "Edit Rich Text" : "Edit Text"}</h2>
          <p>${escapeHtml(String(object.name || (richText ? "Rich Text" : "Text Box")))}</p>
        </div>
        <button type="button" class="icon-btn" data-diagram2-text-cancel title="Close" aria-label="Close">Close</button>
      </div>
      <div class="dialog-body diagram2-text-editor-body${richText ? " image-annotation-rich-text-dialog-body" : ""}">
        ${richText ? `
          <div class="field full" data-rich-editor-root>
            <label>Rich Text</label>
            ${richTextToolsHtml({ disableLinkedDiagram: true, linkedDiagramDisabledReason: "Linked Diagrams are not available inside a Diagram object." })}
            <div class="rich-editor image-annotation-rich-text-editor diagram2-rich-text-editor" contenteditable="true" role="textbox" aria-label="Diagram Rich Text" aria-multiline="true" data-rich="diagram2RichText" data-diagram2-rich-text-editor>${normalizeDiagram2TextEditorHtml(object.html)}</div>
          </div>
        ` : `
          <label class="field">
            <span>Text</span>
            <textarea rows="10" data-diagram2-plain-text-editor>${escapeHtml(String(object.text || ""))}</textarea>
          </label>
        `}
      </div>
      <div class="dialog-actions">
        <button type="button" class="secondary" data-diagram2-text-cancel>Cancel</button>
        <button type="submit" class="primary">Apply</button>
      </div>
    </form>
  `;
  document.body.appendChild(dialog);
  if (richText) options.bindRichTextButtons?.(dialog);

  return new Promise(resolve => {
    let result = null;
    const finish = value => {
      result = value;
      dialog.close();
    };
    dialog.querySelectorAll("[data-diagram2-text-cancel]").forEach(button => {
      button.addEventListener("click", () => finish(null));
    });
    dialog.querySelector("[data-diagram2-text-editor-form]")?.addEventListener("submit", event => {
      event.preventDefault();
      const value = richText
        ? normalizeDiagram2TextEditorHtml(dialog.querySelector("[data-diagram2-rich-text-editor]")?.innerHTML)
        : String(dialog.querySelector("[data-diagram2-plain-text-editor]")?.value || "");
      finish(value);
    });
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      finish(null);
    });
    dialog.addEventListener("close", () => {
      dialog.remove();
      resolve(result);
    }, { once: true });
    dialog.showModal();
    const editor = dialog.querySelector("[data-diagram2-rich-text-editor], [data-diagram2-plain-text-editor]");
    editor?.focus();
    if (!richText) editor?.select?.();
  });
}

export function openDiagram2EntityEditor(options = {}) {
  const object = options.object?.type === "entity" ? options.object : null;
  const defaults = diagram2EntityDialogDefaults(object);
  const dialog = document.createElement("dialog");
  dialog.className = "dialog diagram2-entity-editor-dialog";
  dialog.innerHTML = `
    <form method="dialog" data-diagram2-entity-editor-form>
      <div class="dialog-head">
        <div>
          <h2>${object ? "Edit Entity" : "Add Entity"}</h2>
          <p>${escapeHtml(defaults.entityName || "Entity")}</p>
        </div>
        <button type="button" class="icon-btn" data-diagram2-entity-cancel title="Close" aria-label="Close">Close</button>
      </div>
      <div class="dialog-body diagram2-entity-editor-body">
        <label class="field">
          <span>Entity Name</span>
          <input type="text" maxlength="240" autocomplete="off" data-diagram2-entity-name value="${escapeAttr(defaults.entityName || "Entity")}">
        </label>
        <label class="field full">
          <span>SQL or Fields</span>
          <textarea rows="14" data-diagram2-entity-source>${escapeHtml(defaults.sourceText || "Id")}</textarea>
        </label>
        <label class="inline-check"><input type="checkbox" data-diagram2-entity-fk-top ${defaults.foreignKeysAtTop ? "checked" : ""}><span>FK at the Top</span></label>
        <p class="image-annotation-format-status" data-diagram2-entity-status role="status" aria-live="polite"></p>
      </div>
      <div class="dialog-actions">
        <button type="button" class="secondary" data-diagram2-entity-cancel>Cancel</button>
        <button type="submit" class="primary">Apply</button>
      </div>
    </form>
  `;
  document.body.appendChild(dialog);
  return new Promise(resolve => {
    let result = null;
    const finish = value => {
      result = value;
      dialog.close();
    };
    dialog.querySelectorAll("[data-diagram2-entity-cancel]").forEach(button => {
      button.addEventListener("click", () => finish(null));
    });
    dialog.querySelector("[data-diagram2-entity-editor-form]")?.addEventListener("submit", event => {
      event.preventDefault();
      const source = String(dialog.querySelector("[data-diagram2-entity-source]")?.value || "");
      const name = String(dialog.querySelector("[data-diagram2-entity-name]")?.value || "");
      const foreignKeysAtTop = dialog.querySelector("[data-diagram2-entity-fk-top]")?.checked === true;
      try {
        finish(parseDiagram2EntityDefinition(source, name, { foreignKeysAtTop }));
      } catch (error) {
        const status = dialog.querySelector("[data-diagram2-entity-status]");
        if (status) status.textContent = error?.message || "The Entity definition could not be parsed.";
      }
    });
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      finish(null);
    });
    dialog.addEventListener("close", () => {
      dialog.remove();
      resolve(result);
    }, { once: true });
    dialog.showModal();
    dialog.querySelector("[data-diagram2-entity-name]")?.focus();
  });
}

export function openDiagram2RelationshipEditor(options = {}) {
  const state = options.state && typeof options.state === "object" ? options.state : {};
  const entities = (Array.isArray(state.objects) ? state.objects : [])
    .filter(object => object?.type === "entity" && object.entityKind !== "field-rectangle");
  if (!entities.length) return Promise.resolve(null);

  const selectedEntityId = String(options.selectedEntityId || entities[0]?.id || "");
  const entityOptions = entities.map(entity =>
    `<option value="${escapeAttr(entity.id)}" ${entity.id === selectedEntityId ? "selected" : ""}>${escapeHtml(entityLabel(entity))}</option>`).join("");
  const dialog = document.createElement("dialog");
  dialog.className = "dialog diagram2-relationship-editor-dialog";
  dialog.innerHTML = `
    <form method="dialog" data-diagram2-relationship-editor-form>
      <div class="dialog-head">
        <div>
          <h2>Add Relationship</h2>
          <p>Entity Relationship</p>
        </div>
        <button type="button" class="icon-btn" data-diagram2-relationship-cancel title="Close" aria-label="Close">Close</button>
      </div>
      <div class="dialog-body diagram2-relationship-editor-body">
        <div class="image-annotation-inspector-grid">
          <label class="field">
            <span>Source Entity</span>
            <select data-diagram2-relationship-source-entity>${entityOptions}</select>
          </label>
          <label class="field">
            <span>Source Field</span>
            <select data-diagram2-relationship-source-field></select>
          </label>
          <label class="field">
            <span>Target Entity</span>
            <select data-diagram2-relationship-target-entity>${entityOptions}</select>
          </label>
          <label class="field">
            <span>Target Field</span>
            <select data-diagram2-relationship-target-field></select>
          </label>
          <label class="field image-annotation-wide">
            <span>Relationship type</span>
            <select data-diagram2-relationship-type-input>
              <option value="">Arrow</option>
              <option value="one-to-one">One-to-one</option>
              <option value="one-to-many">One-to-many</option>
              <option value="many-to-one">Many-to-one</option>
            </select>
          </label>
        </div>
        <p class="image-annotation-format-status" data-diagram2-relationship-status role="status" aria-live="polite"></p>
      </div>
      <div class="dialog-actions">
        <button type="button" class="secondary" data-diagram2-relationship-cancel>Cancel</button>
        <button type="submit" class="primary">Apply</button>
      </div>
    </form>
  `;
  document.body.appendChild(dialog);
  const entityById = new Map(entities.map(entity => [entity.id, entity]));
  const sourceEntity = dialog.querySelector("[data-diagram2-relationship-source-entity]");
  const targetEntity = dialog.querySelector("[data-diagram2-relationship-target-entity]");
  const sourceField = dialog.querySelector("[data-diagram2-relationship-source-field]");
  const targetField = dialog.querySelector("[data-diagram2-relationship-target-field]");
  const fieldOptions = entityId => {
    const entity = entityById.get(String(entityId || "")) || entities[0];
    return (Array.isArray(entity?.fields) ? entity.fields : [])
      .map(field => `<option value="${escapeAttr(field.name)}">${escapeHtml(field.name)}</option>`)
      .join("");
  };
  const refreshFields = () => {
    sourceField.innerHTML = fieldOptions(sourceEntity.value);
    targetField.innerHTML = fieldOptions(targetEntity.value);
  };
  sourceEntity.addEventListener("change", refreshFields);
  targetEntity.addEventListener("change", refreshFields);
  refreshFields();

  return new Promise(resolve => {
    let result = null;
    const finish = value => {
      result = value;
      dialog.close();
    };
    dialog.querySelectorAll("[data-diagram2-relationship-cancel]").forEach(button => {
      button.addEventListener("click", () => finish(null));
    });
    dialog.querySelector("[data-diagram2-relationship-editor-form]")?.addEventListener("submit", event => {
      event.preventDefault();
      if (!sourceField.value || !targetField.value) {
        const status = dialog.querySelector("[data-diagram2-relationship-status]");
        if (status) status.textContent = "Choose a source and target field.";
        return;
      }
      finish({
        sourceEntityId: sourceEntity.value,
        sourceFieldName: sourceField.value,
        targetEntityId: targetEntity.value,
        targetFieldName: targetField.value,
        relationshipType: dialog.querySelector("[data-diagram2-relationship-type-input]")?.value || ""
      });
    });
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      finish(null);
    });
    dialog.addEventListener("close", () => {
      dialog.remove();
      resolve(result);
    }, { once: true });
    dialog.showModal();
    sourceEntity.focus();
  });
}

export function openDiagram2EntityAnnotationEditor(options = {}) {
  const object = options.object && typeof options.object === "object" ? options.object : {};
  const dialog = document.createElement("dialog");
  dialog.className = "dialog mini-dialog diagram2-entity-annotation-dialog";
  dialog.innerHTML = `
    <form method="dialog" data-diagram2-entity-annotation-form>
      <div class="dialog-head">
        <div>
          <h2>Entity Annotation</h2>
          <p>${escapeHtml(entityLabel(object))}</p>
        </div>
        <button type="button" class="icon-btn" data-diagram2-entity-annotation-cancel title="Close" aria-label="Close">Close</button>
      </div>
      <div class="dialog-body">
        <label class="field">
          <span>Annotation text</span>
          <textarea rows="5" maxlength="10000" data-diagram2-entity-annotation-text>${escapeHtml(object.entityAnnotation || "")}</textarea>
        </label>
        <label class="inline-check"><input type="checkbox" data-diagram2-entity-annotation-arrow ${object.entityAnnotationShowArrow === false ? "" : "checked"}><span>Show annotation arrow</span></label>
      </div>
      <div class="dialog-actions">
        <button type="button" class="secondary" data-diagram2-entity-annotation-cancel>Cancel</button>
        <button type="submit" class="primary">Apply</button>
      </div>
    </form>
  `;
  document.body.appendChild(dialog);
  return resolveDiagram2Dialog(dialog, {
    cancelSelector: "[data-diagram2-entity-annotation-cancel]",
    focusSelector: "[data-diagram2-entity-annotation-text]",
    submitSelector: "[data-diagram2-entity-annotation-form]",
    value: () => ({
      text: String(dialog.querySelector("[data-diagram2-entity-annotation-text]")?.value || ""),
      showArrow: dialog.querySelector("[data-diagram2-entity-annotation-arrow]")?.checked !== false
    })
  });
}

export function openDiagram2FieldRectangleMappingEditor(options = {}) {
  const object = options.object;
  const state = options.state && typeof options.state === "object" ? options.state : {};
  const entities = (Array.isArray(state.objects) ? state.objects : [])
    .filter(candidate => candidate?.type === "entity" && !isDiagram2FieldRectangle(candidate));
  if (!isDiagram2FieldRectangle(object) || !entities.length) return Promise.resolve(null);

  const current = diagram2FieldRectangleMapping(object);
  const currentReference = String(current?.referencedEntity || "").toLowerCase();
  const entityOptions = entities.map(entity => {
    const reference = diagram2EntityReferenceValue(entity);
    return `<option value="${escapeAttr(entity.id)}" ${reference.toLowerCase() === currentReference ? "selected" : ""}>${escapeHtml(entityLabel(entity))}</option>`;
  }).join("");
  const dialog = document.createElement("dialog");
  dialog.className = "dialog image-annotation-foreign-key-dialog diagram2-field-mapping-dialog";
  dialog.innerHTML = `
    <form method="dialog" data-diagram2-field-mapping-form>
      <div class="dialog-head">
        <div>
          <h2>Map Field Rectangle</h2>
          <p>${escapeHtml(object.fieldRectangleName || object.fields?.[0]?.name || "Field")}</p>
        </div>
        <button type="button" class="icon-btn" data-diagram2-field-mapping-cancel title="Close" aria-label="Close">Close</button>
      </div>
      <div class="dialog-body image-annotation-foreign-key-dialog-body">
        <label class="field">
          <span>Referenced Entity</span>
          <select data-diagram2-field-mapping-entity>${entityOptions}</select>
        </label>
        <label class="field">
          <span>Referenced Field</span>
          <select data-diagram2-field-mapping-field></select>
        </label>
        <label class="field">
          <span>Relationship</span>
          <select data-diagram2-field-mapping-relationship>
            <option value="">Simple arrow</option>
            <option value="one-to-one" ${current?.relationshipType === "one-to-one" ? "selected" : ""}>One-to-one</option>
            <option value="one-to-many" ${current?.relationshipType === "one-to-many" ? "selected" : ""}>One-to-many</option>
            <option value="many-to-one" ${current?.relationshipType === "many-to-one" ? "selected" : ""}>Many-to-one</option>
          </select>
        </label>
        <p class="image-annotation-format-status" data-diagram2-field-mapping-status role="status" aria-live="polite"></p>
      </div>
      <div class="dialog-actions">
        ${current ? `<button type="button" class="secondary" data-diagram2-field-mapping-remove>Remove Mapping</button>` : ""}
        <button type="button" class="secondary" data-diagram2-field-mapping-cancel>Cancel</button>
        <button type="submit" class="primary">Save Mapping</button>
      </div>
    </form>
  `;
  document.body.appendChild(dialog);
  const entityInput = dialog.querySelector("[data-diagram2-field-mapping-entity]");
  const fieldInput = dialog.querySelector("[data-diagram2-field-mapping-field]");
  const entityById = new Map(entities.map(entity => [String(entity.id), entity]));
  const refreshFields = () => {
    const entity = entityById.get(String(entityInput.value || "")) || entities[0];
    const selected = entity && diagram2EntityReferenceValue(entity).toLowerCase() === currentReference
      ? String(current?.referencedField || "")
      : "";
    fieldInput.innerHTML = (Array.isArray(entity?.fields) ? entity.fields : [])
      .map(field => `<option value="${escapeAttr(field?.name || "")}" ${sameDiagram2Identifier(field?.name, selected) ? "selected" : ""}>${escapeHtml(field?.name || "Field")}</option>`)
      .join("");
  };
  entityInput.addEventListener("change", refreshFields);
  refreshFields();

  return new Promise(resolve => {
    let result = null;
    const finish = value => {
      result = value;
      dialog.close();
    };
    dialog.querySelectorAll("[data-diagram2-field-mapping-cancel]").forEach(button => {
      button.addEventListener("click", () => finish(null));
    });
    dialog.querySelector("[data-diagram2-field-mapping-remove]")?.addEventListener("click", () => {
      finish({ remove: true, mapping: null });
    });
    dialog.querySelector("[data-diagram2-field-mapping-form]")?.addEventListener("submit", event => {
      event.preventDefault();
      const entity = entityById.get(String(entityInput.value || ""));
      if (!entity || !fieldInput.value) {
        dialog.querySelector("[data-diagram2-field-mapping-status]").textContent = "Choose a referenced Entity and field.";
        return;
      }
      finish({
        remove: false,
        mapping: {
          referencedEntity: diagram2EntityReferenceValue(entity),
          referencedField: fieldInput.value,
          relationshipType: dialog.querySelector("[data-diagram2-field-mapping-relationship]")?.value || ""
        }
      });
    });
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      finish(null);
    });
    dialog.addEventListener("close", () => {
      dialog.remove();
      resolve(result);
    }, { once: true });
    dialog.showModal();
    entityInput.focus();
  });
}

export function openDiagram2FieldMappingImageChooser(imagesInput = []) {
  const images = Array.isArray(imagesInput) ? imagesInput : [];
  if (!images.length) return Promise.resolve(null);
  if (images.length === 1) return Promise.resolve(images[0]);
  const dialog = document.createElement("dialog");
  dialog.className = "dialog mini-dialog diagram2-field-mapping-image-dialog";
  dialog.innerHTML = `
    <form method="dialog" data-diagram2-field-mapping-image-form>
      <div class="dialog-head"><h2>Field Mapping Table</h2></div>
      <div class="dialog-body">
        <label class="field">
          <span>Screenshot image</span>
          <select data-diagram2-field-mapping-image>
            ${images.map(image => `<option value="${escapeAttr(image.id)}">${escapeHtml(diagram2ObjectLabel(image))}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="dialog-actions">
        <button type="button" class="secondary" data-diagram2-field-mapping-image-cancel>Cancel</button>
        <button type="submit" class="primary">Generate</button>
      </div>
    </form>
  `;
  document.body.appendChild(dialog);
  return resolveDiagram2Dialog(dialog, {
    cancelSelector: "[data-diagram2-field-mapping-image-cancel]",
    focusSelector: "[data-diagram2-field-mapping-image]",
    submitSelector: "[data-diagram2-field-mapping-image-form]",
    value: () => images.find(image => image.id === dialog.querySelector("[data-diagram2-field-mapping-image]")?.value) || null
  });
}

export function diagram2TemplatePaneHtml(templateStateInput = {}, state = null, selectedObjectIds = []) {
  const templateState = templateStateInput && typeof templateStateInput === "object" ? templateStateInput : {};
  const library = templateState.library && typeof templateState.library === "object"
    ? templateState.library
    : { templates: [], defaults: {} };
  const templates = Array.isArray(library.templates) ? library.templates : [];
  const selected = Array.isArray(selectedObjectIds) ? selectedObjectIds : [];
  const selectedObjects = (Array.isArray(state?.objects) ? state.objects : [])
    .filter(object => selected.includes(String(object.id || "")));
  const selectedRectangle = selectedObjects.length === 1 && selectedObjects[0]?.type === "rectangle";
  const selectedArrow = selectedObjects.length === 1 && selectedObjects[0]?.type === "arrow";
  const disabled = templateState.loaded === true && templateState.busy !== true ? "" : "disabled";
  const templateCards = templates.length
    ? templates.map((template, index) => diagram2TemplateCardHtml(template, index, templates.length)).join("")
    : `<p class="image-annotation-template-empty">No saved templates yet.</p>`;

  return `
    <aside class="diagram2-editor-left-pane diagram2-template-pane" data-diagram2-left-pane data-diagram2-left-pane-name="templates" data-diagram2-template-pane aria-label="Diagram 2 templates">
      <div class="diagram2-editor-left-pane-scroll">
        <div class="image-annotation-template-actions" role="toolbar" aria-label="Template actions">
          <button type="button" data-action="save-diagram2-selection-template" data-diagram2-requires-selection data-diagram2-requires-update ${disabled}>Save Selection</button>
          <button type="button" data-action="upload-diagram2-template" ${disabled}>Upload</button>
          <button type="button" data-action="restore-diagram2-default-templates" ${disabled} ${templateState.defaultLoaded === true ? "" : "disabled"}>Restore Defaults</button>
          <input type="file" accept=".json,.pmt-template.json,application/json" data-diagram2-template-upload-input hidden multiple>
        </div>
        <div class="image-annotation-template-actions diagram2-default-actions" role="toolbar" aria-label="Drawing defaults">
          <button type="button" data-action="set-diagram2-rectangle-default" data-diagram2-requires-update ${selectedRectangle ? "" : "disabled"}>Use Rectangle</button>
          <button type="button" data-action="reset-diagram2-rectangle-default" data-diagram2-requires-update ${library.defaults?.rectangle ? "" : "disabled"}>Reset Rectangle</button>
          <button type="button" data-action="set-diagram2-arrow-default" data-diagram2-requires-update ${selectedArrow ? "" : "disabled"}>Use Arrow</button>
          <button type="button" data-action="reset-diagram2-arrow-default" data-diagram2-requires-update ${library.defaults?.arrow ? "" : "disabled"}>Reset Arrow</button>
        </div>
        <p class="image-annotation-template-status" data-diagram2-template-status>${escapeHtml(templateState.message || templateState.error || "")}</p>
        <div class="image-annotation-template-list" data-diagram2-template-list>
          ${templateCards}
        </div>
      </div>
      ${diagram2LeftPaneResizerHtml("Templates")}
    </aside>
  `;
}

export function diagram2MappingPaneHtml(stateInput = null, options = {}) {
  const indexes = options.indexes?.mappingsById instanceof Map
    ? options.indexes
    : createDiagram2FieldMappingIndexes(stateInput?.objects || []);
  const search = String(options.search || "");
  const groupByTable = options.groupByTable === true;
  const alphabetical = options.alphabetical === true;
  const groups = diagram2FieldMappingPaneGroups(indexes, { search, groupByTable, alphabetical });
  const mappingCount = indexes.mappingsById.size;
  const visibleCount = groups.reduce((total, group) => total + group.rows.length, 0);
  const content = groups.length
    ? groups.map(diagram2MappingPaneGroupHtml).join("")
    : `<p class="diagram2-mapping-pane-empty">${mappingCount ? "No mappings match your search." : "No UI to database field mappings."}</p>`;
  const countText = search.trim()
    ? `${visibleCount} of ${mappingCount}`
    : `${mappingCount} ${mappingCount === 1 ? "mapping" : "mappings"}`;
  const downloadDisabled = mappingCount ? "" : "disabled";

  return `
    <aside class="diagram2-editor-left-pane diagram2-mapping-pane" data-diagram2-left-pane data-diagram2-left-pane-name="mapping" data-diagram2-mapping-pane data-diagram2-mapping-count="${mappingCount}" data-diagram2-mapping-visible-count="${visibleCount}" aria-label="UI to database field mapping">
      <div class="diagram2-editor-left-pane-scroll">
        <div class="diagram2-editor-pane-title">
          <h3>Mapping</h3>
          <span>${escapeHtml(countText)}</span>
        </div>
        <div class="diagram2-mapping-pane-controls">
          <label class="field diagram2-mapping-pane-search">
            <span>Search</span>
            <input type="search" value="${escapeAttr(search)}" placeholder="UI or database field" autocomplete="off" data-diagram2-mapping-search>
          </label>
          <div class="diagram2-mapping-pane-options">
            <label class="diagram2-mapping-pane-group-toggle">
              <input type="checkbox" data-diagram2-mapping-group-by-table ${groupByTable ? "checked" : ""}>
              <span>Group by table</span>
            </label>
            <label class="diagram2-mapping-pane-group-toggle">
              <input type="checkbox" data-diagram2-mapping-alphabetical ${alphabetical ? "checked" : ""}>
              <span>Alphabetical</span>
            </label>
          </div>
        </div>
        <div class="diagram2-mapping-pane-column-headers" data-diagram2-mapping-column-headers>
          <span class="diagram2-mapping-pane-column-header is-ui-field">
            <span data-diagram2-mapping-ui-column-label>UI Field</span>
            <span class="diagram2-mapping-pane-column-resizer" data-diagram2-mapping-column-resizer role="separator" aria-orientation="vertical" aria-label="Resize UI Field column" title="Resize UI Field column" tabindex="0"></span>
          </span>
          <span class="diagram2-mapping-pane-column-header">Database Field</span>
        </div>
        <div class="diagram2-mapping-pane-list" role="list">
          ${content}
        </div>
        <footer class="diagram2-mapping-pane-downloads" data-diagram2-mapping-downloads aria-label="Download field mapping">
          <button type="button" class="secondary text-icon-button" data-diagram2-download-field-mapping="csv" title="Download field mapping as CSV" ${downloadDisabled}>${buttonContent(exportIconHtml(), "Download as CSV")}</button>
          <button type="button" class="secondary text-icon-button" data-diagram2-download-field-mapping="xlsx" title="Download field mapping as Excel" ${downloadDisabled}>${buttonContent(exportIconHtml(), "Download as Excel")}</button>
        </footer>
      </div>
      ${diagram2LeftPaneResizerHtml("Mapping")}
    </aside>
  `;
}

export function downloadDiagram2FieldMappings(indexes, formatInput = "csv", options = {}) {
  const rows = diagram2FieldMappingExportRows(indexes, {
    groupByTable: options.groupByTable === true,
    alphabetical: options.alphabetical === true
  });
  if (!rows.length) return false;

  const columns = [
    { header: "UI Field", value: row => row.uiField },
    { header: "Database Field", value: row => row.databaseField }
  ];
  const format = String(formatInput || "csv").toLowerCase() === "xlsx" ? "xlsx" : "csv";
  const filename = exportFileName("pmt-field-mapping", format);
  if (format === "xlsx") downloadXlsx(filename, "Field Mapping", columns, rows);
  else downloadCsv(filename, columns, rows);
  return true;
}

function diagram2MappingPaneGroupHtml(group) {
  return `
    <section class="diagram2-mapping-pane-group" data-diagram2-mapping-pane-group="${escapeAttr(group.id)}" role="listitem">
      ${group.name ? `<h4>${escapeHtml(group.name)}</h4>` : ""}
      <div class="diagram2-mapping-pane-rows">
        ${group.rows.map(diagram2MappingPaneRowHtml).join("")}
      </div>
    </section>
  `;
}

function diagram2MappingPaneRowHtml(row) {
  const commonAttributes = `data-diagram2-field-mapping-cell="true" data-diagram2-mapping-pane-field data-diagram2-field-mapping-id="${escapeAttr(row.mappingId)}" data-diagram2-field-mapping-table-id="${escapeAttr(row.tableId)}"`;
  return `
    <div class="diagram2-mapping-pane-row" data-diagram2-mapping-pane-row data-diagram2-field-mapping-id="${escapeAttr(row.mappingId)}" data-diagram2-field-mapping-table-id="${escapeAttr(row.tableId)}" role="group" aria-label="${escapeAttr(`${row.uiField} maps to ${row.databaseField}`)}">
      <button type="button" class="diagram2-mapping-pane-field" ${commonAttributes} data-diagram2-field-mapping-cell-kind="ui" aria-label="Select UI field ${escapeAttr(row.uiField)}">
        <span class="diagram2-mapping-pane-field-value">${escapeHtml(row.uiField)}</span>
      </button>
      <button type="button" class="diagram2-mapping-pane-field" ${commonAttributes} data-diagram2-field-mapping-cell-kind="database" aria-label="Select database field ${escapeAttr(row.databaseField)}">
        <span class="diagram2-mapping-pane-field-value">${escapeHtml(row.databaseField)}</span>
      </button>
    </div>
  `;
}

export async function copyDiagram2SelectionArtwork(state, selectedObjectIds, format = "svg") {
  const ids = Array.isArray(selectedObjectIds) ? selectedObjectIds.filter(Boolean) : [];
  if (!ids.length) return false;
  const svg = await buildPortableAnnotationSelectionSvg(state, ids);
  if (!svg) return false;
  if (format === "image") {
    const dimensions = diagram2SelectionSvgDimensions(svg);
    await copyAnnotationPngToClipboard({ svg, ...dimensions });
  } else {
    await copyAnnotationSvgToClipboard(svg);
  }
  return true;
}

export function updateDiagram2ShellStatus(root, status = {}) {
  if (!root) return;
  const canEdit = status.canEdit !== false;
  const canCreate = status.canCreate !== false && status.security?.canCreate !== false;
  const canExport = status.canExport !== false;
  const hasDocument = status.hasDocument !== false && status.canRead !== false;
  const selectedText = status.selectedCount
    ? `${status.selectedCount} selected`
    : "No selection";
  root.querySelectorAll("[data-diagram2-edit-state]").forEach(node => {
    node.textContent = selectedText;
  });
  root.querySelectorAll("[data-diagram2-shell-save-state]").forEach(node => {
    node.textContent = status.busy ? "Saving..." : (status.dirty ? "Unsaved changes" : "Saved");
  });
  root.querySelectorAll("[data-diagram2-selected-count]").forEach(node => {
    node.textContent = String(status.selectedCount || 0);
  });
  root.classList.toggle("has-unsaved-diagram2", status.dirty === true);
  root.querySelectorAll("[data-diagram2-tool]").forEach(button => {
    button.classList.toggle("is-active", button.dataset.diagram2Tool === status.activeTool);
    button.setAttribute("aria-pressed", String(button.dataset.diagram2Tool === status.activeTool));
  });
  root.querySelectorAll("[data-diagram2-workspace], [data-diagram2-viewer-canvas]").forEach(node => {
    node.dataset.diagram2ActiveTool = status.activeTool || "select";
  });
  root.querySelectorAll("[data-diagram2-requires-document]").forEach(control => {
    control.disabled = !hasDocument || status.busy === true;
  });
  root.querySelectorAll("[data-diagram2-requires-export]").forEach(control => {
    control.disabled = canExport === false || status.busy === true;
  });
  root.querySelectorAll("[data-diagram2-requires-create]").forEach(control => {
    control.disabled = canCreate === false || status.busy === true;
  });
  root.querySelectorAll("[data-diagram2-requires-update]").forEach(control => {
    control.disabled = canEdit === false || status.busy === true;
  });
  root.querySelectorAll("[data-diagram2-requires-dirty]").forEach(control => {
    control.disabled = !status.dirty || status.busy === true || status.canSave === false || canEdit === false;
  });
  root.querySelectorAll("[data-diagram2-requires-selection]").forEach(control => {
    control.disabled = !status.selectedCount || status.busy === true;
  });
  root.querySelectorAll("[data-diagram2-requires-multi-selection]").forEach(control => {
    control.disabled = Number(status.selectedCount || 0) < 2 || status.busy === true;
  });
  root.querySelectorAll("[data-diagram2-requires-undo]").forEach(control => {
    control.disabled = !status.history?.canUndo || status.busy === true || canEdit === false;
  });
  root.querySelectorAll("[data-diagram2-requires-redo]").forEach(control => {
    control.disabled = !status.history?.canRedo || status.busy === true || canEdit === false;
  });
  root.querySelectorAll("[data-diagram2-pending-command]").forEach(control => {
    control.disabled = true;
  });
  root.querySelectorAll("[data-filter='diagram2-grid']").forEach(control => {
    control.checked = status.gridVisible === true;
  });
  root.querySelectorAll("[data-filter='diagram2-snap']").forEach(control => {
    control.checked = status.snapToGrid === true;
  });
  const hasSelection = Number(status.selectedCount || 0) > 0;
  const selectedObjects = Array.isArray(status.selectedObjects) ? status.selectedObjects : [];
  const singleObject = selectedObjects.length === 1 ? selectedObjects[0] : null;
  const singleImage = singleObject?.type === "embedded-image" ? singleObject : null;
  const singleFieldRectangle = isDiagram2FieldRectangle(singleObject) ? singleObject : null;
  const mappingImages = diagram2FieldMappingImages(status.state);
  root.querySelectorAll("[data-diagram2-empty-selection]").forEach(node => {
    node.hidden = hasSelection;
  });
  root.querySelectorAll("[data-diagram2-selection-format]").forEach(node => {
    node.hidden = !hasSelection;
  });
  root.querySelectorAll("[data-diagram2-requires-image]").forEach(control => {
    control.disabled = !canEdit || status.busy === true || !singleImage || singleImage.locked === true;
  });
  root.querySelectorAll("[data-diagram2-requires-field-rectangle]").forEach(control => {
    control.disabled = !canEdit || status.busy === true || !singleFieldRectangle || singleFieldRectangle.locked === true;
  });
  root.querySelectorAll("[data-diagram2-requires-mapping-image]").forEach(control => {
    control.disabled = !canEdit || status.busy === true || !mappingImages.length;
  });
  syncDiagram2FormatControls(root, selectedObjects, { busy: status.busy === true, canEdit });
  syncDiagram2GeometryControls(root, selectedObjects, { busy: status.busy === true, canEdit });
  syncDiagram2CropControls(root, singleImage, { busy: status.busy === true, canEdit });
  syncDiagram2EntityControls(root, status, { busy: status.busy === true, canEdit });
  syncDiagram2FieldRectangleControls(root, singleFieldRectangle, { busy: status.busy === true, canEdit });
  syncDiagram2ColorPickerControls(root, selectedObjects, { busy: status.busy === true, canEdit });
  syncDiagram2InspectorTabVisibility(root, selectedObjects);
  syncDiagram2ContextMenu(root, selectedObjects, { busy: status.busy === true, canEdit, canExport });
}

export function updateDiagram2RouteCommitShellStatus(root, status = {}) {
  if (!root) return;
  const dirty = status.dirty === true;
  const busy = status.busy === true;
  const canEdit = status.canEdit !== false;
  const selectedText = status.selectedCount
    ? `${status.selectedCount} selected`
    : "No selection";
  root.querySelectorAll("[data-diagram2-edit-state]").forEach(node => {
    node.textContent = selectedText;
  });
  root.querySelectorAll("[data-diagram2-shell-save-state]").forEach(node => {
    node.textContent = busy ? "Saving..." : (dirty ? "Unsaved changes" : "Saved");
  });
  root.querySelectorAll("[data-diagram2-selected-count]").forEach(node => {
    node.textContent = String(status.selectedCount || 0);
  });
  root.classList.toggle("has-unsaved-diagram2", dirty);
  root.querySelectorAll("[data-diagram2-requires-dirty]").forEach(control => {
    control.disabled = !dirty || busy || status.canSave === false || !canEdit;
  });
  root.querySelectorAll("[data-diagram2-requires-undo]").forEach(control => {
    control.disabled = status.history?.canUndo !== true || busy || !canEdit;
  });
  root.querySelectorAll("[data-diagram2-requires-redo]").forEach(control => {
    control.disabled = status.history?.canRedo !== true || busy || !canEdit;
  });
  syncDiagram2EntityControls(root, {
    ...status,
    selectedObjects: status.selectedRelationships || [],
    state: status.state || {}
  }, { busy, canEdit });
}

export function setDiagram2ToolsPaneOpen(root, open) {
  return setDiagram2LeftPaneMode(root, "tools", open);
}

export function setDiagram2ObjectsPaneOpen(root, open) {
  return setDiagram2LeftPaneMode(root, "objects", open);
}

export function setDiagram2TemplatesPaneOpen(root, open) {
  return setDiagram2LeftPaneMode(root, "templates", open);
}

export function setDiagram2MappingPaneOpen(root, open) {
  const nextOpen = setDiagram2LeftPaneMode(root, "mapping", open);
  if (nextOpen) syncDiagram2MappingPaneColumnWidth(root);
  return nextOpen;
}

export function syncDiagram2RendererViewportInset(root, renderer, options = {}) {
  if (!renderer || typeof renderer.setViewportInset !== "function") return false;
  const shell = root?.matches?.("[data-diagram2-editor-shell], [data-diagram2-readonly-shell], [data-diagram2-linked-shell]")
    ? root
    : root?.querySelector?.("[data-diagram2-editor-shell], [data-diagram2-readonly-shell], [data-diagram2-linked-shell]");
  const main = shell?.querySelector?.("[data-diagram2-editor-main], [data-diagram2-readonly-main], [data-diagram2-linked-main]");
  const surface = shell?.querySelector?.("[data-diagram2-renderer-surface]");
  const surfaceRect = surface?.getBoundingClientRect?.();
  const linkedViewer = main?.matches?.("[data-diagram2-linked-main]") === true;
  let left = 0;
  let paneWidth = 0;

  if (!linkedViewer && main?.classList.contains("is-left-pane-open") && surfaceRect?.width) {
    const mode = String(main.dataset.diagram2LeftPaneMode || "").trim();
    const pane = [...main.querySelectorAll("[data-diagram2-left-pane]")]
      .find(candidate => candidate.dataset.diagram2LeftPaneName === mode);
    const paneRect = pane?.getBoundingClientRect?.();
    paneWidth = Math.max(0, Math.round(paneRect?.width || 0));
    if (paneRect && paneRect.right > surfaceRect.left && paneRect.left < surfaceRect.right) {
      left = clampDiagram2Number(paneRect.right - surfaceRect.left, 0, surfaceRect.width - 1);
    }
  }

  main?.style.setProperty("--diagram2-active-left-pane-width", `${paneWidth}px`);
  main?.style.setProperty("--diagram2-active-left-pane-inset", `${Math.round(left)}px`);
  renderer.setViewportInset({
    left: Math.round(left),
    top: 0,
    right: 0,
    bottom: 0
  }, options);
  return true;
}

function setDiagram2LeftPaneMode(root, modeInput, open) {
  if (!root) return false;
  const shell = root.matches?.("[data-diagram2-editor-shell], [data-diagram2-readonly-shell], [data-diagram2-linked-shell]")
    ? root
    : root.querySelector?.("[data-diagram2-editor-shell], [data-diagram2-readonly-shell], [data-diagram2-linked-shell]");
  const main = shell?.querySelector?.("[data-diagram2-editor-main], [data-diagram2-readonly-main], [data-diagram2-linked-main]");
  if (!shell || !main) return false;
  const requestedMode = String(modeInput || "tools").trim();
  const mode = ["tools", "objects", "templates", "mapping"].includes(requestedMode) ? requestedMode : "tools";
  const currentMode = String(main.dataset.diagram2LeftPaneMode || "tools");
  const nextOpen = open === undefined
    ? !(main.classList.contains("is-left-pane-open") && currentMode === mode)
    : open === true;
  main.dataset.diagram2LeftPaneMode = mode;
  main.classList.toggle("is-left-pane-open", nextOpen);
  main.classList.toggle("is-tools-open", nextOpen && mode === "tools");
  main.classList.toggle("is-objects-open", nextOpen && mode === "objects");
  main.classList.toggle("is-templates-open", nextOpen && mode === "templates");
  main.classList.toggle("is-mapping-open", nextOpen && mode === "mapping");
  shell.querySelectorAll("[data-diagram2-left-pane-toggle]").forEach(button => {
    const active = nextOpen && button.dataset.diagram2LeftPaneToggle === mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-expanded", String(active));
    button.setAttribute("aria-pressed", String(active));
  });
  return nextOpen;
}

export function bindDiagram2EditorInspectorResize(root, options = {}) {
  const shell = root?.matches?.("[data-diagram2-editor-shell]")
    ? root
    : root?.querySelector?.("[data-diagram2-editor-shell]");
  if (!shell || shell.dataset.diagram2InspectorResizeBound === "true") return;
  const main = shell.querySelector("[data-diagram2-editor-main]");
  const inspector = shell.querySelector("[data-diagram2-inspector]");
  const splitter = shell.querySelector("[data-diagram2-inspector-splitter]");
  if (!main || !inspector || !splitter) return;
  shell.dataset.diagram2InspectorResizeBound = "true";

  let inspectorWidth = diagram2CurrentInspectorWidth(main, inspector);
  let finishResize = () => {};

  const inspectorWidthLimits = () => {
    const mainWidth = Math.max(1, main.getBoundingClientRect().width || window.innerWidth || 1);
    const maximum = Math.max(300, Math.floor(mainWidth * 0.5));
    return {
      minimum: 300,
      maximum
    };
  };

  const setInspectorWidth = value => {
    const limits = inspectorWidthLimits();
    inspectorWidth = Math.round(clampDiagram2Number(value, limits.minimum, limits.maximum));
    main.style.setProperty("--image-annotation-inspector-width", `${inspectorWidth}px`);
    splitter.setAttribute("aria-valuemin", String(limits.minimum));
    splitter.setAttribute("aria-valuemax", String(limits.maximum));
    splitter.setAttribute("aria-valuenow", String(inspectorWidth));
    options.onResize?.(inspectorWidth);
  };

  const beginResize = event => {
    if (main.classList.contains("is-inspector-hidden") || window.matchMedia("(max-width: 900px)").matches) return;
    event.preventDefault();
    finishResize();
    const startX = Number(event.clientX || 0);
    const startWidth = inspector.getBoundingClientRect().width || inspectorWidth;
    const resizeClassTarget = shell.closest(".dialog") || shell;
    resizeClassTarget.classList.add("is-resizing-inspector");
    shell.classList.add("is-resizing-inspector");
    splitter.setPointerCapture?.(event.pointerId);

    const resize = moveEvent => {
      setInspectorWidth(startWidth + startX - Number(moveEvent.clientX || 0));
    };
    finishResize = () => {
      resizeClassTarget.classList.remove("is-resizing-inspector");
      shell.classList.remove("is-resizing-inspector");
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", finishResize);
      window.removeEventListener("pointercancel", finishResize);
      finishResize = () => {};
    };
    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", finishResize);
    window.addEventListener("pointercancel", finishResize);
  };

  splitter.addEventListener("pointerdown", beginResize);
  splitter.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const limits = inspectorWidthLimits();
    if (event.key === "Home") setInspectorWidth(limits.minimum);
    else if (event.key === "End") setInspectorWidth(limits.maximum);
    else setInspectorWidth(inspectorWidth + (event.key === "ArrowLeft" ? 24 : -24));
  });

  setInspectorWidth(inspectorWidth);
}

export function bindDiagram2EditorLeftPaneResize(root, options = {}) {
  const shell = root?.matches?.("[data-diagram2-editor-shell], [data-diagram2-readonly-shell], [data-diagram2-linked-shell]")
    ? root
    : root?.querySelector?.("[data-diagram2-editor-shell], [data-diagram2-readonly-shell], [data-diagram2-linked-shell]");
  if (!shell || shell.dataset.diagram2LeftPaneResizeBound === "true") return;
  const main = shell.querySelector("[data-diagram2-editor-main], [data-diagram2-readonly-main], [data-diagram2-linked-main]");
  if (!main) return;
  shell.dataset.diagram2LeftPaneResizeBound = "true";

  let finishResize = () => {};
  const paneModes = ["tools", "objects", "templates", "mapping"];

  const leftPaneWidthLimits = mode => {
    const mainWidth = Math.max(1, main.getBoundingClientRect().width || window.innerWidth || 1);
    if (normalizeDiagram2LeftPaneMode(mode) === "mapping") {
      return {
        minimum: 200,
        maximum: Math.min(600, Math.max(200, Math.floor(mainWidth - 120)))
      };
    }
    return {
      minimum: 196,
      maximum: Math.max(196, Math.floor(mainWidth * 0.5))
    };
  };

  const setLeftPaneWidth = (mode, value) => {
    const paneMode = normalizeDiagram2LeftPaneMode(mode);
    const limits = leftPaneWidthLimits(paneMode);
    const width = Math.round(clampDiagram2Number(value, limits.minimum, limits.maximum));
    main.style.setProperty(diagram2LeftPaneWidthProperty(paneMode), `${width}px`);
    main.querySelectorAll(`[data-diagram2-left-pane-name="${paneMode}"] [data-diagram2-left-pane-resizer]`).forEach(resizer => {
      resizer.setAttribute("aria-valuemin", String(limits.minimum));
      resizer.setAttribute("aria-valuemax", String(limits.maximum));
      resizer.setAttribute("aria-valuenow", String(width));
    });
    if (paneMode === "mapping") syncDiagram2MappingPaneColumnWidth(shell);
    options.onResize?.(width, paneMode);
    return width;
  };

  main.addEventListener("pointerdown", event => {
    const mappingColumnResizer = event.target?.closest?.("[data-diagram2-mapping-column-resizer]");
    if (mappingColumnResizer && main.contains(mappingColumnResizer)) {
      event.preventDefault();
      event.stopPropagation();
      finishResize();
      const startX = Number(event.clientX || 0);
      const startWidth = syncDiagram2MappingPaneColumnWidth(shell, { auto: false });
      shell.classList.add("is-resizing-mapping-column");
      mappingColumnResizer.setPointerCapture?.(event.pointerId);

      const resize = moveEvent => {
        syncDiagram2MappingPaneColumnWidth(shell, {
          auto: false,
          manual: true,
          width: startWidth + Number(moveEvent.clientX || 0) - startX
        });
      };
      finishResize = () => {
        shell.classList.remove("is-resizing-mapping-column");
        window.removeEventListener("pointermove", resize);
        window.removeEventListener("pointerup", finishResize);
        window.removeEventListener("pointercancel", finishResize);
        finishResize = () => {};
      };
      window.addEventListener("pointermove", resize);
      window.addEventListener("pointerup", finishResize);
      window.addEventListener("pointercancel", finishResize);
      return;
    }

    const resizer = event.target?.closest?.("[data-diagram2-left-pane-resizer]");
    if (!resizer || !main.contains(resizer) || !main.classList.contains("is-left-pane-open")) return;
    event.preventDefault();
    finishResize();
    const pane = resizer.closest("[data-diagram2-left-pane]");
    const paneMode = normalizeDiagram2LeftPaneMode(pane?.dataset?.diagram2LeftPaneName || main.dataset.diagram2LeftPaneMode);
    const startX = Number(event.clientX || 0);
    const startWidth = diagram2CurrentLeftPaneWidth(main, paneMode);
    const resizeClassTarget = shell.closest(".dialog") || shell;
    resizeClassTarget.classList.add("is-resizing-left-pane");
    shell.classList.add("is-resizing-left-pane");
    resizer.setPointerCapture?.(event.pointerId);

    const resize = moveEvent => {
      setLeftPaneWidth(paneMode, startWidth + Number(moveEvent.clientX || 0) - startX);
    };
    finishResize = () => {
      resizeClassTarget.classList.remove("is-resizing-left-pane");
      shell.classList.remove("is-resizing-left-pane");
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", finishResize);
      window.removeEventListener("pointercancel", finishResize);
      finishResize = () => {};
    };
    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", finishResize);
    window.addEventListener("pointercancel", finishResize);
  });

  main.addEventListener("keydown", event => {
    const mappingColumnResizer = event.target?.closest?.("[data-diagram2-mapping-column-resizer]");
    if (mappingColumnResizer && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const limits = diagram2MappingPaneColumnWidthLimits(main);
      const currentWidth = syncDiagram2MappingPaneColumnWidth(shell, { auto: false });
      const width = event.key === "Home"
        ? limits.minimum
        : event.key === "End"
          ? limits.maximum
          : currentWidth + (event.key === "ArrowRight" ? 16 : -16);
      syncDiagram2MappingPaneColumnWidth(shell, { auto: false, manual: true, width });
      return;
    }

    const resizer = event.target?.closest?.("[data-diagram2-left-pane-resizer]");
    if (!resizer || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const pane = resizer.closest("[data-diagram2-left-pane]");
    const paneMode = normalizeDiagram2LeftPaneMode(pane?.dataset?.diagram2LeftPaneName || main.dataset.diagram2LeftPaneMode);
    const limits = leftPaneWidthLimits(paneMode);
    const currentWidth = diagram2CurrentLeftPaneWidth(main, paneMode);
    if (event.key === "Home") setLeftPaneWidth(paneMode, limits.minimum);
    else if (event.key === "End") setLeftPaneWidth(paneMode, limits.maximum);
    else setLeftPaneWidth(paneMode, currentWidth + (event.key === "ArrowRight" ? 24 : -24));
  });

  paneModes.forEach(mode => setLeftPaneWidth(mode, diagram2CurrentLeftPaneWidth(main, mode)));
  syncDiagram2MappingPaneColumnWidth(shell);
}

export function syncDiagram2MappingPaneColumnWidth(root, options = {}) {
  const shell = root?.matches?.("[data-diagram2-editor-shell], [data-diagram2-readonly-shell], [data-diagram2-linked-shell]")
    ? root
    : root?.querySelector?.("[data-diagram2-editor-shell], [data-diagram2-readonly-shell], [data-diagram2-linked-shell]");
  const main = shell?.querySelector?.("[data-diagram2-editor-main], [data-diagram2-readonly-main], [data-diagram2-linked-main]");
  const pane = main?.querySelector?.("[data-diagram2-mapping-pane]");
  if (!main || !pane) return 0;

  if (options.manual === true) main.dataset.diagram2MappingUiColumnManual = "true";
  const limits = diagram2MappingPaneColumnWidthLimits(main);
  const currentWidth = Number.parseFloat(main.style.getPropertyValue("--diagram2-mapping-ui-column-width"));
  const shouldAutoSize = options.auto !== false && main.dataset.diagram2MappingUiColumnManual !== "true";
  const requestedWidth = Number(options.width);
  const width = Math.round(clampDiagram2Number(
    Number.isFinite(requestedWidth)
      ? requestedWidth
      : shouldAutoSize || !Number.isFinite(currentWidth)
        ? diagram2MappingPaneAutoColumnWidth(pane)
        : currentWidth,
    limits.minimum,
    limits.maximum
  ));
  main.style.setProperty("--diagram2-mapping-ui-column-width", `${width}px`);
  pane.querySelectorAll("[data-diagram2-mapping-column-resizer]").forEach(resizer => {
    resizer.setAttribute("aria-valuemin", String(limits.minimum));
    resizer.setAttribute("aria-valuemax", String(limits.maximum));
    resizer.setAttribute("aria-valuenow", String(width));
  });
  return width;
}

function diagram2MappingPaneColumnWidthLimits(main) {
  const pane = main?.querySelector?.("[data-diagram2-mapping-pane]");
  const paneWidth = Math.max(
    200,
    Math.round(pane?.getBoundingClientRect?.().width || diagram2CurrentLeftPaneWidth(main, "mapping") || 320)
  );
  return {
    minimum: 72,
    maximum: Math.max(72, paneWidth - 112)
  };
}

function diagram2MappingPaneAutoColumnWidth(pane) {
  const label = pane.querySelector("[data-diagram2-mapping-ui-column-label]");
  const values = [...pane.querySelectorAll("[data-diagram2-field-mapping-cell-kind='ui'] .diagram2-mapping-pane-field-value")];
  const documentRef = pane.ownerDocument;
  const view = documentRef?.defaultView;
  const context = documentRef?.createElement?.("canvas")?.getContext?.("2d");
  const measure = node => {
    const text = String(node?.textContent || "").trim();
    if (!text) return 0;
    const style = view?.getComputedStyle?.(node);
    if (context && style) {
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      return context.measureText(text).width;
    }
    return text.length * 7;
  };
  const longestText = Math.max(measure(label), ...values.map(measure), 0);
  return Math.ceil(longestText + 28);
}

function normalizeDiagram2TextEditorHtml(value) {
  const source = String(value || "").trim() || "<p><br></p>";
  try {
    return normalizeRichHtml(source) || "<p><br></p>";
  } catch {
    return source
      .replace(/<script\b[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[\s\S]*?<\/style>/gi, "")
      .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .slice(0, 200000) || "<p><br></p>";
  }
}

export function setDiagram2InspectorActiveTab(root, tabName) {
  if (!root) return "";
  const tabs = [...root.querySelectorAll("[data-diagram2-inspector-tab]")];
  const visibleTabs = tabs.filter(tab => !tab.hidden);
  if (!visibleTabs.length) return "";
  const requested = String(tabName || "").trim();
  const activeTab = visibleTabs.find(tab => tab.dataset.diagram2InspectorTab === requested)
    || visibleTabs.find(tab => tab.getAttribute("aria-selected") === "true")
    || visibleTabs[0];
  const activeName = activeTab.dataset.diagram2InspectorTab || "format";

  tabs.forEach(tab => {
    const selected = tab === activeTab;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  root.querySelectorAll("[data-diagram2-inspector-panel]").forEach(panel => {
    panel.hidden = panel.dataset.diagram2InspectorPanel !== activeName;
  });
  return activeName;
}

export function updateDiagram2ObjectTreeSelection(root, selectedObjectIds = []) {
  const selected = new Set(selectedObjectIds.map(String));
  root?.querySelectorAll?.("[data-diagram2-object-tree-row]").forEach(row => {
    const isSelected = selected.has(String(row.dataset.objectId || row.dataset.diagram2ObjectId || ""));
    row.classList.toggle("is-selected", isSelected);
    row.setAttribute("aria-selected", String(isSelected));
  });
}

export function openDiagram2CompactProgress(root) {
  const shell = root?.matches?.("[data-diagram2-editor-shell]")
    ? root
    : root?.querySelector?.("[data-diagram2-editor-shell]");
  if (!shell) return null;
  shell.querySelector("[data-diagram2-compact-progress]")?.remove();
  const abortController = new AbortController();
  const overlay = shell.ownerDocument.createElement("div");
  overlay.className = "diagram2-compact-progress";
  overlay.dataset.diagram2CompactProgress = "true";
  overlay.innerHTML = `
    <div class="diagram2-compact-progress-panel" role="status" aria-live="polite">
      <strong data-diagram2-compact-phase>Analyzing Entities</strong>
      <progress max="100" value="0" data-diagram2-compact-bar></progress>
      <span data-diagram2-compact-detail>0% - 0.0s</span>
      <button type="button" data-diagram2-compact-cancel>Cancel</button>
    </div>
  `;
  overlay.querySelector("[data-diagram2-compact-cancel]")?.addEventListener("click", () => {
    abortController.abort();
    update({
      phase: "Canceling",
      percent: 100,
      elapsedMs: 0
    });
  });
  shell.appendChild(overlay);

  const update = progress => {
    const phase = String(progress?.phase || "Analyzing Entities");
    const percent = clampDiagram2Number(Number(progress?.percent || 0), 0, 100);
    const elapsedSeconds = Math.max(0, Number(progress?.elapsedMs || 0) / 1000);
    overlay.querySelector("[data-diagram2-compact-phase]").textContent = phase;
    overlay.querySelector("[data-diagram2-compact-bar]").value = percent;
    overlay.querySelector("[data-diagram2-compact-detail]").textContent = `${Math.round(percent)}% - ${elapsedSeconds.toFixed(1)}s`;
  };

  return {
    signal: abortController.signal,
    update,
    close() {
      overlay.remove();
    }
  };
}

export function bindDiagram2EditorColorPickers(root, options = {}) {
  if (!root) return;
  renderDiagram2ColorMemory(root);
  if (root.dataset.diagram2ColorPickersBound === "true") return;
  root.dataset.diagram2ColorPickersBound = "true";

  let previewCleanup = null;
  let previewSwatch = null;
  const clearPreview = () => {
    const cleanup = previewCleanup;
    previewCleanup = null;
    previewSwatch = null;
    if (typeof cleanup === "function") cleanup();
  };
  const commitPreview = () => {
    const cleanup = previewCleanup;
    previewCleanup = null;
    previewSwatch = null;
    return cleanup;
  };
  const pickerForSwatch = swatch => {
    const picker = swatch?.closest?.("[data-annotation-color-picker]");
    if (picker) return picker;
    const recentColors = swatch?.closest?.("[data-annotation-recent-colors]");
    return recentColors
      ? root.querySelector(`[data-annotation-color-picker='${cssEscapeSelector(recentColors.dataset.annotationRecentColors || "")}']`)
      : null;
  };
  const preview = swatch => {
    if (!swatch || previewSwatch === swatch || typeof options.previewColor !== "function") return;
    const picker = pickerForSwatch(swatch);
    const name = picker?.dataset?.annotationColorPicker || "";
    const color = normalizeDiagram2PickerColor(swatch.dataset.richColorValue);
    if (!picker || !name || !color) return;
    clearPreview();
    previewSwatch = swatch;
    const cleanup = options.previewColor(name, color);
    previewCleanup = typeof cleanup === "function" ? cleanup : null;
  };

  const closeAll = except => {
    clearPreview();
    root.querySelectorAll("[data-annotation-color-picker]").forEach(tool => {
      if (tool === except) return;
      closeDiagram2ColorPicker(tool);
    });
  };

  root.addEventListener("click", event => {
    const trigger = event.target?.closest?.("[data-annotation-color-trigger]");
    if (trigger && root.contains(trigger)) {
      event.preventDefault();
      clearPreview();
      const picker = trigger.closest("[data-annotation-color-picker]");
      if (!picker) return;
      const name = picker.dataset.annotationColorPicker || "";
      const defaultColor = normalizeDiagram2PickerColor(trigger.dataset.richColorDefault) || "#111827";
      const memoryKey = diagram2ColorMemoryKey(name);
      if (diagram2ColorTriggerApplyHalf(event, trigger)) {
        void applyDiagram2PickerColor(root, picker, readDiagram2LastColor(memoryKey, trigger.dataset.richSelectedColor || defaultColor), options);
        return;
      }

      const shouldOpen = !picker.classList.contains("is-open");
      closeAll(picker);
      if (shouldOpen) openDiagram2ColorPicker(picker);
      else closeDiagram2ColorPicker(picker);
      return;
    }

    const customButton = event.target?.closest?.("[data-rich-color-custom]");
    if (customButton && root.contains(customButton)) {
      event.preventDefault();
      clearPreview();
      const picker = customButton.closest("[data-annotation-color-picker]");
      if (picker) void chooseDiagram2CustomPickerColor(root, picker, options);
      return;
    }

    const swatch = event.target?.closest?.("[data-rich-color-value]");
    if (swatch && root.contains(swatch)) {
      const targetPicker = pickerForSwatch(swatch);
      if (!targetPicker) return;
      event.preventDefault();
      const restorePreview = commitPreview();
      void applyDiagram2PickerColor(root, targetPicker, swatch.dataset.richColorValue, options)
        .then(applied => {
          if (applied === false && typeof restorePreview === "function") restorePreview();
        });
      return;
    }

    if (!event.target?.closest?.("[data-annotation-color-picker], [data-annotation-recent-colors]")) closeAll();
  });

  root.addEventListener("pointerdown", event => {
    if (!event.target?.closest?.("[data-annotation-color-picker], [data-annotation-recent-colors]")) closeAll();
  });

  root.addEventListener("pointerover", event => {
    const swatch = event.target?.closest?.("[data-rich-color-value]");
    if (swatch && root.contains(swatch)) preview(swatch);
  });

  root.addEventListener("pointerout", event => {
    const swatch = event.target?.closest?.("[data-rich-color-value]");
    if (!swatch || !root.contains(swatch) || swatch.contains(event.relatedTarget)) return;
    const relatedSwatch = event.relatedTarget?.closest?.("[data-rich-color-value]");
    if (relatedSwatch && pickerForSwatch(relatedSwatch) === pickerForSwatch(swatch)) return;
    clearPreview();
  });

  root.addEventListener("focusin", event => {
    const swatch = event.target?.closest?.("[data-rich-color-value]");
    if (swatch && root.contains(swatch)) preview(swatch);
  });

  root.addEventListener("focusout", event => {
    const swatch = event.target?.closest?.("[data-rich-color-value]");
    if (swatch && root.contains(swatch)) clearPreview();
  });

  root.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !root.querySelector("[data-annotation-color-picker].is-open")) return;
    event.preventDefault();
    event.stopPropagation();
    closeAll();
  });
}

export function bindDiagram2EditorFormatControls(root, options = {}) {
  if (!root || root.dataset.diagram2FormatControlsBound === "true") return;
  root.dataset.diagram2FormatControlsBound = "true";

  root.addEventListener("change", event => {
    const target = event.target;
    if (!target || !root.contains(target)) return;

    if (target.matches("[data-diagram2-outline]")) {
      void applyDiagram2FormatStyle(root, "outlineVisible", target.checked === true, options);
      return;
    }

    if (target.matches("[data-diagram2-transparent-fill]")) {
      const color = target.checked ? "none" : diagram2CurrentFillColor(root);
      void applyDiagram2FormatStyle(root, "fill", color, options);
      return;
    }

    const geometryControl = target.closest("[data-diagram2-geometry]");
    if (geometryControl && root.contains(geometryControl)) {
      void applyDiagram2Geometry(root, geometryControl.dataset.diagram2Geometry, geometryControl.value, options);
      return;
    }

    if (target.matches("[data-diagram2-crop-visible]")) {
      void options.setCropVisibility?.(target.checked === true);
      return;
    }

    if (target.matches("[data-diagram2-field-rectangle-name]")) {
      void options.renameFieldRectangle?.(target.value);
      return;
    }

    if (target.matches("[data-diagram2-field-rectangle-connection-side]")) {
      void options.setFieldRectangleConnectionSide?.(target.value);
      return;
    }

    const entityOptionControl = target.closest("[data-diagram2-entity-option]");
    if (entityOptionControl && root.contains(entityOptionControl)) {
      void options.applyEntityOption?.(
        entityOptionControl.dataset.diagram2EntityOption,
        entityOptionControl.checked === true
      );
      return;
    }

    const relationshipOptionControl = target.closest("[data-diagram2-relationship-option]");
    if (relationshipOptionControl && root.contains(relationshipOptionControl)) {
      void options.applyRelationshipOption?.(
        relationshipOptionControl.dataset.diagram2RelationshipOption,
        relationshipOptionControl.checked === true
      );
      return;
    }

    const relationshipStyleControl = target.closest("[data-diagram2-relationship-style]");
    if (relationshipStyleControl && root.contains(relationshipStyleControl)) {
      void options.applyRelationshipStyle?.(
        relationshipStyleControl.dataset.diagram2RelationshipStyle,
        relationshipStyleControl.checked === true
      );
      return;
    }

    const relationshipTypeControl = target.closest("[data-diagram2-relationship-type]");
    if (relationshipTypeControl && root.contains(relationshipTypeControl)) {
      void options.applyRelationshipType?.(relationshipTypeControl.value);
      return;
    }

    const entityFieldControl = target.closest("[data-diagram2-entity-field-property]");
    if (entityFieldControl && root.contains(entityFieldControl)) {
      const fieldIndex = Number.parseInt(entityFieldControl.dataset.diagram2EntityFieldIndex, 10);
      const property = entityFieldControl.dataset.diagram2EntityFieldProperty || "";
      if (!Number.isInteger(fieldIndex) || !property) return;
      const value = diagram2EntityFieldControlValue(entityFieldControl, property);
      void options.updateEntityField?.(fieldIndex, { [property]: value });
      return;
    }

    const entityFieldReference = target.closest("[data-diagram2-entity-field-reference]");
    if (entityFieldReference && root.contains(entityFieldReference)) {
      const row = entityFieldReference.closest("[data-diagram2-entity-field-row]");
      const fieldIndex = Number.parseInt(row?.dataset?.diagram2EntityFieldIndex, 10);
      if (!Number.isInteger(fieldIndex)) return;
      if (entityFieldReference.dataset.diagram2EntityFieldReference === "targetEntityId") {
        refreshDiagram2EntityFieldReferenceFields(row);
        if (!row.querySelector("[data-diagram2-entity-field-reference='targetFieldName']")?.value) return;
      }
      void options.setEntityFieldReference?.(fieldIndex, diagram2EntityFieldReferenceValue(row));
      return;
    }

    const styleControl = target.closest("[data-diagram2-style]");
    if (!styleControl || !root.contains(styleControl)) return;
    void applyDiagram2FormatStyle(root, styleControl.dataset.diagram2Style, styleControl.value, options);
  });
}

function diagram2ToolbarHtml({ canUse, includeActions, includeMappingPane, selectedZoom }) {
  const disabled = canUse ? "" : "disabled";
  return `
    <div class="image-annotation-toolbar diagram2-editor-toolbar" role="toolbar" aria-label="Diagram 2 editor controls">
      <div class="diagram2-editor-nav">
        <div class="diagram2-editor-brand" aria-label="PMT">
          <img src="${escapeAttr(appUrl("/assets/project-pmt.svg?v=20260621-transparent"))}" alt="">
          <strong>PMT</strong>
        </div>
        <button type="button" class="diagram2-left-pane-toggle is-active" data-action="toggle-diagram2-tools-pane" data-diagram2-left-pane-toggle="tools" aria-expanded="true" aria-pressed="true" title="Tools" aria-label="Tools" ${disabled}>Tools</button>
        <button type="button" class="diagram2-left-pane-toggle" data-action="toggle-diagram2-objects-pane" data-diagram2-left-pane-toggle="objects" aria-expanded="false" aria-pressed="false" title="Objects" aria-label="Objects" ${disabled}>Objects</button>
        <button type="button" class="diagram2-left-pane-toggle" data-action="toggle-diagram2-templates-pane" data-diagram2-left-pane-toggle="templates" aria-expanded="false" aria-pressed="false" title="Templates" aria-label="Templates" ${disabled}>Templates</button>
        ${includeMappingPane ? `<button type="button" class="diagram2-left-pane-toggle" data-action="toggle-diagram2-mapping-pane" data-diagram2-left-pane-toggle="mapping" aria-expanded="false" aria-pressed="false" title="Mapping" aria-label="Mapping" ${disabled}>Mapping</button>` : ""}
        <button type="button" data-action="toggle-diagram2-inspector" aria-controls="diagram2Inspector" aria-expanded="true" title="Right Pane" aria-label="Right Pane" ${disabled}>Right Pane</button>
      </div>
      <div class="image-annotation-tool-group" aria-label="History">
        ${diagram2TextButton("undo-diagram2", "Undo", "Undo (Ctrl+Z)", "data-diagram2-requires-undo data-diagram2-requires-update")}
        ${diagram2TextButton("redo-diagram2", "Redo", "Redo (Ctrl+Y)", "data-diagram2-requires-redo data-diagram2-requires-update")}
        ${diagram2TextButton("delete-diagram2-selection", "Delete", "Delete selected objects", "data-diagram2-requires-selection data-diagram2-requires-update")}
      </div>
      <div class="image-annotation-tool-group image-annotation-view-tools" aria-label="Canvas view">
        <label class="inline-check"><input type="checkbox" data-filter="diagram2-grid" data-diagram2-requires-update><span>Grid</span></label>
        <label class="inline-check"><input type="checkbox" data-filter="diagram2-snap" data-diagram2-requires-update><span>Snap</span></label>
        <button type="button" data-action="zoom-diagram2-out" title="Zoom Out" aria-label="Zoom Out" ${disabled}>-</button>
        <select data-filter="diagram2-zoom" class="image-annotation-zoom-select" aria-label="Zoom level" title="Zoom level" ${disabled}>
          ${diagram2ZoomOptionsHtml(selectedZoom)}
        </select>
        <button type="button" data-action="zoom-diagram2-in" title="Zoom In" aria-label="Zoom In" ${disabled}>+</button>
        <button type="button" data-action="fit-diagram2-viewer" title="Fit Diagram" aria-label="Fit Diagram" ${disabled}>Fit</button>
      </div>
      <span class="image-annotation-mode-indicator diagram2-editor-status" data-diagram2-save-state data-diagram2-shell-save-state role="status" aria-live="polite">Saved</span>
      ${includeActions ? `
        <div class="image-annotation-tool-group image-annotation-maximized-actions diagram2-editor-top-actions" aria-label="Editor actions">
          ${diagram2TextButton("cancel-diagram2-editor", "Close", "Close", "")}
          ${diagram2TextButton("save-diagram2-document", "Save", "Save Diagram", "data-diagram2-requires-dirty data-diagram2-requires-update")}
        </div>
      ` : ""}
    </div>
  `;
}

function diagram2LeftPaneResizerHtml(label) {
  return `<div class="diagram2-editor-left-pane-resizer" data-diagram2-left-pane-resizer role="separator" aria-orientation="vertical" aria-label="Resize ${escapeAttr(label)} pane" tabindex="0"></div>`;
}

function diagram2ToolsPaneHtml({ canUse }) {
  const disabled = canUse ? "" : "disabled";
  return `
    <aside class="diagram2-editor-left-pane diagram2-editor-tools-pane" data-diagram2-left-pane data-diagram2-left-pane-name="tools" data-diagram2-tools-pane aria-label="Diagram 2 tools">
      <div class="diagram2-editor-left-pane-scroll">
        <div class="diagram2-editor-pane-title">
          <h3>Tools</h3>
        </div>
        <div class="diagram2-tools-list" role="toolbar" aria-label="Drawing tools">
          ${diagram2ToolPaneButton("select", "Select", "Select (V)", true, disabled)}
          ${diagram2ToolPaneButton("pan", "Pan", "Pan (H)", false, disabled)}
          ${diagram2ToolPaneButton("format-painter", "Format Painter", "Format Painter", false, `${disabled} data-diagram2-requires-selection data-diagram2-requires-update`)}
          ${diagram2ToolPaneButton("crop", "Crop", "Crop (C)", false, `${disabled} data-diagram2-requires-image data-diagram2-requires-update`)}
          <div class="diagram2-tools-divider" role="separator" aria-hidden="true"></div>
          ${diagram2ToolPaneActionButton("image", "Add Image", "add-diagram2-image", `${disabled} data-diagram2-requires-update`)}
          <input type="file" accept="image/*" multiple hidden data-diagram2-image-input>
          ${diagram2ToolPaneButton("rectangle", "Rectangle", "Rectangle (R)", false, `${disabled} data-diagram2-requires-update`)}
          ${diagram2ToolPaneButton("circle", "Circle", "Circle (O)", false, `${disabled} data-diagram2-requires-update`)}
          ${diagram2ToolPaneButton("arrow", "Arrow", "Arrow (A)", false, `${disabled} data-diagram2-requires-update`)}
          ${diagram2ToolPaneButton("line", "Line", "Line (L)", false, `${disabled} data-diagram2-requires-update`)}
          ${diagram2ToolPaneButton("textbox", "Text Box", "Text Box (T)", false, `${disabled} data-diagram2-requires-update`)}
          ${diagram2ToolPaneButton("rich-text", "Rich Text Editor", "Rich Text Editor (Y)", false, `${disabled} data-diagram2-requires-update`)}
          <div class="diagram2-tools-divider" role="separator" aria-hidden="true"></div>
          ${diagram2ToolPaneButton("entity", "Entity", "Entity (E)", false, `${disabled} data-diagram2-requires-update`)}
          ${diagram2ToolPaneActionButton("arrow", "Add Relationship", "add-diagram2-relationship", `${disabled} data-diagram2-requires-update`)}
          ${diagram2ToolPaneActionButton("entity", "Compact", "auto-format-diagram2-compact", `${disabled} data-diagram2-requires-update`, "Optimize Entity placement and relationship routes for a compact, readable Diagram. Large Diagrams may take several minutes.")}
          ${diagram2ToolPaneButton("field-rectangle", "Field Rectangle", "Field Rectangle", false, `${disabled} data-diagram2-requires-update`)}
          ${diagram2ToolPaneActionButton("field-mapping-table", "Generate Field Mapping Table", "generate-diagram2-field-mapping-table", `${disabled} data-diagram2-requires-mapping-image data-diagram2-requires-update`)}
        </div>
      </div>
      ${diagram2LeftPaneResizerHtml("Tools")}
    </aside>
  `;
}

function diagram2InspectorHtml(status = {}, state = null, selectedIds = [], options = {}) {
  return `
    <div class="image-annotation-inspector-tabs" role="tablist" aria-label="Diagram 2 right pane">
      ${diagram2InspectorTab("format", "Format", true)}
      ${diagram2InspectorTab("rectangle", "Rectangle", false, false, true)}
      ${diagram2InspectorTab("crop", "Crop", false, false, true)}
      ${diagram2InspectorTab("field-mapping-table", "Mapping", false, false, true)}
      ${diagram2InspectorTab("entity", "Entity", false, false, true)}
    </div>
    <p class="image-annotation-selection-label" data-diagram2-selection-label data-diagram2-edit-state>${status.selectedCount ? `${status.selectedCount} selected` : "No selection"}</p>
    <div id="diagram2FormatPanel" role="tabpanel" aria-labelledby="diagram2FormatTab" data-diagram2-inspector-panel="format">
      <p class="image-annotation-format-status diagram2-empty-selection" data-diagram2-empty-selection>Select an object on the canvas or in the Objects pane to edit its available properties.</p>
      <section class="image-annotation-format-section" aria-labelledby="diagram2ShapeFormat" data-diagram2-selection-format hidden>
        <h4 id="diagram2ShapeFormat">Shape</h4>
        <div class="image-annotation-inspector-grid">
          ${diagram2ColorFieldHtml("fill", "Fill", "Background Color", defaultDiagram2ShellStyles.fill, "background")}
          ${diagram2ColorFieldHtml("stroke", "Outline color", "Outline Color", defaultDiagram2ShellStyles.stroke, "outline")}
          <label class="inline-check image-annotation-wide"><input type="checkbox" data-diagram2-outline checked><span>Outline</span></label>
          <label class="inline-check image-annotation-wide"><input type="checkbox" data-diagram2-transparent-fill><span>Transparent fill</span></label>
          <label class="field image-annotation-wide"><span>Opacity (%)</span><input type="number" min="0" max="100" step="1" value="100" data-diagram2-style="opacity"></label>
          <label class="field"><span>Line width</span><input type="number" min="1" max="40" value="${escapeAttr(defaultDiagram2ShellStyles.strokeWidth)}" data-diagram2-style="strokeWidth"></label>
          <label class="field" data-diagram2-style-field="arrowSize"><span>Arrow head</span><input type="number" min="6" max="160" value="${escapeAttr(defaultDiagram2ShellStyles.arrowSize)}" data-diagram2-style="arrowSize"></label>
        </div>
      </section>
      <section class="image-annotation-format-section" aria-labelledby="diagram2TextFormat" data-diagram2-selection-format hidden>
        <h4 id="diagram2TextFormat">Text</h4>
        <div class="image-annotation-inspector-grid">
          ${diagram2ColorFieldHtml("textColor", "Text color", "Font Color", defaultDiagram2ShellStyles.textColor, "font")}
          <label class="field"><span>Font</span><select data-diagram2-style="fontFamily">${diagram2FontOptions(defaultDiagram2ShellStyles.fontFamily)}</select></label>
          <label class="field"><span>Font size</span><input type="number" min="1" max="240" value="${escapeAttr(defaultDiagram2ShellStyles.fontSize)}" data-diagram2-style="fontSize"></label>
          <label class="field"><span>Horizontal alignment</span><select data-diagram2-style="textAlign"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
          <label class="field"><span>Vertical alignment</span><select data-diagram2-style="textVerticalAlign"><option value="top">Top</option><option value="middle">Middle</option><option value="bottom">Bottom</option></select></label>
        </div>
      </section>
    </div>
    <div id="diagram2RectanglePanel" role="tabpanel" aria-labelledby="diagram2RectangleTab" data-diagram2-inspector-panel="rectangle" hidden>
      <section class="image-annotation-format-section" aria-labelledby="diagram2RectangleGeometry">
        <h4 id="diagram2RectangleGeometry">Rectangle</h4>
        <div class="image-annotation-inspector-grid">
          <label class="field"><span>Width</span><input type="number" min="8" max="10000" step="1" data-diagram2-geometry="width"></label>
          <label class="field"><span>Height</span><input type="number" min="8" max="10000" step="1" data-diagram2-geometry="height"></label>
        </div>
      </section>
    </div>
    <div id="diagram2CropPanel" role="tabpanel" aria-labelledby="diagram2CropTab" data-diagram2-inspector-panel="crop" hidden>
      <section class="image-annotation-format-section" aria-labelledby="diagram2CropFormat">
        <h4 id="diagram2CropFormat">Crop</h4>
        <div class="image-annotation-inspector-grid">
          <label class="field"><span>Left</span><input type="number" min="0" step="1" value="0" data-diagram2-crop-inset="left"></label>
          <label class="field"><span>Right</span><input type="number" min="0" step="1" value="0" data-diagram2-crop-inset="right"></label>
          <label class="field"><span>Top</span><input type="number" min="0" step="1" value="0" data-diagram2-crop-inset="top"></label>
          <label class="field"><span>Bottom</span><input type="number" min="0" step="1" value="0" data-diagram2-crop-inset="bottom"></label>
        </div>
        <div class="image-annotation-crop-divider" role="separator"></div>
        <h4 id="diagram2CropRadiusFormat">Radius</h4>
        <div class="image-annotation-inspector-grid">
          <label class="field image-annotation-wide"><span>Radius</span><input type="number" min="0" max="200" step="1" value="0" data-diagram2-crop-corner-radius></label>
          <label class="field"><span>Top left</span><input type="number" min="0" max="200" step="1" value="0" data-diagram2-crop-corner="topLeft"></label>
          <label class="field"><span>Top right</span><input type="number" min="0" max="200" step="1" value="0" data-diagram2-crop-corner="topRight"></label>
          <label class="field"><span>Bottom left</span><input type="number" min="0" max="200" step="1" value="0" data-diagram2-crop-corner="bottomLeft"></label>
          <label class="field"><span>Bottom right</span><input type="number" min="0" max="200" step="1" value="0" data-diagram2-crop-corner="bottomRight"></label>
        </div>
        <label class="inline-check image-annotation-wide"><input type="checkbox" data-diagram2-crop-visible checked><span>Show saved crop</span></label>
        <div class="image-annotation-field-mapping-actions">
          <button type="button" data-action="reset-diagram2-crop" data-diagram2-requires-image data-diagram2-requires-update>Reset Crop</button>
          <button type="button" data-action="reset-diagram2-crop-radius" data-diagram2-requires-image data-diagram2-requires-update>Reset Radius</button>
          <button type="button" class="danger" data-action="permanently-crop-diagram2-image" data-diagram2-requires-image data-diagram2-requires-update>Permanently Crop</button>
        </div>
      </section>
    </div>
    <div id="diagram2MappingPanel" role="tabpanel" aria-labelledby="diagram2MappingTab" data-diagram2-inspector-panel="field-mapping-table" hidden>
      <section class="image-annotation-format-section" aria-labelledby="diagram2MappingFormat">
        <h4 id="diagram2MappingFormat">Field Mapping Table</h4>
        <div class="image-annotation-inspector-grid">
          ${diagram2ColorFieldHtml("headerTextColor", "Header text", "Header Text Color", defaultDiagram2ShellStyles.headerTextColor, "font")}
          ${diagram2ColorFieldHtml("headerFill", "Header background", "Header Background Color", defaultDiagram2ShellStyles.headerFill, "background")}
          ${diagram2ColorFieldHtml("uiTextColor", "UI field text", "UI Field Text Color", defaultDiagram2ShellStyles.uiTextColor, "font")}
          ${diagram2ColorFieldHtml("uiFill", "UI field background", "UI Field Background Color", defaultDiagram2ShellStyles.uiFill, "background")}
          ${diagram2ColorFieldHtml("databaseTextColor", "Database text", "Database Text Color", defaultDiagram2ShellStyles.databaseTextColor, "font")}
          ${diagram2ColorFieldHtml("databaseFill", "Database background", "Database Background Color", defaultDiagram2ShellStyles.databaseFill, "background")}
          ${diagram2ColorFieldHtml("fieldMappingRowHoverFill", "Row hover", "Row Hover Color", defaultDiagram2ShellStyles.fieldMappingRowHoverFill, "background")}
          ${diagram2ColorFieldHtml("fieldMappingHighlightColor", "Highlight", "Highlight Color", defaultDiagram2ShellStyles.fieldMappingHighlightColor, "outline")}
          <label class="field"><span>Highlight thickness</span><input type="number" min="1" max="40" value="${escapeAttr(defaultDiagram2ShellStyles.fieldMappingHighlightStrokeWidth)}" data-diagram2-style="fieldMappingHighlightStrokeWidth"></label>
        </div>
      </section>
    </div>
    <div id="diagram2EntityPanel" role="tabpanel" aria-labelledby="diagram2EntityTab" data-diagram2-inspector-panel="entity" hidden>
      <section class="image-annotation-format-section image-annotation-entity-format" aria-labelledby="diagram2EntityFormat">
        <h4 id="diagram2EntityFormat">Entity</h4>
        <div class="field image-annotation-entity-annotation-field" data-diagram2-entity-only>
          <span>Entity Annotation</span>
          <button type="button" data-action="edit-diagram2-entity-annotation" data-diagram2-requires-entity data-diagram2-requires-update>Add Entity Annotation</button>
          <small data-diagram2-entity-annotation-summary>No annotation</small>
        </div>
        <div class="image-annotation-field-rectangle-options" data-diagram2-field-rectangle-options hidden>
          <label class="field">
            <span>Field Rectangle Name</span>
            <input type="text" maxlength="120" autocomplete="off" data-diagram2-field-rectangle-name data-diagram2-requires-field-rectangle>
          </label>
          <label class="field">
            <span>Relationship connection</span>
            <select data-diagram2-field-rectangle-connection-side data-diagram2-requires-field-rectangle>
              <option value="left">Left</option>
              <option value="top">Top</option>
              <option value="right">Right</option>
              <option value="bottom">Bottom</option>
            </select>
          </label>
          <p class="image-annotation-format-status" data-diagram2-field-rectangle-mapping-summary>No database mapping</p>
          <div class="image-annotation-field-mapping-actions">
            <button type="button" data-action="map-diagram2-field-rectangle" data-diagram2-requires-field-rectangle data-diagram2-requires-update>Map Field Rectangle</button>
            <button type="button" data-action="generate-diagram2-field-mapping-table" data-diagram2-requires-mapping-image data-diagram2-requires-update>Generate Field Mapping Table</button>
          </div>
        </div>
        <div class="image-annotation-inspector-grid" data-diagram2-entity-only>
          ${diagram2ColorFieldHtml("entityNameTextColor", "Entity name text color", "Entity Name Text Color", "#172b4d", "font")}
          ${diagram2ColorFieldHtml("entityHeaderFill", "Header background color", "Entity Header Background Color", "#ffffff", "background")}
        </div>
        <div class="image-annotation-entity-display-options diagram2-entity-options" data-diagram2-entity-only>
          <button type="button" data-action="edit-diagram2-entity" data-diagram2-requires-entity data-diagram2-requires-update>Edit Definition</button>
          <button type="button" data-action="reset-diagram2-entity-scale" data-diagram2-requires-entity data-diagram2-requires-update>Reset Scale</button>
          <button type="button" data-action="add-diagram2-relationship" data-diagram2-requires-update>Add Relationship</button>
          <button type="button" title="Optimize Entity placement and relationship routes for a compact, readable Diagram. Large Diagrams may take several minutes." data-action="auto-format-diagram2-compact" data-diagram2-requires-update>Compact</button>
          <button type="button" class="image-annotation-generate-pmt-schema" data-action="generate-diagram2-pmt-schema" data-diagram2-requires-create>Generate PMT Database Schema</button>
          <label class="inline-check"><input type="checkbox" data-diagram2-entity-option="anchorTable" data-diagram2-requires-entity data-diagram2-requires-update><span>Anchor table</span></label>
          <label class="inline-check"><input type="checkbox" data-diagram2-entity-option="showKeyColumn" data-diagram2-requires-entity data-diagram2-requires-update checked><span>Show PK/FK column</span></label>
          <label class="inline-check"><input type="checkbox" data-diagram2-entity-option="showDataTypes" data-diagram2-requires-entity data-diagram2-requires-update><span>Show data types</span></label>
          <label class="inline-check"><input type="checkbox" data-diagram2-entity-option="foreignKeysAtTop" data-diagram2-requires-entity data-diagram2-requires-update><span>FK at the Top</span></label>
          <label class="inline-check"><input type="checkbox" data-diagram2-entity-option="collapsed" data-diagram2-requires-entity data-diagram2-requires-update><span>Collapse fields</span></label>
          <label class="inline-check"><input type="checkbox" data-diagram2-entity-option="showSelfRelationships" data-diagram2-requires-entity data-diagram2-requires-update><span>Show self relationships</span></label>
        </div>
      </section>
      <section class="image-annotation-format-section image-annotation-entity-format" aria-labelledby="diagram2EntityFieldsFormat" data-diagram2-entity-only>
        <div class="diagram2-section-title-row">
          <h4 id="diagram2EntityFieldsFormat">Fields</h4>
          <button type="button" data-action="add-diagram2-entity-field" data-diagram2-requires-entity data-diagram2-requires-update title="Add Field" aria-label="Add Field">+</button>
        </div>
        <p class="image-annotation-entity-fields-help">Field names use deterministic numeric suffixes when duplicates are entered.</p>
        <p class="image-annotation-format-status" data-diagram2-entity-field-status role="status" aria-live="polite"></p>
        <div class="diagram2-entity-fields" data-diagram2-entity-fields></div>
      </section>
      <section class="image-annotation-format-section image-annotation-entity-format" aria-labelledby="diagram2RelationshipFormat" data-diagram2-entity-relationship-only>
        <h4 id="diagram2RelationshipFormat">Relationships</h4>
        <div class="image-annotation-entity-display-options diagram2-entity-options">
          <label class="inline-check"><input type="checkbox" data-diagram2-relationship-option="manualEntityRelationshipRoutes" data-diagram2-requires-update><span>Manual routes</span></label>
          <label class="inline-check"><input type="checkbox" data-diagram2-relationship-option="allowOverlappingEntityLines" data-diagram2-requires-update><span>Allow overlap</span></label>
          <label class="inline-check"><input type="checkbox" data-diagram2-relationship-option="compactEntityRelationshipRouting" data-diagram2-requires-update><span>Compact routing</span></label>
          <label class="inline-check"><input type="checkbox" data-diagram2-relationship-option="hideAllEntityRelationships" data-diagram2-requires-update><span>Hide all lines</span></label>
          <label class="inline-check"><input type="checkbox" data-diagram2-relationship-style="showSymbols" data-diagram2-requires-update><span>Show symbols</span></label>
          <label class="field image-annotation-wide" data-diagram2-requires-relationship>
            <span>Relationship type</span>
            <select data-diagram2-relationship-type data-diagram2-requires-update>
              <option value="">Arrow</option>
              <option value="one-to-one">One-to-one</option>
              <option value="one-to-many">One-to-many</option>
              <option value="many-to-one">Many-to-one</option>
            </select>
          </label>
          <button type="button" data-action="use-diagram2-relationship-route" data-diagram2-requires-relationship data-diagram2-requires-update>Use Current Route</button>
          <button type="button" data-action="add-diagram2-relationship-route-point" data-diagram2-requires-relationship data-diagram2-requires-update>Add Route Point</button>
          <button type="button" data-action="remove-diagram2-relationship-route-point" data-diagram2-requires-relationship data-diagram2-requires-update>Remove Route Point</button>
          <button type="button" data-action="clear-diagram2-relationship-route" data-diagram2-requires-relationship data-diagram2-requires-update>Clear Manual Route</button>
          <button type="button" data-action="delete-diagram2-selection" data-diagram2-requires-relationship data-diagram2-requires-update>Delete Relationship</button>
        </div>
      </section>
    </div>
  `;
}

function diagram2FooterHtml(applyLabel) {
  return `
    <div class="dialog-actions image-annotation-actions diagram2-editor-actions">
      <span class="image-annotation-status" data-diagram2-shell-save-state aria-hidden="true">Saved</span>
      <div class="dialog-action-group">
        <button type="button" class="secondary text-icon-button" data-action="cancel-diagram2-editor"><span class="button-icon" aria-hidden="true">&#10005;</span><span>Cancel</span></button>
        <button type="button" class="primary text-icon-button" data-action="save-diagram2-document"><span class="button-icon" aria-hidden="true">&#10003;</span><span>${escapeHtml(applyLabel)}</span></button>
      </div>
    </div>
  `;
}

function diagram2DiagnosticsShellHtml(diagnosticsHtml) {
  return `
    <details class="diagram2-diagnostics-shell" data-diagram2-diagnostics-shell>
      <summary>Diagnostics</summary>
      <div class="diagram2-diagnostics-actions">
        <button type="button" data-action="refresh-diagram2-renderer" title="Refresh Renderer" aria-label="Refresh Renderer">Refresh Renderer</button>
      </div>
      ${diagnosticsHtml}
    </details>
  `;
}

function diagram2ContextMenuHtml() {
  return `
    <div class="image-annotation-context-menu rich-image-menu dropdown-menu" data-diagram2-context-menu role="menu" aria-label="Selected object actions" hidden>
      ${diagram2ContextMenuItemHtml("arrange-diagram2-selection-front", "To Front", "&#8677;")}
      ${diagram2ContextMenuItemHtml("arrange-diagram2-selection-back", "To Back", "&#8676;")}
      ${diagram2ContextMenuItemHtml("arrange-diagram2-selection-forward", "Forward", "&#8593;")}
      ${diagram2ContextMenuItemHtml("arrange-diagram2-selection-backward", "Backward", "&#8595;")}
      <div class="rich-image-menu-separator" role="separator"></div>
      ${diagram2ContextMenuItemHtml("group-diagram2-selection", "Group", "&#9638;")}
      ${diagram2ContextMenuItemHtml("ungroup-diagram2-selection", "Ungroup", "&#9633;")}
      <div class="rich-image-menu-separator" role="separator"></div>
      ${diagram2ContextMenuItemHtml("lock-diagram2-selection", "Lock", diagram2ObjectTreeLockIcon())}
      <div class="rich-image-menu-separator" role="separator"></div>
      ${diagram2ContextMenuItemHtml("copy-diagram2-selection", "Copy Selection", "&#128203;")}
      ${diagram2ContextMenuItemHtml("paste-diagram2-selection", "Paste", "&#128203;")}
      ${diagram2ContextMenuItemHtml("duplicate-diagram2-selection", "Duplicate", "&#128203;")}
      ${diagram2ContextMenuItemHtml("delete-diagram2-selection", "Delete", "&#128465;")}
      <div class="rich-image-menu-separator" role="separator"></div>
      ${diagram2ContextMenuItemHtml("copy-diagram2-selection-svg", "Copy as SVG", "&#10697;")}
      ${diagram2ContextMenuItemHtml("copy-diagram2-selection-image", "Copy as Image", "&#9635;")}
    </div>
  `;
}

function diagram2ContextMenuItemHtml(action, label, icon, disabled = false) {
  return `
    <button type="button" class="rich-image-menu-item dropdown-menu-item" data-action="${escapeAttr(action)}" data-diagram2-requires-selection role="menuitem" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}" ${disabled ? "disabled" : ""}>
      <span class="dropdown-menu-icon" aria-hidden="true">${icon}</span>
      <span class="dropdown-menu-label">${escapeHtml(label)}</span>
      <span class="dropdown-menu-check" aria-hidden="true"></span>
    </button>
  `;
}

function syncDiagram2ContextMenu(root, selectedObjects, options = {}) {
  const selection = Array.isArray(selectedObjects) ? selectedObjects : [];
  const hasSelection = selection.length > 0;
  const allLocked = hasSelection && selection.every(object => object?.locked === true);
  const containsFixedOriginalImage = selection.some(object =>
    object?.type === "embedded-image" && object?.isOriginalImage === true);
  const hasLocked = selection.some(object => object?.locked === true);
  root.querySelectorAll("[data-action^='arrange-diagram2-selection-']").forEach(button => {
    button.disabled = !hasSelection
      || hasLocked
      || containsFixedOriginalImage
      || options.busy === true
      || options.canEdit === false;
  });
  const groupButton = root.querySelector("[data-action='group-diagram2-selection']");
  if (groupButton) {
    groupButton.disabled = selection.length < 2
      || hasLocked
      || containsFixedOriginalImage
      || options.busy === true
      || options.canEdit === false;
  }
  const ungroupButton = root.querySelector("[data-action='ungroup-diagram2-selection']");
  if (ungroupButton) {
    ungroupButton.disabled = !hasSelection
      || !selection.some(object => object?.groupId)
      || hasLocked
      || containsFixedOriginalImage
      || options.busy === true
      || options.canEdit === false;
  }
  const lockButton = root.querySelector("[data-action='lock-diagram2-selection']");
  if (lockButton) {
    const label = allLocked ? "Unlock" : "Lock";
    lockButton.querySelector(".dropdown-menu-label").textContent = label;
    lockButton.title = `${label} selected objects`;
    lockButton.setAttribute("aria-label", lockButton.title);
    lockButton.disabled = !hasSelection || containsFixedOriginalImage || options.busy === true || options.canEdit === false;
  }
  root.querySelectorAll("[data-action='copy-diagram2-selection-svg'], [data-action='copy-diagram2-selection-image']").forEach(button => {
    button.disabled = !hasSelection || options.busy === true || options.canExport === false;
  });
}

function diagram2SelectionSvgDimensions(svg) {
  const documentNode = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = documentNode.documentElement;
  const viewBox = String(root?.getAttribute("viewBox") || "").trim().split(/\s+/).map(Number);
  const width = viewBox.length === 4 && Number.isFinite(viewBox[2])
    ? viewBox[2]
    : Number.parseFloat(root?.getAttribute("width") || "1");
  const height = viewBox.length === 4 && Number.isFinite(viewBox[3])
    ? viewBox[3]
    : Number.parseFloat(root?.getAttribute("height") || "1");
  return {
    width: Math.max(1, Number.isFinite(width) ? width : 1),
    height: Math.max(1, Number.isFinite(height) ? height : 1)
  };
}

function diagram2ObjectTreeNodeHtml(node, selected, level) {
  if (!node || typeof node !== "object") return "";
  if (node.kind === "group" || node.kind === "relationships") {
    const children = Array.isArray(node.children) ? node.children : [];
    return `
      <div class="image-annotation-object-tree-group" data-diagram2-object-tree-group-id="${escapeAttr(node.id)}">
        ${diagram2ObjectTreeRowHtml(node, selected, level)}
        <div class="image-annotation-object-tree-group-children" role="group">
          ${children.map(child => diagram2ObjectTreeNodeHtml(child, selected, level + 1)).join("")}
        </div>
      </div>
    `;
  }
  return diagram2ObjectTreeRowHtml(node, selected, level);
}

function diagram2ObjectTreeRowHtml(node, selected, level) {
  const kind = String(node.kind || "object");
  const object = kind === "object" ? node.object : null;
  const fixed = ["relationships", "relationship"].includes(kind)
    || (object?.type === "embedded-image" && object.isOriginalImage === true);
  const childIds = kind === "group"
    ? (node.allChildren || node.children || []).map(child => child.id)
    : [node.id];
  const selectedCount = childIds.filter(id => selected.has(String(id))).length;
  const selectedAll = childIds.length > 0 && selectedCount === childIds.length;
  const selectedPartial = selectedCount > 0 && !selectedAll;
  const visible = node.visible !== false;
  const effectiveVisible = node.effectiveVisible !== false;
  const groupChildren = kind === "group" ? (node.allChildren || node.children || []) : [];
  const lockTargets = kind === "group"
    ? groupChildren.map(child => child?.object).filter(Boolean)
    : [object].filter(Boolean);
  const locked = lockTargets.length > 0 && lockTargets.every(target => target?.locked === true);
  const hasLocked = lockTargets.some(target => target?.locked === true);
  const draggable = fixed || hasLocked ? "false" : "true";
  const name = String(kind === "relationships" ? `${node.name} (${node.count || 0})` : node.name || "Object");
  const type = object?.type || kind;
  const icon = kind === "group" ? "&#9638;" : kind === "relationships" || kind === "relationship" ? "&#8644;" : diagram2ObjectTreeIcon(type);
  const rowClass = `image-annotation-object-tree-row${selectedAll ? " is-selected" : ""}${selectedPartial ? " is-partially-selected" : ""}${effectiveVisible ? "" : " is-hidden"}${locked ? " is-locked" : ""}${hasLocked && !locked ? " is-partially-locked" : ""}`;
  const canDelete = !fixed && (kind === "group"
    ? groupChildren.some(child => child?.object?.locked !== true)
    : locked !== true);
  const lockLabel = locked ? "Unlock" : "Lock";
  const actions = fixed
    ? `<span class="image-annotation-object-tree-row-actions" aria-hidden="true"></span>`
    : `<span class="image-annotation-object-tree-row-actions">
        <button type="button" data-action="rename-diagram2-object" data-node-kind="${escapeAttr(kind)}" data-object-id="${escapeAttr(node.id)}" title="Rename ${escapeAttr(name)}" aria-label="Rename ${escapeAttr(name)}">&#9998;</button>
      </span>`;
  const deleteToggle = fixed
    ? ""
    : `<button type="button" class="image-annotation-object-tree-delete" data-action="delete-diagram2-object-tree-item" data-node-kind="${escapeAttr(kind)}" data-object-id="${escapeAttr(node.id)}" title="Delete ${escapeAttr(name)}" aria-label="Delete ${escapeAttr(name)}"${canDelete ? "" : " disabled"}>&#10005;</button>`;
  const lockToggle = kind === "relationship" || kind === "relationships" || !lockTargets.length
    ? ""
    : `<button type="button" class="image-annotation-object-tree-lock-toggle${locked ? " is-locked" : ""}${hasLocked && !locked ? " is-partially-locked" : ""}" data-action="lock-diagram2-object-tree-item" data-node-kind="${escapeAttr(kind)}" data-object-id="${escapeAttr(node.id)}" title="${lockLabel} ${escapeAttr(name)}" aria-label="${lockLabel} ${escapeAttr(name)}" aria-pressed="${locked ? "true" : hasLocked ? "mixed" : "false"}">${diagram2ObjectTreeLockIcon()}</button>`;
  const visibility = kind === "relationship" || kind === "relationships"
    ? ""
    : `<button type="button" class="image-annotation-object-tree-visibility${visible ? "" : " is-hidden"}" data-action="toggle-diagram2-object-visibility" data-node-kind="${escapeAttr(kind)}" data-object-id="${escapeAttr(node.id)}" title="${visible ? "Hide" : "Show"} ${escapeAttr(name)}" aria-label="${visible ? "Hide" : "Show"} ${escapeAttr(name)}" aria-pressed="${visible}"><span aria-hidden="true">&#128065;</span></button>`;
  return `
    <div class="${rowClass}" role="treeitem" aria-level="${level}" aria-selected="${selectedAll}" ${kind === "group" || kind === "relationships" ? "aria-expanded=\"true\"" : ""} tabindex="0" draggable="${draggable}" data-action="select-diagram2-object-tree-item" data-object-id="${escapeAttr(node.id)}" data-node-kind="${escapeAttr(kind)}" data-diagram2-object-tree-row data-diagram2-object-id="${escapeAttr(node.id)}" data-diagram2-tree-node-kind="${escapeAttr(kind)}" data-diagram2-object-type="${escapeAttr(type)}" data-diagram2-object-visible="${visible}">
      <span class="image-annotation-object-tree-icon" aria-hidden="true">${icon}</span>
      <span class="image-annotation-object-tree-label" title="${escapeAttr(name)}">${escapeHtml(name)}</span>
      ${deleteToggle}
      ${lockToggle}
      ${visibility}
      ${actions}
    </div>
  `;
}

function diagram2TemplateCardHtml(template, index, templateCount) {
  const id = String(template?.id || "");
  const name = String(template?.name || "Template");
  const preview = annotationTemplatePreviewDataUrl(template);
  const upDisabled = index <= 0;
  const downDisabled = index >= templateCount - 1;
  return `
    <article class="image-annotation-template-card diagram2-template-card" data-diagram2-template-card="${escapeAttr(id)}">
      <button type="button" class="image-annotation-template-preview" data-action="apply-diagram2-template" data-template-id="${escapeAttr(id)}" aria-label="Use ${escapeAttr(name)} template">
        <img src="${escapeAttr(preview)}" alt="${escapeAttr(name)} template preview">
      </button>
      <strong title="${escapeAttr(name)}">${escapeHtml(name)}</strong>
      <div class="image-annotation-template-card-actions" aria-label="${escapeAttr(name)} template actions">
        <button type="button" data-action="rename-diagram2-template" data-template-id="${escapeAttr(id)}" title="Rename ${escapeAttr(name)}">Rename</button>
        <button type="button" data-action="update-diagram2-template" data-template-id="${escapeAttr(id)}" data-diagram2-requires-selection data-diagram2-requires-update title="Update ${escapeAttr(name)}">Update</button>
        <button type="button" data-action="format-diagram2-template" data-template-id="${escapeAttr(id)}" data-diagram2-requires-selection data-diagram2-requires-update title="Apply ${escapeAttr(name)} formatting">Format</button>
        <button type="button" data-action="move-diagram2-template-up" data-template-id="${escapeAttr(id)}" ${upDisabled ? "disabled" : ""} title="Move ${escapeAttr(name)} up">Up</button>
        <button type="button" data-action="move-diagram2-template-down" data-template-id="${escapeAttr(id)}" ${downDisabled ? "disabled" : ""} title="Move ${escapeAttr(name)} down">Down</button>
        <button type="button" data-action="download-diagram2-template" data-template-id="${escapeAttr(id)}" title="Download ${escapeAttr(name)}">Download</button>
        <button type="button" data-action="delete-diagram2-template" data-template-id="${escapeAttr(id)}" title="Delete ${escapeAttr(name)}">Delete</button>
      </div>
    </article>
  `;
}

function diagram2ObjectTreeLockIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5" y="10" width="14" height="10" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path></svg>`;
}

function diagram2ToolButton(tool, label, pressed = false, attributes = "") {
  return `<button type="button" data-action="set-diagram2-tool" data-diagram2-tool="${escapeAttr(tool)}" data-tool="${escapeAttr(tool)}" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}" aria-pressed="${pressed}" class="${pressed ? "is-active" : ""}" ${attributes}><span class="button-icon" aria-hidden="true">${diagram2ToolIconSvg(tool)}</span></button>`;
}

function diagram2ToolPaneButton(tool, text, label, pressed = false, attributes = "") {
  return `<button type="button" class="diagram2-tool-pane-button ${pressed ? "is-active" : ""}" data-action="set-diagram2-tool" data-diagram2-tool="${escapeAttr(tool)}" data-tool="${escapeAttr(tool)}" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}" aria-pressed="${pressed}" ${attributes}><span class="button-icon" aria-hidden="true">${diagram2ToolIconSvg(tool)}</span><span class="diagram2-tool-pane-label">${escapeHtml(text)}</span></button>`;
}

function diagram2ToolPaneActionButton(iconType, label, action, attributes = "", title = label) {
  return `<button type="button" class="diagram2-tool-pane-button" data-action="${escapeAttr(action)}" title="${escapeAttr(title)}" aria-label="${escapeAttr(label)}" ${attributes}><span class="button-icon" aria-hidden="true">${diagram2ToolIconSvg(iconType)}</span><span class="diagram2-tool-pane-label">${escapeHtml(label)}</span></button>`;
}

function diagram2IconButton(label, action, iconType, attributes = "") {
  return `<button type="button" class="image-annotation-toolbar-icon-action" data-action="${escapeAttr(action)}" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}" ${attributes}><span class="button-icon" aria-hidden="true">${diagram2ToolIconSvg(iconType)}</span></button>`;
}

function diagram2TextButton(action, label, title, attributes = "") {
  return `<button type="button" data-action="${escapeAttr(action)}" title="${escapeAttr(title)}" aria-label="${escapeAttr(title)}" ${attributes}>${escapeHtml(label)}</button>`;
}

function diagram2InspectorTab(name, label, selected = false, disabled = false, hidden = false) {
  const id = `diagram2${label.replace(/[^a-z0-9]+/gi, "")}Tab`;
  const panel = `diagram2${label.replace(/[^a-z0-9]+/gi, "")}Panel`;
  return `<button type="button" id="${id}" role="tab" aria-selected="${selected}" aria-controls="${panel}" tabindex="${selected ? "0" : "-1"}" data-action="set-diagram2-inspector-tab" data-diagram2-inspector-tab="${escapeAttr(name)}" ${disabled ? "aria-disabled=\"true\" disabled" : ""} ${hidden ? "hidden" : ""}>${escapeHtml(label)}</button>`;
}

function syncDiagram2InspectorTabVisibility(root, selectedObjects = []) {
  const single = Array.isArray(selectedObjects) && selectedObjects.length === 1 ? selectedObjects[0] : null;
  const type = String(single?.type || "");
  const fieldRectangle = isDiagram2FieldRectangle(single);
  const visibleTabs = {
    format: true,
    rectangle: type === "rectangle",
    crop: type === "embedded-image",
    "field-mapping-table": type === "field-mapping-table",
    entity: type === "entity" || fieldRectangle || type === "entity-relationship" || type === "entity-relationships"
  };

  root.querySelectorAll("[data-diagram2-inspector-tab]").forEach(tab => {
    const name = tab.dataset.diagram2InspectorTab || "";
    tab.hidden = visibleTabs[name] !== true;
  });
  setDiagram2InspectorActiveTab(root, root.querySelector("[data-diagram2-inspector-tab][aria-selected='true']")?.dataset.diagram2InspectorTab);
}

function diagram2ColorFieldHtml(name, label, title, selectedColor, icon) {
  return `<div class="image-annotation-color-field"><span>${escapeHtml(label)}</span><div class="image-annotation-color-controls">${sharedRichColorPickerHtml({ name, title, selectedColor, icon })}<div class="image-annotation-recent-colors" data-annotation-recent-colors="${escapeAttr(name)}" aria-label="Recent ${escapeAttr(label)} colors" hidden></div></div></div>`;
}

function diagram2FontOptions(selectedFont) {
  const selected = String(selectedFont || defaultDiagram2ShellStyles.fontFamily);
  return diagram2ShellFontFamilies.map(font => `<option value="${escapeAttr(font)}" ${font === selected ? "selected" : ""}>${escapeHtml(font)}</option>`).join("");
}

function syncDiagram2FormatControls(root, selectedObjects = [], options = {}) {
  const objects = Array.isArray(selectedObjects) ? selectedObjects : [];
  const canUse = options.canEdit !== false && options.busy !== true;
  syncDiagram2CheckboxStyleControl(root, "[data-diagram2-outline]", "outlineVisible", objects, canUse);
  syncDiagram2TransparentFillControl(root, objects, canUse);
  root.querySelectorAll("[data-diagram2-style]").forEach(control => {
    const styleName = control.dataset.diagram2Style || "";
    const supportedObjects = objects.filter(object => diagram2ShellObjectSupportsStyle(object, styleName));
    const canStyle = canUse && supportedObjects.length > 0;
    const field = control.closest("[data-diagram2-style-field]");
    if (field) field.hidden = supportedObjects.length === 0;
    control.disabled = !canStyle;
    if (!supportedObjects.length) {
      setDiagram2StyleControlValue(control, diagram2DefaultShellStyleValue(styleName));
      return;
    }
    const values = supportedObjects.map(object => diagram2ShellStyleValue(object, styleName));
    control.dataset.diagram2MixedValue = values.some(value => value !== values[0]) ? "true" : "false";
    setDiagram2StyleControlValue(control, values[0]);
  });
}

function syncDiagram2GeometryControls(root, selectedObjects = [], options = {}) {
  const objects = Array.isArray(selectedObjects) ? selectedObjects : [];
  const rectangle = objects.length === 1 && objects[0]?.type === "rectangle" ? objects[0] : null;
  const canUse = options.canEdit !== false && options.busy !== true && rectangle && rectangle.locked !== true;
  root.querySelectorAll("[data-diagram2-geometry]").forEach(control => {
    const property = control.dataset.diagram2Geometry || "";
    const canEditGeometry = canUse && ["width", "height"].includes(property);
    control.disabled = !canEditGeometry;
    control.value = rectangle ? diagram2DimensionText(rectangle[property]) : "";
  });
}

function syncDiagram2EntityControls(root, status = {}, options = {}) {
  const objects = Array.isArray(status.selectedObjects) ? status.selectedObjects : [];
  const selectedEntity = objects.length === 1 && objects[0]?.type === "entity" ? objects[0] : null;
  const entity = selectedEntity && !isDiagram2FieldRectangle(selectedEntity) ? selectedEntity : null;
  const relationship = objects.length === 1 && objects[0]?.type === "entity-relationship" ? objects[0] : null;
  const canUse = options.canEdit !== false && options.busy !== true;
  const state = status.state && typeof status.state === "object" ? status.state : {};
  root.querySelectorAll("[data-diagram2-requires-entity]").forEach(control => {
    control.disabled = !canUse || !entity || entity.locked === true;
  });
  root.querySelectorAll("[data-diagram2-requires-relationship]").forEach(control => {
    control.disabled = !canUse || !relationship || relationship.locked === true;
  });
  root.querySelectorAll("[data-diagram2-entity-option]").forEach(control => {
    const option = control.dataset.diagram2EntityOption || "";
    control.disabled = !canUse || !entity || entity.locked === true;
    if (control.type === "checkbox") control.checked = entity ? entity[option] === true || (option === "showKeyColumn" && entity[option] !== false) : false;
  });
  root.querySelectorAll("[data-diagram2-relationship-option]").forEach(control => {
    const option = control.dataset.diagram2RelationshipOption || "";
    control.disabled = !canUse;
    if (control.type === "checkbox") control.checked = state[option] === true;
  });
  root.querySelectorAll("[data-diagram2-relationship-style='showSymbols']").forEach(control => {
    control.disabled = !canUse;
    control.checked = state.relationshipStyle?.showSymbols === true || relationship?.showSymbols === true;
  });
  root.querySelectorAll("[data-diagram2-relationship-type]").forEach(control => {
    control.disabled = !canUse || !relationship || relationship.locked === true;
    control.value = relationship?.relationshipType || "";
  });
  root.querySelectorAll("[data-diagram2-entity-only]").forEach(node => {
    node.hidden = !entity;
  });
  root.querySelectorAll("[data-diagram2-entity-relationship-only]").forEach(node => {
    node.hidden = !entity && !relationship;
  });
  const annotationButton = root.querySelector("[data-action='edit-diagram2-entity-annotation']");
  const annotationSummary = root.querySelector("[data-diagram2-entity-annotation-summary]");
  if (annotationButton) {
    annotationButton.textContent = entity?.entityAnnotation ? "Edit Entity Annotation" : "Add Entity Annotation";
  }
  if (annotationSummary) {
    const text = String(entity?.entityAnnotation || "").trim();
    annotationSummary.textContent = !entity
      ? ""
      : text
        ? `${text.split(/\r?\n/, 1)[0]} ${entity.entityAnnotationShowArrow === false ? "(no arrow)" : "(with arrow)"}`
        : "No annotation";
  }
  syncDiagram2EntityFieldEditor(root, entity, state, canUse);
}

function syncDiagram2CropControls(root, image, options = {}) {
  const canUse = options.canEdit !== false && options.busy !== true && image && image.locked !== true;
  const insets = image ? diagram2ImageCropInsets(image) : { left: 0, right: 0, top: 0, bottom: 0 };
  const corners = image
    ? diagram2ImageCropCornerRadii(image)
    : { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 };
  const reversible = image ? diagram2ImageHasReversibleCrop(image) : false;
  root.querySelectorAll("[data-diagram2-crop-inset]").forEach(control => {
    control.value = diagram2DimensionText(insets[control.dataset.diagram2CropInset] || 0);
    control.disabled = !canUse;
  });
  root.querySelectorAll("[data-diagram2-crop-corner]").forEach(control => {
    control.value = diagram2DimensionText(corners[control.dataset.diagram2CropCorner] || 0);
    control.disabled = !canUse;
  });
  const uniformRadius = root.querySelector("[data-diagram2-crop-corner-radius]");
  if (uniformRadius) {
    const cornerValues = Object.values(corners).map(Number);
    const sharedRadius = cornerValues.every(value => Math.abs(value - cornerValues[0]) < 0.001)
      ? cornerValues[0]
      : 0;
    uniformRadius.value = image ? diagram2DimensionText(sharedRadius || 0) : "0";
    uniformRadius.disabled = !canUse;
  }
  const visible = root.querySelector("[data-diagram2-crop-visible]");
  if (visible) {
    visible.checked = image?.cropVisible !== false;
    visible.disabled = !canUse || !reversible;
  }
  const reset = root.querySelector("[data-action='reset-diagram2-crop']");
  if (reset) reset.disabled = !canUse || (!reversible && !Object.values(corners).some(Number));
  const resetRadius = root.querySelector("[data-action='reset-diagram2-crop-radius']");
  if (resetRadius) resetRadius.disabled = !canUse || !Object.values(corners).some(Number);
  const permanent = root.querySelector("[data-action='permanently-crop-diagram2-image']");
  if (permanent) permanent.disabled = !canUse || !reversible;
}

function syncDiagram2FieldRectangleControls(root, fieldRectangle, options = {}) {
  const canUse = options.canEdit !== false && options.busy !== true && fieldRectangle && fieldRectangle.locked !== true;
  root.querySelectorAll("[data-diagram2-field-rectangle-options]").forEach(node => {
    node.hidden = !fieldRectangle;
  });
  const name = root.querySelector("[data-diagram2-field-rectangle-name]");
  if (name) {
    name.value = fieldRectangle?.fieldRectangleName || fieldRectangle?.fields?.[0]?.name || "";
    name.disabled = !canUse;
  }
  const side = root.querySelector("[data-diagram2-field-rectangle-connection-side]");
  if (side) {
    side.value = fieldRectangle?.fieldRectangleConnectionSide || "right";
    side.disabled = !canUse;
  }
  const summary = root.querySelector("[data-diagram2-field-rectangle-mapping-summary]");
  if (summary) {
    const mapping = diagram2FieldRectangleMapping(fieldRectangle);
    summary.textContent = mapping
      ? `${mapping.referencedEntity}.${mapping.referencedField}`
      : "No database mapping";
  }
}

function diagram2FieldMappingImages(stateInput) {
  const objects = Array.isArray(stateInput?.objects) ? stateInput.objects : [];
  const mappedRectangles = objects.filter(object =>
    isDiagram2FieldRectangle(object) && diagram2FieldRectangleMapping(object));
  if (!mappedRectangles.length) return [];
  return objects.filter(image => image?.type === "embedded-image" && mappedRectangles.some(rectangle =>
    diagram2BoundsIntersect(diagram2ObjectBounds(rectangle), diagram2ObjectBounds(image))));
}

function diagram2ObjectBounds(object) {
  if (!object) return null;
  return {
    x: Number(object.x) || 0,
    y: Number(object.y) || 0,
    width: Math.max(1, Number(object.width) || 1),
    height: Math.max(1, Number(object.height) || 1)
  };
}

function diagram2BoundsIntersect(left, right) {
  return Boolean(left && right
    && left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y);
}

function syncDiagram2EntityFieldEditor(root, entity, state = {}, canUse = true) {
  const container = root.querySelector("[data-diagram2-entity-fields]");
  if (!container) return;
  if (!entity) {
    container.innerHTML = `<p class="image-annotation-object-tree-empty">Select one Entity to edit fields.</p>`;
    return;
  }
  const entities = (Array.isArray(state.objects) ? state.objects : [])
    .filter(object => object?.type === "entity" && object.entityKind !== "field-rectangle");
  container.innerHTML = diagram2EntityFieldRowsHtml(entity, entities, canUse && entity.locked !== true);
}

function diagram2EntityFieldRowsHtml(entity, entities, canEdit) {
  const fields = Array.isArray(entity?.fields) ? entity.fields : [];
  if (!fields.length) {
    return `<p class="image-annotation-object-tree-empty">No fields.</p>`;
  }
  return `
    <div class="diagram2-entity-field-columns" aria-hidden="true">
      <span>Field</span><span>Type</span><span>Null</span><span>PK</span><span>FK</span><span>ID</span><span>Imp</span><span>Reference</span><span></span>
    </div>
    <div class="diagram2-entity-field-list" role="list" aria-label="Entity fields">
      ${fields.map((field, index) => diagram2EntityFieldRowHtml(entity, field, index, entities, canEdit)).join("")}
    </div>
  `;
}

function diagram2EntityFieldRowHtml(entity, field, index, entities, canEdit) {
  const fieldName = String(field?.name || `Field ${index + 1}`).trim();
  const mapping = diagram2EntityFieldReference(entity, fieldName, entities);
  const disabled = canEdit ? "" : "disabled";
  const nullableValue = field?.nullable === true ? "true" : field?.nullable === false ? "false" : "";
  return `
    <div class="diagram2-entity-field-row" role="listitem" data-diagram2-entity-field-row data-diagram2-entity-field-index="${index}">
      <input type="text" maxlength="240" autocomplete="off" value="${escapeAttr(fieldName)}" aria-label="Field name ${index + 1}" data-diagram2-entity-field-property="name" data-diagram2-entity-field-index="${index}" ${disabled}>
      <input type="text" maxlength="240" autocomplete="off" value="${escapeAttr(field?.dataType || "")}" aria-label="Data type for ${escapeAttr(fieldName)}" data-diagram2-entity-field-property="dataType" data-diagram2-entity-field-index="${index}" ${disabled}>
      <select aria-label="Nullable for ${escapeAttr(fieldName)}" data-diagram2-entity-field-property="nullable" data-diagram2-entity-field-index="${index}" ${disabled}>
        <option value="" ${nullableValue === "" ? "selected" : ""}>?</option>
        <option value="false" ${nullableValue === "false" ? "selected" : ""}>No</option>
        <option value="true" ${nullableValue === "true" ? "selected" : ""}>Yes</option>
      </select>
      ${diagram2EntityFieldCheckbox("isPrimaryKey", "PK", field?.isPrimaryKey === true, fieldName, index, disabled)}
      ${diagram2EntityFieldCheckbox("isForeignKey", "FK", field?.isForeignKey === true, fieldName, index, disabled)}
      ${diagram2EntityFieldCheckbox("isIdentity", "Identity", field?.isIdentity === true || Boolean(field?.identity), fieldName, index, disabled)}
      ${diagram2EntityFieldCheckbox("isImportant", "Important", field?.isImportant === true, fieldName, index, disabled)}
      <span class="diagram2-entity-field-reference">
        <select aria-label="Referenced Entity for ${escapeAttr(fieldName)}" data-diagram2-entity-field-reference="targetEntityId" ${disabled}>
          <option value="">No reference</option>
          ${diagram2EntityReferenceOptionsHtml(entities, mapping.targetEntityId)}
        </select>
        <select aria-label="Referenced Field for ${escapeAttr(fieldName)}" data-diagram2-entity-field-reference="targetFieldName" ${disabled}>
          <option value="">Field</option>
          ${diagram2EntityReferenceFieldOptionsHtml(mapping.targetEntity, mapping.targetFieldName)}
        </select>
      </span>
      <span class="diagram2-entity-field-actions">
        <button type="button" data-action="move-diagram2-entity-field-up" data-diagram2-entity-field-index="${index}" title="Move Field Up" aria-label="Move Field Up" ${disabled || index <= 0 ? "disabled" : ""}>&#8593;</button>
        <button type="button" data-action="move-diagram2-entity-field-down" data-diagram2-entity-field-index="${index}" title="Move Field Down" aria-label="Move Field Down" ${disabled || index >= (entity.fields.length - 1) ? "disabled" : ""}>&#8595;</button>
        <button type="button" data-action="remove-diagram2-entity-field" data-diagram2-entity-field-index="${index}" title="Delete Field" aria-label="Delete Field" ${disabled}>&#10005;</button>
      </span>
    </div>
  `;
}

function diagram2EntityFieldCheckbox(property, label, checked, fieldName, index, disabled) {
  return `<input type="checkbox" aria-label="${escapeAttr(label)} for ${escapeAttr(fieldName)}" data-diagram2-entity-field-property="${escapeAttr(property)}" data-diagram2-entity-field-index="${index}" ${checked ? "checked" : ""} ${disabled}>`;
}

function diagram2EntityReferenceOptionsHtml(entities, selectedId) {
  return (Array.isArray(entities) ? entities : [])
    .map(entity => `<option value="${escapeAttr(entity.id)}" data-diagram2-entity-fields="${escapeAttr(encodeURIComponent(JSON.stringify((entity.fields || []).map(field => field?.name || "").filter(Boolean))))}" ${String(entity.id) === String(selectedId) ? "selected" : ""}>${escapeHtml(diagram2EntityLabel(entity))}</option>`)
    .join("");
}

function diagram2EntityReferenceFieldOptionsHtml(entity, selectedFieldName) {
  return (Array.isArray(entity?.fields) ? entity.fields : [])
    .map(field => `<option value="${escapeAttr(field?.name || "")}" ${sameDiagram2Identifier(field?.name, selectedFieldName) ? "selected" : ""}>${escapeHtml(field?.name || "Field")}</option>`)
    .join("");
}

function diagram2EntityFieldReference(entity, fieldName, entities) {
  const foreignKey = (Array.isArray(entity?.foreignKeys) ? entity.foreignKeys : [])
    .find(candidate => (candidate.columns || []).some(column => sameDiagram2Identifier(column, fieldName)));
  if (!foreignKey) return { targetEntityId: "", targetEntity: null, targetFieldName: "" };
  const targetEntity = (Array.isArray(entities) ? entities : [])
    .find(candidate => sameDiagram2Identifier(candidate.entityName, foreignKey.referencedTable)
      && (!foreignKey.referencedSchema || !candidate.entitySchema || sameDiagram2Identifier(candidate.entitySchema, foreignKey.referencedSchema))) || null;
  const targetFieldName = (foreignKey.referencedColumns || [])[0] || "";
  return {
    targetEntityId: targetEntity?.id || "",
    targetEntity,
    targetFieldName
  };
}

function diagram2EntityLabel(entity) {
  return [entity?.entitySchema, entity?.entityName]
    .map(value => String(value || "").trim())
    .filter(Boolean)
    .join(".") || "Entity";
}

function diagram2EntityFieldControlValue(control, property) {
  if (control.type === "checkbox") return control.checked === true;
  if (property === "nullable") {
    if (control.value === "true") return true;
    if (control.value === "false") return false;
    return null;
  }
  return control.value;
}

function diagram2EntityFieldReferenceValue(row) {
  const targetEntityId = row?.querySelector?.("[data-diagram2-entity-field-reference='targetEntityId']")?.value || "";
  const targetFieldName = row?.querySelector?.("[data-diagram2-entity-field-reference='targetFieldName']")?.value || "";
  return {
    targetEntityId,
    targetFieldName,
    relationshipType: "many-to-one"
  };
}

function refreshDiagram2EntityFieldReferenceFields(row) {
  const entitySelect = row?.querySelector?.("[data-diagram2-entity-field-reference='targetEntityId']");
  const fieldSelect = row?.querySelector?.("[data-diagram2-entity-field-reference='targetFieldName']");
  if (!entitySelect || !fieldSelect) return;
  const option = entitySelect.selectedOptions?.[0] || null;
  let fields = [];
  try {
    fields = JSON.parse(decodeURIComponent(option?.dataset?.diagram2EntityFields || "%5B%5D"));
  } catch {
    fields = [];
  }
  fieldSelect.innerHTML = [
    `<option value="">Field</option>`,
    ...fields.map(field => `<option value="${escapeAttr(field)}">${escapeHtml(field)}</option>`)
  ].join("");
}

function sameDiagram2Identifier(first, second) {
  return String(first || "").trim().toLowerCase() === String(second || "").trim().toLowerCase();
}

function diagram2CurrentInspectorWidth(main, inspector) {
  const fromStyle = Number.parseFloat(main?.style?.getPropertyValue("--image-annotation-inspector-width") || "");
  if (Number.isFinite(fromStyle) && fromStyle > 0) return fromStyle;
  const width = inspector?.getBoundingClientRect?.().width || 0;
  return Number.isFinite(width) && width > 0 ? width : 320;
}

function diagram2CurrentLeftPaneWidth(main, mode = "tools") {
  const property = diagram2LeftPaneWidthProperty(mode);
  const fromModeStyle = Number.parseFloat(main?.style?.getPropertyValue(property) || "");
  if (Number.isFinite(fromModeStyle) && fromModeStyle > 0) return fromModeStyle;
  const pane = main?.querySelector?.(`[data-diagram2-left-pane-name="${normalizeDiagram2LeftPaneMode(mode)}"]`);
  const paneWidth = pane?.getBoundingClientRect?.().width || 0;
  if (Number.isFinite(paneWidth) && paneWidth > 0) return paneWidth;
  const fromStyle = Number.parseFloat(main?.style?.getPropertyValue("--diagram2-left-pane-width") || "");
  if (Number.isFinite(fromStyle) && fromStyle > 0) return fromStyle;
  return 320;
}

function normalizeDiagram2LeftPaneMode(mode) {
  const value = String(mode || "").trim().toLowerCase();
  return ["tools", "objects", "templates", "mapping"].includes(value) ? value : "tools";
}

function diagram2LeftPaneWidthProperty(mode) {
  return `--diagram2-${normalizeDiagram2LeftPaneMode(mode)}-pane-width`;
}

function syncDiagram2CheckboxStyleControl(root, selector, styleName, selectedObjects, canUse) {
  root.querySelectorAll(selector).forEach(control => {
    const supportedObjects = selectedObjects.filter(object => diagram2ShellObjectSupportsStyle(object, styleName));
    control.disabled = !canUse || supportedObjects.length === 0;
    if (!supportedObjects.length) {
      control.indeterminate = false;
      control.checked = Boolean(diagram2DefaultShellStyleValue(styleName));
      return;
    }
    const values = supportedObjects.map(object => Boolean(diagram2ShellStyleValue(object, styleName)));
    control.checked = values[0] === true;
    control.indeterminate = values.some(value => value !== values[0]);
  });
}

function syncDiagram2TransparentFillControl(root, selectedObjects, canUse) {
  root.querySelectorAll("[data-diagram2-transparent-fill]").forEach(control => {
    const supportedObjects = selectedObjects.filter(object => diagram2ShellObjectSupportsStyle(object, "fill"));
    control.disabled = !canUse || supportedObjects.length === 0;
    if (!supportedObjects.length) {
      control.indeterminate = false;
      control.checked = false;
      return;
    }
    const values = supportedObjects.map(object => String(diagram2ShellStyleValue(object, "fill") || "").toLowerCase() === "none");
    control.checked = values[0] === true;
    control.indeterminate = values.some(value => value !== values[0]);
  });
}

function setDiagram2StyleControlValue(control, value) {
  if (!control) return;
  if (control.type === "checkbox") {
    control.checked = value === true;
    return;
  }
  control.value = String(value ?? "");
}

function diagram2ShellObjectSupportsStyle(object, styleName) {
  const targets = diagram2ShellStyleTargets.get(String(styleName || ""));
  if (!targets) return false;
  return targets.has(diagram2ShellObjectStyleType(object));
}

function diagram2ShellObjectStyleType(object) {
  const type = String(object?.type || "").trim().toLowerCase();
  if (type === "entity" && String(object?.entityKind || "").trim().toLowerCase() === "field-rectangle") return "field-rectangle";
  return type;
}

function diagram2ShellStyleValue(object, styleName) {
  if (styleName === "fill" && String(object?.fill || "").trim().toLowerCase() === "none") return "none";
  if (styleName === "opacity") {
    const opacity = Number(object?.opacity);
    return Math.round((Number.isFinite(opacity) ? opacity : defaultDiagram2ShellStyles.opacity) * 100);
  }
  const value = object?.[styleName];
  if (value !== undefined && value !== null && value !== "") return value;
  return diagram2DefaultShellStyleValue(styleName, object);
}

function diagram2DefaultShellStyleValue(styleName, object = null) {
  if (styleName === "fill" && ["rectangle", "circle"].includes(diagram2ShellObjectStyleType(object))) return "none";
  if (Object.prototype.hasOwnProperty.call(defaultDiagram2ShellStyles, styleName)) return defaultDiagram2ShellStyles[styleName];
  return "";
}

function diagram2CurrentFillColor(root) {
  const trigger = root.querySelector("[data-annotation-color-picker='fill'] [data-annotation-color-trigger]");
  const color = normalizeDiagram2PickerColor(trigger?.dataset.richSelectedColor)
    || normalizeDiagram2PickerColor(trigger?.dataset.richColorDefault)
    || normalizeDiagram2PickerColor(defaultDiagram2ShellStyles.fill);
  return color || defaultDiagram2ShellStyles.fill;
}

async function applyDiagram2FormatStyle(root, styleName, value, options = {}) {
  const name = String(styleName || "").trim();
  if (!name || typeof options.applyStyle !== "function") return false;
  const applied = await options.applyStyle(name, value);
  if (applied === false) return false;
  if (name === "fill" && String(value || "").toLowerCase() !== "none") {
    const picker = root.querySelector("[data-annotation-color-picker='fill']");
    if (picker) {
      syncDiagram2ColorPicker(picker, value);
      rememberDiagram2Color(diagram2ColorMemoryKey(name), value);
      renderDiagram2ColorMemory(root);
    }
  }
  return true;
}

async function applyDiagram2Geometry(root, propertyInput, value, options = {}) {
  const property = String(propertyInput || "").trim();
  if (!["width", "height"].includes(property) || typeof options.applyGeometry !== "function") return false;
  return options.applyGeometry(property, value);
}

function syncDiagram2ColorPickerControls(root, selectedObjects = [], options = {}) {
  const objects = Array.isArray(selectedObjects) ? selectedObjects : [];
  const canUse = options.canEdit !== false && options.busy !== true;
  root.querySelectorAll("[data-annotation-color-picker]").forEach(picker => {
    const trigger = picker.querySelector("[data-annotation-color-trigger]");
    const fallback = normalizeDiagram2PickerColor(trigger?.dataset.richColorDefault) || "#111827";
    const name = picker.dataset.annotationColorPicker || "";
    const supportedObjects = objects.filter(object => diagram2ShellObjectSupportsStyle(object, name));
    if (trigger) trigger.disabled = !canUse || supportedObjects.length === 0;
    const color = diagram2SelectedColorValue(name, supportedObjects, fallback);
    syncDiagram2ColorPicker(picker, color);
  });
}

function diagram2SelectedColorValue(name, selectedObjects, fallback) {
  const colorName = String(name || "").trim();
  const object = selectedObjects.find(item => normalizeDiagram2PickerColor(item?.[colorName]));
  return normalizeDiagram2PickerColor(object?.[colorName]) || fallback;
}

function diagram2DimensionText(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(Math.round(number * 100) / 100) : "";
}

async function chooseDiagram2CustomPickerColor(root, picker, options = {}) {
  closeDiagram2ColorPicker(picker);
  const trigger = picker.querySelector("[data-annotation-color-trigger]");
  const current = normalizeDiagram2PickerColor(trigger?.dataset.richSelectedColor)
    || normalizeDiagram2PickerColor(trigger?.dataset.richColorDefault)
    || "#126BFF";
  const custom = typeof options.askForColor === "function"
    ? await options.askForColor(current, picker.dataset.annotationColorPicker || "")
    : await chooseNativeDiagram2Color(current);
  if (!custom) return;

  const normalized = normalizeDiagram2PickerColor(custom);
  if (!normalized) {
    options.notify?.("Enter a valid HEX or RGB color.");
    return;
  }
  rememberDiagram2CustomColor(normalized);
  await applyDiagram2PickerColor(root, picker, normalized, options);
  trigger?.focus?.({ preventScroll: true });
}

async function applyDiagram2PickerColor(root, picker, colorInput, options = {}) {
  const name = picker?.dataset?.annotationColorPicker || "";
  const trigger = picker?.querySelector?.("[data-annotation-color-trigger]");
  const fallback = normalizeDiagram2PickerColor(trigger?.dataset.richColorDefault) || "#111827";
  const color = normalizeDiagram2PickerColor(colorInput) || fallback;
  if (!name || !color) return false;

  const applied = typeof options.applyColor === "function"
    ? await options.applyColor(name, color)
    : true;
  if (applied === false) return false;

  syncDiagram2ColorPicker(picker, color);
  rememberDiagram2Color(diagram2ColorMemoryKey(name), color);
  renderDiagram2ColorMemory(root);
  closeDiagram2ColorPicker(picker);
  return true;
}

function syncDiagram2ColorPicker(picker, colorInput) {
  const color = normalizeDiagram2PickerColor(colorInput);
  if (!picker || !color) return;
  picker.style.setProperty("--rich-selected-color", color);
  const trigger = picker.querySelector("[data-annotation-color-trigger]");
  if (trigger) trigger.dataset.richSelectedColor = color;
}

function openDiagram2ColorPicker(tool) {
  const palette = tool.querySelector("[data-rich-color-palette]");
  const trigger = tool.querySelector("[data-annotation-color-trigger]");
  if (!palette || !trigger) return;
  tool.classList.add("is-open");
  palette.hidden = false;
  trigger.setAttribute("aria-expanded", "true");
  tool.closest(".dialog")?.classList.add("rich-color-palette-open");
  positionDiagram2ColorPalette(tool, palette, trigger);
}

function closeDiagram2ColorPicker(tool) {
  const palette = tool.querySelector("[data-rich-color-palette]");
  tool.classList.remove("is-open");
  if (palette) {
    palette.hidden = true;
    palette.style.removeProperty("--rich-palette-left");
    palette.style.removeProperty("--rich-palette-top");
  }
  tool.querySelector("[data-annotation-color-trigger]")?.setAttribute("aria-expanded", "false");
  const dialog = tool.closest(".dialog");
  if (dialog && !dialog.querySelector("[data-annotation-color-picker].is-open")) {
    dialog.classList.remove("rich-color-palette-open");
  }
}

function positionDiagram2ColorPalette(tool, palette, trigger) {
  const triggerRect = trigger.getBoundingClientRect();
  const paletteRect = palette.getBoundingClientRect();
  const padding = 8;
  const gap = 4;
  const left = clampDiagram2Number(triggerRect.left, padding, Math.max(padding, window.innerWidth - paletteRect.width - padding));
  const below = triggerRect.bottom + gap;
  const above = triggerRect.top - paletteRect.height - gap;
  const top = below + paletteRect.height <= window.innerHeight - padding
    ? below
    : Math.max(padding, above);
  palette.style.setProperty("--rich-palette-left", `${Math.round(left)}px`);
  palette.style.setProperty("--rich-palette-top", `${Math.round(top)}px`);
  tool.classList.add("is-open");
}

function renderDiagram2ColorMemory(root) {
  const lastColors = readDiagram2ColorList(diagram2LastColorsStorageKey);
  const recentColors = lastColors.slice(0, diagram2RecentColorLimit);
  const customColors = readDiagram2ColorList(diagram2CustomColorsStorageKey);
  root.querySelectorAll("[data-annotation-recent-colors]").forEach(container => {
    const title = container.closest(".image-annotation-color-controls")
      ?.querySelector("[data-annotation-color-trigger]")
      ?.getAttribute("aria-label") || "Color";
    container.hidden = recentColors.length === 0;
    container.innerHTML = recentColors.map(color => diagram2ColorSwatchHtml(color, title)).join("");
  });
  root.querySelectorAll("[data-rich-last-colors]").forEach(container => {
    const title = container.closest("[data-rich-color-palette]")?.previousElementSibling?.getAttribute("aria-label") || "Color";
    const section = container.closest("[data-rich-color-palette]")?.querySelector("[data-rich-last-colors-title]");
    if (section) section.hidden = lastColors.length === 0;
    container.hidden = lastColors.length === 0;
    container.innerHTML = lastColors.map(color => diagram2ColorSwatchHtml(color, title)).join("");
  });
  root.querySelectorAll("[data-rich-custom-colors]").forEach(container => {
    const title = container.closest("[data-rich-color-palette]")?.previousElementSibling?.getAttribute("aria-label") || "Color";
    container.hidden = customColors.length === 0;
    container.innerHTML = customColors.map(color => diagram2ColorSwatchHtml(color, title)).join("");
  });
}

function diagram2ColorSwatchHtml(color, title) {
  const label = `${title} ${color} ${diagram2RgbText(color)}`;
  return `<button type="button" class="rich-color-swatch" data-rich-color-value="${escapeAttr(color)}" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}" style="--rich-swatch-color: ${escapeAttr(color)}"></button>`;
}

function diagram2ColorMemoryKey(name) {
  if (name === "textColor" || name.endsWith("TextColor")) return "foreColor";
  if (name === "fill" || name.endsWith("Fill")) return "hiliteColor";
  return "annotationStroke";
}

function readDiagram2LastColor(key, fallback) {
  try {
    return normalizeDiagram2PickerColor(localStorage.getItem(`${diagram2LastColorStoragePrefix}${key}`)) || fallback;
  } catch {
    return fallback;
  }
}

function rememberDiagram2Color(key, color) {
  const normalized = normalizeDiagram2PickerColor(color);
  if (!normalized) return;
  const colors = [normalized, ...readDiagram2ColorList(diagram2LastColorsStorageKey).filter(item => item !== normalized)]
    .slice(0, diagram2StoredColorLimit);
  try {
    localStorage.setItem(diagram2LastColorsStorageKey, JSON.stringify(colors));
    localStorage.setItem(`${diagram2LastColorStoragePrefix}${key}`, normalized);
  } catch {
    // Color memory is optional when browser storage is unavailable.
  }
}

function rememberDiagram2CustomColor(color) {
  const normalized = normalizeDiagram2PickerColor(color);
  if (!normalized) return;
  const colors = [normalized, ...readDiagram2ColorList(diagram2CustomColorsStorageKey).filter(item => item !== normalized)]
    .slice(0, diagram2StoredColorLimit);
  try {
    localStorage.setItem(diagram2CustomColorsStorageKey, JSON.stringify(colors));
  } catch {
    // Color memory is optional when browser storage is unavailable.
  }
}

function readDiagram2ColorList(key) {
  try {
    const values = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(values)
      ? [...new Set(values.map(normalizeDiagram2PickerColor).filter(Boolean))].slice(0, diagram2StoredColorLimit)
      : [];
  } catch {
    return [];
  }
}

function normalizeDiagram2PickerColor(value) {
  const text = String(value || "").trim();
  const hex = text.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const digits = hex[1].length === 3
      ? hex[1].split("").map(part => part + part).join("")
      : hex[1];
    return `#${digits.toUpperCase()}`;
  }
  const rgb = text.match(/^(?:rgb\s*\()?\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*\)?$/i);
  if (!rgb) return "";
  const channels = rgb.slice(1).map(Number);
  if (channels.some(channel => channel < 0 || channel > 255)) return "";
  return `#${channels.map(channel => channel.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function diagram2RgbText(color) {
  const normalized = normalizeDiagram2PickerColor(color);
  if (!normalized) return "";
  return `rgb(${Number.parseInt(normalized.slice(1, 3), 16)}, ${Number.parseInt(normalized.slice(3, 5), 16)}, ${Number.parseInt(normalized.slice(5, 7), 16)})`;
}

function diagram2ColorTriggerApplyHalf(event, trigger) {
  if (!event.clientX) return false;
  const rect = trigger.getBoundingClientRect();
  return event.clientX <= rect.left + (rect.width / 2);
}

function chooseNativeDiagram2Color(current) {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "color";
    input.value = normalizeDiagram2PickerColor(current) || "#126BFF";
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

function clampDiagram2Number(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function cssEscapeSelector(value) {
  if (globalThis.CSS?.escape) return globalThis.CSS.escape(String(value || ""));
  return String(value || "").replace(/['\\]/g, "\\$&");
}

function diagram2ZoomOptionsHtml(selectedZoom) {
  const selectedValue = String(selectedZoom || "fit") === "fit"
    ? ""
    : diagram2ZoomOptionValue(selectedZoom);
  return Array.from({ length: 59 }, (_, index) => 10 + (index * 5))
    .map(percent => {
      const value = diagram2ZoomOptionValue(percent / 100);
      return `<option value="${escapeAttr(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(`${percent}%`)}</option>`;
    })
    .join("");
}

function diagram2ZoomOptionValue(value) {
  const zoom = Number(value);
  const rounded = Math.round((Number.isFinite(zoom) && zoom > 0 ? zoom : 1) * 20) / 20;
  return String(Number(Math.min(3, Math.max(0.1, rounded)).toFixed(2)));
}

function diagram2ObjectLabel(object) {
  return String(
    object?.name
    || object?.entityName
    || object?.fieldRectangleName
    || object?.text
    || object?.type
    || "Object"
  ).trim() || "Object";
}

function entityLabel(entity) {
  return [entity?.entitySchema, entity?.entityName]
    .map(value => String(value || "").trim())
    .filter(Boolean)
    .join(".") || diagram2ObjectLabel(entity);
}

function diagram2EntityReferenceValue(entity) {
  return [entity?.entitySchema, entity?.entityName]
    .map(value => String(value || "").trim())
    .filter(Boolean)
    .join(".");
}

function resolveDiagram2Dialog(dialog, options = {}) {
  return new Promise(resolve => {
    let result = null;
    const finish = value => {
      result = value;
      dialog.close();
    };
    dialog.querySelectorAll(options.cancelSelector || "[data-dialog-cancel]").forEach(button => {
      button.addEventListener("click", () => finish(null));
    });
    dialog.querySelector(options.submitSelector || "form")?.addEventListener("submit", event => {
      event.preventDefault();
      finish(options.value?.() ?? null);
    });
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      finish(null);
    });
    dialog.addEventListener("close", () => {
      dialog.remove();
      resolve(result);
    }, { once: true });
    dialog.showModal();
    dialog.querySelector(options.focusSelector || "input, textarea, select, button")?.focus();
  });
}

function diagram2ObjectTreeIcon(type) {
  return {
    "embedded-image": "&#128444;",
    rectangle: "&#9633;",
    circle: "&#9711;",
    arrow: "&#8599;",
    line: "&#9585;",
    textbox: "T",
    "rich-text": "R",
    entity: "&#8862;",
    "field-mapping-table": "&#8863;"
  }[type] || "&#9675;";
}

function diagram2ToolIconSvg(tool) {
  const paths = {
    select: `<path d="M5 3l13 8-6 2-3 6z" fill="currentColor" stroke="currentColor" stroke-linejoin="round"></path>`,
    pan: `<path d="M8 12V7.5a1.5 1.5 0 0 1 3 0V12M11 11V6.5a1.5 1.5 0 0 1 3 0V12M14 11V8a1.5 1.5 0 0 1 3 0v5M17 12.5V10a1.5 1.5 0 0 1 3 0v3.5c0 4-2.5 6.5-6.5 6.5H11a5 5 0 0 1-4.1-2.2L4 13.5a1.7 1.7 0 0 1 2.8-1.9L8 13"></path>`,
    "format-painter": `<path d="M4 20c2.9 0 5-1.3 5-4.1 0-1.1-.8-1.9-1.9-1.9C4.6 14 4 16.4 4 20z" fill="currentColor" stroke="currentColor"></path><path d="M8.3 14.7 18.4 4.6a2.1 2.1 0 0 1 3 3L11.3 17.7"></path><path d="M15.6 7.4l3 3"></path>`,
    crop: `<path d="M6 3v13a2 2 0 0 0 2 2h13M3 6h13a2 2 0 0 1 2 2v13"></path>`,
    image: `<rect x="3" y="4" width="18" height="16" rx="1"></rect><circle cx="8" cy="9" r="1.5"></circle><path d="m5 17 4-4 3 3 2-2 5 5"></path>`,
    rectangle: `<rect x="4" y="5" width="16" height="14"></rect>`,
    circle: `<circle cx="12" cy="12" r="8"></circle>`,
    arrow: `<path d="M5 19 19 5M11 5h8v8"></path>`,
    line: `<path d="M5 19 19 5"></path>`,
    textbox: `<path d="M4 5h16v14H4zM8 9h8M12 9v6M9.5 15h5"></path>`,
    "rich-text": `<rect x="4" y="4" width="16" height="16" rx="2"></rect><path d="M8 9h8M8 13h5M8 17h8"></path><path d="M15 13l2 2-2 2"></path>`,
    entity: `<rect x="4" y="3" width="16" height="18"></rect><path d="M4 8h16M9 8v13M4 13h16M4 17h16"></path>`,
    "field-rectangle": `<rect x="4" y="7" width="16" height="10"></rect><path d="M8 12h8"></path><path d="M18 5l3-3M18 19l3 3M6 5 3 2M6 19l3-2"></path>`,
    "field-mapping-table": `<rect x="4" y="5" width="16" height="14" rx="1"></rect><path d="M4 10h16M4 14h16M10 5v14"></path><path d="M14 17h3M14 12h3"></path>`
  };
  return `<svg class="button-svg-icon image-annotation-tool-icon" viewBox="0 0 24 24" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[tool] || ""}</svg>`;
}
