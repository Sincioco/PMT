import {
  buttonContent,
  iconButton
} from "../../components/buttons.js?v=20260715-admin-impersonation";
import { sectionHead } from "../../components/sections.js?v=20260725-suggestions-v1";
import { currentUser } from "../../core/authentication.js?v=20260715-admin-impersonation";
import { formatDateTime } from "../../shared/dates.js";
import { userById } from "../../shared/selectors.js";
import {
  escapeAttr,
  escapeHtml
} from "../../shared/text-and-links.js";

export function createSuggestionsFeature({
  app,
  loadState,
  loadSuggestions,
  openSuggestion,
  render,
  saveJson,
  showReadOnlyDialog,
  showToast
}) {
  let suggestions = [];
  let loadRequestId = 0;

  function renderSuggestions() {
    app.innerHTML = `
      <section class="suggestions-screen work-item-screen">
        ${sectionHead("Suggestions", `
          <button class="primary text-icon-button" type="button" data-action="new-suggestion" title="New Suggestion" aria-label="New Suggestion">${buttonContent("&#10010;", "New Suggestion")}</button>
        `)}
        <div class="panel work-item-table-panel log-table-panel">
          <div class="log-table-wrap">
            <table class="table work-item-table log-table suggestions-table">
              <colgroup>
                <col class="log-person-column">
                <col class="log-date-time-column">
                <col class="log-category-column">
                <col class="log-body-column">
                <col class="log-action-column">
              </colgroup>
              <thead>
                <tr>
                  <th>Suggested By</th>
                  <th>Date/Time</th>
                  <th>Status</th>
                  <th>Suggestion</th>
                  <th class="action-cell" aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                <tr><td colspan="5"><div class="empty">Loading suggestions...</div></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    `;
    refreshSuggestions();
  }

  async function refreshSuggestions() {
    const requestId = ++loadRequestId;
    try {
      suggestions = sortedSuggestions(await loadSuggestions());
      if (requestId !== loadRequestId) return;
      renderSuggestionRows();
    } catch (error) {
      if (requestId !== loadRequestId) return;
      app.querySelector(".suggestions-table tbody").innerHTML = `<tr><td colspan="5"><div class="empty">${escapeHtml(error.message || "Suggestions could not be loaded.")}</div></td></tr>`;
    }
  }

  function renderSuggestionRows() {
    const body = app.querySelector(".suggestions-table tbody");
    if (!body) return;
    body.innerHTML = suggestions.map(suggestionRowHtml).join("")
      || `<tr><td colspan="5"><div class="empty">No suggestions have been submitted yet.</div></td></tr>`;
  }

  function suggestionRowHtml(suggestion) {
    const editable = canModifySuggestion(suggestion);

    return `
      <tr class="log-row clickable-row" data-action="view-suggestion" data-id="${suggestion.id}">
        <td class="log-person-cell" data-label="Suggested By">${suggestionPersonHtml(suggestion.createdByUserId)}</td>
        <td class="log-date" data-label="Date/Time">${escapeHtml(formatDateTime(suggestion.createdAt))}</td>
        <td class="log-category" data-label="Status"><span class="pill log-category-pill">${escapeHtml(suggestion.status || "New")}</span></td>
        <td class="log-body" data-label="Suggestion">${suggestionSummaryHtml(suggestion)}</td>
        <td class="reveal-actions action-cell log-actions" data-label="Actions">
          <div class="log-row-actions">
            ${iconButton("duplicate-suggestion", suggestion.id, "Duplicate", "duplicate")}
            ${editable ? iconButton("edit-suggestion", suggestion.id, "Edit", "edit") : iconButton("view-suggestion", suggestion.id, "View", "view")}
          </div>
        </td>
      </tr>
    `;
  }

  function suggestionPersonHtml(userId) {
    const user = userById(Number(userId || 0));
    return `
      <div class="row log-person">
        <img class="avatar" src="${escapeAttr(user?.avatarUrl || "/assets/avatar-default.svg")}" alt="">
        <strong>${escapeHtml(user?.nickname || "User")}</strong>
      </div>
    `;
  }

  function suggestionSummaryHtml(suggestion) {
    return `
      <div class="log-content suggestion-content">${suggestion.bodyHtml || ""}</div>
      <div class="log-entry-meta">${escapeHtml(suggestionAuditSummary(suggestion))}</div>
    `;
  }

  function suggestionAuditSummary(suggestion) {
    const created = formatDateTime(suggestion.createdAt);
    const updated = formatDateTime(suggestion.updatedAt);
    if (updated && suggestionWasEdited(suggestion)) {
      return `Created ${created} | Last edited ${updated}`;
    }
    return `Created ${created}`;
  }

  function suggestionWasEdited(suggestion) {
    const created = new Date(suggestion.createdAt || 0).getTime();
    const updated = new Date(suggestion.updatedAt || 0).getTime();
    return Boolean(created && updated && Math.abs(updated - created) > 1000);
  }

  async function handleAction(action, id) {
    const suggestion = id ? suggestions.find(item => item.id === id) : null;

    if (action === "new-suggestion") {
      openSuggestion?.();
      return true;
    }
    if (action === "view-suggestion") {
      if (suggestion && canModifySuggestion(suggestion)) openSuggestion?.(suggestion);
      else viewSuggestion(suggestion);
      return true;
    }
    if (action === "edit-suggestion") {
      if (suggestion && canModifySuggestion(suggestion)) openSuggestion?.(suggestion);
      else viewSuggestion(suggestion);
      return true;
    }
    if (action === "duplicate-suggestion") {
      await duplicateSuggestion(suggestion);
      return true;
    }

    return false;
  }

  function viewSuggestion(suggestion) {
    if (!suggestion) return;

    showReadOnlyDialog(suggestionDialogTitle(suggestion), `
      <div class="detail-grid log-detail-grid">
        <div class="detail-field">
          <span>Suggested By</span>
          <div>${escapeHtml(suggestionUserName(suggestion.createdByUserId))}</div>
        </div>
        <div class="detail-field">
          <span>Status</span>
          <div><span class="pill log-category-pill">${escapeHtml(suggestion.status || "New")}</span></div>
        </div>
        <div class="detail-field">
          <span>Created</span>
          <div>${escapeHtml(formatDateTime(suggestion.createdAt))}</div>
        </div>
        <div class="detail-field">
          <span>Last Edited</span>
          <div>${escapeHtml(suggestionWasEdited(suggestion) ? formatDateTime(suggestion.updatedAt) : "Not edited")}</div>
        </div>
        <div class="detail-field full">
          <span>Suggestion</span>
          <div class="log-content suggestion-content">${suggestion.bodyHtml || ""}</div>
        </div>
      </div>
    `);
  }

  async function duplicateSuggestion(suggestion) {
    if (!suggestion) return;

    try {
      await saveJson("/api/suggestions", "POST", { bodyHtml: suggestion.bodyHtml || "" });
      await loadState();
      render();
      showToast("Suggestion duplicated.");
    } catch (error) {
      showToast(error.message);
    }
  }

  function sortedSuggestions(items = []) {
    return [...(items || [])]
      .sort((a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        || Number(b.id || 0) - Number(a.id || 0));
  }

  function canModifySuggestion(suggestion) {
    if (!suggestion) return false;
    const user = currentUser();
    return Boolean(user?.isAdmin) || Number(suggestion.createdByUserId || 0) === Number(user?.id || 0);
  }

  function suggestionDialogTitle(suggestion) {
    if (!suggestion?.id) return "Suggestion";
    return `Suggestion #${suggestion.id} - ${suggestionUserName(suggestion.createdByUserId)}`;
  }

  function suggestionUserName(userId) {
    const user = userById(Number(userId || 0));
    return user?.nickname || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User";
  }

  return {
    handleAction,
    render: renderSuggestions
  };
}
