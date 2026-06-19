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
    public static IEndpointRouteBuilder MapUploadEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/uploads/{kind}", async (string kind, HttpRequest request, IWebHostEnvironment environment, IConfiguration configuration, CancellationToken cancellationToken) =>
        {
            var upload = await SaveUploadAsync(kind, request, environment, configuration, cancellationToken);
            return Results.Ok(upload);
        });

        app.MapPost("/api/tasks/{id:int}/attachments", async (int id, HttpRequest request, HttpContext context, IWebHostEnvironment environment, IConfiguration configuration, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var upload = await SaveUploadAsync("tasks", request, environment, configuration, cancellationToken);
            var attachmentId = await store.AddTaskAttachmentAsync(id, upload, CurrentUserId(context), cancellationToken);
            return Results.Ok(new { id = attachmentId, upload });
        });

        app.MapPost("/api/blogs/{id:int}/attachments", async (int id, HttpRequest request, HttpContext context, IWebHostEnvironment environment, IConfiguration configuration, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var upload = await SaveUploadAsync("blogs", request, environment, configuration, cancellationToken);
            var attachmentId = await store.AddBlogAttachmentAsync(id, upload, CurrentUserId(context), cancellationToken);
            return Results.Ok(new { id = attachmentId, upload });
        });

        return app;
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
