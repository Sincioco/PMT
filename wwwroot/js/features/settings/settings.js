import { buttonContent, funnelIconHtml, iconButton } from "../../components/buttons.js";
import { askYesNo } from "../../components/dialogs.js";
import {
  colorField,
  field,
  numberValue,
  selectTextField,
  value
} from "../../components/forms.js?v=20260629-avatar-jpg-assets";
import {
  defaultStatusColor,
  statusColor
} from "../../components/progress-and-status.js?v=20260627-dev-task-status-rules";
import { sectionHead } from "../../components/sections.js";
import { api } from "../../core/api.js";
import {
  currentUser,
  currentUserId
} from "../../core/authentication.js";
import {
  navigationSettingsItems,
  readNavigationConfig,
  resetNavigationConfig,
  writeNavigationConfig
} from "../../core/navigation-preferences.js?v=20260621-bug-icon";
import {
  clearPmtPreferences,
  preferenceKeys,
  readJsonPreference,
  readPreference,
  writeJsonPreference,
  writePreference
} from "../../core/preferences.js?v=20260629-settings-table-filters";
import { savedViewPreference } from "../../core/router.js";
import { state } from "../../core/store.js";
import {
  formatDate,
  toDateInput
} from "../../shared/dates.js";
import { canEditUser } from "../../shared/permissions.js";
import { createReorderDrag } from "../../shared/reorder-drag.js";
import { userById } from "../../shared/selectors.js";
import {
  escapeAttr,
  escapeHtml
} from "../../shared/text-and-links.js";

const avatarCacheVersion = "20260629-avatar-jpg-assets";
const seededAvatarPaths = new Set([
  "/assets/avatar-sin.jpg",
  "/assets/avatar-bill-gates.jpg",
  "/assets/avatar-sam-altman.jpg",
  "/assets/avatar-mark-zuckerberg.jpg",
  "/assets/avatar-steve-jobs.jpg",
  "/assets/avatar-jensen-huang.jpg",
  "/assets/avatar-generic-1.jpg",
  "/assets/avatar-generic-2.jpg",
  "/assets/avatar-generic-3.jpg",
  "/assets/avatar-generic-4.jpg",
  "/assets/avatar-generic-5.jpg",
  "/assets/avatar-generic-6.jpg"
]);
const legacySeededAvatarPaths = new Map([
  ["/assets/avatar-sin.png", "/assets/avatar-sin.jpg"],
  ["/assets/avatar-bill-gates.png", "/assets/avatar-bill-gates.jpg"],
  ["/assets/avatar-sam-altman.png", "/assets/avatar-sam-altman.jpg"],
  ["/assets/avatar-mark-zuckerberg.png", "/assets/avatar-mark-zuckerberg.jpg"],
  ["/assets/avatar-steve-jobs.png", "/assets/avatar-steve-jobs.jpg"],
  ["/assets/avatar-jensen-huang.png", "/assets/avatar-jensen-huang.jpg"],
  ["/assets/avatar-generic-1.png", "/assets/avatar-generic-1.jpg"],
  ["/assets/avatar-generic-2.png", "/assets/avatar-generic-2.jpg"],
  ["/assets/avatar-generic-3.png", "/assets/avatar-generic-3.jpg"],
  ["/assets/avatar-generic-4.png", "/assets/avatar-generic-4.jpg"],
  ["/assets/avatar-generic-5.png", "/assets/avatar-generic-5.jpg"],
  ["/assets/avatar-generic-6.png", "/assets/avatar-generic-6.jpg"],
  ["/assets/avatar-lisa-su.jpg", "/assets/avatar-jensen-huang.jpg"]
]);
const genericAvatarOptions = [
  "/assets/avatar-generic-1.jpg",
  "/assets/avatar-generic-2.jpg",
  "/assets/avatar-generic-3.jpg",
  "/assets/avatar-generic-4.jpg",
  "/assets/avatar-generic-5.jpg",
  "/assets/avatar-generic-6.jpg"
];

export function createSettingsFeature({
  app,
  deleteItem,
  loadState,
  openEditor,
  render,
  saveJson,
  showToast,
  uploadFile
}) {
  let lookupTypeFilter = readPreference(preferenceKeys.lookupType, "Status");
  let settingsCategory = readPreference(preferenceKeys.settingsCategory, lookupTypeFilter || "Status");
  let settingsTableFilters = normalizeSettingsTableFilters(readJsonPreference(preferenceKeys.settingsTableFilters, {}));
  if (savedViewPreference === "Users" || savedViewPreference === "Holidays") settingsCategory = savedViewPreference;
  if (savedViewPreference === "Lookups") settingsCategory = lookupTypeFilter;

  function renderSettings() {
    const lookupTypes = [...new Set(["Status", "Priority", "Severity", "Environment", ...(state.lookups || []).map(item => item.lookupType)])].sort();
    const categories = ["Users", "Navigation", "Holidays", ...lookupTypes, "Development"];
    if (!categories.includes(settingsCategory)) settingsCategory = lookupTypes[0] || "Status";

    const isUsers = settingsCategory === "Users";
    const isHolidays = settingsCategory === "Holidays";
    const isNavigation = settingsCategory === "Navigation";
    const isDevelopment = settingsCategory === "Development";
    if (!isUsers && !isHolidays && !isNavigation && !isDevelopment) {
      lookupTypeFilter = settingsCategory;
      writePreference(preferenceKeys.lookupType, lookupTypeFilter);
    }

    let actionsHtml = `
      <button class="primary text-icon-button" type="button" data-action="new-lookup" ${currentUser().isAdmin ? "" : "disabled"}>${buttonContent("&#10010;", "New Setting")}</button>
      ${settingsTableFilterButtonHtml(settingsCategory)}
    `;
    if (isUsers) actionsHtml = `<button class="primary text-icon-button" type="button" data-action="new-user" ${currentUser().isAdmin ? "" : "disabled"}>${buttonContent("&#10010;", "New User")}</button>`;
    if (isHolidays) actionsHtml = `
      <button class="primary text-icon-button" type="button" data-action="new-holiday" ${currentUser().isAdmin ? "" : "disabled"}>${buttonContent("&#10010;", "New Holiday")}</button>
      ${settingsTableFilterButtonHtml(settingsCategory)}
    `;
    if (isNavigation) actionsHtml = `
      <button class="secondary text-icon-button" type="button" data-action="navigation-reset-defaults">${buttonContent("&#8635;", "Reset")}</button>
      ${settingsTableFilterButtonHtml(settingsCategory)}
    `;
    if (isDevelopment) actionsHtml = `<span class="settings-action-spacer" aria-hidden="true"></span>`;

    const contentHtml = isUsers
      ? settingsUsersHtml()
      : isHolidays
        ? settingsHolidaysHtml()
        : isNavigation
          ? settingsNavigationHtml()
          : isDevelopment
            ? settingsDevelopmentHtml()
            : settingsLookupHtml(settingsCategory);

    app.innerHTML = `
      ${sectionHead("Settings", actionsHtml)}
      <div class="lookup-layout settings-layout">
        <aside class="panel lookup-picker settings-category-picker">
          ${categories.map(type => `
            <button type="button" data-action="select-lookup-type" data-id="0" data-type="${escapeAttr(type)}" class="${type === settingsCategory ? "active" : ""}">
              ${buttonContent(settingsCategoryIcon(type), type)}
            </button>
          `).join("")}
        </aside>
        ${contentHtml}
      </div>
    `;
    bindNavigationDragEvents();
  }

  async function handleAction(action, id, button) {
    if (action === "select-lookup-type") {
      selectLookupType(button.dataset.type || "Status");
      return true;
    }
    if (action === "new-user") {
      editUser();
      return true;
    }
    if (action === "edit-user") {
      editUser(userById(id));
      return true;
    }
    if (action === "preview-user-avatar") {
      showUserAvatarDialog(userById(id));
      return true;
    }
    if (action === "delete-user") {
      await deleteItem(`/api/users/${id}`, "Delete this user?");
      return true;
    }
    if (action === "new-lookup") {
      editLookup();
      return true;
    }
    if (action === "edit-lookup") {
      editLookup(state.lookups.find(item => item.id === id));
      return true;
    }
    if (action === "delete-lookup") {
      await deleteItem(`/api/lookups/${id}`, "Deactivate this setting value?");
      return true;
    }
    if (action === "new-holiday") {
      editHoliday();
      return true;
    }
    if (action === "edit-holiday") {
      editHoliday(state.holidays.find(item => item.id === id));
      return true;
    }
    if (action === "delete-holiday") {
      await deleteItem(`/api/holidays/${id}`, "Deactivate this holiday?");
      return true;
    }
    if (action === "open-settings-filters") {
      openSettingsFiltersDialog(button.dataset.category || settingsCategory);
      return true;
    }
    if (action === "sort-settings-table") {
      return updateSettingsTableSort(button);
    }
    if (action === "development-clear-non-pmt") {
      await runDevelopmentAction(
        "/api/development/clear-non-pmt",
        "Clear LMS, HLS, and any non-PMT Projects, Sprints, Dev Tasks, Bugs, Scrum, and Documentation? PMT will remain intact.",
        "Non-PMT development data cleared."
      );
      return true;
    }
    if (action === "development-clear-pmt") {
      await runDevelopmentAction(
        "/api/development/clear-pmt",
        "Clear the PMT Project, Sprints, Dev Tasks, Bugs, Scrum, and Documentation?",
        "PMT development data cleared."
      );
      return true;
    }
    if (action === "development-clear-users") {
      await runDevelopmentAction(
        "/api/development/clear-users",
        "Clear all users except Sin and remap ownership, assignees, reporters, and audit records to Sin?",
        "Users cleared and remapped to Sin."
      );
      return true;
    }
    if (action === "development-restore-seed-data") {
      await runDevelopmentAction(
        "/api/development/restore-seed-data",
        "Restore initial seed data for PMT, LMS, and HLS? Current development data will be replaced.",
        "Initial seed data restored."
      );
      return true;
    }
    if (action === "development-clear-local-storage") {
      await clearLocalStoragePreferences();
      return true;
    }
    if (action === "toggle-navigation-item") {
      toggleNavigationItem(button.dataset.view, button.checked);
      return true;
    }
    if (action === "rename-navigation-item") {
      editNavigationItem(button.dataset.view);
      return true;
    }
    if (action === "navigation-reset-defaults") {
      resetNavigationConfig();
      render();
      showToast("Navigation reset to defaults.");
      return true;
    }

    return false;
  }

  function settingsDevelopmentHtml() {
    const canRun = currentUser().isAdmin;
    return `
      <div class="panel development-panel settings-content-panel">
        <div>
          <h2>Development</h2>
          <p class="muted">These tools reset test data during development. Use the named PMT button when PMT itself should be cleared.</p>
        </div>
        <div class="development-actions">
          <div class="development-action-row">
            <div>
              <strong>Clear All Except PMT</strong>
              <p class="muted">Deletes non-PMT Projects, Sprints, Dev Tasks, Bugs, Scrum, and Documentation.</p>
            </div>
            <button class="secondary text-icon-button" type="button" data-action="development-clear-non-pmt" ${canRun ? "" : "disabled"}>${buttonContent("&#128465;", "Clear All Except PMT")}</button>
          </div>
          <div class="development-action-row danger-row">
            <div>
              <strong>Clear PMT</strong>
              <p class="muted">Deletes the PMT Project, Sprints, Dev Tasks, Bugs, Scrum, and Documentation.</p>
            </div>
            <button class="danger text-icon-button" type="button" data-action="development-clear-pmt" ${canRun ? "" : "disabled"}>${buttonContent("&#9888;", "Clear PMT")}</button>
          </div>
          <div class="development-action-row">
            <div>
              <strong>Clear Users</strong>
              <p class="muted">Deletes every user except Sin and remaps ownership, assignees, reporters, and audit records to Sin.</p>
            </div>
            <button class="secondary text-icon-button" type="button" data-action="development-clear-users" ${canRun ? "" : "disabled"}>${buttonContent("&#128100;", "Clear Users")}</button>
          </div>
          <div class="development-action-row">
            <div>
              <strong>Restore Initial Seed Data</strong>
              <p class="muted">Restores the PMT, LMS, and HLS demo data from the SQL seed scripts.</p>
            </div>
            <button class="primary text-icon-button" type="button" data-action="development-restore-seed-data" ${canRun ? "" : "disabled"}>${buttonContent("&#8635;", "Restore Initial Seed Data")}</button>
          </div>
          <div class="development-action-row">
            <div>
              <strong>Clear User Preferences Stored in Local Storage</strong>
              <p class="muted">Clears this browser's PMT preferences and reloads the app with first-launch defaults.</p>
            </div>
            <button class="secondary text-icon-button" type="button" data-action="development-clear-local-storage">${buttonContent("&#9003;", "Clear User Preferences Stored in Local Storage")}</button>
          </div>
        </div>
      </div>
    `;
  }

  function settingsLookupHtml(type) {
    const rows = [...(state.lookups || [])]
      .filter(item => item.lookupType === type)
      .filter(item => settingsLookupMatchesFilters(item, type))
      .sort((a, b) => settingsLookupSortCompare(a, b, type));

    return `
      <div class="panel settings-content-panel settings-table-panel">
        <table class="table settings-table">
          <thead>
            <tr>
              ${settingsSortHeaderHtml(type, "value", "Value")}
              ${settingsSortHeaderHtml(type, "color", "Color")}
              ${settingsSortHeaderHtml(type, "order", "Order")}
              ${settingsSortHeaderHtml(type, "active", "Active")}
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(item => `
              <tr class="clickable-row" data-action="edit-lookup" data-id="${item.id}">
                <td>${escapeHtml(item.value)}</td>
                <td>${item.lookupType === "Status" ? `<span class="lookup-color" style="--status-color:${escapeAttr(statusColor(item.value))}"></span>` : `<span class="muted">n/a</span>`}</td>
                <td>${item.displayOrder}</td>
                <td>${item.isActive ? "Yes" : "No"}</td>
                <td class="action-cell">
                  ${iconButton("edit-lookup", item.id, "Edit", "edit", currentUser().isAdmin)}
                  ${iconButton("delete-lookup", item.id, "Deactivate", "delete", currentUser().isAdmin, "danger")}
                </td>
              </tr>
            `).join("") || `<tr><td colspan="5"><div class="empty">No setting values in this category.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  function settingsHolidaysHtml() {
    const rows = [...(state.holidays || [])]
      .filter(settingsHolidayMatchesFilters)
      .sort(settingsHolidaySortCompare);

    return `
      <div class="panel settings-content-panel settings-table-panel">
        <table class="table settings-table">
          <thead>
            <tr>
              ${settingsSortHeaderHtml("Holidays", "date", "Date")}
              ${settingsSortHeaderHtml("Holidays", "name", "Name")}
              ${settingsSortHeaderHtml("Holidays", "country", "Country")}
              ${settingsSortHeaderHtml("Holidays", "active", "Active")}
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(holiday => `
              <tr class="clickable-row" data-action="edit-holiday" data-id="${holiday.id}">
                <td>${escapeHtml(formatDate(holiday.holidayDate))}</td>
                <td>${escapeHtml(holiday.name)}</td>
                <td>${escapeHtml(holiday.countryCode || "PH")}</td>
                <td>${holiday.isActive ? "Yes" : "No"}</td>
                <td class="action-cell">
                  ${iconButton("edit-holiday", holiday.id, "Edit", "edit", currentUser().isAdmin)}
                  ${iconButton("delete-holiday", holiday.id, "Deactivate", "delete", currentUser().isAdmin, "danger")}
                </td>
              </tr>
            `).join("") || `<tr><td colspan="5"><div class="empty">No holidays have been configured.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  function settingsTableFilterButtonHtml(category) {
    if (!settingsHasTableFilters(category)) return "";

    return `<button class="secondary text-icon-button" type="button" data-action="open-settings-filters" data-category="${escapeAttr(category)}" title="Filters" aria-label="Filters" aria-haspopup="dialog">${buttonContent(funnelIconHtml(), "Filters")}</button>`;
  }

  function normalizeSettingsTableFilters(filters = {}) {
    if (!filters || Array.isArray(filters) || typeof filters !== "object") return {};

    return Object.fromEntries(
      Object.entries(filters).map(([category, values]) => [category, normalizeSettingsTableFilterValues(category, values)])
    );
  }

  function normalizeSettingsTableFilterValues(category, values = {}) {
    return {
      search: typeof values.search === "string" ? values.search : "",
      active: ["all", "active", "inactive"].includes(values.active) ? values.active : "all",
      visible: ["all", "visible", "hidden"].includes(values.visible) ? values.visible : "all",
      country: values.country || "all",
      sort: values.sort || "custom"
    };
  }

  function settingsFiltersFor(category) {
    const key = settingsFilterCategory(category);
    return normalizeSettingsTableFilterValues(key, settingsTableFilters[key] || {});
  }

  function updateSettingsFilters(category, updates) {
    const key = settingsFilterCategory(category);
    settingsTableFilters = {
      ...settingsTableFilters,
      [key]: normalizeSettingsTableFilterValues(key, {
        ...settingsFiltersFor(key),
        ...updates
      })
    };
    writeJsonPreference(preferenceKeys.settingsTableFilters, settingsTableFilters);
  }

  function settingsFilterCategory(category = settingsCategory) {
    return category || settingsCategory || "Status";
  }

  function settingsHasTableFilters(category) {
    const key = settingsFilterCategory(category);
    return key === "Navigation" || key === "Holidays" || settingsIsLookupCategory(key);
  }

  function settingsIsLookupCategory(category) {
    return Boolean(category) && !["Users", "Navigation", "Holidays", "Development"].includes(category);
  }

  function openSettingsFiltersDialog(category = settingsCategory) {
    const filterCategory = settingsFilterCategory(category);
    if (!settingsHasTableFilters(filterCategory)) return;

    document.querySelectorAll("[data-settings-filter-dialog]").forEach(dialog => {
      if (dialog.open) dialog.close();
      else dialog.remove();
    });

    const modal = document.createElement("dialog");
    modal.className = "dialog task-filter-dialog settings-filter-dialog";
    modal.dataset.settingsFilterDialog = "true";
    modal.dataset.settingsFilterCategory = filterCategory;
    modal.innerHTML = `
      <form method="dialog">
        <div class="dialog-head">
          <h2>${escapeHtml(settingsFilterDialogTitle(filterCategory))}</h2>
          <button type="button" class="icon-btn" data-close-settings-filters title="Close" aria-label="Close">x</button>
        </div>
        <div class="dialog-body task-filter-dialog-body settings-filter-dialog-body">
          ${settingsFilterFieldsHtml(filterCategory)}
        </div>
        <div class="dialog-actions">
          <button type="button" class="primary text-icon-button" data-close-settings-filters>${buttonContent("&#10003;", "Done")}</button>
        </div>
      </form>
    `;

    document.body.appendChild(modal);
    modal.addEventListener("input", event => {
      if (!applySettingsFilterChange(event.target)) return;
      renderSettings();
    });
    modal.addEventListener("change", event => {
      if (!applySettingsFilterChange(event.target)) return;
      renderSettings();
    });
    modal.addEventListener("click", event => {
      if (event.target.closest("[data-close-settings-filters]")) modal.close();
    });
    modal.addEventListener("close", () => modal.remove());
    modal.showModal();
    modal.querySelector("[data-filter='settings-search'], [data-filter='settings-sort']")?.focus({ preventScroll: true });
  }

  function settingsFilterFieldsHtml(category) {
    const filters = settingsFiltersFor(category);

    return `
      <div class="tasks-filter-panel settings-filter-fields">
        <div class="task-filter-row settings-filter-row">
          <label>
            <span>Search</span>
            <input type="text" data-filter="settings-search" data-category="${escapeAttr(category)}" value="${escapeAttr(filters.search)}">
          </label>
          <label>
            <span>Sort</span>
            <select data-filter="settings-sort" data-category="${escapeAttr(category)}">
              ${settingsSortOptionsHtml(category)}
            </select>
          </label>
          ${settingsCategoryFilterFieldsHtml(category)}
        </div>
      </div>
    `;
  }

  function settingsCategoryFilterFieldsHtml(category) {
    const filters = settingsFiltersFor(category);

    if (category === "Navigation") {
      return `
        <label>
          <span>Visible</span>
          <select data-filter="settings-visible" data-category="${escapeAttr(category)}">
            <option value="all" ${filters.visible === "all" ? "selected" : ""}>All Items</option>
            <option value="visible" ${filters.visible === "visible" ? "selected" : ""}>Visible</option>
            <option value="hidden" ${filters.visible === "hidden" ? "selected" : ""}>Hidden</option>
          </select>
        </label>
      `;
    }

    if (category === "Holidays") {
      return `
        <label>
          <span>Country</span>
          <select data-filter="settings-country" data-category="${escapeAttr(category)}">
            <option value="all" ${filters.country === "all" ? "selected" : ""}>All Countries</option>
            ${settingsHolidayCountryOptionsHtml(filters.country)}
          </select>
        </label>
        ${settingsActiveFilterHtml(category, filters.active)}
      `;
    }

    return settingsActiveFilterHtml(category, filters.active);
  }

  function settingsActiveFilterHtml(category, selectedValue) {
    return `
      <label>
        <span>Active</span>
        <select data-filter="settings-active" data-category="${escapeAttr(category)}">
          <option value="all" ${selectedValue === "all" ? "selected" : ""}>All Values</option>
          <option value="active" ${selectedValue === "active" ? "selected" : ""}>Active</option>
          <option value="inactive" ${selectedValue === "inactive" ? "selected" : ""}>Inactive</option>
        </select>
      </label>
    `;
  }

  function settingsHolidayCountryOptionsHtml(selectedCountry) {
    const countries = [...new Set((state.holidays || []).map(holiday => holiday.countryCode || "PH"))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

    if (selectedCountry && selectedCountry !== "all" && !countries.includes(selectedCountry)) countries.push(selectedCountry);

    return countries
      .map(country => `<option value="${escapeAttr(country)}" ${country === selectedCountry ? "selected" : ""}>${escapeHtml(country)}</option>`)
      .join("");
  }

  function settingsFilterDialogTitle(category) {
    if (category === "Holidays") return "Holiday Filters";
    if (category === "Navigation") return "Navigation Filters";
    return `${category} Filters`;
  }

  function applySettingsFilterChange(target) {
    const filter = target?.dataset?.filter || "";
    if (!filter.startsWith("settings-")) return false;

    const category = settingsFilterCategory(target.dataset.category);
    if (filter === "settings-search") updateSettingsFilters(category, { search: target.value });
    if (filter === "settings-sort") updateSettingsFilters(category, { sort: target.value });
    if (filter === "settings-active") updateSettingsFilters(category, { active: target.value });
    if (filter === "settings-visible") updateSettingsFilters(category, { visible: target.value });
    if (filter === "settings-country") updateSettingsFilters(category, { country: target.value || "all" });
    return true;
  }

  function settingsLookupMatchesFilters(item, category) {
    const filters = settingsFiltersFor(category);
    if (!settingsMatchesActiveFilter(item.isActive, filters.active)) return false;

    return settingsMatchesSearch([
      item.value,
      settingsLookupColorText(item),
      item.displayOrder,
      item.isActive ? "Yes" : "No"
    ], filters.search);
  }

  function settingsHolidayMatchesFilters(holiday) {
    const filters = settingsFiltersFor("Holidays");
    if (!settingsMatchesActiveFilter(holiday.isActive, filters.active)) return false;
    if (filters.country !== "all" && (holiday.countryCode || "PH") !== filters.country) return false;

    return settingsMatchesSearch([
      formatDate(holiday.holidayDate),
      holiday.name,
      holiday.countryCode || "PH",
      holiday.isActive ? "Yes" : "No"
    ], filters.search);
  }

  function settingsNavigationMatchesFilters(item) {
    const filters = settingsFiltersFor("Navigation");
    if (filters.visible === "visible" && !item.visible) return false;
    if (filters.visible === "hidden" && item.visible) return false;

    return settingsMatchesSearch([
      item.label,
      item.defaultLabel,
      item.view,
      item.visible ? "Visible" : "Hidden"
    ], filters.search);
  }

  function settingsMatchesActiveFilter(isActive, filterValue) {
    if (filterValue === "active") return Boolean(isActive);
    if (filterValue === "inactive") return !isActive;
    return true;
  }

  function settingsMatchesSearch(values, search) {
    const term = String(search || "").trim().toLowerCase();
    if (!term) return true;

    return values
      .map(value => String(value ?? "").toLowerCase())
      .some(value => value.includes(term));
  }

  function settingsLookupSortCompare(a, b, category) {
    return settingsTableSortCompare(category, a, b, settingsDefaultLookupSortCompare, settingsCompareLookupColumn);
  }

  function settingsHolidaySortCompare(a, b) {
    return settingsTableSortCompare("Holidays", a, b, settingsDefaultHolidaySortCompare, settingsCompareHolidayColumn);
  }

  function settingsNavigationSortCompare(a, b) {
    return settingsTableSortCompare("Navigation", a, b, settingsDefaultNavigationSortCompare, settingsCompareNavigationColumn);
  }

  function settingsTableSortCompare(category, a, b, defaultCompare, columnCompare) {
    const state = settingsTableSortState(category);

    if (state.column && state.direction) {
      const result = columnCompare(a, b, state.column);
      if (result) return state.direction === "asc" ? result : -result;
      return defaultCompare(a, b);
    }

    return defaultCompare(a, b);
  }

  function settingsDefaultLookupSortCompare(a, b) {
    return Number(a.displayOrder || 0) - Number(b.displayOrder || 0)
      || String(a.value || "").localeCompare(String(b.value || ""), undefined, { numeric: true, sensitivity: "base" })
      || a.id - b.id;
  }

  function settingsDefaultHolidaySortCompare(a, b) {
    return new Date(b.holidayDate) - new Date(a.holidayDate)
      || String(a.name || "").localeCompare(String(b.name || ""), undefined, { numeric: true, sensitivity: "base" })
      || a.id - b.id;
  }

  function settingsDefaultNavigationSortCompare(a, b) {
    return Number(a.customOrder || 0) - Number(b.customOrder || 0);
  }

  function settingsCompareLookupColumn(a, b, column) {
    if (column === "order") return Number(a.displayOrder || 0) - Number(b.displayOrder || 0);
    if (column === "active") return settingsBooleanCompare(a.isActive, b.isActive);
    if (column === "color") return settingsLookupColorText(a).localeCompare(settingsLookupColorText(b), undefined, { numeric: true, sensitivity: "base" });
    return String(a.value || "").localeCompare(String(b.value || ""), undefined, { numeric: true, sensitivity: "base" });
  }

  function settingsCompareHolidayColumn(a, b, column) {
    if (column === "date") return new Date(a.holidayDate) - new Date(b.holidayDate);
    if (column === "active") return settingsBooleanCompare(a.isActive, b.isActive);
    if (column === "country") return String(a.countryCode || "PH").localeCompare(String(b.countryCode || "PH"), undefined, { numeric: true, sensitivity: "base" });
    return String(a.name || "").localeCompare(String(b.name || ""), undefined, { numeric: true, sensitivity: "base" });
  }

  function settingsCompareNavigationColumn(a, b, column) {
    if (column === "visible") return settingsBooleanCompare(a.visible, b.visible);
    if (column === "default") return String(a.defaultLabel || "").localeCompare(String(b.defaultLabel || ""), undefined, { numeric: true, sensitivity: "base" });
    if (column === "route") return String(a.view || "").localeCompare(String(b.view || ""), undefined, { numeric: true, sensitivity: "base" });
    return String(a.label || "").localeCompare(String(b.label || ""), undefined, { numeric: true, sensitivity: "base" });
  }

  function settingsBooleanCompare(a, b) {
    return Number(Boolean(a)) - Number(Boolean(b));
  }

  function settingsLookupColorText(item) {
    return item.lookupType === "Status" ? statusColor(item.value) : "n/a";
  }

  function settingsSortHeaderHtml(category, column, label) {
    const state = settingsTableSortState(category);
    const isSorted = state.column === column && Boolean(state.direction);
    const ariaSort = isSorted ? (state.direction === "asc" ? "ascending" : "descending") : "none";
    const arrow = isSorted ? (state.direction === "asc" ? "&#9650;" : "&#9660;") : "";
    const className = isSorted ? "is-sorted" : "";

    return `
      <th class="${className}" aria-sort="${ariaSort}">
        <button type="button" class="table-sort-button" data-action="sort-settings-table" data-category="${escapeAttr(category)}" data-column="${escapeAttr(column)}" title="${escapeAttr(settingsNextSortLabel(category, column, label))}">
          <span>${escapeHtml(label)}</span>
          <span class="table-sort-indicator" aria-hidden="true">${arrow}</span>
        </button>
      </th>
    `;
  }

  function updateSettingsTableSort(button) {
    const category = settingsFilterCategory(button?.dataset?.category);
    const column = button?.dataset?.column || "";
    if (!settingsTableSortColumns(category).some(item => item.column === column)) return false;

    updateSettingsFilters(category, { sort: settingsNextSort(category, column) });
    renderSettings();
    return true;
  }

  function settingsNextSort(category, column) {
    const state = settingsTableSortState(category);
    if (state.column !== column || !state.direction) return `${column}-asc`;
    if (state.direction === "asc") return `${column}-desc`;
    return "custom";
  }

  function settingsTableSortState(category) {
    const sortValue = settingsFiltersFor(category).sort;
    const match = /^(.+)-(asc|desc)$/.exec(sortValue || "");
    if (!match) return { column: "", direction: "" };

    const column = match[1];
    const direction = match[2];
    if (!settingsTableSortColumns(category).some(item => item.column === column)) return { column: "", direction: "" };
    return { column, direction };
  }

  function settingsSortOptionsHtml(category) {
    const selectedSort = settingsFiltersFor(category).sort || "custom";
    const options = [
      { value: "custom", text: settingsCustomSortLabel(category) },
      ...settingsTableSortColumns(category).flatMap(column => [
        { value: `${column.column}-asc`, text: `${column.label} Ascending` },
        { value: `${column.column}-desc`, text: `${column.label} Descending` }
      ])
    ];

    return options
      .map(option => `<option value="${escapeAttr(option.value)}" ${selectedSort === option.value ? "selected" : ""}>${escapeHtml(option.text)}</option>`)
      .join("");
  }

  function settingsCustomSortLabel(category) {
    if (category === "Navigation") return "Custom Order (Saved Order)";
    if (category === "Holidays") return "Date Descending";
    return "Order Ascending";
  }

  function settingsTableSortColumns(category) {
    if (category === "Navigation") {
      return [
        { column: "visible", label: "Visible" },
        { column: "item", label: "Navigation Item" },
        { column: "default", label: "Default" },
        { column: "route", label: "Route" }
      ];
    }

    if (category === "Holidays") {
      return [
        { column: "date", label: "Date" },
        { column: "name", label: "Name" },
        { column: "country", label: "Country" },
        { column: "active", label: "Active" }
      ];
    }

    return [
      { column: "value", label: "Value" },
      { column: "color", label: "Color" },
      { column: "order", label: "Order" },
      { column: "active", label: "Active" }
    ];
  }

  function settingsNextSortLabel(category, column, label) {
    const state = settingsTableSortState(category);
    if (state.column === column && state.direction === "asc") return `Sort ${label} descending`;
    if (state.column === column && state.direction === "desc") return `Clear ${label} sort`;
    return `Sort ${label} ascending`;
  }

  function settingsNavigationCanDrag() {
    const filters = settingsFiltersFor("Navigation");
    return filters.sort === "custom" && !filters.search.trim() && filters.visible === "all";
  }

  function settingsNavigationHtml() {
    const canDrag = settingsNavigationCanDrag();
    const items = navigationSettingsItems()
      .map((item, index) => ({ ...item, customOrder: index }))
      .filter(settingsNavigationMatchesFilters)
      .sort(settingsNavigationSortCompare);
    return `
      <div class="panel settings-content-panel settings-table-panel settings-navigation-panel">
        <div class="settings-navigation-head">
          <h2>Navigation</h2>
          <p class="muted">Choose which navigation items are available, rename labels, then drag rows into the order you prefer.</p>
        </div>
        <table class="table settings-table settings-navigation-table work-item-table">
          <thead>
            <tr>
              ${settingsSortHeaderHtml("Navigation", "visible", "Visible")}
              ${settingsSortHeaderHtml("Navigation", "item", "Navigation Item")}
              ${settingsSortHeaderHtml("Navigation", "default", "Default")}
              ${settingsSortHeaderHtml("Navigation", "route", "Route")}
              <th></th>
            </tr>
          </thead>
          <tbody data-reorder-list="navigation" data-navigation-list>
            ${items.map(item => `
              <tr class="clickable-row" data-action="rename-navigation-item" data-nav-view="${escapeAttr(item.view)}" data-view="${escapeAttr(item.view)}">
                <td>
                  <label class="settings-nav-toggle" title="${item.visibilityLocked ? "This item must stay available in navigation." : "Show this item in navigation."}">
                    <input type="checkbox" data-action="toggle-navigation-item" data-view="${escapeAttr(item.view)}" aria-label="Show ${escapeAttr(item.label)} in navigation" ${item.visible ? "checked" : ""} ${item.visibilityLocked ? "disabled" : ""}>
                  </label>
                </td>
                <td>
                  <button class="settings-nav-label-button" type="button" data-action="rename-navigation-item" data-view="${escapeAttr(item.view)}" title="Rename ${escapeAttr(item.label)}">
                    <span class="settings-nav-icon" aria-hidden="true">${item.icon}</span>
                    <span class="settings-nav-text">
                      <strong>${escapeHtml(item.label)}</strong>
                    </span>
                  </button>
                </td>
                <td>${escapeHtml(item.defaultLabel)}</td>
                <td><span class="muted">${escapeHtml(item.view)}</span></td>
                <td class="action-cell">
                  <button class="work-item-drag-handle settings-nav-drag-handle" type="button" ${canDrag ? "data-drag-handle data-navigation-drag-handle" : "disabled"} title="Drag ${escapeAttr(item.label)}" aria-label="Drag ${escapeAttr(item.label)}">
                    <span aria-hidden="true">&#8942;&#8942;</span>
                  </button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function settingsUsersHtml() {
    return `
      <div class="grid settings-users-grid">
        ${state.users.map(user => `
          <article class="card settings-user-card">
            <div class="row settings-user-head">
              <button class="settings-user-avatar-button" type="button" data-action="preview-user-avatar" data-id="${user.id}" title="View ${escapeAttr(settingsUserDisplayName(user))} avatar" aria-label="View ${escapeAttr(settingsUserDisplayName(user))} avatar">
                <img class="avatar settings-user-avatar" src="${escapeAttr(settingsUserAvatarUrl(user))}" alt="${escapeAttr(settingsUserDisplayName(user))} avatar">
              </button>
              <div class="settings-user-summary">
                <p class="settings-user-name">${settingsUserNameHtml(user)}</p>
                <p class="settings-user-title muted">${escapeHtml(userTitle(user))}</p>
                <p class="settings-user-email">${settingsUserEmailHtml(user)}</p>
              </div>
            </div>
            <p>${escapeHtml(user.bio || "")}</p>
            <div class="toolbar reveal-actions">
              ${iconButton("delete-user", user.id, "Delete", "delete", currentUser().isAdmin && user.id !== currentUserId, "danger")}
              ${iconButton("edit-user", user.id, "Edit", "edit", canEditUser(user.id))}
            </div>
          </article>
        `).join("")}
      </div>
    `;
  }

  function settingsUserAvatarUrl(user) {
    const avatarUrl = (user.avatarUrl || "/assets/avatar-default.svg").trim();
    const [pathPart, queryString = ""] = avatarUrl.split("?", 2);
    const seededPath = legacySeededAvatarPaths.get(pathPart.toLowerCase()) || pathPart;
    if (!seededAvatarPaths.has(seededPath.toLowerCase())) return avatarUrl;

    const params = new URLSearchParams(queryString);
    params.set("v", avatarCacheVersion);
    return `${seededPath}?${params.toString()}`;
  }

  function settingsUserDisplayName(user) {
    return [user.firstName, user.lastName]
      .map(part => (part || "").trim())
      .filter(Boolean)
      .join(" ") || user.nickname || "User";
  }

  function settingsUserNameHtml(user) {
    const fullName = settingsUserDisplayName(user);
    const nickname = (user.nickname || "").trim();
    const showNickname = nickname && nickname.toLowerCase() !== fullName.toLowerCase();

    return `${escapeHtml(fullName)}${showNickname ? ` (${escapeHtml(nickname)})` : ""}`;
  }

  function settingsUserEmailHtml(user) {
    const email = (user.email || "").trim();
    if (!email) return "";

    return `<a href="mailto:${escapeAttr(email)}">${escapeHtml(email)}</a>`;
  }

  function userTitle(user) {
    return user.role || (user.isAdmin ? "Admin" : "Developer");
  }

  function showUserAvatarDialog(user) {
    if (!user) return;

    const displayName = settingsUserDisplayName(user);
    const avatarUrl = settingsUserAvatarUrl(user);
    const modal = document.createElement("dialog");
    modal.className = "dialog settings-avatar-dialog";
    modal.innerHTML = `
      <div class="dialog-head">
        <h2>${escapeHtml(displayName)}</h2>
        <button type="button" class="icon-btn" data-close-avatar-dialog title="Close">x</button>
      </div>
      <div class="dialog-body settings-avatar-dialog-body">
        <img class="settings-avatar-preview" src="${escapeAttr(avatarUrl)}" alt="${escapeAttr(displayName)} avatar">
      </div>
      <div class="dialog-actions">
        <button class="secondary text-icon-button" type="button" data-close-avatar-dialog>${buttonContent("&#10005;", "Close")}</button>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelectorAll("[data-close-avatar-dialog]").forEach(button => {
      button.addEventListener("click", () => modal.close());
    });
    modal.addEventListener("click", event => {
      if (event.target === modal) modal.close();
    });
    modal.addEventListener("close", () => modal.remove(), { once: true });
    modal.showModal();
  }

  function settingsCategoryIcon(type) {
    const icons = {
      Status: "&#9679;",
      Priority: "&#9733;",
      Severity: "&#9888;",
      Environment: "&#127758;",
      Users: "&#128100;",
      Holidays: "&#128197;",
      Navigation: "&#9776;",
      Development: "&#128295;"
    };

    return icons[type] || "&#9881;";
  }

  function selectLookupType(type) {
    settingsCategory = type || "Status";
    writePreference(preferenceKeys.settingsCategory, settingsCategory);
    if (settingsCategory !== "Users" && settingsCategory !== "Holidays" && settingsCategory !== "Navigation" && settingsCategory !== "Development") {
      lookupTypeFilter = settingsCategory;
      writePreference(preferenceKeys.lookupType, lookupTypeFilter);
    }
    renderSettings();
  }

  function toggleNavigationItem(view, visible) {
    const config = readNavigationConfig();
    writeNavigationConfig({
      ...config,
      items: config.items.map(item => item.view === view ? { ...item, visible } : item)
    });
    render();
  }

  function editNavigationItem(view) {
    const item = navigationSettingsItems().find(entry => entry.view === view);
    if (!item) return;

    openEditor("Rename Navigation Item", `
      <div class="form-grid">
        ${field("Navigation Label", "label", item.label || item.defaultLabel, "text")}
      </div>
    `, root => {
      const label = value(root, "label").trim() || item.defaultLabel;
      const config = readNavigationConfig();
      writeNavigationConfig({
        ...config,
        items: config.items.map(configItem => configItem.view === view ? { ...configItem, label } : configItem)
      });
    }, "label");
  }

  function bindNavigationDragEvents() {
    if (!settingsNavigationCanDrag()) return;

    const list = app.querySelector('tbody[data-reorder-list="navigation"]');
    if (!list) return;

    createReorderDrag({
      root: list,
      containerSelector: 'tbody[data-reorder-list="navigation"]',
      itemSelector: "tr[data-nav-view]",
      getItemKey: item => item.dataset.navView || "",
      onDrop: ({ orderedKeys }) => {
        saveNavigationOrder(orderedKeys);
        showToast("Navigation order saved.");
      }
    }).bind();
  }

  function saveNavigationOrder(orderedViews) {
    const config = readNavigationConfig();
    const itemsByView = new Map(config.items.map(item => [item.view, item]));
    const items = orderedViews
      .map(view => itemsByView.get(view))
      .filter(Boolean);

    config.items.forEach(item => {
      if (!orderedViews.includes(item.view)) items.push(item);
    });

    writeNavigationConfig({ ...config, items });
    render();
  }

  function editUser(user = {}) {
    openEditor(user.id ? "Edit User" : "New User", `
      <div class="form-grid">
        ${requiredUserTextField("First Name", "firstName", user.firstName || "")}
        ${requiredUserTextField("Last Name", "lastName", user.lastName || "")}
        ${field("Nickname", "nickname", user.nickname || "", "text")}
        ${selectTextField("Role", "role", ["Developer", "QA"], user.role === "Admin" ? "Developer" : user.role || "Developer")}
        ${field("Phone", "phone", user.phone || "", "text")}
        ${field("Email", "email", user.email || "", "email")}
        ${genericAvatarPickerHtml(user)}
        <div class="field full"><label>Upload Avatar</label><input name="avatarFile" type="file" accept="image/*"></div>
        <div class="field full"><label>Avatar URL</label><input name="avatarUrl" type="text" value="${escapeAttr(user.avatarUrl || "")}"></div>
        ${field("Home Page", "homePageUrl", user.homePageUrl || "", "url")}
        ${field("Social Media", "socialMediaUrl", user.socialMediaUrl || "", "url")}
        <div class="field full"><label>Bio</label><textarea name="bio">${escapeHtml(user.bio || "")}</textarea></div>
        <label class="inline-check field full"><input name="isAdmin" type="checkbox" ${user.isAdmin ? "checked" : ""} ${currentUser().isAdmin ? "" : "disabled"}><span>Admin</span></label>
      </div>
    `, async root => {
      const firstName = value(root, "firstName").trim();
      const lastName = value(root, "lastName").trim();
      if (!firstName) {
        focusUserField(root, "firstName");
        throw new Error("First Name is required.");
      }
      if (!lastName) {
        focusUserField(root, "lastName");
        throw new Error("Last Name is required.");
      }

      const avatarFile = root.querySelector("[name='avatarFile']").files[0];
      let avatarUrl = value(root, "avatarUrl");
      if (!avatarFile && !avatarUrl.trim()) {
        focusUserAvatarField(root);
        throw new Error("Select or upload an avatar before saving this user.");
      }
      if (avatarFile) avatarUrl = (await uploadFile("avatars", avatarFile)).url;

      await saveJson(user.id ? `/api/users/${user.id}` : "/api/users", user.id ? "PUT" : "POST", {
        id: user.id || 0,
        firstName,
        lastName,
        nickname: value(root, "nickname"),
        email: value(root, "email"),
        phone: value(root, "phone"),
        avatarUrl,
        homePageUrl: value(root, "homePageUrl"),
        socialMediaUrl: value(root, "socialMediaUrl"),
        bio: value(root, "bio"),
        isAdmin: root.querySelector("[name='isAdmin']").checked,
        role: value(root, "role")
      });
    }, "", bindGenericAvatarPicker);
  }

  function requiredUserTextField(label, name, currentValue) {
    return `<div class="field"><label>${label}</label><input name="${name}" type="text" value="${escapeAttr(currentValue ?? "")}" required></div>`;
  }

  function focusUserField(root, name) {
    const input = root.querySelector(`[name='${name}']`);
    input?.scrollIntoView({ behavior: "smooth", block: "center" });
    input?.focus({ preventScroll: true });
  }

  function focusUserAvatarField(root) {
    const field = root.querySelector(".settings-generic-avatar-field") || root.querySelector("[name='avatarUrl']")?.closest(".field");
    field?.scrollIntoView({ behavior: "smooth", block: "center" });
    field?.querySelector("button, input")?.focus({ preventScroll: true });
  }

  function genericAvatarPickerHtml(user) {
    const currentAvatarPath = avatarPathOnly(user.avatarUrl || "");

    return `
      <div class="field full settings-generic-avatar-field">
        <label>Generic Avatar</label>
        <div class="settings-generic-avatar-list" role="radiogroup" aria-label="Generic Avatar">
          ${genericAvatarOptions.map((avatarUrl, index) => {
            const selected = currentAvatarPath === avatarUrl;
            return `
              <button class="settings-generic-avatar-option ${selected ? "is-selected" : ""}" type="button" data-generic-avatar="${escapeAttr(avatarUrl)}" role="radio" aria-checked="${selected}" title="Use generic avatar ${index + 1}">
                <img src="${escapeAttr(settingsUserAvatarUrl({ avatarUrl }))}" alt="Generic avatar ${index + 1}">
              </button>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  function bindGenericAvatarPicker(root) {
    const avatarUrlInput = root.querySelector("[name='avatarUrl']");
    const avatarFileInput = root.querySelector("[name='avatarFile']");
    const options = [...root.querySelectorAll("[data-generic-avatar]")];
    if (!avatarUrlInput || !options.length) return;

    const syncSelectedOption = () => {
      const selectedPath = avatarPathOnly(avatarUrlInput.value);
      options.forEach(option => {
        const selected = option.dataset.genericAvatar === selectedPath;
        option.classList.toggle("is-selected", selected);
        option.setAttribute("aria-checked", String(selected));
      });
    };

    options.forEach(option => {
      option.addEventListener("click", () => {
        avatarUrlInput.value = option.dataset.genericAvatar || "";
        if (avatarFileInput) avatarFileInput.value = "";
        syncSelectedOption();
      });
    });
    avatarUrlInput.addEventListener("input", syncSelectedOption);
    syncSelectedOption();
  }

  function avatarPathOnly(avatarUrl) {
    return (avatarUrl || "").trim().split("?", 1)[0];
  }

  function editLookup(lookup = {}) {
    openEditor(lookup.id ? "Edit Setting" : "New Setting", `
      <div class="form-grid">
        ${selectTextField("Type", "lookupType", ["Status", "Priority", "Severity", "Environment"], lookup.lookupType || "Status")}
        ${field("Value", "value", lookup.value || "", "text")}
        ${colorField("Color", "colorHex", lookup.colorHex || defaultStatusColor(lookup.value || "Todo"))}
        ${field("Display Order", "displayOrder", lookup.displayOrder ?? 0, "number")}
        <label class="inline-check field full"><input name="isActive" type="checkbox" ${lookup.isActive ?? true ? "checked" : ""}><span>Active</span></label>
      </div>
    `, async root => {
      const lookupType = value(root, "lookupType");
      await saveJson(lookup.id ? `/api/lookups/${lookup.id}` : "/api/lookups", lookup.id ? "PUT" : "POST", {
        id: lookup.id || 0,
        lookupType,
        value: value(root, "value"),
        displayOrder: numberValue(root, "displayOrder"),
        isActive: root.querySelector("[name='isActive']").checked,
        colorHex: lookupType === "Status" ? value(root, "colorHex") : ""
      });
    }, "value");
  }

  function editHoliday(holiday = {}) {
    openEditor(holiday.id ? "Edit Holiday" : "New Holiday", `
      <div class="form-grid">
        ${field("Date", "holidayDate", toDateInput(holiday.holidayDate || new Date()), "date")}
        ${field("Name", "name", holiday.name || "", "text")}
        ${field("Country Code", "countryCode", holiday.countryCode || "PH", "text")}
        <label class="inline-check field full"><input name="isActive" type="checkbox" ${holiday.isActive ?? true ? "checked" : ""}><span>Active</span></label>
      </div>
    `, async root => {
      await saveJson(holiday.id ? `/api/holidays/${holiday.id}` : "/api/holidays", holiday.id ? "PUT" : "POST", {
        id: holiday.id || 0,
        holidayDate: value(root, "holidayDate"),
        name: value(root, "name"),
        countryCode: value(root, "countryCode") || "PH",
        isActive: root.querySelector("[name='isActive']").checked
      });
    }, "holidayDate");
  }

  async function runDevelopmentAction(path, message, successMessage) {
    if (!await askYesNo(message, "Development")) return;

    try {
      await api(path, { method: "POST" });
      await loadState();
      settingsCategory = "Development";
      writePreference(preferenceKeys.settingsCategory, settingsCategory);
      renderSettings();
      showToast(successMessage);
    } catch (error) {
      showToast(error.message);
    }
  }

  async function clearLocalStoragePreferences() {
    const confirmed = await askYesNo(
      "Clear all PMT browser preferences stored in local storage? The app will reload and show first-launch defaults.",
      "Development"
    );
    if (!confirmed) return;

    clearPmtPreferences();
    window.location.reload();
  }

  return {
    handleAction,
    render: renderSettings
  };
}
