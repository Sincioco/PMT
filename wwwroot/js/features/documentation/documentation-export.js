import { createZipBlob } from "../../shared/xlsx.js?v=20260706-documentation-export";
import { exportFileName } from "../../shared/table-export.js?v=20260706-dialog-persistence";
import { state } from "../../core/store.js";
import { formatDate } from "../../shared/dates.js";
import {
  projectById,
  sprintById,
  userById
} from "../../shared/selectors.js";
import {
  escapeAttr,
  escapeHtml
} from "../../shared/text-and-links.js";

const importMetadataTitle = "PMT Import Process Meta Data";
const exportSchema = "pmt.documentation.export.v1";
const exportDialogIconAssetVersion = "20260706-export-dialog-icons";
const exportDialogIconBasePath = "/assets/export-icons";
const wordImageMaxWidthPx = 624;

export function documentationExportIconHtml() {
  return `
    <svg class="button-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3v11M8 10l4 4 4-4M5 17v3h14v-3"></path>
    </svg>
  `;
}

export function openDocumentationExportDialog(blog, { showToast } = {}) {
  if (!blog) return;

  const existingDialog = document.querySelector("[data-documentation-export-dialog]");
  if (existingDialog) {
    if (!existingDialog.open) existingDialog.showModal?.();
    return;
  }

  const modal = document.createElement("dialog");
  modal.className = "dialog mini-dialog export-dialog documentation-export-dialog";
  modal.dataset.documentationExportDialog = "true";
  modal.innerHTML = `
    <form method="dialog">
      <div class="dialog-head">
        <h2>Export Document</h2>
        <button type="button" class="icon-btn" data-close-documentation-export title="Close" aria-label="Close">x</button>
      </div>
      <div class="dialog-body">
        <div class="export-format-grid documentation-export-format-grid">
          ${documentationExportFormatButton("word", "Word Document", wordIconHtml(), "primary")}
          ${documentationExportFormatButton("html-inline", "HTML (self contained)", htmlIconHtml(), "secondary")}
          ${documentationExportFormatButton("html-zip", "HTML + Image Folder", zipIconHtml(), "secondary")}
          ${documentationExportFormatButton("pdf", "PDF (Print Preview)", pdfIconHtml(), "secondary")}
        </div>
        <p class="documentation-export-status" data-documentation-export-status hidden></p>
      </div>
      <div class="dialog-actions">
        <button type="button" class="secondary" data-close-documentation-export>Cancel</button>
      </div>
    </form>
  `;

  modal.addEventListener("click", async event => {
    if (event.target.closest("[data-close-documentation-export]")) {
      modal.close();
      return;
    }

    const formatButton = event.target.closest("[data-documentation-export-format]");
    if (!formatButton || formatButton.disabled) return;

    const format = formatButton.dataset.documentationExportFormat || "";
    let printWindow = null;

    try {
      if (format === "pdf") printWindow = openPrintPreviewWindow(blog);
      setExportDialogBusy(modal, true, "Preparing export...");
      await exportDocumentation(blog, format, printWindow);
      modal.close();
    } catch (error) {
      const message = error?.message || "Export failed.";
      showToast?.(message);
      setExportDialogStatus(modal, message);
      if (printWindow && !printWindow.closed) writePrintWindowError(printWindow, message);
    } finally {
      setExportDialogBusy(modal, false);
    }
  });
  modal.addEventListener("close", () => modal.remove());

  document.body.appendChild(modal);
  modal.showModal();
  modal.querySelector("[data-documentation-export-format='word']")?.focus({ preventScroll: true });
}

function documentationExportFormatButton(format, label, icon, tone) {
  return `
    <button type="button" class="${tone} export-format-button documentation-export-format-button" data-documentation-export-format="${escapeAttr(format)}" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}">
      <span class="button-icon" aria-hidden="true">${icon}</span>
      <span class="documentation-export-format-label">${escapeHtml(label)}</span>
    </button>
  `;
}

async function exportDocumentation(blog, format, printWindow) {
  if (format === "word") {
    await downloadWordDocument(blog);
    return;
  }

  if (format === "html-inline") {
    await downloadSelfContainedHtml(blog);
    return;
  }

  if (format === "html-zip") {
    await downloadHtmlImageZip(blog);
    return;
  }

  if (format === "pdf") {
    await openPdfPrintPreview(blog, printWindow);
    return;
  }

  throw new Error("Unknown export format.");
}

async function downloadWordDocument(blog) {
  const parts = await buildDocumentationExportParts(blog, "word");
  const html = documentationHtmlDocument(blog, parts, { word: true });
  downloadBlob(
    exportFileName(documentationExportBaseName(blog), "doc"),
    new Blob(["\uFEFF", html], { type: "application/msword;charset=utf-8" })
  );
}

async function downloadSelfContainedHtml(blog) {
  const parts = await buildDocumentationExportParts(blog, "inline");
  const html = documentationHtmlDocument(blog, parts, { imageClick: true });
  downloadBlob(
    exportFileName(documentationExportBaseName(blog), "html"),
    new Blob([html], { type: "text/html;charset=utf-8" })
  );
}

async function downloadHtmlImageZip(blog) {
  const parts = await buildDocumentationExportParts(blog, "folder");
  const baseName = documentationExportBaseName(blog);
  const html = documentationHtmlDocument(blog, parts, { imageClick: true });
  const entries = [
    { name: `${baseName}.html`, text: html },
    ...parts.images.map(image => ({ name: `images/${image.fileName}`, bytes: image.bytes }))
  ];

  downloadBlob(exportFileName(baseName, "zip"), createZipBlob(entries));
}

async function openPdfPrintPreview(blog, printWindow) {
  if (!printWindow || printWindow.closed) throw new Error("Allow pop-ups to open the PDF print preview.");

  writePrintWindowMessage(printWindow, blog.title, "Preparing print preview...");
  const parts = await buildDocumentationExportParts(blog, "inline");
  const html = documentationHtmlDocument(blog, parts, { print: true });
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
}

async function buildDocumentationExportParts(blog, imageMode) {
  const parsed = document.implementation.createHTMLDocument("");
  const body = parsed.createElement("div");
  body.innerHTML = blog.bodyHtml || "";

  body.querySelectorAll("script").forEach(node => node.remove());

  const images = [];
  const usedNames = new Set();
  const imageNodes = [...body.querySelectorAll("img")];

  for (let index = 0; index < imageNodes.length; index += 1) {
    const image = imageNodes[index];
    const source = image.getAttribute("src") || "";
    if (!source) continue;

    const exportedImage = await loadExportImage(source, index, usedNames);
    exportedImage.exportPath = `images/${exportedImage.fileName}`;
    images.push(exportedImage);

    image.setAttribute("data-pmt-export-image", exportedImage.id);
    image.removeAttribute("srcset");
    image.removeAttribute("sizes");
    image.setAttribute("src", imageMode === "folder" ? exportedImage.exportPath : exportedImage.dataUrl);
    if (!image.getAttribute("alt")) image.setAttribute("alt", exportedImage.fileName);

    if (imageMode === "word") {
      applyWordImageDisplaySize(image, exportedImage);
    }
  }

  const metadata = documentationImportMetadata(blog, images);

  return {
    bodyHtml: body.innerHTML,
    images,
    metadata
  };
}

async function loadExportImage(source, index, usedNames) {
  if (/^data:/i.test(source)) {
    const parsedData = parseDataUrl(source);
    const dimensions = await imageDimensions(source);
    const fileName = uniqueFileName(`image-${index + 1}.${extensionForContentType(parsedData.contentType)}`, usedNames);
    return {
      id: `image-${index + 1}`,
      source,
      absoluteSource: source,
      fileName,
      contentType: parsedData.contentType,
      bytes: parsedData.bytes,
      naturalWidth: dimensions.width,
      naturalHeight: dimensions.height,
      dataUrl: source
    };
  }

  const absoluteSource = absoluteUrl(source);
  const response = await fetch(absoluteSource, { credentials: "same-origin" });
  if (!response.ok) throw new Error(`Could not export image "${source}".`);

  const blob = await response.blob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const contentType = blob.type || contentTypeFromPath(absoluteSource);
  const fileName = uniqueFileName(fileNameFromSource(absoluteSource, contentType, index), usedNames);
  const dataUrl = await blobToDataUrl(new Blob([bytes], { type: contentType }));
  const dimensions = await imageDimensions(dataUrl);

  return {
    id: `image-${index + 1}`,
    source,
    absoluteSource,
    fileName,
    contentType,
    bytes,
    naturalWidth: dimensions.width,
    naturalHeight: dimensions.height,
    dataUrl
  };
}

function documentationHtmlDocument(blog, parts, options = {}) {
  const wordAttributes = options.word
    ? ` xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"`
    : "";
  const classes = [
    "pmt-export-document",
    options.word ? "pmt-word-document" : "",
    options.imageClick ? "pmt-html-document" : ""
  ].filter(Boolean).join(" ");

  return `<!doctype html>
<html lang="en"${wordAttributes}>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(blog.title || "PMT Documentation")}</title>
  <style>
${documentationExportCss(options)}
  </style>
</head>
<body>
  <main class="${classes}">
    ${documentationExportHeaderHtml(blog)}
    <section class="pmt-document-body">
      ${parts.bodyHtml || `<p class="muted">No content.</p>`}
    </section>
    ${documentationExportAttachmentsHtml(blog)}
    ${documentationMetadataSectionHtml(parts.metadata)}
  </main>
  <script type="application/json" id="pmt-import-metadata">${jsonForScript(parts.metadata)}</script>
  ${options.imageClick ? imageOpenScript() : ""}
  ${options.print ? printPreviewScript() : ""}
</body>
</html>`;
}

function documentationExportHeaderHtml(blog) {
  const project = projectById(blog.projectId);
  const sprint = sprintById(blog.sprintId);
  const parent = blog.parentBlogId ? state.blogs.find(item => item.id === blog.parentBlogId) : null;
  const author = userById(blog.createdByUserId);
  const rows = [
    ["Project", project ? `${project.code} - ${project.title}` : "Global"],
    sprint ? ["Sprint", `${sprint.code} - ${sprint.title}`] : null,
    parent ? ["Parent", parent.title] : null,
    ["Created", formatDate(blog.createdAt)],
    blog.updatedAt && blog.updatedAt !== blog.createdAt ? ["Last Edited", formatDate(blog.updatedAt)] : null,
    ["Author", documentationUserName(author)]
  ].filter(Boolean);

  return `
    <header class="pmt-document-header">
      <p class="pmt-document-kicker">PMT Documentation Export</p>
      <h1>${escapeHtml(blog.title || "Untitled Document")}</h1>
      <dl class="pmt-document-meta">
        ${rows.map(([label, value]) => `
          <div>
            <dt>${escapeHtml(label)}</dt>
            <dd>${escapeHtml(value || "None")}</dd>
          </div>
        `).join("")}
      </dl>
    </header>
  `;
}

function documentationExportAttachmentsHtml(blog) {
  if (!blog.attachments?.length) return "";

  return `
    <section class="pmt-document-attachments">
      <h2>Attachments</h2>
      <ul>
        ${blog.attachments.map(file => `
          <li><a href="${escapeAttr(absoluteUrl(file.url || ""))}">${escapeHtml(file.fileName || file.url || "Attachment")}</a></li>
        `).join("")}
      </ul>
    </section>
  `;
}

function documentationMetadataSectionHtml(metadata) {
  const metadataJson = JSON.stringify(metadata, null, 2);

  return `
    <section class="pmt-import-metadata">
      <h2>${importMetadataTitle}</h2>
      <p>This section is used by PMT for a future import process. Keep it unchanged, or delete it if this exported copy will never be imported back into PMT.</p>
      <pre>${escapeHtml(metadataJson)}</pre>
    </section>
  `;
}

function documentationImportMetadata(blog, images) {
  const project = projectById(blog.projectId);
  const sprint = sprintById(blog.sprintId);
  const parent = blog.parentBlogId
    ? { id: blog.parentBlogId, title: parentBlogTitle(blog.parentBlogId) }
    : null;
  const author = userById(blog.createdByUserId);

  return {
    schema: exportSchema,
    exportedAt: new Date().toISOString(),
    sourceApplication: "PMT",
    sourceUrl: window.location.origin,
    document: {
      id: blog.id,
      title: blog.title || "",
      project: project ? { id: project.id, code: project.code, title: project.title } : null,
      sprint: sprint ? { id: sprint.id, code: sprint.code, title: sprint.title } : null,
      parent,
      createdAt: blog.createdAt || "",
      updatedAt: blog.updatedAt || "",
      createdByUser: author ? {
        id: author.id,
        nickname: author.nickname || "",
        firstName: author.firstName || "",
        lastName: author.lastName || "",
        email: author.email || ""
      } : { id: blog.createdByUserId || 0 },
      bodyHtml: blog.bodyHtml || "",
      attachments: (blog.attachments || []).map(file => ({
        id: file.id || 0,
        fileName: file.fileName || "",
        url: file.url || "",
        contentType: file.contentType || ""
      }))
    },
    images: images.map(image => ({
      id: image.id,
      source: image.source,
      absoluteSource: image.absoluteSource,
      exportPath: image.exportPath || "",
      fileName: image.fileName,
      contentType: image.contentType,
      byteLength: image.bytes.length
    }))
  };
}

function documentationExportCss(options = {}) {
  return `
    @page {
      margin: 0.75in;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: #ffffff;
      color: #172033;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 14px;
      line-height: 1.6;
    }

    a {
      color: #126bff;
    }

    .pmt-export-document {
      width: min(960px, 100%);
      margin: 0 auto;
      padding: ${options.word ? "0" : "32px"};
    }

    .pmt-document-kicker {
      margin: 0 0 6px;
      color: #586274;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .pmt-document-header h1 {
      margin: 0 0 18px;
      color: #111827;
      font-size: 30px;
      line-height: 1.2;
    }

    .pmt-document-meta {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      margin: 0 0 28px;
    }

    .pmt-document-meta div {
      min-width: 0;
      border: 1px solid #d8dee8;
      padding: 10px 12px;
      background: #f8fafc;
    }

    .pmt-document-meta dt {
      margin: 0 0 3px;
      color: #586274;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .pmt-document-meta dd {
      margin: 0;
      overflow-wrap: anywhere;
    }

    .pmt-document-body {
      overflow-wrap: anywhere;
    }

    .pmt-document-body > :first-child {
      margin-top: 0;
    }

    .pmt-document-body img {
      display: block;
      max-width: 100%;
      height: auto;
      margin: 16px auto;
    }

    .pmt-word-document .pmt-document-body img {
      max-width: ${wordImageMaxWidthPx}px;
      height: auto;
    }

    .pmt-html-document .pmt-document-body img {
      cursor: zoom-in;
    }

    .pmt-document-body h1,
    .pmt-document-body h2,
    .pmt-document-body h3,
    .pmt-document-attachments h2,
    .pmt-import-metadata h2 {
      color: #111827;
      line-height: 1.25;
    }

    .rich-code-block,
    details {
      border: 1px solid #d8dee8;
      padding: 10px 12px;
      background: #f8fafc;
    }

    pre,
    code {
      font-family: Consolas, Monaco, monospace;
    }

    pre {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .pmt-document-attachments {
      margin-top: 32px;
      padding-top: 18px;
      border-top: 1px solid #d8dee8;
    }

    .pmt-import-metadata {
      margin-top: 48px;
      padding-top: 18px;
      border-top: 1px solid #d8dee8;
      break-before: page;
      page-break-before: always;
    }

    .pmt-import-metadata p {
      color: #586274;
    }

    .pmt-import-metadata pre {
      border: 1px solid #d8dee8;
      padding: 12px;
      background: #f8fafc;
      font-size: 11px;
      line-height: 1.45;
    }

    @media (max-width: 720px) {
      .pmt-export-document {
        padding: 20px;
      }

      .pmt-document-meta {
        grid-template-columns: 1fr;
      }
    }

    @media print {
      .pmt-export-document {
        width: 100%;
        padding: 0;
      }
    }
  `;
}

function setExportDialogBusy(modal, busy, message = "") {
  modal.querySelectorAll("[data-documentation-export-format]").forEach(button => {
    button.disabled = busy;
  });

  setExportDialogStatus(modal, busy ? message : "");
}

function setExportDialogStatus(modal, message) {
  const status = modal.querySelector("[data-documentation-export-status]");
  if (!status) return;

  status.textContent = message || "";
  status.hidden = !message;
}

function openPrintPreviewWindow(blog) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) throw new Error("Allow pop-ups to open the PDF print preview.");

  try {
    printWindow.opener = null;
  } catch {
    // Some browsers do not allow changing opener on an about:blank print tab.
  }

  writePrintWindowMessage(printWindow, blog.title, "Preparing print preview...");
  return printWindow;
}

function writePrintWindowMessage(printWindow, title, message) {
  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title || "PMT Documentation")}</title>
  <style>
    body {
      margin: 40px;
      font-family: Arial, Helvetica, sans-serif;
      color: #172033;
    }
  </style>
</head>
<body>
  <p>${escapeHtml(message)}</p>
</body>
</html>`);
  printWindow.document.close();
}

function applyWordImageDisplaySize(image, exportedImage) {
  const naturalWidth = Number(exportedImage.naturalWidth || 0);
  const displayWidth = Math.min(wordImageMaxWidthPx, naturalWidth || wordImageMaxWidthPx);
  const existingStyle = image.getAttribute("style") || "";
  const nextStyle = `${existingStyle}; max-width:${wordImageMaxWidthPx}px; width:${displayWidth}px; height:auto;`;

  image.setAttribute("width", String(displayWidth));
  image.removeAttribute("height");
  image.setAttribute("style", nextStyle);
}

function imageDimensions(source) {
  return new Promise(resolve => {
    const image = new Image();
    image.addEventListener("load", () => {
      resolve({
        width: image.naturalWidth || image.width || 0,
        height: image.naturalHeight || image.height || 0
      });
    }, { once: true });
    image.addEventListener("error", () => resolve({ width: 0, height: 0 }), { once: true });
    image.src = source;
  });
}

function writePrintWindowError(printWindow, message) {
  writePrintWindowMessage(printWindow, "PMT Documentation Export", message);
}

function imageOpenScript() {
  return `
  <script>
    (() => {
      const openImage = async image => {
        const source = image.currentSrc || image.getAttribute("src") || "";
        if (!source) return;

        const opened = window.open("", "_blank");
        if (!opened) return;
        opened.opener = null;

        let targetUrl = source;
        let revokeUrl = "";

        try {
          if (/^data:/i.test(source)) {
            const blob = await fetch(source).then(response => response.blob());
            targetUrl = URL.createObjectURL(blob);
            revokeUrl = targetUrl;
          } else {
            targetUrl = new URL(source, window.location.href).href;
          }
        } catch {
          targetUrl = source;
        }

        opened.location.href = targetUrl;
        if (revokeUrl) window.setTimeout(() => URL.revokeObjectURL(revokeUrl), 60000);
      };

      document.addEventListener("click", event => {
        const image = event.target instanceof Element
          ? event.target.closest(".pmt-document-body img")
          : null;
        if (!image) return;

        event.preventDefault();
        openImage(image);
      });
    })();
  </script>
  `;
}

function printPreviewScript() {
  return `
  <script>
    (() => {
      const waitForImages = () => Promise.all(Array.from(document.images).map(image => {
        if (image.complete) return Promise.resolve();
        return new Promise(resolve => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        });
      }));

      window.addEventListener("load", () => {
        waitForImages().then(() => window.setTimeout(() => window.print(), 150));
      });
    })();
  </script>
  `;
}

function parseDataUrl(dataUrl) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/i.exec(dataUrl || "");
  if (!match) throw new Error("Could not export an embedded image.");

  const contentType = match[1] || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || "";
  const bytes = isBase64
    ? base64ToBytes(payload)
    : new TextEncoder().encode(decodeURIComponent(payload));

  return { contentType, bytes };
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error || new Error("Could not read image bytes.")));
    reader.readAsDataURL(blob);
  });
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeFilePart(filename, "pmt-documentation-export");
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function fileNameFromSource(source, contentType, index) {
  let name = "";
  try {
    const url = new URL(source, window.location.href);
    name = decodePathPart(url.pathname.split("/").filter(Boolean).pop() || "");
  } catch {
    name = "";
  }

  if (!name) name = `image-${index + 1}`;
  if (!/\.[a-z0-9]{2,5}$/i.test(name)) name += `.${extensionForContentType(contentType)}`;
  return safeFilePart(name, `image-${index + 1}.${extensionForContentType(contentType)}`);
}

function uniqueFileName(fileName, usedNames) {
  const safeName = safeFilePart(fileName, "image");
  const dotIndex = safeName.lastIndexOf(".");
  const base = dotIndex > 0 ? safeName.slice(0, dotIndex) : safeName;
  const extension = dotIndex > 0 ? safeName.slice(dotIndex) : "";
  let candidate = safeName;
  let counter = 2;

  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${base}-${counter}${extension}`;
    counter += 1;
  }

  usedNames.add(candidate.toLowerCase());
  return candidate;
}

function safeFilePart(value, fallback) {
  return String(value || fallback || "file")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || fallback || "file";
}

function documentationExportBaseName(blog) {
  return safeFilePart(`pmt-documentation-${blog.id || "document"}-${blog.title || "untitled"}`, "pmt-documentation");
}

function contentTypeFromPath(source) {
  const extension = pathExtension(source);
  const contentTypes = {
    bmp: "image/bmp",
    gif: "image/gif",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    svg: "image/svg+xml",
    webp: "image/webp"
  };
  return contentTypes[extension] || "application/octet-stream";
}

function extensionForContentType(contentType) {
  const extensions = {
    "image/bmp": "bmp",
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/svg+xml": "svg",
    "image/webp": "webp"
  };
  return extensions[String(contentType || "").toLowerCase()] || "bin";
}

function pathExtension(source) {
  try {
    const url = new URL(source, window.location.href);
    const match = /\.([a-z0-9]{2,5})$/i.exec(url.pathname);
    return match?.[1]?.toLowerCase() || "";
  } catch {
    const match = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(source || "");
    return match?.[1]?.toLowerCase() || "";
  }
}

function absoluteUrl(value) {
  if (!value) return "";

  try {
    return new URL(value, window.location.href).href;
  } catch {
    return value;
  }
}

function decodePathPart(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parentBlogTitle(parentBlogId) {
  const parent = state.blogs.find(blog => blog.id === parentBlogId);
  return parent?.title || "";
}

function documentationUserName(user) {
  if (!user) return "User";

  return [user.firstName, user.lastName]
    .map(part => (part || "").trim())
    .filter(Boolean)
    .join(" ") || user.nickname || "User";
}

function jsonForScript(value) {
  return JSON.stringify(value)
    .replaceAll("&", "\\u0026")
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function wordIconHtml() {
  return exportFormatImageIconHtml("export-word-document.svg");
}

function htmlIconHtml() {
  return exportFormatImageIconHtml("export-html-self-contained.svg");
}

function zipIconHtml() {
  return exportFormatImageIconHtml("export-html-image-folder.svg");
}

function pdfIconHtml() {
  return exportFormatImageIconHtml("export-pdf-print-preview.svg");
}

function exportFormatImageIconHtml(fileName) {
  const src = `${exportDialogIconBasePath}/${fileName}?v=${exportDialogIconAssetVersion}`;
  return `<img class="button-svg-icon export-format-icon" src="${escapeAttr(src)}" alt="" aria-hidden="true" draggable="false">`;
}
