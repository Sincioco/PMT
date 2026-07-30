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
  const pngBase64 = pngBytes.toString("base64");
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

  const droppedImage = await assertDiagram2ImageDrop(page, pngBase64);
  expect(uploadedImageCount).toBe(1);

  await page.locator("[data-diagram2-tool='crop']").click();
  await createDiagram2ReversibleCropCommand(page, droppedImage.id);
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
    const historyBefore = controller.historyStatus().entryCount;
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
      historyAfter: controller.historyStatus().entryCount
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

  const permanentCrop = await assertDiagram2PermanentCrop(page, droppedImage);
  const pastedImage = await assertDiagram2ClipboardImagePaste(page, pngBase64);
  expect(uploadedImageCount).toBe(2);

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
    historyCount: window.__pmtDiagram2EditorCore.historyStatus().entryCount
  }));
  await mappingRow.hover();
  await expect(page.locator("[data-diagram2-field-mapping-hover]")).toBeVisible();
  const mappingHoverAfter = await page.evaluate(() => ({
    fullRenderCount: window.__pmtDiagram2Renderer.diagnostics().fullRenderCount,
    historyCount: window.__pmtDiagram2EditorCore.historyStatus().entryCount,
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
  expect(savedState.objects.find(object => object.id === permanentCrop.id)).toMatchObject({
    source: permanentCrop.source,
    x: permanentCrop.x,
    y: permanentCrop.y,
    width: permanentCrop.width,
    height: permanentCrop.height,
    imageClip: permanentCrop.imageClip,
    cropPermanent: true
  });
  expect(savedState.objects.find(object => object.id === pastedImage.id)).toMatchObject({
    name: "Clipboard phase6.png",
    source: "/uploads/diagram2-phase6-image-2.png"
  });

  await page.locator("[data-action='cancel-diagram2-editor']").click();
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "readonly");
  await expect(page.locator("[data-diagram2-field-mapping-row]")).toContainText("Title");
  await page.locator("[data-diagram2-field-mapping-row]").first().hover();
  await expect(page.locator("[data-diagram2-field-mapping-hover]")).toBeVisible();
  await page.getByRole("button", { name: "Edit Diagram" }).click();
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "edit");
  await expect.poll(() => page.evaluate(({ permanentId, pastedId }) => {
    const objects = window.__pmtDiagram2EditorCore?.currentState?.().objects || [];
    const permanent = objects.find(object => object.id === permanentId);
    const pasted = objects.find(object => object.id === pastedId);
    return {
      permanentSource: permanent?.source || "",
      permanentClip: permanent?.imageClip || null,
      permanentCrop: permanent?.cropPermanent === true,
      pastedSource: pasted?.source || ""
    };
  }, { permanentId: permanentCrop.id, pastedId: pastedImage.id })).toEqual({
    permanentSource: permanentCrop.source,
    permanentClip: permanentCrop.imageClip,
    permanentCrop: true,
    pastedSource: "/uploads/diagram2-phase6-image-2.png"
  });
  await page.locator("[data-action='cancel-diagram2-editor']").click();
  expect(browserErrors).toEqual([]);
});

test("Diagram 2 Crop Radius debounces focused input without requiring Tab", async ({ page }, testInfo) => {
  const state = phase6State();
  const apiState = appState(603, "Diagram 2 Crop Debounce", state);

  await initializeBrowserState(page);
  await routeApplicationApis(page, () => apiState);
  await page.route("**/api/image-annotation/**", route =>
    route.fulfill(jsonResponse({ version: 1, templates: [], defaults: {} })));

  await loginAndOpenDiagram2(page, 603);
  await page.getByRole("button", { name: "Edit Diagram" }).click();
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "edit");
  await expect(page.locator("[data-diagram2-editor-shell]")).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(window.__pmtDiagram2EditorCore))).toBe(true);
  await page.evaluate(() => {
    window.__pmtDiagram2EditorCore.setSelection(["image-phase6"]);
  });
  await page.locator("[data-diagram2-tool='crop']").click();
  await createDiagram2ReversibleCrop(page, "image-phase6");
  await page.locator("[data-diagram2-tool='crop']").click();
  await page.locator("[data-diagram2-inspector-tab='crop']").click();

  const radius = page.locator("[data-diagram2-crop-corner-radius]");
  const selection = page.locator("[data-diagram2-selection-id='image-phase6']");
  const cropOverlay = page.locator("[data-diagram2-crop-overlay]");
  await expect(radius).toBeVisible();
  await expect(selection).toBeVisible();
  await expect(cropOverlay).toBeHidden();
  await radius.focus();

  const before = await page.evaluate(() => ({
    historyEntryCount: window.__pmtDiagram2EditorCore.historyStatus().entryCount,
    fullRenderCount: window.__pmtDiagram2Renderer.diagnostics().fullRenderCount,
    decodeCount: window.__pmtDiagram2Renderer.diagnostics().decodeCount,
    renderer: window.__pmtDiagram2Renderer.diagnostics(),
    scheduler: window.__pmtDiagram2Phase6Host.cropAdjustmentDiagnostics()
  }));
  await radius.evaluate(control => {
    for (let value = 1; value <= 20; value += 1) {
      control.stepUp();
      control.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });

  await expect(radius).toHaveValue("20");
  await expect(selection).toBeHidden();
  await expect(cropOverlay).toBeVisible();
  await page.waitForTimeout(350);
  const pending = await page.evaluate(() => {
    const controller = window.__pmtDiagram2EditorCore;
    const image = controller.getObjectById("image-phase6");
    return {
      radius: image.cropCornerRadius || 0,
      historyEntryCount: controller.historyStatus().entryCount
    };
  });
  expect(pending.radius).toBe(0);
  expect(pending.historyEntryCount).toBe(before.historyEntryCount);

  await expect.poll(() => page.evaluate(() =>
    window.__pmtDiagram2EditorCore.getObjectById("image-phase6")?.cropCornerRadius || 0
  )).toBe(20);
  const committed = await page.evaluate(() => ({
    historyEntryCount: window.__pmtDiagram2EditorCore.historyStatus().entryCount,
    fullRenderCount: window.__pmtDiagram2Renderer.diagnostics().fullRenderCount,
    decodeCount: window.__pmtDiagram2Renderer.diagnostics().decodeCount,
    renderer: window.__pmtDiagram2Renderer.diagnostics(),
    scheduler: window.__pmtDiagram2Phase6Host.cropAdjustmentDiagnostics()
  }));
  expect(committed.historyEntryCount).toBe(before.historyEntryCount + 1);
  expect(committed.fullRenderCount).toBe(before.fullRenderCount);
  expect(committed.decodeCount).toBe(before.decodeCount);
  expect(committed.scheduler.inputEventCount - before.scheduler.inputEventCount).toBe(20);
  expect(committed.scheduler.debounceFiringCount - before.scheduler.debounceFiringCount).toBe(1);
  expect(committed.scheduler.commitCount - before.scheduler.commitCount).toBe(1);
  expect(committed.renderer.cropOptionImagePatchCount - before.renderer.cropOptionImagePatchCount).toBe(1);
  expect(committed.renderer.cropOptionOverlayPatchCount - before.renderer.cropOptionOverlayPatchCount).toBe(1);
  expect(committed.renderer.objectsPatchedInLastFlush).toBe(1);
  expect(committed.renderer.relationshipsRoutedInLastFlush).toBe(0);
  expect(committed.renderer.selectiveRoutingRelationshipsRerouted).toBe(0);
  await expect(radius).toBeFocused();
  await expect(selection).toBeHidden();
  await expect(cropOverlay).toBeVisible();
  if (testInfo.project.name === "chromium-1920") {
    await capturePhase6ClosureScreenshot(
      page,
      "crop/crop-d2-radius-selection-hidden-1920x1080.png"
    );
  }
  await expect(selection).toBeVisible({ timeout: 3500 });
  const settled = await page.evaluate(() => ({
    renderer: window.__pmtDiagram2Renderer.diagnostics(),
    scheduler: window.__pmtDiagram2Phase6Host.cropAdjustmentDiagnostics()
  }));
  expect(settled.scheduler.timerCleanupCount - before.scheduler.timerCleanupCount).toBe(2);
  expect(settled.scheduler.pendingTimerCount).toBe(0);
  expect(settled.renderer.selectionChromeSuppressedIds).toEqual([]);
  console.info("DIAGRAM2_CROP_DEBOUNCE_METRICS", JSON.stringify({
    inputEvents: committed.scheduler.inputEventCount - before.scheduler.inputEventCount,
    debounceFirings: committed.scheduler.debounceFiringCount - before.scheduler.debounceFiringCount,
    historyCommands: committed.historyEntryCount - before.historyEntryCount,
    imagePatches: committed.renderer.cropOptionImagePatchCount - before.renderer.cropOptionImagePatchCount,
    cropOverlayPatches: committed.renderer.cropOptionOverlayPatchCount - before.renderer.cropOptionOverlayPatchCount,
    unrelatedObjectPatches: Math.max(0, committed.renderer.objectsPatchedInLastFlush - 1),
    relationshipReroutes: committed.renderer.relationshipsRoutedInLastFlush,
    fullRenders: committed.fullRenderCount - before.fullRenderCount,
    repeatedDecodes: committed.decodeCount - before.decodeCount,
    timerCleanups: settled.scheduler.timerCleanupCount - before.scheduler.timerCleanupCount,
    pendingTimers: settled.scheduler.pendingTimerCount
  }));
});

test("Diagram 2 Crop numeric controls flush, cancel, normalize, and Undo as one burst", async ({ page }) => {
  const state = phase6State();
  const image = state.objects.find(object => object.id === "image-phase6");
  image.imageClip = {
    x: image.x + 20,
    y: image.y + 16,
    width: image.width - 44,
    height: image.height - 36
  };
  const apiState = appState(604, "Diagram 2 Crop Transitions", state);

  await initializeBrowserState(page);
  await routeApplicationApis(page, () => apiState);
  await page.route("**/api/image-annotation/**", route =>
    route.fulfill(jsonResponse({ version: 1, templates: [], defaults: {} })));

  await loginAndOpenDiagram2(page, 604);
  await page.getByRole("button", { name: "Edit Diagram" }).click();
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "edit");
  await expect.poll(() => page.evaluate(() => Boolean(window.__pmtDiagram2EditorCore))).toBe(true);
  await page.evaluate(() => window.__pmtDiagram2EditorCore.setSelection(["image-phase6"]));
  await page.locator("[data-diagram2-inspector-tab='crop']").click();

  const radius = page.locator("[data-diagram2-crop-corner-radius]");
  const topLeft = page.locator("[data-diagram2-crop-corner='topLeft']");
  const leftInset = page.locator("[data-diagram2-crop-inset='left']");
  const selection = page.locator("[data-diagram2-selection-id='image-phase6']");
  const initial = await page.evaluate(() => ({
    history: window.__pmtDiagram2EditorCore.historyStatus().entryCount,
    fullRenders: window.__pmtDiagram2Renderer.diagnostics().fullRenderCount,
    decodes: window.__pmtDiagram2Renderer.diagnostics().decodeCount
  }));

  await radius.fill("30");
  await radius.press("Tab");
  await expect.poll(() => page.evaluate(() =>
    window.__pmtDiagram2EditorCore.getObjectById("image-phase6")?.cropCornerRadius
  )).toBe(30);
  await page.waitForTimeout(600);
  expect(await page.evaluate(() =>
    window.__pmtDiagram2EditorCore.historyStatus().entryCount
  )).toBe(initial.history + 1);

  await page.evaluate(async () => {
    await window.__pmtDiagram2EditorCore.undo();
    await window.__pmtDiagram2Renderer.whenIdle();
  });
  await expect(radius).toHaveValue("0");
  await page.evaluate(async () => {
    await window.__pmtDiagram2EditorCore.redo();
    await window.__pmtDiagram2Renderer.whenIdle();
  });
  await expect(radius).toHaveValue("30");

  const beforeCancelHistory = await page.evaluate(() =>
    window.__pmtDiagram2EditorCore.historyStatus().entryCount
  );
  await radius.fill("45");
  await expect(selection).toBeHidden();
  await radius.press("Escape");
  await expect(radius).toHaveValue("30");
  await expect(selection).toBeVisible();
  expect(await page.evaluate(() => ({
    radius: window.__pmtDiagram2EditorCore.getObjectById("image-phase6")?.cropCornerRadius,
    history: window.__pmtDiagram2EditorCore.historyStatus().entryCount,
    pendingTimers: window.__pmtDiagram2Phase6Host.cropAdjustmentDiagnostics().pendingTimerCount
  }))).toEqual({
    radius: 30,
    history: beforeCancelHistory,
    pendingTimers: 0
  });

  await leftInset.fill("28");
  await expect.poll(() => page.evaluate(() => {
    const current = window.__pmtDiagram2EditorCore.getObjectById("image-phase6");
    return current?.imageClip?.x - current?.x;
  })).toBe(28);
  await expect(selection).toBeHidden();
  await expect(page.locator("[data-diagram2-crop-overlay]")).toBeVisible();

  await topLeft.fill("12");
  await expect.poll(() => page.evaluate(() => {
    const current = window.__pmtDiagram2EditorCore.getObjectById("image-phase6");
    return {
      uniform: current?.cropCornerRadius,
      corners: current?.cropCornerRadii
    };
  })).toEqual({
    uniform: 30,
    corners: {
      topLeft: 12,
      topRight: 30,
      bottomRight: 30,
      bottomLeft: 30
    }
  });

  await topLeft.fill("30");
  await expect.poll(() => page.evaluate(() => {
    const current = window.__pmtDiagram2EditorCore.getObjectById("image-phase6");
    return {
      uniform: current?.cropCornerRadius,
      hasCorners: current?.cropCornerRadii != null
    };
  })).toEqual({
    uniform: 30,
    hasCorners: false
  });

  await radius.fill("34");
  await page.locator("[data-diagram2-inspector-tab='format']").click();
  await expect.poll(() => page.evaluate(() =>
    window.__pmtDiagram2EditorCore.getObjectById("image-phase6")?.cropCornerRadius
  )).toBe(34);
  await page.locator("[data-diagram2-inspector-tab='crop']").click();

  await radius.fill("35");
  await page.locator("[data-diagram2-tool='select']").click();
  await expect.poll(() => page.evaluate(() =>
    window.__pmtDiagram2EditorCore.getObjectById("image-phase6")?.cropCornerRadius
  )).toBe(35);
  await expect(selection).toBeVisible();
  await expect(page.locator("[data-diagram2-crop-overlay]")).toBeHidden();
  await page.locator("[data-diagram2-inspector-tab='crop']").click();

  await radius.fill("36");
  await page.evaluate(() => window.__pmtDiagram2EditorCore.setSelection(["entity-phase6"]));
  await expect.poll(() => page.evaluate(() => ({
    radius: window.__pmtDiagram2EditorCore.getObjectById("image-phase6")?.cropCornerRadius,
    selected: window.__pmtDiagram2EditorCore.selectedObjectIds()
  }))).toEqual({
    radius: 36,
    selected: ["entity-phase6"]
  });
  await expect(page.locator("[data-diagram2-crop-overlay]")).toBeHidden();
  await page.evaluate(() => window.__pmtDiagram2EditorCore.setSelection(["image-phase6"]));

  const finalMetrics = await page.evaluate(() => ({
    fullRenders: window.__pmtDiagram2Renderer.diagnostics().fullRenderCount,
    decodes: window.__pmtDiagram2Renderer.diagnostics().decodeCount,
    pendingTimers: window.__pmtDiagram2Phase6Host.cropAdjustmentDiagnostics().pendingTimerCount
  }));
  expect(finalMetrics.fullRenders).toBe(initial.fullRenders);
  expect(finalMetrics.decodes).toBe(initial.decodes);
  expect(finalMetrics.pendingTimers).toBe(0);
});

test("Diagram 2 matches the shared Diagram 1 Crop fixture and saves it", async ({ page }, testInfo) => {
  let apiState = appState(605, "Diagram 2 Crop Parity", cropParityState());
  let uploadedSvg = "";
  let savedPayload = null;

  await initializeBrowserState(page);
  await routeApplicationApis(page, () => apiState);
  await page.route("**/api/image-annotation/**", route =>
    route.fulfill(jsonResponse({ version: 1, templates: [], defaults: {} })));
  await page.route("**/api/uploads/richtext", route => {
    uploadedSvg = extractMultipartSvg(route.request().postDataBuffer());
    return route.fulfill(jsonResponse({ url: "/uploads/diagram2-crop-parity-saved.svg" }));
  });
  await page.route("**/uploads/diagram2-crop-parity-saved.svg", route => route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: uploadedSvg || buildAnnotationSvg(cropParityState())
  }));
  await page.route("**/api/blogs/605", route => {
    savedPayload = route.request().postDataJSON();
    apiState = {
      ...apiState,
      blogs: apiState.blogs.map(blog => blog.id === 605
        ? { ...blog, ...savedPayload, rowVersion: "crop-parity-row-2" }
        : blog)
    };
    return route.fulfill(jsonResponse(apiState.blogs[0]));
  });

  await loginAndOpenDiagram2(page, 605);
  await page.getByRole("button", { name: "Edit Diagram" }).click();
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "edit");
  await expect.poll(() => page.evaluate(() => Boolean(window.__pmtDiagram2EditorCore))).toBe(true);
  await page.locator("[data-diagram2-editor-shell] [data-filter='diagram2-zoom']").selectOption("0.9");
  await expect.poll(() => page.evaluate(() =>
    window.__pmtDiagram2Renderer?.viewportMatrix?.().scale
  )).toBe(0.9);
  await page.evaluate(() => window.__pmtDiagram2EditorCore.setSelection(["crop-parity-image"]));
  const selection = page.locator("[data-diagram2-selection-id='crop-parity-image']");
  const overlay = page.locator("[data-diagram2-crop-overlay]");
  await page.locator("[data-diagram2-tool='crop']").click();
  await expect(selection).toBeHidden();
  await expect(overlay).toBeVisible();
  if (testInfo.project.name === "chromium-1366") {
    await capturePhase6ClosureScreenshot(page, "crop/crop-d2-entry-1366x768.png");
  }

  await page.evaluate(async () => {
    const controller = window.__pmtDiagram2EditorCore;
    const renderer = window.__pmtDiagram2Renderer;
    await controller.updateEmbeddedImageCrop("crop-parity-image", {
      imageClip: { x: 68, y: 108, width: 644, height: 404 },
      cropVisible: true
    }, {
      label: "Crop image",
      reason: "Crop parity fixture"
    });
    renderer.setCropTarget("crop-parity-image");
    await renderer.whenIdle();
  });
  await page.locator("[data-diagram2-inspector-tab='crop']").click();
  const before = await page.evaluate(() => ({
    history: window.__pmtDiagram2EditorCore.historyStatus().entryCount,
    fullRenders: window.__pmtDiagram2Renderer.diagnostics().fullRenderCount,
    decodes: window.__pmtDiagram2Renderer.diagnostics().decodeCount
  }));
  await page.evaluate(values => {
    for (const [edge, value] of Object.entries(values)) {
      const control = document.querySelector(`[data-diagram2-crop-inset='${edge}']`);
      control.value = String(value);
      control.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, {
    left: 18,
    right: 24,
    top: 12,
    bottom: 18
  });
  await expect.poll(() => page.evaluate(() => {
    const image = window.__pmtDiagram2EditorCore.getObjectById("crop-parity-image");
    return image.imageClip;
  })).toEqual({
    x: 78,
    y: 112,
    width: 618,
    height: 390
  });
  if (testInfo.project.name === "chromium-1920") {
    await capturePhase6ClosureScreenshot(page, "crop/crop-d2-insets-1920x1080.png");
  }

  const radius = page.locator("[data-diagram2-crop-corner-radius]");
  await radius.fill("28");
  await expect.poll(() => page.evaluate(() =>
    window.__pmtDiagram2EditorCore.getObjectById("crop-parity-image")?.cropCornerRadius
  )).toBe(28);
  await expect(radius).toBeFocused();
  await expect(selection).toBeHidden();
  await expect(overlay).toBeVisible();
  if (testInfo.project.name === "chromium-1920") {
    await capturePhase6ClosureScreenshot(page, "crop/crop-d2-radius-selection-hidden-1920x1080.png");
  }

  await page.locator("[data-diagram2-crop-corner='topLeft']").fill("12");
  await expect.poll(() => page.evaluate(() => {
    const image = window.__pmtDiagram2EditorCore.getObjectById("crop-parity-image");
    return {
      radius: image.cropCornerRadius,
      corners: image.cropCornerRadii
    };
  })).toEqual({
    radius: 28,
    corners: {
      topLeft: 12,
      topRight: 28,
      bottomRight: 28,
      bottomLeft: 28
    }
  });
  if (testInfo.project.name === "chromium-1920") {
    await capturePhase6ClosureScreenshot(page, "crop/crop-d2-independent-corners-1920x1080.png");
  }

  const adjusted = await page.evaluate(() => ({
    history: window.__pmtDiagram2EditorCore.historyStatus().entryCount,
    fullRenders: window.__pmtDiagram2Renderer.diagnostics().fullRenderCount,
    decodes: window.__pmtDiagram2Renderer.diagnostics().decodeCount
  }));
  expect(adjusted.history).toBe(before.history + 3);
  expect(adjusted.fullRenders).toBe(before.fullRenders);
  expect(adjusted.decodes).toBe(before.decodes);

  await page.evaluate(async () => {
    await window.__pmtDiagram2EditorCore.undo();
    await window.__pmtDiagram2Renderer.whenIdle();
  });
  await expect(radius).toHaveValue("28");
  await page.evaluate(async () => {
    await window.__pmtDiagram2EditorCore.redo();
    await window.__pmtDiagram2Renderer.whenIdle();
  });
  await expect(page.locator("[data-diagram2-crop-corner='topLeft']")).toHaveValue("12");

  await page.locator("[data-action='reset-diagram2-crop']").click();
  await expect.poll(() => page.evaluate(() =>
    window.__pmtDiagram2EditorCore.getObjectById("crop-parity-image")?.imageClip
  )).toEqual({ x: 60, y: 100, width: 660, height: 420 });
  await page.evaluate(async () => {
    await window.__pmtDiagram2EditorCore.undo();
    await window.__pmtDiagram2Renderer.whenIdle();
  });
  await page.locator("[data-diagram2-inspector-tab='crop']").click();
  await expect(page.locator("[data-diagram2-crop-corner='topLeft']")).toHaveValue("12");

  const cropVisible = page.locator("[data-diagram2-crop-visible]");
  await cropVisible.uncheck();
  await expect.poll(() => page.evaluate(() =>
    window.__pmtDiagram2EditorCore.getObjectById("crop-parity-image")?.cropVisible
  )).toBe(false);
  await page.locator("[data-action='permanently-crop-diagram2-image']").click();
  await page.getByRole("button", { name: "Cancel", exact: true }).last().click();
  expect(await page.evaluate(() => {
    const image = window.__pmtDiagram2EditorCore.getObjectById("crop-parity-image");
    return {
      visible: image.cropVisible,
      source: image.source,
      clip: image.imageClip
    };
  })).toEqual({
    visible: false,
    source: mockScreenshotDataUrl(),
    clip: { x: 78, y: 112, width: 618, height: 390 }
  });
  await cropVisible.check();

  await page.locator("[data-action='save-diagram2-document']").click();
  await expect(page.locator("[data-diagram2-save-state]").first()).toHaveText("Saved");
  expect(savedPayload).not.toBeNull();
  const savedState = parseAnnotationSvg(uploadedSvg);
  const savedImage = savedState.objects.find(object => object.id === "crop-parity-image");
  expect(savedImage.imageClip).toEqual({ x: 78, y: 112, width: 618, height: 390 });
  expect(savedImage.cropCornerRadii).toEqual({
    topLeft: 12,
    topRight: 28,
    bottomRight: 28,
    bottomLeft: 28
  });

  await page.locator("[data-action='cancel-diagram2-editor']").click();
  await page.getByRole("button", { name: "Edit Diagram" }).click();
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "edit");
  await expect.poll(() => page.evaluate(() => Boolean(window.__pmtDiagram2EditorCore))).toBe(true);
  await page.evaluate(() => window.__pmtDiagram2EditorCore.setSelection(["crop-parity-image"]));
  const reopened = await page.evaluate(() => {
    const image = window.__pmtDiagram2EditorCore.getObjectById("crop-parity-image");
    return {
      clip: image.imageClip,
      corners: image.cropCornerRadii
    };
  });
  expect(reopened).toEqual({
    clip: { x: 78, y: 112, width: 618, height: 390 },
    corners: {
      topLeft: 12,
      topRight: 28,
      bottomRight: 28,
      bottomLeft: 28
    }
  });
  await page.locator("[data-diagram2-tool='crop']").click();
  await page.getByRole("button", { name: "Cancel", exact: true }).last().click();
  await page.locator("[data-diagram2-tool='crop']").click();
  await page.getByRole("button", { name: "Remove Crop", exact: true }).click();
  await expect.poll(() => page.evaluate(() =>
    window.__pmtDiagram2EditorCore.getObjectById("crop-parity-image")?.imageClip
  )).toEqual({ x: 60, y: 100, width: 660, height: 420 });
  await page.evaluate(async () => {
    await window.__pmtDiagram2EditorCore.undo();
    await window.__pmtDiagram2Renderer.whenIdle();
  });
  expect(await page.evaluate(() =>
    window.__pmtDiagram2EditorCore.getObjectById("crop-parity-image")?.imageClip
  )).toEqual({ x: 78, y: 112, width: 618, height: 390 });
  console.info("DIAGRAM2_CROP_PARITY_MISMATCHES", JSON.stringify({
    effectiveCropBounds: 0,
    effectiveCornerRadii: 0,
    selectionSuppression: 0,
    undoRedoFinalState: 0,
    saveReopen: 0,
    unexpectedFullRenders: 0,
    repeatedDecodes: 0
  }));
  await page.locator("[data-action='cancel-diagram2-editor']").click();
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

test("D1 and D2 Field Mapping Tables share geometry, cells, highlights, and timed arrows", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-1920", "The closure oracle screenshots require 1920x1080.");
  const canonicalState = phase6State();
  const canonicalTable = canonicalState.objects.find(object => object.id === "table-phase6");
  canonicalTable.fieldMappingHighlightColor = "#facc15";
  canonicalTable.fieldMappingHighlightStrokeWidth = 9;
  const mappingId = "mapping:field-phase6:taskid";

  await page.route("**/__phase6-field-mapping-closure", route => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: "<!doctype html><html><head><title>Field Mapping Closure</title></head><body></body></html>"
  }));
  await page.goto("/__phase6-field-mapping-closure");
  for (const url of [
    "/css/tokens.css",
    "/css/themes.css",
    "/css/base.css",
    "/css/components/image-annotation.css",
    "/css/features/diagram2.css"
  ]) {
    await page.addStyleTag({ url });
  }

  const d1Evidence = await page.evaluate(async state => {
    const annotation = await import("/js/components/image-annotation.js?v=20260731-diagram2-route-release-v15");
    const interactions = await import("/js/components/diagram-field-mapping-interactions.js?v=20260731-diagram2-route-release-v15");
    document.body.innerHTML = `<main class="phase6-closure-canvas" style="position:fixed;inset:0;overflow:hidden;background:#fff"></main>`;
    const host = document.querySelector(".phase6-closure-canvas");
    const svgMarkup = annotation.buildAnnotationSvg(state, {
      entityHeaderButtonsVisible: false,
      interactiveFieldMapping: true
    });
    host.innerHTML = svgMarkup;
    const svg = host.querySelector("svg");
    positionOracleSvg(svg, state);
    interactions.bindDiagramFieldMappingInteractions(svg, svgMarkup);
    const table = svg.querySelector("[data-annotation-object-id='table-phase6']");
    window.__phase6D1TableFingerprint = tableFingerprint(table, "d1");
    window.__phase6ArrowFingerprint = () => attentionArrowFingerprint(
      svg.querySelectorAll("[data-annotation-field-mapping-attention-arrow]")
    );
    window.__phase6D1HighlightFingerprint = () => highlightFingerprint(svg);
    return {
      table: window.__phase6D1TableFingerprint,
      uiCellCount: table.querySelectorAll("[data-annotation-field-mapping-cell-kind='ui']").length,
      databaseCellCount: table.querySelectorAll("[data-annotation-field-mapping-cell-kind='database']").length
    };

    function positionOracleSvg(target, diagramState) {
      const bounds = diagramState.objects.reduce((result, object) => {
        const left = Number(object.x ?? object.x1 ?? 0);
        const top = Number(object.y ?? object.y1 ?? 0);
        const right = object.x2 != null ? Number(object.x2) : left + Number(object.width || 0);
        const bottom = object.y2 != null ? Number(object.y2) : top + Number(object.height || 0);
        return {
          left: Math.min(result.left, left),
          top: Math.min(result.top, top),
          right: Math.max(result.right, right),
          bottom: Math.max(result.bottom, bottom)
        };
      }, { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
      const centerX = (bounds.left + bounds.right) / 2;
      const centerY = (bounds.top + bounds.bottom) / 2;
      target.style.position = "absolute";
      target.style.width = `${diagramState.width}px`;
      target.style.height = `${diagramState.height}px`;
      target.style.left = `${(innerWidth / 2) - centerX}px`;
      target.style.top = `${(innerHeight / 2) - centerY}px`;
      target.style.overflow = "visible";
    }

    function tableFingerprint(table, renderer) {
      const offsetX = renderer === "d2" ? Number(table.dataset.diagram2ObjectTransformX || 0) : 0;
      const offsetY = renderer === "d2" ? Number(table.dataset.diagram2ObjectTransformY || 0) : 0;
      const cells = [...table.querySelectorAll(renderer === "d2"
        ? "[data-diagram2-field-mapping-cell]"
        : "[data-annotation-field-mapping-cell]")];
      const rowSelector = renderer === "d2"
        ? "[data-diagram2-field-mapping-row]"
        : "[data-annotation-field-mapping-row]";
      const header = renderer === "d2"
        ? table.querySelector("[data-diagram2-field-mapping-header] rect")
        : [...table.querySelectorAll(":scope > rect")].find(rect => rect.getAttribute("fill") !== "none");
      const outline = renderer === "d2"
        ? table.querySelector(".diagram2-renderer-field-mapping-outline")
        : [...table.querySelectorAll(":scope > rect")].find(rect => rect.getAttribute("fill") === "none");
      const texts = [...table.querySelectorAll("text")];
      const lines = [...table.querySelectorAll("line")];
      const rowHoverStyle = (table.querySelector(rowSelector)?.getAttribute("style") || "")
        .match(/row-hover-fill:\s*([^;]+)/)?.[1]?.trim() || "";
      return {
        opacity: table.getAttribute("opacity") || "1",
        header: rectFingerprint(header, offsetX, offsetY),
        outline: rectFingerprint(outline, offsetX, offsetY),
        cells: cells.map(cell => {
          const kind = renderer === "d2"
            ? cell.dataset.diagram2FieldMappingCellKind
            : cell.dataset.annotationFieldMappingCellKind;
          const prefix = renderer === "d2" ? "diagram2FieldMappingCell" : "annotationFieldMappingCell";
          const row = cell.closest(rowSelector);
          const rowSource = renderer === "d2" ? row.dataset : cell.dataset;
          const rowPrefix = renderer === "d2" ? "diagram2FieldMappingRow" : "annotationFieldMappingRow";
          const fill = cell.querySelector(renderer === "d2"
            ? "[data-diagram2-field-mapping-cell-fill]"
            : "[data-annotation-field-mapping-cell-fill]");
          const text = cell.querySelector("text");
          return {
            kind,
            role: cell.getAttribute("role"),
            tabindex: cell.getAttribute("tabindex"),
            ariaLabel: cell.getAttribute("aria-label"),
            fieldRectangleId: renderer === "d2"
              ? cell.dataset.diagram2FieldRectangleId
              : cell.dataset.annotationFieldRectangleId,
            geometry: {
              x: rounded(Number(cell.dataset[`${prefix}X`] || 0) + offsetX),
              y: rounded(Number(cell.dataset[`${prefix}Y`] || 0) + offsetY),
              width: rounded(cell.dataset[`${prefix}Width`]),
              height: rounded(cell.dataset[`${prefix}Height`])
            },
            rowGeometry: {
              x: rounded(Number(rowSource[`${rowPrefix}X`] || 0) + offsetX),
              y: rounded(Number(rowSource[`${rowPrefix}Y`] || 0) + offsetY),
              width: rounded(rowSource[`${rowPrefix}Width`]),
              height: rounded(rowSource[`${rowPrefix}Height`])
            },
            fill: fill?.getAttribute("fill") || "",
            text: textFingerprint(text, offsetX, offsetY)
          };
        }),
        texts: texts.map(text => textFingerprint(text, offsetX, offsetY)),
        lines: lines.map(line => ({
          x1: rounded(Number(line.getAttribute("x1") || 0) + offsetX),
          y1: rounded(Number(line.getAttribute("y1") || 0) + offsetY),
          x2: rounded(Number(line.getAttribute("x2") || 0) + offsetX),
          y2: rounded(Number(line.getAttribute("y2") || 0) + offsetY),
          stroke: line.getAttribute("stroke") || "",
          strokeWidth: line.getAttribute("stroke-width") || "1",
          vectorEffect: line.getAttribute("vector-effect") || ""
        })),
        rowHoverFill: rowHoverStyle
      };
    }

    function rectFingerprint(rect, offsetX, offsetY) {
      return {
        x: rounded(Number(rect?.getAttribute("x") || 0) + offsetX),
        y: rounded(Number(rect?.getAttribute("y") || 0) + offsetY),
        width: rounded(rect?.getAttribute("width")),
        height: rounded(rect?.getAttribute("height")),
        fill: rect?.getAttribute("fill") || "",
        stroke: rect?.getAttribute("stroke") || "none",
        strokeWidth: rect?.getAttribute("stroke-width") || "1",
        vectorEffect: rect?.getAttribute("vector-effect") || ""
      };
    }

    function textFingerprint(text, offsetX, offsetY) {
      return {
        value: text?.textContent || "",
        x: rounded(Number(text?.getAttribute("x") || 0) + offsetX),
        y: rounded(Number(text?.getAttribute("y") || 0) + offsetY),
        fill: text?.getAttribute("fill") || "",
        fontFamily: text?.getAttribute("font-family") || "",
        fontSize: text?.getAttribute("font-size") || "",
        fontWeight: text?.getAttribute("font-weight") || "400",
        clipPath: Boolean(text?.getAttribute("clip-path"))
      };
    }

    function attentionArrowFingerprint(nodes) {
      return [...nodes].map(node => {
        const line = node.matches("line") ? node : node.querySelector("line");
        const polygon = node.matches("polygon") ? node : node.querySelector("polygon");
        const style = line ? getComputedStyle(line) : null;
        return {
          start: {
            x: rounded(line?.getAttribute("x1")),
            y: rounded(line?.getAttribute("y1"))
          },
          lineEnd: {
            x: rounded(line?.getAttribute("x2")),
            y: rounded(line?.getAttribute("y2"))
          },
          head: String(polygon?.getAttribute("points") || "").trim().split(/\s+/).filter(Boolean)
            .map(pair => {
              const [x, y] = pair.split(",").map(Number);
              return { x: rounded(x), y: rounded(y) };
            }),
          stroke: style?.stroke || "",
          strokeWidth: style?.strokeWidth || "",
          dasharray: style?.strokeDasharray || "",
          linecap: style?.strokeLinecap || "",
          opacity: style?.opacity || "",
          vectorEffect: style?.vectorEffect || "",
          headFill: polygon ? getComputedStyle(polygon).fill : ""
        };
      });
    }

    function highlightFingerprint(root) {
      return [
        ...[...root.querySelectorAll(".image-annotation-field-mapping-attention-rect")].map(rect => {
          const style = getComputedStyle(rect);
          return {
            kind: "rect",
            x1: rounded(rect.getAttribute("x")),
            y1: rounded(rect.getAttribute("y")),
            x2: rounded(Number(rect.getAttribute("x")) + Number(rect.getAttribute("width"))),
            y2: rounded(Number(rect.getAttribute("y")) + Number(rect.getAttribute("height"))),
            stroke: style.stroke,
            strokeWidth: style.strokeWidth,
            dasharray: style.strokeDasharray,
            linecap: style.strokeLinecap,
            opacity: style.opacity
          };
        }),
        ...[...root.querySelectorAll(".image-annotation-field-mapping-attention-line")].map(line => {
          const style = getComputedStyle(line);
          return {
            kind: "line",
            x1: rounded(line.getAttribute("x1")),
            y1: rounded(line.getAttribute("y1")),
            x2: rounded(line.getAttribute("x2")),
            y2: rounded(line.getAttribute("y2")),
            stroke: style.stroke,
            strokeWidth: style.strokeWidth,
            dasharray: style.strokeDasharray,
            linecap: style.strokeLinecap,
            opacity: style.opacity
          };
        })
      ];
    }

    function rounded(value) {
      return Math.round((Number(value) || 0) * 1000) / 1000;
    }
  }, canonicalState);
  expect(d1Evidence.uiCellCount).toBe(1);
  expect(d1Evidence.databaseCellCount).toBe(1);
  await capturePhase6ClosureScreenshot(page, "field-mapping-table-d1-idle-1920x1080.png");

  const d1UiCell = page.locator("[data-annotation-field-mapping-cell-kind='ui']").first();
  await d1UiCell.click();
  await expect(page.locator("[data-annotation-field-mapping-attention-arrow]")).toHaveCount(2);
  const d1UiArrows = await page.evaluate(() => window.__phase6ArrowFingerprint());
  const d1Highlight = await page.evaluate(() => window.__phase6D1HighlightFingerprint());
  await capturePhase6ClosureScreenshot(page, "field-mapping-table-d1-ui-cell-arrows-1920x1080.png");

  const d1DatabaseCell = page.locator("[data-annotation-field-mapping-cell-kind='database']").first();
  await d1DatabaseCell.click();
  await expect(page.locator("[data-annotation-field-mapping-attention-arrow]")).toHaveCount(2);
  const d1DatabaseArrows = await page.evaluate(() => window.__phase6ArrowFingerprint());
  await capturePhase6ClosureScreenshot(page, "field-mapping-table-d1-database-cell-arrows-1920x1080.png");

  const d2Evidence = await page.evaluate(async ({ state, mappingId: activeMappingId }) => {
    document.body.innerHTML = `<main id="phase6D2Host" style="position:fixed;inset:0;overflow:hidden;background:#fff"></main>`;
    const { createDiagram2Renderer } = await import("/js/features/diagram2/diagram2-renderer.js?v=20260731-diagram2-route-release-v15");
    const { createDiagram2FieldMappingIndexes } = await import("/js/features/diagram2/diagram2-editor-field-mappings.js?v=20260731-diagram2-route-release-v15");
    const host = document.querySelector("#phase6D2Host");
    const renderer = createDiagram2Renderer({ host });
    renderer.render(state, { reason: "Phase 6 D1/D2 closure oracle" });
    renderer.focusObjectIds(
      ["image-phase6", "field-phase6", "entity-phase6", "table-phase6"],
      { scale: 1, reason: "Phase 6 D1/D2 closure oracle" }
    );
    await renderer.whenIdle();
    const table = host.querySelector("[data-diagram2-object-id='table-phase6']");
    const fingerprint = tableFingerprint(table);
    const before = renderer.diagnostics();
    window.__phase6D2Renderer = renderer;
    window.__phase6D2MappingId = activeMappingId;
    window.__phase6D2ArrowFingerprint = attentionArrowFingerprint;
    window.__phase6D2HighlightFingerprint = () => highlightFingerprint(host);
    return {
      table: fingerprint,
      uiCellCount: table.querySelectorAll("[data-diagram2-field-mapping-cell][data-diagram2-field-mapping-cell-kind='ui']").length,
      databaseCellCount: table.querySelectorAll("[data-diagram2-field-mapping-cell][data-diagram2-field-mapping-cell-kind='database']").length,
      fullRenderCount: before.fullRenderCount,
      relationshipRerouteCount: before.selectiveRoutingRelationshipsRerouted
    };

    function tableFingerprint(table) {
      const offsetX = Number(table.dataset.diagram2ObjectTransformX || 0);
      const offsetY = Number(table.dataset.diagram2ObjectTransformY || 0);
      const cells = [...table.querySelectorAll("[data-diagram2-field-mapping-cell]")];
      const header = table.querySelector("[data-diagram2-field-mapping-header] rect");
      const outline = table.querySelector(".diagram2-renderer-field-mapping-outline");
      const texts = [...table.querySelectorAll("text")];
      const lines = [...table.querySelectorAll("line")];
      const row = table.querySelector("[data-diagram2-field-mapping-row]");
      const rowHoverStyle = (row?.getAttribute("style") || "")
        .match(/row-hover-fill:\s*([^;]+)/)?.[1]?.trim() || "";
      return {
        opacity: table.getAttribute("opacity") || "1",
        header: rectFingerprint(header, offsetX, offsetY),
        outline: rectFingerprint(outline, offsetX, offsetY),
        cells: cells.map(cell => {
          const fill = cell.querySelector("[data-diagram2-field-mapping-cell-fill]");
          const text = cell.querySelector("text");
          const rowNode = cell.closest("[data-diagram2-field-mapping-row]");
          return {
            kind: cell.dataset.diagram2FieldMappingCellKind,
            role: cell.getAttribute("role"),
            tabindex: cell.getAttribute("tabindex"),
            ariaLabel: cell.getAttribute("aria-label"),
            fieldRectangleId: cell.dataset.diagram2FieldRectangleId,
            geometry: {
              x: rounded(Number(cell.dataset.diagram2FieldMappingCellX || 0) + offsetX),
              y: rounded(Number(cell.dataset.diagram2FieldMappingCellY || 0) + offsetY),
              width: rounded(cell.dataset.diagram2FieldMappingCellWidth),
              height: rounded(cell.dataset.diagram2FieldMappingCellHeight)
            },
            rowGeometry: {
              x: rounded(Number(rowNode.dataset.diagram2FieldMappingRowX || 0) + offsetX),
              y: rounded(Number(rowNode.dataset.diagram2FieldMappingRowY || 0) + offsetY),
              width: rounded(rowNode.dataset.diagram2FieldMappingRowWidth),
              height: rounded(rowNode.dataset.diagram2FieldMappingRowHeight)
            },
            fill: fill?.getAttribute("fill") || "",
            text: textFingerprint(text, offsetX, offsetY)
          };
        }),
        texts: texts.map(text => textFingerprint(text, offsetX, offsetY)),
        lines: lines.map(line => ({
          x1: rounded(Number(line.getAttribute("x1") || 0) + offsetX),
          y1: rounded(Number(line.getAttribute("y1") || 0) + offsetY),
          x2: rounded(Number(line.getAttribute("x2") || 0) + offsetX),
          y2: rounded(Number(line.getAttribute("y2") || 0) + offsetY),
          stroke: line.getAttribute("stroke") || "",
          strokeWidth: line.getAttribute("stroke-width") || "1",
          vectorEffect: line.getAttribute("vector-effect") || ""
        })),
        rowHoverFill: rowHoverStyle
      };
    }

    function rectFingerprint(rect, offsetX, offsetY) {
      return {
        x: rounded(Number(rect?.getAttribute("x") || 0) + offsetX),
        y: rounded(Number(rect?.getAttribute("y") || 0) + offsetY),
        width: rounded(rect?.getAttribute("width")),
        height: rounded(rect?.getAttribute("height")),
        fill: rect?.getAttribute("fill") || "",
        stroke: rect?.getAttribute("stroke") || "none",
        strokeWidth: rect?.getAttribute("stroke-width") || "1",
        vectorEffect: rect?.getAttribute("vector-effect") || ""
      };
    }

    function textFingerprint(text, offsetX, offsetY) {
      return {
        value: text?.textContent || "",
        x: rounded(Number(text?.getAttribute("x") || 0) + offsetX),
        y: rounded(Number(text?.getAttribute("y") || 0) + offsetY),
        fill: text?.getAttribute("fill") || "",
        fontFamily: text?.getAttribute("font-family") || "",
        fontSize: text?.getAttribute("font-size") || "",
        fontWeight: text?.getAttribute("font-weight") || "400",
        clipPath: Boolean(text?.getAttribute("clip-path"))
      };
    }

    function attentionArrowFingerprint(nodes) {
      const lines = [...nodes].flatMap(node => node.matches("line")
        ? [node]
        : [...node.querySelectorAll("line")]);
      return lines.map(line => {
        const kind = line.dataset.diagram2FieldMappingAttentionArrow || "";
        const polygon = line.parentElement?.querySelector(
          `[data-diagram2-field-mapping-attention-arrow-head="${CSS.escape(kind)}"]`
        ) || null;
        const style = line ? getComputedStyle(line) : null;
        return {
          start: { x: rounded(line?.getAttribute("x1")), y: rounded(line?.getAttribute("y1")) },
          lineEnd: { x: rounded(line?.getAttribute("x2")), y: rounded(line?.getAttribute("y2")) },
          head: String(polygon?.getAttribute("points") || "").trim().split(/\s+/).filter(Boolean)
            .map(pair => {
              const [x, y] = pair.split(",").map(Number);
              return { x: rounded(x), y: rounded(y) };
            }),
          stroke: style?.stroke || "",
          strokeWidth: style?.strokeWidth || "",
          dasharray: style?.strokeDasharray || "",
          linecap: style?.strokeLinecap || "",
          opacity: style?.opacity || "",
          vectorEffect: style?.vectorEffect || "",
          headFill: polygon ? getComputedStyle(polygon).fill : ""
        };
      });
    }

    function highlightFingerprint(root) {
      return [
        ...[...root.querySelectorAll(".image-annotation-field-mapping-attention-rect")].map(rect => {
          const style = getComputedStyle(rect);
          return {
            kind: "rect",
            x1: rounded(rect.getAttribute("x")),
            y1: rounded(rect.getAttribute("y")),
            x2: rounded(Number(rect.getAttribute("x")) + Number(rect.getAttribute("width"))),
            y2: rounded(Number(rect.getAttribute("y")) + Number(rect.getAttribute("height"))),
            stroke: style.stroke,
            strokeWidth: style.strokeWidth,
            dasharray: style.strokeDasharray,
            linecap: style.strokeLinecap,
            opacity: style.opacity
          };
        }),
        ...[...root.querySelectorAll(".image-annotation-field-mapping-attention-line")].map(line => {
          const style = getComputedStyle(line);
          return {
            kind: "line",
            x1: rounded(line.getAttribute("x1")),
            y1: rounded(line.getAttribute("y1")),
            x2: rounded(line.getAttribute("x2")),
            y2: rounded(line.getAttribute("y2")),
            stroke: style.stroke,
            strokeWidth: style.strokeWidth,
            dasharray: style.strokeDasharray,
            linecap: style.strokeLinecap,
            opacity: style.opacity
          };
        })
      ];
    }

    function rounded(value) {
      return Math.round((Number(value) || 0) * 1000) / 1000;
    }
  }, { state: canonicalState, mappingId });

  expect(d2Evidence.uiCellCount).toBe(1);
  expect(d2Evidence.databaseCellCount).toBe(1);
  expect(d2Evidence.table).toEqual(d1Evidence.table);
  await capturePhase6ClosureScreenshot(page, "field-mapping-table-d2-idle-1920x1080.png");

  const d2UiResult = await page.evaluate(() => {
    const renderer = window.__phase6D2Renderer;
    renderer.pinFieldMapping(window.__phase6D2MappingId, {
      tableId: "table-phase6",
      cellKind: "ui"
    });
    return {
      arrows: window.__phase6D2ArrowFingerprint(
        document.querySelectorAll("[data-diagram2-field-mapping-attention-arrows]")
      ),
      highlight: window.__phase6D2HighlightFingerprint(),
      diagnostics: renderer.diagnostics()
    };
  });
  expectArrowParity(d2UiResult.arrows, d1UiArrows);
  expectHighlightParity(d2UiResult.highlight, d1Highlight);
  expect(d2UiResult.diagnostics.fullRenderCount).toBe(d2Evidence.fullRenderCount);
  expect(d2UiResult.diagnostics.selectiveRoutingRelationshipsRerouted).toBe(d2Evidence.relationshipRerouteCount);
  await capturePhase6ClosureScreenshot(page, "field-mapping-table-d2-ui-cell-arrows-1920x1080.png");

  const d2DatabaseResult = await page.evaluate(() => {
    const renderer = window.__phase6D2Renderer;
    renderer.pinFieldMapping(window.__phase6D2MappingId, {
      tableId: "table-phase6",
      cellKind: "database"
    });
    return window.__phase6D2ArrowFingerprint(
      document.querySelectorAll("[data-diagram2-field-mapping-attention-arrows]")
    );
  });
  expectArrowParity(d2DatabaseResult, d1DatabaseArrows);
  await capturePhase6ClosureScreenshot(page, "field-mapping-table-d2-database-cell-arrows-1920x1080.png");

  const timerStartedAt = Date.now();
  await expect.poll(() => page.locator("[data-diagram2-field-mapping-attention-arrows]").count(), {
    timeout: 3400,
    intervals: [50]
  }).toBe(0);
  const timerEvidence = await page.evaluate(() => {
    const renderer = window.__phase6D2Renderer;
    const diagnostics = renderer.diagnostics();
    return {
      lifetimeMs: diagnostics.mappingArrowLifetimeMs,
      timerActive: diagnostics.mappingArrowTimerActive,
      pinned: diagnostics.mappingPinned,
      highlightCount: document.querySelectorAll("[data-diagram2-field-mapping-highlight]").length,
      fullRenderCount: diagnostics.fullRenderCount
    };
  });
  expect(Date.now() - timerStartedAt).toBeGreaterThanOrEqual(2850);
  expect(timerEvidence.lifetimeMs).toBeGreaterThanOrEqual(2850);
  expect(timerEvidence.lifetimeMs).toBeLessThanOrEqual(3150);
  expect(timerEvidence.timerActive).toBe(false);
  expect(timerEvidence.pinned).toBe(true);
  expect(timerEvidence.highlightCount).toBe(1);
  expect(timerEvidence.fullRenderCount).toBe(d2Evidence.fullRenderCount);
  console.info("PHASE6_FIELD_MAPPING_CLOSURE", JSON.stringify({
    tableGeometryMismatches: 0,
    arrowGeometryErrorsOutsideTolerance: 0,
    d2UiArrows: d2UiResult.arrows,
    d2DatabaseArrows: d2DatabaseResult,
    arrowLifetimeMs: timerEvidence.lifetimeMs
  }));
  await page.evaluate(() => {
    window.__phase6D2Renderer.destroy();
    delete window.__phase6D2Renderer;
    delete window.__phase6D2MappingId;
    delete window.__phase6D2ArrowFingerprint;
    delete window.__phase6D2HighlightFingerprint;
  });
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

async function capturePhase6ClosureScreenshot(page, fileName) {
  const directory = path.join(process.cwd(), "docs", "screenshots", "diagram-2-phase-6", "closure");
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: path.join(directory, fileName),
    fullPage: false
  });
}

async function assertDiagram2ImageDrop(page, imageBase64) {
  const canvas = page.locator("[data-diagram2-viewer-canvas]");
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).toBeTruthy();
  const clientPoint = {
    x: canvasBox.x + (canvasBox.width * 0.42),
    y: canvasBox.y + (canvasBox.height * 0.46)
  };
  const before = await page.evaluate(point => {
    const controller = window.__pmtDiagram2EditorCore;
    const renderer = window.__pmtDiagram2Renderer;
    return {
      imageCount: controller.currentState().objects.filter(object => object.type === "embedded-image").length,
      historyEntryCount: controller.historyStatus().entryCount,
      fullRenderCount: renderer.diagnostics().fullRenderCount,
      insertionPoint: controller.snapPoint(renderer.screenToWorld({
        clientX: point.x,
        clientY: point.y
      }))
    };
  }, clientPoint);
  const dataTransfer = await page.evaluateHandle(({ base64 }) => {
    const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], "phase6-drop.png", { type: "image/png" }));
    return transfer;
  }, { base64: imageBase64 });
  await canvas.dispatchEvent("dragover", {
    dataTransfer,
    clientX: clientPoint.x,
    clientY: clientPoint.y
  });
  await expect(canvas).toHaveClass(/is-image-drop-target/);
  await canvas.dispatchEvent("drop", {
    dataTransfer,
    clientX: clientPoint.x,
    clientY: clientPoint.y
  });
  await dataTransfer.dispose();

  await expect.poll(() => page.evaluate(() =>
    window.__pmtDiagram2EditorCore.currentState().objects
      .filter(object => object.type === "embedded-image").length
  )).toBe(before.imageCount + 1);
  const after = await page.evaluate(async () => {
    const controller = window.__pmtDiagram2EditorCore;
    const renderer = window.__pmtDiagram2Renderer;
    await renderer.whenIdle();
    const image = controller.currentState().objects
      .find(object => object.type === "embedded-image" && object.name === "phase6-drop.png");
    return {
      image,
      historyEntryCount: controller.historyStatus().entryCount,
      fullRenderCount: renderer.diagnostics().fullRenderCount,
      selectedIds: controller.selectedObjectIds()
    };
  });
  expect(after.image).toBeTruthy();
  expect(after.historyEntryCount).toBe(before.historyEntryCount + 1);
  expect(after.fullRenderCount).toBe(before.fullRenderCount);
  expect(after.selectedIds).toEqual([after.image.id]);
  expect(Math.abs((after.image.x + (after.image.width / 2)) - before.insertionPoint.x)).toBeLessThanOrEqual(1);
  expect(Math.abs((after.image.y + (after.image.height / 2)) - before.insertionPoint.y)).toBeLessThanOrEqual(1);
  return after.image;
}

async function createDiagram2ReversibleCrop(page, imageId) {
  const handle = page.locator(
    `[data-diagram2-crop-handle='nw'][data-diagram2-crop-object-id='${imageId}']`
  );
  await expect(handle).toBeVisible();
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box.x + (box.width / 2), box.y + (box.height / 2));
  await page.mouse.down();
  await page.mouse.move(box.x + (box.width / 2) + 36, box.y + (box.height / 2) + 28, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(id => {
    const image = window.__pmtDiagram2EditorCore?.getObjectById?.(id);
    return image?.imageClip?.x > image?.x && image?.imageClip?.y > image?.y;
  }, imageId)).toBe(true);
}

async function createDiagram2ReversibleCropCommand(page, imageId) {
  await page.evaluate(async id => {
    const controller = window.__pmtDiagram2EditorCore;
    const renderer = window.__pmtDiagram2Renderer;
    const image = controller.getObjectById(id);
    await controller.updateEmbeddedImageCrop(id, {
      imageClip: {
        x: image.x + 16,
        y: image.y + 12,
        width: image.width - 36,
        height: image.height - 28
      },
      cropVisible: true
    }, {
      label: "Crop image",
      reason: "Phase 6 browser fixture"
    });
    renderer.setCropTarget(id);
    await renderer.whenIdle();
  }, imageId);
}

async function assertDiagram2PermanentCrop(page, beforeImage) {
  const before = await page.evaluate(id => {
    const controller = window.__pmtDiagram2EditorCore;
    const renderer = window.__pmtDiagram2Renderer;
    const image = controller.getObjectById(id);
    return {
      image,
      history: controller.historyStatus(),
      diagnostics: renderer.diagnostics()
    };
  }, beforeImage.id);
  expect(before.image.imageClip.x).toBe(before.image.x + 24);
  await expect(page.locator("[data-action='permanently-crop-diagram2-image']")).toBeEnabled();
  await page.locator("[data-action='permanently-crop-diagram2-image']").click();
  await page.getByRole("button", { name: "Apply Permanently", exact: true }).click();
  await expect.poll(() => page.evaluate(id =>
    window.__pmtDiagram2EditorCore.getObjectById(id)?.source || "", beforeImage.id
  )).not.toBe(before.image.source);

  const after = await page.evaluate(async id => {
    const controller = window.__pmtDiagram2EditorCore;
    const renderer = window.__pmtDiagram2Renderer;
    await renderer.whenIdle();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return {
      image: controller.getObjectById(id),
      history: controller.historyStatus(),
      diagnostics: renderer.diagnostics()
    };
  }, beforeImage.id);
  expect(after.image.source).toMatch(/^data:image\/png;base64,/);
  expect(after.image).toMatchObject({
    x: before.image.imageClip.x,
    y: before.image.imageClip.y,
    width: before.image.imageClip.width,
    height: before.image.imageClip.height,
    cropVisible: true,
    cropPermanent: true
  });
  expect(after.image.imageClip).toEqual({
    x: after.image.x,
    y: after.image.y,
    width: after.image.width,
    height: after.image.height
  });
  expect(after.history.entryCount).toBe(0);
  expect(after.history.canRedo).toBe(false);
  expect(after.history.dirty).toBe(true);
  expect(after.diagnostics.resourceReleaseCount).toBe(before.diagnostics.resourceReleaseCount + 1);
  expect(after.diagnostics.decodeCount).toBe(before.diagnostics.decodeCount + 1);
  expect(after.diagnostics.cachedImageCount).toBe(before.diagnostics.cachedImageCount);
  return after.image;
}

async function assertDiagram2ClipboardImagePaste(page, imageBase64) {
  const before = await page.evaluate(() => {
    const controller = window.__pmtDiagram2EditorCore;
    const renderer = window.__pmtDiagram2Renderer;
    return {
      imageCount: controller.currentState().objects.filter(object => object.type === "embedded-image").length,
      historyEntryCount: controller.historyStatus().entryCount,
      fullRenderCount: renderer.diagnostics().fullRenderCount
    };
  });
  const textOnlyPrevented = await page.evaluate(() => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", "Ordinary clipboard text");
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: clipboardData });
    document.querySelector("[data-diagram2-viewer-canvas]").dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(textOnlyPrevented).toBe(false);
  expect(await page.evaluate(() =>
    window.__pmtDiagram2EditorCore.currentState().objects
      .filter(object => object.type === "embedded-image").length
  )).toBe(before.imageCount);

  const imagePrevented = await page.evaluate(base64 => {
    const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
    const clipboardData = new DataTransfer();
    clipboardData.items.add(new File([bytes], "Clipboard phase6.png", { type: "image/png" }));
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: clipboardData });
    document.querySelector("[data-diagram2-viewer-canvas]").dispatchEvent(event);
    return event.defaultPrevented;
  }, imageBase64);
  expect(imagePrevented).toBe(true);
  await expect.poll(() => page.evaluate(() =>
    window.__pmtDiagram2EditorCore.currentState().objects
      .filter(object => object.type === "embedded-image").length
  )).toBe(before.imageCount + 1);
  const after = await page.evaluate(async () => {
    const controller = window.__pmtDiagram2EditorCore;
    const renderer = window.__pmtDiagram2Renderer;
    await renderer.whenIdle();
    return {
      image: controller.currentState().objects
        .find(object => object.type === "embedded-image" && object.name === "Clipboard phase6.png"),
      historyEntryCount: controller.historyStatus().entryCount,
      fullRenderCount: renderer.diagnostics().fullRenderCount
    };
  });
  expect(after.image).toMatchObject({
    name: "Clipboard phase6.png",
    source: "/uploads/diagram2-phase6-image-2.png"
  });
  expect(after.historyEntryCount).toBe(before.historyEntryCount + 1);
  expect(after.fullRenderCount).toBe(before.fullRenderCount);
  return after.image;
}

function expectArrowParity(actual, expected) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((arrow, index) => {
    const oracle = expected[index];
    for (const key of ["start", "lineEnd"]) {
      expect(Math.abs(arrow[key].x - oracle[key].x)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(arrow[key].y - oracle[key].y)).toBeLessThanOrEqual(0.5);
    }
    expect(arrow.head).toHaveLength(oracle.head.length);
    arrow.head.forEach((point, pointIndex) => {
      expect(Math.abs(point.x - oracle.head[pointIndex].x)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(point.y - oracle.head[pointIndex].y)).toBeLessThanOrEqual(0.5);
    });
    expect(arrow.stroke).toBe(oracle.stroke);
    expect(arrow.strokeWidth).toBe(oracle.strokeWidth);
    expect(arrow.dasharray).toBe(oracle.dasharray);
    expect(arrow.linecap).toBe(oracle.linecap);
    expect(arrow.opacity).toBe(oracle.opacity);
    expect(arrow.vectorEffect).toBe(oracle.vectorEffect);
    expect(arrow.headFill).toBe(oracle.headFill);
  });
}

function expectHighlightParity(actual, expected) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((item, index) => {
    const oracle = expected[index];
    expect(item.kind).toBe(oracle.kind);
    for (const key of ["x1", "y1", "x2", "y2"]) {
      expect(Math.abs(item[key] - oracle[key])).toBeLessThanOrEqual(0.5);
    }
    expect(item.stroke).toBe(oracle.stroke);
    expect(item.strokeWidth).toBe(oracle.strokeWidth);
    expect(item.dasharray).toBe(oracle.dasharray);
    expect(item.linecap).toBe(oracle.linecap);
    expect(item.opacity).toBe(oracle.opacity);
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

function cropParityState() {
  return normalizeAnnotationState({
    version: 1,
    width: 1600,
    height: 900,
    gridVisible: false,
    objects: [createDiagram2EmbeddedImage({
      id: "crop-parity-image",
      name: "Crop parity image",
      source: mockScreenshotDataUrl(),
      x: 60,
      y: 100,
      width: 660,
      height: 420,
      isOriginalImage: true
    })]
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
