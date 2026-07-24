/*
    PMT combined database migration: Version 1.26 -> 1.27
    Run this file from the SQL\Migrations folder with SQLCMD mode enabled.
*/

:on error exit

:r ".\PMT_1.26_to_1.27.sql"

PRINT N'PMT combined database migration 1.26 to 1.27 completed.';
GO
