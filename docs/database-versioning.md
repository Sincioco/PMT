# Database Versioning and Migrations

## Current Production Baseline

As of July 16, 2026, PMT Database Version 1.22 and its matching application release are deployed to BDO Production and every other known PMT instance. Version 1.22 is the deployed baseline. Protecting the data and stability of those instances is the top priority.

Future work does not need new upgrade compatibility for database versions before 1.22. Keep released migrations, combined runners, and deployment runbooks through Version 1.22 under `SQL/Migrations/Migration History/`. Start the next forward migration from Version 1.22; after a later version is deployed to every known instance, that version becomes the new baseline.

The current source tree and fresh-rebuild scripts represent Version 1.23. Version 1.23 preserves BDO's deployed PMT Project as `PMTQA`, restores the original SQL-seeded `PMT` Project for demos, recreates missing demo identities without public default passwords, adapts demo Bug values to active BDO lookups, protects `PMTQA` from broad Development cleanup, and supports repeated PMT demo clear-and-restore cycles:

- `SQL/01_CreateDatabase.sql`
- `SQL/02_CreateStoredProcedures.sql`
- `SQL/03_SeedData.sql`
- `SQL/03_SeedData_PMT.sql`
- `SQL/03_SeedData_LMS.sql`
- `SQL/03_SeedData_HLS.sql`
- `SQL/00_DropAndRebuild_PMT.sql`

Deployed databases currently record `PMT_DatabaseVersion = 1.22` in a database-level extended property. The Version 1.23 source and fresh rebuild record `1.23`; existing BDO data reaches it only through `SQL/Migrations/PMT_1.22_to_1.23.sql`. `PMT_SecurityRoleDefaultsVersion` remains `1.10`. Do not manually edit either version property.

The completed Version 1.15-to-1.22 steps, `PMT_1.15_to_1.22_All.sql` deployment runner, and incident-specific `PMT_1.19_to_1.22_All.sql` recovery runner are historical artifacts under `SQL/Migrations/Migration History/`. The Version 1.20 step includes the one-time, `ProjectId`-authoritative correction of legacy generated-prefix Sprint and work-item codes under the PMT Project. Those scripts remain available for controlled reconstruction and audit only; do not rerun them on a current Version 1.22 installation.

Fresh development or demo databases may use the rebuild scripts. Existing user databases must be upgraded with forward migrations from their deployed baseline; a source-tree rebuild change does not upgrade production.

## Required Rule

From the deployed PMT Database Version 1.22 baseline forward, any change that affects the database, its SQL contract, production data, or the stability of BDO's deployed instance through database state or behavior must include a forward migration script from the immediately preceding deployed version.

This includes changes to:

- tables, columns, constraints, indexes, schemas, or database objects
- stored procedure names, parameters, behavior, permissions, validations, or result-set order
- seed or lookup data required by the running application
- SQL workflow rules that existing production data depends on
- ADO.NET mappings that require a changed SQL contract

Changing `SQL/01_CreateDatabase.sql`, `SQL/02_CreateStoredProcedures.sql`, or seed scripts is not sufficient for deployed users. The same change must be represented as an upgrade path from the previous released database version.

## Migration Location and Naming

Place the active forward migration chain and its combined operator runner in `SQL/Migrations/`. Store completed migration scripts and HTML runbooks in `SQL/Migrations/Migration History/`.

Whenever a new deployed baseline is declared, automatically move every migration and runbook ending at or before that baseline into `Migration History/`. Keep only the forward chain from the declared baseline to the current source version, plus the matching combined runner, in the active directory. The active forward migration is currently `PMT_1.22_to_1.23.sql`. It is one version step, so no combined runner is required.

Use this naming pattern for the next steps:

```text
PMT_1.22_to_1.23.sql
PMT_1.23_to_1.24.sql
```

Use one migration per released database-version step. Do not edit an already released migration except for comments or path maintenance that does not change database behavior.

## Combined Deployment Migration

If one deployment requires two or more versioned migration scripts, always create a combined `PMT_<start>_to_<end>_All.sql` file in `SQL/Migrations/`. The individual version-step files remain the canonical migration history; the combined file is the operator-facing, one-command SQLCMD runner.

The combined runner must use `:on error exit` and ordered relative `:r` includes so any failed step stops the deployment. Deployment instructions must identify the database version and direct the operator to exactly one applicable combined runner instead of requiring constituent migrations to be run one by one.

## Migration Expectations

Migration scripts should be explicit, reviewable, and safe for BDO Production data and other existing user data.

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
