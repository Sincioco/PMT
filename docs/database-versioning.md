# Database Versioning and Migrations

## Current Production Baseline

As of July 15, 2026, the latest PMT release and its current Version 1.15 database schema have been deployed to BDO. Every BDO and other known PMT instance is on Version 1.15, which is now the deployed baseline. Protecting the data and stability of those instances is the top priority.

Future work does not need new upgrade compatibility for database versions before 1.15. Keep the released migrations, combined wrappers, and deployment runbooks through Version 1.15 unchanged under `SQL/Migrations/Migration History/`. Start the next forward migration from Version 1.15; after a later version is deployed to every known instance, that version becomes the new baseline.

The current source tree's rebuild scripts represent Version 1.22. Version 1.11 enforces Scrum ownership while preserving owner-only private Logs, Version 1.12 saves requested Project codes exactly while allowing an administrator to explicitly reclaim a code held by an archived Project, Version 1.13 adds administrator-only Maintenance preview/purge and final upload-reference checks, Version 1.14 makes private Documentation and private Logs owner-only throughout the application SQL contract, including for administrators, Version 1.15 adds the permanent About 3D visualization and flyby seed Documentation for existing installations, Version 1.16 adds Daily Scrum attendance, on-behalf check-in, ranged calendar data, and editable/cancellable vacation plans, Version 1.17 rejects stale shared-record saves with opaque SQL Server `ROWVERSION` tokens, serializes linked Blog/Task/Sprint structural writes in a fixed order, and safely initializes missing WFH rows under concurrent reads, Version 1.18 permits non-administrators to pin or unpin Scrum entries they are otherwise authorized to save while preserving administrator-only pinning for private Personal Logs, Version 1.19 adds row-versioned signed-session validation, actor-aware audit records, and the stored-procedure contract for server-controlled administrator impersonation and the Settings Audit Trail, Version 1.20 makes every known seed Documentation record public while transactionally synchronizing Sprint and work-item code prefixes when a Project code changes, Version 1.21 replaces the former bidirectional Root Cause Analysis merge with one-way Dev Task-to-Bug synchronization, copies Bug URLs to linked Bug Fix Dev Tasks, and enforces the Developer-role `QA Passed` status ceiling, and Version 1.22 records successful login timestamps without changing user `ROWVERSION` values while preserving an administrator's configured Role:

- `SQL/01_CreateDatabase.sql`
- `SQL/02_CreateStoredProcedures.sql`
- `SQL/03_SeedData.sql`
- `SQL/03_SeedData_PMT.sql`
- `SQL/03_SeedData_LMS.sql`
- `SQL/03_SeedData_HLS.sql`
- `SQL/00_DropAndRebuild_PMT.sql`

Version 1.22 fresh-database rebuilds and databases upgraded with `SQL/Migrations/PMT_1.15_to_1.22_All.sql` record `PMT_DatabaseVersion = 1.22` in a database-level extended property. The deployed BDO baseline remains Version 1.15 until that combined migration and the matching application release are deployed. `PMT_SecurityRoleDefaultsVersion` remains `1.10` because Versions 1.16 through 1.22 do not change Role permission defaults.

`SQL/Migrations/Migration History/2026-07-15 - PMT - BDO Migration Scripts.html` is the historical runbook that moved BDO from Version 1.10 to Version 1.15. Do not rerun that chain on a current Version 1.15 installation. Apply `SQL/Migrations/PMT_1.15_to_1.22_All.sql` for the current release so attendance/vacation storage, collision protection, authorized Scrum pinning, actor-aware impersonation auditing, public seed Documentation, Project-code synchronization, linked Dev Task/Bug field synchronization, the Developer-role status ceiling, login timestamps, and administrator Role preservation are installed in order. The final canonical step is `SQL/Migrations/PMT_1.21_to_1.22.sql`; superseded combined runners through Version 1.21 are retained under `Migration History/`. The Version 1.20 data correction enumerates known seed records instead of changing every private Documentation row, protecting genuine user-private content. It also performs a one-time, `ProjectId`-authoritative correction of legacy generated-prefix Sprint and work-item codes under the PMT Project. Already-correct codes stay unchanged; a colliding legacy row receives the next available standard PMT Sprint, Task, or Bug code without changing any row ID or relationship. Version 1.21 does not rewrite existing Root Cause Analysis or URL values; subsequent Dev Task and Bug saves apply their respective field-specific directions. Version 1.22 moves exact legacy administrator `Role = 'Admin'` values to the former `Developer` UI fallback because the old overwrite did not retain a separate configured title; all other Role values are preserved. Fresh development or demo databases may use the rebuild scripts. Existing user databases must be upgraded with forward migrations from their deployed baseline; do not treat a source-tree rebuild change as proof that production has been upgraded.

If a Version 1.20 attempt fails, its data transaction and version update roll back, while earlier combined-runner steps may remain committed. Query `PMT_DatabaseVersion` before retrying. A restored Version 1.15 database uses `SQL/Migrations/PMT_1.15_to_1.22_All.sql`; a database confirmed at Version 1.19 uses the one-command recovery runner `SQL/Migrations/PMT_1.19_to_1.22_All.sql`. Never manually advance the version property or run both runners.

## Required Rule

From the deployed PMT Database Version 1.15 baseline forward, any change that affects the database, its SQL contract, production data, or the stability of BDO's deployed instance through database state or behavior must include a forward migration script from the immediately preceding deployed version.

This includes changes to:

- tables, columns, constraints, indexes, schemas, or database objects
- stored procedure names, parameters, behavior, permissions, validations, or result-set order
- seed or lookup data required by the running application
- SQL workflow rules that existing production data depends on
- ADO.NET mappings that require a changed SQL contract

Changing `SQL/01_CreateDatabase.sql`, `SQL/02_CreateStoredProcedures.sql`, or seed scripts is not sufficient for deployed users. The same change must be represented as an upgrade path from the previous released database version.

## Migration Location and Naming

Place the active forward migration chain and its combined operator runner in `SQL/Migrations/`. Store completed migration scripts and HTML runbooks in `SQL/Migrations/Migration History/`.

Whenever a new deployed baseline is declared, automatically move every migration and runbook ending at or before that baseline into `Migration History/`. Keep only the forward chain from the declared baseline to the current source version, plus the matching combined runner, in the active directory.

Use this naming pattern:

```text
PMT_1.15_to_1.16.sql
PMT_1.16_to_1.17.sql
PMT_1.17_to_1.18.sql
PMT_1.18_to_1.19.sql
PMT_1.19_to_1.20.sql
PMT_1.20_to_1.21.sql
PMT_1.21_to_1.22.sql
```

Use one migration per released database-version step. Do not edit an already released migration except to add comments that do not change behavior.

## Combined Deployment Migration

If one deployment requires two or more versioned migration scripts, always create a combined `PMT_<start>_to_<end>_All.sql` file in `SQL/Migrations/`. The individual version-step files remain the canonical migration history; the combined file is the operator-facing, one-command SQLCMD runner.

The combined runner must use `:on error exit` and ordered relative `:r` includes so any failed step stops the deployment. The current deployment contains `PMT_1.15_to_1.16.sql`, `PMT_1.16_to_1.17.sql`, `PMT_1.17_to_1.18.sql`, `PMT_1.18_to_1.19.sql`, `PMT_1.19_to_1.20.sql`, `PMT_1.20_to_1.21.sql`, and `PMT_1.21_to_1.22.sql`, so it includes the normal `PMT_1.15_to_1.22_All.sql` runner. The incident-specific `PMT_1.19_to_1.22_All.sql` runner applies the remaining three steps when the database is first confirmed at Version 1.19. Deployment instructions must identify the database version and direct the operator to exactly one combined file instead of requiring each constituent migration to be run separately.

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
