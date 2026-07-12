import { expect, test } from "@playwright/test";

test("About renders the drone flyby and supports camera takeover and speed keys", async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const browserErrors = collectBrowserErrors(page);
  await prepareAboutPage(page);
  await page.goto("/#/about");

  const root = page.locator("[data-about-flight]");
  const canvas = page.locator("[data-about-canvas]");
  const intro = page.locator("[data-about-intro]");
  const mode = page.locator("[data-about-mode]");
  const status = page.locator("[data-about-status]");
  const controls = page.locator(".about-flight-controls");
  const flightDebug = page.locator("[data-about-flight-debug]");
  const alienNotice = page.locator("[data-about-alien-notice]");

  await expect(root).toBeVisible();
  await expect(intro.locator("img")).toHaveAttribute("src", /pmt-logo-full\.svg/);
  await expect(page.locator("[data-about-intro-countdown]")).toContainText("3D flight begins in");
  await expect(root).toHaveClass(/about-flight-started/, { timeout: 15000 });
  await expect(intro).toBeHidden();
  await expect(mode).toHaveText("AUTO 2x");
  await expect(root).toHaveAttribute("data-about-workload-billboard", "ready");
  await expect(root).toHaveAttribute("data-about-workload-style", "dev-and-bug-charts");
  await expect(root).toHaveAttribute("data-about-workload-frame", "none");
  await expect(root).toHaveAttribute("data-about-workload-perimeter", "none");
  await expect(root).toHaveAttribute("data-about-workload-stand", "none");
  await expect(root).toHaveAttribute("data-about-workload-sheen", "subtle");
  await expect(root).toHaveAttribute("data-about-workload-display", "floating-glass");
  await expect(root).toHaveAttribute("data-about-workload-glass", "semi-transparent");
  await expect(root).toHaveAttribute("data-about-workload-chart-content", "opaque");
  await expect(root).toHaveAttribute("data-about-workload-color-output", "srgb-unlit");
  await expect(root).toHaveAttribute("data-about-chart-panel-theme", "dark-fixed");
  await expect(root).toHaveAttribute("data-about-chart-panel-follows-app-theme", "false");
  await expect(root).toHaveAttribute("data-about-workload-rows", "3");
  await expect(root).toHaveAttribute("data-about-dev-chart-count", "4");
  await expect(root).toHaveAttribute("data-about-bug-chart-count", "4");
  await expect(root).toHaveAttribute("data-about-dev-chart-grid", "2x2");
  await expect(root).toHaveAttribute("data-about-bug-chart-grid", "2x2");
  await expect(root).toHaveAttribute("data-about-bug-chart-growth-direction", "away-from-dev-wall");
  await expect(root).toHaveAttribute("data-about-team-card-count", "3");
  await expect(root).toHaveAttribute("data-about-team-card-columns", "2");
  await expect(root).toHaveAttribute("data-about-team-card-rows", "2");
  await expect(root).toHaveAttribute("data-about-team-growth-direction", "away-from-dev-wall");
  await expect(root).toHaveAttribute("data-about-logo-grounded", "true");
  await expect(root).toHaveAttribute("data-about-star-particles", "fixed-distant-world-space");
  await expect(root).toHaveAttribute("data-about-shooting-stars", "removed");
  await expect(root).toHaveAttribute("data-about-galaxy-background", "fixed-world-space");
  await expect(root).toHaveAttribute("data-about-comet-portal-exit", "enabled");
  await expect(root).toHaveAttribute("data-about-comet-schedule", "random-background");
  await expect(root).toHaveAttribute("data-about-comet-camera-influence", "none");
  await expect(root).toHaveAttribute("data-about-comet-active", "false");
  await expect(root).toHaveAttribute("data-about-cinematic-events", "sequence-4-background-ufo");
  await expect(root).toHaveAttribute("data-about-ufo-enabled", "true");
  await expect(root).toHaveAttribute("data-about-ufo-schedule", "sequence-4-background");
  await expect(root).toHaveAttribute("data-about-ufo-sequence-4-active", "false");
  await expect(root).toHaveAttribute("data-about-ufo-camera-tracking", "false");
  await expect(root).toHaveAttribute("data-about-ufo-camera-influence", "none");
  await expect(root).toHaveAttribute("data-about-ufo-sequence-4-playback", "full-background-animation");
  await expect(root).toHaveAttribute("data-about-lightning-enabled", "true");
  await expect(root).toHaveAttribute("data-about-lightning-schedule", "sequence-4-background");
  await expect(root).toHaveAttribute("data-about-lightning-camera-influence", "none");
  await expect(root).toHaveAttribute("data-about-lightning-scene-flash", "dramatic");
  await expect(root).toHaveAttribute("data-about-lightning-ufo-strike", "random");
  await expect(root).toHaveAttribute("data-about-lightning-ufo-strike-chance", "0.5");
  await expect(root).toHaveAttribute("data-about-lightning-ufo-strike-planned", "false");
  await expect(root).toHaveAttribute("data-about-event-hotkeys", "A,L,C,U,R");
  await expect(root).toHaveAttribute("data-about-random-event-choices", "alien,lightning,comet");
  await expect(root).toHaveAttribute("data-about-event-camera-influence", "none");
  await expect(root).toHaveAttribute("data-about-animation-pause-scope", "flight-and-events");
  await expect(root).toHaveAttribute("data-about-alien-hotkey-lightning", "guaranteed");
  await expect(root).toHaveAttribute("data-about-alien-hotkey-strike-delay-seconds", "16");
  await expect(root).toHaveAttribute("data-about-alien-hotkey-strike-pending", "false");
  await expect(root).toHaveAttribute("data-about-initial-camera", "2d-logo-facing");
  await expect(root).toHaveAttribute("data-about-flight-path", "initial-logo-p-hole-dev-bug-return-initial");
  await expect(root).toHaveAttribute("data-about-flight-direction", "forward-through-approved-sequences");
  await expect(root).toHaveAttribute("data-about-flight-profile", "approved-sequences-1-through-4");
  await expect(root).toHaveAttribute("data-about-chart-inspection", "random-dev-then-random-bug");
  await expect(root).toHaveAttribute("data-about-pmt-portal-flyby", "once-per-sequence-cycle");
  await expect(root).toHaveAttribute("data-about-event-execution", "sequence-4-ufo-background");
  await expect(root).toHaveAttribute("data-about-minimum-forward-look-dot", "0.342");
  await expect(root).toHaveAttribute("data-about-level-horizon-fallback", "true");
  await expect(root).toHaveAttribute("data-about-post-portal-targeting", "continuous-dev-target");
  await expect(root).toHaveAttribute("data-about-post-portal-transition", "horizontal-bearing-then-chart-elevation");
  await expect(root).toHaveAttribute("data-about-circular-flight-path", "removed");
  await expect(root).toHaveAttribute("data-about-unapproved-flight-logic", "disabled");
  await expect(root).toHaveAttribute("data-about-dev-selection-mode", "random");
  await expect(root).toHaveAttribute("data-about-bug-selection-mode", "random");
  await expect(root).toHaveAttribute("data-about-automatic-sequence-reset", "true");
  await expect(root).toHaveAttribute("data-about-approved-flyby-sequences", "1,2,3,4");
  await expect(root).toHaveAttribute("data-about-flight-test-mode", "approved-sequences-1-through-4");
  await expect(root).toHaveAttribute("data-about-flight-timing", "continuous-no-pause-no-hold");
  await expect(root).toHaveAttribute("data-about-default-flight-speed", "2");
  await expect(root).toHaveAttribute("data-about-flight-speed-policy", "user-controlled-constant");
  await expect(root).toHaveAttribute("data-about-automatic-speed-changes", "disabled");
  await expect(root).toHaveAttribute("data-about-mouse-control", "hold-left-button-autopilot-continues");
  await expect(root).toHaveAttribute("data-about-mouse-pointer-lock", "disabled");
  await expect(root).toHaveAttribute("data-about-wheel-control", "zoom-without-manual-takeover");
  await expect(root).toHaveAttribute("data-about-keyboard-manual-keys", "W,A,S,D,Q,E");
  await expect(root).toHaveAttribute(
    "data-about-a-key-behavior",
    "alien-event-without-autopilot-takeover;strafe-left-only-when-manual"
  );
  await expect(root).toHaveAttribute("data-about-keyboard-manual-idle-seconds", "5");
  await expect(root).toHaveAttribute("data-about-speed-keys-stay-automatic", "true");
  await expect(root).toHaveAttribute("data-about-pause-key", "Space");
  await expect(root).toHaveAttribute("data-about-restart-key", "Enter");
  await expect(root).toHaveAttribute("data-about-control-hints-key", "?");
  await expect(root).toHaveAttribute("data-about-control-hints-duration-seconds", "5");
  await expect(root).toHaveAttribute("data-about-control-hints-layout", "large-left-panel");
  await expect(root).toHaveAttribute("data-about-control-hints-automatic", "true");
  await expect(root).toHaveAttribute("data-about-initial-control-hints-after-sequence-4", "true");
  await expect(root).toHaveAttribute("data-about-initial-control-hints-shown", "false");
  await expect(root).toHaveAttribute("data-about-manual-mode-panel-action", "resume-autopilot");
  await expect(root).toHaveAttribute("data-about-dev-landing-reset-key", "Automatic");
  await expect(root).toHaveAttribute("data-about-dev-arrival-behavior", "slow-continuous-no-stop");
  await expect(root).toHaveAttribute("data-about-dev-landing-framing", "natural-flyby");
  await expect(root).toHaveAttribute("data-about-bug-landing-framing", "upper-left-for-wide-charts");
  await expect(root).toHaveAttribute("data-about-dev-to-bug-transition", "precomputed-overlap-curve");
  await expect(root).toHaveAttribute("data-about-dev-to-bug-handoff-prepared", "true");
  await expect(root).toHaveAttribute("data-about-sequence-transition-pose", "continuous-preblended-curve");
  await expect(root).toHaveAttribute("data-about-bug-to-return-transition", "precomputed-overlap-curve");
  await expect(root).toHaveAttribute("data-about-bug-to-return-handoff-prepared", "true");
  await expect(root).toHaveAttribute("data-about-wide-chart-traversal", "generalized-by-chart-width-and-wall");
  await expect(root).toHaveAttribute("data-about-wide-chart-threshold", "16.416");
  await expect(root).toHaveAttribute("data-about-wide-chart-traversal-speed", "5");
  await expect(root).toHaveAttribute("data-about-wide-chart-landing", "upper-left");
  await expect(root).toHaveAttribute("data-about-wide-chart-traversal-active", "false");
  await expect(root).toHaveAttribute("data-about-wide-chart-camera-bias", "original-diagonal-chart-view");
  await expect(root).toHaveAttribute("data-about-wide-chart-speed-profile", "constant");
  await expect(root).toHaveAttribute("data-about-wide-chart-traversal-constraint", "distance-based");
  await expect(root).toHaveAttribute("data-about-wide-chart-traversal-span-ratio", "0.64");
  await expect(root).toHaveAttribute("data-about-wide-chart-traversal-start-offset-ratio", "-0.3");
  await expect(root).toHaveAttribute("data-about-wide-chart-traversal-end-offset-ratio", "0.34");
  await expect(root).toHaveAttribute("data-about-wide-chart-traversal-ratio-verified", "true");
  await expect(root).toHaveAttribute("data-about-wide-chart-traversal-fov", "56");
  await expect(root).toHaveAttribute("data-about-wide-chart-traversal-zoom", "slight-zoom-out");
  await expect(root).toHaveAttribute("data-about-wide-chart-exit", "visible-far-edge");
  await expect(root).toHaveAttribute("data-about-sequence-4", "qa-chart-to-initial-view");
  await expect(root).toHaveAttribute("data-about-sequence-4-focus", "pmt-logo");
  await expect(root).toHaveAttribute("data-about-sequence-4-duration-seconds", "38");
  await expect(root).toHaveAttribute("data-about-gallery-room-half-width", "36");
  await expect(root).toHaveAttribute("data-about-gallery-room-back-z", "-32");
  await expect(root).toHaveAttribute("data-about-dev-destination", /Chart$/);
  await expect(root).toHaveAttribute("data-about-dev-destination-width", "15.2");
  await expect(root).toHaveAttribute("data-about-dev-destination-is-wide", "false");
  await expect(root).toHaveAttribute("data-about-next-destination", /Chart$/);
  await expect(root).toHaveAttribute("data-about-next-destination-prepared", "true");
  await expect(root).toHaveAttribute("data-about-bug-destination", /Chart$/);
  await expect(root).toHaveAttribute("data-about-bug-destination-width", /^(15\.2|[1-9]\d+(?:\.\d+)?)$/);
  await expect(root).toHaveAttribute("data-about-bug-destination-is-wide", /^(true|false)$/);
  await expect(root).toHaveAttribute("data-about-bug-destination-prepared", "true");
  await expect(root).toHaveAttribute("data-about-lightning-active", "false");
  await expect(root).toHaveAttribute("data-about-lightning-strike-count", "0");
  await expect(root).toHaveAttribute("data-about-min-camera-floor-clearance", "1.55");
  await expect(root).toHaveAttribute("data-about-floor-width", "220");
  await expect(root).toHaveAttribute("data-about-floor-depth", "180");
  const billboard = await root.evaluate(element => ({
    width: Number(element.dataset.aboutWorkloadBillboardWidth),
    height: Number(element.dataset.aboutWorkloadBillboardHeight),
    z: Number(element.dataset.aboutWorkloadBillboardZ),
    devX: Number(element.dataset.aboutDevChartGridX),
    bugX: Number(element.dataset.aboutBugChartGridX),
    bugStartX: Number(element.dataset.aboutBugChartGridStartX),
    bugWidth: Number(element.dataset.aboutBugChartGridWidth),
    bugIntersectionX: Number(element.dataset.aboutBugChartIntersectionX),
    bugIntersectionZ: Number(element.dataset.aboutBugChartIntersectionZ),
    bugRotation: Number(element.dataset.aboutBugChartRotationDegrees),
    teamX: Number(element.dataset.aboutTeamGridX),
    teamY: Number(element.dataset.aboutTeamGridY),
    teamZ: Number(element.dataset.aboutTeamGridZ),
    teamWidth: Number(element.dataset.aboutTeamGridWidth),
    teamIntersectionX: Number(element.dataset.aboutTeamGridIntersectionX),
    teamIntersectionZ: Number(element.dataset.aboutTeamGridIntersectionZ),
    teamRotation: Number(element.dataset.aboutTeamGridRotationDegrees),
    floorGap: Number(element.dataset.aboutLogoFloorGap),
    sceneOffset: Number(element.dataset.aboutSceneOffset),
    ufoSceneOffset: Number(element.dataset.aboutUfoSceneOffset)
  }));
  expect(billboard.width).toBeGreaterThan(20);
  expect(billboard.height).toBeGreaterThan(10);
  expect(billboard.z).toBeLessThanOrEqual(-15);
  expect(billboard.devX).toBeCloseTo(0, 3);
  expect(billboard.bugX).toBeCloseTo(36, 3);
  expect(billboard.bugStartX).toBeCloseTo(36, 3);
  expect(billboard.bugWidth).toBeGreaterThan(30);
  expect(billboard.bugIntersectionX).toBeCloseTo(36, 3);
  expect(billboard.bugIntersectionZ).toBeCloseTo(billboard.z, 3);
  expect(billboard.bugRotation).toBe(-90);
  expect(billboard.teamX).toBeCloseTo(-36, 3);
  expect(billboard.teamWidth).toBeGreaterThan(12);
  expect(billboard.teamY).toBeLessThan(1);
  expect(billboard.teamZ).toBeGreaterThan(billboard.z);
  expect(billboard.teamIntersectionX).toBeCloseTo(-36, 3);
  expect(billboard.teamIntersectionZ).toBeCloseTo(billboard.z, 3);
  expect(billboard.teamRotation).toBe(90);
  expect(billboard.floorGap).toBeCloseTo(0.045, 3);
  expect(billboard.ufoSceneOffset).toBeCloseTo(billboard.sceneOffset, 5);

  const initialForwardTravel = Number(await root.getAttribute("data-about-forward-travel"));
  await page.waitForTimeout(300);
  const laterForwardTravel = Number(await root.getAttribute("data-about-forward-travel"));
  expect(laterForwardTravel).toBeGreaterThan(initialForwardTravel);
  expect(Number(await root.getAttribute("data-about-forward-look-dot"))).toBeGreaterThanOrEqual(0.341);

  const canvasSize = await canvas.evaluate(element => ({
    cssWidth: element.clientWidth,
    cssHeight: element.clientHeight,
    bufferWidth: element.width,
    bufferHeight: element.height
  }));
  expect(canvasSize.cssWidth).toBeGreaterThan(700);
  expect(canvasSize.cssHeight).toBeGreaterThan(300);
  expect(canvasSize.bufferWidth).toBeGreaterThanOrEqual(canvasSize.cssWidth);
  expect(canvasSize.bufferHeight).toBeGreaterThanOrEqual(canvasSize.cssHeight);

  await canvas.focus();
  const focusedCanvasStyle = await canvas.evaluate(element => {
    const style = getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow
    };
  });
  expect(focusedCanvasStyle.outlineStyle).toBe("none");
  expect(focusedCanvasStyle.outlineWidth).toBe("0px");
  expect(focusedCanvasStyle.boxShadow).toBe("none");

  const fullBleed = await root.evaluate(element => {
    const shell = element.parentElement;
    const shellRect = shell.getBoundingClientRect();
    const sceneRect = element.getBoundingClientRect();
    const shellStyle = getComputedStyle(shell);
    const sceneStyle = getComputedStyle(element);
    return {
      left: sceneRect.left - shellRect.left,
      top: sceneRect.top - shellRect.top,
      right: shellRect.right - sceneRect.right,
      bottom: shellRect.bottom - sceneRect.bottom,
      shellPadding: shellStyle.padding,
      borderWidth: sceneStyle.borderWidth,
      borderRadius: sceneStyle.borderRadius
    };
  });
  expect(fullBleed.left).toBeCloseTo(0, 1);
  expect(fullBleed.top).toBeCloseTo(0, 1);
  expect(fullBleed.right).toBeCloseTo(0, 1);
  expect(fullBleed.bottom).toBeCloseTo(0, 1);
  expect(fullBleed.shellPadding).toBe("0px");
  expect(fullBleed.borderWidth).toBe("0px");
  expect(fullBleed.borderRadius).toBe("0px");

  await expect(status).toBeHidden();
  await expect(controls).toBeHidden();
  await expect(flightDebug).toBeVisible();
  await expect(flightDebug).not.toHaveText("");

  const screenshot = await root.screenshot();
  expect(screenshot.byteLength).toBeGreaterThan(30000);
  await testInfo.attach("about-3d-drone", { body: screenshot, contentType: "image/png" });

  if (await root.getAttribute("data-about-flight-test-mode") === "approved-sequences-1-through-4") {
    expect(browserErrors).toEqual([]);
    return;
  }

  await page.keyboard.press("a");
  await expect(root).toHaveAttribute("data-about-ufo-enabled", "true");
  await expect(alienNotice).toBeVisible();
  await expect(alienNotice).toContainText("automatically in the background during Sequence 4");
  await page.keyboard.press("l");
  await expect(root).toHaveAttribute("data-about-lightning-enabled", "true");
  await expect(alienNotice).toContainText("automatically in the background during Sequence 4");
  await page.waitForTimeout(900);
  await expect(root).toHaveAttribute("data-about-lightning-strike-count", "0");
  await expect(root).toHaveAttribute("data-about-lightning-active", "false");

  await canvas.press("Shift+=");
  await expect(status).toContainText("2.25x speed");
  await expect(root).toHaveAttribute("data-flight-mode", "auto");
  await canvas.press("-");
  await expect(status).toContainText("2x speed");
  await canvas.press("Control+-");
  await expect(status).toContainText("2x speed");
  await expect(root).toHaveAttribute("data-flight-mode", "auto");
  await canvas.press("Control+0");

  await canvas.dispatchEvent("wheel", { deltaY: -180 });
  await expect(root).toHaveAttribute("data-flight-mode", "manual");
  await expect(status).toHaveText("Autopilot resumes in 5");
  await expect(status).toBeVisible();
  await expect(controls).toBeVisible();
  await canvas.press("a");
  await expect(root).toHaveAttribute("data-about-ufo-enabled", "true");

  const desktopHud = await measureAboutHud(root);
  expect(desktopHud.statusBottomGap).toBeCloseTo(18, 1);
  expect(desktopHud.statusCenterOffset).toBeCloseTo(0, 1);
  expect(desktopHud.statusTop).toBeGreaterThan(desktopHud.rootHeight / 2);
  expect(desktopHud.overlapsControls).toBe(false);
  expect(desktopHud.overlapsMode).toBe(false);

  const originalViewport = page.viewportSize();
  await page.setViewportSize({ width: 630, height: 665 });
  await canvas.dispatchEvent("wheel", { deltaY: -1 });
  await page.waitForTimeout(150);
  const compactHud = await measureAboutHud(root);
  expect(compactHud.statusBottomGap).toBeCloseTo(12, 1);
  expect(compactHud.statusCenterOffset).toBeCloseTo(0, 1);
  expect(compactHud.statusTop - compactHud.controlsBottom).toBeCloseTo(8, 1);
  expect(compactHud.statusTop - compactHud.modeBottom).toBeCloseTo(8, 1);
  expect(compactHud.overlapsControls).toBe(false);
  expect(compactHud.overlapsMode).toBe(false);
  await page.setViewportSize(originalViewport);
  await page.waitForTimeout(150);

  await expect(root).toHaveAttribute("data-flight-mode", "auto", { timeout: 11000 });
  await expect(status).toBeHidden();
  await expect(controls).toBeHidden();

  await page.locator(".brand-logo-button[data-brand-about]").click();
  await expect(page.locator("[data-about-canvas]")).toHaveCount(1);
  await expect(page.locator("[data-about-intro]")).toBeVisible();
  await expect(page.locator("[data-about-mode]")).toHaveText("AUTO 2x", { timeout: 15000 });
  expect(browserErrors).toEqual([]);
});

test("About separates mouse look, keyboard manual mode, pause, and event hotkeys", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await prepareAboutPage(page);
  await page.goto("/#/about");

  const root = page.locator("[data-about-flight]");
  const canvas = page.locator("[data-about-canvas]");
  const mode = page.locator("[data-about-mode]");
  const controls = page.locator(".about-flight-controls");
  await expect(root).toHaveClass(/about-flight-started/, { timeout: 15000 });
  await expect(root).toHaveAttribute("data-flight-mode", "auto");

  await page.keyboard.press("Shift+/");
  await expect(root).toHaveAttribute("data-about-control-hints-visible", "true");
  await expect(controls).toBeVisible();
  await expect(root).toHaveAttribute("data-flight-mode", "auto");

  await canvas.dispatchEvent("wheel", { deltaY: -180 });
  await expect(root).toHaveAttribute("data-flight-mode", "auto");
  await expect(root).not.toHaveAttribute("data-about-user-zoom-offset", "0.00");

  await canvas.dispatchEvent("pointerdown", {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
    clientX: 320,
    clientY: 240
  });
  await expect(root).toHaveAttribute("data-about-mouse-look-active", "true");
  await expect(root).toHaveAttribute("data-flight-mode", "auto");
  await canvas.dispatchEvent("pointerup", { button: 0, pointerId: 1, pointerType: "mouse" });
  await expect(root).toHaveAttribute("data-about-mouse-look-active", "false");

  await page.keyboard.press("Shift+=");
  await expect(root).toHaveAttribute("data-about-flight-speed", "2.25");
  await expect(root).toHaveAttribute("data-flight-mode", "auto");

  await page.keyboard.down("w");
  await page.keyboard.up("w");
  await expect(root).toHaveAttribute("data-flight-mode", "manual");
  await expect(root).toHaveAttribute("data-about-control-hints-visible", "true");
  await expect(controls).toBeVisible();
  await expect(mode).toBeEnabled();
  await page.keyboard.press("Shift+/");
  await expect(root).toHaveAttribute("data-about-control-hints-visible", "true");

  await mode.click();
  await expect(root).toHaveAttribute("data-flight-mode", "returning");
  await expect(root).toHaveAttribute("data-flight-mode", "auto", { timeout: 7000 });

  await page.keyboard.press("Space");
  await expect(root).toHaveAttribute("data-flight-mode", "paused");
  await page.keyboard.press("Space");
  await expect(root).toHaveAttribute("data-flight-mode", "auto");

  await page.keyboard.press("u");
  await expect(root).toHaveAttribute("data-about-manual-event-last", "alien");
  await expect(root).toHaveAttribute("data-about-manual-event-count", "1");
  await expect(root).toHaveAttribute("data-flight-mode", "auto");
  await page.keyboard.press("a");
  await expect(root).toHaveAttribute("data-about-alien-hotkey-strike-pending", "true");
  await expect(root).toHaveAttribute("data-about-manual-event-last", "alien");
  await expect(root).toHaveAttribute("data-flight-mode", "auto");
  await page.keyboard.press("l");
  await expect(root).toHaveAttribute("data-about-manual-event-last", "lightning");
  await page.keyboard.press("c");
  await expect(root).toHaveAttribute("data-about-manual-event-last", "comet");
  await page.keyboard.press("r");
  await expect(root).toHaveAttribute("data-about-manual-event-count", "5");

  await page.keyboard.press("Enter");
  await expect(page.locator("[data-about-intro]")).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("About honors reduced motion with a still 3D scene", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await prepareAboutPage(page);
  await page.goto("/#/about");

  const root = page.locator("[data-about-flight]");
  await expect(root).toHaveClass(/about-flight-started/, { timeout: 15000 });
  await expect(root).toHaveAttribute("data-flight-mode", "reduced");
  await expect(page.locator("[data-about-mode]")).toHaveText("STILL");
  await page.waitForTimeout(350);
  await expect(root).toHaveAttribute("data-flight-mode", "reduced");
  await expect(page.locator("[data-about-status]")).toContainText("Reduced motion");
  await expect(page.locator("[data-about-status]")).toBeHidden();
  expect(browserErrors).toEqual([]);
});

test("About schedules background-only UFO and lightning events for Sequence 4", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await prepareAboutPage(page);
  await page.goto("/#/about");

  const root = page.locator("[data-about-flight]");
  const mode = page.locator("[data-about-mode]");
  const speech = page.locator("[data-about-ufo-speech]");

  await expect(root).toHaveClass(/about-flight-started/, { timeout: 15000 });
  await expect(root).toHaveAttribute("data-about-cinematic-events", "sequence-4-background-ufo");
  await expect(root).toHaveAttribute("data-about-ufo-enabled", "true");
  await expect(root).toHaveAttribute("data-about-ufo-schedule", "sequence-4-background");
  await expect(root).toHaveAttribute("data-about-ufo-camera-tracking", "false");
  await expect(root).toHaveAttribute("data-about-ufo-camera-influence", "none");
  await expect(root).toHaveAttribute("data-about-lightning-enabled", "true");
  await expect(root).toHaveAttribute("data-about-lightning-camera-influence", "none");
  await expect(mode).toHaveText("AUTO 2x");
  await expect(speech).toBeHidden();
  expect(browserErrors).toEqual([]);
});

test("About keeps the original SVG when WebGL2 is unavailable", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function patchedGetContext(type, options) {
      if (type === "webgl2") return null;
      return getContext.call(this, type, options);
    };
  });
  await prepareAboutPage(page);
  await page.goto("/#/about");

  const root = page.locator("[data-about-flight]");
  await expect(root).toHaveClass(/about-flight-is-fallback/);
  await expect(root.locator(".about-intro-logo")).toBeVisible();
  await expect(root.locator(".about-intro-logo")).toHaveAttribute("src", /pmt-logo-full\.svg/);
  await expect(page.locator("[data-about-mode]")).toHaveText("SVG");
  await expect(page.locator("[data-about-fallback]")).toContainText("original PMT logo");
  expect(browserErrors).toEqual([]);
});

async function prepareAboutPage(page) {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("pmt-auth-user", "1");
    localStorage.setItem("pmt-view", "About");
    localStorage.setItem("pmt-task-project", "10");
    localStorage.setItem("pmt-task-sprint", "101");
    localStorage.setItem("pmt-bug-filters", JSON.stringify({ projectId: "10", sprintId: "all" }));
  });

  await page.route("**/api/state", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        users: [
          {
            id: 1,
            firstName: "Sin",
            lastName: "Cioco",
            nickname: "Sin",
            email: "sin@example.test",
            phone: "",
            avatarUrl: "/assets/avatar-sin.jpg",
            bio: "PMT Creator and Administrator.",
            isAdmin: true,
            role: "Admin",
            isActive: true
          },
          { id: 2, firstName: "Nova", lastName: "Chen", nickname: "Nova", isActive: true },
          { id: 3, firstName: "Kai", lastName: "Reyes", nickname: "Kai", isActive: true }
        ],
        projects: [{ id: 10, code: "PMT", title: "Project Management Tool" }],
        sprints: [
          { id: 99, projectId: 10, code: "PMT-S22", title: "Chart Foundation", startDate: "2026-05-01", endDate: "2026-05-31" },
          { id: 100, projectId: 10, code: "PMT-S23", title: "Glass Scene", startDate: "2026-06-01", endDate: "2026-06-30" },
          { id: 101, projectId: 10, code: "PMT-S24", title: "About 3D", startDate: "2026-07-01", endDate: "2026-07-31" }
        ],
        tasks: [
          { id: 1, projectId: 10, sprintId: 101, taskType: "Dev Task", status: "Todo", assigneeIds: [1] },
          { id: 2, projectId: 10, sprintId: 101, taskType: "Dev Task", status: "Ready for QA", assigneeIds: [1, 2] },
          { id: 3, projectId: 10, sprintId: 101, taskType: "Dev Task", status: "Security Review", assigneeIds: [2] },
          { id: 4, projectId: 10, sprintId: 101, taskType: "Dev Task", status: "Deployed in Prod", assigneeIds: [3] },
          { id: 5, projectId: 10, sprintId: 101, taskType: "Bug", status: "In Progress", severity: "Major", assigneeIds: [1] },
          { id: 6, projectId: 10, sprintId: 100, taskType: "Bug", status: "QA Passed", severity: "Critical", assigneeIds: [2] },
          { id: 7, projectId: 10, sprintId: 99, taskType: "Bug", status: "Todo", severity: "Minor", assigneeIds: [3] },
          { id: 8, projectId: 10, sprintId: 100, taskType: "Dev Task", status: "QA Passed", percentCompleted: 100, assigneeIds: [1] }
        ],
        devLogs: [],
        blogs: [],
        auditEvents: [],
        lookups: [
          { id: 1, lookupType: "Status", value: "Todo", colorHex: "#126bff", displayOrder: 1, isActive: true },
          { id: 2, lookupType: "Status", value: "Ready for QA", colorHex: "#e4a53a", displayOrder: 2, isActive: true },
          { id: 3, lookupType: "Status", value: "Deployed in Prod", colorHex: "#2f9e44", displayOrder: 6, isActive: true },
          { id: 4, lookupType: "Status", value: "In Progress", colorHex: "#35c7bd", displayOrder: 2, isActive: true },
          { id: 5, lookupType: "Status", value: "Security Review", colorHex: "#9f9cff", displayOrder: 3, isActive: true },
          { id: 6, lookupType: "Status", value: "QA Passed", colorHex: "#74c476", displayOrder: 5, isActive: true }
        ],
        holidays: []
      })
    });
  });
}

function collectBrowserErrors(page) {
  const errors = [];
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", error => errors.push(error.message));
  return errors;
}

async function measureAboutHud(root) {
  return root.evaluate(element => {
    const rootRect = element.getBoundingClientRect();
    const statusRect = element.querySelector("[data-about-status]").getBoundingClientRect();
    const controlsRect = element.querySelector(".about-flight-controls").getBoundingClientRect();
    const modeRect = element.querySelector("[data-about-mode]").getBoundingClientRect();
    const overlaps = (first, second) => first.left < second.right
      && first.right > second.left
      && first.top < second.bottom
      && first.bottom > second.top;

    return {
      rootHeight: rootRect.height,
      statusTop: statusRect.top - rootRect.top,
      statusBottomGap: rootRect.bottom - statusRect.bottom,
      statusCenterOffset: (statusRect.left + statusRect.right) / 2
        - (rootRect.left + rootRect.right) / 2,
      controlsBottom: controlsRect.bottom - rootRect.top,
      modeBottom: modeRect.bottom - rootRect.top,
      overlapsControls: overlaps(statusRect, controlsRect),
      overlapsMode: overlaps(statusRect, modeRect)
    };
  });
}
