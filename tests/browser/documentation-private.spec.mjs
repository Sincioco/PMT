import { expect, test } from "@playwright/test";

const adminPrivateTitle = "Admin Private Document";
const ownerPrivateTitle = "Owner Private Document";
const publicTitle = "Shared Public Document";

test("admin cannot discover or open another user's private document", async ({ page }) => {
  const calls = [];
  await prepareDocumentationPage(page, 1, calls);
  await loginToDocumentation(page, "Sin");

  await expect(documentCard(page, adminPrivateTitle)).toBeVisible();
  await expect(documentCard(page, publicTitle)).toBeVisible();
  await expect(documentCard(page, ownerPrivateTitle)).toHaveCount(0);

  await page.locator("[data-action='open-documentation-filters']").click();
  const visibility = page.locator("[data-filter='documentation-visibility']");
  await expect(visibility.locator("option")).toHaveText(["Both", "Private", "Public"]);
  await expect(visibility.locator("option[value='admin-all']")).toHaveCount(0);
  await page.getByRole("button", { name: "Done" }).click();

  await page.evaluate(id => {
    window.location.hash = `#/documentation/${id}`;
  }, 102);

  await expect(page.locator("dialog.documentation-readonly-dialog")).toHaveCount(0);
  await expect(page.locator("#toast")).toHaveText("Shared item was not found or you do not have access.");
  await expect(page).toHaveURL(/#\/documentation$/);
  await expect(page.locator("body")).not.toContainText("Owner-only private contents");
  expect(calls).toEqual([]);
});

test("private document owner can view, edit, and delete their document", async ({ page }) => {
  const calls = [];
  await prepareDocumentationPage(page, 2, calls);
  await loginToDocumentation(page, "Owner");

  await expect(documentCard(page, ownerPrivateTitle)).toBeVisible();
  await expect(documentCard(page, publicTitle)).toBeVisible();
  await expect(documentCard(page, adminPrivateTitle)).toHaveCount(0);

  await page.evaluate(id => {
    window.location.hash = `#/documentation/${id}`;
  }, 102);
  const readonlyDialog = page.locator("dialog.documentation-readonly-dialog");
  await expect(readonlyDialog).toBeVisible();
  await expect(readonlyDialog.getByRole("heading", { name: ownerPrivateTitle })).toBeVisible();
  await expect(readonlyDialog).toContainText("Owner-only private contents");
  await expect(readonlyDialog.getByRole("button", { name: "Edit" })).toBeEnabled();
  await readonlyDialog.locator("[data-close]").last().click();
  await expect(readonlyDialog).toHaveCount(0);
  await expect(page).toHaveURL(/#\/documentation$/);

  const ownerCard = documentCard(page, ownerPrivateTitle);
  await ownerCard.locator("[data-action='edit-blog']").click({ force: true });
  await expect(page.locator("#editorDialog")).toBeVisible();
  await expect(page.locator("#dialogTitle")).toHaveText("Edit Document");
  await expect(page.locator("#dialogBody [name='isPrivate']")).toBeChecked();
  await page.locator("#dialogBody [name='title']").fill("Owner Private Document Updated");
  await page.locator("#editorForm button[type='submit']").click();

  await expect.poll(() => calls.filter(call => call.method === "PUT")).toHaveLength(1);
  await expect(documentCard(page, "Owner Private Document Updated")).toBeVisible();

  await documentCard(page, "Owner Private Document Updated")
    .locator("[data-action='delete-blog']")
    .click({ force: true });
  await expect(page.locator("dialog.mini-dialog")).toContainText("Delete this document?");
  await page.locator("dialog.mini-dialog").getByRole("button", { name: "Continue" }).click();

  await expect.poll(() => calls.filter(call => call.method === "DELETE")).toHaveLength(1);
  await expect(documentCard(page, "Owner Private Document Updated")).toHaveCount(0);
  expect(calls).toEqual([
    { method: "PUT", id: 102 },
    { method: "DELETE", id: 102 }
  ]);
});

test("documentation item route follows read-only dialog close behavior", async ({ page }) => {
  const calls = [];
  await prepareDocumentationPage(page, 2, calls);
  await loginToDocumentation(page, "Owner");

  await page.evaluate(id => {
    window.location.hash = `#/documentation/${id}`;
  }, 102);
  const readonlyDialog = page.locator("dialog.documentation-readonly-dialog");
  await expect(readonlyDialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(readonlyDialog).toHaveCount(0);
  await expect(page).toHaveURL(/#\/documentation$/);

  await page.evaluate(id => {
    window.location.hash = `#/documentation/${id}`;
  }, 102);
  await expect(readonlyDialog).toBeVisible();
  await readonlyDialog.getByRole("button", { name: "View Full-Screen" }).click();

  await expect(readonlyDialog).toHaveCount(0);
  await expect(page).toHaveURL(/#\/documentation\/102$/);
  expect(calls).toEqual([]);
});

async function prepareDocumentationPage(page, currentUserId, calls) {
  const appState = testState();
  const currentUser = appState.users.find(user => user.id === currentUserId);

  await page.addInitScript(userId => {
    localStorage.clear();
    localStorage.setItem(`pmt-release-notes-last-seen:${userId}`, "2026-07-18-day-31@fb8032719c56");
  }, currentUserId);
  await page.route("**/api/login", async route => {
    await route.fulfill(jsonResponse({
      userId: currentUser.id,
      nickname: currentUser.nickname,
      isAdmin: currentUser.isAdmin,
      role: currentUser.role
    }));
  });
  await page.route("**/api/state", async route => {
    await route.fulfill(jsonResponse(appState));
  });
  await page.route(/\/api\/blogs\/(\d+)$/, async route => {
    const id = Number(route.request().url().match(/\/api\/blogs\/(\d+)$/)?.[1] || 0);
    const method = route.request().method();
    calls.push({ method, id });

    if (method === "PUT") {
      const blog = appState.blogs.find(item => item.id === id);
      Object.assign(blog, route.request().postDataJSON(), {
        id,
        updatedAt: "2026-07-14T15:00:00Z",
        updatedByUserId: currentUserId
      });
      await route.fulfill(jsonResponse({ id }));
      return;
    }

    if (method === "DELETE") {
      appState.blogs = appState.blogs.filter(item => item.id !== id);
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    await route.fulfill(jsonResponse({ error: "Unsupported test request" }, 405));
  });
}

async function loginToDocumentation(page, nickname) {
  await page.goto("/#/documentation");
  await page.locator("#loginName").fill(nickname);
  await page.locator("#loginPassword").fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page.getByRole("heading", { name: "Documentation", exact: true })).toBeVisible();
}

function documentCard(page, title) {
  return page.locator(`.documentation-card[title="${title}"]`);
}

function testState() {
  return {
    users: [
      {
        id: 1,
        firstName: "Louiery",
        lastName: "Sincioco",
        nickname: "Sin",
        email: "sin@example.test",
        role: "Admin",
        roleCode: "Admin",
        isAdmin: true,
        isActive: true,
        avatarUrl: ""
      },
      {
        id: 2,
        firstName: "Private",
        lastName: "Owner",
        nickname: "Owner",
        email: "owner@example.test",
        role: "Developer",
        roleCode: "Developer",
        isAdmin: false,
        isActive: true,
        avatarUrl: ""
      }
    ],
    projects: [{
      id: 10,
      code: "PMT",
      title: "Project Management Tool",
      description: "Documentation privacy test project.",
      memberIds: [1, 2],
      members: [],
      isArchived: false
    }],
    sprints: [],
    tasks: [],
    devLogs: [],
    blogs: [
      blog(101, adminPrivateTitle, 1, true, "Admin-only private contents"),
      blog(102, ownerPrivateTitle, 2, true, "Owner-only private contents"),
      blog(103, publicTitle, 2, false, "Shared public contents")
    ],
    auditEvents: [],
    lookups: [],
    roles: [],
    holidays: [],
    securityResources: [{
      resourceKey: "Documentation",
      name: "Documentation",
      availableRights: "Read,Create,Update,Delete,Import,Export",
      displayOrder: 100
    }],
    rolePermissions: [],
    userPermissions: [],
    effectivePermissions: [{
      resourceKey: "Documentation",
      canRead: true,
      canCreate: true,
      canUpdate: true,
      canDelete: true,
      canImport: true,
      canExport: true,
      noAccess: false
    }]
  };
}

function blog(id, title, createdByUserId, isPrivate, bodyText) {
  return {
    id,
    projectId: 10,
    sprintId: null,
    parentBlogId: null,
    title,
    bodyHtml: `<p>${bodyText}</p>`,
    isPrivate,
    isPinned: false,
    createdByUserId,
    updatedByUserId: createdByUserId,
    createdAt: "2026-07-14T08:00:00Z",
    updatedAt: "2026-07-14T08:00:00Z",
    attachments: [],
    history: []
  };
}

function jsonResponse(data, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(data)
  };
}
