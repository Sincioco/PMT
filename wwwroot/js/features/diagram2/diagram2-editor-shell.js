import { sharedRichColorPickerHtml } from "../../components/forms.js?v=20260722-rte-toggle-state-v1";
import { escapeAttr, escapeHtml } from "../../shared/text-and-links.js";

const diagram2LastColorsStorageKey = "pmt-rich-last-colors";
const diagram2CustomColorsStorageKey = "pmt-rich-custom-colors";
const diagram2LastColorStoragePrefix = "pmt-rich-last-color-";
const diagram2StoredColorLimit = 10;
const diagram2RecentColorLimit = 6;

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
        selectedZoom
      })}
      <div class="image-annotation-main diagram2-editor-main" data-diagram2-editor-main>
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
          ${diagram2InspectorHtml(status, state, selectedIds)}
        </aside>
      </div>
      ${diagram2ContextMenuHtml()}
      ${includeFooter ? diagram2FooterHtml(options.applyLabel || "Save") : ""}
    </div>
  `;
}

export function diagram2ObjectsPaneHtml(state, selectedObjectIds = []) {
  const objects = Array.isArray(state?.objects) ? state.objects : [];
  const selected = new Set(selectedObjectIds.map(String));
  const rows = objects.slice().reverse().map(object => {
    const id = String(object.id || "");
    const type = String(object.type || "object");
    const label = diagram2ObjectLabel(object);
    return `
      <div class="image-annotation-object-tree-row ${selected.has(id) ? "is-selected" : ""}${object.visible === false ? " is-hidden" : ""}" role="treeitem" aria-selected="${selected.has(id)}" tabindex="0" draggable="false" data-action="select-diagram2-object-tree-item" data-object-id="${escapeAttr(id)}" data-diagram2-object-tree-row data-diagram2-object-id="${escapeAttr(id)}" data-diagram2-object-type="${escapeAttr(type)}">
        <span class="image-annotation-object-tree-icon" aria-hidden="true">${diagram2ObjectTreeIcon(type)}</span>
        <span class="image-annotation-object-tree-label" title="${escapeAttr(label)}">${escapeHtml(label)}</span>
        <button type="button" class="image-annotation-object-tree-visibility${object.visible === false ? " is-hidden" : ""}" data-action="toggle-diagram2-object-visibility" data-object-id="${escapeAttr(id)}" title="${object.visible === false ? "Show" : "Hide"} ${escapeAttr(label)}" aria-label="${object.visible === false ? "Show" : "Hide"} ${escapeAttr(label)}" disabled><span aria-hidden="true">&#128065;</span></button>
      </div>
    `;
  }).join("");

  return `
    <div class="diagram2-editor-objects-pane" data-diagram2-objects-pane>
      <div class="image-annotation-object-tree-actions" role="toolbar" aria-label="Object tree actions">
        <button type="button" data-action="rename-diagram2-object" data-diagram2-pending-command disabled>Rename</button>
        <button type="button" data-action="copy-diagram2-selection" data-diagram2-requires-selection>Copy</button>
        <button type="button" data-action="paste-diagram2-selection" disabled>Paste</button>
        <button type="button" data-action="delete-diagram2-selection" data-diagram2-pending-command disabled>Delete</button>
      </div>
      <label class="image-annotation-object-tree-search">
        <span>Search objects</span>
        <input type="search" placeholder="Search objects" aria-label="Search objects" autocomplete="off" data-filter="diagram2-object-search" disabled>
      </label>
      <p class="image-annotation-object-tree-help">Top items appear in front. The line shows where a dragged row will land. Drop above a group header to keep it at the root, or below the header to move it into that group.</p>
      <button type="button" class="image-annotation-object-tree-root-drop" disabled>Move to root (top)</button>
      <div class="image-annotation-object-tree diagram2-object-tree" data-diagram2-object-tree role="tree" tabindex="0" aria-label="Diagram 2 objects, topmost first">
        ${rows || `<p class="image-annotation-object-tree-empty">No objects.</p>`}
      </div>
    </div>
  `;
}

export function updateDiagram2ShellStatus(root, status = {}) {
  if (!root) return;
  const canEdit = status.canEdit !== false;
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
  root.querySelectorAll("[data-diagram2-requires-document]").forEach(control => {
    control.disabled = !hasDocument || status.busy === true;
  });
  root.querySelectorAll("[data-diagram2-requires-export]").forEach(control => {
    control.disabled = canExport === false || status.busy === true;
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
  root.querySelectorAll("[data-diagram2-requires-undo]").forEach(control => {
    control.disabled = !status.history?.canUndo || status.busy === true || canEdit === false;
  });
  root.querySelectorAll("[data-diagram2-requires-redo]").forEach(control => {
    control.disabled = !status.history?.canRedo || status.busy === true || canEdit === false;
  });
  root.querySelectorAll("[data-diagram2-pending-command]").forEach(control => {
    control.disabled = true;
  });
  const hasSelection = Number(status.selectedCount || 0) > 0;
  root.querySelectorAll("[data-diagram2-empty-selection]").forEach(node => {
    node.hidden = hasSelection;
  });
  root.querySelectorAll("[data-diagram2-selection-format]").forEach(node => {
    node.hidden = !hasSelection;
  });
  syncDiagram2ColorPickerControls(root, status.selectedObjects || []);
  syncDiagram2InspectorTabVisibility(root, status.selectedObjects || []);
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

export function bindDiagram2EditorColorPickers(root, options = {}) {
  if (!root) return;
  renderDiagram2ColorMemory(root);
  if (root.dataset.diagram2ColorPickersBound === "true") return;
  root.dataset.diagram2ColorPickersBound = "true";

  const closeAll = except => {
    root.querySelectorAll("[data-annotation-color-picker]").forEach(tool => {
      if (tool === except) return;
      closeDiagram2ColorPicker(tool);
    });
  };

  root.addEventListener("click", event => {
    const trigger = event.target?.closest?.("[data-annotation-color-trigger]");
    if (trigger && root.contains(trigger)) {
      event.preventDefault();
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
      const picker = customButton.closest("[data-annotation-color-picker]");
      if (picker) void chooseDiagram2CustomPickerColor(root, picker, options);
      return;
    }

    const swatch = event.target?.closest?.("[data-rich-color-value]");
    if (swatch && root.contains(swatch)) {
      const picker = swatch.closest("[data-annotation-color-picker]");
      const recentColors = swatch.closest("[data-annotation-recent-colors]");
      const targetPicker = picker || (recentColors
        ? root.querySelector(`[data-annotation-color-picker='${cssEscapeSelector(recentColors.dataset.annotationRecentColors || "")}']`)
        : null);
      if (!targetPicker) return;
      event.preventDefault();
      void applyDiagram2PickerColor(root, targetPicker, swatch.dataset.richColorValue, options);
      return;
    }

    if (!event.target?.closest?.("[data-annotation-color-picker], [data-annotation-recent-colors]")) closeAll();
  });

  root.addEventListener("pointerdown", event => {
    if (!event.target?.closest?.("[data-annotation-color-picker], [data-annotation-recent-colors]")) closeAll();
  });

  root.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !root.querySelector("[data-annotation-color-picker].is-open")) return;
    event.preventDefault();
    event.stopPropagation();
    closeAll();
  });
}

function diagram2ToolbarHtml({ canUse, includeActions, selectedZoom }) {
  const disabled = canUse ? "" : "disabled";
  return `
    <div class="image-annotation-toolbar diagram2-editor-toolbar" role="toolbar" aria-label="Diagram 2 tools">
      <div class="image-annotation-tool-group" aria-label="Drawing tools">
        ${diagram2ToolButton("select", "Select (V)", true, disabled)}
        ${diagram2ToolButton("pan", "Pan (H)", false, disabled)}
        ${diagram2ToolButton("format-painter", "Format Painter", false, "disabled")}
        ${diagram2ToolButton("crop", "Crop (C)", false, "disabled")}
        ${diagram2ToolButton("rectangle", "Rectangle (R)", false, `${disabled} data-diagram2-requires-update`)}
        ${diagram2ToolButton("circle", "Circle (O)", false, `${disabled} data-diagram2-requires-update`)}
        ${diagram2ToolButton("arrow", "Arrow (A)", false, `${disabled} data-diagram2-requires-update`)}
        ${diagram2ToolButton("line", "Line (L)", false, `${disabled} data-diagram2-requires-update`)}
        ${diagram2ToolButton("textbox", "Text Box (T)", false, `${disabled} data-diagram2-requires-update`)}
        ${diagram2ToolButton("rich-text", "Rich Text Editor (Y)", false, "disabled")}
        <span class="image-annotation-toolbar-separator" role="separator" aria-hidden="true"></span>
        ${diagram2ToolButton("entity", "Entity (E)", false, "disabled")}
        ${diagram2ToolButton("field-rectangle", "Field Rectangle", false, "disabled")}
        ${diagram2IconButton("Generate Field Mapping Table", "generate-diagram2-field-mapping-table", "field-mapping-table", "disabled")}
      </div>
      <div class="image-annotation-tool-group" aria-label="History">
        ${diagram2TextButton("undo-diagram2", "Undo", "Undo (Ctrl+Z)", "data-diagram2-requires-undo data-diagram2-requires-update")}
        ${diagram2TextButton("redo-diagram2", "Redo", "Redo (Ctrl+Y)", "data-diagram2-requires-redo data-diagram2-requires-update")}
        ${diagram2TextButton("delete-diagram2-selection", "Delete", "Delete selected objects", "data-diagram2-pending-command disabled")}
      </div>
      <div class="image-annotation-tool-group image-annotation-view-tools" aria-label="Canvas view">
        <label class="inline-check"><input type="checkbox" data-filter="diagram2-grid" disabled><span>Grid</span></label>
        <label class="inline-check"><input type="checkbox" data-filter="diagram2-snap" disabled><span>Snap</span></label>
        <button type="button" data-action="zoom-diagram2-out" title="Zoom Out" aria-label="Zoom Out" ${disabled}>-</button>
        <select data-filter="diagram2-zoom" class="image-annotation-zoom-select" aria-label="Zoom level" title="Zoom level" ${disabled}>
          ${diagram2ZoomOptionsHtml(selectedZoom)}
        </select>
        <button type="button" data-action="zoom-diagram2-in" title="Zoom In" aria-label="Zoom In" ${disabled}>+</button>
        <button type="button" data-action="fit-diagram2-viewer" title="Fit Diagram" aria-label="Fit Diagram" ${disabled}>Fit</button>
        <button type="button" data-action="toggle-diagram2-inspector" aria-controls="diagram2Inspector" aria-expanded="true" title="Hide Right Pane" aria-label="Hide Right Pane" ${disabled}>Hide Right Pane</button>
      </div>
      <span class="image-annotation-mode-indicator diagram2-editor-status" data-diagram2-save-state data-diagram2-shell-save-state role="status" aria-live="polite">Saved</span>
      ${includeActions ? `
        <div class="image-annotation-tool-group image-annotation-maximized-actions diagram2-editor-top-actions" aria-label="Editor actions">
          ${diagram2TextButton("cancel-diagram2-editor", "Cancel", "Cancel", "")}
          ${diagram2TextButton("save-diagram2-document", "Save", "Save Diagram", "data-diagram2-requires-dirty data-diagram2-requires-update")}
        </div>
      ` : ""}
    </div>
  `;
}

function diagram2InspectorHtml(status = {}, state = null, selectedIds = []) {
  return `
    <div class="image-annotation-inspector-tabs" role="tablist" aria-label="Diagram 2 right pane">
      ${diagram2InspectorTab("format", "Format", true)}
      ${diagram2InspectorTab("crop", "Crop", false, false, true)}
      ${diagram2InspectorTab("field-mapping-table", "Mapping", false, false, true)}
      ${diagram2InspectorTab("entity", "Entity", false, false, true)}
      ${diagram2InspectorTab("template", "Template", false)}
      ${diagram2InspectorTab("objects", "Objects", false)}
    </div>
    <p class="image-annotation-selection-label" data-diagram2-selection-label data-diagram2-edit-state>${status.selectedCount ? `${status.selectedCount} selected` : "No selection"}</p>
    <div id="diagram2FormatPanel" role="tabpanel" aria-labelledby="diagram2FormatTab" data-diagram2-inspector-panel="format">
      <p class="image-annotation-format-status diagram2-empty-selection" data-diagram2-empty-selection>Select an object on the canvas or in the Objects pane to edit its available properties.</p>
      <section class="image-annotation-format-section" aria-labelledby="diagram2ShapeFormat" data-diagram2-selection-format hidden>
        <h4 id="diagram2ShapeFormat">Shape</h4>
        <div class="image-annotation-inspector-grid">
          ${diagram2ColorFieldHtml("fill", "Fill", "Background Color", "#ffffff", "background")}
          ${diagram2ColorFieldHtml("stroke", "Outline color", "Outline Color", "#42526b", "outline")}
          <label class="inline-check image-annotation-wide"><input type="checkbox" checked disabled><span>Outline</span></label>
          <label class="inline-check image-annotation-wide"><input type="checkbox" disabled><span>Transparent fill</span></label>
          <label class="field image-annotation-wide"><span>Opacity (%)</span><input type="number" min="0" max="100" step="1" value="100" disabled></label>
          <label class="field"><span>Line width</span><input type="number" min="1" max="40" value="2" disabled></label>
          <label class="field"><span>Arrow head</span><input type="number" min="6" max="160" value="10" disabled></label>
        </div>
      </section>
      <section class="image-annotation-format-section" aria-labelledby="diagram2TextFormat" data-diagram2-selection-format hidden>
        <h4 id="diagram2TextFormat">Text</h4>
        <div class="image-annotation-inspector-grid">
          ${diagram2ColorFieldHtml("textColor", "Text color", "Font Color", "#172b4d", "font")}
          <label class="field"><span>Font</span><select disabled><option>Arial</option></select></label>
          <label class="field"><span>Font size</span><input type="number" min="1" max="240" value="18" disabled></label>
          <label class="field"><span>Horizontal alignment</span><select disabled><option>Left</option><option>Center</option><option>Right</option></select></label>
          <label class="field"><span>Vertical alignment</span><select disabled><option>Top</option><option>Middle</option><option>Bottom</option></select></label>
        </div>
      </section>
    </div>
    <div id="diagram2CropPanel" role="tabpanel" aria-labelledby="diagram2CropTab" data-diagram2-inspector-panel="crop" hidden>
      <section class="image-annotation-format-section" aria-labelledby="diagram2CropFormat">
        <h4 id="diagram2CropFormat">Crop</h4>
        <p class="image-annotation-format-status">Crop controls appear for selected embedded images.</p>
      </section>
    </div>
    <div id="diagram2MappingPanel" role="tabpanel" aria-labelledby="diagram2MappingTab" data-diagram2-inspector-panel="field-mapping-table" hidden>
      <section class="image-annotation-format-section" aria-labelledby="diagram2MappingFormat">
        <h4 id="diagram2MappingFormat">Field Mapping Table</h4>
        <div class="image-annotation-inspector-grid">
          ${diagram2ColorFieldHtml("headerTextColor", "Header text", "Header Text Color", "#172b4d", "font")}
          ${diagram2ColorFieldHtml("headerFill", "Header background", "Header Background Color", "#d9ecff", "background")}
          ${diagram2ColorFieldHtml("uiTextColor", "UI field text", "UI Field Text Color", "#172b4d", "font")}
          ${diagram2ColorFieldHtml("uiFill", "UI field background", "UI Field Background Color", "#ffffff", "background")}
          ${diagram2ColorFieldHtml("databaseTextColor", "Database text", "Database Text Color", "#172b4d", "font")}
          ${diagram2ColorFieldHtml("databaseFill", "Database background", "Database Background Color", "#ffffff", "background")}
        </div>
      </section>
    </div>
    <div id="diagram2EntityPanel" role="tabpanel" aria-labelledby="diagram2EntityTab" data-diagram2-inspector-panel="entity" hidden>
      <section class="image-annotation-format-section image-annotation-entity-format" aria-labelledby="diagram2EntityFormat">
        <h4 id="diagram2EntityFormat">Entity</h4>
        <div class="field image-annotation-entity-annotation-field">
          <span>Entity Annotation</span>
          <button type="button" disabled>Add Entity Annotation</button>
          <small>No annotation</small>
        </div>
        <div class="image-annotation-inspector-grid">
          ${diagram2ColorFieldHtml("entityNameTextColor", "Entity name text color", "Entity Name Text Color", "#172b4d", "font")}
          ${diagram2ColorFieldHtml("entityHeaderFill", "Header background color", "Entity Header Background Color", "#ffffff", "background")}
        </div>
      </section>
    </div>
    <div id="diagram2TemplatePanel" role="tabpanel" aria-labelledby="diagram2TemplateTab" data-diagram2-inspector-panel="template" hidden>
      <div class="image-annotation-template-actions">
        <p>Templates use Diagram 1-compatible template storage. Template mutation commands are enabled in a later parity phase.</p>
        <button type="button" disabled>Save Selection as Template</button>
        <button type="button" disabled>Upload Template</button>
        <button type="button" disabled>Restore Default Templates</button>
      </div>
    </div>
    <div id="diagram2ObjectsPanel" role="tabpanel" aria-labelledby="diagram2ObjectsTab" data-diagram2-inspector-panel="objects" hidden>
      ${diagram2ObjectsPaneHtml(state, selectedIds)}
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
      ${diagram2ContextMenuItemHtml("crop", "Crop", diagram2ToolIconSvg("crop"), true)}
      ${diagram2ContextMenuItemHtml("copy-diagram2-selection", "Copy Selection", "&#128203;")}
      ${diagram2ContextMenuItemHtml("export-diagram2-svg", "Export SVG", "&#10697;")}
      ${diagram2ContextMenuItemHtml("export-diagram2-png", "Export PNG", "&#9635;")}
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

function diagram2ToolButton(tool, label, pressed = false, attributes = "") {
  return `<button type="button" data-action="set-diagram2-tool" data-diagram2-tool="${escapeAttr(tool)}" data-tool="${escapeAttr(tool)}" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}" aria-pressed="${pressed}" class="${pressed ? "is-active" : ""}" ${attributes}><span class="button-icon" aria-hidden="true">${diagram2ToolIconSvg(tool)}</span></button>`;
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
  const visibleTabs = {
    format: true,
    crop: type === "embedded-image",
    "field-mapping-table": type === "field-mapping-table",
    entity: type === "entity" || type === "field-rectangle",
    template: true,
    objects: true
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

function syncDiagram2ColorPickerControls(root, selectedObjects = []) {
  const objects = Array.isArray(selectedObjects) ? selectedObjects : [];
  root.querySelectorAll("[data-annotation-color-picker]").forEach(picker => {
    const trigger = picker.querySelector("[data-annotation-color-trigger]");
    const fallback = normalizeDiagram2PickerColor(trigger?.dataset.richColorDefault) || "#111827";
    const color = diagram2SelectedColorValue(picker.dataset.annotationColorPicker, objects, fallback);
    syncDiagram2ColorPicker(picker, color);
  });
}

function diagram2SelectedColorValue(name, selectedObjects, fallback) {
  const colorName = String(name || "").trim();
  const object = selectedObjects.find(item => normalizeDiagram2PickerColor(item?.[colorName]));
  return normalizeDiagram2PickerColor(object?.[colorName]) || fallback;
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
