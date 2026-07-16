/*
    PMT Database Version 1.15 -> 1.16

    Adds Daily Scrum attendance and vacation planning without changing or
    backfilling existing PMT business data. The migration is safe to rerun
    only while the database version is 1.15 or the verified target 1.16.
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
   OR OBJECT_ID(N'[pmt].[Users]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[AuditEvents]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[SecurityResources]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[RequirePermission]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[WriteAudit]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[DevelopmentClearUsers]', N'P') IS NULL
BEGIN
    THROW 50278, 'PMT Database Version 1.15 objects are required before applying Version 1.16.', 1;
END;
GO

DECLARE @DatabaseVersion NVARCHAR(20) =
(
    SELECT CONVERT(NVARCHAR(20), [value])
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_DatabaseVersion'
);

IF ISNULL(@DatabaseVersion, N'') NOT IN (N'1.15', N'1.16')
BEGIN
    THROW 50279, 'PMT Database Version 1.15 is required before applying Version 1.16.', 1;
END;

IF @DatabaseVersion = N'1.16'
   AND
   (
       OBJECT_ID(N'[pmt].[AttendanceEntries]', N'U') IS NULL
       OR OBJECT_ID(N'[pmt].[VacationPlans]', N'U') IS NULL
       OR OBJECT_ID(N'[pmt].[GetAttendanceCalendar]', N'P') IS NULL
       OR OBJECT_ID(N'[pmt].[RecordAttendance]', N'P') IS NULL
       OR OBJECT_ID(N'[pmt].[UpsertVacation]', N'P') IS NULL
       OR OBJECT_ID(N'[pmt].[CancelVacation]', N'P') IS NULL
       OR COL_LENGTH(N'pmt.AttendanceEntries', N'AttendanceDate') IS NULL
       OR COL_LENGTH(N'pmt.AttendanceEntries', N'Status') IS NULL
       OR COL_LENGTH(N'pmt.VacationPlans', N'StartDate') IS NULL
       OR COL_LENGTH(N'pmt.VacationPlans', N'EndDate') IS NULL
       OR COL_LENGTH(N'pmt.VacationPlans', N'IsCancelled') IS NULL
       OR
          (
              SELECT COUNT(*)
              FROM sys.foreign_keys
              WHERE [parent_object_id] = OBJECT_ID(N'[pmt].[AttendanceEntries]')
                AND [name] IN
                (
                    N'FK_pmt_AttendanceEntries_User',
                    N'FK_pmt_AttendanceEntries_CreatedBy',
                    N'FK_pmt_AttendanceEntries_UpdatedBy'
                )
          ) <> 3
       OR
          (
              SELECT COUNT(*)
              FROM sys.foreign_keys
              WHERE [parent_object_id] = OBJECT_ID(N'[pmt].[VacationPlans]')
                AND [name] IN
                (
                    N'FK_pmt_VacationPlans_User',
                    N'FK_pmt_VacationPlans_CreatedBy',
                    N'FK_pmt_VacationPlans_UpdatedBy'
                )
          ) <> 3
       OR NOT EXISTS
          (
              SELECT 1
              FROM sys.indexes
              WHERE [object_id] = OBJECT_ID(N'[pmt].[AttendanceEntries]')
                AND [name] = N'UQ_pmt_AttendanceEntries_UserDateStatus'
                AND [is_unique] = 1
          )
       OR NOT EXISTS
          (
              SELECT 1
              FROM sys.check_constraints
              WHERE [parent_object_id] = OBJECT_ID(N'[pmt].[AttendanceEntries]')
                AND [name] = N'CK_pmt_AttendanceEntries_Status'
          )
       OR NOT EXISTS
          (
              SELECT 1
              FROM sys.check_constraints
              WHERE [parent_object_id] = OBJECT_ID(N'[pmt].[VacationPlans]')
                AND [name] = N'CK_pmt_VacationPlans_DateRange'
          )
       OR CHARINDEX(N'[pmt].[AttendanceEntries]', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[DevelopmentClearUsers]'))) = 0
       OR CHARINDEX(N'[pmt].[VacationPlans]', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[DevelopmentClearUsers]'))) = 0
   )
BEGIN
    THROW 50280, 'PMT Database Version 1.16 is recorded, but its attendance contract is incomplete. Investigate before continuing.', 1;
END;
GO

IF OBJECT_ID(N'[pmt].[AttendanceEntries]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[AttendanceEntries]
    (
        [AttendanceEntryId] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_pmt_AttendanceEntries] PRIMARY KEY,
        [UserId] INT NOT NULL,
        [AttendanceDate] DATE NOT NULL,
        [Status] NVARCHAR(20) NOT NULL,
        [CreatedByUserId] INT NOT NULL,
        [UpdatedByUserId] INT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_AttendanceEntries_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_AttendanceEntries_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_pmt_AttendanceEntries_User] FOREIGN KEY ([UserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_AttendanceEntries_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_AttendanceEntries_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [CK_pmt_AttendanceEntries_Status] CHECK ([Status] IN (N'Home', N'Office', N'Sick Leave', N'Vacation', N'EL', N'Other')),
        CONSTRAINT [UQ_pmt_AttendanceEntries_UserDateStatus] UNIQUE ([UserId], [AttendanceDate], [Status])
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_pmt_AttendanceEntries_DateStatusUser' AND [object_id] = OBJECT_ID(N'[pmt].[AttendanceEntries]'))
BEGIN
    CREATE INDEX [IX_pmt_AttendanceEntries_DateStatusUser]
        ON [pmt].[AttendanceEntries]([AttendanceDate], [Status], [UserId]);
END;
GO

IF OBJECT_ID(N'[pmt].[VacationPlans]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[VacationPlans]
    (
        [VacationPlanId] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_pmt_VacationPlans] PRIMARY KEY,
        [UserId] INT NOT NULL,
        [StartDate] DATE NOT NULL,
        [EndDate] DATE NOT NULL,
        [IsCancelled] BIT NOT NULL CONSTRAINT [DF_pmt_VacationPlans_IsCancelled] DEFAULT (0),
        [CreatedByUserId] INT NOT NULL,
        [UpdatedByUserId] INT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_VacationPlans_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_VacationPlans_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_pmt_VacationPlans_User] FOREIGN KEY ([UserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_VacationPlans_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_VacationPlans_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [CK_pmt_VacationPlans_DateRange] CHECK ([EndDate] >= [StartDate])
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_pmt_VacationPlans_ActiveDateRange' AND [object_id] = OBJECT_ID(N'[pmt].[VacationPlans]'))
BEGIN
    CREATE INDEX [IX_pmt_VacationPlans_ActiveDateRange]
        ON [pmt].[VacationPlans]([IsCancelled], [StartDate], [EndDate], [UserId]);
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[GetAttendanceCalendar]
    @StartDate DATE,
    @EndDate DATE,
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    EXEC [pmt].[RequirePermission] @CurrentUserId, N'Scrum', N'Read';

    IF @StartDate IS NULL OR @EndDate IS NULL OR @EndDate < @StartDate
    BEGIN
        THROW 50270, 'A valid attendance calendar date range is required.', 1;
    END;

    IF DATEDIFF(DAY, @StartDate, @EndDate) > 61
    BEGIN
        THROW 50271, 'The attendance calendar range cannot exceed 62 days.', 1;
    END;

    SELECT
        [Attendance].[AttendanceEntryId],
        [Attendance].[UserId],
        [Attendance].[AttendanceDate],
        [Attendance].[Status],
        [CreatedByUserId] = ISNULL([Attendance].[UpdatedByUserId], [Attendance].[CreatedByUserId]),
        [Attendance].[CreatedAt],
        [Attendance].[UpdatedAt]
    FROM [pmt].[AttendanceEntries] AS [Attendance]
    INNER JOIN [pmt].[Users] AS [User]
        ON [User].[UserId] = [Attendance].[UserId]
       AND [User].[IsActive] = 1
    WHERE [Attendance].[AttendanceDate] BETWEEN @StartDate AND @EndDate
    ORDER BY
        [Attendance].[AttendanceDate],
        [Attendance].[Status],
        [Attendance].[UserId],
        [Attendance].[AttendanceEntryId];

    SELECT
        [Vacation].[VacationPlanId],
        [Vacation].[UserId],
        [Vacation].[StartDate],
        [Vacation].[EndDate],
        [Vacation].[CreatedAt],
        [Vacation].[UpdatedAt]
    FROM [pmt].[VacationPlans] AS [Vacation]
    INNER JOIN [pmt].[Users] AS [User]
        ON [User].[UserId] = [Vacation].[UserId]
       AND [User].[IsActive] = 1
    WHERE [Vacation].[IsCancelled] = 0
      AND
      (
          ([Vacation].[StartDate] <= @EndDate AND [Vacation].[EndDate] >= @StartDate)
          OR [Vacation].[UserId] = @CurrentUserId
      )
    ORDER BY [Vacation].[StartDate], [Vacation].[EndDate], [Vacation].[UserId], [Vacation].[VacationPlanId];
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[RecordAttendance]
    @AttendanceEntryId INT OUTPUT,
    @UserId INT,
    @Status NVARCHAR(20),
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Status = CASE LOWER(LTRIM(RTRIM(ISNULL(@Status, N''))))
        WHEN N'home' THEN N'Home'
        WHEN N'office' THEN N'Office'
        WHEN N'sick leave' THEN N'Sick Leave'
        WHEN N'vacation' THEN N'Vacation'
        WHEN N'el' THEN N'EL'
        WHEN N'other' THEN N'Other'
        ELSE NULL
    END;

    IF @Status IS NULL
    BEGIN
        THROW 50272, 'Attendance must be Home, Office, Sick Leave, Vacation, EL, or Other.', 1;
    END;

    IF NOT EXISTS
    (
        SELECT 1
        FROM [pmt].[Users]
        WHERE [UserId] = @UserId
          AND [IsActive] = 1
    )
    BEGIN
        THROW 50273, 'The attendance user was not found or is inactive.', 1;
    END;

    DECLARE @RequiredRight NVARCHAR(20) = CASE WHEN @UserId = @CurrentUserId THEN N'Create' ELSE N'Update' END;
    EXEC [pmt].[RequirePermission] @CurrentUserId, N'Scrum', @RequiredRight;

    DECLARE @AttendanceDate DATE = CONVERT(DATE, DATEADD(HOUR, 8, SYSUTCDATETIME()));
    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @AttendanceEntryId = [AttendanceEntryId]
        FROM [pmt].[AttendanceEntries] WITH (UPDLOCK, HOLDLOCK)
        WHERE [UserId] = @UserId
          AND [AttendanceDate] = @AttendanceDate
          AND [Status] = @Status;

        IF ISNULL(@AttendanceEntryId, 0) = 0
        BEGIN
            INSERT INTO [pmt].[AttendanceEntries]
            (
                [UserId], [AttendanceDate], [Status], [CreatedByUserId], [CreatedAt], [UpdatedAt]
            )
            VALUES
            (
                @UserId, @AttendanceDate, @Status, @CurrentUserId, @Now, @Now
            );

            SET @AttendanceEntryId = SCOPE_IDENTITY();
        END
        ELSE
        BEGIN
            UPDATE [pmt].[AttendanceEntries]
            SET [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = @Now
            WHERE [AttendanceEntryId] = @AttendanceEntryId;
        END;

        DECLARE @AuditAction NVARCHAR(80) = CASE
            WHEN @UserId = @CurrentUserId THEN N'Checked In'
            ELSE N'Recorded On Behalf'
        END;
        DECLARE @AuditDetails NVARCHAR(400) =
            N'Attendance recorded as ' + @Status
            + N' for ' + CONVERT(NVARCHAR(10), @AttendanceDate, 23)
            + N' for user #' + CONVERT(NVARCHAR(20), @UserId) + N'.';

        EXEC [pmt].[WriteAudit]
            N'Attendance', @AttendanceEntryId, @AuditAction, @AuditDetails, @CurrentUserId;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[UpsertVacation]
    @VacationPlanId INT OUTPUT,
    @StartDate DATE,
    @EndDate DATE,
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @StartDate IS NULL OR @EndDate IS NULL OR @EndDate < @StartDate
    BEGIN
        THROW 50274, 'Vacation start and end dates are required, and the end date cannot be before the start date.', 1;
    END;

    DECLARE @RequiredRight NVARCHAR(20) = CASE WHEN ISNULL(@VacationPlanId, 0) = 0 THEN N'Create' ELSE N'Update' END;
    EXEC [pmt].[RequirePermission] @CurrentUserId, N'Scrum', @RequiredRight;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @OwnerUserId INT;
    DECLARE @AuditAction NVARCHAR(80);
    DECLARE @AuditDetails NVARCHAR(400);

    BEGIN TRY
        BEGIN TRANSACTION;

        IF ISNULL(@VacationPlanId, 0) <> 0
        BEGIN
            SELECT @OwnerUserId = [UserId]
            FROM [pmt].[VacationPlans] WITH (UPDLOCK, HOLDLOCK)
            WHERE [VacationPlanId] = @VacationPlanId
              AND [IsCancelled] = 0;

            IF @OwnerUserId IS NULL
            BEGIN
                THROW 50275, 'The vacation plan was not found or has already been cancelled.', 1;
            END;

            IF @OwnerUserId <> @CurrentUserId
            BEGIN
                THROW 50276, 'Vacation plans can only be changed by their owner.', 1;
            END;
        END
        ELSE
        BEGIN
            SET @OwnerUserId = @CurrentUserId;
        END;

        IF EXISTS
        (
            SELECT 1
            FROM [pmt].[VacationPlans] WITH (UPDLOCK, HOLDLOCK)
            WHERE [UserId] = @OwnerUserId
              AND [IsCancelled] = 0
              AND [VacationPlanId] <> ISNULL(@VacationPlanId, 0)
              AND [StartDate] <= @EndDate
              AND [EndDate] >= @StartDate
        )
        BEGIN
            THROW 50277, 'The vacation dates overlap another active vacation plan.', 1;
        END;

        IF ISNULL(@VacationPlanId, 0) = 0
        BEGIN
            INSERT INTO [pmt].[VacationPlans]
            (
                [UserId], [StartDate], [EndDate], [CreatedByUserId], [CreatedAt], [UpdatedAt]
            )
            VALUES
            (
                @CurrentUserId, @StartDate, @EndDate, @CurrentUserId, @Now, @Now
            );

            SET @VacationPlanId = SCOPE_IDENTITY();
            SET @AuditAction = N'Created';
            SET @AuditDetails = N'Vacation planned from ' + CONVERT(NVARCHAR(10), @StartDate, 23)
                + N' through ' + CONVERT(NVARCHAR(10), @EndDate, 23) + N'.';
        END
        ELSE
        BEGIN
            UPDATE [pmt].[VacationPlans]
            SET [StartDate] = @StartDate,
                [EndDate] = @EndDate,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = @Now
            WHERE [VacationPlanId] = @VacationPlanId;

            SET @AuditAction = N'Updated';
            SET @AuditDetails = N'Vacation changed to ' + CONVERT(NVARCHAR(10), @StartDate, 23)
                + N' through ' + CONVERT(NVARCHAR(10), @EndDate, 23) + N'.';
        END;

        EXEC [pmt].[WriteAudit]
            N'Vacation', @VacationPlanId, @AuditAction, @AuditDetails, @CurrentUserId;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[CancelVacation]
    @VacationPlanId INT,
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC [pmt].[RequirePermission] @CurrentUserId, N'Scrum', N'Update';

    DECLARE @OwnerUserId INT;

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @OwnerUserId = [UserId]
        FROM [pmt].[VacationPlans] WITH (UPDLOCK, HOLDLOCK)
        WHERE [VacationPlanId] = @VacationPlanId
          AND [IsCancelled] = 0;

        IF @OwnerUserId IS NULL
        BEGIN
            THROW 50275, 'The vacation plan was not found or has already been cancelled.', 1;
        END;

        IF @OwnerUserId <> @CurrentUserId
        BEGIN
            THROW 50276, 'Vacation plans can only be changed by their owner.', 1;
        END;

        UPDATE [pmt].[VacationPlans]
        SET [IsCancelled] = 1,
            [UpdatedByUserId] = @CurrentUserId,
            [UpdatedAt] = SYSUTCDATETIME()
        WHERE [VacationPlanId] = @VacationPlanId;

        EXEC [pmt].[WriteAudit]
            N'Vacation', @VacationPlanId, N'Cancelled', N'Vacation plan cancelled.', @CurrentUserId;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[DevelopmentClearUsers]
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 50110, 'Only an administrator can clear users.', 1;
    END;

    DECLARE @AdminUserId INT =
    (
        SELECT TOP (1) [UserId]
        FROM [pmt].[Users]
        WHERE [Email] = N'louiery@gmail.com'
           OR ([Nickname] = N'Sin' AND [IsAdmin] = 1)
        ORDER BY CASE WHEN [Email] = N'louiery@gmail.com' THEN 0 ELSE 1 END, [UserId]
    );

    IF @AdminUserId IS NULL
    BEGIN
        THROW 50111, 'The Sin administrator account was not found.', 1;
    END;

    BEGIN TRANSACTION;

    IF EXISTS
       (
           SELECT 1
           FROM [pmt].[DevLogs] WITH (UPDLOCK, HOLDLOCK)
           WHERE [LogType] = N'Log'
             AND [UserId] <> @AdminUserId
       )
       OR EXISTS
       (
           SELECT 1
           FROM [pmt].[Blogs] WITH (UPDLOCK, HOLDLOCK)
           WHERE [IsPrivate] = 1
             AND [CreatedByUserId] <> @AdminUserId
       )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50255, 'Users cannot be cleared while another user owns private content.', 1;
    END;

    DELETE [AuditEvent]
    FROM [pmt].[AuditEvents] AS [AuditEvent]
    INNER JOIN [pmt].[AttendanceEntries] AS [Attendance]
        ON [AuditEvent].[EntityType] = N'Attendance'
       AND [AuditEvent].[EntityId] = [Attendance].[AttendanceEntryId]
    WHERE [Attendance].[UserId] <> @AdminUserId;

    DELETE [AuditEvent]
    FROM [pmt].[AuditEvents] AS [AuditEvent]
    INNER JOIN [pmt].[VacationPlans] AS [Vacation]
        ON [AuditEvent].[EntityType] = N'Vacation'
       AND [AuditEvent].[EntityId] = [Vacation].[VacationPlanId]
    WHERE [Vacation].[UserId] <> @AdminUserId;

    DELETE FROM [pmt].[AttendanceEntries]
    WHERE [UserId] <> @AdminUserId;

    DELETE FROM [pmt].[VacationPlans]
    WHERE [UserId] <> @AdminUserId;

    UPDATE [pmt].[Users]
    SET
        [FirstName] = N'Louiery',
        [LastName] = N'Sincioco',
        [Nickname] = N'Sin',
        [Email] = N'louiery@gmail.com',
        [AvatarUrl] = N'/assets/avatar-sin.jpg?v=20260629-avatar-jpg-assets',
        [PasswordHash] = HASHBYTES('SHA2_256', CONVERT(NVARCHAR(4000), N'Password1')),
        [Bio] = N'PMT creator and administrator.',
        [IsAdmin] = 1,
        [Role] = N'Admin',
        [IsActive] = 1,
        [CreatedByUserId] = @AdminUserId,
        [UpdatedByUserId] = @AdminUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [UserId] = @AdminUserId;

    INSERT INTO [pmt].[ProjectMembers] ([ProjectId], [UserId], [CreatedByUserId])
    SELECT DISTINCT [ProjectId], @AdminUserId, @AdminUserId
    FROM [pmt].[ProjectMembers] AS [Source]
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM [pmt].[ProjectMembers] AS [Existing]
        WHERE [Existing].[ProjectId] = [Source].[ProjectId]
          AND [Existing].[UserId] = @AdminUserId
    );

    INSERT INTO [pmt].[SprintMembers] ([SprintId], [UserId], [CreatedByUserId])
    SELECT DISTINCT [SprintId], @AdminUserId, @AdminUserId
    FROM [pmt].[SprintMembers] AS [Source]
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM [pmt].[SprintMembers] AS [Existing]
        WHERE [Existing].[SprintId] = [Source].[SprintId]
          AND [Existing].[UserId] = @AdminUserId
    );

    INSERT INTO [pmt].[TaskAssignees] ([TaskId], [UserId], [CreatedByUserId])
    SELECT DISTINCT [TaskId], @AdminUserId, @AdminUserId
    FROM [pmt].[TaskAssignees] AS [Source]
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM [pmt].[TaskAssignees] AS [Existing]
        WHERE [Existing].[TaskId] = [Source].[TaskId]
          AND [Existing].[UserId] = @AdminUserId
    );

    INSERT INTO [pmt].[TaskReporters] ([TaskId], [UserId], [CreatedByUserId])
    SELECT DISTINCT [TaskId], @AdminUserId, @AdminUserId
    FROM [pmt].[TaskReporters] AS [Source]
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM [pmt].[TaskReporters] AS [Existing]
        WHERE [Existing].[TaskId] = [Source].[TaskId]
          AND [Existing].[UserId] = @AdminUserId
    );

    DELETE FROM [pmt].[ProjectMembers] WHERE [UserId] <> @AdminUserId;
    DELETE FROM [pmt].[SprintMembers] WHERE [UserId] <> @AdminUserId;
    DELETE FROM [pmt].[TaskAssignees] WHERE [UserId] <> @AdminUserId;
    DELETE FROM [pmt].[TaskReporters] WHERE [UserId] <> @AdminUserId;

    UPDATE [pmt].[ProjectMembers] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[SprintMembers] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[TaskAssignees] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[TaskReporters] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[TaskDependencies] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[TaskAttachments] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[BlogAttachments] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;

    UPDATE [pmt].[Projects] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[Sprints] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[WorkTasks] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[Attachments] SET [UploadedByUserId] = @AdminUserId, [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[DevLogs] SET [UserId] = @AdminUserId, [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[Blogs] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[BlogHistory] SET [UserId] = @AdminUserId, [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[AuditEvents] SET [UserId] = @AdminUserId, [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[Lookups] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[Holidays] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[WfhSchedules] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[AttendanceEntries] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[VacationPlans] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[Users] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;

    DELETE FROM [pmt].[WfhSchedules]
    WHERE [UserId] <> @AdminUserId;

    DELETE FROM [pmt].[Users]
    WHERE [UserId] <> @AdminUserId;

    EXEC [pmt].[WriteAudit]
        N'Development',
        0,
        N'Cleanup',
        N'Cleared users and remapped ownership to Sin.',
        @AdminUserId;

    COMMIT TRANSACTION;
END;
GO

IF OBJECT_ID(N'[pmt].[AttendanceEntries]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[VacationPlans]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[GetAttendanceCalendar]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[RecordAttendance]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[UpsertVacation]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[CancelVacation]', N'P') IS NULL
   OR COL_LENGTH(N'pmt.AttendanceEntries', N'AttendanceDate') IS NULL
   OR COL_LENGTH(N'pmt.AttendanceEntries', N'Status') IS NULL
   OR COL_LENGTH(N'pmt.VacationPlans', N'StartDate') IS NULL
   OR COL_LENGTH(N'pmt.VacationPlans', N'EndDate') IS NULL
   OR COL_LENGTH(N'pmt.VacationPlans', N'IsCancelled') IS NULL
   OR
      (
          SELECT COUNT(*)
          FROM sys.foreign_keys
          WHERE [parent_object_id] = OBJECT_ID(N'[pmt].[AttendanceEntries]')
            AND [name] IN
            (
                N'FK_pmt_AttendanceEntries_User',
                N'FK_pmt_AttendanceEntries_CreatedBy',
                N'FK_pmt_AttendanceEntries_UpdatedBy'
            )
      ) <> 3
   OR
      (
          SELECT COUNT(*)
          FROM sys.foreign_keys
          WHERE [parent_object_id] = OBJECT_ID(N'[pmt].[VacationPlans]')
            AND [name] IN
            (
                N'FK_pmt_VacationPlans_User',
                N'FK_pmt_VacationPlans_CreatedBy',
                N'FK_pmt_VacationPlans_UpdatedBy'
            )
      ) <> 3
   OR NOT EXISTS
      (
          SELECT 1
          FROM sys.indexes
          WHERE [object_id] = OBJECT_ID(N'[pmt].[AttendanceEntries]')
            AND [name] = N'UQ_pmt_AttendanceEntries_UserDateStatus'
            AND [is_unique] = 1
      )
   OR NOT EXISTS
      (
          SELECT 1
          FROM sys.indexes
          WHERE [object_id] = OBJECT_ID(N'[pmt].[AttendanceEntries]')
            AND [name] = N'IX_pmt_AttendanceEntries_DateStatusUser'
      )
   OR NOT EXISTS
      (
          SELECT 1
          FROM sys.indexes
          WHERE [object_id] = OBJECT_ID(N'[pmt].[VacationPlans]')
            AND [name] = N'IX_pmt_VacationPlans_ActiveDateRange'
      )
   OR NOT EXISTS
      (
          SELECT 1
          FROM sys.check_constraints
          WHERE [parent_object_id] = OBJECT_ID(N'[pmt].[AttendanceEntries]')
            AND [name] = N'CK_pmt_AttendanceEntries_Status'
      )
   OR NOT EXISTS
      (
          SELECT 1
          FROM sys.check_constraints
          WHERE [parent_object_id] = OBJECT_ID(N'[pmt].[VacationPlans]')
            AND [name] = N'CK_pmt_VacationPlans_DateRange'
      )
   OR CHARINDEX(N'[pmt].[AttendanceEntries]', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[DevelopmentClearUsers]'))) = 0
   OR CHARINDEX(N'[pmt].[VacationPlans]', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[DevelopmentClearUsers]'))) = 0
BEGIN
    THROW 50281, 'PMT Database Version 1.16 attendance objects could not be verified. The database version was not changed.', 1;
END;
GO

IF CONVERT(NVARCHAR(20),
    (
        SELECT [value]
        FROM sys.extended_properties
        WHERE [class] = 0
          AND [name] = N'PMT_DatabaseVersion'
    )) = N'1.15'
BEGIN
    EXEC sys.sp_updateextendedproperty
        @name = N'PMT_DatabaseVersion',
        @value = N'1.16';
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_DatabaseVersion'
      AND CONVERT(NVARCHAR(20), [value]) = N'1.16'
)
BEGIN
    THROW 50282, 'PMT Database Version 1.16 could not be recorded.', 1;
END;
GO

PRINT N'PMT Database Version 1.16 applied: Daily Scrum attendance, on-behalf check-in, calendar data, and vacation planning are available.';
GO
