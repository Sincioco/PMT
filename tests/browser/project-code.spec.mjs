import { expect, test } from "@playwright/test";

test("Admin can confirm reuse of an archived project code without changing the requested code", async ({ page }) => {
  const saveRequests = [];

  await page.addInitScript(() => localStorage.clear());
  await page.route("**/api/login", async route => {
    await route.fulfill(jsonResponse({
      userId: 1,
      nickname: "Sin",
      isAdmin: true,
      role: "Admin"
    }));
  });
  await page.route("**/api/state", async route => {
    await route.fulfill(jsonResponse(testState()));
  });
  await page.route("**/api/projects", async route => {
    const payload = route.request().postDataJSON();
    saveRequests.push(payload);

    if (saveRequests.length === 1) {
      await route.fulfill(jsonResponse({
        error: "Project code PMT belongs to a deleted project.",
        code: "archived-project-code"
      }, 409));
      return;
    }

    await route.fulfill(jsonResponse({ id: 20 }));
  });

  await page.goto("/#/projects");
  await page.locator("#loginName").fill("Sin");
  await page.locator("#loginPassword").fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "New Project" }).click();
  const editor = page.locator("#editorDialog");
  await editor.locator("[name='code']").fill("PMT");
  await editor.locator("[name='title']").fill("Project Management Tool");
  await editor.locator("[name='memberIds'][value='1']").check();
  await editor.getByRole("button", { name: "Save" }).click();

  const confirmation = page.locator("dialog.mini-dialog");
  await expect(confirmation.getByRole("heading", { name: "Reuse Project Code" })).toBeVisible();
  await expect(confirmation).toContainText('Project code "PMT" belongs to a deleted project.');
  expect(saveRequests).toHaveLength(1);
  expect(saveRequests[0]).toMatchObject({
    code: "PMT",
    title: "Project Management Tool",
    memberIds: [1]
  });
  expect(saveRequests[0]).not.toHaveProperty("overrideArchivedCode");

  await confirmation.getByRole("button", { name: "Continue" }).click();
  await expect(editor).not.toBeVisible();
  await expect.poll(() => saveRequests.length).toBe(2);
  expect(saveRequests[1]).toEqual({
    ...saveRequests[0],
    code: "PMT",
    overrideArchivedCode: true
  });
});

function testState() {
  const admin = {
    id: 1,
    firstName: "Sin",
    lastName: "User",
    nickname: "Sin",
    email: "sin@example.test",
    avatarUrl: "/assets/avatar-default.svg",
    role: "Admin",
    roleCode: "Admin",
    isAdmin: true,
    isActive: true
  };

  return {
    users: [admin],
    projects: [{
      id: 10,
      code: "P605",
      title: "Existing Project",
      description: "",
      url: "",
      iconUrl: "",
      startDate: null,
      endDate: null,
      percentCompleted: 0,
      taskCount: 0,
      completedTaskCount: 0,
      bugCount: 0,
      openBugCount: 0,
      memberIds: [1],
      members: [admin]
    }],
    sprints: [],
    tasks: [],
    devLogs: [],
    blogs: [],
    auditEvents: [],
    lookups: [],
    roles: [],
    holidays: [],
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
