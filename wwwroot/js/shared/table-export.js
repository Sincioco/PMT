import { buttonContent } from "../components/buttons.js";
import { escapeHtml } from "./text-and-links.js";

export function openExportDialog({ title, onCsvExport }) {
  const existingDialog = document.querySelector("[data-export-dialog]");
  if (existingDialog) {
    if (!existingDialog.open) existingDialog.showModal?.();
    return;
  }

  const modal = document.createElement("dialog");
  modal.className = "dialog mini-dialog";
  modal.dataset.exportDialog = "true";
  modal.innerHTML = `
    <form method="dialog">
      <div class="dialog-head">
        <h2>${escapeHtml(title)}</h2>
        <button type="button" class="icon-btn" data-close-export-dialog title="Close" aria-label="Close">x</button>
      </div>
      <div class="dialog-body">
        <div class="dialog-actions">
          <button type="button" class="primary text-icon-button" data-export-format="csv">${buttonContent("CSV", "CSV File")}</button>
          <button type="button" class="secondary text-icon-button" data-export-format="excel" title="Excel export will be added in the next pass" aria-label="Excel File" disabled>${buttonContent("XLSX", "Excel File")}</button>
        </div>
      </div>
      <div class="dialog-actions">
        <button type="button" class="secondary text-icon-button" data-close-export-dialog>${buttonContent("&#10005;", "Cancel")}</button>
      </div>
    </form>
  `;

  modal.addEventListener("click", event => {
    if (event.target.closest("[data-close-export-dialog]")) {
      modal.close();
      return;
    }

    const formatButton = event.target.closest("[data-export-format]");
    if (formatButton?.dataset.exportFormat === "csv") {
      onCsvExport();
      modal.close();
    }
  });
  modal.addEventListener("close", () => modal.remove());
  document.body.appendChild(modal);
  modal.showModal();
  modal.querySelector("[data-export-format='csv']")?.focus({ preventScroll: true });
}

export function downloadCsv(filename, columns, rows) {
  const header = columns.map(column => csvCell(column.header)).join(",");
  const body = rows.map(row =>
    columns.map(column => csvCell(column.value(row))).join(",")
  );
  const csv = [header, ...body].join("\r\n");
  downloadTextFile(filename, `\uFEFF${csv}`, "text/csv;charset=utf-8");
}

export function exportFileName(prefix, extension = "csv") {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    padDatePart(now.getMonth() + 1),
    padDatePart(now.getDate()),
    "-",
    padDatePart(now.getHours()),
    padDatePart(now.getMinutes()),
    padDatePart(now.getSeconds())
  ].join("");

  return `${prefix}-${stamp}.${extension}`;
}

function downloadTextFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeDownloadName(filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "").replace(/\r\n|\r|\n/g, "\n");
  return /[",\n]/.test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function safeDownloadName(filename) {
  return String(filename || "pmt-export.csv")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}
