import { expect, test } from "@playwright/test";

const recycleInventory = [
  {
    itemType: "Project",
    itemId: 11,
    label: "ARCH - Archived Project",
    details: "Archived project selected for permanent deletion",
    deletedAt: "2026-06-01T10:00:00Z",
    isCascade: false
  },
  {
    itemType: "Sprint",
    itemId: 22,
    label: "ARCH-Sprint01 - Archived Sprint",
    details: "Directly deleted Sprint",
    deletedAt: "2026-06-02T10:00:00Z",
    isCascade: false
  },
  {
    itemType: "Task",
    itemId: 33,
    label: "ARCH-TASK-001 - Archived Task",
    details: "Directly deleted Dev Task",
    deletedAt: "2026-06-03T10:00:00Z",
    isCascade: false
  }
];

const recyclePreview = [
  recycleInventory[0],
  {
    itemType: "Sprint",
    itemId: 44,
    label: "ARCH-Sprint02 - Project Sprint",
    details: "Included because its Project was selected",
    deletedAt: "2026-06-01T10:00:00Z",
    isCascade: true
  },
  {
    itemType: "Task",
    itemId: 55,
    label: "ARCH-TASK-002 - Project Task",
    details: "Included because its Project was selected",
    deletedAt: "2026-06-01T10:00:00Z",
    isCascade: true
  }
];

const orphanInventory = [
  {
    relativePath: "richtext/orphan-a.svg",
    fileName: "orphan-a.svg",
    category: "richtext",
    url: "/api/maintenance/orphan-files/preview?relativePath=richtext%2Forphan-a.svg&currentUserId=1",
    byteLength: 2048,
    lastModifiedAt: "2026-06-01T08:00:00Z"
  },
  {
    relativePath: "tasks/orphan-b.png",
    fileName: "orphan-b.png",
    category: "tasks",
    url: "/api/maintenance/orphan-files/preview?relativePath=tasks%2Forphan-b.png&currentUserId=1",
    byteLength: 4096,
    lastModifiedAt: "2026-06-02T08:00:00Z"
  }
];

test("Maintenance previews the server-expanded recycle-bin selection before purge and refreshes", async ({ page }) => {
  let recycleLoads = 0;
  let orphanLoads = 0;
  const previewPayloads = [];
  const purgePayloads = [];

  await prepareMaintenancePage(page, {
    async recycle(route) {
      recycleLoads += 1;
      await route.fulfill(jsonResponse(recycleLoads === 1 ? recycleInventory : []));
    },
    async orphans(route) {
      orphanLoads += 1;
      await route.fulfill(jsonResponse({
        files: orphanInventory,
        totalCount: orphanInventory.length,
        totalByteLength: orphanInventory.reduce((total, file) => total + file.byteLength, 0)
      }));
    },
    async preview(route) {
      previewPayloads.push(route.request().postDataJSON());
      await route.fulfill(jsonResponse(recyclePreview));
    },
    async purge(route) {
      purgePayloads.push(route.request().postDataJSON());
      await route.fulfill(jsonResponse(recyclePreview));
    }
  });

  await loginToMaintenance(page);

  const maintenanceButton = page.locator("[data-action='select-lookup-type'][data-type='Maintenance']");
  const recycle = page.locator("[data-maintenance-section='recycle']");
  const files = page.locator("[data-maintenance-section='files']");
  await expect(maintenanceButton).toHaveClass(/active/);
  await expect(page).toHaveURL(/#\/settings\/maintenance$/);
  await expect(recycle.locator("[data-maintenance-select='recycle']")).toHaveCount(3);
  await expect(recycle.locator("[data-maintenance-select='recycle']:checked")).toHaveCount(3);
  await expect(files.locator("[data-maintenance-select='files']")).toHaveCount(2);
  await expect(files.locator("[data-maintenance-select='files']:checked")).toHaveCount(2);

  await recycle.getByLabel("Select ARCH-Sprint01 - Archived Sprint").uncheck();
  await expect(recycle.locator("[data-maintenance-selection-count]")).toHaveText("2 selected");

  await recycle.getByRole("button", { name: "Clear All" }).click();
  await expect(recycle.locator("[data-maintenance-select='recycle']:checked")).toHaveCount(0);
  await expect(recycle.getByRole("button", { name: "Review Selected" })).toBeDisabled();

  await recycle.getByRole("button", { name: "Select All" }).click();
  await expect(recycle.locator("[data-maintenance-select='recycle']:checked")).toHaveCount(3);
  await expect(recycle.locator("[data-maintenance-selection-count]")).toHaveText("3 selected");

  await recycle.getByRole("button", { name: "Clear All" }).click();
  await recycle.getByLabel("Select ARCH - Archived Project").check();
  await recycle.getByRole("button", { name: "Review Selected" }).click();

  let confirmation = page.locator("dialog.maintenance-confirm-dialog");
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByRole("heading", { name: "Permanently Delete Recycle-Bin Items" })).toBeVisible();
  await expect(confirmation.locator(".maintenance-confirm-list > li")).toHaveCount(3);
  await expect(confirmation).toContainText("ARCH - Archived Project");
  await expect(confirmation).toContainText("ARCH-Sprint02 - Project Sprint");
  await expect(confirmation).toContainText("ARCH-TASK-002 - Project Task");
  await expect(confirmation.locator(".pill").filter({ hasText: "Included with Project" })).toHaveCount(2);
  expect(previewPayloads).toEqual([{ items: [{ itemType: "Project", itemId: 11 }] }]);

  await confirmation.getByRole("button", { name: "Cancel" }).click();
  await expect(confirmation).toHaveCount(0);
  expect(purgePayloads).toEqual([]);

  await recycle.getByRole("button", { name: "Review Selected" }).click();
  confirmation = page.locator("dialog.maintenance-confirm-dialog");
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Permanently Delete" }).click();

  await expect.poll(() => purgePayloads).toEqual([
    {
      items: [{ itemType: "Project", itemId: 11 }],
      expectedItems: recyclePreview.map(item => ({ itemType: item.itemType, itemId: item.itemId }))
    }
  ]);
  await expect(page.locator("#toast")).toHaveText("3 recycle-bin items permanently deleted.");
  await expect(recycle).toContainText("The recycle bin is empty.");
  await expect.poll(() => recycleLoads).toBeGreaterThanOrEqual(2);
  await expect.poll(() => orphanLoads).toBeGreaterThanOrEqual(2);
});

test("Maintenance confirms only selected orphan paths before delete and rescans afterward", async ({ page }) => {
  let recycleLoads = 0;
  let orphanLoads = 0;
  const deletePayloads = [];

  await prepareMaintenancePage(page, {
    async recycle(route) {
      recycleLoads += 1;
      await route.fulfill(jsonResponse(recycleInventory));
    },
    async orphans(route) {
      orphanLoads += 1;
      const files = orphanLoads === 1 ? orphanInventory : [];
      await route.fulfill(jsonResponse({
        files,
        totalCount: files.length,
        totalByteLength: files.reduce((total, file) => total + file.byteLength, 0)
      }));
    },
    async deleteFiles(route) {
      deletePayloads.push(route.request().postDataJSON());
      await route.fulfill(jsonResponse({
        results: [{
          relativePath: "tasks/orphan-b.png",
          status: "deleted",
          message: "The file was permanently deleted."
        }],
        deletedCount: 1,
        skippedCount: 0,
        failedCount: 0
      }));
    }
  });

  await loginToMaintenance(page);

  const files = page.locator("[data-maintenance-section='files']");
  await expect(files.locator("[data-maintenance-select='files']")).toHaveCount(2);
  await expect(files.locator("[data-maintenance-select='files']:checked")).toHaveCount(2);
  const previewLink = files.getByRole("link", { name: "richtext/orphan-a.svg" });
  await expect(previewLink).toHaveAttribute("href", "/api/maintenance/orphan-files/preview?relativePath=richtext%2Forphan-a.svg&currentUserId=1");
  await expect(previewLink).toHaveAttribute("target", "_blank");
  await expect(previewLink).toHaveAttribute("rel", "noopener noreferrer");
  const popupPromise = page.waitForEvent("popup");
  await previewLink.click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/\/api\/maintenance\/orphan-files\/preview/);
  expect(new URL(popup.url()).searchParams.get("relativePath")).toBe("richtext/orphan-a.svg");
  expect(new URL(popup.url()).searchParams.get("currentUserId")).toBe("1");
  await popup.close();

  await files.getByLabel("Select richtext/orphan-a.svg").uncheck();
  await expect(files.locator("[data-maintenance-selection-count]")).toHaveText("1 selected");

  await files.getByRole("button", { name: "Clear All" }).click();
  await expect(files.locator("[data-maintenance-select='files']:checked")).toHaveCount(0);
  await expect(files.getByRole("button", { name: "Review Selected" })).toBeDisabled();

  await files.getByRole("button", { name: "Select All" }).click();
  await expect(files.locator("[data-maintenance-select='files']:checked")).toHaveCount(2);
  await files.getByLabel("Select richtext/orphan-a.svg").uncheck();
  await files.getByRole("button", { name: "Review Selected" }).click();

  let confirmation = page.locator("dialog.maintenance-confirm-dialog");
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByRole("heading", { name: "Permanently Delete Orphaned Files" })).toBeVisible();
  await expect(confirmation.locator(".maintenance-confirm-list > li")).toHaveCount(1);
  await expect(confirmation).toContainText("tasks/orphan-b.png");
  await expect(confirmation).not.toContainText("richtext/orphan-a.svg");

  await confirmation.getByRole("button", { name: "Cancel" }).click();
  await expect(confirmation).toHaveCount(0);
  expect(deletePayloads).toEqual([]);

  await files.getByRole("button", { name: "Review Selected" }).click();
  confirmation = page.locator("dialog.maintenance-confirm-dialog");
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Permanently Delete" }).click();

  await expect.poll(() => deletePayloads).toEqual([
    { relativePaths: ["tasks/orphan-b.png"] }
  ]);
  await expect(page.locator("#toast")).toHaveText("1 file deleted.");
  await expect(files).toContainText("No orphaned uploaded files were found.");
  await expect.poll(() => orphanLoads).toBeGreaterThanOrEqual(2);
  expect(recycleLoads).toBe(1);
});

async function prepareMaintenancePage(page, handlers = {}) {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("pmt-release-notes-last-seen:1", "2026-07-16-day-29");
  });
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
  await page.route("**/api/maintenance/recycle-bin", handlers.recycle || (async route => {
    await route.fulfill(jsonResponse(recycleInventory));
  }));
  await page.route("**/api/maintenance/orphan-files", handlers.orphans || (async route => {
    await route.fulfill(jsonResponse({ files: orphanInventory }));
  }));
  await page.route("**/api/maintenance/orphan-files/preview**", handlers.previewFile || (async route => {
    await route.fulfill({
      status: 200,
      contentType: "text/plain; charset=utf-8",
      headers: {
        "Cache-Control": "no-store",
        "Content-Security-Policy": "sandbox; default-src 'none'",
        "X-Content-Type-Options": "nosniff"
      },
      body: '<svg xmlns="http://www.w3.org/2000/svg"><text>Orphan preview</text></svg>'
    });
  }));
  await page.route("**/api/maintenance/recycle-bin/preview", handlers.preview || (async route => {
    await route.fulfill(jsonResponse(recyclePreview));
  }));
  await page.route("**/api/maintenance/recycle-bin/purge", handlers.purge || (async route => {
    await route.fulfill(jsonResponse(recyclePreview));
  }));
  await page.route("**/api/maintenance/orphan-files/delete", handlers.deleteFiles || (async route => {
    await route.fulfill(jsonResponse({ deletedCount: 0, skippedCount: 0, failedCount: 0, results: [] }));
  }));
}

async function loginToMaintenance(page) {
  await page.goto("/#/settings/maintenance");
  await page.locator("#loginName").fill("Sin");
  await page.locator("#loginPassword").fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Maintenance", exact: true })).toBeVisible();
}

function testState() {
  return {
    users: [{
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
    }],
    projects: [{ id: 1, code: "PMT", name: "Maintenance Test", isActive: true }],
    sprints: [],
    tasks: [],
    devLogs: [],
    blogs: [],
    auditEvents: [],
    lookups: [],
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

function jsonResponse(data, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(data)
  };
}
