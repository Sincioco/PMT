import { state } from "../core/store.js";

export function projectById(id) {
  return state.projects.find(project => project.id === id);
}

export function sprintById(id) {
  return state.sprints.find(sprint => sprint.id === id);
}

export function taskById(id) {
  return state.tasks.find(task => task.id === id);
}

export function userById(id) {
  return state.users.find(user => user.id === id);
}

export function roleLabel(code) {
  return (state.roles || []).find(role => role.code === code)?.value || code || "Developer";
}

export function projectName(id) {
  const project = projectById(id);
  return project ? `${project.code} - ${project.title}` : "No project";
}

export function projectCode(id) {
  const project = projectById(id);
  return project?.code || "No project";
}

export function sprintName(id) {
  const sprint = sprintById(id);
  return sprint ? sprint.code : "No Sprint";
}
