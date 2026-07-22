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
    const { htmlWithoutUserMentionMarkup } = await import("/js/components/user-mentions.js?v=20260722-rich-entity-mentions-v1");
    return htmlWithoutUserMentionMarkup(container);
  });
  expect(cleanHtml).toContain("Review with @Sin and @{Sam Altman}.");
  expect(cleanHtml).toContain("@Sin link</a>");
  expect(cleanHtml).not.toContain("user-mention");
  expect(cleanHtml).not.toContain("data-user-mention-id");

  await reader.evaluate(container => {
    const fixture = document.createElement("div");
    fixture.className = "rich-readonly";
    fixture.dataset.testMentions = "entity-rich-text";
    fixture.innerHTML = [
      "<p>Trace @task/101 and @bug/202. Open @doc/21 and @diagram/31.</p>",
      "<p>@livetask/101</p>",
      "<p>@livediagram/31</p>"
    ].join("");
    container.appendChild(fixture);
  });

  const entityFixture = reader.locator("[data-test-mentions='entity-rich-text']");
  await expect(entityFixture.locator(".rich-entity-mention")).toHaveCount(4);
  await expect(entityFixture.locator(".rich-entity-live-card")).toHaveCount(2);
  await expect(entityFixture.locator(".rich-entity-live-card .task-card-code")).toHaveText("PMT-101");
  await expect(entityFixture.locator(".rich-entity-live-card .diagram-card img")).toHaveAttribute("alt", "Architecture Overview preview");

  await entityFixture.locator(".rich-entity-mention", { hasText: "@task/101" }).hover();
  await expect(page.locator(".user-mention-tooltip .task-card-code")).toHaveText("PMT-101");
  await entityFixture.locator(".rich-entity-mention", { hasText: "@doc/21" }).hover();
  await expect(page.locator(".user-mention-tooltip .documentation-card h3")).toHaveText("Release Checklist");

  const entityCleanHtml = await entityFixture.evaluate(async container => {
    const { htmlWithoutUserMentionMarkup } = await import("/js/components/user-mentions.js?v=20260722-rich-entity-mentions-v1");
    return htmlWithoutUserMentionMarkup(container);
  });
  expect(entityCleanHtml).toContain("@task/101");
  expect(entityCleanHtml).toContain("@livetask/101");
  expect(entityCleanHtml).not.toContain("rich-entity-live-card");

  await page.getByRole("button", { name: "Sin's AI Prompt Engineering", exact: true }).click();
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
    projects: [
      { id: 10, code: "PMT", title: "Project Management Tool" }
    ],
    sprints: [],
    tasks: [
      {
        id: 101,
        code: "PMT-101",
        title: "Finish rich entity mentions",
        taskType: "Dev",
        projectId: 10,
        sprintId: null,
        status: "In Progress",
        priority: "High",
        severity: "",
        percentCompleted: 65,
        assigneeIds: [1],
        assignees: [
          {
            id: 1,
            nickname: "Sin",
            firstName: "Sin",
            lastName: "Mercado",
            avatarUrl: "/assets/avatar-default.svg"
          }
        ],
        reporters: [],
        subTasks: [],
        attachments: []
      },
      {
        id: 202,
        code: "BUG-202",
        title: "Linked card hover regression",
        taskType: "Bug",
        projectId: 10,
        sprintId: null,
        status: "QA",
        priority: "Medium",
        severity: "High",
        percentCompleted: 40,
        assigneeIds: [2],
        assignees: [
          {
            id: 2,
            nickname: "Sam Altman",
            firstName: "Sam",
            lastName: "Altman",
            avatarUrl: "/assets/avatar-default.svg"
          }
        ],
        reporters: [],
        subTasks: [],
        attachments: []
      }
    ],
    devLogs: [],
    blogs: [
      {
        id: 21,
        projectId: 10,
        sprintId: null,
        parentBlogId: null,
        title: "Release Checklist",
        bodyHtml: "<p>Verify cards in Scrum and Documentation.</p>",
        isPrivate: false,
        isPinned: false,
        attachments: [],
        history: [],
        createdAt: "2026-07-22T08:00:00Z",
        updatedAt: "2026-07-22T08:00:00Z",
        createdByUserId: 1
      },
      {
        id: 31,
        projectId: 10,
        sprintId: null,
        parentBlogId: null,
        title: "Architecture Overview",
        bodyHtml: `<p><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='240'%20height='120'%20viewBox='0%200%20240%20120'%3E%3Crect%20width='240'%20height='120'%20fill='white'/%3E%3Crect%20x='30'%20y='30'%20width='180'%20height='60'%20fill='%23f8fbff'%20stroke='%235b6b82'/%3E%3C/svg%3E" alt="Architecture Overview" data-pmt-diagram="true"></p>`,
        isPrivate: false,
        isPinned: false,
        attachments: [],
        history: [],
        createdAt: "2026-07-22T08:00:00Z",
        updatedAt: "2026-07-22T09:00:00Z",
        createdByUserId: 1
      }
    ],
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
