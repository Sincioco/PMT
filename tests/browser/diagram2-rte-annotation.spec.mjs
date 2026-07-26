import { expect, test } from "@playwright/test";

test.use({ timezoneId: "Asia/Taipei" });

test("Annotate 2.0 saves through the RTE upload URL and remains editable", async ({ page }) => {
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

  await page.goto("/");
  await page.setContent(`
    <div class="rich-editor" contenteditable="true">
      <p><img id="targetImage" src="/uploads/original.svg" alt="Original" style="width: 160px;" data-existing-size="keep"></p>
    </div>
  `);

  await page.evaluate(() => {
    window.__diagram2RteNotifications = [];
  });
  await page.evaluate(async () => {
    const { openDiagram2RteAnnotationHost } = await import("/js/features/diagram2/diagram2-rte-host-adapter.js?v=20260726-annotation-rte-composition-v2");
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
      notify: message => window.__diagram2RteNotifications.push(message),
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
  const movedImage = await page.evaluate(async () => {
    const controller = window.__pmtDiagram2EditorCore;
    const imageObject = controller.state().objects.find(object => object.type === "embedded-image" && object.isOriginalImage === true);
    controller.setSelection([imageObject.id]);
    const moved = await controller.moveObjects([imageObject.id], 80, 40, { reason: "test moved image" });
    const nextImage = controller.state().objects.find(object => object.id === imageObject.id);
    controller.setState({
      ...controller.state(),
      objects: [
        ...controller.state().objects,
        {
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
        }
      ]
    }, { resetHistory: false });
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
  expect(uploadedSvg).not.toContain("pmt-annotation-image-clip-");
  expect(uploadedSvg).toContain('"id":"outside-arrow"');
  expect(uploadedSvg).toContain('"imageClip":{"x":0,"y":0,"width":320,"height":180}');
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
    const { openDiagram2RteAnnotationHost } = await import("/js/features/diagram2/diagram2-rte-host-adapter.js?v=20260726-annotation-rte-composition-v2");
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
  const reopened = await page.evaluate(() => {
    const controller = window.__pmtDiagram2EditorCore;
    const state = controller.state();
    const imageObject = state.objects.find(object => object.type === "embedded-image" && object.isOriginalImage === true);
    return {
      objectCount: controller.statusSnapshot().objectCount,
      imageX: imageObject?.x,
      imageY: imageObject?.y,
      clip: imageObject?.imageClip,
      hasOutsideArrow: state.objects.some(object => object.id === "outside-arrow" && object.type === "arrow")
    };
  });
  expect(reopened.objectCount).toBeGreaterThan(0);
  expect(reopened.imageX).toBe(0);
  expect(reopened.imageY).toBe(0);
  expect(reopened.clip).toEqual({ x: 0, y: 0, width: 320, height: 180 });
  expect(reopened.hasOutsideArrow).toBe(true);
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.evaluate(() => window.__diagram2EditPromise);
});

test("Annotate 2.0 cancel performs no upload and leaves RTE image unchanged", async ({ page }) => {
  await page.route("**/uploads/original.svg", route => route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="#ffffff"/></svg>`
  }));

  await page.goto("/");
  await page.setContent(`
    <div class="rich-editor" contenteditable="true">
      <p><img id="targetImage" src="/uploads/original.svg" alt="Original" style="width: 160px;" data-existing-size="keep"></p>
    </div>
  `);
  const before = await page.locator("#targetImage").evaluate(image => image.outerHTML);

  await page.evaluate(async () => {
    const { openDiagram2RteAnnotationHost } = await import("/js/features/diagram2/diagram2-rte-host-adapter.js?v=20260726-annotation-rte-composition-v2");
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

test("Annotate 2.0 cannot bypass the originating RTE update permission", async ({ page }) => {
  await page.goto("/");
  await page.setContent(`
    <div class="rich-editor" contenteditable="false" aria-readonly="true">
      <p><img id="targetImage" src="/uploads/original.svg" alt="Original"></p>
    </div>
  `);

  const result = await page.evaluate(async () => {
    const { openDiagram2RteAnnotationHost } = await import("/js/features/diagram2/diagram2-rte-host-adapter.js?v=20260726-annotation-rte-composition-v2");
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
