import { buttonContent, iconButton } from "../../components/buttons.js";
import { askYesNo } from "../../components/dialogs.js";
import {
  colorField,
  field,
  numberValue,
  selectTextField,
  value
} from "../../components/forms.js";
import {
  defaultStatusColor,
  statusColor
} from "../../components/progress-and-status.js?v=20260620-ui-theme";
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
} from "../../core/navigation-preferences.js?v=20260620-light-reference-1";
import {
  clearPmtPreferences,
  preferenceKeys,
  readPreference,
  writePreference
} from "../../core/preferences.js";
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
  if (savedViewPreference === "Users" || savedViewPreference === "Holidays") settingsCategory = savedViewPreference;
  if (savedViewPreference === "Lookups") settingsCategory = lookupTypeFilter;

  function renderSettings() {
    const lookupTypes = [...new Set(["Status", "Priority", "Severity", "Environment", ...(state.lookups || []).map(item => item.lookupType)])].sort();
    const categories = [...lookupTypes, "Users", "Holidays", "Navigation", "Development"];
    if (!categories.includes(settingsCategory)) settingsCategory = lookupTypes[0] || "Status";

    const isUsers = settingsCategory === "Users";
    const isHolidays = settingsCategory === "Holidays";
    const isNavigation = settingsCategory === "Navigation";
    const isDevelopment = settingsCategory === "Development";
    if (!isUsers && !isHolidays && !isNavigation && !isDevelopment) {
      lookupTypeFilter = settingsCategory;
      writePreference(preferenceKeys.lookupType, lookupTypeFilter);
    }

    let actionsHtml = `<button class="primary text-icon-button" type="button" data-action="new-lookup" ${currentUser().isAdmin ? "" : "disabled"}>${buttonContent("&#10010;", "New Setting")}</button>`;
    if (isUsers) actionsHtml = `<button class="primary text-icon-button" type="button" data-action="new-user" ${currentUser().isAdmin ? "" : "disabled"}>${buttonContent("&#10010;", "New User")}</button>`;
    if (isHolidays) actionsHtml = `<button class="primary text-icon-button" type="button" data-action="new-holiday" ${currentUser().isAdmin ? "" : "disabled"}>${buttonContent("&#10010;", "New Holiday")}</button>`;
    if (isNavigation) actionsHtml = `<button class="secondary text-icon-button" type="button" data-action="navigation-reset-defaults">${buttonContent("&#8635;", "Reset")}</button>`;
    if (isDevelopment) actionsHtml = "";

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
      .sort((a, b) => a.displayOrder - b.displayOrder || a.value.localeCompare(b.value));

    return `
      <div class="panel settings-content-panel settings-table-panel">
        <table class="table settings-table">
          <thead>
            <tr>
              <th>Value</th>
              <th>Color</th>
              <th>Order</th>
              <th>Active</th>
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
    const rows = [...(state.holidays || [])].sort((a, b) => new Date(b.holidayDate) - new Date(a.holidayDate) || a.name.localeCompare(b.name));

    return `
      <div class="panel settings-content-panel settings-table-panel">
        <table class="table settings-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Name</th>
              <th>Country</th>
              <th>Active</th>
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

  function settingsNavigationHtml() {
    const items = navigationSettingsItems();
    return `
      <div class="panel settings-content-panel settings-table-panel settings-navigation-panel">
        <div class="settings-navigation-head">
          <h2>Navigation</h2>
          <p class="muted">Choose which navigation items are available, rename labels, then drag rows into the order you prefer.</p>
        </div>
        <table class="table settings-table settings-navigation-table work-item-table">
          <thead>
            <tr>
              <th>Visible</th>
              <th>Navigation Item</th>
              <th>Default</th>
              <th>Route</th>
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
                  <button class="work-item-drag-handle settings-nav-drag-handle" type="button" data-drag-handle data-navigation-drag-handle title="Drag ${escapeAttr(item.label)}" aria-label="Drag ${escapeAttr(item.label)}">
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
              <img class="avatar" src="${escapeAttr(user.avatarUrl || "/assets/avatar-default.svg")}" alt="">
              <div>
                <h3>${escapeHtml(user.nickname)}</h3>
                <p class="muted">${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)} ${escapeHtml(user.role || (user.isAdmin ? "Admin" : "Developer"))}</p>
              </div>
            </div>
            <p>${escapeHtml(user.bio || "")}</p>
            <p class="muted">${escapeHtml(user.email || "")}</p>
            <div class="toolbar reveal-actions">
              ${iconButton("delete-user", user.id, "Delete", "delete", currentUser().isAdmin && user.id !== currentUserId, "danger")}
              ${iconButton("edit-user", user.id, "Edit", "edit", canEditUser(user.id))}
            </div>
          </article>
        `).join("")}
      </div>
    `;
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
        ${field("First Name", "firstName", user.firstName || "", "text")}
        ${field("Last Name", "lastName", user.lastName || "", "text")}
        ${field("Nickname", "nickname", user.nickname || "", "text")}
        ${field("Email", "email", user.email || "", "email")}
        ${field("Phone", "phone", user.phone || "", "text")}
        ${field("Avatar URL", "avatarUrl", user.avatarUrl || "", "text")}
        <div class="field full"><label>Upload Avatar</label><input name="avatarFile" type="file" accept="image/*"></div>
        ${field("Home Page", "homePageUrl", user.homePageUrl || "", "url")}
        ${field("Social Media", "socialMediaUrl", user.socialMediaUrl || "", "url")}
        ${selectTextField("Role", "role", ["Developer", "QA"], user.role === "Admin" ? "Developer" : user.role || "Developer")}
        <div class="field full"><label>Bio</label><textarea name="bio">${escapeHtml(user.bio || "")}</textarea></div>
        <label class="inline-check field full"><input name="isAdmin" type="checkbox" ${user.isAdmin ? "checked" : ""} ${currentUser().isAdmin ? "" : "disabled"}><span>Admin</span></label>
      </div>
    `, async root => {
      const avatarFile = root.querySelector("[name='avatarFile']").files[0];
      let avatarUrl = value(root, "avatarUrl");
      if (avatarFile) avatarUrl = (await uploadFile("avatars", avatarFile)).url;

      await saveJson(user.id ? `/api/users/${user.id}` : "/api/users", user.id ? "PUT" : "POST", {
        id: user.id || 0,
        firstName: value(root, "firstName"),
        lastName: value(root, "lastName"),
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
    });
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
