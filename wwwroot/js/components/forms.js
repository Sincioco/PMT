import {
  escapeAttr,
  escapeHtml,
  normalizeRichHtml
} from "../shared/text-and-links.js";

export function field(label, name, currentValue, type, min = "", max = "") {
  return `<div class="field"><label>${label}</label><input name="${name}" type="${type}" value="${escapeAttr(currentValue ?? "")}" ${min !== "" ? `min="${min}"` : ""} ${max !== "" ? `max="${max}"` : ""}></div>`;
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
      <div class="rich-tools">
        <button type="button" data-command="bold" title="Bold"><b>B</b></button>
        <button type="button" data-command="underline" title="Underline"><u>U</u></button>
        <button type="button" data-command="insertUnorderedList" title="List" aria-label="List">&#8226;</button>
        <button type="button" data-command="createLink" title="Link" aria-label="Link">&#128279;</button>
      </div>
      <div class="rich-editor" contenteditable="true" data-rich="${name}">${html || ""}</div>
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
  return `
    <span class="check-list-user">
      <img class="check-list-avatar" src="${escapeAttr(user.avatarUrl || "/assets/avatar-default.svg")}" alt="">
      <span>${escapeHtml(user.nickname)}</span>
    </span>
  `;
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
