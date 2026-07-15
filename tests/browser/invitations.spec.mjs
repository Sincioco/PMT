import { expect, test } from "@playwright/test";

const invitationToken = "ab".repeat(32);
const invitationExpiresAt = "2026-08-12T12:00:00Z";
const invitedUserId = 42;
const invitedUser = user(invitedUserId, "Invited User", false);

const pmtProject = project(10, "PMT", "Project Management Tool", invitedUserId);
const lmsProject = project(20, "LMS", "Learning Management System", invitedUserId);
const invitationMessage = "You've been chosen as one of the few to try this new and exciting Project Management Tool (PMT) in BDO! Participate so your ideas can help shape the tool and the future of BDO in the process!";

test("Invite Users generates copyable URL and Outlook-safe email HTML", async ({ page, context, baseURL }) => {
  const browserErrors = collectBrowserErrors(page);
  const admin = user(1, "Sin", true);
  const projects = [
    project(10, "PMT", "Project Management Tool", admin.id),
    project(20, "LMS", "Learning Management System", admin.id),
    project(30, "HLS", "Healthcare Logistics", admin.id)
  ];
  const appState = createAppState({ users: [admin], projects, sprints: [] });
  let createPayload = null;
  let markCreateStarted;
  let releaseCreateResponse;
  const createStarted = new Promise(resolve => { markCreateStarted = resolve; });
  const createCanFinish = new Promise(resolve => { releaseCreateResponse = resolve; });

  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("pmt-release-notes-last-seen:1", "2026-07-16-day-29");
  });
  await installCommonApiMocks(page, () => appState);
  await page.route("**/api/session", async route => {
    await route.fulfill(jsonResponse(sessionPayload(admin)));
  });
  await page.route("**/api/invitations", async route => {
    createPayload = route.request().postDataJSON();
    markCreateStarted();
    await createCanFinish;
    await route.fulfill(jsonResponse({ token: invitationToken, expiresAt: invitationExpiresAt }));
  });

  const origin = new URL(baseURL || "http://127.0.0.1:5056").origin;
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  await page.locator("#userMenuToggle").click();
  await page.getByRole("menuitem", { name: "Invite Users" }).click();

  const inviteDialog = page.locator("dialog.invite-users-dialog");
  await expect(inviteDialog).toBeVisible();
  await expect(inviteDialog).toHaveAttribute("aria-labelledby", "inviteUsersTitle");
  await expect(inviteDialog.getByRole("heading", { name: "Invite Users" })).toBeVisible();
  await expect(inviteDialog.locator("[name='projectIds']")).toHaveCount(3);
  await expect(inviteDialog.locator(".invite-project-icon")).toHaveCount(3);

  await inviteDialog.getByRole("button", { name: "Generate Invite URL" }).click();
  await expect(page.locator("#toast")).toHaveText("Select at least one project.");
  expect(createPayload).toBeNull();

  await inviteDialog.locator("[name='projectIds'][value='10']").check();
  await inviteDialog.getByRole("button", { name: "Generate Invite URL" }).click();
  await createStarted;
  await expect.poll(() => createPayload).toEqual({ projectIds: [10] });
  await expect(inviteDialog.locator("[name='projectIds'][value='10']")).toBeDisabled();
  await expect(inviteDialog.getByRole("button", { name: "Done" })).toBeDisabled();
  releaseCreateResponse();

  const expectedUrl = new URL(`/?invite=${invitationToken}`, origin).href;
  const inviteUrl = inviteDialog.locator("[data-invite-url]");
  const copyButton = inviteDialog.getByRole("button", { name: "Copy URL" });
  await expect(inviteDialog.locator("[data-invite-url-result]")).toBeVisible();
  await expect(inviteUrl).toHaveValue(expectedUrl);
  await expect(copyButton).toBeEnabled();
  await copyButton.click();
  await expect(page.locator("#toast")).toHaveText("Invite URL copied.");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(expectedUrl);

  const generateEmailButton = inviteDialog.getByRole("button", { name: "Generate Email/HTML Body" });
  await expect(generateEmailButton).toBeEnabled();
  await generateEmailButton.click();
  const emailResult = inviteDialog.locator("[data-invite-email-result]");
  const emailPreview = inviteDialog.locator("[data-invite-email-preview]");
  await expect(emailResult).toBeVisible();
  await expect(emailPreview).toContainText(invitationMessage);
  await expect(emailPreview.locator("table[role='presentation']")).not.toHaveCount(0);
  await expect(emailPreview.locator("img[alt='PMT - Project Management Tool']")).toHaveAttribute("src", /^data:image\/png;base64,/);

  const layoutCellStyle = await page.evaluate(() => {
    const fixture = document.createElement("div");
    fixture.className = "rich-editor";
    fixture.innerHTML = '<table role="presentation"><tbody><tr><td data-layout-cell>Header</td></tr></tbody></table>';
    document.body.appendChild(fixture);
    const cell = fixture.querySelector("[data-layout-cell]");
    const table = fixture.querySelector("table");
    const result = {
      borderTopWidth: getComputedStyle(cell).borderTopWidth,
      paddingTop: getComputedStyle(cell).paddingTop,
      tableLayout: getComputedStyle(table).tableLayout
    };
    fixture.remove();
    return result;
  });
  expect(layoutCellStyle).toEqual({ borderTopWidth: "0px", paddingTop: "0px", tableLayout: "auto" });

  await inviteDialog.getByRole("button", { name: "Copy Email/HTML Body" }).click();
  await expect(page.locator("#toast")).toHaveText("Email / HTML body copied. Paste it into Outlook.");
  const clipboardPayload = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    const html = item.types.includes("text/html")
      ? await (await item.getType("text/html")).text()
      : "";
    const plainText = item.types.includes("text/plain")
      ? await (await item.getType("text/plain")).text()
      : "";
    return { html, plainText };
  });
  expect(clipboardPayload.html).toContain(invitationMessage);
  expect(clipboardPayload.html).toContain("data:image/png;base64,");
  expect(clipboardPayload.html).toContain('role="presentation"');
  expect(clipboardPayload.html).toContain(expectedUrl);
  expect(clipboardPayload.plainText).toContain(invitationMessage);
  expect(clipboardPayload.plainText).toContain(expectedUrl);

  await inviteDialog.getByRole("button", { name: "Done" }).click();
  await expect(inviteDialog).not.toBeVisible();

  expect(browserErrors).toEqual([]);
});

const destinationScenarios = [
  {
    name: "one project with a sprint opens Sprints for that project",
    projects: [pmtProject],
    sprints: [sprint(100, pmtProject.id, "PMT-Sprint01", invitedUserId)],
    result: { nextView: "Sprints", projectId: pmtProject.id },
    heading: "Sprints",
    verifyRequiredAvatar: true,
    verifyBusyState: true
  },
  {
    name: "one project without a sprint opens Projects",
    projects: [pmtProject],
    sprints: [],
    result: { nextView: "Projects", projectId: pmtProject.id },
    heading: "Projects",
    useUploadedAvatar: true
  },
  {
    name: "multiple projects open Projects",
    projects: [pmtProject, lmsProject],
    sprints: [sprint(100, pmtProject.id, "PMT-Sprint01", invitedUserId)],
    result: { nextView: "Projects", projectId: null },
    heading: "Projects"
  }
];

for (const scenario of destinationScenarios) {
  test(`direct invitation profile before login: ${scenario.name}`, async ({ page }) => {
    const browserErrors = collectBrowserErrors(page);
    const appState = createAppState({
      users: [invitedUser],
      projects: scenario.projects,
      sprints: scenario.sprints
    });
    let acceptPayload = null;
    let stateRequestSentLegacyIdentity = false;
    let avatarUploadRequest = null;
    let acceptedSession = false;
    let restoredSessionCookie = "";
    let markAcceptStarted;
    let releaseAcceptResponse;
    const acceptStarted = new Promise(resolve => { markAcceptStarted = resolve; });
    const acceptCanFinish = new Promise(resolve => { releaseAcceptResponse = resolve; });

    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("pmt-release-notes-last-seen:42", "2026-07-16-day-29");
    });
    await installCommonApiMocks(
      page,
      () => appState,
      request => { stateRequestSentLegacyIdentity ||= "x-pmt-userid" in request.headers(); },
      request => { avatarUploadRequest = request; }
    );
    await page.route("**/api/session", async route => {
      restoredSessionCookie = route.request().headers().cookie || "";
      await route.fulfill(acceptedSession
        ? jsonResponse(sessionPayload(invitedUser))
        : jsonResponse({ error: "Unauthorized" }, 401));
    });
    await page.route(`**/api/invitations/${invitationToken}`, async route => {
      await route.fulfill(jsonResponse({
        expiresAt: invitationExpiresAt,
        projects: scenario.projects.map(({ id, code, title, iconUrl }) => ({ id, code, title, iconUrl }))
      }));
    });
    await page.route(`**/api/invitations/${invitationToken}/accept`, async route => {
      acceptPayload = route.request().postDataJSON();
      if (scenario.verifyBusyState) {
        markAcceptStarted();
        await acceptCanFinish;
      }
      acceptedSession = true;
      await route.fulfill(jsonResponse({
        userId: invitedUser.id,
        nickname: invitedUser.nickname,
        isAdmin: false,
        role: "Developer",
        originalUserId: invitedUser.id,
        originalUserName: invitedUser.nickname,
        isImpersonating: false,
        impersonatedUserName: "",
        ...scenario.result
      }, 200, {
        "Set-Cookie": "PMT.Auth=invited-session; Path=/; HttpOnly; SameSite=Strict"
      }));
    });

    await page.goto(`/?invite=${invitationToken}`);

    await expect(page.getByRole("heading", { name: "Welcome to PMT! You've been invited!" })).toBeVisible();
    await expect(page.locator("#loginName")).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("pmt-auth-user"))).toBeNull();

    const profileForm = page.locator("[data-invite-profile-form]");
    await expect(profileForm.locator("input[type='email'], [name='email']")).toHaveCount(0);
    await expect(profileForm.locator(".invite-profile-project")).toHaveCount(scenario.projects.length);
    await profileForm.getByLabel("Username").fill(invitedUser.nickname);
    await profileForm.getByLabel("Password", { exact: true }).fill("Password2");
    await profileForm.getByLabel("Confirm Password").fill("Password2");

    if (scenario.verifyRequiredAvatar) {
      await profileForm.getByRole("button", { name: "Create Profile" }).click();
      await expect(page.locator("#toast")).toHaveText("Select or upload an avatar before creating your profile.");
      expect(acceptPayload).toBeNull();
    }

    const genericAvatar = profileForm.locator("[data-profile-avatar-option='/assets/avatar-generic-1.jpg']");
    await genericAvatar.click();
    await expect(genericAvatar).toHaveAttribute("aria-checked", "true");
    await expect(profileForm.locator("[name='avatarUrl']")).toHaveValue("/assets/avatar-generic-1.jpg");

    let expectedAvatarUrl = "/assets/avatar-generic-1.jpg";
    if (scenario.verifyRequiredAvatar) {
      await genericAvatar.press("ArrowRight");
      const secondAvatar = profileForm.locator("[data-profile-avatar-option='/assets/avatar-generic-2.jpg']");
      await expect(secondAvatar).toBeFocused();
      await expect(secondAvatar).toHaveAttribute("aria-checked", "true");
      expectedAvatarUrl = "/assets/avatar-generic-2.jpg";
    }

    if (scenario.useUploadedAvatar) {
      const avatarFile = profileForm.getByLabel("Upload Avatar");
      await avatarFile.setInputFiles({
        name: "avatar.png",
        mimeType: "image/png",
        buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64")
      });
      await expect(profileForm.locator("[data-profile-avatar-file-preview]")).toBeVisible();
      await expect(profileForm.locator("[data-profile-avatar-file-name]")).toHaveText("avatar.png");
      await expect(profileForm.locator("[data-profile-avatar-file-preview] img")).toHaveAttribute("src", /^blob:/);
      await expect(genericAvatar).toHaveAttribute("aria-checked", "false");
      await expect(profileForm.locator("[name='avatarUrl']")).toHaveValue("");
      expectedAvatarUrl = "/uploads/avatars/avatar.png";
    }

    await profileForm.getByRole("button", { name: "Create Profile" }).click();

    if (scenario.verifyBusyState) {
      await acceptStarted;
      await expect(profileForm.getByRole("button", { name: "Create Profile" })).toBeDisabled();
      await expect(profileForm.getByLabel("Username")).toBeDisabled();
      releaseAcceptResponse();
    }

    await expect(page.getByRole("heading", { name: scenario.heading, exact: true })).toBeVisible();
    await expect.poll(() => acceptPayload).toEqual({
      nickname: invitedUser.nickname,
      password: "Password2",
      avatarUrl: expectedAvatarUrl
    });
    if (scenario.useUploadedAvatar) {
      expect(avatarUploadRequest).not.toBeNull();
      expect(avatarUploadRequest.headers()["content-type"]).toContain("multipart/form-data");
    } else {
      expect(avatarUploadRequest).toBeNull();
    }
    expect(stateRequestSentLegacyIdentity).toBe(false);
    expect(await page.evaluate(() => localStorage.getItem("pmt-auth-user"))).toBeNull();
    expect((await page.context().cookies()).find(cookie => cookie.name === "PMT.Auth"))
      .toMatchObject({ httpOnly: true, sameSite: "Strict" });
    await expect(page).not.toHaveURL(/\?invite=/);

    if (scenario.heading === "Sprints") {
      await expect(page.locator("[data-filter='sprint-project']")).toHaveValue(String(scenario.result.projectId));
    } else {
      await expect(page.locator(".project-card")).toHaveCount(scenario.projects.length);
    }

    await page.reload();
    await expect(page.getByRole("heading", { name: scenario.heading, exact: true })).toBeVisible();
    expect(restoredSessionCookie).toContain("PMT.Auth=invited-session");

    expect(browserErrors).toEqual([]);
  });
}

test("invalid invitation can return to the blank login screen", async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await installCommonApiMocks(page, () => createAppState({ users: [], projects: [], sprints: [] }));
  await page.route(`**/api/invitations/${invitationToken}`, async route => {
    await route.fulfill(jsonResponse({ error: "This invitation is no longer available." }, 404));
  });

  await page.goto(`/?invite=${invitationToken}`);
  await expect(page.getByRole("heading", { name: "Invitation unavailable" })).toBeVisible();
  await page.getByRole("button", { name: "Back to PMT" }).click();
  await expect(page.locator("#loginName")).toBeVisible();
  await expect(page.locator("#loginName")).toHaveValue("");
  await expect(page.locator("#loginPassword")).toHaveValue("");
  await expect(page).not.toHaveURL(/\?invite=/);
});

async function installCommonApiMocks(page, stateProvider, onStateRequest = null, onAvatarUpload = null) {
  await page.route("**/api/state", async route => {
    onStateRequest?.(route.request());
    await route.fulfill(jsonResponse(stateProvider()));
  });
  await page.route("**/api/login", async route => {
    await route.fulfill(jsonResponse({ userId: 1, nickname: "Sin", isAdmin: true, role: "Admin" }));
  });
  await page.route("**/api/uploads/**", async route => {
    onAvatarUpload?.(route.request());
    await route.fulfill(jsonResponse({
      fileName: "avatar.png",
      url: "/uploads/avatars/avatar.png",
      contentType: "image/png",
      byteLength: 12
    }));
  });
}

function createAppState({ users, projects, sprints }) {
  const userSummaries = new Map(users.map(item => [item.id, {
    id: item.id,
    name: item.nickname,
    nickname: item.nickname,
    avatarUrl: item.avatarUrl,
    isAdmin: item.isAdmin,
    role: item.role
  }]));

  return {
    users,
    projects: projects.map(item => ({
      ...item,
      members: item.memberIds.map(id => userSummaries.get(id)).filter(Boolean)
    })),
    sprints: sprints.map(item => ({
      ...item,
      developers: item.developerIds.map(id => userSummaries.get(id)).filter(Boolean)
    })),
    tasks: [],
    devLogs: [],
    blogs: [],
    auditEvents: [],
    lookups: [],
    holidays: []
  };
}

function user(id, nickname, isAdmin) {
  return {
    id,
    firstName: nickname.split(" ")[0],
    lastName: nickname.split(" ").slice(1).join(" ") || "User",
    nickname,
    email: "",
    phone: "",
    avatarUrl: "/assets/avatar-generic-1.jpg",
    homePageUrl: "",
    socialMediaUrl: "",
    bio: "",
    isAdmin,
    role: isAdmin ? "Admin" : "Developer",
    isActive: true
  };
}

function project(id, code, title, memberId) {
  return {
    id,
    code,
    title,
    description: `${title} invitation test project.`,
    url: "",
    iconUrl: "/assets/project-pmt.svg",
    startDate: "2026-07-01",
    endDate: "2026-08-31",
    createdByUserId: memberId,
    updatedByUserId: null,
    createdAt: "2026-07-01T08:00:00Z",
    updatedAt: "2026-07-01T08:00:00Z",
    percentCompleted: 0,
    taskCount: 0,
    completedTaskCount: 0,
    bugCount: 0,
    openBugCount: 0,
    memberIds: [memberId],
    members: []
  };
}

function sprint(id, projectId, code, developerId) {
  return {
    id,
    projectId,
    code,
    title: "Invitation Sprint",
    description: "",
    startDate: "2026-07-01",
    endDate: "2026-07-14",
    lessonLearnedHtml: "",
    isFinished: false,
    createdByUserId: developerId,
    updatedByUserId: null,
    createdAt: "2026-07-01T08:00:00Z",
    updatedAt: "2026-07-01T08:00:00Z",
    percentCompleted: 0,
    taskCount: 0,
    completedTaskCount: 0,
    bugCount: 0,
    openBugCount: 0,
    developerIds: [developerId],
    developers: []
  };
}

function collectBrowserErrors(page) {
  const errors = [];
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", error => errors.push(error.message));
  return errors;
}

function jsonResponse(data, status = 200, headers = {}) {
  return {
    status,
    contentType: "application/json",
    headers,
    body: JSON.stringify(data)
  };
}

function sessionPayload(user) {
  return {
    userId: user.id,
    nickname: user.nickname,
    isAdmin: user.isAdmin,
    role: user.role,
    originalUserId: user.id,
    originalUserName: user.nickname,
    isImpersonating: false,
    impersonatedUserName: ""
  };
}
