import {
  appUrl,
  storageUrl
} from "./app-urls.js";

export function normalizeRichHtml(html) {
  const container = document.createElement("div");
  container.innerHTML = html;
  container.querySelectorAll(".rich-code-actions").forEach(node => node.remove());
  container.querySelectorAll(".rich-code-block[data-rich-code-readonly-initial-applied]").forEach(block => {
    block.removeAttribute("data-rich-code-readonly-initial-applied");
  });
  normalizeDiagramOleBlocksForStorage(container);
  linkifyTextNodes(container);
  normalizeLinksInElement(container, { forStorage: true });
  return container.innerHTML;
}

export function normalizeDiagramOleBlocksForStorage(root) {
  const usedBlockIds = new Set();
  matchingElements(root, "[data-pmt-ole='diagram']").forEach(block => {
    const fallbackDiagramId = Number(block.getAttribute("data-diagram-id") || 0);
    const tabs = normalizeDiagramOleTabsForStorage(block, fallbackDiagramId);
    if (!tabs.length) {
      block.remove();
      return;
    }

    let blockId = String(block.getAttribute("data-block-id") || "").trim();
    if (!blockId || usedBlockIds.has(blockId)) {
      blockId = createDiagramOleBlockId(usedBlockIds);
    }
    usedBlockIds.add(blockId);
    const activeTabId = String(block.getAttribute("data-active-tab-id") || "").trim();
    const activeTab = tabs.find(tab => tab.id === activeTabId) || tabs[0];
    const header = diagramOleHeaderForStorage(block, activeTab, tabs);
    const width = Math.max(320, Math.round(Number(block.style.width?.replace("px", "") || block.getAttribute("data-view-width") || 900) || 900));
    const height = Math.max(220, Math.round(Number(block.style.height?.replace("px", "") || block.getAttribute("data-view-height") || 520) || 520));
    block.className = "pmt-diagram-ole";
    block.setAttribute("contenteditable", "false");
    block.setAttribute("data-pmt-ole", "diagram");
    block.setAttribute("data-diagram-id", String(activeTab.diagramId));
    block.setAttribute("data-block-id", blockId);
    block.setAttribute("data-active-tab-id", activeTab.id);
    block.setAttribute("data-tabs", JSON.stringify(tabs));
    block.setAttribute("data-header", header);
    block.setAttribute("data-view-width", String(width));
    block.setAttribute("data-view-height", String(height));
    if (activeTab.view) {
      block.setAttribute("data-view-x", String(activeTab.view.x));
      block.setAttribute("data-view-y", String(activeTab.view.y));
      block.setAttribute("data-view-zoom", String(activeTab.view.zoom));
    } else {
      block.removeAttribute("data-view-x");
      block.removeAttribute("data-view-y");
      block.removeAttribute("data-view-zoom");
    }
    block.removeAttribute("data-diagram-ole-hydrated-key");
    block.removeAttribute("data-diagram-ole-resize-bound");
    block.removeAttribute("data-diagram-ole-view-clamped");
    block.removeAttribute("data-diagram-ole-viewer-bound");
    block.removeAttribute("data-current-view-x");
    block.removeAttribute("data-current-view-y");
    block.removeAttribute("data-current-view-zoom");
    block.setAttribute("style", `width: ${width}px; height: ${height}px;`);
    block.innerHTML = `<figcaption>${escapeHtml(header)}</figcaption>`;
  });
}

function diagramOleHeaderForStorage(block, activeTab, tabs) {
  const storedHeader = String(block.getAttribute("data-header") || "").trim();
  if (storedHeader) return storedHeader;
  const caption = block.querySelector("figcaption");
  if (caption) {
    const captionCopy = caption.cloneNode(true);
    captionCopy.querySelectorAll("button, .pmt-diagram-ole-actions, .pmt-diagram-ole-tab-actions").forEach(node => node.remove());
    const captionText = captionCopy.textContent.replace(/\s+/g, " ").trim();
    if (captionText) return captionText;
  }
  return tabs.length > 1 ? `${tabs.length} Linked Diagrams` : `Linked Diagram #${activeTab.diagramId}`;
}

function createDiagramOleBlockId(usedBlockIds = new Set()) {
  let blockId = "";
  do {
    blockId = `pmt-ole-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  } while (usedBlockIds.has(blockId));
  return blockId;
}

function createDiagramOleTabId(usedTabIds = new Set()) {
  let tabId = "";
  do {
    tabId = `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  } while (usedTabIds.has(tabId));
  return tabId;
}

function normalizeDiagramOleTabsForStorage(block, fallbackDiagramId) {
  const usedTabIds = new Set();
  const tabs = [];
  try {
    const parsed = JSON.parse(block.getAttribute("data-tabs") || "[]");
    if (Array.isArray(parsed)) {
      parsed.forEach((entry, index) => {
        const tab = normalizeDiagramOleTabForStorage(entry, index, usedTabIds);
        if (tab) {
          tabs.push(tab);
          usedTabIds.add(tab.id);
        }
      });
    }
  } catch {
    // Legacy one-Diagram OLEs are handled below.
  }

  if (tabs.length) return tabs;
  if (!fallbackDiagramId) return [];
  const view = diagramOleViewportForStorage(block);
  const tab = {
    id: String(block.getAttribute("data-active-tab-id") || `tab-${fallbackDiagramId}`),
    diagramId: fallbackDiagramId,
    title: `Diagram #${fallbackDiagramId}`
  };
  if (view) tab.view = view;
  return [tab];
}

function normalizeDiagramOleTabForStorage(entry, index, usedTabIds = new Set()) {
  const diagramId = Number(entry?.diagramId || entry?.id || 0);
  if (!diagramId) return null;
  let id = String(entry?.tabId || entry?.key || entry?.id || "").trim();
  if (!id || id === String(diagramId) || usedTabIds.has(id)) id = createDiagramOleTabId(usedTabIds);
  const title = String(entry?.title || `Diagram ${index + 1}`).trim() || `Diagram ${index + 1}`;
  const view = diagramOleViewportRecordForStorage(entry?.currentView) || diagramOleViewportRecordForStorage(entry?.view);
  return {
    id,
    diagramId,
    title,
    ...(view ? { view } : {})
  };
}

function diagramOleViewportForStorage(block) {
  const read = (name, fallbackName = "") => Number(block.getAttribute(name) || (fallbackName ? block.getAttribute(fallbackName) : ""));
  const x = read("data-current-view-x", "data-view-x");
  const y = read("data-current-view-y", "data-view-y");
  const zoom = read("data-current-view-zoom", "data-view-zoom");
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zoom) || zoom <= 0) return null;
  return {
    x: Math.round(x),
    y: Math.round(y),
    zoom: Math.round(zoom * 1000) / 1000
  };
}

function diagramOleViewportRecordForStorage(record) {
  const x = Number(record?.x);
  const y = Number(record?.y);
  const zoom = Number(record?.zoom);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zoom) || zoom <= 0) return null;
  return {
    x: Math.round(x),
    y: Math.round(y),
    zoom: Math.round(zoom * 1000) / 1000
  };
}

export function normalizeLinksInElement(root, options = {}) {
  matchingElements(root, "a[href]").forEach(link => {
    link.href = normalizeUrl(link.getAttribute("href"), options);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });

  matchingElements(root, "img[src], audio[src], video[src], source[src], iframe[src], embed[src]").forEach(element => {
    element.setAttribute("src", normalizeUrl(element.getAttribute("src"), options));
  });

  matchingElements(root, "object[data]").forEach(element => {
    element.setAttribute("data", normalizeUrl(element.getAttribute("data"), options));
  });
}

function matchingElements(root, selector) {
  const matches = [];
  if (root?.matches?.(selector)) matches.push(root);
  root?.querySelectorAll?.(selector).forEach(element => matches.push(element));
  return matches;
}

export function linkifyTextNodes(root) {
  const textNodes = [];

  collectTextNodes(root, textNodes);
  textNodes.forEach(node => {
    const text = node.nodeValue;
    const urlPattern = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
    if (!urlPattern.test(text)) return;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    text.replace(urlPattern, (match, _unused, offset) => {
      if (offset > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, offset)));
      }

      const link = document.createElement("a");
      link.href = normalizeUrl(match);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = match;
      fragment.appendChild(link);
      lastIndex = offset + match.length;
      return match;
    });

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    node.parentNode.replaceChild(fragment, node);
  });
}

function collectTextNodes(node, textNodes) {
  if (node.nodeType === Node.TEXT_NODE) {
    if (node.nodeValue.trim() && !node.parentElement?.closest("a, pre, code, kbd, samp, textarea, script, style")) {
      textNodes.push(node);
    }
    return;
  }

  node.childNodes.forEach(child => collectTextNodes(child, textNodes));
}

export function normalizeUrl(value, options = {}) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith("//")) return options.forStorage ? storageUrl(trimmed) : trimmed;
  if (trimmed.startsWith("/")) return options.forStorage ? storageUrl(trimmed) : appUrl(trimmed);
  if (trimmed.startsWith("#") || trimmed.startsWith("./") || trimmed.startsWith("../")) return trimmed;
  if (trimmed.startsWith("www.")) return `https://${trimmed}`;
  return `https://${trimmed}`;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function escapeAttr(value) {
  return escapeHtml(value);
}
