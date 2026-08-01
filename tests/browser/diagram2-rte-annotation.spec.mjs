import { expect, test } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  buildAnnotationSvg,
  normalizeAnnotationState,
  parseAnnotationSvg
} from "../../wwwroot/js/components/image-annotation.js";
import {
  createDiagram2EntityAnnotationPlan
} from "../../wwwroot/js/features/diagram2/diagram2-editor-entity-annotations.js";
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

test.use({ timezoneId: "Asia/Taipei" });

const diagram2RtePerformanceState = JSON.parse(await readFile(
  new URL("../fixtures/diagram2/diagram-23-state.json", import.meta.url),
  "utf8"
));
const diagram2RtePerformanceSvg = buildAnnotationSvg(diagram2RtePerformanceState);

test("Annotate 2.0 saves through the RTE upload URL and remains editable", async ({ page }, testInfo) => {
  let uploadedSvg = "";
  let applyCount = 0;

  await page.route("**/uploads/original.svg", route => route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="#ffffff"/></svg>`
  }));
  await page.route("**/uploads/annotated.svg", route => route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: uploadedSvg || `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>`
  }));

  await openDiagram2RteFixture(page);
  await page.setContent(`
    <div class="rich-editor" contenteditable="true">
      <p><img id="targetImage" src="/uploads/original.svg" alt="Original" style="width: 160px;" data-existing-size="keep"></p>
    </div>
  `);
  await loadDiagram2RteStyles(page);

  await page.evaluate(() => {
    window.__diagram2RteNotifications = [];
  });
  await page.evaluate(async () => {
    const { openDiagram2RteAnnotationHost } = await import("/js/features/diagram2/diagram2-rte-host-adapter.js?v=20260731-diagram2-rte-interactions-v1");
    const image = document.querySelector("#targetImage");
    const editor = document.querySelector(".rich-editor");
    window.__diagram2RtePromise = openDiagram2RteAnnotationHost({
      image,
      editor,
      source: "/uploads/original.svg",
      originalReference: "/uploads/original.svg",
      originalUrl: "/uploads/original.svg",
      originalFileName: "original.svg",
      canEdit: true,
      askForText: async () => "RTE Pair",
      notify: message => window.__diagram2RteNotifications.push(message),
      loadTemplateLibrary: async () => ({ version: 1, templates: [], defaults: {} }),
      loadDefaultTemplateLibrary: async () => ({ version: 1, templates: [], defaults: {} }),
      saveTemplateLibrary: async library => library,
      apply: async annotation => {
        window.__diagram2RteApplyCount = (window.__diagram2RteApplyCount || 0) + 1;
        window.__diagram2RteUploadedSvg = annotation.svg;
        image.setAttribute("src", "/uploads/annotated.svg");
        if (annotation.originalReference) image.dataset.pmtAnnotationSource = annotation.originalReference;
        image.dataset.pmtAnnotationVersion = String(annotation.state.version || 1);
        image.classList.add("rich-svg-image", "pmt-annotation-image");
        image.setAttribute("alt", image.getAttribute("alt") || "Annotated image");
      }
    });
  });

  await expect(page.locator("[data-diagram2-rte-host]")).toBeVisible();
  await page.evaluate(async () => {
    const controller = window.__pmtDiagram2EditorCore;
    await controller.addObject(controller.createDefaultObject("rectangle", { x: 90, y: 70 }, { id: "rte-rect" }));
    await controller.addObject(controller.createDefaultObject("circle", { x: 230, y: 70 }, { id: "rte-circle" }));
    controller.setSelection(["rte-rect", "rte-circle"]);
  });
  await page.keyboard.press("Control+g");
  await expect.poll(() => page.evaluate(() => {
    const controller = window.__pmtDiagram2EditorCore;
    return Boolean(controller.getObjectById("rte-rect").groupId)
      && controller.getObjectById("rte-rect").groupId === controller.getObjectById("rte-circle").groupId;
  })).toBe(true);
  await ensureDiagram2RteObjectsPaneOpen(page.locator("[data-diagram2-rte-host]"));
  await expect(page.locator("[data-diagram2-rte-host] [data-diagram2-tree-node-kind='group']")).toContainText("Group 1");
  await assertDiagram2RteObjectTreeDoubleClickFocus(page);
  await ensureDiagram2RteTemplatesPaneOpen(page.locator("[data-diagram2-rte-host]"));
  await page.locator("[data-diagram2-rte-host] [data-action='save-diagram2-selection-template']").click();
  await expect(page.locator("[data-diagram2-rte-host] [data-diagram2-template-card]")).toContainText("RTE Pair");
  await expect(page.locator("[data-diagram2-rte-host] [data-diagram2-template-card] .image-annotation-template-preview").first()).toBeVisible();
  await expect(page.locator("[data-diagram2-rte-host] [data-diagram2-template-card] .image-annotation-template-preview img").first())
    .toHaveAttribute("src", /^data:image\/svg\+xml;charset=utf-8,/);
  await captureDiagram2RtePhase4Screenshot(page, testInfo, "chromium-1366", "diagram2-phase4-rte-annotate-1366x768.png");
  await page.evaluate(() => window.__pmtDiagram2EditorCore.markSaved());
  const toolbarRectangleId = await assertDiagram2RteToolbarObjectInsertion(page);
  await assertDiagram2RtePhase3CoreEditing(page, toolbarRectangleId);
  await assertDiagram2RtePhase5EntityEditing(page, testInfo);
  await assertDiagram2RteRouteRelease(page, "Annotate 2.0");
  const movedImage = await page.evaluate(async () => {
    const controller = window.__pmtDiagram2EditorCore;
    const imageObject = controller.currentState().objects.find(object => object.type === "embedded-image" && object.isOriginalImage === true);
    controller.setSelection([imageObject.id]);
    const moved = await controller.moveObjects([imageObject.id], 80, 40, { reason: "test moved image" });
    const nextImage = controller.getObjectById(imageObject.id);
    controller.addObjectCanonical({
      id: "outside-arrow",
      type: "arrow",
      x1: -80,
      y1: 60,
      x2: 120,
      y2: 100,
      stroke: "#00b050",
      strokeWidth: 6,
      arrowSize: 24,
      opacity: 1
    }, { reason: "test add outside arrow" });
    return {
      moved,
      x: nextImage.x,
      y: nextImage.y,
      width: nextImage.width,
      height: nextImage.height,
      imageClip: nextImage.imageClip
    };
  });
  expect(movedImage).toEqual({
    moved: false,
    x: 0,
    y: 0,
    width: 320,
    height: 180,
    imageClip: { x: 0, y: 0, width: 320, height: 180 }
  });
  await assertDiagram2RtePhase6CreateAndCrop(page, testInfo);
  await page.locator("[data-diagram2-crop-corner-radius]").fill("25");
  await expect.poll(() => page.evaluate(() =>
    window.__pmtDiagram2Phase6Host.cropAdjustmentDiagnostics().pendingAdjustment
  )).toBe(true);
  await page.getByRole("button", { name: "Apply to RTE" }).click();
  await page.evaluate(() => window.__diagram2RtePromise);

  const saved = await page.evaluate(() => {
    const image = document.querySelector("#targetImage");
    return {
      applyCount: window.__diagram2RteApplyCount || 0,
      uploadedSvg: window.__diagram2RteUploadedSvg || "",
      src: image.getAttribute("src") || "",
      outerHtml: image.outerHTML,
      editorHtml: document.querySelector(".rich-editor").innerHTML,
      originalReference: image.dataset.pmtAnnotationSource || "",
      version: image.dataset.pmtAnnotationVersion || "",
      className: image.className,
      style: image.getAttribute("style") || "",
      customSize: image.dataset.existingSize || ""
    };
  });

  applyCount = saved.applyCount;
  uploadedSvg = saved.uploadedSvg;
  expect(applyCount).toBe(1);
  expect(uploadedSvg).toContain("data-pmt-image-annotation-state");
  expect(uploadedSvg).toContain('href="data:image/svg+xml;base64,');
  expect(uploadedSvg).toContain('"source":"/uploads/original.svg"');
  const uploadedViewBox = uploadedSvg.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number) || [];
  expect(uploadedViewBox[0]).toBeLessThan(0);
  expect(uploadedViewBox[2]).toBeGreaterThan(320);
  expect(uploadedSvg).toContain("pmt-annotation-image-clip-");
  expect(uploadedSvg).toContain('"id":"outside-arrow"');
  expect(uploadedSvg).toContain(`"id":"${toolbarRectangleId}"`);
  expect(uploadedSvg).toContain('"imageClip":{"x":18,"y":12,"width":284,"height":150}');
  expect(uploadedSvg).toContain('"cropCornerRadius":25');
  expect(uploadedSvg).toContain('"id":"rte-phase6-field"');
  expect(uploadedSvg).toContain('"type":"field-mapping-table"');
  expect(saved.src).toBe("/uploads/annotated.svg");
  expect(saved.src).not.toMatch(/^(data:|blob:)/);
  expect(saved.editorHtml).not.toContain(uploadedSvg);
  expect(saved.editorHtml).not.toContain("data:image/svg+xml;base64,");
  expect(saved.originalReference).toBe("/uploads/original.svg");
  expect(saved.version).toBe("1");
  expect(saved.className).toContain("pmt-annotation-image");
  expect(saved.style).toContain("width: 160px");
  expect(saved.customSize).toBe("keep");

  await page.evaluate(async () => {
    const { openDiagram2RteAnnotationHost } = await import("/js/features/diagram2/diagram2-rte-host-adapter.js?v=20260731-diagram2-rte-interactions-v1");
    const image = document.querySelector("#targetImage");
    const editor = document.querySelector(".rich-editor");
    window.__diagram2EditPromise = openDiagram2RteAnnotationHost({
      image,
      editor,
      source: "/uploads/annotated.svg",
      annotationUrl: "/uploads/annotated.svg",
      originalReference: "/uploads/original.svg",
      annotated: true,
      originalFileName: "original.svg",
      canEdit: true,
      notify: message => window.__diagram2RteNotifications.push(message),
      apply: async () => {}
    });
  });
  await expect(page.locator("[data-diagram2-rte-host]")).toBeVisible();
  const reopened = await page.evaluate(toolbarRectangleId => {
    const controller = window.__pmtDiagram2EditorCore;
    const state = controller.state();
    const imageObject = state.objects.find(object => object.type === "embedded-image" && object.isOriginalImage === true);
    return {
      objectCount: controller.statusSnapshot().objectCount,
      imageId: imageObject?.id,
      imageX: imageObject?.x,
      imageY: imageObject?.y,
      clip: imageObject?.imageClip,
      radius: imageObject?.cropCornerRadius,
      hasOutsideArrow: state.objects.some(object => object.id === "outside-arrow" && object.type === "arrow"),
      hasToolbarRectangle: state.objects.some(object => object.id === toolbarRectangleId && object.type === "rectangle")
    };
  }, toolbarRectangleId);
  expect(reopened.objectCount).toBeGreaterThan(0);
  expect(reopened.imageX).toBe(0);
  expect(reopened.imageY).toBe(0);
  expect(reopened.clip).toEqual({ x: 18, y: 12, width: 284, height: 150 });
  expect(reopened.radius).toBe(25);
  expect(reopened.hasOutsideArrow).toBe(true);
  expect(reopened.hasToolbarRectangle).toBe(true);
  await assertDiagram2RteRouteRelease(page, "Edit Annotation 2.0");
  await page.evaluate(id => {
    window.__pmtDiagram2EditorCore.setSelection([id], { expandGroups: false });
  }, reopened.imageId);
  await page.locator("[data-diagram2-inspector-tab='crop']").click();
  await assertDiagram2RteCropNumericDebounce(page, {
    imageId: reopened.imageId,
    startRadius: 25,
    endRadius: 29
  });
  await ensureDiagram2RteObjectsPaneOpen(page.locator("[data-diagram2-rte-host]"));
  await assertDiagram2RtePhase6EditMapping(page, testInfo);
  await captureDiagram2RtePhase4Screenshot(page, testInfo, "chromium-1920", "diagram2-phase4-rte-edit-1920x1080.png");
  await page.evaluate(id => {
    window.__pmtDiagram2EditorCore.setSelection([id], { expandGroups: false });
  }, reopened.imageId);
  await page.locator("[data-diagram2-inspector-tab='crop']").click();
  await page.locator("[data-diagram2-crop-corner-radius]").fill("31");
  await expect.poll(() => page.evaluate(() =>
    window.__pmtDiagram2Phase6Host.cropAdjustmentDiagnostics().pendingAdjustment
  )).toBe(true);
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.evaluate(() => window.__diagram2EditPromise);
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => ({
    host: window.__pmtDiagram2Phase6Host,
    controller: window.__pmtDiagram2EditorCore,
    renderer: window.__pmtDiagram2Renderer
  }))).toEqual({
    host: null,
    controller: null,
    renderer: null
  });
});

test("Annotation 2.0 keeps RTE pointer movement and drawing responsive on a saved diagram", async ({ page }) => {
  const browserErrors = [];
  page.on("pageerror", error => browserErrors.push(error.message));
  await page.route("**/uploads/rte-performance.svg", route => route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: diagram2RtePerformanceSvg
  }));
  await openDiagram2RteFixture(page);
  await page.setContent(`
    <div class="rich-editor" contenteditable="true">
      <p><img id="targetImage" src="/uploads/rte-performance.svg" alt="Performance fixture"></p>
    </div>
  `);
  await loadDiagram2RteStyles(page);
  await page.evaluate(async () => {
    const { openDiagram2RteAnnotationHost } = await import(
      "/js/features/diagram2/diagram2-rte-host-adapter.js?v=20260731-diagram2-rte-interactions-v1"
    );
    const image = document.querySelector("#targetImage");
    const editor = document.querySelector(".rich-editor");
    window.__diagram2RtePerformancePromise = openDiagram2RteAnnotationHost({
      image,
      editor,
      source: "/uploads/rte-performance.svg",
      annotationUrl: "/uploads/rte-performance.svg",
      originalReference: "/uploads/rte-performance.svg",
      originalFileName: "rte-performance.svg",
      annotated: true,
      canEdit: true,
      loadTemplateLibrary: async () => ({ version: 1, templates: [], defaults: {} }),
      loadDefaultTemplateLibrary: async () => ({ version: 1, templates: [], defaults: {} }),
      saveTemplateLibrary: async library => library,
      apply: async () => {}
    });
  });

  const dialog = page.locator("[data-diagram2-rte-host]");
  await expect(dialog).toBeVisible();
  await expect.poll(() => page.evaluate(() =>
    window.__pmtDiagram2EditorCore?.currentState?.().objects?.length || 0
  )).toBe(diagram2RtePerformanceState.objects.length);

  const setup = await page.evaluate(async () => {
    const controller = window.__pmtDiagram2EditorCore;
    const renderer = window.__pmtDiagram2Renderer;
    const object = controller.createDefaultObject("rectangle", { x: 3600, y: 1500 }, {
      id: "rte-performance-rectangle",
      fill: "#d9ead3"
    });
    await controller.addObject(object, {
      label: "Seed RTE performance rectangle",
      reason: "RTE pointer performance fixture"
    });
    controller.setActiveTool("select");
    controller.setSelection([object.id], { expandGroups: false });
    renderer.focusObjectIds([object.id], {
      scale: 1,
      reason: "RTE pointer performance"
    });
    await renderer.whenInteractive();
    const current = controller.getObjectById(object.id);
    const svg = document.querySelector("[data-diagram2-rte-host] [data-diagram2-svg]");
    return {
      id: object.id,
      x: current.x,
      y: current.y,
      fullRenderCount: Number(svg?.dataset.diagram2FullRenderCount || 0)
    };
  });
  const object = dialog.locator(
    `[data-diagram2-object-plane] [data-diagram2-object-id='${setup.id}']`
  );
  await expect(object).toBeVisible();
  const box = await object.boundingBox();
  const workspaceBox = await dialog.locator("[data-diagram2-workspace]").boundingBox();
  expect(box).toBeTruthy();
  expect(workspaceBox).toBeTruthy();
  const visibleLeft = Math.max(box.x, workspaceBox.x);
  const visibleRight = Math.min(box.x + box.width, workspaceBox.x + workspaceBox.width);
  const startX = visibleLeft + ((visibleRight - visibleLeft) * 0.65);
  const startY = Math.min(box.y + box.height - 2, workspaceBox.y + workspaceBox.height - 2);

  await page.mouse.move(startX, startY);
  await page.evaluate(() => {
    performance.clearMeasures("diagram2 geometry preview");
    window.__diagram2RteMoveStartedAt = performance.now();
  });
  await page.mouse.down();
  await expect.poll(() => page.evaluate(() =>
    window.__pmtDiagram2Renderer.diagnostics().geometryPreviewActive
  )).toBe(true);
  await page.evaluate(() => {
    const svg = document.querySelector("[data-diagram2-rte-host] [data-diagram2-svg]");
    const counts = { records: 0, addedNodes: 0, removedNodes: 0 };
    const observer = new MutationObserver(records => {
      records.forEach(record => {
        counts.records += 1;
        counts.addedNodes += record.addedNodes.length;
        counts.removedNodes += record.removedNodes.length;
      });
    });
    observer.observe(svg, { childList: true, subtree: true });
    window.__diagram2RtePreviewMutationObserver = observer;
    window.__diagram2RtePreviewMutationCounts = counts;
  });
  await page.mouse.move(startX + 54, startY + 32, { steps: 8 });
  const preview = await page.evaluate(async () => {
    const renderer = window.__pmtDiagram2Renderer;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await renderer.whenInteractive();
    window.__diagram2RtePreviewMutationObserver.disconnect();
    const measures = performance.getEntriesByName("diagram2 geometry preview");
    const diagnostics = renderer.diagnostics();
    return {
      durationMs: performance.now() - window.__diagram2RteMoveStartedAt,
      frameDurationMs: Math.max(0, ...measures.map(measure => measure.duration)),
      active: diagnostics.geometryPreviewActive,
      reason: diagnostics.geometryPreviewReason,
      commitCount: diagnostics.geometryPreviewCommitCount,
      undoEntryCount: diagnostics.geometryPreviewUndoEntryCount,
      relationshipCount: diagnostics.geometryPreviewRelationshipCount,
      patchedObjectCount: diagnostics.geometryPreviewPatchedObjectCount,
      mutations: window.__diagram2RtePreviewMutationCounts
    };
  });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(({ id, x, y }) => {
    const current = window.__pmtDiagram2EditorCore.getObjectById(id);
    return current.x !== x || current.y !== y;
  }, setup)).toBe(true);
  const settled = await page.evaluate(async () => {
    const renderer = window.__pmtDiagram2Renderer;
    await renderer.whenInteractive();
    const svg = document.querySelector("[data-diagram2-rte-host] [data-diagram2-svg]");
    return {
      durationMs: performance.now() - window.__diagram2RteMoveStartedAt,
      fullRenderCount: Number(svg?.dataset.diagram2FullRenderCount || 0)
    };
  });

  const beforeDraw = await page.evaluate(() => ({
    objectCount: window.__pmtDiagram2EditorCore.currentState().objects.length,
    fullRenderCount: Number(document.querySelector("[data-diagram2-svg]")?.dataset.diagram2FullRenderCount || 0)
  }));
  await ensureDiagram2RteToolsPaneOpen(dialog);
  await page.evaluate(() => {
    window.__diagram2RteDrawStartedAt = performance.now();
  });
  await dialog.getByRole("button", { name: "Rectangle (R)" }).click();
  await expect.poll(() => page.evaluate(() =>
    window.__pmtDiagram2EditorCore.currentState().objects.length
  ), { timeout: 500 }).toBe(beforeDraw.objectCount + 1);
  const draw = await page.evaluate(async () => {
    await window.__pmtDiagram2Renderer.whenInteractive();
    return {
      durationMs: performance.now() - window.__diagram2RteDrawStartedAt,
      fullRenderCount: Number(document.querySelector("[data-diagram2-svg]")?.dataset.diagram2FullRenderCount || 0)
    };
  });

  console.info("DIAGRAM2_RTE_POINTER_PERFORMANCE", JSON.stringify({ preview, settled, draw, browserErrors }));
  expect(preview.durationMs).toBeLessThan(500);
  expect(preview.frameDurationMs).toBeLessThan(50);
  expect(preview.active).toBe(true);
  expect(preview.reason).toBe("preview move");
  expect(preview.commitCount).toBe(0);
  expect(preview.undoEntryCount).toBe(0);
  expect(preview.relationshipCount).toBe(0);
  expect(preview.patchedObjectCount).toBe(1);
  expect(preview.mutations).toEqual({ records: 0, addedNodes: 0, removedNodes: 0 });
  expect(settled.durationMs).toBeLessThan(500);
  expect(settled.fullRenderCount).toBe(setup.fullRenderCount);
  expect(draw.durationMs).toBeLessThan(500);
  expect(draw.fullRenderCount).toBe(beforeDraw.fullRenderCount);
  expect(browserErrors).toEqual([]);

  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.evaluate(() => window.__diagram2RtePerformancePromise);
});

async function loadDiagram2RteStyles(page) {
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  const styleUrls = [
    "/css/tokens.css",
    "/css/themes.css",
    "/css/base.css",
    "/css/layout.css",
    "/css/components/buttons.css",
    "/css/components/forms.css",
    "/css/components/dialogs.css",
    "/css/components/image-annotation.css",
    "/css/features/diagram.css",
    "/css/features/diagram2.css"
  ];
  for (const url of styleUrls) {
    await page.addStyleTag({ url });
  }
}

async function openDiagram2RteFixture(page) {
  await page.route("**/__diagram2-rte-fixture", route => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: "<!doctype html><html><head><title>Diagram 2 RTE Fixture</title></head><body></body></html>"
  }));
  await page.goto("/__diagram2-rte-fixture");
}

async function captureDiagram2RtePhase4Screenshot(page, testInfo, projectName, fileName) {
  if (testInfo.project.name !== projectName) return;
  const directory = path.join(process.cwd(), "docs", "screenshots", "diagram-2-phase-4");
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: path.join(directory, fileName),
    fullPage: true
  });
}

async function captureDiagram2RtePhase5Screenshot(page, testInfo, projectName, fileName) {
  if (testInfo.project.name !== projectName) return;
  const directory = path.join(process.cwd(), "docs", "screenshots", "diagram-2-phase-5");
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: path.join(directory, fileName),
    fullPage: true
  });
}

async function captureDiagram2RtePhase6Screenshot(page, testInfo, projectName, fileName) {
  if (testInfo.project.name !== projectName) return;
  const directory = path.join(process.cwd(), "docs", "screenshots", "diagram-2-phase-6");
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: path.join(directory, fileName),
    fullPage: false
  });
}

async function assertDiagram2RtePhase6CreateAndCrop(page, testInfo) {
  const result = await page.evaluate(async () => {
    const controller = window.__pmtDiagram2EditorCore;
    const renderer = window.__pmtDiagram2Renderer;
    const image = controller.currentState().objects
      .find(object => object.type === "embedded-image" && object.isOriginalImage === true);
    await controller.updateEmbeddedImageCrop(image.id, {
      imageClip: { x: 18, y: 12, width: 284, height: 150 },
      cropCornerRadius: 10,
      cropVisible: true
    }, {
      reason: "Phase 6 RTE crop"
    });
    await controller.addFieldRectangle(
      { x: 112, y: 82 },
      { id: "rte-phase6-field", name: "RteParentId", width: 128, height: 48 }
    );
    await controller.setFieldRectangleMapping("rte-phase6-field", {
      referencedEntity: "pmt.RtePhase5Parent",
      referencedField: "RteParentId",
      relationshipType: "many-to-one"
    });
    await controller.addFieldMappingTable(image.id, {
      id: "rte-phase6-mapping-table",
      x: 390,
      y: 520
    });
    await controller.setEntityAnnotation(
      "rte-phase5-parent",
      "RTE database mapping target",
      { showArrow: true }
    );
    controller.setSelection([image.id], { expandGroups: false });
    controller.setActiveTool("crop");
    renderer.setCropTarget(image.id);
    await renderer.whenIdle();
    const table = controller.getObjectById("rte-phase6-mapping-table");
    return {
      imageId: image.id,
      clip: controller.getObjectById(image.id).imageClip,
      mappingCount: controller.fieldMappingIndexes().mappingsById.size,
      tableRow: table?.rows?.[0] || null,
      fullRenderCount: renderer.diagnostics().fullRenderCount
    };
  });

  expect(result.clip).toEqual({ x: 18, y: 12, width: 284, height: 150 });
  expect(result.mappingCount).toBeGreaterThan(0);
  expect(result.tableRow).toMatchObject({
    uiEntityId: "rte-phase6-field",
    uiField: "RteParentId",
    databaseField: "pmt.RtePhase5Parent.RteParentId"
  });
  await page.locator("[data-diagram2-inspector-tab='crop']").click();
  await expect(page.locator("[data-diagram2-crop-inset='left']")).toHaveValue("18");
  await assertDiagram2RteCropNumericDebounce(page, {
    imageId: result.imageId,
    startRadius: 10,
    endRadius: 24
  });
  await captureDiagram2RtePhase6Screenshot(
    page,
    testInfo,
    "chromium-1366",
    "diagram2-phase6-rte-annotate-image-crop-1366x768.png"
  );
}

async function assertDiagram2RteCropNumericDebounce(page, options) {
  const radius = page.locator("[data-diagram2-crop-corner-radius]");
  const selection = page.locator(`[data-diagram2-selection-id='${options.imageId}']`);
  const overlay = page.locator("[data-diagram2-crop-overlay]");
  await radius.focus();
  const before = await page.evaluate(() => ({
    history: window.__pmtDiagram2EditorCore.historyStatus().entryCount,
    fullRenders: window.__pmtDiagram2Renderer.diagnostics().fullRenderCount,
    decodes: window.__pmtDiagram2Renderer.diagnostics().decodeCount,
    commits: window.__pmtDiagram2Phase6Host.cropAdjustmentDiagnostics().commitCount
  }));

  await radius.evaluate((control, values) => {
    for (let value = values.start + 1; value <= values.end; value += 1) {
      control.value = String(value);
      control.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, {
    start: options.startRadius,
    end: options.endRadius
  });
  await expect(radius).toHaveValue(String(options.endRadius));
  await expect(selection).toBeHidden();
  await expect(overlay).toBeHidden();
  await page.waitForTimeout(100);
  expect(await page.evaluate(id =>
    window.__pmtDiagram2EditorCore.getObjectById(id)?.cropCornerRadius, options.imageId
  )).toBe(options.startRadius);

  await expect.poll(() => page.evaluate(id =>
    window.__pmtDiagram2EditorCore.getObjectById(id)?.cropCornerRadius, options.imageId
  ), {
    timeout: 500,
    intervals: [25, 50, 75, 100]
  }).toBe(options.endRadius);
  const after = await page.evaluate(() => ({
    history: window.__pmtDiagram2EditorCore.historyStatus().entryCount,
    fullRenders: window.__pmtDiagram2Renderer.diagnostics().fullRenderCount,
    decodes: window.__pmtDiagram2Renderer.diagnostics().decodeCount,
    commits: window.__pmtDiagram2Phase6Host.cropAdjustmentDiagnostics().commitCount
  }));
  expect(after.history).toBe(before.history + 1);
  expect(after.fullRenders).toBe(before.fullRenders);
  expect(after.decodes).toBe(before.decodes);
  expect(after.commits).toBe(before.commits + 1);
  await expect(radius).toBeFocused();
  await expect(selection).toBeHidden();
  await expect(overlay).toBeHidden();
  await expect(selection).toBeVisible({ timeout: 1600 });
  await expect(selection.locator("[data-diagram2-resize-handle]").first()).toBeVisible();
}

async function assertDiagram2RtePhase6EditMapping(page, testInfo) {
  await expect.poll(() => page.evaluate(() =>
    window.__pmtDiagram2EditorCore.currentState().objects
      .some(object => object.id === "rte-phase6-field" && object.entityKind === "field-rectangle")
  )).toBe(true);
  await page.evaluate(async () => {
    const controller = window.__pmtDiagram2EditorCore;
    const renderer = window.__pmtDiagram2Renderer;
    controller.setActiveTool("select");
    controller.setSelection(["rte-phase6-field"], { expandGroups: false });
    renderer.focusObjectIds([
      "rte-phase6-field",
      "rte-phase5-parent",
      "rte-phase6-mapping-table"
    ], {
      scale: 0.9,
      reason: "Phase 6 RTE mapping"
    });
    await renderer.whenIdle();
  });
  await page.locator("[data-diagram2-inspector-tab='entity']").click();
  await expect(page.locator("[data-diagram2-field-rectangle-options]")).toBeVisible();
  await page.locator("[data-action='map-diagram2-field-rectangle']").click();
  await page.locator("[data-diagram2-field-mapping-relationship]").selectOption("one-to-one");
  await page.locator("[data-diagram2-field-mapping-form]")
    .getByRole("button", { name: "Save Mapping" })
    .click();
  await expect.poll(() => page.evaluate(() =>
    window.__pmtDiagram2EditorCore.fieldRectangleMapping("rte-phase6-field")?.relationshipType
  )).toBe("one-to-one");
  await page.locator("[data-diagram2-field-mapping-row]").first().hover();
  await expect(page.locator("[data-diagram2-field-mapping-hover]")).toBeVisible();
  await captureDiagram2RtePhase6Screenshot(
    page,
    testInfo,
    "chromium-1920",
    "diagram2-phase6-rte-edit-field-mapping-1920x1080.png"
  );
}

async function assertDiagram2RtePhase5EntityEditing(page, testInfo) {
  const dialog = page.locator("[data-diagram2-rte-host]");
  const result = await page.evaluate(async () => {
    const controller = window.__pmtDiagram2EditorCore;
    const renderer = window.__pmtDiagram2Renderer;
    await controller.addEntity({
      schema: "pmt",
      name: "RtePhase5",
      fields: [
        { name: "RtePhase5Id", dataType: "int", nullable: false, isPrimaryKey: true, isIdentity: true },
        { name: "ParentRtePhase5Id", dataType: "int", nullable: true, isForeignKey: true },
        { name: "DisplayName", dataType: "nvarchar(80)", nullable: true, isImportant: true }
      ],
      foreignKeysAtTop: true
    }, { x: 180, y: 260 }, { id: "rte-phase5-entity" });
    await controller.addEntity({
      schema: "pmt",
      name: "RtePhase5Parent",
      fields: [
        { name: "RteParentId", dataType: "int", nullable: false, isPrimaryKey: true, isIdentity: true },
        { name: "ParentName", dataType: "nvarchar(80)", nullable: true }
      ]
    }, { x: 620, y: 260 }, { id: "rte-phase5-parent" });
    await controller.setEntityOption("rte-phase5-entity", "showDataTypes", true);
    await controller.addRelationship({
      sourceEntityId: "rte-phase5-entity",
      sourceFieldName: "ParentRtePhase5Id",
      targetEntityId: "rte-phase5-parent",
      targetFieldName: "RteParentId",
      relationshipType: "many-to-one"
    });
    const relationshipId = controller.selectedRelationshipIds()[0];
    await controller.setRelationshipRoutingOptions({ manualEntityRelationshipRoutes: true });
    await controller.useRelationshipRoute(relationshipId);
    let source = controller.getObjectById("rte-phase5-entity");
    const route = source.foreignKeys[0]?.routeOverride || [];
    if (route.length >= 2) {
      const start = route[0];
      const end = route.at(-1);
      const midX = Math.round((start.x + end.x) / 2);
      const manualRoute = [
        start,
        { x: midX, y: start.y },
        { x: midX, y: end.y },
        end
      ];
      const state = controller.currentState();
      controller.setState({
        ...state,
        manualEntityRelationshipRoutes: true,
        objects: state.objects.map(object => object.id === "rte-phase5-entity"
          ? {
              ...object,
              foreignKeys: object.foreignKeys.map((foreignKey, index) =>
                index === 0 ? { ...foreignKey, routeOverride: manualRoute } : foreignKey)
            }
          : object)
      }, { reason: "phase5 RTE seed manual route", resetHistory: false });
      renderer.render(controller.state(), { reason: "phase5 RTE seed manual route" });
      source = controller.getObjectById("rte-phase5-entity");
    }
    await controller.setEntityOption("rte-phase5-entity", "anchorTable", true);
    renderer.fit();
    await renderer.whenIdle();
    window.__diagram2RtePhase5RelationshipId = relationshipId;
    return {
      selectedId: controller.selectedObjectIds()[0],
      relationshipId,
      routePointCount: source.foreignKeys[0]?.routeOverride?.length || 0,
      objectCount: controller.statusSnapshot().objectCount,
      relationshipCount: controller.statusSnapshot().relationshipCount
    };
  });

  expect(result.selectedId).toBe("rte-phase5-entity");
  expect(result.relationshipId).toBeTruthy();
  expect(result.routePointCount).toBeGreaterThan(1);
  expect(result.objectCount).toBeGreaterThan(0);
  expect(result.relationshipCount).toBe(1);
  await dialog.locator("[data-diagram2-inspector-tab='entity']").click();
  await expect(dialog.locator("[data-diagram2-inspector] [data-action='auto-format-diagram2-compact']")).toHaveText("Compact");
  await expect(dialog.locator("[data-diagram2-entity-option='showDataTypes']")).toBeChecked();
  await expect(dialog.locator("[data-diagram2-entity-field-row]")).toHaveCount(3);
  await dialog.locator("[data-action='add-diagram2-entity-field']").click();
  await expect(dialog.locator("[data-diagram2-entity-field-row]")).toHaveCount(4);
  const addedFieldName = dialog.locator("[data-diagram2-entity-field-row][data-diagram2-entity-field-index='3'] [data-diagram2-entity-field-property='name']");
  await addedFieldName.fill("DisplayName");
  await addedFieldName.dispatchEvent("change");
  await expect.poll(() =>
    page.evaluate(() => window.__pmtDiagram2EditorCore.getObjectById("rte-phase5-entity")?.fields?.[3]?.name || "")
  ).toBe("DisplayName2");
  await dialog.locator("[data-diagram2-entity-field-row][data-diagram2-entity-field-index='3'] [data-action='remove-diagram2-entity-field']").click();
  await expect(dialog.locator("[data-diagram2-entity-field-row]")).toHaveCount(3);
  const parentReferenceRow = dialog.locator("[data-diagram2-entity-field-row][data-diagram2-entity-field-index='1']");
  await parentReferenceRow.locator("[data-diagram2-entity-field-reference='targetFieldName']").selectOption("ParentName");
  await expect.poll(() =>
    page.evaluate(() =>
      window.__pmtDiagram2EditorCore.getObjectById("rte-phase5-entity")?.foreignKeys?.[0]?.referencedColumns?.[0] || "")
  ).toBe("ParentName");
  await parentReferenceRow.locator("[data-diagram2-entity-field-reference='targetFieldName']").selectOption("RteParentId");
  await expect.poll(() =>
    page.evaluate(() =>
      window.__pmtDiagram2EditorCore.getObjectById("rte-phase5-entity")?.foreignKeys?.[0]?.referencedColumns?.[0] || "")
  ).toBe("RteParentId");
  await captureDiagram2RtePhase5Screenshot(page, testInfo, "chromium-1366", "diagram2-phase5-rte-entity-editing-1366x768.png");
}

async function assertDiagram2RteRouteRelease(page, hostLabel) {
  const dialog = page.locator("[data-diagram2-rte-host]");
  const activeLeftPaneToggle = dialog.locator(
    "[data-diagram2-left-pane-toggle][aria-pressed='true']"
  );
  if (await activeLeftPaneToggle.count()) {
    await activeLeftPaneToggle.first().click();
  }
  await page.evaluate(async () => {
    const controller = window.__pmtDiagram2EditorCore;
    const renderer = window.__pmtDiagram2Renderer;
    const relationshipId = window.__diagram2RtePhase5RelationshipId;
    controller.setSelection([relationshipId], { expandGroups: false });
    renderer.focusObjectIds(["rte-phase5-entity", "rte-phase5-parent"], {
      scale: 0.9,
      reason: "RTE relationship route release"
    });
    await renderer.whenIdle();
  });
  const handles = dialog.locator("[data-diagram2-relationship-route-handle]");
  const hitTestableHandleIndex = await handles.evaluateAll(nodes =>
    nodes.findIndex(node => {
      const rect = node.getBoundingClientRect();
      const hit = document.elementFromPoint(
        rect.x + (rect.width / 2),
        rect.y + (rect.height / 2)
      );
      return hit === node || node.contains(hit);
    }));
  expect(hitTestableHandleIndex).toBeGreaterThanOrEqual(0);
  const handle = handles.nth(hitTestableHandleIndex);
  await expect(handle).toBeVisible();
  const box = await handle.boundingBox();
  expect(box).toBeTruthy();
  const axis = await handle.getAttribute("data-diagram2-relationship-segment-axis");
  const center = { x: box.x + (box.width / 2), y: box.y + (box.height / 2) };
  const before = await page.evaluate(() => ({
    historyCount: window.__pmtDiagram2EditorCore.historyStatus().entryCount,
    fullRenderCount: window.__pmtDiagram2Renderer.diagnostics().fullRenderCount,
    route: JSON.stringify(
      window.__pmtDiagram2EditorCore.getObjectById("rte-phase5-entity")?.foreignKeys?.[0]?.routeOverride || []
    )
  }));
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(
    center.x + (axis === "x" ? 24 : 0),
    center.y + (axis === "y" ? 24 : 0)
  );
  await expect(dialog.locator("[data-diagram2-relationship-route-preview]")).toHaveCount(1);
  const previewPath = await dialog
    .locator("[data-diagram2-relationship-route-preview]")
    .getAttribute("d");
  await page.mouse.up();
  await expect.poll(() =>
    page.evaluate(() => window.__pmtDiagram2EditorCore.historyStatus().entryCount)
  ).toBe(before.historyCount + 1);
  const result = await page.evaluate(async ({ snapshot, expectedPath }) => {
    const controller = window.__pmtDiagram2EditorCore;
    const renderer = window.__pmtDiagram2Renderer;
    await renderer.whenInteractive();
    await new Promise(resolve => requestAnimationFrame(resolve));
    const diagnostics = controller.diagnostics().lastRouteCommit;
    const relationshipId = window.__diagram2RtePhase5RelationshipId;
    const path = document.querySelector(
      `[data-diagram2-relationship-id="${CSS.escape(relationshipId)}"] [data-diagram2-relationship-path]`
    )?.getAttribute("d") || "";
    return {
      diagnostics,
      historyDelta: controller.historyStatus().entryCount - snapshot.historyCount,
      fullRenderDelta: renderer.diagnostics().fullRenderCount - snapshot.fullRenderCount,
      previewMatchesCommitted: path === expectedPath,
      routeChanged: JSON.stringify(
        controller.getObjectById("rte-phase5-entity")?.foreignKeys?.[0]?.routeOverride || []
      ) !== snapshot.route,
      previewCount: document.querySelectorAll("[data-diagram2-relationship-route-preview]").length
    };
  }, { snapshot: before, expectedPath: previewPath });
  console.info("DIAGRAM2_RTE_ROUTE_RELEASE", JSON.stringify({
    host: hostLabel,
    totalMs: result.diagnostics?.routeCommitTotalMs,
    rendererMs: result.diagnostics?.routeCommitRendererFlushMs
  }));
  expect(result.routeChanged).toBe(true);
  expect(result.previewMatchesCommitted).toBe(true);
  expect(result.previewCount).toBe(0);
  expect(result.historyDelta).toBe(1);
  expect(result.fullRenderDelta).toBe(0);
  expect(result.diagnostics.routeCommitTotalMs).toBeLessThanOrEqual(150);
  expect(result.diagnostics.routeCommitObjectsPatched).toBe(1);
  expect(result.diagnostics.routeCommitRelationshipsConsidered).toBe(1);
  expect(result.diagnostics.routeCommitRelationshipsRerouted).toBe(0);
  expect(result.diagnostics.routeCommitObjectIndexRebuildCount).toBe(0);
  expect(result.diagnostics.routeCommitRelationshipIndexRebuildCount).toBe(0);
  expect(result.diagnostics.routeCommitMappingIndexRebuildCount).toBe(0);
  expect(result.diagnostics.routeCommitAnnotationIndexRebuildCount).toBe(0);
}

async function assertDiagram2RtePhase3CoreEditing(page, rectangleId) {
  const dialog = page.locator("[data-diagram2-rte-host]");
  const baselineCount = await page.evaluate(() => window.__pmtDiagram2EditorCore.currentState().objects.length);

  await dialog.locator("[data-filter='diagram2-grid']").check();
  await dialog.locator("[data-filter='diagram2-snap']").check();
  await expect(dialog.locator("[data-diagram2-grid]")).toBeVisible();
  await expect(dialog.locator("[data-filter='diagram2-grid']")).toBeChecked();
  await expect(dialog.locator("[data-filter='diagram2-snap']")).toBeChecked();
  await dialog.locator("[data-diagram2-workspace]").focus();

  const rectangle = dialog.locator(`[data-diagram2-object-plane] [data-diagram2-object-id='${rectangleId}']`);
  const rectangleBox = await rectangle.boundingBox();
  await rectangle.dispatchEvent("contextmenu", {
    button: 2,
    clientX: rectangleBox.x + (rectangleBox.width / 2),
    clientY: rectangleBox.y + (rectangleBox.height / 2)
  });
  const contextMenu = dialog.locator("[data-diagram2-context-menu]");
  await expect(contextMenu).toBeVisible();
  await expect(contextMenu.locator("[data-action='lock-diagram2-selection']")).toContainText("Lock");
  await expect(contextMenu.locator("[data-action='copy-diagram2-selection-svg']")).toBeEnabled();
  await contextMenu.locator("[data-action='lock-diagram2-selection']").dispatchEvent("click");
  await expect.poll(() => page.evaluate(id =>
    window.__pmtDiagram2EditorCore.getObjectById(id)?.locked, rectangleId
  )).toBe(true);
  await page.keyboard.press("Control+z");
  await expect.poll(() => page.evaluate(id =>
    window.__pmtDiagram2EditorCore.getObjectById(id)?.locked, rectangleId
  )).toBe(false);

  await page.evaluate(id => window.__pmtDiagram2EditorCore.setSelection([id]), rectangleId);
  await page.keyboard.press("Control+d");
  await expect.poll(() => page.evaluate(() => window.__pmtDiagram2EditorCore.currentState().objects.length)).toBe(baselineCount + 1);
  await page.keyboard.press("Delete");
  await expect.poll(() => page.evaluate(() => window.__pmtDiagram2EditorCore.currentState().objects.length)).toBe(baselineCount);
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+z");
  await expect.poll(() => page.evaluate(() => window.__pmtDiagram2EditorCore.currentState().objects.length)).toBe(baselineCount);

  await ensureDiagram2RteToolsPaneOpen(dialog);
  await dialog.locator("[data-diagram2-tool='circle']").click();
  const circleId = await page.evaluate(() => window.__pmtDiagram2EditorCore.selectedObjectIds()[0]);
  await page.evaluate(async ({ rectangleId, circleId }) => {
    const controller = window.__pmtDiagram2EditorCore;
    const renderer = window.__pmtDiagram2Renderer;
    await controller.moveObjects([circleId], 300, 0, { reason: "RTE painter target placement" });
    renderer.fit();
    await renderer.whenIdle();
    controller.setSelection([rectangleId]);
    await controller.updateSelectedObjectsStyle("fill", "#0EA5E9");
  }, { rectangleId, circleId });
  await dialog.locator("[data-diagram2-tool='format-painter']").click();
  await dialog.locator(`[data-diagram2-object-plane] [data-diagram2-object-id='${circleId}']`)
    .dispatchEvent("pointerdown", { button: 0 });
  await expect.poll(() => page.evaluate(id =>
    window.__pmtDiagram2EditorCore.getObjectById(id)?.fill, circleId
  )).toBe("#0EA5E9");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+z");
  await expect.poll(() => page.evaluate(() => window.__pmtDiagram2EditorCore.currentState().objects.length)).toBe(baselineCount);

  await dialog.locator("[data-diagram2-tool='rich-text']").click();
  const richTextId = await page.evaluate(() => window.__pmtDiagram2EditorCore.selectedObjectIds()[0]);
  await page.evaluate(async id => {
    const controller = window.__pmtDiagram2EditorCore;
    const renderer = window.__pmtDiagram2Renderer;
    await controller.moveObjects([id], 340, 220, { reason: "RTE rich text placement" });
    renderer.fit();
    await renderer.whenIdle();
  }, richTextId);
  await dialog.locator(`[data-diagram2-object-plane] [data-diagram2-object-id='${richTextId}']`).dispatchEvent("dblclick");
  await expect(page.locator(".diagram2-text-editor-dialog")).toBeVisible();
  await page.locator("[data-diagram2-rich-text-editor]").evaluate(editor => {
    editor.innerHTML = "<h2>RTE Phase 3</h2><p><strong>Shared editor path</strong></p>";
  });
  await page.locator(".diagram2-text-editor-dialog").getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.locator(".diagram2-text-editor-dialog")).toHaveCount(0);
  await expect.poll(() => page.evaluate(id =>
    window.__pmtDiagram2EditorCore.getObjectById(id)?.html.includes("RTE Phase 3"), richTextId
  )).toBe(true);
  await expect(dialog.locator(`[data-diagram2-object-id='${richTextId}'] .diagram2-renderer-rich-text-surface`)).toContainText("RTE Phase 3");
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+z");
  await expect.poll(() => page.evaluate(() => window.__pmtDiagram2EditorCore.currentState().objects.length)).toBe(baselineCount);

  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+z");
  await expect(dialog.locator("[data-filter='diagram2-grid']")).not.toBeChecked();
  await expect(dialog.locator("[data-filter='diagram2-snap']")).not.toBeChecked();
}

test("Annotate 2.0 cancel performs no upload and leaves RTE image unchanged", async ({ page }) => {
  await page.route("**/uploads/original.svg", route => route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="#ffffff"/></svg>`
  }));

  await openDiagram2RteFixture(page);
  await page.setContent(`
    <div class="rich-editor" contenteditable="true">
      <p><img id="targetImage" src="/uploads/original.svg" alt="Original" style="width: 160px;" data-existing-size="keep"></p>
    </div>
  `);
  const before = await page.locator("#targetImage").evaluate(image => image.outerHTML);

  await page.evaluate(async () => {
    const { openDiagram2RteAnnotationHost } = await import("/js/features/diagram2/diagram2-rte-host-adapter.js?v=20260731-diagram2-rte-interactions-v1");
    const image = document.querySelector("#targetImage");
    window.__diagram2CancelApplyCount = 0;
    window.__diagram2CancelPromise = openDiagram2RteAnnotationHost({
      image,
      editor: document.querySelector(".rich-editor"),
      source: "/uploads/original.svg",
      originalReference: "/uploads/original.svg",
      originalUrl: "/uploads/original.svg",
      originalFileName: "original.svg",
      canEdit: true,
      apply: async () => {
        window.__diagram2CancelApplyCount += 1;
      }
    });
  });

  await expect(page.locator("[data-diagram2-rte-host]")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.evaluate(() => window.__diagram2CancelPromise);

  const after = await page.locator("#targetImage").evaluate(image => ({
    html: image.outerHTML,
    applyCount: window.__diagram2CancelApplyCount
  }));
  expect(after.applyCount).toBe(0);
  expect(after.html).toBe(before);
});

test("Annotate 2.0 cancel cleans up renderer and controller across ten cycles", async ({ page }) => {
  await page.route("**/uploads/original.svg*", route => route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="#ffffff"/></svg>`
  }));

  await openDiagram2RteFixture(page);
  await page.setContent(`
    <div class="rich-editor" contenteditable="true">
      <p><img id="targetImage" src="/uploads/original.svg" alt="Original" style="width: 160px;"></p>
    </div>
  `);

  for (let index = 0; index < 10; index += 1) {
    await page.evaluate(async cycle => {
      const { openDiagram2RteAnnotationHost } = await import("/js/features/diagram2/diagram2-rte-host-adapter.js?v=20260731-diagram2-rte-interactions-v1");
      const image = document.querySelector("#targetImage");
      window.__diagram2RteCyclePromise = openDiagram2RteAnnotationHost({
        image,
        editor: document.querySelector(".rich-editor"),
        source: `/uploads/original.svg?cycle=${cycle}`,
        originalReference: "/uploads/original.svg",
        originalUrl: `/uploads/original.svg?cycle=${cycle}`,
        originalFileName: "original.svg",
        canEdit: true,
        apply: async () => {}
      });
    }, index);

    await expect(page.locator("[data-diagram2-rte-host]")).toBeVisible();
    const openSnapshot = await page.evaluate(() => ({
      dialogCount: document.querySelectorAll("[data-diagram2-rte-host]").length,
      svgCount: document.querySelectorAll("[data-diagram2-rte-host] [data-diagram2-svg]").length,
      rendererLive: Boolean(window.__pmtDiagram2Renderer),
      editorCoreLive: Boolean(window.__pmtDiagram2EditorCore),
      rteHostLive: Boolean(window.__pmtDiagram2RteHost)
    }));
    expect(openSnapshot).toEqual({
      dialogCount: 1,
      svgCount: 1,
      rendererLive: true,
      editorCoreLive: true,
      rteHostLive: true
    });

    await page.locator("[data-diagram2-rte-host]").getByRole("button", { name: "Cancel", exact: true }).click();
    await page.evaluate(() => window.__diagram2RteCyclePromise);
    await waitForDiagram2RteCleanup(page);
    const closeSnapshot = await diagram2RteCleanupSnapshot(page);
    expect(closeSnapshot).toEqual({
      dialogCount: 0,
      svgCount: 0,
      selectionOverlayCount: 0,
      relationshipPreviewCount: 0,
      rendererLive: false,
      editorCoreLive: false,
      rteHostLive: false
    });
  }
});

test("Annotate 2.0 cannot bypass the originating RTE update permission", async ({ page }) => {
  await openDiagram2RteFixture(page);
  await page.setContent(`
    <div class="rich-editor" contenteditable="false" aria-readonly="true">
      <p><img id="targetImage" src="/uploads/original.svg" alt="Original"></p>
    </div>
  `);

  const result = await page.evaluate(async () => {
    const { openDiagram2RteAnnotationHost } = await import("/js/features/diagram2/diagram2-rte-host-adapter.js?v=20260731-diagram2-rte-interactions-v1");
    const image = document.querySelector("#targetImage");
    const notifications = [];
    let applyCount = 0;
    const opened = await openDiagram2RteAnnotationHost({
      image,
      editor: document.querySelector(".rich-editor"),
      source: "/uploads/original.svg",
      originalReference: "/uploads/original.svg",
      canEdit: false,
      security: Object.freeze({
        resource: "Documentation",
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        canImport: false,
        canExport: true
      }),
      notify: message => notifications.push(message),
      apply: async () => {
        applyCount += 1;
      }
    });
    return {
      opened,
      applyCount,
      notifications,
      dialogCount: document.querySelectorAll("[data-diagram2-rte-host]").length,
      src: image.getAttribute("src") || ""
    };
  });

  expect(result.opened).toBeNull();
  expect(result.applyCount).toBe(0);
  expect(result.dialogCount).toBe(0);
  expect(result.src).toBe("/uploads/original.svg");
  expect(result.notifications).toContain("You do not have permission to edit this content.");
});

test("D1 and D2 physically round-trip Phase 6 RTE metadata in both directions", async ({ page }) => {
  test.setTimeout(90_000);
  await page.route("**/uploads/phase6-roundtrip-original.svg", route => route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="#f8fafc"/></svg>`
  }));
  await openDiagram2RteFixture(page);
  await page.setContent(`
    <div class="rich-editor" contenteditable="true">
      <p><img id="targetImage" src="/uploads/phase6-roundtrip-original.svg" alt="Phase 6 roundtrip" style="width: 320px;"></p>
    </div>
  `);
  await loadDiagram2RteStyles(page);

  const d1FirstState = phase6RteRoundtripState("d1-first");
  await openD1RoundtripHost(page, buildAnnotationSvg(d1FirstState), "d1First");
  await assertD1RoundtripHost(page, "d1-first");
  await applyD1RoundtripHost(page, "d1First");
  const d1SavedSvg = await roundtripSavedSvg(page, "d1First");
  assertPhase6RteRoundtripSvg(d1SavedSvg, "d1-first", "D1FirstId");

  await openD2RoundtripHost(page, d1SavedSvg, "d1ToD2", { annotated: true });
  await assertD2RoundtripHost(page, "d1-first");
  await page.evaluate(async () => {
    await window.__pmtDiagram2EditorCore.renameFieldRectangle("d1-first-field", "D1ToD2Id");
  });
  await applyD2RoundtripHost(page, "d1ToD2");
  const d1ToD2Svg = await roundtripSavedSvg(page, "d1ToD2");
  assertPhase6RteRoundtripSvg(d1ToD2Svg, "d1-first", "D1ToD2Id");

  await openD1RoundtripHost(page, d1ToD2Svg, "d1Reopen");
  await assertD1RoundtripHost(page, "d1-first", "D1ToD2Id");
  await cancelD1RoundtripHost(page, "d1Reopen");

  const d2FirstState = phase6RteRoundtripState("d2-first");
  await openD2RoundtripHost(page, "", "d2First", {
    annotated: false,
    initialState: d2FirstState
  });
  await assertD2RoundtripHost(page, "d2-first");
  await applyD2RoundtripHost(page, "d2First");
  const d2SavedSvg = await roundtripSavedSvg(page, "d2First");
  assertPhase6RteRoundtripSvg(d2SavedSvg, "d2-first", "D2FirstId");

  await openD1RoundtripHost(page, d2SavedSvg, "d2ToD1");
  await assertD1RoundtripHost(page, "d2-first");
  await applyD1RoundtripHost(page, "d2ToD1");
  const d2ToD1Svg = await roundtripSavedSvg(page, "d2ToD1");
  assertPhase6RteRoundtripSvg(d2ToD1Svg, "d2-first", "D2FirstId");

  await openD2RoundtripHost(page, d2ToD1Svg, "d2Reopen", { annotated: true });
  await assertD2RoundtripHost(page, "d2-first");
  await cancelD2RoundtripHost(page, "d2Reopen");
});

async function waitForDiagram2RteCleanup(page) {
  await page.evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function openD1RoundtripHost(page, svg, key) {
  await page.evaluate(({ markup, storageKey }) => {
    void (async () => {
      const annotation = await import("/js/components/image-annotation.js?v=20260731-rte-checkbox-layout-v2");
      const image = document.querySelector("#targetImage");
      const annotationUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
      window[`__${storageKey}Promise`] = annotation.openImageAnnotationDialog({
        annotationUrl,
        originalReference: "/uploads/phase6-roundtrip-original.svg",
        originalFileName: "phase6-roundtrip.svg",
        canvasWidth: 1600,
        canvasHeight: 900,
        fixedOriginalImage: true,
        persistOutputBoundsInMetadata: true,
        initialSelection: "none",
        title: "Phase 6 physical D1 roundtrip",
        applyLabel: "Apply to RTE",
        confirm: async () => true,
        notify: () => {},
        apply: async result => {
          window[`__${storageKey}Svg`] = result.svg;
          image.setAttribute(
            "src",
            `data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.svg)}`
          );
          image.dataset.pmtAnnotationVersion = String(result.state.version || 1);
        }
      });
    })();
  }, { markup: svg, storageKey: key });
  await expect(page.locator("dialog.image-annotation-dialog")).toBeVisible();
}

async function openD2RoundtripHost(page, svg, key, options = {}) {
  await page.evaluate(({ markup, storageKey, annotated, initialState }) => {
    void (async () => {
      const { openDiagram2RteAnnotationHost } = await import(
        "/js/features/diagram2/diagram2-rte-host-adapter.js?v=20260731-diagram2-rte-interactions-v1"
      );
      const image = document.querySelector("#targetImage");
      const editor = document.querySelector(".rich-editor");
      const annotationUrl = markup
        ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
        : "";
      const source = annotated
        ? annotationUrl
        : "/uploads/phase6-roundtrip-original.svg";
      window[`__${storageKey}Promise`] = openDiagram2RteAnnotationHost({
        image,
        editor,
        source,
        annotationUrl,
        originalUrl: annotated ? "" : source,
        originalReference: "/uploads/phase6-roundtrip-original.svg",
        originalFileName: "phase6-roundtrip.svg",
        annotated,
        canEdit: true,
        confirm: async () => true,
        notify: () => {},
        restoreFocus: () => image.focus({ preventScroll: true }),
        apply: async result => {
          window[`__${storageKey}Svg`] = result.svg;
          image.setAttribute(
            "src",
            `data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.svg)}`
          );
          image.dataset.pmtAnnotationVersion = String(result.state.version || 1);
        }
      });
      if (initialState) {
        await new Promise(resolve => {
          const wait = () => {
            if (window.__pmtDiagram2EditorCore && window.__pmtDiagram2Renderer) {
              resolve();
              return;
            }
            requestAnimationFrame(wait);
          };
          wait();
        });
        window.__pmtDiagram2EditorCore.setState(initialState, {
          resetHistory: true,
          saved: false,
          reason: "physical D2 annotate fixture"
        });
        window.__pmtDiagram2Renderer.render(
          window.__pmtDiagram2EditorCore.currentState(),
          { reason: "physical D2 annotate fixture" }
        );
      }
    })();
  }, {
    markup: svg,
    storageKey: key,
    annotated: options.annotated === true,
    initialState: options.initialState || null
  });
  await expect(page.locator("[data-diagram2-rte-host]")).toBeVisible();
  if (options.initialState) {
    await expect.poll(() => page.evaluate(() =>
      window.__pmtDiagram2EditorCore?.currentState?.().objects.length || 0
    )).toBe(options.initialState.objects.length);
  }
}

async function assertD1RoundtripHost(page, prefix, expectedUiField = "") {
  const uiField = expectedUiField || roundtripFieldName(prefix);
  const dialog = page.locator("dialog.image-annotation-dialog");
  const canvas = dialog.locator("[data-annotation-canvas]");
  await expect(canvas.locator(`[data-annotation-object-id='${prefix}-image']`)).toHaveAttribute("clip-path", /.+/);
  await expect(canvas.locator(`[data-annotation-object-id='${prefix}-field']`)).toBeVisible();
  await expect(canvas.locator(`[data-annotation-object-id='${prefix}-entity']`)).toBeVisible();
  await expect(canvas.locator(`[data-annotation-object-id='${prefix}-table']`)).toContainText(uiField);
  const uiCell = canvas.locator(
    `[data-annotation-object-id='${prefix}-table'] [data-annotation-field-mapping-cell='true'][data-annotation-field-mapping-cell-kind='ui']`
  );
  await uiCell.click();
  await expect(canvas.locator("[data-annotation-field-mapping-attention-arrow]")).toHaveCount(2);
}

async function assertD2RoundtripHost(page, prefix) {
  await expect.poll(() => page.evaluate(id =>
    Boolean(window.__pmtDiagram2EditorCore?.getObjectById?.(id)), `${prefix}-table`
  )).toBe(true);
  const host = page.locator("[data-diagram2-rte-host]");
  const uiCell = host.locator(
    `[data-diagram2-object-id='${prefix}-table'] [data-diagram2-field-mapping-cell='true'][data-diagram2-field-mapping-cell-kind='ui']`
  );
  await uiCell.click();
  await expect(host.locator("[data-diagram2-field-mapping-attention-arrow]")).toHaveCount(2);
  const stateEvidence = await page.evaluate(idPrefix => {
    const state = window.__pmtDiagram2EditorCore.currentState();
    const image = state.objects.find(object => object.id === `${idPrefix}-image`);
    const field = state.objects.find(object => object.id === `${idPrefix}-field`);
    const table = state.objects.find(object => object.id === `${idPrefix}-table`);
    return {
      imageClip: image?.imageClip,
      relationshipType: field?.foreignKeys?.[0]?.relationshipType,
      tableStyle: {
        headerFill: table?.headerFill,
        uiFill: table?.uiFill,
        databaseFill: table?.databaseFill,
        fieldMappingRowHoverFill: table?.fieldMappingRowHoverFill
      },
      annotationChildren: state.objects.filter(object =>
        object.entityAnnotationOwnerId === `${idPrefix}-entity`).length
    };
  }, prefix);
  expect(stateEvidence.imageClip).toEqual({
    x: 84,
    y: 124,
    width: 588,
    height: 360
  });
  expect(stateEvidence.relationshipType).toBe("many-to-one");
  expect(stateEvidence.tableStyle).toEqual({
    headerFill: "#dbeafe",
    uiFill: "#f8fafc",
    databaseFill: "#ffffff",
    fieldMappingRowHoverFill: "#fef08a"
  });
  expect(stateEvidence.annotationChildren).toBeGreaterThanOrEqual(1);
}

async function applyD1RoundtripHost(page, key) {
  await page.locator("dialog.image-annotation-dialog")
    .getByRole("button", { name: "Apply to RTE", exact: true })
    .first()
    .click();
  await page.evaluate(storageKey => window[`__${storageKey}Promise`], key);
  await expect(page.locator("dialog.image-annotation-dialog")).toHaveCount(0);
}

async function cancelD1RoundtripHost(page, key) {
  await page.locator("dialog.image-annotation-dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .first()
    .click();
  await page.evaluate(storageKey => window[`__${storageKey}Promise`], key);
  await expect(page.locator("dialog.image-annotation-dialog")).toHaveCount(0);
}

async function applyD2RoundtripHost(page, key) {
  await page.locator("[data-diagram2-rte-host]")
    .getByRole("button", { name: "Apply to RTE", exact: true })
    .click();
  await page.evaluate(storageKey => window[`__${storageKey}Promise`], key);
  await expect(page.locator("[data-diagram2-rte-host]")).toHaveCount(0);
}

async function cancelD2RoundtripHost(page, key) {
  await page.locator("[data-diagram2-rte-host]")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await page.evaluate(storageKey => window[`__${storageKey}Promise`], key);
  await expect(page.locator("[data-diagram2-rte-host]")).toHaveCount(0);
}

async function roundtripSavedSvg(page, key) {
  const svg = await page.evaluate(storageKey => window[`__${storageKey}Svg`] || "", key);
  expect(svg).toContain("data-pmt-image-annotation-state");
  expect(svg).not.toContain("field-mapping-attention-arrow");
  return svg;
}

async function ensureDiagram2RteToolsPaneOpen(scope) {
  const main = scope.locator("[data-diagram2-editor-main]").first();
  const isOpen = await main.evaluate(element => element.classList.contains("is-tools-open")).catch(() => false);
  if (isOpen) return;
  await scope.getByRole("button", { name: "Tools", exact: true }).first().click();
  await expect(main).toHaveClass(/is-tools-open/);
  await expect(scope.locator("[data-diagram2-tools-pane]").first()).toBeVisible();
}

async function ensureDiagram2RteObjectsPaneOpen(scope) {
  const main = scope.locator("[data-diagram2-editor-main]").first();
  const isOpen = await main.evaluate(element => element.classList.contains("is-objects-open")).catch(() => false);
  if (isOpen) return;
  await scope.getByRole("button", { name: "Objects", exact: true }).first().click();
  await expect(main).toHaveClass(/is-objects-open/);
  await expect(scope.locator("[data-diagram2-objects-pane]").first()).toBeVisible();
}

async function ensureDiagram2RteTemplatesPaneOpen(scope) {
  const main = scope.locator("[data-diagram2-editor-main]").first();
  const isOpen = await main.evaluate(element => element.classList.contains("is-templates-open")).catch(() => false);
  if (isOpen) return;
  await scope.getByRole("button", { name: "Templates", exact: true }).first().click();
  await expect(main).toHaveClass(/is-templates-open/);
  await expect(scope.locator("[data-diagram2-template-pane]").first()).toBeVisible();
}

async function assertDiagram2RteObjectTreeDoubleClickFocus(page) {
  const row = page.locator("[data-diagram2-rte-host] [data-diagram2-object-tree-row][data-diagram2-object-id='rte-rect']").first();
  await expect(row).toBeVisible();
  const before = await page.evaluate(async () => {
    const renderer = window.__pmtDiagram2Renderer;
    renderer.panBy(-120, -80);
    await renderer.whenIdle();
    const svg = document.querySelector("[data-diagram2-rte-host] [data-diagram2-svg]");
    return {
      translateX: Number(svg?.dataset.diagram2ViewportTranslateX || 0),
      translateY: Number(svg?.dataset.diagram2ViewportTranslateY || 0)
    };
  });
  await row.dblclick();
  await expect.poll(() => page.evaluate(() =>
    document.querySelector("[data-diagram2-rte-host] [data-diagram2-svg]")?.dataset.diagram2ViewportReason
  )).toBe("object tree focus");
  const after = await page.evaluate(() => {
    const svg = document.querySelector("[data-diagram2-rte-host] [data-diagram2-svg]");
    return {
      translateX: Number(svg?.dataset.diagram2ViewportTranslateX || 0),
      translateY: Number(svg?.dataset.diagram2ViewportTranslateY || 0),
      selectedCount: window.__pmtDiagram2EditorCore.selectedObjectIds().length
    };
  });
  expect(after.selectedCount).toBeGreaterThan(0);
  expect(after.translateX !== before.translateX || after.translateY !== before.translateY).toBe(true);
}

async function assertDiagram2RteToolbarObjectInsertion(page) {
  const before = await page.evaluate(() => {
    const svg = document.querySelector("[data-diagram2-svg]");
    return {
      fullRenderCount: Number(svg?.dataset.diagram2FullRenderCount || 0),
      objectCount: window.__pmtDiagram2EditorCore.currentState().objects.length,
      objectNodeCount: document.querySelectorAll("[data-diagram2-object-plane] [data-diagram2-object-id]").length
    };
  });

  const dialog = page.locator("[data-diagram2-rte-host]");
  await ensureDiagram2RteToolsPaneOpen(dialog);
  await dialog.getByRole("button", { name: "Rectangle (R)" }).click();
  await expect.poll(() =>
    page.evaluate(() => window.__pmtDiagram2EditorCore.currentState().objects.length)
  ).toBe(before.objectCount + 1);

  const afterAdd = await page.evaluate(async beforeSnapshot => {
    const controller = window.__pmtDiagram2EditorCore;
    const renderer = window.__pmtDiagram2Renderer;
    const svg = document.querySelector("[data-diagram2-svg]");
    await renderer.whenIdle();
    const selectedId = controller.selectedObjectIds()[0];
    const object = controller.getObjectById(selectedId);
    const row = document.querySelector(`[data-diagram2-object-tree-row][data-diagram2-object-id="${CSS.escape(selectedId)}"]`);
    return {
      selectedId,
      selectedType: object?.type,
      dirty: controller.historyStatus().dirty,
      fullRenderCount: Number(svg?.dataset.diagram2FullRenderCount || 0),
      objectCount: controller.currentState().objects.length,
      objectNodeDelta: document.querySelectorAll("[data-diagram2-object-plane] [data-diagram2-object-id]").length
        - beforeSnapshot.objectNodeCount,
      objectTreeRowExists: Boolean(row),
      objectTreeRowSelected: row?.classList.contains("is-selected") === true
    };
  }, before);

  expect(afterAdd.selectedId).toMatch(/^rectangle-/);
  expect(afterAdd.selectedType).toBe("rectangle");
  expect(afterAdd.dirty).toBe(true);
  expect(afterAdd.fullRenderCount).toBe(before.fullRenderCount);
  expect(afterAdd.objectCount).toBe(before.objectCount + 1);
  expect(afterAdd.objectNodeDelta).toBe(1);
  expect(afterAdd.objectTreeRowExists).toBe(true);
  expect(afterAdd.objectTreeRowSelected).toBe(true);

  await page.locator("[data-action='undo-diagram2']").click();
  await expect.poll(() =>
    page.evaluate(beforeCount => window.__pmtDiagram2EditorCore.currentState().objects.length === beforeCount, before.objectCount)
  ).toBe(true);
  const afterUndo = await page.evaluate(async beforeSnapshot => {
    const controller = window.__pmtDiagram2EditorCore;
    const renderer = window.__pmtDiagram2Renderer;
    const svg = document.querySelector("[data-diagram2-svg]");
    await renderer.whenIdle();
    return {
      dirty: controller.historyStatus().dirty,
      fullRenderCount: Number(svg?.dataset.diagram2FullRenderCount || 0),
      objectNodeCount: document.querySelectorAll("[data-diagram2-object-plane] [data-diagram2-object-id]").length
    };
  }, before);
  expect(afterUndo.dirty).toBe(false);
  expect(afterUndo.fullRenderCount).toBe(before.fullRenderCount);
  expect(afterUndo.objectNodeCount).toBe(before.objectNodeCount);

  await page.locator("[data-action='redo-diagram2']").click();
  await expect.poll(() =>
    page.evaluate(beforeCount => window.__pmtDiagram2EditorCore.currentState().objects.length === beforeCount + 1, before.objectCount)
  ).toBe(true);
  const afterRedo = await page.evaluate(async beforeSnapshot => {
    const controller = window.__pmtDiagram2EditorCore;
    const renderer = window.__pmtDiagram2Renderer;
    const svg = document.querySelector("[data-diagram2-svg]");
    await renderer.whenIdle();
    const selectedId = controller.selectedObjectIds()[0];
    return {
      selectedId,
      selectedType: controller.getObjectById(selectedId)?.type,
      dirty: controller.historyStatus().dirty,
      fullRenderCount: Number(svg?.dataset.diagram2FullRenderCount || 0),
      objectNodeCount: document.querySelectorAll("[data-diagram2-object-plane] [data-diagram2-object-id]").length
    };
  }, before);
  expect(afterRedo.selectedType).toBe("rectangle");
  expect(afterRedo.dirty).toBe(true);
  expect(afterRedo.fullRenderCount).toBe(before.fullRenderCount);
  expect(afterRedo.objectNodeCount).toBe(before.objectNodeCount + 1);
  await expect(dialog.locator("[data-diagram2-inspector-tab='rectangle']")).toBeVisible();
  await dialog.locator("[data-diagram2-inspector-tab='rectangle']").click();
  await setDiagram2RteControlValue(dialog.locator("[data-diagram2-geometry='width']").first(), "180");
  await setDiagram2RteControlValue(dialog.locator("[data-diagram2-geometry='height']").first(), "180");
  await expect.poll(() => page.evaluate(id => {
    const object = window.__pmtDiagram2EditorCore.getObjectById(id);
    return object ? { width: object.width, height: object.height } : null;
  }, afterRedo.selectedId)).toEqual({ width: 180, height: 180 });
  return afterRedo.selectedId;
}

async function setDiagram2RteControlValue(locator, value) {
  await locator.evaluate((element, nextValue) => {
    element.value = String(nextValue);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, String(value));
}

async function diagram2RteCleanupSnapshot(page) {
  return page.evaluate(() => ({
    dialogCount: document.querySelectorAll("[data-diagram2-rte-host]").length,
    svgCount: document.querySelectorAll("[data-diagram2-rte-host] [data-diagram2-svg]").length,
    selectionOverlayCount: document.querySelectorAll("[data-diagram2-rte-host] [data-diagram2-selection-id]").length,
    relationshipPreviewCount: document.querySelectorAll("[data-diagram2-rte-host] [data-diagram2-relationship-preview-id]").length,
    rendererLive: Boolean(window.__pmtDiagram2Renderer),
    editorCoreLive: Boolean(window.__pmtDiagram2EditorCore),
    rteHostLive: Boolean(window.__pmtDiagram2RteHost)
  }));
}

function phase6RteRoundtripState(prefix) {
  const image = {
    ...createDiagram2EmbeddedImage({
      id: `${prefix}-image`,
      name: `${prefix} screenshot`,
      source: roundtripImageDataUrl(),
      x: 60,
      y: 100,
      width: 640,
      height: 400,
      isOriginalImage: true
    }),
    imageClip: { x: 84, y: 124, width: 588, height: 360 },
    cropCornerRadius: 12,
    cropVisible: true
  };
  const entity = {
    id: `${prefix}-entity`,
    type: "entity",
    x: 980,
    y: 130,
    width: 320,
    height: 190,
    entitySchema: "pmt",
    entityName: `${roundtripPascalPrefix(prefix)}Target`,
    fields: [
      {
        name: "TargetId",
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
  const field = setDiagram2FieldRectangleMapping(createDiagram2FieldRectangle({
    id: `${prefix}-field`,
    name: roundtripFieldName(prefix),
    x: 250,
    y: 255,
    width: 190,
    height: 62
  }), {
    referencedEntity: `pmt.${entity.entityName}`,
    referencedField: "TargetId",
    relationshipType: "many-to-one"
  });
  let state = normalizeAnnotationState({
    version: 1,
    width: 1600,
    height: 900,
    objects: [image, entity, field]
  });
  const annotationPlan = createDiagram2EntityAnnotationPlan(
    state,
    entity.id,
    `${roundtripPascalPrefix(prefix)} target annotation`,
    { showArrow: true }
  );
  if (annotationPlan) {
    const replacedIds = new Set(annotationPlan.beforeObjects.map(object => object.id));
    state = normalizeAnnotationState({
      ...state,
      objects: [
        ...state.objects.filter(object => !replacedIds.has(object.id)),
        ...annotationPlan.afterObjects
      ],
      groupNames: {
        ...state.groupNames,
        ...annotationPlan.afterGroupNames
      },
      groupVisibility: {
        ...state.groupVisibility,
        ...annotationPlan.afterGroupVisibility
      }
    });
  }
  const table = createDiagram2FieldMappingTable(
    state,
    image.id,
    {
      id: `${prefix}-table`,
      x: 900,
      y: 520,
      indexes: createDiagram2FieldMappingIndexes(state.objects),
      style: {
        headerFill: "#dbeafe",
        uiFill: "#f8fafc",
        databaseFill: "#ffffff",
        fieldMappingRowHoverFill: "#fef08a",
        fieldMappingHighlightColor: "#facc15",
        fieldMappingHighlightStrokeWidth: 9
      }
    }
  );
  return normalizeAnnotationState({
    ...state,
    objects: [...state.objects, table]
  });
}

function assertPhase6RteRoundtripSvg(svg, prefix, expectedUiField) {
  const state = parseAnnotationSvg(svg);
  const image = state.objects.find(object => object.id === `${prefix}-image`);
  const field = state.objects.find(object => object.id === `${prefix}-field`);
  const table = state.objects.find(object => object.id === `${prefix}-table`);
  expect(image).toMatchObject({
    imageClip: { x: 84, y: 124, width: 588, height: 360 },
    cropCornerRadius: 12,
    cropVisible: true
  });
  expect(field).toBeTruthy();
  expect(field.foreignKeys?.[0]).toMatchObject({
    columns: [expectedUiField],
    referencedColumns: ["TargetId"],
    relationshipType: "many-to-one"
  });
  expect(table).toMatchObject({
    headerFill: "#dbeafe",
    uiFill: "#f8fafc",
    databaseFill: "#ffffff",
    fieldMappingRowHoverFill: "#fef08a"
  });
  expect(table.rows?.[0]).toMatchObject({
    uiEntityId: `${prefix}-field`,
    uiField: expectedUiField
  });
  expect(state.objects.filter(object =>
    object.entityAnnotationOwnerId === `${prefix}-entity`).length
  ).toBeGreaterThanOrEqual(1);
}

function roundtripFieldName(prefix) {
  return `${roundtripPascalPrefix(prefix)}Id`;
}

function roundtripPascalPrefix(prefix) {
  return String(prefix || "")
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map(value => `${value.charAt(0).toUpperCase()}${value.slice(1)}`)
    .join("");
}

function roundtripImageDataUrl() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><rect width="640" height="400" fill="#e0f2fe"/><rect x="100" y="80" width="440" height="240" fill="#ffffff" stroke="#175fbd" stroke-width="4"/><text x="320" y="210" text-anchor="middle" font-family="Arial" font-size="28" fill="#172b4d">Phase 6 roundtrip</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}
