import { buttonContent, funnelIconHtml, iconButton, pageActionsMenuHtml } from "../../components/buttons.js?v=20260701-unified-dropdowns";
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
} from "../../components/forms.js?v=20260722-rte-toggle-state-v1";
import { sectionHead } from "../../components/sections.js?v=release-notes-2026-07-22-day-35-b9e5ce970062";
import { createWorkItemTableMode } from "../../components/work-items.js?v=20260720-work-item-export-images-v4";
import { currentUser } from "../../core/authentication.js?v=20260715-admin-impersonation";
import {
  preferenceKeys,
  readBooleanPreference,
  readJsonPreference,
  readNumberPreference,
  readPreference,
  removePreference,
  writeJsonPreference,
  writePreference
} from "../../core/preferences.js?v=20260716-scrum-auto-refresh";
import { loadState as refreshApplicationState, state } from "../../core/store.js";
import {
  dateKey,
  formatDate,
  formatDateTime
} from "../../shared/dates.js";
import { normalizeSavedArray } from "../../shared/filter-values.js";
import { canDeleteOwner, canEditOwner } from "../../shared/permissions.js?v=20260715-admin-impersonation";
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
  importFirstNonEmptyCell,
  importIconHtml,
  normalizeImportText,
  openExcelImport,
  resolveImportProjectId,
  openExportDialog,
  showImportResultDialog
} from "../../shared/table-export.js?v=20260715-save-collision";

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
const scrumCalendarVisiblePreferenceKey = "pmt-scrum-calendar-visible";
const scrumAttendanceStatusPreferenceKey = "pmt-scrum-attendance-status";
export const SCRUM_AUTO_REFRESH_INTERVAL_MS = 5000;
const scrumAttendanceCalendarOrder = ["Office", "Home", "Sick Leave", "Vacation", "EL", "Other"];
const scrumWeekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const scrumAttendanceStatusDefinitions = Object.freeze([
  Object.freeze({ value: "Office", icon: "&#127970;", title: "Office" }),
  Object.freeze({ value: "Home", icon: "&#127968;", title: "Home" }),
  Object.freeze({ value: "Sick Leave", icon: "&#129298;", title: "Sick Leave" }),
  Object.freeze({ value: "Vacation", icon: "&#9728;", title: "Vacation" }),
  Object.freeze({ value: "EL", icon: "&#9888;", title: "Emergency Leave" }),
  Object.freeze({ value: "Other", icon: "&#8230;", title: "Other" })
]);
export const SCRUM_ATTENDANCE_STATUSES = Object.freeze(scrumAttendanceStatusDefinitions.map(item => item.value));

function normalizedScrumAttendanceStatus(status) {
  return SCRUM_ATTENDANCE_STATUSES.includes(status) ? status : "Office";
}

export function scrumAutoRefreshCanRun({ active, blocked, enabled, inFlight, loading } = {}) {
  return Boolean(active && enabled && !blocked && !inFlight && !loading);
}

export function scrumToggledPersonIds(personIds = [], personId) {
  const id = String(personId || "");
  if (!id) return Array.isArray(personIds) ? [...personIds] : [];
  return Array.isArray(personIds) && personIds.map(String).includes(id) ? [] : [id];
}

export function scrumCalendarDateKeys(year, monthIndex) {
  const firstDay = new Date(Number(year), Number(monthIndex), 1);
  if (Number.isNaN(firstDay.getTime())) return [];

  const keys = Array(firstDay.getDay()).fill("");
  const dayCount = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();
  for (let day = 1; day <= dayCount; day += 1) {
    keys.push(scrumLocalDateKey(new Date(firstDay.getFullYear(), firstDay.getMonth(), day)));
  }
  return keys;
}

export function scrumAttendanceOccurrences(entries = [], vacations = [], startDate, endDate) {
  const startKey = dateKey(startDate);
  const endKey = dateKey(endDate);
  if (!startKey || !endKey || startKey > endKey) return [];

  const occurrences = new Map();
  const addOccurrence = occurrence => {
    if (!occurrence.dateKey || occurrence.dateKey < startKey || occurrence.dateKey > endKey) return;
    if (!attendanceStatusDefinition(occurrence.status) || !occurrence.userId) return;

    const key = `${occurrence.dateKey}|${occurrence.userId}|${occurrence.status}`;
    const existing = occurrences.get(key);
    if (!existing || attendanceOccurrenceComesAfter(occurrence, existing)) occurrences.set(key, occurrence);
  };

  (entries || []).forEach(entry => addOccurrence({
    dateKey: dateKey(entry.attendanceDate),
    userId: Number(entry.userId || 0),
    status: String(entry.status || ""),
    source: "attendance",
    sourceId: Number(entry.id || 0),
    createdAt: String(entry.createdAt || ""),
    updatedAt: String(entry.updatedAt || "")
  }));

  (vacations || []).forEach(vacation => {
    const vacationStartKey = dateKey(vacation.startDate);
    const vacationEndKey = dateKey(vacation.endDate);
    const firstKey = vacationStartKey > startKey ? vacationStartKey : startKey;
    const lastKey = vacationEndKey < endKey ? vacationEndKey : endKey;
    const cursor = scrumLocalDate(firstKey);
    const last = scrumLocalDate(lastKey);
    while (cursor && last && cursor <= last) {
      addOccurrence({
        dateKey: scrumLocalDateKey(cursor),
        userId: Number(vacation.userId || 0),
        status: "Vacation",
        source: "vacation",
        sourceId: Number(vacation.id || 0),
        createdAt: String(vacation.createdAt || ""),
        updatedAt: String(vacation.updatedAt || "")
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  return [...occurrences.values()]
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey)
      || scrumAttendanceStatusIndex(a.status) - scrumAttendanceStatusIndex(b.status)
      || a.userId - b.userId);
}

export function scrumAttendanceStatusGroups(occurrences = []) {
  return scrumAttendanceCalendarOrder
    .map(status => ({
      status,
      entries: (occurrences || []).filter(occurrence => occurrence.status === status)
    }))
    .filter(group => group.entries.length);
}

export function createScrumFeature({
  api,
  app,
  askYesNo,
  deleteItem,
  hydrateLinkedDiagrams,
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
  let scrumCalendarVisible = readBooleanPreference(scrumCalendarVisiblePreferenceKey, false);
  let scrumAutoRefreshEnabled = readBooleanPreference(preferenceKeys.scrumAutoRefresh, true);
  let scrumAttendanceStatus = normalizedScrumAttendanceStatus(readPreference(scrumAttendanceStatusPreferenceKey, "Office"));
  let scrumCalendarMonth = scrumMonthStart(new Date());
  const scrumAttendanceMonthCache = new Map();
  let scrumAttendanceCacheUserId = Number(currentUser()?.id || 0);
  let scrumCalendarPendingFocusSelector = "";
  let scrumColumnDrag = null;
  let lastScrumColumnPointerDragAt = 0;
  let suppressNextScrumColumnClick = false;
  let scrumHeaderResizeFrame = 0;
  let scrumAutoRefreshTimer = 0;
  let scrumAutoRefreshInFlight = false;
  let scrumIsActive = false;
  let scrumCalendarAvatarMenu = null;
  const scrumTableMode = createWorkItemTableMode({
    action: "toggle-scrum-table-edit-mode",
    itemLabel: "Scrum"
  });

  bindScrumColumnDragEvents();
  window.addEventListener("resize", scheduleScrumHeaderFit);

  function renderDevLogs() {
    scrumIsActive = true;
    if (scrumFilters.projectId && !state.projects.some(project => project.id === Number(scrumFilters.projectId))) {
      scrumFilters.projectId = "";
    }

    syncScrumPersonFilterWithUsers();
    syncScrumAttendanceCacheUser();
    void ensureScrumAttendanceMonth(scrumMonthStart(new Date()));
    if (scrumCalendarVisible) void ensureScrumAttendanceMonth(scrumCalendarMonth);

    const logs = state.devLogs
      .filter(isSharedScrumLog)
      .filter(log => !scrumFilters.projectId || log.projectId === Number(scrumFilters.projectId))
      .filter(log => !scrumFilters.personIds.length || scrumFilters.personIds.includes(String(log.userId)))
      .filter(log => !scrumFilters.logDate || dateKey(log.logDate) === scrumFilters.logDate)
      .filter(scrumMatchesSearchFilter)
      .sort(scrumSortCompare);
    const visibleScrumColumns = scrumVisibleTableColumns();
    const emptyTableColspan = visibleScrumColumns.length + (scrumTableMode.active ? 1 : 0);
    const todayOccurrences = scrumTodayAttendanceOccurrences();
    const canCreateAttendance = canAccessResource("Scrum", "Create");
    const canUpdateAttendance = canAccessResource("Scrum", "Update");

    app.innerHTML = `
      <section class="scrum-screen work-item-screen">
        ${sectionHead("Scrum", `
          ${scrumTodayAttendanceHtml(todayOccurrences)}
          ${scrumAttendanceCheckInHtml(canCreateAttendance)}
          <button class="primary text-icon-button" type="button" data-action="new-log" title="New Scrum" aria-label="New Scrum">${buttonContent("&#10010;", "New Scrum")}</button>
          <button class="secondary text-icon-button" type="button" data-action="open-scrum-filters" title="Filters" aria-label="Filters" aria-haspopup="dialog">${buttonContent(funnelIconHtml(), "Filters")}</button>
          ${pageActionsMenuHtml([
            { action: "toggle-scrum-calendar-view", icon: "&#128197;", label: "Calendar View", title: "Show or hide Calendar View", checked: scrumCalendarVisible },
            { action: "toggle-scrum-table-edit-mode", icon: "&#9998;", label: "Edit Mode", title: "Edit Mode", checked: scrumTableMode.active, separatorBefore: true },
            { action: "toggle-scrum-auto-refresh", icon: "&#8635;", label: "Auto Refresh", title: "Auto Refresh every 5 seconds", checked: scrumAutoRefreshEnabled },
            { action: "open-scrum-on-behalf", icon: "&#128101;", label: "On Behalf Of...", title: "On Behalf Of...", disabled: !canUpdateAttendance, separatorBefore: true },
            { action: "open-scrum-vacation", icon: "&#9728;", label: "Vacation...", title: "Vacation...", disabled: !canCreateAttendance && !canUpdateAttendance },
            { action: "export-scrum-view", icon: exportIconHtml(), label: "Export", title: "Export", separatorBefore: true },
            { action: "import-scrum-view", icon: importIconHtml(), label: "Import", title: "Import" },
            { action: "reset-scrum-view", icon: "&#8634;", label: "Reset View", title: "Reset View", separatorBefore: true }
          ])}
        `)}
        ${scrumCalendarVisible ? scrumCalendarHtml() : ""}
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
    fitScrumHeader();
    restoreScrumCalendarFocus();
    hydrateLinkedDiagrams?.(app);
    scheduleScrumAutoRefresh();
  }

  function scheduleScrumAutoRefresh() {
    window.clearTimeout(scrumAutoRefreshTimer);
    scrumAutoRefreshTimer = 0;
    if (!scrumIsActive || !scrumAutoRefreshEnabled || scrumAutoRefreshInFlight) return;
    scrumAutoRefreshTimer = window.setTimeout(runScrumAutoRefresh, SCRUM_AUTO_REFRESH_INTERVAL_MS);
  }

  async function runScrumAutoRefresh() {
    scrumAutoRefreshTimer = 0;
    const active = scrumIsActive && Boolean(app.querySelector(".scrum-screen"));
    const loading = [...scrumAttendanceMonthCache.values()].some(record => record?.loading);
    if (!scrumAutoRefreshCanRun({
      active,
      blocked: scrumAutoRefreshIsBlocked(),
      enabled: scrumAutoRefreshEnabled,
      inFlight: scrumAutoRefreshInFlight,
      loading
    })) {
      scheduleScrumAutoRefresh();
      return;
    }

    scrumAutoRefreshInFlight = true;
    try {
      await refreshApplicationState();
      if (!scrumIsActive || !app.querySelector(".scrum-screen") || scrumAutoRefreshIsBlocked()) return;
      await refreshScrumAttendance({ render: false });
      if (!scrumIsActive || !app.querySelector(".scrum-screen") || scrumAutoRefreshIsBlocked()) return;

      const viewState = captureScrumViewState();
      renderDevLogs();
      restoreScrumViewState(viewState);
    } catch {
      // A later cycle retries without replacing the current Scrum screen.
    } finally {
      scrumAutoRefreshInFlight = false;
      scheduleScrumAutoRefresh();
    }
  }

  function scrumAutoRefreshIsBlocked() {
    if (scrumColumnDrag) return true;
    if (scrumCalendarAvatarMenu) return true;
    if (document.querySelector("#editorDialog[open], dialog.detail-dialog[open], [data-scrum-filter-dialog][open], [data-scrum-check-in-dialog][open], [data-scrum-on-behalf-dialog][open], [data-scrum-vacation-dialog][open]")) return true;
    if (app.querySelector(".pmt-diagram-ole-viewport.is-panning")) return true;
    const activeElement = document.activeElement;
    if (activeElement?.closest?.(".pmt-diagram-ole")) return true;
    return Boolean(activeElement && app.contains(activeElement) && activeElement.matches("select, input, textarea, [contenteditable='true']"));
  }

  function captureScrumViewState() {
    const calendarWrap = app.querySelector(".scrum-calendar-grid-wrap");
    return {
      appScrollTop: app.scrollTop,
      calendarScrollLeft: calendarWrap?.scrollLeft || 0,
      calendarScrollTop: calendarWrap?.scrollTop || 0,
      focusSelector: scrumFocusSelector(document.activeElement),
      menuOpen: Boolean(app.querySelector(".page-actions-menu[open]")),
      tableScrollLeft: app.querySelector(".scrum-table-wrap")?.scrollLeft || 0
    };
  }

  function restoreScrumViewState(viewState) {
    if (!viewState) return;
    if (viewState.menuOpen) app.querySelector(".page-actions-menu")?.setAttribute("open", "");
    const focused = viewState.focusSelector ? app.querySelector(viewState.focusSelector) : null;
    focused?.focus({ preventScroll: true });
    const tableWrap = app.querySelector(".scrum-table-wrap");
    if (tableWrap) tableWrap.scrollLeft = viewState.tableScrollLeft;
    const calendarWrap = app.querySelector(".scrum-calendar-grid-wrap");
    if (calendarWrap) {
      calendarWrap.scrollLeft = viewState.calendarScrollLeft;
      calendarWrap.scrollTop = viewState.calendarScrollTop;
    }
    app.scrollTop = viewState.appScrollTop;
  }

  function scrumFocusSelector(element) {
    if (!(element instanceof Element) || !app.contains(element)) return "";
    if (element.matches(".page-actions-summary")) return ".page-actions-summary";
    const action = element.dataset?.action;
    if (action) {
      let selector = `[data-action="${CSS.escape(action)}"]`;
      for (const key of ["mode", "id", "column"]) {
        if (element.dataset[key]) selector += `[data-${key}="${CSS.escape(element.dataset[key])}"]`;
      }
      return selector;
    }

    const filter = element.dataset?.filter;
    return filter ? `[data-filter="${CSS.escape(filter)}"]` : "";
  }

  function scheduleScrumHeaderFit() {
    cancelAnimationFrame(scrumHeaderResizeFrame);
    scrumHeaderResizeFrame = requestAnimationFrame(fitScrumHeader);
  }

  function fitScrumHeader() {
    const header = app.querySelector(".scrum-screen .section-head");
    const title = header?.querySelector("h1");
    const roster = header?.querySelector("[data-scrum-attendance-roster]");
    const checkIn = header?.querySelector("[data-action='check-in-attendance']");
    if (!header || !title || !roster || !checkIn) return;

    roster.style.removeProperty("left");
    roster.style.removeProperty("width");
    roster.style.removeProperty("--scrum-today-avatar-size");
    roster.style.removeProperty("--scrum-attendance-badge-size");
    roster.style.removeProperty("--scrum-attendance-badge-font-size");
    if (window.matchMedia("(max-width: 900px)").matches) return;

    const headerBox = header.getBoundingClientRect();
    const titleBox = title.getBoundingClientRect();
    const checkInBox = checkIn.getBoundingClientRect();
    const headerGap = Number.parseFloat(getComputedStyle(header).columnGap) || 0;
    const left = Math.ceil(titleBox.right - headerBox.left + headerGap);
    const right = Math.floor(checkInBox.left - headerBox.left - headerGap);
    const width = Math.max(0, right - left);
    const avatarCount = roster.querySelectorAll("[data-scrum-today-user]").length;
    const avatarGap = Number.parseFloat(getComputedStyle(roster).columnGap) || 0;
    const buttonChrome = 6;
    const fittedSize = avatarCount
      ? Math.floor((width - avatarGap * Math.max(0, avatarCount - 1)) / avatarCount - buttonChrome)
      : 74;
    const avatarSize = Math.max(16, Math.min(74, fittedSize));
    const badgeSize = Math.max(16, Math.min(28, Math.round(avatarSize * 0.4)));
    const badgeFontSize = Math.max(10, Math.min(17, Math.round(badgeSize * 0.6)));

    roster.style.left = `${left}px`;
    roster.style.width = `${width}px`;
    roster.style.setProperty("--scrum-today-avatar-size", `${avatarSize}px`);
    roster.style.setProperty("--scrum-attendance-badge-size", `${badgeSize}px`);
    roster.style.setProperty("--scrum-attendance-badge-font-size", `${badgeFontSize}px`);
  }

  async function ensureScrumAttendanceMonth(monthValue, options = {}) {
    syncScrumAttendanceCacheUser();
    const month = scrumMonthStart(monthValue);
    const key = scrumMonthKey(month);
    if (!key) return null;

    const existing = scrumAttendanceMonthCache.get(key);
    if (!options.force && existing?.loaded) return existing;
    if (!options.force && existing?.promise) return existing.promise;

    const startDate = scrumLocalDateKey(month);
    const endDate = scrumLocalDateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0));
    const record = {
      entries: [],
      error: "",
      loaded: false,
      loading: true,
      promise: null,
      vacations: []
    };
    scrumAttendanceMonthCache.set(key, record);

    record.promise = (async () => {
      try {
        const result = await api(`/api/attendance?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
        if (scrumAttendanceMonthCache.get(key) !== record) return record;
        record.entries = Array.isArray(result?.entries) ? result.entries : [];
        record.vacations = Array.isArray(result?.vacations) ? result.vacations : [];
        record.loaded = true;
      } catch (error) {
        if (scrumAttendanceMonthCache.get(key) !== record) return record;
        record.error = error?.message || "Attendance could not be loaded.";
        record.loaded = true;
      } finally {
        record.loading = false;
        record.promise = null;
        if (scrumAttendanceMonthCache.get(key) === record && options.render !== false) render();
      }
      return record;
    })();

    return record.promise;
  }

  async function refreshScrumAttendance(options = {}) {
    const months = [scrumMonthStart(new Date()), scrumCalendarMonth]
      .filter((month, index, values) => values.findIndex(item => scrumMonthKey(item) === scrumMonthKey(month)) === index);
    scrumAttendanceMonthCache.clear();
    await Promise.all(months.map(month => ensureScrumAttendanceMonth(month, { render: false })));
    if (options.render !== false) render();
  }

  function scrumAttendanceMonthRecord(monthValue) {
    return scrumAttendanceMonthCache.get(scrumMonthKey(scrumMonthStart(monthValue))) || null;
  }

  function syncScrumAttendanceCacheUser() {
    const userId = Number(currentUser()?.id || 0);
    if (userId === scrumAttendanceCacheUserId) return;
    scrumAttendanceCacheUserId = userId;
    scrumAttendanceMonthCache.clear();
  }

  function scrumTodayAttendanceOccurrences() {
    const today = new Date();
    const record = scrumAttendanceMonthRecord(today);
    if (!record?.loaded) return [];
    return scrumAttendanceOccurrences(record.entries, record.vacations, today, today);
  }

  function scrumLatestTodayAttendanceByUser(occurrences) {
    const byUser = new Map();
    (occurrences || []).forEach(occurrence => {
      const existing = byUser.get(occurrence.userId);
      if (!existing || attendanceOccurrenceComesAfter(occurrence, existing)) byUser.set(occurrence.userId, occurrence);
    });
    return byUser;
  }

  function scrumTodayAttendanceHtml(occurrences) {
    const attendanceByUser = scrumLatestTodayAttendanceByUser(occurrences);
    const users = state.users.filter(user => user.isActive !== false && attendanceByUser.has(Number(user.id)));

    return `
      <div class="scrum-today-attendance" data-scrum-attendance-roster aria-label="Today's attendance">
        ${users.map(user => {
          const attendance = attendanceByUser.get(Number(user.id));
          const definition = attendanceStatusDefinition(attendance.status);
          const selected = scrumFilters.personIds.includes(String(user.id));
          const userName = scrumAttendanceUserName(user);
          return `
            <button type="button" class="scrum-today-person ${selected ? "is-selected" : ""}" data-action="filter-scrum-person" data-id="${user.id}" data-scrum-today-user="${user.id}" title="${escapeAttr(`${userName} - ${definition.title}`)}" aria-label="${escapeAttr(`Filter Scrum by ${userName} - ${definition.title}`)}" aria-pressed="${selected}">
              <span class="scrum-today-avatar-wrap">
                <img class="scrum-today-avatar" src="${escapeAttr(user.avatarUrl || "/assets/avatar-default.svg")}" alt="">
                <span class="scrum-attendance-badge" data-attendance-status="${escapeAttr(attendance.status)}" title="${escapeAttr(definition.title)}" aria-hidden="true">${definition.icon}</span>
              </span>
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  function scrumAttendanceCheckInHtml(canCreateAttendance) {
    return `
      <div class="scrum-attendance-check-in" data-scrum-attendance-control>
        <button class="primary text-icon-button" type="button" data-action="check-in-attendance" title="Check-In" aria-label="Check-In" ${canCreateAttendance ? "" : "disabled"}>${buttonContent("&#10003;", "Check-In")}</button>
      </div>
    `;
  }

  function scrumAttendanceOptionsHtml(selectedStatus = "") {
    return scrumAttendanceStatusDefinitions.map(definition => `
      <option value="${escapeAttr(definition.value)}" title="${escapeAttr(definition.title)}" ${definition.value === selectedStatus ? "selected" : ""}>${definition.icon} ${escapeHtml(definition.value)}</option>
    `).join("");
  }

  function scrumCalendarHtml() {
    const record = scrumAttendanceMonthRecord(scrumCalendarMonth);
    const monthLabel = scrumCalendarMonth.toLocaleString(undefined, { month: "long", year: "numeric" });
    return `
      <section class="panel scrum-calendar-panel" data-scrum-calendar aria-label="Attendance calendar">
        <div class="scrum-calendar-head">
          <div>
            <h2>Attendance Calendar</h2>
            <p>${escapeHtml(monthLabel)}</p>
          </div>
          ${scrumCalendarControlsHtml()}
        </div>
        ${record?.error
          ? `<div class="empty scrum-calendar-message">${escapeHtml(record.error)}</div>`
          : record?.loaded
            ? scrumCalendarGridHtml(record)
            : `<div class="empty scrum-calendar-message">Loading attendance...</div>`}
      </section>
    `;
  }

  function scrumCalendarControlsHtml() {
    const month = scrumCalendarMonth.getMonth();
    const year = scrumCalendarMonth.getFullYear();
    return `
      <div class="scrum-calendar-controls">
        <button class="secondary text-icon-button" type="button" data-action="scrum-calendar-previous" title="Previous month" aria-label="Previous month">${buttonContent("&#8249;", "Previous")}</button>
        <label>
          <span>Month</span>
          <select data-filter="scrum-calendar-month" data-scrum-calendar-month aria-label="Calendar month">
            ${Array.from({ length: 12 }, (_, index) => `<option value="${index}" ${index === month ? "selected" : ""}>${escapeHtml(new Date(2000, index, 1).toLocaleString(undefined, { month: "long" }))}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Year</span>
          <select data-filter="scrum-calendar-year" data-scrum-calendar-year aria-label="Calendar year">
            ${scrumCalendarYears().map(item => `<option value="${item}" ${item === year ? "selected" : ""}>${item}</option>`).join("")}
          </select>
        </label>
        <button class="secondary text-icon-button" type="button" data-action="scrum-calendar-today">${buttonContent("&#9673;", "Today")}</button>
        <button class="secondary text-icon-button" type="button" data-action="scrum-calendar-next" title="Next month" aria-label="Next month">${buttonContent("&#8250;", "Next")}</button>
      </div>
    `;
  }

  function rememberScrumCalendarFocus(element) {
    if (element?.dataset?.action) {
      scrumCalendarPendingFocusSelector = `[data-action="${element.dataset.action}"]`;
      return;
    }
    if (element?.dataset?.filter) {
      scrumCalendarPendingFocusSelector = `[data-filter="${element.dataset.filter}"]`;
    }
  }

  function restoreScrumCalendarFocus() {
    if (!scrumCalendarPendingFocusSelector) return;
    app.querySelector(scrumCalendarPendingFocusSelector)?.focus({ preventScroll: true });
    if (scrumAttendanceMonthRecord(scrumCalendarMonth)?.loaded) scrumCalendarPendingFocusSelector = "";
  }

  function scrumCalendarYears() {
    const selectedYear = scrumCalendarMonth.getFullYear();
    const currentYear = new Date().getFullYear();
    const years = new Set([selectedYear, currentYear]);
    for (let year = currentYear - 5; year <= currentYear + 5; year += 1) years.add(year);
    scrumAttendanceMonthCache.forEach(record => {
      [...(record.entries || []).map(item => item.attendanceDate), ...(record.vacations || []).flatMap(item => [item.startDate, item.endDate])]
        .map(value => Number(dateKey(value).slice(0, 4)))
        .filter(Number.isFinite)
        .forEach(year => years.add(year));
    });
    return [...years].sort((a, b) => a - b);
  }

  function scrumCalendarGridHtml(record) {
    const year = scrumCalendarMonth.getFullYear();
    const month = scrumCalendarMonth.getMonth();
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    const occurrences = scrumAttendanceOccurrences(record.entries, record.vacations, startDate, endDate);
    const occurrencesByDate = new Map();
    occurrences.forEach(occurrence => {
      if (!occurrencesByDate.has(occurrence.dateKey)) occurrencesByDate.set(occurrence.dateKey, []);
      occurrencesByDate.get(occurrence.dateKey).push(occurrence);
    });
    const holidays = scrumHolidaysByDate();
    const calendarLabel = `${scrumCalendarMonth.toLocaleString(undefined, { month: "long", year: "numeric" })} attendance calendar`;
    return `
      <div class="scrum-calendar-grid-wrap" role="region" aria-label="${escapeAttr(calendarLabel)}">
        <div class="scrum-calendar-grid">
          ${scrumWeekdayLabels.map(label => `<div class="scrum-calendar-weekday" aria-hidden="true">${label}</div>`).join("")}
          ${scrumCalendarDateKeys(year, month).map(day => day
            ? scrumCalendarDayHtml(day, occurrencesByDate.get(day) || [], holidays.get(day) || [])
            : `<div class="scrum-calendar-day is-empty" aria-hidden="true"></div>`).join("")}
        </div>
      </div>
    `;
  }

  function scrumCalendarDayHtml(dayKey, occurrences, holidays) {
    const today = dayKey === dateKey(new Date());
    const dayNumber = Number(dayKey.slice(8, 10));
    const groups = scrumAttendanceStatusGroups(occurrences);
    const dayLabel = scrumLocalDate(dayKey)?.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    }) || dayKey;
    return `
      <div class="scrum-calendar-day ${today ? "is-today" : ""}" role="group" aria-label="${escapeAttr(dayLabel)}" data-date="${dayKey}" data-scrum-calendar-day="${dayKey}">
        <div class="scrum-calendar-day-head">
          <span class="scrum-calendar-day-number">${dayNumber}</span>
          ${holidays.length ? `
            <div class="scrum-calendar-holidays">
              ${holidays.map(holiday => `<span data-scrum-holiday title="${escapeAttr(holiday.name)}" aria-label="${escapeAttr(holiday.name)}">${escapeHtml(holiday.name)}</span>`).join("")}
            </div>
          ` : ""}
        </div>
        <div class="scrum-calendar-statuses">
          ${groups.map(scrumCalendarStatusSectionHtml).join("")}
        </div>
      </div>
    `;
  }

  function scrumCalendarStatusSectionHtml(group) {
    const definition = attendanceStatusDefinition(group.status);
    return `
      <div class="scrum-calendar-status-section" data-attendance-status="${escapeAttr(group.status)}" title="${escapeAttr(definition.title)}">
        <span class="scrum-calendar-status-icon" aria-label="${escapeAttr(definition.title)}">${definition.icon}</span>
        <div class="scrum-calendar-avatars">
          ${group.entries.map(occurrence => {
            const user = userById(occurrence.userId);
            if (!user) return "";
            const userName = scrumAttendanceUserName(user);
            const label = `${userName} - ${definition.title}`;
            return `
              <button
                type="button"
                class="scrum-calendar-avatar-button"
                data-action="open-scrum-calendar-avatar-menu"
                data-scrum-calendar-source="${escapeAttr(occurrence.source)}"
                data-scrum-calendar-source-id="${occurrence.sourceId}"
                data-scrum-calendar-user-id="${user.id}"
                title="${escapeAttr(label)}"
                aria-label="${escapeAttr(`${label} actions`)}"
                aria-haspopup="menu"
                aria-expanded="false">
                <img class="scrum-calendar-avatar" data-scrum-calendar-user="${user.id}" src="${escapeAttr(user.avatarUrl || "/assets/avatar-default.svg")}" alt="">
              </button>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  function scrumHolidaysByDate() {
    const holidays = new Map();
    (state.holidays || []).filter(item => item.isActive).forEach(holiday => {
      const key = dateKey(holiday.holidayDate);
      if (!key) return;
      if (!holidays.has(key)) holidays.set(key, []);
      holidays.get(key).push(holiday);
    });
    return holidays;
  }

  function scrumRowHtml(log, visibleColumns) {
    const editable = canModifyScrumLog(log);
    const deletable = canDeleteScrumLog(log);

    return `
      <tr class="scrum-row clickable-row" data-action="view-log" data-id="${log.id}">
        ${visibleColumns.map((column, index) => scrumTableColumnCellHtml(column, log, scrumColumnIsRubber(visibleColumns, index))).join("")}
        ${scrumTableMode.active ? `
          <td class="reveal-actions action-cell scrum-actions" data-label="Actions">
            ${deletable ? iconButton("delete-log", log.id, "Delete", "delete-monochrome") : ""}
            ${editable ? `
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
    const personIds = scrumFilters.personIds.filter(id => validPersonIds.has(id));
    const changed = personIds.length !== scrumFilters.personIds.length
      || personIds.some((id, index) => id !== scrumFilters.personIds[index]);
    scrumFilters.personIds = personIds;
    if (changed) writeJsonPreference(preferenceKeys.scrumFilters, scrumFilters);

    document.querySelectorAll("[data-scrum-filter-dialog] [data-filter='scrum-person']")
      .forEach(input => { input.checked = scrumFilters.personIds.includes(String(input.value)); });
  }

  function canModifyScrumLog(log) {
    if (!log) return false;
    if (currentUser().isAdmin) return true;
    if (!canEditOwner(log.userId, "Scrum")) return false;
    if (scrumLogIsOlderThanModificationWindow(log)) return false;
    return !scrumDateValidationMessage(log.projectId, scrumDateInputValue(log.logDate));
  }

  function canDeleteScrumLog(log) {
    if (!log) return false;
    if (currentUser().isAdmin) return true;
    if (!canDeleteOwner(log.userId, "Scrum")) return false;
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
        cellHtml: log => `<div class="scrum-content" ${devLogRichPersistAttrs(log)}>${log.bodyHtml}</div>`
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

    if (filter === "scrum-calendar-month") {
      const month = Number(target.value);
      if (!Number.isInteger(month) || month < 0 || month > 11) return false;
      rememberScrumCalendarFocus(target);
      scrumCalendarMonth = new Date(scrumCalendarMonth.getFullYear(), month, 1);
      return true;
    }
    if (filter === "scrum-calendar-year") {
      const year = Number(target.value);
      if (!Number.isInteger(year) || year < 1900 || year > 9999) return false;
      rememberScrumCalendarFocus(target);
      scrumCalendarMonth = new Date(year, scrumCalendarMonth.getMonth(), 1);
      return true;
    }

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

    if (action === "open-scrum-calendar-avatar-menu") {
      openScrumCalendarAvatarMenu(element);
      return true;
    }
    if (action === "filter-scrum-person") {
      scrumFilters.personIds = scrumToggledPersonIds(scrumFilters.personIds, id);
      writeJsonPreference(preferenceKeys.scrumFilters, scrumFilters);
      renderDevLogs();
      return true;
    }
    if (action === "check-in-attendance") {
      if (!canAccessResource("Scrum", "Create")) {
        showToast("You do not have permission to check in attendance.");
        return true;
      }
      openScrumCheckInDialog();
      return true;
    }
    if (action === "toggle-scrum-calendar-view") {
      const showCalendar = !scrumCalendarVisible;
      if (showCalendar) await ensureScrumAttendanceMonth(scrumCalendarMonth, { render: false });
      scrumCalendarVisible = showCalendar;
      writePreference(scrumCalendarVisiblePreferenceKey, scrumCalendarVisible);
      renderDevLogs();
      return true;
    }
    if (action === "toggle-scrum-auto-refresh") {
      scrumAutoRefreshEnabled = !scrumAutoRefreshEnabled;
      writePreference(preferenceKeys.scrumAutoRefresh, scrumAutoRefreshEnabled);
      renderDevLogs();
      showToast(`Scrum auto-refresh ${scrumAutoRefreshEnabled ? "enabled" : "disabled"}.`);
      return true;
    }
    if (action === "scrum-calendar-previous") {
      rememberScrumCalendarFocus(element);
      scrumCalendarMonth = new Date(scrumCalendarMonth.getFullYear(), scrumCalendarMonth.getMonth() - 1, 1);
      renderDevLogs();
      return true;
    }
    if (action === "scrum-calendar-next") {
      rememberScrumCalendarFocus(element);
      scrumCalendarMonth = new Date(scrumCalendarMonth.getFullYear(), scrumCalendarMonth.getMonth() + 1, 1);
      renderDevLogs();
      return true;
    }
    if (action === "scrum-calendar-today") {
      rememberScrumCalendarFocus(element);
      scrumCalendarMonth = scrumMonthStart(new Date());
      renderDevLogs();
      return true;
    }
    if (action === "open-scrum-on-behalf") {
      if (!canAccessResource("Scrum", "Update")) {
        showToast("You do not have permission to record attendance on behalf of another person.");
        return true;
      }
      openScrumOnBehalfDialog();
      return true;
    }
    if (action === "open-scrum-vacation") {
      if (!canAccessResource("Scrum", "Create") && !canAccessResource("Scrum", "Update")) {
        showToast("You do not have permission to manage vacations.");
        return true;
      }
      await openScrumVacationDialog();
      return true;
    }
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
      if (log && canDeleteScrumLog(log)) {
        await deleteItem(`/api/devlogs/${id}`, "Delete this Scrum entry?");
      }
      return true;
    }

    return false;
  }

  async function checkInScrumAttendance(status) {
    if (!canAccessResource("Scrum", "Create")) return;
    const userId = Number(currentUser().id || 0);
    if (!userId || !SCRUM_ATTENDANCE_STATUSES.includes(status)) return;

    try {
      await api("/api/attendance", {
        method: "POST",
        body: JSON.stringify({ userId, status })
      });
      scrumAttendanceStatus = status;
      writePreference(scrumAttendanceStatusPreferenceKey, scrumAttendanceStatus);
      await refreshScrumAttendance();
      showToast(`Checked in: ${attendanceStatusDefinition(status).title}.`);
      return true;
    } catch (error) {
      showToast(error.message);
      return false;
    }
  }

  function openScrumCheckInDialog() {
    if (!canAccessResource("Scrum", "Create")) return;
    const existingDialog = document.querySelector("[data-scrum-check-in-dialog]");
    if (existingDialog) {
      if (!existingDialog.open) existingDialog.showModal?.();
      existingDialog.querySelector("[name='status']:checked")?.focus({ preventScroll: true });
      return;
    }

    const modal = document.createElement("dialog");
    modal.className = "dialog mini-dialog scrum-attendance-dialog scrum-check-in-dialog";
    modal.dataset.scrumCheckInDialog = "true";
    modal.setAttribute("aria-labelledby", "scrum-check-in-title");
    modal.innerHTML = `
      <form>
        <div class="dialog-head">
          <h2 id="scrum-check-in-title">Check-In</h2>
          <button type="button" class="icon-btn" data-close-scrum-check-in title="Close" aria-label="Close">x</button>
        </div>
        <div class="dialog-body">
          <fieldset class="scrum-check-in-options" aria-label="Check-In location">
            ${scrumAttendanceStatusDefinitions.map((definition, index) => `
              <label for="scrum-check-in-status-${index}" title="${escapeAttr(definition.title)}">
                <input id="scrum-check-in-status-${index}" type="radio" name="status" value="${escapeAttr(definition.value)}" ${definition.value === scrumAttendanceStatus ? "checked" : ""}>
                <span class="scrum-check-in-option-icon" aria-hidden="true">${definition.icon}</span>
                <span>${escapeHtml(definition.value)}</span>
              </label>
            `).join("")}
          </fieldset>
        </div>
        <div class="dialog-actions">
          <button type="button" class="secondary text-icon-button" data-close-scrum-check-in>${buttonContent("&#10005;", "Cancel")}</button>
          <button type="submit" class="primary text-icon-button">${buttonContent("&#10003;", "Check-In")}</button>
        </div>
      </form>
    `;
    document.body.appendChild(modal);
    initializeWindowedDialog(modal, { showResetButton: false });
    modal.addEventListener("click", event => {
      if (event.target.closest("[data-close-scrum-check-in]")) modal.close();
    });
    modal.addEventListener("submit", async event => {
      event.preventDefault();
      const submitButton = modal.querySelector("button[type='submit']");
      const status = modal.querySelector("input[name='status']:checked")?.value || "";
      if (!SCRUM_ATTENDANCE_STATUSES.includes(status)) return;
      submitButton.disabled = true;
      if (await checkInScrumAttendance(status)) modal.close();
      else submitButton.disabled = false;
    });
    modal.addEventListener("close", () => modal.remove());
    modal.showModal();
    modal.querySelector("[name='status']:checked")?.focus({ preventScroll: true });
  }

  function openScrumCalendarAvatarMenu(button) {
    const source = button?.dataset?.scrumCalendarSource || "";
    const sourceId = Number(button?.dataset?.scrumCalendarSourceId || 0);
    const userId = Number(button?.dataset?.scrumCalendarUserId || 0);
    if (!button || !["attendance", "vacation"].includes(source) || !sourceId || !userId) return;

    closeScrumCalendarAvatarMenu();

    const canRemove = canRemoveScrumCalendarOccurrence(source, userId);
    const menu = document.createElement("div");
    menu.className = "scrum-calendar-avatar-menu dropdown-menu";
    menu.dataset.scrumCalendarAvatarMenu = "true";
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", `${button.title || "Attendance"} menu`);
    menu.innerHTML = `
      <button type="button" class="dropdown-menu-item" data-scrum-calendar-remove role="menuitem" ${canRemove ? "" : "disabled"}>
        <span class="dropdown-menu-icon" aria-hidden="true">&#128465;</span>
        <span class="dropdown-menu-label">Remove</span>
        <span class="dropdown-menu-check" aria-hidden="true"></span>
      </button>
      <button type="button" class="dropdown-menu-item" data-scrum-calendar-cancel role="menuitem">
        <span class="dropdown-menu-icon" aria-hidden="true">&#10005;</span>
        <span class="dropdown-menu-label">Cancel</span>
        <span class="dropdown-menu-check" aria-hidden="true"></span>
      </button>
    `;
    document.body.appendChild(menu);
    button.setAttribute("aria-expanded", "true");

    const closeOnOutsidePointer = event => {
      if (!menu.contains(event.target) && !button.contains(event.target)) closeScrumCalendarAvatarMenu();
    };
    const closeOnEscape = event => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeScrumCalendarAvatarMenu();
      button.focus({ preventScroll: true });
    };
    scrumCalendarAvatarMenu = {
      anchor: button,
      closeOnEscape,
      closeOnOutsidePointer,
      menu
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);

    positionScrumCalendarAvatarMenu(menu, button);
    menu.addEventListener("click", async event => {
      const cancelButton = event.target.closest("[data-scrum-calendar-cancel]");
      if (cancelButton) {
        closeScrumCalendarAvatarMenu();
        button.focus({ preventScroll: true });
        return;
      }

      const removeButton = event.target.closest("[data-scrum-calendar-remove]");
      if (!removeButton || removeButton.disabled) return;
      menu.querySelectorAll("button").forEach(item => { item.disabled = true; });
      try {
        await api(source === "attendance" ? `/api/attendance/${sourceId}` : `/api/vacations/${sourceId}`, {
          method: "DELETE"
        });
        closeScrumCalendarAvatarMenu();
        await refreshScrumAttendance();
        showToast(source === "attendance" ? "Attendance removed." : "Vacation removed from the calendar.");
      } catch (error) {
        removeButton.disabled = !canRemoveScrumCalendarOccurrence(source, userId);
        menu.querySelector("[data-scrum-calendar-cancel]")?.removeAttribute("disabled");
        showToast(error.message);
      }
    });

    menu.querySelector(canRemove ? "[data-scrum-calendar-remove]" : "[data-scrum-calendar-cancel]")
      ?.focus({ preventScroll: true });
  }

  function canRemoveScrumCalendarOccurrence(source, userId) {
    const ownEntry = Number(userId) === Number(currentUser().id || 0);
    if (source === "attendance") {
      return canAccessResource("Scrum", ownEntry ? "Create" : "Update");
    }
    return ownEntry && canAccessResource("Scrum", "Update");
  }

  function positionScrumCalendarAvatarMenu(menu, button) {
    const gap = 8;
    const buttonBox = button.getBoundingClientRect();
    const menuBox = menu.getBoundingClientRect();
    const left = Math.min(
      Math.max(gap, buttonBox.left),
      Math.max(gap, window.innerWidth - menuBox.width - gap)
    );
    const below = buttonBox.bottom + gap;
    const top = below + menuBox.height <= window.innerHeight - gap
      ? below
      : Math.max(gap, buttonBox.top - menuBox.height - gap);
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
  }

  function closeScrumCalendarAvatarMenu() {
    if (!scrumCalendarAvatarMenu) return;
    const {
      anchor,
      closeOnEscape,
      closeOnOutsidePointer,
      menu
    } = scrumCalendarAvatarMenu;
    scrumCalendarAvatarMenu = null;
    document.removeEventListener("pointerdown", closeOnOutsidePointer);
    document.removeEventListener("keydown", closeOnEscape);
    anchor?.setAttribute("aria-expanded", "false");
    menu.remove();
  }

  function openScrumOnBehalfDialog() {
    if (!canAccessResource("Scrum", "Update")) return;
    const existingDialog = document.querySelector("[data-scrum-on-behalf-dialog]");
    if (existingDialog) {
      if (!existingDialog.open) existingDialog.showModal?.();
      existingDialog.querySelector("[name='userId']")?.focus({ preventScroll: true });
      return;
    }

    const currentUserId = Number(currentUser().id || 0);
    const users = state.users.filter(user => user.isActive !== false && Number(user.id) !== currentUserId);
    const modal = document.createElement("dialog");
    modal.className = "dialog mini-dialog scrum-attendance-dialog";
    modal.dataset.scrumOnBehalfDialog = "true";
    modal.setAttribute("aria-labelledby", "scrum-on-behalf-title");
    modal.innerHTML = `
      <form>
        <div class="dialog-head">
          <h2 id="scrum-on-behalf-title">On Behalf Of</h2>
          <button type="button" class="icon-btn" data-close-scrum-on-behalf title="Close" aria-label="Close">x</button>
        </div>
        <div class="dialog-body">
          <p class="field-note">Record attendance for another person on the selected date.</p>
          <div class="form-grid scrum-attendance-dialog-grid">
            <div class="field">
              <label for="scrum-on-behalf-user">Person</label>
              <select id="scrum-on-behalf-user" name="userId" required>
                ${users.map(user => `<option value="${user.id}">${escapeHtml(scrumAttendanceUserName(user))}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label for="scrum-on-behalf-date">Date</label>
              <input id="scrum-on-behalf-date" name="attendanceDate" type="date" value="${dateKey(new Date())}" required>
            </div>
            <div class="field">
              <label for="scrum-on-behalf-status">Attendance</label>
              <select id="scrum-on-behalf-status" name="status" required>${scrumAttendanceOptionsHtml(scrumAttendanceStatus)}</select>
            </div>
          </div>
        </div>
        <div class="dialog-actions">
          <button type="button" class="secondary text-icon-button" data-close-scrum-on-behalf>${buttonContent("&#10005;", "Cancel")}</button>
          <button type="submit" class="primary text-icon-button">${buttonContent("&#10003;", "Record Attendance")}</button>
        </div>
      </form>
    `;
    document.body.appendChild(modal);
    initializeWindowedDialog(modal, { showResetButton: false });
    modal.addEventListener("click", event => {
      if (event.target.closest("[data-close-scrum-on-behalf]")) modal.close();
    });
    modal.addEventListener("submit", async event => {
      event.preventDefault();
      if (!canAccessResource("Scrum", "Update")) {
        showToast("You do not have permission to record attendance on behalf of another person.");
        return;
      }
      const submitButton = modal.querySelector("button[type='submit']");
      const userId = Number(value(modal, "userId") || 0);
      const attendanceDate = value(modal, "attendanceDate");
      const status = value(modal, "status");
      if (!userId || !attendanceDate || !SCRUM_ATTENDANCE_STATUSES.includes(status)) return;
      submitButton.disabled = true;
      try {
        await api("/api/attendance", {
          method: "POST",
          body: JSON.stringify({ userId, status, attendanceDate })
        });
        modal.close();
        await refreshScrumAttendance();
        showToast("Attendance recorded.");
      } catch (error) {
        submitButton.disabled = false;
        showToast(error.message);
      }
    });
    modal.addEventListener("close", () => modal.remove());
    modal.showModal();
    modal.querySelector("[name='userId']")?.focus({ preventScroll: true });
  }

  async function openScrumVacationDialog() {
    if (!canAccessResource("Scrum", "Create") && !canAccessResource("Scrum", "Update")) return;
    if (focusExistingScrumVacationDialog()) return;

    await ensureScrumAttendanceMonth(scrumMonthStart(new Date()), { render: false });
    if (focusExistingScrumVacationDialog()) return;
    if (!canAccessResource("Scrum", "Create") && !canAccessResource("Scrum", "Update")) return;

    const modal = document.createElement("dialog");
    modal.className = "dialog scrum-vacation-dialog";
    modal.dataset.scrumVacationDialog = "true";
    modal.setAttribute("aria-labelledby", "scrum-vacation-title");
    modal.innerHTML = `
      <form>
        <div class="dialog-head">
          <h2 id="scrum-vacation-title">Vacation</h2>
          <button type="button" class="icon-btn" data-close-scrum-vacation title="Close" aria-label="Close">x</button>
        </div>
        <div class="dialog-body" data-scrum-vacation-dialog-body></div>
        <div class="dialog-actions">
          <button type="button" class="secondary text-icon-button" data-close-scrum-vacation>${buttonContent("&#10005;", "Close")}</button>
          <button type="submit" class="primary text-icon-button" data-save-scrum-vacation>${buttonContent("&#10003;", "Add Vacation")}</button>
        </div>
      </form>
    `;
    renderScrumVacationDialog(modal);
    document.body.appendChild(modal);
    initializeWindowedDialog(modal, { showResetButton: false });
    modal.addEventListener("click", event => handleScrumVacationDialogClick(event, modal));
    modal.addEventListener("submit", event => saveScrumVacation(event, modal));
    modal.addEventListener("close", () => modal.remove());
    modal.showModal();
    modal.querySelector("[name='startDate']")?.focus({ preventScroll: true });
  }

  function focusExistingScrumVacationDialog() {
    const existingDialog = document.querySelector("[data-scrum-vacation-dialog]");
    if (!existingDialog) return false;
    if (!existingDialog.open) existingDialog.showModal?.();
    existingDialog.querySelector("[name='startDate']")?.focus({ preventScroll: true });
    return true;
  }

  function renderScrumVacationDialog(modal) {
    const body = modal.querySelector("[data-scrum-vacation-dialog-body]");
    if (!body) return;
    const vacationId = Number(modal.dataset.editVacationId || 0);
    const vacation = scrumCurrentUserVacations().find(item => Number(item.id) === vacationId) || null;
    const saveButton = modal.querySelector("[data-save-scrum-vacation]");
    const canCreateVacation = canAccessResource("Scrum", "Create");
    const canUpdateVacation = canAccessResource("Scrum", "Update");
    const canSaveVacation = vacation ? canUpdateVacation : canCreateVacation;
    body.innerHTML = `
      <input type="hidden" name="vacationId" value="${vacation?.id || ""}">
      <input type="hidden" name="expectedRowVersion" value="${escapeAttr(vacation?.rowVersion || "")}">
      <p class="field-note">Add planned vacation dates so the team can see them on the attendance calendar.</p>
      <div class="form-grid scrum-vacation-date-grid">
        <div class="field">
          <label for="scrum-vacation-start-date">Start Date</label>
          <input id="scrum-vacation-start-date" name="startDate" type="date" value="${escapeAttr(vacation ? dateKey(vacation.startDate) : "")}" required aria-required="true" ${canSaveVacation ? "" : "disabled"}>
        </div>
        <div class="field">
          <label for="scrum-vacation-end-date">End Date</label>
          <input id="scrum-vacation-end-date" name="endDate" type="date" value="${escapeAttr(vacation ? dateKey(vacation.endDate) : "")}" required aria-required="true" ${canSaveVacation ? "" : "disabled"}>
        </div>
      </div>
      <div class="scrum-vacation-list">
        <h3>Planned Vacations</h3>
        ${scrumCurrentUserVacations().map(item => `
          <div class="scrum-vacation-row" data-scrum-vacation-id="${item.id}">
            <span>${escapeHtml(scrumVacationDateLabel(item))}</span>
            <div class="scrum-vacation-row-actions">
              <button type="button" class="secondary text-icon-button" data-edit-scrum-vacation="${item.id}" ${canUpdateVacation ? "" : "disabled"}>${buttonContent("&#9998;", "Edit")}</button>
              <button type="button" class="secondary text-icon-button" data-cancel-scrum-vacation="${item.id}" ${canUpdateVacation ? "" : "disabled"}>${buttonContent("&#10005;", "Cancel")}</button>
            </div>
          </div>
        `).join("") || `<div class="empty">No planned vacations.</div>`}
      </div>
    `;
    if (saveButton) {
      saveButton.disabled = !canSaveVacation;
      saveButton.innerHTML = buttonContent("&#10003;", vacation ? "Save Changes" : "Add Vacation");
    }
  }

  async function handleScrumVacationDialogClick(event, modal) {
    if (event.target.closest("[data-close-scrum-vacation]")) {
      modal.close();
      return;
    }

    const editButton = event.target.closest("[data-edit-scrum-vacation]");
    if (editButton) {
      if (!canAccessResource("Scrum", "Update")) return;
      modal.dataset.editVacationId = editButton.dataset.editScrumVacation;
      renderScrumVacationDialog(modal);
      modal.querySelector("[name='startDate']")?.focus({ preventScroll: true });
      return;
    }

    const cancelButton = event.target.closest("[data-cancel-scrum-vacation]");
    if (!cancelButton) return;
    if (!canAccessResource("Scrum", "Update")) return;
    const vacationId = Number(cancelButton.dataset.cancelScrumVacation || 0);
    if (!vacationId || !await askYesNo("Cancel this planned vacation?", "Cancel Vacation")) return;

    cancelButton.disabled = true;
    try {
      await api(`/api/vacations/${vacationId}`, { method: "DELETE" });
      delete modal.dataset.editVacationId;
      await refreshScrumAttendance();
      if (modal.isConnected) renderScrumVacationDialog(modal);
      showToast("Vacation canceled.");
    } catch (error) {
      cancelButton.disabled = false;
      showToast(error.message);
    }
  }

  async function saveScrumVacation(event, modal) {
    event.preventDefault();
    const vacationId = Number(value(modal, "vacationId") || 0);
    const requiredRight = vacationId ? "Update" : "Create";
    if (!canAccessResource("Scrum", requiredRight)) {
      showToast(`You do not have permission to ${vacationId ? "edit" : "add"} vacations.`);
      renderScrumVacationDialog(modal);
      return;
    }
    const startDate = value(modal, "startDate");
    const endDate = value(modal, "endDate");
    if (!startDate || !endDate) {
      showToast("Start Date and End Date are required.");
      return;
    }
    if (endDate < startDate) {
      showToast("End Date must be on or after Start Date.");
      return;
    }

    const saveButton = modal.querySelector("[data-save-scrum-vacation]");
    saveButton.disabled = true;
    try {
      await api(vacationId ? `/api/vacations/${vacationId}` : "/api/vacations", {
        method: vacationId ? "PUT" : "POST",
        body: JSON.stringify({
          startDate,
          endDate,
          expectedRowVersion: vacationId ? value(modal, "expectedRowVersion") || null : undefined
        })
      });
      delete modal.dataset.editVacationId;
      await refreshScrumAttendance();
      if (modal.isConnected) renderScrumVacationDialog(modal);
      showToast(vacationId ? "Vacation updated." : "Vacation added.");
    } catch (error) {
      saveButton.disabled = false;
      showToast(error.message);
    }
  }

  function scrumCurrentUserVacations() {
    const userId = Number(currentUser().id || 0);
    const vacations = new Map();
    scrumAttendanceMonthCache.forEach(record => {
      (record.vacations || [])
        .filter(vacation => Number(vacation.userId) === userId)
        .forEach(vacation => vacations.set(Number(vacation.id), vacation));
    });
    return [...vacations.values()].sort((a, b) => dateKey(a.startDate).localeCompare(dateKey(b.startDate)) || Number(a.id) - Number(b.id));
  }

  function scrumVacationDateLabel(vacation) {
    const start = formatDate(vacation.startDate);
    const end = formatDate(vacation.endDate);
    return start === end ? start : `${start} - ${end}`;
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
    const scrumHtml = log.bodyHtml || newScrumEntryHtml(selectedProjectId);

    openEditor(scrumDialogTitle(log, "New Scrum"), `
      <div class="form-grid scrum-editor-grid">
        ${field("Date", "logDate", selectedLogDate, "date", scrumMinDateKey(selectedProjectId), scrumMaxDateKey(), "", { required: true })}
        ${selectOptionsField("Project", "projectId", [{ id: "", title: "No project" }, ...state.projects.map(project => ({ id: project.id, title: `${project.code} - ${project.title}` }))], selectedProjectId)}
        ${richTextField("bodyHtml", "Scrum", scrumHtml, { required: true })}
        <label class="inline-check field full"><input name="isPinned" type="checkbox" ${log.isPinned ? "checked" : ""}><span>Pinned</span></label>
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
        isPinned: root.querySelector("[name='isPinned']").checked,
        expectedRowVersion: log.id ? log.rowVersion || null : undefined
      }, {
        saveAsNew: true,
        canCreate: canAccessResource("Scrum", "Create"),
        createPath: "/api/devlogs"
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

  function exportScrumCsv(options = {}) {
    const rows = scrumExportRows();
    const columns = scrumExportImportColumns(options);

    downloadCsv(exportFileName("pmt-scrum"), columns, rows);
  }

  function exportScrumExcel(options = {}) {
    const rows = scrumExportRows();
    const columns = scrumExportImportColumns(options);

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

  function scrumExportImportColumns(options = {}) {
    return [
      ...scrumExportColumns(scrumVisibleTableColumns()),
      ...(options.includeMetadata ? [
        { header: "PMT Scrum Id", value: log => log.id },
        { header: "PMT Scrum Owner User Id", value: log => log.userId },
        { header: "PMT Scrum Row Hash", value: log => scrumImportHash(log) },
        { header: "PMT Scrum Row Version", value: log => log.rowVersion || "" },
        { header: "PMT Update Date", value: log => scrumDateInputValue(log.logDate) },
        { header: "PMT Update Project Id", value: log => log.projectId || "" },
        { header: "PMT Update Scrum Html", value: log => log.bodyHtml || "" },
        { header: "PMT Update Pinned", value: log => log.isPinned ? "Yes" : "No" }
      ] : [])
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
    let createdRows = 0;

    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      const rowNumber = index + 2;
      try {
        const result = await importScrumRecord(record);
        if (result === "updated") updatedRows += 1;
        if (result === "created") createdRows += 1;
      } catch (error) {
        const target = resolveScrumImportTarget(record);
        const log = target.matchedLog;
        errors.push({
          rowNumber,
          code: log?.id ? `Scrum ${log.id}` : "",
          title: log ? [formatDate(log.logDate), scrumUserName(log.userId)].join(" - ") : importFirstNonEmptyCell(record, "Date", "PMT Update Date"),
          message: error.message
        });
      }
    }

    if (updatedRows || createdRows) {
      await loadState();
      render();
    }
    showImportResultDialog({
      title: "Import Scrum",
      totalRows: records.length,
      updatedRows,
      createdRows,
      errors
    });
  }

  async function importScrumRecord(record) {
    const target = resolveScrumImportTarget(record);
    const log = target.log;

    if (log) {
      const updates = scrumImportValues(record, log);
      if (!scrumImportChanged(log, updates)) return "";

      const result = await saveJson(`/api/devlogs/${log.id}`, "PUT", scrumImportPayload(log, updates, record), {
        saveAsNew: true,
        canCreate: canAccessResource("Scrum", "Create"),
        createPath: "/api/devlogs"
      });
      return result?.__savedAsNew ? "created" : "updated";
    }

    const createValues = scrumImportValues(record, null);
    await saveJson("/api/devlogs", "POST", scrumImportPayload(null, createValues, record));
    return "created";
  }

  function resolveScrumImportTarget(record) {
    const candidates = [];
    const addCandidate = log => {
      if (!log || !isSharedScrumLog(log) || candidates.some(candidate => candidate.id === log.id)) return;
      candidates.push(log);
    };
    const id = parseScrumImportId(record);
    const bodyText = normalizeImportText(scrumImportBodyText(record));
    const dateText = parseScrumImportDateText(record);
    const projectId = parseScrumImportProjectId(record, null, { useFallback: false });

    addCandidate(id ? state.devLogs.find(item => item.id === id) : null);
    addCandidate(bodyText ? state.devLogs.find(log =>
      isSharedScrumLog(log)
      && normalizeImportText(textFromHtml(log.bodyHtml || "")) === bodyText
      && (!dateText || scrumDateInputValue(log.logDate) === dateText)
      && (!projectId || Number(log.projectId || 0) === Number(projectId))
    ) : null);

    return {
      log: candidates.find(canUpdateImportedScrumLog) || null,
      matchedLog: candidates[0] || null
    };
  }

  function scrumImportValues(record, log) {
    const projectId = parseScrumImportProjectId(record, log, { useFallback: true });
    const dateResult = coerceScrumImportDate(projectId, parseScrumImportDateText(record) || scrumDateInputValue(log?.logDate));
    const bodyHtml = parseScrumImportBodyHtml(record, log);

    return {
      projectId: dateResult.projectId,
      logDate: dateResult.logDate,
      bodyHtml,
      isPinned: parseScrumImportPinned(record, log)
    };
  }

  function scrumImportPayload(log, updates, record = {}) {
    return {
      id: log?.id || 0,
      logType: sharedScrumLogType,
      projectId: updates.projectId,
      logDate: updates.logDate,
      bodyHtml: updates.bodyHtml,
      isPinned: updates.isPinned,
      auditContext: "Import",
      expectedRowVersion: log ? importFirstNonEmptyCell(record, "PMT Scrum Row Version").trim() || null : undefined
    };
  }

  function canUpdateImportedScrumLog(log) {
    const user = currentUser();
    if (user.isAdmin) return true;
    return log.userId === user.id && !scrumLogIsOlderThanModificationWindow(log);
  }

  function parseScrumImportId(record) {
    const id = Number(importCell(record, "PMT Scrum Id", "Scrum Id").trim());
    return Number.isInteger(id) && id > 0 ? id : 0;
  }

  function parseScrumImportProjectId(record, log, options = {}) {
    const hasProjectColumn = importCellExists(record, "PMT Update Project Id", "Project Id", "Project");
    if (!hasProjectColumn) {
      if (log) return log.projectId || null;
      if (!options.useFallback) return null;
      return scrumImportFallbackProjectId();
    }

    const text = importFirstNonEmptyCell(record, "PMT Update Project Id", "Project Id", "Project").trim();
    if (/^no project$/i.test(text)) return null;
    const fallbackProjectId = log?.projectId || (options.useFallback ? scrumImportFallbackProjectId() : 0);
    return resolveImportProjectId(record, state.projects, fallbackProjectId) || null;
  }

  function parseScrumImportDateText(record) {
    const selectedDate = importFirstNonEmptyCell(record, "PMT Update Date", "Date").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) ? selectedDate : "";
  }

  function parseScrumImportBodyHtml(record, log) {
    const bodyHtml = importFirstNonEmptyCell(record, "PMT Update Scrum Html").trim();
    if (bodyHtml) return bodyHtml;

    const bodyText = importFirstNonEmptyCell(record, "Scrum").trim();
    if (bodyText) return `<p>${escapeHtml(bodyText)}</p>`;
    return log?.bodyHtml || "<p>Imported Scrum entry.</p>";
  }

  function parseScrumImportPinned(record, log) {
    if (!importCellExists(record, "PMT Update Pinned")) return Boolean(log?.isPinned);

    const value = importCell(record, "PMT Update Pinned", "Flag").trim().toLowerCase();
    return ["1", "true", "yes", "y", "pinned"].includes(value);
  }

  function scrumImportBodyText(record) {
    const bodyHtml = importFirstNonEmptyCell(record, "PMT Update Scrum Html").trim();
    if (bodyHtml) return textFromHtml(bodyHtml);
    return importFirstNonEmptyCell(record, "Scrum").trim();
  }

  function scrumImportFallbackProjectId() {
    const filterProjectId = Number(scrumFilters.projectId || 0);
    if (state.projects.some(project => project.id === filterProjectId)) return filterProjectId;
    if (state.projects.some(project => project.id === scrumEntryProjectId)) return scrumEntryProjectId;
    return null;
  }

  function coerceScrumImportDate(projectId, requestedDate) {
    const today = scrumDateInputValue(new Date());
    const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate || "") ? requestedDate : today;

    if (!scrumDateValidationMessage(projectId, selectedDate)) return { projectId, logDate: selectedDate };
    if (projectId && !scrumDateValidationMessage(null, selectedDate)) return { projectId: null, logDate: selectedDate };
    if (!scrumDateValidationMessage(projectId, today)) return { projectId, logDate: today };
    if (projectId && !scrumDateValidationMessage(null, today)) return { projectId: null, logDate: today };
    return { projectId: null, logDate: today };
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
          <div class="scrum-content" ${devLogRichPersistAttrs(log)}>${log.bodyHtml}</div>
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

  function devLogRichPersistAttrs(log) {
    return [
      `data-rich-persist-type="devLog"`,
      `data-rich-persist-id="${escapeAttr(log.id)}"`,
      `data-rich-persist-field="bodyHtml"`
    ].join(" ");
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

  function newScrumEntryHtml(projectId) {
    return [
      scrumSectionHtml(scrumYesterdayPrompt, previousScrumTodayItems(projectId)),
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

  function previousScrumTodayItems(projectId) {
    const previousLog = previousScrumLog(projectId);
    return previousLog ? scrumSectionItems(previousLog.bodyHtml, scrumTodayPrompt) : [];
  }

  function previousScrumLog(projectId) {
    const userId = currentUser().id;
    const selectedProjectId = Number(projectId || 0);
    const userLogs = state.devLogs
      .filter(isSharedScrumLog)
      .filter(item => item.userId === userId);
    const projectLogs = userLogs.filter(item => Number(item.projectId || 0) === selectedProjectId);

    return latestScrumLog(projectLogs);
  }

  function latestScrumLog(logs) {
    return [...logs].sort((a, b) => b.id - a.id)[0] || null;
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
      scrumTableColumnPreferenceKey,
      scrumCalendarVisiblePreferenceKey,
      preferenceKeys.scrumAutoRefresh,
      scrumAttendanceStatusPreferenceKey
    ].forEach(removePreference);

    scrumFilters = normalizeScrumFilters({});
    scrumEntryProjectId = 0;
    scrumColumnPrefs = normalizeScrumColumnPrefs({});
    scrumCalendarVisible = false;
    scrumAutoRefreshEnabled = true;
    scrumAttendanceStatus = "Office";
    scrumCalendarMonth = scrumMonthStart(new Date());
    scrumTableMode.deactivate();
    cancelScrumColumnDrag();
    renderDevLogs();
  }

  function deactivateScrum() {
    scrumIsActive = false;
    closeScrumCalendarAvatarMenu();
    window.clearTimeout(scrumAutoRefreshTimer);
    scrumAutoRefreshTimer = 0;
    document.querySelectorAll("[data-scrum-filter-dialog], [data-scrum-check-in-dialog], [data-scrum-on-behalf-dialog], [data-scrum-vacation-dialog]").forEach(dialog => {
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

function attendanceStatusDefinition(status) {
  return scrumAttendanceStatusDefinitions.find(item => item.value === status) || null;
}

function scrumAttendanceStatusIndex(status) {
  const index = scrumAttendanceCalendarOrder.indexOf(status);
  return index >= 0 ? index : scrumAttendanceCalendarOrder.length;
}

function attendanceOccurrenceComesAfter(candidate, existing) {
  const candidateTime = attendanceOccurrenceTime(candidate);
  const existingTime = attendanceOccurrenceTime(existing);
  if (candidateTime !== existingTime) return candidateTime > existingTime;
  if (candidate.source !== existing.source) return candidate.source === "attendance";
  return Number(candidate.sourceId || 0) >= Number(existing.sourceId || 0);
}

function attendanceOccurrenceTime(occurrence) {
  const value = occurrence?.updatedAt || occurrence?.createdAt || "";
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function scrumMonthStart(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function scrumMonthKey(value) {
  const date = scrumMonthStart(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function scrumLocalDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function scrumLocalDateKey(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "";
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function scrumAttendanceUserName(user) {
  return user?.nickname || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User";
}
