import { avatarsHtml } from "../../components/avatars.js";
import { buttonContent, iconButton } from "../../components/buttons.js";
import {
  checkList,
  checkedNumbers,
  field,
  nullableDateValue,
  value
} from "../../components/forms.js?v=20260620-member-roles";
import {
  projectOverallProgressHtml,
  projectStatusMetricsHtml
} from "../../components/progress-and-status.js?v=20260620-ui-theme";
import { sectionHead } from "../../components/sections.js";
import { state } from "../../core/store.js";
import { toDateInput } from "../../shared/dates.js?v=20260620-null-end-date";
import { canEditOwner } from "../../shared/permissions.js";
import { projectById } from "../../shared/selectors.js";
import {
  escapeAttr,
  escapeHtml
} from "../../shared/text-and-links.js";

const memberAvatarCacheVersion = "20260627-steve-avatar";
const seededMemberAvatarPaths = new Set([
  "/assets/avatar-sin.png",
  "/assets/avatar-bill-gates.png",
  "/assets/avatar-sam-altman.png",
  "/assets/avatar-mark-zuckerberg.png",
  "/assets/avatar-steve-jobs.png",
  "/assets/avatar-jensen-huang.png"
]);
const legacyMemberAvatarPaths = new Map([
  ["/assets/avatar-bill-gates.jpg", "/assets/avatar-bill-gates.png"],
  ["/assets/avatar-sam-altman.jpg", "/assets/avatar-sam-altman.png"],
  ["/assets/avatar-mark-zuckerberg.jpg", "/assets/avatar-mark-zuckerberg.png"],
  ["/assets/avatar-steve-jobs.jpg", "/assets/avatar-steve-jobs.png"],
  ["/assets/avatar-lisa-su.jpg", "/assets/avatar-jensen-huang.png"]
]);

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
            <img class="project-icon" src="${escapeAttr(projectIconUrl(project))}" alt="">
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

  function projectIconUrl(project) {
    const iconUrl = project.iconUrl || "/assets/project-pmt.svg";
    const assetPath = iconUrl.split("?")[0];

    if (project.code === "LMS" && assetPath === "/assets/project-lms.svg") {
      return "/assets/project-lms.svg?v=20260621-new-logo";
    }
    if (project.code === "HLS" && assetPath === "/assets/project-hls.svg") {
      return "/assets/project-hls.svg?v=20260621-new-logo";
    }
    if (project.code === "PMT" && assetPath === "/assets/project-pmt.svg") {
      return "/assets/project-pmt.svg?v=20260621-transparent";
    }

    return iconUrl;
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
        ${field("Code", "code", project.code || "", "text", "", "", 5)}
        ${field("Title", "title", project.title || "", "text", "", "", 30)}
        ${field("Start", "startDate", toDateInput(project.startDate), "date")}
        ${field("End", "endDate", toDateInput(project.endDate), "date")}
        ${field("URL", "url", project.url || "", "url")}
        ${field("Icon URL", "iconUrl", project.iconUrl || "", "text")}
        <div class="field full"><label>Upload Icon</label><input name="iconFile" type="file" accept="image/*"></div>
        <div class="field full"><label>Description</label><textarea name="description" maxlength="100">${escapeHtml(project.description || "")}</textarea></div>
        ${checkList("Members", "memberIds", state.users, project.memberIds || [], item => item.nickname, { className: "scroll-check-list project-member-check-list", renderItem: projectMemberLabelHtml })}
      </div>
    `, async root => {
      const code = value(root, "code");
      const title = value(root, "title");
      const description = value(root, "description");
      const memberIds = checkedNumbers(root, "memberIds");

      if (!project.id) {
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

      if (project.id && code.length > 5) {
        root.querySelector("[name='code']")?.focus();
        throw new Error("Project code cannot exceed 5 characters.");
      }
      if (project.id && title.length > 30) {
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

      await saveJson(project.id ? `/api/projects/${project.id}` : "/api/projects", project.id ? "PUT" : "POST", {
        id: project.id || 0,
        code,
        title,
        description,
        url: value(root, "url"),
        iconUrl,
        startDate: nullableDateValue(root, "startDate"),
        endDate: nullableDateValue(root, "endDate"),
        memberIds
      });
    }, "code");
  }

  function projectMemberLabelHtml(user) {
    return `
      <span class="project-member-option">
        <img class="project-member-avatar" src="${escapeAttr(projectMemberAvatarUrl(user))}" alt="${escapeAttr(projectMemberDisplayName(user))} avatar">
        <span class="project-member-summary">
          <span class="project-member-name">${projectMemberNameHtml(user)}</span>
          <span class="project-member-title muted">${escapeHtml(userTitle(user))}</span>
          <span class="project-member-email">${escapeHtml(user.email || "")}</span>
        </span>
      </span>
    `;
  }

  function projectMemberAvatarUrl(user) {
    const avatarUrl = (user.avatarUrl || "/assets/avatar-default.svg").trim();
    const [pathPart, queryString = ""] = avatarUrl.split("?", 2);
    const avatarPath = legacyMemberAvatarPaths.get(pathPart.toLowerCase()) || pathPart;
    if (!seededMemberAvatarPaths.has(avatarPath.toLowerCase())) return avatarUrl;

    const params = new URLSearchParams(queryString);
    params.set("v", memberAvatarCacheVersion);
    return `${avatarPath}?${params.toString()}`;
  }

  function projectMemberDisplayName(user) {
    return [user.firstName, user.lastName]
      .map(part => (part || "").trim())
      .filter(Boolean)
      .join(" ") || user.nickname || "User";
  }

  function projectMemberNameHtml(user) {
    const fullName = projectMemberDisplayName(user);
    const nickname = (user.nickname || "").trim();
    const showNickname = nickname && nickname.toLowerCase() !== fullName.toLowerCase();

    return `${escapeHtml(fullName)}${showNickname ? ` (${escapeHtml(nickname)})` : ""}`;
  }

  function userTitle(user) {
    return user.role || (user.isAdmin ? "Admin" : "Developer");
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
