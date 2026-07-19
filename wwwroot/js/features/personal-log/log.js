import { buttonContent, chartIconHtml, funnelIconHtml, iconButton, pageActionsMenuHtml } from "../../components/buttons.js?v=20260701-unified-dropdowns";
import {
  checkedFilterValues,
  filterCheckList
} from "../../components/filters.js";
import { initializeWindowedDialog } from "../../components/dialogs.js?v=20260706-dialog-persistence";
import { createIdleFilterHeader } from "../../components/idle-filter-header.js?v=20260717-multi-screen-search-persistent";
import {
  field,
  optionalNumberValue,
  richTextField,
  richValue,
  selectOptionsField,
  value
} from "../../components/forms.js?v=20260719-rte-insert-diagram";
import { sectionHead } from "../../components/sections.js?v=release-notes-2026-07-20-day-33-7a64f6e35b37";
import { createWorkItemTableMode } from "../../components/work-items.js?v=20260715-admin-impersonation";
import { currentUser } from "../../core/authentication.js?v=20260715-admin-impersonation";
import {
  preferenceKeys,
  readJsonPreference,
  readNumberPreference,
  removePreference,
  writeJsonPreference,
  writePreference
} from "../../core/preferences.js?v=20260707-log-screen";
import { state } from "../../core/store.js";
import {
  dateKey,
  formatDate,
  formatDateTime
} from "../../shared/dates.js";
import { normalizeSavedArray } from "../../shared/filter-values.js";
import { canAccessResource } from "../../shared/security.js?v=20260715-admin-impersonation";
import {
  projectName,
  userById
} from "../../shared/selectors.js";
import {
  escapeAttr,
  escapeHtml
} from "../../shared/text-and-links.js";
import {
  downloadCsv,
  downloadXlsx,
  exportFileName,
  exportIconHtml,
  importCell,
  importCellExists,
  importIconHtml,
  openExcelImport,
  openExportDialog,
  showImportResultDialog
} from "../../shared/table-export.js?v=20260715-save-collision";

const personalLogType = "Log";
const logTableColumnPreferenceKey = "pmt-log-table-columns";
const fallbackLogCategories = ["General", "Knowledge", "Notes"];
const logCategoryLookupType = "LogCategory";

export function createLogFeature({
  app,
  deleteItem,
  deleteItems,
  loadState,
  openEditor,
  render,
  saveJson,
  showReadOnlyDialog,
  showToast
}) {
  let logFilters = normalizeLogFilters(readJsonPreference(preferenceKeys.logFilters, {}));
  let logEntryProjectId = readNumberPreference(preferenceKeys.logEntryProject, 0);
  let logColumnPrefs = normalizeLogColumnPrefs(readJsonPreference(logTableColumnPreferenceKey, {}));
  let logColumnDrag = null;
  let lastLogColumnPointerDragAt = 0;
  let suppressNextLogColumnClick = false;
  let logBulkDeleteBusy = false;
  const selectedLogDeleteIds = new Set();
  const logTableMode = createWorkItemTableMode({
    action: "toggle-log-table-edit-mode",
    itemLabel: "Log"
  });
  const logHeader = createIdleFilterHeader({
    app,
    screenSelector: ".log-screen",
    searchFilter: "log-search",
    onSearchInput(search, { commit, render: shouldRender }) {
      logFilters.search = search;
      if (commit) writeJsonPreference(preferenceKeys.logFilters, logFilters);
      if (shouldRender) renderDevLogs();
      return true;
    }
  });

  bindLogColumnDragEvents();

  function renderDevLogs() {
    if (logFilters.projectId && !state.projects.some(project => project.id === Number(logFilters.projectId))) {
      logFilters.projectId = "";
    }

    const logs = state.devLogs
      .filter(isPersonalLog)
      .filter(log => !logFilters.projectId || log.projectId === Number(logFilters.projectId))
      .filter(log => !logFilters.logDate || dateKey(log.logDate) === logFilters.logDate)
      .filter(logMatchesCategoryFilter)
      .filter(logMatchesSearchFilter)
      .sort(logSortCompare);
    pruneLogDeleteSelection(logs);
    const visibleLogColumns = logVisibleTableColumns();
    const emptyTableColspan = visibleLogColumns.length + (logTableMode.active ? 1 : 0);

    app.innerHTML = `
      <section class="log-screen work-item-screen idle-filter-header-screen">
        ${sectionHead("Log", `
          ${logHeader.controlsHtml(logHeaderFields())}
          ${logHeader.searchHtml(logFilters.search, "Search Log")}
          <button class="primary text-icon-button" type="button" data-action="new-personal-log" data-idle-filter-header-add-target title="New Log" aria-label="New Log">${buttonContent("&#10010;", "New Log")}</button>
          <button class="secondary text-icon-button" type="button" data-action="open-log-filters" title="Filters" aria-label="Filters" aria-haspopup="dialog">${buttonContent(funnelIconHtml(), "Filters")}</button>
          ${pageActionsMenuHtml([
            { action: "toggle-log-table-edit-mode", icon: "&#9998;", label: "Edit Mode", title: "Edit Mode", checked: logTableMode.active },
            { icon: chartIconHtml(), label: "Graphs", title: "Graphs", disabled: true, separatorBefore: true },
            { action: "export-log-view", icon: exportIconHtml(), label: "Export", title: "Export", separatorBefore: true },
            { action: "import-log-view", icon: importIconHtml(), label: "Import", title: "Import" },
            { action: "reset-log-view", icon: "&#8634;", label: "Reset View", title: "Reset View", separatorBefore: true }
          ])}
        `)}
        <div class="panel work-item-table-panel log-table-panel">
          <div class="log-table-wrap">
            <table class="table work-item-table log-table ${logTableMode.active ? "is-edit-mode" : "is-read-mode"}" style="--log-table-min-width:${logTableMinWidth(visibleLogColumns)}px">
              <colgroup>
                ${visibleLogColumns.map((column, index) => logTableColumnColHtml(column, logColumnIsRubber(visibleLogColumns, index))).join("")}
                ${logTableMode.active ? `<col class="log-action-column">` : ""}
              </colgroup>
              <thead>
                <tr>
                  ${visibleLogColumns.map((column, index) => logColumnHeaderHtml(column, logColumnIsRubber(visibleLogColumns, index))).join("")}
                  ${logTableMode.active ? `<th class="action-cell" aria-label="Actions"></th>` : ""}
                </tr>
              </thead>
              <tbody>
                ${logs.map(log => logRowHtml(log, visibleLogColumns)).join("") || `<tr><td colspan="${emptyTableColspan}"><div class="empty">No Log entries match the current filters.</div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    `;

    logHeader.bind();
    bindLogDeleteSelection();
  }

  function logHeaderFields() {
    const project = state.projects.find(item => item.id === Number(logFilters.projectId || 0));
    const summary = project ? `${project.code} - ${project.title}` : "All Projects";

    return [{
      key: "project",
      filter: "log-project",
      label: "Project",
      optionsHtml: logProjectOptionsHtml(),
      summary,
      summaryTitle: summary
    }];
  }

  function logProjectOptionsHtml() {
    return `
      <option value="" ${!logFilters.projectId ? "selected" : ""}>All Projects</option>
      ${state.projects.map(project => `<option value="${project.id}" ${String(project.id) === String(logFilters.projectId || "") ? "selected" : ""}>${escapeHtml(project.code)} - ${escapeHtml(project.title)}</option>`).join("")}
    `;
  }

  function logRowHtml(log, visibleColumns) {
    const editable = canModifyLogLog(log);

    return `
      <tr class="log-row clickable-row" data-action="view-personal-log" data-id="${log.id}">
        ${visibleColumns.map((column, index) => logTableColumnCellHtml(column, log, logColumnIsRubber(visibleColumns, index))).join("")}
        ${logTableMode.active ? `
          <td class="reveal-actions action-cell log-actions" data-label="Actions">
            ${editable ? `
              <div class="log-row-actions">
                ${logDeleteSelectionHtml(log)}
                ${iconButton("delete-personal-log", log.id, "Delete", "delete-monochrome", logCanDelete(log))}
                ${iconButton("duplicate-personal-log", log.id, "Duplicate", "duplicate")}
                ${iconButton("edit-personal-log", log.id, "Edit", "edit")}
              </div>
            ` : ""}
          </td>
        ` : ""}
      </tr>
    `;
  }

  function canModifyLogLog(log) {
    return isPersonalLog(log);
  }

  function logDeleteSelectionHtml(log) {
    const checked = selectedLogDeleteIds.has(log.id);
    const label = `Select ${formatDate(log.logDate)} Log entry for bulk delete`;

    return `
      <label class="log-delete-selection" title="${escapeAttr(label)}">
        <input type="checkbox" data-log-delete-select data-id="${log.id}" aria-label="${escapeAttr(label)}" ${checked ? "checked" : ""} ${logCanDelete(log) && !logBulkDeleteBusy ? "" : "disabled"}>
      </label>
    `;
  }

  function bindLogDeleteSelection() {
    app.querySelectorAll("[data-log-delete-select]").forEach(input => {
      input.addEventListener("change", () => {
        if (logBulkDeleteBusy) return;
        const id = Number(input.dataset.id || 0);
        if (!id) return;

        if (input.checked) {
          selectedLogDeleteIds.add(id);
        } else {
          selectedLogDeleteIds.delete(id);
        }
        syncLogDeleteSelectionControls();
      });
    });

    syncLogDeleteSelectionControls();
  }

  function syncLogDeleteSelectionControls() {
    const selectedTitle = logSelectedDeleteTitle();

    app.querySelectorAll("[data-log-delete-select]").forEach(input => {
      const id = Number(input.dataset.id || 0);
      const log = state.devLogs.find(item => item.id === id && isPersonalLog(item));
      input.checked = selectedLogDeleteIds.has(id);
      input.disabled = logBulkDeleteBusy || !logCanDelete(log);
    });

    app.querySelectorAll(".log-table .log-row [data-action='delete-personal-log']").forEach(button => {
      const id = Number(button.dataset.id || 0);
      const log = state.devLogs.find(item => item.id === id && isPersonalLog(item));
      const title = selectedLogDeleteIds.has(id) ? selectedTitle : "Delete";
      button.disabled = logBulkDeleteBusy || !logCanDelete(log);
      button.title = title;
      button.setAttribute("aria-label", title);
    });
  }

  function pruneLogDeleteSelection(logs) {
    if (!logTableMode.active) {
      selectedLogDeleteIds.clear();
      return;
    }

    const visibleIds = new Set(logs.filter(logCanDelete).map(log => log.id));
    [...selectedLogDeleteIds].forEach(id => {
      if (!visibleIds.has(id)) selectedLogDeleteIds.delete(id);
    });
  }

  function logCanDelete(log) {
    return Boolean(log)
      && isPersonalLog(log)
      && canAccessResource("PersonalLog", "Delete");
  }

  function logSelectedDeleteTitle(count = selectedLogDeleteIds.size) {
    return count === 1
      ? "Delete selected Log entry"
      : `Delete ${count} selected Log entries`;
  }

  async function deleteSelectedLogs() {
    const logs = [...selectedLogDeleteIds]
      .map(id => state.devLogs.find(item => item.id === id && isPersonalLog(item)))
      .filter(logCanDelete);
    if (!logs.length) return;

    const count = logs.length;
    logBulkDeleteBusy = true;
    syncLogDeleteSelectionControls();
    try {
      await deleteItems(
        logs.map(log => `/api/devlogs/${log.id}`),
        `${logSelectedDeleteTitle(count)}?`,
        `${count} Log entr${count === 1 ? "y" : "ies"} deleted.`
      );
    } finally {
      logBulkDeleteBusy = false;
      syncLogDeleteSelectionControls();
    }
  }

  function isPersonalLog(log) {
    return (log?.logType || "") === personalLogType
      && Number(log?.userId || 0) === Number(currentUser().id || 0);
  }

  function logTableColumnDefinitions() {
    return [
      {
        key: "person",
        label: "Person",
        colClass: "log-person-column",
        cellClass: "log-person-cell",
        width: 180,
        defaultVisible: true,
        cellHtml: log => logPersonHtml(log)
      },
      {
        key: "date",
        label: "Date",
        colClass: "log-date-column",
        cellClass: "log-date",
        width: 112,
        defaultVisible: true,
        cellHtml: log => escapeHtml(formatDate(log.logDate))
      },
      {
        key: "project",
        label: "Project",
        colClass: "log-project-column",
        cellClass: "log-project",
        width: 220,
        defaultVisible: true,
        cellHtml: log => log.projectId ? escapeHtml(projectName(log.projectId)) : `<span class="muted">No project</span>`
      },
      {
        key: "category",
        label: "Category",
        colClass: "log-category-column",
        cellClass: "log-category",
        width: 140,
        defaultVisible: true,
        cellHtml: log => `<span class="pill log-category-pill">${escapeHtml(logCategory(log))}</span>`
      },
      {
        key: "log",
        label: "Log",
        colClass: "log-body-column",
        cellClass: "log-body",
        width: 420,
        rubberMinWidth: 260,
        defaultVisible: true,
        cellHtml: log => logListBodyHtml(log)
      },
      {
        key: "flag",
        label: "Flag",
        colClass: "log-flag-column",
        cellClass: "log-flag",
        width: 90,
        defaultVisible: true,
        cellHtml: log => log.isPinned ? `<span class="pill log-pin">Pinned</span>` : ""
      },
      {
        key: "createdAt",
        label: "Created Date/Time",
        colClass: "log-date-time-column",
        cellClass: "log-date",
        width: 156,
        rubberMinWidth: 124,
        cellHtml: log => escapeHtml(formatDateTime(log.createdAt))
      },
      {
        key: "updatedAt",
        label: "Last Updated Date/Time",
        colClass: "log-date-time-column",
        cellClass: "log-date",
        width: 156,
        rubberMinWidth: 124,
        cellHtml: log => escapeHtml(formatDateTime(log.updatedAt))
      }
    ];
  }

  function logPersonHtml(log) {
    const user = userById(log.userId);
    return `
      <div class="row log-person">
        <img class="avatar" src="${escapeAttr(user?.avatarUrl || "/assets/avatar-default.svg")}" alt="">
        <strong>${escapeHtml(user?.nickname || "User")}</strong>
      </div>
    `;
  }

  function logListBodyHtml(log) {
    return `
      <div class="log-content" ${devLogRichPersistAttrs(log)}>${log.bodyHtml}</div>
      <div class="log-entry-meta">${escapeHtml(logAuditSummary(log))}</div>
    `;
  }

  function logAuditSummary(log) {
    const created = formatDateTime(log.createdAt);
    const updated = formatDateTime(log.updatedAt);
    if (updated && logTimeValue(log.updatedAt) > logTimeValue(log.createdAt)) {
      return `Created ${created} | Last edited ${updated}`;
    }
    return `Created ${created}`;
  }

  function logUserName(userId) {
    const user = userId ? userById(Number(userId)) : null;
    return user?.nickname || [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  }

  function logColumnFilterItems() {
    return logOrderedTableColumns()
      .map(column => ({ value: column.key, text: column.label }));
  }

  function logCategoryFilterItems() {
    const values = new Set(logCategoryOptions());
    state.devLogs
      .filter(isPersonalLog)
      .forEach(log => values.add(logCategory(log)));

    return [...values]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
      .map(category => ({ value: category, text: category }));
  }

  function logCategoryOptions(currentValue = "") {
    const values = (state.lookups || [])
      .filter(item => item.lookupType === logCategoryLookupType && item.isActive)
      .sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0) || a.value.localeCompare(b.value))
      .map(item => item.value)
      .filter(Boolean);
    const categories = values.length ? values : fallbackLogCategories;
    const uniqueCategories = [...new Set(categories)];
    if (currentValue && !uniqueCategories.includes(currentValue)) uniqueCategories.push(currentValue);
    return uniqueCategories;
  }

  function logCategory(log = {}) {
    return String(log.category || fallbackLogCategories[0]).trim() || fallbackLogCategories[0];
  }

  function logTableColumnColHtml(column, isRubber = false) {
    const className = [column.colClass, isRubber ? "log-rubber-column" : ""]
      .filter(Boolean)
      .join(" ");

    return `<col class="${escapeAttr(className)}">`;
  }

  function logTableColumnCellHtml(column, log, isRubber = false) {
    const className = [column.cellClass || "", isRubber ? "log-rubber-cell" : ""]
      .filter(Boolean)
      .join(" ");

    return `<td class="${escapeAttr(className)}" data-label="${escapeAttr(column.label)}">${column.cellHtml(log)}</td>`;
  }

  function logColumnHeaderHtml(column, isRubber = false) {
    const className = [column.headerClass || "", isRubber ? "log-rubber-cell" : ""]
      .filter(Boolean)
      .join(" ");

    return logSortHeaderHtml(column.key, column.label, className, {
      draggable: logTableMode.active
    });
  }

  function logVisibleTableColumns() {
    const visibleKeys = new Set(logColumnPrefs.visible);
    const columns = logOrderedTableColumns()
      .filter(column => visibleKeys.has(column.key));

    return columns.length
      ? columns
      : logTableColumnDefinitions().filter(column => column.key === "log");
  }

  function logOrderedTableColumns() {
    const definitions = logTableColumnDefinitions();
    const columnsByKey = new Map(definitions.map(column => [column.key, column]));

    return normalizedLogColumnOrder(logColumnPrefs.order)
      .map(key => columnsByKey.get(key))
      .filter(Boolean);
  }

  function logTableMinWidth(columns) {
    const fixedWidth = logTableMode.active ? 216 : 0;
    const lastColumnIndex = columns.length - 1;
    const columnsWidth = columns.reduce((total, column, index) =>
      total + logColumnMinimumWidth(column, index === lastColumnIndex), 0);
    return Math.max(960, fixedWidth + columnsWidth);
  }

  function logColumnMinimumWidth(column, isRubber) {
    if (isRubber) return column.rubberMinWidth || Math.min(column.width || 140, 140);
    return column.width || 140;
  }

  function logColumnIsRubber(columns, index) {
    return index === columns.length - 1;
  }

  function normalizeLogColumnPrefs(preferences = {}) {
    const savedPreferences = preferences && typeof preferences === "object" && !Array.isArray(preferences)
      ? preferences
      : {};
    const visibleKeys = normalizeSavedArray(savedPreferences.visible)
      .filter(key => logColumnKeySet().has(key));
    const defaultVisibleKeys = logDefaultVisibleColumnKeys();

    return {
      order: normalizedLogColumnOrder(savedPreferences.order),
      visible: visibleKeys.length
        ? [...visibleKeys, ...defaultVisibleKeys.filter(key => !visibleKeys.includes(key))]
        : defaultVisibleKeys
    };
  }

  function normalizedLogColumnOrder(order = []) {
    const allowedKeys = logColumnKeySet();
    const orderedKeys = normalizeSavedArray(order)
      .filter(key => allowedKeys.has(key));

    logTableColumnDefinitions().forEach(column => {
      if (!orderedKeys.includes(column.key)) orderedKeys.push(column.key);
    });

    return orderedKeys;
  }

  function logColumnOrderWithAddedColumns(order, addedColumns) {
    const orderedKeys = normalizedLogColumnOrder(order);

    addedColumns
      .filter(column => logColumnKeySet().has(column))
      .forEach(column => {
        const existingIndex = orderedKeys.indexOf(column);
        if (existingIndex >= 0) orderedKeys.splice(existingIndex, 1);
        orderedKeys.push(column);
      });

    return orderedKeys;
  }

  function logColumnKeySet() {
    return new Set(logTableColumnDefinitions().map(column => column.key));
  }

  function logDefaultVisibleColumnKeys() {
    return logTableColumnDefinitions()
      .filter(column => column.defaultVisible)
      .map(column => column.key);
  }

  function saveLogColumnPrefs() {
    writeJsonPreference(logTableColumnPreferenceKey, logColumnPrefs);
  }

  function bindLogColumnDragEvents() {
    app.addEventListener("pointerdown", handleLogColumnPointerDown);
    app.addEventListener("mousedown", handleLogColumnMouseDown);
    app.addEventListener("click", suppressLogColumnDraggedClick, true);
  }

  function handleLogColumnPointerDown(event) {
    lastLogColumnPointerDragAt = Date.now();
    startLogColumnDrag(event, "pointer");
  }

  function handleLogColumnMouseDown(event) {
    if (Date.now() - lastLogColumnPointerDragAt < 500) return;
    startLogColumnDrag(event, "mouse");
  }

  function startLogColumnDrag(event, inputType) {
    if (event.button !== 0) return;
    if (!logTableMode.active) return;

    const header = event.target.closest('.log-table th[data-log-column][data-column-draggable="true"]');
    const table = header?.closest(".log-table");
    if (!header || !table || !app.contains(header)) return;

    const columnKey = header.dataset.logColumn || "";
    if (!logColumnPrefs.visible.includes(columnKey)) return;

    logColumnDrag = {
      columnKey,
      source: header,
      table,
      startX: event.clientX,
      startY: event.clientY,
      started: false,
      inputType,
      pointerId: event.pointerId
    };

    if (inputType === "pointer" && header.setPointerCapture && event.pointerId !== undefined) {
      try {
        header.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is optional; window listeners still finish the drag.
      }
    }

    if (inputType === "pointer") {
      window.addEventListener("pointermove", handleLogColumnPointerMove);
      window.addEventListener("pointerup", handleLogColumnPointerUp, { once: true });
      window.addEventListener("pointercancel", cancelLogColumnDrag, { once: true });
    } else {
      window.addEventListener("mousemove", handleLogColumnMouseMove);
      window.addEventListener("mouseup", handleLogColumnMouseUp, { once: true });
    }
  }

  function handleLogColumnPointerMove(event) {
    lastLogColumnPointerDragAt = Date.now();
    moveLogColumnDrag(event);
  }

  function handleLogColumnMouseMove(event) {
    if (logColumnDrag?.inputType === "pointer") return;
    moveLogColumnDrag(event);
  }

  function moveLogColumnDrag(event) {
    if (!logColumnDrag) return;

    const movedEnough = Math.hypot(event.clientX - logColumnDrag.startX, event.clientY - logColumnDrag.startY) > 5;
    if (!logColumnDrag.started && !movedEnough) return;

    if (!logColumnDrag.started) {
      logColumnDrag.started = true;
      suppressNextLogColumnClick = true;
      logColumnDrag.source.classList.add("column-dragging");
      logColumnDrag.table.classList.add("is-column-dragging");
    }

    event.preventDefault();
    updateLogColumnDropIndicator(event.clientX, event.clientY);
  }

  function handleLogColumnPointerUp(event) {
    lastLogColumnPointerDragAt = Date.now();
    finishLogColumnDrag(event);
  }

  function handleLogColumnMouseUp(event) {
    if (logColumnDrag?.inputType === "pointer") return;
    finishLogColumnDrag(event);
  }

  function finishLogColumnDrag(event) {
    if (!logColumnDrag || logColumnDrag.finishing) return;
    logColumnDrag.finishing = true;

    if (!logColumnDrag.started) {
      cancelLogColumnDrag();
      return;
    }

    event.preventDefault();
    suppressNextLogColumnClick = true;

    const drag = logColumnDrag;
    const drop = logColumnDropTarget(event.clientX, event.clientY);
    if (drop) {
      const order = logColumnKeysAfterDrop(drag.columnKey, drop.target.dataset.logColumn || "", drop.placement);
      if (logColumnOrderChanged(order)) {
        logColumnPrefs = normalizeLogColumnPrefs({ ...logColumnPrefs, order });
        saveLogColumnPrefs();
        cancelLogColumnDrag();
        renderDevLogs();
        return;
      }
    }

    cancelLogColumnDrag();
  }

  function logColumnDropTarget(clientX, clientY) {
    if (!logColumnDrag) return null;

    const headerRow = logColumnDrag.table.querySelector("thead tr");
    const headerRect = headerRow?.getBoundingClientRect();
    if (!headerRect || clientY < headerRect.top - 32 || clientY > headerRect.bottom + 64) return null;

    const headers = [...logColumnDrag.table.querySelectorAll('thead th[data-log-column][data-column-draggable="true"]')]
      .filter(header => (header.dataset.logColumn || "") !== logColumnDrag.columnKey);
    if (!headers.length) return null;

    const firstRect = headers[0].getBoundingClientRect();
    if (clientX <= firstRect.left + (firstRect.width / 2)) {
      return { target: headers[0], placement: "before" };
    }

    for (const header of headers) {
      const rect = header.getBoundingClientRect();
      if (clientX < rect.left + (rect.width / 2)) {
        return { target: header, placement: "before" };
      }
    }

    return { target: headers[headers.length - 1], placement: "after" };
  }

  function updateLogColumnDropIndicator(clientX, clientY) {
    clearLogColumnDropIndicators();

    const drop = logColumnDropTarget(clientX, clientY);
    if (!drop) return;

    logColumnDrag.table.classList.add("column-drop-target");
    drop.target.classList.add(drop.placement === "after" ? "column-reorder-after" : "column-reorder-before");
  }

  function logColumnKeysAfterDrop(draggedKey, targetKey, placement) {
    const orderedKeys = normalizedLogColumnOrder(logColumnPrefs.order)
      .filter(key => key !== draggedKey);
    let insertIndex = orderedKeys.indexOf(targetKey);
    if (insertIndex < 0) return normalizedLogColumnOrder(logColumnPrefs.order);
    if (placement === "after") insertIndex += 1;
    orderedKeys.splice(insertIndex, 0, draggedKey);
    return orderedKeys;
  }

  function logColumnOrderChanged(order) {
    const currentOrder = normalizedLogColumnOrder(logColumnPrefs.order);
    return order.length !== currentOrder.length || order.some((key, index) => key !== currentOrder[index]);
  }

  function cancelLogColumnDrag() {
    window.removeEventListener("pointermove", handleLogColumnPointerMove);
    window.removeEventListener("mousemove", handleLogColumnMouseMove);
    window.removeEventListener("pointerup", handleLogColumnPointerUp);
    window.removeEventListener("mouseup", handleLogColumnMouseUp);
    window.removeEventListener("pointercancel", cancelLogColumnDrag);

    if (logColumnDrag?.inputType === "pointer" && logColumnDrag.source.releasePointerCapture && logColumnDrag.pointerId !== undefined) {
      try {
        logColumnDrag.source.releasePointerCapture(logColumnDrag.pointerId);
      } catch {
        // The browser may already have released pointer capture.
      }
    }

    logColumnDrag = null;
    app.querySelectorAll(".column-dragging, .is-column-dragging, .column-drop-target, .column-reorder-before, .column-reorder-after")
      .forEach(item => item.classList.remove(
        "column-dragging",
        "is-column-dragging",
        "column-drop-target",
        "column-reorder-before",
        "column-reorder-after"
      ));
  }

  function clearLogColumnDropIndicators() {
    app.querySelectorAll(".column-drop-target, .column-reorder-before, .column-reorder-after")
      .forEach(item => item.classList.remove("column-drop-target", "column-reorder-before", "column-reorder-after"));
  }

  function suppressLogColumnDraggedClick(event) {
    if (!suppressNextLogColumnClick) return;
    suppressNextLogColumnClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function handleFilterChange(eventOrTarget) {
    const target = eventOrTarget?.target || eventOrTarget;
    if (!applyLogFilterChange(target)) return false;

    renderDevLogs();
    return true;
  }

  function applyLogFilterChange(target) {
    const filter = target?.dataset?.filter;
    if (!filter?.startsWith("log-")) return false;

    if (filter === "log-project") logFilters.projectId = target.value;
    if (filter === "log-date") logFilters.logDate = target.value;
    if (filter === "log-search") logFilters.search = target.value;
    if (filter === "log-sort") logFilters.sort = target.value;
    if (filter === "log-category") logFilters.categories = checkedFilterValues("log-category");
    if (filter === "log-column") {
      const visibleColumns = checkedFilterValues("log-column");
      if (!visibleColumns.length) {
        target.checked = true;
        return false;
      }
      const addedColumns = visibleColumns.filter(column => !logColumnPrefs.visible.includes(column));
      logColumnPrefs = normalizeLogColumnPrefs({
        ...logColumnPrefs,
        order: logColumnOrderWithAddedColumns(logColumnPrefs.order, addedColumns),
        visible: visibleColumns
      });
      saveLogColumnPrefs();
    }

    if (filter !== "log-column") writeJsonPreference(preferenceKeys.logFilters, logFilters);
    return true;
  }

  async function handleAction(action, id, element) {
    const log = id ? state.devLogs.find(item => item.id === id && isPersonalLog(item)) : null;

    if (action === "new-personal-log") {
      editDevLog();
      return true;
    }
    if (action === "toggle-log-table-edit-mode") {
      logTableMode.toggle();
      selectedLogDeleteIds.clear();
      renderDevLogs();
      return true;
    }
    if (action === "sort-log-table") {
      return updateLogTableSort(element);
    }
    if (action === "reset-log-view") {
      resetLogView();
      return true;
    }
    if (action === "open-log-filters" || action === "toggle-log-filters") {
      openLogFiltersDialog();
      return true;
    }
    if (action === "export-log-view") {
      openLogExportDialog();
      return true;
    }
    if (action === "import-log-view") {
      openLogImport();
      return true;
    }
    if (action === "view-personal-log") {
      if (log && canModifyLogLog(log)) editDevLog(log);
      else viewDevLog(log);
      return true;
    }
    if (action === "edit-personal-log") {
      if (log && canModifyLogLog(log)) editDevLog(log);
      else viewDevLog(log);
      return true;
    }
    if (action === "duplicate-personal-log") {
      if (log && canModifyLogLog(log)) {
        await duplicateDevLog(id);
      }
      return true;
    }
    if (action === "delete-personal-log") {
      if (log && canModifyLogLog(log)) {
        if (selectedLogDeleteIds.has(id)) {
          await deleteSelectedLogs();
        } else {
          await deleteItem(`/api/devlogs/${id}`, "Delete this Log entry?");
        }
      }
      return true;
    }

    return false;
  }

  function openLogFiltersDialog() {
    const existingDialog = document.querySelector("[data-log-filter-dialog]");
    if (existingDialog) {
      if (!existingDialog.open) existingDialog.showModal?.();
      existingDialog.querySelector("[data-filter='log-search']")?.focus({ preventScroll: true });
      return;
    }

    const modal = document.createElement("dialog");
    modal.className = "dialog task-filter-dialog log-filter-dialog";
    modal.dataset.logFilterDialog = "true";
    modal.innerHTML = `
      <form method="dialog">
        <div class="dialog-head">
          <h2>Log Filters</h2>
          <button type="button" class="icon-btn" data-close-log-filters title="Close" aria-label="Close">x</button>
        </div>
        <div class="dialog-body task-filter-dialog-body log-filter-dialog-body" data-log-filter-dialog-body></div>
        <div class="dialog-actions">
          <button type="button" class="primary text-icon-button" data-close-log-filters>${buttonContent("&#10003;", "Done")}</button>
        </div>
      </form>
    `;

    renderLogFiltersDialog(modal);
    document.body.appendChild(modal);
    initializeWindowedDialog(modal);
    modal.addEventListener("input", event => {
      if (!applyLogFilterChange(event.target)) return;
      renderDevLogs();
    });
    modal.addEventListener("change", event => {
      if (!applyLogFilterChange(event.target)) return;
      renderDevLogs();
    });
    modal.addEventListener("click", event => {
      if (event.target.closest("[data-close-log-filters]")) modal.close();
    });
    modal.addEventListener("close", () => modal.remove());
    modal.showModal();
    modal.querySelector("[data-filter='log-search']")?.focus({ preventScroll: true });
  }

  function renderLogFiltersDialog(modal) {
    const body = modal.querySelector("[data-log-filter-dialog-body]");
    if (!body) return;

    body.innerHTML = `
      <div class="tasks-filter-panel log-filter-fields">
        <div class="task-filter-row log-filter-row">
          <label>
            <span>Project</span>
            <select data-filter="log-project">
              ${logProjectOptionsHtml()}
            </select>
          </label>
          <label>
            <span>Search</span>
            <input type="text" data-filter="log-search" value="${escapeAttr(logFilters.search)}">
          </label>
          <label>
            <span>Date</span>
            <input type="date" data-filter="log-date" value="${escapeAttr(logFilters.logDate || "")}">
          </label>
          <label>
            <span>Sort</span>
            <select data-filter="log-sort">
              ${logSortOptionsHtml()}
            </select>
          </label>
        </div>
        <div class="filter-stack">
          ${filterCheckList("Categories", "log-category", logCategoryFilterItems(), logFilters.categories)}
          ${filterCheckList("Columns", "log-column", logColumnFilterItems(), logColumnPrefs.visible)}
        </div>
      </div>
    `;
  }

  function editDevLog(log = {}) {
    if (log.id && !canModifyLogLog(log)) {
      viewDevLog(log);
      return;
    }

    const rememberedProjectId = state.projects.some(project => project.id === logEntryProjectId)
      ? logEntryProjectId
      : 0;
    const selectedProjectId = log.id ? log.projectId || "" : rememberedProjectId || "";
    const selectedLogDate = logDateInputValue(log.logDate || new Date());
    const selectedCategory = logCategory(log);
    const logHtml = log.bodyHtml || "";

    openEditor(logDialogTitle(log, "New Log"), `
      <div class="form-grid log-editor-grid">
        ${field("Date", "logDate", selectedLogDate, "date", "", "", "", { required: true })}
        ${selectOptionsField("Project", "projectId", [{ id: "", title: "No project" }, ...state.projects.map(project => ({ id: project.id, title: `${project.code} - ${project.title}` }))], selectedProjectId)}
        ${selectOptionsField("Category", "category", logCategoryOptions(selectedCategory).map(category => ({ id: category, title: category })), selectedCategory)}
        ${richTextField("bodyHtml", "Log", logHtml, { required: true })}
        <label class="inline-check field full"><input name="isPinned" type="checkbox" ${log.isPinned ? "checked" : ""} ${currentUser().isAdmin ? "" : "disabled"}><span>Pinned</span></label>
      </div>
    `, async root => {
      const projectId = optionalNumberValue(root, "projectId");
      logEntryProjectId = projectId || 0;
      writePreference(preferenceKeys.logEntryProject, logEntryProjectId);

      const logDate = value(root, "logDate");
      const dateError = logDateValidationMessage(logDate);
      if (dateError) throw new Error(dateError);
      const bodyHtml = richValue(root, "bodyHtml");

      await saveJson(log.id ? `/api/devlogs/${log.id}` : "/api/devlogs", log.id ? "PUT" : "POST", {
        id: log.id || 0,
        logType: personalLogType,
        category: value(root, "category") || fallbackLogCategories[0],
        projectId,
        logDate,
        bodyHtml,
        isPinned: root.querySelector("[name='isPinned']").checked,
        expectedRowVersion: log.id ? log.rowVersion || null : undefined
      }, {
        saveAsNew: true,
        canCreate: canAccessResource("PersonalLog", "Create"),
        createPath: "/api/devlogs"
      });
    }, log.id ? "" : "bodyHtml");
  }

  function normalizeLogFilters(filters = {}) {
    return {
      ...filters,
      personIds: [],
      categories: normalizeSavedArray(filters.categories),
      sort: filters.sort || "custom",
      search: String(filters.search || "")
    };
  }

  function logMatchesCategoryFilter(log) {
    return !logFilters.categories.length || logFilters.categories.includes(logCategory(log));
  }

  function logMatchesSearchFilter(log) {
    const term = String(logFilters.search || "").trim().toLowerCase();
    if (!term) return true;

    return logSearchValues(log)
      .map(item => String(item ?? "").toLowerCase())
      .some(item => item.includes(term));
  }

  function logSearchValues(log) {
    const user = userById(log.userId);
    return [
      user?.nickname,
      [user?.firstName, user?.lastName].filter(Boolean).join(" "),
      user?.email,
      projectName(log.projectId),
      logCategory(log),
      formatDate(log.logDate),
      logDateInputValue(log.logDate),
      textFromHtml(log.bodyHtml || ""),
      log.isPinned ? "Pinned" : "",
      formatDateTime(log.createdAt),
      formatDateTime(log.updatedAt)
    ];
  }

  function logSortCompare(a, b) {
    const pinnedResult = comparePinnedLog(a, b);
    if (pinnedResult) return pinnedResult;

    const state = logTableSortState();

    if (state.column && state.direction) {
      const result = compareLogSortColumn(a, b, state.column);
      if (result) return state.direction === "asc" ? result : -result;
      return defaultLogSortCompare(a, b);
    }

    if (logFilters.sort === "oldest") return logDateCompare(a, b);
    if (logFilters.sort === "newest") return logDateCompare(b, a);
    return defaultLogSortCompare(a, b);
  }

  function comparePinnedLog(a, b) {
    if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
      return Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
    }

    if (a.isPinned && b.isPinned) {
      return logCreatedCompare(b, a);
    }

    return 0;
  }

  function defaultLogSortCompare(a, b) {
    return logDateCompare(b, a);
  }

  function logDateCompare(a, b) {
    return logTimeValue(a.logDate) - logTimeValue(b.logDate)
      || logTimeValue(a.updatedAt) - logTimeValue(b.updatedAt)
      || a.id - b.id;
  }

  function logCreatedCompare(a, b) {
    return logTimeValue(a.createdAt) - logTimeValue(b.createdAt)
      || logTimeValue(a.updatedAt) - logTimeValue(b.updatedAt)
      || logTimeValue(a.logDate) - logTimeValue(b.logDate)
      || a.id - b.id;
  }

  function logTimeValue(value) {
    const time = new Date(value || 0).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  function compareLogSortColumn(a, b, column) {
    if (column === "date") return logDateCompare(a, b);
    if (column === "createdAt") return logTimeValue(a.createdAt) - logTimeValue(b.createdAt) || a.id - b.id;
    if (column === "updatedAt") return logTimeValue(a.updatedAt) - logTimeValue(b.updatedAt) || a.id - b.id;
    if (column === "flag") return Number(Boolean(a.isPinned)) - Number(Boolean(b.isPinned));

    return logSortTextValue(a, column).localeCompare(logSortTextValue(b, column), undefined, {
      numeric: true,
      sensitivity: "base"
    });
  }

  function logSortTextValue(log, column) {
    if (column === "project") return log.projectId ? projectName(log.projectId) : "No project";
    if (column === "person") return userById(log.userId)?.nickname || "";
    if (column === "category") return logCategory(log);
    if (column === "log") return textFromHtml(log.bodyHtml || "");
    return "";
  }

  function textFromHtml(html) {
    const container = document.createElement("div");
    container.innerHTML = html;
    return container.textContent || "";
  }

  function logSortHeaderHtml(column, label, className = "", options = {}) {
    const state = logTableSortState();
    const isSorted = state.column === column && Boolean(state.direction);
    const ariaSort = isSorted ? (state.direction === "asc" ? "ascending" : "descending") : "none";
    const arrow = isSorted ? (state.direction === "asc" ? "&#9650;" : "&#9660;") : "";
    const classes = [className, isSorted ? "is-sorted" : ""].filter(Boolean).join(" ");
    const columnDragAttrs = `
      data-log-column="${escapeAttr(column)}"
      data-column-draggable="${options.draggable ? "true" : "false"}"`;

    return `
      <th class="${classes}" aria-sort="${ariaSort}" ${columnDragAttrs}>
        <button type="button" class="table-sort-button" data-action="sort-log-table" data-column="${escapeAttr(column)}" title="${escapeAttr(logNextSortLabel(column, label))}">
          <span>${escapeHtml(label)}</span>
          <span class="table-sort-indicator" aria-hidden="true">${arrow}</span>
        </button>
      </th>
    `;
  }

  function updateLogTableSort(button) {
    const column = button?.dataset?.column || "";
    if (!logTableSortColumns().some(item => item.column === column)) return false;

    logFilters.sort = nextLogSort(column);
    writeJsonPreference(preferenceKeys.logFilters, logFilters);
    renderDevLogs();
    return true;
  }

  function nextLogSort(column) {
    const state = logTableSortState();
    if (state.column !== column || !state.direction) return `${column}-asc`;
    if (state.direction === "asc") return `${column}-desc`;
    return "custom";
  }

  function logTableSortState(sortValue = logFilters.sort) {
    const match = /^(.+)-(asc|desc)$/.exec(sortValue || "");
    if (!match) return { column: "", direction: "" };
    return { column: match[1], direction: match[2] };
  }

  function logSortOptionsHtml() {
    const selectedSort = logFilters.sort || "custom";
    const options = [
      { value: "custom", text: "Date Descending" },
      { value: "newest", text: "Newest Log" },
      { value: "oldest", text: "Oldest Log" },
      ...logTableSortColumns().flatMap(column => [
        { value: `${column.column}-asc`, text: `${column.label} Ascending` },
        { value: `${column.column}-desc`, text: `${column.label} Descending` }
      ])
    ];

    return options
      .map(option => `<option value="${escapeAttr(option.value)}" ${selectedSort === option.value ? "selected" : ""}>${escapeHtml(option.text)}</option>`)
      .join("");
  }

  function logTableSortColumns() {
    return logTableColumnDefinitions()
      .map(column => ({ column: column.key, label: column.label }));
  }

  function logNextSortLabel(column, label) {
    const state = logTableSortState();
    if (state.column === column && state.direction === "asc") return `Sort ${label} descending`;
    if (state.column === column && state.direction === "desc") return `Clear ${label} sort`;
    return `Sort ${label} ascending`;
  }

  function openLogExportDialog() {
    openExportDialog({
      title: "Export Log",
      onCsvExport: exportLogCsv,
      onExcelExport: exportLogExcel
    });
  }

  function exportLogCsv(options = {}) {
    const rows = logExportRows();
    const columns = logExportImportColumns(options);

    downloadCsv(exportFileName("pmt-log"), columns, rows);
  }

  function exportLogExcel(options = {}) {
    const rows = logExportRows();
    const columns = logExportImportColumns(options);

    downloadXlsx(exportFileName("pmt-log", "xlsx"), "Log", columns, rows);
  }

  function logExportRows() {
    return state.devLogs
      .filter(isPersonalLog)
      .filter(log => !logFilters.projectId || log.projectId === Number(logFilters.projectId))
      .filter(log => !logFilters.logDate || dateKey(log.logDate) === logFilters.logDate)
      .filter(logMatchesCategoryFilter)
      .filter(logMatchesSearchFilter)
      .sort(logSortCompare);
  }

  function logExportImportColumns(options = {}) {
    return [
      ...logExportColumns(logVisibleTableColumns()),
      ...(options.includeMetadata ? [
        { header: "PMT Log Id", value: log => log.id },
        { header: "PMT Log Owner User Id", value: log => log.userId },
        { header: "PMT Log Row Hash", value: log => logImportHash(log) },
        { header: "PMT Log Row Version", value: log => log.rowVersion || "" },
        { header: "PMT Update Date", value: log => logDateInputValue(log.logDate) },
        { header: "PMT Update Category", value: log => logCategory(log) },
        { header: "PMT Update Project Id", value: log => log.projectId || "" },
        { header: "PMT Update Log Html", value: log => log.bodyHtml || "" },
        { header: "PMT Update Pinned", value: log => log.isPinned ? "Yes" : "No" }
      ] : [])
    ];
  }

  function logExportColumns(visibleColumns) {
    return visibleColumns.map(column => ({
      header: column.label,
      value: log => logExportValue(column.key, log)
    }));
  }

  function logExportValue(columnKey, log) {
    if (columnKey === "person") return logUserName(log.userId);
    if (columnKey === "date") return logDateInputValue(log.logDate);
    if (columnKey === "project") return log.projectId ? projectName(log.projectId) : "";
    if (columnKey === "category") return logCategory(log);
    if (columnKey === "log") return textFromHtml(log.bodyHtml || "");
    if (columnKey === "flag") return log.isPinned ? "Pinned" : "";
    if (columnKey === "createdAt") return formatDateTime(log.createdAt);
    if (columnKey === "updatedAt") return formatDateTime(log.updatedAt);
    return "";
  }

  function openLogImport() {
    openExcelImport({
      onImport: importLogExcel,
      onError: error => showImportResultDialog({
        title: "Import Log",
        totalRows: 0,
        updatedRows: 0,
        errors: [{ rowNumber: "File", message: error.message }]
      })
    });
  }

  async function importLogExcel(records) {
    const errors = [];
    let updatedRows = 0;
    let createdRows = 0;

    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      const rowNumber = index + 2;
      try {
        const result = await importLogRecord(record);
        if (result === "updated") updatedRows += 1;
        if (result === "created") createdRows += 1;
      } catch (error) {
        const id = parseLogImportId(record);
        const log = id ? state.devLogs.find(item => item.id === id && isPersonalLog(item)) : null;
        errors.push({
          rowNumber,
          code: id ? `Log ${id}` : "",
          title: log ? [formatDate(log.logDate), logUserName(log.userId)].join(" - ") : "",
          message: error.message
        });
      }
    }

    if (updatedRows || createdRows) {
      await loadState();
      render();
    }
    showImportResultDialog({
      title: "Import Log",
      totalRows: records.length,
      updatedRows,
      createdRows,
      errors
    });
  }

  async function importLogRecord(record) {
    const log = state.devLogs.find(item => item.id === parseLogImportId(record) && isPersonalLog(item));
    if (!log) throw new Error("PMT Log Id does not match an existing row.");
    assertLogImportAllowed(log);
    assertLogImportHash(record, log);

    const projectId = parseLogImportProjectId(record, log);
    const logDate = parseLogImportDate(record, log);
    const category = parseLogImportCategory(record, log);
    const bodyHtml = parseLogImportBodyHtml(record, log);
    const isPinned = currentUser().isAdmin ? parseLogImportPinned(record, log) : log.isPinned;
    const dateError = logDateValidationMessage(logDate);
    if (dateError) throw new Error(dateError);
    if (!bodyHtml) throw new Error("Log text is required.");

    if (!logImportChanged(log, { projectId, logDate, category, bodyHtml, isPinned })) return "";

    const result = await saveJson(`/api/devlogs/${log.id}`, "PUT", {
      id: log.id,
      logType: personalLogType,
      category,
      projectId,
      logDate,
      bodyHtml,
      isPinned,
      auditContext: "Import",
      expectedRowVersion: importCell(record, "PMT Log Row Version").trim() || null
    }, {
      saveAsNew: true,
      canCreate: canAccessResource("PersonalLog", "Create"),
      createPath: "/api/devlogs"
    });
    return result?.__savedAsNew ? "created" : "updated";
  }

  function assertLogImportAllowed(log) {
    const user = currentUser();
    if (log.userId !== user.id) {
      throw new Error("You can only import updates for your own Log entries.");
    }
  }

  function assertLogImportHash(record, log) {
    const hash = importCell(record, "PMT Log Row Hash").trim();
    if (hash && hash !== logImportHash(log)) {
      throw new Error("This Log row is stale. Re-export the grid before importing this row.");
    }
  }

  function parseLogImportId(record) {
    const id = Number(importCell(record, "PMT Log Id", "Log Id").trim());
    return Number.isInteger(id) && id > 0 ? id : 0;
  }

  function parseLogImportProjectId(record, log) {
    if (!importCellExists(record, "PMT Update Project Id")) return log.projectId || null;

    const value = importCell(record, "PMT Update Project Id").trim();
    if (!value) return null;

    const projectId = Number(value);
    if (!Number.isInteger(projectId) || !state.projects.some(project => project.id === projectId)) {
      throw new Error(`Unknown project id "${value}".`);
    }
    return projectId;
  }

  function parseLogImportDate(record, log) {
    const value = importCell(record, "PMT Update Date", "Date").trim();
    const selectedDate = value || logDateInputValue(log.logDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      throw new Error("Log import dates must use YYYY-MM-DD.");
    }
    return selectedDate;
  }

  function parseLogImportCategory(record, log) {
    if (!importCellExists(record, "PMT Update Category")) return logCategory(log);

    const category = importCell(record, "PMT Update Category", "Category").trim() || fallbackLogCategories[0];
    if (!logCategoryOptions(logCategory(log)).includes(category)) {
      throw new Error(`Unknown Log category "${category}".`);
    }

    return category;
  }

  function parseLogImportBodyHtml(record, log) {
    if (!importCellExists(record, "PMT Update Log Html")) return log.bodyHtml || "";
    return importCell(record, "PMT Update Log Html").trim();
  }

  function parseLogImportPinned(record, log) {
    if (!importCellExists(record, "PMT Update Pinned")) return Boolean(log.isPinned);

    const value = importCell(record, "PMT Update Pinned", "Flag").trim().toLowerCase();
    return ["1", "true", "yes", "y", "pinned"].includes(value);
  }

  function logImportChanged(log, updates) {
    return Number(log.projectId || 0) !== Number(updates.projectId || 0)
      || logDateInputValue(log.logDate) !== updates.logDate
      || logCategory(log) !== updates.category
      || String(log.bodyHtml || "") !== String(updates.bodyHtml || "")
      || Boolean(log.isPinned) !== Boolean(updates.isPinned);
  }

  function logImportHash(log) {
    return stableHash([
      log?.id || "",
      log?.userId || "",
      logDateInputValue(log?.logDate),
      logCategory(log),
      log?.projectId || "",
      log?.bodyHtml || "",
      log?.isPinned ? "1" : "0"
    ].join("|"));
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

  function logDialogTitle(log, newTitle) {
    if (!log?.id) return newTitle;
    const user = userById(log.userId);
    return ["Log", formatDate(log.logDate), user?.nickname || "User"].join(" - ");
  }

  function viewDevLog(log) {
    if (!log) return;

    const user = userById(log.userId);
    showReadOnlyDialog(logDialogTitle(log, "Log"), `
      <div class="detail-grid log-detail-grid">
        <div class="detail-field">
          <span>Date</span>
          <div>${escapeHtml(formatDate(log.logDate))}</div>
        </div>
        <div class="detail-field">
          <span>Project</span>
          <div>${log.projectId ? escapeHtml(projectName(log.projectId)) : `<span class="muted">No project</span>`}</div>
        </div>
        <div class="detail-field">
          <span>Category</span>
          <div>${escapeHtml(logCategory(log))}</div>
        </div>
        <div class="detail-field">
          <span>Person</span>
          <div>${escapeHtml(user?.nickname || "User")}</div>
        </div>
        ${log.isPinned ? `
          <div class="detail-field">
            <span>Flag</span>
            <div><span class="pill log-pin">Pinned</span></div>
          </div>
        ` : ""}
        <div class="detail-field full">
          <span>Log</span>
          <div class="log-content" ${devLogRichPersistAttrs(log)}>${log.bodyHtml}</div>
        </div>
      </div>
    `);
  }

  function viewDevLogById(id) {
    const log = state.devLogs.find(item => item.id === Number(id || 0) && isPersonalLog(item));
    if (!log) return false;

    viewDevLog(log);
    return true;
  }

  function devLogRichPersistAttrs(log) {
    return [
      `data-rich-persist-type="devLog"`,
      `data-rich-persist-id="${escapeAttr(log.id)}"`,
      `data-rich-persist-field="bodyHtml"`
    ].join(" ");
  }

  async function duplicateDevLog(id) {
    const log = state.devLogs.find(item => item.id === id && isPersonalLog(item));
    if (!log) return;

    try {
      const logDate = logDateInputValue(new Date());

      await saveJson("/api/devlogs", "POST", {
        id: 0,
        logType: personalLogType,
        category: logCategory(log),
        projectId: log.projectId || null,
        logDate,
        bodyHtml: log.bodyHtml,
        isPinned: false
      });
      await loadState();
      render();
      showToast("Log duplicated.");
    } catch (error) {
      showToast(error.message);
    }
  }

  function logDateValidationMessage(logDate) {
    const selectedDate = logDateInputValue(logDate);
    if (!selectedDate) return "Log date is required.";
    return "";
  }

  function logDateInputValue(value) {
    if (!value) return "";
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    return dateKey(value);
  }

  function resetLogView() {
    [
      preferenceKeys.logFilters,
      preferenceKeys.logEntryProject,
      logTableColumnPreferenceKey
    ].forEach(removePreference);

    logFilters = normalizeLogFilters({});
    logEntryProjectId = 0;
    logColumnPrefs = normalizeLogColumnPrefs({});
    logTableMode.deactivate();
    selectedLogDeleteIds.clear();
    logHeader.reset();
    cancelLogColumnDrag();
    renderDevLogs();
  }

  function deactivateLog() {
    document.querySelectorAll("[data-log-filter-dialog]").forEach(dialog => {
      if (dialog.open) dialog.close();
      else dialog.remove();
    });
    logHeader.deactivate();
    logBulkDeleteBusy = false;
    selectedLogDeleteIds.clear();
    cancelLogColumnDrag();
    logTableMode.deactivate();
  }

  return {
    deactivate: deactivateLog,
    handleAction,
    handleFilterChange,
    render: renderDevLogs,
    view: viewDevLogById
  };
}
