import { expect, test } from "@playwright/test";
import { releaseNotes } from "../../wwwroot/js/shared/release-notes-data.js";

test("Admin can confirm reuse of an archived project code without changing the requested code", async ({ page }) => {
  const saveRequests = [];

  await page.addInitScript(seenToken => {
    localStorage.clear();
    localStorage.setItem("pmt-release-notes-last-seen:1", seenToken);
  }, releaseNotes[0].seenToken);
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

test("a stale Project save is rejected and can be preserved as a new Project", async ({ page }) => {
  const updateRequests = [];
  const createRequests = [];

  await page.addInitScript(seenToken => {
    localStorage.clear();
    localStorage.setItem("pmt-release-notes-last-seen:1", seenToken);
  }, releaseNotes[0].seenToken);
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
  await page.route("**/api/projects/10", async route => {
    updateRequests.push(route.request().postDataJSON());
    await route.fulfill(jsonResponse({
      error: "A newer version of this item exists. Your changes were not applied.",
      code: "save-conflict"
    }, 409));
  });
  await page.route("**/api/projects", async route => {
    createRequests.push(route.request().postDataJSON());
    await route.fulfill(jsonResponse({ id: 20 }));
  });

  await page.goto("/#/projects");
  await page.locator("#loginName").fill("Sin");
  await page.locator("#loginPassword").fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();

  await page.locator("[data-action='edit-project'][data-id='10']").click();
  const editor = page.locator("#editorDialog");
  await editor.locator("[name='title']").fill("Preserved stale draft");
  await editor.getByRole("button", { name: "Save" }).click();

  const collision = page.locator("dialog.mini-dialog");
  await expect(collision.getByRole("heading", { name: "Save Collision" })).toBeVisible();
  await expect(collision).toContainText("A newer version of this item exists");
  await expect(collision.getByRole("button", { name: "Save as New" })).toBeVisible();
  expect(updateRequests).toHaveLength(1);
  expect(updateRequests[0]).toMatchObject({
    id: 10,
    code: "P605",
    title: "Preserved stale draft",
    expectedRowVersion: "AQIDBAUGBwg="
  });

  await collision.getByRole("button", { name: "Save as New" }).click();
  await expect(editor.getByRole("heading", { name: "New Project" })).toBeVisible();
  await expect(editor.locator("[name='code']")).toHaveValue("");
  await expect(editor.locator("[name='title']")).toHaveValue("Preserved stale draft");

  await editor.locator("[name='code']").fill("P606");
  await editor.getByRole("button", { name: "Save" }).click();
  await expect(editor).not.toBeVisible();
  expect(createRequests).toHaveLength(1);
  expect(createRequests[0]).toMatchObject({
    id: 0,
    code: "P606",
    title: "Preserved stale draft"
  });
  expect(createRequests[0]).not.toHaveProperty("expectedRowVersion");
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
      members: [admin],
      rowVersion: "AQIDBAUGBwg="
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
