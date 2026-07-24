import { buttonContent } from "./buttons.js?v=20260717-multi-screen-header";
import { copyTextToClipboard } from "./clipboard.js?v=20260714-invite-email-body";
import {
  escapeAttr,
  escapeHtml
} from "../shared/text-and-links.js";

const publicLinkDurations = Object.freeze([
  { value: "", label: "Forever" },
  { value: "15", label: "15 days" },
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" }
]);

let publicLinkDialogCounter = 0;

export function openPublicLinkDialog(createUrl, options = {}) {
  return new Promise(resolve => {
    let resolved = false;
    let created = false;
    const urlId = `public-link-url-${++publicLinkDialogCounter}`;
    const modal = document.createElement("dialog");
    modal.className = "dialog public-link-duration-dialog";
    modal.innerHTML = `
      <form>
        <div class="dialog-head">
          <h2>Public Link</h2>
          <button type="button" class="icon-btn" data-public-link-cancel title="Close" aria-label="Close">x</button>
        </div>
        <div class="dialog-body">
          <fieldset class="field public-link-options">
            <legend>Valid for</legend>
            ${publicLinkDurations.map((duration, index) => `
              <label class="public-link-option">
                <input type="radio" name="publicLinkDuration" value="${escapeAttr(duration.value)}" ${index === 0 ? "checked" : ""}>
                <span>${escapeHtml(duration.label)}</span>
              </label>
            `).join("")}
          </fieldset>
          <div class="field public-link-url-field">
            <label for="${escapeAttr(urlId)}">Public URL</label>
            <div class="public-link-url-row">
              <input id="${escapeAttr(urlId)}" type="text" readonly data-public-link-url placeholder="Create a link to generate the URL.">
              <button type="button" class="secondary text-icon-button" data-public-link-copy disabled>${buttonContent("&#128203;", "Copy URL")}</button>
            </div>
            <div class="public-link-status" data-public-link-status role="status" aria-live="polite"></div>
          </div>
        </div>
        <div class="dialog-actions">
          <button type="button" class="secondary text-icon-button" data-public-link-cancel>${buttonContent("&#10005;", "Close")}</button>
          <button type="submit" class="primary text-icon-button" data-public-link-create>${buttonContent("&#128279;", "Create Link")}</button>
        </div>
      </form>
    `;

    const form = modal.querySelector("form");
    const createButton = modal.querySelector("[data-public-link-create]");
    const copyButton = modal.querySelector("[data-public-link-copy]");
    const urlInput = modal.querySelector("[data-public-link-url]");
    const status = modal.querySelector("[data-public-link-status]");
    const originalCreateContent = createButton?.innerHTML || "";

    const finish = value => {
      if (resolved) return;
      resolved = true;
      if (modal.open) modal.close();
      modal.remove();
      resolve(value);
    };

    const setStatus = (message, kind = "") => {
      if (!status) return;
      status.textContent = message || "";
      status.className = `public-link-status${kind ? ` is-${kind}` : ""}`;
    };

    const notify = message => {
      if (message) options.notify?.(message);
    };

    const copyCurrentUrl = async () => {
      const url = String(urlInput?.value || "").trim();
      if (!url) {
        setStatus("Create a link first.", "warning");
        return false;
      }

      urlInput?.focus({ preventScroll: true });
      urlInput?.select();
      const copied = await copyTextToClipboard(url, urlInput);
      urlInput?.focus({ preventScroll: true });
      urlInput?.select();

      const message = copied
        ? options.copiedMessage || "Public link copied."
        : options.copyFailedMessage || "Public link created. Copy it from the Public URL box.";
      setStatus(message, copied ? "success" : "warning");
      notify(message);
      return copied;
    };

    modal.addEventListener("click", event => {
      if (event.target.closest("[data-public-link-cancel]")) {
        finish(created);
      } else if (event.target.closest("[data-public-link-copy]")) {
        void copyCurrentUrl();
      }
    });
    form?.addEventListener("submit", async event => {
      event.preventDefault();
      const value = modal.querySelector("[name='publicLinkDuration']:checked")?.value || "";
      const durationDays = Number(value || 0);
      if (!createUrl) {
        finish(durationDays > 0 ? durationDays : null);
        return;
      }

      try {
        createButton.disabled = true;
        createButton.innerHTML = buttonContent("&#8987;", "Creating...");
        setStatus("Creating public link...", "");
        const url = String(await createUrl(durationDays > 0 ? durationDays : null) || "").trim();
        if (!url) throw new Error("The public link could not be created.");

        created = true;
        urlInput.value = url;
        copyButton.disabled = false;
        await copyCurrentUrl();
      } catch (error) {
        const message = error?.message || "The public link could not be created.";
        setStatus(message, "error");
        notify(message);
      } finally {
        createButton.disabled = false;
        createButton.innerHTML = originalCreateContent;
      }
    });
    modal.addEventListener("close", () => {
      finish(created);
    }, { once: true });

    document.body.appendChild(modal);
    modal.showModal();
    modal.querySelector(`[name='publicLinkDuration'][value=""]`)?.focus({ preventScroll: true });
  });
}
