/*
    PMT Version 1.27 database and schema script.
    Run this first. It creates the database, the pmt schema, the application
    tables, and the single required administrator account. The companion
    procedure and seed scripts complete the current fresh-install contract.
*/

IF DB_ID(N'PMT') IS NULL
BEGIN
    CREATE DATABASE [PMT];
END;
GO

USE [PMT];
GO

SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
GO

IF SCHEMA_ID(N'pmt') IS NULL
BEGIN
    EXEC(N'CREATE SCHEMA [pmt]');
END;
GO

IF OBJECT_ID(N'[pmt].[Users]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[Users]
    (
        [UserId] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_pmt_Users] PRIMARY KEY,
        [FirstName] NVARCHAR(80) NOT NULL,
        [LastName] NVARCHAR(80) NOT NULL,
        [Nickname] NVARCHAR(80) NOT NULL,
        [Email] NVARCHAR(180) NULL,
        [Phone] NVARCHAR(60) NULL,
        [AvatarUrl] NVARCHAR(500) NULL,
        [PasswordHash] VARBINARY(32) NOT NULL CONSTRAINT [DF_pmt_Users_PasswordHash] DEFAULT (HASHBYTES('SHA2_256', CONVERT(NVARCHAR(4000), N'Password1'))),
        [HomePageUrl] NVARCHAR(500) NULL,
        [SocialMediaUrl] NVARCHAR(500) NULL,
        [Bio] NVARCHAR(MAX) NULL,
        [IsAdmin] BIT NOT NULL CONSTRAINT [DF_pmt_Users_IsAdmin] DEFAULT (0),
        [IsActive] BIT NOT NULL CONSTRAINT [DF_pmt_Users_IsActive] DEFAULT (1),
        [CreatedByUserId] INT NOT NULL,
        [UpdatedByUserId] INT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_Users_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_Users_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
        [RowVersion] ROWVERSION NOT NULL,
        CONSTRAINT [FK_pmt_Users_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_Users_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId])
    );
END;
GO

IF COL_LENGTH(N'pmt.Users', N'PasswordHash') IS NULL
BEGIN
    ALTER TABLE [pmt].[Users]
    ADD [PasswordHash] VARBINARY(32) NOT NULL
        CONSTRAINT [DF_pmt_Users_PasswordHash] DEFAULT (HASHBYTES('SHA2_256', CONVERT(NVARCHAR(4000), N'Password1')));
END;
GO

IF COL_LENGTH(N'pmt.Users', N'Role') IS NULL
BEGIN
    ALTER TABLE [pmt].[Users]
    ADD [Role] NVARCHAR(20) NOT NULL
        CONSTRAINT [DF_pmt_Users_Role] DEFAULT (N'Developer');
END;
GO

IF NOT EXISTS (SELECT 1 FROM [pmt].[Users] WHERE [Email] = N'louiery@gmail.com')
BEGIN
    INSERT INTO [pmt].[Users]
    (
        [FirstName],
        [LastName],
        [Nickname],
        [Email],
        [Phone],
        [AvatarUrl],
        [PasswordHash],
        [HomePageUrl],
        [SocialMediaUrl],
        [Bio],
        [IsAdmin],
        [Role],
        [CreatedByUserId]
    )
    VALUES
    (
        N'Louiery',
        N'Sincioco',
        N'Sin',
        N'louiery@gmail.com',
        N'+63 (966) 230-4023',
        N'/assets/avatar-sin.jpg?v=20260629-avatar-jpg-assets',
        HASHBYTES('SHA2_256', CONVERT(NVARCHAR(4000), N'Password1')),
        N'',
        N'',
        N'PMT creator and administrator.',
        1,
        N'Developer',
        1
    );
END;
GO

IF OBJECT_ID(N'[pmt].[UserLoginActivity]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[UserLoginActivity]
    (
        [UserId] INT NOT NULL CONSTRAINT [PK_pmt_UserLoginActivity] PRIMARY KEY,
        [LastLoginAt] DATETIME2(0) NOT NULL,
        CONSTRAINT [FK_pmt_UserLoginActivity_User] FOREIGN KEY ([UserId])
            REFERENCES [pmt].[Users]([UserId]) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'[pmt].[UserImageAnnotationTemplateLibraries]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[UserImageAnnotationTemplateLibraries]
    (
        [UserId] INT NOT NULL CONSTRAINT [PK_pmt_UserImageAnnotationTemplateLibraries] PRIMARY KEY,
        [LibraryJson] NVARCHAR(MAX) NOT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_UserImageAnnotationTemplateLibraries_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_UserImageAnnotationTemplateLibraries_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_pmt_UserImageAnnotationTemplateLibraries_User] FOREIGN KEY ([UserId])
            REFERENCES [pmt].[Users]([UserId]) ON DELETE CASCADE,
        CONSTRAINT [CK_pmt_UserImageAnnotationTemplateLibraries_Json] CHECK (ISJSON([LibraryJson]) = 1),
        CONSTRAINT [CK_pmt_UserImageAnnotationTemplateLibraries_Version] CHECK (TRY_CONVERT(INT, JSON_VALUE([LibraryJson], N'$.version')) = 1),
        CONSTRAINT [CK_pmt_UserImageAnnotationTemplateLibraries_Size] CHECK (DATALENGTH([LibraryJson]) <= 104857600)
    );
END;
GO

IF OBJECT_ID(N'[pmt].[ImageAnnotationDefaultTemplateLibraries]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[ImageAnnotationDefaultTemplateLibraries]
    (
        [DefaultLibraryId] TINYINT NOT NULL CONSTRAINT [PK_pmt_ImageAnnotationDefaultTemplateLibraries] PRIMARY KEY,
        [LibraryJson] NVARCHAR(MAX) NOT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_ImageAnnotationDefaultTemplateLibraries_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_ImageAnnotationDefaultTemplateLibraries_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [CK_pmt_ImageAnnotationDefaultTemplateLibraries_Id] CHECK ([DefaultLibraryId] = 1),
        CONSTRAINT [CK_pmt_ImageAnnotationDefaultTemplateLibraries_Json] CHECK (ISJSON([LibraryJson]) = 1),
        CONSTRAINT [CK_pmt_ImageAnnotationDefaultTemplateLibraries_Version] CHECK (TRY_CONVERT(INT, JSON_VALUE([LibraryJson], N'$.version')) = 1),
        CONSTRAINT [CK_pmt_ImageAnnotationDefaultTemplateLibraries_Size] CHECK (DATALENGTH([LibraryJson]) <= 104857600)
    );
END;
GO

IF OBJECT_ID(N'[pmt].[WfhSchedules]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[WfhSchedules]
    (
        [UserId] INT NOT NULL CONSTRAINT [PK_pmt_WfhSchedules] PRIMARY KEY,
        [CanWorkMonday] BIT NOT NULL CONSTRAINT [DF_pmt_WfhSchedules_CanWorkMonday] DEFAULT (0),
        [CanWorkTuesday] BIT NOT NULL CONSTRAINT [DF_pmt_WfhSchedules_CanWorkTuesday] DEFAULT (0),
        [CanWorkWednesday] BIT NOT NULL CONSTRAINT [DF_pmt_WfhSchedules_CanWorkWednesday] DEFAULT (0),
        [CanWorkThursday] BIT NOT NULL CONSTRAINT [DF_pmt_WfhSchedules_CanWorkThursday] DEFAULT (0),
        [CanWorkFriday] BIT NOT NULL CONSTRAINT [DF_pmt_WfhSchedules_CanWorkFriday] DEFAULT (0),
        [IsHidden] BIT NOT NULL CONSTRAINT [DF_pmt_WfhSchedules_IsHidden] DEFAULT (0),
        [SortOrder] INT NOT NULL CONSTRAINT [DF_pmt_WfhSchedules_SortOrder] DEFAULT (0),
        [CreatedByUserId] INT NOT NULL,
        [UpdatedByUserId] INT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_WfhSchedules_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_WfhSchedules_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
        [RowVersion] ROWVERSION NOT NULL,
        CONSTRAINT [FK_pmt_WfhSchedules_User] FOREIGN KEY ([UserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_WfhSchedules_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_WfhSchedules_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId])
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_pmt_WfhSchedules_SortOrder' AND [object_id] = OBJECT_ID(N'[pmt].[WfhSchedules]'))
BEGIN
    CREATE INDEX [IX_pmt_WfhSchedules_SortOrder] ON [pmt].[WfhSchedules]([SortOrder], [UserId]);
END;
GO

IF OBJECT_ID(N'[pmt].[AttendanceEntries]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[AttendanceEntries]
    (
        [AttendanceEntryId] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_pmt_AttendanceEntries] PRIMARY KEY,
        [UserId] INT NOT NULL,
        [AttendanceDate] DATE NOT NULL,
        [Status] NVARCHAR(20) NOT NULL,
        [CreatedByUserId] INT NOT NULL,
        [UpdatedByUserId] INT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_AttendanceEntries_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_AttendanceEntries_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_pmt_AttendanceEntries_User] FOREIGN KEY ([UserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_AttendanceEntries_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_AttendanceEntries_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [CK_pmt_AttendanceEntries_Status] CHECK ([Status] IN (N'Home', N'Office', N'Sick Leave', N'Vacation', N'EL', N'Other')),
        CONSTRAINT [UQ_pmt_AttendanceEntries_UserDateStatus] UNIQUE ([UserId], [AttendanceDate], [Status])
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_pmt_AttendanceEntries_DateStatusUser' AND [object_id] = OBJECT_ID(N'[pmt].[AttendanceEntries]'))
BEGIN
    CREATE INDEX [IX_pmt_AttendanceEntries_DateStatusUser]
        ON [pmt].[AttendanceEntries]([AttendanceDate], [Status], [UserId]);
END;
GO

IF OBJECT_ID(N'[pmt].[VacationPlans]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[VacationPlans]
    (
        [VacationPlanId] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_pmt_VacationPlans] PRIMARY KEY,
        [UserId] INT NOT NULL,
        [StartDate] DATE NOT NULL,
        [EndDate] DATE NOT NULL,
        [IsCancelled] BIT NOT NULL CONSTRAINT [DF_pmt_VacationPlans_IsCancelled] DEFAULT (0),
        [CreatedByUserId] INT NOT NULL,
        [UpdatedByUserId] INT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_VacationPlans_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_VacationPlans_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
        [RowVersion] ROWVERSION NOT NULL,
        CONSTRAINT [FK_pmt_VacationPlans_User] FOREIGN KEY ([UserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_VacationPlans_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_VacationPlans_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [CK_pmt_VacationPlans_DateRange] CHECK ([EndDate] >= [StartDate])
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_pmt_VacationPlans_ActiveDateRange' AND [object_id] = OBJECT_ID(N'[pmt].[VacationPlans]'))
BEGIN
    CREATE INDEX [IX_pmt_VacationPlans_ActiveDateRange]
        ON [pmt].[VacationPlans]([IsCancelled], [StartDate], [EndDate], [UserId]);
END;
GO

IF OBJECT_ID(N'[pmt].[Lookups]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[Lookups]
    (
        [LookupId] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_pmt_Lookups] PRIMARY KEY,
        [LookupType] NVARCHAR(60) NOT NULL,
        [Value] NVARCHAR(120) NOT NULL,
        [Code] NVARCHAR(20) NULL,
        [ColorHex] NVARCHAR(20) NULL,
        [DisplayOrder] INT NOT NULL CONSTRAINT [DF_pmt_Lookups_DisplayOrder] DEFAULT (0),
        [IsActive] BIT NOT NULL CONSTRAINT [DF_pmt_Lookups_IsActive] DEFAULT (1),
        [CreatedByUserId] INT NOT NULL,
        [UpdatedByUserId] INT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_Lookups_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_Lookups_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
        [RowVersion] ROWVERSION NOT NULL,
        CONSTRAINT [FK_pmt_Lookups_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_Lookups_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [UQ_pmt_Lookups_TypeValue] UNIQUE ([LookupType], [Value])
    );
END;
GO

IF COL_LENGTH(N'pmt.Lookups', N'Code') IS NOT NULL
AND NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE [name] = N'UX_pmt_Lookups_TypeCode'
      AND [object_id] = OBJECT_ID(N'[pmt].[Lookups]')
)
BEGIN
    CREATE UNIQUE INDEX [UX_pmt_Lookups_TypeCode]
        ON [pmt].[Lookups]([LookupType], [Code])
        WHERE [Code] IS NOT NULL;
END;
GO

IF OBJECT_ID(N'[pmt].[SecurityResources]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[SecurityResources]
    (
        [ResourceKey] NVARCHAR(40) NOT NULL CONSTRAINT [PK_pmt_SecurityResources] PRIMARY KEY,
        [Name] NVARCHAR(80) NOT NULL,
        [AvailableRights] NVARCHAR(100) NOT NULL CONSTRAINT [DF_pmt_SecurityResources_AvailableRights] DEFAULT (N'Read'),
        [DisplayOrder] INT NOT NULL CONSTRAINT [DF_pmt_SecurityResources_DisplayOrder] DEFAULT (0),
        [RowVersion] ROWVERSION NOT NULL
    );
END;
GO

IF OBJECT_ID(N'[pmt].[RolePermissions]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[RolePermissions]
    (
        [RoleCode] NVARCHAR(20) NOT NULL,
        [ResourceKey] NVARCHAR(40) NOT NULL,
        [CanRead] BIT NOT NULL CONSTRAINT [DF_pmt_RolePermissions_CanRead] DEFAULT (0),
        [CanCreate] BIT NOT NULL CONSTRAINT [DF_pmt_RolePermissions_CanCreate] DEFAULT (0),
        [CanUpdate] BIT NOT NULL CONSTRAINT [DF_pmt_RolePermissions_CanUpdate] DEFAULT (0),
        [CanDelete] BIT NOT NULL CONSTRAINT [DF_pmt_RolePermissions_CanDelete] DEFAULT (0),
        [CanImport] BIT NOT NULL CONSTRAINT [DF_pmt_RolePermissions_CanImport] DEFAULT (0),
        [CanExport] BIT NOT NULL CONSTRAINT [DF_pmt_RolePermissions_CanExport] DEFAULT (0),
        [NoAccess] BIT NOT NULL CONSTRAINT [DF_pmt_RolePermissions_NoAccess] DEFAULT (0),
        CONSTRAINT [PK_pmt_RolePermissions] PRIMARY KEY ([RoleCode], [ResourceKey]),
        CONSTRAINT [FK_pmt_RolePermissions_Resource] FOREIGN KEY ([ResourceKey]) REFERENCES [pmt].[SecurityResources]([ResourceKey])
    );
END;
GO

IF OBJECT_ID(N'[pmt].[UserPermissions]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[UserPermissions]
    (
        [UserId] INT NOT NULL,
        [ResourceKey] NVARCHAR(40) NOT NULL,
        [CanRead] BIT NOT NULL CONSTRAINT [DF_pmt_UserPermissions_CanRead] DEFAULT (0),
        [CanCreate] BIT NOT NULL CONSTRAINT [DF_pmt_UserPermissions_CanCreate] DEFAULT (0),
        [CanUpdate] BIT NOT NULL CONSTRAINT [DF_pmt_UserPermissions_CanUpdate] DEFAULT (0),
        [CanDelete] BIT NOT NULL CONSTRAINT [DF_pmt_UserPermissions_CanDelete] DEFAULT (0),
        [CanImport] BIT NOT NULL CONSTRAINT [DF_pmt_UserPermissions_CanImport] DEFAULT (0),
        [CanExport] BIT NOT NULL CONSTRAINT [DF_pmt_UserPermissions_CanExport] DEFAULT (0),
        [NoAccess] BIT NOT NULL CONSTRAINT [DF_pmt_UserPermissions_NoAccess] DEFAULT (0),
        CONSTRAINT [PK_pmt_UserPermissions] PRIMARY KEY ([UserId], [ResourceKey]),
        CONSTRAINT [FK_pmt_UserPermissions_User] FOREIGN KEY ([UserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_UserPermissions_Resource] FOREIGN KEY ([ResourceKey]) REFERENCES [pmt].[SecurityResources]([ResourceKey])
    );
END;
GO

IF OBJECT_ID(N'[pmt].[Projects]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[Projects]
    (
        [ProjectId] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_pmt_Projects] PRIMARY KEY,
        [Code] NVARCHAR(5) NOT NULL,
        [Title] NVARCHAR(30) NOT NULL,
        [Description] NVARCHAR(100) NULL,
        [Url] NVARCHAR(500) NULL,
        [IconUrl] NVARCHAR(500) NULL,
        [StartDate] DATETIME2(0) NULL,
        [EndDate] DATETIME2(0) NULL,
        [CreatedByUserId] INT NOT NULL,
        [UpdatedByUserId] INT NULL,
        [IsArchived] BIT NOT NULL CONSTRAINT [DF_pmt_Projects_IsArchived] DEFAULT (0),
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_Projects_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_Projects_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
        [RowVersion] ROWVERSION NOT NULL,
        CONSTRAINT [FK_pmt_Projects_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_Projects_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [UQ_pmt_Projects_Code] UNIQUE ([Code])
    );
END;
GO

IF OBJECT_ID(N'[pmt].[ProjectMembers]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[ProjectMembers]
    (
        [ProjectId] INT NOT NULL,
        [UserId] INT NOT NULL,
        [CreatedByUserId] INT NOT NULL,
        [UpdatedByUserId] INT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_ProjectMembers_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NULL,
        CONSTRAINT [PK_pmt_ProjectMembers] PRIMARY KEY ([ProjectId], [UserId]),
        CONSTRAINT [FK_pmt_ProjectMembers_Project] FOREIGN KEY ([ProjectId]) REFERENCES [pmt].[Projects]([ProjectId]),
        CONSTRAINT [FK_pmt_ProjectMembers_User] FOREIGN KEY ([UserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_ProjectMembers_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_ProjectMembers_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId])
    );
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE [name] = N'IX_pmt_ProjectMembers_UserId'
      AND [object_id] = OBJECT_ID(N'[pmt].[ProjectMembers]')
)
BEGIN
    CREATE INDEX [IX_pmt_ProjectMembers_UserId]
        ON [pmt].[ProjectMembers]([UserId], [ProjectId]);
END;
GO

IF OBJECT_ID(N'[pmt].[UserInvitations]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[UserInvitations]
    (
        [UserInvitationId] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_pmt_UserInvitations] PRIMARY KEY,
        [TokenHash] VARBINARY(32) NOT NULL,
        [ExpiresAt] DATETIME2(0) NOT NULL,
        [CreatedByUserId] INT NOT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_UserInvitations_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_pmt_UserInvitations_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE [name] = N'UX_pmt_UserInvitations_TokenHash'
      AND [object_id] = OBJECT_ID(N'[pmt].[UserInvitations]')
)
BEGIN
    CREATE UNIQUE INDEX [UX_pmt_UserInvitations_TokenHash]
        ON [pmt].[UserInvitations]([TokenHash]);
END;
GO

IF OBJECT_ID(N'[pmt].[UserInvitationProjects]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[UserInvitationProjects]
    (
        [UserInvitationId] INT NOT NULL,
        [ProjectId] INT NOT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_UserInvitationProjects_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_pmt_UserInvitationProjects] PRIMARY KEY ([UserInvitationId], [ProjectId]),
        CONSTRAINT [FK_pmt_UserInvitationProjects_Invitation] FOREIGN KEY ([UserInvitationId]) REFERENCES [pmt].[UserInvitations]([UserInvitationId]) ON DELETE CASCADE,
        CONSTRAINT [FK_pmt_UserInvitationProjects_Project] FOREIGN KEY ([ProjectId]) REFERENCES [pmt].[Projects]([ProjectId]) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'[pmt].[Sprints]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[Sprints]
    (
        [SprintId] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_pmt_Sprints] PRIMARY KEY,
        [ProjectId] INT NOT NULL,
        [Code] NVARCHAR(40) NOT NULL,
        [Title] NVARCHAR(160) NOT NULL,
        [Description] NVARCHAR(MAX) NULL,
        [StartDate] DATETIME2(0) NULL,
        [EndDate] DATETIME2(0) NULL,
        [LessonLearnedHtml] NVARCHAR(MAX) NULL,
        [IsFinished] BIT NOT NULL CONSTRAINT [DF_pmt_Sprints_IsFinished] DEFAULT (0),
        [IsDeleted] BIT NOT NULL CONSTRAINT [DF_pmt_Sprints_IsDeleted] DEFAULT (0),
        [CreatedByUserId] INT NOT NULL,
        [UpdatedByUserId] INT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_Sprints_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_Sprints_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
        [RowVersion] ROWVERSION NOT NULL,
        CONSTRAINT [FK_pmt_Sprints_Project] FOREIGN KEY ([ProjectId]) REFERENCES [pmt].[Projects]([ProjectId]),
        CONSTRAINT [FK_pmt_Sprints_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_Sprints_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [UQ_pmt_Sprints_Code] UNIQUE ([Code])
    );
END;
GO

IF OBJECT_ID(N'[pmt].[SprintMembers]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[SprintMembers]
    (
        [SprintId] INT NOT NULL,
        [UserId] INT NOT NULL,
        [CreatedByUserId] INT NOT NULL,
        [UpdatedByUserId] INT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_SprintMembers_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NULL,
        CONSTRAINT [PK_pmt_SprintMembers] PRIMARY KEY ([SprintId], [UserId]),
        CONSTRAINT [FK_pmt_SprintMembers_Sprint] FOREIGN KEY ([SprintId]) REFERENCES [pmt].[Sprints]([SprintId]),
        CONSTRAINT [FK_pmt_SprintMembers_User] FOREIGN KEY ([UserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_SprintMembers_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_SprintMembers_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId])
    );
END;
GO

IF OBJECT_ID(N'[pmt].[WorkTasks]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[WorkTasks]
    (
        [TaskId] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_pmt_WorkTasks] PRIMARY KEY,
        [ProjectId] INT NOT NULL,
        [SprintId] INT NULL,
        [ParentTaskId] INT NULL,
        [Code] NVARCHAR(40) NOT NULL,
        [Title] NVARCHAR(220) NOT NULL,
        [DescriptionHtml] NVARCHAR(MAX) NULL,
        [Status] NVARCHAR(40) NOT NULL CONSTRAINT [DF_pmt_WorkTasks_Status] DEFAULT (N'Todo'),
        [Priority] NVARCHAR(20) NOT NULL CONSTRAINT [DF_pmt_WorkTasks_Priority] DEFAULT (N'Low'),
        [SortOrder] INT NOT NULL CONSTRAINT [DF_pmt_WorkTasks_SortOrder] DEFAULT (0),
        [PercentCompleted] INT NOT NULL CONSTRAINT [DF_pmt_WorkTasks_PercentCompleted] DEFAULT (0),
        [Url] NVARCHAR(500) NULL,
        [StartDate] DATETIME2(0) NULL,
        [EndDate] DATETIME2(0) NULL,
        [StartedAt] DATETIME2(0) NULL,
        [CreatedByUserId] INT NOT NULL,
        [UpdatedByUserId] INT NULL,
        [IsDeleted] BIT NOT NULL CONSTRAINT [DF_pmt_WorkTasks_IsDeleted] DEFAULT (0),
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_WorkTasks_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_WorkTasks_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
        [RowVersion] ROWVERSION NOT NULL,
        CONSTRAINT [FK_pmt_WorkTasks_Project] FOREIGN KEY ([ProjectId]) REFERENCES [pmt].[Projects]([ProjectId]),
        CONSTRAINT [FK_pmt_WorkTasks_Sprint] FOREIGN KEY ([SprintId]) REFERENCES [pmt].[Sprints]([SprintId]),
        CONSTRAINT [FK_pmt_WorkTasks_ParentTask] FOREIGN KEY ([ParentTaskId]) REFERENCES [pmt].[WorkTasks]([TaskId]),
        CONSTRAINT [FK_pmt_WorkTasks_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_WorkTasks_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [CK_pmt_WorkTasks_Percent] CHECK ([PercentCompleted] BETWEEN 0 AND 100),
        CONSTRAINT [UQ_pmt_WorkTasks_Code] UNIQUE ([Code])
    );
END;
GO

IF OBJECT_ID(N'[pmt].[TaskAssignees]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[TaskAssignees]
    (
        [TaskId] INT NOT NULL,
        [UserId] INT NOT NULL,
        [CreatedByUserId] INT NOT NULL,
        [UpdatedByUserId] INT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_TaskAssignees_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NULL,
        CONSTRAINT [PK_pmt_TaskAssignees] PRIMARY KEY ([TaskId], [UserId]),
        CONSTRAINT [FK_pmt_TaskAssignees_Task] FOREIGN KEY ([TaskId]) REFERENCES [pmt].[WorkTasks]([TaskId]),
        CONSTRAINT [FK_pmt_TaskAssignees_User] FOREIGN KEY ([UserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_TaskAssignees_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_TaskAssignees_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId])
    );
END;
GO

IF COL_LENGTH(N'pmt.WorkTasks', N'SortOrder') IS NULL
BEGIN
    ALTER TABLE [pmt].[WorkTasks]
    ADD [SortOrder] INT NOT NULL
        CONSTRAINT [DF_pmt_WorkTasks_SortOrder] DEFAULT (0);
END;
GO

IF COL_LENGTH(N'pmt.WorkTasks', N'TaskType') IS NULL
BEGIN
    ALTER TABLE [pmt].[WorkTasks]
    ADD [TaskType] NVARCHAR(20) NOT NULL
        CONSTRAINT [DF_pmt_WorkTasks_TaskType] DEFAULT (N'Dev');
END;
GO

IF COL_LENGTH(N'pmt.WorkTasks', N'StepsToReproduceHtml') IS NULL
BEGIN
    ALTER TABLE [pmt].[WorkTasks] ADD [StepsToReproduceHtml] NVARCHAR(MAX) NULL;
END;
GO

IF COL_LENGTH(N'pmt.WorkTasks', N'ActualResultHtml') IS NULL
BEGIN
    ALTER TABLE [pmt].[WorkTasks] ADD [ActualResultHtml] NVARCHAR(MAX) NULL;
END;
GO

IF COL_LENGTH(N'pmt.WorkTasks', N'ExpectedResultHtml') IS NULL
BEGIN
    ALTER TABLE [pmt].[WorkTasks] ADD [ExpectedResultHtml] NVARCHAR(MAX) NULL;
END;
GO

IF COL_LENGTH(N'pmt.WorkTasks', N'RootCauseAnalysisHtml') IS NULL
BEGIN
    ALTER TABLE [pmt].[WorkTasks] ADD [RootCauseAnalysisHtml] NVARCHAR(MAX) NULL;
END;
GO

IF COL_LENGTH(N'pmt.WorkTasks', N'Environment') IS NULL
BEGIN
    ALTER TABLE [pmt].[WorkTasks] ADD [Environment] NVARCHAR(40) NULL;
END;
GO

IF COL_LENGTH(N'pmt.WorkTasks', N'Severity') IS NULL
BEGIN
    ALTER TABLE [pmt].[WorkTasks] ADD [Severity] NVARCHAR(40) NULL;
END;
GO

IF COL_LENGTH(N'pmt.WorkTasks', N'LinkedBugTaskId') IS NULL
BEGIN
    ALTER TABLE [pmt].[WorkTasks] ADD [LinkedBugTaskId] INT NULL;
END;
GO

IF COL_LENGTH(N'pmt.WorkTasks', N'LinkedBlogId') IS NULL
BEGIN
    ALTER TABLE [pmt].[WorkTasks] ADD [LinkedBlogId] INT NULL;
END;
GO

IF OBJECT_ID(N'[pmt].[TaskReporters]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[TaskReporters]
    (
        [TaskId] INT NOT NULL,
        [UserId] INT NOT NULL,
        [CreatedByUserId] INT NOT NULL,
        [UpdatedByUserId] INT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_TaskReporters_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NULL,
        CONSTRAINT [PK_pmt_TaskReporters] PRIMARY KEY ([TaskId], [UserId]),
        CONSTRAINT [FK_pmt_TaskReporters_Task] FOREIGN KEY ([TaskId]) REFERENCES [pmt].[WorkTasks]([TaskId]),
        CONSTRAINT [FK_pmt_TaskReporters_User] FOREIGN KEY ([UserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_TaskReporters_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_TaskReporters_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId])
    );
END;
GO

IF OBJECT_ID(N'[pmt].[TaskDependencies]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[TaskDependencies]
    (
        [TaskId] INT NOT NULL,
        [DependsOnTaskId] INT NOT NULL,
        [CreatedByUserId] INT NOT NULL,
        [UpdatedByUserId] INT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_TaskDependencies_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NULL,
        CONSTRAINT [PK_pmt_TaskDependencies] PRIMARY KEY ([TaskId], [DependsOnTaskId]),
        CONSTRAINT [FK_pmt_TaskDependencies_Task] FOREIGN KEY ([TaskId]) REFERENCES [pmt].[WorkTasks]([TaskId]),
        CONSTRAINT [FK_pmt_TaskDependencies_DependsOnTask] FOREIGN KEY ([DependsOnTaskId]) REFERENCES [pmt].[WorkTasks]([TaskId]),
        CONSTRAINT [FK_pmt_TaskDependencies_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_TaskDependencies_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [CK_pmt_TaskDependencies_NotSelf] CHECK ([TaskId] <> [DependsOnTaskId])
    );
END;
GO

IF OBJECT_ID(N'[pmt].[Attachments]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[Attachments]
    (
        [AttachmentId] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_pmt_Attachments] PRIMARY KEY,
        [FileName] NVARCHAR(260) NOT NULL,
        [Url] NVARCHAR(500) NOT NULL,
        [ContentType] NVARCHAR(160) NULL,
        [ByteLength] BIGINT NOT NULL,
        [UploadedByUserId] INT NOT NULL,
        [CreatedByUserId] INT NOT NULL,
        [UpdatedByUserId] INT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_Attachments_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NULL,
        CONSTRAINT [FK_pmt_Attachments_UploadedBy] FOREIGN KEY ([UploadedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_Attachments_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_Attachments_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId])
    );
END;
GO

IF OBJECT_ID(N'[pmt].[TaskAttachments]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[TaskAttachments]
    (
        [TaskId] INT NOT NULL,
        [AttachmentId] INT NOT NULL,
        [CreatedByUserId] INT NOT NULL,
        [UpdatedByUserId] INT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_TaskAttachments_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NULL,
        CONSTRAINT [PK_pmt_TaskAttachments] PRIMARY KEY ([TaskId], [AttachmentId]),
        CONSTRAINT [FK_pmt_TaskAttachments_Task] FOREIGN KEY ([TaskId]) REFERENCES [pmt].[WorkTasks]([TaskId]),
        CONSTRAINT [FK_pmt_TaskAttachments_Attachment] FOREIGN KEY ([AttachmentId]) REFERENCES [pmt].[Attachments]([AttachmentId]),
        CONSTRAINT [FK_pmt_TaskAttachments_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_TaskAttachments_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId])
    );
END;
GO

IF OBJECT_ID(N'[pmt].[DevLogs]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[DevLogs]
    (
        [DevLogId] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_pmt_DevLogs] PRIMARY KEY,
        [LogType] NVARCHAR(20) NOT NULL CONSTRAINT [DF_pmt_DevLogs_LogType] DEFAULT (N'Scrum'),
        [Category] NVARCHAR(60) NOT NULL CONSTRAINT [DF_pmt_DevLogs_Category] DEFAULT (N'General'),
        [ProjectId] INT NULL,
        [UserId] INT NOT NULL,
        [LogDate] DATETIME2(0) NOT NULL,
        [BodyHtml] NVARCHAR(MAX) NOT NULL,
        [IsPinned] BIT NOT NULL CONSTRAINT [DF_pmt_DevLogs_IsPinned] DEFAULT (0),
        [IsDeleted] BIT NOT NULL CONSTRAINT [DF_pmt_DevLogs_IsDeleted] DEFAULT (0),
        [CreatedByUserId] INT NOT NULL,
        [UpdatedByUserId] INT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_DevLogs_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_DevLogs_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
        [RowVersion] ROWVERSION NOT NULL,
        CONSTRAINT [FK_pmt_DevLogs_Project] FOREIGN KEY ([ProjectId]) REFERENCES [pmt].[Projects]([ProjectId]),
        CONSTRAINT [FK_pmt_DevLogs_User] FOREIGN KEY ([UserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_DevLogs_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_DevLogs_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId])
    );
END;
GO

IF COL_LENGTH(N'pmt.DevLogs', N'LogType') IS NULL
BEGIN
    ALTER TABLE [pmt].[DevLogs] ADD [LogType] NVARCHAR(20) NOT NULL CONSTRAINT [DF_pmt_DevLogs_LogType] DEFAULT (N'Scrum');
END;
GO

IF COL_LENGTH(N'pmt.DevLogs', N'Category') IS NULL
BEGIN
    ALTER TABLE [pmt].[DevLogs] ADD [Category] NVARCHAR(60) NOT NULL CONSTRAINT [DF_pmt_DevLogs_Category] DEFAULT (N'General') WITH VALUES;
END;
GO

IF COL_LENGTH(N'pmt.DevLogs', N'ProjectId') IS NULL
BEGIN
    ALTER TABLE [pmt].[DevLogs] ADD [ProjectId] INT NULL;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_pmt_DevLogs_Project')
BEGIN
    ALTER TABLE [pmt].[DevLogs]
    ADD CONSTRAINT [FK_pmt_DevLogs_Project] FOREIGN KEY ([ProjectId]) REFERENCES [pmt].[Projects]([ProjectId]);
END;
GO

IF OBJECT_ID(N'[pmt].[Blogs]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[Blogs]
    (
        [BlogId] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_pmt_Blogs] PRIMARY KEY,
        [ProjectId] INT NULL,
        [SprintId] INT NULL,
        [ParentBlogId] INT NULL,
        [Title] NVARCHAR(220) NOT NULL,
        [BodyHtml] NVARCHAR(MAX) NOT NULL,
        [IsPrivate] BIT NOT NULL CONSTRAINT [DF_pmt_Blogs_IsPrivate] DEFAULT (1),
        [IsPinned] BIT NOT NULL CONSTRAINT [DF_pmt_Blogs_IsPinned] DEFAULT (0),
        [SortOrder] INT NOT NULL CONSTRAINT [DF_pmt_Blogs_SortOrder] DEFAULT (0),
        [CreatedByUserId] INT NOT NULL,
        [UpdatedByUserId] INT NULL,
        [IsDeleted] BIT NOT NULL CONSTRAINT [DF_pmt_Blogs_IsDeleted] DEFAULT (0),
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_Blogs_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_Blogs_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
        [RowVersion] ROWVERSION NOT NULL,
        CONSTRAINT [FK_pmt_Blogs_Project] FOREIGN KEY ([ProjectId]) REFERENCES [pmt].[Projects]([ProjectId]),
        CONSTRAINT [FK_pmt_Blogs_Sprint] FOREIGN KEY ([SprintId]) REFERENCES [pmt].[Sprints]([SprintId]),
        CONSTRAINT [FK_pmt_Blogs_ParentBlog] FOREIGN KEY ([ParentBlogId]) REFERENCES [pmt].[Blogs]([BlogId]),
        CONSTRAINT [FK_pmt_Blogs_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_Blogs_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId])
    );
END;
GO

IF COL_LENGTH(N'pmt.Blogs', N'ProjectId') IS NULL
BEGIN
    ALTER TABLE [pmt].[Blogs] ADD [ProjectId] INT NULL;
END;
GO

IF COL_LENGTH(N'pmt.Blogs', N'SprintId') IS NULL
BEGIN
    ALTER TABLE [pmt].[Blogs] ADD [SprintId] INT NULL;
END;
GO

IF COL_LENGTH(N'pmt.Blogs', N'ParentBlogId') IS NULL
BEGIN
    ALTER TABLE [pmt].[Blogs] ADD [ParentBlogId] INT NULL;
END;
GO

IF COL_LENGTH(N'pmt.Blogs', N'IsPrivate') IS NULL
BEGIN
    ALTER TABLE [pmt].[Blogs]
    ADD [IsPrivate] BIT NOT NULL CONSTRAINT [DF_pmt_Blogs_IsPrivate] DEFAULT (1) WITH VALUES;
END;
GO

IF COL_LENGTH(N'pmt.Blogs', N'IsPinned') IS NULL
BEGIN
    ALTER TABLE [pmt].[Blogs]
    ADD [IsPinned] BIT NOT NULL CONSTRAINT [DF_pmt_Blogs_IsPinned] DEFAULT (0) WITH VALUES;
END;
GO

IF COL_LENGTH(N'pmt.Blogs', N'SortOrder') IS NULL
BEGIN
    ALTER TABLE [pmt].[Blogs]
    ADD [SortOrder] INT NOT NULL CONSTRAINT [DF_pmt_Blogs_SortOrder] DEFAULT (0) WITH VALUES;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_pmt_Blogs_Project')
BEGIN
    ALTER TABLE [pmt].[Blogs]
    ADD CONSTRAINT [FK_pmt_Blogs_Project] FOREIGN KEY ([ProjectId]) REFERENCES [pmt].[Projects]([ProjectId]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_pmt_Blogs_Sprint')
BEGIN
    ALTER TABLE [pmt].[Blogs]
    ADD CONSTRAINT [FK_pmt_Blogs_Sprint] FOREIGN KEY ([SprintId]) REFERENCES [pmt].[Sprints]([SprintId]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_pmt_Blogs_ParentBlog')
BEGIN
    ALTER TABLE [pmt].[Blogs]
    ADD CONSTRAINT [FK_pmt_Blogs_ParentBlog] FOREIGN KEY ([ParentBlogId]) REFERENCES [pmt].[Blogs]([BlogId]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_pmt_WorkTasks_LinkedBlog')
BEGIN
    ALTER TABLE [pmt].[WorkTasks]
    ADD CONSTRAINT [FK_pmt_WorkTasks_LinkedBlog] FOREIGN KEY ([LinkedBlogId]) REFERENCES [pmt].[Blogs]([BlogId]);
END;
GO

IF OBJECT_ID(N'[pmt].[BlogAttachments]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[BlogAttachments]
    (
        [BlogId] INT NOT NULL,
        [AttachmentId] INT NOT NULL,
        [CreatedByUserId] INT NOT NULL,
        [UpdatedByUserId] INT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_BlogAttachments_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NULL,
        CONSTRAINT [PK_pmt_BlogAttachments] PRIMARY KEY ([BlogId], [AttachmentId]),
        CONSTRAINT [FK_pmt_BlogAttachments_Blog] FOREIGN KEY ([BlogId]) REFERENCES [pmt].[Blogs]([BlogId]),
        CONSTRAINT [FK_pmt_BlogAttachments_Attachment] FOREIGN KEY ([AttachmentId]) REFERENCES [pmt].[Attachments]([AttachmentId]),
        CONSTRAINT [FK_pmt_BlogAttachments_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_BlogAttachments_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId])
    );
END;
GO

IF OBJECT_ID(N'[pmt].[BlogHistory]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[BlogHistory]
    (
        [BlogHistoryId] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_pmt_BlogHistory] PRIMARY KEY,
        [BlogId] INT NOT NULL,
        [Action] NVARCHAR(80) NOT NULL,
        [UserId] INT NOT NULL,
        [CreatedByUserId] INT NOT NULL,
        [UpdatedByUserId] INT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_BlogHistory_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NULL,
        CONSTRAINT [FK_pmt_BlogHistory_Blog] FOREIGN KEY ([BlogId]) REFERENCES [pmt].[Blogs]([BlogId]),
        CONSTRAINT [FK_pmt_BlogHistory_User] FOREIGN KEY ([UserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_BlogHistory_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_BlogHistory_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId])
    );
END;
GO

IF OBJECT_ID(N'[pmt].[PublicBlogLinks]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[PublicBlogLinks]
    (
        [PublicBlogLinkId] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_pmt_PublicBlogLinks] PRIMARY KEY,
        [BlogId] INT NOT NULL,
        [Token] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_pmt_PublicBlogLinks_Token] DEFAULT (NEWID()),
        [ExpiresAt] DATETIME2(0) NULL,
        [LastAccessedAt] DATETIME2(0) NULL,
        [CreatedByUserId] INT NOT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_PublicBlogLinks_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_pmt_PublicBlogLinks_Blog] FOREIGN KEY ([BlogId]) REFERENCES [pmt].[Blogs]([BlogId]),
        CONSTRAINT [FK_pmt_PublicBlogLinks_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [UQ_pmt_PublicBlogLinks_Token] UNIQUE ([Token])
    );
END;
GO

IF OBJECT_ID(N'[pmt].[AuditEvents]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[AuditEvents]
    (
        [AuditEventId] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_pmt_AuditEvents] PRIMARY KEY,
        [EntityType] NVARCHAR(40) NOT NULL,
        [EntityId] INT NOT NULL,
        [Action] NVARCHAR(80) NOT NULL,
        [Details] NVARCHAR(MAX) NULL,
        [OldStatus] NVARCHAR(40) NULL,
        [NewStatus] NVARCHAR(40) NULL,
        [OldPercentCompleted] INT NULL,
        [NewPercentCompleted] INT NULL,
        [UserId] INT NOT NULL,
        [ActorUserId] INT NOT NULL,
        [CreatedByUserId] INT NOT NULL,
        [UpdatedByUserId] INT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_AuditEvents_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NULL,
        CONSTRAINT [FK_pmt_AuditEvents_User] FOREIGN KEY ([UserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_AuditEvents_ActorUser] FOREIGN KEY ([ActorUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_AuditEvents_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_AuditEvents_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId])
    );
END;
GO

IF COL_LENGTH(N'pmt.AuditEvents', N'ActorUserId') IS NULL
BEGIN
    ALTER TABLE [pmt].[AuditEvents] ADD [ActorUserId] INT NULL;
END;
GO

UPDATE [pmt].[AuditEvents]
SET [ActorUserId] = [UserId]
WHERE [ActorUserId] IS NULL;
GO

ALTER TABLE [pmt].[AuditEvents] ALTER COLUMN [ActorUserId] INT NOT NULL;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.foreign_keys
    WHERE [name] = N'FK_pmt_AuditEvents_ActorUser'
      AND [parent_object_id] = OBJECT_ID(N'[pmt].[AuditEvents]')
)
BEGIN
    ALTER TABLE [pmt].[AuditEvents] WITH CHECK
        ADD CONSTRAINT [FK_pmt_AuditEvents_ActorUser]
        FOREIGN KEY ([ActorUserId]) REFERENCES [pmt].[Users]([UserId]);
END;
GO

IF COL_LENGTH(N'pmt.AuditEvents', N'OldStatus') IS NULL
BEGIN
    ALTER TABLE [pmt].[AuditEvents] ADD [OldStatus] NVARCHAR(40) NULL;
END;
GO

IF COL_LENGTH(N'pmt.AuditEvents', N'NewStatus') IS NULL
BEGIN
    ALTER TABLE [pmt].[AuditEvents] ADD [NewStatus] NVARCHAR(40) NULL;
END;
GO

IF COL_LENGTH(N'pmt.AuditEvents', N'OldPercentCompleted') IS NULL
BEGIN
    ALTER TABLE [pmt].[AuditEvents] ADD [OldPercentCompleted] INT NULL;
END;
GO

IF COL_LENGTH(N'pmt.AuditEvents', N'NewPercentCompleted') IS NULL
BEGIN
    ALTER TABLE [pmt].[AuditEvents] ADD [NewPercentCompleted] INT NULL;
END;
GO

IF OBJECT_ID(N'[pmt].[Holidays]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[Holidays]
    (
        [HolidayId] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_pmt_Holidays] PRIMARY KEY,
        [Name] NVARCHAR(160) NOT NULL,
        [HolidayDate] DATE NOT NULL,
        [CountryCode] NVARCHAR(10) NOT NULL CONSTRAINT [DF_pmt_Holidays_CountryCode] DEFAULT (N'PH'),
        [IsActive] BIT NOT NULL CONSTRAINT [DF_pmt_Holidays_IsActive] DEFAULT (1),
        [CreatedByUserId] INT NOT NULL,
        [UpdatedByUserId] INT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_Holidays_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_Holidays_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
        [RowVersion] ROWVERSION NOT NULL,
        CONSTRAINT [FK_pmt_Holidays_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_Holidays_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [UQ_pmt_Holidays_DateCountryName] UNIQUE ([HolidayDate], [CountryCode], [Name])
    );
END;
GO

IF OBJECT_ID(N'[pmt].[GameScores]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[GameScores]
    (
        [GameScoreId] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_pmt_GameScores] PRIMARY KEY,
        [GameKey] NVARCHAR(60) NOT NULL,
        [PlayerUserId] INT NULL,
        [PlayerName] NVARCHAR(160) NOT NULL,
        [Score] INT NOT NULL,
        [DurationSeconds] INT NOT NULL,
        [Won] BIT NOT NULL CONSTRAINT [DF_pmt_GameScores_Won] DEFAULT (0),
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_GameScores_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_pmt_GameScores_PlayerUser] FOREIGN KEY ([PlayerUserId]) REFERENCES [pmt].[Users]([UserId]) ON DELETE SET NULL,
        CONSTRAINT [CK_pmt_GameScores_GameKey] CHECK (LEN(LTRIM(RTRIM([GameKey]))) > 0),
        CONSTRAINT [CK_pmt_GameScores_PlayerName] CHECK (LEN(LTRIM(RTRIM([PlayerName]))) > 0),
        CONSTRAINT [CK_pmt_GameScores_Score] CHECK ([Score] >= 0),
        CONSTRAINT [CK_pmt_GameScores_DurationSeconds] CHECK ([DurationSeconds] >= 0)
    );
END;
GO

IF OBJECT_ID(N'[pmt].[Suggestions]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[Suggestions]
    (
        [SuggestionId] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_pmt_Suggestions] PRIMARY KEY,
        [BodyHtml] NVARCHAR(MAX) NOT NULL,
        [Status] NVARCHAR(40) NOT NULL CONSTRAINT [DF_pmt_Suggestions_Status] DEFAULT (N'New'),
        [CreatedByUserId] INT NOT NULL,
        [UpdatedByUserId] INT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_Suggestions_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_Suggestions_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
        [RowVersion] ROWVERSION NOT NULL,
        CONSTRAINT [FK_pmt_Suggestions_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_Suggestions_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [CK_pmt_Suggestions_BodyHtml] CHECK (LEN(LTRIM(RTRIM([BodyHtml]))) > 0),
        CONSTRAINT [CK_pmt_Suggestions_Status] CHECK (LEN(LTRIM(RTRIM([Status]))) > 0)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_pmt_WorkTasks_ProjectSprint' AND [object_id] = OBJECT_ID(N'[pmt].[WorkTasks]'))
BEGIN
    CREATE INDEX [IX_pmt_WorkTasks_ProjectSprint] ON [pmt].[WorkTasks]([ProjectId], [SprintId], [IsDeleted]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_pmt_WorkTasks_TypeStatus' AND [object_id] = OBJECT_ID(N'[pmt].[WorkTasks]'))
BEGIN
    CREATE INDEX [IX_pmt_WorkTasks_TypeStatus] ON [pmt].[WorkTasks]([TaskType], [Status], [IsDeleted]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_pmt_Blogs_ProjectSprintParent' AND [object_id] = OBJECT_ID(N'[pmt].[Blogs]'))
BEGIN
    CREATE INDEX [IX_pmt_Blogs_ProjectSprintParent] ON [pmt].[Blogs]([ProjectId], [SprintId], [ParentBlogId], [IsDeleted]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_pmt_PublicBlogLinks_BlogExpires' AND [object_id] = OBJECT_ID(N'[pmt].[PublicBlogLinks]'))
BEGIN
    CREATE INDEX [IX_pmt_PublicBlogLinks_BlogExpires] ON [pmt].[PublicBlogLinks]([BlogId], [ExpiresAt]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_pmt_AuditEvents_Entity' AND [object_id] = OBJECT_ID(N'[pmt].[AuditEvents]'))
BEGIN
    CREATE INDEX [IX_pmt_AuditEvents_Entity] ON [pmt].[AuditEvents]([EntityType], [EntityId], [CreatedAt] DESC);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_pmt_AuditEvents_Actor' AND [object_id] = OBJECT_ID(N'[pmt].[AuditEvents]'))
BEGIN
    CREATE INDEX [IX_pmt_AuditEvents_Actor] ON [pmt].[AuditEvents]([ActorUserId], [CreatedAt] DESC);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_pmt_GameScores_Leaderboard' AND [object_id] = OBJECT_ID(N'[pmt].[GameScores]'))
BEGIN
    CREATE INDEX [IX_pmt_GameScores_Leaderboard] ON [pmt].[GameScores]([GameKey], [Score] DESC, [DurationSeconds], [CreatedAt] DESC);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_pmt_Suggestions_CreatedAt' AND [object_id] = OBJECT_ID(N'[pmt].[Suggestions]'))
BEGIN
    CREATE INDEX [IX_pmt_Suggestions_CreatedAt] ON [pmt].[Suggestions]([CreatedAt] DESC);
END;
GO
