import { expect, test } from "@playwright/test";

test("About renders the drone flyby and supports camera takeover and speed keys", async ({ page }, testInfo) => {
  const browserErrors = collectBrowserErrors(page);
  await prepareAboutPage(page);
  await page.goto("/#/about");

  const root = page.locator("[data-about-flight]");
  const canvas = page.locator("[data-about-canvas]");
  const intro = page.locator("[data-about-intro]");
  const mode = page.locator("[data-about-mode]");
  const status = page.locator("[data-about-status]");
  const controls = page.locator(".about-flight-controls");

  await expect(root).toBeVisible();
  await expect(intro.locator("img")).toHaveAttribute("src", /pmt-logo-full\.svg/);
  await expect(page.locator("[data-about-intro-countdown]")).toContainText("3D flight begins in");
  await expect(root).toHaveClass(/about-flight-started/, { timeout: 15000 });
  await expect(intro).toBeHidden();
  await expect(mode).toHaveText("AUTO 1x");

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

  const screenshot = await root.screenshot();
  expect(screenshot.byteLength).toBeGreaterThan(30000);
  await testInfo.attach("about-3d-drone", { body: screenshot, contentType: "image/png" });

  await canvas.press("Shift+=");
  await expect(status).toContainText("1.25x speed");
  await expect(root).toHaveAttribute("data-flight-mode", "auto");
  await canvas.press("-");
  await expect(status).toContainText("1x speed");
  await canvas.press("Control+-");
  await expect(status).toContainText("1x speed");
  await expect(root).toHaveAttribute("data-flight-mode", "auto");
  await canvas.press("Control+0");

  await canvas.dispatchEvent("wheel", { deltaY: -180 });
  await expect(root).toHaveAttribute("data-flight-mode", "manual");
  await expect(status).toHaveText("Autopilot resumes in 5");
  await expect(status).toBeVisible();
  await expect(controls).toBeVisible();

  const desktopHud = await measureAboutHud(root);
  expect(desktopHud.statusBottomGap).toBeCloseTo(18, 1);
  expect(desktopHud.statusCenterOffset).toBeCloseTo(0, 1);
  expect(desktopHud.statusTop).toBeGreaterThan(desktopHud.rootHeight / 2);
  expect(desktopHud.overlapsControls).toBe(false);
  expect(desktopHud.overlapsMode).toBe(false);

  const originalViewport = page.viewportSize();
  await page.setViewportSize({ width: 630, height: 665 });
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
  await expect(page.locator("[data-about-mode]")).toHaveText("AUTO 1x", { timeout: 15000 });
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

test("About keeps the UFO in camera and shows its transmission", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await prepareAboutPage(page);
  await page.goto("/#/about");

  const root = page.locator("[data-about-flight]");
  const mode = page.locator("[data-about-mode]");
  const speech = page.locator("[data-about-ufo-speech]");

  await expect(root).toHaveClass(/about-flight-started/, { timeout: 15000 });
  await expect(mode).toHaveText("UFO TRACK", { timeout: 12000 });
  await expect(speech).toBeVisible({ timeout: 25000 });
  await expect(speech).toHaveText("Wow, JIRA + Confluence all-in-one? Such advanced civilization!");
  await expect(mode).toHaveText("UFO TRACK");
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
  });

  await page.route("**/api/state", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        users: [{
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
        }],
        projects: [],
        sprints: [],
        tasks: [],
        devLogs: [],
        blogs: [],
        auditEvents: [],
        lookups: [],
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
