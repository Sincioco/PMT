import { api } from "./core/api.js";
import { avatarsHtml, taskRowAvatarsHtml } from "./components/avatars.js";
import { buttonContent } from "./components/buttons.js";
import { askForText, askYesNo } from "./components/dialogs.js";
import {
  field,
  value
} from "./components/forms.js";
import { configureProgressAndStatus } from "./components/progress-and-status.js?v=20260620-ui-theme";
import {
  bindAttachmentPreview,
  showTaskAudit,
  viewWorkItem
} from "./components/work-items.js?v=20260620-light-reference-1-v2";
import { createApplicationShell } from "./core/application-shell.js?v=20260620-light-reference-1";
import {
  currentView,
  navigate
} from "./core/router.js";
import {
  registeredScreenHandlers,
  registerScreen,
  screenHandlerFor
} from "./core/screen-registry.js";
import { state } from "./core/store.js";
import { createBacklogFeature } from "./features/backlog/backlog.js?v=20260620-bug-linked-task";
import { createBoardFeature } from "./features/board/board.js?v=20260620-bug-linked-task";
import { createBugsFeature } from "./features/bugs/bugs.js?v=20260620-null-end-date";
import { createDashboardFeature } from "./features/dashboard/dashboard.js?v=20260620-ui-theme";
import { createDocumentationFeature } from "./features/documentation/documentation.js?v=20260620-document-entry-project";
import {
  createGanttFeature,
  currentSprintForProject,
  ganttStartDate
} from "./features/gantt/gantt.js?v=20260620-gantt-flush-sprint";
import { createProjectsFeature } from "./features/projects/projects.js?v=20260620-null-end-date";
import { createRoadMapFeature } from "./features/roadmap/roadmap.js?v=20260620-render-end-date";
import { createScrumFeature } from "./features/scrum/scrum.js?v=20260620-scrum-project";
import { createSettingsFeature } from "./features/settings/settings.js?v=20260620-light-reference-1";
import { createSprintsFeature } from "./features/sprints/sprints.js?v=20260620-null-end-date";
import { createTasksFeature } from "./features/tasks/tasks.js?v=20260620-dev-task-charts";
import { createWfhScheduleFeature } from "./features/wfh-schedule/wfh-schedule.js?v=20260620-wfh-schedule";
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
} from "./shared/text-and-links.js";
import {
  configureWorkItemRules,
  isBugQaPassedOrLater,
  percentForStatus,
  sprintOverallPercent,
  taskOrderCompare
} from "./shared/work-item-rules.js";

const nativePickerSelector = [
  "select",
  'input[type="date"]',
  'input[type="datetime-local"]',
  'input[type="month"]',
  'input[type="time"]',
  'input[type="week"]'
].join(",");

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
// let openCreateSprintOnRender = false;

configureWorkItemRules({
  getStatuses: () => statuses,
  getTasks: () => state.tasks
});
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

const roadMapFeature = createRoadMapFeature({ app });
const ganttFeature = createGanttFeature({
  app,
  openTaskReadMode: id => viewWorkItem(taskById(id), editWorkItem),
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
  saveJson
});
const backlogFeature = createBacklogFeature({ app });
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
const documentationFeature = createDocumentationFeature({
  app,
  attachFile,
  deleteItem,
  openEditor,
  saveJson
});
const wfhScheduleFeature = createWfhScheduleFeature({
  app,
  render,
  showToast
});

registerScreen("Dashboard", dashboardFeature);
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
registerScreen("Documentation", documentationFeature);
registerScreen("WFH Schedule", wfhScheduleFeature);

document.getElementById("closeDialog").addEventListener("click", () => dialog.close());
document.getElementById("cancelDialog").addEventListener("click", () => dialog.close());

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
  app.addEventListener("pointerdown", handlePointerDown);
  app.addEventListener("mousedown", handleMouseDown);
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("pointerup", handlePointerUp);
  window.addEventListener("mouseup", handleMouseUp);
  window.addEventListener("pointercancel", cancelPointerDrag);
  document.addEventListener("click", handleDocumentLinkClick);
}

async function loadState() {
  return shell.reloadState();
}

function render() {
  shell.render();
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
  if (currentView !== "Board") boardFeature.deactivate();
  if (currentView !== "Gantt") ganttFeature.deactivate();
  if (currentView !== "Tasks") tasksFeature.deactivate();

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

  const id = Number(button.dataset.id || 0);
  const action = button.dataset.action;

  if (handleChartAction(button)) return;

  for (const screen of registeredScreenHandlers()) {
    if (screen.handleAction && await screen.handleAction(action, id, button)) return;
  }

  if (action === "goto-task") gotoTask(id);
  if (action === "gantt-open-task") openTaskReadMode(id);
  if (action === "view-project-gantt") viewProjectGantt(id);
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

  if (action === "view-task") {
    viewWorkItem(taskById(Number(element.dataset.id || 0)), editWorkItem);
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
              <th></th>
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
                <td class="actions-cell">
                  <button class="icon-action" type="button" data-action="view-task" data-id="${bug.id}" title="View Bug Report">&#128065;</button>
                </td>
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
              <th></th>
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
                <td class="actions-cell">
                  <button class="icon-action" type="button" data-action="view-task" data-id="${task.id}" title="View Dev Task">&#128065;</button>
                </td>
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

function expandVisualChartCard(card) {
  if (!card) return;

  const title = card.querySelector(".chart-card-head h2")?.textContent || "Chart";
  const chartCopy = card.cloneNode(true);
  chartCopy.classList.add("chart-expanded-card");
  chartCopy.querySelector("[data-action='expand-visual-chart']")?.remove();

  const modal = document.createElement("dialog");
  modal.className = "dialog chart-expanded-dialog";
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

  modal.querySelector(".chart-expanded-body").appendChild(chartCopy);
  document.body.appendChild(modal);
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

function hideChartTooltip() {
  if (chartTooltip) chartTooltip.hidden = true;
}

function handleDocumentLinkClick(event) {
  const link = event.target.closest("a[href]");
  if (!link) return;

  link.target = "_blank";
  link.rel = "noopener noreferrer";
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

  const dragHandle = event.target.closest("[data-drag-handle]");
  const handleRequired = container.matches('[data-reorder-list="tasks"], [data-reorder-list="bugs"]');
  if (handleRequired && (!dragHandle || !item.contains(dragHandle))) return;
  if (!handleRequired && event.target.closest("button, a, input, select, textarea")) return;

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
  if (!drop || !task || !canEditTask(task)) {
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
  modal.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => {
    modal.close();
    modal.remove();
  }));
  modal.addEventListener("click", event => {
    const inlineButton = event.target.closest("[data-action='view-task-inline']");
    if (!inlineButton) return;
    modal.close();
    modal.remove();
    viewWorkItem(taskById(Number(inlineButton.dataset.id)), editWorkItem);
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
  dialogTitle.textContent = title;
  dialogBody.innerHTML = html;
  if (afterOpen) afterOpen(dialogBody);
  bindRichTextButtons(dialogBody);
  bindTaskPercentRules(dialogBody);
  bindAttachmentPreview(dialogBody);
  bindAuditButtons(dialogBody);

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
  dialogBody.scrollTop = 0;
  dialog.scrollTop = 0;

  // Start each dialog on the most useful field so users can type right away.
  setTimeout(() => focusEditorField(focusName), 0);
}

function focusEditorField(focusName) {
  const requestedField = focusName ? dialogBody.querySelector(`[name='${focusName}'], [data-rich='${focusName}']`) : null;
  const firstField = dialogBody.querySelector("input:not([type='hidden']):not(:disabled), select:not(:disabled), textarea:not(:disabled), .rich-editor[contenteditable='true']");
  (requestedField || firstField)?.focus();
}

function bindTaskPercentRules(root) {
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
      const editor = button.closest(".field")?.querySelector(".rich-editor");
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

      document.execCommand(command, false, null);

      // Chrome/Chromium can ignore insertUnorderedList in an empty editor. This gives
      // the user a visible bullet to type into instead of making the button feel dead.
      if (command === "insertUnorderedList" && !editor.querySelector("ul")) {
        document.execCommand("insertHTML", false, "<ul><li><br></li></ul>");
      }
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

function editWorkItem(task) {
  if (task?.taskType === "Bug") {
    bugsFeature.edit(task);
  } else {
    tasksFeature.edit(task || {});
  }
}

function gotoTask(id) {
  const task = taskById(id);
  if (!task) return;
  tasksFeature.selectContext(task.projectId, String(task.sprintId || "all"));
  navigate("Tasks");
  render();
}

function openTaskReadMode(id) {
  const task = taskById(id);
  if (!task) return;

  gotoTask(id);
  viewWorkItem(task, editWorkItem);
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
