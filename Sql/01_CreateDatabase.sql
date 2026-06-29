/*
    PMT database and schema script.
    Run this first. It creates the database, the pmt schema, the application
    tables, and the single required administrator account.
*/

IF DB_ID(N'PMT') IS NULL
BEGIN
    CREATE DATABASE [PMT];
END;
GO

USE [PMT];
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
        N'Admin',
        1
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

IF OBJECT_ID(N'[pmt].[Lookups]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[Lookups]
    (
        [LookupId] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_pmt_Lookups] PRIMARY KEY,
        [LookupType] NVARCHAR(60) NOT NULL,
        [Value] NVARCHAR(120) NOT NULL,
        [ColorHex] NVARCHAR(20) NULL,
        [DisplayOrder] INT NOT NULL CONSTRAINT [DF_pmt_Lookups_DisplayOrder] DEFAULT (0),
        [IsActive] BIT NOT NULL CONSTRAINT [DF_pmt_Lookups_IsActive] DEFAULT (1),
        [CreatedByUserId] INT NOT NULL,
        [UpdatedByUserId] INT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_Lookups_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_Lookups_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_pmt_Lookups_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_Lookups_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [UQ_pmt_Lookups_TypeValue] UNIQUE ([LookupType], [Value])
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
        CONSTRAINT [FK_pmt_DevLogs_Project] FOREIGN KEY ([ProjectId]) REFERENCES [pmt].[Projects]([ProjectId]),
        CONSTRAINT [FK_pmt_DevLogs_User] FOREIGN KEY ([UserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_DevLogs_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_DevLogs_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId])
    );
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
        [Title] NVARCHAR(220) NOT NULL,
        [BodyHtml] NVARCHAR(MAX) NOT NULL,
        [CreatedByUserId] INT NOT NULL,
        [UpdatedByUserId] INT NULL,
        [IsDeleted] BIT NOT NULL CONSTRAINT [DF_pmt_Blogs_IsDeleted] DEFAULT (0),
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_Blogs_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_Blogs_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_pmt_Blogs_Project] FOREIGN KEY ([ProjectId]) REFERENCES [pmt].[Projects]([ProjectId]),
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

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_pmt_Blogs_Project')
BEGIN
    ALTER TABLE [pmt].[Blogs]
    ADD CONSTRAINT [FK_pmt_Blogs_Project] FOREIGN KEY ([ProjectId]) REFERENCES [pmt].[Projects]([ProjectId]);
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
        [CreatedByUserId] INT NOT NULL,
        [UpdatedByUserId] INT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_AuditEvents_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NULL,
        CONSTRAINT [FK_pmt_AuditEvents_User] FOREIGN KEY ([UserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_AuditEvents_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_AuditEvents_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId])
    );
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
        CONSTRAINT [FK_pmt_Holidays_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_Holidays_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [UQ_pmt_Holidays_DateCountryName] UNIQUE ([HolidayDate], [CountryCode], [Name])
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

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_pmt_AuditEvents_Entity' AND [object_id] = OBJECT_ID(N'[pmt].[AuditEvents]'))
BEGIN
    CREATE INDEX [IX_pmt_AuditEvents_Entity] ON [pmt].[AuditEvents]([EntityType], [EntityId], [CreatedAt] DESC);
END;
GO
