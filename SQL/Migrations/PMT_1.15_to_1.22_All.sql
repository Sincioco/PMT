/*
    PMT combined database migration: Version 1.15 -> 1.22

    Run this file in SQLCMD mode from the SQL\Migrations directory.
*/

:on error exit

:r ".\PMT_1.15_to_1.16.sql"
:r ".\PMT_1.16_to_1.17.sql"
:r ".\PMT_1.17_to_1.18.sql"
:r ".\PMT_1.18_to_1.19.sql"
:r ".\PMT_1.19_to_1.20.sql"
:r ".\PMT_1.20_to_1.21.sql"
:r ".\PMT_1.21_to_1.22.sql"

PRINT N'PMT combined database migration 1.15 to 1.22 completed.';
GO
