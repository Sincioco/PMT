import { buttonContent, chartIconHtml, funnelIconHtml, iconButton, pageActionsMenuHtml } from "../../components/buttons.js?v=20260701-unified-dropdowns";
import {
  checkedFilterValues,
  filterCheckList
} from "../../components/filters.js";
import { initializeWindowedDialog } from "../../components/dialogs.js?v=20260707-filter-reset-dialogs";
import {
  field,
  optionalNumberValue,
  richTextField,
  richValue,
  selectOptionsField,
  userCardCheckListLabelHtml,
  value
} from "../../components/forms.js?v=20260629-avatar-jpg-assets";
import { sectionHead } from "../../components/sections.js?v=20260701-nav-title-preferences";
import { createWorkItemTableMode } from "../../components/work-items.js?v=20260707-deep-links";
import { currentUser } from "../../core/authentication.js";
import {
  preferenceKeys,
  readJsonPreference,
  readNumberPreference,
  removePreference,
  writeJsonPreference,
  writePreference
} from "../../core/preferences.js?v=20260621-scrum-dev-task-parity";
import { state } from "../../core/store.js";
import {
  dateKey,
  formatDate,
  formatDateTime
} from "../../shared/dates.js";
import { normalizeSavedArray } from "../../shared/filter-values.js";
import { canEditOwner } from "../../shared/permissions.js";
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
} from "../../shared/table-export.js?v=20260706-dialog-persistence";

const scrumYesterdayPrompt = "What did you accomplish yesterday?";
const scrumTodayPrompt = "What do you plan to do today?";
const scrumRoadblocksPrompt = "Do you have any roadblocks?";
const scrumPrompts = [
  scrumYesterdayPrompt,
  scrumTodayPrompt,
  scrumRoadblocksPrompt
];
const sharedScrumLogType = "Scrum";
const scrumTableColumnPreferenceKey = "pmt-scrum-table-columns";

export function createScrumFeature({
  app,
  deleteItem,
  loadState,
  openEditor,
  render,
  saveJson,
  showReadOnlyDialog,
  showToast
}) {
  let scrumFilters = normalizeScrumFilters(readJsonPreference(preferenceKeys.scrumFilters, {}));
  let scrumEntryProjectId = readNumberPreference(preferenceKeys.scrumEntryProject, 0);
  let scrumColumnPrefs = normalizeScrumColumnPrefs(readJsonPreference(scrumTableColumnPreferenceKey, {}));
  let scrumColumnDrag = null;
  let lastScrumColumnPointerDragAt = 0;
  let suppressNextScrumColumnClick = false;
  const scrumTableMode = createWorkItemTableMode({
    action: "toggle-scrum-table-edit-mode",
    itemLabel: "Scrum"
  });

  bindScrumColumnDragEvents();

  function renderDevLogs() {
    if (scrumFilters.projectId && !state.projects.some(project => project.id === Number(scrumFilters.projectId))) {
      scrumFilters.projectId = "";
    }

    syncScrumPersonFilterWithUsers();

    const logs = state.devLogs
      .filter(isSharedScrumLog)
      .filter(log => !scrumFilters.projectId || log.projectId === Number(scrumFilters.projectId))
      .filter(log => !scrumFilters.personIds.length || scrumFilters.personIds.includes(String(log.userId)))
      .filter(log => !scrumFilters.logDate || dateKey(log.logDate) === scrumFilters.logDate)
      .filter(scrumMatchesSearchFilter)
      .sort(scrumSortCompare);
    const visibleScrumColumns = scrumVisibleTableColumns();
    const emptyTableColspan = visibleScrumColumns.length + (scrumTableMode.active ? 1 : 0);

    app.innerHTML = `
      <section class="scrum-screen work-item-screen">
        ${sectionHead("Scrum", `
          <button class="primary text-icon-button" type="button" data-action="new-log" title="New Scrum" aria-label="New Scrum">${buttonContent("&#10010;", "New Scrum")}</button>
          <button class="secondary text-icon-button" type="button" data-action="open-scrum-filters" title="Filters" aria-label="Filters" aria-haspopup="dialog">${buttonContent(funnelIconHtml(), "Filters")}</button>
          ${pageActionsMenuHtml([
            { action: "toggle-scrum-table-edit-mode", icon: "&#9998;", label: "Edit Mode", title: "Edit Mode", checked: scrumTableMode.active },
            { icon: chartIconHtml(), label: "Graphs", title: "Graphs", disabled: true, separatorBefore: true },
            { action: "export-scrum-view", icon: exportIconHtml(), label: "Export", title: "Export", separatorBefore: true },
            { action: "import-scrum-view", icon: importIconHtml(), label: "Import", title: "Import" },
            { action: "reset-scrum-view", icon: "&#8634;", label: "Reset View", title: "Reset View", separatorBefore: true }
          ])}
        `)}
        <div class="panel work-item-table-panel scrum-table-panel">
          <div class="scrum-table-wrap">
            <table class="table work-item-table scrum-table ${scrumTableMode.active ? "is-edit-mode" : "is-read-mode"}" style="--scrum-table-min-width:${scrumTableMinWidth(visibleScrumColumns)}px">
              <colgroup>
                ${visibleScrumColumns.map((column, index) => scrumTableColumnColHtml(column, scrumColumnIsRubber(visibleScrumColumns, index))).join("")}
                ${scrumTableMode.active ? `<col class="scrum-action-column">` : ""}
              </colgroup>
              <thead>
                <tr>
                  ${visibleScrumColumns.map((column, index) => scrumColumnHeaderHtml(column, scrumColumnIsRubber(visibleScrumColumns, index))).join("")}
                  ${scrumTableMode.active ? `<th class="action-cell" aria-label="Actions"></th>` : ""}
                </tr>
              </thead>
              <tbody>
                ${logs.map(log => scrumRowHtml(log, visibleScrumColumns)).join("") || `<tr><td colspan="${emptyTableColspan}"><div class="empty">No Scrum entries match the current filters.</div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    `;
  }

  function scrumRowHtml(log, visibleColumns) {
    const editable = canModifyScrumLog(log);

    return `
      <tr class="scrum-row clickable-row" data-action="view-log" data-id="${log.id}">
        ${visibleColumns.map((column, index) => scrumTableColumnCellHtml(column, log, scrumColumnIsRubber(visibleColumns, index))).join("")}
        ${scrumTableMode.active ? `
          <td class="reveal-actions action-cell scrum-actions" data-label="Actions">
            ${editable ? `
              ${iconButton("delete-log", log.id, "Delete", "delete-monochrome")}
              ${iconButton("duplicate-log", log.id, "Duplicate", "duplicate")}
              ${iconButton("edit-log", log.id, "Edit", "edit")}
            ` : ""}
          </td>
        ` : ""}
      </tr>
    `;
  }

  function syncScrumPersonFilterWithUsers() {
    const userIds = state.users.map(user => String(user.id));
    const validPersonIds = new Set(userIds);
    scrumFilters.personIds = scrumFilters.personIds.filter(id => validPersonIds.has(id));

    if (userIds.length && scrumFilters.personIds.length === userIds.length) {
      scrumFilters.personIds = [];
    }
  }

  function canModifyScrumLog(log) {
    if (!log) return false;
    if (currentUser().isAdmin) return true;
    if (!canEditOwner(log.userId)) return false;
    if (scrumLogIsOlderThanModificationWindow(log)) return false;
    return !scrumDateValidationMessage(log.projectId, scrumDateInputValue(log.logDate));
  }

  function isSharedScrumLog(log) {
    return (log?.logType || sharedScrumLogType) === sharedScrumLogType;
  }

  function scrumLogIsOlderThanModificationWindow(log) {
    return scrumDateInputValue(log?.logDate) < scrumModificationLimitDateKey();
  }

  function scrumModificationLimitDateKey() {
    const date = new Date();
    date.setDate(date.getDate() - 31);
    return scrumDateInputValue(date);
  }

  function scrumTableColumnDefinitions() {
    return [
      {
        key: "person",
        label: "Person",
        colClass: "scrum-person-column",
        cellClass: "scrum-person-cell",
        width: 180,
        defaultVisible: true,
        cellHtml: log => scrumPersonHtml(log)
      },
      {
        key: "date",
        label: "Date",
        colClass: "scrum-date-column",
        cellClass: "scrum-date",
        width: 112,
        defaultVisible: true,
        cellHtml: log => escapeHtml(formatDate(log.logDate))
      },
      {
        key: "project",
        label: "Project",
        colClass: "scrum-project-column",
        cellClass: "scrum-project",
        width: 220,
        defaultVisible: true,
        cellHtml: log => log.projectId ? escapeHtml(projectName(log.projectId)) : `<span class="muted">No project</span>`
      },
      {
        key: "scrum",
        label: "Scrum",
        colClass: "scrum-body-column",
        cellClass: "scrum-body",
        width: 420,
        rubberMinWidth: 260,
        defaultVisible: true,
        cellHtml: log => `<div class="scrum-content">${log.bodyHtml}</div>`
      },
      {
        key: "flag",
        label: "Flag",
        colClass: "scrum-flag-column",
        cellClass: "scrum-flag",
        width: 90,
        defaultVisible: true,
        cellHtml: log => log.isPinned ? `<span class="pill scrum-pin">Pinned</span>` : ""
      },
      {
        key: "createdAt",
        label: "Created Date/Time",
        colClass: "scrum-date-time-column",
        cellClass: "scrum-date",
        width: 156,
        rubberMinWidth: 124,
        cellHtml: log => escapeHtml(formatDateTime(log.createdAt))
      },
      {
        key: "updatedAt",
        label: "Last Updated Date/Time",
        colClass: "scrum-date-time-column",
        cellClass: "scrum-date",
        width: 156,
        rubberMinWidth: 124,
        cellHtml: log => escapeHtml(formatDateTime(log.updatedAt))
      }
    ];
  }

  function scrumPersonHtml(log) {
    const user = userById(log.userId);
    return `
      <div class="row scrum-person">
        <img class="avatar" src="${escapeAttr(user?.avatarUrl || "/assets/avatar-default.svg")}" alt="">
        <strong>${escapeHtml(user?.nickname || "User")}</strong>
      </div>
    `;
  }

  function scrumUserName(userId) {
    const user = userId ? userById(Number(userId)) : null;
    return user?.nickname || [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  }

  function scrumColumnFilterItems() {
    return scrumOrderedTableColumns()
      .map(column => ({ value: column.key, text: column.label }));
  }

  function scrumTableColumnColHtml(column, isRubber = false) {
    const className = [column.colClass, isRubber ? "scrum-rubber-column" : ""]
      .filter(Boolean)
      .join(" ");

    return `<col class="${escapeAttr(className)}">`;
  }

  function scrumTableColumnCellHtml(column, log, isRubber = false) {
    const className = [column.cellClass || "", isRubber ? "scrum-rubber-cell" : ""]
      .filter(Boolean)
      .join(" ");

    return `<td class="${escapeAttr(className)}" data-label="${escapeAttr(column.label)}">${column.cellHtml(log)}</td>`;
  }

  function scrumColumnHeaderHtml(column, isRubber = false) {
    const className = [column.headerClass || "", isRubber ? "scrum-rubber-cell" : ""]
      .filter(Boolean)
      .join(" ");

    return scrumSortHeaderHtml(column.key, column.label, className, {
      draggable: scrumTableMode.active
    });
  }

  function scrumVisibleTableColumns() {
    const visibleKeys = new Set(scrumColumnPrefs.visible);
    const columns = scrumOrderedTableColumns()
      .filter(column => visibleKeys.has(column.key));

    return columns.length
      ? columns
      : scrumTableColumnDefinitions().filter(column => column.key === "scrum");
  }

  function scrumOrderedTableColumns() {
    const definitions = scrumTableColumnDefinitions();
    const columnsByKey = new Map(definitions.map(column => [column.key, column]));

    return normalizedScrumColumnOrder(scrumColumnPrefs.order)
      .map(key => columnsByKey.get(key))
      .filter(Boolean);
  }

  function scrumTableMinWidth(columns) {
    const fixedWidth = scrumTableMode.active ? 176 : 0;
    const lastColumnIndex = columns.length - 1;
    const columnsWidth = columns.reduce((total, column, index) =>
      total + scrumColumnMinimumWidth(column, index === lastColumnIndex), 0);
    return Math.max(960, fixedWidth + columnsWidth);
  }

  function scrumColumnMinimumWidth(column, isRubber) {
    if (isRubber) return column.rubberMinWidth || Math.min(column.width || 140, 140);
    return column.width || 140;
  }

  function scrumColumnIsRubber(columns, index) {
    return index === columns.length - 1;
  }

  function normalizeScrumColumnPrefs(preferences = {}) {
    const savedPreferences = preferences && typeof preferences === "object" && !Array.isArray(preferences)
      ? preferences
      : {};
    const visibleKeys = normalizeSavedArray(savedPreferences.visible)
      .filter(key => scrumColumnKeySet().has(key));

    return {
      order: normalizedScrumColumnOrder(savedPreferences.order),
      visible: visibleKeys.length ? visibleKeys : scrumDefaultVisibleColumnKeys()
    };
  }

  function normalizedScrumColumnOrder(order = []) {
    const allowedKeys = scrumColumnKeySet();
    const orderedKeys = normalizeSavedArray(order)
      .filter(key => allowedKeys.has(key));

    scrumTableColumnDefinitions().forEach(column => {
      if (!orderedKeys.includes(column.key)) orderedKeys.push(column.key);
    });

    return orderedKeys;
  }

  function scrumColumnOrderWithAddedColumns(order, addedColumns) {
    const orderedKeys = normalizedScrumColumnOrder(order);

    addedColumns
      .filter(column => scrumColumnKeySet().has(column))
      .forEach(column => {
        const existingIndex = orderedKeys.indexOf(column);
        if (existingIndex >= 0) orderedKeys.splice(existingIndex, 1);
        orderedKeys.push(column);
      });

    return orderedKeys;
  }

  function scrumColumnKeySet() {
    return new Set(scrumTableColumnDefinitions().map(column => column.key));
  }

  function scrumDefaultVisibleColumnKeys() {
    return scrumTableColumnDefinitions()
      .filter(column => column.defaultVisible)
      .map(column => column.key);
  }

  function saveScrumColumnPrefs() {
    writeJsonPreference(scrumTableColumnPreferenceKey, scrumColumnPrefs);
  }

  function bindScrumColumnDragEvents() {
    app.addEventListener("pointerdown", handleScrumColumnPointerDown);
    app.addEventListener("mousedown", handleScrumColumnMouseDown);
    app.addEventListener("click", suppressScrumColumnDraggedClick, true);
  }

  function handleScrumColumnPointerDown(event) {
    lastScrumColumnPointerDragAt = Date.now();
    startScrumColumnDrag(event, "pointer");
  }

  function handleScrumColumnMouseDown(event) {
    if (Date.now() - lastScrumColumnPointerDragAt < 500) return;
    startScrumColumnDrag(event, "mouse");
  }

  function startScrumColumnDrag(event, inputType) {
    if (event.button !== 0) return;
    if (!scrumTableMode.active) return;

    const header = event.target.closest('.scrum-table th[data-scrum-column][data-column-draggable="true"]');
    const table = header?.closest(".scrum-table");
    if (!header || !table || !app.contains(header)) return;

    const columnKey = header.dataset.scrumColumn || "";
    if (!scrumColumnPrefs.visible.includes(columnKey)) return;

    scrumColumnDrag = {
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
      window.addEventListener("pointermove", handleScrumColumnPointerMove);
      window.addEventListener("pointerup", handleScrumColumnPointerUp, { once: true });
      window.addEventListener("pointercancel", cancelScrumColumnDrag, { once: true });
    } else {
      window.addEventListener("mousemove", handleScrumColumnMouseMove);
      window.addEventListener("mouseup", handleScrumColumnMouseUp, { once: true });
    }
  }

  function handleScrumColumnPointerMove(event) {
    lastScrumColumnPointerDragAt = Date.now();
    moveScrumColumnDrag(event);
  }

  function handleScrumColumnMouseMove(event) {
    if (scrumColumnDrag?.inputType === "pointer") return;
    moveScrumColumnDrag(event);
  }

  function moveScrumColumnDrag(event) {
    if (!scrumColumnDrag) return;

    const movedEnough = Math.hypot(event.clientX - scrumColumnDrag.startX, event.clientY - scrumColumnDrag.startY) > 5;
    if (!scrumColumnDrag.started && !movedEnough) return;

    if (!scrumColumnDrag.started) {
      scrumColumnDrag.started = true;
      suppressNextScrumColumnClick = true;
      scrumColumnDrag.source.classList.add("column-dragging");
      scrumColumnDrag.table.classList.add("is-column-dragging");
    }

    event.preventDefault();
    updateScrumColumnDropIndicator(event.clientX, event.clientY);
  }

  function handleScrumColumnPointerUp(event) {
    lastScrumColumnPointerDragAt = Date.now();
    finishScrumColumnDrag(event);
  }

  function handleScrumColumnMouseUp(event) {
    if (scrumColumnDrag?.inputType === "pointer") return;
    finishScrumColumnDrag(event);
  }

  function finishScrumColumnDrag(event) {
    if (!scrumColumnDrag || scrumColumnDrag.finishing) return;
    scrumColumnDrag.finishing = true;

    if (!scrumColumnDrag.started) {
      cancelScrumColumnDrag();
      return;
    }

    event.preventDefault();
    suppressNextScrumColumnClick = true;

    const drag = scrumColumnDrag;
    const drop = scrumColumnDropTarget(event.clientX, event.clientY);
    if (drop) {
      const order = scrumColumnKeysAfterDrop(drag.columnKey, drop.target.dataset.scrumColumn || "", drop.placement);
      if (scrumColumnOrderChanged(order)) {
        scrumColumnPrefs = normalizeScrumColumnPrefs({ ...scrumColumnPrefs, order });
        saveScrumColumnPrefs();
        cancelScrumColumnDrag();
        renderDevLogs();
        return;
      }
    }

    cancelScrumColumnDrag();
  }

  function scrumColumnDropTarget(clientX, clientY) {
    if (!scrumColumnDrag) return null;

    const headerRow = scrumColumnDrag.table.querySelector("thead tr");
    const headerRect = headerRow?.getBoundingClientRect();
    if (!headerRect || clientY < headerRect.top - 32 || clientY > headerRect.bottom + 64) return null;

    const headers = [...scrumColumnDrag.table.querySelectorAll('thead th[data-scrum-column][data-column-draggable="true"]')]
      .filter(header => (header.dataset.scrumColumn || "") !== scrumColumnDrag.columnKey);
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

  function updateScrumColumnDropIndicator(clientX, clientY) {
    clearScrumColumnDropIndicators();

    const drop = scrumColumnDropTarget(clientX, clientY);
    if (!drop) return;

    scrumColumnDrag.table.classList.add("column-drop-target");
    drop.target.classList.add(drop.placement === "after" ? "column-reorder-after" : "column-reorder-before");
  }

  function scrumColumnKeysAfterDrop(draggedKey, targetKey, placement) {
    const orderedKeys = normalizedScrumColumnOrder(scrumColumnPrefs.order)
      .filter(key => key !== draggedKey);
    let insertIndex = orderedKeys.indexOf(targetKey);
    if (insertIndex < 0) return normalizedScrumColumnOrder(scrumColumnPrefs.order);
    if (placement === "after") insertIndex += 1;
    orderedKeys.splice(insertIndex, 0, draggedKey);
    return orderedKeys;
  }

  function scrumColumnOrderChanged(order) {
    const currentOrder = normalizedScrumColumnOrder(scrumColumnPrefs.order);
    return order.length !== currentOrder.length || order.some((key, index) => key !== currentOrder[index]);
  }

  function cancelScrumColumnDrag() {
    window.removeEventListener("pointermove", handleScrumColumnPointerMove);
    window.removeEventListener("mousemove", handleScrumColumnMouseMove);
    window.removeEventListener("pointerup", handleScrumColumnPointerUp);
    window.removeEventListener("mouseup", handleScrumColumnMouseUp);
    window.removeEventListener("pointercancel", cancelScrumColumnDrag);

    if (scrumColumnDrag?.inputType === "pointer" && scrumColumnDrag.source.releasePointerCapture && scrumColumnDrag.pointerId !== undefined) {
      try {
        scrumColumnDrag.source.releasePointerCapture(scrumColumnDrag.pointerId);
      } catch {
        // The browser may already have released pointer capture.
      }
    }

    scrumColumnDrag = null;
    app.querySelectorAll(".column-dragging, .is-column-dragging, .column-drop-target, .column-reorder-before, .column-reorder-after")
      .forEach(item => item.classList.remove(
        "column-dragging",
        "is-column-dragging",
        "column-drop-target",
        "column-reorder-before",
        "column-reorder-after"
      ));
  }

  function clearScrumColumnDropIndicators() {
    app.querySelectorAll(".column-drop-target, .column-reorder-before, .column-reorder-after")
      .forEach(item => item.classList.remove("column-drop-target", "column-reorder-before", "column-reorder-after"));
  }

  function suppressScrumColumnDraggedClick(event) {
    if (!suppressNextScrumColumnClick) return;
    suppressNextScrumColumnClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function handleFilterChange(eventOrTarget) {
    const target = eventOrTarget?.target || eventOrTarget;
    if (!applyScrumFilterChange(target)) return false;

    renderDevLogs();
    return true;
  }

  function applyScrumFilterChange(target) {
    const filter = target?.dataset?.filter;
    if (!filter?.startsWith("scrum-")) return false;

    if (filter === "scrum-project") scrumFilters.projectId = target.value;
    if (filter === "scrum-date") scrumFilters.logDate = target.value;
    if (filter === "scrum-search") scrumFilters.search = target.value;
    if (filter === "scrum-sort") scrumFilters.sort = target.value;
    if (filter === "scrum-person") scrumFilters.personIds = checkedFilterValues("scrum-person");
    if (filter === "scrum-column") {
      const visibleColumns = checkedFilterValues("scrum-column");
      if (!visibleColumns.length) {
        target.checked = true;
        return false;
      }
      const addedColumns = visibleColumns.filter(column => !scrumColumnPrefs.visible.includes(column));
      scrumColumnPrefs = normalizeScrumColumnPrefs({
        ...scrumColumnPrefs,
        order: scrumColumnOrderWithAddedColumns(scrumColumnPrefs.order, addedColumns),
        visible: visibleColumns
      });
      saveScrumColumnPrefs();
    }

    if (filter !== "scrum-column") writeJsonPreference(preferenceKeys.scrumFilters, scrumFilters);
    return true;
  }

  async function handleAction(action, id, element) {
    const log = id ? state.devLogs.find(item => item.id === id && isSharedScrumLog(item)) : null;

    if (action === "new-log") {
      editDevLog();
      return true;
    }
    if (action === "toggle-scrum-table-edit-mode") {
      scrumTableMode.toggle();
      renderDevLogs();
      return true;
    }
    if (action === "sort-scrum-table") {
      return updateScrumTableSort(element);
    }
    if (action === "reset-scrum-view") {
      resetScrumView();
      return true;
    }
    if (action === "open-scrum-filters" || action === "toggle-scrum-filters") {
      openScrumFiltersDialog();
      return true;
    }
    if (action === "export-scrum-view") {
      openScrumExportDialog();
      return true;
    }
    if (action === "import-scrum-view") {
      openScrumImport();
      return true;
    }
    if (action === "view-log") {
      if (log && canModifyScrumLog(log)) editDevLog(log);
      else viewDevLog(log);
      return true;
    }
    if (action === "edit-log") {
      if (log && canModifyScrumLog(log)) editDevLog(log);
      else viewDevLog(log);
      return true;
    }
    if (action === "duplicate-log") {
      if (log && canModifyScrumLog(log)) {
        await duplicateDevLog(id);
      }
      return true;
    }
    if (action === "delete-log") {
      if (log && canModifyScrumLog(log)) {
        await deleteItem(`/api/devlogs/${id}`, "Delete this Scrum entry?");
      }
      return true;
    }

    return false;
  }

  function openScrumFiltersDialog() {
    const existingDialog = document.querySelector("[data-scrum-filter-dialog]");
    if (existingDialog) {
      if (!existingDialog.open) existingDialog.showModal?.();
      existingDialog.querySelector("[data-filter='scrum-search']")?.focus({ preventScroll: true });
      return;
    }

    const modal = document.createElement("dialog");
    modal.className = "dialog task-filter-dialog scrum-filter-dialog";
    modal.dataset.scrumFilterDialog = "true";
    modal.innerHTML = `
      <form method="dialog">
        <div class="dialog-head">
          <h2>Scrum Filters</h2>
          <button type="button" class="icon-btn" data-close-scrum-filters title="Close" aria-label="Close">x</button>
        </div>
        <div class="dialog-body task-filter-dialog-body scrum-filter-dialog-body" data-scrum-filter-dialog-body></div>
        <div class="dialog-actions">
          <button type="button" class="primary text-icon-button" data-close-scrum-filters>${buttonContent("&#10003;", "Done")}</button>
        </div>
      </form>
    `;

    renderScrumFiltersDialog(modal);
    document.body.appendChild(modal);
    initializeWindowedDialog(modal, { onReset: () => resetScrumFiltersDialog(modal) });
    modal.addEventListener("input", event => {
      if (!applyScrumFilterChange(event.target)) return;
      renderDevLogs();
    });
    modal.addEventListener("change", event => {
      if (!applyScrumFilterChange(event.target)) return;
      renderDevLogs();
    });
    modal.addEventListener("click", event => {
      if (event.target.closest("[data-close-scrum-filters]")) modal.close();
    });
    modal.addEventListener("close", () => modal.remove());
    modal.showModal();
    modal.querySelector("[data-filter='scrum-search']")?.focus({ preventScroll: true });
  }

  function renderScrumFiltersDialog(modal) {
    const body = modal.querySelector("[data-scrum-filter-dialog-body]");
    if (!body) return;

    body.innerHTML = `
      <div class="tasks-filter-panel scrum-filter-fields">
        <div class="task-filter-row scrum-filter-row">
          <label>
            <span>Project</span>
            <select data-filter="scrum-project">
              <option value="" ${!scrumFilters.projectId ? "selected" : ""}>All Projects</option>
              ${state.projects.map(project => `<option value="${project.id}" ${String(project.id) === String(scrumFilters.projectId || "") ? "selected" : ""}>${escapeHtml(project.code)} - ${escapeHtml(project.title)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Search</span>
            <input type="text" data-filter="scrum-search" value="${escapeAttr(scrumFilters.search)}">
          </label>
          <label>
            <span>Date</span>
            <input type="date" data-filter="scrum-date" value="${escapeAttr(scrumFilters.logDate || "")}">
          </label>
          <label>
            <span>Sort</span>
            <select data-filter="scrum-sort">
              ${scrumSortOptionsHtml()}
            </select>
          </label>
        </div>
        <div class="filter-stack">
          ${filterCheckList("Person", "scrum-person", scrumUserFilterItems(), scrumFilters.personIds, {
            className: "user-card-check-list",
            renderItem: userCardCheckListLabelHtml
          })}
          ${filterCheckList("Columns", "scrum-column", scrumColumnFilterItems(), scrumColumnPrefs.visible)}
        </div>
      </div>
    `;
  }

  function resetScrumFiltersDialog(modal) {
    removePreference(preferenceKeys.scrumFilters);
    scrumFilters = normalizeScrumFilters({});
    renderDevLogs();
    renderScrumFiltersDialog(modal);
    modal.querySelector("[data-filter='scrum-project']")?.focus({ preventScroll: true });
  }

  function scrumUserFilterItems() {
    return state.users.map(user => ({
      ...user,
      value: user.id,
      text: user.nickname
    }));
  }

  function editDevLog(log = {}) {
    if (log.id && !canModifyScrumLog(log)) {
      viewDevLog(log);
      return;
    }

    const rememberedProjectId = state.projects.some(project => project.id === scrumEntryProjectId)
      ? scrumEntryProjectId
      : 0;
    const selectedProjectId = log.id ? log.projectId || "" : rememberedProjectId || "";
    const selectedLogDate = scrumDateInputValue(log.logDate || new Date());
    const scrumHtml = log.bodyHtml || newScrumEntryHtml(selectedProjectId, selectedLogDate);

    openEditor(scrumDialogTitle(log, "New Scrum"), `
      <div class="form-grid scrum-editor-grid">
        ${field("Date", "logDate", selectedLogDate, "date", scrumMinDateKey(selectedProjectId), scrumMaxDateKey())}
        ${selectOptionsField("Project", "projectId", [{ id: "", title: "No project" }, ...state.projects.map(project => ({ id: project.id, title: `${project.code} - ${project.title}` }))], selectedProjectId)}
        ${richTextField("bodyHtml", "Scrum", scrumHtml)}
        <label class="inline-check field full"><input name="isPinned" type="checkbox" ${log.isPinned ? "checked" : ""} ${currentUser().isAdmin ? "" : "disabled"}><span>Pinned</span></label>
      </div>
    `, async root => {
      const projectId = optionalNumberValue(root, "projectId");
      scrumEntryProjectId = projectId || 0;
      writePreference(preferenceKeys.scrumEntryProject, scrumEntryProjectId);

      const logDate = value(root, "logDate");
      const dateError = scrumDateValidationMessage(projectId, logDate);
      if (dateError) throw new Error(dateError);
      const bodyHtml = scrumBodyHtmlForSave(root);

      await saveJson(log.id ? `/api/devlogs/${log.id}` : "/api/devlogs", log.id ? "PUT" : "POST", {
        id: log.id || 0,
        logType: sharedScrumLogType,
        projectId,
        logDate,
        bodyHtml,
        isPinned: root.querySelector("[name='isPinned']").checked
      });
    }, log.id ? "" : "bodyHtml", root => {
      bindScrumDateBounds(root);
      if (!log.id) focusRichEditorEmptyBullet(root, "bodyHtml", scrumTodayPrompt);
    });
  }

  function normalizeScrumFilters(filters = {}) {
    return {
      ...filters,
      personIds: normalizeSavedArray(filters.personIds),
      sort: filters.sort || "custom",
      search: String(filters.search || "")
    };
  }

  function scrumMatchesSearchFilter(log) {
    const term = String(scrumFilters.search || "").trim().toLowerCase();
    if (!term) return true;

    return scrumSearchValues(log)
      .map(item => String(item ?? "").toLowerCase())
      .some(item => item.includes(term));
  }

  function scrumSearchValues(log) {
    const user = userById(log.userId);
    return [
      user?.nickname,
      [user?.firstName, user?.lastName].filter(Boolean).join(" "),
      user?.email,
      projectName(log.projectId),
      formatDate(log.logDate),
      scrumDateInputValue(log.logDate),
      textFromHtml(log.bodyHtml || ""),
      log.isPinned ? "Pinned" : "",
      formatDateTime(log.createdAt),
      formatDateTime(log.updatedAt)
    ];
  }

  function scrumSortCompare(a, b) {
    const pinnedResult = comparePinnedScrum(a, b);
    if (pinnedResult) return pinnedResult;

    const state = scrumTableSortState();

    if (state.column && state.direction) {
      const result = compareScrumSortColumn(a, b, state.column);
      if (result) return state.direction === "asc" ? result : -result;
      return defaultScrumSortCompare(a, b);
    }

    if (scrumFilters.sort === "oldest") return scrumDateCompare(a, b);
    if (scrumFilters.sort === "newest") return scrumDateCompare(b, a);
    return defaultScrumSortCompare(a, b);
  }

  function comparePinnedScrum(a, b) {
    if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
      return Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
    }

    if (a.isPinned && b.isPinned) {
      return scrumCreatedCompare(b, a);
    }

    return 0;
  }

  function defaultScrumSortCompare(a, b) {
    return scrumDateCompare(b, a);
  }

  function scrumDateCompare(a, b) {
    return scrumTimeValue(a.logDate) - scrumTimeValue(b.logDate)
      || scrumTimeValue(a.updatedAt) - scrumTimeValue(b.updatedAt)
      || a.id - b.id;
  }

  function scrumCreatedCompare(a, b) {
    return scrumTimeValue(a.createdAt) - scrumTimeValue(b.createdAt)
      || scrumTimeValue(a.updatedAt) - scrumTimeValue(b.updatedAt)
      || scrumTimeValue(a.logDate) - scrumTimeValue(b.logDate)
      || a.id - b.id;
  }

  function scrumTimeValue(value) {
    const time = new Date(value || 0).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  function compareScrumSortColumn(a, b, column) {
    if (column === "date") return scrumDateCompare(a, b);
    if (column === "createdAt") return scrumTimeValue(a.createdAt) - scrumTimeValue(b.createdAt) || a.id - b.id;
    if (column === "updatedAt") return scrumTimeValue(a.updatedAt) - scrumTimeValue(b.updatedAt) || a.id - b.id;
    if (column === "flag") return Number(Boolean(a.isPinned)) - Number(Boolean(b.isPinned));

    return scrumSortTextValue(a, column).localeCompare(scrumSortTextValue(b, column), undefined, {
      numeric: true,
      sensitivity: "base"
    });
  }

  function scrumSortTextValue(log, column) {
    if (column === "project") return log.projectId ? projectName(log.projectId) : "No project";
    if (column === "person") return userById(log.userId)?.nickname || "";
    if (column === "scrum") return textFromHtml(log.bodyHtml || "");
    return "";
  }

  function textFromHtml(html) {
    const container = document.createElement("div");
    container.innerHTML = html;
    return container.textContent || "";
  }

  function scrumSortHeaderHtml(column, label, className = "", options = {}) {
    const state = scrumTableSortState();
    const isSorted = state.column === column && Boolean(state.direction);
    const ariaSort = isSorted ? (state.direction === "asc" ? "ascending" : "descending") : "none";
    const arrow = isSorted ? (state.direction === "asc" ? "&#9650;" : "&#9660;") : "";
    const classes = [className, isSorted ? "is-sorted" : ""].filter(Boolean).join(" ");
    const columnDragAttrs = `
      data-scrum-column="${escapeAttr(column)}"
      data-column-draggable="${options.draggable ? "true" : "false"}"`;

    return `
      <th class="${classes}" aria-sort="${ariaSort}" ${columnDragAttrs}>
        <button type="button" class="table-sort-button" data-action="sort-scrum-table" data-column="${escapeAttr(column)}" title="${escapeAttr(scrumNextSortLabel(column, label))}">
          <span>${escapeHtml(label)}</span>
          <span class="table-sort-indicator" aria-hidden="true">${arrow}</span>
        </button>
      </th>
    `;
  }

  function updateScrumTableSort(button) {
    const column = button?.dataset?.column || "";
    if (!scrumTableSortColumns().some(item => item.column === column)) return false;

    scrumFilters.sort = nextScrumSort(column);
    writeJsonPreference(preferenceKeys.scrumFilters, scrumFilters);
    renderDevLogs();
    return true;
  }

  function nextScrumSort(column) {
    const state = scrumTableSortState();
    if (state.column !== column || !state.direction) return `${column}-asc`;
    if (state.direction === "asc") return `${column}-desc`;
    return "custom";
  }

  function scrumTableSortState(sortValue = scrumFilters.sort) {
    const match = /^(.+)-(asc|desc)$/.exec(sortValue || "");
    if (!match) return { column: "", direction: "" };
    return { column: match[1], direction: match[2] };
  }

  function scrumSortOptionsHtml() {
    const selectedSort = scrumFilters.sort || "custom";
    const options = [
      { value: "custom", text: "Date Descending" },
      { value: "newest", text: "Newest Scrum" },
      { value: "oldest", text: "Oldest Scrum" },
      ...scrumTableSortColumns().flatMap(column => [
        { value: `${column.column}-asc`, text: `${column.label} Ascending` },
        { value: `${column.column}-desc`, text: `${column.label} Descending` }
      ])
    ];

    return options
      .map(option => `<option value="${escapeAttr(option.value)}" ${selectedSort === option.value ? "selected" : ""}>${escapeHtml(option.text)}</option>`)
      .join("");
  }

  function scrumTableSortColumns() {
    return scrumTableColumnDefinitions()
      .map(column => ({ column: column.key, label: column.label }));
  }

  function scrumNextSortLabel(column, label) {
    const state = scrumTableSortState();
    if (state.column === column && state.direction === "asc") return `Sort ${label} descending`;
    if (state.column === column && state.direction === "desc") return `Clear ${label} sort`;
    return `Sort ${label} ascending`;
  }

  function openScrumExportDialog() {
    openExportDialog({
      title: "Export Scrum",
      onCsvExport: exportScrumCsv,
      onExcelExport: exportScrumExcel
    });
  }

  function exportScrumCsv() {
    const rows = scrumExportRows();
    const columns = scrumExportImportColumns();

    downloadCsv(exportFileName("pmt-scrum"), columns, rows);
  }

  function exportScrumExcel() {
    const rows = scrumExportRows();
    const columns = scrumExportImportColumns();

    downloadXlsx(exportFileName("pmt-scrum", "xlsx"), "Scrum", columns, rows);
  }

  function scrumExportRows() {
    syncScrumPersonFilterWithUsers();
    return state.devLogs
      .filter(isSharedScrumLog)
      .filter(log => !scrumFilters.projectId || log.projectId === Number(scrumFilters.projectId))
      .filter(log => !scrumFilters.personIds.length || scrumFilters.personIds.includes(String(log.userId)))
      .filter(log => !scrumFilters.logDate || dateKey(log.logDate) === scrumFilters.logDate)
      .filter(scrumMatchesSearchFilter)
      .sort(scrumSortCompare);
  }

  function scrumExportImportColumns() {
    return [
      ...scrumExportColumns(scrumVisibleTableColumns()),
      { header: "PMT Scrum Id", value: log => log.id },
      { header: "PMT Scrum Owner User Id", value: log => log.userId },
      { header: "PMT Scrum Row Hash", value: log => scrumImportHash(log) },
      { header: "PMT Update Date", value: log => scrumDateInputValue(log.logDate) },
      { header: "PMT Update Project Id", value: log => log.projectId || "" },
      { header: "PMT Update Scrum Html", value: log => log.bodyHtml || "" },
      { header: "PMT Update Pinned", value: log => log.isPinned ? "Yes" : "No" }
    ];
  }

  function scrumExportColumns(visibleColumns) {
    return visibleColumns.map(column => ({
      header: column.label,
      value: log => scrumExportValue(column.key, log)
    }));
  }

  function scrumExportValue(columnKey, log) {
    if (columnKey === "person") return scrumUserName(log.userId);
    if (columnKey === "date") return scrumDateInputValue(log.logDate);
    if (columnKey === "project") return log.projectId ? projectName(log.projectId) : "";
    if (columnKey === "scrum") return textFromHtml(log.bodyHtml || "");
    if (columnKey === "flag") return log.isPinned ? "Pinned" : "";
    if (columnKey === "createdAt") return formatDateTime(log.createdAt);
    if (columnKey === "updatedAt") return formatDateTime(log.updatedAt);
    return "";
  }

  function openScrumImport() {
    openExcelImport({
      onImport: importScrumExcel,
      onError: error => showImportResultDialog({
        title: "Import Scrum",
        totalRows: 0,
        updatedRows: 0,
        errors: [{ rowNumber: "File", message: error.message }]
      })
    });
  }

  async function importScrumExcel(records) {
    const errors = [];
    let updatedRows = 0;

    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      const rowNumber = index + 2;
      try {
        if (await importScrumRecord(record)) updatedRows += 1;
      } catch (error) {
        const id = parseScrumImportId(record);
        const log = id ? state.devLogs.find(item => item.id === id && isSharedScrumLog(item)) : null;
        errors.push({
          rowNumber,
          code: id ? `Scrum ${id}` : "",
          title: log ? [formatDate(log.logDate), scrumUserName(log.userId)].join(" - ") : "",
          message: error.message
        });
      }
    }

    if (updatedRows) {
      await loadState();
      render();
    }
    showImportResultDialog({
      title: "Import Scrum",
      totalRows: records.length,
      updatedRows,
      errors
    });
  }

  async function importScrumRecord(record) {
    const log = state.devLogs.find(item => item.id === parseScrumImportId(record) && isSharedScrumLog(item));
    if (!log) throw new Error("PMT Scrum Id does not match an existing row.");
    assertScrumImportAllowed(log);
    assertScrumImportHash(record, log);

    const projectId = parseScrumImportProjectId(record, log);
    const logDate = parseScrumImportDate(record, log);
    const bodyHtml = parseScrumImportBodyHtml(record, log);
    const isPinned = currentUser().isAdmin ? parseScrumImportPinned(record, log) : log.isPinned;
    const dateError = scrumDateValidationMessage(projectId, logDate);
    if (dateError) throw new Error(dateError);
    if (!bodyHtml) throw new Error("Scrum text is required.");

    if (!scrumImportChanged(log, { projectId, logDate, bodyHtml, isPinned })) return false;

    await saveJson(`/api/devlogs/${log.id}`, "PUT", {
      id: log.id,
      logType: sharedScrumLogType,
      projectId,
      logDate,
      bodyHtml,
      isPinned,
      auditContext: "Import"
    });
    return true;
  }

  function assertScrumImportAllowed(log) {
    const user = currentUser();
    if (user.isAdmin) return;
    if (log.userId !== user.id) {
      throw new Error("Only an Admin can import updates for another user's Scrum entry.");
    }
    if (scrumLogIsOlderThanModificationWindow(log)) {
      throw new Error("Scrum entries older than 31 days are read-only for users.");
    }
  }

  function assertScrumImportHash(record, log) {
    const hash = importCell(record, "PMT Scrum Row Hash").trim();
    if (hash && hash !== scrumImportHash(log)) {
      throw new Error("This Scrum row is stale. Re-export the grid before importing this row.");
    }
  }

  function parseScrumImportId(record) {
    const id = Number(importCell(record, "PMT Scrum Id", "Scrum Id").trim());
    return Number.isInteger(id) && id > 0 ? id : 0;
  }

  function parseScrumImportProjectId(record, log) {
    if (!importCellExists(record, "PMT Update Project Id")) return log.projectId || null;

    const value = importCell(record, "PMT Update Project Id").trim();
    if (!value) return null;

    const projectId = Number(value);
    if (!Number.isInteger(projectId) || !state.projects.some(project => project.id === projectId)) {
      throw new Error(`Unknown project id "${value}".`);
    }
    return projectId;
  }

  function parseScrumImportDate(record, log) {
    const value = importCell(record, "PMT Update Date", "Date").trim();
    const selectedDate = value || scrumDateInputValue(log.logDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      throw new Error("Scrum import dates must use YYYY-MM-DD.");
    }
    return selectedDate;
  }

  function parseScrumImportBodyHtml(record, log) {
    if (!importCellExists(record, "PMT Update Scrum Html")) return log.bodyHtml || "";
    return importCell(record, "PMT Update Scrum Html").trim();
  }

  function parseScrumImportPinned(record, log) {
    if (!importCellExists(record, "PMT Update Pinned")) return Boolean(log.isPinned);

    const value = importCell(record, "PMT Update Pinned", "Flag").trim().toLowerCase();
    return ["1", "true", "yes", "y", "pinned"].includes(value);
  }

  function scrumImportChanged(log, updates) {
    return Number(log.projectId || 0) !== Number(updates.projectId || 0)
      || scrumDateInputValue(log.logDate) !== updates.logDate
      || String(log.bodyHtml || "") !== String(updates.bodyHtml || "")
      || Boolean(log.isPinned) !== Boolean(updates.isPinned);
  }

  function scrumImportHash(log) {
    return stableHash([
      log?.id || "",
      log?.userId || "",
      scrumDateInputValue(log?.logDate),
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

  function scrumDialogTitle(log, newTitle) {
    if (!log?.id) return newTitle;
    const user = userById(log.userId);
    return ["Scrum", formatDate(log.logDate), user?.nickname || "User"].join(" - ");
  }

  function viewDevLog(log) {
    if (!log) return;

    const user = userById(log.userId);
    showReadOnlyDialog(scrumDialogTitle(log, "Scrum"), `
      <div class="detail-grid scrum-detail-grid">
        <div class="detail-field">
          <span>Date</span>
          <div>${escapeHtml(formatDate(log.logDate))}</div>
        </div>
        <div class="detail-field">
          <span>Project</span>
          <div>${log.projectId ? escapeHtml(projectName(log.projectId)) : `<span class="muted">No project</span>`}</div>
        </div>
        <div class="detail-field">
          <span>Person</span>
          <div>${escapeHtml(user?.nickname || "User")}</div>
        </div>
        ${log.isPinned ? `
          <div class="detail-field">
            <span>Flag</span>
            <div><span class="pill scrum-pin">Pinned</span></div>
          </div>
        ` : ""}
        <div class="detail-field full">
          <span>Scrum</span>
          <div class="scrum-content">${log.bodyHtml}</div>
        </div>
      </div>
    `);
  }

  function viewDevLogById(id) {
    const log = state.devLogs.find(item => item.id === Number(id || 0) && isSharedScrumLog(item));
    if (!log) return false;

    viewDevLog(log);
    return true;
  }

  async function duplicateDevLog(id) {
    const log = state.devLogs.find(item => item.id === id && isSharedScrumLog(item));
    if (!log) return;

    try {
      const logDate = scrumDateInputValue(new Date());
      const dateError = scrumDateValidationMessage(log.projectId || null, logDate);
      if (dateError) {
        showToast(dateError);
        return;
      }

      await saveJson("/api/devlogs", "POST", {
        id: 0,
        logType: sharedScrumLogType,
        projectId: log.projectId || null,
        logDate,
        bodyHtml: log.bodyHtml,
        isPinned: false
      });
      await loadState();
      render();
      showToast("Scrum duplicated.");
    } catch (error) {
      showToast(error.message);
    }
  }

  function newScrumEntryHtml(projectId, logDate) {
    return [
      scrumSectionHtml(scrumYesterdayPrompt, previousScrumTodayItems(projectId, logDate)),
      scrumSectionHtml(scrumTodayPrompt, []),
      scrumSectionHtml(scrumRoadblocksPrompt, [])
    ].join("");
  }

  function scrumSectionHtml(prompt, items) {
    const bulletItems = items.length ? items : [""];
    const listHtml = bulletItems
      .map(item => `<li>${item ? escapeHtml(item) : "<br>"}</li>`)
      .join("");

    return `<p><strong>${escapeHtml(prompt)}</strong></p><ul>${listHtml}</ul>`;
  }

  function previousScrumTodayItems(projectId, logDate) {
    const previousLog = previousScrumLog(projectId, logDate);
    return previousLog ? scrumSectionItems(previousLog.bodyHtml, scrumTodayPrompt) : [];
  }

  function previousScrumLog(projectId, logDate) {
    const userId = currentUser().id;
    const selectedProjectId = Number(projectId || 0);
    const selectedDate = scrumDateInputValue(logDate);
    const userLogs = state.devLogs
      .filter(isSharedScrumLog)
      .filter(item => item.userId === userId)
      .filter(item => !selectedDate || scrumDateInputValue(item.logDate) < selectedDate);
    const projectLogs = selectedProjectId
      ? userLogs.filter(item => item.projectId === selectedProjectId)
      : userLogs;
    const preferredLog = sortPreviousScrumLogs(projectLogs)[0];

    return preferredLog || (selectedProjectId ? sortPreviousScrumLogs(userLogs)[0] : null) || null;
  }

  function sortPreviousScrumLogs(logs) {
    return [...logs].sort((a, b) => {
      return scrumTimeValue(b.logDate) - scrumTimeValue(a.logDate)
        || scrumTimeValue(b.updatedAt) - scrumTimeValue(a.updatedAt)
        || scrumTimeValue(b.createdAt) - scrumTimeValue(a.createdAt)
        || b.id - a.id;
    });
  }

  function scrumSectionItems(html, prompt) {
    const lines = scrumTextLines(html);
    const startIndex = lines.findIndex(line => scrumPromptMatches(line, prompt));
    if (startIndex < 0) return [];

    const items = [];
    for (const line of lines.slice(startIndex + 1)) {
      if (scrumPrompts.some(candidate => scrumPromptMatches(line, candidate))) break;
      if (line) items.push(line);
    }

    return items;
  }

  function scrumBodyHtmlForSave(root) {
    const bodyHtml = richValue(root, "bodyHtml");
    if (scrumSectionItems(bodyHtml, scrumRoadblocksPrompt).length) return bodyHtml;

    const container = document.createElement("div");
    container.innerHTML = bodyHtml;
    const heading = [...container.querySelectorAll("p, div, h1, h2, h3, strong, b")]
      .find(element => scrumPromptMatches(element.textContent, scrumRoadblocksPrompt));
    const sectionRoot = heading?.closest("p, div, h1, h2, h3") || heading;
    const list = sectionRoot ? nextScrumSectionList(sectionRoot) : null;

    if (list) {
      list.innerHTML = "<li>None</li>";
      return container.innerHTML;
    }

    return `${bodyHtml}${scrumSectionHtml(scrumRoadblocksPrompt, ["None"])}`;
  }

  function nextScrumSectionList(sectionRoot) {
    let next = sectionRoot.nextElementSibling;
    while (next) {
      if (scrumPrompts.some(candidate => scrumPromptMatches(next.textContent, candidate))) return null;
      if (next.matches("ul, ol")) return next;
      next = next.nextElementSibling;
    }

    return null;
  }

  function scrumTextLines(html) {
    const container = document.createElement("div");
    container.innerHTML = html || "";
    container.querySelectorAll("br").forEach(element => {
      element.replaceWith(document.createTextNode("\n"));
    });
    container.querySelectorAll("li").forEach(element => {
      element.prepend(document.createTextNode("\n"));
      element.appendChild(document.createTextNode("\n"));
    });
    container.querySelectorAll("p, div, h1, h2, h3").forEach(element => {
      element.appendChild(document.createTextNode("\n"));
    });

    return container.textContent
      .split(/\n+/)
      .map(line => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);
  }

  function scrumPromptMatches(line, prompt) {
    return normalizeScrumPrompt(line) === normalizeScrumPrompt(prompt);
  }

  function normalizeScrumPrompt(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .replace(/:$/, "")
      .trim()
      .toLowerCase();
  }

  function bindScrumDateBounds(root) {
    const dateInput = root.querySelector("[name='logDate']");
    const projectSelect = root.querySelector("[name='projectId']");
    if (!dateInput) return;

    const applyBounds = () => {
      const projectId = optionalNumberValue(root, "projectId");
      const minDate = scrumMinDateKey(projectId);
      const maxDate = scrumMaxDateKey();

      if (minDate) dateInput.min = minDate;
      else dateInput.removeAttribute("min");

      if (maxDate) dateInput.max = maxDate;
      else dateInput.removeAttribute("max");
    };

    projectSelect?.addEventListener("change", applyBounds);
    applyBounds();
  }

  function scrumDateValidationMessage(projectId, logDate) {
    const selectedDate = scrumDateInputValue(logDate);
    if (!selectedDate) return "Scrum date is required.";
    if (currentUser().isAdmin) return "";

    const projectStartDate = scrumProjectStartDateKey(projectId);
    if (projectStartDate && selectedDate < projectStartDate) {
      return `Scrum entries cannot be dated before ${projectName(projectId)} starts on ${scrumDisplayDateKey(projectStartDate)}.`;
    }

    if (selectedDate < scrumPastLimitDateKey()) {
      return "Scrum entries cannot be dated more than 2 weeks in the past.";
    }

    if (selectedDate > scrumMaxDateKey()) {
      return "Scrum entries cannot be dated more than 1 day in the future.";
    }

    return "";
  }

  function scrumProjectStartDateKey(projectId) {
    const project = state.projects.find(item => item.id === Number(projectId || 0));
    return project?.startDate ? scrumDateInputValue(project.startDate) : "";
  }

  function scrumMinDateKey(projectId) {
    if (currentUser().isAdmin) return "";

    const projectStartDate = scrumProjectStartDateKey(projectId);
    const pastLimitDate = scrumPastLimitDateKey();
    if (!projectStartDate) return pastLimitDate;

    return projectStartDate > pastLimitDate ? projectStartDate : pastLimitDate;
  }

  function scrumPastLimitDateKey() {
    const date = new Date();
    date.setDate(date.getDate() - 14);
    return scrumDateInputValue(date);
  }

  function scrumMaxDateKey() {
    if (currentUser().isAdmin) return "";

    const date = new Date();
    date.setDate(date.getDate() + 1);
    return scrumDateInputValue(date);
  }

  function scrumDateInputValue(value) {
    if (!value) return "";
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    return dateKey(value);
  }

  function scrumDisplayDateKey(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
    if (!match) return formatDate(value);

    return formatDate(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }

  function focusRichEditorEmptyBullet(root, richName, prompt) {
    const editor = root.querySelector(`[data-rich='${richName}']`);
    if (!editor) return;

    setTimeout(() => {
      editor.focus();
      const bullet = emptyBulletAfterPrompt(editor, prompt);
      if (bullet) placeCaretInside(bullet);
      else placeCaretAfterText(editor, prompt);
    }, 40);
  }

  function emptyBulletAfterPrompt(editor, prompt) {
    const headings = [...editor.querySelectorAll("p, strong, b, h1, h2, h3")];
    const heading = headings.find(element => scrumPromptMatches(element.textContent, prompt));
    let next = heading?.closest("p, h1, h2, h3")?.nextElementSibling || heading?.nextElementSibling;

    while (next) {
      if (scrumPrompts.some(candidate => scrumPromptMatches(next.textContent, candidate))) return null;

      if (next.matches("ul, ol")) {
        return [...next.querySelectorAll("li")].find(item => !item.textContent.trim())
          || next.querySelector("li");
      }

      if (next.matches("li") && !next.textContent.trim()) return next;
      next = next.nextElementSibling;
    }

    return null;
  }

  function placeCaretInside(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function placeCaretAfterText(container, text) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();

    while (node) {
      const index = node.nodeValue.indexOf(text);
      if (index >= 0) {
        const range = document.createRange();
        range.setStart(node, index + text.length);
        range.collapse(true);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      node = walker.nextNode();
    }
  }

  function resetScrumView() {
    [
      preferenceKeys.scrumFilters,
      preferenceKeys.scrumEntryProject,
      scrumTableColumnPreferenceKey
    ].forEach(removePreference);

    scrumFilters = normalizeScrumFilters({});
    scrumEntryProjectId = 0;
    scrumColumnPrefs = normalizeScrumColumnPrefs({});
    scrumTableMode.deactivate();
    cancelScrumColumnDrag();
    renderDevLogs();
  }

  function deactivateScrum() {
    document.querySelectorAll("[data-scrum-filter-dialog]").forEach(dialog => {
      if (dialog.open) dialog.close();
      else dialog.remove();
    });
    cancelScrumColumnDrag();
    scrumTableMode.deactivate();
  }

  return {
    deactivate: deactivateScrum,
    handleAction,
    handleFilterChange,
    render: renderDevLogs,
    view: viewDevLogById
  };
}
