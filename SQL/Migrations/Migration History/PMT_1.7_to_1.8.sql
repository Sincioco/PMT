/*
    PMT_1.7_to_1.8.sql

    Purpose:
    Adds safe attachment deletion for Dev Tasks, Bugs, Backlog items, and
    Documentation. Existing attachments and PMT data are preserved.

    This migration is safe to rerun.
*/

USE [PMT];
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

    DECLARE @FileName NVARCHAR(260);

    IF NOT EXISTS
    (
        SELECT 1
        FROM [pmt].[Blogs]
        WHERE [BlogId] = @BlogId
          AND [IsDeleted] = 0
    )
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
END;
GO

PRINT N'PMT database migration 1.7 to 1.8 completed.';
GO
