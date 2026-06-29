import {
  preferenceKeys,
  readBooleanPreference,
  readNumberPreference,
  readPreference,
  writePreference
} from "../../core/preferences.js";
import { buttonContent } from "../../components/buttons.js";
import { navigate } from "../../core/router.js";
import { state } from "../../core/store.js";
import { projectById } from "../../shared/selectors.js";
import { createGanttBugExpansion } from "./gantt-bugs-dependencies.js?v=20260627-dev-task-status-rules";
import {
  currentSprintForProject,
  ganttChartData,
  selectedGanttSprint,
  sortGanttSprintOptions,
  sortGanttSprints
} from "./gantt-calculations.js?v=20260620-gantt-scaled-buffer";
import { createGanttFlyBy } from "./gantt-flyby.js?v=20260627-gantt-initial-desc-offset";
import {
  ganttFilterFieldsHtml,
  ganttScreenHtml
} from "./gantt-rendering.js?v=20260629-sort-dropdown-labels";

export { currentSprintForProject, ganttStartDate } from "./gantt-calculations.js?v=20260620-gantt-scaled-buffer";

export function createGanttFeature({
  app,
  openTaskReadMode,
  render,
  showToast
}) {
  let ganttProjectId = readNumberPreference(preferenceKeys.ganttProject, 0);
  let ganttSprintMode = readPreference(preferenceKeys.ganttSprint, "current");
  let ganttRenderMode = readPreference(preferenceKeys.ganttRenderMode, "all");
  let ganttSort = readPreference(preferenceKeys.ganttSort, "startDesc");
  let ganttShowNonWorkingDays = readBooleanPreference(preferenceKeys.ganttShowNonWorkingDays, false);
  let ganttShowAllBugs = false;
  let activeChart = null;
  let activeProjectSprints = [];
  let activeSelectedSprint = null;

  const bugExpansion = createGanttBugExpansion();
  const flyBy = createGanttFlyBy({
    showToast: message => showToast(message, document.querySelector("[data-action='gantt-flyby']"))
  });

  function renderGantt(options = {}) {
    if (!flyBy.hasPending() && !options.skipStopFlyBy) flyBy.stop();

    if (!ganttProjectId && state.projects.length) ganttProjectId = state.projects[0].id;
    if (!state.projects.some(project => project.id === ganttProjectId) && state.projects.length) ganttProjectId = state.projects[0].id;

    const project = projectById(ganttProjectId) || state.projects[0];
    const projectSprints = sortGanttSprints(state.sprints.filter(sprint => sprint.projectId === project?.id), ganttSort);
    if (ganttSprintMode === "all") {
      ganttRenderMode = "all";
      writePreference(preferenceKeys.ganttRenderMode, ganttRenderMode);
    }
    if (ganttSprintMode !== "all" && ganttSprintMode !== "current" && !projectSprints.some(sprint => sprint.id === Number(ganttSprintMode))) {
      ganttSprintMode = "current";
      writePreference(preferenceKeys.ganttSprint, ganttSprintMode);
    }

    const selectedSprint = selectedGanttSprint(projectSprints, ganttSprintMode);
    const sprintOptions = sortGanttSprintOptions(projectSprints);
    const visibleSprints = ganttRenderMode === "selected" && selectedSprint ? [selectedSprint] : projectSprints;
    const scrollSprint = selectedSprint || currentSprintForProject(projectSprints);
    const singleSprint = ganttRenderMode === "selected" ? selectedSprint : null;
    const chart = ganttChartData({
      project,
      sprints: visibleSprints,
      selectedSprint: singleSprint,
      scrollSprint,
      showNonWorkingDays: ganttShowNonWorkingDays,
      tasks: state.tasks,
      holidays: state.holidays,
      availableTimelineWidth: ganttAvailableTimelineWidth()
    });
    activeChart = chart;
    activeProjectSprints = projectSprints;
    activeSelectedSprint = selectedSprint;

    app.innerHTML = ganttScreenHtml({
      projects: state.projects,
      projectId: ganttProjectId,
      sprintMode: ganttSprintMode,
      sort: ganttSort,
      renderMode: ganttRenderMode,
      showNonWorkingDays: ganttShowNonWorkingDays,
      showAllBugs: ganttShowAllBugs,
      isTaskExpanded: bugExpansion.has,
      sprintOptions,
      chart,
      tasks: state.tasks,
      flyBy: flyBy.state()
    });

    if (options.restoreScroll) {
      flyBy.restoreScroll(options.restoreScroll);
    } else {
      flyBy.scrollToSprintStart(chart, scrollSprint, ganttRenderMode, ganttSort === "startDesc" ? 1 : 0);
    }

    flyBy.runPending(chart, startingFlyBySprint);
    bindGanttWheelFlyBy(chart, selectedSprint, projectSprints);
  }

  function handleAction(action, id) {
    if (action === "gantt-open-task") {
      openTaskReadMode(id);
      return true;
    }
    if (action === "open-gantt-filters" || action === "toggle-gantt-filters") {
      openGanttFiltersDialog();
      return true;
    }
    if (action === "toggle-gantt-all-bugs") {
      toggleAllBugs();
      return true;
    }
    if (action === "toggle-gantt-render-mode") {
      toggleRenderMode();
      return true;
    }
    if (action === "toggle-gantt-days") {
      toggleDays();
      return true;
    }
    if (action === "gantt-flyby") {
      flyByGantt();
      return true;
    }
    if (action === "reset-gantt-view") {
      resetView();
      return true;
    }
    if (action === "toggle-gantt-task-bugs") {
      toggleTaskBugs(id);
      return true;
    }
    return false;
  }

  function openGanttFiltersDialog() {
    const existingDialog = document.querySelector("[data-gantt-filter-dialog]");
    if (existingDialog) {
      if (!existingDialog.open) existingDialog.showModal?.();
      existingDialog.querySelector("[data-filter='gantt-project']")?.focus({ preventScroll: true });
      return;
    }

    const modal = document.createElement("dialog");
    modal.className = "dialog task-filter-dialog gantt-filter-dialog";
    modal.dataset.ganttFilterDialog = "true";
    modal.innerHTML = `
      <form method="dialog">
        <div class="dialog-head">
          <h2>Gantt Filters</h2>
          <button type="button" class="icon-btn" data-close-gantt-filters title="Close" aria-label="Close">x</button>
        </div>
        <div class="dialog-body task-filter-dialog-body gantt-filter-dialog-body" data-gantt-filter-dialog-body></div>
        <div class="dialog-actions">
          <button type="button" class="primary text-icon-button" data-close-gantt-filters>${buttonContent("&#10003;", "Done")}</button>
        </div>
      </form>
    `;

    renderGanttFiltersDialog(modal);
    document.body.appendChild(modal);
    modal.addEventListener("change", event => {
      const target = event.target;
      const filter = target?.dataset?.filter || "";
      if (!handleFilterChange(target)) return;

      if (filter === "gantt-project") {
        renderGanttFiltersDialog(modal);
        modal.querySelector("[data-filter='gantt-project']")?.focus({ preventScroll: true });
      }
    });
    modal.addEventListener("click", event => {
      if (event.target.closest("[data-close-gantt-filters]")) modal.close();
    });
    modal.addEventListener("close", () => modal.remove());
    modal.showModal();
    modal.querySelector("[data-filter='gantt-project']")?.focus({ preventScroll: true });
  }

  function renderGanttFiltersDialog(modal) {
    const body = modal.querySelector("[data-gantt-filter-dialog-body]");
    if (body) body.innerHTML = ganttFilterFieldsHtml(ganttFilterState());
  }

  function ganttFilterState() {
    return {
      projects: state.projects,
      projectId: ganttProjectId,
      sprintMode: ganttSprintMode,
      sort: ganttSort,
      sprintOptions: sortGanttSprintOptions(activeProjectSprints),
      showAllBugs: ganttShowAllBugs
    };
  }

  function handleFilterChange(eventOrTarget) {
    const target = eventOrTarget?.target || eventOrTarget;

    if (target.dataset.filter === "gantt-project") {
      ganttProjectId = Number(target.value);
      ganttSprintMode = "current";
      writePreference(preferenceKeys.ganttProject, ganttProjectId);
      writePreference(preferenceKeys.ganttSprint, ganttSprintMode);
      bugExpansion.clear();
      renderGantt();
      return true;
    }
    if (target.dataset.filter === "gantt-sprint") {
      ganttSprintMode = target.value;
      if (ganttSprintMode === "all") {
        ganttRenderMode = "all";
        writePreference(preferenceKeys.ganttRenderMode, ganttRenderMode);
      }
      writePreference(preferenceKeys.ganttSprint, ganttSprintMode);
      bugExpansion.clear();
      renderGantt();
      return true;
    }
    if (target.dataset.filter === "gantt-sort") {
      ganttSort = target.value;
      writePreference(preferenceKeys.ganttSort, ganttSort);
      renderGantt();
      return true;
    }
    if (target.dataset.filter === "gantt-show-all-bugs") {
      ganttShowAllBugs = target.checked;
      bugExpansion.clear();
      renderGantt();
      return true;
    }
    return false;
  }

  function openProject(projectId) {
    ganttProjectId = projectId;
    ganttSprintMode = "current";
    navigate("Gantt");
    writePreference(preferenceKeys.ganttProject, ganttProjectId);
    writePreference(preferenceKeys.ganttSprint, ganttSprintMode);
    render();
  }

  function flyByGantt() {
    if (flyBy.isActive()) {
      flyBy.pause();
      return;
    }
    if (flyBy.isBusy()) return;

    const direction = flyBySequenceDirection();
    const startSprint = flyByStartSprint(activeSelectedSprint, activeProjectSprints, direction);
    const isResuming = flyBy.hasResumeSprint();
    flyBy.stop({ keepResume: isResuming });

    if (!canAnimateRenderedSprints(activeChart, activeProjectSprints)) {
      ganttRenderMode = "all";
      flyBy.startPending(direction, startSprint?.id);
      saveViewSettings();
      bugExpansion.clear();
      renderGantt();
      return;
    }

    flyBy.flyThroughSprints(activeChart, direction, startSprint);
  }

  function bindGanttWheelFlyBy(chart, selectedSprint, projectSprints) {
    const scroller = app.querySelector(".gantt-scroll");
    if (!scroller) return;

    scroller.addEventListener("wheel", event => {
      const direction = wheelFlyByDirection(event);
      if (!direction) return;

      event.preventDefault();
      if (flyBy.isBusy()) return;

      const startSprint = flyByStartSprint(selectedSprint, projectSprints, direction);
      if (!startSprint) return;

      if (!canAnimateRenderedSprints(chart, projectSprints)) {
        ganttRenderMode = "all";
        flyBy.startAdjacentPending(direction, startSprint.id);
        saveViewSettings();
        renderGantt();
        return;
      }

      flyBy.flyToAdjacentSprint(chart, direction, startSprint);
    }, { passive: false });
  }

  function wheelFlyByDirection(event) {
    if (event.deltaY > 0) return 1;
    if (event.deltaY < 0) return -1;
    return 0;
  }

  function flyBySequenceDirection() {
    return ganttSort === "startAsc" ? -1 : 1;
  }

  function flyByStartSprint(selectedSprint, projectSprints, direction) {
    const currentSprintId = flyBy.getCurrentSprintId();
    const scrollSprintId = flyBy.nearestSprintIdFromScroll(direction);
    return projectSprints.find(sprint => sprint.id === currentSprintId)
      || projectSprints.find(sprint => sprint.id === scrollSprintId)
      || selectedSprint
      || currentSprintForProject(projectSprints);
  }

  function canAnimateRenderedSprints(chart, projectSprints) {
    return ganttRenderMode === "all"
      && chart?.sprints?.length
      && chart.sprints.length === projectSprints.length;
  }

  function startingFlyBySprint(sprints) {
    return selectedGanttSprint(sprints, ganttSprintMode)
      || currentSprintForProject(sprints);
  }

  function toggleRenderMode() {
    ganttRenderMode = ganttRenderMode === "selected" ? "all" : "selected";
    if (ganttRenderMode === "all") {
      ganttSprintMode = "all";
    } else if (ganttSprintMode === "all") {
      ganttSprintMode = "current";
    }
    writePreference(preferenceKeys.ganttSprint, ganttSprintMode);
    writePreference(preferenceKeys.ganttRenderMode, ganttRenderMode);
    bugExpansion.clear();
    renderGantt();
  }

  function toggleDays() {
    ganttShowNonWorkingDays = !ganttShowNonWorkingDays;
    writePreference(preferenceKeys.ganttShowNonWorkingDays, ganttShowNonWorkingDays);
    renderGantt();
  }

  function resetView() {
    flyBy.stop();
    applyResetPreset();
    bugExpansion.clear();
    renderGantt();
  }

  function applyResetPreset() {
    ganttSprintMode = "current";
    ganttSort = "startDesc";
    ganttRenderMode = "selected";
    saveViewSettings();
  }

  function saveViewSettings() {
    writePreference(preferenceKeys.ganttSprint, ganttSprintMode);
    writePreference(preferenceKeys.ganttSort, ganttSort);
    writePreference(preferenceKeys.ganttRenderMode, ganttRenderMode);
  }

  function toggleAllBugs() {
    ganttShowAllBugs = !ganttShowAllBugs;
    bugExpansion.clear();
    renderGantt();
  }

  function toggleTaskBugs(taskId) {
    const scrollPosition = flyBy.captureScrollPosition();
    const resumeSprintId = flyBy.nearestSprintIdFromScroll();
    if (flyBy.isActive()) {
      flyBy.stop({ keepResume: true });
      flyBy.setResumeSprintId(resumeSprintId || flyBy.getResumeSprintId());
      flyBy.updateButton();
    }

    bugExpansion.toggle(taskId);
    renderGantt({ restoreScroll: scrollPosition, skipStopFlyBy: true });
  }

  function ganttAvailableTimelineWidth() {
    const contentWidth = app?.clientWidth || window.innerWidth || 1200;
    return Math.max(620, contentWidth - 280);
  }

  function deactivateGantt() {
    closeGanttFilterDialogs();
    flyBy.deactivate();
  }

  function closeGanttFilterDialogs() {
    document.querySelectorAll("[data-gantt-filter-dialog]").forEach(dialog => {
      if (dialog.open) {
        dialog.close();
      } else {
        dialog.remove();
      }
    });
  }

  return {
    deactivate: deactivateGantt,
    handleAction,
    handleFilterChange,
    openProject,
    render: renderGantt
  };
}
