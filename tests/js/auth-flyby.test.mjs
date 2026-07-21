import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createPmtDemoFlybyData } from "../../wwwroot/js/features/about/about.js";

test("auth flyby demo data always uses the portable PMT project", () => {
  const data = createPmtDemoFlybyData();

  assert.equal(data.projects.length, 1);
  assert.equal(data.projects[0].code, "PMT");
  assert.match(data.projects[0].title, /Project Management Tool/i);
  assert.ok(data.users.length >= 2);
  assert.ok(data.blogs.length >= 1);
  assert.ok(data.tasks.some(task => task.taskType === "Dev Task"));
  assert.ok(data.tasks.some(task => task.taskType === "Bug"));
  assert.ok(data.statuses.includes("QA Passed"));
  assert.ok(data.tasks.every(task => task.projectId === data.projects[0].id));
  assert.ok(data.sprints.every(sprint => sprint.projectId === data.projects[0].id));
});

test("login and invited signup screens mount the PMT auth flyby with separate layouts", async () => {
  const [app, shell, invitations, loginCss, invitationCss, aboutScene] = await Promise.all([
    readFile(new URL("../../wwwroot/js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../../wwwroot/js/core/application-shell.js", import.meta.url), "utf8"),
    readFile(new URL("../../wwwroot/js/features/invitations/invitations.js", import.meta.url), "utf8"),
    readFile(new URL("../../wwwroot/css/features/login.css", import.meta.url), "utf8"),
    readFile(new URL("../../wwwroot/css/features/invitations.css", import.meta.url), "utf8"),
    readFile(new URL("../../wwwroot/js/features/about/about-scene.js", import.meta.url), "utf8")
  ]);

  assert.match(app, /createAboutAuthFlyby/);
  assert.match(app, /renderLoginBackground:\s*renderAuthFlyby/);
  assert.match(app, /renderAuthBackground:\s*renderAuthFlyby/);
  assert.match(shell, /login-screen-flyby/);
  assert.match(shell, /data-login-flyby/);
  assert.match(shell, /<h1>PMT<\/h1>/);
  assert.doesNotMatch(loginCss, /body\.login-flyby-active \.topbar\s*\{\s*display:\s*none;/);
  assert.match(loginCss, /\.login-screen-flyby \.login-card/);
  assert.match(invitations, /invite-profile-flyby-screen/);
  assert.match(invitations, /data-invite-auth-flyby/);
  assert.match(invitations, /data-invite-profile-drag-handle/);
  assert.match(invitations, /function makeInviteProfileCardDraggable/);
  assert.match(invitationCss, /\.invite-profile-flyby-screen\s*\{[\s\S]*place-items:\s*center;/);
  assert.match(invitationCss, /\.invite-profile-brand\[data-invite-profile-drag-handle\]/);
  assert.match(aboutScene, /introDurationMs\s*=\s*INTRO_DURATION_MS/);
  assert.match(aboutScene, /introFadeDurationMs\s*=\s*INTRO_FADE_DURATION_MS/);
});
