/*
    PMT Database Version 1.19 -> 1.20

    Makes the exact known PMT, LMS, and HLS seed Documentation records public
    without changing other private Documentation. It also performs the one-time
    repair of legacy PMT Sprint and work-item codes and keeps Project child codes
    synchronized transactionally on future Project-code changes.
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
   OR OBJECT_ID(N'[pmt].[Sprints]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[WorkTasks]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[Blogs]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[LockWorkTaskWrites]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[LockSprintWrites]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[UpsertProject]', N'P') IS NULL
BEGIN
    THROW 51045, 'PMT Database Version 1.19 objects are required before applying Version 1.20.', 1;
END;
GO

DECLARE @DatabaseVersion NVARCHAR(20) =
(
    SELECT CONVERT(NVARCHAR(20), [value])
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_DatabaseVersion'
);

IF ISNULL(@DatabaseVersion, N'') NOT IN (N'1.19', N'1.20')
BEGIN
    THROW 51046, 'PMT Database Version 1.19 is required before applying Version 1.20.', 1;
END;

IF @DatabaseVersion = N'1.20'
   AND
   (
       OBJECT_ID(N'[pmt].[SynchronizeProjectCode]', N'P') IS NULL
       OR ISNULL(CHARINDEX(N'SynchronizeProjectCode', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[UpsertProject]'))), 0) = 0
   )
BEGIN
    THROW 51047, 'PMT Database Version 1.20 is recorded, but its Project-code synchronization contract is incomplete. Investigate before continuing.', 1;
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

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @DatabaseVersion NVARCHAR(20) =
    (
        SELECT CONVERT(NVARCHAR(20), [value])
        FROM sys.extended_properties
        WHERE [class] = 0
          AND [name] = N'PMT_DatabaseVersion'
    );

    IF @DatabaseVersion = N'1.19'
    BEGIN
        DECLARE @SeedDocumentation TABLE
        (
            [Title] NVARCHAR(220) NOT NULL PRIMARY KEY,
            [BodyMarker] NVARCHAR(200) NOT NULL
        );

        INSERT INTO @SeedDocumentation ([Title], [BodyMarker])
        VALUES
        (N'PMT Day 1 - Foundation Build and ADO.NET Decision', N'/assets/docs/pmt-doc-day01-v2.jpg'),
        (N'PMT Day 2 - Dark Theme and Kanban Workflow', N'/assets/docs/pmt-doc-day02-v2.jpg'),
        (N'PMT Day 3 - Filters, Scrum, and Documentation', N'/assets/docs/pmt-doc-day03-v2.jpg'),
        (N'PMT Day 4 - Holidays, Gantt, and Road Map', N'/assets/docs/pmt-doc-day04-v2.jpg'),
        (N'PMT Day 5 - Audit Trails and Seed Expansion', N'/assets/docs/pmt-doc-day05-v2.jpg'),
        (N'PMT Day 6 - Gantt Fly-by and Road Map Optimization', N'/assets/docs/pmt-doc-day06-v2.jpg'),
        (N'PMT Day 7 - Navigation and Sprint Metrics', N'/assets/docs/pmt-doc-day07-v2.jpg'),
        (N'PMT Day 8 - Documentation Card Cleanup', N'/assets/docs/pmt-doc-day08-v2.jpg'),
        (N'PMT Reorder Design Note', N'/assets/docs/pmt-doc-reorder-v2.jpg'),
        (N'PMT Current Demo Readiness', N'/assets/docs/pmt-doc-demo-v2.jpg'),
        (N'PMT About 3D Visualization and Flyby', N'/assets/docs/pmt-doc-about-3d-flyby-v2.jpg'),
        (N'LMS Course Catalog Release Notes', N'/assets/docs/lms-course-catalog-v2.jpg'),
        (N'LMS Computer Lab Rollout Checklist', N'/assets/docs/lms-computer-lab-v2.jpg'),
        (N'HLS AI Recommendation Design Notes', N'/assets/docs/hls-ai-recommendations.jpg'),
        (N'HLS Waterfall Phase Gate Checklist', N'/assets/docs/hls-phase-gate.jpg');

        UPDATE [Blog]
        SET [IsPrivate] = 0
        FROM [pmt].[Blogs] AS [Blog]
        INNER JOIN @SeedDocumentation AS [Seed]
            ON [Seed].[Title] = [Blog].[Title]
           AND CHARINDEX([Seed].[BodyMarker], ISNULL([Blog].[BodyHtml], N'')) > 0
        WHERE [Blog].[IsPrivate] = 1;

        IF EXISTS
        (
            SELECT 1
            FROM [pmt].[Blogs] AS [Blog]
            INNER JOIN @SeedDocumentation AS [Seed]
                ON [Seed].[Title] = [Blog].[Title]
               AND CHARINDEX([Seed].[BodyMarker], ISNULL([Blog].[BodyHtml], N'')) > 0
            WHERE [Blog].[IsPrivate] <> 0
        )
        BEGIN
            THROW 51048, 'One or more known seed Documentation records could not be made public.', 1;
        END;

        EXEC [pmt].[LockWorkTaskWrites];
        EXEC [pmt].[LockSprintWrites];

        /*
            One-time BDO repair for child rows left behind by the former random
            Project-code behavior. ProjectId is authoritative. Only incorrect
            codes under the PMT Project are changed; IDs, relationships, content,
            and already-correct PMT codes are preserved.

            Each target begins with PMT-, while each repaired source does not.
            A checked row-by-row update is therefore enough to avoid code swaps.
            When a legacy suffix is already used, the row receives the next
            available standard PMT Sprint, Task, or Bug number.
        */
        DECLARE @PmtProjectId INT =
        (
            SELECT [ProjectId]
            FROM [pmt].[Projects]
            WHERE [Code] = N'PMT'
        );

        IF @PmtProjectId IS NULL
        BEGIN
            THROW 51059, 'The PMT Project is required for the one-time production child-code repair.', 1;
        END;

        BEGIN
            DECLARE @PmtSprintCountBefore BIGINT =
            (
                SELECT COUNT_BIG(*)
                FROM [pmt].[Sprints]
                WHERE [ProjectId] = @PmtProjectId
            );
            DECLARE @PmtTaskCountBefore BIGINT =
            (
                SELECT COUNT_BIG(*)
                FROM [pmt].[WorkTasks]
                WHERE [ProjectId] = @PmtProjectId
            );

            DECLARE @PmtCodeRepair TABLE
            (
                [EntityType] NVARCHAR(20) NOT NULL,
                [EntityId] INT NOT NULL,
                [OldCode] NVARCHAR(40) NOT NULL,
                [NewCode] NVARCHAR(40) NOT NULL,
                [Resolution] NVARCHAR(80) NOT NULL,
                PRIMARY KEY ([EntityType], [EntityId])
            );

            DECLARE @RepairSprintId INT;
            DECLARE @RepairOldCode NVARCHAR(40);
            DECLARE @RepairCode NVARCHAR(100);
            DECLARE @RepairResolution NVARCHAR(80);
            DECLARE @RepairNumber INT;

            DECLARE [PmtSprintRepairCursor] CURSOR LOCAL STATIC READ_ONLY FOR
                SELECT
                    [Sprint].[SprintId],
                    [Sprint].[Code],
                    N'PMT'
                    + CASE
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
                WHERE [Sprint].[ProjectId] = @PmtProjectId
                  AND LEFT([Sprint].[Code], 4) <> N'PMT-'
                ORDER BY [Sprint].[SprintId];

            OPEN [PmtSprintRepairCursor];
            FETCH NEXT FROM [PmtSprintRepairCursor]
                INTO @RepairSprintId, @RepairOldCode, @RepairCode;

            WHILE @@FETCH_STATUS = 0
            BEGIN
                SET @RepairResolution = N'Corrected legacy Project prefix';

                IF LEN(@RepairCode) > 40
                   OR EXISTS
                   (
                       SELECT 1
                       FROM [pmt].[Sprints]
                       WHERE [Code] = @RepairCode
                         AND [SprintId] <> @RepairSprintId
                   )
                BEGIN
                    SELECT @RepairNumber = CONVERT(INT, COUNT_BIG(*)) + 1
                    FROM [pmt].[Sprints]
                    WHERE [ProjectId] = @PmtProjectId;

                    SET @RepairCode = N'PMT-Sprint' + CONVERT(NVARCHAR(12), @RepairNumber);

                    WHILE EXISTS (SELECT 1 FROM [pmt].[Sprints] WHERE [Code] = @RepairCode)
                    BEGIN
                        SET @RepairNumber += 1;
                        SET @RepairCode = N'PMT-Sprint' + CONVERT(NVARCHAR(12), @RepairNumber);
                    END;

                    SET @RepairResolution = N'Renumbered legacy suffix collision';
                END;

                UPDATE [pmt].[Sprints]
                SET [Code] = CONVERT(NVARCHAR(40), @RepairCode)
                WHERE [SprintId] = @RepairSprintId;

                INSERT INTO @PmtCodeRepair
                (
                    [EntityType], [EntityId], [OldCode], [NewCode], [Resolution]
                )
                VALUES
                (
                    N'Sprint', @RepairSprintId, @RepairOldCode,
                    CONVERT(NVARCHAR(40), @RepairCode), @RepairResolution
                );

                FETCH NEXT FROM [PmtSprintRepairCursor]
                    INTO @RepairSprintId, @RepairOldCode, @RepairCode;
            END;

            CLOSE [PmtSprintRepairCursor];
            DEALLOCATE [PmtSprintRepairCursor];

            DECLARE @RepairTaskId INT;
            DECLARE @RepairTaskType NVARCHAR(20);

            DECLARE [PmtTaskRepairCursor] CURSOR LOCAL STATIC READ_ONLY FOR
                SELECT
                    [Task].[TaskId],
                    [Task].[TaskType],
                    [Task].[Code],
                    N'PMT'
                    + CASE
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
                WHERE [Task].[ProjectId] = @PmtProjectId
                  AND LEFT([Task].[Code], 4) <> N'PMT-'
                ORDER BY [Task].[TaskId];

            OPEN [PmtTaskRepairCursor];
            FETCH NEXT FROM [PmtTaskRepairCursor]
                INTO @RepairTaskId, @RepairTaskType, @RepairOldCode, @RepairCode;

            WHILE @@FETCH_STATUS = 0
            BEGIN
                SET @RepairResolution = N'Corrected legacy Project prefix';

                IF LEN(@RepairCode) > 40
                   OR EXISTS
                   (
                       SELECT 1
                       FROM [pmt].[WorkTasks]
                       WHERE [Code] = @RepairCode
                         AND [TaskId] <> @RepairTaskId
                   )
                BEGIN
                    SELECT @RepairNumber = CONVERT(INT, COUNT_BIG(*)) + 1
                    FROM [pmt].[WorkTasks]
                    WHERE [ProjectId] = @PmtProjectId
                      AND [TaskType] = @RepairTaskType;

                    SET @RepairCode =
                        N'PMT-'
                        + CASE WHEN @RepairTaskType = N'Bug' THEN N'Bug' ELSE N'Task' END
                        + CONVERT(NVARCHAR(12), @RepairNumber);

                    WHILE EXISTS (SELECT 1 FROM [pmt].[WorkTasks] WHERE [Code] = @RepairCode)
                    BEGIN
                        SET @RepairNumber += 1;
                        SET @RepairCode =
                            N'PMT-'
                            + CASE WHEN @RepairTaskType = N'Bug' THEN N'Bug' ELSE N'Task' END
                            + CONVERT(NVARCHAR(12), @RepairNumber);
                    END;

                    SET @RepairResolution = N'Renumbered legacy suffix collision';
                END;

                UPDATE [pmt].[WorkTasks]
                SET [Code] = CONVERT(NVARCHAR(40), @RepairCode)
                WHERE [TaskId] = @RepairTaskId;

                INSERT INTO @PmtCodeRepair
                (
                    [EntityType], [EntityId], [OldCode], [NewCode], [Resolution]
                )
                VALUES
                (
                    CASE WHEN @RepairTaskType = N'Bug' THEN N'Bug' ELSE N'Dev Task' END,
                    @RepairTaskId,
                    @RepairOldCode,
                    CONVERT(NVARCHAR(40), @RepairCode),
                    @RepairResolution
                );

                FETCH NEXT FROM [PmtTaskRepairCursor]
                    INTO @RepairTaskId, @RepairTaskType, @RepairOldCode, @RepairCode;
            END;

            CLOSE [PmtTaskRepairCursor];
            DEALLOCATE [PmtTaskRepairCursor];

            IF @PmtSprintCountBefore <>
               (
                   SELECT COUNT_BIG(*)
                   FROM [pmt].[Sprints]
                   WHERE [ProjectId] = @PmtProjectId
               )
               OR @PmtTaskCountBefore <>
               (
                   SELECT COUNT_BIG(*)
                   FROM [pmt].[WorkTasks]
                   WHERE [ProjectId] = @PmtProjectId
               )
               OR EXISTS
               (
                   SELECT 1
                   FROM [pmt].[Sprints]
                   WHERE [ProjectId] = @PmtProjectId
                     AND LEFT([Code], 4) <> N'PMT-'
               )
               OR EXISTS
               (
                   SELECT 1
                   FROM [pmt].[WorkTasks]
                   WHERE [ProjectId] = @PmtProjectId
                     AND LEFT([Code], 4) <> N'PMT-'
               )
            BEGIN
                THROW 51049, 'The one-time PMT Sprint and Task code repair could not be verified.', 1;
            END;

            DECLARE @PmtSprintRepairCount INT =
            (
                SELECT COUNT(*)
                FROM @PmtCodeRepair
                WHERE [EntityType] = N'Sprint'
            );
            DECLARE @PmtTaskRepairCount INT =
            (
                SELECT COUNT(*)
                FROM @PmtCodeRepair
                WHERE [EntityType] <> N'Sprint'
            );

            PRINT N'One-time PMT code repair completed: '
                + CONVERT(NVARCHAR(12), @PmtSprintRepairCount)
                + N' Sprint code(s), '
                + CONVERT(NVARCHAR(12), @PmtTaskRepairCount)
                + N' Task/Bug code(s).';

            SELECT [EntityType], [EntityId], [OldCode], [NewCode], [Resolution]
            FROM @PmtCodeRepair
            ORDER BY [EntityType], [EntityId];
        END;

        DECLARE @ProjectId INT;
        DECLARE @ProjectCode NVARCHAR(5);

        DECLARE [ProjectCodeCursor] CURSOR LOCAL FAST_FORWARD FOR
            SELECT [ProjectId], [Code]
            FROM [pmt].[Projects]
            WHERE [ProjectId] = @PmtProjectId
            ORDER BY [ProjectId];

        OPEN [ProjectCodeCursor];
        FETCH NEXT FROM [ProjectCodeCursor] INTO @ProjectId, @ProjectCode;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            EXEC [pmt].[SynchronizeProjectCode]
                @ProjectId = @ProjectId,
                @PreviousProjectCode = @ProjectCode,
                @ProjectCode = @ProjectCode;

            FETCH NEXT FROM [ProjectCodeCursor] INTO @ProjectId, @ProjectCode;
        END;

        CLOSE [ProjectCodeCursor];
        DEALLOCATE [ProjectCodeCursor];

        IF EXISTS
        (
            SELECT 1
            FROM [pmt].[Sprints] AS [Sprint]
            INNER JOIN [pmt].[Projects] AS [Project]
                ON [Project].[ProjectId] = [Sprint].[ProjectId]
            WHERE [Project].[ProjectId] = @PmtProjectId
              AND LEFT([Sprint].[Code], LEN([Project].[Code]) + 1) <> [Project].[Code] + N'-'
        )
           OR EXISTS
        (
            SELECT 1
            FROM [pmt].[WorkTasks] AS [Task]
            INNER JOIN [pmt].[Projects] AS [Project]
                ON [Project].[ProjectId] = [Task].[ProjectId]
            WHERE [Project].[ProjectId] = @PmtProjectId
              AND LEFT([Task].[Code], LEN([Project].[Code]) + 1) <> [Project].[Code] + N'-'
        )
        BEGIN
            THROW 51049, 'One or more Sprint or Task codes do not match their Project after synchronization.', 1;
        END;

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
                @value = N'1.20';
        END
        ELSE
        BEGIN
            EXEC sys.sp_addextendedproperty
                @name = N'PMT_DatabaseVersion',
                @value = N'1.20';
        END;
    END;

    IF OBJECT_ID(N'[pmt].[SynchronizeProjectCode]', N'P') IS NULL
       OR ISNULL(CHARINDEX(N'SynchronizeProjectCode', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[UpsertProject]'))), 0) = 0
       OR NOT EXISTS
          (
              SELECT 1
              FROM sys.extended_properties
              WHERE [class] = 0
                AND [name] = N'PMT_DatabaseVersion'
                AND CONVERT(NVARCHAR(20), [value]) = N'1.20'
          )
    BEGIN
        THROW 51050, 'PMT Version 1.20 seed-visibility and Project-code synchronization contract could not be verified.', 1;
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF CURSOR_STATUS('local', 'PmtSprintRepairCursor') >= 0
    BEGIN
        CLOSE [PmtSprintRepairCursor];
    END;

    IF CURSOR_STATUS('local', 'PmtSprintRepairCursor') > -3
    BEGIN
        DEALLOCATE [PmtSprintRepairCursor];
    END;

    IF CURSOR_STATUS('local', 'PmtTaskRepairCursor') >= 0
    BEGIN
        CLOSE [PmtTaskRepairCursor];
    END;

    IF CURSOR_STATUS('local', 'PmtTaskRepairCursor') > -3
    BEGIN
        DEALLOCATE [PmtTaskRepairCursor];
    END;

    IF CURSOR_STATUS('local', 'ProjectCodeCursor') >= 0
    BEGIN
        CLOSE [ProjectCodeCursor];
    END;

    IF CURSOR_STATUS('local', 'ProjectCodeCursor') > -3
    BEGIN
        DEALLOCATE [ProjectCodeCursor];
    END;

    IF XACT_STATE() <> 0
    BEGIN
        ROLLBACK TRANSACTION;
    END;

    THROW;
END CATCH;
GO

PRINT N'PMT Database Version 1.20 applied: known seed Documentation is public and Project-code changes synchronize Sprint and Task prefixes.';
GO
