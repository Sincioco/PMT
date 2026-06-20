import { buttonContent } from "../../components/buttons.js";
import { askYesNo } from "../../components/dialogs.js";
import { sectionHead } from "../../components/sections.js";
import { api } from "../../core/api.js";
import { createReorderDrag } from "../../shared/reorder-drag.js";
import {
  escapeAttr,
  escapeHtml
} from "../../shared/text-and-links.js";

const dayDefinitions = [
  { key: "canWorkMonday", label: "M", name: "Monday" },
  { key: "canWorkTuesday", label: "T", name: "Tuesday" },
  { key: "canWorkWednesday", label: "W", name: "Wednesday" },
  { key: "canWorkThursday", label: "T", name: "Thursday" },
  { key: "canWorkFriday", label: "F", name: "Friday" }
];

export function createWfhScheduleFeature({
  app,
  render,
  showToast
}) {
  let rows = null;
  let isLoading = false;
  let loadError = "";
  let showHiddenUsers = false;

  function renderWfhSchedule() {
    if (!rows && !isLoading) loadSchedule();

    const allRows = sortRows(rows || []);
    const hiddenCount = allRows.filter(row => row.isHidden).length;
    const visibleRows = allRows.filter(row => showHiddenUsers || !row.isHidden);
    const deletedToggleLabel = showHiddenUsers ? "Hide Deleted" : hiddenCount ? `Show Deleted (${hiddenCount})` : "Show Deleted";
    const actionsHtml = `
      <button class="secondary text-icon-button ${showHiddenUsers ? "is-on" : ""}" type="button" data-action="toggle-wfh-deleted" aria-pressed="${showHiddenUsers}" ${hiddenCount ? "" : "disabled"}>
        ${buttonContent("&#128065;", deletedToggleLabel)}
      </button>
      <button class="secondary text-icon-button" type="button" data-action="reset-wfh-schedule">
        ${buttonContent("&#8635;", "Reset")}
      </button>
    `;

    app.innerHTML = `
      ${sectionHead("WFH Schedule", actionsHtml)}
      <div class="panel wfh-schedule-panel work-item-table-panel">
        ${wfhTableHtml(visibleRows)}
      </div>
    `;
    bindWfhDragEvents();
  }

  async function handleAction(action, id, button) {
    if (action === "toggle-wfh-deleted") {
      showHiddenUsers = !showHiddenUsers;
      renderWfhSchedule();
      return true;
    }

    if (action === "toggle-wfh-day") {
      await toggleWfhDay(id, button.dataset.day || "");
      return true;
    }

    if (action === "hide-wfh-user") {
      await hideWfhUser(id);
      return true;
    }

    if (action === "restore-wfh-user") {
      await restoreWfhUser(id);
      return true;
    }

    if (action === "reset-wfh-schedule") {
      await resetWfhSchedule();
      return true;
    }

    return false;
  }

  async function loadSchedule(options = {}) {
    if (isLoading) return;

    isLoading = true;
    loadError = "";

    try {
      rows = await api("/api/wfh-schedule");
    } catch (error) {
      rows = [];
      loadError = error.message;
      showToast(error.message);
    } finally {
      isLoading = false;
      if (options.render !== false) render();
    }
  }

  function wfhTableHtml(visibleRows) {
    if (isLoading && !rows) return `<div class="empty">Loading WFH schedule...</div>`;
    if (loadError) return `<div class="empty">WFH schedule could not be loaded.</div>`;

    return `
      <table class="table work-item-table wfh-schedule-table">
        <thead>
          <tr>
            <th>Avatar</th>
            <th>Nickname</th>
            <th>First Name</th>
            <th>Last Name</th>
            <th>Role</th>
            <th>Days</th>
          </tr>
        </thead>
        <tbody data-reorder-list="wfh-schedule" data-wfh-schedule-list>
          ${visibleRows.map(wfhRowHtml).join("") || `<tr><td colspan="6"><div class="empty">No users match the current WFH view.</div></td></tr>`}
        </tbody>
      </table>
    `;
  }

  function wfhRowHtml(row) {
    const displayRole = row.role || "Developer";
    return `
      <tr data-wfh-user-id="${row.userId}" class="${row.isHidden ? "is-hidden" : ""}">
        <td>
          <img class="row-avatar wfh-avatar" src="${escapeAttr(row.avatarUrl || "/assets/avatar-default.svg")}" alt="">
        </td>
        <td>
          <strong>${escapeHtml(row.nickname)}</strong>
          ${row.isHidden ? `<span class="pill wfh-deleted-pill">Deleted</span>` : ""}
        </td>
        <td>${escapeHtml(row.firstName)}</td>
        <td>${escapeHtml(row.lastName)}</td>
        <td>${escapeHtml(displayRole)}</td>
        <td>
          <div class="wfh-days-cell">
            <div class="wfh-day-buttons" aria-label="${escapeAttr(`${row.nickname} WFH days`)}">
              ${dayDefinitions.map(day => wfhDayButtonHtml(row, day)).join("")}
            </div>
            <div class="wfh-row-actions">
              ${row.isHidden
                ? `<button class="icon-action" type="button" data-action="restore-wfh-user" data-id="${row.userId}" title="Restore ${escapeAttr(row.nickname)}" aria-label="Restore ${escapeAttr(row.nickname)}">&#8635;</button>`
                : `<button class="icon-action danger" type="button" data-action="hide-wfh-user" data-id="${row.userId}" title="Delete ${escapeAttr(row.nickname)} from WFH Schedule" aria-label="Delete ${escapeAttr(row.nickname)} from WFH Schedule">&#128465;</button>`}
              <button class="work-item-drag-handle wfh-drag-handle" type="button" data-drag-handle data-wfh-drag-handle title="Drag ${escapeAttr(row.nickname)}" aria-label="Drag ${escapeAttr(row.nickname)}">
                <span aria-hidden="true">&#8942;&#8942;</span>
              </button>
            </div>
          </div>
        </td>
      </tr>
    `;
  }

  function wfhDayButtonHtml(row, day) {
    const isOn = Boolean(row[day.key]);
    return `
      <button class="wfh-day-button ${isOn ? "is-on" : ""}" type="button" data-action="toggle-wfh-day" data-id="${row.userId}" data-day="${escapeAttr(day.key)}" aria-label="${escapeAttr(`${row.nickname} ${day.name}`)}" aria-pressed="${isOn}" title="${escapeAttr(day.name)}" ${row.isHidden ? "disabled" : ""}>
        ${escapeHtml(day.label)}
      </button>
    `;
  }

  async function toggleWfhDay(userId, dayKey) {
    const row = rowByUserId(userId);
    if (!row || !dayDefinitions.some(day => day.key === dayKey)) return;

    await updateRow(row, { [dayKey]: !row[dayKey] }, "WFH day saved.");
  }

  async function hideWfhUser(userId) {
    const row = rowByUserId(userId);
    if (!row) return;
    if (!await askYesNo(`Delete ${row.nickname} from the WFH Schedule? The user will only be hidden from this list.`, "Delete")) return;

    await updateRow(row, { isHidden: true }, "User hidden from WFH Schedule.");
  }

  async function restoreWfhUser(userId) {
    const row = rowByUserId(userId);
    if (!row) return;

    await updateRow(row, { isHidden: false }, "User restored to WFH Schedule.");
  }

  async function updateRow(row, changes, successMessage) {
    const previous = { ...row };
    Object.assign(row, changes);

    try {
      await api(`/api/wfh-schedule/${row.userId}`, {
        method: "PUT",
        body: JSON.stringify(wfhPayload(row))
      });
      showToast(successMessage);
    } catch (error) {
      Object.assign(row, previous);
      showToast(error.message);
    } finally {
      render();
    }
  }

  async function resetWfhSchedule() {
    const confirmed = await askYesNo(
      "Reset WFH schedule to nickname order, clear WFH days, and show all users?",
      "Reset"
    );
    if (!confirmed) return;

    try {
      await api("/api/wfh-schedule/reset", { method: "POST" });
      showHiddenUsers = false;
      await loadSchedule({ render: false });
      showToast("WFH schedule reset.");
      render();
    } catch (error) {
      showToast(error.message);
    }
  }

  function bindWfhDragEvents() {
    const list = app.querySelector('tbody[data-reorder-list="wfh-schedule"]');
    if (!list) return;

    createReorderDrag({
      root: list,
      containerSelector: 'tbody[data-reorder-list="wfh-schedule"]',
      itemSelector: "tr[data-wfh-user-id]",
      getItemKey: item => item.dataset.wfhUserId || "",
      onDrop: ({ orderedKeys }) => saveWfhOrder(orderedKeys)
    }).bind();
  }

  async function saveWfhOrder(orderedKeys) {
    const userIds = orderedKeys.map(value => Number(value)).filter(Boolean);
    if (!userIds.length) return;

    try {
      await api("/api/wfh-schedule/reorder", {
        method: "POST",
        body: JSON.stringify({ userIds })
      });

      const sortOrders = new Map(userIds.map((userId, index) => [userId, (index + 1) * 10]));
      rows.forEach(row => {
        if (sortOrders.has(row.userId)) row.sortOrder = sortOrders.get(row.userId);
      });
      showToast("WFH schedule order saved.");
      render();
    } catch (error) {
      showToast(error.message);
    }
  }

  function rowByUserId(userId) {
    return (rows || []).find(row => row.userId === Number(userId));
  }

  function wfhPayload(row) {
    return {
      userId: row.userId,
      canWorkMonday: Boolean(row.canWorkMonday),
      canWorkTuesday: Boolean(row.canWorkTuesday),
      canWorkWednesday: Boolean(row.canWorkWednesday),
      canWorkThursday: Boolean(row.canWorkThursday),
      canWorkFriday: Boolean(row.canWorkFriday),
      isHidden: Boolean(row.isHidden)
    };
  }

  return {
    handleAction,
    render: renderWfhSchedule
  };
}

function sortRows(items) {
  return [...items].sort((a, b) =>
    (a.sortOrder || 0) - (b.sortOrder || 0)
    || String(a.nickname || "").localeCompare(String(b.nickname || ""))
    || (a.userId || 0) - (b.userId || 0)
  );
}
