import assert from "node:assert/strict";
import test from "node:test";

async function loadUrls(pathBase, href = "http://domain/mainurl/pmt/#/dashboard") {
  globalThis.window = {
    location: {
      href,
      origin: new URL(href).origin
    }
  };
  globalThis.document = {
    querySelector: selector => selector === 'meta[name="pmt-path-base"]'
      ? { getAttribute: () => pathBase }
      : null
  };

  return import(`../../wwwroot/js/shared/app-urls.js?pathBase=${encodeURIComponent(pathBase)}&t=${Date.now()}${Math.random()}`);
}

test("blank path base supports root deployment", async () => {
  const { appAbsoluteUrl, appPathBase, appUrl, storageUrl } = await loadUrls("", "http://domain/#/dashboard");

  assert.equal(appPathBase, "");
  assert.equal(appUrl("/api/state"), "/api/state");
  assert.equal(appUrl("/assets/project-pmt.svg"), "/assets/project-pmt.svg");
  assert.equal(appAbsoluteUrl("/"), "http://domain/");
  assert.equal(storageUrl("/uploads/tasks/file.png"), "/uploads/tasks/file.png");
});

test("/pmt path base supports a first-level sub-site", async () => {
  const { appAbsoluteUrl, appPathBase, appUrl, storageUrl } = await loadUrls("/pmt", "http://domain/pmt/#/dashboard");

  assert.equal(appPathBase, "/pmt");
  assert.equal(appUrl("/api/state"), "/pmt/api/state");
  assert.equal(appUrl("/pmt/api/state"), "/pmt/api/state");
  assert.equal(appAbsoluteUrl("/"), "http://domain/pmt/");
  assert.equal(storageUrl("/pmt/uploads/tasks/file.png"), "/uploads/tasks/file.png");
  assert.equal(storageUrl("http://domain/pmt/uploads/tasks/file.png"), "/uploads/tasks/file.png");
});

test("/mainurl/pmt path base supports a nested IIS Application", async () => {
  const { appAbsoluteUrl, appPathBase, appUrl, storageUrl } = await loadUrls("/mainurl/pmt");

  assert.equal(appPathBase, "/mainurl/pmt");
  assert.equal(appUrl("/api/state"), "/mainurl/pmt/api/state");
  assert.equal(appUrl("/assets/project-pmt.svg"), "/mainurl/pmt/assets/project-pmt.svg");
  assert.equal(appAbsoluteUrl("/"), "http://domain/mainurl/pmt/");
  assert.equal(storageUrl("/mainurl/pmt/uploads/tasks/file.png"), "/uploads/tasks/file.png");
  assert.equal(storageUrl("http://domain/mainurl/pmt/uploads/tasks/file.png"), "/uploads/tasks/file.png");
});
