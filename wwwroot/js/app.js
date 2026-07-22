import { api } from "./core/api.js";
import { currentUserId } from "./core/authentication.js?v=20260715-admin-impersonation";
import { avatarsHtml, taskRowAvatarsHtml } from "./components/avatars.js?v=20260710-nav-avatar-fit";
import { bindAttachmentDeletion } from "./components/attachments.js?v=20260714-attachment-delete";
import { buttonContent } from "./components/buttons.js?v=20260715-admin-impersonation";
import { copyHtmlToClipboard, copyTextToClipboard } from "./components/clipboard.js?v=20260714-invite-email-body";
import {
  annotationSvgDataUrl,
  buildAnnotationSvg,
  parseAnnotationSvg,
  openImageAnnotationDialog
} from "./components/image-annotation.js?v=20260721-diagram-viewer-wheel-v1";
import { createWhatsNew } from "./components/whats-new.js?v=release-notes-2026-07-22-day-35-a57726c81c10";
import {
  htmlWithoutUserMentionMarkup,
  initializeUserMentions
} from "./components/user-mentions.js?v=20260722-rich-entity-mentions-v1";
import {
  askForText,
  askYesNo,
  hideEmptyReadOnlyFields,
  initializeDialogLayoutPersistence,
  initializeDraggableDialogs,
  initializeWindowedDialog,
  resetDialogLayoutPreference,
  restoreDialogLayout,
  setDialogLayoutStorageKey
} from "./components/dialogs.js?v=20260715-save-collision-v2";
import {
  field,
  value
} from "./components/forms.js?v=20260722-rte-toggle-state-v1";
import { configureProgressAndStatus } from "./components/progress-and-status.js?v=20260714-linked-bug-percent";
import {
  bindAttachmentPreview,
  showTaskAudit,
  viewWorkItem
} from "./components/work-items.js?v=20260722-rich-entity-mentions-v1";
import { createApplicationShell } from "./core/application-shell.js?v=20260722-auth-flyby-v1";
import {
  currentView,
  ensureCurrentViewRoute,
  navigate,
  parseRouteFromLocation,
  routeForContent,
  routeForView,
  updateBrowserUrl
} from "./core/router.js?v=20260718-diagram-library-v8";
import {
  registeredScreenHandlers,
  registerScreen,
  screenHandlerFor,
  screenRegistry
} from "./core/screen-registry.js?v=20260718-diagram-library-v7";
import {
  preferenceKeys,
  readBooleanPreference,
  writePreference
} from "./core/preferences.js?v=20260718-diagram-library-v8";
import { state } from "./core/store.js";
import { appUrl, storageUrl } from "./shared/app-urls.js";
import {
  createAboutAuthFlyby,
  createAboutFeature,
  createAboutScreenSaver
} from "./features/about/about.js?v=20260722-login-flyby-v1";
import { createBacklogFeature } from "./features/backlog/backlog.js?v=20260720-work-item-export-images-v4";
import { createBoardFeature } from "./features/board/board.js?v=20260722-rich-entity-mentions-v1";
import { createBugsFeature } from "./features/bugs/bugs.js?v=20260722-rte-toggle-state-v1";
import { createDashboardFeature } from "./features/dashboard/dashboard.js?v=release-notes-2026-07-22-day-35-a57726c81c10";
import { createDiagramFeature } from "./features/diagram/diagram.js?v=20260722-rich-entity-mentions-v1";
import { createDocumentationFeature } from "./features/documentation/documentation.js?v=20260722-rich-entity-mentions-v1";
import {
  createGanttFeature,
  currentSprintForProject,
  ganttStartDate
} from "./features/gantt/gantt.js?v=release-notes-2026-07-22-day-35-a57726c81c10";
import { createInvitationsFeature } from "./features/invitations/invitations.js?v=20260722-auth-flyby-v1";
import { createProjectsFeature } from "./features/projects/projects.js?v=20260719-day32-rte-diagram";
import { createReleaseNotesFeature } from "./features/release-notes/release-notes.js?v=release-notes-2026-07-22-day-35-a57726c81c10";
import { createRoadMapFeature } from "./features/roadmap/roadmap.js?v=release-notes-2026-07-22-day-35-a57726c81c10";
import { createLogFeature } from "./features/personal-log/log.js?v=20260722-rte-toggle-state-v1";
import { createScrumFeature } from "./features/scrum/scrum.js?v=20260722-ole-viewport-v1";
import { createSettingsFeature } from "./features/settings/settings.js?v=20260720-clear-preferences-logout-v1";
import { createSprintsFeature } from "./features/sprints/sprints.js?v=20260719-day32-rte-diagram";
import { createTasksFeature } from "./features/tasks/tasks.js?v=20260722-rte-toggle-state-v1";
import { createWfhScheduleFeature } from "./features/wfh-schedule/wfh-schedule.js?v=20260720-work-item-export-images-v4";
import {
  fallbackEnvironments,
  fallbackForLookup,
  fallbackPriorities,
  fallbackSeverities,
  fallbackStatuses
} from "./shared/constants.js";
import {
  prepareRichSourceHighlight,
  RICH_SOURCE_TEXT_TYPES
} from "./shared/source-highlighting.js?v=20260719-rte-source-v17";
import { formatDate, toDateInput } from "./shared/dates.js";
import { externalizeImportedHtmlImages } from "./shared/imported-html-images.js?v=20260719-rte-upload-v17";
import { canEditTask } from "./shared/permissions.js?v=20260715-admin-impersonation";
import { applyActionPermissions, canAccessResource, canReadView, firstReadableView } from "./shared/security.js?v=20260718-diagram-entity-v22";
import {
  projectCode,
  projectName,
  sprintById,
  sprintName,
  taskById
} from "./shared/selectors.js";
import {
  severityPillHtml,
  severityTextHtml
} from "./shared/severity.js?v=20260715-severity-prefix";
import {
  escapeAttr,
  escapeHtml,
  linkifyTextNodes,
  normalizeLinksInElement,
  normalizeUrl
} from "./shared/text-and-links.js?v=20260722-rte-toggle-state-v1";
import {
  configureWorkItemRules,
  isBugQaPassedOrLater,
  percentForStatus,
  sprintOverallPercent,
  taskOrderCompare
} from "./shared/work-item-rules.js?v=20260716-developer-board-status";

const nativePickerSelector = [
  "select",
  'input[type="date"]',
  'input[type="datetime-local"]',
  'input[type="month"]',
  'input[type="time"]',
  'input[type="week"]'
].join(",");

initializeDraggableDialogs();
bindGlobalRichCheckboxSync();
bindGlobalRichCodeBlockActions();
bindGlobalRichCollapsibleBlocks();
initializeUserMentions({
  getUsers: () => state.users,
  getRoles: () => state.roles,
  getTasks: () => state.tasks,
  getBlogs: () => state.blogs,
  getProjects: () => state.projects,
  getSprints: () => state.sprints
});

const richTextFormats = {
  title: { tag: "H1", className: "rich-title" },
  h1: { tag: "H1", className: "" },
  h2: { tag: "H2", className: "" },
  h3: { tag: "H3", className: "" },
  body: { tag: "P", className: "" }
};
const richCustomColorStorageKey = "pmt-rich-custom-colors";
const richLastColorStorageKey = "pmt-rich-last-colors";
const richLastColorCommandStoragePrefix = "pmt-rich-last-color-";
const richCustomColorLimit = 10;
const richTableMaxSize = 10;
const richReadonlyCheckboxSaveDelayMs = 350;
const richReadonlyCheckboxSaveTimers = new WeakMap();
let activeRichTextImageMenu = null;
let activeRichTextImageSelection = null;

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
      if (node instanceof HTMLElement) {
        syncNativePickers(node);
        normalizeLinksInElement(node);
      }
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
let invitationsFeature = null;
let whatsNew = null;
let handlingBrowserRouteChange = false;
let lastOpenedContentRouteKey = "";
let activeAuthFlyby = null;
let activeAuthFlybyTimer = 0;
const authFlybyDelayMs = 30 * 1000;
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

function renderAuthFlyby(host) {
  window.clearTimeout(activeAuthFlybyTimer);
  activeAuthFlybyTimer = 0;
  activeAuthFlyby?.deactivate();
  activeAuthFlyby = null;
  document.body.classList.remove("auth-flyby-rendering");
  if (!host) return;

  host.dataset.authFlybyDelayMs = String(authFlybyDelayMs);
  activeAuthFlybyTimer = window.setTimeout(() => {
    activeAuthFlybyTimer = 0;
    if (!host.isConnected) return;

    document.body.classList.add("auth-flyby-rendering");
    activeAuthFlyby = createAboutAuthFlyby({ host });
    activeAuthFlyby.render();
  }, authFlybyDelayMs);
}

function clearAuthFlyby() {
  window.clearTimeout(activeAuthFlybyTimer);
  activeAuthFlybyTimer = 0;
  activeAuthFlyby?.deactivate();
  activeAuthFlyby = null;
  document.body.classList.remove("auth-flyby-rendering", "login-flyby-active", "invite-flyby-active");
}

const shell = createApplicationShell({
  afterLogin: () => whatsNew?.showAfterLogin(),
  bindScreenEvents,
  editPassword,
  hasPendingInvitation: () => invitationsFeature?.hasPendingInvitation(),
  inviteUsers: () => invitationsFeature?.openInviteDialog(),
  // prepareRender,
  refreshLookupOptions,
  clearLoginBackground: clearAuthFlyby,
  renderLoginBackground: renderAuthFlyby,
  renderPendingInvitation: () => invitationsFeature?.renderInvitationProfile(),
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
const toggleAllRichToolsButton = document.getElementById("toggleAllRichTools");

const roadMapFeature = createRoadMapFeature({ app });
function createConfiguredAboutFeature(host) {
  return createAboutFeature({
    app: host,
    getCurrentSprint: currentSprintForProject,
    getItemStartDate: ganttStartDate,
    getSeverities: () => severities,
    getStatuses: () => statuses
  });
}

const aboutFeature = createConfiguredAboutFeature(app);
const aboutScreenSaver = createAboutScreenSaver({
  app,
  createFeature: createConfiguredAboutFeature,
  canActivate: () => Boolean(currentUserId)
    && state.users.length > 0
    && currentView !== "About"
    && !app.classList.contains("app-shell-about")
});
aboutScreenSaver.initialize();
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
  deleteItems,
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
  deleteItems,
  loadState,
  openEditor,
  openSprintTasks: viewSprintTasks,
  render,
  saveJson,
  showToast
});
invitationsFeature = createInvitationsFeature({
  app,
  onAccepted: async result => {
    const started = await shell.start();
    if (!started) return;

    if (result.nextView === "Sprints" && result.projectId) {
      sprintsFeature.selectProject(result.projectId);
      navigate("Sprints");
    } else {
      navigate("Projects");
    }
    render();
    await whatsNew?.showAfterLogin();
  },
  resumeApplication: async () => {
    if (currentUserId) {
      await shell.start();
    } else {
      shell.renderLogin();
    }
  },
  clearAuthBackground: clearAuthFlyby,
  renderAuthBackground: renderAuthFlyby,
  showToast,
  uploadFile
});
const settingsFeature = createSettingsFeature({
  app,
  deleteItem,
  loadState,
  openEditor,
  render,
  resetUserPassword,
  saveJson,
  showToast,
  uploadFile
});
const tasksFeature = createTasksFeature({
  app,
  attachFile,
  deleteItem,
  deleteItems,
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
  deleteItems,
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
  deleteItems,
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
  api,
  app,
  askYesNo,
  deleteItem,
  hydrateLinkedDiagrams: hydrateRichDiagramOleBlocks,
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
  deleteItems,
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
  hydrateLinkedDiagrams: hydrateRichDiagramOleBlocks,
  deleteAttachment,
  deleteItem,
  deleteItems,
  loadState,
  openEditor,
  render,
  saveJson,
  showToast,
  copyRichTextImageAssets
});
const diagramFeature = createDiagramFeature({
  app,
  askForColor: current => askForText("HEX (#126BFF) or RGB (18, 107, 255)", "Custom Color", current),
  askForText,
  bindRichTextButtons,
  confirm: askYesNo,
  notify: showToast,
  loadTemplateLibrary: () => api("/api/image-annotation/template-library", { cache: "no-store" }),
  loadDefaultTemplateLibrary: () => api("/api/image-annotation/default-template-library", { cache: "no-store" }),
  saveTemplateLibrary: library => saveJson("/api/image-annotation/template-library", "PUT", library),
  loadPmtDatabaseSchema: () => api("/api/diagram/pmt-database-schema", { cache: "no-store" }),
  uploadEmbeddedImage: uploadRichTextCanvasImage,
  persistCroppedOriginal: uploadRichTextCanvasImage,
  createDiagramDocument: createDiagramBackingDocument,
  saveDiagramDocument: updateDiagramBackingDocument,
  openEditor,
  saveDiagramInfo: updateDiagramBackingInfo,
  moveDiagramDocument: moveDiagramBackingDocument,
  deleteItem
});
const wfhScheduleFeature = createWfhScheduleFeature({
  app,
  render,
  showToast
});
const releaseNotesFeature = createReleaseNotesFeature({ app });
whatsNew = createWhatsNew({
  getUserId: () => currentUserId,
  onReleaseNotesUpdated: () => {
    if (currentView === "Release Notes") releaseNotesFeature.render();
  },
  openReleaseNotes: () => {
    navigate("Release Notes");
    render();
  }
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
registerScreen("Diagram", diagramFeature);
registerScreen("Release Notes", releaseNotesFeature);

document.getElementById("closeDialog").addEventListener("click", () => dialog.close());
document.getElementById("cancelDialog").addEventListener("click", () => dialog.close());
initializeDialogLayoutPersistence(dialog);
resetDialogButton?.addEventListener("click", resetEditorDialogLayout);
maximizeDialogButton?.addEventListener("click", toggleEditorDialogMaximized);
toggleAllRichToolsButton?.addEventListener("click", toggleAllEditorRichToolbars);
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
  bindRichCodeBlocks(document.body);
  bindRichCollapsibleBlocks(document.body);
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
    const requestedView = route.view || "Dashboard";
    const resolvedView = navigate(requestedView, { updateUrl: false });
    if (resolvedView !== requestedView) updateBrowserUrl(routeForView(resolvedView), { replace: true });
    render();
    handlingBrowserRouteChange = false;
  });
}

function handleDeepLinkDialogClose(event) {
  if (handlingBrowserRouteChange) return;
  if (!isRoutedDialog(event.target)) return;
  if (event.target.dataset.preserveContentRoute === "true") return;

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
  if (route.contentType === "diagram") return diagramFeature.view?.(id) === true;
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
  if (!canReadView(currentView)) navigate(firstReadableView(screenRegistry));
  ensureCurrentViewRoute();

  if (currentView !== "About") aboutFeature.deactivate();
  if (currentView !== "Board") boardFeature.deactivate();
  if (currentView !== "Sprints") sprintsFeature.deactivate?.();
  if (currentView !== "Gantt") ganttFeature.deactivate();
  if (currentView !== "Tasks") tasksFeature.deactivate();
  if (currentView !== "Bugs") bugsFeature.deactivate();
  if (currentView !== "Backlog") backlogFeature.deactivate();
  if (currentView !== "Scrum") scrumFeature.deactivate();
  if (currentView !== "Log") logFeature.deactivate();
  if (currentView !== "Documentation") documentationFeature.deactivate?.();
  if (currentView !== "Diagram") diagramFeature.deactivate();

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
  applyActionPermissions(app, currentView);
  linkifyTextNodes(app);
  normalizeLinksInElement(app);
  hydrateRichDiagramOleBlocks(app);
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
  if (event.target.closest(".rich-readonly .rich-check-item, .log-content .rich-check-item, .scrum-content .rich-check-item")) return;
  if (event.target.closest(".rich-code-block, .rich-collapsible-block, .pmt-diagram-ole")) return;

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
  if (action === "select-diagram-card" || action === "select-diagram-document") {
    return state.blogs.some(blog => blog.id === id) ? routeForContent("diagram", id) : "";
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
                <td>${severityTextHtml(bug.severity)}</td>
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
  hideEmptyReadOnlyFields(modal);
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
    return severityPillHtml(workItem.severity);
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
    showRichTextImageMenu(image, event);
    return;
  }

  openRichTextImageInNewTab(image);
}

function showRichTextImageMenu(image, anchorEvent) {
  closeRichTextImageMenu();
  closeRichTextImageSelection();

  const menu = document.createElement("div");
  menu.className = "rich-image-menu dropdown-menu";
  menu.setAttribute("role", "menu");
  menu.innerHTML = [
    richTextImageMenuItemHtml("select", "&#9635;", "Select"),
    richTextImageMenuItemHtml("annotate", "A", image.dataset.pmtAnnotationVersion ? "Edit Annotation" : "Annotate"),
    richTextImageMenuItemHtml("resize", "&#8596;", "Resize"),
    richTextImageMenuItemHtml("zoom", "&#128269;", "Open in New Tab"),
    image.dataset.pmtAnnotationSource
      ? richTextImageMenuItemHtml("original", "O", "Open Original")
      : "",
    richTextImageMenuSeparatorHtml(),
    richTextImageMenuItemHtml("delete", "&#128465;", "Delete")
  ].join("");

  const hostDialog = image.closest("dialog[open]");
  const usesPopover = showRichTextOverlayAsPopover(menu, hostDialog);
  if (!usesPopover) {
    (hostDialog || document.body).appendChild(menu);
  }
  hostDialog?.classList.add("rich-image-menu-open");
  positionRichTextImageMenu(menu, image, anchorEvent);

  const finish = () => closeRichTextImageMenu();

  menu.addEventListener("pointerdown", event => {
    event.stopPropagation();
  });
  menu.addEventListener("click", event => {
    const actionButton = event.target.closest("[data-rich-image-action]");
    if (!actionButton) return;

    event.preventDefault();
    event.stopPropagation();

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

    if (action === "annotate") {
      finish();
      requestAnimationFrame(() => annotateRichTextImage(image));
      return;
    }

    if (action === "original") {
      openRichTextSourceInNewTab(image.dataset.pmtAnnotationSource);
      finish();
      return;
    }

    if (action === "select") {
      finish();
      requestAnimationFrame(() => selectRichTextImage(image));
      return;
    }

    if (action === "delete") {
      deleteRichTextImage(image);
      finish();
      return;
    }

    finish();
  });
  const handleOutsidePointer = event => {
    if (!menu.contains(event.target)) finish();
  };
  const handleKeyDown = event => {
    if (event.key !== "Escape") return;

    event.preventDefault();
    finish();
  };
  const handleViewportChange = () => finish();

  activeRichTextImageMenu = {
    menu,
    hostDialog,
    usesPopover,
    handleOutsidePointer,
    handleKeyDown,
    handleViewportChange
  };
  document.addEventListener("pointerdown", handleOutsidePointer, true);
  document.addEventListener("keydown", handleKeyDown, true);
  window.addEventListener("resize", handleViewportChange, true);
  window.addEventListener("scroll", handleViewportChange, true);
  menu.querySelector("button")?.focus({ preventScroll: true });
}

function closeRichTextImageMenu() {
  if (!activeRichTextImageMenu) return;

  const {
    menu,
    hostDialog,
    usesPopover,
    handleOutsidePointer,
    handleKeyDown,
    handleViewportChange
  } = activeRichTextImageMenu;

  document.removeEventListener("pointerdown", handleOutsidePointer, true);
  document.removeEventListener("keydown", handleKeyDown, true);
  window.removeEventListener("resize", handleViewportChange, true);
  window.removeEventListener("scroll", handleViewportChange, true);
  if (usesPopover && menu.matches?.(":popover-open")) menu.hidePopover();
  hostDialog?.classList.remove("rich-image-menu-open");
  menu.remove();
  activeRichTextImageMenu = null;
}

function showRichTextOverlayAsPopover(overlay, hostDialog) {
  if (typeof overlay.showPopover !== "function") return false;

  overlay.setAttribute("popover", "manual");
  (hostDialog || document.body).appendChild(overlay);
  try {
    overlay.showPopover();
    return true;
  } catch {
    overlay.remove();
    overlay.removeAttribute("popover");
    return false;
  }
}

function richTextImageMenuItemHtml(action, icon, label) {
  return `
    <button type="button" class="rich-image-menu-item dropdown-menu-item" data-rich-image-action="${escapeAttr(action)}" role="menuitem">
      <span class="dropdown-menu-icon" aria-hidden="true">${icon}</span>
      <span class="dropdown-menu-label">${escapeHtml(label)}</span>
      <span class="dropdown-menu-check" aria-hidden="true"></span>
    </button>
  `;
}

function richTextImageMenuSeparatorHtml() {
  return `<div class="rich-image-menu-separator" role="separator"></div>`;
}

function positionRichTextImageMenu(menu, image, anchorEvent) {
  const margin = 8;
  const anchor = richTextImageMenuAnchor(image, anchorEvent);
  const maxLeft = Math.max(margin, window.innerWidth - menu.offsetWidth - margin);
  const maxTop = Math.max(margin, window.innerHeight - menu.offsetHeight - margin);
  const left = Math.max(margin, Math.min(anchor.x, maxLeft));
  const top = Math.max(margin, Math.min(anchor.y, maxTop));

  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;
}

function richTextImageMenuAnchor(image, anchorEvent) {
  const eventX = Number(anchorEvent?.clientX);
  const eventY = Number(anchorEvent?.clientY);
  if (Number.isFinite(eventX) && Number.isFinite(eventY)) {
    return { x: eventX, y: eventY };
  }

  const rect = image.getBoundingClientRect();
  return {
    x: rect.left + Math.min(24, Math.max(0, rect.width / 2)),
    y: rect.top + Math.min(24, Math.max(0, rect.height / 2))
  };
}

function selectRichTextImage(image) {
  const editor = image?.closest(".rich-editor");
  if (!image?.isConnected || !editor) return;

  editor.focus({ preventScroll: true });
  setRichTextImageBrowserSelection(image);
  showRichTextImageSelection(image, editor);
}

function setRichTextImageBrowserSelection(image) {
  const range = document.createRange();
  range.selectNode(image);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function showRichTextImageSelection(image, editor) {
  closeRichTextImageSelection();

  const overlay = document.createElement("div");
  overlay.className = "rich-image-selection";
  overlay.setAttribute("role", "group");
  overlay.setAttribute("aria-label", "Selected image resize handles");
  overlay.innerHTML = ["nw", "n", "ne", "e", "se", "s", "sw", "w"]
    .map(direction => `<span class="rich-image-selection-handle" data-rich-image-resize-handle="${direction}" aria-hidden="true"></span>`)
    .join("");

  const hostDialog = image.closest("dialog[open]");
  const usesPopover = showRichTextOverlayAsPopover(overlay, hostDialog);
  if (!usesPopover) (hostDialog || document.body).appendChild(overlay);
  hostDialog?.classList.add("rich-image-selection-open");

  const position = () => positionRichTextImageSelection(overlay, image, editor);
  const handleOutsidePointer = event => {
    if (event.target === image || overlay.contains(event.target)) return;
    closeRichTextImageSelection();
  };
  const handleKeyDown = event => {
    if (event.key !== "Escape") return;

    event.preventDefault();
    closeRichTextImageSelection();
    editor.focus({ preventScroll: true });
  };
  const handleViewportChange = () => {
    if (!image.isConnected) {
      closeRichTextImageSelection();
      return;
    }
    position();
  };
  const handleDialogClose = () => closeRichTextImageSelection();

  activeRichTextImageSelection = {
    image,
    editor,
    overlay,
    hostDialog,
    usesPopover,
    drag: null,
    handleOutsidePointer,
    handleKeyDown,
    handleViewportChange,
    handleDialogClose
  };

  overlay.addEventListener("pointerdown", startRichTextImageResize);
  overlay.addEventListener("pointermove", continueRichTextImageResize);
  overlay.addEventListener("pointerup", finishRichTextImageResize);
  overlay.addEventListener("pointercancel", finishRichTextImageResize);
  overlay.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
  });
  document.addEventListener("pointerdown", handleOutsidePointer, true);
  document.addEventListener("keydown", handleKeyDown, true);
  window.addEventListener("resize", handleViewportChange, true);
  window.addEventListener("scroll", handleViewportChange, true);
  hostDialog?.addEventListener("close", handleDialogClose);
  position();
}

function closeRichTextImageSelection() {
  if (!activeRichTextImageSelection) return;

  const {
    overlay,
    hostDialog,
    usesPopover,
    handleOutsidePointer,
    handleKeyDown,
    handleViewportChange,
    handleDialogClose
  } = activeRichTextImageSelection;

  document.removeEventListener("pointerdown", handleOutsidePointer, true);
  document.removeEventListener("keydown", handleKeyDown, true);
  window.removeEventListener("resize", handleViewportChange, true);
  window.removeEventListener("scroll", handleViewportChange, true);
  hostDialog?.removeEventListener("close", handleDialogClose);
  hostDialog?.classList.remove("rich-image-selection-open");
  if (usesPopover && overlay.matches?.(":popover-open")) overlay.hidePopover();
  overlay.remove();
  activeRichTextImageSelection = null;
}

function startRichTextImageResize(event) {
  const selection = activeRichTextImageSelection;
  const handle = event.target.closest("[data-rich-image-resize-handle]");
  if (!selection || !handle || !selection.overlay.contains(handle)) return;

  event.preventDefault();
  event.stopPropagation();
  const rect = selection.image.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  selection.drag = {
    pointerId: event.pointerId,
    handle,
    direction: handle.dataset.richImageResizeHandle,
    startX: event.clientX,
    startY: event.clientY,
    startWidth: rect.width,
    aspectRatio: rect.width / rect.height
  };
  selection.overlay.classList.add("is-resizing");
  handle.setPointerCapture?.(event.pointerId);
}

function continueRichTextImageResize(event) {
  const selection = activeRichTextImageSelection;
  const drag = selection?.drag;
  if (!drag || drag.pointerId !== event.pointerId) return;

  event.preventDefault();
  event.stopPropagation();
  const vector = richTextImageResizeVector(drag.direction, drag.aspectRatio);
  const distanceSquared = (vector.x * vector.x) + (vector.y * vector.y);
  const widthChange = distanceSquared
    ? (((event.clientX - drag.startX) * vector.x) + ((event.clientY - drag.startY) * vector.y)) / distanceSquared
    : 0;
  const width = richTextImageWidthValue(Math.max(16, drag.startWidth + widthChange));
  if (!width) return;

  applyRichTextImageWidth(selection.image, width);
  positionRichTextImageSelection(selection.overlay, selection.image, selection.editor);
}

function finishRichTextImageResize(event) {
  const selection = activeRichTextImageSelection;
  const drag = selection?.drag;
  if (!drag || drag.pointerId !== event.pointerId) return;

  event.preventDefault();
  event.stopPropagation();
  if (drag.handle.hasPointerCapture?.(event.pointerId)) drag.handle.releasePointerCapture(event.pointerId);
  selection.drag = null;
  selection.overlay.classList.remove("is-resizing");
  setRichTextImageBrowserSelection(selection.image);
}

function richTextImageResizeVector(direction, aspectRatio) {
  const safeAspectRatio = aspectRatio > 0 ? aspectRatio : 1;
  return {
    x: direction.includes("e") ? 1 : direction.includes("w") ? -1 : 0,
    y: direction.includes("s") ? 1 / safeAspectRatio : direction.includes("n") ? -1 / safeAspectRatio : 0
  };
}

function positionRichTextImageSelection(overlay, image, editor) {
  const rect = image.getBoundingClientRect();
  const editorRect = editor.getBoundingClientRect();
  const clipViewport = editor.closest(".dialog-body, .app-shell");
  const clipViewportRect = clipViewport?.getBoundingClientRect();
  const toolbar = editor.previousElementSibling?.matches?.(".rich-tools")
    ? editor.previousElementSibling
    : null;
  const toolbarRect = toolbar?.getBoundingClientRect();
  const handleClearance = 8;
  const visibleLeft = Math.max(0, editorRect.left, clipViewportRect?.left ?? 0);
  const visibleTop = Math.max(0, editorRect.top, clipViewportRect?.top ?? 0, toolbarRect?.bottom ?? 0);
  const visibleRight = Math.min(window.innerWidth, editorRect.right, clipViewportRect?.right ?? window.innerWidth);
  const visibleBottom = Math.min(window.innerHeight, editorRect.bottom, clipViewportRect?.bottom ?? window.innerHeight);

  overlay.style.left = `${rect.left}px`;
  overlay.style.top = `${rect.top}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;

  const isVisible = rect.right + handleClearance > visibleLeft
    && rect.left - handleClearance < visibleRight
    && rect.bottom + handleClearance > visibleTop
    && rect.top - handleClearance < visibleBottom;
  overlay.hidden = !isVisible;
  if (!isVisible) return;

  const clipTop = Math.max(-handleClearance, visibleTop - rect.top);
  const clipRight = Math.max(-handleClearance, rect.right - visibleRight);
  const clipBottom = Math.max(-handleClearance, rect.bottom - visibleBottom);
  const clipLeft = Math.max(-handleClearance, visibleLeft - rect.left);
  overlay.style.clipPath = `inset(${clipTop}px ${clipRight}px ${clipBottom}px ${clipLeft}px)`;
}

function deleteRichTextImage(image) {
  const editor = image?.closest(".rich-editor");
  if (!image?.isConnected || !editor) return;

  selectRichTextImage(image);
  const deleted = document.execCommand("delete");
  if (!deleted && image.isConnected) image.remove();
  closeRichTextImageSelection();
  showToast("Image removed.");
}

function showRichTextImageResizeDialog(image) {
  if (!image?.isConnected) return;

  closeRichTextImageSelection();

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
        <div class="dialog-action-group is-left">
          <button type="button" class="secondary text-icon-button" data-rich-image-resize-reset>${buttonContent("&#8634;", "Full Width")}</button>
        </div>
        <div class="dialog-action-group">
          <button type="button" class="secondary text-icon-button" data-rich-image-resize-cancel>${buttonContent("&#10005;", "Cancel")}</button>
          <button type="submit" class="primary text-icon-button">${buttonContent("&#10003;", "Apply")}</button>
        </div>
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
  return percent >= 10 && percent <= 200 && percent % 10 === 0 ? percent : "custom";
}

function richTextImageScaleOptionsHtml(selectedValue) {
  const selected = String(selectedValue || "custom");
  const options = [{ value: "custom", label: "Custom" }];
  for (let percent = 10; percent <= 200; percent += 10) {
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
  openRichTextSourceInNewTab(source);
}

function openRichTextSourceInNewTab(source) {
  if (!source) return;

  let targetUrl = appUrl(storageUrl(source));
  try {
    targetUrl = new URL(targetUrl, window.location.href).href;
  } catch {
    // Keep the normalized path when an unusual but browser-supported source is used.
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
      const expectedRowVersions = Object.fromEntries(
        taskIds.map(id => [id, taskById(id)?.rowVersion || null])
      );
      await saveJson("/api/tasks/reorder", "POST", { taskIds, expectedRowVersions });
    }

    if (drop.container.dataset.reorderList === "tasks") {
      tasksFeature.useCustomSort();
    }

    await loadState();
    render();
    showToast("Order saved.");
  } catch (error) {
    await loadState();
    render();
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
  hideEmptyReadOnlyFields(modal);
  initializeWindowedDialog(modal);
  modal.addEventListener("close", () => modal.remove(), { once: true });
  modal.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => modal.close()));
  modal.addEventListener("click", event => {
    const inlineButton = event.target.closest("[data-action='view-task-inline']");
    if (!inlineButton) return;
    const task = taskById(Number(inlineButton.dataset.id));
    updateWorkItemContentUrl(task);
    modal.close();
    viewWorkItem(task, editWorkItem, workItemDialogOptions());
  });
  modal.showModal();
  normalizeLinksInElement(modal);
  bindRichCodeBlocks(modal);
  bindRichCollapsibleBlocks(modal);
  hydrateRichDiagramOleBlocks(modal);
}

async function annotateRichTextImage(image) {
  const editor = image?.closest(".rich-editor");
  if (!image?.isConnected || !editor) return;

  closeRichTextImageSelection();
  const currentSource = storageUrl(image.getAttribute("src") || richTextImageSource(image));
  const isAnnotated = image.dataset.pmtAnnotationVersion === "1";
  const storedOriginalReference = storageUrl(image.dataset.pmtAnnotationSource || "");
  const originalReference = isAnnotated ? storedOriginalReference : currentSource;
  try {
    const result = await openImageAnnotationDialog({
      originalReference,
      originalUrl: isAnnotated ? "" : appUrl(originalReference),
      annotationUrl: isAnnotated ? appUrl(currentSource) : "",
      originalFileName: image.getAttribute("alt") || originalReference.split("/").pop() || "image",
      askForColor: current => askForText("HEX (#126BFF) or RGB (18, 107, 255)", "Custom Color", current),
      askForText,
      bindRichTextButtons,
      confirm: askYesNo,
      notify: showToast,
      uploadEmbeddedImage: uploadRichTextCanvasImage,
      portableImageSources: true,
      loadTemplateLibrary: () => api("/api/image-annotation/template-library", { cache: "no-store" }),
      loadDefaultTemplateLibrary: () => api("/api/image-annotation/default-template-library", { cache: "no-store" }),
      saveTemplateLibrary: library => saveJson("/api/image-annotation/template-library", "PUT", library),
      persistCroppedOriginal: uploadRichTextCanvasImage,
      apply: async annotation => {
        if (!image.isConnected) throw new Error("The rich-text editor is no longer open.");
        const file = new File([annotation.svg], annotation.fileName, { type: "image/svg+xml" });
        const upload = await uploadFile("richtext", file);
        const annotationSource = appUrl(upload.url);
        if (!image.isConnected) throw new Error("The rich-text editor is no longer open.");
        image.setAttribute("src", annotationSource);
        if (annotation.originalReference) image.dataset.pmtAnnotationSource = annotation.originalReference;
        else image.removeAttribute("data-pmt-annotation-source");
        image.dataset.pmtAnnotationVersion = String(annotation.state.version || 1);
        image.classList.add("rich-svg-image", "pmt-annotation-image");
        image.setAttribute("alt", image.getAttribute("alt") || "Annotated image");
      }
    });
    if (!result || !image.isConnected) return;
    editor.focus({ preventScroll: true });
    setRichTextImageBrowserSelection(image);
    showToast("Image annotation applied. Save the record to keep it.");
  } catch (error) {
    showToast(error.message || "The image annotation could not be applied.");
  }
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
      ${field("Current Password", "currentPassword", "", "password", "", "", "", { required: true })}
      ${field("New Password", "newPassword", "", "password", "", "", "", { required: true })}
    </div>
  `, async root => {
    await saveJson("/api/change-password", "POST", {
      currentPassword: value(root, "currentPassword"),
      newPassword: value(root, "newPassword")
    });
  });
}

function resetUserPassword(user) {
  if (!user?.id) return;
  if (dialog.open) dialog.close();

  openEditor(`Change Password for ${user.nickname || "User"}`, `
    <div class="form-grid">
      ${field("New Password", "newPassword", "", "password", "", "", "", { required: true })}
      ${field("Confirm Password", "confirmPassword", "", "password", "", "", "", { required: true })}
    </div>
  `, async root => {
    const newPassword = value(root, "newPassword");
    if (newPassword !== value(root, "confirmPassword")) {
      throw new Error("The passwords do not match.");
    }

    await saveJson(`/api/users/${user.id}/password`, "PUT", { newPassword });
  }, "newPassword");
}

function openEditor(title, html, saveAction, focusName = "", afterOpen = null) {
  resetEditorDialogWindow();
  dialogTitle.textContent = title;
  delete dialogBody.dataset.devTaskPercentRules;
  dialogBody.innerHTML = html;
  normalizeLinksInElement(dialogBody);
  moveEditorHeadActions();
  moveEditorFooterActions();
  if (afterOpen) afterOpen(dialogBody);
  bindRichTextButtons(dialogBody);
  configureEditorDialogRichToolbarToggle();
  bindTaskPercentRules(dialogBody);
  bindAttachmentPreview(dialogBody);
  bindAttachmentDeletion(dialogBody, deleteAttachment);
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
  if (toggleAllRichToolsButton) toggleAllRichToolsButton.hidden = true;
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
  root.querySelectorAll("[data-rich-toolbar-toggle]").forEach(button => {
    const toolbar = button.closest(".rich-tools");
    if (!toolbar) return;

    syncRichToolbarToggle(toolbar);
    button.addEventListener("mousedown", event => event.preventDefault());
    button.addEventListener("click", event => {
      event.preventDefault();
      setRichToolbarCollapsed(toolbar, !toolbar.classList.contains("is-collapsed"));
      syncEditorDialogRichToolbarToggle();
    });
  });

  root.querySelectorAll("[data-rich-source]").forEach(button => {
    button.addEventListener("mousedown", event => event.preventDefault());
    button.addEventListener("click", () => {
      const editor = richEditorForControl(button);
      if (editor) openRichSourceDialog(editor);
    });
  });

  root.querySelectorAll("[data-rich-clear-formatting]").forEach(button => {
    button.addEventListener("mousedown", event => event.preventDefault());
    button.addEventListener("click", async () => {
      const editor = richEditorForControl(button);
      if (!editor) return;

      const confirmed = await askYesNo("Clear all formatting from this body and keep only plain text?", "Clear Formatting");
      if (!confirmed) return;

      editor.innerHTML = richPlainTextHtml(editor.innerText || editor.textContent || "");
      editor.focus();
    });
  });

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
        insertRichHtmlAtSelection(editor, richCodeBlockHtml(codeBlock));
        bindRichCodeBlocks(editor);
        return;
      }

      if (command === "insertCollapsible") {
        const section = await askForCollapsibleBlock();
        if (!section) return;
        editor.focus();
        restoreEditorSelection(savedSelection);
        insertRichHtmlAtSelection(editor, richCollapsibleBlockHtml({
          title: section.title,
          contents: editorSelectionHtml(savedSelection),
          readOnlyOpen: section.readOnlyOpen
        }));
        bindRichCollapsibleBlocks(editor);
        hydrateRichDiagramOleBlocks(editor);
        return;
      }

      if (command === "insertHorizontalRule") {
        document.execCommand("insertHTML", false, "<hr><p><br></p>");
        return;
      }

      if (command === "insertRichTable") {
        const size = await askRichTableSize();
        if (!size) return;

        editor.focus();
        restoreEditorSelection(savedSelection);
        document.execCommand("insertHTML", false, richTableHtml(size.rows, size.columns));
        syncRichTableToolbars();
        return;
      }

      if (command === "insertCheckbox") {
        document.execCommand("insertHTML", false, richCheckboxHtml());
        bindRichCheckboxes(editor);
        return;
      }

      if (command === "insertSvg") {
        const svgFile = await askRichSvgFile();
        if (!svgFile) return;

        editor.focus();
        restoreEditorSelection(savedSelection);
        try {
          await insertRichUploadedImage(editor, svgFile);
        } catch (error) {
          showToast(error.message || "SVG could not be inserted.");
        }
        return;
      }

      if (command === "insertDiagram") {
        await insertRichTextDiagram(editor, savedSelection);
        return;
      }

      if (command === "insertLinkedDiagram") {
        await insertRichLinkedDiagram(editor, savedSelection);
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

  root.querySelectorAll("[data-rich-font]").forEach(select => {
    let savedSelection = null;

    select.addEventListener("mousedown", () => {
      const editor = richEditorForControl(select);
      savedSelection = editor ? saveEditorSelection(editor) : null;
    });

    select.addEventListener("change", () => {
      const editor = richEditorForControl(select);
      const fontName = select.value;
      select.value = "";
      if (!editor || !fontName) return;

      editor.focus();
      restoreEditorSelection(savedSelection || saveEditorSelection(editor));
      document.execCommand("fontName", false, fontName);
      savedSelection = null;
    });
  });

  root.querySelectorAll("[data-rich-font-size]").forEach(select => {
    let savedSelection = null;

    select.addEventListener("mousedown", () => {
      const editor = richEditorForControl(select);
      savedSelection = editor ? saveEditorSelection(editor) : null;
    });

    select.addEventListener("change", () => {
      const editor = richEditorForControl(select);
      const fontSize = select.value;
      select.value = "";
      if (!editor || !fontSize) return;

      editor.focus();
      restoreEditorSelection(savedSelection || saveEditorSelection(editor));
      document.execCommand("fontSize", false, fontSize);
      savedSelection = null;
    });
  });

  root.querySelectorAll("[data-rich-table-command]").forEach(button => {
    button.addEventListener("mousedown", event => event.preventDefault());
    button.addEventListener("click", async event => {
      event.preventDefault();

      const editor = richEditorForControl(button);
      if (!editor) return;

      editor.focus();
      const handled = await applyRichTableCommand(editor, button.dataset.richTableCommand);
      if (!handled) showToast("Place the cursor inside a table first.");
      syncRichTableToolbars();
    });
  });

  const richColorTools = [...root.querySelectorAll(".rich-color-tool")];
  richColorTools.forEach(tool => {
    const trigger = tool.querySelector("[data-rich-color-command]");
    const palette = tool.querySelector("[data-rich-color-palette]");
    if (!trigger || !palette) return;

    let savedSelection = null;
    const defaultColor = trigger.dataset.richColorDefault || "#111827";
    const command = trigger.dataset.richColorCommand || "foreColor";
    const syncColorSwatch = color => {
      const nextColor = normalizeRichCustomColor(color) || defaultColor;
      tool.style.setProperty("--rich-selected-color", nextColor);
      trigger.dataset.richSelectedColor = nextColor;
    };
    const applyColor = color => {
      const editor = richEditorForControl(trigger);
      if (!editor || !color) return;

      const nextColor = normalizeRichCustomColor(color) || defaultColor;
      syncColorSwatch(nextColor);
      editor.focus();
      restoreEditorSelection(savedSelection || saveEditorSelection(editor));
      applyRichColorCommand(command, nextColor, editor);
      rememberRichLastColor(command, nextColor);
      renderRichColorMemoryPalettes(root);
      closeRichColorTool(tool);
      savedSelection = null;
    };
    syncColorSwatch(readRichLastColor(command, defaultColor));

    trigger.addEventListener("mousedown", event => {
      event.preventDefault();
      const editor = richEditorForControl(trigger);
      savedSelection = editor ? saveEditorSelection(editor) : null;
    });

    trigger.addEventListener("click", event => {
      event.preventDefault();
      if (richColorTriggerApplyHalf(event, trigger)) {
        applyColor(readRichLastColor(command, trigger.dataset.richSelectedColor || defaultColor));
        return;
      }

      const shouldOpen = !tool.classList.contains("is-open");
      closeRichColorPalettes(root);
      if (shouldOpen) openRichColorTool(tool);
    });

    renderRichColorMemoryPalettes(root);

    palette.addEventListener("mousedown", event => {
      if (event.target.closest("[data-rich-color-value], [data-rich-color-custom]")) event.preventDefault();
    });

    palette.addEventListener("click", event => {
      const colorButton = event.target.closest("[data-rich-color-value]");
      if (!colorButton || !palette.contains(colorButton)) return;

      event.preventDefault();
      applyColor(colorButton.dataset.richColorValue || defaultColor);
    });

    palette.querySelector("[data-rich-color-custom]")?.addEventListener("click", async event => {
      event.preventDefault();
      closeRichColorTool(tool);

      const currentColor = trigger.dataset.richSelectedColor || defaultColor;
      const customColor = await askForText("HEX (#126BFF) or RGB (18, 107, 255)", "Custom Color", currentColor);
      if (!customColor) {
        savedSelection = null;
        return;
      }

      const normalizedColor = normalizeRichCustomColor(customColor);
      if (!normalizedColor) {
        savedSelection = null;
        showToast("Enter a valid HEX or RGB color.");
        return;
      }

      rememberRichCustomColor(normalizedColor);
      renderRichColorMemoryPalettes(root);
      applyColor(normalizedColor);
    });
  });

  if (richColorTools.length && root.dataset.richColorPaletteBound !== "true") {
    root.dataset.richColorPaletteBound = "true";
    root.addEventListener("mousedown", event => {
      if (!event.target.closest(".rich-color-tool")) closeRichColorPalettes(root);
    });
    root.addEventListener("keydown", event => {
      if (event.key !== "Escape" || !root.querySelector(".rich-color-tool.is-open")) return;

      event.preventDefault();
      event.stopPropagation();
      closeRichColorPalettes(root);
    });
  }

  root.querySelectorAll(".rich-editor").forEach(editor => {
    bindRichCheckboxes(editor);
    bindRichTableSelectionTracking(editor);
    bindRichCheckboxShortcut(editor);

    editor.addEventListener("paste", async event => {
      const pasteSelection = saveEditorSelection(editor);
      const svgFile = richSvgFileFromClipboard(event.clipboardData);
      if (svgFile) {
        event.preventDefault();
        editor.focus();
        try {
          await insertRichUploadedImage(editor, svgFile, pasteSelection);
        } catch (error) {
          showToast(error.message || "SVG could not be inserted.");
        }
        return;
      }

      const imageFiles = richImageFilesFromClipboard(event.clipboardData);
      if (!imageFiles.length) {
        const dataImageHtml = richClipboardDataImageHtml(event.clipboardData);
        if (!dataImageHtml) return;

        event.preventDefault();
        editor.focus();
        try {
          const result = await externalizeImportedHtmlImages(dataImageHtml);
          if (result.failed) throw new Error("The pasted image could not be uploaded.");
          restoreEditorSelection(pasteSelection);
          document.execCommand("insertHTML", false, result.html);
        } catch (error) {
          showToast(error.message || "Image could not be inserted.");
        }
        return;
      }

      event.preventDefault();
      editor.focus();

      let insertionSelection = pasteSelection;
      for (const file of imageFiles) {
        try {
          await insertRichUploadedImage(editor, file, insertionSelection);
          insertionSelection = saveEditorSelection(editor);
        } catch (error) {
          showToast(error.message || "Image could not be inserted.");
        }
      }
    });

    editor.addEventListener("dragover", event => {
      if (!richImageFilesFromClipboard(event.dataTransfer).length) return;
      event.preventDefault();
    });

    editor.addEventListener("drop", async event => {
      const imageFiles = richImageFilesFromClipboard(event.dataTransfer);
      if (!imageFiles.length) return;

      event.preventDefault();
      editor.focus();
      const dropRange = richCaretRangeFromPoint(event.clientX, event.clientY);
      if (dropRange && editor.contains(dropRange.startContainer)) {
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(dropRange);
      }

      let insertionSelection = saveEditorSelection(editor);
      for (const file of imageFiles) {
        try {
          await insertRichUploadedImage(editor, file, insertionSelection);
          insertionSelection = saveEditorSelection(editor);
        } catch (error) {
          showToast(error.message || "Image could not be inserted.");
        }
      }
    });
  });

  bindRichCodeBlocks(root);
  bindRichCollapsibleBlocks(root);
  hydrateRichDiagramOleBlocks(root);
  bindRichCheckboxes(root);
  bindGlobalRichCheckboxSync();
}

function bindRichCollapsibleBlocks(root) {
  const blocks = [];
  if (root?.matches?.(".rich-collapsible-block")) blocks.push(root);
  root?.querySelectorAll?.(".rich-collapsible-block").forEach(block => blocks.push(block));
  blocks.forEach(block => {
    ensureRichCollapsibleBlock(block);
  });
  if (!root.dataset || root.dataset.richCollapsibleBlocksBound === "true") return;

  root.dataset.richCollapsibleBlocksBound = "true";
  root.addEventListener("pointerdown", handleRichCollapsibleActionPointerDown, true);
  root.addEventListener("mousedown", handleRichCollapsibleActionPointerDown, true);
  root.addEventListener("click", handleRichCollapsibleAction, true);
}

function bindGlobalRichCollapsibleBlocks() {
  if (document.body.dataset.richCollapsibleBlocksObserverBound === "true") return;

  document.body.dataset.richCollapsibleBlocksObserverBound = "true";
  let pending = false;
  const decorate = () => {
    pending = false;
    bindRichCollapsibleBlocks(document.body);
  };
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    queueMicrotask(decorate);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  decorate();
}

const richCollapsibleReadonlyInitialAppliedBlocks = new WeakSet();

function ensureRichCollapsibleBlock(block) {
  const editable = Boolean(block.closest(".rich-editor"));
  ensureRichCollapsibleBlockId(block, editable);
  applyRichCollapsibleReadonlyInitialState(block, editable);
  if (block.dataset.richCollapsibleToggleBound !== "true") {
    block.dataset.richCollapsibleToggleBound = "true";
    block.addEventListener("toggle", () => {
      if (!block.closest(".rich-editor")) rememberRichCollapsibleBlockOpen(block, block.open);
      if (!block.open) return;
      refreshRichDiagramOleBlocks(block);
    });
  }

  const summary = block.querySelector(":scope > summary");
  if (!summary) return;

  let existingActions = summary.querySelector(":scope > .rich-collapsible-actions");
  if (!editable) {
    existingActions?.remove();
    existingActions = null;
  }
  let caption = summary.querySelector(":scope > .rich-collapsible-title");
  if (!caption) {
    caption = document.createElement("span");
    caption.className = "rich-collapsible-title";
    const nodes = [...summary.childNodes].filter(node => !(node.nodeType === Node.ELEMENT_NODE && node.classList?.contains("rich-collapsible-actions")));
    nodes.forEach(node => caption.appendChild(node));
    summary.insertBefore(caption, existingActions || null);
  }
  if (summary.dataset.richCollapsibleStateClickBound !== "true") {
    summary.dataset.richCollapsibleStateClickBound = "true";
    summary.addEventListener("click", () => {
      if (block.closest(".rich-editor")) return;
      requestAnimationFrame(() => rememberRichCollapsibleBlockOpen(block, block.open));
    });
  }
  if (!editable) return;

  if (existingActions?.dataset.richCollapsibleEditable === String(editable)) {
    syncRichCollapsibleReadonlyOpenAction(block);
    return;
  }
  existingActions?.remove();

  const actions = document.createElement("span");
  actions.className = "rich-collapsible-actions";
  actions.dataset.richCollapsibleEditable = "true";
  actions.setAttribute("contenteditable", "false");
  actions.innerHTML = `
    <button type="button" class="rich-collapsible-action" data-rich-collapsible-action="toggle-readonly-open"></button>
    <button type="button" class="rich-collapsible-action rich-collapsible-delete-action" data-rich-collapsible-action="delete" title="Delete expand/collapse section" aria-label="Delete expand/collapse section">&#128465;</button>
  `;
  summary.appendChild(actions);
  syncRichCollapsibleReadonlyOpenAction(block);
}

function applyRichCollapsibleReadonlyInitialState(block, editable) {
  if (editable || richCollapsibleReadonlyInitialAppliedBlocks.has(block)) return;
  block.removeAttribute("data-rich-collapsible-readonly-initial-applied");
  const storedOpen = readRichCollapsibleBlockStoredOpen(block);
  if (storedOpen !== null) {
    block.open = storedOpen;
    richCollapsibleReadonlyInitialAppliedBlocks.add(block);
    block.dataset.richCollapsibleReadonlyInitialApplied = "true";
    if (block.open) refreshRichDiagramOleBlocks(block);
    return;
  }

  const setting = block.dataset.collapsibleReadonlyOpen;
  if (setting !== "true" && setting !== "false") return;

  block.open = setting === "true";
  richCollapsibleReadonlyInitialAppliedBlocks.add(block);
  block.dataset.richCollapsibleReadonlyInitialApplied = "true";
  if (block.open) refreshRichDiagramOleBlocks(block);
}

function richCollapsibleReadonlyOpen(block) {
  const setting = block.dataset.collapsibleReadonlyOpen;
  if (setting === "false") return false;
  if (setting === "true") return true;
  return block.hasAttribute("open");
}

function setRichCollapsibleReadonlyOpen(block, readOnlyOpen) {
  block.dataset.collapsibleReadonlyOpen = readOnlyOpen ? "true" : "false";
  syncRichCollapsibleReadonlyOpenAction(block);
}

function syncRichCollapsibleReadonlyOpenAction(block) {
  const button = block.querySelector(":scope > summary > .rich-collapsible-actions [data-rich-collapsible-action='toggle-readonly-open']");
  if (!button) return;

  const readOnlyOpen = richCollapsibleReadonlyOpen(block);
  const label = readOnlyOpen ? "Starts Open" : "Starts Collapsed";
  if (button.textContent !== label) button.textContent = label;
  button.setAttribute("aria-pressed", String(readOnlyOpen));
  button.setAttribute("title", readOnlyOpen
    ? "Read-only mode starts expanded. Click to start collapsed."
    : "Read-only mode starts collapsed. Click to start expanded.");
  button.setAttribute("aria-label", readOnlyOpen
    ? "Read-only mode starts expanded"
    : "Read-only mode starts collapsed");
}

function handleRichCollapsibleActionPointerDown(event) {
  const button = event.target.closest?.("[data-rich-collapsible-action]");
  if (!button) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
}

function handleRichCollapsibleAction(event) {
  const button = event.target.closest?.("[data-rich-collapsible-action]");
  if (!button) return;

  const block = button.closest(".rich-collapsible-block");
  const editor = block?.closest(".rich-editor");
  if (!block || !editor) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();

  if (button.dataset.richCollapsibleAction === "toggle-readonly-open") {
    setRichCollapsibleReadonlyOpen(block, !richCollapsibleReadonlyOpen(block));
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    showToast(`Expand/Collapse section will start ${richCollapsibleReadonlyOpen(block) ? "expanded" : "collapsed"} in read-only mode.`);
    return;
  }

  if (button.dataset.richCollapsibleAction === "delete") {
    deleteRichCollapsibleBlock(editor, block);
  }
}

function deleteRichCollapsibleBlock(editor, block) {
  if (!editor?.contains(block) || !block?.isConnected) return;

  const blankLine = richBlankParagraphSibling(block.nextElementSibling) || document.createElement("p");
  if (!blankLine.isConnected) blankLine.innerHTML = "<br>";

  if (blankLine.parentElement === block.parentElement) {
    block.remove();
  } else {
    block.replaceWith(blankLine);
  }

  placeCaretInRichBlock(editor, blankLine);
  editor.dispatchEvent(new Event("input", { bubbles: true }));
}

function ensureRichCollapsibleBlockId(block, editable) {
  if (String(block.dataset.collapsibleId || "").trim()) return;
  if (!editable) return;
  block.dataset.collapsibleId = createRichCollapsibleBlockId();
}

function createRichCollapsibleBlockId(usedBlockIds = new Set()) {
  let blockId = "";
  do {
    blockId = `pmt-collapse-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  } while (usedBlockIds.has(blockId));
  return blockId;
}

function readRichCollapsibleBlockStoredOpen(block) {
  return readRichToggleableBlockStoredOpen(block, {
    kind: "collapsible",
    selector: ".rich-collapsible-block",
    datasetIdName: "collapsibleId"
  });
}

function rememberRichCollapsibleBlockOpen(block, open) {
  rememberRichToggleableBlockOpen(block, open, {
    kind: "collapsible",
    selector: ".rich-collapsible-block",
    datasetIdName: "collapsibleId"
  });
}

function readRichToggleableBlockStoredOpen(block, options) {
  if (block.closest(".rich-editor")) return null;
  try {
    const value = localStorage.getItem(richToggleableBlockStorageKey(block, options));
    return value === null ? null : value === "true";
  } catch {
    return null;
  }
}

function rememberRichToggleableBlockOpen(block, open, options) {
  if (block.closest(".rich-editor")) return;
  try {
    localStorage.setItem(richToggleableBlockStorageKey(block, options), open ? "true" : "false");
  } catch {
    // Expand/collapse memory is optional.
  }
}

function richToggleableBlockStorageKey(block, options) {
  const persist = block.closest("[data-rich-persist-type]");
  const persistType = persist?.dataset.richPersistType || "draft";
  const documentId = persist?.dataset.richPersistId || "draft";
  const field = persist?.dataset.richPersistField || "bodyHtml";
  return `pmt-rich-${options.kind}-open:${persistType}:${documentId}:${field}:${richToggleableBlockIdentity(block, options)}`;
}

function richToggleableBlockIdentity(block, options) {
  const blockId = String(block.dataset[options.datasetIdName] || "").trim();
  if (blockId) return `id:${blockId}`;

  const scope = block.closest("[data-rich-persist-type]") || block.parentElement || document.body;
  const blocks = [...scope.querySelectorAll(options.selector)];
  const index = Math.max(0, blocks.indexOf(block));
  return `index:${index}`;
}

function refreshRichDiagramOleBlocks(root) {
  const blocks = [];
  if (root?.matches?.("[data-pmt-ole='diagram']")) blocks.push(root);
  root?.querySelectorAll?.("[data-pmt-ole='diagram']").forEach(block => blocks.push(block));
  blocks.forEach(block => {
    delete block.dataset.diagramOleHydratedKey;
    delete block.dataset.diagramOleViewerBound;
    hydrateRichDiagramOleBlock(block);
  });
  requestAnimationFrame(() => blocks.forEach(block => hydrateRichDiagramOleBlock(block)));
}

const richCodeReadonlyInitialAppliedBlocks = new WeakSet();

function bindRichCodeBlocks(root) {
  const childBlocks = root.querySelectorAll ? [...root.querySelectorAll(".rich-code-block")] : [];
  const blocks = [
    ...(root.matches?.(".rich-code-block") ? [root] : []),
    ...childBlocks
  ];
  blocks.forEach(ensureRichCodeBlockActions);
  if (!root.dataset || root.dataset.richCodeBlocksBound === "true") return;

  root.dataset.richCodeBlocksBound = "true";
  root.addEventListener("pointerdown", handleRichCodeBlockActionPointerDown, true);
  root.addEventListener("mousedown", handleRichCodeBlockActionPointerDown, true);
  root.addEventListener("click", handleRichCodeBlockAction, true);
}

function bindGlobalRichCodeBlockActions() {
  if (document.body.dataset.richCodeBlocksObserverBound === "true") return;

  document.body.dataset.richCodeBlocksObserverBound = "true";
  let pending = false;
  const decorate = () => {
    pending = false;
    bindRichCodeBlocks(document.body);
  };
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    queueMicrotask(decorate);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  decorate();
}

function handleRichCodeBlockActionPointerDown(event) {
  const button = event.target.closest?.("[data-rich-code-action]");
  if (!button) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
}

async function handleRichCodeBlockAction(event) {
  const button = event.target.closest?.("[data-rich-code-action]");
  if (!button) return;

  const block = button.closest(".rich-code-block");
  if (!block) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();

  const action = button.dataset.richCodeAction || "";
  const editor = block.closest(".rich-editor");
  const data = richCodeBlockData(block);

  if (action === "copy") {
    const copied = await copyHtmlToClipboard(richCodeClipboardHtml(block), data.code, button);
    showToast(copied ? "Code block copied." : "The code block could not be copied.");
    return;
  }

  if (!editor) return;

  if (action === "edit") {
    const updated = await askForCodeBlock(data.code, {
      caption: data.caption,
      language: data.language,
      readOnlyOpen: data.readOnlyOpen,
      blockId: data.blockId,
      actionLabel: "Save"
    });
    if (!updated) return;

    const template = document.createElement("template");
    template.innerHTML = richCodeBlockHtml({ ...updated, blockId: data.blockId }).trim();
    const nextBlock = template.content.querySelector(".rich-code-block");
    if (!nextBlock) return;

    block.replaceWith(nextBlock);
    bindRichCodeBlocks(nextBlock);
    editor.focus({ preventScroll: true });
    return;
  }

  if (action === "delete") {
    deleteRichCodeBlock(editor, block);
    return;
  }
}

function deleteRichCodeBlock(editor, block) {
  if (!editor?.contains(block) || !block?.isConnected) return;

  const blankLine = richBlankParagraphSibling(block.nextElementSibling) || document.createElement("p");
  if (!blankLine.isConnected) blankLine.innerHTML = "<br>";

  if (blankLine.parentElement === block.parentElement) {
    block.remove();
  } else {
    block.replaceWith(blankLine);
  }

  placeCaretInRichBlock(editor, blankLine);
  editor.dispatchEvent(new Event("input", { bubbles: true }));
}

function richBlankParagraphSibling(node) {
  if (!(node instanceof HTMLParagraphElement)) return null;

  const clone = node.cloneNode(true);
  clone.querySelectorAll("br").forEach(child => child.remove());
  const html = clone.innerHTML.replace(/&nbsp;/gi, "").replace(/\s+/g, "");
  return html ? null : node;
}

function placeCaretInRichBlock(editor, block) {
  const range = document.createRange();
  range.selectNodeContents(block || editor);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  editor.focus({ preventScroll: true });
}

function ensureRichCodeBlockActions(block) {
  const summary = block.querySelector(":scope > summary");
  if (!summary) return;

  const editable = Boolean(block.closest(".rich-editor"));
  ensureRichCodeBlockId(block, editable);
  applyRichCodeBlockReadonlyInitialState(block, editable);
  if (block.dataset.richCodeToggleBound !== "true") {
    block.dataset.richCodeToggleBound = "true";
    block.addEventListener("toggle", () => {
      if (!block.closest(".rich-editor")) rememberRichCodeBlockOpen(block, block.open);
    });
  }

  const existingActions = summary.querySelector(":scope > .rich-code-actions");
  if (existingActions?.dataset.richCodeEditable === String(editable)) return;
  existingActions?.remove();

  let caption = summary.querySelector(".rich-code-caption");
  if (!caption) {
    caption = document.createElement("span");
    caption.className = "rich-code-caption";
    while (summary.firstChild) caption.appendChild(summary.firstChild);
    summary.appendChild(caption);
  }
  if (summary.dataset.richCodeStateClickBound !== "true") {
    summary.dataset.richCodeStateClickBound = "true";
    summary.addEventListener("click", () => {
      if (block.closest(".rich-editor")) return;
      requestAnimationFrame(() => rememberRichCodeBlockOpen(block, block.open));
    });
  }

  const actions = document.createElement("span");
  actions.className = "rich-code-actions";
  actions.dataset.richCodeEditable = String(editable);
  actions.setAttribute("contenteditable", "false");
  actions.innerHTML = `
    <button type="button" class="rich-code-action" data-rich-code-action="copy" title="Copy code" aria-label="Copy code">&#128203;</button>
    ${editable ? `<button type="button" class="rich-code-action" data-rich-code-action="edit" title="Edit code block" aria-label="Edit code block">&#9998;</button>` : ""}
    ${editable ? `<button type="button" class="rich-code-action rich-code-delete-action" data-rich-code-action="delete" title="Delete code block" aria-label="Delete code block">&#128465;</button>` : ""}
  `;
  summary.appendChild(actions);
}

function applyRichCodeBlockReadonlyInitialState(block, editable) {
  if (editable || richCodeReadonlyInitialAppliedBlocks.has(block)) return;
  block.removeAttribute("data-rich-code-readonly-initial-applied");

  const storedOpen = readRichCodeBlockStoredOpen(block);
  block.open = storedOpen ?? (block.dataset.codeReadonlyOpen === "true");
  richCodeReadonlyInitialAppliedBlocks.add(block);
  block.dataset.richCodeReadonlyInitialApplied = "true";
}

function richCodeBlockData(block) {
  const summary = block.querySelector(":scope > summary");
  const summaryCopy = summary?.cloneNode(true);
  summaryCopy?.querySelector(".rich-code-actions")?.remove();
  const code = block.querySelector(":scope > pre > code");

  return {
    caption: summaryCopy?.textContent?.trim() || "Code",
    code: code?.textContent || "",
    language: code?.getAttribute("data-code-language") || "",
    readOnlyOpen: block.dataset.codeReadonlyOpen === "true",
    blockId: block.dataset.codeBlockId || ""
  };
}

function ensureRichCodeBlockId(block, editable) {
  if (String(block.dataset.codeBlockId || "").trim()) return;
  if (!editable) return;
  block.dataset.codeBlockId = createRichCodeBlockId();
}

function createRichCodeBlockId(usedBlockIds = new Set()) {
  let blockId = "";
  do {
    blockId = `pmt-code-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  } while (usedBlockIds.has(blockId));
  return blockId;
}

function readRichCodeBlockStoredOpen(block) {
  return readRichToggleableBlockStoredOpen(block, {
    kind: "code",
    selector: ".rich-code-block",
    datasetIdName: "codeBlockId"
  });
}

function rememberRichCodeBlockOpen(block, open) {
  rememberRichToggleableBlockOpen(block, open, {
    kind: "code",
    selector: ".rich-code-block",
    datasetIdName: "codeBlockId"
  });
}

function richTableHtml(rows, columns) {
  const safeRows = clampNumber(Number(rows || 0), 1, richTableMaxSize);
  const safeColumns = clampNumber(Number(columns || 0), 1, richTableMaxSize);
  const cells = Array.from({ length: safeColumns }, () => `<td><p><br></p></td>`).join("");
  const bodyRows = Array.from({ length: safeRows }, () => `<tr>${cells}</tr>`).join("");

  return `<table class="rich-table"><tbody>${bodyRows}</tbody></table><p><br></p>`;
}

function richCheckboxHtml() {
  return `<label class="rich-check-item"><input type="checkbox"> <span>Checkbox item</span></label><p><br></p>`;
}

function richCheckboxShortcutHtml(markerId, wrappers = [], styleText = "") {
  const styleAttr = styleText ? ` style="${escapeAttr(styleText)}"` : "";
  const labelTextHtml = richInlineWrapperHtml(wrappers, `<span${styleAttr}>&nbsp;<span data-rich-checkbox-shortcut-caret="${escapeAttr(markerId)}"></span></span>`);
  return `<label class="rich-check-item"><input type="checkbox"> <span>${labelTextHtml}</span></label>`;
}

function bindRichCheckboxShortcut(editor) {
  if (editor.dataset.richCheckboxShortcutBound === "true") return;

  editor.dataset.richCheckboxShortcutBound = "true";
  editor.addEventListener("input", event => {
    if (event.inputType !== "insertText" || event.data !== " ") return;
    applyRichCheckboxShortcut(editor);
  });
}

function moveEditorHeadActions() {
  const editorDialogHeadActions = dialog.querySelector(".dialog-head-actions");
  if (!editorDialogHeadActions) return;

  restoreEditorHeaderOverflowActions(editorDialogHeadActions);
  editorDialogHeadActions.querySelectorAll("[data-editor-dynamic-head-action]").forEach(action => action.remove());
  dialogBody.querySelectorAll("template[data-editor-head-action]").forEach(template => {
    const headAction = template.content.cloneNode(true);
    [...headAction.children].forEach(child => {
      child.dataset.editorDynamicHeadAction = "true";
    });
    editorDialogHeadActions.prepend(...headAction.children);
    template.remove();
  });
}

function restoreEditorHeaderOverflowActions(root) {
  root.querySelectorAll("[data-work-item-dialog-header-menu], [data-bug-dialog-header-menu]").forEach(menu => menu.remove());
  root.querySelectorAll("[data-dialog-overflow-source]").forEach(source => {
    source.hidden = source.dataset.dialogOverflowOriginalHidden === "true";
    delete source.dataset.dialogOverflowOriginalHidden;
    delete source.dataset.dialogOverflowSource;
  });
}

function applyRichCheckboxShortcut(editor) {
  const range = richSelectionRangeForEditor(editor);
  if (!range?.collapsed) return false;

  const selectionElement = range.endContainer.nodeType === Node.ELEMENT_NODE
    ? range.endContainer
    : range.endContainer.parentElement;
  if (selectionElement?.closest(".rich-check-item")) return false;

  const shortcutRange = richRangeForTextBeforeCaret(editor, range, "[] ");
  if (!shortcutRange) return false;

  const markerId = `richCheckboxShortcut${Date.now()}${Math.floor(Math.random() * 100000)}`;
  const wrappers = richInlineWrappersForRange(editor, range);
  const styleText = richInlineComputedStyleForRange(editor, range);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(shortcutRange);
  document.execCommand("insertHTML", false, richCheckboxShortcutHtml(markerId, wrappers, styleText));
  bindRichCheckboxes(editor);
  placeRichCheckboxShortcutCaret(editor, markerId);
  return true;
}

function richInlineComputedStyleForRange(editor, range) {
  const element = range.endContainer.nodeType === Node.ELEMENT_NODE
    ? range.endContainer
    : range.endContainer.parentElement;
  const target = element && editor.contains(element) ? element : editor;
  const style = getComputedStyle(target);
  const properties = ["font-family", "font-size", "font-weight", "font-style", "color"];
  const backgroundColor = style.getPropertyValue("background-color");
  const textDecoration = style.getPropertyValue("text-decoration-line");
  const inlineStyles = properties
    .map(property => `${property}: ${style.getPropertyValue(property)}`)
    .filter(value => !value.endsWith(": "));

  if (backgroundColor && !["transparent", "rgba(0, 0, 0, 0)"].includes(backgroundColor)) {
    inlineStyles.push(`background-color: ${backgroundColor}`);
  }
  if (textDecoration && textDecoration !== "none") {
    inlineStyles.push(`text-decoration-line: ${textDecoration}`);
  }

  return inlineStyles.join("; ");
}

function richInlineWrappersForRange(editor, range) {
  const wrappers = [];
  let element = range.endContainer.nodeType === Node.ELEMENT_NODE
    ? range.endContainer
    : range.endContainer.parentElement;

  while (element && element !== editor) {
    if (element.closest(".rich-check-item")) break;
    if (richInlineStyleElementNames.has(element.localName)) {
      wrappers.push({
        name: element.localName,
        attrs: richInlineWrapperAttributes(element)
      });
    }
    element = element.parentElement;
  }

  return wrappers;
}

const richInlineStyleElementNames = new Set(["b", "strong", "i", "em", "u", "s", "strike", "sub", "sup", "font", "span"]);

function richInlineWrapperAttributes(element) {
  const attrs = [];
  ["class", "style", "color", "face", "size"].forEach(name => {
    const value = element.getAttribute(name);
    if (value) attrs.push({ name, value });
  });
  return attrs;
}

function richInlineWrapperHtml(wrappers, innerHtml) {
  return wrappers.reduce((html, wrapper) => {
    const attrs = wrapper.attrs
      .map(attr => ` ${attr.name}="${escapeAttr(attr.value)}"`)
      .join("");
    return `<${wrapper.name}${attrs}>${html}</${wrapper.name}>`;
  }, innerHtml);
}

function richRangeForTextBeforeCaret(editor, caretRange, text) {
  const targetText = String(text || "");
  if (!targetText) return null;

  const prefixRange = document.createRange();
  prefixRange.selectNodeContents(editor);
  try {
    prefixRange.setEnd(caretRange.endContainer, caretRange.endOffset);
  } catch {
    return null;
  }

  if (!prefixRange.toString().replace(/\u00a0/g, " ").endsWith(targetText)) return null;

  const textNodes = [];
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!prefixRange.intersectsNode(node)) continue;

    const endOffset = node === prefixRange.endContainer ? prefixRange.endOffset : node.nodeValue.length;
    if (endOffset > 0) textNodes.push({ node, endOffset });
  }

  let remaining = targetText.length;
  for (let index = textNodes.length - 1; index >= 0; index -= 1) {
    const { node, endOffset } = textNodes[index];
    const take = Math.min(remaining, endOffset);
    remaining -= take;

    if (remaining === 0) {
      const range = document.createRange();
      range.setStart(node, endOffset - take);
      range.setEnd(caretRange.endContainer, caretRange.endOffset);
      return range;
    }
  }

  return null;
}

function placeRichCheckboxShortcutCaret(editor, markerId) {
  const marker = editor.querySelector(`[data-rich-checkbox-shortcut-caret="${markerId}"]`);
  if (!marker) return;

  const caretHost = marker.parentNode;
  marker.remove();

  const range = document.createRange();
  const textNode = [...(caretHost?.childNodes || [])].reverse()
    .find(node => node.nodeType === Node.TEXT_NODE);
  if (textNode) {
    range.setStart(textNode, textNode.nodeValue.length);
  } else if (caretHost) {
    range.selectNodeContents(caretHost);
    range.collapse(false);
  } else {
    return;
  }
  range.collapse(true);

  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function bindRichCheckboxes(root) {
  root.querySelectorAll(".rich-editor input[type='checkbox'], .rich-readonly input[type='checkbox'], .log-content input[type='checkbox'], .scrum-content input[type='checkbox']").forEach(syncRichCheckboxAttribute);
}

function bindGlobalRichCheckboxSync() {
  if (document.body.dataset.richCheckboxSyncBound === "true") return;

  document.body.dataset.richCheckboxSyncBound = "true";
  document.addEventListener("click", event => {
    const checkItem = event.target.closest?.(".rich-editor .rich-check-item");
    if (!checkItem || event.target.closest?.("input[type='checkbox']")) return;

    event.preventDefault();
    placeRichCheckboxCaret(checkItem, event);
  }, true);
  document.addEventListener("change", event => {
    const checkbox = event.target.closest?.(".rich-editor input[type='checkbox'], .rich-readonly input[type='checkbox'], .log-content input[type='checkbox'], .scrum-content input[type='checkbox']");
    if (!checkbox) return;

    syncRichCheckboxAttribute(checkbox);
    if (!checkbox.closest(".rich-editor")) scheduleRichReadonlyCheckboxPersist(checkbox);
  });
}

function syncRichCheckboxAttribute(checkbox) {
  if (checkbox.checked) {
    checkbox.setAttribute("checked", "checked");
  } else {
    checkbox.removeAttribute("checked");
  }
}

function scheduleRichReadonlyCheckboxPersist(checkbox) {
  const container = checkbox.closest("[data-rich-persist-type][data-rich-persist-id][data-rich-persist-field]");
  if (!container) return;

  const existingTimer = richReadonlyCheckboxSaveTimers.get(container);
  if (existingTimer) clearTimeout(existingTimer);

  container.dataset.richCheckboxSaveState = "pending";
  const timer = setTimeout(() => {
    richReadonlyCheckboxSaveTimers.delete(container);
    persistRichReadonlyCheckboxContainer(container);
  }, richReadonlyCheckboxSaveDelayMs);
  richReadonlyCheckboxSaveTimers.set(container, timer);
}

async function persistRichReadonlyCheckboxContainer(container) {
  const bodyHtml = htmlWithoutUserMentionMarkup(container);
  const previousHtml = richReadonlyPersistedHtml(container);
  const request = richReadonlyCheckboxSaveRequest(container, bodyHtml);
  if (!request) return;

  container.dataset.richCheckboxSaveState = "saving";
  try {
    const result = await saveJson(request.path, "PUT", request.payload);
    if (!result?.rowVersion) await loadState();
    updateRichReadonlyPersistedState(container, bodyHtml, result?.rowVersion || "");
    syncMatchingRichReadonlyContainers(container, bodyHtml);
    delete container.dataset.richCheckboxSaveState;
    showToast("Checkbox saved.");
  } catch (error) {
    container.dataset.richCheckboxSaveState = "error";
    if (previousHtml !== null) {
      container.innerHTML = previousHtml;
      bindRichCheckboxes(container);
      hydrateRichDiagramOleBlocks(container);
    }
    showToast(error.message || "Checkbox could not be saved.");
  }
}

function richReadonlyPersistedHtml(container) {
  const record = richReadonlyPersistedRecord(container);
  const field = container.dataset.richPersistField || "";
  if (!record || !field || !Object.prototype.hasOwnProperty.call(record, field)) return null;

  return record[field] || "";
}

function richReadonlyPersistedRecord(container) {
  const type = container.dataset.richPersistType;
  const id = Number(container.dataset.richPersistId || 0);
  if (!id) return null;

  if (type === "blog") return state.blogs.find(item => item.id === id) || null;
  if (type === "devLog") return state.devLogs.find(item => item.id === id) || null;
  if (type === "workItem") return state.tasks.find(item => item.id === id) || null;
  return null;
}

function updateRichReadonlyPersistedState(container, bodyHtml, rowVersion = "") {
  const record = richReadonlyPersistedRecord(container);
  const field = container.dataset.richPersistField || "";
  if (!record || !field || !Object.prototype.hasOwnProperty.call(record, field)) return;

  record[field] = bodyHtml;
  record.updatedAt = new Date().toISOString();
  if (rowVersion) record.rowVersion = rowVersion;
  if (Object.prototype.hasOwnProperty.call(record, "updatedByUserId")) {
    record.updatedByUserId = currentUserId || record.updatedByUserId || record.createdByUserId || null;
  }

  if (container.dataset.richPersistType === "workItem") {
    syncNestedWorkItemRichState(record.id, field, bodyHtml, rowVersion);
  }
}

function syncNestedWorkItemRichState(taskId, field, bodyHtml, rowVersion = "") {
  state.tasks.forEach(task => {
    const subTask = (task.subTasks || []).find(item => item.id === taskId);
    if (!subTask || !Object.prototype.hasOwnProperty.call(subTask, field)) return;

    subTask[field] = bodyHtml;
    subTask.updatedAt = new Date().toISOString();
    if (rowVersion) subTask.rowVersion = rowVersion;
    subTask.updatedByUserId = currentUserId || subTask.updatedByUserId || subTask.createdByUserId || null;
  });
}

function syncMatchingRichReadonlyContainers(sourceContainer, bodyHtml) {
  const { richPersistType: type, richPersistId: id, richPersistField: field } = sourceContainer.dataset;
  document.querySelectorAll("[data-rich-persist-type][data-rich-persist-id][data-rich-persist-field]").forEach(container => {
    if (container === sourceContainer) return;
    if (container.dataset.richPersistType !== type || container.dataset.richPersistId !== id || container.dataset.richPersistField !== field) return;
    if (container.dataset.richCheckboxSaveState === "pending" || container.dataset.richCheckboxSaveState === "saving") return;

    container.innerHTML = bodyHtml;
    bindRichCheckboxes(container);
    hydrateRichDiagramOleBlocks(container);
  });
}

function richReadonlyCheckboxSaveRequest(container, bodyHtml) {
  const type = container.dataset.richPersistType;
  const id = Number(container.dataset.richPersistId || 0);
  const field = container.dataset.richPersistField || "";
  if (!id || !field) return null;

  if (type === "blog") return blogRichReadonlySaveRequest(id, field, bodyHtml);
  if (type === "devLog") return devLogRichReadonlySaveRequest(id, field, bodyHtml);
  if (type === "workItem") return workItemRichReadonlySaveRequest(id, field, bodyHtml, container.dataset.richPersistApiRoot);
  return null;
}

function blogRichReadonlySaveRequest(id, field, bodyHtml) {
  const blog = state.blogs.find(item => item.id === id);
  if (!blog || field !== "bodyHtml") return null;

  return {
    path: `/api/blogs/${id}`,
    payload: {
      id,
      projectId: blog.projectId || null,
      sprintId: blog.sprintId || null,
      parentBlogId: blog.parentBlogId || null,
      title: blog.title,
      bodyHtml,
      isPrivate: blog.isPrivate !== false,
      isPinned: false,
      expectedRowVersion: blog.rowVersion || null
    }
  };
}

function devLogRichReadonlySaveRequest(id, field, bodyHtml) {
  const log = state.devLogs.find(item => item.id === id);
  if (!log || field !== "bodyHtml") return null;

  return {
    path: `/api/devlogs/${id}`,
    payload: {
      id,
      logType: log.logType || "Scrum",
      category: log.category || "General",
      projectId: log.projectId || null,
      logDate: toDateInput(log.logDate),
      bodyHtml,
      isPinned: Boolean(log.isPinned),
      auditContext: "RTE checkbox",
      expectedRowVersion: log.rowVersion || null
    }
  };
}

function workItemRichReadonlySaveRequest(id, field, bodyHtml, apiRoot = "/api/tasks") {
  const task = state.tasks.find(item => item.id === id);
  if (!task || !["descriptionHtml", "stepsToReproduceHtml", "actualResultHtml", "expectedResultHtml", "rootCauseAnalysisHtml"].includes(field)) return null;

  return {
    path: `${apiRoot || "/api/tasks"}/${id}`,
    payload: {
      id,
      projectId: task.projectId,
      sprintId: task.sprintId || null,
      parentTaskId: task.parentTaskId || null,
      taskType: task.taskType || "Dev",
      title: task.title,
      descriptionHtml: field === "descriptionHtml" ? bodyHtml : task.descriptionHtml || "",
      stepsToReproduceHtml: field === "stepsToReproduceHtml" ? bodyHtml : task.stepsToReproduceHtml || "",
      actualResultHtml: field === "actualResultHtml" ? bodyHtml : task.actualResultHtml || "",
      expectedResultHtml: field === "expectedResultHtml" ? bodyHtml : task.expectedResultHtml || "",
      rootCauseAnalysisHtml: field === "rootCauseAnalysisHtml" ? bodyHtml : task.rootCauseAnalysisHtml || "",
      environment: task.environment || "",
      severity: task.severity || "",
      status: task.status,
      priority: task.priority,
      percentCompleted: task.percentCompleted || 0,
      url: task.url || "",
      startDate: task.startDate || null,
      endDate: task.endDate || null,
      reporterIds: task.reporterIds || [],
      assigneeIds: task.assigneeIds || [],
      dependencyTaskIds: task.dependencyTaskIds || [],
      auditContext: "RTE checkbox",
      expectedRowVersion: task.rowVersion || null
    }
  };
}

function placeRichCheckboxCaret(checkItem, event) {
  const editor = checkItem.closest(".rich-editor");
  if (!editor) return;

  editor.focus();
  const range = richCheckboxEndRangeForClick(checkItem, event)
    || richCaretRangeFromPoint(event.clientX, event.clientY);
  if (!range || !editor.contains(range.commonAncestorContainer)) return;

  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function richCheckboxEndRangeForClick(checkItem, event) {
  const textRight = richCheckboxTextRight(checkItem, event.clientY);
  if (!Number.isFinite(textRight) || event.clientX <= textRight + 1) return null;

  return richRangeAtEndOfElement(checkItem);
}

function richCheckboxTextRight(checkItem, clientY) {
  const range = document.createRange();
  let right = Number.NEGATIVE_INFINITY;
  let fallbackRight = Number.NEGATIVE_INFINITY;

  richCheckboxTextNodes(checkItem).forEach(node => {
    range.selectNodeContents(node);
    [...range.getClientRects()].forEach(rect => {
      fallbackRight = Math.max(fallbackRight, rect.right);
      if (clientY >= rect.top - 1 && clientY <= rect.bottom + 1) {
        right = Math.max(right, rect.right);
      }
    });
  });
  range.detach?.();

  return Number.isFinite(right) ? right : fallbackRight;
}

function richCheckboxTextNodes(root) {
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      if (node.parentElement?.closest("input, button, select, textarea")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }

  return nodes;
}

function richRangeAtEndOfElement(element) {
  const textNodes = richCheckboxTextNodes(element);
  const lastTextNode = textNodes[textNodes.length - 1];
  const range = document.createRange();

  if (lastTextNode) {
    range.setStart(lastTextNode, lastTextNode.nodeValue.length);
  } else {
    range.selectNodeContents(element);
    range.collapse(false);
    return range;
  }

  range.collapse(true);
  return range;
}

function richCaretRangeFromPoint(clientX, clientY) {
  if (document.caretRangeFromPoint) return document.caretRangeFromPoint(clientX, clientY);

  const position = document.caretPositionFromPoint?.(clientX, clientY);
  if (!position) return null;

  const range = document.createRange();
  range.setStart(position.offsetNode, position.offset);
  range.collapse(true);
  return range;
}

function bindRichTableSelectionTracking(editor) {
  if (editor.dataset.richTableTrackingBound === "true") return;

  editor.dataset.richTableTrackingBound = "true";
  ["click", "keyup", "mouseup", "focus"].forEach(eventName => {
    editor.addEventListener(eventName, () => syncRichTableToolbars());
  });
  editor.addEventListener("keydown", event => handleRichTableKeyDown(editor, event));

  if (document.body.dataset.richTableSelectionBound !== "true") {
    document.body.dataset.richTableSelectionBound = "true";
    document.addEventListener("selectionchange", () => syncRichTableToolbars());
  }
}

function handleRichTableKeyDown(editor, event) {
  if (event.key !== "Tab" || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;

  const cell = richTableCellForEditor(editor);
  if (!cell || !richSelectionAtCellBoundary(editor, cell)) return;

  event.preventDefault();
  const nextCell = richTableNextCell(cell);
  if (nextCell) {
    focusRichTableCell(editor, nextCell);
  } else {
    insertRichTableRow(editor, cell, "below", { focusCellIndex: 0 });
  }
  syncRichTableToolbars();
}

function syncRichTableToolbars(scope = document) {
  scope.querySelectorAll(".rich-tools").forEach(toolbar => {
    const editor = richEditorForControl(toolbar);
    const tableTools = toolbar.querySelector("[data-rich-table-tools]");
    if (!tableTools || !editor) return;

    tableTools.hidden = !richTableCellForEditor(editor);
  });
}

async function applyRichTableCommand(editor, command) {
  const cell = richTableCellForEditor(editor);
  if (!cell) return false;

  if (command === "insertRow") {
    const placement = await askRichTablePlacement("Insert Row", "Where should the new row go?", [
      { value: "above", label: "Above" },
      { value: "below", label: "Below" }
    ]);
    if (placement) insertRichTableRow(editor, cell, placement);
    return true;
  }

  if (command === "deleteRow") {
    deleteRichTableRow(editor, cell);
    return true;
  }

  if (command === "moveRowUp") {
    moveRichTableRow(editor, cell, "up");
    return true;
  }

  if (command === "moveRowDown") {
    moveRichTableRow(editor, cell, "down");
    return true;
  }

  if (command === "insertColumn") {
    const placement = await askRichTablePlacement("Insert Column", "Where should the new column go?", [
      { value: "left", label: "Left" },
      { value: "right", label: "Right" }
    ]);
    if (placement) insertRichTableColumn(editor, cell, placement);
    return true;
  }

  if (command === "deleteColumn") {
    deleteRichTableColumn(editor, cell);
    return true;
  }

  if (command === "moveColumnLeft") {
    moveRichTableColumn(editor, cell, "left");
    return true;
  }

  if (command === "moveColumnRight") {
    moveRichTableColumn(editor, cell, "right");
    return true;
  }

  if (command === "deleteTable") {
    deleteRichTableWithUndo(editor, cell.closest("table"));
    return true;
  }

  return false;
}

function insertRichTableRow(editor, cell, placement, options = {}) {
  const row = cell.closest("tr");
  const table = cell.closest("table");
  if (!row || !table) return;

  const columnCount = richTableColumnCount(table);
  const newRow = document.createElement("tr");
  for (let index = 0; index < columnCount; index += 1) {
    newRow.appendChild(createRichTableCell());
  }

  if (placement === "above") {
    row.parentNode.insertBefore(newRow, row);
  } else {
    row.parentNode.insertBefore(newRow, row.nextSibling);
  }

  const focusCellIndex = Number.isInteger(options.focusCellIndex) ? options.focusCellIndex : cell.cellIndex;
  focusRichTableCell(editor, newRow.cells[Math.min(focusCellIndex, newRow.cells.length - 1)]);
}

function deleteRichTableRow(editor, cell) {
  const row = cell.closest("tr");
  const table = cell.closest("table");
  if (!row || !table) return;

  if (table.rows.length <= 1) {
    deleteRichTableWithUndo(editor, table);
    return;
  }

  const rowIndex = [...table.rows].indexOf(row);
  const columnIndex = cell.cellIndex;
  const markerId = `richTableFocus${Date.now()}${Math.floor(Math.random() * 100000)}`;
  const clone = table.cloneNode(true);
  clone.rows[rowIndex]?.remove();

  const focusRowIndex = Math.min(rowIndex, clone.rows.length - 1);
  const focusCell = clone.rows[focusRowIndex]?.cells[Math.min(columnIndex, clone.rows[focusRowIndex].cells.length - 1)];
  focusCell?.setAttribute("data-rich-table-focus", markerId);

  replaceRichNodeWithHtml(editor, table, clone.outerHTML);
  focusRichTableMarkerCell(editor, markerId);
}

function deleteRichTableWithUndo(editor, table) {
  if (!table) return;

  const markerId = `richTableFocus${Date.now()}${Math.floor(Math.random() * 100000)}`;
  replaceRichNodeWithHtml(editor, table, `<p><span data-rich-table-focus="${escapeAttr(markerId)}"></span><br></p>`);
  focusRichTableMarker(editor, markerId);
}

function replaceRichNodeWithHtml(editor, node, html) {
  if (!node?.isConnected) return false;

  editor.focus();
  const range = document.createRange();
  range.selectNode(node);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  return document.execCommand("insertHTML", false, html);
}

function focusRichTableMarkerCell(editor, markerId) {
  const markerCell = editor.querySelector(`[data-rich-table-focus="${markerId}"]`);
  if (!markerCell) {
    editor.focus();
    return;
  }

  markerCell.removeAttribute("data-rich-table-focus");
  focusRichTableCell(editor, markerCell);
}

function focusRichTableMarker(editor, markerId) {
  const marker = editor.querySelector(`[data-rich-table-focus="${markerId}"]`);
  if (!marker) {
    editor.focus();
    return;
  }

  const parent = marker.parentNode;
  const offset = parent ? [...parent.childNodes].indexOf(marker) : 0;
  marker.remove();
  if (!parent) {
    editor.focus();
    return;
  }

  const range = document.createRange();
  range.setStart(parent, Math.max(0, offset));
  range.collapse(true);
  editor.focus();
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function richTableIsLastCell(cell) {
  const row = cell.closest("tr");
  const table = cell.closest("table");
  const lastRow = table?.rows[table.rows.length - 1];
  return !!lastRow && row === lastRow && cell === lastRow.cells[lastRow.cells.length - 1];
}

function richTableNextCell(cell) {
  if (richTableIsLastCell(cell)) return null;

  const row = cell.closest("tr");
  const table = cell.closest("table");
  if (!row || !table) return null;

  const nextCellInRow = row.cells[cell.cellIndex + 1];
  if (nextCellInRow) return nextCellInRow;

  const nextRow = table.rows[row.rowIndex + 1];
  return nextRow?.cells[0] || null;
}

function richSelectionAtCellBoundary(editor, cell) {
  const range = richSelectionRangeForEditor(editor);
  if (!range?.collapsed || !cell.contains(range.endContainer)) return false;

  return richSelectionEdgeIsEmpty(cell, range, "start")
    || richSelectionEdgeIsEmpty(cell, range, "end");
}

function richSelectionEdgeIsEmpty(cell, range, edge) {
  const edgeRange = document.createRange();
  try {
    if (edge === "start") {
      edgeRange.setStart(cell, 0);
      edgeRange.setEnd(range.startContainer, range.startOffset);
    } else {
      edgeRange.setStart(range.endContainer, range.endOffset);
      edgeRange.setEnd(cell, cell.childNodes.length);
    }
  } catch {
    return false;
  }

  if (edgeRange.toString().replace(/\u00a0/g, " ").trim()) return false;
  const fragment = edgeRange.cloneContents();
  return !fragment.querySelector("img, table, input, hr, svg, iframe, video, audio");
}

function moveRichTableRow(editor, cell, direction) {
  const row = cell.closest("tr");
  if (!row) return;

  const target = direction === "up" ? row.previousElementSibling : row.nextElementSibling;
  if (!target) {
    showToast(direction === "up" ? "Row is already at the top." : "Row is already at the bottom.");
    return;
  }

  if (direction === "up") {
    row.parentNode.insertBefore(row, target);
  } else {
    row.parentNode.insertBefore(target, row);
  }

  focusRichTableCell(editor, row.cells[Math.min(cell.cellIndex, row.cells.length - 1)]);
}

function insertRichTableColumn(editor, cell, placement) {
  const table = cell.closest("table");
  if (!table) return;

  const insertIndex = cell.cellIndex + (placement === "right" ? 1 : 0);
  let focusCell = null;
  [...table.rows].forEach(row => {
    const newCell = createRichTableCell();
    if (insertIndex >= row.cells.length) {
      row.appendChild(newCell);
    } else {
      row.insertBefore(newCell, row.cells[insertIndex]);
    }
    if (row === cell.parentElement) focusCell = newCell;
  });

  focusRichTableCell(editor, focusCell);
}

function deleteRichTableColumn(editor, cell) {
  const table = cell.closest("table");
  if (!table) return;

  const columnIndex = cell.cellIndex;
  const columnCount = richTableColumnCount(table);
  if (columnCount <= 1) {
    table.remove();
    editor.focus();
    return;
  }

  let focusCell = null;
  [...table.rows].forEach(row => {
    const nextFocusIndex = Math.min(columnIndex, row.cells.length - 2);
    if (row === cell.parentElement) focusCell = row.cells[nextFocusIndex] || null;
    row.cells[columnIndex]?.remove();
  });

  focusRichTableCell(editor, focusCell);
}

function moveRichTableColumn(editor, cell, direction) {
  const table = cell.closest("table");
  if (!table) return;

  const columnIndex = cell.cellIndex;
  const columnCount = richTableColumnCount(table);
  if ((direction === "left" && columnIndex <= 0) || (direction === "right" && columnIndex >= columnCount - 1)) {
    showToast(direction === "left" ? "Column is already at the left edge." : "Column is already at the right edge.");
    return;
  }

  const nextIndex = direction === "left" ? columnIndex - 1 : columnIndex + 1;
  [...table.rows].forEach(row => {
    const movingCell = row.cells[columnIndex];
    const targetCell = row.cells[nextIndex];
    if (!movingCell || !targetCell) return;

    if (direction === "left") {
      row.insertBefore(movingCell, targetCell);
    } else {
      row.insertBefore(targetCell, movingCell);
    }
  });

  focusRichTableCell(editor, cell.parentElement?.cells[nextIndex]);
}

function richTableColumnCount(table) {
  return Math.max(1, ...[...table.rows].map(row => row.cells.length));
}

function createRichTableCell() {
  const cell = document.createElement("td");
  cell.innerHTML = "<p><br></p>";
  return cell;
}

function focusRichTableCell(editor, cell) {
  if (!cell) {
    editor.focus();
    return;
  }

  editor.focus();
  const range = document.createRange();
  range.selectNodeContents(cell);
  range.collapse(true);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function richTableCellForEditor(editor) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const node = selection.anchorNode;
  if (!node || !editor.contains(node)) return null;

  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  const cell = element?.closest("td, th");
  return cell && editor.contains(cell) ? cell : null;
}

function selectedRichTableCells(editor) {
  const range = richSelectionRangeForEditor(editor);
  if (!range) return [];

  const cells = [...editor.querySelectorAll("td, th")]
    .filter(cell => {
      try {
        return range.intersectsNode(cell);
      } catch {
        return false;
      }
    });

  if (cells.length) return cells;

  const currentCell = richTableCellForEditor(editor);
  return currentCell ? [currentCell] : [];
}

function richSelectionRangeForEditor(editor) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  return editor.contains(range.commonAncestorContainer) ? range : null;
}

function askRichTableSize() {
  return new Promise(resolve => {
    const modal = document.createElement("dialog");
    modal.className = "dialog mini-dialog";
    const options = Array.from({ length: richTableMaxSize }, (_, index) => index + 1)
      .map(value => `<option value="${value}" ${value === 3 ? "selected" : ""}>${value}</option>`)
      .join("");
    modal.innerHTML = `
      <form method="dialog">
        <div class="dialog-head">
          <h2>Insert Table</h2>
        </div>
        <div class="dialog-body two-column-fields">
          <div class="field">
            <label>Rows</label>
            <select name="rows">${options}</select>
          </div>
          <div class="field">
            <label>Columns</label>
            <select name="columns">${options}</select>
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
        rows: Number(modal.querySelector("[name='rows']").value),
        columns: Number(modal.querySelector("[name='columns']").value)
      });
    });
    modal.addEventListener("cancel", event => {
      event.preventDefault();
      finish(null);
    });

    modal.showModal();
  });
}

function askRichTablePlacement(title, message, choices) {
  return new Promise(resolve => {
    const modal = document.createElement("dialog");
    modal.className = "dialog mini-dialog";
    modal.innerHTML = `
      <div class="dialog-head">
        <h2>${escapeHtml(title)}</h2>
      </div>
      <div class="dialog-body">
        <p>${escapeHtml(message)}</p>
      </div>
      <div class="dialog-actions">
        <button type="button" class="secondary text-icon-button" data-result="">${buttonContent("&#10005;", "Cancel")}</button>
        ${choices.map(choice => `<button type="button" class="primary text-icon-button" data-result="${escapeAttr(choice.value)}">${buttonContent("&#10003;", choice.label)}</button>`).join("")}
      </div>
    `;

    document.body.appendChild(modal);
    const finish = value => {
      modal.close();
      modal.remove();
      resolve(value || "");
    };

    modal.querySelectorAll("[data-result]").forEach(button => {
      button.addEventListener("click", () => finish(button.dataset.result));
    });
    modal.addEventListener("cancel", event => {
      event.preventDefault();
      finish("");
    });

    modal.showModal();
  });
}

function configureEditorDialogRichToolbarToggle() {
  if (!toggleAllRichToolsButton) return;

  const toolbars = editorDialogRichToolbars();
  toggleAllRichToolsButton.hidden = toolbars.length < 2;
  if (toolbars.length < 2) return;

  const shouldCollapse = readBooleanPreference(preferenceKeys.richTextDialogToolbarsCollapsed, false);
  toolbars.forEach(toolbar => setRichToolbarCollapsed(toolbar, shouldCollapse, { hideToolbar: shouldCollapse }));
  syncEditorDialogRichToolbarToggle();
}

function editorDialogRichToolbars() {
  return [...dialogBody.querySelectorAll(".rich-tools")];
}

function toggleAllEditorRichToolbars() {
  const toolbars = editorDialogRichToolbars();
  if (toolbars.length < 2) return;

  const shouldCollapse = toolbars.some(toolbar => !toolbar.classList.contains("is-dialog-collapsed"));
  toolbars.forEach(toolbar => setRichToolbarCollapsed(toolbar, shouldCollapse, { hideToolbar: shouldCollapse }));
  writePreference(preferenceKeys.richTextDialogToolbarsCollapsed, shouldCollapse);
  syncEditorDialogRichToolbarToggle();
}

function syncEditorDialogRichToolbarToggle() {
  if (!toggleAllRichToolsButton || toggleAllRichToolsButton.hidden) return;

  const toolbars = editorDialogRichToolbars();
  const allCollapsed = toolbars.length > 0 && toolbars.every(toolbar => toolbar.classList.contains("is-dialog-collapsed"));
  const toolbarsVisible = !allCollapsed;
  const label = toolbarsVisible ? "Hide Rich Text Toolbars" : "Show Rich Text Toolbars";
  toggleAllRichToolsButton.title = label;
  toggleAllRichToolsButton.setAttribute("aria-label", label);
  toggleAllRichToolsButton.setAttribute("aria-pressed", String(toolbarsVisible));
  toggleAllRichToolsButton.innerHTML = buttonContent(toolbarsVisible ? "&#9745;" : "&#9744;", "Toolbars");
}

function setRichToolbarCollapsed(toolbar, collapsed, options = {}) {
  toolbar.classList.toggle("is-dialog-collapsed", collapsed && options.hideToolbar === true);
  toolbar.classList.toggle("is-collapsed", collapsed);
  syncRichToolbarToggle(toolbar);
}

function syncRichToolbarToggle(toolbar) {
  const button = toolbar.querySelector("[data-rich-toolbar-toggle]");
  if (!button) return;

  const collapsed = toolbar.classList.contains("is-collapsed");
  const label = collapsed ? "Expand Toolbar" : "Collapse Toolbar";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-pressed", String(collapsed));
}

function applyRichColorCommand(command, color, editor = null) {
  const tableCells = editor ? selectedRichTableCells(editor) : [];
  if (tableCells.length) {
    const property = command === "foreColor" ? "color" : "backgroundColor";
    tableCells.forEach(cell => {
      cell.style[property] = color;
    });
    return;
  }

  const applied = document.execCommand(command, false, color);
  if (!applied && command === "hiliteColor") {
    document.execCommand("backColor", false, color);
  }
}

function openRichColorTool(tool) {
  const palette = tool.querySelector("[data-rich-color-palette]");
  if (!palette) return;

  tool.classList.add("is-open");
  tool.closest("dialog")?.classList.add("rich-color-palette-open");
  palette.removeAttribute("hidden");
  tool.querySelector("[data-rich-color-command]")?.setAttribute("aria-expanded", "true");
  positionRichColorPalette(tool);
}

function closeRichColorTool(tool) {
  const palette = tool.querySelector("[data-rich-color-palette]");
  tool.classList.remove("is-open");
  palette?.setAttribute("hidden", "");
  palette?.style.removeProperty("--rich-palette-left");
  palette?.style.removeProperty("--rich-palette-top");
  tool.querySelector("[data-rich-color-command]")?.setAttribute("aria-expanded", "false");

  const dialog = tool.closest("dialog");
  if (dialog && !dialog.querySelector(".rich-color-tool.is-open")) {
    dialog.classList.remove("rich-color-palette-open");
  }
}

function closeRichColorPalettes(scope) {
  scope.querySelectorAll(".rich-color-tool.is-open").forEach(closeRichColorTool);
}

function positionRichColorPalette(tool) {
  const trigger = tool.querySelector("[data-rich-color-command]");
  const palette = tool.querySelector("[data-rich-color-palette]");
  if (!trigger || !palette || palette.hidden) return;

  const triggerRect = trigger.getBoundingClientRect();
  const paletteRect = palette.getBoundingClientRect();
  const gap = 4;
  const viewportPadding = 8;
  const maxLeft = window.innerWidth - paletteRect.width - viewportPadding;
  const maxTop = window.innerHeight - paletteRect.height - viewportPadding;
  const spaceBelow = window.innerHeight - triggerRect.bottom - viewportPadding;
  const spaceAbove = triggerRect.top - viewportPadding;
  const shouldOpenAbove = spaceBelow < paletteRect.height && spaceAbove > spaceBelow;
  const left = clampNumber(triggerRect.left, viewportPadding, Math.max(viewportPadding, maxLeft));
  const preferredTop = shouldOpenAbove
    ? triggerRect.top - paletteRect.height - gap
    : triggerRect.bottom + gap;
  const top = clampNumber(preferredTop, viewportPadding, Math.max(viewportPadding, maxTop));

  palette.style.setProperty("--rich-palette-left", `${Math.round(left)}px`);
  palette.style.setProperty("--rich-palette-top", `${Math.round(top)}px`);
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function richColorTriggerApplyHalf(event, trigger) {
  if (!event.clientX) return false;

  const rect = trigger.getBoundingClientRect();
  return event.clientX <= rect.left + (rect.width / 2);
}

function renderRichColorMemoryPalettes(scope) {
  renderRichLastColorPalettes(scope);
  renderRichCustomColorPalettes(scope);
}

function renderRichLastColorPalettes(scope) {
  const colors = readRichLastColors();
  scope.querySelectorAll("[data-rich-last-colors]").forEach(container => {
    const title = container.closest(".rich-color-tool")?.querySelector("[data-rich-color-command]")?.getAttribute("aria-label") || "Color";
    const sectionTitle = container.closest(".rich-color-palette")?.querySelector("[data-rich-last-colors-title]");
    container.hidden = colors.length === 0;
    if (sectionTitle) sectionTitle.hidden = colors.length === 0;
    container.innerHTML = colors.map(color => richStoredColorSwatchHtml(color, title)).join("");
  });
}

function renderRichCustomColorPalettes(scope) {
  const colors = readRichCustomColors();
  scope.querySelectorAll("[data-rich-custom-colors]").forEach(container => {
    const title = container.closest(".rich-color-tool")?.querySelector("[data-rich-color-command]")?.getAttribute("aria-label") || "Color";
    container.hidden = colors.length === 0;
    container.innerHTML = colors.map(color => richStoredColorSwatchHtml(color, title)).join("");
  });
}

function richStoredColorSwatchHtml(color, title) {
  const normalizedColor = normalizeRichCustomColor(color);
  const label = richColorTooltip(title, normalizedColor);
  return `<button type="button" class="rich-color-swatch" data-rich-color-value="${escapeAttr(normalizedColor)}" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}" style="--rich-swatch-color: ${escapeAttr(normalizedColor)}"></button>`;
}

function richColorTooltip(title, color) {
  return [title, color, richRgbText(color)].filter(Boolean).join(" ");
}

function richRgbText(color) {
  const normalizedColor = normalizeRichCustomColor(color);
  if (!normalizedColor) return "";

  const value = normalizedColor.slice(1);
  return `rgb(${Number.parseInt(value.slice(0, 2), 16)}, ${Number.parseInt(value.slice(2, 4), 16)}, ${Number.parseInt(value.slice(4, 6), 16)})`;
}

function readRichLastColor(command, defaultColor) {
  try {
    return normalizeRichCustomColor(localStorage.getItem(`${richLastColorCommandStoragePrefix}${command}`)) || defaultColor;
  } catch {
    return defaultColor;
  }
}

function readRichLastColors() {
  try {
    const parsed = JSON.parse(localStorage.getItem(richLastColorStorageKey) || "[]");
    if (!Array.isArray(parsed)) return [];

    return uniqueRichColors(parsed.map(normalizeRichCustomColor).filter(Boolean)).slice(0, richCustomColorLimit);
  } catch {
    return [];
  }
}

function rememberRichLastColor(command, color) {
  const normalizedColor = normalizeRichCustomColor(color);
  if (!normalizedColor) return;

  const colors = [normalizedColor, ...readRichLastColors().filter(item => item !== normalizedColor)].slice(0, richCustomColorLimit);
  try {
    localStorage.setItem(richLastColorStorageKey, JSON.stringify(colors));
    localStorage.setItem(`${richLastColorCommandStoragePrefix}${command}`, normalizedColor);
  } catch {
    // Remembered colors are optional when browser storage is unavailable.
  }
}

function readRichCustomColors() {
  try {
    const parsed = JSON.parse(localStorage.getItem(richCustomColorStorageKey) || "[]");
    if (!Array.isArray(parsed)) return [];

    return uniqueRichColors(parsed.map(normalizeRichCustomColor).filter(Boolean)).slice(0, richCustomColorLimit);
  } catch {
    return [];
  }
}

function rememberRichCustomColor(color) {
  const normalizedColor = normalizeRichCustomColor(color);
  if (!normalizedColor) return;

  const colors = [normalizedColor, ...readRichCustomColors().filter(item => item !== normalizedColor)].slice(0, richCustomColorLimit);
  try {
    localStorage.setItem(richCustomColorStorageKey, JSON.stringify(colors));
  } catch {
    // Remembered custom colors are optional when browser storage is unavailable.
  }
}

function uniqueRichColors(colors) {
  const seen = new Set();
  return colors.filter(color => {
    if (seen.has(color)) return false;

    seen.add(color);
    return true;
  });
}

function normalizeRichCustomColor(value) {
  const text = String(value || "").trim();
  const hexMatch = text.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    const expandedHex = hex.length === 3
      ? hex.split("").map(character => character + character).join("")
      : hex;
    return `#${expandedHex.toUpperCase()}`;
  }

  const rgbMatch = text.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i)
    || text.match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/);
  if (!rgbMatch) return "";

  const rgbValues = rgbMatch.slice(1).map(Number);
  if (rgbValues.some(component => !Number.isInteger(component) || component < 0 || component > 255)) return "";

  return `#${rgbValues.map(component => component.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
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

function askForCollapsibleBlock(options = {}) {
  return new Promise(resolve => {
    const modal = document.createElement("dialog");
    modal.className = "dialog rich-collapsible-dialog";
    const title = options.title || "Expand/Collapse Section";
    const actionLabel = options.actionLabel || "Insert";
    const sectionTitle = options.sectionTitle ?? "Details";
    const readOnlyOpen = options.readOnlyOpen !== false;
    modal.innerHTML = `
      <form method="dialog">
        <div class="dialog-head">
          <h2>${escapeHtml(title)}</h2>
        </div>
        <div class="dialog-body">
          <div class="field">
            <label>Section title</label>
            <input name="collapsibleTitle" value="${escapeAttr(sectionTitle)}">
          </div>
          <label class="rich-code-readonly-open-option">
            <input type="checkbox" name="collapsibleReadOnlyOpen"${readOnlyOpen ? " checked" : ""}>
            <span>Initially expanded in read-only mode</span>
          </label>
        </div>
        <div class="dialog-actions">
          <button type="button" class="secondary text-icon-button" data-result="cancel">${buttonContent("&#10005;", "Cancel")}</button>
          <button type="submit" class="primary text-icon-button">${buttonContent("&#10003;", actionLabel)}</button>
        </div>
      </form>
    `;

    document.body.appendChild(modal);
    initializeWindowedDialog(modal, { showResetButton: false });

    const finish = value => {
      modal.close();
      modal.remove();
      resolve(value);
    };

    modal.querySelector("[data-result='cancel']").addEventListener("click", () => finish(null));
    modal.querySelector("form").addEventListener("submit", event => {
      event.preventDefault();
      const nextTitle = modal.querySelector("[name='collapsibleTitle']")?.value?.trim() || "";
      if (!nextTitle) {
        showToast("Section title is required.");
        modal.querySelector("[name='collapsibleTitle']")?.focus({ preventScroll: true });
        return;
      }
      finish({
        title: nextTitle,
        readOnlyOpen: modal.querySelector("[name='collapsibleReadOnlyOpen']")?.checked === true
      });
    });
    modal.addEventListener("cancel", event => {
      event.preventDefault();
      finish(null);
    });

    modal.showModal();
    setTimeout(() => modal.querySelector("[name='collapsibleTitle']")?.focus(), 0);
  });
}

function askForCodeBlock(initialCode = "", options = {}) {
  return new Promise(resolve => {
    const modal = document.createElement("dialog");
    modal.className = "dialog rich-code-dialog";
    const selectedLanguage = String(options.language || "");
    const codeLanguageOptions = RICH_SOURCE_TEXT_TYPES
      .map(option => `<option value="${escapeAttr(option.value)}" ${option.value === selectedLanguage ? "selected" : ""}>${escapeHtml(option.label)}</option>`)
      .join("");
    const title = options.title || "Code Block";
    const actionLabel = options.actionLabel || "Insert";
    const caption = options.caption ?? "Code";
    const readOnlyOpen = options.readOnlyOpen === true;
    modal.innerHTML = `
      <form method="dialog">
        <div class="dialog-head">
          <h2>${escapeHtml(title)}</h2>
        </div>
        <div class="dialog-body">
          <div class="field">
            <label>Caption</label>
            <input name="codeCaption" value="${escapeAttr(caption)}">
          </div>
          <div class="field">
            <label>Code</label>
            <select name="codeLanguage" data-rich-code-language>${codeLanguageOptions}</select>
          </div>
          <label class="rich-code-readonly-open-option">
            <input type="checkbox" name="codeReadOnlyOpen"${readOnlyOpen ? " checked" : ""}>
            <span>Initially expanded in read-only mode</span>
          </label>
          <div class="field full">
            <label>Content</label>
            <textarea name="codeText" rows="12" spellcheck="false">${escapeHtml(initialCode)}</textarea>
          </div>
        </div>
        <div class="dialog-actions">
          <button type="button" class="secondary text-icon-button" data-rich-code-preview>${buttonContent("&#128065;", "Color Code Preview")}</button>
          <button type="button" class="secondary text-icon-button" data-result="cancel">${buttonContent("&#10005;", "Cancel")}</button>
          <button type="submit" class="primary text-icon-button">${buttonContent("&#10003;", actionLabel)}</button>
        </div>
      </form>
    `;

    document.body.appendChild(modal);
    initializeWindowedDialog(modal, { showResetButton: false });
    const codeTextarea = modal.querySelector("[name='codeText']");
    const codeLanguage = modal.querySelector("[data-rich-code-language]");

    const formatCodeIfNeeded = () => {
      if (!codeTextarea || codeLanguage?.value !== "json") return;

      let result;
      try {
        result = prepareRichSourceHighlight(codeTextarea.value, codeLanguage.value, { formatJson: true });
      } catch {
        result = {
          error: `Unable to color code ${codeLanguage?.selectedOptions?.[0]?.textContent || "the code"}. The code is being shown as plain text.`,
          highlighted: false,
          html: "",
          text: codeTextarea.value
        };
      }

      if (result.text !== codeTextarea.value) {
        codeTextarea.value = result.text;
        codeTextarea.scrollTop = 0;
        codeTextarea.scrollLeft = 0;
      }

      if (result.error && codeTextarea?.dataset.richCodeError !== result.error) {
        codeTextarea.dataset.richCodeError = result.error;
        showToast(result.error);
      } else if (!result.error && codeTextarea) {
        delete codeTextarea.dataset.richCodeError;
      }
    };

    const finish = value => {
      modal.close();
      modal.remove();
      resolve(value);
    };

    modal.querySelector("[data-result='cancel']").addEventListener("click", () => finish(null));
    modal.querySelector("[data-rich-code-preview]")?.addEventListener("click", () => {
      openRichCodePreviewDialog({
        code: normalizeRichCodeIndentation(codeTextarea?.value || ""),
        language: codeLanguage?.value || "",
        title: modal.querySelector("[name='codeCaption']")?.value || "Code"
      });
    });
    codeLanguage?.addEventListener("change", () => {
      delete codeTextarea.dataset.richCodeError;
      formatCodeIfNeeded();
      codeTextarea?.focus({ preventScroll: true });
    });
    modal.querySelector("form").addEventListener("submit", event => {
      event.preventDefault();
      finish({
        caption: modal.querySelector("[name='codeCaption']").value,
        code: normalizeRichCodeIndentation(codeTextarea?.value || ""),
        language: codeLanguage?.value || "",
        readOnlyOpen: modal.querySelector("[name='codeReadOnlyOpen']")?.checked === true
      });
    });
    modal.addEventListener("cancel", event => {
      event.preventDefault();
      finish(null);
    });

    modal.showModal();
    formatCodeIfNeeded();
    setTimeout(() => modal.querySelector("[name='codeText']").focus(), 0);
  });
}

function openRichCodePreviewDialog({ code = "", language = "", title = "Code" } = {}) {
  const normalizedLanguage = RICH_SOURCE_TEXT_TYPES.some(option => option.value === language)
    ? language
    : "";
  const result = prepareRichSourceHighlight(code, normalizedLanguage);
  const codeHtml = (result.highlighted ? result.html : escapeHtml(code)) || "<br>";
  const modal = document.createElement("dialog");
  modal.className = "dialog rich-code-preview-dialog";
  modal.innerHTML = `
    <form method="dialog">
      <div class="dialog-head">
        <h2>Color Code Preview: ${escapeHtml(String(title || "Code").trim() || "Code")}</h2>
        <button type="button" class="icon-btn" data-close-rich-code-preview title="Close" aria-label="Close">x</button>
      </div>
      <div class="dialog-body">
        ${result.error ? `<p class="field-note">${escapeHtml(result.error)}</p>` : ""}
        <pre class="rich-code-preview"><code>${codeHtml}</code></pre>
      </div>
      <div class="dialog-actions">
        <button type="button" class="secondary text-icon-button" data-close-rich-code-preview>${buttonContent("&#10005;", "Close")}</button>
      </div>
    </form>
  `;
  document.body.appendChild(modal);
  initializeWindowedDialog(modal, { showResetButton: false });
  modal.querySelectorAll("[data-close-rich-code-preview]").forEach(button => {
    button.addEventListener("click", () => modal.close());
  });
  modal.addEventListener("cancel", event => {
    event.preventDefault();
    modal.close();
  });
  modal.addEventListener("close", () => modal.remove());
  modal.showModal();
}

function normalizeRichCodeIndentation(code) {
  const normalized = String(code || "").replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  const contentLines = lines.filter(line => /\S/.test(line));
  if (!contentLines.length) return normalized;

  let commonIndent = contentLines[0].match(/^[\t ]+/)?.[0] || "";
  if (!commonIndent) return normalized;

  for (const line of contentLines.slice(1)) {
    while (commonIndent && !line.startsWith(commonIndent)) {
      commonIndent = commonIndent.slice(0, -1);
    }
    if (!commonIndent) return normalized;
  }

  return lines
    .map(line => line.startsWith(commonIndent) ? line.slice(commonIndent.length) : line)
    .join("\n");
}

function editorSelectionHtml(range) {
  if (!range || range.collapsed) return "";
  const container = document.createElement("div");
  container.appendChild(range.cloneContents());
  return container.innerHTML;
}

function askRichSvgFile() {
  return new Promise(resolve => {
    const modal = document.createElement("dialog");
    modal.className = "dialog rich-code-dialog rich-svg-dialog";
    modal.innerHTML = `
      <form method="dialog">
        <div class="dialog-head">
          <h2>Insert SVG</h2>
        </div>
        <div class="dialog-body">
          <div class="field full">
            <label>SVG</label>
            <textarea name="svgMarkup" rows="12" spellcheck="false"></textarea>
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
      const svgFile = richSvgFileFromMarkup(modal.querySelector("[name='svgMarkup']")?.value || "");
      if (!svgFile) {
        showToast("Paste valid SVG markup.");
        modal.querySelector("[name='svgMarkup']")?.focus();
        return;
      }

      finish(svgFile);
    });
    modal.addEventListener("cancel", event => {
      event.preventDefault();
      finish(null);
    });

    modal.showModal();
    setTimeout(() => modal.querySelector("[name='svgMarkup']")?.focus(), 0);
  });
}

function openRichSourceDialog(editor) {
  const modal = document.createElement("dialog");
  modal.className = "dialog rich-source-dialog";
  modal.innerHTML = `
    <form method="dialog">
      <div class="dialog-head">
        <h2>View Source</h2>
        <button type="button" class="icon-btn" data-close-rich-source title="Close" aria-label="Close">x</button>
      </div>
      <div class="dialog-body">
        <div class="field full">
          <div class="rich-source-dialog-toolbar">
            <label class="inline-check rich-source-wrap-option">
              <input type="checkbox" data-rich-source-wrap checked>
              <span>Word Wrap</span>
            </label>
          </div>
          <textarea name="sourceHtml" rows="16" spellcheck="false" wrap="soft" class="is-word-wrapped">${escapeHtml(editor.innerHTML || "")}</textarea>
        </div>
      </div>
      <div class="dialog-actions">
        <div class="dialog-action-group is-left">
          <button type="button" class="secondary" data-copy-rich-source>Copy to Clipboard</button>
        </div>
        <div class="dialog-action-group">
          <button type="button" class="secondary text-icon-button" data-close-rich-source>${buttonContent("&#10005;", "Cancel")}</button>
          <button type="submit" class="primary text-icon-button">${buttonContent("&#10003;", "Apply")}</button>
        </div>
      </div>
    </form>
  `;

  document.body.appendChild(modal);
  initializeWindowedDialog(modal);
  const sourceTextarea = modal.querySelector("[name='sourceHtml']");

  modal.querySelector("[data-rich-source-wrap]")?.addEventListener("change", event => {
    const wrapped = event.target.checked;
    sourceTextarea?.classList.toggle("is-word-wrapped", wrapped);
    sourceTextarea?.setAttribute("wrap", wrapped ? "soft" : "off");
    if (wrapped && sourceTextarea) sourceTextarea.scrollLeft = 0;
  });
  modal.querySelector("[data-copy-rich-source]")?.addEventListener("click", async () => {
    const copied = await copyTextToClipboard(sourceTextarea?.value || "", sourceTextarea);
    showToast(copied ? "Copied source to clipboard." : "Unable to copy source.");
  });
  modal.querySelectorAll("[data-close-rich-source]").forEach(button => {
    button.addEventListener("click", () => modal.close());
  });
  modal.querySelector("form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const result = await externalizeImportedHtmlImages(sourceTextarea?.value || "");
    if (result.failed) {
      showToast("One or more embedded images could not be uploaded. The source was not applied.");
      return;
    }
    editor.innerHTML = result.html;
    normalizeLinksInElement(editor);
    hydrateRichDiagramOleBlocks(editor);
    modal.close();
  });
  modal.addEventListener("close", () => {
    modal.remove();
  });
  modal.showModal();
  setTimeout(() => modal.querySelector("[name='sourceHtml']")?.focus({ preventScroll: true }), 0);
}

async function insertRichUploadedImage(editor, file, savedSelection = null) {
  const upload = await uploadFile("richtext", file);
  editor.focus({ preventScroll: true });
  restoreEditorSelection(savedSelection);
  document.execCommand("insertHTML", false, richUploadedImageHtml(upload));
}

async function insertRichTextDiagram(editor, savedSelection) {
  let uploadedDiagram = null;
  try {
    const result = await openImageAnnotationDialog({
      canvasWidth: 1600,
      canvasHeight: 900,
      originalFileName: "diagram.svg",
      title: "Diagram",
      subtitle: "Editable vector diagram",
      applyLabel: "Insert Diagram",
      applyingMessage: "Uploading the diagram...",
      initialSelection: "none",
      askForColor: current => askForText("HEX (#126BFF) or RGB (18, 107, 255)", "Custom Color", current),
      askForText,
      bindRichTextButtons,
      confirm: askYesNo,
      notify: showToast,
      uploadEmbeddedImage: uploadRichTextCanvasImage,
      loadTemplateLibrary: () => api("/api/image-annotation/template-library", { cache: "no-store" }),
      loadDefaultTemplateLibrary: () => api("/api/image-annotation/default-template-library", { cache: "no-store" }),
      saveTemplateLibrary: library => saveJson("/api/image-annotation/template-library", "PUT", library),
      apply: async annotation => {
        if (!editor.isConnected) throw new Error("The rich-text editor is no longer open.");
        const file = new File([annotation.svg], annotation.fileName, { type: "image/svg+xml" });
        uploadedDiagram = await uploadFile("richtext", file);
      }
    });
    if (!result || !uploadedDiagram || !editor.isConnected) return;

    editor.focus({ preventScroll: true });
    restoreEditorSelection(savedSelection);
    document.execCommand("insertHTML", false, richUploadedDiagramHtml(uploadedDiagram, result.state?.version));
    showToast("Diagram inserted. Save the record to keep it.");
  } catch (error) {
    showToast(error.message || "The Diagram could not be inserted.");
  }
}

function richUploadedDiagramHtml(upload, version) {
  return `<img class="rich-svg-image pmt-annotation-image" src="${escapeAttr(appUrl(upload.url))}" alt="Diagram" data-pmt-annotation-version="${escapeAttr(Number(version || 1))}">`;
}

async function insertRichLinkedDiagram(editor, savedSelection) {
  try {
    await loadState();
    const diagram = await askForRichLinkedDiagram();
    if (!diagram || !editor.isConnected) return;

    editor.focus({ preventScroll: true });
    restoreEditorSelection(savedSelection);
    insertRichHtmlAtSelection(editor, richLinkedDiagramHtml(diagram));
    hydrateRichDiagramOleBlocks(editor);
    showToast("Linked Diagram inserted. Save the document to keep the link.");
  } catch (error) {
    showToast(error.message || "The linked Diagram could not be inserted.");
  }
}

function richLinkedDiagramHtml(diagram) {
  const blockId = createRichDiagramOleBlockId();
  const header = `Linked Diagram: ${diagram.title || "Diagram"}`;
  const tab = {
    id: createRichDiagramOleTabId(),
    diagramId: Number(diagram.id),
    title: diagram.title || "Diagram"
  };
  return `
    <figure class="pmt-diagram-ole" contenteditable="false" data-pmt-ole="diagram" data-diagram-id="${escapeAttr(diagram.id)}" data-block-id="${escapeAttr(blockId)}" data-active-tab-id="${escapeAttr(tab.id)}" data-tabs="${escapeAttr(JSON.stringify([tab]))}" data-header="${escapeAttr(header)}" data-view-width="900" data-view-height="520" style="width: 900px; height: 520px;">
      <figcaption>${escapeHtml(header)}</figcaption>
    </figure>
    <p><br></p>
  `;
}

const diagramOleViewerSourceCache = new Map();
const diagramOleViewerSourceLoads = new Map();
const RICH_DIAGRAM_OLE_MIN_ZOOM = 0.01;
const RICH_DIAGRAM_OLE_MAX_ZOOM = 5;

function diagramOleDocuments() {
  return state.blogs
    .filter(blog => diagramOleCanRead(blog) && diagramOleSource(blog))
    .sort((first, second) => Date.parse(second.updatedAt || second.createdAt || "")
      - Date.parse(first.updatedAt || first.createdAt || "")
      || String(first.title || "").localeCompare(String(second.title || "")));
}

function diagramOleCanRead(blog) {
  return Boolean(blog)
    && (blog.isPrivate === false || Number(blog.createdByUserId || 0) === Number(currentUserId || 0));
}

function diagramOleSource(blog) {
  const template = document.createElement("template");
  template.innerHTML = String(blog?.bodyHtml || "");
  return String(template.content.querySelector("img[data-pmt-diagram='true'], img[data-pmt-private-diagram='true']")?.getAttribute("src") || "").trim();
}

function diagramOleSourceUrl(blog) {
  const source = diagramOleSource(blog);
  if (!source) return "";
  if (/^data:/i.test(source)) return source;
  const url = appUrl(source);
  const version = Date.parse(blog?.updatedAt || blog?.createdAt || "") || Number(blog?.id || 0);
  return `${url}${url.includes("?") ? "&" : "?"}pmtOleVersion=${encodeURIComponent(version)}`;
}

function diagramOleSourceVersion(blog) {
  return Date.parse(blog?.updatedAt || blog?.createdAt || "") || Number(blog?.id || 0);
}

function diagramOleViewerSourceCacheKey(blog) {
  return `${diagramOleSource(blog)}:${diagramOleSourceVersion(blog)}`;
}

function diagramOleSourceIsSvg(sourceInput) {
  const source = String(sourceInput || "").trim();
  return /^data:image\/svg\+xml(?:;|,)/i.test(source)
    || /\.svg(?:[?#]|$)/i.test(source);
}

async function diagramOleViewerSourceUrl(blog) {
  const fallbackSourceUrl = diagramOleSourceUrl(blog);
  const source = diagramOleSource(blog);
  if (!source || !diagramOleSourceIsSvg(source)) return fallbackSourceUrl;

  const cacheKey = diagramOleViewerSourceCacheKey(blog);
  if (diagramOleViewerSourceCache.has(cacheKey)) return diagramOleViewerSourceCache.get(cacheKey) || fallbackSourceUrl;
  if (diagramOleViewerSourceLoads.has(cacheKey)) return diagramOleViewerSourceLoads.get(cacheKey);

  const load = (async () => {
    try {
      const svg = await loadDiagramOleSvgSource(source);
      const diagramState = parseAnnotationSvg(svg);
      if (!diagramState) {
        diagramOleViewerSourceCache.set(cacheKey, fallbackSourceUrl);
        return fallbackSourceUrl;
      }

      const viewerSource = annotationSvgDataUrl(buildAnnotationSvg(diagramState, {
        entityHeaderButtonsVisible: false
      }));
      diagramOleViewerSourceCache.set(cacheKey, viewerSource);
      return viewerSource;
    } catch {
      diagramOleViewerSourceCache.set(cacheKey, fallbackSourceUrl);
      return fallbackSourceUrl;
    } finally {
      diagramOleViewerSourceLoads.delete(cacheKey);
    }
  })();

  diagramOleViewerSourceLoads.set(cacheKey, load);
  return load;
}

async function loadDiagramOleSvgSource(sourceInput) {
  const source = String(sourceInput || "").trim();
  if (!source) return "";
  const embedded = decodeDiagramOleSvgDataUrl(source);
  if (embedded) return embedded;

  const response = await fetch(appUrl(source), {
    cache: "no-store",
    credentials: "same-origin"
  });
  if (!response.ok) return "";
  const svg = await response.text();
  return /<svg(?:\s|>)/i.test(svg) ? svg : "";
}

function decodeDiagramOleSvgDataUrl(sourceInput) {
  const source = String(sourceInput || "");
  const separator = source.indexOf(",");
  if (separator < 0 || !/^data:image\/svg\+xml(?:;|,)/i.test(source)) return "";

  try {
    const metadata = source.slice(0, separator).toLowerCase();
    const payload = source.slice(separator + 1);
    if (!metadata.includes(";base64")) return decodeURIComponent(payload);
    const binary = atob(payload.replace(/\s+/g, ""));
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

function askForRichLinkedDiagram(options = {}) {
  const diagrams = diagramOleDocuments();
  if (!diagrams.length) {
    showToast("Create a Diagram first, then insert it as a linked Diagram.");
    return Promise.resolve(null);
  }

  return new Promise(resolve => {
    let selectedId = diagrams.some(diagram => diagram.id === Number(options.selectedId || 0))
      ? Number(options.selectedId || 0)
      : diagrams[0]?.id || 0;
    let search = "";
    const dialogTitle = options.title || "Insert Linked Diagram";
    const actionLabel = options.actionLabel || "Insert Linked Diagram";
    const modal = document.createElement("dialog");
    modal.className = "dialog pmt-diagram-ole-picker-dialog";
    modal.innerHTML = `
      <form method="dialog">
        <div class="dialog-head">
          <h2>${escapeHtml(dialogTitle)}</h2>
          <button type="button" class="icon-btn" data-close title="Close" aria-label="Close">x</button>
        </div>
        <div class="dialog-body pmt-diagram-ole-picker-body">
          <label class="field">
            <span>Search Diagrams</span>
            <input type="search" data-diagram-ole-search placeholder="Search by name, project, or sprint">
          </label>
          <div class="pmt-diagram-ole-picker-list" data-diagram-ole-picker-list role="listbox" aria-label="Available Diagrams"></div>
        </div>
        <div class="dialog-actions">
          <button type="button" class="secondary text-icon-button" data-close>${buttonContent("&#10005;", "Cancel")}</button>
          <button type="button" class="primary text-icon-button" data-insert-linked-diagram>${buttonContent("&#10003;", actionLabel)}</button>
        </div>
      </form>
    `;

    const filteredDiagrams = () => {
      const needle = search.trim().toLowerCase();
      if (!needle) return diagrams;
      return diagrams.filter(diagram => [
        diagram.title,
        projectName(diagram.projectId),
        sprintName(diagram.sprintId)
      ].some(value => String(value || "").toLowerCase().includes(needle)));
    };
    const render = () => {
      const list = modal.querySelector("[data-diagram-ole-picker-list]");
      const items = filteredDiagrams();
      if (!items.some(item => item.id === selectedId)) selectedId = items[0]?.id || 0;
      list.innerHTML = items.length
        ? items.map(diagram => richLinkedDiagramPickerItemHtml(diagram, diagram.id === selectedId)).join("")
        : `<div class="empty">No diagrams match your search.</div>`;
      modal.querySelector("[data-insert-linked-diagram]").disabled = !selectedId;
    };

    modal.addEventListener("click", event => {
      const close = event.target.closest("[data-close]");
      if (close) {
        modal.close("cancel");
        return;
      }

      const item = event.target.closest("[data-diagram-ole-picker-item]");
      if (item) {
        selectedId = Number(item.dataset.id || 0);
        render();
        return;
      }

      if (event.target.closest("[data-insert-linked-diagram]")) modal.close("insert");
    });
    modal.addEventListener("input", event => {
      if (!event.target.matches("[data-diagram-ole-search]")) return;
      search = event.target.value || "";
      render();
    });
    modal.addEventListener("keydown", event => {
      if (event.key === "Enter" && event.target.closest("[data-diagram-ole-picker-item]")) {
        event.preventDefault();
        modal.close("insert");
      }
    });
    modal.addEventListener("close", () => {
      const selected = modal.returnValue === "insert"
        ? diagrams.find(diagram => diagram.id === selectedId) || null
        : null;
      modal.remove();
      resolve(selected);
    }, { once: true });

    document.body.appendChild(modal);
    render();
    modal.showModal();
    modal.querySelector("[data-diagram-ole-search]")?.focus({ preventScroll: true });
  });
}

function richLinkedDiagramPickerItemHtml(diagram, selected) {
  const meta = [
    projectName(diagram.projectId) || "Global",
    sprintName(diagram.sprintId),
    `Updated ${formatDate(diagram.updatedAt || diagram.createdAt)}`
  ].filter(Boolean).join(" · ");
  return `
    <button type="button" class="pmt-diagram-ole-picker-item ${selected ? "is-selected" : ""}" data-diagram-ole-picker-item data-id="${escapeAttr(diagram.id)}" role="option" aria-selected="${selected}">
      <span class="pmt-diagram-ole-picker-thumb"><img src="${escapeAttr(diagramOleSourceUrl(diagram))}" alt="" loading="lazy"></span>
      <span class="pmt-diagram-ole-picker-text">
        <span class="pmt-diagram-ole-picker-title">${escapeHtml(diagram.title || "Diagram")}</span>
        <span class="muted">${escapeHtml(meta)}</span>
      </span>
    </button>
  `;
}

function hydrateRichDiagramOleBlocks(root = document) {
  const blocks = [];
  if (root?.matches?.("[data-pmt-ole='diagram']")) blocks.push(root);
  root?.querySelectorAll?.("[data-pmt-ole='diagram']").forEach(block => blocks.push(block));
  ensureRichDiagramOleBlockIds(blocks);
  blocks.forEach(hydrateRichDiagramOleBlock);
  syncRichDiagramOleMaximizedBodyClass();
}

function ensureRichDiagramOleBlockIds(blocks) {
  const usedByScope = new Map();
  blocks.forEach(block => {
    const scope = block.closest?.(".rich-editor, [data-rich-persist-type]") || block.parentElement || document.body;
    const usedBlockIds = usedByScope.get(scope) || new Set();
    let blockId = String(block.dataset.blockId || "").trim();
    if (!blockId || usedBlockIds.has(blockId)) {
      blockId = createRichDiagramOleBlockId(usedBlockIds);
      block.dataset.blockId = blockId;
    }
    usedBlockIds.add(blockId);
    usedByScope.set(scope, usedBlockIds);
  });
}

function createRichDiagramOleBlockId(usedBlockIds = new Set()) {
  let blockId = "";
  do {
    blockId = `pmt-ole-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  } while (usedBlockIds.has(blockId));
  return blockId;
}

function createRichDiagramOleTabId(usedTabIds = new Set()) {
  let tabId = "";
  do {
    tabId = `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  } while (usedTabIds.has(tabId));
  return tabId;
}

function hydrateRichDiagramOleBlock(block) {
  let tabs = richDiagramOleTabs(block);
  let activeTab = richDiagramOleActiveTab(block, tabs);
  const width = Math.max(320, Math.round(Number(block.dataset.viewWidth || block.style.width?.replace("px", "") || 900) || 900));
  const height = Math.max(220, Math.round(Number(block.dataset.viewHeight || block.style.height?.replace("px", "") || 520) || 520));
  const editable = Boolean(block.closest(".rich-editor"));
  block.classList.add("pmt-diagram-ole");
  block.setAttribute("contenteditable", "false");
  block.dataset.viewWidth = String(width);
  block.dataset.viewHeight = String(height);
  block.style.width = `${width}px`;
  block.style.height = `${height}px`;
  if (tabs.length && activeTab) {
    richDiagramOleWriteTabs(block, tabs, activeTab.id, { includeCurrent: true });
    tabs = richDiagramOleTabs(block);
    activeTab = richDiagramOleActiveTab(block, tabs);
  }

  if (!activeTab) {
    block.classList.remove("is-maximized");
    syncRichDiagramOleMaximizedBodyClass();
    delete block.dataset.diagramOleHydratedKey;
    block.innerHTML = `
      <figcaption class="pmt-diagram-ole-caption">Linked Diagram unavailable</figcaption>
      <div class="pmt-diagram-ole-placeholder">This linked Diagram could not be found or you do not have permission to view it.</div>
    `;
    return;
  }

  const diagram = richDiagramOleDiagramForTab(activeTab);
  const title = activeTab.title || diagram?.title || "Diagram";
  const header = richDiagramOleHeader(block, activeTab, diagram);
  const sourceUrl = diagram ? diagramOleSourceUrl(diagram) : "";
  const hydratedKey = `${block.dataset.activeTabId || activeTab.id}:${richDiagramOleTabsSignature(tabs)}:${richDiagramOleSourceSignature(tabs)}:${width}:${height}:${editable ? "edit" : "read"}`;
  block.dataset.header = header;
  if (block.dataset.diagramOleHydratedKey === hydratedKey
    && block.querySelector("[data-diagram-ole-viewport]")) {
    const headerNode = block.querySelector("[data-diagram-ole-header]");
    if (headerNode) headerNode.textContent = header;
    if (diagram) refreshRichDiagramOleViewerSource(block, diagram, sourceUrl, activeTab);
    bindRichDiagramOleViewer(block, diagram, activeTab, tabs);
    bindRichDiagramOleResizePersistence(block, diagram, activeTab);
    return;
  }
  block.dataset.diagramOleHydratedKey = hydratedKey;
  delete block.dataset.diagramOleViewerBound;
  delete block.dataset.diagramOleResizeBound;
  block.innerHTML = `
    <figcaption class="pmt-diagram-ole-caption">
      <span data-diagram-ole-header>${escapeHtml(header)}</span>
      <span class="pmt-diagram-ole-actions">
        <button type="button" data-diagram-ole-zoom-out title="Zoom out" aria-label="Zoom out">-</button>
        <button type="button" data-diagram-ole-reset title="Reset to the saved initial view" aria-label="Reset to saved initial view">Reset</button>
        <button type="button" data-diagram-ole-fit title="Fit the whole Diagram in the viewer" aria-label="Fit Diagram to viewer">Fit</button>
        <button type="button" data-diagram-ole-maximize title="Maximize Linked Diagram viewer" aria-label="Maximize Linked Diagram viewer">Max</button>
        <button type="button" data-diagram-ole-zoom-in title="Zoom in" aria-label="Zoom in">+</button>
        ${editable ? `<button type="button" data-diagram-ole-edit-action data-diagram-ole-rename-header title="Rename the viewer header" aria-label="Rename Linked Diagram viewer header">Rename</button>` : ""}
        ${editable ? `<button type="button" data-diagram-ole-edit-action data-diagram-ole-change title="Change the active tab's Diagram" aria-label="Change active tab Diagram">Change</button>` : ""}
        ${editable ? `<button type="button" class="pmt-diagram-ole-delete-action" data-diagram-ole-edit-action data-diagram-ole-delete title="Delete linked Diagram" aria-label="Delete linked Diagram">&#128465;</button>` : ""}
      </span>
    </figcaption>
    ${richDiagramOleTabsHtml(tabs, activeTab.id, editable)}
    <div class="pmt-diagram-ole-viewport" data-diagram-ole-viewport tabindex="0" aria-label="${escapeAttr(`${title} linked Diagram viewer`)}">
      ${diagram
        ? `<div class="pmt-diagram-ole-surface" data-diagram-ole-surface>
            <img src="${escapeAttr(sourceUrl)}" alt="${escapeAttr(title)}" draggable="false">
          </div>`
        : `<div class="pmt-diagram-ole-placeholder">This linked Diagram tab could not be found or you do not have permission to view it.</div>`}
    </div>
  `;

  if (diagram) refreshRichDiagramOleViewerSource(block, diagram, sourceUrl, activeTab);
  bindRichDiagramOleViewer(block, diagram, activeTab, tabs);
  bindRichDiagramOleResizePersistence(block, diagram, activeTab);
}

function richDiagramOleTabsHtml(tabs, activeTabId, editable) {
  if (!tabs.length) return "";
  if (!editable && tabs.length <= 1) return "";
  const tabButtons = tabs.map((tab, index) => {
    const active = tab.id === activeTabId;
    return `
      <button type="button" class="pmt-diagram-ole-tab ${active ? "is-active" : ""}" data-diagram-ole-tab data-tab-id="${escapeAttr(tab.id)}" role="tab" aria-selected="${active}" aria-label="${escapeAttr(`Show ${tab.title || `Diagram ${index + 1}`}`)}">
        <span>${escapeHtml(tab.title || `Diagram ${index + 1}`)}</span>
      </button>
    `;
  }).join("");
  const editActions = editable
    ? `<span class="pmt-diagram-ole-tab-actions">
        <button type="button" data-diagram-ole-edit-action data-diagram-ole-add-tab title="Add a Diagram tab">+ Tab</button>
        <button type="button" data-diagram-ole-edit-action data-diagram-ole-rename-tab title="Rename the active tab">Rename</button>
        <button type="button" data-diagram-ole-edit-action data-diagram-ole-move-tab-left title="Move active tab left">&#8592;</button>
        <button type="button" data-diagram-ole-edit-action data-diagram-ole-move-tab-right title="Move active tab right">&#8594;</button>
        <button type="button" data-diagram-ole-edit-action data-diagram-ole-delete-tab title="Delete the active tab">Delete Tab</button>
      </span>`
    : "";
  return `
    <div class="pmt-diagram-ole-tabs" data-diagram-ole-tabs>
      <div class="pmt-diagram-ole-tab-strip" role="tablist" aria-label="Linked Diagram pages">${tabButtons}</div>
      ${editActions}
    </div>
  `;
}

function richDiagramOleHeader(block, activeTab = null, diagram = null) {
  const storedHeader = String(block.dataset.header || "").trim();
  if (storedHeader) return storedHeader;
  const caption = block.querySelector("figcaption");
  if (caption) {
    const captionCopy = caption.cloneNode(true);
    captionCopy.querySelectorAll("button, .pmt-diagram-ole-actions, .pmt-diagram-ole-tab-actions").forEach(node => node.remove());
    const captionText = captionCopy.textContent.replace(/\s+/g, " ").trim();
    if (captionText) return captionText;
  }
  return `Linked Diagram: ${activeTab?.title || diagram?.title || "Diagram"}`;
}

function refreshRichDiagramOleViewerSource(block, diagram, fallbackSourceUrl, activeTab = null) {
  const requestKey = `${activeTab?.id || "tab"}:${diagram?.id || 0}:${fallbackSourceUrl}:${diagramOleSourceVersion(diagram)}`;
  block.dataset.diagramOleSourceRequestKey = requestKey;
  diagramOleViewerSourceUrl(diagram).then(viewerSourceUrl => {
    if (!block.isConnected || block.dataset.diagramOleSourceRequestKey !== requestKey) return;
    const image = block.querySelector("[data-diagram-ole-surface] img");
    if (!image || !viewerSourceUrl || image.getAttribute("src") === viewerSourceUrl) return;
    image.setAttribute("src", viewerSourceUrl);
  });
}

function bindRichDiagramOleViewer(block, diagram, activeTab, tabs) {
  const viewport = block.querySelector("[data-diagram-ole-viewport]");
  const surface = block.querySelector("[data-diagram-ole-surface]");
  if (!viewport) return;
  if (block.dataset.diagramOleViewerBound === "true") return;
  block.dataset.diagramOleViewerBound = "true";

  const hasStoredView = diagram ? hasRichDiagramOleViewport(block, diagram, activeTab) : false;
  let view = diagram ? readRichDiagramOleViewport(block, diagram, activeTab) : { x: 0, y: 0, zoom: 1 };
  const clampZoom = value => Math.min(RICH_DIAGRAM_OLE_MAX_ZOOM, Math.max(RICH_DIAGRAM_OLE_MIN_ZOOM, Number(value || 1)));
  const render = (options = {}) => {
    if (!surface || !diagram) return;
    view.zoom = clampZoom(view.zoom);
    view.x = Math.round(Number(view.x || 0));
    view.y = Math.round(Number(view.y || 0));
    const hasMeasuredDiagram = clampRichDiagramOleViewport(block, viewport, surface, view);
    surface.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;
    if (hasMeasuredDiagram && options.remember) {
      rememberRichDiagramOleViewport(block, diagram, activeTab, view, { notify: options.notify === true });
    }
  };
  const zoomBy = (factor, anchor = null) => {
    if (!diagram) return;
    const previousZoom = clampZoom(view.zoom);
    const nextZoom = clampZoom(previousZoom * factor);
    const anchorPoint = anchor || {
      x: Math.max(1, viewport.clientWidth || 0) / 2,
      y: Math.max(1, viewport.clientHeight || 0) / 2
    };
    const diagramX = (anchorPoint.x - Number(view.x || 0)) / previousZoom;
    const diagramY = (anchorPoint.y - Number(view.y || 0)) / previousZoom;
    view = {
      ...view,
      x: anchorPoint.x - diagramX * nextZoom,
      y: anchorPoint.y - diagramY * nextZoom,
      zoom: nextZoom
    };
    render({ remember: true, notify: true });
  };
  const fitView = (options = {}) => {
    if (!surface || !diagram) return;
    const image = surface.querySelector("img");
    const viewportWidth = Math.round(viewport.clientWidth || 0);
    const viewportHeight = Math.round(viewport.clientHeight || 0);
    const imageWidth = Math.max(1, image?.naturalWidth || image?.clientWidth || 0);
    const imageHeight = Math.max(1, image?.naturalHeight || image?.clientHeight || 0);
    if (!richDiagramOleViewportHasLayout(viewport) || !viewportWidth || !viewportHeight || !imageWidth || !imageHeight) return;

    const zoom = clampZoom(Math.min(viewportWidth / imageWidth, viewportHeight / imageHeight));
    view = {
      x: Math.round((viewportWidth - imageWidth * zoom) / 2),
      y: Math.round((viewportHeight - imageHeight * zoom) / 2),
      zoom
    };
    render(options);
  };
  const resetView = () => {
    const initialView = richDiagramOleInitialViewport(block, activeTab);
    if (initialView) {
      view = { ...initialView };
      render({ remember: true, notify: true });
      return;
    }

    fitView({ remember: true, notify: true });
  };
  const setMaximized = maximized => {
    const nextMaximized = Boolean(maximized);
    block.classList.toggle("is-maximized", nextMaximized);
    rememberRichDiagramOleMaximized(block, nextMaximized);
    if (nextMaximized) document.body.classList.add("has-pmt-diagram-ole-maximized");
    else syncRichDiagramOleMaximizedBodyClass();
    const button = block.querySelector("[data-diagram-ole-maximize]");
    if (button) {
      button.textContent = nextMaximized ? "Restore" : "Max";
      button.setAttribute("aria-label", nextMaximized ? "Restore Linked Diagram viewer" : "Maximize Linked Diagram viewer");
      button.setAttribute("title", nextMaximized ? "Restore Linked Diagram viewer" : "Maximize Linked Diagram viewer");
    }
    requestAnimationFrame(() => render());
  };
  const storedMaximized = readRichDiagramOleStoredMaximized(block);
  if (storedMaximized !== null) setMaximized(storedMaximized);
  else if (block.classList.contains("is-maximized")) setMaximized(true);
  block.addEventListener("diagram-ole-resized", () => render());
  block.querySelector("[data-diagram-ole-zoom-out]")?.addEventListener("click", () => zoomBy(0.85));
  block.querySelector("[data-diagram-ole-zoom-in]")?.addEventListener("click", () => zoomBy(1.15));
  block.querySelector("[data-diagram-ole-reset]")?.addEventListener("click", resetView);
  block.querySelector("[data-diagram-ole-fit]")?.addEventListener("click", () => fitView({ remember: true, notify: true }));
  block.querySelector("[data-diagram-ole-maximize]")?.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    setMaximized(!block.classList.contains("is-maximized"));
  });
  ["pointerdown", "mousedown"].forEach(eventName => {
    block.addEventListener(eventName, event => {
      if (!event.target.closest?.("[data-diagram-ole-edit-action]")) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    }, true);
  });
  block.querySelectorAll("[data-diagram-ole-tab]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      const tabId = button.dataset.tabId || "";
      if (!tabId || tabId === block.dataset.activeTabId) return;
      const nextTabs = richDiagramOleTabs(block);
      if (!nextTabs.some(tab => tab.id === tabId)) return;
      richDiagramOleWriteTabs(block, nextTabs, tabId, { includeCurrent: true });
      rehydrateRichDiagramOleBlock(block, { notify: Boolean(block.closest(".rich-editor")) });
    });
  });
  block.querySelector("[data-diagram-ole-delete]")?.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    deleteRichDiagramOleBlock(block.closest(".rich-editor"), block);
  });
  block.querySelector("[data-diagram-ole-rename-header]")?.addEventListener("click", async event => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    const editor = block.closest(".rich-editor");
    if (!editor) return;
    const currentHeader = richDiagramOleHeader(block, activeTab, diagram);
    const nextHeader = String(await askForText("Viewer header", "Rename Linked Diagram Header", currentHeader) || "").trim();
    if (!nextHeader || !editor.contains(block)) return;
    block.dataset.header = nextHeader;
    const headerNode = block.querySelector("[data-diagram-ole-header]");
    if (headerNode) headerNode.textContent = nextHeader;
    richDiagramOleDispatchInput(block);
    showToast("Linked Diagram header renamed. Save the record to keep it.");
  });
  block.querySelector("[data-diagram-ole-add-tab]")?.addEventListener("click", async event => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    const editor = block.closest(".rich-editor");
    if (!editor) return;
    const nextDiagram = await askForRichLinkedDiagram({
      title: "Add Linked Diagram Tab",
      actionLabel: "Add Tab"
    });
    if (!nextDiagram || !editor.contains(block)) return;

    const nextTabs = richDiagramOleTabs(block);
    const usedTabIds = new Set(nextTabs.map(tab => tab.id));
    const nextTab = {
      id: createRichDiagramOleTabId(usedTabIds),
      diagramId: Number(nextDiagram.id),
      title: nextDiagram.title || "Diagram"
    };
    nextTabs.push(nextTab);
    richDiagramOleWriteTabs(block, nextTabs, nextTab.id, { includeCurrent: true });
    rehydrateRichDiagramOleBlock(block, { notify: true });
    showToast("Linked Diagram tab added. Save the record to keep it.");
  });
  block.querySelector("[data-diagram-ole-rename-tab]")?.addEventListener("click", async event => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    const editor = block.closest(".rich-editor");
    if (!editor) return;
    const nextTabs = richDiagramOleTabs(block);
    const tab = richDiagramOleActiveTab(block, nextTabs);
    if (!tab) return;
    const nextTitle = String(await askForText("Tab name", "Rename Linked Diagram Tab", tab.title || "Diagram") || "").trim();
    if (!nextTitle || !editor.contains(block)) return;
    tab.title = nextTitle;
    richDiagramOleWriteTabs(block, nextTabs, tab.id, { includeCurrent: true });
    rehydrateRichDiagramOleBlock(block, { notify: true });
    showToast("Linked Diagram tab renamed. Save the record to keep it.");
  });
  block.querySelector("[data-diagram-ole-move-tab-left]")?.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    moveRichDiagramOleActiveTab(block, -1);
  });
  block.querySelector("[data-diagram-ole-move-tab-right]")?.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    moveRichDiagramOleActiveTab(block, 1);
  });
  block.querySelector("[data-diagram-ole-delete-tab]")?.addEventListener("click", async event => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    const editor = block.closest(".rich-editor");
    if (!editor) return;
    const nextTabs = richDiagramOleTabs(block);
    const tab = richDiagramOleActiveTab(block, nextTabs);
    if (!tab) return;
    if (nextTabs.length <= 1) {
      showToast("A Linked Diagram viewer needs at least one tab. Use the trash button to remove the whole viewer.");
      return;
    }
    const confirmed = await askYesNo(`Delete the "${tab.title || "Diagram"}" tab?`, "Delete Linked Diagram Tab", "Delete Tab");
    if (!confirmed || !editor.contains(block)) return;
    const index = nextTabs.findIndex(item => item.id === tab.id);
    nextTabs.splice(index, 1);
    const nextActive = nextTabs[Math.max(0, Math.min(index, nextTabs.length - 1))];
    richDiagramOleWriteTabs(block, nextTabs, nextActive?.id, { includeCurrent: true });
    rehydrateRichDiagramOleBlock(block, { notify: true });
    showToast("Linked Diagram tab deleted. Save the record to keep it.");
  });
  block.querySelector("[data-diagram-ole-change]")?.addEventListener("click", async event => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    const editor = block.closest(".rich-editor");
    if (!editor) return;
    const nextDiagram = await askForRichLinkedDiagram({
      selectedId: diagram?.id || activeTab?.diagramId,
      title: "Change Linked Diagram Tab",
      actionLabel: "Change Tab Diagram"
    });
    if (!nextDiagram || !editor.contains(block)) return;

    const nextTabs = richDiagramOleTabs(block);
    const tab = richDiagramOleActiveTab(block, nextTabs);
    if (!tab) return;
    tab.diagramId = Number(nextDiagram.id);
    tab.title = nextDiagram.title || tab.title || "Diagram";
    delete tab.view;
    delete tab.currentView;
    richDiagramOleWriteTabs(block, nextTabs, tab.id, { includeCurrent: true });
    clearRichDiagramOleSavedView(block, tab);
    rehydrateRichDiagramOleBlock(block, { notify: true });
    showToast("Linked Diagram tab changed. Save the record to keep it.");
  });
  ["pointerdown", "pointermove", "pointerup", "pointercancel", "click", "dblclick"].forEach(eventName => {
    viewport.addEventListener(eventName, event => event.stopPropagation());
  });
  viewport.addEventListener("click", event => {
    event.stopPropagation();
  });
  viewport.addEventListener("wheel", event => {
    event.stopPropagation();
    event.preventDefault();
    if (!event.deltaY) return;
    const rect = viewport.getBoundingClientRect();
    zoomBy(event.deltaY < 0 ? 1.08 : 0.92, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
  }, { passive: false });

  let drag = null;
  viewport.addEventListener("auxclick", event => {
    if (event.button !== 1) return;
    event.preventDefault();
    event.stopPropagation();
  });
  viewport.addEventListener("pointerdown", event => {
    if ((event.button !== 0 && event.button !== 1) || event.target.closest("button")) return;
    if (richDiagramOlePointerIsInResizeCorner(block, event)) return;
    event.preventDefault();
    event.stopPropagation();
    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      viewX: view.x,
      viewY: view.y
    };
    viewport.setPointerCapture?.(event.pointerId);
    viewport.classList.add("is-panning");
  });
  viewport.addEventListener("pointermove", event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    view.x = drag.viewX + event.clientX - drag.startX;
    view.y = drag.viewY + event.clientY - drag.startY;
    render({ remember: true });
  });
  ["pointerup", "pointercancel"].forEach(eventName => {
    viewport.addEventListener(eventName, event => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      viewport.releasePointerCapture?.(event.pointerId);
      drag = null;
      viewport.classList.remove("is-panning");
      render({ remember: true, notify: true });
    });
  });
  block.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !block.classList.contains("is-maximized")) return;
    event.preventDefault();
    event.stopPropagation();
    setMaximized(false);
    viewport.focus({ preventScroll: true });
  });

  if (!diagram) return;

  if (hasStoredView) {
    render();
    const image = surface.querySelector("img");
    if (image && !richDiagramOleImageHasSize(image)) image.addEventListener("load", () => render(), { once: true });
  } else {
    const image = surface.querySelector("img");
    if (image?.complete) fitView();
    else image?.addEventListener("load", () => fitView(), { once: true });
  }
}

function richDiagramOlePointerIsInResizeCorner(block, event) {
  const rect = block?.getBoundingClientRect?.();
  if (!rect) return false;
  const resizeHitSize = 28;
  return event.clientX >= rect.right - resizeHitSize && event.clientY >= rect.bottom - resizeHitSize;
}

function moveRichDiagramOleActiveTab(block, direction) {
  const editor = block.closest(".rich-editor");
  if (!editor) return;
  const tabs = richDiagramOleTabs(block);
  const activeTab = richDiagramOleActiveTab(block, tabs);
  const index = tabs.findIndex(tab => tab.id === activeTab?.id);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= tabs.length) return;
  const [tab] = tabs.splice(index, 1);
  tabs.splice(nextIndex, 0, tab);
  richDiagramOleWriteTabs(block, tabs, tab.id, { includeCurrent: true });
  rehydrateRichDiagramOleBlock(block, { notify: true });
  showToast("Linked Diagram tab moved. Save the record to keep it.");
}

function rehydrateRichDiagramOleBlock(block, options = {}) {
  delete block.dataset.diagramOleHydratedKey;
  delete block.dataset.diagramOleViewerBound;
  delete block.dataset.diagramOleResizeBound;
  delete block.dataset.diagramOleSourceRequestKey;
  delete block.dataset.diagramOleViewClamped;
  hydrateRichDiagramOleBlock(block);
  if (options.notify) richDiagramOleDispatchInput(block);
}

function richDiagramOleDispatchInput(block) {
  block.closest(".rich-editor")?.dispatchEvent(new Event("input", { bubbles: true }));
}

function richDiagramOleTabs(block) {
  const usedTabIds = new Set();
  const tabs = [];
  try {
    const parsed = JSON.parse(block.dataset.tabs || "[]");
    if (Array.isArray(parsed)) {
      parsed.forEach((entry, index) => {
        const tab = richDiagramOleNormalizeTab(entry, index, usedTabIds);
        if (tab) {
          tabs.push(tab);
          usedTabIds.add(tab.id);
        }
      });
    }
  } catch {
    // Legacy single-Diagram OLEs are rebuilt from their original attributes below.
  }

  if (tabs.length) return tabs;

  const diagramId = Number(block.dataset.diagramId || 0);
  if (!diagramId) return [];
  const diagram = state.blogs.find(blog => blog.id === diagramId);
  return [{
    id: String(block.dataset.activeTabId || `tab-${diagramId}`),
    diagramId,
    title: diagram?.title || `Diagram #${diagramId}`,
    view: richDiagramOleViewportFromDataset(block, "view") || undefined,
    currentView: richDiagramOleViewportFromDataset(block, "currentView") || undefined
  }];
}

function richDiagramOleNormalizeTab(entry, index, usedTabIds = new Set()) {
  const diagramId = Number(entry?.diagramId || entry?.id || 0);
  if (!diagramId) return null;
  let id = String(entry?.tabId || entry?.key || entry?.id || "").trim();
  if (!id || id === String(diagramId) || usedTabIds.has(id)) id = createRichDiagramOleTabId(usedTabIds);
  const diagram = state.blogs.find(blog => blog.id === diagramId);
  const title = String(entry?.title || diagram?.title || `Diagram ${index + 1}`).trim() || `Diagram ${index + 1}`;
  return {
    id,
    diagramId,
    title,
    view: richDiagramOleViewportFromRecord(entry?.view) || undefined,
    currentView: richDiagramOleViewportFromRecord(entry?.currentView) || undefined
  };
}

function richDiagramOleWriteTabs(block, tabs, activeTabId, options = {}) {
  const normalizedTabs = [];
  const usedTabIds = new Set();
  tabs.forEach((entry, index) => {
    const tab = richDiagramOleNormalizeTab(entry, index, usedTabIds);
    if (!tab) return;
    if (!options.includeCurrent) delete tab.currentView;
    normalizedTabs.push(tab);
    usedTabIds.add(tab.id);
  });
  if (!normalizedTabs.length) {
    block.removeAttribute("data-tabs");
    block.removeAttribute("data-active-tab-id");
    return normalizedTabs;
  }

  const activeTab = normalizedTabs.find(tab => tab.id === activeTabId) || normalizedTabs[0];
  block.dataset.tabs = JSON.stringify(normalizedTabs.map(tab => ({
    id: tab.id,
    diagramId: tab.diagramId,
    title: tab.title,
    ...(tab.view ? { view: richDiagramOleRoundedView(tab.view) } : {}),
    ...(options.includeCurrent && tab.currentView ? { currentView: richDiagramOleRoundedView(tab.currentView) } : {})
  })));
  block.dataset.activeTabId = activeTab.id;
  block.dataset.diagramId = String(activeTab.diagramId);
  rememberRichDiagramOleActiveTab(block, activeTab.id);
  richDiagramOleWriteLegacyActiveView(block, activeTab, { includeCurrent: options.includeCurrent === true });
  return normalizedTabs;
}

function richDiagramOleWriteLegacyActiveView(block, activeTab, options = {}) {
  const writeView = (prefix, view) => {
    if (!view) {
      delete block.dataset[`${prefix}X`];
      delete block.dataset[`${prefix}Y`];
      delete block.dataset[`${prefix}Zoom`];
      return;
    }
    const rounded = richDiagramOleRoundedView(view);
    if (!rounded) {
      delete block.dataset[`${prefix}X`];
      delete block.dataset[`${prefix}Y`];
      delete block.dataset[`${prefix}Zoom`];
      return;
    }
    block.dataset[`${prefix}X`] = String(rounded.x);
    block.dataset[`${prefix}Y`] = String(rounded.y);
    block.dataset[`${prefix}Zoom`] = String(rounded.zoom);
  };
  writeView("view", activeTab?.view);
  if (options.includeCurrent) writeView("currentView", activeTab?.currentView);
  else writeView("currentView", null);
}

function richDiagramOleActiveTab(block, tabs = richDiagramOleTabs(block)) {
  const activeTabId = String(readRichDiagramOleStoredActiveTabId(block, tabs) || block.dataset.activeTabId || "");
  return tabs.find(tab => tab.id === activeTabId) || tabs[0] || null;
}

function richDiagramOleActiveTabStorageKey(block) {
  const { persistType, documentId } = richDiagramOlePersistScope(block);
  return `pmt-diagram-ole-active-tab:${persistType}:${documentId}:${block.dataset.blockId || "block"}`;
}

function richDiagramOlePersistScope(block) {
  const persist = block.closest("[data-rich-persist-type]");
  return {
    persistType: persist?.dataset.richPersistType || "draft",
    documentId: persist?.dataset.richPersistId || "draft"
  };
}

function readRichDiagramOleStoredActiveTabId(block, tabs = []) {
  if (block.closest(".rich-editor")) return "";
  try {
    const tabId = String(localStorage.getItem(richDiagramOleActiveTabStorageKey(block)) || "");
    return tabs.some(tab => tab.id === tabId) ? tabId : "";
  } catch {
    return "";
  }
}

function rememberRichDiagramOleActiveTab(block, tabId) {
  try {
    if (!tabId) return;
    localStorage.setItem(richDiagramOleActiveTabStorageKey(block), String(tabId));
  } catch {
    // Active tab memory is optional.
  }
}

function richDiagramOleMaximizedStorageKey(block) {
  const { persistType, documentId } = richDiagramOlePersistScope(block);
  return `pmt-diagram-ole-maximized:${persistType}:${documentId}:${block.dataset.blockId || "block"}`;
}

function readRichDiagramOleStoredMaximized(block) {
  if (block.closest(".rich-editor")) return null;
  try {
    const value = localStorage.getItem(richDiagramOleMaximizedStorageKey(block));
    return value === null ? null : value === "true";
  } catch {
    return null;
  }
}

function rememberRichDiagramOleMaximized(block, maximized) {
  if (block.closest(".rich-editor")) return;
  try {
    if (maximized) localStorage.setItem(richDiagramOleMaximizedStorageKey(block), "true");
    else localStorage.removeItem(richDiagramOleMaximizedStorageKey(block));
  } catch {
    // Maximized viewer memory is optional.
  }
}

function syncRichDiagramOleMaximizedBodyClass() {
  document.body.classList.toggle(
    "has-pmt-diagram-ole-maximized",
    Boolean(document.querySelector(".pmt-diagram-ole.is-maximized"))
  );
}

function richDiagramOleDiagramForTab(tab) {
  return state.blogs.find(blog => blog.id === Number(tab?.diagramId || 0) && diagramOleCanRead(blog) && diagramOleSource(blog)) || null;
}

function richDiagramOleTabsSignature(tabs) {
  return JSON.stringify(tabs.map(tab => ({
    id: tab.id,
    diagramId: tab.diagramId,
    title: tab.title,
    view: richDiagramOleRoundedView(tab.view),
    currentView: richDiagramOleRoundedView(tab.currentView)
  })));
}

function richDiagramOleSourceSignature(tabs) {
  return tabs.map(tab => {
    const diagram = richDiagramOleDiagramForTab(tab);
    return `${tab.id}:${tab.diagramId}:${diagramOleSourceVersion(diagram)}:${diagramOleSourceUrl(diagram)}`;
  }).join("|");
}

function deleteRichDiagramOleBlock(editor, block) {
  if (!editor?.contains(block) || !block?.isConnected) return;
  if (block.classList.contains("is-maximized")) {
    block.classList.remove("is-maximized");
    syncRichDiagramOleMaximizedBodyClass();
  }

  const blankLine = richBlankParagraphSibling(block.nextElementSibling) || document.createElement("p");
  if (!blankLine.isConnected) blankLine.innerHTML = "<br>";

  if (blankLine.parentElement === block.parentElement) {
    block.remove();
  } else {
    block.replaceWith(blankLine);
  }

  placeCaretInRichBlock(editor, blankLine);
  editor.dispatchEvent(new Event("input", { bubbles: true }));
}

function clampRichDiagramOleViewport(block, viewport, surface, view) {
  const image = surface.querySelector("img");
  const viewportWidth = Math.round(viewport.clientWidth || 0);
  const viewportHeight = Math.round(viewport.clientHeight || 0);
  const imageWidth = Math.max(0, image?.naturalWidth || image?.clientWidth || 0);
  const imageHeight = Math.max(0, image?.naturalHeight || image?.clientHeight || 0);
  if (!richDiagramOleViewportHasLayout(viewport) || !viewportWidth || !viewportHeight || !imageWidth || !imageHeight) return false;

  const zoom = Math.min(RICH_DIAGRAM_OLE_MAX_ZOOM, Math.max(RICH_DIAGRAM_OLE_MIN_ZOOM, Number(view.zoom || 1)));
  const scaledWidth = imageWidth * zoom;
  const scaledHeight = imageHeight * zoom;
  const visibleWidth = Math.max(1, Math.min(96, viewportWidth / 2, scaledWidth / 2));
  const visibleHeight = Math.max(1, Math.min(96, viewportHeight / 2, scaledHeight / 2));
  view.x = Math.round(clampNumber(Number(view.x || 0), visibleWidth - scaledWidth, viewportWidth - visibleWidth));
  view.y = Math.round(clampNumber(Number(view.y || 0), visibleHeight - scaledHeight, viewportHeight - visibleHeight));
  block.dataset.diagramOleViewClamped = "true";
  return true;
}

function richDiagramOleImageHasSize(image) {
  return Boolean(image && (image.naturalWidth || image.clientWidth) && (image.naturalHeight || image.clientHeight));
}

function richDiagramOleViewportHasLayout(viewport) {
  return Boolean(viewport?.isConnected && viewport.getClientRects().length && viewport.clientWidth && viewport.clientHeight);
}

function richDiagramOleStorageKey(block, diagram, tab = null) {
  const persist = block.closest("[data-rich-persist-type]");
  const documentId = persist?.dataset.richPersistId || "draft";
  return `pmt-diagram-ole:${documentId}:${diagram?.id || tab?.diagramId || block.dataset.diagramId || 0}:${block.dataset.blockId || "block"}:${tab?.id || block.dataset.activeTabId || "tab"}`;
}

function richDiagramOleViewportFromDataset(block, prefix = "view") {
  const x = Number(block?.dataset?.[`${prefix}X`]);
  const y = Number(block?.dataset?.[`${prefix}Y`]);
  const zoom = Number(block?.dataset?.[`${prefix}Zoom`]);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zoom) || zoom <= 0) return null;
  return { x, y, zoom };
}

function richDiagramOleViewportFromRecord(record) {
  const x = Number(record?.x);
  const y = Number(record?.y);
  const zoom = Number(record?.zoom);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zoom) || zoom <= 0) return null;
  return { x, y, zoom };
}

function richDiagramOleRoundedView(view) {
  if (!view) return null;
  const normalized = richDiagramOleViewportFromRecord(view);
  if (!normalized) return null;
  return {
    x: Math.round(normalized.x),
    y: Math.round(normalized.y),
    zoom: Math.round(normalized.zoom * 1000) / 1000
  };
}

function richDiagramOleInitialViewport(block, tab = null) {
  return richDiagramOleRoundedView(tab?.view) || richDiagramOleViewportFromDataset(block, "view");
}

function richDiagramOleCurrentViewport(block, tab = null) {
  return richDiagramOleRoundedView(tab?.currentView) || richDiagramOleViewportFromDataset(block, "currentView");
}

function richDiagramOleViewSignature(view) {
  if (!view) return "";
  return [
    Math.round(Number(view.x || 0)),
    Math.round(Number(view.y || 0)),
    Math.round(Number(view.zoom || 1) * 1000) / 1000
  ].join(":");
}

function readRichDiagramOleStoredViewportRecord(block, diagram, tab = null) {
  try {
    const parsed = JSON.parse(localStorage.getItem(richDiagramOleStorageKey(block, diagram, tab)) || "{}");
    const view = {
      x: Number(parsed.x || 0),
      y: Number(parsed.y || 0),
      zoom: Number(parsed.zoom || 1) || 1
    };
    if (!Number.isFinite(view.x) || !Number.isFinite(view.y) || !Number.isFinite(view.zoom) || view.zoom <= 0) return null;
    return {
      ...view,
      initialViewSignature: String(parsed.initialViewSignature || "")
    };
  } catch {
    return null;
  }
}

function readRichDiagramOleViewport(block, diagram, tab = null) {
  const currentView = richDiagramOleCurrentViewport(block, tab);
  if (currentView) return currentView;

  const initialView = richDiagramOleInitialViewport(block, tab);
  const initialSignature = richDiagramOleViewSignature(initialView);
  const storedView = readRichDiagramOleStoredViewportRecord(block, diagram, tab);
  if (storedView && (!initialSignature || storedView.initialViewSignature === initialSignature)) {
    return {
      x: storedView.x,
      y: storedView.y,
      zoom: storedView.zoom
    };
  }

  return initialView || { x: 0, y: 0, zoom: 1 };
}

function hasRichDiagramOleViewport(block, diagram, tab = null) {
  if (richDiagramOleCurrentViewport(block, tab) || richDiagramOleInitialViewport(block, tab)) return true;
  return Boolean(readRichDiagramOleStoredViewportRecord(block, diagram, tab));
}

function writeRichDiagramOleViewport(block, diagram, tab, view) {
  try {
    const initialView = richDiagramOleInitialViewport(block, tab);
    localStorage.setItem(richDiagramOleStorageKey(block, diagram, tab), JSON.stringify({
      x: Math.round(Number(view.x || 0)),
      y: Math.round(Number(view.y || 0)),
      zoom: Math.round(Number(view.zoom || 1) * 1000) / 1000,
      initialViewSignature: richDiagramOleViewSignature(initialView)
    }));
  } catch {
    // Viewport memory is optional.
  }
}

function writeRichDiagramOleCurrentViewport(block, tab, view) {
  const rounded = richDiagramOleRoundedView(view);
  if (!rounded) return;
  const tabs = richDiagramOleTabs(block);
  const activeTab = tabs.find(item => item.id === tab?.id) || richDiagramOleActiveTab(block, tabs);
  if (activeTab) {
    activeTab.currentView = rounded;
    richDiagramOleWriteTabs(block, tabs, activeTab.id, { includeCurrent: true });
    return;
  }
  block.dataset.currentViewX = String(rounded.x);
  block.dataset.currentViewY = String(rounded.y);
  block.dataset.currentViewZoom = String(rounded.zoom);
}

function clearRichDiagramOleSavedView(block, tab = null) {
  [
    "viewX",
    "viewY",
    "viewZoom",
    "currentViewX",
    "currentViewY",
    "currentViewZoom"
  ].forEach(name => {
    delete block.dataset[name];
  });
  if (!tab) return;
  const tabs = richDiagramOleTabs(block);
  const activeTab = tabs.find(item => item.id === tab.id);
  if (activeTab) {
    delete activeTab.view;
    delete activeTab.currentView;
    richDiagramOleWriteTabs(block, tabs, activeTab.id, { includeCurrent: true });
  }
}

function rememberRichDiagramOleViewport(block, diagram, tab, view, options = {}) {
  writeRichDiagramOleCurrentViewport(block, tab, view);
  writeRichDiagramOleViewport(block, diagram, tab, view);
  if (options.notify) {
    richDiagramOleDispatchInput(block);
  }
}

function bindRichDiagramOleResizePersistence(block, diagram, tab = null) {
  if (block.dataset.diagramOleResizeBound === "true") return;
  block.dataset.diagramOleResizeBound = "true";
  const sync = (options = {}) => {
    if (block.classList.contains("is-maximized")) return;
    const rect = block.getBoundingClientRect();
    const width = Math.max(320, Math.round(rect.width || Number(block.dataset.viewWidth || 900)));
    const height = Math.max(220, Math.round(rect.height || Number(block.dataset.viewHeight || 520)));
    block.dataset.viewWidth = String(width);
    block.dataset.viewHeight = String(height);
    block.style.width = `${width}px`;
    block.style.height = `${height}px`;
    if (options.notify) {
      richDiagramOleDispatchInput(block);
    }
    const currentView = richDiagramOleCurrentViewport(block, tab);
    if (diagram && currentView) writeRichDiagramOleViewport(block, diagram, tab, currentView);
    block.dispatchEvent(new CustomEvent("diagram-ole-resized"));
  };
  block.addEventListener("pointerup", () => sync({ notify: true }));
  block.addEventListener("keyup", () => sync({ notify: true }));
}

function richUploadedImageHtml(upload) {
  const classAttr = richUploadIsSvg(upload) ? ` class="rich-svg-image"` : "";
  return `<img${classAttr} src="${escapeAttr(appUrl(upload.url))}" alt="${escapeAttr(upload.fileName)}">`;
}

function richUploadIsSvg(upload) {
  const contentType = upload?.contentType || "";
  const fileName = upload?.fileName || "";
  const url = upload?.url || "";
  return /^image\/svg(?:\+xml)?$/i.test(contentType) || /\.svg$/i.test(fileName) || /\.svg(?:[?#]|$)/i.test(url);
}

function richImageFilesFromClipboard(clipboardData) {
  if (!clipboardData) return [];

  const itemFiles = [...(clipboardData.items || [])]
    .filter(item => item.kind === "file" && /^image\//i.test(item.type || ""))
    .map(item => item.getAsFile())
    .filter(Boolean);
  if (itemFiles.length) return itemFiles;

  return [...(clipboardData.files || [])]
    .filter(file => /^image\//i.test(file.type || ""));
}

function richClipboardDataImageHtml(clipboardData) {
  const source = clipboardData?.getData?.("text/html") || "";
  if (!source) return "";

  const container = document.createElement("div");
  container.innerHTML = source;
  const images = [...container.querySelectorAll("img[src]")]
    .filter(image => /^data:image\//i.test(image.getAttribute("src") || ""));
  return images.map(image => image.outerHTML).join("");
}

function richSvgFileFromClipboard(clipboardData) {
  if (!clipboardData) return null;

  const files = [...(clipboardData.files || [])];
  const file = files.find(richFileIsSvg);
  if (file) return file;

  const svgItem = [...(clipboardData.items || [])]
    .find(item => item.kind === "file" && /^image\/svg(?:\+xml)?$/i.test(item.type || ""));
  const itemFile = svgItem?.getAsFile();
  if (richFileIsSvg(itemFile)) return itemFile;

  const directSvg = clipboardData.getData("image/svg+xml");
  const directSvgFile = richSvgFileFromMarkup(directSvg);
  if (directSvgFile) return directSvgFile;

  const htmlSvgFile = richSvgFileFromMarkup(richSvgMarkupFromText(clipboardData.getData("text/html")));
  if (htmlSvgFile) return htmlSvgFile;

  return richSvgFileFromMarkup(richSvgMarkupFromText(clipboardData.getData("text/plain")));
}

function richFileIsSvg(file) {
  return !!file && (/^image\/svg(?:\+xml)?$/i.test(file.type || "") || /\.svg$/i.test(file.name || ""));
}

function richSvgFileFromMarkup(markup, fileName = richSvgFileName()) {
  const normalized = normalizeRichSvgMarkup(markup);
  if (!normalized) return null;

  return new File([normalized], fileName, { type: "image/svg+xml" });
}

function richSvgFileName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `drawio-diagram-${stamp}.svg`;
}

function richSvgMarkupFromText(value) {
  const source = String(value || "");
  if (!source.trim()) return "";

  const dataUrlSvg = richSvgMarkupFromDataUrl(source);
  if (dataUrlSvg) return dataUrlSvg;

  const candidates = [source];
  if (source.includes("&lt;svg") || source.includes("&lt;SVG")) {
    candidates.push(decodeRichHtmlEntities(source));
  }

  for (const candidate of candidates) {
    const start = candidate.search(/<svg(?:\s|>)/i);
    if (start < 0) continue;

    const end = candidate.toLowerCase().indexOf("</svg>", start);
    if (end < 0) continue;

    return candidate.slice(start, end + "</svg>".length);
  }

  return "";
}

function richSvgMarkupFromDataUrl(value) {
  const match = String(value || "").match(/data:image\/svg\+xml(?:;charset=[^;,]+)?(;base64)?,([^"'\s<>]+)/i);
  if (!match) return "";

  const payload = (match[2] || "").replace(/&amp;/g, "&");
  if (!payload) return "";

  if (match[1]) {
    try {
      const bytes = Uint8Array.from(atob(payload), character => character.charCodeAt(0));
      return new TextDecoder("utf-8").decode(bytes);
    } catch {
      return "";
    }
  }

  try {
    return decodeURIComponent(payload);
  } catch {
    return payload;
  }
}

function decodeRichHtmlEntities(value) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

function normalizeRichSvgMarkup(markup) {
  const source = String(markup || "").trim();
  if (!source) return "";

  const parser = new DOMParser();
  const doc = parser.parseFromString(source, "image/svg+xml");
  if (doc.querySelector("parsererror")) return "";

  const root = doc.documentElement;
  const svg = root?.localName?.toLowerCase() === "svg" ? root : doc.querySelector("svg");
  if (!svg) return "";

  if (!svg.getAttribute("xmlns")) svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  sanitizeRichSvgElement(svg);

  return new XMLSerializer().serializeToString(svg);
}

function sanitizeRichSvgElement(svg) {
  svg.querySelectorAll("script").forEach(element => element.remove());
  svg.querySelectorAll("*").forEach(element => {
    [...element.attributes].forEach(attribute => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value || "";
      if (name.startsWith("on") || /^\s*javascript:/i.test(value)) {
        element.removeAttribute(attribute.name);
      }
    });
  });
}

function richCodeBlockHtml({ caption, code, language, readOnlyOpen = false, blockId = "" }) {
  const summary = escapeHtml((caption || "Code").trim() || "Code");
  const normalizedLanguage = RICH_SOURCE_TEXT_TYPES.some(option => option.value === language)
    ? language
    : "";
  const result = prepareRichSourceHighlight(code || "", normalizedLanguage);
  const codeHtml = (result.highlighted ? result.html : escapeHtml(code || "")) || "<br>";
  const languageAttribute = normalizedLanguage
    ? ` data-code-language="${escapeAttr(normalizedLanguage)}"`
    : "";
  const readOnlyOpenAttribute = readOnlyOpen ? ` data-code-readonly-open="true"` : "";
  const blockIdAttribute = ` data-code-block-id="${escapeAttr(String(blockId || createRichCodeBlockId()).trim())}"`;
  return `<details class="rich-code-block"${blockIdAttribute}${readOnlyOpenAttribute}><summary><span class="rich-code-caption">${summary}</span></summary><pre><code${languageAttribute}>${codeHtml}</code></pre></details><p><br></p>`;
}

function richCollapsibleBlockHtml(options = {}, fallbackContents = "") {
  const config = typeof options === "object" && options !== null
    ? options
    : { title: options, contents: fallbackContents };
  const title = escapeHtml(String(config.title || "Details").trim() || "Details");
  const contents = config.contents || "<p><br></p>";
  const readOnlyOpen = config.readOnlyOpen !== false;
  const blockId = String(config.blockId || createRichCollapsibleBlockId()).trim();
  return `<details class="rich-collapsible-block" data-collapsible-id="${escapeAttr(blockId)}" data-collapsible-readonly-open="${readOnlyOpen ? "true" : "false"}" open><summary><span class="rich-collapsible-title">${title}</span></summary><div class="rich-collapsible-content">${contents}</div></details><p><br></p>`;
}

function richCodeClipboardHtml(block) {
  const sourceCode = block.querySelector(":scope > pre > code");
  if (!sourceCode) return `<pre><code>${escapeHtml(richCodeBlockData(block).code)}</code></pre>`;
  const code = sourceCode.cloneNode(true);
  const sources = [sourceCode, ...sourceCode.querySelectorAll("*")];
  const targets = [code, ...code.querySelectorAll("*")];
  sources.forEach((source, index) => {
    const target = targets[index];
    if (!target) return;
    const style = getComputedStyle(source);
    ["color", "background-color", "font-family", "font-size", "font-weight", "font-style", "text-decoration", "line-height", "white-space"]
      .forEach(property => target.style.setProperty(property, style.getPropertyValue(property)));
  });
  const pre = document.createElement("pre");
  pre.style.cssText = "margin:0;padding:12px;background:#0f172a;color:#e5e7eb;white-space:pre-wrap;font-family:Consolas,'Courier New',monospace;";
  pre.appendChild(code);
  return pre.outerHTML;
}

function insertRichHtmlAtSelection(editor, html) {
  const template = document.createElement("template");
  template.innerHTML = String(html || "");
  const fragment = template.content;
  const lastNode = fragment.lastChild;
  if (!lastNode) return;

  const selection = window.getSelection();
  const selectedRange = selection?.rangeCount ? selection.getRangeAt(0) : null;
  const range = selectedRange && editor.contains(selectedRange.commonAncestorContainer)
    ? selectedRange
    : document.createRange();
  if (!selectedRange || !editor.contains(selectedRange.commonAncestorContainer)) {
    range.selectNodeContents(editor);
    range.collapse(false);
  }

  range.deleteContents();
  range.insertNode(fragment);
  range.setStartAfter(lastNode);
  range.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function focusRichCodeMarker(editor, markerId) {
  const marker = editor.querySelector(`[data-rich-code-focus="${markerId}"]`);
  if (!marker) {
    editor.focus();
    return;
  }

  const paragraph = marker.closest("p") || marker.parentElement;
  marker.remove();
  const range = document.createRange();
  range.selectNodeContents(paragraph || editor);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  editor.focus({ preventScroll: true });
}

function richPlainTextHtml(text) {
  return String(text || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(line => line.trim() ? escapeHtml(line) : "<br>")
    .join("<br>");
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

async function saveJson(path, method, payload, options = {}) {
  try {
    return await api(path, { method, body: JSON.stringify(payload) });
  } catch (error) {
    const canSaveAsNew = error?.code === "save-conflict"
      && method === "PUT"
      && options.saveAsNew === true
      && options.canCreate === true
      && (options.createPath || options.prepareSaveAsNew);
    if (!canSaveAsNew) throw error;

    const confirmed = await askYesNo(
      `${error.message} Save your draft as a new item?`,
      "Save Collision",
      "Save as New"
    );
    if (!confirmed) throw error;

    if (options.prepareSaveAsNew) {
      await options.prepareSaveAsNew();
      const prepared = new Error(options.saveAsNewPreparedMessage || "Enter the required new-item details, then save again.");
      prepared.code = "save-as-new-prepared";
      throw prepared;
    }

    const clonePayload = { ...payload, id: 0 };
    delete clonePayload.expectedRowVersion;
    const result = await api(options.createPath, {
      method: "POST",
      body: JSON.stringify(clonePayload)
    });
    return result && typeof result === "object"
      ? { ...result, __savedAsNew: true }
      : { __savedAsNew: true };
  }
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

async function copyRichTextImageAssets(html) {
  const container = document.createElement("div");
  container.innerHTML = String(html || "");
  const images = [...container.querySelectorAll("img[src]")];

  for (const image of images) {
    const source = String(image.getAttribute("src") || "").trim();
    if (!source || richTextImageIsCrossOrigin(source)) continue;
    try {
      const response = await fetch(appUrl(source), { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) continue;
      const blob = await response.blob();
      if (!/^image\//i.test(blob.type || "")) continue;
      const upload = await uploadFile("richtext", new File([blob], richTextImageCopyFileName(source, blob.type), {
        type: blob.type
      }));
      image.setAttribute("src", appUrl(upload.url));
    } catch {
      // Keep the duplicate usable even if one image cannot be copied.
    }
  }

  return container.innerHTML;
}

function richTextImageIsCrossOrigin(source) {
  if (/^data:image\//i.test(source)) return false;
  try {
    const url = new URL(source, window.location.href);
    return url.origin !== window.location.origin;
  } catch {
    return false;
  }
}

function richTextImageCopyFileName(source, contentType) {
  const extension = {
    "image/svg+xml": "svg",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp"
  }[String(contentType || "").toLowerCase()] || "png";
  if (/^data:image\//i.test(source)) {
    return `duplicated-image-${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`;
  }
  try {
    const name = decodeURIComponent(new URL(source, window.location.href).pathname.split("/").filter(Boolean).pop() || "");
    const safeName = name.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "");
    if (safeName) return safeName;
  } catch {
    // Fall back below.
  }
  return `duplicated-image-${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`;
}

async function attachFile(path, file) {
  const body = new FormData();
  body.append("file", file);
  return api(path, { method: "POST", body });
}

async function uploadRichTextCanvasImage(input) {
  const file = input instanceof File
    ? input
    : new File(
        [input?.blob],
        input?.fileName || "diagram-image.png",
        { type: input?.blob?.type || "image/png" }
      );
  const upload = await uploadFile("richtext", file);
  return {
    ...upload,
    reference: storageUrl(upload.url),
    url: appUrl(upload.url)
  };
}

async function deleteAttachment(path, fileName) {
  if (!await askYesNo(`Delete attachment "${fileName}"?`, "Delete")) return false;

  try {
    await api(path, { method: "DELETE" });
    await loadState();
    showToast("Attachment deleted.");
    return true;
  } catch (error) {
    showToast(error.message);
    return false;
  }
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

async function deleteItems(paths, message, successMessage = "Deleted.") {
  const deletePaths = [...new Set((paths || []).filter(Boolean))];
  if (!deletePaths.length || !await askYesNo(message, "Delete")) {
    return { confirmed: false, deletedCount: 0, failedCount: 0 };
  }

  let deletedCount = 0;
  const errors = [];
  for (const path of deletePaths) {
    try {
      await api(path, { method: "DELETE" });
      deletedCount += 1;
    } catch (error) {
      errors.push(error);
    }
  }

  const reloaded = await loadState();
  if (!reloaded) {
    return {
      confirmed: true,
      deletedCount,
      failedCount: errors.length,
      refreshed: false
    };
  }

  render();

  if (errors.length) {
    showToast(`Some items could not be deleted. ${errors[0].message}`);
  } else {
    showToast(successMessage);
  }

  return {
    confirmed: true,
    deletedCount,
    failedCount: errors.length,
    refreshed: true
  };
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
    apiRoot: "/api/tasks",
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

async function createDiagramBackingDocument({ title, diagram, sourceDocument = null }) {
  if (!canAccessResource("Documentation", "Create")) {
    throw new Error("You do not have permission to create Documentation.");
  }
  if (!title || !diagram?.svg) throw new Error("The Diagram backing Document is incomplete.");
  const bodyHtml = await uploadedDiagramBackingBodyHtml(title, diagram);

  const result = await saveJson("/api/blogs", "POST", {
    id: 0,
    projectId: sourceDocument?.projectId || null,
    sprintId: sourceDocument?.sprintId || null,
    parentBlogId: sourceDocument?.parentBlogId || null,
    title,
    bodyHtml,
    isPrivate: sourceDocument ? sourceDocument.isPrivate !== false : true,
    isPinned: false
  });

  await loadState();
  return state.blogs.find(blog => blog.id === result.id) || result;
}

async function updateDiagramBackingDocument(document, { diagram }) {
  if (!canAccessResource("Documentation", "Update")) {
    throw new Error("You do not have permission to update Documentation.");
  }
  if (!document?.id || !diagram?.svg) {
    throw new Error("The Diagram could not be saved.");
  }
  const bodyHtml = await uploadedDiagramBackingBodyHtml(document.title, diagram);

  const result = await saveJson(`/api/blogs/${document.id}`, "PUT", {
    id: document.id,
    projectId: document.projectId || null,
    sprintId: document.sprintId || null,
    parentBlogId: document.parentBlogId || null,
    title: document.title,
    bodyHtml,
    isPrivate: document.isPrivate !== false,
    isPinned: false,
    expectedRowVersion: document.rowVersion || null
  });

  await loadState();
  return state.blogs.find(blog => blog.id === document.id) || result;
}

async function uploadedDiagramBackingBodyHtml(title, diagram) {
  const fileName = `${String(title || "diagram")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "diagram"}.svg`;
  const upload = await uploadFile(
    "richtext",
    new File([diagram.svg], fileName, { type: "image/svg+xml" })
  );
  const version = Number(diagram.state?.version || 1);
  return `<p><img class="rich-svg-image pmt-annotation-image" src="${escapeAttr(storageUrl(upload.url))}" alt="${escapeAttr(title)}" data-pmt-diagram="true" data-pmt-private-diagram="true" data-pmt-annotation-version="${escapeAttr(version)}"></p>`;
}

async function updateDiagramBackingInfo(document, metadata) {
  if (!canAccessResource("Documentation", "Update")) {
    throw new Error("You do not have permission to update Documentation.");
  }
  if (!document?.id || !metadata?.title) throw new Error("The Diagram information is incomplete.");

  return saveJson(`/api/blogs/${document.id}`, "PUT", {
    id: document.id,
    projectId: metadata.projectId || null,
    sprintId: metadata.sprintId || null,
    parentBlogId: metadata.parentBlogId || null,
    title: metadata.title,
    bodyHtml: document.bodyHtml,
    isPrivate: metadata.isPrivate !== false,
    isPinned: false,
    expectedRowVersion: document.rowVersion || null
  });
}

async function moveDiagramBackingDocument(document, { parentBlogId, orderedBlogIds }) {
  if (!canAccessResource("Documentation", "Update")) {
    throw new Error("You do not have permission to update Documentation.");
  }
  if (!document?.id || !Array.isArray(orderedBlogIds) || !orderedBlogIds.length) {
    throw new Error("The Diagram move is incomplete.");
  }

  await saveJson(`/api/blogs/${document.id}/move`, "PUT", {
    parentBlogId: parentBlogId || null,
    orderedBlogIds
  });
  await loadState();
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
  }, { apiRoot: "/api/backlog/tasks", canEdit: true, onConvertToDocument: null, onViewDocument: openDocumentationById });
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
