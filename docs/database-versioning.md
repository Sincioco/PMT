# Database Versioning and Migrations

PMT Database Version 1.0 is the baseline database contract for real user deployments.

The 1.0 baseline is represented by the current SQL rebuild scripts:

- `Sql/01_CreateDatabase.sql`
- `Sql/02_CreateStoredProcedures.sql`
- `Sql/03_SeedData.sql`
- `Sql/03_SeedData_LMS.sql`
- `Sql/03_SeedData_HLS.sql`
- `Sql/00_DropAndRebuild_PMT.sql`

Fresh development or demo databases may still use the rebuild scripts. Existing user databases must be upgraded with migration scripts.

## Required Rule

From PMT Database Version 1.0 forward, any change that affects an existing database install must include a migration script.

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
PMT_1.0_to_1.1.sql
PMT_1.1_to_1.2.sql
```

Use one migration per released database-version step. Do not edit an already released migration except to add comments that do not change behavior.

## Migration Expectations

Migration scripts should be explicit, reviewable, and safe for existing user data.

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
