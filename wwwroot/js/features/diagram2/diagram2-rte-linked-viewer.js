import { loadDiagramCanonicalState } from "../../shared/diagram-documents.js?v=20260801-rte-link-diagram2-v1";
import {
  createDiagram2Renderer,
  diagram2ReadonlyRendererState
} from "./diagram2-renderer.js?v=20260801-rte-link-diagram2-v1";

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

    const diagnostics = renderer.render(diagram2ReadonlyRendererState(result.state), {
      reason: "linked Diagram 2 initial"
    });
    linkedDiagram2DiagnosticsState.linkedDiagram2FullRenderCount += Number(diagnostics?.fullRenderCount || 0);
    bindDiagram2LinkedFieldMapping(record);
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
  renderer.fit();
  return diagram2OleView(renderer.viewportMatrix());
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
    fit: () => fitDiagram2LinkedViewer(record.block),
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
  let hoveredCell = null;

  const mappingOptions = cell => ({
    tableId: cell?.dataset?.diagram2FieldMappingTableId,
    cellKind: cell?.dataset?.diagram2FieldMappingCellKind
  });
  const show = cell => renderer.showFieldMappingHover?.(
    cell?.dataset?.diagram2FieldMappingId,
    mappingOptions(cell)
  );

  host.addEventListener("pointermove", event => {
    const cell = event.target.closest?.(cellSelector);
    if (cell === hoveredCell) return;
    hoveredCell = cell && host.contains(cell) ? cell : null;
    if (hoveredCell) show(hoveredCell);
    else renderer.clearFieldMappingHover?.();
  }, { signal });
  host.addEventListener("pointerleave", () => {
    hoveredCell = null;
    renderer.clearFieldMappingHover?.();
  }, { signal });
  host.addEventListener("click", event => {
    const cell = event.target.closest?.(cellSelector);
    if (!cell || !host.contains(cell)) {
      renderer.clearFieldMappingSelection?.();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    renderer.pinFieldMapping?.(cell.dataset.diagram2FieldMappingId, mappingOptions(cell));
    cell.focus?.({ preventScroll: true });
  }, { signal });
  host.addEventListener("keydown", event => {
    const cell = event.target.closest?.(cellSelector);
    if (cell && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      renderer.pinFieldMapping?.(cell.dataset.diagram2FieldMappingId, mappingOptions(cell));
      return;
    }
    if (event.key === "Escape") renderer.clearFieldMappingSelection?.();
  }, { signal });

  block.dataset.diagram2LinkedFieldMappingBound = "true";
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
