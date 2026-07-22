import { expect, test } from "@playwright/test";

test("cookie session impersonation isolates preferences and records the Settings Audit Trail", async ({ page, context }) => {
  const admin = user(1, "Louiery", "Sincioco", "Sin", "Admin", true);
  const qa = user(2, "Quality", "Assurance", "QA", "QA", false);
  let session = null;
  let startRequests = 0;
  let stopRequests = 0;
  let auditRequests = 0;
  const identityHeaders = [];
  const sessionCookies = [];
  const auditEvents = [];

  await page.addInitScript(() => {
    if (sessionStorage.getItem("pmt-test-preferences-initialized")) return;
    sessionStorage.setItem("pmt-test-preferences-initialized", "true");
    localStorage.clear();
    localStorage.setItem("pmt-auth-user", "999");
    localStorage.setItem("pmt-theme", "dark");
    localStorage.setItem("pmt-task-project", "10");
    localStorage.setItem("pmt-release-notes-last-seen:1", "2026-07-22-day-35@25009a8e2332");
  });

  await page.route("**/api/session", async route => {
    recordIdentity(route, identityHeaders);
    sessionCookies.push(route.request().headers().cookie || "");
    if (!session) {
      await route.fulfill(jsonResponse({ error: "Unauthorized" }, 401));
      return;
    }
    await route.fulfill(jsonResponse(session));
  });

  await page.route("**/api/login", async route => {
    recordIdentity(route, identityHeaders);
    expect(route.request().postDataJSON()).toEqual({ login: "Sin", password: "Password1" });
    session = sessionPayload(admin);
    await route.fulfill(jsonResponse(session, 200, {
      "Set-Cookie": "PMT.Auth=admin-session; Path=/; HttpOnly; SameSite=Strict"
    }));
  });

  await page.route("**/api/impersonation/start", async route => {
    recordIdentity(route, identityHeaders);
    startRequests += 1;
    expect(route.request().postDataJSON()).toEqual({ userId: qa.id });
    session = sessionPayload(qa, admin);
    auditEvents.unshift(auditEvent({
      id: 101,
      action: "Impersonation Started",
      details: "Sin started impersonating QA.",
      actor: admin,
      actingAs: qa,
      createdAt: "2026-07-16T01:00:00Z"
    }));
    await route.fulfill(jsonResponse(session, 200, {
      "Set-Cookie": "PMT.Auth=impersonated-session; Path=/; HttpOnly; SameSite=Strict"
    }));
  });

  await page.route("**/api/impersonation/stop", async route => {
    recordIdentity(route, identityHeaders);
    stopRequests += 1;
    auditEvents.unshift(auditEvent({
      id: 102,
      action: "Impersonation Ended",
      details: "Sin stopped impersonating QA.",
      actor: admin,
      actingAs: qa,
      createdAt: "2026-07-16T01:05:00Z"
    }));
    session = sessionPayload(admin);
    await route.fulfill(jsonResponse(session, 200, {
      "Set-Cookie": "PMT.Auth=admin-session-restored; Path=/; HttpOnly; SameSite=Strict"
    }));
  });

  await page.route("**/api/state", async route => {
    recordIdentity(route, identityHeaders);
    await route.fulfill(jsonResponse(appState([admin, qa], session?.userId === qa.id)));
  });

  await page.route("**/api/audit-trail", async route => {
    recordIdentity(route, identityHeaders);
    auditRequests += 1;
    await route.fulfill(jsonResponse(auditEvents));
  });

  await page.goto("/#/settings/users");
  await expect(page.locator("#loginName")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("pmt-auth-user"))).toBeNull();

  await page.locator("#loginName").fill("Sin");
  await page.locator("#loginPassword").fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const authCookie = (await context.cookies()).find(cookie => cookie.name === "PMT.Auth");
  expect(authCookie).toMatchObject({ httpOnly: true, sameSite: "Strict" });

  const selfImpersonate = page.locator(`[data-action='impersonate-user'][data-id='${admin.id}']`);
  const qaImpersonate = page.locator(`[data-action='impersonate-user'][data-id='${qa.id}']`);
  await expect(selfImpersonate).toBeDisabled();
  await expect(qaImpersonate).toBeEnabled();

  await qaImpersonate.click();
  let confirmation = page.locator("dialog.mini-dialog");
  await expect(confirmation.getByRole("heading", { name: "Impersonate User" })).toBeVisible();
  await expect(confirmation).toContainText("Impersonate Quality Assurance?");
  await confirmation.getByRole("button", { name: "Cancel" }).click();
  expect(startRequests).toBe(0);

  await qaImpersonate.click();
  confirmation = page.locator("dialog.mini-dialog");
  await confirmation.getByRole("button", { name: "Continue" }).click();

  await expect(page.locator("#impersonationBanner")).toBeVisible();
  await expect(page.locator("#impersonationMessage")).toHaveText("Impersonating Quality Assurance.");
  await expect(page.locator("#exitImpersonation")).toBeVisible();
  await expect(page.locator("body")).toHaveClass(/has-impersonation-banner/);
  await expect(page.locator("#userMenuToggle")).toHaveAttribute("title", "QA menu");
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/#\/dashboard$/);
  expect(startRequests).toBe(1);

  const impersonatedWhatsNew = page.locator("#whatsNewDialog");
  await expect(impersonatedWhatsNew).toBeVisible();
  await impersonatedWhatsNew.locator("[data-action='close-whats-new']").last().click();
  await expect(impersonatedWhatsNew).toHaveCount(0);

  const isolatedPreferences = await page.evaluate(() => ({
    auth: localStorage.getItem("pmt-auth-user"),
    theme: localStorage.getItem("pmt-theme"),
    taskProject: localStorage.getItem("pmt-task-project"),
    backup: JSON.parse(localStorage.getItem("pmt-impersonation-admin-preferences") || "{}")
  }));
  expect(isolatedPreferences.auth).toBeNull();
  expect(isolatedPreferences.theme).toBeNull();
  expect(isolatedPreferences.taskProject).toBeNull();
  expect(isolatedPreferences.backup["pmt-theme"]).toBe("dark");
  expect(isolatedPreferences.backup["pmt-task-project"]).toBe("10");

  await page.locator("#userMenuToggle").click();
  await page.locator("#themeToggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => localStorage.getItem("pmt-theme"))).toBe("dark");
  await page.keyboard.press("Escape");
  await expect(page.locator("#userMenu")).toBeHidden();

  await page.goto("/#/settings/audit-trail");
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  await expect(page.locator("#impersonationBanner")).toBeVisible();
  await expect(page.locator("[data-action='select-lookup-type'][data-type='Audit Trail']")).toHaveCount(0);
  expect(auditRequests).toBe(0);

  await page.locator("#exitImpersonation").click();
  await expect(page.locator("#impersonationBanner")).toBeHidden();
  await expect(page.locator("#userMenuToggle")).toHaveAttribute("title", "Sin menu");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(stopRequests).toBe(1);

  const restoredPreferences = await page.evaluate(() => ({
    theme: localStorage.getItem("pmt-theme"),
    taskProject: localStorage.getItem("pmt-task-project"),
    backup: localStorage.getItem("pmt-impersonation-admin-preferences")
  }));
  expect(restoredPreferences).toEqual({ theme: "dark", taskProject: "10", backup: null });

  await page.goto("/#/settings/audit-trail");
  await expect(page.getByRole("heading", { name: "Audit Trail", exact: true })).toBeVisible();
  await expect(page.locator("[data-action='select-lookup-type'][data-type='Audit Trail']")).toHaveClass(/active/);
  const auditTable = page.locator(".settings-audit-trail-table");
  await expect(auditTable.locator("thead th")).toHaveText([
    "When",
    "Performed By",
    "Acting As",
    "Action",
    "Record",
    "Details"
  ]);
  await expect(auditTable.locator("tbody tr")).toHaveCount(2);
  const startedRow = auditTable.locator("tbody tr", { hasText: "Impersonation Started" });
  await expect(startedRow).toContainText("Sin");
  await expect(startedRow).toContainText("QA");
  await expect(startedRow).toContainText("Sin started impersonating QA.");
  const endedRow = auditTable.locator("tbody tr", { hasText: "Impersonation Ended" });
  await expect(endedRow).toContainText("Sin stopped impersonating QA.");

  await page.locator("[data-action='audit-trail-refresh']").click();
  await expect.poll(() => auditRequests).toBe(2);
  await expect(auditTable.locator("tbody tr")).toHaveCount(2);

  expect(identityHeaders).not.toContain("x-pmt-userid");
  expect(sessionCookies.some(cookie => cookie.includes("PMT.Auth=impersonated-session"))).toBe(true);
});

function user(id, firstName, lastName, nickname, role, isAdmin) {
  return {
    id,
    firstName,
    lastName,
    nickname,
    email: `${nickname.toLowerCase()}@example.test`,
    phone: "",
    avatarUrl: "/assets/avatar-default.svg",
    homePageUrl: "",
    socialMediaUrl: "",
    bio: `${role} test user.`,
    isAdmin,
    role,
    roleCode: role,
    isActive: true
  };
}

function sessionPayload(effectiveUser, originalUser = effectiveUser) {
  const impersonating = effectiveUser.id !== originalUser.id;
  return {
    userId: effectiveUser.id,
    nickname: effectiveUser.nickname,
    isAdmin: effectiveUser.isAdmin,
    role: effectiveUser.role,
    originalUserId: originalUser.id,
    originalUserName: originalUser.nickname,
    isImpersonating: impersonating,
    impersonatedUserName: impersonating ? effectiveUser.nickname : ""
  };
}

function appState(users, impersonating) {
  const permission = (resourceKey, canRead, noAccess = false) => ({
    resourceKey,
    canRead,
    canCreate: canRead,
    canUpdate: canRead,
    canDelete: false,
    canImport: false,
    canExport: false,
    noAccess
  });

  return {
    users,
    projects: [{ id: 10, code: "PMT", title: "Project Management Tool", isActive: true }],
    sprints: [],
    tasks: [],
    devLogs: [],
    blogs: [],
    auditEvents: [],
    lookups: [{ id: 1, lookupType: "Status", value: "Todo", displayOrder: 10, isActive: true }],
    roles: [
      { id: 1, lookupType: "Role", value: "Admin", code: "Admin", displayOrder: 10, isActive: true },
      { id: 2, lookupType: "Role", value: "QA - Quality Assurance", code: "QA", displayOrder: 20, isActive: true }
    ],
    holidays: [],
    securityResources: [
      { resourceKey: "Dashboard", resourceName: "Dashboard", displayOrder: 10 },
      { resourceKey: "Settings", resourceName: "Settings", displayOrder: 20 }
    ],
    rolePermissions: [],
    userPermissions: [],
    effectivePermissions: impersonating
      ? [permission("Dashboard", true), permission("Settings", false, true)]
      : []
  };
}

function auditEvent({ id, action, details, actor, actingAs, createdAt }) {
  return {
    id,
    entityType: "Impersonation",
    entityId: actingAs.id,
    action,
    details,
    oldStatus: "",
    newStatus: "",
    oldPercentCompleted: null,
    newPercentCompleted: null,
    userId: actingAs.id,
    actorUserId: actor.id,
    userName: actingAs.nickname,
    actorUserName: actor.nickname,
    createdAt
  };
}

function recordIdentity(route, identities) {
  Object.keys(route.request().headers()).forEach(name => identities.push(name.toLowerCase()));
}

function jsonResponse(data, status = 200, headers = {}) {
  return {
    status,
    contentType: "application/json",
    headers,
    body: JSON.stringify(data)
  };
}
