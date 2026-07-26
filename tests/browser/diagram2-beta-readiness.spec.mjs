import { expect, test } from "@playwright/test";
import { releaseNotes } from "../../wwwroot/js/shared/release-notes-data.js";

test.use({ timezoneId: "Asia/Taipei" });

test("Diagram 2 beta shell preserves navigation, zoom matrix, and open-close cleanup", async ({ page }) => {
  const browserErrors = [];
  page.on("console", message => {
    if (message.type() === "error" && !message.text().includes("status of 401")) browserErrors.push(message.text());
  });
  page.on("pageerror", error => browserErrors.push(error.message));

  await signInWithDiagramState(page);

  const navigationLabels = await page.evaluate(() =>
    [...document.querySelectorAll("#nav button[data-view]")].map(button => ({
      view: button.dataset.view,
      label: button.querySelector("span:last-child")?.textContent?.trim() || ""
    }))
  );
  expect(navigationLabels).toContainEqual({ view: "Diagram", label: "Diagram" });
  expect(navigationLabels).toContainEqual({ view: "Diagram 2", label: "Diagram 2" });
  await openNavigationScreen(page, "Diagram 2");
  await expect(page).toHaveURL(/#\/diagram-2$/);
  await expect(page.locator("[data-diagram2-screen] h1")).toHaveText("Diagram 2");
  await expect(page.locator("[data-diagram2-header]")).toContainText("Diagram 2 Editor");
  await expect(page.locator(".diagram-screen")).toHaveCount(0);
  await expect(page.locator("[data-filter='diagram2-zoom'] option")).toHaveText([
    "Fit",
    "10%",
    "50%",
    "75%",
    "100%",
    "125%",
    "150%",
    "200%"
  ]);

  await page.locator("[data-filter='diagram2-zoom']").selectOption("0.1");
  await expect.poll(() => diagram2ViewportScale(page)).toBe(0.1);

  const descendantCounts = [];
  for (let index = 0; index < 10; index += 1) {
    const openSnapshot = await waitForDiagram2Ready(page);
    descendantCounts.push(openSnapshot.descendantCount);
    expect(openSnapshot.rendererLive).toBe(true);
    expect(openSnapshot.compatibilityFeature).toBe("Diagram 2");

    await openNavigationScreen(page, "Diagram");
    await expect(page).toHaveURL(/#\/diagram$/);
    await expect(page.locator(".diagram-screen")).toBeVisible();
    const closeSnapshot = await page.evaluate(() => ({
      rendererLive: window.__pmtDiagram2Renderer !== null,
      compatibilityLive: window.__pmtDiagram2Compatibility !== null,
      selectionClipboardLive: window.__pmtDiagram2SelectionClipboard !== null,
      diagram2ScreenCount: document.querySelectorAll("[data-diagram2-screen]").length,
      diagram2SvgCount: document.querySelectorAll("[data-diagram2-svg]").length
    }));
    expect(closeSnapshot).toEqual({
      rendererLive: false,
      compatibilityLive: false,
      selectionClipboardLive: false,
      diagram2ScreenCount: 0,
      diagram2SvgCount: 0
    });

    if (index < 9) await openNavigationScreen(page, "Diagram 2");
  }

  expect(Math.min(...descendantCounts)).toBeGreaterThan(0);
  expect(Math.max(...descendantCounts) - Math.min(...descendantCounts)).toBeLessThanOrEqual(5);
  expect(browserErrors).toEqual([]);
});

test("Diagram 2 renderer destroys pending 232-entity stress work without stale live maps", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { createDiagram2Renderer } = await import("/js/features/diagram2/diagram2-renderer.js?v=20260726-diagram2-day16-v1");
    const host = document.createElement("div");
    host.style.position = "absolute";
    host.style.left = "-12000px";
    host.style.top = "0";
    host.style.width = "1200px";
    host.style.height = "800px";
    document.body.appendChild(host);

    const renderer = createDiagram2Renderer({ host });
    const state = buildStressState();
    const initial = renderer.render(state, { reason: "beta readiness stress initial" });
    renderer.setZoom("0.1");
    renderer.panBy(-240, -120);
    renderer.setSelectedIds(["entity-7", "entity-8"]);
    renderer.beginGeometryPreview({ objectId: "entity-7", mode: "move" });
    renderer.previewGeometry({ deltaX: 36, deltaY: 22 });
    renderer.updateObject("entity-9", object => ({
      x: Number(object.x || 0) + 18,
      y: Number(object.y || 0) + 12
    }));
    const beforeDestroy = {
      diagnostics: renderer.diagnostics(),
      snapshot: renderer.liveViewSnapshot(),
      descendantCount: host.querySelectorAll("*").length
    };
    const idle = renderer.whenIdle();
    renderer.destroy();
    const idleAfterDestroy = await idle;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const afterDestroy = {
      diagnostics: renderer.diagnostics(),
      snapshot: renderer.liveViewSnapshot(),
      descendantCount: host.querySelectorAll("*").length,
      idleAfterDestroy
    };
    host.remove();
    return { initial, beforeDestroy, afterDestroy };

    function buildStressState() {
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

  expect(result.initial.canonicalObjectCount).toBe(232);
  expect(result.initial.canonicalRelationshipCount).toBe(624);
  expect(result.beforeDestroy.descendantCount).toBeGreaterThan(0);
  expect(result.beforeDestroy.snapshot.objectNodeCount).toBeGreaterThan(0);
  expect(result.beforeDestroy.snapshot.relationshipNodeCount).toBeGreaterThan(0);
  expect(result.beforeDestroy.snapshot.pendingDiagramFlush).toBe(true);
  expect(result.afterDestroy.descendantCount).toBe(0);
  expect(result.afterDestroy.snapshot.objectNodeCount).toBe(0);
  expect(result.afterDestroy.snapshot.relationshipNodeCount).toBe(0);
  expect(result.afterDestroy.snapshot.relationshipBoundsIndexCount).toBe(0);
  expect(result.afterDestroy.snapshot.relationshipRouteSectorCount).toBe(0);
  expect(result.afterDestroy.snapshot.viewportHaloObjectSectorCount).toBe(0);
  expect(result.afterDestroy.snapshot.viewportHaloRelationshipSectorCount).toBe(0);
  expect(result.afterDestroy.snapshot.pendingDiagramFlush).toBe(false);
  expect(result.afterDestroy.snapshot.transactionDepth).toBe(0);
  expect(result.afterDestroy.diagnostics.canonicalObjectCount).toBe(0);
  expect(result.afterDestroy.diagnostics.canonicalRelationshipCount).toBe(0);
  expect(result.afterDestroy.idleAfterDestroy.canonicalObjectCount).toBe(0);
});

async function signInWithDiagramState(page) {
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
}

async function openNavigationScreen(page, view) {
  const primaryButton = page.locator(`#nav > button.nav-item[data-view='${view}']`);
  if (await primaryButton.isVisible().catch(() => false)) {
    await primaryButton.click();
    return;
  }

  await page.locator(".nav-overflow-toggle").click();
  await page.locator(`.nav-overflow-menu button[data-view='${view}']`).click();
}

async function waitForDiagram2Ready(page) {
  await expect(page.locator("[data-diagram2-screen]")).toBeVisible();
  await expect(page.locator("[data-diagram2-svg]")).toBeVisible();
  await page.evaluate(() => window.__pmtDiagram2Renderer?.whenIdle?.());
  return page.evaluate(() => ({
    descendantCount: document.querySelector("[data-diagram2-svg]")?.querySelectorAll("*").length || 0,
    rendererLive: Boolean(window.__pmtDiagram2Renderer),
    compatibilityFeature: window.__pmtDiagram2Compatibility?.feature || ""
  }));
}

async function diagram2ViewportScale(page) {
  return page.evaluate(() => Number(document.querySelector("[data-diagram2-svg]")?.dataset.diagram2ViewportScale || 0));
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
    projects: [{ id: 1, code: "PMT", title: "Diagram 2 Beta Test", name: "Diagram 2 Beta Test", isActive: true }],
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
      bodyHtml: `<p><img data-pmt-diagram="true" data-pmt-private-diagram="true" src="/assets/docs/pmt-database-schema.svg?v=20260726-diagram2-day16-fixture" alt="PMT Database Schema"></p>`
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

function jsonResponse(data, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(data)
  };
}
