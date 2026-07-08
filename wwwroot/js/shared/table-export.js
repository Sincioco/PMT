import { buttonContent } from "../components/buttons.js";
import { initializeWindowedDialog } from "../components/dialogs.js?v=20260706-dialog-persistence";
import { appUrl } from "./app-urls.js";
import { escapeHtml } from "./text-and-links.js";
import {
  createXlsxBlob,
  readXlsxObjects
} from "./xlsx.js?v=20260630-native-xlsx";

const exportIconAssetVersion = "20260630-export-file-icons";
const csvIconUrl = appUrl(`/assets/export-csv.svg?v=${exportIconAssetVersion}`);
const excelIconUrl = appUrl(`/assets/export-excel.svg?v=${exportIconAssetVersion}`);

export function exportIconHtml() {
  return `
    <svg class="button-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3v11M8 10l4 4 4-4M5 17v3h14v-3"></path>
    </svg>
  `;
}

export function importIconHtml() {
  return `
    <svg class="button-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 21V10M8 14l4-4 4 4M5 7V4h14v3"></path>
    </svg>
  `;
}

export function workItemImportHash(item, percentCompleted) {
  return stableHash([
    item?.id || "",
    item?.taskType || "Dev",
    item?.title || "",
    percentCompleted ?? item?.percentCompleted ?? "",
    item?.status || "",
    item?.priority || "",
    [...(item?.assigneeIds || [])].map(Number).sort((a, b) => a - b).join(";")
  ].join("|"));
}

export function workItemSystemColumns({ nameHeader, itemTypeLabel, percentValue, assigneeLabel }) {
  return [
    { header: "PMT Item Id", value: row => row.task.id },
    { header: "PMT Item Code", value: row => row.task.code },
    { header: "PMT Item Type", value: row => itemTypeLabel(row.task) },
    { header: "PMT Row Hash", value: row => workItemImportHash(row.task, percentValue(row.task)) },
    { header: nameHeader, value: row => row.task.title },
    { header: "PMT Update Percent Completed", value: row => percentValue(row.task) },
    { header: "PMT Update Status", value: row => row.task.status },
    { header: "PMT Update Priority", value: row => row.task.priority },
    { header: "PMT Update Assignee IDs", value: row => (row.task.assigneeIds || []).join(";") },
    { header: "PMT Update Assignees", value: row => assigneeLabel(row.task) }
  ];
}

export function importCell(record, ...headers) {
  for (const header of headers) {
    if (Object.prototype.hasOwnProperty.call(record, header)) return String(record[header] ?? "");
  }
  return "";
}

export function importCellExists(record, ...headers) {
  return headers.some(header => Object.prototype.hasOwnProperty.call(record, header));
}

export function parseImportItemId(record) {
  const id = Number(importCell(record, "PMT Item Id").trim());
  return Number.isInteger(id) && id > 0 ? id : 0;
}

export function assertImportItemCode(record, expectedCode, ...visibleCodeHeaders) {
  const expected = normalizeImportCode(expectedCode);
  const visibleCode = normalizeImportCode(importCell(record, ...visibleCodeHeaders));
  const metadataCode = normalizeImportCode(importCell(record, "PMT Item Code"));

  if (visibleCode && expected && visibleCode !== expected) {
    throw new Error("The visible item code does not match the PMT metadata for this row. Re-export the grid and keep each row together when sorting.");
  }
  if (metadataCode && expected && metadataCode !== expected) {
    throw new Error("PMT Item Code does not match PMT Item Id for this row.");
  }
}

export function parseImportPercent(record, ...headers) {
  const value = importCell(record, ...headers, "PMT Update Percent Completed").trim();
  const percent = Number(value);
  if (!value || !Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error("Percent Completed must be a number from 0 to 100.");
  }
  return Math.round(percent);
}

export function parseImportAssigneeIds(record, users, ...nameHeaders) {
  if (importCellExists(record, ...nameHeaders)) {
    return parseImportAssigneeNames(importCell(record, ...nameHeaders), users);
  }

  const idsText = importCell(record, "PMT Update Assignee IDs").trim();
  if (idsText) {
    return splitImportList(idsText).map(value => {
      const id = Number(value);
      if (!Number.isInteger(id) || !users.some(user => user.id === id)) {
        throw new Error(`Unknown assignee id "${value}".`);
      }
      return id;
    });
  }

  return parseImportAssigneeNames(importCell(record, "PMT Update Assignees"), users);
}

function parseImportAssigneeNames(value, users) {
  return splitImportList(value).map(name => {
    const normalized = name.toLowerCase();
    const user = users.find(candidate => importUserNameMatches(candidate, normalized));
    if (!user) throw new Error(`Unknown assignee "${name}".`);
    return user.id;
  });
}

function importUserNameMatches(user, normalizedName) {
  return [
    user.nickname,
    [user.firstName, user.lastName].filter(Boolean).join(" ")
  ].some(value => String(value || "").toLowerCase() === normalizedName);
}

export function importWorkbookTypeError(records, allowedTypes, screenLabel) {
  const allowed = new Set(allowedTypes);
  const types = [...new Set((records || [])
    .map(record => normalizeImportItemType(importCell(record, "PMT Item Type")))
    .filter(Boolean))];
  const disallowedTypes = types.filter(type => !allowed.has(type));
  if (!disallowedTypes.length) return "";

  const typeList = disallowedTypes.map(importItemTypeLabel).join(", ");
  const targetLabel = importWorkbookScreenLabel(types);
  const targetHelp = targetLabel
    ? ` Use the ${targetLabel} Import button for this file.`
    : " Export a fresh PMT file from this screen and try again.";
  return `This PMT export file contains ${typeList} rows and cannot be imported from ${screenLabel}.${targetHelp}`;
}

export function sameNumberList(left, right) {
  const leftValues = [...(left || [])].map(Number).sort((a, b) => a - b);
  const rightValues = [...(right || [])].map(Number).sort((a, b) => a - b);
  return leftValues.length === rightValues.length
    && leftValues.every((value, index) => value === rightValues[index]);
}

export function uniqueIds(values) {
  return [...new Set((values || []).map(Number).filter(value => Number.isInteger(value) && value > 0))];
}

export function openExportDialog({ title, onCsvExport, onExcelExport }) {
  const existingDialog = document.querySelector("[data-export-dialog]");
  if (existingDialog) {
    if (!existingDialog.open) existingDialog.showModal?.();
    return;
  }

  const modal = document.createElement("dialog");
  modal.className = "dialog mini-dialog export-dialog";
  modal.dataset.exportDialog = "true";
  modal.innerHTML = `
    <form method="dialog">
      <div class="dialog-head">
        <h2>${escapeHtml(title)}</h2>
        <button type="button" class="icon-btn" data-close-export-dialog title="Close" aria-label="Close">x</button>
      </div>
      <div class="dialog-body">
        <div class="export-format-grid">
          <button type="button" class="primary export-format-button" data-export-format="csv" title="CSV File" aria-label="CSV File">
            <span class="button-icon" aria-hidden="true">${csvIconHtml()}</span>
          </button>
          <button type="button" class="secondary export-format-button" data-export-format="excel" title="Excel File" aria-label="Excel File">
            <span class="button-icon" aria-hidden="true">${excelIconHtml()}</span>
          </button>
        </div>
      </div>
      <div class="dialog-actions">
        <button type="button" class="secondary" data-close-export-dialog>Cancel</button>
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
    if (formatButton?.dataset.exportFormat === "excel") {
      onExcelExport();
      modal.close();
    }
  });
  modal.addEventListener("close", () => modal.remove());
  document.body.appendChild(modal);
  modal.showModal();
  modal.querySelector("[data-export-format='csv']")?.focus({ preventScroll: true });
}

export function showImportResultDialog({ title, totalRows, updatedRows, errors = [] }) {
  const modal = document.createElement("dialog");
  modal.className = "dialog detail-dialog import-result-dialog";
  modal.innerHTML = `
    <div class="dialog-head">
      <h2>${escapeHtml(title)}</h2>
      <button type="button" class="icon-btn" data-close-import-result title="Close" aria-label="Close">x</button>
    </div>
    <div class="dialog-body">
      <div class="import-result-summary">
        <div><strong>${updatedRows}</strong><span>Updated</span></div>
        <div><strong>${Math.max(0, totalRows - updatedRows - errors.length)}</strong><span>Unchanged</span></div>
        <div><strong>${errors.length}</strong><span>Errors</span></div>
      </div>
      ${errors.length ? importErrorsHtml(errors) : `<div class="empty">Import completed with no row errors.</div>`}
    </div>
    <div class="dialog-actions">
      ${errors.length ? `<button type="button" class="secondary text-icon-button" data-download-import-errors>${buttonContent(csvIconHtml(), "Download Error Report")}</button>` : ""}
      <button type="button" class="primary text-icon-button" data-close-import-result>${buttonContent("&#10003;", "Done")}</button>
    </div>
  `;

  modal.addEventListener("click", event => {
    if (event.target.closest("[data-close-import-result]")) {
      modal.close();
      return;
    }

    if (event.target.closest("[data-download-import-errors]")) {
      downloadImportErrors(errors);
    }
  });
  modal.addEventListener("close", () => modal.remove());
  document.body.appendChild(modal);
  initializeWindowedDialog(modal);
  modal.showModal();
}

export function downloadXlsx(filename, sheetName, columns, rows) {
  const blob = createXlsxBlob({ sheetName, columns, rows });
  downloadBlob(filename, blob);
}

export function openExcelImport({ onImport, onError }) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";
  input.hidden = true;
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    input.remove();
    if (!file) return;

    try {
      const rows = await readImportObjects(file);
      await onImport(rows);
    } catch (error) {
      if (onError) onError(error);
      else throw error;
    }
  }, { once: true });
  document.body.appendChild(input);
  input.click();
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
  downloadBlob(filename, blob);
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeDownloadName(filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function importErrorsHtml(errors) {
  return `
    <div class="import-error-panel">
      <table class="table import-error-table">
        <thead>
          <tr>
            <th>File Row</th>
            <th>Item</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          ${errors.map(error => `
            <tr>
              <td>${escapeHtml(error.rowNumber || "")}</td>
              <td>${escapeHtml([error.code, error.title].filter(Boolean).join(" - "))}</td>
              <td>${escapeHtml(error.message || "")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function downloadImportErrors(errors) {
  downloadCsv(exportFileName("pmt-import-errors"), [
    { header: "File Row", value: error => error.rowNumber || "" },
    { header: "Item Code", value: error => error.code || "" },
    { header: "Item Name", value: error => error.title || "" },
    { header: "Error", value: error => error.message || "" }
  ], errors);
}

function csvIconHtml() {
  return exportFormatImageIconHtml(csvIconUrl);
}

function excelIconHtml() {
  return exportFormatImageIconHtml(excelIconUrl);
}

function exportFormatImageIconHtml(src) {
  return `<img class="button-svg-icon export-format-icon" src="${src}" alt="" aria-hidden="true" draggable="false">`;
}

function csvCell(value) {
  const text = String(value ?? "").replace(/\r\n|\r|\n/g, "\n");
  return /[",\n]/.test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}

async function readImportObjects(file) {
  if (isCsvImportFile(file)) return readCsvObjects(file);
  if (isXlsxImportFile(file)) return readXlsxObjects(file);
  throw new Error("Select a .csv or .xlsx file exported from PMT.");
}

function isCsvImportFile(file) {
  return /\.csv$/i.test(file?.name || "") || /(^|\/)(csv|comma-separated-values)$/i.test(file?.type || "");
}

function isXlsxImportFile(file) {
  return /\.xlsx$/i.test(file?.name || "")
    || file?.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}

async function readCsvObjects(file) {
  const rows = parseCsvRows((await file.text()).replace(/^\uFEFF/, ""));
  if (!rows.length) return [];

  const headers = rows[0].map(header => String(header || "").trim());
  return rows.slice(1)
    .filter(row => row.some(value => String(value ?? "").trim()))
    .map(row => {
      const record = {};
      headers.forEach((header, index) => {
        if (header) record[header] = row[index] ?? "";
      });
      return record;
    });
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
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

function splitImportList(value) {
  return String(value || "")
    .split(/[;,]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function normalizeImportCode(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeImportItemType(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  if (text.includes("bug")) return "Bug";
  if (text.includes("dev") || text.includes("task")) return "Dev";
  return text;
}

function importItemTypeLabel(type) {
  if (type === "Dev") return "Dev Task";
  if (type === "Bug") return "Bug";
  return type;
}

function importWorkbookScreenLabel(types) {
  const normalizedTypes = new Set(types);
  if (normalizedTypes.has("Dev") && normalizedTypes.has("Bug")) return "Backlog";
  if (normalizedTypes.has("Dev")) return "Dev Tasks";
  if (normalizedTypes.has("Bug")) return "Bug Tracking";
  return "";
}

function stableHash(value) {
  let hash = 2166136261;
  const text = String(value ?? "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
