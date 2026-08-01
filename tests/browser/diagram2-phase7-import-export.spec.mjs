import { expect, test } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  normalizeAnnotationState,
  parseAnnotationSvg
} from "../../wwwroot/js/components/image-annotation.js";
import { parsePmtDiagramFile } from "../../wwwroot/js/shared/diagram-contracts.js";
import { releaseNotes } from "../../wwwroot/js/shared/release-notes-data.js";

test.use({ timezoneId: "Asia/Taipei" });

test("Diagram 1 Version 1.27 export physically imports, saves, reopens, and re-exports through Diagram 2", async ({ page }, testInfo) => {
  const browserErrors = [];
  let apiState = phase7State();
  const createdPayloads = [];
  const savedPayloads = [];
  const uploads = [];
  const uploadedSvgByPath = new Map();

  page.on("console", message => {
    if (message.type() === "error" && !message.text().includes("status of 401")) {
      browserErrors.push(message.text());
    }
  });
  page.on("pageerror", error => browserErrors.push(error.message));

  await page.addInitScript(seenToken => {
    localStorage.clear();
    localStorage.setItem("pmt-release-notes-last-seen:1", seenToken);
    localStorage.setItem("pmt-release-notes-last-seen:2", seenToken);
    localStorage.setItem("pmt-diagram-view-mode", "tree");
    localStorage.setItem("pmt-diagram-tree-pane-hidden", "false");
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
  await page.route("**/api/image-annotation/**", route => route.fulfill(jsonResponse({
    version: 1,
    templates: [],
    defaults: { arrow: null, rectangle: null, fieldRectangleRelationship: null }
  })));
  await page.route("**/api/uploads/richtext", route => {
    const svg = extractMultipartSvg(route.request().postDataBuffer());
    const path = `/uploads/phase7-${uploads.length + 1}.svg`;
    uploads.push({ path, svg });
    uploadedSvgByPath.set(path, svg);
    return route.fulfill(jsonResponse({ url: path }));
  });
  await page.route("**/uploads/phase7-*.svg*", route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: uploadedSvgByPath.get(path) || "<svg xmlns='http://www.w3.org/2000/svg'></svg>"
    });
  });
  await page.route(/\/api\/blogs$/, route => {
    if (route.request().method() !== "POST") return route.fallback();
    const payload = route.request().postDataJSON();
    createdPayloads.push(payload);
    const created = {
      ...payload,
      id: 700,
      createdByUserId: 1,
      updatedByUserId: 1,
      createdAt: "2026-08-02T08:00:00Z",
      updatedAt: "2026-08-02T08:00:00Z",
      rowVersion: "phase7-row-1"
    };
    apiState = { ...apiState, blogs: [...apiState.blogs, created] };
    return route.fulfill(jsonResponse(created));
  });
  await page.route(/\/api\/blogs\/700$/, route => {
    if (route.request().method() !== "PUT") return route.fallback();
    const payload = route.request().postDataJSON();
    savedPayloads.push(payload);
    const updated = {
      ...apiState.blogs.find(blog => blog.id === 700),
      ...payload,
      updatedByUserId: 1,
      updatedAt: "2026-08-02T08:05:00Z",
      rowVersion: `phase7-row-${savedPayloads.length + 1}`
    };
    apiState = {
      ...apiState,
      blogs: apiState.blogs.map(blog => blog.id === 700 ? updated : blog)
    };
    return route.fulfill(jsonResponse(updated));
  });

  await page.goto("/");
  await page.locator("#loginName").fill("Sin");
  await page.locator("#loginPassword").fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();

  await page.evaluate(() => { window.location.hash = "#/diagram/42"; });
  await expect(page.locator(".diagram-screen")).toBeVisible();
  await expect(page.locator("[data-diagram-page-document-head] h2")).toHaveText("PMT Database Schema");
  await expect(page.locator("svg[data-diagram-image]")).toBeVisible();

  const diagram1Download = await downloadFromPageAction(page, ".diagram-screen", "export-pmt-diagram");
  const diagram1Contents = await readFile(await diagram1Download.path(), "utf8");
  const diagram1File = JSON.parse(diagram1Contents);
  const diagram1Parsed = parsePmtDiagramFile(diagram1Contents);
  expect(diagram1File.generator.feature).toBe("Diagram");
  expect(diagram1Parsed.state.objects).toHaveLength(88);
  expect(diagram1Parsed.state.objects.filter(object => object.type === "entity")).toHaveLength(29);

  const fileExtensions = { futureFileMetadata: { owner: "Phase 7", keep: true } };
  const diagramExtensions = { futureDiagramMetadata: { values: [1, 2, 3], keep: true } };
  diagram1File.extensions = fileExtensions;
  diagram1File.diagram.extensions = diagramExtensions;

  await page.evaluate(() => { window.location.hash = "#/diagram-2/42"; });
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "readonly");
  await importThroughDiagram2Ui(page, diagram1File, "phase7-d1-export.pmt-diagram.json");
  await expect.poll(() => createdPayloads.length).toBe(1);
  await expect(page.locator("#toast")).toHaveText("PMT Diagram imported.");
  await expect(page).toHaveURL(/#\/diagram-2\/700$/);
  await expect(page.locator("[data-diagram2-tree-row][data-id='700']")).toHaveClass(/is-selected/);
  await expect(page.locator("[data-diagram2-page-document-head] h2")).toHaveText("PMT Database Schema 2");

  expect(createdPayloads[0]).toMatchObject({
    id: 0,
    title: "PMT Database Schema 2",
    isPrivate: true,
    isPinned: false
  });
  expect(createdPayloads[0].bodyHtml).toContain('data-pmt-diagram-only="true"');
  expect(uploads).toHaveLength(1);
  const importedState = parseAnnotationSvg(uploads[0].svg);
  expect(importedState.objects).toHaveLength(88);
  expect(importedState.objects.filter(object => object.type === "entity")).toHaveLength(29);
  expect(canonicalState(importedState)).toEqual(canonicalState(diagram1Parsed.state));
  expect(importedState.pmtDiagramFileExtensions).toEqual({
    diagram: diagramExtensions,
    file: fileExtensions
  });

  await page.getByRole("button", { name: "Edit Diagram", exact: true }).click();
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "edit");
  await ensureDiagram2ObjectsPaneOpen(page);
  const projectsRow = page.locator(
    "[data-diagram2-object-tree-row][data-diagram2-object-id='entity-pmt-projects']"
  );
  await projectsRow.dblclick();
  const projectsEntity = page.locator(
    "[data-diagram2-object-plane] [data-diagram2-object-id='entity-pmt-projects']"
  );
  await expect(projectsEntity).toBeVisible();
  await projectsEntity.click({ position: { x: 12, y: 12 } });
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("[data-diagram2-save-state]").first()).toHaveText("Unsaved changes");

  await page.getByRole("button", { name: "Save Diagram", exact: true }).click();
  await expect.poll(() => savedPayloads.length).toBe(1);
  await expect(page.locator("[data-diagram2-save-state]").first()).toHaveText("Saved");
  expect(uploads).toHaveLength(2);
  const savedState = parseAnnotationSvg(uploads[1].svg);
  expect(savedState.objects).toHaveLength(88);
  expect(savedState.objects.filter(object => object.type === "entity")).toHaveLength(29);
  expect(canonicalState(savedState)).toEqual(canonicalState(diagram1Parsed.state));
  expect(savedState.pmtDiagramFileExtensions).toEqual({
    diagram: diagramExtensions,
    file: fileExtensions
  });

  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "readonly");
  await page.locator("[data-diagram2-tree-row][data-id='42']").click();
  await expect(page.locator("[data-diagram2-page-document-head] h2")).toHaveText("PMT Database Schema");
  await page.locator("[data-diagram2-tree-row][data-id='700']").click();
  await expect(page.locator("[data-diagram2-page-document-head] h2")).toHaveText("PMT Database Schema 2");
  await expect(page.locator("[data-diagram2-object-plane] [data-diagram2-object-id='entity-pmt-projects']")).toBeVisible();
  await capturePhase7Screenshot(page, testInfo);

  await page.evaluate(async state => {
    const renderer = window.__pmtDiagram2Renderer;
    renderer.render({
      ...state,
      objects: [...state.objects, {
        id: "phase7-missing-image",
        type: "embedded-image",
        name: "Missing import asset",
        source: "data:image/png;base64,AAAA",
        x: 40,
        y: 40,
        width: 240,
        height: 120
      }]
    }, { reason: "Phase 7 missing asset fallback" });
    await renderer.whenIdle();
  }, savedState);
  await expect(page.locator(".diagram2-renderer-image-fallback-label")).toHaveText("Image unavailable");
  await page.evaluate(async state => {
    const renderer = window.__pmtDiagram2Renderer;
    renderer.render(state, { reason: "Phase 7 restore imported state" });
    renderer.setZoom("1");
    renderer.panBy(-10000, -10000);
    renderer.setSelectedIds(["entity-pmt-projects"]);
    renderer.setFieldMappingLinesVisible(false);
    renderer.setFieldMappingTablesVisible(false);
    await renderer.whenIdle();
  }, savedState);
  const exportViewDiagnostics = await page.evaluate(() => window.__pmtDiagram2Renderer.diagnostics());
  expect(exportViewDiagnostics.mountedObjectCount).toBeLessThan(exportViewDiagnostics.canonicalObjectCount);

  const diagram2Download = await downloadFromPageAction(page, "[data-diagram2-screen]", "export-diagram2-pmt");
  const diagram2Contents = await readFile(await diagram2Download.path(), "utf8");
  const diagram2File = JSON.parse(diagram2Contents);
  const diagram2Parsed = parsePmtDiagramFile(diagram2Contents);
  expect(diagram2File.generator.feature).toBe("Diagram 2");
  expect(diagram2File.extensions).toEqual(fileExtensions);
  expect(diagram2File.diagram.extensions).toEqual(diagramExtensions);
  expect(diagram2Parsed.state.objects).toHaveLength(88);
  expect(diagram2Parsed.state.objects.filter(object => object.type === "entity")).toHaveLength(29);
  expect(canonicalState(diagram2Parsed.state)).toEqual(canonicalState(diagram1Parsed.state));

  await page.evaluate(() => { window.location.hash = "#/diagram/700"; });
  await expect(page.locator(".diagram-screen")).toBeVisible();
  await expect(page.locator("[data-diagram-page-document-head] h2")).toHaveText("PMT Database Schema 2");
  await expect(page.locator("svg[data-diagram-image]")).toBeVisible();
  const diagram1ReopenedMetadata = await page.locator(
    "svg[data-diagram-image] metadata[data-pmt-image-annotation-state='true']"
  ).textContent();
  const diagram1ReopenedState = normalizeAnnotationState(JSON.parse(diagram1ReopenedMetadata));
  expect(diagram1ReopenedState.objects).toHaveLength(88);
  expect(diagram1ReopenedState.objects.filter(object => object.type === "entity")).toHaveLength(29);
  expect(canonicalState(diagram1ReopenedState)).toEqual(canonicalState(diagram1Parsed.state));

  await page.evaluate(() => { window.location.hash = "#/diagram-2/700"; });
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "readonly");
  const duplicateIdsFile = structuredClone(diagram1File);
  duplicateIdsFile.diagram.editorState.objects[1].id = duplicateIdsFile.diagram.editorState.objects[0].id;
  await importThroughDiagram2Ui(page, duplicateIdsFile, "phase7-duplicate-ids.pmt-diagram.json");
  await expect(page.locator("#toast")).toContainText("duplicate object ID");
  expect(createdPayloads).toHaveLength(1);
  expect(uploads).toHaveLength(2);

  const futureFile = structuredClone(diagram1File);
  futureFile.formatVersion = 2;
  futureFile.minimumReaderVersion = 2;
  await importThroughDiagram2Ui(page, futureFile, "phase7-future.pmt-diagram.json");
  await expect(page.locator("#toast")).toHaveText("PMT Diagram file version 2 is not supported.");
  expect(createdPayloads).toHaveLength(1);
  expect(uploads).toHaveLength(2);

  await importThroughDiagram2Ui(page, "", "phase7-empty.pmt-diagram.json");
  await expect(page.locator("#toast")).toHaveText("The selected file is not valid PMT Diagram JSON.");
  await importThroughDiagram2Ui(page, "{not-json", "phase7-invalid.pmt-diagram.json");
  await expect(page.locator("#toast")).toHaveText("The selected file is not valid PMT Diagram JSON.");
  await importThroughDiagram2Ui(page, { format: "not-pmt-diagram" }, "phase7-wrong-root.pmt-diagram.json");
  await expect(page.locator("#toast")).toHaveText("The selected file is not a PMT Diagram file.");
  expect(createdPayloads).toHaveLength(1);
  expect(uploads).toHaveLength(2);
  expect(browserErrors).toEqual([]);
});

async function capturePhase7Screenshot(page, testInfo) {
  const dimensions = testInfo.project.name === "chromium-1920" ? "1920x1080" : "1366x768";
  const directory = path.join(process.cwd(), "docs", "screenshots", "diagram-2-phase-7");
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: path.join(directory, `diagram2-phase7-d1-import-${dimensions}.png`),
    fullPage: false
  });
}

async function importThroughDiagram2Ui(page, contents, name) {
  const chooserPromise = page.waitForEvent("filechooser");
  await clickPageAction(page, "[data-diagram2-screen]", "import-diagram2-pmt");
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name,
    mimeType: "application/json",
    buffer: Buffer.from(typeof contents === "string" ? contents : JSON.stringify(contents), "utf8")
  });
}

async function downloadFromPageAction(page, screenSelector, action) {
  const downloadPromise = page.waitForEvent("download");
  await clickPageAction(page, screenSelector, action);
  return downloadPromise;
}

async function clickPageAction(page, screenSelector, action) {
  const screen = page.locator(screenSelector);
  await screen.locator(".page-actions-summary").click();
  await screen.locator(`.page-actions-list [data-action='${action}']`).click();
}

async function ensureDiagram2ObjectsPaneOpen(page) {
  const main = page.locator("[data-diagram2-editor-main]").first();
  const isOpen = await main.evaluate(element => element.classList.contains("is-objects-open"));
  if (isOpen) return;
  await page.getByRole("button", { name: "Objects", exact: true }).first().click();
  await expect(main).toHaveClass(/is-objects-open/);
}

function canonicalState(input) {
  const { pmtDiagramFileExtensions, ...state } = normalizeAnnotationState(input);
  return state;
}

function phase7State() {
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
    projects: [{ id: 1, code: "PMT", title: "PMT", name: "PMT", isActive: true }],
    sprints: [],
    tasks: [],
    devLogs: [],
    blogs: [{
      id: 42,
      title: "PMT Database Schema",
      bodyHtml: `<p><img data-pmt-diagram="true" data-pmt-private-diagram="true" src="/assets/docs/pmt-database-schema.svg" alt="PMT Database Schema"></p>`,
      isPrivate: false,
      isPinned: false,
      createdByUserId: 1,
      updatedByUserId: 1,
      projectId: 1,
      sprintId: null,
      parentBlogId: null,
      rowVersion: "phase7-oracle-row",
      createdAt: "2026-07-28T08:00:00Z",
      updatedAt: "2026-07-28T08:00:00Z"
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
