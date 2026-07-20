import { buttonContent } from "../components/buttons.js";
import { initializeWindowedDialog } from "../components/dialogs.js?v=20260706-dialog-persistence";
import {
  currentUser,
  currentUserId
} from "../core/authentication.js?v=20260715-admin-impersonation";
import { state } from "../core/store.js";
import { appAbsoluteUrl } from "./app-urls.js";
import { formatDateTime } from "./dates.js";
import {
  projectById,
  sprintById,
  taskById,
  userById
} from "./selectors.js";
import {
  escapeAttr,
  escapeHtml,
  normalizeRichHtml
} from "./text-and-links.js";
import { externalizeImportedHtmlImagesInPayload } from "./imported-html-images.js";
import { taskDisplayPercent } from "./work-item-rules.js?v=20260716-developer-board-status";

const workItemImportMarker = "PMT Import Process Meta Data";
const workItemExportSchema = "pmt.work-item.export.v1";
const workItemImportFileExtensions = new Set(["html", "htm", "doc"]);

export async function exportWorkItemHtml(task, options = {}) {
  if (!task) return;

  const portableTask = await workItemWithPortableImages(task, options);
  const html = workItemExportHtml(portableTask);
  downloadBlob(workItemExportFileName(task), new Blob([html], { type: "text/html;charset=utf-8" }));
}

export function openWorkItemHtmlImport(options = {}) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".html,.htm,.doc,text/html,application/msword";
  input.hidden = true;
  input.addEventListener("change", async () => {
    const file = input.files?.[0] || null;
    input.remove();
    if (!file) return;

    if (!isWorkItemImportFile(file)) {
      showWorkItemImportReviewDialog(options.screenLabel || "Import", [{
        status: "Error",
        rowNumber: "File",
        title: file.name || "Selected file",
        message: "Select a PMT HTML export file."
      }]);
      return;
    }

    await importWorkItemHtmlFile(file, options);
  }, { once: true });
  document.body.appendChild(input);
  input.click();
}

async function importWorkItemHtmlFile(file, options) {
  const screenLabel = options.screenLabel || "Import";
  const results = [];

  try {
    const parsedItems = parseWorkItemImportFile(await file.text(), options);

    for (let index = 0; index < parsedItems.length; index += 1) {
      const item = parsedItems[index];
      try {
        results.push(await saveImportedWorkItem(item, options, index + 1));
      } catch (error) {
        results.push({
          status: "Error",
          rowNumber: index + 1,
          title: importedTitle(item.rawItem) || "Imported item",
          message: error.message || "Import failed.",
          notes: item.notes
        });
      }
    }

    if (results.some(result => result.id) && options.refreshAfterImport) {
      await options.refreshAfterImport();
      hydrateImportResults(results, options);
    }
  } catch (error) {
    results.push({
      status: "Error",
      rowNumber: "File",
      title: file.name || "Selected file",
      message: error.message || "Import failed."
    });
  }

  showWorkItemImportReviewDialog(screenLabel, results);
}

function parseWorkItemImportFile(htmlText, options) {
  const source = String(htmlText || "");
  const parsedDocument = new DOMParser().parseFromString(source, "text/html");
  const parsedText = parsedDocument.body?.textContent || "";
  const metadata = parseWorkItemImportMetadata(parsedDocument);
  const hasImportMarker = source.includes(workItemImportMarker)
    || parsedText.includes(workItemImportMarker)
    || metadata?.schema === workItemExportSchema;

  if (!hasImportMarker) {
    throw new Error("The file cannot be imported because it is not a valid PMT export file.");
  }

  const rawItems = workItemRawImportItems(metadata, parsedDocument, options);
  return rawItems.map(rawItem => ({
    rawItem,
    fallbackTitle: documentFallbackTitle(parsedDocument),
    fallbackBodyHtml: documentFallbackBodyHtml(parsedDocument),
    notes: []
  }));
}

function parseWorkItemImportMetadata(parsedDocument) {
  const metadataText = parsedDocument.querySelector("#pmt-import-metadata")?.textContent
    || parsedDocument.querySelector(".pmt-import-metadata pre")?.textContent
    || "";

  if (!metadataText.trim()) return {};

  try {
    return JSON.parse(metadataText);
  } catch {
    return {};
  }
}

function workItemRawImportItems(metadata, parsedDocument, options) {
  if (Array.isArray(metadata?.items) && metadata.items.length) return metadata.items;
  if (Array.isArray(metadata?.workItems) && metadata.workItems.length) return metadata.workItems;
  if (metadata?.item) return [metadata.item];
  if (metadata?.task) return [metadata.task];
  if (metadata?.document) {
    return [{
      ...metadata.document,
      taskType: options.defaultTaskType || "Dev",
      descriptionHtml: metadata.document.bodyHtml || ""
    }];
  }

  return [{
    taskType: options.defaultTaskType || "Dev",
    title: documentFallbackTitle(parsedDocument),
    descriptionHtml: documentFallbackBodyHtml(parsedDocument)
  }];
}

async function saveImportedWorkItem(item, options, rowNumber) {
  const rawItem = item.rawItem || {};
  const notes = item.notes || [];
  const taskType = resolveImportTaskType(rawItem, options);
  const existing = resolveExistingWorkItem(rawItem, taskType, notes);
  const fallbackContext = options.getFallbackContext?.({ taskType, existing }) || {};
  const projectId = resolveImportProjectId(rawItem.project, {
    fallbackProjectId: fallbackContext.projectId,
    existingProjectId: existing?.projectId,
    notes
  });
  const sprintId = resolveImportSprintId(rawItem.sprint, {
    projectId,
    fallbackSprintId: fallbackContext.sprintId,
    existingSprintId: existing?.sprintId,
    notes
  });
  const payload = workItemImportPayload(rawItem, {
    taskType,
    existing,
    projectId,
    sprintId,
    fallbackTitle: item.fallbackTitle,
    fallbackBodyHtml: item.fallbackBodyHtml,
    defaultStatus: fallbackContext.status || options.defaultStatus,
    notes
  });
  const imageResult = await externalizeImportedHtmlImagesInPayload(payload, [
    "descriptionHtml",
    "stepsToReproduceHtml",
    "actualResultHtml",
    "expectedResultHtml",
    "rootCauseAnalysisHtml"
  ]);
  if (imageResult.uploaded) notes.push(`${imageResult.uploaded} embedded image${imageResult.uploaded === 1 ? "" : "s"} moved to uploads.`);
  if (imageResult.failed) notes.push(`${imageResult.failed} embedded image${imageResult.failed === 1 ? "" : "s"} could not be moved to uploads.`);
  const isUpdate = payload.id > 0;
  const apiRoot = options.apiRoot || "/api/tasks";
  const result = await options.saveJson(
    isUpdate ? `${apiRoot}/${payload.id}` : apiRoot,
    isUpdate ? "PUT" : "POST",
    payload,
    isUpdate ? {
      saveAsNew: true,
      canCreate: options.canCreate === true,
      createPath: apiRoot
    } : undefined
  );
  const savedId = Number(result?.id || payload.id || 0);
  const savedAsNew = result?.__savedAsNew === true;

  return {
    status: isUpdate && !savedAsNew ? "Updated" : "Created",
    rowNumber,
    id: savedId,
    taskType,
    code: existing?.code || "",
    title: payload.title,
    routeType: options.routeType || (taskType === "Bug" ? "bugs" : "tasks"),
    notes
  };
}

function workItemImportPayload(rawItem, context) {
  const existing = context.existing;
  const taskType = context.taskType;
  const isBug = taskType === "Bug";
  const title = importedTitle(rawItem) || context.fallbackTitle || existing?.title || (isBug ? "Imported Bug Report" : "Imported Dev Task");
  const status = resolveLookupValue("Status", rawItem.status, existing?.status, context.defaultStatus || "Todo");
  const priority = resolveLookupValue("Priority", rawItem.priority, existing?.priority, "Low");
  const assigneeIds = resolveImportUsers(firstDefined(rawItem.assigneeUsers, rawItem.assignees, rawItem.assigneeIds), {
    existingIds: existing?.assigneeIds,
    defaultToCurrentUser: true,
    notes: context.notes
  });
  const reporterIds = isBug
    ? resolveImportUsers(firstDefined(rawItem.reporterUsers, rawItem.reporters, rawItem.reporterIds), {
      existingIds: existing?.reporterIds,
      defaultToCurrentUser: true,
      notes: context.notes
    })
    : [];

  return {
    id: existing?.id || 0,
    projectId: context.projectId,
    sprintId: context.sprintId,
    parentTaskId: isBug ? null : resolveRelatedTaskId(firstDefined(rawItem.parentTask, rawItem.parent, rawItem.parentTaskId), {
      projectId: context.projectId,
      excludeTaskId: existing?.id,
      notes: context.notes
    }),
    taskType,
    title,
    descriptionHtml: importedRichHtml(firstDefined(rawItem.descriptionHtml, rawItem.bodyHtml), context.fallbackBodyHtml, existing?.descriptionHtml),
    stepsToReproduceHtml: isBug ? importedRichHtml(rawItem.stepsToReproduceHtml, "", existing?.stepsToReproduceHtml) : "",
    actualResultHtml: isBug ? importedRichHtml(rawItem.actualResultHtml, "", existing?.actualResultHtml) : "",
    expectedResultHtml: isBug ? importedRichHtml(rawItem.expectedResultHtml, "", existing?.expectedResultHtml) : "",
    rootCauseAnalysisHtml: importedOptionalRichHtml(rawItem.rootCauseAnalysisHtml, existing?.rootCauseAnalysisHtml),
    environment: isBug ? resolveLookupValue("Environment", rawItem.environment, existing?.environment, "SIT") : "",
    severity: isBug ? resolveLookupValue("Severity", rawItem.severity, existing?.severity, "Minor") : "",
    status,
    priority,
    percentCompleted: resolveImportPercent(rawItem, existing),
    url: importedText(rawItem.url) || existing?.url || "",
    startDate: resolveImportDate(rawItem.startDate, existing?.startDate),
    endDate: resolveImportDate(rawItem.endDate, existing?.endDate),
    reporterIds,
    assigneeIds,
    dependencyTaskIds: resolveRelatedTaskIds(firstDefined(rawItem.dependencyTasks, rawItem.dependencies, rawItem.dependencyTaskIds), {
      excludeTaskId: existing?.id,
      notes: context.notes
    }),
    auditContext: "Import",
    expectedRowVersion: existing ? importedText(rawItem.rowVersion) || null : undefined
  };
}

function resolveImportTaskType(rawItem, options) {
  const allowedTypes = Array.isArray(options.allowedTaskTypes) && options.allowedTaskTypes.length
    ? options.allowedTaskTypes
    : ["Dev", "Bug"];
  const type = normalizeTaskType(firstDefined(rawItem.taskType, rawItem.type, rawItem.itemType));
  if (allowedTypes.includes(type)) return type;
  return options.defaultTaskType && allowedTypes.includes(options.defaultTaskType)
    ? options.defaultTaskType
    : allowedTypes[0];
}

function resolveExistingWorkItem(rawItem, taskType, notes) {
  const id = Number(firstDefined(rawItem.id, rawItem.taskId, rawItem.itemId) || 0);
  const code = importedText(firstDefined(rawItem.code, rawItem.itemCode, rawItem.taskCode));
  const title = importedTitle(rawItem);
  const candidates = [
    id ? taskById(id) : null,
    code ? state.tasks.find(task => normalizeText(task.code) === normalizeText(code)) : null,
    title ? state.tasks.find(task => normalizeTaskType(task.taskType) === taskType && normalizeText(task.title) === normalizeText(title)) : null
  ].filter(Boolean);
  const existing = candidates.find(task => normalizeTaskType(task.taskType) === taskType) || null;

  if (!existing) return null;
  if (canUpdateImportedWorkItem(existing)) return existing;

  notes.push("Matched item is owned by another user, so a new item was created.");
  return null;
}

function canUpdateImportedWorkItem(task) {
  const user = currentUser();
  return user.isAdmin || user.role === "Admin" || Number(task.createdByUserId || 0) === Number(currentUserId || 0);
}

function resolveImportProjectId(projectMetadata, { fallbackProjectId, existingProjectId, notes }) {
  const project = resolveProject(projectMetadata);
  if (project) return project.id;

  const fallbackProject = projectById(Number(fallbackProjectId || 0));
  if (fallbackProject) {
    if (projectMetadata) notes.push("Project was mapped to the current screen project.");
    return fallbackProject.id;
  }

  const existingProject = projectById(Number(existingProjectId || 0));
  if (existingProject) return existingProject.id;

  const firstProject = state.projects[0];
  if (firstProject) {
    notes.push("Project was mapped to the first available project.");
    return firstProject.id;
  }

  return 0;
}

function resolveImportSprintId(sprintMetadata, { projectId, fallbackSprintId, existingSprintId, notes }) {
  const sprint = resolveSprint(sprintMetadata, projectId);
  if (sprint) return sprint.id;

  const fallbackSprint = sprintById(Number(fallbackSprintId || 0));
  if (fallbackSprint && fallbackSprint.projectId === projectId) {
    if (sprintMetadata) notes.push("Sprint was mapped to the current screen sprint.");
    return fallbackSprint.id;
  }

  const existingSprint = sprintById(Number(existingSprintId || 0));
  if (existingSprint && existingSprint.projectId === projectId) return existingSprint.id;

  if (sprintMetadata) notes.push("Sprint was not found and was left unassigned.");
  return null;
}

function resolveProject(metadata) {
  const id = Number(objectValue(metadata, "id") || 0);
  const code = importedText(objectValue(metadata, "code"));
  const title = importedText(firstDefined(objectValue(metadata, "title"), objectValue(metadata, "name")));

  return (id ? projectById(id) : null)
    || state.projects.find(project => code && normalizeText(project.code) === normalizeText(code))
    || state.projects.find(project => title && normalizeText(project.title) === normalizeText(title))
    || null;
}

function resolveSprint(metadata, projectId) {
  const id = Number(objectValue(metadata, "id") || 0);
  const code = importedText(objectValue(metadata, "code"));
  const title = importedText(firstDefined(objectValue(metadata, "title"), objectValue(metadata, "name")));
  const candidates = state.sprints.filter(sprint => !projectId || sprint.projectId === projectId);

  return (id ? candidates.find(sprint => sprint.id === id) : null)
    || candidates.find(sprint => code && normalizeText(sprint.code) === normalizeText(code))
    || candidates.find(sprint => title && normalizeText(sprint.title) === normalizeText(title))
    || null;
}

function resolveImportUsers(value, { existingIds = [], defaultToCurrentUser = false, notes = [] } = {}) {
  const descriptors = normalizeImportList(value);
  const ids = [];

  descriptors.forEach(descriptor => {
    const user = resolveUser(descriptor);
    if (user) {
      ids.push(user.id);
    } else if (defaultToCurrentUser && currentUserId) {
      ids.push(currentUserId);
      notes.push(`User "${descriptorLabel(descriptor)}" was mapped to the current user.`);
    }
  });

  if (!ids.length && Array.isArray(existingIds) && existingIds.length) return uniqueNumbers(existingIds);
  if (!ids.length && defaultToCurrentUser && currentUserId) return [currentUserId];
  return uniqueNumbers(ids);
}

function resolveUser(descriptor) {
  const id = Number(objectValue(descriptor, "id") || descriptor || 0);
  const nickname = importedText(objectValue(descriptor, "nickname"));
  const email = importedText(objectValue(descriptor, "email"));
  const fullName = importedText(firstDefined(
    objectValue(descriptor, "fullName"),
    [objectValue(descriptor, "firstName"), objectValue(descriptor, "lastName")].filter(Boolean).join(" "),
    typeof descriptor === "string" ? descriptor : ""
  ));

  return (id ? userById(id) : null)
    || state.users.find(user => nickname && normalizeText(user.nickname) === normalizeText(nickname))
    || state.users.find(user => email && normalizeText(user.email) === normalizeText(email))
    || state.users.find(user => fullName && normalizeText(userFullName(user)) === normalizeText(fullName))
    || state.users.find(user => fullName && normalizeText(user.nickname) === normalizeText(fullName))
    || null;
}

function resolveRelatedTaskId(value, { projectId = 0, excludeTaskId = 0, notes = [] } = {}) {
  const task = resolveRelatedTask(value, { projectId, excludeTaskId });
  if (!task && value) notes.push("A related task was not found and was left unassigned.");
  return task?.id || null;
}

function resolveRelatedTaskIds(value, { excludeTaskId = 0, notes = [] } = {}) {
  const descriptors = normalizeImportList(value);
  const taskIds = descriptors
    .map(descriptor => resolveRelatedTask(descriptor, { excludeTaskId })?.id || 0)
    .filter(Boolean);

  if (descriptors.length && taskIds.length !== descriptors.length) {
    notes.push("One or more related tasks were not found and were skipped.");
  }

  return uniqueNumbers(taskIds);
}

function resolveRelatedTask(descriptor, { projectId = 0, excludeTaskId = 0 } = {}) {
  const id = Number(objectValue(descriptor, "id") || descriptor || 0);
  const code = importedText(objectValue(descriptor, "code"));
  const title = importedText(firstDefined(objectValue(descriptor, "title"), typeof descriptor === "string" ? descriptor : ""));
  const candidates = state.tasks.filter(task =>
    task.id !== Number(excludeTaskId || 0)
    && (!projectId || task.projectId === projectId)
  );

  return (id ? candidates.find(task => task.id === id) : null)
    || candidates.find(task => code && normalizeText(task.code) === normalizeText(code))
    || candidates.find(task => title && normalizeText(task.title) === normalizeText(title))
    || null;
}

function resolveLookupValue(type, requestedValue, existingValue, fallbackValue) {
  const requested = importedText(requestedValue);
  const existing = importedText(existingValue);
  const fallback = importedText(fallbackValue);
  const values = state.lookups
    .filter(lookup => lookup.lookupType === type && lookup.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.value.localeCompare(b.value))
    .map(lookup => lookup.value);

  return values.find(value => normalizeText(value) === normalizeText(requested))
    || values.find(value => normalizeText(value) === normalizeText(existing))
    || values.find(value => normalizeText(value) === normalizeText(fallback))
    || values[0]
    || fallback
    || existing
    || requested;
}

function resolveImportPercent(rawItem, existing) {
  const value = firstDefined(rawItem.percentCompleted, rawItem.percent, rawItem.percentComplete);
  const percent = Number(value);
  if (Number.isFinite(percent)) return Math.max(0, Math.min(100, Math.round(percent)));
  return Math.max(0, Math.min(100, Math.round(Number(existing?.percentCompleted || 0))));
}

function resolveImportDate(value, existingValue) {
  const text = importedText(value) || importedText(existingValue);
  if (!text) return null;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function hydrateImportResults(results, options) {
  results.forEach(result => {
    if (!result.id) return;

    const task = taskById(result.id);
    if (!task) return;

    result.code = task.code || result.code || "";
    result.title = task.title || result.title || "";
    result.taskType = task.taskType || result.taskType;
    result.routeType = options.routeType || (task.taskType === "Bug" ? "bugs" : "tasks");
  });
}

function showWorkItemImportReviewDialog(screenLabel, results) {
  const modal = document.createElement("dialog");
  modal.className = "dialog detail-dialog import-result-dialog work-item-import-review-dialog";
  modal.innerHTML = `
    <div class="dialog-head">
      <h2>${escapeHtml(screenLabel)} Import Review</h2>
      <button type="button" class="icon-btn" data-close-work-item-import-review title="Close" aria-label="Close">x</button>
    </div>
    <div class="dialog-body">
      <div class="import-result-summary">
        <div><strong>${results.filter(result => result.status === "Created").length}</strong><span>Created</span></div>
        <div><strong>${results.filter(result => result.status === "Updated").length}</strong><span>Updated</span></div>
        <div><strong>${results.filter(result => result.status === "Error").length}</strong><span>Errors</span></div>
      </div>
      <div class="import-error-panel">
        <table class="table import-error-table">
          <thead>
            <tr>
              <th>Row</th>
              <th>Status</th>
              <th>Item</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${results.map(workItemImportResultRowHtml).join("")}
          </tbody>
        </table>
      </div>
    </div>
    <div class="dialog-actions">
      <button type="button" class="secondary text-icon-button" data-download-work-item-import-review>${buttonContent("&#8681;", "Download Review")}</button>
      <button type="button" class="primary text-icon-button" data-close-work-item-import-review>${buttonContent("&#10003;", "Done")}</button>
    </div>
  `;

  modal.addEventListener("click", event => {
    if (event.target.closest("[data-close-work-item-import-review]")) {
      modal.close();
      return;
    }

    if (event.target.closest("[data-download-work-item-import-review]")) {
      downloadBlob(workItemImportReviewFileName(screenLabel), new Blob([workItemImportReviewHtml(screenLabel, results)], { type: "text/html;charset=utf-8" }));
    }
  });
  modal.addEventListener("close", () => modal.remove());
  document.body.appendChild(modal);
  initializeWindowedDialog(modal);
  modal.showModal();
}

function workItemImportResultRowHtml(result) {
  const notes = [
    result.message,
    ...(result.notes || [])
  ].filter(Boolean).join(" ");
  const itemLabel = [result.code, result.title].filter(Boolean).join(" - ") || result.title || "Item";
  const itemHtml = result.id
    ? `<a href="${escapeAttr(workItemResultHref(result))}">${escapeHtml(itemLabel)}</a>`
    : escapeHtml(itemLabel);

  return `
    <tr>
      <td>${escapeHtml(result.rowNumber || "")}</td>
      <td>${escapeHtml(result.status || "")}</td>
      <td>${itemHtml}</td>
      <td>${escapeHtml(notes || "Imported without remap notes.")}</td>
    </tr>
  `;
}

function workItemImportReviewHtml(screenLabel, results) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(screenLabel)} Import Review</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #172033; line-height: 1.5; margin: 32px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d8dee8; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #f4f7fb; }
    a { color: #1f5fbf; }
  </style>
</head>
<body>
  <h1>${escapeHtml(screenLabel)} Import Review</h1>
  <p>Generated ${escapeHtml(new Date().toLocaleString())}</p>
  <table>
    <thead>
      <tr><th>Row</th><th>Status</th><th>Item</th><th>Notes</th></tr>
    </thead>
    <tbody>
      ${results.map(result => {
        const itemLabel = [result.code, result.title].filter(Boolean).join(" - ") || result.title || "Item";
        const item = result.id
          ? `<a href="${escapeAttr(workItemResultHref(result))}">${escapeHtml(itemLabel)}</a>`
          : escapeHtml(itemLabel);
        const notes = [result.message, ...(result.notes || [])].filter(Boolean).join(" ");
        return `<tr><td>${escapeHtml(result.rowNumber || "")}</td><td>${escapeHtml(result.status || "")}</td><td>${item}</td><td>${escapeHtml(notes)}</td></tr>`;
      }).join("")}
    </tbody>
  </table>
</body>
</html>`;
}

function workItemResultHref(result) {
  const route = result.routeType || (result.taskType === "Bug" ? "bugs" : "tasks");
  return `#/${route}/${result.id}`;
}

function workItemExportMetadata(task) {
  const project = projectById(task.projectId);
  const sprint = sprintById(task.sprintId);

  return {
    schema: workItemExportSchema,
    exportedAt: new Date().toISOString(),
    sourceApplication: "PMT",
    sourceUrl: appAbsoluteUrl("/"),
    items: [workItemMetadata(task, project, sprint)]
  };
}

function workItemMetadata(task, project, sprint) {
  return {
    id: task.id,
    code: task.code || "",
    taskType: task.taskType || "Dev",
    title: task.title || "",
    project: project ? { id: project.id, code: project.code, title: project.title } : null,
    sprint: sprint ? { id: sprint.id, code: sprint.code, title: sprint.title, projectId: sprint.projectId } : null,
    parentTask: relatedTaskMetadata(task.parentTaskId),
    dependencyTasks: (task.dependencyTaskIds || []).map(relatedTaskMetadata).filter(Boolean),
    linkedBugTask: relatedTaskMetadata(task.linkedBugTaskId),
    status: task.status || "",
    priority: task.priority || "",
    percentCompleted: taskDisplayPercent(task),
    environment: task.environment || "",
    severity: task.severity || "",
    descriptionHtml: task.descriptionHtml || "",
    stepsToReproduceHtml: task.stepsToReproduceHtml || "",
    actualResultHtml: task.actualResultHtml || "",
    expectedResultHtml: task.expectedResultHtml || "",
    rootCauseAnalysisHtml: task.rootCauseAnalysisHtml || "",
    url: task.url || "",
    startDate: task.startDate || "",
    endDate: task.endDate || "",
    createdAt: task.createdAt || "",
    updatedAt: task.updatedAt || "",
    rowVersion: task.rowVersion || "",
    createdByUser: userMetadata(task.createdByUserId),
    updatedByUser: userMetadata(task.updatedByUserId),
    reporterUsers: (task.reporterIds || []).map(userMetadata).filter(Boolean),
    assigneeUsers: (task.assigneeIds || []).map(userMetadata).filter(Boolean)
  };
}

function relatedTaskMetadata(taskId) {
  const task = taskById(Number(taskId || 0));
  return task ? { id: task.id, code: task.code || "", title: task.title || "", taskType: task.taskType || "Dev" } : null;
}

function userMetadata(userId) {
  const user = userById(Number(userId || 0));
  return user ? {
    id: user.id,
    nickname: user.nickname || "",
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    email: user.email || ""
  } : null;
}

function workItemExportHtml(task) {
  const title = [task.code, task.title].filter(Boolean).join(" - ") || "PMT Work Item";
  const isBug = task.taskType === "Bug";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; background: #ffffff; color: #172033; font-family: Arial, Helvetica, sans-serif; line-height: 1.6; }
    .pmt-work-item-export { max-width: 960px; margin: 0 auto; padding: 32px; }
    .pmt-work-item-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 24px; }
    .pmt-work-item-meta dt { color: #586274; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .pmt-work-item-meta dd { margin: 0; overflow-wrap: anywhere; }
    .pmt-work-item-body { margin-top: 24px; overflow-wrap: anywhere; }
    .pmt-work-item-body img { max-width: 100%; height: auto; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #f8fafc; border: 1px solid #d8dee8; padding: 12px; }
  </style>
</head>
<body>
  <article class="pmt-work-item-export">
    <h1>${escapeHtml(title)}</h1>
    <dl class="pmt-work-item-meta">
      ${metaFieldHtml("Type", isBug ? "Bug Report" : "Dev Task")}
      ${metaFieldHtml("Project", projectById(task.projectId) ? `${projectById(task.projectId).code} - ${projectById(task.projectId).title}` : "")}
      ${metaFieldHtml("Sprint", sprintById(task.sprintId)?.code || "No Sprint")}
      ${metaFieldHtml("Status", task.status || "")}
      ${metaFieldHtml("Priority", task.priority || "")}
      ${metaFieldHtml("Percent", `${taskDisplayPercent(task)}%`)}
      ${isBug ? metaFieldHtml("Environment", task.environment || "") : ""}
      ${isBug ? metaFieldHtml("Severity", task.severity || "") : ""}
      ${metaFieldHtml("Created", formatDateTime(task.createdAt))}
      ${metaFieldHtml("Updated", formatDateTime(task.updatedAt))}
    </dl>
    ${workItemBodySectionHtml("Description", task.descriptionHtml)}
    ${isBug ? workItemBodySectionHtml("Steps to Reproduce", task.stepsToReproduceHtml) : ""}
    ${isBug ? workItemBodySectionHtml("Actual Result", task.actualResultHtml) : ""}
    ${isBug ? workItemBodySectionHtml("Expected Result", task.expectedResultHtml) : ""}
    ${workItemBodySectionHtml("Root Cause Analysis", task.rootCauseAnalysisHtml)}
  </article>
</body>
</html>`;
}

function workItemBodySectionHtml(label, html) {
  if (!String(html || "").trim()) return "";
  return `
    <section class="pmt-work-item-body">
      <h2>${escapeHtml(label)}</h2>
      <div>${html}</div>
    </section>
  `;
}

function metaFieldHtml(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "None")}</dd></div>`;
}

async function workItemWithPortableImages(task, options = {}) {
  const fetchImage = options.fetch || globalThis.fetch;
  const portableTask = { ...task };
  const richHtmlFields = [
    "descriptionHtml",
    "stepsToReproduceHtml",
    "actualResultHtml",
    "expectedResultHtml",
    "rootCauseAnalysisHtml"
  ];

  for (const fieldName of richHtmlFields) {
    portableTask[fieldName] = await richHtmlWithPortableImages(portableTask[fieldName], fetchImage);
  }

  return portableTask;
}

async function richHtmlWithPortableImages(html, fetchImage) {
  const source = String(html || "");
  if (!source.trim() || typeof document === "undefined") return source;

  const container = document.createElement("div");
  container.innerHTML = source;
  const images = [...container.querySelectorAll("img[src]")];
  if (!images.length) return source;

  await Promise.all(images.map(async image => {
    const currentSource = String(image.getAttribute("src") || "").trim();
    if (!currentSource || /^data:image\//i.test(currentSource)) return;

    const absoluteSource = appAbsoluteUrl(currentSource);
    try {
      image.setAttribute("src", await imageSourceDataUrl(currentSource, fetchImage));
    } catch {
      if (absoluteSource) image.setAttribute("src", absoluteSource);
    }
  }));

  return container.innerHTML;
}

async function imageSourceDataUrl(source, fetchImage) {
  const text = String(source || "").trim();
  if (!text) throw new Error("Image source is empty.");
  if (/^data:image\//i.test(text)) return text;
  if (typeof fetchImage !== "function") throw new Error("Image fetch is unavailable.");

  const response = await fetchImage(appAbsoluteUrl(text), { credentials: "same-origin" });
  if (!response?.ok) throw new Error("Image could not be fetched.");

  const blob = await response.blob();
  if (!blob || blob.size === 0) throw new Error("Fetched image was empty.");

  // Uploaded screenshots can come back with a blank or generic content type
  // depending on the server/share. Use the file extension as a simple fallback
  // so PMT exports still become self-contained HTML files.
  const contentType = portableImageContentType(blob.type, text);
  const portableBlob = String(blob.type || "").toLowerCase() === contentType
    ? blob
    : new Blob([blob], { type: contentType });
  return blobToDataUrl(portableBlob);
}

function portableImageContentType(contentType, source) {
  const normalizedType = String(contentType || "").toLowerCase();
  if (normalizedType.startsWith("image/")) return normalizedType;

  const knownTypes = {
    ".apng": "image/apng",
    ".bmp": "image/bmp",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp"
  };
  return knownTypes[imageExtension(source)] || "image/png";
}

function imageExtension(source) {
  try {
    return new URL(appAbsoluteUrl(source)).pathname.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || "";
  } catch {
    return String(source || "").toLowerCase().split(/[?#]/)[0].match(/\.[a-z0-9]+$/)?.[0] || "";
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")), { once: true });
    reader.addEventListener("error", () => reject(reader.error || new Error("Image could not be encoded.")), { once: true });
    reader.readAsDataURL(blob);
  });
}

function documentFallbackTitle(parsedDocument) {
  return String(
    parsedDocument.querySelector(".pmt-work-item-export h1")?.textContent
    || parsedDocument.querySelector("h1")?.textContent
    || parsedDocument.querySelector("title")?.textContent
    || "Imported PMT Item"
  ).trim();
}

function documentFallbackBodyHtml(parsedDocument) {
  return parsedDocument.querySelector(".pmt-work-item-body div")?.innerHTML
    || parsedDocument.querySelector(".pmt-document-body")?.innerHTML
    || "<p>Imported from PMT export.</p>";
}

function importedRichHtml(...values) {
  const source = values.map(value => String(value || "").trim()).find(Boolean) || "<p>Imported from PMT export.</p>";
  const container = document.createElement("div");
  container.innerHTML = source;
  container.querySelectorAll("script").forEach(node => node.remove());
  return normalizeRichHtml(container.innerHTML).trim() || "<p>Imported from PMT export.</p>";
}

function importedOptionalRichHtml(...values) {
  const source = values.map(value => String(value || "").trim()).find(Boolean);
  if (!source) return "";

  const container = document.createElement("div");
  container.innerHTML = source;
  container.querySelectorAll("script").forEach(node => node.remove());
  return normalizeRichHtml(container.innerHTML).trim();
}

function importedTitle(rawItem) {
  return importedText(firstDefined(rawItem.title, rawItem.name, rawItem.itemName, rawItem.taskName, rawItem.bugName));
}

function importedText(value) {
  return String(value ?? "").trim();
}

function normalizeTaskType(value) {
  const text = importedText(value).toLowerCase();
  if (text.includes("bug")) return "Bug";
  return "Dev";
}

function normalizeImportList(value) {
  if (Array.isArray(value)) return value.filter(item => item !== null && item !== undefined && String(item).trim() !== "");
  if (value && typeof value === "object") return [value];
  return String(value || "")
    .split(/[;,]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function objectValue(value, key) {
  return value && typeof value === "object" && !Array.isArray(value) ? value[key] : "";
}

function descriptorLabel(descriptor) {
  return importedText(firstDefined(
    objectValue(descriptor, "nickname"),
    objectValue(descriptor, "email"),
    objectValue(descriptor, "fullName"),
    typeof descriptor === "string" || typeof descriptor === "number" ? descriptor : ""
  ));
}

function firstDefined(...values) {
  return values.find(value => value !== undefined && value !== null && value !== "");
}

function normalizeText(value) {
  return importedText(value).replace(/\s+/g, " ").toLowerCase();
}

function userFullName(user) {
  return [user?.firstName, user?.lastName].filter(Boolean).join(" ");
}

function uniqueNumbers(values) {
  return [...new Set((values || []).map(Number).filter(value => Number.isInteger(value) && value > 0))];
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/<\//g, "<\\/");
}

function isWorkItemImportFile(file) {
  const extension = String(file?.name || "").split(".").pop()?.toLowerCase() || "";
  return workItemImportFileExtensions.has(extension);
}

function workItemExportFileName(task) {
  return `${safeFilePart(["pmt", task.taskType === "Bug" ? "bug" : "dev-task", task.code || task.title].filter(Boolean).join("-"))}-${timestamp()}.html`;
}

function workItemImportReviewFileName(screenLabel) {
  return `${safeFilePart(`pmt-${screenLabel}-import-review`)}-${timestamp()}.html`;
}

function timestamp() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0")
  ].join("");
}

function safeFilePart(value) {
  return String(value || "pmt-export")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
