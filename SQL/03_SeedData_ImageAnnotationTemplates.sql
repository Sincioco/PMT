/*
    PMT Version 1.27 shared image-annotation template seed.

    The 13 templates were captured from Sin's completed template library on
    July 18, 2026. They are the default for users who have not saved a personal
    library and are the source for the non-destructive Restore Default Templates
    action. Re-running this script refreshes only the shared defaults; it never
    replaces a user's personal template library.
*/

USE [PMT];
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'[pmt].[ImageAnnotationDefaultTemplateLibraries]', N'U') IS NULL
BEGIN
    THROW 50282, 'The shared image annotation template-library table is required before loading its seed data.', 1;
END;

DECLARE @LibraryJson NVARCHAR(MAX) = N'{"version":1,"templates":[{"id":"template-mrppoehr-gbsv6u","name":"Normal Text","grouped":false,"groupName":"","width":202.53644724785136,"height":166.41546742832043,"createdAt":"2026-07-18T01:51:56.511Z","updatedAt":"2026-07-18T01:51:56.511Z","objects":[{"id":"textbox-mrppnaro-8","type":"textbox","name":"","locked":false,"groupId":"","x":0,"y":0,"width":202.53644724785136,"height":166.41546742832043,"fill":"none","stroke":"#3f7f0d","outlineVisible":false,"strokeWidth":4,"opacity":1,"text":"Text","textColor":"#0d0d0d","fontFamily":"Arial","fontSize":28,"textAlign":"left","textVerticalAlign":"top"}]},{"id":"template-mrp9i8vj-vgwm0p","name":"Green Arrow","grouped":false,"groupName":"","width":146,"height":126,"createdAt":"2026-07-17T18:19:15.439Z","updatedAt":"2026-07-18T02:05:09.880Z","objects":[{"id":"arrow-mrpq53a1-10","type":"arrow","name":"","locked":false,"groupId":"","x1":6,"y1":6,"x2":146,"y2":126,"stroke":"#4ea72e","strokeWidth":12,"arrowSize":48,"opacity":1}]},{"id":"template-mrpa9kpd-tuuusc","name":"Green Highlight","grouped":false,"groupName":"","width":184,"height":104,"createdAt":"2026-07-17T18:40:30.481Z","updatedAt":"2026-07-17T18:40:30.481Z","objects":[{"id":"rectangle-mrpa8em9-4","type":"rectangle","name":"","locked":false,"groupId":"","x":2,"y":2,"width":180,"height":100,"fill":"none","stroke":"#4ea72e","outlineVisible":true,"strokeWidth":4,"opacity":1}]},{"id":"template-mrpqf0lk-l8bt1m","name":"Green Box with Text","grouped":false,"groupName":"","width":226.9190420400173,"height":118.94254142122008,"createdAt":"2026-07-18T02:12:38.216Z","updatedAt":"2026-07-18T02:12:38.216Z","objects":[{"id":"textbox-mrpqek5p-22","type":"textbox","name":"","locked":false,"groupId":"","x":2,"y":2,"width":222.9190420400173,"height":114.94254142122008,"fill":"#4ea72e","stroke":"#4ea72e","outlineVisible":true,"strokeWidth":4,"opacity":1,"text":"Hello World","textColor":"#ffffff","fontFamily":"Arial","fontSize":28,"textAlign":"center","textVerticalAlign":"middle"}]},{"id":"template-mrpa72da-o1xtpx","name":"Green Caption","grouped":false,"groupName":"","width":382.44979917050296,"height":349.5666671265194,"createdAt":"2026-07-17T18:38:33.406Z","updatedAt":"2026-07-17T18:38:33.406Z","objects":[{"id":"arrow-mrpa57nj-2","type":"arrow","name":"","locked":false,"groupId":"","x1":250.41369131382453,"y1":97.20493329838473,"x2":0,"y2":349.5666671265194,"stroke":"#4ea72e","strokeWidth":12,"arrowSize":48,"opacity":1},{"id":"textbox-mrpa67x7-4","type":"textbox","name":"","locked":false,"groupId":"","x":157.53075713048565,"y":2,"width":222.9190420400173,"height":114.94254142122008,"fill":"#4ea72e","stroke":"#4ea72e","outlineVisible":true,"strokeWidth":4,"opacity":1,"text":"Hello World","textColor":"#ffffff","fontFamily":"Arial","fontSize":28,"textAlign":"center","textVerticalAlign":"middle"}]},{"id":"template-mrp9iwy6-wqbtv8","name":"Orange Arrow","grouped":false,"groupName":"","width":146,"height":126,"createdAt":"2026-07-17T18:19:46.638Z","updatedAt":"2026-07-18T02:09:26.907Z","objects":[{"id":"arrow-mrp9ih6n-3","type":"arrow","name":"","locked":false,"groupId":"","x1":6,"y1":6,"x2":146,"y2":126,"stroke":"#ffc000","strokeWidth":12,"arrowSize":48,"opacity":1}]},{"id":"template-mrpq5woy-sf64gf","name":"Orange Box","grouped":false,"groupName":"","width":184,"height":104,"createdAt":"2026-07-18T02:05:33.250Z","updatedAt":"2026-07-18T02:05:33.250Z","objects":[{"id":"rectangle-mrpq5hep-11","type":"rectangle","name":"","locked":false,"groupId":"","x":2,"y":2,"width":180,"height":100,"fill":"none","stroke":"#ffc000","outlineVisible":true,"strokeWidth":4,"opacity":1}]},{"id":"template-mrpqe2wj-qm1c7c","name":"Orange Box with Text","grouped":false,"groupName":"","width":222.9190420400173,"height":114.94254142122008,"createdAt":"2026-07-18T02:11:54.547Z","updatedAt":"2026-07-18T02:11:54.547Z","objects":[{"id":"textbox-mrpqdqka-20","type":"textbox","name":"","locked":false,"groupId":"","x":0,"y":0,"width":222.9190420400173,"height":114.94254142122008,"fill":"#ffc000","stroke":"#4ea72e","outlineVisible":false,"strokeWidth":4,"opacity":1,"text":"Hello World","textColor":"#ffffff","fontFamily":"Arial","fontSize":28,"textAlign":"center","textVerticalAlign":"middle"}]},{"id":"template-mrpq89ge-cicw6i","name":"Orange Caption","grouped":true,"groupName":"","width":380.44979917050296,"height":347.5666671265194,"createdAt":"2026-07-18T02:07:23.102Z","updatedAt":"2026-07-18T02:07:23.102Z","objects":[{"id":"arrow-mrpq529g-8","type":"arrow","name":"","locked":false,"groupId":"","x1":250.41369131382453,"y1":95.20493329838473,"x2":0,"y2":347.5666671265194,"stroke":"#ffc000","strokeWidth":12,"arrowSize":48,"opacity":1},{"id":"textbox-mrpq529g-9","type":"textbox","name":"","locked":false,"groupId":"","x":157.53075713048565,"y":0,"width":222.9190420400173,"height":114.94254142122008,"fill":"#ffc000","stroke":"#4ea72e","outlineVisible":false,"strokeWidth":4,"opacity":1,"text":"Hello World","textColor":"#ffffff","fontFamily":"Arial","fontSize":28,"textAlign":"center","textVerticalAlign":"middle"}]},{"id":"template-mrpq9wwo-0u4drh","name":"Red Arrow","grouped":false,"groupName":"","width":146,"height":126,"createdAt":"2026-07-18T02:08:40.152Z","updatedAt":"2026-07-18T02:08:40.152Z","objects":[{"id":"arrow-mrpq9nep-15","type":"arrow","name":"","locked":false,"groupId":"","x1":6,"y1":6,"x2":146,"y2":126,"stroke":"#ff0000","strokeWidth":12,"arrowSize":48,"opacity":1}]},{"id":"template-mrpqancx-3y8xl1","name":"Red Box","grouped":false,"groupName":"","width":184,"height":104,"createdAt":"2026-07-18T02:09:14.433Z","updatedAt":"2026-07-18T02:09:40.633Z","objects":[{"id":"rectangle-mrpqaezk-16","type":"rectangle","name":"","locked":false,"groupId":"","x":2,"y":2,"width":180,"height":100,"fill":"none","stroke":"#ff0000","outlineVisible":true,"strokeWidth":4,"opacity":1}]},{"id":"template-mrpqdfgx-vn26f8","name":"Red Box and Text","grouped":false,"groupName":"","width":222.9190420400173,"height":114.94254142122008,"createdAt":"2026-07-18T02:11:24.177Z","updatedAt":"2026-07-18T02:11:31.251Z","objects":[{"id":"textbox-mrpqd1kk-18","type":"textbox","name":"","locked":false,"groupId":"","x":0,"y":0,"width":222.9190420400173,"height":114.94254142122008,"fill":"#ff0000","stroke":"#ff0000","outlineVisible":false,"strokeWidth":4,"opacity":1,"text":"Hello World","textColor":"#ffffff","fontFamily":"Arial","fontSize":28,"textAlign":"center","textVerticalAlign":"middle"}]},{"id":"template-mrpq99ai-qii9gx","name":"Red Caption","grouped":true,"groupName":"","width":380.44979917050296,"height":347.5666671265194,"createdAt":"2026-07-18T02:08:09.546Z","updatedAt":"2026-07-18T02:08:09.546Z","objects":[{"id":"arrow-mrpq8m96-13","type":"arrow","name":"","locked":false,"groupId":"","x1":250.41369131382453,"y1":95.20493329838473,"x2":0,"y2":347.5666671265194,"stroke":"#ff0000","strokeWidth":12,"arrowSize":48,"opacity":1},{"id":"textbox-mrpq8m96-14","type":"textbox","name":"","locked":false,"groupId":"","x":157.53075713048565,"y":0,"width":222.9190420400173,"height":114.94254142122008,"fill":"#ff0000","stroke":"#ff0000","outlineVisible":false,"strokeWidth":4,"opacity":1,"text":"Hello World","textColor":"#ffffff","fontFamily":"Arial","fontSize":28,"textAlign":"center","textVerticalAlign":"middle"}]}],"defaults":{"arrow":{"stroke":"#3f7f0d","strokeWidth":12,"arrowSize":48,"opacity":1},"rectangle":null}}';

IF ISJSON(@LibraryJson) <> 1
   OR TRY_CONVERT(INT, JSON_VALUE(@LibraryJson, N'$.version')) <> 1
   OR JSON_QUERY(@LibraryJson, N'$.defaults') IS NULL
   OR (SELECT COUNT(*) FROM OPENJSON(JSON_QUERY(@LibraryJson, N'$.templates'))) <> 13
   OR DATALENGTH(@LibraryJson) > 104857600
BEGIN
    THROW 50283, 'The shared image annotation template seed must be a valid Version 1 library with exactly 13 templates.', 1;
END;

BEGIN TRY
    BEGIN TRANSACTION;

    UPDATE [pmt].[ImageAnnotationDefaultTemplateLibraries]
    SET [LibraryJson] = @LibraryJson,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [DefaultLibraryId] = 1;

    IF @@ROWCOUNT = 0
    BEGIN
        INSERT INTO [pmt].[ImageAnnotationDefaultTemplateLibraries]
        (
            [DefaultLibraryId],
            [LibraryJson]
        )
        VALUES
        (
            1,
            @LibraryJson
        );
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO

PRINT N'PMT shared image annotation defaults loaded: 13 templates.';
GO
