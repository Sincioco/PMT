import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  buildAnnotationSvg,
  normalizeAnnotationState
} from "../../wwwroot/js/components/image-annotation.js";
import { releaseNotes } from "../../wwwroot/js/shared/release-notes-data.js";

test.use({ timezoneId: "Asia/Taipei" });

const closureScreenshotDirectory = path.resolve(
  "docs",
  "screenshots",
  "diagram-2-phase-6",
  "closure"
);
const nestedRootId = 1001;
const nestedChildId = 1002;

test("Documentation, Diagram 1, and Diagram 2 preserve TreeNav scroll and focus", async ({ page }, testInfo) => {
  const state = treeNavState();
  await initializeTreeNavApplication(page, state);

  const configurations = [
    {
      hash: "#/documentation",
      screenSelector: ".documentation-screen.is-tree-view",
      paneSelector: ".documentation-tree-pane",
      rowSelector: "[data-documentation-tree-row]",
      itemAction: "select-documentation-tree-blog",
      toggleAction: "toggle-documentation-tree-node",
      selectedSelector: "[data-documentation-tree-row].is-selected",
      previewTitleSelector: ".documentation-tree-preview-head h2",
      screenshot: "documentation-treenav-scroll-preserved-1366x768.png"
    },
    {
      hash: "#/diagram",
      screenSelector: ".diagram-screen.is-tree-view",
      paneSelector: ".diagram-tree-pane",
      rowSelector: "[data-diagram-tree-row]",
      itemAction: "select-diagram-document",
      toggleAction: "toggle-diagram-tree-node",
      selectedSelector: "[data-diagram-tree-row].is-selected",
      previewTitleSelector: ".diagram-page-document-head h2",
      externalRoutePrefix: "diagram",
      screenshot: "diagram1-treenav-scroll-preserved-1366x768.png"
    },
    {
      hash: "#/diagram-2",
      screenSelector: "[data-diagram2-screen].is-tree-view",
      paneSelector: ".diagram2-tree-pane",
      rowSelector: "[data-diagram2-tree-row]",
      itemAction: "select-diagram2-document",
      toggleAction: "toggle-diagram2-tree-node",
      selectedSelector: "[data-diagram2-tree-row].is-selected",
      previewTitleSelector: ".diagram2-page-document-head h2",
      readySelector: "[data-diagram2-live-viewer]:not(.is-loading)",
      externalRoutePrefix: "diagram-2",
      screenshot: "diagram2-treenav-scroll-preserved-1366x768.png"
    }
  ];

  for (const configuration of configurations) {
    await openTreeNavScreen(page, configuration);
    await exerciseTreeNavSelection(page, testInfo, configuration, state.blogs);
  }
});

test("Diagram 1 and Diagram 2 mirror Documentation filter options and behavior", async ({ page }) => {
  const state = treeNavState();
  await initializeTreeNavApplication(page, state);

  await openTreeNavScreen(page, {
    hash: "#/documentation",
    screenSelector: ".documentation-screen.is-tree-view"
  });
  await page.locator("[data-action='open-documentation-filters']").click();
  const documentationDialog = page.locator("[data-documentation-filter-dialog]");
  await expect(documentationDialog).toBeVisible();
  const documentationContract = await filterContract(documentationDialog);
  await documentationDialog.locator("[data-close-documentation-filters]").first().click();

  for (const configuration of [
    {
      hash: "#/diagram",
      screenSelector: ".diagram-screen.is-tree-view",
      rowSelector: "[data-diagram-tree-row]",
      openAction: "open-diagram-filters",
      dialogSelector: "[data-diagram-filter-dialog]",
      closeSelector: "[data-close-diagram-filters]",
      resetSelector: "[data-reset-diagram-filters]",
      filterPrefix: "diagram",
      viewAction: "set-diagram-view",
      treeAction: "set-diagram-view"
    },
    {
      hash: "#/diagram-2",
      screenSelector: "[data-diagram2-screen].is-tree-view",
      rowSelector: "[data-diagram2-tree-row]",
      openAction: "open-diagram2-filters",
      dialogSelector: "[data-diagram2-filter-dialog]",
      closeSelector: "[data-close-diagram2-filters]",
      resetSelector: "[data-reset-diagram2-filters]",
      filterPrefix: "diagram2",
      viewAction: "set-diagram2-view",
      treeAction: "toggle-diagram2-tree-pane"
    }
  ]) {
    await openTreeNavScreen(page, configuration);
    await page.locator(`[data-action='${configuration.openAction}']`).click();
    const dialog = page.locator(configuration.dialogSelector);
    await expect(dialog).toBeVisible();
    expect(await filterContract(dialog)).toEqual(documentationContract);
    await exerciseDiagramFilters(page, dialog, configuration, state.blogs);

    await dialog.locator(configuration.closeSelector).first().click();
    await page.locator(`[data-action='${configuration.viewAction}'][data-mode='cards']`).click();
    await page.locator(`[data-action='${configuration.openAction}']`).click();
    const cardDialog = page.locator(configuration.dialogSelector);
    await expect(cardDialog).toBeVisible();
    await expect(cardDialog.locator(`select[data-filter='${configuration.filterPrefix}-tree-group']`)).toHaveCount(1);
    await expect(cardDialog.locator(`select[data-filter='${configuration.filterPrefix}-tree-layout']`)).toHaveCount(0);
    await cardDialog.locator(configuration.closeSelector).first().click();
    await page.locator(`[data-action='${configuration.treeAction}'][data-mode='tree']`).click();
  }
});

async function initializeTreeNavApplication(page, state) {
  await page.addInitScript(seenToken => {
    localStorage.clear();
    localStorage.setItem("pmt-release-notes-last-seen:1", seenToken);
    localStorage.setItem("pmt-release-notes-last-seen:2", seenToken);
    localStorage.setItem("pmt-documentation-view-mode", "tree");
    localStorage.setItem("pmt-documentation-tree-pane-hidden", "false");
    localStorage.setItem("pmt-diagram-view-mode", "tree");
    localStorage.setItem("pmt-diagram-tree-pane-hidden", "false");
    localStorage.setItem("pmt-diagram2-tree-pane-hidden", "false");
  }, releaseNotes[0].seenToken);

  await page.route("**/api/session", route =>
    route.fulfill(jsonResponse({ error: "Unauthorized" }, 401)));
  await page.route("**/api/login", route => route.fulfill(jsonResponse({
    userId: 1,
    nickname: "Sin",
    isAdmin: true,
    role: "Admin"
  })));
  await page.route("**/api/state", route => route.fulfill(jsonResponse(state)));
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
}

async function openTreeNavScreen(page, configuration) {
  await page.evaluate(hash => {
    window.location.hash = hash;
  }, configuration.hash);
  await expect(page.locator(configuration.screenSelector)).toBeVisible();
}

async function exerciseTreeNavSelection(page, testInfo, configuration, blogs) {
  const pane = page.locator(configuration.paneSelector);
  await expect(pane).toBeVisible();
  await expect(page.locator(configuration.rowSelector)).toHaveCount(88);

  const collapsedRoot = page.locator(`${configuration.rowSelector}[data-id='${nestedRootId}']`);
  await collapsedRoot.locator(`[data-action='${configuration.toggleAction}']`).click();
  await expect(collapsedRoot).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(configuration.rowSelector)).toHaveCount(85);

  const initialPane = await pane.evaluate(element => {
    element.scrollTop = 900;
    element.scrollLeft = Math.min(120, Math.max(0, element.scrollWidth - element.clientWidth));
    return {
      top: element.scrollTop,
      left: element.scrollLeft,
      width: element.getBoundingClientRect().width,
      hidden: element.hidden
    };
  });
  expect(initialPane.top).toBeGreaterThan(600);
  expect(initialPane.hidden).toBe(false);

  const firstId = await visibleCandidateId(pane, configuration, []);
  const firstBefore = await treePanePosition(pane);
  await page.locator(`[data-action='${configuration.itemAction}'][data-id='${firstId}']`).click();
  await assertSelectedTreeItem(page, configuration, firstId, blogs);
  await assertTreePanePreserved(pane, firstBefore, initialPane.width);
  await expect(collapsedRoot).toHaveAttribute("aria-expanded", "false");

  const secondId = await visibleCandidateId(pane, configuration, [firstId]);
  const secondButton = page.locator(
    `[data-action='${configuration.itemAction}'][data-id='${secondId}']`
  );
  const secondBefore = await treePanePosition(pane);
  await secondButton.focus();
  await secondButton.press("Enter");
  await assertSelectedTreeItem(page, configuration, secondId, blogs);
  await assertTreePanePreserved(pane, secondBefore, initialPane.width);
  await expect(collapsedRoot).toHaveAttribute("aria-expanded", "false");

  if (testInfo.project.name === "chromium-1366") {
    await mkdir(closureScreenshotDirectory, { recursive: true });
    await page.screenshot({
      path: path.join(closureScreenshotDirectory, configuration.screenshot),
      fullPage: false
    });
  }

  if (configuration.externalRoutePrefix) {
    await page.evaluate(({ prefix, id }) => {
      window.location.hash = `#/${prefix}/${id}`;
    }, { prefix: configuration.externalRoutePrefix, id: nestedChildId });
    await expect(page).toHaveURL(new RegExp(`#/${configuration.externalRoutePrefix}/${nestedChildId}$`));
    await assertSelectedTreeItem(page, configuration, nestedChildId, blogs, { assertFocus: false });
    await expect(collapsedRoot).toHaveAttribute("aria-expanded", "true");
    const externallySelected = page.locator(
      `${configuration.rowSelector}[data-id='${nestedChildId}']`
    );
    await expect(externallySelected).toBeVisible();
    expect(await rowIsInsidePane(externallySelected, pane)).toBe(true);
  }
}

async function visibleCandidateId(pane, configuration, excludedIds) {
  const id = await pane.evaluate((element, options) => {
    const paneBounds = element.getBoundingClientRect();
    const excluded = new Set(options.excludedIds.map(String));
    const candidates = [...element.querySelectorAll(
      `[data-action='${options.itemAction}'][data-id]`
    )].filter(button => {
      if (excluded.has(button.dataset.id)) return false;
      const bounds = button.getBoundingClientRect();
      return bounds.top >= paneBounds.top + (paneBounds.height * 0.48)
        && bounds.bottom <= paneBounds.bottom - 4;
    });
    return candidates.at(-1)?.dataset.id || "";
  }, {
    itemAction: configuration.itemAction,
    excludedIds: [nestedRootId, nestedChildId, ...excludedIds]
  });
  expect(id).not.toBe("");
  return id;
}

async function assertSelectedTreeItem(page, configuration, id, blogs, { assertFocus = true } = {}) {
  const selectedRow = page.locator(
    `${configuration.selectedSelector}[data-id='${id}']`
  );
  await expect(selectedRow).toHaveCount(1);
  const title = blogs.find(blog => String(blog.id) === String(id))?.title || "";
  if (configuration.previewTitleSelector) {
    await expect(page.locator(configuration.previewTitleSelector)).toHaveText(title);
  }
  if (configuration.readySelector) {
    await expect(page.locator(configuration.readySelector)).toBeVisible();
  }
  if (assertFocus) {
    await expect.poll(() => page.evaluate(() =>
      String(document.activeElement?.dataset?.id || "")
    )).toBe(String(id));
  }
  expect(await rowIsInsidePane(selectedRow, page.locator(configuration.paneSelector))).toBe(true);
  if (configuration.externalRoutePrefix === "diagram-2") {
    await expect(page).toHaveURL(new RegExp(`#/${configuration.externalRoutePrefix}/${id}$`));
  }
}

async function assertTreePanePreserved(pane, before, width) {
  const after = await treePanePosition(pane);
  expect(Math.abs(after.top - before.top)).toBeLessThanOrEqual(2);
  expect(Math.abs(after.left - before.left)).toBeLessThanOrEqual(2);
  expect(Math.abs(after.width - width)).toBeLessThanOrEqual(1);
  expect(after.hidden).toBe(false);
}

async function treePanePosition(pane) {
  return pane.evaluate(element => ({
    top: element.scrollTop,
    left: element.scrollLeft,
    width: element.getBoundingClientRect().width,
    hidden: element.hidden
  }));
}

async function rowIsInsidePane(row, pane) {
  const [rowBounds, paneBounds] = await Promise.all([
    row.boundingBox(),
    pane.boundingBox()
  ]);
  return Boolean(
    rowBounds
    && paneBounds
    && rowBounds.y >= paneBounds.y - 2
    && rowBounds.y + rowBounds.height <= paneBounds.y + paneBounds.height + 2
  );
}

async function filterContract(dialog) {
  return dialog.evaluate(element => {
    const fields = [...element.querySelectorAll(".task-filter-row > label")]
      .map(label => {
        const name = label.querySelector(":scope > span")?.textContent?.trim() || "";
        const select = label.querySelector("select");
        return {
          name,
          options: select
            ? [...select.options].map(option =>
                option.textContent.trim().replace(/^All (Documents|Diagrams)$/, "All Items"))
            : []
        };
      });
    return {
      fields,
      userSections: [...element.querySelectorAll(".documentation-filter-user-sections legend")]
        .map(legend => legend.textContent.trim())
    };
  });
}

async function exerciseDiagramFilters(page, dialog, configuration, blogs) {
  const prefix = configuration.filterPrefix;
  const rows = page.locator(configuration.rowSelector);
  const expectedProjectCount = blogs.filter(blog => blog.projectId === 1).length;
  const expectedSprintCount = blogs.filter(blog => blog.projectId === 1 && blog.sprintId === 11).length;
  const expectedNoSprintCount = blogs.filter(blog => !blog.sprintId).length;
  const expectedPrivateCount = blogs.filter(blog => blog.isPrivate !== false).length;
  const expectedCreatorCount = blogs.filter(blog => blog.createdByUserId === 2).length;
  const expectedEditorCount = blogs.filter(blog => blog.updatedByUserId === 2).length;

  await dialog.locator(`[data-filter='${prefix}-search']`).fill("Document 088");
  await expect(rows).toHaveCount(1);
  await resetDiagramFilters(dialog, configuration, rows);

  await dialog.locator(`[data-filter='${prefix}-project']`).selectOption("1");
  await expect(rows).toHaveCount(expectedProjectCount);
  await dialog.locator(`[data-filter='${prefix}-sprint']`).selectOption("11");
  await expect(rows).toHaveCount(expectedSprintCount);
  await resetDiagramFilters(dialog, configuration, rows);

  await dialog.locator(`[data-filter='${prefix}-sprint']`).selectOption("none");
  await expect(rows).toHaveCount(expectedNoSprintCount);
  await resetDiagramFilters(dialog, configuration, rows);

  await dialog.locator(`[data-filter='${prefix}-visibility']`).selectOption("private");
  await expect(rows).toHaveCount(expectedPrivateCount);
  await resetDiagramFilters(dialog, configuration, rows);

  await dialog.locator(`[data-filter='${prefix}-tree-group']`).selectOption("project-sprint");
  await expect(page.locator(".documentation-tree-folder-row")).not.toHaveCount(0);
  await dialog.locator(`[data-filter='${prefix}-tree-layout']`).selectOption("flat");
  await expect(rows).toHaveCount(88);
  await expect(page.locator(`${configuration.rowSelector}[aria-expanded]`)).toHaveCount(0);
  await resetDiagramFilters(dialog, configuration, rows);

  await dialog.locator(`[data-filter='${prefix}-tree-layout']`).selectOption("flat");
  await dialog.locator(`[data-filter='${prefix}-sort']`).selectOption("name");
  await expect(rows.first()).toContainText("Document 001");
  await resetDiagramFilters(dialog, configuration, rows);

  await dialog.locator(`[data-filter='${prefix}-creator'][value='2']`).setChecked(true);
  await expect(rows).toHaveCount(expectedCreatorCount);
  await resetDiagramFilters(dialog, configuration, rows);

  await dialog.locator(`[data-filter='${prefix}-last-editor'][value='2']`).setChecked(true);
  await expect(rows).toHaveCount(expectedEditorCount);
  await resetDiagramFilters(dialog, configuration, rows);
}

async function resetDiagramFilters(dialog, configuration, rows) {
  await dialog.locator(configuration.resetSelector).click();
  await expect(rows).toHaveCount(88);
}

function treeNavState() {
  const diagramState = normalizeAnnotationState({
    width: 640,
    height: 360,
    objects: [{
      id: "tree-nav-box",
      type: "rectangle",
      x: 120,
      y: 90,
      width: 280,
      height: 140,
      fill: "#ffffff",
      stroke: "#175fbd",
      strokeWidth: 3
    }]
  });
  const source = `data:image/svg+xml;base64,${Buffer.from(
    buildAnnotationSvg(diagramState),
    "utf8"
  ).toString("base64")}`;
  const blogs = Array.from({ length: 88 }, (_, index) => {
    const chainIndex = Math.floor(index / 4);
    const depth = index % 4;
    const chainRootId = 1001 + (chainIndex * 4);
    const grouping = chainIndex % 3;
    const projectId = grouping === 0 ? null : grouping;
    const sprintId = grouping === 1 ? 11 : grouping === 2 ? 22 : null;
    const id = 1001 + index;
    return {
      id,
      title: `Nested Navigation Document ${String(index + 1).padStart(3, "0")} with a long title`,
      bodyHtml: `<p><img data-pmt-diagram="true" data-pmt-private-diagram="true" src="${source}" alt="TreeNav Diagram ${index + 1}"></p>`,
      projectId,
      sprintId,
      parentBlogId: depth === 0 ? null : chainRootId + depth - 1,
      isPrivate: index % 2 === 0,
      isPinned: false,
      sortOrder: 88 - index,
      createdByUserId: index % 2 === 0 ? 1 : 2,
      updatedByUserId: index % 2 === 0 ? 2 : 1,
      createdAt: new Date(Date.UTC(2026, 6, 1, 0, index, 0)).toISOString(),
      updatedAt: new Date(Date.UTC(2026, 6, 2, 0, index, 0)).toISOString(),
      attachments: [],
      history: []
    };
  });
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
    }, {
      id: 2,
      nickname: "Alex",
      email: "alex@example.test",
      role: "User",
      roleCode: "User",
      isAdmin: false,
      isActive: true,
      avatarUrl: ""
    }],
    projects: [{
      id: 1,
      code: "PMT",
      title: "Project One",
      name: "Project One",
      isActive: true
    }, {
      id: 2,
      code: "OPS",
      title: "Project Two",
      name: "Project Two",
      isActive: true
    }],
    sprints: [{
      id: 11,
      projectId: 1,
      code: "P1-S1",
      title: "Project One Sprint",
      isFinished: false
    }, {
      id: 22,
      projectId: 2,
      code: "P2-S1",
      title: "Project Two Sprint",
      isFinished: false
    }],
    tasks: [],
    devLogs: [],
    blogs,
    auditEvents: [],
    lookups: [],
    roles: [],
    holidays: [],
    securityResources: [],
    rolePermissions: [],
    userPermissions: [],
    effectivePermissions: []
  };
}

function jsonResponse(body, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body)
  };
}
