import {
  escapeAttr,
  escapeHtml,
  normalizeRichHtml
} from "../shared/text-and-links.js?v=20260627-rich-text-toolbar";

export function field(label, name, currentValue, type, min = "", max = "", maxLength = "") {
  return `<div class="field"><label>${label}</label><input name="${name}" type="${type}" value="${escapeAttr(currentValue ?? "")}" ${min !== "" ? `min="${min}"` : ""} ${max !== "" ? `max="${max}"` : ""} ${maxLength !== "" ? `maxlength="${maxLength}"` : ""}></div>`;
}

export function colorField(label, name, currentValue) {
  const color = validColor(currentValue) ? currentValue : "#76A9FF";
  return `<div class="field"><label>${label}</label><input name="${name}" type="color" value="${escapeAttr(color)}"></div>`;
}

export function validColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || ""));
}

export function selectField(label, name, items, selectedId) {
  return selectOptionsField(label, name, items.map(item => ({ id: item.id, title: `${item.code || item.nickname || item.title} ${item.title && item.code ? "- " + item.title : ""}` })), selectedId);
}

export function selectOptionsField(label, name, items, selectedId) {
  return `
    <div class="field">
      <label>${label}</label>
      <select name="${name}">
        ${items.map(item => `<option value="${item.id}" ${String(item.id) === String(selectedId ?? "") ? "selected" : ""}>${escapeHtml(item.title)}</option>`).join("")}
      </select>
    </div>
  `;
}

export function selectTextField(label, name, items, selectedText) {
  return `
    <div class="field">
      <label>${label}</label>
      <select name="${name}">
        ${items.map(item => `<option value="${escapeAttr(item)}" ${item === selectedText ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}
      </select>
    </div>
  `;
}

export function richTextField(name, label, html) {
  return `
    <div class="field full">
      <label>${label}</label>
      ${richTextToolsHtml()}
      <div class="rich-editor" contenteditable="true" data-rich="${name}">${html || ""}</div>
    </div>
  `;
}

export function richTextToolsHtml(options = {}) {
  return `
    <div class="rich-tools">
      <div class="rich-tools-row">
        <select data-rich-format title="Text Style" aria-label="Text Style">
          <option value="">Style</option>
          <option value="title">Title</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="body">Body</option>
        </select>
        <select data-rich-font title="Font" aria-label="Font">
          <option value="">Font</option>
          <option value="Arial">Arial</option>
          <option value="Georgia">Georgia</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Verdana">Verdana</option>
          <option value="Tahoma">Tahoma</option>
          <option value="Trebuchet MS">Trebuchet MS</option>
          <option value="Courier New">Courier New</option>
        </select>
        <select data-rich-font-size title="Font Size" aria-label="Font Size">
          <option value="">Size</option>
          <option value="2">Small</option>
          <option value="3">Normal</option>
          <option value="4">Large</option>
          <option value="5">Extra Large</option>
          <option value="6">Huge</option>
        </select>
        <label class="rich-color-tool rich-font-color-tool" title="Font Color" aria-label="Font Color" style="--rich-selected-color: #111827">
          <span class="rich-color-button-icon rich-font-color-icon" aria-hidden="true">
            <span class="rich-font-color-letter">A</span>
            <span class="rich-color-bar"></span>
            <span class="rich-color-chevron"></span>
          </span>
          <input type="color" data-rich-color-command="foreColor" value="#111827" title="Font Color" aria-label="Font Color">
        </label>
        <label class="rich-color-tool rich-background-tool" title="Background Color" aria-label="Background Color" style="--rich-selected-color: #fff3bf">
          <span class="rich-color-button-icon rich-background-color-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M5 16.5 13.5 8l3 3L8 19.5H5z"></path>
              <path d="m12.5 7 1.8-1.8a1.4 1.4 0 0 1 2 0l2.5 2.5a1.4 1.4 0 0 1 0 2L17 11.5"></path>
              <path d="M4 20h16"></path>
            </svg>
            <span class="rich-color-bar"></span>
            <span class="rich-color-chevron"></span>
          </span>
          <input type="color" data-rich-color-command="hiliteColor" value="#fff3bf" title="Background Color" aria-label="Background Color">
        </label>
        <button type="button" data-rich-source title="View Source" aria-label="View Source" class="rich-source-tool">{}</button>
        <button type="button" data-rich-clear-formatting title="Clear Formatting" aria-label="Clear Formatting" class="rich-clear-formatting-tool">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 15l8.5-8.5a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L10 19H4z"></path>
            <path d="M9 19h11"></path>
            <path d="M8.5 10.5l5 5"></path>
          </svg>
        </button>
      </div>
      <div class="rich-tools-row">
        <button type="button" data-command="bold" title="Bold"><b>B</b></button>
        <button type="button" data-command="underline" title="Underline"><u>U</u></button>
        <button type="button" data-command="strikeThrough" title="Strikethrough" aria-label="Strikethrough"><s>S</s></button>
        <button type="button" data-command="insertUnorderedList" title="Bullet List" aria-label="Bullet List">&#8226;</button>
        <button type="button" data-command="insertOrderedList" title="Numbered List" aria-label="Numbered List">1.</button>
        <button type="button" data-command="justifyLeft" title="Align Left" aria-label="Align Left" class="rich-align-tool">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 6h14"></path>
            <path d="M4 10h10"></path>
            <path d="M4 14h14"></path>
            <path d="M4 18h10"></path>
          </svg>
        </button>
        <button type="button" data-command="justifyCenter" title="Align Center" aria-label="Align Center" class="rich-align-tool">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M5 6h14"></path>
            <path d="M8 10h8"></path>
            <path d="M5 14h14"></path>
            <path d="M8 18h8"></path>
          </svg>
        </button>
        <button type="button" data-command="justifyRight" title="Align Right" aria-label="Align Right" class="rich-align-tool">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M6 6h14"></path>
            <path d="M10 10h10"></path>
            <path d="M6 14h14"></path>
            <path d="M10 18h10"></path>
          </svg>
        </button>
        <button type="button" data-command="outdent" title="Unindent" aria-label="Unindent" class="rich-indent-tool">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M10 6h10"></path>
            <path d="M10 10h10"></path>
            <path d="M4 14h16"></path>
            <path d="M4 18h16"></path>
            <path d="M8 8 4 12l4 4"></path>
          </svg>
        </button>
        <button type="button" data-command="indent" title="Indent" aria-label="Indent" class="rich-indent-tool">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M10 6h10"></path>
            <path d="M10 10h10"></path>
            <path d="M4 14h16"></path>
            <path d="M4 18h16"></path>
            <path d="m4 8 4 4-4 4"></path>
          </svg>
        </button>
        <button type="button" data-command="createLink" title="Link" aria-label="Link">&#128279;</button>
        <button type="button" data-command="insertCodeBlock" title="Code Block" aria-label="Code Block" class="rich-code-tool">&lt;/&gt;</button>
        ${options.actionsHtml || ""}
      </div>
    </div>
  `;
}

export function checkList(label, name, items, selectedIds, textSelector = item => item.nickname || item.title, options = {}) {
  if (typeof textSelector === "object" && textSelector !== null) {
    options = textSelector;
    textSelector = item => item.nickname || item.title;
  }

  const selected = new Set((selectedIds || []).map(String));
  const fieldsetClass = ["check-list field full", options.className || ""].filter(Boolean).join(" ");
  const renderItem = options.renderItem || (item => escapeHtml(textSelector(item)));

  return `
    <fieldset class="${fieldsetClass}">
      <legend>${escapeHtml(label)}</legend>
      ${items.map(item => `
        <label>
          <input type="checkbox" name="${name}" value="${escapeAttr(item.id)}" ${selected.has(String(item.id)) ? "checked" : ""}>
          <span class="check-list-label">${renderItem(item)}</span>
        </label>
      `).join("")}
    </fieldset>
  `;
}

export function checkListOrEmpty(label, name, items, selectedIds, emptyText, options = {}) {
  if (items.length) return checkList(label, name, items, selectedIds, options);

  return `
    <fieldset class="check-list field full">
      <legend>${escapeHtml(label)}</legend>
      <span class="muted">${escapeHtml(emptyText)}</span>
    </fieldset>
  `;
}

export function userCheckListLabelHtml(user) {
  const role = user.role || (user.isAdmin ? "Admin" : "Developer");

  return `
    <span class="check-list-user">
      <img class="check-list-avatar" src="${escapeAttr(user.avatarUrl || "/assets/avatar-default.svg")}" alt="">
      <span>${escapeHtml(user.nickname)} (${escapeHtml(role)})</span>
    </span>
  `;
}

const userCardAvatarCacheVersion = "20260629-avatar-jpg-assets";
const seededUserCardAvatarPaths = new Set([
  "/assets/avatar-sin.jpg",
  "/assets/avatar-bill-gates.jpg",
  "/assets/avatar-sam-altman.jpg",
  "/assets/avatar-mark-zuckerberg.jpg",
  "/assets/avatar-steve-jobs.jpg",
  "/assets/avatar-jensen-huang.jpg"
]);
const legacyUserCardAvatarPaths = new Map([
  ["/assets/avatar-sin.png", "/assets/avatar-sin.jpg"],
  ["/assets/avatar-bill-gates.png", "/assets/avatar-bill-gates.jpg"],
  ["/assets/avatar-sam-altman.png", "/assets/avatar-sam-altman.jpg"],
  ["/assets/avatar-mark-zuckerberg.png", "/assets/avatar-mark-zuckerberg.jpg"],
  ["/assets/avatar-steve-jobs.png", "/assets/avatar-steve-jobs.jpg"],
  ["/assets/avatar-jensen-huang.png", "/assets/avatar-jensen-huang.jpg"],
  ["/assets/avatar-lisa-su.jpg", "/assets/avatar-jensen-huang.jpg"]
]);

export function userCardCheckListLabelHtml(user) {
  return `
    <span class="user-card-check-list-option">
      <img class="user-card-check-list-avatar" src="${escapeAttr(userCardAvatarUrl(user))}" alt="${escapeAttr(userDisplayName(user))} avatar">
      <span class="user-card-check-list-summary">
        <span class="user-card-check-list-name">${userCardNameHtml(user)}</span>
        <span class="user-card-check-list-title muted">${escapeHtml(userTitle(user))}</span>
        <span class="user-card-check-list-email">${escapeHtml(user.email || "")}</span>
      </span>
    </span>
  `;
}

function userCardAvatarUrl(user) {
  const avatarUrl = (user.avatarUrl || "/assets/avatar-default.svg").trim();
  const [pathPart, queryString = ""] = avatarUrl.split("?", 2);
  const avatarPath = legacyUserCardAvatarPaths.get(pathPart.toLowerCase()) || pathPart;
  if (!seededUserCardAvatarPaths.has(avatarPath.toLowerCase())) return avatarUrl;

  const params = new URLSearchParams(queryString);
  params.set("v", userCardAvatarCacheVersion);
  return `${avatarPath}?${params.toString()}`;
}

function userDisplayName(user) {
  return [user.firstName, user.lastName]
    .map(part => (part || "").trim())
    .filter(Boolean)
    .join(" ") || user.nickname || "User";
}

function userCardNameHtml(user) {
  const fullName = userDisplayName(user);
  const nickname = (user.nickname || "").trim();
  const showNickname = nickname && nickname.toLowerCase() !== fullName.toLowerCase();

  return `${escapeHtml(fullName)}${showNickname ? ` (${escapeHtml(nickname)})` : ""}`;
}

function userTitle(user) {
  return user.role || (user.isAdmin ? "Admin" : "Developer");
}

export function value(root, name) {
  return root.querySelector(`[name='${name}']`)?.value || "";
}

export function numberValue(root, name) {
  return Number(value(root, name) || 0);
}

export function optionalNumberValue(root, name) {
  const raw = value(root, name);
  return raw === "" ? null : Number(raw);
}

export function nullableDateValue(root, name) {
  const raw = value(root, name);
  return raw || null;
}

export function richValue(root, name) {
  return normalizeRichHtml(root.querySelector(`[data-rich='${name}']`)?.innerHTML || "");
}

export function checkedNumbers(root, name) {
  return [...root.querySelectorAll(`[name='${name}']:checked`)].map(input => Number(input.value));
}
