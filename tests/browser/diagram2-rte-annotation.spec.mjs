import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

test.use({ timezoneId: "Asia/Taipei" });

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
    const { openDiagram2RteAnnotationHost } = await import("/js/features/diagram2/diagram2-rte-host-adapter.js?v=20260730-diagram2-phase6-v1");
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
    const { openDiagram2RteAnnotationHost } = await import("/js/features/diagram2/diagram2-rte-host-adapter.js?v=20260730-diagram2-phase6-v1");
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
      imageX: imageObject?.x,
      imageY: imageObject?.y,
      clip: imageObject?.imageClip,
      hasOutsideArrow: state.objects.some(object => object.id === "outside-arrow" && object.type === "arrow"),
      hasToolbarRectangle: state.objects.some(object => object.id === toolbarRectangleId && object.type === "rectangle")
    };
  }, toolbarRectangleId);
  expect(reopened.objectCount).toBeGreaterThan(0);
  expect(reopened.imageX).toBe(0);
  expect(reopened.imageY).toBe(0);
  expect(reopened.clip).toEqual({ x: 18, y: 12, width: 284, height: 150 });
  expect(reopened.hasOutsideArrow).toBe(true);
  expect(reopened.hasToolbarRectangle).toBe(true);
  await ensureDiagram2RteObjectsPaneOpen(page.locator("[data-diagram2-rte-host]"));
  await assertDiagram2RtePhase6EditMapping(page, testInfo);
  await captureDiagram2RtePhase4Screenshot(page, testInfo, "chromium-1920", "diagram2-phase4-rte-edit-1920x1080.png");
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.evaluate(() => window.__diagram2EditPromise);
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
  await captureDiagram2RtePhase6Screenshot(
    page,
    testInfo,
    "chromium-1366",
    "diagram2-phase6-rte-annotate-image-crop-1366x768.png"
  );
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
    const { openDiagram2RteAnnotationHost } = await import("/js/features/diagram2/diagram2-rte-host-adapter.js?v=20260730-diagram2-phase6-v1");
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
      const { openDiagram2RteAnnotationHost } = await import("/js/features/diagram2/diagram2-rte-host-adapter.js?v=20260730-diagram2-phase6-v1");
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
    const { openDiagram2RteAnnotationHost } = await import("/js/features/diagram2/diagram2-rte-host-adapter.js?v=20260730-diagram2-phase6-v1");
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

async function waitForDiagram2RteCleanup(page) {
  await page.evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
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
