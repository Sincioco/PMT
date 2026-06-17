/*
    LMS project seed data.

    LMS is modeled as a normal Agile/Scrum project:
    - 52 two-week sprints spanning two years through the present day
    - Parent tasks with sub-tasks in every sprint
    - Bugs with linked Bug Fix tasks and audit history
    - Scrum entries that skip weekends and known Philippine holidays
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

DECLARE @LmsStart DATE = DATEADD(DAY, -727, @Today);

INSERT INTO [pmt].[Projects] ([Code], [Title], [Description], [Url], [IconUrl], [StartDate], [EndDate], [CreatedByUserId])
VALUES
(N'LMS', N'Learning Management System', N'Internal LMS for courses, enrollments, assignments, assessments, and learner progress.', N'https://intranet.local/projects/lms', N'/assets/project-lms.svg', @LmsStart, NULL, @Sin);

DECLARE @LmsProject INT = (SELECT [ProjectId] FROM [pmt].[Projects] WHERE [Code] = N'LMS');

INSERT INTO [pmt].[ProjectMembers] ([ProjectId], [UserId], [CreatedByUserId])
VALUES
(@LmsProject, @Sin, @Sin), (@LmsProject, @Bill, @Sin), (@LmsProject, @Sam, @Sin),
(@LmsProject, @Mark, @Sin), (@LmsProject, @Steve, @Sin), (@LmsProject, @Lisa, @Sin);

DECLARE @SprintNumber INT = 1;
DECLARE @TaskCounter INT = 1;
DECLARE @BugCounter INT = 1;

WHILE @SprintNumber <= 52
BEGIN
    DECLARE @SprintCode NVARCHAR(40) = N'LMS-Sprint-' + RIGHT(N'00' + CONVERT(NVARCHAR(12), @SprintNumber), 2);
    DECLARE @SprintStart DATE = DATEADD(DAY, (@SprintNumber - 1) * 14, @LmsStart);
    DECLARE @SprintEnd DATE = DATEADD(DAY, 13, @SprintStart);
    DECLARE @IsFinished BIT = CASE WHEN @SprintEnd < @Today THEN 1 ELSE 0 END;

    INSERT INTO [pmt].[Sprints]
    (
        [ProjectId], [Code], [Title], [Description], [StartDate], [EndDate],
        [LessonLearnedHtml], [IsFinished], [CreatedByUserId]
    )
    VALUES
    (
        @LmsProject,
        @SprintCode,
        N'LMS Sprint ' + RIGHT(N'00' + CONVERT(NVARCHAR(12), @SprintNumber), 2),
        N'Two-week LMS sprint for course, assignment, assessment, and reporting work.',
        @SprintStart,
        @SprintEnd,
        CASE WHEN @IsFinished = 1 THEN N'<p>Keep acceptance criteria small enough for QA to finish inside the sprint.</p>' ELSE N'' END,
        @IsFinished,
        @Sin
    );

    DECLARE @SprintId INT = SCOPE_IDENTITY();

    INSERT INTO [pmt].[SprintMembers] ([SprintId], [UserId], [CreatedByUserId])
    VALUES
    (@SprintId, @Bill, @Sin), (@SprintId, @Sam, @Sin), (@SprintId, @Mark, @Sin),
    (@SprintId, @Steve, @Sin), (@SprintId, @Lisa, @Sin);

    DECLARE @DeveloperId INT = CASE @SprintNumber % 4 WHEN 0 THEN @Bill WHEN 1 THEN @Mark WHEN 2 THEN @Lisa ELSE @Steve END;
    DECLARE @ParentCode NVARCHAR(40) = N'LMS-TASK-' + RIGHT(N'0000' + CONVERT(NVARCHAR(12), @TaskCounter), 4);
    DECLARE @ParentTitle NVARCHAR(220) = N'Build LMS learning workflow slice ' + CONVERT(NVARCHAR(12), @SprintNumber);
    DECLARE @ParentStatus NVARCHAR(40) = CASE WHEN @IsFinished = 1 THEN N'QA Passed' ELSE N'In Progress' END;
    DECLARE @ParentPercent INT = CASE WHEN @IsFinished = 1 THEN 100 ELSE 60 END;

    INSERT INTO [pmt].[WorkTasks]
    (
        [ProjectId], [SprintId], [ParentTaskId], [TaskType], [Code], [Title], [DescriptionHtml],
        [Status], [Priority], [PercentCompleted], [Url], [StartDate], [EndDate], [StartedAt],
        [CreatedByUserId], [CreatedAt], [UpdatedAt]
    )
    VALUES
    (
        @LmsProject, @SprintId, NULL, N'Dev', @ParentCode, @ParentTitle,
        N'<p>Parent task that groups the LMS workflow work for this sprint.</p>',
        @ParentStatus, N'High', @ParentPercent, N'https://intranet.local/lms/tasks/' + CONVERT(NVARCHAR(12), @TaskCounter),
        @SprintStart, @SprintEnd, @SprintStart, @Sin, @SprintStart, @SprintEnd
    );

    DECLARE @ParentTaskId INT = SCOPE_IDENTITY();

    INSERT INTO [pmt].[TaskAssignees] ([TaskId], [UserId], [CreatedByUserId])
    VALUES (@ParentTaskId, @DeveloperId, @Sin);

    SET @TaskCounter += 1;

    DECLARE @SubTask1Code NVARCHAR(40) = N'LMS-TASK-' + RIGHT(N'0000' + CONVERT(NVARCHAR(12), @TaskCounter), 4);
    DECLARE @SubTask1Status NVARCHAR(40) = CASE WHEN @IsFinished = 1 THEN N'QA Passed' ELSE N'Ready for QA' END;
    DECLARE @SubTask1Percent INT = CASE WHEN @IsFinished = 1 THEN 100 ELSE 80 END;

    INSERT INTO [pmt].[WorkTasks]
    (
        [ProjectId], [SprintId], [ParentTaskId], [TaskType], [Code], [Title], [DescriptionHtml],
        [Status], [Priority], [PercentCompleted], [Url], [StartDate], [EndDate], [StartedAt],
        [CreatedByUserId], [CreatedAt], [UpdatedAt]
    )
    VALUES
    (
        @LmsProject, @SprintId, @ParentTaskId, N'Dev', @SubTask1Code,
        N'Implement LMS workflow API slice ' + CONVERT(NVARCHAR(12), @SprintNumber),
        N'<p>Create the API behavior and database checks for this LMS workflow.</p>',
        @SubTask1Status, N'Medium', @SubTask1Percent, N'https://intranet.local/lms/tasks/' + CONVERT(NVARCHAR(12), @TaskCounter),
        @SprintStart, DATEADD(DAY, 6, @SprintStart), @SprintStart, @Sin, @SprintStart, DATEADD(DAY, 6, @SprintStart)
    );

    DECLARE @SubTask1Id INT = SCOPE_IDENTITY();
    INSERT INTO [pmt].[TaskAssignees] ([TaskId], [UserId], [CreatedByUserId]) VALUES (@SubTask1Id, @DeveloperId, @Sin);
    SET @TaskCounter += 1;

    DECLARE @SubTask2Code NVARCHAR(40) = N'LMS-TASK-' + RIGHT(N'0000' + CONVERT(NVARCHAR(12), @TaskCounter), 4);
    DECLARE @SubTask2Status NVARCHAR(40) = CASE WHEN @IsFinished = 1 THEN N'QA Passed' ELSE N'In Progress' END;
    DECLARE @SubTask2Percent INT = CASE WHEN @IsFinished = 1 THEN 100 ELSE 40 END;

    INSERT INTO [pmt].[WorkTasks]
    (
        [ProjectId], [SprintId], [ParentTaskId], [TaskType], [Code], [Title], [DescriptionHtml],
        [Status], [Priority], [PercentCompleted], [Url], [StartDate], [EndDate], [StartedAt],
        [CreatedByUserId], [CreatedAt], [UpdatedAt]
    )
    VALUES
    (
        @LmsProject, @SprintId, @ParentTaskId, N'Dev', @SubTask2Code,
        N'Polish LMS workflow UI slice ' + CONVERT(NVARCHAR(12), @SprintNumber),
        N'<p>Keep the learner and instructor UI clear for this sprint workflow.</p>',
        @SubTask2Status, N'Medium', @SubTask2Percent, N'https://intranet.local/lms/tasks/' + CONVERT(NVARCHAR(12), @TaskCounter),
        DATEADD(DAY, 3, @SprintStart), @SprintEnd, DATEADD(DAY, 3, @SprintStart), @Sin, DATEADD(DAY, 3, @SprintStart), @SprintEnd
    );

    DECLARE @SubTask2Id INT = SCOPE_IDENTITY();
    INSERT INTO [pmt].[TaskAssignees] ([TaskId], [UserId], [CreatedByUserId]) VALUES (@SubTask2Id, @DeveloperId, @Sin);
    SET @TaskCounter += 1;

    DECLARE @FeatureCode NVARCHAR(40) = N'LMS-TASK-' + RIGHT(N'0000' + CONVERT(NVARCHAR(12), @TaskCounter), 4);
    DECLARE @FeatureStatus NVARCHAR(40) = CASE WHEN @IsFinished = 1 THEN N'Deployed in UAT' ELSE N'Todo' END;
    DECLARE @FeaturePercent INT = CASE WHEN @IsFinished = 1 THEN 100 ELSE 0 END;

    INSERT INTO [pmt].[WorkTasks]
    (
        [ProjectId], [SprintId], [ParentTaskId], [TaskType], [Code], [Title], [DescriptionHtml],
        [Status], [Priority], [PercentCompleted], [Url], [StartDate], [EndDate], [StartedAt],
        [CreatedByUserId], [CreatedAt], [UpdatedAt]
    )
    VALUES
    (
        @LmsProject, @SprintId, NULL, N'Dev', @FeatureCode,
        CASE @SprintNumber % 5
            WHEN 0 THEN N'Tune assignment reminder notifications'
            WHEN 1 THEN N'Improve learner progress dashboard'
            WHEN 2 THEN N'Expand quiz item banking'
            WHEN 3 THEN N'Add instructor gradebook filters'
            ELSE N'Update enrollment roster import checks'
        END,
        N'<p>Feature task for the LMS sprint backlog.</p>',
        @FeatureStatus, N'Medium', @FeaturePercent, N'https://intranet.local/lms/tasks/' + CONVERT(NVARCHAR(12), @TaskCounter),
        DATEADD(DAY, 1, @SprintStart), DATEADD(DAY, 10, @SprintStart),
        CASE WHEN @FeatureStatus = N'Todo' THEN NULL ELSE DATEADD(DAY, 1, @SprintStart) END,
        @Sin, DATEADD(DAY, 1, @SprintStart), DATEADD(DAY, 10, @SprintStart)
    );

    DECLARE @FeatureTaskId INT = SCOPE_IDENTITY();
    INSERT INTO [pmt].[TaskAssignees] ([TaskId], [UserId], [CreatedByUserId]) VALUES (@FeatureTaskId, CASE WHEN @DeveloperId = @Bill THEN @Lisa ELSE @Bill END, @Sin);
    SET @TaskCounter += 1;

    DECLARE @BugCode NVARCHAR(40) = N'LMS-BUG-' + RIGHT(N'0000' + CONVERT(NVARCHAR(12), @BugCounter), 4);
    DECLARE @BugTitle NVARCHAR(220) = CASE @SprintNumber % 4
        WHEN 0 THEN N'Quiz timer does not pause on network retry'
        WHEN 1 THEN N'Gradebook export drops instructor comment'
        WHEN 2 THEN N'Course completion badge appears twice'
        ELSE N'Roster sync marks inactive learner as active'
    END;

    INSERT INTO [pmt].[WorkTasks]
    (
        [ProjectId], [SprintId], [ParentTaskId], [TaskType], [Code], [Title], [DescriptionHtml],
        [StepsToReproduceHtml], [ActualResultHtml], [ExpectedResultHtml], [Environment], [Severity],
        [Status], [Priority], [PercentCompleted], [Url], [StartDate], [EndDate], [StartedAt],
        [CreatedByUserId], [CreatedAt], [UpdatedAt]
    )
    VALUES
    (
        @LmsProject, @SprintId, NULL, N'Bug', @BugCode, @BugTitle,
        N'<p>QA found a workflow bug during sprint testing.</p>',
        N'<ol><li>Open the LMS test course.</li><li>Run the sprint acceptance scenario.</li><li>Compare the result to the expected behavior.</li></ol>',
        N'<p>The workflow result is inconsistent.</p>',
        N'<p>The workflow should be stable and auditable.</p>',
        N'SIT', N'Major', N'QA Passed', N'High', 100, N'https://intranet.local/lms/bugs/' + CONVERT(NVARCHAR(12), @BugCounter),
        DATEADD(DAY, 7, @SprintStart), DATEADD(DAY, 12, @SprintStart), DATEADD(DAY, 7, @SprintStart),
        @Sin, DATEADD(DAY, 7, @SprintStart), DATEADD(DAY, 12, @SprintStart)
    );

    DECLARE @BugTaskId INT = SCOPE_IDENTITY();

    INSERT INTO [pmt].[TaskReporters] ([TaskId], [UserId], [CreatedByUserId]) VALUES (@BugTaskId, @Sam, @Sin);
    INSERT INTO [pmt].[TaskAssignees] ([TaskId], [UserId], [CreatedByUserId]) VALUES (@BugTaskId, @DeveloperId, @Sin);

    SET @BugCounter += 1;
    DECLARE @BugFixCode NVARCHAR(40) = N'LMS-TASK-' + RIGHT(N'0000' + CONVERT(NVARCHAR(12), @TaskCounter), 4);

    INSERT INTO [pmt].[WorkTasks]
    (
        [ProjectId], [SprintId], [ParentTaskId], [TaskType], [Code], [Title], [DescriptionHtml],
        [Status], [Priority], [PercentCompleted], [Url], [StartDate], [EndDate], [StartedAt],
        [CreatedByUserId], [LinkedBugTaskId], [CreatedAt], [UpdatedAt]
    )
    VALUES
    (
        @LmsProject, @SprintId, NULL, N'Dev', @BugFixCode, N'Bug Fix: ' + @BugTitle,
        N'<p>Fix, unit test, and prepare QA retest notes for the linked LMS bug.</p>',
        N'QA Passed', N'High', 100, N'https://intranet.local/lms/tasks/' + CONVERT(NVARCHAR(12), @TaskCounter),
        DATEADD(DAY, 8, @SprintStart), DATEADD(DAY, 12, @SprintStart), DATEADD(DAY, 8, @SprintStart),
        @Sin, @BugTaskId, DATEADD(DAY, 8, @SprintStart), DATEADD(DAY, 12, @SprintStart)
    );

    DECLARE @BugFixTaskId INT = SCOPE_IDENTITY();

    INSERT INTO [pmt].[TaskAssignees] ([TaskId], [UserId], [CreatedByUserId]) VALUES (@BugFixTaskId, @DeveloperId, @Sin);
    INSERT INTO [pmt].[TaskDependencies] ([TaskId], [DependsOnTaskId], [CreatedByUserId]) VALUES (@BugFixTaskId, @BugTaskId, @Sin);

    INSERT INTO [pmt].[AuditEvents]
    (
        [EntityType], [EntityId], [Action], [Details], [OldStatus], [NewStatus],
        [OldPercentCompleted], [NewPercentCompleted], [UserId], [CreatedByUserId], [CreatedAt]
    )
    VALUES
    (N'Task', @BugTaskId, N'Status/Percent Changed', N'QA failed the first pass and moved the Bug back to the developer.', N'QA in Progress', N'QA Failed', 0, 100, @Sam, @Sin, DATEADD(DAY, 8, @SprintStart)),
    (N'Task', @BugFixTaskId, N'Status/Percent Changed', N'Developer started the Bug Fix task.', N'Todo', N'In Progress', 0, 50, @DeveloperId, @Sin, DATEADD(DAY, 9, @SprintStart)),
    (N'Task', @BugFixTaskId, N'Status/Percent Changed', N'Developer completed the Bug Fix and reset the Bug for QA retest.', N'In Progress', N'Code Complete', 50, 100, @DeveloperId, @Sin, DATEADD(DAY, 10, @SprintStart)),
    (N'Task', @BugTaskId, N'Status/Percent Changed', N'Bug percent reset to 0 for QA retest.', N'QA Failed', N'QA Failed', 100, 0, @DeveloperId, @Sin, DATEADD(DAY, 10, @SprintStart)),
    (N'Task', @BugTaskId, N'Status/Percent Changed', N'QA retest passed before sprint close.', N'QA Failed', N'QA Passed', 0, 100, @Sam, @Sin, DATEADD(DAY, 12, @SprintStart));

    SET @TaskCounter += 1;
    SET @SprintNumber += 1;
END;

-- Parent task progress is calculated from its children.
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
WHERE [ParentTask].[ProjectId] = @LmsProject
  AND [ChildAverage].[PercentCompleted] IS NOT NULL;

INSERT INTO [pmt].[AuditEvents]
(
    [EntityType], [EntityId], [Action], [Details], [OldStatus], [NewStatus],
    [OldPercentCompleted], [NewPercentCompleted], [UserId], [CreatedByUserId], [CreatedAt]
)
SELECT N'Task', [TaskId], N'Created', [Title], NULL, [Status], NULL, [PercentCompleted], [CreatedByUserId], @Sin, [CreatedAt]
FROM [pmt].[WorkTasks]
WHERE [ProjectId] = @LmsProject;

INSERT INTO [pmt].[WorkTasks]
(
    [ProjectId], [SprintId], [ParentTaskId], [TaskType], [Code], [Title], [DescriptionHtml],
    [Status], [Priority], [PercentCompleted], [Url], [CreatedByUserId]
)
VALUES
(@LmsProject, NULL, NULL, N'Dev', N'LMS-BACKLOG-1', N'Add waitlist notifications for full classes', N'<p>Email learners when a seat opens in a class they joined on the waitlist.</p>', N'Todo', N'Highest', 0, N'https://intranet.local/lms/backlog/1', @Sin),
(@LmsProject, NULL, NULL, N'Dev', N'LMS-BACKLOG-2', N'Bulk import legacy transcript history', N'<p>Import course completions from the legacy training system.</p>', N'Todo', N'Medium', 0, N'https://intranet.local/lms/backlog/2', @Sin),
(@LmsProject, NULL, NULL, N'Bug', N'LMS-BACKLOG-3', N'Mobile quiz timer overlaps answer choices', N'<p>The timer floats over multiple choice answers on small screens.</p>', N'Todo', N'High', 0, N'https://intranet.local/lms/backlog/3', @Sin);

INSERT INTO [pmt].[TaskAssignees] ([TaskId], [UserId], [CreatedByUserId])
SELECT [TaskId], @Steve, @Sin
FROM [pmt].[WorkTasks]
WHERE [Code] IN (N'LMS-BACKLOG-1', N'LMS-BACKLOG-2')
UNION ALL
SELECT [TaskId], @Mark, @Sin
FROM [pmt].[WorkTasks]
WHERE [Code] = N'LMS-BACKLOG-3';

INSERT INTO [pmt].[TaskReporters] ([TaskId], [UserId], [CreatedByUserId])
SELECT [TaskId], @Sam, @Sin
FROM [pmt].[WorkTasks]
WHERE [Code] = N'LMS-BACKLOG-3';

DECLARE @LmsBacklogBug INT = (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [Code] = N'LMS-BACKLOG-3');

INSERT INTO [pmt].[WorkTasks]
(
    [ProjectId], [SprintId], [ParentTaskId], [TaskType], [Code], [Title], [DescriptionHtml],
    [Status], [Priority], [PercentCompleted], [Url], [CreatedByUserId], [LinkedBugTaskId]
)
VALUES
(@LmsProject, NULL, NULL, N'Dev', N'LMS-TASK-9001', N'Bug Fix: Mobile quiz timer overlaps answer choices', N'<p>Backlog bug fix task created with the bug so it can be planned into a future sprint.</p>', N'Todo', N'High', 0, N'https://intranet.local/lms/backlog/fix-3', @Sin, @LmsBacklogBug);

DECLARE @LmsBacklogFix INT = SCOPE_IDENTITY();

INSERT INTO [pmt].[TaskAssignees] ([TaskId], [UserId], [CreatedByUserId])
VALUES (@LmsBacklogFix, @Mark, @Sin);

INSERT INTO [pmt].[TaskDependencies] ([TaskId], [DependsOnTaskId], [CreatedByUserId])
VALUES (@LmsBacklogFix, @LmsBacklogBug, @Sin);

INSERT INTO [pmt].[AuditEvents]
(
    [EntityType], [EntityId], [Action], [Details], [OldStatus], [NewStatus],
    [OldPercentCompleted], [NewPercentCompleted], [UserId], [CreatedByUserId], [CreatedAt]
)
VALUES
(N'Task', @LmsBacklogBug, N'Created', N'Mobile quiz timer overlaps answer choices', NULL, N'Todo', NULL, 0, @Sin, @Sin, @Now),
(N'Task', @LmsBacklogFix, N'Created', N'Backlog Bug Fix created for planning.', NULL, N'Todo', NULL, 0, @Sin, @Sin, @Now);

;WITH OrderedTasks AS
(
    SELECT
        [TaskId],
        ROW_NUMBER() OVER (ORDER BY ISNULL([StartDate], [CreatedAt]), [TaskId]) AS [RowNumber]
    FROM [pmt].[WorkTasks]
    WHERE [ProjectId] = @LmsProject
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

DECLARE @LogDate DATE = @LmsStart;
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
            @LmsProject,
            CASE @LogCount % 4 WHEN 0 THEN @Bill WHEN 1 THEN @Mark WHEN 2 THEN @Lisa ELSE @Steve END,
            @LogDate,
            N'<p><strong>What did you accomplish yesterday?</strong><br>Completed the current LMS sprint slice and reviewed QA notes.</p><p><strong>What do you plan to do today?</strong><br>Continue the next LMS backlog item and keep bug-fix notes current.</p><p><strong>Do you have any roadblocks?</strong><br>No blockers.</p>',
            0,
            @Sin
        );
    END;

    SET @LogDate = DATEADD(DAY, 7, @LogDate);
    SET @LogCount += 1;
END;

INSERT INTO [pmt].[Blogs] ([ProjectId], [Title], [BodyHtml], [CreatedByUserId])
VALUES
(
    @LmsProject,
    N'LMS Course Catalog Release Notes',
    N'<p><img src="/assets/docs/lms-course-catalog-v2.png" alt="LMS course catalog screen with searchable course cards and enrollment status"></p><p>The LMS course catalog helps learners find required training quickly. Keep the first release focused on searchable course cards, enrollment status, and clear calls to action.</p><ul><li>Show required and optional courses separately.</li><li>Display estimated duration and due date.</li><li>Keep enrollment changes audited.</li></ul>',
    @Sin
),
(
    @LmsProject,
    N'LMS Computer Lab Rollout Checklist',
    N'<p><img src="/assets/docs/lms-computer-lab-v2.png" alt="LMS computer lab rollout checklist with workstation readiness and QA checks"></p><p>Use this checklist when rolling the LMS into shared training rooms.</p><ul><li>Confirm Chrome is installed and up to date.</li><li>Verify SSO login from a learner workstation.</li><li>Run one quiz and one assignment upload before class starts.</li></ul>',
    @Sam
);

INSERT INTO [pmt].[BlogHistory] ([BlogId], [Action], [UserId], [CreatedByUserId])
SELECT [BlogId], N'Created', [CreatedByUserId], @Sin
FROM [pmt].[Blogs]
WHERE [ProjectId] = @LmsProject;

EXEC [pmt].[WriteAudit] N'Seed', @LmsProject, N'Loaded', N'LMS two-year Agile seed data was loaded.', @Sin;
GO
