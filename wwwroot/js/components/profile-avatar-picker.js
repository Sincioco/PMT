import { escapeAttr } from "../shared/text-and-links.js";

export const genericAvatarOptions = Object.freeze([
  "/assets/avatar-generic-1.jpg",
  "/assets/avatar-generic-2.jpg",
  "/assets/avatar-generic-3.jpg",
  "/assets/avatar-generic-4.jpg",
  "/assets/avatar-generic-5.jpg",
  "/assets/avatar-generic-6.jpg"
]);

export function profileAvatarPickerHtml(currentAvatarUrl = "", resolveAvatarUrl = avatarUrl => avatarUrl) {
  const currentAvatarPath = avatarPathOnly(currentAvatarUrl);

  return `
    <div class="field full is-required profile-avatar-picker-field">
      <label>Avatar</label>
      <div class="profile-avatar-picker-list" role="radiogroup" aria-label="Generic avatars">
        ${genericAvatarOptions.map((avatarUrl, index) => {
          const selected = currentAvatarPath === avatarUrl;
          const imageUrl = resolvedAvatarUrl(avatarUrl, resolveAvatarUrl);
          return `
            <button class="profile-avatar-picker-option ${selected ? "is-selected" : ""}" type="button" data-profile-avatar-option="${escapeAttr(avatarUrl)}" role="radio" aria-checked="${selected}" tabindex="${selected || (!currentAvatarPath && index === 0) ? "0" : "-1"}" title="Use generic avatar ${index + 1}">
              <img src="${escapeAttr(imageUrl)}" alt="Generic avatar ${index + 1}">
            </button>
          `;
        }).join("")}
      </div>
      <div class="profile-avatar-file-preview" data-profile-avatar-file-preview hidden>
        <img src="" alt="Selected avatar preview">
        <span data-profile-avatar-file-name></span>
      </div>
    </div>
  `;
}

export function bindProfileAvatarPicker(root) {
  const avatarUrlInput = root?.querySelector?.("[name='avatarUrl']");
  const avatarFileInput = root?.querySelector?.("[name='avatarFile']");
  const avatarFilePreview = root?.querySelector?.("[data-profile-avatar-file-preview]");
  const avatarFilePreviewImage = avatarFilePreview?.querySelector("img");
  const avatarFilePreviewName = avatarFilePreview?.querySelector("[data-profile-avatar-file-name]");
  const options = [...(root?.querySelectorAll?.("[data-profile-avatar-option]") || [])];
  if (!avatarUrlInput || !options.length) return () => {};

  let previewObjectUrl = "";

  const clearFilePreview = () => {
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = "";
    if (avatarFilePreviewImage) avatarFilePreviewImage.src = "";
    if (avatarFilePreviewName) avatarFilePreviewName.textContent = "";
    if (avatarFilePreview) avatarFilePreview.hidden = true;
  };

  const showFilePreview = file => {
    clearFilePreview();
    if (!file || !file.type.startsWith("image/") || !avatarFilePreview || !avatarFilePreviewImage) return;

    previewObjectUrl = URL.createObjectURL(file);
    avatarFilePreviewImage.src = previewObjectUrl;
    if (avatarFilePreviewName) avatarFilePreviewName.textContent = file.name;
    avatarFilePreview.hidden = false;
  };

  const syncSelectedOption = () => {
    const selectedPath = avatarPathOnly(avatarUrlInput.value);
    const hasSelectedOption = options.some(option => option.dataset.profileAvatarOption === selectedPath);
    options.forEach(option => {
      const selected = option.dataset.profileAvatarOption === selectedPath;
      option.classList.toggle("is-selected", selected);
      option.setAttribute("aria-checked", String(selected));
      option.tabIndex = selected || (!hasSelectedOption && option === options[0]) ? 0 : -1;
    });
  };

  options.forEach(option => {
    option.addEventListener("click", () => {
      avatarUrlInput.value = option.dataset.profileAvatarOption || "";
      if (avatarFileInput) avatarFileInput.value = "";
      clearFilePreview();
      syncSelectedOption();
    });
    option.addEventListener("keydown", event => {
      const currentIndex = options.indexOf(option);
      let nextIndex = currentIndex;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (currentIndex + 1) % options.length;
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (currentIndex - 1 + options.length) % options.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = options.length - 1;
      if (nextIndex === currentIndex) return;

      event.preventDefault();
      options[nextIndex].click();
      options[nextIndex].focus();
    });
  });
  avatarUrlInput.addEventListener("input", syncSelectedOption);
  avatarFileInput?.addEventListener("change", () => {
    const file = avatarFileInput.files?.[0] || null;
    if (file) avatarUrlInput.value = "";
    showFilePreview(file);
    syncSelectedOption();
  });
  root.closest?.("dialog")?.addEventListener("close", clearFilePreview, { once: true });
  syncSelectedOption();

  return clearFilePreview;
}

export function focusProfileAvatarPicker(root) {
  const field = root?.querySelector?.(".profile-avatar-picker-field")
    || root?.querySelector?.("[name='avatarUrl']")?.closest(".field");
  field?.scrollIntoView({ behavior: "smooth", block: "center" });
  field?.querySelector("button, input")?.focus({ preventScroll: true });
}

export function avatarPathOnly(avatarUrl) {
  return String(avatarUrl || "").trim().split("?", 1)[0];
}

function resolvedAvatarUrl(avatarUrl, resolveAvatarUrl) {
  if (typeof resolveAvatarUrl !== "function") return avatarUrl;
  return resolveAvatarUrl(avatarUrl) || avatarUrl;
}
