import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schemaSql = read("../../SQL/01_CreateDatabase.sql");
const proceduresSql = read("../../SQL/02_CreateStoredProcedures.sql");
const migrationSql = read("../../SQL/Migrations/Migration History/PMT_1.21_to_1.22.sql");
const combinedMigrationSql = read("../../SQL/Migrations/Migration History/PMT_1.15_to_1.22_All.sql");
const authenticationStore = read("../../Data/SqlPmtStore.Authentication.cs");
const authenticationEndpoints = read("../../Endpoints/AuthenticationEndpoints.cs");
const invitationEndpoints = read("../../Endpoints/InvitationEndpoints.cs");
const settingsSource = read("../../wwwroot/js/features/settings/settings.js");

test("login activity is stored separately from the row-versioned Users record", () => {
  assert.match(schemaSql, /CREATE TABLE \[pmt\]\.\[UserLoginActivity\]/);
  assert.match(schemaSql, /\[LastLoginAt\] DATETIME2\(0\) NOT NULL/);
  assert.match(schemaSql, /REFERENCES \[pmt\]\.\[Users\]\(\[UserId\]\) ON DELETE CASCADE/);
  assert.match(proceduresSql, /CREATE OR ALTER PROCEDURE \[pmt\]\.\[RecordSuccessfulLogin\]/);
  assert.match(proceduresSql, /UPDATE \[pmt\]\.\[UserLoginActivity\] WITH \(UPDLOCK, HOLDLOCK\)/);
  assert.doesNotMatch(procedureBody(proceduresSql, "RecordSuccessfulLogin"), /UPDATE \[pmt\]\.\[Users\]/);
});

test("only successful credential and invitation sign-ins record login activity", () => {
  assert.match(authenticationStore, /RecordSuccessfulLoginAsync/);
  assert.equal(occurrences(authenticationEndpoints, "RecordSuccessfulLoginAsync"), 1);
  assert.equal(occurrences(invitationEndpoints, "RecordSuccessfulLoginAsync"), 1);

  const loginSuccess = authenticationEndpoints.indexOf("if (user is null) return Results.Unauthorized();");
  const credentialRecord = authenticationEndpoints.indexOf("RecordSuccessfulLoginAsync");
  const credentialSignIn = authenticationEndpoints.indexOf("SignInUserAsync(context, user, user, false)");
  assert.ok(loginSuccess >= 0 && loginSuccess < credentialRecord && credentialRecord < credentialSignIn);

  const invitationUser = invitationEndpoints.indexOf("var user = await store.GetSessionUserAsync");
  const invitationRecord = invitationEndpoints.indexOf("RecordSuccessfulLoginAsync");
  const invitationSignIn = invitationEndpoints.indexOf("AuthenticationEndpoints.SignInUserAsync");
  assert.ok(invitationUser >= 0 && invitationUser < invitationRecord && invitationRecord < invitationSignIn);
});

test("administrator saves retain a configured role and the card adds the Admin suffix", () => {
  const upsertUser = procedureBody(proceduresSql, "UpsertUser");
  assert.doesNotMatch(upsertUser, /IF @IsAdmin = 1\s+BEGIN\s+SET @Role = N'Admin'/);
  assert.match(migrationSql, /SET \[Role\] = N'Developer'\s+WHERE \[IsAdmin\] = 1\s+AND \[Role\] = N'Admin'/);
  assert.match(procedureBody(migrationSql, "DevelopmentClearUsers"), /\[Role\] = N'Developer'/);
  assert.doesNotMatch(procedureBody(migrationSql, "DevelopmentClearUsers"), /\[Role\] = N'Admin'/);
  assert.match(settingsSource, /return user\.isAdmin \? `\$\{title\} \(Admin\)` : title/);
  assert.match(settingsSource, /Last login: \$\{escapeHtml\(user\.lastLoginAt \? formatDateTime\(user\.lastLoginAt\) : "Never"\)\}/);
});

test("the canonical migration advances and verifies Version 1.22", () => {
  assert.match(migrationSql, /NOT IN \(N'1\.21', N'1\.22'\)/);
  assert.match(migrationSql, /@value = N'1\.22'/);
  assert.match(migrationSql, /PMT Version 1\.22 login activity and administrator Role contract could not be verified/);
});

test("the released Version 1.15 to 1.22 runner includes every step in order", () => {
  const expectedSteps = [
    "PMT_1.15_to_1.16.sql",
    "PMT_1.16_to_1.17.sql",
    "PMT_1.17_to_1.18.sql",
    "PMT_1.18_to_1.19.sql",
    "PMT_1.19_to_1.20.sql",
    "PMT_1.20_to_1.21.sql",
    "PMT_1.21_to_1.22.sql"
  ];
  assert.match(combinedMigrationSql, /:on error exit/);
  assert.equal(occurrences(combinedMigrationSql, ":r "), expectedSteps.length);
  expectedSteps.reduce((previousIndex, step) => {
    const index = combinedMigrationSql.indexOf(step);
    assert.ok(index > previousIndex, `${step} is missing or out of order.`);
    return index;
  }, -1);
});

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

function procedureBody(sql, name) {
  const start = sql.indexOf(`CREATE OR ALTER PROCEDURE [pmt].[${name}]`);
  assert.notEqual(start, -1, `${name} procedure is missing.`);
  const next = sql.indexOf("\nGO", start);
  assert.notEqual(next, -1, `${name} procedure terminator is missing.`);
  return sql.slice(start, next);
}

function occurrences(value, search) {
  return value.split(search).length - 1;
}
