# PMT SQL Migrations

As of July 15, 2026, the latest PMT release and its current Version 1.15 database schema have been deployed to BDO. Every BDO and other known PMT instance is on Version 1.15, which is now the deployed baseline.

Future migrations start from Version 1.15 or the immediately preceding deployed version. New compatibility work for versions before 1.15 is not required. Keep the existing migrations, combined wrappers, and deployment runbooks through Version 1.15 unchanged as historical release artifacts.

The deployed baseline remains Version 1.15, while the current source schema and fresh rebuild represent Version 1.22. The active release applies Version 1.16 attendance and vacation storage, Version 1.17 `ROWVERSION` save-collision protection, Version 1.18 authorized Scrum pinning, Version 1.19 actor-aware audit records for server-controlled administrator impersonation and the Settings Audit Trail, Version 1.20 public seed Documentation plus transactional Project-code synchronization, Version 1.21 field-specific linked Dev Task/Bug synchronization plus the Developer-role `QA Passed` status ceiling, and Version 1.22 successful-login timestamps plus preserved administrator Role titles. `PMT_SecurityRoleDefaultsVersion` remains `1.10` because none of these steps changes Role permission defaults. Do not manually edit either version property.

## Historical Version 1.10 to 1.15 Deployment

The five `Migration History/PMT_1.10_to_1.11.sql` through `Migration History/PMT_1.14_to_1.15.sql` files and `Migration History/2026-07-15 - PMT - BDO Migration Scripts.html` record the completed July 15 deployment from the former Version 1.10 baseline. They remain available as immutable release history and for controlled reconstruction only.

Do not rerun the Version 1.10-to-1.15 chain, `Migration History/PMT_1.3_to_1.10_All.sql`, or any earlier historical migration on a current Version 1.15 installation. Never run the rebuild, create, stored-procedure, or seed scripts against an existing BDO database. Those scripts are for fresh disposable databases, not production upgrades.

All completed migration scripts and HTML runbooks live under `Migration History/`. When a newer version becomes the declared deployed baseline, move every migration and runbook ending at or before that version into that folder automatically. Leave only the migrations needed from the current deployed baseline to the current source version, plus the combined operator runner, in this directory.

## Active Version 1.15 to 1.22 Deployment

`PMT_1.15_to_1.16.sql` is the canonical attendance/vacation step. `PMT_1.16_to_1.17.sql` adds opaque edit-version columns, focused collision procedures, aggregate write locks, and safe concurrent WFH-row initialization without changing existing business values. `PMT_1.17_to_1.18.sql` allows authorized non-administrators to pin their own Scrum entries without changing existing rows or private Personal Log pinning. `PMT_1.18_to_1.19.sql` preserves existing audit rows while backfilling their effective user as the actor and installs the server-controlled impersonation/Audit Trail contract. `PMT_1.19_to_1.20.sql` changes only the exact known seed Documentation rows to public, preserves all other private Documentation, repairs existing Sprint/work-item prefix mismatches, and installs the transactional Project-code synchronization procedure. `PMT_1.20_to_1.21.sql` preserves existing data while replacing the old RCA append/bidirectional rule with Dev Task-to-Bug replacement, copying Bug URLs to linked Bug Fix Dev Tasks, and preventing Developer-role users from saving Dev Task statuses ordered after `QA Passed`. `PMT_1.21_to_1.22.sql` records successful password and invitation logins without advancing `Users.RowVersion`, exposes those timestamps to User cards, and stops administrator access from replacing the user's configured Role; exact legacy `Admin` Role values are changed to the prior `Developer` fallback because no separate title survived the old overwrite. Because BDO starts at Version 1.15 and this release contains seven steps, the deployment operator must run `PMT_1.15_to_1.22_All.sql` from this directory in SQLCMD mode and let it finish successfully before starting the matching Version 1.22 application. Do not run the seven step scripts manually during the normal deployment. Superseded combined runners through Version 1.21 are retained under `Migration History/`.

## Future Migrations

Every future SQL, database-contract, or database-backed stability change must add a forward migration script here. Use one canonical file per database-version step, named like:

```text
PMT_1.15_to_1.16.sql
PMT_1.16_to_1.17.sql
PMT_1.17_to_1.18.sql
PMT_1.18_to_1.19.sql
PMT_1.19_to_1.20.sql
PMT_1.20_to_1.21.sql
PMT_1.21_to_1.22.sql
```

If one deployment requires two or more versioned migrations, always add a combined `PMT_<start>_to_<end>_All.sql` SQLCMD runner. Keep the version-step files canonical, and make the combined file use `:on error exit` plus ordered relative `:r` includes. For the active seven-step chain above, `PMT_1.15_to_1.22_All.sql` is the operator-facing runner. The deployment operator runs that one combined file instead of running the constituent files one by one.

Run the selected migration or combined runner in SQLCMD mode so any guard or SQL error stops the deployment immediately:

```powershell
sqlcmd -S "<SQL SERVER OR SQL SERVER\\INSTANCE>" -d PMT -E -b -I -i "<migration-or-combined-file>.sql"
```

In SQL Server Management Studio, enable **Query > SQLCMD Mode** before running the file. Rebuild scripts are for fresh databases. Migration scripts are for upgrading BDO and other existing user databases without losing data or destabilizing the deployed application.

See `docs/database-versioning.md`.
