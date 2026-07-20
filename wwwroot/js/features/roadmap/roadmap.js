import {
  preferenceKeys,
  readBooleanPreference,
  readPreference,
  writePreference
} from "../../core/preferences.js";
import { state } from "../../core/store.js";
import {
  roadMapChartData,
  roadMapProjects,
  roadMapSprintOptions
} from "./roadmap-calculations.js?v=20260627-roadmap-ongoing-width";
import { roadMapScreenHtml } from "./roadmap-rendering.js?v=release-notes-2026-07-21-day-34-e1d85055ec6f";

export function createRoadMapFeature({ app }) {
  let roadMapProjectFilter = readPreference(preferenceKeys.roadMapProject, "all");
  let roadMapSprintFilter = readPreference(preferenceKeys.roadMapSprint, "all");
  let roadMapSort = readPreference(preferenceKeys.roadMapSort, "endAsc");
  let roadMapShowDetails = readBooleanPreference(preferenceKeys.roadMapShowDetails, true);
  let roadMapShowSprints = readBooleanPreference(preferenceKeys.roadMapShowSprints, false);

  function renderRoadMap() {
    const sprintOptions = roadMapSprintOptions({
      sprints: state.sprints,
      projectFilter: roadMapProjectFilter
    });
    if (roadMapSprintFilter !== "all" && !sprintOptions.some(sprint => String(sprint.id) === String(roadMapSprintFilter))) {
      roadMapSprintFilter = "all";
      writePreference(preferenceKeys.roadMapSprint, roadMapSprintFilter);
    }

    const filteredProjects = roadMapProjects({
      projects: state.projects,
      sprints: state.sprints,
      projectFilter: roadMapProjectFilter,
      sprintFilter: roadMapSprintFilter,
      showSprints: roadMapShowSprints,
      sort: roadMapSort
    });
    const chart = roadMapChartData({
      projects: filteredProjects,
      sprints: state.sprints,
      holidays: state.holidays,
      sprintFilter: roadMapSprintFilter,
      showSprints: roadMapShowSprints,
      availableTimelineWidth: roadMapAvailableTimelineWidth()
    });

    app.innerHTML = roadMapScreenHtml({
      projects: state.projects,
      sprintOptions,
      projectFilter: roadMapProjectFilter,
      sprintFilter: roadMapSprintFilter,
      sort: roadMapSort,
      showDetails: roadMapShowDetails,
      showSprints: roadMapShowSprints,
      chart
    });
  }

  function handleAction(action) {
    if (action === "toggle-roadmap-details") {
      toggleDetails();
      return true;
    }
    if (action === "toggle-roadmap-sprints") {
      toggleSprints();
      return true;
    }
    return false;
  }

  function handleFilterChange(eventOrTarget) {
    const target = eventOrTarget?.target || eventOrTarget;

    if (target.dataset.filter === "roadmap-project") {
      roadMapProjectFilter = target.value;
      roadMapSprintFilter = "all";
      writePreference(preferenceKeys.roadMapProject, roadMapProjectFilter);
      writePreference(preferenceKeys.roadMapSprint, roadMapSprintFilter);
      renderRoadMap();
      return true;
    }
    if (target.dataset.filter === "roadmap-sprint") {
      roadMapSprintFilter = target.value;
      writePreference(preferenceKeys.roadMapSprint, roadMapSprintFilter);
      renderRoadMap();
      return true;
    }
    if (target.dataset.filter === "roadmap-sort") {
      roadMapSort = target.value;
      writePreference(preferenceKeys.roadMapSort, roadMapSort);
      renderRoadMap();
      return true;
    }
    return false;
  }

  function toggleDetails() {
    roadMapShowDetails = !roadMapShowDetails;
    writePreference(preferenceKeys.roadMapShowDetails, roadMapShowDetails);
    renderRoadMap();
  }

  function toggleSprints() {
    roadMapShowSprints = !roadMapShowSprints;
    writePreference(preferenceKeys.roadMapShowSprints, roadMapShowSprints);
    renderRoadMap();
  }

  function roadMapAvailableTimelineWidth() {
    const shellWidth = app?.clientWidth || app?.getBoundingClientRect?.().width || window.innerWidth || 1200;
    const roadMapPanelBorders = 2;
    const roundingAllowance = 1;
    return Math.max(560, shellWidth - roadMapHorizontalPadding(app) - roadMapScrollbarWidth() - roadMapPanelBorders - roundingAllowance);
  }

  return {
    handleAction,
    handleFilterChange,
    render: renderRoadMap
  };
}

function roadMapHorizontalPadding(element) {
  if (!element || !window.getComputedStyle) return 0;

  const style = window.getComputedStyle(element);
  return cssPixelValue(style.paddingLeft) + cssPixelValue(style.paddingRight);
}

function cssPixelValue(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

let measuredRoadMapScrollbarWidth = null;

function roadMapScrollbarWidth() {
  if (measuredRoadMapScrollbarWidth !== null) return measuredRoadMapScrollbarWidth;
  if (!document?.body) return 0;

  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll;visibility:hidden;";
  document.body.appendChild(probe);
  measuredRoadMapScrollbarWidth = Math.max(0, probe.offsetWidth - probe.clientWidth);
  probe.remove();
  return measuredRoadMapScrollbarWidth;
}
