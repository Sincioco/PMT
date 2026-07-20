import { buttonContent, funnelIconHtml, iconButton, keyIconHtml } from "../../components/buttons.js?v=20260715-admin-impersonation";
import { askYesNo, initializeWindowedDialog } from "../../components/dialogs.js";
import {
  colorField,
  field,
  numberValue,
  selectTextField,
  value
} from "../../components/forms.js?v=20260719-rte-insert-diagram";
import {
  bindProfileAvatarPicker,
  focusProfileAvatarPicker,
  profileAvatarPickerHtml
} from "../../components/profile-avatar-picker.js?v=20260715-day28-v118";
import {
  defaultStatusColor,
  statusColor
} from "../../components/progress-and-status.js?v=20260714-linked-bug-percent";
import { sectionHead } from "../../components/sections.js?v=release-notes-2026-07-21-day-34-02b7eca5e037";
import { api } from "../../core/api.js";
import {
  beginImpersonation,
  currentUser,
  currentUserId,
  isImpersonating,
  logout
} from "../../core/authentication.js?v=20260715-admin-impersonation";
import {
  navigationSettingsItems,
  readNavigationConfig,
  resetNavigationConfig,
  writeNavigationConfig
} from "../../core/navigation-preferences.js?v=20260718-diagram-library-v8";
import {
  clearPmtPreferences,
  preferenceKeys,
  readJsonPreference,
  readPreference,
  writeJsonPreference,
  writePreference
} from "../../core/preferences.js?v=20260715-admin-impersonation";
import {
  parseRouteFromLocation,
  routeForSettingsCategory,
  routeForView,
  savedViewPreference,
  updateBrowserUrl
} from "../../core/router.js?v=20260718-diagram-entity-v22";
import { state } from "../../core/store.js";
import {
  formatDate,
  formatDateTime,
  toDateInput
} from "../../shared/dates.js";
import { appUrl } from "../../shared/app-urls.js";
import { canEditUser } from "../../shared/permissions.js?v=20260715-admin-impersonation";
import { createReorderDrag } from "../../shared/reorder-drag.js";
import {
  roleLabel,
  userById
} from "../../shared/selectors.js?v=20260713-managed-roles";
import {
  escapeAttr,
  escapeHtml,
  normalizeLinksInElement
} from "../../shared/text-and-links.js";
import {
  downloadXlsx,
  exportFileName
} from "../../shared/table-export.js?v=20260714-security-inheritance";

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
const coreLookupTypes = ["Status", "Priority", "Severity", "Environment", "LogCategory", "Role"];
const securityRights = [
  { name: "Read", property: "canRead" },
  { name: "Create", property: "canCreate" },
  { name: "Update", property: "canUpdate" },
  { name: "Delete", property: "canDelete" },
  { name: "Import", property: "canImport" },
  { name: "Export", property: "canExport" }
];

export function createSettingsFeature({
  app,
  deleteItem,
  loadState,
  openEditor,
  render,
  resetUserPassword,
  saveJson,
  showToast,
  uploadFile
}) {
  let lookupTypeFilter = readPreference(preferenceKeys.lookupType, "Status");
  let settingsCategory = readPreference(preferenceKeys.settingsCategory, lookupTypeFilter || "Status");
  let developmentActionRunning = false;
  let settingsTableFilters = normalizeSettingsTableFilters(readJsonPreference(preferenceKeys.settingsTableFilters, {}));
  let selectedSecurityResourceKey = "";
  let auditTrailEvents = null;
  let auditTrailLoading = false;
  let auditTrailError = "";
  let auditTrailRequestVersion = 0;
  let maintenanceRecycleItems = null;
  let maintenanceOrphanFiles = null;
  let maintenanceRecycleLoading = false;
  let maintenanceFilesLoading = false;
  let maintenanceRecycleRequestVersion = 0;
  let maintenanceFilesRequestVersion = 0;
  let maintenanceRecycleError = "";
  let maintenanceFilesError = "";
  let maintenanceRecycleActionBusy = false;
  let maintenanceFilesActionBusy = false;
  let selectedMaintenanceRecycleItems = new Set();
  let selectedMaintenanceFiles = new Set();
  if (savedViewPreference === "Users" || savedViewPreference === "Holidays") settingsCategory = savedViewPreference;
  if (savedViewPreference === "Lookups") settingsCategory = lookupTypeFilter;

  function renderSettings() {
    const lookupTypes = settingsLookupTypes();
    const categories = ["Users", ...(currentUser().isAdmin ? ["Security", "Audit Trail", "Maintenance"] : []), "Navigation", "Holidays", ...lookupTypes, "Development"];
    const route = parseRouteFromLocation();
    const routedCategory = route.view === "Settings"
      ? settingsCategoryForRoute(categories, route.settingsCategory)
      : "";
    if (routedCategory) selectSettingsCategory(routedCategory);
    if (!categories.includes(settingsCategory)) settingsCategory = lookupTypes[0] || "Status";
    if (route.view === "Settings" && route.settingsCategory && !routedCategory) {
      updateBrowserUrl(routeForSettingsCategory(settingsCategory), { replace: true });
    }

    const isUsers = settingsCategory === "Users";
    const isHolidays = settingsCategory === "Holidays";
    const isNavigation = settingsCategory === "Navigation";
    const isSecurity = settingsCategory === "Security";
    const isAuditTrail = settingsCategory === "Audit Trail";
    const isMaintenance = settingsCategory === "Maintenance";
    const isDevelopment = settingsCategory === "Development";
    if (!isUsers && !isHolidays && !isNavigation && !isSecurity && !isAuditTrail && !isMaintenance && !isDevelopment) {
      lookupTypeFilter = settingsCategory;
      writePreference(preferenceKeys.lookupType, lookupTypeFilter);
    }

    let actionsHtml = `
      <button class="primary text-icon-button" type="button" data-action="new-lookup" ${currentUser().isAdmin ? "" : "disabled"}>${buttonContent("&#10010;", settingsNewLookupButtonLabel(settingsCategory))}</button>
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
    if (isSecurity) actionsHtml = `
      <button class="secondary text-icon-button" type="button" data-action="security-audit">${buttonContent("&#128203;", "Audit")}</button>
      <button class="primary text-icon-button" type="button" data-action="save-security">${buttonContent("&#10003;", "Save Security")}</button>
    `;
    if (isAuditTrail) actionsHtml = `<button class="secondary text-icon-button" type="button" data-action="audit-trail-refresh">${buttonContent("&#8635;", "Refresh")}</button>`;
    if (isMaintenance) actionsHtml = `<button class="secondary text-icon-button" type="button" data-action="maintenance-refresh">${buttonContent("&#8635;", "Refresh")}</button>`;
    if (isDevelopment) actionsHtml = `<span class="settings-action-spacer" aria-hidden="true"></span>`;

    const contentHtml = isUsers
      ? settingsUsersHtml()
      : isHolidays
        ? settingsHolidaysHtml()
        : isNavigation
          ? settingsNavigationHtml()
          : isSecurity
            ? settingsSecurityHtml()
            : isAuditTrail
              ? settingsAuditTrailHtml()
              : isMaintenance
                ? settingsMaintenanceHtml()
                : isDevelopment
                  ? settingsDevelopmentHtml()
                  : settingsLookupHtml(settingsCategory);

    app.innerHTML = `
      ${sectionHead("Settings", actionsHtml)}
      <div class="lookup-layout settings-layout">
        <aside class="panel lookup-picker settings-category-picker">
          ${categories.map(type => `
            <button type="button" data-action="select-lookup-type" data-id="0" data-type="${escapeAttr(type)}" class="${type === settingsCategory ? "active" : ""}">
              ${buttonContent(settingsCategoryIcon(type), settingsCategoryLabel(type))}
            </button>
          `).join("")}
        </aside>
        ${contentHtml}
      </div>
    `;
    bindNavigationDragEvents();
    bindSecurityPermissionEvents();
    bindMaintenanceSelectionEvents();
    if (isAuditTrail) ensureAuditTrailData();
    if (isMaintenance) ensureMaintenanceData();
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
    if (action === "reset-user-password") {
      resetUserPassword(userById(id));
      return true;
    }
    if (action === "impersonate-user") {
      await impersonateUser(userById(id));
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
      editLookup({ lookupType: settingsIsLookupCategory(settingsCategory) ? settingsCategory : "Status" });
      return true;
    }
    if (action === "edit-lookup") {
      editLookup(state.lookups.find(item => item.id === id));
      return true;
    }
    if (action === "delete-lookup") {
      const lookup = state.lookups.find(item => item.id === id);
      await deleteItem(
        `/api/lookups/${id}`,
        lookup?.lookupType === "Role" ? "Delete this role?" : "Deactivate this setting value?"
      );
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
    if (action === "select-security-resource") {
      selectedSecurityResourceKey = button.dataset.resourceKey || "";
      renderSettings();
      return true;
    }
    if (action === "save-security") {
      await saveSecurityPermissions();
      return true;
    }
    if (action === "security-audit") {
      openSecurityAuditDialog();
      return true;
    }
    if (action === "audit-trail-refresh") {
      refreshAuditTrail();
      return true;
    }
    if (action === "reset-security-override") {
      resetSecurityUserOverride(button);
      return true;
    }
    if (action === "sort-settings-table") {
      return updateSettingsTableSort(button);
    }
    if (action === "maintenance-refresh") {
      refreshMaintenanceData();
      return true;
    }
    if (action === "maintenance-select-all") {
      setAllMaintenanceSelections(button.dataset.maintenanceKind, true);
      return true;
    }
    if (action === "maintenance-clear-all") {
      setAllMaintenanceSelections(button.dataset.maintenanceKind, false);
      return true;
    }
    if (action === "maintenance-review-recycle") {
      await reviewMaintenanceRecycleBin();
      return true;
    }
    if (action === "maintenance-review-files") {
      await reviewMaintenanceOrphanFiles();
      return true;
    }
    if (action === "development-clear-non-pmt") {
      await runDevelopmentAction(
        "/api/development/clear-non-pmt",
        "Clear Projects other than PMT, including their Sprints, Dev Tasks, Bugs, Scrum, and Documentation? PMT will remain intact.",
        "Project data other than PMT cleared."
      );
      return true;
    }
    if (action === "development-clear-pmt") {
      await runDevelopmentAction(
        "/api/development/clear-pmt",
        "Clear the PMT demo Project, Sprints, Dev Tasks, Bugs, Scrum, and Documentation? PMTQA will remain intact.",
        "PMT demo data cleared."
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
        "Factory reset PMT? This will delete all data in the database and re-seed it with the original demo projects.",
        "PMT factory reset completed."
      );
      return true;
    }
    if (action === "development-restore-pmt-seed-data") {
      await runDevelopmentAction(
        "/api/development/restore-pmt-seed-data",
        "Restore the original PMT demo Project and recreate missing demo users? PMT must already be permanently deleted.",
        "PMT seed data restored."
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

  function settingsMaintenanceHtml() {
    return `
      <div class="panel settings-content-panel maintenance-panel">
        <div>
          <h2>Maintenance</h2>
          <p class="muted">Permanently remove selected recycle-bin records or uploaded files that PMT no longer references. These actions cannot be undone.</p>
        </div>
        ${maintenanceRecycleSectionHtml()}
        ${maintenanceFilesSectionHtml()}
      </div>
    `;
  }

  function maintenanceRecycleSectionHtml() {
    const items = maintenanceRecycleItems || [];
    const selectedCount = selectedMaintenanceRecycleItems.size;
    return `
      <section class="maintenance-section" data-maintenance-section="recycle">
        <div class="maintenance-section-head">
          <div>
            <h3>Recycle Bin</h3>
            <p class="muted">Archived Projects and deleted Sprints, work items, Scrum/Log entries, and Documentation. A Project preview also shows every related record that will be removed.</p>
          </div>
          <div class="toolbar maintenance-selection-actions">
            <button class="secondary text-icon-button" type="button" data-action="maintenance-select-all" data-maintenance-kind="recycle">${buttonContent("&#9745;", "Select All")}</button>
            <button class="secondary text-icon-button" type="button" data-action="maintenance-clear-all" data-maintenance-kind="recycle">${buttonContent("&#9744;", "Clear All")}</button>
          </div>
        </div>
        ${maintenanceInventoryMessageHtml(maintenanceRecycleLoading, maintenanceRecycleError, items.length, "The recycle bin is empty.")}
        ${items.length ? `
          <div class="maintenance-table-scroll">
            <table class="table settings-table maintenance-table">
              <thead><tr><th class="maintenance-select-column">Delete</th><th>Item</th><th>Type</th><th>Deleted</th></tr></thead>
              <tbody>
                ${items.map(item => {
                  const key = maintenanceRecycleKey(item);
                  return `
                    <tr>
                      <td class="maintenance-select-column"><input type="checkbox" data-maintenance-select="recycle" data-maintenance-key="${escapeAttr(key)}" aria-label="Select ${escapeAttr(item.label)}" ${selectedMaintenanceRecycleItems.has(key) ? "checked" : ""}></td>
                      <td><strong>${escapeHtml(item.label)}</strong>${item.details ? `<span class="maintenance-row-detail muted">${escapeHtml(item.details)}</span>` : ""}</td>
                      <td>${escapeHtml(item.itemType)}</td>
                      <td>${escapeHtml(formatMaintenanceDate(item.deletedAt))}</td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        ` : ""}
        <div class="maintenance-section-actions">
          <span class="muted" data-maintenance-selection-count>${selectedCount} selected</span>
          <button class="danger text-icon-button" type="button" data-action="maintenance-review-recycle" ${selectedCount && !maintenanceRecycleActionBusy ? "" : "disabled"}>${buttonContent("&#128465;", "Review Selected")}</button>
        </div>
      </section>
    `;
  }

  function maintenanceFilesSectionHtml() {
    const files = maintenanceOrphanFiles || [];
    const selectedCount = selectedMaintenanceFiles.size;
    return `
      <section class="maintenance-section" data-maintenance-section="files">
        <div class="maintenance-section-head">
          <div>
            <h3>Orphaned Uploaded Files</h3>
            <p class="muted">Files older than 24 hours that are not referenced by any PMT record or rich-text content. PMT checks each file again immediately before deleting it.</p>
          </div>
          <div class="toolbar maintenance-selection-actions">
            <button class="secondary text-icon-button" type="button" data-action="maintenance-select-all" data-maintenance-kind="files">${buttonContent("&#9745;", "Select All")}</button>
            <button class="secondary text-icon-button" type="button" data-action="maintenance-clear-all" data-maintenance-kind="files">${buttonContent("&#9744;", "Clear All")}</button>
          </div>
        </div>
        ${maintenanceInventoryMessageHtml(maintenanceFilesLoading, maintenanceFilesError, files.length, "No orphaned uploaded files were found.")}
        ${files.length ? `
          <div class="maintenance-table-scroll">
            <table class="table settings-table maintenance-table maintenance-files-table">
              <thead><tr><th class="maintenance-select-column">Delete</th><th>File</th><th>Size</th><th>Last Modified</th></tr></thead>
              <tbody>
                ${files.map(file => `
                  <tr>
                    <td class="maintenance-select-column"><input type="checkbox" data-maintenance-select="files" data-maintenance-key="${escapeAttr(file.relativePath)}" aria-label="Select ${escapeAttr(file.relativePath)}" ${selectedMaintenanceFiles.has(file.relativePath) ? "checked" : ""}></td>
                    <td>${maintenanceFileLinkHtml(file)}</td>
                    <td>${escapeHtml(formatMaintenanceFileSize(file.byteLength))}</td>
                    <td>${escapeHtml(formatMaintenanceDate(file.lastModifiedAt))}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : ""}
        <div class="maintenance-section-actions">
          <span class="muted" data-maintenance-selection-count>${selectedCount} selected</span>
          <button class="danger text-icon-button" type="button" data-action="maintenance-review-files" ${selectedCount && !maintenanceFilesActionBusy ? "" : "disabled"}>${buttonContent("&#128465;", "Review Selected")}</button>
        </div>
      </section>
    `;
  }

  function maintenanceInventoryMessageHtml(loading, error, itemCount, emptyMessage) {
    if (loading) return `<div class="empty">Loading...</div>`;
    if (error) return `<div class="maintenance-error" role="alert">${escapeHtml(error)}</div>`;
    if (!itemCount) return `<div class="empty">${escapeHtml(emptyMessage)}</div>`;
    return "";
  }

  function ensureMaintenanceData() {
    if (!currentUser().isAdmin) return;
    if (maintenanceRecycleItems === null && !maintenanceRecycleLoading) void loadMaintenanceRecycleBin();
    if (maintenanceOrphanFiles === null && !maintenanceFilesLoading) void loadMaintenanceOrphanFiles();
  }

  function maintenanceRouteIsActive() {
    const route = parseRouteFromLocation();
    const maintenanceRoute = routeForSettingsCategory("Maintenance");
    const currentRoute = route.settingsCategory
      ? `${routeForView("Settings")}/${route.settingsCategory}`
      : routeForView("Settings");
    return route.view === "Settings"
      && settingsCategory === "Maintenance"
      && (!route.settingsCategory || currentRoute === maintenanceRoute);
  }

  async function loadMaintenanceRecycleBin() {
    const requestVersion = ++maintenanceRecycleRequestVersion;
    maintenanceRecycleLoading = true;
    maintenanceRecycleError = "";
    try {
      const result = await api("/api/maintenance/recycle-bin");
      if (requestVersion !== maintenanceRecycleRequestVersion) return;
      maintenanceRecycleItems = Array.isArray(result) ? result : (result?.items || []);
      selectedMaintenanceRecycleItems = new Set(maintenanceRecycleItems.map(maintenanceRecycleKey));
    } catch (error) {
      if (requestVersion !== maintenanceRecycleRequestVersion) return;
      maintenanceRecycleItems = [];
      selectedMaintenanceRecycleItems.clear();
      maintenanceRecycleError = error.message;
    } finally {
      if (requestVersion !== maintenanceRecycleRequestVersion) return;
      maintenanceRecycleLoading = false;
      if (maintenanceRouteIsActive()) renderSettings();
    }
  }

  async function loadMaintenanceOrphanFiles() {
    const requestVersion = ++maintenanceFilesRequestVersion;
    maintenanceFilesLoading = true;
    maintenanceFilesError = "";
    try {
      const result = await api("/api/maintenance/orphan-files");
      if (requestVersion !== maintenanceFilesRequestVersion) return;
      maintenanceOrphanFiles = Array.isArray(result) ? result : (result?.files || []);
      selectedMaintenanceFiles = new Set(maintenanceOrphanFiles.map(file => file.relativePath));
    } catch (error) {
      if (requestVersion !== maintenanceFilesRequestVersion) return;
      maintenanceOrphanFiles = [];
      selectedMaintenanceFiles.clear();
      maintenanceFilesError = error.message;
    } finally {
      if (requestVersion !== maintenanceFilesRequestVersion) return;
      maintenanceFilesLoading = false;
      if (maintenanceRouteIsActive()) renderSettings();
    }
  }

  function refreshMaintenanceData() {
    maintenanceRecycleRequestVersion += 1;
    maintenanceFilesRequestVersion += 1;
    maintenanceRecycleLoading = false;
    maintenanceFilesLoading = false;
    maintenanceRecycleItems = null;
    maintenanceOrphanFiles = null;
    maintenanceRecycleError = "";
    maintenanceFilesError = "";
    selectedMaintenanceRecycleItems.clear();
    selectedMaintenanceFiles.clear();
    if (maintenanceRouteIsActive()) renderSettings();
  }

  function bindMaintenanceSelectionEvents() {
    app.querySelectorAll("[data-maintenance-select]").forEach(checkbox => {
      checkbox.addEventListener("change", () => {
        const kind = checkbox.dataset.maintenanceSelect;
        const selection = kind === "recycle" ? selectedMaintenanceRecycleItems : selectedMaintenanceFiles;
        if (checkbox.checked) selection.add(checkbox.dataset.maintenanceKey);
        else selection.delete(checkbox.dataset.maintenanceKey);
        updateMaintenanceSelectionUi(kind);
      });
    });
  }

  function setAllMaintenanceSelections(kind, selected) {
    const isRecycle = kind === "recycle";
    const items = isRecycle ? (maintenanceRecycleItems || []) : (maintenanceOrphanFiles || []);
    const selection = isRecycle ? selectedMaintenanceRecycleItems : selectedMaintenanceFiles;
    selection.clear();
    if (selected) {
      items.forEach(item => selection.add(isRecycle ? maintenanceRecycleKey(item) : item.relativePath));
    }

    app.querySelectorAll(`[data-maintenance-select='${kind}']`).forEach(checkbox => {
      checkbox.checked = selected;
    });
    updateMaintenanceSelectionUi(kind);
  }

  function updateMaintenanceSelectionUi(kind) {
    const section = app.querySelector(`[data-maintenance-section='${kind}']`);
    const selectedCount = kind === "recycle" ? selectedMaintenanceRecycleItems.size : selectedMaintenanceFiles.size;
    const count = section?.querySelector("[data-maintenance-selection-count]");
    const review = section?.querySelector(`[data-action='maintenance-review-${kind === "recycle" ? "recycle" : "files"}']`);
    if (count) count.textContent = `${selectedCount} selected`;
    const busy = kind === "recycle" ? maintenanceRecycleActionBusy : maintenanceFilesActionBusy;
    if (review) review.disabled = selectedCount === 0 || busy;
  }

  async function reviewMaintenanceRecycleBin() {
    const selected = (maintenanceRecycleItems || []).filter(item => selectedMaintenanceRecycleItems.has(maintenanceRecycleKey(item)));
    if (!selected.length || maintenanceRecycleActionBusy) return;
    maintenanceRecycleActionBusy = true;
    updateMaintenanceSelectionUi("recycle");

    const payload = {
      items: selected.map(item => ({ itemType: item.itemType, itemId: item.itemId }))
    };

    try {
      const previewResult = await saveJson("/api/maintenance/recycle-bin/preview", "POST", payload);
      if (!maintenanceRouteIsActive()) return;
      const preview = Array.isArray(previewResult) ? previewResult : (previewResult?.items || []);
      const confirmed = await confirmMaintenanceDeletion({
        title: "Permanently Delete Recycle-Bin Items",
        warning: `${preview.length} database item${preview.length === 1 ? "" : "s"} will be permanently deleted. Review the complete server-generated list below. This cannot be undone.`,
        items: preview.map(item => ({
          label: item.label,
          details: item.details,
          badge: item.isCascade ? "Included with Project" : item.itemType
        })),
        confirmLabel: "Permanently Delete"
      });
      if (!confirmed || !maintenanceRouteIsActive()) return;

      const purgeResult = await saveJson("/api/maintenance/recycle-bin/purge", "POST", {
        ...payload,
        expectedItems: preview.map(item => ({ itemType: item.itemType, itemId: item.itemId }))
      });
      const purged = Array.isArray(purgeResult) ? purgeResult : (purgeResult?.items || []);
      showToast(`${purged.length} recycle-bin item${purged.length === 1 ? "" : "s"} permanently deleted.`);
      refreshMaintenanceData();
    } catch (error) {
      showToast(error.message);
      refreshMaintenanceData();
    } finally {
      maintenanceRecycleActionBusy = false;
      updateMaintenanceSelectionUi("recycle");
    }
  }

  async function reviewMaintenanceOrphanFiles() {
    const selected = (maintenanceOrphanFiles || []).filter(file => selectedMaintenanceFiles.has(file.relativePath));
    if (!selected.length || maintenanceFilesActionBusy) return;
    maintenanceFilesActionBusy = true;
    updateMaintenanceSelectionUi("files");

    const confirmed = await confirmMaintenanceDeletion({
      title: "Permanently Delete Orphaned Files",
      warning: `${selected.length} uploaded file${selected.length === 1 ? "" : "s"} will be checked again and then permanently deleted if still unreferenced. This cannot be undone.`,
      items: selected.map(file => ({
        label: file.relativePath,
        details: `${formatMaintenanceFileSize(file.byteLength)} | Last modified ${formatMaintenanceDate(file.lastModifiedAt)}`,
        badge: "File"
      })),
      confirmLabel: "Permanently Delete"
    });
    if (!confirmed || !maintenanceRouteIsActive()) {
      maintenanceFilesActionBusy = false;
      updateMaintenanceSelectionUi("files");
      return;
    }

    try {
      const result = await saveJson("/api/maintenance/orphan-files/delete", "POST", {
        relativePaths: selected.map(file => file.relativePath)
      });
      const deleted = Number(result?.deletedCount || 0);
      const skipped = Number(result?.skippedCount ?? result?.skippedFiles?.length ?? 0);
      const failed = Number(result?.failedCount || 0);
      showToast(`${deleted} file${deleted === 1 ? "" : "s"} deleted${skipped ? `, ${skipped} skipped` : ""}${failed ? `, ${failed} failed` : ""}.`);
      maintenanceOrphanFiles = null;
      selectedMaintenanceFiles.clear();
      if (maintenanceRouteIsActive()) renderSettings();
    } catch (error) {
      showToast(error.message);
      maintenanceOrphanFiles = null;
      selectedMaintenanceFiles.clear();
      if (maintenanceRouteIsActive()) renderSettings();
    } finally {
      maintenanceFilesActionBusy = false;
      updateMaintenanceSelectionUi("files");
    }
  }

  function confirmMaintenanceDeletion({ title, warning, items, confirmLabel }) {
    return new Promise(resolve => {
      const modal = document.createElement("dialog");
      modal.className = "dialog windowed-dialog maintenance-confirm-dialog";
      modal.innerHTML = `
        <div class="dialog-head"><h2>${escapeHtml(title)}</h2></div>
        <div class="dialog-body maintenance-confirm-dialog-body">
          <p class="maintenance-warning">${escapeHtml(warning)}</p>
          <ul class="maintenance-confirm-list">
            ${items.map(item => `
              <li>
                <div><strong>${escapeHtml(item.label)}</strong>${item.details ? `<span class="maintenance-row-detail muted">${escapeHtml(item.details)}</span>` : ""}</div>
                <span class="pill">${escapeHtml(item.badge)}</span>
              </li>
            `).join("")}
          </ul>
        </div>
        <div class="dialog-actions">
          <button type="button" class="secondary text-icon-button" data-maintenance-confirm="cancel">${buttonContent("&#10005;", "Cancel")}</button>
          <button type="button" class="danger text-icon-button" data-maintenance-confirm="delete">${buttonContent("&#128465;", confirmLabel)}</button>
        </div>
      `;

      let settled = false;
      const finish = confirmed => {
        if (settled) return;
        settled = true;
        modal.close();
        modal.remove();
        resolve(confirmed);
      };

      modal.querySelector("[data-maintenance-confirm='cancel']").addEventListener("click", () => finish(false));
      modal.querySelector("[data-maintenance-confirm='delete']").addEventListener("click", () => finish(true));
      modal.addEventListener("cancel", event => {
        event.preventDefault();
        finish(false);
      });
      document.body.appendChild(modal);
      initializeWindowedDialog(modal, { showResetButton: false });
      modal.showModal();
    });
  }

  function maintenanceRecycleKey(item) {
    return `${item.itemType}:${item.itemId}`;
  }

  function formatMaintenanceDate(dateValue) {
    if (!dateValue) return "";
    const date = new Date(dateValue);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
  }

  function formatMaintenanceFileSize(byteLength) {
    const bytes = Math.max(0, Number(byteLength) || 0);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function maintenanceFileLinkHtml(file) {
    const label = `<code>${escapeHtml(file.relativePath)}</code>`;
    const url = String(file.url || "");
    if (!url.startsWith("/") || url.startsWith("//")) return label;

    return `<a href="${escapeAttr(appUrl(url))}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  }

  function settingsDevelopmentHtml() {
    const canRun = currentUser().isAdmin && !developmentActionRunning;
    return `
      <div class="panel development-panel settings-content-panel">
        <div>
          <h2>Development</h2>
          <p class="muted">Warning, buttons on this screen can delete projects or reset the entire database back to its initial installed state.  Please do not click buttons on this screen unless you know what you are doing.</p>
        </div>
        <div class="development-actions">
          <div class="development-action-row">
            <div>
              <strong>Clear All Projects Except PMT</strong>
              <p class="muted">Deletes Projects other than PMT, including their Sprints, Dev Tasks, Bugs, Scrum, and Documentation, etc.  So be careful!</p>
            </div>
            <button class="secondary text-icon-button" type="button" data-action="development-clear-non-pmt" ${canRun ? "" : "disabled"}>${buttonContent("&#128465;", "Clear All Except PMT")}</button>
          </div>
          <div class="development-action-row danger-row">
            <div>
              <strong>Clear PMT Demo</strong>
              <p class="muted">Deletes only the resettable PMT demo Project and its data. PMTQA remains unchanged.</p>
            </div>
            <button class="danger text-icon-button" type="button" data-action="development-clear-pmt" ${canRun ? "" : "disabled"}>${buttonContent("&#9888;", "Clear PMT Demo")}</button>
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
              <strong>Factory Reset PMT</strong>
              <p class="muted">This will delete all data in the database and re-seed it with the original demo projects.</p>
            </div>
            <button class="primary text-icon-button" type="button" data-action="development-restore-seed-data" ${canRun ? "" : "disabled"}>${buttonContent("&#8635;", "Factory Reset PMT")}</button>
          </div>
          <div class="development-action-row">
            <div>
              <strong>Restore PMT Seed Data</strong>
              <p class="muted">Recreates missing demo users and restores the original PMT demo Project.</p>
            </div>
            <button class="primary text-icon-button" type="button" data-action="development-restore-pmt-seed-data" ${canRun ? "" : "disabled"}>${buttonContent("&#8635;", "Restore PMT Seed Data")}</button>
          </div>
          <div class="development-action-row">
            <div>
              <strong>Clear User Preferences Stored in Local Storage</strong>
              <p class="muted">Clears this browser's PMT preferences, logs out, and reloads the app so the user can log back in.</p>
            </div>
            <button class="secondary text-icon-button" type="button" data-action="development-clear-local-storage">${buttonContent("&#9003;", "Clear User Preferences Stored in Local Storage")}</button>
          </div>
        </div>
      </div>
    `;
  }

  function settingsLookupHtml(type) {
    const isRole = type === "Role";
    const rows = [...(state.lookups || [])]
      .filter(item => item.lookupType === type)
      .filter(item => settingsLookupMatchesFilters(item, type))
      .sort((a, b) => settingsLookupSortCompare(a, b, type));

    return `
      <div class="panel settings-content-panel settings-table-panel">
        ${settingsTableHeadHtml(settingsCategoryLabel(type), settingsLookupTableDescription(type))}
        <table class="table settings-table">
          <thead>
            <tr>
              ${settingsSortHeaderHtml(type, "value", "Value")}
              ${isRole ? "" : settingsSortHeaderHtml(type, "color", "Color")}
              ${settingsSortHeaderHtml(type, "order", "Order")}
              ${settingsSortHeaderHtml(type, "active", "Active")}
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(item => `
              <tr class="clickable-row" data-action="edit-lookup" data-id="${item.id}">
                <td>${escapeHtml(item.value)}</td>
                ${isRole ? "" : `<td>${item.lookupType === "Status" ? `<span class="lookup-color" style="--status-color:${escapeAttr(statusColor(item.value))}"></span>` : `<span class="muted">n/a</span>`}</td>`}
                <td>${item.displayOrder}</td>
                <td>${item.isActive ? "Yes" : "No"}</td>
                <td class="action-cell">
                  ${iconButton("edit-lookup", item.id, "Edit", "edit", currentUser().isAdmin)}
                  ${iconButton("delete-lookup", item.id, isRole ? "Delete" : "Deactivate", "delete", currentUser().isAdmin, "danger")}
                </td>
              </tr>
            `).join("") || `<tr><td colspan="${isRole ? 4 : 5}"><div class="empty">No setting values in this category.</div></td></tr>`}
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
        ${settingsTableHeadHtml("Holidays", "Choose which holidays are available for scheduling, then edit dates, countries, and active state.")}
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

  function settingsTableHeadHtml(title, description) {
    return `
      <div class="settings-table-head">
        <h2>${escapeHtml(title)}</h2>
        <p class="muted">${escapeHtml(description)}</p>
      </div>
    `;
  }

  function settingsLookupTableDescription(type) {
    if (type === "Environment") return "Choose which environments are available, then edit labels, display order, and active state.";
    if (type === "Role") return "Add, rename, reorder, or delete the roles available to users.";
    if (type === "LogCategory") return "Choose which Log categories are available, then edit labels, display order, and active state.";
    if (type === "Priority") return "Choose which priorities are available, then edit labels, display order, and active state.";
    if (type === "Severity") return "Choose which severities are available, then edit labels, display order, and active state.";
    if (type === "Status") return "Choose which statuses are available, then edit labels, display order, color, and active state.";
    return "Choose which values are available, then edit labels, display order, and active state.";
  }

  function settingsLookupTypes() {
    return [...new Set([...coreLookupTypes, ...(state.lookups || []).map(item => item.lookupType)])]
      .filter(Boolean)
      .sort((a, b) => settingsCategoryLabel(a).localeCompare(settingsCategoryLabel(b), undefined, { sensitivity: "base" }));
  }

  function settingsCategoryLabel(type) {
    if (type === "LogCategory") return "Log Categories";
    if (type === "Role") return "Roles";
    return type || "";
  }

  function settingsNewLookupButtonLabel(category) {
    if (category === "LogCategory") return "New Log Category";
    if (category === "Role") return "New Role";
    return "New Setting";
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
    return Boolean(category) && !["Users", "Security", "Maintenance", "Navigation", "Holidays", "Development"].includes(category);
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
    return `${settingsCategoryLabel(category)} Filters`;
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
      settingsNavigationLabel(item),
      settingsNavigationDefaultLabel(item),
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
    if (column === "default") return settingsNavigationDefaultLabel(a).localeCompare(settingsNavigationDefaultLabel(b), undefined, { numeric: true, sensitivity: "base" });
    if (column === "route") return String(a.view || "").localeCompare(String(b.view || ""), undefined, { numeric: true, sensitivity: "base" });
    return settingsNavigationLabel(a).localeCompare(settingsNavigationLabel(b), undefined, { numeric: true, sensitivity: "base" });
  }

  function settingsBooleanCompare(a, b) {
    return Number(Boolean(a)) - Number(Boolean(b));
  }

  function settingsLookupColorText(item) {
    return item.lookupType === "Status" ? statusColor(item.value) : "n/a";
  }

  function settingsSortHeaderHtml(category, column, label, options = {}) {
    const state = settingsTableSortState(category);
    const isSorted = state.column === column && Boolean(state.direction);
    const ariaSort = isSorted ? (state.direction === "asc" ? "ascending" : "descending") : "none";
    const arrow = isSorted ? (state.direction === "asc" ? "&#9650;" : "&#9660;") : "";
    const className = [isSorted ? "is-sorted" : "", options.className || ""].filter(Boolean).join(" ");
    const nextSortLabel = settingsNextSortLabel(category, column, label);
    const labelHtml = options.hideLabel ? "" : `<span>${escapeHtml(label)}</span>`;

    return `
      <th class="${className}" aria-sort="${ariaSort}">
        <button type="button" class="table-sort-button" data-action="sort-settings-table" data-category="${escapeAttr(category)}" data-column="${escapeAttr(column)}" title="${escapeAttr(nextSortLabel)}" aria-label="${escapeAttr(nextSortLabel)}">
          ${labelHtml}
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
        { column: "default", label: "Default" },
        { column: "item", label: "Navigation Item" },
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

    if (category === "Role") {
      return [
        { column: "value", label: "Value" },
        { column: "order", label: "Order" },
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
        ${settingsTableHeadHtml("Navigation", "Choose which navigation items are available, rename labels, then drag rows into the order you prefer.")}
        <table class="table settings-table settings-navigation-table work-item-table">
          <thead>
            <tr>
              ${settingsSortHeaderHtml("Navigation", "visible", "Visible", { hideLabel: true, className: "settings-nav-visible-column" })}
              ${settingsSortHeaderHtml("Navigation", "default", "Default", { className: "settings-nav-default-column" })}
              ${settingsSortHeaderHtml("Navigation", "item", "Navigation Item", { className: "settings-nav-item-column" })}
              ${settingsSortHeaderHtml("Navigation", "route", "Route")}
              <th></th>
            </tr>
          </thead>
          <tbody data-reorder-list="navigation" data-navigation-list>
            ${items.map(item => {
              const itemLabel = settingsNavigationLabel(item);
              const defaultLabel = settingsNavigationDefaultLabel(item);
              return `
              <tr class="clickable-row" data-action="rename-navigation-item" data-nav-view="${escapeAttr(item.view)}" data-view="${escapeAttr(item.view)}">
                <td class="settings-nav-visible-cell">
                  <label class="settings-nav-toggle" title="${item.visibilityLocked ? "This item must stay available in navigation." : "Show this item in navigation."}">
                    <input type="checkbox" data-action="toggle-navigation-item" data-view="${escapeAttr(item.view)}" aria-label="Show ${escapeAttr(itemLabel)} in navigation" ${item.visible ? "checked" : ""} ${item.visibilityLocked ? "disabled" : ""}>
                  </label>
                </td>
                <td class="settings-nav-default-cell">${escapeHtml(defaultLabel)}</td>
                <td class="settings-nav-item-cell">
                  <button class="settings-nav-label-button" type="button" data-action="rename-navigation-item" data-view="${escapeAttr(item.view)}" title="Rename ${escapeAttr(itemLabel)}">
                    <span class="settings-nav-icon" aria-hidden="true">${item.icon}</span>
                    <span class="settings-nav-text">
                      <span>${escapeHtml(itemLabel)}</span>
                    </span>
                  </button>
                </td>
                <td><span class="muted">${escapeHtml(routeForView(item.view))}</span></td>
                <td class="action-cell">
                  <button class="work-item-drag-handle settings-nav-drag-handle" type="button" ${canDrag ? "data-drag-handle data-navigation-drag-handle" : "disabled"} title="Drag ${escapeAttr(itemLabel)}" aria-label="Drag ${escapeAttr(itemLabel)}">
                    <span aria-hidden="true">&#8942;&#8942;</span>
                  </button>
                </td>
              </tr>
            `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function settingsNavigationLabel(item) {
    return item?.beta ? `${item.label} (beta)` : item?.label || "";
  }

  function settingsNavigationDefaultLabel(item) {
    return item?.beta ? `${item.defaultLabel} (beta)` : item?.defaultLabel || "";
  }

  function settingsSecurityHtml() {
    const resources = [...(state.securityResources || [])]
      .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
    if (!resources.length) {
      return `<div class="panel settings-content-panel"><div class="empty">Security configuration is available to administrators after Database Version 1.7 is installed.</div></div>`;
    }

    if (!resources.some(resource => resource.resourceKey === selectedSecurityResourceKey)) {
      selectedSecurityResourceKey = resources[0].resourceKey;
    }

    const selectedResource = resources.find(resource => resource.resourceKey === selectedSecurityResourceKey);
    const roles = [...(state.roles || [])]
      .filter(role => role.isActive && role.code && role.code !== "Admin")
      .sort((a, b) => a.displayOrder - b.displayOrder || a.value.localeCompare(b.value));
    const users = [...(state.users || [])]
      .filter(user => user.isActive && !user.isAdmin)
      .sort((a, b) => settingsUserDisplayName(a).localeCompare(settingsUserDisplayName(b)));

    return `
      <div class="panel settings-content-panel security-panel">
        <div class="security-layout">
          <aside class="security-resource-picker" aria-label="PMT areas">
            <div class="security-pane-head">
              <h2>PMT Areas</h2>
              <p class="muted">Choose the area to secure.</p>
            </div>
            <div class="security-resource-list">
              ${resources.map(resource => `
                <button type="button" data-action="select-security-resource" data-resource-key="${escapeAttr(resource.resourceKey)}" class="${resource.resourceKey === selectedSecurityResourceKey ? "active" : ""}">
                  ${escapeHtml(resource.name)}
                </button>
              `).join("")}
            </div>
          </aside>
          <section class="security-permissions-pane">
            <div class="security-pane-head">
              <h2>${escapeHtml(selectedResource.name)}</h2>
              <p class="muted">Role defaults are inherited. A user override replaces the inherited row; No Access always denies this area.</p>
            </div>
            <div class="security-table-section">
              <h3>Role defaults</h3>
              <div class="security-table-scroll">
                <table class="table security-permission-table">
                  ${securityPermissionTableHead(false)}
                  <tbody>
                    ${roles.map(role => securityRolePermissionRowHtml(role, selectedResource)).join("") || `<tr><td colspan="8"><div class="empty">No Roles are available.</div></td></tr>`}
                  </tbody>
                </table>
              </div>
            </div>
            <div class="security-table-section">
              <h3>User overrides</h3>
              <p class="muted security-user-help">Rows show effective permissions. Changing a checkbox creates an explicit override; Reset restores inheritance.</p>
              <div class="security-table-scroll">
                <table class="table security-permission-table security-user-permission-table">
                  ${securityPermissionTableHead(true)}
                  <tbody>
                    ${users.map(user => securityUserPermissionRowHtml(user, selectedResource)).join("") || `<tr><td colspan="10"><div class="empty">No non-Admin users are available.</div></td></tr>`}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>
    `;
  }

  function securityPermissionTableHead(showEffective) {
    return `
      <thead>
        <tr>
          <th>${showEffective ? "User" : "Role"}</th>
          ${securityRights.map(right => `<th>${right.name}</th>`).join("")}
          <th class="security-no-access-column">No Access</th>
          ${showEffective ? "<th>Override</th><th>Effective</th>" : ""}
        </tr>
      </thead>
    `;
  }

  function securityRolePermissionRowHtml(role, resource) {
    const permission = (state.rolePermissions || []).find(item =>
      item.resourceKey === resource.resourceKey && item.roleCode === role.code) || {};
    return securityPermissionRowHtml({
      scope: "role",
      principal: role.code,
      principalHtml: `<span class="security-principal-name">${escapeHtml(role.value)}</span>`,
      permission,
      resource
    });
  }

  function securityUserPermissionRowHtml(user, resource) {
    const userPermission = (state.userPermissions || []).find(item =>
      item.resourceKey === resource.resourceKey && item.userId === user.id) || {};
    const effective = effectiveUserPermission(user, resource.resourceKey);
    const isOverride = Boolean(userPermission.isOverride);
    return securityPermissionRowHtml({
      scope: "user",
      principal: String(user.id),
      principalHtml: `
        <span class="security-user-label">
          <img class="avatar" src="${escapeAttr(settingsUserAvatarUrl(user))}" alt="">
          <span><span class="security-principal-name">${escapeHtml(settingsUserDisplayName(user))}</span><span class="muted">${escapeHtml(roleLabel(user.role))}</span></span>
        </span>
      `,
      permission: isOverride ? userPermission : effective,
      resource,
      effective,
      roleCode: user.role,
      isOverride
    });
  }

  function securityPermissionRowHtml({ scope, principal, principalHtml, permission, resource, effective = null, roleCode = "", isOverride = false }) {
    const availableRights = new Set(String(resource.availableRights || "Read").split(",").map(right => right.trim()));
    const noAccess = Boolean(permission.noAccess);
    return `
      <tr data-security-permission-row data-security-scope="${scope}" data-security-principal="${escapeAttr(principal)}" data-security-resource-name="${escapeAttr(resource.name)}" ${roleCode ? `data-security-role-code="${escapeAttr(roleCode)}" data-security-override="${isOverride}" class="${isOverride ? "security-user-override" : "security-user-inherited"}"` : ""}>
        <td>${principalHtml}</td>
        ${securityRights.map(right => securityPermissionCheckbox(right, permission, availableRights, noAccess)).join("")}
        <td class="security-no-access-column">${securityNoAccessCheckbox(noAccess)}</td>
        ${effective ? `<td class="security-override-action"><button type="button" class="secondary" data-action="reset-security-override" ${isOverride ? "" : "disabled"}>Reset</button></td><td class="security-effective-rights">${securityEffectiveRightsHtml(effective)}</td>` : ""}
      </tr>
    `;
  }

  function securityPermissionCheckbox(right, permission, availableRights, noAccess) {
    const supported = availableRights.has(right.name);
    return `
      <td>
        <input type="checkbox" data-security-right="${right.property}" data-security-supported="${supported}" aria-label="${right.name}" ${permission[right.property] ? "checked" : ""} ${!supported || noAccess ? "disabled" : ""}>
      </td>
    `;
  }

  function securityNoAccessCheckbox(noAccess) {
    return `<input type="checkbox" data-security-right="noAccess" aria-label="No Access" ${noAccess ? "checked" : ""}>`;
  }

  function effectiveUserPermission(user, resourceKey) {
    const rolePermission = (state.rolePermissions || []).find(item => item.resourceKey === resourceKey && item.roleCode === user.role) || {};
    const userPermission = (state.userPermissions || []).find(item => item.resourceKey === resourceKey && item.userId === user.id) || {};
    return effectiveSecurityPermission(rolePermission, userPermission, Boolean(userPermission.isOverride));
  }

  function effectiveSecurityPermission(rolePermission, userPermission, isOverride) {
    if (rolePermission.noAccess || (isOverride && userPermission.noAccess)) return { noAccess: true };

    return Object.fromEntries(securityRights.map(right => [
      right.property,
      Boolean((isOverride ? userPermission : rolePermission)[right.property])
    ]));
  }

  function securityEffectiveRightsHtml(permission) {
    if (permission.noAccess) return `<span class="security-denied-label">No Access</span>`;
    const rights = securityRights.filter(right => permission[right.property]).map(right => right.name);
    return rights.length ? escapeHtml(rights.join(", ")) : `<span class="muted">None</span>`;
  }

  function bindSecurityPermissionEvents() {
    app.querySelectorAll("[data-security-right]").forEach(checkbox => {
      checkbox.addEventListener("change", async () => {
        const row = checkbox.closest("[data-security-permission-row]");
        if (!row) return;

        if (row.dataset.securityScope === "user" && row.dataset.securityOverride !== "true") {
          const requestedValue = checkbox.checked;
          checkbox.checked = !requestedValue;
          const userName = row.querySelector(".security-principal-name")?.textContent?.trim() || "this user";
          const confirmed = await askYesNo(
            `This change breaks Role inheritance for ${userName} in ${row.dataset.securityResourceName}. Every permission in this row will become explicit: checked grants it and unchecked denies it. Continue?`,
            "Break Inheritance"
          );
          if (!confirmed) return;

          row.dataset.securityOverride = "true";
          row.classList.remove("security-user-inherited");
          row.classList.add("security-user-override");
          row.querySelector("[data-action='reset-security-override']")?.removeAttribute("disabled");
          checkbox.checked = requestedValue;
        }

        applySecurityNoAccessState(row);
        updateSecurityEffectiveRights();
      });
    });
  }

  function applySecurityNoAccessState(row) {
    const noAccessCheckbox = row?.querySelector("[data-security-right='noAccess']");
    const noAccess = Boolean(noAccessCheckbox?.checked);
    row?.querySelectorAll("[data-security-right]:not([data-security-right='noAccess'])").forEach(checkbox => {
      if (noAccess) checkbox.checked = false;
      checkbox.disabled = noAccess || checkbox.dataset.securitySupported !== "true";
    });
  }

  function updateSecurityEffectiveRights() {
    const rows = [...app.querySelectorAll("[data-security-permission-row]")];
    const roleRows = rows.filter(row => row.dataset.securityScope === "role");
    rows.filter(row => row.dataset.securityScope === "user").forEach(userRow => {
      const roleRow = roleRows.find(row => row.dataset.securityPrincipal === userRow.dataset.securityRoleCode);
      const rolePermission = securityPermissionFromRow(roleRow);
      const isOverride = userRow.dataset.securityOverride === "true";
      if (!isOverride) setSecurityPermissionOnRow(userRow, rolePermission);
      const userPermission = securityPermissionFromRow(userRow);
      const effective = effectiveSecurityPermission(rolePermission, userPermission, isOverride);
      const effectiveCell = userRow.querySelector(".security-effective-rights");
      if (effectiveCell) effectiveCell.innerHTML = securityEffectiveRightsHtml(effective);
    });
  }

  function setSecurityPermissionOnRow(row, permission) {
    securityRights.forEach(right => {
      const checkbox = row.querySelector(`[data-security-right='${right.property}']`);
      if (checkbox) checkbox.checked = Boolean(permission[right.property]);
    });
    const noAccessCheckbox = row.querySelector("[data-security-right='noAccess']");
    if (noAccessCheckbox) noAccessCheckbox.checked = Boolean(permission.noAccess);
    applySecurityNoAccessState(row);
  }

  function resetSecurityUserOverride(button) {
    const row = button.closest("[data-security-permission-row][data-security-scope='user']");
    if (!row) return;
    const roleRow = app.querySelector(`[data-security-permission-row][data-security-scope='role'][data-security-principal='${CSS.escape(row.dataset.securityRoleCode || "")}']`);
    row.dataset.securityOverride = "false";
    row.classList.remove("security-user-override");
    row.classList.add("security-user-inherited");
    button.disabled = true;
    setSecurityPermissionOnRow(row, securityPermissionFromRow(roleRow));
    updateSecurityEffectiveRights();
  }

  function securityPermissionFromRow(row) {
    if (!row) return {};
    const permission = Object.fromEntries(securityRights.map(right => [
      right.property,
      Boolean(row.querySelector(`[data-security-right='${right.property}']`)?.checked)
    ]));
    permission.noAccess = Boolean(row.querySelector("[data-security-right='noAccess']")?.checked);
    return permission;
  }

  async function saveSecurityPermissions() {
    if (!selectedSecurityResourceKey) return;

    const rolePermissions = [];
    const userPermissions = [];
    app.querySelectorAll("[data-security-permission-row]").forEach(row => {
      const permission = securityPermissionFromRow(row);

      if (row.dataset.securityScope === "role") {
        rolePermissions.push({ ...permission, roleCode: row.dataset.securityPrincipal });
      } else {
        userPermissions.push({
          ...permission,
          userId: Number(row.dataset.securityPrincipal || 0),
          isOverride: row.dataset.securityOverride === "true"
        });
      }
    });

    const resource = (state.securityResources || []).find(item => item.resourceKey === selectedSecurityResourceKey);
    try {
      await saveJson(`/api/security/${encodeURIComponent(selectedSecurityResourceKey)}`, "PUT", {
        rolePermissions,
        userPermissions,
        expectedRowVersion: resource?.rowVersion || null
      });
      await loadState();
      settingsCategory = "Security";
      renderSettings();
      showToast("Security saved.");
    } catch (error) {
      showToast(error.message);
    }
  }

  async function resetSecurityPermissions() {
    const confirmed = await askYesNo(
      "Warning: Reset security for everyone? ALL Role permissions across ALL resources will return to their initial defaults, and ALL per-user overrides across ALL resources will be removed.",
      "Reset Security"
    );
    if (!confirmed) return false;

    try {
      await api("/api/security/reset", { method: "POST" });
      await loadState();
      settingsCategory = "Security";
      writePreference(preferenceKeys.settingsCategory, settingsCategory);
      renderSettings();
      return true;
    } catch (error) {
      showToast(error.message);
      return false;
    }
  }

  function openSecurityAuditDialog() {
    const rows = securityAuditRows();
    const modal = document.createElement("dialog");
    modal.className = "dialog windowed-dialog security-audit-dialog";
    modal.innerHTML = `
      <div class="dialog-head">
        <h2>Security Audit</h2>
      </div>
      <div class="dialog-body security-audit-dialog-body">
        <p class="muted">Effective permissions for every active user and PMT area. Administrators always have every available permission.</p>
        <div class="security-table-scroll">
          <table class="table security-permission-table security-audit-table">
            <thead><tr><th data-security-audit-column="user">User</th><th class="security-audit-resource-column" data-security-audit-column="resource">Resource</th>${securityRights.map(right => `<th data-security-audit-right="${escapeAttr(right.property)}">${right.name}</th>`).join("")}<th class="security-no-access-column" data-security-audit-column="noAccess">No Access</th></tr></thead>
            <tbody>
              ${rows.map((row, index) => `
                <tr class="${index === 0 || rows[index - 1].userId !== row.userId ? "security-audit-user-start" : ""}">
                  <td data-security-audit-column="user">${escapeHtml(row.userName)}</td>
                  <td class="security-audit-resource-column" data-security-audit-column="resource">${escapeHtml(row.resourceName)}</td>
                  ${securityRights.map(right => securityAuditRightCell(row[right.property], right)).join("")}
                  ${securityAuditNoAccessCell(row.noAccess)}
                </tr>
              `).join("") || `<tr><td colspan="9"><div class="empty">No active users are available.</div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
      <div class="dialog-actions">
        <div class="dialog-action-group is-left">
          <button type="button" class="danger text-icon-button" data-security-audit-reset>${buttonContent("&#8635;", "Reset Security")}</button>
        </div>
        <button type="button" class="secondary text-icon-button" data-security-audit-export>${buttonContent("&#8681;", "Export to Excel")}</button>
        <button type="button" class="primary text-icon-button" data-security-audit-done>${buttonContent("&#10003;", "Done")}</button>
      </div>
    `;
    modal.querySelector("[data-security-audit-reset]").addEventListener("click", async () => {
      if (!await resetSecurityPermissions()) return;
      modal.close();
      showToast("Security reset to initial defaults.");
    });
    modal.querySelector("[data-security-audit-export]").addEventListener("click", () => exportSecurityAudit(rows));
    modal.querySelector("[data-security-audit-done]").addEventListener("click", () => modal.close());
    modal.addEventListener("close", () => modal.remove());
    document.body.appendChild(modal);
    initializeWindowedDialog(modal, { showResetButton: false });
    modal.showModal();
  }

  function securityAuditRows() {
    const resources = [...(state.securityResources || [])]
      .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
    const users = [...(state.users || [])]
      .filter(user => user.isActive)
      .sort((a, b) => settingsUserDisplayName(a).localeCompare(settingsUserDisplayName(b)));
    return users.flatMap(user => resources.map(resource => {
      const availableRights = new Set(String(resource.availableRights || "Read").split(",").map(right => right.trim()));
      let effective;
      if (user.isAdmin) {
        effective = Object.fromEntries(securityRights.map(right => [right.property, availableRights.has(right.name)]));
      } else {
        const rolePermission = auditRolePermission(user.role, resource.resourceKey);
        const userPermission = auditUserPermission(user.id, resource.resourceKey);
        effective = effectiveSecurityPermission(rolePermission, userPermission, Boolean(userPermission.isOverride));
      }
      return {
        userId: user.id,
        userName: settingsUserDisplayName(user),
        resourceName: resource.name,
        ...Object.fromEntries(securityRights.map(right => [right.property, availableRights.has(right.name) && Boolean(effective[right.property])])),
        noAccess: Boolean(effective.noAccess)
      };
    }));
  }

  function auditRolePermission(roleCode, resourceKey) {
    if (resourceKey === selectedSecurityResourceKey) {
      const row = app.querySelector(`[data-security-permission-row][data-security-scope='role'][data-security-principal='${CSS.escape(roleCode || "")}']`);
      if (row) return securityPermissionFromRow(row);
    }
    return (state.rolePermissions || []).find(item => item.resourceKey === resourceKey && item.roleCode === roleCode) || {};
  }

  function auditUserPermission(userId, resourceKey) {
    if (resourceKey === selectedSecurityResourceKey) {
      const row = app.querySelector(`[data-security-permission-row][data-security-scope='user'][data-security-principal='${Number(userId)}']`);
      if (row) return { ...securityPermissionFromRow(row), isOverride: row.dataset.securityOverride === "true" };
    }
    return (state.userPermissions || []).find(item => item.resourceKey === resourceKey && item.userId === userId) || {};
  }

  function securityAuditRightCell(granted, right) {
    const status = granted ? "Granted" : "Not granted";
    const mark = granted
      ? `
        <span class="security-audit-right-status security-audit-right-granted" role="img" aria-label="${escapeAttr(`${right.name}: ${status}`)}" data-security-audit-status="granted">
          <svg class="security-audit-check-graphic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M7.5 12.5 10.5 15.5 17 8.75"></path>
          </svg>
        </span>`
      : `<span class="security-audit-right-status security-audit-right-not-granted" role="img" aria-label="${escapeAttr(`${right.name}: ${status}`)}" data-security-audit-status="not-granted">&mdash;</span>`;

    return `<td data-security-audit-right="${escapeAttr(right.property)}">${mark}</td>`;
  }

  function securityAuditNoAccessCell(checked) {
    return `<td class="security-no-access-column" data-security-audit-column="noAccess"><input type="checkbox" data-security-audit-no-access aria-label="No Access" ${checked ? "checked" : ""} disabled></td>`;
  }

  function exportSecurityAudit(rows) {
    const columns = [
      { header: "User", value: row => row.userName },
      { header: "Resource", value: row => row.resourceName },
      ...securityRights.map(right => ({ header: right.name, value: row => row[right.property] ? "Yes" : "No" })),
      { header: "No Access", value: row => row.noAccess ? "Yes" : "No" }
    ];
    downloadXlsx(exportFileName("pmt-security-audit", "xlsx"), "Security Audit", columns, rows);
  }

  function settingsAuditTrailHtml() {
    const events = auditTrailEvents || [];
    return `
      <div class="panel settings-content-panel settings-table-panel settings-audit-trail-panel">
        ${settingsTableHeadHtml("Audit Trail", "Review system activity, including when an administrator enters or exits another user's security context.")}
        ${auditTrailLoading || auditTrailEvents === null
          ? `<div class="empty">Loading audit trail...</div>`
          : auditTrailError
            ? `<div class="maintenance-error" role="alert">${escapeHtml(auditTrailError)}</div>`
            : events.length
              ? `
                <div class="settings-audit-trail-scroll">
                  <table class="table settings-table settings-audit-trail-table">
                    <thead><tr><th>When</th><th>Performed By</th><th>Acting As</th><th>Action</th><th>Record</th><th>Details</th></tr></thead>
                    <tbody>
                      ${events.map(event => `
                        <tr>
                          <td>${escapeHtml(formatDateTime(event.createdAt))}</td>
                          <td>${escapeHtml(event.actorUserName || `User #${event.actorUserId}`)}</td>
                          <td>${event.actorUserId !== event.userId ? escapeHtml(event.userName || `User #${event.userId}`) : `<span class="muted">&mdash;</span>`}</td>
                          <td>${escapeHtml(event.action || "")}</td>
                          <td>${escapeHtml(auditTrailEntityLabel(event))}</td>
                          <td>${escapeHtml(event.details || "")}</td>
                        </tr>
                      `).join("")}
                    </tbody>
                  </table>
                </div>
              `
              : `<div class="empty">No system audit entries have been recorded.</div>`}
      </div>
    `;
  }

  function auditTrailEntityLabel(event) {
    if (event.entityType === "Impersonation") return event.userName || `User #${event.entityId}`;
    return event.entityId > 0 ? `${event.entityType} #${event.entityId}` : event.entityType || "System";
  }

  function ensureAuditTrailData() {
    if (!currentUser().isAdmin || auditTrailEvents !== null || auditTrailLoading) return;
    void loadAuditTrail();
  }

  async function loadAuditTrail() {
    const requestVersion = ++auditTrailRequestVersion;
    auditTrailLoading = true;
    auditTrailError = "";
    try {
      const result = await api("/api/audit-trail");
      if (requestVersion !== auditTrailRequestVersion) return;
      auditTrailEvents = Array.isArray(result) ? result : [];
    } catch (error) {
      if (requestVersion !== auditTrailRequestVersion) return;
      auditTrailEvents = [];
      auditTrailError = error.message;
    } finally {
      if (requestVersion !== auditTrailRequestVersion) return;
      auditTrailLoading = false;
      if (settingsCategory === "Audit Trail") renderSettings();
    }
  }

  function refreshAuditTrail() {
    auditTrailRequestVersion += 1;
    auditTrailLoading = false;
    auditTrailEvents = null;
    auditTrailError = "";
    renderSettings();
  }

  async function impersonateUser(user) {
    if (!user || !currentUser().isAdmin || isImpersonating() || user.id === currentUserId) return;
    const displayName = settingsUserDisplayName(user);
    const confirmed = await askYesNo(
      `Impersonate ${displayName}? PMT will reload using this user's security context and preferences until you exit impersonation.`,
      "Impersonate User"
    );
    if (!confirmed) return;

    await beginImpersonation(user.id);
    window.location.reload();
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
                <p class="settings-user-last-login muted">Last login: ${escapeHtml(user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Never")}</p>
              </div>
            </div>
            <p>${escapeHtml(user.bio || "")}</p>
            <div class="toolbar reveal-actions">
              ${currentUser().isAdmin && !isImpersonating() ? iconButton("impersonate-user", user.id, "Impersonate", "impersonate", user.id !== currentUserId) : ""}
              ${iconButton("delete-user", user.id, "Delete", "delete", currentUser().isAdmin && user.id !== currentUserId, "danger")}
              ${iconButton("reset-user-password", user.id, "Change Password", "key", currentUser().isAdmin)}
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
    const title = roleLabel(user.role || "Developer");
    return user.isAdmin ? `${title} (Admin)` : title;
  }

  function userRoleSelectField(user) {
    const selectedRole = user.role === "Admin" ? "Developer" : user.role || "Developer";
    const roles = [...(state.roles || [])]
      .filter(role => role.code && role.code !== "Admin")
      .filter(role => role.isActive || role.code === selectedRole)
      .sort((a, b) => a.displayOrder - b.displayOrder || a.value.localeCompare(b.value));

    if (!roles.length) {
      roles.push({ code: "Developer", value: "Dev - Developer" });
    }

    return `
      <div class="field">
        <label>Role</label>
        <select name="role" required aria-required="true">
          ${roles.map(role => `<option value="${escapeAttr(role.code)}" ${role.code === selectedRole ? "selected" : ""}>${escapeHtml(role.value)}</option>`).join("")}
        </select>
      </div>
    `;
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
    normalizeLinksInElement(modal);
    modal.showModal();
  }

  function settingsCategoryIcon(type) {
    const icons = {
      Status: "&#9679;",
      Priority: "&#9733;",
      Severity: "&#9888;",
      Environment: "&#127758;",
      LogCategory: "&#9776;",
      Role: "&#128101;",
      Users: "&#128100;",
      Security: "&#128274;",
      "Audit Trail": "&#128203;",
      Maintenance: "&#9851;",
      Holidays: "&#128197;",
      Navigation: "&#9776;",
      Development: "&#128295;"
    };

    return icons[type] || "&#9881;";
  }

  function selectLookupType(type) {
    selectSettingsCategory(type);
    updateBrowserUrl(routeForSettingsCategory(settingsCategory));
    renderSettings();
  }

  function selectSettingsCategory(type) {
    settingsCategory = type || "Status";
    writePreference(preferenceKeys.settingsCategory, settingsCategory);
    if (!["Users", "Security", "Audit Trail", "Maintenance", "Holidays", "Navigation", "Development"].includes(settingsCategory)) {
      lookupTypeFilter = settingsCategory;
      writePreference(preferenceKeys.lookupType, lookupTypeFilter);
    }
  }

  function settingsCategoryForRoute(categories, categoryRoute) {
    if (!categoryRoute) return "";
    const expectedRoute = `${routeForView("Settings")}/${categoryRoute}`;
    return categories.find(category => routeForSettingsCategory(category) === expectedRoute) || "";
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
        <div class="field">
          <label>Username</label>
          <input name="nickname" type="text" value="${escapeAttr(user.nickname || "")}" maxlength="80" autocomplete="username" required>
          <span class="muted" data-username-help>You will use this username to log in.</span>
        </div>
        ${userRoleSelectField(user)}
        ${field("Phone", "phone", user.phone || "", "text")}
        ${field("Email", "email", user.email || "", "email")}
        ${profileAvatarPickerHtml(user.avatarUrl || "", avatarUrl => settingsUserAvatarUrl({ avatarUrl }))}
        <div class="field full"><label>Upload Avatar</label><input name="avatarFile" type="file" accept="image/*"></div>
        <div class="field full"><label>Avatar URL</label><input name="avatarUrl" type="text" value="${escapeAttr(user.avatarUrl || "")}"></div>
        ${field("Home Page", "homePageUrl", user.homePageUrl || "", "url")}
        ${field("Social Media", "socialMediaUrl", user.socialMediaUrl || "", "url")}
        <div class="field full"><label>Bio</label><textarea name="bio">${escapeHtml(user.bio || "")}</textarea></div>
        <label class="inline-check field full"><input name="isAdmin" type="checkbox" ${user.isAdmin ? "checked" : ""} ${currentUser().isAdmin ? "" : "disabled"}><span>Admin</span></label>
      </div>
      ${currentUser().isAdmin && user.id ? `
        <template data-editor-footer-action>
          <div class="dialog-action-group is-left">
            <button type="button" class="secondary text-icon-button" data-reset-user-password>${buttonContent(keyIconHtml(), "Change Password")}</button>
          </div>
        </template>
      ` : ""}
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

      const usernameInput = root.querySelector("[name='nickname']");
      const usernameHelp = root.querySelector("[data-username-help]");
      const username = value(root, "nickname").trim();
      if (!username) {
        focusUserField(root, "nickname");
        throw new Error("Username is required.");
      }

      const usernameSuggestion = await getUsernameSuggestion(username, user.id || 0);
      if (!usernameSuggestion.isAvailable) {
        suggestUsername(usernameInput, usernameHelp, usernameSuggestion.username);
        throw new Error(`That username is already in use. Try ${usernameSuggestion.username}.`);
      }

      const avatarFile = root.querySelector("[name='avatarFile']").files[0];
      let avatarUrl = value(root, "avatarUrl");
      if (!avatarFile && !avatarUrl.trim()) {
        focusProfileAvatarPicker(root);
        throw new Error("Select or upload an avatar before saving this user.");
      }
      if (avatarFile) avatarUrl = (await uploadFile("avatars", avatarFile)).url;

      await saveJson(user.id ? `/api/users/${user.id}` : "/api/users", user.id ? "PUT" : "POST", {
        id: user.id || 0,
        firstName,
        lastName,
        nickname: username,
        email: value(root, "email"),
        phone: value(root, "phone"),
        avatarUrl,
        homePageUrl: value(root, "homePageUrl"),
        socialMediaUrl: value(root, "socialMediaUrl"),
        bio: value(root, "bio"),
        isAdmin: root.querySelector("[name='isAdmin']").checked,
        role: value(root, "role"),
        expectedRowVersion: user.id ? user.rowVersion || null : undefined
      });
    }, "nickname", root => {
      bindProfileAvatarPicker(root);
      bindUsernameSuggestion(root, user.id || 0);
      root.closest("dialog")?.querySelector("[data-reset-user-password]")?.addEventListener("click", () => resetUserPassword(user));
    });
  }

  function bindUsernameSuggestion(root, excludeUserId) {
    const input = root.querySelector("[name='nickname']");
    const help = root.querySelector("[data-username-help]");
    input?.addEventListener("blur", async () => {
      const username = input.value.trim();
      if (!username) {
        help.textContent = "You will use this username to log in.";
        return;
      }

      try {
        const suggestion = await getUsernameSuggestion(username, excludeUserId);
        help.textContent = suggestion.isAvailable
          ? "This username is available."
          : `That username is already in use. Try ${suggestion.username}.`;
      } catch {
        help.textContent = "You will use this username to log in.";
      }
    });
  }

  async function getUsernameSuggestion(username, excludeUserId) {
    return api(`/api/usernames/suggestion?username=${encodeURIComponent(username.trim())}&excludeUserId=${excludeUserId || 0}`);
  }

  function suggestUsername(input, help, username) {
    if (!input || !username) return;
    input.value = username;
    help.textContent = `Suggested available username: ${username}`;
    input.focus();
    input.select();
  }

  function requiredUserTextField(label, name, currentValue) {
    return `<div class="field"><label>${label}</label><input name="${name}" type="text" value="${escapeAttr(currentValue ?? "")}" required></div>`;
  }

  function focusUserField(root, name) {
    const input = root.querySelector(`[name='${name}']`);
    input?.scrollIntoView({ behavior: "smooth", block: "center" });
    input?.focus({ preventScroll: true });
  }

  function editLookup(lookup = {}) {
    const isRole = lookup.lookupType === "Role";
    openEditor(
      isRole ? (lookup.id ? "Edit Role" : "New Role") : (lookup.id ? "Edit Setting" : "New Setting"),
      `
      <div class="form-grid">
        ${isRole
          ? `<input name="lookupType" type="hidden" value="Role">`
          : selectTextField("Type", "lookupType", settingsLookupTypes(), lookup.lookupType || "Status", { required: true })}
        ${field(isRole ? "Role Name" : "Value", "value", lookup.value || "", "text", "", "", "", { required: true })}
        ${isRole ? "" : colorField("Color", "colorHex", lookup.colorHex || defaultStatusColor(lookup.value || "Todo"))}
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
        colorHex: lookupType === "Status" ? value(root, "colorHex") : "",
        expectedRowVersion: lookup.id ? lookup.rowVersion || null : undefined
      });
    }, "value");
  }

  function editHoliday(holiday = {}) {
    openEditor(holiday.id ? "Edit Holiday" : "New Holiday", `
      <div class="form-grid">
        ${field("Date", "holidayDate", toDateInput(holiday.holidayDate || new Date()), "date", "", "", "", { required: true })}
        ${field("Name", "name", holiday.name || "", "text", "", "", "", { required: true })}
        ${field("Country Code", "countryCode", holiday.countryCode || "PH", "text")}
        <label class="inline-check field full"><input name="isActive" type="checkbox" ${holiday.isActive ?? true ? "checked" : ""}><span>Active</span></label>
      </div>
    `, async root => {
      await saveJson(holiday.id ? `/api/holidays/${holiday.id}` : "/api/holidays", holiday.id ? "PUT" : "POST", {
        id: holiday.id || 0,
        holidayDate: value(root, "holidayDate"),
        name: value(root, "name"),
        countryCode: value(root, "countryCode") || "PH",
        isActive: root.querySelector("[name='isActive']").checked,
        expectedRowVersion: holiday.id ? holiday.rowVersion || null : undefined
      });
    }, "holidayDate");
  }

  async function runDevelopmentAction(path, message, successMessage) {
    if (developmentActionRunning) {
      showToast("A Development action is already running.");
      return;
    }
    if (!await askYesNo(message, "Development")) return;

    developmentActionRunning = true;
    settingsCategory = "Development";
    renderSettings();

    try {
      await api(path, { method: "POST" });
      await loadState();
      settingsCategory = "Development";
      writePreference(preferenceKeys.settingsCategory, settingsCategory);
      showToast(successMessage);
    } catch (error) {
      showToast(error.message);
    } finally {
      developmentActionRunning = false;
      renderSettings();
    }
  }

  async function clearLocalStoragePreferences() {
    const confirmed = await askYesNo(
      "Clear all PMT browser preferences stored in local storage and log out? You will need to log back in.",
      "Development"
    );
    if (!confirmed) return;

    clearPmtPreferences();
    try {
      await logout();
    } catch {
      // Local storage is already cleared; reloading still returns the user to
      // the server-controlled session state.
    }
    window.location.reload();
  }

  return {
    handleAction,
    render: renderSettings
  };
}
