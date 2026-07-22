/*
    PMT combined database migration: Version 1.25 -> 1.26
    Run this file from the SQL\Migrations folder with SQLCMD mode enabled.
*/

:on error exit

:r ".\PMT_1.25_to_1.26.sql"

PRINT N'PMT combined database migration 1.25 to 1.26 completed.';
GO
