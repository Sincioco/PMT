import {
  escapeAttr,
  escapeHtml,
  normalizeRichHtml
} from "../shared/text-and-links.js?v=20260720-rte-code-block-actions-v1";
import { roleLabel } from "../shared/selectors.js?v=20260713-managed-roles";

export function field(label, name, currentValue, type, min = "", max = "", maxLength = "", options = {}) {
  const required = options.required ? ` required aria-required="true"` : "";
  return `<div class="field"><label>${escapeHtml(label)}</label><input name="${name}" type="${type}" value="${escapeAttr(currentValue ?? "")}" ${min !== "" ? `min="${min}"` : ""} ${max !== "" ? `max="${max}"` : ""} ${maxLength !== "" ? `maxlength="${maxLength}"` : ""}${required}></div>`;
}

export function colorField(label, name, currentValue) {
  const color = validColor(currentValue) ? currentValue : "#76A9FF";
  return `<div class="field"><label>${escapeHtml(label)}</label><input name="${name}" type="color" value="${escapeAttr(color)}"></div>`;
}

export function validColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || ""));
}

const richThemeColorColumns = [
  ["#FFFFFF", "#F2F2F2", "#D9D9D9", "#BFBFBF", "#A6A6A6", "#808080"],
  ["#000000", "#7F7F7F", "#595959", "#3F3F3F", "#262626", "#0D0D0D"],
  ["#E7E6E6", "#D0CECE", "#AEAAAA", "#757171", "#3A3838", "#161616"],
  ["#17365D", "#D9EAF7", "#9DC3E6", "#5B9BD5", "#2F75B5", "#1F4E79"],
  ["#0F4C5C", "#DDEBF7", "#9BC2E6", "#5B9BD5", "#1F4E79", "#073642"],
  ["#F4B183", "#FCE4D6", "#F8CBAD", "#ED7D31", "#C65911", "#833C0C"],
  ["#548235", "#E2F0D9", "#A9D18E", "#70AD47", "#548235", "#375623"],
  ["#00B0F0", "#DDEBF7", "#B4C7E7", "#5B9BD5", "#2F75B5", "#1F4E79"],
  ["#A02B93", "#F2CEEF", "#E49EDD", "#C55A9D", "#8E2F8D", "#5F1B5D"],
  ["#4EA72E", "#E2F0D9", "#C6E0B4", "#A9D18E", "#70AD47", "#375623"]
];

const richStandardColors = [
  "#C00000",
  "#FF0000",
  "#FFC000",
  "#FFFF00",
  "#92D050",
  "#00B050",
  "#00B0F0",
  "#0070C0",
  "#002060",
  "#7030A0"
];

export function selectField(label, name, items, selectedId, options = {}) {
  return selectOptionsField(label, name, items.map(item => ({ id: item.id, title: `${item.code || item.nickname || item.title} ${item.title && item.code ? "- " + item.title : ""}` })), selectedId, options);
}

export function selectOptionsField(label, name, items, selectedId, options = {}) {
  return `
    <div class="field">
      <label>${escapeHtml(label)}</label>
      <select name="${name}" ${options.required ? `required aria-required="true"` : ""}>
        ${items.map(item => `<option value="${item.id}" ${String(item.id) === String(selectedId ?? "") ? "selected" : ""}>${escapeHtml(item.title)}</option>`).join("")}
      </select>
    </div>
  `;
}

export function selectTextField(label, name, items, selectedText, options = {}) {
  return `
    <div class="field">
      <label>${escapeHtml(label)}</label>
      <select name="${name}" ${options.required ? `required aria-required="true"` : ""}>
        ${items.map(item => `<option value="${escapeAttr(item)}" ${item === selectedText ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}
      </select>
    </div>
  `;
}

export function richTextField(name, label, html, options = {}) {
  return `
    <div class="field full ${options.required ? "is-required" : ""}">
      <label>${escapeHtml(label)}</label>
      ${richTextToolsHtml()}
      <div class="rich-editor" contenteditable="true" role="textbox" aria-label="${escapeAttr(label)}" aria-multiline="true" data-rich="${name}" ${options.required ? `aria-required="true"` : ""}>${html || ""}</div>
    </div>
  `;
}

export function richTextToolsHtml(options = {}) {
  return `
    <div class="rich-tools">
      <div class="rich-tools-row">
        <button type="button" data-rich-toolbar-toggle title="Collapse Toolbar" aria-label="Collapse Toolbar" aria-pressed="false" class="rich-toolbar-toggle">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M5 7h14"></path>
            <path d="M5 12h14"></path>
            <path d="M5 17h14"></path>
          </svg>
        </button>
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
        ${richColorToolHtml({
          className: "rich-font-color-tool",
          title: "Font Color",
          command: "foreColor",
          selectedColor: "#111827",
          iconHtml: richFontColorIconHtml()
        })}
        ${richColorToolHtml({
          className: "rich-background-tool",
          title: "Background Color",
          command: "hiliteColor",
          selectedColor: "#FFF3BF",
          iconHtml: richBackgroundColorIconHtml()
        })}
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
        <button type="button" data-command="indent" title="Indent" aria-label="Indent" class="rich-indent-tool">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M10 6h10"></path>
            <path d="M10 10h10"></path>
            <path d="M4 14h16"></path>
            <path d="M4 18h16"></path>
            <path d="m4 8 4 4-4 4"></path>
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
        <button type="button" data-command="createLink" title="Link" aria-label="Link">&#128279;</button>
        <button type="button" data-command="insertRichTable" title="Insert Table" aria-label="Insert Table" class="rich-table-insert-tool">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <rect x="4" y="5" width="16" height="14" rx="1"></rect>
            <path d="M4 10h16"></path>
            <path d="M4 15h16"></path>
            <path d="M9 5v14"></path>
            <path d="M15 5v14"></path>
          </svg>
        </button>
        <button type="button" data-command="insertCheckbox" title="Checkbox" aria-label="Checkbox" class="rich-checkbox-insert-tool">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <rect x="4" y="5" width="14" height="14" rx="2"></rect>
            <path d="m8 12 3 3 7-8"></path>
          </svg>
        </button>
        <button type="button" data-command="insertSvg" title="Insert SVG" aria-label="Insert SVG" class="rich-svg-insert-tool">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M5 4h10l4 4v12H5z"></path>
            <path d="M15 4v5h5"></path>
            <path d="M7 12h3"></path>
            <path d="M7 14h2.5"></path>
            <path d="M7 16h3"></path>
            <path d="m12 12 1.4 4 1.4-4"></path>
            <path d="M19 12h-2a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h2v-2h-1"></path>
          </svg>
        </button>
        <button type="button" data-command="insertDiagram" title="Insert Diagram" aria-label="Insert Diagram" class="rich-diagram-insert-tool">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <rect x="3" y="4" width="18" height="16" rx="2"></rect>
            <rect x="6" y="7" width="5" height="4" rx="1"></rect>
            <rect x="13" y="13" width="5" height="4" rx="1"></rect>
            <path d="M11 9h4v4"></path>
          </svg>
        </button>
        <button type="button" data-command="insertLinkedDiagram" title="Insert Linked Diagram" aria-label="Insert Linked Diagram" class="rich-linked-diagram-insert-tool">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <rect x="3" y="5" width="14" height="12" rx="2"></rect>
            <path d="M7 9h4"></path>
            <path d="M7 12h6"></path>
            <path d="M15 15h2a3 3 0 0 0 0-6h-2"></path>
            <path d="M18 9h1a3 3 0 0 1 0 6h-1"></path>
          </svg>
        </button>
        <button type="button" data-command="insertHorizontalRule" title="Horizontal Divider" aria-label="Horizontal Divider" class="rich-divider-tool">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 12h16"></path>
          </svg>
        </button>
        <button type="button" data-command="insertCodeBlock" title="Code Block" aria-label="Code Block" class="rich-code-tool">&lt;/&gt;</button>
        ${options.actionsHtml || ""}
      </div>
      <div class="rich-tools-row rich-table-tools" data-rich-table-tools hidden>
        <button type="button" data-rich-table-command="insertRow" title="Insert Row" aria-label="Insert Row">R+</button>
        <button type="button" data-rich-table-command="deleteRow" title="Delete Row" aria-label="Delete Row">R-</button>
        <button type="button" data-rich-table-command="moveRowUp" title="Move Row Up" aria-label="Move Row Up">R^</button>
        <button type="button" data-rich-table-command="moveRowDown" title="Move Row Down" aria-label="Move Row Down">Rv</button>
        <button type="button" data-rich-table-command="insertColumn" title="Insert Column" aria-label="Insert Column">C+</button>
        <button type="button" data-rich-table-command="deleteColumn" title="Delete Column" aria-label="Delete Column">C-</button>
        <button type="button" data-rich-table-command="moveColumnLeft" title="Move Column Left" aria-label="Move Column Left">C&lt;</button>
        <button type="button" data-rich-table-command="moveColumnRight" title="Move Column Right" aria-label="Move Column Right">C&gt;</button>
        <button type="button" data-rich-table-command="deleteTable" title="Delete Table" aria-label="Delete Table">T-</button>
      </div>
    </div>
  `;
}

function richColorToolHtml({ className, title, command, selectedColor, iconHtml }) {
  return `
        <div class="rich-color-tool ${className}" style="--rich-selected-color: ${escapeAttr(selectedColor)}">
          <button type="button" class="rich-color-trigger" data-rich-color-command="${escapeAttr(command)}" data-rich-color-default="${escapeAttr(selectedColor)}" title="${escapeAttr(title)}" aria-label="${escapeAttr(title)}" aria-haspopup="true" aria-expanded="false">
            ${iconHtml}
          </button>
          ${richColorPaletteHtml(title, selectedColor)}
        </div>
  `;
}

function richColorPaletteHtml(title, automaticColor) {
  return `
          <div class="rich-color-palette" data-rich-color-palette hidden>
            <button type="button" class="rich-color-automatic" data-rich-color-value="${escapeAttr(automaticColor)}" aria-label="${escapeAttr(`${title} Automatic`)}">
              <span class="rich-color-automatic-swatch" style="--rich-swatch-color: ${escapeAttr(automaticColor)}"></span>
              <span class="rich-color-label-text">Automatic</span>
            </button>
            <span class="rich-color-section-title">Theme Colors</span>
            <div class="rich-color-theme-grid">
              ${richThemeColorColumns.map(column => `
                <span class="rich-color-column">
                  ${column.map(color => richColorSwatchHtml(color, title)).join("")}
                </span>
              `).join("")}
            </div>
            <span class="rich-color-section-title">Standard Colors</span>
            <div class="rich-color-standard-grid">
              ${richStandardColors.map(color => richColorSwatchHtml(color, title)).join("")}
            </div>
            <span class="rich-color-section-title" data-rich-last-colors-title hidden>Last Colors Used</span>
            <div class="rich-color-last-grid" data-rich-last-colors hidden></div>
            <span class="rich-color-section-title">Custom Colors</span>
            <div class="rich-color-custom-grid" data-rich-custom-colors hidden></div>
            <button type="button" class="rich-color-custom" data-rich-color-custom><span class="rich-color-label-text">Add custom color...</span></button>
          </div>
  `;
}

function richColorSwatchHtml(color, title) {
  const normalizedColor = normalizeColorHex(color) || color;
  const label = richColorSwatchLabel(title, normalizedColor);
  return `<button type="button" class="rich-color-swatch" data-rich-color-value="${escapeAttr(normalizedColor)}" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}" style="--rich-swatch-color: ${escapeAttr(normalizedColor)}"></button>`;
}

export function sharedRichColorPickerHtml({ name, title, selectedColor, icon = "font" }) {
  const iconHtml = icon === "background"
    ? richBackgroundColorIconHtml()
    : icon === "outline"
      ? richOutlineColorIconHtml()
      : richFontColorIconHtml();
  return `
    <div class="rich-color-tool image-annotation-color-picker" data-annotation-color-picker="${escapeAttr(name)}" style="--rich-selected-color: ${escapeAttr(selectedColor)}">
      <button type="button" class="rich-color-trigger" data-annotation-color-trigger data-rich-color-default="${escapeAttr(selectedColor)}" title="${escapeAttr(title)}" aria-label="${escapeAttr(title)}" aria-haspopup="true" aria-expanded="false">
        ${iconHtml}
      </button>
      ${richColorPaletteHtml(title, selectedColor)}
    </div>
  `;
}

function richColorSwatchLabel(title, color) {
  const rgbText = richColorRgbText(color);
  return [title, color, rgbText].filter(Boolean).join(" ");
}

function richColorRgbText(color) {
  const normalizedColor = normalizeColorHex(color);
  if (!normalizedColor) return "";

  const value = normalizedColor.slice(1);
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgb(${red}, ${green}, ${blue})`;
}

function normalizeColorHex(color) {
  const match = String(color || "").trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return "";

  const hex = match[1];
  return `#${hex.length === 3 ? hex.split("").map(part => part + part).join("") : hex}`.toUpperCase();
}

function richFontColorIconHtml() {
  return `
            <span class="rich-color-button-icon rich-font-color-icon" aria-hidden="true">
              <span class="rich-font-color-letter">A</span>
              <span class="rich-color-bar"></span>
              <span class="rich-color-chevron"></span>
            </span>
  `;
}

function richBackgroundColorIconHtml() {
  return `
            <span class="rich-color-button-icon rich-background-color-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="m5 13 7-7 6 6-7 7a2 2 0 0 1-2.8 0L5 15.8a2 2 0 0 1 0-2.8z"></path>
                <path d="M9 9 5 5"></path>
                <path d="M15 19h5"></path>
                <path d="M19 13.5c1.1 1.4 1.8 2.4 1.8 3.3a1.8 1.8 0 1 1-3.6 0c0-.9.7-1.9 1.8-3.3z"></path>
              </svg>
              <span class="rich-color-bar"></span>
              <span class="rich-color-chevron"></span>
            </span>
  `;
}

function richOutlineColorIconHtml() {
  return `
            <span class="rich-color-button-icon rich-outline-color-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <rect x="4" y="4" width="15" height="15" rx="1"></rect>
              </svg>
              <span class="rich-color-bar"></span>
              <span class="rich-color-chevron"></span>
            </span>
  `;
}

export function checkList(label, name, items, selectedIds, textSelector = item => item.nickname || item.title, options = {}) {
  if (typeof textSelector === "object" && textSelector !== null) {
    options = textSelector;
    textSelector = item => item.nickname || item.title;
  }

  const selected = new Set((selectedIds || []).map(String));
  const fieldsetClass = ["check-list field full", options.required ? "is-required" : "", options.className || ""].filter(Boolean).join(" ");
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

  const fieldsetClass = ["check-list field full", options.required ? "is-required" : "", options.className || ""].filter(Boolean).join(" ");

  return `
    <fieldset class="${fieldsetClass}">
      <legend>${escapeHtml(label)}</legend>
      <span class="muted">${escapeHtml(emptyText)}</span>
    </fieldset>
  `;
}

export function userCheckListLabelHtml(user) {
  const role = roleLabel(user.role || (user.isAdmin ? "Admin" : "Developer"));

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
  return roleLabel(user.role || (user.isAdmin ? "Admin" : "Developer"));
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
