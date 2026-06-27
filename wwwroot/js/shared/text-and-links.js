export function normalizeRichHtml(html) {
  const container = document.createElement("div");
  container.innerHTML = html;
  linkifyTextNodes(container);
  normalizeLinksInElement(container);
  return container.innerHTML;
}

export function normalizeLinksInElement(root) {
  root.querySelectorAll("a[href]").forEach(link => {
    link.href = normalizeUrl(link.getAttribute("href"));
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });
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

export function normalizeUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/") || trimmed.startsWith("#") || trimmed.startsWith("./") || trimmed.startsWith("../")) return trimmed;
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
