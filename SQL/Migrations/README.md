# PMT SQL Migrations

As of July 28, 2026, PMT Database Version 1.27 and its matching application release are deployed to BDO Production and every other known PMT instance. Version 1.27 is the deployed baseline.

Future migrations start from Version 1.27 or the immediately preceding deployed version. New compatibility work for versions before 1.27 is not required. Keep released migrations, combined runners, and deployment runbooks through Version 1.27 under `Migration History/` as immutable release artifacts.

The deployed baseline is Version 1.27 and the current source schema is Version 1.28. Version 1.28 retains the Version 1.27 table, stored-procedure, and seed contract and advances only the guarded release marker for the frontend-only Diagram and rich-text editor release. Version 1.27 adds user Suggestions, GUID-token public Document and Diagram links with optional expiration, linked Dev/Bug rollback behavior when QA has not touched the linked Bug, and the public editable `PMT Field Mapping Example` Diagram backed by `/assets/docs/pmt-field-mapping-example.svg`. The normal Latest sort places the newly inserted Diagram first without changing selection behavior. Version 1.26 adds four public PMT tutorial Documentation pages for Mentions and Live Cards, Diagrams, ERDs, and Image Annotations. Version 1.25 adds shared game-score leaderboard storage for PMT games. Version 1.24 refreshes the seeded public `PMT's Database Schema` demo Diagram to the current bundled `/assets/docs/pmt-database-schema.svg` asset, which uses the shared Diagram Entity spacing/routing rules, and soft-deletes duplicate seeded schema Diagram rows if any exist. Version 1.23 added current-month vacation examples for shared PMT/LMS/HLS demo members, selected-date On Behalf Of attendance, audited removal of explicit attendance entries, Development reset behavior that no longer refuses private content, shared-default plus per-user image-annotation template libraries stored as versioned JSON, persistent manual Diagram hierarchy ordering, cleared existing Documentation and Diagram pins while pinning is disabled, and seeded the unpinned public database-schema demo Diagram. `PMT_SecurityRoleDefaultsVersion` remains `1.10`. Do not manually edit either version property.

## Completed Migrations Through Version 1.27

All completed migration steps, combined runners, and deployment runbooks through Version 1.27 are stored under `Migration History/`. This includes the canonical Version 1.23-to-1.24, Version 1.24-to-1.25, Version 1.25-to-1.26, and Version 1.26-to-1.27 steps plus their combined operator runners.

Do not rerun Version 1.27 or any earlier historical migration on a current Version 1.27 installation. Never run rebuild, create, stored-procedure, or seed scripts against an existing BDO database. Those scripts are for fresh disposable databases, not production upgrades.

All completed migration scripts and HTML runbooks live under `Migration History/`. When a newer version becomes the declared deployed baseline, move every migration and runbook ending at or before that version into that folder automatically. Leave only the migrations needed from the deployed baseline to the current source version, plus the combined operator runner, in this directory.

## Active Forward Migration

The active `PMT_1.27_to_1.28.sql` migration changes only the guarded database release marker. Deployment must run `PMT_1.27_to_1.28_All.sql` in SQLCMD mode so the exact one-file runner rehearsed for release is also used by the operator. Follow `2026-07-31 - PMT - BDO Version 1.28 Deployment.html`.

Do not run `SQL/03_SeedData.sql` or **Factory Reset PMT** in Production. For later demos, use **Clear PMT Demo** followed by **Restore PMT Seed Data**; that focused cycle leaves `PMTQA` and BDO users intact. **Clear All Projects Except PMT** is different and permanently deletes `PMTQA` plus every other non-PMT Project.

## Future Migrations

Every future SQL, database-contract, or database-backed stability change must add a forward migration script here. Use one canonical file per database-version step, named like:

```text
PMT_1.28_to_1.29.sql
PMT_1.29_to_1.30.sql
PMT_1.28_to_1.30_All.sql
```

If one deployment requires two or more versioned migrations, always add a combined `PMT_<start>_to_<end>_All.sql` SQLCMD runner. A release may also wrap one canonical step when the operator must use the same one-file entry point used during rehearsal, as Version 1.28 does. Keep the version-step files canonical, and make the combined file use `:on error exit` plus ordered relative `:r` includes.

Run the selected migration or combined runner in SQLCMD mode so any guard or SQL error stops the deployment immediately:

```powershell
sqlcmd -S "<SQL SERVER OR SQL SERVER\\INSTANCE>" -d PMT -E -b -I -i "<migration-or-combined-file>.sql"
```

In SQL Server Management Studio, enable **Query > SQLCMD Mode** before running the file. Rebuild scripts are for fresh databases. Migration scripts are for upgrading BDO and other existing user databases without losing data or destabilizing the deployed application.

See `docs/database-versioning.md`.
