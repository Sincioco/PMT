# PMT SQL Migrations

As of July 14, 2026, every BDO and other known PMT instance has successfully applied `PMT_1.3_to_1.10_All.sql`. PMT Database Version 1.10 is the deployed baseline.

Future migrations start from Version 1.10 or the immediately preceding deployed version. New compatibility work for versions before 1.10 is not required. Keep the existing migrations and combined wrappers through Version 1.10 unchanged as historical release artifacts.

The current source schema is Version 1.11. Apply this migration to every existing installation:

1. `PMT_1.10_to_1.11.sql` requires ownership plus the matching resource right for non-admin Scrum updates/deletes and keeps private Log data owner-only even for administrators.

The deployed baseline is not considered upgraded to Version 1.11 until this migration is actually applied and verified on each instance.

Run the migration in SQLCMD mode so any guard or SQL error stops the deployment immediately. From a Windows-authenticated command prompt:

```powershell
sqlcmd -S "<SQL SERVER OR SQL SERVER\\INSTANCE>" -d PMT -E -b -I -i "PMT_1.10_to_1.11.sql"
```

In SQL Server Management Studio, enable **Query > SQLCMD Mode** before running the file.

Do not rerun the historical Version 1.3 through 1.10 chain on current installations. Those scripts remain in this folder only as immutable release history and for controlled reconstruction of an older database.

Every future SQL, database-contract, or database-backed stability change must add a migration script here, named like:

```text
PMT_1.10_to_1.11.sql
PMT_1.11_to_1.12.sql
```

Rebuild scripts are for fresh databases. Migration scripts are for upgrading BDO and other existing user databases without losing data or destabilizing the deployed application.

See `docs/database-versioning.md`.
