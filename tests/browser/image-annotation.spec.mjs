import { expect, test } from "@playwright/test";

test("Field Mapping Table hover does not draw outward selection chrome", async ({ page }) => {
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
    const annotation = await import("/js/components/image-annotation.js?v=20260725-field-mapping-v19");
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
        relationshipType: "one-to-many"
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
  const mappingCell = canvas.locator("[data-annotation-field-mapping-cell]");

  await expect(dialog).toBeVisible();
  await expect(mappingCell).toHaveCount(1);
  await expect(canvas.locator(".image-annotation-selection-group")).toHaveCount(0);

  await mappingCell.hover();
  await expect.poll(() => canvas.locator(".image-annotation-object.is-field-rectangle.is-field-mapping-hover").count()).toBe(1);
  await expect.poll(() => canvas.locator(".image-annotation-entity-relationship.is-field-mapping-hover").count()).toBe(1);
  await expect(canvas.locator(".image-annotation-field-mapping-hover-relationship")).toHaveCount(1);
  await expect(canvas.locator(".image-annotation-entity-relationship-handle")).toHaveCount(0);
  await expect(canvas.locator(".image-annotation-selection-group")).toHaveCount(0);

  await mappingCell.click();
  await expect(dialog.locator("[data-annotation-selection-label]")).toHaveText("Field: Project");
  await expect(canvas.locator(".image-annotation-selection-group")).toHaveCount(1);
});
