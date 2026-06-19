import {
  currentUserId,
  ensureCurrentUser,
  login as authenticate,
  logout,
  setCurrentUserId
} from "./authentication.js";
import {
  preferenceKeys,
  readPreference,
  writePreference
} from "./preferences.js";
import { currentView, navigate, navigationScreens } from "./router.js";
import { loadState, state } from "./store.js";

export function createApplicationShell({
  bindScreenEvents,
  editPassword,
  refreshLookupOptions,
  renderCurrentScreen,
  showToast
}) {
  const elements = {
    app: document.getElementById("app"),
    nav: document.getElementById("nav"),
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
    if (await reloadState()) render();
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
    renderNavigation();
    renderUserPicker();
    renderCurrentScreen();
  }

  function bindHighLevelEvents() {
    if (shellEventsBound) return;
    shellEventsBound = true;

    elements.nav.addEventListener("click", event => {
      const overflowButton = event.target.closest("button[data-action='nav-overflow-toggle']");
      if (overflowButton) {
        toggleNavOverflow();
        return;
      }

      const button = event.target.closest("button[data-view]");
      if (!button) return;
      closeNavOverflow();
      navigate(button.dataset.view);
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
        navigate(viewButton.dataset.view);
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
            <img src="/assets/project-pmt.svg" alt="">
            <div>
              <h1>PMT</h1>
              <p class="muted">Software Engineering</p>
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
    const viewButtons = navigationScreens.map(screen => navButtonHtml({
      view: screen.view,
      label: screen.label,
      icon: navIconHtml(screen.view),
      active: screen.view === currentView
    })).join("");

    elements.nav.innerHTML = `
      ${viewButtons}
      <div class="nav-overflow" hidden>
        <button class="nav-overflow-toggle" type="button" data-action="nav-overflow-toggle" title="More navigation" aria-label="More navigation" aria-expanded="false" aria-haspopup="menu">
          <span class="nav-icon" aria-hidden="true">&#9776;</span>
        </button>
        <div class="nav-overflow-menu" role="menu" hidden></div>
      </div>
    `;
    requestAnimationFrame(applyNavOverflow);
  }

  function navButtonHtml(item, extraClass = "nav-item") {
    const attributes = [
      item.view ? `data-view="${escapeHtml(item.view)}"` : "",
      item.action ? `data-action="${escapeHtml(item.action)}"` : "",
      `class="${`${extraClass} ${item.active ? "active" : ""}`.trim()}"`,
      item.active ? `aria-current="page"` : "",
      extraClass === "nav-menu-item" ? `role="menuitem"` : ""
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
    if (!overflow || !menu || !toggle) return;

    const items = [...elements.nav.querySelectorAll(":scope > button.nav-item")];
    items.forEach(item => item.hidden = false);
    overflow.hidden = true;
    menu.hidden = true;
    menu.innerHTML = "";
    toggle.setAttribute("aria-expanded", "false");

    if (elements.nav.scrollWidth <= elements.nav.clientWidth) return;

    overflow.hidden = false;
    const hiddenItems = [];
    for (let index = items.length - 1; index >= 0 && elements.nav.scrollWidth > elements.nav.clientWidth; index--) {
      const item = items[index];
      item.hidden = true;
      hiddenItems.unshift(item);
    }

    menu.innerHTML = hiddenItems.map(item => {
      const view = item.dataset.view;
      const action = item.dataset.action;
      const label = item.querySelector("span:last-child")?.textContent || "";
      const icon = item.querySelector(".nav-icon")?.innerHTML || "&#9679;";
      return navButtonHtml({ view, action, label, icon, active: item.classList.contains("active") }, "nav-menu-item");
    }).join("");
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
    const savedTheme = readPreference(preferenceKeys.theme, "dark");
    applyTheme(savedTheme === "light" ? "light" : "dark");
  }

  function toggleTheme() {
    const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    writePreference(preferenceKeys.theme, nextTheme);
    applyTheme(nextTheme);
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
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

function navIconHtml(view) {
  const icons = {
    Dashboard: "&#9636;",
    Board: "&#9638;",
    "Road Map": "&#8644;",
    Gantt: "&#8942;",
    Backlog: "&#9776;",
    Projects: "&#9635;",
    Sprints: "&#8635;",
    Tasks: "&#10003;",
    Bugs: "&#9888;",
    Scrum: "&#9719;",
    Documentation: "&#128196;",
    Settings: "&#9881;"
  };
  return icons[view] || "&#9679;";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
