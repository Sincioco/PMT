/*
    PMT Version 1.23 stored procedures.
    The application uses ADO.NET and calls these procedures directly.
    The SQL is intentionally explicit so future maintainers can trace each save action.
*/

USE [PMT];
GO

CREATE OR ALTER FUNCTION [pmt].[SplitIds](@Ids NVARCHAR(MAX))
RETURNS TABLE
AS
RETURN
(
    SELECT DISTINCT [Id] = TRY_CONVERT(INT, LTRIM(RTRIM([value])))
    FROM STRING_SPLIT(ISNULL(@Ids, N''), N',')
    WHERE TRY_CONVERT(INT, LTRIM(RTRIM([value]))) IS NOT NULL
);
GO

CREATE OR ALTER FUNCTION [pmt].[IsAdmin](@UserId INT)
RETURNS BIT
AS
BEGIN
    DECLARE @IsAdmin BIT = 0;

    SELECT @IsAdmin = [IsAdmin]
    FROM [pmt].[Users]
    WHERE [UserId] = @UserId
      AND [IsActive] = 1;

    RETURN ISNULL(@IsAdmin, 0);
END;
GO

CREATE OR ALTER FUNCTION [pmt].[CanEdit](@OwnerUserId INT, @CurrentUserId INT)
RETURNS BIT
AS
BEGIN
    -- Resource/action authorization is performed by RequirePermission before
    -- application writes. Keep this legacy ownership gate permissive so an
    -- explicit Update right can override the old owner-only behavior.
    IF [pmt].[IsAdmin](@CurrentUserId) = 1 OR @OwnerUserId = @CurrentUserId
    BEGIN
        RETURN 1;
    END;

    IF EXISTS (SELECT 1 FROM [pmt].[Users] WHERE [UserId] = @CurrentUserId AND [IsActive] = 1)
    BEGIN
        RETURN 1;
    END;

    RETURN 0;
END;
GO

CREATE OR ALTER FUNCTION [pmt].[UserRole](@UserId INT)
RETURNS NVARCHAR(20)
AS
BEGIN
    DECLARE @Role NVARCHAR(20) = N'Developer';

    SELECT @Role = CASE WHEN [IsAdmin] = 1 THEN N'Admin' ELSE ISNULL(NULLIF([Role], N''), N'Developer') END
    FROM [pmt].[Users]
    WHERE [UserId] = @UserId
      AND [IsActive] = 1;

    RETURN ISNULL(@Role, N'Developer');
END;
GO

CREATE OR ALTER FUNCTION [pmt].[HasPermission]
(
    @UserId INT,
    @ResourceKey NVARCHAR(40),
    @Right NVARCHAR(20)
)
RETURNS BIT
AS
BEGIN
    IF [pmt].[IsAdmin](@UserId) = 1
    BEGIN
        RETURN 1;
    END;

    IF NOT EXISTS (SELECT 1 FROM [pmt].[Users] WHERE [UserId] = @UserId AND [IsActive] = 1)
       OR NOT EXISTS (SELECT 1 FROM [pmt].[SecurityResources] WHERE [ResourceKey] = @ResourceKey)
    BEGIN
        RETURN 0;
    END;

    DECLARE @RoleCode NVARCHAR(20) = [pmt].[UserRole](@UserId);
    DECLARE @RoleNoAccess BIT = 0;
    DECLARE @UserNoAccess BIT = 0;
    DECLARE @RoleAllowed BIT = 0;
    DECLARE @UserAllowed BIT = 0;
    DECLARE @HasUserOverride BIT = 0;

    SELECT
        @RoleNoAccess = [NoAccess],
        @RoleAllowed = CASE @Right
            WHEN N'Read' THEN [CanRead]
            WHEN N'Create' THEN [CanCreate]
            WHEN N'Update' THEN [CanUpdate]
            WHEN N'Delete' THEN [CanDelete]
            WHEN N'Import' THEN [CanImport]
            WHEN N'Export' THEN [CanExport]
            ELSE 0
        END
    FROM [pmt].[RolePermissions]
    WHERE [RoleCode] = @RoleCode
      AND [ResourceKey] = @ResourceKey;

    SELECT
        @HasUserOverride = 1,
        @UserNoAccess = [NoAccess],
        @UserAllowed = CASE @Right
            WHEN N'Read' THEN [CanRead]
            WHEN N'Create' THEN [CanCreate]
            WHEN N'Update' THEN [CanUpdate]
            WHEN N'Delete' THEN [CanDelete]
            WHEN N'Import' THEN [CanImport]
            WHEN N'Export' THEN [CanExport]
            ELSE 0
        END
    FROM [pmt].[UserPermissions]
    WHERE [UserId] = @UserId
      AND [ResourceKey] = @ResourceKey;

    IF ISNULL(@RoleNoAccess, 0) = 1 OR ISNULL(@UserNoAccess, 0) = 1
    BEGIN
        RETURN 0;
    END;

    IF @HasUserOverride = 1
    BEGIN
        RETURN ISNULL(@UserAllowed, 0);
    END;

    RETURN ISNULL(@RoleAllowed, 0);
END;
GO

CREATE OR ALTER FUNCTION [pmt].[CanEditTaskType](@TaskType NVARCHAR(20), @CurrentUserId INT)
RETURNS BIT
AS
BEGIN
    DECLARE @ResourceKey NVARCHAR(40) = CASE WHEN @TaskType = N'Bug' THEN N'BugTracking' ELSE N'DevTasks' END;

    RETURN CASE WHEN
        [pmt].[HasPermission](@CurrentUserId, @ResourceKey, N'Create') = 1
        OR [pmt].[HasPermission](@CurrentUserId, @ResourceKey, N'Update') = 1
        OR [pmt].[HasPermission](@CurrentUserId, @ResourceKey, N'Delete') = 1
        OR [pmt].[HasPermission](@CurrentUserId, @ResourceKey, N'Import') = 1
        THEN 1 ELSE 0 END;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[RequirePermission]
    @CurrentUserId INT,
    @ResourceKey NVARCHAR(40),
    @Right NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    IF [pmt].[HasPermission](@CurrentUserId, @ResourceKey, @Right) = 0
    BEGIN
        THROW 50120, 'You do not have permission to perform this action.', 1;
    END;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[RequireTaskPermission]
    @CurrentUserId INT,
    @TaskId INT,
    @Right NVARCHAR(20),
    @UseBacklogPermission BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @TaskType NVARCHAR(20);
    SELECT @TaskType = [TaskType]
    FROM [pmt].[WorkTasks]
    WHERE [TaskId] = @TaskId
      AND [IsDeleted] = 0;

    IF @TaskType IS NULL
    BEGIN
        THROW 50121, 'Task was not found.', 1;
    END;

    DECLARE @ResourceKey NVARCHAR(40) = CASE
        WHEN @UseBacklogPermission = 1 THEN N'Backlog'
        WHEN @TaskType = N'Bug' THEN N'BugTracking'
        ELSE N'DevTasks'
    END;

    EXEC [pmt].[RequirePermission] @CurrentUserId, @ResourceKey, @Right;
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

CREATE OR ALTER PROCEDURE [pmt].[WriteAudit]
    @EntityType NVARCHAR(40),
    @EntityId INT,
    @Action NVARCHAR(80),
    @Details NVARCHAR(MAX),
    @UserId INT,
    @OldStatus NVARCHAR(40) = NULL,
    @NewStatus NVARCHAR(40) = NULL,
    @OldPercentCompleted INT = NULL,
    @NewPercentCompleted INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ActorUserId INT = TRY_CONVERT(INT, SESSION_CONTEXT(N'PMT_ActorUserId'));
    IF @ActorUserId IS NULL
       OR NOT EXISTS (SELECT 1 FROM [pmt].[Users] WHERE [UserId] = @ActorUserId)
    BEGIN
        SET @ActorUserId = @UserId;
    END;

    INSERT INTO [pmt].[AuditEvents]
    (
        [EntityType],
        [EntityId],
        [Action],
        [Details],
        [OldStatus],
        [NewStatus],
        [OldPercentCompleted],
        [NewPercentCompleted],
        [UserId],
        [ActorUserId],
        [CreatedByUserId]
    )
    VALUES
    (
        @EntityType,
        @EntityId,
        @Action,
        @Details,
        @OldStatus,
        @NewStatus,
        @OldPercentCompleted,
        @NewPercentCompleted,
        @UserId,
        @ActorUserId,
        @UserId
    );
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[GetAppState]
    @CurrentUserId INT = 1
AS
BEGIN
    SET NOCOUNT ON;

    -- The API reads these result sets in this exact order.
    SELECT
        [UserId],
        [FirstName],
        [LastName],
        [Nickname],
        [Email],
        [Phone],
        [AvatarUrl],
        [HomePageUrl],
        [SocialMediaUrl],
        [Bio],
        [IsAdmin],
        [Role],
        [IsActive]
    FROM [pmt].[Users]
    WHERE [IsActive] = 1
    ORDER BY [Nickname], [FirstName];

    SELECT
        [ProjectId],
        [Code],
        [Title],
        [Description],
        [Url],
        [IconUrl],
        [StartDate],
        [EndDate],
        [CreatedByUserId],
        [UpdatedByUserId],
        [CreatedAt],
        [UpdatedAt]
    FROM [pmt].[Projects]
    WHERE [IsArchived] = 0
    ORDER BY [Code];

    SELECT
        [ProjectId],
        [UserId]
    FROM [pmt].[ProjectMembers]
    ORDER BY [ProjectId], [UserId];

    SELECT
        [SprintId],
        [ProjectId],
        [Code],
        [Title],
        [Description],
        [StartDate],
        [EndDate],
        [LessonLearnedHtml],
        [IsFinished],
        [CreatedByUserId],
        [UpdatedByUserId],
        [CreatedAt],
        [UpdatedAt]
    FROM [pmt].[Sprints]
    WHERE [IsDeleted] = 0
    ORDER BY [StartDate] DESC, [SprintId] DESC;

    SELECT
        [SprintId],
        [UserId]
    FROM [pmt].[SprintMembers]
    ORDER BY [SprintId], [UserId];

    SELECT
        [TaskId],
        [ProjectId],
        [SprintId],
        [ParentTaskId],
        [TaskType],
        [Code],
        [Title],
        CASE
            WHEN EXISTS
            (
                SELECT 1
                FROM [pmt].[Blogs] AS [LinkedBlog]
                WHERE [LinkedBlog].[BlogId] = [WorkTask].[LinkedBlogId]
                  AND [LinkedBlog].[IsPrivate] = 1
                  AND [LinkedBlog].[CreatedByUserId] <> @CurrentUserId
            ) THEN N''
            WHEN [WorkTask].[LinkedBlogId] IS NULL
             AND [WorkTask].[DescriptionHtml] LIKE N'%data-documentation-link=%'
             AND [WorkTask].[DescriptionHtml] LIKE N'%View generated Documentation:%'
                THEN N''
            ELSE [WorkTask].[DescriptionHtml]
        END AS [DescriptionHtml],
        [StepsToReproduceHtml],
        [ActualResultHtml],
        [ExpectedResultHtml],
        [RootCauseAnalysisHtml],
        [Environment],
        [Severity],
        [Status],
        [Priority],
        [SortOrder],
        [PercentCompleted],
        [Url],
        [StartDate],
        [EndDate],
        [StartedAt],
        [CreatedByUserId],
        [UpdatedByUserId],
        [LinkedBugTaskId],
        CASE
            WHEN [WorkTask].[LinkedBlogId] IS NULL THEN NULL
            WHEN EXISTS
            (
                SELECT 1
                FROM [pmt].[Blogs] AS [LinkedBlog]
                WHERE [LinkedBlog].[BlogId] = [WorkTask].[LinkedBlogId]
                  AND ([LinkedBlog].[IsPrivate] = 0 OR [LinkedBlog].[CreatedByUserId] = @CurrentUserId)
            ) THEN [WorkTask].[LinkedBlogId]
            ELSE NULL
        END AS [LinkedBlogId],
        [CreatedAt],
        [UpdatedAt]
    FROM [pmt].[WorkTasks] AS [WorkTask]
    WHERE [IsDeleted] = 0
    ORDER BY [SortOrder], [TaskId];

    SELECT
        [TaskId],
        [UserId]
    FROM [pmt].[TaskAssignees]
    ORDER BY [TaskId], [UserId];

    SELECT
        [TaskId],
        [UserId]
    FROM [pmt].[TaskReporters]
    ORDER BY [TaskId], [UserId];

    SELECT
        [TaskId],
        [DependsOnTaskId]
    FROM [pmt].[TaskDependencies]
    ORDER BY [TaskId], [DependsOnTaskId];

    SELECT
        [AttachmentId],
        [FileName],
        [Url],
        [ContentType],
        [ByteLength],
        [UploadedByUserId],
        [CreatedAt]
    FROM [pmt].[Attachments] AS [Attachment]
    WHERE NOT EXISTS
          (
              SELECT 1
              FROM [pmt].[BlogAttachments] AS [BlogAttachment]
              WHERE [BlogAttachment].[AttachmentId] = [Attachment].[AttachmentId]
          )
       OR EXISTS
          (
              SELECT 1
              FROM [pmt].[TaskAttachments] AS [TaskAttachment]
              WHERE [TaskAttachment].[AttachmentId] = [Attachment].[AttachmentId]
          )
       OR EXISTS
          (
              SELECT 1
              FROM [pmt].[BlogAttachments] AS [BlogAttachment]
              INNER JOIN [pmt].[Blogs] AS [Blog]
                  ON [Blog].[BlogId] = [BlogAttachment].[BlogId]
              WHERE [BlogAttachment].[AttachmentId] = [Attachment].[AttachmentId]
                AND ([Blog].[IsPrivate] = 0 OR [Blog].[CreatedByUserId] = @CurrentUserId)
          )
    ORDER BY [CreatedAt] DESC;

    SELECT
        [TaskId],
        [AttachmentId]
    FROM [pmt].[TaskAttachments]
    ORDER BY [TaskId], [AttachmentId];

    SELECT
        [DevLogId],
        [LogType],
        [Category],
        [ProjectId],
        [UserId],
        [LogDate],
        [BodyHtml],
        [IsPinned],
        [CreatedAt],
        [UpdatedAt]
    FROM [pmt].[DevLogs]
    WHERE [IsDeleted] = 0
      -- Personal Log is owner-only even for administrators. Do not add an admin bypass.
      AND ([LogType] <> N'Log' OR [UserId] = @CurrentUserId)
    ORDER BY
        [IsPinned] DESC,
        CASE WHEN [IsPinned] = 1 THEN [CreatedAt] END DESC,
        [LogDate] DESC,
        [UpdatedAt] DESC;

    SELECT
        [BlogId],
        [ProjectId],
        [SprintId],
        CASE
            WHEN [Blog].[ParentBlogId] IS NULL THEN NULL
            WHEN EXISTS
            (
                SELECT 1
                FROM [pmt].[Blogs] AS [ParentBlog]
                WHERE [ParentBlog].[BlogId] = [Blog].[ParentBlogId]
                  AND ([ParentBlog].[IsPrivate] = 0 OR [ParentBlog].[CreatedByUserId] = @CurrentUserId)
            ) THEN [Blog].[ParentBlogId]
            ELSE NULL
        END AS [ParentBlogId],
        [Title],
        [BodyHtml],
        [IsPrivate],
        [IsPinned],
        [CreatedByUserId],
        [CreatedAt],
        [UpdatedAt]
    FROM [pmt].[Blogs] AS [Blog]
    WHERE [Blog].[IsDeleted] = 0
      -- Private Documentation is owner-only even for administrators.
      AND ([Blog].[IsPrivate] = 0 OR [Blog].[CreatedByUserId] = @CurrentUserId)
    ORDER BY [UpdatedAt] DESC;

    SELECT
        [BlogAttachment].[BlogId],
        [BlogAttachment].[AttachmentId]
    FROM [pmt].[BlogAttachments] AS [BlogAttachment]
    WHERE EXISTS
    (
        SELECT 1
        FROM [pmt].[Blogs] AS [Blog]
        WHERE [Blog].[BlogId] = [BlogAttachment].[BlogId]
          AND [Blog].[IsDeleted] = 0
          AND ([Blog].[IsPrivate] = 0 OR [Blog].[CreatedByUserId] = @CurrentUserId)
    )
    ORDER BY [BlogAttachment].[BlogId], [BlogAttachment].[AttachmentId];

    SELECT
        [BlogHistory].[BlogHistoryId],
        [BlogHistory].[BlogId],
        [BlogHistory].[Action],
        [BlogHistory].[UserId],
        [BlogHistory].[CreatedAt]
    FROM [pmt].[BlogHistory] AS [BlogHistory]
    WHERE EXISTS
    (
        SELECT 1
        FROM [pmt].[Blogs] AS [Blog]
        WHERE [Blog].[BlogId] = [BlogHistory].[BlogId]
          AND [Blog].[IsDeleted] = 0
          AND ([Blog].[IsPrivate] = 0 OR [Blog].[CreatedByUserId] = @CurrentUserId)
    )
    ORDER BY [BlogHistory].[CreatedAt] DESC;

    SELECT TOP (2000)
        [AuditEventId],
        [EntityType],
        [EntityId],
        [Action],
        [Details],
        [OldStatus],
        [NewStatus],
        [OldPercentCompleted],
        [NewPercentCompleted],
        [UserId],
        [CreatedAt]
    FROM [pmt].[AuditEvents] AS [AuditEvent]
    WHERE
        (
            [AuditEvent].[EntityType] NOT IN (N'Blog', N'DevLog')
            AND NOT
            (
                [AuditEvent].[EntityType] = N'Task'
                AND [AuditEvent].[Action] = N'Converted to Document'
                AND [AuditEvent].[UserId] <> @CurrentUserId
            )
        )
       OR
        (
            [AuditEvent].[EntityType] = N'Blog'
            AND EXISTS
            (
                SELECT 1
                FROM [pmt].[Blogs] AS [Blog]
                WHERE [Blog].[BlogId] = [AuditEvent].[EntityId]
                  AND [Blog].[IsDeleted] = 0
                  AND ([Blog].[IsPrivate] = 0 OR [Blog].[CreatedByUserId] = @CurrentUserId)
            )
        )
       OR
        (
            [AuditEvent].[EntityType] = N'DevLog'
            AND EXISTS
            (
                SELECT 1
                FROM [pmt].[DevLogs] AS [DevLog]
                WHERE [DevLog].[DevLogId] = [AuditEvent].[EntityId]
                  AND [DevLog].[IsDeleted] = 0
                  AND ([DevLog].[LogType] <> N'Log' OR [DevLog].[UserId] = @CurrentUserId)
            )
        )
    ORDER BY [AuditEvent].[CreatedAt] DESC, [AuditEvent].[AuditEventId] DESC;

    SELECT
        [LookupId],
        [LookupType],
        [Value],
        [ColorHex],
        [DisplayOrder],
        [IsActive]
    FROM [pmt].[Lookups]
    ORDER BY [LookupType], [DisplayOrder], [Value];

    SELECT
        [HolidayId],
        [Name],
        [HolidayDate],
        [CountryCode],
        [IsActive],
        [CreatedByUserId],
        [UpdatedByUserId],
        [CreatedAt],
        [UpdatedAt]
    FROM [pmt].[Holidays]
    ORDER BY [HolidayDate] DESC, [Name];
END;
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

CREATE OR ALTER PROCEDURE [pmt].[GetRoles]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        [LookupId],
        [Value],
        [Code],
        [DisplayOrder],
        [IsActive]
    FROM [pmt].[Lookups]
    WHERE [LookupType] = N'Role'
    ORDER BY [DisplayOrder], [Value];
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[GetSecurityConfiguration]
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IsAdmin BIT = [pmt].[IsAdmin](@CurrentUserId);

    SELECT [ResourceKey], [Name], [AvailableRights], [DisplayOrder]
    FROM [pmt].[SecurityResources]
    WHERE @IsAdmin = 1
    ORDER BY [DisplayOrder], [Name];

    SELECT
        [Resource].[ResourceKey],
        [Role].[Code] AS [RoleCode],
        CONVERT(BIT, ISNULL([Permission].[CanRead], 0)) AS [CanRead],
        CONVERT(BIT, ISNULL([Permission].[CanCreate], 0)) AS [CanCreate],
        CONVERT(BIT, ISNULL([Permission].[CanUpdate], 0)) AS [CanUpdate],
        CONVERT(BIT, ISNULL([Permission].[CanDelete], 0)) AS [CanDelete],
        CONVERT(BIT, ISNULL([Permission].[CanImport], 0)) AS [CanImport],
        CONVERT(BIT, ISNULL([Permission].[CanExport], 0)) AS [CanExport],
        CONVERT(BIT, ISNULL([Permission].[NoAccess], 0)) AS [NoAccess]
    FROM [pmt].[SecurityResources] AS [Resource]
    CROSS JOIN [pmt].[Lookups] AS [Role]
    LEFT JOIN [pmt].[RolePermissions] AS [Permission]
        ON [Permission].[ResourceKey] = [Resource].[ResourceKey]
       AND [Permission].[RoleCode] = [Role].[Code]
    WHERE @IsAdmin = 1
      AND [Role].[LookupType] = N'Role'
      AND [Role].[Code] <> N'Admin'
      AND [Role].[IsActive] = 1
    ORDER BY [Resource].[DisplayOrder], [Role].[DisplayOrder], [Role].[Value];

    SELECT
        [Resource].[ResourceKey],
        [User].[UserId],
        CONVERT(BIT, ISNULL([Permission].[CanRead], 0)) AS [CanRead],
        CONVERT(BIT, ISNULL([Permission].[CanCreate], 0)) AS [CanCreate],
        CONVERT(BIT, ISNULL([Permission].[CanUpdate], 0)) AS [CanUpdate],
        CONVERT(BIT, ISNULL([Permission].[CanDelete], 0)) AS [CanDelete],
        CONVERT(BIT, ISNULL([Permission].[CanImport], 0)) AS [CanImport],
        CONVERT(BIT, ISNULL([Permission].[CanExport], 0)) AS [CanExport],
        CONVERT(BIT, ISNULL([Permission].[NoAccess], 0)) AS [NoAccess],
        CONVERT(BIT, CASE WHEN [Permission].[UserId] IS NULL THEN 0 ELSE 1 END) AS [IsOverride]
    FROM [pmt].[SecurityResources] AS [Resource]
    CROSS JOIN [pmt].[Users] AS [User]
    LEFT JOIN [pmt].[UserPermissions] AS [Permission]
        ON [Permission].[ResourceKey] = [Resource].[ResourceKey]
       AND [Permission].[UserId] = [User].[UserId]
    WHERE @IsAdmin = 1
      AND [User].[IsActive] = 1
      AND [User].[IsAdmin] = 0
    ORDER BY [Resource].[DisplayOrder], [User].[Nickname];

    SELECT
        [Resource].[ResourceKey],
        CONVERT(BIT, CASE WHEN @IsAdmin = 1 THEN 1 ELSE [pmt].[HasPermission](@CurrentUserId, [Resource].[ResourceKey], N'Read') END) AS [CanRead],
        CONVERT(BIT, CASE WHEN @IsAdmin = 1 THEN 1 ELSE [pmt].[HasPermission](@CurrentUserId, [Resource].[ResourceKey], N'Create') END) AS [CanCreate],
        CONVERT(BIT, CASE WHEN @IsAdmin = 1 THEN 1 ELSE [pmt].[HasPermission](@CurrentUserId, [Resource].[ResourceKey], N'Update') END) AS [CanUpdate],
        CONVERT(BIT, CASE WHEN @IsAdmin = 1 THEN 1 ELSE [pmt].[HasPermission](@CurrentUserId, [Resource].[ResourceKey], N'Delete') END) AS [CanDelete],
        CONVERT(BIT, CASE WHEN @IsAdmin = 1 THEN 1 ELSE [pmt].[HasPermission](@CurrentUserId, [Resource].[ResourceKey], N'Import') END) AS [CanImport],
        CONVERT(BIT, CASE WHEN @IsAdmin = 1 THEN 1 ELSE [pmt].[HasPermission](@CurrentUserId, [Resource].[ResourceKey], N'Export') END) AS [CanExport],
        CONVERT(BIT, CASE WHEN @IsAdmin = 1 THEN 0 WHEN EXISTS
        (
            SELECT 1
            FROM [pmt].[RolePermissions] AS [RolePermission]
            WHERE [RolePermission].[RoleCode] = [pmt].[UserRole](@CurrentUserId)
              AND [RolePermission].[ResourceKey] = [Resource].[ResourceKey]
              AND [RolePermission].[NoAccess] = 1
        ) OR EXISTS
        (
            SELECT 1
            FROM [pmt].[UserPermissions] AS [UserPermission]
            WHERE [UserPermission].[UserId] = @CurrentUserId
              AND [UserPermission].[ResourceKey] = [Resource].[ResourceKey]
              AND [UserPermission].[NoAccess] = 1
        ) THEN 1 ELSE 0 END) AS [NoAccess]
    FROM [pmt].[SecurityResources] AS [Resource]
    ORDER BY [Resource].[DisplayOrder], [Resource].[Name];
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[SaveSecurityPermissions]
    @ResourceKey NVARCHAR(40),
    @RolePermissionsJson NVARCHAR(MAX),
    @UserPermissionsJson NVARCHAR(MAX),
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 50123, 'Only administrators can manage security.', 1;
    END;

    DECLARE @AvailableRights NVARCHAR(100);
    SELECT @AvailableRights = [AvailableRights]
    FROM [pmt].[SecurityResources]
    WHERE [ResourceKey] = @ResourceKey;

    IF @AvailableRights IS NULL
    BEGIN
        THROW 50124, 'Security area was not found.', 1;
    END;

    BEGIN TRANSACTION;

    DELETE FROM [pmt].[RolePermissions] WHERE [ResourceKey] = @ResourceKey;
    DELETE FROM [pmt].[UserPermissions] WHERE [ResourceKey] = @ResourceKey;

    INSERT INTO [pmt].[RolePermissions]
    (
        [RoleCode], [ResourceKey], [CanRead], [CanCreate], [CanUpdate],
        [CanDelete], [CanImport], [CanExport], [NoAccess]
    )
    SELECT
        [Input].[RoleCode],
        @ResourceKey,
        CASE WHEN [Input].[NoAccess] = 0 AND CHARINDEX(N'Read', @AvailableRights) > 0 THEN [Input].[CanRead] ELSE 0 END,
        CASE WHEN [Input].[NoAccess] = 0 AND CHARINDEX(N'Create', @AvailableRights) > 0 THEN [Input].[CanCreate] ELSE 0 END,
        CASE WHEN [Input].[NoAccess] = 0 AND CHARINDEX(N'Update', @AvailableRights) > 0 THEN [Input].[CanUpdate] ELSE 0 END,
        CASE WHEN [Input].[NoAccess] = 0 AND CHARINDEX(N'Delete', @AvailableRights) > 0 THEN [Input].[CanDelete] ELSE 0 END,
        CASE WHEN [Input].[NoAccess] = 0 AND CHARINDEX(N'Import', @AvailableRights) > 0 THEN [Input].[CanImport] ELSE 0 END,
        CASE WHEN [Input].[NoAccess] = 0 AND CHARINDEX(N'Export', @AvailableRights) > 0 THEN [Input].[CanExport] ELSE 0 END,
        [Input].[NoAccess]
    FROM OPENJSON(ISNULL(@RolePermissionsJson, N'[]'))
    WITH
    (
        [RoleCode] NVARCHAR(20) N'$.RoleCode',
        [CanRead] BIT N'$.CanRead',
        [CanCreate] BIT N'$.CanCreate',
        [CanUpdate] BIT N'$.CanUpdate',
        [CanDelete] BIT N'$.CanDelete',
        [CanImport] BIT N'$.CanImport',
        [CanExport] BIT N'$.CanExport',
        [NoAccess] BIT N'$.NoAccess'
    ) AS [Input]
    INNER JOIN [pmt].[Lookups] AS [Role]
        ON [Role].[LookupType] = N'Role'
       AND [Role].[Code] = [Input].[RoleCode]
       AND [Role].[Code] <> N'Admin'
       AND [Role].[IsActive] = 1
    WHERE [Input].[NoAccess] = 1
       OR [Input].[CanRead] = 1 OR [Input].[CanCreate] = 1 OR [Input].[CanUpdate] = 1
       OR [Input].[CanDelete] = 1 OR [Input].[CanImport] = 1 OR [Input].[CanExport] = 1;

    INSERT INTO [pmt].[UserPermissions]
    (
        [UserId], [ResourceKey], [CanRead], [CanCreate], [CanUpdate],
        [CanDelete], [CanImport], [CanExport], [NoAccess]
    )
    SELECT
        [Input].[UserId],
        @ResourceKey,
        CASE WHEN [Input].[NoAccess] = 0 AND CHARINDEX(N'Read', @AvailableRights) > 0 THEN [Input].[CanRead] ELSE 0 END,
        CASE WHEN [Input].[NoAccess] = 0 AND CHARINDEX(N'Create', @AvailableRights) > 0 THEN [Input].[CanCreate] ELSE 0 END,
        CASE WHEN [Input].[NoAccess] = 0 AND CHARINDEX(N'Update', @AvailableRights) > 0 THEN [Input].[CanUpdate] ELSE 0 END,
        CASE WHEN [Input].[NoAccess] = 0 AND CHARINDEX(N'Delete', @AvailableRights) > 0 THEN [Input].[CanDelete] ELSE 0 END,
        CASE WHEN [Input].[NoAccess] = 0 AND CHARINDEX(N'Import', @AvailableRights) > 0 THEN [Input].[CanImport] ELSE 0 END,
        CASE WHEN [Input].[NoAccess] = 0 AND CHARINDEX(N'Export', @AvailableRights) > 0 THEN [Input].[CanExport] ELSE 0 END,
        [Input].[NoAccess]
    FROM OPENJSON(ISNULL(@UserPermissionsJson, N'[]'))
    WITH
    (
        [UserId] INT N'$.UserId',
        [CanRead] BIT N'$.CanRead',
        [CanCreate] BIT N'$.CanCreate',
        [CanUpdate] BIT N'$.CanUpdate',
        [CanDelete] BIT N'$.CanDelete',
        [CanImport] BIT N'$.CanImport',
        [CanExport] BIT N'$.CanExport',
        [NoAccess] BIT N'$.NoAccess',
        [IsOverride] BIT N'$.IsOverride'
    ) AS [Input]
    INNER JOIN [pmt].[Users] AS [User]
        ON [User].[UserId] = [Input].[UserId]
       AND [User].[IsActive] = 1
       AND [User].[IsAdmin] = 0
    WHERE [Input].[IsOverride] = 1;

    EXEC [pmt].[WriteAudit] N'Security', 0, N'Updated', @ResourceKey, @CurrentUserId;
    COMMIT TRANSACTION;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[ResetSecurityPermissions]
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 50123, 'Only administrators can manage security.', 1;
    END;

    BEGIN TRANSACTION;

    -- Remove every explicit user override so all non-admin users inherit their
    -- restored Role defaults.
    DELETE FROM [pmt].[UserPermissions];
    DELETE FROM [pmt].[RolePermissions];

    -- Every non-admin Role can read PMT. These common defaults also provide a
    -- safe baseline for custom Roles that do not have a built-in discipline.
    INSERT INTO [pmt].[RolePermissions] ([RoleCode], [ResourceKey], [CanRead])
    SELECT [Role].[Code], [Resource].[ResourceKey], 1
    FROM [pmt].[Lookups] AS [Role]
    CROSS JOIN [pmt].[SecurityResources] AS [Resource]
    WHERE [Role].[LookupType] = N'Role'
      AND [Role].[Code] <> N'Admin';

    UPDATE [pmt].[RolePermissions]
    SET [CanUpdate] = 1
    WHERE [ResourceKey] IN (N'Board', N'WfhSchedule', N'Settings');

    UPDATE [pmt].[RolePermissions]
    SET [CanExport] = 1
    WHERE [ResourceKey] IN (N'Board', N'WfhSchedule');

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1, [CanImport] = 1, [CanExport] = 1
    WHERE [ResourceKey] IN (N'Scrum', N'Documentation');

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1, [CanDelete] = 1, [CanImport] = 1, [CanExport] = 1
    WHERE [ResourceKey] = N'PersonalLog';

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1, [CanDelete] = 1, [CanImport] = 1, [CanExport] = 1
    WHERE [RoleCode] = N'Developer'
      AND [ResourceKey] IN (N'DevTasks', N'Backlog');

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanExport] = 1
    WHERE [RoleCode] = N'Developer'
      AND [ResourceKey] = N'BugTracking';

    UPDATE [pmt].[RolePermissions]
    SET [CanExport] = 1
    WHERE [RoleCode] IN (N'QA', N'QA Manual', N'QA Automation', N'TM')
      AND [ResourceKey] = N'DevTasks';

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1, [CanDelete] = 1, [CanImport] = 1, [CanExport] = 1
    WHERE [RoleCode] IN (N'QA', N'QA Manual', N'QA Automation', N'TM')
      AND [ResourceKey] = N'BugTracking';

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1, [CanImport] = 1, [CanExport] = 1
    WHERE [RoleCode] IN (N'QA', N'QA Manual', N'QA Automation', N'TM')
      AND [ResourceKey] = N'Backlog';

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1
    WHERE [RoleCode] = N'SA'
      AND [ResourceKey] IN (N'Projects', N'Sprints');

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1, [CanImport] = 1, [CanExport] = 1
    WHERE [RoleCode] = N'SA'
      AND [ResourceKey] IN (N'DevTasks', N'BugTracking', N'Backlog');

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1, [CanDelete] = 1
    WHERE [RoleCode] IN (N'TL', N'PM')
      AND [ResourceKey] IN (N'Projects', N'Sprints');

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1, [CanDelete] = 1, [CanImport] = 1, [CanExport] = 1
    WHERE [RoleCode] = N'TL'
      AND [ResourceKey] IN (N'DevTasks', N'Backlog');

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1, [CanImport] = 1, [CanExport] = 1
    WHERE [RoleCode] IN (N'TL', N'PM')
      AND [ResourceKey] IN (N'BugTracking', N'DevTasks');

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1, [CanDelete] = 1, [CanImport] = 1, [CanExport] = 1
    WHERE [RoleCode] = N'PM'
      AND [ResourceKey] = N'Backlog';

    UPDATE [pmt].[RolePermissions]
    SET [CanDelete] = 1
    WHERE [RoleCode] IN (N'SA', N'TL', N'PM', N'TM')
      AND [ResourceKey] IN (N'Scrum', N'Documentation');

    UPDATE [pmt].[RolePermissions]
    SET [CanUpdate] = 1
    WHERE [RoleCode] = N'TM'
      AND [ResourceKey] = N'Sprints';

    EXEC [pmt].[WriteAudit]
        N'Security', 0, N'Reset', N'All Role permissions restored and user overrides removed.', @CurrentUserId;

    COMMIT TRANSACTION;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[LoginUser]
    @Login NVARCHAR(180),
    @Password NVARCHAR(4000)
AS
BEGIN
    SET NOCOUNT ON;

    SET @Login = NULLIF(LTRIM(RTRIM(@Login)), N'');

    SELECT TOP (1)
        [UserId],
        [Nickname],
        [IsAdmin],
        [Role],
        [RowVersion]
    FROM [pmt].[Users]
    WHERE [IsActive] = 1
      AND ([Nickname] = @Login OR [Email] = @Login)
      AND [PasswordHash] = HASHBYTES('SHA2_256', CONVERT(NVARCHAR(4000), @Password));
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[RecordSuccessfulLogin]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS
    (
        SELECT 1
        FROM [pmt].[Users]
        WHERE [UserId] = @UserId
          AND [IsActive] = 1
    )
    BEGIN
        THROW 51058, 'An active user is required to record a successful login.', 1;
    END;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();

    BEGIN TRANSACTION;

    UPDATE [pmt].[UserLoginActivity] WITH (UPDLOCK, HOLDLOCK)
    SET [LastLoginAt] = @Now
    WHERE [UserId] = @UserId;

    IF @@ROWCOUNT = 0
    BEGIN
        INSERT INTO [pmt].[UserLoginActivity] ([UserId], [LastLoginAt])
        VALUES (@UserId, @Now);
    END;

    COMMIT TRANSACTION;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[GetUserLastLogins]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        [User].[UserId],
        [LoginActivity].[LastLoginAt]
    FROM [pmt].[Users] AS [User]
    LEFT JOIN [pmt].[UserLoginActivity] AS [LoginActivity]
        ON [LoginActivity].[UserId] = [User].[UserId]
    WHERE [User].[IsActive] = 1
    ORDER BY [User].[UserId];
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[GetSessionUser]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        [UserId],
        [Nickname],
        [IsAdmin],
        [Role],
        [RowVersion]
    FROM [pmt].[Users]
    WHERE [UserId] = @UserId
      AND [IsActive] = 1;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[GetUserImageAnnotationTemplateLibrary]
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS
    (
        SELECT 1
        FROM [pmt].[Users]
        WHERE [UserId] = @CurrentUserId
          AND [IsActive] = 1
    )
    BEGIN
        THROW 50281, 'The image annotation template-library user was not found or is inactive.', 1;
    END;

    SELECT [LibraryJson] = ISNULL
    (
        (
            SELECT [LibraryJson]
            FROM [pmt].[UserImageAnnotationTemplateLibraries]
            WHERE [UserId] = @CurrentUserId
        ),
        N'{"version":1,"templates":[],"defaults":{"arrow":null,"rectangle":null}}'
    );
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[SaveUserImageAnnotationTemplateLibrary]
    @LibraryJson NVARCHAR(MAX),
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @LibraryJson IS NULL
       OR ISJSON(@LibraryJson) <> 1
       OR DATALENGTH(@LibraryJson) > 104857600
    BEGIN
        THROW 50280, 'The image annotation template library must be valid JSON no larger than 50 MiB.', 1;
    END;

    IF NOT EXISTS
       (
           SELECT 1
           FROM OPENJSON(@LibraryJson)
           WHERE [key] = N'version'
             AND [type] = 2
             AND TRY_CONVERT(INT, [value]) = 1
       )
       OR NOT EXISTS
       (
           SELECT 1
           FROM OPENJSON(@LibraryJson)
           WHERE [key] = N'templates'
             AND [type] = 4
       )
       OR NOT EXISTS
       (
           SELECT 1
           FROM OPENJSON(@LibraryJson)
           WHERE [key] = N'defaults'
             AND [type] = 5
       )
       OR (SELECT COUNT(*) FROM OPENJSON(JSON_QUERY(@LibraryJson, N'$.templates'))) > 50
    BEGIN
        THROW 50280, 'The image annotation template library must be version 1 with defaults and no more than 50 templates.', 1;
    END;

    IF NOT EXISTS
    (
        SELECT 1
        FROM [pmt].[Users]
        WHERE [UserId] = @CurrentUserId
          AND [IsActive] = 1
    )
    BEGIN
        THROW 50281, 'The image annotation template-library user was not found or is inactive.', 1;
    END;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF EXISTS
        (
            SELECT 1
            FROM [pmt].[UserImageAnnotationTemplateLibraries] WITH (UPDLOCK, HOLDLOCK)
            WHERE [UserId] = @CurrentUserId
        )
        BEGIN
            UPDATE [pmt].[UserImageAnnotationTemplateLibraries]
            SET [LibraryJson] = @LibraryJson,
                [UpdatedAt] = SYSUTCDATETIME()
            WHERE [UserId] = @CurrentUserId;
        END;
        ELSE
        BEGIN
            INSERT INTO [pmt].[UserImageAnnotationTemplateLibraries]
            (
                [UserId],
                [LibraryJson]
            )
            VALUES
            (
                @CurrentUserId,
                @LibraryJson
            );
        END;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    SELECT [LibraryJson]
    FROM [pmt].[UserImageAnnotationTemplateLibraries]
    WHERE [UserId] = @CurrentUserId;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[BeginImpersonation]
    @AdminUserId INT,
    @TargetUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF [pmt].[IsAdmin](@AdminUserId) = 0
    BEGIN
        THROW 51030, 'Only an administrator can impersonate another user.', 1;
    END;

    IF @TargetUserId = @AdminUserId
    BEGIN
        THROW 51031, 'Select another user to impersonate.', 1;
    END;

    IF NOT EXISTS (SELECT 1 FROM [pmt].[Users] WHERE [UserId] = @TargetUserId AND [IsActive] = 1)
    BEGIN
        THROW 51032, 'The selected user is not active.', 1;
    END;

    DECLARE @AdminName NVARCHAR(80) = (SELECT [Nickname] FROM [pmt].[Users] WHERE [UserId] = @AdminUserId);
    DECLARE @TargetName NVARCHAR(80) = (SELECT [Nickname] FROM [pmt].[Users] WHERE [UserId] = @TargetUserId);
    DECLARE @Details NVARCHAR(MAX) = CONCAT(@AdminName, N' started impersonating ', @TargetName, N'.');

    EXEC [pmt].[WriteAudit]
        N'Impersonation',
        @TargetUserId,
        N'Started',
        @Details,
        @TargetUserId;

    SELECT
        [UserId],
        [Nickname],
        [IsAdmin],
        [Role],
        [RowVersion]
    FROM [pmt].[Users]
    WHERE [UserId] = @TargetUserId
      AND [IsActive] = 1;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[EndImpersonation]
    @AdminUserId INT,
    @TargetUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM [pmt].[Users] WHERE [UserId] = @AdminUserId)
       OR NOT EXISTS (SELECT 1 FROM [pmt].[Users] WHERE [UserId] = @TargetUserId)
    BEGIN
        THROW 51033, 'The impersonation users could not be verified.', 1;
    END;

    DECLARE @AdminName NVARCHAR(80) = (SELECT [Nickname] FROM [pmt].[Users] WHERE [UserId] = @AdminUserId);
    DECLARE @TargetName NVARCHAR(80) = (SELECT [Nickname] FROM [pmt].[Users] WHERE [UserId] = @TargetUserId);
    DECLARE @Details NVARCHAR(MAX) = CONCAT(@AdminName, N' stopped impersonating ', @TargetName, N'.');

    EXEC [pmt].[WriteAudit]
        N'Impersonation',
        @TargetUserId,
        N'Ended',
        @Details,
        @TargetUserId;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[GetAuditTrail]
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 51034, 'Only administrators can view the system audit trail.', 1;
    END;

    SELECT TOP (2000)
        [AuditEvent].[AuditEventId],
        [AuditEvent].[EntityType],
        [AuditEvent].[EntityId],
        [AuditEvent].[Action],
        CASE
            WHEN [AuditEvent].[EntityType] = N'Blog'
             AND EXISTS
                 (
                     SELECT 1
                     FROM [pmt].[Blogs] AS [Blog]
                     WHERE [Blog].[BlogId] = [AuditEvent].[EntityId]
                       AND [Blog].[IsPrivate] = 1
                       AND [Blog].[CreatedByUserId] <> @CurrentUserId
                )
                THEN N'Private Documentation activity.'
            WHEN [AuditEvent].[EntityType] = N'Task'
             AND [AuditEvent].[Action] = N'Converted to Document'
             AND EXISTS
                 (
                     SELECT 1
                     FROM [pmt].[WorkTasks] AS [WorkTask]
                     INNER JOIN [pmt].[Blogs] AS [Blog]
                         ON [Blog].[BlogId] = [WorkTask].[LinkedBlogId]
                     WHERE [WorkTask].[TaskId] = [AuditEvent].[EntityId]
                       AND [Blog].[IsPrivate] = 1
                       AND [Blog].[CreatedByUserId] <> @CurrentUserId
                 )
                THEN N'Private Documentation activity.'
            WHEN [AuditEvent].[EntityType] = N'DevLog'
             AND EXISTS
                 (
                     SELECT 1
                     FROM [pmt].[DevLogs] AS [DevLog]
                     WHERE [DevLog].[DevLogId] = [AuditEvent].[EntityId]
                       AND [DevLog].[LogType] = N'Log'
                       AND [DevLog].[UserId] <> @CurrentUserId
                 )
                THEN N'Private Log activity.'
            ELSE [AuditEvent].[Details]
        END AS [Details],
        [AuditEvent].[OldStatus],
        [AuditEvent].[NewStatus],
        [AuditEvent].[OldPercentCompleted],
        [AuditEvent].[NewPercentCompleted],
        [AuditEvent].[UserId],
        [AuditEvent].[ActorUserId],
        COALESCE([EffectiveUser].[Nickname], CONCAT(N'User #', [AuditEvent].[UserId])) AS [UserName],
        COALESCE([ActorUser].[Nickname], CONCAT(N'User #', [AuditEvent].[ActorUserId])) AS [ActorUserName],
        [AuditEvent].[CreatedAt]
    FROM [pmt].[AuditEvents] AS [AuditEvent]
    LEFT JOIN [pmt].[Users] AS [EffectiveUser]
        ON [EffectiveUser].[UserId] = [AuditEvent].[UserId]
    LEFT JOIN [pmt].[Users] AS [ActorUser]
        ON [ActorUser].[UserId] = [AuditEvent].[ActorUserId]
    ORDER BY [AuditEvent].[CreatedAt] DESC, [AuditEvent].[AuditEventId] DESC;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[ChangePassword]
    @UserId INT,
    @CurrentPassword NVARCHAR(4000),
    @NewPassword NVARCHAR(4000)
AS
BEGIN
    SET NOCOUNT ON;

    IF LEN(ISNULL(@NewPassword, N'')) < 8
    BEGIN
        THROW 50000, 'New password must be at least 8 characters.', 1;
    END;

    IF NOT EXISTS
    (
        SELECT 1
        FROM [pmt].[Users]
        WHERE [UserId] = @UserId
          AND [IsActive] = 1
          AND [PasswordHash] = HASHBYTES('SHA2_256', CONVERT(NVARCHAR(4000), @CurrentPassword))
    )
    BEGIN
        THROW 50000, 'Current password is not correct.', 1;
    END;

    UPDATE [pmt].[Users]
    SET [PasswordHash] = HASHBYTES('SHA2_256', CONVERT(NVARCHAR(4000), @NewPassword)),
        [UpdatedByUserId] = @UserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [UserId] = @UserId;

    EXEC [pmt].[WriteAudit] N'User', @UserId, N'Password Changed', N'User changed their password.', @UserId;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[AdminResetUserPassword]
    @UserId INT,
    @NewPassword NVARCHAR(4000),
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 50125, 'Only administrators can reset another user''s password.', 1;
    END;

    IF LEN(ISNULL(@NewPassword, N'')) < 8
    BEGIN
        THROW 50126, 'New password must be at least 8 characters.', 1;
    END;

    IF NOT EXISTS (SELECT 1 FROM [pmt].[Users] WHERE [UserId] = @UserId AND [IsActive] = 1)
    BEGIN
        THROW 50127, 'User was not found.', 1;
    END;

    UPDATE [pmt].[Users]
    SET [PasswordHash] = HASHBYTES('SHA2_256', CONVERT(NVARCHAR(4000), @NewPassword)),
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [UserId] = @UserId;

    EXEC [pmt].[WriteAudit] N'User', @UserId, N'Password Reset', N'Administrator reset the user password.', @CurrentUserId;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[CreateUserInvitation]
    @TokenHash VARBINARY(32),
    @ProjectIdsCsv NVARCHAR(MAX),
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF DATALENGTH(@TokenHash) <> 32
    BEGIN
        THROW 50200, 'Invitation token is invalid.', 1;
    END;

    IF NOT EXISTS
    (
        SELECT 1
        FROM [pmt].[Users]
        WHERE [UserId] = @CurrentUserId
          AND [IsActive] = 1
    )
    BEGIN
        THROW 50201, 'A signed-in active user is required to create an invitation.', 1;
    END;

    DECLARE @RequestedProjects TABLE ([ProjectId] INT NOT NULL PRIMARY KEY);
    INSERT INTO @RequestedProjects ([ProjectId])
    SELECT [Id]
    FROM [pmt].[SplitIds](@ProjectIdsCsv)
    WHERE [Id] > 0;

    IF NOT EXISTS (SELECT 1 FROM @RequestedProjects)
    BEGIN
        THROW 50202, 'Select at least one project.', 1;
    END;

    DECLARE @CurrentUserIsAdmin BIT = [pmt].[IsAdmin](@CurrentUserId);
    IF EXISTS
    (
        SELECT 1
        FROM @RequestedProjects AS [Requested]
        LEFT JOIN [pmt].[Projects] AS [Project]
            ON [Project].[ProjectId] = [Requested].[ProjectId]
           AND [Project].[IsArchived] = 0
        WHERE [Project].[ProjectId] IS NULL
           OR
           (
               @CurrentUserIsAdmin = 0
               AND NOT EXISTS
               (
                   SELECT 1
                   FROM [pmt].[ProjectMembers]
                   WHERE [ProjectId] = [Requested].[ProjectId]
                     AND [UserId] = @CurrentUserId
               )
           )
    )
    BEGIN
        THROW 50203, 'You can invite users only to active projects you belong to.', 1;
    END;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @ExpiresAt DATETIME2(0) = DATEADD(DAY, 30, @Now);
    DECLARE @UserInvitationId INT;

    BEGIN TRY
        BEGIN TRANSACTION;

        INSERT INTO [pmt].[UserInvitations]
        (
            [TokenHash],
            [ExpiresAt],
            [CreatedByUserId],
            [CreatedAt]
        )
        VALUES
        (
            @TokenHash,
            @ExpiresAt,
            @CurrentUserId,
            @Now
        );

        SET @UserInvitationId = SCOPE_IDENTITY();

        INSERT INTO [pmt].[UserInvitationProjects] ([UserInvitationId], [ProjectId], [CreatedAt])
        SELECT @UserInvitationId, [ProjectId], @Now
        FROM @RequestedProjects;

        EXEC [pmt].[WriteAudit]
            N'User Invitation',
            @UserInvitationId,
            N'Created',
            N'User invitation created.',
            @CurrentUserId;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0
        BEGIN
            ROLLBACK TRANSACTION;
        END;

        THROW;
    END CATCH;

    SELECT [ExpiresAt] = @ExpiresAt;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[GetUserInvitation]
    @TokenHash VARBINARY(32)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UserInvitationId INT;

    SELECT @UserInvitationId = [UserInvitationId]
    FROM [pmt].[UserInvitations] AS [Invitation]
    WHERE [Invitation].[TokenHash] = @TokenHash
      AND [Invitation].[ExpiresAt] > SYSUTCDATETIME()
      AND EXISTS
      (
          SELECT 1
          FROM [pmt].[UserInvitationProjects] AS [InvitationProject]
          INNER JOIN [pmt].[Projects] AS [Project]
              ON [Project].[ProjectId] = [InvitationProject].[ProjectId]
             AND [Project].[IsArchived] = 0
          WHERE [InvitationProject].[UserInvitationId] = [Invitation].[UserInvitationId]
      );

    SELECT [ExpiresAt]
    FROM [pmt].[UserInvitations]
    WHERE [UserInvitationId] = @UserInvitationId;

    SELECT
        [Project].[ProjectId],
        [Project].[Code],
        [Project].[Title],
        [Project].[IconUrl]
    FROM [pmt].[UserInvitationProjects] AS [InvitationProject]
    INNER JOIN [pmt].[Projects] AS [Project]
        ON [Project].[ProjectId] = [InvitationProject].[ProjectId]
       AND [Project].[IsArchived] = 0
    WHERE [InvitationProject].[UserInvitationId] = @UserInvitationId
    ORDER BY [Project].[Title], [Project].[Code];
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[SuggestUsername]
    @PreferredUsername NVARCHAR(80),
    @ExcludeUserId INT = 0
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @BaseUsername NVARCHAR(80) = LEFT(ISNULL(NULLIF(LTRIM(RTRIM(@PreferredUsername)), N''), N'User'), 80);
    DECLARE @Username NVARCHAR(80) = @BaseUsername;
    DECLARE @Suffix INT = 2;
    DECLARE @SuffixText NVARCHAR(10);

    WHILE EXISTS
    (
        SELECT 1
        FROM [pmt].[Users]
        WHERE [IsActive] = 1
          AND [UserId] <> ISNULL(@ExcludeUserId, 0)
          AND
          (
              LOWER(LTRIM(RTRIM([Nickname]))) = LOWER(@Username)
              OR LOWER(LTRIM(RTRIM(ISNULL([Email], N'')))) = LOWER(@Username)
          )
    )
    BEGIN
        SET @SuffixText = CONVERT(NVARCHAR(10), @Suffix);
        SET @Username = LEFT(@BaseUsername, 80 - LEN(@SuffixText)) + @SuffixText;
        SET @Suffix += 1;
    END;

    SELECT
        [Username] = @Username,
        [IsAvailable] = CONVERT(BIT, CASE WHEN LOWER(@Username) = LOWER(@BaseUsername) THEN 1 ELSE 0 END);
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

CREATE OR ALTER PROCEDURE [pmt].[SynchronizeProjectCode]
    @ProjectId INT,
    @PreviousProjectCode NVARCHAR(5),
    @ProjectCode NVARCHAR(5)
AS
BEGIN
    SET NOCOUNT ON;

    IF @@TRANCOUNT = 0
    BEGIN
        THROW 51040, 'A transaction is required to synchronize Project codes.', 1;
    END;

    EXEC [pmt].[LockWorkTaskWrites];
    EXEC [pmt].[LockSprintWrites];

    IF NOT EXISTS
    (
        SELECT 1
        FROM [pmt].[Projects]
        WHERE [ProjectId] = @ProjectId
          AND [Code] = @ProjectCode
    )
    BEGIN
        THROW 51041, 'The Project code could not be verified for synchronization.', 1;
    END;

    DECLARE @SprintCodeUpdates TABLE
    (
        [SprintId] INT NOT NULL PRIMARY KEY,
        [DesiredCode] NVARCHAR(100) NOT NULL
    );

    INSERT INTO @SprintCodeUpdates ([SprintId], [DesiredCode])
    SELECT
        [Sprint].[SprintId],
        @ProjectCode
        + CASE
            WHEN LEFT([Sprint].[Code], LEN(@PreviousProjectCode)) = @PreviousProjectCode
             AND SUBSTRING([Sprint].[Code], LEN(@PreviousProjectCode) + 1, 1) = N'-'
                THEN SUBSTRING([Sprint].[Code], LEN(@PreviousProjectCode) + 1, 40)
            WHEN [CodeMarker].[MarkerPosition] IS NOT NULL
                THEN SUBSTRING([Sprint].[Code], [CodeMarker].[MarkerPosition], 40)
            WHEN CHARINDEX(N'-', [Sprint].[Code]) > 0
                THEN SUBSTRING([Sprint].[Code], CHARINDEX(N'-', [Sprint].[Code]), 40)
            ELSE N'-Sprint' + CONVERT(NVARCHAR(12), [Sprint].[SprintId])
          END
    FROM [pmt].[Sprints] AS [Sprint]
    CROSS APPLY
    (
        SELECT MIN([Marker].[Position]) AS [MarkerPosition]
        FROM
        (
            VALUES
                (NULLIF(CHARINDEX(N'-SPRINT', UPPER([Sprint].[Code])), 0)),
                (NULLIF(CHARINDEX(N'-PHASE', UPPER([Sprint].[Code])), 0))
        ) AS [Marker]([Position])
        WHERE [Marker].[Position] IS NOT NULL
    ) AS [CodeMarker]
    WHERE [Sprint].[ProjectId] = @ProjectId;

    DECLARE @TaskCodeUpdates TABLE
    (
        [TaskId] INT NOT NULL PRIMARY KEY,
        [DesiredCode] NVARCHAR(100) NOT NULL
    );

    INSERT INTO @TaskCodeUpdates ([TaskId], [DesiredCode])
    SELECT
        [Task].[TaskId],
        @ProjectCode
        + CASE
            WHEN LEFT([Task].[Code], LEN(@PreviousProjectCode)) = @PreviousProjectCode
             AND SUBSTRING([Task].[Code], LEN(@PreviousProjectCode) + 1, 1) = N'-'
                THEN SUBSTRING([Task].[Code], LEN(@PreviousProjectCode) + 1, 40)
            WHEN [CodeMarker].[MarkerPosition] IS NOT NULL
                THEN SUBSTRING([Task].[Code], [CodeMarker].[MarkerPosition], 40)
            WHEN CHARINDEX(N'-', [Task].[Code]) > 0
                THEN SUBSTRING([Task].[Code], CHARINDEX(N'-', [Task].[Code]), 40)
            WHEN [Task].[TaskType] = N'Bug'
                THEN N'-Bug' + CONVERT(NVARCHAR(12), [Task].[TaskId])
            ELSE N'-Task' + CONVERT(NVARCHAR(12), [Task].[TaskId])
          END
    FROM [pmt].[WorkTasks] AS [Task]
    CROSS APPLY
    (
        SELECT MIN([Marker].[Position]) AS [MarkerPosition]
        FROM
        (
            VALUES
                (NULLIF(CHARINDEX(N'-TASK', UPPER([Task].[Code])), 0)),
                (NULLIF(CHARINDEX(N'-BUG', UPPER([Task].[Code])), 0)),
                (NULLIF(CHARINDEX(N'-BACKLOG', UPPER([Task].[Code])), 0))
        ) AS [Marker]([Position])
        WHERE [Marker].[Position] IS NOT NULL
    ) AS [CodeMarker]
    WHERE [Task].[ProjectId] = @ProjectId;

    IF EXISTS (SELECT 1 FROM @SprintCodeUpdates WHERE LEN([DesiredCode]) > 40)
       OR EXISTS (SELECT 1 FROM @TaskCodeUpdates WHERE LEN([DesiredCode]) > 40)
    BEGIN
        THROW 51042, 'One or more Sprint or Task codes would exceed 40 characters after the Project code change.', 1;
    END;

    IF EXISTS
    (
        SELECT [DesiredCode]
        FROM @SprintCodeUpdates
        GROUP BY [DesiredCode]
        HAVING COUNT(*) > 1
    )
       OR EXISTS
    (
        SELECT [DesiredCode]
        FROM @TaskCodeUpdates
        GROUP BY [DesiredCode]
        HAVING COUNT(*) > 1
    )
    BEGIN
        THROW 51043, 'The Project contains duplicate Sprint or Task code suffixes that cannot be synchronized safely.', 1;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM @SprintCodeUpdates AS [CodeUpdate]
        INNER JOIN [pmt].[Sprints] AS [ExistingSprint]
            ON [ExistingSprint].[Code] = [CodeUpdate].[DesiredCode]
           AND [ExistingSprint].[ProjectId] <> @ProjectId
    )
       OR EXISTS
    (
        SELECT 1
        FROM @TaskCodeUpdates AS [CodeUpdate]
        INNER JOIN [pmt].[WorkTasks] AS [ExistingTask]
            ON [ExistingTask].[Code] = [CodeUpdate].[DesiredCode]
           AND [ExistingTask].[ProjectId] <> @ProjectId
    )
    BEGIN
        THROW 51044, 'A Sprint or Task code generated by the Project code change is already used by another Project.', 1;
    END;

    UPDATE [Sprint]
    SET [Code] = [CodeUpdate].[DesiredCode]
    FROM [pmt].[Sprints] AS [Sprint]
    INNER JOIN @SprintCodeUpdates AS [CodeUpdate]
        ON [CodeUpdate].[SprintId] = [Sprint].[SprintId]
    WHERE [Sprint].[Code] <> [CodeUpdate].[DesiredCode];

    UPDATE [Task]
    SET [Code] = [CodeUpdate].[DesiredCode]
    FROM [pmt].[WorkTasks] AS [Task]
    INNER JOIN @TaskCodeUpdates AS [CodeUpdate]
        ON [CodeUpdate].[TaskId] = [Task].[TaskId]
    WHERE [Task].[Code] <> [CodeUpdate].[DesiredCode];
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[UpsertProject]
    @ProjectId INT OUTPUT,
    @Code NVARCHAR(6),
    @Title NVARCHAR(31),
    @Description NVARCHAR(101),
    @Url NVARCHAR(500),
    @IconUrl NVARCHAR(500),
    @StartDate DATETIME2(0),
    @EndDate DATETIME2(0),
    @MemberIdsCsv NVARCHAR(MAX),
    @CurrentUserId INT,
    @OverrideArchivedCode BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @OwnerUserId INT;
    DECLARE @PreviousProjectCode NVARCHAR(5);

    SET @Title = NULLIF(LTRIM(RTRIM(@Title)), N'');
    SET @Code = UPPER(REPLACE(NULLIF(LTRIM(RTRIM(@Code)), N''), N' ', N''));
    SET @OverrideArchivedCode = ISNULL(@OverrideArchivedCode, 0);
    IF @EndDate IS NOT NULL AND @StartDate IS NOT NULL AND @EndDate < @StartDate
    BEGIN
        SET @EndDate = @StartDate;
    END;

    IF @Code IS NULL
    BEGIN
        THROW 50001, 'Project code is required.', 1;
    END;

    IF LEN(ISNULL(@Code, N'')) > 5
    BEGIN
        THROW 50001, 'Project code cannot exceed 5 characters.', 1;
    END;

    IF @Title IS NULL
    BEGIN
        THROW 50001, 'Project title is required.', 1;
    END;

    IF LEN(@Title) > 30
    BEGIN
        THROW 50001, 'Project title cannot exceed 30 characters.', 1;
    END;

    IF LEN(ISNULL(@Description, N'')) > 100
    BEGIN
        THROW 50001, 'Project description cannot exceed 100 characters.', 1;
    END;

    BEGIN TRY
        BEGIN TRANSACTION;

        EXEC [pmt].[LockWorkTaskWrites];
        EXEC [pmt].[LockSprintWrites];

        IF @ProjectId <> 0
        BEGIN
            SELECT
                @OwnerUserId = [CreatedByUserId],
                @PreviousProjectCode = [Code]
            FROM [pmt].[Projects] WITH (UPDLOCK, HOLDLOCK)
            WHERE [ProjectId] = @ProjectId
              AND [IsArchived] = 0;

            IF @OwnerUserId IS NULL
            BEGIN
                THROW 50002, 'Project was not found.', 1;
            END;

            IF [pmt].[CanEdit](@OwnerUserId, @CurrentUserId) = 0
            BEGIN
                THROW 50003, 'You cannot edit this project.', 1;
            END;
        END;

        DECLARE @ConflictingProjectId INT;
        DECLARE @ConflictingProjectIsArchived BIT;

        SELECT
            @ConflictingProjectId = [ProjectId],
            @ConflictingProjectIsArchived = [IsArchived]
        FROM [pmt].[Projects] WITH (UPDLOCK, HOLDLOCK)
        WHERE [Code] = @Code
          AND [ProjectId] <> @ProjectId;

        IF @ConflictingProjectId IS NOT NULL
        BEGIN
            IF @ConflictingProjectIsArchived = 0
            BEGIN
                THROW 50004, 'Project code is already in use by an active project.', 1;
            END;

            IF @OverrideArchivedCode = 0
            BEGIN
                THROW 50007, 'Project code belongs to a deleted project. An administrator can reclaim it.', 1;
            END;

            IF [pmt].[IsAdmin](@CurrentUserId) = 0
            BEGIN
                THROW 50008, 'Only an administrator can reclaim a deleted project code.', 1;
            END;

            DECLARE @ArchivedReplacementCode NVARCHAR(5);
            DECLARE @ArchivedCodeAttempt INT = 0;

            WHILE @ArchivedCodeAttempt < 10000
            BEGIN
                SET @ArchivedReplacementCode = N'~'
                    + RIGHT(
                        N'0000' + CONVERT(
                            NVARCHAR(4),
                            (CONVERT(BIGINT, @ConflictingProjectId) + @ArchivedCodeAttempt) % 10000
                        ),
                        4
                    );

                IF NOT EXISTS
                (
                    SELECT 1
                    FROM [pmt].[Projects] WITH (UPDLOCK, HOLDLOCK)
                    WHERE [Code] = @ArchivedReplacementCode
                )
                BEGIN
                    BREAK;
                END;

                SET @ArchivedCodeAttempt += 1;
            END;

            IF @ArchivedCodeAttempt = 10000
            BEGIN
                THROW 50009, 'No archived project code is available for reclaiming this code.', 1;
            END;

            UPDATE [pmt].[Projects]
            SET [Code] = @ArchivedReplacementCode,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = @Now
            WHERE [ProjectId] = @ConflictingProjectId
              AND [IsArchived] = 1;

            EXEC [pmt].[SynchronizeProjectCode]
                @ProjectId = @ConflictingProjectId,
                @PreviousProjectCode = @Code,
                @ProjectCode = @ArchivedReplacementCode;

            DECLARE @ArchivedCodeAuditDetails NVARCHAR(4000) =
                N'Archived project code ' + @Code + N' was released as ' + @ArchivedReplacementCode + N'.';

            EXEC [pmt].[WriteAudit]
                N'Project',
                @ConflictingProjectId,
                N'Code Released',
                @ArchivedCodeAuditDetails,
                @CurrentUserId;
        END;

        IF @ProjectId = 0
        BEGIN
            INSERT INTO [pmt].[Projects]
            (
                [Code],
                [Title],
                [Description],
                [Url],
                [IconUrl],
                [StartDate],
                [EndDate],
                [CreatedByUserId],
                [CreatedAt],
                [UpdatedAt]
            )
            VALUES
            (
                @Code,
                @Title,
                @Description,
                @Url,
                @IconUrl,
                @StartDate,
                @EndDate,
                @CurrentUserId,
                @Now,
                @Now
            );

            SET @ProjectId = SCOPE_IDENTITY();
            EXEC [pmt].[WriteAudit] N'Project', @ProjectId, N'Created', @Title, @CurrentUserId;
        END
        ELSE
        BEGIN
            UPDATE [pmt].[Projects]
            SET
                [Code] = @Code,
                [Title] = @Title,
                [Description] = @Description,
                [Url] = @Url,
                [IconUrl] = @IconUrl,
                [StartDate] = @StartDate,
                [EndDate] = @EndDate,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = @Now
            WHERE [ProjectId] = @ProjectId;

            IF @PreviousProjectCode <> @Code
            BEGIN
                EXEC [pmt].[SynchronizeProjectCode]
                    @ProjectId = @ProjectId,
                    @PreviousProjectCode = @PreviousProjectCode,
                    @ProjectCode = @Code;
            END;

            EXEC [pmt].[WriteAudit] N'Project', @ProjectId, N'Updated', @Title, @CurrentUserId;
        END;

        DELETE FROM [pmt].[ProjectMembers]
        WHERE [ProjectId] = @ProjectId;

        INSERT INTO [pmt].[ProjectMembers] ([ProjectId], [UserId], [CreatedByUserId])
        SELECT @ProjectId, [Ids].[Id], @CurrentUserId
        FROM [pmt].[SplitIds](@MemberIdsCsv) AS [Ids]
        INNER JOIN [pmt].[Users]
            ON [pmt].[Users].[UserId] = [Ids].[Id]
           AND [pmt].[Users].[IsActive] = 1;

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

CREATE OR ALTER PROCEDURE [pmt].[DeleteProject]
    @ProjectId INT,
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @OwnerUserId INT;

    SELECT @OwnerUserId = [CreatedByUserId]
    FROM [pmt].[Projects]
    WHERE [ProjectId] = @ProjectId
      AND [IsArchived] = 0;

    IF @OwnerUserId IS NULL
    BEGIN
        THROW 50005, 'Project was not found.', 1;
    END;

    IF [pmt].[CanEdit](@OwnerUserId, @CurrentUserId) = 0
    BEGIN
        THROW 50006, 'You cannot delete this project.', 1;
    END;

    UPDATE [pmt].[Projects]
    SET [IsArchived] = 1,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [ProjectId] = @ProjectId;

    EXEC [pmt].[WriteAudit] N'Project', @ProjectId, N'Archived', N'Project hidden from active views.', @CurrentUserId;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[UpsertSprint]
    @SprintId INT OUTPUT,
    @ProjectId INT,
    @Title NVARCHAR(160),
    @Description NVARCHAR(MAX),
    @StartDate DATETIME2(0),
    @EndDate DATETIME2(0),
    @LessonLearnedHtml NVARCHAR(MAX),
    @DeveloperIdsCsv NVARCHAR(MAX),
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @OwnerUserId INT;
    DECLARE @ProjectCode NVARCHAR(20);
    DECLARE @Code NVARCHAR(40);
    DECLARE @NextNumber INT;
    DECLARE @NextSortOrder INT;
    DECLARE @IsFinished BIT;

    SET @Title = NULLIF(LTRIM(RTRIM(@Title)), N'');

    IF @Title IS NULL
    BEGIN
        THROW 50010, 'Sprint title is required.', 1;
    END;

    IF @EndDate IS NOT NULL AND @StartDate IS NOT NULL AND @EndDate < @StartDate
    BEGIN
        SET @EndDate = @StartDate;
    END;

    SELECT @ProjectCode = [Code]
    FROM [pmt].[Projects]
    WHERE [ProjectId] = @ProjectId
      AND [IsArchived] = 0;

    IF @ProjectCode IS NULL
    BEGIN
        THROW 50011, 'Project was not found.', 1;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM [pmt].[SplitIds](@DeveloperIdsCsv) AS [Ids]
        WHERE NOT EXISTS
        (
            SELECT 1
            FROM [pmt].[Users]
            WHERE [UserId] = [Ids].[Id]
              AND [IsActive] = 1
        )
        OR NOT EXISTS
        (
            SELECT 1
            FROM [pmt].[ProjectMembers]
            WHERE [ProjectId] = @ProjectId
              AND [UserId] = [Ids].[Id]
        )
    )
    BEGIN
        THROW 50015, 'Sprint members must be members of the selected project.', 1;
    END;

    IF @SprintId = 0
    BEGIN
        SELECT @NextNumber = COUNT(*) + 1
        FROM [pmt].[Sprints]
        WHERE [ProjectId] = @ProjectId;

        SET @Code = @ProjectCode + N'-Sprint' + CONVERT(NVARCHAR(12), @NextNumber);

        WHILE EXISTS (SELECT 1 FROM [pmt].[Sprints] WHERE [Code] = @Code)
        BEGIN
            SET @NextNumber = @NextNumber + 1;
            SET @Code = @ProjectCode + N'-Sprint' + CONVERT(NVARCHAR(12), @NextNumber);
        END;

        INSERT INTO [pmt].[Sprints]
        (
            [ProjectId],
            [Code],
            [Title],
            [Description],
            [StartDate],
            [EndDate],
            [LessonLearnedHtml],
            [CreatedByUserId],
            [CreatedAt],
            [UpdatedAt]
        )
        VALUES
        (
            @ProjectId,
            @Code,
            @Title,
            @Description,
            @StartDate,
            @EndDate,
            @LessonLearnedHtml,
            @CurrentUserId,
            @Now,
            @Now
        );

        SET @SprintId = SCOPE_IDENTITY();
        EXEC [pmt].[WriteAudit] N'Sprint', @SprintId, N'Created', @Title, @CurrentUserId;
    END
    ELSE
    BEGIN
        SELECT
            @OwnerUserId = [CreatedByUserId],
            @IsFinished = [IsFinished]
        FROM [pmt].[Sprints]
        WHERE [SprintId] = @SprintId
          AND [IsDeleted] = 0;

        IF @OwnerUserId IS NULL
        BEGIN
            THROW 50012, 'Sprint was not found.', 1;
        END;

        IF @IsFinished = 1 AND [pmt].[IsAdmin](@CurrentUserId) = 0
        BEGIN
            THROW 50013, 'Finished sprints are read-only for users.', 1;
        END;

        IF [pmt].[CanEdit](@OwnerUserId, @CurrentUserId) = 0
        BEGIN
            THROW 50014, 'You cannot edit this sprint.', 1;
        END;

        UPDATE [pmt].[Sprints]
        SET
            [Title] = @Title,
            [Description] = @Description,
            [StartDate] = @StartDate,
            [EndDate] = @EndDate,
            [LessonLearnedHtml] = @LessonLearnedHtml,
            [UpdatedByUserId] = @CurrentUserId,
            [UpdatedAt] = @Now
        WHERE [SprintId] = @SprintId;

        EXEC [pmt].[WriteAudit] N'Sprint', @SprintId, N'Updated', @Title, @CurrentUserId;
    END;

    DELETE FROM [pmt].[SprintMembers]
    WHERE [SprintId] = @SprintId;

    INSERT INTO [pmt].[SprintMembers] ([SprintId], [UserId], [CreatedByUserId])
    SELECT @SprintId, [Ids].[Id], @CurrentUserId
    FROM [pmt].[SplitIds](@DeveloperIdsCsv) AS [Ids]
    INNER JOIN [pmt].[Users]
        ON [pmt].[Users].[UserId] = [Ids].[Id]
       AND [pmt].[Users].[IsActive] = 1
    INNER JOIN [pmt].[ProjectMembers]
        ON [pmt].[ProjectMembers].[ProjectId] = @ProjectId
       AND [pmt].[ProjectMembers].[UserId] = [Ids].[Id];
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[UpsertTask]
    @TaskId INT OUTPUT,
    @ProjectId INT,
    @SprintId INT,
    @ParentTaskId INT,
    @TaskType NVARCHAR(20),
    @Title NVARCHAR(220),
    @DescriptionHtml NVARCHAR(MAX),
    @StepsToReproduceHtml NVARCHAR(MAX),
    @ActualResultHtml NVARCHAR(MAX),
    @ExpectedResultHtml NVARCHAR(MAX),
    @RootCauseAnalysisHtml NVARCHAR(MAX),
    @Environment NVARCHAR(40),
    @Severity NVARCHAR(40),
    @Status NVARCHAR(40),
    @Priority NVARCHAR(20),
    @PercentCompleted INT,
    @Url NVARCHAR(500),
    @StartDate DATETIME2(0),
    @EndDate DATETIME2(0),
    @ReporterIdsCsv NVARCHAR(MAX),
    @AssigneeIdsCsv NVARCHAR(MAX),
    @DependencyTaskIdsCsv NVARCHAR(MAX),
    @CurrentUserId INT,
    @AllowBacklogAccess BIT = 0,
    @AuditContext NVARCHAR(80) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @IsImport BIT = CASE WHEN LOWER(LTRIM(RTRIM(ISNULL(@AuditContext, N'')))) = N'import' THEN 1 ELSE 0 END;
    DECLARE @OwnerUserId INT;
    DECLARE @ProjectCode NVARCHAR(20);
    DECLARE @Code NVARCHAR(40);
    DECLARE @NextNumber INT;
    DECLARE @NextSortOrder INT;
    DECLARE @OldStatus NVARCHAR(40);
    DECLARE @OldSprintId INT;
    DECLARE @OldPercentCompleted INT;
    DECLARE @OldAssignees NVARCHAR(MAX);
    DECLARE @NewAssignees NVARCHAR(MAX);
    DECLARE @StartedAt DATETIME2(0);
    DECLARE @AuditDetails NVARCHAR(MAX);
    DECLARE @ExistingTaskType NVARCHAR(20);
    DECLARE @ExistingLinkedBugTaskId INT;
    DECLARE @CodeSuffix NVARCHAR(20);
    DECLARE @LinkedDevTaskId INT;
    DECLARE @BugProjectId INT;
    DECLARE @BugSprintId INT;
    DECLARE @LinkedBugToRetestId INT;
    DECLARE @LinkedOldStatus NVARCHAR(40);
    DECLARE @LinkedNewStatus NVARCHAR(40);
    DECLARE @LinkedOldPercentCompleted INT;
    DECLARE @LinkedNewPercentCompleted INT;
    DECLARE @ParentOldStatus NVARCHAR(40);
    DECLARE @ParentNewStatus NVARCHAR(40);
    DECLARE @ParentOldPercentCompleted INT;
    DECLARE @ParentNewPercentCompleted INT;
    DECLARE @CompletionBlockBugTaskId INT;
    DECLARE @AssociatedDevTaskId INT;
    DECLARE @AssociatedOldStatus NVARCHAR(40);
    DECLARE @AssociatedOldPercentCompleted INT;
    DECLARE @AssociatedNewPercentCompleted INT;
    DECLARE @RootCauseSyncTargetId INT;
    DECLARE @AssociatedDevTaskUpdates TABLE
    (
        [TaskId] INT NOT NULL PRIMARY KEY,
        [OldStatus] NVARCHAR(40) NOT NULL,
        [NewStatus] NVARCHAR(40) NOT NULL,
        [OldPercentCompleted] INT NOT NULL,
        [NewPercentCompleted] INT NOT NULL
    );

    SET @Title = NULLIF(LTRIM(RTRIM(@Title)), N'');
    SET @TaskType = ISNULL(NULLIF(LTRIM(RTRIM(@TaskType)), N''), N'Dev');
    SET @Status = ISNULL(NULLIF(LTRIM(RTRIM(@Status)), N''), N'Todo');
    SET @Priority = ISNULL(NULLIF(LTRIM(RTRIM(@Priority)), N''), N'Low');
    SET @Environment = NULLIF(LTRIM(RTRIM(@Environment)), N'');
    SET @Severity = NULLIF(LTRIM(RTRIM(@Severity)), N'');
    SET @PercentCompleted = CASE
        WHEN @PercentCompleted < 0 THEN 0
        WHEN @PercentCompleted > 100 THEN 100
        ELSE @PercentCompleted
    END;
    SET @ReporterIdsCsv = ISNULL(@ReporterIdsCsv, N'');
    SET @AssigneeIdsCsv = ISNULL(@AssigneeIdsCsv, N'');
    SET @DependencyTaskIdsCsv = ISNULL(@DependencyTaskIdsCsv, N'');
    IF @EndDate IS NOT NULL AND @StartDate IS NOT NULL AND @EndDate < @StartDate
    BEGIN
        SET @EndDate = @StartDate;
    END;

    IF @Title IS NULL
    BEGIN
        THROW 50030, 'Task title is required.', 1;
    END;

    IF @TaskType NOT IN (N'Dev', N'Bug')
    BEGIN
        THROW 50030, 'Task type is invalid.', 1;
    END;

    IF @TaskId = 0
       AND @AllowBacklogAccess = 0
       AND [pmt].[CanEditTaskType](@TaskType, @CurrentUserId) = 0
    BEGIN
        THROW 50030, 'Your role cannot edit this kind of task.', 1;
    END;

    IF @TaskId <> 0
    BEGIN
        SELECT
            @OwnerUserId = [CreatedByUserId],
            @ExistingTaskType = [TaskType],
            @OldStatus = [Status],
            @OldSprintId = [SprintId],
            @OldPercentCompleted = [PercentCompleted],
            @StartedAt = [StartedAt],
            @ExistingLinkedBugTaskId = [LinkedBugTaskId]
        FROM [pmt].[WorkTasks]
        WHERE [TaskId] = @TaskId
          AND [IsDeleted] = 0;

        IF @OwnerUserId IS NULL
        BEGIN
            THROW 50038, 'Task was not found.', 1;
        END;

        IF @IsImport = 1
           AND [pmt].[IsAdmin](@CurrentUserId) = 0
           AND @OwnerUserId <> @CurrentUserId
        BEGIN
            THROW 50053, 'Only an Admin can import updates for another user''s task.', 1;
        END;

        IF [pmt].[CanEditTaskType](@ExistingTaskType, @CurrentUserId) = 0
           AND NOT (@AllowBacklogAccess = 1 AND @OldStatus IN (N'Backlog', N'Todo'))
        BEGIN
            THROW 50039, 'You cannot edit this task.', 1;
        END;

        IF [pmt].[IsAdmin](@CurrentUserId) = 0
        BEGIN
            SET @TaskType = @ExistingTaskType;
        END;
    END;

    IF NOT EXISTS (SELECT 1 FROM [pmt].[Lookups] WHERE [LookupType] = N'Status' AND [Value] = @Status AND [IsActive] = 1)
    BEGIN
        THROW 50031, 'Task status is invalid.', 1;
    END;

    IF NOT EXISTS (SELECT 1 FROM [pmt].[Lookups] WHERE [LookupType] = N'Priority' AND [Value] = @Priority AND [IsActive] = 1)
    BEGIN
        THROW 50032, 'Task priority is invalid.', 1;
    END;

    -- Developers may hand work to QA and move it through QA Passed, but only
    -- release roles may move a Dev Task into a later deployment status.
    IF @TaskType = N'Dev'
       AND [pmt].[UserRole](@CurrentUserId) = N'Developer'
       AND EXISTS
       (
           SELECT 1
           FROM [pmt].[Lookups] AS [TargetStatus]
           INNER JOIN [pmt].[Lookups] AS [QaPassed]
               ON [QaPassed].[LookupType] = N'Status'
              AND [QaPassed].[Value] = N'QA Passed'
              AND [QaPassed].[IsActive] = 1
           WHERE [TargetStatus].[LookupType] = N'Status'
             AND [TargetStatus].[Value] = @Status
             AND [TargetStatus].[IsActive] = 1
             AND [TargetStatus].[DisplayOrder] > [QaPassed].[DisplayOrder]
       )
    BEGIN
        THROW 50069, 'Developers can move Dev Tasks through QA Passed, but not to deployment statuses.', 1;
    END;

    IF @TaskType = N'Bug'
    BEGIN
        SET @Environment = ISNULL(@Environment, N'SIT');
        SET @Severity = ISNULL(@Severity, N'Minor');

        IF NOT EXISTS (SELECT 1 FROM [pmt].[Lookups] WHERE [LookupType] = N'Environment' AND [Value] = @Environment AND [IsActive] = 1)
        BEGIN
            THROW 50032, 'Bug environment is invalid.', 1;
        END;

        IF NOT EXISTS (SELECT 1 FROM [pmt].[Lookups] WHERE [LookupType] = N'Severity' AND [Value] = @Severity AND [IsActive] = 1)
        BEGIN
            THROW 50032, 'Bug severity is invalid.', 1;
        END;

        IF NOT EXISTS (SELECT 1 FROM [pmt].[SplitIds](@ReporterIdsCsv))
        BEGIN
            SET @ReporterIdsCsv = CONVERT(NVARCHAR(20), @CurrentUserId);
        END;
    END
    ELSE
    BEGIN
        SET @StepsToReproduceHtml = NULL;
        SET @ActualResultHtml = NULL;
        SET @ExpectedResultHtml = NULL;
        SET @Environment = NULL;
        SET @Severity = NULL;
        SET @ReporterIdsCsv = N'';
    END;

    -- Keep the status and percent rules in one obvious place.
    -- A Backlog choice means "unscheduled Todo" in the database.
    IF @Status = N'Backlog'
    BEGIN
        SET @Status = N'Todo';
        SET @SprintId = NULL;
    END;

    -- Moving an existing task onto a sprint restarts it as planned work.
    IF @TaskType = N'Dev' AND @SprintId IS NOT NULL AND (@TaskId = 0 OR @OldSprintId IS NULL)
    BEGIN
        SET @Status = N'Todo';
    END;

    IF @Status = N'Todo'
    BEGIN
        SET @PercentCompleted = CASE
            WHEN ISNULL(@OldPercentCompleted, 0) > 0 THEN @OldPercentCompleted
            ELSE 0
        END;
    END;

    IF @TaskType = N'Dev'
    BEGIN
        SET @CompletionBlockBugTaskId = @ExistingLinkedBugTaskId;

        IF @CompletionBlockBugTaskId IS NULL
        BEGIN
            SELECT TOP (1) @CompletionBlockBugTaskId = [BugTask].[TaskId]
            FROM [pmt].[SplitIds](@DependencyTaskIdsCsv) AS [Ids]
            INNER JOIN [pmt].[WorkTasks] AS [BugTask]
                ON [BugTask].[TaskId] = [Ids].[Id]
               AND [BugTask].[TaskType] = N'Bug'
               AND [BugTask].[IsDeleted] = 0
            ORDER BY [BugTask].[TaskId];
        END;
    END;

    IF @TaskType = N'Bug' AND (@Status IN (N'QA Failed', N'QA Passed') OR @Status LIKE N'Deployed%')
    BEGIN
        SET @PercentCompleted = 100;
    END;

    IF @TaskType <> N'Dev' AND (@Status = N'QA Passed' OR @Status LIKE N'Deployed%')
    BEGIN
        SET @PercentCompleted = 100;
    END;

    IF @TaskType = N'Dev' AND @Status = N'Todo' AND @CompletionBlockBugTaskId IS NULL
    BEGIN
        SET @PercentCompleted = 0;
    END;

    IF @TaskType = N'Dev' AND @Status = N'Ready for QA'
    BEGIN
        SET @PercentCompleted = CASE WHEN @CompletionBlockBugTaskId IS NULL THEN 100 ELSE 50 END;
    END;

    IF @TaskType = N'Dev' AND @Status = N'QA Failed' AND @CompletionBlockBugTaskId IS NULL
    BEGIN
        SET @PercentCompleted = 50;
    END;

    IF @TaskType = N'Dev'
       AND (@Status = N'QA Passed' OR @Status LIKE N'Deployed%')
       AND @CompletionBlockBugTaskId IS NULL
    BEGIN
        SET @PercentCompleted = 100;
    END;

    IF @TaskType = N'Dev' AND @Status = N'Code Complete'
    BEGIN
        SET @PercentCompleted = CASE WHEN @CompletionBlockBugTaskId IS NULL THEN 100 ELSE 50 END;
    END;

    IF @TaskType = N'Dev' AND @PercentCompleted >= 100
    BEGIN
        IF @CompletionBlockBugTaskId IS NOT NULL
           AND NOT EXISTS
           (
               SELECT 1
               FROM [pmt].[WorkTasks]
               WHERE [TaskId] = @CompletionBlockBugTaskId
                 AND [Status] IN (N'QA Passed', N'Deployed in SIT', N'Deployed in UAT', N'Deployed in Prod')
                 AND [IsDeleted] = 0
           )
        BEGIN
            THROW 50052, 'You cannot mark this task as complete until the associated bug is marked as QA Passed.  Once QA has re-tested the bug and passed it, the completion of your Dev Task will be set to 100%%.', 1;
        END;
    END;

    SELECT @ProjectCode = [Code]
    FROM [pmt].[Projects]
    WHERE [ProjectId] = @ProjectId
      AND [IsArchived] = 0;

    IF @ProjectCode IS NULL
    BEGIN
        THROW 50033, 'Project was not found.', 1;
    END;

    IF @SprintId IS NOT NULL
    BEGIN
        IF NOT EXISTS
        (
            SELECT 1
            FROM [pmt].[Sprints]
            WHERE [SprintId] = @SprintId
              AND [ProjectId] = @ProjectId
              AND [IsDeleted] = 0
        )
        BEGIN
            THROW 50034, 'Sprint was not found for this project.', 1;
        END;

        IF EXISTS
        (
            SELECT 1
            FROM [pmt].[Sprints]
            WHERE [SprintId] = @SprintId
              AND [IsFinished] = 1
              AND [pmt].[IsAdmin](@CurrentUserId) = 0
        )
        BEGIN
            THROW 50035, 'Finished sprints are read-only for users.', 1;
        END;
    END;

    IF @ParentTaskId IS NOT NULL
    BEGIN
        IF @ParentTaskId = @TaskId
        BEGIN
            THROW 50036, 'A task cannot be its own parent.', 1;
        END;

        IF NOT EXISTS
        (
            SELECT 1
            FROM [pmt].[WorkTasks]
            WHERE [TaskId] = @ParentTaskId
              AND [ProjectId] = @ProjectId
              AND [IsDeleted] = 0
        )
        BEGIN
            THROW 50037, 'Parent task was not found for this project.', 1;
        END;
    END;

    -- Assignees are optional for both Dev Tasks and Bug Reports. The filtered
    -- insert below keeps only active members of the selected Project or Sprint.

    IF @TaskId = 0
    BEGIN
        SELECT @NextNumber = COUNT(*) + 1
        FROM [pmt].[WorkTasks]
        WHERE [ProjectId] = @ProjectId
          AND [TaskType] = @TaskType;

        SET @CodeSuffix = CASE WHEN @TaskType = N'Bug' THEN N'-Bug' ELSE N'-Task' END;
        SET @Code = @ProjectCode + @CodeSuffix + CONVERT(NVARCHAR(12), @NextNumber);

        WHILE EXISTS (SELECT 1 FROM [pmt].[WorkTasks] WHERE [Code] = @Code)
        BEGIN
            SET @NextNumber = @NextNumber + 1;
            SET @Code = @ProjectCode + @CodeSuffix + CONVERT(NVARCHAR(12), @NextNumber);
        END;

        IF @Status NOT IN (N'Backlog', N'Todo')
        BEGIN
            SET @StartedAt = @Now;
        END;

        SELECT @NextSortOrder = ISNULL(MAX([SortOrder]), 0) + 10
        FROM [pmt].[WorkTasks]
        WHERE [ProjectId] = @ProjectId
          AND ISNULL([SprintId], 0) = ISNULL(@SprintId, 0)
          AND [Status] = @Status
          AND [IsDeleted] = 0;

        INSERT INTO [pmt].[WorkTasks]
        (
            [ProjectId],
            [SprintId],
            [ParentTaskId],
            [TaskType],
            [Code],
            [Title],
            [DescriptionHtml],
            [StepsToReproduceHtml],
            [ActualResultHtml],
            [ExpectedResultHtml],
            [RootCauseAnalysisHtml],
            [Environment],
            [Severity],
            [Status],
            [Priority],
            [SortOrder],
            [PercentCompleted],
            [Url],
            [StartDate],
            [EndDate],
            [StartedAt],
            [CreatedByUserId],
            [CreatedAt],
            [UpdatedAt]
        )
        VALUES
        (
            @ProjectId,
            @SprintId,
            @ParentTaskId,
            @TaskType,
            @Code,
            @Title,
            @DescriptionHtml,
            @StepsToReproduceHtml,
            @ActualResultHtml,
            @ExpectedResultHtml,
            @RootCauseAnalysisHtml,
            @Environment,
            @Severity,
            @Status,
            @Priority,
            @NextSortOrder,
            @PercentCompleted,
            @Url,
            @StartDate,
            @EndDate,
            @StartedAt,
            @CurrentUserId,
            @Now,
            @Now
        );

        SET @TaskId = SCOPE_IDENTITY();
        EXEC [pmt].[WriteAudit] N'Task', @TaskId, N'Created', @Title, @CurrentUserId, NULL, @Status, NULL, @PercentCompleted;
    END
    ELSE
    BEGIN
        -- Parent task percent is calculated from sub-tasks, not typed by hand.
        IF EXISTS
           (
               SELECT 1
               FROM [pmt].[WorkTasks]
               WHERE [ParentTaskId] = @TaskId
                 AND [IsDeleted] = 0
           )
        BEGIN
            SELECT @PercentCompleted = CONVERT(INT, ROUND(AVG(CONVERT(DECIMAL(10, 2), [PercentCompleted])), 0))
            FROM [pmt].[WorkTasks]
            WHERE [ParentTaskId] = @TaskId
              AND [IsDeleted] = 0;
        END;

        IF @StartedAt IS NULL AND @Status NOT IN (N'Backlog', N'Todo')
        BEGIN
            SET @StartedAt = @Now;
        END;

        SELECT @OldAssignees = STRING_AGG(CONVERT(NVARCHAR(20), [UserId]), N',')
        FROM [pmt].[TaskAssignees]
        WHERE [TaskId] = @TaskId;

        UPDATE [pmt].[WorkTasks]
        SET
            [ProjectId] = @ProjectId,
            [SprintId] = @SprintId,
            [ParentTaskId] = @ParentTaskId,
            [TaskType] = @TaskType,
            [Title] = @Title,
            [DescriptionHtml] = @DescriptionHtml,
            [StepsToReproduceHtml] = @StepsToReproduceHtml,
            [ActualResultHtml] = @ActualResultHtml,
            [ExpectedResultHtml] = @ExpectedResultHtml,
            [RootCauseAnalysisHtml] = @RootCauseAnalysisHtml,
            [Environment] = @Environment,
            [Severity] = @Severity,
            [Status] = @Status,
            [Priority] = @Priority,
            [PercentCompleted] = @PercentCompleted,
            [Url] = @Url,
            [StartDate] = @StartDate,
            [EndDate] = @EndDate,
            [StartedAt] = @StartedAt,
            [UpdatedByUserId] = @CurrentUserId,
            [UpdatedAt] = @Now
        WHERE [TaskId] = @TaskId;

        IF ISNULL(@OldStatus, N'') <> ISNULL(@Status, N'')
           OR ISNULL(@OldPercentCompleted, -1) <> ISNULL(@PercentCompleted, -1)
        BEGIN
            SET @AuditDetails =
                N'Status: ' + ISNULL(@OldStatus, N'') + N' -> ' + ISNULL(@Status, N'') +
                N'; Percent: ' + CONVERT(NVARCHAR(12), ISNULL(@OldPercentCompleted, 0)) +
                N'% -> ' + CONVERT(NVARCHAR(12), ISNULL(@PercentCompleted, 0)) + N'%';

            EXEC [pmt].[WriteAudit]
                N'Task',
                @TaskId,
                N'Status/Percent Changed',
                @AuditDetails,
                @CurrentUserId,
                @OldStatus,
                @Status,
                @OldPercentCompleted,
                @PercentCompleted;
        END;

        IF ISNULL(@OldSprintId, 0) <> ISNULL(@SprintId, 0)
        BEGIN
            EXEC [pmt].[WriteAudit] N'Task', @TaskId, N'Sprint Changed', N'Task moved between sprints.', @CurrentUserId;
        END;

        IF @IsImport = 1
        BEGIN
            EXEC [pmt].[WriteAudit] N'Task', @TaskId, N'Imported', N'Task updated by import process.', @CurrentUserId;
        END
        ELSE
        BEGIN
            EXEC [pmt].[WriteAudit] N'Task', @TaskId, N'Updated', @Title, @CurrentUserId;
        END;
    END;

    DELETE FROM [pmt].[TaskAssignees]
    WHERE [TaskId] = @TaskId;

    INSERT INTO [pmt].[TaskAssignees] ([TaskId], [UserId], [CreatedByUserId])
    SELECT @TaskId, [Ids].[Id], @CurrentUserId
    FROM [pmt].[SplitIds](@AssigneeIdsCsv) AS [Ids]
    INNER JOIN [pmt].[Users]
        ON [pmt].[Users].[UserId] = [Ids].[Id]
       AND [pmt].[Users].[IsActive] = 1
    WHERE
    (
        @SprintId IS NULL
        AND EXISTS
        (
            SELECT 1
            FROM [pmt].[ProjectMembers]
            WHERE [ProjectId] = @ProjectId
              AND [UserId] = [Ids].[Id]
        )
    )
    OR
    (
        @SprintId IS NOT NULL
        AND EXISTS
        (
            SELECT 1
            FROM [pmt].[SprintMembers]
            WHERE [SprintId] = @SprintId
              AND [UserId] = [Ids].[Id]
        )
    );

    DELETE FROM [pmt].[TaskReporters]
    WHERE [TaskId] = @TaskId;

    INSERT INTO [pmt].[TaskReporters] ([TaskId], [UserId], [CreatedByUserId])
    SELECT @TaskId, [Ids].[Id], @CurrentUserId
    FROM [pmt].[SplitIds](@ReporterIdsCsv) AS [Ids]
    INNER JOIN [pmt].[Users]
        ON [pmt].[Users].[UserId] = [Ids].[Id]
       AND [pmt].[Users].[IsActive] = 1;

    DELETE FROM [pmt].[TaskDependencies]
    WHERE [TaskId] = @TaskId;

    INSERT INTO [pmt].[TaskDependencies] ([TaskId], [DependsOnTaskId], [CreatedByUserId])
    SELECT @TaskId, [Ids].[Id], @CurrentUserId
    FROM [pmt].[SplitIds](@DependencyTaskIdsCsv) AS [Ids]
    INNER JOIN [pmt].[WorkTasks]
        ON [pmt].[WorkTasks].[TaskId] = [Ids].[Id]
       AND [pmt].[WorkTasks].[ProjectId] = @ProjectId
       AND [pmt].[WorkTasks].[IsDeleted] = 0
    WHERE [Ids].[Id] <> @TaskId;

    SELECT @NewAssignees = STRING_AGG(CONVERT(NVARCHAR(20), [UserId]), N',')
    FROM [pmt].[TaskAssignees]
    WHERE [TaskId] = @TaskId;

    IF ISNULL(@OldAssignees, N'') <> ISNULL(@NewAssignees, N'')
    BEGIN
        EXEC [pmt].[WriteAudit] N'Task', @TaskId, N'Assignees Changed', N'Task assignment list changed.', @CurrentUserId;
    END;

    IF @TaskType = N'Bug'
    BEGIN
        SELECT
            @BugProjectId = [ProjectId],
            @BugSprintId = [SprintId]
        FROM [pmt].[WorkTasks]
        WHERE [TaskId] = @TaskId
          AND [IsDeleted] = 0;

        SELECT TOP (1) @LinkedDevTaskId = [TaskId]
        FROM [pmt].[WorkTasks]
        WHERE [LinkedBugTaskId] = @TaskId
          AND [TaskType] = N'Dev'
          AND [IsDeleted] = 0
        ORDER BY [TaskId];
    END;

    IF @TaskType = N'Bug'
       AND EXISTS (SELECT 1 FROM [pmt].[TaskAssignees] WHERE [TaskId] = @TaskId)
    BEGIN
        IF @LinkedDevTaskId IS NULL
        BEGIN
            SELECT @NextNumber = COUNT(*) + 1
            FROM [pmt].[WorkTasks]
            WHERE [ProjectId] = @BugProjectId
              AND [TaskType] = N'Dev';

            SET @Code = @ProjectCode + N'-Task' + CONVERT(NVARCHAR(12), @NextNumber);

            WHILE EXISTS (SELECT 1 FROM [pmt].[WorkTasks] WHERE [Code] = @Code)
            BEGIN
                SET @NextNumber = @NextNumber + 1;
                SET @Code = @ProjectCode + N'-Task' + CONVERT(NVARCHAR(12), @NextNumber);
            END;

            -- URL synchronization for this relationship runs from Bug to Dev Task only.
            INSERT INTO [pmt].[WorkTasks]
            (
                [ProjectId],
                [SprintId],
                [TaskType],
                [Code],
                [Title],
                [DescriptionHtml],
                [Status],
                [Priority],
                [PercentCompleted],
                [Url],
                [StartDate],
                [EndDate],
                [LinkedBugTaskId],
                [CreatedByUserId],
                [CreatedAt],
                [UpdatedAt]
            )
            VALUES
            (
                @BugProjectId,
                @BugSprintId,
                N'Dev',
                @Code,
                N'Bug Fix: ' + @Title,
                ISNULL(@DescriptionHtml, N''),
                N'Todo',
                @Priority,
                0,
                @Url,
                @StartDate,
                @EndDate,
                @TaskId,
                @CurrentUserId,
                @Now,
                @Now
            );

            SET @LinkedDevTaskId = SCOPE_IDENTITY();
            EXEC [pmt].[WriteAudit] N'Task', @LinkedDevTaskId, N'Created', N'Created from assigned bug.', @CurrentUserId;
        END
        ELSE
        BEGIN
            -- Keep the linked Dev Task URL aligned when the Bug is saved again.
            UPDATE [pmt].[WorkTasks]
            SET [ProjectId] = @BugProjectId,
                [SprintId] = @BugSprintId,
                [Title] = N'Bug Fix: ' + @Title,
                [Priority] = @Priority,
                [Url] = @Url,
                [StartDate] = @StartDate,
                [EndDate] = @EndDate,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = @Now
            WHERE [TaskId] = @LinkedDevTaskId;
        END;

        DELETE FROM [pmt].[TaskAssignees]
        WHERE [TaskId] = @LinkedDevTaskId;

        INSERT INTO [pmt].[TaskAssignees] ([TaskId], [UserId], [CreatedByUserId])
        SELECT @LinkedDevTaskId, [UserId], @CurrentUserId
        FROM [pmt].[TaskAssignees]
        WHERE [TaskId] = @TaskId;

        IF NOT EXISTS
        (
            SELECT 1
            FROM [pmt].[TaskDependencies]
            WHERE [TaskId] = @LinkedDevTaskId
              AND [DependsOnTaskId] = @TaskId
        )
        BEGIN
            INSERT INTO [pmt].[TaskDependencies] ([TaskId], [DependsOnTaskId], [CreatedByUserId])
            VALUES (@LinkedDevTaskId, @TaskId, @CurrentUserId);
        END;
    END;

    -- Root Cause Analysis has one source of truth: the developer updates the
    -- Dev Task, and that value replaces the associated Bug value. Bug saves
    -- never write Root Cause Analysis back to a Dev Task.
    IF @TaskType = N'Dev'
    BEGIN
        SELECT TOP (1) @RootCauseSyncTargetId = [BugTask].[TaskId]
        FROM [pmt].[WorkTasks] AS [BugTask]
        WHERE [BugTask].[TaskType] = N'Bug'
          AND [BugTask].[IsDeleted] = 0
          AND
          (
              [BugTask].[TaskId] = @ExistingLinkedBugTaskId
              OR EXISTS
              (
                  SELECT 1
                  FROM [pmt].[TaskDependencies] AS [Dependency]
                  WHERE [Dependency].[TaskId] = @TaskId
                    AND [Dependency].[DependsOnTaskId] = [BugTask].[TaskId]
              )
              OR EXISTS
              (
                  SELECT 1
                  FROM [pmt].[TaskDependencies] AS [Dependency]
                  WHERE [Dependency].[TaskId] = [BugTask].[TaskId]
                    AND [Dependency].[DependsOnTaskId] = @TaskId
              )
          )
        ORDER BY
            CASE WHEN [BugTask].[TaskId] = @ExistingLinkedBugTaskId THEN 0 ELSE 1 END,
            [BugTask].[TaskId];

        IF @RootCauseSyncTargetId IS NOT NULL
        BEGIN
            UPDATE [pmt].[WorkTasks]
            SET
                [RootCauseAnalysisHtml] = @RootCauseAnalysisHtml,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = @Now
            WHERE [TaskId] = @RootCauseSyncTargetId
              AND ISNULL([RootCauseAnalysisHtml], N'') <> ISNULL(@RootCauseAnalysisHtml, N'');
        END;
    END;

    -- QA and deployment results on a Bug move associated Dev Tasks to the right progress point.
    IF @TaskType = N'Bug' AND (@Status IN (N'QA Passed', N'QA Failed') OR @Status LIKE N'Deployed%')
    BEGIN
        SET @LinkedNewPercentCompleted = CASE WHEN @Status = N'QA Failed' THEN 50 ELSE 100 END;

        INSERT INTO @AssociatedDevTaskUpdates
        (
            [TaskId],
            [OldStatus],
            [NewStatus],
            [OldPercentCompleted],
            [NewPercentCompleted]
        )
        SELECT DISTINCT
            [DevTask].[TaskId],
            [DevTask].[Status],
            CASE WHEN @Status = N'QA Passed' THEN N'QA Passed' ELSE [DevTask].[Status] END,
            [DevTask].[PercentCompleted],
            @LinkedNewPercentCompleted
        FROM [pmt].[WorkTasks] AS [DevTask]
        WHERE [DevTask].[TaskType] = N'Dev'
          AND [DevTask].[IsDeleted] = 0
          AND
          (
              [DevTask].[LinkedBugTaskId] = @TaskId
              OR EXISTS
              (
                  SELECT 1
                  FROM [pmt].[TaskDependencies] AS [Dependency]
                  WHERE [Dependency].[TaskId] = [DevTask].[TaskId]
                    AND [Dependency].[DependsOnTaskId] = @TaskId
              )
              OR EXISTS
              (
                  SELECT 1
                  FROM [pmt].[TaskDependencies] AS [Dependency]
                  WHERE [Dependency].[TaskId] = @TaskId
                    AND [Dependency].[DependsOnTaskId] = [DevTask].[TaskId]
              )
          )
          AND
          (
              ISNULL([DevTask].[PercentCompleted], -1) <> @LinkedNewPercentCompleted
              OR (@Status = N'QA Passed' AND [DevTask].[Status] <> N'QA Passed')
          );

        UPDATE [DevTask]
        SET
            [Status] = [Updates].[NewStatus],
            [PercentCompleted] = [Updates].[NewPercentCompleted],
            [UpdatedByUserId] = @CurrentUserId,
            [UpdatedAt] = @Now
        FROM [pmt].[WorkTasks] AS [DevTask]
        INNER JOIN @AssociatedDevTaskUpdates AS [Updates]
            ON [Updates].[TaskId] = [DevTask].[TaskId];

        DECLARE AssociatedDevTaskAudit CURSOR LOCAL FAST_FORWARD FOR
            SELECT
                [TaskId],
                [OldStatus],
                [NewStatus],
                [OldPercentCompleted],
                [NewPercentCompleted]
            FROM @AssociatedDevTaskUpdates
            ORDER BY [TaskId];

        OPEN AssociatedDevTaskAudit;
        FETCH NEXT FROM AssociatedDevTaskAudit
            INTO @AssociatedDevTaskId, @AssociatedOldStatus, @LinkedNewStatus, @AssociatedOldPercentCompleted, @AssociatedNewPercentCompleted;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @AuditDetails =
                N'Associated Bug result set Dev Task status/percent: ' +
                ISNULL(@AssociatedOldStatus, N'') + N' -> ' + ISNULL(@LinkedNewStatus, N'') +
                N'; Percent: ' +
                CONVERT(NVARCHAR(12), ISNULL(@AssociatedOldPercentCompleted, 0)) +
                N'% -> ' + CONVERT(NVARCHAR(12), @AssociatedNewPercentCompleted) + N'%';

            EXEC [pmt].[WriteAudit]
                N'Task',
                @AssociatedDevTaskId,
                N'Status/Percent Changed',
                @AuditDetails,
                @CurrentUserId,
                @AssociatedOldStatus,
                @LinkedNewStatus,
                @AssociatedOldPercentCompleted,
                @AssociatedNewPercentCompleted;

            FETCH NEXT FROM AssociatedDevTaskAudit
                INTO @AssociatedDevTaskId, @AssociatedOldStatus, @LinkedNewStatus, @AssociatedOldPercentCompleted, @AssociatedNewPercentCompleted;
        END;

        CLOSE AssociatedDevTaskAudit;
        DEALLOCATE AssociatedDevTaskAudit;
    END;

    -- A Bug Fix at Code Complete or Ready for QA sends the linked Bug back to QA at 50%.
    IF @TaskType = N'Dev' AND @Status IN (N'Code Complete', N'Ready for QA')
    BEGIN
        SET @LinkedBugToRetestId = @ExistingLinkedBugTaskId;

        IF @LinkedBugToRetestId IS NULL
        BEGIN
            SELECT TOP (1) @LinkedBugToRetestId = [BugTask].[TaskId]
            FROM [pmt].[SplitIds](@DependencyTaskIdsCsv) AS [Ids]
            INNER JOIN [pmt].[WorkTasks] AS [BugTask]
                ON [BugTask].[TaskId] = [Ids].[Id]
               AND [BugTask].[TaskType] = N'Bug'
               AND [BugTask].[IsDeleted] = 0
            ORDER BY [BugTask].[TaskId];
        END;

        IF @LinkedBugToRetestId IS NOT NULL
        BEGIN
            SET @LinkedNewStatus = N'Ready for QA';
            SET @LinkedNewPercentCompleted = 50;

            SELECT
                @LinkedOldStatus = [Status],
                @LinkedOldPercentCompleted = [PercentCompleted]
            FROM [pmt].[WorkTasks]
            WHERE [TaskId] = @LinkedBugToRetestId;

            IF ISNULL(@LinkedOldStatus, N'') <> @LinkedNewStatus
               OR ISNULL(@LinkedOldPercentCompleted, -1) <> @LinkedNewPercentCompleted
            BEGIN
                UPDATE [pmt].[WorkTasks]
                SET
                    [Status] = @LinkedNewStatus,
                    [PercentCompleted] = @LinkedNewPercentCompleted,
                    [UpdatedByUserId] = @CurrentUserId,
                    [UpdatedAt] = @Now
                WHERE [TaskId] = @LinkedBugToRetestId;

                SET @AuditDetails =
                    N'Linked Bug Fix ready for QA; Bug status/percent updated: ' +
                    ISNULL(@LinkedOldStatus, N'') + N' -> ' + @LinkedNewStatus +
                    N'; Percent: ' + CONVERT(NVARCHAR(12), ISNULL(@LinkedOldPercentCompleted, 0)) +
                    N'% -> ' + CONVERT(NVARCHAR(12), @LinkedNewPercentCompleted) + N'%';

                EXEC [pmt].[WriteAudit]
                    N'Task',
                    @LinkedBugToRetestId,
                    N'Status/Percent Changed',
                    @AuditDetails,
                    @CurrentUserId,
                    @LinkedOldStatus,
                    @LinkedNewStatus,
                    @LinkedOldPercentCompleted,
                    @LinkedNewPercentCompleted;
            END;
        END;
    END;

    -- When a sub-task changes, refresh the parent task's calculated percent and
    -- make sure active child work lifts a Todo parent into active work too.
    IF @ParentTaskId IS NOT NULL
    BEGIN
        SELECT
            @ParentOldStatus = [Status],
            @ParentOldPercentCompleted = [PercentCompleted]
        FROM [pmt].[WorkTasks]
        WHERE [TaskId] = @ParentTaskId;

        SET @ParentNewStatus = CASE
            WHEN @Status NOT IN (N'Backlog', N'Todo') AND @ParentOldStatus IN (N'Backlog', N'Todo') THEN N'In Progress'
            ELSE @ParentOldStatus
        END;

        SELECT @ParentNewPercentCompleted = CONVERT(INT, ROUND(AVG(CONVERT(DECIMAL(10, 2), [PercentCompleted])), 0))
        FROM [pmt].[WorkTasks]
        WHERE [ParentTaskId] = @ParentTaskId
          AND [IsDeleted] = 0;

        IF @ParentNewPercentCompleted IS NOT NULL
           AND
           (
               ISNULL(@ParentOldPercentCompleted, -1) <> @ParentNewPercentCompleted
               OR ISNULL(@ParentOldStatus, N'') <> ISNULL(@ParentNewStatus, N'')
           )
        BEGIN
            UPDATE [pmt].[WorkTasks]
            SET
                [Status] = @ParentNewStatus,
                [PercentCompleted] = @ParentNewPercentCompleted,
                [StartedAt] = CASE
                    WHEN [StartedAt] IS NULL AND @ParentNewStatus NOT IN (N'Backlog', N'Todo') THEN @Now
                    ELSE [StartedAt]
                END,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = @Now
            WHERE [TaskId] = @ParentTaskId;

            SET @AuditDetails =
                N'Parent status/percent recalculated from sub-tasks: ' +
                ISNULL(@ParentOldStatus, N'') + N' -> ' + ISNULL(@ParentNewStatus, N'') +
                N'; Percent: ' +
                CONVERT(NVARCHAR(12), ISNULL(@ParentOldPercentCompleted, 0)) +
                N'% -> ' + CONVERT(NVARCHAR(12), @ParentNewPercentCompleted) + N'%';

            EXEC [pmt].[WriteAudit]
                N'Task',
                @ParentTaskId,
                N'Status/Percent Changed',
                @AuditDetails,
                @CurrentUserId,
                @ParentOldStatus,
                @ParentNewStatus,
                @ParentOldPercentCompleted,
                @ParentNewPercentCompleted;
        END;
    END;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[ReorderTasks]
    @TaskIdsCsv NVARCHAR(MAX),
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM [pmt].[Users] WHERE [UserId] = @CurrentUserId AND [IsActive] = 1)
    BEGIN
        THROW 50043, 'Only active users can reorder tasks.', 1;
    END;

    DECLARE @TaskIds TABLE
    (
        [TaskId] INT NOT NULL PRIMARY KEY,
        [NewSortOrder] INT NOT NULL
    );

    DECLARE @Remaining NVARCHAR(MAX) = ISNULL(@TaskIdsCsv, N'') + N',';
    DECLARE @CommaIndex INT;
    DECLARE @TaskIdText NVARCHAR(20);
    DECLARE @TaskIdFromCsv INT;
    DECLARE @NextSortOrder INT = 10;

    -- Keep the manual order exactly as the browser sent it.
    WHILE LEN(@Remaining) > 0
    BEGIN
        SET @CommaIndex = CHARINDEX(N',', @Remaining);
        SET @TaskIdText = LTRIM(RTRIM(LEFT(@Remaining, @CommaIndex - 1)));
        SET @TaskIdFromCsv = TRY_CONVERT(INT, @TaskIdText);

        IF @TaskIdFromCsv IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM @TaskIds WHERE [TaskId] = @TaskIdFromCsv)
        BEGIN
            INSERT INTO @TaskIds ([TaskId], [NewSortOrder])
            VALUES (@TaskIdFromCsv, @NextSortOrder);

            SET @NextSortOrder += 10;
        END;

        SET @Remaining = SUBSTRING(@Remaining, @CommaIndex + 1, LEN(@Remaining));
    END;

    UPDATE [Task]
    SET
        [SortOrder] = [Ids].[NewSortOrder],
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    FROM [pmt].[WorkTasks] AS [Task]
    INNER JOIN @TaskIds AS [Ids]
        ON [Ids].[TaskId] = [Task].[TaskId]
    WHERE [Task].[IsDeleted] = 0;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[DuplicateTask]
    @TaskId INT,
    @CurrentUserId INT,
    @NewTaskId INT OUTPUT,
    @AllowBacklogAccess BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ProjectId INT;
    DECLARE @ProjectCode NVARCHAR(20);
    DECLARE @NextNumber INT;
    DECLARE @NewCode NVARCHAR(40);
    DECLARE @TaskType NVARCHAR(20);
    DECLARE @Status NVARCHAR(40);
    DECLARE @CodeSuffix NVARCHAR(20);
    DECLARE @NextSortOrder INT;

    SELECT
        @ProjectId = [pmt].[WorkTasks].[ProjectId],
        @ProjectCode = [pmt].[Projects].[Code],
        @TaskType = [pmt].[WorkTasks].[TaskType],
        @Status = [pmt].[WorkTasks].[Status]
    FROM [pmt].[WorkTasks]
    INNER JOIN [pmt].[Projects]
        ON [pmt].[Projects].[ProjectId] = [pmt].[WorkTasks].[ProjectId]
    WHERE [pmt].[WorkTasks].[TaskId] = @TaskId
      AND [pmt].[WorkTasks].[IsDeleted] = 0;

    IF @ProjectId IS NULL
    BEGIN
        THROW 50040, 'Task was not found.', 1;
    END;

    IF [pmt].[CanEditTaskType](@TaskType, @CurrentUserId) = 0
       AND NOT (@AllowBacklogAccess = 1 AND @Status IN (N'Backlog', N'Todo'))
    BEGIN
        THROW 50040, 'You cannot duplicate this kind of task.', 1;
    END;

    SELECT @NextNumber = COUNT(*) + 1
    FROM [pmt].[WorkTasks]
    WHERE [ProjectId] = @ProjectId
      AND [TaskType] = @TaskType;

    SET @CodeSuffix = CASE WHEN @TaskType = N'Bug' THEN N'-Bug' ELSE N'-Task' END;
    SET @NewCode = @ProjectCode + @CodeSuffix + CONVERT(NVARCHAR(12), @NextNumber);

    WHILE EXISTS (SELECT 1 FROM [pmt].[WorkTasks] WHERE [Code] = @NewCode)
    BEGIN
        SET @NextNumber = @NextNumber + 1;
        SET @NewCode = @ProjectCode + @CodeSuffix + CONVERT(NVARCHAR(12), @NextNumber);
    END;

    SELECT @NextSortOrder = ISNULL(MAX([SortOrder]), 0) + 10
    FROM [pmt].[WorkTasks]
    WHERE [ProjectId] = @ProjectId
      AND [IsDeleted] = 0;

    INSERT INTO [pmt].[WorkTasks]
    (
        [ProjectId],
        [SprintId],
        [ParentTaskId],
        [TaskType],
        [Code],
        [Title],
        [DescriptionHtml],
        [StepsToReproduceHtml],
        [ActualResultHtml],
        [ExpectedResultHtml],
        [RootCauseAnalysisHtml],
        [Environment],
        [Severity],
        [Status],
        [Priority],
        [SortOrder],
        [PercentCompleted],
        [Url],
        [StartDate],
        [EndDate],
        [CreatedByUserId]
    )
    SELECT
        [ProjectId],
        [SprintId],
        [ParentTaskId],
        [TaskType],
        @NewCode,
        N'Copy of ' + [Title],
        [DescriptionHtml],
        [StepsToReproduceHtml],
        [ActualResultHtml],
        [ExpectedResultHtml],
        [RootCauseAnalysisHtml],
        [Environment],
        [Severity],
        N'Todo',
        [Priority],
        @NextSortOrder,
        0,
        [Url],
        [StartDate],
        [EndDate],
        @CurrentUserId
    FROM [pmt].[WorkTasks]
    WHERE [TaskId] = @TaskId;

    SET @NewTaskId = SCOPE_IDENTITY();

    INSERT INTO [pmt].[TaskAssignees] ([TaskId], [UserId], [CreatedByUserId])
    SELECT @NewTaskId, [UserId], @CurrentUserId
    FROM [pmt].[TaskAssignees]
    WHERE [TaskId] = @TaskId;

    INSERT INTO [pmt].[TaskReporters] ([TaskId], [UserId], [CreatedByUserId])
    SELECT @NewTaskId, [UserId], @CurrentUserId
    FROM [pmt].[TaskReporters]
    WHERE [TaskId] = @TaskId;

    INSERT INTO [pmt].[TaskDependencies] ([TaskId], [DependsOnTaskId], [CreatedByUserId])
    SELECT @NewTaskId, [DependsOnTaskId], @CurrentUserId
    FROM [pmt].[TaskDependencies]
    WHERE [TaskId] = @TaskId;

    INSERT INTO [pmt].[TaskAttachments] ([TaskId], [AttachmentId], [CreatedByUserId])
    SELECT @NewTaskId, [AttachmentId], @CurrentUserId
    FROM [pmt].[TaskAttachments]
    WHERE [TaskId] = @TaskId;

    EXEC [pmt].[WriteAudit] N'Task', @NewTaskId, N'Duplicated', N'Created from an existing task.', @CurrentUserId;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[DeleteTask]
    @TaskId INT,
    @CurrentUserId INT,
    @AllowBacklogAccess BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @TaskType NVARCHAR(20);
    DECLARE @Status NVARCHAR(40);

    SELECT
        @TaskType = [TaskType],
        @Status = [Status]
    FROM [pmt].[WorkTasks]
    WHERE [TaskId] = @TaskId
      AND [IsDeleted] = 0;

    IF @TaskType IS NULL
    BEGIN
        THROW 50041, 'Task was not found.', 1;
    END;

    IF [pmt].[CanEditTaskType](@TaskType, @CurrentUserId) = 0
       AND NOT (@AllowBacklogAccess = 1 AND @Status IN (N'Backlog', N'Todo'))
    BEGIN
        THROW 50042, 'You cannot delete this task.', 1;
    END;

    UPDATE [pmt].[WorkTasks]
    SET [IsDeleted] = 1,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [TaskId] = @TaskId
       OR [ParentTaskId] = @TaskId;

    EXEC [pmt].[WriteAudit] N'Task', @TaskId, N'Deleted', N'Task hidden from active views.', @CurrentUserId;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[UpsertUser]
    @UserId INT OUTPUT,
    @FirstName NVARCHAR(80),
    @LastName NVARCHAR(80),
    @Nickname NVARCHAR(80),
    @Email NVARCHAR(180),
    @Phone NVARCHAR(60),
    @AvatarUrl NVARCHAR(500),
    @HomePageUrl NVARCHAR(500),
    @SocialMediaUrl NVARCHAR(500),
    @Bio NVARCHAR(MAX),
    @IsAdmin BIT,
    @Role NVARCHAR(20),
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @ExistingUserCount INT;
    DECLARE @CurrentUserIsAdmin BIT = [pmt].[IsAdmin](@CurrentUserId);

    SET @FirstName = ISNULL(NULLIF(LTRIM(RTRIM(@FirstName)), N''), N'New');
    SET @LastName = ISNULL(NULLIF(LTRIM(RTRIM(@LastName)), N''), N'User');
    SET @Nickname = NULLIF(LTRIM(RTRIM(@Nickname)), N'');
    SET @Role = ISNULL(NULLIF(LTRIM(RTRIM(@Role)), N''), N'Developer');

    IF @Nickname IS NULL
    BEGIN
        THROW 50054, 'Username is required.', 1;
    END;

    IF LEN(@Nickname) > 80
    BEGIN
        THROW 50054, 'Username cannot exceed 80 characters.', 1;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM [pmt].[Users]
        WHERE [IsActive] = 1
          AND [UserId] <> @UserId
          AND
          (
              LOWER(LTRIM(RTRIM([Nickname]))) = LOWER(@Nickname)
              OR LOWER(LTRIM(RTRIM(ISNULL([Email], N'')))) = LOWER(@Nickname)
          )
    )
    BEGIN
        THROW 50055, 'That username is already in use. Choose another username.', 1;
    END;

    IF @Role = N'Admin'
       OR NOT EXISTS
       (
           SELECT 1
           FROM [pmt].[Lookups]
           WHERE [LookupType] = N'Role'
             AND [Code] = @Role
             AND
             (
                 [IsActive] = 1
                 OR EXISTS
                 (
                     SELECT 1
                     FROM [pmt].[Users]
                     WHERE [UserId] = @UserId
                       AND [Role] = @Role
                 )
             )
       )
    BEGIN
        SET @Role = N'Developer';
    END;

    SELECT @ExistingUserCount = COUNT(*)
    FROM [pmt].[Users]
    WHERE [IsActive] = 1;

    IF @UserId = 0
    BEGIN
        IF @ExistingUserCount > 0 AND @CurrentUserIsAdmin = 0
        BEGIN
            THROW 50050, 'Only administrators can create users.', 1;
        END;

        INSERT INTO [pmt].[Users]
        (
            [FirstName],
            [LastName],
            [Nickname],
            [Email],
            [Phone],
            [AvatarUrl],
            [HomePageUrl],
            [SocialMediaUrl],
            [Bio],
            [IsAdmin],
            [Role],
            [CreatedByUserId],
            [CreatedAt],
            [UpdatedAt]
        )
        VALUES
        (
            @FirstName,
            @LastName,
            @Nickname,
            @Email,
            @Phone,
            @AvatarUrl,
            @HomePageUrl,
            @SocialMediaUrl,
            @Bio,
            @IsAdmin,
            @Role,
            @CurrentUserId,
            @Now,
            @Now
        );

        SET @UserId = SCOPE_IDENTITY();
        EXEC [pmt].[WriteAudit] N'User', @UserId, N'Created', @Nickname, @CurrentUserId;
    END
    ELSE
    BEGIN
        IF @CurrentUserIsAdmin = 0 AND @CurrentUserId <> @UserId
        BEGIN
            THROW 50051, 'You cannot edit this user.', 1;
        END;

        IF @CurrentUserIsAdmin = 0
        BEGIN
            SELECT @IsAdmin = [IsAdmin]
            FROM [pmt].[Users]
            WHERE [UserId] = @UserId;

            SELECT @Role = [Role]
            FROM [pmt].[Users]
            WHERE [UserId] = @UserId;
        END;

        UPDATE [pmt].[Users]
        SET
            [FirstName] = @FirstName,
            [LastName] = @LastName,
            [Nickname] = @Nickname,
            [Email] = @Email,
            [Phone] = @Phone,
            [AvatarUrl] = @AvatarUrl,
            [HomePageUrl] = @HomePageUrl,
            [SocialMediaUrl] = @SocialMediaUrl,
            [Bio] = @Bio,
            [IsAdmin] = @IsAdmin,
            [Role] = @Role,
            [UpdatedByUserId] = @CurrentUserId,
            [UpdatedAt] = @Now
        WHERE [UserId] = @UserId
          AND [IsActive] = 1;

        IF @@ROWCOUNT = 0
        BEGIN
            THROW 50052, 'User was not found.', 1;
        END;

        EXEC [pmt].[WriteAudit] N'User', @UserId, N'Updated', @Nickname, @CurrentUserId;
    END;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[DeleteUser]
    @UserId INT,
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 50053, 'Only administrators can delete users.', 1;
    END;

    UPDATE [pmt].[Users]
    SET [IsActive] = 0,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [UserId] = @UserId;

    EXEC [pmt].[WriteAudit] N'User', @UserId, N'Deleted', N'User deactivated.', @CurrentUserId;
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

CREATE OR ALTER PROCEDURE [pmt].[UpdateWfhSchedule]
    @UserId INT,
    @CanWorkMonday BIT,
    @CanWorkTuesday BIT,
    @CanWorkWednesday BIT,
    @CanWorkThursday BIT,
    @CanWorkFriday BIT,
    @IsHidden BIT,
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM [pmt].[Users] WHERE [UserId] = @CurrentUserId AND [IsActive] = 1)
    BEGIN
        THROW 50061, 'Only active users can update the WFH schedule.', 1;
    END;

    IF NOT EXISTS (SELECT 1 FROM [pmt].[Users] WHERE [UserId] = @UserId AND [IsActive] = 1)
    BEGIN
        THROW 50062, 'User was not found for the WFH schedule.', 1;
    END;

    DECLARE @IsAdmin BIT = [pmt].[IsAdmin](@CurrentUserId);

    IF @IsAdmin = 0 AND @UserId <> @CurrentUserId
    BEGIN
        THROW 50065, 'You cannot update another user''s WFH schedule.', 1;
    END;

    IF NOT EXISTS (SELECT 1 FROM [pmt].[WfhSchedules] WHERE [UserId] = @UserId)
    BEGIN
        INSERT INTO [pmt].[WfhSchedules] ([UserId], [SortOrder], [CreatedByUserId], [CreatedAt], [UpdatedAt])
        VALUES
        (
            @UserId,
            ISNULL((SELECT MAX([SortOrder]) FROM [pmt].[WfhSchedules]), 0) + 10,
            @CurrentUserId,
            SYSUTCDATETIME(),
            SYSUTCDATETIME()
        );
    END;

    UPDATE [pmt].[WfhSchedules]
    SET
        [CanWorkMonday] = @CanWorkMonday,
        [CanWorkTuesday] = @CanWorkTuesday,
        [CanWorkWednesday] = @CanWorkWednesday,
        [CanWorkThursday] = @CanWorkThursday,
        [CanWorkFriday] = @CanWorkFriday,
        [IsHidden] = CASE WHEN @IsAdmin = 1 THEN @IsHidden ELSE [IsHidden] END,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [UserId] = @UserId;

    DECLARE @AuditAction NVARCHAR(40) = CASE WHEN @IsAdmin = 1 AND @IsHidden = 1 THEN N'Hidden' ELSE N'Updated' END;

    EXEC [pmt].[WriteAudit]
        N'WFH',
        @UserId,
        @AuditAction,
        N'WFH schedule updated.',
        @CurrentUserId;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[ReorderWfhSchedule]
    @UserIdsCsv NVARCHAR(MAX),
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM [pmt].[Users] WHERE [UserId] = @CurrentUserId AND [IsActive] = 1)
    BEGIN
        THROW 50063, 'Only active users can reorder the WFH schedule.', 1;
    END;

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 50066, 'Only administrators can reorder the WFH schedule.', 1;
    END;

    DECLARE @UserIds TABLE
    (
        [UserId] INT NOT NULL PRIMARY KEY,
        [NewSortOrder] INT NOT NULL
    );

    DECLARE @Remaining NVARCHAR(MAX) = ISNULL(@UserIdsCsv, N'') + N',';
    DECLARE @CommaIndex INT;
    DECLARE @UserIdText NVARCHAR(20);
    DECLARE @UserIdFromCsv INT;
    DECLARE @NextSortOrder INT = 10;

    -- Keep the manual order exactly as the browser sent it.
    WHILE LEN(@Remaining) > 0
    BEGIN
        SET @CommaIndex = CHARINDEX(N',', @Remaining);
        SET @UserIdText = LTRIM(RTRIM(LEFT(@Remaining, @CommaIndex - 1)));
        SET @UserIdFromCsv = TRY_CONVERT(INT, @UserIdText);

        IF @UserIdFromCsv IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM @UserIds WHERE [UserId] = @UserIdFromCsv)
        BEGIN
            INSERT INTO @UserIds ([UserId], [NewSortOrder])
            VALUES (@UserIdFromCsv, @NextSortOrder);

            SET @NextSortOrder += 10;
        END;

        SET @Remaining = SUBSTRING(@Remaining, @CommaIndex + 1, LEN(@Remaining));
    END;

    UPDATE [Schedule]
    SET
        [SortOrder] = [Ids].[NewSortOrder],
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    FROM [pmt].[WfhSchedules] AS [Schedule]
    INNER JOIN @UserIds AS [Ids]
        ON [Ids].[UserId] = [Schedule].[UserId]
    INNER JOIN [pmt].[Users]
        ON [Users].[UserId] = [Schedule].[UserId]
    WHERE [Users].[IsActive] = 1;

    EXEC [pmt].[WriteAudit] N'WFH', 0, N'Reordered', N'WFH schedule order changed.', @CurrentUserId;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[ResetWfhSchedule]
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM [pmt].[Users] WHERE [UserId] = @CurrentUserId AND [IsActive] = 1)
    BEGIN
        THROW 50064, 'Only active users can reset the WFH schedule.', 1;
    END;

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 50067, 'Only administrators can reset the WFH schedule.', 1;
    END;

    ;WITH OrderedActiveUsers AS
    (
        SELECT
            [Users].[UserId],
            [NewSortOrder] = ROW_NUMBER() OVER (ORDER BY [Users].[Nickname], [Users].[FirstName], [Users].[UserId]) * 10
        FROM [pmt].[Users]
        WHERE [Users].[IsActive] = 1
    )
    INSERT INTO [pmt].[WfhSchedules] ([UserId], [SortOrder], [CreatedByUserId], [CreatedAt], [UpdatedAt])
    SELECT [UserId], [NewSortOrder], @CurrentUserId, SYSUTCDATETIME(), SYSUTCDATETIME()
    FROM OrderedActiveUsers
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM [pmt].[WfhSchedules]
        WHERE [WfhSchedules].[UserId] = [OrderedActiveUsers].[UserId]
    );

    ;WITH OrderedActiveUsers AS
    (
        SELECT
            [Users].[UserId],
            [NewSortOrder] = ROW_NUMBER() OVER (ORDER BY [Users].[Nickname], [Users].[FirstName], [Users].[UserId]) * 10
        FROM [pmt].[Users]
        WHERE [Users].[IsActive] = 1
    )
    UPDATE [Schedule]
    SET
        [CanWorkMonday] = 0,
        [CanWorkTuesday] = 0,
        [CanWorkWednesday] = 0,
        [CanWorkThursday] = 0,
        [CanWorkFriday] = 0,
        [IsHidden] = 0,
        [SortOrder] = [OrderedActiveUsers].[NewSortOrder],
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    FROM [pmt].[WfhSchedules] AS [Schedule]
    INNER JOIN OrderedActiveUsers
        ON [OrderedActiveUsers].[UserId] = [Schedule].[UserId];

    EXEC [pmt].[WriteAudit] N'WFH', 0, N'Reset', N'WFH schedule reset to nickname order.', @CurrentUserId;
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
                [UserId],
                [StartDate],
                [EndDate],
                [CreatedByUserId],
                [CreatedAt],
                [UpdatedAt]
            )
            VALUES
            (
                @CurrentUserId,
                @StartDate,
                @EndDate,
                @CurrentUserId,
                @Now,
                @Now
            );

            SET @VacationPlanId = SCOPE_IDENTITY();
            SET @AuditAction = N'Created';
            SET @AuditDetails = N'Vacation planned from ' + CONVERT(NVARCHAR(10), @StartDate, 23)
                + N' through ' + CONVERT(NVARCHAR(10), @EndDate, 23) + N'.';
        END
        ELSE
        BEGIN
            UPDATE [pmt].[VacationPlans]
            SET
                [StartDate] = @StartDate,
                [EndDate] = @EndDate,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = @Now
            WHERE [VacationPlanId] = @VacationPlanId;

            SET @AuditAction = N'Updated';
            SET @AuditDetails = N'Vacation changed to ' + CONVERT(NVARCHAR(10), @StartDate, 23)
                + N' through ' + CONVERT(NVARCHAR(10), @EndDate, 23) + N'.';
        END;

        EXEC [pmt].[WriteAudit]
            N'Vacation',
            @VacationPlanId,
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
        SET
            [IsCancelled] = 1,
            [UpdatedByUserId] = @CurrentUserId,
            [UpdatedAt] = SYSUTCDATETIME()
        WHERE [VacationPlanId] = @VacationPlanId;

        EXEC [pmt].[WriteAudit]
            N'Vacation',
            @VacationPlanId,
            N'Cancelled',
            N'Vacation plan cancelled.',
            @CurrentUserId;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[UpsertLookup]
    @LookupId INT OUTPUT,
    @LookupType NVARCHAR(60),
    @Value NVARCHAR(120),
    @ColorHex NVARCHAR(20),
    @DisplayOrder INT,
    @IsActive BIT,
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ExistingLookupType NVARCHAR(60);
    DECLARE @Code NVARCHAR(20);

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 50054, 'Only administrators can maintain dropdown values.', 1;
    END;

    SET @LookupType = NULLIF(LTRIM(RTRIM(@LookupType)), N'');
    SET @Value = NULLIF(LTRIM(RTRIM(@Value)), N'');
    SET @ColorHex = NULLIF(LTRIM(RTRIM(@ColorHex)), N'');

    IF @LookupType IS NULL OR @Value IS NULL
    BEGIN
        THROW 50055, 'Lookup type and value are required.', 1;
    END;

    IF @LookupId <> 0
    BEGIN
        SELECT @ExistingLookupType = [LookupType]
        FROM [pmt].[Lookups]
        WHERE [LookupId] = @LookupId;

        IF @ExistingLookupType IS NULL
        BEGIN
            THROW 50056, 'Lookup value was not found.', 1;
        END;

        IF @ExistingLookupType <> @LookupType
           AND (@ExistingLookupType = N'Role' OR @LookupType = N'Role')
        BEGIN
            THROW 50070, 'A Role cannot be changed into another setting type.', 1;
        END;
    END;

    IF @LookupId = 0
    BEGIN
        IF @LookupType = N'Role'
        BEGIN
            SET @Code = N'R' + LEFT(REPLACE(CONVERT(NVARCHAR(36), NEWID()), N'-', N''), 19);
        END;

        INSERT INTO [pmt].[Lookups] ([LookupType], [Value], [Code], [ColorHex], [DisplayOrder], [IsActive], [CreatedByUserId])
        VALUES (@LookupType, @Value, @Code, @ColorHex, @DisplayOrder, @IsActive, @CurrentUserId);

        SET @LookupId = SCOPE_IDENTITY();

        IF @LookupType = N'Role'
        BEGIN
            INSERT INTO [pmt].[RolePermissions]
            (
                [RoleCode], [ResourceKey], [CanRead], [CanCreate], [CanUpdate],
                [CanDelete], [CanImport], [CanExport], [NoAccess]
            )
            SELECT
                @Code,
                [Resource].[ResourceKey],
                1,
                CONVERT(BIT, CASE WHEN [Resource].[ResourceKey] IN (N'Scrum', N'Documentation', N'PersonalLog') THEN 1 ELSE 0 END),
                CONVERT(BIT, CASE WHEN [Resource].[ResourceKey] IN (N'Board', N'Scrum', N'Documentation', N'PersonalLog', N'WfhSchedule', N'Settings') THEN 1 ELSE 0 END),
                CONVERT(BIT, CASE WHEN [Resource].[ResourceKey] = N'PersonalLog' THEN 1 ELSE 0 END),
                CONVERT(BIT, CASE WHEN [Resource].[ResourceKey] IN (N'Scrum', N'Documentation', N'PersonalLog') THEN 1 ELSE 0 END),
                CONVERT(BIT, CASE WHEN [Resource].[ResourceKey] IN (N'Board', N'Scrum', N'Documentation', N'PersonalLog', N'WfhSchedule') THEN 1 ELSE 0 END),
                0
            FROM [pmt].[SecurityResources] AS [Resource];
        END;

        EXEC [pmt].[WriteAudit] N'Lookup', @LookupId, N'Created', @LookupType, @CurrentUserId;
    END
    ELSE
    BEGIN
        UPDATE [pmt].[Lookups]
        SET [LookupType] = @LookupType,
            [Value] = @Value,
            [Code] = CASE
                WHEN @LookupType = N'Role' AND [Code] IS NULL
                    THEN N'R' + LEFT(REPLACE(CONVERT(NVARCHAR(36), NEWID()), N'-', N''), 19)
                ELSE [Code]
            END,
            [ColorHex] = @ColorHex,
            [DisplayOrder] = @DisplayOrder,
            [IsActive] = @IsActive,
            [UpdatedByUserId] = @CurrentUserId,
            [UpdatedAt] = SYSUTCDATETIME()
        WHERE [LookupId] = @LookupId;

        IF @@ROWCOUNT = 0
        BEGIN
            THROW 50056, 'Lookup value was not found.', 1;
        END;

        EXEC [pmt].[WriteAudit] N'Lookup', @LookupId, N'Updated', @LookupType, @CurrentUserId;
    END;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[DeleteLookup]
    @LookupId INT,
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @LookupType NVARCHAR(60);
    DECLARE @Value NVARCHAR(120);
    DECLARE @Code NVARCHAR(20);

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 50057, 'Only administrators can maintain dropdown values.', 1;
    END;

    SELECT
        @LookupType = [LookupType],
        @Value = [Value],
        @Code = [Code]
    FROM [pmt].[Lookups]
    WHERE [LookupId] = @LookupId;

    IF @LookupType IS NULL
    BEGIN
        THROW 50056, 'Lookup value was not found.', 1;
    END;

    IF @LookupType = N'Role'
    BEGIN
        IF EXISTS
        (
            SELECT 1
            FROM [pmt].[Users]
            WHERE [Role] = @Code
        )
        BEGIN
            THROW 50071, 'This Role cannot be deleted because it is assigned to a user.', 1;
        END;

        DELETE FROM [pmt].[RolePermissions]
        WHERE [RoleCode] = @Code;

        DELETE FROM [pmt].[Lookups]
        WHERE [LookupId] = @LookupId;

        EXEC [pmt].[WriteAudit] N'Lookup', @LookupId, N'Deleted', @Value, @CurrentUserId;
        RETURN;
    END;

    -- Keep old task values readable by marking the lookup inactive instead of deleting the row.
    UPDATE [pmt].[Lookups]
    SET [IsActive] = 0,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [LookupId] = @LookupId;

    EXEC [pmt].[WriteAudit] N'Lookup', @LookupId, N'Deactivated', N'Lookup value set inactive.', @CurrentUserId;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[UpsertHoliday]
    @HolidayId INT OUTPUT,
    @Name NVARCHAR(160),
    @HolidayDate DATE,
    @CountryCode NVARCHAR(10),
    @IsActive BIT,
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 50058, 'Only administrators can maintain holidays.', 1;
    END;

    SET @Name = NULLIF(LTRIM(RTRIM(@Name)), N'');
    SET @CountryCode = UPPER(ISNULL(NULLIF(LTRIM(RTRIM(@CountryCode)), N''), N'PH'));

    IF @Name IS NULL OR @HolidayDate IS NULL
    BEGIN
        THROW 50059, 'Holiday name and date are required.', 1;
    END;

    IF @HolidayId = 0
    BEGIN
        INSERT INTO [pmt].[Holidays]
        (
            [Name],
            [HolidayDate],
            [CountryCode],
            [IsActive],
            [CreatedByUserId],
            [CreatedAt],
            [UpdatedAt]
        )
        VALUES
        (
            @Name,
            @HolidayDate,
            @CountryCode,
            @IsActive,
            @CurrentUserId,
            @Now,
            @Now
        );

        SET @HolidayId = SCOPE_IDENTITY();
        EXEC [pmt].[WriteAudit] N'Holiday', @HolidayId, N'Created', @Name, @CurrentUserId;
    END
    ELSE
    BEGIN
        UPDATE [pmt].[Holidays]
        SET
            [Name] = @Name,
            [HolidayDate] = @HolidayDate,
            [CountryCode] = @CountryCode,
            [IsActive] = @IsActive,
            [UpdatedByUserId] = @CurrentUserId,
            [UpdatedAt] = @Now
        WHERE [HolidayId] = @HolidayId;

        IF @@ROWCOUNT = 0
        BEGIN
            THROW 50059, 'Holiday was not found.', 1;
        END;

        EXEC [pmt].[WriteAudit] N'Holiday', @HolidayId, N'Updated', @Name, @CurrentUserId;
    END;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[DeleteHoliday]
    @HolidayId INT,
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 50058, 'Only administrators can maintain holidays.', 1;
    END;

    UPDATE [pmt].[Holidays]
    SET
        [IsActive] = 0,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [HolidayId] = @HolidayId;

    EXEC [pmt].[WriteAudit] N'Holiday', @HolidayId, N'Deactivated', N'Holiday set inactive.', @CurrentUserId;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[GetMaintenanceRecycleBin]
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 50250, 'Only an administrator can use PMT Maintenance.', 1;
    END;

    SELECT
        [RecycleItem].[ItemType],
        [RecycleItem].[ItemId],
        [RecycleItem].[Label],
        [RecycleItem].[Details],
        [RecycleItem].[DeletedAt],
        [RecycleItem].[IsCascade]
    FROM
    (
        SELECT
            N'Project' AS [ItemType],
            [Project].[ProjectId] AS [ItemId],
            CONVERT(NVARCHAR(300), [Project].[Code] + N' - ' + [Project].[Title]) AS [Label],
            CONVERT(NVARCHAR(500), N'Archived Project') AS [Details],
            [Project].[UpdatedAt] AS [DeletedAt],
            CONVERT(BIT, 0) AS [IsCascade]
        FROM [pmt].[Projects] AS [Project]
        WHERE [Project].[IsArchived] = 1

        UNION ALL

        SELECT
            N'Sprint',
            [Sprint].[SprintId],
            CONVERT(NVARCHAR(300), [Sprint].[Code] + N' - ' + [Sprint].[Title]),
            CONVERT(NVARCHAR(500), N'Sprint in Project ' + [Project].[Code]),
            [Sprint].[UpdatedAt],
            CONVERT(BIT, 0)
        FROM [pmt].[Sprints] AS [Sprint]
        INNER JOIN [pmt].[Projects] AS [Project]
            ON [Project].[ProjectId] = [Sprint].[ProjectId]
        WHERE [Sprint].[IsDeleted] = 1

        UNION ALL

        SELECT
            N'Task',
            [Task].[TaskId],
            CONVERT(NVARCHAR(300), [Task].[Code] + N' - ' + [Task].[Title]),
            CONVERT(NVARCHAR(500), [Task].[TaskType] + N' in Project ' + [Project].[Code]),
            [Task].[UpdatedAt],
            CONVERT(BIT, 0)
        FROM [pmt].[WorkTasks] AS [Task]
        INNER JOIN [pmt].[Projects] AS [Project]
            ON [Project].[ProjectId] = [Task].[ProjectId]
        WHERE [Task].[IsDeleted] = 1

        UNION ALL

        SELECT
            N'Blog',
            [Blog].[BlogId],
            CONVERT(
                NVARCHAR(300),
                CASE
                    WHEN [Blog].[IsPrivate] = 1
                        THEN N'Private Documentation #' + CONVERT(NVARCHAR(20), [Blog].[BlogId])
                    ELSE [Blog].[Title]
                END
            ),
            CONVERT(
                NVARCHAR(500),
                CASE
                    WHEN [Blog].[IsPrivate] = 1 THEN N'Private Documentation details are hidden.'
                    WHEN [Project].[ProjectId] IS NULL THEN N'Documentation without a Project'
                    ELSE N'Documentation in Project ' + [Project].[Code]
                END
            ),
            [Blog].[UpdatedAt],
            CONVERT(BIT, 0)
        FROM [pmt].[Blogs] AS [Blog]
        LEFT JOIN [pmt].[Projects] AS [Project]
            ON [Project].[ProjectId] = [Blog].[ProjectId]
        WHERE [Blog].[IsDeleted] = 1
          AND ([Blog].[IsPrivate] = 0 OR [Blog].[CreatedByUserId] = @CurrentUserId)

        UNION ALL

        SELECT
            N'DevLog',
            [DevLog].[DevLogId],
            CONVERT(
                NVARCHAR(300),
                CASE
                    WHEN [DevLog].[LogType] = N'Log'
                        THEN N'Private Log #' + CONVERT(NVARCHAR(20), [DevLog].[DevLogId])
                    ELSE N'Scrum #' + CONVERT(NVARCHAR(20), [DevLog].[DevLogId])
                END
            ),
            CONVERT(
                NVARCHAR(500),
                CASE
                    WHEN [DevLog].[LogType] = N'Log'
                        THEN N'Private Log details are hidden.'
                    WHEN [Project].[ProjectId] IS NULL
                        THEN N'Scrum entry without a Project'
                    ELSE N'Scrum entry in Project ' + [Project].[Code]
                END
            ),
            [DevLog].[UpdatedAt],
            CONVERT(BIT, 0)
        FROM [pmt].[DevLogs] AS [DevLog]
        LEFT JOIN [pmt].[Projects] AS [Project]
            ON [Project].[ProjectId] = [DevLog].[ProjectId]
        WHERE [DevLog].[IsDeleted] = 1
          AND ([DevLog].[LogType] <> N'Log' OR [DevLog].[UserId] = @CurrentUserId)
    ) AS [RecycleItem]
    ORDER BY [RecycleItem].[DeletedAt] DESC, [RecycleItem].[ItemType], [RecycleItem].[Label];
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[ProcessMaintenanceRecycleBin]
    @ItemsJson NVARCHAR(MAX),
    @CurrentUserId INT,
    @Purge BIT,
    @ExpectedItemsJson NVARCHAR(MAX) = N'[]'
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 50250, 'Only an administrator can use PMT Maintenance.', 1;
    END;

    SET @ItemsJson = LTRIM(RTRIM(ISNULL(@ItemsJson, N'')));
    SET @Purge = ISNULL(@Purge, 0);

    IF ISJSON(@ItemsJson) <> 1 OR LEFT(@ItemsJson, 1) <> N'['
    BEGIN
        THROW 50251, 'The recycle-bin selection is invalid.', 1;
    END;

    DECLARE @ParsedItems TABLE
    (
        [ItemType] NVARCHAR(20) NULL,
        [ItemId] INT NULL
    );

    INSERT INTO @ParsedItems ([ItemType], [ItemId])
    SELECT
        CASE LOWER(LTRIM(RTRIM([JsonItem].[ItemType])))
            WHEN N'project' THEN N'Project'
            WHEN N'sprint' THEN N'Sprint'
            WHEN N'task' THEN N'Task'
            WHEN N'blog' THEN N'Blog'
            WHEN N'devlog' THEN N'DevLog'
            ELSE NULL
        END,
        [JsonItem].[ItemId]
    FROM OPENJSON(@ItemsJson)
    WITH
    (
        [ItemType] NVARCHAR(20) N'$.itemType',
        [ItemId] INT N'$.itemId'
    ) AS [JsonItem];

    IF NOT EXISTS (SELECT 1 FROM @ParsedItems)
       OR EXISTS
       (
           SELECT 1
           FROM @ParsedItems
           WHERE [ItemType] IS NULL OR ISNULL([ItemId], 0) <= 0
       )
       OR EXISTS
       (
           SELECT 1
           FROM @ParsedItems
           GROUP BY [ItemType], [ItemId]
           HAVING COUNT(*) > 1
       )
    BEGIN
        THROW 50251, 'The recycle-bin selection is invalid.', 1;
    END;

    DECLARE @RequestedItems TABLE
    (
        [ItemType] NVARCHAR(20) NOT NULL,
        [ItemId] INT NOT NULL,
        PRIMARY KEY ([ItemType], [ItemId])
    );

    INSERT INTO @RequestedItems ([ItemType], [ItemId])
    SELECT [ItemType], [ItemId]
    FROM @ParsedItems;

    DECLARE @Plan TABLE
    (
        [ItemType] NVARCHAR(20) NOT NULL,
        [ItemId] INT NOT NULL,
        [Label] NVARCHAR(300) NOT NULL,
        [Details] NVARCHAR(500) NOT NULL,
        [DeletedAt] DATETIME2(0) NOT NULL,
        [IsCascade] BIT NOT NULL,
        PRIMARY KEY ([ItemType], [ItemId])
    );

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @ExpectedCount INT;
        DECLARE @FoundCount INT;

        SELECT @ExpectedCount = COUNT(*)
        FROM @RequestedItems
        WHERE [ItemType] = N'Project';

        SELECT @FoundCount = COUNT(*)
        FROM [pmt].[Projects] AS [Project] WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN @RequestedItems AS [Requested]
            ON [Requested].[ItemType] = N'Project'
           AND [Requested].[ItemId] = [Project].[ProjectId]
        WHERE [Project].[IsArchived] = 1;

        IF @FoundCount <> @ExpectedCount
        BEGIN
            THROW 50252, 'The recycle bin changed. Refresh it before continuing.', 1;
        END;

        SELECT @ExpectedCount = COUNT(*)
        FROM @RequestedItems
        WHERE [ItemType] = N'Sprint';

        SELECT @FoundCount = COUNT(*)
        FROM [pmt].[Sprints] AS [Sprint] WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN @RequestedItems AS [Requested]
            ON [Requested].[ItemType] = N'Sprint'
           AND [Requested].[ItemId] = [Sprint].[SprintId]
        WHERE [Sprint].[IsDeleted] = 1;

        IF @FoundCount <> @ExpectedCount
        BEGIN
            THROW 50252, 'The recycle bin changed. Refresh it before continuing.', 1;
        END;

        SELECT @ExpectedCount = COUNT(*)
        FROM @RequestedItems
        WHERE [ItemType] = N'Task';

        SELECT @FoundCount = COUNT(*)
        FROM [pmt].[WorkTasks] AS [Task] WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN @RequestedItems AS [Requested]
            ON [Requested].[ItemType] = N'Task'
           AND [Requested].[ItemId] = [Task].[TaskId]
        WHERE [Task].[IsDeleted] = 1;

        IF @FoundCount <> @ExpectedCount
        BEGIN
            THROW 50252, 'The recycle bin changed. Refresh it before continuing.', 1;
        END;

        SELECT @ExpectedCount = COUNT(*)
        FROM @RequestedItems
        WHERE [ItemType] = N'Blog';

        SELECT @FoundCount = COUNT(*)
        FROM [pmt].[Blogs] AS [Blog] WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN @RequestedItems AS [Requested]
            ON [Requested].[ItemType] = N'Blog'
           AND [Requested].[ItemId] = [Blog].[BlogId]
        WHERE [Blog].[IsDeleted] = 1
          AND ([Blog].[IsPrivate] = 0 OR [Blog].[CreatedByUserId] = @CurrentUserId);

        IF @FoundCount <> @ExpectedCount
        BEGIN
            THROW 50252, 'The recycle bin changed. Refresh it before continuing.', 1;
        END;

        SELECT @ExpectedCount = COUNT(*)
        FROM @RequestedItems
        WHERE [ItemType] = N'DevLog';

        SELECT @FoundCount = COUNT(*)
        FROM [pmt].[DevLogs] AS [DevLog] WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN @RequestedItems AS [Requested]
            ON [Requested].[ItemType] = N'DevLog'
           AND [Requested].[ItemId] = [DevLog].[DevLogId]
        WHERE [DevLog].[IsDeleted] = 1
          AND ([DevLog].[LogType] <> N'Log' OR [DevLog].[UserId] = @CurrentUserId);

        IF @FoundCount <> @ExpectedCount
        BEGIN
            THROW 50252, 'The recycle bin changed. Refresh it before continuing.', 1;
        END;

        INSERT INTO @Plan ([ItemType], [ItemId], [Label], [Details], [DeletedAt], [IsCascade])
        SELECT
            N'Project',
            [Project].[ProjectId],
            CONVERT(NVARCHAR(300), [Project].[Code] + N' - ' + [Project].[Title]),
            CONVERT(NVARCHAR(500), N'Archived Project'),
            [Project].[UpdatedAt],
            CONVERT(BIT, 0)
        FROM [pmt].[Projects] AS [Project] WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN @RequestedItems AS [Requested]
            ON [Requested].[ItemType] = N'Project'
           AND [Requested].[ItemId] = [Project].[ProjectId];

        INSERT INTO @Plan ([ItemType], [ItemId], [Label], [Details], [DeletedAt], [IsCascade])
        SELECT
            N'Sprint',
            [Sprint].[SprintId],
            CONVERT(NVARCHAR(300), [Sprint].[Code] + N' - ' + [Sprint].[Title]),
            CONVERT(NVARCHAR(500), N'Sprint in Project ' + [Project].[Code]),
            [Sprint].[UpdatedAt],
            CONVERT(BIT, 0)
        FROM [pmt].[Sprints] AS [Sprint] WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN @RequestedItems AS [Requested]
            ON [Requested].[ItemType] = N'Sprint'
           AND [Requested].[ItemId] = [Sprint].[SprintId]
        INNER JOIN [pmt].[Projects] AS [Project] WITH (UPDLOCK, HOLDLOCK)
            ON [Project].[ProjectId] = [Sprint].[ProjectId];

        INSERT INTO @Plan ([ItemType], [ItemId], [Label], [Details], [DeletedAt], [IsCascade])
        SELECT
            N'Task',
            [Task].[TaskId],
            CONVERT(NVARCHAR(300), [Task].[Code] + N' - ' + [Task].[Title]),
            CONVERT(NVARCHAR(500), [Task].[TaskType] + N' in Project ' + [Project].[Code]),
            [Task].[UpdatedAt],
            CONVERT(BIT, 0)
        FROM [pmt].[WorkTasks] AS [Task] WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN @RequestedItems AS [Requested]
            ON [Requested].[ItemType] = N'Task'
           AND [Requested].[ItemId] = [Task].[TaskId]
        INNER JOIN [pmt].[Projects] AS [Project] WITH (UPDLOCK, HOLDLOCK)
            ON [Project].[ProjectId] = [Task].[ProjectId];

        INSERT INTO @Plan ([ItemType], [ItemId], [Label], [Details], [DeletedAt], [IsCascade])
        SELECT
            N'Blog',
            [Blog].[BlogId],
            CONVERT(
                NVARCHAR(300),
                CASE
                    WHEN [Blog].[IsPrivate] = 1
                        THEN N'Private Documentation #' + CONVERT(NVARCHAR(20), [Blog].[BlogId])
                    ELSE [Blog].[Title]
                END
            ),
            CONVERT(
                NVARCHAR(500),
                CASE
                    WHEN [Blog].[IsPrivate] = 1 THEN N'Private Documentation details are hidden.'
                    WHEN [Project].[ProjectId] IS NULL THEN N'Documentation without a Project'
                    ELSE N'Documentation in Project ' + [Project].[Code]
                END
            ),
            [Blog].[UpdatedAt],
            CONVERT(BIT, 0)
        FROM [pmt].[Blogs] AS [Blog] WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN @RequestedItems AS [Requested]
            ON [Requested].[ItemType] = N'Blog'
           AND [Requested].[ItemId] = [Blog].[BlogId]
        LEFT JOIN [pmt].[Projects] AS [Project] WITH (UPDLOCK, HOLDLOCK)
            ON [Project].[ProjectId] = [Blog].[ProjectId]
        WHERE [Blog].[IsPrivate] = 0
           OR [Blog].[CreatedByUserId] = @CurrentUserId;

        INSERT INTO @Plan ([ItemType], [ItemId], [Label], [Details], [DeletedAt], [IsCascade])
        SELECT
            N'DevLog',
            [DevLog].[DevLogId],
            CONVERT(
                NVARCHAR(300),
                CASE
                    WHEN [DevLog].[LogType] = N'Log'
                        THEN N'Private Log #' + CONVERT(NVARCHAR(20), [DevLog].[DevLogId])
                    ELSE N'Scrum #' + CONVERT(NVARCHAR(20), [DevLog].[DevLogId])
                END
            ),
            CONVERT(
                NVARCHAR(500),
                CASE
                    WHEN [DevLog].[LogType] = N'Log'
                        THEN N'Private Log details are hidden.'
                    WHEN [Project].[ProjectId] IS NULL
                        THEN N'Scrum entry without a Project'
                    ELSE N'Scrum entry in Project ' + [Project].[Code]
                END
            ),
            [DevLog].[UpdatedAt],
            CONVERT(BIT, 0)
        FROM [pmt].[DevLogs] AS [DevLog] WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN @RequestedItems AS [Requested]
            ON [Requested].[ItemType] = N'DevLog'
           AND [Requested].[ItemId] = [DevLog].[DevLogId]
        LEFT JOIN [pmt].[Projects] AS [Project] WITH (UPDLOCK, HOLDLOCK)
            ON [Project].[ProjectId] = [DevLog].[ProjectId]
        WHERE [DevLog].[LogType] <> N'Log'
           OR [DevLog].[UserId] = @CurrentUserId;

        INSERT INTO @Plan ([ItemType], [ItemId], [Label], [Details], [DeletedAt], [IsCascade])
        SELECT
            N'Sprint',
            [Sprint].[SprintId],
            CONVERT(NVARCHAR(300), [Sprint].[Code] + N' - ' + [Sprint].[Title]),
            CONVERT(NVARCHAR(500), N'Included with archived Project ' + [Project].[Code]),
            [Project].[UpdatedAt],
            CONVERT(BIT, 1)
        FROM [pmt].[Sprints] AS [Sprint] WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN [pmt].[Projects] AS [Project] WITH (UPDLOCK, HOLDLOCK)
            ON [Project].[ProjectId] = [Sprint].[ProjectId]
        INNER JOIN @Plan AS [ProjectPlan]
            ON [ProjectPlan].[ItemType] = N'Project'
           AND [ProjectPlan].[ItemId] = [Project].[ProjectId]
        WHERE NOT EXISTS
        (
            SELECT 1
            FROM @Plan AS [Existing]
            WHERE [Existing].[ItemType] = N'Sprint'
              AND [Existing].[ItemId] = [Sprint].[SprintId]
        );

        INSERT INTO @Plan ([ItemType], [ItemId], [Label], [Details], [DeletedAt], [IsCascade])
        SELECT
            N'Task',
            [Task].[TaskId],
            CONVERT(NVARCHAR(300), [Task].[Code] + N' - ' + [Task].[Title]),
            CONVERT(NVARCHAR(500), N'Included with archived Project ' + [Project].[Code]),
            [Project].[UpdatedAt],
            CONVERT(BIT, 1)
        FROM [pmt].[WorkTasks] AS [Task] WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN [pmt].[Projects] AS [Project] WITH (UPDLOCK, HOLDLOCK)
            ON [Project].[ProjectId] = [Task].[ProjectId]
        INNER JOIN @Plan AS [ProjectPlan]
            ON [ProjectPlan].[ItemType] = N'Project'
           AND [ProjectPlan].[ItemId] = [Project].[ProjectId]
        WHERE NOT EXISTS
        (
            SELECT 1
            FROM @Plan AS [Existing]
            WHERE [Existing].[ItemType] = N'Task'
              AND [Existing].[ItemId] = [Task].[TaskId]
        );

        INSERT INTO @Plan ([ItemType], [ItemId], [Label], [Details], [DeletedAt], [IsCascade])
        SELECT
            N'Blog',
            [Blog].[BlogId],
            CONVERT(
                NVARCHAR(300),
                CASE
                    WHEN [Blog].[IsPrivate] = 1
                        THEN N'Private Documentation #' + CONVERT(NVARCHAR(20), [Blog].[BlogId])
                    ELSE [Blog].[Title]
                END
            ),
            CONVERT(
                NVARCHAR(500),
                CASE
                    WHEN [Blog].[IsPrivate] = 1 THEN N'Private Documentation details are hidden.'
                    ELSE N'Included with archived Project ' + [Project].[Code]
                END
            ),
            [Project].[UpdatedAt],
            CONVERT(BIT, 1)
        FROM [pmt].[Blogs] AS [Blog] WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN [pmt].[Projects] AS [Project] WITH (UPDLOCK, HOLDLOCK)
            ON [Project].[ProjectId] = [Blog].[ProjectId]
        INNER JOIN @Plan AS [ProjectPlan]
            ON [ProjectPlan].[ItemType] = N'Project'
           AND [ProjectPlan].[ItemId] = [Project].[ProjectId]
        WHERE [Blog].[IsPrivate] = 0
          AND NOT EXISTS
        (
            SELECT 1
            FROM @Plan AS [Existing]
            WHERE [Existing].[ItemType] = N'Blog'
              AND [Existing].[ItemId] = [Blog].[BlogId]
        );

        -- Private Logs are owner-only and survive Project cleanup. Scrum entries
        -- remain Project data and are included in an archived Project purge.
        INSERT INTO @Plan ([ItemType], [ItemId], [Label], [Details], [DeletedAt], [IsCascade])
        SELECT
            N'DevLog',
            [DevLog].[DevLogId],
            CONVERT(NVARCHAR(300), N'Scrum #' + CONVERT(NVARCHAR(20), [DevLog].[DevLogId])),
            CONVERT(NVARCHAR(500), N'Included with archived Project ' + [Project].[Code]),
            [Project].[UpdatedAt],
            CONVERT(BIT, 1)
        FROM [pmt].[DevLogs] AS [DevLog] WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN [pmt].[Projects] AS [Project] WITH (UPDLOCK, HOLDLOCK)
            ON [Project].[ProjectId] = [DevLog].[ProjectId]
        INNER JOIN @Plan AS [ProjectPlan]
            ON [ProjectPlan].[ItemType] = N'Project'
           AND [ProjectPlan].[ItemId] = [Project].[ProjectId]
        WHERE [DevLog].[LogType] = N'Scrum'
          AND NOT EXISTS
          (
              SELECT 1
              FROM @Plan AS [Existing]
              WHERE [Existing].[ItemType] = N'DevLog'
                AND [Existing].[ItemId] = [DevLog].[DevLogId]
          );

        IF @Purge = 1
        BEGIN
            SET @ExpectedItemsJson = LTRIM(RTRIM(ISNULL(@ExpectedItemsJson, N'')));

            IF ISJSON(@ExpectedItemsJson) <> 1 OR LEFT(@ExpectedItemsJson, 1) <> N'['
            BEGIN
                THROW 50252, 'The recycle bin changed. Refresh it before continuing.', 1;
            END;

            DECLARE @ExpectedItems TABLE
            (
                [ItemType] NVARCHAR(20) NULL,
                [ItemId] INT NULL
            );

            INSERT INTO @ExpectedItems ([ItemType], [ItemId])
            SELECT
                CASE LOWER(LTRIM(RTRIM([JsonItem].[ItemType])))
                    WHEN N'project' THEN N'Project'
                    WHEN N'sprint' THEN N'Sprint'
                    WHEN N'task' THEN N'Task'
                    WHEN N'blog' THEN N'Blog'
                    WHEN N'devlog' THEN N'DevLog'
                    ELSE NULL
                END,
                [JsonItem].[ItemId]
            FROM OPENJSON(@ExpectedItemsJson)
            WITH
            (
                [ItemType] NVARCHAR(20) N'$.itemType',
                [ItemId] INT N'$.itemId'
            ) AS [JsonItem];

            IF EXISTS
               (
                   SELECT 1
                   FROM @ExpectedItems
                   WHERE [ItemType] IS NULL OR ISNULL([ItemId], 0) <= 0
               )
               OR EXISTS
               (
                   SELECT 1
                   FROM @ExpectedItems
                   GROUP BY [ItemType], [ItemId]
                   HAVING COUNT(*) > 1
               )
               OR EXISTS
               (
                   SELECT [ItemType], [ItemId]
                   FROM @Plan
                   EXCEPT
                   SELECT [ItemType], [ItemId]
                   FROM @ExpectedItems
               )
               OR EXISTS
               (
                   SELECT [ItemType], [ItemId]
                   FROM @ExpectedItems
                   EXCEPT
                   SELECT [ItemType], [ItemId]
                   FROM @Plan
               )
            BEGIN
                THROW 50252, 'The recycle bin changed. Refresh it before continuing.', 1;
            END;

            DECLARE @AttachmentIds TABLE ([AttachmentId] INT NOT NULL PRIMARY KEY);
            DECLARE @InvitationIds TABLE ([UserInvitationId] INT NOT NULL PRIMARY KEY);

            INSERT INTO @AttachmentIds ([AttachmentId])
            SELECT [TaskAttachment].[AttachmentId]
            FROM [pmt].[TaskAttachments] AS [TaskAttachment]
            INNER JOIN @Plan AS [TaskPlan]
                ON [TaskPlan].[ItemType] = N'Task'
               AND [TaskPlan].[ItemId] = [TaskAttachment].[TaskId]
            UNION
            SELECT [BlogAttachment].[AttachmentId]
            FROM [pmt].[BlogAttachments] AS [BlogAttachment]
            INNER JOIN @Plan AS [BlogPlan]
                ON [BlogPlan].[ItemType] = N'Blog'
               AND [BlogPlan].[ItemId] = [BlogAttachment].[BlogId];

            INSERT INTO @InvitationIds ([UserInvitationId])
            SELECT DISTINCT [InvitationProject].[UserInvitationId]
            FROM [pmt].[UserInvitationProjects] AS [InvitationProject]
            INNER JOIN @Plan AS [ProjectPlan]
                ON [ProjectPlan].[ItemType] = N'Project'
               AND [ProjectPlan].[ItemId] = [InvitationProject].[ProjectId];

            DELETE [AuditEvent]
            FROM [pmt].[AuditEvents] AS [AuditEvent]
            INNER JOIN @Plan AS [PlannedItem]
                ON [PlannedItem].[ItemType] = [AuditEvent].[EntityType]
               AND [PlannedItem].[ItemId] = [AuditEvent].[EntityId];

            DELETE [TaskAttachment]
            FROM [pmt].[TaskAttachments] AS [TaskAttachment]
            INNER JOIN @Plan AS [TaskPlan]
                ON [TaskPlan].[ItemType] = N'Task'
               AND [TaskPlan].[ItemId] = [TaskAttachment].[TaskId];

            DELETE [Dependency]
            FROM [pmt].[TaskDependencies] AS [Dependency]
            WHERE EXISTS
            (
                SELECT 1
                FROM @Plan AS [TaskPlan]
                WHERE [TaskPlan].[ItemType] = N'Task'
                  AND ([TaskPlan].[ItemId] = [Dependency].[TaskId]
                       OR [TaskPlan].[ItemId] = [Dependency].[DependsOnTaskId])
            );

            DELETE [Reporter]
            FROM [pmt].[TaskReporters] AS [Reporter]
            INNER JOIN @Plan AS [TaskPlan]
                ON [TaskPlan].[ItemType] = N'Task'
               AND [TaskPlan].[ItemId] = [Reporter].[TaskId];

            DELETE [Assignee]
            FROM [pmt].[TaskAssignees] AS [Assignee]
            INNER JOIN @Plan AS [TaskPlan]
                ON [TaskPlan].[ItemType] = N'Task'
               AND [TaskPlan].[ItemId] = [Assignee].[TaskId];

            DELETE [BlogAttachment]
            FROM [pmt].[BlogAttachments] AS [BlogAttachment]
            INNER JOIN @Plan AS [BlogPlan]
                ON [BlogPlan].[ItemType] = N'Blog'
               AND [BlogPlan].[ItemId] = [BlogAttachment].[BlogId];

            DELETE [History]
            FROM [pmt].[BlogHistory] AS [History]
            INNER JOIN @Plan AS [BlogPlan]
                ON [BlogPlan].[ItemType] = N'Blog'
               AND [BlogPlan].[ItemId] = [History].[BlogId];

            UPDATE [Task]
            SET [ParentTaskId] = NULL,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = SYSUTCDATETIME()
            FROM [pmt].[WorkTasks] AS [Task]
            WHERE EXISTS
            (
                SELECT 1
                FROM @Plan AS [TaskPlan]
                WHERE [TaskPlan].[ItemType] = N'Task'
                  AND [TaskPlan].[ItemId] = [Task].[ParentTaskId]
            );

            UPDATE [Task]
            SET [LinkedBugTaskId] = NULL,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = SYSUTCDATETIME()
            FROM [pmt].[WorkTasks] AS [Task]
            WHERE EXISTS
            (
                SELECT 1
                FROM @Plan AS [TaskPlan]
                WHERE [TaskPlan].[ItemType] = N'Task'
                  AND [TaskPlan].[ItemId] = [Task].[LinkedBugTaskId]
            );

            UPDATE [Task]
            SET [LinkedBlogId] = NULL,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = SYSUTCDATETIME()
            FROM [pmt].[WorkTasks] AS [Task]
            WHERE EXISTS
            (
                SELECT 1
                FROM @Plan AS [BlogPlan]
                WHERE [BlogPlan].[ItemType] = N'Blog'
                  AND [BlogPlan].[ItemId] = [Task].[LinkedBlogId]
            );

            UPDATE [Blog]
            SET [ParentBlogId] = NULL,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = SYSUTCDATETIME()
            FROM [pmt].[Blogs] AS [Blog]
            WHERE EXISTS
            (
                SELECT 1
                FROM @Plan AS [BlogPlan]
                WHERE [BlogPlan].[ItemType] = N'Blog'
                  AND [BlogPlan].[ItemId] = [Blog].[ParentBlogId]
            );

            UPDATE [Task]
            SET [SprintId] = NULL,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = SYSUTCDATETIME()
            FROM [pmt].[WorkTasks] AS [Task]
            WHERE EXISTS
            (
                SELECT 1
                FROM @Plan AS [SprintPlan]
                WHERE [SprintPlan].[ItemType] = N'Sprint'
                  AND [SprintPlan].[ItemId] = [Task].[SprintId]
            );

            UPDATE [Blog]
            SET [SprintId] = NULL,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = SYSUTCDATETIME()
            FROM [pmt].[Blogs] AS [Blog]
            WHERE EXISTS
            (
                SELECT 1
                FROM @Plan AS [SprintPlan]
                WHERE [SprintPlan].[ItemType] = N'Sprint'
                  AND [SprintPlan].[ItemId] = [Blog].[SprintId]
            );

            -- Private Documentation and private Logs remain owner-only and
            -- survive Project cleanup unless their owner selected them directly.
            UPDATE [Blog]
            SET [ProjectId] = NULL,
                [SprintId] = NULL,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = SYSUTCDATETIME()
            FROM [pmt].[Blogs] AS [Blog]
            WHERE [Blog].[IsPrivate] = 1
              AND EXISTS
              (
                  SELECT 1
                  FROM @Plan AS [ProjectPlan]
                  WHERE [ProjectPlan].[ItemType] = N'Project'
                    AND [ProjectPlan].[ItemId] = [Blog].[ProjectId]
              )
              AND NOT EXISTS
              (
                  SELECT 1
                  FROM @Plan AS [BlogPlan]
                  WHERE [BlogPlan].[ItemType] = N'Blog'
                    AND [BlogPlan].[ItemId] = [Blog].[BlogId]
              );

            -- Preserve private Logs and any future non-Scrum Log types by
            -- detaching every Project Log that is not in the exact purge plan.
            UPDATE [DevLog]
            SET [ProjectId] = NULL,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = SYSUTCDATETIME()
            FROM [pmt].[DevLogs] AS [DevLog]
            WHERE EXISTS
            (
                SELECT 1
                FROM @Plan AS [ProjectPlan]
                WHERE [ProjectPlan].[ItemType] = N'Project'
                  AND [ProjectPlan].[ItemId] = [DevLog].[ProjectId]
            )
              AND NOT EXISTS
              (
                  SELECT 1
                  FROM @Plan AS [DevLogPlan]
                  WHERE [DevLogPlan].[ItemType] = N'DevLog'
                    AND [DevLogPlan].[ItemId] = [DevLog].[DevLogId]
              );

            DELETE [DevLog]
            FROM [pmt].[DevLogs] AS [DevLog]
            INNER JOIN @Plan AS [DevLogPlan]
                ON [DevLogPlan].[ItemType] = N'DevLog'
               AND [DevLogPlan].[ItemId] = [DevLog].[DevLogId];

            DELETE [Blog]
            FROM [pmt].[Blogs] AS [Blog]
            INNER JOIN @Plan AS [BlogPlan]
                ON [BlogPlan].[ItemType] = N'Blog'
               AND [BlogPlan].[ItemId] = [Blog].[BlogId];

            DELETE [Task]
            FROM [pmt].[WorkTasks] AS [Task]
            INNER JOIN @Plan AS [TaskPlan]
                ON [TaskPlan].[ItemType] = N'Task'
               AND [TaskPlan].[ItemId] = [Task].[TaskId];

            DELETE [Member]
            FROM [pmt].[SprintMembers] AS [Member]
            INNER JOIN @Plan AS [SprintPlan]
                ON [SprintPlan].[ItemType] = N'Sprint'
               AND [SprintPlan].[ItemId] = [Member].[SprintId];

            DELETE [Sprint]
            FROM [pmt].[Sprints] AS [Sprint]
            INNER JOIN @Plan AS [SprintPlan]
                ON [SprintPlan].[ItemType] = N'Sprint'
               AND [SprintPlan].[ItemId] = [Sprint].[SprintId];

            DELETE [Member]
            FROM [pmt].[ProjectMembers] AS [Member]
            INNER JOIN @Plan AS [ProjectPlan]
                ON [ProjectPlan].[ItemType] = N'Project'
               AND [ProjectPlan].[ItemId] = [Member].[ProjectId];

            DELETE [InvitationProject]
            FROM [pmt].[UserInvitationProjects] AS [InvitationProject]
            INNER JOIN @Plan AS [ProjectPlan]
                ON [ProjectPlan].[ItemType] = N'Project'
               AND [ProjectPlan].[ItemId] = [InvitationProject].[ProjectId];

            DELETE [Project]
            FROM [pmt].[Projects] AS [Project]
            INNER JOIN @Plan AS [ProjectPlan]
                ON [ProjectPlan].[ItemType] = N'Project'
               AND [ProjectPlan].[ItemId] = [Project].[ProjectId];

            DELETE [Invitation]
            FROM [pmt].[UserInvitations] AS [Invitation]
            INNER JOIN @InvitationIds AS [Affected]
                ON [Affected].[UserInvitationId] = [Invitation].[UserInvitationId]
            WHERE NOT EXISTS
            (
                SELECT 1
                FROM [pmt].[UserInvitationProjects] AS [Remaining]
                WHERE [Remaining].[UserInvitationId] = [Invitation].[UserInvitationId]
            );

            DELETE [Attachment]
            FROM [pmt].[Attachments] AS [Attachment]
            INNER JOIN @AttachmentIds AS [Affected]
                ON [Affected].[AttachmentId] = [Attachment].[AttachmentId]
            WHERE NOT EXISTS
            (
                SELECT 1
                FROM [pmt].[TaskAttachments] AS [RemainingTaskAttachment]
                WHERE [RemainingTaskAttachment].[AttachmentId] = [Attachment].[AttachmentId]
            )
              AND NOT EXISTS
              (
                  SELECT 1
                  FROM [pmt].[BlogAttachments] AS [RemainingBlogAttachment]
                  WHERE [RemainingBlogAttachment].[AttachmentId] = [Attachment].[AttachmentId]
              );

            DECLARE @MaintenanceDetails NVARCHAR(4000) =
                N'Permanently deleted ' + CONVERT(NVARCHAR(20), (SELECT COUNT(*) FROM @Plan))
                + N' recycle-bin item(s).';

            EXEC [pmt].[WriteAudit]
                N'Maintenance',
                0,
                N'Permanent Delete',
                @MaintenanceDetails,
                @CurrentUserId;
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
        [ItemType],
        [ItemId],
        [Label],
        [Details],
        [DeletedAt],
        [IsCascade]
    FROM @Plan
    ORDER BY [IsCascade], [DeletedAt] DESC, [ItemType], [Label];
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[FindReferencedUploadPaths]
    @RelativePathsJson NVARCHAR(MAX),
    @RequestPath NVARCHAR(500),
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 50250, 'Only an administrator can use PMT Maintenance.', 1;
    END;

    SET @RelativePathsJson = LTRIM(RTRIM(ISNULL(@RelativePathsJson, N'')));
    SET @RequestPath = REPLACE(LTRIM(RTRIM(ISNULL(@RequestPath, N'/uploads'))), N'\', N'/');

    IF ISJSON(@RelativePathsJson) <> 1 OR LEFT(@RelativePathsJson, 1) <> N'['
    BEGIN
        THROW 50253, 'The upload-path selection is invalid.', 1;
    END;

    IF @RequestPath = N''
    BEGIN
        SET @RequestPath = N'/uploads';
    END;

    IF LEFT(@RequestPath, 1) <> N'/'
    BEGIN
        SET @RequestPath = N'/' + @RequestPath;
    END;

    WHILE LEN(@RequestPath) > 1 AND RIGHT(@RequestPath, 1) = N'/'
    BEGIN
        SET @RequestPath = LEFT(@RequestPath, LEN(@RequestPath) - 1);
    END;

    DECLARE @Paths TABLE
    (
        [RelativePath] NVARCHAR(1000) NOT NULL,
        [Needle] NVARCHAR(1600) NOT NULL,
        [HtmlNeedle] NVARCHAR(3000) NOT NULL
    );

    ;WITH [ParsedPaths] AS
    (
        SELECT [RelativePath] = REPLACE(LTRIM(RTRIM(CONVERT(NVARCHAR(1000), [JsonPath].[value]))), N'\', N'/')
        FROM OPENJSON(@RelativePathsJson) AS [JsonPath]
        WHERE [JsonPath].[type] = 1
    ),
    [NormalizedPaths] AS
    (
        SELECT [RelativePath] = CASE
            WHEN LEFT([RelativePath], 2) = N'./' THEN SUBSTRING([RelativePath], 3, 1000)
            WHEN LEFT([RelativePath], 1) = N'/' THEN SUBSTRING([RelativePath], 2, 1000)
            ELSE [RelativePath]
        END
        FROM [ParsedPaths]
    )
    INSERT INTO @Paths ([RelativePath], [Needle], [HtmlNeedle])
    SELECT DISTINCT
        [RelativePath],
        @RequestPath + N'/' + [RelativePath],
        REPLACE(
            REPLACE(
                REPLACE(
                    REPLACE(
                        REPLACE(@RequestPath + N'/' + [RelativePath], N'&', N'&amp;'),
                        N'<', N'&lt;'
                    ),
                    N'>', N'&gt;'
                ),
                N'"', N'&quot;'
            ),
            N'''', N'&#039;'
        )
    FROM [NormalizedPaths]
    WHERE [RelativePath] <> N'';

    SELECT [Path].[RelativePath]
    FROM @Paths AS [Path]
    WHERE EXISTS
    (
        SELECT 1
        FROM [pmt].[Attachments] AS [Attachment]
        WHERE CHARINDEX([Path].[Needle], ISNULL([Attachment].[Url], N'')) > 0
           OR CHARINDEX([Path].[HtmlNeedle], ISNULL([Attachment].[Url], N'')) > 0
    )
       OR EXISTS
       (
           SELECT 1
           FROM [pmt].[Users] AS [User]
           CROSS APPLY
           (
               VALUES
                   ([User].[AvatarUrl]),
                   ([User].[HomePageUrl]),
                   ([User].[SocialMediaUrl]),
                   ([User].[Bio])
           ) AS [Source] ([Value])
           WHERE CHARINDEX([Path].[Needle], ISNULL([Source].[Value], N'')) > 0
              OR CHARINDEX([Path].[HtmlNeedle], ISNULL([Source].[Value], N'')) > 0
       )
       OR EXISTS
       (
           SELECT 1
           FROM [pmt].[Projects] AS [Project]
           CROSS APPLY
           (
               VALUES
                   ([Project].[Description]),
                   ([Project].[Url]),
                   ([Project].[IconUrl])
           ) AS [Source] ([Value])
           WHERE CHARINDEX([Path].[Needle], ISNULL([Source].[Value], N'')) > 0
              OR CHARINDEX([Path].[HtmlNeedle], ISNULL([Source].[Value], N'')) > 0
       )
       OR EXISTS
       (
           SELECT 1
           FROM [pmt].[Sprints] AS [Sprint]
           CROSS APPLY
           (
               VALUES
                   ([Sprint].[Description]),
                   ([Sprint].[LessonLearnedHtml])
           ) AS [Source] ([Value])
           WHERE CHARINDEX([Path].[Needle], ISNULL([Source].[Value], N'')) > 0
              OR CHARINDEX([Path].[HtmlNeedle], ISNULL([Source].[Value], N'')) > 0
       )
       OR EXISTS
       (
           SELECT 1
           FROM [pmt].[WorkTasks] AS [Task]
           CROSS APPLY
           (
               VALUES
                   ([Task].[DescriptionHtml]),
                   ([Task].[StepsToReproduceHtml]),
                   ([Task].[ActualResultHtml]),
                   ([Task].[ExpectedResultHtml]),
                   ([Task].[RootCauseAnalysisHtml]),
                   ([Task].[Url])
           ) AS [Source] ([Value])
           WHERE CHARINDEX([Path].[Needle], ISNULL([Source].[Value], N'')) > 0
              OR CHARINDEX([Path].[HtmlNeedle], ISNULL([Source].[Value], N'')) > 0
       )
       OR EXISTS
       (
           SELECT 1
           FROM [pmt].[DevLogs] AS [DevLog]
           WHERE CHARINDEX([Path].[Needle], ISNULL([DevLog].[BodyHtml], N'')) > 0
              OR CHARINDEX([Path].[HtmlNeedle], ISNULL([DevLog].[BodyHtml], N'')) > 0
       )
       OR EXISTS
       (
           SELECT 1
           FROM [pmt].[Blogs] AS [Blog]
           WHERE CHARINDEX([Path].[Needle], ISNULL([Blog].[BodyHtml], N'')) > 0
              OR CHARINDEX([Path].[HtmlNeedle], ISNULL([Blog].[BodyHtml], N'')) > 0
       )
    ORDER BY [Path].[RelativePath];
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

CREATE OR ALTER PROCEDURE [pmt].[UpsertBlog]
    @BlogId INT OUTPUT,
    @Title NVARCHAR(220),
    @BodyHtml NVARCHAR(MAX),
    @ProjectId INT,
    @SprintId INT = NULL,
    @ParentBlogId INT = NULL,
    @IsPrivate BIT = 1,
    @IsPinned BIT = 0,
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @OwnerUserId INT;
    DECLARE @ExistingIsPrivate BIT;
    DECLARE @OldProjectId INT;
    DECLARE @OldSprintId INT;
    DECLARE @ParentProjectId INT;
    DECLARE @ParentSprintId INT;
    DECLARE @ParentOwnerUserId INT;
    DECLARE @ParentIsPrivate BIT;
    DECLARE @CycleBlogId INT;
    DECLARE @Action NVARCHAR(80);

    BEGIN TRY
        BEGIN TRANSACTION;

    SET @Title = NULLIF(LTRIM(RTRIM(@Title)), N'');

    IF @Title IS NULL
    BEGIN
        THROW 50070, 'Blog title is required.', 1;
    END;

    IF NULLIF(LTRIM(RTRIM(@BodyHtml)), N'') IS NULL
    BEGIN
        THROW 50071, 'Blog text is required.', 1;
    END;

    IF @ProjectId IS NULL
    BEGIN
        SET @SprintId = NULL;
    END;

    IF @SprintId IS NOT NULL
       AND NOT EXISTS
       (
            SELECT 1
            FROM [pmt].[Sprints]
            WHERE [SprintId] = @SprintId
              AND [ProjectId] = @ProjectId
              AND [IsDeleted] = 0
       )
    BEGIN
        THROW 50076, 'Selected Sprint does not belong to this Project.', 1;
    END;

    IF @ParentBlogId = @BlogId AND @BlogId <> 0
    BEGIN
        THROW 50077, 'A document cannot be its own parent.', 1;
    END;

    IF @ParentBlogId IS NOT NULL
    BEGIN
        SELECT
            @ParentProjectId = [ProjectId],
            @ParentSprintId = [SprintId],
            @ParentOwnerUserId = [CreatedByUserId],
            @ParentIsPrivate = [IsPrivate]
        FROM [pmt].[Blogs] WITH (UPDLOCK, HOLDLOCK)
        WHERE [BlogId] = @ParentBlogId
          AND [IsDeleted] = 0;

        IF @ParentOwnerUserId IS NULL
           OR (@ParentIsPrivate = 1 AND @ParentOwnerUserId <> @CurrentUserId)
        BEGIN
            THROW 50078, 'Parent document was not found.', 1;
        END;

        IF ISNULL(@ParentProjectId, 0) <> ISNULL(@ProjectId, 0)
           OR ISNULL(@ParentSprintId, 0) <> ISNULL(@SprintId, 0)
        BEGIN
            THROW 50079, 'Parent document must be in the same Project and Sprint.', 1;
        END;

        SET @CycleBlogId = @ParentBlogId;
        WHILE @BlogId <> 0 AND @CycleBlogId IS NOT NULL
        BEGIN
            IF @CycleBlogId = @BlogId
            BEGIN
                THROW 50080, 'A document cannot use one of its children as its parent.', 1;
            END;

            SELECT @CycleBlogId =
            (
                SELECT [ParentBlogId]
                FROM [pmt].[Blogs] WITH (UPDLOCK, HOLDLOCK)
                WHERE [BlogId] = @CycleBlogId
                  AND [IsDeleted] = 0
            );
        END;
    END;

    IF @BlogId = 0
    BEGIN
        INSERT INTO [pmt].[Blogs]
        (
            [ProjectId],
            [SprintId],
            [ParentBlogId],
            [Title],
            [BodyHtml],
            [IsPrivate],
            [IsPinned],
            [CreatedByUserId],
            [CreatedAt],
            [UpdatedAt]
        )
        VALUES
        (
            @ProjectId,
            @SprintId,
            @ParentBlogId,
            @Title,
            @BodyHtml,
            @IsPrivate,
            @IsPinned,
            @CurrentUserId,
            @Now,
            @Now
        );

        SET @BlogId = SCOPE_IDENTITY();
        SET @Action = N'Created';
    END
    ELSE
    BEGIN
        SELECT
            @OwnerUserId = [CreatedByUserId],
            @ExistingIsPrivate = [IsPrivate],
            @OldProjectId = [ProjectId],
            @OldSprintId = [SprintId]
        FROM [pmt].[Blogs] WITH (UPDLOCK, HOLDLOCK)
        WHERE [BlogId] = @BlogId
          AND [IsDeleted] = 0;

        IF @OwnerUserId IS NULL
        BEGIN
            THROW 50072, 'Blog was not found.', 1;
        END;

        IF @ExistingIsPrivate = 1 AND @OwnerUserId <> @CurrentUserId
        BEGIN
            THROW 50072, 'Blog was not found.', 1;
        END;

        IF @IsPrivate = 1 AND @OwnerUserId <> @CurrentUserId
        BEGIN
            THROW 50073, 'You cannot make another user''s document private.', 1;
        END;

        IF [pmt].[CanEdit](@OwnerUserId, @CurrentUserId) = 0
        BEGIN
            THROW 50073, 'You cannot edit this blog.', 1;
        END;

        UPDATE [pmt].[Blogs]
        SET
            [ProjectId] = @ProjectId,
            [SprintId] = @SprintId,
            [ParentBlogId] = @ParentBlogId,
            [Title] = @Title,
            [BodyHtml] = @BodyHtml,
            [IsPrivate] = @IsPrivate,
            [IsPinned] = @IsPinned,
            [UpdatedByUserId] = @CurrentUserId,
            [UpdatedAt] = @Now
        WHERE [BlogId] = @BlogId;

        IF ISNULL(@OldProjectId, 0) <> ISNULL(@ProjectId, 0)
           OR ISNULL(@OldSprintId, 0) <> ISNULL(@SprintId, 0)
        BEGIN
            UPDATE [pmt].[Blogs]
            SET [ParentBlogId] = NULL,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = @Now
            WHERE [ParentBlogId] = @BlogId
              AND [IsDeleted] = 0;
        END;

        SET @Action = N'Updated';
    END;

    INSERT INTO [pmt].[BlogHistory] ([BlogId], [Action], [UserId], [CreatedByUserId], [CreatedAt])
    VALUES (@BlogId, @Action, @CurrentUserId, @CurrentUserId, @Now);

    EXEC [pmt].[WriteAudit] N'Blog', @BlogId, @Action, @Title, @CurrentUserId;

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

CREATE OR ALTER PROCEDURE [pmt].[ConvertTaskToBlog]
    @TaskId INT,
    @CurrentUserId INT,
    @BlogId INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @ProjectId INT;
    DECLARE @SprintId INT;
    DECLARE @TaskType NVARCHAR(20);
    DECLARE @Code NVARCHAR(40);
    DECLARE @Title NVARCHAR(220);
    DECLARE @DescriptionHtml NVARCHAR(MAX);
    DECLARE @LinkedBlogId INT;
    DECLARE @SourceType NVARCHAR(40);
    DECLARE @SourceLabel NVARCHAR(400);
    DECLARE @EscapedTitle NVARCHAR(MAX);
    DECLARE @EscapedSourceLabel NVARCHAR(MAX);
    DECLARE @TaskIdText NVARCHAR(20) = CONVERT(NVARCHAR(20), @TaskId);
    DECLARE @BlogIdText NVARCHAR(20);
    DECLARE @DocumentBody NVARCHAR(MAX);
    DECLARE @TaskLinkHtml NVARCHAR(MAX);

    SELECT
        @ProjectId = [ProjectId],
        @SprintId = [SprintId],
        @TaskType = [TaskType],
        @Code = [Code],
        @Title = [Title],
        @DescriptionHtml = [DescriptionHtml],
        @LinkedBlogId = [LinkedBlogId]
    FROM [pmt].[WorkTasks]
    WHERE [TaskId] = @TaskId
      AND [IsDeleted] = 0;

    IF @Title IS NULL
    BEGIN
        THROW 50083, 'Task was not found.', 1;
    END;

    IF [pmt].[CanEditTaskType](@TaskType, @CurrentUserId) = 0
    BEGIN
        THROW 50084, 'You cannot convert this task to documentation.', 1;
    END;

    IF NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(ISNULL(@DescriptionHtml, N''), N'&nbsp;', N' '), N'<p><br></p>', N''), N'<br>', N''))), N'') IS NULL
    BEGIN
        THROW 50085, 'Task description is empty.', 1;
    END;

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT
            @ProjectId = [ProjectId],
            @SprintId = [SprintId],
            @TaskType = [TaskType],
            @Code = [Code],
            @Title = [Title],
            @DescriptionHtml = [DescriptionHtml],
            @LinkedBlogId = [LinkedBlogId]
        FROM [pmt].[WorkTasks] WITH (UPDLOCK, HOLDLOCK)
        WHERE [TaskId] = @TaskId
          AND [IsDeleted] = 0;

        IF @@ROWCOUNT = 0
        BEGIN
            THROW 50083, 'Task was not found.', 1;
        END;

        IF @LinkedBlogId IS NOT NULL
           AND EXISTS (SELECT 1 FROM [pmt].[Blogs] WITH (UPDLOCK, HOLDLOCK) WHERE [BlogId] = @LinkedBlogId AND [IsDeleted] = 0)
        BEGIN
            IF EXISTS
            (
                SELECT 1
                FROM [pmt].[Blogs] WITH (UPDLOCK, HOLDLOCK)
                WHERE [BlogId] = @LinkedBlogId
                  AND [IsDeleted] = 0
                  AND [IsPrivate] = 1
                  AND [CreatedByUserId] <> @CurrentUserId
            )
            BEGIN
                THROW 50086, 'Linked documentation is not available.', 1;
            END;

            SET @BlogId = @LinkedBlogId;
            COMMIT TRANSACTION;
            RETURN;
        END;

        IF NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(ISNULL(@DescriptionHtml, N''), N'&nbsp;', N' '), N'<p><br></p>', N''), N'<br>', N''))), N'') IS NULL
        BEGIN
            THROW 50085, 'Task description is empty.', 1;
        END;

        SET @SourceType = CASE WHEN @TaskType = N'Bug' THEN N'Bug Report' ELSE N'Dev Task' END;
        SET @SourceLabel = @SourceType + N' ' + ISNULL(@Code, N'') + N' - ' + @Title;
        SET @EscapedTitle = @Title;
        SET @EscapedSourceLabel = @SourceLabel;

        SET @EscapedTitle = REPLACE(@EscapedTitle, N'&', N'&amp;');
        SET @EscapedTitle = REPLACE(@EscapedTitle, N'<', N'&lt;');
        SET @EscapedTitle = REPLACE(@EscapedTitle, N'>', N'&gt;');
        SET @EscapedTitle = REPLACE(@EscapedTitle, N'"', N'&quot;');
        SET @EscapedTitle = REPLACE(@EscapedTitle, N'''', N'&#39;');

        SET @EscapedSourceLabel = REPLACE(@EscapedSourceLabel, N'&', N'&amp;');
        SET @EscapedSourceLabel = REPLACE(@EscapedSourceLabel, N'<', N'&lt;');
        SET @EscapedSourceLabel = REPLACE(@EscapedSourceLabel, N'>', N'&gt;');
        SET @EscapedSourceLabel = REPLACE(@EscapedSourceLabel, N'"', N'&quot;');
        SET @EscapedSourceLabel = REPLACE(@EscapedSourceLabel, N'''', N'&#39;');

        SET @DocumentBody =
            ISNULL(@DescriptionHtml, N'') +
            N'<hr>' +
            N'<p><em>This document originally came from <a href="#work-item-' + @TaskIdText +
            N'" data-work-item-link="' + @TaskIdText + N'">' + @EscapedSourceLabel +
            N'</a>.</em></p>';

        INSERT INTO [pmt].[Blogs]
        (
            [ProjectId],
            [SprintId],
            [Title],
            [BodyHtml],
            [IsPrivate],
            [CreatedByUserId],
            [UpdatedByUserId],
            [CreatedAt],
            [UpdatedAt]
        )
        VALUES
        (
            @ProjectId,
            @SprintId,
            @Title,
            @DocumentBody,
            1,
            @CurrentUserId,
            @CurrentUserId,
            @Now,
            @Now
        );

        SET @BlogId = SCOPE_IDENTITY();
        SET @BlogIdText = CONVERT(NVARCHAR(20), @BlogId);
        SET @TaskLinkHtml =
            N'<p><a href="#documentation-blog-' + @BlogIdText +
            N'" data-documentation-link="' + @BlogIdText +
            N'">View generated Documentation: ' + @EscapedTitle + N'</a></p>';

        INSERT INTO [pmt].[BlogHistory] ([BlogId], [Action], [UserId], [CreatedByUserId], [CreatedAt])
        VALUES (@BlogId, N'Created', @CurrentUserId, @CurrentUserId, @Now);

        UPDATE [pmt].[WorkTasks]
        SET [DescriptionHtml] = @TaskLinkHtml,
            [LinkedBlogId] = @BlogId,
            [UpdatedByUserId] = @CurrentUserId,
            [UpdatedAt] = @Now
        WHERE [TaskId] = @TaskId;

        EXEC [pmt].[WriteAudit] N'Blog', @BlogId, N'Created', @Title, @CurrentUserId;
        EXEC [pmt].[WriteAudit] N'Task', @TaskId, N'Converted to Document', @Title, @CurrentUserId;

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

CREATE OR ALTER PROCEDURE [pmt].[DeleteBlog]
    @BlogId INT,
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @OwnerUserId INT;
    DECLARE @IsPrivate BIT;

    BEGIN TRY
        BEGIN TRANSACTION;

    SELECT
        @OwnerUserId = [CreatedByUserId],
        @IsPrivate = [IsPrivate]
    FROM [pmt].[Blogs] WITH (UPDLOCK, HOLDLOCK)
    WHERE [BlogId] = @BlogId
      AND [IsDeleted] = 0;

    IF @OwnerUserId IS NULL
       OR (@IsPrivate = 1 AND @OwnerUserId <> @CurrentUserId)
    BEGIN
        THROW 50074, 'Blog was not found.', 1;
    END;

    IF [pmt].[CanEdit](@OwnerUserId, @CurrentUserId) = 0
    BEGIN
        THROW 50075, 'You cannot delete this blog.', 1;
    END;

    UPDATE [pmt].[Blogs]
    SET [IsDeleted] = 1,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [BlogId] = @BlogId;

    UPDATE [pmt].[Blogs]
    SET [ParentBlogId] = NULL,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [ParentBlogId] = @BlogId
      AND [IsDeleted] = 0;

    IF @IsPrivate = 1
    BEGIN
        DELETE [AuditEvent]
        FROM [pmt].[AuditEvents] AS [AuditEvent]
        INNER JOIN [pmt].[WorkTasks] AS [Task]
            ON [Task].[TaskId] = [AuditEvent].[EntityId]
           AND [Task].[LinkedBlogId] = @BlogId
        WHERE [AuditEvent].[EntityType] = N'Task'
          AND [AuditEvent].[Action] = N'Converted to Document';
    END;

    UPDATE [pmt].[WorkTasks]
    SET [DescriptionHtml] = CASE WHEN @IsPrivate = 1 THEN NULL ELSE [DescriptionHtml] END,
        [LinkedBlogId] = NULL,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [LinkedBlogId] = @BlogId
      AND [IsDeleted] = 0;

    INSERT INTO [pmt].[BlogHistory] ([BlogId], [Action], [UserId], [CreatedByUserId])
    VALUES (@BlogId, N'Deleted', @CurrentUserId, @CurrentUserId);

    EXEC [pmt].[WriteAudit] N'Blog', @BlogId, N'Deleted', N'Blog hidden from active views.', @CurrentUserId;

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

CREATE OR ALTER PROCEDURE [pmt].[AddTaskAttachment]
    @AttachmentId INT OUTPUT,
    @TaskId INT,
    @FileName NVARCHAR(260),
    @Url NVARCHAR(500),
    @ContentType NVARCHAR(160),
    @ByteLength BIGINT,
    @CurrentUserId INT,
    @AllowBacklogAccess BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @TaskType NVARCHAR(20);

    SELECT @TaskType = [TaskType]
    FROM [pmt].[WorkTasks]
    WHERE [TaskId] = @TaskId
      AND [IsDeleted] = 0;

    IF @TaskType IS NULL
    BEGIN
        THROW 50080, 'Task was not found.', 1;
    END;

    -- The Backlog editor uploads after saving, so the item may already have
    -- moved out of Todo while the same edit operation is still completing.
    IF [pmt].[CanEditTaskType](@TaskType, @CurrentUserId) = 0
       AND @AllowBacklogAccess = 0
    BEGIN
        THROW 50081, 'You cannot attach files to this task.', 1;
    END;

    INSERT INTO [pmt].[Attachments]
    (
        [FileName],
        [Url],
        [ContentType],
        [ByteLength],
        [UploadedByUserId],
        [CreatedByUserId]
    )
    VALUES
    (
        @FileName,
        @Url,
        @ContentType,
        @ByteLength,
        @CurrentUserId,
        @CurrentUserId
    );

    SET @AttachmentId = SCOPE_IDENTITY();

    INSERT INTO [pmt].[TaskAttachments] ([TaskId], [AttachmentId], [CreatedByUserId])
    VALUES (@TaskId, @AttachmentId, @CurrentUserId);

    EXEC [pmt].[WriteAudit] N'Task', @TaskId, N'Attachment Added', @FileName, @CurrentUserId;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[AddBlogAttachment]
    @AttachmentId INT OUTPUT,
    @BlogId INT,
    @FileName NVARCHAR(260),
    @Url NVARCHAR(500),
    @ContentType NVARCHAR(160),
    @ByteLength BIGINT,
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @OwnerUserId INT;
    DECLARE @IsPrivate BIT;

    BEGIN TRY
        BEGIN TRANSACTION;

    SELECT
        @OwnerUserId = [CreatedByUserId],
        @IsPrivate = [IsPrivate]
    FROM [pmt].[Blogs] WITH (UPDLOCK, HOLDLOCK)
    WHERE [BlogId] = @BlogId
      AND [IsDeleted] = 0;

    IF @OwnerUserId IS NULL
       OR (@IsPrivate = 1 AND @OwnerUserId <> @CurrentUserId)
    BEGIN
        THROW 50082, 'Blog was not found.', 1;
    END;

    IF [pmt].[CanEdit](@OwnerUserId, @CurrentUserId) = 0
    BEGIN
        THROW 50083, 'You cannot attach files to this blog.', 1;
    END;

    INSERT INTO [pmt].[Attachments]
    (
        [FileName],
        [Url],
        [ContentType],
        [ByteLength],
        [UploadedByUserId],
        [CreatedByUserId]
    )
    VALUES
    (
        @FileName,
        @Url,
        @ContentType,
        @ByteLength,
        @CurrentUserId,
        @CurrentUserId
    );

    SET @AttachmentId = SCOPE_IDENTITY();

    INSERT INTO [pmt].[BlogAttachments] ([BlogId], [AttachmentId], [CreatedByUserId])
    VALUES (@BlogId, @AttachmentId, @CurrentUserId);

    INSERT INTO [pmt].[BlogHistory] ([BlogId], [Action], [UserId], [CreatedByUserId])
    VALUES (@BlogId, N'Attachment Added', @CurrentUserId, @CurrentUserId);

    EXEC [pmt].[WriteAudit] N'Blog', @BlogId, N'Attachment Added', @FileName, @CurrentUserId;

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

CREATE OR ALTER PROCEDURE [pmt].[DeleteTaskAttachment]
    @TaskId INT,
    @AttachmentId INT,
    @CurrentUserId INT,
    @AllowBacklogAccess BIT = 0,
    @Url NVARCHAR(500) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @TaskType NVARCHAR(20);
    DECLARE @FileName NVARCHAR(260);
    DECLARE @ResourceKey NVARCHAR(40);

    SELECT @TaskType = [TaskType]
    FROM [pmt].[WorkTasks]
    WHERE [TaskId] = @TaskId
      AND [IsDeleted] = 0;

    IF @TaskType IS NULL
    BEGIN
        THROW 50230, 'Task was not found.', 1;
    END;

    SET @ResourceKey = CASE
        WHEN @AllowBacklogAccess = 1 THEN N'Backlog'
        WHEN @TaskType = N'Bug' THEN N'BugTracking'
        ELSE N'DevTasks'
    END;

    IF [pmt].[HasPermission](@CurrentUserId, @ResourceKey, N'Update') = 0
    BEGIN
        THROW 50231, 'You cannot delete attachments from this task.', 1;
    END;

    SELECT
        @FileName = [Attachment].[FileName],
        @Url = [Attachment].[Url]
    FROM [pmt].[TaskAttachments] AS [TaskAttachment]
    INNER JOIN [pmt].[Attachments] AS [Attachment]
        ON [Attachment].[AttachmentId] = [TaskAttachment].[AttachmentId]
    WHERE [TaskAttachment].[TaskId] = @TaskId
      AND [TaskAttachment].[AttachmentId] = @AttachmentId;

    IF @FileName IS NULL
    BEGIN
        THROW 50232, 'Attachment was not found on this task.', 1;
    END;

    DELETE FROM [pmt].[TaskAttachments]
    WHERE [TaskId] = @TaskId
      AND [AttachmentId] = @AttachmentId;

    IF NOT EXISTS (SELECT 1 FROM [pmt].[TaskAttachments] WHERE [AttachmentId] = @AttachmentId)
       AND NOT EXISTS (SELECT 1 FROM [pmt].[BlogAttachments] WHERE [AttachmentId] = @AttachmentId)
    BEGIN
        DELETE FROM [pmt].[Attachments]
        WHERE [AttachmentId] = @AttachmentId;
    END;
    ELSE
    BEGIN
        SET @Url = NULL;
    END;

    EXEC [pmt].[WriteAudit] N'Task', @TaskId, N'Attachment Deleted', @FileName, @CurrentUserId;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[DeleteBlogAttachment]
    @BlogId INT,
    @AttachmentId INT,
    @CurrentUserId INT,
    @Url NVARCHAR(500) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @FileName NVARCHAR(260);
    DECLARE @OwnerUserId INT;
    DECLARE @IsPrivate BIT;

    BEGIN TRY
        BEGIN TRANSACTION;

    SELECT
        @OwnerUserId = [CreatedByUserId],
        @IsPrivate = [IsPrivate]
    FROM [pmt].[Blogs] WITH (UPDLOCK, HOLDLOCK)
    WHERE [BlogId] = @BlogId
      AND [IsDeleted] = 0;

    IF @OwnerUserId IS NULL
       OR (@IsPrivate = 1 AND @OwnerUserId <> @CurrentUserId)
    BEGIN
        THROW 50233, 'Blog was not found.', 1;
    END;

    IF [pmt].[HasPermission](@CurrentUserId, N'Documentation', N'Update') = 0
    BEGIN
        THROW 50234, 'You cannot delete attachments from this blog.', 1;
    END;

    SELECT
        @FileName = [Attachment].[FileName],
        @Url = [Attachment].[Url]
    FROM [pmt].[BlogAttachments] AS [BlogAttachment]
    INNER JOIN [pmt].[Attachments] AS [Attachment]
        ON [Attachment].[AttachmentId] = [BlogAttachment].[AttachmentId]
    WHERE [BlogAttachment].[BlogId] = @BlogId
      AND [BlogAttachment].[AttachmentId] = @AttachmentId;

    IF @FileName IS NULL
    BEGIN
        THROW 50235, 'Attachment was not found on this blog.', 1;
    END;

    DELETE FROM [pmt].[BlogAttachments]
    WHERE [BlogId] = @BlogId
      AND [AttachmentId] = @AttachmentId;

    IF NOT EXISTS (SELECT 1 FROM [pmt].[TaskAttachments] WHERE [AttachmentId] = @AttachmentId)
       AND NOT EXISTS (SELECT 1 FROM [pmt].[BlogAttachments] WHERE [AttachmentId] = @AttachmentId)
    BEGIN
        DELETE FROM [pmt].[Attachments]
        WHERE [AttachmentId] = @AttachmentId;
    END;
    ELSE
    BEGIN
        SET @Url = NULL;
    END;

    INSERT INTO [pmt].[BlogHistory] ([BlogId], [Action], [UserId], [CreatedByUserId])
    VALUES (@BlogId, N'Attachment Deleted', @CurrentUserId, @CurrentUserId);

    EXEC [pmt].[WriteAudit] N'Blog', @BlogId, N'Attachment Deleted', @FileName, @CurrentUserId;

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

CREATE OR ALTER PROCEDURE [pmt].[FinishSprint]
    @SprintId INT,
    @CarryUnfinished BIT = 1,
    @CarryTodos BIT = 0,
    @CurrentUserId INT,
    @NewSprintId INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ProjectId INT;
    DECLARE @ProjectCode NVARCHAR(20);
    DECLARE @OwnerUserId INT;
    DECLARE @StartDate DATETIME2(0);
    DECLARE @EndDate DATETIME2(0);
    DECLARE @Days INT;
    DECLARE @NextNumber INT;
    DECLARE @NewCode NVARCHAR(40);
    DECLARE @NewStartDate DATETIME2(0);
    DECLARE @NewEndDate DATETIME2(0);

    SELECT
        @ProjectId = [pmt].[Sprints].[ProjectId],
        @ProjectCode = [pmt].[Projects].[Code],
        @OwnerUserId = [pmt].[Sprints].[CreatedByUserId],
        @StartDate = [pmt].[Sprints].[StartDate],
        @EndDate = [pmt].[Sprints].[EndDate]
    FROM [pmt].[Sprints]
    INNER JOIN [pmt].[Projects]
        ON [pmt].[Projects].[ProjectId] = [pmt].[Sprints].[ProjectId]
    WHERE [pmt].[Sprints].[SprintId] = @SprintId
      AND [pmt].[Sprints].[IsFinished] = 0
      AND [pmt].[Sprints].[IsDeleted] = 0;

    IF @ProjectId IS NULL
    BEGIN
        THROW 50020, 'Open sprint was not found.', 1;
    END;

    IF [pmt].[CanEdit](@OwnerUserId, @CurrentUserId) = 0
    BEGIN
        THROW 50021, 'You cannot finish this sprint.', 1;
    END;

    SELECT @NextNumber = COUNT(*) + 1
    FROM [pmt].[Sprints]
    WHERE [ProjectId] = @ProjectId;

    SET @NewCode = @ProjectCode + N'-Sprint' + CONVERT(NVARCHAR(12), @NextNumber);

    WHILE EXISTS (SELECT 1 FROM [pmt].[Sprints] WHERE [Code] = @NewCode)
    BEGIN
        SET @NextNumber = @NextNumber + 1;
        SET @NewCode = @ProjectCode + N'-Sprint' + CONVERT(NVARCHAR(12), @NextNumber);
    END;

    SET @StartDate = ISNULL(@StartDate, CONVERT(DATE, SYSUTCDATETIME()));
    SET @EndDate = ISNULL(@EndDate, DATEADD(DAY, 13, @StartDate));
    SET @Days = DATEDIFF(DAY, @StartDate, @EndDate);
    SET @NewStartDate = DATEADD(DAY, 1, @EndDate);
    SET @NewEndDate = DATEADD(DAY, @Days + 1, @EndDate);

    UPDATE [pmt].[Sprints]
    SET [IsFinished] = 1,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [SprintId] = @SprintId;

    INSERT INTO [pmt].[Sprints]
    (
        [ProjectId],
        [Code],
        [Title],
        [Description],
        [StartDate],
        [EndDate],
        [LessonLearnedHtml],
        [CreatedByUserId]
    )
    VALUES
    (
        @ProjectId,
        @NewCode,
        N'Sprint ' + CONVERT(NVARCHAR(12), @NextNumber),
        N'Carry-over sprint created when the previous sprint was finished.',
        @NewStartDate,
        @NewEndDate,
        N'',
        @CurrentUserId
    );

    SET @NewSprintId = SCOPE_IDENTITY();

    INSERT INTO [pmt].[SprintMembers] ([SprintId], [UserId], [CreatedByUserId])
    SELECT @NewSprintId, [UserId], @CurrentUserId
    FROM [pmt].[SprintMembers]
    WHERE [SprintId] = @SprintId;

    UPDATE [pmt].[WorkTasks]
    SET [SprintId] = @NewSprintId,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [SprintId] = @SprintId
      AND [PercentCompleted] < 100
      AND @CarryUnfinished = 1
      AND (@CarryTodos = 1 OR [Status] <> N'Todo')
      AND [IsDeleted] = 0;

    EXEC [pmt].[WriteAudit] N'Sprint', @SprintId, N'Finished', N'Unfinished tasks were moved to the new sprint.', @CurrentUserId;
    EXEC [pmt].[WriteAudit] N'Sprint', @NewSprintId, N'Created', N'Created by finishing the previous sprint.', @CurrentUserId;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[DeleteSprint]
    @SprintId INT,
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @OwnerUserId INT;

    SELECT @OwnerUserId = [CreatedByUserId]
    FROM [pmt].[Sprints]
    WHERE [SprintId] = @SprintId
      AND [IsDeleted] = 0;

    IF @OwnerUserId IS NULL
    BEGIN
        THROW 50022, 'Sprint was not found.', 1;
    END;

    IF [pmt].[CanEdit](@OwnerUserId, @CurrentUserId) = 0
    BEGIN
        THROW 50023, 'You cannot delete this sprint.', 1;
    END;

    UPDATE [pmt].[WorkTasks]
    SET [SprintId] = NULL,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [SprintId] = @SprintId;

    UPDATE [pmt].[Blogs]
    SET [SprintId] = NULL,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [SprintId] = @SprintId
      AND [IsDeleted] = 0;

    UPDATE [pmt].[Sprints]
    SET [IsDeleted] = 1,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [SprintId] = @SprintId;

    EXEC [pmt].[WriteAudit] N'Sprint', @SprintId, N'Deleted', N'Sprint hidden and tasks moved out of sprint.', @CurrentUserId;
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

CREATE OR ALTER PROCEDURE [pmt].[DevelopmentClearNonPmt]
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    EXEC [pmt].[DevelopmentClearProjectData]
        @CurrentUserId = @CurrentUserId,
        @ClearPmtOnly = 0,
        @DeleteProjects = 1;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[DevelopmentClearPmt]
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    EXEC [pmt].[DevelopmentClearProjectData]
        @CurrentUserId = @CurrentUserId,
        @ClearPmtOnly = 1,
        @DeleteProjects = 1;
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
