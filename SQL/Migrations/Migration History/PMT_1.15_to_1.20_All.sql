/*
    PMT combined database migration: Version 1.15 -> 1.20

    Historical runner retained after Version 1.21 superseded it. Run the
    active PMT_1.15_to_1.21_All.sql runner for a Version 1.15 deployment.
*/

:on error exit

:r "..\PMT_1.15_to_1.16.sql"
:r "..\PMT_1.16_to_1.17.sql"
:r "..\PMT_1.17_to_1.18.sql"
:r "..\PMT_1.18_to_1.19.sql"
:r "..\PMT_1.19_to_1.20.sql"

PRINT N'Historical PMT combined database migration 1.15 to 1.20 completed.';
GO
