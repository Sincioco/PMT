# PMT SQL Migrations

As of July 13, 2026, PMT Database Version 1.3 is the baseline for the live BDO deployment and all other known PMT installations.

All known installations are current. Future migrations start from Version 1.3 or the immediately preceding deployed version; new compatibility work for versions before 1.3 is not required. Keep the existing pre-1.3 migrations unchanged as historical release artifacts.

The current source schema is Version 1.8. Apply these migrations in order to upgrade the deployed Version 1.3 database:

1. `PMT_1.3_to_1.4.sql` adds internal user invitations.
2. `PMT_1.4_to_1.5.sql` adds the SA, TL, PM, QA - Manual, QA - Automation, and TM user roles.
3. `PMT_1.5_to_1.6.sql` adds Settings-based Role management and stable role codes.
4. `PMT_1.6_to_1.7.sql` adds role defaults, explicit user permission overrides, resource-level enforcement, and administrator password resets.
5. `PMT_1.7_to_1.8.sql` adds safe attachment deletion for work items and Documentation.

The BDO baseline is not considered upgraded until all five migrations are actually deployed and verified.

Every future SQL, database-contract, or database-backed stability change must add a migration script here, named like:

```text
PMT_1.3_to_1.4.sql
PMT_1.4_to_1.5.sql
PMT_1.5_to_1.6.sql
PMT_1.6_to_1.7.sql
PMT_1.7_to_1.8.sql
```

Rebuild scripts are for fresh databases. Migration scripts are for upgrading BDO and other existing user databases without losing data or destabilizing the deployed application.

See `docs/database-versioning.md`.
