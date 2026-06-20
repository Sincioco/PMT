/*
    HLS project seed data.

    HLS stands for Hybrid Learning System. It is modeled as a long-running,
    waterfall-style AI and Learning project:
    - 3 to 4 month phases spanning five years and still ongoing
    - Earlier phases are busier; the current phase has only a few tasks
    - Every phase has at least one parent task with sub-tasks
    - Every phase has bugs with linked Bug Fix tasks and audit history
    - Scrum entries skip weekends and known Philippine holidays
*/

USE [PMT];
GO

SET NOCOUNT ON;
SET DATEFIRST 7;

DECLARE @Today DATE = CONVERT(DATE, SYSDATETIME());
DECLARE @Now DATETIME2(0) = SYSDATETIME();
DECLARE @Sin INT = (SELECT [UserId] FROM [pmt].[Users] WHERE [Nickname] = N'Sin');
DECLARE @Bill INT = (SELECT [UserId] FROM [pmt].[Users] WHERE [Nickname] = N'Bill Gates');
DECLARE @Sam INT = (SELECT [UserId] FROM [pmt].[Users] WHERE [Nickname] = N'Sam Altman');
DECLARE @Mark INT = (SELECT [UserId] FROM [pmt].[Users] WHERE [Nickname] = N'Mark Zuckerberg');
DECLARE @Steve INT = (SELECT [UserId] FROM [pmt].[Users] WHERE [Nickname] = N'Steve Jobs');
DECLARE @Lisa INT = (SELECT [UserId] FROM [pmt].[Users] WHERE [Nickname] = N'Lisa Su');

DECLARE @HlsStart DATE = DATEFROMPARTS(YEAR(DATEADD(YEAR, -5, @Today)), MONTH(@Today), 1);

INSERT INTO [pmt].[Projects] ([Code], [Title], [Description], [Url], [IconUrl], [StartDate], [EndDate], [CreatedByUserId])
VALUES
(N'HLS', N'Hybrid Learning System', N'AI learning platform blending classroom delivery, remote learning, recommendations, and analytics.', N'https://intranet.local/projects/hls', N'/assets/project-hls.svg', @HlsStart, NULL, @Sin);

DECLARE @HlsProject INT = (SELECT [ProjectId] FROM [pmt].[Projects] WHERE [Code] = N'HLS');

INSERT INTO [pmt].[ProjectMembers] ([ProjectId], [UserId], [CreatedByUserId])
VALUES
(@HlsProject, @Sin, @Sin), (@HlsProject, @Bill, @Sin), (@HlsProject, @Sam, @Sin),
(@HlsProject, @Mark, @Sin), (@HlsProject, @Steve, @Sin), (@HlsProject, @Lisa, @Sin);

DECLARE @PhaseNumber INT = 1;
DECLARE @PhaseStart DATE = @HlsStart;
DECLARE @TaskCounter INT = 1;
DECLARE @BugCounter INT = 1;

WHILE @PhaseStart <= @Today
BEGIN
    DECLARE @MonthsInPhase INT = CASE WHEN @PhaseNumber % 2 = 1 THEN 4 ELSE 3 END;
    DECLARE @PhaseEnd DATE = DATEADD(DAY, -1, DATEADD(MONTH, @MonthsInPhase, @PhaseStart));
    DECLARE @IsFinished BIT = CASE WHEN @PhaseEnd < @Today THEN 1 ELSE 0 END;
    DECLARE @IsCurrent BIT = CASE WHEN @PhaseStart <= @Today AND @PhaseEnd >= @Today THEN 1 ELSE 0 END;
    DECLARE @PhaseCode NVARCHAR(40) = N'HLS-Phase-' + RIGHT(N'00' + CONVERT(NVARCHAR(12), @PhaseNumber), 2);
    DECLARE @PhaseTitle NVARCHAR(160) = CASE
        WHEN @PhaseNumber <= 3 THEN N'Foundation Platform Build'
        WHEN @PhaseNumber <= 6 THEN N'AI Recommendation Engine'
        WHEN @PhaseNumber <= 9 THEN N'Learning Analytics Expansion'
        WHEN @PhaseNumber <= 12 THEN N'Hybrid Classroom Rollout'
        ELSE N'Optimization and Support'
    END + N' ' + RIGHT(N'00' + CONVERT(NVARCHAR(12), @PhaseNumber), 2);

    INSERT INTO [pmt].[Sprints]
    (
        [ProjectId], [Code], [Title], [Description], [StartDate], [EndDate],
        [LessonLearnedHtml], [IsFinished], [CreatedByUserId]
    )
    VALUES
    (
        @HlsProject,
        @PhaseCode,
        @PhaseTitle,
        N'Waterfall-style HLS phase for AI-assisted learning capabilities.',
        @PhaseStart,
        @PhaseEnd,
        CASE WHEN @IsFinished = 1 THEN N'<p>Long phases need milestone-level QA gates and explicit bug-fix retest notes.</p>' ELSE N'' END,
        @IsFinished,
        @Sin
    );

    DECLARE @SprintId INT = SCOPE_IDENTITY();

    INSERT INTO [pmt].[SprintMembers] ([SprintId], [UserId], [CreatedByUserId])
    VALUES
    (@SprintId, @Bill, @Sin), (@SprintId, @Sam, @Sin), (@SprintId, @Mark, @Sin),
    (@SprintId, @Steve, @Sin), (@SprintId, @Lisa, @Sin);

    DECLARE @DeveloperId INT = CASE @PhaseNumber % 4 WHEN 0 THEN @Bill WHEN 1 THEN @Lisa WHEN 2 THEN @Mark ELSE @Steve END;
    DECLARE @FeatureCount INT = CASE
        WHEN @PhaseNumber <= 3 THEN 17
        WHEN @PhaseNumber <= 6 THEN 13
        WHEN @PhaseNumber <= 9 THEN 9
        WHEN @PhaseNumber <= 12 THEN 6
        WHEN @PhaseNumber <= 15 THEN 4
        ELSE 1
    END;
    DECLARE @BugCount INT = CASE
        WHEN @PhaseNumber <= 3 THEN 5
        WHEN @PhaseNumber <= 6 THEN 4
        WHEN @PhaseNumber <= 10 THEN 3
        WHEN @PhaseNumber <= 14 THEN 2
        ELSE 1
    END;

    DECLARE @ParentCode NVARCHAR(40) = N'HLS-TASK-' + RIGHT(N'0000' + CONVERT(NVARCHAR(12), @TaskCounter), 4);
    DECLARE @ParentStatus NVARCHAR(40) = CASE WHEN @IsFinished = 1 THEN N'Deployed in Prod' WHEN @IsCurrent = 1 THEN N'Deployed in UAT' ELSE N'In Progress' END;
    DECLARE @ParentPercent INT = CASE WHEN @IsFinished = 1 OR @IsCurrent = 1 THEN 100 ELSE 55 END;

    INSERT INTO [pmt].[WorkTasks]
    (
        [ProjectId], [SprintId], [ParentTaskId], [TaskType], [Code], [Title], [DescriptionHtml],
        [Status], [Priority], [PercentCompleted], [Url], [StartDate], [EndDate], [StartedAt],
        [CreatedByUserId], [CreatedAt], [UpdatedAt]
    )
    VALUES
    (
        @HlsProject, @SprintId, NULL, N'Dev', @ParentCode,
        N'Deliver HLS phase milestone ' + CONVERT(NVARCHAR(12), @PhaseNumber),
        N'<p>Parent milestone for AI learning, hybrid classroom, and analytics deliverables.</p>',
        @ParentStatus, N'High', @ParentPercent, N'https://intranet.local/hls/tasks/' + CONVERT(NVARCHAR(12), @TaskCounter),
        @PhaseStart, @PhaseEnd, @PhaseStart, @Sin, @PhaseStart, @PhaseEnd
    );

    DECLARE @ParentTaskId INT = SCOPE_IDENTITY();
    INSERT INTO [pmt].[TaskAssignees] ([TaskId], [UserId], [CreatedByUserId]) VALUES (@ParentTaskId, @DeveloperId, @Sin);
    SET @TaskCounter += 1;

    DECLARE @SubIndex INT = 1;
    WHILE @SubIndex <= 2
    BEGIN
        DECLARE @SubCode NVARCHAR(40) = N'HLS-TASK-' + RIGHT(N'0000' + CONVERT(NVARCHAR(12), @TaskCounter), 4);
        DECLARE @SubStatus NVARCHAR(40) = CASE
            WHEN @IsFinished = 1 THEN N'Deployed in Prod'
            WHEN @IsCurrent = 1 AND @SubIndex = 1 THEN N'Deployed in Prod'
            WHEN @IsCurrent = 1 THEN N'Deployed in UAT'
            WHEN @SubIndex = 1 THEN N'Ready for QA'
            ELSE N'In Progress'
        END;
        DECLARE @SubPercent INT = CASE WHEN @IsFinished = 1 OR @IsCurrent = 1 THEN 100 WHEN @SubIndex = 1 THEN 80 ELSE 30 END;
        DECLARE @SubStart DATE = DATEADD(DAY, (@SubIndex - 1) * 21, @PhaseStart);
        DECLARE @SubEnd DATE = CASE WHEN DATEADD(DAY, 41, @SubStart) > @PhaseEnd THEN @PhaseEnd ELSE DATEADD(DAY, 41, @SubStart) END;

        INSERT INTO [pmt].[WorkTasks]
        (
            [ProjectId], [SprintId], [ParentTaskId], [TaskType], [Code], [Title], [DescriptionHtml],
            [Status], [Priority], [PercentCompleted], [Url], [StartDate], [EndDate], [StartedAt],
            [CreatedByUserId], [CreatedAt], [UpdatedAt]
        )
        VALUES
        (
            @HlsProject, @SprintId, @ParentTaskId, N'Dev', @SubCode,
            CASE @SubIndex WHEN 1 THEN N'Build AI learning service milestone ' ELSE N'Integrate hybrid classroom milestone ' END + CONVERT(NVARCHAR(12), @PhaseNumber),
            N'<p>Sub-task under the phase milestone. Work spans several weeks.</p>',
            @SubStatus, N'High', @SubPercent, N'https://intranet.local/hls/tasks/' + CONVERT(NVARCHAR(12), @TaskCounter),
            @SubStart, @SubEnd, @SubStart, @Sin, @SubStart, @SubEnd
        );

        DECLARE @SubTaskId INT = SCOPE_IDENTITY();
        INSERT INTO [pmt].[TaskAssignees] ([TaskId], [UserId], [CreatedByUserId]) VALUES (@SubTaskId, @DeveloperId, @Sin);

        SET @SubIndex += 1;
        SET @TaskCounter += 1;
    END;

    DECLARE @FeatureIndex INT = 1;
    WHILE @FeatureIndex <= @FeatureCount
    BEGIN
        DECLARE @FeatureCode NVARCHAR(40) = N'HLS-TASK-' + RIGHT(N'0000' + CONVERT(NVARCHAR(12), @TaskCounter), 4);
        DECLARE @PhaseDays INT = DATEDIFF(DAY, @PhaseStart, @PhaseEnd) + 1;
        DECLARE @StartOffset INT = ((@FeatureIndex - 1) * 7) % CASE WHEN @PhaseDays > 28 THEN @PhaseDays - 28 ELSE 1 END;
        DECLARE @FeatureStart DATE = DATEADD(DAY, @StartOffset, @PhaseStart);
        DECLARE @FeatureEnd DATE = DATEADD(DAY, 13 + ((@FeatureIndex + @PhaseNumber) % 7) * 7, @FeatureStart);
        IF @FeatureEnd > @PhaseEnd SET @FeatureEnd = @PhaseEnd;

        DECLARE @FeatureStatus NVARCHAR(40) = CASE
            WHEN @IsFinished = 1 THEN N'Deployed in Prod'
            WHEN @IsCurrent = 1 AND @FeatureIndex = 1 THEN N'Deployed in UAT'
            WHEN @IsCurrent = 1 AND @FeatureIndex = 2 THEN N'In Progress'
            WHEN @FeatureIndex = 1 THEN N'In Progress'
            ELSE N'Todo'
        END;
        DECLARE @FeaturePercent INT = CASE
            WHEN @FeatureStatus IN (N'QA Passed', N'Deployed in UAT', N'Deployed in Prod') THEN 100
            WHEN @FeatureStatus = N'In Progress' THEN 35
            ELSE 0
        END;
        DECLARE @FeatureDeveloperId INT = CASE (@FeatureIndex + @PhaseNumber) % 4 WHEN 0 THEN @Bill WHEN 1 THEN @Mark WHEN 2 THEN @Lisa ELSE @Steve END;

        INSERT INTO [pmt].[WorkTasks]
        (
            [ProjectId], [SprintId], [ParentTaskId], [TaskType], [Code], [Title], [DescriptionHtml],
            [Status], [Priority], [PercentCompleted], [Url], [StartDate], [EndDate], [StartedAt],
            [CreatedByUserId], [CreatedAt], [UpdatedAt]
        )
        VALUES
        (
            @HlsProject, @SprintId, NULL, N'Dev', @FeatureCode,
            CASE @FeatureIndex % 6
                WHEN 0 THEN N'Create adaptive lesson recommendation batch'
                WHEN 1 THEN N'Build AI tutor prompt review workflow'
                WHEN 2 THEN N'Improve hybrid attendance capture'
                WHEN 3 THEN N'Add learning analytics aggregation'
                WHEN 4 THEN N'Integrate classroom device telemetry'
                ELSE N'Create instructor intervention dashboard'
            END,
            N'<p>Waterfall phase task for the HLS AI and Learning roadmap.</p>',
            @FeatureStatus, CASE WHEN @FeatureIndex <= 4 THEN N'High' ELSE N'Medium' END, @FeaturePercent,
            N'https://intranet.local/hls/tasks/' + CONVERT(NVARCHAR(12), @TaskCounter),
            @FeatureStart, @FeatureEnd,
            CASE WHEN @FeatureStatus = N'Todo' THEN NULL ELSE @FeatureStart END,
            @Sin, @FeatureStart, @FeatureEnd
        );

        INSERT INTO [pmt].[TaskAssignees] ([TaskId], [UserId], [CreatedByUserId])
        VALUES (SCOPE_IDENTITY(), @FeatureDeveloperId, @Sin);

        SET @FeatureIndex += 1;
        SET @TaskCounter += 1;
    END;

    DECLARE @BugIndex INT = 1;
    WHILE @BugIndex <= @BugCount
    BEGIN
        DECLARE @BugCode NVARCHAR(40) = N'HLS-BUG-' + RIGHT(N'0000' + CONVERT(NVARCHAR(12), @BugCounter), 4);
        DECLARE @BugTitle NVARCHAR(220) = CASE @BugIndex % 5
            WHEN 0 THEN N'AI recommendation shows archived lesson'
            WHEN 1 THEN N'Hybrid attendance sync skips late joiners'
            WHEN 2 THEN N'Instructor analytics chart misses remote learners'
            WHEN 3 THEN N'AI tutor transcript search returns stale results'
            ELSE N'Classroom device heartbeat creates duplicate events'
        END;
        DECLARE @BugStart DATE = DATEADD(DAY, 14 + (@BugIndex * 7), @PhaseStart);
        IF @BugStart > @PhaseEnd SET @BugStart = DATEADD(DAY, -14, @PhaseEnd);
        DECLARE @BugEnd DATE = CASE WHEN DATEADD(DAY, 10, @BugStart) > @PhaseEnd THEN @PhaseEnd ELSE DATEADD(DAY, 10, @BugStart) END;
        DECLARE @BugDeveloperId INT = CASE (@BugIndex + @PhaseNumber) % 4 WHEN 0 THEN @Bill WHEN 1 THEN @Lisa WHEN 2 THEN @Mark ELSE @Steve END;
        DECLARE @BugStatus NVARCHAR(40) = CASE WHEN @IsFinished = 1 THEN N'Deployed in Prod' WHEN @IsCurrent = 1 THEN N'Deployed in UAT' ELSE N'QA Passed' END;

        INSERT INTO [pmt].[WorkTasks]
        (
            [ProjectId], [SprintId], [ParentTaskId], [TaskType], [Code], [Title], [DescriptionHtml],
            [StepsToReproduceHtml], [ActualResultHtml], [ExpectedResultHtml], [Environment], [Severity],
            [Status], [Priority], [PercentCompleted], [Url], [StartDate], [EndDate], [StartedAt],
            [CreatedByUserId], [CreatedAt], [UpdatedAt]
        )
        VALUES
        (
            @HlsProject, @SprintId, NULL, N'Bug', @BugCode, @BugTitle,
            N'<p>QA found a defect during HLS phase validation.</p>',
            N'<ol><li>Open the HLS validation tenant.</li><li>Run the phase acceptance script.</li><li>Review the AI or classroom result.</li></ol>',
            N'<p>The result is inconsistent with the validated learning rule.</p>',
            N'<p>The result should match the approved learning rule and be repeatable.</p>',
            N'UAT', CASE WHEN @PhaseNumber <= 5 THEN N'Critical' ELSE N'Major' END,
            @BugStatus, N'High', 100, N'https://intranet.local/hls/bugs/' + CONVERT(NVARCHAR(12), @BugCounter),
            @BugStart, @BugEnd, @BugStart, @Sin, @BugStart, @BugEnd
        );

        DECLARE @BugTaskId INT = SCOPE_IDENTITY();

        INSERT INTO [pmt].[TaskReporters] ([TaskId], [UserId], [CreatedByUserId]) VALUES (@BugTaskId, @Sam, @Sin);
        INSERT INTO [pmt].[TaskAssignees] ([TaskId], [UserId], [CreatedByUserId]) VALUES (@BugTaskId, @BugDeveloperId, @Sin);

        DECLARE @BugFixCode NVARCHAR(40) = N'HLS-TASK-' + RIGHT(N'0000' + CONVERT(NVARCHAR(12), @TaskCounter), 4);
        DECLARE @BugFixStatus NVARCHAR(40) = CASE WHEN @IsFinished = 1 THEN N'Deployed in Prod' WHEN @IsCurrent = 1 THEN N'Deployed in UAT' ELSE N'QA Passed' END;

        INSERT INTO [pmt].[WorkTasks]
        (
            [ProjectId], [SprintId], [ParentTaskId], [TaskType], [Code], [Title], [DescriptionHtml],
            [Status], [Priority], [PercentCompleted], [Url], [StartDate], [EndDate], [StartedAt],
            [CreatedByUserId], [LinkedBugTaskId], [CreatedAt], [UpdatedAt]
        )
        VALUES
        (
            @HlsProject, @SprintId, NULL, N'Dev', @BugFixCode, N'Bug Fix: ' + @BugTitle,
            N'<p>Fix the linked HLS bug, update tests, and prepare QA retest notes.</p>',
            @BugFixStatus, N'High', 100, N'https://intranet.local/hls/tasks/' + CONVERT(NVARCHAR(12), @TaskCounter),
            DATEADD(DAY, 1, @BugStart), @BugEnd, DATEADD(DAY, 1, @BugStart),
            @Sin, @BugTaskId, DATEADD(DAY, 1, @BugStart), @BugEnd
        );

        DECLARE @BugFixTaskId INT = SCOPE_IDENTITY();

        INSERT INTO [pmt].[TaskAssignees] ([TaskId], [UserId], [CreatedByUserId]) VALUES (@BugFixTaskId, @BugDeveloperId, @Sin);
        INSERT INTO [pmt].[TaskDependencies] ([TaskId], [DependsOnTaskId], [CreatedByUserId]) VALUES (@BugFixTaskId, @BugTaskId, @Sin);

        INSERT INTO [pmt].[AuditEvents]
        (
            [EntityType], [EntityId], [Action], [Details], [OldStatus], [NewStatus],
            [OldPercentCompleted], [NewPercentCompleted], [UserId], [CreatedByUserId], [CreatedAt]
        )
        VALUES
        (N'Task', @BugTaskId, N'Status/Percent Changed', N'QA failed the phase validation test and assigned the Bug to development.', N'QA in Progress', N'QA Failed', 0, 100, @Sam, @Sin, @BugStart),
        (N'Task', @BugFixTaskId, N'Status/Percent Changed', N'Developer started the linked Bug Fix.', N'Todo', N'In Progress', 0, 50, @BugDeveloperId, @Sin, DATEADD(DAY, 1, @BugStart)),
        (N'Task', @BugFixTaskId, N'Status/Percent Changed', N'Developer completed the Bug Fix and reset the Bug for QA retest.', N'In Progress', N'Code Complete', 50, 100, @BugDeveloperId, @Sin, DATEADD(DAY, 4, @BugStart)),
        (N'Task', @BugTaskId, N'Status/Percent Changed', N'Bug percent reset to 0 for QA retest.', N'QA Failed', N'QA Failed', 100, 0, @BugDeveloperId, @Sin, DATEADD(DAY, 4, @BugStart)),
        (N'Task', @BugTaskId, N'Status/Percent Changed', N'QA retest passed after the Bug Fix.', N'QA Failed', N'QA Passed', 0, 100, @Sam, @Sin, @BugEnd);

        SET @BugIndex += 1;
        SET @BugCounter += 1;
        SET @TaskCounter += 1;
    END;

    SET @PhaseStart = DATEADD(DAY, 1, @PhaseEnd);
    SET @PhaseNumber += 1;
END;

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
WHERE [ParentTask].[ProjectId] = @HlsProject
  AND [ChildAverage].[PercentCompleted] IS NOT NULL;

INSERT INTO [pmt].[AuditEvents]
(
    [EntityType], [EntityId], [Action], [Details], [OldStatus], [NewStatus],
    [OldPercentCompleted], [NewPercentCompleted], [UserId], [CreatedByUserId], [CreatedAt]
)
SELECT N'Task', [TaskId], N'Created', [Title], NULL, [Status], NULL, [PercentCompleted], [CreatedByUserId], @Sin, [CreatedAt]
FROM [pmt].[WorkTasks]
WHERE [ProjectId] = @HlsProject;

;WITH OrderedTasks AS
(
    SELECT
        [TaskId],
        ROW_NUMBER() OVER (ORDER BY ISNULL([StartDate], [CreatedAt]), [TaskId]) AS [RowNumber]
    FROM [pmt].[WorkTasks]
    WHERE [ProjectId] = @HlsProject
      AND [IsDeleted] = 0
)
UPDATE [Task]
SET
    [SortOrder] = [OrderedTasks].[RowNumber] * 10,
    [Priority] = CASE
        WHEN ([OrderedTasks].[RowNumber] - 1) % 20 = 0 THEN N'High'
        WHEN ([OrderedTasks].[RowNumber] - 1) % 20 = 1 THEN N'Low'
        ELSE N'Medium'
    END
FROM [pmt].[WorkTasks] AS [Task]
INNER JOIN OrderedTasks
    ON [OrderedTasks].[TaskId] = [Task].[TaskId];

DECLARE @LogDate DATE = @HlsStart;
DECLARE @LogCount INT = 1;

WHILE @LogDate <= @Today
BEGIN
    WHILE @LogDate <= @Today
      AND
      (
          DATEPART(WEEKDAY, @LogDate) IN (1, 7)
          OR EXISTS
          (
              SELECT 1
              FROM [pmt].[Holidays]
              WHERE [HolidayDate] = @LogDate
                AND [CountryCode] = N'PH'
                AND [IsActive] = 1
          )
      )
    BEGIN
        SET @LogDate = DATEADD(DAY, 1, @LogDate);
    END;

    IF @LogDate <= @Today
    BEGIN
        INSERT INTO [pmt].[DevLogs] ([ProjectId], [UserId], [LogDate], [BodyHtml], [IsPinned], [CreatedByUserId])
        VALUES
        (
            @HlsProject,
            CASE @LogCount % 4 WHEN 0 THEN @Bill WHEN 1 THEN @Lisa WHEN 2 THEN @Mark ELSE @Steve END,
            @LogDate,
            N'<p><strong>What did you accomplish yesterday?</strong><br>Advanced the HLS AI learning phase and reviewed QA findings.</p><p><strong>What do you plan to do today?</strong><br>Continue phase work and close any linked Bug Fix retest notes.</p><p><strong>Do you have any roadblocks?</strong><br>No blockers.</p>',
            0,
            @Sin
        );
    END;

    SET @LogDate = DATEADD(DAY, 21, @LogDate);
    SET @LogCount += 1;
END;

INSERT INTO [pmt].[Blogs] ([ProjectId], [Title], [BodyHtml], [CreatedByUserId])
VALUES
(
    @HlsProject,
    N'HLS AI Recommendation Design Notes',
    N'<p><img src="/assets/docs/hls-ai-recommendations.png" alt="HLS AI recommendation flow from learner signals to recommended learning path"></p><p>The Hybrid Learning System recommends lessons by combining course prerequisites, assessment performance, classroom attendance, and instructor overrides.</p><ul><li>Keep instructor override reasons auditable.</li><li>Never hide required learning from the learner.</li><li>Review AI recommendation outcomes during every phase gate.</li></ul>',
    @Bill
),
(
    @HlsProject,
    N'HLS Waterfall Phase Gate Checklist',
    N'<p><img src="/assets/docs/hls-phase-gate.png" alt="HLS waterfall phase gate checklist with design review, QA pass, bug retest, and sign-off"></p><p>Each HLS phase should finish with a design review, QA pass, bug-fix retest, and stakeholder sign-off.</p><ul><li>Validate classroom and remote learner scenarios.</li><li>Confirm analytics totals match source attendance data.</li><li>Capture unresolved risk before the next phase begins.</li></ul>',
    @Sam
);

INSERT INTO [pmt].[BlogHistory] ([BlogId], [Action], [UserId], [CreatedByUserId])
SELECT [BlogId], N'Created', [CreatedByUserId], @Sin
FROM [pmt].[Blogs]
WHERE [ProjectId] = @HlsProject;

EXEC [pmt].[WriteAudit] N'Seed', @HlsProject, N'Loaded', N'HLS five-year waterfall seed data was loaded.', @Sin;
GO
