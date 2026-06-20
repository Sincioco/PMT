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
} from "./roadmap-calculations.js?v=20260620-render-end-date";
import { roadMapScreenHtml } from "./roadmap-rendering.js?v=20260620-all-projects-label";

export function createRoadMapFeature({ app }) {
  let roadMapProjectFilter = readPreference(preferenceKeys.roadMapProject, "all");
  let roadMapSprintFilter = readPreference(preferenceKeys.roadMapSprint, "all");
  let roadMapSort = readPreference(preferenceKeys.roadMapSort, "endAsc");
  let roadMapShowDates = readBooleanPreference(preferenceKeys.roadMapShowDates, true);
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
      showDates: roadMapShowDates,
      showDetails: roadMapShowDetails,
      showSprints: roadMapShowSprints,
      chart
    });
  }

  function handleAction(action) {
    if (action === "toggle-roadmap-dates") {
      toggleDates();
      return true;
    }
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

  function toggleDates() {
    roadMapShowDates = !roadMapShowDates;
    writePreference(preferenceKeys.roadMapShowDates, roadMapShowDates);
    renderRoadMap();
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
    const contentWidth = app?.clientWidth || window.innerWidth || 1200;
    return Math.max(560, contentWidth - 48);
  }

  return {
    handleAction,
    handleFilterChange,
    render: renderRoadMap
  };
}
