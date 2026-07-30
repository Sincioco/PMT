/*
    PMT Database Version 1.27 -> 1.28

    This release changes browser-side Diagram and rich-text editor behavior but
    does not change PMT tables, stored procedures, seed data, or user data.
    The migration advances only the database release marker so deployment can
    use one explicit, guarded Version 1.27 -> 1.28 path.
*/

USE [PMT];
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF SCHEMA_ID(N'pmt') IS NULL
   OR OBJECT_ID(N'[pmt].[Users]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[Blogs]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[Suggestions]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[PublicBlogLinks]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[GetAppState]', N'P') IS NULL
BEGIN
    THROW 51190, 'PMT Database Version 1.27 objects are required before applying Version 1.28.', 1;
END;

DECLARE @CurrentDatabaseVersion NVARCHAR(20) =
(
    SELECT CONVERT(NVARCHAR(20), [value])
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_DatabaseVersion'
);

IF ISNULL(@CurrentDatabaseVersion, N'') NOT IN (N'1.27', N'1.28')
BEGIN
    THROW 51191, 'PMT Database Version 1.27 is required before applying Version 1.28.', 1;
END;

IF @CurrentDatabaseVersion = N'1.27'
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        EXEC sys.sp_updateextendedproperty
            @name = N'PMT_DatabaseVersion',
            @value = N'1.28';

        IF NOT EXISTS
        (
            SELECT 1
            FROM sys.extended_properties
            WHERE [class] = 0
              AND [name] = N'PMT_DatabaseVersion'
              AND CONVERT(NVARCHAR(20), [value]) = N'1.28'
        )
        BEGIN
            THROW 51192, 'PMT Database Version 1.28 could not be verified.', 1;
        END;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;

IF NOT EXISTS
(
    SELECT 1
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_DatabaseVersion'
      AND CONVERT(NVARCHAR(20), [value]) = N'1.28'
)
BEGIN
    THROW 51193, 'PMT Database Version 1.28 release marker could not be verified.', 1;
END;

PRINT N'PMT Database Version 1.28 migration completed without schema or data changes.';
GO
