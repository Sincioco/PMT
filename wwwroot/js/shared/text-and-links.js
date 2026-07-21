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
  matchingElements(root, "[data-pmt-ole='diagram']").forEach(block => {
    const diagramId = Number(block.getAttribute("data-diagram-id") || 0);
    if (!diagramId) {
      block.remove();
      return;
    }

    const blockId = String(block.getAttribute("data-block-id") || "").trim()
      || `pmt-ole-${Date.now().toString(36)}`;
    const width = Math.max(320, Math.round(Number(block.style.width?.replace("px", "") || block.getAttribute("data-view-width") || 900) || 900));
    const height = Math.max(220, Math.round(Number(block.style.height?.replace("px", "") || block.getAttribute("data-view-height") || 520) || 520));
    block.className = "pmt-diagram-ole";
    block.setAttribute("contenteditable", "false");
    block.setAttribute("data-pmt-ole", "diagram");
    block.setAttribute("data-diagram-id", String(diagramId));
    block.setAttribute("data-block-id", blockId);
    block.setAttribute("data-view-width", String(width));
    block.setAttribute("data-view-height", String(height));
    block.removeAttribute("data-diagram-ole-hydrated-key");
    block.removeAttribute("data-diagram-ole-resize-bound");
    block.removeAttribute("data-diagram-ole-view-clamped");
    block.removeAttribute("data-diagram-ole-viewer-bound");
    block.setAttribute("style", `width: ${width}px; height: ${height}px;`);
    block.innerHTML = `<figcaption>Linked Diagram #${diagramId}</figcaption>`;
  });
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
