import { buttonContent, funnelIconHtml, iconButton } from "../../components/buttons.js";
import {
  checkedFilterValues,
  filterCheckList
} from "../../components/filters.js";
import {
  field,
  optionalNumberValue,
  richTextField,
  richValue,
  selectOptionsField,
  value
} from "../../components/forms.js";
import { sectionHead } from "../../components/sections.js";
import { createWorkItemTableMode } from "../../components/work-items.js?v=20260621-scrum-backlog-parity";
import { currentUser } from "../../core/authentication.js";
import {
  preferenceKeys,
  readJsonPreference,
  readNumberPreference,
  writeJsonPreference,
  writePreference
} from "../../core/preferences.js?v=20260621-scrum-dev-task-parity";
import { state } from "../../core/store.js";
import {
  dateKey,
  formatDate,
  toDateInput
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
  let scrumFilters = readJsonPreference(preferenceKeys.scrumFilters, {});
  let scrumEntryProjectId = readNumberPreference(preferenceKeys.scrumEntryProject, 0);
  const scrumTableMode = createWorkItemTableMode({
    action: "toggle-scrum-table-edit-mode",
    itemLabel: "Scrum",
    initialActive: true
  });

  scrumFilters.personIds = normalizeSavedArray(scrumFilters.personIds);

  function renderDevLogs() {
    if (scrumFilters.projectId && !state.projects.some(project => project.id === Number(scrumFilters.projectId))) {
      scrumFilters.projectId = "";
    }

    syncScrumPersonFilterWithUsers();

    const logs = state.devLogs
      .filter(log => !scrumFilters.projectId || log.projectId === Number(scrumFilters.projectId))
      .filter(log => !scrumFilters.personIds.length || scrumFilters.personIds.includes(String(log.userId)))
      .filter(log => !scrumFilters.logDate || dateKey(log.logDate) === scrumFilters.logDate)
      .sort((a, b) => new Date(b.logDate) - new Date(a.logDate) || new Date(b.updatedAt) - new Date(a.updatedAt));

    app.innerHTML = `
      <section class="scrum-screen work-item-screen">
        ${sectionHead("Scrum", `
          <button class="primary text-icon-button" type="button" data-action="new-log" title="New Scrum" aria-label="New Scrum">${buttonContent("&#10010;", "New Scrum")}</button>
          ${scrumTableMode.buttonHtml()}
          <button class="secondary text-icon-button" type="button" data-action="open-scrum-filters" title="Filters" aria-label="Filters" aria-haspopup="dialog">${buttonContent(funnelIconHtml(), "Filters")}</button>
        `)}
        <div class="panel work-item-table-panel scrum-table-panel">
          <div class="scrum-table-wrap">
            <table class="table work-item-table scrum-table ${scrumTableMode.active ? "is-edit-mode" : "is-read-mode"}">
              <colgroup>
                <col class="scrum-date-column">
                <col class="scrum-project-column">
                <col class="scrum-person-column">
                <col class="scrum-body-column">
                <col class="scrum-flag-column">
                ${scrumTableMode.active ? `<col class="scrum-action-column">` : ""}
              </colgroup>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Project</th>
                  <th>Person</th>
                  <th>Scrum</th>
                  <th aria-label="Flag"></th>
                  ${scrumTableMode.active ? `<th class="action-cell" aria-label="Actions"></th>` : ""}
                </tr>
              </thead>
              <tbody>
                ${logs.map(log => scrumRowHtml(log)).join("") || `<tr><td colspan="${scrumTableMode.active ? 6 : 5}"><div class="empty">No Scrum entries match the current filters.</div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    `;
  }

  function scrumRowHtml(log) {
    const user = userById(log.userId);
    const editable = canEditOwner(log.userId);

    return `
      <tr class="scrum-row clickable-row" data-action="view-log" data-id="${log.id}">
        <td class="scrum-date" data-label="Date">${formatDate(log.logDate)}</td>
        <td class="scrum-project" data-label="Project">${log.projectId ? `<span class="pill">${escapeHtml(projectName(log.projectId))}</span>` : `<span class="muted">No project</span>`}</td>
        <td class="scrum-person-cell" data-label="Person">
          <div class="row scrum-person">
            <img class="avatar" src="${escapeAttr(user?.avatarUrl || "/assets/avatar-default.svg")}" alt="">
            <strong>${escapeHtml(user?.nickname || "User")}</strong>
          </div>
        </td>
        <td class="scrum-body" data-label="Scrum"><div class="scrum-content">${log.bodyHtml}</div></td>
        <td class="scrum-flag" data-label="">${log.isPinned ? `<span class="pill scrum-pin">Pinned</span>` : ""}</td>
        ${scrumTableMode.active ? `
          <td class="reveal-actions action-cell scrum-actions" data-label="Actions">
            ${iconButton("delete-log", log.id, "Delete", "delete-monochrome", editable)}
            ${iconButton("duplicate-log", log.id, "Duplicate", "duplicate", editable)}
            ${iconButton("edit-log", log.id, "Edit", "edit", editable)}
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
    if (filter === "scrum-person") scrumFilters.personIds = checkedFilterValues("scrum-person");

    writeJsonPreference(preferenceKeys.scrumFilters, scrumFilters);
    return true;
  }

  async function handleAction(action, id) {
    const log = id ? state.devLogs.find(item => item.id === id) : null;

    if (action === "new-log") {
      editDevLog();
      return true;
    }
    if (action === "toggle-scrum-table-edit-mode") {
      scrumTableMode.toggle();
      renderDevLogs();
      return true;
    }
    if (action === "open-scrum-filters" || action === "toggle-scrum-filters") {
      openScrumFiltersDialog();
      return true;
    }
    if (action === "view-log") {
      viewDevLog(log);
      return true;
    }
    if (action === "edit-log") {
      if (log && canEditOwner(log.userId)) editDevLog(log);
      else viewDevLog(log);
      return true;
    }
    if (action === "duplicate-log") {
      if (log && canEditOwner(log.userId)) {
        await duplicateDevLog(id);
      }
      return true;
    }
    if (action === "delete-log") {
      if (log && canEditOwner(log.userId)) {
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
      existingDialog.querySelector("[data-filter='scrum-project']")?.focus({ preventScroll: true });
      return;
    }

    const modal = document.createElement("dialog");
    modal.className = "dialog scrum-filter-dialog";
    modal.dataset.scrumFilterDialog = "true";
    modal.innerHTML = `
      <form method="dialog">
        <div class="dialog-head">
          <h2>Scrum Filters</h2>
          <button type="button" class="icon-btn" data-close-scrum-filters title="Close" aria-label="Close">x</button>
        </div>
        <div class="dialog-body scrum-filter-dialog-body" data-scrum-filter-dialog-body></div>
        <div class="dialog-actions">
          <button type="button" class="primary text-icon-button" data-close-scrum-filters>${buttonContent("&#10003;", "Done")}</button>
        </div>
      </form>
    `;

    renderScrumFiltersDialog(modal);
    document.body.appendChild(modal);
    modal.addEventListener("change", event => {
      if (!applyScrumFilterChange(event.target)) return;
      renderDevLogs();
    });
    modal.addEventListener("click", event => {
      if (event.target.closest("[data-close-scrum-filters]")) modal.close();
    });
    modal.addEventListener("close", () => modal.remove());
    modal.showModal();
    modal.querySelector("[data-filter='scrum-project']")?.focus({ preventScroll: true });
  }

  function renderScrumFiltersDialog(modal) {
    const body = modal.querySelector("[data-scrum-filter-dialog-body]");
    if (!body) return;

    body.innerHTML = `
      <div class="scrum-filter-fields">
        <div class="task-filter-row scrum-filter-row">
          <label>
            <span>Project</span>
            <select data-filter="scrum-project">
              <option value="" ${!scrumFilters.projectId ? "selected" : ""}>All Projects</option>
              ${state.projects.map(project => `<option value="${project.id}" ${String(project.id) === String(scrumFilters.projectId || "") ? "selected" : ""}>${escapeHtml(project.code)} - ${escapeHtml(project.title)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Date</span>
            <input type="date" data-filter="scrum-date" value="${escapeAttr(scrumFilters.logDate || "")}">
          </label>
        </div>
        <div class="filter-stack">
          ${filterCheckList("Person", "scrum-person", state.users.map(user => ({
            value: user.id,
            text: user.nickname,
            avatarUrl: user.avatarUrl
          })), scrumFilters.personIds)}
        </div>
      </div>
    `;
  }

  function editDevLog(log = {}) {
    if (log.id && !canEditOwner(log.userId)) {
      viewDevLog(log);
      return;
    }

    const scrumPlaceholder = "What did you accomplish yesterday?\nWhat do you plan to do today?\nDo you have any roadblocks?";
    const firstScrumPrompt = "What did you accomplish yesterday?";
    const scrumHtml = log.bodyHtml || scrumPlaceholder.replaceAll("\n", "<br>");
    const rememberedProjectId = state.projects.some(project => project.id === scrumEntryProjectId)
      ? scrumEntryProjectId
      : 0;
    const selectedProjectId = log.id ? log.projectId || "" : rememberedProjectId || "";

    openEditor(scrumDialogTitle(log, "New Scrum"), `
      <div class="form-grid scrum-editor-grid">
        ${field("Date", "logDate", toDateInput(log.logDate || new Date()), "date")}
        ${selectOptionsField("Project", "projectId", [{ id: "", title: "No project" }, ...state.projects.map(project => ({ id: project.id, title: `${project.code} - ${project.title}` }))], selectedProjectId)}
        ${richTextField("bodyHtml", "Scrum", scrumHtml)}
        <label class="inline-check field full"><input name="isPinned" type="checkbox" ${log.isPinned ? "checked" : ""} ${currentUser().isAdmin ? "" : "disabled"}><span>Pinned</span></label>
      </div>
    `, async root => {
      const projectId = optionalNumberValue(root, "projectId");
      scrumEntryProjectId = projectId || 0;
      writePreference(preferenceKeys.scrumEntryProject, scrumEntryProjectId);

      await saveJson(log.id ? `/api/devlogs/${log.id}` : "/api/devlogs", log.id ? "PUT" : "POST", {
        id: log.id || 0,
        projectId,
        logDate: value(root, "logDate"),
        bodyHtml: richValue(root, "bodyHtml"),
        isPinned: root.querySelector("[name='isPinned']").checked
      });
    }, log.id ? "" : "bodyHtml", root => {
      if (!log.id) focusRichEditorAfterText(root, "bodyHtml", firstScrumPrompt);
    });
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
      <div class="detail-grid">
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

  async function duplicateDevLog(id) {
    const log = state.devLogs.find(item => item.id === id);
    if (!log) return;

    try {
      await saveJson("/api/devlogs", "POST", {
        id: 0,
        projectId: log.projectId || null,
        logDate: toDateInput(new Date()),
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

  function focusRichEditorAfterText(root, richName, text) {
    const editor = root.querySelector(`[data-rich='${richName}']`);
    if (!editor) return;

    setTimeout(() => {
      editor.focus();
      placeCaretAfterText(editor, text);
    }, 40);
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

  function deactivateScrum() {
    document.querySelectorAll("[data-scrum-filter-dialog]").forEach(dialog => {
      if (dialog.open) dialog.close();
      else dialog.remove();
    });
    scrumTableMode.activate();
  }

  return {
    deactivate: deactivateScrum,
    handleAction,
    handleFilterChange,
    render: renderDevLogs
  };
}
