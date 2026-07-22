import { expect, test } from "@playwright/test";

test("About renders the drone flyby and supports camera takeover and speed keys", async ({ page }, testInfo) => {
  test.setTimeout(180000);
  const browserErrors = collectBrowserErrors(page);
  await prepareAboutPage(page);
  await page.goto("/");

  const root = page.locator("[data-about-flight]");
  const canvas = page.locator("[data-about-canvas]");
  const intro = page.locator("[data-about-intro]");
  const mode = page.locator("[data-about-mode]");
  const status = page.locator("[data-about-status]");
  const controls = page.locator(".about-flight-controls");
  const controlHintsTrigger = page.locator("[data-about-control-hints-button]");
  const flightDebug = page.locator("[data-about-flight-debug]");
  const alienNotice = page.locator("[data-about-alien-notice]");

  await expect(root).toBeVisible();
  await expect(intro.locator("img")).toHaveAttribute("src", /pmt-logo-full\.svg/);
  await expect(page.locator("[data-about-intro-countdown]")).toContainText("3D flight begins in");
  const introSpacing = await root.evaluate(element => {
    const footer = element.querySelector("[data-about-footer]").getBoundingClientRect();
    const preparing = element.querySelector("[data-about-flight-debug]").getBoundingClientRect();
    return { footerBottom: footer.bottom, preparingTop: preparing.top };
  });
  expect(introSpacing.footerBottom).toBeLessThan(introSpacing.preparingTop);
  await expect(root).toHaveClass(/about-flight-started/, { timeout: 30000 });
  await expect(intro).toBeHidden();
  await expect(mode).toHaveText("AUTO 2x");
  await expect(root).toHaveAttribute("data-about-workload-billboard", "ready");
  await expect(root).toHaveAttribute("data-about-workload-style", "dev-and-bug-charts");
  await expect(root).toHaveAttribute(
    "data-about-gallery-section-labels",
    "Development Tasks|Bug Tracking|Development Team|Documentation|Kanban Board"
  );
  await expect(root).toHaveAttribute("data-about-dev-gallery-label", "Development Tasks");
  await expect(root).toHaveAttribute("data-about-bug-gallery-label", "Bug Tracking");
  await expect(root).toHaveAttribute("data-about-team-gallery-label", "Development Team");
  await expect(root).toHaveAttribute("data-about-documentation-gallery-label", "Documentation");
  await expect(root).toHaveAttribute("data-about-kanban-gallery-label", "Kanban Board");
  await expect(root).toHaveAttribute("data-about-documentation-card-count", "0");
  await expect(root).toHaveAttribute("data-about-documentation-card-limit", "20");
  await expect(root).toHaveAttribute("data-about-documentation-grid", "1x1");
  await expect(root).toHaveAttribute("data-about-documentation-grid-z", "40");
  await expect(root).toHaveAttribute("data-about-documentation-grid-rotation-degrees", "180");
  await expect(root).toHaveAttribute("data-about-documentation-facing-target", "pmt-logo");
  await expect(root).toHaveAttribute("data-about-documentation-flight-path-status", "revised-sequence-4-random-card");
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
  await expect(root).toHaveAttribute("data-about-kanban-column-count", "5");
  await expect(root).toHaveAttribute("data-about-kanban-task-count", "5");
  await expect(root).toHaveAttribute("data-about-kanban-growth-direction", "away-from-development-team");
  await expect(root).toHaveAttribute("data-about-kanban-dynamic-columns", "live-status-derived");
  await expect(root).toHaveAttribute("data-about-kanban-card-style", "real-board-card-parity");
  await expect(root).toHaveAttribute("data-about-kanban-card-avatars", "live-user-avatar-stack");
  await expect(root).toHaveAttribute("data-about-kanban-visible-task-cards-per-column", "4");
  await expect(root).toHaveAttribute("data-about-logo-grounded", "true");
  await expect(root).toHaveAttribute("data-about-star-particles", "fixed-distant-world-space");
  await expect(root).toHaveAttribute("data-about-shooting-stars", "removed");
  await expect(root).toHaveAttribute("data-about-galaxy-background", "fixed-world-space");
  await expect(root).toHaveAttribute("data-about-comet-portal-exit", "enabled");
  await expect(root).toHaveAttribute("data-about-comet-schedule", "random-background");
  await expect(root).toHaveAttribute("data-about-comet-camera-influence", "none");
  await expect(root).toHaveAttribute("data-about-comet-active", "false");
  await expect(root).toHaveAttribute(
    "data-about-cinematic-events",
    "sequences-5-through-7-logo-approach-ufo-and-space-battle"
  );
  await expect(root).toHaveAttribute("data-about-ufo-enabled", "true");
  await expect(root).toHaveAttribute("data-about-ufo-schedule", "sequences-5-through-7-logo-approach");
  await expect(root).toHaveAttribute("data-about-automatic-alien-event-start-sequence", "5");
  await expect(root).toHaveAttribute("data-about-ufo-camera-tracking", "false");
  await expect(root).toHaveAttribute("data-about-ufo-camera-influence", "auto-logo-focus");
  await expect(root).toHaveAttribute("data-about-ufo-automatic-playback", "full-background-animation");
  await expect(root).toHaveAttribute(
    "data-about-ufo-departure-completion",
    "finish-before-hide-even-after-lightning"
  );
  await expect(root).toHaveAttribute("data-about-ufo-departure-draining", "false");
  await expect(root).toHaveAttribute("data-about-intergalactic-battle", "automatic-and-manual");
  await expect(root).toHaveAttribute("data-about-intergalactic-battle-active", "false");
  await expect(root).toHaveAttribute("data-about-battle-interceptor-range", "1-3");
  await expect(root).toHaveAttribute("data-about-battle-interceptor-count", "0");
  await expect(root).toHaveAttribute("data-about-battle-phase", "idle");
  await expect(root).toHaveAttribute("data-about-battle-ship-departure", "animated-complete-exit");
  await expect(root).toHaveAttribute("data-about-battle-original-ufo-return-fire", "true");
  await expect(root).toHaveAttribute("data-about-battle-interceptor-ship-style", "original-ufo-color-variants");
  await expect(root).toHaveAttribute("data-about-battle-stun-effect", "ship-wobble-only-no-electric-lines");
  await expect(root).toHaveAttribute("data-about-battle-camera-influence", "auto-logo-focus");
  await expect(root).toHaveAttribute(
    "data-about-battle-picture-in-picture",
    "visibility-driven-lower-right"
  );
  await expect(root).toHaveAttribute(
    "data-about-battle-picture-in-picture-camera",
    "pmt-logo-centered-battle-variant-slow-orbit"
  );
  await expect(root).toHaveAttribute("data-about-battle-picture-in-picture-ship-tracking", "none");
  await expect(root).toHaveAttribute(
    "data-about-battle-picture-in-picture-hide-rule",
    "hide-when-no-ufo-visible-in-feed"
  );
  await expect(root).toHaveAttribute("data-about-battle-picture-in-picture-render-layer", "battle-only");
  await expect(root).toHaveAttribute(
    "data-about-battle-picture-in-picture-frame-shape",
    "rectangular-clean-matched-render-area"
  );
  await expect(root).toHaveAttribute("data-about-battle-picture-in-picture-reference", "pmt-logo");
  await expect(root).toHaveAttribute("data-about-battle-picture-in-picture-grace-seconds", "5");
  await expect(root).toHaveAttribute("data-about-battle-picture-in-picture-enabled", "false");
  await expect(root).toHaveAttribute("data-about-automatic-battles-enabled", "true");
  await expect(root).toHaveAttribute("data-about-alien-battle-default", "automatic-interceptions");
  await expect(root).toHaveAttribute("data-about-alien-camera-override", "toggleable-auto-only-pmt-logo-focus");
  await expect(root).toHaveAttribute("data-about-alien-camera-override-active", "false");
  await expect(root).toHaveAttribute("data-about-alien-camera-override-target", "pmt-logo");
  await expect(root).toHaveAttribute("data-about-alien-camera-return", "smooth-normal-flyby");
  await expect(root).toHaveAttribute("data-about-battle-picture-in-picture-active", "false");
  await expect(root).toHaveAttribute("data-about-battle-picture-in-picture-runtime-error", "");
  await expect(root).toHaveAttribute(
    "data-about-battle-event-collision-policy",
    "preserve-active-battle-no-ufo-restart"
  );
  await expect(root).toHaveAttribute("data-about-battle-dialogue-style", "destination-panel-dark-with-speaker-outline");
  await expect(root).toHaveAttribute(
    "data-about-battle-dialogue-visibility",
    "always-on-screen-while-battle-active"
  );
  await expect(root).toHaveAttribute("data-about-battle-dialogue-camera-visibility", "independent");
  await expect(root).toHaveAttribute(
    "data-about-battle-dialogue-persistence",
    "all-lines-until-battle-complete"
  );
  await expect(root).toHaveAttribute("data-about-battle-dialogue-linger-seconds", "7");
  await expect(root).toHaveAttribute("data-about-battle-dialogue-lingering", "false");
  await expect(root).toHaveAttribute("data-about-battle-runtime-error", "");
  await expect(root).toHaveAttribute("data-about-animation-runtime-error", "");
  await expect(page.locator("[data-about-battle-pip]")).toBeHidden();
  await expect(page.locator("[data-about-battle-dialogue]")).toBeHidden();
  await expect(root).toHaveAttribute("data-about-lightning-enabled", "true");
  await expect(root).toHaveAttribute("data-about-lightning-schedule", "sequences-5-through-7-logo-approach");
  await expect(root).toHaveAttribute("data-about-lightning-camera-influence", "none");
  await expect(root).toHaveAttribute("data-about-lightning-scene-flash", "dramatic");
  await expect(root).toHaveAttribute("data-about-lightning-ufo-strike", "random");
  await expect(root).toHaveAttribute("data-about-lightning-ufo-strike-chance", "0.5");
  await expect(root).toHaveAttribute("data-about-lightning-ufo-strike-planned", "false");
  await expect(root).toHaveAttribute("data-about-event-hotkeys", "A,L,C,U,R,M,T,0,P,G,1,2,3,4");
  await expect(root).toHaveAttribute("data-about-pong-launch-mode", "dedicated-scene-disposes-about-flyby");
  await expect(root).toHaveAttribute("data-about-alien-events-enabled", "true");
  await expect(root).toHaveAttribute("data-about-alien-events-toggle-key", "0");
  await expect(root).toHaveAttribute("data-about-battle-picture-in-picture-toggle-key", "P");
  await expect(root).toHaveAttribute("data-about-original-ufo-hotkey", "1");
  await expect(root).toHaveAttribute("data-about-original-ufo-automatic-battle", "suppressed");
  await expect(root).toHaveAttribute("data-about-battle-interceptor-hotkeys", "2:1,3:2,4:3");
  await expect(root).toHaveAttribute("data-about-preference-storage", "local-storage");
  await expect(root).toHaveAttribute("data-about-alien-events-preference-key", "pmt-about-alien-events-enabled");
  await expect(root).toHaveAttribute("data-about-track-alien-events-enabled", "true");
  await expect(root).toHaveAttribute("data-about-track-alien-events-toggle-key", "T");
  await expect(root).toHaveAttribute(
    "data-about-track-alien-events-preference-key",
    "pmt-about-track-alien-events-enabled"
  );
  await expect(root).toHaveAttribute("data-about-battle-picture-in-picture-preference-key", "pmt-about-battle-pip-enabled");
  await expect(root).toHaveAttribute("data-about-battle-hotkey", "M");
  await expect(root).toHaveAttribute("data-about-enter-event-reset", "clear-alien-presentations");
  await expect(root).toHaveAttribute("data-about-random-event-choices", "alien,lightning,comet");
  await expect(root).toHaveAttribute("data-about-event-camera-influence", "alien-auto-logo-focus-when-tracking-enabled");
  await expect(root).toHaveAttribute("data-about-animation-pause-scope", "flight-and-events");
  await expect(root).toHaveAttribute("data-about-alien-hotkey-lightning", "guaranteed");
  await expect(root).toHaveAttribute("data-about-alien-hotkey-strike-delay-seconds", "16");
  await expect(root).toHaveAttribute("data-about-alien-hotkey-strike-pending", "false");
  await expect(root).toHaveAttribute("data-about-initial-camera", "2d-logo-facing");
  await expect(root).toHaveAttribute(
    "data-about-flight-path",
    "initial-logo-p-hole-dev-bug-random-documentation-kanban-mt-gap-documentation-u-turn-initial"
  );
  await expect(root).toHaveAttribute("data-about-flight-direction", "forward-through-approved-sequences");
  await expect(root).toHaveAttribute("data-about-flight-profile", "approved-1-through-3-revised-4-through-7");
  await expect(root).toHaveAttribute("data-about-chart-inspection", "random-dev-then-random-bug");
  await expect(root).toHaveAttribute("data-about-pmt-portal-flyby", "once-per-sequence-cycle");
  await expect(root).toHaveAttribute("data-about-event-execution", "sequences-5-through-7-logo-approach-ufo-background");
  await expect(root).toHaveAttribute("data-about-event-heading-response", "1.4");
  await expect(root).toHaveAttribute("data-about-minimum-forward-look-dot", "0.342");
  await expect(root).toHaveAttribute("data-about-level-horizon-fallback", "true");
  await expect(root).toHaveAttribute("data-about-post-portal-targeting", "continuous-dev-target");
  await expect(root).toHaveAttribute("data-about-post-portal-transition", "horizontal-bearing-then-chart-elevation");
  await expect(root).toHaveAttribute("data-about-circular-flight-path", "removed");
  await expect(root).toHaveAttribute("data-about-unapproved-flight-logic", "disabled");
  await expect(root).toHaveAttribute("data-about-dev-selection-mode", "random");
  await expect(root).toHaveAttribute("data-about-bug-selection-mode", "random");
  await expect(root).toHaveAttribute("data-about-documentation-selection-mode", "random-card-per-cycle");
  await expect(root).toHaveAttribute("data-about-automatic-sequence-reset", "true");
  await expect(root).toHaveAttribute("data-about-approved-flyby-sequences", "1,2,3");
  await expect(root).toHaveAttribute("data-about-flight-test-mode", "review-sequences-4-through-7");
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
  await expect(root).toHaveAttribute("data-about-control-hints-layout", "compact-upper-left-list");
  await expect(root).toHaveAttribute("data-about-control-hints-height", "dynamic-content-no-scrollbar");
  await expect(root).toHaveAttribute("data-about-control-hints-automatic", "true");
  await expect(root).toHaveAttribute("data-about-control-hints-trigger", "click-question-mark");
  await expect(root).toHaveAttribute("data-about-control-hints-trigger-position", "lower-left");
  await expect(root).toHaveAttribute("data-about-initial-control-hints-after-sequence4", "false");
  await expect(root).toHaveAttribute("data-about-initial-control-hints-shown", "false");
  await expect(controlHintsTrigger).toBeVisible();
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
  await expect(root).toHaveAttribute("data-about-sequence4", "random-qa-to-random-documentation");
  await expect(root).toHaveAttribute("data-about-sequence5", "random-documentation-to-kanban");
  await expect(root).toHaveAttribute("data-about-sequence6", "kanban-to-behind-logo-through-mt-gap");
  await expect(root).toHaveAttribute("data-about-sequence7", "mt-gap-to-documentation-area-u-turn-to-sequence-1");
  await expect(root).toHaveAttribute("data-about-sequence7-documentation-behavior", "positioning-only-no-inspection");
  await expect(root).toHaveAttribute("data-about-sequence7-completion", "exact-sequence-1-start-pose");
  await expect(root).toHaveAttribute("data-about-sequence7-loop-transition", "continuous-no-camera-snap");
  await expect(root).toHaveAttribute("data-about-sequence7-loop-speed", "preserve-user-selected-speed");
  await expect(root).toHaveAttribute("data-about-sequence4-focus", "random-documentation");
  await expect(root).toHaveAttribute("data-about-gallery-return-duration-seconds", "72");
  await expect(root).toHaveAttribute("data-about-documentation-inspection", "sequence-4-continuous-forward-curve");
  await expect(root).toHaveAttribute("data-about-documentation-inspection-fov", "60");
  await expect(root).toHaveAttribute("data-about-documentation-inspection-attention", /^(0|0\.000)$/);
  await expect(root).toHaveAttribute("data-about-kanban-inspection-fov", "62");
  await expect(root).toHaveAttribute("data-about-mt-gap-target", /^-?\d+\.\d{3},-?\d+\.\d{3},-?\d+\.\d{3}$/);
  await expect(root).toHaveAttribute("data-about-mt-gap-path-compensation-x", "-0.317");
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
  await expect(root).toHaveAttribute("data-about-documentation-destination", /Documentation/);
  await expect(root).toHaveAttribute("data-about-documentation-destination-prepared", "true");
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

  if (await root.getAttribute("data-about-flight-test-mode") === "review-sequences-4-through-7") {
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
  await expect(page.locator("[data-about-mode]")).toHaveText("AUTO 2x", { timeout: 30000 });
  expect(browserErrors).toEqual([]);
});

test("About separates mouse look, keyboard manual mode, pause, and event hotkeys", async ({ page }) => {
  test.setTimeout(180000);
  const browserErrors = collectBrowserErrors(page);
  await prepareAboutPage(page);
  await page.goto("/");

  const root = page.locator("[data-about-flight]");
  const canvas = page.locator("[data-about-canvas]");
  const mode = page.locator("[data-about-mode]");
  const controls = page.locator(".about-flight-controls");
  const controlHintsTrigger = page.locator("[data-about-control-hints-button]");
  await expect(root).toHaveClass(/about-flight-started/, { timeout: 30000 });
  await expect(root).toHaveAttribute("data-flight-mode", "auto");
  await expect(root).toHaveAttribute("data-about-control-hints-visible", "false");

  const triggerPosition = await controlHintsTrigger.evaluate(element => {
    const root = element.closest("[data-about-flight]");
    const rootRect = root.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left - rootRect.left,
      bottom: rootRect.bottom - rect.bottom
    };
  });
  expect(triggerPosition.left).toBeLessThan(40);
  expect(triggerPosition.bottom).toBeLessThan(40);

  await controlHintsTrigger.click();
  await expect(root).toHaveAttribute("data-about-control-hints-visible", "true");
  await expect(controls).toBeVisible();
  await controlHintsTrigger.evaluate(element => element.blur());

  await page.keyboard.press("/");
  await expect(root).toHaveAttribute("data-about-control-hints-visible", "false");
  await expect(controls).toBeHidden();

  await page.keyboard.press("/");
  await expect(root).toHaveAttribute("data-about-control-hints-visible", "true");
  await expect(controls).toBeVisible();
  await expect(controls).toContainText("Hold left mouse");
  await expect(controls).toContainText("Alien + Lightning Strike");
  await expect(controls).toContainText("Show these hints");
  await expect(controls).toContainText("Intergalactic battle");
  await expect(controls).toContainText("Pong + Blocks game");
  await expect(controls).toContainText("Track Alien Events on / off");
  await expect(controls).toContainText("Alien events on / off");
  await expect(controls).toContainText("PIP on / off");
  await expect(controls).toContainText("Original UFO");
  await expect(controls).toContainText("1 attacker vs UFO");
  await expect(controls).toContainText("2 attackers vs UFO");
  await expect(controls).toContainText("3 attackers vs UFO");
  await expect(controls.locator(".about-flight-controls-title")).toHaveText("Controls");
  await expect(controls.locator(".about-control-hint")).toHaveCount(23);
  if (await root.getAttribute("data-about-control-hints-visible") !== "true") {
    await controlHintsTrigger.click();
    await expect(controls).toBeVisible();
  }
  const visibleControlsPanel = await controls.evaluate(element => {
    const root = element.closest("[data-about-flight]");
    if (root.dataset.aboutControlHintsVisible !== "true") {
      root.querySelector("[data-about-control-hints-button]")?.click();
    }
    const rootRect = root.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    const title = element.querySelector(".about-flight-controls-title");
    return {
      top: rect.top - rootRect.top,
      left: rect.left - rootRect.left,
      width: rect.width,
      height: rect.height,
      titleAlignment: getComputedStyle(title).textAlign
    };
  });
  expect(visibleControlsPanel.top).toBeLessThan(40);
  expect(visibleControlsPanel.left).toBeLessThan(40);
  expect(visibleControlsPanel.width).toBeGreaterThan(280);
  expect(visibleControlsPanel.width).toBeLessThan(430);
  expect(visibleControlsPanel.height).toBeGreaterThan(160);
  expect(visibleControlsPanel.height).toBeLessThan(460);
  expect(visibleControlsPanel.titleAlignment).toBe("center");
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
  await page.keyboard.press("/");
  await expect(root).toHaveAttribute("data-about-control-hints-visible", "false");
  await expect(controls).toBeHidden();

  await mode.click();
  await expect(root).toHaveAttribute("data-flight-mode", "returning");
  if ((page.viewportSize()?.width || 0) >= 1920) {
    await page.keyboard.press("Enter");
    await expect(root).toHaveAttribute("data-flight-mode", "auto");
  } else {
    await expect(root).toHaveAttribute("data-flight-mode", "auto", { timeout: 30000 });
  }

  await page.keyboard.press("Space");
  await expect(root).toHaveAttribute("data-flight-mode", "paused");
  await page.keyboard.press("Space");
  await expect(root).toHaveAttribute("data-flight-mode", "auto");

  await page.keyboard.press("0");
  await expect(root).toHaveAttribute("data-about-alien-events-enabled", "false");
  expect(await page.evaluate(() => localStorage.getItem("pmt-about-alien-events-enabled"))).toBe("false");
  await page.keyboard.press("0");
  await expect(root).toHaveAttribute("data-about-alien-events-enabled", "true");
  expect(await page.evaluate(() => localStorage.getItem("pmt-about-alien-events-enabled"))).toBe("true");
  await page.keyboard.press("p");
  await expect(root).toHaveAttribute("data-about-battle-picture-in-picture-enabled", "true");
  expect(await page.evaluate(() => localStorage.getItem("pmt-about-battle-pip-enabled"))).toBe("true");
  await page.keyboard.press("p");
  await expect(root).toHaveAttribute("data-about-battle-picture-in-picture-enabled", "false");
  expect(await page.evaluate(() => localStorage.getItem("pmt-about-battle-pip-enabled"))).toBe("false");

  await page.keyboard.press("1");
  await expect(root).toHaveAttribute("data-about-manual-event-last", "alien");
  await expect(root).toHaveAttribute("data-about-manual-event-source-key", "Digit1");
  await expect(root).toHaveAttribute("data-about-battle-forced-interceptor-count", "0");
  await page.keyboard.press("2");
  await expect(root).toHaveAttribute("data-about-manual-event-last", "battle");
  await expect(root).toHaveAttribute("data-about-manual-event-source-key", "Digit2");
  await expect(root).toHaveAttribute("data-about-battle-forced-interceptor-count", "1");

  await page.keyboard.press("u");
  await expect(root).toHaveAttribute("data-about-manual-event-last", "alien");
  await expect(root).toHaveAttribute("data-about-manual-event-count", "7");
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
  await expect(root).toHaveAttribute("data-about-manual-event-count", "11");
  await page.keyboard.press("m");
  await expect(root).toHaveAttribute("data-about-manual-event-last", "battle");
  await expect(root).toHaveAttribute("data-about-manual-event-source-key", "KeyM");
  await expect(root).toHaveAttribute("data-about-manual-event-count", "12");
  await expect(root).not.toHaveAttribute("data-about-battle-forced-interceptor-count", "0");

  await page.keyboard.press("Enter");
  await expect(root).toHaveAttribute("data-about-enter-event-reset-applied", "true");
  await expect(page.locator("[data-about-ufo-speech]")).toBeHidden();
  await expect(page.locator("[data-about-battle-dialogue]")).toBeHidden();
  await expect(root).toHaveAttribute("data-about-enter-restart-behavior", "reset-sequence-1-in-scene");
  await expect(root).toHaveAttribute("data-about-flight-sequence-stage", "dev");
  await expect(root).toHaveAttribute("data-flight-mode", "auto");
  await expect(page.locator("[data-about-intro]")).toBeHidden();
  await expect(page.locator("[data-about-canvas]")).toHaveCount(1);
  expect(browserErrors).toEqual([]);
});

test("About toggles Track Alien Events without changing the flight path or manual control", async ({ page }) => {
  test.setTimeout(60000);
  const browserErrors = collectBrowserErrors(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 0.5 });
  });
  await prepareAboutPage(page);
  await page.goto("/");

  const root = page.locator("[data-about-flight]");
  await expect(root).toHaveClass(/about-flight-started/, { timeout: 30000 });
  await expect(root).toHaveAttribute("data-flight-mode", "auto");
  await expect(root).toHaveAttribute("data-about-track-alien-events-enabled", "true");

  await page.keyboard.press("t");
  await expect(root).toHaveAttribute("data-about-track-alien-events-enabled", "false");
  expect(await page.evaluate(() => (
    localStorage.getItem("pmt-about-track-alien-events-enabled")
  ))).toBe("false");

  await page.keyboard.press("1");
  await expect(root).toHaveAttribute("data-about-manual-event-last", "alien");
  await expect(root).toHaveAttribute("data-about-ufo-manual-trigger-active", "true");
  await page.waitForTimeout(350);
  await expect(root).toHaveAttribute("data-about-alien-camera-override-active", "false");

  await page.keyboard.press("t");
  await expect(root).toHaveAttribute("data-about-track-alien-events-enabled", "true");
  expect(await page.evaluate(() => (
    localStorage.getItem("pmt-about-track-alien-events-enabled")
  ))).toBe("true");
  await expect(root).toHaveAttribute("data-about-alien-camera-override-active", "true", {
    timeout: 20000
  });
  await expect.poll(async () => Number(
    await root.getAttribute("data-about-alien-camera-logo-alignment")
  )).toBeGreaterThan(0.75);

  await page.keyboard.down("w");
  await page.keyboard.up("w");
  await expect(root).toHaveAttribute("data-flight-mode", "manual");
  await expect(root).toHaveAttribute("data-about-alien-camera-override-active", "false");

  await page.keyboard.press("Enter");
  await expect(root).toHaveAttribute("data-flight-mode", "auto");
  await expect(root).toHaveAttribute("data-about-alien-camera-override-active", "false");
  expect(browserErrors).toEqual([]);
});

test("About honors reduced motion with a still 3D scene", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await prepareAboutPage(page);
  await page.goto("/");

  const root = page.locator("[data-about-flight]");
  await expect(root).toHaveClass(/about-flight-started/, { timeout: 30000 });
  await expect(root).toHaveAttribute("data-flight-mode", "reduced");
  await expect(page.locator("[data-about-mode]")).toHaveText("STILL");
  await page.waitForTimeout(350);
  await expect(root).toHaveAttribute("data-flight-mode", "reduced");
  await expect(page.locator("[data-about-status]")).toContainText("Reduced motion");
  await expect(page.locator("[data-about-status]")).toBeHidden();
  expect(browserErrors).toEqual([]);
});

test("About schedules background UFO and lightning events for the PMT logo approach", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await prepareAboutPage(page);
  await page.goto("/");

  const root = page.locator("[data-about-flight]");
  const mode = page.locator("[data-about-mode]");
  const speech = page.locator("[data-about-ufo-speech]");

  await expect(root).toHaveClass(/about-flight-started/, { timeout: 30000 });
  await expect(root).toHaveAttribute(
    "data-about-cinematic-events",
    "sequences-5-through-7-logo-approach-ufo-and-space-battle"
  );
  await expect(root).toHaveAttribute("data-about-ufo-enabled", "true");
  await expect(root).toHaveAttribute("data-about-ufo-schedule", "sequences-5-through-7-logo-approach");
  await expect(root).toHaveAttribute("data-about-automatic-alien-event-start-sequence", "5");
  await expect(root).toHaveAttribute("data-about-automatic-alien-window-active", "false");
  await expect(root).toHaveAttribute("data-about-ufo-camera-tracking", "false");
  await expect(root).toHaveAttribute("data-about-ufo-camera-influence", "auto-logo-focus");
  await expect(root).toHaveAttribute(
    "data-about-ufo-departure-completion",
    "finish-before-hide-even-after-lightning"
  );
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
  await page.goto("/");

  const root = page.locator("[data-about-flight]");
  await expect(root).toHaveClass(/about-flight-is-fallback/);
  await expect(root.locator(".about-intro-logo")).toBeVisible();
  await expect(root.locator(".about-intro-logo")).toHaveAttribute("src", /pmt-logo-full\.svg/);
  await expect(page.locator("[data-about-mode]")).toHaveText("SVG");
  await expect(page.locator("[data-about-fallback]")).toContainText("original PMT logo");
  expect(browserErrors).toEqual([]);
});

test("About launches Pong as a dedicated candy-polished scene", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await prepareAboutPage(page);
  await page.goto("/");

  const flight = page.locator("[data-about-flight]");
  await expect(flight).toHaveAttribute("data-about-pong-launch-mode", "dedicated-scene-disposes-about-flyby", {
    timeout: 30000
  });

  await page.keyboard.press("G");
  const pongRoot = page.locator("[data-about-pong-root]");
  const pong = page.locator("[data-about-pong-overlay]");
  await expect(pongRoot).toBeVisible();
  await expect(pong).toBeVisible();
  await expect(page.locator("[data-about-flight]")).toHaveCount(0);
  await expect(pongRoot).toHaveAttribute("data-about-pong-flyby-isolation", "dedicated-scene-no-about-flyby-renderer");
  await expect(pongRoot).toHaveAttribute("data-about-pong-candy-polish", "rounded-glossy-physical-materials");
  await expect(pong.locator("[data-about-pong-scoreboard]")).toContainText("Sin");

  const layout = await pong.evaluate(element => {
    const rules = element.querySelector(".about-pong-rules").getBoundingClientRect();
    const stage = element.querySelector(".about-pong-stage").getBoundingClientRect();
    const board = element.querySelector(".about-pong-board").getBoundingClientRect();
    return {
      rulesWidth: rules.width,
      stageWidth: stage.width,
      boardWidth: board.width
    };
  });
  expect(layout.stageWidth).toBeGreaterThan(layout.rulesWidth * 2);
  expect(layout.stageWidth).toBeGreaterThan(layout.boardWidth * 2);

  expect(browserErrors).toEqual([]);
});

test("idle screen saver preserves the current screen and unsaved editor state", async ({ page }) => {
  test.setTimeout(120000);
  await page.clock.install({ time: new Date("2026-07-14T12:00:00Z") });
  await prepareAboutPage(page, "Dashboard");
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  await page.evaluate(() => {
    const editor = document.getElementById("editorDialog");
    const body = document.getElementById("dialogBody");
    body.innerHTML = '<label>Unsaved title<input id="screenSaverUnsavedValue"></label>';
    editor.showModal();
    document.getElementById("screenSaverUnsavedValue").focus();
  });

  const editor = page.locator("#editorDialog");
  const input = page.locator("#screenSaverUnsavedValue");
  await input.fill("Keep this unsaved value");
  const originalUrl = page.url();
  const appBounds = await page.locator("#app").boundingBox();

  await page.clock.fastForward(4 * 60 * 1000);
  await page.keyboard.press("Shift");
  await page.clock.fastForward(4 * 60 * 1000);
  await expect(page.locator("[data-about-screensaver]")).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(document, "hasFocus", { configurable: true, value: () => false });
    window.dispatchEvent(new Event("blur"));
  });
  await page.clock.fastForward(10 * 60 * 1000);
  await expect(page.locator("[data-about-screensaver]")).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(document, "hasFocus", { configurable: true, value: () => true });
    window.dispatchEvent(new Event("focus"));
  });
  await page.clock.fastForward(5 * 60 * 1000);

  const screenSaver = page.locator("[data-about-screensaver]");
  await expect(screenSaver).toBeVisible();
  await expect(screenSaver).toHaveAttribute("data-about-screensaver-idle-ms", "300000");
  const screenSaverFlight = screenSaver.locator("[data-about-flight]");
  await expect(screenSaverFlight).toBeVisible();
  await expect(screenSaverFlight).toHaveClass(/about-flight-rendering/, { timeout: 30000 });
  await page.clock.fastForward(5 * 1000);
  await expect(screenSaverFlight).toHaveClass(/about-flight-started/, { timeout: 30000 });
  expect(page.url()).toBe(originalUrl);
  const screenSaverBounds = await screenSaver.boundingBox();
  expect(screenSaverBounds.x).toBeCloseTo(appBounds.x, 0);
  expect(screenSaverBounds.y).toBeCloseTo(appBounds.y, 0);
  expect(screenSaverBounds.width).toBeCloseTo(appBounds.width, 0);
  expect(screenSaverBounds.height).toBeCloseTo(appBounds.height, 0);

  await page.mouse.move(
    screenSaverBounds.x + screenSaverBounds.width / 2,
    screenSaverBounds.y + screenSaverBounds.height / 2
  );

  await expect(screenSaver).toHaveCount(0);
  await expect(editor).toBeVisible();
  await expect(input).toHaveValue("Keep this unsaved value");
  await expect(input).toBeFocused();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  expect(page.url()).toBe(originalUrl);
});

async function prepareAboutPage(page, initialView = "About") {
  await page.addInitScript(view => {
    localStorage.clear();
    localStorage.setItem("pmt-view", view);
    localStorage.setItem("pmt-task-project", "10");
    localStorage.setItem("pmt-task-sprint", "101");
    localStorage.setItem("pmt-bug-filters", JSON.stringify({ projectId: "10", sprintId: "all" }));
    localStorage.setItem("pmt-release-notes-last-seen:1", "2026-07-22-day-35@3cc33b8c7408");
  }, initialView);

  await page.route("**/api/session", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        userId: 1,
        nickname: "Sin",
        isAdmin: true,
        role: "Admin",
        originalUserId: 1,
        originalUserName: "Sin",
        isImpersonating: false,
        impersonatedUserName: ""
      })
    });
  });

  await page.route("**/api/game-scores/about-pong-blocks**", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: 1,
          gameKey: "about-pong-blocks",
          playerUserId: 1,
          playerName: "Sin",
          score: 12345,
          durationSeconds: 188,
          won: true,
          createdAt: "2026-07-21T00:00:00Z"
        }
      ])
    });
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
