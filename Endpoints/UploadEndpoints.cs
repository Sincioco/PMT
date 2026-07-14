using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using PMT.Data;
using PMT.Models;
using static PMT.Endpoints.EndpointHelpers;

namespace PMT.Endpoints;

internal static class UploadEndpoints
{
    public static IEndpointRouteBuilder MapUploadEndpoints(this IEndpointRouteBuilder app, string uploadStorageWarning = "")
    {
        app.MapPost("/api/uploads/{kind}", async (string kind, HttpRequest request, IWebHostEnvironment environment, IConfiguration configuration, CancellationToken cancellationToken) =>
        {
            if (UploadStorageUnavailableResult(uploadStorageWarning) is { } unavailable) return unavailable;

            var upload = await SaveUploadAsync(kind, request, environment, configuration, cancellationToken);
            return Results.Ok(upload);
        });

        app.MapPost("/api/tasks/{id:int}/attachments", async (int id, HttpRequest request, HttpContext context, IWebHostEnvironment environment, IConfiguration configuration, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            if (UploadStorageUnavailableResult(uploadStorageWarning) is { } unavailable) return unavailable;

            var currentUserId = CurrentUserId(context);
            await store.RequireTaskPermissionAsync(currentUserId, id, "Update", false, cancellationToken);
            var upload = await SaveUploadAsync("tasks", request, environment, configuration, cancellationToken);
            var attachmentId = await store.AddTaskAttachmentAsync(id, upload, currentUserId, cancellationToken);
            return Results.Ok(new { id = attachmentId, upload });
        });

        app.MapPost("/api/backlog/tasks/{id:int}/attachments", async (int id, HttpRequest request, HttpContext context, IWebHostEnvironment environment, IConfiguration configuration, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            if (UploadStorageUnavailableResult(uploadStorageWarning) is { } unavailable) return unavailable;

            var currentUserId = CurrentUserId(context);
            await store.RequireTaskPermissionAsync(currentUserId, id, "Update", true, cancellationToken);
            var upload = await SaveUploadAsync("tasks", request, environment, configuration, cancellationToken);
            var attachmentId = await store.AddBacklogTaskAttachmentAsync(id, upload, currentUserId, cancellationToken);
            return Results.Ok(new { id = attachmentId, upload });
        });

        app.MapPost("/api/blogs/{id:int}/attachments", async (int id, HttpRequest request, HttpContext context, IWebHostEnvironment environment, IConfiguration configuration, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            if (UploadStorageUnavailableResult(uploadStorageWarning) is { } unavailable) return unavailable;

            var currentUserId = ExplicitCurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Documentation", "Update", cancellationToken);
            var upload = await SaveUploadAsync("blogs", request, environment, configuration, cancellationToken);
            var attachmentId = await store.AddBlogAttachmentAsync(id, upload, currentUserId, cancellationToken);
            return Results.Ok(new { id = attachmentId, upload });
        });

        app.MapDelete("/api/tasks/{id:int}/attachments/{attachmentId:int}", async (int id, int attachmentId, HttpContext context, IWebHostEnvironment environment, IConfiguration configuration, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            if (UploadStorageUnavailableResult(uploadStorageWarning) is { } unavailable) return unavailable;

            var currentUserId = CurrentUserId(context);
            await store.RequireTaskPermissionAsync(currentUserId, id, "Update", false, cancellationToken);
            var url = await store.DeleteTaskAttachmentAsync(id, attachmentId, currentUserId, cancellationToken);
            DeleteStoredUpload(url, environment, configuration);
            return Results.NoContent();
        });

        app.MapDelete("/api/backlog/tasks/{id:int}/attachments/{attachmentId:int}", async (int id, int attachmentId, HttpContext context, IWebHostEnvironment environment, IConfiguration configuration, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            if (UploadStorageUnavailableResult(uploadStorageWarning) is { } unavailable) return unavailable;

            var currentUserId = CurrentUserId(context);
            await store.RequireTaskPermissionAsync(currentUserId, id, "Update", true, cancellationToken);
            var url = await store.DeleteBacklogTaskAttachmentAsync(id, attachmentId, currentUserId, cancellationToken);
            DeleteStoredUpload(url, environment, configuration);
            return Results.NoContent();
        });

        app.MapDelete("/api/blogs/{id:int}/attachments/{attachmentId:int}", async (int id, int attachmentId, HttpContext context, IWebHostEnvironment environment, IConfiguration configuration, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            if (UploadStorageUnavailableResult(uploadStorageWarning) is { } unavailable) return unavailable;

            var currentUserId = ExplicitCurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Documentation", "Update", cancellationToken);
            var url = await store.DeleteBlogAttachmentAsync(id, attachmentId, currentUserId, cancellationToken);
            DeleteStoredUpload(url, environment, configuration);
            return Results.NoContent();
        });

        return app;
    }

    private static void DeleteStoredUpload(string url, IWebHostEnvironment environment, IConfiguration configuration)
    {
        if (string.IsNullOrWhiteSpace(url)) return;

        var uploadStorage = UploadStorageOptions.From(configuration, environment.ContentRootPath);
        var requestPrefix = $"{uploadStorage.RequestPath.TrimEnd('/')}/";
        if (!url.StartsWith(requestPrefix, StringComparison.OrdinalIgnoreCase)) return;

        var relativePath = url[requestPrefix.Length..].Replace('/', Path.DirectorySeparatorChar);
        var rootPath = Path.GetFullPath(uploadStorage.RootPath);
        var filePath = Path.GetFullPath(Path.Combine(rootPath, relativePath));
        var rootPrefix = $"{rootPath.TrimEnd(Path.DirectorySeparatorChar)}{Path.DirectorySeparatorChar}";
        if (!filePath.StartsWith(rootPrefix, StringComparison.OrdinalIgnoreCase)) return;

        try
        {
            if (File.Exists(filePath)) File.Delete(filePath);
        }
        catch (IOException)
        {
            // The database link is already gone; leave an unreachable file for deployment cleanup.
        }
        catch (UnauthorizedAccessException)
        {
            // The database link is already gone; leave an unreachable file for deployment cleanup.
        }
    }

    private static IResult? UploadStorageUnavailableResult(string uploadStorageWarning)
    {
        return string.IsNullOrEmpty(uploadStorageWarning)
            ? null
            : Results.Json(new { error = uploadStorageWarning }, statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    private static async Task<UploadResult> SaveUploadAsync(string kind, HttpRequest request, IWebHostEnvironment environment, IConfiguration configuration, CancellationToken cancellationToken)
    {
        // Uploaded files are copied to the configured file store. SQL keeps only
        // the URL and file metadata, not the file bytes.
        var form = await request.ReadFormAsync(cancellationToken);
        var file = form.Files.GetFile("file") ?? form.Files.FirstOrDefault();
        if (file is null || file.Length == 0)
        {
            throw new InvalidOperationException("No file was uploaded.");
        }

        var safeKind = Regex.Replace(kind.ToLowerInvariant(), "[^a-z0-9-]", "");
        if (string.IsNullOrWhiteSpace(safeKind))
        {
            safeKind = "misc";
        }

        var uploadStorage = UploadStorageOptions.From(configuration, environment.ContentRootPath);
        var originalFileName = Path.GetFileName(file.FileName);
        var extension = Path.GetExtension(originalFileName);
        var storedFileName = $"{Guid.NewGuid():N}{extension}";
        var uploadRoot = Path.Combine(uploadStorage.RootPath, safeKind);
        Directory.CreateDirectory(uploadRoot);

        var targetPath = Path.Combine(uploadRoot, storedFileName);
        await using (var targetStream = File.Create(targetPath))
        {
            await file.CopyToAsync(targetStream, cancellationToken);
        }

        return new UploadResult
        {
            FileName = originalFileName,
            Url = $"{uploadStorage.RequestPath.TrimEnd('/')}/{safeKind}/{storedFileName}",
            ContentType = file.ContentType,
            ByteLength = file.Length
        };
    }
}
