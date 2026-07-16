import { escapeAttr, escapeHtml } from "../shared/text-and-links.js";

const defaultIdleMs = 10000;

export function createIdleFilterHeader({
  app,
  screenSelector,
  searchFilter,
  onSearchInput,
  idleMs = defaultIdleMs
}) {
  let compact = false;
  let lastActivityAt = 0;
  let idleTimer = 0;
  let resizeFrame = 0;
  let resizeBound = false;
  let searchComposing = false;
  let skipComposedInput = false;

  function controlsHtml(fields) {
    return `
      <div class="idle-filter-header-context" data-idle-filter-header-context>
        ${fields.map(field => `
          <div class="idle-filter-header-context-slot idle-filter-header-${escapeAttr(field.key)}-slot">
            <select data-filter="${escapeAttr(field.filter)}" aria-label="${escapeAttr(field.label)}" title="${escapeAttr(field.label)}">
              ${field.optionsHtml}
            </select>
            <span class="idle-filter-header-context-summary" title="${escapeAttr(field.summaryTitle || field.summary)}">
              ${escapeHtml(field.label)}: ${escapeHtml(field.summary)}
            </span>
          </div>
        `).join("")}
      </div>
    `;
  }

  function searchHtml(value, label = "Search") {
    return `
      <label class="idle-filter-header-search-control" data-idle-filter-header-search-control title="${escapeAttr(label)}">
        <span class="idle-filter-header-search-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <circle cx="10.5" cy="10.5" r="6.5"></circle>
            <path d="m15.5 15.5 5 5"></path>
          </svg>
        </span>
        <input class="idle-filter-header-search-input" type="search" data-filter="${escapeAttr(searchFilter)}" value="${escapeAttr(value)}" aria-label="${escapeAttr(label)}" autocomplete="off">
      </label>
    `;
  }

  function bind() {
    const header = currentHeader();
    if (!header) return;

    header.classList.toggle("is-idle-filter-header-compact", compact);
    header.addEventListener("pointerenter", markActivity);
    header.addEventListener("pointermove", markActivity);
    header.addEventListener("focusin", markActivity);
    header.addEventListener("keydown", markActivity);
    header.addEventListener("change", markActivity);

    const search = header.querySelector(`[data-filter="${searchFilter}"]`);
    search?.addEventListener("compositionstart", () => {
      searchComposing = true;
    });
    search?.addEventListener("compositionend", event => {
      searchComposing = false;
      skipComposedInput = true;
      applySearchInput(event.target);
      queueMicrotask(() => {
        skipComposedInput = false;
      });
    });
    search?.addEventListener("input", event => {
      if (searchComposing || skipComposedInput) return;
      applySearchInput(event.target);
    });

    if (!resizeBound) {
      window.addEventListener("resize", scheduleSearchPosition);
      resizeBound = true;
    }

    if (!lastActivityAt) lastActivityAt = Date.now();
    positionSearch();
    scheduleIdle();
  }

  function applySearchInput(input) {
    const selectionStart = input.selectionStart;
    const selectionEnd = input.selectionEnd;
    markActivity();
    if (onSearchInput(input) === false) return;

    const nextInput = currentHeader()?.querySelector(`[data-filter="${searchFilter}"]`);
    nextInput?.focus({ preventScroll: true });
    if (selectionStart !== null && selectionEnd !== null) {
      nextInput?.setSelectionRange(selectionStart, selectionEnd);
    }
  }

  function markActivity() {
    lastActivityAt = Date.now();
    if (compact) setCompact(false);
    if (!idleTimer) scheduleIdle();
  }

  function scheduleIdle() {
    window.clearTimeout(idleTimer);
    idleTimer = 0;
    if (compact || !currentHeader()) return;

    const remaining = Math.max(0, lastActivityAt + idleMs - Date.now());
    idleTimer = window.setTimeout(() => {
      idleTimer = 0;
      const header = currentHeader();
      if (!header) return;

      const nextRemaining = lastActivityAt + idleMs - Date.now();
      if (nextRemaining > 0) {
        scheduleIdle();
        return;
      }

      if (header.contains(document.activeElement)) {
        lastActivityAt = Date.now();
        scheduleIdle();
        return;
      }

      setCompact(true);
    }, remaining);
  }

  function setCompact(nextCompact) {
    compact = Boolean(nextCompact);
    currentHeader()?.classList.toggle("is-idle-filter-header-compact", compact);
    positionSearch();
  }

  function scheduleSearchPosition() {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      positionSearch();
    });
  }

  function positionSearch() {
    const header = currentHeader();
    const searchControl = header?.querySelector("[data-idle-filter-header-search-control]");
    const context = header?.querySelector("[data-idle-filter-header-context]");
    const addButton = header?.querySelector("[data-idle-filter-header-add-target]");
    if (!header || !searchControl || !context || !addButton) return;

    if (window.matchMedia("(max-width: 1000px)").matches) {
      header.style.removeProperty("--idle-filter-header-search-expanded-x");
      header.style.removeProperty("--idle-filter-header-search-expanded-width");
      header.style.removeProperty("--idle-filter-header-search-compact-x");
      header.style.removeProperty("--idle-filter-header-search-compact-width");
      return;
    }

    const headerRect = header.getBoundingClientRect();
    const contextRect = context.getBoundingClientRect();
    const addRect = addButton.getBoundingClientRect();
    const toolbarGap = Number.parseFloat(getComputedStyle(addButton.parentElement).columnGap) || 8;
    const expandedBaseWidth = Math.min(340, Math.max(260, window.innerWidth * 0.22));
    const expandedLeft = contextRect.right + toolbarGap;
    const expandedRight = addRect.left - toolbarGap;
    const expandedAvailableWidth = Math.max(0, expandedRight - expandedLeft);
    const expandedWidth = Math.max(
      Math.min(180, expandedAvailableWidth),
      Math.min(expandedBaseWidth, expandedAvailableWidth)
    );
    const headerCenter = headerRect.left + (headerRect.width / 2);
    const minimumExpandedCenter = expandedLeft + (expandedWidth / 2);
    const maximumExpandedCenter = expandedRight - (expandedWidth / 2);
    const expandedCenter = minimumExpandedCenter <= maximumExpandedCenter
      ? Math.min(maximumExpandedCenter, Math.max(minimumExpandedCenter, headerCenter))
      : expandedLeft + (expandedAvailableWidth / 2);
    const compactSearchWidth = Math.min(addRect.width, addRect.height);
    const compactCenter = addRect.left - toolbarGap - (compactSearchWidth / 2);

    header.style.setProperty("--idle-filter-header-search-expanded-x", `${expandedCenter - headerCenter}px`);
    header.style.setProperty("--idle-filter-header-search-expanded-width", `${expandedWidth}px`);
    header.style.setProperty("--idle-filter-header-search-compact-x", `${compactCenter - headerCenter}px`);
    header.style.setProperty("--idle-filter-header-search-compact-width", `${compactSearchWidth}px`);
  }

  function reset() {
    compact = false;
    lastActivityAt = Date.now();
    currentHeader()?.classList.remove("is-idle-filter-header-compact");
    scheduleIdle();
  }

  function deactivate() {
    window.clearTimeout(idleTimer);
    idleTimer = 0;
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = 0;
    if (resizeBound) {
      window.removeEventListener("resize", scheduleSearchPosition);
      resizeBound = false;
    }
    compact = false;
    lastActivityAt = 0;
    searchComposing = false;
    skipComposedInput = false;
  }

  function currentHeader() {
    return app.querySelector(`${screenSelector} .section-head`);
  }

  return {
    bind,
    controlsHtml,
    deactivate,
    markActivity,
    reset,
    searchHtml
  };
}
