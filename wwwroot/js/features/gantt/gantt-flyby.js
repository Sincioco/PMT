import { visibleDateIndex } from "../../shared/dates.js";
import { ganttStartDate } from "./gantt-calculations.js";

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

  function hasResumeSprint() {
    return Boolean(resumeSprintId);
  }

  function hasPending() {
    return pending;
  }

  function getResumeSprintId() {
    return resumeSprintId;
  }

  function setResumeSprintId(sprintId) {
    resumeSprintId = Number(sprintId || 0);
  }

  function startPending() {
    active = true;
    stopRequested = false;
    pending = true;
  }

  function runPending(chart, startingSprint) {
    if (!pending) return;
    pending = false;
    const flyByRunId = ++runId;
    requestAnimationFrame(() => {
      if (flyByRunId !== runId) return;
      const startSprint = flyByStartingSprint(chart.sprints, startingSprint);
      scrollToSprint(chart, startSprint);
      requestAnimationFrame(() => startFlyBy(chart, flyByRunId, startingSprint));
    });
  }

  function scrollToSprintStart(chart, sprint, renderMode) {
    if (!chart?.scrollDate || !chart.dates?.length) return;

    requestAnimationFrame(() => {
      const scroller = document.querySelector(".gantt-scroll");
      if (!scroller) return;

      scroller.scrollLeft = scrollLeftForDate(chart, chart.scrollDate);
      if (renderMode === "all" && sprint) {
        scroller.scrollTop = scrollTopForSprint(sprint);
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
    // This places the sprint start just to the right of the fixed column.
    return Math.max(0, (startIndex * chart.dayWidth) - 16);
  }

  function scrollTopForSprint(sprint) {
    const scroller = document.querySelector(".gantt-scroll");
    const row = document.querySelector(`[data-gantt-sprint-id="${sprint?.id}"]`);
    const header = document.querySelector(".gantt-header");
    if (!scroller || !row) return 0;

    return Math.max(0, rowTopInScroller(row, scroller) - (header?.offsetHeight || 0));
  }

  async function startFlyBy(chart, flyByRunId, startingSprint) {
    const scroller = document.querySelector(".gantt-scroll");
    if (!chart?.dates?.length || !chart.sprints?.length || !scroller) {
      finish("");
      return;
    }
    if (flyByRunId !== runId) return;

    const newestToOldest = [...chart.sprints].sort((a, b) => ganttStartDate(b) - ganttStartDate(a));
    const currentSprint = flyByStartingSprint(newestToOldest, startingSprint);
    const currentIndex = Math.max(0, newestToOldest.findIndex(sprint => sprint.id === currentSprint?.id));
    const flyBySprints = newestToOldest.slice(currentIndex);
    if (!flyBySprints.length) {
      finish("");
      return;
    }

    // Start exactly where the Sprint dropdown would jump for the current Sprint.
    currentSprintId = flyBySprints[0].id;
    scrollToSprint(chart, flyBySprints[0]);
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

  function flyByStartingSprint(sprints, startingSprint) {
    return sprints.find(sprint => sprint.id === resumeSprintId)
      || startingSprint(sprints)
      || sprints[0]
      || null;
  }

  function scrollPosition(chart, sprint) {
    return {
      left: scrollLeftForDate(chart, ganttStartDate(sprint)),
      top: scrollTopForSprint(sprint)
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

  function finish(message) {
    active = false;
    animating = false;
    stopRequested = false;
    resumeSprintId = 0;
    currentSprintId = 0;
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

  function nearestSprintIdFromScroll() {
    const scroller = document.querySelector(".gantt-scroll");
    if (!scroller) return 0;

    const header = document.querySelector(".gantt-header");
    const targetTop = scroller.scrollTop + (header?.offsetHeight || 0);
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
    getResumeSprintId,
    hasPending,
    hasResumeSprint,
    isActive,
    nearestSprintIdFromScroll,
    pause,
    restoreScroll,
    runPending,
    scrollToSprintStart,
    setResumeSprintId,
    startPending,
    state,
    stop,
    updateButton
  };
}
