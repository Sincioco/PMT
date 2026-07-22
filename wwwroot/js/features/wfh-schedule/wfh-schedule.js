import { buttonContent, iconButton } from "../../components/buttons.js";
import { askYesNo } from "../../components/dialogs.js";
import { sectionHead } from "../../components/sections.js?v=release-notes-2026-07-22-day-35-04389905c430";
import { createWorkItemTableMode } from "../../components/work-items.js?v=20260720-work-item-export-images-v4";
import { api } from "../../core/api.js";
import { currentUser } from "../../core/authentication.js?v=20260715-admin-impersonation";
import { state } from "../../core/store.js";
import { createReorderDrag } from "../../shared/reorder-drag.js";
import { canEditOwner } from "../../shared/permissions.js?v=20260715-admin-impersonation";
import { roleLabel } from "../../shared/selectors.js?v=20260713-managed-roles";
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
  const wfhTableMode = createWorkItemTableMode({
    action: "toggle-wfh-table-edit-mode",
    itemLabel: "WFH Schedule"
  });

  function renderWfhSchedule() {
    if (!rows && !isLoading) loadSchedule();

    const allRows = sortRows(rows || []);
    const canAdminEdit = canAdminEditWfh();
    if (!canAdminEdit) showHiddenUsers = false;

    const hiddenCount = allRows.filter(row => row.isHidden).length;
    const visibleRows = allRows.filter(row => showHiddenUsers || !row.isHidden);
    const hiddenToggleLabel = showHiddenUsers ? "Hide Hidden" : hiddenCount ? `Show Hidden (${hiddenCount})` : "Show Hidden";
    const actionsHtml = `
      ${wfhTableMode.buttonHtml()}
      ${canAdminEdit ? `<button class="secondary text-icon-button ${showHiddenUsers ? "is-on" : ""}" type="button" data-action="toggle-wfh-deleted" aria-pressed="${showHiddenUsers}" ${hiddenCount ? "" : "disabled"}>
        ${buttonContent(eyeIconHtml(), hiddenToggleLabel)}
      </button>` : ""}
      ${canAdminEdit ? `<button class="secondary text-icon-button" type="button" data-action="reset-wfh-schedule">
        ${buttonContent("&#8635;", "Reset")}
      </button>` : ""}
    `;

    app.innerHTML = `
      <section class="wfh-schedule-screen work-item-screen">
        ${sectionHead("WFH Schedule", actionsHtml)}
        <div class="panel wfh-schedule-panel work-item-table-panel">
          ${wfhTableHtml(visibleRows)}
        </div>
      </section>
    `;
    bindWfhDragEvents();
  }

  async function handleAction(action, id, button) {
    if (action === "toggle-wfh-deleted") {
      if (!canAdminEditWfh()) return true;
      showHiddenUsers = !showHiddenUsers;
      renderWfhSchedule();
      return true;
    }

    if (action === "toggle-wfh-table-edit-mode") {
      wfhTableMode.toggle();
      renderWfhSchedule();
      return true;
    }

    if (action === "toggle-wfh-day") {
      if (!wfhTableMode.active) return true;
      if (!canEditWfhRow(rowByUserId(id))) return true;
      await toggleWfhDay(id, button.dataset.day || "");
      return true;
    }

    if (action === "hide-wfh-user") {
      if (!wfhTableMode.active || !canAdminEditWfh()) return true;
      await hideWfhUser(id);
      return true;
    }

    if (action === "restore-wfh-user") {
      if (!wfhTableMode.active || !canAdminEditWfh()) return true;
      await restoreWfhUser(id);
      return true;
    }

    if (action === "reset-wfh-schedule") {
      if (!canAdminEditWfh()) return true;
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

    const showAdminActions = wfhTableMode.active && canAdminEditWfh();

    return `
      <table class="table work-item-table wfh-schedule-table ${wfhTableMode.active ? "is-edit-mode" : "is-read-mode"}">
        <colgroup>
          <col class="wfh-member-column">
          <col class="wfh-days-column">
          <col class="wfh-fill-column">
          ${showAdminActions ? `<col class="wfh-action-column">` : ""}
        </colgroup>
        <thead>
          <tr>
            <th>Team Member</th>
            <th>Days</th>
            <th class="wfh-fill-head" aria-hidden="true"></th>
            ${showAdminActions ? `<th class="action-cell" aria-label="Actions"></th>` : ""}
          </tr>
        </thead>
        <tbody data-reorder-list="wfh-schedule" data-wfh-schedule-list>
          ${visibleRows.map(wfhRowHtml).join("") || `<tr><td colspan="${showAdminActions ? 4 : 3}"><div class="empty">No team members match the current WFH view.</div></td></tr>`}
        </tbody>
      </table>
    `;
  }

  function wfhRowHtml(row) {
    const displayRole = roleLabel(row.role || "Developer");
    const showAdminActions = wfhTableMode.active && canAdminEditWfh();
    return `
      <tr data-wfh-user-id="${row.userId}" data-can-drag="${showAdminActions ? "true" : "false"}" class="${row.isHidden ? "is-hidden" : ""}">
        <td class="wfh-member-cell">
          <div class="wfh-member">
            <img class="avatar wfh-avatar" src="${escapeAttr(wfhAvatarUrl(row))}" alt="${escapeAttr(wfhDisplayName(row))} avatar">
            <div class="wfh-member-text">
              <span class="wfh-member-name">${wfhNameHtml(row)}</span>
              <span class="wfh-member-title muted">${escapeHtml(displayRole)}</span>
              ${wfhEmailHtml(row)}
              ${row.isHidden ? `<span class="pill wfh-deleted-pill">Hidden</span>` : ""}
            </div>
          </div>
        </td>
        <td class="wfh-days-cell">
          <div class="wfh-day-buttons" aria-label="${escapeAttr(`${row.nickname} WFH days`)}">
            ${dayDefinitions.map(day => wfhDayButtonHtml(row, day)).join("")}
          </div>
        </td>
        <td class="wfh-fill-cell" aria-hidden="true"></td>
        ${showAdminActions ? `<td class="reveal-actions action-cell">${wfhRowActionsHtml(row)}</td>` : ""}
      </tr>
    `;
  }

  function wfhDayButtonHtml(row, day) {
    const isOn = Boolean(row[day.key]);
    const isEditable = wfhTableMode.active && !row.isHidden && canEditWfhRow(row);
    return `
      <button class="wfh-day-button ${isOn ? "is-on" : ""}" type="button" data-action="toggle-wfh-day" data-id="${row.userId}" data-day="${escapeAttr(day.key)}" aria-label="${escapeAttr(`${row.nickname} ${day.name}`)}" aria-pressed="${isOn}" title="${escapeAttr(day.name)}" ${isEditable ? "" : "disabled"}>
        ${escapeHtml(day.label)}
      </button>
    `;
  }

  function wfhRowActionsHtml(row) {
    return `
      ${row.isHidden
        ? `<button class="icon-action" type="button" data-action="restore-wfh-user" data-id="${row.userId}" title="Restore ${escapeAttr(row.nickname)}" aria-label="Restore ${escapeAttr(row.nickname)}"><span class="button-icon" aria-hidden="true">&#8635;</span></button>`
        : iconButton("hide-wfh-user", row.userId, `Delete ${row.nickname} from WFH Schedule`, "delete-monochrome")}
      <button class="work-item-drag-handle wfh-drag-handle" type="button" data-drag-handle data-wfh-drag-handle title="Drag ${escapeAttr(row.nickname)}" aria-label="Drag ${escapeAttr(row.nickname)}">
        <span aria-hidden="true">&#8942;&#8942;</span>
      </button>
    `;
  }

  async function toggleWfhDay(userId, dayKey) {
    const row = rowByUserId(userId);
    if (!row || !dayDefinitions.some(day => day.key === dayKey)) return;
    if (!canEditWfhRow(row)) return;

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
      const result = await api(`/api/wfh-schedule/${row.userId}`, {
        method: "PUT",
        body: JSON.stringify(wfhPayload(row))
      });
      if (result?.rowVersion) {
        row.rowVersion = result.rowVersion;
      } else {
        await loadSchedule({ render: false });
      }
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
    if (!wfhTableMode.active || !canAdminEditWfh()) return;

    const list = app.querySelector('tbody[data-reorder-list="wfh-schedule"]');
    if (!list) return;

    createReorderDrag({
      root: list,
      containerSelector: 'tbody[data-reorder-list="wfh-schedule"]',
      itemSelector: "tr[data-wfh-user-id]",
      getItemKey: item => item.dataset.wfhUserId || "",
      handleRequired: false,
      interactiveSelector: "button:not([data-drag-handle]), a, input, select, textarea",
      onDrop: ({ orderedKeys }) => saveWfhOrder(orderedKeys)
    }).bind();
  }

  async function saveWfhOrder(orderedKeys) {
    if (!canAdminEditWfh()) return;

    const userIds = orderedKeys.map(value => Number(value)).filter(Boolean);
    if (!userIds.length) return;

    try {
      const expectedRowVersions = Object.fromEntries(
        userIds.map(userId => [userId, rowByUserId(userId)?.rowVersion || null])
      );
      await api("/api/wfh-schedule/reorder", {
        method: "POST",
        body: JSON.stringify({ userIds, expectedRowVersions })
      });

      await loadSchedule({ render: false });
      showToast("WFH schedule order saved.");
      render();
    } catch (error) {
      await loadSchedule({ render: false });
      render();
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
      isHidden: Boolean(row.isHidden),
      expectedRowVersion: row.rowVersion || null
    };
  }

  return {
    handleAction,
    render: renderWfhSchedule
  };
}

function canAdminEditWfh() {
  const user = currentUser();
  return Boolean(user.isAdmin || user.role === "Admin");
}

function canEditWfhRow(row) {
  return Boolean(row && canEditOwner(row.userId));
}

function eyeIconHtml() {
  return `
    <svg class="button-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"></path>
    </svg>
  `;
}

function wfhAvatarUrl(row) {
  return (row.avatarUrl || "/assets/avatar-default.svg").trim();
}

function wfhDisplayName(row) {
  return [row.firstName, row.lastName]
    .map(part => (part || "").trim())
    .filter(Boolean)
    .join(" ") || row.nickname || "User";
}

function wfhNameHtml(row) {
  const fullName = wfhDisplayName(row);
  const nickname = (row.nickname || "").trim();
  const showNickname = nickname && nickname.toLowerCase() !== fullName.toLowerCase();

  return `${escapeHtml(fullName)}${showNickname ? ` (${escapeHtml(nickname)})` : ""}`;
}

function wfhEmailHtml(row) {
  const email = (row.email || wfhUser(row).email || "").trim();
  if (!email) return "";

  return `<span class="wfh-member-email"><a href="mailto:${escapeAttr(email)}">${escapeHtml(email)}</a></span>`;
}

function wfhUser(row) {
  return (state.users || []).find(user => user.id === row.userId) || {};
}

function sortRows(items) {
  return [...items].sort((a, b) =>
    (a.sortOrder || 0) - (b.sortOrder || 0)
    || String(a.nickname || "").localeCompare(String(b.nickname || ""))
    || (a.userId || 0) - (b.userId || 0)
  );
}
