import assert from "node:assert/strict";
import test from "node:test";
import {
  adjustAnnotationArrowEndpoint,
  applyAnnotationTemplateFormatting,
  annotationArrowGeometry,
  annotationExpandedWorkspaceBounds,
  annotationObjectsIntersectingRect,
  annotationOutputBounds,
  annotationSelectionIdsForObject,
  annotationSelectionBounds,
  annotationWorkspaceBounds,
  buildAnnotationObjectTree,
  buildAnnotationSelectionSvg,
  buildAnnotationSvg,
  captureAnnotationTemplate,
  compactAnnotationGroupLayers,
  filterAnnotationObjectTree,
  fitAnnotationArrowToHead,
  instantiateAnnotationTemplate,
  moveAnnotationLayers,
  normalizeAnnotationState,
  normalizeAnnotationTemplateLibrary,
  parseAnnotationSvg,
  reorderAnnotationObjectTree,
  restoreAnnotationDefaultTemplates,
  resizeAnnotationObjects,
  resizedAnnotationBounds,
  scaleGroupedAnnotationArrowStyle,
  snapAnnotationCropPoint,
  snapAnnotationValue,
  wrapAnnotationText,
  zoomAnnotationAtPoint
} from "../../wwwroot/js/components/image-annotation.js";

test("arrow shaft stops at a proportioned head across line widths and head sizes", () => {
  const normal = annotationArrowGeometry({
    x1: 0,
    y1: 0,
    x2: 100,
    y2: 0,
    strokeWidth: 4,
    arrowSize: 20
  });
  assert.deepEqual(normal.shaftEnd, { x: 80, y: 0 });
  assert.deepEqual(normal.headPoints, [
    { x: 100, y: 0 },
    { x: 80, y: 9.6 },
    { x: 80, y: -9.6 }
  ]);

  const thick = annotationArrowGeometry({
    x1: 0,
    y1: 0,
    x2: 100,
    y2: 0,
    strokeWidth: 20,
    arrowSize: 10
  });
  assert.deepEqual(thick.shaftEnd, { x: 70, y: 0 });
  assert.deepEqual(thick.headPoints, [
    { x: 100, y: 0 },
    { x: 70, y: 15 },
    { x: 70, y: -15 }
  ]);

  const short = annotationArrowGeometry({
    x1: 0,
    y1: 0,
    x2: 20,
    y2: 0,
    strokeWidth: 4,
    arrowSize: 160
  });
  assert.deepEqual(short.shaftEnd, { x: 4, y: 0 });
  assert.equal(short.headPoints[1].x, 4);
  assert.equal(short.headPoints[2].x, 4);
});

test("arrow endpoint resizing rotates and changes length without scaling the arrow head", () => {
  const original = {
    id: "arrow-1",
    type: "arrow",
    x1: 0,
    y1: 0,
    x2: 100,
    y2: 0,
    stroke: "#3f7f0d",
    strokeWidth: 6,
    arrowSize: 24
  };
  const originalGeometry = annotationArrowGeometry(original);
  const headDimensions = geometry => ({
    length: Math.hypot(
      geometry.headPoints[0].x - geometry.shaftEnd.x,
      geometry.headPoints[0].y - geometry.shaftEnd.y
    ),
    width: Math.hypot(
      geometry.headPoints[1].x - geometry.headPoints[2].x,
      geometry.headPoints[1].y - geometry.headPoints[2].y
    )
  });

  const movedBase = adjustAnnotationArrowEndpoint(original, "arrow-base", { x: 20, y: 80 });
  assert.deepEqual({ x: movedBase.x2, y: movedBase.y2 }, { x: 100, y: 0 });
  const movedBaseHead = headDimensions(annotationArrowGeometry(movedBase));
  const originalHead = headDimensions(originalGeometry);
  assert.ok(Math.abs(movedBaseHead.length - originalHead.length) < 0.000001);
  assert.ok(Math.abs(movedBaseHead.width - originalHead.width) < 0.000001);
  assert.equal(movedBase.arrowSize, original.arrowSize);
  assert.equal(movedBase.strokeWidth, original.strokeWidth);

  const movedTip = adjustAnnotationArrowEndpoint(original, "arrow-tip", { x: 140, y: 60 });
  assert.deepEqual({ x: movedTip.x1, y: movedTip.y1 }, { x: 0, y: 0 });
  const movedTipHead = headDimensions(annotationArrowGeometry(movedTip));
  assert.ok(Math.abs(movedTipHead.length - originalHead.length) < 0.000001);
  assert.ok(Math.abs(movedTipHead.width - originalHead.width) < 0.000001);

  const minimum = adjustAnnotationArrowEndpoint(original, "arrow-base", { x: 100, y: 0 });
  assert.ok(Math.hypot(minimum.x2 - minimum.x1, minimum.y2 - minimum.y1) >= 30);
  assert.deepEqual({ x: minimum.x2, y: minimum.y2 }, { x: 100, y: 0 });

  const fittedOversizedHead = fitAnnotationArrowToHead({ ...original, arrowSize: 160 });
  const fittedGeometry = annotationArrowGeometry(fittedOversizedHead);
  assert.equal(fittedOversizedHead.x1, -100);
  assert.equal(Math.hypot(
    fittedGeometry.headPoints[0].x - fittedGeometry.shaftEnd.x,
    fittedGeometry.headPoints[0].y - fittedGeometry.shaftEnd.y
  ), 160);
  const movedFittedBase = adjustAnnotationArrowEndpoint(
    fittedOversizedHead,
    "arrow-base",
    { x: -220, y: 0 }
  );
  const movedFittedGeometry = annotationArrowGeometry(movedFittedBase);
  assert.equal(Math.hypot(
    movedFittedGeometry.headPoints[0].x - movedFittedGeometry.shaftEnd.x,
    movedFittedGeometry.headPoints[0].y - movedFittedGeometry.shaftEnd.y
  ), 160);
});

test("group arrow width and head scale beyond direct editor limits and survive persistence", () => {
  const enlarged = scaleGroupedAnnotationArrowStyle({ strokeWidth: 40, arrowSize: 160 }, 2);
  assert.deepEqual(enlarged, { strokeWidth: 80, arrowSize: 320 });
  const reduced = scaleGroupedAnnotationArrowStyle({ strokeWidth: 1, arrowSize: 6 }, 0.5);
  assert.deepEqual(reduced, { strokeWidth: 0.5, arrowSize: 3 });
  const reducedAgain = scaleGroupedAnnotationArrowStyle(reduced, 0.5);
  assert.deepEqual(reducedAgain, { strokeWidth: 0.25, arrowSize: 1.5 });

  const state = normalizeAnnotationState({
    width: 100,
    height: 50,
    objects: [
      { id: "image", type: "image", x: 0, y: 0, width: 100, height: 50 },
      {
        id: "arrow",
        type: "arrow",
        x1: -400,
        y1: 25,
        x2: 100,
        y2: 25,
        strokeWidth: enlarged.strokeWidth,
        arrowSize: enlarged.arrowSize,
        groupId: "group-1"
      }
    ]
  });
  const svg = buildAnnotationSvg(state, "data:image/png;base64,AAECAwQ=");
  const restored = parseAnnotationSvg(svg).objects.find(object => object.type === "arrow");
  assert.equal(restored.strokeWidth, 80);
  assert.equal(restored.arrowSize, 320);
});

test("annotation SVG is self-contained, vector, editable, and escapes hostile text", () => {
  const state = normalizeAnnotationState({
    version: 1,
    width: 800,
    height: 450,
    sourceWidth: 1200,
    sourceHeight: 700,
    cropOffsetX: 120,
    cropOffsetY: 80,
    originalReference: "/uploads/richtext/original.png",
    gridVisible: true,
    snapToGrid: true,
    gridSize: 20,
    objects: [
      { id: "image-1", type: "image", x: -120, y: -80, width: 1200, height: 700, locked: true },
      { id: "rect-1", type: "rectangle", x: 30, y: 40, width: 240, height: 120, fill: "none", stroke: "#ff0000", strokeWidth: 5 },
      { id: "arrow-1", type: "arrow", x1: 100, y1: 100, x2: 400, y2: 250, stroke: "#00b050", strokeWidth: 6, arrowSize: 28 },
      {
        id: "text-1",
        type: "textbox",
        x: 320,
        y: 40,
        width: 300,
        height: 160,
        fill: "#548235",
        stroke: "#375623",
        strokeWidth: 4,
        text: "Review <script>alert('x')</script> & keep the source",
        textColor: "#ffffff",
        fontFamily: "Arial",
        fontSize: 28,
        textAlign: "right",
        textVerticalAlign: "bottom",
        groupId: "group-1"
      }
    ]
  });
  assert.deepEqual(state.imageClip, { x: 0, y: 0, width: 800, height: 450 });
  const original = "data:image/png;base64,AAECAwQ=";
  const svg = buildAnnotationSvg(state, original);

  assert.match(svg, /<image[^>]+data:image\/png;base64,AAECAwQ=/);
  assert.match(svg, /<rect/);
  assert.match(svg, /<line/);
  assert.match(svg, /<polygon/);
  assert.doesNotMatch(svg, /<line[^>]+x2="400"[^>]+y2="250"/);
  assert.match(svg, /<text/);
  assert.match(svg, /text-anchor="end"/);
  assert.doesNotMatch(svg, /<script>/i);
  assert.match(svg, /&lt;script&gt;/);
  assert.match(svg, /data-pmt-image-annotation-state="true"/);
  assert.doesNotMatch(svg, /image-annotation-arrow-(?:head-)?hit/);

  const restored = parseAnnotationSvg(svg);
  assert.equal(restored.originalReference, "/uploads/richtext/original.png");
  assert.equal(restored.sourceWidth, 1200);
  assert.equal(restored.cropOffsetX, 120);
  assert.deepEqual(restored.imageClip, state.imageClip);
  assert.equal(restored.objects.length, 4);
  assert.equal(restored.objects.find(object => object.id === "text-1").text, "Review <script>alert('x')</script> & keep the source");
  assert.equal(restored.objects.find(object => object.id === "text-1").textAlign, "right");
  assert.equal(restored.objects.find(object => object.id === "text-1").textVerticalAlign, "bottom");
  assert.equal(restored.objects.find(object => object.id === "image-1").locked, true);
});

test("rectangle and text outlines can be hidden without losing their saved colors", () => {
  const state = normalizeAnnotationState({
    width: 120,
    height: 80,
    objects: [
      { id: "image", type: "image", x: 0, y: 0, width: 120, height: 80 },
      { id: "rectangle", type: "rectangle", x: 10, y: 10, width: 30, height: 20, fill: "#ffffff", stroke: "#123456", strokeWidth: 4, outlineVisible: false },
      { id: "text", type: "textbox", x: 50, y: 10, width: 50, height: 40, fill: "#ffffff", stroke: "#654321", strokeWidth: 3, outlineVisible: false, text: "No outline" }
    ]
  });
  const svg = buildAnnotationSvg(state, "data:image/png;base64,AAECAwQ=");

  assert.match(svg, /<rect x="10" y="10" width="30" height="20"[^>]+stroke="none"/);
  assert.match(svg, /<rect x="50" y="10" width="50" height="40"[^>]+stroke="none"/);

  const restored = parseAnnotationSvg(svg);
  assert.deepEqual(
    restored.objects.filter(object => ["rectangle", "textbox"].includes(object.type)).map(object => ({
      outlineVisible: object.outlineVisible,
      stroke: object.stroke
    })),
    [
      { outlineVisible: false, stroke: "#123456" },
      { outlineVisible: false, stroke: "#654321" }
    ]
  );
  assert.equal(normalizeAnnotationState({
    width: 10,
    height: 10,
    objects: [{ id: "legacy", type: "rectangle", x: 0, y: 0, width: 10, height: 10 }]
  }).objects.find(object => object.type === "rectangle").outlineVisible, true);
});

test("vector opacity persists through SVG, templates, and copied native instances without affecting images", () => {
  const state = normalizeAnnotationState({
    width: 160,
    height: 90,
    objects: [
      { id: "image", type: "image", x: 0, y: 0, width: 160, height: 90, opacity: 0.2 },
      { id: "rectangle", type: "rectangle", x: 10, y: 10, width: 40, height: 25, opacity: 0.35 },
      { id: "arrow", type: "arrow", x1: 20, y1: 70, x2: 90, y2: 30, opacity: 0.65 },
      { id: "text", type: "textbox", x: 80, y: 10, width: 70, height: 40, text: "Faded", opacity: 0 }
    ]
  });
  assert.equal(Object.hasOwn(state.objects[0], "opacity"), false);
  assert.deepEqual(state.objects.slice(1).map(object => object.opacity), [0.35, 0.65, 0]);

  const svg = buildAnnotationSvg(state, "data:image/png;base64,AAECAwQ=");
  assert.doesNotMatch(svg, /<image\b[^>]*\bopacity=/);
  assert.match(svg, /<rect\b[^>]*\bx="10"[^>]*\bopacity="0\.35"/);
  assert.match(svg, /<g\b[^>]*\bopacity="0\.65"[^>]*>[^]*image-annotation-arrow-shaft/);
  assert.match(svg, /<g\b[^>]*\bopacity="0"[^>]*>[^]*<text\b/);
  const restored = parseAnnotationSvg(svg);
  assert.deepEqual(restored.objects.slice(1).map(object => object.opacity), [0.35, 0.65, 0]);

  const vectorIds = new Set(["rectangle", "arrow", "text"]);
  const template = captureAnnotationTemplate(state, vectorIds, "data:image/png;base64,AAECAwQ=", "Opacity");
  assert.deepEqual(template.objects.map(object => object.opacity), [0.35, 0.65, 0]);
  let sequence = 0;
  const instances = instantiateAnnotationTemplate(
    template,
    { x: 200, y: 100 },
    type => `${type}-opacity-${++sequence}`,
    "opacity-group"
  );
  assert.deepEqual(instances.map(object => object.opacity), [0.35, 0.65, 0]);

  const copiedSvg = buildAnnotationSelectionSvg(state, vectorIds, "data:image/png;base64,AAECAwQ=");
  assert.match(copiedSvg, /opacity="0\.35"/);
  assert.match(copiedSvg, /opacity="0\.65"/);
  assert.match(copiedSvg, /opacity="0"/);
  assert.doesNotMatch(copiedSvg, /<image\b/);
});

test("copied annotation SVG contains only the selected artwork at tight painted bounds", () => {
  const state = normalizeAnnotationState({
    width: 120,
    height: 80,
    objects: [
      { id: "image", type: "image", x: 0, y: 0, width: 120, height: 80 },
      { id: "rectangle", type: "rectangle", x: 10, y: 10, width: 30, height: 20, fill: "#ffffff", stroke: "#123456", strokeWidth: 4 }
    ]
  });
  const svg = buildAnnotationSelectionSvg(state, new Set(["rectangle"]), "data:image/png;base64,AAECAwQ=");

  assert.match(svg, /^<svg[^>]+width="34" height="24" viewBox="8 8 34 24"/);
  assert.match(svg, /<rect x="10" y="10" width="30" height="20"/);
  assert.doesNotMatch(svg, /<image\b/);
  assert.doesNotMatch(svg, /image-annotation-selection|data-pmt-image-annotation-state/);
});

test("template capture preserves cropped source bytes and native vectors while instances get fresh identity", () => {
  const originalDataUrl = "data:image/png;base64,AAECAwQFBgcICQ==";
  const state = normalizeAnnotationState({
    width: 80,
    height: 50,
    sourceWidth: 120,
    sourceHeight: 80,
    imageClip: { x: 0, y: 0, width: 80, height: 50 },
    objects: [
      {
        id: "source-image",
        type: "image",
        x: -20,
        y: -10,
        width: 120,
        height: 80,
        locked: true,
        groupId: "source-group"
      },
      {
        id: "source-rectangle",
        type: "rectangle",
        x: 10,
        y: 8,
        width: 30,
        height: 20,
        fill: "#ffee00",
        stroke: "#123456",
        strokeWidth: 4,
        groupId: "source-group"
      },
      {
        id: "source-arrow",
        type: "arrow",
        x1: 5,
        y1: 45,
        x2: 65,
        y2: 20,
        stroke: "#654321",
        strokeWidth: 6,
        arrowSize: 18,
        groupId: "source-group"
      }
    ]
  });
  const selectedIds = new Set(state.objects.map(object => object.id));
  const template = captureAnnotationTemplate(state, selectedIds, originalDataUrl, "Mixed cropped source");

  assert.ok(template);
  assert.equal(template.name, "Mixed cropped source");
  assert.deepEqual(template.objects.map(object => object.type), ["embedded-image", "rectangle", "arrow"]);
  assert.ok(template.objects.every(object => object.locked === false));
  assert.ok(template.objects.every(object => object.groupId === ""));
  const embedded = template.objects.find(object => object.type === "embedded-image");
  const rectangle = template.objects.find(object => object.type === "rectangle");
  const arrow = template.objects.find(object => object.type === "arrow");
  assert.match(embedded.source, /^data:image\/svg\+xml;charset=utf-8,/);
  const wrapperSvg = decodeURIComponent(embedded.source.slice(embedded.source.indexOf(",") + 1));
  assert.match(wrapperSvg, /^<svg[^>]+width="80" height="50" viewBox="0 0 80 50"/);
  assert.match(wrapperSvg, /<image\b/);
  assert.ok(wrapperSvg.includes(`href="${originalDataUrl}"`));
  assert.equal((wrapperSvg.match(/<image\b/g) || []).length, 1);
  const wrappedSource = wrapperSvg.match(/<image\b[^>]*\bhref="([^"]+)"/)?.[1];
  assert.ok(wrappedSource);
  assert.deepEqual(
    Buffer.from(wrappedSource.slice(wrappedSource.indexOf(",") + 1), "base64"),
    Buffer.from(originalDataUrl.slice(originalDataUrl.indexOf(",") + 1), "base64")
  );
  assert.deepEqual(
    {
      type: rectangle.type,
      fill: rectangle.fill,
      stroke: rectangle.stroke,
      strokeWidth: rectangle.strokeWidth
    },
    { type: "rectangle", fill: "#ffee00", stroke: "#123456", strokeWidth: 4 }
  );
  assert.deepEqual(
    {
      type: arrow.type,
      stroke: arrow.stroke,
      strokeWidth: arrow.strokeWidth,
      arrowSize: arrow.arrowSize
    },
    { type: "arrow", stroke: "#654321", strokeWidth: 6, arrowSize: 18 }
  );

  let sequence = 0;
  const idFactory = type => `${type}-instance-${++sequence}`;
  const firstInstance = instantiateAnnotationTemplate(template, { x: 200, y: 120 }, idFactory, "instance-group-1");
  const secondInstance = instantiateAnnotationTemplate(template, { x: 400, y: 240 }, idFactory, "instance-group-2");
  const templateIds = new Set(template.objects.map(object => object.id));
  const firstIds = new Set(firstInstance.map(object => object.id));
  const secondIds = new Set(secondInstance.map(object => object.id));
  assert.equal(firstInstance.length, 3);
  assert.ok(firstInstance.every(object => !templateIds.has(object.id)));
  assert.ok(secondInstance.every(object => !templateIds.has(object.id) && !firstIds.has(object.id)));
  assert.deepEqual([...new Set(firstInstance.map(object => object.groupId))], ["instance-group-1"]);
  assert.deepEqual([...new Set(secondInstance.map(object => object.groupId))], ["instance-group-2"]);
  assert.ok(firstInstance.every(object => object.locked === false));
  assert.equal(firstInstance.find(object => object.type === "embedded-image").source, embedded.source);
  assert.equal(firstIds.size, firstInstance.length);
  assert.equal(secondIds.size, secondInstance.length);
  const firstBounds = annotationSelectionBounds(firstInstance);
  assert.ok(Math.abs(firstBounds.x + (firstBounds.width / 2) - 200) < 0.000001);
  assert.ok(Math.abs(firstBounds.y + (firstBounds.height / 2) - 120) < 0.000001);

  const persistedState = normalizeAnnotationState({
    width: 500,
    height: 300,
    objects: [
      { id: "document-image", type: "image", x: 0, y: 0, width: 500, height: 300 },
      ...firstInstance
    ]
  });
  const persistedSvg = buildAnnotationSvg(persistedState, "data:image/png;base64,AQID");
  assert.match(persistedSvg, /<image\b[^>]+data:image\/svg\+xml;charset=utf-8,/);
  assert.match(persistedSvg, /<rect\b/);
  assert.match(persistedSvg, /<line\b/);
  assert.match(persistedSvg, /<polygon\b/);
  const restoredEmbedded = parseAnnotationSvg(persistedSvg).objects
    .find(object => object.type === "embedded-image");
  assert.ok(restoredEmbedded);
  assert.equal(restoredEmbedded.source, embedded.source);
});

test("template library normalizes drawing defaults and preserves explicit reset data", () => {
  const library = normalizeAnnotationTemplateLibrary({
    version: 99,
    templates: [
      {
        id: "valid-template",
        name: "  Rectangle preset  ",
        width: 40,
        height: 20,
        createdAt: "2026-07-18T00:00:00.000Z",
        updatedAt: "2026-07-18T00:00:00.000Z",
        objects: [
          {
            id: "template-rectangle",
            type: "rectangle",
            x: 0,
            y: 0,
            width: 40,
            height: 20,
            fill: "#abcdef",
            stroke: "#123456",
            strokeWidth: 7,
            locked: true,
            groupId: "old-group"
          }
        ]
      },
      { id: "invalid-template", name: "No artwork", objects: [] }
    ],
    defaults: {
      arrow: { stroke: "#ABCDEF", strokeWidth: 999, arrowSize: 1 },
      rectangle: { fill: "#FEDCBA", stroke: "invalid", outlineVisible: false, strokeWidth: 999 }
    }
  });

  assert.equal(library.version, 1);
  assert.equal(library.templates.length, 1);
  assert.equal(library.templates[0].name, "Rectangle preset");
  assert.equal(library.templates[0].objects[0].locked, false);
  assert.equal(library.templates[0].objects[0].groupId, "");
  assert.deepEqual(library.defaults, {
    arrow: { stroke: "#abcdef", strokeWidth: 40, arrowSize: 6, opacity: 1 },
    rectangle: { fill: "#fedcba", stroke: "#3f7f0d", outlineVisible: false, strokeWidth: 40, opacity: 1 }
  });

  const reset = normalizeAnnotationTemplateLibrary({
    ...library,
    defaults: { arrow: null, rectangle: null }
  });
  assert.equal(reset.templates.length, 1);
  assert.deepEqual(reset.defaults, { arrow: null, rectangle: null });
  assert.deepEqual(normalizeAnnotationTemplateLibrary(null), {
    version: 1,
    templates: [],
    defaults: { arrow: null, rectangle: null }
  });
});

test("restoring defaults prepends only missing template designs and preserves personal data", () => {
  const template = (id, name, stroke = "#4ea72e", updatedAt = "2026-07-18T00:00:00.000Z") => ({
    id,
    name,
    width: 40,
    height: 20,
    createdAt: updatedAt,
    updatedAt,
    objects: [
      { id: `${id}-object`, type: "rectangle", x: 0, y: 0, width: 40, height: 20, fill: "none", stroke }
    ]
  });
  const personalDuplicate = template("personal-green", "Green Box", "#4ea72e", "2026-07-19T00:00:00.000Z");
  const personal = template("personal-note", "Personal Note", "#126bff");
  const library = {
    version: 1,
    templates: [personalDuplicate, personal],
    defaults: { arrow: { stroke: "#126bff", strokeWidth: 8, arrowSize: 24, opacity: 0.8 }, rectangle: null }
  };
  const defaults = {
    version: 1,
    templates: [
      template("default-green", "Green Box"),
      template("default-red", "Red Box", "#ff0000")
    ],
    defaults: { arrow: null, rectangle: null }
  };

  const restored = restoreAnnotationDefaultTemplates(library, defaults);
  assert.equal(restored.addedCount, 1);
  assert.equal(restored.capacityExceeded, false);
  assert.deepEqual(restored.library.templates.map(item => item.id), [
    "default-red",
    "personal-green",
    "personal-note"
  ]);
  assert.deepEqual(restored.library.defaults, normalizeAnnotationTemplateLibrary(library).defaults);
});

test("restoring a customized default keeps both versions with unique IDs and is idempotent", () => {
  const base = {
    id: "default-arrow",
    name: "Green Arrow",
    width: 100,
    height: 60,
    createdAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z",
    objects: [
      { id: "arrow", type: "arrow", x1: 0, y1: 0, x2: 100, y2: 60, stroke: "#4ea72e", strokeWidth: 12, arrowSize: 48 }
    ]
  };
  const customized = structuredClone(base);
  customized.objects[0].stroke = "#126bff";

  const first = restoreAnnotationDefaultTemplates(
    { version: 1, templates: [customized], defaults: { arrow: null, rectangle: null } },
    { version: 1, templates: [base], defaults: { arrow: null, rectangle: null } }
  );
  assert.equal(first.addedCount, 1);
  assert.deepEqual(first.library.templates.map(item => item.id), ["default-arrow-default", "default-arrow"]);
  assert.equal(first.library.templates[1].objects[0].stroke, "#126bff");

  const second = restoreAnnotationDefaultTemplates(
    first.library,
    { version: 1, templates: [base], defaults: { arrow: null, rectangle: null } }
  );
  assert.equal(second.addedCount, 0);
  assert.deepEqual(second.library, first.library);
});

test("restoring defaults ignores duplicate designs inside the shared catalog", () => {
  const first = {
    id: "default-green",
    name: "Green Box",
    width: 40,
    height: 20,
    createdAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z",
    objects: [
      { id: "green-object", type: "rectangle", x: 0, y: 0, width: 40, height: 20, fill: "none", stroke: "#4ea72e" }
    ]
  };
  const duplicate = structuredClone(first);
  duplicate.id = "default-green-copy";
  duplicate.createdAt = "2026-07-19T00:00:00.000Z";
  duplicate.updatedAt = "2026-07-19T00:00:00.000Z";
  duplicate.objects[0].id = "green-object-copy";

  const restored = restoreAnnotationDefaultTemplates(
    { version: 1, templates: [], defaults: { arrow: null, rectangle: null } },
    { version: 1, templates: [first, duplicate], defaults: { arrow: null, rectangle: null } }
  );

  assert.equal(restored.addedCount, 1);
  assert.deepEqual(restored.library.templates.map(template => template.id), ["default-green"]);
});

test("restoring defaults refuses atomically when personal templates need more than 50 slots", () => {
  const rectangle = (id, name, stroke) => ({
    id,
    name,
    width: 20,
    height: 20,
    objects: [{ id: `${id}-object`, type: "rectangle", x: 0, y: 0, width: 20, height: 20, fill: "none", stroke }]
  });
  const personalTemplates = Array.from({ length: 49 }, (_, index) => rectangle(
    `personal-${index}`,
    `Personal ${index}`,
    `#${index.toString(16).padStart(6, "0")}`
  ));
  const library = normalizeAnnotationTemplateLibrary({
    version: 1,
    templates: personalTemplates,
    defaults: { arrow: null, rectangle: null }
  });
  const restored = restoreAnnotationDefaultTemplates(library, {
    version: 1,
    templates: [rectangle("default-a", "Default A", "#ff0000"), rectangle("default-b", "Default B", "#00ff00")],
    defaults: { arrow: null, rectangle: null }
  });

  assert.equal(restored.capacityExceeded, true);
  assert.equal(restored.requiredSlots, 1);
  assert.equal(restored.addedCount, 0);
  assert.deepEqual(restored.library, library);
});

test("template formatting applies exact structures one-to-one without changing content or geometry", () => {
  const template = {
    id: "format-template",
    name: "Formatted callout",
    width: 320,
    height: 180,
    objects: [
      {
        id: "template-rectangle",
        type: "rectangle",
        x: 0,
        y: 0,
        width: 120,
        height: 70,
        fill: "#112233",
        stroke: "#445566",
        outlineVisible: false,
        strokeWidth: 7,
        opacity: 0.4
      },
      {
        id: "template-arrow",
        type: "arrow",
        x1: 10,
        y1: 90,
        x2: 250,
        y2: 90,
        stroke: "#778899",
        strokeWidth: 9,
        arrowSize: 36,
        opacity: 0.55
      },
      {
        id: "template-text",
        type: "textbox",
        x: 20,
        y: 110,
        width: 220,
        height: 60,
        text: "Template text must not replace destination text",
        fill: "#aabbcc",
        stroke: "#ddeeff",
        outlineVisible: true,
        strokeWidth: 5,
        opacity: 0.65,
        textColor: "#102030",
        fontFamily: "Georgia",
        fontSize: 42,
        textAlign: "center",
        textVerticalAlign: "bottom"
      }
    ]
  };
  const destination = [
    {
      id: "destination-rectangle",
      type: "rectangle",
      name: "Destination rectangle",
      groupId: "destination-group",
      locked: false,
      x: 410,
      y: 220,
      width: 75,
      height: 45,
      fill: "none",
      stroke: "#000000",
      outlineVisible: true,
      strokeWidth: 2,
      opacity: 1
    },
    {
      id: "destination-arrow",
      type: "arrow",
      name: "Destination arrow",
      groupId: "destination-group",
      locked: false,
      x1: 500,
      y1: 310,
      x2: 710,
      y2: 365,
      stroke: "#000000",
      strokeWidth: 2,
      arrowSize: 10,
      opacity: 1
    },
    {
      id: "destination-text",
      type: "textbox",
      name: "Destination text",
      groupId: "destination-group",
      locked: false,
      x: 530,
      y: 390,
      width: 260,
      height: 90,
      text: "Keep this destination text",
      fill: "none",
      stroke: "#000000",
      outlineVisible: false,
      strokeWidth: 2,
      opacity: 1,
      textColor: "#ffffff",
      fontFamily: "Arial",
      fontSize: 18,
      textAlign: "left",
      textVerticalAlign: "top"
    }
  ];
  const templateBefore = structuredClone(template);
  const destinationIdentityAndGeometry = destination.map(object => object.type === "arrow"
    ? {
        id: object.id,
        name: object.name,
        groupId: object.groupId,
        locked: object.locked,
        x1: object.x1,
        y1: object.y1,
        x2: object.x2,
        y2: object.y2
      }
    : {
        id: object.id,
        name: object.name,
        groupId: object.groupId,
        locked: object.locked,
        x: object.x,
        y: object.y,
        width: object.width,
        height: object.height,
        ...(object.type === "textbox" ? { text: object.text } : {})
      });

  const result = applyAnnotationTemplateFormatting(template, destination);

  assert.deepEqual(result, {
    structureMatches: true,
    selectedCount: 3,
    matchedCount: 3,
    appliedCount: 3,
    changedCount: 3,
    lockedCount: 0,
    geometryConstrainedCount: 0
  });
  assert.deepEqual(destination.map(object => object.type === "arrow"
    ? {
        id: object.id,
        name: object.name,
        groupId: object.groupId,
        locked: object.locked,
        x1: object.x1,
        y1: object.y1,
        x2: object.x2,
        y2: object.y2
      }
    : {
        id: object.id,
        name: object.name,
        groupId: object.groupId,
        locked: object.locked,
        x: object.x,
        y: object.y,
        width: object.width,
        height: object.height,
        ...(object.type === "textbox" ? { text: object.text } : {})
      }), destinationIdentityAndGeometry);
  assert.deepEqual(destination[0], {
    ...destination[0],
    fill: "#112233",
    stroke: "#445566",
    outlineVisible: false,
    strokeWidth: 7,
    opacity: 0.4
  });
  assert.deepEqual(
    (({ stroke, strokeWidth, arrowSize, opacity }) => ({ stroke, strokeWidth, arrowSize, opacity }))(destination[1]),
    { stroke: "#778899", strokeWidth: 9, arrowSize: 36, opacity: 0.55 }
  );
  assert.deepEqual(
    (({
      fill,
      stroke,
      outlineVisible,
      strokeWidth,
      opacity,
      textColor,
      fontFamily,
      fontSize,
      textAlign,
      textVerticalAlign
    }) => ({
      fill,
      stroke,
      outlineVisible,
      strokeWidth,
      opacity,
      textColor,
      fontFamily,
      fontSize,
      textAlign,
      textVerticalAlign
    }))(destination[2]),
    {
      fill: "#aabbcc",
      stroke: "#ddeeff",
      outlineVisible: true,
      strokeWidth: 5,
      opacity: 0.65,
      textColor: "#102030",
      fontFamily: "Georgia",
      fontSize: 42,
      textAlign: "center",
      textVerticalAlign: "bottom"
    }
  );
  assert.deepEqual(template, templateBefore);
});

test("mismatched template formatting pairs by type, reuses the last available style, and skips locks", () => {
  const template = {
    id: "mixed-format-template",
    name: "Mixed formatting",
    width: 300,
    height: 180,
    objects: [
      { id: "source-arrow-1", type: "arrow", x1: 0, y1: 0, x2: 160, y2: 0, stroke: "#ff0000", strokeWidth: 4, arrowSize: 20, opacity: 0.7 },
      { id: "source-arrow-2", type: "arrow", x1: 0, y1: 30, x2: 160, y2: 30, stroke: "#0000ff", strokeWidth: 8, arrowSize: 30, opacity: 0.8 },
      { id: "source-rectangle-1", type: "rectangle", x: 0, y: 60, width: 80, height: 40, fill: "#00ff00", stroke: "#006600", strokeWidth: 6, opacity: 0.5 },
      { id: "source-rectangle-extra", type: "rectangle", x: 90, y: 60, width: 80, height: 40, fill: "#ffff00", stroke: "#666600", strokeWidth: 3, opacity: 0.6 },
      { id: "source-text", type: "textbox", x: 0, y: 110, width: 140, height: 50, text: "Source", fill: "none", stroke: "#333333", textColor: "#abcdef", fontFamily: "Verdana", fontSize: 30 }
    ]
  };
  const arrow = (id, y, locked = false) => ({
    id,
    type: "arrow",
    x1: 200,
    y1: y,
    x2: 400,
    y2: y,
    stroke: "#111111",
    strokeWidth: 2,
    arrowSize: 12,
    opacity: 1,
    locked
  });
  const destination = [
    { id: "destination-rectangle", type: "rectangle", x: 10, y: 10, width: 45, height: 25, fill: "none", stroke: "#111111", strokeWidth: 1, opacity: 1 },
    arrow("destination-arrow-1", 40),
    { id: "destination-text", type: "textbox", x: 10, y: 70, width: 120, height: 40, text: "Keep me", fill: "#ffffff", stroke: "#111111", textColor: "#111111", fontFamily: "Arial", fontSize: 18, locked: true },
    arrow("destination-arrow-2", 110),
    arrow("destination-arrow-3", 150)
  ];
  const lockedBefore = structuredClone(destination[2]);

  const result = applyAnnotationTemplateFormatting(template, destination);

  assert.equal(result.structureMatches, false);
  assert.equal(result.selectedCount, 5);
  assert.equal(result.matchedCount, 5);
  assert.equal(result.appliedCount, 4);
  assert.equal(result.changedCount, 4);
  assert.equal(result.lockedCount, 1);
  assert.equal(destination.length, 5);
  assert.deepEqual(
    (({ fill, stroke, strokeWidth, opacity }) => ({ fill, stroke, strokeWidth, opacity }))(destination[0]),
    { fill: "#00ff00", stroke: "#006600", strokeWidth: 6, opacity: 0.5 }
  );
  assert.equal(destination[1].stroke, "#ff0000");
  assert.equal(destination[3].stroke, "#0000ff");
  assert.equal(destination[4].stroke, "#0000ff");
  assert.deepEqual(destination[2], lockedBefore);

  const image = { id: "destination-image", type: "image", x: 0, y: 0, width: 100, height: 60, locked: false, groupId: "" };
  const imageBefore = structuredClone(image);
  const noMatch = applyAnnotationTemplateFormatting(template, [image]);
  assert.equal(noMatch.structureMatches, false);
  assert.equal(noMatch.appliedCount, 0);
  assert.equal(noMatch.changedCount, 0);
  assert.deepEqual(image, imageBefore);
});

test("template arrow formatting is limited when needed so normalization never moves destination endpoints", () => {
  const destination = {
    id: "short-destination-arrow",
    type: "arrow",
    x1: 10,
    y1: 15,
    x2: 30,
    y2: 15,
    stroke: "#111111",
    strokeWidth: 1,
    arrowSize: 4,
    opacity: 1,
    locked: false,
    groupId: ""
  };
  const endpoints = { x1: destination.x1, y1: destination.y1, x2: destination.x2, y2: destination.y2 };
  const result = applyAnnotationTemplateFormatting({
    id: "oversized-arrow-style",
    name: "Oversized arrow style",
    width: 300,
    height: 80,
    objects: [
      { id: "large-source-arrow", type: "arrow", x1: 0, y1: 40, x2: 300, y2: 40, stroke: "#ff0000", strokeWidth: 40, arrowSize: 160, opacity: 0.4 }
    ]
  }, [destination]);

  assert.equal(result.structureMatches, true);
  assert.equal(result.geometryConstrainedCount, 1);
  assert.deepEqual(
    { x1: destination.x1, y1: destination.y1, x2: destination.x2, y2: destination.y2 },
    endpoints
  );
  const normalized = normalizeAnnotationState({
    width: 100,
    height: 80,
    objects: [
      { id: "image", type: "image", x: 0, y: 0, width: 100, height: 80 },
      structuredClone(destination)
    ]
  });
  const normalizedArrow = normalized.objects.find(object => object.id === destination.id);
  assert.deepEqual(
    { x1: normalizedArrow.x1, y1: normalizedArrow.y1, x2: normalizedArrow.x2, y2: normalizedArrow.y2 },
    endpoints
  );
});

test("grouped embedded image and arrow template instances resize proportionally", () => {
  const embeddedSource = "data:image/png;base64,AAECAwQ=";
  let sequence = 0;
  const instance = instantiateAnnotationTemplate({
    id: "image-arrow-template",
    name: "Image and arrow",
    width: 100,
    height: 60,
    objects: [
      {
        id: "template-image",
        type: "embedded-image",
        x: 0,
        y: 0,
        width: 100,
        height: 60,
        source: embeddedSource
      },
      {
        id: "template-arrow",
        type: "arrow",
        x1: 10,
        y1: 50,
        x2: 90,
        y2: 10,
        stroke: "#123456",
        strokeWidth: 5,
        arrowSize: 20
      }
    ]
  }, { x: 50, y: 30 }, type => `${type}-resized-${++sequence}`, "resized-group");
  const originals = structuredClone(instance);
  const startBounds = annotationSelectionBounds(originals);
  const state = {
    snapToGrid: false,
    gridSize: 20,
    objects: structuredClone(instance)
  };
  resizeAnnotationObjects(state, {
    startBounds,
    direction: "se",
    originals,
    startImageClip: null
  }, {
    x: startBounds.x + (startBounds.width * 2),
    y: startBounds.y + (startBounds.height * 2)
  });

  const resizedBounds = annotationSelectionBounds(state.objects);
  const originalImage = originals.find(object => object.type === "embedded-image");
  const resizedImage = state.objects.find(object => object.type === "embedded-image");
  const originalArrow = originals.find(object => object.type === "arrow");
  const resizedArrow = state.objects.find(object => object.type === "arrow");
  assert.ok(Math.abs(resizedBounds.width - (startBounds.width * 2)) < 0.000001);
  assert.ok(Math.abs(resizedBounds.height - (startBounds.height * 2)) < 0.000001);
  assert.equal(resizedBounds.width / resizedBounds.height, startBounds.width / startBounds.height);
  assert.equal(resizedImage.width, originalImage.width * 2);
  assert.equal(resizedImage.height, originalImage.height * 2);
  assert.equal(resizedImage.source, embeddedSource);
  assert.equal(
    Math.hypot(resizedArrow.x2 - resizedArrow.x1, resizedArrow.y2 - resizedArrow.y1),
    Math.hypot(originalArrow.x2 - originalArrow.x1, originalArrow.y2 - originalArrow.y1) * 2
  );
  assert.equal(resizedArrow.strokeWidth, originalArrow.strokeWidth * 2);
  assert.equal(resizedArrow.arrowSize, originalArrow.arrowSize * 2);
  assert.deepEqual([...new Set(state.objects.map(object => object.groupId))], ["resized-group"]);
});

test("object tree projects topmost-first groups and preserves custom object and group names", () => {
  const state = normalizeAnnotationState({
    width: 320,
    height: 180,
    groupNames: { "callout-group": "Release callout" },
    objects: [
      {
        id: "source-image",
        type: "image",
        name: "Quarterly dashboard",
        x: 0,
        y: 0,
        width: 320,
        height: 180
      },
      {
        id: "lower-rectangle",
        type: "rectangle",
        name: "Callout box",
        x: 20,
        y: 30,
        width: 100,
        height: 60,
        groupId: "callout-group"
      },
      {
        id: "upper-arrow",
        type: "arrow",
        name: "Revenue arrow",
        x1: 40,
        y1: 140,
        x2: 180,
        y2: 70,
        groupId: "callout-group"
      },
      {
        id: "top-text",
        type: "textbox",
        name: "Executive note",
        x: 160,
        y: 20,
        width: 130,
        height: 70,
        text: "Review"
      }
    ]
  });

  const tree = buildAnnotationObjectTree(state);
  assert.deepEqual(tree.map(node => ({ kind: node.kind, id: node.id, name: node.name })), [
    { kind: "object", id: "top-text", name: "Executive note" },
    { kind: "group", id: "callout-group", name: "Release callout" },
    { kind: "object", id: "source-image", name: "Quarterly dashboard" }
  ]);
  assert.deepEqual(tree[1].children.map(node => ({ id: node.id, name: node.name })), [
    { id: "upper-arrow", name: "Revenue arrow" },
    { id: "lower-rectangle", name: "Callout box" }
  ]);

  const restored = parseAnnotationSvg(buildAnnotationSvg(state, "data:image/png;base64,AAECAwQ="));
  assert.equal(restored.groupNames["callout-group"], "Release callout");
  assert.deepEqual(
    restored.objects.map(object => [object.id, object.name]),
    [
      ["source-image", "Quarterly dashboard"],
      ["lower-rectangle", "Callout box"],
      ["upper-arrow", "Revenue arrow"],
      ["top-text", "Executive note"]
    ]
  );
});

test("copying one child does not preserve a larger parent group identity", () => {
  const state = normalizeAnnotationState({
    width: 160,
    height: 90,
    groupNames: { callout: "Callout Group" },
    objects: [
      { id: "image", type: "image", x: 0, y: 0, width: 160, height: 90 },
      { id: "box", type: "rectangle", x: 10, y: 10, width: 40, height: 30, groupId: "callout" },
      { id: "arrow", type: "arrow", x1: 20, y1: 70, x2: 90, y2: 30, groupId: "callout" }
    ]
  });

  const childTemplate = captureAnnotationTemplate(
    state,
    new Set(["box"]),
    "data:image/png;base64,AAECAwQ=",
    "One child"
  );
  assert.equal(childTemplate.grouped, false);
  assert.equal(childTemplate.groupName, "");
  assert.equal(instantiateAnnotationTemplate(childTemplate, { x: 100, y: 100 })[0].groupId, "");

  const groupTemplate = captureAnnotationTemplate(
    state,
    new Set(["box", "arrow"]),
    "data:image/png;base64,AAECAwQ=",
    "Whole group"
  );
  assert.equal(groupTemplate.grouped, true);
  assert.equal(groupTemplate.groupName, "Callout Group");
});

test("object tree reorder and reparent keep z-order coherent and the original image at the bottom", () => {
  const source = normalizeAnnotationState({
    width: 320,
    height: 180,
    groupNames: { "callout-group": "Callout" },
    objects: [
      { id: "source-image", type: "image", x: 0, y: 0, width: 320, height: 180 },
      { id: "group-rectangle", type: "rectangle", x: 20, y: 30, width: 100, height: 60, groupId: "callout-group" },
      { id: "group-arrow", type: "arrow", x1: 40, y1: 140, x2: 180, y2: 70, groupId: "callout-group" },
      { id: "top-text", type: "textbox", x: 160, y: 20, width: 130, height: 70, text: "Review" }
    ]
  });

  const insideGroup = reorderAnnotationObjectTree(source, {
    draggedKind: "object",
    draggedId: "top-text",
    targetKind: "group",
    targetId: "callout-group"
  });
  assert.equal(insideGroup.objects.find(object => object.id === "top-text").groupId, "callout-group");
  assert.deepEqual(
    buildAnnotationObjectTree(insideGroup)[0].children.map(node => node.id),
    ["top-text", "group-arrow", "group-rectangle"]
  );

  const backToRoot = reorderAnnotationObjectTree(insideGroup, {
    draggedKind: "object",
    draggedId: "group-arrow",
    targetKind: "root",
    targetId: ""
  });
  assert.equal(backToRoot.objects.find(object => object.id === "group-arrow").groupId, "");
  assert.deepEqual(buildAnnotationObjectTree(backToRoot).map(node => node.id), [
    "group-arrow",
    "callout-group",
    "source-image"
  ]);

  const movedGroup = reorderAnnotationObjectTree(backToRoot, {
    draggedKind: "group",
    draggedId: "callout-group",
    targetKind: "object",
    targetId: "group-arrow"
  });
  assert.deepEqual(buildAnnotationObjectTree(movedGroup).map(node => node.id), [
    "callout-group",
    "group-arrow",
    "source-image"
  ]);
  assert.deepEqual(movedGroup.objects.map(object => object.id), [
    "source-image",
    "group-arrow",
    "group-rectangle",
    "top-text"
  ]);

  const attemptedImageRaise = reorderAnnotationObjectTree(movedGroup, {
    draggedKind: "object",
    draggedId: "source-image",
    targetKind: "root",
    targetId: ""
  });
  assert.equal(attemptedImageRaise.objects[0].id, "source-image");
  assert.equal(buildAnnotationObjectTree(attemptedImageRaise).at(-1).id, "source-image");
});

test("object tree drop placement can promote an item above a top group without joining it", () => {
  const source = normalizeAnnotationState({
    width: 320,
    height: 180,
    groupNames: { "top-group": "Top Group" },
    objects: [
      { id: "source-image", type: "image", x: 0, y: 0, width: 320, height: 180 },
      { id: "candidate", type: "textbox", x: 20, y: 20, width: 80, height: 40, text: "Promote" },
      { id: "group-box", type: "rectangle", x: 120, y: 30, width: 80, height: 60, groupId: "top-group" },
      { id: "group-arrow", type: "arrow", x1: 140, y1: 130, x2: 240, y2: 60, groupId: "top-group" }
    ]
  });

  const promoted = reorderAnnotationObjectTree(source, {
    draggedKind: "object",
    draggedId: "candidate",
    targetKind: "group",
    targetId: "top-group",
    targetPlacement: "before"
  });
  const tree = buildAnnotationObjectTree(promoted);
  assert.deepEqual(tree.map(node => node.id), ["candidate", "top-group", "source-image"]);
  assert.equal(promoted.objects.find(object => object.id === "candidate").groupId, "");
  assert.deepEqual(tree[1].children.map(node => node.id), ["group-arrow", "group-box"]);

  const joined = reorderAnnotationObjectTree(source, {
    draggedKind: "object",
    draggedId: "candidate",
    targetKind: "group",
    targetId: "top-group",
    targetPlacement: "after"
  });
  assert.equal(joined.objects.find(object => object.id === "candidate").groupId, "top-group");
  assert.deepEqual(buildAnnotationObjectTree(joined).map(node => node.id), ["top-group", "source-image"]);
});

test("object tree drop placement can promote a group above a top group without merging it", () => {
  const source = normalizeAnnotationState({
    width: 320,
    height: 180,
    groupNames: {
      "candidate-group": "Candidate Group",
      "top-group": "Top Group"
    },
    objects: [
      { id: "source-image", type: "image", x: 0, y: 0, width: 320, height: 180 },
      { id: "candidate-box", type: "rectangle", x: 20, y: 20, width: 80, height: 40, groupId: "candidate-group" },
      { id: "candidate-arrow", type: "arrow", x1: 30, y1: 120, x2: 100, y2: 70, groupId: "candidate-group" },
      { id: "top-box", type: "rectangle", x: 120, y: 30, width: 80, height: 60, groupId: "top-group" },
      { id: "top-arrow", type: "arrow", x1: 140, y1: 130, x2: 240, y2: 60, groupId: "top-group" }
    ]
  });

  assert.deepEqual(buildAnnotationObjectTree(source).map(node => node.id), [
    "top-group",
    "candidate-group",
    "source-image"
  ]);

  const promoted = reorderAnnotationObjectTree(source, {
    draggedKind: "group",
    draggedId: "candidate-group",
    targetKind: "group",
    targetId: "top-group",
    targetPlacement: "before"
  });
  const tree = buildAnnotationObjectTree(promoted);
  assert.deepEqual(tree.map(node => node.id), ["candidate-group", "top-group", "source-image"]);
  assert.deepEqual(tree[0].children.map(node => node.id), ["candidate-arrow", "candidate-box"]);
  assert.deepEqual(tree[1].children.map(node => node.id), ["top-arrow", "top-box"]);
  assert.equal(promoted.objects.find(object => object.id === "candidate-box").groupId, "candidate-group");
  assert.equal(promoted.objects.find(object => object.id === "top-box").groupId, "top-group");
});

test("object tree before and after placements map to the visible root order", () => {
  const source = normalizeAnnotationState({
    width: 200,
    height: 120,
    objects: [
      { id: "image", type: "image", x: 0, y: 0, width: 200, height: 120 },
      { id: "bottom", type: "rectangle", x: 10, y: 10, width: 30, height: 30 },
      { id: "middle", type: "rectangle", x: 50, y: 10, width: 30, height: 30 },
      { id: "top", type: "rectangle", x: 90, y: 10, width: 30, height: 30 }
    ]
  });

  const belowMiddle = reorderAnnotationObjectTree(source, {
    draggedKind: "object",
    draggedId: "top",
    targetKind: "object",
    targetId: "middle",
    targetPlacement: "after"
  });
  assert.deepEqual(buildAnnotationObjectTree(belowMiddle).map(node => node.id), [
    "middle",
    "top",
    "bottom",
    "image"
  ]);
});

test("object tree search is case-insensitive and retains matching group context", () => {
  const tree = buildAnnotationObjectTree(normalizeAnnotationState({
    width: 200,
    height: 120,
    groupNames: { callouts: "Primary Callouts" },
    objects: [
      { id: "image", type: "image", name: "Dashboard Source", x: 0, y: 0, width: 200, height: 120 },
      { id: "box", type: "rectangle", name: "Revenue Box", x: 10, y: 10, width: 60, height: 40, groupId: "callouts" },
      { id: "arrow", type: "arrow", name: "Margin Arrow", x1: 20, y1: 90, x2: 120, y2: 45, groupId: "callouts" },
      { id: "note", type: "textbox", name: "Executive Note", x: 100, y: 10, width: 80, height: 50, text: "Review" }
    ]
  }));

  const childMatch = filterAnnotationObjectTree(tree, "REVENUE");
  assert.deepEqual(childMatch.map(node => node.id), ["callouts"]);
  assert.deepEqual(childMatch[0].children.map(node => node.id), ["box"]);

  const groupMatch = filterAnnotationObjectTree(tree, "primary");
  assert.deepEqual(groupMatch.map(node => node.id), ["callouts"]);
  assert.deepEqual(groupMatch[0].children.map(node => node.id), ["arrow", "box"]);

  assert.deepEqual(filterAnnotationObjectTree(tree, "missing"), []);
  assert.deepEqual(filterAnnotationObjectTree(tree, ""), tree);
  assert.deepEqual(tree.map(node => node.id), ["note", "callouts", "image"]);
});

test("object tree compacts interleaved groups into paint-order blocks with source-image groups at the bottom", () => {
  const objects = [
    { id: "image", type: "image", groupId: "image-group" },
    { id: "background-note", type: "textbox", groupId: "" },
    { id: "first-member", type: "rectangle", groupId: "callout-group" },
    { id: "middle-note", type: "textbox", groupId: "" },
    { id: "image-outline", type: "rectangle", groupId: "image-group" },
    { id: "second-member", type: "arrow", groupId: "callout-group" },
    { id: "top-note", type: "textbox", groupId: "" }
  ];

  compactAnnotationGroupLayers(objects);
  assert.deepEqual(objects.map(object => object.id), [
    "image",
    "image-outline",
    "background-note",
    "middle-note",
    "first-member",
    "second-member",
    "top-note"
  ]);
  assert.equal(objects[0].type, "image");
  assert.deepEqual(objects.slice(0, 2).map(object => object.groupId), ["image-group", "image-group"]);
  assert.deepEqual(objects.slice(4, 6).map(object => object.groupId), ["callout-group", "callout-group"]);
});

test("text vertical alignment persists and places text at the top, middle, or bottom", () => {
  const base = {
    width: 300,
    height: 180,
    objects: [
      { id: "image", type: "image", x: 0, y: 0, width: 300, height: 180 },
      {
        id: "text",
        type: "textbox",
        x: 20,
        y: 20,
        width: 240,
        height: 120,
        text: "One line",
        fontSize: 20,
        textAlign: "left"
      }
    ]
  };
  const textY = alignment => {
    const state = structuredClone(base);
    state.objects[1].textVerticalAlign = alignment;
    const match = buildAnnotationSvg(state, "data:image/png;base64,AAECAwQ=")
      .match(/<text\b[^>]*\by="([^"]+)"/);
    return Number(match?.[1]);
  };

  assert.ok(textY("top") < textY("middle"));
  assert.ok(textY("middle") < textY("bottom"));
  assert.equal(textY("middle"), 86);
  assert.equal(normalizeAnnotationState(base).objects[1].textVerticalAlign, "top");
});

test("persisted groups resolve from the initially selected image", () => {
  const objects = normalizeAnnotationState({
    width: 100,
    height: 50,
    objects: [
      { id: "image", type: "image", x: 0, y: 0, width: 100, height: 50, groupId: "group-1" },
      { id: "rectangle", type: "rectangle", x: 10, y: 10, width: 20, height: 20, groupId: "group-1" },
      { id: "text", type: "textbox", x: 40, y: 10, width: 20, height: 20 }
    ]
  }).objects;

  assert.deepEqual(annotationSelectionIdsForObject(objects, objects[0]), ["image", "rectangle"]);
  assert.deepEqual(annotationSelectionIdsForObject(objects, objects[2]), ["text"]);
});

test("object and group resize stays proportional and Ctrl anchors it at the center", () => {
  const start = { x: 10, y: 20, width: 100, height: 50 };
  const state = { snapToGrid: false, gridSize: 20 };
  const edgeResize = resizedAnnotationBounds(start, "e", { x: 160, y: 45 }, state);
  assert.deepEqual(edgeResize, { x: 10, y: 7.5, width: 150, height: 75 });
  assert.equal(edgeResize.width / edgeResize.height, 2);

  const cornerResize = resizedAnnotationBounds(start, "se", { x: 160, y: 120 }, state);
  assert.deepEqual(cornerResize, { x: 10, y: 20, width: 200, height: 100 });
  assert.equal(cornerResize.width / cornerResize.height, 2);

  const centered = resizedAnnotationBounds(start, "e", { x: 160, y: 45 }, state, true);
  assert.deepEqual(centered, { x: -40, y: -5, width: 200, height: 100 });
  assert.equal(centered.x + (centered.width / 2), start.x + (start.width / 2));
  assert.equal(centered.y + (centered.height / 2), start.y + (start.height / 2));
});

test("Alt freeforms only a standalone rectangle and follows live Alt and Ctrl state", () => {
  const startBounds = { x: 10, y: 20, width: 100, height: 50 };
  const rectangle = {
    id: "rectangle",
    type: "rectangle",
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    groupId: ""
  };
  const state = {
    snapToGrid: true,
    gridSize: 20,
    objects: [structuredClone(rectangle)]
  };
  const gesture = {
    startBounds,
    direction: "se",
    originals: [structuredClone(rectangle)],
    startImageClip: null
  };

  resizeAnnotationObjects(state, gesture, { x: 153, y: 111 }, false, true);
  assert.deepEqual(
    { x: state.objects[0].x, y: state.objects[0].y, width: state.objects[0].width, height: state.objects[0].height },
    { x: 10, y: 20, width: 150, height: 100 }
  );
  assert.deepEqual(
    { x: state.objects[0].x + state.objects[0].width, y: state.objects[0].y + state.objects[0].height },
    { x: 160, y: 120 }
  );

  resizeAnnotationObjects(state, gesture, { x: 153, y: 111 }, false, false);
  assert.deepEqual(
    { x: state.objects[0].x, y: state.objects[0].y, width: state.objects[0].width, height: state.objects[0].height },
    { x: 10, y: 20, width: 200, height: 100 }
  );

  resizeAnnotationObjects(state, gesture, { x: 153, y: 111 }, true, true);
  assert.deepEqual(
    { x: state.objects[0].x, y: state.objects[0].y, width: state.objects[0].width, height: state.objects[0].height },
    { x: -40, y: -30, width: 200, height: 150 }
  );
  assert.equal(state.objects[0].x + (state.objects[0].width / 2), 60);
  assert.equal(state.objects[0].y + (state.objects[0].height / 2), 45);

  for (const type of ["image", "textbox", "arrow"]) {
    const original = type === "arrow"
      ? { ...rectangle, id: type, type, x1: 10, y1: 20, x2: 110, y2: 70 }
      : { ...rectangle, id: type, type };
    const restrictedState = { snapToGrid: false, gridSize: 20, objects: [structuredClone(original)] };
    resizeAnnotationObjects(restrictedState, { ...gesture, originals: [structuredClone(original)] }, { x: 160, y: 120 }, false, true);
    const resized = annotationSelectionBounds(restrictedState.objects);
    assert.equal(resized.width / resized.height, 2, `${type} must remain proportional`);
  }

  const groupedObjects = [
    { ...rectangle, id: "group-a", width: 40, height: 20, groupId: "group" },
    { ...rectangle, id: "group-b", x: 70, y: 40, width: 40, height: 30, groupId: "group" }
  ];
  const groupedState = { snapToGrid: false, gridSize: 20, objects: structuredClone(groupedObjects) };
  resizeAnnotationObjects(groupedState, {
    ...gesture,
    originals: structuredClone(groupedObjects)
  }, { x: 160, y: 120 }, false, true);
  const groupedBounds = annotationSelectionBounds(groupedState.objects);
  assert.equal(groupedBounds.width / groupedBounds.height, 2);
  assert.deepEqual(groupedBounds, { x: 10, y: 20, width: 200, height: 100 });
});

test("temporary workspace is centered while exported SVG trims to image and annotation paint", () => {
  const state = normalizeAnnotationState({
    width: 100,
    height: 50,
    sourceWidth: 100,
    sourceHeight: 50,
    objects: [
      { id: "image", type: "image", x: 0, y: 0, width: 100, height: 50 },
      { id: "outside", type: "rectangle", x: -20, y: 10, width: 10, height: 10, fill: "none", stroke: "#ff0000", strokeWidth: 4 },
      { id: "arrow", type: "arrow", x1: 100, y1: 25, x2: 140, y2: 25, stroke: "#00b050", strokeWidth: 4, arrowSize: 10 }
    ]
  });
  const before = structuredClone(state);
  const output = annotationOutputBounds(state);
  assert.deepEqual(output, { x: -22, y: 0, width: 162, height: 50 });

  const workspace = annotationWorkspaceBounds(state, 900, 600);
  assert.ok(workspace.width >= 9960);
  assert.ok(workspace.height >= 6960);
  assert.equal(workspace.x + (workspace.width / 2), output.x + (output.width / 2));
  assert.equal(workspace.y + (workspace.height / 2), output.y + (output.height / 2));

  const svg = buildAnnotationSvg(state, "data:image/png;base64,AAECAwQ=");
  assert.match(svg, /width="162" height="50" viewBox="-22 0 162 50"/);
  assert.match(svg, /clipPath id="pmt-annotation-image-clip"/);
  assert.match(svg, /<rect x="0" y="0" width="100" height="50"><\/rect><\/clipPath>/);
  assert.deepEqual(state, before);
});

test("the image clip follows a moved image and the temporary workspace grows around it", () => {
  const state = normalizeAnnotationState({
    width: 100,
    height: 50,
    sourceWidth: 100,
    sourceHeight: 50,
    imageClip: { x: 340, y: 220, width: 100, height: 50 },
    objects: [
      { id: "image", type: "image", x: 340, y: 220, width: 100, height: 50 }
    ]
  });

  assert.deepEqual(state.imageClip, { x: 340, y: 220, width: 100, height: 50 });
  assert.deepEqual(annotationOutputBounds(state), { x: 340, y: 220, width: 100, height: 50 });
  assert.deepEqual(annotationSelectionBounds(state.objects, state.imageClip), state.imageClip);

  const expanded = annotationExpandedWorkspaceBounds(
    { x: 0, y: 0, width: 300, height: 200 },
    state
  );
  assert.ok(expanded.x <= 0);
  assert.ok(expanded.y <= 0);
  assert.ok(expanded.x + expanded.width >= 440);
  assert.ok(expanded.y + expanded.height >= 270);
  assert.ok(expanded.width > 300);
  assert.ok(expanded.height > 200);

  const svg = buildAnnotationSvg(state, "data:image/png;base64,AAECAwQ=");
  assert.match(svg, /viewBox="340 220 100 50"/);
  assert.match(svg, /<rect x="340" y="220" width="100" height="50"><\/rect><\/clipPath>/);
  assert.deepEqual(parseAnnotationSvg(svg).imageClip, state.imageClip);
});

test("legacy cropped state keeps its image crop while retaining vectors beyond that crop", () => {
  const state = normalizeAnnotationState({
    width: 80,
    height: 50,
    sourceWidth: 100,
    sourceHeight: 50,
    cropOffsetX: 20,
    objects: [
      { id: "image", type: "image", x: -20, y: 0, width: 100, height: 50 },
      { id: "outside", type: "rectangle", x: 90, y: 10, width: 10, height: 10, fill: "none", stroke: "#ff0000", strokeWidth: 2 }
    ]
  });

  assert.deepEqual(state.imageClip, { x: 0, y: 0, width: 80, height: 50 });
  assert.deepEqual(annotationOutputBounds(state), { x: 0, y: 0, width: 101, height: 50 });
});

test("marquee intersection includes edge touches, groups, locked objects, arrows, and the image", () => {
  const objects = normalizeAnnotationState({
    width: 100,
    height: 50,
    objects: [
      { id: "image", type: "image", x: 0, y: 0, width: 100, height: 50 },
      { id: "group-a", type: "rectangle", x: 110, y: 10, width: 20, height: 20, stroke: "#000000", strokeWidth: 2, groupId: "group-1" },
      { id: "group-b", type: "textbox", x: 170, y: 10, width: 20, height: 20, stroke: "#000000", strokeWidth: 2, groupId: "group-1" },
      { id: "locked", type: "rectangle", x: 210, y: 10, width: 20, height: 20, stroke: "#000000", strokeWidth: 2, locked: true },
      { id: "arrow", type: "arrow", x1: 250, y1: 20, x2: 300, y2: 20, stroke: "#000000", strokeWidth: 4, arrowSize: 14 }
    ]
  }).objects;
  const frame = { x: 0, y: 0, width: 100, height: 50 };

  assert.deepEqual(
    annotationObjectsIntersectingRect(objects, { x: 131, y: 15, width: 0, height: 1 }, frame).map(object => object.id),
    ["group-a", "group-b"]
  );
  assert.deepEqual(
    annotationObjectsIntersectingRect(objects, { x: 215, y: 15, width: 1, height: 1 }, frame).map(object => object.id),
    ["locked"]
  );
  assert.deepEqual(
    annotationObjectsIntersectingRect(objects, { x: 299, y: 19, width: 2, height: 2 }, frame).map(object => object.id),
    ["arrow"]
  );
  assert.deepEqual(
    annotationObjectsIntersectingRect(objects, { x: 100, y: 20, width: 0, height: 1 }, frame).map(object => object.id),
    ["image"]
  );
  assert.deepEqual(annotationObjectsIntersectingRect(objects, { x: 400, y: 400, width: 10, height: 10 }, frame), []);

  const diagonalArrow = normalizeAnnotationState({
    width: 10,
    height: 10,
    objects: [
      { id: "image", type: "image", x: 0, y: 0, width: 10, height: 10 },
      { id: "diagonal", type: "arrow", x1: 0, y1: 0, x2: 100, y2: 100, stroke: "#000000", strokeWidth: 4, arrowSize: 14 }
    ]
  }).objects.filter(object => object.type === "arrow");
  assert.deepEqual(
    annotationObjectsIntersectingRect(diagonalArrow, { x: 0, y: 90, width: 5, height: 5 }).map(object => object.id),
    []
  );
  assert.deepEqual(
    annotationObjectsIntersectingRect(diagonalArrow, { x: 48, y: 48, width: 4, height: 4 }).map(object => object.id),
    ["diagonal"]
  );

  const thickDiagonalArrow = normalizeAnnotationState({
    width: 10,
    height: 10,
    objects: [
      { id: "image", type: "image", x: 0, y: 0, width: 10, height: 10 },
      { id: "thick-diagonal", type: "arrow", x1: 0, y1: 0, x2: 100, y2: 100, stroke: "#000000", strokeWidth: 40, arrowSize: 6 }
    ]
  }).objects.filter(object => object.type === "arrow");
  assert.deepEqual(annotationObjectsIntersectingRect(thickDiagonalArrow, { x: 0, y: 30, width: 0, height: 0 }), []);
  assert.deepEqual(
    annotationObjectsIntersectingRect(thickDiagonalArrow, { x: 0, y: 28, width: 0, height: 0 }).map(object => object.id),
    ["thick-diagonal"]
  );
});

test("annotation snapping and cursor-centered zoom preserve the pointed document coordinate", () => {
  assert.equal(snapAnnotationValue(49, true, 20), 40);
  assert.equal(snapAnnotationValue(51, true, 20), 60);
  assert.equal(snapAnnotationValue(51, false, 20), 51);
  assert.deepEqual(
    snapAnnotationCropPoint({ x: 10, y: 15 }, { x: 10, y: 15, width: 100, height: 55 }, true, 20),
    { x: 10, y: 15 }
  );
  assert.deepEqual(
    snapAnnotationCropPoint({ x: 110, y: 70 }, { x: 10, y: 15, width: 100, height: 55 }, true, 20),
    { x: 110, y: 70 }
  );
  assert.deepEqual(
    snapAnnotationCropPoint({ x: 31, y: 44 }, { x: 10, y: 15, width: 100, height: 55 }, true, 20),
    { x: 30, y: 35 }
  );

  const result = zoomAnnotationAtPoint({
    oldZoom: 1,
    newZoom: 2,
    scrollLeft: 300,
    scrollTop: 160,
    pointX: 200,
    pointY: 100
  });
  assert.deepEqual(result, { zoom: 2, scrollLeft: 800, scrollTop: 420 });
  assert.equal((300 + 200) / 1, (result.scrollLeft + 200) / result.zoom);
  assert.equal((160 + 100) / 1, (result.scrollTop + 100) / result.zoom);

  const paddedResult = zoomAnnotationAtPoint({
    oldZoom: 1,
    newZoom: 2,
    scrollLeft: 300,
    scrollTop: 160,
    pointX: 200,
    pointY: 100,
    contentOffsetX: 24,
    contentOffsetY: 24
  });
  assert.deepEqual(paddedResult, { zoom: 2, scrollLeft: 776, scrollTop: 396 });
  assert.equal((300 + 200 - 24) / 1, (paddedResult.scrollLeft + 200 - 24) / paddedResult.zoom);
  assert.equal((160 + 100 - 24) / 1, (paddedResult.scrollTop + 100 - 24) / paddedResult.zoom);
});

test("annotation text wraps more as the box narrows or the font grows", () => {
  const text = "The quick brown fox jumps over the lazy dog";
  const wide = wrapAnnotationText(text, 480, 20);
  const narrow = wrapAnnotationText(text, 180, 20);
  const larger = wrapAnnotationText(text, 480, 48);
  assert.ok(narrow.length > wide.length);
  assert.ok(larger.length > wide.length);
  assert.equal(narrow.join(" "), text);
});

test("selection bounds cover grouped geometry and layer commands preserve selected order", () => {
  const objects = [
    { id: "image", type: "image", x: 0, y: 0, width: 800, height: 450 },
    { id: "a", type: "rectangle", x: 10, y: 20, width: 100, height: 80 },
    { id: "b", type: "arrow", x1: 80, y1: 10, x2: 240, y2: 180 },
    { id: "c", type: "textbox", x: 300, y: 40, width: 100, height: 60 }
  ];
  assert.deepEqual(annotationSelectionBounds([objects[1], objects[2]]), {
    x: 10,
    y: 10,
    width: 230,
    height: 170
  });

  moveAnnotationLayers(objects, new Set(["a", "b"]), "front");
  assert.deepEqual(objects.map(object => object.id), ["image", "c", "a", "b"]);
  moveAnnotationLayers(objects, new Set(["a", "b"]), "backward");
  assert.deepEqual(objects.map(object => object.id), ["image", "a", "b", "c"]);
  moveAnnotationLayers(objects, new Set(["image"]), "front");
  assert.deepEqual(objects.map(object => object.id), ["image", "a", "b", "c"]);
});
