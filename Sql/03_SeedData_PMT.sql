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

IF EXISTS (SELECT 1 FROM [pmt].[Projects] WHERE [Code] = N'PMT')
BEGIN
    THROW 50258, 'PMT seed data can only be restored after the PMT project has been permanently deleted.', 1;
END;

IF @Sin IS NULL OR @Bill IS NULL OR @Sam IS NULL OR @Mark IS NULL OR @Steve IS NULL OR @Jensen IS NULL
BEGIN
    THROW 50259, 'PMT seed data requires the initial seeded users. Use Restore Initial Seed Data first.', 1;
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
(@PmtProject, @PmtSprint2, NULL, N'Bug', N'PMT-BUG-001', N'Dropdown menu stays white in dark theme', N'<p>Native dropdown options keep a white background and look disconnected from the dark UI.</p>', N'<ol><li>Open any edit dialog.</li><li>Open the Status dropdown.</li><li>Review the option list.</li></ol>', N'<p>The open menu is white and visually clashes with the page.</p>', N'<p>The dropdown options should use the PMT dark theme.</p>', N'<p>Root cause: browser-native select option styling was left outside the PMT theme token rules.</p>', N'local', N'Minor', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/bugs/001', DATEADD(DAY, -37, @Today), DATEADD(DAY, -34, @Today), DATEADD(DAY, -37, @Today), @Sin, NULL),
(@PmtProject, @PmtSprint4, NULL, N'Bug', N'PMT-BUG-002', N'Gantt day labels overlap on compressed timelines', N'<p>When a long project is shown, day numbers can overlap and become unreadable.</p>', N'<ol><li>Open Gantt.</li><li>Select HLS.</li><li>Show all Sprints.</li></ol>', N'<p>Day labels crowd together on narrow columns.</p>', N'<p>Only enough labels should be shown to keep the header readable.</p>', N'<p>Root cause: timeline labels rendered at every day marker even when the available column width was too small.</p>', N'SIT', N'Major', N'Deployed in Prod', N'High', 100, N'https://intranet.local/pmt/bugs/002', DATEADD(DAY, -8, @Today), DATEADD(DAY, -3, @Today), DATEADD(DAY, -8, @Today), @Sin, NULL),
(@PmtProject, @PmtSprint5, NULL, N'Bug', N'PMT-BUG-003', N'Gantt bug expansion jumps back to current Sprint', N'<p>During a fly-by pause, expanding a task bug row rerenders the chart and jumps back to the selected/current Sprint.</p>', N'<ol><li>Start the Gantt fly-by.</li><li>Wait until the viewport reaches an older Sprint.</li><li>Expand a bug icon.</li></ol>', N'<p>The viewport jumps to the current Sprint instead of staying on the Sprint being reviewed.</p>', N'<p>The bug rows should expand without changing the current scroll position.</p>', N'<p>Root cause: the expansion render path reused the initial Sprint positioning logic instead of preserving the active scroll offset.</p>', N'SIT', N'Major', N'QA Failed', N'High', 100, N'https://intranet.local/pmt/bugs/003', DATEADD(DAY, 1, @Today), DATEADD(DAY, 6, @Today), DATEADD(DAY, 1, @Today), @Sin, NULL);

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
    [OldPercentCompleted], [NewPercentCompleted], [UserId], [CreatedByUserId], [CreatedAt]
)
SELECT N'Task', [TaskId], N'Created', [Title], NULL, [Status], NULL, [PercentCompleted], [CreatedByUserId], @Sin, DATEADD(HOUR, 9, [CreatedAt])
FROM [pmt].[WorkTasks]
WHERE [ProjectId] = @PmtProject;

INSERT INTO [pmt].[AuditEvents]
(
    [EntityType], [EntityId], [Action], [Details], [OldStatus], [NewStatus],
    [OldPercentCompleted], [NewPercentCompleted], [UserId], [CreatedByUserId], [CreatedAt]
)
VALUES
(N'Task', @PmtThemeParent, N'Status/Percent Changed', N'Parent percent recalculated from dark-theme sub-tasks.', N'In Progress', N'QA Passed', 50, 100, @Mark, @Sin, DATEADD(DAY, -35, @Now)),
(N'Task', @PmtBugTheme, N'Status/Percent Changed', N'QA reproduced the dropdown contrast issue.', N'Todo', N'QA Failed', 0, 100, @Sam, @Sin, DATEADD(DAY, -36, @Now)),
(N'Task', @PmtThemeBugFix, N'Status/Percent Changed', N'Developer corrected select option colors.', N'Todo', N'Code Complete', 0, 100, @Mark, @Sin, DATEADD(DAY, -35, @Now)),
(N'Task', @PmtBugTheme, N'Status/Percent Changed', N'Bug percent reset to 0 for QA retest.', N'QA Failed', N'QA Failed', 100, 0, @Mark, @Sin, DATEADD(DAY, -35, @Now)),
(N'Task', @PmtBugTheme, N'Status/Percent Changed', N'QA passed the themed dropdown retest.', N'QA Failed', N'QA Passed', 0, 100, @Sam, @Sin, DATEADD(DAY, -34, @Now)),
(N'Task', @PmtFiltersParent, N'Status/Percent Changed', N'Parent percent recalculated after the filter subtasks passed QA.', N'In Progress', N'QA Passed', 67, 100, @Jensen, @Sin, DATEADD(DAY, -20, @Now)),
(N'Task', @PmtGanttLabelBugFix, N'Status/Percent Changed', N'Developer reduced crowded day labels on compressed timelines.', N'Todo', N'Code Complete', 0, 100, @Jensen, @Sin, DATEADD(DAY, -4, @Now)),
(N'Task', @PmtBugGanttLabels, N'Status/Percent Changed', N'QA passed the Gantt header label retest.', N'QA in Progress', N'QA Passed', 0, 100, @Sam, @Sin, DATEADD(DAY, -3, @Now)),
(N'Task', @PmtAuditParent, N'Status/Percent Changed', N'Parent percent recalculated from audit and Development settings sub-tasks.', N'Todo', N'In Progress', 0, 70, @Steve, @Sin, @Now),
(N'Task', @PmtBugGanttJump, N'Status/Percent Changed', N'QA failed the fly-by bug expansion behavior and returned it to development.', N'QA in Progress', N'QA Failed', 0, 100, @Sam, @Sin, DATEADD(HOUR, 2, @Now)),
(N'Task', @PmtGanttJumpBugFix, N'Status/Percent Changed', N'Developer started preserving the Gantt viewport while expanding bug rows.', N'Todo', N'In Progress', 0, 75, @Jensen, @Sin, DATEADD(HOUR, 3, @Now));

INSERT INTO [pmt].[DevLogs] ([ProjectId], [UserId], [LogDate], [BodyHtml], [IsPinned], [CreatedByUserId])
VALUES
(@PmtProject, @Bill, DATEADD(DAY, -52, @Today), N'<p><strong>What did you accomplish yesterday?</strong></p><ul><li>Created the pmt schema and the first stored procedures.</li><li>Seeded the default admin account and starter lookup values.</li></ul><p><strong>What do you plan to do today?</strong></p><ul><li>Wire ADO.NET calls for Projects, Sprints, and Dev Tasks.</li><li>Add seed data for project members and Sprint developers.</li><li>Document the login assumptions for QA.</li></ul><p><strong>Do you have any roadblocks?</strong></p><ul><li>Need the final starter-user list before locking the seed script.</li></ul>', 0, @Sin),
(@PmtProject, @Mark, DATEADD(DAY, -39, @Today), N'<p><strong>What did you accomplish yesterday?</strong></p><ul><li>Wired the Project, Sprint, and Dev Task ADO.NET calls.</li><li>Added the project member and Sprint developer seed data.</li><li>Carried the login documentation forward for one more review.</li></ul><p><strong>What do you plan to do today?</strong></p><ul><li>Restyle dropdowns and file upload controls for the dark theme.</li><li>Start the Kanban Board drag behavior.</li></ul><p><strong>Do you have any roadblocks?</strong></p><ul><li>No blockers.</li></ul>', 0, @Sin),
(@PmtProject, @Jensen, DATEADD(DAY, -24, @Today), N'<p><strong>What did you accomplish yesterday?</strong></p><ul><li>Restyled the dark-theme dropdowns and file upload controls.</li><li>Finished the first Kanban Board drag pass.</li><li>Left one keyboard-drag polish item for later.</li></ul><p><strong>What do you plan to do today?</strong></p><ul><li>Connect Project and Sprint clicks to filtered views.</li><li>Add the advanced Dev Task filters.</li><li>Prepare QA notes for the filter state behavior.</li></ul><p><strong>Do you have any roadblocks?</strong></p><ul><li>Need one more QA pass on filter state.</li></ul>', 0, @Sin),
(@PmtProject, @Steve, DATEADD(DAY, -12, @Today), N'<p><strong>What did you accomplish yesterday?</strong></p><ul><li>Connected Project and Sprint clicks to the filtered views.</li><li>Added the advanced Dev Task filters.</li><li>Carried one filter-state edge case into the next QA sweep.</li></ul><p><strong>What do you plan to do today?</strong></p><ul><li>Add Holiday maintenance and start Road Map rendering.</li><li>Make Projects and Sprints clickable on the Road Map.</li></ul><p><strong>Do you have any roadblocks?</strong></p><ul><li>No blockers.</li></ul>', 0, @Sin),
(@PmtProject, @Sin, @Today, N'<p><strong>What did you accomplish yesterday?</strong></p><ul><li>Added Holiday maintenance and Road Map rendering.</li><li>Made Projects and Sprints clickable on the Road Map.</li><li>Verified Development cleanup and seed restore flows.</li></ul><p><strong>What do you plan to do today?</strong></p><ul><li>Add the linked-bug completion guard.</li><li>Wire the theme toggle through the shared shell.</li><li>Review the Scrum starter text and seed data.</li></ul><p><strong>Do you have any roadblocks?</strong></p><ul><li>No blockers.</li></ul>', 1, @Sin);

INSERT INTO [pmt].[Blogs] ([ProjectId], [SprintId], [Title], [BodyHtml], [CreatedByUserId], [UpdatedByUserId], [CreatedAt], [UpdatedAt])
VALUES
(
    @PmtProject,
    @PmtSprint1,
    N'PMT Day 1 - Foundation Build and ADO.NET Decision',
    N'<p><img src="/assets/docs/pmt-doc-day01-v2.jpg" alt="PMT foundation diagram showing .NET, ADO.NET, stored procedures, and the pmt schema"></p><p>Day 1 established the core PMT direction: a simple .NET web application, ADO.NET data access, stored procedures, and a dedicated pmt schema for every database object.</p><ul><li>Created the login screen and default Password1 user setup.</li><li>Started the PMT seed data and schema scripts.</li><li>Kept the code intentionally simple for junior developer handoff.</li></ul>',
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
    N'PMT Reorder Design Note'
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
