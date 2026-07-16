/*
    PMT Database Version 1.22 -> 1.23

    One-time BDO Production migration:
    - Preserves the deployed PMT Project as PMTQA.
    - Recreates only missing original PMT demo identities.
    - Restores the original SQL-seeded PMT demo Project.
    - Preserves PMTQA during this migration, while post-deployment broad
      Development cleanup protects only the resettable PMT demo Project.
    - Makes future Clear PMT Demo -> Restore PMT Seed Data cycles repeatable.
    - Lets Development Clear Users and Factory Reset run even when users own
      private content; Clear Users remaps it to Sin and Factory Reset deletes it.
    - Lets On Behalf Of attendance use a selected date and supports audited
      removal of explicit attendance calendar entries.

    Run this file once with SQLCMD from the SQL/Migrations directory.
    Do not run SQL/03_SeedData.sql or Factory Reset PMT in Production.
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
   OR OBJECT_ID(N'[pmt].[Projects]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[Users]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[Sprints]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[WorkTasks]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[AttendanceEntries]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[UserPermissions]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[AuditEvents]', N'U') IS NULL
   OR COL_LENGTH(N'pmt.AuditEvents', N'ActorUserId') IS NULL
   OR OBJECT_ID(N'[pmt].[SynchronizeProjectCode]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[WriteAudit]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[RecordAttendance]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[DevelopmentClearNonPmt]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[DevelopmentClearPmt]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[DevelopmentClearUsers]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[RequireDevelopmentSeedRestore]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[LockBlogWrites]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[LockWorkTaskWrites]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[LockSprintWrites]', N'P') IS NULL
BEGIN
    THROW 51060, 'PMT Database Version 1.22 objects are required before applying Version 1.23.', 1;
END;
GO

DECLARE @DatabaseVersion NVARCHAR(20) =
(
    SELECT CONVERT(NVARCHAR(20), [value])
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_DatabaseVersion'
);

IF ISNULL(@DatabaseVersion, N'') <> N'1.22'
BEGIN
    THROW 51061, 'PMT Database Version 1.22 is required before applying Version 1.23.', 1;
END;
GO

IF (SELECT COUNT(*) FROM [pmt].[Projects] WHERE [Code] = N'PMT' AND [IsArchived] = 0) <> 1
BEGIN
    THROW 51062, 'Exactly one active PMT Project is required for the one-time PMTQA migration.', 1;
END;

IF EXISTS (SELECT 1 FROM [pmt].[Projects] WHERE [Code] = N'PMTQA')
BEGIN
    THROW 51063, 'Project code PMTQA is already in use. The one-time migration stopped without changing data.', 1;
END;

IF
(
    SELECT COUNT(*)
    FROM [pmt].[Users]
    WHERE [Email] = N'louiery@gmail.com'
      AND [IsAdmin] = 1
      AND [IsActive] = 1
) <> 1
BEGIN
    THROW 51064, 'Exactly one active Sin administrator is required for the PMT demo migration.', 1;
END;
GO

CREATE TABLE #Pmt122To123State
(
    [PmtProjectId] INT NOT NULL,
    [SinUserId] INT NOT NULL,
    [ProjectCount] INT NOT NULL,
    [SprintCount] INT NOT NULL,
    [TaskCount] INT NOT NULL,
    [UserCount] INT NOT NULL,
    [PmtMemberCount] INT NOT NULL,
    [PmtSprintCount] INT NOT NULL,
    [PmtTaskCount] INT NOT NULL
);

DECLARE @PmtProjectId INT =
(
    SELECT [ProjectId]
    FROM [pmt].[Projects]
    WHERE [Code] = N'PMT'
      AND [IsArchived] = 0
);
DECLARE @SinUserId INT =
(
    SELECT [UserId]
    FROM [pmt].[Users]
    WHERE [Email] = N'louiery@gmail.com'
      AND [IsAdmin] = 1
      AND [IsActive] = 1
);

INSERT INTO #Pmt122To123State
(
    [PmtProjectId], [SinUserId], [ProjectCount], [SprintCount], [TaskCount],
    [UserCount], [PmtMemberCount], [PmtSprintCount], [PmtTaskCount]
)
SELECT
    @PmtProjectId,
    @SinUserId,
    (SELECT COUNT(*) FROM [pmt].[Projects]),
    (SELECT COUNT(*) FROM [pmt].[Sprints]),
    (SELECT COUNT(*) FROM [pmt].[WorkTasks]),
    (SELECT COUNT(*) FROM [pmt].[Users]),
    (SELECT COUNT(*) FROM [pmt].[ProjectMembers] WHERE [ProjectId] = @PmtProjectId),
    (SELECT COUNT(*) FROM [pmt].[Sprints] WHERE [ProjectId] = @PmtProjectId),
    (SELECT COUNT(*) FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProjectId);

CREATE TABLE #MissingPmtDemoUsers
(
    [Email] NVARCHAR(180) NOT NULL PRIMARY KEY
);

INSERT INTO #MissingPmtDemoUsers ([Email])
VALUES
(N'bill.gates@microsoft.com'),
(N'sam.altman@openai.com'),
(N'mark.zuckerberg@meta.com'),
(N'steve.jobs@apple.com'),
(N'Jensen.Huang@nvidia.com');

DELETE [Missing]
FROM #MissingPmtDemoUsers AS [Missing]
WHERE EXISTS
(
    SELECT 1
    FROM [pmt].[Users] AS [Existing]
    WHERE LOWER(LTRIM(RTRIM([Existing].[Email]))) = LOWER([Missing].[Email])
);
GO

CREATE OR ALTER PROCEDURE [pmt].[RecordAttendance]
    @AttendanceEntryId INT OUTPUT,
    @UserId INT,
    @Status NVARCHAR(20),
    @CurrentUserId INT,
    @AttendanceDate DATE = NULL
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

    -- BDO and the PMT team use UTC+8. A user's own Check-In always records
    -- the current local workday. Only On Behalf Of may select another date.
    DECLARE @LocalToday DATE = CONVERT(DATE, DATEADD(HOUR, 8, SYSUTCDATETIME()));
    SET @AttendanceDate = CASE
        WHEN @UserId = @CurrentUserId THEN @LocalToday
        ELSE ISNULL(@AttendanceDate, @LocalToday)
    END;

    -- Timestamps remain UTC in the normal audit columns.
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
                [UserId],
                [AttendanceDate],
                [Status],
                [CreatedByUserId],
                [CreatedAt],
                [UpdatedAt]
            )
            VALUES
            (
                @UserId,
                @AttendanceDate,
                @Status,
                @CurrentUserId,
                @Now,
                @Now
            );

            SET @AttendanceEntryId = SCOPE_IDENTITY();
        END
        ELSE
        BEGIN
            UPDATE [pmt].[AttendanceEntries]
            SET
                [UpdatedByUserId] = @CurrentUserId,
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
            N'Attendance',
            @AttendanceEntryId,
            @AuditAction,
            @AuditDetails,
            @CurrentUserId;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[RemoveAttendance]
    @AttendanceEntryId INT,
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @UserId INT;
    DECLARE @AttendanceDate DATE;
    DECLARE @Status NVARCHAR(20);

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT
            @UserId = [UserId],
            @AttendanceDate = [AttendanceDate],
            @Status = [Status]
        FROM [pmt].[AttendanceEntries] WITH (UPDLOCK, HOLDLOCK)
        WHERE [AttendanceEntryId] = @AttendanceEntryId;

        IF @UserId IS NULL
        BEGIN
            THROW 50278, 'The attendance entry was not found.', 1;
        END;

        DECLARE @RequiredRight NVARCHAR(20) = CASE WHEN @UserId = @CurrentUserId THEN N'Create' ELSE N'Update' END;
        EXEC [pmt].[RequirePermission] @CurrentUserId, N'Scrum', @RequiredRight;

        DELETE FROM [pmt].[AttendanceEntries]
        WHERE [AttendanceEntryId] = @AttendanceEntryId;

        DECLARE @AuditDetails NVARCHAR(400) =
            N'Attendance removed for ' + CONVERT(NVARCHAR(10), @AttendanceDate, 23)
            + N' as ' + @Status
            + N' for user #' + CONVERT(NVARCHAR(20), @UserId) + N'.';

        EXEC [pmt].[WriteAudit]
            N'Attendance',
            @AttendanceEntryId,
            N'Removed',
            @AuditDetails,
            @CurrentUserId;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[EnsurePmtDemoUsers]
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 50260, 'Only an administrator can restore PMT demo users.', 1;
    END;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @DemoRestoreLockResult INT;
        EXEC @DemoRestoreLockResult = sys.sp_getapplock
            @Resource = N'pmt:PMTDemoRestore',
            @LockMode = N'Exclusive',
            @LockOwner = N'Transaction',
            @LockTimeout = 30000;

        IF @DemoRestoreLockResult < 0
        BEGIN
            THROW 50269, 'The PMT demo restore is already running. Try again after it finishes.', 1;
        END;

    -- Restoring users must not change anything while a PMT Project still exists.
    IF EXISTS (SELECT 1 FROM [pmt].[Projects] WHERE [Code] = N'PMT')
    BEGIN
        THROW 50258, 'PMT seed data can only be restored after the PMT project has been permanently deleted.', 1;
    END;

    DECLARE @Sin INT =
    (
        SELECT TOP (1) [UserId]
        FROM [pmt].[Users]
        WHERE [Email] = N'louiery@gmail.com'
          AND [IsAdmin] = 1
          AND [IsActive] = 1
        ORDER BY [UserId]
    );

    IF @Sin IS NULL
    BEGIN
        THROW 50261, 'The active Sin administrator account is required to restore PMT demo users.', 1;
    END;

    DECLARE @SeedUsers TABLE
    (
        [FirstName] NVARCHAR(80) NOT NULL,
        [LastName] NVARCHAR(80) NOT NULL,
        [Nickname] NVARCHAR(80) NOT NULL,
        [Email] NVARCHAR(180) NOT NULL PRIMARY KEY,
        [Phone] NVARCHAR(60) NOT NULL,
        [AvatarUrl] NVARCHAR(500) NOT NULL,
        [HomePageUrl] NVARCHAR(500) NOT NULL,
        [SocialMediaUrl] NVARCHAR(500) NOT NULL,
        [Bio] NVARCHAR(MAX) NOT NULL,
        [Role] NVARCHAR(20) NOT NULL
    );

    INSERT INTO @SeedUsers
    (
        [FirstName], [LastName], [Nickname], [Email], [Phone], [AvatarUrl],
        [HomePageUrl], [SocialMediaUrl], [Bio], [Role]
    )
    VALUES
    (N'Bill', N'Gates', N'Bill', N'bill.gates@microsoft.com', N'555-0102', N'/assets/avatar-bill-gates.jpg?v=20260629-avatar-jpg-assets', N'https://www.gatesnotes.com/', N'https://www.linkedin.com/in/williamhgates/', N'Backend developer focused on APIs and database work.', N'Developer'),
    (N'Sam', N'Altman', N'Sam', N'sam.altman@openai.com', N'555-0103', N'/assets/avatar-sam-altman.jpg?v=20260629-avatar-jpg-assets', N'https://blog.samaltman.com/', N'https://www.linkedin.com/in/samaltman/', N'QA lead who keeps acceptance criteria and bug reports clear.', N'QA'),
    (N'Mark', N'Zuckerberg', N'Mark', N'mark.zuckerberg@meta.com', N'555-0104', N'/assets/avatar-mark-zuckerberg.jpg?v=20260629-avatar-jpg-assets', N'https://about.meta.com/', N'https://www.linkedin.com/in/zuck/', N'Frontend developer focused on usability and interaction details.', N'Developer'),
    (N'Steve', N'Jobs', N'Steve', N'steve.jobs@apple.com', N'555-0105', N'/assets/avatar-steve-jobs.jpg?v=20260629-avatar-jpg-assets', N'https://www.apple.com/', N'https://www.linkedin.com/', N'Product-minded developer who helps sharpen feature scope.', N'Developer'),
    (N'Jensen', N'Huang', N'Jensen Huang', N'Jensen.Huang@nvidia.com', N'555-0106', N'/assets/avatar-jensen-huang.jpg?v=20260629-avatar-jpg-assets', N'https://www.nvidia.com/', N'https://www.linkedin.com/in/jenhsunhuang/', N'Integration developer who helps with performance and release support.', N'Developer');

    IF EXISTS
    (
        SELECT [Seed].[Email]
        FROM @SeedUsers AS [Seed]
        INNER JOIN [pmt].[Users] AS [Existing]
            ON LOWER(LTRIM(RTRIM([Existing].[Email]))) = LOWER([Seed].[Email])
        GROUP BY [Seed].[Email]
        HAVING COUNT(*) > 1
    )
    BEGIN
        THROW 50262, 'A PMT demo email belongs to more than one user. Resolve the duplicate before restoring the demo.', 1;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM @SeedUsers AS [Seed]
        WHERE NOT EXISTS
              (
                  SELECT 1
                  FROM [pmt].[Users] AS [ExactUser]
                  WHERE LOWER(LTRIM(RTRIM([ExactUser].[Email]))) = LOWER([Seed].[Email])
                    AND [ExactUser].[IsActive] = 1
              )
          AND EXISTS
              (
                  SELECT 1
                  FROM [pmt].[Users] AS [NicknameOwner]
                  WHERE LOWER(LTRIM(RTRIM([NicknameOwner].[Nickname]))) = LOWER([Seed].[Nickname])
                    AND LOWER(LTRIM(RTRIM(ISNULL([NicknameOwner].[Email], N'')))) <> LOWER([Seed].[Email])
              )
    )
    BEGIN
        THROW 50263, 'A PMT demo username belongs to another user. Resolve the collision before restoring the demo.', 1;
    END;

        DECLARE @ChangedUsers TABLE
        (
            [UserId] INT NOT NULL PRIMARY KEY,
            [Nickname] NVARCHAR(80) NOT NULL,
            [Action] NVARCHAR(20) NOT NULL
        );

        UPDATE [Existing]
        SET
            [FirstName] = [Seed].[FirstName],
            [LastName] = [Seed].[LastName],
            [Nickname] = [Seed].[Nickname],
            [Phone] = [Seed].[Phone],
            [AvatarUrl] = [Seed].[AvatarUrl],
            [HomePageUrl] = [Seed].[HomePageUrl],
            [SocialMediaUrl] = [Seed].[SocialMediaUrl],
            [Bio] = [Seed].[Bio],
            [IsAdmin] = 0,
            [Role] = [Seed].[Role],
            [IsActive] = 1,
            [UpdatedByUserId] = @CurrentUserId,
            [UpdatedAt] = SYSUTCDATETIME()
        OUTPUT [inserted].[UserId], [inserted].[Nickname], N'Reactivated'
            INTO @ChangedUsers ([UserId], [Nickname], [Action])
        FROM [pmt].[Users] AS [Existing]
        INNER JOIN @SeedUsers AS [Seed]
            ON LOWER(LTRIM(RTRIM([Existing].[Email]))) = LOWER([Seed].[Email])
        WHERE [Existing].[IsActive] = 0;

        INSERT INTO [pmt].[Users]
        (
            [FirstName], [LastName], [Nickname], [Email], [Phone], [AvatarUrl],
            [PasswordHash], [HomePageUrl], [SocialMediaUrl], [Bio], [IsAdmin],
            [Role], [IsActive], [CreatedByUserId]
        )
        OUTPUT [inserted].[UserId], [inserted].[Nickname], N'Created'
            INTO @ChangedUsers ([UserId], [Nickname], [Action])
        SELECT
            [Seed].[FirstName], [Seed].[LastName], [Seed].[Nickname], [Seed].[Email],
            [Seed].[Phone], [Seed].[AvatarUrl], CRYPT_GEN_RANDOM(32),
            [Seed].[HomePageUrl], [Seed].[SocialMediaUrl], [Seed].[Bio], 0,
            [Seed].[Role], 1, @CurrentUserId
        FROM @SeedUsers AS [Seed]
        WHERE NOT EXISTS
        (
            SELECT 1
            FROM [pmt].[Users] AS [Existing]
            WHERE LOWER(LTRIM(RTRIM([Existing].[Email]))) = LOWER([Seed].[Email])
        );

        DECLARE @ChangedUserId INT;
        DECLARE @ChangedNickname NVARCHAR(80);
        DECLARE @ChangedAction NVARCHAR(20);

        WHILE EXISTS (SELECT 1 FROM @ChangedUsers)
        BEGIN
            SELECT TOP (1)
                @ChangedUserId = [UserId],
                @ChangedNickname = [Nickname],
                @ChangedAction = [Action]
            FROM @ChangedUsers
            ORDER BY [UserId];

            EXEC [pmt].[WriteAudit]
                N'User',
                @ChangedUserId,
                @ChangedAction,
                @ChangedNickname,
                @CurrentUserId;

            DELETE FROM @ChangedUsers WHERE [UserId] = @ChangedUserId;
        END;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0
        BEGIN
            ROLLBACK TRANSACTION;
        END;

        THROW;
    END CATCH;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[DevelopmentClearProjectData]
    @CurrentUserId INT,
    @ClearPmtOnly BIT,
    @DeleteProjects BIT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 50100, 'Only an administrator can run development cleanup.', 1;
    END;

    DECLARE @PmtProjectId INT =
    (
        SELECT [ProjectId]
        FROM [pmt].[Projects]
        WHERE [Code] = N'PMT'
          AND [IsArchived] = 0
    );

    IF @PmtProjectId IS NULL AND @ClearPmtOnly = 1
    BEGIN
        THROW 50101, 'The PMT project was not found.', 1;
    END;

    DECLARE @ProjectIds TABLE ([ProjectId] INT NOT NULL PRIMARY KEY);
    DECLARE @SprintIds TABLE ([SprintId] INT NOT NULL PRIMARY KEY);
    DECLARE @TaskIds TABLE ([TaskId] INT NOT NULL PRIMARY KEY);
    DECLARE @BlogIds TABLE ([BlogId] INT NOT NULL PRIMARY KEY);

    INSERT INTO @ProjectIds ([ProjectId])
    SELECT [ProjectId]
    FROM [pmt].[Projects]
    WHERE (@ClearPmtOnly = 1 AND [ProjectId] = @PmtProjectId)
       OR (@ClearPmtOnly = 0 AND [Code] <> N'PMT');

    INSERT INTO @SprintIds ([SprintId])
    SELECT [SprintId]
    FROM [pmt].[Sprints]
    WHERE [ProjectId] IN (SELECT [ProjectId] FROM @ProjectIds);

    INSERT INTO @TaskIds ([TaskId])
    SELECT [TaskId]
    FROM [pmt].[WorkTasks]
    WHERE [ProjectId] IN (SELECT [ProjectId] FROM @ProjectIds);

    INSERT INTO @BlogIds ([BlogId])
    SELECT [BlogId]
    FROM [pmt].[Blogs]
    WHERE [ProjectId] IN (SELECT [ProjectId] FROM @ProjectIds)
      AND [IsPrivate] = 0;

    BEGIN TRANSACTION;

    DELETE FROM [pmt].[AuditEvents]
    WHERE ([EntityType] = N'Task' AND [EntityId] IN (SELECT [TaskId] FROM @TaskIds))
       OR ([EntityType] = N'Sprint' AND [EntityId] IN (SELECT [SprintId] FROM @SprintIds))
       OR ([EntityType] = N'Blog' AND [EntityId] IN (SELECT [BlogId] FROM @BlogIds))
       OR (@DeleteProjects = 1 AND [EntityType] = N'Project' AND [EntityId] IN (SELECT [ProjectId] FROM @ProjectIds));

    DELETE FROM [pmt].[TaskAttachments]
    WHERE [TaskId] IN (SELECT [TaskId] FROM @TaskIds);

    DELETE FROM [pmt].[TaskDependencies]
    WHERE [TaskId] IN (SELECT [TaskId] FROM @TaskIds)
       OR [DependsOnTaskId] IN (SELECT [TaskId] FROM @TaskIds);

    DELETE FROM [pmt].[TaskReporters]
    WHERE [TaskId] IN (SELECT [TaskId] FROM @TaskIds);

    DELETE FROM [pmt].[TaskAssignees]
    WHERE [TaskId] IN (SELECT [TaskId] FROM @TaskIds);

    DELETE FROM [pmt].[BlogAttachments]
    WHERE [BlogId] IN (SELECT [BlogId] FROM @BlogIds);

    DELETE FROM [pmt].[BlogHistory]
    WHERE [BlogId] IN (SELECT [BlogId] FROM @BlogIds);

    UPDATE [pmt].[DevLogs]
    SET [ProjectId] = NULL,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [ProjectId] IN (SELECT [ProjectId] FROM @ProjectIds)
      AND [LogType] = N'Log';

    DELETE FROM [pmt].[DevLogs]
    WHERE [ProjectId] IN (SELECT [ProjectId] FROM @ProjectIds)
      AND [LogType] <> N'Log';

    UPDATE [pmt].[Blogs]
    SET [ProjectId] = NULL,
        [SprintId] = NULL,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [ProjectId] IN (SELECT [ProjectId] FROM @ProjectIds)
      AND [IsPrivate] = 1;

    UPDATE [pmt].[Blogs]
    SET [ParentBlogId] = NULL
    WHERE [ParentBlogId] IN (SELECT [BlogId] FROM @BlogIds);

    UPDATE [pmt].[WorkTasks]
    SET [LinkedBlogId] = NULL,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [LinkedBlogId] IN (SELECT [BlogId] FROM @BlogIds);

    DELETE FROM [pmt].[Blogs]
    WHERE [BlogId] IN (SELECT [BlogId] FROM @BlogIds);

    UPDATE [pmt].[WorkTasks]
    SET [ParentTaskId] = NULL,
        [LinkedBugTaskId] = CASE WHEN [LinkedBugTaskId] IN (SELECT [TaskId] FROM @TaskIds) THEN NULL ELSE [LinkedBugTaskId] END,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [TaskId] IN (SELECT [TaskId] FROM @TaskIds)
       OR [ParentTaskId] IN (SELECT [TaskId] FROM @TaskIds)
       OR [LinkedBugTaskId] IN (SELECT [TaskId] FROM @TaskIds);

    DELETE FROM [pmt].[WorkTasks]
    WHERE [TaskId] IN (SELECT [TaskId] FROM @TaskIds);

    DELETE FROM [pmt].[SprintMembers]
    WHERE [SprintId] IN (SELECT [SprintId] FROM @SprintIds);

    DELETE FROM [pmt].[Sprints]
    WHERE [SprintId] IN (SELECT [SprintId] FROM @SprintIds);

    IF @DeleteProjects = 1
    BEGIN
        DELETE FROM [pmt].[ProjectMembers]
        WHERE [ProjectId] IN (SELECT [ProjectId] FROM @ProjectIds);

        DELETE FROM [pmt].[Projects]
        WHERE [ProjectId] IN (SELECT [ProjectId] FROM @ProjectIds);
    END;
    ELSE
    BEGIN
        UPDATE [pmt].[Projects]
        SET [UpdatedByUserId] = @CurrentUserId,
            [UpdatedAt] = SYSUTCDATETIME()
        WHERE [ProjectId] IN (SELECT [ProjectId] FROM @ProjectIds);
    END;

    DELETE [Attachment]
    FROM [pmt].[Attachments] AS [Attachment]
    WHERE NOT EXISTS (SELECT 1 FROM [pmt].[TaskAttachments] WHERE [TaskAttachments].[AttachmentId] = [Attachment].[AttachmentId])
      AND NOT EXISTS (SELECT 1 FROM [pmt].[BlogAttachments] WHERE [BlogAttachments].[AttachmentId] = [Attachment].[AttachmentId]);

    DECLARE @AuditDetails NVARCHAR(MAX) =
        CASE WHEN @ClearPmtOnly = 1 THEN N'Cleared PMT project data.' ELSE N'Cleared project data except PMT.' END;

    EXEC [pmt].[WriteAudit]
        N'Development',
        0,
        N'Cleanup',
        @AuditDetails,
        @CurrentUserId;

    COMMIT TRANSACTION;
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

    DELETE FROM [pmt].[UserPermissions]
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
        [Role] = N'Developer',
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
    UPDATE [pmt].[AuditEvents]
    SET
        [UserId] = @AdminUserId,
        [ActorUserId] = @AdminUserId,
        [CreatedByUserId] = @AdminUserId,
        [UpdatedByUserId] = @AdminUserId;
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

CREATE OR ALTER PROCEDURE [pmt].[RequireDevelopmentSeedRestore]
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 50110, 'Only an administrator can restore initial seed data.', 1;
    END;
END;
GO

BEGIN TRANSACTION;

EXEC [pmt].[LockBlogWrites];
EXEC [pmt].[LockWorkTaskWrites];
EXEC [pmt].[LockSprintWrites];

DECLARE @PmtProjectId INT = (SELECT [PmtProjectId] FROM #Pmt122To123State);
DECLARE @SinUserId INT = (SELECT [SinUserId] FROM #Pmt122To123State);

UPDATE [pmt].[Projects]
SET
    [Code] = N'PMTQA',
    [UpdatedByUserId] = @SinUserId,
    [UpdatedAt] = SYSUTCDATETIME()
WHERE [ProjectId] = @PmtProjectId
  AND [Code] = N'PMT'
  AND [IsArchived] = 0;

IF @@ROWCOUNT <> 1
BEGIN
    THROW 51065, 'The deployed PMT Project could not be renamed to PMTQA.', 1;
END;

EXEC [pmt].[SynchronizeProjectCode]
    @ProjectId = @PmtProjectId,
    @PreviousProjectCode = N'PMT',
    @ProjectCode = N'PMTQA';

EXEC [pmt].[WriteAudit]
    N'Project',
    @PmtProjectId,
    N'Code Renamed',
    N'One-time Production migration renamed PMT to PMTQA before restoring the original PMT demo.',
    @SinUserId;

EXEC [pmt].[EnsurePmtDemoUsers] @CurrentUserId = @SinUserId;
GO

/*
    PMT project seed data.

    This script restores only the PMT project and its initial Sprints, work
    items, Scrum entries, and Documentation. Core users, lookups, security,
    holidays, and the LMS/HLS projects are managed by their companion scripts.
*/

USE [PMT];
GO

SET NOCOUNT ON;
SET DATEFIRST 7;
SET XACT_ABORT ON;

DECLARE @Today DATE = CONVERT(DATE, SYSDATETIME());
DECLARE @Now DATETIME2(0) = SYSDATETIME();
DECLARE @Sin INT = (SELECT TOP (1) [UserId] FROM [pmt].[Users] WHERE [Email] = N'louiery@gmail.com' ORDER BY [UserId]);
DECLARE @Bill INT = (SELECT TOP (1) [UserId] FROM [pmt].[Users] WHERE [Email] = N'bill.gates@microsoft.com' ORDER BY [UserId]);
DECLARE @Sam INT = (SELECT TOP (1) [UserId] FROM [pmt].[Users] WHERE [Email] = N'sam.altman@openai.com' ORDER BY [UserId]);
DECLARE @Mark INT = (SELECT TOP (1) [UserId] FROM [pmt].[Users] WHERE [Email] = N'mark.zuckerberg@meta.com' ORDER BY [UserId]);
DECLARE @Steve INT = (SELECT TOP (1) [UserId] FROM [pmt].[Users] WHERE [Email] = N'steve.jobs@apple.com' ORDER BY [UserId]);
DECLARE @Jensen INT = (SELECT TOP (1) [UserId] FROM [pmt].[Users] WHERE [Email] = N'Jensen.Huang@nvidia.com' ORDER BY [UserId]);
DECLARE @MinorSeverity NVARCHAR(120) = ISNULL
(
    (
        SELECT TOP (1) [Value]
        FROM [pmt].[Lookups]
        WHERE [LookupType] = N'Severity'
          AND [IsActive] = 1
          AND ([Value] = N'Minor' OR [Value] LIKE N'% - Minor')
        ORDER BY CASE WHEN [Value] = N'Minor' THEN 0 ELSE 1 END, [DisplayOrder], [LookupId]
    ),
    N'Minor'
);
DECLARE @MajorSeverity NVARCHAR(120) = ISNULL
(
    (
        SELECT TOP (1) [Value]
        FROM [pmt].[Lookups]
        WHERE [LookupType] = N'Severity'
          AND [IsActive] = 1
          AND ([Value] = N'Major' OR [Value] LIKE N'% - Major')
        ORDER BY CASE WHEN [Value] = N'Major' THEN 0 ELSE 1 END, [DisplayOrder], [LookupId]
    ),
    N'Major'
);
DECLARE @SitEnvironment NVARCHAR(120) = ISNULL
(
    (
        SELECT TOP (1) [Value]
        FROM [pmt].[Lookups]
        WHERE [LookupType] = N'Environment'
          AND [IsActive] = 1
          AND ([Value] = N'SIT' OR [Value] LIKE N'SIT -%')
        ORDER BY CASE WHEN [Value] = N'SIT' THEN 0 ELSE 1 END, [DisplayOrder], [LookupId]
    ),
    N'SIT'
);

IF EXISTS (SELECT 1 FROM [pmt].[Projects] WHERE [Code] = N'PMT')
BEGIN
    THROW 50258, 'PMT seed data can only be restored after the PMT project has been permanently deleted.', 1;
END;

IF @Sin IS NULL OR @Bill IS NULL OR @Sam IS NULL OR @Mark IS NULL OR @Steve IS NULL OR @Jensen IS NULL
BEGIN
    THROW 50259, 'PMT seed data requires the original demo users. Use Restore PMT Seed Data or pmt.EnsurePmtDemoUsers first.', 1;
END;

BEGIN TRANSACTION;

INSERT INTO [pmt].[Projects] ([Code], [Title], [Description], [Url], [IconUrl], [StartDate], [EndDate], [CreatedByUserId])
VALUES
(N'PMT', N'Project Management Tool', N'The internal task tracking tool used by this development team.', N'https://intranet.local/projects/pmt', N'/assets/project-pmt.svg?v=20260621-transparent', DATEADD(DAY, -56, @Today), NULL, @Sin);

DECLARE @PmtProject INT = (SELECT [ProjectId] FROM [pmt].[Projects] WHERE [Code] = N'PMT');

INSERT INTO [pmt].[ProjectMembers] ([ProjectId], [UserId], [CreatedByUserId])
VALUES
(@PmtProject, @Sin, @Sin), (@PmtProject, @Bill, @Sin), (@PmtProject, @Sam, @Sin),
(@PmtProject, @Mark, @Sin), (@PmtProject, @Steve, @Sin), (@PmtProject, @Jensen, @Sin);

INSERT INTO [pmt].[Sprints]
(
    [ProjectId], [Code], [Title], [Description], [StartDate], [EndDate],
    [LessonLearnedHtml], [IsFinished], [CreatedByUserId], [CreatedAt], [UpdatedAt]
)
VALUES
(@PmtProject, N'PMT-Sprint01', N'Day 1 Foundation', N'Create the application foundation, database schema, login, ADO.NET data access, and stored procedure-first pattern.', DATEADD(DAY, -56, @Today), DATEADD(DAY, -43, @Today), N'<p>The KISS approach worked well: one small ADO.NET store calling stored procedures was easy to follow and debug.</p>', 1, @Sin, DATEADD(DAY, -56, @Now), DATEADD(DAY, -43, @Now)),
(@PmtProject, N'PMT-Sprint02', N'Day 2 UX and Kanban', N'Modernize the UI, expand the workflow statuses, add Kanban movement, and clean up dialogs.', DATEADD(DAY, -42, @Today), DATEADD(DAY, -29, @Today), N'<p>Dark theme polish and predictable dialog focus made the app feel less like a prototype.</p>', 1, @Sin, DATEADD(DAY, -42, @Now), DATEADD(DAY, -29, @Now)),
(@PmtProject, N'PMT-Sprint03', N'Day 3 Scrum and Documentation', N'Add richer filters, Scrum rows, Documentation, project/sprint drill-through, and permanent seed content.', DATEADD(DAY, -28, @Today), DATEADD(DAY, -15, @Today), N'<p>Project and Sprint filters became the backbone for navigating PMT during demos.</p>', 1, @Sin, DATEADD(DAY, -28, @Now), DATEADD(DAY, -15, @Now)),
(@PmtProject, N'PMT-Sprint04', N'Day 4 Planning Views', N'Add holiday maintenance, Gantt non-working day behavior, and the Road Map view for project planning.', DATEADD(DAY, -14, @Today), DATEADD(DAY, -1, @Today), N'<p>Long-running projects needed compressed timelines, while normal two-week Sprints still needed readable bars.</p>', 1, @Sin, DATEADD(DAY, -14, @Now), DATEADD(DAY, -1, @Now)),
(@PmtProject, N'PMT-Sprint05', N'Days 5-8 Audit, Settings, and Polish', N'Current Sprint for audit trails, seed restore tools, fly-by fixes, linked Bug Fix validation, and theme support.', @Today, DATEADD(DAY, 13, @Today), N'', 0, @Sin, @Now, @Now);

DECLARE @PmtSprint1 INT = (SELECT [SprintId] FROM [pmt].[Sprints] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-Sprint01');
DECLARE @PmtSprint2 INT = (SELECT [SprintId] FROM [pmt].[Sprints] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-Sprint02');
DECLARE @PmtSprint3 INT = (SELECT [SprintId] FROM [pmt].[Sprints] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-Sprint03');
DECLARE @PmtSprint4 INT = (SELECT [SprintId] FROM [pmt].[Sprints] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-Sprint04');
DECLARE @PmtSprint5 INT = (SELECT [SprintId] FROM [pmt].[Sprints] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-Sprint05');

INSERT INTO [pmt].[SprintMembers] ([SprintId], [UserId], [CreatedByUserId])
VALUES
(@PmtSprint1, @Sin, @Sin), (@PmtSprint1, @Bill, @Sin), (@PmtSprint1, @Sam, @Sin), (@PmtSprint1, @Mark, @Sin), (@PmtSprint1, @Steve, @Sin), (@PmtSprint1, @Jensen, @Sin),
(@PmtSprint2, @Sin, @Sin), (@PmtSprint2, @Bill, @Sin), (@PmtSprint2, @Sam, @Sin), (@PmtSprint2, @Mark, @Sin), (@PmtSprint2, @Steve, @Sin), (@PmtSprint2, @Jensen, @Sin),
(@PmtSprint3, @Sin, @Sin), (@PmtSprint3, @Bill, @Sin), (@PmtSprint3, @Sam, @Sin), (@PmtSprint3, @Mark, @Sin), (@PmtSprint3, @Steve, @Sin), (@PmtSprint3, @Jensen, @Sin),
(@PmtSprint4, @Sin, @Sin), (@PmtSprint4, @Bill, @Sin), (@PmtSprint4, @Sam, @Sin), (@PmtSprint4, @Mark, @Sin), (@PmtSprint4, @Steve, @Sin), (@PmtSprint4, @Jensen, @Sin),
(@PmtSprint5, @Sin, @Sin), (@PmtSprint5, @Bill, @Sin), (@PmtSprint5, @Sam, @Sin), (@PmtSprint5, @Mark, @Sin), (@PmtSprint5, @Steve, @Sin), (@PmtSprint5, @Jensen, @Sin);

INSERT INTO [pmt].[WorkTasks]
(
    [ProjectId], [SprintId], [ParentTaskId], [TaskType], [Code], [Title], [DescriptionHtml],
    [Status], [Priority], [PercentCompleted], [Url], [StartDate], [EndDate], [StartedAt],
    [CreatedByUserId], [LinkedBugTaskId], [CreatedAt], [UpdatedAt]
)
VALUES
(@PmtProject, @PmtSprint1, NULL, N'Dev', N'PMT-TASK-001', N'Build PMT foundation with stored procedures', N'<p>Create the pmt schema, simple tables, stored procedures, and the ADO.NET access path for the first PMT screens.</p>', N'Deployed in Prod', N'High', 100, N'https://intranet.local/pmt/tasks/001', DATEADD(DAY, -55, @Today), DATEADD(DAY, -50, @Today), DATEADD(DAY, -55, @Today), @Sin, NULL, DATEADD(DAY, -56, @Now), DATEADD(DAY, -50, @Now)),
(@PmtProject, @PmtSprint1, NULL, N'Dev', N'PMT-TASK-005', N'Create login and password change flow', N'<p>Add the login screen, default Password1 seed password, and a simple password change dialog.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/005', DATEADD(DAY, -53, @Today), DATEADD(DAY, -47, @Today), DATEADD(DAY, -53, @Today), @Sin, NULL, DATEADD(DAY, -54, @Now), DATEADD(DAY, -47, @Now)),
(@PmtProject, @PmtSprint2, NULL, N'Dev', N'PMT-TASK-006', N'Modernize dark theme and form controls', N'<p>Replace the early plain UI with a modern dark theme, styled dropdowns, cleaner file inputs, and left-aligned checkboxes.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/006', DATEADD(DAY, -41, @Today), DATEADD(DAY, -36, @Today), DATEADD(DAY, -41, @Today), @Sin, NULL, DATEADD(DAY, -42, @Now), DATEADD(DAY, -36, @Now)),
(@PmtProject, @PmtSprint2, NULL, N'Dev', N'PMT-TASK-009', N'Add Kanban Board drag and task creation', N'<p>Allow Dev Tasks to be created from the Kanban Board and moved across status columns.</p>', N'Deployed in Prod', N'High', 100, N'https://intranet.local/pmt/tasks/009', DATEADD(DAY, -38, @Today), DATEADD(DAY, -31, @Today), DATEADD(DAY, -38, @Today), @Sin, NULL, DATEADD(DAY, -39, @Now), DATEADD(DAY, -31, @Now)),
(@PmtProject, @PmtSprint3, NULL, N'Dev', N'PMT-TASK-011', N'Add Project, Sprint, and Dev Task filtering', N'<p>Make Projects drill into Sprints, Sprints drill into Dev Tasks, and Tasks refresh by selected Project/Sprint.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/011', DATEADD(DAY, -27, @Today), DATEADD(DAY, -21, @Today), DATEADD(DAY, -27, @Today), @Sin, NULL, DATEADD(DAY, -28, @Now), DATEADD(DAY, -21, @Now)),
(@PmtProject, @PmtSprint3, NULL, N'Dev', N'PMT-TASK-015', N'Add Scrum and Documentation screens', N'<p>Rename Blogs to Documentation, add Scrum entries, and seed realistic Documentation with local images.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/015', DATEADD(DAY, -24, @Today), DATEADD(DAY, -16, @Today), DATEADD(DAY, -24, @Today), @Sin, NULL, DATEADD(DAY, -25, @Now), DATEADD(DAY, -16, @Now)),
(@PmtProject, @PmtSprint4, NULL, N'Dev', N'PMT-TASK-016', N'Add Holiday maintenance and Gantt non-working-day rules', N'<p>Add configurable holidays for Philippine deployments and hide weekends/holidays on planning timelines unless work starts there.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/016', DATEADD(DAY, -13, @Today), DATEADD(DAY, -9, @Today), DATEADD(DAY, -13, @Today), @Sin, NULL, DATEADD(DAY, -14, @Now), DATEADD(DAY, -9, @Now)),
(@PmtProject, @PmtSprint4, NULL, N'Dev', N'PMT-TASK-017', N'Create Road Map planning view', N'<p>Render Projects and Sprints by date with progress, avatars, filtering, sorting, and clickable navigation.</p>', N'Deployed in Prod', N'High', 100, N'https://intranet.local/pmt/tasks/017', DATEADD(DAY, -12, @Today), DATEADD(DAY, -5, @Today), DATEADD(DAY, -12, @Today), @Sin, NULL, DATEADD(DAY, -13, @Now), DATEADD(DAY, -5, @Now)),
(@PmtProject, @PmtSprint4, NULL, N'Dev', N'PMT-TASK-018', N'Add Gantt Sprint jump and fly-by demo', N'<p>Add Sprint filtering, selected Sprint mode, all-Sprints mode, reset behavior, and the fly-by demo animation.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/018', DATEADD(DAY, -10, @Today), DATEADD(DAY, -2, @Today), DATEADD(DAY, -10, @Today), @Sin, NULL, DATEADD(DAY, -11, @Now), DATEADD(DAY, -2, @Now)),
(@PmtProject, @PmtSprint5, NULL, N'Dev', N'PMT-TASK-020', N'Add audit logs and Development settings tools', N'<p>Create task/bug audit popups, Development cleanup buttons, and seed restore support for PMT, LMS, and HLS.</p>', N'Deployed in UAT', N'Low', 100, N'https://intranet.local/pmt/tasks/020', @Today, DATEADD(DAY, 7, @Today), @Today, @Sin, NULL, @Now, @Now),
(@PmtProject, @PmtSprint5, NULL, N'Dev', N'PMT-TASK-024', N'Add Light and Dark theme toggle', N'<p>Add a persistent theme toggle under the avatar menu and provide a professional light glassmorphism theme.</p>', N'In Progress', N'Low', 40, N'https://intranet.local/pmt/tasks/024', DATEADD(DAY, 1, @Today), DATEADD(DAY, 5, @Today), DATEADD(DAY, 1, @Today), @Sin, NULL, @Now, @Now),
(@PmtProject, @PmtSprint5, NULL, N'Dev', N'PMT-TASK-026', N'Tune Gantt sizing for two-week Sprints', N'<p>Keep the HLS multi-year Gantt compressed while making normal two-week Sprint projects readable in one viewport.</p>', N'Todo', N'Low', 0, N'https://intranet.local/pmt/tasks/026', DATEADD(DAY, 2, @Today), DATEADD(DAY, 8, @Today), NULL, @Sin, NULL, @Now, @Now),
(@PmtProject, NULL, NULL, N'Dev', N'PMT-BACKLOG-001', N'Add stakeholder export package', N'<p>Generate a lightweight stakeholder summary from Dashboard, Road Map, and Gantt views.</p>', N'Todo', N'Low', 0, N'https://intranet.local/pmt/backlog/001', NULL, NULL, NULL, @Sin, NULL, @Now, @Now),
(@PmtProject, NULL, NULL, N'Dev', N'PMT-BACKLOG-002', N'Add reusable chart module for task and bug analytics', N'<p>Build simple animated charts without a charting library for Dev Task and Bug Report trends.</p>', N'Todo', N'Low', 0, N'https://intranet.local/pmt/backlog/002', NULL, NULL, NULL, @Sin, NULL, @Now, @Now);

DECLARE @PmtFoundationParent INT = (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-TASK-001');
DECLARE @PmtThemeParent INT = (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-TASK-006');
DECLARE @PmtFiltersParent INT = (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-TASK-011');
DECLARE @PmtAuditParent INT = (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-TASK-020');

INSERT INTO [pmt].[WorkTasks]
(
    [ProjectId], [SprintId], [ParentTaskId], [TaskType], [Code], [Title], [DescriptionHtml],
    [Status], [Priority], [PercentCompleted], [Url], [StartDate], [EndDate], [StartedAt],
    [CreatedByUserId], [LinkedBugTaskId], [CreatedAt], [UpdatedAt]
)
VALUES
(@PmtProject, @PmtSprint1, @PmtFoundationParent, N'Dev', N'PMT-TASK-002', N'Create pmt schema and core tables', N'<p>Create all database objects under the pmt schema and prefix all references with it.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/002', DATEADD(DAY, -55, @Today), DATEADD(DAY, -54, @Today), DATEADD(DAY, -55, @Today), @Sin, NULL, DATEADD(DAY, -55, @Now), DATEADD(DAY, -54, @Now)),
(@PmtProject, @PmtSprint1, @PmtFoundationParent, N'Dev', N'PMT-TASK-003', N'Build ADO.NET store methods', N'<p>Use straightforward SqlCommand calls and stored procedures instead of Entity Framework.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/003', DATEADD(DAY, -54, @Today), DATEADD(DAY, -52, @Today), DATEADD(DAY, -54, @Today), @Sin, NULL, DATEADD(DAY, -54, @Now), DATEADD(DAY, -52, @Now)),
(@PmtProject, @PmtSprint1, @PmtFoundationParent, N'Dev', N'PMT-TASK-004', N'Create seed script and default users', N'<p>Seed the initial users, Password1 hashes, lookups, PMT project, and starter tasks.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/004', DATEADD(DAY, -52, @Today), DATEADD(DAY, -50, @Today), DATEADD(DAY, -52, @Today), @Sin, NULL, DATEADD(DAY, -52, @Now), DATEADD(DAY, -50, @Now)),
(@PmtProject, @PmtSprint2, @PmtThemeParent, N'Dev', N'PMT-TASK-007', N'Style dropdowns and file uploads', N'<p>Remove the harsh default control borders and make dropdown menus match the dark UI.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/007', DATEADD(DAY, -41, @Today), DATEADD(DAY, -39, @Today), DATEADD(DAY, -41, @Today), @Sin, NULL, DATEADD(DAY, -41, @Now), DATEADD(DAY, -39, @Now)),
(@PmtProject, @PmtSprint2, @PmtThemeParent, N'Dev', N'PMT-TASK-008', N'Fix checkbox alignment in dialogs', N'<p>Place checkboxes on the left with labels beside them in Project and User dialogs.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/008', DATEADD(DAY, -39, @Today), DATEADD(DAY, -36, @Today), DATEADD(DAY, -39, @Today), @Sin, NULL, DATEADD(DAY, -39, @Now), DATEADD(DAY, -36, @Now)),
(@PmtProject, @PmtSprint3, @PmtFiltersParent, N'Dev', N'PMT-TASK-012', N'Project click filters Sprints', N'<p>Clicking a Project opens the Sprints view with that Project already selected.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/012', DATEADD(DAY, -27, @Today), DATEADD(DAY, -25, @Today), DATEADD(DAY, -27, @Today), @Sin, NULL, DATEADD(DAY, -27, @Now), DATEADD(DAY, -25, @Now)),
(@PmtProject, @PmtSprint3, @PmtFiltersParent, N'Dev', N'PMT-TASK-013', N'Sprint click filters Dev Tasks', N'<p>Clicking a Sprint opens the Dev Tasks view with the Project and Sprint filters applied.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/013', DATEADD(DAY, -25, @Today), DATEADD(DAY, -23, @Today), DATEADD(DAY, -25, @Today), @Sin, NULL, DATEADD(DAY, -25, @Now), DATEADD(DAY, -23, @Now)),
(@PmtProject, @PmtSprint3, @PmtFiltersParent, N'Dev', N'PMT-TASK-014', N'Add advanced Dev Task filters', N'<p>Add status, assigned-user, completion, newest/oldest, and hide-completed filters.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/014', DATEADD(DAY, -23, @Today), DATEADD(DAY, -21, @Today), DATEADD(DAY, -23, @Today), @Sin, NULL, DATEADD(DAY, -23, @Now), DATEADD(DAY, -21, @Now)),
(@PmtProject, @PmtSprint5, @PmtAuditParent, N'Dev', N'PMT-TASK-021', N'Create task and bug audit popup', N'<p>Show status and completion changes from newest to oldest on read-only and edit dialogs.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/021', @Today, DATEADD(DAY, 2, @Today), @Today, @Sin, NULL, @Now, @Now),
(@PmtProject, @PmtSprint5, @PmtAuditParent, N'Dev', N'PMT-TASK-022', N'Add Development cleanup buttons', N'<p>Add Settings tools to clear non-PMT data, clear PMT, clear users, and restore seed data.</p>', N'Deployed in UAT', N'Low', 100, N'https://intranet.local/pmt/tasks/022', DATEADD(DAY, 1, @Today), DATEADD(DAY, 3, @Today), DATEADD(DAY, 1, @Today), @Sin, NULL, @Now, @Now),
(@PmtProject, @PmtSprint5, @PmtAuditParent, N'Dev', N'PMT-TASK-023', N'Wire seed restore endpoint', N'<p>Replay the PMT, LMS, and HLS seed scripts from the Settings screen.</p>', N'Deployed in UAT', N'Low', 100, N'https://intranet.local/pmt/tasks/023', DATEADD(DAY, 3, @Today), DATEADD(DAY, 7, @Today), DATEADD(DAY, 3, @Today), @Sin, NULL, @Now, @Now);

INSERT INTO [pmt].[WorkTasks]
(
    [ProjectId], [SprintId], [ParentTaskId], [TaskType], [Code], [Title], [DescriptionHtml],
    [StepsToReproduceHtml], [ActualResultHtml], [ExpectedResultHtml], [RootCauseAnalysisHtml], [Environment], [Severity],
    [Status], [Priority], [PercentCompleted], [Url], [StartDate], [EndDate], [StartedAt],
    [CreatedByUserId], [LinkedBugTaskId]
)
VALUES
(@PmtProject, @PmtSprint2, NULL, N'Bug', N'PMT-BUG-001', N'Dropdown menu stays white in dark theme', N'<p>Native dropdown options keep a white background and look disconnected from the dark UI.</p>', N'<ol><li>Open any edit dialog.</li><li>Open the Status dropdown.</li><li>Review the option list.</li></ol>', N'<p>The open menu is white and visually clashes with the page.</p>', N'<p>The dropdown options should use the PMT dark theme.</p>', N'<p>Root cause: browser-native select option styling was left outside the PMT theme token rules.</p>', N'local', @MinorSeverity, N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/bugs/001', DATEADD(DAY, -37, @Today), DATEADD(DAY, -34, @Today), DATEADD(DAY, -37, @Today), @Sin, NULL),
(@PmtProject, @PmtSprint4, NULL, N'Bug', N'PMT-BUG-002', N'Gantt day labels overlap on compressed timelines', N'<p>When a long project is shown, day numbers can overlap and become unreadable.</p>', N'<ol><li>Open Gantt.</li><li>Select HLS.</li><li>Show all Sprints.</li></ol>', N'<p>Day labels crowd together on narrow columns.</p>', N'<p>Only enough labels should be shown to keep the header readable.</p>', N'<p>Root cause: timeline labels rendered at every day marker even when the available column width was too small.</p>', @SitEnvironment, @MajorSeverity, N'Deployed in Prod', N'High', 100, N'https://intranet.local/pmt/bugs/002', DATEADD(DAY, -8, @Today), DATEADD(DAY, -3, @Today), DATEADD(DAY, -8, @Today), @Sin, NULL),
(@PmtProject, @PmtSprint5, NULL, N'Bug', N'PMT-BUG-003', N'Gantt bug expansion jumps back to current Sprint', N'<p>During a fly-by pause, expanding a task bug row rerenders the chart and jumps back to the selected/current Sprint.</p>', N'<ol><li>Start the Gantt fly-by.</li><li>Wait until the viewport reaches an older Sprint.</li><li>Expand a bug icon.</li></ol>', N'<p>The viewport jumps to the current Sprint instead of staying on the Sprint being reviewed.</p>', N'<p>The bug rows should expand without changing the current scroll position.</p>', N'<p>Root cause: the expansion render path reused the initial Sprint positioning logic instead of preserving the active scroll offset.</p>', @SitEnvironment, @MajorSeverity, N'QA Failed', N'High', 100, N'https://intranet.local/pmt/bugs/003', DATEADD(DAY, 1, @Today), DATEADD(DAY, 6, @Today), DATEADD(DAY, 1, @Today), @Sin, NULL);

DECLARE @PmtBugTheme INT = (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-BUG-001');
DECLARE @PmtBugGanttLabels INT = (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-BUG-002');
DECLARE @PmtBugGanttJump INT = (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-BUG-003');

INSERT INTO [pmt].[WorkTasks]
(
    [ProjectId], [SprintId], [ParentTaskId], [TaskType], [Code], [Title], [DescriptionHtml],
    [Status], [Priority], [PercentCompleted], [Url], [StartDate], [EndDate], [StartedAt],
    [CreatedByUserId], [LinkedBugTaskId], [CreatedAt], [UpdatedAt]
)
VALUES
(@PmtProject, @PmtSprint2, NULL, N'Dev', N'PMT-TASK-010', N'Bug Fix: Dropdown menu stays white in dark theme', N'<p>Style native select options and use the themed background for dropdown menus.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/010', DATEADD(DAY, -36, @Today), DATEADD(DAY, -34, @Today), DATEADD(DAY, -36, @Today), @Sin, @PmtBugTheme, DATEADD(DAY, -36, @Now), DATEADD(DAY, -34, @Now)),
(@PmtProject, @PmtSprint4, NULL, N'Dev', N'PMT-TASK-019', N'Bug Fix: Gantt day labels overlap on compressed timelines', N'<p>Throttle day labels when columns are narrow so the calendar remains readable.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/019', DATEADD(DAY, -7, @Today), DATEADD(DAY, -3, @Today), DATEADD(DAY, -7, @Today), @Sin, @PmtBugGanttLabels, DATEADD(DAY, -7, @Now), DATEADD(DAY, -3, @Now)),
(@PmtProject, @PmtSprint5, NULL, N'Dev', N'PMT-TASK-025', N'Bug Fix: Gantt bug expansion jumps back to current Sprint', N'<p>Preserve the current scroll position when expanding bug details during fly-by review.</p>', N'In Progress', N'Low', 75, N'https://intranet.local/pmt/tasks/025', DATEADD(DAY, 1, @Today), DATEADD(DAY, 6, @Today), DATEADD(DAY, 1, @Today), @Sin, @PmtBugGanttJump, @Now, @Now);

DECLARE @PmtThemeBugFix INT = (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-TASK-010');
DECLARE @PmtGanttLabelBugFix INT = (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-TASK-019');
DECLARE @PmtGanttJumpBugFix INT = (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-TASK-025');

INSERT INTO [pmt].[TaskAssignees] ([TaskId], [UserId], [CreatedByUserId])
SELECT [TaskId], @Bill, @Sin FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] IN (N'PMT-TASK-001', N'PMT-TASK-002', N'PMT-TASK-003', N'PMT-TASK-004', N'PMT-TASK-005', N'PMT-TASK-021', N'PMT-TASK-022')
UNION ALL SELECT [TaskId], @Mark, @Sin FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] IN (N'PMT-TASK-006', N'PMT-TASK-007', N'PMT-TASK-008', N'PMT-TASK-009', N'PMT-TASK-010', N'PMT-TASK-024')
UNION ALL SELECT [TaskId], @Jensen, @Sin FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] IN (N'PMT-TASK-011', N'PMT-TASK-012', N'PMT-TASK-013', N'PMT-TASK-014', N'PMT-TASK-015', N'PMT-TASK-017', N'PMT-TASK-018', N'PMT-TASK-019', N'PMT-TASK-025', N'PMT-TASK-026')
UNION ALL SELECT [TaskId], @Steve, @Sin FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] IN (N'PMT-TASK-016', N'PMT-TASK-020', N'PMT-TASK-023', N'PMT-BACKLOG-001', N'PMT-BACKLOG-002')
UNION ALL SELECT [TaskId], @Sam, @Sin FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] IN (N'PMT-BUG-001', N'PMT-BUG-002', N'PMT-BUG-003');

INSERT INTO [pmt].[TaskReporters] ([TaskId], [UserId], [CreatedByUserId])
VALUES
(@PmtBugTheme, @Sam, @Sin),
(@PmtBugGanttLabels, @Sam, @Sin),
(@PmtBugGanttJump, @Sam, @Sin);

INSERT INTO [pmt].[TaskDependencies] ([TaskId], [DependsOnTaskId], [CreatedByUserId])
VALUES
(@PmtThemeBugFix, @PmtBugTheme, @Sin),
(@PmtGanttLabelBugFix, @PmtBugGanttLabels, @Sin),
(@PmtGanttJumpBugFix, @PmtBugGanttJump, @Sin),
((SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-TASK-024'), (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-TASK-006'), @Sin),
((SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-TASK-026'), (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-TASK-018'), @Sin);

-- Parent task progress stays calculated from its sub-tasks.
UPDATE [ParentTask]
SET
    [PercentCompleted] = [ChildAverage].[PercentCompleted],
    [UpdatedByUserId] = @Sin,
    [UpdatedAt] = @Now
FROM [pmt].[WorkTasks] AS [ParentTask]
CROSS APPLY
(
    SELECT CONVERT(INT, ROUND(AVG(CONVERT(DECIMAL(10, 2), [ChildTask].[PercentCompleted])), 0)) AS [PercentCompleted]
    FROM [pmt].[WorkTasks] AS [ChildTask]
    WHERE [ChildTask].[ParentTaskId] = [ParentTask].[TaskId]
      AND [ChildTask].[IsDeleted] = 0
) AS [ChildAverage]
WHERE [ParentTask].[ProjectId] = @PmtProject
  AND [ChildAverage].[PercentCompleted] IS NOT NULL;

;WITH OrderedTasks AS
(
    SELECT
        [TaskId],
        ROW_NUMBER() OVER (ORDER BY ISNULL([StartDate], [CreatedAt]), [TaskId]) AS [RowNumber]
    FROM [pmt].[WorkTasks]
    WHERE [ProjectId] = @PmtProject
      AND [IsDeleted] = 0
)
UPDATE [Task]
SET
    [SortOrder] = [OrderedTasks].[RowNumber] * 10
FROM [pmt].[WorkTasks] AS [Task]
INNER JOIN OrderedTasks
    ON [OrderedTasks].[TaskId] = [Task].[TaskId];

INSERT INTO [pmt].[AuditEvents]
(
    [EntityType], [EntityId], [Action], [Details], [OldStatus], [NewStatus],
    [OldPercentCompleted], [NewPercentCompleted], [UserId], [ActorUserId], [CreatedByUserId], [CreatedAt]
)
SELECT N'Task', [TaskId], N'Created', [Title], NULL, [Status], NULL, [PercentCompleted], [CreatedByUserId], [CreatedByUserId], @Sin, DATEADD(HOUR, 9, [CreatedAt])
FROM [pmt].[WorkTasks]
WHERE [ProjectId] = @PmtProject;

INSERT INTO [pmt].[AuditEvents]
(
    [EntityType], [EntityId], [Action], [Details], [OldStatus], [NewStatus],
    [OldPercentCompleted], [NewPercentCompleted], [UserId], [ActorUserId], [CreatedByUserId], [CreatedAt]
)
VALUES
(N'Task', @PmtThemeParent, N'Status/Percent Changed', N'Parent percent recalculated from dark-theme sub-tasks.', N'In Progress', N'QA Passed', 50, 100, @Mark, @Mark, @Sin, DATEADD(DAY, -35, @Now)),
(N'Task', @PmtBugTheme, N'Status/Percent Changed', N'QA reproduced the dropdown contrast issue.', N'Todo', N'QA Failed', 0, 100, @Sam, @Sam, @Sin, DATEADD(DAY, -36, @Now)),
(N'Task', @PmtThemeBugFix, N'Status/Percent Changed', N'Developer corrected select option colors.', N'Todo', N'Code Complete', 0, 100, @Mark, @Mark, @Sin, DATEADD(DAY, -35, @Now)),
(N'Task', @PmtBugTheme, N'Status/Percent Changed', N'Bug percent reset to 0 for QA retest.', N'QA Failed', N'QA Failed', 100, 0, @Mark, @Mark, @Sin, DATEADD(DAY, -35, @Now)),
(N'Task', @PmtBugTheme, N'Status/Percent Changed', N'QA passed the themed dropdown retest.', N'QA Failed', N'QA Passed', 0, 100, @Sam, @Sam, @Sin, DATEADD(DAY, -34, @Now)),
(N'Task', @PmtFiltersParent, N'Status/Percent Changed', N'Parent percent recalculated after the filter subtasks passed QA.', N'In Progress', N'QA Passed', 67, 100, @Jensen, @Jensen, @Sin, DATEADD(DAY, -20, @Now)),
(N'Task', @PmtGanttLabelBugFix, N'Status/Percent Changed', N'Developer reduced crowded day labels on compressed timelines.', N'Todo', N'Code Complete', 0, 100, @Jensen, @Jensen, @Sin, DATEADD(DAY, -4, @Now)),
(N'Task', @PmtBugGanttLabels, N'Status/Percent Changed', N'QA passed the Gantt header label retest.', N'QA in Progress', N'QA Passed', 0, 100, @Sam, @Sam, @Sin, DATEADD(DAY, -3, @Now)),
(N'Task', @PmtAuditParent, N'Status/Percent Changed', N'Parent percent recalculated from audit and Development settings sub-tasks.', N'Todo', N'In Progress', 0, 70, @Steve, @Steve, @Sin, @Now),
(N'Task', @PmtBugGanttJump, N'Status/Percent Changed', N'QA failed the fly-by bug expansion behavior and returned it to development.', N'QA in Progress', N'QA Failed', 0, 100, @Sam, @Sam, @Sin, DATEADD(HOUR, 2, @Now)),
(N'Task', @PmtGanttJumpBugFix, N'Status/Percent Changed', N'Developer started preserving the Gantt viewport while expanding bug rows.', N'Todo', N'In Progress', 0, 75, @Jensen, @Jensen, @Sin, DATEADD(HOUR, 3, @Now));

INSERT INTO [pmt].[DevLogs] ([ProjectId], [UserId], [LogDate], [BodyHtml], [IsPinned], [CreatedByUserId])
VALUES
(@PmtProject, @Bill, DATEADD(DAY, -52, @Today), N'<p><strong>What did you accomplish yesterday?</strong></p><ul><li>Created the pmt schema and the first stored procedures.</li><li>Seeded the default admin account and starter lookup values.</li></ul><p><strong>What do you plan to do today?</strong></p><ul><li>Wire ADO.NET calls for Projects, Sprints, and Dev Tasks.</li><li>Add seed data for project members and Sprint developers.</li><li>Document the login assumptions for QA.</li></ul><p><strong>Do you have any roadblocks?</strong></p><ul><li>Need the final starter-user list before locking the seed script.</li></ul>', 0, @Sin),
(@PmtProject, @Mark, DATEADD(DAY, -39, @Today), N'<p><strong>What did you accomplish yesterday?</strong></p><ul><li>Wired the Project, Sprint, and Dev Task ADO.NET calls.</li><li>Added the project member and Sprint developer seed data.</li><li>Carried the login documentation forward for one more review.</li></ul><p><strong>What do you plan to do today?</strong></p><ul><li>Restyle dropdowns and file upload controls for the dark theme.</li><li>Start the Kanban Board drag behavior.</li></ul><p><strong>Do you have any roadblocks?</strong></p><ul><li>No blockers.</li></ul>', 0, @Sin),
(@PmtProject, @Jensen, DATEADD(DAY, -24, @Today), N'<p><strong>What did you accomplish yesterday?</strong></p><ul><li>Restyled the dark-theme dropdowns and file upload controls.</li><li>Finished the first Kanban Board drag pass.</li><li>Left one keyboard-drag polish item for later.</li></ul><p><strong>What do you plan to do today?</strong></p><ul><li>Connect Project and Sprint clicks to filtered views.</li><li>Add the advanced Dev Task filters.</li><li>Prepare QA notes for the filter state behavior.</li></ul><p><strong>Do you have any roadblocks?</strong></p><ul><li>Need one more QA pass on filter state.</li></ul>', 0, @Sin),
(@PmtProject, @Steve, DATEADD(DAY, -12, @Today), N'<p><strong>What did you accomplish yesterday?</strong></p><ul><li>Connected Project and Sprint clicks to the filtered views.</li><li>Added the advanced Dev Task filters.</li><li>Carried one filter-state edge case into the next QA sweep.</li></ul><p><strong>What do you plan to do today?</strong></p><ul><li>Add Holiday maintenance and start Road Map rendering.</li><li>Make Projects and Sprints clickable on the Road Map.</li></ul><p><strong>Do you have any roadblocks?</strong></p><ul><li>No blockers.</li></ul>', 0, @Sin),
(@PmtProject, @Sin, @Today, N'<p><strong>What did you accomplish yesterday?</strong></p><ul><li>Added Holiday maintenance and Road Map rendering.</li><li>Made Projects and Sprints clickable on the Road Map.</li><li>Verified Development cleanup and seed restore flows.</li></ul><p><strong>What do you plan to do today?</strong></p><ul><li>Add the linked-bug completion guard.</li><li>Wire the theme toggle through the shared shell.</li><li>Review the Scrum starter text and seed data.</li></ul><p><strong>Do you have any roadblocks?</strong></p><ul><li>No blockers.</li></ul>', 1, @Sin);

INSERT INTO [pmt].[Blogs] ([ProjectId], [SprintId], [Title], [BodyHtml], [IsPrivate], [CreatedByUserId], [UpdatedByUserId], [CreatedAt], [UpdatedAt])
VALUES
(
    @PmtProject,
    @PmtSprint1,
    N'PMT Day 1 - Foundation Build and ADO.NET Decision',
    N'<p><img src="/assets/docs/pmt-doc-day01-v2.jpg" alt="PMT foundation diagram showing .NET, ADO.NET, stored procedures, and the pmt schema"></p><p>Day 1 established the core PMT direction: a simple .NET web application, ADO.NET data access, stored procedures, and a dedicated pmt schema for every database object.</p><ul><li>Created the login screen and default Password1 user setup.</li><li>Started the PMT seed data and schema scripts.</li><li>Kept the code intentionally simple for junior developer handoff.</li></ul>',
    0,
    @Sin,
    @Bill,
    DATEADD(DAY, -45, @Now),
    DATEADD(DAY, -44, @Now)
),
(
    @PmtProject,
    @PmtSprint2,
    N'PMT Day 2 - Dark Theme and Kanban Workflow',
    N'<p><img src="/assets/docs/pmt-doc-day02-v2.jpg" alt="Dark theme Kanban Board showing Todo, In Progress, and QA Passed columns"></p><p>The second requirements pass moved PMT away from the original plain layout and into the current dark theme. The Kanban Board gained task creation and status movement.</p><ul><li>Standardized the expanded status workflow.</li><li>Added QA Passed as the sprint completion milestone.</li><li>Cleaned up checkboxes, dropdowns, and dialog focus behavior.</li></ul>',
    0,
    @Mark,
    @Sin,
    DATEADD(DAY, -39, @Now),
    DATEADD(DAY, -38, @Now)
),
(
    @PmtProject,
    @PmtSprint3,
    N'PMT Day 3 - Filters, Scrum, and Documentation',
    N'<p><img src="/assets/docs/pmt-doc-day03-v2.jpg" alt="PMT task filters beside Scrum and Documentation progress cards"></p><p>Day 3 focused on making PMT useful during daily development. The Tasks view gained richer filters, Scrum entries became table rows, and Documentation was seeded for LMS and PMT.</p><ul><li>Added project and sprint filters in Sprints and Dev Tasks.</li><li>Added Scrum placeholders for yesterday, today, and roadblocks.</li><li>Renamed Blogs to Documentation.</li></ul>',
    0,
    @Sam,
    @Mark,
    DATEADD(DAY, -34, @Now),
    DATEADD(DAY, -32, @Now)
),
(
    @PmtProject,
    @PmtSprint4,
    N'PMT Day 4 - Holidays, Gantt, and Road Map',
    N'<p><img src="/assets/docs/pmt-doc-day04-v2.jpg" alt="PMT Gantt chart and Road Map planning view with holiday badges"></p><p>The planning views started to mature on Day 4. PMT added Philippine-friendly holiday maintenance, Gantt non-working-day rules, and the first Road Map view for projects and Sprints.</p><ul><li>Created the Holiday maintenance screen under Settings.</li><li>Skipped weekends and holidays unless work starts on those dates.</li><li>Rendered Project and Sprint bars by start and end dates.</li></ul>',
    0,
    @Jensen,
    @Sin,
    DATEADD(DAY, -28, @Now),
    DATEADD(DAY, -26, @Now)
),
(
    @PmtProject,
    @PmtSprint5,
    N'PMT Day 5 - Audit Trails and Seed Expansion',
    N'<p><img src="/assets/docs/pmt-doc-day05-v2.jpg" alt="PMT audit trail timeline and seed expansion progress bars for PMT, LMS, and HLS"></p><p>Day 5 introduced audit logging for Dev Tasks and bugs so status and completion changes tell a clear story during demos and QA reviews.</p><ul><li>Added task and bug audit popups.</li><li>Seeded LMS as a two-year Agile project.</li><li>Seeded HLS as a five-year waterfall-style AI learning project.</li></ul>',
    0,
    @Bill,
    @Sam,
    DATEADD(DAY, -22, @Now),
    DATEADD(DAY, -20, @Now)
),
(
    @PmtProject,
    @PmtSprint4,
    N'PMT Day 6 - Gantt Fly-by and Road Map Optimization',
    N'<p><img src="/assets/docs/pmt-doc-day06-v2.jpg" alt="PMT Gantt chart with fly-by path and Sprint jump controls"></p><p>Day 6 turned the Gantt chart into a better demo surface. Sprint jump, selected Sprint mode, show-all mode, and the fly-by animation made long projects easier to present.</p><ul><li>Added Sprint dropdown and reset behavior.</li><li>Improved fly-by positioning and pause/resume behavior.</li><li>Compressed the Road Map so multi-year projects fit better.</li></ul>',
    0,
    @Steve,
    @Jensen,
    DATEADD(DAY, -16, @Now),
    DATEADD(DAY, -15, @Now)
),
(
    @PmtProject,
    @PmtSprint5,
    N'PMT Day 7 - Navigation and Sprint Metrics',
    N'<p><img src="/assets/docs/pmt-doc-day07-v2.jpg" alt="PMT navigation bar and Sprint metric progress bars"></p><p>Day 7 cleaned up the top navigation, moved Settings under the user avatar, and made Sprint cards show status progress bars instead of busy legends.</p><ul><li>Renamed Board to Kanban Board and Tasks to Dev Tasks.</li><li>Moved Users and Holidays into Settings.</li><li>Added expand and collapse behavior for Sprint metric cards.</li></ul>',
    0,
    @Sin,
    @Mark,
    DATEADD(DAY, -10, @Now),
    DATEADD(DAY, -9, @Now)
),
(
    @PmtProject,
    @PmtSprint5,
    N'PMT Day 8 - Documentation Card Cleanup',
    N'<p><img src="/assets/docs/pmt-doc-day08-v2.jpg" alt="PMT Documentation cards showing project codes, dates, and right aligned actions"></p><p>Day 8 made Documentation easier to scan. Cards now show project code, created and edited dates, and right-aligned actions with Delete first and Edit last.</p><ul><li>Removed edit count clutter from cards.</li><li>Aligned card actions consistently.</li><li>Kept existing Documentation entries read-only by default.</li></ul>',
    0,
    @Sam,
    NULL,
    DATEADD(DAY, -6, @Now),
    DATEADD(DAY, -6, @Now)
),
(
    @PmtProject,
    @PmtSprint5,
    N'PMT Reorder Design Note',
    N'<p><img src="/assets/docs/pmt-doc-reorder-v2.jpg" alt="PMT Kanban drag and drop reorder flow with drop indicator"></p><p>The latest work adds persistent manual ordering for Backlog, Dev Tasks, bugs, and the Kanban Board. Reordering stays intentionally simple: the browser sends the visible item order and the database stores the new SortOrder values.</p><ul><li>Drag within a list to reprioritize work.</li><li>Drag across Kanban columns to change status and order.</li><li>Use Custom order when demonstrating team priority.</li></ul>',
    0,
    @Jensen,
    @Sin,
    DATEADD(DAY, -3, @Now),
    DATEADD(DAY, -2, @Now)
),
(
    @PmtProject,
    @PmtSprint5,
    N'PMT Current Demo Readiness',
    N'<p><img src="/assets/docs/pmt-doc-demo-v2.jpg" alt="PMT stakeholder demo dashboard with charts, Road Map, and feature badges"></p><p>PMT is now ready for a stakeholder walkthrough that covers Dashboard flow, Road Map planning, Gantt fly-by, Kanban execution, Bug Tracking, Scrum, Documentation, and Settings.</p><ul><li>Dashboard emphasizes progress first and details on demand.</li><li>Planning views support long-running HLS data.</li><li>Seed data now tells a realistic story across PMT, LMS, and HLS.</li></ul>',
    0,
    @Sin,
    NULL,
    @Now,
    @Now
),
(
    @PmtProject,
    @PmtSprint5,
    N'PMT About 3D Visualization and Flyby',
    N'<p><img src="/assets/docs/pmt-doc-about-3d-flyby-v2.jpg?v=20260715-about-3d-seed" alt="Extruded PMT logo surrounded by golden looped flyby paths with mouse-look and WASD control diagrams"></p><p>The About page turns current PMT data into an interactive 3D gallery. Its automated flyby moves through the PMT logo and project visualizations, while mouse and keyboard controls let the viewer explore the scene.</p><ul><li>Follow the continuous cinematic route through the PMT logo, charts, Documentation, and Kanban views.</li><li>Hold the left mouse button to look around, use the wheel to zoom, and use WASD with Q and E to move.</li><li>Press Space to pause or resume, Enter to restart the sequence, and ? to show the controls.</li></ul>',
    0,
    @Sin,
    NULL,
    @Now,
    @Now
);

DECLARE @PmtCurrentDemoDoc INT = (SELECT [BlogId] FROM [pmt].[Blogs] WHERE [ProjectId] = @PmtProject AND [Title] = N'PMT Current Demo Readiness');
DECLARE @PmtPlanningDoc INT = (SELECT [BlogId] FROM [pmt].[Blogs] WHERE [ProjectId] = @PmtProject AND [Title] = N'PMT Day 4 - Holidays, Gantt, and Road Map');

UPDATE [pmt].[Blogs]
SET [ParentBlogId] = @PmtCurrentDemoDoc
WHERE [ProjectId] = @PmtProject
  AND [Title] IN
(
    N'PMT Day 7 - Navigation and Sprint Metrics',
    N'PMT Day 8 - Documentation Card Cleanup',
    N'PMT Reorder Design Note',
    N'PMT About 3D Visualization and Flyby'
);

UPDATE [pmt].[Blogs]
SET [ParentBlogId] = @PmtPlanningDoc
WHERE [ProjectId] = @PmtProject
  AND [Title] = N'PMT Day 6 - Gantt Fly-by and Road Map Optimization';

INSERT INTO [pmt].[BlogHistory] ([BlogId], [Action], [UserId], [CreatedByUserId], [CreatedAt])
SELECT [BlogId], N'Created', [CreatedByUserId], @Sin, [CreatedAt]
FROM [pmt].[Blogs]
WHERE [ProjectId] = @PmtProject;

INSERT INTO [pmt].[BlogHistory] ([BlogId], [Action], [UserId], [CreatedByUserId], [CreatedAt])
SELECT [BlogId], N'Updated', [UpdatedByUserId], @Sin, [UpdatedAt]
FROM [pmt].[Blogs]
WHERE [ProjectId] = @PmtProject
  AND [UpdatedByUserId] IS NOT NULL
  AND [UpdatedAt] > [CreatedAt];

EXEC [pmt].[WriteAudit] N'Seed', @PmtProject, N'Loaded', N'Base PMT seed data was loaded.', @Sin;

COMMIT TRANSACTION;
GO

DECLARE @RetainedPmtQaProjectId INT = (SELECT [PmtProjectId] FROM #Pmt122To123State);
DECLARE @NewPmtProjectId INT =
(
    SELECT [ProjectId]
    FROM [pmt].[Projects]
    WHERE [Code] = N'PMT'
      AND [IsArchived] = 0
);

IF @NewPmtProjectId IS NULL
   OR @NewPmtProjectId = @RetainedPmtQaProjectId
   OR NOT EXISTS
      (
          SELECT 1
          FROM [pmt].[Projects]
          WHERE [ProjectId] = @RetainedPmtQaProjectId
            AND [Code] = N'PMTQA'
            AND [IsArchived] = 0
      )
BEGIN
    THROW 51066, 'PMT and PMTQA Project identities could not be verified.', 1;
END;

IF (SELECT COUNT(*) FROM [pmt].[Projects]) <> (SELECT [ProjectCount] + 1 FROM #Pmt122To123State)
   OR (SELECT COUNT(*) FROM [pmt].[Sprints]) <> (SELECT [SprintCount] + 5 FROM #Pmt122To123State)
   OR (SELECT COUNT(*) FROM [pmt].[WorkTasks]) <> (SELECT [TaskCount] + 31 FROM #Pmt122To123State)
   OR (SELECT COUNT(*) FROM [pmt].[Users]) <> (SELECT [UserCount] + (SELECT COUNT(*) FROM #MissingPmtDemoUsers) FROM #Pmt122To123State)
BEGIN
    THROW 51067, 'The expected database-wide PMT demo row-count changes could not be verified.', 1;
END;

IF (SELECT COUNT(*) FROM [pmt].[ProjectMembers] WHERE [ProjectId] = @RetainedPmtQaProjectId) <> (SELECT [PmtMemberCount] FROM #Pmt122To123State)
   OR (SELECT COUNT(*) FROM [pmt].[Sprints] WHERE [ProjectId] = @RetainedPmtQaProjectId) <> (SELECT [PmtSprintCount] FROM #Pmt122To123State)
   OR (SELECT COUNT(*) FROM [pmt].[WorkTasks] WHERE [ProjectId] = @RetainedPmtQaProjectId) <> (SELECT [PmtTaskCount] FROM #Pmt122To123State)
BEGIN
    THROW 51068, 'The retained PMTQA membership, Sprint, or work-item counts changed unexpectedly.', 1;
END;

IF (SELECT COUNT(*) FROM [pmt].[ProjectMembers] WHERE [ProjectId] = @NewPmtProjectId) <> 6
   OR (SELECT COUNT(*) FROM [pmt].[Sprints] WHERE [ProjectId] = @NewPmtProjectId) <> 5
   OR (SELECT COUNT(*) FROM [pmt].[SprintMembers] AS [Member] INNER JOIN [pmt].[Sprints] AS [Sprint] ON [Sprint].[SprintId] = [Member].[SprintId] WHERE [Sprint].[ProjectId] = @NewPmtProjectId) <> 30
   OR (SELECT COUNT(*) FROM [pmt].[WorkTasks] WHERE [ProjectId] = @NewPmtProjectId) <> 31
   OR (SELECT COUNT(*) FROM [pmt].[WorkTasks] WHERE [ProjectId] = @NewPmtProjectId AND [TaskType] = N'Dev') <> 28
   OR (SELECT COUNT(*) FROM [pmt].[WorkTasks] WHERE [ProjectId] = @NewPmtProjectId AND [TaskType] = N'Bug') <> 3
   OR (SELECT COUNT(*) FROM [pmt].[DevLogs] WHERE [ProjectId] = @NewPmtProjectId AND [LogType] <> N'Log') <> 5
   OR (SELECT COUNT(*) FROM [pmt].[Blogs] WHERE [ProjectId] = @NewPmtProjectId AND [IsPrivate] = 0) <> 11
BEGIN
    THROW 51069, 'The original PMT demo Project content counts could not be verified.', 1;
END;

IF EXISTS
(
    SELECT 1
    FROM [pmt].[Sprints]
    WHERE [ProjectId] = @RetainedPmtQaProjectId
      AND [Code] NOT LIKE N'PMTQA-%'
)
   OR EXISTS
(
    SELECT 1
    FROM [pmt].[WorkTasks]
    WHERE [ProjectId] = @RetainedPmtQaProjectId
      AND [Code] NOT LIKE N'PMTQA-%'
)
   OR EXISTS
(
    SELECT 1
    FROM [pmt].[Sprints]
    WHERE [ProjectId] = @NewPmtProjectId
      AND [Code] NOT LIKE N'PMT-%'
)
   OR EXISTS
(
    SELECT 1
    FROM [pmt].[WorkTasks]
    WHERE [ProjectId] = @NewPmtProjectId
      AND [Code] NOT LIKE N'PMT-%'
)
BEGIN
    THROW 51070, 'PMT or PMTQA child-code prefixes could not be verified.', 1;
END;

IF EXISTS
(
    SELECT [Required].[Email]
    FROM
    (
        VALUES
        (N'louiery@gmail.com'),
        (N'bill.gates@microsoft.com'),
        (N'sam.altman@openai.com'),
        (N'mark.zuckerberg@meta.com'),
        (N'steve.jobs@apple.com'),
        (N'Jensen.Huang@nvidia.com')
    ) AS [Required]([Email])
    LEFT JOIN [pmt].[Users] AS [User]
        ON LOWER(LTRIM(RTRIM([User].[Email]))) = LOWER([Required].[Email])
       AND [User].[IsActive] = 1
    GROUP BY [Required].[Email]
    HAVING COUNT([User].[UserId]) <> 1
)
BEGIN
    THROW 51071, 'The active PMT demo user identities could not be verified.', 1;
END;

IF EXISTS
(
    SELECT 1
    FROM #MissingPmtDemoUsers AS [Missing]
    INNER JOIN [pmt].[Users] AS [User]
        ON LOWER(LTRIM(RTRIM([User].[Email]))) = LOWER([Missing].[Email])
    WHERE [User].[PasswordHash] = HASHBYTES('SHA2_256', CONVERT(NVARCHAR(4000), N'Password1'))
)
BEGIN
    THROW 51072, 'A newly recreated PMT demo user has the public default password.', 1;
END;

IF EXISTS
(
    SELECT 1
    FROM [pmt].[WorkTasks] AS [Bug]
    WHERE [Bug].[ProjectId] = @NewPmtProjectId
      AND [Bug].[TaskType] = N'Bug'
      AND
      (
          NOT EXISTS
          (
              SELECT 1
              FROM [pmt].[Lookups] AS [Severity]
              WHERE [Severity].[LookupType] = N'Severity'
                AND [Severity].[Value] = [Bug].[Severity]
                AND [Severity].[IsActive] = 1
          )
          OR NOT EXISTS
          (
              SELECT 1
              FROM [pmt].[Lookups] AS [Environment]
              WHERE [Environment].[LookupType] = N'Environment'
                AND [Environment].[Value] = [Bug].[Environment]
                AND [Environment].[IsActive] = 1
          )
      )
)
BEGIN
    THROW 51073, 'The PMT demo Bug lookup values are not active in the BDO lookup configuration.', 1;
END;

IF OBJECT_ID(N'[pmt].[EnsurePmtDemoUsers]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[DevelopmentClearUsers]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[RequireDevelopmentSeedRestore]', N'P') IS NULL
   OR ISNULL(CHARINDEX(N'[Code] <> N''PMT''', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[DevelopmentClearProjectData]'))), 0) = 0
   OR ISNULL(CHARINDEX(N'except PMT.', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[DevelopmentClearProjectData]'))), 0) = 0
   OR ISNULL(CHARINDEX(N'DELETE FROM [pmt].[UserPermissions]', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[DevelopmentClearUsers]'))), 0) = 0
   OR ISNULL(CHARINDEX(N'[ActorUserId] = @AdminUserId', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[DevelopmentClearUsers]'))), 0) = 0
   OR ISNULL(CHARINDEX(N'50255', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[DevelopmentClearUsers]'))), 0) > 0
   OR ISNULL(CHARINDEX(N'50257', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[RequireDevelopmentSeedRestore]'))), 0) > 0
BEGIN
    THROW 51074, 'The PMT demo restore or Development reset contract could not be verified.', 1;
END;

IF OBJECT_ID(N'[pmt].[RemoveAttendance]', N'P') IS NULL
   OR NOT EXISTS
      (
          SELECT 1
          FROM sys.parameters
          WHERE [object_id] = OBJECT_ID(N'[pmt].[RecordAttendance]')
            AND [name] = N'@AttendanceDate'
            AND TYPE_NAME([user_type_id]) = N'date'
      )
   OR ISNULL(CHARINDEX(N'WHEN @UserId = @CurrentUserId THEN @LocalToday', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[RecordAttendance]'))), 0) = 0
   OR ISNULL(CHARINDEX(N'DELETE FROM [pmt].[AttendanceEntries]', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[RemoveAttendance]'))), 0) = 0
BEGIN
    THROW 51076, 'The selected-date or attendance-removal contract could not be verified.', 1;
END;

EXEC sys.sp_updateextendedproperty
    @name = N'PMT_DatabaseVersion',
    @value = N'1.23';

IF NOT EXISTS
(
    SELECT 1
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_DatabaseVersion'
      AND CONVERT(NVARCHAR(20), [value]) = N'1.23'
)
BEGIN
    THROW 51075, 'PMT Database Version 1.23 could not be verified.', 1;
END;

COMMIT TRANSACTION;
GO

PRINT N'PMT Database Version 1.23 applied: PMTQA was preserved during migration, the PMT demo was restored, Development resets were updated, and selected-date attendance plus audited attendance removal are available.';
GO
