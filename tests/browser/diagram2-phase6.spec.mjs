import { expect, test } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  annotationEntityFieldBounds,
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
  const readOnlyPane = page.locator("[data-diagram2-readonly-shell] [data-diagram2-mapping-pane]");
  const readOnlyUiField = readOnlyPane.locator(
    "[data-diagram2-mapping-pane-field][data-diagram2-field-mapping-cell-kind='ui']"
  ).first();
  const readOnlyDatabaseCell = readOnlyPane.locator(
    "[data-diagram2-mapping-pane-field][data-diagram2-field-mapping-cell-kind='database']"
  ).first();
  await expect(readOnlyPane).toBeVisible();
  await expect(readOnlyPane).toHaveAttribute("data-diagram2-mapping-count", "1");
  await expect(readOnlyUiField).toContainText("TaskId");
  await expect(readOnlyDatabaseCell).toContainText("pmt.Phase6Entity.TaskId");
  const mappingColumnHeaders = readOnlyPane.locator("[data-diagram2-mapping-column-headers]");
  const mappingHeaderCells = mappingColumnHeaders.locator(".diagram2-mapping-pane-column-header");
  await expect(mappingHeaderCells).toHaveText(["UI Field", "Database Field"]);
  expect(await mappingColumnHeaders.evaluate(header => {
    const style = getComputedStyle(header);
    return [style.borderTopStyle, style.borderBottomStyle];
  })).toEqual(["solid", "solid"]);
  const mappingHeaderStyle = async () => mappingHeaderCells.first().evaluate(header => {
    const style = getComputedStyle(header);
    return {
      backgroundColor: style.backgroundColor,
      color: style.color,
      fontWeight: style.fontWeight
    };
  });
  const headerStyleBeforeHover = await mappingHeaderStyle();
  await mappingHeaderCells.first().hover();
  expect(await mappingHeaderStyle()).toEqual(headerStyleBeforeHover);

  const mappingColumnResizer = mappingColumnHeaders.locator("[data-diagram2-mapping-column-resizer]");
  const mappingColumnWidthsBefore = await readOnlyPane.evaluate(pane => ({
    header: pane.querySelector(".diagram2-mapping-pane-column-header")?.getBoundingClientRect().width || 0,
    ui: pane.querySelector("[data-diagram2-field-mapping-cell-kind='ui']")?.getBoundingClientRect().width || 0,
    database: pane.querySelector("[data-diagram2-field-mapping-cell-kind='database']")?.getBoundingClientRect().width || 0
  }));
  expect(Math.abs(mappingColumnWidthsBefore.header - mappingColumnWidthsBefore.ui)).toBeLessThanOrEqual(1);
  expect(mappingColumnWidthsBefore.ui).toBeLessThan(mappingColumnWidthsBefore.database);
  const mappingColumnResizerBox = await mappingColumnResizer.boundingBox();
  expect(mappingColumnResizerBox).toBeTruthy();
  await page.mouse.move(
    mappingColumnResizerBox.x + (mappingColumnResizerBox.width / 2),
    mappingColumnResizerBox.y + (mappingColumnResizerBox.height / 2)
  );
  await page.mouse.down();
  await page.mouse.move(
    mappingColumnResizerBox.x + (mappingColumnResizerBox.width / 2) + 48,
    mappingColumnResizerBox.y + (mappingColumnResizerBox.height / 2)
  );
  await page.mouse.up();
  const mappingColumnWidthsAfter = await readOnlyPane.evaluate(pane => ({
    header: pane.querySelector(".diagram2-mapping-pane-column-header")?.getBoundingClientRect().width || 0,
    ui: pane.querySelector("[data-diagram2-field-mapping-cell-kind='ui']")?.getBoundingClientRect().width || 0,
    database: pane.querySelector("[data-diagram2-field-mapping-cell-kind='database']")?.getBoundingClientRect().width || 0
  }));
  expect(mappingColumnWidthsAfter.ui).toBeGreaterThan(mappingColumnWidthsBefore.ui + 40);
  expect(Math.abs(mappingColumnWidthsAfter.header - mappingColumnWidthsAfter.ui)).toBeLessThanOrEqual(1);
  expect(mappingColumnWidthsAfter.database).toBeLessThan(mappingColumnWidthsBefore.database - 40);
  const mappingDownloads = readOnlyPane.locator("[data-diagram2-mapping-downloads]");
  const downloadCsvButton = mappingDownloads.getByRole("button", { name: "Download as CSV", exact: true });
  const downloadExcelButton = mappingDownloads.getByRole("button", { name: "Download as Excel", exact: true });
  await expect(downloadCsvButton).toBeVisible();
  await expect(downloadExcelButton).toBeVisible();
  expect(await mappingDownloads.evaluate(footer =>
    footer.parentElement?.classList.contains("diagram2-editor-left-pane-scroll") === true
  )).toBe(true);

  const [csvDownload] = await Promise.all([
    page.waitForEvent("download"),
    downloadCsvButton.click()
  ]);
  expect(csvDownload.suggestedFilename()).toMatch(/^pmt-field-mapping-\d{8}-\d{6}\.csv$/);
  const csvPath = await csvDownload.path();
  expect(csvPath).toBeTruthy();
  expect((await readFile(csvPath, "utf8")).replace(/^\uFEFF/, ""))
    .toBe("UI Field,Database Field\r\nTaskId,pmt.Phase6Entity.TaskId");

  const [excelDownload] = await Promise.all([
    page.waitForEvent("download"),
    downloadExcelButton.click()
  ]);
  expect(excelDownload.suggestedFilename()).toMatch(/^pmt-field-mapping-\d{8}-\d{6}\.xlsx$/);
  const excelPath = await excelDownload.path();
  expect(excelPath).toBeTruthy();
  const excelRows = await page.evaluate(async ({ content, filename }) => {
    const bytes = Uint8Array.from(atob(content), character => character.charCodeAt(0));
    const { readXlsxObjects } = await import("/js/shared/xlsx.js?v=20260630-native-xlsx");
    return readXlsxObjects(new File(
      [bytes],
      filename,
      { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
    ));
  }, {
    content: (await readFile(excelPath)).toString("base64"),
    filename: excelDownload.suggestedFilename()
  });
  expect(excelRows).toEqual([{
    "UI Field": "TaskId",
    "Database Field": "pmt.Phase6Entity.TaskId"
  }]);
  const treeToggle = page.getByRole("button", { name: "Treeview", exact: true });
  const mappingToggle = page.getByRole("button", { name: "Mapping", exact: true });
  await expect(treeToggle).toHaveAttribute("aria-pressed", "true");
  await expect(mappingToggle).toBeVisible();
  await expect(mappingToggle).toHaveAttribute("aria-pressed", "true");
  expect(await treeToggle.evaluate((tree, mapping) => tree.nextElementSibling === mapping, await mappingToggle.elementHandle())).toBe(true);
  await expect(page.locator("[data-diagram2-readonly-shell]")).toHaveClass(/is-field-mapping-lines-hidden/);
  await expect(page.locator("[data-diagram2-mapping-hover-hint]")).toHaveCount(0);
  await page.getByRole("button", { name: "Fit Diagram", exact: true }).click();
  const shownTreeFit = await diagram2VisibleContentCenterEvidence(page);
  expect(shownTreeFit.mappingPaneWidth).toBeGreaterThanOrEqual(200);
  expect(shownTreeFit.mappingTableVisible).toBe(false);
  expect(shownTreeFit.centerDeltaX).toBeLessThanOrEqual(2);
  expect(shownTreeFit.centerDeltaY).toBeLessThanOrEqual(2);

  await page.evaluate(() => {
    window.__diagram2TreeToggleStartedAt = performance.now();
  });
  await treeToggle.click();
  await expect(page.locator("[data-diagram2-tree-layout]")).toHaveClass(/is-tree-hidden/);
  await expect(page.locator("[data-diagram2-tree]")).toBeHidden();
  await expect(treeToggle).toHaveAttribute("aria-pressed", "false");
  const hiddenTreeFit = await diagram2VisibleContentCenterEvidence(page);
  expect(hiddenTreeFit.availableWidth).toBeGreaterThan(shownTreeFit.availableWidth);
  expect(hiddenTreeFit.centerDeltaX).toBeLessThanOrEqual(2);
  expect(hiddenTreeFit.centerDeltaY).toBeLessThanOrEqual(2);
  expect(hiddenTreeFit.fullRenderCount).toBe(shownTreeFit.fullRenderCount);
  expect(hiddenTreeFit.durationMs).toBeLessThan(500);

  await page.evaluate(() => {
    window.__diagram2TreeToggleStartedAt = performance.now();
  });
  await treeToggle.click();
  await expect(page.locator("[data-diagram2-tree-layout]")).not.toHaveClass(/is-tree-hidden/);
  await expect(page.locator("[data-diagram2-tree]")).toBeVisible();
  await expect(treeToggle).toHaveAttribute("aria-pressed", "true");
  const restoredTreeFit = await diagram2VisibleContentCenterEvidence(page);
  expect(restoredTreeFit.availableWidth).toBeCloseTo(shownTreeFit.availableWidth, 0);
  expect(restoredTreeFit.centerDeltaX).toBeLessThanOrEqual(2);
  expect(restoredTreeFit.centerDeltaY).toBeLessThanOrEqual(2);
  expect(restoredTreeFit.fullRenderCount).toBe(shownTreeFit.fullRenderCount);
  expect(restoredTreeFit.durationMs).toBeLessThan(500);
  await mappingToggle.click();
  await expect(mappingToggle).toHaveAttribute("aria-pressed", "false");
  await expect(readOnlyPane).toBeHidden();
  expect(await page.locator("[data-diagram2-mapping-table-plane]").evaluate(
    node => getComputedStyle(node).display
  )).not.toBe("none");
  const readOnlyCanvasMappingRow = page.locator("[data-diagram2-field-mapping-row]").first();
  await expect(readOnlyCanvasMappingRow).toBeVisible();
  const readOnlyCanvasWeightsBeforeHover = await diagram2FieldMappingRowFontWeights(readOnlyCanvasMappingRow);
  await readOnlyCanvasMappingRow.hover();
  const readOnlyCanvasWeightsAfterHover = await diagram2FieldMappingRowFontWeights(readOnlyCanvasMappingRow);
  expect(readOnlyCanvasWeightsAfterHover).toEqual(readOnlyCanvasWeightsBeforeHover);
  expect(readOnlyCanvasWeightsAfterHover.every(weight => weight === 400)).toBe(true);
  await mappingToggle.click();
  await expect(mappingToggle).toHaveAttribute("aria-pressed", "true");
  await expect(readOnlyPane).toBeVisible();
  const readOnlyMappingSearch = readOnlyPane.locator("[data-diagram2-mapping-search]");
  const readOnlyGroupToggle = readOnlyPane.locator("[data-diagram2-mapping-group-by-table]");
  const readOnlyAlphabeticalToggle = readOnlyPane.locator("[data-diagram2-mapping-alphabetical]");
  const searchStyle = await readOnlyMappingSearch.evaluate(input => {
    const style = getComputedStyle(input);
    return {
      backgroundColor: style.backgroundColor,
      borderStyle: style.borderStyle,
      borderWidth: style.borderWidth,
      minHeight: Number.parseFloat(style.minHeight)
    };
  });
  expect(searchStyle.borderStyle).toBe("solid");
  expect(searchStyle.borderWidth).toBe("1px");
  expect(searchStyle.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(searchStyle.minHeight).toBeGreaterThanOrEqual(32);
  await expect(readOnlyAlphabeticalToggle).not.toBeChecked();
  const wideOptionTops = await readOnlyPane.locator(".diagram2-mapping-pane-group-toggle").evaluateAll(labels =>
    labels.map(label => Math.round(label.getBoundingClientRect().top))
  );
  expect(wideOptionTops[0]).toBe(wideOptionTops[1]);
  await readOnlyAlphabeticalToggle.check();
  await expect(readOnlyAlphabeticalToggle).toBeChecked();
  await readOnlyAlphabeticalToggle.uncheck();
  await expect(readOnlyAlphabeticalToggle).not.toBeChecked();
  await readOnlyMappingSearch.fill("PHASE6ENTITY.TAS");
  await expect(readOnlyPane).toHaveAttribute("data-diagram2-mapping-visible-count", "1");
  await readOnlyMappingSearch.fill("not present");
  await expect(readOnlyPane).toHaveAttribute("data-diagram2-mapping-visible-count", "0");
  await expect(readOnlyPane.locator("[data-diagram2-mapping-pane-row]")).toHaveCount(0);
  await expect(readOnlyPane).toContainText("No mappings match your search.");
  await readOnlyMappingSearch.fill("");
  await expect(readOnlyPane).toHaveAttribute("data-diagram2-mapping-visible-count", "1");
  await readOnlyGroupToggle.check();
  await expect(readOnlyPane.locator(".diagram2-mapping-pane-group h4")).toHaveText("pmt.Phase6Entity");
  const groupHeaderStyle = await readOnlyPane.locator(".diagram2-mapping-pane-group h4").evaluate(header => {
    const style = getComputedStyle(header);
    return {
      backgroundColor: style.backgroundColor,
      paneBackgroundColor: getComputedStyle(header.closest("[data-diagram2-mapping-pane]")).backgroundColor,
      fontWeight: Number(style.fontWeight)
    };
  });
  expect(groupHeaderStyle.backgroundColor).not.toBe(groupHeaderStyle.paneBackgroundColor);
  expect(groupHeaderStyle.fontWeight).toBeGreaterThanOrEqual(600);
  await readOnlyGroupToggle.uncheck();
  await expect(readOnlyPane.locator(".diagram2-mapping-pane-group h4")).toHaveCount(0);
  expect(await page.locator("[data-diagram2-mapping-table-plane]").evaluate(
    node => getComputedStyle(node).display
  )).toBe("none");
  const readOnlyScrollMetrics = await readOnlyPane.locator(".diagram2-editor-left-pane-scroll").evaluate(element => {
    element.style.height = "64px";
    const metrics = {
      overflowY: getComputedStyle(element).overflowY,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight
    };
    element.scrollTop = element.scrollHeight;
    metrics.scrollTop = element.scrollTop;
    element.style.removeProperty("height");
    return metrics;
  });
  expect(readOnlyScrollMetrics.overflowY).toBe("auto");
  expect(readOnlyScrollMetrics.scrollHeight).toBeGreaterThan(readOnlyScrollMetrics.clientHeight);
  expect(readOnlyScrollMetrics.scrollTop).toBeGreaterThan(0);
  const readOnlyResizer = readOnlyPane.getByRole("separator", { name: "Resize Mapping pane" });
  await readOnlyResizer.press("Home");
  await expect.poll(() => readOnlyPane.evaluate(element => Math.round(element.getBoundingClientRect().width))).toBe(200);
  const narrowOptionTops = await readOnlyPane.locator(".diagram2-mapping-pane-group-toggle").evaluateAll(labels =>
    labels.map(label => Math.round(label.getBoundingClientRect().top))
  );
  expect(narrowOptionTops[1]).toBeGreaterThan(narrowOptionTops[0]);
  await readOnlyResizer.press("End");
  await expect.poll(() => readOnlyPane.evaluate(element => Math.round(element.getBoundingClientRect().width))).toBe(600);
  await readOnlyResizer.press("Home");
  for (let index = 0; index < 5; index += 1) await readOnlyResizer.press("ArrowRight");
  await expect.poll(() => readOnlyPane.evaluate(element => Math.round(element.getBoundingClientRect().width))).toBe(320);
  const readOnlyFullRenders = await diagnosticNumber(page, "full-render-count");
  const readOnlyCanvas = page.locator("[data-diagram2-viewer-canvas]");
  const readOnlyMenu = page.locator("[data-diagram2-canvas-context-menu]");
  await readOnlyCanvas.click({ button: "right", position: { x: 380, y: 40 } });
  await expect(readOnlyMenu).toBeVisible();
  expect(await readOnlyMenu.locator("button").evaluateAll(buttons => buttons.map(button =>
    button.querySelector(".dropdown-menu-label")?.textContent?.trim()
  ))).toEqual([
    "Entity Relationships",
    "UI to DB Field Mapping Lines",
    "Relationship Lines Only",
    "Copy as SVG",
    "Copy as PNG"
  ]);
  await expect(readOnlyMenu.locator("[data-diagram2-toggle-field-mappings]"))
    .toHaveAttribute("aria-checked", "false");
  await readOnlyMenu.press("Escape");
  await expect(page.locator("[data-diagram2-readonly-shell]")).toHaveClass(/is-field-mapping-lines-hidden/);
  await expect(page.locator("[data-diagram2-object-id='table-phase6']")).toBeHidden();
  await expect(readOnlyPane).toBeVisible();
  await expect(page.locator(
    "[data-diagram2-field-rectangle-plane] [data-diagram2-object-id='field-phase6']"
  )).toBeHidden();
  expect(await page.locator("[data-diagram2-field-relationship-plane]").evaluate(
    node => getComputedStyle(node).display
  )).toBe("none");
  await readOnlyUiField.hover();
  await expect(page.locator(
    "[data-diagram2-field-rectangle-plane] [data-diagram2-object-id='field-phase6']"
  )).toBeVisible();
  await expect(page.locator("[data-diagram2-field-mapping-hover]")).toBeVisible();
  await expect(page.locator("[data-diagram2-field-mapping-active-relationship]")).toHaveCount(1);
  await expect(page.locator("[data-diagram2-field-mapping-active-relationship-path]")).toHaveCount(1);
  await expect(page.locator("[data-diagram2-field-mapping-attention-arrows]")).toHaveCount(1);
  const readOnlyArrowOrigins = await diagram2MappingPaneArrowOriginEvidence(page);
  expect(readOnlyArrowOrigins).toHaveLength(2);
  readOnlyArrowOrigins.forEach(origin => {
    expect(origin.startDeltaX).toBeLessThanOrEqual(6);
    expect(origin.startDeltaY).toBeLessThanOrEqual(2);
  });
  expect(await diagnosticNumber(page, "full-render-count")).toBe(readOnlyFullRenders);
  await readOnlyUiField.press(" ");
  await capturePhase6Screenshot(
    page,
    testInfo,
    "chromium-1920",
    "diagram2-phase6-readonly-mapping-highlight-1920x1080.png"
  );
  const readOnlyFocusBefore = await prepareDiagram2FieldMappingFocus(page);
  await expect(readOnlyDatabaseCell).toBeVisible();
  await page.evaluate(() => {
    window.__diagram2FieldFocusStartedAt = performance.now();
  });
  await readOnlyDatabaseCell.dblclick();
  const readOnlyFocus = await diagram2FieldFocusEvidence(
    page,
    boundsCenter(annotationEntityFieldBounds(phase6TargetEntity(), "TaskId"))
  );
  expect(readOnlyFocus.scale).toBeGreaterThan(readOnlyFocusBefore.scale);
  expect(readOnlyFocus.centerDeltaX).toBeLessThanOrEqual(1);
  expect(readOnlyFocus.centerDeltaY).toBeLessThanOrEqual(1);
  expect(Number(readOnlyFocus.zoomControlValue)).toBeCloseTo(readOnlyFocus.scale, 2);
  expect(readOnlyFocus.reason).toBe("focus Field mapping database field");
  expect(readOnlyFocus.fullRenderCount).toBe(readOnlyFocusBefore.fullRenderCount);
  expect(readOnlyFocus.routesRecalculatedDuringSettle).toBe(0);
  expect(readOnlyFocus.durationMs).toBeLessThan(500);
  await readOnlyCanvas.click({ button: "right", position: { x: 380, y: 40 } });
  await readOnlyMenu.locator("[data-diagram2-toggle-field-mappings]").click();
  await expect(page.locator("[data-diagram2-readonly-shell]")).not.toHaveClass(/is-field-mapping-lines-hidden/);
  const readOnlyTraceBefore = await diagnosticNumber(page, "full-render-count");
  await page.locator("[data-diagram2-object-plane] [data-diagram2-object-id='entity-phase6']")
    .dispatchEvent("click", { button: 0 });
  await expect(page.locator(".is-relationship-trace[data-diagram2-relationship-route-overlay-id]")).toHaveCount(1);
  const readOnlyTraceStyle = await page.locator(
    ".is-relationship-trace [data-diagram2-relationship-selection-path]"
  ).evaluate(path => {
    const style = getComputedStyle(path);
    return { stroke: style.stroke, dasharray: style.strokeDasharray };
  });
  expect(readOnlyTraceStyle.stroke).not.toBe("none");
  expect(readOnlyTraceStyle.dasharray).toBe("none");
  await page.locator("[data-diagram2-relationship-id]").first()
    .dispatchEvent("click", { button: 0 });
  await expect(page.locator(".is-relationship-trace[data-diagram2-relationship-route-overlay-id]")).toHaveCount(1);
  expect(await diagnosticNumber(page, "full-render-count")).toBe(readOnlyTraceBefore);

  await page.evaluate(() => {
    window.location.hash = "#/diagram/601";
  });
  await expect(page).toHaveURL(/#\/diagram\/601$/);
  const diagram1Canvas = page.locator("[data-diagram-viewport]");
  const diagram1Menu = page.locator("[data-diagram-readonly-context-menu]");
  await expect(diagram1Canvas).toBeVisible();
  await expect(page.locator("[data-diagram-image]")).toBeVisible();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const diagram1CanvasBox = await diagram1Canvas.boundingBox();
  expect(diagram1CanvasBox).toBeTruthy();
  await diagram1Canvas.dispatchEvent("contextmenu", {
    button: 2,
    clientX: diagram1CanvasBox.x + 40,
    clientY: diagram1CanvasBox.y + 40
  });
  await expect(diagram1Menu).toBeVisible();
  await expect(diagram1Menu.locator("[data-diagram-toggle-field-mappings] .dropdown-menu-label"))
    .toHaveText("UI to DB Field Mapping Lines");
  await diagram1Menu.locator("[data-diagram-toggle-field-mappings]").click();
  await expect(page.locator("[data-annotation-object-id='table-phase6']")).toBeVisible();
  await expect(page.locator("[data-annotation-object-id='field-phase6']")).toBeVisible();
  const diagram1MappingRow = page.locator("[data-annotation-field-mapping-row]").first();
  await diagram1MappingRow.hover();
  await expect(page.locator("[data-annotation-field-mapping-active-relationships]")).toHaveCount(1);
  await expect(page.locator("[data-annotation-field-mapping-attention-arrow]")).toHaveCount(2);

  await page.evaluate(() => {
    window.location.hash = "#/diagram-2/601";
  });
  await expect(page).toHaveURL(/#\/diagram-2\/601$/);
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "readonly");
  await page.getByRole("button", { name: "Edit Diagram" }).click();
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "edit");
  await expect(page.locator("[data-diagram2-editor-shell]")).toBeVisible();
  const editMappingButton = page.getByRole("button", { name: "Mapping", exact: true });
  await expect(editMappingButton).toBeVisible();
  expect(await page.locator(".diagram2-editor-nav > button").evaluateAll(buttons =>
    buttons.map(button => button.textContent.trim()))).toEqual([
    "Tools",
    "Objects",
    "Templates",
    "Mapping",
    "Right Pane"
  ]);
  await page.locator("[data-diagram2-object-plane] [data-diagram2-object-id='entity-phase6']").click();
  await expect(page.locator(
    "[data-diagram2-object-plane] [data-diagram2-object-id='entity-phase6']"
  )).toHaveClass(/is-selected/);
  await expect(page.locator(".is-relationship-trace[data-diagram2-relationship-route-overlay-id]")).toHaveCount(0);
  await page.locator("[data-diagram2-relationship-id]").first()
    .dispatchEvent("pointerdown", { button: 0, pointerId: 1 });
  await expect(page.locator(".is-relationship-trace[data-diagram2-relationship-route-overlay-id]")).toHaveCount(0);

  const editCanvas = page.locator("[data-diagram2-viewer-canvas]");
  const editMenu = page.locator("[data-diagram2-canvas-context-menu]");
  const editCanvasBox = await editCanvas.boundingBox();
  expect(editCanvasBox).toBeTruthy();
  await editCanvas.dispatchEvent("contextmenu", {
    button: 2,
    clientX: editCanvasBox.x + 24,
    clientY: editCanvasBox.y + 24
  });
  await expect(editMenu).toBeVisible();
  expect(await editMenu.locator("button").evaluateAll(buttons => buttons.map(button =>
    button.querySelector(".dropdown-menu-label")?.textContent?.trim()
  ))).toEqual([
    "Entity Relationships",
    "UI to DB Field Mapping Lines",
    "Relationship Lines Only",
    "Copy as SVG",
    "Copy as PNG"
  ]);
  await editMenu.locator("[data-diagram2-toggle-field-mappings]").click();
  await expect(page.locator("[data-diagram2-editor-shell]")).toHaveClass(/is-field-mapping-lines-hidden/);
  const editFieldRectangle = page.locator(
    "[data-diagram2-field-rectangle-plane] [data-diagram2-object-id='field-phase6']"
  );
  await expect(editFieldRectangle).toBeHidden();
  const editCanvasMappingRow = page.locator("[data-diagram2-field-mapping-row]").first();
  const editCanvasWeightsBeforeHover = await diagram2FieldMappingRowFontWeights(editCanvasMappingRow);
  await editCanvasMappingRow.hover();
  const editCanvasWeightsAfterHover = await diagram2FieldMappingRowFontWeights(editCanvasMappingRow);
  expect(editCanvasWeightsAfterHover).toEqual(editCanvasWeightsBeforeHover);
  expect(editCanvasWeightsAfterHover.every(weight => weight === 400)).toBe(true);
  await expect(editFieldRectangle).toBeVisible();
  await expect(page.locator("[data-diagram2-field-mapping-active-relationship]")).toHaveCount(1);
  await page.evaluate(() => window.__pmtDiagram2Renderer.clearFieldMappingHover());
  await expect(editFieldRectangle).toBeHidden();
  await editCanvas.dispatchEvent("contextmenu", {
    button: 2,
    clientX: editCanvasBox.x + 24,
    clientY: editCanvasBox.y + 24
  });
  await editMenu.locator("[data-diagram2-toggle-field-mappings]").click();
  await expect(page.locator("[data-diagram2-editor-shell]")).not.toHaveClass(/is-field-mapping-lines-hidden/);

  await page.evaluate(() => window.__pmtDiagram2EditorCore.setSelection(["entity-phase6"]));
  await expect(page.locator("[data-diagram2-selection-outline]")).toHaveCount(1);
  await page.locator(
    "[data-diagram2-mapping-table-plane] [data-diagram2-field-mapping-cell-kind='ui']"
  ).first().click();
  await expect.poll(() => page.evaluate(() =>
    window.__pmtDiagram2EditorCore.selectedObjectIds().length)).toBe(0);
  await expect(page.locator("[data-diagram2-selection-outline]")).toHaveCount(0);
  await expect(page.locator(
    "[data-diagram2-field-mapping-highlight] .image-annotation-field-mapping-attention-rect"
  )).toHaveCount(0);
  await expect(page.locator("[data-diagram2-field-mapping-hover]")).toBeVisible();

  await editMappingButton.click();
  const editMappingPane = page.locator("[data-diagram2-editor-shell] [data-diagram2-mapping-pane]");
  const editPaneUiField = editMappingPane.locator(
    "[data-diagram2-mapping-pane-field][data-diagram2-field-mapping-cell-kind='ui']"
  ).first();
  await expect(editMappingPane).toBeVisible();
  await expect(editMappingButton).toHaveAttribute("aria-expanded", "true");
  const editMappingSearch = editMappingPane.locator("[data-diagram2-mapping-search]");
  await editMappingSearch.fill("phase6entity.task");
  await expect(editMappingPane).toHaveAttribute("data-diagram2-mapping-visible-count", "1");
  await editMappingSearch.fill("");
  expect(await page.locator("[data-diagram2-mapping-table-plane]").evaluate(
    node => getComputedStyle(node).display
  )).toBe("none");
  await editPaneUiField.hover();
  await expect(page.locator("[data-diagram2-field-mapping-hover]")).toBeVisible();
  await expect(page.locator("[data-diagram2-field-mapping-attention-arrow]")).toHaveCount(2);
  await page.evaluate(() => window.__pmtDiagram2EditorCore.setSelection(["field-phase6"]));
  await expect(page.locator("[data-diagram2-selection-outline]")).toHaveCount(1);
  await editPaneUiField.click();
  await expect.poll(() => page.evaluate(() =>
    window.__pmtDiagram2EditorCore.selectedObjectIds().length)).toBe(0);
  await expect(page.locator("[data-diagram2-selection-outline]")).toHaveCount(0);
  await expect(page.locator(
    "[data-diagram2-field-mapping-highlight] .image-annotation-field-mapping-attention-rect"
  )).toHaveCount(0);
  const editUiFocusBefore = await prepareDiagram2FieldMappingFocus(page);
  await page.evaluate(() => {
    window.__diagram2FieldFocusStartedAt = performance.now();
  });
  await editPaneUiField.dblclick();
  const editUiFocus = await diagram2FieldFocusEvidence(page, { x: 345, y: 286 });
  expect(editUiFocus.scale).toBeGreaterThan(editUiFocusBefore.scale);
  expect(editUiFocus.centerDeltaX).toBeLessThanOrEqual(1);
  expect(editUiFocus.centerDeltaY).toBeLessThanOrEqual(1);
  expect(editUiFocus.reason).toBe("focus Field mapping UI field");
  expect(editUiFocus.fullRenderCount).toBe(editUiFocusBefore.fullRenderCount);
  expect(editUiFocus.durationMs).toBeLessThan(500);
  await editMappingButton.click();
  await expect(editMappingPane).toBeHidden();
  await expect(editMappingButton).toHaveAttribute("aria-expanded", "false");
  expect(await page.locator("[data-diagram2-mapping-table-plane]").evaluate(
    node => getComputedStyle(node).display
  )).not.toBe("none");
  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await expect(page.locator("[data-diagram2-tools-pane]")).toBeVisible();

  const droppedImage = await assertDiagram2ImageDrop(page, pngBase64);
  expect(uploadedImageCount).toBe(1);

  const cropTab = page.locator("[data-diagram2-inspector-tab='crop']");
  const cropPanel = page.locator("[data-diagram2-inspector-panel='crop']");
  const cropLeft = page.locator("[data-diagram2-crop-inset='left']");
  await expect(cropTab).toBeVisible();
  await page.locator("[data-diagram2-tool='crop']").click();
  await expect(cropTab).toHaveAttribute("aria-selected", "true");
  await expect(cropPanel).toBeVisible();
  await expect(cropLeft).toBeEnabled();
  await expect(page.locator("[data-diagram2-crop-corner-radius]")).toBeEnabled();
  await cropLeft.fill("12");
  await cropLeft.press("Tab");
  await expect.poll(() => page.evaluate(() => {
    const controller = window.__pmtDiagram2EditorCore;
    const selected = controller.getObjectById(controller.selectedObjectIds()[0]);
    return selected?.imageClip?.x - selected?.x;
  })).toBe(12);
  await createDiagram2ReversibleCropCommand(page, droppedImage.id);
  await expect(cropTab).toBeVisible();
  await cropTab.click();
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

  await editMappingButton.click();
  await expect(editMappingPane).toBeVisible();
  await expect(editMappingPane).toHaveAttribute("data-diagram2-mapping-count", "1");
  const mappingRow = editMappingPane.locator("[data-diagram2-mapping-pane-row]").first();
  const editPaneDatabaseCell = mappingRow.locator(
    "[data-diagram2-mapping-pane-field][data-diagram2-field-mapping-cell-kind='database']"
  );
  await expect(mappingRow).toContainText("pmt.Phase6Entity.Title");
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
  const editFocusBefore = await prepareDiagram2FieldMappingFocus(page);
  const editFocusHistoryBefore = await page.evaluate(() =>
    window.__pmtDiagram2EditorCore.historyStatus().entryCount);
  await expect(editPaneDatabaseCell).toBeVisible();
  await page.evaluate(() => {
    window.__diagram2FieldFocusStartedAt = performance.now();
  });
  await editPaneDatabaseCell.dblclick();
  const editFocus = await diagram2FieldFocusEvidence(
    page,
    boundsCenter(annotationEntityFieldBounds(phase6TargetEntity(), "Title"))
  );
  expect(editFocus.scale).toBeGreaterThan(editFocusBefore.scale);
  expect(editFocus.centerDeltaX).toBeLessThanOrEqual(1);
  expect(editFocus.centerDeltaY).toBeLessThanOrEqual(1);
  expect(Number(editFocus.zoomControlValue)).toBeCloseTo(editFocus.scale, 2);
  expect(editFocus.reason).toBe("focus Field mapping database field");
  expect(editFocus.fullRenderCount).toBe(editFocusBefore.fullRenderCount);
  expect(editFocus.routesRecalculatedDuringSettle).toBe(0);
  expect(editFocus.durationMs).toBeLessThan(500);
  expect(await page.evaluate(() =>
    window.__pmtDiagram2EditorCore.historyStatus().entryCount)).toBe(editFocusHistoryBefore);

  await page.evaluate(() => window.__pmtDiagram2EditorCore.updateEntityField(
    "entity-phase6",
    1,
    { name: "Summary" }
  ));
  await expect(editMappingPane.locator(
    "[data-diagram2-mapping-pane-field][data-diagram2-field-mapping-cell-kind='database']"
  ).first()).toContainText("pmt.Phase6Entity.Summary");
  await expect(page.locator(
    "[data-diagram2-mapping-table-plane] [data-diagram2-field-mapping-cell-kind='database']"
  ).first()).toContainText("pmt.Phase6Entity.Summary");
  await page.evaluate(() => window.__pmtDiagram2EditorCore.undo());
  await expect(editMappingPane.locator(
    "[data-diagram2-mapping-pane-field][data-diagram2-field-mapping-cell-kind='database']"
  ).first()).toContainText("pmt.Phase6Entity.Title");

  await page.evaluate(() => window.__pmtDiagram2EditorCore.renameFieldRectangle(
    "field-phase6",
    "Task title"
  ));
  await expect(editMappingPane.locator(
    "[data-diagram2-mapping-pane-field][data-diagram2-field-mapping-cell-kind='ui']"
  ).first()).toContainText("Task title");
  await page.evaluate(() => window.__pmtDiagram2EditorCore.undo());
  await expect(editMappingPane.locator(
    "[data-diagram2-mapping-pane-field][data-diagram2-field-mapping-cell-kind='ui']"
  ).first()).toContainText("Title");

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
  const reopenedMappingRow = page.locator(
    "[data-diagram2-readonly-shell] [data-diagram2-mapping-pane-row]"
  ).first();
  await expect(reopenedMappingRow).toContainText("Title");
  await reopenedMappingRow.locator("[data-diagram2-mapping-pane-field]").first().hover();
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

test("Diagram 2 shows Mapping only when a mapped Field Mapping Rectangle exists", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-1366", "One viewport covers dynamic Mapping availability.");
  const complete = phase6State();
  const withoutRectangle = normalizeAnnotationState({
    ...complete,
    objects: complete.objects.filter(object => object.id !== "field-phase6")
  });
  const withoutTable = normalizeAnnotationState({
    ...complete,
    objects: complete.objects.filter(object => object.type !== "field-mapping-table")
  });
  const apiState = appState(606, "Mapping table without rectangle", withoutRectangle);
  apiState.blogs.push(appState(607, "Mapped rectangle without table", withoutTable).blogs[0]);

  await initializeBrowserState(page);
  await routeApplicationApis(page, () => apiState);
  await page.route("**/api/image-annotation/**", route =>
    route.fulfill(jsonResponse({ version: 1, templates: [], defaults: {} })));

  await loginAndOpenDiagram2(page, 606);
  await expect(page.getByRole("button", { name: "Mapping", exact: true })).toBeHidden();
  await page.evaluate(() => { window.location.hash = "#/diagram-2/607"; });
  await expect(page).toHaveURL(/#\/diagram-2\/607$/);
  await expect(page.locator("[data-diagram2-svg]")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mapping", exact: true })).toBeVisible();
  await expect(page.locator("[data-diagram2-mapping-pane]")).toHaveAttribute("data-diagram2-mapping-count", "1");
});

test("Diagram 2 object z-order paints images and image groups in tree order", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-1366", "One viewport covers SVG paint order.");
  const apiState = appState(608, "Diagram 2 Z Order", zOrderState());

  await initializeBrowserState(page);
  await routeApplicationApis(page, () => apiState);
  await page.route("**/api/image-annotation/**", route =>
    route.fulfill(jsonResponse({ version: 1, templates: [], defaults: {} })));

  await loginAndOpenDiagram2(page, 608);
  await page.getByRole("button", { name: "Edit Diagram" }).click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__pmtDiagram2EditorCore))).toBe(true);
  const evidence = await page.evaluate(async () => {
    const controller = window.__pmtDiagram2EditorCore;
    const renderer = window.__pmtDiagram2Renderer;
    const fullRenderCount = renderer.diagnostics().fullRenderCount;
    const visualIndex = id => {
      const node = document.querySelector(`svg[data-diagram2-svg] [data-diagram2-object-id='${CSS.escape(id)}']`);
      const plane = node?.parentElement;
      const viewport = plane?.parentElement;
      if (!node || !plane || !viewport) return -1;
      return ([...viewport.children].indexOf(plane) * 10000) + [...plane.children].indexOf(node);
    };
    const capture = () => ({
      order: controller.currentState().objects.map(object => object.id),
      image: visualIndex("z-image"),
      red: visualIndex("z-red"),
      groupShape: visualIndex("z-group-shape")
    });
    const timed = async action => {
      const started = performance.now();
      await action();
      await renderer.whenIdle();
      return performance.now() - started;
    };

    controller.setSelection(["z-image"], { expandGroups: false });
    const imageFrontMs = await timed(() => controller.arrangeSelectedObjects("front"));
    const imageFront = capture();
    const imageBackMs = await timed(() => controller.arrangeSelectedObjects("back"));
    const imageBack = capture();

    await controller.addObject(controller.createDefaultObject("rectangle", {
      x: 125,
      y: 105
    }, {
      id: "z-group-shape",
      name: "Grouped outline"
    }));
    controller.setSelection(["z-image", "z-group-shape"], { expandGroups: false });
    await controller.groupSelectedObjects();
    const groupId = controller.getObjectById("z-image").groupId;
    controller.selectStructureNode("group", groupId);
    const groupBackMs = await timed(() => controller.arrangeSelectedObjects("back"));
    const groupBack = capture();
    const groupFrontMs = await timed(() => controller.arrangeSelectedObjects("front"));
    const groupFront = capture();

    return {
      imageFront,
      imageBack,
      groupBack,
      groupFront,
      durations: [imageFrontMs, imageBackMs, groupBackMs, groupFrontMs],
      fullRenderDelta: renderer.diagnostics().fullRenderCount - fullRenderCount
    };
  });

  expect(evidence.imageFront.order).toEqual(["z-red", "z-image"]);
  expect(evidence.imageFront.image).toBeGreaterThan(evidence.imageFront.red);
  expect(evidence.imageBack.order).toEqual(["z-image", "z-red"]);
  expect(evidence.imageBack.image).toBeLessThan(evidence.imageBack.red);
  expect(evidence.groupBack.order).toEqual(["z-image", "z-group-shape", "z-red"]);
  expect(evidence.groupBack.image).toBeLessThan(evidence.groupBack.red);
  expect(evidence.groupBack.groupShape).toBeLessThan(evidence.groupBack.red);
  expect(evidence.groupFront.order).toEqual(["z-red", "z-image", "z-group-shape"]);
  expect(evidence.groupFront.image).toBeGreaterThan(evidence.groupFront.red);
  expect(evidence.groupFront.groupShape).toBeGreaterThan(evidence.groupFront.red);
  evidence.durations.forEach(duration => expect(duration).toBeLessThan(500));
  expect(evidence.fullRenderDelta).toBe(0);
});

test("Diagram 2 save conflicts offer the next numbered name and preserve the original", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-1366", "One viewport covers the save-conflict workflow.");
  let apiState = appState(610, "Conflict Diagram 2", zOrderState());
  apiState.blogs.push(appState(611, "Conflict Diagram 3", zOrderState()).blogs[0]);
  let uploadCount = 0;
  let latestSvg = buildAnnotationSvg(zOrderState());
  let createdPayload = null;

  await initializeBrowserState(page);
  await routeApplicationApis(page, () => apiState);
  await page.route("**/api/image-annotation/**", route =>
    route.fulfill(jsonResponse({ version: 1, templates: [], defaults: {} })));
  await page.route("**/api/uploads/richtext", route => {
    latestSvg = extractMultipartSvg(route.request().postDataBuffer()) || latestSvg;
    uploadCount += 1;
    return route.fulfill(jsonResponse({ url: `/uploads/conflict-diagram-${uploadCount}.svg` }));
  });
  await page.route("**/uploads/conflict-diagram-*.svg", route => route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: latestSvg
  }));
  await page.route("**/api/blogs/610", route => route.fulfill(jsonResponse({
    error: "A newer version of this item exists. Your changes were not applied."
  }, 409)));
  await page.route("**/api/blogs", route => {
    createdPayload = route.request().postDataJSON();
    const created = {
      ...apiState.blogs[0],
      ...createdPayload,
      id: 612,
      rowVersion: "conflict-copy-row-1",
      updatedAt: "2026-08-01T12:00:00Z"
    };
    apiState = { ...apiState, blogs: [...apiState.blogs, created] };
    return route.fulfill(jsonResponse(created));
  });

  await loginAndOpenDiagram2(page, 610);
  await page.getByRole("button", { name: "Edit Diagram" }).click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__pmtDiagram2EditorCore))).toBe(true);
  await page.evaluate(async () => {
    const controller = window.__pmtDiagram2EditorCore;
    await controller.moveObjects(["z-red"], 120, 0, { reason: "save conflict test" });
  });
  await page.locator("[data-action='save-diagram2-document']").click();
  const dialog = page.locator("dialog", { has: page.getByRole("heading", { name: "Save Diagram As" }) });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[name='dialogText']")).toHaveValue("Conflict Diagram 4");
  await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page).toHaveURL(/#\/diagram-2\/612$/);
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "edit");
  await expect(page.locator("[data-diagram2-save-state]").first()).toHaveText("Saved");
  expect(createdPayload?.title).toBe("Conflict Diagram 4");
  expect(createdPayload?.projectId).toBe(apiState.blogs[0].projectId);
  expect(apiState.blogs.find(blog => blog.id === 610)?.title).toBe("Conflict Diagram 2");
  expect(uploadCount).toBe(2);
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
  await expect(cropOverlay).toBeHidden();
  await page.waitForTimeout(100);
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
  ), {
    timeout: 500,
    intervals: [25, 50, 75, 100]
  }).toBe(20);
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
  await expect(cropOverlay).toBeHidden();
  if (testInfo.project.name === "chromium-1920") {
    await capturePhase6ClosureScreenshot(
      page,
      "crop/crop-d2-radius-selection-hidden-1920x1080.png"
    );
  }
  await expect(selection).toBeVisible({ timeout: 1600 });
  await expect(selection.locator("[data-diagram2-resize-handle]").first()).toBeVisible();
  await expect(cropOverlay).toBeHidden();
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
  await page.locator("[data-diagram2-tool='crop']").click();
  await expect(page.getByRole("heading", { name: "Crop Options", exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__pmtDiagram2EditorCore.activeTool())).toBe("crop");
  const cropPreview = page.locator("[data-diagram2-crop-preview]");
  await expect(cropPreview).toHaveAttribute("x", String(image.imageClip.x));
  await expect(cropPreview).toHaveAttribute("y", String(image.imageClip.y));
  await expect(cropPreview).toHaveAttribute("width", String(image.imageClip.width));
  await expect(cropPreview).toHaveAttribute("height", String(image.imageClip.height));
  const northwestCropHandle = page.locator("[data-diagram2-crop-handle='nw']");
  await expect(northwestCropHandle).toHaveAttribute("cx", String(image.imageClip.x));
  await expect(northwestCropHandle).toHaveAttribute("cy", String(image.imageClip.y));
  await page.locator("[data-diagram2-tool='crop']").click();
  await expect.poll(() => page.evaluate(() => window.__pmtDiagram2EditorCore.activeTool())).toBe("select");
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
  await expect(page.locator("[data-diagram2-crop-overlay]")).toBeHidden();

  await topLeft.fill("12");
  await expect.poll(() => page.evaluate(() => {
    const current = window.__pmtDiagram2EditorCore.getObjectById("image-phase6");
    return {
      uniform: current?.cropCornerRadius,
      corners: current?.cropCornerRadii
    };
  })).toEqual({
    uniform: 0,
    corners: {
      topLeft: 12,
      topRight: 30,
      bottomRight: 30,
      bottomLeft: 30
    }
  });
  await expect(radius).toHaveValue("0");

  await radius.fill("30");
  await expect.poll(() => page.evaluate(() => {
    const current = window.__pmtDiagram2EditorCore.getObjectById("image-phase6");
    return {
      uniform: current?.cropCornerRadius,
      hasCorners: current?.cropCornerRadii != null,
      controls: [...document.querySelectorAll("[data-diagram2-crop-corner]")].map(control => control.value)
    };
  })).toEqual({
    uniform: 30,
    hasCorners: false,
    controls: ["30", "30", "30", "30"]
  });

  await topLeft.fill("12");
  await topLeft.press("Tab");
  await expect(radius).toHaveValue("0");
  const cropBeforeRadiusReset = await page.evaluate(() =>
    window.__pmtDiagram2EditorCore.getObjectById("image-phase6")?.imageClip
  );
  const resetRadius = page.locator("[data-action='reset-diagram2-crop-radius']");
  await expect(resetRadius).toBeEnabled();
  await resetRadius.click();
  await expect.poll(() => page.evaluate(() => {
    const current = window.__pmtDiagram2EditorCore.getObjectById("image-phase6");
    return {
      radius: current?.cropCornerRadius,
      hasCorners: current?.cropCornerRadii != null,
      clip: current?.imageClip
    };
  })).toEqual({
    radius: 0,
    hasCorners: false,
    clip: cropBeforeRadiusReset
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
  await expect(overlay).toBeHidden();
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
    radius: 0,
    corners: {
      topLeft: 12,
      topRight: 28,
      bottomRight: 28,
      bottomLeft: 28
    }
  });
  await expect(radius).toHaveValue("0");
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
  const reopenedSelectionBounds = await page.locator(
    "[data-diagram2-selection-id='crop-parity-image'] [data-diagram2-selection-outline]"
  ).evaluate(outline => ({
    x: Number(outline.getAttribute("x")),
    y: Number(outline.getAttribute("y")),
    width: Number(outline.getAttribute("width")),
    height: Number(outline.getAttribute("height")),
    transform: outline.parentElement?.getAttribute("transform") || ""
  }));
  expect(reopenedSelectionBounds).toEqual({
    x: 18,
    y: 12,
    width: 618,
    height: 390,
    transform: "translate(60 100)"
  });
  await page.locator("[data-diagram2-tool='crop']").click();
  await expect(page.getByRole("heading", { name: "Crop Options", exact: true })).toHaveCount(0);
  await expect(page.locator("[data-diagram2-crop-preview]")).toHaveAttribute("x", "78");
  await expect(page.locator("[data-diagram2-crop-preview]")).toHaveAttribute("y", "112");
  await expect(page.locator("[data-diagram2-crop-preview]")).toHaveAttribute("width", "618");
  await expect(page.locator("[data-diagram2-crop-preview]")).toHaveAttribute("height", "390");
  await page.locator("[data-diagram2-tool='crop']").click();
  await page.locator("[data-action='reset-diagram2-crop']").click();
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
  const largeFocusBefore = await prepareDiagram2FieldMappingFocus(page, "large-table");
  const largeFocusHistoryBefore = await page.evaluate(() =>
    window.__pmtDiagram2EditorCore.historyStatus().entryCount);
  const largeDatabaseCell = page.locator(
    "[data-diagram2-mapping-table-plane] [data-diagram2-field-mapping-cell][data-diagram2-field-mapping-cell-kind='database']"
  ).first();
  await expect(largeDatabaseCell).toBeVisible();
  await page.evaluate(() => {
    window.__diagram2FieldFocusStartedAt = performance.now();
  });
  await largeDatabaseCell.dblclick();
  const largeTarget = largeState.objects.find(object => object.id === "large-target");
  const largeFocus = await diagram2FieldFocusEvidence(
    page,
    boundsCenter(annotationEntityFieldBounds(largeTarget, "Name"))
  );
  expect(largeFocus.scale).toBeGreaterThan(largeFocusBefore.scale);
  expect(largeFocus.centerDeltaX).toBeLessThanOrEqual(1);
  expect(largeFocus.centerDeltaY).toBeLessThanOrEqual(1);
  expect(largeFocus.fullRenderCount).toBe(largeFocusBefore.fullRenderCount);
  expect(largeFocus.routesRecalculatedDuringSettle).toBe(0);
  expect(largeFocus.durationMs).toBeLessThan(500);
  expect(await page.evaluate(() =>
    window.__pmtDiagram2EditorCore.historyStatus().entryCount)).toBe(largeFocusHistoryBefore);
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
    const annotation = await import("/js/components/image-annotation.js?v=20260731-rte-checkbox-layout-v2");
    const interactions = await import("/js/components/diagram-field-mapping-interactions.js?v=20260731-rte-checkbox-layout-v2");
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
    const fieldMappingRelationship = annotation.annotationEntityRelationshipRenderModel(
      state.objects,
      state.relationshipStyle
    ).renderedRelationships.find(item =>
      item.relationship.source?.entityKind === "field-rectangle"
      || item.relationship.target?.entityKind === "field-rectangle");
    const hiddenMarkup = annotation.buildAnnotationSvg(state, {
      hideFieldRectangleRelationships: true,
      interactiveFieldMapping: true
    });
    const hiddenSvg = new DOMParser().parseFromString(hiddenMarkup, "image/svg+xml").documentElement;
    const activeMarkup = annotation.annotationFieldMappingActiveRelationshipsSvg(
      state,
      new Set(fieldMappingRelationship ? [fieldMappingRelationship.relationship.id] : [])
    );
    const activeSvg = new DOMParser().parseFromString(
      `<svg xmlns="http://www.w3.org/2000/svg">${activeMarkup}</svg>`,
      "image/svg+xml"
    ).documentElement;
    return {
      table: window.__phase6D1TableFingerprint,
      uiCellCount: table.querySelectorAll("[data-annotation-field-mapping-cell-kind='ui']").length,
      databaseCellCount: table.querySelectorAll("[data-annotation-field-mapping-cell-kind='database']").length,
      tableVisibleWithLinesHidden: Boolean(hiddenSvg.querySelector("[data-annotation-object-id='table-phase6']")),
      fieldRectangleVisibleWithLinesHidden: Boolean(hiddenSvg.querySelector("[data-annotation-object-id='field-phase6']")),
      relationshipCountWithLinesHidden: hiddenSvg.querySelectorAll(".image-annotation-entity-relationship").length,
      activeRelationshipCount: activeSvg.querySelectorAll(
        "[data-annotation-field-mapping-active-relationships] .image-annotation-entity-relationship"
      ).length
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
  expect(d1Evidence.tableVisibleWithLinesHidden).toBe(true);
  expect(d1Evidence.fieldRectangleVisibleWithLinesHidden).toBe(true);
  expect(d1Evidence.relationshipCountWithLinesHidden).toBe(0);
  expect(d1Evidence.activeRelationshipCount).toBe(1);
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
    const { createDiagram2Renderer } = await import("/js/features/diagram2/diagram2-renderer.js?v=20260731-checkbox-d2-view-options-v4");
    const { createDiagram2FieldMappingIndexes } = await import("/js/features/diagram2/diagram2-editor-field-mappings.js?v=20260731-rte-checkbox-layout-v2");
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
    renderer.setFieldMappingLinesVisible(false);
    const fieldRectangle = document.querySelector("[data-diagram2-object-id='field-phase6']");
    const fieldRectangleDisplayBeforePin = getComputedStyle(fieldRectangle).display;
    renderer.showFieldMappingHover(window.__phase6D2MappingId, {
      tableId: "table-phase6",
      cellKind: "ui"
    });
    const hoverHighlight = window.__phase6D2HighlightFingerprint();
    renderer.pinFieldMapping(window.__phase6D2MappingId, {
      tableId: "table-phase6",
      cellKind: "ui"
    });
    const fieldRelationshipPlane = document.querySelector("[data-diagram2-field-relationship-plane]");
    const table = document.querySelector("[data-diagram2-object-id='table-phase6']");
    return {
      arrows: window.__phase6D2ArrowFingerprint(
        document.querySelectorAll("[data-diagram2-field-mapping-attention-arrows]")
      ),
      highlight: window.__phase6D2HighlightFingerprint(),
      hoverHighlight,
      diagnostics: renderer.diagnostics(),
      fieldRelationshipPlaneDisplay: getComputedStyle(fieldRelationshipPlane).display,
      tableDisplay: getComputedStyle(table).display,
      fieldRectangleDisplayBeforePin,
      fieldRectangleDisplay: getComputedStyle(fieldRectangle).display,
      activeRelationshipCount: document.querySelectorAll(
        "[data-diagram2-field-mapping-active-relationship]"
      ).length,
      activeRelationshipPathCount: document.querySelectorAll(
        "[data-diagram2-field-mapping-active-relationship-path]"
      ).length
    };
  });
  expectArrowParity(d2UiResult.arrows, d1UiArrows);
  expectHighlightParity(d2UiResult.hoverHighlight, d1Highlight);
  expect(d2UiResult.highlight.filter(item => item.kind === "rect")).toHaveLength(0);
  expectHighlightParity(
    d2UiResult.highlight,
    d1Highlight.filter(item => item.kind === "line")
  );
  expect(d2UiResult.diagnostics.fullRenderCount).toBe(d2Evidence.fullRenderCount);
  expect(d2UiResult.diagnostics.selectiveRoutingRelationshipsRerouted).toBe(d2Evidence.relationshipRerouteCount);
  expect(d2UiResult.fieldRelationshipPlaneDisplay).toBe("none");
  expect(d2UiResult.tableDisplay).not.toBe("none");
  expect(d2UiResult.fieldRectangleDisplayBeforePin).toBe("none");
  expect(d2UiResult.fieldRectangleDisplay).not.toBe("none");
  expect(d2UiResult.activeRelationshipCount).toBe(1);
  expect(d2UiResult.activeRelationshipPathCount).toBe(1);
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

async function prepareDiagram2FieldMappingFocus(page, tableId = "table-phase6") {
  return page.evaluate(async id => {
    const renderer = window.__pmtDiagram2Renderer;
    renderer.focusObjectIds([id], {
      scale: 0.25,
      reason: "prepare Field mapping focus test"
    });
    await renderer.whenIdle();
    const diagnostics = renderer.diagnostics();
    return {
      scale: renderer.viewportMatrix().scale,
      fullRenderCount: diagnostics.fullRenderCount
    };
  }, tableId);
}

async function diagram2MappingPaneArrowOriginEvidence(page) {
  return page.evaluate(() => {
    const renderer = window.__pmtDiagram2Renderer;
    const surfaceRect = document.querySelector("[data-diagram2-renderer-surface]")?.getBoundingClientRect();
    const paneRect = document.querySelector("[data-diagram2-mapping-pane]")?.getBoundingClientRect();
    return ["ui", "database"].map(kind => {
      const line = document.querySelector(`[data-diagram2-field-mapping-attention-arrow='${kind}']`);
      const fieldRect = document.querySelector(
        `[data-diagram2-mapping-pane-field][data-diagram2-field-mapping-cell-kind='${kind}']`
      )?.getBoundingClientRect();
      const start = renderer.worldToScreen({
        x: Number(line?.getAttribute("x1") || 0),
        y: Number(line?.getAttribute("y1") || 0)
      });
      const startX = (surfaceRect?.left || 0) + start.x;
      const startY = (surfaceRect?.top || 0) + start.y;
      return {
        kind,
        startDeltaX: Math.abs(startX - (paneRect?.right || 0)),
        startDeltaY: Math.abs(startY - ((fieldRect?.top || 0) + ((fieldRect?.height || 0) / 2)))
      };
    });
  });
}

async function diagram2FieldFocusEvidence(page, worldPoint) {
  return page.evaluate(async point => {
    const renderer = window.__pmtDiagram2Renderer;
    await renderer.whenIdle();
    const diagnostics = renderer.diagnostics();
    const surface = document.querySelector("[data-diagram2-renderer-surface]");
    const surfaceRect = surface.getBoundingClientRect();
    const main = document.querySelector("[data-diagram2-editor-main], [data-diagram2-readonly-main]");
    const pane = main?.classList.contains("is-left-pane-open")
      ? [...main.querySelectorAll("[data-diagram2-left-pane]")]
        .find(candidate => candidate.dataset.diagram2LeftPaneName === main.dataset.diagram2LeftPaneMode)
      : null;
    const paneRect = pane?.getBoundingClientRect?.();
    const leftInset = paneRect && paneRect.right > surfaceRect.left && paneRect.left < surfaceRect.right
      ? Math.round(Math.min(surfaceRect.width - 1, Math.max(0, paneRect.right - surfaceRect.left)))
      : 0;
    const target = renderer.worldToScreen(point);
    const viewportCenter = {
      x: leftInset + ((Math.round(surfaceRect.width) - leftInset) / 2),
      y: Math.round(surfaceRect.height) / 2
    };
    const scale = renderer.viewportMatrix().scale;
    return {
      scale,
      centerDeltaX: Math.abs(target.x - viewportCenter.x),
      centerDeltaY: Math.abs(target.y - viewportCenter.y),
      zoomControlValue: document.querySelector("[data-filter='diagram2-zoom']")?.value || "",
      reason: document.querySelector("[data-diagram2-svg]")?.dataset.diagram2ViewportReason || "",
      fullRenderCount: diagnostics.fullRenderCount,
      routesRecalculatedDuringSettle: Number(diagnostics.routesRecalculatedDuringSettle || 0),
      durationMs: performance.now() - Number(window.__diagram2FieldFocusStartedAt || performance.now())
    };
  }, worldPoint);
}

async function diagram2VisibleContentCenterEvidence(page) {
  return page.evaluate(async () => {
    const waitForLayout = () => new Promise(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await waitForLayout();
    const renderer = window.__pmtDiagram2Renderer;
    await renderer.whenIdle();
    await waitForLayout();

    const surface = document.querySelector("[data-diagram2-renderer-surface]");
    const surfaceRect = surface.getBoundingClientRect();
    const pane = document.querySelector("[data-diagram2-readonly-main].is-left-pane-open [data-diagram2-mapping-pane]");
    const paneRect = pane?.getBoundingClientRect?.();
    const paneOverlaps = paneRect
      && paneRect.right > surfaceRect.left
      && paneRect.left < surfaceRect.right;
    const visibleLeft = paneOverlaps ? Math.max(surfaceRect.left, paneRect.right) : surfaceRect.left;
    const visibleCenter = {
      x: visibleLeft + ((surfaceRect.right - visibleLeft) / 2),
      y: surfaceRect.top + (surfaceRect.height / 2)
    };
    const objectRects = [...document.querySelectorAll("[data-diagram2-object-id]")]
      .filter(node => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== "hidden")
      .map(node => node.getBoundingClientRect())
      .filter(rect => rect.width > 0 && rect.height > 0);
    const contentBounds = objectRects.reduce((bounds, rect) => ({
      left: Math.min(bounds.left, rect.left),
      top: Math.min(bounds.top, rect.top),
      right: Math.max(bounds.right, rect.right),
      bottom: Math.max(bounds.bottom, rect.bottom)
    }), {
      left: Number.POSITIVE_INFINITY,
      top: Number.POSITIVE_INFINITY,
      right: Number.NEGATIVE_INFINITY,
      bottom: Number.NEGATIVE_INFINITY
    });
    const contentCenter = {
      x: (contentBounds.left + contentBounds.right) / 2,
      y: (contentBounds.top + contentBounds.bottom) / 2
    };
    return {
      availableWidth: surfaceRect.right - visibleLeft,
      mappingPaneWidth: paneRect?.width || 0,
      mappingTableVisible: document.querySelector("[data-diagram2-object-id='table-phase6']")
        ?.getClientRects?.().length > 0,
      centerDeltaX: Math.abs(contentCenter.x - visibleCenter.x),
      centerDeltaY: Math.abs(contentCenter.y - visibleCenter.y),
      fullRenderCount: Number(renderer.diagnostics().fullRenderCount || 0),
      durationMs: performance.now() - Number(window.__diagram2TreeToggleStartedAt || performance.now())
    };
  });
}

function boundsCenter(bounds) {
  return {
    x: bounds.x + (bounds.width / 2),
    y: bounds.y + (bounds.height / 2)
  };
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
  expect(Math.abs((after.image.x + (after.image.width / 2)) - before.insertionPoint.x)).toBeLessThanOrEqual(2.5);
  expect(Math.abs((after.image.y + (after.image.height / 2)) - before.insertionPoint.y)).toBeLessThanOrEqual(2.5);
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
  await expect(page.locator("[data-diagram2-crop-overlay]")).toBeHidden();
  await page.mouse.move(box.x + (box.width / 2) + 36, box.y + (box.height / 2) + 28, { steps: 4 });
  await expect(page.locator("[data-diagram2-crop-overlay]")).toBeHidden();
  await page.mouse.up();
  await expect(page.locator("[data-diagram2-crop-overlay]")).toBeVisible();
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

function zOrderState() {
  return normalizeAnnotationState({
    version: 1,
    width: 900,
    height: 540,
    gridVisible: false,
    objects: [
      createDiagram2EmbeddedImage({
        id: "z-image",
        name: "Z-order image",
        source: mockScreenshotDataUrl(),
        x: 100,
        y: 80,
        width: 360,
        height: 240
      }),
      {
        id: "z-red",
        type: "rectangle",
        name: "Red box",
        x: 140,
        y: 120,
        width: 220,
        height: 120,
        fill: "#ef4444",
        stroke: "#991b1b",
        strokeWidth: 2,
        opacity: 1
      }
    ]
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

function diagram2FieldMappingRowFontWeights(row) {
  return row.locator("text").evaluateAll(nodes =>
    nodes.map(node => Number(getComputedStyle(node).fontWeight)));
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
