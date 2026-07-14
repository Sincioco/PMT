/*
    PMT Database Version 1.10 -> 1.11

    Enforces Dev Log ownership at the database contract:
    - non-admin users may update/delete only their own shared Scrum entries;
    - administrators may manage any shared Scrum entry;
    - private Log entries remain owner-only, including for administrators.

    This migration changes stored procedures only. It does not modify or delete data.
*/

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

IF OBJECT_ID(N'[pmt].[DevLogs]', N'U') IS NULL
   OR COL_LENGTH(N'pmt.DevLogs', N'LogType') IS NULL
   OR NOT EXISTS
   (
       SELECT 1
       FROM sys.extended_properties
       WHERE [class] = 0
         AND [name] = N'PMT_SecurityRoleDefaultsVersion'
         AND CONVERT(NVARCHAR(20), [value]) = N'1.10'
   )
BEGIN
    THROW 50130, 'PMT Database Version 1.10 is required before applying Version 1.11.', 1;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[RequireDevLogPermission]
    @CurrentUserId INT,
    @DevLogId INT,
    @Right NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @LogType NVARCHAR(20);
    DECLARE @OwnerUserId INT;
    DECLARE @CurrentUserIsAdmin BIT = [pmt].[IsAdmin](@CurrentUserId);

    SELECT
        @LogType = [LogType],
        @OwnerUserId = [UserId]
    FROM [pmt].[DevLogs]
    WHERE [DevLogId] = @DevLogId
      AND [IsDeleted] = 0;

    IF @LogType IS NULL
    BEGIN
        THROW 50122, 'Log was not found.', 1;
    END;

    IF @LogType = N'Log' AND @OwnerUserId <> @CurrentUserId
    BEGIN
        THROW 50128, 'Private Log entries can only be changed by their owner.', 1;
    END;

    IF @LogType = N'Scrum' AND @CurrentUserIsAdmin = 0 AND @OwnerUserId <> @CurrentUserId
    BEGIN
        THROW 50129, 'Scrum entries can only be changed by their owner or an administrator.', 1;
    END;

    DECLARE @ResourceKey NVARCHAR(40) = CASE WHEN @LogType = N'Log' THEN N'PersonalLog' ELSE N'Scrum' END;
    EXEC [pmt].[RequirePermission] @CurrentUserId, @ResourceKey, @Right;
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

    IF @CurrentUserIsAdmin = 0
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
            [IsPinned] = CASE WHEN @CurrentUserIsAdmin = 1 THEN @IsPinned ELSE [IsPinned] END,
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

CREATE OR ALTER PROCEDURE [pmt].[DeleteDevLog]
    @DevLogId INT,
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @OwnerUserId INT;
    DECLARE @ExistingLogType NVARCHAR(20);
    DECLARE @ExistingLogDateOnly DATE;
    DECLARE @CurrentUserIsAdmin BIT = [pmt].[IsAdmin](@CurrentUserId);

    SELECT
        @OwnerUserId = [UserId],
        @ExistingLogType = [LogType],
        @ExistingLogDateOnly = CONVERT(DATE, [LogDate])
    FROM [pmt].[DevLogs]
    WHERE [DevLogId] = @DevLogId
      AND [IsDeleted] = 0;

    IF @OwnerUserId IS NULL
    BEGIN
        THROW 50063, 'Dev log was not found.', 1;
    END;

    IF @ExistingLogType = N'Log' AND @OwnerUserId <> @CurrentUserId
    BEGIN
        THROW 50067, 'You cannot delete another user''s log.', 1;
    END;

    IF @ExistingLogType = N'Scrum'
       AND @CurrentUserIsAdmin = 0
       AND @OwnerUserId <> @CurrentUserId
    BEGIN
        THROW 50064, 'You cannot delete another user''s Scrum entry.', 1;
    END;

    IF @CurrentUserIsAdmin = 0
       AND @ExistingLogType = N'Scrum'
       AND @ExistingLogDateOnly < DATEADD(DAY, -31, CONVERT(DATE, SYSUTCDATETIME()))
    BEGIN
        THROW 50066, 'Scrum entries older than 31 days are read-only for users.', 1;
    END;

    UPDATE [pmt].[DevLogs]
    SET [IsDeleted] = 1,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [DevLogId] = @DevLogId;

    EXEC [pmt].[WriteAudit] N'DevLog', @DevLogId, N'Deleted', N'Dev log hidden from active views.', @CurrentUserId;
END;
GO

PRINT N'PMT Database Version 1.11 applied: Scrum ownership is enforced and private Logs remain owner-only.';
GO
