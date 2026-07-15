import { expect, test } from "@playwright/test";

test("Release Notes, What's New, and read-only rich text reveal active-user cards for @mentions", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("pmt-view", "Release Notes");
  });
  await installMentionMocks(page);

  await login(page);
  const whatsNew = page.locator("#whatsNewDialog");
  await expect(whatsNew).toBeVisible();

  await whatsNew.locator(".release-note-content").evaluate(content => {
    const fixture = document.createElement("p");
    fixture.dataset.testMentions = "whats-new";
    fixture.textContent = "Ask @Sin and @{Sam Altman}. Ignore qa@Sin.com and @FormerUser.";
    content.appendChild(fixture);
  });

  const whatsNewMentions = whatsNew.locator("[data-test-mentions='whats-new'] .user-mention");
  await expect(whatsNewMentions).toHaveCount(2);
  await expect(whatsNewMentions.nth(0)).toHaveAttribute("tabindex", "0");
  await whatsNewMentions.nth(0).hover();

  const tooltip = whatsNew.locator(".user-mention-tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip.locator(".user-mention-card-name")).toHaveText("Sin Mercado");
  await expect(tooltip.locator(".user-mention-card-nickname")).toHaveText("@Sin");
  await expect(tooltip.locator(".user-mention-card-title")).toHaveText("Dev - Developer (Admin)");
  await expect(tooltip.locator(".user-mention-card-contact")).toContainText(["sin@example.test", "+63 900 111 2222"]);
  await expect(tooltip.locator(".user-mention-card-last-login")).toContainText(/Last login:.*2026/);

  await whatsNewMentions.nth(1).focus();
  await expect(tooltip.locator(".user-mention-card-name")).toHaveText("Sam Altman");
  await expect(tooltip.locator(".user-mention-card-title")).toHaveText("QA - Quality Assurance");

  await whatsNew.getByRole("button", { name: "click here" }).click();
  await expect(whatsNew).toHaveCount(0);
  await expect(page).toHaveURL(/#\/release-notes$/);

  const reader = page.locator(".release-note-reader");
  await reader.evaluate(container => {
    const fixture = document.createElement("div");
    fixture.className = "rich-readonly";
    fixture.dataset.testMentions = "rich-text";
    fixture.innerHTML = '<p>Review with @Sin and @{Sam Altman}. <a href="https://example.test/@Sin">@Sin link</a></p>';
    container.appendChild(fixture);
  });

  const richFixture = reader.locator("[data-test-mentions='rich-text']");
  await expect(richFixture.locator(":scope > p > .user-mention")).toHaveCount(2);
  await expect(richFixture.locator("a .user-mention")).toHaveCount(0);
  await expect(richFixture.locator("a")).toHaveText("@Sin link");

  const cleanHtml = await richFixture.evaluate(async container => {
    const { htmlWithoutUserMentionMarkup } = await import("/js/components/user-mentions.js?v=20260716-user-mentions");
    return htmlWithoutUserMentionMarkup(container);
  });
  expect(cleanHtml).toContain("Review with @Sin and @{Sam Altman}.");
  expect(cleanHtml).toContain("@Sin link</a>");
  expect(cleanHtml).not.toContain("user-mention");
  expect(cleanHtml).not.toContain("data-user-mention-id");

  await page.getByRole("button", { name: "Sin's AI Prompts", exact: true }).click();
  const prompt = page.locator(".release-note-prompt");
  await prompt.evaluate(element => {
    const fixture = document.createElement("span");
    fixture.dataset.testPromptMention = "true";
    fixture.textContent = " Mention @Sin in the original prompt.";
    element.appendChild(fixture);
  });
  await expect(prompt.locator("[data-test-prompt-mention] .user-mention")).toHaveText("@Sin");
});

async function login(page) {
  await page.goto("/");
  await page.locator("#loginName").fill("Sin");
  await page.locator("#loginPassword").fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();
}

async function installMentionMocks(page) {
  let signedIn = false;
  const session = {
    userId: 1,
    originalUserId: 1,
    originalUserName: "Sin",
    isImpersonating: false,
    impersonatedUserName: ""
  };
  const state = {
    users: [
      {
        id: 1,
        nickname: "Sin",
        firstName: "Sin",
        lastName: "Mercado",
        email: "sin@example.test",
        phone: "+63 900 111 2222",
        role: "Developer",
        isAdmin: true,
        isActive: true,
        avatarUrl: "/assets/avatar-default.svg",
        lastLoginAt: "2026-07-16T08:30:00Z"
      },
      {
        id: 2,
        nickname: "Sam Altman",
        firstName: "Sam",
        lastName: "Altman",
        email: "sam@example.test",
        phone: "",
        role: "QA",
        isAdmin: false,
        isActive: true,
        avatarUrl: "/assets/avatar-default.svg",
        lastLoginAt: null
      },
      {
        id: 3,
        nickname: "FormerUser",
        firstName: "Former",
        lastName: "User",
        role: "Developer",
        isAdmin: false,
        isActive: false,
        avatarUrl: "/assets/avatar-default.svg"
      }
    ],
    projects: [],
    sprints: [],
    tasks: [],
    devLogs: [],
    blogs: [],
    auditEvents: [],
    lookups: [],
    roles: [
      { code: "Developer", value: "Dev - Developer" },
      { code: "QA", value: "QA - Quality Assurance" }
    ],
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

function jsonResponse(body, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body)
  };
}
