import {
  escapeAttr,
  escapeHtml
} from "../shared/text-and-links.js";

export function attachmentsHtml(files) {
  return `<div class="attachment-grid">${files.map(file => `
    <a class="attachment-tile" href="${escapeAttr(file.url)}" target="_blank" rel="noopener noreferrer" title="${escapeAttr(file.fileName)}">
      ${isImageFile(file) ? `<img src="${escapeAttr(file.url)}" alt="${escapeAttr(file.fileName)}">` : `<span class="file-icon">${fileIcon(file)}</span>`}
      <span>${escapeHtml(file.fileName)}</span>
    </a>
  `).join("")}</div>`;
}

export function filePreviewHtml(file) {
  const fileUrl = URL.createObjectURL(file);
  const safeName = escapeHtml(file.name);
  return `
    <div class="attachment-tile">
      ${file.type.startsWith("image/") ? `<img src="${escapeAttr(fileUrl)}" alt="${escapeAttr(file.name)}">` : `<span class="file-icon">${fileIcon(file)}</span>`}
      <span>${safeName}</span>
    </div>
  `;
}

export function isImageFile(file) {
  return (file.contentType || file.type || "").startsWith("image/");
}

export function fileIcon(file) {
  const type = file.contentType || file.type || "";
  if (type.includes("pdf")) return "PDF";
  if (type.includes("word")) return "DOC";
  if (type.includes("excel") || type.includes("spreadsheet")) return "XLS";
  return "FILE";
}
