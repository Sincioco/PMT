import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

test("Diagram 1 Crop oracle preserves the shared Phase 6 Crop fixture", async ({ page }, testInfo) => {
  const source = cropParityScreenshotDataUrl();
  await page.route("**/image-annotation-crop-test.html", route => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html>
      <html data-theme="light">
        <head>
          <title>Image Annotation Crop Test</title>
          <link rel="stylesheet" href="/css/tokens.css">
          <link rel="stylesheet" href="/css/themes.css">
          <link rel="stylesheet" href="/css/base.css">
          <link rel="stylesheet" href="/css/layout.css">
          <link rel="stylesheet" href="/css/components/buttons.css">
          <link rel="stylesheet" href="/css/components/forms.css">
          <link rel="stylesheet" href="/css/components/dialogs.css">
          <link rel="stylesheet" href="/css/components/image-annotation.css">
          <link rel="stylesheet" href="/css/features/diagram.css">
        </head>
        <body></body>
      </html>`
  }));
  await page.goto("/image-annotation-crop-test.html");

  await page.evaluate(async imageSource => {
    const annotation = await import("/js/components/image-annotation.js?v=20260731-rte-checkbox-layout-v2");
    const state = annotation.normalizeAnnotationState({
      width: 1600,
      height: 900,
      gridVisible: false,
      objects: [{
        id: "crop-parity-image",
        type: "embedded-image",
        name: "Crop parity image",
        source: imageSource,
        x: 60,
        y: 100,
        width: 660,
        height: 420,
        imageClip: { x: 60, y: 100, width: 660, height: 420 },
        cropVisible: true,
        cropCornerRadius: 0,
        isOriginalImage: true
      }]
    });
    const annotationUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(annotation.buildAnnotationSvg(state))}`;
    window.__d1CropPromise = annotation.openImageAnnotationDialog({
      annotationUrl,
      canvasWidth: 1600,
      canvasHeight: 900,
      title: "Diagram 1 Crop Oracle",
      applyLabel: "Done",
      apply: async result => {
        window.__d1CropResult = result;
        return result;
      },
      confirm: async () => true,
      notify: () => {}
    });
  }, source);

  const dialog = page.locator("dialog.image-annotation-dialog");
  const canvas = dialog.locator("[data-annotation-canvas]");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-annotation-selection-label]")).toContainText("Crop parity image");
  await page.waitForTimeout(100);
  await dialog.locator("[data-annotation-zoom-select]").selectOption("90");
  await page.waitForTimeout(100);
  await dialog.locator("[data-annotation-tool='crop']").click();
  await expect(canvas.locator(".image-annotation-crop-selection")).toBeVisible();
  await expect(canvas.locator(".image-annotation-selection-group")).toHaveCount(0);
  if (testInfo.project.name === "chromium-1366") {
    await captureCropClosureScreenshot(page, "crop-d1-entry-1366x768.png");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.evaluate(() => window.__d1CropPromise);
    return;
  }

  const handle = canvas.locator(".image-annotation-crop-handle[data-annotation-handle='nw']");
  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();
  await page.mouse.move(handleBox.x + (handleBox.width / 2), handleBox.y + (handleBox.height / 2));
  await page.mouse.down();
  await page.mouse.move(handleBox.x + (handleBox.width / 2) + 28, handleBox.y + (handleBox.height / 2) + 22, { steps: 4 });
  await page.mouse.up();

  const cropTab = dialog.locator("[data-annotation-inspector-tab='crop']");
  await expect(cropTab).toBeVisible();
  await cropTab.click();
  const cropValues = {
    left: 18,
    right: 24,
    top: 12,
    bottom: 18
  };
  for (const [edge, value] of Object.entries(cropValues)) {
    await dialog.locator(`[data-annotation-crop-inset='${edge}']`).fill(String(value));
  }
  await expect(dialog.locator("[data-annotation-crop-inset='left']")).toHaveValue("18");
  if (testInfo.project.name === "chromium-1920") {
    await captureCropClosureScreenshot(page, "crop-d1-insets-1920x1080.png");
  }

  const radius = dialog.locator("[data-annotation-crop-corner-radius]");
  await radius.fill("28");
  await expect(radius).toBeFocused();
  await expect(canvas.locator(".image-annotation-selection-group")).toHaveCount(0);
  if (testInfo.project.name === "chromium-1920") {
    await captureCropClosureScreenshot(page, "crop-d1-radius-selection-hidden-1920x1080.png");
  }

  await dialog.locator("[data-annotation-crop-corner='topLeft']").fill("12");
  await expect(dialog.locator("[data-annotation-crop-corner='topRight']")).toHaveValue("28");
  await expect(dialog.locator("[data-annotation-crop-corner='bottomRight']")).toHaveValue("28");
  await expect(dialog.locator("[data-annotation-crop-corner='bottomLeft']")).toHaveValue("28");
  if (testInfo.project.name === "chromium-1920") {
    await captureCropClosureScreenshot(page, "crop-d1-independent-corners-1920x1080.png");
  }

  await page.waitForTimeout(600);
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await page.evaluate(() => window.__d1CropPromise);
  const saved = await page.evaluate(async () => {
    const annotation = await import("/js/components/image-annotation.js?v=20260731-rte-checkbox-layout-v2");
    const image = window.__d1CropResult.state.objects.find(object => object.id === "crop-parity-image");
    return {
      insets: annotation.annotationImageCropInsets(image),
      corners: annotation.annotationImageCropCornerRadii(image),
      clip: image.imageClip
    };
  });
  expect(saved).toEqual({
    insets: cropValues,
    corners: {
      topLeft: 12,
      topRight: 28,
      bottomRight: 28,
      bottomLeft: 28
    },
    clip: {
      x: 78,
      y: 112,
      width: 618,
      height: 390
    }
  });

  await page.evaluate(async () => {
    const annotation = await import("/js/components/image-annotation.js?v=20260731-rte-checkbox-layout-v2");
    const state = window.__d1CropResult.state;
    const annotationUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(annotation.buildAnnotationSvg(state))}`;
    window.__d1CropReopenPromise = annotation.openImageAnnotationDialog({
      annotationUrl,
      canvasWidth: 1600,
      canvasHeight: 900,
      title: "Diagram 1 Crop Reopen",
      applyLabel: "Done",
      apply: async result => result,
      confirm: async () => true,
      notify: () => {}
    });
  });
  const reopenedDialog = page.locator("dialog.image-annotation-dialog");
  await expect(reopenedDialog).toBeVisible();
  await expect(reopenedDialog.locator("[data-annotation-inspector-tab='crop']")).toBeVisible();
  await reopenedDialog.locator("[data-annotation-inspector-tab='crop']").click();
  await expect(reopenedDialog.locator("[data-annotation-crop-inset='left']")).toHaveValue("18");
  await expect(reopenedDialog.locator("[data-annotation-crop-corner='topLeft']")).toHaveValue("12");
  await reopenedDialog.locator("[data-annotation-tool='crop']").click();
  await expect(page.getByRole("heading", { name: "Crop Options" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).last().click();
  await reopenedDialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.evaluate(() => window.__d1CropReopenPromise);
});

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
    const annotation = await import("/js/components/image-annotation.js?v=20260731-rte-checkbox-layout-v2");
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
  const pressCanvasShortcut = key => canvas.dispatchEvent("keydown", {
    key,
    ctrlKey: true,
    bubbles: true,
    cancelable: true
  });

  await expect(dialog).toBeVisible();
  await expect(objects).toHaveCount(1);

  await canvas.click({ position: { x: 20, y: 20 } });
  await pressCanvasShortcut("a");
  await expect(dialog.locator("[data-annotation-selection-label]")).toHaveText("Rectangle");

  await pressCanvasShortcut("c");
  await expect.poll(() => page.evaluate(() => window.__pmtClipboardWrites.at(-1) || "")).toContain("PMT_DIAGRAM_SELECTION_V1");
  await expect.poll(() => page.evaluate(() => window.__pmtClipboardWrites.at(-1) || "")).toContain('"format":"pmt-diagram-selection"');

  await pressCanvasShortcut("v");
  await expect(objects).toHaveCount(2);
  await expect(dialog.locator("[data-annotation-selection-label]")).toHaveText("Rectangle");

  await pressCanvasShortcut("v");
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
    const annotation = await import("/js/components/image-annotation.js?v=20260731-rte-checkbox-layout-v2");
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

test("public Diagram viewer hydrates Field Mapping Table highlights and arrows", async ({ page }) => {
  await page.route("**/public-field-mapping-test.html", route => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html>
      <html data-theme="light">
        <head>
          <title>Public Field Mapping Test</title>
          <link rel="stylesheet" href="/css/themes.css">
          <link rel="stylesheet" href="/css/components/forms.css">
          <link rel="stylesheet" href="/css/components/image-annotation.css">
        </head>
        <body></body>
      </html>`
  }));
  await page.goto("/public-field-mapping-test.html");

  await page.evaluate(async () => {
    const annotation = await import("/js/components/image-annotation.js?v=20260731-rte-checkbox-layout-v2");
    const state = annotation.normalizeAnnotationState({
      width: 1000,
      height: 650,
      objects: [{
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
      }, {
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
      }, {
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
      }]
    });
    const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(annotation.buildAnnotationSvg(state))}`;
    document.body.innerHTML = `
      <figure class="pmt-diagram-ole" data-public-linked-diagram data-header="Linked Diagram: Field Mapping">
        <template data-public-diagram-source>
          <img data-pmt-diagram="true" src="${source}" alt="Field Mapping">
        </template>
      </figure>
    `;
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/js/public-linked-diagram-viewer.js?v=20260728-public-field-mapping-v1";
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  });

  const viewer = page.locator("[data-public-linked-diagram]");
  const svg = viewer.locator("[data-diagram-ole-surface] > svg");
  const mappingCell = svg.locator("[data-annotation-field-mapping-ui-cell]");

  await expect(svg).toHaveCount(1);
  await expect(viewer.locator("[data-diagram-ole-surface] > img")).toHaveCount(0);
  await expect(mappingCell).toHaveCount(1);

  await mappingCell.hover();
  await expect(svg.locator(".image-annotation-field-mapping-attention-highlight")).toHaveCount(1);
  await expect(svg.locator(".image-annotation-field-mapping-attention-arrow")).toHaveCount(2);

  await mappingCell.click();
  await page.locator(".pmt-diagram-ole-caption").hover();
  await expect(svg.locator("[data-annotation-field-mapping-row].is-pinned")).toHaveCount(1);
  await expect(svg.locator(".image-annotation-field-mapping-attention-highlight")).toHaveCount(1);
  await expect(svg.locator(".image-annotation-field-mapping-attention-arrow")).toHaveCount(2);
});

async function captureCropClosureScreenshot(page, fileName) {
  const directory = path.join(
    process.cwd(),
    "docs",
    "screenshots",
    "diagram-2-phase-6",
    "closure",
    "crop"
  );
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: path.join(directory, fileName),
    fullPage: false
  });
}

function cropParityScreenshotDataUrl() {
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
