import { api } from "../../core/api.js";
import {
  currentUser,
  currentUserId,
  setCurrentUserId
} from "../../core/authentication.js";
import { state } from "../../core/store.js";
import { buttonContent } from "../../components/buttons.js";
import { copyTextToClipboard } from "../../components/clipboard.js?v=20260713-invite-users";
import { initializeWindowedDialog } from "../../components/dialogs.js?v=20260713-invite-users";
import {
  checkList,
  checkedNumbers
} from "../../components/forms.js?v=20260713-invite-users";
import {
  bindProfileAvatarPicker,
  focusProfileAvatarPicker,
  profileAvatarPickerHtml
} from "../../components/profile-avatar-picker.js?v=20260713-invite-users";
import {
  appAbsoluteUrl,
  appUrl
} from "../../shared/app-urls.js";
import { projectsAvailableForInvitation } from "../../shared/invitation-rules.js?v=20260713-invite-users";
import { projectIconUrl } from "../../shared/project-assets.js?v=20260713-invite-users";
import {
  escapeAttr,
  escapeHtml
} from "../../shared/text-and-links.js";

const invitationQueryParameter = "invite";
const genericAvatarCacheVersion = "20260629-avatar-jpg-assets";

export function createInvitationsFeature({
  app,
  onAccepted,
  resumeApplication,
  showToast,
  uploadFile
}) {
  function hasPendingInvitation() {
    return Boolean(invitationToken());
  }

  function openInviteDialog() {
    const user = currentUser();
    const projects = projectsAvailableForInvitation(state.projects, currentUserId, Boolean(user.isAdmin));
    const modal = document.createElement("dialog");
    modal.className = "dialog invite-users-dialog";
    modal.setAttribute("aria-labelledby", "inviteUsersTitle");
    modal.innerHTML = `
      <form class="invite-users-form">
        <div class="dialog-head">
          <div>
            <h2 id="inviteUsersTitle">Invite Users</h2>
            <p class="muted">Select the projects new users will be added to, then share the generated URL inside BDO.</p>
          </div>
          <div class="dialog-head-actions">
            <button type="button" class="icon-btn" data-close-invite-dialog title="Close" aria-label="Close">x</button>
          </div>
        </div>
        <div class="dialog-body invite-users-body">
          ${projects.length
            ? checkList("Projects", "projectIds", projects, [], project => project.title, {
              className: "scroll-check-list user-card-check-list invite-project-list",
              renderItem: inviteProjectLabelHtml
            })
            : `<div class="empty">You are not a member of any projects that can be included in an invitation.</div>`}
          <div class="invite-generate-row">
            <button class="primary text-icon-button" type="button" data-generate-invite ${projects.length ? "" : "disabled"}>
              ${buttonContent("&#128279;", "Generate Invite URL")}
            </button>
            <span class="muted">The reusable internal invite URL will remain valid for 30 days.</span>
          </div>
          <div class="invite-url-result" data-invite-url-result hidden>
            <label for="generatedInviteUrl">Invite URL</label>
            <div class="invite-url-actions">
              <input id="generatedInviteUrl" type="url" readonly data-invite-url>
              <button class="secondary text-icon-button" type="button" data-copy-invite-url disabled>
                ${buttonContent("&#128203;", "Copy URL")}
              </button>
            </div>
            <span class="muted" data-invite-expiration></span>
          </div>
        </div>
        <div class="dialog-actions">
          <button class="secondary text-icon-button" type="button" data-close-invite-dialog>${buttonContent("&#10005;", "Close")}</button>
        </div>
      </form>
    `;

    document.body.appendChild(modal);
    initializeWindowedDialog(modal, { showResetButton: false });
    let isGenerating = false;

    const setGenerating = busy => {
      isGenerating = busy;
      modal.querySelectorAll("[name='projectIds'], [data-close-invite-dialog]").forEach(control => {
        control.disabled = busy;
      });
      const generateButton = modal.querySelector("[data-generate-invite]");
      if (generateButton) generateButton.disabled = busy || !projects.length;
    };

    const clearGeneratedUrl = () => {
      const result = modal.querySelector("[data-invite-url-result]");
      const urlInput = modal.querySelector("[data-invite-url]");
      const copyButton = modal.querySelector("[data-copy-invite-url]");
      if (urlInput) urlInput.value = "";
      if (copyButton) copyButton.disabled = true;
      if (result) result.hidden = true;
    };

    modal.querySelectorAll("[name='projectIds']").forEach(input => {
      input.addEventListener("change", clearGeneratedUrl);
    });
    modal.querySelector("[data-generate-invite]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      try {
        const projectIds = checkedNumbers(modal, "projectIds");
        if (!projectIds.length) {
          modal.querySelector(".invite-project-list")?.scrollIntoView({ behavior: "smooth", block: "center" });
          modal.querySelector("[name='projectIds']")?.focus({ preventScroll: true });
          throw new Error("Select at least one project.");
        }

        setGenerating(true);
        const result = await api("/api/invitations", {
          method: "POST",
          body: JSON.stringify({ projectIds })
        });
        const url = appAbsoluteUrl(`/?${invitationQueryParameter}=${encodeURIComponent(result.token || "")}`);
        const urlInput = modal.querySelector("[data-invite-url]");
        const copyButton = modal.querySelector("[data-copy-invite-url]");
        const resultPanel = modal.querySelector("[data-invite-url-result]");
        const expiration = modal.querySelector("[data-invite-expiration]");
        if (urlInput) urlInput.value = url;
        if (copyButton) copyButton.disabled = !url;
        if (resultPanel) resultPanel.hidden = !url;
        if (expiration) expiration.textContent = result.expiresAt
          ? `Valid until ${new Date(result.expiresAt).toLocaleString()}.`
          : "";
        showToast("Invite URL generated.");
      } catch (error) {
        showToast(error.message);
      } finally {
        setGenerating(false);
      }
    });
    modal.querySelector("[data-copy-invite-url]")?.addEventListener("click", async () => {
      const urlInput = modal.querySelector("[data-invite-url]");
      const copied = await copyTextToClipboard(urlInput?.value || "", urlInput);
      showToast(copied ? "Invite URL copied." : "Unable to copy the invite URL.");
    });
    modal.querySelectorAll("[data-close-invite-dialog]").forEach(button => {
      button.addEventListener("click", () => {
        if (!isGenerating) modal.close();
      });
    });
    modal.addEventListener("cancel", event => {
      event.preventDefault();
      if (!isGenerating) modal.close();
    });
    modal.addEventListener("close", () => modal.remove(), { once: true });
    modal.showModal();
  }

  async function renderInvitationProfile() {
    const token = invitationToken();
    app.innerHTML = `
      <section class="login-screen invite-profile-screen">
        <div class="panel invite-profile-card invite-profile-message">
          <h1>Preparing your PMT profile</h1>
          <p class="muted">Validating the invitation...</p>
        </div>
      </section>
    `;

    try {
      const invitation = await api(`/api/invitations/${encodeURIComponent(token)}`);
      renderProfileForm(token, invitation);
    } catch (error) {
      renderInvitationError(error.message || "This invitation is no longer available.");
    }
  }

  function renderProfileForm(token, invitation) {
    const projects = invitation.projects || [];
    app.innerHTML = `
      <section class="login-screen invite-profile-screen">
        <form class="panel invite-profile-card invite-profile-form" data-invite-profile-form>
          <div class="login-brand invite-profile-brand">
            <img src="${appUrl("/assets/project-pmt.svg?v=20260621-transparent")}" alt="">
            <div>
              <h1>Welcome to PMT! You've been invited!</h1>
              <p class="muted">Choose a username, password, and avatar to get started.</p>
            </div>
          </div>
          <div class="form-grid">
            <div class="field full">
              <label for="inviteProfileNickname">Username</label>
              <input id="inviteProfileNickname" name="nickname" type="text" maxlength="80" autocomplete="username" required>
              <span class="muted" data-username-help>You will use this username to log in.</span>
            </div>
            <div class="field">
              <label for="inviteProfilePassword">Password</label>
              <input id="inviteProfilePassword" name="password" type="password" minlength="8" autocomplete="new-password" required>
            </div>
            <div class="field">
              <label for="inviteProfileConfirmPassword">Confirm Password</label>
              <input id="inviteProfileConfirmPassword" name="confirmPassword" type="password" minlength="8" autocomplete="new-password" required>
            </div>
            ${profileAvatarPickerHtml("", genericAvatarPreviewUrl)}
            <div class="field full">
              <label for="inviteProfileAvatarFile">Upload Avatar</label>
              <input id="inviteProfileAvatarFile" name="avatarFile" type="file" accept=".jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/png,image/gif,image/webp">
            </div>
            <input name="avatarUrl" type="hidden" value="">
          </div>
          <div class="invite-profile-project-section">
            <div class="invite-profile-projects-title">Projects included with this invitation</div>
            <div class="invite-profile-projects">
              ${projects.map(invitationProjectHtml).join("")}
            </div>
          </div>
          <div class="dialog-actions invite-profile-actions">
            <button class="primary text-icon-button" type="submit">${buttonContent("&#10003;", "Create Profile")}</button>
          </div>
        </form>
      </section>
    `;

    const form = app.querySelector("[data-invite-profile-form]");
    const usernameInput = form.querySelector("[name='nickname']");
    const usernameHelp = form.querySelector("[data-username-help]");
    const clearAvatarPreview = bindProfileAvatarPicker(form);
    bindUsernameSuggestion(usernameInput, usernameHelp);
    usernameInput?.focus();
    const setProfileBusy = busy => {
      form.querySelectorAll("input, button").forEach(control => {
        control.disabled = busy;
      });
      form.setAttribute("aria-busy", String(busy));
    };
    form.addEventListener("submit", async event => {
      event.preventDefault();
      try {
        const nicknameInput = form.querySelector("[name='nickname']");
        const passwordInput = form.querySelector("[name='password']");
        const confirmPasswordInput = form.querySelector("[name='confirmPassword']");
        const avatarFile = form.querySelector("[name='avatarFile']")?.files?.[0] || null;
        const avatarUrlInput = form.querySelector("[name='avatarUrl']");
        const nickname = nicknameInput?.value.trim() || "";
        const password = passwordInput?.value || "";
        let avatarUrl = avatarUrlInput?.value.trim() || "";

        if (!nickname) {
          nicknameInput?.focus();
          throw new Error("Username is required.");
        }
        const usernameSuggestion = await getUsernameSuggestion(nickname);
        if (!usernameSuggestion.isAvailable) {
          suggestUsername(nicknameInput, usernameHelp, usernameSuggestion.username);
          showToast(`That username is already in use. Try ${usernameSuggestion.username}.`);
          return;
        }
        if (password.length < 8) {
          passwordInput?.focus();
          throw new Error("Password must be at least 8 characters.");
        }
        if (password !== (confirmPasswordInput?.value || "")) {
          confirmPasswordInput?.focus();
          throw new Error("Passwords do not match.");
        }
        if (avatarFile && !avatarFile.type.startsWith("image/")) {
          form.querySelector("[name='avatarFile']")?.focus();
          throw new Error("Upload an image file for the avatar.");
        }
        if (!avatarFile && !avatarUrl) {
          focusProfileAvatarPicker(form);
          throw new Error("Select or upload an avatar before creating your profile.");
        }

        setProfileBusy(true);
        if (avatarFile) avatarUrl = (await uploadFile("avatars", avatarFile)).url;
        const result = await api(`/api/invitations/${encodeURIComponent(token)}/accept`, {
          method: "POST",
          body: JSON.stringify({ nickname, password, avatarUrl })
        });
        clearAvatarPreview();
        clearInvitationQuery();
        setCurrentUserId(result.userId, true);
        await onAccepted(result);
        showToast(`Welcome to PMT, ${result.nickname || nickname}.`);
      } catch (error) {
        if (/username.*already in use/i.test(error.message || "")) {
          try {
            const nicknameInput = form.querySelector("[name='nickname']");
            const suggestion = await getUsernameSuggestion(nicknameInput?.value || "");
            suggestUsername(nicknameInput, usernameHelp, suggestion.username);
          } catch {
            // Keep the original save error when a follow-up suggestion cannot be loaded.
          }
        }
        showToast(error.message);
      } finally {
        setProfileBusy(false);
      }
    });
  }

  function bindUsernameSuggestion(input, help) {
    input?.addEventListener("blur", async () => {
      const username = input.value.trim();
      if (!username) {
        help.textContent = "You will use this username to log in.";
        return;
      }

      try {
        const suggestion = await getUsernameSuggestion(username);
        help.textContent = suggestion.isAvailable
          ? "This username is available."
          : `That username is already in use. Try ${suggestion.username}.`;
      } catch {
        help.textContent = "You will use this username to log in.";
      }
    });
  }

  async function getUsernameSuggestion(username) {
    return api(`/api/usernames/suggestion?username=${encodeURIComponent(username.trim())}`);
  }

  function suggestUsername(input, help, username) {
    if (!input || !username) return;
    input.value = username;
    help.textContent = `Suggested available username: ${username}`;
    input.focus();
    input.select();
  }

  function renderInvitationError(message) {
    app.innerHTML = `
      <section class="login-screen invite-profile-screen">
        <div class="panel invite-profile-card invite-profile-message">
          <h1>Invitation unavailable</h1>
          <p>${escapeHtml(message)}</p>
          <button class="secondary text-icon-button" type="button" data-leave-invitation>${buttonContent("&#8592;", "Back to PMT")}</button>
        </div>
      </section>
    `;
    app.querySelector("[data-leave-invitation]")?.addEventListener("click", leaveInvitation);
  }

  async function leaveInvitation() {
    clearInvitationQuery();
    await resumeApplication();
  }

  return {
    hasPendingInvitation,
    openInviteDialog,
    renderInvitationProfile
  };
}

function invitationToken() {
  return new URLSearchParams(window.location.search).get(invitationQueryParameter)?.trim() || "";
}

function clearInvitationQuery() {
  const url = new URL(window.location.href);
  url.searchParams.delete(invitationQueryParameter);
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function inviteProjectLabelHtml(project) {
  return `
    <span class="invite-project-option">
      <img class="invite-project-icon" src="${escapeAttr(appUrl(projectIconUrl(project)))}" alt="${escapeAttr(project.title || project.code || "Project")} picture">
      <span class="invite-project-summary">
        <span class="invite-project-name">${escapeHtml(project.title || project.code || "Project")}</span>
        <span class="muted">${escapeHtml(project.code || "")}</span>
      </span>
    </span>
  `;
}

function invitationProjectHtml(project) {
  return `
    <div class="invite-profile-project">
      <img src="${escapeAttr(appUrl(projectIconUrl(project)))}" alt="">
      <span><strong>${escapeHtml(project.title || project.code || "Project")}</strong>${project.code ? `<br><span class="muted">${escapeHtml(project.code)}</span>` : ""}</span>
    </div>
  `;
}

function genericAvatarPreviewUrl(avatarUrl) {
  const separator = avatarUrl.includes("?") ? "&" : "?";
  return appUrl(`${avatarUrl}${separator}v=${genericAvatarCacheVersion}`);
}
