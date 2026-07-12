import { statusColor } from "../../components/progress-and-status.js?v=20260710-export-rich-kanban";
import {
  preferenceKeys,
  readJsonPreference,
  readNumberPreference,
  readPreference
} from "../../core/preferences.js?v=20260711-task-dialog-customize";
import { state } from "../../core/store.js";
import { appUrl } from "../../shared/app-urls.js";
import { createBugChartsView } from "../../shared/bug-charts.js?v=20260712-about-chart-gallery";
import { createDevTaskChartsView } from "../../shared/dev-task-charts.js?v=20260712-about-chart-gallery";

const ABOUT_VERSION = "20260712-about-3d-flyby-83";

export function createAboutFeature({
  app,
  getCurrentSprint,
  getItemStartDate,
  getSeverities,
  getStatuses
}) {
  let activeScene = null;
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

    app.innerHTML = `
      <section class="about-screen" aria-label="About PMT 3D logo experience" data-about-flight>
        <canvas
          class="about-flight-canvas"
          data-about-canvas
          tabindex="0"
          aria-label="Interactive 3D PMT logo with Dev Task and Bug Tracking chart galleries. Click for mouse look, use WASD to fly, use the mouse wheel to zoom, use plus or minus to change autopilot speed, press A during autopilot to toggle alien encounters, and press L to toggle random lightning strikes."
        ></canvas>
        <div class="about-flight-vignette" aria-hidden="true"></div>

        <div class="about-flight-intro" data-about-intro>
          <img class="about-intro-logo" src="${logoUrl}" alt="PMT - Project Management Tool">
          <p class="about-intro-countdown" data-about-intro-countdown aria-live="polite">
            3D flight begins in 3
          </p>
        </div>

        <div class="about-flight-hud">
          <p class="about-flight-status" data-about-status aria-live="polite">
            Preparing the 3D flight…
          </p>
          <p class="about-flight-controls">
            <span>Click / drag</span> look
            <span>WASD</span> fly
            <span>Wheel</span> zoom
            <span>Shift</span> boost
            <span>+ / -</span> speed
            <span>L</span> lightning
            <span>Esc</span> release mouse
          </p>
          <p class="about-flight-mode" data-about-mode>3D</p>
        </div>

        <p class="about-flight-debug" data-about-flight-debug aria-live="polite">
          Preparing 3D gallery
        </p>

        <div class="about-ufo-speech" data-about-ufo-speech role="status" hidden>
          Incoming transmission…
        </div>

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
    const debugElement = root.querySelector("[data-about-flight-debug]");
    const ufoSpeechElement = root.querySelector("[data-about-ufo-speech]");
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
          debugElement,
          ufoSpeechElement,
          alienNoticeElement,
          logoUrl,
          devCharts,
          bugCharts,
          users: state.users,
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
    app.classList.remove("app-shell-about");
  }

  return {
    render: renderAbout,
    deactivate
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
