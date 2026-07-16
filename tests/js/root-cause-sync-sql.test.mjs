import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sourceSql = readFileSync(new URL("../../SQL/02_CreateStoredProcedures.sql", import.meta.url), "utf8");
const migrationSql = readFileSync(new URL("../../SQL/Migrations/Migration History/PMT_1.20_to_1.21.sql", import.meta.url), "utf8");

function upsertTaskProcedure(sql) {
  sql = sql.replace(/\r\n/g, "\n");
  const start = sql.indexOf("CREATE OR ALTER PROCEDURE [pmt].[UpsertTask]");
  const next = sql.indexOf("CREATE OR ALTER PROCEDURE [pmt].[ReorderTasks]", start);
  const end = next >= 0 ? next : sql.indexOf("\nBEGIN TRY\n", start);
  assert.ok(start >= 0 && end > start, "UpsertTask procedure should be present");
  return sql.slice(start, end).trim();
}

test("Root Cause Analysis sync is one-way from Dev Task to associated Bug", () => {
  const procedure = upsertTaskProcedure(sourceSql);
  const syncStart = procedure.indexOf("-- Root Cause Analysis has one source of truth");
  const syncEnd = procedure.indexOf("-- QA and deployment results on a Bug", syncStart);
  const syncBlock = procedure.slice(syncStart, syncEnd);

  assert.ok(syncStart >= 0 && syncEnd > syncStart, "one-way RCA sync block should be present");
  assert.match(syncBlock, /IF @TaskType = N'Dev'/);
  assert.match(syncBlock, /\[RootCauseAnalysisHtml\] = @RootCauseAnalysisHtml/);
  assert.match(syncBlock, /WHERE \[TaskId\] = @RootCauseSyncTargetId/);
  assert.doesNotMatch(syncBlock, /@TaskType = N'Bug'/);
  assert.doesNotMatch(syncBlock, /@RootCauseSyncMergedHtml|IN \(@TaskId, @RootCauseSyncTargetId\)|N'<hr>'/);
});

test("Version 1.21 migration installs the canonical UpsertTask procedure", () => {
  assert.equal(upsertTaskProcedure(migrationSql), upsertTaskProcedure(sourceSql));
  assert.match(migrationSql, /@value = N'1\.21'/);
});

test("Bug URL copies only to the linked Bug Fix Dev Task", () => {
  const procedure = upsertTaskProcedure(sourceSql);
  const start = procedure.indexOf("IF @TaskType = N'Bug'\n       AND EXISTS");
  const end = procedure.indexOf("-- Root Cause Analysis has one source of truth", start);
  const linkedBugFixBlock = procedure.slice(start, end);

  assert.ok(start >= 0 && end > start, "linked Bug Fix synchronization block should be present");
  assert.match(linkedBugFixBlock, /\[PercentCompleted\],\n\s+\[Url\],\n\s+\[StartDate\]/);
  assert.match(linkedBugFixBlock, /0,\n\s+@Url,\n\s+@StartDate/);
  assert.match(linkedBugFixBlock, /\[Priority\] = @Priority,\n\s+\[Url\] = @Url,\n\s+\[StartDate\] = @StartDate/);

  const rcaBlock = procedure.slice(end, procedure.indexOf("-- QA and deployment results on a Bug", end));
  assert.doesNotMatch(rcaBlock, /\[Url\]/);
});
