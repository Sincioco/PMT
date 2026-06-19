const root = document.documentElement;
const themeSwitch = document.querySelector("[data-theme-switch]");
const themeLabel = document.querySelector("[data-theme-label]");
const themeIcon = document.querySelector("[data-theme-icon]");
const showcaseDialog = document.querySelector("[data-showcase-dialog]");

function syncThemeControl() {
  const isLight = root.dataset.theme === "light";
  themeSwitch?.setAttribute("aria-pressed", String(isLight));
  if (themeLabel) themeLabel.textContent = isLight ? "Use dark theme" : "Use light theme";
  if (themeIcon) themeIcon.textContent = isLight ? "☾" : "☀";
}

themeSwitch?.addEventListener("click", () => {
  root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
  syncThemeControl();
});

document.querySelector("[data-open-dialog]")?.addEventListener("click", () => {
  showcaseDialog?.showModal();
});

document.querySelectorAll("[data-close-dialog]").forEach(button => {
  button.addEventListener("click", () => showcaseDialog?.close());
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && showcaseDialog?.open) {
    event.preventDefault();
    showcaseDialog.close();
  }
});

document.querySelector("[data-demo-form]")?.addEventListener("submit", event => {
  event.preventDefault();
});

syncThemeControl();
