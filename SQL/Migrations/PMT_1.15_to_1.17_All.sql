/*
    PMT combined database migration: Version 1.15 -> 1.17

    Run this file in SQLCMD mode from the SQL\Migrations directory.
*/

:on error exit

:r ".\PMT_1.15_to_1.16.sql"
:r ".\PMT_1.16_to_1.17.sql"

PRINT N'PMT combined database migration 1.15 to 1.17 completed.';
GO
