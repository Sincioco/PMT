/*
    PMT Database Version 1.17 -> 1.18

    Allows non-administrators to pin or unpin their own Scrum entries when
    they already have the matching Scrum save right. Private Personal Log
    pinning remains administrator-only. Existing rows and values are preserved.
*/

:on error exit

SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
GO

USE [PMT];
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF SCHEMA_ID(N'pmt') IS NULL
   OR OBJECT_ID(N'[pmt].[DevLogs]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[IsAdmin]', N'FN') IS NULL
   OR OBJECT_ID(N'[pmt].[WriteAudit]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[UpsertDevLog]', N'P') IS NULL
BEGIN
    THROW 51020, 'PMT Database Version 1.17 objects are required before applying Version 1.18.', 1;
END;
GO

DECLARE @DatabaseVersion NVARCHAR(20) =
(
    SELECT CONVERT(NVARCHAR(20), [value])
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_DatabaseVersion'
);

IF ISNULL(@DatabaseVersion, N'') NOT IN (N'1.17', N'1.18')
BEGIN
    THROW 51021, 'PMT Database Version 1.17 is required before applying Version 1.18.', 1;
END;

IF @DatabaseVersion = N'1.18'
   AND
   (
       OBJECT_ID(N'[pmt].[UpsertDevLog]', N'P') IS NULL
       OR CHARINDEX(N'@CurrentUserIsAdmin = 0 AND @LogType = N''Log''', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[UpsertDevLog]'))) = 0
       OR CHARINDEX(N'@CurrentUserIsAdmin = 1 OR @ExistingLogType = N''Scrum''', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[UpsertDevLog]'))) = 0
   )
BEGIN
    THROW 51022, 'PMT Database Version 1.18 is recorded, but its Scrum pinning contract is incomplete. Investigate before continuing.', 1;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[UpsertDevLog]
    @DevLogId INT OUTPUT,
    @LogDate DATETIME2(0),
    @BodyHtml NVARCHAR(MAX),
    @ProjectId INT,
    @IsPinned BIT,
    @CurrentUserId INT,
    @AuditContext NVARCHAR(80) = NULL,
    @LogType NVARCHAR(20) = N'Scrum',
    @Category NVARCHAR(60) = N'General'
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @IsImport BIT = CASE WHEN LOWER(LTRIM(RTRIM(ISNULL(@AuditContext, N'')))) = N'import' THEN 1 ELSE 0 END;
    DECLARE @OwnerUserId INT;
    DECLARE @ExistingLogType NVARCHAR(20);
    DECLARE @ProjectStartDate DATE;
    DECLARE @LogDateOnly DATE;
    DECLARE @ExistingLogDateOnly DATE;
    DECLARE @CurrentUserIsAdmin BIT = [pmt].[IsAdmin](@CurrentUserId);

    SET @LogType = CASE
        WHEN LOWER(LTRIM(RTRIM(ISNULL(@LogType, N'')))) = N'log' THEN N'Log'
        ELSE N'Scrum'
    END;
    SET @Category = NULLIF(LTRIM(RTRIM(@Category)), N'');
    IF @Category IS NULL SET @Category = N'General';

    IF NULLIF(LTRIM(RTRIM(@BodyHtml)), N'') IS NULL
    BEGIN
        THROW 50060, 'Dev log text is required.', 1;
    END;

    IF @LogDate < '2000-01-01' AND @CurrentUserIsAdmin = 0 AND @LogType = N'Scrum'
    BEGIN
        SET @LogDate = CONVERT(DATE, SYSUTCDATETIME());
    END;

    SET @LogDateOnly = CONVERT(DATE, @LogDate);

    IF @CurrentUserIsAdmin = 0 AND @LogType = N'Scrum'
    BEGIN
        IF @ProjectId IS NOT NULL
        BEGIN
            SELECT @ProjectStartDate = CONVERT(DATE, [StartDate])
            FROM [pmt].[Projects]
            WHERE [ProjectId] = @ProjectId
              AND [IsArchived] = 0;

            IF @ProjectStartDate IS NOT NULL AND @LogDateOnly < @ProjectStartDate
            BEGIN
                THROW 50063, 'Scrum entries cannot be dated before the project start date.', 1;
            END;
        END;

        IF @LogDateOnly < DATEADD(DAY, -14, CONVERT(DATE, SYSUTCDATETIME()))
        BEGIN
            THROW 50065, 'Scrum entries cannot be dated more than 2 weeks in the past.', 1;
        END;

        IF @LogDateOnly > DATEADD(DAY, 1, CONVERT(DATE, SYSUTCDATETIME()))
        BEGIN
            THROW 50064, 'Scrum entries cannot be dated more than 1 day in the future.', 1;
        END;
    END;

    IF @CurrentUserIsAdmin = 0 AND @LogType = N'Log'
    BEGIN
        SET @IsPinned = 0;
    END;

    IF @DevLogId = 0
    BEGIN
        INSERT INTO [pmt].[DevLogs]
        (
            [LogType],
            [Category],
            [ProjectId],
            [UserId],
            [LogDate],
            [BodyHtml],
            [IsPinned],
            [CreatedByUserId],
            [CreatedAt],
            [UpdatedAt]
        )
        VALUES
        (
            @LogType,
            @Category,
            @ProjectId,
            @CurrentUserId,
            @LogDate,
            @BodyHtml,
            @IsPinned,
            @CurrentUserId,
            @Now,
            @Now
        );

        SET @DevLogId = SCOPE_IDENTITY();
        EXEC [pmt].[WriteAudit] N'DevLog', @DevLogId, N'Created', N'Dev log created.', @CurrentUserId;
    END
    ELSE
    BEGIN
        SELECT
            @OwnerUserId = [UserId],
            @ExistingLogType = [LogType],
            @ExistingLogDateOnly = CONVERT(DATE, [LogDate])
        FROM [pmt].[DevLogs]
        WHERE [DevLogId] = @DevLogId
          AND [IsDeleted] = 0;

        IF @OwnerUserId IS NULL
        BEGIN
            THROW 50061, 'Dev log was not found.', 1;
        END;

        IF @ExistingLogType <> @LogType
        BEGIN
            THROW 50067, 'This dev log type cannot be changed.', 1;
        END;

        IF @ExistingLogType = N'Log' AND @OwnerUserId <> @CurrentUserId
        BEGIN
            THROW 50068, 'You cannot edit another user''s log.', 1;
        END;

        IF @ExistingLogType = N'Scrum'
           AND @CurrentUserIsAdmin = 0
           AND @OwnerUserId <> @CurrentUserId
        BEGIN
            THROW 50062, 'You cannot edit another user''s Scrum entry.', 1;
        END;

        IF @CurrentUserIsAdmin = 0
           AND @ExistingLogType = N'Scrum'
           AND @ExistingLogDateOnly < DATEADD(DAY, -31, CONVERT(DATE, SYSUTCDATETIME()))
        BEGIN
            THROW 50066, 'Scrum entries older than 31 days are read-only for users.', 1;
        END;

        UPDATE [pmt].[DevLogs]
        SET
            [ProjectId] = @ProjectId,
            [Category] = @Category,
            [LogDate] = @LogDate,
            [BodyHtml] = @BodyHtml,
            [IsPinned] = CASE
                WHEN @CurrentUserIsAdmin = 1 OR @ExistingLogType = N'Scrum' THEN @IsPinned
                ELSE [IsPinned]
            END,
            [UpdatedByUserId] = @CurrentUserId,
            [UpdatedAt] = @Now
        WHERE [DevLogId] = @DevLogId;

        IF @IsImport = 1
        BEGIN
            EXEC [pmt].[WriteAudit] N'DevLog', @DevLogId, N'Imported', N'Scrum entry updated by import process.', @CurrentUserId;
        END
        ELSE
        BEGIN
            EXEC [pmt].[WriteAudit] N'DevLog', @DevLogId, N'Updated', N'Dev log updated.', @CurrentUserId;
        END;
    END;
END;
GO

IF OBJECT_ID(N'[pmt].[UpsertDevLog]', N'P') IS NULL
   OR CHARINDEX(N'@CurrentUserIsAdmin = 0 AND @LogType = N''Log''', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[UpsertDevLog]'))) = 0
   OR CHARINDEX(N'@CurrentUserIsAdmin = 1 OR @ExistingLogType = N''Scrum''', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[UpsertDevLog]'))) = 0
BEGIN
    THROW 51023, 'PMT Version 1.18 Scrum pinning contract could not be verified. The database version was not changed.', 1;
END;
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
        @value = N'1.18';
END
ELSE
BEGIN
    EXEC sys.sp_addextendedproperty
        @name = N'PMT_DatabaseVersion',
        @value = N'1.18';
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_DatabaseVersion'
      AND CONVERT(NVARCHAR(20), [value]) = N'1.18'
)
BEGIN
    THROW 51024, 'PMT Database Version 1.18 could not be recorded.', 1;
END;
GO

PRINT N'PMT Database Version 1.18 applied: authorized Scrum owners can pin and unpin their entries.';
GO
