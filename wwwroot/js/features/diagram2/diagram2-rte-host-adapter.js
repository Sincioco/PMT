import { copyTextToClipboard } from "../../components/clipboard.js?v=20260714-invite-email-body";
import {
  buildPortableAnnotationSvg,
  normalizeAnnotationState
} from "../../components/image-annotation.js?v=20260730-diagram2-phase6-crop-closure-v14";
import { appUrl } from "../../shared/app-urls.js";
import { loadDiagramCanonicalState } from "../../shared/diagram-documents.js?v=20260730-diagram2-phase6-crop-closure-v14";
import {
  createDiagram2Renderer,
  normalizeDiagram2CanonicalState
} from "./diagram2-renderer.js?v=20260730-diagram2-phase6-crop-closure-v14";
import {
  createDiagram2EditorController,
  isDiagram2CoreDrawingTool
} from "./diagram2-editor-controller.js?v=20260730-diagram2-phase6-crop-closure-v14";
import { createDiagram2Phase6Host } from "./diagram2-editor-phase6-host.js?v=20260730-diagram2-phase6-crop-closure-v14";
import { bindDiagram2EditorInteractions } from "./diagram2-editor-interactions.js?v=20260730-diagram2-phase6-crop-closure-v14";
import {
  bindDiagram2EditorColorPickers,
  bindDiagram2EditorFormatControls,
  bindDiagram2EditorInspectorResize,
  bindDiagram2EditorLeftPaneResize,
  copyDiagram2SelectionArtwork,
  diagram2ObjectsPaneHtml,
  diagram2EditorShellHtml,
  diagram2TemplatePaneHtml,
  openDiagram2CompactProgress,
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
} from "./diagram2-editor-shell.js?v=20260730-diagram2-phase6-crop-closure-v14";
import {
  captureDiagram2SelectionTemplate,
  createDiagram2TemplateState,
  diagram2TemplateCapacityReached,
  diagram2TemplateDownload,
  parseDiagram2TemplateUpload,
  persistDiagram2TemplateLibrary,
  restoreDiagram2DefaultTemplates
} from "./diagram2-editor-templates.js?v=20260730-diagram2-phase6-crop-closure-v14";

export async function openDiagram2RteAnnotationHost(options = {}) {
  const image = options.image;
  const editor = options.editor || image?.closest?.(".rich-editor") || null;
  if (!image?.isConnected || !editor) return null;
  const security = normalizeDiagram2RteSecurity(options);
  if (security.canUpdate !== true) {
    options.notify?.("You do not have permission to edit this content.");
    return null;
  }

  const originalReference = String(options.originalReference || "").trim();
  const source = String(options.source || image.getAttribute("src") || "").trim();
  const initialState = await loadDiagram2RteInitialState({
    source,
    annotationUrl: options.annotationUrl,
    originalUrl: options.originalUrl,
    originalReference,
    originalFileName: options.originalFileName,
    annotated: options.annotated === true
  });
  const templateState = await createDiagram2TemplateState({
    loadTemplateLibrary: options.loadTemplateLibrary,
    loadDefaultTemplateLibrary: options.loadDefaultTemplateLibrary
  });

  return new Promise(resolve => {
    const dialog = document.createElement("dialog");
    dialog.className = "dialog image-annotation-dialog diagram2-rte-dialog";
    dialog.dataset.diagram2RteHost = "true";

    const hostAdapter = {
      kind: "rte-annotation",
      mode: "rte-annotation",
      canEdit: security.canUpdate === true,
      canExport: security.canExport !== false,
      fixedOriginalImage: true,
      security,
      async save(payload) {
        if (security.canUpdate !== true) {
          throw new Error("You do not have permission to edit this content.");
        }
        if (typeof options.apply !== "function") {
          throw new Error("Diagram 2 annotation save is not available.");
        }
        return options.apply(payload);
      }
    };
    const controller = createDiagram2EditorController({
      host: hostAdapter,
      state: initialState,
      templateLibrary: templateState.library,
      historyLimit: options.historyLimit || 100
    });
    dialog.__diagram2ObjectSearch = "";
    dialog.__diagram2TemplateState = templateState;

    dialog.innerHTML = diagram2EditorShellHtml({
      includeHeader: true,
      includeFooter: true,
      allowMaximize: true,
      applyLabel: "Apply to RTE",
      title: "Image Annotation 2.0",
      subtitle: "Diagram 2 editor",
      hostKind: hostAdapter.kind,
      selectedZoom: "fit",
      state: controller.state(),
      selectedObjectIds: controller.selectedObjectIds(),
      status: controller.statusSnapshot(),
      objectSearch: "",
      templateState
    });
    document.body.appendChild(dialog);

    const surface = dialog.querySelector("[data-diagram2-renderer-surface]");
    let lastDiagnostics = null;
    const renderer = createDiagram2Renderer({
      host: surface,
      onDiagnostics: diagnostics => {
        lastDiagnostics = diagnostics;
      }
    });
    lastDiagnostics = renderer.render(controller.state(), { reason: "initial" });
    syncDiagram2RteVisibleViewportInset(dialog, renderer, { refit: false });
    lastDiagnostics = renderer.setZoom("fit");
    controller.attachRenderer(renderer);
    controller.markSaved();
    exposeDebugGlobals(controller, renderer, hostAdapter);
    updateDiagram2ShellStatus(dialog, diagram2RteShellStatus(controller));

    const abortController = new AbortController();
    const { signal } = abortController;
    controller.onChange(event => {
      refreshDiagram2RteTemplatePane(dialog, controller);
      updateDiagram2ShellStatus(dialog, diagram2RteShellStatus(controller, event.status));
      updateDiagram2ObjectTreeSelection(dialog, event.status.selectedObjectIds);
    });
    bindDiagram2RteHostEvents({
      dialog,
      editor,
      image,
      controller,
      renderer,
      hostAdapter,
      signal,
      notify: options.notify,
      askForText: options.askForText,
      confirm: options.confirm,
      uploadEmbeddedImage: options.uploadEmbeddedImage,
      templateState,
      saveTemplateLibrary: options.saveTemplateLibrary,
      save: () => saveAndFinish()
    });

    let finished = false;
    const finish = result => {
      if (finished) return;
      finished = true;
      abortController.abort();
      renderer.destroy();
      controller.destroy();
      clearDebugGlobals(controller, renderer, hostAdapter);
      dialog.close();
      dialog.remove();
      options.restoreFocus?.();
      resolve(result);
    };

    const saveAndFinish = async () => {
      if (!image.isConnected) throw new Error("The rich-text editor is no longer open.");
      controller.setBusy(true);
      try {
        await renderer.whenIdle();
        const currentState = controller.state();
        const stateForSave = normalizeDiagram2RteSaveState(currentState, {
          width: currentState.width,
          height: currentState.height,
          originalReference
        });
        const payload = {
          state: stateForSave,
          svg: await buildPortableAnnotationSvg(stateForSave, {
            persistOutputBoundsInMetadata: true
          }),
          originalReference,
          fileName: `${safeFileName(options.originalFileName || originalReference || "image")}.svg`
        };
        await hostAdapter.save(payload);
        controller.markSaved();
        finish(payload);
      } finally {
        controller.setBusy(false);
      }
    };

    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      finish(null);
    }, { signal });

    dialog.showModal();
    requestAnimationFrame(() => {
      renderer.fit();
      dialog.querySelector("[data-diagram2-workspace]")?.focus({ preventScroll: true });
    });

    dialog.__diagram2Finish = finish;
  });
}

function normalizeDiagram2RteSecurity(options = {}) {
  const provided = options.security && typeof options.security === "object" ? options.security : {};
  const canUpdate = Object.hasOwn(provided, "canUpdate")
    ? provided.canUpdate === true
    : options.canEdit === true;
  return Object.freeze({
    resource: String(provided.resource || options.resource || "Documentation"),
    canRead: provided.canRead !== false,
    canCreate: provided.canCreate === true,
    canUpdate,
    canDelete: provided.canDelete === true,
    canImport: provided.canImport === true,
    canExport: Object.hasOwn(provided, "canExport") ? provided.canExport === true : true
  });
}

async function loadDiagram2RteInitialState(options = {}) {
  if (options.annotated) {
    const result = await loadDiagramCanonicalState(options.annotationUrl || options.source);
    if (!result.state) throw new Error("The editable Diagram 2 annotation data could not be loaded. The image was left unchanged.");
    return normalizeDiagram2CanonicalState(result.state);
  }

  const original = await loadOriginalImage(options.originalUrl || appUrl(options.source));
  return normalizeAnnotationState(null, {
    width: original.width,
    height: original.height,
    originalReference: options.originalReference,
    seedImageSource: original.source
  });
}

export function normalizeDiagram2RteSaveState(inputState, fallback = {}) {
  const source = inputState && typeof inputState === "object" ? inputState : {};
  const objects = Array.isArray(source.objects)
    ? source.objects.map(object => normalizeDiagram2RteSaveObject(object, source))
    : source.objects;
  return normalizeAnnotationState({
    ...source,
    objects
  }, fallback);
}

function normalizeDiagram2RteSaveObject(object, state) {
  if (!object || object.type !== "embedded-image" || object.isOriginalImage !== true) return object;
  if (object.cropVisible === false || object.cropPermanent === true) return object;
  const fullBounds = diagram2RteObjectBounds(object);
  const clip = diagram2RteBounds(object.imageClip);
  const canvasBounds = diagram2RteCanvasBounds(state);
  if (!fullBounds || !clip || !canvasBounds) return object;
  if (diagram2RteBoundsEqual(clip, fullBounds)) return object;

  const staleMovedClip = diagram2RteBoundsIntersection(fullBounds, canvasBounds);
  if (!staleMovedClip || diagram2RteBoundsEqual(staleMovedClip, fullBounds)) return object;
  if (!diagram2RteBoundsEqual(clip, staleMovedClip)) return object;

  return {
    ...object,
    imageClip: fullBounds
  };
}

function diagram2RteObjectBounds(object) {
  if (!object) return null;
  return {
    x: finiteNumber(object.x, 0),
    y: finiteNumber(object.y, 0),
    width: positiveNumber(object.width, 1),
    height: positiveNumber(object.height, 1)
  };
}

function diagram2RteBounds(input) {
  if (!input || typeof input !== "object") return null;
  return {
    x: finiteNumber(input.x, 0),
    y: finiteNumber(input.y, 0),
    width: positiveNumber(input.width, 1),
    height: positiveNumber(input.height, 1)
  };
}

function diagram2RteCanvasBounds(state) {
  const fallback = {
    x: 0,
    y: 0,
    width: positiveNumber(state?.width, 1),
    height: positiveNumber(state?.height, 1)
  };
  return diagram2RteBounds(state?.canvasBounds) || fallback;
}

function diagram2RteBoundsIntersection(firstInput, secondInput) {
  const first = diagram2RteBounds(firstInput);
  const second = diagram2RteBounds(secondInput);
  if (!first || !second) return null;
  const left = Math.max(first.x, second.x);
  const top = Math.max(first.y, second.y);
  const right = Math.min(first.x + first.width, second.x + second.width);
  const bottom = Math.min(first.y + first.height, second.y + second.height);
  if (right <= left || bottom <= top) return null;
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
}

function diagram2RteBoundsEqual(firstInput, secondInput) {
  const first = diagram2RteBounds(firstInput);
  const second = diagram2RteBounds(secondInput);
  if (!first || !second) return false;
  return Math.abs(first.x - second.x) < 0.001
    && Math.abs(first.y - second.y) < 0.001
    && Math.abs(first.width - second.width) < 0.001
    && Math.abs(first.height - second.height) < 0.001;
}

function bindDiagram2RteHostEvents(options = {}) {
  const { dialog, editor, image, controller, renderer, signal, notify } = options;
  const canvas = dialog.querySelector("[data-diagram2-viewer-canvas]");
  const phase6Host = createDiagram2Phase6Host({
    root: dialog,
    controller,
    renderer,
    uploadEmbeddedImage: options.uploadEmbeddedImage,
    insertionCenter: () => diagram2RteInsertionCenter(dialog, controller, renderer),
    canMutate: () => controller.statusSnapshot().canEdit === true,
    afterMutation: () => finishDiagram2RteObjectCommand(dialog, controller, renderer),
    confirm: options.confirm,
    notify
  });
  globalThis.__pmtDiagram2Phase6Host = phase6Host;
  signal.addEventListener("abort", () => {
    if (globalThis.__pmtDiagram2Phase6Host === phase6Host) globalThis.__pmtDiagram2Phase6Host = null;
  }, { once: true });
  phase6Host.bind(signal);
  bindDiagram2EditorColorPickers(dialog, {
    applyColor: (name, color) => applyDiagram2RteSelectedStyle(dialog, controller, renderer, name, color),
    notify
  });
  bindDiagram2EditorFormatControls(dialog, {
    applyStyle: (name, value) => applyDiagram2RteSelectedStyle(dialog, controller, renderer, name, value),
    applyGeometry: (name, value) => applyDiagram2RteSelectedGeometry(dialog, controller, renderer, name, value),
    applyEntityOption: (name, value) => applyDiagram2RteSelectedEntityOption(dialog, controller, renderer, name, value),
    updateEntityField: (fieldIndex, patch) => applyDiagram2RteSelectedEntityFieldPatch(dialog, controller, renderer, fieldIndex, patch, notify),
    setEntityFieldReference: (fieldIndex, reference) => applyDiagram2RteSelectedEntityFieldReference(dialog, controller, renderer, fieldIndex, reference),
    applyRelationshipOption: (name, value) => applyDiagram2RteRelationshipOption(dialog, controller, renderer, name, value),
    applyRelationshipStyle: (name, value) => applyDiagram2RteSelectedRelationshipStyle(dialog, controller, renderer, name, value),
    applyRelationshipType: value => applyDiagram2RteSelectedRelationshipType(dialog, controller, renderer, value),
    setCropVisibility: value => phase6Host.setCropVisibility(value),
    renameFieldRectangle: value => phase6Host.renameFieldRectangle(value),
    setFieldRectangleConnectionSide: value => phase6Host.setFieldRectangleConnectionSide(value),
    notify
  });
  bindDiagram2EditorInspectorResize(dialog, {
    onResize: () => {
      if (String(dialog.querySelector("[data-filter='diagram2-zoom']")?.value || "fit") === "fit") {
        syncDiagram2RteVisibleViewportInset(dialog, renderer, { refit: false });
        renderer.fit();
      }
    }
  });
  bindDiagram2EditorLeftPaneResize(dialog, {
    onResize: () => syncDiagram2RteVisibleViewportInset(dialog, renderer, { refit: false })
  });

  dialog.addEventListener("pointerdown", event => {
    if (!event.target.closest("[data-action='cancel-diagram2-editor']")) return;
    void phase6Host.cancelCropAdjustment("editor canceled");
  }, { signal });

  dialog.addEventListener("click", async event => {
    const actionElement = event.target.closest("[data-action]");
    if (!actionElement) return;
    const action = actionElement.dataset.action || "";
    if (action === "cancel-diagram2-editor") {
      dialog.__diagram2Finish?.(null);
      return;
    }
    if (action === "save-diagram2-document") {
      void phase6Host.finishCropAdjustment("save")
        .then(() => options.save())
        .catch(error => notify?.(error?.message || "Diagram 2 annotation could not be applied."));
      return;
    }
    if (await phase6Host.handleAction(action)) return;
    if (action === "set-diagram2-tool") {
      const tool = actionElement.dataset.tool || actionElement.dataset.diagram2Tool || "select";
      if (tool === "crop") {
        void phase6Host.activateCropTool();
      } else if (tool === "entity") {
        await phase6Host.setTool("select", { reason: "tool changed" });
        void addDiagram2RteEntityFromDialog(dialog, controller, renderer);
      } else if (isDiagram2CoreDrawingTool(tool)) {
        await phase6Host.setTool("select", { reason: "tool changed" });
        void addDiagram2RteToolbarObject(tool, dialog, controller, renderer);
      } else if (tool === "format-painter") {
        const wasActive = controller.activeTool() === "format-painter";
        await phase6Host.setTool("select", { reason: "tool changed" });
        if (wasActive) controller.cancelFormatPainter();
        else controller.beginFormatPainter();
      } else {
        await phase6Host.setTool(tool, { reason: "tool changed" });
      }
      return;
    }
    if (action === "edit-diagram2-entity") {
      void editDiagram2RteSelectedEntity(dialog, controller, renderer);
      return;
    }
    if (action === "add-diagram2-relationship") {
      void addDiagram2RteRelationshipFromDialog(dialog, controller, renderer);
      return;
    }
    if (action === "add-diagram2-entity-field") {
      void addDiagram2RteSelectedEntityField(dialog, controller, renderer);
      return;
    }
    if (action === "move-diagram2-entity-field-up" || action === "move-diagram2-entity-field-down") {
      void moveDiagram2RteSelectedEntityField(
        dialog,
        controller,
        renderer,
        Number.parseInt(actionElement.dataset.diagram2EntityFieldIndex, 10),
        action === "move-diagram2-entity-field-up" ? "up" : "down"
      );
      return;
    }
    if (action === "remove-diagram2-entity-field") {
      void removeDiagram2RteSelectedEntityField(
        dialog,
        controller,
        renderer,
        Number.parseInt(actionElement.dataset.diagram2EntityFieldIndex, 10)
      );
      return;
    }
    if (action === "auto-format-diagram2-compact") {
      void autoFormatDiagram2RteCompact(dialog, controller, renderer, notify);
      return;
    }
    if (action === "use-diagram2-relationship-route") {
      void useDiagram2RteSelectedRelationshipRoute(dialog, controller, renderer);
      return;
    }
    if (action === "add-diagram2-relationship-route-point") {
      void addDiagram2RteSelectedRelationshipRoutePoint(dialog, controller, renderer);
      return;
    }
    if (action === "remove-diagram2-relationship-route-point") {
      void removeDiagram2RteSelectedRelationshipRoutePoint(dialog, controller, renderer);
      return;
    }
    if (action === "clear-diagram2-relationship-route") {
      void clearDiagram2RteSelectedRelationshipRoute(dialog, controller, renderer);
      return;
    }
    if (action === "select-diagram2-object-tree-item") {
      selectDiagram2RteStructureNode(dialog, controller, actionElement);
      return;
    }
    if (action === "group-diagram2-selection") {
      void groupDiagram2RteSelection(dialog, controller, renderer, notify);
      return;
    }
    if (action === "ungroup-diagram2-selection") {
      void ungroupDiagram2RteSelection(dialog, controller, renderer, notify);
      return;
    }
    if (action === "rename-diagram2-object") {
      void renameDiagram2RteStructureNode(dialog, controller, renderer, actionElement, options.askForText, notify);
      return;
    }
    if (action === "delete-diagram2-object-tree-item") {
      void deleteDiagram2RteStructureNode(dialog, controller, renderer, actionElement, notify);
      return;
    }
    if (action === "lock-diagram2-object-tree-item") {
      void toggleDiagram2RteStructureLock(dialog, controller, renderer, actionElement, notify);
      return;
    }
    if (action === "toggle-diagram2-object-visibility") {
      void toggleDiagram2RteStructureVisibility(dialog, controller, renderer, actionElement);
      return;
    }
    if (action === "toggle-diagram2-selection-visibility") {
      void toggleDiagram2RteSelectionVisibility(dialog, controller, renderer);
      return;
    }
    if (action === "reorder-diagram2-object-root") {
      void reorderDiagram2RteStructureNode(dialog, controller, renderer, {
        targetKind: "root",
        targetId: "",
        targetPlacement: "inside"
      });
      return;
    }
    if (action === "save-diagram2-selection-template") {
      void saveDiagram2RteSelectionTemplate(dialog, controller, renderer, options.askForText, options.saveTemplateLibrary, notify);
      return;
    }
    if (action === "upload-diagram2-template") {
      dialog.querySelector("[data-diagram2-template-upload-input]")?.click();
      return;
    }
    if (action === "restore-diagram2-default-templates") {
      void restoreDiagram2RteTemplates(dialog, controller, options.saveTemplateLibrary, notify);
      return;
    }
    if (action === "apply-diagram2-template") {
      void applyDiagram2RteTemplateById(dialog, controller, renderer, actionElement.dataset.templateId, notify);
      return;
    }
    if (action === "format-diagram2-template") {
      void formatDiagram2RteSelectionFromTemplate(dialog, controller, renderer, actionElement.dataset.templateId, notify);
      return;
    }
    if (action === "rename-diagram2-template") {
      void renameDiagram2RteTemplate(dialog, controller, actionElement.dataset.templateId, options.askForText, options.saveTemplateLibrary, notify);
      return;
    }
    if (action === "update-diagram2-template") {
      void updateDiagram2RteTemplateFromSelection(dialog, controller, actionElement.dataset.templateId, options.saveTemplateLibrary, notify);
      return;
    }
    if (action === "move-diagram2-template-up" || action === "move-diagram2-template-down") {
      void moveDiagram2RteTemplate(dialog, controller, actionElement.dataset.templateId, action.endsWith("-up") ? -1 : 1, options.saveTemplateLibrary, notify);
      return;
    }
    if (action === "download-diagram2-template") {
      downloadDiagram2RteTemplateById(dialog, actionElement.dataset.templateId);
      return;
    }
    if (action === "delete-diagram2-template") {
      void deleteDiagram2RteTemplate(dialog, controller, actionElement.dataset.templateId, options.confirm, options.saveTemplateLibrary, notify);
      return;
    }
    if (action === "set-diagram2-rectangle-default" || action === "set-diagram2-arrow-default") {
      void setDiagram2RteDrawingDefault(dialog, controller, action.includes("rectangle") ? "rectangle" : "arrow", options.saveTemplateLibrary, notify);
      return;
    }
    if (action === "reset-diagram2-rectangle-default" || action === "reset-diagram2-arrow-default") {
      void resetDiagram2RteDrawingDefault(dialog, controller, action.includes("rectangle") ? "rectangle" : "arrow", options.saveTemplateLibrary, notify);
      return;
    }
    if (action === "set-diagram2-inspector-tab") {
      await phase6Host.flushCropAdjustment("inspector tab changed");
      setDiagram2InspectorActiveTab(
        dialog.querySelector("[data-diagram2-editor-shell]"),
        actionElement.dataset.diagram2InspectorTab
      );
      return;
    }
    if (action === "fit-diagram2-viewer") {
      syncDiagram2RteVisibleViewportInset(dialog, renderer, { refit: false });
      renderer.fit();
      return;
    }
    if (action === "zoom-diagram2-in") {
      renderer.zoomBy(1.1);
      return;
    }
    if (action === "zoom-diagram2-out") {
      renderer.zoomBy(1 / 1.1);
      return;
    }
    if (action === "toggle-diagram2-inspector") {
      dialog.querySelector("[data-diagram2-editor-main]")?.classList.toggle("is-inspector-hidden");
      syncDiagram2RteInspectorToggleState(dialog);
      return;
    }
    if (action === "toggle-diagram2-tools-pane") {
      setDiagram2ToolsPaneOpen(dialog);
      syncDiagram2RteVisibleViewportInset(dialog, renderer, { refit: false });
      return;
    }
    if (action === "toggle-diagram2-objects-pane") {
      setDiagram2ObjectsPaneOpen(dialog);
      syncDiagram2RteVisibleViewportInset(dialog, renderer, { refit: false });
      return;
    }
    if (action === "toggle-diagram2-templates-pane") {
      setDiagram2TemplatesPaneOpen(dialog);
      syncDiagram2RteVisibleViewportInset(dialog, renderer, { refit: false });
      return;
    }
    if (action === "toggle-diagram2-diagnostics") {
      const diagnostics = dialog.querySelector("[data-diagram2-diagnostics-shell]");
      if (diagnostics) diagnostics.open = !diagnostics.open;
      return;
    }
    if (action === "undo-diagram2") {
      void runDiagram2RteHistoryAction(dialog, controller, renderer, () => controller.undo());
      return;
    }
    if (action === "redo-diagram2") {
      void runDiagram2RteHistoryAction(dialog, controller, renderer, () => controller.redo());
      return;
    }
    if (action === "copy-diagram2-selection") {
      void copyDiagram2RteSelection(controller, notify);
      return;
    }
    if (action === "copy-diagram2-selection-svg" || action === "copy-diagram2-selection-image") {
      void copyDiagram2RteSelectionAsArtwork(
        controller,
        renderer,
        notify,
        action.endsWith("-image") ? "image" : "svg"
      );
      return;
    }
    if (action === "paste-diagram2-selection") {
      void pasteDiagram2RteSelection(dialog, controller, renderer, notify);
      return;
    }
    if (action === "duplicate-diagram2-selection") {
      void duplicateDiagram2RteSelection(dialog, controller, renderer);
      return;
    }
    if (action === "delete-diagram2-selection") {
      void deleteDiagram2RteSelection(dialog, controller, renderer);
      return;
    }
    if (action === "lock-diagram2-selection") {
      void toggleDiagram2RteSelectionLock(dialog, controller, renderer, notify);
      return;
    }
    if (action.startsWith("arrange-diagram2-selection-")) {
      void arrangeDiagram2RteSelection(
        dialog,
        controller,
        renderer,
        action.slice("arrange-diagram2-selection-".length)
      );
    }
  }, { signal });

  dialog.addEventListener("change", event => {
    if (event.target?.matches?.("[data-diagram2-template-upload-input]")) {
      const files = [...(event.target.files || [])];
      event.target.value = "";
      if (files.length) {
        void uploadDiagram2RteTemplates(dialog, controller, options.saveTemplateLibrary, files, notify);
      }
      return;
    }
    const filter = event.target?.dataset?.filter;
    if (filter === "diagram2-grid") {
      void controller.setGridVisible(event.target.checked === true).then(() => {
        updateDiagram2ShellStatus(dialog, diagram2RteShellStatus(controller));
      });
      return;
    }
    if (filter === "diagram2-snap") {
      void controller.setSnapToGrid(event.target.checked === true).then(() => {
        updateDiagram2ShellStatus(dialog, diagram2RteShellStatus(controller));
      });
      return;
    }
    if (filter !== "diagram2-zoom") return;
    const value = String(event.target.value || "fit");
    if (value === "fit") {
      syncDiagram2RteVisibleViewportInset(dialog, renderer, { refit: false });
      renderer.fit();
    }
    else renderer.setZoom(value);
  }, { signal });

  dialog.addEventListener("input", event => {
    if (event.target?.dataset?.filter !== "diagram2-object-search") return;
    dialog.__diagram2ObjectSearch = String(event.target.value || "").trim();
    refreshDiagram2RteObjectsPane(dialog, controller, { preserveFocus: true });
  }, { signal });

  let lastObjectTreePointerDown = { key: "", time: 0 };
  dialog.addEventListener("click", event => {
    if (Number(event.detail || 0) < 2) return;
    const row = event.target.closest?.("[data-diagram2-object-tree-row]");
    if (!row || !row.closest?.("[data-diagram2-objects-pane]") || event.target.closest?.("button, input, textarea, select")) return;
    event.preventDefault();
    event.stopPropagation();
    void focusDiagram2RteStructureNode(dialog, controller, renderer, row);
  }, { capture: true, signal });
  dialog.addEventListener("pointerdown", event => {
    const row = event.target.closest?.("[data-diagram2-object-tree-row]");
    if (!row || !row.closest?.("[data-diagram2-objects-pane]") || event.target.closest?.("button, input, textarea, select")) return;
    const key = `${row.dataset.diagram2TreeNodeKind || "object"}:${row.dataset.diagram2ObjectId || ""}`;
    const time = Number(event.timeStamp || Date.now());
    if (key && key === lastObjectTreePointerDown.key && time - lastObjectTreePointerDown.time <= 500) {
      event.preventDefault();
      lastObjectTreePointerDown = { key: "", time: 0 };
      void focusDiagram2RteStructureNode(dialog, controller, renderer, row);
      return;
    }
    lastObjectTreePointerDown = { key, time };
  }, { signal });

  dialog.addEventListener("dblclick", event => {
    const row = event.target.closest?.("[data-diagram2-object-tree-row]");
    if (!row || !row.closest?.("[data-diagram2-objects-pane]") || event.target.closest?.("button, input, textarea, select")) return;
    event.preventDefault();
    void focusDiagram2RteStructureNode(dialog, controller, renderer, row);
  }, { signal });

  bindDiagram2RteObjectTreeDragAndDrop(dialog, controller, renderer, signal);

  bindDiagram2EditorInteractions({
    root: dialog,
    canvas,
    controller,
    renderer,
    signal,
    isActive: () => dialog.open && image.isConnected && editor.isConnected,
    canMutate: () => controller.statusSnapshot().canEdit === true,
    onStateChange: () => updateDiagram2ShellStatus(dialog, diagram2RteShellStatus(controller)),
    onSetTool: (tool, toolOptions) => phase6Host.setTool(tool, toolOptions),
    onSave: () => phase6Host.finishCropAdjustment("save")
      .then(() => options.save())
      .catch(error => notify?.(error?.message || "Diagram 2 annotation could not be applied.")),
    onUndo: () => runDiagram2RteHistoryAction(dialog, controller, renderer, () => controller.undo()),
    onRedo: () => runDiagram2RteHistoryAction(dialog, controller, renderer, () => controller.redo()),
    onAddObject: type => type === "entity"
      ? addDiagram2RteEntityFromDialog(dialog, controller, renderer)
      : addDiagram2RteToolbarObject(type, dialog, controller, renderer),
    onEditText: object => editDiagram2RteObjectText(dialog, controller, renderer, object, options.bindRichTextButtons),
    onEditEntity: () => editDiagram2RteSelectedEntity(dialog, controller, renderer),
    onCopy: () => copyDiagram2RteSelection(controller, notify),
    onPaste: () => pasteDiagram2RteSelection(dialog, controller, renderer, notify),
    onPasteEvent: async event => {
      if (await phase6Host.pasteImageEvent(event)) return true;
      const text = String(event.clipboardData?.getData?.("text/plain") || "");
      if (!text) return false;
      event.preventDefault();
      const pasted = await controller.pasteSelectionClipboardText(text);
      if (pasted) await finishDiagram2RteObjectCommand(dialog, controller, renderer);
      return pasted;
    },
    onDuplicate: () => duplicateDiagram2RteSelection(dialog, controller, renderer),
    onDelete: () => deleteDiagram2RteSelection(dialog, controller, renderer),
    onGroup: () => groupDiagram2RteSelection(dialog, controller, renderer, notify),
    onUngroup: () => ungroupDiagram2RteSelection(dialog, controller, renderer, notify)
  });
}

function syncDiagram2RteVisibleViewportInset(dialog, renderer, options = {}) {
  return syncDiagram2RendererViewportInset(dialog, renderer, options);
}

function syncDiagram2RteInspectorToggleState(dialog) {
  const main = dialog.querySelector("[data-diagram2-editor-main]");
  const expanded = !main?.classList.contains("is-inspector-hidden");
  dialog.querySelectorAll("[data-action='toggle-diagram2-inspector']").forEach(control => {
    control.setAttribute("aria-expanded", String(expanded));
  });
}

function diagram2RteShellStatus(controller, statusInput = null) {
  const status = statusInput || controller.statusSnapshot();
  const selected = new Set((status.selectedObjectIds || []).map(String));
  const state = controller.currentState?.() || {};
  const selectedObjects = (state.objects || [])
    .filter(object => selected.has(String(object.id || "")));
  selectedObjects.push(...(controller.selectedRelationshipObjects?.() || []));
  return {
    ...status,
    state,
    selectedObjects
  };
}

async function applyDiagram2RteSelectedStyle(dialog, controller, renderer, name, value) {
  const applied = await controller.updateSelectedObjectsStyle(name, value, {
    reason: `format ${name}`
  });
  if (!applied) return false;
  updateDiagram2ShellStatus(dialog, diagram2RteShellStatus(controller));
  await renderer.whenIdle();
  return true;
}

async function applyDiagram2RteSelectedGeometry(dialog, controller, renderer, name, value) {
  const property = String(name || "").trim();
  if (!["width", "height"].includes(property)) return false;
  const dimension = diagram2RteRectangleDimensionValue(value);
  if (!Number.isFinite(dimension)) return false;
  const selection = controller.getObjectsByIds(controller.selectedObjectIds());
  if (selection.length !== 1 || selection[0]?.type !== "rectangle" || selection[0]?.locked === true) return false;
  const applied = await controller.resizeObjects([{ ...selection[0], [property]: dimension }], {
    label: "Resize rectangle",
    reason: `rectangle ${property}`
  });
  if (!applied) return false;
  updateDiagram2ShellStatus(dialog, diagram2RteShellStatus(controller));
  await renderer.whenIdle();
  return true;
}

async function applyDiagram2RteSelectedEntityOption(dialog, controller, renderer, name, value) {
  const entity = controller.getObjectsByIds(controller.selectedObjectIds())
    .find(object => object?.type === "entity");
  if (!entity) return false;
  const applied = await controller.setEntityOption(entity.id, name, value, {
    reason: `entity ${name}`
  });
  if (!applied) return false;
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  return true;
}

async function applyDiagram2RteRelationshipOption(dialog, controller, renderer, name, value) {
  const applied = await controller.setRelationshipRoutingOptions({ [name]: value }, {
    reason: `relationship option ${name}`
  });
  if (!applied) return false;
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  return true;
}

async function applyDiagram2RteSelectedRelationshipStyle(dialog, controller, renderer, name, value) {
  const applied = await controller.updateRelationshipsStyle(controller.selectedRelationshipIds(), name, value, {
    global: name === "showSymbols",
    reason: `relationship style ${name}`
  });
  if (!applied) return false;
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  return true;
}

async function applyDiagram2RteSelectedRelationshipType(dialog, controller, renderer, value) {
  const [relationshipId] = controller.selectedRelationshipIds();
  if (!relationshipId) return false;
  const applied = await controller.setRelationshipType(relationshipId, value);
  if (!applied) return false;
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  return true;
}

async function editDiagram2RteSelectedEntity(dialog, controller, renderer) {
  const entity = controller.getObjectsByIds(controller.selectedObjectIds())
    .find(object => object?.type === "entity");
  if (!entity) return false;
  const definition = await openDiagram2EntityEditor({ object: entity });
  if (!definition) return false;
  const updated = await controller.updateEntityDefinition(entity.id, definition);
  if (!updated) return false;
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  return true;
}

async function addDiagram2RteEntityFromDialog(dialog, controller, renderer) {
  const definition = await openDiagram2EntityEditor({});
  if (!definition) return false;
  const added = await controller.addEntity(
    definition,
    controller.snapPoint(diagram2RteInsertionCenter(dialog, controller, renderer))
  );
  if (!added) return false;
  controller.setActiveTool("select");
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  return true;
}

async function addDiagram2RteRelationshipFromDialog(dialog, controller, renderer) {
  const selectedEntityId = controller.getObjectsByIds(controller.selectedObjectIds())
    .find(object => object?.type === "entity")?.id || "";
  const relationship = await openDiagram2RelationshipEditor({
    state: controller.currentState(),
    selectedEntityId
  });
  if (!relationship) return false;
  const added = await controller.addRelationship(relationship);
  if (!added) return false;
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  return true;
}

async function addDiagram2RteSelectedEntityField(dialog, controller, renderer) {
  const entity = diagram2RteSelectedEntity(controller);
  if (!entity) return false;
  const added = await controller.addEntityField(entity.id, {
    name: "NewField",
    dataType: "nvarchar(120)",
    nullable: true
  });
  if (!added) return false;
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  return true;
}

async function applyDiagram2RteSelectedEntityFieldPatch(dialog, controller, renderer, fieldIndex, patch, notify) {
  const entity = diagram2RteSelectedEntity(controller);
  if (!entity || !Number.isInteger(fieldIndex)) return false;
  const applied = await controller.updateEntityField(entity.id, fieldIndex, patch);
  if (!applied) return false;
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  const nextName = controller.getObjectById(entity.id)?.fields?.[fieldIndex]?.name || "";
  if (patch && Object.hasOwn(patch, "name") && String(patch.name || "").trim() !== nextName) {
    notify?.(`Duplicate field name resolved as ${nextName}.`);
  }
  return true;
}

async function applyDiagram2RteSelectedEntityFieldReference(dialog, controller, renderer, fieldIndex, reference) {
  const entity = diagram2RteSelectedEntity(controller);
  if (!entity || !Number.isInteger(fieldIndex)) return false;
  const applied = await controller.setEntityFieldReference(entity.id, fieldIndex, reference);
  if (!applied) return false;
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  return true;
}

async function moveDiagram2RteSelectedEntityField(dialog, controller, renderer, fieldIndex, direction) {
  const entity = diagram2RteSelectedEntity(controller);
  if (!entity || !Number.isInteger(fieldIndex)) return false;
  const moved = await controller.moveEntityField(entity.id, fieldIndex, direction);
  if (!moved) return false;
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  return true;
}

async function removeDiagram2RteSelectedEntityField(dialog, controller, renderer, fieldIndex) {
  const entity = diagram2RteSelectedEntity(controller);
  if (!entity || !Number.isInteger(fieldIndex)) return false;
  const removed = await controller.removeEntityField(entity.id, fieldIndex);
  if (!removed) return false;
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  return true;
}

function diagram2RteSelectedEntity(controller) {
  return controller?.getObjectsByIds(controller.selectedObjectIds())
    .find(object => object?.type === "entity" && object.locked !== true) || null;
}

async function autoFormatDiagram2RteCompact(dialog, controller, renderer, notify) {
  const availability = controller.compactAvailability();
  if (!availability.allowed) {
    notify?.(availability.message);
    updateDiagram2ShellStatus(dialog, diagram2RteShellStatus(controller));
    return false;
  }
  const progress = openDiagram2CompactProgress(dialog);
  try {
    const applied = await controller.autoFormatCompact({
      signal: progress?.signal,
      onProgress: update => progress?.update(update)
    });
    if (!applied) {
      const diagnostics = controller.diagnostics().lastCompact;
      notify?.(progress?.signal?.aborted
        ? "Diagram 2 Compact canceled."
        : diagnostics?.message || "Diagram 2 Compact made no changes.");
      updateDiagram2ShellStatus(dialog, diagram2RteShellStatus(controller));
      return false;
    }
    await finishDiagram2RteObjectCommand(dialog, controller, renderer);
    notify?.("Diagram 2 entities compacted.");
    return true;
  } finally {
    progress?.close();
  }
}

async function useDiagram2RteSelectedRelationshipRoute(dialog, controller, renderer) {
  const [relationshipId] = controller.selectedRelationshipIds();
  if (!relationshipId) return false;
  const applied = await controller.useRelationshipRoute(relationshipId);
  if (!applied) return false;
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  return true;
}

async function addDiagram2RteSelectedRelationshipRoutePoint(dialog, controller, renderer) {
  const [relationshipId] = controller.selectedRelationshipIds();
  if (!relationshipId) return false;
  const applied = await controller.insertRelationshipRoutePoint(relationshipId);
  if (!applied) return false;
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  return true;
}

async function removeDiagram2RteSelectedRelationshipRoutePoint(dialog, controller, renderer) {
  const [relationshipId] = controller.selectedRelationshipIds();
  if (!relationshipId) return false;
  const applied = await controller.removeRelationshipRoutePoint(relationshipId);
  if (!applied) return false;
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  return true;
}

async function clearDiagram2RteSelectedRelationshipRoute(dialog, controller, renderer) {
  const relationshipIds = controller.selectedRelationshipIds();
  if (!relationshipIds.length) return false;
  const applied = await controller.clearRelationshipRoutes(relationshipIds);
  if (!applied) return false;
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  return true;
}

async function addDiagram2RteToolbarObject(type, dialog, controller, renderer) {
  const object = controller.createDefaultObject(
    type,
    controller.snapPoint(diagram2RteInsertionCenter(dialog, controller, renderer))
  );
  if (!object) return false;
  const added = await controller.addObject(object, {
    label: `Add ${diagram2ToolLabel(type)}`,
    reason: `toolbar add ${type}`
  });
  if (!added) return false;

  controller.setActiveTool("select");
  refreshDiagram2RteObjectsPane(dialog, controller);
  refreshDiagram2RteTemplatePane(dialog, controller);
  await renderer.whenIdle();
  return true;
}

async function runDiagram2RteHistoryAction(dialog, controller, renderer, action) {
  const result = await action();
  refreshDiagram2RteObjectsPane(dialog, controller);
  refreshDiagram2RteTemplatePane(dialog, controller);
  await renderer.whenIdle();
  return result;
}

function diagram2RteInsertionCenter(dialog, controller, renderer) {
  const canvas = dialog.querySelector("[data-diagram2-viewer-canvas]");
  const rect = canvas?.getBoundingClientRect?.();
  if (renderer && rect?.width && rect?.height) {
    return renderer.screenToWorld({
      clientX: rect.left + (rect.width / 2),
      clientY: rect.top + (rect.height / 2)
    });
  }
  const current = controller.currentState?.() || {};
  return {
    x: finiteNumber(current.width, 1600) / 2,
    y: finiteNumber(current.height, 900) / 2
  };
}

function refreshDiagram2RteObjectsPane(dialog, controller, options = {}) {
  const pane = dialog.querySelector("[data-diagram2-objects-pane]");
  if (!pane) return;
  pane.outerHTML = diagram2ObjectsPaneHtml(controller.state(), controller.selectedObjectIds(), {
    search: dialog.__diagram2ObjectSearch || ""
  });
  if (options.preserveFocus === true) {
    const search = dialog.querySelector("[data-filter='diagram2-object-search']");
    search?.focus({ preventScroll: true });
    if (search) search.selectionStart = search.selectionEnd = search.value.length;
  }
}

function refreshDiagram2RteTemplatePane(dialog, controller) {
  const pane = dialog.querySelector("[data-diagram2-template-pane]");
  if (!pane) return;
  const previousScrollTop = pane.querySelector(".diagram2-editor-left-pane-scroll")?.scrollTop || 0;
  pane.outerHTML = diagram2TemplatePaneHtml(
    dialog.__diagram2TemplateState,
    controller.state(),
    controller.selectedObjectIds()
  );
  const nextScroll = dialog.querySelector("[data-diagram2-template-pane] .diagram2-editor-left-pane-scroll");
  if (nextScroll) nextScroll.scrollTop = previousScrollTop;
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

async function editDiagram2RteObjectText(dialog, controller, renderer, object, bindRichTextButtons) {
  const value = await openDiagram2TextEditor({
    object,
    bindRichTextButtons
  });
  if (value == null) return false;
  const updated = await controller.updateObjectText(object.id, value);
  if (!updated) return false;
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  return true;
}

async function pasteDiagram2RteSelection(dialog, controller, renderer, notify) {
  const text = await readDiagram2SelectionClipboard();
  if (!text) {
    notify?.("Copy Diagram objects before pasting.");
    return false;
  }
  const pasted = await controller.pasteSelectionClipboardText(text);
  if (!pasted) {
    notify?.("The clipboard does not contain compatible Diagram objects.");
    return false;
  }
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  return true;
}

async function duplicateDiagram2RteSelection(dialog, controller, renderer) {
  const duplicated = await controller.duplicateSelectedObjects();
  if (!duplicated) return false;
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  return true;
}

async function deleteDiagram2RteSelection(dialog, controller, renderer) {
  const deleted = await controller.deleteSelectedObjects();
  if (!deleted) return false;
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  return true;
}

async function finishDiagram2RteObjectCommand(dialog, controller, renderer) {
  refreshDiagram2RteObjectsPane(dialog, controller);
  refreshDiagram2RteTemplatePane(dialog, controller);
  updateDiagram2ShellStatus(dialog, diagram2RteShellStatus(controller));
  await renderer.whenIdle();
  updateDiagram2ShellStatus(dialog, diagram2RteShellStatus(controller));
}

async function copyDiagram2RteSelection(controller, notify) {
  const selectedObjectIds = controller.selectedObjectIds();
  if (!selectedObjectIds.length) {
    notify?.("Select one or more Diagram objects before copying.");
    return false;
  }
  const text = controller.selectionClipboardText();
  globalThis.__pmtDiagram2SelectionClipboard = text;
  globalThis.__pmtDiagramSelectionClipboard = text;
  const copied = await copyTextToClipboard(text);
  notify?.(copied ? "Diagram selection copied." : "Diagram selection is ready, but the browser blocked clipboard copy.");
  return copied;
}

async function copyDiagram2RteSelectionAsArtwork(controller, renderer, notify, format) {
  const selectedObjectIds = controller.selectedObjectIds();
  if (!selectedObjectIds.length) {
    notify?.("Select one or more Diagram objects before copying.");
    return false;
  }
  await renderer.whenIdle();
  try {
    const copied = await copyDiagram2SelectionArtwork(controller.currentState(), selectedObjectIds, format);
    notify?.(copied
      ? `Diagram selection copied as ${format === "image" ? "an image" : "SVG"}.`
      : "Select one or more Diagram objects before copying.");
    return copied;
  } catch (error) {
    notify?.(error?.message || `The Diagram selection could not be copied as ${format === "image" ? "an image" : "SVG"}.`);
    return false;
  }
}

async function toggleDiagram2RteSelectionLock(dialog, controller, renderer, notify) {
  const selection = controller.getObjectsByIds(controller.selectedObjectIds());
  if (!selection.length) return false;
  const lock = !selection.every(object => object.locked === true);
  const changed = await controller.setSelectedObjectsLocked(lock);
  if (!changed) return false;
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  notify?.(`${selection.length === 1 ? "Object" : "Objects"} ${lock ? "locked" : "unlocked"}.`);
  return true;
}

async function arrangeDiagram2RteSelection(dialog, controller, renderer, action) {
  const arranged = await controller.arrangeSelectedObjects(action);
  if (!arranged) return false;
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  return true;
}

function selectDiagram2RteStructureNode(dialog, controller, element) {
  const selected = controller.selectStructureNode(
    element?.dataset?.nodeKind || element?.dataset?.diagram2TreeNodeKind || "object",
    element?.dataset?.objectId || element?.dataset?.diagram2ObjectId || ""
  );
  refreshDiagram2RteObjectsPane(dialog, controller);
  updateDiagram2ShellStatus(dialog, diagram2RteShellStatus(controller));
  updateDiagram2ObjectTreeSelection(dialog, selected);
  return selected.length > 0;
}

async function focusDiagram2RteStructureNode(dialog, controller, renderer, row) {
  const target = diagram2RteStructureTarget(controller, row);
  if (!target.id) return false;
  if (!selectDiagram2RteStructureNode(dialog, controller, row)) return false;
  const focusIds = target.kind === "group"
    ? controller.selectedObjectIds()
    : [target.id];
  renderer?.focusObjectIds?.(focusIds, {
    reason: "object tree focus"
  });
  dialog.querySelector("[data-diagram2-renderer-surface]")?.classList.remove("is-fit");
  dialog.querySelector("[data-diagram2-viewer-canvas]")?.focus?.({ preventScroll: true });
  await renderer?.whenIdle?.();
  return true;
}

async function groupDiagram2RteSelection(dialog, controller, renderer, notify) {
  const grouped = await controller.groupSelectedObjects();
  if (!grouped) return false;
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  notify?.("Diagram objects grouped.");
  return true;
}

async function ungroupDiagram2RteSelection(dialog, controller, renderer, notify) {
  const ungrouped = await controller.ungroupSelectedObjects();
  if (!ungrouped) return false;
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  notify?.("Diagram group ungrouped.");
  return true;
}

async function renameDiagram2RteStructureNode(dialog, controller, renderer, element, askForText, notify) {
  const target = diagram2RteStructureTarget(controller, element);
  if (!target.id) return false;
  const currentName = diagram2RteStructureNodeName(controller, target.kind, target.id);
  const name = String(await askDiagram2RteText(askForText, "Object name", "Rename Object", currentName) || "").trim();
  if (!name || name === currentName) return false;
  const renamed = await controller.renameStructureNode(target.kind, target.id, name);
  if (!renamed) return false;
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  notify?.("Diagram object renamed.");
  return true;
}

async function deleteDiagram2RteStructureNode(dialog, controller, renderer, element, notify) {
  const target = diagram2RteStructureTarget(controller, element);
  if (!target.id) return false;
  const selected = controller.selectStructureNode(target.kind, target.id);
  if (!selected.length) return false;
  updateDiagram2ObjectTreeSelection(dialog, selected);
  updateDiagram2ShellStatus(dialog, diagram2RteShellStatus(controller));
  const deleted = await controller.deleteSelectedObjects({
    label: "Delete object from tree",
    reason: "object tree delete"
  });
  if (!deleted) return false;
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  notify?.("Diagram object deleted.");
  return true;
}

async function toggleDiagram2RteStructureLock(dialog, controller, renderer, element, notify) {
  const target = diagram2RteStructureTarget(controller, element);
  if (!target.id) return false;
  const changed = await controller.setStructureNodeLocked(target.kind, target.id);
  if (!changed) return false;
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  const selection = controller.getObjectsByIds(
    target.kind === "group" ? controller.selectedObjectIds() : [target.id]
  );
  const locked = selection.length > 0 && selection.every(object => object.locked === true);
  notify?.(`Diagram object${selection.length === 1 ? "" : "s"} ${locked ? "locked" : "unlocked"}.`);
  return true;
}

async function toggleDiagram2RteStructureVisibility(dialog, controller, renderer, element) {
  const target = diagram2RteStructureTarget(controller, element);
  if (!target.id) return false;
  const changed = await controller.setStructureNodeVisibility(target.kind, target.id);
  if (!changed) return false;
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  return true;
}

async function toggleDiagram2RteSelectionVisibility(dialog, controller, renderer) {
  const selected = controller.getObjectsByIds(controller.selectedObjectIds());
  if (!selected.length) return false;
  const visible = !selected.every(object => object.visible !== false);
  let changed = false;
  for (const object of selected) {
    changed = await controller.setStructureNodeVisibility("object", object.id, visible) || changed;
  }
  if (!changed) return false;
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  return true;
}

async function reorderDiagram2RteStructureNode(dialog, controller, renderer, moveInput = {}) {
  const drag = dialog.__diagram2ObjectTreeDrag || {};
  const reordered = await controller.reorderStructureNode({
    draggedKind: moveInput.draggedKind || drag.kind || "object",
    draggedId: moveInput.draggedId || drag.id || controller.selectedObjectIds()[0] || "",
    targetKind: moveInput.targetKind || "root",
    targetId: moveInput.targetId || "",
    targetPlacement: moveInput.targetPlacement || "inside"
  });
  if (!reordered) return false;
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  return true;
}

async function saveDiagram2RteSelectionTemplate(dialog, controller, renderer, askForText, saveTemplateLibrary, notify) {
  const templateState = dialog.__diagram2TemplateState;
  if (!templateState?.loaded) return false;
  if (diagram2TemplateCapacityReached(templateState.library)) {
    setDiagram2RteTemplateMessage(dialog, controller, "Template library is full.");
    return false;
  }
  const name = await askDiagram2RteText(askForText, "Template name", "Save Diagram Template", "Template");
  if (!String(name || "").trim()) return false;
  const template = await captureDiagram2SelectionTemplate(controller.currentState(), controller.selectedObjectIds(), name);
  if (!template) {
    setDiagram2RteTemplateMessage(dialog, controller, "Select one or more objects before saving a template.");
    return false;
  }
  const saved = await persistDiagram2RteTemplates(dialog, controller, saveTemplateLibrary, {
    ...templateState.library,
    templates: [template, ...(templateState.library.templates || [])]
  }, `Template "${template.name}" saved.`, notify);
  if (saved) await renderer.whenIdle();
  return saved;
}

async function uploadDiagram2RteTemplates(dialog, controller, saveTemplateLibrary, files, notify) {
  const templateState = dialog.__diagram2TemplateState;
  if (!templateState?.loaded) return false;
  const templates = [...(templateState.library.templates || [])];
  let imported = 0;
  for (const file of files) {
    if (templates.length >= 50) break;
    try {
      templates.unshift(parseDiagram2TemplateUpload(await file.text()));
      imported += 1;
    } catch (error) {
      notify?.(error?.message || "One Diagram template could not be imported.");
    }
  }
  if (!imported) {
    setDiagram2RteTemplateMessage(dialog, controller, "No templates were imported.");
    return false;
  }
  return persistDiagram2RteTemplates(dialog, controller, saveTemplateLibrary, {
    ...templateState.library,
    templates
  }, `${imported} template${imported === 1 ? "" : "s"} imported.`, notify);
}

async function restoreDiagram2RteTemplates(dialog, controller, saveTemplateLibrary, notify) {
  const templateState = dialog.__diagram2TemplateState;
  if (!templateState?.loaded || !templateState.defaultLoaded) return false;
  const restored = restoreDiagram2DefaultTemplates(templateState.library, templateState.defaultLibrary);
  if (restored.capacityExceeded) {
    setDiagram2RteTemplateMessage(dialog, controller, `Remove ${restored.requiredSlots} template${restored.requiredSlots === 1 ? "" : "s"} before restoring defaults.`);
    return false;
  }
  if (!restored.addedCount) {
    setDiagram2RteTemplateMessage(dialog, controller, "Default templates are already present.");
    return false;
  }
  return persistDiagram2RteTemplates(dialog, controller, saveTemplateLibrary, restored.library, "Default templates restored.", notify);
}

async function applyDiagram2RteTemplateById(dialog, controller, renderer, templateId, notify) {
  const template = diagram2RteTemplateById(dialog, templateId);
  if (!template) return false;
  const applied = await controller.applyTemplate(template, diagram2RteInsertionCenter(dialog, controller, renderer));
  if (!applied) return false;
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  setDiagram2RteTemplateMessage(dialog, controller, `Template "${template.name}" added to the canvas.`);
  notify?.(`Template "${template.name}" added to the canvas.`);
  return true;
}

async function formatDiagram2RteSelectionFromTemplate(dialog, controller, renderer, templateId, notify) {
  const template = diagram2RteTemplateById(dialog, templateId);
  if (!template) return false;
  const applied = await controller.applyTemplateFormatting(template);
  if (!applied) return false;
  await finishDiagram2RteObjectCommand(dialog, controller, renderer);
  setDiagram2RteTemplateMessage(dialog, controller, `Template "${template.name}" formatting applied.`);
  notify?.(`Template "${template.name}" formatting applied.`);
  return true;
}

async function renameDiagram2RteTemplate(dialog, controller, templateId, askForText, saveTemplateLibrary, notify) {
  const template = diagram2RteTemplateById(dialog, templateId);
  const templateState = dialog.__diagram2TemplateState;
  if (!template || !templateState?.loaded) return false;
  const name = String(await askDiagram2RteText(askForText, "Template name", "Rename Diagram Template", template.name) || "").trim();
  if (!name || name === template.name) return false;
  return persistDiagram2RteTemplates(dialog, controller, saveTemplateLibrary, {
    ...templateState.library,
    templates: templateState.library.templates.map(item =>
      item.id === template.id ? { ...item, name, updatedAt: new Date().toISOString() } : item)
  }, `Template renamed to "${name}".`, notify);
}

async function updateDiagram2RteTemplateFromSelection(dialog, controller, templateId, saveTemplateLibrary, notify) {
  const template = diagram2RteTemplateById(dialog, templateId);
  const templateState = dialog.__diagram2TemplateState;
  if (!template || !templateState?.loaded) return false;
  const replacement = await captureDiagram2SelectionTemplate(controller.currentState(), controller.selectedObjectIds(), template.name);
  if (!replacement) {
    setDiagram2RteTemplateMessage(dialog, controller, "Select one or more objects before updating a template.");
    return false;
  }
  return persistDiagram2RteTemplates(dialog, controller, saveTemplateLibrary, {
    ...templateState.library,
    templates: templateState.library.templates.map(item =>
      item.id === template.id
        ? { ...replacement, id: template.id, createdAt: template.createdAt || replacement.createdAt }
        : item)
  }, `Template "${template.name}" updated.`, notify);
}

async function moveDiagram2RteTemplate(dialog, controller, templateId, direction, saveTemplateLibrary, notify) {
  const templateState = dialog.__diagram2TemplateState;
  const templates = [...(templateState?.library?.templates || [])];
  const index = templates.findIndex(template => template.id === templateId);
  const nextIndex = index + Number(direction || 0);
  if (index < 0 || nextIndex < 0 || nextIndex >= templates.length) return false;
  [templates[index], templates[nextIndex]] = [templates[nextIndex], templates[index]];
  return persistDiagram2RteTemplates(dialog, controller, saveTemplateLibrary, {
    ...templateState.library,
    templates
  }, "Template order saved.", notify);
}

function downloadDiagram2RteTemplateById(dialog, templateId) {
  const template = diagram2RteTemplateById(dialog, templateId);
  if (!template) return false;
  const file = diagram2TemplateDownload(template);
  downloadTextFile(file.contents, file.fileName, "application/json");
  return true;
}

async function deleteDiagram2RteTemplate(dialog, controller, templateId, confirm, saveTemplateLibrary, notify) {
  const template = diagram2RteTemplateById(dialog, templateId);
  const templateState = dialog.__diagram2TemplateState;
  if (!template || !templateState?.loaded) return false;
  const confirmed = await confirmDiagram2Rte(confirm, `Delete the "${template.name}" Diagram template?`, "Delete Diagram Template", "Delete");
  if (!confirmed) return false;
  return persistDiagram2RteTemplates(dialog, controller, saveTemplateLibrary, {
    ...templateState.library,
    templates: templateState.library.templates.filter(item => item.id !== template.id)
  }, `Template "${template.name}" deleted.`, notify);
}

async function setDiagram2RteDrawingDefault(dialog, controller, type, saveTemplateLibrary, notify) {
  const templateState = dialog.__diagram2TemplateState;
  if (!templateState?.loaded) return false;
  const defaultStyle = controller.setDrawingDefaultFromSelection(type);
  if (!defaultStyle) {
    setDiagram2RteTemplateMessage(dialog, controller, `Select a ${type === "arrow" ? "arrow" : "rectangle"} first.`);
    return false;
  }
  return persistDiagram2RteTemplates(dialog, controller, saveTemplateLibrary, {
    ...templateState.library,
    defaults: {
      ...(templateState.library.defaults || {}),
      [type]: defaultStyle
    }
  }, `${type === "arrow" ? "Arrow" : "Rectangle"} default saved.`, notify);
}

async function resetDiagram2RteDrawingDefault(dialog, controller, type, saveTemplateLibrary, notify) {
  const templateState = dialog.__diagram2TemplateState;
  if (!templateState?.loaded) return false;
  controller.resetDrawingDefault(type);
  return persistDiagram2RteTemplates(dialog, controller, saveTemplateLibrary, {
    ...templateState.library,
    defaults: {
      ...(templateState.library.defaults || {}),
      [type]: null
    }
  }, `${type === "arrow" ? "Arrow" : "Rectangle"} default reset.`, notify);
}

async function persistDiagram2RteTemplates(dialog, controller, saveTemplateLibrary, nextLibrary, message, notify) {
  const templateState = dialog.__diagram2TemplateState;
  if (!templateState?.loaded) {
    setDiagram2RteTemplateMessage(dialog, controller, "Template storage is unavailable.");
    return false;
  }
  refreshDiagram2RteTemplatePane(dialog, controller);
  const saved = await persistDiagram2TemplateLibrary(templateState, saveTemplateLibrary, nextLibrary, message);
  if (saved) controller.setDrawingDefaults(saved.defaults || {});
  refreshDiagram2RteTemplatePane(dialog, controller);
  updateDiagram2ShellStatus(dialog, diagram2RteShellStatus(controller));
  if (saved && message) notify?.(message);
  else if (!saved && templateState.message) notify?.(templateState.message);
  return Boolean(saved);
}

function setDiagram2RteTemplateMessage(dialog, controller, message) {
  const templateState = dialog.__diagram2TemplateState;
  if (!templateState) return;
  templateState.message = String(message || "");
  templateState.error = "";
  refreshDiagram2RteTemplatePane(dialog, controller);
}

function diagram2RteTemplateById(dialog, templateId) {
  const id = String(templateId || "").trim();
  return (dialog.__diagram2TemplateState?.library?.templates || [])
    .find(template => String(template.id || "") === id) || null;
}

function diagram2RteStructureTarget(controller, element) {
  const selectedIds = controller.selectedObjectIds();
  return {
    kind: String(element?.dataset?.nodeKind || "object").trim() || "object",
    id: String(element?.dataset?.objectId || selectedIds[0] || "").trim()
  };
}

function diagram2RteStructureNodeName(controller, kind, id) {
  const state = controller.currentState?.() || {};
  if (kind === "group") return String(state.groupNames?.[id] || "Group");
  return String((state.objects || []).find(object => object.id === id)?.name || "Object");
}

async function askDiagram2RteText(askForText, message, title, currentValue = "") {
  if (typeof askForText === "function") return askForText(message, title, currentValue);
  return globalThis.window?.prompt?.(message, currentValue) ?? "";
}

async function confirmDiagram2Rte(confirm, message, title, actionLabel) {
  if (typeof confirm === "function") return confirm(message, title, actionLabel);
  return globalThis.window?.confirm?.(message) === true;
}

function bindDiagram2RteObjectTreeDragAndDrop(dialog, controller, renderer, signal) {
  dialog.addEventListener("dragstart", event => {
    const row = event.target.closest?.("[data-diagram2-object-tree-row][draggable='true']");
    if (!row || !row.closest("[data-diagram2-objects-pane]")) return;
    const id = String(row.dataset.diagram2ObjectId || "").trim();
    const kind = String(row.dataset.diagram2TreeNodeKind || "object").trim();
    if (!id || ["relationships", "relationship"].includes(kind)) {
      event.preventDefault();
      return;
    }
    dialog.__diagram2ObjectTreeDrag = { id, kind };
    row.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
  }, { signal });

  dialog.addEventListener("dragover", event => {
    if (!dialog.__diagram2ObjectTreeDrag?.id) return;
    const pane = event.target.closest?.("[data-diagram2-objects-pane]");
    if (!pane) return;
    const rootDrop = event.target.closest?.("[data-diagram2-object-tree-root-drop]");
    const row = event.target.closest?.("[data-diagram2-object-tree-row]");
    clearDiagram2RteObjectTreeDropCues(dialog);
    if (rootDrop) {
      event.preventDefault();
      rootDrop.classList.add("is-drop-target");
      event.dataTransfer.dropEffect = "move";
      return;
    }
    if (!row || row.dataset.diagram2ObjectId === dialog.__diagram2ObjectTreeDrag.id) return;
    const placement = diagram2RteObjectTreeDropPlacement(row, event.clientY);
    event.preventDefault();
    row.classList.add(`is-drop-${placement}`);
    event.dataTransfer.dropEffect = "move";
  }, { signal });

  dialog.addEventListener("drop", event => {
    if (!dialog.__diagram2ObjectTreeDrag?.id) return;
    const pane = event.target.closest?.("[data-diagram2-objects-pane]");
    if (!pane) return;
    event.preventDefault();
    const rootDrop = event.target.closest?.("[data-diagram2-object-tree-root-drop]");
    const row = event.target.closest?.("[data-diagram2-object-tree-row]");
    const move = {
      draggedKind: dialog.__diagram2ObjectTreeDrag.kind,
      draggedId: dialog.__diagram2ObjectTreeDrag.id,
      targetKind: rootDrop ? "root" : String(row?.dataset.diagram2TreeNodeKind || "object"),
      targetId: rootDrop ? "" : String(row?.dataset.diagram2ObjectId || ""),
      targetPlacement: rootDrop ? "inside" : diagram2RteObjectTreeDropPlacement(row, event.clientY)
    };
    clearDiagram2RteObjectTreeDropCues(dialog);
    void reorderDiagram2RteStructureNode(dialog, controller, renderer, move);
  }, { signal });

  const finish = () => {
    clearDiagram2RteObjectTreeDropCues(dialog);
    dialog.__diagram2ObjectTreeDrag = null;
  };
  dialog.addEventListener("dragend", finish, { signal });
  dialog.addEventListener("dragleave", event => {
    const pane = event.target.closest?.("[data-diagram2-objects-pane]");
    if (pane && !pane.contains(event.relatedTarget)) clearDiagram2RteObjectTreeDropCues(dialog);
  }, { signal });
}

function diagram2RteObjectTreeDropPlacement(row, clientY) {
  if (!row?.getBoundingClientRect) return "after";
  const kind = String(row.dataset.diagram2TreeNodeKind || "");
  const rect = row.getBoundingClientRect();
  const height = Math.max(1, rect.height || 1);
  const ratio = (Number(clientY || rect.top) - rect.top) / height;
  if (kind === "group" && ratio > 0.25 && ratio < 0.75) return "inside";
  return ratio < 0.5 ? "before" : "after";
}

function clearDiagram2RteObjectTreeDropCues(dialog) {
  dialog.querySelectorAll(".is-dragging, .is-drop-before, .is-drop-after, .is-drop-inside, .is-drop-target")
    .forEach(element => {
      element.classList.remove("is-dragging", "is-drop-before", "is-drop-after", "is-drop-inside", "is-drop-target");
    });
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

async function loadOriginalImage(sourceInput) {
  const source = String(sourceInput || "").trim();
  if (!source) return { source: "", width: 1600, height: 900 };
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.addEventListener("load", () => resolve(element), { once: true });
      element.addEventListener("error", () => reject(new Error("Image load failed.")), { once: true });
      element.src = source;
    });
    return {
      source,
      width: positiveNumber(image.naturalWidth || image.width, 1600),
      height: positiveNumber(image.naturalHeight || image.height, 900)
    };
  } catch {
    return { source, width: 1600, height: 900 };
  }
}

function exposeDebugGlobals(controller, renderer, hostAdapter) {
  globalThis.__pmtDiagram2EditorCore = controller;
  globalThis.__pmtDiagram2Renderer = renderer;
  globalThis.__pmtDiagram2RteHost = hostAdapter;
}

function clearDebugGlobals(controller, renderer, hostAdapter) {
  if (globalThis.__pmtDiagram2EditorCore === controller) globalThis.__pmtDiagram2EditorCore = null;
  if (globalThis.__pmtDiagram2Renderer === renderer) globalThis.__pmtDiagram2Renderer = null;
  if (globalThis.__pmtDiagram2RteHost === hostAdapter) globalThis.__pmtDiagram2RteHost = null;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function diagram2RteRectangleDimensionValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return Number.NaN;
  return Math.min(10000, Math.max(8, number));
}

function safeFileName(value) {
  return String(value || "diagram")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9_.-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "diagram";
}

function downloadTextFile(contents, fileName, type) {
  const blob = new Blob([String(contents || "")], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
