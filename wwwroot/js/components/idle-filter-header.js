import { escapeAttr, escapeHtml } from "../shared/text-and-links.js";

const defaultIdleMs = 3000;
const defaultSearchDelayMs = 500;

export function createIdleFilterHeader({
  app,
  screenSelector,
  searchFilter,
  onSearchInput,
  idleMs = defaultIdleMs,
  searchDelayMs = defaultSearchDelayMs
}) {
  let compact = false;
  let lastActivityAt = 0;
  let idleTimer = 0;
  let resizeFrame = 0;
  let resizeBound = false;
  let searchComposing = false;
  let skipComposedInput = false;
  let searchTimer = 0;
  let searchDocked = false;
  let searchValue = "";
  let position = null;

  function controlsHtml(fields) {
    return `
      <div class="idle-filter-header-context" data-idle-filter-header-context>
        ${fields.map(field => `
          <div class="idle-filter-header-context-slot idle-filter-header-${escapeAttr(field.key)}-slot">
            <select data-filter="${escapeAttr(field.filter)}" aria-label="${escapeAttr(field.label)}" title="${escapeAttr(field.label)}">
              ${field.optionsHtml}
            </select>
            <span class="idle-filter-header-context-summary" title="${escapeAttr(field.summaryTitle || field.summary)}">${escapeHtml(field.label)}: ${escapeHtml(field.summary)}</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  function searchHtml(value, label = "Search") {
    searchValue = String(value || "");
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
    flushPendingSearch(false);
    const header = currentHeader();
    if (!header) return;

    applyPosition(header);
    header.dataset.idleFilterHeader = "true";
    syncClasses(header);
    header.addEventListener("pointerenter", handlePointerActivity);
    header.addEventListener("pointermove", handlePointerActivity);
    header.addEventListener("focusin", markActivity);
    header.addEventListener("keydown", markActivity);
    header.addEventListener("change", markActivity);

    const searchControl = header.querySelector("[data-idle-filter-header-search-control]");
    const search = searchControl?.querySelector(`[data-filter="${searchFilter}"]`);
    searchControl?.addEventListener("pointerdown", () => {
      if (!compact) return;
      if (!hasSearchText()) searchDocked = true;
      markActivity();
    });
    search?.addEventListener("change", event => {
      event.stopPropagation();
      markActivity();
    });
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

  function handlePointerActivity(event) {
    if (compact && !hasSearchText()) {
      searchDocked = pointerNearSearch(event);
    }
    markActivity();
  }

  function pointerNearSearch(event) {
    const searchControl = event.currentTarget?.querySelector?.("[data-idle-filter-header-search-control]");
    const bounds = searchControl?.getBoundingClientRect();
    if (!bounds) return false;

    const tolerance = 18;
    return event.clientX >= bounds.left - tolerance
      && event.clientX <= bounds.right + tolerance
      && event.clientY >= bounds.top - tolerance
      && event.clientY <= bounds.bottom + tolerance;
  }

  function applySearchInput(input) {
    markActivity();
    if (input?.dataset?.filter !== searchFilter) return;
    searchValue = input.value;
    if (onSearchInput(searchValue, { commit: false, render: false }) === false) return;
    syncClasses(currentHeader());

    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      searchTimer = 0;
      const restoreFocus = document.activeElement === input;
      const selectionStart = input.selectionStart;
      const selectionEnd = input.selectionEnd;
      onSearchInput(searchValue, { commit: true, render: true });

      if (!restoreFocus) return;
      const nextInput = currentHeader()?.querySelector(`[data-filter="${searchFilter}"]`);
      nextInput?.focus({ preventScroll: true });
      if (selectionStart !== null && selectionEnd !== null) {
        nextInput?.setSelectionRange(selectionStart, selectionEnd);
      }
    }, searchDelayMs);
  }

  function flushPendingSearch(render) {
    if (!searchTimer) return;
    window.clearTimeout(searchTimer);
    searchTimer = 0;
    onSearchInput(searchValue, { commit: true, render: Boolean(render) });
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

      const activeElement = document.activeElement;
      const activeSearch = header.querySelector("[data-idle-filter-header-search-control] input");
      const canCompactAroundActiveSearch = activeElement === activeSearch && hasSearchText();
      if (header.contains(activeElement) && !canCompactAroundActiveSearch) {
        lastActivityAt = Date.now();
        scheduleIdle();
        return;
      }

      setCompact(true);
    }, remaining);
  }

  function setCompact(nextCompact) {
    compact = Boolean(nextCompact);
    syncClasses(currentHeader());
    positionSearch();
  }

  function syncClasses(header) {
    if (!header) return;
    const hasText = hasSearchText();
    header.classList.toggle("is-idle-filter-header-compact", compact);
    header.classList.toggle("has-idle-filter-header-search-text", hasText);
    header.classList.toggle(
      "is-idle-filter-header-search-docked",
      searchDocked && (!compact || hasText)
    );
  }

  function hasSearchText() {
    return Boolean(String(searchValue || "").trim());
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
    const title = header?.querySelector("h1");
    if (!header || !searchControl || !addButton) return;

    const headerRect = header.getBoundingClientRect();
    const contextRect = context?.getBoundingClientRect();
    const addRect = addButton.getBoundingClientRect();
    const toolbarGap = Number.parseFloat(getComputedStyle(addButton.parentElement).columnGap) || 8;
    const expandedWidth = Math.min(238, Math.max(182, window.innerWidth * 0.154));
    const compactWidth = Math.min(addRect.width, addRect.height);
    const dockedAvailableWidth = contextRect
      ? addRect.left - contextRect.right - (toolbarGap * 2)
      : expandedWidth;
    const dockedWidth = Math.min(expandedWidth, Math.max(compactWidth, dockedAvailableWidth));
    const headerCenter = headerRect.left + (headerRect.width / 2);
    const compactCenter = addRect.left - toolbarGap - (compactWidth / 2);
    const dockedCenter = addRect.left - toolbarGap - (dockedWidth / 2);

    header.style.setProperty("--idle-filter-header-context-y", "0px");
    let contextY = 0;
    if (window.innerWidth > 1000 && title && context) {
      if (compact) {
        const summaries = context.querySelectorAll(".idle-filter-header-context-summary");
        const titleBaseline = textBaseline(title);
        const summaryBaseline = textBaseline(summaries[0]);
        summaries.forEach(textBaseline);
        contextY = titleBaseline - summaryBaseline;
      } else {
        const titleRect = title.getBoundingClientRect();
        const nextContextRect = context.getBoundingClientRect();
        contextY = titleRect.bottom - nextContextRect.bottom;
      }
    }

    position = {
      compactX: `${compactCenter - headerCenter}px`,
      dockedX: `${dockedCenter - headerCenter}px`,
      dockedWidth: `${dockedWidth}px`,
      contextY: `${contextY}px`
    };
    applyPosition(header);
  }

  function textBaseline(element) {
    if (!element) return 0;

    let marker = element.querySelector(".idle-filter-header-baseline-marker");
    if (!marker) {
      marker = document.createElement("span");
      marker.className = "idle-filter-header-baseline-marker";
      marker.setAttribute("aria-hidden", "true");
      element.append(marker);
    }
    return marker.getBoundingClientRect().top;
  }

  function applyPosition(header) {
    if (!header || !position) return;
    header.style.setProperty("--idle-filter-header-search-compact-x", position.compactX);
    header.style.setProperty("--idle-filter-header-search-docked-x", position.dockedX);
    header.style.setProperty("--idle-filter-header-search-docked-width", position.dockedWidth);
    header.style.setProperty("--idle-filter-header-context-y", position.contextY);
  }

  function reset() {
    window.clearTimeout(searchTimer);
    searchTimer = 0;
    compact = false;
    searchDocked = false;
    position = null;
    lastActivityAt = Date.now();
    const header = currentHeader();
    header?.classList.remove(
      "is-idle-filter-header-compact",
      "has-idle-filter-header-search-text",
      "is-idle-filter-header-search-docked"
    );
    scheduleIdle();
  }

  function deactivate() {
    flushPendingSearch(false);
    window.clearTimeout(idleTimer);
    idleTimer = 0;
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = 0;
    if (resizeBound) {
      window.removeEventListener("resize", scheduleSearchPosition);
      resizeBound = false;
    }
    compact = false;
    searchDocked = false;
    position = null;
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
