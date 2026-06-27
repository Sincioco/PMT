import { avatarsHtml } from "../../components/avatars.js";
import { buttonContent, iconButton } from "../../components/buttons.js";
import { askFinishSprintOptions } from "../../components/dialogs.js";
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
} from "../../components/forms.js?v=20260627-user-card-checklist";
import {
  sprintOverallProgressHtml,
  sprintStatusMetricsHtml
} from "../../components/progress-and-status.js?v=20260620-ui-theme";
import { sectionHead } from "../../components/sections.js";
import { api } from "../../core/api.js";
import {
  preferenceKeys,
  readNumberPreference,
  writePreference
} from "../../core/preferences.js?v=20260620-sprint-entry-project";
import { state } from "../../core/store.js";
import {
  formatDate,
  toDateInput
} from "../../shared/dates.js?v=20260620-null-end-date";
import { canEditOwner } from "../../shared/permissions.js";
import {
  projectById,
  projectName,
  sprintById
} from "../../shared/selectors.js";
import { escapeHtml } from "../../shared/text-and-links.js";

export function createSprintsFeature({
  app,
  deleteItem,
  loadState,
  openEditor,
  openSprintTasks,
  render,
  saveJson,
  showToast
}) {
  let sprintProjectId = readNumberPreference(preferenceKeys.sprintProject, 0);
  let sprintEntryProjectId = readNumberPreference(preferenceKeys.sprintEntryProject, 0);
  let collapsedIds = new Set();

  function renderSprints() {
    ensureSelectedProject();

    const visibleSprints = state.sprints.filter(sprint => sprint.projectId === sprintProjectId);
    const allVisibleCollapsed = visibleSprints.length > 0 && visibleSprints.every(sprint => collapsedIds.has(sprint.id));

    app.innerHTML = `
      ${sectionHead("Sprints", `
        <label class="section-filter-label">
          <span>Project</span>
          <select data-filter="sprint-project">
            ${state.projects.map(project => `<option value="${project.id}" ${project.id === sprintProjectId ? "selected" : ""}>${escapeHtml(project.code)} - ${escapeHtml(project.title)}</option>`).join("")}
          </select>
        </label>
        <button class="icon-action" type="button" data-action="toggle-all-sprint-details" title="${allVisibleCollapsed ? "Expand all Sprint charts" : "Collapse all Sprint charts"}" aria-label="${allVisibleCollapsed ? "Expand all Sprint charts" : "Collapse all Sprint charts"}" aria-pressed="${!allVisibleCollapsed}">
          ${allVisibleCollapsed ? "&#9662;" : "&#9652;"}
        </button>
        <button class="primary text-icon-button" type="button" data-action="new-sprint">${buttonContent("&#10010;", "New Sprint")}</button>
      `)}
      <div class="grid sprints-grid">
        ${visibleSprints.map(sprintCardHtml).join("") || `<div class="empty">No Sprints for this project.</div>`}
      </div>
    `;
  }

  function sprintCardHtml(sprint) {
    const isCollapsed = collapsedIds.has(sprint.id);
    const chartToggleTitle = isCollapsed ? "Expand Sprint charts" : "Collapse Sprint charts";

    return `
      <article class="card clickable-card sprint-card" data-action="view-sprint-tasks" data-id="${sprint.id}">
        <div class="spread sprint-card-head">
          <div class="sprint-title-block">
            <h3>${escapeHtml(sprint.code)}</h3>
            <p class="muted sprint-project-name">${escapeHtml(projectName(sprint.projectId))}</p>
          </div>
          <div class="sprint-card-actions">
            <span class="pill sprint-state ${sprint.isFinished ? "sprint-state-finished" : "sprint-state-open"}">${sprint.isFinished ? "Finished" : "Open"}</span>
            <button class="icon-action" type="button" data-action="toggle-sprint-card-details" data-id="${sprint.id}" title="${chartToggleTitle}" aria-label="${chartToggleTitle}" aria-expanded="${!isCollapsed}">
              ${isCollapsed ? "&#9662;" : "&#9652;"}
            </button>
          </div>
        </div>
        <p class="sprint-title">${escapeHtml(sprint.title)}</p>
        <p class="muted sprint-dates">${formatDate(sprint.startDate)} - ${formatDate(sprint.endDate)}</p>
        <p class="muted sprint-metrics">${sprint.completedTaskCount}/${sprint.taskCount} QA Passed+ | ${sprint.openBugCount}/${sprint.bugCount} open bug reports</p>
        ${sprintOverallProgressHtml(sprint)}
        ${isCollapsed ? "" : sprintStatusMetricsHtml(sprint)}
        <div class="row sprint-members">${avatarsHtml(sprint.developers)}</div>
        <div class="toolbar reveal-actions sprint-actions">
          ${iconButton("delete-sprint", sprint.id, "Delete", "delete", canEditOwner(sprint.createdByUserId), "danger")}
          ${iconButton("finish-sprint", sprint.id, "Finish", "finish", canEditOwner(sprint.createdByUserId) && !sprint.isFinished)}
          ${iconButton("edit-sprint", sprint.id, "Edit", "edit", canEditOwner(sprint.createdByUserId))}
        </div>
      </article>
    `;
  }

  async function handleAction(action, id) {
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
      await deleteItem(`/api/sprints/${id}`, "Delete this Sprint?");
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
    if (target?.dataset?.filter !== "sprint-project") return false;

    selectProject(target.value);
    renderSprints();
    return true;
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
        ${selectField("Project", "projectId", state.projects, projectId)}
        ${field("Title", "title", sprint.title || "", "text")}
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
        developerIds
      });

      sprintEntryProjectId = savedProjectId;
      writePreference(preferenceKeys.sprintEntryProject, sprintEntryProjectId);
    }, "", root => bindSprintMemberList(root, sprint.developerIds || []));
  }

  function focusSprintField(root, name) {
    const control = root.querySelector(`[name='${name}']`);
    const field = control?.closest(".field") || root.querySelector(`[data-member-list='${name}']`);

    field?.scrollIntoView({ behavior: "smooth", block: "center" });
    control?.focus({ preventScroll: true });
  }

  async function finishSprint(id) {
    const options = await askFinishSprintOptions();
    if (!options) return;

    try {
      await api(`/api/sprints/${id}/finish`, {
        method: "POST",
        body: JSON.stringify(options)
      });
      await loadState();
      render();
      showToast("Sprint finished.");
    } catch (error) {
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
    const visibleSprintIds = state.sprints
      .filter(sprint => sprint.projectId === sprintProjectId)
      .map(sprint => sprint.id);
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

  function bindSprintMemberList(root, initialSelectedIds) {
    const projectSelect = root.querySelector("[name='projectId']");
    const container = root.querySelector("[data-member-list='developerIds']");
    if (!projectSelect || !container) return;

    let firstRender = true;
    const renderMembers = () => {
      const selectedIds = firstRender ? initialSelectedIds : checkedNumbers(root, "developerIds");
      firstRender = false;
      container.innerHTML = checkListOrEmpty(
        "Sprint Members",
        "developerIds",
        projectMemberUsers(Number(projectSelect.value)),
        selectedIds,
        "Select project members before adding people to this Sprint.",
        { className: "scroll-check-list user-card-check-list", renderItem: userCardCheckListLabelHtml }
      );
    };

    projectSelect.addEventListener("change", renderMembers);
    renderMembers();
  }

  function projectMemberUsers(projectId) {
    const memberIds = new Set(projectById(projectId)?.memberIds || []);
    return state.users.filter(user => memberIds.has(user.id));
  }

  return {
    handleAction,
    handleFilterChange,
    openCreate: () => editSprint(),
    render: renderSprints,
    selectProject
  };
}
