import { api } from "../../core/api.js";
import {
  currentUser,
  currentUserId,
  setCurrentUserId
} from "../../core/authentication.js";
import { state } from "../../core/store.js";
import { buttonContent } from "../../components/buttons.js";
import {
  copyHtmlToClipboard,
  copyTextToClipboard
} from "../../components/clipboard.js?v=20260714-invite-email-body";
import { initializeWindowedDialog } from "../../components/dialogs.js?v=20260713-invite-users";
import {
  checkList,
  checkedNumbers
} from "../../components/forms.js?v=20260715-day28-v118";
import {
  bindProfileAvatarPicker,
  focusProfileAvatarPicker,
  profileAvatarPickerHtml
} from "../../components/profile-avatar-picker.js?v=20260715-day28-v118";
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
const invitationEmailLogoVersion = "20260714-invite-email-body";

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
              renderItem: inviteProjectLabelHtml,
              required: true
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
              <button class="secondary text-icon-button" type="button" data-generate-invite-email disabled>
                ${buttonContent("&#9993;", "Generate Email/HTML Body")}
              </button>
            </div>
            <span class="muted" data-invite-expiration></span>
          </div>
          <div class="invite-email-result" data-invite-email-result hidden>
            <div class="invite-email-title">Email / HTML body preview</div>
            <div class="invite-email-preview" data-invite-email-preview></div>
            <div class="invite-email-actions">
              <button class="secondary text-icon-button" type="button" data-copy-invite-email disabled>
                ${buttonContent("&#128203;", "Copy Email/HTML Body")}
              </button>
              <span class="muted">Copies rich HTML and a plain-text fallback for Outlook.</span>
            </div>
          </div>
        </div>
        <div class="dialog-actions">
          <button class="secondary text-icon-button" type="button" data-close-invite-dialog>${buttonContent("&#10003;", "Done")}</button>
        </div>
      </form>
    `;

    document.body.appendChild(modal);
    initializeWindowedDialog(modal, { showResetButton: false });
    let isGenerating = false;
    let generatedEmailHtml = "";

    const setGenerating = busy => {
      isGenerating = busy;
      modal.querySelectorAll("[name='projectIds'], [data-close-invite-dialog]").forEach(control => {
        control.disabled = busy;
      });
      const generateButton = modal.querySelector("[data-generate-invite]");
      if (generateButton) generateButton.disabled = busy || !projects.length;
      const emailButton = modal.querySelector("[data-generate-invite-email]");
      if (emailButton) emailButton.disabled = busy || !modal.querySelector("[data-invite-url]")?.value;
    };

    const clearGeneratedUrl = () => {
      const result = modal.querySelector("[data-invite-url-result]");
      const urlInput = modal.querySelector("[data-invite-url]");
      const copyButton = modal.querySelector("[data-copy-invite-url]");
      const generateEmailButton = modal.querySelector("[data-generate-invite-email]");
      const emailResult = modal.querySelector("[data-invite-email-result]");
      const emailPreview = modal.querySelector("[data-invite-email-preview]");
      const copyEmailButton = modal.querySelector("[data-copy-invite-email]");
      generatedEmailHtml = "";
      if (urlInput) urlInput.value = "";
      if (copyButton) copyButton.disabled = true;
      if (generateEmailButton) generateEmailButton.disabled = true;
      if (emailPreview) emailPreview.innerHTML = "";
      if (copyEmailButton) copyEmailButton.disabled = true;
      if (emailResult) emailResult.hidden = true;
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
        const generateEmailButton = modal.querySelector("[data-generate-invite-email]");
        const resultPanel = modal.querySelector("[data-invite-url-result]");
        const expiration = modal.querySelector("[data-invite-expiration]");
        if (urlInput) urlInput.value = url;
        if (copyButton) copyButton.disabled = !url;
        if (generateEmailButton) generateEmailButton.disabled = !url;
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
    modal.querySelector("[data-generate-invite-email]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const url = modal.querySelector("[data-invite-url]")?.value.trim() || "";
      if (!url) {
        showToast("Generate an invite URL first.");
        return;
      }

      button.disabled = true;
      try {
        const logoPath = `/assets/pmt-logo-full.png?v=${invitationEmailLogoVersion}`;
        const absoluteLogoUrl = appAbsoluteUrl(logoPath);
        const embeddedLogo = await imageDataUrl(appUrl(logoPath)).catch(() => absoluteLogoUrl);
        if (modal.querySelector("[data-invite-url]")?.value.trim() !== url) return;
        generatedEmailHtml = invitationEmailHtml(url, embeddedLogo, absoluteLogoUrl);
        const preview = modal.querySelector("[data-invite-email-preview]");
        const result = modal.querySelector("[data-invite-email-result]");
        const copyButton = modal.querySelector("[data-copy-invite-email]");
        if (preview) preview.innerHTML = generatedEmailHtml;
        if (copyButton) copyButton.disabled = false;
        if (result) {
          result.hidden = false;
          result.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
        showToast("Email / HTML body generated.");
      } catch (error) {
        showToast(error.message || "Unable to generate the email body.");
      } finally {
        button.disabled = !modal.querySelector("[data-invite-url]")?.value.trim();
      }
    });
    modal.querySelector("[data-copy-invite-email]")?.addEventListener("click", async event => {
      const url = modal.querySelector("[data-invite-url]")?.value.trim() || "";
      const copied = generatedEmailHtml
        ? await copyHtmlToClipboard(generatedEmailHtml, invitationEmailPlainText(url), event.currentTarget)
        : false;
      showToast(copied
        ? "Email / HTML body copied. Paste it into Outlook."
        : "Unable to copy the email / HTML body.");
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

function invitationEmailHtml(inviteUrl, embeddedLogo, absoluteLogoUrl) {
  const safeUrl = escapeAttr(inviteUrl);
  const safeEmbeddedLogo = escapeAttr(embeddedLogo);
  const safeAbsoluteLogoUrl = escapeAttr(absoluteLogoUrl);
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0;background:#f3f6fb;border-collapse:collapse;font-family:Arial,'Segoe UI',sans-serif;color:#243142;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:100%;background:#ffffff;border:1px solid #d9e2ec;border-collapse:collapse;">
            <tr>
              <td style="padding:24px 28px;border-bottom:1px solid #d9e2ec;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td width="190" valign="middle" style="width:190px;padding:0 24px 0 0;">
                      <!--[if mso]><img src="${safeAbsoluteLogoUrl}" width="180" alt="PMT - Project Management Tool" style="display:block;width:180px;height:auto;border:0;outline:none;text-decoration:none;"><![endif]-->
                      <!--[if !mso]><!--><img src="${safeEmbeddedLogo}" width="180" alt="PMT - Project Management Tool" style="display:block;width:180px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;"><!--<![endif]-->
                    </td>
                    <td valign="middle" style="padding:0;">
                      <div style="margin:0;color:#172b4d;font-size:24px;line-height:30px;font-weight:700;">Welcome to PMT! You&rsquo;ve been invited!</div>
                      <div style="margin:7px 0 0;color:#5d6b7a;font-size:14px;line-height:21px;">Create your profile and join your BDO project team.</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;color:#243142;font-size:16px;line-height:25px;">
                <p style="margin:0 0 22px;">You've been chosen as one of the few to try this new and exciting Project Management Tool (PMT) in BDO! Participate so your ideas can help shape the tool and the future of BDO in the process!</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td bgcolor="#1473e6" style="background:#1473e6;border:1px solid #0b57b7;">
                      <a href="${safeUrl}" style="display:inline-block;padding:12px 22px;color:#ffffff;text-decoration:none;font-size:16px;line-height:20px;font-weight:700;">Create Your PMT Profile</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:22px 0 6px;color:#5d6b7a;font-size:13px;line-height:20px;">This reusable internal invitation is valid for 30 days.</p>
                <p style="margin:0;color:#5d6b7a;font-size:13px;line-height:20px;">If the button does not open, copy and paste this address into your browser:</p>
                <p style="margin:4px 0 0;font-size:13px;line-height:20px;word-break:break-all;"><a href="${safeUrl}" style="color:#0b57b7;text-decoration:underline;">${escapeHtml(inviteUrl)}</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `.trim();
}

function invitationEmailPlainText(inviteUrl) {
  return [
    "Welcome to PMT! You've been invited!",
    "",
    "You've been chosen as one of the few to try this new and exciting Project Management Tool (PMT) in BDO! Participate so your ideas can help shape the tool and the future of BDO in the process!",
    "",
    "Create your PMT profile:",
    inviteUrl,
    "",
    "This reusable internal invitation is valid for 30 days."
  ].join("\n");
}

async function imageDataUrl(source) {
  const response = await fetch(source);
  if (!response.ok) throw new Error("Unable to load the PMT logo.");
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")), { once: true });
    reader.addEventListener("error", () => reject(new Error("Unable to prepare the PMT logo.")), { once: true });
    reader.readAsDataURL(blob);
  });
}

function genericAvatarPreviewUrl(avatarUrl) {
  const separator = avatarUrl.includes("?") ? "&" : "?";
  return appUrl(`${avatarUrl}${separator}v=${genericAvatarCacheVersion}`);
}
