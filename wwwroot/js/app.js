import { api } from "./core/api.js";
import { avatarsHtml, taskRowAvatarsHtml } from "./components/avatars.js";
import { buttonContent } from "./components/buttons.js";
import {
  askForText,
  askYesNo,
  initializeDialogLayoutPersistence,
  initializeDraggableDialogs,
  initializeWindowedDialog,
  resetDialogLayoutPreference,
  restoreDialogLayout,
  setDialogLayoutStorageKey
} from "./components/dialogs.js?v=20260706-dialog-persistence";
import {
  field,
  value
} from "./components/forms.js?v=20260629-avatar-jpg-assets";
import { configureProgressAndStatus } from "./components/progress-and-status.js?v=20260707-linked-bug-qa-sync";
import {
  bindAttachmentPreview,
  showTaskAudit,
  viewWorkItem
} from "./components/work-items.js?v=20260707-deep-links";
import { createApplicationShell } from "./core/application-shell.js?v=20260707-deep-links";
import {
  currentView,
  ensureCurrentViewRoute,
  navigate,
  parseRouteFromLocation,
  routeForContent,
  routeForView,
  updateBrowserUrl
} from "./core/router.js?v=20260707-deep-links";
import {
  registeredScreenHandlers,
  registerScreen,
  screenHandlerFor
} from "./core/screen-registry.js?v=20260707-log-about-nav";
import { state } from "./core/store.js";
import { createAboutFeature } from "./features/about/about.js?v=20260621-about-credits";
import { createBacklogFeature } from "./features/backlog/backlog.js?v=20260707-deep-links";
import { createBoardFeature } from "./features/board/board.js?v=20260707-deep-links";
import { createBugsFeature } from "./features/bugs/bugs.js?v=20260707-deep-links";
import { createDashboardFeature } from "./features/dashboard/dashboard.js?v=20260707-linked-bug-qa-sync";
import { createDocumentationFeature } from "./features/documentation/documentation.js?v=20260707-documentation-tree-project";
import {
  createGanttFeature,
  currentSprintForProject,
  ganttStartDate
} from "./features/gantt/gantt.js?v=20260707-deep-links";
import { createProjectsFeature } from "./features/projects/projects.js?v=20260707-linked-bug-qa-sync";
import { createRoadMapFeature } from "./features/roadmap/roadmap.js?v=20260707-linked-bug-qa-sync";
import { createLogFeature } from "./features/personal-log/log.js?v=20260707-deep-links";
import { createScrumFeature } from "./features/scrum/scrum.js?v=20260707-deep-links";
import { createSettingsFeature } from "./features/settings/settings.js?v=20260707-deep-links";
import { createSprintsFeature } from "./features/sprints/sprints.js?v=20260707-linked-bug-qa-sync";
import { createTasksFeature } from "./features/tasks/tasks.js?v=20260707-deep-links";
import { createWfhScheduleFeature } from "./features/wfh-schedule/wfh-schedule.js?v=20260707-deep-links";
import {
  fallbackEnvironments,
  fallbackForLookup,
  fallbackPriorities,
  fallbackSeverities,
  fallbackStatuses
} from "./shared/constants.js";
import { formatDate } from "./shared/dates.js";
import { canEditTask } from "./shared/permissions.js";
import {
  projectCode,
  projectName,
  sprintById,
  sprintName,
  taskById
} from "./shared/selectors.js";
import {
  escapeAttr,
  escapeHtml,
  linkifyTextNodes,
  normalizeLinksInElement,
  normalizeUrl
} from "./shared/text-and-links.js?v=20260627-rich-text-toolbar";
import {
  configureWorkItemRules,
  isBugQaPassedOrLater,
  percentForStatus,
  sprintOverallPercent,
  taskOrderCompare
} from "./shared/work-item-rules.js?v=20260707-linked-bug-qa-sync";

const nativePickerSelector = [
  "select",
  'input[type="date"]',
  'input[type="datetime-local"]',
  'input[type="month"]',
  'input[type="time"]',
  'input[type="week"]'
].join(",");

initializeDraggableDialogs();

const richTextFormats = {
  title: { tag: "H1", className: "rich-title" },
  h1: { tag: "H1", className: "" },
  h2: { tag: "H2", className: "" },
  h3: { tag: "H3", className: "" },
  body: { tag: "P", className: "" }
};

function syncNativePickerTheme(control) {
  if (!(control instanceof HTMLElement)) return;
  const theme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
  control.style.colorScheme = theme;
  if (control instanceof HTMLSelectElement) {
    Array.from(control.options).forEach(option => {
      option.style.colorScheme = theme;
    });
  }
}

function syncNativePickers(root = document) {
  if (root.matches?.(nativePickerSelector)) syncNativePickerTheme(root);
  root.querySelectorAll?.(nativePickerSelector).forEach(syncNativePickerTheme);
}

new MutationObserver(records => {
  records.forEach(record => {
    record.addedNodes.forEach(node => {
      if (node instanceof HTMLElement) syncNativePickers(node);
    });
  });
}).observe(document.documentElement, { childList: true, subtree: true });

document.addEventListener("pointerdown", event => {
  const control = event.target.closest?.(nativePickerSelector);
  if (control) syncNativePickerTheme(control);
}, true);

document.addEventListener("focusin", event => {
  const control = event.target.closest?.(nativePickerSelector);
  if (control) syncNativePickerTheme(control);
});

syncNativePickers();
let statuses = [...fallbackStatuses];
let priorities = [...fallbackPriorities];
let severities = [...fallbackSeverities];
let environments = [...fallbackEnvironments];
let pointerDrag = null;
let lastPointerDragEventAt = 0;
let suppressNextClick = false;
let pageEventsBound = false;
let chartTooltip = null;
let boardFeature = null;
let handlingBrowserRouteChange = false;
let lastOpenedContentRouteKey = "";
// let openCreateSprintOnRender = false;

const workItemRuleOptions = {
  getStatuses: () => statuses,
  getTasks: () => state.tasks
};

configureWorkItemRules(workItemRuleOptions);
configureProgressAndStatus({
  getStatuses: () => statuses,
  getLookups: () => state.lookups,
  getTasks: () => state.tasks
});

const shell = createApplicationShell({
  bindScreenEvents,
  editPassword,
  // prepareRender,
  refreshLookupOptions,
  renderCurrentScreen,
  // resolveNavigationView,
  showToast
});

const {
  app,
  dialog,
  dialogTitle,
  dialogBody,
  editorForm,
  toast
} = shell.elements;
const editorDialogSecondaryActions = document.getElementById("editorDialogSecondaryActions");
const resetDialogButton = document.getElementById("resetDialog");
const maximizeDialogButton = document.getElementById("maximizeDialog");

const roadMapFeature = createRoadMapFeature({ app });
const aboutFeature = createAboutFeature({ app });
const ganttFeature = createGanttFeature({
  app,
  openTaskReadMode: id => {
    const task = taskById(id);
    if (!task) return;
    updateBrowserUrl(workItemContentRoute(id));
    lastOpenedContentRouteKey = contentRouteKey(parseRouteFromLocation());
    viewWorkItem(task, editWorkItem, workItemDialogOptions());
  },
  render,
  showToast
});
boardFeature = createBoardFeature({
  app,
  getStatuses: () => statuses,
  loadState,
  render,
  saveJson,
  showToast
});
const projectsFeature = createProjectsFeature({
  app,
  deleteItem,
  openEditor,
  openProjectGantt: viewProjectGantt,
  openSprintsForProject: viewProjectSprints,
  render,
  saveJson,
  uploadFile
});
const sprintsFeature = createSprintsFeature({
  app,
  deleteItem,
  loadState,
  openEditor,
  openSprintTasks: viewSprintTasks,
  render,
  saveJson,
  showToast
});
const settingsFeature = createSettingsFeature({
  app,
  deleteItem,
  loadState,
  openEditor,
  render,
  saveJson,
  showToast,
  uploadFile
});
const tasksFeature = createTasksFeature({
  app,
  attachFile,
  deleteItem,
  duplicateTask,
  getBoardProjectId: boardFeature.getProjectId,
  getBoardSprintId: boardFeature.getSprintId,
  getCurrentSprint: currentSprintForProject,
  getItemStartDate: ganttStartDate,
  getLookupOptions: lookupOptionsWithCurrent,
  getPriorities: () => priorities,
  getStatuses: () => statuses,
  openEditor,
  refreshAfterImport,
  saveJson
});
const bugsFeature = createBugsFeature({
  app,
  attachFile,
  deleteItem,
  duplicateTask,
  getBoardProjectId: boardFeature.getProjectId,
  getBoardSprintId: boardFeature.getSprintId,
  getCurrentSprint: currentSprintForProject,
  getEnvironments: () => environments,
  getItemStartDate: ganttStartDate,
  getLookupOptions: lookupOptionsWithCurrent,
  getPriorities: () => priorities,
  getSeverities: () => severities,
  getStatuses: () => statuses,
  getTaskContext: tasksFeature.getContext,
  openEditor,
  refreshAfterImport,
  saveJson
});
const backlogFeature = createBacklogFeature({
  app,
  deleteItem,
  duplicateTask: duplicateBacklogTask,
  editBug: bug => bugsFeature.edit(bug || {}, { apiRoot: "/api/backlog/tasks" }),
  editTask: task => tasksFeature.edit(task || {}, { apiRoot: "/api/backlog/tasks" }),
  getPriorities: () => priorities,
  getStatuses: () => statuses,
  refreshAfterImport,
  saveJson,
  viewTask: viewBacklogWorkItem
});
const dashboardFeature = createDashboardFeature({
  app,
  isProjectCollapsed: projectsFeature.isCollapsed,
  openSprintTasks: viewSprintTasks,
  openTaskReadMode,
  projectCardHtml: projectsFeature.cardHtml
});
const scrumFeature = createScrumFeature({
  app,
  deleteItem,
  loadState,
  openEditor,
  render,
  saveJson,
  showReadOnlyDialog,
  showToast
});
const logFeature = createLogFeature({
  app,
  deleteItem,
  loadState,
  openEditor,
  render,
  saveJson,
  showReadOnlyDialog,
  showToast
});
const documentationFeature = createDocumentationFeature({
  app,
  attachFile,
  bindAttachmentPreview,
  bindRichTextButtons,
  deleteItem,
  loadState,
  openEditor,
  render,
  saveJson,
  showToast
});
const wfhScheduleFeature = createWfhScheduleFeature({
  app,
  render,
  showToast
});

registerScreen("Dashboard", dashboardFeature);
registerScreen("About", aboutFeature);
registerScreen("Road Map", roadMapFeature);
registerScreen("Gantt", ganttFeature);
registerScreen("Board", boardFeature);
registerScreen("Projects", projectsFeature);
registerScreen("Sprints", sprintsFeature);
registerScreen("Settings", settingsFeature);
registerScreen("Tasks", tasksFeature);
registerScreen("Bugs", bugsFeature);
registerScreen("Backlog", backlogFeature);
registerScreen("Scrum", scrumFeature);
registerScreen("Log", logFeature);
registerScreen("Documentation", documentationFeature);
registerScreen("WFH Schedule", wfhScheduleFeature);

document.getElementById("closeDialog").addEventListener("click", () => dialog.close());
document.getElementById("cancelDialog").addEventListener("click", () => dialog.close());
initializeDialogLayoutPersistence(dialog);
resetDialogButton?.addEventListener("click", resetEditorDialogLayout);
maximizeDialogButton?.addEventListener("click", toggleEditorDialogMaximized);
dialog.addEventListener("close", resetEditorDialogWindow);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", shell.initialize);
} else {
  shell.initialize();
}

function bindScreenEvents() {
  if (pageEventsBound) return;
  pageEventsBound = true;

  app.addEventListener("click", handleActionClick);
  app.addEventListener("change", handleFilterChange);
  app.addEventListener("mousemove", handleChartTooltip);
  app.addEventListener("mouseleave", hideChartTooltip);
  app.addEventListener("wheel", handleVisualChartWheel, { passive: false });
  app.addEventListener("pointerdown", handlePointerDown);
  app.addEventListener("mousedown", handleMouseDown);
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("pointerup", handlePointerUp);
  window.addEventListener("mouseup", handleMouseUp);
  window.addEventListener("pointercancel", cancelPointerDrag);
  window.addEventListener("popstate", handleBrowserRouteChange);
  window.addEventListener("hashchange", handleBrowserRouteChange);
  document.addEventListener("pointerdown", handlePageActionsOutsidePointer);
  document.addEventListener("close", handleDeepLinkDialogClose, true);
  document.addEventListener("click", handleRichTextImageClick, true);
  document.addEventListener("click", handleDocumentLinkClick);
}

async function loadState() {
  return shell.reloadState();
}

function render() {
  shell.render();
}

function handlePageActionsOutsidePointer(event) {
  const openMenus = document.querySelectorAll(".page-actions-menu[open]");
  if (!openMenus.length) return;

  const activeMenu = event.target.closest?.(".page-actions-menu");
  openMenus.forEach(menu => {
    if (menu !== activeMenu) menu.removeAttribute("open");
  });
}

function handleBrowserRouteChange() {
  if (handlingBrowserRouteChange) return;

  handlingBrowserRouteChange = true;
  requestAnimationFrame(() => {
    const route = parseRouteFromLocation();
    closeRoutedDetailDialogs();
    navigate(route.view || "Dashboard", { updateUrl: false });
    render();
    handlingBrowserRouteChange = false;
  });
}

function handleDeepLinkDialogClose(event) {
  if (handlingBrowserRouteChange) return;
  if (!isRoutedDialog(event.target)) return;

  requestAnimationFrame(() => {
    const route = parseRouteFromLocation();
    if (!route.contentType) return;
    if (document.querySelector(routedOpenDialogSelector())) return;

    lastOpenedContentRouteKey = "";
    updateBrowserUrl(routeForView(currentView), { replace: true });
  });
}

function openCurrentRouteContent() {
  const route = parseRouteFromLocation();
  const routeKey = contentRouteKey(route);
  if (!routeKey) {
    lastOpenedContentRouteKey = "";
    return;
  }

  if (dialog.open) return;

  if (routeKey === lastOpenedContentRouteKey && document.querySelector(routedOpenDialogSelector())) return;

  closeRoutedDetailDialogs();
  if (openRouteContent(route)) {
    lastOpenedContentRouteKey = routeKey;
    return;
  }

  lastOpenedContentRouteKey = "";
  showToast("Shared item was not found or you do not have access.");
  updateBrowserUrl(routeForView(currentView), { replace: true });
}

function openRouteContent(route) {
  const id = Number(route.id || 0);
  if (!id) return false;

  if (route.contentType === "tasks") return openWorkItemRoute(id, "Dev");
  if (route.contentType === "bugs") return openWorkItemRoute(id, "Bug");
  if (route.contentType === "backlog") return openBacklogRoute(id);
  if (route.contentType === "documentation") return openDocumentationById(id, { showMissingToast: false, updateUrl: false });
  if (route.contentType === "log") return logFeature.view?.(id) === true;
  if (route.contentType === "scrum") return scrumFeature.view?.(id) === true;

  return false;
}

function openWorkItemRoute(id, taskType) {
  const task = taskById(id);
  if (!task) return false;
  if (taskType === "Bug" && task.taskType !== "Bug") return false;
  if (taskType === "Dev" && task.taskType === "Bug") return false;

  viewWorkItem(task, editWorkItem, workItemDialogOptions());
  return true;
}

function openBacklogRoute(id) {
  const task = taskById(id);
  if (!task) return false;

  viewBacklogWorkItem(task);
  return true;
}

function contentRouteKey(route) {
  return route?.contentType && route.id ? `${route.contentType}:${route.id}` : "";
}

function routedDialogSelector() {
  return "dialog.detail-dialog, dialog.documentation-readonly-dialog";
}

function routedOpenDialogSelector() {
  return "dialog.detail-dialog[open], dialog.documentation-readonly-dialog[open], #editorDialog[open]";
}

function isRoutedDialog(target) {
  return target instanceof HTMLDialogElement
    && (target === dialog || target.classList.contains("detail-dialog") || target.classList.contains("documentation-readonly-dialog"));
}

function closeRoutedDetailDialogs() {
  document.querySelectorAll(routedDialogSelector()).forEach(modal => {
    if (modal.open) modal.close();
    modal.remove();
  });
}

/*
function prepareRender() {
  if (!state.projects.length) navigate("Projects");
}

function resolveNavigationView(view) {
  openCreateSprintOnRender = state.projects.length > 0
    && !state.sprints.length
    && (view === "Tasks" || view === "Bugs");

  return openCreateSprintOnRender ? "Sprints" : view;
}
*/

function renderCurrentScreen() {
  ensureCurrentViewRoute();

  if (currentView !== "Board") boardFeature.deactivate();
  if (currentView !== "Gantt") ganttFeature.deactivate();
  if (currentView !== "Tasks") tasksFeature.deactivate();
  if (currentView !== "Bugs") bugsFeature.deactivate();
  if (currentView !== "Backlog") backlogFeature.deactivate();
  if (currentView !== "Scrum") scrumFeature.deactivate();
  if (currentView !== "Log") logFeature.deactivate();

  const registeredScreen = screenHandlerFor(currentView);
  if (registeredScreen?.render) registeredScreen.render();
  /*
  if (!state.projects.length && currentView === "Projects" && !dialog.open) {
    projectsFeature.openCreate();
  } else if (openCreateSprintOnRender && currentView === "Sprints" && !dialog.open) {
    openCreateSprintOnRender = false;
    sprintsFeature.openCreate();
  }
  */
  linkifyTextNodes(app);
  normalizeLinksInElement(app);
  openCurrentRouteContent();
}

async function handleActionClick(event) {
  if (suppressNextClick) {
    suppressNextClick = false;
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  if (event.target.closest("[data-drag-handle]")) return;
  if (event.target.closest("a")) return;

  const button = event.target.closest("[data-action]");
  if (!button) return;
  if (button.matches("tr[data-action]") && event.target.closest("button, input, label, select, textarea")) return;
  button.closest(".page-actions-menu")?.removeAttribute("open");

  const id = Number(button.dataset.id || 0);
  const action = button.dataset.action;

  if (handleChartAction(button)) return;

  updateContentUrlForAction(action, id);

  for (const screen of registeredScreenHandlers()) {
    if (screen.handleAction && await screen.handleAction(action, id, button)) return;
  }

  if (action === "goto-task") gotoTask(id);
  if (action === "gantt-open-task") openTaskReadMode(id);
  if (action === "view-project-gantt") viewProjectGantt(id);
}

function updateContentUrlForAction(action, id) {
  const route = contentRouteForAction(action, id);
  if (!route) return;

  updateBrowserUrl(route);
  lastOpenedContentRouteKey = contentRouteKey(parseRouteFromLocation());
}

function contentRouteForAction(action, id) {
  if (!id) return "";

  if (action === "view-blog" || action === "select-documentation-tree-blog") {
    return state.blogs.some(blog => blog.id === id) ? routeForContent("documentation", id) : "";
  }

  if (action === "view-personal-log") {
    return state.devLogs.some(log => log.id === id) ? routeForContent("log", id) : "";
  }

  if (action === "view-log") {
    return state.devLogs.some(log => log.id === id) ? routeForContent("scrum", id) : "";
  }

  if (action === "view-backlog-task") {
    return taskById(id) ? routeForContent("backlog", id) : "";
  }

  if (["view-task", "gantt-open-task", "dashboard-view-task"].includes(action)) {
    return workItemContentRoute(id);
  }

  return "";
}

function workItemContentRoute(id) {
  const task = taskById(id);
  if (!task) return "";
  return routeForContent(task.taskType === "Bug" ? "bugs" : "tasks", id);
}

function handleChartAction(element) {
  const action = element.dataset.action;
  if (action === "expand-visual-chart") {
    expandVisualChartCard(element.closest(".visual-chart-card"));
    return true;
  }

  if (action === "chart-open-sprint") {
    viewSprintSummary(sprintById(Number(element.dataset.id || 0)));
    return true;
  }

  if (action === "chart-drill-bugs") {
    const bugIds = splitChartIds(element.dataset.ids);
    showBugChartDrilldown(element.dataset.chartTitle || "Bugs", bugIds);
    return true;
  }

  if (action === "chart-drill-tasks") {
    const taskIds = splitChartIds(element.dataset.ids);
    showTaskChartDrilldown(element.dataset.chartTitle || "Dev Tasks", taskIds);
    return true;
  }

  if (action === "chart-drill-work-items") {
    const workItemIds = splitChartIds(element.dataset.ids);
    showWorkItemChartDrilldown(element.dataset.chartTitle || "Work Items", workItemIds);
    return true;
  }

  if (action === "view-task") {
    updateContentUrlForAction(action, Number(element.dataset.id || 0));
    viewWorkItem(taskById(Number(element.dataset.id || 0)), editWorkItem, workItemDialogOptions());
    return true;
  }

  return false;
}

function splitChartIds(value) {
  return String(value || "")
    .split(",")
    .map(id => Number(id))
    .filter(id => id > 0);
}

function closeTransientDialog(modal) {
  if (!modal) return;
  hideChartTooltip();
  if (modal.open) modal.close();
  modal.remove();
}

function showBugChartDrilldown(title, bugIds) {
  const bugs = bugIds
    .map(id => taskById(id))
    .filter(Boolean)
    .sort(taskOrderCompare);

  const modal = document.createElement("dialog");
  modal.className = "dialog detail-dialog chart-drill-dialog";
  modal.innerHTML = `
    <div class="dialog-head">
      <h2>${escapeHtml(title)} Bugs</h2>
      <button type="button" class="icon-btn" data-close title="Close">x</button>
    </div>
    <div class="dialog-body">
      ${bugs.length ? `
        <table class="table chart-drill-table">
          <thead>
            <tr>
              <th>Bug Report</th>
              <th>Project</th>
              <th>Sprint</th>
              <th>Status</th>
              <th>Severity</th>
              <th>Assignee</th>
            </tr>
          </thead>
          <tbody>
            ${bugs.map(bug => `
              <tr class="clickable-row" data-action="view-task" data-id="${bug.id}">
                <td><b>${escapeHtml(bug.code)}</b><br><span>${escapeHtml(bug.title)}</span></td>
                <td>${escapeHtml(projectCode(bug.projectId))}</td>
                <td>${escapeHtml(sprintName(bug.sprintId))}</td>
                <td><span class="pill">${escapeHtml(bug.status)}</span></td>
                <td>${escapeHtml(bug.severity || "")}</td>
                <td>${avatarsHtml(bug.assignees)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : `<div class="empty compact-empty">No bugs were found for this chart segment.</div>`}
    </div>
    <div class="dialog-actions">
      <button type="button" class="primary text-icon-button" data-close>${buttonContent("&#10003;", "Close")}</button>
    </div>
  `;

  document.body.appendChild(modal);
  initializeWindowedDialog(modal);
  modal.addEventListener("click", event => {
    if (event.target.closest("[data-close]")) {
      closeTransientDialog(modal);
      return;
    }

    const actionElement = event.target.closest("[data-action]");
    if (!actionElement) return;

    // Keep the drilldown list open so the user can view more than one item.
    if (actionElement.dataset.action === "view-task") {
      handleChartAction(actionElement);
      return;
    }

    handleChartAction(actionElement);
  });
  modal.addEventListener("cancel", () => modal.remove());
  modal.showModal();
}

function showTaskChartDrilldown(title, taskIds) {
  const tasks = taskIds
    .map(id => taskById(id))
    .filter(Boolean)
    .sort(taskOrderCompare);

  const modal = document.createElement("dialog");
  modal.className = "dialog detail-dialog chart-drill-dialog";
  modal.innerHTML = `
    <div class="dialog-head">
      <h2>${escapeHtml(title)} Dev Tasks</h2>
      <button type="button" class="icon-btn" data-close title="Close">x</button>
    </div>
    <div class="dialog-body">
      ${tasks.length ? `
        <table class="table chart-drill-table">
          <thead>
            <tr>
              <th>Dev Task</th>
              <th>Project</th>
              <th>Sprint</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Assignee</th>
            </tr>
          </thead>
          <tbody>
            ${tasks.map(task => `
              <tr class="clickable-row" data-action="view-task" data-id="${task.id}">
                <td><b>${escapeHtml(task.code)}</b><br><span>${escapeHtml(task.title)}</span></td>
                <td>${escapeHtml(projectCode(task.projectId))}</td>
                <td>${escapeHtml(sprintName(task.sprintId))}</td>
                <td><span class="pill">${escapeHtml(task.status)}</span></td>
                <td><span class="pill priority-${escapeAttr(task.priority)}">${escapeHtml(task.priority)}</span></td>
                <td>${taskRowAvatarsHtml(task.assignees)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : `<div class="empty compact-empty">No Dev Tasks were found for this chart segment.</div>`}
    </div>
    <div class="dialog-actions">
      <button type="button" class="primary text-icon-button" data-close>${buttonContent("&#10003;", "Close")}</button>
    </div>
  `;

  document.body.appendChild(modal);
  initializeWindowedDialog(modal);
  modal.addEventListener("click", event => {
    if (event.target.closest("[data-close]")) {
      closeTransientDialog(modal);
      return;
    }

    const actionElement = event.target.closest("[data-action]");
    if (!actionElement) return;

    // Keep the drilldown list open so the user can view more than one item.
    if (actionElement.dataset.action === "view-task") {
      handleChartAction(actionElement);
      return;
    }

    handleChartAction(actionElement);
  });
  modal.addEventListener("cancel", () => modal.remove());
  modal.showModal();
}

function showWorkItemChartDrilldown(title, workItemIds) {
  const workItems = workItemIds
    .map(id => taskById(id))
    .filter(Boolean)
    .sort(taskOrderCompare);

  const modal = document.createElement("dialog");
  modal.className = "dialog detail-dialog chart-drill-dialog";
  modal.innerHTML = `
    <div class="dialog-head">
      <h2>${escapeHtml(title)} Work Items</h2>
      <button type="button" class="icon-btn" data-close title="Close">x</button>
    </div>
    <div class="dialog-body">
      ${workItems.length ? `
        <table class="table chart-drill-table">
          <thead>
            <tr>
              <th>Work Item</th>
              <th>Type</th>
              <th>Project</th>
              <th>Sprint</th>
              <th>Status</th>
              <th>Priority / Severity</th>
              <th>Assignee</th>
            </tr>
          </thead>
          <tbody>
            ${workItems.map(workItem => `
              <tr class="clickable-row" data-action="view-task" data-id="${workItem.id}">
                <td><b>${escapeHtml(workItem.code)}</b><br><span>${escapeHtml(workItem.title)}</span></td>
                <td>${escapeHtml(workItemTypeLabel(workItem))}</td>
                <td>${escapeHtml(projectCode(workItem.projectId))}</td>
                <td>${escapeHtml(sprintName(workItem.sprintId))}</td>
                <td><span class="pill">${escapeHtml(workItem.status)}</span></td>
                <td>${workItemPriorityOrSeverityHtml(workItem)}</td>
                <td>${taskRowAvatarsHtml(workItem.assignees)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : `<div class="empty compact-empty">No work items were found for this chart segment.</div>`}
    </div>
    <div class="dialog-actions">
      <button type="button" class="primary text-icon-button" data-close>${buttonContent("&#10003;", "Close")}</button>
    </div>
  `;

  document.body.appendChild(modal);
  initializeWindowedDialog(modal);
  modal.addEventListener("click", event => {
    if (event.target.closest("[data-close]")) {
      closeTransientDialog(modal);
      return;
    }

    const actionElement = event.target.closest("[data-action]");
    if (!actionElement) return;

    if (actionElement.dataset.action === "view-task") {
      handleChartAction(actionElement);
      return;
    }

    handleChartAction(actionElement);
  });
  modal.addEventListener("cancel", () => modal.remove());
  modal.showModal();
}

function workItemTypeLabel(workItem) {
  return workItem.taskType === "Bug" ? "Bug" : "Dev Task";
}

function workItemPriorityOrSeverityHtml(workItem) {
  if (workItem.taskType === "Bug" && workItem.severity) {
    return `<span class="pill severity-${escapeAttr(workItem.severity)}">${escapeHtml(workItem.severity)}</span>`;
  }

  if (workItem.priority) {
    return `<span class="pill priority-${escapeAttr(workItem.priority)}">${escapeHtml(workItem.priority)}</span>`;
  }

  return `<span class="muted">None</span>`;
}

function expandVisualChartCard(card) {
  if (!card) return;

  const title = card.querySelector(".chart-card-head h2")?.textContent || "Chart";
  const chartCopy = card.cloneNode(true);
  chartCopy.classList.add("chart-expanded-card");
  chartCopy.querySelector("[data-action='expand-visual-chart']")?.remove();

  const modal = document.createElement("dialog");
  modal.className = "dialog chart-expanded-dialog";
  if (card.classList.contains("task-sprint-chart-card")) {
    modal.classList.add("task-sprint-chart-dialog");
  }
  modal.innerHTML = `
    <div class="dialog-head">
      <h2>${escapeHtml(title)}</h2>
      <button type="button" class="icon-btn" data-close title="Close">x</button>
    </div>
    <div class="dialog-body chart-expanded-body"></div>
    <div class="dialog-actions">
      <button type="button" class="primary text-icon-button" data-close>${buttonContent("&#10003;", "Close")}</button>
    </div>
  `;

  const expandedBody = modal.querySelector(".chart-expanded-body");
  if (card.classList.contains("task-sprint-chart-card")) {
    expandedBody.classList.add("tasks-chart-panel");
  }
  expandedBody.appendChild(chartCopy);
  document.body.appendChild(modal);
  initializeWindowedDialog(modal);
  modal.addEventListener("mousemove", handleChartTooltip);
  modal.addEventListener("mouseleave", hideChartTooltip);
  modal.addEventListener("click", event => {
    if (event.target.closest("[data-close]")) {
      closeTransientDialog(modal);
      return;
    }

    const actionElement = event.target.closest("[data-action]");
    if (actionElement) handleChartAction(actionElement);
  });
  modal.addEventListener("cancel", () => {
    hideChartTooltip();
    modal.remove();
  });
  modal.showModal();
}

function handleFilterChange(event) {
  const target = event.target;
  for (const screen of registeredScreenHandlers()) {
    if (screen.handleFilterChange && screen.handleFilterChange(target)) return;
  }
}

function handleChartTooltip(event) {
  const target = event.target.closest("[data-chart-tooltip]");
  if (!target) {
    hideChartTooltip();
    return;
  }

  if (!chartTooltip) {
    chartTooltip = document.createElement("div");
    chartTooltip.className = "chart-tooltip";
    document.body.appendChild(chartTooltip);
  }

  chartTooltip.textContent = target.dataset.chartTooltip || "";
  chartTooltip.hidden = false;

  // Keep the tooltip near the pointer but inside the viewport.
  const tooltipWidth = chartTooltip.offsetWidth || 180;
  const tooltipHeight = chartTooltip.offsetHeight || 36;
  const left = Math.min(window.innerWidth - tooltipWidth - 12, event.clientX + 14);
  const top = Math.min(window.innerHeight - tooltipHeight - 12, event.clientY + 14);
  chartTooltip.style.left = `${Math.max(12, left)}px`;
  chartTooltip.style.top = `${Math.max(12, top)}px`;
}

function handleVisualChartWheel(event) {
  const scrollArea = event.target.closest(".visual-chart-scroll, .column-chart-scroll");
  if (!scrollArea) return;
  if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

  const maxScrollLeft = scrollArea.scrollWidth - scrollArea.clientWidth;
  if (maxScrollLeft <= 0) return;

  event.preventDefault();
  scrollArea.scrollLeft += event.deltaY;
}

function hideChartTooltip() {
  if (chartTooltip) chartTooltip.hidden = true;
}

function handleDocumentLinkClick(event) {
  const link = event.target instanceof Element ? event.target.closest("a") : null;
  if (!link) return;

  const documentationLink = Number(link.dataset.documentationLink || 0);
  if (documentationLink) {
    event.preventDefault();
    openDocumentationById(documentationLink);
    return;
  }

  const workItemLink = Number(link.dataset.workItemLink || 0);
  if (workItemLink) {
    event.preventDefault();
    const task = taskById(workItemLink);
    if (task) {
      updateBrowserUrl(workItemContentRoute(workItemLink));
      lastOpenedContentRouteKey = contentRouteKey(parseRouteFromLocation());
      viewWorkItem(task, editWorkItem, workItemDialogOptions());
    } else {
      showToast("Work item was not found.");
    }
    return;
  }

  if (!link.hasAttribute("href")) return;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
}

function handleRichTextImageClick(event) {
  if (event.defaultPrevented || !(event.target instanceof Element)) return;

  const image = event.target.closest(".rich-editor img, .rich-readonly img, .log-content img, .scrum-content img");
  if (!image) return;

  const editor = image.closest(".rich-editor");
  const readonlyContent = image.closest(".rich-readonly, .log-content, .scrum-content");
  if (!editor && !readonlyContent) return;

  event.preventDefault();
  event.stopPropagation();

  if (editor) {
    showRichTextImageMenu(image);
    return;
  }

  openRichTextImageInNewTab(image);
}

function showRichTextImageMenu(image) {
  const modal = document.createElement("dialog");
  modal.className = "dialog mini-dialog rich-image-menu";
  modal.innerHTML = `
    <div class="dialog-head">
      <h2>Image</h2>
    </div>
    <div class="dialog-body">
      <div class="rich-image-menu-actions">
        <button type="button" class="secondary text-icon-button" data-rich-image-action="zoom">${buttonContent("&#128269;", "Zoom")}</button>
        <button type="button" class="secondary text-icon-button" data-rich-image-action="resize">${buttonContent("&#8596;", "Resize")}</button>
      </div>
    </div>
    <div class="dialog-actions">
      <button type="button" class="primary text-icon-button" data-rich-image-action="cancel">${buttonContent("&#10003;", "Done")}</button>
    </div>
  `;

  document.body.appendChild(modal);

  const finish = () => {
    if (modal.open) modal.close();
    modal.remove();
  };

  modal.addEventListener("click", event => {
    const actionButton = event.target.closest("[data-rich-image-action]");
    if (!actionButton) return;

    const action = actionButton.dataset.richImageAction;
    if (action === "zoom") {
      openRichTextImageInNewTab(image);
      finish();
      return;
    }

    if (action === "resize") {
      finish();
      requestAnimationFrame(() => showRichTextImageResizeDialog(image));
      return;
    }

    finish();
  });
  modal.addEventListener("cancel", event => {
    event.preventDefault();
    finish();
  });

  modal.showModal();
}

function showRichTextImageResizeDialog(image) {
  if (!image?.isConnected) return;

  const currentWidth = richTextImageDisplayWidth(image);
  const naturalWidth = richTextImageNaturalWidth(image, currentWidth);
  const currentScale = richTextImageScaleSelectValue(currentWidth, naturalWidth);
  const source = richTextImageSource(image);
  const modal = document.createElement("dialog");
  modal.className = "dialog mini-dialog rich-image-resize-dialog";
  modal.innerHTML = `
    <form method="dialog">
      <div class="dialog-head">
        <h2>Resize Image</h2>
      </div>
      <div class="dialog-body">
        <div class="field">
          <label>Width (px)</label>
          <input name="imageWidth" type="number" min="1" max="4000" step="1" value="${escapeAttr(currentWidth)}">
        </div>
        <div class="field rich-image-scale-field">
          <label>Scale</label>
          <select name="imageScale">
            ${richTextImageScaleOptionsHtml(currentScale)}
          </select>
        </div>
        ${source ? `<div class="rich-image-resize-preview"><img src="${escapeAttr(source)}" alt=""></div>` : ""}
      </div>
      <div class="dialog-actions">
        <button type="button" class="secondary text-icon-button" data-rich-image-resize-reset>${buttonContent("&#8634;", "Full Width")}</button>
        <button type="button" class="secondary text-icon-button" data-rich-image-resize-cancel>${buttonContent("&#10005;", "Cancel")}</button>
        <button type="submit" class="primary text-icon-button">${buttonContent("&#10003;", "Apply")}</button>
      </div>
    </form>
  `;

  document.body.appendChild(modal);

  const widthInput = modal.querySelector("[name='imageWidth']");
  const scaleInput = modal.querySelector("[name='imageScale']");
  const finish = () => {
    if (modal.open) modal.close();
    modal.remove();
  };

  scaleInput.addEventListener("change", () => {
    if (scaleInput.value === "custom") return;
    widthInput.value = String(richTextImageWidthForScale(scaleInput.value, naturalWidth));
  });
  widthInput.addEventListener("input", () => {
    scaleInput.value = "custom";
  });
  modal.querySelector("[data-rich-image-resize-reset]").addEventListener("click", () => {
    resetRichTextImageSize(image);
    finish();
  });
  modal.querySelector("[data-rich-image-resize-cancel]").addEventListener("click", finish);
  modal.querySelector("form").addEventListener("submit", event => {
    event.preventDefault();
    const width = richTextImageWidthValue(widthInput.value);
    if (width) applyRichTextImageWidth(image, width);
    finish();
  });
  modal.addEventListener("cancel", event => {
    event.preventDefault();
    finish();
  });

  modal.showModal();
  setTimeout(() => {
    widthInput?.focus();
    widthInput?.select();
  }, 0);
}

function richTextImageDisplayWidth(image) {
  const rectWidth = Math.round(image.getBoundingClientRect().width || 0);
  const attrWidth = richTextImageWidthValue(image.getAttribute("width"));
  const naturalWidth = Math.round(image.naturalWidth || 0);
  return rectWidth || attrWidth || naturalWidth || 640;
}

function richTextImageNaturalWidth(image, fallbackWidth = 640) {
  const naturalWidth = Math.round(image?.naturalWidth || 0);
  return naturalWidth || richTextImageWidthValue(image?.getAttribute("width")) || fallbackWidth || 640;
}

function richTextImageWidthForScale(scaleValue, naturalWidth) {
  const scale = Number(scaleValue || 100);
  return richTextImageWidthValue((naturalWidth * scale) / 100);
}

function richTextImageScaleSelectValue(width, naturalWidth) {
  if (!naturalWidth) return 100;

  const percent = Math.round((Number(width || 0) / naturalWidth) * 100);
  return percent >= 10 && percent <= 100 && percent % 10 === 0 ? percent : "custom";
}

function richTextImageScaleOptionsHtml(selectedValue) {
  const selected = String(selectedValue || "custom");
  const options = [{ value: "custom", label: "Custom" }];
  for (let percent = 10; percent <= 100; percent += 10) {
    options.push({ value: String(percent), label: `${percent}%` });
  }

  return options
    .map(option => `<option value="${escapeAttr(option.value)}" ${option.value === selected ? "selected" : ""}>${escapeHtml(option.label)}</option>`)
    .join("");
}

function richTextImageWidthValue(value) {
  const width = Math.round(Number.parseFloat(value));
  if (!Number.isFinite(width) || width <= 0) return 0;
  return Math.max(1, Math.min(4000, width));
}

function applyRichTextImageWidth(image, width) {
  if (!image?.isConnected) return;

  image.style.width = `${width}px`;
  image.style.height = "auto";
  image.setAttribute("width", String(width));
  image.removeAttribute("height");
  image.dataset.richImageResized = "true";
}

function resetRichTextImageSize(image) {
  if (!image?.isConnected) return;

  image.style.removeProperty("width");
  image.style.removeProperty("height");
  image.removeAttribute("width");
  image.removeAttribute("height");
  delete image.dataset.richImageResized;
}

function openRichTextImageInNewTab(image) {
  const source = richTextImageSource(image);
  if (!source) return;

  let targetUrl = source;
  try {
    targetUrl = new URL(source, window.location.href).href;
  } catch {
    targetUrl = source;
  }

  const opened = window.open(targetUrl, "_blank", "noopener,noreferrer");
  if (opened) opened.opener = null;
}

function richTextImageSource(image) {
  return image?.currentSrc || image?.getAttribute("src") || "";
}

function handlePointerDown(event) {
  lastPointerDragEventAt = Date.now();
  startTaskDrag(event, "pointer");
}

function handleMouseDown(event) {
  if (Date.now() - lastPointerDragEventAt < 500) return;
  startTaskDrag(event, "mouse");
}

function startTaskDrag(event, inputType) {
  if (event.button !== 0) return;

  const item = event.target.closest('tr[data-task-id][data-can-drag="true"]');
  const container = item?.closest('[data-reorder-list="tasks"], [data-reorder-list="bugs"], [data-reorder-list="backlog"]');
  if (!item || !container) return;

  if (event.target.closest("button, a, input, select, textarea")) return;

  pointerDrag = {
    taskId: Number(item.dataset.taskId || 0),
    source: item,
    startX: event.clientX,
    startY: event.clientY,
    started: false,
    inputType,
    pointerId: event.pointerId
  };

  // Keep the final pointerup tied to this card even when the user releases near the edge of the viewport.
  if (inputType === "pointer" && item.setPointerCapture && event.pointerId !== undefined) {
    try {
      item.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is a nice-to-have; the window mouseup fallback still finishes the drag.
    }
  }
}

function handlePointerMove(event) {
  lastPointerDragEventAt = Date.now();
  moveTaskDrag(event);
}

function handleMouseMove(event) {
  if (pointerDrag?.inputType === "pointer") return;
  moveTaskDrag(event);
}

function moveTaskDrag(event) {
  if (!pointerDrag) return;

  const movedEnough = Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY) > 5;
  if (!pointerDrag.started && !movedEnough) return;

  if (!pointerDrag.started) {
    pointerDrag.started = true;
    suppressNextClick = true;
    pointerDrag.source.classList.add("dragging");
  }

  event.preventDefault();
  updateDropIndicator(event.clientX, event.clientY, pointerDrag.taskId);
}

async function handlePointerUp(event) {
  lastPointerDragEventAt = Date.now();
  await finishTaskDrag(event);
}

async function handleMouseUp(event) {
  if (pointerDrag?.inputType === "pointer") return;
  await finishTaskDrag(event);
}

async function finishTaskDrag(event) {
  if (!pointerDrag) return;
  if (pointerDrag.finishing) return;
  pointerDrag.finishing = true;

  const drag = pointerDrag;
  if (!drag.started) {
    cancelPointerDrag();
    return;
  }

  event.preventDefault();
  suppressNextClick = true;

  const drop = pointerDropTarget(event.clientX, event.clientY, drag.taskId);
  const task = taskById(drag.taskId);
  const isBacklogReorder = drop?.container?.dataset?.reorderList === "backlog";
  if (!drop || !task || (!isBacklogReorder && !canEditTask(task))) {
    cancelPointerDrag();
    return;
  }

  const taskIds = taskIdsAfterDrop(drop.container, drag.taskId, drop.target, event.clientY);

  try {
    if (taskIds.length > 1) {
      await saveJson("/api/tasks/reorder", "POST", { taskIds });
    }

    if (drop.container.dataset.reorderList === "tasks") {
      tasksFeature.useCustomSort();
    }

    await loadState();
    render();
    showToast("Order saved.");
  } catch (error) {
    showToast(error.message);
  } finally {
    cancelPointerDrag();
  }
}

function pointerDropTarget(clientX, clientY, taskId) {
  const elements = document.elementsFromPoint(clientX, clientY);
  const container = elements
    .map(item => item.closest?.('[data-reorder-list="tasks"], [data-reorder-list="bugs"], [data-reorder-list="backlog"]'))
    .find(Boolean);

  if (!container) return null;

  const target = elements
    .map(item => item.closest?.("[data-task-id]"))
    .find(item => item && container.contains(item) && Number(item.dataset.taskId) !== taskId) || null;

  return { container, target };
}

function updateDropIndicator(clientX, clientY, taskId) {
  clearDropIndicators();

  const drop = pointerDropTarget(clientX, clientY, taskId);
  if (!drop) return;

  drop.container.classList.add("drop-target");

  if (drop.target) {
    drop.target.classList.add(dropPlacement(drop.target, clientY) === "after" ? "reorder-after" : "reorder-before");
    return;
  }

  const items = [...drop.container.querySelectorAll("[data-task-id]")]
    .filter(item => Number(item.dataset.taskId) !== taskId);
  items[items.length - 1]?.classList.add("reorder-after");
}

function dropPlacement(targetElement, clientY) {
  const targetRect = targetElement.getBoundingClientRect();
  return clientY > targetRect.top + (targetRect.height / 2) ? "after" : "before";
}

function taskIdsAfterDrop(container, draggedTaskId, targetElement, clientY) {
  const taskIds = [...container.querySelectorAll("[data-task-id]")]
    .map(item => Number(item.dataset.taskId))
    .filter(Boolean)
    .filter(id => id !== draggedTaskId);

  if (!targetElement) return [...taskIds, draggedTaskId];

  const targetTaskId = Number(targetElement.dataset.taskId);
  let insertIndex = taskIds.indexOf(targetTaskId);
  if (insertIndex < 0) return [...taskIds, draggedTaskId];

  const targetRect = targetElement.getBoundingClientRect();
  if (clientY > targetRect.top + (targetRect.height / 2)) insertIndex += 1;

  taskIds.splice(insertIndex, 0, draggedTaskId);
  return taskIds;
}

function cancelPointerDrag() {
  if (pointerDrag?.inputType === "pointer" && pointerDrag.source.releasePointerCapture && pointerDrag.pointerId !== undefined) {
    try {
      pointerDrag.source.releasePointerCapture(pointerDrag.pointerId);
    } catch {
      // The browser may have already released capture after pointerup/cancel.
    }
  }

  pointerDrag = null;
  clearDragStyles();
}

function clearDropIndicators() {
  document.querySelectorAll(".drop-target, .reorder-target, .reorder-before, .reorder-after")
    .forEach(item => item.classList.remove("drop-target", "reorder-target", "reorder-before", "reorder-after"));
}

function clearDragStyles() {
  document.querySelectorAll(".dragging")
    .forEach(item => item.classList.remove("dragging"));
  clearDropIndicators();
}

function viewSprintSummary(sprint) {
  if (!sprint) return;

  const tasks = state.tasks.filter(task => task.sprintId === sprint.id && task.taskType !== "Bug" && !task.parentTaskId);
  const bugs = state.tasks.filter(task => task.sprintId === sprint.id && task.taskType === "Bug");
  const resolvedBugs = bugs.filter(isBugQaPassedOrLater);
  const openBugs = bugs.filter(bug => !isBugQaPassedOrLater(bug));
  const bugLinks = bugs
    .sort(taskOrderCompare)
    .map(bug => `<button type="button" data-action="view-task-inline" data-id="${bug.id}">${escapeHtml(bug.code)} - ${escapeHtml(bug.title)}</button>`)
    .join("");

  showReadOnlyDialog(`Sprint ${sprint.code}`, `
    <div class="detail-grid">
      ${detailField("Title", escapeHtml(sprint.title))}
      ${detailField("Project", escapeHtml(projectName(sprint.projectId)))}
      ${detailField("Dates", escapeHtml(`${formatDate(sprint.startDate)} - ${formatDate(sprint.endDate)}`))}
      ${detailField("Overall Progress", `${sprintOverallPercent(sprint)}%`)}
      ${detailField("Dev Tasks", String(tasks.length))}
      ${detailField("Bugs", `${bugs.length} total, ${resolvedBugs.length} resolved, ${openBugs.length} open`)}
      ${bugs.length ? detailField("Bugs", `<div class="inline-link-list">${bugLinks}</div>`, true) : ""}
    </div>
  `);
}

function showReadOnlyDialog(title, html) {
  const modal = document.createElement("dialog");
  modal.className = "dialog detail-dialog";
  modal.innerHTML = `
    <div class="dialog-head">
      <h2>${escapeHtml(title)}</h2>
      <button type="button" class="icon-btn" data-close title="Close">x</button>
    </div>
    <div class="dialog-body">${html}</div>
    <div class="dialog-actions">
      <button type="button" class="primary text-icon-button" data-close>${buttonContent("&#10003;", "Close")}</button>
    </div>
  `;

  document.body.appendChild(modal);
  initializeWindowedDialog(modal);
  modal.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => {
    modal.close();
    modal.remove();
  }));
  modal.addEventListener("click", event => {
    const inlineButton = event.target.closest("[data-action='view-task-inline']");
    if (!inlineButton) return;
    const task = taskById(Number(inlineButton.dataset.id));
    updateWorkItemContentUrl(task);
    modal.close();
    modal.remove();
    viewWorkItem(task, editWorkItem, workItemDialogOptions());
  });
  modal.addEventListener("cancel", () => modal.remove());
  modal.showModal();
  normalizeLinksInElement(modal);
}

function detailField(label, html, full = false) {
  return `
    <div class="detail-field ${full ? "full" : ""}">
      <span>${escapeHtml(label)}</span>
      <div>${html || `<span class="muted">None</span>`}</div>
    </div>
  `;
}

function editPassword() {
  openEditor("Change Password", `
    <div class="form-grid">
      ${field("Current Password", "currentPassword", "", "password")}
      ${field("New Password", "newPassword", "", "password")}
    </div>
  `, async root => {
    await saveJson("/api/change-password", "POST", {
      currentPassword: value(root, "currentPassword"),
      newPassword: value(root, "newPassword")
    });
  });
}

function openEditor(title, html, saveAction, focusName = "", afterOpen = null) {
  resetEditorDialogWindow();
  dialogTitle.textContent = title;
  delete dialogBody.dataset.devTaskPercentRules;
  dialogBody.innerHTML = html;
  moveEditorFooterActions();
  if (afterOpen) afterOpen(dialogBody);
  bindRichTextButtons(dialogBody);
  bindTaskPercentRules(dialogBody);
  bindAttachmentPreview(dialogBody);
  bindAuditButtons(dialogBody);
  bindAuditButtons(editorDialogSecondaryActions);
  setDialogLayoutStorageKey(dialog, editorDialogLayoutKey(title));

  editorForm.onsubmit = async event => {
    event.preventDefault();
    try {
      await saveAction(dialogBody);
      dialog.close();
      await loadState();
      render();
      showToast("Saved.");
    } catch (error) {
      showToast(error.message);
    }
  };

  dialog.showModal();
  sizeEditorDialogFromDefault();
  dialogBody.scrollTop = 0;
  dialog.scrollTop = 0;

  // Start each dialog on the most useful field so users can type right away.
  setTimeout(() => focusEditorField(focusName), 0);
}

function sizeEditorDialogFromDefault() {
  const rect = dialog.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);

  dialog.style.setProperty("--editor-dialog-default-width", `${width}px`);
  dialog.style.setProperty("--editor-dialog-default-height", `${height}px`);
  dialog.style.width = `${width}px`;
  dialog.style.height = `${height}px`;
  dialog.dataset.editorDialogSized = "true";
  restoreDialogLayout(dialog);
}

function resetEditorDialogWindow() {
  dialog.classList.remove("is-maximized");
  delete dialog.dataset.editorDialogSized;
  dialog.style.removeProperty("--editor-dialog-default-width");
  dialog.style.removeProperty("--editor-dialog-default-height");
  dialog.style.width = "";
  dialog.style.height = "";
  updateEditorDialogMaximizeButton(false);
}

function resetEditorDialogLayout() {
  if (!dialog.open) return;

  resetDialogLayoutPreference(dialog);
  resetEditorDialogWindow();
  requestAnimationFrame(sizeEditorDialogFromDefault);
}

function toggleEditorDialogMaximized() {
  if (!dialog.open) return;

  const shouldMaximize = !dialog.classList.contains("is-maximized");
  if (shouldMaximize) {
    const rect = dialog.getBoundingClientRect();
    dialog.style.width = `${Math.ceil(rect.width)}px`;
    dialog.style.height = `${Math.ceil(rect.height)}px`;
  }

  dialog.classList.toggle("is-maximized", shouldMaximize);
  updateEditorDialogMaximizeButton(shouldMaximize);
}

function updateEditorDialogMaximizeButton(isMaximized) {
  if (!maximizeDialogButton) return;

  const label = isMaximized ? "Restore" : "Maximize";
  maximizeDialogButton.title = label;
  maximizeDialogButton.setAttribute("aria-label", label);
  maximizeDialogButton.textContent = label;
}

function editorDialogLayoutKey(title) {
  if (dialogBody.querySelector(".task-editor-grid")) return "editor:dev-task";
  if (dialogBody.querySelector(".bug-editor-grid")) return "editor:bug-report";
  if (dialogBody.querySelector(".scrum-editor-grid")) return "editor:scrum";
  if (dialogBody.querySelector(".log-editor-grid")) return "editor:log";
  if (dialogBody.querySelector("[name='parentBlogId'], .documentation-image-open-area")) return "editor:documentation";
  if (dialogBody.querySelector("[name='firstName'], [name='lastName'], [name='nickname']")) return "editor:user";
  if (dialogBody.querySelector("[name='lookupType'], [name='lookupValue']")) return "editor:setting";
  if (dialogBody.querySelector("[name='holidayDate']")) return "editor:holiday";
  if (/^(new|edit) project$/i.test(title || "")) return "editor:project";
  if (/^(new|edit) sprint$/i.test(title || "")) return "editor:sprint";
  return `editor:${title || "general"}`;
}

function moveEditorFooterActions() {
  if (!editorDialogSecondaryActions) return;

  editorDialogSecondaryActions.replaceChildren();
  dialogBody.querySelectorAll("template[data-editor-footer-action]").forEach(template => {
    const footerAction = template.content.cloneNode(true);
    editorDialogSecondaryActions.append(...footerAction.children);
    template.remove();
  });
}

function focusEditorField(focusName) {
  const requestedField = focusName ? dialogBody.querySelector(`[name='${focusName}'], [data-rich='${focusName}']`) : null;
  const firstField = dialogBody.querySelector("input:not([type='hidden']):not(:disabled), select:not(:disabled), textarea:not(:disabled), .rich-editor[contenteditable='true']");
  (requestedField || firstField)?.focus();
}

function bindTaskPercentRules(root) {
  if (root.dataset.devTaskPercentRules === "true") return;

  const status = root.querySelector("[name='status']");
  const percent = root.querySelector("[name='percentCompleted']");
  if (!status || !percent) return;

  const applyPercentRule = () => {
    if (percent.dataset.locked === "true") return;
    percent.value = percentForStatus(status.value, percent.value);
  };

  status.addEventListener("change", applyPercentRule);
  applyPercentRule();
}

function bindAuditButtons(root) {
  if (!root) return;

  root.querySelectorAll("[data-action='show-task-audit']").forEach(button => {
    button.addEventListener("click", () => showTaskAudit(Number(button.dataset.id)));
  });
}

function bindRichTextButtons(root) {
  // Rich text is kept simple and browser-native. The mousedown handler keeps
  // focus in the editor so list/bold/underline commands apply to the right text.
  // PMT targets Chrome/Chromium, so these browser-native commands are tested there first.
  root.querySelectorAll("[data-command]").forEach(button => {
    button.addEventListener("mousedown", event => event.preventDefault());
    button.addEventListener("click", async () => {
      const command = button.dataset.command;
      const editor = richEditorForControl(button);
      if (!editor) return;

      const savedSelection = saveEditorSelection(editor);
      editor.focus();
      restoreEditorSelection(savedSelection);

      if (command === "createLink") {
        const url = await askForText("Link URL", "Add Link", "https://");
        if (!url) return;

        editor.focus();
        restoreEditorSelection(savedSelection);
        document.execCommand(command, false, normalizeUrl(url));
        normalizeLinksInElement(editor);
        return;
      }

      if (command === "insertCodeBlock") {
        const codeBlock = await askForCodeBlock(editorSelectionText(savedSelection));
        if (!codeBlock) return;

        editor.focus();
        restoreEditorSelection(savedSelection);
        document.execCommand("insertHTML", false, richCodeBlockHtml(codeBlock));
        return;
      }

      document.execCommand(command, false, null);

      // Chrome/Chromium can ignore insertUnorderedList in an empty editor. This gives
      // the user a visible bullet to type into instead of making the button feel dead.
      if (command === "insertUnorderedList" && !editor.querySelector("ul")) {
        document.execCommand("insertHTML", false, "<ul><li><br></li></ul>");
      }
      if (command === "insertOrderedList" && !editor.querySelector("ol")) {
        document.execCommand("insertHTML", false, "<ol><li><br></li></ol>");
      }
    });
  });

  root.querySelectorAll("[data-rich-format]").forEach(select => {
    let savedSelection = null;

    select.addEventListener("mousedown", () => {
      const editor = richEditorForControl(select);
      savedSelection = editor ? saveEditorSelection(editor) : null;
    });

    select.addEventListener("change", () => {
      const editor = richEditorForControl(select);
      const format = select.value;
      select.value = "";
      if (!editor || !format) return;

      editor.focus();
      restoreEditorSelection(savedSelection || saveEditorSelection(editor));
      applyRichTextFormat(editor, format);
      savedSelection = null;
    });
  });

  root.querySelectorAll(".rich-editor").forEach(editor => {
    editor.addEventListener("paste", async event => {
      const imageItems = [...(event.clipboardData?.items || [])].filter(item => item.type.startsWith("image/"));
      if (!imageItems.length) return;

      event.preventDefault();
      editor.focus();

      for (const item of imageItems) {
        const file = item.getAsFile();
        if (!file) continue;

        const upload = await uploadFile("richtext", file);
        document.execCommand("insertHTML", false, `<img src="${escapeAttr(upload.url)}" alt="${escapeAttr(upload.fileName)}">`);
      }
    });
  });
}

function richEditorForControl(control) {
  return control.closest(".field")?.querySelector(".rich-editor")
    || control.closest("[data-rich-editor-root]")?.querySelector(".rich-editor")
    || null;
}

function applyRichTextFormat(editor, formatName) {
  const format = richTextFormats[formatName];
  if (!format) return;

  document.execCommand("formatBlock", false, format.tag);
  selectedRichBlocks(editor).forEach(block => {
    block.classList.remove("rich-title");
    if (format.className && block.tagName === format.tag) block.classList.add(format.className);
  });
}

function selectedRichBlocks(editor) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return [];

  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return [];

  const blocks = new Set();
  const startBlock = closestRichBlock(range.startContainer, editor);
  const endBlock = closestRichBlock(range.endContainer, editor);
  if (startBlock) blocks.add(startBlock);
  if (endBlock) blocks.add(endBlock);

  editor.querySelectorAll("h1, h2, h3, p, div, li").forEach(block => {
    try {
      if (range.intersectsNode(block)) blocks.add(block);
    } catch {
      // Some browser-generated editing nodes can disappear while formatBlock runs.
    }
  });

  return [...blocks];
}

function closestRichBlock(node, editor) {
  const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  const block = element?.closest("h1, h2, h3, p, div, li");
  return block && block !== editor && editor.contains(block) ? block : null;
}

function editorSelectionText(range) {
  if (!range || range.collapsed) return "";
  return range.cloneContents().textContent || "";
}

function askForCodeBlock(initialCode = "") {
  return new Promise(resolve => {
    const modal = document.createElement("dialog");
    modal.className = "dialog rich-code-dialog";
    modal.innerHTML = `
      <form method="dialog">
        <div class="dialog-head">
          <h2>Code Block</h2>
        </div>
        <div class="dialog-body">
          <div class="field">
            <label>Caption</label>
            <input name="codeCaption" value="Code">
          </div>
          <div class="field full">
            <label>Code</label>
            <textarea name="codeText" rows="12" spellcheck="false">${escapeHtml(initialCode)}</textarea>
          </div>
        </div>
        <div class="dialog-actions">
          <button type="button" class="secondary text-icon-button" data-result="cancel">${buttonContent("&#10005;", "Cancel")}</button>
          <button type="submit" class="primary text-icon-button">${buttonContent("&#10003;", "Insert")}</button>
        </div>
      </form>
    `;

    document.body.appendChild(modal);

    const finish = value => {
      modal.close();
      modal.remove();
      resolve(value);
    };

    modal.querySelector("[data-result='cancel']").addEventListener("click", () => finish(null));
    modal.querySelector("form").addEventListener("submit", event => {
      event.preventDefault();
      finish({
        caption: modal.querySelector("[name='codeCaption']").value,
        code: modal.querySelector("[name='codeText']").value
      });
    });
    modal.addEventListener("cancel", event => {
      event.preventDefault();
      finish(null);
    });

    modal.showModal();
    setTimeout(() => modal.querySelector("[name='codeText']").focus(), 0);
  });
}

function richCodeBlockHtml({ caption, code }) {
  const summary = escapeHtml((caption || "Code").trim() || "Code");
  const codeHtml = escapeHtml(code || "") || "<br>";
  return `<details class="rich-code-block" open><summary>${summary}</summary><pre><code>${codeHtml}</code></pre></details><p><br></p>`;
}

function saveEditorSelection(editor) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  return editor.contains(range.commonAncestorContainer) ? range.cloneRange() : null;
}

function restoreEditorSelection(range) {
  if (!range) return;

  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

async function saveJson(path, method, payload) {
  return api(path, { method, body: JSON.stringify(payload) });
}

async function refreshAfterImport() {
  await loadState();
  render();
}

async function uploadFile(kind, file) {
  const body = new FormData();
  body.append("file", file);
  return api(`/api/uploads/${kind}`, { method: "POST", body });
}

async function attachFile(path, file) {
  const body = new FormData();
  body.append("file", file);
  return api(path, { method: "POST", body });
}

async function deleteItem(path, message) {
  if (!await askYesNo(message, "Delete")) return;
  try {
    await api(path, { method: "DELETE" });
    await loadState();
    render();
    showToast("Deleted.");
  } catch (error) {
    showToast(error.message);
  }
}

async function duplicateTask(id) {
  try {
    await api(`/api/tasks/${id}/duplicate`, { method: "POST" });
    await loadState();
    render();
    showToast("Dev Task duplicated.");
  } catch (error) {
    showToast(error.message);
  }
}

async function duplicateBacklogTask(id) {
  try {
    await api(`/api/backlog/tasks/${id}/duplicate`, { method: "POST" });
    await loadState();
    render();
    showToast("Backlog item duplicated.");
  } catch (error) {
    showToast(error.message);
  }
}

function workItemDialogOptions(extra = {}) {
  return {
    onConvertToDocument: convertWorkItemToDocument,
    onViewDocument: openDocumentationById,
    onViewWorkItem: updateWorkItemContentUrl,
    ...extra
  };
}

function updateWorkItemContentUrl(task) {
  if (!task?.id) return;

  updateBrowserUrl(workItemContentRoute(task.id));
  lastOpenedContentRouteKey = contentRouteKey(parseRouteFromLocation());
}

async function convertWorkItemToDocument(task) {
  if (!task?.id) return false;

  try {
    const result = await api(`/api/tasks/${task.id}/convert-to-document`, { method: "POST" });
    const blogId = Number(result.blogId || 0);
    await loadState();
    render();
    showToast("Document ready.");
    return blogId || result;
  } catch (error) {
    showToast(error.message);
    return false;
  }
}

function openDocumentationById(blogId, options = {}) {
  const opened = documentationFeature.view?.(Number(blogId || 0));
  if (opened && options.updateUrl !== false) {
    updateBrowserUrl(routeForContent("documentation", blogId));
    lastOpenedContentRouteKey = contentRouteKey(parseRouteFromLocation());
  }
  if (!opened && options.showMissingToast !== false) showToast("Document was not found.");
  return opened;
}

function editWorkItem(task) {
  if (task?.taskType === "Bug") {
    bugsFeature.edit(task);
  } else {
    tasksFeature.edit(task || {});
  }
}

function viewBacklogWorkItem(task) {
  if (!task) return;

  viewWorkItem(task, selectedTask => {
    if (selectedTask?.taskType === "Bug") {
      bugsFeature.edit(selectedTask, { apiRoot: "/api/backlog/tasks" });
    } else {
      tasksFeature.edit(selectedTask || {}, { apiRoot: "/api/backlog/tasks" });
    }
  }, { canEdit: true, onConvertToDocument: null, onViewDocument: openDocumentationById });
}

function gotoTask(id, options = {}) {
  const task = taskById(id);
  if (!task) return;
  tasksFeature.selectContext(task.projectId, String(task.sprintId || "all"));
  navigate("Tasks", { updateUrl: options.updateUrl !== false });
  render();
}

function openTaskReadMode(id) {
  const task = taskById(id);
  if (!task) return;

  lastOpenedContentRouteKey = "";
  updateBrowserUrl(workItemContentRoute(id));
  gotoTask(id, { updateUrl: false });
}

function viewProjectSprints(projectId) {
  sprintsFeature.selectProject(projectId);
  navigate("Sprints");
  render();
}

function viewDashboardSprint(sprintId) {
  const sprint = sprintById(sprintId);
  if (!sprint) return;

  sprintsFeature.selectProject(sprint.projectId);
  navigate("Sprints");
  render();
}

function viewSprintTasks(sprintId) {
  const sprint = sprintById(sprintId);
  if (!sprint) return;

  tasksFeature.selectContext(sprint.projectId, String(sprint.id));
  navigate("Tasks");
  render();
}

function viewProjectGantt(projectId) {
  ganttFeature.openProject(projectId);
}

function refreshLookupOptions() {
  statuses = lookupValues("Status", fallbackStatuses);
  priorities = lookupValues("Priority", fallbackPriorities);
  severities = lookupValues("Severity", fallbackSeverities);
  environments = lookupValues("Environment", fallbackEnvironments);
  boardFeature?.refreshStatuses();
}

function lookupValues(type, fallback) {
  const values = (state.lookups || [])
    .filter(item => item.lookupType === type && item.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.value.localeCompare(b.value))
    .map(item => item.value);

  return values.length ? values : [...fallback];
}

function lookupOptionsWithCurrent(type, currentValue) {
  const options = lookupValues(type, fallbackForLookup(type));
  if (currentValue && !options.includes(currentValue)) return [...options, currentValue];
  return options;
}

function showToast(message, anchorElement = null) {
  const openDialogs = [...document.querySelectorAll("dialog[open]")];
  const toastHost = openDialogs.at(-1) || document.body;
  toastHost.appendChild(toast);

  toast.textContent = message;
  toast.hidden = false;
  toast.classList.remove("toast-near-control");
  toast.style.left = "";
  toast.style.top = "";
  toast.style.right = "";
  toast.style.bottom = "";
  toast.style.maxWidth = "";

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.hidden = true;
  }, 3600);
}
