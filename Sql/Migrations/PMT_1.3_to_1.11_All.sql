/*
    PMT_1.3_to_1.11_All.sql

    One-command SQLCMD runner for upgrading a PMT database from
    Database Version 1.3 to 1.11. Run this file from the Sql/Migrations folder.
    The eight versioned migration files remain the canonical migration history.
*/

:on error exit

:r ".\PMT_1.3_to_1.4.sql"
:r ".\PMT_1.4_to_1.5.sql"
:r ".\PMT_1.5_to_1.6.sql"
:r ".\PMT_1.6_to_1.7.sql"
:r ".\PMT_1.7_to_1.8.sql"
:r ".\PMT_1.8_to_1.9.sql"
:r ".\PMT_1.9_to_1.10.sql"
:r ".\PMT_1.10_to_1.11.sql"

PRINT N'PMT combined database migration 1.3 to 1.11 completed.';
GO
