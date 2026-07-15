/*
    PMT Database Version 1.16 -> 1.17

    Adds opaque ROWVERSION edit tokens for shared PMT records and the focused
    stored procedures used by the application to reject stale saves. Existing
    business rows and values are preserved.
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
   OR OBJECT_ID(N'[pmt].[Projects]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[Sprints]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[WorkTasks]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[DevLogs]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[Blogs]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[Lookups]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[Holidays]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[WfhSchedules]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[VacationPlans]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[SecurityResources]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[UpsertTask]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[UpsertBlog]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[GetWfhSchedule]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[AcceptUserInvitation]', N'P') IS NULL
BEGIN
    THROW 51010, 'PMT Database Version 1.16 objects are required before applying Version 1.17.', 1;
END;
GO

DECLARE @DatabaseVersion NVARCHAR(20) =
(
    SELECT CONVERT(NVARCHAR(20), [value])
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_DatabaseVersion'
);

IF ISNULL(@DatabaseVersion, N'') NOT IN (N'1.16', N'1.17')
BEGIN
    THROW 51011, 'PMT Database Version 1.16 is required before applying Version 1.17.', 1;
END;

IF @DatabaseVersion = N'1.17'
   AND
   (
       COL_LENGTH(N'pmt.Users', N'RowVersion') IS NULL
       OR COL_LENGTH(N'pmt.Projects', N'RowVersion') IS NULL
       OR COL_LENGTH(N'pmt.Sprints', N'RowVersion') IS NULL
       OR COL_LENGTH(N'pmt.WorkTasks', N'RowVersion') IS NULL
       OR COL_LENGTH(N'pmt.DevLogs', N'RowVersion') IS NULL
       OR COL_LENGTH(N'pmt.Blogs', N'RowVersion') IS NULL
       OR COL_LENGTH(N'pmt.Lookups', N'RowVersion') IS NULL
       OR COL_LENGTH(N'pmt.Holidays', N'RowVersion') IS NULL
       OR COL_LENGTH(N'pmt.WfhSchedules', N'RowVersion') IS NULL
       OR COL_LENGTH(N'pmt.VacationPlans', N'RowVersion') IS NULL
       OR COL_LENGTH(N'pmt.SecurityResources', N'RowVersion') IS NULL
       OR OBJECT_ID(N'[pmt].[GetEditVersions]', N'P') IS NULL
       OR OBJECT_ID(N'[pmt].[LockEditVersion]', N'P') IS NULL
       OR OBJECT_ID(N'[pmt].[TouchEditVersion]', N'P') IS NULL
       OR OBJECT_ID(N'[pmt].[LockBlogWrites]', N'P') IS NULL
       OR OBJECT_ID(N'[pmt].[LockWorkTaskWrites]', N'P') IS NULL
       OR OBJECT_ID(N'[pmt].[LockSprintWrites]', N'P') IS NULL
       OR OBJECT_ID(N'[pmt].[GetWfhSchedule]', N'P') IS NULL
       OR OBJECT_ID(N'[pmt].[AcceptUserInvitation]', N'P') IS NULL
   )
BEGIN
    THROW 51012, 'PMT Database Version 1.17 is recorded, but its save-collision contract is incomplete. Investigate before continuing.', 1;
END;
GO

IF COL_LENGTH(N'pmt.Users', N'RowVersion') IS NULL
    ALTER TABLE [pmt].[Users] ADD [RowVersion] ROWVERSION NOT NULL;
GO

IF COL_LENGTH(N'pmt.Projects', N'RowVersion') IS NULL
    ALTER TABLE [pmt].[Projects] ADD [RowVersion] ROWVERSION NOT NULL;
GO

IF COL_LENGTH(N'pmt.Sprints', N'RowVersion') IS NULL
    ALTER TABLE [pmt].[Sprints] ADD [RowVersion] ROWVERSION NOT NULL;
GO

IF COL_LENGTH(N'pmt.WorkTasks', N'RowVersion') IS NULL
    ALTER TABLE [pmt].[WorkTasks] ADD [RowVersion] ROWVERSION NOT NULL;
GO

IF COL_LENGTH(N'pmt.DevLogs', N'RowVersion') IS NULL
    ALTER TABLE [pmt].[DevLogs] ADD [RowVersion] ROWVERSION NOT NULL;
GO

IF COL_LENGTH(N'pmt.Blogs', N'RowVersion') IS NULL
    ALTER TABLE [pmt].[Blogs] ADD [RowVersion] ROWVERSION NOT NULL;
GO

IF COL_LENGTH(N'pmt.Lookups', N'RowVersion') IS NULL
    ALTER TABLE [pmt].[Lookups] ADD [RowVersion] ROWVERSION NOT NULL;
GO

IF COL_LENGTH(N'pmt.Holidays', N'RowVersion') IS NULL
    ALTER TABLE [pmt].[Holidays] ADD [RowVersion] ROWVERSION NOT NULL;
GO

IF COL_LENGTH(N'pmt.WfhSchedules', N'RowVersion') IS NULL
    ALTER TABLE [pmt].[WfhSchedules] ADD [RowVersion] ROWVERSION NOT NULL;
GO

IF COL_LENGTH(N'pmt.VacationPlans', N'RowVersion') IS NULL
    ALTER TABLE [pmt].[VacationPlans] ADD [RowVersion] ROWVERSION NOT NULL;
GO

IF COL_LENGTH(N'pmt.SecurityResources', N'RowVersion') IS NULL
    ALTER TABLE [pmt].[SecurityResources] ADD [RowVersion] ROWVERSION NOT NULL;
GO

CREATE OR ALTER PROCEDURE [pmt].[GetEditVersions]
    @CurrentUserId INT,
    @EntityType NVARCHAR(40) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        [Version].[EntityType],
        [Version].[EntityKey],
        [Version].[RowVersion]
    FROM
    (
        SELECT N'User', CONVERT(NVARCHAR(80), [UserId]), CONVERT(VARBINARY(8), [RowVersion])
        FROM [pmt].[Users]
        WHERE [IsActive] = 1

        UNION ALL

        SELECT N'Project', CONVERT(NVARCHAR(80), [ProjectId]), CONVERT(VARBINARY(8), [RowVersion])
        FROM [pmt].[Projects]
        WHERE [IsArchived] = 0

        UNION ALL

        SELECT N'Sprint', CONVERT(NVARCHAR(80), [SprintId]), CONVERT(VARBINARY(8), [RowVersion])
        FROM [pmt].[Sprints]
        WHERE [IsDeleted] = 0

        UNION ALL

        SELECT N'WorkTask', CONVERT(NVARCHAR(80), [TaskId]), CONVERT(VARBINARY(8), [RowVersion])
        FROM [pmt].[WorkTasks]
        WHERE [IsDeleted] = 0

        UNION ALL

        SELECT N'DevLog', CONVERT(NVARCHAR(80), [DevLogId]), CONVERT(VARBINARY(8), [RowVersion])
        FROM [pmt].[DevLogs]
        WHERE [IsDeleted] = 0
          AND ([LogType] <> N'Log' OR [UserId] = @CurrentUserId)

        UNION ALL

        SELECT N'Blog', CONVERT(NVARCHAR(80), [BlogId]), CONVERT(VARBINARY(8), [RowVersion])
        FROM [pmt].[Blogs]
        WHERE [IsDeleted] = 0
          AND ([IsPrivate] = 0 OR [CreatedByUserId] = @CurrentUserId)

        UNION ALL

        SELECT N'Lookup', CONVERT(NVARCHAR(80), [LookupId]), CONVERT(VARBINARY(8), [RowVersion])
        FROM [pmt].[Lookups]

        UNION ALL

        SELECT N'Holiday', CONVERT(NVARCHAR(80), [HolidayId]), CONVERT(VARBINARY(8), [RowVersion])
        FROM [pmt].[Holidays]

        UNION ALL

        SELECT N'SecurityResource', [ResourceKey], CONVERT(VARBINARY(8), [RowVersion])
        FROM [pmt].[SecurityResources]

        UNION ALL

        SELECT N'WfhSchedule', CONVERT(NVARCHAR(80), [Wfh].[UserId]), CONVERT(VARBINARY(8), [Wfh].[RowVersion])
        FROM [pmt].[WfhSchedules] AS [Wfh]
        INNER JOIN [pmt].[Users] AS [User]
            ON [User].[UserId] = [Wfh].[UserId]
           AND [User].[IsActive] = 1

        UNION ALL

        SELECT N'Vacation', CONVERT(NVARCHAR(80), [VacationPlanId]), CONVERT(VARBINARY(8), [RowVersion])
        FROM [pmt].[VacationPlans]
        WHERE [IsCancelled] = 0
    ) AS [Version] ([EntityType], [EntityKey], [RowVersion])
    WHERE @EntityType IS NULL OR [Version].[EntityType] = @EntityType
    ORDER BY [Version].[EntityType], [Version].[EntityKey];
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[LockEditVersion]
    @EntityType NVARCHAR(40),
    @EntityKey NVARCHAR(80)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @EntityId INT = TRY_CONVERT(INT, @EntityKey);
    DECLARE @RowVersion VARBINARY(8);

    IF @EntityType = N'User'
        SELECT @RowVersion = [RowVersion] FROM [pmt].[Users] WITH (UPDLOCK, HOLDLOCK) WHERE [UserId] = @EntityId AND [IsActive] = 1;
    ELSE IF @EntityType = N'Project'
        SELECT @RowVersion = [RowVersion] FROM [pmt].[Projects] WITH (UPDLOCK, HOLDLOCK) WHERE [ProjectId] = @EntityId AND [IsArchived] = 0;
    ELSE IF @EntityType = N'Sprint'
        SELECT @RowVersion = [RowVersion] FROM [pmt].[Sprints] WITH (UPDLOCK, HOLDLOCK) WHERE [SprintId] = @EntityId AND [IsDeleted] = 0;
    ELSE IF @EntityType = N'WorkTask'
        SELECT @RowVersion = [RowVersion] FROM [pmt].[WorkTasks] WITH (UPDLOCK, HOLDLOCK) WHERE [TaskId] = @EntityId AND [IsDeleted] = 0;
    ELSE IF @EntityType = N'DevLog'
        SELECT @RowVersion = [RowVersion] FROM [pmt].[DevLogs] WITH (UPDLOCK, HOLDLOCK) WHERE [DevLogId] = @EntityId AND [IsDeleted] = 0;
    ELSE IF @EntityType = N'Blog'
        SELECT @RowVersion = [RowVersion] FROM [pmt].[Blogs] WITH (UPDLOCK, HOLDLOCK) WHERE [BlogId] = @EntityId AND [IsDeleted] = 0;
    ELSE IF @EntityType = N'Lookup'
        SELECT @RowVersion = [RowVersion] FROM [pmt].[Lookups] WITH (UPDLOCK, HOLDLOCK) WHERE [LookupId] = @EntityId;
    ELSE IF @EntityType = N'Holiday'
        SELECT @RowVersion = [RowVersion] FROM [pmt].[Holidays] WITH (UPDLOCK, HOLDLOCK) WHERE [HolidayId] = @EntityId;
    ELSE IF @EntityType = N'WfhSchedule'
        SELECT @RowVersion = [RowVersion] FROM [pmt].[WfhSchedules] WITH (UPDLOCK, HOLDLOCK) WHERE [UserId] = @EntityId;
    ELSE IF @EntityType = N'Vacation'
        SELECT @RowVersion = [RowVersion] FROM [pmt].[VacationPlans] WITH (UPDLOCK, HOLDLOCK) WHERE [VacationPlanId] = @EntityId AND [IsCancelled] = 0;
    ELSE IF @EntityType = N'SecurityResource'
        SELECT @RowVersion = [RowVersion] FROM [pmt].[SecurityResources] WITH (UPDLOCK, HOLDLOCK) WHERE [ResourceKey] = @EntityKey;
    ELSE
        THROW 51001, 'The edit-version entity type is invalid.', 1;

    SELECT [RowVersion] = @RowVersion;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[TouchEditVersion]
    @EntityType NVARCHAR(40),
    @EntityKey NVARCHAR(80) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @EntityType <> N'SecurityResource'
    BEGIN
        THROW 51001, 'The edit-version entity type cannot be touched explicitly.', 1;
    END;

    UPDATE [pmt].[SecurityResources]
    SET [Name] = [Name]
    WHERE @EntityKey IS NULL OR [ResourceKey] = @EntityKey;
END;
GO

-- Acquire multi-scope write locks in this order: Blog, WorkTask, Sprint.
CREATE OR ALTER PROCEDURE [pmt].[LockBlogWrites]
AS
BEGIN
    SET NOCOUNT ON;

    IF @@TRANCOUNT = 0
    BEGIN
        THROW 51004, 'A transaction is required to lock Blog writes.', 1;
    END;

    DECLARE @LockResult INT;
    EXEC @LockResult = sys.sp_getapplock
        @Resource = N'pmt:BlogWrites',
        @LockMode = N'Exclusive',
        @LockOwner = N'Transaction',
        @LockTimeout = 30000;

    IF @LockResult < 0
    BEGIN
        THROW 51005, 'The Blog write lock could not be acquired.', 1;
    END;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[LockWorkTaskWrites]
AS
BEGIN
    SET NOCOUNT ON;

    IF @@TRANCOUNT = 0
    BEGIN
        THROW 51002, 'A transaction is required to lock WorkTask writes.', 1;
    END;

    DECLARE @LockResult INT;
    EXEC @LockResult = sys.sp_getapplock
        @Resource = N'pmt:WorkTaskWrites',
        @LockMode = N'Exclusive',
        @LockOwner = N'Transaction',
        @LockTimeout = 30000;

    IF @LockResult < 0
    BEGIN
        THROW 51003, 'The WorkTask write lock could not be acquired.', 1;
    END;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[LockSprintWrites]
AS
BEGIN
    SET NOCOUNT ON;

    IF @@TRANCOUNT = 0
    BEGIN
        THROW 51006, 'A transaction is required to lock Sprint writes.', 1;
    END;

    DECLARE @LockResult INT;
    EXEC @LockResult = sys.sp_getapplock
        @Resource = N'pmt:SprintWrites',
        @LockMode = N'Exclusive',
        @LockOwner = N'Transaction',
        @LockTimeout = 30000;

    IF @LockResult < 0
    BEGIN
        THROW 51007, 'The Sprint write lock could not be acquired.', 1;
    END;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[GetWfhSchedule]
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM [pmt].[Users] WHERE [UserId] = @CurrentUserId AND [IsActive] = 1)
    BEGIN
        THROW 50060, 'Only active users can view the WFH schedule.', 1;
    END;

    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @LockResult INT;
        EXEC @LockResult = sys.sp_getapplock
            @Resource = N'pmt:WfhScheduleInitialization',
            @LockMode = N'Exclusive',
            @LockOwner = N'Transaction',
            @LockTimeout = 30000
            WITH RESULT SETS NONE;

        IF @LockResult < 0
        BEGIN
            THROW 51008, 'The WFH schedule initialization lock could not be acquired.', 1;
        END;

        DECLARE @MaxSortOrder INT = ISNULL((SELECT MAX([SortOrder]) FROM [pmt].[WfhSchedules]), 0);

        ;WITH MissingUsers AS
        (
            SELECT
                [Users].[UserId],
                [RowNumber] = ROW_NUMBER() OVER (ORDER BY [Users].[Nickname], [Users].[FirstName], [Users].[UserId])
            FROM [pmt].[Users]
            WHERE [Users].[IsActive] = 1
              AND NOT EXISTS
              (
                  SELECT 1
                  FROM [pmt].[WfhSchedules] WITH (UPDLOCK, HOLDLOCK)
                  WHERE [WfhSchedules].[UserId] = [Users].[UserId]
              )
        )
        INSERT INTO [pmt].[WfhSchedules] ([UserId], [SortOrder], [CreatedByUserId], [CreatedAt], [UpdatedAt])
        SELECT [UserId], @MaxSortOrder + ([RowNumber] * 10), @CurrentUserId, SYSUTCDATETIME(), SYSUTCDATETIME()
        FROM MissingUsers;

        SELECT
            [Users].[UserId],
            [Users].[FirstName],
            [Users].[LastName],
            [Users].[Nickname],
            [Users].[AvatarUrl],
            [Role] = CASE WHEN [Users].[IsAdmin] = 1 THEN N'Admin' ELSE [Users].[Role] END,
            [WfhSchedules].[CanWorkMonday],
            [WfhSchedules].[CanWorkTuesday],
            [WfhSchedules].[CanWorkWednesday],
            [WfhSchedules].[CanWorkThursday],
            [WfhSchedules].[CanWorkFriday],
            [WfhSchedules].[IsHidden],
            [WfhSchedules].[SortOrder],
            [WfhSchedules].[RowVersion]
        FROM [pmt].[Users]
        INNER JOIN [pmt].[WfhSchedules]
            ON [WfhSchedules].[UserId] = [Users].[UserId]
        WHERE [Users].[IsActive] = 1
        ORDER BY [WfhSchedules].[SortOrder], [Users].[Nickname], [Users].[FirstName], [Users].[UserId];

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0
            ROLLBACK TRANSACTION;

        THROW;
    END CATCH;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[AcceptUserInvitation]
    @TokenHash VARBINARY(32),
    @Nickname NVARCHAR(80),
    @Password NVARCHAR(4000),
    @AvatarUrl NVARCHAR(500)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Nickname = NULLIF(LTRIM(RTRIM(@Nickname)), N'');
    SET @AvatarUrl = NULLIF(LTRIM(RTRIM(@AvatarUrl)), N'');

    IF @Nickname IS NULL
    BEGIN
        THROW 50204, 'Username is required.', 1;
    END;

    IF LEN(@Nickname) > 80
    BEGIN
        THROW 50204, 'Username cannot exceed 80 characters.', 1;
    END;

    IF LEN(ISNULL(@Password, N'')) < 8
    BEGIN
        THROW 50205, 'Password must be at least 8 characters.', 1;
    END;

    IF @AvatarUrl IS NULL
    BEGIN
        THROW 50206, 'Select or upload an avatar before continuing.', 1;
    END;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @UserInvitationId INT;
    DECLARE @InvitedByUserId INT;
    DECLARE @UserId INT;
    DECLARE @ProjectCount INT;
    DECLARE @OnlyProjectId INT;
    DECLARE @NextView NVARCHAR(20) = N'Projects';

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Keep the lock order consistent with Security saves: resource first,
        -- then Users and permission-shaping data.
        EXEC [pmt].[TouchEditVersion] N'SecurityResource', NULL;

        SELECT
            @UserInvitationId = [UserInvitationId],
            @InvitedByUserId = [CreatedByUserId]
        FROM [pmt].[UserInvitations] WITH (UPDLOCK, HOLDLOCK)
        WHERE [TokenHash] = @TokenHash
          AND [ExpiresAt] > @Now;

        IF @UserInvitationId IS NULL
        BEGIN
            THROW 50207, 'This invitation is invalid or has expired.', 1;
        END;

        IF NOT EXISTS
        (
            SELECT 1
            FROM [pmt].[UserInvitationProjects] AS [InvitationProject]
            INNER JOIN [pmt].[Projects] AS [Project] WITH (UPDLOCK, HOLDLOCK)
                ON [Project].[ProjectId] = [InvitationProject].[ProjectId]
               AND [Project].[IsArchived] = 0
            WHERE [InvitationProject].[UserInvitationId] = @UserInvitationId
        )
        BEGIN
            THROW 50209, 'This invitation no longer contains an active project.', 1;
        END;

        -- Project members are part of the Project editor's full save payload.
        -- Lock and advance every affected Project before inserting members so
        -- this transaction follows the same Project -> ProjectMembers order as
        -- a Project save, including invitations that contain several projects.
        UPDATE [Project]
        SET [UpdatedAt] = [Project].[UpdatedAt]
        FROM [pmt].[Projects] AS [Project]
        INNER JOIN [pmt].[UserInvitationProjects] AS [InvitationProject]
            ON [InvitationProject].[ProjectId] = [Project].[ProjectId]
        WHERE [InvitationProject].[UserInvitationId] = @UserInvitationId
          AND [Project].[IsArchived] = 0;

        IF EXISTS
        (
            SELECT 1
            FROM [pmt].[Users] WITH (UPDLOCK, HOLDLOCK)
            WHERE [IsActive] = 1
              AND
              (
                  LOWER(LTRIM(RTRIM([Nickname]))) = LOWER(@Nickname)
                  OR LOWER(LTRIM(RTRIM(ISNULL([Email], N'')))) = LOWER(@Nickname)
              )
        )
        BEGIN
            THROW 50208, 'That username is already in use. Choose another username.', 1;
        END;

        INSERT INTO [pmt].[Users]
        (
            [FirstName],
            [LastName],
            [Nickname],
            [Email],
            [AvatarUrl],
            [PasswordHash],
            [IsAdmin],
            [Role],
            [CreatedByUserId],
            [CreatedAt],
            [UpdatedAt]
        )
        VALUES
        (
            @Nickname,
            N'',
            @Nickname,
            NULL,
            @AvatarUrl,
            HASHBYTES('SHA2_256', CONVERT(NVARCHAR(4000), @Password)),
            0,
            N'Developer',
            @InvitedByUserId,
            @Now,
            @Now
        );

        SET @UserId = SCOPE_IDENTITY();

        INSERT INTO [pmt].[ProjectMembers]
        (
            [ProjectId],
            [UserId],
            [CreatedByUserId],
            [CreatedAt]
        )
        SELECT
            [InvitationProject].[ProjectId],
            @UserId,
            @InvitedByUserId,
            @Now
        FROM [pmt].[UserInvitationProjects] AS [InvitationProject]
        INNER JOIN [pmt].[Projects] AS [Project]
            ON [Project].[ProjectId] = [InvitationProject].[ProjectId]
           AND [Project].[IsArchived] = 0
        WHERE [InvitationProject].[UserInvitationId] = @UserInvitationId;

        EXEC [pmt].[WriteAudit]
            N'User',
            @UserId,
            N'Created from Invitation',
            @Nickname,
            @InvitedByUserId;

        SELECT
            @ProjectCount = COUNT(*),
            @OnlyProjectId = MIN([Project].[ProjectId])
        FROM [pmt].[UserInvitationProjects] AS [InvitationProject]
        INNER JOIN [pmt].[Projects] AS [Project]
            ON [Project].[ProjectId] = [InvitationProject].[ProjectId]
           AND [Project].[IsArchived] = 0
        WHERE [InvitationProject].[UserInvitationId] = @UserInvitationId;

        IF @ProjectCount <> 1
        BEGIN
            SET @OnlyProjectId = NULL;
        END;

        IF @OnlyProjectId IS NOT NULL
           AND EXISTS
           (
               SELECT 1
               FROM [pmt].[Sprints]
               WHERE [ProjectId] = @OnlyProjectId
                 AND [IsDeleted] = 0
           )
        BEGIN
            SET @NextView = N'Sprints';
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

    SELECT
        [UserId] = @UserId,
        [Nickname] = @Nickname,
        [IsAdmin] = CONVERT(BIT, 0),
        [Role] = N'Developer',
        [NextView] = @NextView,
        [ProjectId] = @OnlyProjectId;
END;
GO

IF
(
    SELECT COUNT(*)
    FROM sys.columns AS [Column]
    WHERE [Column].[name] = N'RowVersion'
      AND [Column].[system_type_id] = 189
      AND [Column].[object_id] IN
      (
          OBJECT_ID(N'[pmt].[Users]'),
          OBJECT_ID(N'[pmt].[Projects]'),
          OBJECT_ID(N'[pmt].[Sprints]'),
          OBJECT_ID(N'[pmt].[WorkTasks]'),
          OBJECT_ID(N'[pmt].[DevLogs]'),
          OBJECT_ID(N'[pmt].[Blogs]'),
          OBJECT_ID(N'[pmt].[Lookups]'),
          OBJECT_ID(N'[pmt].[Holidays]'),
          OBJECT_ID(N'[pmt].[WfhSchedules]'),
          OBJECT_ID(N'[pmt].[VacationPlans]'),
          OBJECT_ID(N'[pmt].[SecurityResources]')
      )
) <> 11
OR OBJECT_ID(N'[pmt].[GetEditVersions]', N'P') IS NULL
OR OBJECT_ID(N'[pmt].[LockEditVersion]', N'P') IS NULL
OR OBJECT_ID(N'[pmt].[TouchEditVersion]', N'P') IS NULL
OR OBJECT_ID(N'[pmt].[LockBlogWrites]', N'P') IS NULL
OR OBJECT_ID(N'[pmt].[LockWorkTaskWrites]', N'P') IS NULL
OR OBJECT_ID(N'[pmt].[LockSprintWrites]', N'P') IS NULL
OR OBJECT_ID(N'[pmt].[GetWfhSchedule]', N'P') IS NULL
OR OBJECT_ID(N'[pmt].[AcceptUserInvitation]', N'P') IS NULL
OR NOT EXISTS
(
    SELECT 1
    FROM sys.dm_exec_describe_first_result_set_for_object(OBJECT_ID(N'[pmt].[GetWfhSchedule]'), 0)
    WHERE [name] = N'RowVersion'
)
BEGIN
    THROW 51013, 'PMT Version 1.17 save-collision objects could not be verified. The database version was not changed.', 1;
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
        @value = N'1.17';
END
ELSE
BEGIN
    EXEC sys.sp_addextendedproperty
        @name = N'PMT_DatabaseVersion',
        @value = N'1.17';
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_DatabaseVersion'
      AND CONVERT(NVARCHAR(20), [value]) = N'1.17'
)
BEGIN
    THROW 51014, 'PMT Database Version 1.17 could not be recorded.', 1;
END;
GO

PRINT N'PMT Database Version 1.17 applied: stale shared-record saves are rejected using ROWVERSION edit tokens.';
GO
