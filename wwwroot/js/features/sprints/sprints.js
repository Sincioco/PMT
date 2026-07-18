import { avatarsHtml, syncAvatarStackFit } from "../../components/avatars.js?v=20260710-nav-avatar-fit";
import { buttonContent, funnelIconHtml, iconButton } from "../../components/buttons.js";
import { VisualCharts } from "../../components/charts.js?v=20260628-chart-native-tooltips";
import { askFinishSprintOptions, initializeWindowedDialog } from "../../components/dialogs.js";
import { createIdleFilterHeader } from "../../components/idle-filter-header.js?v=20260717-multi-screen-search-persistent";
import {
  checkListOrEmpty,
  checkedNumbers,
  field,
  nullableDateValue,
  numberValue,
  richTextField,
  richValue,
  selectField,
  userCardCheckListLabelHtml,
  value
} from "../../components/forms.js?v=20260717-day30-image-annotation";
import {
  sprintOverallProgressHtml,
  sprintStatusMetricsHtml,
  statusColor,
  workItemStatusCounts
} from "../../components/progress-and-status.js?v=20260714-linked-bug-percent";
import { sectionHead } from "../../components/sections.js?v=release-notes-2026-07-18-day-31-572729605b60";
import { api } from "../../core/api.js";
import {
  preferenceKeys,
  readNumberPreference,
  readPreference,
  writePreference
} from "../../core/preferences.js?v=20260717-multi-screen-header";
import { state } from "../../core/store.js";
import {
  formatDate,
  toDateInput
} from "../../shared/dates.js?v=20260620-null-end-date";
import { canAccessResource } from "../../shared/security.js?v=20260715-admin-impersonation";
import {
  projectById,
  projectName,
  sprintById
} from "../../shared/selectors.js";
import {
  escapeAttr,
  escapeHtml
} from "../../shared/text-and-links.js";
import { sprintWorkItems } from "../../shared/work-item-rules.js?v=20260716-developer-board-status";

export function createSprintsFeature({
  app,
  deleteItem,
  deleteItems,
  loadState,
  openEditor,
  openSprintTasks,
  render,
  saveJson,
  showToast
}) {
  let sprintProjectId = readNumberPreference(preferenceKeys.sprintProject, 0);
  let sprintFilterId = readPreference(preferenceKeys.sprintFilter, "all");
  let sprintSearch = readPreference(preferenceKeys.sprintSearch, "");
  let sprintEntryProjectId = readNumberPreference(preferenceKeys.sprintEntryProject, 0);
  let collapsedIds = new Set();
  let sprintEditMode = false;
  let sprintBulkDeleteBusy = false;
  const selectedSprintDeleteIds = new Set();
  const sprintHeader = createIdleFilterHeader({
    app,
    screenSelector: ".sprints-screen",
    searchFilter: "sprint-search",
    onSearchInput(value, { commit, render }) {
      sprintSearch = value;
      if (commit) writePreference(preferenceKeys.sprintSearch, sprintSearch);
      if (render) renderSprints();
      return true;
    }
  });

  function renderSprints() {
    ensureSelectedProject();
    normalizeSprintFilter();

    const visibleSprints = filteredSprints();
    pruneSprintDeleteSelection(visibleSprints);
    const allVisibleCollapsed = visibleSprints.length > 0 && visibleSprints.every(sprint => collapsedIds.has(sprint.id));

    app.innerHTML = `
      <section class="sprints-screen idle-filter-header-screen">
      ${sectionHead("Sprints", `
        ${sprintHeader.controlsHtml([
          {
            key: "project",
            filter: "sprint-project",
            label: "Project",
            optionsHtml: sprintProjectOptionsHtml(),
            summary: sprintProjectSummary().label,
            summaryTitle: sprintProjectSummary().title
          },
          {
            key: "sprint",
            filter: "sprint-filter",
            label: "Sprint",
            optionsHtml: sprintFilterOptionsHtml(),
            summary: sprintFilterSummary().label,
            summaryTitle: sprintFilterSummary().title
          }
        ])}
        ${sprintHeader.searchHtml(sprintSearch, "Search Sprints")}
        <button class="primary text-icon-button" type="button" data-action="new-sprint" data-idle-filter-header-add-target>${buttonContent("&#10010;", "New Sprint")}</button>
        <button class="icon-action" type="button" data-action="toggle-all-sprint-details" title="${allVisibleCollapsed ? "Expand all Sprint charts" : "Collapse all Sprint charts"}" aria-label="${allVisibleCollapsed ? "Expand all Sprint charts" : "Collapse all Sprint charts"}" aria-pressed="${!allVisibleCollapsed}">
          ${allVisibleCollapsed ? "&#9662;" : "&#9652;"}
        </button>
        <button class="secondary text-icon-button sprint-edit-mode-toggle" type="button" data-action="toggle-sprint-edit-mode" aria-pressed="${sprintEditMode}" title="${sprintEditMode ? "Finish Edit Mode" : "Edit Mode"}" ${canAccessResource("Sprints", "Delete") ? "" : "disabled"}>
          ${buttonContent(sprintEditMode ? "&#10003;" : "&#9998;", sprintEditMode ? "Done" : "Edit Mode")}
        </button>
        <button class="secondary text-icon-button" type="button" data-action="open-sprint-filters" title="Filters" aria-label="Filters" aria-haspopup="dialog">
          ${buttonContent(funnelIconHtml(), "Filters")}
        </button>
      `)}
      <div class="grid sprints-grid">
        ${visibleSprints.map(sprintCardHtml).join("") || `<div class="empty">No Sprints for this filter.</div>`}
      </div>
      </section>
    `;
    sprintHeader.bind();
    bindSprintDeleteSelection();
    syncAvatarStackFit(app);
  }

  function sprintProjectOptionsHtml() {
    return state.projects
      .map(project => `<option value="${project.id}" ${project.id === sprintProjectId ? "selected" : ""}>${escapeHtml(project.code)} - ${escapeHtml(project.title)}</option>`)
      .join("");
  }

  function sprintFilterOptionsHtml() {
    return `
      <option value="all" ${sprintFilterId === "all" ? "selected" : ""}>All Sprints</option>
      ${state.sprints
        .filter(sprint => sprint.projectId === sprintProjectId)
        .map(sprint => `<option value="${sprint.id}" ${String(sprint.id) === sprintFilterId ? "selected" : ""}>${escapeHtml(sprint.code)} - ${escapeHtml(sprint.title)}</option>`)
        .join("")}
    `;
  }

  function sprintProjectSummary() {
    const project = projectById(sprintProjectId);
    return project
      ? { label: `${project.code} - ${project.title}`, title: `${project.code} - ${project.title}` }
      : { label: "No Project", title: "No Project" };
  }

  function sprintFilterSummary() {
    if (sprintFilterId === "all") return { label: "All Sprints", title: "All Sprints" };
    const sprint = sprintById(Number(sprintFilterId));
    return sprint
      ? { label: sprint.title, title: `${sprint.code} - ${sprint.title}` }
      : { label: "All Sprints", title: "All Sprints" };
  }

  function normalizeSprintFilter() {
    if (
      sprintFilterId === "all"
      || state.sprints.some(sprint => sprint.id === Number(sprintFilterId) && sprint.projectId === sprintProjectId)
    ) return;

    sprintFilterId = "all";
    writePreference(preferenceKeys.sprintFilter, sprintFilterId);
  }

  function filteredSprints() {
    const search = sprintSearch.trim().toLowerCase();
    return state.sprints
      .filter(sprint => sprint.projectId === sprintProjectId)
      .filter(sprint => sprintFilterId === "all" || sprint.id === Number(sprintFilterId))
      .filter(sprint => !search || sprintMatchesSearch(sprint, search));
  }

  function sprintMatchesSearch(sprint, search) {
    const project = projectById(sprint.projectId);
    const members = (sprint.developers || [])
      .flatMap(user => [user.name, user.nickname, user.firstName, user.lastName, user.email]);
    return [
      sprint.code,
      sprint.title,
      sprint.description,
      project?.code,
      project?.title,
      ...members
    ].join(" ").toLowerCase().includes(search);
  }

  function sprintCardHtml(sprint) {
    const isCollapsed = collapsedIds.has(sprint.id);
    const chartToggleTitle = isCollapsed ? "Expand Sprint charts" : "Collapse Sprint charts";
    const sprintName = `${sprint.code} - ${sprint.title}`;

    return `
      <article class="card clickable-card sprint-card" data-action="view-sprint-tasks" data-id="${sprint.id}" title="${escapeAttr(sprintName)}">
        <div class="spread sprint-card-head">
          <div class="sprint-title-block">
            <h3>${escapeHtml(sprintName)}</h3>
            <p class="muted sprint-project-name">${escapeHtml(projectName(sprint.projectId))}</p>
            <p class="muted sprint-metrics">${sprint.completedTaskCount}/${sprint.taskCount} QA Passed+ | ${sprint.openBugCount}/${sprint.bugCount} open bug reports</p>
          </div>
          <div class="sprint-card-actions">
            <span class="pill sprint-state ${sprint.isFinished ? "sprint-state-finished" : "sprint-state-open"}">${sprint.isFinished ? "Finished" : "Open"}</span>
            <button class="icon-action" type="button" data-action="toggle-sprint-card-details" data-id="${sprint.id}" title="${chartToggleTitle}" aria-label="${chartToggleTitle}" aria-expanded="${!isCollapsed}">
              ${isCollapsed ? "&#9662;" : "&#9652;"}
            </button>
          </div>
        </div>
        <p class="muted sprint-dates">${formatDate(sprint.startDate)} - ${formatDate(sprint.endDate)}</p>
        ${sprintOverallProgressHtml(sprint)}
        ${isCollapsed ? "" : sprintStatusDonutHtml(sprint)}
        ${isCollapsed ? "" : sprintStatusMetricsHtml(sprint, { showTotal: false })}
        <div class="row sprint-members">${avatarsHtml(sprint.developers, { fit: "auto" })}</div>
        <div class="toolbar reveal-actions sprint-actions">
          ${sprintDeleteSelectionHtml(sprint)}
          ${iconButton("delete-sprint", sprint.id, "Delete", "delete", canAccessResource("Sprints", "Delete"), "danger")}
          ${iconButton("finish-sprint", sprint.id, "Finish", "finish", canAccessResource("Sprints", "Update") && !sprint.isFinished)}
          ${iconButton("edit-sprint", sprint.id, "Edit", "edit", canAccessResource("Sprints", "Update"))}
        </div>
      </article>
    `;
  }

  function sprintStatusDonutHtml(sprint) {
    const workItems = sprintWorkItems(sprint.id);
    const rows = workItemStatusCounts(workItems);
    const total = rows.reduce((sum, item) => sum + item.count, 0);
    if (!total) return "";

    const items = rows.map(item => {
      const statusWorkItems = workItems.filter(workItem => workItem.status === item.status);
      const workItemIds = statusWorkItems.map(workItem => workItem.id);
      const actionTarget = statusWorkItems.length === 1
        ? { action: "view-task", id: statusWorkItems[0].id }
        : statusWorkItems.length > 1
          ? { action: "chart-drill-work-items", ids: workItemIds.join(","), chartTitle: item.status }
          : {};

      return {
        label: item.status,
        value: item.count,
        color: statusColor(item.status),
        tooltip: `${item.status}: ${item.count} work item${item.count === 1 ? "" : "s"}`,
        ...actionTarget
      };
    });

    return `
      <div class="sprint-status-mix" title="">
        <div class="sprint-status-mix-head">
          <h4>Task Status Mix</h4>
          <span>${total} total</span>
        </div>
        ${VisualCharts.pieChart(items, `${total} total`, "No Dev Tasks or Bugs.", {
          donut: true,
          centerValue: String(total),
          centerLabel: "Total"
        })}
      </div>
    `;
  }

  function sprintDeleteSelectionHtml(sprint) {
    if (!sprintEditMode) return "";

    const checked = selectedSprintDeleteIds.has(sprint.id);
    const label = `Select ${sprint.code} - ${sprint.title} for bulk delete`;
    return `
      <label class="sprint-delete-selection" title="${escapeAttr(label)}">
        <input type="checkbox" data-sprint-delete-select data-id="${sprint.id}" aria-label="${escapeAttr(label)}" ${checked ? "checked" : ""} ${sprintCanDelete(sprint) && !sprintBulkDeleteBusy ? "" : "disabled"}>
      </label>
    `;
  }

  function bindSprintDeleteSelection() {
    app.querySelectorAll("[data-sprint-delete-select]").forEach(input => {
      input.closest("label")?.addEventListener("click", event => event.stopPropagation());
      input.addEventListener("click", event => event.stopPropagation());
      input.addEventListener("change", () => {
        if (sprintBulkDeleteBusy) return;
        const id = Number(input.dataset.id || 0);
        if (!id) return;

        if (input.checked) {
          selectedSprintDeleteIds.add(id);
        } else {
          selectedSprintDeleteIds.delete(id);
        }
        syncSprintDeleteSelectionControls();
      });
    });

    syncSprintDeleteSelectionControls();
  }

  function syncSprintDeleteSelectionControls() {
    const selectedCount = selectedSprintDeleteIds.size;
    const selectedTitle = sprintSelectedDeleteTitle(selectedCount);

    app.querySelectorAll("[data-sprint-delete-select]").forEach(input => {
      const id = Number(input.dataset.id || 0);
      const sprint = sprintById(id);
      input.checked = selectedSprintDeleteIds.has(id);
      input.disabled = sprintBulkDeleteBusy || !sprintCanDelete(sprint);
    });

    app.querySelectorAll("[data-action='delete-sprint']").forEach(button => {
      const id = Number(button.dataset.id || 0);
      const sprint = sprintById(id);
      const title = selectedSprintDeleteIds.has(id) ? selectedTitle : "Delete";
      button.disabled = sprintBulkDeleteBusy || !sprintCanDelete(sprint);
      button.title = title;
      button.setAttribute("aria-label", title);
    });
  }

  function pruneSprintDeleteSelection(visibleSprints) {
    if (!sprintEditMode) {
      selectedSprintDeleteIds.clear();
      return;
    }

    const visibleIds = new Set(
      visibleSprints
        .filter(sprintCanDelete)
        .map(sprint => sprint.id)
    );
    [...selectedSprintDeleteIds].forEach(id => {
      if (!visibleIds.has(id)) selectedSprintDeleteIds.delete(id);
    });
  }

  function sprintCanDelete(sprint) {
    return Boolean(sprint) && canAccessResource("Sprints", "Delete");
  }

  function sprintSelectedDeleteTitle(count = selectedSprintDeleteIds.size) {
    return count === 1
      ? "Delete selected Sprint"
      : `Delete ${count} selected Sprints`;
  }

  async function deleteSelectedSprints() {
    const sprints = [...selectedSprintDeleteIds]
      .map(sprintById)
      .filter(sprintCanDelete);
    if (!sprints.length) return;

    const count = sprints.length;
    sprintBulkDeleteBusy = true;
    syncSprintDeleteSelectionControls();
    try {
      await deleteItems(
        sprints.map(sprint => `/api/sprints/${sprint.id}`),
        `${sprintSelectedDeleteTitle(count)}?`,
        `${count} Sprint${count === 1 ? "" : "s"} deleted.`
      );
    } finally {
      sprintBulkDeleteBusy = false;
      syncSprintDeleteSelectionControls();
    }
  }

  async function handleAction(action, id) {
    if (action === "toggle-sprint-edit-mode") {
      sprintEditMode = !sprintEditMode;
      selectedSprintDeleteIds.clear();
      renderSprints();
      return true;
    }
    if (action === "open-sprint-filters") {
      openSprintFiltersDialog();
      return true;
    }
    if (action === "new-sprint") {
      editSprint();
      return true;
    }
    if (action === "edit-sprint") {
      editSprint(sprintById(id));
      return true;
    }
    if (action === "view-sprint-tasks") {
      openSprintTasks(id);
      return true;
    }
    if (action === "finish-sprint") {
      await finishSprint(id);
      return true;
    }
    if (action === "delete-sprint") {
      if (selectedSprintDeleteIds.has(id)) {
        await deleteSelectedSprints();
      } else {
        await deleteItem(`/api/sprints/${id}`, "Delete this Sprint?");
      }
      return true;
    }
    if (action === "toggle-sprint-card-details") {
      toggleSprintCardDetails(id);
      return true;
    }
    if (action === "toggle-all-sprint-details") {
      toggleAllSprintDetails();
      return true;
    }

    return false;
  }

  function handleFilterChange(eventOrTarget) {
    const target = eventOrTarget?.target || eventOrTarget;
    const filter = target?.dataset?.filter || "";

    if (filter === "sprint-project") {
      selectProject(target.value);
      sprintFilterId = "all";
      writePreference(preferenceKeys.sprintFilter, sprintFilterId);
      renderSprints();
      return true;
    }
    if (filter === "sprint-filter") {
      sprintFilterId = target.value || "all";
      writePreference(preferenceKeys.sprintFilter, sprintFilterId);
      renderSprints();
      return true;
    }
    if (filter === "sprint-search") {
      sprintSearch = target.value || "";
      writePreference(preferenceKeys.sprintSearch, sprintSearch);
      renderSprints();
      return true;
    }

    return false;
  }

  function openSprintFiltersDialog() {
    const existingDialog = document.querySelector("[data-sprint-filter-dialog]");
    if (existingDialog) {
      if (!existingDialog.open) existingDialog.showModal?.();
      existingDialog.querySelector("[data-filter='sprint-search']")?.focus({ preventScroll: true });
      return;
    }

    const modal = document.createElement("dialog");
    modal.className = "dialog sprint-filter-dialog";
    modal.dataset.sprintFilterDialog = "true";
    modal.innerHTML = `
      <form method="dialog">
        <div class="dialog-head">
          <h2>Sprint Filters</h2>
          <button type="button" class="icon-btn" data-close-sprint-filters title="Close" aria-label="Close">x</button>
        </div>
        <div class="dialog-body sprint-filter-dialog-body" data-sprint-filter-dialog-body></div>
        <div class="dialog-actions">
          <button type="button" class="primary text-icon-button" data-close-sprint-filters>${buttonContent("&#10003;", "Done")}</button>
        </div>
      </form>
    `;

    renderSprintFiltersDialog(modal);
    document.body.appendChild(modal);
    initializeWindowedDialog(modal);
    modal.addEventListener("input", event => {
      handleFilterChange(event.target);
    });
    modal.addEventListener("change", event => {
      const filter = event.target?.dataset?.filter || "";
      if (!handleFilterChange(event.target)) return;
      if (filter === "sprint-project") {
        renderSprintFiltersDialog(modal);
        modal.querySelector("[data-filter='sprint-project']")?.focus({ preventScroll: true });
      }
    });
    modal.addEventListener("click", event => {
      if (event.target.closest("[data-close-sprint-filters]")) modal.close();
    });
    modal.addEventListener("close", () => modal.remove());
    modal.showModal();
    modal.querySelector("[data-filter='sprint-search']")?.focus({ preventScroll: true });
  }

  function renderSprintFiltersDialog(modal) {
    const body = modal.querySelector("[data-sprint-filter-dialog-body]");
    if (!body) return;

    body.innerHTML = `
      <div class="sprint-filter-fields">
        <label>
          <span>Project</span>
          <select data-filter="sprint-project">${sprintProjectOptionsHtml()}</select>
        </label>
        <label>
          <span>Sprint</span>
          <select data-filter="sprint-filter">${sprintFilterOptionsHtml()}</select>
        </label>
        <label class="sprint-filter-search-field">
          <span>Search</span>
          <input type="search" data-filter="sprint-search" value="${escapeAttr(sprintSearch)}">
        </label>
      </div>
    `;
  }

  function selectProject(projectId) {
    sprintProjectId = Number(projectId || 0);
    writePreference(preferenceKeys.sprintProject, sprintProjectId);
  }

  function ensureSelectedProject() {
    if (!sprintProjectId && state.projects.length) sprintProjectId = state.projects[0].id;
    if (!state.projects.some(project => project.id === sprintProjectId) && state.projects.length) {
      sprintProjectId = state.projects[0].id;
    }
  }

  function editSprint(sprint = {}) {
    const rememberedProjectId = projectById(sprintEntryProjectId)
      ? sprintEntryProjectId
      : 0;
    const projectId = sprint.projectId
      || rememberedProjectId
      || sprintProjectId
      || state.projects[0]?.id;

    openEditor(sprint.id ? "Edit Sprint" : "New Sprint", `
      <div class="form-grid">
        ${selectField("Project", "projectId", state.projects, projectId, { required: true })}
        ${field("Title", "title", sprint.title || "", "text", "", "", "", { required: true })}
        ${field("Start", "startDate", toDateInput(sprint.startDate), "date")}
        ${field("End", "endDate", toDateInput(sprint.endDate), "date")}
        <div class="field full"><label>Description</label><textarea name="description">${escapeHtml(sprint.description || "")}</textarea></div>
        ${richTextField("lessonLearnedHtml", "Lessons Learned", sprint.lessonLearnedHtml || "")}
        <div class="field full" data-member-list="developerIds"></div>
      </div>
    `, async root => {
      const savedProjectId = numberValue(root, "projectId");
      const title = value(root, "title");
      const developerIds = checkedNumbers(root, "developerIds");

      if (!title.trim()) {
        focusSprintField(root, "title");
        throw new Error("Sprint title is required.");
      }
      if (!developerIds.length) {
        focusSprintField(root, "developerIds");
        throw new Error("Select at least one Sprint member.");
      }

      await saveJson(sprint.id ? `/api/sprints/${sprint.id}` : "/api/sprints", sprint.id ? "PUT" : "POST", {
        id: sprint.id || 0,
        projectId: savedProjectId,
        title,
        description: value(root, "description"),
        startDate: nullableDateValue(root, "startDate"),
        endDate: nullableDateValue(root, "endDate"),
        lessonLearnedHtml: richValue(root, "lessonLearnedHtml"),
        developerIds,
        expectedRowVersion: sprint.id ? sprint.rowVersion || null : undefined
      }, {
        saveAsNew: true,
        canCreate: canAccessResource("Sprints", "Create"),
        createPath: "/api/sprints"
      });

      sprintEntryProjectId = savedProjectId;
      writePreference(preferenceKeys.sprintEntryProject, sprintEntryProjectId);
    }, "title", root => bindSprintMemberList(root, sprint.developerIds || [], { selectAllByDefault: !sprint.id }));
  }

  function focusSprintField(root, name) {
    const control = root.querySelector(`[name='${name}']`);
    const field = control?.closest(".field") || root.querySelector(`[data-member-list='${name}']`);

    field?.scrollIntoView({ behavior: "smooth", block: "center" });
    control?.focus({ preventScroll: true });
  }

  async function finishSprint(id) {
    const sprint = sprintById(id);
    if (!sprint) return;

    const options = await askFinishSprintOptions();
    if (!options) return;

    try {
      await api(`/api/sprints/${id}/finish`, {
        method: "POST",
        body: JSON.stringify({
          ...options,
          expectedRowVersion: sprint.rowVersion || null
        })
      });
      await loadState();
      render();
      showToast("Sprint finished.");
    } catch (error) {
      await loadState();
      render();
      showToast(error.message);
    }
  }

  function toggleSprintCardDetails(sprintId) {
    const id = Number(sprintId);

    if (collapsedIds.has(id)) {
      collapsedIds.delete(id);
    } else {
      collapsedIds.add(id);
    }

    renderSprints();
  }

  function toggleAllSprintDetails() {
    const visibleSprintIds = filteredSprints().map(sprint => sprint.id);
    const allVisibleCollapsed = visibleSprintIds.length > 0 && visibleSprintIds.every(id => collapsedIds.has(id));

    visibleSprintIds.forEach(id => {
      if (allVisibleCollapsed) {
        collapsedIds.delete(id);
      } else {
        collapsedIds.add(id);
      }
    });

    renderSprints();
  }

  function bindSprintMemberList(root, initialSelectedIds, options = {}) {
    const projectSelect = root.querySelector("[name='projectId']");
    const container = root.querySelector("[data-member-list='developerIds']");
    if (!projectSelect || !container) return;

    let firstRender = true;
    const renderMembers = (selectAll = false) => {
      const members = projectMemberUsers(Number(projectSelect.value));
      const selectedIds = selectAll
        ? members.map(user => user.id)
        : firstRender
          ? initialSelectedIds
          : checkedNumbers(root, "developerIds");
      firstRender = false;
      container.innerHTML = checkListOrEmpty(
        "Sprint Members",
        "developerIds",
        members,
        selectedIds,
        "Select project members before adding people to this Sprint.",
        { className: "scroll-check-list user-card-check-list", renderItem: userCardCheckListLabelHtml, required: true }
      );
    };

    projectSelect.addEventListener("change", () => renderMembers(Boolean(options.selectAllByDefault)));
    renderMembers(Boolean(options.selectAllByDefault));
  }

  function projectMemberUsers(projectId) {
    const memberIds = new Set(projectById(projectId)?.memberIds || []);
    return state.users.filter(user => memberIds.has(user.id));
  }

  function deactivateSprints() {
    document.querySelectorAll("[data-sprint-filter-dialog]").forEach(dialog => {
      if (dialog.open) {
        dialog.close();
      } else {
        dialog.remove();
      }
    });
    sprintHeader.deactivate();
    sprintEditMode = false;
    sprintBulkDeleteBusy = false;
    selectedSprintDeleteIds.clear();
  }

  return {
    deactivate: deactivateSprints,
    handleAction,
    handleFilterChange,
    openCreate: () => editSprint(),
    render: renderSprints,
    selectProject
  };
}
