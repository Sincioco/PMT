import { statusColor } from "../../components/progress-and-status.js?v=20260714-linked-bug-percent";
import {
  preferenceKeys,
  readBooleanPreference,
  readJsonPreference,
  readNumberPreference,
  readPreference
} from "../../core/preferences.js?v=20260711-task-dialog-customize";
import { state } from "../../core/store.js";
import { appUrl } from "../../shared/app-urls.js";
import { createBugChartsView } from "../../shared/bug-charts.js?v=20260714-linked-bug-percent";
import { createDevTaskChartsView } from "../../shared/dev-task-charts.js?v=20260714-linked-bug-percent";

const ABOUT_VERSION = "20260722-login-flyby-v1";
const ABOUT_CANVAS_ARIA_LABEL = "Interactive 3D PMT gallery. Hold the left mouse button to look while autopilot continues. Use the wheel to zoom, WASD plus Q and E for manual movement, Space to pause, Enter to restart, and question mark to show controls.";
const PMT_DEMO_PROJECT_ID = 10;
const PMT_DEMO_SPRINT_ONE_ID = 101;
const PMT_DEMO_SPRINT_TWO_ID = 102;
export const ABOUT_SCREEN_SAVER_IDLE_MS = 5 * 60 * 1000;
export const ABOUT_DATABASE_VERSION = "1.26";

export function aboutFooterHtml() {
  return `
    <footer class="about-footer" data-about-footer>
      <p class="about-database-version" data-about-database-version>PMT Database Version ${ABOUT_DATABASE_VERSION}</p>
      <p class="about-credit">
        Created by <a href="http://sincioco.com/resume" target="_blank" rel="noopener noreferrer">Louiery R. Sincioco</a> on June 2026 to help companies who need an open-source solution for a Project or Task Management Tool for free.
        Open-source GitHub repository is at <a href="https://github.com/Sincioco/PMT" target="_blank" rel="noopener noreferrer">https://github.com/Sincioco/PMT</a>
      </p>
    </footer>
  `;
}

function aboutFlightHtml({
  logoUrl,
  rootClass = "",
  rootAttributes = "",
  ariaLabel = "About PMT 3D logo experience",
  canvasTabIndex = "0",
  canvasAriaLabel = ABOUT_CANVAS_ARIA_LABEL,
  introCountdownText = "3D flight begins in 3",
  includeFooter = true
} = {}) {
  const className = ["about-screen", rootClass].filter(Boolean).join(" ");

  return `
      <section class="${className}" aria-label="${ariaLabel}" data-about-flight ${rootAttributes}>
        <canvas
          class="about-flight-canvas"
          data-about-canvas
          tabindex="${canvasTabIndex}"
          aria-label="${canvasAriaLabel}"
        ></canvas>
        <div class="about-flight-vignette" aria-hidden="true"></div>

        <div class="about-flight-intro" data-about-intro>
          <img class="about-intro-logo" src="${logoUrl}" alt="PMT - Project Management Tool">
          <p class="about-intro-countdown" data-about-intro-countdown aria-live="polite">
            ${introCountdownText}
          </p>
          ${includeFooter ? aboutFooterHtml() : ""}
        </div>

        <div class="about-flight-hud">
          <p class="about-flight-status" data-about-status aria-live="polite">
            Preparing the 3D flight&hellip;
          </p>
          <p class="about-flight-controls" aria-label="3D flight controls">
            <span class="about-flight-controls-title">Controls</span>
            <span class="about-control-hint"><kbd>Hold left mouse</kbd><span>Look around</span></span>
            <span class="about-control-hint"><kbd>Wheel</kbd><span>Zoom</span></span>
            <span class="about-control-hint"><kbd>WASD</kbd><span>Move</span></span>
            <span class="about-control-hint"><kbd>Q / E</kbd><span>Down / up</span></span>
            <span class="about-control-hint"><kbd>Shift</kbd><span>Manual boost</span></span>
            <span class="about-control-hint"><kbd>+ / -</kbd><span>Speed</span></span>
            <span class="about-control-hint"><kbd>Space</kbd><span>Pause / resume</span></span>
            <span class="about-control-hint"><kbd>Enter</kbd><span>Restart sequence</span></span>
            <span class="about-control-hint"><kbd>G</kbd><span>Pong + Blocks game</span></span>
            <span class="about-control-hint"><kbd>A</kbd><span>Alien + Lightning Strike</span></span>
            <span class="about-control-hint"><kbd>L</kbd><span>Lightning</span></span>
            <span class="about-control-hint"><kbd>C</kbd><span>Comet</span></span>
            <span class="about-control-hint"><kbd>U</kbd><span>UFO</span></span>
            <span class="about-control-hint"><kbd>M</kbd><span>Intergalactic battle</span></span>
            <span class="about-control-hint"><kbd>R</kbd><span>Random event</span></span>
            <span class="about-control-hint"><kbd>T</kbd><span>Track Alien Events on / off</span></span>
            <span class="about-control-hint"><kbd>0</kbd><span>Alien events on / off</span></span>
            <span class="about-control-hint"><kbd>P</kbd><span>PIP on / off</span></span>
            <span class="about-control-hint"><kbd>1</kbd><span>Original UFO</span></span>
            <span class="about-control-hint"><kbd>2</kbd><span>1 attacker vs UFO</span></span>
            <span class="about-control-hint"><kbd>3</kbd><span>2 attackers vs UFO</span></span>
            <span class="about-control-hint"><kbd>4</kbd><span>3 attackers vs UFO</span></span>
            <span class="about-control-hint"><kbd>?</kbd><span>Show these hints</span></span>
          </p>
          <button type="button" class="about-flight-mode" data-about-mode disabled>3D</button>
        </div>

        <button
          type="button"
          class="about-control-hints-trigger"
          data-about-control-hints-button
          aria-label="Show controls for five seconds"
          title="Show controls"
        >?</button>

        <p class="about-flight-debug" data-about-flight-debug aria-live="polite">
          Preparing 3D gallery
        </p>

        <div class="about-ufo-speech" data-about-ufo-speech role="status" hidden>
          Incoming transmission&hellip;
        </div>

        <div class="about-battle-pip" data-about-battle-pip aria-label="Intergalactic battle picture in picture" hidden>
          <span>PMT Defense Feed</span>
        </div>

        <div class="about-battle-dialogue" data-about-battle-dialogue role="status" aria-live="polite" hidden></div>

        <div class="about-alien-toggle-notice" data-about-alien-notice role="status" aria-live="polite" hidden></div>

        <p class="about-flight-fallback" data-about-fallback hidden></p>
      </section>
    `;
}

function aboutSceneElements(root) {
  return {
    root,
    canvas: root.querySelector("[data-about-canvas]"),
    introElement: root.querySelector("[data-about-intro]"),
    introCountdownElement: root.querySelector("[data-about-intro-countdown]"),
    statusElement: root.querySelector("[data-about-status]"),
    modeElement: root.querySelector("[data-about-mode]"),
    controlHintsTriggerElement: root.querySelector("[data-about-control-hints-button]"),
    debugElement: root.querySelector("[data-about-flight-debug]"),
    ufoSpeechElement: root.querySelector("[data-about-ufo-speech]"),
    battlePictureInPictureElement: root.querySelector("[data-about-battle-pip]"),
    battleDialogueElement: root.querySelector("[data-about-battle-dialogue]"),
    alienNoticeElement: root.querySelector("[data-about-alien-notice]")
  };
}

export function createPmtDemoFlybyData() {
  const projects = [{
    id: PMT_DEMO_PROJECT_ID,
    code: "PMT",
    title: "Project Management Tool",
    name: "PMT Demo Project",
    description: "A portable PMT demo project used for the login 3D flyby."
  }];
  const sprints = [
    { id: PMT_DEMO_SPRINT_ONE_ID, projectId: PMT_DEMO_PROJECT_ID, code: "PMT-Sprint1", title: "Foundation", startDate: "2026-06-01" },
    { id: PMT_DEMO_SPRINT_TWO_ID, projectId: PMT_DEMO_PROJECT_ID, code: "PMT-Sprint2", title: "Polish", startDate: "2026-07-01" }
  ];
  const users = [
    { id: 1, nickname: "PMT Admin", fullName: "PMT Administrator", roleName: "Product Owner" },
    { id: 2, nickname: "PMT Dev", fullName: "PMT Developer", roleName: "Developer" },
    { id: 3, nickname: "PMT QA", fullName: "PMT QA", roleName: "QA" }
  ];
  const statuses = ["Backlog", "Todo", "In Progress", "Ready for QA", "QA Passed", "Deployed in Prod"];
  const severities = ["Trivial", "Minor", "Major", "Critical"];
  const tasks = [
    { id: 1, projectId: PMT_DEMO_PROJECT_ID, sprintId: PMT_DEMO_SPRINT_ONE_ID, taskType: "Dev Task", code: "PMT-101", title: "Create Projects, Sprints, and Dev Tasks", status: "QA Passed", priority: "High", percentCompleted: 100, assigneeIds: [1, 2], createdAt: "2026-06-04", updatedAt: "2026-06-18" },
    { id: 2, projectId: PMT_DEMO_PROJECT_ID, sprintId: PMT_DEMO_SPRINT_TWO_ID, taskType: "Dev Task", code: "PMT-204", title: "Polish Documentation and Diagram UX", status: "In Progress", priority: "High", percentCompleted: 65, assigneeIds: [2], createdAt: "2026-07-05", updatedAt: "2026-07-21" },
    { id: 3, projectId: PMT_DEMO_PROJECT_ID, sprintId: PMT_DEMO_SPRINT_TWO_ID, taskType: "Dev Task", code: "PMT-218", title: "Prepare Deployment Migration Script", status: "Ready for QA", priority: "Medium", percentCompleted: 85, assigneeIds: [2, 3], createdAt: "2026-07-12", updatedAt: "2026-07-21" },
    { id: 4, projectId: PMT_DEMO_PROJECT_ID, sprintId: PMT_DEMO_SPRINT_TWO_ID, taskType: "Dev Task", code: "PMT-230", title: "Review Release Notes and What's New", status: "Todo", priority: "Medium", percentCompleted: 0, assigneeIds: [1], createdAt: "2026-07-18", updatedAt: "2026-07-18" },
    { id: 11, projectId: PMT_DEMO_PROJECT_ID, sprintId: PMT_DEMO_SPRINT_ONE_ID, taskType: "Bug", code: "PMT-BUG-014", title: "Fix linked diagram viewer rendering", status: "QA Passed", severity: "Major", priority: "High", percentCompleted: 100, assigneeIds: [2, 3], createdAt: "2026-06-20", updatedAt: "2026-07-15" },
    { id: 12, projectId: PMT_DEMO_PROJECT_ID, sprintId: PMT_DEMO_SPRINT_TWO_ID, taskType: "Bug", code: "PMT-BUG-027", title: "Tighten rich text code block actions", status: "In Progress", severity: "Critical", priority: "High", percentCompleted: 50, assigneeIds: [2], createdAt: "2026-07-14", updatedAt: "2026-07-21" },
    { id: 13, projectId: PMT_DEMO_PROJECT_ID, sprintId: PMT_DEMO_SPRINT_TWO_ID, taskType: "Bug", code: "PMT-BUG-031", title: "Align Diagram field controls", status: "Todo", severity: "Minor", priority: "Low", percentCompleted: 0, assigneeIds: [3], createdAt: "2026-07-19", updatedAt: "2026-07-19" }
  ];
  const blogs = [
    {
      id: 201,
      projectId: PMT_DEMO_PROJECT_ID,
      title: "PMT Quick Start",
      bodyHtml: "<p>Use Projects, Sprints, Dev Tasks, Bug Tracking, Scrum, Documentation, and Diagrams together in one PMT workspace.</p>",
      isPrivate: false,
      createdByUserId: 1,
      createdAt: "2026-07-01",
      updatedAt: "2026-07-21",
      history: [{ action: "Updated", userId: 2 }]
    },
    {
      id: 202,
      projectId: PMT_DEMO_PROJECT_ID,
      title: "Diagramming PMT Data",
      bodyHtml: "<p>PMT diagrams can capture database relationships, tutorial layouts, and rich-text notes for implementation handoff.</p>",
      isPrivate: false,
      createdByUserId: 2,
      createdAt: "2026-07-10",
      updatedAt: "2026-07-20",
      history: [{ action: "Updated", userId: 3 }]
    }
  ];

  return { projects, sprints, users, statuses, severities, tasks, blogs };
}

export function createAboutAuthFlyby({ host }) {
  let activeScene = null;
  let renderGeneration = 0;

  function render() {
    deactivate();
    if (!host) return;

    const generation = renderGeneration;
    const logoUrl = appUrl(`/assets/pmt-logo-full.svg?v=${ABOUT_VERSION}`);
    const demo = createPmtDemoFlybyData();
    const currentSprint = items => [...items]
      .sort((left, right) => String(left.startDate || "").localeCompare(String(right.startDate || "")))
      .at(-1) || null;
    const itemStartDate = item => new Date(item?.startDate || 0);
    const devCharts = createDevTaskChartsView({
      users: demo.users,
      projects: demo.projects,
      sprints: demo.sprints,
      tasks: demo.tasks,
      projectId: PMT_DEMO_PROJECT_ID,
      sprintMode: "all",
      getCurrentSprint: currentSprint,
      getItemStartDate: itemStartDate,
      statuses: demo.statuses,
      getStatusColor: statusColor
    });
    const bugCharts = createBugChartsView({
      projects: demo.projects,
      sprints: demo.sprints,
      tasks: demo.tasks,
      filters: { projectId: PMT_DEMO_PROJECT_ID, sprintId: "all" },
      severities: demo.severities,
      getCurrentSprint: currentSprint,
      getItemStartDate: itemStartDate
    });

    host.innerHTML = aboutFlightHtml({
      logoUrl,
      rootClass: "about-auth-flyby-screen",
      rootAttributes: 'data-about-auth-flyby="true" aria-hidden="true"',
      ariaLabel: "PMT 3D flyby background",
      canvasTabIndex: "-1",
      canvasAriaLabel: "PMT 3D flyby background",
      introCountdownText: "",
      includeFooter: false
    });

    const root = host.querySelector("[data-about-flight]");
    if (!root) return;

    void import(`./about-scene.js?v=${ABOUT_VERSION}`)
      .then(({ createAboutScene }) => {
        if (generation !== renderGeneration || !root.isConnected) return;

        const scene = createAboutScene({
          ...aboutSceneElements(root),
          logoUrl,
          devCharts,
          bugCharts,
          blogs: demo.blogs,
          projects: demo.projects,
          tasks: demo.tasks,
          statuses: demo.statuses,
          omitEmptyKanbanColumns: true,
          kanbanWebShowsAllColumns: false,
          getStatusColor: statusColor,
          users: demo.users,
          introDurationMs: 0,
          introFadeDurationMs: 0,
          onFailure: message => showFallback(root, message)
        });

        if (generation !== renderGeneration || !root.isConnected) {
          scene.dispose();
          return;
        }

        activeScene = scene;
      })
      .catch(() => {
        if (generation === renderGeneration && root.isConnected) {
          showFallback(root, "3D rendering is unavailable. The original PMT logo is shown instead.");
        }
      });
  }

  function deactivate() {
    renderGeneration += 1;
    activeScene?.dispose();
    activeScene = null;
    if (host) host.innerHTML = "";
  }

  return { render, deactivate };
}

export function createAboutFeature({
  app,
  getCurrentSprint,
  getItemStartDate,
  getSeverities,
  getStatuses
}) {
  let activeScene = null;
  let activePong = null;
  let renderGeneration = 0;

  function renderAbout() {
    deactivate();
    app.classList.add("app-shell-about");
    const generation = renderGeneration;
    const logoUrl = appUrl(`/assets/pmt-logo-full.svg?v=${ABOUT_VERSION}`);
    const devCharts = createDevTaskChartsView({
      users: state.users,
      projects: state.projects,
      sprints: state.sprints,
      tasks: state.tasks,
      projectId: readNumberPreference(preferenceKeys.taskProject, 0),
      sprintMode: readPreference(preferenceKeys.taskSprint, "all"),
      getCurrentSprint,
      getItemStartDate,
      statuses: getStatuses(),
      getStatusColor: statusColor
    });
    const bugCharts = createBugChartsView({
      projects: state.projects,
      sprints: state.sprints,
      tasks: state.tasks,
      filters: readJsonPreference(preferenceKeys.bugFilters, {}),
      severities: getSeverities(),
      getCurrentSprint,
      getItemStartDate
    });
    const statuses = getStatuses();
    const kanbanBoard = currentKanbanBoard({
      tasks: state.tasks,
      projects: state.projects,
      sprints: state.sprints,
      statuses
    });

    app.innerHTML = `
      <section class="about-screen" aria-label="About PMT 3D logo experience" data-about-flight>
        <canvas
          class="about-flight-canvas"
          data-about-canvas
          tabindex="0"
          aria-label="Interactive 3D PMT gallery. Hold the left mouse button to look while autopilot continues. Use the wheel to zoom, WASD plus Q and E for manual movement, Space to pause, Enter to restart, and question mark to show controls."
        ></canvas>
        <div class="about-flight-vignette" aria-hidden="true"></div>

        <div class="about-flight-intro" data-about-intro>
          <img class="about-intro-logo" src="${logoUrl}" alt="PMT - Project Management Tool">
          <p class="about-intro-countdown" data-about-intro-countdown aria-live="polite">
            3D flight begins in 3
          </p>
          ${aboutFooterHtml()}
        </div>

        <div class="about-flight-hud">
          <p class="about-flight-status" data-about-status aria-live="polite">
            Preparing the 3D flight…
          </p>
          <p class="about-flight-controls" aria-label="3D flight controls">
            <span class="about-flight-controls-title">Controls</span>
            <span class="about-control-hint"><kbd>Hold left mouse</kbd><span>Look around</span></span>
            <span class="about-control-hint"><kbd>Wheel</kbd><span>Zoom</span></span>
            <span class="about-control-hint"><kbd>WASD</kbd><span>Move</span></span>
            <span class="about-control-hint"><kbd>Q / E</kbd><span>Down / up</span></span>
            <span class="about-control-hint"><kbd>Shift</kbd><span>Manual boost</span></span>
            <span class="about-control-hint"><kbd>+ / -</kbd><span>Speed</span></span>
            <span class="about-control-hint"><kbd>Space</kbd><span>Pause / resume</span></span>
            <span class="about-control-hint"><kbd>Enter</kbd><span>Restart sequence</span></span>
            <span class="about-control-hint"><kbd>G</kbd><span>Pong + Blocks game</span></span>
            <span class="about-control-hint"><kbd>A</kbd><span>Alien + Lightning Strike</span></span>
            <span class="about-control-hint"><kbd>L</kbd><span>Lightning</span></span>
            <span class="about-control-hint"><kbd>C</kbd><span>Comet</span></span>
            <span class="about-control-hint"><kbd>U</kbd><span>UFO</span></span>
            <span class="about-control-hint"><kbd>M</kbd><span>Intergalactic battle</span></span>
            <span class="about-control-hint"><kbd>R</kbd><span>Random event</span></span>
            <span class="about-control-hint"><kbd>T</kbd><span>Track Alien Events on / off</span></span>
            <span class="about-control-hint"><kbd>0</kbd><span>Alien events on / off</span></span>
            <span class="about-control-hint"><kbd>P</kbd><span>PIP on / off</span></span>
            <span class="about-control-hint"><kbd>1</kbd><span>Original UFO</span></span>
            <span class="about-control-hint"><kbd>2</kbd><span>1 attacker vs UFO</span></span>
            <span class="about-control-hint"><kbd>3</kbd><span>2 attackers vs UFO</span></span>
            <span class="about-control-hint"><kbd>4</kbd><span>3 attackers vs UFO</span></span>
            <span class="about-control-hint"><kbd>?</kbd><span>Show these hints</span></span>
          </p>
          <button type="button" class="about-flight-mode" data-about-mode disabled>3D</button>
        </div>

        <button
          type="button"
          class="about-control-hints-trigger"
          data-about-control-hints-button
          aria-label="Show controls for five seconds"
          title="Show controls"
        >?</button>

        <p class="about-flight-debug" data-about-flight-debug aria-live="polite">
          Preparing 3D gallery
        </p>

        <div class="about-ufo-speech" data-about-ufo-speech role="status" hidden>
          Incoming transmission…
        </div>

        <div class="about-battle-pip" data-about-battle-pip aria-label="Intergalactic battle picture in picture" hidden>
          <span>PMT Defense Feed</span>
        </div>

        <div class="about-battle-dialogue" data-about-battle-dialogue role="status" aria-live="polite" hidden></div>

        <div class="about-alien-toggle-notice" data-about-alien-notice role="status" aria-live="polite" hidden></div>

        <p class="about-flight-fallback" data-about-fallback hidden></p>
      </section>
    `;

    const root = app.querySelector("[data-about-flight]");
    const canvas = root.querySelector("[data-about-canvas]");
    const introElement = root.querySelector("[data-about-intro]");
    const introCountdownElement = root.querySelector("[data-about-intro-countdown]");
    const statusElement = root.querySelector("[data-about-status]");
    const modeElement = root.querySelector("[data-about-mode]");
    const controlHintsTriggerElement = root.querySelector("[data-about-control-hints-button]");
    const debugElement = root.querySelector("[data-about-flight-debug]");
    const ufoSpeechElement = root.querySelector("[data-about-ufo-speech]");
    const battlePictureInPictureElement = root.querySelector("[data-about-battle-pip]");
    const battleDialogueElement = root.querySelector("[data-about-battle-dialogue]");
    const alienNoticeElement = root.querySelector("[data-about-alien-notice]");

    void import(`./about-scene.js?v=${ABOUT_VERSION}`)
      .then(({ createAboutScene }) => {
        if (generation !== renderGeneration || !root.isConnected) return;

        const scene = createAboutScene({
          root,
          canvas,
          introElement,
          introCountdownElement,
          statusElement,
          modeElement,
          controlHintsTriggerElement,
          debugElement,
          ufoSpeechElement,
          battlePictureInPictureElement,
          battleDialogueElement,
          alienNoticeElement,
          logoUrl,
          devCharts,
          bugCharts,
          blogs: state.blogs,
          projects: state.projects,
          tasks: kanbanBoard.tasks,
          statuses,
          omitEmptyKanbanColumns: kanbanBoard.omitEmptyColumns,
          kanbanWebShowsAllColumns: kanbanBoard.webShowsAllColumns,
          getStatusColor: statusColor,
          users: state.users,
          onPongRequested: () => startPongScene(generation),
          onFailure: message => showFallback(root, message)
        });

        if (generation !== renderGeneration || !root.isConnected) {
          scene.dispose();
          return;
        }

        activeScene = scene;
      })
      .catch(() => {
        if (generation === renderGeneration && root.isConnected) {
          showFallback(root, "3D rendering is unavailable. The original PMT logo is shown instead.");
        }
      });
  }

  function deactivate() {
    renderGeneration += 1;
    activeScene?.dispose();
    activeScene = null;
    activePong?.dispose();
    activePong = null;
    app.classList.remove("app-shell-about");
  }

  function startPongScene(expectedGeneration) {
    if (expectedGeneration !== renderGeneration) return;
    renderGeneration += 1;
    activeScene?.dispose();
    activeScene = null;
    activePong?.dispose();
    activePong = null;

    app.classList.add("app-shell-about");
    app.innerHTML = `
      <section
        class="about-screen about-pong-screen"
        aria-label="Pong + Blocks + Aliens"
        data-about-pong-root
      ></section>
    `;

    const root = app.querySelector("[data-about-pong-root]");
    const generation = renderGeneration;
    Promise.all([
      import("../../vendor/three/three.module.min.js"),
      import(`./about-pong.js?v=${ABOUT_VERSION}`)
    ])
      .then(([THREE, { createAboutPongGame }]) => {
        if (generation !== renderGeneration || !root?.isConnected) return;
        const game = createAboutPongGame({
          root,
          THREE,
          standalone: true,
          allowClose: false,
          onExit: () => {
            if (generation === renderGeneration) renderAbout();
          }
        });
        activePong = game;
        game.open();
      })
      .catch(() => {
        if (generation === renderGeneration && root?.isConnected) {
          root.innerHTML = `
            <p class="about-flight-fallback">
              Pong is unavailable. The aliens deny responsibility, which is suspicious.
            </p>
          `;
        }
      });
  }

  return {
    render: renderAbout,
    deactivate
  };
}

export function createAboutScreenSaver({ app, createFeature, canActivate }) {
  let active = null;
  let idleTimer = 0;
  let initialized = false;

  function initialize() {
    if (initialized) return;
    initialized = true;

    document.addEventListener("mousemove", handleActivity, true);
    document.addEventListener("mousedown", handleActivity, true);
    document.addEventListener("keydown", handleActivity, true);
    document.addEventListener("touchstart", handleActivity, { capture: true, passive: true });
    document.addEventListener("wheel", handleActivity, { capture: true, passive: true });
    document.addEventListener("visibilitychange", handleForegroundChange);
    window.addEventListener("focus", handleForegroundChange);
    window.addEventListener("blur", handleForegroundChange);
    schedule();
  }

  function handleActivity(event) {
    if (active) {
      if (event.type === "mousemove") dismiss();
      return;
    }

    schedule();
  }

  function handleForegroundChange() {
    if (!isForeground()) {
      window.clearTimeout(idleTimer);
      idleTimer = 0;
      dismiss(false);
      return;
    }

    schedule();
  }

  function schedule() {
    window.clearTimeout(idleTimer);
    idleTimer = 0;
    if (active || !isForeground()) return;

    idleTimer = window.setTimeout(show, ABOUT_SCREEN_SAVER_IDLE_MS);
  }

  function show() {
    idleTimer = 0;
    if (!isForeground()) return;
    if (!canActivate()) {
      schedule();
      return;
    }

    const previousFocus = document.activeElement;
    const dialog = document.createElement("dialog");
    dialog.className = "app-shell about-screensaver-dialog";
    dialog.dataset.aboutScreensaver = "";
    dialog.dataset.aboutScreensaverIdleMs = String(ABOUT_SCREEN_SAVER_IDLE_MS);
    dialog.setAttribute("aria-label", "PMT 3D screen saver");
    syncBounds(dialog);
    document.body.appendChild(dialog);

    try {
      dialog.showModal();
    } catch {
      dialog.remove();
      schedule();
      return;
    }

    const feature = createFeature(dialog);
    active = { dialog, feature, previousFocus };
    dialog.addEventListener("cancel", handleCancel);
    window.addEventListener("resize", handleResize);
    feature.render();
  }

  function dismiss(rearm = true) {
    if (!active) return;

    const { dialog, feature, previousFocus } = active;
    active = null;
    feature.deactivate();
    dialog.removeEventListener("cancel", handleCancel);
    window.removeEventListener("resize", handleResize);
    if (dialog.open) dialog.close();
    dialog.remove();

    if (isForeground() && previousFocus?.isConnected) {
      previousFocus.focus({ preventScroll: true });
    }
    if (rearm) schedule();
  }

  function handleCancel(event) {
    event.preventDefault();
    dismiss();
  }

  function handleResize() {
    if (active) syncBounds(active.dialog);
  }

  function syncBounds(dialog) {
    const bounds = app.getBoundingClientRect();
    dialog.style.left = `${bounds.left}px`;
    dialog.style.top = `${bounds.top}px`;
    dialog.style.width = `${bounds.width}px`;
    dialog.style.height = `${bounds.height}px`;
  }

  function isForeground() {
    return document.visibilityState === "visible" && document.hasFocus();
  }

  return { initialize, dismiss };
}

function currentKanbanBoard({ tasks, projects, sprints, statuses }) {
  const preferredProjectId = readNumberPreference(preferenceKeys.boardProject, 0);
  const projectId = preferredProjectId || Number(projects[0]?.id || 0);
  const sprintMode = readPreference(preferenceKeys.boardSprint, "latest");
  const sprintId = sprintMode === "all"
    ? 0
    : sprintMode === "latest"
      ? Number([...sprints]
        .filter(sprint => Number(sprint.projectId) === projectId)
        .sort((left, right) => new Date(right.startDate) - new Date(left.startDate))[0]?.id || 0)
      : Number(sprintMode || 0);
  const savedStatuses = readJsonPreference(preferenceKeys.boardStatuses, null);
  const visibleStatuses = Array.isArray(savedStatuses)
    && savedStatuses.every(status => statuses.includes(status))
    ? savedStatuses
    : statuses;
  const boardHidesEmptyColumns = readBooleanPreference(
    preferenceKeys.boardHideEmptyColumns,
    true
  );
  const webShowsAllColumns = !boardHidesEmptyColumns
    && visibleStatuses.length === statuses.length
    && statuses.every(status => visibleStatuses.includes(status));
  const selectedUsers = new Set(
    (readJsonPreference(preferenceKeys.boardUsers, []) || []).map(String)
  );

  const visibleTasks = tasks
    .filter(task => !projectId || Number(task.projectId) === projectId)
    .filter(task => !sprintId || Number(task.sprintId) === sprintId)
    .filter(task => visibleStatuses.includes(task.status))
    .filter(task => !selectedUsers.size
      || (task.assigneeIds || []).some(userId => selectedUsers.has(String(userId))));

  return {
    tasks: visibleTasks,
    webShowsAllColumns,
    // 3D space is intentionally compact: even when the web board shows every
    // configured column, the gallery never allocates geometry to empty ones.
    omitEmptyColumns: boardHidesEmptyColumns || webShowsAllColumns
  };
}

function showFallback(root, message) {
  root.classList.remove("about-flight-rendering", "about-flight-started");
  root.classList.add("about-flight-is-fallback");

  const intro = root.querySelector("[data-about-intro]");
  const countdown = root.querySelector("[data-about-intro-countdown]");
  const fallback = root.querySelector("[data-about-fallback]");
  const status = root.querySelector("[data-about-status]");
  const mode = root.querySelector("[data-about-mode]");
  intro.hidden = false;
  intro.removeAttribute("aria-hidden");
  countdown.hidden = true;
  fallback.hidden = false;
  fallback.textContent = message;
  status.textContent = "3D unavailable • SVG fallback";
  mode.textContent = "SVG";
}
