import assert from "node:assert/strict";
import test from "node:test";

const { api } = await import("../../wwwroot/js/core/api.js");
const { saveProjectWithArchivedCodeOverride } = await import("../../wwwroot/js/features/projects/projects.js");

const payload = {
  id: 0,
  code: "PMT",
  title: "Project Management Tool",
  description: "",
  url: "",
  iconUrl: "",
  startDate: null,
  endDate: null,
  memberIds: [1]
};

function archivedCodeConflict() {
  const error = new Error("Project code PMT belongs to a deleted project.");
  error.code = "archived-project-code";
  return error;
}

test("API errors preserve the structured error code", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    statusText: "Conflict",
    json: async () => ({
      error: "Project code PMT belongs to a deleted project.",
      code: "archived-project-code"
    })
  });

  try {
    await assert.rejects(api("/api/projects"), error => {
      assert.equal(error.message, "Project code PMT belongs to a deleted project.");
      assert.equal(error.code, "archived-project-code");
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an Admin can confirm reuse and retry the identical project payload", async () => {
  const requests = [];
  const confirmations = [];
  const saveJson = async (path, method, requestPayload) => {
    requests.push({ path, method, payload: requestPayload });
    if (requests.length === 1) throw archivedCodeConflict();
    return { id: 42 };
  };

  const result = await saveProjectWithArchivedCodeOverride({
    saveJson,
    path: "/api/projects",
    method: "POST",
    payload,
    isAdmin: true,
    confirmReuse: async (message, title) => {
      confirmations.push({ message, title });
      return true;
    }
  });

  assert.deepEqual(result, { id: 42 });
  assert.equal(confirmations.length, 1);
  assert.equal(confirmations[0].title, "Reuse Project Code");
  assert.match(confirmations[0].message, /belongs to a deleted project/i);
  assert.deepEqual(requests, [
    { path: "/api/projects", method: "POST", payload },
    { path: "/api/projects", method: "POST", payload: { ...payload, overrideArchivedCode: true } }
  ]);
  assert.equal("overrideArchivedCode" in payload, false);
});

test("canceling Admin reuse keeps the original conflict from issuing a retry", async () => {
  let requestCount = 0;
  let confirmationCount = 0;

  await assert.rejects(saveProjectWithArchivedCodeOverride({
    saveJson: async () => {
      requestCount += 1;
      throw archivedCodeConflict();
    },
    path: "/api/projects",
    method: "POST",
    payload,
    isAdmin: true,
    confirmReuse: async () => {
      confirmationCount += 1;
      return false;
    }
  }), /Project code reuse canceled/);

  assert.equal(requestCount, 1);
  assert.equal(confirmationCount, 1);
});

test("a non-admin receives the conflict without an override confirmation or retry", async () => {
  const conflict = archivedCodeConflict();
  let requestCount = 0;
  let confirmationCount = 0;

  await assert.rejects(saveProjectWithArchivedCodeOverride({
    saveJson: async () => {
      requestCount += 1;
      throw conflict;
    },
    path: "/api/projects",
    method: "POST",
    payload,
    isAdmin: false,
    confirmReuse: async () => {
      confirmationCount += 1;
      return true;
    }
  }), error => error === conflict);

  assert.equal(requestCount, 1);
  assert.equal(confirmationCount, 0);
});
