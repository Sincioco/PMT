import {
  currentUserId,
  ensureCurrentUser,
  login as authenticate,
  logout,
  setCurrentUserId
} from "./authentication.js";
import { overflowIconHtml } from "../components/buttons.js?v=20260701-unified-dropdowns";
import { navIconHtml } from "./navigation-preferences.js?v=20260707-log-about-nav";
import {
  preferenceKeys,
  readPreference,
  writePreference
} from "./preferences.js";
import { currentView, getNavigationScreens, navigate } from "./router.js?v=20260707-deep-links";
import { loadState, state } from "./store.js";

const fixedOverflowViews = new Set(["About"]);

export function createApplicationShell({
  bindScreenEvents,
  editPassword,
  prepareRender,
  refreshLookupOptions,
  renderCurrentScreen,
  resolveNavigationView,
  showToast
}) {
  const elements = {
    app: document.getElementById("app"),
    nav: document.getElementById("nav"),
    brandAboutButtons: document.querySelectorAll("[data-brand-about]"),
    userSelect: document.getElementById("currentUser"),
    userAvatar: document.getElementById("currentUserAvatar"),
    userMenuToggle: document.getElementById("userMenuToggle"),
    userMenu: document.getElementById("userMenu"),
    themeToggle: document.getElementById("themeToggle"),
    dialog: document.getElementById("editorDialog"),
    dialogTitle: document.getElementById("dialogTitle"),
    dialogBody: document.getElementById("dialogBody"),
    editorForm: document.getElementById("editorForm"),
    toast: document.getElementById("toast")
  };

  let shellEventsBound = false;

  async function initialize() {
    bindHighLevelEvents();
    bindScreenEvents();
    applySavedTheme();

    if (!currentUserId) {
      renderLogin();
      return;
    }

    await start();
  }

  async function start() {
    document.body.classList.remove("logged-out");
    renderNavigation();
    if (await reloadState()) {
      if (!state.projects.length) navigate("About");
      render();
    }
  }

  async function reloadState() {
    try {
      await loadState();
      refreshLookupOptions();
      ensureCurrentUser();
      renderUserPicker();
      return true;
    } catch (error) {
      showToast(error.message);
      elements.app.innerHTML = `<div class="empty">Database is not ready. Run the SQL scripts in order, then refresh this page.</div>`;
      return false;
    }
  }

  function render() {
    if (!state.users.length) return;
    prepareRender?.();
    renderNavigation();
    renderUserPicker();
    renderCurrentScreen();
  }

  function bindHighLevelEvents() {
    if (shellEventsBound) return;
    shellEventsBound = true;

    elements.brandAboutButtons.forEach(button => {
      button.addEventListener("click", () => {
        if (!currentUserId) return;
        closeNavOverflow();
        closeUserMenu();
        navigate("About");
        render();
      });
    });

    elements.nav.addEventListener("click", event => {
      const overflowButton = event.target.closest("button[data-action='nav-overflow-toggle']");
      if (overflowButton) {
        toggleNavOverflow();
        return;
      }

      const button = event.target.closest("button[data-view]");
      if (!button) return;
      closeNavOverflow();
      navigate(resolveNavigationView?.(button.dataset.view) ?? button.dataset.view);
      render();
    });

    elements.userSelect.addEventListener("change", () => {
      setCurrentUserId(elements.userSelect.value);
      render();
    });

    elements.userMenuToggle?.addEventListener("click", event => {
      event.stopPropagation();
      toggleUserMenu();
    });

    elements.userMenu?.addEventListener("click", event => {
      const viewButton = event.target.closest("button[data-view]");
      if (viewButton) {
        navigate(resolveNavigationView?.(viewButton.dataset.view) ?? viewButton.dataset.view);
        closeUserMenu();
        render();
        return;
      }

      if (event.target.closest("button[data-action='toggle-theme']")) {
        toggleTheme();
        return;
      }

      if (event.target.closest("button[data-action='change-password']")) {
        closeUserMenu();
        editPassword();
      }
    });

    document.getElementById("logout")?.addEventListener("click", () => {
      closeUserMenu();
      logout();
      renderLogin();
    });

    document.addEventListener("click", event => {
      if (!event.target.closest("#nav")) closeNavOverflow();
      if (!event.target.closest(".user-menu")) closeUserMenu();
    });

    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      closeNavOverflow();
      closeUserMenu();
    });

    window.addEventListener("resize", () => requestAnimationFrame(applyNavOverflow));
  }

  function renderLogin() {
    document.body.classList.add("logged-out");
    elements.nav.innerHTML = "";
    elements.userSelect.innerHTML = "";
    elements.app.innerHTML = `
      <section class="login-screen">
        <div class="panel login-card">
          <div class="login-brand">
            <img src="/assets/project-pmt.svg?v=20260621-transparent" alt="">
            <div>
              <h1>PMT</h1>
              <p class="muted">Project Management Tool</p>
            </div>
          </div>
          <div class="field">
            <label>Nickname or Email</label>
            <input id="loginName" autocomplete="username" value="Sin">
          </div>
          <div class="field">
            <label>Password</label>
            <input id="loginPassword" type="password" autocomplete="current-password" value="Password1">
          </div>
          <button class="primary text-icon-button" type="button" id="loginButton">
            <span class="button-icon" aria-hidden="true">&#10148;</span><span>Log in</span>
          </button>
        </div>
      </section>
    `;

    document.getElementById("loginButton").addEventListener("click", submitLogin);
    document.getElementById("loginPassword").addEventListener("keydown", event => {
      if (event.key === "Enter") submitLogin();
    });
  }

  async function submitLogin() {
    try {
      const loginName = document.getElementById("loginName").value;
      const password = document.getElementById("loginPassword").value;
      await authenticate(loginName, password);
      await start();
    } catch (error) {
      showToast(error.message || "Login failed.");
    }
  }

  function renderNavigation() {
    const navigationScreens = getNavigationScreens();
    const primaryScreens = navigationScreens.filter(screen => !fixedOverflowViews.has(screen.view));
    const fixedOverflowScreens = navigationScreens.filter(screen => fixedOverflowViews.has(screen.view));
    const viewButtons = primaryScreens.map(screen => navButtonHtml({
      view: screen.view,
      label: screen.label,
      icon: navIconHtml(screen.view),
      active: screen.view === currentView
    })).join("");
    const overflowIsActive = fixedOverflowScreens.some(screen => screen.view === currentView);

    elements.nav.innerHTML = `
      ${viewButtons}
      <div class="nav-overflow">
        <button class="nav-overflow-toggle ${overflowIsActive ? "active" : ""}" type="button" data-action="nav-overflow-toggle" title="More navigation" aria-label="More navigation" aria-expanded="false" aria-haspopup="menu">
          <span class="nav-icon" aria-hidden="true">${overflowIconHtml()}</span>
        </button>
        <div class="nav-overflow-menu dropdown-menu" role="menu" hidden></div>
      </div>
    `;
    applyNavOverflow();
    requestAnimationFrame(applyNavOverflow);
  }

  function navButtonHtml(item, extraClass = "nav-item") {
    const isMenuItem = extraClass === "nav-menu-item";
    const attributes = [
      item.view ? `data-view="${escapeHtml(item.view)}"` : "",
      item.action ? `data-action="${escapeHtml(item.action)}"` : "",
      `class="${`${extraClass} ${isMenuItem ? "dropdown-menu-item" : ""} ${item.active ? "active" : ""}`.trim()}"`,
      item.active ? `aria-current="page"` : "",
      isMenuItem ? `role="menuitem"` : ""
    ].filter(Boolean).join(" ");

    return `
      <button type="button" ${attributes}>
        <span class="nav-icon" aria-hidden="true">${item.icon}</span>
        <span>${escapeHtml(item.label)}</span>
      </button>
    `;
  }

  function applyNavOverflow() {
    const overflow = elements.nav.querySelector(".nav-overflow");
    const menu = elements.nav.querySelector(".nav-overflow-menu");
    const toggle = elements.nav.querySelector(".nav-overflow-toggle");
    const topbar = elements.nav.closest(".topbar");
    if (!overflow || !menu || !toggle) return;

    const items = [...elements.nav.querySelectorAll(":scope > button.nav-item")];
    items.forEach(item => item.hidden = false);
    const fixedOverflowScreens = getNavigationScreens()
      .filter(screen => fixedOverflowViews.has(screen.view));
    overflow.hidden = false;
    menu.hidden = true;
    toggle.setAttribute("aria-expanded", "false");

    const fits = () =>
      elements.nav.scrollWidth <= elements.nav.clientWidth + 2
      && (!topbar || topbar.scrollWidth <= topbar.clientWidth + 2);

    const hiddenItems = [];
    for (let index = items.length - 1; index >= 0 && !fits(); index--) {
      const item = items[index];
      item.hidden = true;
      hiddenItems.unshift(item);
    }
    toggle.classList.toggle(
      "active",
      fixedOverflowScreens.some(screen => screen.view === currentView)
        || hiddenItems.some(item => item.classList.contains("active"))
    );

    const responsiveOverflowHtml = hiddenItems.map(item => {
      const view = item.dataset.view;
      const action = item.dataset.action;
      const label = item.querySelector("span:last-child")?.textContent || "";
      const icon = item.querySelector(".nav-icon")?.innerHTML || "&#9679;";
      return navButtonHtml({ view, action, label, icon, active: item.classList.contains("active") }, "nav-menu-item");
    }).join("");
    const fixedOverflowHtml = fixedOverflowScreens.map(screen => navButtonHtml({
      view: screen.view,
      label: screen.label,
      icon: navIconHtml(screen.view),
      active: screen.view === currentView
    }, "nav-menu-item")).join("");
    menu.innerHTML = responsiveOverflowHtml + fixedOverflowHtml;
  }

  function toggleNavOverflow() {
    const menu = elements.nav.querySelector(".nav-overflow-menu");
    const toggle = elements.nav.querySelector(".nav-overflow-toggle");
    if (!menu || !toggle) return;

    const isOpen = menu.hidden;
    menu.hidden = !isOpen;
    toggle.setAttribute("aria-expanded", String(isOpen));
  }

  function closeNavOverflow() {
    const menu = elements.nav.querySelector(".nav-overflow-menu");
    const toggle = elements.nav.querySelector(".nav-overflow-toggle");
    if (!menu || !toggle) return;
    menu.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  }

  function toggleUserMenu() {
    if (!elements.userMenu || !elements.userMenuToggle) return;

    const isOpen = elements.userMenu.hidden;
    elements.userMenu.hidden = !isOpen;
    elements.userMenuToggle.setAttribute("aria-expanded", String(isOpen));
    closeNavOverflow();
  }

  function closeUserMenu() {
    if (!elements.userMenu || !elements.userMenuToggle) return;

    elements.userMenu.hidden = true;
    elements.userMenuToggle.setAttribute("aria-expanded", "false");
  }

  function renderUserPicker() {
    const user = state.users.find(item => item.id === currentUserId);
    elements.userSelect.replaceChildren();
    if (user) {
      const option = document.createElement("option");
      option.value = String(user.id);
      option.textContent = user.nickname;
      elements.userSelect.appendChild(option);
    }

    if (elements.userAvatar) {
      elements.userAvatar.src = user?.avatarUrl || "/assets/avatar-default.svg";
      elements.userAvatar.title = user?.nickname || "";
      elements.userAvatar.alt = user ? `${user.nickname} avatar` : "";
    }

    if (elements.userMenuToggle) {
      elements.userMenuToggle.title = user ? `${user.nickname} menu` : "User menu";
    }

    updateThemeToggle();
  }

  function applySavedTheme() {
    const savedTheme = readPreference(preferenceKeys.theme, "light");
    applyTheme(savedTheme === "dark" ? "dark" : "light");
  }

  function toggleTheme() {
    const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    writePreference(preferenceKeys.theme, nextTheme);
    applyTheme(nextTheme);
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    const colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');
    if (colorSchemeMeta) colorSchemeMeta.content = theme === "light" ? "light dark" : "dark light";
    updateThemeToggle();
  }

  function updateThemeToggle() {
    if (!elements.themeToggle) return;

    const isLight = document.documentElement.dataset.theme === "light";
    const icon = elements.themeToggle.querySelector("[data-theme-icon]");
    const label = elements.themeToggle.querySelector("[data-theme-label]");
    if (icon) icon.innerHTML = isLight ? "&#9790;" : "&#9728;";
    if (label) label.textContent = isLight ? "Dark Theme" : "Light Theme";
    elements.themeToggle.title = isLight ? "Switch to dark theme" : "Switch to light theme";
  }

  return {
    elements,
    initialize,
    reloadState,
    render
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
