import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const migration = read("../../SQL/Migrations/Migration History/PMT_1.19_to_1.20.sql");
const recoveryRunner = read("../../SQL/Migrations/Migration History/PMT_1.19_to_1.22_All.sql");
const sourceProcedures = read("../../SQL/02_CreateStoredProcedures.sql");

test("Version 1.20 contains a one-time PMT-only legacy child-code repair", () => {
  const versionGuard = migration.indexOf("IF @DatabaseVersion = N'1.19'");
  const start = migration.indexOf("One-time BDO repair");
  const end = migration.indexOf("DECLARE @ProjectId INT;", start);
  const repair = migration.slice(start, end);

  assert.ok(versionGuard >= 0 && versionGuard < start && end > start);
  assert.match(repair, /WHERE \[Code\] = N'PMT'/);
  assert.match(repair, /\[Sprint\]\.\[ProjectId\] = @PmtProjectId/);
  assert.match(repair, /\[Task\]\.\[ProjectId\] = @PmtProjectId/);
  assert.match(repair, /LEFT\(\[Sprint\]\.\[Code\], 4\) <> N'PMT-'/);
  assert.match(repair, /LEFT\(\[Task\]\.\[Code\], 4\) <> N'PMT-'/);
  assert.match(repair, /Renumbered legacy suffix collision/);
  assert.match(repair, /THROW 51059, 'The PMT Project is required/);
  assert.doesNotMatch(repair, /DELETE FROM|SET \[ProjectId\]|SET \[SprintId\]/);

  const migrationCursor = migration.slice(end, migration.indexOf("CLOSE [ProjectCodeCursor]", end));
  assert.match(migrationCursor, /WHERE \[ProjectId\] = @PmtProjectId/);
});

test("runtime Project renames retain strict collision handling", () => {
  const procedureStart = sourceProcedures.indexOf("CREATE OR ALTER PROCEDURE [pmt].[SynchronizeProjectCode]");
  const procedureEnd = sourceProcedures.indexOf("\nGO", procedureStart);
  const procedure = sourceProcedures.slice(procedureStart, procedureEnd);

  assert.match(procedure, /THROW 51043, 'The Project contains duplicate Sprint or Task code suffixes that cannot be synchronized safely\.'/);
  assert.doesNotMatch(procedure, /One-time BDO repair|PmtSprintRepairCursor|PmtTaskRepairCursor/);
});

test("the released Version 1.19 recovery uses one ordered SQLCMD runner", () => {
  const expectedSteps = [
    "PMT_1.19_to_1.20.sql",
    "PMT_1.20_to_1.21.sql",
    "PMT_1.21_to_1.22.sql"
  ];

  assert.match(recoveryRunner, /:on error exit/);
  assert.equal(recoveryRunner.split(":r ").length - 1, expectedSteps.length);
  expectedSteps.reduce((previousIndex, step) => {
    const index = recoveryRunner.indexOf(step);
    assert.ok(index > previousIndex, `${step} is missing or out of order.`);
    return index;
  }, -1);
});

test("historical combined migration runners resolve every SQLCMD include", () => {
  const historyUrl = new URL("../../SQL/Migrations/Migration History/", import.meta.url);
  const runners = readdirSync(historyUrl).filter((name) => name.endsWith("_All.sql"));

  for (const runner of runners) {
    const sql = readFileSync(new URL(runner, historyUrl), "utf8");
    const includes = [...sql.matchAll(/^:r\s+"([^"]+)"/gm)];

    for (const include of includes) {
      const includeUrl = new URL(include[1].replaceAll("\\", "/"), historyUrl);
      assert.ok(existsSync(includeUrl), `${runner} cannot resolve ${include[1]}.`);
    }
  }
});

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}
