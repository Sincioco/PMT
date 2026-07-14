/*
    PMT Version 1.15 base seed data.

    This script resets disposable development data, then seeds shared data:
    - Users
    - Lookup values
    - Philippine holidays used by Gantt, Road Map, and Scrum seed checks

    Project-specific PMT, LMS, and HLS demo data lives in separate seed files.
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
        N'+63 (966) 230-4023', N'/assets/avatar-sin.jpg?v=20260629-avatar-jpg-assets', @PasswordHash,
        N'PMT creator and administrator.', 1, N'Admin', 1
    );
END;

DECLARE @Sin INT = (SELECT [UserId] FROM [pmt].[Users] WHERE [Email] = N'louiery@gmail.com');

UPDATE [pmt].[Users]
SET
    [FirstName] = N'Louiery',
    [LastName] = N'Sincioco',
    [Nickname] = N'Sin',
    [Phone] = N'+63 (966) 230-4023',
    [AvatarUrl] = N'/assets/avatar-sin.jpg?v=20260629-avatar-jpg-assets',
    [PasswordHash] = @PasswordHash,
    [Bio] = N'PMT creator and administrator.',
    [IsAdmin] = 1,
    [Role] = N'Admin',
    [IsActive] = 1,
    [UpdatedByUserId] = @Sin,
    [UpdatedAt] = @Now
WHERE [UserId] = @Sin;

-- The user said no development data needs to be preserved.
IF OBJECT_ID(N'[pmt].[UserPermissions]', N'U') IS NOT NULL DELETE FROM [pmt].[UserPermissions];
IF OBJECT_ID(N'[pmt].[RolePermissions]', N'U') IS NOT NULL DELETE FROM [pmt].[RolePermissions];
IF OBJECT_ID(N'[pmt].[SecurityResources]', N'U') IS NOT NULL DELETE FROM [pmt].[SecurityResources];
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
IF OBJECT_ID(N'[pmt].[WfhSchedules]', N'U') IS NOT NULL
BEGIN
    DELETE FROM [pmt].[WfhSchedules];
END;
DELETE FROM [pmt].[Users] WHERE [UserId] <> @Sin;

INSERT INTO [pmt].[Users]
(
    [FirstName], [LastName], [Nickname], [Email], [Phone], [AvatarUrl],
    [PasswordHash], [HomePageUrl], [SocialMediaUrl], [Bio], [IsAdmin],
    [Role], [CreatedByUserId]
)
VALUES
(N'Bill', N'Gates', N'Bill', N'bill.gates@microsoft.com', N'555-0102', N'/assets/avatar-bill-gates.jpg?v=20260629-avatar-jpg-assets', @PasswordHash, N'https://www.gatesnotes.com/', N'https://www.linkedin.com/in/williamhgates/', N'Backend developer focused on APIs and database work.', 0, N'Developer', @Sin),
(N'Sam', N'Altman', N'Sam', N'sam.altman@openai.com', N'555-0103', N'/assets/avatar-sam-altman.jpg?v=20260629-avatar-jpg-assets', @PasswordHash, N'https://blog.samaltman.com/', N'https://www.linkedin.com/in/samaltman/', N'QA lead who keeps acceptance criteria and bug reports clear.', 0, N'QA', @Sin),
(N'Mark', N'Zuckerberg', N'Mark', N'mark.zuckerberg@meta.com', N'555-0104', N'/assets/avatar-mark-zuckerberg.jpg?v=20260629-avatar-jpg-assets', @PasswordHash, N'https://about.meta.com/', N'https://www.linkedin.com/in/zuck/', N'Frontend developer focused on usability and interaction details.', 0, N'Developer', @Sin),
(N'Steve', N'Jobs', N'Steve', N'steve.jobs@apple.com', N'555-0105', N'/assets/avatar-steve-jobs.jpg?v=20260629-avatar-jpg-assets', @PasswordHash, N'https://www.apple.com/', N'https://www.linkedin.com/', N'Product-minded developer who helps sharpen feature scope.', 0, N'Developer', @Sin),
(N'Jensen', N'Huang', N'Jensen Huang', N'Jensen.Huang@nvidia.com', N'555-0106', N'/assets/avatar-jensen-huang.jpg?v=20260629-avatar-jpg-assets', @PasswordHash, N'https://www.nvidia.com/', N'https://www.linkedin.com/in/jenhsunhuang/', N'Integration developer who helps with performance and release support.', 0, N'Developer', @Sin);

DECLARE @Bill INT = (SELECT [UserId] FROM [pmt].[Users] WHERE [Nickname] = N'Bill');
DECLARE @Sam INT = (SELECT [UserId] FROM [pmt].[Users] WHERE [Nickname] = N'Sam');
DECLARE @Mark INT = (SELECT [UserId] FROM [pmt].[Users] WHERE [Nickname] = N'Mark');
DECLARE @Steve INT = (SELECT [UserId] FROM [pmt].[Users] WHERE [Nickname] = N'Steve');
DECLARE @Jensen INT = (SELECT [UserId] FROM [pmt].[Users] WHERE [Nickname] = N'Jensen Huang');

INSERT INTO [pmt].[Lookups] ([LookupType], [Value], [ColorHex], [DisplayOrder], [IsActive], [CreatedByUserId])
VALUES
(N'Status', N'Backlog', N'#6B7680', 10, 1, @Sin),
(N'Status', N'Todo', N'#76A9FF', 20, 1, @Sin),
(N'Status', N'In Progress', N'#35C7BD', 30, 1, @Sin),
(N'Status', N'Code Complete', N'#8AD17C', 40, 1, @Sin),
(N'Status', N'Ready for QA', N'#76A9FF', 50, 1, @Sin),
(N'Status', N'QA in Progress', N'#E4A53A', 60, 1, @Sin),
(N'Status', N'QA Failed', N'#EE6B70', 70, 1, @Sin),
(N'Status', N'QA Passed', N'#8AD17C', 80, 1, @Sin),
(N'Status', N'Deployed in SIT', N'#76A9FF', 90, 1, @Sin),
(N'Status', N'Deployed in UAT', N'#E4C63A', 100, 1, @Sin),
(N'Status', N'Deployed in Prod', N'#8AD17C', 110, 1, @Sin),
(N'Priority', N'Lowest', NULL, 10, 1, @Sin),
(N'Priority', N'Low', NULL, 20, 1, @Sin),
(N'Priority', N'Medium', NULL, 30, 1, @Sin),
(N'Priority', N'High', NULL, 40, 1, @Sin),
(N'Priority', N'Highest', NULL, 50, 1, @Sin),
(N'Severity', N'Trivial', NULL, 10, 1, @Sin),
(N'Severity', N'Minor', '#76A9FF', 20, 1, @Sin),
(N'Severity', N'Major', '#E4C63A', 30, 1, @Sin),
(N'Severity', N'Critical', '#EE6B70', 40, 1, @Sin),
(N'Environment', N'local', NULL, 10, 1, @Sin),
(N'Environment', N'Dev', NULL, 20, 1, @Sin),
(N'Environment', N'SIT', NULL, 30, 1, @Sin),
(N'Environment', N'UAT', NULL, 40, 1, @Sin),
(N'Environment', N'Production', NULL, 50, 1, @Sin),
(N'LogCategory', N'General', NULL, 10, 1, @Sin),
(N'LogCategory', N'Knowledge', NULL, 20, 1, @Sin),
(N'LogCategory', N'Notes', NULL, 30, 1, @Sin);

INSERT INTO [pmt].[Lookups] ([LookupType], [Value], [Code], [ColorHex], [DisplayOrder], [IsActive], [CreatedByUserId])
VALUES
(N'Role', N'Admin', N'Admin', NULL, 10, 1, @Sin),
(N'Role', N'Dev - Developer', N'Developer', NULL, 20, 1, @Sin),
(N'Role', N'QA - Quality Assurance', N'QA', NULL, 30, 1, @Sin),
(N'Role', N'SA - Systems Analyst', N'SA', NULL, 40, 1, @Sin),
(N'Role', N'TL - Technical Lead', N'TL', NULL, 50, 1, @Sin),
(N'Role', N'PM - Project Manager', N'PM', NULL, 60, 1, @Sin),
(N'Role', N'QA - Manual', N'QA Manual', NULL, 70, 1, @Sin),
(N'Role', N'QA - Automation', N'QA Automation', NULL, 80, 1, @Sin),
(N'Role', N'TM - Test Manager', N'TM', NULL, 90, 1, @Sin);

INSERT INTO [pmt].[SecurityResources] ([ResourceKey], [Name], [AvailableRights], [DisplayOrder])
VALUES
(N'Dashboard', N'Dashboard', N'Read', 10),
(N'RoadMap', N'Road Map', N'Read', 20),
(N'Gantt', N'Gantt Chart', N'Read', 30),
(N'Projects', N'Projects', N'Read,Create,Update,Delete', 40),
(N'Sprints', N'Sprints', N'Read,Create,Update,Delete', 50),
(N'Board', N'Kanban Board', N'Read,Update,Export', 60),
(N'DevTasks', N'Dev Tasks', N'Read,Create,Update,Delete,Import,Export', 70),
(N'BugTracking', N'Bug Tracking', N'Read,Create,Update,Delete,Import,Export', 80),
(N'Scrum', N'Scrum', N'Read,Create,Update,Delete,Import,Export', 90),
(N'Documentation', N'Documentation', N'Read,Create,Update,Delete,Import,Export', 100),
(N'PersonalLog', N'Log', N'Read,Create,Update,Delete,Import,Export', 110),
(N'Backlog', N'Backlog', N'Read,Create,Update,Delete,Import,Export', 120),
(N'WfhSchedule', N'WFH Schedule', N'Read,Update,Export', 130),
(N'Settings', N'Settings', N'Read,Create,Update,Delete', 140);

-- Every non-admin Role can read PMT. Common team rights are applied first,
-- followed by the built-in Role defaults for each discipline.
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

-- Version 1.10 and later databases already use complete replacement-style user
-- overrides. The forward migration uses the same marker to make reruns safe.
IF NOT EXISTS
(
    SELECT 1
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_SecurityOverrideMode'
)
BEGIN
    EXEC sys.sp_addextendedproperty
        @name = N'PMT_SecurityOverrideMode',
        @value = N'Replacement';
END;

-- Mark the fresh-build role defaults so the 1.9-to-1.10 migration cannot
-- overwrite later administrator changes if the migration chain is rerun.
IF NOT EXISTS
(
    SELECT 1
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_SecurityRoleDefaultsVersion'
)
BEGIN
    EXEC sys.sp_addextendedproperty
        @name = N'PMT_SecurityRoleDefaultsVersion',
        @value = N'1.10';
END;

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

GO
