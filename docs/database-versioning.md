# Database Versioning and Migrations

## Current Production Baseline

As of July 14, 2026, every BDO and other known PMT instance has successfully applied `PMT_1.3_to_1.10_All.sql`. PMT Database Version 1.10 is therefore the deployed baseline, and protecting the data and stability of those instances is the top priority.

Future work does not need new upgrade compatibility for database versions before 1.10. Keep the released migrations and combined wrappers through Version 1.10 unchanged as historical release artifacts, but start future migrations from Version 1.10 or the immediately preceding deployed version.

The current source tree's rebuild scripts represent Version 1.14. Version 1.11 enforces Scrum ownership while preserving owner-only private Logs, Version 1.12 saves requested Project codes exactly while allowing an administrator to explicitly reclaim a code held by an archived Project, Version 1.13 adds administrator-only Maintenance preview/purge and final upload-reference checks, and Version 1.14 makes private Documentation and private Logs owner-only throughout the application SQL contract, including for administrators:

- `Sql/01_CreateDatabase.sql`
- `Sql/02_CreateStoredProcedures.sql`
- `Sql/03_SeedData.sql`
- `Sql/03_SeedData_PMT.sql`
- `Sql/03_SeedData_LMS.sql`
- `Sql/03_SeedData_HLS.sql`
- `Sql/00_DropAndRebuild_PMT.sql`

Fresh-database rebuilds and forward migrations beginning with `PMT_1.10_to_1.11.sql` record the installed source version in the database-level `PMT_DatabaseVersion` extended property. The historical Version 1.10 baseline may legitimately have no `PMT_DatabaseVersion` property; identify it by `PMT_SecurityRoleDefaultsVersion = 1.10`. That separate property remains `1.10` after later upgrades because it tracks the last version that changed Role defaults, not the overall database version.

To upgrade an existing BDO or other known installation from the Version 1.10 deployed baseline, follow `Sql/Migrations/2026-07-15 - PMT - BDO Migration Scripts.html`. Back up the database, application, configuration, and upload storage as one rollback set; keep PMT offline; then apply `Sql/Migrations/PMT_1.10_to_1.11.sql`, `Sql/Migrations/PMT_1.11_to_1.12.sql`, `Sql/Migrations/PMT_1.12_to_1.13.sql`, and `Sql/Migrations/PMT_1.13_to_1.14.sql` in that order in SQLCMD mode. Verify `PMT_DatabaseVersion` after every step and deploy the matching application only after Version 1.14 and the data-preservation checks succeed. If preflight finds Version 1.11, 1.12, or 1.13, stop and investigate the partial deployment before resuming with only the immediately following migration. Fresh development or demo databases may use the rebuild scripts. Existing user databases must be upgraded with forward migrations; do not treat a source-tree rebuild change as proof that production has been upgraded.

## Required Rule

From PMT Database Version 1.10 forward, any change that affects the database, its SQL contract, production data, or the stability of BDO's deployed instance through database state or behavior must include a forward migration script from the immediately preceding deployed version.

This includes changes to:

- tables, columns, constraints, indexes, schemas, or database objects
- stored procedure names, parameters, behavior, permissions, validations, or result-set order
- seed or lookup data required by the running application
- SQL workflow rules that existing production data depends on
- ADO.NET mappings that require a changed SQL contract

Changing `Sql/01_CreateDatabase.sql`, `Sql/02_CreateStoredProcedures.sql`, or seed scripts is not sufficient for deployed users. The same change must be represented as an upgrade path from the previous released database version.

## Migration Location and Naming

Place migration scripts in `Sql/Migrations/`.

Use this naming pattern:

```text
PMT_1.10_to_1.11.sql
PMT_1.11_to_1.12.sql
PMT_1.12_to_1.13.sql
PMT_1.13_to_1.14.sql
```

Use one migration per released database-version step. Do not edit an already released migration except to add comments that do not change behavior.

## Migration Expectations

Migration scripts should be explicit, reviewable, and safe for BDO's production data and other existing user data.

- Preserve existing data unless the requirement explicitly says otherwise.
- Use `[pmt]` for every PMT database object.
- Use `CREATE OR ALTER PROCEDURE` for stored procedure updates.
- Guard object creation with existence checks where practical.
- Avoid destructive rebuilds, broad deletes, or drops in user migrations.
- Keep result-set order stable unless the migration and C# mapping are updated together.
- Include comments for any data backfill, defaulting, or compatibility decision.
- Make the script rerunnable where practical, or clearly document why it is one-time only.

## When No Migration Is Needed

If a SQL-adjacent change does not affect existing deployed databases, note that in the implementation summary. Examples include documentation-only edits or disposable demo seed data that is not required by the running application.

When in doubt, provide a migration.
