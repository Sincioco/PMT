import { expect, test } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  buildAnnotationSvg,
  normalizeAnnotationState,
  parseAnnotationSvg
} from "../../wwwroot/js/components/image-annotation.js";
import {
  createDiagram2FieldMappingTable
} from "../../wwwroot/js/features/diagram2/diagram2-editor-field-mapping-tables.js";
import {
  createDiagram2FieldMappingIndexes
} from "../../wwwroot/js/features/diagram2/diagram2-editor-field-mappings.js";
import {
  createDiagram2FieldRectangle,
  setDiagram2FieldRectangleMapping
} from "../../wwwroot/js/features/diagram2/diagram2-editor-field-rectangles.js";
import {
  createDiagram2EmbeddedImage
} from "../../wwwroot/js/features/diagram2/diagram2-editor-images.js";
import { releaseNotes } from "../../wwwroot/js/shared/release-notes-data.js";

test.use({ timezoneId: "Asia/Taipei" });

test("Diagram 2 Phase 6 top navigation supports images, crop, annotations, mapping, and save/reopen", async ({ page }, testInfo) => {
  const browserErrors = [];
  const pngBytes = await readFile(new URL("../../wwwroot/assets/pmt-logo-full.png", import.meta.url));
  let apiState = appState(601, "Diagram 2 Phase 6", phase6State());
  let uploadedSvg = "";
  let uploadedImageCount = 0;
  let savedPayload = null;

  page.on("console", message => {
    if (message.type() === "error" && !message.text().includes("status of 401")) {
      browserErrors.push(message.text());
      console.info("DIAGRAM2_PHASE6_BROWSER_CONSOLE", message.text());
    }
  });
  page.on("pageerror", error => {
    browserErrors.push(error.message);
    console.info("DIAGRAM2_PHASE6_BROWSER_PAGEERROR", error.stack || error.message);
  });
  await initializeBrowserState(page);
  await routeApplicationApis(page, () => apiState);
  await page.route("**/api/image-annotation/**", route =>
    route.fulfill(jsonResponse({ version: 1, templates: [], defaults: {} })));
  await page.route("**/api/uploads/richtext", route => {
    const svg = extractMultipartSvg(route.request().postDataBuffer());
    if (svg) {
      uploadedSvg = svg;
      return route.fulfill(jsonResponse({ url: "/uploads/diagram2-phase6-saved.svg" }));
    }
    uploadedImageCount += 1;
    return route.fulfill(jsonResponse({ url: `/uploads/diagram2-phase6-image-${uploadedImageCount}.png` }));
  });
  await page.route("**/uploads/diagram2-phase6-image-*.png", route => route.fulfill({
    status: 200,
    contentType: "image/png",
    body: pngBytes
  }));
  await page.route("**/uploads/diagram2-phase6-saved.svg", route => route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: uploadedSvg || buildAnnotationSvg(phase6State())
  }));
  await page.route("**/api/blogs/601", route => {
    savedPayload = route.request().postDataJSON();
    apiState = {
      ...apiState,
      blogs: apiState.blogs.map(blog => blog.id === 601
        ? {
            ...blog,
            ...savedPayload,
            rowVersion: "phase6-row-2",
            updatedAt: "2026-07-30T06:00:00Z"
          }
        : blog)
    };
    return route.fulfill(jsonResponse(apiState.blogs[0]));
  });

  await loginAndOpenDiagram2(page, 601);
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "readonly");
  const readOnlyRow = page.locator("[data-diagram2-field-mapping-row]").first();
  await expect(readOnlyRow).toBeVisible();
  const readOnlyFullRenders = await diagnosticNumber(page, "full-render-count");
  await readOnlyRow.hover();
  await expect(page.locator("[data-diagram2-field-mapping-hover]")).toBeVisible();
  expect(await diagnosticNumber(page, "full-render-count")).toBe(readOnlyFullRenders);
  await readOnlyRow.press(" ");
  await readOnlyRow.dblclick();
  await capturePhase6Screenshot(
    page,
    testInfo,
    "chromium-1920",
    "diagram2-phase6-readonly-mapping-highlight-1920x1080.png"
  );

  await page.getByRole("button", { name: "Edit Diagram" }).click();
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "edit");
  await expect(page.locator("[data-diagram2-editor-shell]")).toBeVisible();

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.locator("[data-action='add-diagram2-image']").click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: "phase6-upload.png",
    mimeType: "image/png",
    buffer: pngBytes
  });
  await expect.poll(() => page.evaluate(() =>
    window.__pmtDiagram2EditorCore.currentState().objects
      .filter(object => object.type === "embedded-image").length
  )).toBe(2);

  await page.locator("[data-diagram2-tool='crop']").click();
  await expect(page.locator("[data-diagram2-inspector-tab='crop']")).toBeVisible();
  await page.locator("[data-diagram2-inspector-tab='crop']").click();
  const cropLeft = page.locator("[data-diagram2-crop-inset='left']");
  await cropLeft.fill("24");
  await cropLeft.press("Tab");
  await expect.poll(() => page.evaluate(() => {
    const controller = window.__pmtDiagram2EditorCore;
    const selected = controller.getObjectById(controller.selectedObjectIds()[0]);
    return selected?.imageClip?.x - selected?.x;
  })).toBe(24);
  await expect(page.locator("[data-action='reset-diagram2-crop']")).toBeEnabled();

  const cropPreviewMetrics = await page.evaluate(async () => {
    const controller = window.__pmtDiagram2EditorCore;
    const renderer = window.__pmtDiagram2Renderer;
    const selected = controller.getObjectById(controller.selectedObjectIds()[0]);
    const before = renderer.diagnostics();
    const historyBefore = controller.historyStatus().undoCount;
    renderer.setCropTarget(selected.id);
    renderer.previewCrop(selected.id, {
      ...selected.imageClip,
      width: Math.max(8, selected.imageClip.width - 8)
    });
    renderer.previewCrop(selected.id, {
      ...selected.imageClip,
      width: Math.max(8, selected.imageClip.width - 16)
    });
    renderer.clearCropPreview({ keepTarget: true });
    await renderer.whenIdle();
    const after = renderer.diagnostics();
    return {
      fullRendersBefore: before.fullRenderCount,
      fullRendersAfter: after.fullRenderCount,
      cropFramesBefore: before.cropPreviewFrameCount,
      cropFramesAfter: after.cropPreviewFrameCount,
      historyBefore,
      historyAfter: controller.historyStatus().undoCount
    };
  });
  expect(cropPreviewMetrics.fullRendersAfter).toBe(cropPreviewMetrics.fullRendersBefore);
  expect(cropPreviewMetrics.cropFramesAfter).toBe(cropPreviewMetrics.cropFramesBefore + 2);
  expect(cropPreviewMetrics.historyAfter).toBe(cropPreviewMetrics.historyBefore);
  await capturePhase6Screenshot(
    page,
    testInfo,
    "chromium-1366",
    "diagram2-phase6-topnav-image-crop-1366x768.png"
  );

  await page.evaluate(() => {
    window.__pmtDiagram2EditorCore.setActiveTool("select");
    window.__pmtDiagram2EditorCore.setSelection(["entity-phase6"]);
  });
  await page.locator("[data-diagram2-inspector-tab='entity']").click();
  await page.locator("[data-action='edit-diagram2-entity-annotation']").click();
  await page.locator("[data-diagram2-entity-annotation-text]").fill(
    "Database Entity used by the screenshot field mapping."
  );
  await page.locator("[data-diagram2-entity-annotation-form]").getByRole("button", { name: "Apply" }).click();
  await expect.poll(() => page.evaluate(() =>
    window.__pmtDiagram2EditorCore.currentState().objects
      .filter(object => object.entityAnnotationOwnerId === "entity-phase6").length
  )).toBeGreaterThan(0);

  await page.evaluate(() => {
    window.__pmtDiagram2EditorCore.setSelection(["field-phase6"]);
  });
  await page.locator("[data-diagram2-inspector-tab='entity']").click();
  await expect(page.locator("[data-diagram2-field-rectangle-options]")).toBeVisible();
  await page.locator("[data-action='map-diagram2-field-rectangle']").click();
  await page.locator("[data-diagram2-field-mapping-field]").selectOption("Title");
  await page.locator("[data-diagram2-field-mapping-relationship]").selectOption("many-to-one");
  await page.locator("[data-diagram2-field-mapping-form]").getByRole("button", { name: "Save Mapping" }).click();
  await expect.poll(() => page.evaluate(() => {
    const controller = window.__pmtDiagram2EditorCore;
    const fieldRectangle = controller.getObjectById("field-phase6");
    const table = controller.currentState().objects.find(object => object.type === "field-mapping-table");
    return {
      name: fieldRectangle?.fields?.[0]?.name,
      databaseField: table?.rows?.find(row => row.uiEntityId === "field-phase6")?.databaseField
    };
  })).toEqual({
    name: "Title",
    databaseField: "pmt.Phase6Entity.Title"
  });
  await capturePhase6Screenshot(
    page,
    testInfo,
    "chromium-1920",
    "diagram2-phase6-topnav-field-rectangle-mapping-1920x1080.png"
  );

  const mappingRow = page.locator("[data-diagram2-field-mapping-row]").first();
  const mappingHoverMetrics = await page.evaluate(() => ({
    fullRenderCount: window.__pmtDiagram2Renderer.diagnostics().fullRenderCount,
    historyCount: window.__pmtDiagram2EditorCore.historyStatus().undoCount
  }));
  await mappingRow.hover();
  await expect(page.locator("[data-diagram2-field-mapping-hover]")).toBeVisible();
  const mappingHoverAfter = await page.evaluate(() => ({
    fullRenderCount: window.__pmtDiagram2Renderer.diagnostics().fullRenderCount,
    historyCount: window.__pmtDiagram2EditorCore.historyStatus().undoCount,
    hoverPatchCount: window.__pmtDiagram2Renderer.diagnostics().mappingHoverPatchCount
  }));
  expect(mappingHoverAfter.fullRenderCount).toBe(mappingHoverMetrics.fullRenderCount);
  expect(mappingHoverAfter.historyCount).toBe(mappingHoverMetrics.historyCount);
  expect(mappingHoverAfter.hoverPatchCount).toBeGreaterThan(0);
  await capturePhase6Screenshot(
    page,
    testInfo,
    "chromium-1920",
    "diagram2-phase6-field-mapping-table-hover-1920x1080.png"
  );

  const imageCacheMetrics = await page.evaluate(async () => {
    const controller = window.__pmtDiagram2EditorCore;
    const renderer = window.__pmtDiagram2Renderer;
    const table = controller.currentState().objects.find(object => object.type === "field-mapping-table");
    controller.setSelection([table.id], { expandGroups: false });
    const before = renderer.diagnostics();
    await controller.updateSelectedObjectsStyle("fieldMappingHighlightColor", "#16a34a");
    await renderer.whenIdle();
    const after = renderer.diagnostics();
    return {
      decodeBefore: before.decodeCount,
      decodeAfter: after.decodeCount,
      cacheBefore: before.cachedImageCount,
      cacheAfter: after.cachedImageCount,
      fullRenderBefore: before.fullRenderCount,
      fullRenderAfter: after.fullRenderCount
    };
  });
  expect(imageCacheMetrics.decodeAfter).toBe(imageCacheMetrics.decodeBefore);
  expect(imageCacheMetrics.cacheAfter).toBe(imageCacheMetrics.cacheBefore);
  expect(imageCacheMetrics.fullRenderAfter).toBe(imageCacheMetrics.fullRenderBefore);

  await page.locator("[data-action='save-diagram2-document']").click();
  await expect(page.locator("[data-diagram2-save-state]").first()).toHaveText("Saved");
  expect(savedPayload).not.toBeNull();
  expect(uploadedSvg).toContain('"entityKind":"field-rectangle"');
  expect(uploadedSvg).toContain('"type":"field-mapping-table"');
  expect(uploadedSvg).toContain('"entityAnnotationOwnerId":"entity-phase6"');
  const savedState = parseAnnotationSvg(uploadedSvg);
  expect(savedState.objects.some(object => object.type === "embedded-image")).toBe(true);
  expect(savedState.objects.some(object => object.entityKind === "field-rectangle")).toBe(true);
  expect(savedState.objects.some(object => object.type === "field-mapping-table")).toBe(true);

  await page.locator("[data-action='cancel-diagram2-editor']").click();
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "readonly");
  await expect(page.locator("[data-diagram2-field-mapping-row]")).toContainText("Title");
  await page.locator("[data-diagram2-field-mapping-row]").first().hover();
  await expect(page.locator("[data-diagram2-field-mapping-hover]")).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("Diagram 2 Phase 6 keeps a localized mapping editable in a 1,000-object Diagram", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-1920", "The large localized screenshot is required at 1920x1080.");
  const browserErrors = [];
  const largeState = largePhase6State(1000);
  const apiState = appState(602, "Diagram 2 Phase 6 Large", phase6State());

  page.on("console", message => {
    if (message.type() === "error" && !message.text().includes("status of 401")) {
      browserErrors.push(message.text());
      console.info("DIAGRAM2_PHASE6_LARGE_BROWSER_CONSOLE", message.text());
    }
  });
  page.on("pageerror", error => {
    browserErrors.push(error.message);
    console.info("DIAGRAM2_PHASE6_LARGE_BROWSER_PAGEERROR", error.stack || error.message);
  });
  await initializeBrowserState(page);
  await routeApplicationApis(page, () => apiState);
  await page.route("**/api/image-annotation/**", route =>
    route.fulfill(jsonResponse({ version: 1, templates: [], defaults: {} })));

  await loginAndOpenDiagram2(page, 602);
  await page.getByRole("button", { name: "Edit Diagram" }).click();
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "edit");
  await page.evaluate(state => {
    const controller = window.__pmtDiagram2EditorCore;
    const renderer = window.__pmtDiagram2Renderer;
    controller.setState(state, {
      resetHistory: true,
      saved: true,
      reason: "Phase 6 1,000-object fixture"
    });
    renderer.render(controller.currentState(), {
      reason: "Phase 6 1,000-object fixture"
    });
  }, largeState);
  await expect(page.locator("[data-diagram2-diagnostic='canonical-object-count']")).toHaveText("1000");
  await expect(page.locator("[data-diagram2-field-mapping-row]")).toBeVisible();

  const metrics = await page.evaluate(async () => {
    const controller = window.__pmtDiagram2EditorCore;
    const renderer = window.__pmtDiagram2Renderer;
    renderer.focusObjectIds(
      ["large-image", "large-field", "large-target", "large-table"],
      { scale: 0.9, reason: "Phase 6 localized mapping" }
    );
    await renderer.whenIdle();
    const before = renderer.diagnostics();
    await controller.setFieldRectangleMapping("large-field", {
      referencedEntity: "pmt.LargeTarget",
      referencedField: "Name",
      relationshipType: "many-to-one"
    });
    await renderer.whenIdle();
    renderer.panBy(12, 8);
    await renderer.whenIdle();
    const after = renderer.diagnostics();
    return {
      canonicalObjectCount: after.canonicalObjectCount,
      mountedObjectCount: after.mountedObjectCount,
      fullRenderBefore: before.fullRenderCount,
      fullRenderAfter: after.fullRenderCount,
      relationshipsRerouted: after.selectiveRoutingRelationshipsRerouted,
      mappingIndexLocalPatches: after.mappingIndexIncrementalPatchCount,
      mappingIndexLocalVisits: after.mappingIndexIncrementalObjectVisitCount,
      tableDatabaseField: controller.currentState().objects
        .find(object => object.id === "large-table")?.rows?.[0]?.databaseField
    };
  });

  expect(metrics.canonicalObjectCount).toBe(1000);
  expect(metrics.mountedObjectCount).toBeLessThanOrEqual(1000);
  expect(metrics.fullRenderAfter).toBe(metrics.fullRenderBefore);
  expect(metrics.relationshipsRerouted).toBeLessThanOrEqual(1);
  expect(metrics.mappingIndexLocalPatches).toBeGreaterThan(0);
  expect(metrics.mappingIndexLocalVisits).toBe(0);
  expect(metrics.tableDatabaseField).toBe("pmt.LargeTarget.Name");
  await page.locator("[data-diagram2-field-mapping-row]").hover();
  await expect(page.locator("[data-diagram2-field-mapping-hover]")).toBeVisible();
  await capturePhase6Screenshot(
    page,
    testInfo,
    "chromium-1920",
    "diagram2-phase6-large-localized-mapping-1920x1080.png"
  );
  expect(browserErrors).toEqual([]);
});

async function initializeBrowserState(page) {
  await page.addInitScript(seenToken => {
    localStorage.clear();
    localStorage.setItem("pmt-release-notes-last-seen:1", seenToken);
    localStorage.setItem("pmt-release-notes-last-seen:2", seenToken);
    localStorage.setItem("pmt-diagram2-diagnostics-visible", "true");
  }, releaseNotes[0].seenToken);
}

async function routeApplicationApis(page, stateProvider) {
  await page.route("**/api/session", route =>
    route.fulfill(jsonResponse({ error: "Unauthorized" }, 401)));
  await page.route("**/api/login", route => route.fulfill(jsonResponse({
    userId: 1,
    nickname: "Sin",
    isAdmin: true,
    role: "Admin"
  })));
  await page.route("**/api/state", route => route.fulfill(jsonResponse(stateProvider())));
  await page.route("**/api/audit-trail", route => route.fulfill(jsonResponse([])));
  await page.route("**/api/maintenance/recycle-bin", route => route.fulfill(jsonResponse([])));
  await page.route("**/api/maintenance/orphan-files", route => route.fulfill(jsonResponse({
    files: [],
    totalCount: 0,
    totalByteLength: 0
  })));
}

async function loginAndOpenDiagram2(page, documentId) {
  await page.goto("/");
  await page.locator("#loginName").fill("Sin");
  await page.locator("#loginPassword").fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  await page.evaluate(id => {
    window.location.hash = `#/diagram-2/${id}`;
  }, documentId);
  await expect(page.locator("[data-diagram2-screen]")).toBeVisible();
  await expect(page.locator("[data-diagram2-svg]")).toBeVisible();
}

async function diagnosticNumber(page, key) {
  const text = await page.locator(`[data-diagram2-diagnostic='${key}']`).textContent();
  return Number(text || 0);
}

async function capturePhase6Screenshot(page, testInfo, projectName, fileName) {
  if (testInfo.project.name !== projectName) return;
  const directory = path.join(process.cwd(), "docs", "screenshots", "diagram-2-phase-6");
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: path.join(directory, fileName),
    fullPage: false
  });
}

function phase6State() {
  const image = createDiagram2EmbeddedImage({
    id: "image-phase6",
    name: "Phase 6 Task Screen",
    source: mockScreenshotDataUrl(),
    x: 60,
    y: 100,
    width: 660,
    height: 420
  });
  const target = phase6TargetEntity();
  const fieldRectangle = setDiagram2FieldRectangleMapping(createDiagram2FieldRectangle({
    id: "field-phase6",
    name: "TaskId",
    x: 250,
    y: 255,
    width: 190,
    height: 62
  }), {
    referencedEntity: "pmt.Phase6Entity",
    referencedField: "TaskId",
    relationshipType: "many-to-one"
  });
  const objects = [image, target, fieldRectangle];
  const indexes = createDiagram2FieldMappingIndexes(objects);
  const table = createDiagram2FieldMappingTable({
    width: 1600,
    height: 900,
    objects
  }, image.id, {
    id: "table-phase6",
    x: 940,
    y: 500,
    indexes,
    style: {
      headerFill: "#dbeafe",
      uiFill: "#f8fafc",
      databaseFill: "#ffffff",
      fieldMappingRowHoverFill: "#fef08a",
      fieldMappingHighlightColor: "#e11d48",
      fieldMappingHighlightStrokeWidth: 8
    }
  });
  return normalizeAnnotationState({
    version: 1,
    width: 1600,
    height: 900,
    objects: [...objects, table]
  });
}

function phase6TargetEntity() {
  return {
    id: "entity-phase6",
    type: "entity",
    x: 980,
    y: 130,
    width: 300,
    height: 190,
    entitySchema: "pmt",
    entityName: "Phase6Entity",
    fields: [
      {
        name: "TaskId",
        dataType: "INT",
        nullable: false,
        isPrimaryKey: true,
        isImportant: true
      },
      {
        name: "Title",
        dataType: "NVARCHAR(200)",
        nullable: false,
        isImportant: true
      }
    ],
    foreignKeys: [],
    fill: "#ffffff",
    stroke: "#334155",
    entityHeaderFill: "#dcfce7",
    entityNameTextColor: "#14532d",
    showKeyColumn: true,
    showDataTypes: true
  };
}

function largePhase6State(objectCount) {
  const image = createDiagram2EmbeddedImage({
    id: "large-image",
    name: "Large Diagram Local Region",
    source: mockScreenshotDataUrl(),
    x: 80,
    y: 100,
    width: 660,
    height: 420
  });
  const target = {
    ...phase6TargetEntity(),
    id: "large-target",
    entityName: "LargeTarget",
    x: 980,
    y: 130,
    fields: phase6TargetEntity().fields.map((field, index) =>
      index === 1 ? { ...field, name: "Name" } : field)
  };
  const fieldRectangle = setDiagram2FieldRectangleMapping(createDiagram2FieldRectangle({
    id: "large-field",
    name: "TargetId",
    x: 250,
    y: 255,
    width: 190,
    height: 62
  }), {
    referencedEntity: "pmt.LargeTarget",
    referencedField: "TaskId",
    relationshipType: "many-to-one"
  });
  const fillerCount = Math.max(0, objectCount - 4);
  const fillers = Array.from({ length: fillerCount }, (_, index) => ({
    id: `large-entity-${index}`,
    type: "entity",
    x: 2200 + ((index % 32) * 260),
    y: 80 + (Math.floor(index / 32) * 135),
    width: 220,
    height: 96,
    entitySchema: "pmt",
    entityName: `LargeEntity${index}`,
    fields: [{ name: "Id", dataType: "INT", isPrimaryKey: true }],
    foreignKeys: [],
    fill: "#ffffff",
    stroke: "#94a3b8",
    entityHeaderFill: index % 2 ? "#e0f2fe" : "#dcfce7"
  }));
  const objects = [image, target, fieldRectangle, ...fillers];
  const indexes = createDiagram2FieldMappingIndexes(objects);
  const table = createDiagram2FieldMappingTable({
    width: 12000,
    height: 6000,
    objects
  }, image.id, {
    id: "large-table",
    x: 940,
    y: 500,
    indexes
  });
  return normalizeAnnotationState({
    version: 1,
    width: 12000,
    height: 6000,
    objects: [...objects, table]
  });
}

function appState(documentId, title, diagramState) {
  const svg = buildAnnotationSvg(diagramState);
  const source = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
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
    }],
    projects: [{
      id: 1,
      code: "PMT",
      title: "Diagram 2 Phase 6",
      name: "Diagram 2 Phase 6",
      isActive: true
    }],
    sprints: [],
    tasks: [],
    devLogs: [],
    blogs: [{
      id: documentId,
      title,
      isPrivate: false,
      createdByUserId: 1,
      updatedByUserId: 1,
      projectId: 1,
      sprintId: null,
      createdAt: "2026-07-30T05:00:00Z",
      updatedAt: "2026-07-30T05:00:00Z",
      rowVersion: "phase6-row-1",
      bodyHtml: `<p><img data-pmt-diagram="true" data-pmt-private-diagram="true" src="${source}" alt="${title}"></p>`
    }],
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

function mockScreenshotDataUrl() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="660" height="420" viewBox="0 0 660 420">
      <rect width="660" height="420" fill="#f8fafc"/>
      <rect width="660" height="58" fill="#172b4d"/>
      <rect x="20" y="18" width="120" height="22" rx="3" fill="#ffffff"/>
      <rect y="58" width="132" height="362" fill="#e2e8f0"/>
      <rect x="20" y="88" width="92" height="16" rx="2" fill="#64748b"/>
      <rect x="20" y="124" width="74" height="12" rx="2" fill="#94a3b8"/>
      <rect x="20" y="154" width="86" height="12" rx="2" fill="#94a3b8"/>
      <rect x="164" y="92" width="456" height="52" rx="4" fill="#ffffff" stroke="#cbd5e1"/>
      <rect x="184" y="109" width="210" height="18" rx="2" fill="#0f766e"/>
      <rect x="164" y="168" width="456" height="206" rx="4" fill="#ffffff" stroke="#cbd5e1"/>
      <rect x="184" y="192" width="132" height="16" rx="2" fill="#334155"/>
      <rect x="184" y="228" width="400" height="34" rx="3" fill="#e0f2fe"/>
      <rect x="184" y="278" width="400" height="34" rx="3" fill="#dcfce7"/>
      <rect x="184" y="328" width="260" height="18" rx="2" fill="#cbd5e1"/>
    </svg>
  `.trim();
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

function extractMultipartSvg(buffer) {
  const text = (buffer || Buffer.alloc(0)).toString("utf8");
  const start = text.indexOf("<svg");
  const end = text.lastIndexOf("</svg>");
  return start >= 0 && end >= start ? text.slice(start, end + "</svg>".length) : "";
}

function jsonResponse(data, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(data)
  };
}
