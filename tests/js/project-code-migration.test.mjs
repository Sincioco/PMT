import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const migration = read("../../SQL/Migrations/Migration History/PMT_1.19_to_1.20.sql");
const recoveryRunner = read("../../SQL/Migrations/Migration History/PMT_1.19_to_1.22_All.sql");
const demoMigration = read("../../SQL/Migrations/PMT_1.22_to_1.23.sql");
const sourceProcedures = read("../../SQL/02_CreateStoredProcedures.sql");
const pmtSeed = read("../../SQL/03_SeedData_PMT.sql");
const developmentStore = read("../../Data/SqlPmtStore.Development.cs");

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

test("Version 1.23 atomically preserves PMTQA and restores the PMT demo", () => {
  const migrationDataStart = demoMigration.indexOf("BEGIN TRANSACTION;\n\nEXEC [pmt].[LockBlogWrites]");
  const seedStart = demoMigration.indexOf("/*\n    PMT project seed data.", migrationDataStart);
  const projectRename = demoMigration.slice(migrationDataStart, seedStart);

  assert.ok(migrationDataStart >= 0 && seedStart > migrationDataStart);
  assert.match(demoMigration, /ISNULL\(@DatabaseVersion, N''\) <> N'1\.22'/);
  assert.match(demoMigration, /\[Code\] = N'PMTQA'/);
  assert.match(demoMigration, /EXEC \[pmt\]\.\[SynchronizeProjectCode\]/);
  assert.match(demoMigration, /EXEC \[pmt\]\.\[EnsurePmtDemoUsers\]/);
  assert.match(demoMigration, /OBJECT_ID\(N'\[pmt\]\.\[LockWorkTaskWrites\]', N'P'\) IS NULL/);
  assert.match(demoMigration, /OBJECT_ID\(N'\[pmt\]\.\[LockSprintWrites\]', N'P'\) IS NULL/);
  assert.match(demoMigration, /@value = N'1\.23'/);
  assert.match(demoMigration, /COMMIT TRANSACTION/);
  assert.doesNotMatch(demoMigration, /:r\s+/);
  assert.match(projectRename, /UPDATE \[pmt\]\.\[Projects\]/);
  assert.match(projectRename, /WHERE \[ProjectId\] = @PmtProjectId/);
  assert.ok(projectRename.indexOf("EXEC [pmt].[LockBlogWrites]") < projectRename.indexOf("EXEC [pmt].[LockWorkTaskWrites]"));
  assert.ok(projectRename.indexOf("EXEC [pmt].[LockWorkTaskWrites]") < projectRename.indexOf("EXEC [pmt].[LockSprintWrites]"));
  assert.doesNotMatch(projectRename, /DELETE FROM \[pmt\]\.\[Projects\]/);
});

test("repeatable PMT demo restore protects public credentials and follows the Development reset contract", () => {
  const ensureUsers = procedureBody(sourceProcedures, "EnsurePmtDemoUsers");
  const cleanup = procedureBody(sourceProcedures, "DevelopmentClearProjectData");
  const migratedCleanup = procedureBody(demoMigration, "DevelopmentClearProjectData");

  assert.match(ensureUsers, /CRYPT_GEN_RANDOM\(32\)/);
  assert.doesNotMatch(ensureUsers, /N'Password1'/);
  assert.match(ensureUsers, /@Resource = N'pmt:PMTDemoRestore'/);
  assert.match(ensureUsers, /@LockOwner = N'Transaction'/);
  assert.ok(ensureUsers.indexOf("sys.sp_getapplock") < ensureUsers.indexOf("A PMT demo email belongs to more than one user"));
  assert.match(ensureUsers, /THROW 50262, 'A PMT demo email belongs to more than one user/);
  assert.match(ensureUsers, /THROW 50263, 'A PMT demo username belongs to another user/);
  for (const procedure of [cleanup, migratedCleanup]) {
    assert.match(procedure, /\[Code\] <> N'PMT'/);
    assert.doesNotMatch(procedure, /\[Code\] NOT IN \(N'PMT', N'PMTQA'\)/);
    assert.match(procedure, /Cleared project data except PMT\./);
    assert.match(procedure, /AND \[IsPrivate\] = 0/);
    assert.match(procedure, /AND \[LogType\] = N'Log'/);
    assert.match(procedure, /AND \[IsPrivate\] = 1/);
  }
  assert.match(pmtSeed, /\[Value\] LIKE N'% - Minor'/);
  assert.match(pmtSeed, /\[Value\] LIKE N'SIT -%'/);
  assert.match(pmtSeed, /EXEC \[pmt\]\.\[LockBlogWrites\];\s+EXEC \[pmt\]\.\[LockWorkTaskWrites\];\s+EXEC \[pmt\]\.\[LockSprintWrites\];/);
  assert.match(developmentStore, /BeginTransactionAsync\(IsolationLevel\.ReadCommitted/);
  assert.match(developmentStore, /StoredProcedure\(connection, transaction, "\[pmt\]\.\[EnsurePmtDemoUsers\]"\)/);
  assert.match(developmentStore, /ExecuteSeedScriptsAsync\(connection, scriptPaths, cancellationToken, transaction\)/);
});

test("Development Clear Users and Factory Reset ignore private-content ownership only for administrators", () => {
  for (const sql of [sourceProcedures, demoMigration]) {
    const clearUsers = procedureBody(sql, "DevelopmentClearUsers");
    const factoryReset = procedureBody(sql, "RequireDevelopmentSeedRestore");

    assert.match(clearUsers, /\[pmt\]\.\[IsAdmin\]\(@CurrentUserId\) = 0/);
    assert.doesNotMatch(clearUsers, /50255|another user owns private content/);
    assert.match(clearUsers, /DELETE FROM \[pmt\]\.\[UserPermissions\]\s+WHERE \[UserId\] <> @AdminUserId/);
    assert.match(clearUsers, /\[ActorUserId\] = @AdminUserId/);
    assert.match(clearUsers, /UPDATE \[pmt\]\.\[DevLogs\] SET \[UserId\] = @AdminUserId/);
    assert.match(clearUsers, /UPDATE \[pmt\]\.\[Blogs\] SET \[CreatedByUserId\] = @AdminUserId/);

    assert.match(factoryReset, /\[pmt\]\.\[IsAdmin\]\(@CurrentUserId\) = 0/);
    assert.doesNotMatch(factoryReset, /50257|another user owns private content/);
  }
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

function procedureBody(sql, name) {
  const start = sql.indexOf(`CREATE OR ALTER PROCEDURE [pmt].[${name}]`);
  const end = sql.indexOf("\nGO", start);
  assert.ok(start >= 0 && end > start, `${name} was not found.`);
  return sql.slice(start, end);
}
