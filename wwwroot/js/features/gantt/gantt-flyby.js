import { visibleDateIndex } from "../../shared/dates.js";
import { ganttStartDate } from "./gantt-calculations.js?v=20260620-render-end-date";

const FLY_BY_VERTICAL_OFFSET = 1;

export function createGanttFlyBy({ showToast }) {
  let frameId = 0;
  let timeoutId = 0;
  let runId = 0;
  let pending = false;
  let active = false;
  let animating = false;
  let stopRequested = false;
  let resumeSprintId = 0;
  let currentSprintId = 0;
  let pendingMode = "sequence";
  let pendingDirection = 1;
  let pendingSprintId = 0;

  function state() {
    return {
      active,
      title: buttonTitle(),
      icon: buttonIcon()
    };
  }

  function isActive() {
    return active;
  }

  function isBusy() {
    return active || pending || animating;
  }

  function hasResumeSprint() {
    return Boolean(resumeSprintId);
  }

  function hasPending() {
    return pending;
  }

  function getResumeSprintId() {
    return resumeSprintId;
  }

  function getCurrentSprintId() {
    return currentSprintId;
  }

  function setResumeSprintId(sprintId) {
    resumeSprintId = Number(sprintId || 0);
  }

  function startPending(direction = 1, sprintId = 0) {
    active = true;
    stopRequested = false;
    pending = true;
    pendingMode = "sequence";
    pendingDirection = normalizedDirection(direction);
    pendingSprintId = Number(sprintId || 0);
  }

  function startAdjacentPending(direction, sprintId) {
    active = true;
    stopRequested = false;
    pending = true;
    pendingMode = "adjacent";
    pendingDirection = normalizedDirection(direction);
    pendingSprintId = Number(sprintId || 0);
    currentSprintId = pendingSprintId;
  }

  function runPending(chart, startingSprint) {
    if (!pending) return;
    pending = false;
    const mode = pendingMode;
    const direction = pendingDirection;
    const sprintId = pendingSprintId;
    pendingMode = "sequence";
    pendingDirection = 1;
    pendingSprintId = 0;
    const flyByRunId = ++runId;
    requestAnimationFrame(() => {
      if (flyByRunId !== runId) return;
      const startSprint = flyByStartingSprint(chart.sprints, startingSprint, sprintId, mode !== "adjacent");
      requestAnimationFrame(() => {
        if (mode === "adjacent") {
          startAdjacentFlyBy(chart, flyByRunId, direction, startSprint);
        } else {
          startFlyBy(chart, flyByRunId, direction, startSprint);
        }
      });
    });
  }

  function scrollToSprintStart(chart, sprint, renderMode, verticalOffset = 0) {
    if (!chart?.scrollDate || !chart.dates?.length) return;

    requestAnimationFrame(() => {
      const scroller = document.querySelector(".gantt-scroll");
      if (!scroller) return;

      scroller.scrollLeft = scrollLeftForDate(chart, chart.scrollDate);
      if (renderMode === "all" && sprint) {
        scroller.scrollTop = Math.max(0, scrollTopForSprint(sprint) + verticalOffset);
      }
    });
  }

  function captureScrollPosition() {
    const scroller = document.querySelector(".gantt-scroll");
    if (!scroller) return null;

    const sprintId = nearestSprintIdFromScroll();
    const sprintTop = sprintId ? scrollTopForSprint({ id: sprintId }) : scroller.scrollTop;
    return {
      left: scroller.scrollLeft,
      top: scroller.scrollTop,
      sprintId,
      rowOffset: scroller.scrollTop - sprintTop
    };
  }

  function restoreScroll(position) {
    if (!position) return;

    const applyScroll = () => {
      const scroller = document.querySelector(".gantt-scroll");
      if (!scroller) return;

      scroller.scrollLeft = position.left;
      if (position.sprintId) {
        const sprintTop = scrollTopForSprint({ id: position.sprintId });
        scroller.scrollTop = Math.max(0, sprintTop + (position.rowOffset || 0));
      } else {
        scroller.scrollTop = position.top;
      }
    };

    requestAnimationFrame(() => {
      applyScroll();
      requestAnimationFrame(applyScroll);
    });
  }

  function scrollToSprint(chart, sprint) {
    const scroller = document.querySelector(".gantt-scroll");
    if (!scroller || !sprint) return;

    scroller.scrollLeft = scrollLeftForDate(chart, ganttStartDate(sprint));
    scroller.scrollTop = scrollTopForSprint(sprint);
  }

  function scrollLeftForDate(chart, date) {
    const startIndex = Math.max(0, visibleDateIndex(chart.dates, date, false));
    // The sprint name column is sticky, so do not add its width to scrollLeft.
    // Align the selected Sprint's first date flush with the fixed column.
    return Math.max(0, startIndex * chart.dayWidth);
  }

  function scrollTopForSprint(sprint) {
    const scroller = document.querySelector(".gantt-scroll");
    const row = document.querySelector(`[data-gantt-sprint-id="${sprint?.id}"]`);
    const header = document.querySelector(".gantt-header");
    if (!scroller || !row) return 0;

    return Math.max(0, rowTopInScroller(row, scroller) - (header?.offsetHeight || 0));
  }

  function flyToAdjacentSprint(chart, direction, startingSprint) {
    if (isBusy()) return false;

    active = true;
    stopRequested = false;
    currentSprintId = Number(startingSprint?.id || nearestSprintIdFromScroll(direction) || 0);
    updateButton();

    const flyByRunId = ++runId;
    requestAnimationFrame(() => startAdjacentFlyBy(chart, flyByRunId, normalizedDirection(direction), startingSprint));
    return true;
  }

  function flyThroughSprints(chart, direction, startingSprint) {
    if (isBusy()) return false;
    if (!chart?.sprints?.length) return false;

    const startSprint = flyByStartingSprint(chart.sprints, startingSprint, Number(startingSprint?.id || 0), true);
    active = true;
    stopRequested = false;
    currentSprintId = Number(startSprint?.id || nearestSprintIdFromScroll(direction) || 0);
    updateButton();

    const flyByRunId = ++runId;
    requestAnimationFrame(() => startFlyBy(chart, flyByRunId, normalizedDirection(direction), startSprint));
    return true;
  }

  async function startFlyBy(chart, flyByRunId, direction, startingSprint) {
    const scroller = document.querySelector(".gantt-scroll");
    if (!chart?.dates?.length || !chart.sprints?.length || !scroller) {
      finish("");
      return;
    }
    if (flyByRunId !== runId) return;

    const sprintOrder = flyBySprintOrder(chart.sprints);
    const currentSprint = sprintOrder.find(sprint => sprint.id === startingSprint?.id)
      || sprintOrder.find(sprint => sprint.id === nearestSprintIdFromScroll(direction))
      || sprintOrder[0]
      || null;
    const flyBySprints = flyBySprintsFrom(sprintOrder, currentSprint, direction);
    if (!flyBySprints.length) {
      finish("");
      return;
    }

    currentSprintId = flyBySprints[0].id;
    if (flyBySprints.length === 1) {
      finish("Sprint Fly-by complete.");
      return;
    }

    for (let index = 1; index < flyBySprints.length; index++) {
      if (flyByRunId !== runId) return;
      const sprint = flyBySprints[index];
      const fromPosition = currentScrollPosition(scroller);
      const toPosition = scrollPosition(chart, sprint);
      animating = true;
      const completedMove = await animateScroll(scroller, fromPosition, toPosition, flyByRunId);
      animating = false;
      if (!completedMove) return;
      currentSprintId = sprint.id;
      if (stopRequested) {
        pauseAtCurrent("Sprint Fly-by paused.");
        return;
      }
      if (!await waitForPause(flyByRunId)) return;
    }
    if (flyByRunId === runId) {
      finish("Sprint Fly-by complete.");
    }
  }

  async function startAdjacentFlyBy(chart, flyByRunId, direction, startingSprint) {
    const scroller = document.querySelector(".gantt-scroll");
    if (!chart?.dates?.length || !chart.sprints?.length || !scroller || !direction) {
      finish("");
      return;
    }
    if (flyByRunId !== runId) return;

    const sprintOrder = flyBySprintOrder(chart.sprints);
    const currentSprint = sprintOrder.find(sprint => sprint.id === startingSprint?.id)
      || sprintOrder.find(sprint => sprint.id === nearestSprintIdFromScroll(direction))
      || sprintOrder[0]
      || null;
    const currentIndex = sprintOrder.findIndex(sprint => sprint.id === currentSprint?.id);
    const targetSprint = sprintOrder[currentIndex + direction];
    if (!currentSprint || !targetSprint) {
      finish("");
      return;
    }

    currentSprintId = currentSprint.id;
    const fromPosition = currentScrollPosition(scroller);
    const toPosition = scrollPosition(chart, targetSprint);
    animating = true;
    const completedMove = await animateScroll(scroller, fromPosition, toPosition, flyByRunId);
    animating = false;
    if (!completedMove) return;
    currentSprintId = targetSprint.id;
    if (flyByRunId === runId) finish("", { keepCurrent: true });
  }

  function flyByStartingSprint(sprints, startingSprint, sprintId = 0, useResume = true) {
    const fallbackSprint = typeof startingSprint === "function" ? startingSprint(sprints) : startingSprint;
    return (useResume ? sprints.find(sprint => sprint.id === resumeSprintId) : null)
      || sprints.find(sprint => sprint.id === sprintId)
      || fallbackSprint
      || sprints[0]
      || null;
  }

  function flyBySprintOrder(sprints) {
    return [...sprints];
  }

  function flyBySprintsFrom(sprints, currentSprint, direction) {
    const currentIndex = sprints.findIndex(sprint => sprint.id === currentSprint?.id);
    if (currentIndex < 0) return [];

    const flyBySprints = [];
    for (let index = currentIndex; index >= 0 && index < sprints.length; index += direction) {
      flyBySprints.push(sprints[index]);
    }
    return flyBySprints;
  }

  function normalizedDirection(direction) {
    return direction < 0 ? -1 : 1;
  }

  function scrollPosition(chart, sprint) {
    return {
      left: scrollLeftForDate(chart, ganttStartDate(sprint)),
      top: Math.max(0, scrollTopForSprint(sprint) + FLY_BY_VERTICAL_OFFSET)
    };
  }

  function currentScrollPosition(scroller) {
    return {
      left: scroller.scrollLeft,
      top: scroller.scrollTop
    };
  }

  function animateScroll(scroller, fromPosition, toPosition, flyByRunId) {
    return new Promise(resolve => {
      const horizontalDistance = Math.abs(toPosition.left - fromPosition.left);
      const verticalDistance = Math.abs(toPosition.top - fromPosition.top);
      const distance = Math.max(horizontalDistance, verticalDistance);
      // Each sprint-to-sprint move is deliberately slow enough for demo viewers
      // to read the sprint label and see task bars before the next pause.
      const duration = Math.min(9000, Math.max(3200, distance * 3.5));
      const startedAt = performance.now();

      const animate = now => {
        if (flyByRunId !== runId) {
          resolve(false);
          return;
        }

        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        scroller.scrollLeft = fromPosition.left + ((toPosition.left - fromPosition.left) * eased);
        scroller.scrollTop = fromPosition.top + ((toPosition.top - fromPosition.top) * eased);

        if (progress < 1) {
          frameId = requestAnimationFrame(animate);
        } else {
          frameId = 0;
          scroller.scrollLeft = toPosition.left;
          scroller.scrollTop = toPosition.top;
          resolve(true);
        }
      };

      frameId = requestAnimationFrame(animate);
    });
  }

  function waitForPause(flyByRunId, milliseconds = 2000) {
    return new Promise(resolve => {
      timeoutId = setTimeout(() => {
        timeoutId = 0;
        resolve(flyByRunId === runId);
      }, milliseconds);
    });
  }

  function pause() {
    if (animating) {
      stopRequested = true;
      updateButton();
      showToast("Sprint Fly-by will pause at the next Sprint.");
      return;
    }

    pauseAtCurrent("Sprint Fly-by paused.");
  }

  function pauseAtCurrent(message) {
    const scrollSprintId = nearestSprintIdFromScroll();
    const pauseSprintId = currentSprintId || resumeSprintId || scrollSprintId;
    runId += 1;
    active = false;
    animating = false;
    stopRequested = false;
    resumeSprintId = pauseSprintId || 0;
    clearTimers();
    updateButton();
    showToast(message);
  }

  function finish(message, options = {}) {
    active = false;
    animating = false;
    stopRequested = false;
    resumeSprintId = 0;
    if (!options.keepCurrent) currentSprintId = 0;
    clearTimers();
    updateButton();
    if (message) showToast(message);
  }

  function stop(options = {}) {
    runId += 1;
    active = false;
    animating = false;
    stopRequested = false;
    pending = false;
    pendingMode = "sequence";
    pendingDirection = 1;
    pendingSprintId = 0;
    if (!options.keepResume) {
      resumeSprintId = 0;
      currentSprintId = 0;
    }
    clearTimers();
  }

  function clearTimers() {
    if (frameId) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    }
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = 0;
    }
  }

  function nearestSprintIdFromScroll(direction = 1) {
    const scroller = document.querySelector(".gantt-scroll");
    if (!scroller) return 0;

    const header = document.querySelector(".gantt-header");
    const targetTop = (direction < 0
      ? scroller.scrollTop + scroller.clientHeight
      : scroller.scrollTop + (header?.offsetHeight || 0)) + FLY_BY_VERTICAL_OFFSET;
    const rows = [...document.querySelectorAll("[data-gantt-sprint-id]")];
    const nearestRow = rows.reduce((bestRow, row) => {
      if (!bestRow) return row;
      return Math.abs(rowTopInScroller(row, scroller) - targetTop) < Math.abs(rowTopInScroller(bestRow, scroller) - targetTop) ? row : bestRow;
    }, null);

    return Number(nearestRow?.dataset.ganttSprintId || 0);
  }

  function rowTopInScroller(row, scroller) {
    return row.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
  }

  function updateButton() {
    const button = document.querySelector("[data-action='gantt-flyby']");
    if (!button) return;

    button.classList.toggle("is-on", active);
    button.title = buttonTitle();
    button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-pressed", String(active));
    button.innerHTML = buttonIcon();
  }

  function buttonTitle() {
    if (stopRequested) return "Pausing after this Sprint";
    if (active) return "Pause Sprint Fly-by";
    if (resumeSprintId) return "Resume Sprint Fly-by";
    return "Start Sprint Fly-by";
  }

  function buttonIcon() {
    return active ? "&#10074;&#10074;" : "&#9654;";
  }

  return {
    captureScrollPosition,
    deactivate: stop,
    flyThroughSprints,
    flyToAdjacentSprint,
    getCurrentSprintId,
    getResumeSprintId,
    hasPending,
    hasResumeSprint,
    isBusy,
    isActive,
    nearestSprintIdFromScroll,
    pause,
    restoreScroll,
    runPending,
    scrollToSprintStart,
    setResumeSprintId,
    startAdjacentPending,
    startPending,
    state,
    stop,
    updateButton
  };
}
