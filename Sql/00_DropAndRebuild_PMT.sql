/*
    00_DropAndRebuild_PMT.sql

    Purpose:
    Drops the existing PMT database, recreates it at the current Version 1.13,
    creates stored procedures, and loads seed/demo data using the companion scripts.

    IMPORTANT:
    This script uses SQLCMD :r include commands and stops on the first error.

    How to run:
    1. Put this file in the same folder as:
       - 01_CreateDatabase.sql
       - 02_CreateStoredProcedures.sql
       - 03_SeedData.sql
       - 03_SeedData_LMS.sql
       - 03_SeedData_HLS.sql
    2. In SQL Server Management Studio, enable Query > SQLCMD Mode.
    3. Run this script while connected to the SQL Server instance.

    WARNING:
    This permanently drops and recreates the PMT database.
*/

:on error exit

USE [master];
GO

IF DB_ID(N'PMT') IS NOT NULL
BEGIN
    ALTER DATABASE [PMT] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE [PMT];
END;
GO

PRINT N'PMT database dropped if it existed.';
GO

:r "D:\Project Management Tool (PMT)\Sql\01_CreateDatabase.sql"
GO

:r "D:\Project Management Tool (PMT)\Sql\02_CreateStoredProcedures.sql"
GO

:r "D:\Project Management Tool (PMT)\Sql\03_SeedData.sql"
GO

:r "D:\Project Management Tool (PMT)\Sql\03_SeedData_LMS.sql"
GO

:r "D:\Project Management Tool (PMT)\Sql\03_SeedData_HLS.sql"
GO

USE [PMT];
GO

IF EXISTS
(
    SELECT 1
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_DatabaseVersion'
)
BEGIN
    EXEC sys.sp_updateextendedproperty
        @name = N'PMT_DatabaseVersion',
        @value = N'1.13';
END
ELSE
BEGIN
    EXEC sys.sp_addextendedproperty
        @name = N'PMT_DatabaseVersion',
        @value = N'1.13';
END;
GO

PRINT N'PMT database rebuild completed successfully.';
GO
