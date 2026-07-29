import { buttonContent, funnelIconHtml, pageActionsMenuHtml } from "../../components/buttons.js?v=20260717-multi-screen-header";
import { copyTextToClipboard } from "../../components/clipboard.js?v=20260714-invite-email-body";
import {
  diagramCardHtml as sharedDiagramCardHtml
} from "../../components/entity-cards.js?v=20260722-rich-entity-mentions-v1";
import {
  checkedFilterValues,
  filterCheckList,
  filterSelect
} from "../../components/filters.js";
import { field, optionalNumberValue, selectOptionsField, value } from "../../components/forms.js?v=20260722-rte-toggle-state-v1";
import {
  buildAnnotationSvg,
  buildPortableAnnotationState,
  cleanAnnotationSvgForExternalUse,
  copyAnnotationPngToClipboard,
  copyAnnotationSvgToClipboard,
  annotationClipboardHasImage,
  annotationClipboardImageFile,
  annotationSvgToPngBlob
} from "../../components/image-annotation.js?v=20260728-diagram2-phase4-v5";
import { buildPmtDatabaseSchemaDiagram } from "../diagram/pmt-database-schema.js?v=20260724-day36-v3";
import { openPublicLinkDialog } from "../../components/public-links.js?v=20260725-day36-v4";
import { sectionHead } from "../../components/sections.js?v=20260726-diagram2-nav-icon-v1";
import { api } from "../../core/api.js?v=20260725-public-link-v1";
import { currentUserId } from "../../core/authentication.js?v=20260715-admin-impersonation";
import {
  preferenceKeys,
  readBooleanPreference,
  readJsonPreference,
  readNumberPreference,
  readPreference,
  writeJsonPreference,
  writePreference
} from "../../core/preferences.js?v=20260726-d2-flat-diagnostics-v1";
import { routeForContent, updateBrowserUrl } from "../../core/router.js?v=20260726-diagram2-nav-icon-v1";
import { state } from "../../core/store.js";
import {
  blankDiagramSource,
  decodeDiagramSvgDataUrl,
  diagramAllDocuments,
  diagramDocumentImage,
  diagramLatestUpdatedHistory,
  diagramLastEditorUserId,
  diagramSourceIsSvg,
  diagramUpdatedTime,
  loadDiagramCanonicalState,
  loadDiagramSvgSource
} from "../../shared/diagram-documents.js?v=20260725-diagram2-day6-v1";
import { appUrl } from "../../shared/app-urls.js";
import { formatDate } from "../../shared/dates.js";
import { canAccessResource } from "../../shared/security.js";
import { escapeAttr, escapeHtml } from "../../shared/text-and-links.js";
import {
  createDiagram2PmtDiagramFile,
  diagram2CompatibilitySummary,
  parseDiagram2PmtDiagramFile
} from "./diagram2-compatibility.js?v=20260728-diagram2-phase4-v5";
import { createDiagram2DocumentHostAdapter } from "./diagram2-document-host-adapter.js?v=20260726-diagram2-phase2-v1";
import {
  createDiagram2EditorController,
  isDiagram2CoreDrawingTool
} from "./diagram2-editor-controller.js?v=20260729-diagram2-phase5-closure-v1";
import { bindDiagram2EditorInteractions } from "./diagram2-editor-interactions.js?v=20260729-diagram2-phase5-closure-v1";
import {
  bindDiagram2EditorColorPickers,
  bindDiagram2EditorFormatControls,
  bindDiagram2EditorInspectorResize,
  bindDiagram2EditorLeftPaneResize,
  copyDiagram2SelectionArtwork,
  diagram2EditorShellHtml,
  diagram2ObjectsPaneHtml,
  openDiagram2CompactProgress,
  diagram2TemplatePaneHtml,
  openDiagram2EntityEditor,
  openDiagram2RelationshipEditor,
  openDiagram2TextEditor,
  setDiagram2InspectorActiveTab,
  setDiagram2ObjectsPaneOpen,
  setDiagram2TemplatesPaneOpen,
  setDiagram2ToolsPaneOpen,
  syncDiagram2RendererViewportInset,
  updateDiagram2ObjectTreeSelection,
  updateDiagram2ShellStatus
} from "./diagram2-editor-shell.js?v=20260729-diagram2-phase5-closure-v1";
import {
  captureDiagram2SelectionTemplate,
  createDiagram2TemplateState,
  diagram2TemplateCapacityReached,
  diagram2TemplateDownload,
  parseDiagram2TemplateUpload,
  persistDiagram2TemplateLibrary,
  restoreDiagram2DefaultTemplates
} from "./diagram2-editor-templates.js?v=20260728-diagram2-phase4-v5";
import {
  createDiagram2Renderer,
  normalizeDiagram2CanonicalState
} from "./diagram2-renderer.js?v=20260729-diagram2-phase5-closure-v1";

const diagram2ViewModes = new Set(["tree", "cards"]);
const diagram2SortModes = new Set(["latest", "oldest", "name", "custom"]);
const diagram2VisibilityModes = new Set(["both", "private", "public"]);
const diagram2MinimumZoom = 0.1;
const diagram2MaximumZoom = 3;
const diagram2ZoomStep = 0.05;
const diagram2TreePaneMinimumWidth = 220;
const diagram2TreePaneMaximumWidth = 560;
const diagram2Compatibility = diagram2CompatibilitySummary();
const diagram2HistoryLimit = 100;
const collapsedDiagram2DocumentIds = new Set();
const diagram2SvgSearchTextCache = new Map();

export function createDiagram2Feature({
  app,
  notify,
  createDiagramDocument,
  saveDiagramDocument,
  openEditor,
  bindRichTextButtons,
  uploadEmbeddedImage,
  saveDiagramInfo,
  moveDiagramDocument,
  deleteItem,
  askForText,
  confirm,
  loadTemplateLibrary,
  loadDefaultTemplateLibrary,
  saveTemplateLibrary,
  loadPmtDatabaseSchema
} = {}) {
  let active = false;
  let diagram2Creating = false;
  let selectedDiagramDocumentId = readNumberPreference(
    preferenceKeys.diagramSelectedDocument,
    readNumberPreference(preferenceKeys.diagram2SelectedDocument, 0)
  );
  let diagram2ViewMode = diagram2ViewModes.has(readPreference(preferenceKeys.diagramViewMode, "tree"))
    ? readPreference(preferenceKeys.diagramViewMode, "tree")
    : "tree";
  let diagram2TreePaneWidth = clampTreePaneWidth(readNumberPreference(preferenceKeys.diagramTreePaneWidth, 300));
  let diagram2TreePaneHidden = readBooleanPreference(preferenceKeys.diagramTreePaneHidden, false);
  let diagram2Search = readPreference(preferenceKeys.diagramSearch, "").trim();
  let diagram2ProjectId = readNumberPreference(preferenceKeys.diagramProject, 0);
  let diagram2SprintId = readPreference(preferenceKeys.diagramSprint, "all");
  let diagram2Visibility = diagram2VisibilityModes.has(readPreference(preferenceKeys.diagramVisibility, "both"))
    ? readPreference(preferenceKeys.diagramVisibility, "both")
    : "both";
  let diagram2Sort = diagram2SortModes.has(readPreference(preferenceKeys.diagramSort, "latest"))
    ? readPreference(preferenceKeys.diagramSort, "latest")
    : "latest";
  let diagram2CreatorFilters = normalizeSavedArray(readJsonPreference(preferenceKeys.diagramCreatorFilters, []));
  let diagram2LastEditorFilters = normalizeSavedArray(readJsonPreference(preferenceKeys.diagramLastEditorFilters, []));
  let diagram2ViewerZoom = normalizeDiagram2Zoom(readPreference(preferenceKeys.diagram2ViewerZoom, "fit"));
  let diagram2DiagnosticsVisible = readBooleanPreference(preferenceKeys.diagram2DiagnosticsVisible, false);
  let viewerHydrationToken = 0;
  let diagram2SearchLoadToken = 0;
  let dragAbortController = null;
  let diagram2Renderer = null;
  let diagram2RendererDocumentId = 0;
  let diagram2RendererState = null;
  let diagram2SelectedObjectIds = [];
  let diagram2Busy = false;
  let diagram2GeneratingDatabaseSchema = false;
  let viewportAbortController = null;
  let viewportPanAbortController = null;
  let diagram2IgnoringScrollEvent = false;
  let diagram2IgnoreScrollTimer = 0;
  let diagram2ReadonlyScrollPosition = null;
  let diagram2Controller = null;
  let diagram2HostAdapter = null;
  let diagram2TreeContextMenuController = null;
  let diagram2DocumentMode = "readonly";
  let diagram2ModeDocumentId = 0;
  let diagram2ClipboardImageBusy = false;
  let diagram2ObjectSearch = "";
  let diagram2TemplateState = null;
  let diagram2ObjectTreeDrag = null;

  function syncDiagram2LeftNavContextFromStorage() {
    selectedDiagramDocumentId = readNumberPreference(preferenceKeys.diagramSelectedDocument, selectedDiagramDocumentId);
    const viewMode = readPreference(preferenceKeys.diagramViewMode, "tree");
    diagram2ViewMode = diagram2ViewModes.has(viewMode) ? viewMode : "tree";
    diagram2TreePaneWidth = clampTreePaneWidth(readNumberPreference(preferenceKeys.diagramTreePaneWidth, 300));
    diagram2TreePaneHidden = readBooleanPreference(preferenceKeys.diagramTreePaneHidden, false);
    diagram2Search = readPreference(preferenceKeys.diagramSearch, "").trim();
    diagram2ProjectId = readNumberPreference(preferenceKeys.diagramProject, 0);
    diagram2SprintId = readPreference(preferenceKeys.diagramSprint, "all");
    const visibility = readPreference(preferenceKeys.diagramVisibility, "both");
    diagram2Visibility = diagram2VisibilityModes.has(visibility) ? visibility : "both";
    const sort = readPreference(preferenceKeys.diagramSort, "latest");
    diagram2Sort = diagram2SortModes.has(sort) ? sort : "latest";
    diagram2CreatorFilters = normalizeSavedArray(readJsonPreference(preferenceKeys.diagramCreatorFilters, []));
    diagram2LastEditorFilters = normalizeSavedArray(readJsonPreference(preferenceKeys.diagramLastEditorFilters, []));
  }

  function render() {
    const wasActive = active;
    active = true;
    if (!wasActive) syncDiagram2LeftNavContextFromStorage();
    abortTreePaneDrag();
    const routeDocumentId = currentRouteDocumentId();
    const allDocuments = diagram2AllDocuments();
    const allDocumentIds = new Set(allDocuments.map(document => document.id));

    if (routeDocumentId) {
      if (allDocumentIds.has(routeDocumentId)) {
        selectedDiagramDocumentId = routeDocumentId;
        writePreference(preferenceKeys.diagramSelectedDocument, selectedDiagramDocumentId);
      } else {
        selectedDiagramDocumentId = 0;
      }
    }

    let documents = diagram2Documents(allDocuments, selectedDiagramDocumentId);
    if (!allDocumentIds.has(selectedDiagramDocumentId)) {
      selectedDiagramDocumentId = documents[0]?.id || allDocuments[0]?.id || 0;
      if (selectedDiagramDocumentId) writePreference(preferenceKeys.diagramSelectedDocument, selectedDiagramDocumentId);
      documents = diagram2Documents(allDocuments, selectedDiagramDocumentId);
      if (currentRouteIsDiagram2DocumentRoute()) {
        updateBrowserUrl(routeForContent("diagram-2", selectedDiagramDocumentId), { replace: true });
      }
    }

    const selectedDocument = allDocuments.find(document => document.id === selectedDiagramDocumentId) || null;
    const selectedMissingId = selectedDocument ? 0 : selectedDiagramDocumentId;
    const selectedDocumentId = selectedDocument?.id || 0;
    if (selectedDocumentId !== diagram2ModeDocumentId) {
      diagram2DocumentMode = "readonly";
      diagram2ModeDocumentId = selectedDocumentId;
      resetDiagram2ViewerToFit();
    }
    const isEditMode = diagram2DocumentIsEditMode(selectedDocument);
    const hydrationToken = ++viewerHydrationToken;
    resetDiagram2Renderer();
    globalThis.__pmtDiagram2Compatibility = diagram2Compatibility;
    globalThis.document?.body?.classList.toggle("diagram2-edit-mode-active", isEditMode);

    app.innerHTML = `
      <section class="diagram-screen diagram2-screen ${isEditMode ? "is-editor-view" : (diagram2ViewMode === "cards" ? "is-card-view" : "is-tree-view")}" data-diagram2-screen data-diagram2-mode="${isEditMode ? "edit" : "readonly"}" ${diagram2CompatibilityAttributes()}>
        ${isEditMode ? diagram2EditWorkspaceHtml(selectedDocument) : `
          ${sectionHead("Diagram 2", `${diagram2PageDocumentHeaderHtml(selectedDocument)}${diagram2HeaderActionsHtml(selectedDocument)}`)}
          <input type="file" accept=".pmt-diagram.json,application/json" data-diagram2-import-input hidden>
          ${diagram2ViewMode === "tree"
            ? diagram2TreeViewHtml(documents, selectedDocument, selectedMissingId)
            : diagram2CardViewHtml(documents)}
        `}
      </section>
    `;

    bindDiagram2Controls();
    hydrateDiagram2Viewer(hydrationToken, selectedDocument);
    if (diagram2Search) scheduleDiagram2SearchSourceLoad();
  }

  function deactivate() {
    active = false;
    viewerHydrationToken += 1;
    diagram2DocumentMode = "readonly";
    diagram2ModeDocumentId = 0;
    abortTreePaneDrag();
    abortDiagram2TreeContextMenu();
    globalThis.document?.body?.classList.remove("diagram2-edit-mode-active");
    resetDiagram2Renderer();
  }

  async function handleAction(action, id, button) {
    if (action === "set-diagram2-view") {
      diagram2ViewMode = diagram2ViewModes.has(button?.dataset?.mode) ? button.dataset.mode : "tree";
      writePreference(preferenceKeys.diagramViewMode, diagram2ViewMode);
      render();
      return true;
    }
    if (action === "toggle-diagram2-tree-pane") {
      if (diagram2ViewMode !== "tree" || diagram2Creating || diagram2DocumentMode === "edit") return true;
      diagram2TreePaneHidden = !diagram2TreePaneHidden;
      writePreference(preferenceKeys.diagramTreePaneHidden, diagram2TreePaneHidden);
      render();
      return true;
    }
    if (action === "new-diagram2") {
      await createNewDiagram2();
      return true;
    }
    if (action === "import-diagram2-pmt") {
      app.querySelector("[data-diagram2-import-input]")?.click();
      return true;
    }
    if (action === "select-diagram2-document" || action === "select-diagram2-card") {
      selectDiagram2Document(id);
      return true;
    }
    if (action === "toggle-diagram2-tree-node") {
      if (collapsedDiagram2DocumentIds.has(id)) collapsedDiagram2DocumentIds.delete(id);
      else collapsedDiagram2DocumentIds.add(id);
      render();
      return true;
    }
    if (action === "open-diagram2-filters") {
      openDiagram2FiltersDialog();
      return true;
    }
    if (action === "edit-diagram2-info") {
      const document = diagram2AllDocuments().find(item => item.id === (id || selectedDiagramDocumentId));
      if (document && diagram2CanEdit(document)) editDiagram2Info(document);
      return true;
    }
    if (action === "edit-diagram2-document") {
      const document = diagram2AllDocuments().find(item => item.id === (id || selectedDiagramDocumentId));
      if (document && diagram2CanEdit(document)) {
        diagram2DocumentMode = "edit";
        diagram2ModeDocumentId = document.id;
        resetDiagram2ViewerToFit();
        render();
      }
      return true;
    }
    if (action === "cancel-diagram2-editor") {
      if (diagram2DocumentMode === "edit") await closeDiagram2Editor();
      return true;
    }
    if (action === "delete-diagram2") {
      const document = diagram2AllDocuments().find(item => item.id === (id || selectedDiagramDocumentId));
      if (document && diagram2CanDelete(document)) await deleteDiagram2Document(document);
      return true;
    }
    if (action === "copy-public-diagram2-link") {
      const document = diagram2AllDocuments().find(item => item.id === (id || selectedDiagramDocumentId));
      if (document) await copyDiagram2PublicLink(document);
      return true;
    }
    if (action === "duplicate-diagram2") {
      const document = diagram2AllDocuments().find(item => item.id === (id || selectedDiagramDocumentId));
      if (document) await duplicateDiagram2(document);
      return true;
    }
    if (action === "set-diagram2-tool") {
      if (!diagram2EditModeActive()) return true;
      const tool = button?.dataset?.tool || button?.dataset?.diagram2Tool || "select";
      if (tool === "entity") await addDiagram2EntityFromDialog();
      else if (isDiagram2CoreDrawingTool(tool)) await addDiagram2ToolbarObject(tool);
      else if (tool === "format-painter") {
        if (diagram2Controller?.activeTool() === "format-painter") diagram2Controller.cancelFormatPainter();
        else diagram2Controller?.beginFormatPainter();
      }
      else diagram2Controller?.setActiveTool(tool);
      updateDiagram2EditorControls();
      return true;
    }
    if (action === "edit-diagram2-entity") {
      if (!diagram2EditModeActive()) return true;
      await editDiagram2SelectedEntity();
      return true;
    }
    if (action === "add-diagram2-relationship") {
      if (!diagram2EditModeActive()) return true;
      await addDiagram2RelationshipFromDialog();
      return true;
    }
    if (action === "add-diagram2-entity-field") {
      if (!diagram2EditModeActive()) return true;
      await addDiagram2SelectedEntityField();
      return true;
    }
    if (action === "move-diagram2-entity-field-up" || action === "move-diagram2-entity-field-down") {
      if (!diagram2EditModeActive()) return true;
      await moveDiagram2SelectedEntityField(
        Number.parseInt(button?.dataset?.diagram2EntityFieldIndex, 10),
        action === "move-diagram2-entity-field-up" ? "up" : "down"
      );
      return true;
    }
    if (action === "remove-diagram2-entity-field") {
      if (!diagram2EditModeActive()) return true;
      await removeDiagram2SelectedEntityField(Number.parseInt(button?.dataset?.diagram2EntityFieldIndex, 10));
      return true;
    }
    if (action === "auto-format-diagram2-compact") {
      if (!diagram2EditModeActive()) return true;
      await autoFormatDiagram2Compact();
      return true;
    }
    if (action === "generate-diagram2-pmt-schema") {
      await generateDiagram2PmtDatabaseSchema();
      return true;
    }
    if (action === "use-diagram2-relationship-route") {
      if (!diagram2EditModeActive()) return true;
      await useDiagram2SelectedRelationshipRoute();
      return true;
    }
    if (action === "add-diagram2-relationship-route-point") {
      if (!diagram2EditModeActive()) return true;
      await addDiagram2SelectedRelationshipRoutePoint();
      return true;
    }
    if (action === "remove-diagram2-relationship-route-point") {
      if (!diagram2EditModeActive()) return true;
      await removeDiagram2SelectedRelationshipRoutePoint();
      return true;
    }
    if (action === "clear-diagram2-relationship-route") {
      if (!diagram2EditModeActive()) return true;
      await clearDiagram2SelectedRelationshipRoute();
      return true;
    }
    if (action === "select-diagram2-object-tree-item") {
      if (!diagram2EditModeActive()) return true;
      await selectDiagram2StructureNode(button);
      return true;
    }
    if (action === "group-diagram2-selection") {
      if (!diagram2EditModeActive()) return true;
      await groupDiagram2Selection();
      return true;
    }
    if (action === "ungroup-diagram2-selection") {
      if (!diagram2EditModeActive()) return true;
      await ungroupDiagram2Selection();
      return true;
    }
    if (action === "rename-diagram2-object") {
      if (!diagram2EditModeActive()) return true;
      await renameDiagram2StructureNode(button);
      return true;
    }
    if (action === "delete-diagram2-object-tree-item") {
      if (!diagram2EditModeActive()) return true;
      await deleteDiagram2StructureNode(button);
      return true;
    }
    if (action === "lock-diagram2-object-tree-item") {
      if (!diagram2EditModeActive()) return true;
      await toggleDiagram2StructureLock(button);
      return true;
    }
    if (action === "toggle-diagram2-object-visibility") {
      if (!diagram2EditModeActive()) return true;
      await toggleDiagram2StructureVisibility(button);
      return true;
    }
    if (action === "toggle-diagram2-selection-visibility") {
      if (!diagram2EditModeActive()) return true;
      await toggleDiagram2SelectionVisibility();
      return true;
    }
    if (action === "reorder-diagram2-object-root") {
      if (!diagram2EditModeActive()) return true;
      await reorderDiagram2StructureNode({
        targetKind: "root",
        targetId: "",
        targetPlacement: "inside"
      });
      return true;
    }
    if (action === "save-diagram2-selection-template") {
      if (!diagram2EditModeActive()) return true;
      await saveDiagram2SelectionTemplate();
      return true;
    }
    if (action === "upload-diagram2-template") {
      if (!diagram2EditModeActive()) return true;
      app.querySelector("[data-diagram2-template-upload-input]")?.click();
      return true;
    }
    if (action === "restore-diagram2-default-templates") {
      if (!diagram2EditModeActive()) return true;
      await restoreDiagram2Templates();
      return true;
    }
    if (action === "apply-diagram2-template") {
      if (!diagram2EditModeActive()) return true;
      await applyDiagram2TemplateById(button?.dataset?.templateId);
      return true;
    }
    if (action === "format-diagram2-template") {
      if (!diagram2EditModeActive()) return true;
      await formatDiagram2SelectionFromTemplate(button?.dataset?.templateId);
      return true;
    }
    if (action === "rename-diagram2-template") {
      if (!diagram2EditModeActive()) return true;
      await renameDiagram2Template(button?.dataset?.templateId);
      return true;
    }
    if (action === "update-diagram2-template") {
      if (!diagram2EditModeActive()) return true;
      await updateDiagram2TemplateFromSelection(button?.dataset?.templateId);
      return true;
    }
    if (action === "move-diagram2-template-up" || action === "move-diagram2-template-down") {
      if (!diagram2EditModeActive()) return true;
      await moveDiagram2Template(button?.dataset?.templateId, action.endsWith("-up") ? -1 : 1);
      return true;
    }
    if (action === "download-diagram2-template") {
      if (!diagram2EditModeActive()) return true;
      downloadDiagram2TemplateById(button?.dataset?.templateId);
      return true;
    }
    if (action === "delete-diagram2-template") {
      if (!diagram2EditModeActive()) return true;
      await deleteDiagram2Template(button?.dataset?.templateId);
      return true;
    }
    if (action === "set-diagram2-rectangle-default" || action === "set-diagram2-arrow-default") {
      if (!diagram2EditModeActive()) return true;
      await setDiagram2DrawingDefault(action.includes("rectangle") ? "rectangle" : "arrow");
      return true;
    }
    if (action === "reset-diagram2-rectangle-default" || action === "reset-diagram2-arrow-default") {
      if (!diagram2EditModeActive()) return true;
      await resetDiagram2DrawingDefault(action.includes("rectangle") ? "rectangle" : "arrow");
      return true;
    }
    if (action === "set-diagram2-inspector-tab") {
      if (!diagram2EditModeActive()) return true;
      setDiagram2InspectorActiveTab(
        app.querySelector("[data-diagram2-editor-shell]"),
        button?.dataset?.diagram2InspectorTab
      );
      return true;
    }
    if (action === "toggle-diagram2-inspector") {
      if (!diagram2EditModeActive()) return true;
      const main = app.querySelector("[data-diagram2-editor-main]");
      main?.classList.toggle("is-inspector-hidden");
      syncDiagram2InspectorToggleState();
      return true;
    }
    if (action === "toggle-diagram2-tools-pane") {
      if (!diagram2EditModeActive()) return true;
      setDiagram2ToolsPaneOpen(app);
      syncDiagram2VisibleViewportInset({ refit: false });
      return true;
    }
    if (action === "toggle-diagram2-objects-pane") {
      if (!diagram2EditModeActive()) return true;
      setDiagram2ObjectsPaneOpen(app);
      syncDiagram2VisibleViewportInset({ refit: false });
      return true;
    }
    if (action === "toggle-diagram2-templates-pane") {
      if (!diagram2EditModeActive()) return true;
      setDiagram2TemplatesPaneOpen(app);
      syncDiagram2VisibleViewportInset({ refit: false });
      return true;
    }
    if (action === "toggle-diagram2-diagnostics") {
      diagram2DiagnosticsVisible = !diagram2DiagnosticsVisible;
      writePreference(preferenceKeys.diagram2DiagnosticsVisible, diagram2DiagnosticsVisible);
      render();
      return true;
    }
    if (action === "zoom-diagram2-in") {
      diagram2ViewerZoom = nextDiagram2Zoom(diagram2CurrentViewportScale(), 1);
      writePreference(preferenceKeys.diagram2ViewerZoom, diagram2ViewerZoom);
      applyDiagram2ViewerZoom();
      return true;
    }
    if (action === "zoom-diagram2-out") {
      diagram2ViewerZoom = nextDiagram2Zoom(diagram2CurrentViewportScale(), -1);
      writePreference(preferenceKeys.diagram2ViewerZoom, diagram2ViewerZoom);
      applyDiagram2ViewerZoom();
      return true;
    }
    if (action === "fit-diagram2-viewer") {
      diagram2ViewerZoom = "fit";
      writePreference(preferenceKeys.diagram2ViewerZoom, diagram2ViewerZoom);
      applyDiagram2ViewerZoom();
      return true;
    }
    if (action === "refresh-diagram2-renderer") {
      if (!diagram2EditModeActive()) {
        const document = currentDiagram2Document();
        if (document) await hydrateDiagram2Viewer(++viewerHydrationToken, document);
        return true;
      }
      refreshDiagram2Renderer();
      return true;
    }
    if (action === "save-diagram2-document") {
      if (!diagram2EditModeActive()) return true;
      await saveDiagram2Document();
      return true;
    }
    if (action === "undo-diagram2") {
      if (!diagram2EditModeActive()) return true;
      await undoDiagram2();
      return true;
    }
    if (action === "redo-diagram2") {
      if (!diagram2EditModeActive()) return true;
      await redoDiagram2();
      return true;
    }
    if (action === "export-diagram2-pmt") {
      await exportDiagram2Pmt();
      return true;
    }
    if (action === "export-diagram2-svg") {
      await exportDiagram2Svg();
      return true;
    }
    if (action === "export-diagram2-png") {
      await exportDiagram2Png();
      return true;
    }
    if (action === "copy-diagram2-svg") {
      await copyDiagram2Svg();
      return true;
    }
    if (action === "copy-diagram2-png") {
      await copyDiagram2Png();
      return true;
    }
    if (action === "copy-diagram2-selection") {
      if (!diagram2EditModeActive()) return true;
      await copyDiagram2Selection();
      return true;
    }
    if (action === "copy-diagram2-selection-svg" || action === "copy-diagram2-selection-image") {
      if (!diagram2EditModeActive()) return true;
      await copyDiagram2SelectionAsArtwork(action.endsWith("-image") ? "image" : "svg");
      return true;
    }
    if (action === "paste-diagram2-selection") {
      if (!diagram2EditModeActive()) return true;
      await pasteDiagram2Selection();
      return true;
    }
    if (action === "duplicate-diagram2-selection") {
      if (!diagram2EditModeActive()) return true;
      await duplicateDiagram2Selection();
      return true;
    }
    if (action === "delete-diagram2-selection") {
      if (!diagram2EditModeActive()) return true;
      await deleteDiagram2Selection();
      return true;
    }
    if (action === "lock-diagram2-selection") {
      if (!diagram2EditModeActive()) return true;
      await toggleDiagram2SelectionLock();
      return true;
    }
    if (action.startsWith("arrange-diagram2-selection-")) {
      if (!diagram2EditModeActive()) return true;
      await arrangeDiagram2Selection(action.slice("arrange-diagram2-selection-".length));
      return true;
    }
    if (action === "nudge-diagram2-selection") {
      if (!diagram2EditModeActive()) return true;
      await moveDiagram2SelectedObjects(Number(button?.dataset?.dx || 0), Number(button?.dataset?.dy || 0), {
        reason: "toolbar nudge"
      });
      return true;
    }
    return false;
  }

  function handleFilterChange(target) {
    if (!active) return false;
    if (target?.matches?.("[data-diagram2-import-input]")) {
      const [file] = target.files || [];
      target.value = "";
      if (file) void importDiagram2PmtFile(file);
      return true;
    }
    if (target?.matches?.("[data-diagram2-template-upload-input]")) {
      const files = [...(target.files || [])];
      target.value = "";
      if (files.length) void uploadDiagram2Templates(files);
      return true;
    }
    const filter = target?.dataset?.filter || "";
    if (!filter.startsWith("diagram2-")) return false;

    if (filter === "diagram2-search") {
      diagram2Search = String(target.value || "").trim();
      writePreference(preferenceKeys.diagramSearch, diagram2Search);
    } else if (filter === "diagram2-project") {
      diagram2ProjectId = Number(target.value || 0);
      diagram2SprintId = "all";
      writePreference(preferenceKeys.diagramProject, diagram2ProjectId);
      writePreference(preferenceKeys.diagramSprint, diagram2SprintId);
    } else if (filter === "diagram2-sprint") {
      diagram2SprintId = target.value || "all";
      writePreference(preferenceKeys.diagramSprint, diagram2SprintId);
    } else if (filter === "diagram2-visibility") {
      diagram2Visibility = diagram2VisibilityModes.has(target.value) ? target.value : "both";
      writePreference(preferenceKeys.diagramVisibility, diagram2Visibility);
    } else if (filter === "diagram2-sort") {
      diagram2Sort = diagram2SortModes.has(target.value) ? target.value : "latest";
      writePreference(preferenceKeys.diagramSort, diagram2Sort);
    } else if (filter === "diagram2-grid") {
      void diagram2Controller?.setGridVisible(target.checked === true).then(syncDiagram2InteractionState);
      return true;
    } else if (filter === "diagram2-snap") {
      void diagram2Controller?.setSnapToGrid(target.checked === true).then(syncDiagram2InteractionState);
      return true;
    } else if (filter === "diagram2-creator") {
      diagram2CreatorFilters = checkedDiagram2FilterValues("diagram2-creator");
      writeJsonPreference(preferenceKeys.diagramCreatorFilters, diagram2CreatorFilters);
    } else if (filter === "diagram2-last-editor") {
      diagram2LastEditorFilters = checkedDiagram2FilterValues("diagram2-last-editor");
      writeJsonPreference(preferenceKeys.diagramLastEditorFilters, diagram2LastEditorFilters);
    } else if (filter === "diagram2-zoom") {
      diagram2ViewerZoom = normalizeDiagram2Zoom(target.value);
      writePreference(preferenceKeys.diagram2ViewerZoom, diagram2ViewerZoom);
      applyDiagram2ViewerZoom();
      return true;
    } else {
      return false;
    }

    render();
    return true;
  }

  function view(id) {
    const nextId = positiveRouteId(id);
    if (nextId !== selectedDiagramDocumentId) {
      diagram2DocumentMode = "readonly";
      diagram2ModeDocumentId = nextId;
      resetDiagram2ViewerToFit();
    }
    selectedDiagramDocumentId = nextId;
    if (selectedDiagramDocumentId) writePreference(preferenceKeys.diagramSelectedDocument, selectedDiagramDocumentId);
    if (active) render();
    return true;
  }

  function selectDiagram2Document(id) {
    selectedDiagramDocumentId = positiveRouteId(id);
    if (!selectedDiagramDocumentId) return;
    diagram2DocumentMode = "readonly";
    diagram2ModeDocumentId = selectedDiagramDocumentId;
    resetDiagram2ViewerToFit();
    writePreference(preferenceKeys.diagramSelectedDocument, selectedDiagramDocumentId);
    updateBrowserUrl(routeForContent("diagram-2", selectedDiagramDocumentId));
    render();
  }

  function diagram2PageDocumentHeaderHtml(document) {
    if (diagram2ViewMode !== "tree" || !document) return "";
    const canEdit = diagram2CanEdit(document);
    const isEditMode = diagram2DocumentMode === "edit";
    const parent = diagram2AllDocuments().find(item => item.id === document.parentBlogId);
    return `
      <div class="diagram-page-document-head diagram2-page-document-head" data-diagram2-page-document-head>
        <div class="diagram-page-document-title">
          <h2>${escapeHtml(document.title || "Diagram")}</h2>
          <div class="diagram-page-document-meta">
            <span>${document.isPrivate === false ? "Public" : "Private"} Diagram</span>
            <span>${escapeHtml(diagramProjectLabel(document.projectId))}</span>
            ${document.sprintId ? `<span>${escapeHtml(diagramSprintLabel(document.sprintId))}</span>` : ""}
            ${parent ? `<span>Parent: ${escapeHtml(parent.title || "Diagram")}</span>` : ""}
            <span>Updated ${escapeHtml(formatDate(document.updatedAt || document.createdAt))}</span>
          </div>
        </div>
        <div class="diagram-page-document-actions">
          ${diagram2PublicLinkButtonHtml(document, "secondary text-icon-button diagram-page-icon-action", "Public Link")}
          <button type="button" class="secondary text-icon-button diagram-page-icon-action" data-action="edit-diagram2-info" data-id="${document.id}" title="Edit Info" aria-label="Edit Info" ${!canEdit || isEditMode ? "disabled" : ""}>
            ${buttonContent("&#9432;", "Edit Info")}
          </button>
          <button type="button" class="primary text-icon-button diagram-page-icon-action" data-action="edit-diagram2-document" data-id="${document.id}" title="Edit Diagram" aria-label="Edit Diagram" ${!canEdit || isEditMode ? "disabled" : ""}>
            ${buttonContent("&#9998;", "Edit Diagram")}
          </button>
          ${isEditMode ? `
            <span class="diagram2-save-state" data-diagram2-save-state>Saved</span>
          ` : `
            <div class="diagram-page-zoom-controls" aria-label="Read-only Diagram 2 navigation">
              <button type="button" class="secondary diagram-page-icon-action" data-action="zoom-diagram2-out" title="Zoom Out" aria-label="Zoom Out">&#8722;</button>
              <select data-filter="diagram2-zoom" aria-label="Zoom level" title="Zoom level">${diagram2ZoomOptionsHtml(diagram2ViewerZoom)}</select>
              <button type="button" class="secondary diagram-page-icon-action" data-action="zoom-diagram2-in" title="Zoom In" aria-label="Zoom In">&#43;</button>
              <button type="button" class="secondary text-icon-button diagram-page-icon-action" data-action="fit-diagram2-viewer" title="Fit Diagram" aria-label="Fit Diagram">${buttonContent("&#9633;", "Fit Diagram")}</button>
            </div>
          `}
        </div>
      </div>
    `;
  }

  function diagram2HeaderActionsHtml(selectedDocument) {
    const hasDocument = Boolean(selectedDocument);
    const busy = diagram2Creating || diagram2DocumentMode === "edit";
    const canCreate = canAccessResource("Documentation", "Create");
    const canImport = diagram2CanImport();
    const canExport = diagram2CanExport(selectedDocument);
    return `
      <button type="button" class="primary text-icon-button diagram-page-icon-action diagram2-page-action" data-action="new-diagram2" title="New Diagram" aria-label="New Diagram" ${busy || !canCreate ? "disabled" : ""}>
        ${buttonContent("&#10010;", diagram2Creating ? "Creating..." : "New Diagram")}
      </button>
      <div class="documentation-view-toggle diagram-view-toggle diagram2-view-toggle" aria-label="Diagram 2 library view">
        <button class="secondary text-icon-button documentation-view-toggle-button ${diagram2ViewMode === "cards" ? "is-on" : ""}" type="button" data-action="set-diagram2-view" data-mode="cards" aria-pressed="${diagram2ViewMode === "cards"}" title="Cards" aria-label="Cards" ${busy ? "disabled" : ""}>
          ${buttonContent("&#9638;", "Cards")}
        </button>
        <button class="secondary text-icon-button documentation-view-toggle-button ${diagram2ViewMode === "tree" ? "is-on" : ""}" type="button" data-action="set-diagram2-view" data-mode="tree" aria-pressed="${diagram2ViewMode === "tree"}" title="Treeview" aria-label="Treeview" ${busy ? "disabled" : ""}>
          ${buttonContent("&#9776;", "Treeview")}
        </button>
      </div>
      <button class="secondary text-icon-button diagram-page-icon-action diagram2-page-action" type="button" data-action="open-diagram2-filters" title="Filters" aria-label="Filters" aria-haspopup="dialog" ${busy ? "disabled" : ""}>
        ${buttonContent(funnelIconHtml(), "Filters")}
      </button>
      ${pageActionsMenuHtml([{
        action: "toggle-diagram2-tree-pane",
        icon: "&#9776;",
        label: "Left Nav",
        title: "Left Nav",
        checked: diagram2ViewMode === "tree" && !diagram2TreePaneHidden,
        disabled: diagram2ViewMode !== "tree" || busy
      }, {
        action: "toggle-diagram2-diagnostics",
        icon: "&#128202;",
        label: "Diagnostics",
        title: "Diagnostics",
        checked: diagram2DiagnosticsVisible,
        disabled: busy
      }, {
        action: "import-diagram2-pmt",
        icon: "&#8679;",
        label: "Import PMT Diagram",
        title: "Import PMT Diagram",
        disabled: busy || !canImport
      }, {
        action: "export-diagram2-pmt",
        icon: "&#8681;",
        label: "Export PMT Diagram",
        title: "Export PMT Diagram",
        disabled: !hasDocument || !canExport
      }])}
    `;
  }

  function diagram2CompatibilityAttributes() {
    return [
      ["data-diagram2-file-format", diagram2Compatibility.fileFormat],
      ["data-diagram2-file-format-version", diagram2Compatibility.fileFormatVersion],
      ["data-diagram2-selection-clipboard-format", diagram2Compatibility.selectionClipboardFormat],
      ["data-diagram2-selection-clipboard-version", diagram2Compatibility.selectionClipboardVersion],
      ["data-diagram2-template-library-endpoint", diagram2Compatibility.endpoints.templateLibrary],
      ["data-diagram2-default-template-library-endpoint", diagram2Compatibility.endpoints.defaultTemplateLibrary],
      ["data-diagram2-persisted-renderer-caches", diagram2Compatibility.persistedRendererCaches]
    ].map(([name, value]) => `${name}="${escapeAttr(value)}"`).join(" ");
  }

  function openDiagram2FiltersDialog() {
    const existingDialog = globalThis.document.querySelector("[data-diagram2-filter-dialog]");
    if (existingDialog) {
      if (!existingDialog.open) existingDialog.showModal?.();
      existingDialog.querySelector("[data-filter='diagram2-search'], [data-filter='diagram2-project']")?.focus({ preventScroll: true });
      return;
    }

    const modal = globalThis.document.createElement("dialog");
    modal.className = "dialog task-filter-dialog documentation-filter-dialog diagram-filter-dialog diagram2-filter-dialog";
    modal.dataset.diagram2FilterDialog = "true";
    modal.innerHTML = `
      <form method="dialog">
        <div class="dialog-head">
          <h2>Diagram 2 Filters</h2>
          <div class="dialog-head-actions">
            <button type="button" class="icon-btn dialog-reset-button" data-reset-diagram2-filters title="Reset" aria-label="Reset">Reset</button>
            <button type="button" class="icon-btn" data-close-diagram2-filters title="Close" aria-label="Close">x</button>
          </div>
        </div>
        <div class="dialog-body task-filter-dialog-body documentation-filter-dialog-body" data-diagram2-filter-dialog-body></div>
        <div class="dialog-actions">
          <button type="button" class="primary text-icon-button" data-close-diagram2-filters>${buttonContent("&#10003;", "Done")}</button>
        </div>
      </form>
    `;

    renderDiagram2FiltersDialog(modal);
    globalThis.document.body.appendChild(modal);
    modal.addEventListener("input", event => {
      if (event.target?.dataset?.filter !== "diagram2-search") return;
      diagram2Search = String(event.target.value || "").trim();
      writePreference(preferenceKeys.diagramSearch, diagram2Search);
      render();
    });
    modal.addEventListener("change", event => {
      const filter = event.target?.dataset?.filter || "";
      if (filter === "diagram2-project") {
        diagram2ProjectId = Number(event.target.value || 0);
        diagram2SprintId = "all";
        writePreference(preferenceKeys.diagramProject, diagram2ProjectId);
        writePreference(preferenceKeys.diagramSprint, diagram2SprintId);
        renderDiagram2FiltersDialog(modal);
        render();
        modal.querySelector("[data-filter='diagram2-project']")?.focus({ preventScroll: true });
      } else if (filter === "diagram2-sprint") {
        diagram2SprintId = event.target.value || "all";
        writePreference(preferenceKeys.diagramSprint, diagram2SprintId);
        render();
      } else if (filter === "diagram2-visibility") {
        diagram2Visibility = diagram2VisibilityModes.has(event.target.value) ? event.target.value : "both";
        writePreference(preferenceKeys.diagramVisibility, diagram2Visibility);
        render();
      } else if (filter === "diagram2-sort") {
        diagram2Sort = diagram2SortModes.has(event.target.value) ? event.target.value : "latest";
        writePreference(preferenceKeys.diagramSort, diagram2Sort);
        render();
      } else if (filter === "diagram2-creator") {
        diagram2CreatorFilters = checkedDiagram2FilterValues("diagram2-creator");
        writeJsonPreference(preferenceKeys.diagramCreatorFilters, diagram2CreatorFilters);
        render();
      } else if (filter === "diagram2-last-editor") {
        diagram2LastEditorFilters = checkedDiagram2FilterValues("diagram2-last-editor");
        writeJsonPreference(preferenceKeys.diagramLastEditorFilters, diagram2LastEditorFilters);
        render();
      }
    });
    modal.addEventListener("click", event => {
      if (event.target.closest("[data-reset-diagram2-filters]")) {
        resetDiagram2Filters();
        renderDiagram2FiltersDialog(modal);
        render();
        modal.querySelector("[data-filter='diagram2-search']")?.focus({ preventScroll: true });
        return;
      }
      if (event.target.closest("[data-close-diagram2-filters]")) modal.close();
    });
    modal.addEventListener("close", () => modal.remove());
    modal.showModal();
    modal.querySelector("[data-filter='diagram2-search']")?.focus({ preventScroll: true });
  }

  function renderDiagram2FiltersDialog(modal) {
    const body = modal.querySelector("[data-diagram2-filter-dialog-body]");
    if (!body) return;
    const sprintItems = state.sprints
      .filter(sprint => !diagram2ProjectId || Number(sprint.projectId) === diagram2ProjectId)
      .map(sprint => ({ value: sprint.id, text: `${sprint.code} - ${sprint.title}` }));
    body.innerHTML = `
      <div class="tasks-filter-panel documentation-filter-fields">
        <div class="task-filter-row documentation-filter-row">
          <label>
            <span>Search</span>
            <input data-filter="diagram2-search" type="search" value="${escapeAttr(diagram2Search)}">
          </label>
          ${filterSelect("Project", "diagram2-project", state.projects.map(project => ({ value: project.id, text: projectLabel(project) })), diagram2ProjectId || "", "All Projects")}
          ${filterSelect("Sprint", "diagram2-sprint", sprintItems, diagram2SprintId === "all" ? "" : diagram2SprintId, "All Sprints")}
          ${filterSelect("Visibility", "diagram2-visibility", [
            { value: "private", text: "Private" },
            { value: "public", text: "Public" }
          ], diagram2Visibility === "both" ? "" : diagram2Visibility, "Public and Private")}
          <label>
            <span>Sort</span>
            <select data-filter="diagram2-sort">
              ${selectOptionsHtml([
                { value: "latest", text: "Latest First" },
                { value: "oldest", text: "Oldest First" },
                { value: "name", text: "Name (Alphabetically)" },
                { value: "custom", text: "Custom" }
              ], diagram2Sort)}
            </select>
          </label>
        </div>
        <div class="documentation-filter-user-sections">
          ${filterCheckList("Filter by Creator", "diagram2-creator", diagram2UserFilterItems(), diagram2CreatorFilters, { className: "documentation-filter-users" })}
          ${filterCheckList("Filter by Last Edited", "diagram2-last-editor", diagram2UserFilterItems(), diagram2LastEditorFilters, { className: "documentation-filter-users" })}
        </div>
      </div>
    `;
  }

  function resetDiagram2Filters() {
    diagram2Search = "";
    diagram2ProjectId = 0;
    diagram2SprintId = "all";
    diagram2Visibility = "both";
    diagram2Sort = "latest";
    diagram2CreatorFilters = [];
    diagram2LastEditorFilters = [];
    writePreference(preferenceKeys.diagramSearch, diagram2Search);
    writePreference(preferenceKeys.diagramProject, diagram2ProjectId);
    writePreference(preferenceKeys.diagramSprint, diagram2SprintId);
    writePreference(preferenceKeys.diagramVisibility, diagram2Visibility);
    writePreference(preferenceKeys.diagramSort, diagram2Sort);
    writeJsonPreference(preferenceKeys.diagramCreatorFilters, diagram2CreatorFilters);
    writeJsonPreference(preferenceKeys.diagramLastEditorFilters, diagram2LastEditorFilters);
  }

  function diagram2UserFilterItems() {
    return state.users.map(user => ({
      value: user.id,
      text: diagramUserName(user.id),
      avatarUrl: user.avatarUrl
    }));
  }

  function diagram2TreeViewHtml(documents, selectedDocument, selectedMissingId) {
    return `
      <div class="documentation-tree-layout diagram-tree-layout diagram2-tree-layout ${diagram2TreePaneHidden ? "is-tree-hidden" : ""}" data-diagram2-tree-layout style="--documentation-tree-pane-width:${diagram2TreePaneWidth}px">
        <aside class="panel documentation-tree-pane diagram-tree-pane diagram2-tree-pane" data-diagram2-tree aria-label="Diagram 2 document library" ${diagram2TreePaneHidden ? "hidden" : ""}>
          ${documents.length ? diagram2TreeListHtml(documents) : `<div class="documentation-tree-empty">No diagrams match the current filters.</div>`}
        </aside>
        <div class="documentation-tree-splitter diagram2-tree-splitter" data-diagram2-tree-splitter ${diagram2TreePaneHidden ? "hidden" : ""} role="separator" aria-orientation="vertical" aria-label="Resize diagram navigation"></div>
        <section class="panel documentation-tree-preview diagram-tree-content diagram2-viewer-host ${diagram2DocumentMode === "edit" ? "is-editing" : ""}" data-diagram2-viewer-host>
          ${diagram2ViewerHtml(selectedDocument, selectedMissingId)}
        </section>
        ${diagram2TreeContextMenuHtml()}
        ${diagram2CanvasContextMenuHtml()}
      </div>
    `;
  }

  function diagram2CardViewHtml(documents) {
    if (!documents.length) {
      return `<div class="empty">No diagrams match the current filters. Select Filters to reset them, or select New Diagram to create one.</div>`;
    }
    return diagram2CardListHtml(documents);
  }

  function diagram2TreeListHtml(documents) {
    const byId = new Map(documents.map(document => [document.id, document]));
    const childrenByParent = new Map();
    documents.forEach(document => {
      const parentId = byId.has(document.parentBlogId) ? document.parentBlogId : 0;
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId).push(document);
    });
    childrenByParent.forEach(children => children.sort(diagram2DocumentCompare));

    const renderChildren = (parentId, depth) => (childrenByParent.get(parentId) || [])
      .map(document => diagram2TreeRowHtml(document, depth, childrenByParent, renderChildren))
      .join("");

    return `
      <div class="documentation-tree diagram2-tree-list" role="tree" aria-label="Diagram documents">
        <div class="diagram-tree-root-drop diagram2-tree-root-drop" data-diagram2-root-drop aria-hidden="true"></div>
        ${renderChildren(0, 0)}
      </div>
    `;
  }

  function diagram2TreeRowHtml(document, depth, childrenByParent, renderChildren) {
    const selected = document.id === selectedDiagramDocumentId;
    const children = childrenByParent.get(document.id) || [];
    const hasChildren = children.length > 0;
    const collapsed = collapsedDiagram2DocumentIds.has(document.id);
    const canMove = diagram2CanEdit(document);
    return `
      <div class="documentation-tree-row documentation-tree-document-row diagram-tree-row diagram2-tree-row ${selected ? "is-selected" : ""}" style="--tree-depth:${depth}" role="treeitem" aria-selected="${selected}" ${hasChildren ? `aria-expanded="${!collapsed}"` : ""} data-diagram2-tree-row data-id="${document.id}" draggable="${canMove}">
        <button class="documentation-tree-node-toggle diagram2-tree-node-toggle" type="button" data-action="toggle-diagram2-tree-node" data-id="${document.id}" ${hasChildren ? "" : "disabled"} aria-label="${hasChildren ? "Expand or collapse child diagrams" : "No child diagrams"}"><span aria-hidden="true">${hasChildren ? (collapsed ? "&#9656;" : "&#9662;") : ""}</span></button>
        <button class="documentation-tree-document diagram2-tree-document" type="button" data-action="select-diagram2-document" data-id="${document.id}" title="${escapeAttr(document.title)}">
          <span class="documentation-tree-icon diagram2-tree-icon" aria-hidden="true">&#128208;</span>
          <span class="documentation-tree-label diagram2-tree-label">${escapeHtml(document.title || "Diagram")}</span>
          <span class="documentation-tree-date diagram2-tree-date">${escapeHtml(formatDate(document.updatedAt || document.createdAt))}</span>
          ${document.isPrivate !== false ? `<span class="diagram-tree-private diagram2-private" title="Private" aria-label="Private">${diagram2LockIconHtml()}</span>` : ""}
        </button>
      </div>
      ${hasChildren && !collapsed ? renderChildren(document.id, depth + 1) : ""}
    `;
  }

  function diagram2TreeContextMenuHtml() {
    return `
      <div class="dropdown-menu documentation-tree-context-menu diagram2-tree-context-menu" data-diagram2-tree-context-menu role="menu" aria-label="Diagram actions" hidden>
        ${diagram2TreeContextMenuItemHtml("edit-diagram2-info", "Edit Info", "&#9432;", "data-diagram2-context-requires-update")}
        ${diagram2TreeContextMenuItemHtml("edit-diagram2-document", "Edit Diagram", "&#9998;", "data-diagram2-context-requires-update")}
        ${diagram2TreeContextMenuItemHtml("duplicate-diagram2", "Duplicate", "&#128203;", "data-diagram2-context-requires-create")}
        ${diagram2TreeContextMenuItemHtml("copy-public-diagram2-link", "Public Link", "&#128279;", "data-diagram2-context-requires-public")}
        ${diagram2TreeContextMenuItemHtml("export-diagram2-pmt", "Export PMT Diagram", "&#8681;", "data-diagram2-context-requires-export")}
        ${diagram2TreeContextMenuItemHtml("export-diagram2-svg", "Download as SVG", "&#8681;", "data-diagram2-context-requires-export")}
        ${diagram2TreeContextMenuItemHtml("export-diagram2-png", "Download as PNG", "&#8681;", "data-diagram2-context-requires-export")}
        ${diagram2TreeContextMenuItemHtml("delete-diagram2", "Delete", "&#128465;", "data-diagram2-context-requires-delete", "is-danger")}
      </div>
    `;
  }

  function diagram2CanvasContextMenuHtml() {
    return `
      <div class="dropdown-menu documentation-tree-context-menu diagram2-canvas-context-menu" data-diagram2-canvas-context-menu role="menu" aria-label="Diagram canvas actions" hidden>
        ${diagram2TreeContextMenuItemHtml("copy-diagram2-svg", "Copy as SVG", "&#10697;", "data-diagram2-context-requires-export")}
        ${diagram2TreeContextMenuItemHtml("copy-diagram2-png", "Copy as PNG", "&#9635;", "data-diagram2-context-requires-export")}
      </div>
    `;
  }

  function diagram2TreeContextMenuItemHtml(action, label, icon, attributes = "", className = "") {
    return `
      <button type="button" class="dropdown-menu-item ${className}" data-action="${escapeAttr(action)}" ${attributes} role="menuitem" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}">
        <span class="dropdown-menu-icon" aria-hidden="true">${icon}</span>
        <span class="dropdown-menu-label">${escapeHtml(label)}</span>
        <span class="dropdown-menu-check" aria-hidden="true"></span>
      </button>
    `;
  }

  function diagram2CardListHtml(documents) {
    return `<div class="grid documentation-grid diagram-grid diagram2-card-list">
      ${documents.map(document => sharedDiagramCardHtml(document, {
        actionAttrs: `data-action="select-diagram2-card" data-id="${document.id}"`,
        className: document.id === selectedDiagramDocumentId ? "diagram2-card is-selected" : "diagram2-card",
        source: diagramDocumentImage(document)?.source || blankDiagramSource,
        updatedLabel: `Updated ${formatDate(document.updatedAt || document.createdAt)}`
      })).join("")}
    </div>`;
  }

  function diagram2ViewerHtml(document, missingId) {
    if (missingId) {
      return `
        <div class="diagram2-empty">
          <h2>Diagram not found</h2>
          <p>Diagram 2 could not find Diagram document ${escapeHtml(missingId)} or you do not have permission to view it.</p>
          <p>Diagram 1 remains available.</p>
        </div>
      `;
    }

    if (!document) {
      return `
      ${diagram2TreeEmptyPreviewHtml()}
      `;
    }

    const isEditMode = diagram2DocumentIsEditMode(document);
    return `
      <div class="diagram2-viewer-body" data-diagram2-viewer-body>
        <div class="diagram2-live-viewer is-loading" data-diagram2-live-viewer data-id="${document.id}" data-diagram2-live-mode="${isEditMode ? "edit" : "readonly"}" aria-busy="true">
          <div class="diagram2-viewer-loader" role="status" aria-live="polite">Loading...</div>
          ${isEditMode ? diagram2EditorShellHtml({
              includeFooter: false,
              includeToolbarActions: true,
              applyLabel: "Save",
              selectedZoom: diagram2ViewerZoom,
              state: diagram2RendererState,
              selectedObjectIds: diagram2SelectedObjectIds,
              status: diagram2Controller?.statusSnapshot?.() || {
                hostKind: "diagram-document",
                selectedCount: 0,
                dirty: false,
                history: {}
              },
              showDiagnostics: diagram2DiagnosticsVisible,
              diagnosticsHtml: diagram2DiagnosticsHtml(),
              objectSearch: diagram2ObjectSearch,
              templateState: diagram2TemplateState
            }) : diagram2ReadonlyShellHtml(document)}
        </div>
      </div>
    `;
  }

  function diagram2ReadonlyShellHtml(document) {
    return `
      <div class="diagram-readonly-viewer diagram-tree-preview-image diagram2-readonly-shell" data-diagram2-readonly-shell>
        <div class="diagram-preview diagram-readonly-viewport diagram2-readonly-canvas diagram2-viewer-canvas" data-diagram2-viewer-canvas tabindex="0" aria-label="Read-only Diagram 2 canvas. Drag to pan; use mouse wheel to zoom.">
          <div class="diagram2-renderer-surface ${diagram2ViewerZoom === "fit" ? "is-fit" : ""}" data-diagram2-renderer-surface></div>
          <div class="diagram2-readonly-scroll-spacer" data-diagram2-readonly-scroll-spacer aria-hidden="true"></div>
        </div>
        ${diagram2DiagnosticsPanelHtml()}
      </div>
    `;
  }

  function diagram2DiagnosticsPanelHtml() {
    if (!diagram2DiagnosticsVisible) return "";
    return `
      <details class="diagram2-diagnostics-shell" data-diagram2-diagnostics-shell open>
        <summary>Diagnostics</summary>
        <div class="diagram2-diagnostics-actions">
          <button type="button" data-action="refresh-diagram2-renderer" title="Refresh Renderer" aria-label="Refresh Renderer">Refresh Renderer</button>
        </div>
        ${diagram2DiagnosticsHtml()}
      </details>
    `;
  }

  function diagram2EditWorkspaceHtml(document) {
    return `
      <div class="diagram2-edit-workspace" data-diagram2-viewer-host>
        ${diagram2ViewerHtml(document, 0)}
        ${diagram2CanvasContextMenuHtml()}
      </div>
    `;
  }

  function diagram2TreeEmptyPreviewHtml() {
    return `<div class="diagram-empty diagram2-empty">
      <span class="diagram-empty-icon" aria-hidden="true">&#128208;</span>
      <h2>Create a diagram</h2>
      <p>New Diagram creates a private backing Document immediately, then opens the editor here.</p>
    </div>`;
  }

  async function hydrateDiagram2Viewer(token, document) {
    if (!document) return;
    const source = diagramDocumentImage(document)?.source || blankDiagramSource;
    const viewer = app.querySelector(`[data-diagram2-live-viewer][data-id="${document.id}"]`);
    const surface = viewer?.querySelector("[data-diagram2-renderer-surface]");
    if (!viewer || !surface) return;

    const result = diagramSourceIsSvg(source)
      ? await loadDiagramCanonicalState(source)
      : { state: null, stateLoaded: false };
    if (!active || token !== viewerHydrationToken || selectedDiagramDocumentId !== document.id) return;

    if (!result.state) {
      surface.innerHTML = `<div class="diagram2-renderer-error" role="status">Diagram 2 could not read the saved Diagram metadata.</div>`;
      viewer.querySelector("[data-diagram2-viewer-loader], .diagram2-viewer-loader")?.remove();
      viewer.classList.remove("is-loading");
      viewer.removeAttribute("aria-busy");
      updateDiagram2Diagnostics(null, "Metadata unavailable");
      return;
    }

    const security = diagram2SecurityContext(document);
    const isEditMode = diagram2DocumentMode === "edit" && security.canUpdate === true;
    diagram2Renderer = createDiagram2Renderer({
      host: surface,
      onDiagnostics: updateDiagram2Diagnostics,
      viewportPadding: isEditMode ? undefined : 0,
      fitScaleStep: isEditMode ? undefined : 0.05
    });
    globalThis.__pmtDiagram2Renderer = diagram2Renderer;
    diagram2RendererDocumentId = document.id;
    diagram2RendererState = normalizeDiagram2CanonicalState(result.state);
    diagram2SelectedObjectIds = [];
    if (isEditMode) {
      diagram2TemplateState = await createDiagram2TemplateState({
        loadTemplateLibrary,
        loadDefaultTemplateLibrary
      });
      if (!active || token !== viewerHydrationToken || selectedDiagramDocumentId !== document.id) return;
      diagram2HostAdapter = createDiagram2DocumentHostAdapter({
        document,
        saveDiagramDocument,
        canEdit: security.canUpdate,
        canExport: security.canExport,
        security
      });
      diagram2Controller = createDiagram2EditorController({
        renderer: diagram2Renderer,
        host: diagram2HostAdapter,
        state: diagram2RendererState,
        templateLibrary: diagram2TemplateState.library,
        historyLimit: diagram2HistoryLimit
      });
      refreshDiagram2ObjectsPane();
      refreshDiagram2TemplatePane(viewer);
      diagram2Controller.onChange(event => {
        diagram2RendererState = diagram2Controller.currentState();
        diagram2SelectedObjectIds = diagram2Controller.selectedObjectIds();
        refreshDiagram2TemplatePane(viewer);
        updateDiagram2EditorControls();
        if (event.diagnostics) updateDiagram2Diagnostics(event.diagnostics);
      });
      globalThis.__pmtDiagram2EditorCore = diagram2Controller;
    } else {
      diagram2HostAdapter = null;
      diagram2Controller = null;
      globalThis.__pmtDiagram2EditorCore = null;
    }
    let diagnostics = diagram2Renderer.render(diagram2RendererState, {
      reason: "initial"
    });
    syncDiagram2VisibleViewportInset({ refit: false });
    diagnostics = diagram2Renderer.setZoom(diagram2ViewerZoom);
    syncDiagram2ReadonlyScrollbars({ reset: true });
    scheduleDiagram2ReadonlyScrollSync({ reset: true });
    scheduleDiagram2ZoomControlSync();
    viewer.querySelector("[data-diagram2-viewer-loader], .diagram2-viewer-loader")?.remove();
    viewer.classList.remove("is-loading");
    viewer.removeAttribute("aria-busy");
    bindDiagram2ViewportControls(viewer, { editMode: isEditMode });
    updateDiagram2Diagnostics(diagnostics);
    updateDiagram2EditorControls();
  }

  function diagram2DiagnosticsHtml() {
    return `
      <section class="diagram2-diagnostics" data-diagram2-diagnostics aria-label="Diagram 2 renderer diagnostics">
        <dl>
          ${diagram2DiagnosticItemHtml("canonical-object-count", "Canonical object count")}
          ${diagram2DiagnosticItemHtml("canonical-entity-count", "Canonical Entity count")}
          ${diagram2DiagnosticItemHtml("canonical-relationship-count", "Canonical relationship count")}
          ${diagram2DiagnosticItemHtml("mounted-object-count", "Mounted object count")}
          ${diagram2DiagnosticItemHtml("mounted-relationship-count", "Mounted relationship count")}
          ${diagram2DiagnosticItemHtml("svg-descendant-count", "SVG descendant count")}
          ${diagram2DiagnosticItemHtml("full-render-count", "Full-render count")}
          ${diagram2DiagnosticItemHtml("full-render-reason", "Full-render reason")}
          ${diagram2DiagnosticItemHtml("objects-patched-in-last-flush", "Objects patched in last flush")}
          ${diagram2DiagnosticItemHtml("relationships-routed-in-last-flush", "Relationships routed in last flush")}
          ${diagram2DiagnosticItemHtml("dirty-flush-reason", "Dirty flush reason")}
          ${diagram2DiagnosticItemHtml("dirty-object-ids", "Dirty object IDs")}
          ${diagram2DiagnosticItemHtml("dirty-relationship-ids", "Dirty relationship IDs")}
          ${diagram2DiagnosticItemHtml("patched-node-count", "Patched node count")}
          ${diagram2DiagnosticItemHtml("routed-relationship-count", "Routed relationship count")}
          ${diagram2DiagnosticItemHtml("dirty-flush-count", "Dirty flush count")}
          ${diagram2DiagnosticItemHtml("last-flush-duration", "Last flush duration")}
          ${diagram2DiagnosticItemHtml("geometry-preview-active", "Geometry preview active")}
          ${diagram2DiagnosticItemHtml("geometry-preview-reason", "Geometry preview reason")}
          ${diagram2DiagnosticItemHtml("geometry-preview-object-ids", "Preview object IDs")}
          ${diagram2DiagnosticItemHtml("geometry-preview-relationship-ids", "Preview relationship IDs")}
          ${diagram2DiagnosticItemHtml("geometry-preview-frame-count", "Preview frame count")}
          ${diagram2DiagnosticItemHtml("geometry-preview-patched-object-count", "Preview patched object count")}
          ${diagram2DiagnosticItemHtml("geometry-preview-relationship-count", "Preview relationship count")}
          ${diagram2DiagnosticItemHtml("geometry-preview-last-duration", "Preview last duration")}
          ${diagram2DiagnosticItemHtml("geometry-preview-commit-count", "Preview commit count")}
          ${diagram2DiagnosticItemHtml("geometry-preview-undo-entry-count", "Preview undo entries")}
          ${diagram2DiagnosticItemHtml("geometry-preview-initial-matrix", "Preview initial matrix")}
          ${diagram2DiagnosticItemHtml("geometry-preview-settled-route-count", "Preview settled routes")}
          ${diagram2DiagnosticItemHtml("pending-geometry-preview", "Pending geometry preview")}
          ${diagram2DiagnosticItemHtml("selective-routing-total-relationships", "Selective routing total relationships")}
          ${diagram2DiagnosticItemHtml("selective-routing-relationships-considered", "Relationships considered")}
          ${diagram2DiagnosticItemHtml("selective-routing-relationships-rerouted", "Relationships rerouted")}
          ${diagram2DiagnosticItemHtml("selective-routing-cache-hits", "Route cache hits")}
          ${diagram2DiagnosticItemHtml("selective-routing-cache-misses", "Route cache misses")}
          ${diagram2DiagnosticItemHtml("selective-routing-spatial-sectors-queried", "Spatial sectors queried")}
          ${diagram2DiagnosticItemHtml("selective-routing-duration", "Selective routing duration")}
          ${diagram2DiagnosticItemHtml("viewport-halo-active", "Viewport halo active")}
          ${diagram2DiagnosticItemHtml("viewport-halo-reason", "Viewport halo reason")}
          ${diagram2DiagnosticItemHtml("viewport-halo-fallback-reason", "Viewport halo fallback")}
          ${diagram2DiagnosticItemHtml("viewport-halo-sector-size", "Viewport halo sector size")}
          ${diagram2DiagnosticItemHtml("viewport-halo-sector-count", "Viewport halo sector count")}
          ${diagram2DiagnosticItemHtml("viewport-halo-object-coverage", "Viewport object coverage")}
          ${diagram2DiagnosticItemHtml("viewport-halo-relationship-coverage", "Viewport relationship coverage")}
          ${diagram2DiagnosticItemHtml("viewport-halo-combined-coverage", "Viewport combined coverage")}
          ${diagram2DiagnosticItemHtml("viewport-halo-target-object-count", "Viewport target objects")}
          ${diagram2DiagnosticItemHtml("viewport-halo-target-relationship-count", "Viewport target relationships")}
          ${diagram2DiagnosticItemHtml("viewport-halo-virtualized-object-count", "Virtualized objects")}
          ${diagram2DiagnosticItemHtml("viewport-halo-virtualized-relationship-count", "Virtualized relationships")}
          ${diagram2DiagnosticItemHtml("viewport-halo-force-mounted-object-count", "Force-mounted objects")}
          ${diagram2DiagnosticItemHtml("viewport-halo-force-mounted-relationship-count", "Force-mounted relationships")}
          ${diagram2DiagnosticItemHtml("viewport-halo-route-only-relationship-count", "Route-only halo relationships")}
          ${diagram2DiagnosticItemHtml("viewport-halo-entering-object-count", "Entering objects")}
          ${diagram2DiagnosticItemHtml("viewport-halo-leaving-object-count", "Leaving objects")}
          ${diagram2DiagnosticItemHtml("viewport-halo-retained-object-count", "Retained objects")}
          ${diagram2DiagnosticItemHtml("viewport-halo-entering-relationship-count", "Entering relationships")}
          ${diagram2DiagnosticItemHtml("viewport-halo-leaving-relationship-count", "Leaving relationships")}
          ${diagram2DiagnosticItemHtml("viewport-halo-retained-relationship-count", "Retained relationships")}
          ${diagram2DiagnosticItemHtml("viewport-halo-object-patch-count", "Viewport object patches")}
          ${diagram2DiagnosticItemHtml("viewport-halo-relationship-patch-count", "Viewport relationship patches")}
          ${diagram2DiagnosticItemHtml("viewport-halo-routed-relationship-count", "Viewport routed relationships")}
          ${diagram2DiagnosticItemHtml("viewport-halo-same-sector-noop", "Same-sector no-op")}
          ${diagram2DiagnosticItemHtml("viewport-halo-duration", "Viewport halo duration")}
          ${diagram2DiagnosticItemHtml("overview-detail-level", "Overview detail level")}
          ${diagram2DiagnosticItemHtml("overview-detail-reason", "Overview detail reason")}
          ${diagram2DiagnosticItemHtml("overview-detail-previous-level", "Previous detail level")}
          ${diagram2DiagnosticItemHtml("overview-detail-changed", "Detail level changed")}
          ${diagram2DiagnosticItemHtml("overview-detail-projected-row-pixels", "Projected row pixels")}
          ${diagram2DiagnosticItemHtml("overview-detail-enter-row-pixels", "Low-detail enter px")}
          ${diagram2DiagnosticItemHtml("overview-detail-exit-row-pixels", "Low-detail exit px")}
          ${diagram2DiagnosticItemHtml("overview-detail-entity-count", "Overview Entity count")}
          ${diagram2DiagnosticItemHtml("overview-detail-low-object-count", "Low-detail objects")}
          ${diagram2DiagnosticItemHtml("overview-detail-detailed-object-count", "Detailed objects")}
          ${diagram2DiagnosticItemHtml("overview-detail-low-relationship-count", "Low-detail relationships")}
          ${diagram2DiagnosticItemHtml("overview-detail-detailed-relationship-count", "Detailed relationships")}
          ${diagram2DiagnosticItemHtml("overview-detail-object-patch-count", "Detail object patches")}
          ${diagram2DiagnosticItemHtml("overview-detail-relationship-patch-count", "Detail relationship patches")}
          ${diagram2DiagnosticItemHtml("overview-detail-duration", "Overview detail duration")}
          ${diagram2DiagnosticItemHtml("last-frame-duration", "Last frame duration")}
          ${diagram2DiagnosticItemHtml("transient-matrix", "Transient matrix")}
          ${diagram2DiagnosticItemHtml("committed-matrix", "Committed matrix")}
          ${diagram2DiagnosticItemHtml("matrix-difference", "Matrix difference")}
          ${diagram2DiagnosticItemHtml("cursor-screen-point", "Cursor screen point")}
          ${diagram2DiagnosticItemHtml("world-point-under-cursor", "World point under cursor")}
          ${diagram2DiagnosticItemHtml("screen-point-after-settle", "Screen point after settle")}
          ${diagram2DiagnosticItemHtml("entity-bounding-box-before-settle", "Entity bounding box before settle")}
          ${diagram2DiagnosticItemHtml("entity-bounding-box-after-settle", "Entity bounding box after settle")}
          ${diagram2DiagnosticItemHtml("node-identity-before-after", "Node identity before/after")}
          ${diagram2DiagnosticItemHtml("full-renders-during-settle", "Full renders during settle")}
          ${diagram2DiagnosticItemHtml("routes-recalculated-during-settle", "Routes recalculated during settle")}
        </dl>
      </section>
    `;
  }

  function diagram2DiagnosticItemHtml(key, label) {
    return `<div><dt>${escapeHtml(label)}</dt><dd data-diagram2-diagnostic="${escapeAttr(key)}">-</dd></div>`;
  }

  function updateDiagram2Diagnostics(diagnostics, message = "") {
    const values = diagnostics ? {
      "canonical-object-count": diagnostics.canonicalObjectCount,
      "canonical-entity-count": diagnostics.canonicalEntityCount,
      "canonical-relationship-count": diagnostics.canonicalRelationshipCount,
      "mounted-object-count": diagnostics.mountedObjectCount,
      "mounted-relationship-count": diagnostics.mountedRelationshipCount,
      "svg-descendant-count": diagnostics.svgDescendantCount,
      "full-render-count": diagnostics.fullRenderCount,
      "full-render-reason": diagnostics.fullRenderReason,
      "objects-patched-in-last-flush": diagnostics.objectsPatchedInLastFlush,
      "relationships-routed-in-last-flush": diagnostics.relationshipsRoutedInLastFlush,
      "dirty-flush-reason": diagnostics.dirtyFlushReason,
      "dirty-object-ids": diagnostics.dirtyObjectIds,
      "dirty-relationship-ids": diagnostics.dirtyRelationshipIds,
      "patched-node-count": diagnostics.patchedNodeCount,
      "routed-relationship-count": diagnostics.routedRelationshipCount,
      "dirty-flush-count": diagnostics.dirtyFlushCount,
      "last-flush-duration": `${diagnostics.lastFlushDuration} ms`,
      "geometry-preview-active": diagnostics.geometryPreviewActive,
      "geometry-preview-reason": diagnostics.geometryPreviewReason,
      "geometry-preview-object-ids": diagnostics.geometryPreviewObjectIds,
      "geometry-preview-relationship-ids": diagnostics.geometryPreviewRelationshipIds,
      "geometry-preview-frame-count": diagnostics.geometryPreviewFrameCount,
      "geometry-preview-patched-object-count": diagnostics.geometryPreviewPatchedObjectCount,
      "geometry-preview-relationship-count": diagnostics.geometryPreviewRelationshipCount,
      "geometry-preview-last-duration": `${diagnostics.geometryPreviewLastDuration} ms`,
      "geometry-preview-commit-count": diagnostics.geometryPreviewCommitCount,
      "geometry-preview-undo-entry-count": diagnostics.geometryPreviewUndoEntryCount,
      "geometry-preview-initial-matrix": diagnostics.geometryPreviewInitialMatrix,
      "geometry-preview-settled-route-count": diagnostics.geometryPreviewSettledRouteCount,
      "pending-geometry-preview": diagnostics.pendingGeometryPreview,
      "selective-routing-total-relationships": diagnostics.selectiveRoutingTotalRelationships,
      "selective-routing-relationships-considered": diagnostics.selectiveRoutingRelationshipsConsidered,
      "selective-routing-relationships-rerouted": diagnostics.selectiveRoutingRelationshipsRerouted,
      "selective-routing-cache-hits": diagnostics.selectiveRoutingCacheHits,
      "selective-routing-cache-misses": diagnostics.selectiveRoutingCacheMisses,
      "selective-routing-spatial-sectors-queried": diagnostics.selectiveRoutingSpatialSectorsQueried,
      "selective-routing-duration": `${diagnostics.selectiveRoutingDuration} ms`,
      "viewport-halo-active": diagnostics.viewportHaloActive,
      "viewport-halo-reason": diagnostics.viewportHaloReason,
      "viewport-halo-fallback-reason": diagnostics.viewportHaloFallbackReason,
      "viewport-halo-sector-size": diagnostics.viewportHaloSectorSize,
      "viewport-halo-sector-count": diagnostics.viewportHaloSectorCount,
      "viewport-halo-object-coverage": diagnostics.viewportHaloObjectCoverage,
      "viewport-halo-relationship-coverage": diagnostics.viewportHaloRelationshipCoverage,
      "viewport-halo-combined-coverage": diagnostics.viewportHaloCombinedCoverage,
      "viewport-halo-target-object-count": diagnostics.viewportHaloTargetObjectCount,
      "viewport-halo-target-relationship-count": diagnostics.viewportHaloTargetRelationshipCount,
      "viewport-halo-virtualized-object-count": diagnostics.viewportHaloVirtualizedObjectCount,
      "viewport-halo-virtualized-relationship-count": diagnostics.viewportHaloVirtualizedRelationshipCount,
      "viewport-halo-force-mounted-object-count": diagnostics.viewportHaloForceMountedObjectCount,
      "viewport-halo-force-mounted-relationship-count": diagnostics.viewportHaloForceMountedRelationshipCount,
      "viewport-halo-route-only-relationship-count": diagnostics.viewportHaloRouteOnlyRelationshipCount,
      "viewport-halo-entering-object-count": diagnostics.viewportHaloEnteringObjectCount,
      "viewport-halo-leaving-object-count": diagnostics.viewportHaloLeavingObjectCount,
      "viewport-halo-retained-object-count": diagnostics.viewportHaloRetainedObjectCount,
      "viewport-halo-entering-relationship-count": diagnostics.viewportHaloEnteringRelationshipCount,
      "viewport-halo-leaving-relationship-count": diagnostics.viewportHaloLeavingRelationshipCount,
      "viewport-halo-retained-relationship-count": diagnostics.viewportHaloRetainedRelationshipCount,
      "viewport-halo-object-patch-count": diagnostics.viewportHaloObjectPatchCount,
      "viewport-halo-relationship-patch-count": diagnostics.viewportHaloRelationshipPatchCount,
      "viewport-halo-routed-relationship-count": diagnostics.viewportHaloRoutedRelationshipCount,
      "viewport-halo-same-sector-noop": diagnostics.viewportHaloSameSectorNoop,
      "viewport-halo-duration": `${diagnostics.viewportHaloDuration} ms`,
      "overview-detail-level": diagnostics.overviewDetailLevel,
      "overview-detail-reason": diagnostics.overviewDetailReason,
      "overview-detail-previous-level": diagnostics.overviewDetailPreviousLevel,
      "overview-detail-changed": diagnostics.overviewDetailChanged,
      "overview-detail-projected-row-pixels": diagnostics.overviewDetailProjectedRowPixels,
      "overview-detail-enter-row-pixels": diagnostics.overviewDetailEnterRowPixels,
      "overview-detail-exit-row-pixels": diagnostics.overviewDetailExitRowPixels,
      "overview-detail-entity-count": diagnostics.overviewDetailEntityCount,
      "overview-detail-low-object-count": diagnostics.overviewDetailLowObjectCount,
      "overview-detail-detailed-object-count": diagnostics.overviewDetailDetailedObjectCount,
      "overview-detail-low-relationship-count": diagnostics.overviewDetailLowRelationshipCount,
      "overview-detail-detailed-relationship-count": diagnostics.overviewDetailDetailedRelationshipCount,
      "overview-detail-object-patch-count": diagnostics.overviewDetailObjectPatchCount,
      "overview-detail-relationship-patch-count": diagnostics.overviewDetailRelationshipPatchCount,
      "overview-detail-duration": `${diagnostics.overviewDetailDuration} ms`,
      "last-frame-duration": `${diagnostics.lastFrameDuration} ms`,
      "transient-matrix": diagnostics.transientMatrix,
      "committed-matrix": diagnostics.committedMatrix,
      "matrix-difference": diagnostics.matrixDifference,
      "cursor-screen-point": diagnostics.cursorScreenPoint,
      "world-point-under-cursor": diagnostics.worldPointUnderCursor,
      "screen-point-after-settle": diagnostics.screenPointAfterSettle,
      "entity-bounding-box-before-settle": diagnostics.entityBoundingBoxBeforeSettle,
      "entity-bounding-box-after-settle": diagnostics.entityBoundingBoxAfterSettle,
      "node-identity-before-after": diagnostics.nodeIdentityBeforeAfter,
      "full-renders-during-settle": diagnostics.fullRendersDuringSettle,
      "routes-recalculated-during-settle": diagnostics.routesRecalculatedDuringSettle
    } : {
      "canonical-object-count": message || "-",
      "canonical-entity-count": "-",
      "canonical-relationship-count": "-",
      "mounted-object-count": "-",
      "mounted-relationship-count": "-",
      "svg-descendant-count": "-",
      "full-render-count": "-",
      "full-render-reason": "-",
      "objects-patched-in-last-flush": "-",
      "relationships-routed-in-last-flush": "-",
      "dirty-flush-reason": "-",
      "dirty-object-ids": "-",
      "dirty-relationship-ids": "-",
      "patched-node-count": "-",
      "routed-relationship-count": "-",
      "dirty-flush-count": "-",
      "last-flush-duration": "-",
      "geometry-preview-active": "-",
      "geometry-preview-reason": "-",
      "geometry-preview-object-ids": "-",
      "geometry-preview-relationship-ids": "-",
      "geometry-preview-frame-count": "-",
      "geometry-preview-patched-object-count": "-",
      "geometry-preview-relationship-count": "-",
      "geometry-preview-last-duration": "-",
      "geometry-preview-commit-count": "-",
      "geometry-preview-undo-entry-count": "-",
      "geometry-preview-initial-matrix": "-",
      "geometry-preview-settled-route-count": "-",
      "pending-geometry-preview": "-",
      "selective-routing-total-relationships": "-",
      "selective-routing-relationships-considered": "-",
      "selective-routing-relationships-rerouted": "-",
      "selective-routing-cache-hits": "-",
      "selective-routing-cache-misses": "-",
      "selective-routing-spatial-sectors-queried": "-",
      "selective-routing-duration": "-",
      "viewport-halo-active": "-",
      "viewport-halo-reason": "-",
      "viewport-halo-fallback-reason": "-",
      "viewport-halo-sector-size": "-",
      "viewport-halo-sector-count": "-",
      "viewport-halo-object-coverage": "-",
      "viewport-halo-relationship-coverage": "-",
      "viewport-halo-combined-coverage": "-",
      "viewport-halo-target-object-count": "-",
      "viewport-halo-target-relationship-count": "-",
      "viewport-halo-virtualized-object-count": "-",
      "viewport-halo-virtualized-relationship-count": "-",
      "viewport-halo-force-mounted-object-count": "-",
      "viewport-halo-force-mounted-relationship-count": "-",
      "viewport-halo-route-only-relationship-count": "-",
      "viewport-halo-entering-object-count": "-",
      "viewport-halo-leaving-object-count": "-",
      "viewport-halo-retained-object-count": "-",
      "viewport-halo-entering-relationship-count": "-",
      "viewport-halo-leaving-relationship-count": "-",
      "viewport-halo-retained-relationship-count": "-",
      "viewport-halo-object-patch-count": "-",
      "viewport-halo-relationship-patch-count": "-",
      "viewport-halo-routed-relationship-count": "-",
      "viewport-halo-same-sector-noop": "-",
      "viewport-halo-duration": "-",
      "overview-detail-level": "-",
      "overview-detail-reason": "-",
      "overview-detail-previous-level": "-",
      "overview-detail-changed": "-",
      "overview-detail-projected-row-pixels": "-",
      "overview-detail-enter-row-pixels": "-",
      "overview-detail-exit-row-pixels": "-",
      "overview-detail-entity-count": "-",
      "overview-detail-low-object-count": "-",
      "overview-detail-detailed-object-count": "-",
      "overview-detail-low-relationship-count": "-",
      "overview-detail-detailed-relationship-count": "-",
      "overview-detail-object-patch-count": "-",
      "overview-detail-relationship-patch-count": "-",
      "overview-detail-duration": "-",
      "last-frame-duration": "-",
      "transient-matrix": "-",
      "committed-matrix": "-",
      "matrix-difference": "-",
      "cursor-screen-point": "-",
      "world-point-under-cursor": "-",
      "screen-point-after-settle": "-",
      "entity-bounding-box-before-settle": "-",
      "entity-bounding-box-after-settle": "-",
      "node-identity-before-after": "-",
      "full-renders-during-settle": "-",
      "routes-recalculated-during-settle": "-"
    };

    Object.entries(values).forEach(([key, value]) => {
      const node = app.querySelector(`[data-diagram2-diagnostic="${key}"]`);
      if (node) node.textContent = String(value ?? "-");
    });
  }

  function applyDiagram2ViewerZoom() {
    app.querySelector("[data-diagram2-renderer-surface]")?.classList.toggle("is-fit", diagram2ViewerZoom === "fit");
    syncDiagram2ZoomControl();
    syncDiagram2VisibleViewportInset({ refit: false });
    const diagnostics = diagram2ViewerZoom === "fit"
      ? diagram2Renderer?.fit()
      : diagram2Renderer?.setZoom(diagram2ViewerZoom);
    syncDiagram2ReadonlyScrollbars({ reset: true });
    scheduleDiagram2ReadonlyScrollSync({ reset: true });
    if (diagnostics) updateDiagram2Diagnostics(diagnostics);
    scheduleDiagram2ZoomControlSync();
  }

  function syncDiagram2VisibleViewportInset(options = {}) {
    return syncDiagram2RendererViewportInset(app, diagram2Renderer, options);
  }

  function refreshDiagram2Renderer() {
    if (!diagram2Renderer || !diagram2Controller || !diagram2RendererDocumentId) return;
    diagram2RendererState = diagram2Controller.state();
    diagram2SelectedObjectIds = diagram2Controller.selectedObjectIds();
    diagram2SelectedObjectIds = diagram2SelectedObjectIds.filter(id =>
      diagram2RendererState.objects.some(object => object.id === id));
    let diagnostics = diagram2Renderer.render(diagram2RendererState, {
      reason: "refresh"
    });
    syncDiagram2VisibleViewportInset({ refit: false });
    diagnostics = diagram2Renderer.setZoom(diagram2ViewerZoom);
    diagnostics = diagram2Renderer.setSelectedIds(diagram2SelectedObjectIds);
    syncDiagram2ReadonlyScrollbars({ reset: true });
    scheduleDiagram2ReadonlyScrollSync({ reset: true });
    scheduleDiagram2ZoomControlSync();
    updateDiagram2Diagnostics(diagnostics);
    updateDiagram2EditorControls();
  }

  function syncDiagram2ZoomControl() {
    const zoomControl = app.querySelector("[data-filter='diagram2-zoom']");
    if (!zoomControl) return;
    if (diagram2ViewerZoom !== "fit") {
      zoomControl.value = diagram2ViewerZoom;
      return;
    }
    const scale = Number(app.querySelector("[data-diagram2-svg]")?.dataset.diagram2ViewportScale || 0);
    if (scale) zoomControl.value = diagram2ZoomOptionValue(scale);
  }

  function syncDiagram2ReadonlyScrollbars(options = {}) {
    const canvas = app.querySelector(".diagram2-readonly-canvas[data-diagram2-viewer-canvas]");
    const spacer = app.querySelector("[data-diagram2-readonly-scroll-spacer]");
    if (!canvas || !spacer || !diagram2RendererState) {
      diagram2ReadonlyScrollPosition = null;
      return;
    }

    const scale = diagram2CurrentViewportScale();
    const padding = 32;
    const scrollWidth = Math.max(
      canvas.clientWidth,
      Math.ceil(finiteNumber(diagram2RendererState.width, 1600) * scale) + padding
    );
    const scrollHeight = Math.max(
      canvas.clientHeight,
      Math.ceil(finiteNumber(diagram2RendererState.height, 900) * scale) + padding
    );
    canvas.style.setProperty("--diagram2-scroll-width", `${scrollWidth}px`);
    canvas.style.setProperty("--diagram2-scroll-height", `${scrollHeight}px`);

    if (options.reset === true) {
      suppressDiagram2ReadonlyScrollEvents();
      canvas.scrollLeft = Math.max(0, Math.round((canvas.scrollWidth - canvas.clientWidth) / 2));
      canvas.scrollTop = Math.max(0, Math.round((canvas.scrollHeight - canvas.clientHeight) / 2));
    }

    diagram2ReadonlyScrollPosition = {
      left: canvas.scrollLeft,
      top: canvas.scrollTop
    };
    positionDiagram2ReadonlySurface(canvas);
  }

  function suppressDiagram2ReadonlyScrollEvents() {
    diagram2IgnoringScrollEvent = true;
    if (diagram2IgnoreScrollTimer) globalThis.clearTimeout(diagram2IgnoreScrollTimer);
    diagram2IgnoreScrollTimer = globalThis.setTimeout(() => {
      diagram2IgnoreScrollTimer = 0;
      diagram2IgnoringScrollEvent = false;
    }, 80);
  }

  function positionDiagram2ReadonlySurface(canvas) {
    const surface = canvas?.querySelector?.("[data-diagram2-renderer-surface]");
    if (!surface) return;
    surface.style.transform = `translate(${canvas.scrollLeft}px, ${canvas.scrollTop}px)`;
  }

  function diagram2CurrentViewportScale() {
    const scale = Number(app.querySelector("[data-diagram2-svg]")?.dataset.diagram2ViewportScale || 0);
    if (Number.isFinite(scale) && scale > 0) return clampDiagram2Zoom(scale);
    if (diagram2ViewerZoom !== "fit") return clampDiagram2Zoom(diagram2ViewerZoom);
    return 1;
  }

  function scheduleDiagram2ZoomControlSync() {
    const requestFrame = globalThis.window?.requestAnimationFrame || (callback => globalThis.setTimeout(callback, 16));
    requestFrame(() => requestFrame(syncDiagram2ZoomControl));
  }

  function scheduleDiagram2ReadonlyScrollSync(options = {}) {
    const requestFrame = globalThis.window?.requestAnimationFrame || (callback => globalThis.setTimeout(callback, 16));
    requestFrame(() => requestFrame(() => syncDiagram2ReadonlyScrollbars(options)));
  }

  function resetDiagram2ViewerToFit() {
    diagram2ViewerZoom = "fit";
    writePreference(preferenceKeys.diagram2ViewerZoom, diagram2ViewerZoom);
  }

  function resetDiagram2Renderer() {
    abortDiagram2ViewportControls();
    diagram2Controller?.destroy?.();
    diagram2Renderer?.destroy?.();
    if (globalThis.__pmtDiagram2Renderer === diagram2Renderer) {
      globalThis.__pmtDiagram2Renderer = null;
    }
    if (globalThis.__pmtDiagram2EditorCore === diagram2Controller) {
      globalThis.__pmtDiagram2EditorCore = null;
    }
    globalThis.__pmtDiagram2Compatibility = null;
    globalThis.__pmtDiagram2SelectionClipboard = null;
    diagram2Renderer = null;
    diagram2Controller = null;
    diagram2HostAdapter = null;
    diagram2RendererDocumentId = 0;
    diagram2RendererState = null;
    diagram2SelectedObjectIds = [];
    diagram2Busy = false;
    diagram2ObjectSearch = "";
    diagram2TemplateState = null;
    diagram2ObjectTreeDrag = null;
  }

  function bindDiagram2Controls() {
    bindDiagram2SearchInput();
    bindDiagram2ImportInput();
    bindDiagram2InspectorTabs();
    bindDiagram2ColorPickers();
    bindDiagram2InspectorResize();
    bindDiagram2LeftPaneResize();
    bindDiagram2ObjectTreeControls();
    bindDiagram2TreeSplitter();
    bindDiagram2TreeContextMenu();
    bindDiagram2TreeDragAndDrop();
  }

  function bindDiagram2InspectorTabs() {
    const shell = app.querySelector("[data-diagram2-editor-shell]");
    if (!shell) return;
    shell.addEventListener("keydown", event => {
      const tab = event.target?.closest?.("[data-diagram2-inspector-tab]");
      if (!tab || !shell.contains(tab)) return;
      const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
      if (!keys.includes(event.key)) return;

      const tabs = [...shell.querySelectorAll("[data-diagram2-inspector-tab]")].filter(item => !item.hidden);
      if (!tabs.length) return;
      event.preventDefault();
      const index = Math.max(0, tabs.indexOf(tab));
      const nextIndex = event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : event.key === "ArrowLeft"
            ? (index + tabs.length - 1) % tabs.length
            : (index + 1) % tabs.length;
      setDiagram2InspectorActiveTab(shell, tabs[nextIndex]?.dataset.diagram2InspectorTab);
      tabs[nextIndex]?.focus({ preventScroll: true });
    });
  }

  function bindDiagram2ColorPickers() {
    const shell = app.querySelector("[data-diagram2-editor-shell]");
    if (!shell) return;
    bindDiagram2EditorColorPickers(shell, {
      applyColor: (name, color) => applyDiagram2SelectedStyle(name, color),
      notify
    });
    bindDiagram2EditorFormatControls(shell, {
      applyStyle: (name, value) => applyDiagram2SelectedStyle(name, value),
      applyGeometry: (name, value) => applyDiagram2SelectedGeometry(name, value),
      applyEntityOption: (name, value) => applyDiagram2SelectedEntityOption(name, value),
      updateEntityField: (fieldIndex, patch) => applyDiagram2SelectedEntityFieldPatch(fieldIndex, patch),
      setEntityFieldReference: (fieldIndex, reference) => applyDiagram2SelectedEntityFieldReference(fieldIndex, reference),
      applyRelationshipOption: (name, value) => applyDiagram2RelationshipOption(name, value),
      applyRelationshipStyle: (name, value) => applyDiagram2SelectedRelationshipStyle(name, value),
      applyRelationshipType: value => applyDiagram2SelectedRelationshipType(value),
      notify
    });
  }

  function bindDiagram2InspectorResize() {
    const shell = app.querySelector("[data-diagram2-editor-shell]");
    if (!shell) return;
    bindDiagram2EditorInspectorResize(shell, {
      onResize: () => {
        if (String(app.querySelector("[data-filter='diagram2-zoom']")?.value || "fit") === "fit") applyDiagram2ViewerZoom();
      }
    });
  }

  function bindDiagram2LeftPaneResize() {
    const shell = app.querySelector("[data-diagram2-editor-shell]");
    if (!shell) return;
    bindDiagram2EditorLeftPaneResize(shell, {
      onResize: () => syncDiagram2VisibleViewportInset({ refit: false })
    });
  }

  function syncDiagram2InspectorToggleState() {
    const main = app.querySelector("[data-diagram2-editor-main]");
    const expanded = !main?.classList.contains("is-inspector-hidden");
    app.querySelectorAll("[data-action='toggle-diagram2-inspector']").forEach(control => {
      control.setAttribute("aria-expanded", String(expanded));
    });
  }

  function bindDiagram2ObjectTreeControls() {
    const shell = app.querySelector("[data-diagram2-editor-shell]");
    if (!shell) return;
    let lastObjectTreePointerDown = { key: "", time: 0 };
    const search = shell.querySelector("[data-filter='diagram2-object-search']");
    search?.addEventListener("input", event => {
      diagram2ObjectSearch = String(event.target.value || "").trim();
      refreshDiagram2ObjectsPane({ preserveFocus: true });
    });
    shell.addEventListener("click", event => {
      if (Number(event.detail || 0) < 2) return;
      const row = event.target.closest?.("[data-diagram2-object-tree-row]");
      if (!row || !shell.contains(row) || event.target.closest?.("button, input, textarea, select")) return;
      event.preventDefault();
      event.stopPropagation();
      void focusDiagram2StructureNode(row);
    }, { capture: true });
    shell.addEventListener("pointerdown", event => {
      const row = event.target.closest?.("[data-diagram2-object-tree-row]");
      if (!row || !shell.contains(row) || event.target.closest?.("button, input, textarea, select")) return;
      const key = `${row.dataset.diagram2TreeNodeKind || "object"}:${row.dataset.diagram2ObjectId || ""}`;
      const time = Number(event.timeStamp || Date.now());
      if (key && key === lastObjectTreePointerDown.key && time - lastObjectTreePointerDown.time <= 500) {
        event.preventDefault();
        lastObjectTreePointerDown = { key: "", time: 0 };
        void focusDiagram2StructureNode(row);
        return;
      }
      lastObjectTreePointerDown = { key, time };
    });
    shell.addEventListener("dblclick", event => {
      const row = event.target.closest?.("[data-diagram2-object-tree-row]");
      if (!row || !shell.contains(row) || event.target.closest?.("button, input, textarea, select")) return;
      event.preventDefault();
      void focusDiagram2StructureNode(row);
    });
    bindDiagram2ObjectTreeDragAndDrop(shell);
  }

  function bindDiagram2ObjectTreeDragAndDrop(root) {
    const pane = root?.querySelector?.("[data-diagram2-objects-pane]");
    const tree = pane?.querySelector?.("[data-diagram2-object-tree]");
    const eventRoot = pane || tree;
    if (!tree || !eventRoot) return;

    eventRoot.addEventListener("dragstart", event => {
      const row = event.target.closest?.("[data-diagram2-object-tree-row][draggable='true']");
      const id = String(row?.dataset.diagram2ObjectId || "").trim();
      const kind = String(row?.dataset.diagram2TreeNodeKind || "object").trim();
      if (!row || !id || ["relationships", "relationship"].includes(kind)) {
        event.preventDefault();
        return;
      }
      diagram2ObjectTreeDrag = { id, kind };
      row.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", id);
    });

    eventRoot.addEventListener("dragover", event => {
      if (!diagram2ObjectTreeDrag?.id) return;
      const rootDrop = event.target.closest?.("[data-diagram2-object-tree-root-drop]");
      const row = event.target.closest?.("[data-diagram2-object-tree-row]");
      clearDiagram2ObjectTreeDropCues(root);
      if (rootDrop) {
        event.preventDefault();
        rootDrop.classList.add("is-drop-target");
        event.dataTransfer.dropEffect = "move";
        return;
      }
      if (!row || row.dataset.diagram2ObjectId === diagram2ObjectTreeDrag.id) return;
      const placement = diagram2ObjectTreeDropPlacement(row, event.clientY);
      event.preventDefault();
      row.classList.add(`is-drop-${placement}`);
      event.dataTransfer.dropEffect = "move";
    });

    eventRoot.addEventListener("drop", event => {
      if (!diagram2ObjectTreeDrag?.id) return;
      event.preventDefault();
      const rootDrop = event.target.closest?.("[data-diagram2-object-tree-root-drop]");
      const row = event.target.closest?.("[data-diagram2-object-tree-row]");
      const placement = rootDrop ? "inside" : diagram2ObjectTreeDropPlacement(row, event.clientY);
      const targetKind = rootDrop ? "root" : String(row?.dataset.diagram2TreeNodeKind || "object");
      const targetId = rootDrop ? "" : String(row?.dataset.diagram2ObjectId || "");
      const move = {
        draggedKind: diagram2ObjectTreeDrag.kind,
        draggedId: diagram2ObjectTreeDrag.id,
        targetKind,
        targetId,
        targetPlacement: placement
      };
      clearDiagram2ObjectTreeDropCues(root);
      void reorderDiagram2StructureNode(move);
    });

    const finish = () => {
      clearDiagram2ObjectTreeDropCues(root);
      diagram2ObjectTreeDrag = null;
    };
    eventRoot.addEventListener("dragend", finish);
    eventRoot.addEventListener("dragleave", event => {
      if (!eventRoot.contains(event.relatedTarget)) clearDiagram2ObjectTreeDropCues(root);
    });
  }

  function diagram2ObjectTreeDropPlacement(row, clientY) {
    if (!row?.getBoundingClientRect) return "after";
    const kind = String(row.dataset.diagram2TreeNodeKind || "");
    const rect = row.getBoundingClientRect();
    const height = Math.max(1, rect.height || 1);
    const ratio = (Number(clientY || rect.top) - rect.top) / height;
    if (kind === "group" && ratio > 0.25 && ratio < 0.75) return "inside";
    return ratio < 0.5 ? "before" : "after";
  }

  function clearDiagram2ObjectTreeDropCues(root) {
    root?.querySelectorAll?.(".is-dragging, .is-drop-before, .is-drop-after, .is-drop-inside, .is-drop-target")
      .forEach(element => {
        element.classList.remove("is-dragging", "is-drop-before", "is-drop-after", "is-drop-inside", "is-drop-target");
      });
  }

  async function applyDiagram2SelectedStyle(name, value) {
    if (!diagram2Controller || !diagram2Renderer || diagram2Busy) return false;
    const applied = await diagram2Controller.updateSelectedObjectsStyle(name, value, {
      reason: `format ${name}`
    });
    if (!applied) return false;
    diagram2RendererState = diagram2Controller.currentState();
    diagram2SelectedObjectIds = diagram2Controller.selectedObjectIds();
    updateDiagram2EditorControls();
    const diagnostics = await diagram2Renderer.whenIdle();
    updateDiagram2Diagnostics(diagnostics);
    return true;
  }

  async function applyDiagram2SelectedGeometry(name, value) {
    if (!diagram2Controller || !diagram2Renderer || diagram2Busy) return false;
    const property = String(name || "").trim();
    if (!["width", "height"].includes(property)) return false;
    const dimension = diagram2RectangleDimensionValue(value);
    if (!Number.isFinite(dimension)) return false;
    const selection = diagram2Controller.getObjectsByIds(diagram2Controller.selectedObjectIds());
    if (selection.length !== 1 || selection[0]?.type !== "rectangle" || selection[0]?.locked === true) return false;
    const applied = await diagram2Controller.resizeObjects([{ ...selection[0], [property]: dimension }], {
      label: "Resize rectangle",
      reason: `rectangle ${property}`
    });
    if (!applied) return false;
    diagram2RendererState = diagram2Controller.currentState();
    diagram2SelectedObjectIds = diagram2Controller.selectedObjectIds();
    updateDiagram2EditorControls();
    const diagnostics = await diagram2Renderer.whenIdle();
    updateDiagram2Diagnostics(diagnostics);
    return true;
  }

  async function applyDiagram2SelectedEntityOption(name, value) {
    if (!diagram2Controller || !diagram2Renderer || diagram2Busy) return false;
    const entity = diagram2Controller.getObjectsByIds(diagram2Controller.selectedObjectIds())
      .find(object => object?.type === "entity");
    if (!entity) return false;
    const applied = await diagram2Controller.setEntityOption(entity.id, name, value, {
      reason: `entity ${name}`
    });
    if (!applied) return false;
    await finishDiagram2ObjectCommand();
    return true;
  }

  async function applyDiagram2RelationshipOption(name, value) {
    if (!diagram2Controller || !diagram2Renderer || diagram2Busy) return false;
    const applied = await diagram2Controller.setRelationshipRoutingOptions({ [name]: value }, {
      reason: `relationship option ${name}`
    });
    if (!applied) return false;
    await finishDiagram2ObjectCommand();
    return true;
  }

  async function applyDiagram2SelectedRelationshipStyle(name, value) {
    if (!diagram2Controller || !diagram2Renderer || diagram2Busy) return false;
    const relationshipIds = diagram2Controller.selectedRelationshipIds();
    const applied = await diagram2Controller.updateRelationshipsStyle(relationshipIds, name, value, {
      global: name === "showSymbols",
      reason: `relationship style ${name}`
    });
    if (!applied) return false;
    await finishDiagram2ObjectCommand();
    return true;
  }

  async function applyDiagram2SelectedRelationshipType(value) {
    if (!diagram2Controller || !diagram2Renderer || diagram2Busy) return false;
    const [relationshipId] = diagram2Controller.selectedRelationshipIds();
    if (!relationshipId) return false;
    const applied = await diagram2Controller.setRelationshipType(relationshipId, value);
    if (!applied) return false;
    await finishDiagram2ObjectCommand();
    return true;
  }

  function bindDiagram2ImportInput() {
    const input = app.querySelector("[data-diagram2-import-input]");
    if (!input) return;
    input.addEventListener("change", event => {
      const [file] = event.target.files || [];
      event.target.value = "";
      if (file) void importDiagram2PmtFile(file);
    });
  }

  function bindDiagram2ViewportControls(viewer, options = {}) {
    abortDiagram2ViewportControls();
    const canvas = viewer?.querySelector("[data-diagram2-viewer-canvas]");
    if (!canvas) return;

    const editMode = options.editMode === true;
    viewportAbortController = new AbortController();
    const { signal } = viewportAbortController;
    bindDiagram2CanvasContextMenu(viewer, canvas, signal, { editMode });
    if (editMode) {
      bindDiagram2EditorInteractions({
        root: viewer,
        canvas,
        controller: diagram2Controller,
        renderer: diagram2Renderer,
        signal,
        isActive: () => active && diagram2EditModeActive() && !diagram2Busy,
        canMutate: diagram2CanMutateCurrentDocument,
        onStateChange: syncDiagram2InteractionState,
        onDiagnostics: updateDiagram2Diagnostics,
        onSave: saveDiagram2Document,
        onUndo: undoDiagram2,
        onRedo: redoDiagram2,
        onAddObject: type => type === "entity" ? addDiagram2EntityFromDialog() : addDiagram2ToolbarObject(type),
        onEditText: editDiagram2ObjectText,
        onEditEntity: editDiagram2SelectedEntity,
        onCopy: copyDiagram2Selection,
        onPaste: pasteDiagram2Selection,
        onPasteEvent: pasteDiagram2ClipboardEvent,
        onDuplicate: duplicateDiagram2Selection,
        onDelete: deleteDiagram2Selection,
        onGroup: groupDiagram2Selection,
        onUngroup: ungroupDiagram2Selection,
        onWheel: event => {
          const currentScale = diagram2CurrentViewportScale();
          const nextZoom = nextDiagram2Zoom(currentScale, event.deltaY < 0 ? 1 : -1);
          const nextScale = Number(nextZoom || currentScale);
          if (!Number.isFinite(nextScale) || nextScale <= 0) return;
          diagram2ViewerZoom = diagram2ZoomOptionValue(nextScale);
          writePreference(preferenceKeys.diagram2ViewerZoom, diagram2ViewerZoom);
          updateDiagram2Diagnostics(diagram2Renderer.zoomBy(nextScale / currentScale, event));
          syncDiagram2ZoomControl();
          scheduleDiagram2ZoomControlSync();
        }
      });
      return;
    }
    canvas.addEventListener("wheel", event => {
      if (!diagram2Renderer) return;
      event.preventDefault();
      const currentScale = diagram2CurrentViewportScale();
      const nextZoom = nextDiagram2Zoom(currentScale, event.deltaY < 0 ? 1 : -1);
      const nextScale = Number(nextZoom || currentScale);
      if (!Number.isFinite(nextScale) || nextScale <= 0) return;
      diagram2ViewerZoom = diagram2ZoomOptionValue(nextScale);
      writePreference(preferenceKeys.diagram2ViewerZoom, diagram2ViewerZoom);
      const diagnostics = diagram2Renderer.zoomBy(nextScale / currentScale, {
        clientX: event.clientX,
        clientY: event.clientY
      });
      updateDiagram2Diagnostics(diagnostics);
      syncDiagram2ReadonlyScrollbars();
      scheduleDiagram2ReadonlyScrollSync();
      syncDiagram2ZoomControl();
      scheduleDiagram2ZoomControlSync();
    }, { passive: false, signal });

    canvas.addEventListener("scroll", () => {
      if (!diagram2Renderer) return;
      const nextPosition = {
        left: canvas.scrollLeft,
        top: canvas.scrollTop
      };
      positionDiagram2ReadonlySurface(canvas);
      const previousPosition = diagram2ReadonlyScrollPosition || nextPosition;
      const deltaX = nextPosition.left - previousPosition.left;
      const deltaY = nextPosition.top - previousPosition.top;
      diagram2ReadonlyScrollPosition = nextPosition;
      if (diagram2IgnoringScrollEvent || (!deltaX && !deltaY)) return;
      const diagnostics = diagram2Renderer.panBy(-deltaX, -deltaY);
      if (diagnostics) updateDiagram2Diagnostics(diagnostics);
    }, { passive: true, signal });

    canvas.addEventListener("pointerdown", event => {
      if (!diagram2Renderer || (event.button !== 0 && event.button !== 1)) return;
      event.preventDefault();

      abortDiagram2Pan();
      viewportPanAbortController = new AbortController();
      const panSignal = viewportPanAbortController.signal;
      let lastPoint = { x: event.clientX, y: event.clientY };
      canvas.classList.add("is-panning");
      canvas.setPointerCapture?.(event.pointerId);

      const move = moveEvent => {
        const deltaX = moveEvent.clientX - lastPoint.x;
        const deltaY = moveEvent.clientY - lastPoint.y;
        lastPoint = { x: moveEvent.clientX, y: moveEvent.clientY };
        shiftDiagram2ReadonlyScrollbars(canvas, deltaX, deltaY);
        const diagnostics = diagram2Renderer?.panBy(deltaX, deltaY);
        if (diagnostics) updateDiagram2Diagnostics(diagnostics);
      };
      const finish = () => {
        canvas.classList.remove("is-panning");
        abortDiagram2Pan();
      };

      window.addEventListener("pointermove", move, { signal: panSignal });
      window.addEventListener("pointerup", finish, { signal: panSignal, once: true });
      window.addEventListener("pointercancel", finish, { signal: panSignal, once: true });
    }, { signal });

    canvas.addEventListener("auxclick", event => {
      if (event.button === 1) event.preventDefault();
    }, { signal });
  }

  function bindDiagram2CanvasContextMenu(viewer, canvas, signal, options = {}) {
    const menu = app.querySelector("[data-diagram2-canvas-context-menu]");
    if (!menu) return;
    const closeMenu = () => {
      menu.hidden = true;
      viewer?.classList?.remove("rich-image-menu-open");
    };
    canvas.addEventListener("contextmenu", event => {
      const objectTarget = event.target.closest?.("[data-diagram2-object-id], [data-diagram2-selection-id]");
      if (options.editMode === true && objectTarget) return;
      if (!diagram2CurrentOutputState() || !diagram2CurrentSecurity().canExport) return;
      event.preventDefault();
      event.stopPropagation();
      app.querySelector("[data-diagram2-tree-context-menu]")?.setAttribute("hidden", "");
      closeDiagram2EditorContextMenu(viewer);
      menu.hidden = false;
      menu.style.position = "fixed";
      viewer?.classList?.add("rich-image-menu-open");
      const margin = 8;
      const maximumLeft = Math.max(margin, window.innerWidth - menu.offsetWidth - margin);
      const maximumTop = Math.max(margin, window.innerHeight - menu.offsetHeight - margin);
      menu.style.left = `${Math.round(Math.max(margin, Math.min(event.clientX, maximumLeft)))}px`;
      menu.style.top = `${Math.round(Math.max(margin, Math.min(event.clientY, maximumTop)))}px`;
      menu.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
    }, { signal });
    menu.addEventListener("contextmenu", event => event.preventDefault(), { signal });
    menu.addEventListener("click", closeMenu, { signal });
    window.addEventListener("pointerdown", event => {
      if (!menu.hidden && !menu.contains(event.target)) closeMenu();
    }, { signal });
    window.addEventListener("scroll", closeMenu, { capture: true, passive: true, signal });
    window.addEventListener("keydown", event => {
      if (menu.hidden) return;
      if (event.key === "Escape" || event.key === "Tab") {
        event.preventDefault();
        closeMenu();
        canvas.focus({ preventScroll: true });
        return;
      }
      const items = [...menu.querySelectorAll("button:not(:disabled)")];
      const currentIndex = items.indexOf(document.activeElement);
      const direction = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
      if (!direction || !items.length) return;
      event.preventDefault();
      const nextIndex = currentIndex < 0
        ? (direction > 0 ? 0 : items.length - 1)
        : (currentIndex + direction + items.length) % items.length;
      items[nextIndex]?.focus({ preventScroll: true });
    }, { signal });
  }

  function closeDiagram2EditorContextMenu(viewer) {
    const menu = viewer?.querySelector?.("[data-diagram2-context-menu]");
    if (!menu) return;
    menu.hidden = true;
    viewer?.classList?.remove("rich-image-menu-open");
  }

  function shiftDiagram2ReadonlyScrollbars(canvas, deltaX, deltaY) {
    if (!canvas?.matches?.(".diagram2-readonly-canvas")) return;
    diagram2IgnoringScrollEvent = true;
    canvas.scrollLeft -= deltaX;
    canvas.scrollTop -= deltaY;
    positionDiagram2ReadonlySurface(canvas);
    diagram2ReadonlyScrollPosition = {
      left: canvas.scrollLeft,
      top: canvas.scrollTop
    };
    queueMicrotask(() => {
      diagram2IgnoringScrollEvent = false;
    });
  }

  function abortDiagram2ViewportControls() {
    abortDiagram2Pan();
    viewportAbortController?.abort();
    viewportAbortController = null;
  }

  function abortDiagram2Pan() {
    viewportPanAbortController?.abort();
    viewportPanAbortController = null;
    app.querySelector("[data-diagram2-viewer-canvas]")?.classList.remove("is-panning");
    app.querySelector("[data-diagram2-viewer-canvas]")?.classList.remove("is-moving-object");
    app.querySelector("[data-diagram2-viewer-canvas]")?.classList.remove("is-resizing-object");
  }

  function setDiagram2Selection(ids) {
    if (diagram2Controller) {
      diagram2SelectedObjectIds = diagram2Controller.setSelection(ids);
      diagram2RendererState = diagram2Controller.currentState();
    } else {
      const existingIds = new Set((diagram2RendererState?.objects || []).map(object => object.id));
      diagram2SelectedObjectIds = uniqueStrings(ids).filter(id => existingIds.has(id));
      const diagnostics = diagram2Renderer?.setSelectedIds(diagram2SelectedObjectIds);
      if (diagnostics) updateDiagram2Diagnostics(diagnostics);
    }
    updateDiagram2EditorControls();
    return diagram2SelectedObjectIds.slice();
  }

  async function moveDiagram2SelectedObjects(deltaX, deltaY, options = {}) {
    if (!diagram2Controller || !diagram2Renderer || diagram2Busy) return false;
    const dx = finiteNumber(deltaX, 0);
    const dy = finiteNumber(deltaY, 0);
    if (!dx && !dy) return false;

    const moved = await diagram2Controller.moveSelectedObjects(dx, dy, {
      reason: options.reason || "move selection",
      coalesce: options.coalesce === true
    });
    if (!moved) return false;
    diagram2RendererState = diagram2Controller.currentState();
    diagram2SelectedObjectIds = diagram2Controller.selectedObjectIds();
    updateDiagram2EditorControls();
    const diagnostics = await diagram2Renderer.whenIdle();
    updateDiagram2Diagnostics(diagnostics);
    return true;
  }

  async function saveDiagram2Document() {
    if (diagram2Busy || !diagram2Controller) return false;
    const document = currentDiagram2Document();
    if (!document || !diagram2Controller.currentState()) {
      notify?.("Select a Diagram before saving.");
      return false;
    }
    if (!diagram2CanMutateCurrentDocument()) {
      notify?.("You do not have permission to update this Diagram.");
      return false;
    }
    if (typeof diagram2HostAdapter?.save !== "function") {
      notify?.("Diagram 2 save is not available.");
      return false;
    }

    diagram2Busy = true;
    diagram2Controller.setBusy(true);
    updateDiagram2EditorControls();
    try {
      await diagram2Renderer?.whenIdle();
      const stateForSave = diagram2Controller.state();
      const saved = await diagram2HostAdapter.save({
        diagram: {
          state: stateForSave,
          svg: buildAnnotationSvg(stateForSave),
          fileName: `${safeFileName(document.title)}.svg`
        }
      });
      diagram2RendererState = stateForSave;
      diagram2Controller.markSaved();
      if (saved?.id) {
        selectedDiagramDocumentId = Number(saved.id);
        diagram2RendererDocumentId = Number(saved.id);
        writePreference(preferenceKeys.diagramSelectedDocument, selectedDiagramDocumentId);
      }
      notify?.("Diagram 2 saved.");
      return true;
    } catch (error) {
      notify?.(diagram2SaveConflict(error)
        ? "A newer version exists. Diagram 2 did not overwrite it."
        : (error?.message || "Diagram 2 could not save the Diagram."));
      return false;
    } finally {
      diagram2Busy = false;
      diagram2Controller?.setBusy(false);
      updateDiagram2EditorControls();
    }
  }

  async function closeDiagram2Editor() {
    if (diagram2DocumentMode !== "edit") return false;
    if (diagram2Busy) return false;
    if (diagram2Controller?.historyStatus?.().dirty === true) {
      const action = await askDiagram2UnsavedCloseAction();
      if (action === "cancel") return false;
      if (action === "save" && !await saveDiagram2Document()) return false;
    }
    if (!active) return false;
    diagram2DocumentMode = "readonly";
    diagram2ModeDocumentId = selectedDiagramDocumentId;
    resetDiagram2ViewerToFit();
    render();
    return true;
  }

  function askDiagram2UnsavedCloseAction() {
    return new Promise(resolve => {
      const modal = document.createElement("dialog");
      modal.className = "dialog mini-dialog";
      modal.innerHTML = `
        <div class="dialog-head">
          <h2>Unsaved Changes</h2>
        </div>
        <div class="dialog-body">
          <p>Save changes before closing this Diagram?</p>
        </div>
        <div class="dialog-actions">
          <button type="button" class="secondary text-icon-button" data-result="cancel">${buttonContent("&#10005;", "Cancel")}</button>
          <button type="button" class="secondary text-icon-button" data-result="discard">${buttonContent("&#8634;", "Discard")}</button>
          <button type="button" class="primary text-icon-button" data-result="save">${buttonContent("&#10003;", "Save")}</button>
        </div>
      `;
      document.body.appendChild(modal);
      const finish = result => {
        modal.close();
        modal.remove();
        resolve(result);
      };
      modal.querySelectorAll("[data-result]").forEach(button => {
        button.addEventListener("click", () => finish(button.dataset.result || "cancel"));
      });
      modal.addEventListener("cancel", event => {
        event.preventDefault();
        finish("cancel");
      });
      modal.showModal();
    });
  }

  async function exportDiagram2Pmt() {
    const document = currentDiagram2Document();
    const stateForExport = diagram2CurrentOutputState();
    if (!document || !stateForExport) return false;
    if (!diagram2CurrentSecurity().canExport) {
      notify?.("You do not have permission to export Diagrams.");
      return false;
    }
    await diagram2Renderer?.whenIdle();
    const contents = createDiagram2PmtDiagramFile({
      title: document.title,
      state: stateForExport,
      svg: buildAnnotationSvg(stateForExport)
    });
    downloadTextFile(contents, `${safeFileName(document.title)}.pmt-diagram.json`, "application/json");
    notify?.("PMT Diagram exported.");
    return true;
  }

  async function exportDiagram2Svg() {
    const document = currentDiagram2Document();
    const stateForExport = diagram2CurrentOutputState();
    if (!document || !stateForExport) return false;
    if (!diagram2CurrentSecurity().canExport) {
      notify?.("You do not have permission to export Diagrams.");
      return false;
    }
    const options = await chooseDiagram2SvgDownloadOptions();
    if (!options) return false;
    try {
      await diagram2Renderer?.whenIdle();
      const portableState = await buildPortableAnnotationState(stateForExport);
      const svg = prepareDiagram2SvgForDownload(buildAnnotationSvg(portableState), options);
      downloadTextFile(svg, `${safeFileName(document.title)}.svg`, "image/svg+xml");
      notify?.("Diagram exported as SVG.");
      return true;
    } catch (error) {
      notify?.(error?.message || "Diagram 2 could not export the SVG.");
      return false;
    }
  }

  async function exportDiagram2Png() {
    const document = currentDiagram2Document();
    const stateForExport = diagram2CurrentOutputState();
    if (!document || !stateForExport) return false;
    if (!diagram2CurrentSecurity().canExport) {
      notify?.("You do not have permission to export Diagrams.");
      return false;
    }
    const options = await chooseDiagram2PngDownloadOptions();
    if (!options) return false;
    try {
      await diagram2Renderer?.whenIdle();
      const portableState = await buildPortableAnnotationState(stateForExport);
      const svg = prepareDiagram2SvgForDownload(buildAnnotationSvg(portableState), options);
      const blob = await annotationSvgToPngBlob({ svg, ...diagram2SvgMetrics(svg) });
      downloadBlobFile(blob, `${safeFileName(document.title)}.png`);
      notify?.("Diagram exported as PNG.");
      return true;
    } catch (error) {
      notify?.(error?.message || "Diagram 2 could not export the PNG.");
      return false;
    }
  }

  async function copyDiagram2Svg() {
    const stateForExport = diagram2CurrentOutputState();
    if (!stateForExport || !diagram2CurrentSecurity().canExport) return false;
    const options = await openDiagram2DownloadOptionsDialog("svg", { action: "copy" });
    if (!options) return false;
    try {
      await diagram2Renderer?.whenIdle();
      const portableState = await buildPortableAnnotationState(stateForExport);
      const svg = prepareDiagram2SvgForDownload(buildAnnotationSvg(portableState), options);
      await copyAnnotationSvgToClipboard(svg);
      notify?.("Diagram copied as SVG.");
      return true;
    } catch (error) {
      notify?.(error?.message || "Diagram 2 could not copy the SVG.");
      return false;
    }
  }

  async function copyDiagram2Png() {
    const stateForExport = diagram2CurrentOutputState();
    if (!stateForExport || !diagram2CurrentSecurity().canExport) return false;
    const options = await openDiagram2DownloadOptionsDialog("png", { action: "copy" });
    if (!options) return false;
    try {
      await diagram2Renderer?.whenIdle();
      const portableState = await buildPortableAnnotationState(stateForExport);
      const svg = prepareDiagram2SvgForDownload(buildAnnotationSvg(portableState), options);
      await copyAnnotationPngToClipboard({ svg, ...diagram2SvgMetrics(svg) });
      notify?.("Diagram copied as PNG.");
      return true;
    } catch (error) {
      notify?.(error?.message || "Diagram 2 could not copy the PNG.");
      return false;
    }
  }

  async function copyDiagram2Selection() {
    if (!diagram2Controller || !diagram2Controller.selectedObjectIds().length) {
      notify?.("Select one or more Diagram objects before copying.");
      return false;
    }
    await diagram2Renderer?.whenIdle();
    const text = diagram2Controller.selectionClipboardText();
    globalThis.__pmtDiagram2SelectionClipboard = text;
    globalThis.__pmtDiagramSelectionClipboard = text;
    const copied = await copyTextToClipboard(text);
    notify?.(copied ? "Diagram selection copied." : "Diagram selection is ready, but the browser blocked clipboard copy.");
    return copied;
  }

  async function copyDiagram2SelectionAsArtwork(format) {
    if (!diagram2Controller || !diagram2Controller.selectedObjectIds().length) {
      notify?.("Select one or more Diagram objects before copying.");
      return false;
    }
    await diagram2Renderer?.whenIdle();
    try {
      const copied = await copyDiagram2SelectionArtwork(
        diagram2Controller.currentState(),
        diagram2Controller.selectedObjectIds(),
        format
      );
      notify?.(copied
        ? `Diagram selection copied as ${format === "image" ? "an image" : "SVG"}.`
        : "Select one or more Diagram objects before copying.");
      return copied;
    } catch (error) {
      notify?.(error?.message || `The Diagram selection could not be copied as ${format === "image" ? "an image" : "SVG"}.`);
      return false;
    }
  }

  async function pasteDiagram2Selection() {
    if (!diagram2Controller || !diagram2CanMutateCurrentDocument()) return false;
    const text = await readDiagram2SelectionClipboard();
    if (!text) {
      notify?.("Copy Diagram objects before pasting.");
      return false;
    }
    const pasted = await diagram2Controller.pasteSelectionClipboardText(text);
    if (!pasted) {
      notify?.("The clipboard does not contain compatible Diagram objects.");
      return false;
    }
    await finishDiagram2ObjectCommand();
    notify?.("Diagram objects pasted.");
    return true;
  }

  async function pasteDiagram2ClipboardEvent(event) {
    if (!diagram2Controller || !diagram2CanMutateCurrentDocument()) return false;
    const clipboardData = event?.clipboardData;
    if (!clipboardData) return false;

    if (annotationClipboardHasImage(clipboardData)) {
      event.preventDefault();
      if (diagram2ClipboardImageBusy) {
        notify?.("Wait for the current image upload to finish.");
        return false;
      }

      const file = await annotationClipboardImageFile(clipboardData);
      if (!file) {
        notify?.("The clipboard image could not be read.");
        return false;
      }

      diagram2ClipboardImageBusy = true;
      notify?.("Uploading the pasted image...");
      try {
        const added = await addDiagram2ClipboardImage(file);
        if (added) notify?.(`${file.name || "Image"} uploaded and added to the canvas.`);
        return added;
      } catch (error) {
        notify?.(error?.message || "The pasted image could not be uploaded.");
        return false;
      } finally {
        diagram2ClipboardImageBusy = false;
      }
    }

    const text = String(clipboardData.getData?.("text/plain") || "");
    if (!text.trim().startsWith("PMT_DIAGRAM_SELECTION_V1")
      && !/"format"\s*:\s*"pmt-diagram-selection"/.test(text)) {
      return false;
    }

    event.preventDefault();
    const pasted = await diagram2Controller.pasteSelectionClipboardText(text);
    if (!pasted) {
      notify?.("The clipboard does not contain compatible Diagram objects.");
      return false;
    }
    await finishDiagram2ObjectCommand();
    notify?.("Diagram objects pasted.");
    return true;
  }

  async function addDiagram2ClipboardImage(file) {
    if (typeof uploadEmbeddedImage !== "function") {
      throw new Error("Image uploads are not available in Diagram 2.");
    }

    const stored = await uploadEmbeddedImage(file);
    const source = String(stored?.url || stored || "").trim();
    if (!source) throw new Error("The uploaded image URL is invalid.");

    const dimensions = await diagram2ImageDimensions(source);
    const center = diagram2Controller.snapPoint(diagram2InsertionCenter());
    const x = center.x - (dimensions.width / 2);
    const y = center.y - (dimensions.height / 2);
    const object = {
      id: diagram2ClipboardImageId(),
      type: "embedded-image",
      name: diagram2UniqueImageName(file.name || "Image"),
      x,
      y,
      width: dimensions.width,
      height: dimensions.height,
      source,
      imageClip: {
        x,
        y,
        width: dimensions.width,
        height: dimensions.height
      },
      isOriginalImage: false,
      locked: false,
      groupId: ""
    };

    const added = await diagram2Controller.addObject(object, {
      label: "Paste image",
      reason: "clipboard paste image"
    });
    if (!added) throw new Error("The pasted image could not be added to the canvas.");

    diagram2Controller.setActiveTool("select");
    await finishDiagram2ObjectCommand();
    return true;
  }

  function diagram2ClipboardImageId() {
    let id = "";
    do {
      id = `embedded-image-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    } while (diagram2Controller?.getObjectById?.(id));
    return id;
  }

  function diagram2UniqueImageName(nameInput) {
    const name = String(nameInput || "Image").trim() || "Image";
    const names = new Set((diagram2Controller?.currentState?.().objects || [])
      .map(object => String(object?.name || "").trim().toLowerCase())
      .filter(Boolean));
    if (!names.has(name.toLowerCase())) return name;
    let suffix = 1;
    while (names.has(`${name} ${suffix}`.toLowerCase())) suffix += 1;
    return `${name} ${suffix}`;
  }

  function diagram2ImageDimensions(source) {
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
      image.addEventListener("error", () => reject(new Error("The pasted image could not be decoded.")), { once: true });
      image.src = source;
    });
  }

  async function duplicateDiagram2Selection() {
    if (!diagram2Controller || !diagram2CanMutateCurrentDocument()) return false;
    const duplicated = await diagram2Controller.duplicateSelectedObjects();
    if (!duplicated) return false;
    await finishDiagram2ObjectCommand();
    return true;
  }

  async function deleteDiagram2Selection() {
    if (!diagram2Controller || !diagram2CanMutateCurrentDocument()) return false;
    const deleted = await diagram2Controller.deleteSelectedObjects();
    if (!deleted) return false;
    await finishDiagram2ObjectCommand();
    return true;
  }

  async function toggleDiagram2SelectionLock() {
    if (!diagram2Controller || !diagram2CanMutateCurrentDocument()) return false;
    const selection = diagram2Controller.getObjectsByIds(diagram2Controller.selectedObjectIds());
    if (!selection.length) return false;
    const lock = !selection.every(object => object.locked === true);
    const changed = await diagram2Controller.setSelectedObjectsLocked(lock);
    if (!changed) return false;
    await finishDiagram2ObjectCommand();
    notify?.(`${selection.length === 1 ? "Object" : "Objects"} ${lock ? "locked" : "unlocked"}.`);
    return true;
  }

  async function arrangeDiagram2Selection(action) {
    if (!diagram2Controller || !diagram2CanMutateCurrentDocument()) return false;
    const arranged = await diagram2Controller.arrangeSelectedObjects(action);
    if (!arranged) return false;
    await finishDiagram2ObjectCommand();
    return true;
  }

  async function selectDiagram2StructureNode(button) {
    if (!diagram2Controller) return false;
    const { kind, id } = diagram2StructureTargetFromButton(button);
    const selected = diagram2Controller.selectStructureNode(kind, id);
    diagram2RendererState = diagram2Controller.currentState();
    diagram2SelectedObjectIds = selected;
    refreshDiagram2ObjectsPane();
    updateDiagram2EditorControls();
    return selected.length > 0;
  }

  async function focusDiagram2StructureNode(row) {
    const { kind, id } = diagram2StructureTargetFromButton(row);
    if (!id || !await selectDiagram2StructureNode(row)) return false;
    const focusIds = kind === "group"
      ? diagram2Controller.selectedObjectIds()
      : [id];
    const diagnostics = diagram2Renderer?.focusObjectIds?.(focusIds, {
      reason: "object tree focus"
    });
    if (diagnostics) updateDiagram2Diagnostics(diagnostics);
    const settledDiagnostics = await diagram2Renderer?.whenIdle?.();
    if (settledDiagnostics) updateDiagram2Diagnostics(settledDiagnostics);
    diagram2ViewerZoom = diagram2ZoomOptionValue(diagram2CurrentViewportScale());
    app.querySelector("[data-diagram2-renderer-surface]")?.classList.remove("is-fit");
    scheduleDiagram2ZoomControlSync();
    app.querySelector("[data-diagram2-viewer-canvas]")?.focus?.({ preventScroll: true });
    return true;
  }

  async function groupDiagram2Selection() {
    if (!diagram2Controller || !diagram2CanMutateCurrentDocument()) return false;
    const grouped = await diagram2Controller.groupSelectedObjects();
    if (!grouped) return false;
    await finishDiagram2ObjectCommand();
    notify?.("Diagram objects grouped.");
    return true;
  }

  async function ungroupDiagram2Selection() {
    if (!diagram2Controller || !diagram2CanMutateCurrentDocument()) return false;
    const ungrouped = await diagram2Controller.ungroupSelectedObjects();
    if (!ungrouped) return false;
    await finishDiagram2ObjectCommand();
    notify?.("Diagram group ungrouped.");
    return true;
  }

  async function renameDiagram2StructureNode(button) {
    if (!diagram2Controller || !diagram2CanMutateCurrentDocument()) return false;
    const target = diagram2StructureTargetFromButton(button);
    if (!target.id) return false;
    const currentName = diagram2StructureNodeName(target.kind, target.id);
    const name = String(await askDiagram2Text("Object name", "Rename Object", currentName) || "").trim();
    if (!name || name === currentName) return false;
    const renamed = await diagram2Controller.renameStructureNode(target.kind, target.id, name);
    if (!renamed) return false;
    await finishDiagram2ObjectCommand();
    notify?.("Diagram object renamed.");
    return true;
  }

  async function deleteDiagram2StructureNode(button) {
    if (!diagram2Controller || !diagram2Renderer || !diagram2CanMutateCurrentDocument()) return false;
    const target = diagram2StructureTargetFromButton(button);
    if (!target.id) return false;
    const selected = diagram2Controller.selectStructureNode(target.kind, target.id);
    if (!selected.length) return false;
    diagram2RendererState = diagram2Controller.currentState();
    diagram2SelectedObjectIds = selected;
    updateDiagram2ObjectTreeSelection(app, selected);
    updateDiagram2EditorControls();
    const deleted = await diagram2Controller.deleteSelectedObjects({
      label: "Delete object from tree",
      reason: "object tree delete"
    });
    if (!deleted) return false;
    await finishDiagram2ObjectCommand();
    notify?.("Diagram object deleted.");
    return true;
  }

  async function toggleDiagram2StructureLock(button) {
    if (!diagram2Controller || !diagram2CanMutateCurrentDocument()) return false;
    const target = diagram2StructureTargetFromButton(button);
    if (!target.id) return false;
    const changed = await diagram2Controller.setStructureNodeLocked(target.kind, target.id);
    if (!changed) return false;
    await finishDiagram2ObjectCommand();
    const selection = diagram2Controller.getObjectsByIds(
      target.kind === "group" ? diagram2Controller.selectedObjectIds() : [target.id]
    );
    const locked = selection.length > 0 && selection.every(object => object.locked === true);
    notify?.(`Diagram object${selection.length === 1 ? "" : "s"} ${locked ? "locked" : "unlocked"}.`);
    return true;
  }

  async function toggleDiagram2StructureVisibility(button) {
    if (!diagram2Controller || !diagram2CanMutateCurrentDocument()) return false;
    const target = diagram2StructureTargetFromButton(button);
    if (!target.id) return false;
    const changed = await diagram2Controller.setStructureNodeVisibility(target.kind, target.id);
    if (!changed) return false;
    await finishDiagram2ObjectCommand();
    return true;
  }

  async function toggleDiagram2SelectionVisibility() {
    if (!diagram2Controller || !diagram2CanMutateCurrentDocument()) return false;
    const selected = diagram2Controller.getObjectsByIds(diagram2Controller.selectedObjectIds());
    if (!selected.length) return false;
    const visible = !selected.every(object => object.visible !== false);
    let changed = false;
    for (const object of selected) {
      changed = await diagram2Controller.setStructureNodeVisibility("object", object.id, visible) || changed;
    }
    if (!changed) return false;
    await finishDiagram2ObjectCommand();
    return true;
  }

  async function reorderDiagram2StructureNode(moveInput = {}) {
    if (!diagram2Controller || !diagram2CanMutateCurrentDocument()) return false;
    const move = {
      draggedKind: moveInput.draggedKind || diagram2ObjectTreeDrag?.kind || "object",
      draggedId: moveInput.draggedId || diagram2ObjectTreeDrag?.id || diagram2Controller.selectedObjectIds()[0] || "",
      targetKind: moveInput.targetKind || "root",
      targetId: moveInput.targetId || "",
      targetPlacement: moveInput.targetPlacement || "inside"
    };
    const reordered = await diagram2Controller.reorderStructureNode(move);
    if (!reordered) return false;
    await finishDiagram2ObjectCommand();
    return true;
  }

  async function saveDiagram2SelectionTemplate() {
    if (!diagram2Controller || !diagram2CanMutateCurrentDocument() || !diagram2TemplateState?.loaded) return false;
    if (diagram2TemplateCapacityReached(diagram2TemplateState.library)) {
      setDiagram2TemplateMessage("Template library is full.");
      return false;
    }
    const name = await askDiagram2Text("Template name", "Save Diagram Template", "Template");
    if (!String(name || "").trim()) return false;
    const template = await captureDiagram2SelectionTemplate(
      diagram2Controller.currentState(),
      diagram2Controller.selectedObjectIds(),
      name
    );
    if (!template) {
      setDiagram2TemplateMessage("Select one or more objects before saving a template.");
      return false;
    }
    return persistDiagram2Templates({
      ...diagram2TemplateState.library,
      templates: [template, ...(diagram2TemplateState.library.templates || [])]
    }, `Template "${template.name}" saved.`);
  }

  async function uploadDiagram2Templates(files) {
    if (!diagram2TemplateState?.loaded || !Array.isArray(files) || !files.length) return false;
    const templates = [...(diagram2TemplateState.library.templates || [])];
    let imported = 0;
    for (const file of files) {
      if (templates.length >= 50) break;
      try {
        const template = parseDiagram2TemplateUpload(await file.text());
        templates.unshift(template);
        imported += 1;
      } catch (error) {
        notify?.(error?.message || "One Diagram template could not be imported.");
      }
    }
    if (!imported) {
      setDiagram2TemplateMessage("No templates were imported.");
      return false;
    }
    return persistDiagram2Templates({
      ...diagram2TemplateState.library,
      templates
    }, `${imported} template${imported === 1 ? "" : "s"} imported.`);
  }

  async function restoreDiagram2Templates() {
    if (!diagram2TemplateState?.loaded || !diagram2TemplateState.defaultLoaded) return false;
    const restored = restoreDiagram2DefaultTemplates(
      diagram2TemplateState.library,
      diagram2TemplateState.defaultLibrary
    );
    if (restored.capacityExceeded) {
      setDiagram2TemplateMessage(`Remove ${restored.requiredSlots} template${restored.requiredSlots === 1 ? "" : "s"} before restoring defaults.`);
      return false;
    }
    if (!restored.addedCount) {
      setDiagram2TemplateMessage("Default templates are already present.");
      return false;
    }
    return persistDiagram2Templates(restored.library, "Default templates restored.");
  }

  async function applyDiagram2TemplateById(templateId) {
    if (!diagram2Controller || !diagram2CanMutateCurrentDocument()) return false;
    const template = diagram2TemplateById(templateId);
    if (!template) return false;
    const applied = await diagram2Controller.applyTemplate(template, diagram2InsertionCenter());
    if (!applied) return false;
    await finishDiagram2ObjectCommand();
    setDiagram2TemplateMessage(`Template "${template.name}" added to the canvas.`);
    return true;
  }

  async function formatDiagram2SelectionFromTemplate(templateId) {
    if (!diagram2Controller || !diagram2CanMutateCurrentDocument()) return false;
    const template = diagram2TemplateById(templateId);
    if (!template) return false;
    const applied = await diagram2Controller.applyTemplateFormatting(template);
    if (!applied) return false;
    await finishDiagram2ObjectCommand();
    setDiagram2TemplateMessage(`Template "${template.name}" formatting applied.`);
    return true;
  }

  async function renameDiagram2Template(templateId) {
    const template = diagram2TemplateById(templateId);
    if (!template || !diagram2TemplateState?.loaded) return false;
    const name = String(await askDiagram2Text("Template name", "Rename Diagram Template", template.name) || "").trim();
    if (!name || name === template.name) return false;
    return persistDiagram2Templates({
      ...diagram2TemplateState.library,
      templates: diagram2TemplateState.library.templates.map(item =>
        item.id === template.id ? { ...item, name, updatedAt: new Date().toISOString() } : item)
    }, `Template renamed to "${name}".`);
  }

  async function updateDiagram2TemplateFromSelection(templateId) {
    if (!diagram2Controller || !diagram2CanMutateCurrentDocument()) return false;
    const template = diagram2TemplateById(templateId);
    if (!template) return false;
    const replacement = await captureDiagram2SelectionTemplate(
      diagram2Controller.currentState(),
      diagram2Controller.selectedObjectIds(),
      template.name
    );
    if (!replacement) {
      setDiagram2TemplateMessage("Select one or more objects before updating a template.");
      return false;
    }
    return persistDiagram2Templates({
      ...diagram2TemplateState.library,
      templates: diagram2TemplateState.library.templates.map(item =>
        item.id === template.id
          ? { ...replacement, id: template.id, createdAt: template.createdAt || replacement.createdAt }
          : item)
    }, `Template "${template.name}" updated.`);
  }

  async function moveDiagram2Template(templateId, direction) {
    const templates = [...(diagram2TemplateState?.library?.templates || [])];
    const index = templates.findIndex(template => template.id === templateId);
    const nextIndex = index + Number(direction || 0);
    if (index < 0 || nextIndex < 0 || nextIndex >= templates.length) return false;
    [templates[index], templates[nextIndex]] = [templates[nextIndex], templates[index]];
    return persistDiagram2Templates({
      ...diagram2TemplateState.library,
      templates
    }, "Template order saved.");
  }

  function downloadDiagram2TemplateById(templateId) {
    const template = diagram2TemplateById(templateId);
    if (!template) return false;
    const file = diagram2TemplateDownload(template);
    downloadTextFile(file.contents, file.fileName, "application/json");
    return true;
  }

  async function deleteDiagram2Template(templateId) {
    const template = diagram2TemplateById(templateId);
    if (!template || !diagram2TemplateState?.loaded) return false;
    const confirmed = await confirmDiagram2(`Delete the "${template.name}" Diagram template?`, "Delete Diagram Template", "Delete");
    if (!confirmed) return false;
    return persistDiagram2Templates({
      ...diagram2TemplateState.library,
      templates: diagram2TemplateState.library.templates.filter(item => item.id !== template.id)
    }, `Template "${template.name}" deleted.`);
  }

  async function setDiagram2DrawingDefault(type) {
    if (!diagram2Controller || !diagram2CanMutateCurrentDocument() || !diagram2TemplateState?.loaded) return false;
    const defaultStyle = diagram2Controller.setDrawingDefaultFromSelection(type);
    if (!defaultStyle) {
      setDiagram2TemplateMessage(`Select a ${type === "arrow" ? "arrow" : "rectangle"} first.`);
      return false;
    }
    return persistDiagram2Templates({
      ...diagram2TemplateState.library,
      defaults: {
        ...(diagram2TemplateState.library.defaults || {}),
        [type]: defaultStyle
      }
    }, `${type === "arrow" ? "Arrow" : "Rectangle"} default saved.`);
  }

  async function resetDiagram2DrawingDefault(type) {
    if (!diagram2Controller || !diagram2TemplateState?.loaded) return false;
    diagram2Controller.resetDrawingDefault(type);
    return persistDiagram2Templates({
      ...diagram2TemplateState.library,
      defaults: {
        ...(diagram2TemplateState.library.defaults || {}),
        [type]: null
      }
    }, `${type === "arrow" ? "Arrow" : "Rectangle"} default reset.`);
  }

  async function editDiagram2ObjectText(object) {
    if (!diagram2Controller || !diagram2CanMutateCurrentDocument()) return false;
    const value = await openDiagram2TextEditor({
      object,
      bindRichTextButtons
    });
    if (value == null) return false;
    const updated = await diagram2Controller.updateObjectText(object.id, value);
    if (!updated) return false;
    await finishDiagram2ObjectCommand();
    return true;
  }

  async function editDiagram2SelectedEntity() {
    if (!diagram2Controller || !diagram2CanMutateCurrentDocument()) return false;
    const entity = diagram2Controller.getObjectsByIds(diagram2Controller.selectedObjectIds())
      .find(object => object?.type === "entity");
    if (!entity) return false;
    const definition = await openDiagram2EntityEditor({ object: entity });
    if (!definition) return false;
    const updated = await diagram2Controller.updateEntityDefinition(entity.id, definition);
    if (!updated) return false;
    await finishDiagram2ObjectCommand();
    return true;
  }

  async function addDiagram2EntityFromDialog() {
    if (!diagram2Controller || !diagram2Renderer || diagram2Busy || !diagram2CanMutateCurrentDocument()) return false;
    const definition = await openDiagram2EntityEditor({});
    if (!definition) return false;
    const added = await diagram2Controller.addEntity(
      definition,
      diagram2Controller.snapPoint(diagram2InsertionCenter())
    );
    if (!added) return false;
    diagram2Controller.setActiveTool("select");
    await finishDiagram2ObjectCommand();
    return true;
  }

  async function addDiagram2RelationshipFromDialog() {
    if (!diagram2Controller || !diagram2Renderer || diagram2Busy || !diagram2CanMutateCurrentDocument()) return false;
    const selectedEntityId = diagram2Controller.getObjectsByIds(diagram2Controller.selectedObjectIds())
      .find(object => object?.type === "entity")?.id || "";
    const relationship = await openDiagram2RelationshipEditor({
      state: diagram2Controller.currentState(),
      selectedEntityId
    });
    if (!relationship) return false;
    const added = await diagram2Controller.addRelationship(relationship);
    if (!added) return false;
    await finishDiagram2ObjectCommand();
    return true;
  }

  async function addDiagram2SelectedEntityField() {
    const entity = diagram2SelectedEntity();
    if (!entity) return false;
    const added = await diagram2Controller.addEntityField(entity.id, {
      name: "NewField",
      dataType: "nvarchar(120)",
      nullable: true
    });
    if (!added) return false;
    await finishDiagram2ObjectCommand();
    return true;
  }

  async function applyDiagram2SelectedEntityFieldPatch(fieldIndex, patch) {
    const entity = diagram2SelectedEntity();
    if (!entity || !Number.isInteger(fieldIndex)) return false;
    const beforeName = entity.fields?.[fieldIndex]?.name || "";
    const applied = await diagram2Controller.updateEntityField(entity.id, fieldIndex, patch);
    if (!applied) return false;
    await finishDiagram2ObjectCommand();
    const nextName = diagram2Controller.getObjectById(entity.id)?.fields?.[fieldIndex]?.name || "";
    if (patch && Object.hasOwn(patch, "name") && beforeName !== nextName && String(patch.name || "").trim() !== nextName) {
      notify?.(`Duplicate field name resolved as ${nextName}.`);
    }
    return true;
  }

  async function applyDiagram2SelectedEntityFieldReference(fieldIndex, reference) {
    const entity = diagram2SelectedEntity();
    if (!entity || !Number.isInteger(fieldIndex)) return false;
    const applied = await diagram2Controller.setEntityFieldReference(entity.id, fieldIndex, reference);
    if (!applied) return false;
    await finishDiagram2ObjectCommand();
    return true;
  }

  async function moveDiagram2SelectedEntityField(fieldIndex, direction) {
    const entity = diagram2SelectedEntity();
    if (!entity || !Number.isInteger(fieldIndex)) return false;
    const moved = await diagram2Controller.moveEntityField(entity.id, fieldIndex, direction);
    if (!moved) return false;
    await finishDiagram2ObjectCommand();
    return true;
  }

  async function removeDiagram2SelectedEntityField(fieldIndex) {
    const entity = diagram2SelectedEntity();
    if (!entity || !Number.isInteger(fieldIndex)) return false;
    const removed = await diagram2Controller.removeEntityField(entity.id, fieldIndex);
    if (!removed) return false;
    await finishDiagram2ObjectCommand();
    return true;
  }

  function diagram2SelectedEntity() {
    return diagram2Controller?.getObjectsByIds(diagram2Controller.selectedObjectIds())
      .find(object => object?.type === "entity" && object.locked !== true) || null;
  }

  async function autoFormatDiagram2Compact() {
    if (!diagram2Controller || !diagram2Renderer || diagram2Busy || !diagram2CanMutateCurrentDocument()) return false;
    const progress = openDiagram2CompactProgress(app);
    try {
      const applied = await diagram2Controller.autoFormatCompact({
        signal: progress?.signal,
        onProgress: update => progress?.update(update)
      });
      if (!applied) {
        notify?.(progress?.signal?.aborted ? "Diagram 2 Compact canceled." : "Diagram 2 Compact found no better layout.");
        updateDiagram2EditorControls();
        return false;
      }
      await finishDiagram2ObjectCommand();
      notify?.("Diagram 2 entities compacted.");
      return true;
    } finally {
      progress?.close();
    }
  }

  async function generateDiagram2PmtDatabaseSchema() {
    if (diagram2GeneratingDatabaseSchema
      || typeof loadPmtDatabaseSchema !== "function"
      || typeof createDiagramDocument !== "function"
      || !canAccessResource("Documentation", "Create")) {
      return false;
    }
    diagram2GeneratingDatabaseSchema = true;
    updateDiagram2EditorControls();
    try {
      const schema = await loadPmtDatabaseSchema();
      const diagram = buildPmtDatabaseSchemaDiagram(schema);
      const result = await createDiagramDocument({
        title: diagram.title,
        diagram
      });
      selectedDiagramDocumentId = Number(result?.id || 0) || selectedDiagramDocumentId;
      writePreference(preferenceKeys.diagramSelectedDocument, selectedDiagramDocumentId);
      writePreference(preferenceKeys.diagram2SelectedDocument, selectedDiagramDocumentId);
      notify?.("PMT Database Schema Diagram created.");
      if (diagram2DocumentMode !== "edit") render();
      return true;
    } catch (error) {
      notify?.(error?.message || "PMT Database Schema Diagram could not be generated.");
      return false;
    } finally {
      diagram2GeneratingDatabaseSchema = false;
      updateDiagram2EditorControls();
    }
  }

  async function useDiagram2SelectedRelationshipRoute() {
    if (!diagram2Controller || !diagram2Renderer || diagram2Busy || !diagram2CanMutateCurrentDocument()) return false;
    const [relationshipId] = diagram2Controller.selectedRelationshipIds();
    if (!relationshipId) return false;
    const applied = await diagram2Controller.useRelationshipRoute(relationshipId);
    if (!applied) return false;
    await finishDiagram2ObjectCommand();
    return true;
  }

  async function addDiagram2SelectedRelationshipRoutePoint() {
    if (!diagram2Controller || !diagram2Renderer || diagram2Busy || !diagram2CanMutateCurrentDocument()) return false;
    const [relationshipId] = diagram2Controller.selectedRelationshipIds();
    if (!relationshipId) return false;
    const applied = await diagram2Controller.insertRelationshipRoutePoint(relationshipId);
    if (!applied) return false;
    await finishDiagram2ObjectCommand();
    return true;
  }

  async function removeDiagram2SelectedRelationshipRoutePoint() {
    if (!diagram2Controller || !diagram2Renderer || diagram2Busy || !diagram2CanMutateCurrentDocument()) return false;
    const [relationshipId] = diagram2Controller.selectedRelationshipIds();
    if (!relationshipId) return false;
    const applied = await diagram2Controller.removeRelationshipRoutePoint(relationshipId);
    if (!applied) return false;
    await finishDiagram2ObjectCommand();
    return true;
  }

  async function clearDiagram2SelectedRelationshipRoute() {
    if (!diagram2Controller || !diagram2Renderer || diagram2Busy || !diagram2CanMutateCurrentDocument()) return false;
    const relationshipIds = diagram2Controller.selectedRelationshipIds();
    if (!relationshipIds.length) return false;
    const applied = await diagram2Controller.clearRelationshipRoutes(relationshipIds);
    if (!applied) return false;
    await finishDiagram2ObjectCommand();
    return true;
  }

  async function finishDiagram2ObjectCommand() {
    syncDiagram2InteractionState();
    refreshDiagram2ObjectsPane();
    refreshDiagram2TemplatePane();
    const diagnostics = await diagram2Renderer?.whenIdle();
    if (diagnostics) updateDiagram2Diagnostics(diagnostics);
    syncDiagram2InteractionState();
  }

  async function readDiagram2SelectionClipboard() {
    try {
      const text = await globalThis.navigator?.clipboard?.readText?.();
      if (text) return text;
    } catch {
      // Use PMT's same-tab fallback when clipboard read permission is unavailable.
    }
    return String(
      globalThis.__pmtDiagramSelectionClipboard
      || globalThis.__pmtDiagram2SelectionClipboard
      || ""
    );
  }

  function syncDiagram2InteractionState() {
    if (!diagram2Controller) return;
    diagram2RendererState = diagram2Controller.currentState();
    diagram2SelectedObjectIds = diagram2Controller.selectedObjectIds();
    updateDiagram2EditorControls();
  }

  async function undoDiagram2() {
    if (!diagram2Controller || diagram2Busy) return false;
    const result = await diagram2Controller.undo();
    diagram2RendererState = diagram2Controller.currentState();
    diagram2SelectedObjectIds = diagram2Controller.selectedObjectIds();
    refreshDiagram2ObjectsPane();
    updateDiagram2EditorControls();
    const diagnostics = await diagram2Renderer?.whenIdle();
    if (diagnostics) updateDiagram2Diagnostics(diagnostics);
    return result;
  }

  async function redoDiagram2() {
    if (!diagram2Controller || diagram2Busy) return false;
    const result = await diagram2Controller.redo();
    diagram2RendererState = diagram2Controller.currentState();
    diagram2SelectedObjectIds = diagram2Controller.selectedObjectIds();
    refreshDiagram2ObjectsPane();
    updateDiagram2EditorControls();
    const diagnostics = await diagram2Renderer?.whenIdle();
    if (diagnostics) updateDiagram2Diagnostics(diagnostics);
    return result;
  }

  async function addDiagram2ToolbarObject(type) {
    if (!diagram2Controller || !diagram2Renderer || diagram2Busy || !diagram2CanMutateCurrentDocument()) return false;
    const object = diagram2Controller.createDefaultObject(type, diagram2Controller.snapPoint(diagram2InsertionCenter()));
    if (!object) return false;

    const added = await diagram2Controller.addObject(object, {
      label: `Add ${diagram2ToolLabel(type)}`,
      reason: `toolbar add ${type}`
    });
    if (!added) return false;

    diagram2Controller.setActiveTool("select");
    diagram2RendererState = diagram2Controller.currentState();
    diagram2SelectedObjectIds = diagram2Controller.selectedObjectIds();
    refreshDiagram2ObjectsPane();
    updateDiagram2EditorControls();
    const diagnostics = await diagram2Renderer.whenIdle();
    updateDiagram2Diagnostics(diagnostics);
    return true;
  }

  function diagram2InsertionCenter() {
    const canvas = app.querySelector("[data-diagram2-viewer-canvas]");
    const rect = canvas?.getBoundingClientRect?.();
    if (diagram2Renderer && rect?.width && rect?.height) {
      return diagram2Renderer.screenToWorld({
        clientX: rect.left + (rect.width / 2),
        clientY: rect.top + (rect.height / 2)
      });
    }
    const current = diagram2Controller?.currentState?.() || diagram2RendererState || {};
    return {
      x: finiteNumber(current.width, 1600) / 2,
      y: finiteNumber(current.height, 900) / 2
    };
  }

  function refreshDiagram2ObjectsPane(options = {}) {
    const pane = app.querySelector("[data-diagram2-objects-pane]");
    const current = diagram2Controller?.state?.() || diagram2RendererState;
    if (!pane || !current) return;
    pane.outerHTML = diagram2ObjectsPaneHtml(
      current,
      diagram2Controller?.selectedObjectIds?.() || diagram2SelectedObjectIds,
      { search: diagram2ObjectSearch }
    );
    bindDiagram2ObjectTreeControls();
    if (options.preserveFocus === true) {
      const search = app.querySelector("[data-filter='diagram2-object-search']");
      search?.focus({ preventScroll: true });
      if (search) search.selectionStart = search.selectionEnd = search.value.length;
    }
  }

  function refreshDiagram2TemplatePane(rootInput = app) {
    const root = rootInput || app;
    const pane = root.querySelector("[data-diagram2-template-pane]");
    const current = diagram2Controller?.state?.() || diagram2RendererState;
    if (!pane || !current) return;
    const previousScrollTop = pane.querySelector(".diagram2-editor-left-pane-scroll")?.scrollTop || 0;
    pane.outerHTML = diagram2TemplatePaneHtml(
      diagram2TemplateState,
      current,
      diagram2Controller?.selectedObjectIds?.() || diagram2SelectedObjectIds
    );
    const nextScroll = root.querySelector("[data-diagram2-template-pane] .diagram2-editor-left-pane-scroll");
    if (nextScroll) nextScroll.scrollTop = previousScrollTop;
  }

  function setDiagram2TemplateMessage(message) {
    if (!diagram2TemplateState) return;
    diagram2TemplateState.message = String(message || "");
    diagram2TemplateState.error = "";
    refreshDiagram2TemplatePane();
  }

  async function persistDiagram2Templates(nextLibrary, message) {
    if (!diagram2TemplateState?.loaded) {
      setDiagram2TemplateMessage("Template storage is unavailable.");
      return false;
    }
    refreshDiagram2TemplatePane();
    const saved = await persistDiagram2TemplateLibrary(
      diagram2TemplateState,
      saveTemplateLibrary,
      nextLibrary,
      message
    );
    if (saved) diagram2Controller?.setDrawingDefaults(saved.defaults || {});
    refreshDiagram2TemplatePane();
    updateDiagram2EditorControls();
    if (saved && message) notify?.(message);
    else if (!saved && diagram2TemplateState.message) notify?.(diagram2TemplateState.message);
    return Boolean(saved);
  }

  function diagram2TemplateById(templateId) {
    const id = String(templateId || "").trim();
    return (diagram2TemplateState?.library?.templates || [])
      .find(template => String(template.id || "") === id) || null;
  }

  function diagram2StructureTargetFromButton(button) {
    const selectedIds = diagram2Controller?.selectedObjectIds?.() || [];
    const id = String(button?.dataset?.objectId || button?.dataset?.diagram2ObjectId || selectedIds[0] || "").trim();
    const kind = String(button?.dataset?.nodeKind || button?.dataset?.diagram2TreeNodeKind || "object").trim() || "object";
    return { kind, id };
  }

  function diagram2StructureNodeName(kind, id) {
    const state = diagram2Controller?.currentState?.() || {};
    if (kind === "group") return String(state.groupNames?.[id] || "Group");
    return String((state.objects || []).find(object => object.id === id)?.name || "Object");
  }

  async function askDiagram2Text(message, title, currentValue = "") {
    if (typeof askForText === "function") {
      return askForText(message, title, currentValue);
    }
    return globalThis.window?.prompt?.(message, currentValue) ?? "";
  }

  async function confirmDiagram2(message, title, actionLabel) {
    if (typeof confirm === "function") return confirm(message, title, actionLabel);
    return globalThis.window?.confirm?.(message) === true;
  }

  function diagram2ToolLabel(type) {
    return {
      rectangle: "Rectangle",
      circle: "Circle",
      arrow: "Arrow",
      line: "Line",
      textbox: "Text Box",
      "rich-text": "Rich Text",
      entity: "Entity"
    }[String(type || "").trim().toLowerCase()] || "object";
  }

  function updateDiagram2EditorControls() {
    const fallbackHasDocument = Boolean(currentDiagram2Document() && diagram2RendererState);
    const fallbackSecurity = diagram2CurrentSecurity();
    const status = diagram2Controller?.statusSnapshot?.() || {
      busy: diagram2Busy,
      canRead: fallbackHasDocument,
      canEdit: fallbackSecurity.canUpdate === true,
      canExport: fallbackSecurity.canExport === true,
      dirty: false,
      hasDocument: fallbackHasDocument,
      selectedCount: diagram2SelectedObjectIds.length,
      selectedObjectIds: diagram2SelectedObjectIds,
      history: { canUndo: false, canRedo: false },
      canSave: false
    };
    const selectedObjectIdSet = new Set((status.selectedObjectIds || diagram2SelectedObjectIds).map(String));
    const selectedObjects = (diagram2Controller?.state?.().objects || diagram2RendererState?.objects || [])
      .filter(object => selectedObjectIdSet.has(String(object.id || "")));
    selectedObjects.push(...(diagram2Controller?.selectedRelationshipObjects?.() || []));
    const hasDocument = fallbackHasDocument;
    const hasSelection = status.selectedCount > 0;
    const canUndo = status.history?.canUndo === true;
    const canRedo = status.history?.canRedo === true;
    const dirty = status.dirty === true;
    const busy = diagram2Busy || diagram2GeneratingDatabaseSchema || status.busy === true;
    const canEdit = status.canEdit !== false;
    const canExport = status.canExport !== false;
    const saveState = app.querySelector("[data-diagram2-save-state]");
    const editState = app.querySelector("[data-diagram2-edit-state]");
    const statusText = diagram2DocumentMode === "edit"
      ? (busy ? "Saving..." : (dirty ? "Unsaved changes" : "Saved"))
      : "Read-only document";
    if (saveState) saveState.textContent = statusText;
    if (editState) editState.textContent = hasSelection
      ? `${status.selectedCount} selected`
      : statusText;
    app.querySelector("[data-diagram2-screen]")?.classList.toggle("has-unsaved-diagram2", dirty);
    updateDiagram2ShellStatus(app.querySelector("[data-diagram2-editor-shell]"), {
      ...status,
      busy,
      dirty,
      history: { ...status.history, canUndo, canRedo },
      state: diagram2Controller?.currentState?.() || diagram2RendererState || {},
      selectedObjects
    });
    updateDiagram2ObjectTreeSelection(app, status.selectedObjectIds || []);

    app.querySelectorAll("[data-diagram2-requires-document]").forEach(button => {
      button.disabled = !hasDocument || busy;
    });
    app.querySelectorAll("[data-diagram2-requires-export]").forEach(button => {
      button.disabled = !hasDocument || !canExport || busy;
    });
    app.querySelectorAll("[data-diagram2-requires-update]").forEach(button => {
      button.disabled = !hasDocument || !canEdit || busy;
    });
    app.querySelectorAll("[data-diagram2-requires-dirty]").forEach(button => {
      button.disabled = !hasDocument || !dirty || !canEdit || busy;
    });
    app.querySelectorAll("[data-diagram2-requires-selection]").forEach(button => {
      if (button.closest("[data-diagram2-context-menu]")) return;
      button.disabled = !hasDocument || !hasSelection || busy;
    });
    app.querySelectorAll("[data-diagram2-requires-multi-selection]").forEach(button => {
      if (button.closest("[data-diagram2-context-menu]")) return;
      button.disabled = !hasDocument || status.selectedCount < 2 || busy;
    });
    app.querySelectorAll("[data-diagram2-requires-undo]").forEach(button => {
      button.disabled = !hasDocument || !canUndo || !canEdit || busy;
    });
    app.querySelectorAll("[data-diagram2-requires-redo]").forEach(button => {
      button.disabled = !hasDocument || !canRedo || !canEdit || busy;
    });
    app.querySelectorAll("[data-diagram2-pending-command]").forEach(button => {
      button.disabled = true;
    });
  }

  function bindDiagram2SearchInput() {
    const search = app.querySelector("[data-filter='diagram2-search']");
    if (!search) return;
    search.addEventListener("input", event => {
      diagram2Search = String(event.target.value || "").trim();
      writePreference(preferenceKeys.diagramSearch, diagram2Search);
      render();
      app.querySelector("[data-filter='diagram2-search']")?.focus({ preventScroll: true });
    });
  }

  function bindDiagram2TreeSplitter() {
    const splitter = app.querySelector("[data-diagram2-tree-splitter]");
    const screen = app.querySelector("[data-diagram2-screen]");
    const layout = app.querySelector("[data-diagram2-tree-layout]") || screen;
    if (!splitter || !screen || !layout || diagram2TreePaneHidden) return;

    splitter.addEventListener("pointerdown", event => {
      event.preventDefault();
      dragAbortController?.abort();
      dragAbortController = new AbortController();
      const { signal } = dragAbortController;
      splitter.setPointerCapture?.(event.pointerId);
      screen.classList.add("is-resizing-tree");

      const move = moveEvent => {
        const bounds = layout.getBoundingClientRect();
        diagram2TreePaneWidth = clampTreePaneWidth(moveEvent.clientX - bounds.left);
        layout.style.setProperty("--documentation-tree-pane-width", `${diagram2TreePaneWidth}px`);
      };
      const finish = () => {
        writePreference(preferenceKeys.diagramTreePaneWidth, diagram2TreePaneWidth);
        screen.classList.remove("is-resizing-tree");
        abortTreePaneDrag();
      };
      window.addEventListener("pointermove", move, { signal });
      window.addEventListener("pointerup", finish, { signal, once: true });
      window.addEventListener("pointercancel", finish, { signal, once: true });
    });
  }

  function bindDiagram2TreeContextMenu() {
    diagram2TreeContextMenuController?.abort();
    diagram2TreeContextMenuController = null;

    const tree = app.querySelector("[data-diagram2-tree] .diagram2-tree-list");
    const menu = app.querySelector("[data-diagram2-tree-context-menu]");
    if (!tree || !menu) return;

    const controller = new AbortController();
    const { signal } = controller;
    diagram2TreeContextMenuController = controller;

    const closeMenu = () => {
      menu.hidden = true;
    };

    const showMenu = (document, clientX, clientY) => {
      if (selectedDiagramDocumentId !== document.id) {
        selectedDiagramDocumentId = document.id;
        writePreference(preferenceKeys.diagramSelectedDocument, selectedDiagramDocumentId);
        render();
      }

      const activeMenu = app.querySelector("[data-diagram2-tree-context-menu]");
      if (!activeMenu) return;
      activeMenu.querySelectorAll("[data-action]").forEach(button => {
        button.dataset.id = String(document.id);
      });
      activeMenu.querySelectorAll("[data-diagram2-context-requires-update]").forEach(button => {
        button.disabled = !diagram2CanEdit(document);
      });
      activeMenu.querySelectorAll("[data-diagram2-context-requires-delete]").forEach(button => {
        button.disabled = !diagram2CanDelete(document);
      });
      activeMenu.querySelectorAll("[data-diagram2-context-requires-create]").forEach(button => {
        button.disabled = !canAccessResource("Documentation", "Create");
      });
      activeMenu.querySelectorAll("[data-diagram2-context-requires-export]").forEach(button => {
        button.disabled = !diagram2CanExport(document);
      });
      activeMenu.querySelectorAll("[data-diagram2-context-requires-public]").forEach(button => {
        button.disabled = document.isPrivate !== false;
      });

      activeMenu.hidden = false;
      const margin = 8;
      const maximumLeft = Math.max(margin, window.innerWidth - activeMenu.offsetWidth - margin);
      const maximumTop = Math.max(margin, window.innerHeight - activeMenu.offsetHeight - margin);
      activeMenu.style.left = `${Math.round(Math.max(margin, Math.min(clientX, maximumLeft)))}px`;
      activeMenu.style.top = `${Math.round(Math.max(margin, Math.min(clientY, maximumTop)))}px`;
      activeMenu.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
    };

    tree.addEventListener("contextmenu", event => {
      const documentButton = event.target.closest?.("[data-action='select-diagram2-document']");
      const document = diagram2AllDocuments().find(item => item.id === Number(documentButton?.dataset.id || 0));
      if (!documentButton || !document) return;

      event.preventDefault();
      event.stopPropagation();
      showMenu(document, event.clientX, event.clientY);
    }, { signal });
    menu.addEventListener("contextmenu", event => event.preventDefault(), { signal });
    menu.addEventListener("click", closeMenu, { signal });
    window.addEventListener("pointerdown", event => {
      if (!menu.hidden && !menu.contains(event.target)) closeMenu();
    }, { signal });
    window.addEventListener("scroll", closeMenu, { capture: true, passive: true, signal });
    window.addEventListener("resize", closeMenu, { signal });
    window.addEventListener("keydown", event => {
      if (event.key === "Escape") closeMenu();
    }, { signal });
  }

  function bindDiagram2TreeDragAndDrop() {
    const tree = app.querySelector("[data-diagram2-tree] .diagram2-tree-list");
    if (!tree) return;
    let draggedId = 0;

    tree.addEventListener("dragstart", event => {
      const row = event.target.closest("[data-diagram2-tree-row][draggable='true']");
      draggedId = Number(row?.dataset.id || 0);
      if (!draggedId) {
        event.preventDefault();
        return;
      }
      row.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(draggedId));
    });

    tree.addEventListener("dragover", event => {
      if (!draggedId) return;
      const rootDrop = event.target.closest("[data-diagram2-root-drop]");
      const row = event.target.closest("[data-diagram2-tree-row]");
      clearDiagram2DropCues(tree);
      if (rootDrop) {
        event.preventDefault();
        rootDrop.classList.add("is-drop-target");
        return;
      }
      if (!row || Number(row.dataset.id || 0) === draggedId) return;
      const placement = diagram2DropPlacement(row, event.clientY);
      if (!diagram2DropAllowed(draggedId, Number(row.dataset.id || 0), placement)) return;
      event.preventDefault();
      row.classList.add(`is-drop-${placement}`);
      event.dataTransfer.dropEffect = "move";
    });

    tree.addEventListener("drop", async event => {
      if (!draggedId) return;
      event.preventDefault();
      const movedId = draggedId;
      const rootDrop = event.target.closest("[data-diagram2-root-drop]");
      const row = event.target.closest("[data-diagram2-tree-row]");
      const targetId = Number(row?.dataset.id || 0);
      const placement = rootDrop ? "root" : diagram2DropPlacement(row, event.clientY);
      clearDiagram2DropCues(tree);

      const move = diagram2MoveAfterDrop(movedId, targetId, placement);
      if (!move) return;
      try {
        await moveDiagramDocument?.(move.document, move);
        diagram2Sort = "custom";
        writePreference(preferenceKeys.diagramSort, diagram2Sort);
        selectedDiagramDocumentId = movedId;
        writePreference(preferenceKeys.diagramSelectedDocument, selectedDiagramDocumentId);
        notify?.("Diagram moved.");
        if (active) render();
      } catch (error) {
        notify?.(error?.message || "The Diagram could not be moved.");
        if (active) render();
      }
    });

    const finish = () => {
      tree.querySelector(".is-dragging")?.classList.remove("is-dragging");
      clearDiagram2DropCues(tree);
      draggedId = 0;
    };
    tree.addEventListener("dragend", finish);
    tree.addEventListener("dragleave", event => {
      if (!tree.contains(event.relatedTarget)) clearDiagram2DropCues(tree);
    });
  }

  async function createNewDiagram2() {
    if (diagram2Creating) return;
    if (!canAccessResource("Documentation", "Create")) {
      notify?.("You do not have permission to create Diagrams.");
      return;
    }
    if (typeof createDiagramDocument !== "function") {
      notify?.("Diagram creation is not available.");
      return;
    }
    diagram2Creating = true;
    render();

    try {
      const title = nextUntitledDiagram2Title(diagram2AllDocuments().filter(diagram2OwnedByCurrentUser));
      const diagram = createBlankDiagram2(title);
      const result = await createDiagramDocument({
        title,
        diagram
      });
      if (!active) return;
      selectedDiagramDocumentId = Number(result?.id || 0);
      diagram2DocumentMode = selectedDiagramDocumentId ? "edit" : "readonly";
      diagram2ModeDocumentId = selectedDiagramDocumentId;
      resetDiagram2ViewerToFit();
      diagram2ViewMode = "tree";
      writePreference(preferenceKeys.diagramSelectedDocument, selectedDiagramDocumentId);
      writePreference(preferenceKeys.diagramViewMode, diagram2ViewMode);
      if (selectedDiagramDocumentId) updateBrowserUrl(routeForContent("diagram-2", selectedDiagramDocumentId));
      notify?.("Diagram created.");
    } catch (error) {
      notify?.(error?.message || "The Diagram could not be created.");
    } finally {
      diagram2Creating = false;
      if (active) render();
    }
  }

  async function importDiagram2PmtFile(file) {
    if (!file || diagram2Creating) return false;
    if (!diagram2CanImport()) {
      notify?.("You do not have permission to import Diagrams.");
      return false;
    }
    if (typeof createDiagramDocument !== "function") {
      notify?.("Diagram import is not available.");
      return false;
    }

    diagram2Creating = true;
    render();
    try {
      const imported = parseDiagram2PmtDiagramFile(await file.text());
      const title = availableDiagram2Title(imported.title, diagram2AllDocuments());
      const result = await createDiagramDocument({
        title,
        diagram: {
          state: imported.state,
          svg: imported.svg,
          fileName: `${safeFileName(title)}.svg`
        }
      });
      if (!active) return true;
      selectedDiagramDocumentId = Number(result?.id || 0);
      resetDiagram2ViewerToFit();
      diagram2ViewMode = "tree";
      writePreference(preferenceKeys.diagramSelectedDocument, selectedDiagramDocumentId);
      writePreference(preferenceKeys.diagramViewMode, diagram2ViewMode);
      notify?.("PMT Diagram imported.");
      return true;
    } catch (error) {
      notify?.(error?.message || "The PMT Diagram could not be imported.");
      return false;
    } finally {
      diagram2Creating = false;
      if (active) render();
    }
  }

  async function duplicateDiagram2(document) {
    if (!canAccessResource("Documentation", "Create")) {
      notify?.("You do not have permission to create Diagrams.");
      return;
    }
    if (typeof createDiagramDocument !== "function") {
      notify?.("Diagram duplication is not available.");
      return;
    }

    try {
      const source = diagramDocumentImage(document)?.source || "";
      const loaded = await loadDiagramCanonicalState(source);
      const copyState = loaded.state ? normalizeDiagram2CanonicalState(loaded.state) : null;
      if (!copyState) throw new Error("The Diagram could not be copied.");
      const title = nextAvailableDiagram2CopyTitle(document.title, diagram2AllDocuments());
      const result = await createDiagramDocument({
        title,
        diagram: {
          state: copyState,
          svg: buildAnnotationSvg(copyState),
          fileName: `${safeFileName(title)}.svg`
        },
        sourceDocument: document
      });
      if (!active) return;
      selectedDiagramDocumentId = Number(result?.id || 0);
      diagram2DocumentMode = "readonly";
      diagram2ModeDocumentId = selectedDiagramDocumentId;
      resetDiagram2ViewerToFit();
      diagram2ViewMode = "tree";
      writePreference(preferenceKeys.diagramSelectedDocument, selectedDiagramDocumentId);
      writePreference(preferenceKeys.diagramViewMode, diagram2ViewMode);
      notify?.("Diagram duplicated.");
      render();
    } catch (error) {
      notify?.(error?.message || "The Diagram could not be duplicated.");
    }
  }

  function editDiagram2Info(document) {
    const selectedProjectId = document.projectId || "";
    const selectedSprintId = document.sprintId || "";
    openEditor?.("Edit Diagram Info", `
      <div class="form-grid diagram-info-form">
        ${field("Diagram Name", "title", document.title || "", "text", "", "", 220, { required: true })}
        ${selectOptionsField("Visibility", "visibility", [
          { id: "private", title: "Private" },
          { id: "public", title: "Public" }
        ], document.isPrivate === false ? "public" : "private")}
        ${selectOptionsField("Project", "projectId", diagram2ProjectOptions(), selectedProjectId)}
        ${selectOptionsField("Sprint", "sprintId", diagram2SprintOptions(selectedProjectId), selectedSprintId)}
        ${selectOptionsField("Parent", "parentBlogId", diagram2ParentOptions(document, selectedProjectId, selectedSprintId, document.isPrivate === false), document.parentBlogId || "")}
        ${diagram2InfoMetaHtml(document)}
      </div>
    `, async root => {
      const projectId = optionalNumberValue(root, "projectId");
      await saveDiagramInfo?.(document, {
        title: value(root, "title"),
        projectId,
        sprintId: projectId ? optionalNumberValue(root, "sprintId") : null,
        parentBlogId: optionalNumberValue(root, "parentBlogId"),
        isPrivate: root.querySelector("[name='visibility']")?.value !== "public",
        isPinned: false
      });
      selectedDiagramDocumentId = document.id;
      writePreference(preferenceKeys.diagramSelectedDocument, selectedDiagramDocumentId);
      updateBrowserUrl(routeForContent("diagram-2", document.id), { replace: true });
    }, "title", root => bindDiagram2InfoRules(root, document));
  }

  function bindDiagram2InfoRules(root, document) {
    const projectSelect = root.querySelector("[name='projectId']");
    const sprintSelect = root.querySelector("[name='sprintId']");
    const parentSelect = root.querySelector("[name='parentBlogId']");
    const visibilitySelect = root.querySelector("[name='visibility']");
    if (!projectSelect || !sprintSelect || !parentSelect || !visibilitySelect) return;

    const syncParentOptions = () => {
      const projectId = optionalNumberValue(root, "projectId");
      const sprintId = projectId ? optionalNumberValue(root, "sprintId") : null;
      const currentParentId = optionalNumberValue(root, "parentBlogId");
      const options = diagram2ParentOptions(document, projectId, sprintId, visibilitySelect.value === "public");
      parentSelect.innerHTML = diagram2OptionsHtml(options, currentParentId);
      if (!options.some(option => String(option.id) === String(currentParentId || ""))) parentSelect.value = "";
    };

    const syncSprintOptions = () => {
      const projectId = optionalNumberValue(root, "projectId");
      const currentSprintId = optionalNumberValue(root, "sprintId");
      const options = diagram2SprintOptions(projectId);
      sprintSelect.innerHTML = diagram2OptionsHtml(options, currentSprintId);
      if (!projectId || !options.some(option => String(option.id) === String(currentSprintId || ""))) sprintSelect.value = "";
      syncParentOptions();
    };

    projectSelect.addEventListener("change", syncSprintOptions);
    sprintSelect.addEventListener("change", syncParentOptions);
    visibilitySelect.addEventListener("change", syncParentOptions);
  }

  function diagram2InfoMetaHtml(document) {
    const history = diagramLatestUpdatedHistory(document);
    return `
      <div class="diagram-info-meta">
        <div>
          <span>Created by</span>
          <strong>${escapeHtml(diagramUserName(document.createdByUserId))}</strong>
          <small>${escapeHtml(formatDate(document.createdAt))}</small>
        </div>
        <div>
          <span>Last edited by</span>
          <strong>${escapeHtml(diagramUserName(history?.userId || document.updatedByUserId || document.createdByUserId))}</strong>
          <small>${escapeHtml(formatDate(history?.createdAt || document.updatedAt || document.createdAt))}</small>
        </div>
      </div>
    `;
  }

  async function deleteDiagram2Document(document) {
    if (!diagram2CanDelete(document)) return;
    if (selectedDiagramDocumentId === document.id) {
      selectedDiagramDocumentId = 0;
      writePreference(preferenceKeys.diagramSelectedDocument, "");
    }
    await deleteItem?.(`/api/blogs/${document.id}`, "Delete this Diagram?");
    if (active) render();
  }

  function abortTreePaneDrag() {
    dragAbortController?.abort();
    dragAbortController = null;
  }

  function abortDiagram2TreeContextMenu() {
    diagram2TreeContextMenuController?.abort();
    diagram2TreeContextMenuController = null;
  }

  function diagram2Documents(allDocuments, directDocumentId) {
    const directDocument = allDocuments.find(document => document.id === directDocumentId);
    const documents = allDocuments.filter(diagram2MatchesFilters);
    if (directDocument && !documents.some(document => document.id === directDocument.id)) documents.push(directDocument);
    return documents.sort(diagram2DocumentCompare);
  }

  function diagram2AllDocuments() {
    return diagramAllDocuments(state.blogs, currentUserId);
  }

  function currentDiagram2Document() {
    return diagram2AllDocuments().find(document => document.id === selectedDiagramDocumentId) || null;
  }

  function diagram2DocumentIsEditMode(document) {
    return Boolean(
      document
      && diagram2DocumentMode === "edit"
      && diagram2ModeDocumentId === document.id
      && diagram2CanEdit(document)
    );
  }

  function diagram2EditModeActive() {
    return diagram2DocumentMode === "edit" && Boolean(diagram2Controller);
  }

  function diagram2OwnedByCurrentUser(document) {
    return Number(document?.createdByUserId || 0) === Number(currentUserId || 0);
  }

  function diagram2CanEdit(document) {
    return Boolean(document && diagram2OwnedByCurrentUser(document) && canAccessResource("Documentation", "Update"));
  }

  function diagram2CanDelete(document) {
    return Boolean(document && diagram2OwnedByCurrentUser(document) && canAccessResource("Documentation", "Delete"));
  }

  function diagram2CanImport() {
    return canAccessResource("Documentation", "Import");
  }

  function diagram2CanExport(document) {
    return Boolean(document && canAccessResource("Documentation", "Export"));
  }

  function diagram2SecurityContext(document) {
    return Object.freeze({
      resource: "Documentation",
      canRead: Boolean(document),
      canCreate: canAccessResource("Documentation", "Create"),
      canUpdate: diagram2CanEdit(document),
      canDelete: diagram2CanDelete(document),
      canImport: diagram2CanImport(),
      canExport: diagram2CanExport(document)
    });
  }

  function diagram2CurrentSecurity() {
    return diagram2HostAdapter?.security || diagram2SecurityContext(currentDiagram2Document());
  }

  function diagram2CanMutateCurrentDocument() {
    return diagram2CurrentSecurity().canUpdate === true;
  }

  function diagram2CurrentOutputState() {
    const stateForOutput = diagram2Controller?.state?.() || diagram2RendererState;
    return stateForOutput ? normalizeDiagram2CanonicalState(stateForOutput) : null;
  }

  function diagram2PublicLinkButtonHtml(document, className = "secondary text-icon-button diagram2-page-action", label = "") {
    if (document?.isPrivate !== false) return "";
    const content = label
      ? buttonContent("&#128279;", label)
      : `<span class="button-icon" aria-hidden="true">&#128279;</span>`;
    return `<button type="button" class="${escapeAttr(className)}" data-action="copy-public-diagram2-link" data-id="${document.id}" title="Public Link" aria-label="Public Link">${content}</button>`;
  }

  async function copyDiagram2PublicLink(document) {
    if (document?.isPrivate !== false) {
      notify?.("Only public diagrams can be shared with a public link.");
      return false;
    }

    return openPublicLinkDialog(async durationDays => {
      const link = await api("/api/public-links", {
        method: "POST",
        body: JSON.stringify({
          blogId: document.id,
          durationDays
        })
      });
      const token = String(link?.token || "").trim();
      if (!token) throw new Error("The public link could not be created.");
      return new URL(appUrl(`/public/diagram/${token}`), window.location.href).href;
    }, {
      notify,
      copiedMessage: "Public diagram link copied.",
      copyFailedMessage: "Public diagram link created. Copy it from the Public URL box."
    });
  }

  function createBlankDiagram2(title = "Diagram") {
    const stateForCreate = normalizeDiagram2CanonicalState({
      version: 1,
      width: 1600,
      height: 900,
      canvasBounds: { x: 0, y: 0, width: 1600, height: 900 },
      originalReference: "",
      objects: []
    });
    return {
      state: stateForCreate,
      svg: buildAnnotationSvg(stateForCreate),
      fileName: `${safeFileName(title)}.svg`
    };
  }

  function nextUntitledDiagram2Title(documents) {
    const titles = new Set((documents || [])
      .map(document => String(document?.title || "").trim().toLocaleLowerCase()));
    let index = 1;
    while (titles.has(`untitled ${index}`)) index += 1;
    return `Untitled ${index}`;
  }

  function availableDiagram2Title(title, documents) {
    const base = String(title || "Imported Diagram").trim() || "Imported Diagram";
    const titles = new Set((documents || []).map(document => String(document?.title || "").trim().toLocaleLowerCase()));
    if (!titles.has(base.toLocaleLowerCase())) return base;
    let index = 2;
    while (titles.has(`${base} ${index}`.toLocaleLowerCase())) index += 1;
    return `${base} ${index}`;
  }

  function nextAvailableDiagram2CopyTitle(title, documents) {
    const baseTitle = String(title || "Diagram").trim() || "Diagram";
    const titles = new Set((documents || []).map(document => String(document?.title || "").trim().toLocaleLowerCase()));
    const copyTitle = `${baseTitle} Copy`;
    if (!titles.has(copyTitle.toLocaleLowerCase())) return copyTitle;
    let index = 2;
    while (titles.has(`${copyTitle} ${index}`.toLocaleLowerCase())) index += 1;
    return `${copyTitle} ${index}`;
  }

  function diagram2ProjectOptions() {
    return [
      { id: "", title: "Global" },
      ...state.projects.map(project => ({ id: project.id, title: `${project.code} - ${project.title}` }))
    ];
  }

  function diagram2SprintOptions(projectId) {
    const numericProjectId = Number(projectId || 0);
    return [
      { id: "", title: "No Sprint" },
      ...state.sprints
        .filter(sprint => sprint.projectId === numericProjectId)
        .map(sprint => ({ id: sprint.id, title: `${sprint.code} - ${sprint.title}` }))
    ];
  }

  function diagram2ParentOptions(document, projectId, sprintId, isPublic) {
    const excludedIds = diagram2DescendantIds(document.id);
    excludedIds.add(document.id);
    return [
      { id: "", title: "No parent" },
      ...diagram2AllDocuments()
        .filter(candidate =>
          diagram2OwnedByCurrentUser(candidate)
          && !excludedIds.has(candidate.id)
          && Number(candidate.projectId || 0) === Number(projectId || 0)
          && Number(candidate.sprintId || 0) === Number(sprintId || 0)
          && (!isPublic || candidate.isPrivate === false)
        )
        .sort(diagram2DocumentCompare)
        .map(candidate => ({ id: candidate.id, title: candidate.title }))
    ];
  }

  function diagram2OptionsHtml(options, selectedId) {
    return options
      .map(option => `<option value="${escapeAttr(option.id)}" ${String(option.id) === String(selectedId ?? "") ? "selected" : ""}>${escapeHtml(option.title)}</option>`)
      .join("");
  }

  function diagram2DescendantIds(documentId) {
    const descendants = new Set();
    let added = true;
    while (added) {
      added = false;
      diagram2AllDocuments().forEach(document => {
        if (document.parentBlogId && (document.parentBlogId === documentId || descendants.has(document.parentBlogId)) && !descendants.has(document.id)) {
          descendants.add(document.id);
          added = true;
        }
      });
    }
    return descendants;
  }

  function diagram2MoveAfterDrop(movedId, targetId, placement) {
    const documents = diagram2AllDocuments().filter(diagram2OwnedByCurrentUser);
    const document = documents.find(item => item.id === movedId);
    const target = documents.find(item => item.id === targetId);
    if (!document || !diagram2CanEdit(document)) return null;
    if (placement !== "root" && (!target || !diagram2DropAllowed(movedId, targetId, placement))) return null;

    const parentBlogId = placement === "root"
      ? null
      : placement === "inside"
        ? target.id
        : target.parentBlogId || null;
    const siblings = documents
      .filter(item =>
        item.id !== movedId
        && Number(item.parentBlogId || 0) === Number(parentBlogId || 0)
        && (!parentBlogId || (
          Number(item.projectId || 0) === Number(document.projectId || 0)
          && Number(item.sprintId || 0) === Number(document.sprintId || 0)
        ))
      )
      .sort(diagram2DocumentCompare);
    let insertIndex = 0;
    if (placement === "inside") {
      insertIndex = 0;
    } else if (placement !== "root") {
      const targetIndex = siblings.findIndex(item => item.id === targetId);
      insertIndex = Math.max(0, targetIndex + (placement === "after" ? 1 : 0));
    }
    siblings.splice(insertIndex, 0, document);
    return {
      document,
      parentBlogId,
      orderedBlogIds: siblings.map(item => item.id)
    };
  }

  function diagram2DropAllowed(movedId, targetId, placement) {
    if (!movedId || !targetId || movedId === targetId) return false;
    const moved = diagram2AllDocuments().find(document => document.id === movedId);
    const target = diagram2AllDocuments().find(document => document.id === targetId);
    if (!moved || !target || !diagram2CanEdit(target)) return false;
    const targetParentId = placement === "inside" ? target.id : target.parentBlogId || null;
    if (targetParentId
        && (Number(moved.projectId || 0) !== Number(target.projectId || 0)
          || Number(moved.sprintId || 0) !== Number(target.sprintId || 0))) return false;
    return !diagram2DescendantIds(movedId).has(targetId);
  }

  function diagram2DropPlacement(row, clientY) {
    if (!row) return "before";
    const rect = row.getBoundingClientRect();
    const ratio = rect.height ? (clientY - rect.top) / rect.height : 0;
    if (ratio < 0.3) return "before";
    if (ratio > 0.7) return "after";
    return "inside";
  }

  function clearDiagram2DropCues(tree) {
    tree?.querySelectorAll(".is-drop-before, .is-drop-after, .is-drop-inside, .is-drop-target")
      .forEach(element => element.classList.remove("is-drop-before", "is-drop-after", "is-drop-inside", "is-drop-target"));
  }

  function diagram2MatchesFilters(document) {
    if (diagram2ProjectId && Number(document.projectId || 0) !== diagram2ProjectId) return false;
    if (diagram2SprintId !== "all" && Number(document.sprintId || 0) !== Number(diagram2SprintId || 0)) return false;
    if (diagram2Visibility === "private" && document.isPrivate === false) return false;
    if (diagram2Visibility === "public" && document.isPrivate !== false) return false;
    if (diagram2CreatorFilters.length && !diagram2CreatorFilters.includes(String(document.createdByUserId || ""))) return false;
    if (diagram2LastEditorFilters.length && !diagram2LastEditorFilters.includes(String(diagramLastEditorUserId(document)))) return false;
    if (!diagram2Search) return true;

    const project = state.projects.find(item => item.id === Number(document.projectId || 0));
    const sprint = state.sprints.find(item => item.id === Number(document.sprintId || 0));
    return [
      document.title,
      project?.code,
      project?.title,
      project?.name,
      sprint?.code,
      sprint?.title,
      document.isPrivate === false ? "public" : "private",
      diagram2SvgSearchText(document)
    ].filter(Boolean).join(" ").toLowerCase().includes(diagram2Search.toLowerCase());
  }

  function scheduleDiagram2SearchSourceLoad() {
    const token = ++diagram2SearchLoadToken;
    void loadDiagram2SearchSources().then(loaded => {
      if (!loaded || !active || token !== diagram2SearchLoadToken || !diagram2Search) return;
      render();
    });
  }

  async function loadDiagram2SearchSources() {
    const sources = [...new Set(diagram2AllDocuments()
      .map(document => diagramDocumentImage(document)?.source || "")
      .filter(source => source
        && diagramSourceIsSvg(source)
        && !decodeDiagramSvgDataUrl(source)
        && !diagram2SvgSearchTextCache.has(source)))];
    if (!sources.length) return false;

    const loaded = await Promise.all(sources.map(async source => {
      const svg = await loadDiagramSvgSource(source);
      if (svg) diagram2SvgSearchTextCache.set(source, svg.toLowerCase());
      return svg;
    }));
    return loaded.some(Boolean);
  }

  function diagram2SvgSearchText(document) {
    const source = diagramDocumentImage(document)?.source || "";
    if (!source || !diagramSourceIsSvg(source)) return "";
    if (diagram2SvgSearchTextCache.has(source)) return diagram2SvgSearchTextCache.get(source);
    const svg = decodeDiagramSvgDataUrl(source);
    if (!svg) return "";
    const searchText = svg.toLowerCase();
    diagram2SvgSearchTextCache.set(source, searchText);
    return searchText;
  }

  function diagram2DocumentCompare(left, right) {
    if (diagram2Sort === "name") {
      return String(left.title || "").localeCompare(String(right.title || "")) || left.id - right.id;
    }
    if (diagram2Sort === "oldest") {
      return diagramUpdatedTime(left) - diagramUpdatedTime(right)
        || String(left.title || "").localeCompare(String(right.title || ""))
        || left.id - right.id;
    }
    if (diagram2Sort === "custom") return diagram2CustomCompare(left, right);
    return diagram2LatestCompare(left, right);
  }

  function diagram2LatestCompare(left, right) {
    return diagramUpdatedTime(right) - diagramUpdatedTime(left)
      || String(left.title || "").localeCompare(String(right.title || ""))
      || right.id - left.id;
  }

  function diagram2CustomCompare(left, right) {
    const leftOrder = Number(left.sortOrder || 0);
    const rightOrder = Number(right.sortOrder || 0);
    if (leftOrder && rightOrder && leftOrder !== rightOrder) return leftOrder - rightOrder;
    if (leftOrder !== rightOrder) return rightOrder ? -1 : 1;
    return diagram2LatestCompare(left, right);
  }

  return {
    render,
    deactivate,
    handleAction,
    handleFilterChange,
    view,
    isActive: () => active
  };
}

function currentRouteDocumentId() {
  const match = String(globalThis.window?.location?.hash || "").match(/^#\/(?:diagram-2|diagram2)\/(\d+)(?:$|[/?#])/i);
  return positiveRouteId(match?.[1]);
}

function currentRouteIsDiagram2DocumentRoute() {
  return /^#\/(?:diagram-2|diagram2)\/\d+(?:$|[/?#])/i.test(String(globalThis.window?.location?.hash || ""));
}

function positiveRouteId(value) {
  const id = Number(value || 0);
  return Number.isInteger(id) && id > 0 ? id : 0;
}

function normalizeDiagram2Zoom(value) {
  if (String(value || "fit") === "fit") return "fit";
  const zoom = clampDiagram2Zoom(value);
  return diagram2ZoomOptionValue(zoom);
}

function nextDiagram2Zoom(currentZoom, direction) {
  const current = currentZoom === "fit" ? 1 : Number(currentZoom || 1);
  return diagram2ZoomOptionValue(clampDiagram2Zoom(current + (direction > 0 ? diagram2ZoomStep : -diagram2ZoomStep)));
}

function diagram2ZoomOptionsHtml(selectedZoom) {
  const selectedValue = selectedZoom === "fit" ? "" : diagram2ZoomOptionValue(selectedZoom);
  return Array.from({ length: 59 }, (_, index) => 10 + (index * 5))
    .map(percent => {
      const value = diagram2ZoomOptionValue(percent / 100);
      return `<option value="${escapeAttr(value)}" ${value === selectedValue ? "selected" : ""}>${percent}%</option>`;
    })
    .join("");
}

function clampDiagram2Zoom(value) {
  const rounded = Math.round((Number(value) || 1) / diagram2ZoomStep) * diagram2ZoomStep;
  return Math.min(diagram2MaximumZoom, Math.max(diagram2MinimumZoom, rounded));
}

function diagram2ZoomOptionValue(value) {
  return String(Number(clampDiagram2Zoom(value).toFixed(2)));
}

function selectOptionsHtml(options, selectedValue) {
  return options.map(option => `
    <option value="${escapeAttr(option.value)}" ${String(option.value) === String(selectedValue) ? "selected" : ""}>${escapeHtml(option.text)}</option>
  `).join("");
}

function checkedDiagram2FilterValues(filterName) {
  try {
    return checkedFilterValues(filterName).map(String);
  } catch {
    return [];
  }
}

function normalizeSavedArray(value) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function clampTreePaneWidth(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 320;
  return Math.max(diagram2TreePaneMinimumWidth, Math.min(diagram2TreePaneMaximumWidth, Math.round(number)));
}

function projectLabel(project) {
  return [project?.code, project?.title || project?.name]
    .map(value => String(value || "").trim())
    .filter(Boolean)
    .join(" - ") || "Project";
}

function diagramProjectLabel(projectId) {
  const project = state.projects.find(item => item.id === Number(projectId || 0));
  return project ? projectLabel(project) : "Global";
}

function diagramSprintLabel(sprintId) {
  const sprint = state.sprints.find(item => item.id === Number(sprintId || 0));
  return sprint ? `${sprint.code} - ${sprint.title}` : "No Sprint";
}

function diagramUserName(userId) {
  const user = state.users.find(item => Number(item.id || 0) === Number(userId || 0));
  if (!user) return "User";

  const fullName = [user.firstName, user.lastName]
    .map(part => (part || "").trim())
    .filter(Boolean)
    .join(" ");
  const nickname = (user.nickname || "").trim();
  if (fullName && nickname && fullName.toLowerCase() !== nickname.toLowerCase()) return `${fullName} (${nickname})`;

  return fullName || nickname || "User";
}

function diagram2LockIconHtml() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="5" y="10" width="14" height="10" rx="2"></rect>
      <path d="M8 10V7a4 4 0 0 1 8 0v3"></path>
      <path d="M12 14v3"></path>
    </svg>
  `;
}

function uniqueStrings(values) {
  const result = [];
  const seen = new Set();
  (Array.isArray(values) ? values : [values])
    .map(value => String(value || "").trim())
    .filter(Boolean)
    .forEach(value => {
      if (seen.has(value)) return;
      seen.add(value);
      result.push(value);
    });
  return result;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function diagram2RectangleDimensionValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return Number.NaN;
  return Math.min(10000, Math.max(8, number));
}

function safeFileName(value) {
  return String(value || "diagram")
    .replace(/[^a-z0-9_.-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "diagram";
}

function diagram2SaveConflict(error) {
  return Number(error?.status || 0) === 409
    || /newer version of this item exists/i.test(String(error?.message || ""));
}

function downloadTextFile(contents, fileName, type) {
  const blob = new Blob([String(contents || "")], { type });
  downloadBlobFile(blob, fileName);
}

function downloadBlobFile(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function chooseDiagram2SvgDownloadOptions() {
  return openDiagram2DownloadOptionsDialog("svg", { action: "download" });
}

function chooseDiagram2PngDownloadOptions() {
  return openDiagram2DownloadOptionsDialog("png", { action: "download" });
}

function openDiagram2DownloadOptionsDialog(format, options = {}) {
  const safeFormat = format === "svg" ? "svg" : "png";
  const isCopy = options.action === "copy";
  const actionLabel = isCopy ? "Copy" : "Download";
  const title = `${actionLabel} as ${safeFormat.toUpperCase()}`;
  const backgroundName = `diagram2${safeFormat.toUpperCase()}Background`;
  const marginName = `diagram2${safeFormat.toUpperCase()}Margin`;
  const marginOptions = Array.from({ length: 200 }, (_, index) => index + 1)
    .map(value => `<option value="${value}"${value === 20 ? " selected" : ""}>${value}px</option>`)
    .join("");
  const backgroundLabels = safeFormat === "svg"
    ? { transparent: "No white background", white: "White background" }
    : { transparent: "Transparent background", white: "White background" };
  return new Promise(resolve => {
    const modal = document.createElement("dialog");
    modal.className = `dialog mini-dialog diagram-download-dialog diagram2-${safeFormat}-download-dialog`;
    modal.innerHTML = `
      <form>
        <div class="dialog-head">
          <h2>${title}</h2>
          <div class="dialog-head-actions">
            <button type="button" class="icon-btn" data-diagram2-download-cancel title="Close" aria-label="Close">x</button>
          </div>
        </div>
        <div class="dialog-body">
          <fieldset class="field">
            <legend>Background</legend>
            <label>
              <input type="radio" name="${backgroundName}" value="transparent" checked>
              <span>${backgroundLabels.transparent}</span>
            </label>
            <label>
              <input type="radio" name="${backgroundName}" value="white">
              <span>${backgroundLabels.white}</span>
            </label>
          </fieldset>
          <label class="field">
            <span>Margins</span>
            <select name="${marginName}">${marginOptions}</select>
          </label>
        </div>
        <div class="dialog-actions">
          <button type="button" class="secondary text-icon-button" data-diagram2-download-cancel>${buttonContent("&#10005;", "Cancel")}</button>
          <button type="submit" class="primary text-icon-button">${buttonContent(isCopy ? "&#128203;" : "&#8681;", actionLabel)}</button>
        </div>
      </form>
    `;
    const form = modal.querySelector("form");
    const finish = value => {
      if (modal.open) modal.close();
      modal.remove();
      resolve(value || null);
    };
    modal.querySelectorAll("[data-diagram2-download-cancel]").forEach(button => {
      button.addEventListener("click", () => finish(null));
    });
    form?.addEventListener("submit", event => {
      event.preventDefault();
      finish({
        background: form.querySelector(`input[name='${backgroundName}']:checked`)?.value || "transparent",
        margin: diagram2DownloadMargin(form.querySelector(`select[name='${marginName}']`)?.value)
      });
    });
    modal.addEventListener("cancel", event => {
      event.preventDefault();
      finish(null);
    });
    document.body.appendChild(modal);
    modal.showModal();
    modal.querySelector(`input[name='${backgroundName}']:checked`)?.focus({ preventScroll: true });
  });
}

function prepareDiagram2SvgForDownload(svgInput, options = {}) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(String(svgInput || ""), "image/svg+xml");
  const svg = parsed.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== "svg" || parsed.querySelector("parsererror")) {
    return String(svgInput || "");
  }

  const margin = diagram2DownloadMargin(options.margin);
  const currentBounds = diagram2SvgViewBoxBounds(svg);
  const outputBounds = {
    x: currentBounds.x - margin,
    y: currentBounds.y - margin,
    width: currentBounds.width + (margin * 2),
    height: currentBounds.height + (margin * 2)
  };
  svg.setAttribute("viewBox", `${outputBounds.x} ${outputBounds.y} ${outputBounds.width} ${outputBounds.height}`);
  svg.setAttribute("width", String(outputBounds.width));
  svg.setAttribute("height", String(outputBounds.height));
  svg.querySelectorAll(".image-annotation-canvas-background").forEach(element => element.remove());
  if (options.background === "white") {
    const rect = parsed.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("class", "image-annotation-canvas-background");
    rect.setAttribute("x", String(outputBounds.x));
    rect.setAttribute("y", String(outputBounds.y));
    rect.setAttribute("width", String(outputBounds.width));
    rect.setAttribute("height", String(outputBounds.height));
    rect.setAttribute("fill", "#ffffff");
    rect.setAttribute("pointer-events", "none");
    svg.insertBefore(rect, svg.firstChild);
  }

  if (!svg.getAttribute("xmlns")) svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return cleanAnnotationSvgForExternalUse(new XMLSerializer().serializeToString(svg));
}

function diagram2DownloadMargin(value) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return 20;
  return Math.max(1, Math.min(200, number));
}

function diagram2SvgViewBoxBounds(svg) {
  const viewBox = String(svg.getAttribute("viewBox") || "")
    .trim()
    .split(/[,\s]+/)
    .map(Number);
  if (viewBox.length === 4 && viewBox.every(Number.isFinite)) {
    return { x: viewBox[0], y: viewBox[1], width: Math.max(1, viewBox[2]), height: Math.max(1, viewBox[3]) };
  }
  return {
    x: 0,
    y: 0,
    width: Math.max(1, Number.parseFloat(svg.getAttribute("width") || "") || 1),
    height: Math.max(1, Number.parseFloat(svg.getAttribute("height") || "") || 1)
  };
}

function diagram2SvgMetrics(svgInput) {
  const parser = new DOMParser();
  const document = parser.parseFromString(String(svgInput || ""), "image/svg+xml");
  const svg = document.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== "svg" || document.querySelector("parsererror")) {
    return { width: 1, height: 1 };
  }

  const viewBox = String(svg.getAttribute("viewBox") || "")
    .trim()
    .split(/[,\s]+/)
    .map(Number);
  if (viewBox.length === 4 && viewBox.every(Number.isFinite)) {
    return {
      width: Math.max(1, viewBox[2]),
      height: Math.max(1, viewBox[3])
    };
  }

  return {
    width: Math.max(1, Number.parseFloat(svg.getAttribute("width") || "") || 1),
    height: Math.max(1, Number.parseFloat(svg.getAttribute("height") || "") || 1)
  };
}
