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

const attendanceStatuses = ["Home", "Office", "Sick Leave", "Vacation", "EL", "Other"];
const smokeToday = "2026-07-15";

test.use({ timezoneId: "Asia/Taipei" });

test("login, navigation, themes, dialogs, filters, Board, Gantt, and Road Map smoke", async ({ page }) => {
  const appState = createTestState();
  appState.tasks.find(task => task.code === "PMT-BUG-001").severity = "1 - Critical";
  appState.lookups.push(
    { id: 201, lookupType: "Severity", value: "4 - Trivial", colorHex: "", displayOrder: 10, isActive: true },
    { id: 202, lookupType: "Severity", value: "3 - Minor", colorHex: "", displayOrder: 20, isActive: true },
    { id: 203, lookupType: "Severity", value: "2 - Major", colorHex: "", displayOrder: 30, isActive: true },
    { id: 204, lookupType: "Severity", value: "1 - Critical", colorHex: "", displayOrder: 40, isActive: true }
  );
  const apiCalls = { clearNonPmt: 0, restoreSeed: 0, restorePmt: 0, securityReset: 0 };
  const browserErrors = [];

  page.on("console", message => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", error => browserErrors.push(error.message));
  page.on("dialog", async dialog => {
    browserErrors.push(`Unexpected browser dialog: ${dialog.type()} ${dialog.message()}`);
    await dialog.dismiss();
  });

  await page.clock.setFixedTime(new Date("2026-07-15T08:00:00+08:00"));

  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("pmt-release-notes-last-seen:1", "2026-07-16-day-29");
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
  await installApiMocks(page, appState, apiCalls);
  await page.route("**/api/usernames/suggestion?**", async route => {
    await route.fulfill(jsonResponse({
      isAvailable: false,
      username: "qa-available-username-with-a-long-readable-suggestion"
    }));
  });

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
    ["Release Notes", "Release Notes"],
    ["Settings", "Settings"]
  ];

  for (const [view, heading] of screens) {
    await openNavView(page, view, heading);
    await expectShellFitsViewport(page);
  }

  await openNavView(page, "Projects", "Projects");
  await page.locator("[data-action='new-project']").click();
  await expect(page.locator("#dialogTitle")).toHaveText("New Project");
  const requiredInputLabel = page.locator(".field:has([name='code']) > label");
  const requiredGroupLabel = page.locator(".check-list:has([name='memberIds']) > legend");
  const optionalInputLabel = page.locator(".field:has([name='startDate']) > label");
  const expectedDangerColor = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--color-danger-text)";
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
  const requiredInputMarker = await requiredInputLabel.evaluate(label => {
    const style = getComputedStyle(label, "::after");
    return { content: style.content, color: style.color };
  });
  const requiredGroupMarker = await requiredGroupLabel.evaluate(label => {
    const style = getComputedStyle(label, "::after");
    return { content: style.content, color: style.color };
  });
  expect(requiredInputMarker).toEqual({ content: '" *"', color: expectedDangerColor });
  expect(requiredGroupMarker).toEqual({ content: '" *"', color: expectedDangerColor });
  await expect(optionalInputLabel).toHaveText("Start");
  expect(await optionalInputLabel.evaluate(label => getComputedStyle(label, "::after").content)).toBe("none");
  await page.locator("#cancelDialog").click();

  await openSettings(page);
  await page.locator("[data-action='select-lookup-type'][data-type='Users']").click();
  await page.locator("[data-action='new-user']").click();
  await expect(page.locator("#dialogTitle")).toHaveText("New User");
  const usernameControl = page.locator("#dialogBody [name='nickname']");
  const roleControl = page.locator("#dialogBody [name='role']");
  const phoneControl = page.locator("#dialogBody [name='phone']");
  const controlTopsBeforeMessage = {
    username: (await usernameControl.boundingBox()).y,
    role: (await roleControl.boundingBox()).y,
    phone: (await phoneControl.boundingBox()).y
  };
  expect(Math.abs(controlTopsBeforeMessage.username - controlTopsBeforeMessage.role)).toBeLessThanOrEqual(1);
  await usernameControl.fill("Sin");
  await roleControl.focus();
  await expect(page.locator("#dialogBody [data-username-help]")).toContainText(
    "That username is already in use. Try qa-available-username-with-a-long-readable-suggestion."
  );
  const controlTopsAfterMessage = {
    username: (await usernameControl.boundingBox()).y,
    role: (await roleControl.boundingBox()).y,
    phone: (await phoneControl.boundingBox()).y
  };
  expect(Math.abs(controlTopsAfterMessage.username - controlTopsAfterMessage.role)).toBeLessThanOrEqual(1);
  expect(Math.abs(controlTopsAfterMessage.username - controlTopsBeforeMessage.username)).toBeLessThanOrEqual(1);
  expect(Math.abs(controlTopsAfterMessage.role - controlTopsBeforeMessage.role)).toBeLessThanOrEqual(1);
  expect(Math.abs(controlTopsAfterMessage.phone - controlTopsBeforeMessage.phone)).toBeLessThanOrEqual(1);
  await page.locator("#cancelDialog").click();

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
  await expect(page.locator(".security-audit-dialog").getByRole("button", { name: "Reset Security" })).toBeVisible();
  await expect(page.locator(".security-audit-table tbody tr")).toHaveCount(42);
  const billAuditDevTasks = page.locator(".security-audit-table tbody tr", { hasText: "Bill Gates" }).filter({ hasText: "Dev Tasks" });
  await expect(billAuditDevTasks.getByRole("img", { name: "Delete: Not granted" })).toBeVisible();
  await expect(billAuditDevTasks.locator("[data-security-audit-status='granted']")).toHaveCount(5);
  const grantedRead = billAuditDevTasks.locator("[data-security-audit-right='canRead'] [data-security-audit-status='granted']");
  await expect(grantedRead.locator("svg")).toBeVisible();
  await expect(grantedRead.locator("circle")).toHaveCSS("fill", "rgb(47, 158, 68)");
  await expect(page.locator(".security-audit-table thead [data-security-audit-column='resource']")).toHaveCSS("text-align", "left");
  await expect(billAuditDevTasks.locator("[data-security-audit-column='resource']")).toHaveCSS("text-align", "left");
  await expect(page.locator(".security-audit-table thead [data-security-audit-column='noAccess']")).toHaveCSS("text-align", "center");
  const billAuditNoAccess = billAuditDevTasks.locator("[data-security-audit-column='noAccess']");
  await expect(billAuditNoAccess).toHaveCSS("text-align", "center");
  await expect(billAuditNoAccess.getByRole("checkbox", { name: "No Access" })).toBeDisabled();
  await expect(billAuditNoAccess.getByRole("checkbox", { name: "No Access" })).not.toBeChecked();
  const downloadPromise = page.waitForEvent("download");
  await page.locator("[data-security-audit-export]").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^pmt-security-audit-.*\.xlsx$/);

  const securityStateBeforeCancelledReset = JSON.stringify({
    rolePermissions: appState.rolePermissions,
    userPermissions: appState.userPermissions
  });
  await page.locator("[data-security-audit-reset]").click();
  await expect(page.getByRole("heading", { name: "Reset Security" })).toBeVisible();
  await expect(page.locator("dialog.mini-dialog")).toContainText("ALL Role permissions across ALL resources will return to their initial defaults");
  await expect(page.locator("dialog.mini-dialog")).toContainText("ALL per-user overrides across ALL resources will be removed");
  await page.getByRole("button", { name: "Cancel" }).click();
  expect(apiCalls.securityReset).toBe(0);
  expect(JSON.stringify({
    rolePermissions: appState.rolePermissions,
    userPermissions: appState.userPermissions
  })).toBe(securityStateBeforeCancelledReset);
  await expect(page.getByRole("heading", { name: "Security Audit" })).toBeVisible();
  await expect(billAuditDevTasks.getByRole("img", { name: "Delete: Not granted" })).toBeVisible();

  await page.locator("[data-security-audit-reset]").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#toast")).toHaveText("Security reset to initial defaults.");
  await expect(page.getByRole("heading", { name: "Security Audit" })).not.toBeVisible();
  expect(apiCalls.securityReset).toBe(1);
  const resetBillSecurityRow = page.locator("[data-security-permission-row][data-security-scope='user'][data-security-principal='2']");
  await expect(resetBillSecurityRow).toHaveAttribute("data-security-override", "false");
  await expect(resetBillSecurityRow.locator("[data-security-right]:checked")).toHaveCount(6);
  await expect(resetBillSecurityRow.locator("[data-action='reset-security-override']")).toBeDisabled();
  const resetDeveloperRole = page.locator("[data-security-permission-row][data-security-scope='role'][data-security-principal='Developer']");
  const resetQaRole = page.locator("[data-security-permission-row][data-security-scope='role'][data-security-principal='QA']");
  await expect(resetDeveloperRole.locator("[data-security-right]:checked")).toHaveCount(6);
  await expect(resetQaRole.locator("[data-security-right]:checked")).toHaveCount(2);
  await expect(resetQaRole.locator("[data-security-right='canRead']")).toBeChecked();
  await expect(resetQaRole.locator("[data-security-right='canExport']")).toBeChecked();
  await expect(resetQaRole.locator("[data-security-right='canCreate']")).not.toBeChecked();

  await page.locator("[data-action='select-lookup-type'][data-type='Development']").click();
  const developmentPanel = page.locator(".development-panel");
  await expect(developmentPanel).toContainText("Warning, buttons on this screen can delete projects or reset the entire database back to its initial installed state. Please do not click buttons on this screen unless you know what you are doing.");
  const developmentRows = developmentPanel.locator(".development-action-row");
  await expect(developmentRows.nth(0).locator("strong")).toHaveText("Clear All Projects Except PMT");
  await expect(developmentRows.nth(0).locator("p")).toHaveText("Deletes Projects other than PMT, including their Sprints, Dev Tasks, Bugs, Scrum, and Documentation, etc. So be careful!");
  const clearNonPmtButton = page.getByRole("button", { name: "Clear All Except PMT", exact: true });
  await expect(clearNonPmtButton).toBeVisible();
  await clearNonPmtButton.click();
  let developmentConfirmation = page.locator("dialog.mini-dialog");
  await expect(developmentConfirmation).toContainText("Clear Projects other than PMT");
  await expect(developmentConfirmation).toContainText("PMT will remain intact");
  await developmentConfirmation.getByRole("button", { name: "Cancel" }).click();
  expect(apiCalls.clearNonPmt).toBe(0);
  await clearNonPmtButton.click();
  developmentConfirmation = page.locator("dialog.mini-dialog");
  await developmentConfirmation.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#toast")).toHaveText("Project data other than PMT cleared.");
  expect(apiCalls.clearNonPmt).toBe(1);

  await expect(developmentRows.nth(3).locator("strong")).toHaveText("Factory Reset PMT");
  await expect(developmentRows.nth(3).locator("p")).toHaveText("This will delete all data in the database and re-seed it with the original demo projects.");
  const factoryResetButton = page.getByRole("button", { name: "Factory Reset PMT", exact: true });
  await expect(factoryResetButton).toBeVisible();
  await factoryResetButton.click();
  developmentConfirmation = page.locator("dialog.mini-dialog");
  await expect(developmentConfirmation).toContainText("Factory reset PMT?");
  await expect(developmentConfirmation).toContainText("delete all data in the database");
  await developmentConfirmation.getByRole("button", { name: "Cancel" }).click();
  expect(apiCalls.restoreSeed).toBe(0);
  await factoryResetButton.click();
  developmentConfirmation = page.locator("dialog.mini-dialog");
  await developmentConfirmation.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#toast")).toHaveText("PMT factory reset completed.");
  expect(apiCalls.restoreSeed).toBe(1);

  const restorePmtButton = page.getByRole("button", { name: "Restore PMT Seed Data" });
  await expect(restorePmtButton).toBeVisible();
  await expect(developmentRows.nth(4).locator("p")).toHaveText("Recreates missing demo users and restores the original PMT demo Project.");
  const developmentActions = await page.locator(".development-action-row strong").allTextContents();
  expect(developmentActions.indexOf("Restore PMT Seed Data"))
    .toBe(developmentActions.indexOf("Factory Reset PMT") + 1);
  await restorePmtButton.click();
  const restorePmtConfirmation = page.locator("dialog.mini-dialog");
  await expect(restorePmtConfirmation).toContainText("Restore the original PMT demo Project and recreate missing demo users?");
  await expect(restorePmtConfirmation).not.toContainText("PMTQA");
  await restorePmtConfirmation.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#toast")).toHaveText("PMT seed data restored.");
  expect(apiCalls.restorePmt).toBe(1);
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
  const severityPill = page.locator(".bugs-table tr[data-task-id='4'] .pill[title='1 - Critical']");
  await expect(severityPill).toHaveText("Critical");
  await expect(severityPill).toHaveAttribute("title", "1 - Critical");
  await expect(severityPill).toHaveClass(/severity-Critical/);
  await showFilters(page, "toggle-bug-filters");
  await page.locator("[data-filter='bug-severity']").selectOption("1 - Critical");
  await expect(page.locator(".bugs-table")).toContainText("PMT-BUG-001");
  await closeFilterDialog(page, "bug");
  const severityLegend = page.locator(".bug-severity-chart-card .chart-legend-row").filter({ hasText: "Critical" });
  await expect(severityLegend.locator("span")).toHaveText("Critical");
  await expect(severityLegend).toHaveAttribute("data-chart-tooltip", "1 - Critical: 1 bug report");
  expect(await severityLegend.locator("i").evaluate(marker => marker.style.getPropertyValue("--chart-color"))).toBe("var(--chart-5)");
  await page.locator(".bugs-table tr[data-task-id='4']").click();
  const bugDetails = page.locator("dialog.detail-dialog");
  await expect(bugDetails.locator("[data-work-item-dialog-field='severity'] [title='1 - Critical']")).toHaveText("Critical");
  await bugDetails.locator("button.primary[data-close]").click();

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

  const expectedAnonymousSessionErrors = browserErrors.filter(message => /status of 401 \(Unauthorized\)/.test(message));
  expect(expectedAnonymousSessionErrors).toHaveLength(1);
  expect(browserErrors.filter(message => !expectedAnonymousSessionErrors.includes(message))).toEqual([]);
});

test("Developer Board moves stop after QA Passed while QA Ready remains available", async ({ page }) => {
  const appState = createTestState();
  const apiCalls = { securityReset: 0, sessionUserId: 2, taskSaves: [] };

  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("pmt-release-notes-last-seen:2", "2026-07-16-day-29");
  });
  await installApiMocks(page, appState, apiCalls);
  await page.goto("/");
  await openNavView(page, "Board", "Kanban Board");
  await showFilters(page, "open-board-filters");
  const testedStatuses = new Set(["Todo", "Ready for QA", "QA Passed", "Deployed in SIT"]);
  for (const status of statuses) {
    const checkbox = page.locator(`[data-filter='board-status'][value='${status}']`);
    if (testedStatuses.has(status)) {
      await checkbox.check();
    } else {
      await checkbox.uncheck();
    }
  }
  await closeFilterDialog(page, "board");
  await expect(page.locator(".column")).toHaveCount(testedStatuses.size);
  await page.locator("[data-action='toggle-board-edit-mode']").click();

  await dragBoardTaskToStatus(page, "PMT-TASK-001", "Ready for QA");
  await expect(page.locator(".column[data-status='Ready for QA']")).toContainText("PMT-TASK-001");

  await dragBoardTaskToStatus(page, "PMT-TASK-001", "QA Passed");
  await expect(page.locator(".column[data-status='QA Passed']")).toContainText("PMT-TASK-001");

  await dragBoardTaskToStatus(page, "PMT-TASK-001", "Deployed in SIT");
  await expect(page.locator("#toast")).toHaveText("Developers can move Dev Tasks through QA Passed, but not to deployment statuses.");
  await expect(page.locator(".column[data-status='QA Passed']")).toContainText("PMT-TASK-001");
  expect(apiCalls.taskSaves).toHaveLength(2);
});

test("Scrum attendance, calendar, on-behalf, and vacation flows stay synchronized", async ({ page }) => {
  const appState = createTestState();
  const apiCalls = { holdAttendanceGets: true, securityReset: 0, sessionUserId: 1 };
  const browserErrors = [];

  page.on("console", message => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", error => browserErrors.push(error.message));

  await page.clock.setFixedTime(new Date("2026-07-15T08:00:00+08:00"));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("pmt-scrum-attendance-smoke-started")) {
      localStorage.clear();
      sessionStorage.setItem("pmt-scrum-attendance-smoke-started", "true");
    }
    localStorage.setItem("pmt-release-notes-last-seen:1", "2026-07-16-day-29");
  });
  await installApiMocks(page, appState, apiCalls);

  await page.goto("/");
  await openNavView(page, "Scrum", "Scrum");

  const scrumHeader = page.locator(".scrum-screen .section-head");
  const scrumTablePanel = page.locator(".scrum-table-panel");
  const scrumViewToggle = page.locator(".scrum-view-toggle");
  const tableViewButton = page.locator("[data-action='set-scrum-view'][data-mode='table']");
  const calendarViewButton = page.locator("[data-action='set-scrum-view'][data-mode='calendar']");
  await expect.poll(() => typeof apiCalls.releaseAttendanceGets).toBe("function");
  await expect(page.locator("[data-scrum-attendance-roster] [data-scrum-today-user]")).toHaveCount(0);
  const headerBeforeAttendance = await scrumHeader.boundingBox();
  const tableBeforeAttendance = await scrumTablePanel.boundingBox();
  const toggleBeforeAttendance = await scrumViewToggle.boundingBox();
  apiCalls.releaseAttendanceGets();

  const attendanceSelect = page.locator("[data-scrum-attendance-select]");
  await expect(attendanceSelect).toBeVisible();
  await expect(attendanceSelect).toHaveValue("Office");
  const attendanceLabels = (await attendanceSelect.locator("option").allTextContents()).map(label => label.trim());
  for (const label of ["🏠 Home", "🏢 Office", "🤒 Sick Leave", "☀ Vacation", "⚠ EL", "… Other"]) {
    expect(attendanceLabels).toContain(label);
  }
  await expect(attendanceSelect.locator("option[value='EL']")).toHaveAttribute("title", "Emergency Leave");

  await expect(scrumTodayStatus(page, 1, "Office")).toBeVisible();
  await expect(scrumTodayStatus(page, 2, "Home")).toBeVisible();
  await expect(scrumTodayStatus(page, 3, "Vacation")).toBeVisible();
  const headerAfterAttendance = await scrumHeader.boundingBox();
  const tableAfterAttendance = await scrumTablePanel.boundingBox();
  const toggleAfterAttendance = await scrumViewToggle.boundingBox();
  expect(headerBeforeAttendance).not.toBeNull();
  expect(tableBeforeAttendance).not.toBeNull();
  expect(toggleBeforeAttendance).not.toBeNull();
  expect(headerAfterAttendance).not.toBeNull();
  expect(tableAfterAttendance).not.toBeNull();
  expect(toggleAfterAttendance).not.toBeNull();
  expect(headerAfterAttendance.height).toBeCloseTo(headerBeforeAttendance.height, 0);
  expect(tableAfterAttendance.y).toBeCloseTo(tableBeforeAttendance.y, 0);
  expect(toggleAfterAttendance.x).toBeCloseTo(toggleBeforeAttendance.x, 0);
  expect(toggleAfterAttendance.y).toBeCloseTo(toggleBeforeAttendance.y, 0);
  const titleAvatarBox = await page.locator(".scrum-today-avatar").first().boundingBox();
  const statusBadgeBox = await page.locator(".scrum-attendance-badge").first().boundingBox();
  const scrumScreenBox = await page.locator(".scrum-screen").boundingBox();
  expect(titleAvatarBox).not.toBeNull();
  expect(statusBadgeBox).not.toBeNull();
  expect(scrumScreenBox).not.toBeNull();
  expect(titleAvatarBox.width).toBeCloseTo(80, 0);
  expect(titleAvatarBox.height).toBeCloseTo(80, 0);
  expect(statusBadgeBox.width).toBeGreaterThanOrEqual(28);
  expect(statusBadgeBox.height).toBeGreaterThanOrEqual(28);
  expect(titleAvatarBox.y + titleAvatarBox.height / 2)
    .toBeCloseTo((scrumScreenBox.y + tableAfterAttendance.y) / 2, 0);
  await expect(tableViewButton).toHaveAttribute("aria-pressed", "true");
  await expect(calendarViewButton).toHaveAttribute("aria-pressed", "false");
  expect(await page.locator("[data-scrum-today-user]").evaluateAll(buttons => buttons.every((button, index) => {
    const box = button.getBoundingClientRect();
    return buttons.slice(index + 1).every(other => {
      const otherBox = other.getBoundingClientRect();
      return box.right <= otherBox.left || otherBox.right <= box.left || box.bottom <= otherBox.top || otherBox.bottom <= box.top;
    });
  }))).toBe(true);

  const billRosterButton = scrumTodayPersonButton(page, 2);
  await billRosterButton.click();
  await expect(page.locator(".scrum-table tbody")).toContainText("No Scrum entries match");
  await showFilters(page, "open-scrum-filters");
  await expect(page.locator("[data-filter='scrum-person'][value='2']")).toBeChecked();
  await expect(page.locator("[data-filter='scrum-person']:checked")).toHaveCount(1);
  await page.locator("[data-filter='scrum-person'][value='1']").check();
  await expect(scrumTodayPersonButton(page, 1)).toHaveAttribute("aria-pressed", "true");
  await expect(scrumTodayPersonButton(page, 2)).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-filter='scrum-person'][value='3']").check();
  await expect(page.locator("[data-filter='scrum-person']:checked")).toHaveCount(3);
  for (const userId of [1, 2, 3]) {
    await expect(scrumTodayPersonButton(page, userId)).toHaveAttribute("aria-pressed", "true");
  }
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("pmt-scrum-filters") || "{}").personIds || []))
    .toEqual(["1", "2", "3"]);
  await page.getByRole("button", { name: "Done" }).click();

  await attendanceSelect.selectOption("Other");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("pmt-scrum-attendance-status"))).toBe("Other");
  await page.locator("[data-action='check-in-attendance']").click();
  await expect.poll(() => appState.attendanceEntries.some(item => item.userId === 1
    && item.attendanceDate === smokeToday
    && item.status === "Other")).toBe(true);
  await expect(scrumTodayStatus(page, 1, "Other")).toBeVisible();
  await page.reload();
  await expect(attendanceSelect).toHaveValue("Other");
  await expect(scrumTodayStatus(page, 1, "Other")).toBeVisible();

  await page.locator(".page-actions-summary").click();
  const scrumActions = page.locator(".page-actions-list");
  await expect(scrumActions).not.toContainText("Graphs");
  await expect(scrumActions.locator("[data-action='toggle-scrum-calendar']")).toHaveCount(0);
  await expect(scrumActions.locator("[data-action='open-scrum-on-behalf']")).toContainText("On Behalf Of...");
  await expect(scrumActions.locator("[data-action='open-scrum-vacation']")).toContainText("Vacation...");
  await page.locator(".page-actions-summary").click();
  const headerBeforeCalendar = await scrumHeader.boundingBox();
  const toggleBeforeCalendar = await scrumViewToggle.boundingBox();
  await calendarViewButton.click();
  await expect(tableViewButton).toHaveAttribute("aria-pressed", "false");
  await expect(calendarViewButton).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("pmt-scrum-calendar-visible"))).toBe("true");

  const calendar = page.locator("[data-scrum-calendar]");
  const todayCell = calendar.locator(`[data-scrum-calendar-day='${smokeToday}']`);
  await expect(calendar).toBeVisible();
  await expect(todayCell.locator("[data-attendance-status='Office']").first()).toBeVisible();
  await expect(todayCell.locator("[data-attendance-status='Home']").first()).toBeVisible();
  await expect(todayCell.locator("[data-attendance-status='Vacation']").first()).toBeVisible();
  await expect(todayCell.locator("[data-attendance-status='Other']").first()).toBeVisible();
  await expect(todayCell.locator("[data-attendance-status='Office'] [data-scrum-calendar-user='1']")).toHaveCount(1);
  await expect(todayCell.locator("[data-attendance-status='Other'] [data-scrum-calendar-user='1']")).toHaveCount(1);
  const officeAvatarBox = await todayCell.locator("[data-attendance-status='Office'] .scrum-calendar-avatar").first().boundingBox();
  const homeAvatarBox = await todayCell.locator("[data-attendance-status='Home'] .scrum-calendar-avatar").first().boundingBox();
  expect(officeAvatarBox).not.toBeNull();
  expect(homeAvatarBox).not.toBeNull();
  expect(officeAvatarBox.width).toBeGreaterThan(homeAvatarBox.width);
  await expect(todayCell.locator("[data-attendance-status='Home']")).toHaveCSS("border-top-width", /[1-9]/);
  const officeOnlyCell = calendar.locator("[data-scrum-calendar-day='2026-07-18']");
  await expect(officeOnlyCell.locator("[data-attendance-status]")).toHaveCount(1);
  await expect(officeOnlyCell.locator("[data-attendance-status='Office']")).toHaveCSS("border-top-width", "0px");
  await expect(todayCell.locator("[data-scrum-holiday]")).toHaveCount(2);
  await expect(todayCell).toContainText("Smoke Holiday");
  await expect(todayCell).toContainText("Second Smoke Holiday");
  await expect(todayCell).not.toContainText("Inactive Holiday");

  const calendarBox = await calendar.boundingBox();
  const tableBox = await page.locator(".scrum-table").boundingBox();
  const headerAfterCalendar = await scrumHeader.boundingBox();
  const toggleAfterCalendar = await scrumViewToggle.boundingBox();
  expect(calendarBox).not.toBeNull();
  expect(tableBox).not.toBeNull();
  expect(headerBeforeCalendar).not.toBeNull();
  expect(toggleBeforeCalendar).not.toBeNull();
  expect(headerAfterCalendar).not.toBeNull();
  expect(toggleAfterCalendar).not.toBeNull();
  expect(headerAfterCalendar.height).toBeCloseTo(headerBeforeCalendar.height, 0);
  expect(toggleAfterCalendar.x).toBeCloseTo(toggleBeforeCalendar.x, 0);
  expect(toggleAfterCalendar.y).toBeCloseTo(toggleBeforeCalendar.y, 0);
  expect(calendarBox.y + calendarBox.height).toBeLessThanOrEqual(tableBox.y + 1);

  const ownOfficeAttendance = scrumCalendarOccurrenceButton(page, smokeToday, 1, "Office", "attendance");
  await ownOfficeAttendance.click();
  let avatarMenu = page.locator("[data-scrum-calendar-avatar-menu]");
  await expect(avatarMenu).toBeVisible();
  await expect(avatarMenu.getByRole("menuitem", { name: "Remove" })).toBeEnabled();
  await expect(avatarMenu.getByRole("menuitem", { name: "Cancel" })).toBeEnabled();
  await avatarMenu.getByRole("menuitem", { name: "Cancel" }).click();
  await expect(avatarMenu).toHaveCount(0);
  expect(appState.attendanceEntries.some(item => item.id === 1)).toBe(true);

  await scrumCalendarOccurrenceButton(page, smokeToday, 3, "Vacation", "vacation").click();
  avatarMenu = page.locator("[data-scrum-calendar-avatar-menu]");
  await expect(avatarMenu.getByRole("menuitem", { name: "Remove" })).toBeDisabled();
  await avatarMenu.getByRole("menuitem", { name: "Cancel" }).click();
  await expect(avatarMenu).toHaveCount(0);

  await ownOfficeAttendance.click();
  avatarMenu = page.locator("[data-scrum-calendar-avatar-menu]");
  await avatarMenu.getByRole("menuitem", { name: "Remove" }).click();
  await expect.poll(() => appState.attendanceEntries.some(item => item.id === 1)).toBe(false);
  await expect(scrumCalendarOccurrenceButton(page, smokeToday, 1, "Office", "attendance")).toHaveCount(0);

  const monthSelect = page.locator("[data-scrum-calendar-month]");
  const startingMonth = await monthSelect.inputValue();
  await page.locator("[data-action='scrum-calendar-previous']").click();
  await expect(monthSelect).not.toHaveValue(startingMonth);
  await expect(page.locator("[data-action='scrum-calendar-previous']")).toBeFocused();
  await expect(calendar.locator("[data-scrum-calendar-day='2026-06-01']")).toBeVisible();
  await expect(page.locator("[data-action='scrum-calendar-previous']")).toBeFocused();
  await page.locator("[data-action='scrum-calendar-next']").click();
  await expect(monthSelect).toHaveValue(startingMonth);
  await expect(page.locator("[data-action='scrum-calendar-next']")).toBeFocused();
  await monthSelect.selectOption({ label: "February" });
  await expect(monthSelect).toBeFocused();
  await page.locator("[data-scrum-calendar-year]").selectOption("2024");
  await expect(calendar.locator("[data-scrum-calendar-day='2024-02-29']")).toBeVisible();
  await expect(page.locator("[data-scrum-calendar-year]")).toBeFocused();
  await page.locator("[data-action='scrum-calendar-today']").click();
  await expect(calendar.locator(`[data-scrum-calendar-day='${smokeToday}']`)).toBeVisible();
  await expect(page.locator("[data-action='scrum-calendar-today']")).toBeFocused();

  await clickPageAction(page, "open-scrum-on-behalf");
  const onBehalfDialog = page.locator("[data-scrum-on-behalf-dialog]");
  await expect(onBehalfDialog.getByRole("heading", { name: "On Behalf Of" })).toBeVisible();
  await expectDialogLabelledByOwnHeading(onBehalfDialog, "On Behalf Of");
  await expect(onBehalfDialog.getByLabel("Person", { exact: true })).toBeVisible();
  await expect(onBehalfDialog.getByLabel("Date", { exact: true })).toHaveValue(smokeToday);
  await expect(onBehalfDialog.getByLabel("Attendance", { exact: true })).toBeVisible();
  await onBehalfDialog.getByLabel("Person", { exact: true }).selectOption("3");
  await onBehalfDialog.getByLabel("Date", { exact: true }).fill("2026-07-14");
  await onBehalfDialog.getByLabel("Attendance", { exact: true }).selectOption("EL");
  await onBehalfDialog.locator("button[type='submit']").click();
  await expect.poll(() => appState.attendanceEntries.some(item => item.userId === 3
    && item.attendanceDate === "2026-07-14"
    && item.status === "EL"
    && item.recordedByUserId === 1)).toBe(true);
  await expect(calendar.locator("[data-scrum-calendar-day='2026-07-14']")
    .locator("[data-attendance-status='EL'] [data-scrum-calendar-user='3']")).toBeVisible();

  await clickPageAction(page, "open-scrum-vacation");
  const vacationDialog = page.locator("[data-scrum-vacation-dialog]");
  await expect(vacationDialog.getByRole("heading", { name: "Vacation", exact: true })).toBeVisible();
  await expectDialogLabelledByOwnHeading(vacationDialog, "Vacation");
  await expect(vacationDialog.getByLabel("Start Date", { exact: true })).toBeVisible();
  await expect(vacationDialog.getByLabel("End Date", { exact: true })).toBeVisible();
  await vacationDialog.getByLabel("Start Date", { exact: true }).fill("2026-08-10");
  await vacationDialog.getByLabel("End Date", { exact: true }).fill("2026-08-12");
  await vacationDialog.locator("button[type='submit']").click();
  await expect.poll(() => appState.vacationPlans.some(item => item.userId === 1
    && item.startDate === "2026-08-10"
    && item.endDate === "2026-08-12"
    && !item.isCancelled)).toBe(true);

  await vacationDialog.locator("[data-close-scrum-vacation]").last().click();
  await monthSelect.selectOption({ label: "August" });
  for (const day of [10, 11, 12]) {
    await expect(scrumCalendarVacationAvatar(page, `2026-08-${String(day).padStart(2, "0")}`, 1)).toBeVisible();
  }

  await clickPageAction(page, "open-scrum-vacation");
  await vacationDialog.locator("[data-edit-scrum-vacation]").click();
  await expect(vacationDialog.getByLabel("Start Date", { exact: true })).toHaveValue("2026-08-10");
  await vacationDialog.getByLabel("Start Date", { exact: true }).fill("2026-08-11");
  await vacationDialog.getByLabel("End Date", { exact: true }).fill("2026-08-14");
  await vacationDialog.locator("button[type='submit']").click();
  await expect.poll(() => appState.vacationPlans.some(item => item.userId === 1
    && item.startDate === "2026-08-11"
    && item.endDate === "2026-08-14"
    && !item.isCancelled)).toBe(true);

  await vacationDialog.locator("[data-close-scrum-vacation]").last().click();
  await expect(scrumCalendarVacationAvatar(page, "2026-08-10", 1)).toHaveCount(0);
  for (const day of [11, 12, 13, 14]) {
    await expect(scrumCalendarVacationAvatar(page, `2026-08-${day}`, 1)).toBeVisible();
  }

  await scrumCalendarOccurrenceButton(page, "2026-08-11", 1, "Vacation", "vacation").click();
  avatarMenu = page.locator("[data-scrum-calendar-avatar-menu]");
  await expect(avatarMenu.getByRole("menuitem", { name: "Remove" })).toBeEnabled();
  await avatarMenu.getByRole("menuitem", { name: "Remove" }).click();
  await expect.poll(() => appState.vacationPlans.some(item => item.userId === 1 && item.isCancelled)).toBe(true);
  for (const day of [11, 12, 13, 14]) {
    await expect(scrumCalendarVacationAvatar(page, `2026-08-${day}`, 1)).toHaveCount(0);
  }

  await tableViewButton.click();
  await expect(tableViewButton).toHaveAttribute("aria-pressed", "true");
  await expect(calendarViewButton).toHaveAttribute("aria-pressed", "false");
  await expect(calendar).toHaveCount(0);
  await expect(scrumTablePanel).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("pmt-scrum-calendar-visible"))).toBe("false");

  await clickPageAction(page, "reset-scrum-view");
  await expect(attendanceSelect).toHaveValue("Office");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("pmt-scrum-attendance-status"))).toBeNull();

  expect(browserErrors).toEqual([]);
});

test("Scrum view toggle matches Documentation and crowded attendance avatars fit its header lane", async ({ page }) => {
  const appState = createTestState();
  const apiCalls = { securityReset: 0, sessionUserId: 1 };
  const addedUsers = Array.from({ length: 7 }, (_, index) => {
    const id = index + 4;
    return {
      id,
      firstName: `Team${id}`,
      lastName: "Member",
      nickname: `Team ${id}`,
      email: `team${id}@example.test`,
      phone: "",
      avatarUrl: "/assets/avatar-default.svg",
      bio: "Developer.",
      isAdmin: false,
      role: "Developer",
      isActive: true
    };
  });
  appState.users.push(...addedUsers);
  appState.attendanceEntries.push(...addedUsers.map((user, index) => ({
    id: index + 20,
    userId: user.id,
    attendanceDate: smokeToday,
    status: "Office",
    recordedByUserId: user.id,
    createdAt: `${smokeToday}T00:00:00Z`,
    updatedAt: `${smokeToday}T00:00:00Z`
  })));

  await page.clock.setFixedTime(new Date("2026-07-15T08:00:00+08:00"));
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("pmt-release-notes-last-seen:1", "2026-07-16-day-29");
  });
  await installApiMocks(page, appState, apiCalls);

  await page.goto("/");
  await openNavView(page, "Scrum", "Scrum");
  const scrumRoster = page.locator("[data-scrum-attendance-roster]");
  await expect(scrumRoster.locator("[data-scrum-today-user]")).toHaveCount(10);

  const scrumLayout = await page.locator(".scrum-screen .section-head").evaluate(header => {
    const title = header.querySelector("h1");
    const toggle = header.querySelector(".scrum-view-toggle");
    const toggleButton = toggle.querySelector(".scrum-view-toggle-button");
    const icon = toggleButton.querySelector(".button-icon");
    const label = toggleButton.querySelector(".button-icon + span");
    const rosterButtons = [...header.querySelectorAll("[data-scrum-today-user]")];
    const headerBox = header.getBoundingClientRect();
    const titleBox = title.getBoundingClientRect();
    const toggleBox = toggle.getBoundingClientRect();
    const actionBox = header.querySelector("[data-scrum-attendance-control]").getBoundingClientRect();
    const avatarBoxes = rosterButtons.map(button => button.getBoundingClientRect());
    const avatarImageBoxes = rosterButtons.map(button => button.querySelector(".scrum-today-avatar").getBoundingClientRect());
    const buttonStyle = getComputedStyle(toggleButton);
    const iconStyle = getComputedStyle(icon);
    const labelStyle = getComputedStyle(label);
    return {
      avatarBoxes: avatarBoxes.map(box => ({ left: box.left, right: box.right })),
      avatarWidths: avatarImageBoxes.map(box => box.width),
      buttonHeight: toggleButton.getBoundingClientRect().height,
      buttonFontSize: labelStyle.fontSize,
      buttonGap: buttonStyle.columnGap,
      headerCenter: headerBox.left + headerBox.width / 2,
      iconFontSize: iconStyle.fontSize,
      titleTop: titleBox.top,
      titleRight: titleBox.right,
      toggleCenter: toggleBox.left + toggleBox.width / 2,
      toggleLeft: toggleBox.left,
      toggleRight: toggleBox.right,
      toggleVerticalRatio: (toggleBox.top + toggleBox.height / 2 - headerBox.top) / headerBox.height,
      actionLeft: actionBox.left
    };
  });

  expect(scrumLayout.toggleCenter).toBeCloseTo(scrumLayout.headerCenter, 0);
  expect(scrumLayout.toggleVerticalRatio).toBeCloseTo(0.5, 2);
  expect(scrumLayout.avatarWidths.every(width => width > 0 && width < 80)).toBe(true);
  expect(scrumLayout.avatarBoxes[0].left).toBeGreaterThanOrEqual(scrumLayout.titleRight);
  expect(scrumLayout.avatarBoxes.at(-1).right).toBeLessThanOrEqual(scrumLayout.toggleLeft);
  expect(scrumLayout.toggleRight).toBeLessThanOrEqual(scrumLayout.actionLeft);
  expect(scrumLayout.avatarBoxes.every((box, index) => index === 0 || scrumLayout.avatarBoxes[index - 1].right <= box.left)).toBe(true);

  await openNavView(page, "Tasks", "Dev Tasks");
  const devTaskTitleTop = await page.locator(".tasks-screen .section-head h1").evaluate(title => title.getBoundingClientRect().top);
  expect(scrumLayout.titleTop).toBeCloseTo(devTaskTitleTop, 0);

  await openNavView(page, "Documentation", "Documentation");
  const documentationLayout = await page.locator(".documentation-screen .section-head").evaluate(header => {
    const toggle = header.querySelector(".documentation-view-toggle");
    const toggleButton = toggle.querySelector(".documentation-view-toggle-button");
    const icon = toggleButton.querySelector(".button-icon");
    const label = toggleButton.querySelector(".button-icon + span");
    const search = header.querySelector("[data-idle-filter-header-search-control]");
    const headerBox = header.getBoundingClientRect();
    const toggleBox = toggle.getBoundingClientRect();
    const searchBox = search.getBoundingClientRect();
    const buttonStyle = getComputedStyle(toggleButton);
    return {
      buttonHeight: toggleButton.getBoundingClientRect().height,
      buttonFontSize: getComputedStyle(label).fontSize,
      buttonGap: buttonStyle.columnGap,
      headerCenter: headerBox.left + headerBox.width / 2,
      iconFontSize: getComputedStyle(icon).fontSize,
      searchCenter: searchBox.left + searchBox.width / 2,
      toggleVerticalRatio: (toggleBox.top + toggleBox.height / 2 - headerBox.top) / headerBox.height
    };
  });

  expect(documentationLayout.searchCenter).toBeCloseTo(documentationLayout.headerCenter, 0);
  expect(scrumLayout.buttonHeight).toBeCloseTo(documentationLayout.buttonHeight, 0);
  expect(scrumLayout.buttonFontSize).toBe(documentationLayout.buttonFontSize);
  expect(scrumLayout.buttonGap).toBe(documentationLayout.buttonGap);
  expect(scrumLayout.iconFontSize).toBe(documentationLayout.iconFontSize);
  expect(scrumLayout.toggleVerticalRatio).toBeCloseTo(documentationLayout.toggleVerticalRatio, 2);
});

test("Scrum auto-refresh updates the table and attendance without reload or interaction loss", async ({ page }) => {
  const appState = createTestState();
  const apiCalls = { securityReset: 0, sessionUserId: 1, stateGets: 0 };
  for (let index = 0; index < 14; index += 1) {
    appState.devLogs.push({
      id: 100 + index,
      projectId: 10,
      userId: 2,
      logDate: smokeToday,
      bodyHtml: `<p>Existing Bill Scrum row ${index + 1}</p>`,
      isPinned: false,
      createdAt: `${smokeToday}T00:00:00Z`,
      updatedAt: `${smokeToday}T00:00:00Z`
    });
  }

  await page.clock.install({ time: new Date("2026-07-15T08:00:00+08:00") });
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("pmt-release-notes-last-seen:1", "2026-07-16-day-29");
  });
  await installApiMocks(page, appState, apiCalls);

  let documentNavigationRequests = 0;
  page.on("request", request => {
    if (request.isNavigationRequest() && request.resourceType() === "document") documentNavigationRequests += 1;
  });
  await page.goto("/");
  documentNavigationRequests = 0;
  await openNavView(page, "Scrum", "Scrum");
  await expect(scrumTodayStatus(page, 2, "Home")).toBeVisible();

  const initialStateGets = apiCalls.stateGets;
  const attendanceSelect = page.locator("[data-scrum-attendance-select]");
  await attendanceSelect.selectOption("Other");
  await page.clock.fastForward(5000);
  expect(apiCalls.stateGets).toBe(initialStateGets);
  await expect(attendanceSelect).toHaveValue("Other");

  await openNavView(page, "Documentation", "Documentation");
  await page.clock.fastForward(5000);
  expect(apiCalls.stateGets).toBe(initialStateGets);
  await openNavView(page, "Scrum", "Scrum");
  await expect(scrumTodayStatus(page, 2, "Home")).toBeVisible();
  await scrumTodayPersonButton(page, 2).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("pmt-scrum-filters") || "{}").personIds || []))
    .toEqual(["2"]);

  const header = page.locator(".scrum-screen .section-head");
  const tablePanel = page.locator(".scrum-table-panel");
  const pageActions = page.locator(".page-actions-menu");
  const pageActionsSummary = page.locator(".page-actions-summary");
  await pageActionsSummary.click();
  await pageActionsSummary.focus();
  await expect(pageActions).toHaveAttribute("open", "");
  await expect(page.locator("[data-action='toggle-scrum-auto-refresh']")).toHaveAttribute("aria-checked", "true");

  const scrollBefore = await page.evaluate(() => {
    const app = document.querySelector("#app");
    const tableWrap = document.querySelector(".scrum-table-wrap");
    app.scrollTop = 120;
    tableWrap.scrollLeft = 90;
    return { appTop: app.scrollTop, tableLeft: tableWrap.scrollLeft };
  });
  const headerBefore = await header.boundingBox();
  const tableBefore = await tablePanel.boundingBox();

  appState.devLogs.push({
    id: 999,
    projectId: 10,
    userId: 2,
    logDate: smokeToday,
    bodyHtml: "<p>Five-second refreshed Scrum entry</p>",
    isPinned: false,
    createdAt: `${smokeToday}T12:00:00Z`,
    updatedAt: `${smokeToday}T12:00:00Z`
  });
  appState.attendanceEntries.push({
    id: 99,
    userId: 2,
    attendanceDate: smokeToday,
    status: "Sick Leave",
    recordedByUserId: 2,
    createdAt: `${smokeToday}T12:00:00Z`,
    updatedAt: `${smokeToday}T12:00:00Z`
  });

  const stateGetsBeforeRefresh = apiCalls.stateGets;
  await page.clock.fastForward(4999);
  expect(apiCalls.stateGets).toBe(stateGetsBeforeRefresh);
  await expect(page.locator(".scrum-table tbody")).not.toContainText("Five-second refreshed Scrum entry");
  await page.clock.fastForward(1);
  await expect.poll(() => apiCalls.stateGets).toBe(stateGetsBeforeRefresh + 1);
  await expect(page.locator(".scrum-table tbody")).toContainText("Five-second refreshed Scrum entry");
  await expect(scrumTodayStatus(page, 2, "Sick Leave")).toBeVisible();

  const headerAfter = await header.boundingBox();
  const tableAfter = await tablePanel.boundingBox();
  expect(headerAfter.x).toBeCloseTo(headerBefore.x, 0);
  expect(headerAfter.y).toBeCloseTo(headerBefore.y, 0);
  expect(headerAfter.width).toBeCloseTo(headerBefore.width, 0);
  expect(headerAfter.height).toBeCloseTo(headerBefore.height, 0);
  expect(tableAfter.x).toBeCloseTo(tableBefore.x, 0);
  expect(tableAfter.y).toBeCloseTo(tableBefore.y, 0);
  expect(tableAfter.width).toBeCloseTo(tableBefore.width, 0);
  expect(documentNavigationRequests).toBe(0);
  await expect(pageActions).toHaveAttribute("open", "");
  await expect(pageActionsSummary).toBeFocused();
  await expect(scrumTodayPersonButton(page, 2)).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => ({
    appTop: document.querySelector("#app").scrollTop,
    tableLeft: document.querySelector(".scrum-table-wrap").scrollLeft
  }))).toEqual(scrollBefore);

  await page.locator("[data-action='toggle-scrum-auto-refresh']").click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("pmt-scrum-auto-refresh"))).toBe("false");
  const stateGetsWhenDisabled = apiCalls.stateGets;
  appState.devLogs.push({
    id: 1000,
    projectId: 10,
    userId: 2,
    logDate: smokeToday,
    bodyHtml: "<p>Must wait while refresh is off</p>",
    isPinned: false,
    createdAt: `${smokeToday}T13:00:00Z`,
    updatedAt: `${smokeToday}T13:00:00Z`
  });
  await page.clock.fastForward(10000);
  expect(apiCalls.stateGets).toBe(stateGetsWhenDisabled);
  await expect(page.locator(".scrum-table tbody")).not.toContainText("Must wait while refresh is off");

  await openNavView(page, "Documentation", "Documentation");
  await openNavView(page, "Scrum", "Scrum");
  await pageActionsSummary.click();
  await expect(page.locator("[data-action='toggle-scrum-auto-refresh']")).toHaveAttribute("aria-checked", "false");
  await page.locator("[data-action='toggle-scrum-auto-refresh']").click();
  const stateGetsBeforeInactiveScreen = apiCalls.stateGets;
  await openNavView(page, "Documentation", "Documentation");
  await page.clock.fastForward(5000);
  expect(apiCalls.stateGets).toBe(stateGetsBeforeInactiveScreen);
});

test("Scrum auto-refresh invalidates the visible Calendar month without shifting its view", async ({ page }) => {
  const appState = createTestState();
  const apiCalls = { securityReset: 0, sessionUserId: 1, stateGets: 0 };
  await page.clock.install({ time: new Date("2026-07-15T08:00:00+08:00") });
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("pmt-release-notes-last-seen:1", "2026-07-16-day-29");
  });
  await installApiMocks(page, appState, apiCalls);

  let documentNavigationRequests = 0;
  page.on("request", request => {
    if (request.isNavigationRequest() && request.resourceType() === "document") documentNavigationRequests += 1;
  });
  await page.goto("/");
  documentNavigationRequests = 0;
  await openNavView(page, "Scrum", "Scrum");
  await page.locator("[data-action='set-scrum-view'][data-mode='calendar']").click();
  const calendar = page.locator("[data-scrum-calendar]");
  const todayCell = calendar.locator(`[data-scrum-calendar-day='${smokeToday}']`);
  await expect(todayCell.locator("[data-attendance-status='Home'] [data-scrum-calendar-user='2']")).toBeVisible();

  const header = page.locator(".scrum-screen .section-head");
  const toggle = page.locator(".scrum-view-toggle");
  const tablePanel = page.locator(".scrum-table-panel");
  await page.locator("[data-action='scrum-calendar-next']").focus();
  const scrollBefore = await page.evaluate(() => {
    const app = document.querySelector("#app");
    const calendarWrap = document.querySelector(".scrum-calendar-grid-wrap");
    const tableWrap = document.querySelector(".scrum-table-wrap");
    app.scrollTop = 80;
    calendarWrap.scrollLeft = 70;
    calendarWrap.scrollTop = 20;
    tableWrap.scrollLeft = 60;
    return {
      appTop: app.scrollTop,
      calendarLeft: calendarWrap.scrollLeft,
      calendarTop: calendarWrap.scrollTop,
      tableLeft: tableWrap.scrollLeft
    };
  });
  const headerBefore = await header.boundingBox();
  const toggleBefore = await toggle.boundingBox();
  const calendarBefore = await calendar.boundingBox();
  const tableBefore = await tablePanel.boundingBox();

  appState.attendanceEntries.push({
    id: 100,
    userId: 2,
    attendanceDate: smokeToday,
    status: "Office",
    recordedByUserId: 2,
    createdAt: `${smokeToday}T12:00:00Z`,
    updatedAt: `${smokeToday}T12:00:00Z`
  });
  appState.vacationPlans.push({
    id: 100,
    userId: 1,
    startDate: smokeToday,
    endDate: smokeToday,
    isCancelled: false,
    createdAt: `${smokeToday}T12:00:00Z`,
    updatedAt: `${smokeToday}T12:00:00Z`
  });

  const stateGetsBeforeRefresh = apiCalls.stateGets;
  await page.clock.fastForward(5000);
  await expect.poll(() => apiCalls.stateGets).toBe(stateGetsBeforeRefresh + 1);
  await expect(todayCell.locator("[data-attendance-status='Office'] [data-scrum-calendar-user='2']")).toBeVisible();
  await expect(todayCell.locator("[data-attendance-status='Vacation'] [data-scrum-calendar-user='1']")).toBeVisible();
  await expect(scrumTodayStatus(page, 2, "Office")).toBeVisible();
  await expect(page.locator("[data-action='set-scrum-view'][data-mode='calendar']")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-action='scrum-calendar-next']")).toBeFocused();

  const headerAfter = await header.boundingBox();
  const toggleAfter = await toggle.boundingBox();
  const calendarAfter = await calendar.boundingBox();
  const tableAfter = await tablePanel.boundingBox();
  expect(headerAfter.x).toBeCloseTo(headerBefore.x, 0);
  expect(headerAfter.y).toBeCloseTo(headerBefore.y, 0);
  expect(headerAfter.width).toBeCloseTo(headerBefore.width, 0);
  expect(headerAfter.height).toBeCloseTo(headerBefore.height, 0);
  expect(toggleAfter.x).toBeCloseTo(toggleBefore.x, 0);
  expect(toggleAfter.y).toBeCloseTo(toggleBefore.y, 0);
  expect(calendarAfter.x).toBeCloseTo(calendarBefore.x, 0);
  expect(calendarAfter.y).toBeCloseTo(calendarBefore.y, 0);
  expect(calendarAfter.width).toBeCloseTo(calendarBefore.width, 0);
  expect(tableAfter.x).toBeCloseTo(tableBefore.x, 0);
  expect(tableAfter.y).toBeCloseTo(tableBefore.y, 0);
  expect(tableAfter.width).toBeCloseTo(tableBefore.width, 0);
  expect(documentNavigationRequests).toBe(0);
  expect(await page.evaluate(() => ({
    appTop: document.querySelector("#app").scrollTop,
    calendarLeft: document.querySelector(".scrum-calendar-grid-wrap").scrollLeft,
    calendarTop: document.querySelector(".scrum-calendar-grid-wrap").scrollTop,
    tableLeft: document.querySelector(".scrum-table-wrap").scrollLeft
  }))).toEqual(scrollBefore);
});

test("Scrum read-only permission disables attendance and vacation mutations", async ({ page }) => {
  const appState = createTestState();
  const apiCalls = { securityReset: 0, sessionUserId: 2 };
  appState.effectivePermissions = appState.effectivePermissions.map(permission => permission.resourceKey === "Scrum"
    ? {
        ...permission,
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        canImport: false,
        canExport: false,
        noAccess: false
      }
    : permission);

  await page.clock.setFixedTime(new Date("2026-07-15T08:00:00+08:00"));
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("pmt-release-notes-last-seen:2", "2026-07-16-day-29");
  });
  await installApiMocks(page, appState, apiCalls);

  await page.goto("/");
  await openNavView(page, "Scrum", "Scrum");
  await expect(page.locator("[data-scrum-attendance-select]")).toBeDisabled();
  await expect(page.locator("[data-action='check-in-attendance']")).toBeDisabled();

  await page.locator(".page-actions-summary").click();
  await expect(page.locator(".page-actions-list [data-action='open-scrum-on-behalf']")).toBeDisabled();
  await expect(page.locator(".page-actions-list [data-action='open-scrum-vacation']")).toBeDisabled();
  await expect(page.locator("[data-scrum-on-behalf-dialog], [data-scrum-vacation-dialog]")).toHaveCount(0);
});

test("Scrum attendance cache follows the restored cookie session user", async ({ page }) => {
  const appState = createTestState();
  const apiCalls = { securityReset: 0, sessionUserId: 1 };
  appState.vacationPlans.push({
    id: 20,
    userId: 2,
    startDate: "2026-09-10",
    endDate: "2026-09-11",
    isCancelled: false,
    createdAt: `${smokeToday}T00:00:00Z`,
    updatedAt: `${smokeToday}T00:00:00Z`
  });

  await page.clock.setFixedTime(new Date("2026-07-15T08:00:00+08:00"));
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("pmt-release-notes-last-seen:1", "2026-07-16-day-29");
    localStorage.setItem("pmt-release-notes-last-seen:2", "2026-07-16-day-29");
  });
  await installApiMocks(page, appState, apiCalls);

  await page.goto("/");
  await openNavView(page, "Scrum", "Scrum");
  await expect.poll(() => (apiCalls.attendanceGets || []).some(call => call.userId === 1)).toBe(true);

  await clickPageAction(page, "open-scrum-vacation");
  let vacationDialog = page.locator("[data-scrum-vacation-dialog]");
  await expect(vacationDialog.locator("[data-scrum-vacation-id='20']")).toHaveCount(0);
  await vacationDialog.locator("[data-close-scrum-vacation]").last().click();

  apiCalls.setSessionUserId(2);
  await page.reload();
  await openNavView(page, "Scrum", "Scrum");

  await expect(page.locator("#userMenuToggle")).toHaveAttribute("title", "Bill menu");
  await expect.poll(() => (apiCalls.attendanceGets || []).some(call => call.userId === 2)).toBe(true);
  await clickPageAction(page, "open-scrum-vacation");
  vacationDialog = page.locator("[data-scrum-vacation-dialog]");
  await expect(vacationDialog.locator("[data-scrum-vacation-id='20']")).toBeVisible();
});

test("Dev Tasks header filters, idle morph, and bulk delete stay synchronized", async ({ page }) => {
  const appState = createTestState();
  const childTask = {
    ...appState.tasks.find(task => task.id === 3),
    id: 8,
    parentTaskId: 1,
    code: "PMT-TASK-008",
    title: "Selected child task",
    descriptionHtml: "<p>Selected child task</p>",
    sortOrder: 4
  };
  appState.tasks.push(childTask);
  hydrateTaskPeople(appState, childTask);
  const apiCalls = { securityReset: 0, taskDeletes: [] };
  const pageErrors = [];

  page.on("pageerror", error => pageErrors.push(error.message));
  await page.clock.install({ time: new Date("2026-07-15T08:00:00+08:00") });
  await page.clock.pauseAt(new Date("2026-07-15T08:01:00+08:00"));
  await markCurrentReleaseSeen(page, 1);
  await installApiMocks(page, appState, apiCalls);
  await page.goto("/");
  await page.locator("#loginName").fill("Sin");
  await page.locator("#loginPassword").fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();
  await openNavView(page, "Tasks", "Dev Tasks");

  const header = page.locator(".tasks-screen .section-head");
  const headerProject = header.locator("[data-filter='task-project']");
  const headerSprint = header.locator("[data-filter='task-sprint']");
  const headerSearch = header.locator("[data-filter='task-search']");
  const headerSearchControl = header.locator("[data-task-header-search-control]");
  const readLayout = () => page.evaluate(() => {
    const rect = selector => {
      const bounds = document.querySelector(selector)?.getBoundingClientRect();
      return bounds
        ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
        : null;
    };

    return {
      header: rect(".tasks-screen .section-head"),
      title: rect(".tasks-screen .section-head h1"),
      project: rect(".tasks-screen .section-head [data-filter='task-project']"),
      sprint: rect(".tasks-screen .section-head [data-filter='task-sprint']"),
      search: rect(".tasks-screen .section-head [data-task-header-search-control]"),
      add: rect(".tasks-screen .section-head [data-action='new-task']"),
      filters: rect(".tasks-screen .section-head [data-action='open-task-filters']"),
      actions: rect(".tasks-screen .section-head .page-actions-menu"),
      charts: rect(".tasks-screen .tasks-chart-panel"),
      table: rect(".tasks-screen .tasks-table-panel")
    };
  });

  const initialLayout = await readLayout();
  const expectedSearchWidth = Math.min(238, Math.max(182, page.viewportSize().width * 0.154));
  expect(initialLayout.search.width).toBeCloseTo(expectedSearchWidth, 0);
  expect(await headerSearch.evaluate(element => Number.parseFloat(getComputedStyle(element).paddingRight)))
    .toBeCloseTo(12, 0);
  expect(initialLayout.title.x + initialLayout.title.width).toBeLessThan(initialLayout.project.x);
  expect(initialLayout.project.x + initialLayout.project.width).toBeLessThan(initialLayout.sprint.x);
  expect(initialLayout.sprint.x + initialLayout.sprint.width).toBeLessThan(initialLayout.search.x);
  expect(initialLayout.search.x + initialLayout.search.width).toBeLessThan(initialLayout.add.x);
  expect(initialLayout.search.x + (initialLayout.search.width / 2))
    .toBeCloseTo(initialLayout.header.x + (initialLayout.header.width / 2), 0);
  expect(initialLayout.project.y + initialLayout.project.height)
    .toBeCloseTo(initialLayout.title.y + initialLayout.title.height, 0);
  expect(initialLayout.sprint.y + initialLayout.sprint.height)
    .toBeCloseTo(initialLayout.title.y + initialLayout.title.height, 0);

  await headerProject.selectOption("20");
  await expect(headerProject).toHaveValue("20");
  await expect(headerSprint).toHaveValue("current");
  await expect(page.locator("tbody[data-reorder-list='tasks']")).toContainText("LMS-TASK-001");
  await expect(page.locator("tbody[data-reorder-list='tasks']")).not.toContainText("PMT-TASK-001");

  await header.locator("[data-action='open-task-filters']").click();
  let filterDialog = page.locator("[data-task-filter-dialog]");
  await expect(filterDialog.locator("[data-filter='task-project']")).toHaveValue("20");
  await expect(filterDialog.locator("[data-filter='task-sprint']")).toHaveValue("current");
  await filterDialog.locator("[data-filter='task-project']").selectOption("10");
  await filterDialog.locator("[data-filter='task-sprint']").selectOption("101");
  await closeFilterDialog(page, "task");
  await expect(headerProject).toHaveValue("10");
  await expect(headerSprint).toHaveValue("101");

  await headerSearch.fill("Wire Board");
  await expect(headerSearch).toHaveValue("Wire Board");
  await header.locator("[data-action='open-task-filters']").click();
  filterDialog = page.locator("[data-task-filter-dialog]");
  await expect(filterDialog).toBeVisible();
  await expect(page.locator("tr[data-task-id='1']")).toBeVisible();
  await closeFilterDialog(page, "task");
  await expect(page.locator("tr[data-task-id='1']")).toBeVisible();
  await page.clock.fastForward(499);
  await expect(page.locator("tr[data-task-id='1']")).toBeVisible();
  await page.clock.fastForward(1);
  await expect(page.locator("tr[data-task-id='2']")).toBeVisible();
  await expect(page.locator("tr[data-task-id='1']")).toHaveCount(0);
  await headerSearch.hover();
  await page.clock.fastForward(3000);
  await expect(header).toHaveClass(/is-task-header-compact/);
  await expect(header).toHaveClass(/has-task-header-search-text/);
  await expect(header).not.toHaveClass(/is-task-header-search-docked/);
  await expect(headerProject).not.toBeVisible();
  await expect(headerSprint).not.toBeVisible();
  await expect(headerSearch).toBeVisible();
  const centeredFilteredLayout = await readLayout();
  expect(centeredFilteredLayout.search.x + (centeredFilteredLayout.search.width / 2))
    .toBeCloseTo(centeredFilteredLayout.header.x + (centeredFilteredLayout.header.width / 2), 0);
  const centeredFilteredBounds = await header.evaluate(element => ({
    contextRight: element.querySelector("[data-task-header-context]").getBoundingClientRect().right,
    searchLeft: element.querySelector("[data-task-header-search-control]").getBoundingClientRect().left
  }));
  expect(centeredFilteredBounds.searchLeft).toBeGreaterThanOrEqual(centeredFilteredBounds.contextRight);
  await page.mouse.down();
  await page.mouse.up();
  await expect(header).not.toHaveClass(/is-task-header-compact/);
  await expect(header).not.toHaveClass(/is-task-header-search-docked/);
  const restoredCenteredFilterLayout = await readLayout();
  expect(restoredCenteredFilterLayout.search.x + (restoredCenteredFilterLayout.search.width / 2))
    .toBeCloseTo(restoredCenteredFilterLayout.header.x + (restoredCenteredFilterLayout.header.width / 2), 0);
  await header.locator("[data-action='open-task-filters']").click();
  filterDialog = page.locator("[data-task-filter-dialog]");
  await expect(filterDialog.locator("[data-filter='task-search']")).toHaveValue("Wire Board");
  await filterDialog.locator("[data-filter='task-search']").fill("Implement smokeable");
  await expect(headerSearch).toHaveValue("Implement smokeable");
  await expect(page.locator("tr[data-task-id='1']")).toBeVisible();
  await expect(page.locator("tr[data-task-id='2']")).toHaveCount(0);
  await closeFilterDialog(page, "task");
  await headerSearch.fill("");
  await page.clock.fastForward(500);
  await expect(page.locator("tr[data-task-id='1']")).toBeVisible();
  await expect(page.locator("tr[data-task-id='2']")).toBeVisible();

  const expandedLayout = await readLayout();
  const transitionMs = await headerSearchControl.evaluate(element =>
    Number.parseFloat(getComputedStyle(element).transitionDuration) * 1000);
  expect(transitionMs).toBeGreaterThan(0);
  expect(transitionMs).toBeLessThanOrEqual(300);

  await headerSearch.evaluate(element => element.blur());
  await header.hover({ position: { x: 2, y: 2 } });
  await page.clock.fastForward(3000);
  await expect(header).toHaveClass(/is-task-header-compact/);
  await expect(headerProject).not.toBeVisible();
  await expect(headerSprint).not.toBeVisible();
  await expect(header.locator("[data-task-header-project-summary]")).toHaveText("Project: PMT - Project Management Tool");
  await expect(header.locator("[data-task-header-sprint-summary]")).toHaveText("Sprint: Regression Coverage");
  const compactContextLayout = await header.evaluate(element => {
    const project = element.querySelector("[data-task-header-project-summary]").getBoundingClientRect();
    const sprint = element.querySelector("[data-task-header-sprint-summary]").getBoundingClientRect();
    return {
      gap: sprint.left - project.right,
      titleBaseline: element.querySelector("h1 .task-header-baseline-marker").getBoundingClientRect().top,
      projectBaseline: element.querySelector("[data-task-header-project-summary] .task-header-baseline-marker").getBoundingClientRect().top,
      sprintBaseline: element.querySelector("[data-task-header-sprint-summary] .task-header-baseline-marker").getBoundingClientRect().top
    };
  });
  expect(compactContextLayout.gap).toBeGreaterThanOrEqual(0);
  expect(compactContextLayout.gap).toBeLessThanOrEqual(10);
  expect(compactContextLayout.projectBaseline).toBeCloseTo(compactContextLayout.titleBaseline, 0);
  expect(compactContextLayout.sprintBaseline).toBeCloseTo(compactContextLayout.titleBaseline, 0);

  await expect.poll(async () => (await headerSearchControl.boundingBox())?.width)
    .toBeCloseTo(expandedLayout.add.width, 0);
  const compactLayout = await readLayout();
  const compactSearchGap = compactLayout.add.x - (compactLayout.search.x + compactLayout.search.width);
  expect(compactSearchGap).toBeGreaterThanOrEqual(0);
  expect(compactSearchGap).toBeLessThanOrEqual(16);
  for (const key of ["header", "title", "add", "filters", "actions", "charts", "table"]) {
    expect(compactLayout[key].x).toBeCloseTo(expandedLayout[key].x, 0);
    expect(compactLayout[key].y).toBeCloseTo(expandedLayout[key].y, 0);
    expect(compactLayout[key].width).toBeCloseTo(expandedLayout[key].width, 0);
    expect(compactLayout[key].height).toBeCloseTo(expandedLayout[key].height, 0);
  }

  await headerSearchControl.click();
  await expect(header).not.toHaveClass(/is-task-header-compact/);
  await expect(header).toHaveClass(/is-task-header-search-docked/);
  await expect.poll(async () => (await headerSearchControl.boundingBox())?.width)
    .toBeCloseTo(expandedLayout.search.width, 0);
  const dockedLayout = await readLayout();
  const dockedSearchGap = dockedLayout.add.x - (dockedLayout.search.x + dockedLayout.search.width);
  expect(dockedSearchGap).toBeGreaterThanOrEqual(0);
  expect(dockedSearchGap).toBeLessThanOrEqual(16);
  for (const key of ["add", "filters", "actions", "charts", "table"]) {
    expect(dockedLayout[key].x).toBeCloseTo(expandedLayout[key].x, 0);
    expect(dockedLayout[key].y).toBeCloseTo(expandedLayout[key].y, 0);
    expect(dockedLayout[key].width).toBeCloseTo(expandedLayout[key].width, 0);
    expect(dockedLayout[key].height).toBeCloseTo(expandedLayout[key].height, 0);
  }

  await page.waitForTimeout(transitionMs + 40);
  await page.evaluate(() => {
    window.__taskHeaderSearchSamples = [];
    window.__taskHeaderSearchSampling = true;
    const sampleSearchPosition = () => {
      const search = document.querySelector(".tasks-screen [data-task-header-search-control]");
      if (search) window.__taskHeaderSearchSamples.push(search.getBoundingClientRect().x);
      if (window.__taskHeaderSearchSampling) requestAnimationFrame(sampleSearchPosition);
    };
    requestAnimationFrame(sampleSearchPosition);
  });
  await page.keyboard.type("Wire");
  await expect(headerSearch).toHaveValue("Wire");
  await page.clock.fastForward(500);
  await expect(page.locator("tr[data-task-id='2']")).toBeVisible();
  await page.waitForTimeout(transitionMs + 40);
  const dockedSearchSamples = await page.evaluate(() => {
    window.__taskHeaderSearchSampling = false;
    return window.__taskHeaderSearchSamples;
  });
  expect(Math.max(...dockedSearchSamples) - Math.min(...dockedSearchSamples)).toBeLessThan(2);
  await page.clock.fastForward(3000);
  await expect(header).toHaveClass(/is-task-header-compact/);
  await expect(header).toHaveClass(/has-task-header-search-text/);
  await expect(header).toHaveClass(/is-task-header-search-docked/);
  await expect(headerProject).not.toBeVisible();
  await expect(headerSprint).not.toBeVisible();
  await expect(headerSearch).toBeVisible();
  await expect(headerSearch).toHaveValue("Wire");
  await expect.poll(async () => (await headerSearchControl.boundingBox())?.width)
    .toBeCloseTo(expandedLayout.search.width, 0);
  const persistentDockedLayout = await readLayout();
  const persistentDockedGap = persistentDockedLayout.add.x
    - (persistentDockedLayout.search.x + persistentDockedLayout.search.width);
  expect(persistentDockedGap).toBeGreaterThanOrEqual(0);
  expect(persistentDockedGap).toBeLessThanOrEqual(16);
  await headerSearchControl.hover();
  await expect(header).not.toHaveClass(/is-task-header-compact/);
  await expect(header).toHaveClass(/is-task-header-search-docked/);
  const restoredDockedFilterLayout = await readLayout();
  const restoredDockedFilterGap = restoredDockedFilterLayout.add.x
    - (restoredDockedFilterLayout.search.x + restoredDockedFilterLayout.search.width);
  expect(restoredDockedFilterGap).toBeGreaterThanOrEqual(0);
  expect(restoredDockedFilterGap).toBeLessThanOrEqual(16);
  await headerSearch.fill("");

  await headerSearch.evaluate(element => element.blur());
  await page.locator(".tasks-screen .tasks-chart-panel").first().hover();
  await page.clock.fastForward(3000);
  await expect(header).toHaveClass(/is-task-header-compact/);
  await header.hover({ position: { x: 2, y: 2 } });
  await expect(header).not.toHaveClass(/is-task-header-compact/);
  await expect(header).not.toHaveClass(/is-task-header-search-docked/);
  await expect(headerProject).toBeVisible();
  await expect(headerSprint).toBeVisible();
  await expect(headerSearch).toHaveValue("");
  await expect.poll(async () => (await headerSearchControl.boundingBox())?.width)
    .toBeCloseTo(expandedLayout.search.width, 0);
  const restoredLayout = await readLayout();
  for (const key of ["header", "title", "add", "filters", "actions", "charts", "table"]) {
    expect(restoredLayout[key].x).toBeCloseTo(expandedLayout[key].x, 0);
    expect(restoredLayout[key].y).toBeCloseTo(expandedLayout[key].y, 0);
    expect(restoredLayout[key].width).toBeCloseTo(expandedLayout[key].width, 0);
    expect(restoredLayout[key].height).toBeCloseTo(expandedLayout[key].height, 0);
  }

  await headerProject.selectOption("0");
  await headerSprint.selectOption("current");
  await headerSearch.evaluate(element => element.blur());
  await header.hover({ position: { x: 2, y: 2 } });
  await page.clock.fastForward(3000);
  await expect(header).toHaveClass(/is-task-header-compact/);
  await expect(header.locator("[data-task-header-sprint-summary]")).toHaveText("Sprint: Current Sprint");
  await header.hover({ position: { x: 2, y: 2 } });
  await headerProject.selectOption("10");
  await headerSprint.selectOption("101");

  const desktopViewport = page.viewportSize();
  await page.setViewportSize({ width: 900, height: desktopViewport.height });
  await header.hover({ position: { x: 2, y: 2 } });
  const narrowExpandedLayout = await readLayout();
  expect(narrowExpandedLayout.search.width).toBeCloseTo(154, 0);
  await page.clock.fastForward(3000);
  await expect(header).toHaveClass(/is-task-header-compact/);
  const narrowCompactLayout = await readLayout();
  const narrowSearchWidths = await headerSearchControl.evaluate(control => ({
    control: control.getBoundingClientRect().width,
    input: control.querySelector("input").getBoundingClientRect().width
  }));
  expect(narrowSearchWidths.control).toBeCloseTo(narrowExpandedLayout.search.width, 0);
  expect(narrowSearchWidths.input).toBeCloseTo(narrowExpandedLayout.add.width, 0);
  for (const key of ["header", "add", "filters", "actions", "charts", "table"]) {
    expect(narrowCompactLayout[key].x, `${key} x`).toBeCloseTo(narrowExpandedLayout[key].x, 0);
    expect(narrowCompactLayout[key].y, `${key} y`).toBeCloseTo(narrowExpandedLayout[key].y, 0);
    expect(narrowCompactLayout[key].width, `${key} width`).toBeCloseTo(narrowExpandedLayout[key].width, 0);
    expect(narrowCompactLayout[key].height, `${key} height`).toBeCloseTo(narrowExpandedLayout[key].height, 0);
  }
  expect(narrowCompactLayout.title.x).toBeCloseTo(narrowExpandedLayout.title.x, 0);
  expect(narrowCompactLayout.title.y).toBeCloseTo(narrowExpandedLayout.title.y, 0);
  expect(narrowCompactLayout.title.height).toBeCloseTo(narrowExpandedLayout.title.height, 0);
  await header.hover({ position: { x: 2, y: 2 } });
  await expect(header).not.toHaveClass(/is-task-header-compact/);

  await page.setViewportSize({ width: 375, height: desktopViewport.height });
  await header.hover({ position: { x: 2, y: 2 } });
  await page.clock.fastForward(3000);
  await expect(header).toHaveClass(/is-task-header-compact/);
  const phoneContextBounds = await header.evaluate(element => {
    const headerBounds = element.getBoundingClientRect();
    const summaries = [...element.querySelectorAll(".task-header-context-summary")]
      .map(summary => summary.getBoundingClientRect().right);
    return {
      headerRight: headerBounds.right,
      summaryRight: Math.max(...summaries),
      pageWidth: document.documentElement.clientWidth,
      pageScrollWidth: document.documentElement.scrollWidth
    };
  });
  expect(phoneContextBounds.summaryRight).toBeLessThanOrEqual(phoneContextBounds.headerRight);
  expect(phoneContextBounds.pageScrollWidth).toBeLessThanOrEqual(phoneContextBounds.pageWidth);
  await header.hover({ position: { x: 2, y: 2 } });
  await expect(header).not.toHaveClass(/is-task-header-compact/);

  await page.setViewportSize({ width: 901, height: desktopViewport.height });
  await header.hover({ position: { x: 2, y: 2 } });
  await page.clock.fastForward(3000);
  await expect(header).toHaveClass(/is-task-header-compact/);
  const tightCompactLayout = await readLayout();
  await headerSearchControl.click();
  await expect(header).toHaveClass(/is-task-header-search-docked/);
  const tightDockedBounds = await header.evaluate(element => {
    const context = element.querySelector("[data-task-header-context]").getBoundingClientRect();
    const search = element.querySelector("[data-task-header-search-control]").getBoundingClientRect();
    const add = element.querySelector("[data-action='new-task']").getBoundingClientRect();
    return { contextRight: context.right, searchLeft: search.left, searchRight: search.right, addLeft: add.left };
  });
  expect(tightDockedBounds.searchLeft).toBeGreaterThanOrEqual(tightDockedBounds.contextRight);
  expect(tightDockedBounds.searchRight).toBeLessThanOrEqual(tightDockedBounds.addLeft);
  const tightDockedLayout = await readLayout();
  for (const key of ["add", "filters", "actions"]) {
    expect(tightDockedLayout[key].x, `${key} docked x`).toBeCloseTo(tightCompactLayout[key].x, 0);
    expect(
      tightDockedLayout[key].y - tightDockedLayout.header.y,
      `${key} docked header offset`
    ).toBeCloseTo(tightCompactLayout[key].y - tightCompactLayout.header.y, 0);
  }
  await headerSearch.evaluate(element => element.blur());
  await page.setViewportSize(desktopViewport);

  await clickPageAction(page, "toggle-task-table-edit-mode");
  const firstRow = page.locator("tr[data-task-id='1']");
  const secondRow = page.locator("tr[data-task-id='2']");
  const childRow = page.locator("tr[data-task-id='8']");
  const firstCheckbox = firstRow.locator("[data-task-delete-select]");
  const secondCheckbox = secondRow.locator("[data-task-delete-select]");
  const childCheckbox = childRow.locator("[data-task-delete-select]");
  await expect(firstCheckbox).toBeVisible();
  await expect(secondCheckbox).toBeVisible();
  await expect(childCheckbox).toBeVisible();
  expect(await firstRow.locator(".action-cell").evaluate(cell => {
    const checkbox = cell.querySelector("[data-task-delete-select]");
    const trash = cell.querySelector("[data-action='delete-task']");
    return Boolean(checkbox.compareDocumentPosition(trash) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);

  await firstCheckbox.check();
  await secondCheckbox.check();
  await childCheckbox.check();
  await expect(page.locator("dialog.detail-dialog")).toHaveCount(0);
  await expect(firstRow.locator("[data-action='delete-task']")).toHaveAttribute("title", "Delete 3 selected Dev Tasks");
  const stateGetsBeforeDelete = apiCalls.stateGets;
  await firstRow.locator("[data-action='delete-task']").click();
  const confirmation = page.locator("dialog.mini-dialog", { has: page.getByRole("heading", { name: "Delete", exact: true }) });
  await expect(confirmation).toContainText("Delete 3 selected Dev Tasks?");
  await expect(confirmation).toContainText("Deleting a parent also deletes its direct sub-tasks.");
  await confirmation.getByRole("button", { name: "Continue" }).click();

  await expect.poll(() => apiCalls.taskDeletes).toEqual([1, 2]);
  await expect.poll(() => apiCalls.stateGets).toBe(stateGetsBeforeDelete + 1);
  await expect(page.locator("tr[data-task-id='1']")).toHaveCount(0);
  await expect(page.locator("tr[data-task-id='2']")).toHaveCount(0);
  await expect(page.locator("tr[data-task-id='8']")).toHaveCount(0);
  await expect(page.locator("tr[data-task-id='3']")).toBeVisible();
  expect(appState.tasks.some(task => task.id === 4 && task.taskType === "Bug")).toBe(true);
  await expect(page.locator("#toast")).toHaveText("3 Dev Tasks deleted.");

  apiCalls.failNextStateGet = true;
  const thirdRow = page.locator("tr[data-task-id='3']");
  await thirdRow.locator("[data-task-delete-select]").check();
  await thirdRow.locator("[data-action='delete-task']").click();
  const failedRefreshConfirmation = page.locator("dialog.mini-dialog", { has: page.getByRole("heading", { name: "Delete", exact: true }) });
  await failedRefreshConfirmation.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#app")).toContainText("Database is not ready.");
  await expect(page.locator("#toast")).toHaveText("Temporary state failure.");
  expect(pageErrors).toEqual([]);
});

test("Bug Tracking and Backlog share synchronized idle headers and bulk delete", async ({ page }) => {
  const appState = createTestState();
  const secondBug = {
    ...appState.tasks.find(task => task.id === 4),
    id: 8,
    code: "PMT-BUG-002",
    title: "Secondary board defect",
    descriptionHtml: "<p>Secondary board defect</p>",
    sortOrder: 5
  };
  const secondBacklogItem = {
    ...appState.tasks.find(task => task.id === 5),
    id: 9,
    code: "PMT-TASK-005",
    title: "Second backlog planning item",
    descriptionHtml: "<p>Second backlog planning item</p>",
    sortOrder: 6
  };
  const backlogChild = {
    ...appState.tasks.find(task => task.id === 5),
    id: 10,
    parentTaskId: 5,
    code: "PMT-TASK-006",
    title: "Backlog child item",
    descriptionHtml: "<p>Backlog child item</p>",
    sortOrder: 7
  };
  appState.tasks.push(secondBug, secondBacklogItem, backlogChild);
  [secondBug, secondBacklogItem, backlogChild].forEach(task => hydrateTaskPeople(appState, task));
  const apiCalls = { securityReset: 0, taskDeletes: [], backlogDeletes: [] };

  await page.clock.install({ time: new Date("2026-07-17T08:00:00+08:00") });
  await page.clock.pauseAt(new Date("2026-07-17T08:01:00+08:00"));
  await markCurrentReleaseSeen(page, 1);
  await installApiMocks(page, appState, apiCalls);
  await page.goto("/");
  await page.locator("#loginName").fill("Sin");
  await page.locator("#loginPassword").fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();

  await openNavView(page, "Bugs", "Bug Tracking");
  const bugHeader = page.locator(".bugs-screen .section-head");
  const bugProject = bugHeader.locator("[data-filter='bug-project']");
  const bugSprint = bugHeader.locator("[data-filter='bug-sprint']");
  const bugSearch = bugHeader.locator("[data-filter='bug-search']");
  const bugSearchControl = bugHeader.locator("[data-idle-filter-header-search-control]");
  await expectIdleHeaderControlsNotToOverlap(bugHeader);
  await expectIdleHeaderExpandedSearch(bugHeader);

  await bugProject.selectOption("20");
  await expect(bugSprint).toHaveValue("200");
  await bugHeader.locator("[data-action='open-bug-filters']").click();
  let filterDialog = page.locator("[data-bug-filter-dialog]");
  await expect(filterDialog.locator("[data-filter='bug-project']")).toHaveValue("20");
  await expect(filterDialog.locator("[data-filter='bug-sprint']")).toHaveValue("200");
  await filterDialog.locator("[data-filter='bug-project']").selectOption("10");
  await filterDialog.locator("[data-filter='bug-sprint']").selectOption("101");
  await filterDialog.locator("[data-filter='bug-search']").fill("Secondary board");
  await expect(bugProject).toHaveValue("10");
  await expect(bugSprint).toHaveValue("101");
  await expect(bugSearch).toHaveValue("Secondary board");
  await closeFilterDialog(page, "bug");
  await expect(page.locator("tr[data-task-id='8']")).toBeVisible();
  await expect(page.locator("tr[data-task-id='4']")).toHaveCount(0);

  await bugSearch.fill("Critical board");
  await expect(bugSearch).toHaveValue("Critical board");
  await expect(page.locator("tr[data-task-id='8']")).toBeVisible();
  await page.clock.fastForward(499);
  await expect(page.locator("tr[data-task-id='8']")).toBeVisible();
  await page.clock.fastForward(1);
  await expect(page.locator("tr[data-task-id='4']")).toBeVisible();
  await expect(page.locator("tr[data-task-id='8']")).toHaveCount(0);
  await bugSearch.hover();
  await page.clock.fastForward(3000);
  await expect(bugHeader).toHaveClass(/is-idle-filter-header-compact/);
  await expect(bugHeader).toHaveClass(/has-idle-filter-header-search-text/);
  await expect(bugHeader).not.toHaveClass(/is-idle-filter-header-search-docked/);
  await expect(bugSearch).toBeVisible();
  await expect(bugProject).not.toBeVisible();
  await expect(bugSprint).not.toBeVisible();
  await expect(bugHeader.locator(".idle-filter-header-project-slot .idle-filter-header-context-summary")).toHaveText("Project: PMT - Project Management Tool");
  await expect(bugHeader.locator(".idle-filter-header-sprint-slot .idle-filter-header-context-summary")).toHaveText("Sprint: Regression Coverage");
  await expectIdleHeaderSummaryBaseline(bugHeader);
  await expectIdleSearchCentered(bugHeader);
  await page.mouse.down();
  await page.mouse.up();
  await expect(bugHeader).not.toHaveClass(/is-idle-filter-header-compact/);
  await expect(bugHeader).not.toHaveClass(/is-idle-filter-header-search-docked/);
  await expectIdleSearchCentered(bugHeader);

  await bugSearch.fill("");
  await bugSearch.evaluate(element => element.blur());
  await page.clock.fastForward(500);
  await page.locator(".bugs-table-panel").hover();
  await page.clock.fastForward(3000);
  await expect(bugHeader).toHaveClass(/is-idle-filter-header-compact/);
  await expect(bugProject).not.toBeVisible();
  await expect(bugSprint).not.toBeVisible();
  await expect(bugHeader.locator(".idle-filter-header-project-slot .idle-filter-header-context-summary")).toHaveText("Project: PMT - Project Management Tool");
  await expect(bugHeader.locator(".idle-filter-header-sprint-slot .idle-filter-header-context-summary")).toHaveText("Sprint: Regression Coverage");
  await expectIdleHeaderSummaryBaseline(bugHeader);
  await expectIdleSearchImmediatelyBeforeAdd(bugHeader);
  await bugHeader.hover({ position: { x: 4, y: 4 } });
  await expect(bugHeader).not.toHaveClass(/is-idle-filter-header-compact/);
  await expect(bugSearch).toHaveValue("");
  const originalViewport = page.viewportSize();
  for (const width of [1280, 1100, 1000, 900]) {
    await page.setViewportSize({ width, height: originalViewport.height });
    await expectIdleHeaderControlsNotToOverlap(bugHeader);
  }
  await page.setViewportSize(originalViewport);

  await clickPageAction(page, "toggle-bug-table-edit-mode");
  const firstBug = page.locator("tr[data-task-id='4']");
  const secondBugRow = page.locator("tr[data-task-id='8']");
  await firstBug.locator("[data-bug-delete-select]").check();
  await secondBugRow.locator("[data-bug-delete-select]").check();
  expect(await firstBug.locator(".action-cell").evaluate(cell => {
    const checkbox = cell.querySelector("[data-bug-delete-select]");
    const trash = cell.querySelector("[data-action='delete-task']");
    return Boolean(checkbox.compareDocumentPosition(trash) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
  await firstBug.locator("[data-action='delete-task']").click();
  let confirmation = page.locator("dialog.mini-dialog", { has: page.getByRole("heading", { name: "Delete", exact: true }) });
  await expect(confirmation).toContainText("Delete 2 selected Bug Reports?");
  await confirmation.getByRole("button", { name: "Continue" }).click();
  await expect.poll(() => apiCalls.taskDeletes).toEqual([4, 8]);
  await expect(page.locator("#toast")).toHaveText("2 Bug Reports deleted.");

  await bugSearch.fill("pending navigation");
  await openNavView(page, "Backlog", "Backlog");
  await page.clock.fastForward(500);
  await expect(page.locator(".backlog-screen")).toBeVisible();
  const backlogHeader = page.locator(".backlog-screen .section-head");
  const backlogProject = backlogHeader.locator("[data-filter='backlog-project']");
  const backlogSprint = backlogHeader.locator("[data-filter='backlog-sprint']");
  const backlogSearch = backlogHeader.locator("[data-filter='backlog-search']");
  const backlogSearchControl = backlogHeader.locator("[data-idle-filter-header-search-control]");
  await expectIdleHeaderControlsNotToOverlap(backlogHeader);
  await expectIdleHeaderExpandedSearch(backlogHeader);
  const backlogActionLayout = await idleHeaderActionLayout(backlogHeader);

  await backlogProject.selectOption("10");
  await backlogSprint.selectOption("unassigned");
  await backlogSearch.fill("Second backlog");
  await backlogHeader.locator("[data-action='open-backlog-filters']").click();
  filterDialog = page.locator("[data-backlog-filter-dialog]");
  await expect(filterDialog.locator("[data-filter='backlog-project']")).toHaveValue("10");
  await expect(filterDialog.locator("[data-filter='backlog-sprint']")).toHaveValue("unassigned");
  await expect(filterDialog.locator("[data-filter='backlog-search']")).toHaveValue("Second backlog");
  await filterDialog.locator("[data-filter='backlog-search']").fill("");
  await expect(backlogSearch).toHaveValue("");
  await closeFilterDialog(page, "backlog");

  await backlogSearch.evaluate(element => element.blur());
  await page.locator(".backlog-table-panel").hover();
  await page.clock.fastForward(3000);
  await expect(backlogHeader).toHaveClass(/is-idle-filter-header-compact/);
  await expect(backlogHeader.locator(".idle-filter-header-project-slot .idle-filter-header-context-summary")).toHaveText("Project: PMT - Project Management Tool");
  await expect(backlogHeader.locator(".idle-filter-header-sprint-slot .idle-filter-header-context-summary")).toHaveText("Sprint: Unassigned");
  await expectIdleHeaderSummaryBaseline(backlogHeader);
  await expectIdleSearchImmediatelyBeforeAdd(backlogHeader);
  await backlogSearchControl.click();
  await expect(backlogHeader).not.toHaveClass(/is-idle-filter-header-compact/);
  await expect(backlogHeader).toHaveClass(/is-idle-filter-header-search-docked/);
  await backlogSearch.fill("Second backlog");
  await expect(backlogSearch).toHaveValue("Second backlog");
  await expect(page.locator("tr[data-task-id='5']")).toBeVisible();
  await page.clock.fastForward(499);
  await expect(page.locator("tr[data-task-id='5']")).toBeVisible();
  await page.clock.fastForward(1);
  await expect(page.locator("tr[data-task-id='9']")).toBeVisible();
  await expect(page.locator("tr[data-task-id='5']")).toHaveCount(0);
  await page.locator(".backlog-table-panel").hover();
  await page.clock.fastForward(3000);
  await expect(backlogHeader).toHaveClass(/is-idle-filter-header-compact/);
  await expect(backlogHeader).toHaveClass(/has-idle-filter-header-search-text/);
  await expect(backlogHeader).toHaveClass(/is-idle-filter-header-search-docked/);
  await expect(backlogSearch).toBeVisible();
  await expectIdleHeaderExpandedSearch(backlogHeader);
  expect(await idleHeaderActionLayout(backlogHeader)).toEqual(backlogActionLayout);
  await backlogSearchControl.hover();
  await expect(backlogHeader).not.toHaveClass(/is-idle-filter-header-compact/);
  await expect(backlogHeader).toHaveClass(/is-idle-filter-header-search-docked/);
  expect(await idleHeaderActionLayout(backlogHeader)).toEqual(backlogActionLayout);
  await backlogSearch.fill("");
  await page.clock.fastForward(500);

  await clickPageAction(page, "toggle-backlog-table-edit-mode");
  const backlogParentRow = page.locator("tr[data-task-id='5']");
  const backlogSecondRow = page.locator("tr[data-task-id='9']");
  const backlogChildRow = page.locator("tr[data-task-id='10']");
  await backlogParentRow.locator("[data-backlog-delete-select]").check();
  await backlogSecondRow.locator("[data-backlog-delete-select]").check();
  await backlogChildRow.locator("[data-backlog-delete-select]").check();
  expect(await backlogParentRow.locator(".action-cell").evaluate(cell => {
    const checkbox = cell.querySelector("[data-backlog-delete-select]");
    const trash = cell.querySelector("[data-action='delete-backlog-task']");
    return Boolean(checkbox.compareDocumentPosition(trash) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
  await backlogParentRow.locator("[data-action='delete-backlog-task']").click();
  confirmation = page.locator("dialog.mini-dialog", { has: page.getByRole("heading", { name: "Delete", exact: true }) });
  await expect(confirmation).toContainText("Delete 3 selected Backlog Items?");
  await expect(confirmation).toContainText("Deleting a parent also deletes its direct sub-tasks.");
  await confirmation.getByRole("button", { name: "Continue" }).click();
  await expect.poll(() => apiCalls.backlogDeletes).toEqual([5, 9]);
  await expect(page.locator("tr[data-task-id='5']")).toHaveCount(0);
  await expect(page.locator("tr[data-task-id='9']")).toHaveCount(0);
  await expect(page.locator("tr[data-task-id='10']")).toHaveCount(0);
  await expect(page.locator("#toast")).toHaveText("3 Backlog Items deleted.");
});

test("Kanban Board header search and mixed work-item bulk delete stay synchronized", async ({ page }) => {
  const appState = createTestState();
  const remainingBug = {
    ...appState.tasks.find(task => task.id === 4),
    id: 8,
    code: "PMT-BUG-002",
    title: "Residual board defect",
    descriptionHtml: "<p>Residual board defect</p>",
    sortOrder: 5
  };
  appState.tasks.push(remainingBug);
  hydrateTaskPeople(appState, remainingBug);
  const apiCalls = { securityReset: 0, taskDeletes: [] };

  await page.clock.install({ time: new Date("2026-07-17T08:00:00+08:00") });
  await page.clock.pauseAt(new Date("2026-07-17T08:01:00+08:00"));
  await markCurrentReleaseSeen(page, 1);
  await markCurrentReleaseSeen(page, 2);
  await installApiMocks(page, appState, apiCalls);
  await page.goto("/");
  await page.locator("#loginName").fill("Sin");
  await page.locator("#loginPassword").fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();
  await openNavView(page, "Board", "Kanban Board");

  const header = page.locator(".board-screen .section-head");
  const headerProject = header.locator("[data-filter='board-project']");
  const headerSprint = header.locator("[data-filter='board-sprint']");
  const headerSearch = header.locator("[data-filter='board-search']");
  const headerSearchControl = header.locator("[data-idle-filter-header-search-control]");
  await expectIdleHeaderControlsNotToOverlap(header);
  await expectIdleHeaderExpandedSearch(header);

  await headerProject.selectOption("20");
  await expect(headerSprint).toHaveValue("latest");
  await expect(page.locator(".task-card[data-task-id='6']")).toBeVisible();
  await header.locator("[data-action='open-board-filters']").click();
  let filterDialog = page.locator("[data-board-filter-dialog]");
  await expect(filterDialog.locator("[data-filter='board-project']")).toHaveValue("20");
  await expect(filterDialog.locator("[data-filter='board-sprint']")).toHaveValue("latest");
  await filterDialog.locator("[data-filter='board-project']").selectOption("10");
  await filterDialog.locator("[data-filter='board-sprint']").selectOption("all");
  await filterDialog.locator("[data-filter='board-search']").fill("Critical board");
  await expect(headerProject).toHaveValue("10");
  await expect(headerSprint).toHaveValue("all");
  await expect(headerSearch).toHaveValue("Critical board");
  await expect(page.locator(".task-card[data-task-id='4']")).toBeVisible();
  await expect(page.locator(".task-card[data-task-id='1']")).toHaveCount(0);
  await filterDialog.locator("[data-filter='board-search']").fill("");
  await closeFilterDialog(page, "board");
  await expect(headerSearch).toHaveValue("");

  await header.locator("[data-action='toggle-empty-board-columns']").click();
  const boardScrollLeft = await page.locator(".board").evaluate(element => {
    element.scrollLeft = Math.min(120, Math.max(0, element.scrollWidth - element.clientWidth));
    return element.scrollLeft;
  });
  await headerSearch.fill("Critical board");
  await expect(headerSearch).toHaveValue("Critical board");
  await expect(page.locator(".task-card[data-task-id='1']")).toBeVisible();
  await page.clock.fastForward(499);
  await expect(page.locator(".task-card[data-task-id='1']")).toBeVisible();
  await page.clock.fastForward(1);
  await expect(page.locator(".task-card[data-task-id='4']")).toBeVisible();
  await expect(page.locator(".task-card[data-task-id='1']")).toHaveCount(0);
  expect(await page.locator(".board").evaluate(element => element.scrollLeft)).toBeCloseTo(boardScrollLeft, 0);
  await headerSearch.hover();
  await page.clock.fastForward(3000);
  await expect(header).toHaveClass(/is-idle-filter-header-compact/);
  await expect(header).toHaveClass(/has-idle-filter-header-search-text/);
  await expect(header).not.toHaveClass(/is-idle-filter-header-search-docked/);
  await expect(headerSearch).toBeVisible();
  await expectIdleSearchCentered(header);
  await page.mouse.down();
  await page.mouse.up();
  await expect(header).not.toHaveClass(/is-idle-filter-header-compact/);
  await expect(header).not.toHaveClass(/is-idle-filter-header-search-docked/);
  await expectIdleSearchCentered(header);
  await headerSearch.fill("");
  await page.clock.fastForward(500);
  await headerSearch.evaluate(element => element.blur());
  await page.locator(".board").hover();
  await page.clock.fastForward(3000);
  await expect(header).toHaveClass(/is-idle-filter-header-compact/);
  await expect(header.locator(".idle-filter-header-project-slot .idle-filter-header-context-summary")).toHaveText("Project: PMT - Project Management Tool");
  await expect(header.locator(".idle-filter-header-sprint-slot .idle-filter-header-context-summary")).toHaveText("Sprint: All Sprints");
  await expectIdleHeaderSummaryBaseline(header);
  await expectIdleSearchImmediatelyBeforeAdd(header);
  await header.hover({ position: { x: 4, y: 4 } });
  await expect(header).not.toHaveClass(/is-idle-filter-header-compact/);

  await header.locator("[data-action='toggle-board-edit-mode']").click();
  const devCard = page.locator(".task-card[data-task-id='1']");
  const bugCard = page.locator(".task-card[data-task-id='4']");
  await devCard.locator("[data-board-delete-select]").check();
  await bugCard.locator("[data-board-delete-select]").check();
  expect(await devCard.locator(".task-card-actions").evaluate(actions => {
    const checkbox = actions.querySelector("[data-board-delete-select]");
    const trash = actions.querySelector("[data-action='delete-task']");
    return Boolean(checkbox.compareDocumentPosition(trash) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
  await devCard.locator("[data-action='delete-task']").click();
  const confirmation = page.locator("dialog.mini-dialog", { has: page.getByRole("heading", { name: "Delete", exact: true }) });
  await expect(confirmation).toContainText("Delete 2 selected Work Items?");
  await confirmation.getByRole("button", { name: "Continue" }).click();
  await expect.poll(() => apiCalls.taskDeletes).toEqual([1, 4]);
  await expect(page.locator(".task-card[data-task-id='1']")).toHaveCount(0);
  await expect(page.locator(".task-card[data-task-id='4']")).toHaveCount(0);
  await expect(page.locator("#toast")).toHaveText("2 Work Items deleted.");

  appState.effectivePermissions = appState.securityResources.map(resource => ({
    resourceKey: resource.resourceKey,
    ...testHistoricalRolePermission(resource, "Developer")
  }));
  apiCalls.setSessionUserId(2);
  await page.reload();
  await openNavView(page, "Board", "Kanban Board");
  const developerHeader = page.locator(".board-screen .section-head");
  await developerHeader.locator("[data-action='toggle-board-edit-mode']").click();
  const developerTaskCard = page.locator(".task-card[data-task-id='2']");
  const developerBugCard = page.locator(".task-card[data-task-id='8']");
  await expect(developerTaskCard.locator("[data-board-delete-select]")).toBeEnabled();
  await expect(developerTaskCard.locator("[data-action='delete-task']")).toBeEnabled();
  await expect(developerTaskCard.locator("[data-action='delete-task']")).toHaveAttribute("data-security-resource", "DevTasks");
  await expect(developerBugCard.locator("[data-board-delete-select]")).toBeDisabled();
  await expect(developerBugCard.locator("[data-action='delete-task']")).toBeDisabled();
  await expect(developerBugCard.locator("[data-action='delete-task']")).toHaveAttribute("data-security-resource", "BugTracking");
});

test("Documentation and Sprints share synchronized idle headers and bulk delete", async ({ page }) => {
  const appState = createTestState();
  appState.blogs[0] = {
    ...appState.blogs[0],
    sprintId: null,
    isPrivate: false,
    isPinned: false,
    parentBlogId: null
  };
  appState.blogs.push(
    {
      ...appState.blogs[0],
      id: 2,
      sprintId: 101,
      title: "Sprint regression guide",
      bodyHtml: "<p>Regression guide for the current Sprint.</p>",
      createdAt: "2026-06-20T08:00:00",
      updatedAt: "2026-06-20T08:00:00"
    },
    {
      ...appState.blogs[0],
      id: 3,
      sprintId: 100,
      title: "Foundation guide",
      bodyHtml: "<p>Foundation Sprint guide.</p>",
      createdAt: "2026-06-17T08:00:00",
      updatedAt: "2026-06-17T08:00:00"
    }
  );
  const apiCalls = { securityReset: 0, blogDeletes: [], sprintDeletes: [] };

  await page.clock.install({ time: new Date("2026-07-17T08:00:00+08:00") });
  await page.clock.pauseAt(new Date("2026-07-17T08:01:00+08:00"));
  await markCurrentReleaseSeen(page, 1);
  await installApiMocks(page, appState, apiCalls);
  await page.goto("/");
  await page.locator("#loginName").fill("Sin");
  await page.locator("#loginPassword").fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();

  await openNavView(page, "Documentation", "Documentation");
  const documentationHeader = page.locator(".documentation-screen .section-head");
  const documentationProject = documentationHeader.locator("[data-filter='documentation-project']");
  const documentationSprint = documentationHeader.locator("[data-filter='documentation-sprint']");
  const documentationSearch = documentationHeader.locator("[data-filter='documentation-tree-search']");
  await expectIdleHeaderControlsNotToOverlap(documentationHeader);
  await expectIdleHeaderExpandedSearch(documentationHeader);

  await documentationProject.selectOption("10");
  await documentationSprint.selectOption("all");
  await documentationSearch.fill("regression guide");
  await expect(documentationSearch).toHaveValue("regression guide");
  await expect(page.locator(".documentation-card[data-id='1']")).toBeVisible();
  await page.clock.fastForward(499);
  await expect(page.locator(".documentation-card[data-id='1']")).toBeVisible();
  await page.clock.fastForward(1);
  await expect(page.locator(".documentation-card[data-id='2']")).toBeVisible();
  await expect(page.locator(".documentation-card[data-id='1']")).toHaveCount(0);
  await documentationHeader.locator("[data-action='open-documentation-filters']").click();
  let filterDialog = page.locator("[data-documentation-filter-dialog]");
  await expect(filterDialog.locator("[data-filter='documentation-project']")).toHaveValue("10");
  await expect(filterDialog.locator("[data-filter='documentation-sprint']")).toHaveValue("all");
  await expect(filterDialog.locator("[data-filter='documentation-tree-search']")).toHaveValue("regression guide");
  await filterDialog.locator("[data-filter='documentation-sprint']").selectOption("101");
  await filterDialog.locator("[data-filter='documentation-tree-search']").fill("");
  await expect(documentationSearch).toHaveValue("");
  await closeFilterDialog(page, "documentation");
  await documentationHeader.locator("[data-action='set-documentation-view'][data-mode='tree']").click();
  await expect(page.locator(".documentation-tree-document[data-id='2']")).toBeVisible();
  await expect(page.locator(".documentation-tree-document[data-id='1']")).toHaveCount(0);

  await documentationSearch.evaluate(element => element.blur());
  await page.locator(".documentation-tree-layout").hover();
  await page.clock.fastForward(3000);
  await expect(documentationHeader).toHaveClass(/is-idle-filter-header-compact/);
  await expect(documentationHeader.locator(".idle-filter-header-project-slot .idle-filter-header-context-summary")).toHaveText("Project: PMT - Project Management Tool");
  await expect(documentationHeader.locator(".idle-filter-header-sprint-slot .idle-filter-header-context-summary")).toHaveText("Sprint: Regression Coverage");
  await expectIdleHeaderSummaryBaseline(documentationHeader);
  await expectIdleSearchImmediatelyBeforeAdd(documentationHeader);
  await documentationHeader.hover({ position: { x: 4, y: 4 } });
  await expect(documentationHeader).not.toHaveClass(/is-idle-filter-header-compact/);

  await documentationSprint.selectOption("all");
  await clickPageAction(page, "toggle-documentation-edit-mode");
  const firstDocument = page.locator(".documentation-tree-document[data-id='1']");
  const secondDocument = page.locator(".documentation-tree-document[data-id='2']");
  await firstDocument.click();
  await page.locator(".documentation-tree-preview [data-documentation-delete-select]").check();
  await secondDocument.click();
  await page.locator(".documentation-tree-preview [data-documentation-delete-select]").check();
  expect(await page.locator(".documentation-tree-preview-actions").evaluate(actions => {
    const checkbox = actions.querySelector("[data-documentation-delete-select]");
    const trash = actions.querySelector("[data-action='delete-blog']");
    return Boolean(checkbox.compareDocumentPosition(trash) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
  await expect(page.locator(".documentation-tree-preview [data-action='delete-blog']")).toHaveAttribute("title", "Delete 2 selected Documents");
  await page.locator(".documentation-tree-preview [data-action='delete-blog']").click();
  let confirmation = page.locator("dialog.mini-dialog", { has: page.getByRole("heading", { name: "Delete", exact: true }) });
  await expect(confirmation).toContainText("Delete 2 selected Documents?");
  await confirmation.getByRole("button", { name: "Continue" }).click();
  await expect.poll(() => apiCalls.blogDeletes).toEqual([1, 2]);
  await expect(page.locator(".documentation-tree-document[data-id='1']")).toHaveCount(0);
  await expect(page.locator(".documentation-tree-document[data-id='2']")).toHaveCount(0);
  await expect(page.locator("#toast")).toHaveText("2 Documents deleted.");

  await openNavView(page, "Sprints", "Sprints");
  const sprintHeader = page.locator(".sprints-screen .section-head");
  const sprintProject = sprintHeader.locator("[data-filter='sprint-project']");
  const sprintFilter = sprintHeader.locator("[data-filter='sprint-filter']");
  const sprintSearch = sprintHeader.locator("[data-filter='sprint-search']");
  await expectIdleHeaderControlsNotToOverlap(sprintHeader);
  await expectIdleHeaderExpandedSearch(sprintHeader);

  await sprintProject.selectOption("20");
  await expect(sprintFilter).toHaveValue("all");
  await expect(page.locator(".sprint-card[data-id='200']")).toBeVisible();
  await sprintHeader.locator("[data-action='open-sprint-filters']").click();
  filterDialog = page.locator("[data-sprint-filter-dialog]");
  await expect(filterDialog.locator("[data-filter='sprint-project']")).toHaveValue("20");
  await filterDialog.locator("[data-filter='sprint-project']").selectOption("10");
  await filterDialog.locator("[data-filter='sprint-filter']").selectOption("101");
  await filterDialog.locator("[data-filter='sprint-search']").fill("Regression");
  await expect(sprintProject).toHaveValue("10");
  await expect(sprintFilter).toHaveValue("101");
  await expect(sprintSearch).toHaveValue("Regression");
  await expect(page.locator(".sprint-card[data-id='101']")).toBeVisible();
  await expect(page.locator(".sprint-card[data-id='100']")).toHaveCount(0);
  await closeFilterDialog(page, "sprint");

  await sprintSearch.fill("");
  await page.clock.fastForward(500);
  await sprintFilter.selectOption("all");
  await sprintSearch.fill("Regression");
  await expect(page.locator(".sprint-card[data-id='100']")).toBeVisible();
  await page.clock.fastForward(499);
  await expect(page.locator(".sprint-card[data-id='100']")).toBeVisible();
  await page.clock.fastForward(1);
  await expect(page.locator(".sprint-card[data-id='101']")).toBeVisible();
  await expect(page.locator(".sprint-card[data-id='100']")).toHaveCount(0);
  await sprintSearch.fill("");
  await page.clock.fastForward(500);
  await sprintFilter.selectOption("101");
  await sprintSearch.evaluate(element => element.blur());
  await page.locator(".sprints-grid").hover();
  await page.clock.fastForward(3000);
  await expect(sprintHeader).toHaveClass(/is-idle-filter-header-compact/);
  await expect(sprintHeader.locator(".idle-filter-header-project-slot .idle-filter-header-context-summary")).toHaveText("Project: PMT - Project Management Tool");
  await expect(sprintHeader.locator(".idle-filter-header-sprint-slot .idle-filter-header-context-summary")).toHaveText("Sprint: Regression Coverage");
  await expectIdleHeaderSummaryBaseline(sprintHeader);
  await expectIdleSearchImmediatelyBeforeAdd(sprintHeader);
  await sprintHeader.hover({ position: { x: 4, y: 4 } });
  await expect(sprintHeader).not.toHaveClass(/is-idle-filter-header-compact/);

  await sprintSearch.fill("");
  await sprintFilter.selectOption("all");
  await sprintHeader.locator("[data-action='toggle-sprint-edit-mode']").click();
  const firstSprint = page.locator(".sprint-card[data-id='100']");
  const secondSprint = page.locator(".sprint-card[data-id='101']");
  await firstSprint.locator("[data-sprint-delete-select]").check();
  await secondSprint.locator("[data-sprint-delete-select]").check();
  expect(await firstSprint.locator(".sprint-actions").evaluate(actions => {
    const checkbox = actions.querySelector("[data-sprint-delete-select]");
    const trash = actions.querySelector("[data-action='delete-sprint']");
    return Boolean(checkbox.compareDocumentPosition(trash) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
  await firstSprint.locator("[data-action='delete-sprint']").click();
  confirmation = page.locator("dialog.mini-dialog", { has: page.getByRole("heading", { name: "Delete", exact: true }) });
  await expect(confirmation).toContainText("Delete 2 selected Sprints?");
  await confirmation.getByRole("button", { name: "Continue" }).click();
  await expect.poll(() => apiCalls.sprintDeletes).toEqual([100, 101]);
  await expect(page.locator(".sprint-card[data-id='100']")).toHaveCount(0);
  await expect(page.locator(".sprint-card[data-id='101']")).toHaveCount(0);
  await expect(page.locator("#toast")).toHaveText("2 Sprints deleted.");
});

test("draw.io SVG clipboard paste preserves UTF-8 spaces", async ({ page }) => {
  const appState = createTestState();
  const apiCalls = { securityReset: 0 };
  const expectedText = "First\u00a0block\u00a0label";
  const sourceSvg = `<svg xmlns="http://www.w3.org/2000/svg"><text>${expectedText}</text></svg>`;
  let uploadedRequestBody = "";

  await markCurrentReleaseSeen(page, 1);
  await installApiMocks(page, appState, apiCalls);
  await page.route("**/api/uploads/richtext", async route => {
    uploadedRequestBody = route.request().postDataBuffer()?.toString("utf8") || "";
    await route.fulfill(jsonResponse({
      fileName: "drawio-diagram.svg",
      url: "/uploads/richtext/drawio-diagram.svg",
      contentType: "image/svg+xml",
      byteLength: Buffer.byteLength(sourceSvg)
    }));
  });
  await page.route("**/uploads/richtext/drawio-diagram.svg", async route => {
    await route.fulfill({ status: 200, contentType: "image/svg+xml", body: sourceSvg });
  });

  await page.goto("/");
  await page.locator("#loginName").fill("Sin");
  await page.locator("#loginPassword").fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();
  await openNavView(page, "Tasks", "Dev Tasks");
  await page.locator("tr[data-task-id='1']").click();
  await page.locator("dialog.detail-dialog").getByRole("button", { name: "Edit" }).click();

  const editor = page.locator("#editorDialog [data-rich='descriptionHtml']");
  await editor.evaluate((element, svg) => {
    const bytes = new TextEncoder().encode(svg);
    const base64 = btoa(String.fromCharCode(...bytes));
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/html", `<img src="data:image/svg+xml;base64,${base64}">`);
    element.dispatchEvent(new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData
    }));
  }, sourceSvg);

  await expect(editor.locator("img.rich-svg-image")).toHaveAttribute("src", /drawio-diagram\.svg$/);
  await expect.poll(() => uploadedRequestBody).toContain(expectedText);
  expect(uploadedRequestBody).not.toContain("\u00c2");
});

test("RTE Select shows eight proportional image resize handles", async ({ page }) => {
  const appState = createTestState();
  const apiCalls = { securityReset: 0 };

  await markCurrentReleaseSeen(page, 1);
  await installApiMocks(page, appState, apiCalls);
  await page.goto("/");
  await page.locator("#loginName").fill("Sin");
  await page.locator("#loginPassword").fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();
  await openNavView(page, "Tasks", "Dev Tasks");
  await page.locator("tr[data-task-id='1']").click();
  await page.locator("dialog.detail-dialog").getByRole("button", { name: "Edit" }).click();

  const editor = page.locator("#editorDialog [data-rich='descriptionHtml']");
  await editor.evaluate(element => {
    const svg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><rect width="240" height="120" fill="#126bff"/></svg>');
    element.innerHTML = `<p>Resize test</p><img src="data:image/svg+xml,${svg}" alt="Resize test diagram">`;
  });

  const image = editor.getByRole("img", { name: "Resize test diagram" });
  await image.evaluate(element => element.decode());
  await image.click();
  await page.getByRole("menuitem", { name: "Select" }).click();

  const selection = page.getByRole("group", { name: "Selected image resize handles" });
  const handles = selection.locator("[data-rich-image-resize-handle]");
  await expect(selection).toBeVisible();
  await expect(handles).toHaveCount(8);
  expect(await handles.evaluateAll(elements => elements.map(element => element.dataset.richImageResizeHandle)))
    .toEqual(["nw", "n", "ne", "e", "se", "s", "sw", "w"]);

  const originalEditorStyle = await editor.getAttribute("style");
  await editor.evaluate(element => {
    element.style.height = "96px";
    element.style.minHeight = "96px";
    element.scrollTop = element.scrollHeight;
  });

  await expect.poll(() => selection.evaluate(overlay => {
    const editorElement = document.querySelector("#editorDialog [data-rich='descriptionHtml']");
    const toolbarElement = editorElement.previousElementSibling?.matches?.(".rich-tools")
      ? editorElement.previousElementSibling
      : null;
    const clipViewport = editorElement.closest(".dialog-body, .app-shell");
    const editorRect = editorElement.getBoundingClientRect();
    const toolbarRect = toolbarElement?.getBoundingClientRect();
    const clipViewportRect = clipViewport?.getBoundingClientRect();
    const allowed = {
      left: Math.max(0, editorRect.left, clipViewportRect?.left ?? 0),
      top: Math.max(0, editorRect.top, clipViewportRect?.top ?? 0, toolbarRect?.bottom ?? 0),
      right: Math.min(window.innerWidth, editorRect.right, clipViewportRect?.right ?? window.innerWidth),
      bottom: Math.min(window.innerHeight, editorRect.bottom, clipViewportRect?.bottom ?? window.innerHeight)
    };
    const handleElements = [...overlay.querySelectorAll("[data-rich-image-resize-handle]")];
    const topHandle = overlay.querySelector("[data-rich-image-resize-handle='n']");
    const topHandleRect = topHandle.getBoundingClientRect();
    const topHandlePoint = {
      x: topHandleRect.left + (topHandleRect.width / 2),
      y: topHandleRect.top + (topHandleRect.height / 2)
    };
    const visibleHandlePoints = handleElements
      .map(handle => {
        const rect = handle.getBoundingClientRect();
        return {
          handle,
          x: rect.left + (rect.width / 2),
          y: rect.top + (rect.height / 2)
        };
      })
      .filter(point => document.elementsFromPoint(point.x, point.y).includes(point.handle));

    return topHandlePoint.y < allowed.top
      && !document.elementsFromPoint(topHandlePoint.x, topHandlePoint.y).includes(topHandle)
      && visibleHandlePoints.length > 0
      && visibleHandlePoints.every(point => point.x >= allowed.left
        && point.x <= allowed.right
        && point.y >= allowed.top
        && point.y <= allowed.bottom);
  })).toBe(true);

  await editor.evaluate((element, style) => {
    if (style === null) element.removeAttribute("style");
    else element.setAttribute("style", style);
    element.scrollTop = 0;
    element.dispatchEvent(new Event("scroll"));
  }, originalEditorStyle);

  const bottomRightHandle = selection.locator("[data-rich-image-resize-handle='se']");
  await expect.poll(async () => {
    const imageBox = await image.boundingBox();
    const currentHandleBox = await bottomRightHandle.boundingBox();
    if (!imageBox || !currentHandleBox) return false;

    const handleCenter = {
      x: currentHandleBox.x + (currentHandleBox.width / 2),
      y: currentHandleBox.y + (currentHandleBox.height / 2)
    };
    const handleIsClickable = await bottomRightHandle.evaluate((handle, point) =>
      document.elementsFromPoint(point.x, point.y).includes(handle), handleCenter);

    return handleIsClickable
      && Math.abs(handleCenter.x - (imageBox.x + imageBox.width)) <= 8
      && Math.abs(handleCenter.y - (imageBox.y + imageBox.height)) <= 8;
  }).toBe(true);

  const before = await image.boundingBox();
  const handleBox = await bottomRightHandle.boundingBox();
  expect(before).not.toBeNull();
  expect(handleBox).not.toBeNull();

  await page.mouse.move(handleBox.x + (handleBox.width / 2), handleBox.y + (handleBox.height / 2));
  await page.mouse.down();
  await page.mouse.move(handleBox.x + (handleBox.width / 2) + 80, handleBox.y + (handleBox.height / 2) + 40, { steps: 5 });
  await page.mouse.up();

  const after = await image.boundingBox();
  expect(after).not.toBeNull();
  expect(after.x).toBeCloseTo(before.x, 0);
  expect(after.y).toBeCloseTo(before.y, 0);
  expect(after.width).toBeGreaterThan(before.width + 60);
  expect(after.width / after.height).toBeCloseTo(before.width / before.height, 1);
  await expect(image).toHaveAttribute("width", String(Math.round(after.width)));
  await expect(image).toHaveAttribute("style", new RegExp(`width: ${Math.round(after.width)}px; height: auto;`));
  await expect(image).toHaveAttribute("data-rich-image-resized", "true");

  const savedHtml = await editor.evaluate(element => element.innerHTML);
  expect(savedHtml).toContain(`width="${Math.round(after.width)}"`);
  expect(savedHtml).toContain('data-rich-image-resized="true"');

  await editor.click({ position: { x: 12, y: 12 } });
  await expect(selection).toHaveCount(0);
  await expect(editor).toBeFocused();

  await page.locator("#editorForm button[type='submit']").click();
  await expect.poll(() => appState.tasks.find(task => task.id === 1)?.descriptionHtml || "")
    .toContain(`width="${Math.round(after.width)}"`);
});

test("QA can edit only owned Scrum rows and private Log stays owner-only", async ({ page }) => {
  const appState = createTestState();
  const apiCalls = { securityReset: 0, sessionUserId: 3 };
  let savedScrumMethod = "";
  let savedScrumPayload = null;
  const today = new Date();
  const logDate = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");

  appState.devLogs = [
    { id: 1, logType: "Scrum", projectId: 10, userId: 1, logDate, bodyHtml: "<p>Administrator Scrum entry</p>", isPinned: false, updatedAt: `${logDate}T01:00:00Z` },
    { id: 2, logType: "Scrum", projectId: 10, userId: 3, logDate, bodyHtml: "<p>QA Scrum entry</p>", isPinned: false, updatedAt: `${logDate}T02:00:00Z` },
    { id: 3, logType: "Log", category: "Notes", projectId: null, userId: 1, logDate, bodyHtml: "<p>Administrator private note</p>", isPinned: false, updatedAt: `${logDate}T03:00:00Z` },
    { id: 4, logType: "Log", category: "Notes", projectId: null, userId: 3, logDate, bodyHtml: "<p>QA private note</p>", isPinned: false, updatedAt: `${logDate}T04:00:00Z` }
  ];
  appState.effectivePermissions = appState.securityResources.map(resource => ({
    resourceKey: resource.resourceKey,
    ...testHistoricalRolePermission(resource, "QA")
  }));

  await markCurrentReleaseSeen(page, 3);
  await installApiMocks(page, appState, apiCalls);
  await page.route("**/api/devlogs/2", async route => {
    savedScrumMethod = route.request().method();
    savedScrumPayload = requestJson(route);
    Object.assign(appState.devLogs.find(log => log.id === 2), savedScrumPayload, {
      rowVersion: "Ag==",
      updatedAt: `${logDate}T05:00:00Z`
    });
    await route.fulfill(jsonResponse({ id: 2 }));
  });
  await page.goto("/");
  await openNavView(page, "Scrum", "Scrum");
  await clickPageAction(page, "toggle-scrum-table-edit-mode");

  const otherRow = page.locator(".scrum-row[data-id='1']");
  const ownRow = page.locator(".scrum-row[data-id='2']");
  await expect(otherRow.locator("[data-action='edit-log'], [data-action='delete-log']")).toHaveCount(0);
  await expect(ownRow.locator("[data-action='edit-log']")).toHaveCount(1);
  await expect(ownRow.locator("[data-action='delete-log']")).toHaveCount(0);

  await ownRow.locator("[data-action='edit-log']").click();
  const scrumPinned = page.locator("#editorDialog [name='isPinned']");
  await expect(scrumPinned).toBeEnabled();
  await expect(scrumPinned).not.toBeChecked();
  await scrumPinned.check();
  await expect(scrumPinned).toBeChecked();
  await page.locator("#editorForm button[type='submit']").click();
  await expect.poll(() => savedScrumPayload?.isPinned).toBe(true);
  expect(savedScrumMethod).toBe("PUT");
  await expect(page.locator("#editorDialog")).not.toBeVisible();

  await page.reload();
  await openNavView(page, "Scrum", "Scrum");
  if (!await ownRow.locator("[data-action='edit-log']").count()) {
    await clickPageAction(page, "toggle-scrum-table-edit-mode");
  }
  await ownRow.locator("[data-action='edit-log']").click();
  await expect(page.locator("#editorDialog [name='isPinned']")).toBeChecked();
  await page.locator("#cancelDialog").click();

  await otherRow.click();
  const readOnlyDialog = page.locator("dialog.detail-dialog");
  await expect(readOnlyDialog).toBeVisible();
  await expect(page).toHaveURL(/#\/scrum\/1$/);
  await expect(readOnlyDialog).toContainText("Administrator Scrum entry");
  await expect(page.locator("#editorDialog")).not.toBeVisible();
  await readOnlyDialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page).toHaveURL(/#\/scrum$/);

  await openNavView(page, "Log", "Log");
  await expect(page.locator(".log-table tbody")).toContainText("QA private note");
  await expect(page.locator(".log-table tbody")).not.toContainText("Administrator private note");
  await page.locator(".log-row[data-id='4']").click();
  await expect(page.locator("#editorDialog [name='isPinned']")).toBeDisabled();
  await page.locator("#cancelDialog").click();
});

test.describe("local timestamp display", () => {
  test.use({ locale: "en-US", timezoneId: "Asia/Taipei" });

  test("UTC timestamps display in browser local time", async ({ page }) => {
    const appState = createTestState();
    const apiCalls = { securityReset: 0 };
    const task = appState.tasks.find(item => item.id === 1);
    task.startDate = "2026-07-14";
    task.endDate = "2026-07-15";
    task.createdAt = "2026-07-14T06:53:00Z";
    task.updatedAt = "2026-07-14T06:53:00Z";

    await markCurrentReleaseSeen(page, 1);
    await installApiMocks(page, appState, apiCalls);
    await page.goto("/");
    await page.locator("#loginName").fill("Sin");
    await page.locator("#loginPassword").fill("Password1");
    await page.getByRole("button", { name: /log in/i }).click();
    await openNavView(page, "Tasks", "Dev Tasks");
    await page.locator("tr[data-task-id='1']").click();

    const taskDetails = page.locator("dialog.detail-dialog");
    await expect(taskDetails.locator(".work-item-dialog-meta")).toContainText("7/14/2026, 2:53:00 PM");
    await taskDetails.getByRole("button", { name: "Edit" }).click();
    await expect(page.locator("#editorDialog [name='startDate']")).toHaveValue("2026-07-14");
  });
});

async function installApiMocks(page, appState, apiCalls) {
  let wfhSchedule = createWfhScheduleRows(appState.users);
  const attendanceEntries = appState.attendanceEntries || [];
  const vacationPlans = appState.vacationPlans || [];
  let nextAttendanceId = Math.max(0, ...attendanceEntries.map(item => Number(item.id) || 0)) + 1;
  let nextVacationId = Math.max(0, ...vacationPlans.map(item => Number(item.id) || 0)) + 1;
  let nextAttendanceMutationSecond = 1;
  let sessionUserId = Number(apiCalls.sessionUserId) || 0;

  apiCalls.setSessionUserId = userId => {
    sessionUserId = Number(userId) || 0;
  };

  await page.route("**/api/session", async route => {
    const user = appState.users.find(item => item.id === sessionUserId);
    if (!user) {
      await route.fulfill(jsonResponse({ error: "Unauthorized" }, 401));
      return;
    }

    await route.fulfill(jsonResponse(testSessionPayload(user)));
  });

  await page.route("**/api/login", async route => {
    const input = requestJson(route);
    if ((input.login || "").toLowerCase() === "sin" && input.password === "Password1") {
      sessionUserId = 1;
      await route.fulfill(jsonResponse(testSessionPayload(appState.users.find(user => user.id === 1))));
      return;
    }

    await route.fulfill(jsonResponse({ error: "Unauthorized" }, 401));
  });

  await page.route("**/api/state", async route => {
    apiCalls.stateGets = Number(apiCalls.stateGets || 0) + 1;
    if (apiCalls.failNextStateGet) {
      apiCalls.failNextStateGet = false;
      await route.fulfill(jsonResponse({ error: "Temporary state failure." }, 503));
      return;
    }

    await route.fulfill(jsonResponse(appState));
  });

  await page.route(/\/api\/attendance(?:\?.*)?$/, async route => {
    const currentUserId = sessionUserId;
    if (route.request().method() === "GET") {
      const url = new URL(route.request().url());
      const startDate = url.searchParams.get("startDate") || "0001-01-01";
      const endDate = url.searchParams.get("endDate") || "9999-12-31";
      if (!Array.isArray(apiCalls.attendanceGets)) apiCalls.attendanceGets = [];
      apiCalls.attendanceGets.push({ userId: currentUserId, startDate, endDate });
      if (apiCalls.holdAttendanceGets) {
        await new Promise(resolve => {
          apiCalls.releaseAttendanceGets = () => {
            apiCalls.holdAttendanceGets = false;
            resolve();
          };
        });
      }
      await route.fulfill(jsonResponse({
        entries: attendanceEntries.filter(item => item.attendanceDate >= startDate && item.attendanceDate <= endDate),
        vacations: vacationPlans.filter(item => !item.isCancelled
          && ((item.startDate <= endDate && item.endDate >= startDate) || item.userId === currentUserId))
      }));
      return;
    }

    const input = requestJson(route);
    const userId = Number(input.userId) || 0;
    const status = String(input.status || "");
    const attendanceDate = userId === currentUserId
      ? smokeToday
      : String(input.attendanceDate || smokeToday);
    if (!appState.users.some(user => user.id === userId) || !attendanceStatuses.includes(status)) {
      await route.fulfill(jsonResponse({ error: "Invalid attendance." }, 400));
      return;
    }

    let entry = attendanceEntries.find(item => item.userId === userId
      && item.attendanceDate === attendanceDate
      && item.status === status);
    const mutationTimestamp = `${smokeToday}T00:00:${String(nextAttendanceMutationSecond++).padStart(2, "0")}Z`;
    if (!entry) {
      entry = {
        id: nextAttendanceId++,
        userId,
        attendanceDate,
        status,
        recordedByUserId: currentUserId,
        createdAt: mutationTimestamp,
        updatedAt: mutationTimestamp
      };
      attendanceEntries.push(entry);
    } else {
      entry.recordedByUserId = currentUserId;
      entry.updatedAt = mutationTimestamp;
    }
    await route.fulfill(jsonResponse({ id: entry.id }));
  });

  await page.route(/\/api\/attendance\/\d+$/, async route => {
    const id = Number(route.request().url().match(/\/api\/attendance\/(\d+)$/)?.[1] || 0);
    const index = attendanceEntries.findIndex(item => item.id === id);
    if (index < 0) {
      await route.fulfill(jsonResponse({ error: "Attendance was not found." }, 404));
      return;
    }

    attendanceEntries.splice(index, 1);
    await route.fulfill({ status: 204, body: "" });
  });

  await page.route("**/api/vacations", async route => {
    const input = requestJson(route);
    if (!input.startDate || !input.endDate || input.startDate > input.endDate) {
      await route.fulfill(jsonResponse({ error: "Start date must be on or before end date." }, 400));
      return;
    }

    const plan = {
      id: nextVacationId++,
      userId: sessionUserId,
      startDate: input.startDate,
      endDate: input.endDate,
      isCancelled: false,
      createdAt: `${smokeToday}T00:00:00Z`,
      updatedAt: `${smokeToday}T00:00:00Z`
    };
    vacationPlans.push(plan);
    await route.fulfill(jsonResponse({ id: plan.id }));
  });

  await page.route(/\/api\/vacations\/\d+$/, async route => {
    const id = Number(route.request().url().match(/\/api\/vacations\/(\d+)$/)?.[1] || 0);
    const plan = vacationPlans.find(item => item.id === id && !item.isCancelled);
    if (!plan) {
      await route.fulfill(jsonResponse({ error: "Vacation not found." }, 404));
      return;
    }

    if (route.request().method() === "DELETE") {
      plan.isCancelled = true;
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    const input = requestJson(route);
    if (!input.startDate || !input.endDate || input.startDate > input.endDate) {
      await route.fulfill(jsonResponse({ error: "Start date must be on or before end date." }, 400));
      return;
    }
    plan.startDate = input.startDate;
    plan.endDate = input.endDate;
    plan.updatedAt = `${smokeToday}T01:00:00Z`;
    await route.fulfill(jsonResponse({ id: plan.id }));
  });

  await page.route(/\/api\/security\/[^/]+$/, async route => {
    const resourceKey = decodeURIComponent(route.request().url().split("/").pop() || "");
    if (resourceKey === "reset") {
      apiCalls.securityReset += 1;
      resetTestSecurityPermissions(appState);
      await route.fulfill(jsonResponse({ reset: true }));
      return;
    }

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

  await page.route(/\/api\/backlog\/tasks\/\d+$/, async route => {
    if (route.request().method() !== "DELETE") {
      await route.fallback();
      return;
    }

    const taskId = Number(route.request().url().match(/\/api\/backlog\/tasks\/(\d+)$/)?.[1] || 0);
    const task = appState.tasks.find(item => item.id === taskId);
    if (!task) {
      await route.fulfill(jsonResponse({ error: "Backlog item not found" }, 404));
      return;
    }

    if (!Array.isArray(apiCalls.backlogDeletes)) apiCalls.backlogDeletes = [];
    apiCalls.backlogDeletes.push(taskId);
    const deletedIds = new Set([
      taskId,
      ...appState.tasks.filter(item => item.parentTaskId === taskId).map(item => item.id)
    ]);
    appState.tasks = appState.tasks.filter(item => !deletedIds.has(item.id));
    await route.fulfill({ status: 204, body: "" });
  });

  await page.route(/\/api\/blogs\/\d+$/, async route => {
    if (route.request().method() !== "DELETE") {
      await route.fallback();
      return;
    }

    const blogId = Number(route.request().url().match(/\/api\/blogs\/(\d+)$/)?.[1] || 0);
    if (!appState.blogs.some(item => item.id === blogId)) {
      await route.fulfill(jsonResponse({ error: "Document not found" }, 404));
      return;
    }

    if (!Array.isArray(apiCalls.blogDeletes)) apiCalls.blogDeletes = [];
    apiCalls.blogDeletes.push(blogId);
    appState.blogs = appState.blogs
      .filter(item => item.id !== blogId)
      .map(item => item.parentBlogId === blogId ? { ...item, parentBlogId: null } : item);
    await route.fulfill({ status: 204, body: "" });
  });

  await page.route(/\/api\/sprints\/\d+$/, async route => {
    if (route.request().method() !== "DELETE") {
      await route.fallback();
      return;
    }

    const sprintId = Number(route.request().url().match(/\/api\/sprints\/(\d+)$/)?.[1] || 0);
    if (!appState.sprints.some(item => item.id === sprintId)) {
      await route.fulfill(jsonResponse({ error: "Sprint not found" }, 404));
      return;
    }

    if (!Array.isArray(apiCalls.sprintDeletes)) apiCalls.sprintDeletes = [];
    apiCalls.sprintDeletes.push(sprintId);
    appState.sprints = appState.sprints.filter(item => item.id !== sprintId);
    appState.tasks = appState.tasks.map(item => item.sprintId === sprintId ? { ...item, sprintId: null } : item);
    appState.blogs = appState.blogs.map(item => item.sprintId === sprintId ? { ...item, sprintId: null } : item);
    await route.fulfill({ status: 204, body: "" });
  });

  await page.route(/\/api\/tasks\/\d+$/, async route => {
    const taskId = Number(route.request().url().match(/\/api\/tasks\/(\d+)$/)?.[1] || 0);
    if (route.request().method() === "DELETE") {
      const task = appState.tasks.find(item => item.id === taskId);
      if (!task) {
        await route.fulfill(jsonResponse({ error: "Task not found" }, 404));
        return;
      }

      if (!Array.isArray(apiCalls.taskDeletes)) apiCalls.taskDeletes = [];
      apiCalls.taskDeletes.push(taskId);
      const deletedIds = new Set([
        taskId,
        ...appState.tasks.filter(item => item.parentTaskId === taskId).map(item => item.id)
      ]);
      appState.tasks = appState.tasks.filter(item => !deletedIds.has(item.id));
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    const input = requestJson(route);
    const task = appState.tasks.find(item => item.id === taskId);
    if (!task) {
      await route.fulfill(jsonResponse({ error: "Task not found" }, 404));
      return;
    }

    if (Array.isArray(apiCalls.taskSaves)) apiCalls.taskSaves.push(input);
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
    apiCalls.restoreSeed = (apiCalls.restoreSeed || 0) + 1;
    await route.fulfill(jsonResponse({ restored: true }));
  });

  await page.route("**/api/development/clear-non-pmt", async route => {
    apiCalls.clearNonPmt = (apiCalls.clearNonPmt || 0) + 1;
    await route.fulfill(jsonResponse({ cleared: true }));
  });

  await page.route("**/api/development/restore-pmt-seed-data", async route => {
    apiCalls.restorePmt += 1;
    await route.fulfill(jsonResponse({ restored: true }));
  });
}

async function markCurrentReleaseSeen(page, userId) {
  await page.addInitScript(id => {
    localStorage.setItem(`pmt-release-notes-last-seen:${id}`, "2026-07-16-day-29");
  }, userId);
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
  const headingLocator = page.getByRole("heading", { level: 1, name: heading, exact: true });
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

async function expectIdleHeaderControlsNotToOverlap(header) {
  await expect.poll(() => header.evaluate(element => {
    const toolbar = element.querySelector(":scope > .toolbar");
    if (!toolbar) return ["toolbar missing"];

    const visibleElements = [
      element.querySelector(":scope > h1"),
      ...toolbar.children
    ].filter(item => {
      if (!item) return false;
      const style = getComputedStyle(item);
      const rect = item.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && Number(style.opacity) > 0
        && rect.width > 1
        && rect.height > 1;
    });
    const label = item =>
      item.matches("[data-idle-filter-header-search-control]")
        ? "search"
        : item.matches("[data-idle-filter-header-context]")
          ? "project/sprint"
          : item.dataset.action
            || item.querySelector("[data-action]")?.dataset.action
            || item.className
            || item.tagName;
    const results = [];

    visibleElements.forEach((left, leftIndex) => {
      const leftRect = left.getBoundingClientRect();
      visibleElements.slice(leftIndex + 1).forEach(right => {
        const rightRect = right.getBoundingClientRect();
        const horizontalOverlap = Math.min(leftRect.right, rightRect.right) - Math.max(leftRect.left, rightRect.left);
        const verticalOverlap = Math.min(leftRect.bottom, rightRect.bottom) - Math.max(leftRect.top, rightRect.top);
        if (horizontalOverlap > 1 && verticalOverlap > 1) {
          results.push(`${label(left)} overlaps ${label(right)} by ${Math.round(horizontalOverlap)}px`);
        }
      });
    });

    return results;
  })).toEqual([]);
}

async function expectIdleHeaderExpandedSearch(header) {
  await expect.poll(() => header.evaluate(element => {
    const control = element.querySelector("[data-idle-filter-header-search-control]");
    const input = control?.querySelector("input");
    if (!control || !input) return ["search missing"];

    const controlBox = control.getBoundingClientRect();
    const inputBox = input.getBoundingClientRect();
    const inputStyle = getComputedStyle(input);
    const docked = element.classList.contains("is-idle-filter-header-search-docked");
    const expectedWidth = window.innerWidth <= 1000
      ? 154
      : Math.min(238, Math.max(182, window.innerWidth * 0.154));
    const issues = [];
    if (!docked && Math.abs(controlBox.width - expectedWidth) > 1) {
      issues.push(`search width is ${Math.round(controlBox.width)}px instead of ${Math.round(expectedWidth)}px`);
    }
    if (docked && (controlBox.width <= 44 || controlBox.width > expectedWidth + 1)) {
      issues.push(`docked search width is ${Math.round(controlBox.width)}px`);
    }
    if (Math.abs(inputBox.width - controlBox.width) > 1) {
      issues.push("search input does not fill its control");
    }
    if (Math.abs(Number.parseFloat(inputStyle.paddingRight) - 12) > 1) {
      issues.push(`search right padding is ${inputStyle.paddingRight}`);
    }
    if (Number(inputStyle.opacity) < 0.99) issues.push("search input is not visible");
    return issues;
  })).toEqual([]);
}

async function expectIdleSearchCentered(header) {
  await expect.poll(() => header.evaluate(element => {
    if (window.innerWidth <= 1000) return 0;
    const headerBox = element.getBoundingClientRect();
    const searchBox = element.querySelector("[data-idle-filter-header-search-control]")?.getBoundingClientRect();
    if (!searchBox) return Number.POSITIVE_INFINITY;
    return Math.abs(
      (headerBox.left + (headerBox.width / 2))
      - (searchBox.left + (searchBox.width / 2))
    );
  })).toBeLessThanOrEqual(1);
}

async function expectIdleHeaderSummaryBaseline(header) {
  await expect.poll(() => header.evaluate(element => {
    const titleMarker = element.querySelector("h1 .idle-filter-header-baseline-marker")?.getBoundingClientRect();
    const summaries = [...element.querySelectorAll(".idle-filter-header-context-summary")];
    const summaryMarkers = summaries.map(summary =>
      summary.querySelector(".idle-filter-header-baseline-marker")?.getBoundingClientRect());
    if (!titleMarker || summaryMarkers.some(marker => !marker)) return ["baseline marker missing"];

    const issues = summaryMarkers
      .map(marker => Math.abs(marker.top - titleMarker.top))
      .filter(difference => difference > 1)
      .map(difference => `baseline differs by ${difference.toFixed(2)}px`);
    if (summaries.length > 1) {
      const projectBox = summaries[0].getBoundingClientRect();
      const sprintBox = summaries[1].getBoundingClientRect();
      const gap = sprintBox.left - projectBox.right;
      if (gap < -1 || gap > 10) issues.push(`summary gap is ${gap.toFixed(2)}px`);
    }
    return issues;
  })).toEqual([]);
}

async function idleHeaderActionLayout(header) {
  return header.evaluate(element =>
    [...element.querySelector(":scope > .toolbar").children]
      .filter(child =>
        !child.matches("[data-idle-filter-header-context], [data-idle-filter-header-search-control]"))
      .map((child, index) => {
        const bounds = child.getBoundingClientRect();
        return {
          key: child.dataset.action
            || child.querySelector("[data-action]")?.dataset.action
            || `${child.tagName}-${index}`,
          x: Math.round(bounds.x),
          y: Math.round(bounds.y),
          width: Math.round(bounds.width),
          height: Math.round(bounds.height)
        };
      })
  );
}

async function expectIdleSearchImmediatelyBeforeAdd(header) {
  await expect.poll(() => header.evaluate(element => {
    const search = element.querySelector("[data-idle-filter-header-search-control]")?.getBoundingClientRect();
    const input = element.querySelector("[data-idle-filter-header-search-control] input");
    const inputBox = input?.getBoundingClientRect();
    const add = element.querySelector("[data-idle-filter-header-add-target]")?.getBoundingClientRect();
    if (!search || !input || !inputBox || !add) return ["search or Add button missing"];

    const gap = add.left - search.right;
    const expectedCompactWidth = Math.min(add.width, add.height);
    const verticalDifference = Math.abs(
      (search.top + (search.height / 2))
      - (add.top + (add.height / 2))
    );
    const issues = [];
    if (gap < 0 || gap > 16) issues.push(`search/Add gap is ${Math.round(gap)}px`);
    if (verticalDifference > 1) issues.push(`search/Add centers differ by ${Math.round(verticalDifference)}px`);
    if (Math.abs(inputBox.width - expectedCompactWidth) > 1) {
      issues.push(`compact input width is ${Math.round(inputBox.width)}px instead of ${Math.round(expectedCompactWidth)}px`);
    }
    if (Number(getComputedStyle(input).opacity) > 0.01) issues.push("compact search input is still visible");
    return issues;
  })).toEqual([]);
}

async function clickPageAction(page, action) {
  await page.locator(".page-actions-summary").click();
  await page.locator(`.page-actions-list [data-action='${action}']`).click();
}

function testSessionPayload(user) {
  return {
    userId: user.id,
    nickname: user.nickname,
    isAdmin: Boolean(user.isAdmin),
    role: user.role || "Developer",
    originalUserId: user.id,
    originalUserName: user.nickname,
    isImpersonating: false,
    impersonatedUserName: ""
  };
}

function scrumTodayPersonButton(page, userId) {
  return page.locator(
    `[data-scrum-today-user='${userId}'][data-action='filter-scrum-person'], `
    + `[data-scrum-today-user='${userId}'] [data-action='filter-scrum-person']`
  ).first();
}

function scrumTodayStatus(page, userId, status) {
  return page.locator(
    `[data-scrum-today-user='${userId}'][data-attendance-status='${status}'], `
    + `[data-scrum-today-user='${userId}'] [data-attendance-status='${status}']`
  ).first();
}

function scrumCalendarVacationAvatar(page, day, userId) {
  return page.locator(
    `[data-scrum-calendar-day='${day}'] [data-attendance-status='Vacation'] [data-scrum-calendar-user='${userId}']`
  );
}

function scrumCalendarOccurrenceButton(page, day, userId, status, source) {
  return page.locator(
    `[data-scrum-calendar-day='${day}'] [data-attendance-status='${status}'] `
    + `[data-action='open-scrum-calendar-avatar-menu'][data-scrum-calendar-user-id='${userId}']`
    + `[data-scrum-calendar-source='${source}']`
  );
}

async function expectDialogLabelledByOwnHeading(dialog, heading) {
  const titleId = await dialog.getAttribute("aria-labelledby");
  expect(titleId).toBeTruthy();
  await expect(dialog.locator(`[id='${titleId}']`)).toHaveText(heading);
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
  await dragBoardTaskToStatus(page, "PMT-TASK-001", "In Progress");
}

async function dragBoardTaskToStatus(page, taskCode, status) {
  const source = page.locator(".task-card", { hasText: taskCode }).first();
  const target = page.locator(`.column[data-status='${status}']`).first();
  await expect(source).toBeVisible();
  await expect(target).toBeVisible();

  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  const targetOffsetY = Math.max(5, Math.min(55, targetBox.height - 5));
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetOffsetY, { steps: 8 });
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
      { id: 1, name: "Test Holiday", holidayDate: "2026-06-19", countryCode: "PH", isActive: true },
      { id: 2, name: "Smoke Holiday", holidayDate: smokeToday, countryCode: "PH", isActive: true },
      { id: 3, name: "Second Smoke Holiday", holidayDate: smokeToday, countryCode: "US", isActive: true },
      { id: 4, name: "Inactive Holiday", holidayDate: smokeToday, countryCode: "PH", isActive: false }
    ],
    attendanceEntries: [
      { id: 1, userId: 1, attendanceDate: smokeToday, status: "Office", recordedByUserId: 1, createdAt: `${smokeToday}T00:00:00Z`, updatedAt: `${smokeToday}T00:00:00Z` },
      { id: 2, userId: 2, attendanceDate: smokeToday, status: "Home", recordedByUserId: 2, createdAt: `${smokeToday}T00:00:00Z`, updatedAt: `${smokeToday}T00:00:00Z` },
      { id: 3, userId: 1, attendanceDate: "2026-07-18", status: "Office", recordedByUserId: 1, createdAt: `${smokeToday}T00:00:00Z`, updatedAt: `${smokeToday}T00:00:00Z` }
    ],
    vacationPlans: [
      { id: 1, userId: 3, startDate: "2026-07-14", endDate: "2026-07-17", isCancelled: false, createdAt: `${smokeToday}T00:00:00Z`, updatedAt: `${smokeToday}T00:00:00Z` }
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

  resetTestSecurityPermissions(state);
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

function resetTestSecurityPermissions(state) {
  const roleCodes = ["Developer", "QA"];
  const userIds = state.users.filter(user => !user.isAdmin).map(user => user.id);
  state.rolePermissions = state.securityResources.flatMap(resource => roleCodes.map(roleCode => ({
    resourceKey: resource.resourceKey,
    roleCode,
    ...testHistoricalRolePermission(resource, roleCode)
  })));
  state.userPermissions = state.securityResources.flatMap(resource => userIds.map(userId => ({
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
}

function testHistoricalRolePermission(resource, roleCode) {
  const granted = new Set(["Read"]);
  const grant = (...rights) => rights.forEach(right => granted.add(right));
  const resourceKey = resource.resourceKey;

  if (["Board", "WfhSchedule", "Settings"].includes(resourceKey)) grant("Update");
  if (["Board", "WfhSchedule"].includes(resourceKey)) grant("Export");
  if (["Scrum", "Documentation"].includes(resourceKey)) grant("Create", "Update", "Import", "Export");
  if (resourceKey === "PersonalLog") grant("Create", "Update", "Delete", "Import", "Export");

  if (roleCode === "Developer") {
    if (["DevTasks", "Backlog"].includes(resourceKey)) grant("Create", "Update", "Delete", "Import", "Export");
    if (resourceKey === "BugTracking") grant("Create", "Export");
  }

  if (roleCode === "QA") {
    if (resourceKey === "DevTasks") grant("Export");
    if (resourceKey === "BugTracking") grant("Create", "Update", "Delete", "Import", "Export");
    if (resourceKey === "Backlog") grant("Create", "Update", "Import", "Export");
  }

  const available = new Set(resource.availableRights.split(","));
  return {
    canRead: available.has("Read") && granted.has("Read"),
    canCreate: available.has("Create") && granted.has("Create"),
    canUpdate: available.has("Update") && granted.has("Update"),
    canDelete: available.has("Delete") && granted.has("Delete"),
    canImport: available.has("Import") && granted.has("Import"),
    canExport: available.has("Export") && granted.has("Export"),
    noAccess: false
  };
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
