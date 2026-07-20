import { avatarsHtml, syncAvatarStackFit } from "../../components/avatars.js?v=20260710-nav-avatar-fit";
import { buttonContent, iconButton } from "../../components/buttons.js";
import { VisualCharts } from "../../components/charts.js?v=20260628-chart-native-tooltips";
import { askYesNo } from "../../components/dialogs.js";
import {
  checkList,
  checkedNumbers,
  field,
  nullableDateValue,
  userCardCheckListLabelHtml,
  value
} from "../../components/forms.js?v=20260719-rte-insert-diagram";
import { currentUser } from "../../core/authentication.js?v=20260715-admin-impersonation";
import {
  projectOverallProgressHtml,
  projectStatusCounts,
  projectStatusMetricsHtml,
  statusColor
} from "../../components/progress-and-status.js?v=20260714-linked-bug-percent";
import { sectionHead } from "../../components/sections.js?v=release-notes-2026-07-20-day-33-f01459e78a5a";
import { state } from "../../core/store.js";
import { toDateInput } from "../../shared/dates.js?v=20260620-null-end-date";
import { canAccessResource } from "../../shared/security.js?v=20260715-admin-impersonation";
import { projectIconUrl } from "../../shared/project-assets.js?v=20260713-invite-users";
import { projectById } from "../../shared/selectors.js";
import {
  escapeAttr,
  escapeHtml
} from "../../shared/text-and-links.js";
import { projectWorkItems } from "../../shared/work-item-rules.js?v=20260716-developer-board-status";

const archivedProjectCodeConflict = "archived-project-code";

export async function saveProjectWithArchivedCodeOverride({
  saveJson,
  path,
  method,
  payload,
  isAdmin,
  saveOptions = {},
  confirmReuse = askYesNo
}) {
  try {
    return await saveJson(path, method, payload, saveOptions);
  } catch (error) {
    if (error?.code !== archivedProjectCodeConflict || !isAdmin) throw error;

    const confirmed = await confirmReuse(
      `Project code "${payload.code}" belongs to a deleted project. Reusing it will preserve the deleted project under a replacement code and assign "${payload.code}" to this project. Continue?`,
      "Reuse Project Code"
    );
    if (!confirmed) throw new Error("Project code reuse canceled.");

    return saveJson(path, method, { ...payload, overrideArchivedCode: true }, saveOptions);
  }
}

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
    syncAvatarStackFit(app);
  }

  function projectCardHtml(project, options = {}) {
    const isCollapsed = collapsedIds.has(project.id);
    const chartToggleTitle = isCollapsed ? "Expand Project charts" : "Collapse Project charts";
    const showStatusDonut = options.showStatusDonut !== false;
    const statusMetricOptions = { showTotal: options.showStatusTotals === true };
    const projectName = `${project.code} - ${project.title}`;

    return `
      <article class="card clickable-card project-card" data-action="view-project-sprints" data-id="${project.id}" title="${escapeAttr(projectName)}">
        <div class="spread project-card-head">
          <div class="row project-identity">
            <img class="project-icon" src="${escapeAttr(projectIconUrl(project))}" alt="">
            <div>
              <h3>${escapeHtml(projectName)}</h3>
              <p class="muted project-metrics">${project.completedTaskCount}/${project.taskCount} QA Passed+ | ${project.openBugCount}/${project.bugCount} open bug reports</p>
            </div>
          </div>
          <button class="icon-action" type="button" data-action="toggle-project-card-details" data-id="${project.id}" title="${chartToggleTitle}" aria-label="${chartToggleTitle}" aria-expanded="${!isCollapsed}">
            ${isCollapsed ? "&#9662;" : "&#9652;"}
          </button>
        </div>
        ${projectOverallProgressHtml(project)}
        ${isCollapsed || !showStatusDonut ? "" : projectStatusDonutHtml(project)}
        ${isCollapsed ? "" : projectStatusMetricsHtml(project, statusMetricOptions)}
        <div class="row project-members">${avatarsHtml(project.members, { fit: "auto" })}</div>
        <div class="toolbar reveal-actions project-actions">
          ${iconButton("delete-project", project.id, "Delete", "delete", canAccessResource("Projects", "Delete"), "danger")}
          ${iconButton("view-project-gantt", project.id, "Gantt", "gantt", true)}
          ${iconButton("edit-project", project.id, "Edit", "edit", canAccessResource("Projects", "Update"))}
        </div>
      </article>
    `;
  }

  function projectStatusDonutHtml(project) {
    const workItems = projectWorkItems(project.id);
    const rows = projectStatusCounts(project);
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
      <div class="project-status-mix" title="">
        <div class="project-status-mix-head">
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
    let saveAsNewMode = false;
    openEditor(project.id ? "Edit Project" : "New Project", `
      <div class="form-grid">
        ${field("Code", "code", project.code || "", "text", "", "", 5, { required: true })}
        ${field("Title", "title", project.title || "", "text", "", "", 30, { required: true })}
        ${field("Start", "startDate", toDateInput(project.startDate), "date")}
        ${field("End", "endDate", toDateInput(project.endDate), "date")}
        ${field("URL", "url", project.url || "", "url")}
        ${field("Icon URL", "iconUrl", project.iconUrl || "", "text")}
        <div class="field full"><label>Upload Icon</label><input name="iconFile" type="file" accept="image/*"></div>
        <div class="field full"><label>Description</label><textarea name="description" maxlength="100">${escapeHtml(project.description || "")}</textarea></div>
        ${checkList("Members", "memberIds", state.users, project.memberIds || [], item => item.nickname, { className: "scroll-check-list user-card-check-list", renderItem: userCardCheckListLabelHtml, required: !project.id })}
      </div>
    `, async root => {
      const isUpdate = Boolean(project.id && !saveAsNewMode);
      const code = value(root, "code");
      const title = value(root, "title");
      const description = value(root, "description");
      const memberIds = checkedNumbers(root, "memberIds");

      if (!isUpdate) {
        if (!code.trim()) {
          root.querySelector("[name='code']")?.focus();
          throw new Error("Project code is required.");
        }
        if (code.length > 5) {
          root.querySelector("[name='code']")?.focus();
          throw new Error("Project code cannot exceed 5 characters.");
        }
        if (!title.trim()) {
          root.querySelector("[name='title']")?.focus();
          throw new Error("Project title is required.");
        }
        if (title.length > 30) {
          root.querySelector("[name='title']")?.focus();
          throw new Error("Project title cannot exceed 30 characters.");
        }
        if (!memberIds.length) {
          root.querySelector("[name='memberIds']")?.focus();
          throw new Error("Select at least one Project member.");
        }
      }

      if (isUpdate && code.length > 5) {
        root.querySelector("[name='code']")?.focus();
        throw new Error("Project code cannot exceed 5 characters.");
      }
      if (isUpdate && title.length > 30) {
        root.querySelector("[name='title']")?.focus();
        throw new Error("Project title cannot exceed 30 characters.");
      }
      if (description.length > 100) {
        root.querySelector("[name='description']")?.focus();
        throw new Error("Project description cannot exceed 100 characters.");
      }

      const iconFile = root.querySelector("[name='iconFile']").files[0];
      let iconUrl = value(root, "iconUrl");
      if (iconFile) iconUrl = (await uploadFile("projects", iconFile)).url;

      const path = isUpdate ? `/api/projects/${project.id}` : "/api/projects";
      const method = isUpdate ? "PUT" : "POST";
      const payload = {
        id: isUpdate ? project.id : 0,
        code,
        title,
        description,
        url: value(root, "url"),
        iconUrl,
        startDate: nullableDateValue(root, "startDate"),
        endDate: nullableDateValue(root, "endDate"),
        memberIds,
        expectedRowVersion: isUpdate ? project.rowVersion || null : undefined
      };

      await saveProjectWithArchivedCodeOverride({
        saveJson,
        path,
        method,
        payload,
        isAdmin: Boolean(currentUser().isAdmin),
        saveOptions: {
          saveAsNew: true,
          canCreate: canAccessResource("Projects", "Create"),
          prepareSaveAsNew: () => {
            saveAsNewMode = true;
            const titleElement = root.closest("dialog")?.querySelector("#dialogTitle");
            if (titleElement) titleElement.textContent = "New Project";
            const codeInput = root.querySelector("[name='code']");
            if (codeInput) {
              codeInput.value = "";
              codeInput.focus({ preventScroll: true });
            }
          },
          saveAsNewPreparedMessage: "Enter a new Project Code, then save the project as a new item."
        }
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
    openCreate: () => editProject(),
    render: renderProjects
  };
}
