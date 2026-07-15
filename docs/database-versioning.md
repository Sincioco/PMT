# Database Versioning and Migrations

## Current Production Baseline

As of July 15, 2026, the latest PMT release and its current Version 1.15 database schema have been deployed to BDO. Every BDO and other known PMT instance is on Version 1.15, which is now the deployed baseline. Protecting the data and stability of those instances is the top priority.

Future work does not need new upgrade compatibility for database versions before 1.15. Keep the released migrations, combined wrappers, and deployment runbooks through Version 1.15 unchanged as historical release artifacts. Start the next forward migration from Version 1.15; after a later version is deployed to every known instance, that version becomes the new baseline.

The current source tree's rebuild scripts represent Version 1.15. Version 1.11 enforces Scrum ownership while preserving owner-only private Logs, Version 1.12 saves requested Project codes exactly while allowing an administrator to explicitly reclaim a code held by an archived Project, Version 1.13 adds administrator-only Maintenance preview/purge and final upload-reference checks, Version 1.14 makes private Documentation and private Logs owner-only throughout the application SQL contract, including for administrators, and Version 1.15 adds the permanent About 3D visualization and flyby seed Documentation for existing installations:

- `Sql/01_CreateDatabase.sql`
- `Sql/02_CreateStoredProcedures.sql`
- `Sql/03_SeedData.sql`
- `Sql/03_SeedData_PMT.sql`
- `Sql/03_SeedData_LMS.sql`
- `Sql/03_SeedData_HLS.sql`
- `Sql/00_DropAndRebuild_PMT.sql`

Version 1.15 fresh-database rebuilds and upgraded databases record `PMT_DatabaseVersion = 1.15` in a database-level extended property. `PMT_SecurityRoleDefaultsVersion` remains `1.10` because that separate property tracks the last version that changed Role defaults, not the overall database version.

`Sql/Migrations/2026-07-15 - PMT - BDO Migration Scripts.html` is the historical runbook that moved BDO from Version 1.10 to Version 1.15. Do not rerun that chain on a current Version 1.15 installation. Fresh development or demo databases may use the rebuild scripts. Existing user databases must be upgraded with forward migrations from their deployed baseline; do not treat a source-tree rebuild change as proof that production has been upgraded.

## Required Rule

From the deployed PMT Database Version 1.15 baseline forward, any change that affects the database, its SQL contract, production data, or the stability of BDO's deployed instance through database state or behavior must include a forward migration script from the immediately preceding deployed version.

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
PMT_1.15_to_1.16.sql
PMT_1.16_to_1.17.sql
```

Use one migration per released database-version step. Do not edit an already released migration except to add comments that do not change behavior.

## Combined Deployment Migration

If one deployment requires two or more versioned migration scripts, always create a combined `PMT_<start>_to_<end>_All.sql` file in `Sql/Migrations/`. The individual version-step files remain the canonical migration history; the combined file is the operator-facing, one-command SQLCMD runner.

The combined runner must use `:on error exit` and ordered relative `:r` includes so any failed step stops the deployment. For example, a deployment containing `PMT_1.15_to_1.16.sql` and `PMT_1.16_to_1.17.sql` must also include `PMT_1.15_to_1.17_All.sql`. Deployment instructions must direct the operator to the combined file instead of requiring each constituent migration to be run separately.

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
