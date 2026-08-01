import {
  disposeDiagram2LinkedViewer,
  hydrateDiagram2LinkedViewer
} from "./features/diagram2/diagram2-rte-linked-viewer.js?v=20260801-public-diagram2-v1";

document.querySelectorAll("[data-public-linked-diagram2]").forEach(block => {
  void hydratePublicLinkedDiagram2(block);
});

async function hydratePublicLinkedDiagram2(block) {
  const source = publicDiagram2Source(block);
  const header = String(block.dataset.header || "Linked Diagram 2: Diagram").trim();
  block.classList.add("pmt-diagram-ole", "pmt-diagram2-ole");
  block.setAttribute("contenteditable", "false");
  block.setAttribute("data-diagram-renderer", "2");
  block.setAttribute("data-diagram2-linked-shell", "");
  block.innerHTML = `
    <figcaption class="pmt-diagram-ole-caption">
      <span data-diagram-ole-header>${escapeHtml(header)}</span>
      <span class="pmt-diagram-ole-actions">
        <button type="button" data-diagram-ole-zoom-out title="Zoom out" aria-label="Zoom out">-</button>
        <button type="button" data-diagram-ole-reset title="Reset to fit" aria-label="Reset to fit">Reset</button>
        <button type="button" data-diagram-ole-fit title="Fit the whole Diagram in the viewer" aria-label="Fit Diagram to viewer">Fit</button>
        <button type="button" data-diagram2-linked-mapping-toggle data-diagram2-left-pane-toggle="mapping" aria-expanded="false" aria-pressed="false" title="Mapping" aria-label="Mapping" hidden>Mapping</button>
        <button type="button" data-diagram-ole-maximize title="Maximize Linked Diagram 2 viewer" aria-label="Maximize Linked Diagram 2 viewer">Maximize</button>
        <button type="button" data-diagram-ole-zoom-in title="Zoom in" aria-label="Zoom in">+</button>
      </span>
    </figcaption>
    <div class="pmt-diagram2-ole-main diagram2-readonly-main" data-diagram2-linked-main data-diagram2-left-pane-mode="mapping">
      <div class="diagram2-mapping-hover-hint" data-diagram2-mapping-hover-hint role="status" hidden>Hover on the UI to DB Field Mapping</div>
      <div class="pmt-diagram-ole-viewport" data-diagram-ole-viewport tabindex="0" aria-label="${escapeAttr(`${header} viewer`)}">
        ${source
          ? `<div class="pmt-diagram-ole-surface diagram2-renderer-surface" data-diagram-ole-surface data-diagram2-linked-renderer-host></div>`
          : `<div class="pmt-diagram-ole-placeholder">This public Diagram 2 could not be rendered.</div>`}
      </div>
    </div>
  `;

  syncPublicLinkedDiagram2Maximized(block, false);
  if (!source) return;

  const host = block.querySelector("[data-diagram2-linked-renderer-host]");
  const viewport = block.querySelector("[data-diagram-ole-viewport]");
  const api = await hydrateDiagram2LinkedViewer({ block, host, source, sourceKey: source, autoFit: true });
  if (!api || !block.isConnected) return;

  bindPublicLinkedDiagram2Controls(block, viewport, api);
}

function bindPublicLinkedDiagram2Controls(block, viewport, api) {
  block.querySelector("[data-diagram-ole-zoom-out]")?.addEventListener("click", () => api.zoomBy(0.85));
  block.querySelector("[data-diagram-ole-zoom-in]")?.addEventListener("click", () => api.zoomBy(1.15));
  block.querySelector("[data-diagram-ole-reset]")?.addEventListener("click", api.fit);
  block.querySelector("[data-diagram-ole-fit]")?.addEventListener("click", api.fit);
  block.querySelector("[data-diagram-ole-maximize]")?.addEventListener("click", async event => {
    event.preventDefault();
    syncPublicLinkedDiagram2Maximized(block, !block.classList.contains("is-maximized"));
    await nextPublicDiagram2Layout();
    if (block.isConnected) api.fit();
  });

  viewport.addEventListener("wheel", event => {
    event.preventDefault();
    if (!event.deltaY) return;
    const rect = viewport.getBoundingClientRect();
    api.zoomBy(event.deltaY < 0 ? 1.08 : 0.92, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
  }, { passive: false });

  let drag = null;
  viewport.addEventListener("auxclick", event => {
    if (event.button === 1) event.preventDefault();
  });
  viewport.addEventListener("pointerdown", event => {
    if (event.button !== 0 && event.button !== 1) return;
    if (event.target.closest?.("[data-diagram2-field-mapping-cell]")) return;
    event.preventDefault();
    drag = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY
    };
    viewport.setPointerCapture?.(event.pointerId);
    viewport.classList.add("is-panning");
  });
  viewport.addEventListener("pointermove", event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    api.panBy(event.clientX - drag.lastX, event.clientY - drag.lastY);
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
  });
  ["pointerup", "pointercancel"].forEach(eventName => {
    viewport.addEventListener(eventName, event => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      viewport.releasePointerCapture?.(event.pointerId);
      drag = null;
      viewport.classList.remove("is-panning");
    });
  });
  block.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !block.classList.contains("is-maximized")) return;
    event.preventDefault();
    syncPublicLinkedDiagram2Maximized(block, false);
    viewport.focus({ preventScroll: true });
  });
  window.addEventListener("pagehide", () => disposeDiagram2LinkedViewer(block), { once: true });
}

function publicDiagram2Source(block) {
  const template = block.querySelector("template[data-public-diagram-source]");
  const image = template?.content?.querySelector?.("img[data-pmt-diagram='true'], img[data-pmt-private-diagram='true'], img");
  const imageSource = String(image?.getAttribute("src") || "").trim();
  if (imageSource) return imageSource;

  const svg = template?.content?.querySelector?.("svg");
  return svg ? `data:image/svg+xml,${encodeURIComponent(svg.outerHTML)}` : "";
}

function syncPublicLinkedDiagram2Maximized(block, maximized) {
  const nextMaximized = maximized === true;
  block.classList.toggle("is-maximized", nextMaximized);
  document.body.classList.toggle("has-pmt-diagram-ole-maximized", nextMaximized);
  const button = block.querySelector("[data-diagram-ole-maximize]");
  if (!button) return;
  button.textContent = nextMaximized ? "Restore" : "Maximize";
  button.setAttribute("aria-label", nextMaximized ? "Restore Linked Diagram 2 viewer" : "Maximize Linked Diagram 2 viewer");
  button.setAttribute("title", nextMaximized ? "Restore Linked Diagram 2 viewer" : "Maximize Linked Diagram 2 viewer");
}

async function nextPublicDiagram2Layout() {
  await new Promise(resolve => requestAnimationFrame(resolve));
  await new Promise(resolve => requestAnimationFrame(resolve));
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(value) {
  return escapeHtml(value)
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
