import { normalizeSavedArray } from "../shared/filter-values.js";
import {
  escapeAttr,
  escapeHtml
} from "../shared/text-and-links.js";

export function filterSelect(label, filterName, items, selectedValue, emptyText) {
  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <select data-filter="${filterName}">
        <option value="">${escapeHtml(emptyText)}</option>
        ${items.map(item => `<option value="${escapeAttr(item.value)}" ${String(item.value) === String(selectedValue) ? "selected" : ""}>${escapeHtml(item.text)}</option>`).join("")}
      </select>
    </label>
  `;
}

export function filterCheckList(label, filterName, items, selectedValues) {
  const selected = new Set(normalizeSavedArray(selectedValues));

  return `
    <fieldset class="filter-check-list">
      <legend>${escapeHtml(label)}</legend>
      ${items.map(item => `
        <label>
          <input type="checkbox" data-filter="${filterName}" value="${escapeAttr(item.value)}" ${selected.has(String(item.value)) ? "checked" : ""}>
          <span>${escapeHtml(item.text)}</span>
        </label>
      `).join("")}
    </fieldset>
  `;
}

export function checkedFilterValues(filterName) {
  return [...document.querySelectorAll(`[data-filter='${filterName}']:checked`)].map(input => String(input.value));
}
