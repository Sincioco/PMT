import { expect, test } from "@playwright/test";

test("Diagram editable copy and paste writes the shared selection clipboard package", async ({ page }) => {
  await page.addInitScript(() => {
    window.__pmtClipboardWrites = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        write: async items => {
          const item = items?.[0];
          const blob = item && typeof item.getType === "function" ? await item.getType("text/plain") : null;
          window.__pmtClipboardWrites.push(blob ? await blob.text() : "");
        },
        writeText: async text => {
          window.__pmtClipboardWrites.push(String(text || ""));
        },
        readText: async () => window.__pmtClipboardWrites.at(-1) || ""
      }
    });
  });
  await page.route("**/image-annotation-clipboard-test.html", route => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html>
      <html data-theme="light">
        <head>
          <title>Image Annotation Clipboard Test</title>
          <link rel="stylesheet" href="/css/themes.css">
          <link rel="stylesheet" href="/css/components/buttons.css">
          <link rel="stylesheet" href="/css/components/forms.css">
          <link rel="stylesheet" href="/css/components/dialogs.css">
          <link rel="stylesheet" href="/css/components/image-annotation.css">
        </head>
        <body></body>
      </html>`
  }));
  await page.goto("/image-annotation-clipboard-test.html");

  await page.evaluate(async () => {
    const annotation = await import("/js/components/image-annotation.js?v=20260726-annotation-production-clip-v1");
    const state = annotation.normalizeAnnotationState({
      width: 600,
      height: 400,
      gridVisible: false,
      objects: [{
        id: "copy-rectangle",
        type: "rectangle",
        x: 80,
        y: 70,
        width: 160,
        height: 90,
        fill: "#ffffff",
        stroke: "#126bff",
        strokeWidth: 3
      }]
    });
    const annotationUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(annotation.buildAnnotationSvg(state))}`;
    annotation.openImageAnnotationDialog({
      annotationUrl,
      canvasWidth: 600,
      canvasHeight: 400,
      initialSelection: "none",
      title: "Image Annotation Clipboard Test",
      applyLabel: "Done",
      apply: async result => result,
      askForColor: async color => color,
      askForText: async () => "",
      confirm: async () => true,
      notify: () => {}
    });
  });

  const dialog = page.locator("dialog.image-annotation-dialog");
  const canvas = dialog.locator("[data-annotation-canvas]");
  const objects = canvas.locator(".image-annotation-object[data-annotation-object-id]");

  await expect(dialog).toBeVisible();
  await expect(objects).toHaveCount(1);

  await canvas.click({ position: { x: 20, y: 20 } });
  await page.keyboard.press("Control+A");
  await expect(dialog.locator("[data-annotation-selection-label]")).toHaveText("Rectangle");

  await page.keyboard.press("Control+C");
  await expect.poll(() => page.evaluate(() => window.__pmtClipboardWrites.at(-1) || "")).toContain("PMT_DIAGRAM_SELECTION_V1");
  await expect.poll(() => page.evaluate(() => window.__pmtClipboardWrites.at(-1) || "")).toContain('"format":"pmt-diagram-selection"');

  await page.keyboard.press("Control+V");
  await expect(objects).toHaveCount(2);
  await expect(dialog.locator("[data-annotation-selection-label]")).toHaveText("Rectangle");

  await page.keyboard.press("Control+V");
  await expect(objects).toHaveCount(3);
});

test("Field Mapping Table hover draws yellow mapping highlights without changing mapped colors", async ({ page }) => {
  await page.route("**/image-annotation-hover-test.html", route => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html>
      <html data-theme="light">
        <head>
          <title>Image Annotation Hover Test</title>
          <link rel="stylesheet" href="/css/themes.css">
          <link rel="stylesheet" href="/css/components/buttons.css">
          <link rel="stylesheet" href="/css/components/forms.css">
          <link rel="stylesheet" href="/css/components/dialogs.css">
          <link rel="stylesheet" href="/css/components/image-annotation.css">
        </head>
        <body></body>
      </html>`
  }));
  await page.goto("/image-annotation-hover-test.html");

  await page.evaluate(async () => {
    const annotation = await import("/js/components/image-annotation.js?v=20260726-annotation-production-clip-v1");
    const databaseEntity = {
      id: "project-entity",
      type: "entity",
      x: 650,
      y: 120,
      width: 260,
      height: 160,
      entitySchema: "pmt",
      entityName: "Projects",
      fields: [
        { name: "ProjectId", dataType: "INT", nullable: false, isPrimaryKey: true, isForeignKey: false },
        { name: "Title", dataType: "NVARCHAR(200)", nullable: false, isPrimaryKey: false, isForeignKey: false }
      ],
      foreignKeys: []
    };
    const fieldRectangle = {
      id: "ui-project",
      type: "entity",
      entityKind: "field-rectangle",
      fieldRectangleName: "Project",
      fieldRectangleConnectionSide: "bottom",
      x: 100,
      y: 360,
      width: 360,
      height: 52,
      fill: "none",
      stroke: "#ef4444",
      strokeWidth: 2,
      fields: [{ name: "Project", dataType: "", nullable: null, isForeignKey: true, isImportant: true }],
      foreignKeys: [{
        name: "FK_UI_Project_Projects",
        columns: ["Project"],
        referencedSchema: "pmt",
        referencedTable: "Projects",
        referencedColumns: ["Title"],
        relationshipType: "one-to-many",
        styleOverride: { stroke: "#22c55e", strokeWidth: 2 }
      }]
    };
    const mappingTable = {
      id: "project-mapping-table",
      type: "field-mapping-table",
      name: "Field Mapping Table: Task screen",
      sourceImageId: "task-screen",
      x: 48,
      y: 48,
      width: 430,
      height: 64,
      fieldMappingHighlightColor: "#f59e0b",
      fieldMappingHighlightStrokeWidth: 11,
      rows: [{
        uiEntityId: "ui-project",
        uiField: "Project",
        databaseField: "pmt.Projects.Title"
      }]
    };
    const state = annotation.normalizeAnnotationState({
      width: 1000,
      height: 650,
      objects: [mappingTable, fieldRectangle, databaseEntity]
    });
    const annotationUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(annotation.buildAnnotationSvg(state))}`;
    annotation.openImageAnnotationDialog({
      annotationUrl,
      canvasWidth: 1000,
      canvasHeight: 650,
      initialSelection: "none",
      title: "Image Annotation Hover Test",
      applyLabel: "Done",
      apply: async result => result,
      askForColor: async color => color,
      askForText: async () => "",
      confirm: async () => true,
      notify: () => {}
    });
  });

  const dialog = page.locator("dialog.image-annotation-dialog");
  const canvas = dialog.locator("[data-annotation-canvas]");
  const mappingCell = canvas.locator("[data-annotation-field-mapping-ui-cell]");

  await expect(dialog).toBeVisible();
  await expect(canvas.locator("[data-annotation-field-mapping-cell]")).toHaveCount(2);
  await expect(mappingCell).toHaveCount(1);
  await expect(canvas.locator(".image-annotation-selection-group")).toHaveCount(0);

  await mappingCell.hover();
  await expect.poll(() => canvas.locator(".image-annotation-field-mapping-attention-highlight").count()).toBe(1);
  await expect(canvas.locator(".image-annotation-field-mapping-attention-rect")).toHaveCount(2);
  await expect.poll(() => canvas.locator(".image-annotation-field-mapping-attention-line").count()).toBeGreaterThan(0);
  expect(await canvas.locator(".image-annotation-field-mapping-attention-highlight").evaluate(group =>
    group.style.color
  )).toBe("rgb(245, 158, 11)");
  await expect(canvas.locator(".image-annotation-field-mapping-attention-line").first()).toHaveAttribute("stroke-width", "11");
  await expect(canvas.locator(".image-annotation-field-mapping-hover-relationship")).toHaveCount(0);
  await expect(canvas.locator(".image-annotation-object.is-field-rectangle.is-field-mapping-hover")).toHaveCount(0);
  await expect(canvas.locator(".image-annotation-selection-group")).toHaveCount(0);
  expect(await canvas.locator(".image-annotation-entity-relationship-path").first().evaluate(path =>
    path.getAttribute("stroke")
  )).toBe("#22c55e");
  await page.waitForTimeout(3200);
  await expect(canvas.locator(".image-annotation-field-mapping-attention-highlight")).toHaveCount(1);
  await expect(canvas.locator(".image-annotation-field-mapping-attention-arrow")).toHaveCount(0);

  await mappingCell.click();
  await expect(dialog.locator("[data-annotation-selection-label]")).toHaveText("3 objects selected");
  await expect(canvas.locator(".image-annotation-selection-group")).toHaveCount(2);
});
