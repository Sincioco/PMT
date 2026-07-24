import { expect, test } from "@playwright/test";
import { releaseNotes } from "../../wwwroot/js/shared/release-notes-data.js";

test.use({ locale: "en-US", timezoneId: "Asia/Taipei" });

test("Settings categories have shareable routes with browser history support", async ({ page }) => {
  await page.addInitScript(seenToken => {
    localStorage.clear();
    localStorage.setItem("pmt-release-notes-last-seen:1", seenToken);
  }, releaseNotes[0].seenToken);

  await page.route("**/api/login", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ userId: 1, nickname: "Sin", isAdmin: true, role: "Admin" })
    });
  });
  await page.route("**/api/state", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(testState())
    });
  });
  await page.route("**/api/audit-trail", async route => {
    await route.fulfill(jsonResponse([]));
  });
  await page.route("**/api/maintenance/recycle-bin", async route => {
    await route.fulfill(jsonResponse([]));
  });
  await page.route("**/api/maintenance/orphan-files", async route => {
    await route.fulfill(jsonResponse({ files: [], totalCount: 0, totalByteLength: 0 }));
  });

  await page.goto("/#/settings/security");
  await page.locator("#loginName").fill("Sin");
  await page.locator("#loginPassword").fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.locator("[data-action='select-lookup-type'][data-type='Security']")).toHaveClass(/active/);
  await expect(page).toHaveURL(/#\/settings\/security$/);

  await openNavigationScreen(page, "Tasks");
  await expect(page.getByRole("heading", { name: "Dev Tasks", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/#\/tasks$/);
  await page.goBack();
  await expect(page.locator("[data-action='select-lookup-type'][data-type='Security']")).toHaveClass(/active/);

  const categoryRoutes = [
    ["Users", "users"],
    ["Security", "security"],
    ["Audit Trail", "audit-trail"],
    ["Maintenance", "maintenance"],
    ["Navigation", "navigation"],
    ["Holidays", "holidays"],
    ["Environment", "environment"],
    ["LogCategory", "log-categories"],
    ["Priority", "priority"],
    ["Role", "roles"],
    ["Severity", "severity"],
    ["Status", "status"],
    ["Release Type", "release-type"],
    ["Development", "development"]
  ];

  for (const [category, route] of categoryRoutes) {
    const button = page.locator(`[data-action='select-lookup-type'][data-type='${category}']`);
    await button.click();
    await expect(button).toHaveClass(/active/);
    await expect(page).toHaveURL(new RegExp(`#\\/settings\\/${route}$`));
  }

  await page.locator("[data-action='select-lookup-type'][data-type='Navigation']").click();
  await expect(page.locator("[data-navigation-list] [data-nav-view='Tasks']")).toContainText("#/tasks");
  await expect(page.locator("[data-navigation-list] [data-nav-view='Settings']")).toContainText("#/settings");
  await page.locator("[data-action='select-lookup-type'][data-type='Security']").click();

  await page.goBack();
  await expect(page).toHaveURL(/#\/settings\/navigation$/);
  await expect(page.locator("[data-action='select-lookup-type'][data-type='Navigation']")).toHaveClass(/active/);

  await page.goForward();
  await expect(page).toHaveURL(/#\/settings\/security$/);
  await expect(page.locator("[data-action='select-lookup-type'][data-type='Security']")).toHaveClass(/active/);

  await page.goto("/#/settings/log-categories");
  await expect(page.locator("[data-action='select-lookup-type'][data-type='LogCategory']")).toHaveClass(/active/);

  await page.goto("/#/settings");
  await expect(page).toHaveURL(/#\/settings$/);
  await expect(page.locator("[data-action='select-lookup-type'][data-type='LogCategory']")).toHaveClass(/active/);
});

test("non-admin direct routes do not expose Admin-only Settings categories", async ({ page }) => {
  let maintenanceRequests = 0;
  await page.addInitScript(seenToken => {
    localStorage.clear();
    localStorage.setItem("pmt-release-notes-last-seen:2", seenToken);
  }, releaseNotes[0].seenToken);
  await page.route("**/api/login", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ userId: 2, nickname: "QA", isAdmin: false, role: "QA" })
    });
  });
  await page.route("**/api/state", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(testState({ isAdmin: false }))
    });
  });
  await page.route("**/api/maintenance/**", async route => {
    maintenanceRequests += 1;
    await route.fulfill(jsonResponse([]));
  });

  await page.goto("/#/settings/security");
  await page.locator("#loginName").fill("QA");
  await page.locator("#loginPassword").fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();

  await expect(page.locator("[data-action='select-lookup-type'][data-type='Security']")).toHaveCount(0);
  await expect(page.locator("[data-action='select-lookup-type'][data-type='Audit Trail']")).toHaveCount(0);
  await expect(page.locator("[data-action='select-lookup-type'][data-type='Maintenance']")).toHaveCount(0);
  await expect(page.locator("[data-action='select-lookup-type'][data-type='Status']")).toHaveClass(/active/);
  await expect(page).toHaveURL(/#\/settings\/status$/);

  await page.goto("/#/settings/maintenance");
  await expect(page.locator("[data-action='select-lookup-type'][data-type='Maintenance']")).toHaveCount(0);
  await expect(page.locator("[data-action='select-lookup-type'][data-type='Status']")).toHaveClass(/active/);
  await expect(page).toHaveURL(/#\/settings\/status$/);
  expect(maintenanceRequests).toBe(0);
});

test("Settings user cards show the last login and preserve an administrator's configured role", async ({ page }) => {
  await page.addInitScript(seenToken => {
    localStorage.clear();
    localStorage.setItem("pmt-release-notes-last-seen:1", seenToken);
  }, releaseNotes[0].seenToken);

  const appState = testState();
  Object.assign(appState.users[0], {
    firstName: "Louiery",
    lastName: "Sincioco",
    role: "PM",
    lastLoginAt: "2026-07-15T06:30:00Z"
  });
  appState.roles = [{
    id: 1,
    lookupType: "Role",
    value: "PM - Project Manager",
    code: "PM",
    displayOrder: 10,
    isActive: true
  }];

  await page.route("**/api/login", async route => {
    await route.fulfill(jsonResponse({ userId: 1, nickname: "Sin", isAdmin: true, role: "PM" }));
  });
  await page.route("**/api/state", async route => {
    await route.fulfill(jsonResponse(appState));
  });

  await page.goto("/#/settings/users");
  await page.locator("#loginName").fill("Sin");
  await page.locator("#loginPassword").fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();

  const userCard = page.locator(".settings-user-card");
  await expect(userCard.locator(".settings-user-title")).toHaveText("PM - Project Manager (Admin)");
  await expect(userCard.locator(".settings-user-last-login")).toHaveText("Last login: 7/15/2026, 2:30:00 PM");
});

async function openNavigationScreen(page, view) {
  const directButton = page.locator(`#nav > button[data-view='${view}']`);
  if (await directButton.isVisible()) {
    await directButton.click();
    return;
  }

  await page.locator(".nav-overflow-toggle").click();
  await page.locator(`.nav-overflow-menu button[data-view='${view}']`).click();
}

function testState({ isAdmin = true } = {}) {
  const userId = isAdmin ? 1 : 2;
  return {
    users: [{
      id: userId,
      nickname: isAdmin ? "Sin" : "QA",
      email: isAdmin ? "sin@example.test" : "qa@example.test",
      role: isAdmin ? "Admin" : "QA",
      roleCode: isAdmin ? "Admin" : "QA",
      isAdmin,
      isActive: true,
      avatarUrl: ""
    }],
    projects: [{ id: 1, code: "PMT", name: "Routing Test", isActive: true }],
    sprints: [],
    tasks: [],
    devLogs: [],
    blogs: [],
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
      value: isAdmin ? "Admin" : "QA - Quality Assurance",
      code: isAdmin ? "Admin" : "QA",
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

function jsonResponse(data, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(data)
  };
}
