import { escapeAttr, escapeHtml } from "../shared/text-and-links.js";

const renderedMentionSelector = [
  ".rich-readonly",
  ".log-content",
  ".scrum-content",
  ".release-note-content"
].join(", ");

const mentionBlockedAncestorSelector = [
  ".user-mention",
  ".user-mention-tooltip",
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
const mentionBoundaryPattern = /[\p{L}\p{N}._%+-]/u;
const tooltipId = "userMentionTooltip";

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

export function htmlWithoutUserMentionMarkup(container) {
  if (!container?.cloneNode) return "";

  const clone = container.cloneNode(true);
  clone.querySelectorAll?.(".user-mention[data-user-mention-id]").forEach(mention => {
    mention.replaceWith(mention.ownerDocument.createTextNode(mention.textContent || ""));
  });
  return clone.innerHTML || "";
}

export function initializeUserMentions({ getUsers = () => [], getRoles = () => [] } = {}) {
  let activeMention = null;
  let tooltip = null;
  let hideTimer = 0;

  const refresh = (root = document) => {
    matchingElements(root, renderedMentionSelector).forEach(container => decorateRenderedContent(container, getUsers()));
  };

  const observer = new MutationObserver(records => {
    records.forEach(record => {
      record.addedNodes.forEach(processAddedNode);
    });
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  refresh();

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
  window.addEventListener("resize", positionActiveTooltip);
  window.addEventListener("scroll", positionActiveTooltip, true);

  return { refresh };

  function processAddedNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.parentElement?.closest(renderedMentionSelector)) decorateTextNode(node, getUsers());
      return;
    }

    if (!(node instanceof HTMLElement)) return;
    if (node.closest(mentionBlockedAncestorSelector)) return;

    if (node.closest(renderedMentionSelector)) {
      decorateRenderedContent(node, getUsers());
      return;
    }

    matchingElements(node, renderedMentionSelector).forEach(container => decorateRenderedContent(container, getUsers()));
  }

  function showMentionTooltip(mention) {
    clearTimeout(hideTimer);
    const user = activeUserById(getUsers(), mention.dataset.userMentionId);
    if (!user) return;

    activeMention?.removeAttribute("aria-describedby");
    activeMention = mention;
    tooltip?.remove();

    tooltip = document.createElement("div");
    tooltip.id = tooltipId;
    tooltip.className = "user-mention-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.innerHTML = userMentionCardHtml(user, getRoles());
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
}

function decorateRenderedContent(root, users) {
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

  textNodes.forEach(textNode => decorateTextNode(textNode, users));
}

function decorateTextNode(textNode, users) {
  if (!textNode?.parentNode || textNode.parentElement?.closest(mentionBlockedAncestorSelector)) return;

  const matches = findUserMentionMatches(textNode.nodeValue, users);
  if (!matches.length) return;

  const ownerDocument = textNode.ownerDocument || document;
  const fragment = ownerDocument.createDocumentFragment();
  let cursor = 0;

  matches.forEach(match => {
    if (match.start > cursor) fragment.appendChild(ownerDocument.createTextNode(textNode.nodeValue.slice(cursor, match.start)));

    const mention = ownerDocument.createElement("span");
    mention.className = "user-mention";
    mention.tabIndex = 0;
    mention.dataset.userMentionId = String(match.userId);
    mention.setAttribute("aria-label", `${match.text}, show user card`);
    mention.textContent = match.text;
    fragment.appendChild(mention);
    cursor = match.end;
  });

  if (cursor < textNode.nodeValue.length) {
    fragment.appendChild(ownerDocument.createTextNode(textNode.nodeValue.slice(cursor)));
  }
  textNode.parentNode.replaceChild(fragment, textNode);
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
  return target instanceof Element ? target.closest(".user-mention[data-user-mention-id]") : null;
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
