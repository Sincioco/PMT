import { expect, test } from "@playwright/test";
import { releaseNotes } from "../../wwwroot/js/shared/release-notes-data.js";

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
  const fullScreenEditor = page.locator(".documentation-screen.is-full-screen-editor");
  await expect(fullScreenEditor).toBeVisible();
  await expect(fullScreenEditor.locator("[name='isPrivate']")).toBeChecked();
  await fullScreenEditor.locator("[name='title']").fill("Owner Private Document Updated");
  await fullScreenEditor.locator("[data-action='save-documentation-inline-edit']").first().click();

  await expect.poll(() => calls.filter(call => call.method === "PUT")).toHaveLength(1);
  await page.getByRole("button", { name: "Cards", exact: true }).click();
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

test("RTE checkbox lists support dialog editing, ordering, sizing, and read-mode persistence", async ({ page }) => {
  const calls = [];
  const appState = await prepareDocumentationPage(page, 2, calls);
  await loginToDocumentation(page, "Owner");

  await documentCard(page, ownerPrivateTitle)
    .locator("[data-action='edit-blog']")
    .click({ force: true });

  const fullScreenEditor = page.locator(".documentation-screen.is-full-screen-editor");
  const editor = fullScreenEditor.locator("[data-rich='bodyHtml']");
  await expect(fullScreenEditor).toBeVisible();
  await editor.evaluate(node => {
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });

  await fullScreenEditor.locator("[data-command='insertCheckbox']").click();
  let listDialog = page.locator("dialog.rich-checkbox-list-dialog");
  await expect(listDialog.getByRole("heading", { name: "Checkboxes" })).toBeVisible();

  let rows = listDialog.locator("[data-rich-checkbox-dialog-row]");
  await expect(rows).toHaveCount(1);
  expect(await rows.first().evaluate(row => [...row.children].map(child =>
    child.hasAttribute("data-rich-checkbox-row-checked") ? "state"
      : child.hasAttribute("data-rich-checkbox-row-text") ? "text"
        : child.hasAttribute("data-rich-checkbox-drag-handle") ? "drag"
          : child.dataset.action || ""
  ))).toEqual([
    "state",
    "text",
    "drag",
    "edit-rich-checkbox-row",
    "move-rich-checkbox-row-up",
    "move-rich-checkbox-row-down",
    "delete-rich-checkbox-row"
  ]);
  await rows.nth(0).locator("[data-rich-checkbox-row-text]").fill(
    "Confirm the deployment package includes every required file and the release notes are ready for review."
  );
  await rows.nth(0).locator("[data-rich-checkbox-row-checked]").check();

  await listDialog.locator("[data-action='add-rich-checkbox-row']").click();
  await rows.nth(1).locator("[data-rich-checkbox-row-text]").fill("Run the release validation suite.");
  await listDialog.locator("[data-action='add-rich-checkbox-row']").click();
  await rows.nth(2).locator("[data-rich-checkbox-row-text]").fill("Notify the project team.");

  await rows.nth(0).locator("[data-action='move-rich-checkbox-row-down']").click();
  expect(await rows.locator("[data-rich-checkbox-row-text]").evaluateAll(inputs => inputs.map(input => input.value))).toEqual([
    "Run the release validation suite.",
    "Confirm the deployment package includes every required file and the release notes are ready for review.",
    "Notify the project team."
  ]);

  const dragHandle = rows.nth(2).locator("[data-rich-checkbox-drag-handle]");
  const dragTarget = rows.nth(0);
  const dragBox = await dragHandle.boundingBox();
  const targetBox = await dragTarget.boundingBox();
  expect(dragBox).toBeTruthy();
  expect(targetBox).toBeTruthy();
  await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 3, { steps: 6 });
  await page.mouse.up();
  expect(await rows.locator("[data-rich-checkbox-row-text]").evaluateAll(inputs => inputs.map(input => input.value))).toEqual([
    "Notify the project team.",
    "Run the release validation suite.",
    "Confirm the deployment package includes every required file and the release notes are ready for review."
  ]);
  // Pointer reordering suppresses the synthetic post-drag click. Playwright's mouse
  // gesture does not emit it, so consume that guard before testing explicit buttons.
  await listDialog.getByRole("heading", { name: "Checkboxes" }).click();

  await rows.nth(2).locator("[data-action='move-rich-checkbox-row-up']").click();
  expect(await rows.locator("[data-rich-checkbox-row-text]").evaluateAll(inputs => inputs.map(input => input.value))).toEqual([
    "Notify the project team.",
    "Confirm the deployment package includes every required file and the release notes are ready for review.",
    "Run the release validation suite."
  ]);
  await rows.nth(1).locator("[data-action='move-rich-checkbox-row-down']").click();
  expect(await rows.locator("[data-rich-checkbox-row-text]").evaluateAll(inputs => inputs.map(input => input.value))).toEqual([
    "Notify the project team.",
    "Run the release validation suite.",
    "Confirm the deployment package includes every required file and the release notes are ready for review."
  ]);
  await rows
    .filter({ has: page.locator('[data-rich-checkbox-row-text][value="Run the release validation suite."]') })
    .locator("[data-action='delete-rich-checkbox-row']")
    .click();
  expect(await rows.locator("[data-rich-checkbox-row-text]").evaluateAll(inputs => inputs.map(input => input.value))).toEqual([
    "Notify the project team.",
    "Confirm the deployment package includes every required file and the release notes are ready for review."
  ]);

  await rows.nth(1).locator("[data-action='edit-rich-checkbox-row']").click();
  const labelDialog = page.locator("dialog.rich-checkbox-label-dialog");
  const labelEditor = labelDialog.locator("[data-rich='checkboxLabel']");
  await expect(labelDialog.getByRole("heading", { name: "Edit Checkbox Label" })).toBeVisible();
  await labelEditor.evaluate(node => {
    node.innerHTML = "<p>Confirm the deployment package includes every required file and the release notes are ready for review.</p><p>Owner: Release Manager</p>";
    const text = node.querySelector("p").firstChild;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, "Confirm the deployment package".length);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await labelDialog.locator("[data-command='bold']").click();
  await expect(labelEditor.locator("b, strong")).toHaveText("Confirm the deployment package");
  await labelDialog.getByRole("button", { name: "Save" }).click();
  await expect(labelDialog).toHaveCount(0);

  await listDialog.locator("[data-rich-checkbox-auto-width]").uncheck();
  await listDialog.locator("[data-rich-checkbox-width]").fill("240");
  await listDialog.getByRole("button", { name: "Save" }).click();
  await expect(listDialog).toHaveCount(0);

  const checkboxList = editor.locator("[data-rich-check-list]");
  await expect(checkboxList).toHaveCount(1);
  await expect(checkboxList).toHaveAttribute("data-rich-check-width-mode", "fixed");
  await expect(checkboxList.locator(".rich-check-item")).toHaveCount(2);
  await expect(checkboxList.locator(".rich-check-label").nth(0)).toHaveText("Notify the project team.");
  await expect(checkboxList.locator(".rich-check-label").nth(1)).toContainText("Owner: Release Manager");
  await expect(checkboxList.locator(".rich-check-label b, .rich-check-label strong")).toHaveText("Confirm the deployment package");
  await expect(checkboxList.locator("input[type='checkbox']").nth(1)).toBeChecked();

  const wrapping = await checkboxList.locator(".rich-check-label").nth(1).evaluate(label => {
    const range = document.createRange();
    range.selectNodeContents(label);
    const lines = [...range.getClientRects()].filter(rect => rect.width > 1);
    const checkbox = label.closest(".rich-check-item").querySelector("input").getBoundingClientRect();
    return {
      display: getComputedStyle(label.closest(".rich-check-item")).display,
      lineCount: lines.length,
      lineLefts: lines.map(rect => Math.round(rect.left)),
      labelLeft: Math.round(label.getBoundingClientRect().left),
      checkboxRight: Math.round(checkbox.right)
    };
  });
  expect(wrapping.display).toBe("grid");
  expect(wrapping.lineCount).toBeGreaterThan(1);
  expect(Math.min(...wrapping.lineLefts)).toBeGreaterThan(wrapping.checkboxRight);
  expect(wrapping.lineLefts.some(left => Math.abs(left - wrapping.labelLeft) <= 1)).toBe(true);

  await checkboxList.hover();
  const resizeHandle = fullScreenEditor.locator("[data-rich-check-list-resize]");
  await expect(resizeHandle).toBeVisible();
  const widthBeforeResize = await checkboxList.evaluate(node => node.getBoundingClientRect().width);
  const resizeBox = await resizeHandle.boundingBox();
  expect(resizeBox).toBeTruthy();
  await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(resizeBox.x + resizeBox.width / 2 + 80, resizeBox.y + resizeBox.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => checkboxList.evaluate(node => node.getBoundingClientRect().width))
    .toBeGreaterThan(widthBeforeResize + 50);

  await fullScreenEditor.locator("[data-rich-check-list-edit]").click();
  listDialog = page.locator("dialog.rich-checkbox-list-dialog");
  await expect(listDialog.getByRole("heading", { name: "Edit Checkboxes" })).toBeVisible();
  await expect(listDialog.locator("[data-rich-checkbox-width]")).not.toHaveValue("240");
  await listDialog.getByRole("button", { name: "Cancel" }).click();

  await checkboxList.locator(".rich-check-label").first().click();
  await fullScreenEditor.locator("[data-command='insertCheckbox']").click();
  listDialog = page.locator("dialog.rich-checkbox-list-dialog");
  await expect(listDialog.getByRole("heading", { name: "Edit Checkboxes" })).toBeVisible();
  await listDialog.locator("[data-rich-checkbox-auto-width]").check();
  await listDialog.getByRole("button", { name: "Save" }).click();
  await expect(checkboxList).toHaveAttribute("data-rich-check-width-mode", "auto");

  await fullScreenEditor.locator("[data-action='save-documentation-inline-edit']").first().click();
  await expect.poll(() => calls.filter(call => call.method === "PUT")).toHaveLength(1);
  await page.getByRole("button", { name: "Cards", exact: true }).click();
  await page.evaluate(() => {
    window.location.hash = "#/documentation/102";
  });

  const readonlyDialog = page.locator("dialog.documentation-readonly-dialog");
  const readonlyList = readonlyDialog.locator("[data-rich-check-list]");
  await expect(readonlyDialog).toBeVisible();
  await expect(readonlyList.locator(".rich-check-item")).toHaveCount(2);
  await expect(readonlyDialog.locator("[data-rich-check-list-edit], [data-rich-check-list-resize]")).toHaveCount(0);

  const readonlyCheckbox = readonlyList.locator("input[type='checkbox']").first();
  await expect(readonlyCheckbox).not.toBeChecked();
  await readonlyList.locator(".rich-check-label").first().click();
  await expect(readonlyCheckbox).toBeChecked();
  await expect.poll(() => calls.filter(call => call.method === "PUT")).toHaveLength(2);
  const savedHtml = appState.blogs.find(item => item.id === 102).bodyHtml;
  expect(savedHtml).toContain("data-rich-check-list");
  expect(savedHtml).toContain('checked="checked"');
  expect(savedHtml).not.toContain("data-rich-check-list-controls");
  expect(savedHtml).not.toContain("is-active");
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
    localStorage.setItem(`pmt-release-notes-last-seen:${userId.id}`, userId.seenToken);
  }, { id: currentUserId, seenToken: releaseNotes[0].seenToken });
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
  return appState;
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
