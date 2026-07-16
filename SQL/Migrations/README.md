# PMT SQL Migrations

As of July 16, 2026, PMT Database Version 1.22 and its matching application release are deployed to BDO Production and every other known PMT instance. Version 1.22 is the deployed baseline.

Future migrations start from Version 1.22 or the immediately preceding deployed version. New compatibility work for versions before 1.22 is not required. Keep released migrations, combined runners, and deployment runbooks through Version 1.22 under `Migration History/` as immutable release artifacts.

The deployed baseline is Version 1.22. The current source schema and fresh rebuild scripts represent Version 1.23, with `PMT_1.22_to_1.23.sql` as the canonical Production step and `PMT_1.22_to_1.23_All.sql` as the operator entry point. Version 1.23 also adds current-month vacation examples for shared PMT/LMS/HLS demo members, selected-date On Behalf Of attendance, audited removal of explicit attendance entries, and Development reset behavior that no longer refuses private content. `PMT_SecurityRoleDefaultsVersion` remains `1.10`. Do not manually edit either version property.

## Completed Version 1.15 to 1.22 Deployment

The seven canonical steps from `Migration History/PMT_1.15_to_1.16.sql` through `Migration History/PMT_1.21_to_1.22.sql`, the normal `Migration History/PMT_1.15_to_1.22_All.sql` runner, and the incident-specific `Migration History/PMT_1.19_to_1.22_All.sql` recovery runner record the completed July 16 deployment. The release added attendance and vacation tracking, save-collision protection, authorized Scrum pinning, actor-aware impersonation auditing, public seed Documentation, PMT Project child-code repair and Project-code synchronization, linked Dev Task/Bug synchronization, the Developer status ceiling, login timestamps, and administrator Role preservation.

Do not rerun the Version 1.15-to-1.22 chain or any earlier historical migration on a current Version 1.22 installation. Never run rebuild, create, stored-procedure, or seed scripts against an existing BDO database. Those scripts are for fresh disposable databases, not production upgrades.

All completed migration scripts and HTML runbooks live under `Migration History/`. When a newer version becomes the declared deployed baseline, move every migration and runbook ending at or before that version into that folder automatically. Leave only the migrations needed from the deployed baseline to the current source version, plus the combined operator runner, in this directory.

## Active Forward Migration

Run `PMT_1.22_to_1.23_All.sql` once from this directory. Its single included canonical step atomically renames the deployed `PMT` Project to `PMTQA`, recreates missing demo identities with non-public passwords, restores the original SQL-seeded `PMT` demo, adapts its Bugs to active BDO lookup values, adds non-overlapping current-month vacation examples for shared PMT/LMS/HLS demo members, updates `[pmt].[RecordAttendance]` for selected on-behalf dates, and adds audited `[pmt].[RemoveAttendance]`. Existing active vacation ranges are preserved and satisfy the demo example instead of receiving an overlapping duplicate. The migration also updates the post-deployment Development tools: broad Project cleanup protects only code `PMT`, Clear Users remaps private ownership to Sin, and Factory Reset may replace all data including private content. The one-step `_All.sql` wrapper is intentional so the tested entry point matches server execution.

Do not run `SQL/03_SeedData.sql` or **Factory Reset PMT** in Production. For later demos, use **Clear PMT Demo** followed by **Restore PMT Seed Data**; that focused cycle leaves `PMTQA` and BDO users intact. **Clear All Projects Except PMT** is different and permanently deletes `PMTQA` plus every other non-PMT Project.

## Future Migrations

Every future SQL, database-contract, or database-backed stability change must add a forward migration script here. Use one canonical file per database-version step, named like:

```text
PMT_1.22_to_1.23.sql
PMT_1.22_to_1.23_All.sql
PMT_1.23_to_1.24.sql
```

If one deployment requires two or more versioned migrations, always add a combined `PMT_<start>_to_<end>_All.sql` SQLCMD runner. Keep the version-step files canonical, and make the combined file use `:on error exit` plus ordered relative `:r` includes. The deployment operator runs that one combined file instead of running the constituent files one by one.

Run the selected migration or combined runner in SQLCMD mode so any guard or SQL error stops the deployment immediately:

```powershell
sqlcmd -S "<SQL SERVER OR SQL SERVER\\INSTANCE>" -d PMT -E -b -I -i "<migration-or-combined-file>.sql"
```

In SQL Server Management Studio, enable **Query > SQLCMD Mode** before running the file. Rebuild scripts are for fresh databases. Migration scripts are for upgrading BDO and other existing user databases without losing data or destabilizing the deployed application.

See `docs/database-versioning.md`.
