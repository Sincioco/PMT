# PMT SQL Migrations

As of July 15, 2026, the latest PMT release and its current Version 1.15 database schema have been deployed to BDO. Every BDO and other known PMT instance is on Version 1.15, which is now the deployed baseline.

Future migrations start from Version 1.15 or the immediately preceding deployed version. New compatibility work for versions before 1.15 is not required. Keep the existing migrations, combined wrappers, and deployment runbooks through Version 1.15 unchanged as historical release artifacts.

The deployed baseline remains Version 1.15, while the current source schema and fresh rebuild represent Version 1.16. A deployed baseline installation records `PMT_DatabaseVersion = 1.15`; after applying the attendance migration it records `PMT_DatabaseVersion = 1.16`. `PMT_SecurityRoleDefaultsVersion` remains `1.10` because Version 1.16 reuses the existing Scrum rights and does not change Role defaults. Do not manually edit either version property.

## Historical Version 1.10 to 1.15 Deployment

The five `PMT_1.10_to_1.11.sql` through `PMT_1.14_to_1.15.sql` files and `2026-07-15 - PMT - BDO Migration Scripts.html` record the completed July 15 deployment from the former Version 1.10 baseline. They remain available as immutable release history and for controlled reconstruction only.

Do not rerun the Version 1.10-to-1.15 chain, `PMT_1.3_to_1.10_All.sql`, or any earlier historical migration on a current Version 1.15 installation. Never run the rebuild, create, stored-procedure, or seed scripts against an existing BDO database. Those scripts are for fresh disposable databases, not production upgrades.

## Future Migrations

`PMT_1.15_to_1.16.sql` is the canonical forward migration for the Daily Scrum attendance, calendar, on-behalf check-in, and vacation-planning release. It adds empty attendance and vacation tables, their focused stored procedures, and reset-safe cleanup behavior without backfilling or modifying existing PMT business data. Run that single file against the Version 1.15 deployed baseline before deploying the matching application binaries. No `_All.sql` wrapper is required because this release contains one versioned migration.

Every future SQL, database-contract, or database-backed stability change must add a forward migration script here. Use one canonical file per database-version step, named like:

```text
PMT_1.15_to_1.16.sql
PMT_1.16_to_1.17.sql
```

If one deployment requires two or more versioned migrations, always add a combined `PMT_<start>_to_<end>_All.sql` SQLCMD runner. Keep the version-step files canonical, and make the combined file use `:on error exit` plus ordered relative `:r` includes. For example, a deployment containing the two example scripts above must also contain `PMT_1.15_to_1.17_All.sql`. The deployment operator runs that one combined file instead of running the constituent files one by one.

Run the selected migration or combined runner in SQLCMD mode so any guard or SQL error stops the deployment immediately:

```powershell
sqlcmd -S "<SQL SERVER OR SQL SERVER\\INSTANCE>" -d PMT -E -b -I -i "<migration-or-combined-file>.sql"
```

In SQL Server Management Studio, enable **Query > SQLCMD Mode** before running the file. Rebuild scripts are for fresh databases. Migration scripts are for upgrading BDO and other existing user databases without losing data or destabilizing the deployed application.

See `docs/database-versioning.md`.
