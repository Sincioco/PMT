/*
    PMT Database Version 1.25 -> 1.26

    Adds public PMT tutorial Documentation for Mentions and Live Cards,
    Diagrams, ERDs, and Image Annotations to existing installations. Fresh
    rebuilds receive the same permanent PMT seed records through
    SQL/03_SeedData_PMT.sql.
*/

USE [PMT];
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF SCHEMA_ID(N'pmt') IS NULL
   OR OBJECT_ID(N'[pmt].[Projects]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[Sprints]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[Blogs]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[BlogHistory]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[LockBlogWrites]', N'P') IS NULL
BEGIN
    THROW 51130, 'PMT Database Version 1.25 objects are required before applying Version 1.26.', 1;
END;

DECLARE @CurrentDatabaseVersion NVARCHAR(20) =
(
    SELECT CONVERT(NVARCHAR(20), [value])
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_DatabaseVersion'
);

IF ISNULL(@CurrentDatabaseVersion, N'') NOT IN (N'1.25', N'1.26')
BEGIN
    THROW 51131, 'PMT Database Version 1.25 is required before applying Version 1.26.', 1;
END;

DECLARE @PmtProjectId INT;
DECLARE @PmtSprintId INT;
DECLARE @ParentBlogId INT;
DECLARE @DocumentOwnerId INT;
DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();

IF (SELECT COUNT_BIG(*) FROM [pmt].[Projects] WHERE [Code] = N'PMT' AND [IsArchived] = 0) <> 1
BEGIN
    THROW 51132, 'Version 1.26 requires exactly one active PMT seed Project. No data was changed.', 1;
END;

SELECT
    @PmtProjectId = [ProjectId],
    @DocumentOwnerId = [CreatedByUserId]
FROM [pmt].[Projects]
WHERE [Code] = N'PMT'
  AND [IsArchived] = 0;

IF @DocumentOwnerId IS NULL
BEGIN
    THROW 51133, 'The PMT seed Project must have an owner before applying Version 1.26. No data was changed.', 1;
END;

SELECT @PmtSprintId = [SprintId]
FROM [pmt].[Sprints]
WHERE [ProjectId] = @PmtProjectId
  AND [Code] = N'PMT-Sprint05'
  AND [IsDeleted] = 0;

SELECT @ParentBlogId = [BlogId]
FROM [pmt].[Blogs]
WHERE [ProjectId] = @PmtProjectId
  AND [Title] = N'PMT Current Demo Readiness'
  AND [IsDeleted] = 0;

DECLARE @SeedDocuments TABLE
(
    [Title] NVARCHAR(220) NOT NULL PRIMARY KEY,
    [BodyHtml] NVARCHAR(MAX) NOT NULL
);

INSERT INTO @SeedDocuments ([Title], [BodyHtml])
VALUES
(
    N'PMT Mentions and Live Cards',
    N'<p><img src="/assets/docs/pmt-doc-mentions-live-cards.svg?v=20260722-mentions-live-cards" alt="PMT rich text showing mentions that open shared cards and live embedded cards"></p><p>Mentions and live cards turn ordinary PMT rich text into connected work context. A Scrum entry, Log, Documentation page, Dev Task, or Bug Report can point to another PMT item without forcing the reader to leave the conversation they are reading.</p><p>Use mentions when you want a compact reference that opens a card on hover. Use live cards when the referenced item deserves to be visible directly inside the rich-text body.</p><ul><li>Type <code>@task/123</code> or <code>@bug/123</code> to reference a Dev Task or Bug Report by its PMT id.</li><li>Type <code>@doc/123</code> or <code>@diagram/123</code> to reference a Documentation page or Diagram.</li><li>Use <code>@livetask/123</code>, <code>@livebug/123</code>, <code>@livedoc/123</code>, or <code>@livediagram/123</code> when the card should appear inline as part of the content.</li><li>Hovering or focusing a mention opens the same shared card style used elsewhere in PMT, so a mention looks and behaves like the real work item.</li><li>Live work-item cards reuse the Kanban card shell, including title, status, priority, percent, assignees, and project context.</li><li>Live Documentation and Diagram cards reuse their existing card views, so future card design improvements automatically carry into rich-text references.</li><li>Multiple mentions and live cards can appear in one rich-text entry, which is useful for daily Scrum summaries, release notes, QA handoffs, and design reviews.</li><li>Unknown or mistyped references safely stay as text instead of creating a broken card.</li><li>The stored rich text remains simple HTML; the PMT viewer resolves references when content is rendered so readers see current PMT data.</li></ul>'
),
(
    N'PMT Diagram Workspace Guide',
    N'<p><img src="/assets/docs/pmt-doc-diagrams.svg?v=20260722-diagram-guide" alt="PMT Diagram workspace with tree navigation, canvas objects, rich text, and export controls"></p><p>The Diagram workspace is PMT''s general-purpose visual canvas. It can be used for architecture sketches, process maps, training pages, release walkthroughs, and visual documentation that needs to live beside the rest of the project data.</p><p>Diagrams are backed by PMT Documentation records, which means they participate in normal project context, visibility, history, cards, and rich-text linking.</p><ul><li>Create diagrams from the Diagram screen or insert a diagram directly from a rich-text editor when a visual explanation belongs inside Documentation, Scrum, Logs, Dev Tasks, or Bug Reports.</li><li>Add canvas objects such as rectangles, circles, lines, arrows, text boxes, images, Entity tables, and rich-text blocks.</li><li>Use rich-text objects on the canvas for tutorial pages, runbooks, and manual-style layouts that need formatted paragraphs, lists, images, and color-coded code samples.</li><li>Select, move, resize, group, copy, paste, duplicate, layer, lock, hide, and rename visual objects from the canvas and object tree.</li><li>Save frequently used shapes or formatting as templates so repeat diagrams stay visually consistent.</li><li>Export diagrams as SVG or PNG for presentations, documents, and external review.</li><li>Export a PMT Diagram file when the intent is to re-import the editable diagram into another PMT instance.</li><li>Embed Linked Diagram viewers in rich text so readers can pan, zoom, fit, resize, tab between diagrams, and maximize a shared diagram without opening the full editor.</li><li>The Diagram screen now renders the page shell and left navigation before hydrating very large selected diagrams, with a Loading indicator inside the viewer so navigation feels responsive.</li><li>Use Diagram cards and mentions to reference visuals from Scrum, Documentation, Logs, Dev Tasks, and Bug Reports.</li></ul>'
),
(
    N'PMT ERD and Database Schema Guide',
    N'<p><img src="/assets/docs/pmt-doc-erd.svg?v=20260722-erd-guide" alt="PMT entity relationship diagram showing tables, fields, PK and FK markers, and relationship routing"></p><p>PMT ERDs are specialized Diagrams for database structure. They preserve table names, schema names, fields, primary keys, foreign keys, important fields, data types, and field-to-field relationship mappings so the diagram remains useful after it is saved, shared, exported, and reopened.</p><p>The ERD tools are designed for both generated schemas and hand-built diagrams where the database does not have every foreign-key relationship declared.</p><ul><li>Generate PMT''s live database schema from the connected database when you need a current editable ERD of all <code>pmt</code> tables and relationships.</li><li>Paste or type SQL table definitions to create Entity objects with fields, data types, identity markers, nullability, primary keys, and foreign keys.</li><li>Mark fields as PK, FK, or important from the Entity tab, and use the Important header to quickly select all fields before deselecting less important ones.</li><li>Map foreign keys through dropdowns that list the referenced Entities and fields already present in the diagram.</li><li>Manually map primary-key fields when a database uses relationships that are not declared as physical foreign keys.</li><li>Alphabetize Entity fields in the canvas and Entity tab while respecting the Show FK at Top display option.</li><li>Collapse Entities so large tables show only the fields that matter most for the current conversation.</li><li>Use Auto Format - Compact to arrange ERDs with clean corridors, shared relationship lanes, and compact routing that avoids drawing through unrelated Entities.</li><li>Select relationship lines in read-only mode to visually trace a connection through a complex diagram.</li><li>Nudge selected relationship segments with the keyboard in edit mode for precise manual placement.</li><li>Toggle connection symbols in read-only mode when users need cardinality markers such as one-to-one, one-to-many, arrows, and crows feet.</li><li>Export and re-import ERDs through the PMT Diagram file format so another PMT instance can preserve editable Entities, relationships, templates, and layout behavior.</li></ul>'
),
(
    N'PMT Image Annotation Guide',
    N'<p><img src="/assets/docs/pmt-doc-image-annotations.svg?v=20260722-image-annotations" alt="PMT image annotation editor with screenshot, crop frame, arrow, highlight, and callout"></p><p>Image Annotations let PMT users explain screenshots, mockups, diagrams, and pasted images without leaving PMT. The annotation layer stays editable, so a reviewer can adjust callouts, arrows, highlights, and notes later instead of starting over with a flattened picture.</p><p>This is useful for QA evidence, UI review, training material, troubleshooting notes, and design handoff.</p><ul><li>Open image annotation from rich text images, inserted diagrams, and visual assets that need explanation.</li><li>Add arrows, rectangles, circles, lines, text boxes, callouts, highlights, and grouped shapes over the original image.</li><li>Move, resize, rotate, layer, group, lock, hide, and rename annotation objects from the canvas and object tree.</li><li>Use crop tools when only part of a screenshot matters, while preserving vector annotations around the selected image.</li><li>Choose colors, line widths, arrow-head sizes, opacity, text alignment, text wrapping, fills, and hidden outlines for clean presentation.</li><li>Copy selected artwork as tight SVG so the result pastes cleanly into documents and presentation tools.</li><li>Use PNG export when the destination does not preserve SVG or vector formatting.</li><li>Save common annotation styles as templates, including green arrows, orange highlights, red callouts, text blocks, and grouped captions.</li><li>Restore shared default templates so every PMT user starts with the same annotation vocabulary.</li><li>Keep annotations self-contained in saved SVG so reopened PMT content remains editable and portable.</li><li>Use annotations in QA reports to point directly at defects, expected behavior, and acceptance-test evidence.</li><li>Use annotations in Documentation to build tutorials with screenshots, step numbers, warnings, and visual checkpoints.</li></ul>'
);

IF @CurrentDatabaseVersion = N'1.25'
BEGIN
    IF EXISTS
    (
        SELECT 1
        FROM [pmt].[Blogs] AS [Blog]
        INNER JOIN @SeedDocuments AS [Seed]
            ON [Seed].[Title] = [Blog].[Title]
        WHERE [Blog].[ProjectId] = @PmtProjectId
          AND [Blog].[IsDeleted] = 0
    )
    BEGIN
        THROW 51134, 'One or more Version 1.26 seed Documentation titles already exist in PMT. Investigate without overwriting user data.', 1;
    END;

    DECLARE @InsertedBlogs TABLE
    (
        [BlogId] INT NOT NULL PRIMARY KEY,
        [Title] NVARCHAR(220) NOT NULL
    );

    BEGIN TRY
        BEGIN TRANSACTION;

        EXEC [pmt].[LockBlogWrites];

        INSERT INTO [pmt].[Blogs]
        (
            [ProjectId],
            [SprintId],
            [ParentBlogId],
            [Title],
            [BodyHtml],
            [IsPrivate],
            [IsPinned],
            [SortOrder],
            [CreatedByUserId],
            [UpdatedByUserId],
            [IsDeleted],
            [CreatedAt],
            [UpdatedAt]
        )
        OUTPUT INSERTED.[BlogId], INSERTED.[Title]
        INTO @InsertedBlogs ([BlogId], [Title])
        SELECT
            @PmtProjectId,
            @PmtSprintId,
            @ParentBlogId,
            [Seed].[Title],
            [Seed].[BodyHtml],
            0,
            0,
            0,
            @DocumentOwnerId,
            NULL,
            0,
            @Now,
            @Now
        FROM @SeedDocuments AS [Seed]
        ;

        INSERT INTO [pmt].[BlogHistory]
        (
            [BlogId],
            [Action],
            [UserId],
            [CreatedByUserId],
            [CreatedAt]
        )
        SELECT
            [Inserted].[BlogId],
            N'Created',
            @DocumentOwnerId,
            @DocumentOwnerId,
            @Now
        FROM @InsertedBlogs AS [Inserted];

        IF (SELECT COUNT_BIG(*) FROM @InsertedBlogs) <> 4
           OR EXISTS
           (
               SELECT 1
               FROM @InsertedBlogs AS [Inserted]
               INNER JOIN [pmt].[Blogs] AS [Blog]
                   ON [Blog].[BlogId] = [Inserted].[BlogId]
               WHERE [Blog].[ProjectId] <> @PmtProjectId
                  OR [Blog].[IsPrivate] <> 0
                  OR [Blog].[IsPinned] <> 0
                  OR [Blog].[IsDeleted] <> 0
           )
        BEGIN
            THROW 51135, 'Version 1.26 could not verify the new seed Documentation rows. No data was changed.', 1;
        END;

        EXEC sys.sp_updateextendedproperty
            @name = N'PMT_DatabaseVersion',
            @value = N'1.26';

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_DatabaseVersion'
      AND CONVERT(NVARCHAR(20), [value]) = N'1.26'
)
BEGIN
    THROW 51136, 'PMT Database Version 1.26 could not be verified.', 1;
END;

IF
(
    SELECT COUNT_BIG(*)
    FROM [pmt].[Projects] AS [Project]
    INNER JOIN [pmt].[Blogs] AS [Blog]
        ON [Blog].[ProjectId] = [Project].[ProjectId]
    WHERE [Project].[Code] = N'PMT'
      AND [Blog].[IsDeleted] = 0
      AND [Blog].[IsPrivate] = 0
      AND [Blog].[Title] IN
      (
          N'PMT Mentions and Live Cards',
          N'PMT Diagram Workspace Guide',
          N'PMT ERD and Database Schema Guide',
          N'PMT Image Annotation Guide'
      )
) <> 4
BEGIN
    THROW 51137, 'PMT Database Version 1.26 expected four public PMT tutorial Documentation rows.', 1;
END;
GO

PRINT N'PMT Database Version 1.26 applied: PMT tutorial Documentation for mentions, diagrams, ERDs, and image annotations is available.';
GO
