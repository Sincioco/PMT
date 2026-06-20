export const screenRegistry = Object.freeze([
  { view: "Dashboard", label: "Dashboard", feature: "dashboard", showInNavigation: true },
  { view: "Road Map", label: "Road Map", feature: "roadmap", showInNavigation: true },
  { view: "Gantt", label: "Gantt", feature: "gantt", showInNavigation: true },
  { view: "Board", label: "Kanban Board", feature: "board", showInNavigation: true },
  { view: "Projects", label: "Projects", feature: "projects", showInNavigation: true },
  { view: "Sprints", label: "Sprints", feature: "sprints", showInNavigation: true },
  { view: "Tasks", label: "Dev Tasks", feature: "tasks", showInNavigation: true },
  { view: "Bugs", label: "Bug Tracking", feature: "bugs", showInNavigation: true },
  { view: "Scrum", label: "Scrum", feature: "scrum", showInNavigation: true },
  { view: "Documentation", label: "Documentation", feature: "documentation", showInNavigation: true },
  { view: "Backlog", label: "Backlog", feature: "backlog", showInNavigation: true },
  { view: "WFH Schedule", label: "WFH Schedule", feature: "wfh-schedule", showInNavigation: true },
  { view: "Settings", label: "Settings", feature: "settings", showInNavigation: true }
]);

const screenHandlers = new Map();

export function registerScreen(view, handlers) {
  if (!screenRegistry.some(screen => screen.view === view)) {
    throw new Error(`Unknown screen: ${view}`);
  }

  screenHandlers.set(view, handlers);
}

export function screenHandlerFor(view) {
  return screenHandlers.get(view) || null;
}

export function registeredScreenHandlers() {
  return [...screenHandlers.values()];
}
