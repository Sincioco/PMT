const fallbackStatuses = [
  "Backlog",
  "Todo",
  "In Progress",
  "Code Complete",
  "Ready for QA",
  "QA in Progress",
  "QA Failed",
  "QA Passed",
  "Deployed in SIT",
  "Deployed in UAT",
  "Deployed in Prod"
];

const fallbackPriorities = ["Lowest", "Low", "Medium", "High", "Highest"];
const fallbackSeverities = ["Trivial", "Minor", "Major", "Critical"];
const fallbackEnvironments = ["local", "Dev", "SIT", "UAT", "Production"];
const linkedBugCompletionMessage = "You cannot mark this task as complete until the associated bug is marked as QA Passed.  Once QA has re-tested the bug and passed it, the completion of your Dev Task will be set to 100%.";
let statuses = [...fallbackStatuses];
let priorities = [...fallbackPriorities];
let severities = [...fallbackSeverities];
let environments = [...fallbackEnvironments];
const views = ["Dashboard", "Road Map", "Gantt", "Board", "Projects", "Sprints", "Tasks", "Bugs", "Scrum", "Documentation", "Backlog"];

let state = { users: [], projects: [], sprints: [], tasks: [], devLogs: [], blogs: [], auditEvents: [], lookups: [], holidays: [] };
let currentView = localStorage.getItem("pmt-view") || "Dashboard";
const savedCurrentView = currentView;
if (currentView === "Dev Log") currentView = "Dev Logs";
if (currentView === "Dev Logs") currentView = "Scrum";
if (currentView === "Blogs") currentView = "Documentation";
if (currentView === "Lookups") currentView = "Settings";
if (currentView === "Users") currentView = "Settings";
if (currentView === "Holidays") currentView = "Settings";
let currentUserId = Number(localStorage.getItem("pmt-auth-user") || 0);
let boardProjectId = Number(localStorage.getItem("pmt-board-project") || 0);
let boardSprintMode = localStorage.getItem("pmt-board-sprint") || "latest";
let boardSort = localStorage.getItem("pmt-board-sort") || "custom";
let boardHideEmptyColumns = false;
let roadMapProjectFilter = localStorage.getItem("pmt-roadmap-project") || "all";
let roadMapSprintFilter = localStorage.getItem("pmt-roadmap-sprint") || "all";
let roadMapSort = localStorage.getItem("pmt-roadmap-sort") || "endAsc";
let roadMapShowDates = localStorage.getItem("pmt-roadmap-show-dates") !== "false";
let roadMapShowDetails = localStorage.getItem("pmt-roadmap-show-details") !== "false";
let roadMapShowSprints = localStorage.getItem("pmt-roadmap-show-sprints") !== "false";
let ganttProjectId = Number(localStorage.getItem("pmt-gantt-project") || 0);
let ganttSprintMode = localStorage.getItem("pmt-gantt-sprint") || "current";
let ganttRenderMode = localStorage.getItem("pmt-gantt-render-mode") || "all";
let ganttSort = localStorage.getItem("pmt-gantt-sort") || "startAsc";
let ganttShowNonWorkingDays = localStorage.getItem("pmt-gantt-show-non-working-days") === "true";
let ganttShowAllBugs = false;
let ganttExpandedBugTaskIds = new Set();
let ganttLastChart = null;
let ganttFlyByFrameId = 0;
let ganttFlyByTimeoutId = 0;
let ganttFlyByRunId = 0;
let ganttPendingFlyBy = false;
let ganttFlyByActive = false;
let ganttFlyByAnimating = false;
let ganttFlyByStopRequested = false;
let ganttFlyByResumeSprintId = 0;
let ganttFlyByCurrentSprintId = 0;
let lookupTypeFilter = localStorage.getItem("pmt-lookup-type") || "Status";
let settingsCategory = localStorage.getItem("pmt-settings-category") || lookupTypeFilter || "Status";
if (savedCurrentView === "Users" || savedCurrentView === "Holidays") settingsCategory = savedCurrentView;
if (savedCurrentView === "Lookups") settingsCategory = lookupTypeFilter;
let sprintProjectId = Number(localStorage.getItem("pmt-sprint-project") || 0);
let taskProjectId = Number(localStorage.getItem("pmt-task-project") || 0);
let taskSprintId = localStorage.getItem("pmt-task-sprint") || "all";
let taskFilters = JSON.parse(localStorage.getItem("pmt-task-filters") || "{}");
let taskFiltersVisible = localStorage.getItem("pmt-task-filters-visible") !== "false";
let taskVisualChartsVisible = localStorage.getItem("pmt-task-visual-charts-visible") !== "false";
let bugFilters = JSON.parse(localStorage.getItem("pmt-bug-filters") || "{}");
let bugFiltersVisible = localStorage.getItem("pmt-bug-filters-visible") !== "false";
let bugVisualChartsVisible = localStorage.getItem("pmt-bug-visual-charts-visible") !== "false";
let documentationProjectId = Number(localStorage.getItem("pmt-documentation-project") || 0);
const savedBoardStatuses = JSON.parse(localStorage.getItem("pmt-board-statuses") || "null");
let boardStatuses = Array.isArray(savedBoardStatuses) && savedBoardStatuses.every(status => statuses.includes(status))
  ? savedBoardStatuses
  : statuses;
let draggedTaskId = 0;
let pointerDrag = null;
let lastPointerDragEventAt = 0;
let suppressNextClick = false;
let pageEventsBound = false;
let dashboardShowAllDetails = false;
let dashboardExpandedSprintIds = new Set();
let projectCollapsedIds = new Set();
let sprintCollapsedIds = new Set();
let chartTooltip = null;

taskFilters.statuses = normalizeSavedArray(taskFilters.statuses);
taskFilters.assigneeIds = normalizeSavedArray(taskFilters.assigneeIds);
taskFilters.priorities = normalizeSavedArray(taskFilters.priorities);
taskFilters.sort = taskFilters.sort || "custom";
taskFilters.hideCompleted = Boolean(taskFilters.hideCompleted);
bugFilters.reporterIds = normalizeSavedArray(bugFilters.reporterIds, bugFilters.reporterId);
bugFilters.assigneeIds = normalizeSavedArray(bugFilters.assigneeIds, bugFilters.assigneeId);

const app = document.getElementById("app");
const nav = document.getElementById("nav");
const userSelect = document.getElementById("currentUser");
const userAvatar = document.getElementById("currentUserAvatar");
const userMenuToggle = document.getElementById("userMenuToggle");
const userMenu = document.getElementById("userMenu");
const themeToggle = document.getElementById("themeToggle");
const dialog = document.getElementById("editorDialog");
const dialogTitle = document.getElementById("dialogTitle");
const dialogBody = document.getElementById("dialogBody");
const editorForm = document.getElementById("editorForm");
const toast = document.getElementById("toast");

document.getElementById("closeDialog").addEventListener("click", () => dialog.close());
document.getElementById("cancelDialog").addEventListener("click", () => dialog.close());
document.getElementById("logout")?.addEventListener("click", logout);
applySavedTheme();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}

async function initializeApp() {
  bindPageEvents();
  if (!currentUserId) {
    renderLogin();
    return;
  }
  await startApp();
}

function bindPageEvents() {
  if (pageEventsBound) return;
  pageEventsBound = true;

  nav.addEventListener("click", event => {
    const overflowButton = event.target.closest("button[data-action='nav-overflow-toggle']");
    if (overflowButton) {
      toggleNavOverflow();
      return;
    }

    const button = event.target.closest("button[data-view]");
    if (!button) return;
    closeNavOverflow();
    currentView = button.dataset.view;
    localStorage.setItem("pmt-view", currentView);
    renderNav();
    render();
  });

  userSelect.addEventListener("change", () => {
    currentUserId = Number(userSelect.value);
    render();
  });

  userMenuToggle?.addEventListener("click", event => {
    event.stopPropagation();
    toggleUserMenu();
  });

  userMenu?.addEventListener("click", event => {
    const viewButton = event.target.closest("button[data-view]");
    if (viewButton) {
      currentView = viewButton.dataset.view;
      localStorage.setItem("pmt-view", currentView);
      closeUserMenu();
      renderNav();
      render();
      return;
    }

    const themeButton = event.target.closest("button[data-action='toggle-theme']");
    if (themeButton) {
      toggleTheme();
      return;
    }

    const passwordButton = event.target.closest("button[data-action='change-password']");
    if (!passwordButton) return;

    closeUserMenu();
    editPassword();
  });

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
  document.addEventListener("click", event => {
    if (!event.target.closest("#nav")) closeNavOverflow();
    if (!event.target.closest(".user-menu")) closeUserMenu();
  });
  window.addEventListener("resize", () => requestAnimationFrame(applyNavOverflow));
}

async function startApp() {
  document.body.classList.remove("logged-out");
  renderNav();
  await loadState();
  render();
}

function renderLogin() {
  document.body.classList.add("logged-out");
  nav.innerHTML = "";
  userSelect.innerHTML = "";
  app.innerHTML = `
    <section class="login-screen">
      <div class="panel">
        <div>
          <h1>PMT</h1>
          <p class="muted">Software Engineering</p>
        </div>
        <div class="field">
          <label>Nickname or Email</label>
          <input id="loginName" autocomplete="username" value="Sin">
        </div>
        <div class="field">
          <label>Password</label>
          <input id="loginPassword" type="password" autocomplete="current-password" value="Password1">
        </div>
        <button class="primary text-icon-button" type="button" id="loginButton">${buttonContent("&#10148;", "Log in")}</button>
      </div>
    </section>
  `;

  document.getElementById("loginButton").addEventListener("click", login);
  document.getElementById("loginPassword").addEventListener("keydown", event => {
    if (event.key === "Enter") login();
  });
}

async function login() {
  try {
    const loginName = document.getElementById("loginName").value;
    const password = document.getElementById("loginPassword").value;
    const result = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ login: loginName, password })
    });

    currentUserId = result.userId;
    localStorage.setItem("pmt-auth-user", currentUserId);
    await startApp();
  } catch (error) {
    showToast(error.message || "Login failed.");
  }
}

function logout() {
  closeUserMenu();
  localStorage.removeItem("pmt-auth-user");
  currentUserId = 0;
  state = { users: [], projects: [], sprints: [], tasks: [], devLogs: [], blogs: [], auditEvents: [], lookups: [], holidays: [] };
  renderLogin();
}

async function loadState() {
  try {
    state = await api("/api/state");
    refreshLookupOptions();
    if (!state.users.some(user => user.id === currentUserId) && state.users.length) {
      currentUserId = state.users[0].id;
      localStorage.setItem("pmt-auth-user", currentUserId);
    }
    renderUserPicker();
  } catch (error) {
    showToast(error.message);
    app.innerHTML = `<div class="empty">Database is not ready. Run the SQL scripts in order, then refresh this page.</div>`;
  }
}

async function api(path, options = {}) {
  const headers = { "X-PMT-UserId": String(currentUserId) };
  const bodyIsForm = options.body instanceof FormData;

  if (!bodyIsForm && options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(path, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (!response.ok) {
    const problem = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(problem.error || "Request failed.");
  }

  if (response.status === 204) return null;
  return response.json();
}

function renderNav() {
  const viewButtons = views.map(view => navButtonHtml({
    view,
    label: viewLabel(view),
    icon: navIconHtml(view),
    active: view === currentView
  })).join("");

  nav.innerHTML = `
    ${viewButtons}
    <div class="nav-overflow" hidden>
      <button class="nav-overflow-toggle" type="button" data-action="nav-overflow-toggle" title="More navigation" aria-label="More navigation" aria-expanded="false">
        <span class="nav-icon" aria-hidden="true">&#9776;</span>
      </button>
      <div class="nav-overflow-menu" hidden></div>
    </div>
  `;
  requestAnimationFrame(applyNavOverflow);
}

function viewLabel(view) {
  if (view === "Board") return "Kanban Board";
  if (view === "Tasks") return "Dev Tasks";
  if (view === "Bugs") return "Bug Tracking";
  return view;
}

function navButtonHtml(item, extraClass = "nav-item") {
  const attributes = [
    item.view ? `data-view="${escapeAttr(item.view)}"` : "",
    item.action ? `data-action="${escapeAttr(item.action)}"` : "",
    `class="${`${extraClass} ${item.active ? "active" : ""}`.trim()}"`
  ].filter(Boolean).join(" ");

  return `
    <button type="button" ${attributes}>
      <span class="nav-icon" aria-hidden="true">${item.icon}</span>
      <span>${escapeHtml(item.label)}</span>
    </button>
  `;
}

function buttonContent(icon, label) {
  return `<span class="button-icon" aria-hidden="true">${icon}</span><span>${escapeHtml(label)}</span>`;
}

function funnelIconHtml() {
  return `
    <svg class="button-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 5h16l-6.5 7.5V18l-3 1.5v-7L4 5z"></path>
    </svg>
  `;
}

function applyNavOverflow() {
  const overflow = nav.querySelector(".nav-overflow");
  const menu = nav.querySelector(".nav-overflow-menu");
  const toggle = nav.querySelector(".nav-overflow-toggle");
  if (!overflow || !menu || !toggle) return;

  const items = [...nav.querySelectorAll(":scope > button.nav-item")];
  items.forEach(item => item.hidden = false);
  overflow.hidden = true;
  menu.hidden = true;
  menu.innerHTML = "";
  toggle.setAttribute("aria-expanded", "false");

  if (nav.scrollWidth <= nav.clientWidth) return;

  overflow.hidden = false;
  const hiddenItems = [];
  for (let index = items.length - 1; index >= 0 && nav.scrollWidth > nav.clientWidth; index--) {
    const item = items[index];
    item.hidden = true;
    hiddenItems.unshift(item);
  }

  menu.innerHTML = hiddenItems.map(item => {
    const view = item.dataset.view;
    const action = item.dataset.action;
    const label = item.querySelector("span:last-child")?.textContent || "";
    const icon = item.querySelector(".nav-icon")?.innerHTML || "&#9679;";
    return navButtonHtml({ view, action, label, icon, active: item.classList.contains("active") }, "nav-menu-item");
  }).join("");
}

function toggleNavOverflow() {
  const overflow = nav.querySelector(".nav-overflow");
  const menu = nav.querySelector(".nav-overflow-menu");
  const toggle = nav.querySelector(".nav-overflow-toggle");
  if (!overflow || !menu || !toggle) return;

  const isOpen = menu.hidden;
  menu.hidden = !isOpen;
  toggle.setAttribute("aria-expanded", String(isOpen));
}

function closeNavOverflow() {
  const menu = nav.querySelector(".nav-overflow-menu");
  const toggle = nav.querySelector(".nav-overflow-toggle");
  if (!menu || !toggle) return;
  menu.hidden = true;
  toggle.setAttribute("aria-expanded", "false");
}

function toggleUserMenu() {
  if (!userMenu || !userMenuToggle) return;

  const isOpen = userMenu.hidden;
  userMenu.hidden = !isOpen;
  userMenuToggle.setAttribute("aria-expanded", String(isOpen));
  closeNavOverflow();
}

function closeUserMenu() {
  if (!userMenu || !userMenuToggle) return;

  userMenu.hidden = true;
  userMenuToggle.setAttribute("aria-expanded", "false");
}

function navIconHtml(view) {
  const icons = {
    Dashboard: "&#9636;",
    Board: "&#9638;",
    "Road Map": "&#8644;",
    Gantt: "&#8942;",
    Backlog: "&#9776;",
    Projects: "&#9635;",
    Sprints: "&#8635;",
    Tasks: "&#10003;",
    Bugs: "&#9888;",
    Scrum: "&#9719;",
    Documentation: "&#128196;",
    Settings: "&#9881;"
  };
  return icons[view] || "&#9679;";
}

function renderUserPicker() {
  const user = state.users.find(item => item.id === currentUserId);
  userSelect.innerHTML = user ? `<option value="${user.id}">${escapeHtml(user.nickname)}</option>` : "";

  if (userAvatar) {
    userAvatar.src = user?.avatarUrl || "/assets/avatar-default.svg";
    userAvatar.title = user?.nickname || "";
    userAvatar.alt = user ? `${user.nickname} avatar` : "";
  }

  if (userMenuToggle) {
    userMenuToggle.title = user ? `${user.nickname} menu` : "User menu";
  }

  updateThemeToggle();
}

function applySavedTheme() {
  const savedTheme = localStorage.getItem("pmt-theme") || "dark";
  applyTheme(savedTheme === "light" ? "light" : "dark");
}

function toggleTheme() {
  const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  localStorage.setItem("pmt-theme", nextTheme);
  applyTheme(nextTheme);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  updateThemeToggle();
}

function updateThemeToggle() {
  if (!themeToggle) return;

  const isLight = document.documentElement.dataset.theme === "light";
  const icon = themeToggle.querySelector("[data-theme-icon]");
  const label = themeToggle.querySelector("[data-theme-label]");
  if (icon) icon.innerHTML = isLight ? "&#9790;" : "&#9728;";
  if (label) label.textContent = isLight ? "Dark Theme" : "Light Theme";
  themeToggle.title = isLight ? "Switch to dark theme" : "Switch to light theme";
}

function render() {
  if (!state.users.length) return;
  renderNav();
  renderUserPicker();

  if (currentView === "Dashboard") renderDashboard();
  if (currentView === "Projects") renderProjects();
  if (currentView === "Board") renderBoard();
  if (currentView === "Road Map") renderRoadMap();
  if (currentView === "Gantt") renderGantt();
  if (currentView === "Backlog") renderBacklog();
  if (currentView === "Tasks") renderTasks();
  if (currentView === "Bugs") renderBugs();
  if (currentView === "Sprints") renderSprints();
  if (currentView === "Scrum") renderDevLogs();
  if (currentView === "Documentation") renderDocumentation();
  if (currentView === "Settings") renderSettings();
  linkifyTextNodes(app);
  normalizeLinksInElement(app);
}

function renderDashboard() {
  app.innerHTML = `
    ${sectionHead("Dashboard", `
      <button class="text-icon-button" type="button" data-action="toggle-dashboard-all-details">${buttonContent(dashboardShowAllDetails ? "&#8722;" : "&#43;", dashboardShowAllDetails ? "Hide All Details" : "Show All Details")}</button>
    `)}
    <div class="grid">
      ${state.projects.map(projectCardHtml).join("")}
    </div>
    <div class="panel" style="margin-top:16px">
      <div class="spread">
        <h2>Project Flow</h2>
        <span class="muted">${state.tasks.length} tasks across ${state.sprints.length} Sprints</span>
      </div>
      ${dashboardShowAllDetails ? statusLegendHtml() : ""}
      ${state.projects.map(project => dashboardProjectHtml(project)).join("")}
    </div>
  `;
}

function renderProjects() {
  app.innerHTML = `
    ${sectionHead("Projects", `<button class="primary text-icon-button" type="button" data-action="new-project">${buttonContent("&#10010;", "New Project")}</button>`)}
    <div class="grid">${state.projects.map(projectCardHtml).join("")}</div>
  `;
}

function renderBoard() {
  if (!boardProjectId && state.projects.length) boardProjectId = state.projects[0].id;
  const project = state.projects.find(item => item.id === boardProjectId) || state.projects[0];
  const sprintId = selectedBoardSprintId(project?.id);
  const visibleTasks = state.tasks
    .filter(task => !project || task.projectId === project.id)
    .filter(task => sprintId === 0 || task.sprintId === sprintId)
    .filter(task => boardStatuses.includes(task.status))
    .sort(boardTaskSortCompare);
  // The board normally shows every selected status. This optional filter keeps the board compact.
  const boardColumnStatuses = boardHideEmptyColumns
    ? boardStatuses.filter(status => visibleTasks.some(task => task.status === status))
    : boardStatuses;

  app.innerHTML = `
    ${sectionHead("Kanban Board", `
      <button class="primary text-icon-button" type="button" data-action="new-task">${buttonContent("&#10010;", "New Dev Task")}</button>
      <button class="primary text-icon-button" type="button" data-action="new-bug">${buttonContent("&#9888;", "New Bug Report")}</button>
    `)}
    <div class="panel">
      <div class="filter-row">
        <label>
          <span>Project</span>
          <select data-filter="board-project">
            ${state.projects.map(item => `<option value="${item.id}" ${item.id === boardProjectId ? "selected" : ""}>${escapeHtml(item.code)} - ${escapeHtml(item.title)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Sprint</span>
          <select data-filter="board-sprint">
            <option value="latest" ${boardSprintMode === "latest" ? "selected" : ""}>Latest Sprint</option>
            <option value="all" ${boardSprintMode === "all" ? "selected" : ""}>All Sprints</option>
            ${state.sprints.filter(sprint => sprint.projectId === boardProjectId).map(sprint => `<option value="${sprint.id}" ${String(sprint.id) === boardSprintMode ? "selected" : ""}>${escapeHtml(sprint.code)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select data-filter="board-sort">
            <option value="custom" ${boardSort === "custom" ? "selected" : ""}>Custom order</option>
            <option value="openFirst" ${boardSort === "openFirst" ? "selected" : ""}>Open first</option>
            <option value="doneFirst" ${boardSort === "doneFirst" ? "selected" : ""}>Done first</option>
          </select>
        </label>
        <button class="icon-action ${boardHideEmptyColumns ? "is-on" : ""}" type="button" data-action="toggle-empty-board-columns" title="${boardHideEmptyColumns ? "Show all columns" : "Hide empty columns"}" aria-label="${boardHideEmptyColumns ? "Show all columns" : "Hide empty columns"}" aria-pressed="${boardHideEmptyColumns}">${boardHideEmptyColumns ? "&#9638;" : "&#128065;"}</button>
      </div>
      <fieldset class="check-list" style="margin-top:10px">
        <legend>Columns</legend>
        ${statuses.map(status => `<label><input type="checkbox" data-filter="board-status" value="${status}" ${boardStatuses.includes(status) ? "checked" : ""}> ${status}</label>`).join("")}
      </fieldset>
    </div>
    <div class="board" style="margin-top:14px">
      ${boardColumnStatuses.map(status => boardColumnHtml(status, visibleTasks.filter(task => task.status === status))).join("") || `<div class="empty">No columns have tasks for the current filters.</div>`}
    </div>
  `;
}

function renderGantt(options = {}) {
  if (!ganttPendingFlyBy && !options.skipStopFlyBy) stopGanttFlyBy();

  if (!ganttProjectId && state.projects.length) ganttProjectId = state.projects[0].id;
  if (!state.projects.some(project => project.id === ganttProjectId) && state.projects.length) ganttProjectId = state.projects[0].id;

  const project = projectById(ganttProjectId) || state.projects[0];
  const projectSprints = sortGanttSprints(state.sprints.filter(sprint => sprint.projectId === project?.id));
  if (ganttSprintMode === "all") {
    ganttRenderMode = "all";
    localStorage.setItem("pmt-gantt-render-mode", ganttRenderMode);
  }
  if (ganttSprintMode !== "all" && ganttSprintMode !== "current" && !projectSprints.some(sprint => sprint.id === Number(ganttSprintMode))) {
    ganttSprintMode = "current";
    localStorage.setItem("pmt-gantt-sprint", ganttSprintMode);
  }

  const selectedSprint = selectedGanttSprint(projectSprints);
  const sprintOptions = sortGanttSprintOptions(projectSprints);
  const visibleSprints = ganttRenderMode === "selected" && selectedSprint ? [selectedSprint] : projectSprints;
  const scrollSprint = selectedSprint || currentSprintForProject(projectSprints);
  const singleSprint = ganttRenderMode === "selected" ? selectedSprint : null;
  const chart = ganttChartData(project, visibleSprints, singleSprint, scrollSprint, ganttShowNonWorkingDays);
  ganttLastChart = chart;

  app.innerHTML = `
    ${sectionHead("Gantt", `
      <button class="secondary text-icon-button" type="button" data-action="toggle-gantt-all-bugs">${buttonContent(ganttShowAllBugs ? "&#9652;" : "&#9662;", ganttShowAllBugs ? "Collapse Bugs" : "Expand Bugs")}</button>
    `)}
    <div class="panel">
      <div class="filter-row">
        <label>
          <span>Project</span>
          <select data-filter="gantt-project">
            ${state.projects.map(item => `<option value="${item.id}" ${item.id === ganttProjectId ? "selected" : ""}>${escapeHtml(item.code)} - ${escapeHtml(item.title)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Sprint</span>
          <select data-filter="gantt-sprint">
            <option value="current" ${ganttSprintMode === "current" ? "selected" : ""}>Current Sprint</option>
            <option value="all" ${ganttSprintMode === "all" ? "selected" : ""}>All Sprints</option>
            ${sprintOptions.map(sprint => `<option value="${sprint.id}" ${String(sprint.id) === String(ganttSprintMode) ? "selected" : ""}>${escapeHtml(sprint.code)} - ${escapeHtml(sprint.title)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select data-filter="gantt-sort">
            <option value="startAsc" ${ganttSort === "startAsc" ? "selected" : ""}>Start date ascending</option>
            <option value="startDesc" ${ganttSort === "startDesc" ? "selected" : ""}>Start date descending</option>
          </select>
        </label>
        <div class="roadmap-filter-actions gantt-filter-actions">
          <button class="icon-action ${ganttRenderMode === "selected" ? "is-on" : ""}" type="button" data-action="toggle-gantt-render-mode" title="${ganttRenderMode === "selected" ? "Show All Sprints" : "Show Selected Sprint Only"}" aria-label="${ganttRenderMode === "selected" ? "Show All Sprints" : "Show Selected Sprint Only"}" aria-pressed="${ganttRenderMode === "selected"}">${ganttRenderMode === "selected" ? "&#9638;" : "&#9673;"}</button>
          <button class="icon-action ${ganttShowNonWorkingDays ? "is-on" : ""}" type="button" data-action="toggle-gantt-days" title="${ganttShowNonWorkingDays ? "Hide weekends and holidays" : "Show weekends and holidays"}" aria-label="${ganttShowNonWorkingDays ? "Hide weekends and holidays" : "Show weekends and holidays"}" aria-pressed="${ganttShowNonWorkingDays}">&#128197;</button>
          <button class="icon-action ${ganttFlyByActive ? "is-on" : ""}" type="button" data-action="gantt-flyby" title="${ganttFlyByButtonTitle()}" aria-label="${ganttFlyByButtonTitle()}" aria-pressed="${ganttFlyByActive}">${ganttFlyByButtonIcon()}</button>
          <button class="icon-action" type="button" data-action="reset-gantt-view" title="Reset Gantt view" aria-label="Reset Gantt view">&#8634;</button>
        </div>
        <span class="muted gantt-note">${ganttShowNonWorkingDays ? "Weekends and configured holidays are visible." : "Weekends and configured holidays are hidden unless work starts on that date."}</span>
      </div>
    </div>
    ${chart.dates.length ? ganttChartHtml(chart) : `<div class="empty">No scheduled items for this project yet.</div>`}
  `;

  if (options.restoreScroll) {
    restoreGanttScroll(options.restoreScroll);
  } else {
    scrollGanttToSprintStart(chart, scrollSprint);
  }
  if (ganttPendingFlyBy) {
    ganttPendingFlyBy = false;
    const flyByRunId = ++ganttFlyByRunId;
    requestAnimationFrame(() => {
      if (flyByRunId !== ganttFlyByRunId) return;
      const startingSprint = ganttFlyByStartingSprint(chart.sprints);
      scrollGanttToSprint(chart, startingSprint);
      requestAnimationFrame(() => startGanttFlyBy(chart, flyByRunId));
    });
  }
}

function renderRoadMap() {
  const sprintOptions = roadMapSprintOptions();
  if (roadMapSprintFilter !== "all" && !sprintOptions.some(sprint => String(sprint.id) === String(roadMapSprintFilter))) {
    roadMapSprintFilter = "all";
    localStorage.setItem("pmt-roadmap-sprint", roadMapSprintFilter);
  }

  const filteredProjects = roadMapProjects();
  const chart = roadMapChartData(filteredProjects);

  app.innerHTML = `
    ${sectionHead("Road Map", "")}
    <div class="panel">
      <div class="filter-row">
        <label>
          <span>Project</span>
          <select data-filter="roadmap-project">
            <option value="all" ${roadMapProjectFilter === "all" ? "selected" : ""}>All projects</option>
            ${state.projects.map(project => `<option value="${project.id}" ${String(project.id) === String(roadMapProjectFilter) ? "selected" : ""}>${escapeHtml(project.code)} - ${escapeHtml(project.title)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Sprint</span>
          <select data-filter="roadmap-sprint" ${roadMapShowSprints ? "" : "disabled"}>
            <option value="all" ${roadMapSprintFilter === "all" ? "selected" : ""}>All Sprints</option>
            ${sprintOptions.map(sprint => `<option value="${sprint.id}" ${String(sprint.id) === String(roadMapSprintFilter) ? "selected" : ""}>${escapeHtml(sprint.code)} - ${escapeHtml(sprint.title)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select data-filter="roadmap-sort">
            <option value="endAsc" ${roadMapSort === "endAsc" ? "selected" : ""}>End date ascending</option>
            <option value="endDesc" ${roadMapSort === "endDesc" ? "selected" : ""}>End date descending</option>
            <option value="startAsc" ${roadMapSort === "startAsc" ? "selected" : ""}>Start date ascending</option>
            <option value="startDesc" ${roadMapSort === "startDesc" ? "selected" : ""}>Start date descending</option>
          </select>
        </label>
        <div class="roadmap-filter-actions">
          <button class="secondary text-icon-button" type="button" data-action="toggle-roadmap-sprints">${buttonContent(roadMapShowSprints ? "&#8722;" : "&#43;", roadMapShowSprints ? "Hide Sprints" : "Show Sprints")}</button>
          <button class="icon-action ${roadMapShowDates ? "is-on" : ""}" type="button" data-action="toggle-roadmap-dates" title="${roadMapShowDates ? "Hide start/end dates" : "Show start/end dates"}" aria-pressed="${roadMapShowDates}">&#128197;</button>
          <button class="icon-action ${roadMapShowDetails ? "is-on" : ""}" type="button" data-action="toggle-roadmap-details" title="${roadMapShowDetails ? "Hide avatars and percent text" : "Show avatars and percent text"}" aria-pressed="${roadMapShowDetails}">%</button>
        </div>
      </div>
    </div>
    ${chart.dates.length ? roadMapChartHtml(chart) : `<div class="empty">No Project or Sprint dates are available yet.</div>`}
  `;
}

function renderBacklog() {
  const backlogItems = state.tasks
    .filter(task => task.status === "Backlog" || task.status === "Todo")
    .sort(taskOrderCompare);

  app.innerHTML = `
    ${sectionHead("Backlog", `
      <button class="primary text-icon-button" type="button" data-action="new-task">${buttonContent("&#10010;", "New Dev Task")}</button>
      <button class="primary text-icon-button" type="button" data-action="new-bug">${buttonContent("&#9888;", "New Bug Report")}</button>
    `)}
    <div class="panel">
      <table class="table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Item</th>
            <th>Project</th>
            <th>Sprint</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Assigned</th>
            <th></th>
          </tr>
        </thead>
        <tbody data-reorder-list="backlog">
          ${backlogItems.map(task => `
            <tr class="clickable-row ${task.sprintId ? "assigned-backlog-row" : ""}" data-action="view-task" data-id="${task.id}" data-task-id="${task.id}" data-can-drag="${canEditTask(task) ? "true" : "false"}" draggable="false">
              <td><span class="pill">${escapeHtml(task.taskType || "Dev")}</span></td>
              <td><strong>${escapeHtml(task.code)}</strong><br>${bugFixIconHtml(task)}${escapeHtml(task.title)}</td>
              <td>${escapeHtml(projectName(task.projectId))}</td>
              <td>${task.sprintId ? `<span class="pill sprint-pill">${escapeHtml(sprintName(task.sprintId))}</span>` : `<span class="muted">Unassigned</span>`}</td>
              <td><span class="pill">${escapeHtml(task.status)}</span></td>
              <td><span class="pill priority-${escapeAttr(task.priority)}">${escapeHtml(task.priority)}</span></td>
              <td>${avatarsHtml(task.assignees)}</td>
              <td class="reveal-actions action-cell">${taskButtonsHtml(task)}</td>
            </tr>
          `).join("") || `<tr><td colspan="8"><div class="empty">No backlog or Todo items yet.</div></td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function renderTasks() {
  if (!taskProjectId && state.projects.length) taskProjectId = state.projects[0].id;
  if (!state.projects.some(project => project.id === taskProjectId) && state.projects.length) {
    taskProjectId = state.projects[0].id;
  }

  const projectSprints = state.sprints.filter(sprint => sprint.projectId === taskProjectId);
  if (taskSprintId !== "all" && !projectSprints.some(sprint => sprint.id === Number(taskSprintId))) {
    taskSprintId = "all";
  }

  const allProjectDevTasks = state.tasks
    .filter(task => task.projectId === taskProjectId)
    .filter(task => task.taskType !== "Bug");
  const baseTasks = allProjectDevTasks
    .filter(task => taskSprintId === "all" || task.sprintId === Number(taskSprintId));
  const visibleTasks = filteredTaskList(baseTasks);
  const taskRows = taskRowsWithSubTasks(visibleTasks);
  const canShowCharts = allProjectDevTasks.length > 0;
  const showCharts = canShowCharts && taskVisualChartsVisible;
  const filterToggleLabel = taskFiltersVisible ? "Hide Filters" : "Show Filters";
  const chartToggleLabel = showCharts ? "Hide Charts" : "Show Charts";

  app.innerHTML = `
    ${sectionHead("Dev Tasks", `
      <button class="secondary text-icon-button ${taskFiltersVisible ? "is-on" : ""}" type="button" data-action="toggle-task-filters" aria-pressed="${taskFiltersVisible}">${buttonContent(funnelIconHtml(), filterToggleLabel)}</button>
      <button class="secondary text-icon-button ${showCharts ? "is-on" : ""}" type="button" data-action="toggle-task-visual-charts" aria-pressed="${showCharts}" ${canShowCharts ? "" : "disabled"}>${buttonContent("&#128202;", chartToggleLabel)}</button>
      <button class="primary text-icon-button" type="button" data-action="new-task">${buttonContent("&#10010;", "New Dev Task")}</button>
    `)}
    ${taskFiltersVisible ? `<div class="panel">
      <div class="task-filter-row">
        <label>
          <span>Project</span>
          <select data-filter="task-project">
            ${state.projects.map(project => `<option value="${project.id}" ${project.id === taskProjectId ? "selected" : ""}>${escapeHtml(project.code)} - ${escapeHtml(project.title)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Sprint</span>
          <select data-filter="task-sprint">
            <option value="all" ${taskSprintId === "all" ? "selected" : ""}>All Sprints</option>
            ${projectSprints.map(sprint => `<option value="${sprint.id}" ${String(sprint.id) === taskSprintId ? "selected" : ""}>${escapeHtml(sprint.code)} - ${escapeHtml(sprint.title)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select data-filter="task-sort">
            <option value="custom" ${taskFilters.sort === "custom" ? "selected" : ""}>Custom order</option>
            <option value="newest" ${taskFilters.sort === "newest" ? "selected" : ""}>Newest Dev Tasks</option>
            <option value="oldest" ${taskFilters.sort === "oldest" ? "selected" : ""}>Oldest Dev Tasks</option>
            <option value="highest-complete" ${taskFilters.sort === "highest-complete" ? "selected" : ""}>Highest Completed</option>
            <option value="lowest-complete" ${taskFilters.sort === "lowest-complete" ? "selected" : ""}>Lowest Completed</option>
          </select>
        </label>
        <label class="inline-filter-check">
          <input type="checkbox" data-filter="task-hide-completed" ${taskFilters.hideCompleted ? "checked" : ""}>
          <span>Hide Completed Dev Tasks</span>
        </label>
      </div>
      <div class="filter-stack">
        ${filterCheckList("Status", "task-status", statuses.map(value => ({ value, text: value })), taskFilters.statuses)}
        ${filterCheckList("Priority", "task-priority", priorities.map(value => ({ value, text: value })), taskFilters.priorities)}
        ${filterCheckList("Assigned", "task-assigned", state.users.map(user => ({ value: user.id, text: user.nickname })), taskFilters.assigneeIds)}
      </div>
    </div>` : ""}
    ${showCharts ? taskVisualTrackingChartsHtml(allProjectDevTasks) : ""}
    <div class="panel">
      <table class="table tasks-table">
        <thead>
          <tr>
            <th>Assigned</th>
            <th>Dev Task</th>
            <th>Project</th>
            <th>Sprint</th>
            <th>Status</th>
            <th>Priority</th>
            <th class="done-cell">Done</th>
            <th></th>
          </tr>
        </thead>
        <tbody data-reorder-list="tasks">
          ${taskRows.map(row => {
            const task = row.task;
            const rowClass = row.level ? "subtask-row" : "";
            const titleClass = row.level ? "task-title-cell subtask-title-cell" : "task-title-cell";
            const indent = Math.min(row.level, 4) * 24;

            return `
            <tr class="${rowClass} clickable-row" data-action="view-task" data-id="${task.id}" data-task-id="${task.id}" data-can-drag="${canEditTask(task) ? "true" : "false"}" draggable="false">
              <td>${taskRowAvatarsHtml(task.assignees)}</td>
              <td class="${titleClass}" style="--indent:${indent}px">
                ${row.level ? `<span class="subtask-pill">Sub-task</span>` : ""}
                <strong>${escapeHtml(task.code)}</strong><br>${bugFixIconHtml(task)}${escapeHtml(task.title)}
              </td>
              <td>${escapeHtml(projectName(task.projectId))}</td>
              <td>${escapeHtml(sprintName(task.sprintId))}</td>
              <td>${escapeHtml(task.status)}</td>
              <td><span class="pill priority-${task.priority}">${escapeHtml(task.priority)}</span></td>
              <td class="done-cell">${progressHtml(taskDisplayPercent(task))}</td>
              <td class="reveal-actions action-cell">${taskButtonsHtml(task)}</td>
            </tr>
          `;
          }).join("") || `<tr><td colspan="8"><div class="empty">No tasks for this filter.</div></td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function taskRowsWithSubTasks(tasks) {
  const taskIds = new Set(tasks.map(task => task.id));
  const childTasks = new Map();
  const rows = [];
  const rendered = new Set();

  tasks.forEach(task => {
    if (!task.parentTaskId || !taskIds.has(task.parentTaskId)) return;
    if (!childTasks.has(task.parentTaskId)) childTasks.set(task.parentTaskId, []);
    childTasks.get(task.parentTaskId).push(task);
  });

  const addTaskAndChildren = (task, level) => {
    if (rendered.has(task.id)) return;
    rendered.add(task.id);
    rows.push({ task, level });
    (childTasks.get(task.id) || []).forEach(child => addTaskAndChildren(child, level + 1));
  };

  tasks
    .filter(task => !task.parentTaskId || !taskIds.has(task.parentTaskId))
    .forEach(task => addTaskAndChildren(task, task.parentTaskId ? 1 : 0));

  // Show any orphaned or cyclic sub-tasks instead of hiding them from the table.
  tasks.forEach(task => addTaskAndChildren(task, task.parentTaskId ? 1 : 0));

  return rows;
}

function filteredTaskList(tasks) {
  const taskMap = new Map(tasks.map(task => [task.id, task]));
  const visibleIds = new Set();

  tasks
    .filter(taskMatchesTaskFiltersWithoutCompletion)
    .forEach(task => {
      const parent = task.parentTaskId ? taskMap.get(task.parentTaskId) : null;
      const completedSubTaskWithOpenParent = parent && !isTaskCompleted(parent) && isTaskCompleted(task);

      if (!taskFilters.hideCompleted || !isTaskCompleted(task) || completedSubTaskWithOpenParent) {
        visibleIds.add(task.id);
      }
    });

  // Keep completed sub-tasks under an open parent so the parent still tells the
  // full story when "Hide Completed Tasks" is turned on.
  if (taskFilters.hideCompleted) {
    tasks
      .filter(task => task.parentTaskId)
      .filter(task => isTaskCompleted(task))
      .filter(task => taskMatchesTaskFiltersWithoutCompletion(task))
      .forEach(task => {
        const parent = taskMap.get(task.parentTaskId);
        if (parent && visibleIds.has(parent.id) && !isTaskCompleted(parent)) {
          visibleIds.add(task.id);
        }
      });
  }

  [...visibleIds].forEach(id => addTaskAncestors(id, visibleIds, taskMap));

  return tasks
    .filter(task => visibleIds.has(task.id))
    .sort(taskSortCompare);
}

function addTaskAncestors(taskId, visibleIds, taskMap) {
  let task = taskMap.get(taskId);
  while (task?.parentTaskId && taskMap.has(task.parentTaskId)) {
    task = taskMap.get(task.parentTaskId);
    visibleIds.add(task.id);
  }
}

function taskMatchesTaskFiltersWithoutCompletion(task) {
  const selectedStatuses = taskFilters.statuses || [];
  const selectedAssignees = taskFilters.assigneeIds || [];
  const selectedPriorities = taskFilters.priorities || [];
  const taskAssignees = (task.assigneeIds || []).map(String);

  if (selectedStatuses.length && !selectedStatuses.includes(task.status)) return false;
  if (selectedPriorities.length && !selectedPriorities.includes(task.priority)) return false;
  if (selectedAssignees.length && !taskAssignees.some(id => selectedAssignees.includes(id))) return false;

  return true;
}

function taskSortCompare(a, b) {
  if (taskFilters.sort === "custom") return taskOrderCompare(a, b);
  if (taskFilters.sort === "oldest") return taskCreatedTime(a) - taskCreatedTime(b) || a.id - b.id;
  if (taskFilters.sort === "highest-complete") return taskDisplayPercent(b) - taskDisplayPercent(a) || taskCreatedTime(b) - taskCreatedTime(a);
  if (taskFilters.sort === "lowest-complete") return taskDisplayPercent(a) - taskDisplayPercent(b) || taskCreatedTime(b) - taskCreatedTime(a);
  return taskCreatedTime(b) - taskCreatedTime(a) || b.id - a.id;
}

function boardTaskSortCompare(a, b) {
  if (boardSort === "doneFirst") return b.percentCompleted - a.percentCompleted || taskOrderCompare(a, b);
  if (boardSort === "openFirst") return a.percentCompleted - b.percentCompleted || taskOrderCompare(a, b);
  return taskOrderCompare(a, b);
}

function taskOrderCompare(a, b) {
  return Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || a.id - b.id;
}

function taskCreatedTime(task) {
  return new Date(task.createdAt || 0).getTime();
}

function renderBugs() {
  const filteredBugs = filteredBugReports();
  const canShowCharts = filteredBugs.length > 0;
  const showCharts = canShowCharts && bugVisualChartsVisible;
  const filterToggleLabel = bugFiltersVisible ? "Hide Filters" : "Show Filters";
  const chartToggleLabel = showCharts ? "Hide Charts" : "Show Charts";

  app.innerHTML = `
    ${sectionHead("Bug Tracking", `
      <button class="secondary text-icon-button ${bugFiltersVisible ? "is-on" : ""}" type="button" data-action="toggle-bug-filters" aria-pressed="${bugFiltersVisible}">${buttonContent(funnelIconHtml(), filterToggleLabel)}</button>
      <button class="secondary text-icon-button ${showCharts ? "is-on" : ""}" type="button" data-action="toggle-bug-visual-charts" aria-pressed="${showCharts}" ${canShowCharts ? "" : "disabled"}>${buttonContent("&#128202;", chartToggleLabel)}</button>
      <button class="primary text-icon-button" type="button" data-action="new-bug">${buttonContent("&#9888;", "New Bug Report")}</button>
    `)}
    ${bugFiltersVisible ? `<div class="panel">
      <div class="filter-row bug-filter-row">
        ${filterSelect("Project", "bug-project", state.projects.map(project => ({ value: project.id, text: `${project.code} - ${project.title}` })), bugFilters.projectId || "", "All projects")}
        ${filterSelect("Status", "bug-status", statuses.map(value => ({ value, text: value })), bugFilters.status || "", "All statuses")}
        ${filterSelect("Priority", "bug-priority", priorities.map(value => ({ value, text: value })), bugFilters.priority || "", "All priorities")}
        ${filterSelect("Severity", "bug-severity", severities.map(value => ({ value, text: value })), bugFilters.severity || "", "All severities")}
        ${filterSelect("Environment", "bug-environment", environments.map(value => ({ value, text: value })), bugFilters.environment || "", "All environments")}
      </div>
      <div class="filter-stack">
        ${filterCheckList("Reporter", "bug-reporter", state.users.map(user => ({ value: user.id, text: user.nickname })), bugFilters.reporterIds)}
        ${filterCheckList("Assignee", "bug-assignee", state.users.map(user => ({ value: user.id, text: user.nickname })), bugFilters.assigneeIds)}
      </div>
    </div>` : ""}
    ${showCharts ? bugVisualTrackingChartsHtml(filteredBugs) : ""}
    <div class="panel">
      <table class="table bugs-table">
        <thead>
          <tr>
            <th>Reporter</th>
            <th>Assignee</th>
            <th>Bug Report</th>
            <th>Project</th>
            <th>Sprint</th>
            <th>Status</th>
            <th>Severity</th>
            <th>Priority</th>
            <th></th>
          </tr>
        </thead>
        <tbody data-reorder-list="bugs">
          ${filteredBugs.map(bug => `
            <tr class="clickable-row" data-action="view-task" data-id="${bug.id}" data-task-id="${bug.id}" data-can-drag="${canEditTask(bug) ? "true" : "false"}" draggable="false">
              <td>${taskRowAvatarsHtml(bug.reporters)}</td>
              <td>${taskRowAvatarsHtml(bug.assignees)}</td>
              <td><strong>${escapeHtml(bug.code)}</strong><br>${escapeHtml(bug.title)}</td>
              <td>${escapeHtml(projectName(bug.projectId))}</td>
              <td>${escapeHtml(sprintName(bug.sprintId))}</td>
              <td>${escapeHtml(bug.status)}</td>
              <td><span class="pill severity-${escapeAttr(bug.severity)}">${escapeHtml(bug.severity || "")}</span></td>
              <td><span class="pill priority-${escapeAttr(bug.priority)}">${escapeHtml(bug.priority)}</span></td>
              <td class="action-cell">${taskButtonsHtml(bug)}</td>
            </tr>
          `).join("") || `<tr><td colspan="9"><div class="empty">No bug reports match these filters.</div></td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function filteredBugReports() {
  return state.tasks
    .filter(task => task.taskType === "Bug")
    .filter(bug => !bugFilters.projectId || bug.projectId === Number(bugFilters.projectId))
    .filter(bug => !bugFilters.status || bug.status === bugFilters.status)
    .filter(bug => !bugFilters.priority || bug.priority === bugFilters.priority)
    .filter(bug => !bugFilters.severity || bug.severity === bugFilters.severity)
    .filter(bug => !bugFilters.environment || bug.environment === bugFilters.environment)
    .filter(bug => !bugFilters.reporterIds.length || bug.reporterIds.map(String).some(id => bugFilters.reporterIds.includes(id)))
    .filter(bug => !bugFilters.assigneeIds.length || bug.assigneeIds.map(String).some(id => bugFilters.assigneeIds.includes(id)))
    .sort(taskOrderCompare);
}

function toggleBugVisualCharts() {
  bugVisualChartsVisible = !bugVisualChartsVisible;
  localStorage.setItem("pmt-bug-visual-charts-visible", String(bugVisualChartsVisible));
  renderBugs();
}

function toggleBugFilters() {
  bugFiltersVisible = !bugFiltersVisible;
  localStorage.setItem("pmt-bug-filters-visible", String(bugFiltersVisible));
  renderBugs();
}

function toggleTaskVisualCharts() {
  taskVisualChartsVisible = !taskVisualChartsVisible;
  localStorage.setItem("pmt-task-visual-charts-visible", String(taskVisualChartsVisible));
  renderTasks();
}

function toggleTaskFilters() {
  taskFiltersVisible = !taskFiltersVisible;
  localStorage.setItem("pmt-task-filters-visible", String(taskFiltersVisible));
  renderTasks();
}

function bugVisualTrackingChartsHtml(filteredBugs) {
  const sprintRows = bugSprintChartRows(filteredBugs);
  const charts = [
    bugTrendLineChartHtml(sprintRows),
    bugSeverityPieChartHtml(filteredBugs),
    bugReportedResolvedColumnChartHtml(sprintRows),
    bugCurrentSprintPieChartHtml(filteredBugs)
  ].filter(Boolean);

  return VisualCharts.panel("Bug Tracking Charts", charts);
}

function bugCurrentSprintPieChartHtml(filteredBugs) {
  const currentSprints = bugChartCurrentSprints();
  const currentSprintIds = new Set(currentSprints.map(sprint => sprint.id));
  const currentBugs = filteredBugs.filter(bug => currentSprintIds.has(bug.sprintId));
  const resolvedBugs = currentBugs.filter(isBugResolved);
  const openBugs = currentBugs.filter(bug => !isBugResolved(bug));

  if (!currentSprints.length) {
    return VisualCharts.card({
      title: "Current Sprint Bug Mix",
      subtitle: "No current Sprint is available for the selected project filter.",
      body: `<div class="empty compact-empty">No current Sprint was found.</div>`
    });
  }

  const items = [
    bugChartGroupedItem("Resolved", resolvedBugs, "var(--green)", `Resolved: ${resolvedBugs.length} bug report${resolvedBugs.length === 1 ? "" : "s"}`),
    bugChartGroupedItem("Still Open", openBugs, "var(--amber)", `Still Open: ${openBugs.length} bug report${openBugs.length === 1 ? "" : "s"}`)
  ].filter(item => item.value > 0);

  return VisualCharts.card({
    title: "Current Sprint Bug Mix",
    subtitle: currentSprints.map(sprint => sprint.code).join(", "),
    body: VisualCharts.pieChart(items, `${currentBugs.length} total`, "No bugs match the current Sprint filter.", { donut: true })
  });
}

function bugTrendLineChartHtml(sprintRows) {
  if (!sprintRows.length) return null;

  return VisualCharts.card({
    title: "Bug Trend by Sprint",
    subtitle: "Line graph compares reported versus resolved bugs over time.",
    body: VisualCharts.lineChart(sprintRows, [
      { key: "reported", label: "Reported", color: "var(--rose)" },
      { key: "resolved", label: "Resolved", color: "var(--green)" }
    ])
  });
}

function bugReportedResolvedColumnChartHtml(sprintRows) {
  if (!sprintRows.length) return null;

  return VisualCharts.card({
    title: "Reported vs Resolved by Sprint",
    subtitle: "Grouped column chart shows throughput per Sprint.",
    body: VisualCharts.columnChart(sprintRows, [
      { key: "reported", label: "Reported", color: "var(--rose)" },
      { key: "resolved", label: "Resolved", color: "var(--green)" },
      { key: "open", label: "Open", color: "var(--amber)" }
    ])
  });
}

function bugSeverityPieChartHtml(filteredBugs) {
  const items = severities
    .map(severity => {
      const bugs = filteredBugs.filter(bug => bug.severity === severity);
      return bugChartGroupedItem(severity, bugs, bugSeverityColor(severity), `${severity}: ${bugs.length} bug report${bugs.length === 1 ? "" : "s"}`);
    })
    .filter(item => item.value > 0);

  if (!items.length) return null;

  return VisualCharts.card({
    title: "Bug Severity Share",
    subtitle: "Pie chart shows the severity mix for the current filters.",
    body: VisualCharts.pieChart(items, `${filteredBugs.length} total`, "No severity data is available.", { donut: false })
  });
}

function bugChartGroupedItem(label, bugs, color, tooltip) {
  const bugIds = bugs.map(bug => bug.id);
  const actionTarget = bugs.length === 1
    ? { action: "view-task", id: bugs[0].id }
    : bugs.length > 1
      ? { action: "chart-drill-bugs", ids: bugIds.join(","), chartTitle: label }
      : {};
  return {
    label,
    value: bugs.length,
    color,
    tooltip,
    bugIds,
    ...actionTarget
  };
}

function bugSprintChartRows(filteredBugs) {
  const rows = new Map();

  filteredBugs.forEach(bug => {
    const sprintId = Number(bug.sprintId || 0);
    if (!rows.has(sprintId)) {
      rows.set(sprintId, {
        sprintId,
        label: sprintId ? sprintChartLabel(sprintId) : "No Sprint",
        reported: 0,
        resolved: 0,
        open: 0
      });
    }

    const row = rows.get(sprintId);
    row.reported += 1;
    if (isBugResolved(bug)) {
      row.resolved += 1;
    } else {
      row.open += 1;
    }
  });

  return [...rows.values()].sort((a, b) => {
    if (!a.sprintId) return 1;
    if (!b.sprintId) return -1;
    const sprintA = sprintById(a.sprintId);
    const sprintB = sprintById(b.sprintId);
    const aTime = sprintA ? ganttStartDate(sprintA)?.getTime() || 0 : 0;
    const bTime = sprintB ? ganttStartDate(sprintB)?.getTime() || 0 : 0;
    return aTime - bTime || a.label.localeCompare(b.label);
  });
}

function bugChartCurrentSprints() {
  const projectIds = bugFilters.projectId
    ? [Number(bugFilters.projectId)]
    : state.projects.map(project => project.id);

  return projectIds
    .map(projectId => currentSprintForProject(state.sprints.filter(sprint => sprint.projectId === projectId)))
    .filter(Boolean);
}

function sprintChartLabel(sprintId) {
  const sprint = sprintById(sprintId);
  if (!sprint) return "Unknown Sprint";
  const project = projectById(sprint.projectId);
  return project ? `${project.code} ${sprint.code}` : sprint.code;
}

function isBugResolved(bug) {
  const qaPassedIndex = statuses.indexOf("QA Passed");
  const bugStatusIndex = statuses.indexOf(bug?.status || "");
  return qaPassedIndex >= 0 && bugStatusIndex >= qaPassedIndex;
}

function taskVisualTrackingChartsHtml(devTasks) {
  const currentSprint = taskChartCurrentSprint();
  const currentTasks = currentSprint
    ? devTasks.filter(task => task.sprintId === currentSprint.id)
    : [];
  const charts = [
    taskCurrentSprintPieChartHtml(currentSprint, currentTasks),
    taskPastSixSprintsColumnChartHtml(devTasks, currentSprint),
    taskStatusHorizontalChartHtml(currentSprint, currentTasks),
    taskDeveloperWorkloadChartHtml(currentSprint, currentTasks)
  ].filter(Boolean);

  return VisualCharts.panel("Dev Task Tracking Charts", charts);
}

function taskCurrentSprintPieChartHtml(currentSprint, currentTasks) {
  if (!currentSprint) {
    return VisualCharts.card({
      title: "Current Sprint Dev Task Mix",
      subtitle: "No current Sprint is available for the selected project.",
      body: `<div class="empty compact-empty">No current Sprint was found.</div>`
    });
  }

  const completedTasks = currentTasks.filter(isTaskCompleted);
  const openTasks = currentTasks.filter(task => !isTaskCompleted(task));
  const items = [
    taskChartGroupedItem("Completed", completedTasks, "var(--green)", `Completed: ${completedTasks.length} Dev Task${completedTasks.length === 1 ? "" : "s"}`),
    taskChartGroupedItem("Still Open", openTasks, "var(--amber)", `Still Open: ${openTasks.length} Dev Task${openTasks.length === 1 ? "" : "s"}`)
  ].filter(item => item.value > 0);

  return VisualCharts.card({
    title: "Current Sprint Dev Task Mix",
    subtitle: currentSprint.code,
    body: VisualCharts.pieChart(items, `${currentTasks.length} total`, "No Dev Tasks match the current Sprint filter.", { donut: false })
  });
}

function taskPastSixSprintsColumnChartHtml(devTasks, currentSprint) {
  if (!currentSprint) return null;

  const projectSprints = state.sprints
    .filter(sprint => sprint.projectId === taskProjectId)
    .sort((a, b) => (ganttStartDate(a)?.getTime() || 0) - (ganttStartDate(b)?.getTime() || 0) || a.code.localeCompare(b.code));
  const currentIndex = projectSprints.findIndex(sprint => sprint.id === currentSprint.id);
  const endIndex = currentIndex >= 0 ? currentIndex : projectSprints.length - 1;
  const sprints = projectSprints.slice(Math.max(0, endIndex - 5), endIndex + 1);
  const rows = sprints.map(sprint => {
    const sprintTasks = devTasks.filter(task => task.sprintId === sprint.id);
    return {
      sprintId: sprint.id,
      label: sprint.code,
      total: sprintTasks.length,
      completed: sprintTasks.filter(isTaskCompleted).length
    };
  }).filter(row => row.total > 0 || row.completed > 0);

  if (!rows.length) return null;

  return VisualCharts.card({
    title: "Dev Tasks Completed by Sprint",
    subtitle: "Past 6 Sprints, including the current Sprint.",
    body: VisualCharts.columnChart(rows, [
      { key: "total", label: "Dev Tasks", color: "var(--blue)" },
      { key: "completed", label: "Completed", color: "var(--green)" }
    ], { itemLabel: "Dev Task" })
  });
}

function taskStatusHorizontalChartHtml(currentSprint, currentTasks) {
  if (!currentSprint) return null;

  const statusItems = statuses
    .filter(status => !status.toLowerCase().includes("qa") && status.toLowerCase() !== "backlog")
    .map(status => {
      const tasks = currentTasks.filter(task => task.status === status);
      return taskChartGroupedItem(status, tasks, statusColor(status), `${status}: ${tasks.length} Dev Task${tasks.length === 1 ? "" : "s"}`);
    })
    .filter(item => item.value > 0);

  return VisualCharts.card({
    title: "Current Sprint Dev Tasks by Status",
    subtitle: "QA and Backlog statuses are hidden for this chart.",
    body: VisualCharts.horizontalBarChart(statusItems, "No non-QA Dev Task statuses are available for the current Sprint.")
  });
}

function taskDeveloperWorkloadChartHtml(currentSprint, currentTasks) {
  if (!currentSprint) return null;

  const rows = state.users.map(user => {
    const userTasks = currentTasks.filter(task => (task.assigneeIds || []).map(String).includes(String(user.id)));
    const categories = devTaskWorkloadCategories()
      .map(category => {
        const tasks = userTasks.filter(task => devTaskWorkloadCategory(task) === category.label);
        return taskChartGroupedItem(category.label, tasks, category.color, `${user.nickname} ${category.label}: ${tasks.length} Dev Task${tasks.length === 1 ? "" : "s"}`);
      })
      .filter(item => item.value > 0);

    return {
      user,
      total: userTasks.length,
      categories
    };
  }).filter(row => row.total > 0);

  return VisualCharts.card({
    title: "Developer Workload Distribution",
    subtitle: currentSprint.code,
    body: developerWorkloadDistributionHtml(rows)
  });
}

function developerWorkloadDistributionHtml(rows) {
  if (!rows.length) return `<div class="empty compact-empty">No assigned Dev Tasks were found for the current Sprint.</div>`;

  const usedCategories = new Set(rows.flatMap(row => row.categories.map(item => item.label)));
  const legendItems = devTaskWorkloadCategories().filter(category => usedCategories.has(category.label));

  return `
    <div class="workload-chart">
      ${rows.map(row => `
        <div class="workload-row">
          <div class="workload-person">
            <img class="avatar" src="${escapeAttr(row.user.avatarUrl || "/assets/avatar-default.svg")}" alt="">
            <span>${escapeHtml(row.user.nickname)}</span>
            <b>${row.total}</b>
          </div>
          <div class="workload-stack" aria-label="${escapeAttr(row.user.nickname)} workload">
            ${row.categories.map(item => {
              const width = Math.max(8, Math.round((item.value / row.total) * 100));
              const actionAttrs = VisualCharts.chartActionAttributes({ ...item, chartTitle: `${row.user.nickname} ${item.label}` });
              return `
                <button type="button" class="workload-segment ${item.action ? "is-clickable" : ""}" style="--value:${width}%; --chart-color:${escapeAttr(item.color)}" ${actionAttrs} data-chart-tooltip="${escapeAttr(item.tooltip)}" title="${escapeAttr(item.tooltip)}">
                  <span>${item.value}</span>
                </button>
              `;
            }).join("")}
          </div>
        </div>
      `).join("")}
    </div>
    ${VisualCharts.legend(legendItems)}
  `;
}

function devTaskWorkloadCategories() {
  return [
    { label: "Todo", color: "var(--blue)" },
    { label: "In Progress", color: "var(--teal)" },
    { label: "Code Complete", color: "var(--green)" },
    { label: "Ready for QA", color: "var(--amber)" },
    { label: "QA", color: "var(--rose)" },
    { label: "Deployed", color: "#c5d35c" }
  ];
}

function devTaskWorkloadCategory(task) {
  if (task.status === "Todo" || task.status === "Backlog") return "Todo";
  if (task.status === "In Progress") return "In Progress";
  if (task.status === "Code Complete") return "Code Complete";
  if (task.status === "Ready for QA") return "Ready for QA";
  if ((task.status || "").includes("QA")) return "QA";
  if ((task.status || "").startsWith("Deployed")) return "Deployed";
  return "In Progress";
}

function taskChartGroupedItem(label, tasks, color, tooltip) {
  const taskIds = tasks.map(task => task.id);
  const actionTarget = tasks.length === 1
    ? { action: "view-task", id: tasks[0].id }
    : tasks.length > 1
      ? { action: "chart-drill-tasks", ids: taskIds.join(","), chartTitle: label }
      : {};

  return {
    label,
    value: tasks.length,
    color,
    tooltip,
    taskIds,
    ...actionTarget
  };
}

function taskChartCurrentSprint() {
  return currentSprintForProject(state.sprints.filter(sprint => sprint.projectId === taskProjectId));
}

function bugSeverityColor(severity) {
  const colors = {
    Trivial: "#76A9FF",
    Minor: "#35C7BD",
    Major: "#E4A53A",
    Critical: "#EE6B70"
  };
  return colors[severity] || "var(--teal)";
}

const VisualCharts = {
  panel(title, charts) {
    return `
      <div class="panel chart-panel visual-chart-panel">
        <div class="chart-panel-head">
          <div>
            <h2>${escapeHtml(title)}</h2>
            <p>Pie, line, column, and bar visuals using only HTML, CSS, and JavaScript.</p>
          </div>
        </div>
        <div class="chart-grid visual-chart-grid">
          ${charts.join("")}
        </div>
      </div>
    `;
  },

  card(chart) {
    return `
      <section class="chart-card visual-chart-card">
        <div class="chart-card-head">
          <div>
            <h2>${escapeHtml(chart.title)}</h2>
            ${chart.subtitle ? `<p>${escapeHtml(chart.subtitle)}</p>` : ""}
          </div>
          <button class="icon-action chart-expand-button" type="button" data-action="expand-visual-chart" title="Expand chart" aria-label="Expand chart">&#10530;</button>
        </div>
        ${chart.body}
      </section>
    `;
  },

  pieChart(items, centerText, emptyText, options = {}) {
    if (!items.length) return `<div class="empty compact-empty">${escapeHtml(emptyText)}</div>`;

    const total = items.reduce((sum, item) => sum + item.value, 0);
    if (!total) return `<div class="empty compact-empty">${escapeHtml(emptyText)}</div>`;

    const donut = options.donut !== false;
    const center = 90;
    const outerRadius = 82;
    const innerRadius = donut ? 46 : 0;
    let start = 0;
    const slices = items.map((item, index) => {
      const sweep = (item.value / total) * 360;
      const end = index === items.length - 1 ? 360 : start + sweep;
      const tooltip = item.tooltip || `${item.label}: ${item.value}`;
      const actionAttrs = this.chartActionAttributes(item);
      const interactiveClass = item.action ? " is-clickable" : "";
      const commonAttrs = `class="pie-chart-slice${interactiveClass}" style="--chart-color:${escapeAttr(item.color)}" data-chart-tooltip="${escapeAttr(tooltip)}" ${actionAttrs}`;
      const sliceHtml = !donut && end - start >= 359.99
        ? `<circle ${commonAttrs} cx="${center}" cy="${center}" r="${outerRadius}"><title>${escapeHtml(tooltip)}</title></circle>`
        : `<path ${commonAttrs} d="${this.pieSlicePath(center, center, outerRadius, innerRadius, start, Math.min(end, 359.99))}"><title>${escapeHtml(tooltip)}</title></path>`;
      start = end;
      return sliceHtml;
    }).join("");

    return `
      <div class="pie-chart-layout">
        <div class="pie-chart ${donut ? "is-donut" : "is-filled"}" data-chart-tooltip="${escapeAttr(centerText)}">
          <svg class="pie-chart-svg" viewBox="0 0 180 180" role="img" aria-label="${escapeAttr(centerText)}">
            ${slices}
            ${donut ? `<circle class="pie-chart-hole" cx="${center}" cy="${center}" r="${innerRadius - 2}"></circle>` : ""}
            <text class="pie-chart-center-text" x="${center}" y="${center}">${escapeHtml(centerText)}</text>
          </svg>
        </div>
        <div class="chart-legend-list">
          ${items.map(item => this.legendItem(item, total)).join("")}
        </div>
      </div>
    `;
  },

  piePoint(cx, cy, radius, degrees) {
    const radians = (degrees - 90) * Math.PI / 180;
    return {
      x: this.chartNumber(cx + radius * Math.cos(radians)),
      y: this.chartNumber(cy + radius * Math.sin(radians))
    };
  },

  pieSlicePath(cx, cy, outerRadius, innerRadius, startDegrees, endDegrees) {
    const outerStart = this.piePoint(cx, cy, outerRadius, startDegrees);
    const outerEnd = this.piePoint(cx, cy, outerRadius, endDegrees);
    const largeArc = endDegrees - startDegrees > 180 ? 1 : 0;

    if (!innerRadius) {
      return `M ${cx} ${cy} L ${outerStart.x} ${outerStart.y} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y} Z`;
    }

    const innerStart = this.piePoint(cx, cy, innerRadius, startDegrees);
    const innerEnd = this.piePoint(cx, cy, innerRadius, endDegrees);
    return `M ${outerStart.x} ${outerStart.y} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y} L ${innerEnd.x} ${innerEnd.y} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y} Z`;
  },

  chartNumber(value) {
    return Number(value).toFixed(2).replace(/\.?0+$/, "");
  },

  chartActionAttributes(item) {
    if (!item.action) return "";

    const attrs = [
      `data-action="${escapeAttr(item.action)}"`,
      item.id ? `data-id="${escapeAttr(item.id)}"` : "",
      item.ids ? `data-ids="${escapeAttr(item.ids)}"` : "",
      item.chartTitle ? `data-chart-title="${escapeAttr(item.chartTitle)}"` : ""
    ].filter(Boolean);

    return attrs.join(" ");
  },

  lineChart(rows, series) {
    const chartWidth = Math.max(620, rows.length * 72);
    const chartHeight = 260;
    const padding = { left: 42, right: 28, top: 22, bottom: 56 };
    const plotWidth = chartWidth - padding.left - padding.right;
    const plotHeight = chartHeight - padding.top - padding.bottom;
    const maxValue = Math.max(1, ...rows.flatMap(row => series.map(item => row[item.key] || 0)));
    const xStep = rows.length > 1 ? plotWidth / (rows.length - 1) : 0;
    const yFor = value => padding.top + plotHeight - ((value || 0) / maxValue) * plotHeight;
    const xFor = index => rows.length > 1 ? padding.left + (index * xStep) : padding.left + (plotWidth / 2);

    const gridLines = [0, 0.25, 0.5, 0.75, 1].map(step => {
      const y = padding.top + plotHeight - (plotHeight * step);
      const label = Math.round(maxValue * step);
      return `
        <line class="line-chart-gridline" x1="${padding.left}" y1="${y}" x2="${chartWidth - padding.right}" y2="${y}"></line>
        <text class="line-chart-axis-label" x="8" y="${y + 4}">${label}</text>
      `;
    }).join("");

    return `
      <div class="visual-chart-scroll">
        <svg class="line-chart" viewBox="0 0 ${chartWidth} ${chartHeight}" width="${chartWidth}" height="${chartHeight}" role="img" aria-label="Bug trend line graph">
          ${gridLines}
          ${series.map(item => {
            const points = rows.map((row, index) => `${xFor(index)},${yFor(row[item.key])}`).join(" ");
            return `<polyline class="line-chart-path" points="${points}" style="--chart-color:${escapeAttr(item.color)}"></polyline>`;
          }).join("")}
          ${rows.map((row, index) => {
            const label = rows.length > 12 && index % 2 ? "" : row.label;
            return label ? `<text class="line-chart-x-label" x="${xFor(index)}" y="${chartHeight - 18}" transform="rotate(-32 ${xFor(index)} ${chartHeight - 18})">${escapeHtml(label)}</text>` : "";
          }).join("")}
          ${series.flatMap(item => rows.map((row, index) => {
            const value = row[item.key] || 0;
            const tooltip = `${row.label}: ${value} ${item.label.toLowerCase()} bug report${value === 1 ? "" : "s"}`;
            return `
              <circle class="line-chart-point" cx="${xFor(index)}" cy="${yFor(value)}" r="5" style="--chart-color:${escapeAttr(item.color)}" data-chart-tooltip="${escapeAttr(tooltip)}" data-action="${row.sprintId ? "chart-open-sprint" : ""}" data-id="${escapeAttr(row.sprintId || "")}"></circle>
            `;
          })).join("")}
        </svg>
      </div>
      ${this.legend(series)}
    `;
  },

  columnChart(rows, series, options = {}) {
    const maxValue = Math.max(1, ...rows.flatMap(row => series.map(item => row[item.key] || 0)));
    const itemLabel = options.itemLabel || "bug report";

    return `
      <div class="column-chart-scroll">
        <div class="column-chart" style="--column-count:${rows.length}">
          ${rows.map(row => `
            <div class="column-group">
              <div class="column-bars">
                ${series.map(item => {
                  const value = row[item.key] || 0;
                  const percent = Math.round((value / maxValue) * 100);
                  const tooltip = `${row.label}: ${value} ${item.label.toLowerCase()} ${itemLabel}${value === 1 ? "" : "s"}`;
                  return `
                    <button type="button" class="visual-column" data-action="${row.sprintId ? "chart-open-sprint" : ""}" data-id="${escapeAttr(row.sprintId || "")}" data-chart-tooltip="${escapeAttr(tooltip)}" title="${escapeAttr(tooltip)}" style="--value:${percent}%; --chart-color:${escapeAttr(item.color)}">
                      <span>${value}</span>
                    </button>
                  `;
                }).join("")}
              </div>
              <div class="column-label" title="${escapeAttr(row.label)}">${escapeHtml(row.label)}</div>
            </div>
          `).join("")}
        </div>
      </div>
      ${this.legend(series)}
    `;
  },

  horizontalBarChart(items, emptyText) {
    if (!items.length) return `<div class="empty compact-empty">${escapeHtml(emptyText)}</div>`;

    const maxValue = Math.max(1, ...items.map(item => item.value || 0));

    return `
      <div class="horizontal-chart">
        ${items.map(item => {
          const percent = Math.round((item.value / maxValue) * 100);
          const tag = item.action ? "button" : "div";
          const actionAttrs = item.action ? ` type="button" ${this.chartActionAttributes(item)}` : "";
          const tooltip = escapeAttr(item.tooltip || `${item.label}: ${item.value}`);
          return `
            <${tag}${actionAttrs} class="horizontal-chart-row ${item.action ? "is-clickable" : ""}" data-chart-tooltip="${tooltip}" title="${tooltip}">
              <span class="horizontal-chart-label">${escapeHtml(item.label)}</span>
              <span class="horizontal-chart-track">
                <span class="horizontal-chart-fill" style="--value:${percent}%; --chart-color:${escapeAttr(item.color)}"></span>
              </span>
              <b>${item.value}</b>
            </${tag}>
          `;
        }).join("")}
      </div>
    `;
  },

  legend(items) {
    return `
      <div class="visual-chart-legend">
        ${items.map(item => `<span><i style="--chart-color:${escapeAttr(item.color)}"></i>${escapeHtml(item.label)}</span>`).join("")}
      </div>
    `;
  },

  legendItem(item, total) {
    const percent = Math.round((item.value / total) * 100);
    const tag = item.action ? "button" : "div";
    const actionAttrs = item.action ? ` type="button" ${this.chartActionAttributes(item)}` : "";
    const tooltip = escapeAttr(item.tooltip || `${item.label}: ${item.value}`);

    return `
      <${tag}${actionAttrs} class="chart-legend-row ${item.action ? "is-clickable" : ""}" data-chart-tooltip="${tooltip}" title="${tooltip}">
        <i style="--chart-color:${escapeAttr(item.color)}"></i>
        <span>${escapeHtml(item.label)}</span>
        <b>${item.value}</b>
        <em>${percent}%</em>
      </${tag}>
    `;
  }
};

function renderSettings() {
  const lookupTypes = [...new Set(["Status", "Priority", "Severity", "Environment", ...(state.lookups || []).map(item => item.lookupType)])].sort();
  const categories = [...lookupTypes, "Users", "Holidays", "Development"];
  if (!categories.includes(settingsCategory)) settingsCategory = lookupTypes[0] || "Status";

  const isUsers = settingsCategory === "Users";
  const isHolidays = settingsCategory === "Holidays";
  const isDevelopment = settingsCategory === "Development";
  if (!isUsers && !isHolidays && !isDevelopment) {
    lookupTypeFilter = settingsCategory;
    localStorage.setItem("pmt-lookup-type", lookupTypeFilter);
  }

  let actionsHtml = `<button class="primary text-icon-button" type="button" data-action="new-lookup" ${currentUser().isAdmin ? "" : "disabled"}>${buttonContent("&#10010;", "New Setting")}</button>`;
  if (isUsers) actionsHtml = `<button class="primary text-icon-button" type="button" data-action="new-user" ${currentUser().isAdmin ? "" : "disabled"}>${buttonContent("&#10010;", "New User")}</button>`;
  if (isHolidays) actionsHtml = `<button class="primary text-icon-button" type="button" data-action="new-holiday" ${currentUser().isAdmin ? "" : "disabled"}>${buttonContent("&#10010;", "New Holiday")}</button>`;
  if (isDevelopment) actionsHtml = "";

  const contentHtml = isUsers
    ? settingsUsersHtml()
    : isHolidays
      ? settingsHolidaysHtml()
      : isDevelopment
        ? settingsDevelopmentHtml()
        : settingsLookupHtml(settingsCategory);

  app.innerHTML = `
    ${sectionHead("Settings", actionsHtml)}
    <div class="lookup-layout">
      <aside class="panel lookup-picker">
        ${categories.map(type => `
          <button type="button" data-action="select-lookup-type" data-id="0" data-type="${escapeAttr(type)}" class="${type === settingsCategory ? "active" : ""}">
            ${buttonContent(settingsCategoryIcon(type), type)}
          </button>
        `).join("")}
      </aside>
      ${contentHtml}
    </div>
  `;
}

function settingsDevelopmentHtml() {
  const canRun = currentUser().isAdmin;
  return `
    <div class="panel development-panel">
      <div>
        <h2>Development</h2>
        <p class="muted">These tools reset test data during development. Use the named PMT button when PMT itself should be cleared.</p>
      </div>
      <div class="development-actions">
        <div class="development-action-row">
          <div>
            <strong>Clear All Except PMT</strong>
            <p class="muted">Deletes non-PMT Projects, Sprints, Dev Tasks, Bugs, Scrum, and Documentation.</p>
          </div>
          <button class="secondary text-icon-button" type="button" data-action="development-clear-non-pmt" ${canRun ? "" : "disabled"}>${buttonContent("&#128465;", "Clear All Except PMT")}</button>
        </div>
        <div class="development-action-row danger-row">
          <div>
            <strong>Clear PMT</strong>
            <p class="muted">Deletes the PMT Project, Sprints, Dev Tasks, Bugs, Scrum, and Documentation.</p>
          </div>
          <button class="danger text-icon-button" type="button" data-action="development-clear-pmt" ${canRun ? "" : "disabled"}>${buttonContent("&#9888;", "Clear PMT")}</button>
        </div>
        <div class="development-action-row">
          <div>
            <strong>Clear Users</strong>
            <p class="muted">Deletes every user except Sin and remaps ownership, assignees, reporters, and audit records to Sin.</p>
          </div>
          <button class="secondary text-icon-button" type="button" data-action="development-clear-users" ${canRun ? "" : "disabled"}>${buttonContent("&#128100;", "Clear Users")}</button>
        </div>
        <div class="development-action-row">
          <div>
            <strong>Restore Initial Seed Data</strong>
            <p class="muted">Restores the PMT, LMS, and HLS demo data from the SQL seed scripts.</p>
          </div>
          <button class="primary text-icon-button" type="button" data-action="development-restore-seed-data" ${canRun ? "" : "disabled"}>${buttonContent("&#8635;", "Restore Initial Seed Data")}</button>
        </div>
        <div class="development-action-row">
          <div>
            <strong>Clear User Preferences Stored in Local Storage</strong>
            <p class="muted">Clears this browser's PMT preferences and reloads the app with first-launch defaults.</p>
          </div>
          <button class="secondary text-icon-button" type="button" data-action="development-clear-local-storage">${buttonContent("&#9003;", "Clear User Preferences Stored in Local Storage")}</button>
        </div>
      </div>
    </div>
  `;
}

function settingsLookupHtml(type) {
  const rows = [...(state.lookups || [])]
    .filter(item => item.lookupType === type)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.value.localeCompare(b.value));

  return `
    <div class="panel">
      <table class="table">
        <thead>
          <tr>
            <th>Value</th>
            <th>Color</th>
            <th>Order</th>
            <th>Active</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(item => `
            <tr class="clickable-row" data-action="edit-lookup" data-id="${item.id}">
              <td>${escapeHtml(item.value)}</td>
              <td>${item.lookupType === "Status" ? `<span class="lookup-color" style="--status-color:${escapeAttr(statusColor(item.value))}"></span>` : `<span class="muted">n/a</span>`}</td>
              <td>${item.displayOrder}</td>
              <td>${item.isActive ? "Yes" : "No"}</td>
              <td class="action-cell">
                ${iconButton("edit-lookup", item.id, "Edit", "edit", currentUser().isAdmin)}
                ${iconButton("delete-lookup", item.id, "Deactivate", "delete", currentUser().isAdmin, "danger")}
              </td>
            </tr>
          `).join("") || `<tr><td colspan="5"><div class="empty">No setting values in this category.</div></td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function settingsHolidaysHtml() {
  const rows = [...(state.holidays || [])].sort((a, b) => new Date(b.holidayDate) - new Date(a.holidayDate) || a.name.localeCompare(b.name));

  return `
    <div class="panel">
      <table class="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Name</th>
            <th>Country</th>
            <th>Active</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(holiday => `
            <tr class="clickable-row" data-action="edit-holiday" data-id="${holiday.id}">
              <td>${escapeHtml(formatDate(holiday.holidayDate))}</td>
              <td>${escapeHtml(holiday.name)}</td>
              <td>${escapeHtml(holiday.countryCode || "PH")}</td>
              <td>${holiday.isActive ? "Yes" : "No"}</td>
              <td class="action-cell">
                ${iconButton("edit-holiday", holiday.id, "Edit", "edit", currentUser().isAdmin)}
                ${iconButton("delete-holiday", holiday.id, "Deactivate", "delete", currentUser().isAdmin, "danger")}
              </td>
            </tr>
          `).join("") || `<tr><td colspan="5"><div class="empty">No holidays have been configured.</div></td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function renderHolidays() {
  settingsCategory = "Holidays";
  renderSettings();
}

function settingsCategoryIcon(type) {
  const icons = {
    Status: "&#9679;",
    Priority: "&#9733;",
    Severity: "&#9888;",
    Environment: "&#127758;",
    Users: "&#128100;",
    Holidays: "&#128197;",
    Development: "&#128295;"
  };

  return icons[type] || "&#9881;";
}

function renderSprints() {
  if (!sprintProjectId && state.projects.length) sprintProjectId = state.projects[0].id;
  if (!state.projects.some(project => project.id === sprintProjectId) && state.projects.length) {
    sprintProjectId = state.projects[0].id;
  }

  const visibleSprints = state.sprints.filter(sprint => sprint.projectId === sprintProjectId);
  const allVisibleCollapsed = visibleSprints.length > 0 && visibleSprints.every(sprint => sprintCollapsedIds.has(sprint.id));

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
    <div class="grid">
      ${visibleSprints.map(sprint => {
        const isCollapsed = sprintCollapsedIds.has(sprint.id);
        const chartToggleTitle = isCollapsed ? "Expand Sprint charts" : "Collapse Sprint charts";

        return `
        <article class="card clickable-card sprint-card" data-action="view-sprint-tasks" data-id="${sprint.id}">
          <div class="spread sprint-card-head">
            <div>
              <h3>${escapeHtml(sprint.code)}</h3>
              <p class="muted">${escapeHtml(projectName(sprint.projectId))}</p>
            </div>
            <div class="sprint-card-actions">
              <span class="pill">${sprint.isFinished ? "Finished" : "Open"}</span>
              <button class="icon-action" type="button" data-action="toggle-sprint-card-details" data-id="${sprint.id}" title="${chartToggleTitle}" aria-label="${chartToggleTitle}" aria-expanded="${!isCollapsed}">
                ${isCollapsed ? "&#9662;" : "&#9652;"}
              </button>
            </div>
          </div>
          <p>${escapeHtml(sprint.title)}</p>
          <p class="muted">${formatDate(sprint.startDate)} - ${formatDate(sprint.endDate)}</p>
          <p class="muted">${sprint.completedTaskCount}/${sprint.taskCount} QA Passed+ | ${sprint.openBugCount}/${sprint.bugCount} open bug reports</p>
          ${sprintOverallProgressHtml(sprint)}
          ${isCollapsed ? "" : sprintStatusMetricsHtml(sprint)}
          <div class="row" style="margin-top:10px">${avatarsHtml(sprint.developers)}</div>
          <div class="toolbar reveal-actions" style="margin-top:12px">
            ${iconButton("delete-sprint", sprint.id, "Delete", "delete", canEditOwner(sprint.createdByUserId), "danger")}
            ${iconButton("finish-sprint", sprint.id, "Finish", "finish", canEditOwner(sprint.createdByUserId) && !sprint.isFinished)}
            ${iconButton("edit-sprint", sprint.id, "Edit", "edit", canEditOwner(sprint.createdByUserId))}
          </div>
        </article>
      `;
      }).join("") || `<div class="empty">No Sprints for this project.</div>`}
    </div>
  `;
}

function renderUsers() {
  settingsCategory = "Users";
  renderSettings();
}

function settingsUsersHtml() {
  return `
    <div class="grid">
      ${state.users.map(user => `
        <article class="card">
          <div class="row">
            <img class="avatar" src="${escapeAttr(user.avatarUrl || "/assets/avatar-default.svg")}" alt="">
            <div>
              <h3>${escapeHtml(user.nickname)}</h3>
              <p class="muted">${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)} ${escapeHtml(user.role || (user.isAdmin ? "Admin" : "Developer"))}</p>
            </div>
          </div>
          <p>${escapeHtml(user.bio || "")}</p>
          <p class="muted">${escapeHtml(user.email || "")}</p>
          <div class="toolbar reveal-actions">
            ${iconButton("delete-user", user.id, "Delete", "delete", currentUser().isAdmin && user.id !== currentUserId, "danger")}
            ${iconButton("edit-user", user.id, "Edit", "edit", canEditUser(user.id))}
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderDevLogs() {
  const logs = [...state.devLogs].sort((a, b) => new Date(b.logDate) - new Date(a.logDate) || new Date(b.updatedAt) - new Date(a.updatedAt));
  app.innerHTML = `
    ${sectionHead("Scrum", `<button class="primary text-icon-button" type="button" data-action="new-log">${buttonContent("&#10010;", "New Scrum")}</button>`)}
    <div class="panel">
      <table class="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Project</th>
            <th>Person</th>
            <th>Scrum</th>
            <th>Flag</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
      ${logs.map(log => {
        const user = userById(log.userId);
        return `
          <tr>
            <td>${formatDate(log.logDate)}</td>
            <td>${log.projectId ? `<span class="pill">${escapeHtml(projectName(log.projectId))}</span>` : ""}</td>
            <td>
              <div class="row">
                <img class="avatar" src="${escapeAttr(user?.avatarUrl || "/assets/avatar-default.svg")}" alt="">
                <strong>${escapeHtml(user?.nickname || "User")}</strong>
              </div>
            </td>
            <td>${log.bodyHtml}</td>
            <td>${log.isPinned ? `<span class="pill">Pinned</span>` : ""}</td>
            <td class="reveal-actions action-cell">
              ${iconButton("edit-log", log.id, "Edit", "edit", canEditOwner(log.userId))}
              ${iconButton("duplicate-log", log.id, "Duplicate", "duplicate", true)}
              ${iconButton("delete-log", log.id, "Delete", "delete", canEditOwner(log.userId), "danger")}
            </td>
          </tr>
        `;
      }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderDocumentation() {
  if (documentationProjectId && !projectById(documentationProjectId)) documentationProjectId = 0;

  const filteredBlogs = state.blogs.filter(blog => !documentationProjectId || blog.projectId === documentationProjectId);

  app.innerHTML = `
    ${sectionHead("Documentation", `<button class="primary text-icon-button" type="button" data-action="new-blog">${buttonContent("&#10010;", "New Document")}</button>`)}
    <div class="panel">
      <div class="filter-row">
        ${filterSelect("Project", "documentation-project", state.projects.map(project => ({ value: project.id, text: `${project.code} - ${project.title}` })), documentationProjectId || "", "All Projects")}
      </div>
    </div>
    <div class="grid">
      ${filteredBlogs.length ? filteredBlogs.map(blog => `
        <article class="card clickable-card documentation-card" data-action="view-blog" data-id="${blog.id}">
          <div class="spread">
            <div>
              <h3>${escapeHtml(blog.title)}</h3>
              <p class="muted">${escapeHtml(userById(blog.createdByUserId)?.nickname || "User")} | ${documentationDateLine(blog)}</p>
            </div>
            <div class="row">
              ${blog.projectId ? `<span class="pill">${escapeHtml(projectCode(blog.projectId))}</span>` : ""}
            </div>
          </div>
          <div class="rich-readonly">${blog.bodyHtml}</div>
          ${blog.attachments.length ? `<p>${blog.attachments.map(file => `<a href="${escapeAttr(file.url)}">${escapeHtml(file.fileName)}</a>`).join(" ")}</p>` : ""}
          <div class="toolbar reveal-actions">
            ${iconButton("delete-blog", blog.id, "Delete", "delete", canEditOwner(blog.createdByUserId), "danger")}
            ${iconButton("edit-blog", blog.id, "Edit", "edit", canEditOwner(blog.createdByUserId))}
          </div>
        </article>
      `).join("") : `<div class="empty">No Documentation exists for the selected project.</div>`}
    </div>
  `;
}

async function handleActionClick(event) {
  if (suppressNextClick) {
    suppressNextClick = false;
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  if (event.target.closest("a")) return;

  const button = event.target.closest("[data-action]");
  if (!button) return;
  const id = Number(button.dataset.id || 0);
  const action = button.dataset.action;

  if (handleChartAction(button)) return;

  if (action === "new-project") editProject();
  if (action === "edit-project") editProject(projectById(id));
  if (action === "delete-project") await deleteItem(`/api/projects/${id}`, "Delete this project?");
  if (action === "view-project-sprints") viewProjectSprints(id);
  if (action === "new-sprint") editSprint();
  if (action === "edit-sprint") editSprint(sprintById(id));
  if (action === "view-sprint-tasks") viewSprintTasks(id);
  if (action === "finish-sprint") await finishSprint(id);
  if (action === "delete-sprint") await deleteItem(`/api/sprints/${id}`, "Delete this Sprint?");
  if (action === "new-task") editTask();
  if (action === "new-bug") editBug();
  if (action === "toggle-task-filters") toggleTaskFilters();
  if (action === "toggle-task-visual-charts") toggleTaskVisualCharts();
  if (action === "toggle-bug-filters") toggleBugFilters();
  if (action === "toggle-bug-visual-charts") toggleBugVisualCharts();
  if (action === "edit-task") editTask(taskById(id));
  if (action === "show-task-audit") showTaskAudit(id);
  if (action === "duplicate-task") await duplicateTask(id);
  if (action === "delete-task") await deleteItem(`/api/tasks/${id}`, "Delete this task?");
  if (action === "new-user") editUser();
  if (action === "edit-user") editUser(userById(id));
  if (action === "delete-user") await deleteItem(`/api/users/${id}`, "Delete this user?");
  if (action === "new-log") editDevLog();
  if (action === "edit-log") editDevLog(state.devLogs.find(log => log.id === id));
  if (action === "duplicate-log") await duplicateDevLog(id);
  if (action === "delete-log") await deleteItem(`/api/devlogs/${id}`, "Delete this log?");
  if (action === "new-blog") editBlog();
  if (action === "view-blog") viewDocumentation(state.blogs.find(blog => blog.id === id));
  if (action === "edit-blog") editBlog(state.blogs.find(blog => blog.id === id));
  if (action === "delete-blog") await deleteItem(`/api/blogs/${id}`, "Delete this document?");
  if (action === "select-lookup-type") selectLookupType(button.dataset.type || "Status");
  if (action === "new-lookup") editLookup();
  if (action === "edit-lookup") editLookup(state.lookups.find(item => item.id === id));
  if (action === "delete-lookup") await deleteItem(`/api/lookups/${id}`, "Deactivate this setting value?");
  if (action === "new-holiday") editHoliday();
  if (action === "edit-holiday") editHoliday(state.holidays.find(item => item.id === id));
  if (action === "delete-holiday") await deleteItem(`/api/holidays/${id}`, "Deactivate this holiday?");
  if (action === "development-clear-non-pmt") await runDevelopmentAction(
    "/api/development/clear-non-pmt",
    "Clear LMS, HLS, and any non-PMT Projects, Sprints, Dev Tasks, Bugs, Scrum, and Documentation? PMT will remain intact.",
    "Non-PMT development data cleared."
  );
  if (action === "development-clear-pmt") await runDevelopmentAction(
    "/api/development/clear-pmt",
    "Clear the PMT Project, Sprints, Dev Tasks, Bugs, Scrum, and Documentation?",
    "PMT development data cleared."
  );
  if (action === "development-clear-users") await runDevelopmentAction(
    "/api/development/clear-users",
    "Clear all users except Sin and remap ownership, assignees, reporters, and audit records to Sin?",
    "Users cleared and remapped to Sin."
  );
  if (action === "development-restore-seed-data") await runDevelopmentAction(
    "/api/development/restore-seed-data",
    "Restore initial seed data for PMT, LMS, and HLS? Current development data will be replaced.",
    "Initial seed data restored."
  );
  if (action === "development-clear-local-storage") await clearLocalStoragePreferences();
  if (action === "goto-task") gotoTask(id);
  if (action === "gantt-open-task") openGanttTask(id);
  if (action === "view-project-gantt") viewProjectGantt(id);
  if (action === "toggle-roadmap-dates") toggleRoadMapDates();
  if (action === "toggle-roadmap-details") toggleRoadMapDetails();
  if (action === "toggle-roadmap-sprints") toggleRoadMapSprints();
  if (action === "toggle-gantt-all-bugs") toggleGanttAllBugs();
  if (action === "toggle-gantt-render-mode") toggleGanttRenderMode();
  if (action === "toggle-gantt-days") toggleGanttDays();
  if (action === "gantt-flyby") flyByGantt();
  if (action === "reset-gantt-view") resetGanttView();
  if (action === "toggle-gantt-task-bugs") {
    event.preventDefault();
    event.stopPropagation();
    toggleGanttTaskBugs(id);
    return;
  }
  if (action === "dashboard-view-task") openTaskReadMode(id);
  if (action === "dashboard-view-sprint") viewSprintTasks(id);
  if (action === "toggle-dashboard-sprint-details") toggleDashboardSprintDetails(id);
  if (action === "toggle-dashboard-all-details") toggleDashboardAllDetails();
  if (action === "toggle-empty-board-columns") toggleEmptyBoardColumns();
  if (action === "hide-empty-board-columns") hideEmptyBoardColumns();
  if (action === "show-all-board-columns") showAllBoardColumns();
  if (action === "toggle-project-card-details") toggleProjectCardDetails(id);
  if (action === "toggle-sprint-card-details") toggleSprintCardDetails(id);
  if (action === "toggle-all-sprint-details") toggleAllSprintDetails();
}

function handleChartAction(element, dialogToClose = null) {
  const action = element.dataset.action;
  if (action === "expand-visual-chart") {
    expandVisualChartCard(element.closest(".visual-chart-card"));
    return true;
  }

  if (action === "chart-open-sprint") {
    closeTransientDialog(dialogToClose);
    viewSprintSummary(sprintById(Number(element.dataset.id || 0)));
    return true;
  }

  if (action === "chart-drill-bugs") {
    closeTransientDialog(dialogToClose);
    const bugIds = splitChartIds(element.dataset.ids);
    showBugChartDrilldown(element.dataset.chartTitle || "Bugs", bugIds);
    return true;
  }

  if (action === "chart-drill-tasks") {
    closeTransientDialog(dialogToClose);
    const taskIds = splitChartIds(element.dataset.ids);
    showTaskChartDrilldown(element.dataset.chartTitle || "Dev Tasks", taskIds);
    return true;
  }

  if (action === "view-task") {
    closeTransientDialog(dialogToClose);
    viewTask(taskById(Number(element.dataset.id || 0)));
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
              <tr>
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

    handleChartAction(actionElement, modal);
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
              <tr>
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

    handleChartAction(actionElement, modal);
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
    if (actionElement) handleChartAction(actionElement, modal);
  });
  modal.addEventListener("cancel", () => {
    hideChartTooltip();
    modal.remove();
  });
  modal.showModal();
}

function handleFilterChange(event) {
  const target = event.target;
  if (target.dataset.filter === "board-project") {
    boardProjectId = Number(target.value);
    localStorage.setItem("pmt-board-project", boardProjectId);
    renderBoard();
  }
  if (target.dataset.filter === "board-sprint") {
    boardSprintMode = target.value;
    localStorage.setItem("pmt-board-sprint", boardSprintMode);
    renderBoard();
  }
  if (target.dataset.filter === "board-sort") {
    boardSort = target.value;
    localStorage.setItem("pmt-board-sort", boardSort);
    renderBoard();
  }
  if (target.dataset.filter === "board-status") {
    boardStatuses = [...document.querySelectorAll("[data-filter='board-status']:checked")].map(item => item.value);
    boardHideEmptyColumns = false;
    localStorage.setItem("pmt-board-statuses", JSON.stringify(boardStatuses));
    renderBoard();
  }
  if (target.dataset.filter === "roadmap-project") {
    roadMapProjectFilter = target.value;
    roadMapSprintFilter = "all";
    localStorage.setItem("pmt-roadmap-project", roadMapProjectFilter);
    localStorage.setItem("pmt-roadmap-sprint", roadMapSprintFilter);
    renderRoadMap();
  }
  if (target.dataset.filter === "roadmap-sprint") {
    roadMapSprintFilter = target.value;
    localStorage.setItem("pmt-roadmap-sprint", roadMapSprintFilter);
    renderRoadMap();
  }
  if (target.dataset.filter === "roadmap-sort") {
    roadMapSort = target.value;
    localStorage.setItem("pmt-roadmap-sort", roadMapSort);
    renderRoadMap();
  }
  if (target.dataset.filter === "gantt-project") {
    ganttProjectId = Number(target.value);
    ganttSprintMode = "current";
    localStorage.setItem("pmt-gantt-project", ganttProjectId);
    localStorage.setItem("pmt-gantt-sprint", ganttSprintMode);
    ganttExpandedBugTaskIds.clear();
    renderGantt();
  }
  if (target.dataset.filter === "gantt-sprint") {
    ganttSprintMode = target.value;
    if (ganttSprintMode === "all") {
      ganttRenderMode = "all";
      localStorage.setItem("pmt-gantt-render-mode", ganttRenderMode);
    }
    localStorage.setItem("pmt-gantt-sprint", ganttSprintMode);
    ganttExpandedBugTaskIds.clear();
    renderGantt();
  }
  if (target.dataset.filter === "gantt-sort") {
    ganttSort = target.value;
    localStorage.setItem("pmt-gantt-sort", ganttSort);
    renderGantt();
  }
  if (target.dataset.filter === "sprint-project") {
    sprintProjectId = Number(target.value);
    localStorage.setItem("pmt-sprint-project", sprintProjectId);
    renderSprints();
  }
  if (target.dataset.filter === "task-project") {
    taskProjectId = Number(target.value);
    taskSprintId = "all";
    localStorage.setItem("pmt-task-project", taskProjectId);
    localStorage.setItem("pmt-task-sprint", taskSprintId);
    renderTasks();
  }
  if (target.dataset.filter === "task-sprint") {
    taskSprintId = target.value;
    localStorage.setItem("pmt-task-sprint", taskSprintId);
    renderTasks();
  }
  if (target.dataset.filter === "task-sort") {
    taskFilters.sort = target.value;
    saveTaskFilters();
    renderTasks();
  }
  if (target.dataset.filter === "task-hide-completed") {
    taskFilters.hideCompleted = target.checked;
    saveTaskFilters();
    renderTasks();
  }
  if (target.dataset.filter === "task-status") {
    taskFilters.statuses = checkedFilterValues("task-status");
    saveTaskFilters();
    renderTasks();
  }
  if (target.dataset.filter === "task-priority") {
    taskFilters.priorities = checkedFilterValues("task-priority");
    saveTaskFilters();
    renderTasks();
  }
  if (target.dataset.filter === "task-assigned") {
    taskFilters.assigneeIds = checkedFilterValues("task-assigned");
    saveTaskFilters();
    renderTasks();
  }
  if (target.dataset.filter === "documentation-project") {
    documentationProjectId = Number(target.value || 0);
    localStorage.setItem("pmt-documentation-project", documentationProjectId);
    renderDocumentation();
  }
  if (target.dataset.filter?.startsWith("bug-")) {
    const key = target.dataset.filter.replace("bug-", "");
    if (key === "project") bugFilters.projectId = target.value;
    if (key === "status") bugFilters.status = target.value;
    if (key === "priority") bugFilters.priority = target.value;
    if (key === "severity") bugFilters.severity = target.value;
    if (key === "environment") bugFilters.environment = target.value;
    if (key === "reporter") bugFilters.reporterIds = checkedFilterValues("bug-reporter");
    if (key === "assignee") bugFilters.assigneeIds = checkedFilterValues("bug-assignee");

    localStorage.setItem("pmt-bug-filters", JSON.stringify(bugFilters));
    renderBugs();
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
  if (event.target.closest("button, a, input, select, textarea")) return;

  const item = event.target.closest('[data-task-id][data-can-drag="true"]');
  if (!item) return;

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
    draggedTaskId = pointerDrag.taskId;
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
  const statusColumn = drop.container.closest("[data-status]");
  const newStatus = statusColumn?.dataset.status || "";
  const statusChanged = newStatus && task.status !== newStatus;

  try {
    if (statusChanged) {
      const moved = await updateTaskStatus(task, newStatus, false);
      if (!moved) return;
    }

    if (taskIds.length > 1) {
      await saveJson("/api/tasks/reorder", "POST", { taskIds });
    }

    if (drop.container.dataset.reorderList === "tasks") {
      taskFilters.sort = "custom";
      saveTaskFilters();
    }

    if (drop.container.dataset.reorderList === "board-column") {
      boardSort = "custom";
      localStorage.setItem("pmt-board-sort", boardSort);
    }

    await loadState();
    render();
    showToast(statusChanged ? `Moved to ${newStatus}.` : "Order saved.");
  } catch (error) {
    showToast(error.message);
  } finally {
    cancelPointerDrag();
  }
}

function pointerDropTarget(clientX, clientY, taskId) {
  const elements = document.elementsFromPoint(clientX, clientY);
  const container = elements
    .map(item => item.closest?.("[data-reorder-list], [data-status]"))
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
  draggedTaskId = 0;
  document.querySelectorAll(".dragging")
    .forEach(item => item.classList.remove("dragging"));
  clearDropIndicators();
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

function editSprint(sprint = {}) {
  const projectId = sprint.projectId || sprintProjectId || boardProjectId || state.projects[0]?.id;

  openEditor(sprint.id ? "Edit Sprint" : "New Sprint", `
    <div class="form-grid">
      ${selectField("Project", "projectId", state.projects, projectId)}
      ${field("Title", "title", sprint.title || "", "text")}
      ${field("Start", "startDate", toDateInput(sprint.startDate), "date")}
      ${field("End", "endDate", toDateInput(sprint.endDate), "date")}
      <div class="field full"><label>Description</label><textarea name="description">${escapeHtml(sprint.description || "")}</textarea></div>
      ${richTextField("lessonLearnedHtml", "Lessons Learned", sprint.lessonLearnedHtml || "")}
      <div data-member-list="developerIds"></div>
    </div>
  `, async root => {
    await saveJson(sprint.id ? `/api/sprints/${sprint.id}` : "/api/sprints", sprint.id ? "PUT" : "POST", {
      id: sprint.id || 0,
      projectId: numberValue(root, "projectId"),
      title: value(root, "title"),
      description: value(root, "description"),
      startDate: value(root, "startDate"),
      endDate: value(root, "endDate"),
      lessonLearnedHtml: richValue(root, "lessonLearnedHtml"),
      developerIds: checkedNumbers(root, "developerIds")
    });
  }, "", root => bindSprintMemberList(root, sprint.developerIds || []));
}

function editTask(task = {}) {
  if (task.taskType === "Bug") {
    editBug(task);
    return;
  }

  const projectId = task.projectId || (currentView === "Tasks" ? taskProjectId : boardProjectId) || state.projects[0]?.id;
  const defaultSprintId = task.sprintId ?? (
    currentView === "Board"
      ? selectedBoardSprintId(projectId)
      : currentView === "Tasks" && taskSprintId !== "all"
        ? Number(taskSprintId)
        : ""
  );
  const sameProjectTasks = state.tasks.filter(item => item.projectId === projectId && item.id !== task.id);
  const taskHasSubTasks = Boolean(task.subTasks?.length);

  openEditor(workItemEditorTitle(task, "Dev Task", "New Dev Task"), `
    <div class="form-grid">
      ${task.id ? taskAuditPanelHtml(task) : ""}
      ${selectField("Project", "projectId", state.projects, projectId)}
      ${field("Title", "title", task.title || "", "text")}
      ${selectOptionsField("Sprint", "sprintId", [{ id: "", title: "No Sprint" }, ...state.sprints.filter(sprint => sprint.projectId === projectId).map(sprint => ({ id: sprint.id, title: sprint.code }))], defaultSprintId || "")}
      ${selectOptionsField("Parent Task", "parentTaskId", [{ id: "", title: "No parent" }, ...sameProjectTasks.map(item => ({ id: item.id, title: `${item.code} - ${item.title}` }))], task.parentTaskId || "")}
      ${selectTextField("Status", "status", lookupOptionsWithCurrent("Status", task.status || "Todo"), task.status || "Todo")}
      ${selectTextField("Priority", "priority", lookupOptionsWithCurrent("Priority", task.priority || "Low"), task.priority || "Low")}
      ${taskPercentField(task, taskHasSubTasks)}
      ${field("Start", "startDate", toDateInput(task.startDate), "date")}
      ${field("End", "endDate", toDateInput(task.endDate), "date")}
      ${field("URL", "url", task.url || "", "url")}
      ${richTextField("descriptionHtml", "Description", task.descriptionHtml || "")}
      <div class="field full">
        <label>Attachments</label>
        <input name="attachments" type="file" multiple>
        <div class="attachment-preview" data-preview="attachments"></div>
      </div>
      <div data-assignee-list></div>
      ${checkList("Dependencies", "dependencyTaskIds", sameProjectTasks, task.dependencyTaskIds || [], item => `${item.code} ${item.title}`, { className: "scroll-check-list dependency-check-list" })}
    </div>
  `, async root => {
    const status = value(root, "status");
    const percentCompleted = percentForDevTaskSave(status, numberValue(root, "percentCompleted"));
    const dependencyTaskIds = checkedNumbers(root, "dependencyTaskIds");
    validateLinkedBugCompletion(task, percentCompleted, dependencyTaskIds);

    const result = await saveJson(task.id ? `/api/tasks/${task.id}` : "/api/tasks", task.id ? "PUT" : "POST", {
      id: task.id || 0,
      projectId: numberValue(root, "projectId"),
      sprintId: optionalNumberValue(root, "sprintId"),
      parentTaskId: optionalNumberValue(root, "parentTaskId"),
      taskType: "Dev",
      title: value(root, "title"),
      descriptionHtml: richValue(root, "descriptionHtml"),
      stepsToReproduceHtml: "",
      actualResultHtml: "",
      expectedResultHtml: "",
      environment: "",
      severity: "",
      status,
      priority: value(root, "priority"),
      percentCompleted,
      url: value(root, "url"),
      startDate: nullableDateValue(root, "startDate"),
      endDate: nullableDateValue(root, "endDate"),
      reporterIds: [],
      assigneeIds: checkedNumbers(root, "assigneeIds"),
      dependencyTaskIds
    });

    for (const file of root.querySelector("[name='attachments']").files) {
      await attachFile(`/api/tasks/${result.id}/attachments`, file);
    }
  }, "title", root => bindAssigneeList(root, task.assigneeIds || []));
}

function editBug(bug = {}) {
  const projectId = bug.projectId || taskProjectId || boardProjectId || state.projects[0]?.id;
  const defaultSprintId = bug.sprintId ?? (currentView === "Backlog" ? "" : (taskSprintId !== "all" ? Number(taskSprintId) : selectedBoardSprintId(projectId) || ""));
  const sameProjectTasks = state.tasks.filter(item => item.projectId === projectId && item.id !== bug.id);

  openEditor(workItemEditorTitle(bug, "Bug", "New Bug Report"), `
    <div class="form-grid">
      ${bug.id ? taskAuditPanelHtml(bug) : ""}
      ${selectField("Project", "projectId", state.projects, projectId)}
      ${field("Title", "title", bug.title || "", "text")}
      ${selectOptionsField("Sprint", "sprintId", [{ id: "", title: "No Sprint" }, ...state.sprints.filter(sprint => sprint.projectId === projectId).map(sprint => ({ id: sprint.id, title: sprint.code }))], defaultSprintId || "")}
      ${selectTextField("Status", "status", lookupOptionsWithCurrent("Status", bug.status || "Todo"), bug.status || "Todo")}
      ${selectTextField("Environment", "environment", lookupOptionsWithCurrent("Environment", bug.environment || "SIT"), bug.environment || "SIT")}
      ${selectTextField("Severity", "severity", lookupOptionsWithCurrent("Severity", bug.severity || "Major"), bug.severity || "Major")}
      ${selectTextField("Priority", "priority", lookupOptionsWithCurrent("Priority", bug.priority || "High"), bug.priority || "High")}
      ${taskPercentField(bug, false)}
      ${field("Start", "startDate", toDateInput(bug.startDate), "date")}
      ${field("End", "endDate", toDateInput(bug.endDate), "date")}
      ${field("URL", "url", bug.url || "", "url")}
      ${richTextField("descriptionHtml", "Description", bug.descriptionHtml || "")}
      ${richTextField("stepsToReproduceHtml", "Steps to Reproduce", bug.stepsToReproduceHtml || "")}
      ${richTextField("actualResultHtml", "Actual Result", bug.actualResultHtml || "")}
      ${richTextField("expectedResultHtml", "Expected Result", bug.expectedResultHtml || "")}
      <div class="field full">
        <label>Attachments</label>
        <input name="attachments" type="file" multiple>
        <div class="attachment-preview" data-preview="attachments"></div>
      </div>
      ${checkList("Reporters", "reporterIds", state.users, bug.reporterIds?.length ? bug.reporterIds : [currentUserId], item => item.nickname, { className: "scroll-check-list avatar-check-list", renderItem: userCheckListLabelHtml })}
      <div data-assignee-list></div>
      ${checkList("Dependencies", "dependencyTaskIds", sameProjectTasks, bug.dependencyTaskIds || [], item => `${item.code} ${item.title}`, { className: "scroll-check-list dependency-check-list" })}
    </div>
  `, async root => {
    const result = await saveJson(bug.id ? `/api/tasks/${bug.id}` : "/api/tasks", bug.id ? "PUT" : "POST", {
      id: bug.id || 0,
      projectId: numberValue(root, "projectId"),
      sprintId: optionalNumberValue(root, "sprintId"),
      parentTaskId: null,
      taskType: "Bug",
      title: value(root, "title"),
      descriptionHtml: richValue(root, "descriptionHtml"),
      stepsToReproduceHtml: richValue(root, "stepsToReproduceHtml"),
      actualResultHtml: richValue(root, "actualResultHtml"),
      expectedResultHtml: richValue(root, "expectedResultHtml"),
      environment: value(root, "environment"),
      severity: value(root, "severity"),
      status: value(root, "status"),
      priority: value(root, "priority"),
      percentCompleted: percentForStatus(value(root, "status"), numberValue(root, "percentCompleted")),
      url: value(root, "url"),
      startDate: nullableDateValue(root, "startDate"),
      endDate: nullableDateValue(root, "endDate"),
      reporterIds: checkedNumbers(root, "reporterIds"),
      assigneeIds: checkedNumbers(root, "assigneeIds"),
      dependencyTaskIds: checkedNumbers(root, "dependencyTaskIds")
    });

    for (const file of root.querySelector("[name='attachments']").files) {
      await attachFile(`/api/tasks/${result.id}/attachments`, file);
    }
  }, "title", root => bindAssigneeList(root, bug.assigneeIds || []));
}

function viewTask(task) {
  if (!task) return;
  const dependencyLinks = (task.dependencyTaskIds || [])
    .map(id => taskById(id))
    .filter(Boolean)
    .map(item => `<button type="button" data-action="view-task-inline" data-id="${item.id}">${escapeHtml(item.code)}</button>`)
    .join(" ");

  showReadOnlyDialog(`${task.taskType === "Bug" ? "Bug Report" : "Dev Task"} ${task.code}`, `
    <div class="detail-grid">
      ${detailField("Title", escapeHtml(task.title))}
      ${detailField("Type", escapeHtml(task.taskType || "Dev"))}
      ${detailField("Project", escapeHtml(projectName(task.projectId)))}
      ${detailField("Sprint", escapeHtml(sprintName(task.sprintId)))}
      ${detailField("Status", escapeHtml(task.status))}
      ${detailField("Priority", escapeHtml(task.priority))}
      ${task.taskType === "Bug" ? detailField("Environment", escapeHtml(task.environment || "")) : ""}
      ${task.taskType === "Bug" ? detailField("Severity", escapeHtml(task.severity || "")) : ""}
      ${task.taskType === "Bug" ? detailField("Reporter", avatarsHtml(task.reporters)) : ""}
      ${detailField("Assignee", avatarsHtml(task.assignees))}
      ${detailField("Percent", `${taskDisplayPercent(task)}%`)}
      ${task.url ? detailField("URL", `<a href="${escapeAttr(normalizeUrl(task.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(task.url)}</a>`) : ""}
      ${dependencyLinks ? detailField("Dependencies", dependencyLinks) : ""}
      ${detailField("Description", `<div class="rich-readonly">${task.descriptionHtml || ""}</div>`, true)}
      ${task.taskType === "Bug" ? detailField("Steps to Reproduce", `<div class="rich-readonly">${task.stepsToReproduceHtml || ""}</div>`, true) : ""}
      ${task.taskType === "Bug" ? detailField("Actual Result", `<div class="rich-readonly">${task.actualResultHtml || ""}</div>`, true) : ""}
      ${task.taskType === "Bug" ? detailField("Expected Result", `<div class="rich-readonly">${task.expectedResultHtml || ""}</div>`, true) : ""}
      ${task.attachments.length ? detailField("Attachments", attachmentsHtml(task.attachments), true) : ""}
    </div>
  `, task);
}

function viewSprintSummary(sprint) {
  if (!sprint) return;

  const tasks = state.tasks.filter(task => task.sprintId === sprint.id && task.taskType !== "Bug" && !task.parentTaskId);
  const bugs = state.tasks.filter(task => task.sprintId === sprint.id && task.taskType === "Bug");
  const resolvedBugs = bugs.filter(isBugResolved);
  const openBugs = bugs.filter(bug => !isBugResolved(bug));
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

function showTaskAudit(taskId) {
  const task = taskById(taskId);
  if (!task) return;

  const audits = (state.auditEvents || [])
    .filter(audit => audit.entityType === "Task" && audit.entityId === taskId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt) || b.id - a.id);

  const modal = document.createElement("dialog");
  modal.className = "dialog detail-dialog audit-dialog";
  modal.innerHTML = `
    <div class="dialog-head">
      <h2>Audit Log - ${escapeHtml(task.code)}</h2>
      <button type="button" class="icon-btn" data-close title="Close">x</button>
    </div>
    <div class="dialog-body">
      ${audits.length ? `
        <table class="table audit-table">
          <thead>
            <tr>
              <th>When</th>
              <th>User</th>
              <th>Action</th>
              <th>Status</th>
              <th>Percent</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            ${audits.map(audit => `
              <tr>
                <td>${escapeHtml(formatDateTime(audit.createdAt))}</td>
                <td>${escapeHtml(userById(audit.userId)?.nickname || "User")}</td>
                <td>${escapeHtml(audit.action)}</td>
                <td>${auditChangeHtml(audit.oldStatus, audit.newStatus)}</td>
                <td>${auditPercentHtml(audit.oldPercentCompleted, audit.newPercentCompleted)}</td>
                <td>${escapeHtml(audit.details || "")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : `<div class="empty">No audit entries have been recorded for this item yet.</div>`}
    </div>
    <div class="dialog-actions">
      <button type="button" class="primary text-icon-button" data-close>${buttonContent("&#10003;", "Close")}</button>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => {
    modal.close();
    modal.remove();
  }));
  modal.addEventListener("cancel", () => modal.remove());
  modal.showModal();
}

function auditChangeHtml(oldValue, newValue) {
  if (!oldValue && !newValue) return `<span class="muted">No change</span>`;
  return `<span class="audit-change">${escapeHtml(oldValue || "None")} <b>&rarr;</b> ${escapeHtml(newValue || "None")}</span>`;
}

function auditPercentHtml(oldValue, newValue) {
  if (oldValue == null && newValue == null) return `<span class="muted">No change</span>`;
  const oldText = oldValue == null ? "None" : `${oldValue}%`;
  const newText = newValue == null ? "None" : `${newValue}%`;
  return `<span class="audit-change">${escapeHtml(oldText)} <b>&rarr;</b> ${escapeHtml(newText)}</span>`;
}

function viewDocumentation(blog) {
  if (!blog) return;
  const author = userById(blog.createdByUserId);

  const modal = document.createElement("dialog");
  modal.className = "dialog detail-dialog";
  modal.innerHTML = `
    <div class="dialog-head">
      <h2>${escapeHtml(blog.title)}</h2>
      <button type="button" class="icon-btn" data-close title="Close">x</button>
    </div>
    <div class="dialog-body">
      <div class="detail-grid">
        ${detailField("Project", escapeHtml(projectCode(blog.projectId)))}
        ${detailField("Created", escapeHtml(formatDate(blog.createdAt)))}
        ${documentationWasEdited(blog) ? detailField("Last Edited", escapeHtml(formatDate(blog.updatedAt))) : ""}
        ${detailField("Author", escapeHtml(author?.nickname || "User"))}
        ${detailField("Body", `<div class="rich-readonly">${blog.bodyHtml || ""}</div>`, true)}
        ${blog.attachments.length ? detailField("Attachments", attachmentsHtml(blog.attachments), true) : ""}
      </div>
    </div>
    <div class="dialog-actions">
      <button type="button" class="secondary text-icon-button" data-edit-readonly-blog="${blog.id}" ${canEditOwner(blog.createdByUserId) ? "" : "disabled"}>${buttonContent("&#9998;", "Edit")}</button>
      <button type="button" class="primary text-icon-button" data-close>${buttonContent("&#10003;", "Close")}</button>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => {
    modal.close();
    modal.remove();
  }));
  modal.addEventListener("click", event => {
    const editButton = event.target.closest("[data-edit-readonly-blog]");
    if (!editButton) return;

    const selectedBlog = state.blogs.find(item => item.id === Number(editButton.dataset.editReadonlyBlog));
    modal.close();
    modal.remove();
    editBlog(selectedBlog);
  });
  modal.addEventListener("cancel", () => modal.remove());
  modal.showModal();
  normalizeLinksInElement(modal);
}

function showReadOnlyDialog(title, html, task = null) {
  const modal = document.createElement("dialog");
  modal.className = "dialog detail-dialog";
  modal.innerHTML = `
    <div class="dialog-head">
      <h2>${escapeHtml(title)}</h2>
      <button type="button" class="icon-btn" data-close title="Close">x</button>
    </div>
    <div class="dialog-body">${html}</div>
    <div class="dialog-actions">
      ${task ? `<button type="button" class="secondary text-icon-button" data-action="show-task-audit" data-id="${task.id}">${buttonContent("&#128221;", "Audit")}</button>` : ""}
      ${task ? `<button type="button" class="secondary text-icon-button" data-edit-readonly-task="${task.id}" ${canEditTask(task) ? "" : "disabled"}>${buttonContent("&#9998;", "Edit")}</button>` : ""}
      <button type="button" class="primary text-icon-button" data-close>${buttonContent("&#10003;", "Close")}</button>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => {
    modal.close();
    modal.remove();
  }));
  modal.addEventListener("click", event => {
    const auditButton = event.target.closest("[data-action='show-task-audit']");
    if (auditButton) {
      showTaskAudit(Number(auditButton.dataset.id));
      return;
    }

    const editButton = event.target.closest("[data-edit-readonly-task]");
    if (editButton) {
      const selectedTask = taskById(Number(editButton.dataset.editReadonlyTask));
      modal.close();
      modal.remove();
      if (selectedTask?.taskType === "Bug") {
        editBug(selectedTask);
      } else {
        editTask(selectedTask);
      }
      return;
    }

    const inlineButton = event.target.closest("[data-action='view-task-inline']");
    if (!inlineButton) return;
    modal.close();
    modal.remove();
    viewTask(taskById(Number(inlineButton.dataset.id)));
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

function editUser(user = {}) {
  openEditor(user.id ? "Edit User" : "New User", `
    <div class="form-grid">
      ${field("First Name", "firstName", user.firstName || "", "text")}
      ${field("Last Name", "lastName", user.lastName || "", "text")}
      ${field("Nickname", "nickname", user.nickname || "", "text")}
      ${field("Email", "email", user.email || "", "email")}
      ${field("Phone", "phone", user.phone || "", "text")}
      ${field("Avatar URL", "avatarUrl", user.avatarUrl || "", "text")}
      <div class="field full"><label>Upload Avatar</label><input name="avatarFile" type="file" accept="image/*"></div>
      ${field("Home Page", "homePageUrl", user.homePageUrl || "", "url")}
      ${field("Social Media", "socialMediaUrl", user.socialMediaUrl || "", "url")}
      ${selectTextField("Role", "role", ["Developer", "QA"], user.role === "Admin" ? "Developer" : user.role || "Developer")}
      <div class="field full"><label>Bio</label><textarea name="bio">${escapeHtml(user.bio || "")}</textarea></div>
      <label class="inline-check field full"><input name="isAdmin" type="checkbox" ${user.isAdmin ? "checked" : ""} ${currentUser().isAdmin ? "" : "disabled"}><span>Admin</span></label>
    </div>
  `, async root => {
    const avatarFile = root.querySelector("[name='avatarFile']").files[0];
    let avatarUrl = value(root, "avatarUrl");
    if (avatarFile) avatarUrl = (await uploadFile("avatars", avatarFile)).url;

    await saveJson(user.id ? `/api/users/${user.id}` : "/api/users", user.id ? "PUT" : "POST", {
      id: user.id || 0,
      firstName: value(root, "firstName"),
      lastName: value(root, "lastName"),
      nickname: value(root, "nickname"),
      email: value(root, "email"),
      phone: value(root, "phone"),
      avatarUrl,
      homePageUrl: value(root, "homePageUrl"),
      socialMediaUrl: value(root, "socialMediaUrl"),
      bio: value(root, "bio"),
      isAdmin: root.querySelector("[name='isAdmin']").checked,
      role: value(root, "role")
    });
  });
}

function editDevLog(log = {}) {
  const scrumPlaceholder = "What did you accomplish yesterday?\nWhat do you plan to do today?\nDo you have any roadblocks?";
  const firstScrumPrompt = "What did you accomplish yesterday?";
  const scrumHtml = log.bodyHtml || scrumPlaceholder.replaceAll("\n", "<br>");

  openEditor(log.id ? "Edit Scrum" : "New Scrum", `
    <div class="form-grid">
      ${field("Date", "logDate", toDateInput(log.logDate || new Date()), "date")}
      ${selectOptionsField("Project", "projectId", [{ id: "", title: "No project" }, ...state.projects.map(project => ({ id: project.id, title: `${project.code} - ${project.title}` }))], log.projectId || "")}
      ${richTextField("bodyHtml", "Scrum", scrumHtml)}
      <label class="inline-check field full"><input name="isPinned" type="checkbox" ${log.isPinned ? "checked" : ""} ${currentUser().isAdmin ? "" : "disabled"}><span>Pinned</span></label>
    </div>
  `, async root => {
    await saveJson(log.id ? `/api/devlogs/${log.id}` : "/api/devlogs", log.id ? "PUT" : "POST", {
      id: log.id || 0,
      projectId: optionalNumberValue(root, "projectId"),
      logDate: value(root, "logDate"),
      bodyHtml: richValue(root, "bodyHtml"),
      isPinned: root.querySelector("[name='isPinned']").checked
    });
  }, log.id ? "" : "bodyHtml", root => {
    if (!log.id) focusRichEditorAfterText(root, "bodyHtml", firstScrumPrompt);
  });
}

function editBlog(blog = {}) {
  openEditor(blog.id ? "Edit Document" : "New Document", `
    <div class="form-grid">
      ${selectOptionsField("Project", "projectId", [{ id: "", title: "No project" }, ...state.projects.map(project => ({ id: project.id, title: `${project.code} - ${project.title}` }))], blog.projectId || "")}
      ${field("Title", "title", blog.title || "", "text")}
      ${richTextField("bodyHtml", "Body", blog.bodyHtml || "")}
      <div class="field full">
        <label>Attachments</label>
        <input name="attachments" type="file" multiple>
        <div class="attachment-preview" data-preview="attachments"></div>
      </div>
    </div>
  `, async root => {
    const result = await saveJson(blog.id ? `/api/blogs/${blog.id}` : "/api/blogs", blog.id ? "PUT" : "POST", {
      id: blog.id || 0,
      projectId: optionalNumberValue(root, "projectId"),
      title: value(root, "title"),
      bodyHtml: richValue(root, "bodyHtml")
    });

    for (const file of root.querySelector("[name='attachments']").files) {
      await attachFile(`/api/blogs/${result.id}/attachments`, file);
    }
  });
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

function editLookup(lookup = {}) {
  openEditor(lookup.id ? "Edit Setting" : "New Setting", `
    <div class="form-grid">
      ${selectTextField("Type", "lookupType", ["Status", "Priority", "Severity", "Environment"], lookup.lookupType || "Status")}
      ${field("Value", "value", lookup.value || "", "text")}
      ${colorField("Color", "colorHex", lookup.colorHex || defaultStatusColor(lookup.value || "Todo"))}
      ${field("Display Order", "displayOrder", lookup.displayOrder ?? 0, "number")}
      <label class="inline-check field full"><input name="isActive" type="checkbox" ${lookup.isActive ?? true ? "checked" : ""}><span>Active</span></label>
    </div>
  `, async root => {
    const lookupType = value(root, "lookupType");
    await saveJson(lookup.id ? `/api/lookups/${lookup.id}` : "/api/lookups", lookup.id ? "PUT" : "POST", {
      id: lookup.id || 0,
      lookupType,
      value: value(root, "value"),
      displayOrder: numberValue(root, "displayOrder"),
      isActive: root.querySelector("[name='isActive']").checked,
      colorHex: lookupType === "Status" ? value(root, "colorHex") : ""
    });
  }, "value");
}

function editHoliday(holiday = {}) {
  openEditor(holiday.id ? "Edit Holiday" : "New Holiday", `
    <div class="form-grid">
      ${field("Date", "holidayDate", toDateInput(holiday.holidayDate || new Date()), "date")}
      ${field("Name", "name", holiday.name || "", "text")}
      ${field("Country Code", "countryCode", holiday.countryCode || "PH", "text")}
      <label class="inline-check field full"><input name="isActive" type="checkbox" ${holiday.isActive ?? true ? "checked" : ""}><span>Active</span></label>
    </div>
  `, async root => {
    await saveJson(holiday.id ? `/api/holidays/${holiday.id}` : "/api/holidays", holiday.id ? "PUT" : "POST", {
      id: holiday.id || 0,
      holidayDate: value(root, "holidayDate"),
      name: value(root, "name"),
      countryCode: value(root, "countryCode") || "PH",
      isActive: root.querySelector("[name='isActive']").checked
    });
  }, "holidayDate");
}

function workItemEditorTitle(item, itemType, newTitle) {
  if (!item?.id) return newTitle;
  const code = item.code ? ` ${item.code}` : "";
  const title = item.title ? `: ${item.title}` : "";
  return `${itemType}${code}${title}`;
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

function bindAttachmentPreview(root) {
  root.querySelectorAll("input[type='file']").forEach(input => {
    input.addEventListener("change", () => {
      const preview = input.closest(".field")?.querySelector("[data-preview]");
      if (!preview) return;
      preview.innerHTML = [...input.files].map(filePreviewHtml).join("");
    });
  });
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

async function runDevelopmentAction(path, message, successMessage) {
  if (!await askYesNo(message, "Development")) return;

  try {
    await api(path, { method: "POST" });
    await loadState();
    settingsCategory = "Development";
    localStorage.setItem("pmt-settings-category", settingsCategory);
    renderSettings();
    showToast(successMessage);
  } catch (error) {
    showToast(error.message);
  }
}

async function clearLocalStoragePreferences() {
  const confirmed = await askYesNo(
    "Clear all PMT browser preferences stored in local storage? The app will reload and show first-launch defaults.",
    "Development"
  );
  if (!confirmed) return;

  // Remove only PMT keys so unrelated localStorage values for other sites are left alone.
  const pmtKeys = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && key.startsWith("pmt-")) pmtKeys.push(key);
  }

  pmtKeys.forEach(key => localStorage.removeItem(key));
  window.location.reload();
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

async function updateTaskStatus(task, status, renderAfter = true) {
  try {
    await saveJson(`/api/tasks/${task.id}`, "PUT", {
      id: task.id,
      projectId: task.projectId,
      sprintId: task.sprintId,
      parentTaskId: task.parentTaskId,
      taskType: task.taskType || "Dev",
      title: task.title,
      descriptionHtml: task.descriptionHtml,
      stepsToReproduceHtml: task.stepsToReproduceHtml || "",
      actualResultHtml: task.actualResultHtml || "",
      expectedResultHtml: task.expectedResultHtml || "",
      environment: task.environment || "",
      severity: task.severity || "",
      status,
      priority: task.priority,
      percentCompleted: percentForStatus(status, task.percentCompleted),
      startDate: task.startDate,
      endDate: task.endDate,
      url: task.url,
      reporterIds: task.reporterIds || [],
      assigneeIds: task.assigneeIds,
      dependencyTaskIds: task.dependencyTaskIds
    });

    if (renderAfter) {
      await loadState();
      render();
      showToast(`Moved to ${status}.`);
    }

    return true;
  } catch (error) {
    showToast(error.message);
    return false;
  }
}

function gotoTask(id) {
  const task = taskById(id);
  if (!task) return;
  taskProjectId = task.projectId;
  taskSprintId = String(task.sprintId || "all");
  currentView = "Tasks";
  localStorage.setItem("pmt-view", currentView);
  localStorage.setItem("pmt-task-project", taskProjectId);
  localStorage.setItem("pmt-task-sprint", taskSprintId);
  render();
}

function openGanttTask(id) {
  openTaskReadMode(id);
}

function openTaskReadMode(id) {
  const task = taskById(id);
  if (!task) return;

  gotoTask(id);
  viewTask(task);
}

function viewProjectSprints(projectId) {
  sprintProjectId = projectId;
  currentView = "Sprints";
  localStorage.setItem("pmt-view", currentView);
  localStorage.setItem("pmt-sprint-project", sprintProjectId);
  render();
}

function viewDashboardSprint(sprintId) {
  const sprint = sprintById(sprintId);
  if (!sprint) return;

  sprintProjectId = sprint.projectId;
  currentView = "Sprints";
  localStorage.setItem("pmt-view", currentView);
  localStorage.setItem("pmt-sprint-project", sprintProjectId);
  render();
}

function viewSprintTasks(sprintId) {
  const sprint = sprintById(sprintId);
  if (!sprint) return;

  taskProjectId = sprint.projectId;
  taskSprintId = String(sprint.id);
  currentView = "Tasks";
  localStorage.setItem("pmt-view", currentView);
  localStorage.setItem("pmt-task-project", taskProjectId);
  localStorage.setItem("pmt-task-sprint", taskSprintId);
  render();
}

function viewProjectGantt(projectId) {
  ganttProjectId = projectId;
  ganttSprintMode = "current";
  currentView = "Gantt";
  localStorage.setItem("pmt-view", currentView);
  localStorage.setItem("pmt-gantt-project", ganttProjectId);
  localStorage.setItem("pmt-gantt-sprint", ganttSprintMode);
  render();
}

function dashboardSprintDetailsVisible(sprintId) {
  return dashboardShowAllDetails || dashboardExpandedSprintIds.has(Number(sprintId));
}

function toggleDashboardSprintDetails(sprintId) {
  const id = Number(sprintId);

  if (dashboardShowAllDetails) {
    dashboardShowAllDetails = false;
    dashboardExpandedSprintIds = new Set(state.sprints.map(sprint => sprint.id));
    dashboardExpandedSprintIds.delete(id);
  } else if (dashboardExpandedSprintIds.has(id)) {
    dashboardExpandedSprintIds.delete(id);
  } else {
    dashboardExpandedSprintIds.add(id);
  }

  renderDashboard();
}

function toggleDashboardAllDetails() {
  dashboardShowAllDetails = !dashboardShowAllDetails;
  dashboardExpandedSprintIds.clear();
  renderDashboard();
}

function toggleProjectCardDetails(projectId) {
  const id = Number(projectId);

  if (projectCollapsedIds.has(id)) {
    projectCollapsedIds.delete(id);
  } else {
    projectCollapsedIds.add(id);
  }

  render();
}

function toggleSprintCardDetails(sprintId) {
  const id = Number(sprintId);

  if (sprintCollapsedIds.has(id)) {
    sprintCollapsedIds.delete(id);
  } else {
    sprintCollapsedIds.add(id);
  }

  renderSprints();
}

function toggleAllSprintDetails() {
  const visibleSprintIds = state.sprints
    .filter(sprint => sprint.projectId === sprintProjectId)
    .map(sprint => sprint.id);
  const allVisibleCollapsed = visibleSprintIds.length > 0 && visibleSprintIds.every(id => sprintCollapsedIds.has(id));

  visibleSprintIds.forEach(id => {
    if (allVisibleCollapsed) {
      sprintCollapsedIds.delete(id);
    } else {
      sprintCollapsedIds.add(id);
    }
  });

  renderSprints();
}

function hideEmptyBoardColumns() {
  boardHideEmptyColumns = true;
  const project = state.projects.find(item => item.id === boardProjectId) || state.projects[0];
  const sprintId = selectedBoardSprintId(project?.id);
  const visibleTasks = state.tasks
    .filter(task => !project || task.projectId === project.id)
    .filter(task => sprintId === 0 || task.sprintId === sprintId);

  boardStatuses = statuses.filter(status => visibleTasks.some(task => task.status === status));
  localStorage.setItem("pmt-board-statuses", JSON.stringify(boardStatuses));
  renderBoard();
}

function showAllBoardColumns() {
  boardHideEmptyColumns = false;
  boardStatuses = [...statuses];
  localStorage.setItem("pmt-board-statuses", JSON.stringify(boardStatuses));
  renderBoard();
}

function toggleEmptyBoardColumns() {
  if (boardHideEmptyColumns) {
    showAllBoardColumns();
  } else {
    hideEmptyBoardColumns();
  }
}

function sortGanttSprints(sprints) {
  const direction = ganttSort === "startDesc" ? -1 : 1;

  return [...sprints].sort((a, b) => {
    const aStart = ganttStartDate(a)?.getTime() || 0;
    const bStart = ganttStartDate(b)?.getTime() || 0;
    return ((aStart - bStart) * direction) || a.code.localeCompare(b.code);
  });
}

function sortGanttSprintOptions(sprints) {
  // The dropdown is easier to use when recent sprints are listed first.
  return [...sprints].sort((a, b) => {
    const aStart = ganttStartDate(a)?.getTime() || 0;
    const bStart = ganttStartDate(b)?.getTime() || 0;
    return (bStart - aStart) || a.code.localeCompare(b.code);
  });
}

function selectedGanttSprint(projectSprints) {
  if (ganttSprintMode === "all") return null;
  if (ganttSprintMode === "current") return currentSprintForProject(projectSprints);
  return projectSprints.find(sprint => sprint.id === Number(ganttSprintMode)) || currentSprintForProject(projectSprints);
}

function currentSprintForProject(projectSprints) {
  const today = normalizeDate(new Date());
  const sortedSprints = [...projectSprints].sort((a, b) => ganttStartDate(a) - ganttStartDate(b));

  const activeSprint = sortedSprints.find(sprint => {
    const start = ganttStartDate(sprint);
    const end = ganttEndDate(sprint);
    return start && end && start <= today && end >= today;
  });
  if (activeSprint) return activeSprint;

  const latestPastSprint = [...sortedSprints].reverse().find(sprint => ganttEndDate(sprint) <= today);
  if (latestPastSprint) return latestPastSprint;

  return sortedSprints.find(sprint => ganttStartDate(sprint) >= today) || sortedSprints[0] || null;
}

function scrollGanttToSprintStart(chart, sprint) {
  if (!chart?.scrollDate || !chart.dates?.length) return;

  requestAnimationFrame(() => {
    const scroller = document.querySelector(".gantt-scroll");
    if (!scroller) return;

    scroller.scrollLeft = ganttScrollLeftForDate(chart, chart.scrollDate);
    if (ganttRenderMode === "all" && sprint) {
      scroller.scrollTop = ganttScrollTopForSprint(sprint);
    }
  });
}

function captureGanttScrollPosition() {
  const scroller = document.querySelector(".gantt-scroll");
  if (!scroller) return null;

  const sprintId = nearestGanttSprintIdFromScroll();
  const sprintTop = sprintId ? ganttScrollTopForSprint({ id: sprintId }) : scroller.scrollTop;
  return {
    left: scroller.scrollLeft,
    top: scroller.scrollTop,
    sprintId,
    rowOffset: scroller.scrollTop - sprintTop
  };
}

function restoreGanttScroll(position) {
  if (!position) return;

  const applyScroll = () => {
    const scroller = document.querySelector(".gantt-scroll");
    if (!scroller) return;

    scroller.scrollLeft = position.left;
    if (position.sprintId) {
      const sprintTop = ganttScrollTopForSprint({ id: position.sprintId });
      scroller.scrollTop = Math.max(0, sprintTop + (position.rowOffset || 0));
    } else {
      scroller.scrollTop = position.top;
    }
  };

  requestAnimationFrame(() => {
    applyScroll();
    requestAnimationFrame(applyScroll);
  });
}

function scrollGanttToSprint(chart, sprint) {
  const scroller = document.querySelector(".gantt-scroll");
  if (!scroller || !sprint) return;

  scroller.scrollLeft = ganttScrollLeftForDate(chart, ganttStartDate(sprint));
  scroller.scrollTop = ganttScrollTopForSprint(sprint);
}

function ganttScrollLeftForDate(chart, date) {
  const startIndex = Math.max(0, ganttVisibleDateIndex(chart.dates, date, false));
  // The sprint name column is sticky, so do not add its width to scrollLeft.
  // This places the sprint start just to the right of the fixed column.
  return Math.max(0, (startIndex * chart.dayWidth) - 16);
}

function ganttScrollTopForSprint(sprint) {
  const row = document.querySelector(`[data-gantt-sprint-id="${sprint?.id}"]`);
  const header = document.querySelector(".gantt-header");
  if (!row) return 0;

  return Math.max(0, row.offsetTop - (header?.offsetHeight || 0) - 8);
}

function flyByGantt() {
  if (ganttFlyByActive) {
    pauseGanttFlyBy();
    return;
  }

  const isResuming = Boolean(ganttFlyByResumeSprintId);
  stopGanttFlyBy({ keepResume: isResuming });
  if (!isResuming) applyGanttResetPreset();

  // Fly-by needs historical rows visible. Reset chooses the current Sprint for
  // a fresh run, while Resume keeps the last paused Sprint in memory.
  ganttRenderMode = "all";
  ganttSprintMode = "all";
  ganttFlyByActive = true;
  ganttFlyByStopRequested = false;
  saveGanttViewSettings();
  ganttPendingFlyBy = true;
  ganttExpandedBugTaskIds.clear();
  renderGantt();
}

async function startGanttFlyBy(chart, runId) {
  const scroller = document.querySelector(".gantt-scroll");
  if (!chart?.dates?.length || !chart.sprints?.length || !scroller) {
    finishGanttFlyBy("");
    return;
  }
  if (runId !== ganttFlyByRunId) return;

  const newestToOldest = [...chart.sprints].sort((a, b) => ganttStartDate(b) - ganttStartDate(a));
  const currentSprint = ganttFlyByStartingSprint(newestToOldest);
  const currentIndex = Math.max(0, newestToOldest.findIndex(sprint => sprint.id === currentSprint?.id));
  const flyBySprints = newestToOldest.slice(currentIndex);
  if (!flyBySprints.length) {
    finishGanttFlyBy("");
    return;
  }

  // Start exactly where the Sprint dropdown would jump for the current Sprint.
  ganttFlyByCurrentSprintId = flyBySprints[0].id;
  scrollGanttToSprint(chart, flyBySprints[0]);
  if (flyBySprints.length === 1) {
    finishGanttFlyBy("Sprint Fly-by complete.");
    return;
  }

  for (let index = 1; index < flyBySprints.length; index++) {
    if (runId !== ganttFlyByRunId) return;
    const sprint = flyBySprints[index];
    const fromPosition = ganttCurrentScrollPosition(scroller);
    const toPosition = ganttScrollPosition(chart, sprint);
    ganttFlyByAnimating = true;
    const completedMove = await animateGanttScroll(scroller, fromPosition, toPosition, runId);
    ganttFlyByAnimating = false;
    if (!completedMove) return;
    ganttFlyByCurrentSprintId = sprint.id;
    if (ganttFlyByStopRequested) {
      pauseGanttFlyByAtCurrent("Sprint Fly-by paused.");
      return;
    }
    if (!await waitForGanttFlyByPause(runId)) return;
  }
  if (runId === ganttFlyByRunId) {
    finishGanttFlyBy("Sprint Fly-by complete.");
  }
}

function ganttFlyByStartingSprint(sprints) {
  return sprints.find(sprint => sprint.id === ganttFlyByResumeSprintId)
    || selectedGanttSprint(sprints)
    || currentSprintForProject(sprints)
    || sprints[0]
    || null;
}

function ganttScrollPosition(chart, sprint) {
  return {
    left: ganttScrollLeftForDate(chart, ganttStartDate(sprint)),
    top: ganttScrollTopForSprint(sprint)
  };
}

function ganttCurrentScrollPosition(scroller) {
  return {
    left: scroller.scrollLeft,
    top: scroller.scrollTop
  };
}

function animateGanttScroll(scroller, fromPosition, toPosition, runId) {
  return new Promise(resolve => {
    const horizontalDistance = Math.abs(toPosition.left - fromPosition.left);
    const verticalDistance = Math.abs(toPosition.top - fromPosition.top);
    const distance = Math.max(horizontalDistance, verticalDistance);
    // Each sprint-to-sprint move is deliberately slow enough for demo viewers
    // to read the sprint label and see task bars before the next pause.
    const duration = Math.min(9000, Math.max(3200, distance * 3.5));
    const startedAt = performance.now();

    const animate = now => {
      if (runId !== ganttFlyByRunId) {
        resolve(false);
        return;
      }

      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      scroller.scrollLeft = fromPosition.left + ((toPosition.left - fromPosition.left) * eased);
      scroller.scrollTop = fromPosition.top + ((toPosition.top - fromPosition.top) * eased);

      if (progress < 1) {
        ganttFlyByFrameId = requestAnimationFrame(animate);
      } else {
        ganttFlyByFrameId = 0;
        scroller.scrollLeft = toPosition.left;
        scroller.scrollTop = toPosition.top;
        resolve(true);
      }
    };

    ganttFlyByFrameId = requestAnimationFrame(animate);
  });
}

function waitForGanttFlyByPause(runId, milliseconds = 2000) {
  return new Promise(resolve => {
    ganttFlyByTimeoutId = setTimeout(() => {
      ganttFlyByTimeoutId = 0;
      resolve(runId === ganttFlyByRunId);
    }, milliseconds);
  });
}

async function showGanttFlyByCountdown(runId) {
  for (let count = 1; count <= 3; count++) {
    if (runId !== ganttFlyByRunId || !ganttFlyByActive) return false;
    showGanttFlyByToast(`Sprint fly-by will begin in ${count}`);
    if (!await waitForGanttFlyByPause(runId, 1000)) return false;
  }
  return runId === ganttFlyByRunId && ganttFlyByActive;
}

function pauseGanttFlyBy() {
  if (ganttFlyByAnimating) {
    ganttFlyByStopRequested = true;
    updateGanttFlyByButton();
    showGanttFlyByToast("Sprint Fly-by will pause at the next Sprint.");
    return;
  }

  pauseGanttFlyByAtCurrent("Sprint Fly-by paused.");
}

function pauseGanttFlyByAtCurrent(message) {
  const resumeSprintId = ganttFlyByCurrentSprintId || ganttFlyByResumeSprintId || nearestGanttSprintIdFromScroll();
  ganttFlyByRunId += 1;
  ganttFlyByActive = false;
  ganttFlyByAnimating = false;
  ganttFlyByStopRequested = false;
  ganttFlyByResumeSprintId = resumeSprintId || 0;
  clearGanttFlyByTimers();
  updateGanttFlyByButton();
  showGanttFlyByToast(message);
}

function finishGanttFlyBy(message) {
  ganttFlyByActive = false;
  ganttFlyByAnimating = false;
  ganttFlyByStopRequested = false;
  ganttFlyByResumeSprintId = 0;
  ganttFlyByCurrentSprintId = 0;
  clearGanttFlyByTimers();
  updateGanttFlyByButton();
  if (message) showGanttFlyByToast(message);
}

function stopGanttFlyBy(options = {}) {
  ganttFlyByRunId += 1;
  ganttFlyByActive = false;
  ganttFlyByAnimating = false;
  ganttFlyByStopRequested = false;
  if (!options.keepResume) {
    ganttFlyByResumeSprintId = 0;
    ganttFlyByCurrentSprintId = 0;
  }
  clearGanttFlyByTimers();
}

function clearGanttFlyByTimers() {
  if (ganttFlyByFrameId) {
    cancelAnimationFrame(ganttFlyByFrameId);
    ganttFlyByFrameId = 0;
  }
  if (ganttFlyByTimeoutId) {
    clearTimeout(ganttFlyByTimeoutId);
    ganttFlyByTimeoutId = 0;
  }
}

function nearestGanttSprintIdFromScroll() {
  const scroller = document.querySelector(".gantt-scroll");
  if (!scroller) return 0;

  const header = document.querySelector(".gantt-header");
  const targetTop = scroller.scrollTop + (header?.offsetHeight || 0) + 8;
  const rows = [...document.querySelectorAll("[data-gantt-sprint-id]")];
  const nearestRow = rows.reduce((bestRow, row) => {
    if (!bestRow) return row;
    return Math.abs(row.offsetTop - targetTop) < Math.abs(bestRow.offsetTop - targetTop) ? row : bestRow;
  }, null);

  return Number(nearestRow?.dataset.ganttSprintId || 0);
}

function updateGanttFlyByButton() {
  const button = document.querySelector("[data-action='gantt-flyby']");
  if (!button) return;

  button.classList.toggle("is-on", ganttFlyByActive);
  button.title = ganttFlyByButtonTitle();
  button.setAttribute("aria-label", button.title);
  button.setAttribute("aria-pressed", String(ganttFlyByActive));
  button.innerHTML = ganttFlyByButtonIcon();
}

function ganttFlyByButtonTitle() {
  if (ganttFlyByStopRequested) return "Pausing after this Sprint";
  if (ganttFlyByActive) return "Pause Sprint Fly-by";
  if (ganttFlyByResumeSprintId) return "Resume Sprint Fly-by";
  return "Start Sprint Fly-by";
}

function ganttFlyByButtonIcon() {
  return ganttFlyByActive ? "&#10074;&#10074;" : "&#9654;";
}

function showGanttFlyByToast(message) {
  showToast(message, document.querySelector("[data-action='gantt-flyby']"));
}

function toggleGanttRenderMode() {
  ganttRenderMode = ganttRenderMode === "selected" ? "all" : "selected";
  if (ganttRenderMode === "all") {
    ganttSprintMode = "all";
  } else if (ganttSprintMode === "all") {
    ganttSprintMode = "current";
  }
  localStorage.setItem("pmt-gantt-sprint", ganttSprintMode);
  localStorage.setItem("pmt-gantt-render-mode", ganttRenderMode);
  ganttExpandedBugTaskIds.clear();
  renderGantt();
}

function toggleGanttDays() {
  ganttShowNonWorkingDays = !ganttShowNonWorkingDays;
  localStorage.setItem("pmt-gantt-show-non-working-days", String(ganttShowNonWorkingDays));
  renderGantt();
}

function resetGanttView() {
  stopGanttFlyBy();
  applyGanttResetPreset();
  ganttExpandedBugTaskIds.clear();
  renderGantt();
}

function applyGanttResetPreset() {
  ganttSprintMode = "current";
  ganttSort = "startDesc";
  ganttRenderMode = "selected";
  saveGanttViewSettings();
}

function saveGanttViewSettings() {
  localStorage.setItem("pmt-gantt-sprint", ganttSprintMode);
  localStorage.setItem("pmt-gantt-sort", ganttSort);
  localStorage.setItem("pmt-gantt-render-mode", ganttRenderMode);
}

function toggleGanttAllBugs() {
  ganttShowAllBugs = !ganttShowAllBugs;
  ganttExpandedBugTaskIds.clear();
  renderGantt();
}

function toggleRoadMapDates() {
  roadMapShowDates = !roadMapShowDates;
  localStorage.setItem("pmt-roadmap-show-dates", String(roadMapShowDates));
  renderRoadMap();
}

function toggleRoadMapDetails() {
  roadMapShowDetails = !roadMapShowDetails;
  localStorage.setItem("pmt-roadmap-show-details", String(roadMapShowDetails));
  renderRoadMap();
}

function toggleRoadMapSprints() {
  roadMapShowSprints = !roadMapShowSprints;
  localStorage.setItem("pmt-roadmap-show-sprints", String(roadMapShowSprints));
  renderRoadMap();
}

function selectLookupType(type) {
  settingsCategory = type || "Status";
  localStorage.setItem("pmt-settings-category", settingsCategory);
  if (settingsCategory !== "Users" && settingsCategory !== "Holidays" && settingsCategory !== "Development") {
    lookupTypeFilter = settingsCategory;
    localStorage.setItem("pmt-lookup-type", lookupTypeFilter);
  }
  renderSettings();
}

function sectionHead(title, actionsHtml) {
  return `
    <div class="section-head">
      <h1>${title}</h1>
      <div class="toolbar">${actionsHtml || ""}</div>
    </div>
  `;
}

function projectCardHtml(project) {
  const isCollapsed = projectCollapsedIds.has(project.id);
  const chartToggleTitle = isCollapsed ? "Expand Project charts" : "Collapse Project charts";

  return `
    <article class="card clickable-card project-card" data-action="view-project-sprints" data-id="${project.id}">
      <div class="spread project-card-head">
        <div class="row">
          <img class="project-icon" src="${escapeAttr(project.iconUrl || "/assets/project-pmt.svg")}" alt="">
          <div>
            <h3>${escapeHtml(project.code)} - ${escapeHtml(project.title)}</h3>
            <p class="muted">${project.completedTaskCount}/${project.taskCount} QA Passed+ | ${project.openBugCount}/${project.bugCount} open bug reports</p>
          </div>
        </div>
        <button class="icon-action" type="button" data-action="toggle-project-card-details" data-id="${project.id}" title="${chartToggleTitle}" aria-label="${chartToggleTitle}" aria-expanded="${!isCollapsed}">
          ${isCollapsed ? "&#9662;" : "&#9652;"}
        </button>
      </div>
      <p>${escapeHtml(project.description || "")}</p>
      ${projectOverallProgressHtml(project)}
      ${isCollapsed ? "" : projectStatusMetricsHtml(project)}
      <div class="row" style="margin-top:10px">${avatarsHtml(project.members)}</div>
      <div class="toolbar reveal-actions" style="margin-top:12px">
        ${iconButton("delete-project", project.id, "Delete", "delete", canEditOwner(project.createdByUserId), "danger")}
        ${iconButton("view-project-gantt", project.id, "Gantt", "gantt", true)}
        ${iconButton("edit-project", project.id, "Edit", "edit", canEditOwner(project.createdByUserId))}
      </div>
    </article>
  `;
}

function dashboardProjectHtml(project) {
  const sprints = state.sprints.filter(sprint => sprint.projectId === project.id);
  const isCollapsed = projectCollapsedIds.has(project.id);
  const chartToggleTitle = isCollapsed ? "Expand Project charts" : "Collapse Project charts";

  return `
    <div class="dashboard-project-flow">
      <div class="spread dashboard-project-heading">
        <div>
          <strong>${escapeHtml(project.code)} ${escapeHtml(project.title)}</strong>
        </div>
        <button class="icon-action" type="button" data-action="toggle-project-card-details" data-id="${project.id}" title="${chartToggleTitle}" aria-label="${chartToggleTitle}" aria-expanded="${!isCollapsed}">
          ${isCollapsed ? "&#9662;" : "&#9652;"}
        </button>
      </div>
      ${projectOverallProgressHtml(project)}
      ${isCollapsed ? "" : projectStatusMetricsHtml(project)}
      <div class="dashboard-sprint-grid">
        ${sprints.map(sprint => {
          const sprintTasks = state.tasks.filter(task => task.sprintId === sprint.id);
          const isExpanded = dashboardSprintDetailsVisible(sprint.id);

          return `
          <article class="card clickable-card dashboard-sprint-card" data-action="dashboard-view-sprint" data-id="${sprint.id}">
            <div class="spread">
              <div>
                <strong>${escapeHtml(sprint.code)}</strong>
                <p class="muted">${escapeHtml(sprint.title)}</p>
              </div>
              <span class="muted">${sprint.percentCompleted}%</span>
            </div>
            ${sprintOverallProgressHtml(sprint)}
            <div class="dashboard-card-actions">
              <button type="button" class="secondary text-icon-button" data-action="toggle-dashboard-sprint-details" data-id="${sprint.id}">
                ${buttonContent(isExpanded ? "&#8722;" : "&#43;", isExpanded ? "Less Details" : "More Details")}
              </button>
            </div>
            ${isExpanded ? `
              ${sprintStatusMetricsHtml(sprint)}
              <div class="dashboard-task-list">
                ${sprintTasks.map(task => dashboardTaskRowHtml(task, sprintTasks)).join("") || `<div class="empty compact-empty">No tasks.</div>`}
              </div>
            ` : ""}
          </article>
        `;
        }).join("") || `<div class="empty">No Sprints.</div>`}
      </div>
    </div>
  `;
}

function dashboardTaskRowHtml(task, sprintTasks) {
  const percent = dashboardTaskProgressPercent(task, sprintTasks);

  return `
    <button type="button" class="dashboard-task-row" data-action="dashboard-view-task" data-id="${task.id}">
      <span class="dashboard-task-summary">
        <span class="dashboard-task-title">${escapeHtml(task.code)} ${escapeHtml(task.title)}</span>
        <span class="pill">${percent}%</span>
      </span>
      ${thinProgressHtml(percent, statusColor(task.status))}
    </button>
  `;
}

function dashboardTaskProgressPercent(task, sprintTasks) {
  if (task.taskType === "Bug") return taskDisplayPercent(task);

  const relatedBugs = bugsForTask(task, sprintTasks.filter(item => item.taskType === "Bug"));
  const workItems = [task, ...relatedBugs];
  return averageWorkItemPercent(workItems);
}

function boardColumnHtml(status, tasks) {
  return `
    <section class="column" data-status="${escapeAttr(status)}" data-reorder-list="board-column">
      <h2>${escapeHtml(status)} <span class="pill">${tasks.length}</span></h2>
      ${tasks.map(task => `
        <article class="task-card ${task.taskType === "Bug" ? "bug-card" : ""}" data-task-id="${task.id}" data-can-drag="${canEditTask(task) ? "true" : "false"}" draggable="false">
          <div class="spread">
            <strong>${escapeHtml(task.code)}</strong>
            <span class="pill">${escapeHtml(task.taskType || "Dev")}</span>
          </div>
          <span class="pill priority-${escapeAttr(task.priority)}">${escapeHtml(task.priority)}</span>
          ${task.taskType === "Bug" ? `<span class="pill severity-${escapeAttr(task.severity)}">${escapeHtml(task.severity || "")}</span>` : ""}
          <p>${bugFixIconHtml(task)}${escapeHtml(task.title)}</p>
          <div class="mini-progress">
            ${progressHtml(task.percentCompleted)}
            ${task.subTasks.length ? progressHtml(task.subTaskAveragePercent) : ""}
          </div>
          <div class="row" style="margin-top:8px">${avatarsHtml(task.assignees)}</div>
          <div class="toolbar reveal-actions" style="margin-top:10px">${taskButtonsHtml(task)}</div>
        </article>
      `).join("") || `<div class="empty">No tasks.</div>`}
    </section>
  `;
}

function ganttChartData(project, sprints, selectedSprint = null, scrollSprint = null, showNonWorkingDays = false) {
  const projectTasks = state.tasks
    .filter(task => task.projectId === project?.id)
    .filter(task => !selectedSprint || task.sprintId === selectedSprint.id);
  const scheduledItems = [
    ...sprints.map(sprint => ({ type: "Sprint", item: sprint, start: ganttStartDate(sprint), end: ganttEndDate(sprint) })),
    ...projectTasks.map(task => ({ type: task.taskType, item: task, start: ganttStartDate(task), end: ganttEndDate(task) }))
  ].filter(row => row.start && row.end);

  if (!scheduledItems.length) return { project, sprints: [], dates: [], dayWidth: 42, scrollDate: null };

  const minDate = new Date(Math.min(...scheduledItems.map(row => row.start.getTime())));
  const maxDate = new Date(Math.max(...scheduledItems.map(row => row.end.getTime())));
  const startDates = new Set(projectTasks.map(task => dateKey(ganttStartDate(task))).filter(Boolean));
  const holidays = activeHolidayMap();
  const dates = dateRange(minDate, maxDate).filter(date => shouldShowGanttDate(date, startDates, holidays, showNonWorkingDays));

  return {
    project,
    sprints,
    dates,
    holidays,
    dayWidth: ganttDayWidth(dates, sprints, scrollSprint),
    scrollDate: scrollSprint ? ganttStartDate(scrollSprint) : null
  };
}

function ganttDayWidth(dates, sprints, focusSprint) {
  const baseWidth = dates.length > 700 ? 12 : dates.length > 365 ? 14 : dates.length > 180 ? 16 : dates.length > 120 ? 18 : dates.length > 60 ? 24 : dates.length > 35 ? 32 : 42;
  if (!isTypicalTwoWeekSprintProject(sprints)) return baseWidth;

  const sprint = focusSprint || sprints[0];
  if (!sprint) return baseWidth;
  const sprintStart = ganttStartDate(sprint);
  const sprintEnd = ganttEndDate(sprint);
  const sprintVisibleDayCount = dates.filter(date => date >= sprintStart && date <= sprintEnd).length || 10;
  const fitWidth = Math.floor(ganttAvailableTimelineWidth() / Math.max(8, sprintVisibleDayCount));

  // Two-week projects are the normal case, so give those task bars enough
  // width to read while keeping the focused Sprint inside the viewport.
  return Math.max(baseWidth, Math.min(72, fitWidth));
}

function isTypicalTwoWeekSprintProject(sprints) {
  const durations = sprints
    .map(sprint => {
      const start = ganttStartDate(sprint);
      const end = ganttEndDate(sprint);
      return start && end ? Math.round((end - start) / 86400000) + 1 : 0;
    })
    .filter(days => days > 0)
    .sort((a, b) => a - b);

  if (!durations.length) return false;
  const middle = Math.floor(durations.length / 2);
  const medianDays = durations.length % 2
    ? durations[middle]
    : Math.round((durations[middle - 1] + durations[middle]) / 2);

  return medianDays <= 24;
}

function ganttAvailableTimelineWidth() {
  const contentWidth = app?.clientWidth || window.innerWidth || 1200;
  return Math.max(620, contentWidth - 280);
}

function roadMapProjects() {
  const selectedSprintId = roadMapShowSprints && roadMapSprintFilter !== "all" ? Number(roadMapSprintFilter) : 0;

  return [...state.projects]
    .filter(project => roadMapProjectFilter === "all" || String(project.id) === String(roadMapProjectFilter))
    .filter(project => !selectedSprintId || state.sprints.some(sprint => sprint.id === selectedSprintId && sprint.projectId === project.id))
    .sort(roadMapCompareProjects);
}

function roadMapSprintOptions() {
  const selectedProjectId = roadMapProjectFilter === "all" ? 0 : Number(roadMapProjectFilter);

  return [...state.sprints]
    .filter(sprint => !selectedProjectId || sprint.projectId === selectedProjectId)
    .sort((a, b) => {
      const projectCompare = projectName(a.projectId).localeCompare(projectName(b.projectId));
      if (projectCompare) return projectCompare;
      return roadMapSprintStart(a, projectById(a.projectId)) - roadMapSprintStart(b, projectById(b.projectId)) || a.code.localeCompare(b.code);
    });
}

function roadMapProjectSprints(project) {
  if (!roadMapShowSprints) return [];

  return state.sprints
    .filter(sprint => sprint.projectId === project.id)
    .filter(sprint => roadMapSprintFilter === "all" || String(sprint.id) === String(roadMapSprintFilter))
    .sort((a, b) => roadMapSprintStart(a, project) - roadMapSprintStart(b, project) || a.code.localeCompare(b.code));
}

function roadMapCompareProjects(a, b) {
  const sortValue = roadMapSort || "endAsc";
  const direction = sortValue.endsWith("Desc") ? -1 : 1;
  const useStart = sortValue.startsWith("start");
  const aDate = useStart ? roadMapProjectStart(a) : roadMapProjectEnd(a);
  const bDate = useStart ? roadMapProjectStart(b) : roadMapProjectEnd(b);
  const dateCompare = (aDate?.getTime() || 0) - (bDate?.getTime() || 0);

  return (dateCompare * direction) || a.code.localeCompare(b.code);
}

function roadMapChartData(projects) {
  const rows = projects.map(project => {
    const allProjectSprints = state.sprints.filter(sprint => sprint.projectId === project.id);
    const projectSprints = roadMapProjectSprints(project);
    const start = roadMapProjectStart(project);
    const endSourceSprints = roadMapShowSprints && roadMapSprintFilter !== "all" ? projectSprints : allProjectSprints;
    const end = roadMapProjectEnd(project, endSourceSprints);
    const sprints = projectSprints.map(sprint => ({
      sprint,
      start: roadMapSprintStart(sprint, project),
      end: roadMapSprintEnd(sprint, project)
    }));

    return { project, start, end, sprints };
  }).filter(row => row.start && row.end);

  const scheduledItems = rows.flatMap(row => [
    { start: row.start, end: row.end },
    ...row.sprints.map(sprintRow => ({ start: sprintRow.start, end: sprintRow.end }))
  ]).filter(row => row.start && row.end);

  if (!scheduledItems.length) return { rows: [], dates: [], dayWidth: 42, holidays: new Map() };

  const minDate = new Date(Math.min(...scheduledItems.map(row => row.start.getTime())));
  const maxDate = new Date(Math.max(...scheduledItems.map(row => row.end.getTime())));
  const startDates = new Set(scheduledItems.map(row => dateKey(row.start)).filter(Boolean));
  const holidays = activeHolidayMap();
  const timeline = roadMapTimeline(minDate, maxDate, startDates, holidays);

  return {
    rows,
    dates: timeline.dates,
    holidays,
    dayWidth: timeline.dayWidth,
    granularity: timeline.granularity
  };
}

function roadMapChartHtml(chart) {
  const years = groupedHeader(chart.dates, date => date.getFullYear());
  const quarters = groupedHeader(chart.dates, date => `${date.getFullYear()} Q${Math.floor(date.getMonth() / 3) + 1}`);
  const months = groupedHeader(chart.dates, date => `${date.getFullYear()}-${date.getMonth()}`);
  const dayRow = chart.granularity === "day"
    ? `<div class="roadmap-row roadmap-days">${chart.dates.map(date => `<div class="${isHoliday(date, chart.holidays) ? "holiday-day" : ""}" title="${escapeAttr(ganttDateTitle(date, chart.holidays))}">${date.getDate()}</div>`).join("")}</div>`
    : "";

  return `
    <div class="roadmap panel roadmap-${chart.granularity}-timeline" style="--day-width:${chart.dayWidth}px; --date-count:${chart.dates.length}">
      <div class="roadmap-scroll">
        <div class="roadmap-calendar roadmap-header">
          <div class="roadmap-row roadmap-years">${years.map(group => `<div style="grid-column:span ${group.count}">${escapeHtml(group.label)}</div>`).join("")}</div>
          <div class="roadmap-row roadmap-quarters">${quarters.map(group => `<div style="grid-column:span ${group.count}">${escapeHtml(group.label.split(" ")[1])}</div>`).join("")}</div>
          <div class="roadmap-row roadmap-months">${months.map(group => `<div style="grid-column:span ${group.count}">${escapeHtml(monthName(group.firstDate))}</div>`).join("")}</div>
          ${dayRow}
        </div>
        ${chart.rows.map(row => roadMapProjectHtml(row, chart)).join("")}
      </div>
    </div>
  `;
}

function roadMapProjectHtml(row, chart) {
  return `
    <section class="roadmap-project-group">
      <div class="roadmap-lane roadmap-project-lane">
        <div class="roadmap-bar roadmap-project-bar" role="button" tabindex="0" data-action="view-project-sprints" data-id="${row.project.id}" ${roadMapGridStyle(row.start, row.end, chart, true)} title="${escapeAttr(roadMapProjectTooltip(row))}">
          <strong>${escapeHtml(row.project.code)} - ${escapeHtml(row.project.title)}</strong>
          ${roadMapShowDates || roadMapShowDetails ? `
          <div class="roadmap-second-line">
            ${roadMapShowDetails ? `${avatarsHtml(row.project.members)}<span>${row.project.percentCompleted}% complete</span>` : ""}
            ${roadMapShowDates ? `<span class="roadmap-date-range">${escapeHtml(dateRangeLabel(row.start, row.end))}</span>` : ""}
          </div>
          ` : ""}
          <i style="--value:${row.project.percentCompleted}%"></i>
        </div>
      </div>
      ${roadMapShowSprints ? (row.sprints.map(sprintRow => roadMapSprintHtml(sprintRow, chart)).join("") || `<div class="empty compact-empty">No Sprints match the current filter.</div>`) : ""}
    </section>
  `;
}

function roadMapProjectTooltip(row) {
  return [
    `Project: ${row.project.code} - ${row.project.title}`,
    `Completion: ${row.project.percentCompleted}%`,
    `Start: ${formatDate(row.start) || "Not set"}`,
    `End: ${formatDate(row.end) || "Not set"}`
  ].join("\n");
}

function roadMapSprintHtml(row, chart) {
  return `
    <div class="roadmap-lane roadmap-sprint-lane">
      <div class="roadmap-bar roadmap-sprint-bar" role="button" tabindex="0" data-action="view-sprint-tasks" data-id="${row.sprint.id}" ${roadMapGridStyle(row.start, row.end, chart, false)} title="${escapeAttr(row.sprint.code + " " + row.sprint.title)}">
        <strong>${escapeHtml(row.sprint.code)} - ${escapeHtml(row.sprint.title)}</strong>
        ${roadMapShowDates || roadMapShowDetails ? `
        <div class="roadmap-second-line">
          ${roadMapShowDetails ? `${avatarsHtml(row.sprint.developers)}<span>${row.sprint.percentCompleted}% complete</span>` : ""}
          ${roadMapShowDates ? `<span class="roadmap-date-range">${escapeHtml(dateRangeLabel(row.start, row.end))}</span>` : ""}
        </div>
        ` : ""}
        <i style="--value:${row.sprint.percentCompleted}%"></i>
      </div>
    </div>
  `;
}

function roadMapGridStyle(start, end, chart, isProject) {
  const startIndex = Math.max(0, roadMapVisibleDateIndex(chart.dates, start, false, chart.granularity));
  let endIndex = roadMapVisibleDateIndex(chart.dates, end, true, chart.granularity);
  if (endIndex < startIndex) endIndex = startIndex;

  const minimumSpan = Math.min(isProject ? 6 : 3, chart.dates.length);
  const availableSpan = Math.max(1, chart.dates.length - startIndex);
  const span = Math.min(availableSpan, Math.max(minimumSpan, endIndex - startIndex + 1));
  return `style="grid-column:${startIndex + 1} / span ${span}"`;
}

function roadMapTimeline(minDate, maxDate, startDates, holidays) {
  const allDates = dateRange(minDate, maxDate);
  if (allDates.length > 240) {
    const dates = padRoadMapMonthsToViewport(monthRange(minDate, maxDate));
    return {
      dates,
      granularity: "month",
      dayWidth: roadMapMonthWidth(dates.length)
    };
  }

  const dates = allDates.filter(date => shouldShowGanttDate(date, startDates, holidays));
  return {
    dates,
    granularity: "day",
    dayWidth: dates.length > 180 ? 14 : dates.length > 120 ? 18 : dates.length > 60 ? 24 : dates.length > 35 ? 32 : 42
  };
}

function padRoadMapMonthsToViewport(dates) {
  if (!dates.length) return dates;

  const paddedDates = [...dates];
  const dayWidth = roadMapMonthWidth(paddedDates.length);
  const availableWidth = roadMapAvailableTimelineWidth();

  // If the compressed monthly calendar is narrower than the screen, show a few
  // future months so the user gets more useful timeline context.
  while ((paddedDates.length + 1) * dayWidth <= availableWidth) {
    const nextDate = new Date(paddedDates[paddedDates.length - 1]);
    nextDate.setMonth(nextDate.getMonth() + 1);
    paddedDates.push(nextDate);
  }

  return paddedDates;
}

function roadMapAvailableTimelineWidth() {
  const contentWidth = app?.clientWidth || window.innerWidth || 1200;
  return Math.max(560, contentWidth - 48);
}

function roadMapMonthWidth(monthCount) {
  if (monthCount > 72) return 14;
  if (monthCount > 48) return 18;
  if (monthCount > 30) return 24;
  if (monthCount > 18) return 32;
  return 42;
}

function monthRange(start, end) {
  const dates = [];
  const cursor = firstDayOfMonth(start);
  const last = firstDayOfMonth(end);
  while (cursor && last && cursor <= last) {
    dates.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return dates;
}

function firstDayOfMonth(value) {
  const date = normalizeDate(value);
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function roadMapVisibleDateIndex(dates, targetDate, preferEnd, granularity) {
  const date = granularity === "month" ? firstDayOfMonth(targetDate) : targetDate;
  return ganttVisibleDateIndex(dates, date, preferEnd);
}

function roadMapProjectStart(project) {
  // Projects without explicit dates still need to appear on the roadmap.
  if (!project) return null;
  return normalizeDate(project.startDate || project.createdAt);
}

function roadMapProjectEnd(project, projectSprints = roadMapProjectSprints(project)) {
  const start = roadMapProjectStart(project);
  const sprintEndDates = projectSprints.map(sprint => roadMapSprintEnd(sprint, project)).filter(Boolean);
  const latestSprintEnd = sprintEndDates.length ? new Date(Math.max(...sprintEndDates.map(date => date.getTime()))) : null;
  const end = normalizeDate(project.endDate) || latestSprintEnd || start;
  if (!start) return end;
  if (!end || end < start) return start;
  return end;
}

function roadMapSprintStart(sprint, project) {
  // A sprint with no StartDate begins with its project, per the Road Map rule.
  return normalizeDate(sprint.startDate) || roadMapProjectStart(project) || normalizeDate(sprint.createdAt);
}

function roadMapSprintEnd(sprint, project) {
  const start = roadMapSprintStart(sprint, project);
  const end = normalizeDate(sprint.endDate) || start;
  if (!start) return end;
  if (!end || end < start) return start;
  return end;
}

function ganttChartHtml(chart) {
  const years = groupedHeader(chart.dates, date => date.getFullYear());
  const quarters = groupedHeader(chart.dates, date => `${date.getFullYear()} Q${Math.floor(date.getMonth() / 3) + 1}`);
  const months = groupedHeader(chart.dates, date => `${date.getFullYear()}-${date.getMonth()}`);

  return `
    <div class="gantt panel" style="--day-width:${chart.dayWidth}px; --date-count:${chart.dates.length}">
      <div class="gantt-scroll">
        <div class="gantt-grid gantt-header">
          <div class="gantt-left-head">Sprint</div>
          <div class="gantt-timeline">
            <div class="gantt-row gantt-years">${years.map(group => `<div style="grid-column:span ${group.count}">${escapeHtml(group.label)}</div>`).join("")}</div>
            <div class="gantt-row gantt-quarters">${quarters.map(group => `<div style="grid-column:span ${group.count}">${escapeHtml(group.label.split(" ")[1])}</div>`).join("")}</div>
            <div class="gantt-row gantt-months">${months.map(group => `<div style="grid-column:span ${group.count}">${escapeHtml(monthName(group.firstDate))}</div>`).join("")}</div>
            <div class="gantt-row gantt-days">${chart.dates.map(date => `<div class="${ganttDateClass(date, chart.holidays)}" title="${escapeAttr(ganttDateTitle(date, chart.holidays))}">${ganttDayLabel(date, chart)}</div>`).join("")}</div>
          </div>
        </div>
        ${chart.sprints.map(sprint => ganttSprintHtml(sprint, chart)).join("") || `<div class="empty">No Sprints for this project.</div>`}
      </div>
    </div>
  `;
}

function ganttSprintHtml(sprint, chart) {
  const sprintTasks = state.tasks
    .filter(task => task.sprintId === sprint.id && task.taskType !== "Bug")
    .sort((a, b) => ganttStartDate(a) - ganttStartDate(b) || a.id - b.id);
  const sprintBugs = state.tasks.filter(task => task.sprintId === sprint.id && task.taskType === "Bug");
  const sprintTooltip = `${sprint.code} - ${sprint.title} (${sprintTasks.length} tasks)`;

  return `
    <div class="gantt-grid gantt-sprint-block" data-gantt-sprint-id="${sprint.id}">
      <button type="button" class="gantt-sprint-name" data-action="view-sprint-tasks" data-id="${sprint.id}" title="${escapeAttr(sprintTooltip)}">
        <strong>${escapeHtml(sprint.code)}</strong>
        <span>${escapeHtml(sprint.title)}</span>
      </button>
      <div class="gantt-task-stack">
        ${sprintTasks.map(task => ganttTaskHtml(task, sprintBugs, chart)).join("") || `<div class="empty compact-empty">No tasks.</div>`}
      </div>
    </div>
  `;
}

function ganttTaskHtml(task, sprintBugs, chart) {
  const bugTasks = bugsForTask(task, sprintBugs);
  const hasOpenBugs = bugTasks.some(bug => !isTaskCompleted(bug));
  const showBugs = ganttShowAllBugs || ganttExpandedBugTaskIds.has(task.id);

  return `
    <div class="gantt-task-group">
      <div class="gantt-lane">
        ${ganttDependencyLines(task, chart)}
        <div class="gantt-bar" role="button" tabindex="0" data-action="gantt-open-task" data-id="${task.id}" ${ganttGridStyle(task, chart)} title="${escapeAttr(task.code + " " + task.title)}">
          ${avatarsHtml(task.assignees)}
          <span>${escapeHtml(task.code)} ${escapeHtml(task.title)}</span>
          ${bugTasks.length ? `<button type="button" class="gantt-bug-button ${hasOpenBugs ? "open-bugs" : "closed-bugs"}" data-action="toggle-gantt-task-bugs" data-id="${task.id}" title="Show bug reports">&#128027;</button>` : ""}
          <i style="--value:${taskDisplayPercent(task)}%"></i>
        </div>
      </div>
      ${showBugs ? bugTasks.map(bug => `
        <div class="gantt-lane gantt-bug-lane">
          <div class="gantt-bar gantt-bug-bar" role="button" tabindex="0" data-action="gantt-open-task" data-id="${bug.id}" ${ganttGridStyle(bug, chart)} title="${escapeAttr(bug.code + " " + bug.title)}">
            ${avatarsHtml(bug.assignees)}
            <span>${escapeHtml(bug.code)} ${escapeHtml(bug.title)}</span>
            <i style="--value:${taskDisplayPercent(bug)}%"></i>
          </div>
        </div>
      `).join("") : ""}
    </div>
  `;
}

function ganttGridStyle(item, chart) {
  const start = ganttStartDate(item);
  const end = ganttEndDate(item);
  const startIndex = Math.max(0, ganttVisibleDateIndex(chart.dates, start, false));
  let endIndex = ganttVisibleDateIndex(chart.dates, end, true);
  if (endIndex < startIndex) endIndex = startIndex;

  const span = Math.max(2, endIndex - startIndex + 1);
  return `style="grid-column:${startIndex + 1} / span ${span}; --status-color:${escapeAttr(statusColor(item.status || "Todo"))}"`;
}

function ganttDependencyLines(task, chart) {
  return (task.dependencyTaskIds || [])
    .map(id => taskById(id))
    .filter(Boolean)
    .map(dependency => {
      const fromIndex = ganttVisibleDateIndex(chart.dates, ganttEndDate(dependency), true);
      const toIndex = ganttVisibleDateIndex(chart.dates, ganttStartDate(task), false);
      if (fromIndex < 0 || toIndex < 0 || toIndex <= fromIndex) return "";
      return `<span class="gantt-dependency" style="grid-column:${fromIndex + 1} / ${toIndex + 1}" title="Depends on ${escapeAttr(dependency.code)}"></span>`;
    }).join("");
}

function ganttStartDate(item) {
  // StartDate is optional, so CreatedAt gives old tasks a reasonable place on the chart.
  return normalizeDate(item.startDate || item.startedAt || item.createdAt);
}

function ganttEndDate(item) {
  const start = ganttStartDate(item);
  const end = normalizeDate(item.endDate || item.startDate || item.updatedAt || item.createdAt);
  if (!start) return end;
  if (!end || end < start) return start;
  return end;
}

function ganttVisibleDateIndex(dates, targetDate, preferEnd) {
  if (!targetDate || !dates.length) return -1;

  const targetKey = dateKey(targetDate);
  const exactIndex = dates.findIndex(date => dateKey(date) === targetKey);
  if (exactIndex >= 0) return exactIndex;

  if (preferEnd) {
    for (let index = dates.length - 1; index >= 0; index--) {
      if (dates[index] <= targetDate) return index;
    }
    return 0;
  }

  for (let index = 0; index < dates.length; index++) {
    if (dates[index] >= targetDate) return index;
  }
  return dates.length - 1;
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKey(value) {
  const date = normalizeDate(value);
  if (!date) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function dateRange(start, end) {
  const dates = [];
  const cursor = normalizeDate(start);
  const last = normalizeDate(end);
  while (cursor && last && cursor <= last) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function activeHolidayMap() {
  const holidays = new Map();
  (state.holidays || []).filter(item => item.isActive).forEach(holiday => {
    holidays.set(dateKey(holiday.holidayDate), holiday);
  });
  return holidays;
}

function shouldShowGanttDate(date, itemStartDates, holidays, showNonWorkingDays = false) {
  if (showNonWorkingDays) return true;
  // Weekends and holidays stay hidden unless an item starts on that exact date.
  return itemStartDates.has(dateKey(date)) || (!isWeekend(date) && !isHoliday(date, holidays));
}

function ganttDateClass(date, holidays) {
  const classes = [];
  if (isWeekend(date)) classes.push("weekend-day");
  if (isHoliday(date, holidays)) classes.push("holiday-day");
  return classes.join(" ");
}

function ganttDayLabel(date, chart) {
  const day = date.getDate();
  if (chart.dayWidth <= 12) return [1, 5, 10, 15, 20, 25].includes(day) ? String(day) : "";
  if (chart.dayWidth <= 16) return day === 1 || day % 2 === 0 ? String(day) : "";
  return String(day);
}

function isWeekend(date) {
  return date.getDay() === 0 || date.getDay() === 6;
}

function isHoliday(date, holidays) {
  return holidays.has(dateKey(date));
}

function ganttDateTitle(date, holidays) {
  const holiday = holidays.get(dateKey(date));
  return holiday ? `${formatDate(date)} - ${holiday.name}` : formatDate(date);
}

function groupedHeader(dates, keySelector) {
  const groups = [];
  dates.forEach(date => {
    const label = String(keySelector(date));
    const last = groups[groups.length - 1];
    if (last?.label === label) {
      last.count += 1;
    } else {
      groups.push({ label, count: 1, firstDate: date });
    }
  });
  return groups;
}

function monthName(date) {
  return date.toLocaleString(undefined, { month: "short" });
}

function bugsForTask(task, sprintBugs) {
  return sprintBugs.filter(bug =>
    bug.id === task.linkedBugTaskId ||
    task.dependencyTaskIds?.includes(bug.id) ||
    bug.dependencyTaskIds?.includes(task.id) ||
    (bug.assigneeIds || []).some(id => (task.assigneeIds || []).includes(id))
  );
}

function toggleGanttTaskBugs(taskId) {
  const id = Number(taskId);
  const scrollPosition = captureGanttScrollPosition();
  const resumeSprintId = nearestGanttSprintIdFromScroll();
  if (ganttFlyByActive) {
    stopGanttFlyBy({ keepResume: true });
    ganttFlyByResumeSprintId = resumeSprintId || ganttFlyByResumeSprintId;
    updateGanttFlyByButton();
  }

  if (ganttExpandedBugTaskIds.has(id)) {
    ganttExpandedBugTaskIds.delete(id);
  } else {
    ganttExpandedBugTaskIds.add(id);
  }
  renderGantt({ restoreScroll: scrollPosition, skipStopFlyBy: true });
}

function taskButtonsHtml(task) {
  const canEdit = canEditTask(task);
  return `
    ${iconButton("delete-task", task.id, "Delete", "delete", canEdit, "danger")}
    ${iconButton("duplicate-task", task.id, "Duplicate", "duplicate", canEdit)}
    ${iconButton("show-task-audit", task.id, "Audit Log", "audit", true)}
    ${iconButton("view-task", task.id, "View", "view", true)}
    ${iconButton("edit-task", task.id, "Edit", "edit", canEdit)}
  `;
}

function taskAuditPanelHtml(task) {
  return `
    <div class="field full audit-editor-row">
      <button type="button" class="icon-action" data-action="show-task-audit" data-id="${task.id}" title="Audit Log" aria-label="Audit Log">&#128221;</button>
    </div>
  `;
}

function iconButton(action, id, title, icon, enabled = true, extraClass = "") {
  const icons = { view: "&#128065;", audit: "&#128221;", edit: "&#9998;", duplicate: "&#10697;", delete: "&#10005;", finish: "&#10003;", gantt: "&#128202;" };
  return `<button type="button" class="icon-action ${extraClass}" data-action="${action}" data-id="${id}" title="${escapeAttr(title)}" ${enabled ? "" : "disabled"}>${icons[icon] || "?"}</button>`;
}

function bugFixIconHtml(task) {
  if (task.taskType === "Bug" || !task.linkedBugTaskId) return "";
  return `<span class="bug-fix-icon" title="Bug Fix">&#128027;</span>`;
}

function progressHtml(value) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
  return `<div class="progress" title="${safeValue}%"><span style="--value:${safeValue}%"></span></div>`;
}

function thinProgressHtml(value, color) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
  return `<span class="thin-progress" title="${safeValue}%"><span style="--value:${safeValue}%; --status-color:${escapeAttr(color || "var(--teal)")};"></span></span>`;
}

function projectWorkItems(projectId) {
  return state.tasks.filter(task => task.projectId === projectId && !task.parentTaskId);
}

function sprintWorkItems(sprintId) {
  return state.tasks.filter(task => task.sprintId === sprintId && !task.parentTaskId);
}

function projectOverallPercent(project) {
  const workItems = projectWorkItems(project.id);
  if (!workItems.length) return Number(project.percentCompleted || 0);
  return averageWorkItemPercent(workItems);
}

function sprintOverallPercent(sprint) {
  const workItems = sprintWorkItems(sprint.id);
  if (!workItems.length) return Number(sprint.percentCompleted || 0);

  return averageWorkItemPercent(workItems);
}

function averageWorkItemPercent(workItems) {
  if (!workItems.length) return 0;

  // Average Dev Tasks and Bugs so the summary reflects the real workload.
  const totalPercent = workItems.reduce((sum, task) => sum + taskDisplayPercent(task), 0);
  return Math.round(totalPercent / workItems.length);
}

function projectOverallProgressHtml(project) {
  return overallProgressBlockHtml("Overall Progress", projectOverallPercent(project));
}

function sprintOverallProgressHtml(sprint) {
  return overallProgressBlockHtml("Overall Progress", sprintOverallPercent(sprint));
}

function overallProgressBlockHtml(label, percent) {
  return `
    <div class="sprint-overall-progress">
      <div class="sprint-metric-label">
        <span>${escapeHtml(label)}</span>
        <span>${percent}%</span>
      </div>
      ${progressHtml(percent)}
    </div>
  `;
}

function projectStatusMetricsHtml(project) {
  return workItemStatusMetricsHtml(projectWorkItems(project.id), "No Dev Tasks or Bugs.");
}

function sprintStatusMetricsHtml(sprint) {
  return workItemStatusMetricsHtml(sprintWorkItems(sprint.id), "No Dev Tasks or Bugs.");
}

function workItemStatusMetricsHtml(workItems, emptyText) {
  const total = workItems.length;
  if (!total) return `<div class="empty compact-empty">${escapeHtml(emptyText)}</div>`;

  const rows = statuses
    .map(status => ({
      status,
      count: workItems.filter(task => task.status === status).length
    }))
    .filter(item => item.count > 0);

  return `
    <div class="sprint-status-metrics">
      ${rows.map(item => {
        const percent = Math.round((item.count / total) * 100);
        return `
          <div class="sprint-status-metric">
            <div class="sprint-metric-label">
              <span>${escapeHtml(item.status)}</span>
              <span>${item.count} of ${total}</span>
            </div>
            ${thinProgressHtml(percent, statusColor(item.status))}
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function statusStyle(status) {
  return `style="--status-color:${escapeAttr(statusColor(status))}"`;
}

function statusColor(status) {
  const lookup = (state.lookups || []).find(item => item.lookupType === "Status" && item.value === status && item.colorHex);
  return lookup?.colorHex || defaultStatusColor(status);
}

function defaultStatusColor(status) {
  const colors = ["#6B7680", "#76A9FF", "#35C7BD", "#8AD17C", "#E4C63A", "#E4A53A", "#EE6B70", "#74C476", "#58B6D6", "#9F9CFF", "#C5D35C"];
  const index = statuses.indexOf(status);
  return colors[index >= 0 ? index : 1] || "#76A9FF";
}

function taskDisplayPercent(task) {
  if (task.subTasks?.length) return Math.round(task.subTaskAveragePercent ?? task.percentCompleted ?? 0);
  return percentForStatus(task.status, task.percentCompleted ?? 0);
}

function percentForStatus(status, currentValue) {
  if (status === "Backlog" || status === "Todo") return Number(currentValue || 0);
  const qaPassedIndex = statuses.indexOf("QA Passed");
  if (qaPassedIndex >= 0 && statuses.indexOf(status) >= qaPassedIndex) return 100;
  return Number(currentValue || 0);
}

function percentForDevTaskSave(status, currentValue) {
  // The database also treats Code Complete as finished for normal Dev Tasks.
  if (status === "Code Complete") return 100;
  return percentForStatus(status, currentValue);
}

function validateLinkedBugCompletion(task, percentCompleted, dependencyTaskIds) {
  if (Number(percentCompleted || 0) < 100) return;

  const bug = associatedBugForDevTask(task, dependencyTaskIds);
  if (bug && !isBugQaPassedOrLater(bug)) {
    throw new Error(linkedBugCompletionMessage);
  }
}

function associatedBugForDevTask(task, dependencyTaskIds = []) {
  if (task?.linkedBugTaskId) {
    const linkedBug = taskById(task.linkedBugTaskId);
    if (linkedBug?.taskType === "Bug") return linkedBug;
  }

  return (dependencyTaskIds || [])
    .map(id => taskById(id))
    .find(item => item?.taskType === "Bug") || null;
}

function isBugQaPassedOrLater(bug) {
  const qaPassedIndex = statuses.indexOf("QA Passed");
  const bugStatusIndex = statuses.indexOf(bug?.status || "");
  return qaPassedIndex >= 0 && bugStatusIndex >= qaPassedIndex;
}

function isTaskCompleted(task) {
  const qaPassedIndex = statuses.indexOf("QA Passed");
  const taskStatusIndex = statuses.indexOf(task.status);
  return Number(task.percentCompleted || 0) >= 100 || (qaPassedIndex >= 0 && taskStatusIndex >= qaPassedIndex);
}

function taskPercentField(task, isLocked) {
  const percent = taskDisplayPercent({ ...task, subTasks: isLocked ? task.subTasks : [] });

  return `
    <div class="field">
      <label>Percent</label>
      <input name="percentCompleted" type="number" min="0" max="100" value="${escapeAttr(percent)}" ${isLocked ? `disabled data-locked="true"` : ""}>
      ${isLocked ? `<small class="field-note">Calculated from sub-tasks.</small>` : ""}
    </div>
  `;
}

function sprintStatusGraphHtml(sprint, showLegend = true, hideZeroLegend = false) {
  const sprintTasks = state.tasks.filter(task => task.sprintId === sprint.id && !task.parentTaskId);
  const total = sprintTasks.length;
  if (!total) return `<div class="empty">No tasks.</div>`;

  const counts = statuses.map(status => ({
    status,
    count: sprintTasks.filter(task => task.status === status).length
  }));
  const legendCounts = hideZeroLegend ? counts.filter(item => item.count > 0) : counts;

  return `
    <div class="status-graph">
      <div class="status-bar">
        ${counts.map(item => item.count ? `<span class="status-color-chip" style="--value:${(item.count / total) * 100}%; --status-color:${escapeAttr(statusColor(item.status))}" title="${escapeAttr(item.status)} ${item.count}"></span>` : "").join("")}
      </div>
      ${showLegend ? `
      <div class="status-legend">
        ${legendCounts.map(item => `<span><i ${statusStyle(item.status)}></i>${escapeHtml(item.status)} ${item.count}</span>`).join("")}
      </div>
      ` : ""}
    </div>
  `;
}

function bugStatusGraphHtml(bugs) {
  if (!bugs.length) return `<div class="empty compact-empty">No bug reports.</div>`;

  const counts = statuses.map(status => ({
    status,
    count: bugs.filter(bug => bug.status === status).length
  }));

  return `
    <div class="status-graph bug-graph" title="${bugs.length} bug reports">
      <div class="status-bar">
        ${counts.map(item => item.count ? `<span class="status-color-chip" style="--value:${(item.count / bugs.length) * 100}%; --status-color:${escapeAttr(statusColor(item.status))}" title="${escapeAttr(item.status)} ${item.count}"></span>` : "").join("")}
      </div>
    </div>
  `;
}

function statusLegendHtml() {
  const usedStatuses = statuses.filter(status => state.tasks.some(task => task.status === status));

  return `
    <div class="status-legend dashboard-status-legend">
      ${usedStatuses.map(status => `<span><i ${statusStyle(status)}></i>${escapeHtml(status)}</span>`).join("")}
    </div>
  `;
}

function statusClass(status) {
  return `status-${statuses.indexOf(status) + 1}`;
}

function avatarsHtml(users) {
  return `<div class="avatar-stack">${(users || []).map(user => `<img class="avatar" src="${escapeAttr(user.avatarUrl || "/assets/avatar-default.svg")}" title="${escapeAttr(user.nickname)}" alt="">`).join("")}</div>`;
}

function taskRowAvatarsHtml(users) {
  if (!users || !users.length) return `<span class="muted">Unassigned</span>`;

  return `
    <div class="row-avatar-stack">
      ${users.map(user => `<img class="row-avatar" src="${escapeAttr(user.avatarUrl || "/assets/avatar-default.svg")}" title="${escapeAttr(user.nickname)}" alt="">`).join("")}
    </div>
  `;
}

function refreshLookupOptions() {
  statuses = lookupValues("Status", fallbackStatuses);
  priorities = lookupValues("Priority", fallbackPriorities);
  severities = lookupValues("Severity", fallbackSeverities);
  environments = lookupValues("Environment", fallbackEnvironments);

  const saved = Array.isArray(boardStatuses) ? boardStatuses : [];
  boardStatuses = saved.filter(status => statuses.includes(status));
  if (!boardStatuses.length) boardStatuses = [...statuses];
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

function fallbackForLookup(type) {
  if (type === "Status") return fallbackStatuses;
  if (type === "Priority") return fallbackPriorities;
  if (type === "Severity") return fallbackSeverities;
  if (type === "Environment") return fallbackEnvironments;
  return [];
}

function filterSelect(label, filterName, items, selectedValue, emptyText) {
  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <select data-filter="${filterName}">
        <option value="">${escapeHtml(emptyText)}</option>
        ${items.map(item => `<option value="${escapeAttr(item.value)}" ${String(item.value) === String(selectedValue) ? "selected" : ""}>${escapeHtml(item.text)}</option>`).join("")}
      </select>
    </label>
  `;
}

function filterCheckList(label, filterName, items, selectedValues) {
  const selected = new Set(normalizeSavedArray(selectedValues));

  return `
    <fieldset class="filter-check-list">
      <legend>${escapeHtml(label)}</legend>
      ${items.map(item => `
        <label>
          <input type="checkbox" data-filter="${filterName}" value="${escapeAttr(item.value)}" ${selected.has(String(item.value)) ? "checked" : ""}>
          <span>${escapeHtml(item.text)}</span>
        </label>
      `).join("")}
    </fieldset>
  `;
}

function checkedFilterValues(filterName) {
  return [...document.querySelectorAll(`[data-filter='${filterName}']:checked`)].map(input => String(input.value));
}

function saveTaskFilters() {
  localStorage.setItem("pmt-task-filters", JSON.stringify(taskFilters));
}

function normalizeSavedArray(value, legacyValue = "") {
  if (Array.isArray(value)) {
    return value.filter(item => item !== null && item !== undefined && item !== "").map(String);
  }

  if (legacyValue !== null && legacyValue !== undefined && legacyValue !== "") {
    return [String(legacyValue)];
  }

  if (value !== null && value !== undefined && value !== "") {
    return [String(value)];
  }

  return [];
}

function attachmentsHtml(files) {
  return `<div class="attachment-grid">${files.map(file => `
    <a class="attachment-tile" href="${escapeAttr(file.url)}" target="_blank" rel="noopener noreferrer" title="${escapeAttr(file.fileName)}">
      ${isImageFile(file) ? `<img src="${escapeAttr(file.url)}" alt="${escapeAttr(file.fileName)}">` : `<span class="file-icon">${fileIcon(file)}</span>`}
      <span>${escapeHtml(file.fileName)}</span>
    </a>
  `).join("")}</div>`;
}

function filePreviewHtml(file) {
  const fileUrl = URL.createObjectURL(file);
  const safeName = escapeHtml(file.name);
  return `
    <div class="attachment-tile">
      ${file.type.startsWith("image/") ? `<img src="${escapeAttr(fileUrl)}" alt="${escapeAttr(file.name)}">` : `<span class="file-icon">${fileIcon(file)}</span>`}
      <span>${safeName}</span>
    </div>
  `;
}

function isImageFile(file) {
  return (file.contentType || file.type || "").startsWith("image/");
}

function fileIcon(file) {
  const type = file.contentType || file.type || "";
  if (type.includes("pdf")) return "PDF";
  if (type.includes("word")) return "DOC";
  if (type.includes("excel") || type.includes("spreadsheet")) return "XLS";
  return "FILE";
}

function field(label, name, currentValue, type, min = "", max = "") {
  return `<div class="field"><label>${label}</label><input name="${name}" type="${type}" value="${escapeAttr(currentValue ?? "")}" ${min !== "" ? `min="${min}"` : ""} ${max !== "" ? `max="${max}"` : ""}></div>`;
}

function colorField(label, name, currentValue) {
  const color = validColor(currentValue) ? currentValue : "#76A9FF";
  return `<div class="field"><label>${label}</label><input name="${name}" type="color" value="${escapeAttr(color)}"></div>`;
}

function validColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || ""));
}

function selectField(label, name, items, selectedId) {
  return selectOptionsField(label, name, items.map(item => ({ id: item.id, title: `${item.code || item.nickname || item.title} ${item.title && item.code ? "- " + item.title : ""}` })), selectedId);
}

function selectOptionsField(label, name, items, selectedId) {
  return `
    <div class="field">
      <label>${label}</label>
      <select name="${name}">
        ${items.map(item => `<option value="${item.id}" ${String(item.id) === String(selectedId ?? "") ? "selected" : ""}>${escapeHtml(item.title)}</option>`).join("")}
      </select>
    </div>
  `;
}

function selectTextField(label, name, items, selectedText) {
  return `
    <div class="field">
      <label>${label}</label>
      <select name="${name}">
        ${items.map(item => `<option value="${escapeAttr(item)}" ${item === selectedText ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}
      </select>
    </div>
  `;
}

function richTextField(name, label, html) {
  return `
    <div class="field full">
      <label>${label}</label>
      <div class="rich-tools">
        <button type="button" data-command="bold" title="Bold"><b>B</b></button>
        <button type="button" data-command="underline" title="Underline"><u>U</u></button>
        <button type="button" data-command="insertUnorderedList" title="List" aria-label="List">&#8226;</button>
        <button type="button" data-command="createLink" title="Link" aria-label="Link">&#128279;</button>
      </div>
      <div class="rich-editor" contenteditable="true" data-rich="${name}">${html || ""}</div>
    </div>
  `;
}

function checkList(label, name, items, selectedIds, textSelector = item => item.nickname || item.title, options = {}) {
  if (typeof textSelector === "object" && textSelector !== null) {
    options = textSelector;
    textSelector = item => item.nickname || item.title;
  }

  const selected = new Set((selectedIds || []).map(String));
  const fieldsetClass = ["check-list field full", options.className || ""].filter(Boolean).join(" ");
  const renderItem = options.renderItem || (item => escapeHtml(textSelector(item)));

  return `
    <fieldset class="${fieldsetClass}">
      <legend>${escapeHtml(label)}</legend>
      ${items.map(item => `
        <label>
          <input type="checkbox" name="${name}" value="${escapeAttr(item.id)}" ${selected.has(String(item.id)) ? "checked" : ""}>
          <span class="check-list-label">${renderItem(item)}</span>
        </label>
      `).join("")}
    </fieldset>
  `;
}

function checkListOrEmpty(label, name, items, selectedIds, emptyText, options = {}) {
  if (items.length) return checkList(label, name, items, selectedIds, options);

  return `
    <fieldset class="check-list field full">
      <legend>${escapeHtml(label)}</legend>
      <span class="muted">${escapeHtml(emptyText)}</span>
    </fieldset>
  `;
}

function userCheckListLabelHtml(user) {
  return `
    <span class="check-list-user">
      <img class="check-list-avatar" src="${escapeAttr(user.avatarUrl || "/assets/avatar-default.svg")}" alt="">
      <span>${escapeHtml(user.nickname)}</span>
    </span>
  `;
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
      "Select project members before adding people to this Sprint."
    );
  };

  projectSelect.addEventListener("change", renderMembers);
  renderMembers();
}

function bindAssigneeList(root, initialSelectedIds) {
  const projectSelect = root.querySelector("[name='projectId']");
  const sprintSelect = root.querySelector("[name='sprintId']");
  const container = root.querySelector("[data-assignee-list]");
  if (!projectSelect || !container) return;

  let firstRender = true;
  const renderAssignees = () => {
    const selectedIds = firstRender ? initialSelectedIds : checkedNumbers(root, "assigneeIds");
    firstRender = false;
    container.innerHTML = checkListOrEmpty(
      "Assignees",
      "assigneeIds",
      allowedAssigneeUsers(Number(projectSelect.value), sprintSelect?.value || ""),
      selectedIds,
      "Only project or Sprint members can be assigned.",
      { className: "scroll-check-list avatar-check-list", renderItem: userCheckListLabelHtml }
    );
  };

  projectSelect.addEventListener("change", () => {
    refreshSprintOptions(root, Number(projectSelect.value));
    renderAssignees();
  });
  sprintSelect?.addEventListener("change", renderAssignees);
  renderAssignees();
}

function refreshSprintOptions(root, projectId) {
  const sprintSelect = root.querySelector("[name='sprintId']");
  if (!sprintSelect) return;

  const selectedSprintId = Number(sprintSelect.value || 0);
  const projectSprints = state.sprints.filter(sprint => sprint.projectId === projectId);
  const selectedSprintStillValid = projectSprints.some(sprint => sprint.id === selectedSprintId);
  const nextSelectedId = selectedSprintStillValid ? selectedSprintId : "";

  sprintSelect.innerHTML = [
    `<option value="">No Sprint</option>`,
    ...projectSprints.map(sprint => `<option value="${sprint.id}" ${String(sprint.id) === String(nextSelectedId) ? "selected" : ""}>${escapeHtml(sprint.code)}</option>`)
  ].join("");
}

function projectMemberUsers(projectId) {
  const memberIds = new Set(projectById(projectId)?.memberIds || []);
  return state.users.filter(user => memberIds.has(user.id));
}

function sprintMemberUsers(sprintId) {
  const memberIds = new Set(sprintById(Number(sprintId))?.developerIds || []);
  return state.users.filter(user => memberIds.has(user.id));
}

function allowedAssigneeUsers(projectId, sprintId) {
  if (sprintId) return sprintMemberUsers(sprintId);
  return projectMemberUsers(projectId);
}

function value(root, name) {
  return root.querySelector(`[name='${name}']`)?.value || "";
}

function numberValue(root, name) {
  return Number(value(root, name) || 0);
}

function optionalNumberValue(root, name) {
  const raw = value(root, name);
  return raw === "" ? null : Number(raw);
}

function nullableDateValue(root, name) {
  const raw = value(root, name);
  return raw || null;
}

function richValue(root, name) {
  return normalizeRichHtml(root.querySelector(`[data-rich='${name}']`)?.innerHTML || "");
}

function checkedNumbers(root, name) {
  return [...root.querySelectorAll(`[name='${name}']:checked`)].map(input => Number(input.value));
}

function askYesNo(message, title) {
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
        <button type="button" class="secondary text-icon-button" data-result="no">${buttonContent("&#10005;", "Cancel")}</button>
        <button type="button" class="primary text-icon-button" data-result="yes">${buttonContent("&#10003;", "Continue")}</button>
      </div>
    `;

    document.body.appendChild(modal);

    const finish = result => {
      modal.close();
      modal.remove();
      resolve(result);
    };

    modal.querySelector("[data-result='no']").addEventListener("click", () => finish(false));
    modal.querySelector("[data-result='yes']").addEventListener("click", () => finish(true));
    modal.addEventListener("cancel", event => {
      event.preventDefault();
      finish(false);
    });

    modal.showModal();
  });
}

function askFinishSprintOptions() {
  return new Promise(resolve => {
    const modal = document.createElement("dialog");
    modal.className = "dialog mini-dialog";
    modal.innerHTML = `
      <div class="dialog-head">
        <h2>Finish Sprint</h2>
      </div>
      <div class="dialog-body">
        <label class="inline-check">
          <input name="carryUnfinished" type="checkbox" checked>
          <span>Finish this Sprint and carry unfinished tasks forward?</span>
        </label>
        <label class="inline-check">
          <input name="carryTodos" type="checkbox">
          <span>Carry over the Todos in the next Sprint</span>
        </label>
      </div>
      <div class="dialog-actions">
        <button type="button" class="secondary text-icon-button" data-result="cancel">${buttonContent("&#10005;", "Cancel")}</button>
        <button type="button" class="primary text-icon-button" data-result="finish">${buttonContent("&#10003;", "Finish")}</button>
      </div>
    `;

    document.body.appendChild(modal);

    const finish = value => {
      modal.close();
      modal.remove();
      resolve(value);
    };

    modal.querySelector("[data-result='cancel']").addEventListener("click", () => finish(null));
    modal.querySelector("[data-result='finish']").addEventListener("click", () => finish({
      carryUnfinished: modal.querySelector("[name='carryUnfinished']").checked,
      carryTodos: modal.querySelector("[name='carryTodos']").checked
    }));
    modal.addEventListener("cancel", event => {
      event.preventDefault();
      finish(null);
    });

    modal.showModal();
  });
}

function askForText(label, title, placeholder = "") {
  return new Promise(resolve => {
    const modal = document.createElement("dialog");
    modal.className = "dialog mini-dialog";
    modal.innerHTML = `
      <form method="dialog">
        <div class="dialog-head">
          <h2>${escapeHtml(title)}</h2>
        </div>
        <div class="dialog-body">
          <div class="field">
            <label>${escapeHtml(label)}</label>
            <input name="dialogText" value="${escapeAttr(placeholder)}">
          </div>
        </div>
        <div class="dialog-actions">
          <button type="button" class="secondary text-icon-button" data-result="cancel">${buttonContent("&#10005;", "Cancel")}</button>
          <button type="submit" class="primary text-icon-button">${buttonContent("&#10003;", "Apply")}</button>
        </div>
      </form>
    `;

    document.body.appendChild(modal);

    const finish = value => {
      modal.close();
      modal.remove();
      resolve(value);
    };

    modal.querySelector("[data-result='cancel']").addEventListener("click", () => finish(""));
    modal.querySelector("form").addEventListener("submit", event => {
      event.preventDefault();
      finish(modal.querySelector("[name='dialogText']").value);
    });
    modal.addEventListener("cancel", event => {
      event.preventDefault();
      finish("");
    });

    modal.showModal();
    setTimeout(() => modal.querySelector("[name='dialogText']").focus(), 0);
  });
}

function normalizeRichHtml(html) {
  const container = document.createElement("div");
  container.innerHTML = html;
  linkifyTextNodes(container);
  normalizeLinksInElement(container);
  return container.innerHTML;
}

function normalizeLinksInElement(root) {
  root.querySelectorAll("a[href]").forEach(link => {
    link.href = normalizeUrl(link.getAttribute("href"));
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });
}

function linkifyTextNodes(root) {
  const textNodes = [];

  collectTextNodes(root, textNodes);
  textNodes.forEach(node => {
    const text = node.nodeValue;
    const urlPattern = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
    if (!urlPattern.test(text)) return;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    text.replace(urlPattern, (match, _unused, offset) => {
      if (offset > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, offset)));
      }

      const link = document.createElement("a");
      link.href = normalizeUrl(match);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = match;
      fragment.appendChild(link);
      lastIndex = offset + match.length;
      return match;
    });

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    node.parentNode.replaceChild(fragment, node);
  });
}

function collectTextNodes(node, textNodes) {
  if (node.nodeType === Node.TEXT_NODE) {
    if (node.nodeValue.trim() && node.parentElement?.tagName !== "A") {
      textNodes.push(node);
    }
    return;
  }

  node.childNodes.forEach(child => collectTextNodes(child, textNodes));
}

function normalizeUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/") || trimmed.startsWith("#") || trimmed.startsWith("./") || trimmed.startsWith("../")) return trimmed;
  if (trimmed.startsWith("www.")) return `https://${trimmed}`;
  return `https://${trimmed}`;
}

function selectedBoardSprintId(projectId) {
  if (boardSprintMode === "all") return 0;
  if (boardSprintMode !== "latest") return Number(boardSprintMode);
  const latest = state.sprints
    .filter(sprint => sprint.projectId === projectId)
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))[0];
  return latest?.id || 0;
}

function currentUser() {
  return state.users.find(user => user.id === currentUserId) || state.users[0] || {};
}

function canEditOwner(ownerUserId) {
  return currentUser().isAdmin || ownerUserId === currentUserId;
}

function canEditTask(task) {
  const user = currentUser();
  if (user.isAdmin || user.role === "Admin") return true;
  if (task?.taskType === "Bug") return user.role === "QA";
  return user.role === "Developer";
}

function canEditUser(userId) {
  return currentUser().isAdmin || userId === currentUserId;
}

function projectById(id) {
  return state.projects.find(project => project.id === id);
}

function sprintById(id) {
  return state.sprints.find(sprint => sprint.id === id);
}

function taskById(id) {
  return state.tasks.find(task => task.id === id);
}

function userById(id) {
  return state.users.find(user => user.id === id);
}

function projectName(id) {
  const project = projectById(id);
  return project ? `${project.code} - ${project.title}` : "No project";
}

function projectCode(id) {
  const project = projectById(id);
  return project?.code || "No project";
}

function sprintName(id) {
  const sprint = sprintById(id);
  return sprint ? sprint.code : "No Sprint";
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

function dateRangeLabel(start, end) {
  const startText = formatDate(start);
  const endText = formatDate(end);
  if (!startText && !endText) return "";
  if (startText === endText || !endText) return startText;
  if (!startText) return endText;
  return `${startText} - ${endText}`;
}

function documentationDateLine(blog) {
  const createdText = `Created ${formatDate(blog.createdAt)}`;
  if (!documentationWasEdited(blog)) return createdText;
  return `${createdText} | Last edited ${formatDate(blog.updatedAt)}`;
}

function documentationWasEdited(blog) {
  const createdTime = new Date(blog.createdAt || 0).getTime();
  const updatedTime = new Date(blog.updatedAt || 0).getTime();
  return Boolean(createdTime && updatedTime && Math.abs(updatedTime - createdTime) > 60000);
}

function toDateInput(value) {
  const date = value ? new Date(value) : new Date();
  return date.toISOString().slice(0, 10);
}

function stripHtml(html) {
  const div = document.createElement("div");
  div.innerHTML = html || "";
  return div.textContent || "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function showToast(message, anchorElement = null) {
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.toggle("toast-near-control", Boolean(anchorElement));
  toast.style.left = "";
  toast.style.top = "";
  toast.style.right = "";
  toast.style.bottom = "";
  toast.style.maxWidth = "";

  if (anchorElement) {
    // Place contextual messages under the control that caused them.
    const rect = anchorElement.getBoundingClientRect();
    const maxWidth = Math.min(360, window.innerWidth - 32);
    toast.style.maxWidth = `${maxWidth}px`;

    const toastWidth = Math.min(toast.offsetWidth || maxWidth, maxWidth);
    const toastHeight = toast.offsetHeight || 44;
    const left = Math.max(16, Math.min(rect.left + (rect.width / 2) - (toastWidth / 2), window.innerWidth - toastWidth - 16));
    const top = Math.max(16, Math.min(rect.bottom + 8, window.innerHeight - toastHeight - 16));

    toast.style.left = `${left}px`;
    toast.style.top = `${top}px`;
    toast.style.right = "auto";
    toast.style.bottom = "auto";
  }

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.hidden = true;
  }, 3600);
}
