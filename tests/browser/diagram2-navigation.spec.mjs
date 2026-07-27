import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  buildAnnotationSvg,
  normalizeAnnotationState,
  parseAnnotationSvg
} from "../../wwwroot/js/components/image-annotation.js";
import { releaseNotes } from "../../wwwroot/js/shared/release-notes-data.js";

test.use({ timezoneId: "Asia/Taipei" });

test("Diagram 2 top navigation separates read-only document mode from Edit mode", async ({ page }) => {
  const browserErrors = [];
  page.on("console", message => {
    if (message.type() === "error" && !message.text().includes("status of 401")) browserErrors.push(message.text());
  });
  page.on("pageerror", error => browserErrors.push(error.message));
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

  await page.addInitScript(seenToken => {
    localStorage.clear();
    localStorage.setItem("pmt-release-notes-last-seen:1", seenToken);
    localStorage.setItem("pmt-release-notes-last-seen:2", seenToken);
    localStorage.setItem("pmt-diagram2-diagnostics-visible", "true");
    localStorage.setItem("pmt-rich-last-colors", JSON.stringify(["#123456", "#654321"]));
    localStorage.setItem("pmt-rich-last-color-hiliteColor", "#123456");
  }, releaseNotes[0].seenToken);

  await page.route("**/api/session", route => route.fulfill(jsonResponse({ error: "Unauthorized" }, 401)));
  await page.route("**/api/login", route => route.fulfill(jsonResponse({
    userId: 1,
    nickname: "Sin",
    isAdmin: true,
    role: "Admin"
  })));
  await page.route("**/api/state", route => route.fulfill(jsonResponse(testState())));
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

  await openNavigationScreen(page, "Diagram");
  await expect(page).toHaveURL(/#\/diagram$/);
  await expect(page.locator(".diagram-screen")).toBeVisible();
  await assertDiagram1PngDownloadFallback(page);
  const diagramDocumentIds = await page.locator("[data-diagram-tree-row]").evaluateAll(rows =>
    rows.map(row => row.dataset.id).sort());

  await openNavigationScreen(page, "Diagram 2");
  await expect(page).toHaveURL(/#\/diagram-2$/);
  await expect(page.locator("[data-diagram2-screen]")).toBeVisible();
  await expect(page.locator(".diagram-screen[data-diagram2-screen]")).toBeVisible();
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "readonly");
  await expect(page.locator("[data-diagram2-screen] h1")).toHaveText("Diagram 2");
  await expect(page.locator("[data-diagram2-page-document-head]")).toBeVisible();
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-file-format", "pmt-diagram");
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-file-format-version", "1");
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-selection-clipboard-format", "pmt-diagram-selection");
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-selection-clipboard-version", "1");
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-template-library-endpoint", "/api/image-annotation/template-library");
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-default-template-library-endpoint", "/api/image-annotation/default-template-library");
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-persisted-renderer-caches", "false");
  await expect(page.locator("[data-diagram2-tree-row] [data-action='select-diagram2-document']")).toHaveCount(2);
  const diagram2DocumentIds = await page.locator("[data-diagram2-tree-row]").evaluateAll(rows =>
    rows.map(row => row.dataset.id).sort());
  expect(diagram2DocumentIds).toEqual(diagramDocumentIds);
  await expect(page.locator("[data-diagram2-page-document-head] h2")).toHaveText("PMT Database Schema");
  await expect(page.locator("[data-diagram2-page-document-head]")).toContainText("Public Diagram");
  await expect(page.locator("[data-diagram2-readonly-shell]")).toBeVisible();
  await expect(page.getByRole("button", { name: "Fit Diagram" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Diagram" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Info" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Public Link" })).toBeVisible();
  await page.getByRole("button", { name: "Edit Info", exact: true }).click();
  await expect(page.locator("#editorDialog")).toBeVisible();
  await expect(page.locator("#dialogTitle")).toHaveText("Edit Diagram Info");
  await expect(page.locator("#editorDialog [name='title']")).toHaveValue("PMT Database Schema");
  await page.locator("#editorDialog").getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("#editorDialog")).not.toBeVisible();
  const firstDiagram2TreeRow = page.locator("[data-diagram2-tree-row][data-id='42']");
  const firstDiagram2TreeBox = await firstDiagram2TreeRow.boundingBox();
  expect(firstDiagram2TreeBox).toBeTruthy();
  await page.mouse.click(firstDiagram2TreeBox.x + 42, firstDiagram2TreeBox.y + 16, { button: "right" });
  await expect(page.locator("[data-diagram2-tree-context-menu]")).toBeVisible();
  await page.locator("[data-diagram2-tree-context-menu] [data-action='edit-diagram2-info']").click();
  await expect(page.locator("#editorDialog")).toBeVisible();
  await expect(page.locator("#dialogTitle")).toHaveText("Edit Diagram Info");
  await page.locator("#editorDialog").getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("#editorDialog")).not.toBeVisible();
  await expect(page.locator("[data-diagram2-editor-shell]")).toHaveCount(0);
  await expect(page.locator(".diagram2-editor-toolbar")).toHaveCount(0);
  await expect(page.locator("[data-diagram2-objects-pane]")).toHaveCount(0);
  await expect(page.locator("[data-diagram2-inspector]")).toHaveCount(0);
  await expect(page.locator("[data-diagram2-diagnostics-shell]")).toHaveCount(1);
  await expect(page.locator("[data-action='undo-diagram2']")).toHaveCount(0);
  await expect(page.locator("[data-action='redo-diagram2']")).toHaveCount(0);
  await expect(page.locator("[data-action='save-diagram2-document']")).toHaveCount(0);
  await expect(page.locator("[data-filter='diagram2-grid']")).toHaveCount(0);
  await expect(page.locator("[data-filter='diagram2-snap']")).toHaveCount(0);
  await expect(page.locator("[data-diagram2-context-menu]")).toHaveCount(0);
  await expect(page.locator("[data-diagram2-svg]")).toBeVisible();
  await assertDiagram2CanvasCopyMenu(page, {
    copyToClipboard: true,
    verifyDeniedPngFallback: true
  });
  const readZoomControl = page.locator("[data-filter='diagram2-zoom']");
  await waitForViewportReason(page, "fit");
  await expect.poll(async () => readZoomControl.inputValue()).not.toBe("");
  const readZoomBefore = Number(await readZoomControl.inputValue());
  await page.locator("[data-action='zoom-diagram2-in']").click();
  await expect(readZoomControl).toHaveValue(nextDiagram2TestZoomValue(readZoomBefore, 1));
  await page.locator("[data-action='fit-diagram2-viewer']").click();
  await waitForViewportReason(page, "fit");
  await expect.poll(async () => readZoomControl.inputValue()).not.toBe("");
  const readFitZoom = Number(await readZoomControl.inputValue());
  await page.locator("[data-action='zoom-diagram2-out']").click();
  await expect(readZoomControl).toHaveValue(nextDiagram2TestZoomValue(readFitZoom, -1));
  await assertDiagram2ReadOnlyCannotMutate(page);
  const compatibilitySummary = await page.evaluate(() => window.__pmtDiagram2Compatibility);
  expect(compatibilitySummary).toMatchObject({
    feature: "Diagram 2",
    fileFormat: "pmt-diagram",
    fileFormatVersion: 1,
    selectionClipboardFormat: "pmt-diagram-selection",
    selectionClipboardVersion: 1,
    endpoints: {
      templateLibrary: "/api/image-annotation/template-library",
      defaultTemplateLibrary: "/api/image-annotation/default-template-library"
    },
    persistedRendererCaches: false
  });
  expect(compatibilitySummary.fileObjectCount).toBeUndefined();
  expect(compatibilitySummary.selectionClipboardObjectCount).toBeUndefined();
  await expect.poll(async () =>
    page.locator("[data-diagram2-object-plane] [data-diagram2-object-type='entity']").count()
  ).toBeGreaterThanOrEqual(28);
  await page.getByRole("button", { name: "Cards" }).click();
  await expect(page.locator(".diagram2-card-list")).toBeVisible();
  await expect(page.locator("[data-diagram2-tree]")).toHaveCount(0);
  await expect(page.locator("[data-diagram2-viewer-host]")).toHaveCount(0);
  await page.getByRole("button", { name: "Treeview" }).click();
  await expect(page.locator("[data-diagram2-tree-row] [data-action='select-diagram2-document']")).toHaveCount(2);
  await expect(page.locator("[data-diagram2-readonly-shell]")).toBeVisible();

  await page.getByRole("button", { name: "Edit Diagram" }).click();
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "edit");
  await expect(page.locator("[data-diagram2-screen] h1")).toHaveCount(0);
  await expect(page.locator("[data-diagram2-page-document-head]")).toHaveCount(0);
  await expect(page.locator("[data-diagram2-tree]")).toHaveCount(0);
  await expect(page.locator(".diagram2-card-list")).toHaveCount(0);
  await expect(page.locator("[data-diagram2-live-viewer]")).toHaveAttribute("data-diagram2-live-mode", "edit");
  await expect(page.locator("[data-diagram2-editor-shell]")).toBeVisible();
  await expect(page.locator(".diagram2-editor-toolbar")).toBeVisible();
  await expect(page.locator("[data-diagram2-objects-pane]")).toHaveCount(1);
  await expect(page.locator("[data-diagram2-inspector]")).toBeVisible();
  await expect(page.locator("[data-diagram2-diagnostics-shell]")).toHaveCount(1);
  await expect(page.locator("[data-action='undo-diagram2']")).toHaveCount(1);
  await expect(page.locator("[data-action='redo-diagram2']")).toHaveCount(1);
  await expect(page.locator("[data-action='save-diagram2-document']")).toHaveCount(1);
  await expect(page.locator("[data-action='cancel-diagram2-editor']")).toHaveCount(1);
  await expect(page.locator("[data-diagram2-tool='select']")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-diagram2-tool='pan']")).toHaveAttribute("aria-pressed", "false");
  await assertDiagram2EditModeCursor(page);
  await assertDiagram2CanvasCopyMenu(page);
  await expect(page.locator("[data-diagram2-empty-selection]")).toBeVisible();
  await expect(page.locator("[data-diagram2-selection-format]").first()).toBeHidden();
  const visibleInspectorTabs = await page.locator("[data-diagram2-inspector-tab]").evaluateAll(tabs =>
    tabs.filter(tab => !tab.hidden).map(tab => tab.textContent.trim()));
  expect(visibleInspectorTabs).toEqual(["Format", "Template", "Objects"]);
  await assertDiagram2InspectorTabsDoNotOverlap(page);
  await page.locator("[data-diagram2-inspector-tab='template']").click();
  await expect(page.locator("[data-diagram2-inspector-tab='template']")).toHaveAttribute("aria-selected", "true");
  await page.locator("[data-diagram2-inspector-tab='objects']").click();
  await expect(page.locator("[data-diagram2-inspector-tab='objects']")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("[data-diagram2-objects-pane]")).toBeVisible();
  await page.locator("[data-diagram2-object-tree-row][data-diagram2-object-type='entity']").first().click();
  await page.locator("[data-diagram2-inspector-tab='format']").click();
  await expect(page.locator("[data-diagram2-empty-selection]")).toBeHidden();
  await expect(page.locator("[data-diagram2-selection-format]").first()).toBeVisible();
  await expect(page.locator("[data-diagram2-inspector-tab='entity']")).toBeVisible();
  await assertDiagram2ColorPickerBehavior(page);
  await assertDiagram2FormatControlsBehavior(page);
  await assertDiagram2ResizeBehavior(page);
  const editZoomControl = page.locator("[data-filter='diagram2-zoom']");
  const editZoomBefore = await editZoomControl.inputValue();
  const editCanvasBox = await page.locator("[data-diagram2-viewer-canvas]").boundingBox();
  expect(editCanvasBox).toBeTruthy();
  await page.mouse.move(editCanvasBox.x + editCanvasBox.width / 2, editCanvasBox.y + editCanvasBox.height / 2);
  await page.mouse.wheel(0, -120);
  await expect.poll(async () => (await editZoomControl.inputValue()) !== editZoomBefore).toBe(true);
  await expect.poll(() => page.evaluate(() => Boolean(window.__pmtDiagram2EditorCore))).toBe(true);
  await expect(page.locator("[data-diagram2-diagnostic='canonical-object-count']")).toHaveText("88");
  await expect(page.locator("[data-diagram2-diagnostic='canonical-relationship-count']")).toHaveText("78");
  await expect(page.locator("[data-diagram2-diagnostic='mounted-relationship-count']")).toHaveText("78");
  await expect(page.locator("[data-diagram2-diagnostic='full-render-reason']")).toHaveText("initial");
  await expect.poll(async () => Number(await page.locator("[data-diagram2-diagnostic='svg-descendant-count']").textContent()))
    .toBeGreaterThan(0);
  await assertDiagram2ToolbarObjectInsertion(page);
  await assertDiagram2RichTextEditorParity(page);
  await assertDiagram2ObjectContextMenuParity(page);

  await page.evaluate(() => {
    window.__diagram2StableSvg = document.querySelector("[data-diagram2-svg]");
    window.__diagram2StableEntity = document.querySelector("[data-diagram2-object-plane] [data-diagram2-object-type='entity']");
    window.__diagram2StableText = window.__diagram2StableEntity?.querySelector("text") || null;
  });

  const transformOnlyRenderCount = await diagram2FullRenderCount(page);
  await assertKeyedDiagram2NodePatches(page, transformOnlyRenderCount);
  await assertDiagram2LiveGeometryPreview(page, transformOnlyRenderCount);
  await assertDiagram2SelectiveRoutingStress(page);
  await assertDiagram2ViewportHaloVirtualization(page);
  await assertDiagram2LowDetailOverviewRendering(page);
  for (const zoom of ["0.1", "0.5", "0.75", "1", "1.25", "1.5", "2"]) {
    await assertTransformOnlyZoom(page, zoom, transformOnlyRenderCount);
  }
  await assertTransformOnlyPan(page, transformOnlyRenderCount);
  await assertCursorCenteredWheelZoom(page, transformOnlyRenderCount);

  await page.getByRole("button", { name: "Fit Diagram" }).click();
  await waitForViewportReason(page, "fit");
  await expect.poll(() =>
    page.evaluate(() => document.querySelector("[data-diagram2-svg]") === window.__diagram2StableSvg)
  ).toBe(true);
  await page.locator("[data-diagram2-diagnostics-shell] summary").click();
  await page.getByRole("button", { name: "Refresh Renderer" }).click();
  await waitForViewportReason(page, "fit");
  await expect.poll(() =>
    page.evaluate(() => document.querySelector("[data-diagram2-svg]") === window.__diagram2StableSvg)
  ).toBe(true);
  await expect(page.locator("[data-diagram2-diagnostic='full-render-reason']")).toHaveText("refresh");
  await expect(page.locator("[data-action='save-diagram2-document']").first()).toBeDisabled();
  await expect(page.locator(".diagram-screen[data-diagram2-screen]")).toBeVisible();
  await expect(page.locator(".diagram-screen:not([data-diagram2-screen])")).toHaveCount(0);

  await page.goBack();
  await expect(page).toHaveURL(/#\/diagram$/);
  await expect(page.locator(".diagram-screen")).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/#\/diagram-2$/);
  await expect(page.locator("[data-diagram2-screen]")).toBeVisible();
  await expect(page.locator(".diagram-screen[data-diagram2-screen]")).toBeVisible();
  await expect(page.locator(".diagram-screen:not([data-diagram2-screen])")).toHaveCount(0);

  await page.locator("[data-action='select-diagram2-document'][data-id='77']").click();
  await expect(page).toHaveURL(/#\/diagram-2\/77$/);
  await waitForViewportReason(page, "fit");
  await expect(page.locator("[data-diagram2-page-document-head] h2")).toHaveText("Checkout Flow");
  await expect(page.locator("[data-diagram2-tree-row][data-id='77']")).toHaveClass(/is-selected/);
  await expect(page.locator(".diagram-screen[data-diagram2-screen]")).toBeVisible();

  await page.evaluate(() => {
    window.location.hash = "#/diagram-2/42";
  });
  await expect(page).toHaveURL(/#\/diagram-2\/42$/);
  await expect(page.locator("[data-diagram2-screen]")).toBeVisible();
  await expect(page.locator("[data-diagram2-page-document-head] h2")).toHaveText("PMT Database Schema");
  await expect(page.locator(".diagram-screen[data-diagram2-screen]")).toBeVisible();

  await page.evaluate(() => {
    window.location.hash = "#/diagram-2/9999";
  });
  await expect(page).toHaveURL(/#\/diagram-2\/42$/);
  await expect(page.locator("[data-diagram2-page-document-head] h2")).toHaveText("PMT Database Schema");
  await expect(page.getByText("Diagram not found")).toHaveCount(0);
  await expect(page.locator("[data-diagram2-tree-row][data-id='42']")).toHaveClass(/is-selected/);

  await openNavigationScreen(page, "Settings");
  await page.locator("[data-action='select-lookup-type'][data-type='Navigation']").click();
  await expect(page.locator("[data-navigation-list] [data-nav-view='Diagram 2']")).toContainText("#/diagram-2");
  await dragNavigationItemBefore(page, "Diagram 2", "Log");
  const navigationOrder = await page.locator("[data-navigation-list] [data-nav-view]").evaluateAll(rows =>
    rows.map(row => row.dataset.navView));
  expect(navigationOrder.indexOf("Diagram 2")).toBe(navigationOrder.indexOf("Diagram") + 1);
  expect(navigationOrder.indexOf("Log")).toBe(navigationOrder.indexOf("Diagram 2") + 1);
  const savedNavigationOrder = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("pmt-navigation") || "{}").items?.map(item => item.view) || []);
  expect(savedNavigationOrder.indexOf("Diagram 2")).toBe(savedNavigationOrder.indexOf("Diagram") + 1);
  expect(savedNavigationOrder.indexOf("Log")).toBe(savedNavigationOrder.indexOf("Diagram 2") + 1);

  expect(browserErrors).toEqual([]);
});

test("Diagram 2 Phase 3 core editor interactions stay incremental", async ({ page }, testInfo) => {
  const browserErrors = [];
  page.on("console", message => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", error => browserErrors.push(error.message));

  await page.goto("/css/base.css");
  await page.setContent(`
    <link rel="stylesheet" href="/css/tokens.css">
    <link rel="stylesheet" href="/css/base.css">
    <link rel="stylesheet" href="/css/components/buttons.css">
    <link rel="stylesheet" href="/css/components/forms.css">
    <link rel="stylesheet" href="/css/components/dialogs.css">
    <link rel="stylesheet" href="/css/components/image-annotation.css">
    <link rel="stylesheet" href="/css/features/diagram2.css">
    <main id="phase3Harness" style="width:100vw;height:100vh;display:grid;"></main>
  `);
  await page.evaluate(async () => {
    const [
      controllerModule,
      interactionModule,
      rendererModule,
      shellModule
    ] = await Promise.all([
      import("/js/features/diagram2/diagram2-editor-controller.js?v=20260727-diagram2-phase3-final-v2"),
      import("/js/features/diagram2/diagram2-editor-interactions.js?v=20260727-diagram2-phase3-final-v2"),
      import("/js/features/diagram2/diagram2-renderer.js?v=20260727-diagram2-phase3-final-v2"),
      import("/js/features/diagram2/diagram2-editor-shell.js?v=20260727-diagram2-phase3-final-v2")
    ]);
    const state = {
      version: 1,
      width: 1000,
      height: 620,
      gridSize: 20,
      objects: [
        { id: "rect-a", type: "rectangle", x: 80, y: 80, width: 180, height: 110, fill: "#f8fafc", stroke: "#172b4d", strokeWidth: 3, opacity: 1 },
        { id: "circle-a", type: "circle", x: 340, y: 80, width: 150, height: 150, fill: "#dbeafe", stroke: "#1d4ed8", strokeWidth: 3, opacity: 1 },
        { id: "text-a", type: "textbox", x: 80, y: 300, width: 260, height: 120, text: "Phase 3 text", fill: "#ffffff", stroke: "#334155", strokeWidth: 2, textColor: "#172b4d", fontFamily: "Arial", fontSize: 24, textAlign: "left", textVerticalAlign: "top" },
        { id: "rich-a", type: "rich-text", x: 430, y: 300, width: 390, height: 180, html: "<h2>Phase 3 Rich Text</h2><p><strong>Persistent</strong> PMT formatting.</p>", fill: "#ffffff", stroke: "#64748b", strokeWidth: 2, textColor: "#172b4d", fontFamily: "Arial", fontSize: 16 },
        { id: "line-a", type: "line", x1: 560, y1: 110, x2: 770, y2: 190, stroke: "#334155", strokeWidth: 4, opacity: 1 },
        { id: "arrow-a", type: "arrow", x1: 560, y1: 230, x2: 790, y2: 240, stroke: "#0f766e", strokeWidth: 4, arrowSize: 24, opacity: 1 }
      ]
    };
    const root = document.querySelector("#phase3Harness");
    const host = {
      kind: "diagram-document",
      canEdit: true,
      canExport: true,
      security: {
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
        canImport: true,
        canExport: true
      },
      async save() {}
    };
    const controller = controllerModule.createDiagram2EditorController({ host, state });
    root.innerHTML = shellModule.diagram2EditorShellHtml({
      state: controller.state(),
      selectedObjectIds: [],
      status: controller.statusSnapshot()
    });
    const renderer = rendererModule.createDiagram2Renderer({
      host: root.querySelector("[data-diagram2-renderer-surface]")
    });
    renderer.render(controller.state(), { reason: "phase3 browser harness" });
    renderer.setZoom("1");
    controller.attachRenderer(renderer);

    const sync = () => {
      const status = controller.statusSnapshot();
      const selected = new Set(status.selectedObjectIds);
      shellModule.updateDiagram2ShellStatus(root, {
        ...status,
        selectedObjects: controller.state().objects.filter(object => selected.has(object.id))
      });
      shellModule.updateDiagram2ObjectTreeSelection(root, status.selectedObjectIds);
    };
    const finish = async () => {
      await renderer.whenIdle();
      sync();
    };
    const addObject = async type => {
      const object = controllerModule.createDiagram2DefaultObject(type, { x: 500, y: 260 });
      await controller.addObject(object);
      await finish();
      return object.id;
    };
    const copy = async () => {
      globalThis.__pmtDiagramSelectionClipboard = controller.selectionClipboardText();
      return true;
    };
    const paste = async () => {
      await controller.pasteSelectionClipboardText(globalThis.__pmtDiagramSelectionClipboard || "");
      await finish();
    };
    const duplicate = async () => {
      await controller.duplicateSelectedObjects();
      await finish();
    };
    const remove = async () => {
      await controller.deleteSelectedObjects();
      await finish();
    };
    const abortController = new AbortController();
    interactionModule.bindDiagram2EditorInteractions({
      root,
      canvas: root.querySelector("[data-diagram2-viewer-canvas]"),
      controller,
      renderer,
      signal: abortController.signal,
      isActive: () => true,
      canMutate: () => true,
      onStateChange: sync,
      onAddObject: addObject,
      onCopy: copy,
      onPaste: paste,
      onDuplicate: duplicate,
      onDelete: remove,
      onUndo: async () => { await controller.undo(); await finish(); },
      onRedo: async () => { await controller.redo(); await finish(); },
      onEditText: async object => {
        await controller.updateObjectText(
          object.id,
          object.type === "rich-text"
            ? "<h2>Edited Rich Text</h2><p><strong>Bold</strong> and <em>italic</em>.</p>"
            : "Edited Phase 3 text"
        );
        await finish();
      }
    });
    controller.onChange(sync);
    sync();
    globalThis.__diagram2Phase3Harness = {
      controller,
      renderer,
      abortController,
      sync,
      finish
    };
  });

  const canvas = page.locator("[data-diagram2-viewer-canvas]");
  await expect(canvas).toHaveAttribute("data-diagram2-active-tool", "select");
  const fullRenderCount = await page.locator("[data-diagram2-svg]").getAttribute("data-diagram2-full-render-count");

  await page.evaluate(async () => {
    const { controller, finish } = window.__diagram2Phase3Harness;
    controller.setSelection(["rect-a"]);
    await finish();
  });
  await expect(page.locator("[data-diagram2-selection-id='rect-a']")).toBeVisible();
  await page.locator("[data-diagram2-object-plane] [data-diagram2-object-id='circle-a']").click({ modifiers: ["Shift"] });
  await expect.poll(() => page.evaluate(() =>
    window.__diagram2Phase3Harness.controller.selectedObjectIds().length
  )).toBe(2);

  const marqueeBounds = await page.evaluate(() => {
    const first = document.querySelector("[data-diagram2-object-plane] [data-diagram2-object-id='rect-a']").getBoundingClientRect();
    const second = document.querySelector("[data-diagram2-object-plane] [data-diagram2-object-id='circle-a']").getBoundingClientRect();
    return {
      left: Math.min(first.left, second.left) - 8,
      top: Math.min(first.top, second.top) - 8,
      right: Math.max(first.right, second.right) + 8,
      bottom: Math.max(first.bottom, second.bottom) + 8
    };
  });
  await page.mouse.move(marqueeBounds.left, marqueeBounds.top);
  await page.mouse.down();
  await page.mouse.move(marqueeBounds.right, marqueeBounds.bottom, { steps: 5 });
  await expect(page.locator("[data-diagram2-marquee]")).toBeVisible();
  const marqueeBox = await page.locator("[data-diagram2-marquee]").boundingBox();
  expect(Math.abs(marqueeBox.x - marqueeBounds.left)).toBeLessThanOrEqual(2);
  expect(Math.abs(marqueeBox.y - marqueeBounds.top)).toBeLessThanOrEqual(2);
  await page.mouse.up();
  await expect(page.locator("[data-diagram2-marquee]")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() =>
    window.__diagram2Phase3Harness.controller.selectedObjectIds().includes("rect-a")
      && window.__diagram2Phase3Harness.controller.selectedObjectIds().includes("circle-a")
  )).toBe(true);

  const rectBeforeMove = await page.evaluate(() => {
    const object = window.__diagram2Phase3Harness.controller.getObjectById("rect-a");
    return { x: object.x, y: object.y };
  });
  const rectBox = await page.locator("[data-diagram2-object-plane] [data-diagram2-object-id='rect-a']").boundingBox();
  await page.mouse.move(rectBox.x + 30, rectBox.y + 30);
  await page.mouse.down();
  await page.mouse.move(rectBox.x + 75, rectBox.y + 55, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(before => {
    const object = window.__diagram2Phase3Harness.controller.getObjectById("rect-a");
    return object.x !== before.x && object.y !== before.y;
  }, rectBeforeMove)).toBe(true);

  await page.evaluate(async () => {
    const { controller, finish } = window.__diagram2Phase3Harness;
    controller.setSelection(["rect-a"]);
    await finish();
  });
  const widthBefore = await page.evaluate(() => window.__diagram2Phase3Harness.controller.getObjectById("rect-a").width);
  const eastHandle = page.locator("[data-diagram2-selection-id='rect-a'] [data-diagram2-resize-handle='e']");
  const handleBox = await eastHandle.boundingBox();
  await page.mouse.move(handleBox.x + (handleBox.width / 2), handleBox.y + (handleBox.height / 2));
  await page.mouse.down();
  await page.mouse.move(handleBox.x + 50, handleBox.y + (handleBox.height / 2), { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(width =>
    window.__diagram2Phase3Harness.controller.getObjectById("rect-a").width > width, widthBefore
  )).toBe(true);

  const cancelledPosition = await page.evaluate(() => {
    const object = window.__diagram2Phase3Harness.controller.getObjectById("rect-a");
    return { x: object.x, y: object.y };
  });
  const movedRectBox = await page.locator("[data-diagram2-object-plane] [data-diagram2-object-id='rect-a']").boundingBox();
  await page.mouse.move(movedRectBox.x + 20, movedRectBox.y + 20);
  await page.mouse.down();
  await page.mouse.move(movedRectBox.x + 80, movedRectBox.y + 50, { steps: 3 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(await page.evaluate(() => {
    const object = window.__diagram2Phase3Harness.controller.getObjectById("rect-a");
    return { x: object.x, y: object.y };
  })).toEqual(cancelledPosition);

  await page.evaluate(async () => {
    const { controller, finish } = window.__diagram2Phase3Harness;
    await controller.setGridVisible(true);
    await controller.setSnapToGrid(true);
    await finish();
  });
  await expect(page.locator("[data-diagram2-grid]")).toBeVisible();
  await expect(page.locator("[data-filter='diagram2-grid']")).toBeChecked();
  await expect(page.locator("[data-filter='diagram2-snap']")).toBeChecked();

  await page.evaluate(async () => {
    const { controller, finish } = window.__diagram2Phase3Harness;
    controller.setSelection(["rect-a"]);
    await controller.updateSelectedObjectsStyle("fill", "#DC2626");
    controller.beginFormatPainter();
    await finish();
  });
  await page.locator("[data-diagram2-object-plane] [data-diagram2-object-id='circle-a']").click();
  await expect.poll(() => page.evaluate(() =>
    window.__diagram2Phase3Harness.controller.getObjectById("circle-a").fill
  )).toBe("#DC2626");
  await page.keyboard.press("Escape");

  await page.locator("[data-diagram2-object-plane] [data-diagram2-object-id='text-a']").dblclick();
  await expect.poll(() => page.evaluate(() =>
    window.__diagram2Phase3Harness.controller.getObjectById("text-a").text
  )).toBe("Edited Phase 3 text");
  await page.locator("[data-diagram2-object-plane] [data-diagram2-object-id='rich-a']").dispatchEvent("dblclick");
  await expect.poll(() => page.evaluate(() =>
    window.__diagram2Phase3Harness.controller.getObjectById("rich-a").html.includes("Edited Rich Text")
  )).toBe(true);
  await expect(page.locator("[data-diagram2-object-plane] [data-diagram2-object-id='rich-a'] foreignObject .diagram2-renderer-rich-text-surface")).toContainText("Edited Rich Text");

  const beforeTools = await page.evaluate(() => window.__diagram2Phase3Harness.controller.currentState().objects.length);
  for (const key of ["r", "o", "a", "l", "t", "y"]) await page.keyboard.press(key);
  await expect.poll(() => page.evaluate(() =>
    window.__diagram2Phase3Harness.controller.currentState().objects.length
  )).toBe(beforeTools + 6);
  expect(await page.evaluate(() => {
    const objects = window.__diagram2Phase3Harness.controller.currentState().objects.slice(-6);
    return objects.map(object => object.type);
  })).toEqual(["rectangle", "circle", "arrow", "line", "textbox", "rich-text"]);

  await page.keyboard.press("Control+a");
  await expect.poll(() => page.evaluate(() => {
    const controller = window.__diagram2Phase3Harness.controller;
    return controller.selectedObjectIds().length === controller.currentState().objects.length;
  })).toBe(true);
  await page.evaluate(() => window.__diagram2Phase3Harness.controller.setSelection(["rect-a"]));
  await page.keyboard.press("Control+c");
  const beforeClipboard = await page.evaluate(() => window.__diagram2Phase3Harness.controller.currentState().objects.length);
  await page.keyboard.press("Control+v");
  await expect.poll(() => page.evaluate(() =>
    window.__diagram2Phase3Harness.controller.currentState().objects.length
  )).toBe(beforeClipboard + 1);
  await page.keyboard.press("Control+d");
  await expect.poll(() => page.evaluate(() =>
    window.__diagram2Phase3Harness.controller.currentState().objects.length
  )).toBe(beforeClipboard + 2);
  await page.keyboard.press("Delete");
  await expect.poll(() => page.evaluate(() =>
    window.__diagram2Phase3Harness.controller.currentState().objects.length
  )).toBe(beforeClipboard + 1);
  await page.keyboard.press("Control+z");
  await expect.poll(() => page.evaluate(() =>
    window.__diagram2Phase3Harness.controller.currentState().objects.length
  )).toBe(beforeClipboard + 2);
  await page.keyboard.press("Control+y");
  await expect.poll(() => page.evaluate(() =>
    window.__diagram2Phase3Harness.controller.currentState().objects.length
  )).toBe(beforeClipboard + 1);

  await page.evaluate(async () => {
    const { controller, finish } = window.__diagram2Phase3Harness;
    controller.setSelection(["circle-a"]);
    await controller.updateSelectedObjectsStyle("strokeWidth", 9, { reason: "mixed inspector test" });
    controller.setSelection(["rect-a", "circle-a"]);
    await finish();
  });
  await expect(page.locator("[data-diagram2-style='strokeWidth']").first()).toHaveAttribute("data-diagram2-mixed-value", "true");
  await expect(page.locator("[data-annotation-color-picker='fill'] [data-annotation-color-trigger]").first()).toBeEnabled();

  const contextBox = await page.locator("[data-diagram2-object-plane] [data-diagram2-object-id='rect-a']").boundingBox();
  await page.mouse.click(contextBox.x + 20, contextBox.y + 20, { button: "right" });
  await expect(page.locator("[data-diagram2-context-menu]")).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(page.locator("[data-diagram2-svg]")).toHaveAttribute("data-diagram2-full-render-count", fullRenderCount);
  await mkdir(path.join(process.cwd(), "docs", "screenshots", "diagram-2-phase-3"), { recursive: true });
  await page.screenshot({
    path: path.join(process.cwd(), "docs", "screenshots", "diagram-2-phase-3", `${testInfo.project.name}.png`),
    fullPage: true
  });

  await page.evaluate(() => {
    window.__diagram2Phase3Harness.abortController.abort();
    window.__diagram2Phase3Harness.renderer.destroy();
    window.__diagram2Phase3Harness.controller.destroy();
    window.__diagram2Phase3Harness = null;
  });
  expect(browserErrors).toEqual([]);
});

test("Diagram 2 direct URLs inherit Documentation read-only capabilities and block mutations", async ({ page }) => {
  const browserErrors = [];
  page.on("console", message => {
    if (message.type() === "error" && !message.text().includes("status of 401")) browserErrors.push(message.text());
  });
  page.on("pageerror", error => browserErrors.push(error.message));

  await page.addInitScript(seenToken => {
    localStorage.clear();
    localStorage.setItem("pmt-release-notes-last-seen:1", seenToken);
    localStorage.setItem("pmt-release-notes-last-seen:2", seenToken);
  }, releaseNotes[0].seenToken);

  await page.route("**/api/session", route => route.fulfill(jsonResponse({ error: "Unauthorized" }, 401)));
  await page.route("**/api/login", route => route.fulfill(jsonResponse({
    userId: 2,
    nickname: "Reader",
    isAdmin: false,
    role: "Developer"
  })));
  await page.route("**/api/state", route => route.fulfill(jsonResponse(readOnlyState())));
  await page.route("**/api/audit-trail", route => route.fulfill(jsonResponse([])));
  await page.route("**/api/maintenance/recycle-bin", route => route.fulfill(jsonResponse([])));
  await page.route("**/api/maintenance/orphan-files", route => route.fulfill(jsonResponse({
    files: [],
    totalCount: 0,
    totalByteLength: 0
  })));

  await page.goto("/");
  await page.locator("#loginName").fill("Reader");
  await page.locator("#loginPassword").fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();

  await page.evaluate(() => {
    window.location.hash = "#/diagram-2/77";
  });
  await expect(page.locator("[data-diagram2-screen]")).toBeVisible();
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "readonly");
  await expect(page.locator("[data-diagram2-page-document-head] h2")).toHaveText("Public Read-Only Diagram");
  await expect(page.locator("[data-diagram2-object-plane] [data-diagram2-object-id='public-read-only-diagram-box']")).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Diagram" })).toBeDisabled();
  await expect(page.locator("[data-diagram2-editor-shell]")).toHaveCount(0);

  const before = await page.evaluate(() => ({
    x: Number(document.querySelector("[data-diagram2-object-plane] [data-diagram2-object-id='public-read-only-diagram-box']")?.dataset.diagram2ObjectTransformX || 0),
    editorCoreLive: Boolean(window.__pmtDiagram2EditorCore)
  }));
  expect(before.editorCoreLive).toBe(false);
  await expect(page.locator("[data-action='save-diagram2-document']")).toHaveCount(0);
  await expect(page.locator("[data-action='export-diagram2-pmt']").first()).toBeEnabled();

  await page.locator("[data-diagram2-object-plane] [data-diagram2-object-id='public-read-only-diagram-box']").click({ position: { x: 10, y: 10 } });
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Delete");
  await page.keyboard.press("Control+Z");
  await page.keyboard.press("Control+Y");
  const programmaticMove = await page.evaluate(() =>
    window.__pmtDiagram2EditorCore?.moveSelectedObjects?.(10, 0, { reason: "direct test" }) ?? "no-editor-core");
  const after = await page.evaluate(() => ({
    x: Number(document.querySelector("[data-diagram2-object-plane] [data-diagram2-object-id='public-read-only-diagram-box']")?.dataset.diagram2ObjectTransformX || 0),
    editorCoreLive: Boolean(window.__pmtDiagram2EditorCore),
    selectionOverlays: document.querySelectorAll("[data-diagram2-selection-id]").length
  }));

  expect(programmaticMove).toBe("no-editor-core");
  expect(after.x).toBe(before.x);
  expect(after.editorCoreLive).toBe(false);
  expect(after.selectionOverlays).toBe(0);
  expect(browserErrors).toEqual([]);
});

test("Diagram 2 New creates a shared Diagram document and opens it in Edit mode", async ({ page }) => {
  const browserErrors = [];
  let apiState = testState();
  let createdPayload = null;
  let uploadedSvg = "";

  page.on("console", message => {
    if (message.type() === "error" && !message.text().includes("status of 401")) browserErrors.push(message.text());
  });
  page.on("pageerror", error => browserErrors.push(error.message));

  await page.addInitScript(seenToken => {
    localStorage.clear();
    localStorage.setItem("pmt-release-notes-last-seen:1", seenToken);
    localStorage.setItem("pmt-release-notes-last-seen:2", seenToken);
  }, releaseNotes[0].seenToken);

  await page.route("**/api/session", route => route.fulfill(jsonResponse({ error: "Unauthorized" }, 401)));
  await page.route("**/api/login", route => route.fulfill(jsonResponse({
    userId: 1,
    nickname: "Sin",
    isAdmin: true,
    role: "Admin"
  })));
  await page.route("**/api/state", route => route.fulfill(jsonResponse(apiState)));
  await page.route("**/api/audit-trail", route => route.fulfill(jsonResponse([])));
  await page.route("**/api/maintenance/recycle-bin", route => route.fulfill(jsonResponse([])));
  await page.route("**/api/maintenance/orphan-files", route => route.fulfill(jsonResponse({
    files: [],
    totalCount: 0,
    totalByteLength: 0
  })));
  await page.route("**/api/uploads/richtext", route => {
    uploadedSvg = extractMultipartSvg(route.request().postDataBuffer());
    return route.fulfill(jsonResponse({ url: "/uploads/diagram2-new.svg" }));
  });
  await page.route("**/uploads/diagram2-new.svg", route => route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: uploadedSvg || buildAnnotationSvg(normalizeAnnotationState({ width: 640, height: 360, objects: [] }))
  }));
  await page.route("**/api/blogs", route => {
    createdPayload = route.request().postDataJSON();
    const created = {
      ...createdPayload,
      id: 123,
      createdByUserId: 1,
      updatedByUserId: 1,
      createdAt: "2026-07-26T10:00:00Z",
      updatedAt: "2026-07-26T10:00:00Z",
      rowVersion: "row-new"
    };
    apiState = {
      ...apiState,
      blogs: [...apiState.blogs, created]
    };
    return route.fulfill(jsonResponse(created));
  });

  await page.goto("/");
  await page.locator("#loginName").fill("Sin");
  await page.locator("#loginPassword").fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();

  await openNavigationScreen(page, "Diagram 2");
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "readonly");
  await expect(page.locator("[data-diagram2-page-document-head] h2")).toHaveText("PMT Database Schema");

  await page.getByRole("button", { name: "New Diagram" }).click();
  await expect(page).toHaveURL(/#\/diagram-2\/123$/);
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "edit");
  await expect(page.locator("[data-diagram2-live-viewer]")).toHaveAttribute("data-id", "123");
  await expect(page.locator("[data-diagram2-editor-shell]")).toBeVisible();
  await expect(page.locator("[data-diagram2-tree]")).toHaveCount(0);
  expect(createdPayload).toMatchObject({
    id: 0,
    title: "Untitled 1",
    isPrivate: true
  });
  expect(uploadedSvg).toContain("data-pmt-image-annotation-state");

  await page.locator("[data-action='cancel-diagram2-editor']").click();
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "readonly");
  await expect(page.locator("[data-diagram2-page-document-head] h2")).toHaveText("Untitled 1");
  await expect(page.locator("[data-diagram2-tree-row][data-id='123']")).toHaveClass(/is-selected/);
  await expect(page.locator("[data-diagram2-live-viewer]")).toHaveAttribute("data-id", "123");

  expect(browserErrors).toEqual([]);
});

test("Diagram 2 read-only mode positions a simple text box like Diagram 1", async ({ page }) => {
  const browserErrors = [];
  const apiState = simpleTextBoxParityState();

  page.on("console", message => {
    if (message.type() === "error" && !message.text().includes("status of 401")) browserErrors.push(message.text());
  });
  page.on("pageerror", error => browserErrors.push(error.message));

  await page.addInitScript(seenToken => {
    localStorage.clear();
    localStorage.setItem("pmt-release-notes-last-seen:1", seenToken);
    localStorage.setItem("pmt-release-notes-last-seen:2", seenToken);
  }, releaseNotes[0].seenToken);

  await page.route("**/api/session", route => route.fulfill(jsonResponse({ error: "Unauthorized" }, 401)));
  await page.route("**/api/login", route => route.fulfill(jsonResponse({
    userId: 1,
    nickname: "Sin",
    isAdmin: true,
    role: "Admin"
  })));
  await page.route("**/api/state", route => route.fulfill(jsonResponse(apiState)));
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

  await page.evaluate(() => {
    window.location.hash = "#/diagram/22";
  });
  await expect(page.locator(".diagram-screen")).toBeVisible();
  await expect(page.locator("[data-diagram-page-document-head] h2")).toHaveText("Simple Text Box");
  await expect(page.locator("[data-diagram-image] > g > rect")).toBeVisible();
  const diagram1Frame = await viewportRelativeBounds(
    page,
    "[data-diagram-viewport]",
    "[data-diagram-image] > g > rect"
  );
  expect(diagram1Frame).toBeTruthy();

  await page.evaluate(() => {
    window.location.hash = "#/diagram-2/22";
  });
  await expect(page.locator("[data-diagram2-screen]")).toBeVisible();
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "readonly");
  await expect(page.locator("[data-diagram2-page-document-head] h2")).toHaveText("Simple Text Box");
  await expect(page.locator("[data-diagram2-object-id='simple-textbox'] .diagram2-renderer-textbox-frame")).toBeVisible();
  const diagram2Frame = await viewportRelativeBounds(
    page,
    "[data-diagram2-viewer-canvas]",
    "[data-diagram2-object-id='simple-textbox'] .diagram2-renderer-textbox-frame"
  );
  expect(diagram2Frame).toBeTruthy();

  const shellFitTolerance = 10;
  expect(Math.abs(diagram2Frame.x - diagram1Frame.x)).toBeLessThanOrEqual(shellFitTolerance);
  expect(Math.abs(diagram2Frame.y - diagram1Frame.y)).toBeLessThanOrEqual(shellFitTolerance);
  expect(Math.abs(diagram2Frame.width - diagram1Frame.width)).toBeLessThanOrEqual(3);
  expect(Math.abs(diagram2Frame.height - diagram1Frame.height)).toBeLessThanOrEqual(3);
  expect(browserErrors).toEqual([]);
});

test("Diagram 2 saves the same backing document and roundtrips through Diagram 1", async ({ page }) => {
  const browserErrors = [];
  let apiState = roundtripState();
  let savedPayload = null;
  let uploadedSvg = "";

  page.on("console", message => {
    if (message.type() === "error" && !message.text().includes("status of 401")) browserErrors.push(message.text());
  });
  page.on("pageerror", error => browserErrors.push(error.message));

  await page.addInitScript(seenToken => {
    localStorage.clear();
    localStorage.setItem("pmt-release-notes-last-seen:1", seenToken);
  }, releaseNotes[0].seenToken);

  await page.route("**/api/session", route => route.fulfill(jsonResponse({ error: "Unauthorized" }, 401)));
  await page.route("**/api/login", route => route.fulfill(jsonResponse({
    userId: 1,
    nickname: "Sin",
    isAdmin: true,
    role: "Admin"
  })));
  await page.route("**/api/state", route => route.fulfill(jsonResponse(apiState)));
  await page.route("**/api/audit-trail", route => route.fulfill(jsonResponse([])));
  await page.route("**/api/maintenance/recycle-bin", route => route.fulfill(jsonResponse([])));
  await page.route("**/api/maintenance/orphan-files", route => route.fulfill(jsonResponse({
    files: [],
    totalCount: 0,
    totalByteLength: 0
  })));
  await page.route("**/api/uploads/richtext", route => {
    uploadedSvg = extractMultipartSvg(route.request().postDataBuffer());
    return route.fulfill(jsonResponse({ url: "/uploads/diagram2-roundtrip.svg" }));
  });
  await page.route("**/uploads/diagram2-roundtrip.svg", route => {
    return route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: uploadedSvg || buildAnnotationSvg(normalizeAnnotationState({ width: 1, height: 1, objects: [] }))
    });
  });
  await page.route("**/api/blogs/88", route => {
    savedPayload = route.request().postDataJSON();
    apiState = {
      ...apiState,
      blogs: apiState.blogs.map(blog => blog.id === 88
        ? {
            ...blog,
            ...savedPayload,
            rowVersion: "row-2",
            updatedAt: "2026-07-25T13:00:00Z"
          }
        : blog)
    };
    return route.fulfill(jsonResponse(apiState.blogs.find(blog => blog.id === 88)));
  });

  await page.goto("/");
  await page.locator("#loginName").fill("Sin");
  await page.locator("#loginPassword").fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();

  await page.evaluate(() => {
    window.location.hash = "#/diagram-2/88";
  });
  await expect(page.locator("[data-diagram2-screen]")).toBeVisible();
  await expect(page.locator("[data-diagram2-page-document-head] h2")).toHaveText("Diagram 2 Roundtrip");
  await expect(page.locator("[data-diagram2-object-plane] [data-diagram2-object-id='roundtrip-box']")).toBeVisible();
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "readonly");
  await expect(page.locator("[data-diagram2-editor-shell]")).toHaveCount(0);

  const readZoomControl = page.locator("[data-filter='diagram2-zoom']");
  await readZoomControl.selectOption("2");
  await waitForViewportReason(page, "toolbar zoom");
  await expect(readZoomControl).toHaveValue("2");

  await page.getByRole("button", { name: "Edit Diagram" }).click();
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "edit");
  await waitForViewportReason(page, "fit");
  await expect(page.locator("[data-diagram2-renderer-surface]").first()).toHaveClass(/is-fit/);
  await page.locator("[data-diagram2-object-plane] [data-diagram2-object-id='roundtrip-box']").click({ position: { x: 10, y: 10 } });
  await expect(page.locator("[data-diagram2-edit-state]").first()).toHaveText("1 selected");
  await expect(page.locator("[data-action='save-diagram2-document']").first()).toBeDisabled();

  await page.keyboard.press("Shift+ArrowRight");
  await expect(page.locator("[data-diagram2-save-state]").first()).toHaveText("Unsaved changes");
  await page.locator("[data-filter='diagram2-zoom']").selectOption("2");
  await waitForViewportReason(page, "toolbar zoom");
  await page.locator("[data-action='cancel-diagram2-editor']").click();
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "readonly");
  await waitForViewportReason(page, "fit");
  await expect(page.locator("[data-diagram2-renderer-surface]").first()).toHaveClass(/is-fit/);
  await expect(page.locator("[data-diagram2-editor-shell]")).toHaveCount(0);
  expect(savedPayload).toBeNull();
  const canceledX = await page.evaluate(() =>
    Number(document.querySelector("[data-diagram2-object-plane] [data-diagram2-object-id='roundtrip-box']")?.dataset.diagram2ObjectTransformX || 0));
  expect(canceledX).toBe(120);

  await page.getByRole("button", { name: "Edit Diagram" }).click();
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "edit");
  await page.locator("[data-diagram2-object-plane] [data-diagram2-object-id='roundtrip-box']").click({ position: { x: 10, y: 10 } });
  await page.keyboard.press("Shift+ArrowRight");
  await expect(page.locator("[data-diagram2-save-state]").first()).toHaveText("Unsaved changes");
  await expect(page.locator("[data-action='save-diagram2-document']").first()).toBeEnabled();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator("[data-diagram2-save-state]").first()).toHaveText("Saved");
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.locator("[data-diagram2-save-state]").first()).toHaveText("Unsaved changes");

  await page.locator("[data-diagram2-inspector-tab='objects']").click();
  await page.locator("[data-diagram2-objects-pane] [data-action='copy-diagram2-selection']").click();
  const clipboardText = await page.evaluate(() => window.__pmtDiagram2SelectionClipboard || "");
  expect(clipboardText).toMatch(/^PMT_DIAGRAM_SELECTION_V1\n/);
  expect(clipboardText).toContain("roundtrip-box");

  await page.getByRole("button", { name: "Save Diagram" }).click();
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "readonly");
  await expect(page.locator("[data-diagram2-editor-shell]")).toHaveCount(0);
  await expect(page.locator("[data-diagram2-object-plane] [data-diagram2-object-id='roundtrip-box']")).toBeVisible();

  expect(savedPayload).toMatchObject({
    id: 88,
    title: "Diagram 2 Roundtrip",
    expectedRowVersion: "row-1"
  });
  expect(savedPayload.bodyHtml).toContain('data-pmt-diagram="true"');
  expect(savedPayload.bodyHtml).toContain("/uploads/diagram2-roundtrip.svg");
  expect(savedPayload.bodyHtml).not.toContain("data:image/svg+xml;base64,");
  expect(uploadedSvg).toContain("data-pmt-image-annotation-state");
  expect(uploadedSvg).not.toContain("diagram2LiveNodeId");
  expect(uploadedSvg).not.toContain("diagram2RendererCache");
  expect(uploadedSvg).not.toContain("diagram2-renderer-object");

  const savedState = parseAnnotationSvg(uploadedSvg);
  expect(savedState.objects.find(object => object.id === "roundtrip-box").x).toBe(130);
  expect(savedState.objects.find(object => object.id === "roundtrip-box").y).toBe(96);

  await page.evaluate(() => {
    window.location.hash = "#/diagram/88";
  });
  await expect(page.locator(".diagram-screen")).toBeVisible();
  await expect(page.locator("[data-diagram-readonly-viewer][data-id='88']")).toBeVisible();
  await expect(page.locator("[data-diagram-image]")).toBeVisible();
  await expect(page.locator(".diagram-page-document-head h2")).toHaveText("Diagram 2 Roundtrip");

  await page.evaluate(() => {
    window.location.hash = "#/diagram-2/88";
  });
  await expect(page.locator("[data-diagram2-screen]")).toBeVisible();
  await expect(page.locator("[data-diagram2-object-plane] [data-diagram2-object-id='roundtrip-box']")).toBeVisible();
  const reopenedX = await page.evaluate(() => {
    const renderer = window.__pmtDiagram2Renderer;
    return renderer?.liveViewSnapshot?.().objectDataCount
      ? Number(document.querySelector("[data-diagram2-object-plane] [data-diagram2-object-id='roundtrip-box']")?.dataset.diagram2ObjectTransformX || 0)
      : 0;
  });
  expect(reopenedX).toBe(130);

  expect(browserErrors).toEqual([]);
});

async function openNavigationScreen(page, view) {
  const primaryButton = page.locator(`#nav > button.nav-item[data-view='${view}']`);
  if (await primaryButton.isVisible().catch(() => false)) {
    await primaryButton.click();
    return;
  }

  await page.locator(".nav-overflow-toggle").click();
  await page.locator(`.nav-overflow-menu button[data-view='${view}']`).click();
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

async function assertDiagram2ReadOnlyCannotMutate(page) {
  const before = await page.evaluate(() => {
    const object = document.querySelector("[data-diagram2-object-plane] [data-diagram2-object-id]");
    return {
      id: object?.dataset.diagram2ObjectId || "",
      x: Number(object?.dataset.diagram2ObjectTransformX || 0),
      y: Number(object?.dataset.diagram2ObjectTransformY || 0),
      editorCoreLive: Boolean(window.__pmtDiagram2EditorCore),
      editorShellCount: document.querySelectorAll("[data-diagram2-editor-shell]").length,
      contextMenuCount: document.querySelectorAll("[data-diagram2-context-menu]").length
    };
  });
  expect(before.id).toBeTruthy();
  expect(before.editorCoreLive).toBe(false);
  expect(before.editorShellCount).toBe(0);
  expect(before.contextMenuCount).toBe(0);

  const object = page.locator(`[data-diagram2-object-plane] [data-diagram2-object-id='${before.id}']`);
  const box = await object.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box.x + Math.min(12, box.width / 2), box.y + Math.min(12, box.height / 2));
  await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + 42);
  await page.mouse.up();
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Delete");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Control+Z");
  await page.keyboard.press("Control+Y");
  await page.keyboard.press("Control+V");
  const programmaticMove = await page.evaluate(() =>
    window.__pmtDiagram2EditorCore?.moveSelectedObjects?.(10, 0, { reason: "read-only helper" }) ?? "no-editor-core");
  const after = await page.evaluate(id => {
    const object = document.querySelector(`[data-diagram2-object-plane] [data-diagram2-object-id="${CSS.escape(id)}"]`);
    return {
      x: Number(object?.dataset.diagram2ObjectTransformX || 0),
      y: Number(object?.dataset.diagram2ObjectTransformY || 0),
      editorCoreLive: Boolean(window.__pmtDiagram2EditorCore),
      editorShellCount: document.querySelectorAll("[data-diagram2-editor-shell]").length,
      selectionOverlays: document.querySelectorAll("[data-diagram2-selection-id]").length,
      contextMenuCount: document.querySelectorAll("[data-diagram2-context-menu]").length
    };
  }, before.id);
  expect(programmaticMove).toBe("no-editor-core");
  expect(after.x).toBe(before.x);
  expect(after.y).toBe(before.y);
  expect(after.editorCoreLive).toBe(false);
  expect(after.editorShellCount).toBe(0);
  expect(after.selectionOverlays).toBe(0);
  expect(after.contextMenuCount).toBe(0);
}

async function assertDiagram2InspectorTabsDoNotOverlap(page) {
  const tabRects = await page.locator("[data-diagram2-inspector-tab]").evaluateAll(tabs =>
    tabs.filter(tab => !tab.hidden).map(tab => {
      const rect = tab.getBoundingClientRect();
      return {
        text: tab.textContent.trim(),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width)
      };
    }));
  expect(tabRects.length).toBeGreaterThan(0);
  tabRects.forEach(rect => {
    expect(rect.width).toBeGreaterThan(20);
    expect(rect.text).toBeTruthy();
  });
  for (let index = 1; index < tabRects.length; index += 1) {
    expect(tabRects[index].left).toBeGreaterThanOrEqual(tabRects[index - 1].right - 1);
  }
}

async function viewportRelativeBounds(page, viewportSelector, objectSelector) {
  return page.evaluate(({ viewportSelector, objectSelector }) => {
    const viewport = document.querySelector(viewportSelector);
    const object = document.querySelector(objectSelector);
    const viewportRect = viewport?.getBoundingClientRect();
    const objectRect = object?.getBoundingClientRect();
    if (!viewportRect || !objectRect) return null;
    return {
      x: objectRect.x - viewportRect.x,
      y: objectRect.y - viewportRect.y,
      width: objectRect.width,
      height: objectRect.height
    };
  }, { viewportSelector, objectSelector });
}

async function assertTransformOnlyZoom(page, zoom, expectedFullRenderCount) {
  const before = await diagram2StabilitySnapshot(page);
  await page.locator("[data-filter='diagram2-zoom']").selectOption(zoom);
  await expect.poll(() => diagram2ViewportScale(page)).toBe(Number(zoom));
  await waitForViewportReason(page, "toolbar zoom");
  const afterFrame = await diagram2StabilitySnapshot(page);
  await waitForStableAnimationFrame(page);
  const afterSettle = await diagram2StabilitySnapshot(page);

  expect(afterFrame.svgStable).toBe(true);
  expect(afterFrame.entityStable).toBe(true);
  expect(afterFrame.textStable).toBe(true);
  expect(afterFrame.fullRenderCount).toBe(expectedFullRenderCount);
  expect(afterFrame.fullRendersDuringSettle).toBe(0);
  expect(afterFrame.routesRecalculatedDuringSettle).toBe(0);
  expect(afterFrame.nodeIdentityBeforeAfter).toBe("true");
  expect(afterSettle.fullRenderCount).toBe(expectedFullRenderCount);
  expect(maxRectMovement(afterFrame.entityRect, afterSettle.entityRect).translation).toBeLessThanOrEqual(0.25);
  expect(maxRectMovement(afterFrame.entityRect, afterSettle.entityRect).size).toBeLessThanOrEqual(0.25);
  expect(before.fullRenderCount).toBe(expectedFullRenderCount);
}

async function assertDiagram2ToolbarObjectInsertion(page) {
  const before = await page.evaluate(() => {
    const svg = document.querySelector("[data-diagram2-svg]");
    return {
      fullRenderCount: Number(svg?.dataset.diagram2FullRenderCount || 0),
      objectCount: window.__pmtDiagram2EditorCore.currentState().objects.length,
      objectNodeCount: document.querySelectorAll("[data-diagram2-object-plane] [data-diagram2-object-id]").length
    };
  });

  await page.getByRole("button", { name: "Rectangle (R)" }).click();
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
      selectedObjectCount: controller.selectedObjectIds().length,
      dirty: controller.historyStatus().dirty,
      canUndo: controller.historyStatus().canUndo,
      historyEntryCount: controller.historyStatus().entryCount,
      fullRenderCount: Number(svg?.dataset.diagram2FullRenderCount || 0),
      objectCount: controller.currentState().objects.length,
      objectNodeCount: document.querySelectorAll("[data-diagram2-object-plane] [data-diagram2-object-id]").length,
      objectTreeRowExists: Boolean(row),
      objectTreeRowSelected: row?.classList.contains("is-selected") === true,
      saveDisabled: document.querySelector("[data-action='save-diagram2-document']")?.disabled === true,
      objectPatchCount: Number(svg?.dataset.diagram2ObjectsPatchedInLastFlush || 0),
      relationshipRouteCount: Number(svg?.dataset.diagram2RelationshipsRoutedInLastFlush || 0),
      objectNodeDelta: document.querySelectorAll("[data-diagram2-object-plane] [data-diagram2-object-id]").length
        - beforeSnapshot.objectNodeCount
    };
  }, before);

  expect(afterAdd.selectedId).toMatch(/^rectangle-/);
  expect(afterAdd.selectedType).toBe("rectangle");
  expect(afterAdd.selectedObjectCount).toBe(1);
  expect(afterAdd.dirty).toBe(true);
  expect(afterAdd.canUndo).toBe(true);
  expect(afterAdd.historyEntryCount).toBe(1);
  expect(afterAdd.fullRenderCount).toBe(before.fullRenderCount);
  expect(afterAdd.objectCount).toBe(before.objectCount + 1);
  expect(afterAdd.objectNodeDelta).toBe(1);
  expect(afterAdd.objectTreeRowExists).toBe(true);
  expect(afterAdd.objectTreeRowSelected).toBe(true);
  expect(afterAdd.saveDisabled).toBe(false);
  expect(afterAdd.objectPatchCount).toBeGreaterThanOrEqual(1);
  expect(afterAdd.relationshipRouteCount).toBeGreaterThanOrEqual(0);

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
      canRedo: controller.historyStatus().canRedo,
      fullRenderCount: Number(svg?.dataset.diagram2FullRenderCount || 0),
      objectNodeCount: document.querySelectorAll("[data-diagram2-object-plane] [data-diagram2-object-id]").length,
      saveDisabled: document.querySelector("[data-action='save-diagram2-document']")?.disabled === true
    };
  }, before);
  expect(afterUndo.dirty).toBe(false);
  expect(afterUndo.canRedo).toBe(true);
  expect(afterUndo.fullRenderCount).toBe(before.fullRenderCount);
  expect(afterUndo.objectNodeCount).toBe(before.objectNodeCount);
  expect(afterUndo.saveDisabled).toBe(true);

  await page.locator("[data-action='redo-diagram2']").click();
  await expect.poll(() =>
    page.evaluate(beforeCount => window.__pmtDiagram2EditorCore.currentState().objects.length === beforeCount + 1, before.objectCount)
  ).toBe(true);
  const afterRedo = await page.evaluate(async beforeSnapshot => {
    const controller = window.__pmtDiagram2EditorCore;
    const renderer = window.__pmtDiagram2Renderer;
    const svg = document.querySelector("[data-diagram2-svg]");
    await renderer.whenIdle();
    return {
      dirty: controller.historyStatus().dirty,
      fullRenderCount: Number(svg?.dataset.diagram2FullRenderCount || 0),
      objectNodeCount: document.querySelectorAll("[data-diagram2-object-plane] [data-diagram2-object-id]").length,
      selectedType: controller.getObjectById(controller.selectedObjectIds()[0])?.type
    };
  }, before);
  expect(afterRedo.dirty).toBe(true);
  expect(afterRedo.fullRenderCount).toBe(before.fullRenderCount);
  expect(afterRedo.objectNodeCount).toBe(before.objectNodeCount + 1);
  expect(afterRedo.selectedType).toBe("rectangle");

  await page.locator("[data-action='undo-diagram2']").click();
  await expect.poll(() =>
    page.evaluate(beforeCount => window.__pmtDiagram2EditorCore.currentState().objects.length === beforeCount, before.objectCount)
  ).toBe(true);
  await expect(page.locator("[data-action='save-diagram2-document']").first()).toBeDisabled();
}

async function assertDiagram2RichTextEditorParity(page) {
  const before = await page.evaluate(() => {
    const controller = window.__pmtDiagram2EditorCore;
    const svg = document.querySelector("[data-diagram2-svg]");
    return {
      objectCount: controller.currentState().objects.length,
      historyEntryCount: controller.historyStatus().entryCount,
      historyIndex: controller.historyStatus().index,
      fullRenderCount: Number(svg?.dataset.diagram2FullRenderCount || 0)
    };
  });

  await page.getByRole("button", { name: "Rich Text Editor (Y)" }).click();
  await expect.poll(() => page.evaluate(() =>
    window.__pmtDiagram2EditorCore.currentState().objects.length
  )).toBe(before.objectCount + 1);
  const richTextId = await page.evaluate(() => window.__pmtDiagram2EditorCore.selectedObjectIds()[0]);
  await page.locator(`[data-diagram2-object-plane] [data-diagram2-object-id="${richTextId}"]`).dispatchEvent("dblclick");

  const dialog = page.locator(".diagram2-text-editor-dialog");
  const editor = dialog.locator("[data-diagram2-rich-text-editor]");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-rich-editor-root]")).toBeVisible();
  await expect(dialog.locator("[data-command='bold']")).toBeEnabled();
  await expect(dialog.locator("[data-command='insertRichTable']")).toBeEnabled();
  await expect(dialog.locator("[data-command='insertCheckbox']")).toBeEnabled();
  await expect(dialog.locator("[data-rich-source]")).toBeEnabled();

  await editor.evaluate(node => {
    const paragraph = node.querySelector("p:last-child") || node;
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await dialog.locator("[data-command='bold']").click();
  await expect(editor.locator("p:last-child b, p:last-child strong")).toHaveCount(1);

  await editor.evaluate(node => {
    const paragraph = node.querySelector("p:last-child") || node;
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await dialog.locator("[data-rich-font]").selectOption("Georgia");
  await expect(editor.locator("font[face='Georgia']")).toHaveCount(1);

  await editor.evaluate(node => {
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await dialog.locator("[data-command='insertHorizontalRule']").click();
  await dialog.locator("[data-command='insertCheckbox']").click();
  await dialog.locator("[data-command='insertRichTable']").click();
  const tableDialog = page.locator("dialog.mini-dialog");
  await expect(tableDialog.getByRole("heading", { name: "Insert Table" })).toBeVisible();
  await tableDialog.locator("[name='rows']").selectOption("2");
  await tableDialog.locator("[name='columns']").selectOption("2");
  await tableDialog.getByRole("button", { name: "Insert" }).click();
  await expect(editor.locator("table")).toHaveCount(1);
  await expect(editor.locator(".rich-check-item")).toHaveCount(1);
  await expect(editor.locator("hr")).toHaveCount(1);

  await dialog.locator("[data-rich-source]").click();
  const sourceDialog = page.locator("dialog.rich-source-dialog");
  await expect(sourceDialog).toBeVisible();
  const source = sourceDialog.locator("[name='sourceHtml']");
  await source.fill(`${await source.inputValue()}<p data-phase3-source="true">Source parity works.</p>`);
  await sourceDialog.getByRole("button", { name: "Apply" }).click();
  await expect(sourceDialog).toHaveCount(0);
  await expect(editor).toContainText("Source parity works.");

  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => page.evaluate(id => {
    const object = window.__pmtDiagram2EditorCore.getObjectById(id);
    return Boolean(
      object?.html?.includes("data-phase3-source")
      && object.html.includes("<table")
      && object.html.includes("rich-check-item")
    );
  }, richTextId)).toBe(true);
  await expect(page.locator(`[data-diagram2-object-plane] [data-diagram2-object-id="${richTextId}"] .diagram2-renderer-rich-text-surface`))
    .toContainText("Source parity works.");

  const afterApply = await page.evaluate(async ({ id, baseline }) => {
    const controller = window.__pmtDiagram2EditorCore;
    const renderer = window.__pmtDiagram2Renderer;
    await renderer.whenIdle();
    const svg = document.querySelector("[data-diagram2-svg]");
    return {
      selected: controller.selectedObjectIds().includes(id),
      historyEntryDelta: controller.historyStatus().entryCount - baseline.historyEntryCount,
      historyIndexDelta: controller.historyStatus().index - baseline.historyIndex,
      fullRenderCount: Number(svg?.dataset.diagram2FullRenderCount || 0)
    };
  }, { id: richTextId, baseline: before });
  expect(afterApply.selected).toBe(true);
  expect(afterApply.historyEntryDelta).toBe(1);
  expect(afterApply.historyIndexDelta).toBe(2);
  expect(afterApply.fullRenderCount).toBe(before.fullRenderCount);

  await page.locator("[data-action='undo-diagram2']").click();
  await page.locator("[data-action='undo-diagram2']").click();
  await expect.poll(() => page.evaluate(count =>
    window.__pmtDiagram2EditorCore.currentState().objects.length
  , before.objectCount)).toBe(before.objectCount);
  await expect(page.locator("[data-action='save-diagram2-document']").first()).toBeDisabled();
}

async function assertDiagram2ObjectContextMenuParity(page) {
  const before = await page.evaluate(() => {
    const controller = window.__pmtDiagram2EditorCore;
    const svg = document.querySelector("[data-diagram2-svg]");
    window.__diagram2ContextUnrelatedNode = document.querySelector("[data-diagram2-object-plane] [data-diagram2-object-type='entity']");
    return {
      objectCount: controller.currentState().objects.length,
      historyIndex: controller.historyStatus().index,
      fullRenderCount: Number(svg?.dataset.diagram2FullRenderCount || 0)
    };
  });

  await page.getByRole("button", { name: "Rectangle (R)" }).click();
  const rectangleId = await page.evaluate(() => window.__pmtDiagram2EditorCore.selectedObjectIds()[0]);
  const rectangle = page.locator(`[data-diagram2-object-plane] [data-diagram2-object-id="${rectangleId}"]`);
  const rectangleName = await page.evaluate(id =>
    window.__pmtDiagram2EditorCore.getObjectById(id)?.name, rectangleId);
  expect(rectangleName).toMatch(/^Rectangle \d+$/);
  await expect(page.locator(
    `[data-diagram2-object-tree-row][data-object-id="${rectangleId}"] .image-annotation-object-tree-label`
  )).toHaveText(rectangleName);
  await rectangle.click({ button: "right" });
  const menu = page.locator("[data-diagram2-context-menu]");
  await expect(menu).toBeVisible();
  expect(await menu.locator("button").evaluateAll(buttons => buttons.map(button =>
    button.querySelector(".dropdown-menu-label")?.textContent?.trim()
  ))).toEqual([
    "To Front",
    "To Back",
    "Forward",
    "Backward",
    "Lock",
    "Copy Selection",
    "Paste",
    "Duplicate",
    "Delete",
    "Copy as SVG",
    "Copy as Image"
  ]);

  const objectOrder = () => page.evaluate(() =>
    window.__pmtDiagram2EditorCore.currentState().objects.map(object => object.id));
  await menu.locator("[data-action='arrange-diagram2-selection-back']").click();
  await expect.poll(async () => (await objectOrder())[0]).toBe(rectangleId);

  await rectangle.click({ button: "right" });
  await menu.locator("[data-action='arrange-diagram2-selection-forward']").click();
  await expect.poll(async () => (await objectOrder())[1]).toBe(rectangleId);

  await rectangle.click({ button: "right" });
  await menu.locator("[data-action='arrange-diagram2-selection-front']").click();
  await expect.poll(async () => (await objectOrder()).at(-1)).toBe(rectangleId);

  await rectangle.click({ button: "right" });
  await menu.locator("[data-action='arrange-diagram2-selection-backward']").click();
  await expect.poll(async () => (await objectOrder()).at(-2)).toBe(rectangleId);

  for (let index = 0; index < 4; index += 1) {
    await page.locator("[data-action='undo-diagram2']").click();
  }
  await expect.poll(async () => (await objectOrder()).at(-1)).toBe(rectangleId);

  await rectangle.click({ button: "right" });
  await menu.locator("[data-action='lock-diagram2-selection']").click();
  await expect.poll(() => page.evaluate(id =>
    window.__pmtDiagram2EditorCore.getObjectById(id)?.locked, rectangleId
  )).toBe(true);
  await expect(rectangle).toHaveAttribute("data-diagram2-object-locked", "true");
  await expect(page.locator(`[data-diagram2-selection-id="${rectangleId}"] [data-diagram2-resize-handle]`)).toHaveCount(0);

  await rectangle.click({ button: "right" });
  await expect(menu.locator("[data-action='lock-diagram2-selection'] .dropdown-menu-label")).toHaveText("Unlock");
  await expect(menu.locator("[data-action^='arrange-diagram2-selection-']").first()).toBeDisabled();
  await page.locator("[data-action='undo-diagram2']").click();
  await expect.poll(() => page.evaluate(id =>
    window.__pmtDiagram2EditorCore.getObjectById(id)?.locked, rectangleId
  )).toBe(false);

  await rectangle.click({ button: "right" });
  await menu.locator("[data-action='copy-diagram2-selection']").click();
  await expect.poll(() => page.evaluate(() =>
    String(window.__pmtDiagramSelectionClipboard || "").startsWith("PMT_DIAGRAM_SELECTION_V1")
  )).toBe(true);
  await rectangle.click({ button: "right" });
  await menu.locator("[data-action='paste-diagram2-selection']").click();
  await expect.poll(() => page.evaluate(count =>
    window.__pmtDiagram2EditorCore.currentState().objects.length, before.objectCount
  )).toBe(before.objectCount + 2);
  await page.locator("[data-action='undo-diagram2']").click();

  await rectangle.click({ button: "right" });
  await menu.locator("[data-action='duplicate-diagram2-selection']").click();
  await expect.poll(() => page.evaluate(count =>
    window.__pmtDiagram2EditorCore.currentState().objects.length, before.objectCount
  )).toBe(before.objectCount + 2);
  const duplicateId = await page.evaluate(() => window.__pmtDiagram2EditorCore.selectedObjectIds()[0]);
  await page.locator(`[data-diagram2-object-plane] [data-diagram2-object-id="${duplicateId}"]`).click({ button: "right" });
  await menu.locator("[data-action='delete-diagram2-selection']").click();
  await expect.poll(() => page.evaluate(count =>
    window.__pmtDiagram2EditorCore.currentState().objects.length, before.objectCount
  )).toBe(before.objectCount + 1);
  await page.locator("[data-action='undo-diagram2']").click();
  await page.locator("[data-action='undo-diagram2']").click();

  await rectangle.click({ button: "right" });
  await menu.locator("[data-action='copy-diagram2-selection-svg']").click();
  await expect.poll(() => page.evaluate(async () =>
    navigator.clipboard.readText()
  )).toContain("<svg");
  await rectangle.click({ button: "right" });
  await menu.locator("[data-action='copy-diagram2-selection-image']").click();
  await expect.poll(() => page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    return items.flatMap(item => item.types);
  })).toContain("image/png");

  await page.locator("[data-action='undo-diagram2']").click();
  await expect.poll(() => page.evaluate(count =>
    window.__pmtDiagram2EditorCore.currentState().objects.length, before.objectCount
  )).toBe(before.objectCount);
  const after = await page.evaluate(async () => {
    const controller = window.__pmtDiagram2EditorCore;
    const renderer = window.__pmtDiagram2Renderer;
    await renderer.whenIdle();
    const svg = document.querySelector("[data-diagram2-svg]");
    return {
      historyIndex: controller.historyStatus().index,
      fullRenderCount: Number(svg?.dataset.diagram2FullRenderCount || 0),
      unrelatedNodePreserved: document.querySelector("[data-diagram2-object-plane] [data-diagram2-object-type='entity']")
        === window.__diagram2ContextUnrelatedNode
    };
  });
  expect(after.historyIndex).toBe(before.historyIndex);
  expect(after.fullRenderCount).toBe(before.fullRenderCount);
  expect(after.unrelatedNodePreserved).toBe(true);
  await expect(page.locator("[data-action='save-diagram2-document']").first()).toBeDisabled();
}

async function assertDiagram2CanvasCopyMenu(page, options = {}) {
  const canvas = page.locator("[data-diagram2-viewer-canvas]");
  const menu = page.locator("[data-diagram2-canvas-context-menu]");
  const openMenu = async () => {
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    await canvas.dispatchEvent("contextmenu", {
      button: 2,
      clientX: box.x + Math.min(80, box.width / 2),
      clientY: box.y + Math.min(80, box.height / 2)
    });
    await expect(menu).toBeVisible();
    expect(await menu.locator("button").evaluateAll(buttons => buttons.map(button =>
      button.querySelector(".dropdown-menu-label")?.textContent?.trim()
    ))).toEqual(["Copy as SVG", "Copy as PNG"]);
  };

  await openMenu();
  await menu.locator("[data-action='copy-diagram2-svg']").click();
  const svgDialog = page.locator(".diagram2-svg-download-dialog");
  await expect(svgDialog).toBeVisible();
  await expect(svgDialog.getByRole("heading")).toHaveText("Copy as SVG");
  if (options.copyToClipboard === true) {
    await svgDialog.locator("select").selectOption("12");
    await svgDialog.getByRole("button", { name: "Copy", exact: true }).click();
    await expect.poll(() => page.evaluate(async () => navigator.clipboard.readText())).toContain("<svg");
  } else {
    await svgDialog.getByRole("button", { name: "Cancel", exact: true }).click();
  }

  await openMenu();
  await menu.locator("[data-action='copy-diagram2-png']").click();
  const pngDialog = page.locator(".diagram2-png-download-dialog");
  await expect(pngDialog).toBeVisible();
  await expect(pngDialog.getByRole("heading")).toHaveText("Copy as PNG");
  if (options.copyToClipboard === true) {
    await pngDialog.getByRole("button", { name: "Copy", exact: true }).click();
    await expect.poll(() => page.evaluate(async () => {
      const items = await navigator.clipboard.read();
      return items.flatMap(item => item.types);
    })).toContain("image/png");
  } else {
    await pngDialog.getByRole("button", { name: "Cancel", exact: true }).click();
  }

  if (options.verifyDeniedPngFallback === true) {
    await denyClipboardWrites(page);
    try {
      await openMenu();
      await menu.locator("[data-action='copy-diagram2-png']").click();
      const fallbackDialog = page.locator(".diagram2-png-download-dialog");
      await expect(fallbackDialog).toBeVisible();
      const downloadPromise = page.waitForEvent("download");
      await fallbackDialog.getByRole("button", { name: "Copy", exact: true }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe("PMT-Database-Schema.png");
      await expect(page.locator("#toast")).toContainText("downloaded as PNG instead");
    } finally {
      await restoreClipboardWrites(page);
    }
  }
}

async function assertDiagram1PngDownloadFallback(page) {
  const canvas = page.locator("[data-diagram-viewport]");
  const menu = page.locator("[data-diagram-readonly-context-menu]");
  await expect(canvas).toBeVisible();
  await denyClipboardWrites(page);
  try {
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    await canvas.dispatchEvent("contextmenu", {
      button: 2,
      clientX: box.x + Math.min(80, box.width / 2),
      clientY: box.y + Math.min(80, box.height / 2)
    });
    await expect(menu).toBeVisible();
    await menu.locator("[data-diagram-copy-format='png']").click();
    const dialog = page.locator(".diagram-png-copy-dialog");
    await expect(dialog).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Copy", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("PMT Database Schema.png");
    await expect(page.locator("#toast")).toContainText("downloaded as PNG instead");
  } finally {
    await restoreClipboardWrites(page);
  }
}

async function denyClipboardWrites(page) {
  await page.evaluate(() => {
    window.__pmtClipboardWriteDescriptor = Object.getOwnPropertyDescriptor(Clipboard.prototype, "write");
    Object.defineProperty(Clipboard.prototype, "write", {
      configurable: true,
      value: async () => {
        throw new DOMException("Clipboard write denied.", "NotAllowedError");
      }
    });
  });
}

async function restoreClipboardWrites(page) {
  await page.evaluate(() => {
    const descriptor = window.__pmtClipboardWriteDescriptor;
    if (descriptor) Object.defineProperty(Clipboard.prototype, "write", descriptor);
    delete window.__pmtClipboardWriteDescriptor;
  });
}

async function assertDiagram2ColorPickerBehavior(page) {
  const trigger = page.locator("[data-annotation-color-picker='fill'] [data-annotation-color-trigger]").first();
  const palette = page.locator("[data-annotation-color-picker='fill'] [data-rich-color-palette]").first();
  const triggerBox = await trigger.boundingBox();
  expect(triggerBox).toBeTruthy();

  await page.mouse.click(triggerBox.x + (triggerBox.width * 0.75), triggerBox.y + (triggerBox.height / 2));
  await expect(palette).toBeVisible();
  const palettePosition = await page.evaluate(() => {
    const trigger = document.querySelector("[data-annotation-color-picker='fill'] [data-annotation-color-trigger]");
    const palette = document.querySelector("[data-annotation-color-picker='fill'] [data-rich-color-palette]");
    const triggerRect = trigger.getBoundingClientRect();
    const paletteRect = palette.getBoundingClientRect();
    return {
      triggerLeft: triggerRect.left,
      triggerBottom: triggerRect.bottom,
      paletteLeft: paletteRect.left,
      paletteTop: paletteRect.top
    };
  });
  expect(palettePosition.paletteLeft).toBeGreaterThan(0);
  expect(palettePosition.paletteTop).toBeGreaterThan(0);
  expect(Math.abs(palettePosition.paletteLeft - palettePosition.triggerLeft)).toBeLessThanOrEqual(16);
  expect(Math.abs(palettePosition.paletteTop - palettePosition.triggerBottom)).toBeLessThanOrEqual(16);
  await expect(page.locator("[data-annotation-color-picker='fill'] [data-rich-last-colors] [data-rich-color-value='#123456']").first()).toBeVisible();
  await expect(page.locator("[data-annotation-recent-colors='fill'] [data-rich-color-value='#123456']").first()).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();

  const before = await page.evaluate(() => {
    const controller = window.__pmtDiagram2EditorCore;
    const id = controller.selectedObjectIds()[0];
    const svg = document.querySelector("[data-diagram2-svg]");
    return {
      id,
      fill: controller.getObjectById(id)?.fill,
      fullRenderCount: Number(svg?.dataset.diagram2FullRenderCount || 0),
      objectCount: controller.currentState().objects.length,
      flushCount: Number(svg?.dataset.diagram2DirtyFlushCount || 0)
    };
  });

  await page.mouse.click(triggerBox.x + (triggerBox.width * 0.25), triggerBox.y + (triggerBox.height / 2));
  await expect(palette).toBeHidden();
  await expect.poll(() => page.evaluate(id =>
    window.__pmtDiagram2EditorCore.getObjectById(id)?.fill, before.id
  )).toBe("#123456");
  const after = await page.evaluate(async id => {
    const controller = window.__pmtDiagram2EditorCore;
    const renderer = window.__pmtDiagram2Renderer;
    const svg = document.querySelector("[data-diagram2-svg]");
    await renderer.whenIdle();
    return {
      fill: controller.getObjectById(id)?.fill,
      dirty: controller.historyStatus().dirty,
      fullRenderCount: Number(svg?.dataset.diagram2FullRenderCount || 0),
      objectCount: controller.currentState().objects.length,
      flushCount: Number(svg?.dataset.diagram2DirtyFlushCount || 0),
      renderedFill: document.querySelector(`[data-diagram2-object-id="${CSS.escape(id)}"] [data-diagram2-entity-body]`)?.getAttribute("fill")
    };
  }, before.id);
  expect(after.fill).toBe("#123456");
  expect(after.renderedFill).toBe("#123456");
  expect(after.dirty).toBe(true);
  expect(after.fullRenderCount).toBe(before.fullRenderCount);
  expect(after.objectCount).toBe(before.objectCount);
  expect(after.flushCount).toBeGreaterThan(before.flushCount);

  await page.locator("[data-action='undo-diagram2']").click();
  await expect.poll(() => page.evaluate(({ id, fill }) =>
    String(window.__pmtDiagram2EditorCore.getObjectById(id)?.fill || "").toUpperCase() === String(fill || "").toUpperCase(), before
  )).toBe(true);
  await expect(page.locator("[data-action='save-diagram2-document']").first()).toBeDisabled();
}

async function assertDiagram2EditModeCursor(page) {
  const canvas = page.locator("[data-diagram2-viewer-canvas]").first();
  await expect.poll(() => canvas.evaluate(element => element.dataset.diagram2ActiveTool)).toBe("select");
  await expect.poll(() => canvas.evaluate(element => getComputedStyle(element).cursor)).toBe("default");

  await page.locator("[data-diagram2-tool='pan']").click();
  await expect(page.locator("[data-diagram2-tool='pan']")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => canvas.evaluate(element => element.dataset.diagram2ActiveTool)).toBe("pan");
  await expect.poll(() => canvas.evaluate(element => getComputedStyle(element).cursor)).toBe("grab");

  await page.locator("[data-diagram2-tool='select']").click();
  await expect(page.locator("[data-diagram2-tool='select']")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => canvas.evaluate(element => element.dataset.diagram2ActiveTool)).toBe("select");
  await expect.poll(() => canvas.evaluate(element => getComputedStyle(element).cursor)).toBe("default");
}

async function assertDiagram2FormatControlsBehavior(page) {
  const lineWidth = page.locator("[data-diagram2-style='strokeWidth']").first();
  const fontSize = page.locator("[data-diagram2-style='fontSize']").first();
  const textAlign = page.locator("[data-diagram2-style='textAlign']").first();
  await expect(lineWidth).toBeEnabled();
  await expect(fontSize).toBeEnabled();
  await expect(textAlign).toBeDisabled();
  await expect(page.locator("[data-diagram2-style-field='arrowSize']")).toBeHidden();

  const before = await page.evaluate(() => {
    const controller = window.__pmtDiagram2EditorCore;
    const id = controller.selectedObjectIds()[0];
    const object = controller.getObjectById(id);
    const svg = document.querySelector("[data-diagram2-svg]");
    return {
      id,
      strokeWidth: object?.strokeWidth,
      fontSize: object?.fontSize,
      fullRenderCount: Number(svg?.dataset.diagram2FullRenderCount || 0),
      flushCount: Number(svg?.dataset.diagram2DirtyFlushCount || 0)
    };
  });

  await setDiagram2FormatControlValue(lineWidth, "7");
  await expect.poll(() => page.evaluate(id =>
    window.__pmtDiagram2EditorCore.getObjectById(id)?.strokeWidth, before.id
  )).toBe(7);
  const afterLineWidth = await page.evaluate(async id => {
    const renderer = window.__pmtDiagram2Renderer;
    const svg = document.querySelector("[data-diagram2-svg]");
    await renderer.whenIdle();
    return {
      fullRenderCount: Number(svg?.dataset.diagram2FullRenderCount || 0),
      flushCount: Number(svg?.dataset.diagram2DirtyFlushCount || 0),
      renderedStrokeWidth: document.querySelector(`[data-diagram2-object-id="${CSS.escape(id)}"] .diagram2-renderer-entity-outline`)?.getAttribute("stroke-width")
    };
  }, before.id);
  expect(afterLineWidth.renderedStrokeWidth).toBe("7");
  expect(afterLineWidth.fullRenderCount).toBe(before.fullRenderCount);
  expect(afterLineWidth.flushCount).toBeGreaterThan(before.flushCount);

  await setDiagram2FormatControlValue(fontSize, "22");
  await expect.poll(() => page.evaluate(id =>
    window.__pmtDiagram2EditorCore.getObjectById(id)?.fontSize, before.id
  )).toBe(22);
  const afterFontSize = await page.evaluate(async () => {
    const renderer = window.__pmtDiagram2Renderer;
    const svg = document.querySelector("[data-diagram2-svg]");
    await renderer.whenIdle();
    return Number(svg?.dataset.diagram2FullRenderCount || 0);
  });
  expect(afterFontSize).toBe(before.fullRenderCount);

  await page.locator("[data-action='undo-diagram2']").click();
  await expect.poll(() => page.evaluate(({ id, fontSize }) =>
    window.__pmtDiagram2EditorCore.getObjectById(id)?.fontSize, before
  )).toBe(before.fontSize);
  await page.locator("[data-action='undo-diagram2']").click();
  await expect.poll(() => page.evaluate(({ id, strokeWidth }) =>
    window.__pmtDiagram2EditorCore.getObjectById(id)?.strokeWidth, before
  )).toBe(before.strokeWidth);
  await expect(page.locator("[data-action='save-diagram2-document']").first()).toBeDisabled();
}

async function setDiagram2FormatControlValue(locator, value) {
  await locator.evaluate((element, nextValue) => {
    element.value = String(nextValue);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, String(value));
}

async function assertDiagram2ResizeBehavior(page) {
  const before = await page.evaluate(() => {
    const controller = window.__pmtDiagram2EditorCore;
    const id = controller.selectedObjectIds()[0];
    const object = controller.getObjectById(id);
    const svg = document.querySelector("[data-diagram2-svg]");
    return {
      id,
      width: object?.width,
      fullRenderCount: Number(svg?.dataset.diagram2FullRenderCount || 0)
    };
  });
  const handle = page.locator(`[data-diagram2-selection-id='${before.id}'] [data-diagram2-resize-handle='e']`).first();
  await expect(handle).toBeVisible();
  const box = await handle.boundingBox();
  expect(box).toBeTruthy();

  await page.mouse.move(box.x + (box.width / 2), box.y + (box.height / 2));
  await page.mouse.down();
  await page.mouse.move(box.x + (box.width / 2) + 48, box.y + (box.height / 2), { steps: 4 });
  await page.mouse.up();

  await expect.poll(() => page.evaluate(id =>
    window.__pmtDiagram2EditorCore.getObjectById(id)?.width, before.id
  )).toBeGreaterThan(before.width);
  const after = await page.evaluate(async id => {
    const renderer = window.__pmtDiagram2Renderer;
    const svg = document.querySelector("[data-diagram2-svg]");
    await renderer.whenIdle();
    return {
      dirty: window.__pmtDiagram2EditorCore.historyStatus().dirty,
      fullRenderCount: Number(svg?.dataset.diagram2FullRenderCount || 0),
      handleCount: document.querySelectorAll(`[data-diagram2-selection-id="${CSS.escape(id)}"] [data-diagram2-resize-handle]`).length
    };
  }, before.id);
  expect(after.dirty).toBe(true);
  expect(after.fullRenderCount).toBe(before.fullRenderCount);
  expect(after.handleCount).toBe(8);

  await page.locator("[data-action='undo-diagram2']").click();
  await expect.poll(() => page.evaluate(({ id, width }) =>
    window.__pmtDiagram2EditorCore.getObjectById(id)?.width, before
  )).toBe(before.width);
  await expect(page.locator("[data-action='save-diagram2-document']").first()).toBeDisabled();
}

async function assertKeyedDiagram2NodePatches(page, expectedFullRenderCount) {
  const result = await page.evaluate(async () => {
    const renderer = window.__pmtDiagram2Renderer;
    const svg = document.querySelector("[data-diagram2-svg]");
    const objectPlane = document.querySelector("[data-diagram2-object-plane]");
    const entities = [...(objectPlane?.querySelectorAll("[data-diagram2-object-type='entity']") || [])];
    const relationship = document.querySelector("[data-diagram2-relationship-id]");
    const relatedEntity = relationship?.dataset.diagram2RelationshipSource
      ? objectPlane?.querySelector(`[data-diagram2-object-id="${CSS.escape(relationship.dataset.diagram2RelationshipSource)}"]`)
      : null;
    const entityA = relatedEntity || entities[0] || null;
    const entityB = entities.find(entity => entity !== entityA) || null;
    const entityAText = entityA?.querySelector("[data-diagram2-entity-title], text") || null;
    if (!renderer || !svg || !entityA || !entityB) return { ready: false };

    const entityAId = entityA.dataset.diagram2ObjectId;
    const entityBId = entityB.dataset.diagram2ObjectId;
    const flushCountBefore = Number(svg.dataset.diagram2DirtyFlushCount || 0);
    renderer.setSelectedIds([entityAId]);
    await renderer.whenIdle();
    const entityASelected = entityA.classList.contains("is-selected");
    renderer.setSelectedIds([entityBId]);
    const selectionDiagnostics = await renderer.whenIdle();
    const selectionPatched = !entityA.classList.contains("is-selected")
      && entityB.classList.contains("is-selected")
      && document.querySelectorAll("[data-diagram2-selection-id]").length === 1;

    renderer.updateObject(entityAId, {
      fill: "#fff7ed",
      entityHeaderFill: "#fed7aa",
      textColor: "#7c2d12"
    });
    const styleDiagnostics = await renderer.whenIdle();
    const fillPatched = entityA.querySelector("[data-diagram2-entity-body]")?.getAttribute("fill") === "#fff7ed";
    const headerPatched = entityA.querySelector("[data-diagram2-entity-header]")?.getAttribute("fill") === "#fed7aa";
    const transformBeforeMove = entityA.getAttribute("transform");
    renderer.updateObject(entityAId, object => ({
      x: Number(object.x || 0) + 24,
      y: Number(object.y || 0) + 16
    }));
    const moveDiagnostics = await renderer.whenIdle();
    const transformAfterMove = entityA.getAttribute("transform");

    const batchFlushBefore = Number(svg.dataset.diagram2DirtyFlushCount || 0);
    renderer.beginDiagramUpdate("batched style test");
    renderer.updateObject(entityAId, { fill: "#eef2ff" });
    renderer.updateObject(entityBId, { fill: "#ecfdf5" });
    const transactionSnapshot = renderer.liveViewSnapshot();
    renderer.endDiagramUpdate("batched style test");
    const batchDiagnostics = await renderer.whenIdle();
    const batchFlushAfter = Number(svg.dataset.diagram2DirtyFlushCount || 0);

    const selectionEntityIds = entities.slice(0, 28).map(entity => entity.dataset.diagram2ObjectId);
    renderer.setSelectedIds(selectionEntityIds);
    const largeSelectionDiagnostics = await renderer.whenIdle();

    return {
      ready: true,
      entityAStable: entityA === objectPlane.querySelector(`[data-diagram2-object-id="${entityAId}"]`),
      entityBStable: entityB === objectPlane.querySelector(`[data-diagram2-object-id="${entityBId}"]`),
      entityATextStable: entityAText === entityA.querySelector("[data-diagram2-entity-title], text"),
      relationshipStable: !relationship || relationship === document.querySelector(`[data-diagram2-relationship-id="${relationship.dataset.diagram2RelationshipId}"]`),
      entityASelected,
      selectionPatched,
      fillPatched,
      headerPatched,
      transformChanged: transformBeforeMove !== transformAfterMove,
      fullRenderCount: Number(svg.dataset.diagram2FullRenderCount || 0),
      objectPatchedCount: Number(svg.dataset.diagram2ObjectsPatchedInLastFlush || 0),
      selectionRoutedRelationshipCount: selectionDiagnostics.routedRelationshipCount,
      styleRoutedRelationshipCount: styleDiagnostics.routedRelationshipCount,
      stylePatchedNodeCount: styleDiagnostics.patchedNodeCount,
      moveRoutedRelationshipCount: moveDiagnostics.routedRelationshipCount,
      moveSelectiveRelationshipsConsidered: moveDiagnostics.selectiveRoutingRelationshipsConsidered,
      moveSelectiveRelationshipsRerouted: moveDiagnostics.selectiveRoutingRelationshipsRerouted,
      moveSelectiveTotalRelationships: moveDiagnostics.selectiveRoutingTotalRelationships,
      moveSelectiveSpatialSectorsQueried: moveDiagnostics.selectiveRoutingSpatialSectorsQueried,
      batchFlushDelta: batchFlushAfter - batchFlushBefore,
      batchPatchedNodeCount: batchDiagnostics.patchedNodeCount,
      batchRoutedRelationshipCount: batchDiagnostics.routedRelationshipCount,
      transactionQueuedDirtyIds: transactionSnapshot.dirtyObjectIds,
      transactionPendingBeforeEnd: transactionSnapshot.pendingDiagramFlush,
      largeSelectionCount: selectionEntityIds.length,
      largeSelectionDuration: largeSelectionDiagnostics.lastFlushDuration,
      largeSelectionRoutedRelationshipCount: largeSelectionDiagnostics.routedRelationshipCount,
      dirtyFlushDelta: Number(svg.dataset.diagram2DirtyFlushCount || 0) - flushCountBefore,
      relationshipNodeCount: document.querySelectorAll("[data-diagram2-relationship-id]").length
    };
  });

  expect(result.ready).toBe(true);
  expect(result.entityAStable).toBe(true);
  expect(result.entityBStable).toBe(true);
  expect(result.entityATextStable).toBe(true);
  expect(result.relationshipStable).toBe(true);
  expect(result.entityASelected).toBe(true);
  expect(result.selectionPatched).toBe(true);
  expect(result.fillPatched).toBe(true);
  expect(result.headerPatched).toBe(true);
  expect(result.transformChanged).toBe(true);
  expect(result.fullRenderCount).toBe(expectedFullRenderCount);
  expect(result.objectPatchedCount).toBe(0);
  expect(result.selectionRoutedRelationshipCount).toBe(0);
  expect(result.styleRoutedRelationshipCount).toBe(0);
  expect(result.stylePatchedNodeCount).toBe(1);
  expect(result.moveRoutedRelationshipCount).toBeGreaterThan(0);
  expect(result.moveSelectiveRelationshipsConsidered).toBeGreaterThan(0);
  expect(result.moveSelectiveRelationshipsConsidered).toBeLessThan(result.moveSelectiveTotalRelationships);
  expect(result.moveSelectiveRelationshipsRerouted).toBe(result.moveRoutedRelationshipCount);
  expect(result.moveSelectiveSpatialSectorsQueried).toBeGreaterThan(0);
  expect(result.batchFlushDelta).toBe(1);
  expect(result.batchPatchedNodeCount).toBe(2);
  expect(result.batchRoutedRelationshipCount).toBe(0);
  expect(result.transactionQueuedDirtyIds).toContain(",");
  expect(result.transactionPendingBeforeEnd).toBe(false);
  expect(result.largeSelectionCount).toBe(28);
  expect(result.largeSelectionDuration).toBeLessThan(50);
  expect(result.largeSelectionRoutedRelationshipCount).toBe(0);
  expect(result.dirtyFlushDelta).toBe(6);
  expect(result.relationshipNodeCount).toBe(78);
}

async function assertDiagram2SelectiveRoutingStress(page) {
  const result = await page.evaluate(async () => {
    const { createDiagram2Renderer } = await import("/js/features/diagram2/diagram2-renderer.js?v=20260726-diagram2-renderer-parity-v1");
    const host = document.createElement("div");
    host.style.position = "absolute";
    host.style.left = "-12000px";
    host.style.top = "0";
    host.style.width = "1200px";
    host.style.height = "800px";
    document.body.appendChild(host);

    const state = buildDiagram2StressState();
    const renderer = createDiagram2Renderer({ host });
    const initial = renderer.render(state, { reason: "stress initial" });
    const refresh = renderer.render(structuredClone(state), { reason: "stress cache refresh" });
    renderer.updateObject("entity-7", object => ({
      x: Number(object.x || 0) + 36,
      y: Number(object.y || 0) + 24
    }));
    const move = await renderer.whenIdle();
    renderer.updateObject("entity-8", { fill: "#f8fafc" });
    const style = await renderer.whenIdle();
    host.remove();

    return {
      initialRelationships: initial.canonicalRelationshipCount,
      initialRerouted: initial.selectiveRoutingRelationshipsRerouted,
      refreshConsidered: refresh.selectiveRoutingRelationshipsConsidered,
      refreshCacheHits: refresh.selectiveRoutingCacheHits,
      refreshCacheMisses: refresh.selectiveRoutingCacheMisses,
      refreshRerouted: refresh.selectiveRoutingRelationshipsRerouted,
      moveTotal: move.selectiveRoutingTotalRelationships,
      moveConsidered: move.selectiveRoutingRelationshipsConsidered,
      moveRerouted: move.selectiveRoutingRelationshipsRerouted,
      moveCacheMisses: move.selectiveRoutingCacheMisses,
      moveSectorsQueried: move.selectiveRoutingSpatialSectorsQueried,
      moveDuration: move.selectiveRoutingDuration,
      styleRerouted: style.selectiveRoutingRelationshipsRerouted,
      styleConsidered: style.selectiveRoutingRelationshipsConsidered,
      stylePatchedNodeCount: style.patchedNodeCount
    };

    function buildDiagram2StressState() {
      const entityCount = 232;
      const relationshipCount = 624;
      const columns = 29;
      const objects = Array.from({ length: entityCount }, (_, index) => {
        const name = `Stress${index}`;
        return {
          id: `entity-${index}`,
          type: "entity",
          x: (index % columns) * 260,
          y: Math.floor(index / columns) * 190,
          width: 220,
          height: 130,
          entitySchema: "dbo",
          entityName: name,
          fields: [
            { name: `${name}Id`, dataType: "INT", nullable: false, isPrimaryKey: true, isForeignKey: false, isImportant: true },
            { name: "Ref0Id", dataType: "INT", nullable: true, isPrimaryKey: false, isForeignKey: true },
            { name: "Ref1Id", dataType: "INT", nullable: true, isPrimaryKey: false, isForeignKey: true },
            { name: "Ref2Id", dataType: "INT", nullable: true, isPrimaryKey: false, isForeignKey: true },
            { name: "Ref3Id", dataType: "INT", nullable: true, isPrimaryKey: false, isForeignKey: true }
          ],
          foreignKeys: []
        };
      });

      for (let index = 0; index < relationshipCount; index += 1) {
        const sourceIndex = (index % (entityCount - 1)) + 1;
        let targetIndex = (sourceIndex + 17 + (index * 19)) % entityCount;
        if (targetIndex === sourceIndex) targetIndex = (targetIndex + 1) % entityCount;
        const targetName = `Stress${targetIndex}`;
        objects[sourceIndex].foreignKeys.push({
          name: `FK_Stress_${index}`,
          columns: [`Ref${index % 4}Id`],
          referencedSchema: "dbo",
          referencedTable: targetName,
          referencedColumns: [`${targetName}Id`],
          relationshipType: "many-to-one"
        });
      }

      return {
        width: columns * 260,
        height: 8 * 190,
        objects
      };
    }
  });

  expect(result.initialRelationships).toBe(624);
  expect(result.initialRerouted).toBe(624);
  expect(result.refreshConsidered).toBe(624);
  expect(result.refreshCacheHits).toBe(624);
  expect(result.refreshCacheMisses).toBe(0);
  expect(result.refreshRerouted).toBe(0);
  expect(result.moveTotal).toBe(624);
  expect(result.moveConsidered).toBeGreaterThan(0);
  expect(result.moveConsidered).toBeLessThan(624);
  expect(result.moveRerouted).toBeGreaterThan(0);
  expect(result.moveRerouted).toBeLessThan(624);
  expect(result.moveCacheMisses).toBe(result.moveRerouted);
  expect(result.moveSectorsQueried).toBeGreaterThan(0);
  expect(result.moveDuration).toBeGreaterThanOrEqual(0);
  expect(result.styleRerouted).toBe(0);
  expect(result.styleConsidered).toBe(0);
  expect(result.stylePatchedNodeCount).toBe(1);
}

async function assertDiagram2ViewportHaloVirtualization(page) {
  const result = await page.evaluate(async () => {
    const { createDiagram2Renderer } = await import("/js/features/diagram2/diagram2-renderer.js?v=20260726-diagram2-renderer-parity-v1");
    const host = document.createElement("div");
    host.style.position = "absolute";
    host.style.left = "-12000px";
    host.style.top = "0";
    host.style.width = "1200px";
    host.style.height = "800px";
    document.body.appendChild(host);

    const waitForViewport = () => new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
    const state = buildDiagram2HaloState();
    const renderer = createDiagram2Renderer({ host });
    const initial = renderer.render(state, { reason: "halo initial" });
    renderer.setZoom("1");
    await waitForViewport();
    const focused = renderer.diagnostics();
    const focusedObjectCount = host.querySelectorAll("[data-diagram2-object-id]").length;
    const focusedRelationshipCount = host.querySelectorAll("[data-diagram2-relationship-id]").length;
    const routeOnlyMounted = [...host.querySelectorAll("[data-diagram2-relationship-id]")]
      .filter(node => {
        const source = node.dataset.diagram2RelationshipSource;
        const target = node.dataset.diagram2RelationshipTarget;
        return source
          && target
          && !host.querySelector(`[data-diagram2-object-id="${CSS.escape(source)}"]`)
          && !host.querySelector(`[data-diagram2-object-id="${CSS.escape(target)}"]`);
      }).length;
    const previousObjectCount = focusedObjectCount;
    const previousRelationshipCount = focusedRelationshipCount;
    renderer.panBy(-48, 0);
    await waitForViewport();
    const sameSector = renderer.diagnostics();
    const sameSectorObjectCount = host.querySelectorAll("[data-diagram2-object-id]").length;
    const sameSectorRelationshipCount = host.querySelectorAll("[data-diagram2-relationship-id]").length;

    renderer.setSelectedIds(["halo-offscreen-selected"]);
    await renderer.whenIdle();
    renderer.panBy(1, 0);
    await waitForViewport();
    const forced = renderer.diagnostics();
    const selectedMounted = Boolean(host.querySelector('[data-diagram2-object-id="halo-offscreen-selected"]'));
    const selectedRelationships = [...host.querySelectorAll("[data-diagram2-relationship-id]")]
      .filter(node => node.dataset.diagram2RelationshipSource === "halo-offscreen-selected"
        || node.dataset.diagram2RelationshipTarget === "halo-offscreen-selected").length;
    host.remove();

    return {
      initialCanonicalObjects: initial.canonicalObjectCount,
      initialMountedObjects: initial.mountedObjectCount,
      focusedActive: focused.viewportHaloActive,
      focusedFallback: focused.viewportHaloFallbackReason,
      focusedCanonicalObjects: focused.canonicalObjectCount,
      focusedCanonicalRelationships: focused.canonicalRelationshipCount,
      focusedMountedObjects: focused.mountedObjectCount,
      focusedMountedRelationships: focused.mountedRelationshipCount,
      focusedObjectCount,
      focusedRelationshipCount,
      focusedVirtualizedObjects: focused.viewportHaloVirtualizedObjectCount,
      focusedVirtualizedRelationships: focused.viewportHaloVirtualizedRelationshipCount,
      focusedRoutedRelationships: focused.viewportHaloRoutedRelationshipCount,
      focusedFullRendersDuringSettle: focused.fullRendersDuringSettle,
      routeOnlyMounted,
      routeOnlyDiagnostics: focused.viewportHaloRouteOnlyRelationshipCount,
      sameSectorNoop: sameSector.viewportHaloSameSectorNoop,
      sameSectorEnteringObjects: sameSector.viewportHaloEnteringObjectCount,
      sameSectorLeavingObjects: sameSector.viewportHaloLeavingObjectCount,
      sameSectorObjectPatchCount: sameSector.viewportHaloObjectPatchCount,
      sameSectorRelationshipPatchCount: sameSector.viewportHaloRelationshipPatchCount,
      sameSectorObjectCount,
      sameSectorRelationshipCount,
      previousObjectCount,
      previousRelationshipCount,
      selectedMounted,
      selectedRelationships,
      forcedObjectCount: forced.mountedObjectCount,
      forcedRelationshipCount: forced.mountedRelationshipCount,
      forcedObjectForceCount: forced.viewportHaloForceMountedObjectCount,
      forcedRelationshipForceCount: forced.viewportHaloForceMountedRelationshipCount
    };

    function buildDiagram2HaloState() {
      const objects = [{
        id: "halo-route-left",
        type: "entity",
        x: -3300,
        y: 220,
        width: 180,
        height: 100,
        entitySchema: "dbo",
        entityName: "HaloLeft",
        fields: [
          { name: "HaloLeftId", dataType: "INT", nullable: false, isPrimaryKey: true, isImportant: true },
          { name: "HaloRightId", dataType: "INT", nullable: true, isForeignKey: true }
        ],
        foreignKeys: [{
          name: "FK_HaloLeft_HaloRight",
          columns: ["HaloRightId"],
          referencedSchema: "dbo",
          referencedTable: "HaloRight",
          referencedColumns: ["HaloRightId"],
          relationshipType: "many-to-one",
          routeOverride: [
            { x: -3120, y: 272 },
            { x: -128, y: 272 },
            { x: 3200, y: 272 },
            { x: 5200, y: 272 }
          ]
        }]
      }, {
        id: "halo-route-right",
        type: "entity",
        x: 5200,
        y: 220,
        width: 180,
        height: 100,
        entitySchema: "dbo",
        entityName: "HaloRight",
        fields: [
          { name: "HaloRightId", dataType: "INT", nullable: false, isPrimaryKey: true, isImportant: true }
        ],
        foreignKeys: []
      }, {
        id: "halo-offscreen-selected",
        type: "entity",
        x: 9000,
        y: 520,
        width: 180,
        height: 100,
        entitySchema: "dbo",
        entityName: "OffscreenSelected",
        fields: [
          { name: "OffscreenSelectedId", dataType: "INT", nullable: false, isPrimaryKey: true, isImportant: true },
          { name: "HaloRightId", dataType: "INT", nullable: true, isForeignKey: true }
        ],
        foreignKeys: [{
          name: "FK_OffscreenSelected_HaloRight",
          columns: ["HaloRightId"],
          referencedSchema: "dbo",
          referencedTable: "HaloRight",
          referencedColumns: ["HaloRightId"],
          relationshipType: "many-to-one"
        }]
      }];

      for (let index = 0; index < 217; index += 1) {
        const name = `Halo${index}`;
        objects.push({
          id: `halo-entity-${index}`,
          type: "entity",
          x: -9800 + (index * 96),
          y: 760 + ((index % 4) * 150),
          width: 84,
          height: 96,
          entitySchema: "dbo",
          entityName: name,
          fields: [
            { name: `${name}Id`, dataType: "INT", nullable: false, isPrimaryKey: true, isImportant: true }
          ],
          foreignKeys: []
        });
      }

      return {
        width: 19200,
        height: 1600,
        manualEntityRelationshipRoutes: true,
        objects
      };
    }
  });

  expect(result.initialCanonicalObjects).toBe(220);
  expect(result.initialMountedObjects).toBe(220);
  expect(result.focusedActive).toBe(true);
  expect(result.focusedFallback).toBe("");
  expect(result.focusedCanonicalObjects).toBe(220);
  expect(result.focusedCanonicalRelationships).toBe(2);
  expect(result.focusedMountedObjects).toBeLessThan(110);
  expect(result.focusedMountedRelationships).toBeLessThanOrEqual(2);
  expect(result.focusedObjectCount).toBe(result.focusedMountedObjects);
  expect(result.focusedRelationshipCount).toBe(result.focusedMountedRelationships);
  expect(result.focusedVirtualizedObjects).toBeGreaterThan(110);
  expect(result.focusedVirtualizedRelationships).toBeGreaterThanOrEqual(0);
  expect(result.focusedRoutedRelationships).toBe(0);
  expect(result.focusedFullRendersDuringSettle).toBe(0);
  expect(result.routeOnlyMounted).toBeGreaterThan(0);
  expect(result.routeOnlyDiagnostics).toBeGreaterThan(0);
  expect(result.sameSectorNoop).toBe(true);
  expect(result.sameSectorEnteringObjects).toBe(0);
  expect(result.sameSectorLeavingObjects).toBe(0);
  expect(result.sameSectorObjectPatchCount).toBe(0);
  expect(result.sameSectorRelationshipPatchCount).toBe(0);
  expect(result.sameSectorObjectCount).toBe(result.previousObjectCount);
  expect(result.sameSectorRelationshipCount).toBe(result.previousRelationshipCount);
  expect(result.selectedMounted).toBe(true);
  expect(result.selectedRelationships).toBeGreaterThan(0);
  expect(result.forcedObjectCount).toBeGreaterThan(result.sameSectorObjectCount);
  expect(result.forcedRelationshipCount).toBeGreaterThanOrEqual(result.sameSectorRelationshipCount);
  expect(result.forcedObjectForceCount).toBeGreaterThan(0);
  expect(result.forcedRelationshipForceCount).toBeGreaterThan(0);
}

async function assertDiagram2LowDetailOverviewRendering(page) {
  const result = await page.evaluate(async () => {
    const { createDiagram2Renderer } = await import("/js/features/diagram2/diagram2-renderer.js?v=20260726-diagram2-renderer-parity-v1");
    const host = document.createElement("div");
    host.style.position = "absolute";
    host.style.left = "-12000px";
    host.style.top = "0";
    host.style.width = "1200px";
    host.style.height = "800px";
    document.body.appendChild(host);

    const waitForViewport = () => new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
    const state = buildDiagram2OverviewState();
    const renderer = createDiagram2Renderer({ host });
    const initial = renderer.render(state, { reason: "overview initial" });
    const initialDescendantCount = renderer.svgNode().querySelectorAll("*").length;
    const initialFieldTextCount = host.querySelectorAll("[data-diagram2-entity-field]").length;
    const initialRelationshipPath = host.querySelector("[data-diagram2-relationship-path]")?.getAttribute("d") || "";

    renderer.setZoom("0.1");
    await waitForViewport();
    const low = renderer.diagnostics();
    const lowDescendantCount = renderer.svgNode().querySelectorAll("*").length;
    const lowFieldTextCount = host.querySelectorAll("[data-diagram2-entity-field]").length;
    const lowTitleCount = host.querySelectorAll("[data-diagram2-entity-title]").length;
    const lowCompactKeyCount = host.querySelectorAll("[data-diagram2-entity-compact-key]").length;
    const lowRelationshipPaths = [...host.querySelectorAll("[data-diagram2-relationship-path]")]
      .map(path => path.getAttribute("d") || "");
    const lowRelationshipMaxCommandCount = Math.max(
      0,
      ...lowRelationshipPaths.map(path => (path.match(/[ML]/g) || []).length)
    );

    renderer.panBy(-120, 0);
    await waitForViewport();
    const lowPan = renderer.diagnostics();

    renderer.setZoom("0.18");
    await waitForViewport();
    const nearThreshold = renderer.diagnostics();

    renderer.setZoom("1");
    await waitForViewport();
    const detailed = renderer.diagnostics();
    const restoredFieldTextCount = host.querySelectorAll("[data-diagram2-entity-field]").length;
    const restoredDescendantCount = renderer.svgNode().querySelectorAll("*").length;
    const restoredRelationshipPaths = [...host.querySelectorAll("[data-diagram2-relationship-path]")]
      .map(path => path.getAttribute("d") || "");
    const restoredRelationshipMaxCommandCount = Math.max(
      0,
      ...restoredRelationshipPaths.map(path => (path.match(/[ML]/g) || []).length)
    );
    host.remove();

    return {
      initialCanonicalObjects: initial.canonicalObjectCount,
      initialCanonicalRelationships: initial.canonicalRelationshipCount,
      initialDetailLevel: initial.overviewDetailLevel,
      initialDescendantCount,
      initialFieldTextCount,
      initialRelationshipCommandCount: (initialRelationshipPath.match(/[ML]/g) || []).length,
      lowDetailLevel: low.overviewDetailLevel,
      lowChanged: low.overviewDetailChanged,
      lowProjectedRows: low.overviewDetailProjectedRowPixels,
      lowObjectPatches: low.overviewDetailObjectPatchCount,
      lowRelationshipPatches: low.overviewDetailRelationshipPatchCount,
      lowDescendantCount,
      lowFieldTextCount,
      lowTitleCount,
      lowCompactKeyCount,
      lowMountedObjects: low.mountedObjectCount,
      lowMountedRelationships: low.mountedRelationshipCount,
      lowRelationshipPathCount: lowRelationshipPaths.length,
      lowRelationshipMaxCommandCount,
      lowFullRendersDuringSettle: low.fullRendersDuringSettle,
      lowPanFullRendersDuringSettle: lowPan.fullRendersDuringSettle,
      lowPanDetailLevel: lowPan.overviewDetailLevel,
      nearThresholdLevel: nearThreshold.overviewDetailLevel,
      nearThresholdChanged: nearThreshold.overviewDetailChanged,
      nearThresholdProjectedRows: nearThreshold.overviewDetailProjectedRowPixels,
      detailedLevel: detailed.overviewDetailLevel,
      detailedChanged: detailed.overviewDetailChanged,
      detailedProjectedRows: detailed.overviewDetailProjectedRowPixels,
      restoredFieldTextCount,
      restoredDescendantCount,
      restoredRelationshipPathCount: restoredRelationshipPaths.length,
      restoredRelationshipCommandCount: restoredRelationshipMaxCommandCount,
      finalCanonicalObjects: detailed.canonicalObjectCount,
      finalCanonicalRelationships: detailed.canonicalRelationshipCount,
      finalFullRendersDuringSettle: detailed.fullRendersDuringSettle
    };

    function buildDiagram2OverviewState() {
      const entityCount = 224;
      const relationshipCount = 448;
      const columns = 28;
      const objects = Array.from({ length: entityCount }, (_, index) => {
        const name = `Overview${index}`;
        return {
          id: `overview-entity-${index}`,
          type: "entity",
          x: (index % columns) * 260,
          y: Math.floor(index / columns) * 190,
          width: 220,
          height: 160,
          entitySchema: "dbo",
          entityName: name,
          fields: [
            { name: `${name}Id`, dataType: "INT", nullable: false, isPrimaryKey: true, isForeignKey: false, isImportant: true },
            { name: "Ref0Id", dataType: "INT", nullable: true, isPrimaryKey: false, isForeignKey: true },
            { name: "Ref1Id", dataType: "INT", nullable: true, isPrimaryKey: false, isForeignKey: true },
            { name: "Ref2Id", dataType: "INT", nullable: true, isPrimaryKey: false, isForeignKey: true },
            { name: "Ref3Id", dataType: "INT", nullable: true, isPrimaryKey: false, isForeignKey: true },
            { name: "Name", dataType: "NVARCHAR(240)", nullable: false },
            { name: "CreatedAt", dataType: "DATETIME2", nullable: false },
            { name: "UpdatedAt", dataType: "DATETIME2", nullable: false }
          ],
          foreignKeys: []
        };
      });

      for (let index = 0; index < relationshipCount; index += 1) {
        const sourceIndex = (index % (entityCount - 1)) + 1;
        let targetIndex = (sourceIndex + 11 + (index * 13)) % entityCount;
        if (targetIndex === sourceIndex) targetIndex = (targetIndex + 1) % entityCount;
        const targetName = `Overview${targetIndex}`;
        objects[sourceIndex].foreignKeys.push({
          name: `FK_Overview_${index}`,
          columns: [`Ref${index % 4}Id`],
          referencedSchema: "dbo",
          referencedTable: targetName,
          referencedColumns: [`${targetName}Id`],
          relationshipType: "many-to-one"
        });
      }

      return {
        width: columns * 260,
        height: 8 * 190,
        objects
      };
    }
  });

  expect(result.initialCanonicalObjects).toBe(224);
  expect(result.initialCanonicalRelationships).toBe(448);
  expect(result.initialDetailLevel).toBe("detailed");
  expect(result.initialFieldTextCount).toBeGreaterThan(1000);
  expect(result.lowDetailLevel).toBe("low");
  expect(result.lowChanged).toBe(true);
  expect(result.lowProjectedRows).toBeLessThan(4);
  expect(result.lowObjectPatches).toBeGreaterThan(0);
  expect(result.lowRelationshipPatches).toBeGreaterThan(0);
  expect(result.lowDescendantCount).toBeLessThan(result.initialDescendantCount * 0.65);
  expect(result.lowFieldTextCount).toBe(0);
  expect(result.lowTitleCount).toBe(result.lowMountedObjects);
  expect(result.lowCompactKeyCount).toBe(result.lowMountedObjects);
  expect(result.lowRelationshipPathCount).toBe(result.lowMountedRelationships);
  expect(result.lowRelationshipMaxCommandCount).toBeLessThanOrEqual(2);
  expect(result.lowFullRendersDuringSettle).toBe(0);
  expect(result.lowPanFullRendersDuringSettle).toBe(0);
  expect(result.lowPanDetailLevel).toBe("low");
  expect(result.nearThresholdLevel).toBe("low");
  expect(result.nearThresholdChanged).toBe(false);
  expect(result.nearThresholdProjectedRows).toBeGreaterThan(4);
  expect(result.detailedLevel).toBe("detailed");
  expect(result.detailedChanged).toBe(true);
  expect(result.detailedProjectedRows).toBeGreaterThan(6);
  expect(result.restoredFieldTextCount).toBeGreaterThan(0);
  expect(result.restoredDescendantCount).toBeGreaterThan(result.lowDescendantCount);
  expect(result.restoredRelationshipPathCount).toBe(result.finalCanonicalRelationships);
  expect(result.restoredRelationshipCommandCount).toBeGreaterThanOrEqual(result.lowRelationshipMaxCommandCount);
  expect(result.finalCanonicalObjects).toBe(224);
  expect(result.finalCanonicalRelationships).toBe(448);
  expect(result.finalFullRendersDuringSettle).toBe(0);
}

async function assertDiagram2LiveGeometryPreview(page, expectedFullRenderCount) {
  const result = await page.evaluate(async () => {
    const renderer = window.__pmtDiagram2Renderer;
    const svg = document.querySelector("[data-diagram2-svg]");
    const objectPlane = document.querySelector("[data-diagram2-object-plane]");
    const entities = [...(objectPlane?.querySelectorAll("[data-diagram2-object-type='entity']") || [])];
    const relationship = [...document.querySelectorAll("[data-diagram2-relationship-id]")]
      .find(candidate => candidate.dataset.diagram2RelationshipSource
        && objectPlane?.querySelector(`[data-diagram2-object-id="${CSS.escape(candidate.dataset.diagram2RelationshipSource)}"]`));
    const entityA = relationship?.dataset.diagram2RelationshipSource
      ? objectPlane?.querySelector(`[data-diagram2-object-id="${CSS.escape(relationship.dataset.diagram2RelationshipSource)}"]`)
      : entities[0] || null;
    const entityB = entities.find(entity => entity !== entityA) || null;
    const entityC = entities.find(entity => entity !== entityA && entity !== entityB) || entityB;
    if (!renderer || !svg || !relationship || !entityA || !entityB || !entityC) return { ready: false };

    const entityAId = entityA.dataset.diagram2ObjectId;
    const entityBId = entityB.dataset.diagram2ObjectId;
    const entityCId = entityC.dataset.diagram2ObjectId;
    const relationshipId = relationship.dataset.diagram2RelationshipId;
    const entityAText = entityA.querySelector("[data-diagram2-entity-title], text") || null;

    renderer.setSelectedIds([entityAId]);
    await renderer.whenIdle();
    const dirtyFlushAfterSelection = Number(svg.dataset.diagram2DirtyFlushCount || 0);
    const transformBeforeMove = entityA.getAttribute("transform") || "";
    const undoBeforeMove = Number(svg.dataset.diagram2GeometryPreviewUndoEntryCount || 0);
    const commitBeforeMove = Number(svg.dataset.diagram2GeometryPreviewCommitCount || 0);
    const previewFrameBeforeMove = Number(svg.dataset.diagram2GeometryPreviewFrameCount || 0);

    const startDiagnostics = renderer.beginGeometryPreview({ objectId: entityAId, mode: "move" });
    renderer.previewGeometry({ deltaX: 36, deltaY: 22 });
    const pendingAfterFirstMove = renderer.diagnostics().pendingGeometryPreview;
    renderer.previewGeometry({ deltaX: 72, deltaY: 35 });
    const movePreviewDiagnostics = await renderer.whenIdle();
    const transformDuringMove = entityA.getAttribute("transform") || "";
    const dirtyFlushDuringPreview = Number(svg.dataset.diagram2DirtyFlushCount || 0);
    const previewPathCountDuringMove = document.querySelectorAll("[data-diagram2-relationship-preview-path]").length;

    renderer.commitGeometryPreview();
    const moveCommitDiagnostics = await renderer.whenIdle();
    const transformAfterCommit = entityA.getAttribute("transform") || "";
    const dirtyFlushAfterCommit = Number(svg.dataset.diagram2DirtyFlushCount || 0);
    const fullRenderAfterCommit = Number(svg.dataset.diagram2FullRenderCount || 0);

    renderer.setSelectedIds([entityAId, entityBId]);
    await renderer.whenIdle();
    const dirtyFlushBeforeMulti = Number(svg.dataset.diagram2DirtyFlushCount || 0);
    const undoBeforeMulti = Number(svg.dataset.diagram2GeometryPreviewUndoEntryCount || 0);
    const transformABeforeMulti = entityA.getAttribute("transform") || "";
    const transformBBeforeMulti = entityB.getAttribute("transform") || "";

    renderer.beginGeometryPreview({ objectId: entityAId, mode: "move" });
    renderer.previewGeometry({ deltaX: -18, deltaY: 12 });
    const multiPreviewDiagnostics = await renderer.whenIdle();
    const transformADuringMulti = entityA.getAttribute("transform") || "";
    const transformBDuringMulti = entityB.getAttribute("transform") || "";
    renderer.cancelGeometryPreview();
    const multiCancelDiagnostics = renderer.diagnostics();
    const dirtyFlushAfterMultiCancel = Number(svg.dataset.diagram2DirtyFlushCount || 0);

    renderer.setSelectedIds([entityCId]);
    await renderer.whenIdle();
    const dirtyFlushBeforeResize = Number(svg.dataset.diagram2DirtyFlushCount || 0);
    const resizeNodeBefore = entityC;
    const resizeBodyBefore = Number(entityC.querySelector("[data-diagram2-entity-body]")?.getAttribute("width") || 0);
    const undoBeforeResize = Number(svg.dataset.diagram2GeometryPreviewUndoEntryCount || 0);

    renderer.beginGeometryPreview({ objectId: entityCId, mode: "resize" });
    renderer.previewGeometry({ deltaWidth: 28, deltaHeight: 14 });
    const resizePreviewDiagnostics = await renderer.whenIdle();
    const resizeBodyDuring = Number(entityC.querySelector("[data-diagram2-entity-body]")?.getAttribute("width") || 0);
    renderer.cancelGeometryPreview();
    const resizeCancelDiagnostics = renderer.diagnostics();
    const resizeBodyAfterCancel = Number(entityC.querySelector("[data-diagram2-entity-body]")?.getAttribute("width") || 0);
    const dirtyFlushAfterResizeCancel = Number(svg.dataset.diagram2DirtyFlushCount || 0);

    return {
      ready: true,
      previewStarted: startDiagnostics.geometryPreviewActive,
      pendingAfterFirstMove,
      transformMovedDuringPreview: transformBeforeMove !== transformDuringMove,
      previewPathCountDuringMove,
      movePreviewRelationshipCount: movePreviewDiagnostics.geometryPreviewRelationshipCount,
      movePreviewPatchedObjectCount: movePreviewDiagnostics.geometryPreviewPatchedObjectCount,
      movePreviewFrameDelta: movePreviewDiagnostics.geometryPreviewFrameCount - previewFrameBeforeMove,
      dirtyPreviewDelta: dirtyFlushDuringPreview - dirtyFlushAfterSelection,
      fullRenderAfterCommit,
      transformCommitted: transformAfterCommit !== transformBeforeMove,
      moveCommitDelta: moveCommitDiagnostics.geometryPreviewCommitCount - commitBeforeMove,
      moveUndoDelta: moveCommitDiagnostics.geometryPreviewUndoEntryCount - undoBeforeMove,
      moveDirtyFlushDelta: dirtyFlushAfterCommit - dirtyFlushAfterSelection,
      moveRoutedRelationshipCount: moveCommitDiagnostics.routedRelationshipCount,
      previewActiveAfterCommit: moveCommitDiagnostics.geometryPreviewActive,
      previewPathCountAfterCommit: document.querySelectorAll("[data-diagram2-relationship-preview-path]").length,
      entityAStableAfterCommit: entityA === objectPlane.querySelector(`[data-diagram2-object-id="${CSS.escape(entityAId)}"]`),
      entityATextStableAfterCommit: entityAText === entityA.querySelector("[data-diagram2-entity-title], text"),
      relationshipStableAfterCommit: relationship === document.querySelector(`[data-diagram2-relationship-id="${CSS.escape(relationshipId)}"]`),
      multiPreviewObjectIds: multiPreviewDiagnostics.geometryPreviewObjectIds,
      multiMovesBothObjects: transformABeforeMulti !== transformADuringMulti && transformBBeforeMulti !== transformBDuringMulti,
      multiCancelRestored: transformABeforeMulti === (entityA.getAttribute("transform") || "")
        && transformBBeforeMulti === (entityB.getAttribute("transform") || ""),
      multiCancelNoDirtyFlush: dirtyFlushAfterMultiCancel === dirtyFlushBeforeMulti,
      multiCancelNoUndo: multiCancelDiagnostics.geometryPreviewUndoEntryCount === undoBeforeMulti,
      resizeNodeStable: resizeNodeBefore === objectPlane.querySelector(`[data-diagram2-object-id="${CSS.escape(entityCId)}"]`),
      resizeWidthExpanded: resizeBodyDuring > resizeBodyBefore,
      resizeCancelRestored: resizeBodyAfterCancel === resizeBodyBefore,
      resizePreviewPatchedObjectCount: resizePreviewDiagnostics.geometryPreviewPatchedObjectCount,
      resizeCancelNoDirtyFlush: dirtyFlushAfterResizeCancel === dirtyFlushBeforeResize,
      resizeCancelNoUndo: resizeCancelDiagnostics.geometryPreviewUndoEntryCount === undoBeforeResize
    };
  });

  expect(result.ready).toBe(true);
  expect(result.previewStarted).toBe(true);
  expect(result.pendingAfterFirstMove).toBe(true);
  expect(result.transformMovedDuringPreview).toBe(true);
  expect(result.previewPathCountDuringMove).toBeGreaterThan(0);
  expect(result.movePreviewRelationshipCount).toBeGreaterThan(0);
  expect(result.movePreviewPatchedObjectCount).toBe(1);
  expect(result.movePreviewFrameDelta).toBeGreaterThanOrEqual(1);
  expect(result.dirtyPreviewDelta).toBe(0);
  expect(result.fullRenderAfterCommit).toBe(expectedFullRenderCount);
  expect(result.transformCommitted).toBe(true);
  expect(result.moveCommitDelta).toBe(1);
  expect(result.moveUndoDelta).toBe(1);
  expect(result.moveDirtyFlushDelta).toBe(1);
  expect(result.moveRoutedRelationshipCount).toBeGreaterThan(0);
  expect(result.previewActiveAfterCommit).toBe(false);
  expect(result.previewPathCountAfterCommit).toBe(0);
  expect(result.entityAStableAfterCommit).toBe(true);
  expect(result.entityATextStableAfterCommit).toBe(true);
  expect(result.relationshipStableAfterCommit).toBe(true);
  expect(result.multiPreviewObjectIds).toContain(",");
  expect(result.multiMovesBothObjects).toBe(true);
  expect(result.multiCancelRestored).toBe(true);
  expect(result.multiCancelNoDirtyFlush).toBe(true);
  expect(result.multiCancelNoUndo).toBe(true);
  expect(result.resizeNodeStable).toBe(true);
  expect(result.resizeWidthExpanded).toBe(true);
  expect(result.resizeCancelRestored).toBe(true);
  expect(result.resizePreviewPatchedObjectCount).toBe(1);
  expect(result.resizeCancelNoDirtyFlush).toBe(true);
  expect(result.resizeCancelNoUndo).toBe(true);
}

async function assertTransformOnlyPan(page, expectedFullRenderCount) {
  const canvas = page.locator("[data-diagram2-viewer-canvas]");
  const box = await canvas.boundingBox();
  await page.locator("[data-diagram2-tool='pan']").click();
  await expect(page.locator("[data-diagram2-tool='pan']")).toHaveAttribute("aria-pressed", "true");
  const before = await diagram2StabilitySnapshot(page);
  await page.mouse.move(box.x + (box.width / 2), box.y + (box.height / 2));
  await page.mouse.down();
  await page.mouse.move(box.x + (box.width / 2) + 80, box.y + (box.height / 2) + 42);
  await page.mouse.up();
  await waitForViewportReason(page, "pan");
  const afterFrame = await diagram2StabilitySnapshot(page);
  await waitForStableAnimationFrame(page);
  const afterSettle = await diagram2StabilitySnapshot(page);

  expect(afterFrame.svgStable).toBe(true);
  expect(afterFrame.entityStable).toBe(true);
  expect(afterFrame.textStable).toBe(true);
  expect(afterFrame.fullRenderCount).toBe(expectedFullRenderCount);
  expect(afterFrame.fullRendersDuringSettle).toBe(0);
  expect(afterFrame.routesRecalculatedDuringSettle).toBe(0);
  expect(afterFrame.translateX).not.toBe(before.translateX);
  expect(afterFrame.translateY).not.toBe(before.translateY);
  expect(maxRectMovement(afterFrame.entityRect, afterSettle.entityRect).translation).toBeLessThanOrEqual(0.25);
  expect(maxRectMovement(afterFrame.entityRect, afterSettle.entityRect).size).toBeLessThanOrEqual(0.25);
  await page.locator("[data-diagram2-tool='select']").click();
  await expect(page.locator("[data-diagram2-tool='select']")).toHaveAttribute("aria-pressed", "true");
}

async function assertCursorCenteredWheelZoom(page, expectedFullRenderCount) {
  const surface = page.locator("[data-diagram2-renderer-surface]");
  const box = await surface.boundingBox();
  const clientX = box.x + (box.width * 0.42);
  const clientY = box.y + (box.height * 0.37);
  const before = await diagram2StabilitySnapshot(page);
  await page.mouse.move(clientX, clientY);
  await page.mouse.wheel(0, -240);
  await waitForViewportReason(page, "wheel zoom");
  const afterFrame = await diagram2StabilitySnapshot(page);
  await waitForStableAnimationFrame(page);
  const afterSettle = await diagram2StabilitySnapshot(page);
  const cursor = parseDiagram2Point(afterFrame.cursorScreenPoint);
  const screenAfter = parseDiagram2Point(afterFrame.screenPointAfterSettle);

  expect(afterFrame.scale).toBeGreaterThan(before.scale);
  expect(afterFrame.svgStable).toBe(true);
  expect(afterFrame.entityStable).toBe(true);
  expect(afterFrame.textStable).toBe(true);
  expect(afterFrame.fullRenderCount).toBe(expectedFullRenderCount);
  expect(afterFrame.fullRendersDuringSettle).toBe(0);
  expect(afterFrame.routesRecalculatedDuringSettle).toBe(0);
  expect(Math.abs(cursor.x - screenAfter.x)).toBeLessThanOrEqual(0.25);
  expect(Math.abs(cursor.y - screenAfter.y)).toBeLessThanOrEqual(0.25);
  expect(maxRectMovement(afterFrame.entityRect, afterSettle.entityRect).translation).toBeLessThanOrEqual(0.25);
  expect(maxRectMovement(afterFrame.entityRect, afterSettle.entityRect).size).toBeLessThanOrEqual(0.25);
}

async function waitForViewportReason(page, reason) {
  await expect.poll(() =>
    page.evaluate(() => document.querySelector("[data-diagram2-svg]")?.dataset.diagram2ViewportReason || "")
  ).toBe(reason);
}

function nextDiagram2TestZoomValue(currentZoom, direction) {
  const current = Math.round((Number(currentZoom) || 1) / 0.05) * 0.05;
  const next = Math.min(3, Math.max(0.1, current + (direction > 0 ? 0.05 : -0.05)));
  return String(Number(next.toFixed(2)));
}

async function diagram2ViewportScale(page) {
  return page.evaluate(() => Number(document.querySelector("[data-diagram2-svg]")?.dataset.diagram2ViewportScale || 0));
}

async function diagram2FullRenderCount(page) {
  return page.evaluate(() => Number(document.querySelector("[data-diagram2-svg]")?.dataset.diagram2FullRenderCount || 0));
}

async function diagram2StabilitySnapshot(page) {
  return page.evaluate(() => {
    const svg = document.querySelector("[data-diagram2-svg]");
    const entity = document.querySelector("[data-diagram2-object-plane] [data-diagram2-object-type='entity']");
    const text = entity?.querySelector("text") || null;
    const rect = entity?.getBoundingClientRect();
    return {
      svgStable: svg === window.__diagram2StableSvg,
      entityStable: entity === window.__diagram2StableEntity,
      textStable: text === window.__diagram2StableText,
      entityRect: rect ? {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      } : null,
      scale: Number(svg?.dataset.diagram2ViewportScale || 0),
      translateX: Number(svg?.dataset.diagram2ViewportTranslateX || 0),
      translateY: Number(svg?.dataset.diagram2ViewportTranslateY || 0),
      fullRenderCount: Number(svg?.dataset.diagram2FullRenderCount || 0),
      fullRendersDuringSettle: Number(svg?.dataset.diagram2FullRendersDuringSettle || 0),
      routesRecalculatedDuringSettle: Number(svg?.dataset.diagram2RoutesRecalculatedDuringSettle || 0),
      nodeIdentityBeforeAfter: svg?.dataset.diagram2NodeIdentityBeforeAfter || "",
      cursorScreenPoint: svg?.dataset.diagram2CursorScreenPoint || "",
      screenPointAfterSettle: svg?.dataset.diagram2ScreenPointAfterSettle || ""
    };
  });
}

async function waitForStableAnimationFrame(page) {
  await page.evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

function maxRectMovement(first, second) {
  if (!first || !second) return { translation: Number.POSITIVE_INFINITY, size: Number.POSITIVE_INFINITY };
  return {
    translation: Math.max(Math.abs(first.x - second.x), Math.abs(first.y - second.y)),
    size: Math.max(Math.abs(first.width - second.width), Math.abs(first.height - second.height))
  };
}

function parseDiagram2Point(value) {
  const match = String(value || "").match(/\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)/);
  return {
    x: Number(match?.[1] || Number.NaN),
    y: Number(match?.[2] || Number.NaN)
  };
}

function testState() {
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
    projects: [{ id: 1, code: "PMT", title: "Diagram 2 Test", name: "Diagram 2 Test", isActive: true }],
    sprints: [],
    tasks: [],
    devLogs: [],
    blogs: [{
      id: 42,
      title: "PMT Database Schema",
      isPrivate: false,
      createdByUserId: 1,
      updatedByUserId: 1,
      projectId: 1,
      sprintId: null,
      createdAt: "2026-07-24T10:00:00Z",
      updatedAt: "2026-07-25T12:00:00Z",
      bodyHtml: pmtDatabaseSchemaBodyHtml()
    }, {
      id: 77,
      title: "Checkout Flow",
      isPrivate: true,
      createdByUserId: 1,
      updatedByUserId: 1,
      projectId: 1,
      sprintId: null,
      createdAt: "2026-07-24T09:00:00Z",
      updatedAt: "2026-07-25T11:00:00Z",
      bodyHtml: diagramBodyHtml("Checkout Flow", "#22c55e")
    }],
    auditEvents: [],
    lookups: [{
      id: 1,
      lookupType: "Release Type",
      value: "Internal",
      displayOrder: 10,
      isActive: true
    }],
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

function pmtDatabaseSchemaBodyHtml() {
  return `<p><img data-pmt-diagram="true" data-pmt-private-diagram="true" src="/assets/docs/pmt-database-schema.svg?v=20260725-diagram2-day14-fixture" alt="PMT Database Schema"></p>`;
}

function diagramBodyHtml(title, stroke) {
  const state = normalizeAnnotationState({
    width: 640,
    height: 360,
    objects: [{
      id: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-box`,
      type: "rectangle",
      x: 120,
      y: 96,
      width: 280,
      height: 120,
      fill: "#ffffff",
      stroke,
      strokeWidth: 3
    }, {
      id: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-label`,
      type: "textbox",
      x: 150,
      y: 132,
      width: 220,
      height: 58,
      text: title,
      fontSize: 24,
      textColor: "#172b4d"
    }]
  });
  const svg = buildAnnotationSvg(state);
  const source = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
  return `<p><img data-pmt-diagram="true" data-pmt-private-diagram="true" src="${source}" alt="${title}"></p>`;
}

function simpleTextBoxBodyHtml() {
  const state = normalizeAnnotationState({
    width: 640,
    height: 360,
    objects: [{
      id: "simple-textbox",
      type: "textbox",
      x: 120,
      y: 96,
      width: 260,
      height: 86,
      text: "Simple Text Box",
      fill: "#ffffff",
      stroke: "#2563eb",
      strokeWidth: 2,
      fontSize: 28,
      textColor: "#172b4d",
      textAlign: "center",
      textVerticalAlign: "middle"
    }]
  });
  const svg = buildAnnotationSvg(state);
  const source = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
  return `<p><img data-pmt-diagram="true" data-pmt-private-diagram="true" src="${source}" alt="Simple Text Box"></p>`;
}

function simpleTextBoxParityState() {
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
    projects: [{ id: 1, code: "PMT", title: "Diagram 2 Test", name: "Diagram 2 Test", isActive: true }],
    sprints: [],
    tasks: [],
    devLogs: [],
    blogs: [{
      id: 22,
      title: "Simple Text Box",
      isPrivate: false,
      createdByUserId: 1,
      updatedByUserId: 1,
      projectId: 1,
      sprintId: null,
      rowVersion: "row-1",
      createdAt: "2026-07-24T10:00:00Z",
      updatedAt: "2026-07-25T12:00:00Z",
      bodyHtml: simpleTextBoxBodyHtml()
    }],
    auditEvents: [],
    lookups: [{
      id: 1,
      lookupType: "Release Type",
      value: "Internal",
      displayOrder: 10,
      isActive: true
    }],
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

function roundtripState() {
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
    projects: [{ id: 1, code: "PMT", title: "Diagram 2 Test", name: "Diagram 2 Test", isActive: true }],
    sprints: [],
    tasks: [],
    devLogs: [],
    blogs: [{
      id: 88,
      title: "Diagram 2 Roundtrip",
      isPrivate: false,
      createdByUserId: 1,
      updatedByUserId: 1,
      projectId: 1,
      sprintId: null,
      rowVersion: "row-1",
      createdAt: "2026-07-24T10:00:00Z",
      updatedAt: "2026-07-25T12:00:00Z",
      bodyHtml: diagramBodyHtml("Roundtrip", "#2563eb")
    }],
    auditEvents: [],
    lookups: [{
      id: 1,
      lookupType: "Release Type",
      value: "Internal",
      displayOrder: 10,
      isActive: true
    }],
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

function readOnlyState() {
  return {
    users: [{
      id: 2,
      nickname: "Reader",
      email: "reader@example.test",
      role: "Developer",
      roleCode: "Developer",
      isAdmin: false,
      isActive: true,
      avatarUrl: ""
    }],
    projects: [{ id: 1, code: "PMT", title: "Diagram 2 Test", name: "Diagram 2 Test", isActive: true }],
    sprints: [],
    tasks: [],
    devLogs: [],
    blogs: [{
      id: 77,
      title: "Public Read-Only Diagram",
      isPrivate: false,
      createdByUserId: 1,
      updatedByUserId: 1,
      projectId: 1,
      sprintId: null,
      rowVersion: "row-public",
      createdAt: "2026-07-24T10:00:00Z",
      updatedAt: "2026-07-25T12:00:00Z",
      bodyHtml: diagramBodyHtml("Public Read-Only Diagram", "#64748b")
    }, {
      id: 78,
      title: "Hidden Private Diagram",
      isPrivate: true,
      createdByUserId: 1,
      updatedByUserId: 1,
      projectId: 1,
      sprintId: null,
      rowVersion: "row-private",
      createdAt: "2026-07-24T10:00:00Z",
      updatedAt: "2026-07-25T12:00:00Z",
      bodyHtml: diagramBodyHtml("Hidden Private Diagram", "#ef4444")
    }],
    auditEvents: [],
    lookups: [{
      id: 1,
      lookupType: "Release Type",
      value: "Internal",
      displayOrder: 10,
      isActive: true
    }],
    roles: [{
      id: 1,
      lookupType: "Role",
      value: "Developer",
      code: "Developer",
      displayOrder: 10,
      isActive: true
    }],
    holidays: [],
    securityResources: [],
    rolePermissions: [],
    userPermissions: [],
    effectivePermissions: [{
      resourceKey: "Dashboard",
      canRead: true,
      canCreate: false,
      canUpdate: false,
      canDelete: false,
      canImport: false,
      canExport: false,
      noAccess: false
    }, {
      resourceKey: "Documentation",
      canRead: true,
      canCreate: false,
      canUpdate: false,
      canDelete: false,
      canImport: false,
      canExport: true,
      noAccess: false
    }]
  };
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
