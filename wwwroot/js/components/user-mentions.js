import {
  diagramCardHtml,
  isDiagramDocument,
  documentationCardHtml
} from "./entity-cards.js?v=20260722-rich-entity-mentions-v1";
import { workItemKanbanCardHtml } from "./work-items.js?v=20260722-rich-entity-mentions-v1";
import {
  escapeAttr,
  escapeHtml,
  normalizeCodeBlocksForStorage,
  normalizeCollapsibleBlocksForStorage,
  normalizeDiagramOleBlocksForStorage
} from "../shared/text-and-links.js?v=20260722-rte-toggle-state-v1";

const renderedMentionSelector = [
  ".rich-readonly",
  ".log-content",
  ".scrum-content",
  ".release-note-content"
].join(", ");

const mentionBlockedAncestorSelector = [
  ".user-mention",
  ".user-mention-tooltip",
  ".rich-entity-mention",
  ".rich-entity-live-card",
  ".rich-editor",
  "[contenteditable='true']",
  "a",
  "code",
  "kbd",
  "samp",
  "script",
  "style",
  "textarea"
].join(", ");

const mentionTokenPattern = /@\{([^{}\r\n]+)\}|@([\p{L}\p{N}](?:[\p{L}\p{N}._-]*[\p{L}\p{N}])?)/gu;
const entityMentionTokenPattern = /@(livetask|livebug|livedoc|livedocument|livediagram|task|bug|doc|document|diagram)\/([1-9]\d*)(?![\p{L}\p{N}_-])/giu;
const mentionBoundaryPattern = /[\p{L}\p{N}._%+-]/u;
const tooltipId = "userMentionTooltip";
const liveEntityRefreshMs = 7000;

const entityTokenAliases = {
  task: { entityType: "task", embed: false },
  bug: { entityType: "bug", embed: false },
  doc: { entityType: "document", embed: false },
  document: { entityType: "document", embed: false },
  diagram: { entityType: "diagram", embed: false },
  livetask: { entityType: "task", embed: true },
  livebug: { entityType: "bug", embed: true },
  livedoc: { entityType: "document", embed: true },
  livedocument: { entityType: "document", embed: true },
  livediagram: { entityType: "diagram", embed: true }
};

export function findUserMentionMatches(text, users) {
  const source = String(text || "");
  const usersByNickname = activeUsersByNickname(users);
  const matches = [];

  for (const match of source.matchAll(mentionTokenPattern)) {
    const start = Number(match.index || 0);
    if (start > 0 && mentionBoundaryPattern.test(source[start - 1])) continue;

    const nickname = String(match[1] || match[2] || "").trim();
    const user = usersByNickname.get(nickname.toLocaleLowerCase());
    if (!user) continue;

    matches.push({
      start,
      end: start + match[0].length,
      text: match[0],
      userId: Number(user.id || 0)
    });
  }

  return matches;
}

export function findEntityReferenceMatches(text) {
  const source = String(text || "");
  const matches = [];

  for (const match of source.matchAll(entityMentionTokenPattern)) {
    const start = Number(match.index || 0);
    if (start > 0 && mentionBoundaryPattern.test(source[start - 1])) continue;

    const alias = entityTokenAliases[String(match[1] || "").toLocaleLowerCase()];
    const entityId = Number(match[2] || 0);
    if (!alias || !entityId) continue;

    matches.push({
      start,
      end: start + match[0].length,
      text: match[0],
      token: match[0],
      entityType: alias.entityType,
      entityId,
      embed: alias.embed
    });
  }

  return matches;
}

export function htmlWithoutUserMentionMarkup(container) {
  if (!container?.cloneNode) return "";

  const clone = container.cloneNode(true);
  clone.querySelectorAll?.(".rich-entity-mention[data-rich-entity-token], .rich-entity-live-card[data-rich-entity-token]").forEach(mention => {
    mention.replaceWith(mention.ownerDocument.createTextNode(mention.dataset.richEntityToken || mention.textContent || ""));
  });
  clone.querySelectorAll?.(".user-mention[data-user-mention-id]").forEach(mention => {
    mention.replaceWith(mention.ownerDocument.createTextNode(mention.textContent || ""));
  });
  clone.querySelectorAll?.(".rich-code-actions").forEach(node => node.remove());
  normalizeCodeBlocksForStorage(clone);
  normalizeCollapsibleBlocksForStorage(clone);
  normalizeDiagramOleBlocksForStorage(clone);
  return clone.innerHTML || "";
}

export function initializeUserMentions({
  getUsers = () => [],
  getRoles = () => [],
  getTasks = () => [],
  getBlogs = () => [],
  getProjects = () => [],
  getSprints = () => []
} = {}) {
  let activeMention = null;
  let tooltip = null;
  let hideTimer = 0;
  let refreshTimer = 0;
  const renderedLiveEntityCards = new WeakMap();

  const refresh = (root = document) => {
    matchingElements(root, renderedMentionSelector).forEach(container => decorateRenderedContent(container, mentionContext()));
    refreshLiveEntityCards(root);
  };

  const observer = new MutationObserver(records => {
    records.forEach(record => {
      record.addedNodes.forEach(processAddedNode);
    });
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  refresh();
  refreshTimer = window.setInterval(() => refreshLiveEntityCards(document), liveEntityRefreshMs);

  document.addEventListener("pointerover", event => {
    const mention = mentionFromTarget(event.target);
    if (mention) showMentionTooltip(mention);
  });
  document.addEventListener("pointerout", event => {
    const mention = mentionFromTarget(event.target);
    if (!mention || mention.contains(event.relatedTarget) || tooltip?.contains(event.relatedTarget)) return;
    scheduleHide();
  });
  document.addEventListener("focusin", event => {
    const mention = mentionFromTarget(event.target);
    if (mention) showMentionTooltip(mention);
  });
  document.addEventListener("focusout", event => {
    const mention = mentionFromTarget(event.target);
    if (!mention || tooltip?.contains(event.relatedTarget)) return;
    scheduleHide();
  });
  document.addEventListener("pointerdown", event => {
    if (!activeMention) return;
    if (activeMention.contains(event.target) || tooltip?.contains(event.target)) return;
    hideTooltip();
  });
  window.addEventListener("resize", positionActiveTooltip);
  window.addEventListener("scroll", positionActiveTooltip, true);

  return {
    refresh,
    disconnect() {
      observer.disconnect();
      window.clearInterval(refreshTimer);
    }
  };

  function mentionContext() {
    return {
      users: getUsers(),
      roles: getRoles(),
      tasks: getTasks(),
      blogs: getBlogs(),
      projects: getProjects(),
      sprints: getSprints()
    };
  }

  function processAddedNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.parentElement?.closest(renderedMentionSelector)) decorateTextNode(node, mentionContext());
      return;
    }

    if (!(node instanceof HTMLElement)) return;
    if (node.closest(mentionBlockedAncestorSelector)) return;

    if (node.closest(renderedMentionSelector)) {
      decorateRenderedContent(node, mentionContext());
      refreshLiveEntityCards(node);
      return;
    }

    matchingElements(node, renderedMentionSelector).forEach(container => decorateRenderedContent(container, mentionContext()));
    refreshLiveEntityCards(node);
  }

  function showMentionTooltip(mention) {
    clearTimeout(hideTimer);
    const context = mentionContext();
    const isEntityMention = Boolean(mention.dataset.richEntityType);
    const user = isEntityMention ? null : activeUserById(context.users, mention.dataset.userMentionId);
    if (!isEntityMention && !user) return;

    activeMention?.removeAttribute("aria-describedby");
    activeMention = mention;
    tooltip?.remove();

    tooltip = document.createElement("div");
    tooltip.id = tooltipId;
    tooltip.className = isEntityMention ? "user-mention-tooltip rich-entity-tooltip" : "user-mention-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.innerHTML = isEntityMention
      ? entityReferenceCardHtml(entityReferenceFromDataset(mention.dataset), context)
      : userMentionCardHtml(user, context.roles);
    tooltip.addEventListener("pointerenter", () => clearTimeout(hideTimer));
    tooltip.addEventListener("pointerleave", scheduleHide);
    tooltip.addEventListener("focusout", event => {
      if (!activeMention?.contains(event.relatedTarget) && !tooltip?.contains(event.relatedTarget)) scheduleHide();
    });

    (mention.closest("dialog") || document.body).appendChild(tooltip);
    mention.setAttribute("aria-describedby", tooltipId);
    positionActiveTooltip();
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      const focused = document.activeElement;
      if (activeMention?.contains(focused) || tooltip?.contains(focused)) return;
      hideTooltip();
    }, 80);
  }

  function hideTooltip() {
    activeMention?.removeAttribute("aria-describedby");
    activeMention = null;
    tooltip?.remove();
    tooltip = null;
  }

  function positionActiveTooltip() {
    if (!activeMention?.isConnected || !tooltip?.isConnected) return;

    const anchor = activeMention.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const hostDialog = activeMention.closest("dialog");
    const boundary = hostDialog?.getBoundingClientRect() || {
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
      left: 0
    };
    const gap = 8;
    const inset = 8;
    const maximumLeft = Math.max(boundary.left + inset, boundary.right - tooltipRect.width - inset);
    const left = Math.min(Math.max(anchor.left, boundary.left + inset), maximumLeft);
    const preferredTop = anchor.bottom + gap;
    const aboveTop = anchor.top - tooltipRect.height - gap;
    const top = preferredTop + tooltipRect.height <= boundary.bottom - inset
      ? preferredTop
      : Math.max(boundary.top + inset, aboveTop);

    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
  }

  function refreshLiveEntityCards(root = document) {
    const context = mentionContext();
    matchingElements(root, ".rich-entity-live-card[data-rich-entity-type][data-rich-entity-id]").forEach(card => {
      const nextHtml = entityReferenceCardHtml(entityReferenceFromDataset(card.dataset), context, { embedded: true });
      if (renderedLiveEntityCards.get(card) === nextHtml) return;
      card.innerHTML = nextHtml;
      renderedLiveEntityCards.set(card, nextHtml);
    });
  }
}

function decorateRenderedContent(root, context) {
  if (!root || root.closest?.(mentionBlockedAncestorSelector)) return;

  const ownerDocument = root.ownerDocument || document;
  const walker = ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node = walker.nextNode();
  while (node) {
    if (node.nodeValue?.includes("@") && !node.parentElement?.closest(mentionBlockedAncestorSelector)) {
      textNodes.push(node);
    }
    node = walker.nextNode();
  }

  textNodes.forEach(textNode => decorateTextNode(textNode, context));
}

function decorateTextNode(textNode, context) {
  if (!textNode?.parentNode || textNode.parentElement?.closest(mentionBlockedAncestorSelector)) return;

  const matches = findRenderedMentionMatches(textNode.nodeValue, context.users);
  if (!matches.length) return;

  const ownerDocument = textNode.ownerDocument || document;
  const fragment = ownerDocument.createDocumentFragment();
  let cursor = 0;

  matches.forEach(match => {
    if (match.start > cursor) fragment.appendChild(ownerDocument.createTextNode(textNode.nodeValue.slice(cursor, match.start)));

    if (match.kind === "entity" && match.embed) {
      const card = ownerDocument.createElement("span");
      card.className = "rich-entity-live-card";
      card.dataset.richEntityType = match.entityType;
      card.dataset.richEntityId = String(match.entityId);
      card.dataset.richEntityToken = match.token;
      card.innerHTML = entityReferenceCardHtml(match, context, { embedded: true });
      fragment.appendChild(card);
    } else if (match.kind === "entity") {
      const mention = ownerDocument.createElement("span");
      mention.className = "user-mention rich-entity-mention";
      mention.tabIndex = 0;
      mention.dataset.richEntityType = match.entityType;
      mention.dataset.richEntityId = String(match.entityId);
      mention.dataset.richEntityToken = match.token;
      mention.setAttribute("aria-label", `${match.text}, show ${entityTypeLabel(match.entityType)} card`);
      mention.textContent = match.text;
      fragment.appendChild(mention);
    } else {
      const mention = ownerDocument.createElement("span");
      mention.className = "user-mention";
      mention.tabIndex = 0;
      mention.dataset.userMentionId = String(match.userId);
      mention.setAttribute("aria-label", `${match.text}, show user card`);
      mention.textContent = match.text;
      fragment.appendChild(mention);
    }
    cursor = match.end;
  });

  if (cursor < textNode.nodeValue.length) {
    fragment.appendChild(ownerDocument.createTextNode(textNode.nodeValue.slice(cursor)));
  }
  textNode.parentNode.replaceChild(fragment, textNode);
}

function findRenderedMentionMatches(text, users) {
  const entityMatches = findEntityReferenceMatches(text).map(match => ({ ...match, kind: "entity" }));
  const userMatches = findUserMentionMatches(text, users)
    .filter(match => !entityMatches.some(entityMatch => rangesOverlap(match, entityMatch)))
    .map(match => ({ ...match, kind: "user" }));

  return [...entityMatches, ...userMatches].sort((a, b) => a.start - b.start || b.end - a.end);
}

function rangesOverlap(left, right) {
  return left.start < right.end && right.start < left.end;
}

function activeUsersByNickname(users) {
  const result = new Map();
  (users || []).forEach(user => {
    const nickname = String(user?.nickname || "").trim();
    if (!nickname || user?.isActive === false || !Number(user?.id || 0)) return;

    const key = nickname.toLocaleLowerCase();
    if (!result.has(key)) result.set(key, user);
  });
  return result;
}

function activeUserById(users, userId) {
  const id = Number(userId || 0);
  return (users || []).find(user => Number(user?.id || 0) === id && user?.isActive !== false) || null;
}

function mentionFromTarget(target) {
  return target instanceof Element
    ? target.closest(".user-mention[data-user-mention-id], .rich-entity-mention[data-rich-entity-type][data-rich-entity-id]")
    : null;
}

function matchingElements(root, selector) {
  const matches = [];
  if (root?.matches?.(selector)) matches.push(root);
  root?.querySelectorAll?.(selector).forEach(element => matches.push(element));
  return matches;
}

function userMentionCardHtml(user, roles) {
  const displayName = userDisplayName(user);
  const nickname = String(user.nickname || "").trim();
  const title = userTitle(user, roles);
  const email = String(user.email || "").trim();
  const phone = String(user.phone || "").trim();
  const hasLastLogin = Object.prototype.hasOwnProperty.call(user, "lastLoginAt");

  return `
    <article class="user-mention-card">
      <img class="user-mention-card-avatar" src="${escapeAttr(user.avatarUrl || "/assets/avatar-default.svg")}" alt="${escapeAttr(displayName)} avatar">
      <div class="user-mention-card-summary">
        <strong class="user-mention-card-name">${escapeHtml(displayName)}</strong>
        ${nickname && nickname.toLocaleLowerCase() !== displayName.toLocaleLowerCase() ? `<span class="user-mention-card-nickname">@${escapeHtml(nickname)}</span>` : ""}
        <span class="user-mention-card-title">${escapeHtml(title)}</span>
        ${email ? `<a class="user-mention-card-contact" href="mailto:${escapeAttr(email)}">${escapeHtml(email)}</a>` : ""}
        ${phone ? `<span class="user-mention-card-contact">${escapeHtml(phone)}</span>` : ""}
        ${hasLastLogin ? `<span class="user-mention-card-last-login">Last login: ${escapeHtml(user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Never")}</span>` : ""}
      </div>
    </article>
  `;
}

function entityReferenceFromDataset(dataset) {
  return {
    entityType: dataset.richEntityType || "",
    entityId: Number(dataset.richEntityId || 0),
    token: dataset.richEntityToken || "",
    text: dataset.richEntityToken || `@${dataset.richEntityType || "item"}/${dataset.richEntityId || ""}`
  };
}

function entityReferenceCardHtml(reference, context, options = {}) {
  const resolved = resolveEntityReference(reference, context);
  if (!resolved) return unavailableEntityCardHtml(reference);

  if (resolved.entityType === "task" || resolved.entityType === "bug") {
    return workItemKanbanCardHtml(resolved.entity, {
      className: options.embedded ? "rich-entity-work-card" : "rich-entity-tooltip-work-card"
    });
  }
  if (resolved.entityType === "diagram") {
    return diagramCardHtml(resolved.entity, {
      className: options.embedded ? "rich-entity-diagram-card" : "rich-entity-tooltip-diagram-card"
    });
  }

  return documentationCardHtml(resolved.entity, {
    users: context.users,
    projectLabel: projectLabel(context.projects, resolved.entity.projectId),
    className: options.embedded ? "rich-entity-document-card" : "rich-entity-tooltip-document-card"
  });
}

function resolveEntityReference(reference, context) {
  const entityType = String(reference?.entityType || "").toLocaleLowerCase();
  const entityId = Number(reference?.entityId || 0);
  if (!entityType || !entityId) return null;

  if (entityType === "task" || entityType === "bug") {
    const entity = (context.tasks || []).find(task =>
      Number(task.id || 0) === entityId
      && (entityType === "bug" ? task.taskType === "Bug" : task.taskType !== "Bug"));
    return entity ? { entityType, entity } : null;
  }

  const entity = (context.blogs || []).find(blog => {
    if (Number(blog.id || 0) !== entityId) return false;
    const isDiagram = isDiagramDocument(blog);
    return entityType === "diagram" ? isDiagram : !isDiagram;
  });
  return entity ? { entityType, entity } : null;
}

function unavailableEntityCardHtml(reference) {
  const label = entityTypeLabel(reference?.entityType);
  return `
    <article class="rich-entity-unavailable-card">
      <strong>${escapeHtml(label)} not available</strong>
      <span>${escapeHtml(reference?.text || reference?.token || "")}</span>
    </article>
  `;
}

function entityTypeLabel(entityType) {
  if (entityType === "bug") return "Bug Report";
  if (entityType === "document") return "Document";
  if (entityType === "diagram") return "Diagram";
  return "Dev Task";
}

function projectLabel(projects, projectId) {
  const project = (projects || []).find(item => Number(item.id || 0) === Number(projectId || 0));
  return project?.code || "General";
}

function userDisplayName(user) {
  return [user.firstName, user.lastName]
    .map(part => String(part || "").trim())
    .filter(Boolean)
    .join(" ") || String(user.nickname || "").trim() || "User";
}

function userTitle(user, roles) {
  const roleCode = String(user.role || "Developer").trim() || "Developer";
  const title = (roles || []).find(role => role.code === roleCode)?.value || roleCode;
  return user.isAdmin && !/\(Admin\)$/i.test(title) ? `${title} (Admin)` : title;
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "");
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}
