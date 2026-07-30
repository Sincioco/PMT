/*
    PMT combined database migration: Version 1.27 -> 1.28
    Run this file from SQL\Migrations with SQLCMD mode enabled.
*/

:on error exit

:r ".\PMT_1.27_to_1.28.sql"

PRINT N'PMT combined database migration 1.27 to 1.28 completed.';
GO
