import { appUrl } from "../shared/app-urls.js";
import { documentationWasEdited, formatDate } from "../shared/dates.js";
import {
  escapeAttr,
  escapeHtml
} from "../shared/text-and-links.js";

const blankDiagramWidth = 1600;
const blankDiagramHeight = 900;
const blankDiagramSource = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${blankDiagramWidth}" height="${blankDiagramHeight}" viewBox="0 0 ${blankDiagramWidth} ${blankDiagramHeight}">
    <rect width="${blankDiagramWidth}" height="${blankDiagramHeight}" fill="#ffffff"/>
  </svg>
`)}`;

export function documentationCardHtml(blog, options = {}) {
  const wasEdited = options.wasEdited ?? documentationWasEdited(blog);
  const isExpanded = options.isExpanded === true;
  const projectLabel = options.projectLabel || "General";
  const createdMetaHtml = options.createdMetaHtml || documentationCreatedMetaHtml(blog, options.users);
  const editedMetaHtml = options.editedMetaHtml || documentationEditedMetaHtml(blog, options.users);
  const bodyHtml = options.bodyHtml ?? blog.bodyHtml ?? "";
  const attachments = options.attachmentsHtml ?? documentationAttachmentsHtml(blog.attachments || []);
  const actionAttrs = options.actionAttrs || "";
  const actionHtml = options.actionHtml || "";
  const overflowToggleHtml = options.overflowToggleHtml || "";
  const extraClass = options.className ? ` ${options.className}` : "";

  return `
    <article class="card clickable-card documentation-card ${isExpanded ? "is-expanded" : ""}${extraClass}" ${actionAttrs} title="${escapeAttr(blog.title)}">
      <div class="documentation-card-top">
        <div class="documentation-card-title-row">
          <div class="documentation-title-block">
            <h3>${escapeHtml(blog.title)}</h3>
          </div>
          <div class="row documentation-project documentation-card-badges">
            ${documentationCardIndicatorsHtml(blog)}
            <span class="pill">${escapeHtml(projectLabel)}</span>
          </div>
        </div>
        ${wasEdited ? editedMetaHtml : createdMetaHtml}
      </div>
      <div class="rich-readonly documentation-card-body" ${options.richPersistAttrs || ""}>${bodyHtml}</div>
      ${attachments}
      <div class="documentation-card-bottom ${wasEdited ? "" : "has-top-created-meta"}">
        ${wasEdited ? createdMetaHtml : ""}
        ${actionHtml}
      </div>
      ${overflowToggleHtml}
    </article>
  `;
}

export function diagramCardHtml(document, options = {}) {
  const source = options.source || diagramImageSource(document) || blankDiagramSource;
  const visibility = document.isPrivate === false ? "Public" : "Private";
  const updatedLabel = options.updatedLabel || `Updated ${formatDate(document.updatedAt || document.createdAt)}`;
  const actionAttrs = options.actionAttrs || "";
  const extraClass = options.className ? ` ${options.className}` : "";

  return `
    <article class="card clickable-card documentation-card diagram-card${extraClass}" ${actionAttrs} title="${escapeAttr(document.title)}">
      <div class="documentation-card-top">
        <div class="documentation-card-title-row">
          <div class="documentation-title-block"><h3>${escapeHtml(document.title)}</h3></div>
          <div class="row documentation-project documentation-card-badges">
            <span class="pill">${visibility}</span>
          </div>
        </div>
        <div class="documentation-card-meta"><span>${escapeHtml(updatedLabel)}</span></div>
      </div>
      <div class="documentation-card-body diagram-card-preview">
        <img src="${escapeAttr(appUrl(source))}" alt="${escapeAttr(document.title)} preview" loading="lazy" decoding="async">
      </div>
      <div class="documentation-card-bottom has-top-created-meta">
        <div class="documentation-card-meta documentation-card-created-meta"><span>Diagram</span></div>
      </div>
    </article>
  `;
}

export function diagramImageSource(document) {
  const container = globalThis.document?.createElement?.("template");
  if (!container) return "";
  container.innerHTML = String(document?.bodyHtml || "");
  const image = container.content.querySelector("img[data-pmt-diagram='true'], img[data-pmt-private-diagram='true']");
  return String(image?.getAttribute("src") || "").trim();
}

export function isDiagramDocument(document) {
  return Boolean(diagramImageSource(document));
}

export function documentationCardIndicatorsHtml(blog) {
  return [
    blog.isPrivate !== false ? documentationCardIndicatorHtml("Private", documentationLockIconHtml()) : ""
  ].filter(Boolean).join("");
}

export function documentationCardIndicatorHtml(label, iconHtml) {
  return `
    <span class="documentation-card-indicator" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}">
      ${iconHtml}
    </span>
  `;
}

export function documentationLockIconHtml() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="5" y="10" width="14" height="10" rx="2"></rect>
      <path d="M8 10V7a4 4 0 0 1 8 0v3"></path>
      <path d="M12 14v3"></path>
    </svg>
  `;
}

function documentationAttachmentsHtml(files = []) {
  return files.length
    ? `<div class="documentation-attachments">${files.map(file => `<a href="${escapeAttr(file.url)}">${escapeHtml(file.fileName)}</a>`).join("")}</div>`
    : "";
}

function documentationCreatedMetaHtml(blog, users = []) {
  return `
    <div class="documentation-card-meta documentation-card-created-meta">
      <span>Created by: ${escapeHtml(entityUserName(users, blog.createdByUserId))}</span>
      <span>${escapeHtml(documentationCardDateTime(blog.createdAt))}</span>
    </div>
  `;
}

function documentationEditedMetaHtml(blog, users = []) {
  const history = documentationLatestUpdatedHistory(blog);

  return `
    <div class="documentation-card-meta documentation-card-edited-meta">
      <span>Last Edited by: ${escapeHtml(entityUserName(users, history?.userId || blog.createdByUserId))}</span>
      <span>${escapeHtml(documentationCardDateTime(history?.createdAt || blog.updatedAt))}</span>
    </div>
  `;
}

function documentationLatestUpdatedHistory(blog) {
  return (blog.history || []).find(item => item.action === "Updated") || null;
}

function entityUserName(users, userId) {
  const user = (users || []).find(item => Number(item.id || 0) === Number(userId || 0));
  if (!user) return "User";

  const fullName = [user.firstName, user.lastName]
    .map(part => String(part || "").trim())
    .filter(Boolean)
    .join(" ");
  const nickname = String(user.nickname || "").trim();
  if (fullName && nickname && fullName.toLocaleLowerCase() !== nickname.toLocaleLowerCase()) return `${fullName} (${nickname})`;

  return fullName || nickname || "User";
}

function documentationCardDateTime(value) {
  if (!value) return "";

  return new Date(value).toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).replace(",", "").toLowerCase();
}
