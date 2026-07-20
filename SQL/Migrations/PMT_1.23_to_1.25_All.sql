/*
    PMT combined database migration: Version 1.23 -> 1.25
*/

:on error exit

:r ".\PMT_1.23_to_1.24.sql"
:r ".\PMT_1.24_to_1.25.sql"

PRINT N'PMT combined database migration 1.23 to 1.25 completed.';
