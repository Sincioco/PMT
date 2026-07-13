import assert from "node:assert/strict";
import test from "node:test";

import { projectsAvailableForInvitation } from "../../wwwroot/js/shared/invitation-rules.js";

const projects = [
  { id: 10, title: "PMT", memberIds: [1, 2] },
  { id: 20, title: "LMS", memberIds: [2, 3] },
  { id: 30, title: "HLS", memberIds: ["2"] },
  { id: 40, title: "Unassigned" }
];

test("administrators can invite users to every project", () => {
  assert.deepEqual(
    projectsAvailableForInvitation(projects, 999, true).map(project => project.id),
    [10, 20, 30, 40]
  );
});

test("non-administrators can invite users only to projects where they are members", () => {
  assert.deepEqual(
    projectsAvailableForInvitation(projects, 2, false).map(project => project.id),
    [10, 20, 30]
  );
  assert.deepEqual(projectsAvailableForInvitation(projects, 999, false), []);
});
