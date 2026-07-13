import { expect, test } from "@playwright/test";

const statuses = [
  "Backlog",
  "Todo",
  "In Progress",
  "Code Complete",
  "Ready for QA",
  "QA in Progress",
  "QA Failed",
  "QA Passed",
  "Deployed in SIT",
  "Deployed in UAT",
  "Deployed in Prod"
];

test("login, navigation, themes, dialogs, filters, Board, Gantt, and Road Map smoke", async ({ page }) => {
  const appState = createTestState();
  const browserErrors = [];

  page.on("console", message => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", error => browserErrors.push(error.message));
  page.on("dialog", async dialog => {
    browserErrors.push(`Unexpected browser dialog: ${dialog.type()} ${dialog.message()}`);
    await dialog.dismiss();
  });

  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("pmt-navigation", JSON.stringify({
      version: 2,
      items: [
        ["Dashboard", "Dashboard"],
        ["Road Map", "Road Map"],
        ["Gantt", "Gantt"],
        ["Projects", "Projects"],
        ["Sprints", "Sprints"],
        ["Board", "Kanban Board"],
        ["Tasks", "Dev Tasks"],
        ["Bugs", "Bug Tracking"],
        ["Scrum", "Scrum"],
        ["Documentation", "Documentation"],
        ["Log", "Log"],
        ["Backlog", "Backlog"],
        ["WFH Schedule", "WFH Schedule"],
        ["About", "About"],
        ["Settings", "Settings"]
      ].map(([view, label]) => ({ view, label, visible: true }))
    }));
  });
  await installApiMocks(page, appState);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "PMT", exact: true })).toBeVisible();
  await expect(page.locator("#loginName")).toHaveValue("");
  await expect(page.locator("#loginPassword")).toHaveValue("");
  await page.locator("#loginName").fill("Sin");
  await page.locator("#loginPassword").fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  await expect(page.locator(".dashboard-summary-grid")).toBeVisible();
  await expectShellFitsViewport(page);

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await openUserMenu(page);
  await expect(page.getByRole("menuitem", { name: "Invite Users" })).toBeVisible();
  await page.locator("#themeToggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("Escape");
  await openUserMenu(page);
  await page.locator("#themeToggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.keyboard.press("Escape");

  await openUserMenu(page);
  await page.getByRole("menuitem", { name: /change password/i }).click();
  await expect(page.locator("#dialogTitle")).toHaveText("Change Password");
  await expect(page.locator("#editorDialog")).toBeVisible();
  await page.locator("#cancelDialog").click();
  await expect(page.locator("#editorDialog")).not.toBeVisible();

  const screens = [
    ["Dashboard", "Dashboard"],
    ["Road Map", "Road Map"],
    ["Gantt", "Gantt"],
    ["Board", "Kanban Board"],
    ["Projects", "Projects"],
    ["Sprints", "Sprints"],
    ["Tasks", "Dev Tasks"],
    ["Bugs", "Bug Tracking"],
    ["Scrum", "Scrum"],
    ["Documentation", "Documentation"],
    ["Backlog", "Backlog"],
    ["WFH Schedule", "WFH Schedule"],
    ["Settings", "Settings"]
  ];

  for (const [view, heading] of screens) {
    await openNavView(page, view, heading);
    await expectShellFitsViewport(page);
  }

  await openNavView(page, "WFH Schedule", "WFH Schedule");
  await page.locator("[data-action='toggle-wfh-table-edit-mode']").click();
  await expect(page.locator("[data-wfh-schedule-list] tr").first()).toHaveAttribute("data-wfh-user-id", "2");
  const billMonday = page.locator("[data-wfh-user-id='2'] [data-day='canWorkMonday']");
  await expect(billMonday).toBeEnabled();
  await expect(billMonday).toHaveAttribute("aria-pressed", "false");
  await billMonday.click();
  await expect(billMonday).toHaveAttribute("aria-pressed", "true");
  await dragWfhUserBefore(page, "3", "2");
  await expect(page.locator("[data-wfh-schedule-list] tr").first()).toHaveAttribute("data-wfh-user-id", "3");
  await page.locator("[data-wfh-user-id='2'] [data-action='hide-wfh-user']").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("[data-wfh-user-id='2']")).toHaveCount(0);
  await page.locator("[data-action='toggle-wfh-deleted']").click();
  await expect(page.locator("[data-wfh-user-id='2']")).toContainText("Hidden");
  await page.locator("[data-action='reset-wfh-schedule']").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("[data-wfh-schedule-list] tr").first()).toHaveAttribute("data-wfh-user-id", "2");
  await expect(page.locator("[data-wfh-user-id='2'] [data-day='canWorkMonday']")).toHaveAttribute("aria-pressed", "false");

  await openNavView(page, "Scrum", "Scrum");
  await showFilters(page, "open-scrum-filters");
  await expect(page.locator("[data-filter='scrum-person']:checked")).toHaveCount(0);
  await expect(page.locator(".scrum-table tbody")).toContainText("Validated smoke data");
  await page.locator("[data-filter='scrum-person'][value='2']").check();
  await expect(page.locator(".scrum-table tbody")).toContainText("No Scrum entries match");
  await page.locator("[data-filter='scrum-person'][value='1']").check();
  await expect(page.locator(".scrum-table tbody")).toContainText("Validated smoke data");
  await page.getByRole("button", { name: "Done" }).click();
  await clickPageAction(page, "toggle-scrum-table-edit-mode");
  await expect(page.locator(".scrum-actions .icon-action").nth(0)).toHaveAttribute("title", "Delete");
  await expect(page.locator(".scrum-actions .icon-action").nth(1)).toHaveAttribute("title", "Duplicate");
  await expect(page.locator(".scrum-actions .icon-action").nth(2)).toHaveAttribute("title", "Edit");

  await openSettings(page);
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await page.locator("[data-action='select-lookup-type'][data-type='Security']").click();
  await page.locator("[data-action='select-security-resource'][data-resource-key='DevTasks']").click();
  const billSecurityRow = page.locator("[data-security-permission-row][data-security-scope='user'][data-security-principal='2']");
  const billDelete = billSecurityRow.locator("[data-security-right='canDelete']");
  const billReset = billSecurityRow.locator("[data-action='reset-security-override']");
  await expect(billSecurityRow.locator("[data-security-right]:checked")).toHaveCount(6);
  await expect(billReset).toBeDisabled();

  await billDelete.click();
  await expect(page.getByRole("heading", { name: "Break Inheritance" })).toBeVisible();
  await expect(page.locator("dialog.mini-dialog")).toContainText("checked grants it and unchecked denies it");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(billDelete).toBeChecked();
  await expect(billReset).toBeDisabled();

  await billDelete.click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(billDelete).not.toBeChecked();
  await expect(billReset).toBeEnabled();
  await expect(billSecurityRow.locator(".security-effective-rights")).toContainText("Read, Create, Update, Import, Export");
  await expect(billSecurityRow.locator(".security-effective-rights")).not.toContainText("Delete");

  await billReset.click();
  await expect(billDelete).toBeChecked();
  await expect(billReset).toBeDisabled();
  await expect(billSecurityRow.locator(".security-effective-rights")).toContainText("Delete");

  await billDelete.click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator("[data-action='save-security']").click();
  const savedBillSecurityRow = page.locator("[data-security-permission-row][data-security-scope='user'][data-security-principal='2']");
  await expect(savedBillSecurityRow.locator("[data-security-right='canDelete']")).not.toBeChecked();
  await expect(savedBillSecurityRow.locator("[data-action='reset-security-override']")).toBeEnabled();

  await page.locator("[data-action='security-audit']").click();
  await expect(page.getByRole("heading", { name: "Security Audit" })).toBeVisible();
  await expect(page.locator(".security-audit-table tbody tr")).toHaveCount(42);
  const billAuditDevTasks = page.locator(".security-audit-table tbody tr", { hasText: "Bill Gates" }).filter({ hasText: "Dev Tasks" });
  await expect(billAuditDevTasks.getByRole("checkbox", { name: "Delete" })).not.toBeChecked();
  await expect(billAuditDevTasks.locator("input:checked")).toHaveCount(5);
  const downloadPromise = page.waitForEvent("download");
  await page.locator("[data-security-audit-export]").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^pmt-security-audit-.*\.xlsx$/);
  await page.locator("[data-security-audit-done]").click();

  await page.locator("[data-action='select-lookup-type'][data-type='Development']").click();
  await expect(page.getByRole("button", { name: "Restore Initial Seed Data" })).toBeVisible();
  await page.locator("[data-action='select-lookup-type'][data-type='Navigation']").click();
  await expect(page.locator("[data-navigation-list]")).toBeVisible();
  await expect(page.locator("[data-action='toggle-navigation-item'][data-view='Settings']")).toBeDisabled();

  const backlogToggle = page.locator("[data-action='toggle-navigation-item'][data-view='Backlog']");
  await expect(backlogToggle).toBeChecked();
  await backlogToggle.click();
  await expect(page.locator("#nav button[data-view='Backlog']")).toHaveCount(0);

  await dragNavigationItemBefore(page, "Gantt", "Road Map");
  await expect(page.locator("#nav > button.nav-item").nth(1)).toHaveAttribute("data-view", "Gantt");
  await expect(page.locator("#nav > button.nav-item").nth(2)).toHaveAttribute("data-view", "Road Map");
  await page.locator("[data-navigation-list] [data-nav-view='Settings'] [data-action='rename-navigation-item']").click();
  await expect(page.locator("#dialogTitle")).toHaveText("Rename Navigation Item");
  await page.locator("#dialogBody [name='label']").fill("Options");
  await page.locator("#editorForm button[type='submit']").click();
  await expect.poll(async () => page.locator("#nav button[data-view='Settings']").evaluateAll(buttons => buttons.some(button => (button.textContent || "").includes("Options"))))
    .toBe(true);
  const navigationConfig = await page.evaluate(() => JSON.parse(localStorage.getItem("pmt-navigation")));
  expect(navigationConfig.items[1].view).toBe("Gantt");
  expect(navigationConfig.items[2].view).toBe("Road Map");
  expect(navigationConfig.items.find(item => item.view === "Settings").label).toBe("Options");
  expect(navigationConfig.items.find(item => item.view === "Backlog").visible).toBe(false);

  await page.setViewportSize({ width: 900, height: 768 });
  await page.waitForTimeout(100);
  await expectShellFitsViewport(page);
  await expect(page.locator(".nav-overflow-toggle")).toBeVisible();
  await page.locator(".nav-overflow-toggle").click();
  await expect(page.locator(".nav-overflow-menu button[data-view='Backlog']")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.locator("[data-action='navigation-reset-defaults']")).toBeVisible();
  await page.locator("[data-action='navigation-reset-defaults']").click();
  const resetNavigationConfig = await page.evaluate(() => JSON.parse(localStorage.getItem("pmt-navigation")));
  const resetNavigationByView = Object.fromEntries(resetNavigationConfig.items.map(item => [item.view, item]));
  expect(resetNavigationConfig.items[0].view).toBe("Dashboard");
  expect(resetNavigationByView.Dashboard.visible).toBe(false);
  expect(resetNavigationByView["Road Map"].visible).toBe(false);
  expect(resetNavigationByView.Gantt.visible).toBe(false);
  expect(resetNavigationByView.Backlog.visible).toBe(true);
  expect(resetNavigationByView.Settings.label).toBe("Settings");
  for (const view of ["Dashboard", "Road Map", "Gantt"]) {
    const toggle = page.locator(`[data-action='toggle-navigation-item'][data-view='${view}']`);
    await expect(toggle).not.toBeChecked();
    await toggle.click();
  }
  await openNavView(page, "Backlog", "Backlog");

  await openNavView(page, "Tasks", "Dev Tasks");
  await showFilters(page, "toggle-task-filters");
  await page.locator("[data-filter='task-sort']").selectOption("newest");
  await expect(page.locator("[data-filter='task-sort']")).toHaveValue("newest");
  await page.locator("[data-filter='task-hide-completed']").check();
  await expect(page.locator("tbody[data-reorder-list='tasks']")).not.toContainText("PMT-TASK-003");
  await closeFilterDialog(page, "task");

  await page.locator("tr[data-task-id='1']").click();
  const taskDetails = page.locator("dialog.detail-dialog");
  await expect(taskDetails).toBeVisible();
  await expect(taskDetails.locator("[data-work-item-dialog-field='rootCauseAnalysisHtml']")).toHaveCount(0);
  await expect(taskDetails.locator("[data-work-item-dialog-field='url']")).toHaveCount(0);
  await taskDetails.getByRole("button", { name: "Edit" }).click();
  await expect(page.locator("#editorDialog")).toBeVisible();
  const deleteAttachmentButton = page.locator("#editorDialog [data-delete-attachment='/api/tasks/1/attachments/901']");
  await expect(deleteAttachmentButton).toHaveCount(1);
  const deleteIconAlignment = await deleteAttachmentButton.evaluate(button => {
    const buttonStyle = getComputedStyle(button);
    const beforeStyle = getComputedStyle(button, "::before");
    const afterStyle = getComputedStyle(button, "::after");
    const bounds = button.getBoundingClientRect();
    return {
      buttonWidth: bounds.width,
      buttonHeight: bounds.height,
      fontSize: buttonStyle.fontSize,
      beforeTop: Number.parseFloat(beforeStyle.top),
      beforeLeft: Number.parseFloat(beforeStyle.left),
      beforeWidth: beforeStyle.width,
      beforeHeight: beforeStyle.height,
      afterTop: Number.parseFloat(afterStyle.top),
      afterLeft: Number.parseFloat(afterStyle.left),
      afterWidth: afterStyle.width,
      afterHeight: afterStyle.height,
      transformsDiffer: beforeStyle.transform !== afterStyle.transform
    };
  });
  expect(deleteIconAlignment.fontSize).toBe("0px");
  expect(Math.abs(deleteIconAlignment.beforeTop - deleteIconAlignment.buttonHeight / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(deleteIconAlignment.beforeLeft - deleteIconAlignment.buttonWidth / 2)).toBeLessThanOrEqual(1);
  expect(deleteIconAlignment.afterTop).toBe(deleteIconAlignment.beforeTop);
  expect(deleteIconAlignment.afterLeft).toBe(deleteIconAlignment.beforeLeft);
  expect(deleteIconAlignment.beforeWidth).toBe("11px");
  expect(deleteIconAlignment.beforeHeight).toBe("2px");
  expect(deleteIconAlignment.afterWidth).toBe("11px");
  expect(deleteIconAlignment.afterHeight).toBe("2px");
  expect(deleteIconAlignment.transformsDiffer).toBe(true);
  await deleteAttachmentButton.click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(deleteAttachmentButton).toHaveCount(0);
  await page.locator("#cancelDialog").click();

  await openNavView(page, "Bugs", "Bug Tracking");
  await showFilters(page, "toggle-bug-filters");
  await page.locator("[data-filter='bug-severity']").selectOption("Critical");
  await expect(page.locator(".bugs-table")).toContainText("PMT-BUG-001");
  await closeFilterDialog(page, "bug");

  await openNavView(page, "Road Map", "Road Map");
  await expect(page.locator(".roadmap")).toBeVisible();
  await expectTimelineHasSize(page, ".roadmap");
  await page.locator("[data-filter='roadmap-sort']").selectOption("startDesc");
  await page.locator("[data-action='toggle-roadmap-sprints']").click();
  await expect(page.locator("[data-filter='roadmap-sprint']")).toBeEnabled();
  await expect(page.locator(".roadmap-sprint-bar").first()).toBeVisible();

  await openNavView(page, "Gantt", "Gantt");
  await expect(page.locator(".gantt")).toBeVisible();
  await expectTimelineHasSize(page, ".gantt");
  await showFilters(page, "open-gantt-filters");
  await page.locator("[data-filter='gantt-sort']").selectOption("startAsc");
  await closeFilterDialog(page, "gantt");
  await page.locator("[data-action='toggle-gantt-days']").click();
  await expect(page.locator("[data-action='toggle-gantt-days']")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Hide weekends and holidays" })).toBeVisible();

  await openNavView(page, "Board", "Kanban Board");
  await showFilters(page, "toggle-board-filters");
  await page.locator("[data-filter='board-sort']").selectOption("openFirst");
  await expect(page.locator("[data-filter='board-sort']")).toHaveValue("openFirst");
  await closeFilterDialog(page, "board");
  await page.locator("[data-action='toggle-empty-board-columns']").click();
  await expect(page.locator(".column")).toHaveCount(statuses.length);
  await page.locator("[data-action='toggle-board-edit-mode']").click();
  await dragFirstTodoCardToInProgress(page);
  await expect(page.locator(".column[data-status='In Progress']")).toContainText("PMT-TASK-001");

  expect(browserErrors).toEqual([]);
});

async function installApiMocks(page, appState) {
  let wfhSchedule = createWfhScheduleRows(appState.users);

  await page.route("**/api/login", async route => {
    const input = requestJson(route);
    if ((input.login || "").toLowerCase() === "sin" && input.password === "Password1") {
      await route.fulfill(jsonResponse({ userId: 1, nickname: "Sin", isAdmin: true, role: "Admin" }));
      return;
    }

    await route.fulfill(jsonResponse({ error: "Unauthorized" }, 401));
  });

  await page.route("**/api/state", async route => {
    await route.fulfill(jsonResponse(appState));
  });

  await page.route(/\/api\/security\/[^/]+$/, async route => {
    const resourceKey = decodeURIComponent(route.request().url().split("/").pop() || "");
    const input = requestJson(route);
    appState.rolePermissions = appState.rolePermissions.filter(item => item.resourceKey !== resourceKey)
      .concat((input.rolePermissions || []).map(item => ({ ...item, resourceKey })));
    const savedUsers = new Map((input.userPermissions || []).map(item => [Number(item.userId), item]));
    appState.userPermissions = appState.userPermissions.map(item => item.resourceKey !== resourceKey
      ? item
      : { ...item, ...(savedUsers.get(item.userId) || {}), resourceKey });
    await route.fulfill(jsonResponse({ saved: true }));
  });

  await page.route("**/api/wfh-schedule", async route => {
    await route.fulfill(jsonResponse(sortWfhRows(wfhSchedule)));
  });

  await page.route("**/api/wfh-schedule/reset", async route => {
    wfhSchedule = createWfhScheduleRows(appState.users);
    await route.fulfill(jsonResponse({ reset: true }));
  });

  await page.route("**/api/wfh-schedule/reorder", async route => {
    const input = requestJson(route);
    (input.userIds || []).forEach((userId, index) => {
      const row = wfhSchedule.find(item => item.userId === Number(userId));
      if (row) row.sortOrder = index + 1;
    });
    await route.fulfill(jsonResponse({ reordered: true }));
  });

  await page.route(/\/api\/wfh-schedule\/\d+$/, async route => {
    const input = requestJson(route);
    const userId = Number(route.request().url().match(/\/api\/wfh-schedule\/(\d+)$/)?.[1] || 0);
    const row = wfhSchedule.find(item => item.userId === userId);
    if (!row) {
      await route.fulfill(jsonResponse({ error: "WFH user not found" }, 404));
      return;
    }

    Object.assign(row, {
      canWorkMonday: Boolean(input.canWorkMonday),
      canWorkTuesday: Boolean(input.canWorkTuesday),
      canWorkWednesday: Boolean(input.canWorkWednesday),
      canWorkThursday: Boolean(input.canWorkThursday),
      canWorkFriday: Boolean(input.canWorkFriday),
      isHidden: Boolean(input.isHidden)
    });
    await route.fulfill(jsonResponse({ saved: true }));
  });

  await page.route("**/api/change-password", async route => {
    await route.fulfill(jsonResponse({ changed: true }));
  });

  await page.route("**/api/tasks/reorder", async route => {
    const input = requestJson(route);
    (input.taskIds || []).forEach((taskId, index) => {
      const task = appState.tasks.find(item => item.id === Number(taskId));
      if (task) task.sortOrder = index + 1;
    });
    await route.fulfill(jsonResponse({ reordered: true }));
  });

  await page.route(/\/api\/tasks\/\d+$/, async route => {
    const input = requestJson(route);
    const task = appState.tasks.find(item => item.id === Number(input.id));
    if (!task) {
      await route.fulfill(jsonResponse({ error: "Task not found" }, 404));
      return;
    }

    Object.assign(task, input);
    hydrateTaskPeople(appState, task);
    await route.fulfill(jsonResponse({ id: task.id }));
  });

  await page.route(/\/api\/tasks\/(\d+)\/attachments\/(\d+)$/, async route => {
    const match = route.request().url().match(/\/api\/tasks\/(\d+)\/attachments\/(\d+)$/);
    const task = appState.tasks.find(item => item.id === Number(match?.[1] || 0));
    const attachmentId = Number(match?.[2] || 0);
    if (!task || !task.attachments.some(item => item.id === attachmentId)) {
      await route.fulfill(jsonResponse({ error: "Attachment not found" }, 404));
      return;
    }

    task.attachments = task.attachments.filter(item => item.id !== attachmentId);
    await route.fulfill({ status: 204, body: "" });
  });

  await page.route("**/api/development/restore-seed-data", async route => {
    await route.fulfill(jsonResponse({ restored: true }));
  });
}

function requestJson(route) {
  try {
    return route.request().postDataJSON();
  } catch {
    return {};
  }
}

function jsonResponse(data, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(data)
  };
}

async function openNavView(page, view, heading) {
  await page.waitForTimeout(50);
  const headingLocator = page.getByRole("heading", { name: heading, exact: true });
  if (await headingLocator.isVisible()) return;

  const selector = `button[data-view='${view}']`;
  const direct = page.locator(`#nav > ${selector}`);

  if (await direct.isVisible()) {
    await direct.click();
  } else {
    const overflow = page.locator(".nav-overflow-toggle");
    await expect(overflow).toBeVisible();
    await overflow.click();
    await page.locator(`.nav-overflow-menu ${selector}`).click();
  }

  await expect(headingLocator).toBeVisible();
}

async function openUserMenu(page) {
  await page.locator("#userMenuToggle").click();
  await expect(page.locator("#userMenu")).toBeVisible();
}

async function openSettings(page) {
  await openNavView(page, "Settings", "Settings");
}

async function showFilters(page, action) {
  const actions = action.startsWith("toggle-")
    ? [action.replace(/^toggle-/, "open-"), action]
    : [action];
  for (const candidate of actions) {
    const button = page.locator(`[data-action='${candidate}']`).first();
    if (await button.count() && await button.isVisible()) {
      await button.click();
      return;
    }
  }
  await clickPageAction(page, actions[0]);
}

async function closeFilterDialog(page, feature) {
  const closeButton = page.locator(`[data-close-${feature}-filters]`).last();
  await expect(closeButton).toBeVisible();
  await closeButton.click();
  await expect(page.locator(`[data-${feature}-filter-dialog]`)).toHaveCount(0);
}

async function clickPageAction(page, action) {
  await page.locator(".page-actions-summary").click();
  await page.locator(`.page-actions-list [data-action='${action}']`).click();
}

async function expectShellFitsViewport(page) {
  const overflow = await page.locator(".topbar").evaluate(element => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth
  }));

  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 2);
}

async function expectTimelineHasSize(page, selector) {
  const box = await page.locator(selector).boundingBox();
  expect(box?.width || 0).toBeGreaterThan(300);
  expect(box?.height || 0).toBeGreaterThan(120);
}

async function dragFirstTodoCardToInProgress(page) {
  const source = page.locator(".column[data-status='Todo'] .task-card", { hasText: "PMT-TASK-001" }).first();
  const target = page.locator(".column[data-status='In Progress']").first();
  await expect(source).toBeVisible();
  await expect(target).toBeVisible();

  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 80, { steps: 8 });
  await page.mouse.up();
}

async function dragNavigationItemBefore(page, sourceView, targetView) {
  const source = page.locator(`[data-navigation-list] [data-nav-view='${sourceView}'] [data-navigation-drag-handle]`);
  const target = page.locator(`[data-navigation-list] [data-nav-view='${targetView}']`);
  await expect(source).toBeVisible();
  await expect(target).toBeVisible();
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();

  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 4, { steps: 8 });
  await page.mouse.up();
}

async function dragWfhUserBefore(page, sourceUserId, targetUserId) {
  const source = page.locator(`[data-wfh-schedule-list] [data-wfh-user-id='${sourceUserId}'] [data-wfh-drag-handle]`);
  const target = page.locator(`[data-wfh-schedule-list] [data-wfh-user-id='${targetUserId}']`);
  await expect(source).toBeVisible();
  await expect(target).toBeVisible();
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();

  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 4, { steps: 8 });
  await page.mouse.up();
}

function createWfhScheduleRows(users) {
  return users
    .map(user => ({
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      role: user.role,
      canWorkMonday: false,
      canWorkTuesday: false,
      canWorkWednesday: false,
      canWorkThursday: false,
      canWorkFriday: false,
      isHidden: false,
      sortOrder: 0
    }))
    .sort((a, b) => String(a.nickname || "").localeCompare(String(b.nickname || "")) || (a.userId || 0) - (b.userId || 0))
    .map((row, index) => ({ ...row, sortOrder: index + 1 }));
}

function sortWfhRows(rows) {
  return [...rows].sort(wfhRowCompare);
}

function wfhRowCompare(a, b) {
  return (a.sortOrder || 0) - (b.sortOrder || 0)
    || String(a.nickname || "").localeCompare(String(b.nickname || ""))
    || (a.userId || 0) - (b.userId || 0);
}

function createTestState() {
  const users = [
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
    {
      id: 2,
      firstName: "Bill",
      lastName: "Gates",
      nickname: "Bill",
      email: "bill@example.test",
      phone: "",
      avatarUrl: "/assets/avatar-bill-gates.jpg",
      bio: "Developer.",
      isAdmin: false,
      role: "Developer",
      isActive: true
    },
    {
      id: 3,
      firstName: "Sam",
      lastName: "Altman",
      nickname: "Sam",
      email: "sam@example.test",
      phone: "",
      avatarUrl: "/assets/avatar-sam-altman.jpg",
      bio: "QA.",
      isAdmin: false,
      role: "QA",
      isActive: true
    }
  ];

  const projects = [
    project(10, "PMT", "Project Management Tool", "Regression-friendly PMT planning.", "2026-06-01", "2026-08-31", users),
    project(20, "LMS", "Learning Management System", "Training delivery and course operations.", "2026-05-01", "2026-09-30", users),
    project(30, "HLS", "Healthcare Logistics", "Long-range healthcare logistics rollout.", "2026-01-01", "2027-12-31", users)
  ];

  const sprints = [
    sprint(100, 10, "PMT-Sprint01", "Foundation", "2026-06-01", "2026-06-12", users),
    sprint(101, 10, "PMT-Sprint02", "Regression Coverage", "2026-06-15", "2026-06-26", users),
    sprint(200, 20, "LMS-Sprint01", "Catalog", "2026-06-08", "2026-06-19", users),
    sprint(300, 30, "HLS-Sprint01", "Phase Gate", "2026-07-01", "2026-07-19", users)
  ];

  const tasks = [
    task(1, 10, 101, "Dev", "PMT-TASK-001", "Implement smokeable task", "Todo", 15, [2], [], 1, "2026-06-15", "2026-06-19", {
      url: "",
      rootCauseAnalysisHtml: "",
      attachments: [
        {
          id: 901,
          fileName: "task-notes.txt",
          url: "/uploads/tasks/task-notes.txt",
          contentType: "text/plain",
          byteLength: 24
        }
      ]
    }),
    task(2, 10, 101, "Dev", "PMT-TASK-002", "Wire Board interactions", "In Progress", 45, [2], [], 2, "2026-06-16", "2026-06-22"),
    task(3, 10, 101, "Dev", "PMT-TASK-003", "Completed regression sample", "QA Passed", 100, [2], [], 3, "2026-06-17", "2026-06-20"),
    task(4, 10, 101, "Bug", "PMT-BUG-001", "Critical board drag issue", "QA in Progress", 20, [2], [3], 4, "2026-06-18", "2026-06-24", {
      severity: "Critical",
      environment: "SIT",
      stepsToReproduceHtml: "<p>Drag across columns.</p>",
      actualResultHtml: "<p>Status did not update.</p>",
      expectedResultHtml: "<p>Status updates.</p>"
    }),
    task(5, 10, null, "Dev", "PMT-TASK-004", "Backlog planning task", "Backlog", 0, [2], [], 5, "2026-06-20", "2026-06-25"),
    task(6, 20, 200, "Dev", "LMS-TASK-001", "Build catalog smoke data", "In Progress", 35, [2], [], 1, "2026-06-08", "2026-06-18"),
    task(7, 30, 300, "Dev", "HLS-TASK-001", "Plan phase gate", "Ready for QA", 80, [2], [], 1, "2026-07-01", "2026-07-15")
  ];

  const lookups = statuses.map((value, index) => ({
    id: index + 1,
    lookupType: "Status",
    value,
    colorHex: "",
    displayOrder: index + 1,
    isActive: true
  }));

  const state = {
    users,
    projects,
    sprints,
    tasks,
    devLogs: [
      {
        id: 1,
        projectId: 10,
        userId: 1,
        logDate: "2026-06-19",
        bodyHtml: "<p>Validated smoke data and regression coverage.</p>",
        isPinned: true,
        updatedAt: "2026-06-19T09:00:00"
      }
    ],
    blogs: [
      {
        id: 1,
        projectId: 10,
        title: "Smoke Test Notes",
        bodyHtml: "<p>PMT smoke test documentation with https://example.test link.</p>",
        createdByUserId: 1,
        updatedByUserId: 1,
        createdAt: "2026-06-18T08:00:00",
        updatedAt: "2026-06-19T08:00:00",
        attachments: []
      }
    ],
    auditEvents: [],
    lookups,
    holidays: [
      { id: 1, name: "Test Holiday", holidayDate: "2026-06-19", countryCode: "PH", isActive: true }
    ],
    roles: [
      { id: 101, lookupType: "Role", value: "Admin", code: "Admin", displayOrder: 10, isActive: true },
      { id: 102, lookupType: "Role", value: "Dev - Developer", code: "Developer", displayOrder: 20, isActive: true },
      { id: 103, lookupType: "Role", value: "QA - Quality Assurance", code: "QA", displayOrder: 30, isActive: true }
    ],
    securityResources: testSecurityResources(),
    rolePermissions: [],
    userPermissions: [],
    effectivePermissions: []
  };

  state.rolePermissions = state.securityResources.flatMap(resource => ["Developer", "QA"].map(roleCode => ({
    resourceKey: resource.resourceKey,
    roleCode,
    ...testSupportedPermission(resource)
  })));
  state.userPermissions = state.securityResources.flatMap(resource => [2, 3].map(userId => ({
    resourceKey: resource.resourceKey,
    userId,
    canRead: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    canImport: false,
    canExport: false,
    noAccess: false,
    isOverride: false
  })));
  state.effectivePermissions = state.securityResources.map(resource => ({
    resourceKey: resource.resourceKey,
    ...testSupportedPermission(resource)
  }));

  state.tasks.forEach(item => hydrateTaskPeople(state, item));
  return state;
}

function testSecurityResources() {
  return [
    ["Dashboard", "Dashboard", "Read"],
    ["RoadMap", "Road Map", "Read"],
    ["Gantt", "Gantt Chart", "Read"],
    ["Projects", "Projects", "Read,Create,Update,Delete"],
    ["Sprints", "Sprints", "Read,Create,Update,Delete"],
    ["Board", "Kanban Board", "Read,Update,Export"],
    ["DevTasks", "Dev Tasks", "Read,Create,Update,Delete,Import,Export"],
    ["BugTracking", "Bug Tracking", "Read,Create,Update,Delete,Import,Export"],
    ["Scrum", "Scrum", "Read,Create,Update,Delete,Import,Export"],
    ["Documentation", "Documentation", "Read,Create,Update,Delete,Import,Export"],
    ["PersonalLog", "Log", "Read,Create,Update,Delete,Import,Export"],
    ["Backlog", "Backlog", "Read,Create,Update,Delete,Import,Export"],
    ["WfhSchedule", "WFH Schedule", "Read,Update,Export"],
    ["Settings", "Settings", "Read,Create,Update,Delete"]
  ].map(([resourceKey, name, availableRights], index) => ({ resourceKey, name, availableRights, displayOrder: (index + 1) * 10 }));
}

function testSupportedPermission(resource) {
  const rights = new Set(resource.availableRights.split(","));
  return {
    canRead: rights.has("Read"),
    canCreate: rights.has("Create"),
    canUpdate: rights.has("Update"),
    canDelete: rights.has("Delete"),
    canImport: rights.has("Import"),
    canExport: rights.has("Export"),
    noAccess: false
  };
}

function project(id, code, title, description, startDate, endDate, users) {
  return {
    id,
    code,
    title,
    description,
    url: "https://example.test",
    iconUrl: "/assets/project-pmt.svg",
    startDate,
    endDate,
    createdByUserId: 1,
    percentCompleted: 45,
    completedTaskCount: 1,
    taskCount: 4,
    openBugCount: 1,
    bugCount: 1,
    memberIds: users.map(user => user.id),
    members: users
  };
}

function sprint(id, projectId, code, title, startDate, endDate, users) {
  return {
    id,
    projectId,
    code,
    title,
    description: `${title} description`,
    lessonLearnedHtml: "<p>Keep smoke tests deterministic.</p>",
    startDate,
    endDate,
    createdByUserId: 1,
    isFinished: false,
    percentCompleted: 40,
    completedTaskCount: 1,
    taskCount: 3,
    openBugCount: 1,
    bugCount: 1,
    developerIds: users.map(user => user.id),
    developers: users
  };
}

function task(id, projectId, sprintId, taskType, code, title, status, percentCompleted, assigneeIds, reporterIds, sortOrder, startDate, endDate, overrides = {}) {
  return {
    id,
    projectId,
    sprintId,
    parentTaskId: null,
    taskType,
    code,
    title,
    descriptionHtml: `<p>${title}</p>`,
    stepsToReproduceHtml: "",
    actualResultHtml: "",
    expectedResultHtml: "",
    environment: "",
    severity: "",
    status,
    priority: "High",
    percentCompleted,
    url: "https://example.test/work-item",
    startDate,
    endDate,
    startedAt: startDate,
    createdAt: `${startDate}T08:00:00`,
    updatedAt: `${endDate}T17:00:00`,
    createdByUserId: 1,
    linkedBugTaskId: null,
    assigneeIds,
    assignees: [],
    reporterIds,
    reporters: [],
    dependencyTaskIds: [],
    attachments: [],
    subTasks: [],
    subTaskAveragePercent: 0,
    sortOrder,
    auditEvents: [],
    ...overrides
  };
}

function hydrateTaskPeople(appState, task) {
  task.assignees = appState.users.filter(user => (task.assigneeIds || []).includes(user.id));
  task.reporters = appState.users.filter(user => (task.reporterIds || []).includes(user.id));
}
