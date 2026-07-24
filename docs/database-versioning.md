# Database Versioning and Migrations

## Current Production Baseline

As of July 24, 2026, PMT Database Version 1.26 and its matching application release are deployed to BDO Production and every other known PMT instance. Version 1.26 is the deployed baseline. Protecting the data and stability of those instances is the top priority.

Future work does not need new upgrade compatibility for database versions before 1.26. Keep released migrations, combined runners, and deployment runbooks through Version 1.26 under `SQL/Migrations/Migration History/`. Start the next forward migration from Version 1.26; after a later version is deployed to every known instance, that version becomes the new baseline.

The current source tree and fresh-rebuild scripts represent Version 1.27. Version 1.27 adds `[pmt].[Suggestions]` plus `[pmt].[AddSuggestion]` for user-submitted PMT suggestions, `[pmt].[PublicBlogLinks]` plus `[pmt].[CreatePublicBlogLink]` and `[pmt].[GetPublicBlog]` for GUID-based anonymous read-only public Document and Diagram links with optional expiration, and an `[pmt].[UpsertTask]` rule that lets a developer pull a linked Dev Task back from Ready for QA to In Progress when QA has not touched the linked Bug. Version 1.26 adds public PMT tutorial Documentation pages for Mentions and Live Cards, Diagrams, ERDs, and Image Annotations to the permanent PMT seed and to existing installs through a forward migration. Version 1.25 adds `[pmt].[GameScores]` plus `[pmt].[AddGameScore]` and `[pmt].[GetGameScores]` so shared game leaderboards can persist scores by game key and signed-in PMT user. Version 1.24 keeps the deployed Version 1.23 schema contract and refreshes the seeded public `PMT's Database Schema` Diagram so its Blog body references the current cache-versioned bundled `/assets/docs/pmt-database-schema.svg` file and duplicate seeded schema Diagram rows are soft-deleted. Version 1.23 preserved BDO's former PMT Project as `PMTQA`, restored the original SQL-seeded `PMT` Project for demos, recreated missing demo identities without public default passwords, adapted demo Bug values to active BDO lookups, seeded current-month vacation examples for shared PMT/LMS/HLS demo members and 13 shared image-annotation templates for every user, persisted manual Diagram hierarchy order through `[pmt].[Blogs].[SortOrder]` and `[pmt].[MoveBlog]`, cleared existing Documentation and Diagram pins while pinning is disabled, seeded the unpinned public database-schema demo Diagram with all current `[pmt]` tables and foreign-key mappings, and exposed the connected database's current `[pmt]` catalog through `[pmt].[GetPmtDatabaseSchema]` for on-demand Diagram generation by users with Documentation/Create permission. The schema Diagram SVG remains outside SQL and does not create an upload-folder file:

- `SQL/01_CreateDatabase.sql`
- `SQL/02_CreateStoredProcedures.sql`
- `SQL/03_SeedData.sql`
- `SQL/03_SeedData_ImageAnnotationTemplates.sql`
- `SQL/03_SeedData_PMT.sql`
- `SQL/03_SeedData_LMS.sql`
- `SQL/03_SeedData_HLS.sql`
- `SQL/03_SeedData_DiagramDemo.sql`
- `SQL/00_DropAndRebuild_PMT.sql`

Deployed databases record `PMT_DatabaseVersion = 1.26`; fresh rebuilds record `PMT_DatabaseVersion = 1.27`. The active forward migration is `SQL/Migrations/PMT_1.26_to_1.27.sql`, and the operator-facing SQLCMD runner is `SQL/Migrations/PMT_1.26_to_1.27_All.sql`. The completed `PMT_1.25_to_1.26.sql` step, with `PMT_1.25_to_1.26_All.sql` as its combined runner, is a historical artifact under `SQL/Migrations/Migration History/`. `PMT_SecurityRoleDefaultsVersion` remains `1.10`. Do not manually edit either version property.

All migrations, combined runners, and runbooks through Version 1.26 are historical artifacts under `SQL/Migrations/Migration History/`. The Version 1.20 step includes the one-time, `ProjectId`-authoritative correction of legacy generated-prefix Sprint and work-item codes under the PMT Project. Those scripts remain available for controlled reconstruction and audit only; do not rerun them on a current Version 1.26 installation.

Fresh development or demo databases may use the rebuild scripts. Existing user databases must be upgraded with forward migrations from their deployed baseline; a source-tree rebuild change does not upgrade production.

## Required Rule

From the deployed PMT Database Version 1.26 baseline forward, any change that affects the database, its SQL contract, production data, or the stability of BDO's deployed instance through database state or behavior must include a forward migration script from the immediately preceding deployed version.

This includes changes to:

- tables, columns, constraints, indexes, schemas, or database objects
- stored procedure names, parameters, behavior, permissions, validations, or result-set order
- seed or lookup data required by the running application
- SQL workflow rules that existing production data depends on
- ADO.NET mappings that require a changed SQL contract

Changing `SQL/01_CreateDatabase.sql`, `SQL/02_CreateStoredProcedures.sql`, or seed scripts is not sufficient for deployed users. The same change must be represented as an upgrade path from the previous released database version.

## Migration Location and Naming

Place the active forward migration chain and its combined operator runner in `SQL/Migrations/`. Store completed migration scripts and HTML runbooks in `SQL/Migrations/Migration History/`.

Whenever a new deployed baseline is declared, automatically move every migration and runbook ending at or before that baseline into `Migration History/`. Keep only the forward chain from the declared baseline to the current source version, plus the matching combined runner, in the active directory. Version 1.26 is the deployed baseline and Version 1.27 is the current source version, so `PMT_1.26_to_1.27.sql` and `PMT_1.26_to_1.27_All.sql` remain active until Version 1.27 is deployed everywhere.

Use this naming pattern for the next steps:

```text
PMT_1.26_to_1.27.sql
PMT_1.27_to_1.28.sql
PMT_1.26_to_1.28_All.sql
```

Use one migration per released database-version step. Do not edit an already released migration except for comments or path maintenance that does not change database behavior.

## Combined Deployment Migration

If one deployment requires two or more versioned migration scripts, always create a combined `PMT_<start>_to_<end>_All.sql` file in `SQL/Migrations/`. The individual version-step files remain the canonical migration history; the combined file is the operator-facing, one-command SQLCMD runner. The completed Version 1.23 and Version 1.25 deployments retain their historical combined wrappers because those releases used the same tested entry point for rehearsal and server execution.

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
