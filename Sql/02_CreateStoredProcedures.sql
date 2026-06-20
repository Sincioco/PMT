/*
    PMT stored procedures.
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
    -- Administrators can edit all records. Users can edit records they created.
    IF [pmt].[IsAdmin](@CurrentUserId) = 1 OR @OwnerUserId = @CurrentUserId
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

CREATE OR ALTER FUNCTION [pmt].[CanEditTaskType](@TaskType NVARCHAR(20), @CurrentUserId INT)
RETURNS BIT
AS
BEGIN
    DECLARE @Role NVARCHAR(20) = [pmt].[UserRole](@CurrentUserId);

    IF @Role = N'Admin'
    BEGIN
        RETURN 1;
    END;

    IF @TaskType = N'Dev' AND @Role = N'Developer'
    BEGIN
        RETURN 1;
    END;

    IF @TaskType = N'Bug' AND @Role = N'QA'
    BEGIN
        RETURN 1;
    END;

    RETURN 0;
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
        @UserId
    );
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[GetAppState]
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
        [DescriptionHtml],
        [StepsToReproduceHtml],
        [ActualResultHtml],
        [ExpectedResultHtml],
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
        [CreatedAt],
        [UpdatedAt]
    FROM [pmt].[WorkTasks]
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
    FROM [pmt].[Attachments]
    ORDER BY [CreatedAt] DESC;

    SELECT
        [TaskId],
        [AttachmentId]
    FROM [pmt].[TaskAttachments]
    ORDER BY [TaskId], [AttachmentId];

    SELECT
        [DevLogId],
        [ProjectId],
        [UserId],
        [LogDate],
        [BodyHtml],
        [IsPinned],
        [CreatedAt],
        [UpdatedAt]
    FROM [pmt].[DevLogs]
    WHERE [IsDeleted] = 0
    ORDER BY [IsPinned] DESC, [LogDate] DESC, [UpdatedAt] DESC;

    SELECT
        [BlogId],
        [ProjectId],
        [Title],
        [BodyHtml],
        [CreatedByUserId],
        [CreatedAt],
        [UpdatedAt]
    FROM [pmt].[Blogs]
    WHERE [IsDeleted] = 0
    ORDER BY [UpdatedAt] DESC;

    SELECT
        [BlogId],
        [AttachmentId]
    FROM [pmt].[BlogAttachments]
    ORDER BY [BlogId], [AttachmentId];

    SELECT
        [BlogHistoryId],
        [BlogId],
        [Action],
        [UserId],
        [CreatedAt]
    FROM [pmt].[BlogHistory]
    ORDER BY [CreatedAt] DESC;

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
    FROM [pmt].[AuditEvents]
    ORDER BY [CreatedAt] DESC, [AuditEventId] DESC;

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
        [Role]
    FROM [pmt].[Users]
    WHERE [IsActive] = 1
      AND ([Nickname] = @Login OR [Email] = @Login)
      AND [PasswordHash] = HASHBYTES('SHA2_256', CONVERT(NVARCHAR(4000), @Password));
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
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @OwnerUserId INT;

    SET @Title = NULLIF(LTRIM(RTRIM(@Title)), N'');
    SET @Code = UPPER(REPLACE(NULLIF(LTRIM(RTRIM(@Code)), N''), N' ', N''));
    IF @EndDate IS NOT NULL AND @StartDate IS NOT NULL AND @EndDate < @StartDate
    BEGIN
        SET @EndDate = @StartDate;
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

    IF @Code IS NULL
    BEGIN
        SET @Code = UPPER(LEFT(REPLACE(@Title, N' ', N''), 3));
    END;

    IF LEN(@Code) < 2
    BEGIN
        SET @Code = N'PRJ';
    END;

    IF @ProjectId = 0
    BEGIN
        WHILE EXISTS (SELECT 1 FROM [pmt].[Projects] WHERE [Code] = @Code)
        BEGIN
            SET @Code = LEFT(@Code, 1)
                + RIGHT(N'0000' + CONVERT(NVARCHAR(4), ABS(CHECKSUM(NEWID())) % 10000), 4);
        END;

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
        SELECT @OwnerUserId = [CreatedByUserId]
        FROM [pmt].[Projects]
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

        IF EXISTS (SELECT 1 FROM [pmt].[Projects] WHERE [Code] = @Code AND [ProjectId] <> @ProjectId)
        BEGIN
            THROW 50004, 'Project code is already in use.', 1;
        END;

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
    DECLARE @ParentOldPercentCompleted INT;
    DECLARE @ParentNewPercentCompleted INT;
    DECLARE @CompletionBlockBugTaskId INT;

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

    IF @TaskId = 0 AND [pmt].[CanEditTaskType](@TaskType, @CurrentUserId) = 0
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

        IF [pmt].[CanEditTaskType](@ExistingTaskType, @CurrentUserId) = 0
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

    IF @TaskType = N'Bug'
    BEGIN
        SET @Environment = ISNULL(@Environment, N'SIT');
        SET @Severity = ISNULL(@Severity, N'Major');

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

    IF @TaskType = N'Bug' AND @Status IN (N'QA Failed', N'QA Passed')
    BEGIN
        SET @PercentCompleted = 100;
    END;

    IF @Status IN (N'QA Passed', N'Deployed in SIT', N'Deployed in UAT', N'Deployed in Prod')
    BEGIN
        SET @PercentCompleted = 100;
    END;

    IF @TaskType = N'Dev' AND @Status = N'Code Complete'
    BEGIN
        SET @PercentCompleted = 100;
    END;

    IF @TaskType = N'Dev' AND @PercentCompleted >= 100
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

        EXEC [pmt].[WriteAudit] N'Task', @TaskId, N'Updated', @Title, @CurrentUserId;
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
                N'<p>Created automatically from bug ' + CONVERT(NVARCHAR(20), @TaskId) + N'.</p>',
                N'Todo',
                @Priority,
                0,
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
            UPDATE [pmt].[WorkTasks]
            SET [ProjectId] = @BugProjectId,
                [SprintId] = @BugSprintId,
                [Title] = N'Bug Fix: ' + @Title,
                [Priority] = @Priority,
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

    -- QA results on a Bug move the linked Bug Fix task to the right progress point.
    IF @TaskType = N'Bug' AND @Status IN (N'QA Passed', N'QA Failed') AND @LinkedDevTaskId IS NOT NULL
    BEGIN
        SELECT
            @LinkedOldStatus = [Status],
            @LinkedOldPercentCompleted = [PercentCompleted]
        FROM [pmt].[WorkTasks]
        WHERE [TaskId] = @LinkedDevTaskId;

        SET @LinkedNewPercentCompleted = CASE WHEN @Status = N'QA Passed' THEN 100 ELSE 50 END;

        IF ISNULL(@LinkedOldPercentCompleted, -1) <> @LinkedNewPercentCompleted
        BEGIN
            UPDATE [pmt].[WorkTasks]
            SET
                [PercentCompleted] = @LinkedNewPercentCompleted,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = @Now
            WHERE [TaskId] = @LinkedDevTaskId;

            SET @AuditDetails =
                N'Linked Bug QA result set Bug Fix percent: ' +
                CONVERT(NVARCHAR(12), ISNULL(@LinkedOldPercentCompleted, 0)) +
                N'% -> ' + CONVERT(NVARCHAR(12), @LinkedNewPercentCompleted) + N'%';

            EXEC [pmt].[WriteAudit]
                N'Task',
                @LinkedDevTaskId,
                N'Status/Percent Changed',
                @AuditDetails,
                @CurrentUserId,
                @LinkedOldStatus,
                @LinkedOldStatus,
                @LinkedOldPercentCompleted,
                @LinkedNewPercentCompleted;
        END;
    END;

    -- A completed Bug Fix is ready for QA to retest, so the linked Bug goes back to 0%.
    IF @TaskType = N'Dev' AND @Status = N'Code Complete'
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
            SELECT
                @LinkedOldStatus = [Status],
                @LinkedOldPercentCompleted = [PercentCompleted]
            FROM [pmt].[WorkTasks]
            WHERE [TaskId] = @LinkedBugToRetestId;

            IF ISNULL(@LinkedOldPercentCompleted, -1) <> 0
            BEGIN
                UPDATE [pmt].[WorkTasks]
                SET
                    [PercentCompleted] = 0,
                    [UpdatedByUserId] = @CurrentUserId,
                    [UpdatedAt] = @Now
                WHERE [TaskId] = @LinkedBugToRetestId;

                SET @AuditDetails =
                    N'Linked Bug Fix reached Code Complete; Bug percent reset for QA retest: ' +
                    CONVERT(NVARCHAR(12), ISNULL(@LinkedOldPercentCompleted, 0)) + N'% -> 0%';

                EXEC [pmt].[WriteAudit]
                    N'Task',
                    @LinkedBugToRetestId,
                    N'Status/Percent Changed',
                    @AuditDetails,
                    @CurrentUserId,
                    @LinkedOldStatus,
                    @LinkedOldStatus,
                    @LinkedOldPercentCompleted,
                    0;
            END;
        END;
    END;

    -- When a sub-task changes, refresh the parent task's calculated percent.
    IF @ParentTaskId IS NOT NULL
    BEGIN
        SELECT @ParentOldPercentCompleted = [PercentCompleted]
        FROM [pmt].[WorkTasks]
        WHERE [TaskId] = @ParentTaskId;

        SELECT @ParentNewPercentCompleted = CONVERT(INT, ROUND(AVG(CONVERT(DECIMAL(10, 2), [PercentCompleted])), 0))
        FROM [pmt].[WorkTasks]
        WHERE [ParentTaskId] = @ParentTaskId
          AND [IsDeleted] = 0;

        IF @ParentNewPercentCompleted IS NOT NULL
           AND ISNULL(@ParentOldPercentCompleted, -1) <> @ParentNewPercentCompleted
        BEGIN
            UPDATE [pmt].[WorkTasks]
            SET
                [PercentCompleted] = @ParentNewPercentCompleted,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = @Now
            WHERE [TaskId] = @ParentTaskId;

            SET @AuditDetails =
                N'Parent percent recalculated from sub-tasks: ' +
                CONVERT(NVARCHAR(12), ISNULL(@ParentOldPercentCompleted, 0)) +
                N'% -> ' + CONVERT(NVARCHAR(12), @ParentNewPercentCompleted) + N'%';

            EXEC [pmt].[WriteAudit]
                N'Task',
                @ParentTaskId,
                N'Status/Percent Changed',
                @AuditDetails,
                @CurrentUserId,
                NULL,
                NULL,
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
    @NewTaskId INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ProjectId INT;
    DECLARE @ProjectCode NVARCHAR(20);
    DECLARE @NextNumber INT;
    DECLARE @NewCode NVARCHAR(40);
    DECLARE @TaskType NVARCHAR(20);
    DECLARE @CodeSuffix NVARCHAR(20);
    DECLARE @NextSortOrder INT;

    SELECT
        @ProjectId = [pmt].[WorkTasks].[ProjectId],
        @ProjectCode = [pmt].[Projects].[Code],
        @TaskType = [pmt].[WorkTasks].[TaskType]
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
    @CurrentUserId INT
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
        THROW 50041, 'Task was not found.', 1;
    END;

    IF [pmt].[CanEditTaskType](@TaskType, @CurrentUserId) = 0
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
    SET @Nickname = ISNULL(NULLIF(LTRIM(RTRIM(@Nickname)), N''), @FirstName);
    SET @Role = ISNULL(NULLIF(LTRIM(RTRIM(@Role)), N''), N'Developer');

    IF @Role NOT IN (N'Developer', N'QA')
    BEGIN
        SET @Role = N'Developer';
    END;

    IF @IsAdmin = 1
    BEGIN
        SET @Role = N'Admin';
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
              FROM [pmt].[WfhSchedules]
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
        [WfhSchedules].[SortOrder]
    FROM [pmt].[Users]
    INNER JOIN [pmt].[WfhSchedules]
        ON [WfhSchedules].[UserId] = [Users].[UserId]
    WHERE [Users].[IsActive] = 1
    ORDER BY [WfhSchedules].[SortOrder], [Users].[Nickname], [Users].[FirstName], [Users].[UserId];
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
        [IsHidden] = @IsHidden,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [UserId] = @UserId;

    DECLARE @AuditAction NVARCHAR(40) = CASE WHEN @IsHidden = 1 THEN N'Hidden' ELSE N'Updated' END;

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

    IF @LookupId = 0
    BEGIN
        INSERT INTO [pmt].[Lookups] ([LookupType], [Value], [ColorHex], [DisplayOrder], [IsActive], [CreatedByUserId])
        VALUES (@LookupType, @Value, @ColorHex, @DisplayOrder, @IsActive, @CurrentUserId);

        SET @LookupId = SCOPE_IDENTITY();
        EXEC [pmt].[WriteAudit] N'Lookup', @LookupId, N'Created', @LookupType, @CurrentUserId;
    END
    ELSE
    BEGIN
        UPDATE [pmt].[Lookups]
        SET [LookupType] = @LookupType,
            [Value] = @Value,
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

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 50057, 'Only administrators can maintain dropdown values.', 1;
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

CREATE OR ALTER PROCEDURE [pmt].[UpsertDevLog]
    @DevLogId INT OUTPUT,
    @LogDate DATETIME2(0),
    @BodyHtml NVARCHAR(MAX),
    @ProjectId INT,
    @IsPinned BIT,
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @OwnerUserId INT;

    IF NULLIF(LTRIM(RTRIM(@BodyHtml)), N'') IS NULL
    BEGIN
        THROW 50060, 'Dev log text is required.', 1;
    END;

    IF @LogDate < '2000-01-01'
    BEGIN
        SET @LogDate = CONVERT(DATE, SYSUTCDATETIME());
    END;

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        SET @IsPinned = 0;
    END;

    IF @DevLogId = 0
    BEGIN
        INSERT INTO [pmt].[DevLogs]
        (
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
        SELECT @OwnerUserId = [UserId]
        FROM [pmt].[DevLogs]
        WHERE [DevLogId] = @DevLogId
          AND [IsDeleted] = 0;

        IF @OwnerUserId IS NULL
        BEGIN
            THROW 50061, 'Dev log was not found.', 1;
        END;

        IF [pmt].[CanEdit](@OwnerUserId, @CurrentUserId) = 0
        BEGIN
            THROW 50062, 'You cannot edit this dev log.', 1;
        END;

        UPDATE [pmt].[DevLogs]
        SET
            [ProjectId] = @ProjectId,
            [LogDate] = @LogDate,
            [BodyHtml] = @BodyHtml,
            [IsPinned] = CASE WHEN [pmt].[IsAdmin](@CurrentUserId) = 1 THEN @IsPinned ELSE [IsPinned] END,
            [UpdatedByUserId] = @CurrentUserId,
            [UpdatedAt] = @Now
        WHERE [DevLogId] = @DevLogId;

        EXEC [pmt].[WriteAudit] N'DevLog', @DevLogId, N'Updated', N'Dev log updated.', @CurrentUserId;
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

    SELECT @OwnerUserId = [UserId]
    FROM [pmt].[DevLogs]
    WHERE [DevLogId] = @DevLogId
      AND [IsDeleted] = 0;

    IF @OwnerUserId IS NULL
    BEGIN
        THROW 50063, 'Dev log was not found.', 1;
    END;

    IF [pmt].[CanEdit](@OwnerUserId, @CurrentUserId) = 0
    BEGIN
        THROW 50064, 'You cannot delete this dev log.', 1;
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
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @OwnerUserId INT;
    DECLARE @Action NVARCHAR(80);

    SET @Title = NULLIF(LTRIM(RTRIM(@Title)), N'');

    IF @Title IS NULL
    BEGIN
        THROW 50070, 'Blog title is required.', 1;
    END;

    IF NULLIF(LTRIM(RTRIM(@BodyHtml)), N'') IS NULL
    BEGIN
        THROW 50071, 'Blog text is required.', 1;
    END;

    IF @BlogId = 0
    BEGIN
        INSERT INTO [pmt].[Blogs]
        (
            [ProjectId],
            [Title],
            [BodyHtml],
            [CreatedByUserId],
            [CreatedAt],
            [UpdatedAt]
        )
        VALUES
        (
            @ProjectId,
            @Title,
            @BodyHtml,
            @CurrentUserId,
            @Now,
            @Now
        );

        SET @BlogId = SCOPE_IDENTITY();
        SET @Action = N'Created';
    END
    ELSE
    BEGIN
        SELECT @OwnerUserId = [CreatedByUserId]
        FROM [pmt].[Blogs]
        WHERE [BlogId] = @BlogId
          AND [IsDeleted] = 0;

        IF @OwnerUserId IS NULL
        BEGIN
            THROW 50072, 'Blog was not found.', 1;
        END;

        IF [pmt].[CanEdit](@OwnerUserId, @CurrentUserId) = 0
        BEGIN
            THROW 50073, 'You cannot edit this blog.', 1;
        END;

        UPDATE [pmt].[Blogs]
        SET
            [ProjectId] = @ProjectId,
            [Title] = @Title,
            [BodyHtml] = @BodyHtml,
            [UpdatedByUserId] = @CurrentUserId,
            [UpdatedAt] = @Now
        WHERE [BlogId] = @BlogId;

        SET @Action = N'Updated';
    END;

    INSERT INTO [pmt].[BlogHistory] ([BlogId], [Action], [UserId], [CreatedByUserId], [CreatedAt])
    VALUES (@BlogId, @Action, @CurrentUserId, @CurrentUserId, @Now);

    EXEC [pmt].[WriteAudit] N'Blog', @BlogId, @Action, @Title, @CurrentUserId;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[DeleteBlog]
    @BlogId INT,
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @OwnerUserId INT;

    SELECT @OwnerUserId = [CreatedByUserId]
    FROM [pmt].[Blogs]
    WHERE [BlogId] = @BlogId
      AND [IsDeleted] = 0;

    IF @OwnerUserId IS NULL
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

    INSERT INTO [pmt].[BlogHistory] ([BlogId], [Action], [UserId], [CreatedByUserId])
    VALUES (@BlogId, N'Deleted', @CurrentUserId, @CurrentUserId);

    EXEC [pmt].[WriteAudit] N'Blog', @BlogId, N'Deleted', N'Blog hidden from active views.', @CurrentUserId;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[AddTaskAttachment]
    @AttachmentId INT OUTPUT,
    @TaskId INT,
    @FileName NVARCHAR(260),
    @Url NVARCHAR(500),
    @ContentType NVARCHAR(160),
    @ByteLength BIGINT,
    @CurrentUserId INT
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

    IF [pmt].[CanEditTaskType](@TaskType, @CurrentUserId) = 0
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

    DECLARE @OwnerUserId INT;

    SELECT @OwnerUserId = [CreatedByUserId]
    FROM [pmt].[Blogs]
    WHERE [BlogId] = @BlogId
      AND [IsDeleted] = 0;

    IF @OwnerUserId IS NULL
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

    UPDATE [pmt].[Sprints]
    SET [IsDeleted] = 1,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [SprintId] = @SprintId;

    EXEC [pmt].[WriteAudit] N'Sprint', @SprintId, N'Deleted', N'Sprint hidden and tasks moved out of sprint.', @CurrentUserId;
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
       OR (@ClearPmtOnly = 0 AND (@PmtProjectId IS NULL OR [ProjectId] <> @PmtProjectId));

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
    WHERE [ProjectId] IN (SELECT [ProjectId] FROM @ProjectIds);

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

    DELETE FROM [pmt].[DevLogs]
    WHERE [ProjectId] IN (SELECT [ProjectId] FROM @ProjectIds);

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
        CASE WHEN @ClearPmtOnly = 1 THEN N'Cleared PMT project data.' ELSE N'Cleared non-PMT project data.' END;

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

    UPDATE [pmt].[Users]
    SET
        [FirstName] = N'Louiery',
        [LastName] = N'Sincioco',
        [Nickname] = N'Sin',
        [Email] = N'louiery@gmail.com',
        [AvatarUrl] = N'/assets/avatar-sin.png',
        [PasswordHash] = HASHBYTES('SHA2_256', CONVERT(NVARCHAR(4000), N'Password1')),
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
