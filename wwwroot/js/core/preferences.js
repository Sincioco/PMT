export const preferenceKeys = Object.freeze({
  authenticatedUser: "pmt-auth-user",
  view: "pmt-view",
  theme: "pmt-theme",
  navigation: "pmt-navigation",
  boardProject: "pmt-board-project",
  boardSprint: "pmt-board-sprint",
  boardSort: "pmt-board-sort",
  boardStatuses: "pmt-board-statuses",
  boardUsers: "pmt-board-users",
  boardHideEmptyColumns: "pmt-board-hide-empty-columns",
  boardFiltersVisible: "pmt-board-filters-visible",
  roadMapProject: "pmt-roadmap-project",
  roadMapSprint: "pmt-roadmap-sprint",
  roadMapSort: "pmt-roadmap-sort",
  roadMapShowDates: "pmt-roadmap-show-dates",
  roadMapShowDetails: "pmt-roadmap-show-details",
  roadMapShowSprints: "pmt-roadmap-show-sprints",
  ganttProject: "pmt-gantt-project",
  ganttSprint: "pmt-gantt-sprint",
  ganttRenderMode: "pmt-gantt-render-mode",
  ganttSort: "pmt-gantt-sort",
  ganttShowNonWorkingDays: "pmt-gantt-show-non-working-days",
  lookupType: "pmt-lookup-type",
  settingsCategory: "pmt-settings-category",
  settingsTableFilters: "pmt-settings-table-filters",
  richTextDialogToolbarsCollapsed: "pmt-rich-text-dialog-toolbars-collapsed",
  sprintProject: "pmt-sprint-project",
  sprintEntryProject: "pmt-sprint-entry-project",
  taskProject: "pmt-task-project",
  taskSprint: "pmt-task-sprint",
  taskEntryProject: "pmt-task-entry-project",
  taskEntrySprint: "pmt-task-entry-sprint",
  taskFilters: "pmt-task-filters",
  taskFiltersVisible: "pmt-task-filters-visible",
  taskVisualChartsVisible: "pmt-task-visual-charts-visible",
  taskCollapsedSubTasks: "pmt-task-collapsed-subtasks",
  taskTableColumns: "pmt-task-table-columns",
  bugFilters: "pmt-bug-filters",
  bugFiltersVisible: "pmt-bug-filters-visible",
  bugVisualChartsVisible: "pmt-bug-visual-charts-visible",
  bugEntryProject: "pmt-bug-entry-project",
  bugEntrySprint: "pmt-bug-entry-sprint",
  bugEntryEnvironment: "pmt-bug-entry-environment",
  bugTableColumns: "pmt-bug-table-columns",
  bugDialogFields: "pmt-bug-dialog-fields",
  scrumFilters: "pmt-scrum-filters",
  scrumFiltersVisible: "pmt-scrum-filters-visible",
  scrumEntryProject: "pmt-scrum-entry-project",
  logFilters: "pmt-log-filters",
  logEntryProject: "pmt-log-entry-project",
  backlogFilters: "pmt-backlog-filters",
  backlogCollapsedSubTasks: "pmt-backlog-collapsed-subtasks",
  backlogTableColumns: "pmt-backlog-table-columns",
  documentationProject: "pmt-documentation-project",
  documentationEntryProject: "pmt-documentation-entry-project",
  documentationEntrySprint: "pmt-documentation-entry-sprint",
  documentationVisibility: "pmt-documentation-visibility",
  documentationViewMode: "pmt-documentation-view-mode",
  documentationTreeGroup: "pmt-documentation-tree-group",
  documentationTreeLayout: "pmt-documentation-tree-layout",
  documentationTreeSort: "pmt-documentation-tree-sort",
  documentationTreeSearch: "pmt-documentation-tree-search",
  documentationTreePaneWidth: "pmt-documentation-tree-pane-width",
  documentationTreePaneHidden: "pmt-documentation-tree-pane-hidden"
});

export function readPreference(key, defaultValue = "") {
  try {
    return localStorage.getItem(key) ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

export function readNumberPreference(key, defaultValue = 0) {
  const parsed = Number(readPreference(key, String(defaultValue)));
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function readBooleanPreference(key, defaultValue = false) {
  const value = readPreference(key, "");
  if (value === "true") return true;
  if (value === "false") return false;
  return defaultValue;
}

export function readJsonPreference(key, defaultValue) {
  const value = readPreference(key, "");
  if (!value) return defaultValue;

  try {
    return JSON.parse(value);
  } catch {
    return defaultValue;
  }
}

export function writePreference(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Preferences are optional when browser storage is unavailable.
  }
}

export function writeJsonPreference(key, value) {
  writePreference(key, JSON.stringify(value));
}

export function removePreference(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Preferences are optional when browser storage is unavailable.
  }
}

export function clearPmtPreferences() {
  try {
    const pmtKeys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith("pmt-")) pmtKeys.push(key);
    }

    pmtKeys.forEach(key => localStorage.removeItem(key));
  } catch {
    // Reloading still restores in-memory defaults when storage is unavailable.
  }
}
