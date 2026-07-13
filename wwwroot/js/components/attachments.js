import {
  escapeAttr,
  escapeHtml
} from "../shared/text-and-links.js";

export function attachmentsHtml(files, { deletePathPrefix = "" } = {}) {
  const normalizedDeletePath = deletePathPrefix.replace(/\/$/, "");
  return `<div class="attachment-grid">${files.map(file => {
    const content = `
      ${isImageFile(file) ? `<img src="${escapeAttr(file.url)}" alt="${escapeAttr(file.fileName)}">` : `<span class="file-icon">${fileIcon(file)}</span>`}
      <span>${escapeHtml(file.fileName)}</span>
    `;
    if (!normalizedDeletePath) {
      return `<a class="attachment-tile" href="${escapeAttr(file.url)}" target="_blank" rel="noopener noreferrer" title="${escapeAttr(file.fileName)}">${content}</a>`;
    }

    return `
      <div class="attachment-tile attachment-tile-removable">
        <a class="attachment-tile-link" href="${escapeAttr(file.url)}" target="_blank" rel="noopener noreferrer" title="${escapeAttr(file.fileName)}">${content}</a>
        <button
          type="button"
          class="attachment-delete-button"
          data-delete-attachment="${escapeAttr(`${normalizedDeletePath}/${file.id}`)}"
          data-attachment-name="${escapeAttr(file.fileName)}"
          title="Delete ${escapeAttr(file.fileName)}"
          aria-label="Delete ${escapeAttr(file.fileName)}">&times;</button>
      </div>
    `;
  }).join("")}</div>`;
}

export function bindAttachmentDeletion(root, deleteAttachment) {
  if (!root || typeof deleteAttachment !== "function" || root.dataset.attachmentDeletionBound === "true") return;
  root.dataset.attachmentDeletionBound = "true";
  root.addEventListener("click", async event => {
    const button = event.target.closest("[data-delete-attachment]");
    if (!button || !root.contains(button) || button.disabled) return;

    button.disabled = true;
    const deleted = await deleteAttachment(
      button.dataset.deleteAttachment,
      button.dataset.attachmentName || "attachment"
    );
    if (deleted) button.closest(".attachment-tile")?.remove();
    else button.disabled = false;
  });
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
