import { expect, test } from "@playwright/test";
import { releaseNotes } from "../../wwwroot/js/shared/release-notes-data.js";

const latestRelease = releaseNotes[0];
const previousRelease = releaseNotes[1];
const thirdRelease = releaseNotes[2];
const day32Release = releaseNotes.find(note => Number(note.day) === 32);
const promptEngineeringLabel = "Sin's AI Prompt Engineering";

test("first login shows the latest three releases and opens the shared Release Notes screen", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("pmt-view", "Release Notes");
  });
  await installReleaseNotesMocks(page);

  await login(page);
  const dialog = page.locator("#whatsNewDialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("#whatsNewTitle")).toBeVisible();
  await expect(dialog.locator(".release-note-navigation-item")).toHaveCount(3);
  await expect(dialog.locator(".release-note-navigation-item").nth(0)).toContainText(`Day ${latestRelease.day}`);
  await expect(dialog.locator(".release-note-navigation-item").nth(1)).toContainText(`Day ${previousRelease.day}`);
  await expect(dialog.locator(".release-note-navigation-item").nth(2)).toContainText(`Day ${thirdRelease.day}`);
  await expect(dialog.locator(".release-note-content h2")).toHaveText(latestRelease.title);
  await expect(dialog.locator(".release-note-illustration img")).toBeVisible();
  await expect(dialog.locator(".release-note-illustration img")).toHaveAttribute("src", new RegExp(`${latestRelease.id}\\.svg`));

  await dialog.locator(".release-note-navigation-item").nth(2).click();
  await expect(dialog.locator(".release-note-content h2")).toHaveText(thirdRelease.title);
  await expect(dialog.locator(".release-note-illustration img")).toHaveAttribute("src", new RegExp(`${thirdRelease.id}\\.svg`));
  await expect(dialog.locator(".release-note-navigation-item").nth(2)).toBeFocused();
  await expectPageFitsViewport(page);

  await dialog.getByRole("button", { name: "click here" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/#\/release-notes$/);
  await expect(page.locator(".release-notes-screen .section-head h1")).toHaveText("Release Notes");
  await expect(page.locator(".release-notes-index .release-note-navigation-item")).toHaveCount(releaseNotes.length);
  await expect(page.locator(".release-notes-index .release-note-navigation-item").first()).toContainText(`Day ${latestRelease.day}`);
  await page.locator(`.release-notes-index .release-note-navigation-item[data-release-id="${day32Release.id}"]`).click();
  await expect(page.locator(".release-notes-screen .release-note-content h2")).toHaveText(day32Release.title);

  const reader = page.locator(".release-note-reader");
  const readerBefore = await reader.boundingBox();
  await page.getByRole("button", { name: promptEngineeringLabel, exact: true }).click();
  await expect(page.getByRole("button", { name: promptEngineeringLabel, exact: true })).toBeFocused();
  await expect(page.locator(".release-note-prompt")).toContainText(firstPromptLine(day32Release.prompt));
  const day32Stats = promptStats(day32Release);
  const promptStatsBlock = page.locator(".release-note-prompt-stats");
  await expect(promptStatsBlock.locator(".release-note-prompt-stat-source"))
    .toHaveText(`Original prompt: ${day32Release.sourceFile}`);
  await expect(promptStatsBlock.locator(".release-note-prompt-stat-row").nth(0).locator("span")).toHaveText([
    `Line of AI prompts this day: ${formatStat(day32Stats.lines)}`,
    `Number of words: ${formatStat(day32Stats.words)}`
  ]);
  await expect(promptStatsBlock.locator(".release-note-prompt-stat-row").nth(1).locator("span")).toHaveText([
    `Lines of AI prompts for the project: ${formatStat(day32Stats.totalLines)}`,
    `Number of words total: ${formatStat(day32Stats.totalWords)}`
  ]);

  const sectionHead = page.locator(".release-notes-screen .section-head");
  const releaseIndex = page.locator(".release-notes-index");
  const headBeforeScroll = await sectionHead.boundingBox();
  const indexBeforeScroll = await releaseIndex.boundingBox();
  const readerBeforeScroll = await reader.boundingBox();
  expect(Math.abs(indexBeforeScroll.y - readerBeforeScroll.y)).toBeLessThanOrEqual(1);

  await reader.evaluate(element => element.scrollTo({ top: element.scrollHeight }));
  await expect.poll(() => reader.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  const headAfterScroll = await sectionHead.boundingBox();
  const toggleAfterScroll = await page.locator(".release-notes-view-toggle").boundingBox();
  expect(headAfterScroll.y).toBe(headBeforeScroll.y);
  expect(toggleAfterScroll.y).toBeGreaterThanOrEqual(headAfterScroll.y);
  expect(toggleAfterScroll.y + toggleAfterScroll.height).toBeLessThanOrEqual(headAfterScroll.y + headAfterScroll.height + 1);
  await expect.poll(() => page.locator("#app").evaluate(element => element.scrollTop)).toBe(0);

  const readerAfter = await reader.boundingBox();
  expect(readerAfter.x).toBe(readerBefore.x);
  expect(readerAfter.width).toBe(readerBefore.width);
  await expectPageFitsViewport(page);

  await expect.poll(() => page.evaluate(() => localStorage.getItem("pmt-release-notes-last-seen:1")))
    .toBe(latestRelease.seenToken);
});

test("returning login shows only releases newer than the user's saved release", async ({ page }) => {
  await page.addInitScript(lastSeenId => {
    localStorage.clear();
    localStorage.setItem("pmt-view", "Release Notes");
    localStorage.setItem("pmt-release-notes-last-seen:1", lastSeenId);
  }, thirdRelease.seenToken);
  await installReleaseNotesMocks(page);

  await login(page);
  const dialog = page.locator("#whatsNewDialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".release-note-navigation-item")).toHaveCount(2);
  await expect(dialog.locator(".release-note-navigation-item").nth(0)).toContainText(`Day ${latestRelease.day}`);
  await expect(dialog.locator(".release-note-navigation-item").nth(1)).toContainText(`Day ${previousRelease.day}`);
  await expect(dialog).not.toContainText(`Day ${thirdRelease.day}`);
  await dialog.locator(".dialog-actions [data-action='close-whats-new']").click();
  await expect(dialog).toHaveCount(0);
});

test("a restored login session checks for unseen releases", async ({ page }) => {
  await page.addInitScript(lastSeenId => {
    localStorage.clear();
    localStorage.setItem("pmt-view", "Release Notes");
    localStorage.setItem("pmt-release-notes-last-seen:1", lastSeenId);
  }, previousRelease.seenToken);
  await installReleaseNotesMocks(page, { sessionRestored: true });

  await page.goto("/");
  const dialog = page.locator("#whatsNewDialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".release-note-navigation-item")).toHaveCount(0);
  await expect(dialog.locator(".release-note-content h2")).toHaveText(latestRelease.title);
});

test("an updated same-day release is shown after its earlier revision was seen", async ({ page }) => {
  await page.addInitScript(({ releaseId }) => {
    localStorage.clear();
    localStorage.setItem("pmt-view", "Release Notes");
    localStorage.setItem("pmt-release-notes-last-seen:1", `${releaseId}@000000000000`);
  }, { releaseId: latestRelease.id });
  await installReleaseNotesMocks(page, { sessionRestored: true });

  await page.goto("/");
  const dialog = page.locator("#whatsNewDialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".release-note-navigation-item")).toHaveCount(0);
  await expect(dialog.locator(".release-note-content h2")).toHaveText(latestRelease.title);
});

test("an open office session discovers a revised same-day release", async ({ page }) => {
  const revisedVersion = "111111111111";
  const revisedLatest = {
    ...latestRelease,
    version: revisedVersion,
    seenToken: `${latestRelease.id}@${revisedVersion}`,
    title: `${latestRelease.title} (Mid-day revision)`
  };
  await page.addInitScript(lastSeenToken => {
    localStorage.clear();
    localStorage.setItem("pmt-view", "Release Notes");
    localStorage.setItem("pmt-release-notes-last-seen:1", lastSeenToken);
  }, latestRelease.seenToken);
  await page.clock.install();
  await installReleaseNotesMocks(page, { sessionRestored: true });
  let versionChecks = 0;
  await page.route("**/release-notes-version.json", route => {
    versionChecks += 1;
    const seenToken = versionChecks === 1 ? latestRelease.seenToken : revisedLatest.seenToken;
    return route.fulfill(jsonResponse({ seenToken }));
  });
  await page.route("**/release-notes-data.json", route => route.fulfill(jsonResponse([revisedLatest, ...releaseNotes.slice(1)])));

  await page.goto("/");
  await expect(page.locator("#whatsNewDialog")).toHaveCount(0);

  await page.clock.fastForward(60_100);
  const dialog = page.locator("#whatsNewDialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".release-note-content h2")).toHaveText(revisedLatest.title);
  await expect(page.locator(".release-notes-screen .release-note-content h2")).toHaveText(revisedLatest.title);
});

async function login(page) {
  await page.goto("/");
  await page.locator("#loginName").fill("Sin");
  await page.locator("#loginPassword").fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();
}

async function installReleaseNotesMocks(page, { sessionRestored = false } = {}) {
  let signedIn = sessionRestored;
  const session = {
    userId: 1,
    originalUserId: 1,
    originalUserName: "Sin",
    isImpersonating: false,
    impersonatedUserName: ""
  };
  const state = {
    users: [{
      id: 1,
      nickname: "Sin",
      firstName: "Sin",
      lastName: "",
      role: "Administrator",
      isAdmin: true,
      isActive: true,
      avatarUrl: "/assets/avatar-default.svg"
    }],
    projects: [{
      id: 1,
      code: "PMT",
      name: "Project Management Tool",
      title: "Project Management Tool",
      description: "",
      memberIds: [1],
      percentComplete: 0,
      isDeleted: false
    }],
    sprints: [],
    tasks: [],
    devLogs: [],
    blogs: [],
    auditEvents: [],
    lookups: [],
    roles: [],
    holidays: [],
    effectivePermissions: []
  };

  await page.route("**/api/session", async route => {
    await route.fulfill(jsonResponse(signedIn ? session : { error: "Unauthorized" }, signedIn ? 200 : 401));
  });
  await page.route("**/api/login", async route => {
    signedIn = true;
    await route.fulfill(jsonResponse(session));
  });
  await page.route("**/api/state", async route => {
    await route.fulfill(jsonResponse(state));
  });
}

async function expectPageFitsViewport(page) {
  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth - document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth
  }));
  expect(overflow.body).toBeLessThanOrEqual(1);
  expect(overflow.document).toBeLessThanOrEqual(1);
}

function promptStats(note) {
  const day = Number(note?.day || 0);
  const notesThroughDay = releaseNotes
    .filter(item => Number(item.day || 0) <= day)
    .sort((left, right) => Number(left.day || 0) - Number(right.day || 0));
  return {
    lines: promptLineCount(note?.prompt),
    words: promptWordCount(note?.prompt),
    totalLines: notesThroughDay.reduce((total, item) => total + promptLineCount(item.prompt), 0),
    totalWords: notesThroughDay.reduce((total, item) => total + promptWordCount(item.prompt), 0)
  };
}

function promptLineCount(prompt) {
  const text = String(prompt || "");
  return text ? text.replace(/\r\n?/g, "\n").split("\n").length : 0;
}

function firstPromptLine(prompt) {
  return String(prompt || "").replace(/\r\n?/g, "\n").split("\n")[0] || "";
}

function promptWordCount(prompt) {
  return String(prompt || "").trim().split(/\s+/).filter(Boolean).length;
}

function formatStat(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function jsonResponse(body, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body)
  };
}
