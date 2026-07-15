import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

function functionSource(file, name, nextName) {
  const start = file.indexOf(`function ${name}`);
  const end = file.indexOf(`function ${nextName}`, start);
  assert.ok(start >= 0 && end > start, `${name} should be present`);
  return file.slice(start, end);
}

test("Board status saves preserve Root Cause Analysis", () => {
  const board = source("../../wwwroot/js/features/board/board.js");
  const updateTaskStatus = functionSource(board, "updateTaskStatus", "percentForTaskStatus");
  assert.match(updateTaskStatus, /rootCauseAnalysisHtml: task\.rootCauseAnalysisHtml \|\| ""/);
});

test("Backlog grid imports preserve Root Cause Analysis", () => {
  const backlog = source("../../wwwroot/js/features/backlog/backlog.js");
  const payload = functionSource(backlog, "backlogImportPayload", "backlogExportRows");
  assert.match(payload, /rootCauseAnalysisHtml: task\?\.rootCauseAnalysisHtml \|\| ""/);
});

test("blank HTML imports keep optional Root Cause Analysis blank", () => {
  const transfer = source("../../wwwroot/js/shared/work-item-transfer.js");
  const payload = functionSource(transfer, "workItemImportPayload", "resolveImportTaskType");
  const optionalRichHtml = functionSource(transfer, "importedOptionalRichHtml", "importedTitle");

  assert.match(payload, /rootCauseAnalysisHtml: importedOptionalRichHtml\(rawItem\.rootCauseAnalysisHtml, existing\?\.rootCauseAnalysisHtml\)/);
  assert.match(optionalRichHtml, /if \(!source\) return "";/);
  assert.doesNotMatch(optionalRichHtml, /Imported from PMT export/);
});
