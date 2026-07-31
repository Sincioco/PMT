import {
  buildAnnotationSvg,
  parseAnnotationSvg
} from "../components/image-annotation.js?v=20260731-rte-checkbox-layout-v2";
import { appUrl } from "./app-urls.js";
import { escapeAttr } from "./text-and-links.js";

export const blankDiagramWidth = 1600;
export const blankDiagramHeight = 900;
export const blankDiagramSource = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${blankDiagramWidth}" height="${blankDiagramHeight}" viewBox="0 0 ${blankDiagramWidth} ${blankDiagramHeight}">
    <rect width="${blankDiagramWidth}" height="${blankDiagramHeight}" fill="#ffffff"/>
  </svg>
`)}`;

const diagramSvgSourceCache = new Map();
const diagramSvgSourceLoads = new Map();

export function diagramAllDocuments(documents, userId) {
  return (Array.isArray(documents) ? documents : [])
    .filter(document => diagramDocumentVisibleToUser(document, userId))
    .filter(document => Boolean(diagramDocumentImage(document)));
}

export function diagramDocumentVisibleToUser(document, userId) {
  return diagramDocumentOwnedByUser(document, userId) || document?.isPrivate === false;
}

export function diagramDocumentOwnedByUser(document, userId) {
  return Number(document?.createdByUserId || 0) === Number(userId || 0);
}

export function diagramDocumentImage(document) {
  const html = String(document?.bodyHtml || "");
  const template = globalThis.document?.createElement?.("template");
  if (template) {
    template.innerHTML = html;
    const image = template.content.querySelector("img[data-pmt-diagram='true'], img[data-pmt-private-diagram='true']");
    const source = String(image?.getAttribute("src") || "").trim();
    return source ? { source } : null;
  }

  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/\bdata-pmt-(?:private-)?diagram=(?:"true"|'true'|true)(?:\s|\/|>)/i.test(tag)) continue;
    const source = tag.match(/\bsrc=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const value = String(source?.[1] || source?.[2] || source?.[3] || "").trim();
    if (value) return { source: value };
  }

  return null;
}

export function diagramUpdatedTime(document) {
  return Date.parse(document?.updatedAt || document?.createdAt || "") || 0;
}

export function diagramLatestUpdatedHistory(document) {
  return (Array.isArray(document?.history) ? document.history : []).find(item => item.action === "Updated") || null;
}

export function diagramLastEditorUserId(document) {
  return diagramLatestUpdatedHistory(document)?.userId
    || document?.updatedByUserId
    || document?.createdByUserId
    || 0;
}

export function diagramSourceIsSvg(sourceInput) {
  const source = String(sourceInput || "");
  return /^data:image\/svg\+xml(?:;|,)/i.test(source)
    || /\.svg(?:[?#]|$)/i.test(source);
}

export function decodeDiagramSvgDataUrl(sourceInput) {
  const source = String(sourceInput || "");
  const separator = source.indexOf(",");
  if (separator < 0 || !/^data:image\/svg\+xml(?:;|,)/i.test(source)) return "";

  try {
    const metadata = source.slice(0, separator).toLowerCase();
    const payload = source.slice(separator + 1);
    if (!metadata.includes(";base64")) return decodeURIComponent(payload);
    const binary = atob(payload.replace(/\s+/g, ""));
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

export async function loadDiagramSvgSource(sourceInput) {
  const source = String(sourceInput || "").trim();
  if (!source) return "";
  const embedded = decodeDiagramSvgDataUrl(source);
  if (embedded) return embedded;
  if (diagramSvgSourceCache.has(source)) return diagramSvgSourceCache.get(source);
  if (diagramSvgSourceLoads.has(source)) return diagramSvgSourceLoads.get(source);
  if (typeof globalThis.fetch !== "function") return "";

  const load = (async () => {
    try {
      const response = await fetch(appUrl(source), {
        cache: "no-store",
        credentials: "same-origin"
      });
      if (!response.ok) return "";
      const svg = await response.text();
      if (!/<svg(?:\s|>)/i.test(svg)) return "";
      diagramSvgSourceCache.set(source, svg);
      return svg;
    } catch {
      return "";
    } finally {
      diagramSvgSourceLoads.delete(source);
    }
  })();
  diagramSvgSourceLoads.set(source, load);
  return load;
}

export async function loadDiagramCanonicalState(sourceInput) {
  const source = String(sourceInput || blankDiagramSource).trim();
  const svgSource = decodeDiagramSvgDataUrl(source)
    || diagramSvgSourceCache.get(source)
    || await loadDiagramSvgSource(source);
  const state = parseAnnotationSvg(svgSource);
  return {
    state,
    svg: svgSource,
    metrics: state
      ? { width: state.width || blankDiagramWidth, height: state.height || blankDiagramHeight }
      : diagramSvgMetrics(svgSource, { width: blankDiagramWidth, height: blankDiagramHeight }),
    stateLoaded: Boolean(state)
  };
}

export function diagramReadonlyImageResult(sourceInput, title, options = {}) {
  const source = String(sourceInput || blankDiagramSource);
  const className = String(options.className || "diagram-readonly-svg").trim();
  const svgSource = decodeDiagramSvgDataUrl(source) || diagramSvgSourceCache.get(source) || "";
  const state = parseAnnotationSvg(svgSource);
  const needsSvgHydration = diagramSourceIsSvg(source) && !svgSource;

  if (!state) {
    return {
      html: `<img class="${escapeAttr(className || "diagram-readonly-image")}" src="${escapeAttr(appUrl(source))}" alt="${escapeAttr(title)} preview" data-diagram-image draggable="false">`,
      metrics: diagramSvgMetrics(svgSource, { width: blankDiagramWidth, height: blankDiagramHeight }),
      needsSvgHydration,
      stateLoaded: false
    };
  }

  const svg = buildAnnotationSvg(state, {
    interactiveEntityHeaders: true,
    interactiveRelationships: true,
    interactiveFieldMapping: true
  })
    .replace(/^<\?xml[^>]*>\s*/i, "")
    .replace("<svg ", `<svg class="${escapeAttr(className)}" data-diagram-image `)
    .replace('aria-label="Annotated image"', `aria-label="${escapeAttr(title)} preview"`);

  return {
    html: svg,
    metrics: diagramSvgMetrics(svg, { width: state.width || blankDiagramWidth, height: state.height || blankDiagramHeight }),
    needsSvgHydration: false,
    stateLoaded: true
  };
}

export function diagramSvgMetrics(svgInput, fallback = {}) {
  const source = String(svgInput || "");
  const fallbackWidth = positiveNumber(fallback.width, blankDiagramWidth);
  const fallbackHeight = positiveNumber(fallback.height, blankDiagramHeight);
  const viewBoxMatch = source.match(/\bviewBox=(?:"([^"]*)"|'([^']*)')/i);
  const viewBox = viewBoxMatch?.[1] || viewBoxMatch?.[2] || "";
  const values = viewBox.trim().split(/[,\s]+/).map(Number);
  if (values.length === 4 && values.every(Number.isFinite)) {
    return {
      width: Math.max(1, values[2]),
      height: Math.max(1, values[3])
    };
  }

  return {
    width: positiveNumber(svgLength(source, "width"), fallbackWidth),
    height: positiveNumber(svgLength(source, "height"), fallbackHeight)
  };
}

function svgLength(source, attribute) {
  const match = source.match(new RegExp(`\\b${attribute}=(?:"([^"]*)"|'([^']*)')`, "i"));
  return Number.parseFloat(String(match?.[1] || match?.[2] || "").replace(/px$/i, ""));
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
