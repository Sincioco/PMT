/*
    PMT base seed data.

    This script resets disposable development data, then seeds:
    - Users
    - Lookup values
    - Philippine holidays used by Gantt, Road Map, and Scrum seed checks
    - The PMT project demo data

    Project-specific LMS and HLS demo data lives in separate seed files.
*/

USE [PMT];
GO

SET NOCOUNT ON;
SET DATEFIRST 7;

DECLARE @Today DATE = CONVERT(DATE, SYSDATETIME());
DECLARE @Now DATETIME2(0) = SYSDATETIME();
DECLARE @PasswordHash VARBINARY(32) = HASHBYTES('SHA2_256', CONVERT(NVARCHAR(4000), N'Password1'));

IF NOT EXISTS (SELECT 1 FROM [pmt].[Users] WHERE [Email] = N'louiery@gmail.com')
BEGIN
    INSERT INTO [pmt].[Users]
    (
        [FirstName], [LastName], [Nickname], [Email], [Phone], [AvatarUrl],
        [PasswordHash], [Bio], [IsAdmin], [Role], [CreatedByUserId]
    )
    VALUES
    (
        N'Louiery', N'Sincioco', N'Sin', N'louiery@gmail.com',
        N'+63 (966) 230-4023', N'/assets/avatar-sin.png', @PasswordHash,
        N'PMT administrator.', 1, N'Admin', 1
    );
END;

DECLARE @Sin INT = (SELECT [UserId] FROM [pmt].[Users] WHERE [Email] = N'louiery@gmail.com');

UPDATE [pmt].[Users]
SET
    [FirstName] = N'Louiery',
    [LastName] = N'Sincioco',
    [Nickname] = N'Sin',
    [Phone] = N'+63 (966) 230-4023',
    [AvatarUrl] = N'/assets/avatar-sin.png',
    [PasswordHash] = @PasswordHash,
    [IsAdmin] = 1,
    [Role] = N'Admin',
    [IsActive] = 1,
    [UpdatedByUserId] = @Sin,
    [UpdatedAt] = @Now
WHERE [UserId] = @Sin;

-- The user said no development data needs to be preserved.
DELETE FROM [pmt].[BlogAttachments];
DELETE FROM [pmt].[BlogHistory];
DELETE FROM [pmt].[TaskAttachments];
DELETE FROM [pmt].[TaskDependencies];
DELETE FROM [pmt].[TaskReporters];
DELETE FROM [pmt].[TaskAssignees];
DELETE FROM [pmt].[Attachments];
DELETE FROM [pmt].[Blogs];
DELETE FROM [pmt].[DevLogs];
DELETE FROM [pmt].[AuditEvents];
DELETE FROM [pmt].[Holidays];
DELETE FROM [pmt].[WorkTasks];
DELETE FROM [pmt].[SprintMembers];
DELETE FROM [pmt].[Sprints];
DELETE FROM [pmt].[ProjectMembers];
DELETE FROM [pmt].[Projects];
DELETE FROM [pmt].[Lookups];
DELETE FROM [pmt].[Users] WHERE [UserId] <> @Sin;

INSERT INTO [pmt].[Users]
(
    [FirstName], [LastName], [Nickname], [Email], [Phone], [AvatarUrl],
    [PasswordHash], [HomePageUrl], [SocialMediaUrl], [Bio], [IsAdmin],
    [Role], [CreatedByUserId]
)
VALUES
(N'Bill', N'Gates', N'Bill Gates', N'bill.gates@sincioco.com', N'555-0102', N'/assets/avatar-bill-gates.jpg', @PasswordHash, N'https://www.gatesnotes.com/', N'https://www.linkedin.com/in/williamhgates/', N'Backend developer focused on APIs and database work.', 0, N'Developer', @Sin),
(N'Sam', N'Altman', N'Sam Altman', N'sam.altman@sincioco.com', N'555-0103', N'/assets/avatar-sam-altman.jpg', @PasswordHash, N'https://blog.samaltman.com/', N'https://www.linkedin.com/in/samaltman/', N'QA lead who keeps acceptance criteria and bug reports clear.', 0, N'QA', @Sin),
(N'Mark', N'Zuckerberg', N'Mark Zuckerberg', N'mark.zuckerberg@sincioco.com', N'555-0104', N'/assets/avatar-mark-zuckerberg.jpg', @PasswordHash, N'https://about.meta.com/', N'https://www.linkedin.com/in/zuck/', N'Frontend developer focused on usability and interaction details.', 0, N'Developer', @Sin),
(N'Steve', N'Jobs', N'Steve Jobs', N'steve.jobs@sincioco.com', N'555-0105', N'/assets/avatar-steve-jobs.jpg', @PasswordHash, N'https://www.apple.com/', N'https://www.linkedin.com/', N'Product-minded developer who helps sharpen feature scope.', 0, N'Developer', @Sin),
(N'Lisa', N'Su', N'Lisa Su', N'lisa.su@sincioco.com', N'555-0106', N'/assets/avatar-lisa-su.jpg', @PasswordHash, N'https://www.amd.com/', N'https://www.linkedin.com/in/lisa-su-82818239/', N'Integration developer who helps with performance and release support.', 0, N'Developer', @Sin);

DECLARE @Bill INT = (SELECT [UserId] FROM [pmt].[Users] WHERE [Nickname] = N'Bill Gates');
DECLARE @Sam INT = (SELECT [UserId] FROM [pmt].[Users] WHERE [Nickname] = N'Sam Altman');
DECLARE @Mark INT = (SELECT [UserId] FROM [pmt].[Users] WHERE [Nickname] = N'Mark Zuckerberg');
DECLARE @Steve INT = (SELECT [UserId] FROM [pmt].[Users] WHERE [Nickname] = N'Steve Jobs');
DECLARE @Lisa INT = (SELECT [UserId] FROM [pmt].[Users] WHERE [Nickname] = N'Lisa Su');

INSERT INTO [pmt].[Lookups] ([LookupType], [Value], [ColorHex], [DisplayOrder], [IsActive], [CreatedByUserId])
VALUES
(N'Status', N'Backlog', N'#6B7680', 10, 1, @Sin),
(N'Status', N'Todo', N'#76A9FF', 20, 1, @Sin),
(N'Status', N'In Progress', N'#35C7BD', 30, 1, @Sin),
(N'Status', N'Code Complete', N'#8AD17C', 40, 1, @Sin),
(N'Status', N'Ready for QA', N'#E4C63A', 50, 1, @Sin),
(N'Status', N'QA in Progress', N'#E4A53A', 60, 1, @Sin),
(N'Status', N'QA Failed', N'#EE6B70', 70, 1, @Sin),
(N'Status', N'QA Passed', N'#74C476', 80, 1, @Sin),
(N'Status', N'Deployed in SIT', N'#58B6D6', 90, 1, @Sin),
(N'Status', N'Deployed in UAT', N'#9F9CFF', 100, 1, @Sin),
(N'Status', N'Deployed in Prod', N'#C5D35C', 110, 1, @Sin),
(N'Priority', N'Lowest', NULL, 10, 1, @Sin),
(N'Priority', N'Low', NULL, 20, 1, @Sin),
(N'Priority', N'Medium', NULL, 30, 1, @Sin),
(N'Priority', N'High', NULL, 40, 1, @Sin),
(N'Priority', N'Highest', NULL, 50, 1, @Sin),
(N'Severity', N'Trivial', NULL, 10, 1, @Sin),
(N'Severity', N'Minor', NULL, 20, 1, @Sin),
(N'Severity', N'Major', NULL, 30, 1, @Sin),
(N'Severity', N'Critical', NULL, 40, 1, @Sin),
(N'Environment', N'local', NULL, 10, 1, @Sin),
(N'Environment', N'Dev', NULL, 20, 1, @Sin),
(N'Environment', N'SIT', NULL, 30, 1, @Sin),
(N'Environment', N'UAT', NULL, 40, 1, @Sin),
(N'Environment', N'Production', NULL, 50, 1, @Sin);

DECLARE @HolidaySeed TABLE
(
    [Name] NVARCHAR(160) NOT NULL,
    [HolidayDate] DATE NOT NULL,
    [CountryCode] NVARCHAR(10) NOT NULL
);

-- These are the known Philippine holidays needed by the demo date range.
INSERT INTO @HolidaySeed ([Name], [HolidayDate], [CountryCode])
VALUES
(N'New Year''s Day', '2021-01-01', N'PH'), (N'Maundy Thursday', '2021-04-01', N'PH'), (N'Good Friday', '2021-04-02', N'PH'), (N'Day of Valor', '2021-04-09', N'PH'), (N'Labor Day', '2021-05-01', N'PH'), (N'Independence Day', '2021-06-12', N'PH'), (N'National Heroes Day', '2021-08-30', N'PH'), (N'Bonifacio Day', '2021-11-30', N'PH'), (N'Christmas Day', '2021-12-25', N'PH'), (N'Rizal Day', '2021-12-30', N'PH'),
(N'New Year''s Day', '2022-01-01', N'PH'), (N'Maundy Thursday', '2022-04-14', N'PH'), (N'Good Friday', '2022-04-15', N'PH'), (N'Day of Valor', '2022-04-09', N'PH'), (N'Labor Day', '2022-05-01', N'PH'), (N'Independence Day', '2022-06-12', N'PH'), (N'National Heroes Day', '2022-08-29', N'PH'), (N'Bonifacio Day', '2022-11-30', N'PH'), (N'Christmas Day', '2022-12-25', N'PH'), (N'Rizal Day', '2022-12-30', N'PH'),
(N'New Year''s Day', '2023-01-01', N'PH'), (N'Maundy Thursday', '2023-04-06', N'PH'), (N'Good Friday', '2023-04-07', N'PH'), (N'Day of Valor', '2023-04-10', N'PH'), (N'Labor Day', '2023-05-01', N'PH'), (N'Independence Day', '2023-06-12', N'PH'), (N'National Heroes Day', '2023-08-28', N'PH'), (N'Bonifacio Day', '2023-11-27', N'PH'), (N'Christmas Day', '2023-12-25', N'PH'), (N'Rizal Day', '2023-12-30', N'PH'),
(N'New Year''s Day', '2024-01-01', N'PH'), (N'Maundy Thursday', '2024-03-28', N'PH'), (N'Good Friday', '2024-03-29', N'PH'), (N'Day of Valor', '2024-04-09', N'PH'), (N'Labor Day', '2024-05-01', N'PH'), (N'Independence Day', '2024-06-12', N'PH'), (N'National Heroes Day', '2024-08-26', N'PH'), (N'Bonifacio Day', '2024-11-30', N'PH'), (N'Christmas Day', '2024-12-25', N'PH'), (N'Rizal Day', '2024-12-30', N'PH'),
(N'New Year''s Day', '2025-01-01', N'PH'), (N'Maundy Thursday', '2025-04-17', N'PH'), (N'Good Friday', '2025-04-18', N'PH'), (N'Day of Valor', '2025-04-09', N'PH'), (N'Labor Day', '2025-05-01', N'PH'), (N'Independence Day', '2025-06-12', N'PH'), (N'National Heroes Day', '2025-08-25', N'PH'), (N'Bonifacio Day', '2025-11-30', N'PH'), (N'Christmas Day', '2025-12-25', N'PH'), (N'Rizal Day', '2025-12-30', N'PH'),
(N'New Year''s Day', '2026-01-01', N'PH'), (N'Maundy Thursday', '2026-04-02', N'PH'), (N'Good Friday', '2026-04-03', N'PH'), (N'Day of Valor', '2026-04-09', N'PH'), (N'Labor Day', '2026-05-01', N'PH'), (N'Independence Day', '2026-06-12', N'PH'), (N'National Heroes Day', '2026-08-31', N'PH'), (N'Bonifacio Day', '2026-11-30', N'PH'), (N'Christmas Day', '2026-12-25', N'PH'), (N'Rizal Day', '2026-12-30', N'PH');

INSERT INTO [pmt].[Holidays] ([Name], [HolidayDate], [CountryCode], [IsActive], [CreatedByUserId])
SELECT [Name], [HolidayDate], [CountryCode], 1, @Sin
FROM @HolidaySeed;

INSERT INTO [pmt].[Projects] ([Code], [Title], [Description], [Url], [IconUrl], [StartDate], [EndDate], [CreatedByUserId])
VALUES
(N'PMT', N'Project Management Tool', N'The internal task tracking tool used by this development team.', N'https://intranet.local/projects/pmt', N'/assets/project-pmt.svg', DATEADD(DAY, -45, @Today), NULL, @Sin);

DECLARE @PmtProject INT = (SELECT [ProjectId] FROM [pmt].[Projects] WHERE [Code] = N'PMT');

INSERT INTO [pmt].[ProjectMembers] ([ProjectId], [UserId], [CreatedByUserId])
VALUES
(@PmtProject, @Sin, @Sin), (@PmtProject, @Bill, @Sin), (@PmtProject, @Sam, @Sin),
(@PmtProject, @Mark, @Sin), (@PmtProject, @Steve, @Sin), (@PmtProject, @Lisa, @Sin);

INSERT INTO [pmt].[Sprints]
(
    [ProjectId], [Code], [Title], [Description], [StartDate], [EndDate],
    [LessonLearnedHtml], [IsFinished], [CreatedByUserId]
)
VALUES
(@PmtProject, N'PMT-Sprint1', N'Foundation and Dark Theme', N'Initial PMT screens, dark theme, ADO.NET data access, and seed data.', DATEADD(DAY, -28, @Today), DATEADD(DAY, -15, @Today), N'<p>Simple stored procedures made the initial PMT workflow easier to debug.</p>', 1, @Sin),
(@PmtProject, N'PMT-Sprint2', N'Road Map, Gantt, and Audit Trail', N'Current work for Gantt, Road Map, project flow, and audit logging.', DATEADD(DAY, -14, @Today), DATEADD(DAY, 13, @Today), N'', 0, @Sin);

DECLARE @PmtSprint1 INT = (SELECT [SprintId] FROM [pmt].[Sprints] WHERE [Code] = N'PMT-Sprint1');
DECLARE @PmtSprint2 INT = (SELECT [SprintId] FROM [pmt].[Sprints] WHERE [Code] = N'PMT-Sprint2');

INSERT INTO [pmt].[SprintMembers] ([SprintId], [UserId], [CreatedByUserId])
VALUES
(@PmtSprint1, @Sin, @Sin), (@PmtSprint1, @Bill, @Sin), (@PmtSprint1, @Sam, @Sin), (@PmtSprint1, @Mark, @Sin), (@PmtSprint1, @Steve, @Sin), (@PmtSprint1, @Lisa, @Sin),
(@PmtSprint2, @Sin, @Sin), (@PmtSprint2, @Bill, @Sin), (@PmtSprint2, @Sam, @Sin), (@PmtSprint2, @Mark, @Sin), (@PmtSprint2, @Steve, @Sin), (@PmtSprint2, @Lisa, @Sin);

INSERT INTO [pmt].[WorkTasks]
(
    [ProjectId], [SprintId], [ParentTaskId], [TaskType], [Code], [Title], [DescriptionHtml],
    [Status], [Priority], [PercentCompleted], [Url], [StartDate], [EndDate], [StartedAt],
    [CreatedByUserId], [LinkedBugTaskId]
)
VALUES
(@PmtProject, @PmtSprint1, NULL, N'Dev', N'PMT-TASK-101', N'Create ADO.NET stored procedure data access', N'<p>Build simple ADO.NET calls and keep Entity Framework out of PMT.</p>', N'QA Passed', N'High', 100, N'https://intranet.local/pmt/tasks/101', DATEADD(DAY, -27, @Today), DATEADD(DAY, -22, @Today), DATEADD(DAY, -27, @Today), @Sin, NULL),
(@PmtProject, @PmtSprint1, NULL, N'Dev', N'PMT-TASK-102', N'Modernize PMT dark theme screens', N'<p>Apply the modern dark theme across dashboard, tasks, board, documentation, and user dialogs.</p>', N'QA Passed', N'High', 100, N'https://intranet.local/pmt/tasks/102', DATEADD(DAY, -26, @Today), DATEADD(DAY, -18, @Today), DATEADD(DAY, -26, @Today), @Sin, NULL),
(@PmtProject, @PmtSprint2, NULL, N'Dev', N'PMT-TASK-201', N'Add task and bug audit log', N'<p>Parent task for structured audit fields and the audit popup on Tasks and Bugs.</p>', N'In Progress', N'Highest', 63, N'https://intranet.local/pmt/tasks/201', DATEADD(DAY, -11, @Today), DATEADD(DAY, 4, @Today), DATEADD(DAY, -11, @Today), @Sin, NULL),
(@PmtProject, @PmtSprint2, NULL, N'Dev', N'PMT-TASK-204', N'Improve dashboard project flow clipping', N'<p>Keep sprint task chips inside their own sprint containers as the browser gets narrower.</p>', N'Ready for QA', N'Medium', 75, N'https://intranet.local/pmt/tasks/204', DATEADD(DAY, -9, @Today), DATEADD(DAY, 2, @Today), DATEADD(DAY, -9, @Today), @Sin, NULL),
(@PmtProject, NULL, NULL, N'Dev', N'PMT-BACKLOG-1', N'Add stakeholder export package', N'<p>Generate a lightweight stakeholder summary from the dashboard and roadmap views.</p>', N'Todo', N'Medium', 0, N'https://intranet.local/pmt/backlog/1', NULL, NULL, NULL, @Sin, NULL);

DECLARE @PmtAuditParent INT = (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [Code] = N'PMT-TASK-201');

INSERT INTO [pmt].[WorkTasks]
(
    [ProjectId], [SprintId], [ParentTaskId], [TaskType], [Code], [Title], [DescriptionHtml],
    [Status], [Priority], [PercentCompleted], [Url], [StartDate], [EndDate], [StartedAt],
    [CreatedByUserId], [LinkedBugTaskId]
)
VALUES
(@PmtProject, @PmtSprint2, @PmtAuditParent, N'Dev', N'PMT-TASK-202', N'Add audit fields to database and API DTO', N'<p>Carry old/new status and percent values to the browser.</p>', N'Code Complete', N'High', 100, N'https://intranet.local/pmt/tasks/202', DATEADD(DAY, -11, @Today), DATEADD(DAY, -6, @Today), DATEADD(DAY, -11, @Today), @Sin, NULL),
(@PmtProject, @PmtSprint2, @PmtAuditParent, N'Dev', N'PMT-TASK-203', N'Create audit popup on task and bug dialogs', N'<p>Show the newest audit rows first in a themed modal dialog.</p>', N'In Progress', N'High', 25, N'https://intranet.local/pmt/tasks/203', DATEADD(DAY, -5, @Today), DATEADD(DAY, 3, @Today), DATEADD(DAY, -5, @Today), @Sin, NULL);

INSERT INTO [pmt].[WorkTasks]
(
    [ProjectId], [SprintId], [ParentTaskId], [TaskType], [Code], [Title], [DescriptionHtml],
    [StepsToReproduceHtml], [ActualResultHtml], [ExpectedResultHtml], [Environment], [Severity],
    [Status], [Priority], [PercentCompleted], [Url], [StartDate], [EndDate], [StartedAt],
    [CreatedByUserId], [LinkedBugTaskId]
)
VALUES
(@PmtProject, @PmtSprint2, NULL, N'Bug', N'PMT-BUG-101', N'Dashboard sprint chips spill into adjacent columns', N'<p>Project Flow sprint task chips overflow horizontally on narrower browser widths.</p>', N'<ol><li>Open Dashboard.</li><li>Resize browser to a narrow desktop width.</li><li>Review the Project Flow section.</li></ol>', N'<p>Task chips cross into the neighboring sprint lane.</p>', N'<p>Task chips should clip or wrap inside the current sprint lane.</p>', N'local', N'Major', N'QA Passed', N'High', 100, N'https://intranet.local/pmt/bugs/101', DATEADD(DAY, -8, @Today), DATEADD(DAY, -2, @Today), DATEADD(DAY, -8, @Today), @Sin, NULL);

DECLARE @PmtBug INT = (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [Code] = N'PMT-BUG-101');

INSERT INTO [pmt].[WorkTasks]
(
    [ProjectId], [SprintId], [ParentTaskId], [TaskType], [Code], [Title], [DescriptionHtml],
    [Status], [Priority], [PercentCompleted], [Url], [StartDate], [EndDate], [StartedAt],
    [CreatedByUserId], [LinkedBugTaskId]
)
VALUES
(@PmtProject, @PmtSprint2, NULL, N'Dev', N'PMT-TASK-205', N'Bug Fix: Dashboard sprint chips spill into adjacent columns', N'<p>Constrain each sprint lane and clip long task text.</p>', N'QA Passed', N'High', 100, N'https://intranet.local/pmt/tasks/205', DATEADD(DAY, -7, @Today), DATEADD(DAY, -2, @Today), DATEADD(DAY, -7, @Today), @Sin, @PmtBug);

DECLARE @PmtBugFix INT = (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [Code] = N'PMT-TASK-205');

INSERT INTO [pmt].[WorkTasks]
(
    [ProjectId], [SprintId], [ParentTaskId], [TaskType], [Code], [Title], [DescriptionHtml],
    [Status], [Priority], [PercentCompleted], [Url], [StartDate], [EndDate], [StartedAt],
    [CreatedByUserId], [LinkedBugTaskId]
)
VALUES
(@PmtProject, @PmtSprint1, (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [Code] = N'PMT-TASK-101'), N'Dev', N'PMT-TASK-111', N'Create task stored procedures', N'<p>Create the stored procedures used by the PMT Task screens.</p>', N'QA Passed', N'High', 100, N'https://intranet.local/pmt/tasks/111', DATEADD(DAY, -27, @Today), DATEADD(DAY, -24, @Today), DATEADD(DAY, -27, @Today), @Sin, NULL),
(@PmtProject, @PmtSprint1, (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [Code] = N'PMT-TASK-101'), N'Dev', N'PMT-TASK-112', N'Create task API endpoints', N'<p>Expose simple task API endpoints for the browser UI.</p>', N'QA Passed', N'High', 100, N'https://intranet.local/pmt/tasks/112', DATEADD(DAY, -24, @Today), DATEADD(DAY, -22, @Today), DATEADD(DAY, -24, @Today), @Sin, NULL);

INSERT INTO [pmt].[TaskAssignees] ([TaskId], [UserId], [CreatedByUserId])
SELECT [TaskId], @Bill, @Sin FROM [pmt].[WorkTasks] WHERE [Code] IN (N'PMT-TASK-101', N'PMT-TASK-111', N'PMT-TASK-112', N'PMT-TASK-202')
UNION ALL SELECT [TaskId], @Mark, @Sin FROM [pmt].[WorkTasks] WHERE [Code] IN (N'PMT-TASK-102', N'PMT-TASK-203')
UNION ALL SELECT [TaskId], @Lisa, @Sin FROM [pmt].[WorkTasks] WHERE [Code] IN (N'PMT-TASK-201', N'PMT-TASK-204', N'PMT-TASK-205')
UNION ALL SELECT [TaskId], @Steve, @Sin FROM [pmt].[WorkTasks] WHERE [Code] IN (N'PMT-BACKLOG-1')
UNION ALL SELECT [TaskId], @Lisa, @Sin FROM [pmt].[WorkTasks] WHERE [Code] IN (N'PMT-BUG-101');

INSERT INTO [pmt].[TaskReporters] ([TaskId], [UserId], [CreatedByUserId])
VALUES (@PmtBug, @Sam, @Sin);

INSERT INTO [pmt].[TaskDependencies] ([TaskId], [DependsOnTaskId], [CreatedByUserId])
VALUES
(@PmtBugFix, @PmtBug, @Sin),
((SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [Code] = N'PMT-TASK-204'), (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [Code] = N'PMT-TASK-102'), @Sin);

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
WHERE [ChildAverage].[PercentCompleted] IS NOT NULL;

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
    [SortOrder] = [OrderedTasks].[RowNumber] * 10,
    [Priority] = CASE
        WHEN ([OrderedTasks].[RowNumber] - 1) % 20 = 0 THEN N'High'
        WHEN ([OrderedTasks].[RowNumber] - 1) % 20 = 1 THEN N'Low'
        ELSE N'Medium'
    END
FROM [pmt].[WorkTasks] AS [Task]
INNER JOIN OrderedTasks
    ON [OrderedTasks].[TaskId] = [Task].[TaskId];

INSERT INTO [pmt].[AuditEvents]
(
    [EntityType], [EntityId], [Action], [Details], [OldStatus], [NewStatus],
    [OldPercentCompleted], [NewPercentCompleted], [UserId], [CreatedByUserId], [CreatedAt]
)
SELECT N'Task', [TaskId], N'Created', [Title], NULL, [Status], NULL, [PercentCompleted], [CreatedByUserId], @Sin, DATEADD(HOUR, 9, [CreatedAt])
FROM [pmt].[WorkTasks];

INSERT INTO [pmt].[AuditEvents]
(
    [EntityType], [EntityId], [Action], [Details], [OldStatus], [NewStatus],
    [OldPercentCompleted], [NewPercentCompleted], [UserId], [CreatedByUserId], [CreatedAt]
)
VALUES
(N'Task', @PmtBug, N'Status/Percent Changed', N'QA started testing the dashboard clipping bug.', N'Todo', N'QA in Progress', 0, 0, @Sam, @Sin, DATEADD(DAY, -6, @Now)),
(N'Task', @PmtBug, N'Status/Percent Changed', N'QA failed the first fix attempt and marked the Bug complete for the developer queue.', N'QA in Progress', N'QA Failed', 0, 100, @Sam, @Sin, DATEADD(DAY, -5, @Now)),
(N'Task', @PmtBugFix, N'Status/Percent Changed', N'Developer started the Bug Fix task.', N'Todo', N'In Progress', 0, 50, @Lisa, @Sin, DATEADD(DAY, -5, @Now)),
(N'Task', @PmtBugFix, N'Status/Percent Changed', N'Bug Fix reached Code Complete; Bug percent reset for QA retest.', N'In Progress', N'Code Complete', 50, 100, @Lisa, @Sin, DATEADD(DAY, -4, @Now)),
(N'Task', @PmtBug, N'Status/Percent Changed', N'Bug percent reset to 0 for QA retest.', N'QA Failed', N'QA Failed', 100, 0, @Lisa, @Sin, DATEADD(DAY, -4, @Now)),
(N'Task', @PmtBug, N'Status/Percent Changed', N'QA passed the retest.', N'QA Failed', N'QA Passed', 0, 100, @Sam, @Sin, DATEADD(DAY, -3, @Now));

INSERT INTO [pmt].[DevLogs] ([ProjectId], [UserId], [LogDate], [BodyHtml], [IsPinned], [CreatedByUserId])
VALUES
(@PmtProject, @Sin, DATEADD(DAY, -3, @Today), N'<p><strong>What did you accomplish yesterday?</strong><br>Reviewed the audit-log requirements and mapped the database changes.</p><p><strong>What do you plan to do today?</strong><br>Rebuild the PMT database and verify LMS/HLS seed data.</p><p><strong>Do you have any roadblocks?</strong><br>No blockers.</p>', 1, @Sin),
(@PmtProject, @Mark, DATEADD(DAY, -4, @Today), N'<p><strong>What did you accomplish yesterday?</strong><br>Checked the dashboard Project Flow clipping behavior.</p><p><strong>What do you plan to do today?</strong><br>Retest the sprint card layout at tablet widths.</p><p><strong>Do you have any roadblocks?</strong><br>No blockers.</p>', 0, @Sin),
(@PmtProject, @Lisa, DATEADD(DAY, -5, @Today), N'<p><strong>What did you accomplish yesterday?</strong><br>Finished the first bug-fix pass for dashboard sprint chips.</p><p><strong>What do you plan to do today?</strong><br>Support QA retest and clean up any remaining layout issues.</p><p><strong>Do you have any roadblocks?</strong><br>No blockers.</p>', 0, @Sin);

INSERT INTO [pmt].[Blogs] ([ProjectId], [Title], [BodyHtml], [CreatedByUserId], [UpdatedByUserId], [CreatedAt], [UpdatedAt])
VALUES
(
    @PmtProject,
    N'PMT Day 1 - Foundation Build and ADO.NET Decision',
    N'<p><img src="/assets/docs/pmt-doc-day01.png" alt="PMT Day 1 progress graphic"></p><p>Day 1 established the core PMT direction: a simple .NET web application, ADO.NET data access, stored procedures, and a dedicated pmt schema for every database object.</p><ul><li>Created the login screen and default Password1 user setup.</li><li>Started the PMT seed data and schema scripts.</li><li>Kept the code intentionally simple for junior developer handoff.</li></ul>',
    @Sin,
    @Bill,
    DATEADD(DAY, -45, @Now),
    DATEADD(DAY, -44, @Now)
),
(
    @PmtProject,
    N'PMT Day 2 - Dark Theme and Kanban Workflow',
    N'<p><img src="/assets/docs/pmt-doc-day02.png" alt="PMT Day 2 progress graphic"></p><p>The second requirements pass moved PMT away from the original plain layout and into the current dark theme. The Kanban Board gained task creation and status movement.</p><ul><li>Standardized the expanded status workflow.</li><li>Added QA Passed as the sprint completion milestone.</li><li>Cleaned up checkboxes, dropdowns, and dialog focus behavior.</li></ul>',
    @Mark,
    @Sin,
    DATEADD(DAY, -39, @Now),
    DATEADD(DAY, -38, @Now)
),
(
    @PmtProject,
    N'PMT Day 3 - Filters, Scrum, and Documentation',
    N'<p><img src="/assets/docs/pmt-doc-day03.png" alt="PMT Day 3 progress graphic"></p><p>Day 3 focused on making PMT useful during daily development. The Tasks view gained richer filters, Scrum entries became table rows, and Documentation was seeded for LMS and PMT.</p><ul><li>Added project and sprint filters in Sprints and Dev Tasks.</li><li>Added Scrum placeholders for yesterday, today, and roadblocks.</li><li>Renamed Blogs to Documentation.</li></ul>',
    @Sam,
    @Mark,
    DATEADD(DAY, -34, @Now),
    DATEADD(DAY, -32, @Now)
),
(
    @PmtProject,
    N'PMT Day 4 - Holidays, Gantt, and Road Map',
    N'<p><img src="/assets/docs/pmt-doc-day04.png" alt="PMT Day 4 progress graphic"></p><p>The planning views started to mature on Day 4. PMT added Philippine-friendly holiday maintenance, Gantt non-working-day rules, and the first Road Map view for projects and Sprints.</p><ul><li>Created the Holiday maintenance screen under Settings.</li><li>Skipped weekends and holidays unless work starts on those dates.</li><li>Rendered Project and Sprint bars by start and end dates.</li></ul>',
    @Lisa,
    @Sin,
    DATEADD(DAY, -28, @Now),
    DATEADD(DAY, -26, @Now)
),
(
    @PmtProject,
    N'PMT Day 5 - Audit Trails and Seed Expansion',
    N'<p><img src="/assets/docs/pmt-doc-day05.png" alt="PMT Day 5 progress graphic"></p><p>Day 5 introduced audit logging for Dev Tasks and Bug Reports so status and completion changes tell a clear story during demos and QA reviews.</p><ul><li>Added task and bug audit popups.</li><li>Seeded LMS as a two-year Agile project.</li><li>Seeded HLS as a five-year waterfall-style AI learning project.</li></ul>',
    @Bill,
    @Sam,
    DATEADD(DAY, -22, @Now),
    DATEADD(DAY, -20, @Now)
),
(
    @PmtProject,
    N'PMT Day 6 - Gantt Fly-by and Road Map Optimization',
    N'<p><img src="/assets/docs/pmt-doc-day06.png" alt="PMT Day 6 progress graphic"></p><p>Day 6 turned the Gantt chart into a better demo surface. Sprint jump, selected Sprint mode, show-all mode, and the fly-by animation made long projects easier to present.</p><ul><li>Added Sprint dropdown and reset behavior.</li><li>Improved fly-by positioning and pause/resume behavior.</li><li>Compressed the Road Map so multi-year projects fit better.</li></ul>',
    @Steve,
    @Lisa,
    DATEADD(DAY, -16, @Now),
    DATEADD(DAY, -15, @Now)
),
(
    @PmtProject,
    N'PMT Day 7 - Navigation and Sprint Metrics',
    N'<p><img src="/assets/docs/pmt-doc-day07.png" alt="PMT Day 7 progress graphic"></p><p>Day 7 cleaned up the top navigation, moved Settings under the user avatar, and made Sprint cards show status progress bars instead of busy legends.</p><ul><li>Renamed Board to Kanban Board and Tasks to Dev Tasks.</li><li>Moved Users and Holidays into Settings.</li><li>Added expand and collapse behavior for Sprint metric cards.</li></ul>',
    @Sin,
    @Mark,
    DATEADD(DAY, -10, @Now),
    DATEADD(DAY, -9, @Now)
),
(
    @PmtProject,
    N'PMT Day 8 - Documentation Card Cleanup',
    N'<p><img src="/assets/docs/pmt-doc-day08.png" alt="PMT Day 8 progress graphic"></p><p>Day 8 made Documentation easier to scan. Cards now show project code, created and edited dates, and right-aligned actions with Delete first and Edit last.</p><ul><li>Removed edit count clutter from cards.</li><li>Aligned card actions consistently.</li><li>Kept existing Documentation entries read-only by default.</li></ul>',
    @Sam,
    NULL,
    DATEADD(DAY, -6, @Now),
    DATEADD(DAY, -6, @Now)
),
(
    @PmtProject,
    N'PMT Reorder Design Note',
    N'<p><img src="/assets/docs/pmt-doc-reorder.png" alt="PMT reorder design graphic"></p><p>The latest work adds persistent manual ordering for Backlog, Dev Tasks, Bug Reports, and the Kanban Board. Reordering stays intentionally simple: the browser sends the visible item order and the database stores the new SortOrder values.</p><ul><li>Drag within a list to reprioritize work.</li><li>Drag across Kanban columns to change status and order.</li><li>Use Custom order when demonstrating team priority.</li></ul>',
    @Lisa,
    @Sin,
    DATEADD(DAY, -3, @Now),
    DATEADD(DAY, -2, @Now)
),
(
    @PmtProject,
    N'PMT Current Demo Readiness',
    N'<p><img src="/assets/docs/pmt-doc-demo.png" alt="PMT demo readiness graphic"></p><p>PMT is now ready for a stakeholder walkthrough that covers Dashboard flow, Road Map planning, Gantt fly-by, Kanban execution, Bug Reports, Scrum, Documentation, and Settings.</p><ul><li>Dashboard emphasizes progress first and details on demand.</li><li>Planning views support long-running HLS data.</li><li>Seed data now tells a realistic story across PMT, LMS, and HLS.</li></ul>',
    @Sin,
    NULL,
    @Now,
    @Now
);

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

EXEC [pmt].[WriteAudit] N'Seed', 1, N'Loaded', N'Base PMT seed data was loaded.', @Sin;
GO
