import { loadDiagramCanonicalState } from "../../shared/diagram-documents.js?v=20260802-diagram2-phase7-roundtrip-v1";
import {
  createDiagram2Renderer,
  diagram2ReadonlyRendererState
} from "./diagram2-renderer.js?v=20260802-diagram2-phase7-roundtrip-v1";
import { createDiagram2FieldMappingIndexes } from "./diagram2-editor-field-mappings.js?v=20260802-diagram2-phase7-roundtrip-v1";
import {
  bindDiagram2EditorLeftPaneResize,
  diagram2MappingPaneHtml,
  downloadDiagram2FieldMappings,
  setDiagram2MappingPaneOpen,
  syncDiagram2MappingPaneColumnWidth,
  syncDiagram2RendererViewportInset
} from "./diagram2-editor-shell.js?v=20260802-diagram2-phase7-roundtrip-v1";

const linkedDiagram2Records = new WeakMap();
const linkedDiagram2LiveRecords = new Set();
const linkedDiagram2DiagnosticsState = {
  linkedDiagram2RendererCreateCount: 0,
  linkedDiagram2RendererDestroyCount: 0,
  linkedDiagram2RendererLiveCount: 0,
  linkedDiagram2HydrateCount: 0,
  linkedDiagram2ReuseCount: 0,
  linkedDiagram2SourceRefreshCount: 0,
  linkedDiagram2ViewportRestoreCount: 0,
  linkedDiagram2ScrumRehydrateCount: 0,
  linkedDiagram2FullRenderCount: 0,
  linkedDiagram2PanFrameCount: 0,
  linkedDiagram2ZoomFrameCount: 0,
  linkedDiagram2ResourceReleaseCount: 0
};

publishLinkedDiagram2Diagnostics();

export async function hydrateDiagram2LinkedViewer(options = {}) {
  const block = options.block;
  const host = options.host;
  const source = String(options.source || "").trim();
  const sourceKey = String(options.sourceKey || source).trim();
  if (!block || !host || !source) return null;

  cleanupDisconnectedDiagram2LinkedViewers();
  linkedDiagram2DiagnosticsState.linkedDiagram2HydrateCount += 1;

  const existing = linkedDiagram2Records.get(block);
  if (existing && existing.host === host && existing.sourceKey === sourceKey && !existing.disposed) {
    linkedDiagram2DiagnosticsState.linkedDiagram2ReuseCount += 1;
    publishLinkedDiagram2Diagnostics();
    return existing.ready;
  }

  if (existing) {
    linkedDiagram2DiagnosticsState.linkedDiagram2SourceRefreshCount += 1;
    destroyLinkedDiagram2Record(existing);
  }

  const record = {
    block,
    host,
    sourceKey,
    disposed: false,
    renderer: null,
    abortController: null,
    state: null,
    mappingIndexes: null,
    mappingSearch: "",
    mappingSearchPinnedId: "",
    mappingGroupByTable: false,
    mappingAlphabetical: false,
    autoFit: options.autoFit === true,
    ready: null
  };
  linkedDiagram2Records.set(block, record);
  linkedDiagram2LiveRecords.add(record);

  record.ready = (async () => {
    const result = await loadDiagramCanonicalState(source);
    if (!linkedDiagram2RecordIsCurrent(record)) return null;
    if (!result.state) {
      host.innerHTML = `<div class="pmt-diagram-ole-placeholder" role="status">Diagram 2 could not read the saved Diagram metadata.</div>`;
      dispatchDiagram2LinkedViewerReady(record, false);
      return null;
    }

    const renderer = createDiagram2Renderer({
      host,
      viewportPadding: 0,
      fitScaleStep: 0
    });
    record.renderer = renderer;
    linkedDiagram2DiagnosticsState.linkedDiagram2RendererCreateCount += 1;
    linkedDiagram2DiagnosticsState.linkedDiagram2RendererLiveCount += 1;
    if (block.closest?.(".scrum-content, .scrum-screen")) {
      linkedDiagram2DiagnosticsState.linkedDiagram2ScrumRehydrateCount += 1;
    }

    record.state = diagram2ReadonlyRendererState(result.state);
    record.mappingIndexes = createDiagram2FieldMappingIndexes(record.state.objects);
    const diagnostics = renderer.render(record.state, {
      reason: "linked Diagram 2 initial"
    });
    linkedDiagram2DiagnosticsState.linkedDiagram2FullRenderCount += Number(diagnostics?.fullRenderCount || 0);
    configureDiagram2LinkedMapping(record);
    bindDiagram2LinkedFieldMapping(record);
    if (record.autoFit) await autoFitDiagram2LinkedViewer(record);
    if (!linkedDiagram2RecordIsCurrent(record)) return null;
    publishLinkedDiagram2Diagnostics();
    dispatchDiagram2LinkedViewerReady(record, true);
    return linkedDiagram2ViewerApi(record);
  })().catch(() => {
    if (!linkedDiagram2RecordIsCurrent(record)) return null;
    host.innerHTML = `<div class="pmt-diagram-ole-placeholder" role="status">Diagram 2 could not read the saved Diagram metadata.</div>`;
    dispatchDiagram2LinkedViewerReady(record, false);
    return null;
  });

  publishLinkedDiagram2Diagnostics();
  return record.ready;
}

export function diagram2LinkedViewerViewport(block) {
  const renderer = linkedDiagram2Renderer(block);
  return renderer ? diagram2OleView(renderer.viewportMatrix()) : null;
}

export function restoreDiagram2LinkedViewerViewport(block, viewInput, options = {}) {
  const renderer = linkedDiagram2Renderer(block);
  const view = normalizeDiagram2OleView(viewInput);
  if (!renderer || !view) return null;

  renderer.setZoom(view.zoom);
  const zoomed = renderer.viewportMatrix();
  renderer.panBy(view.x - zoomed.translateX, view.y - zoomed.translateY);
  if (options.count !== false) {
    linkedDiagram2DiagnosticsState.linkedDiagram2ViewportRestoreCount += 1;
    publishLinkedDiagram2Diagnostics();
  }
  return diagram2OleView(renderer.viewportMatrix());
}

export function zoomDiagram2LinkedViewer(block, factor, point = {}) {
  const renderer = linkedDiagram2Renderer(block);
  if (!renderer) return null;
  renderer.zoomBy(factor, point);
  linkedDiagram2DiagnosticsState.linkedDiagram2ZoomFrameCount += 1;
  publishLinkedDiagram2Diagnostics();
  return diagram2OleView(renderer.viewportMatrix());
}

export function panDiagram2LinkedViewer(block, deltaX, deltaY) {
  const renderer = linkedDiagram2Renderer(block);
  if (!renderer) return null;
  renderer.panBy(deltaX, deltaY);
  linkedDiagram2DiagnosticsState.linkedDiagram2PanFrameCount += 1;
  publishLinkedDiagram2Diagnostics();
  return diagram2OleView(renderer.viewportMatrix());
}

export function fitDiagram2LinkedViewer(block) {
  const renderer = linkedDiagram2Renderer(block);
  if (!renderer) return null;
  syncDiagram2RendererViewportInset(block, renderer, { refit: false });
  renderer.fit();
  return diagram2OleView(renderer.viewportMatrix());
}

export async function fitDiagram2LinkedViewerAfterLayout(block) {
  await nextDiagram2LinkedViewerFrame();
  await nextDiagram2LinkedViewerFrame();
  return fitDiagram2LinkedViewer(block);
}

export function disposeDiagram2LinkedViewer(block) {
  const record = linkedDiagram2Records.get(block);
  if (record) destroyLinkedDiagram2Record(record);
}

export function disposeDiagram2LinkedViewers(root = document) {
  [...linkedDiagram2LiveRecords].forEach(record => {
    if (!record.block?.isConnected || record.block === root || root?.contains?.(record.block)) {
      destroyLinkedDiagram2Record(record);
    }
  });
}

export function linkedDiagram2Diagnostics() {
  return { ...linkedDiagram2DiagnosticsState };
}

function linkedDiagram2Renderer(block) {
  const record = linkedDiagram2Records.get(block);
  return linkedDiagram2RecordIsCurrent(record) ? record.renderer : null;
}

function linkedDiagram2ViewerApi(record) {
  return {
    fit: () => fitDiagram2LinkedViewerAfterLayout(record.block),
    panBy: (x, y) => panDiagram2LinkedViewer(record.block, x, y),
    restore: view => restoreDiagram2LinkedViewerViewport(record.block, view),
    viewport: () => diagram2LinkedViewerViewport(record.block),
    zoomBy: (factor, point) => zoomDiagram2LinkedViewer(record.block, factor, point)
  };
}

function bindDiagram2LinkedFieldMapping(record) {
  const { block, host, renderer } = record;
  const abortController = new AbortController();
  record.abortController = abortController;
  const { signal } = abortController;
  const cellSelector = "[data-diagram2-field-mapping-cell]";
  const traceEntitySelector = "[data-diagram2-relationship-trace-entity='true']";
  let hoveredCell = null;
  let tracePointer = null;

  const mappingOptions = cell => ({
    tableId: cell?.dataset?.diagram2FieldMappingTableId,
    cellKind: cell?.dataset?.diagram2FieldMappingCellKind,
    attentionStartPoints: diagram2LinkedMappingPaneAttentionStartPoints(record, cell)
  });
  const show = cell => renderer.showFieldMappingHover?.(
    cell?.dataset?.diagram2FieldMappingId,
    mappingOptions(cell)
  );

  block.addEventListener("pointerdown", event => {
    if (event.button !== 0 || event.target.closest?.(cellSelector)) return;
    const relationshipNode = event.target.closest?.("[data-diagram2-relationship-id]");
    const entityNode = event.target.closest?.(traceEntitySelector);
    const traceTarget = relationshipNode || entityNode;
    if (traceTarget && host.contains(traceTarget)) {
      tracePointer = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        targetId: relationshipNode?.dataset?.diagram2RelationshipId
          || entityNode?.dataset?.diagram2ObjectId
      };
      return;
    }
    if (event.target.closest?.("[data-diagram-ole-viewport]")) {
      tracePointer = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        targetId: ""
      };
    }
  }, { capture: true, signal });
  block.addEventListener("pointermove", event => {
    if (!tracePointer || tracePointer.pointerId !== event.pointerId) return;
    if (Math.abs(event.clientX - tracePointer.startX) > 3 || Math.abs(event.clientY - tracePointer.startY) > 3) {
      tracePointer.moved = true;
    }
  }, { capture: true, signal });
  block.addEventListener("pointerup", event => {
    if (!tracePointer || tracePointer.pointerId !== event.pointerId) return;
    if (!tracePointer.moved) selectLinkedRelationshipTrace(record, tracePointer.targetId);
    tracePointer = null;
  }, { capture: true, signal });
  block.addEventListener("pointercancel", () => {
    tracePointer = null;
  }, { capture: true, signal });
  block.addEventListener("click", event => {
    const relationshipNode = event.target.closest?.("[data-diagram2-relationship-id]");
    const entityNode = event.target.closest?.(traceEntitySelector);
    const traceTarget = relationshipNode || entityNode;
    if (!traceTarget || !host.contains(traceTarget)) return;
    selectLinkedRelationshipTrace(record, relationshipNode?.dataset?.diagram2RelationshipId
      || entityNode?.dataset?.diagram2ObjectId);
  }, { capture: true, signal });

  block.addEventListener("pointermove", event => {
    const cell = event.target.closest?.(cellSelector);
    if (cell === hoveredCell) return;
    hoveredCell = cell && block.contains(cell) ? cell : null;
    if (hoveredCell) show(hoveredCell);
    else renderer.clearFieldMappingHover?.();
  }, { capture: true, signal });
  block.addEventListener("pointerover", event => {
    const entity = event.target.closest?.(traceEntitySelector);
    if (!entity || !host.contains(entity)
      || event.relatedTarget?.closest?.(traceEntitySelector) === entity) return;
    renderer.setRelationshipTraceHover?.([entity.dataset.diagram2ObjectId]);
  }, { capture: true, signal });
  block.addEventListener("pointerout", event => {
    const entity = event.target.closest?.(traceEntitySelector);
    if (!entity || !host.contains(entity)
      || event.relatedTarget?.closest?.(traceEntitySelector) === entity) return;
    renderer.setRelationshipTraceHover?.([]);
  }, { capture: true, signal });
  block.addEventListener("pointerleave", () => {
    hoveredCell = null;
    renderer.clearFieldMappingHover?.();
    renderer.setRelationshipTraceHover?.([]);
  }, { signal });
  block.addEventListener("click", event => {
    const traceTarget = event.target.closest?.(
      `[data-diagram2-relationship-id], ${traceEntitySelector}`
    );
    if (traceTarget && host.contains(traceTarget)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const toggle = event.target.closest?.("[data-diagram2-linked-mapping-toggle]");
    if (toggle && block.contains(toggle)) {
      event.preventDefault();
      event.stopPropagation();
      const open = setDiagram2MappingPaneOpen(block);
      syncDiagram2LinkedMappingPresentation(record, open, { refit: false });
      return;
    }
    const downloadButton = event.target.closest?.("[data-diagram2-download-field-mapping]");
    if (downloadButton && block.contains(downloadButton)) {
      event.preventDefault();
      event.stopPropagation();
      downloadDiagram2FieldMappings(
        record.mappingIndexes,
        downloadButton.dataset.diagram2DownloadFieldMapping,
        {
          groupByTable: record.mappingGroupByTable,
          alphabetical: record.mappingAlphabetical
        }
      );
      return;
    }
    const cell = event.target.closest?.(cellSelector);
    if (!cell || !block.contains(cell)) {
      renderer.clearFieldMappingSelection?.();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    record.mappingSearchPinnedId = "";
    renderer.pinFieldMapping?.(cell.dataset.diagram2FieldMappingId, mappingOptions(cell));
    cell.focus?.({ preventScroll: true });
  }, { capture: true, signal });
  block.addEventListener("dblclick", event => {
    const cell = event.target.closest?.(cellSelector);
    if (!cell || !block.contains(cell)) return;
    event.preventDefault();
    event.stopPropagation();
    record.mappingSearchPinnedId = "";
    renderer.pinFieldMapping?.(cell.dataset.diagram2FieldMappingId, mappingOptions(cell));
    renderer.focusFieldMappingTarget?.(cell.dataset.diagram2FieldMappingId, {
      cellKind: cell.dataset.diagram2FieldMappingCellKind
    });
  }, { capture: true, signal });
  block.addEventListener("input", event => {
    if (!event.target.matches?.("[data-diagram2-mapping-search]")) return;
    record.mappingSearch = String(event.target.value || "");
    renderDiagram2LinkedMappingPane(record, { focus: "search" });
  }, { signal });
  block.addEventListener("change", event => {
    if (event.target.matches?.("[data-diagram2-mapping-group-by-table]")) {
      record.mappingGroupByTable = event.target.checked === true;
      renderDiagram2LinkedMappingPane(record, { focus: "group" });
    } else if (event.target.matches?.("[data-diagram2-mapping-alphabetical]")) {
      record.mappingAlphabetical = event.target.checked === true;
      renderDiagram2LinkedMappingPane(record, { focus: "alphabetical" });
    }
  }, { signal });
  block.addEventListener("keydown", event => {
    const cell = event.target.closest?.(cellSelector);
    if (cell && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      record.mappingSearchPinnedId = "";
      renderer.pinFieldMapping?.(cell.dataset.diagram2FieldMappingId, mappingOptions(cell));
      return;
    }
    if (event.key === "Escape") {
      renderer.clearFieldMappingSelection?.();
      renderer.setRelationshipTraceSelection?.([]);
      renderer.setRelationshipTraceHover?.([]);
    }
  }, { signal });

  block.dataset.diagram2LinkedFieldMappingBound = "true";
}

function selectLinkedRelationshipTrace(record, targetId) {
  record.renderer?.clearFieldMappingSelection?.();
  record.renderer?.setRelationshipTraceSelection?.(targetId ? [targetId] : []);
}

async function autoFitDiagram2LinkedViewer(record) {
  if (linkedDiagram2RecordIsCurrent(record)) {
    await fitDiagram2LinkedViewerAfterLayout(record.block);
  }
}

function nextDiagram2LinkedViewerFrame() {
  return new Promise(resolve => {
    const schedule = globalThis.requestAnimationFrame
      || (callback => globalThis.setTimeout(callback, 0));
    schedule(() => resolve());
  });
}

function configureDiagram2LinkedMapping(record) {
  const { block, renderer } = record;
  const mappingCount = record.mappingIndexes?.mappingsById?.size || 0;
  const toggle = block.querySelector("[data-diagram2-linked-mapping-toggle]");
  if (toggle) toggle.hidden = mappingCount === 0;

  if (!mappingCount) {
    block.querySelector("[data-diagram2-mapping-pane]")?.remove();
    setDiagram2MappingPaneOpen(block, false);
    renderer.setFieldMappingLinesVisible?.(true);
    renderer.setFieldMappingTablesVisible?.(true);
    syncDiagram2RendererViewportInset(block, renderer, { refit: true });
    return;
  }

  renderDiagram2LinkedMappingPane(record);
  const open = setDiagram2MappingPaneOpen(block, true);
  renderer.setFieldMappingLinesVisible?.(false);
  syncDiagram2LinkedMappingPresentation(record, open, { refit: true });
  bindDiagram2EditorLeftPaneResize(block, {
    onResize: () => syncDiagram2RendererViewportInset(block, renderer, { refit: false })
  });
}

function renderDiagram2LinkedMappingPane(record, options = {}) {
  const main = record.block.querySelector("[data-diagram2-linked-main]");
  const viewport = main?.querySelector("[data-diagram-ole-viewport]");
  if (!main || !viewport || !record.state || !record.mappingIndexes) return null;
  const previousPane = main.querySelector("[data-diagram2-mapping-pane]");
  const previousScrollTop = previousPane?.querySelector(".diagram2-editor-left-pane-scroll")?.scrollTop || 0;
  const markup = diagram2MappingPaneHtml(record.state, {
    indexes: record.mappingIndexes,
    search: record.mappingSearch,
    groupByTable: record.mappingGroupByTable,
    alphabetical: record.mappingAlphabetical
  });
  if (previousPane) previousPane.outerHTML = markup;
  else viewport.insertAdjacentHTML("beforebegin", markup);
  const pane = main.querySelector("[data-diagram2-mapping-pane]");
  const scroll = pane?.querySelector(".diagram2-editor-left-pane-scroll");
  if (scroll) scroll.scrollTop = previousScrollTop;
  syncDiagram2MappingPaneColumnWidth(record.block);
  syncDiagram2LinkedSingleMappingSearchResult(record, pane);
  if (options.focus) {
    const controlSelector = options.focus === "group"
      ? "[data-diagram2-mapping-group-by-table]"
      : options.focus === "alphabetical"
        ? "[data-diagram2-mapping-alphabetical]"
        : "[data-diagram2-mapping-search]";
    const control = pane?.querySelector(controlSelector);
    control?.focus?.({ preventScroll: true });
    if (options.focus === "search") {
      control?.setSelectionRange?.(control.value.length, control.value.length);
    }
  }
  const open = main.classList.contains("is-left-pane-open")
    && main.classList.contains("is-mapping-open");
  syncDiagram2LinkedMappingPresentation(record, open, { refit: false });
  return pane;
}

function syncDiagram2LinkedSingleMappingSearchResult(record, pane) {
  const rows = pane?.querySelectorAll?.("[data-diagram2-mapping-pane-row]") || [];
  const row = record.mappingSearch.trim() && rows.length === 1 ? rows[0] : null;
  const mappingId = String(row?.dataset?.diagram2FieldMappingId || "").trim();
  if (!mappingId) {
    if (record.mappingSearchPinnedId) record.renderer?.clearFieldMappingSelection?.();
    record.mappingSearchPinnedId = "";
    return;
  }

  const field = row.querySelector("[data-diagram2-mapping-pane-field][data-diagram2-field-mapping-cell-kind='ui']");
  record.mappingSearchPinnedId = mappingId;
  record.renderer?.pinFieldMapping?.(mappingId, {
    tableId: field?.dataset?.diagram2FieldMappingTableId,
    cellKind: field?.dataset?.diagram2FieldMappingCellKind,
    attentionStartPoints: diagram2LinkedMappingPaneAttentionStartPoints(record, field)
  });
}

function syncDiagram2LinkedMappingPresentation(record, open, options = {}) {
  const nextOpen = open === true;
  record.renderer?.setFieldMappingTablesVisible?.(!nextOpen);
  syncDiagram2RendererViewportInset(record.block, record.renderer, {
    refit: false
  });
  if (options.refit !== false) record.renderer?.fit?.();
  return nextOpen;
}

function diagram2LinkedMappingPaneAttentionStartPoints(record, cell) {
  if (!cell?.matches?.("[data-diagram2-mapping-pane-field]")) return undefined;
  const pane = cell.closest("[data-diagram2-mapping-pane]");
  const row = cell.closest("[data-diagram2-mapping-pane-row]");
  if (!pane || !row || !record.renderer?.screenToWorld) return undefined;
  const paneRect = pane.getBoundingClientRect();
  const pointFor = kind => {
    const field = row.querySelector(`[data-diagram2-field-mapping-cell-kind='${kind}']`);
    const rect = field?.getBoundingClientRect?.();
    if (!rect?.height) return null;
    return record.renderer.screenToWorld({
      clientX: paneRect.right + 1,
      clientY: rect.top + (rect.height / 2)
    });
  };
  return {
    ui: pointFor("ui"),
    database: pointFor("database")
  };
}

function cleanupDisconnectedDiagram2LinkedViewers() {
  [...linkedDiagram2LiveRecords].forEach(record => {
    if (!record.block?.isConnected || !record.host?.isConnected) destroyLinkedDiagram2Record(record);
  });
}

function destroyLinkedDiagram2Record(record) {
  if (!record || record.disposed) return;
  record.disposed = true;
  record.abortController?.abort();
  record.abortController = null;
  if (record.renderer) {
    record.renderer.destroy();
    record.renderer = null;
    linkedDiagram2DiagnosticsState.linkedDiagram2RendererDestroyCount += 1;
    linkedDiagram2DiagnosticsState.linkedDiagram2RendererLiveCount = Math.max(
      0,
      linkedDiagram2DiagnosticsState.linkedDiagram2RendererLiveCount - 1
    );
    linkedDiagram2DiagnosticsState.linkedDiagram2ResourceReleaseCount += 1;
  }
  linkedDiagram2LiveRecords.delete(record);
  if (linkedDiagram2Records.get(record.block) === record) linkedDiagram2Records.delete(record.block);
  delete record.block?.dataset?.diagram2LinkedFieldMappingBound;
  delete record.block?.dataset?.diagram2LeftPaneResizeBound;
  publishLinkedDiagram2Diagnostics();
}

function linkedDiagram2RecordIsCurrent(record) {
  return Boolean(record
    && !record.disposed
    && record.block?.isConnected
    && record.host?.isConnected
    && linkedDiagram2Records.get(record.block) === record);
}

function dispatchDiagram2LinkedViewerReady(record, available) {
  if (!linkedDiagram2RecordIsCurrent(record)) return;
  record.block.dispatchEvent(new CustomEvent("diagram-ole-source-ready", {
    detail: { available, renderer: "2" }
  }));
}

function diagram2OleView(matrix = {}) {
  return {
    x: Number(matrix.translateX || 0),
    y: Number(matrix.translateY || 0),
    zoom: Number(matrix.scale || 1)
  };
}

function normalizeDiagram2OleView(view = {}) {
  const x = Number(view.x);
  const y = Number(view.y);
  const zoom = Number(view.zoom);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zoom) || zoom <= 0) return null;
  return { x, y, zoom };
}

function publishLinkedDiagram2Diagnostics() {
  globalThis.__pmtLinkedDiagram2Diagnostics = linkedDiagram2DiagnosticsState;
}
