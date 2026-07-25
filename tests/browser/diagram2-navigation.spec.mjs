import { expect, test } from "@playwright/test";
import {
  buildAnnotationSvg,
  normalizeAnnotationState
} from "../../wwwroot/js/components/image-annotation.js";
import { releaseNotes } from "../../wwwroot/js/shared/release-notes-data.js";

test.use({ timezoneId: "Asia/Taipei" });

test("Diagram 2 top navigation opens the isolated shell", async ({ page }) => {
  const browserErrors = [];
  page.on("console", message => {
    if (message.type() === "error" && !message.text().includes("status of 401")) browserErrors.push(message.text());
  });
  page.on("pageerror", error => browserErrors.push(error.message));

  await page.addInitScript(seenToken => {
    localStorage.clear();
    localStorage.setItem("pmt-release-notes-last-seen:1", seenToken);
  }, releaseNotes[0].seenToken);

  await page.route("**/api/session", route => route.fulfill(jsonResponse({ error: "Unauthorized" }, 401)));
  await page.route("**/api/login", route => route.fulfill(jsonResponse({
    userId: 1,
    nickname: "Sin",
    isAdmin: true,
    role: "Admin"
  })));
  await page.route("**/api/state", route => route.fulfill(jsonResponse(testState())));
  await page.route("**/api/audit-trail", route => route.fulfill(jsonResponse([])));
  await page.route("**/api/maintenance/recycle-bin", route => route.fulfill(jsonResponse([])));
  await page.route("**/api/maintenance/orphan-files", route => route.fulfill(jsonResponse({
    files: [],
    totalCount: 0,
    totalByteLength: 0
  })));

  await page.goto("/");
  await page.locator("#loginName").fill("Sin");
  await page.locator("#loginPassword").fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();

  await openNavigationScreen(page, "Diagram");
  await expect(page).toHaveURL(/#\/diagram$/);
  await expect(page.locator(".diagram-screen")).toBeVisible();

  await openNavigationScreen(page, "Diagram 2");
  await expect(page).toHaveURL(/#\/diagram-2$/);
  await expect(page.locator("[data-diagram2-screen]")).toBeVisible();
  await expect(page.locator("[data-diagram2-screen] h1")).toHaveText("Diagram 2");
  await expect(page.locator("[data-diagram2-header]")).toContainText("Diagram 2 Beta");
  await expect(page.locator("[data-diagram2-tree] [data-action='select-diagram2-document']")).toHaveCount(2);
  await expect(page.locator("[data-diagram2-viewer-host] h2")).toHaveText("PMT Database Schema");
  await expect(page.locator("[data-diagram2-viewer-host]")).toContainText("Editing stays disabled in Diagram 2.");
  await expect(page.locator("[data-diagram2-svg]")).toBeVisible();
  await expect.poll(async () =>
    page.locator("[data-diagram2-object-plane] [data-diagram2-object-type='entity']").count()
  ).toBeGreaterThanOrEqual(28);
  await expect(page.locator("[data-diagram2-diagnostic='canonical-object-count']")).toHaveText("88");
  await expect(page.locator("[data-diagram2-diagnostic='canonical-relationship-count']")).toHaveText("82");
  await expect(page.locator("[data-diagram2-diagnostic='mounted-relationship-count']")).toHaveText("82");
  await expect(page.locator("[data-diagram2-diagnostic='full-render-reason']")).toHaveText("initial");
  await expect.poll(async () => Number(await page.locator("[data-diagram2-diagnostic='svg-descendant-count']").textContent()))
    .toBeGreaterThan(0);

  await page.evaluate(() => {
    window.__diagram2StableSvg = document.querySelector("[data-diagram2-svg]");
  });
  await page.getByRole("button", { name: "Fit Diagram" }).click();
  await expect.poll(() =>
    page.evaluate(() => document.querySelector("[data-diagram2-svg]") === window.__diagram2StableSvg)
  ).toBe(true);
  await page.getByRole("button", { name: "Refresh Renderer" }).click();
  await expect.poll(() =>
    page.evaluate(() => document.querySelector("[data-diagram2-svg]") === window.__diagram2StableSvg)
  ).toBe(true);
  await expect(page.locator("[data-diagram2-diagnostic='full-render-reason']")).toHaveText("refresh");
  await expect(page.locator("[data-action='diagram2-import-probe']")).toBeDisabled();
  await expect(page.locator(".diagram-screen")).toHaveCount(0);

  await page.goBack();
  await expect(page).toHaveURL(/#\/diagram$/);
  await expect(page.locator(".diagram-screen")).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/#\/diagram-2$/);
  await expect(page.locator("[data-diagram2-screen]")).toBeVisible();
  await expect(page.locator(".diagram-screen")).toHaveCount(0);

  await page.locator("[data-action='select-diagram2-document'][data-id='77']").click();
  await expect(page).toHaveURL(/#\/diagram-2\/77$/);
  await expect(page.locator("[data-diagram2-viewer-host] h2")).toHaveText("Checkout Flow");
  await expect(page.locator("[data-diagram2-tree-row][data-id='77']")).toHaveClass(/is-selected/);
  await expect(page.locator(".diagram-screen")).toHaveCount(0);

  await page.evaluate(() => {
    window.location.hash = "#/diagram-2/42";
  });
  await expect(page).toHaveURL(/#\/diagram-2\/42$/);
  await expect(page.locator("[data-diagram2-screen]")).toBeVisible();
  await expect(page.locator("[data-diagram2-viewer-host] h2")).toHaveText("PMT Database Schema");
  await expect(page.locator(".diagram-screen")).toHaveCount(0);

  await openNavigationScreen(page, "Settings");
  await page.locator("[data-action='select-lookup-type'][data-type='Navigation']").click();
  await expect(page.locator("[data-navigation-list] [data-nav-view='Diagram 2']")).toContainText("#/diagram-2");

  expect(browserErrors).toEqual([]);
});

async function openNavigationScreen(page, view) {
  const primaryButton = page.locator(`#nav > button.nav-item[data-view='${view}']`);
  if (await primaryButton.isVisible().catch(() => false)) {
    await primaryButton.click();
    return;
  }

  await page.locator(".nav-overflow-toggle").click();
  await page.locator(`.nav-overflow-menu button[data-view='${view}']`).click();
}

function testState() {
  return {
    users: [{
      id: 1,
      nickname: "Sin",
      email: "sin@example.test",
      role: "Admin",
      roleCode: "Admin",
      isAdmin: true,
      isActive: true,
      avatarUrl: ""
    }],
    projects: [{ id: 1, code: "PMT", title: "Diagram 2 Test", name: "Diagram 2 Test", isActive: true }],
    sprints: [],
    tasks: [],
    devLogs: [],
    blogs: [{
      id: 42,
      title: "PMT Database Schema",
      isPrivate: false,
      createdByUserId: 1,
      updatedByUserId: 1,
      projectId: 1,
      sprintId: null,
      createdAt: "2026-07-24T10:00:00Z",
      updatedAt: "2026-07-25T12:00:00Z",
      bodyHtml: pmtDatabaseSchemaBodyHtml()
    }, {
      id: 77,
      title: "Checkout Flow",
      isPrivate: true,
      createdByUserId: 1,
      updatedByUserId: 1,
      projectId: 1,
      sprintId: null,
      createdAt: "2026-07-24T09:00:00Z",
      updatedAt: "2026-07-25T11:00:00Z",
      bodyHtml: diagramBodyHtml("Checkout Flow", "#22c55e")
    }],
    auditEvents: [],
    lookups: [{
      id: 1,
      lookupType: "Release Type",
      value: "Internal",
      displayOrder: 10,
      isActive: true
    }],
    roles: [{
      id: 1,
      lookupType: "Role",
      value: "Admin",
      code: "Admin",
      displayOrder: 10,
      isActive: true
    }],
    holidays: [],
    securityResources: [],
    rolePermissions: [],
    userPermissions: [],
    effectivePermissions: []
  };
}

function pmtDatabaseSchemaBodyHtml() {
  return `<p><img data-pmt-diagram="true" data-pmt-private-diagram="true" src="/assets/docs/pmt-database-schema.svg?v=20260725-diagram2-day6-fixture" alt="PMT Database Schema"></p>`;
}

function diagramBodyHtml(title, stroke) {
  const state = normalizeAnnotationState({
    width: 640,
    height: 360,
    objects: [{
      id: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-box`,
      type: "rectangle",
      x: 120,
      y: 96,
      width: 280,
      height: 120,
      fill: "#ffffff",
      stroke,
      strokeWidth: 3
    }, {
      id: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-label`,
      type: "textbox",
      x: 150,
      y: 132,
      width: 220,
      height: 58,
      text: title,
      fontSize: 24,
      textColor: "#172b4d"
    }]
  });
  const svg = buildAnnotationSvg(state);
  const source = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
  return `<p><img data-pmt-diagram="true" data-pmt-private-diagram="true" src="${source}" alt="${title}"></p>`;
}

function jsonResponse(data, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(data)
  };
}
