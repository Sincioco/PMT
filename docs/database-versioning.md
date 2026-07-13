# Database Versioning and Migrations

## Current Production Baseline

As of July 13, 2026, PMT is deployed at BDO with real users. The current BDO production schema is the new baseline, PMT Database Version 1.3, and protecting the data and stability of that instance is the top priority.

All known PMT installations are on this baseline. Future work does not need new upgrade compatibility for Database Versions 1.0, 1.1, or 1.2. Keep the released pre-1.3 migration scripts unchanged as historical release artifacts, but start future migrations from Version 1.3 or the immediately preceding deployed version.

The BDO deployed baseline remains Version 1.3 until forward migrations are applied there. The current source tree's rebuild scripts represent the newest fresh-build schema, which advances to Version 1.10. Version 1.4 added user invitations, Version 1.5 added the new user roles, Version 1.6 makes role names manageable in Settings while preserving stable security codes, Version 1.7 adds role and user security permissions plus administrator password resets, Version 1.8 adds safe attachment deletion, Version 1.9 adds full-row user permission overrides and effective-permission auditing, and Version 1.10 restores discipline-based Role defaults and adds a global security reset:

- `Sql/01_CreateDatabase.sql`
- `Sql/02_CreateStoredProcedures.sql`
- `Sql/03_SeedData.sql`
- `Sql/03_SeedData_LMS.sql`
- `Sql/03_SeedData_HLS.sql`
- `Sql/00_DropAndRebuild_PMT.sql`

Apply `Sql/Migrations/PMT_1.3_to_1.4.sql`, `Sql/Migrations/PMT_1.4_to_1.5.sql`, `Sql/Migrations/PMT_1.5_to_1.6.sql`, `Sql/Migrations/PMT_1.6_to_1.7.sql`, `Sql/Migrations/PMT_1.7_to_1.8.sql`, `Sql/Migrations/PMT_1.8_to_1.9.sql`, and then `Sql/Migrations/PMT_1.9_to_1.10.sql` to upgrade BDO's deployed baseline to the current source schema. Fresh development or demo databases may use the rebuild scripts. BDO and other existing user databases must be upgraded with forward migration scripts; do not treat a source-tree rebuild change as proof that production has been upgraded.

## Required Rule

From PMT Database Version 1.3 forward, any change that affects the database, its SQL contract, production data, or the stability of BDO's deployed instance through database state or behavior must include a forward migration script from the immediately preceding deployed version.

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
PMT_1.3_to_1.4.sql
PMT_1.4_to_1.5.sql
PMT_1.5_to_1.6.sql
PMT_1.6_to_1.7.sql
PMT_1.7_to_1.8.sql
PMT_1.8_to_1.9.sql
PMT_1.9_to_1.10.sql
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
