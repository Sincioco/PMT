/*
    PMT Database Version 1.14 -> 1.15

    Adds the PMT About 3D Visualization and Flyby Documentation seed record
    for existing installations. Existing projects and Documentation are
    preserved.
*/

:on error exit

USE [PMT];
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF SCHEMA_ID(N'pmt') IS NULL
   OR OBJECT_ID(N'[pmt].[Users]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[Projects]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[Sprints]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[Blogs]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[BlogHistory]', N'U') IS NULL
BEGIN
    THROW 50260, 'PMT Database Version 1.14 objects are required before applying Version 1.15.', 1;
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_DatabaseVersion'
      AND CONVERT(NVARCHAR(20), [value]) IN (N'1.14', N'1.15')
)
BEGIN
    THROW 50261, 'PMT Database Version 1.14 is required before applying Version 1.15.', 1;
END;
GO

DECLARE @DatabaseVersion NVARCHAR(20) =
(
    SELECT CONVERT(NVARCHAR(20), [value])
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_DatabaseVersion'
);
DECLARE @PmtProjectId INT;
DECLARE @PmtSprintId INT;
DECLARE @ParentBlogId INT;
DECLARE @DocumentOwnerId INT;
DECLARE @ExistingBlogId INT;
DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
DECLARE @InsertedBlog TABLE ([BlogId] INT NOT NULL);

IF (SELECT COUNT_BIG(*) FROM [pmt].[Projects] WHERE [Code] = N'PMT') <> 1
BEGIN
    THROW 50262, 'Version 1.15 requires exactly one PMT seed Project. No data was changed.', 1;
END;

SELECT
    @PmtProjectId = [ProjectId],
    @DocumentOwnerId = [CreatedByUserId]
FROM [pmt].[Projects]
WHERE [Code] = N'PMT';

IF @DocumentOwnerId IS NULL
BEGIN
    THROW 50263, 'The PMT seed Project must have an owner before applying Version 1.15. No data was changed.', 1;
END;

IF @DatabaseVersion = N'1.14'
   AND EXISTS
   (
       SELECT 1
       FROM [pmt].[Blogs]
       WHERE [ProjectId] = @PmtProjectId
         AND [Title] = N'PMT About 3D Visualization and Flyby'
   )
BEGIN
    THROW 50264, 'A Documentation row already uses the Version 1.15 seed title. Investigate without deleting or overwriting user data.', 1;
END;

IF @DatabaseVersion = N'1.15'
BEGIN
    SELECT @ExistingBlogId = [BlogId]
    FROM [pmt].[Blogs]
    WHERE [ProjectId] = @PmtProjectId
      AND [Title] = N'PMT About 3D Visualization and Flyby'
      AND [IsDeleted] = 0;

    IF (SELECT COUNT_BIG(*) FROM [pmt].[Blogs] WHERE [ProjectId] = @PmtProjectId AND [Title] = N'PMT About 3D Visualization and Flyby' AND [IsDeleted] = 0) <> 1
       OR @ExistingBlogId IS NULL
       OR NOT EXISTS
       (
           SELECT 1
           FROM [pmt].[Blogs]
           WHERE [BlogId] = @ExistingBlogId
             AND [IsPrivate] = 1
             AND [IsPinned] = 0
             AND [BodyHtml] LIKE N'%/assets/docs/pmt-doc-about-3d-flyby-v2.jpg?v=20260715-about-3d-seed%'
       )
       OR (SELECT COUNT_BIG(*) FROM [pmt].[BlogHistory] WHERE [BlogId] = @ExistingBlogId AND [Action] = N'Created') <> 1
    BEGIN
        THROW 50265, 'PMT Database Version 1.15 is recorded, but its seed Documentation is incomplete. Investigate before continuing.', 1;
    END;
END;

IF @DatabaseVersion = N'1.14'
BEGIN
    SELECT @PmtSprintId = [SprintId]
    FROM [pmt].[Sprints]
    WHERE [ProjectId] = @PmtProjectId
      AND [Code] = N'PMT-Sprint05';

    SELECT @ParentBlogId = [BlogId]
    FROM [pmt].[Blogs]
    WHERE [ProjectId] = @PmtProjectId
      AND [Title] = N'PMT Current Demo Readiness'
      AND [IsDeleted] = 0;

    BEGIN TRANSACTION;

    INSERT INTO [pmt].[Blogs]
    (
        [ProjectId], [SprintId], [ParentBlogId], [Title], [BodyHtml],
        [IsPrivate], [IsPinned], [CreatedByUserId], [UpdatedByUserId],
        [IsDeleted], [CreatedAt], [UpdatedAt]
    )
    OUTPUT INSERTED.[BlogId] INTO @InsertedBlog ([BlogId])
    VALUES
    (
        @PmtProjectId,
        @PmtSprintId,
        @ParentBlogId,
        N'PMT About 3D Visualization and Flyby',
        N'<p><img src="/assets/docs/pmt-doc-about-3d-flyby-v2.jpg?v=20260715-about-3d-seed" alt="Extruded PMT logo surrounded by golden looped flyby paths with mouse-look and WASD control diagrams"></p><p>The About page turns current PMT data into an interactive 3D gallery. Its automated flyby moves through the PMT logo and project visualizations, while mouse and keyboard controls let the viewer explore the scene.</p><ul><li>Follow the continuous cinematic route through the PMT logo, charts, Documentation, and Kanban views.</li><li>Hold the left mouse button to look around, use the wheel to zoom, and use WASD with Q and E to move.</li><li>Press Space to pause or resume, Enter to restart the sequence, and ? to show the controls.</li></ul>',
        1,
        0,
        @DocumentOwnerId,
        NULL,
        0,
        @Now,
        @Now
    );

    INSERT INTO [pmt].[BlogHistory]
    (
        [BlogId], [Action], [UserId], [CreatedByUserId], [CreatedAt]
    )
    SELECT [BlogId], N'Created', @DocumentOwnerId, @DocumentOwnerId, @Now
    FROM @InsertedBlog;

    IF (SELECT COUNT_BIG(*) FROM @InsertedBlog) <> 1
       OR NOT EXISTS
       (
           SELECT 1
           FROM [pmt].[Blogs] AS [Blog]
           INNER JOIN @InsertedBlog AS [Inserted] ON [Inserted].[BlogId] = [Blog].[BlogId]
           WHERE [Blog].[IsDeleted] = 0
             AND [Blog].[IsPrivate] = 1
             AND [Blog].[IsPinned] = 0
       )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50266, 'Version 1.15 could not verify the new seed Documentation. No data was changed.', 1;
    END;

    EXEC sys.sp_updateextendedproperty
        @name = N'PMT_DatabaseVersion',
        @value = N'1.15';

    COMMIT TRANSACTION;
END;

GO

PRINT N'PMT Database Version 1.15 applied: the About 3D visualization and flyby seed Documentation is available.';
GO
