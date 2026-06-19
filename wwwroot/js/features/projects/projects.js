import { avatarsHtml } from "../../components/avatars.js";
import { buttonContent, iconButton } from "../../components/buttons.js";
import {
  checkList,
  checkedNumbers,
  field,
  nullableDateValue,
  value
} from "../../components/forms.js";
import {
  projectOverallProgressHtml,
  projectStatusMetricsHtml
} from "../../components/progress-and-status.js?v=20260620-ui-theme";
import { sectionHead } from "../../components/sections.js";
import { state } from "../../core/store.js";
import { toDateInput } from "../../shared/dates.js";
import { canEditOwner } from "../../shared/permissions.js";
import { projectById } from "../../shared/selectors.js";
import {
  escapeAttr,
  escapeHtml
} from "../../shared/text-and-links.js";

export function createProjectsFeature({
  app,
  deleteItem,
  openEditor,
  openProjectGantt,
  openSprintsForProject,
  render,
  saveJson,
  uploadFile
}) {
  let collapsedIds = new Set();

  function renderProjects() {
    app.innerHTML = `
      ${sectionHead("Projects", `<button class="primary text-icon-button" type="button" data-action="new-project">${buttonContent("&#10010;", "New Project")}</button>`)}
      <div class="grid projects-grid">${state.projects.map(projectCardHtml).join("")}</div>
    `;
  }

  function projectCardHtml(project) {
    const isCollapsed = collapsedIds.has(project.id);
    const chartToggleTitle = isCollapsed ? "Expand Project charts" : "Collapse Project charts";

    return `
      <article class="card clickable-card project-card" data-action="view-project-sprints" data-id="${project.id}">
        <div class="spread project-card-head">
          <div class="row project-identity">
            <img class="project-icon" src="${escapeAttr(project.iconUrl || "/assets/project-pmt.svg")}" alt="">
            <div>
              <h3>${escapeHtml(project.code)} - ${escapeHtml(project.title)}</h3>
              <p class="muted project-metrics">${project.completedTaskCount}/${project.taskCount} QA Passed+ | ${project.openBugCount}/${project.bugCount} open bug reports</p>
            </div>
          </div>
          <button class="icon-action" type="button" data-action="toggle-project-card-details" data-id="${project.id}" title="${chartToggleTitle}" aria-label="${chartToggleTitle}" aria-expanded="${!isCollapsed}">
            ${isCollapsed ? "&#9662;" : "&#9652;"}
          </button>
        </div>
        <p class="project-description">${escapeHtml(project.description || "")}</p>
        ${projectOverallProgressHtml(project)}
        ${isCollapsed ? "" : projectStatusMetricsHtml(project)}
        <div class="row project-members">${avatarsHtml(project.members)}</div>
        <div class="toolbar reveal-actions project-actions">
          ${iconButton("delete-project", project.id, "Delete", "delete", canEditOwner(project.createdByUserId), "danger")}
          ${iconButton("view-project-gantt", project.id, "Gantt", "gantt", true)}
          ${iconButton("edit-project", project.id, "Edit", "edit", canEditOwner(project.createdByUserId))}
        </div>
      </article>
    `;
  }

  async function handleAction(action, id) {
    if (action === "new-project") {
      editProject();
      return true;
    }
    if (action === "edit-project") {
      editProject(projectById(id));
      return true;
    }
    if (action === "delete-project") {
      await deleteItem(`/api/projects/${id}`, "Delete this project?");
      return true;
    }
    if (action === "view-project-sprints") {
      openSprintsForProject(id);
      return true;
    }
    if (action === "view-project-gantt") {
      openProjectGantt(id);
      return true;
    }
    if (action === "toggle-project-card-details") {
      toggleProjectCardDetails(id);
      return true;
    }

    return false;
  }

  function editProject(project = {}) {
    openEditor(project.id ? "Edit Project" : "New Project", `
      <div class="form-grid">
        ${field("Code", "code", project.code || "", "text")}
        ${field("Title", "title", project.title || "", "text")}
        ${field("Start", "startDate", toDateInput(project.startDate), "date")}
        ${field("End", "endDate", toDateInput(project.endDate), "date")}
        ${field("URL", "url", project.url || "", "url")}
        ${field("Icon URL", "iconUrl", project.iconUrl || "", "text")}
        <div class="field full"><label>Upload Icon</label><input name="iconFile" type="file" accept="image/*"></div>
        <div class="field full"><label>Description</label><textarea name="description">${escapeHtml(project.description || "")}</textarea></div>
        ${checkList("Members", "memberIds", state.users, project.memberIds || [])}
      </div>
    `, async root => {
      const iconFile = root.querySelector("[name='iconFile']").files[0];
      let iconUrl = value(root, "iconUrl");
      if (iconFile) iconUrl = (await uploadFile("projects", iconFile)).url;

      await saveJson(project.id ? `/api/projects/${project.id}` : "/api/projects", project.id ? "PUT" : "POST", {
        id: project.id || 0,
        code: value(root, "code"),
        title: value(root, "title"),
        description: value(root, "description"),
        url: value(root, "url"),
        iconUrl,
        startDate: nullableDateValue(root, "startDate"),
        endDate: nullableDateValue(root, "endDate"),
        memberIds: checkedNumbers(root, "memberIds")
      });
    }, "code");
  }

  function toggleProjectCardDetails(projectId) {
    const id = Number(projectId);

    if (collapsedIds.has(id)) {
      collapsedIds.delete(id);
    } else {
      collapsedIds.add(id);
    }

    render();
  }

  return {
    cardHtml: projectCardHtml,
    handleAction,
    isCollapsed: projectId => collapsedIds.has(Number(projectId)),
    render: renderProjects
  };
}
