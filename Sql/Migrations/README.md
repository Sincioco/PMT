# PMT SQL Migrations

As of July 14, 2026, every BDO and other known PMT instance has successfully applied `PMT_1.3_to_1.10_All.sql`. PMT Database Version 1.10 is the deployed baseline.

Future migrations start from Version 1.10 or the immediately preceding deployed version. New compatibility work for versions before 1.10 is not required. Keep the existing migrations and combined wrappers through Version 1.10 unchanged as historical release artifacts.

The current source schema is Version 1.15. Apply these migrations in order to every existing Version 1.10 installation:

1. `PMT_1.10_to_1.11.sql` requires ownership plus the matching resource right for non-admin Scrum updates/deletes and keeps private Log data owner-only even for administrators.
2. `PMT_1.11_to_1.12.sql` stops silent Project-code substitution and allows an administrator to explicitly reclaim a code held by an archived Project without deleting that Project or its related data.
3. `PMT_1.12_to_1.13.sql` adds administrator-only Maintenance preview/purge procedures and a final upload-reference recheck without deleting any data during migration.
4. `PMT_1.13_to_1.14.sql` makes private Documentation and private Logs owner-only throughout the application SQL contract, including for administrators, without changing or deleting existing content.
5. `PMT_1.14_to_1.15.sql` adds the permanent PMT About 3D visualization and flyby seed Documentation without changing or deleting existing content. It requires exactly one owned PMT seed Project and stops for investigation if the seed title already exists, including as a deleted row, instead of overwriting user data.

The deployed baseline is not considered upgraded to Version 1.15 until all five migrations are actually applied and verified on each instance. Start with the migration immediately after the version already installed on that instance.

For the July 15, 2026 BDO deployment, follow the self-contained `2026-07-15 - PMT - BDO Migration Scripts.html` runbook. It packages, hashes, runs, and verifies the complete Version 1.10 through 1.15 path, including the expected single Documentation and Created-history addition. Keep PMT offline for the complete chain; the intermediate database versions are not approved application states.

A valid historical Version 1.10 database has `PMT_SecurityRoleDefaultsVersion = 1.10` and may have no `PMT_DatabaseVersion` property. `PMT_1.10_to_1.11.sql` intentionally accepts that state and creates the overall version property as `1.11`. Verify `1.11`, `1.12`, `1.13`, `1.14`, and `1.15` after their respective scripts. If preflight instead finds a partial Version 1.11 through 1.14 deployment, stop and investigate before resuming only with the immediately following script. Do not manually edit a version property.

Run the migration in SQLCMD mode so any guard or SQL error stops the deployment immediately. From a Windows-authenticated command prompt:

```powershell
sqlcmd -S "<SQL SERVER OR SQL SERVER\\INSTANCE>" -d PMT -E -b -I -i "PMT_1.10_to_1.11.sql"
sqlcmd -S "<SQL SERVER OR SQL SERVER\\INSTANCE>" -d PMT -E -b -I -i "PMT_1.11_to_1.12.sql"
sqlcmd -S "<SQL SERVER OR SQL SERVER\\INSTANCE>" -d PMT -E -b -I -i "PMT_1.12_to_1.13.sql"
sqlcmd -S "<SQL SERVER OR SQL SERVER\\INSTANCE>" -d PMT -E -b -I -i "PMT_1.13_to_1.14.sql"
sqlcmd -S "<SQL SERVER OR SQL SERVER\\INSTANCE>" -d PMT -E -b -I -i "PMT_1.14_to_1.15.sql"
```

In SQL Server Management Studio, enable **Query > SQLCMD Mode** before running the file.

Do not rerun the historical Version 1.3 through 1.10 chain on current installations. Those scripts remain in this folder only as immutable release history and for controlled reconstruction of an older database.

Never run the rebuild, create, stored-procedure, or seed scripts against an existing BDO database. They are for fresh disposable databases, not production upgrades.

Every future SQL, database-contract, or database-backed stability change must add a migration script here, named like:

```text
PMT_1.10_to_1.11.sql
PMT_1.11_to_1.12.sql
PMT_1.12_to_1.13.sql
PMT_1.13_to_1.14.sql
PMT_1.14_to_1.15.sql
```

Rebuild scripts are for fresh databases. Migration scripts are for upgrading BDO and other existing user databases without losing data or destabilizing the deployed application.

See `docs/database-versioning.md`.
