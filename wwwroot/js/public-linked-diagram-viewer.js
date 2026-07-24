(() => {
  const minZoom = 0.01;
  const maxZoom = 5;

  document.querySelectorAll("[data-public-linked-diagram]").forEach(hydratePublicLinkedDiagram);

  function hydratePublicLinkedDiagram(block) {
    const source = publicDiagramSource(block);
    const header = String(block.dataset.header || "Linked Diagram: Diagram").trim();
    block.classList.add("pmt-diagram-ole");
    block.setAttribute("contenteditable", "false");
    block.innerHTML = `
      <figcaption class="pmt-diagram-ole-caption">
        <span data-diagram-ole-header>${escapeHtml(header)}</span>
        <span class="pmt-diagram-ole-actions">
          <button type="button" data-diagram-ole-zoom-out title="Zoom out" aria-label="Zoom out">-</button>
          <button type="button" data-diagram-ole-reset title="Reset to fit" aria-label="Reset to fit">Reset</button>
          <button type="button" data-diagram-ole-fit title="Fit the whole Diagram in the viewer" aria-label="Fit Diagram to viewer">Fit</button>
          <button type="button" data-diagram-ole-maximize title="Maximize Linked Diagram viewer" aria-label="Maximize Linked Diagram viewer">Maximize</button>
          <button type="button" data-diagram-ole-zoom-in title="Zoom in" aria-label="Zoom in">+</button>
        </span>
      </figcaption>
      <div class="pmt-diagram-ole-viewport" data-diagram-ole-viewport tabindex="0" aria-label="${escapeAttr(`${header} viewer`)}">
        ${source ? `<div class="pmt-diagram-ole-surface" data-diagram-ole-surface></div>` : `<div class="pmt-diagram-ole-placeholder">This public Diagram could not be rendered.</div>`}
      </div>
    `;

    if (!source) {
      syncPublicLinkedDiagramMaximized(block, false);
      return;
    }

    const viewport = block.querySelector("[data-diagram-ole-viewport]");
    const surface = block.querySelector("[data-diagram-ole-surface]");
    source.setAttribute("draggable", "false");
    if (!source.getAttribute("alt")) source.setAttribute("alt", header.replace(/^Linked Diagram:\s*/i, "") || "Diagram");
    surface.appendChild(source);

    bindPublicLinkedDiagramViewer(block, viewport, surface, source);
  }

  function publicDiagramSource(block) {
    const template = block.querySelector("template[data-public-diagram-source]");
    const content = template?.content?.cloneNode(true);
    const source = content?.querySelector?.("img[data-pmt-diagram='true'], img[data-pmt-private-diagram='true'], img, svg");
    if (!source) return null;
    source.removeAttribute("style");
    source.classList.remove("rich-svg-image", "pmt-annotation-image");
    return source;
  }

  function bindPublicLinkedDiagramViewer(block, viewport, surface, source) {
    let view = { x: 0, y: 0, zoom: 1 };
    let drag = null;

    const render = () => {
      view.zoom = clampZoom(view.zoom);
      view.x = Math.round(Number(view.x || 0));
      view.y = Math.round(Number(view.y || 0));
      surface.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;
    };
    const fit = () => {
      const viewportWidth = Math.round(viewport.clientWidth || 0);
      const viewportHeight = Math.round(viewport.clientHeight || 0);
      const size = sourceSize(source);
      if (!viewportWidth || !viewportHeight || !size.width || !size.height) return;

      const zoom = clampZoom(Math.min(viewportWidth / size.width, viewportHeight / size.height));
      view = {
        x: Math.round((viewportWidth - size.width * zoom) / 2),
        y: Math.round((viewportHeight - size.height * zoom) / 2),
        zoom
      };
      render();
    };
    const zoomBy = (factor, anchor = null) => {
      const previousZoom = clampZoom(view.zoom);
      const nextZoom = clampZoom(previousZoom * factor);
      const anchorPoint = anchor || {
        x: Math.max(1, viewport.clientWidth || 0) / 2,
        y: Math.max(1, viewport.clientHeight || 0) / 2
      };
      const diagramX = (anchorPoint.x - Number(view.x || 0)) / previousZoom;
      const diagramY = (anchorPoint.y - Number(view.y || 0)) / previousZoom;
      view = {
        x: anchorPoint.x - diagramX * nextZoom,
        y: anchorPoint.y - diagramY * nextZoom,
        zoom: nextZoom
      };
      render();
    };

    block.querySelector("[data-diagram-ole-zoom-out]")?.addEventListener("click", () => zoomBy(0.85));
    block.querySelector("[data-diagram-ole-zoom-in]")?.addEventListener("click", () => zoomBy(1.15));
    block.querySelector("[data-diagram-ole-reset]")?.addEventListener("click", fit);
    block.querySelector("[data-diagram-ole-fit]")?.addEventListener("click", fit);
    block.querySelector("[data-diagram-ole-maximize]")?.addEventListener("click", event => {
      event.preventDefault();
      syncPublicLinkedDiagramMaximized(block, !block.classList.contains("is-maximized"));
      requestAnimationFrame(render);
    });

    viewport.addEventListener("wheel", event => {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      zoomBy(event.deltaY < 0 ? 1.08 : 0.92, {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      });
    }, { passive: false });
    viewport.addEventListener("pointerdown", event => {
      if (event.button !== 0 && event.button !== 1) return;
      event.preventDefault();
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        viewX: view.x,
        viewY: view.y
      };
      viewport.setPointerCapture?.(event.pointerId);
      viewport.classList.add("is-panning");
    });
    viewport.addEventListener("pointermove", event => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      view.x = drag.viewX + event.clientX - drag.startX;
      view.y = drag.viewY + event.clientY - drag.startY;
      render();
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
      syncPublicLinkedDiagramMaximized(block, false);
      viewport.focus({ preventScroll: true });
    });
    window.addEventListener("resize", () => {
      if (block.classList.contains("is-maximized")) fit();
      else render();
    });

    syncPublicLinkedDiagramMaximized(block, false);
    if (source instanceof HTMLImageElement && !source.complete) {
      source.addEventListener("load", () => requestAnimationFrame(fit), { once: true });
    } else {
      requestAnimationFrame(fit);
    }
  }

  function syncPublicLinkedDiagramMaximized(block, maximized) {
    const nextMaximized = Boolean(maximized);
    block.classList.toggle("is-maximized", nextMaximized);
    document.body.classList.toggle("has-pmt-diagram-ole-maximized", nextMaximized);
    const button = block.querySelector("[data-diagram-ole-maximize]");
    if (!button) return;
    button.textContent = nextMaximized ? "Restore" : "Maximize";
    button.setAttribute("aria-label", nextMaximized ? "Restore Linked Diagram viewer" : "Maximize Linked Diagram viewer");
    button.setAttribute("title", nextMaximized ? "Restore Linked Diagram viewer" : "Maximize Linked Diagram viewer");
  }

  function sourceSize(source) {
    if (source instanceof HTMLImageElement) {
      return {
        width: Math.max(1, source.naturalWidth || source.clientWidth || 0),
        height: Math.max(1, source.naturalHeight || source.clientHeight || 0)
      };
    }

    const viewBox = source.viewBox?.baseVal;
    const rect = source.getBoundingClientRect();
    return {
      width: Math.max(1, viewBox?.width || rect.width || source.clientWidth || 0),
      height: Math.max(1, viewBox?.height || rect.height || source.clientHeight || 0)
    };
  }

  function clampZoom(value) {
    return Math.min(maxZoom, Math.max(minZoom, Number(value || 1)));
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
})();
