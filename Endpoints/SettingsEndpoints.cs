using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.Configuration;
using PMT.Data;
using PMT.Models;
using static PMT.Endpoints.EndpointHelpers;

namespace PMT.Endpoints;

internal static class SettingsEndpoints
{
    private static readonly TimeSpan MaintenanceFileGracePeriod = TimeSpan.FromHours(24);
    private static readonly FileExtensionContentTypeProvider MaintenanceContentTypes = new();
    private static readonly HashSet<string> MaintenanceActiveContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "application/xhtml+xml",
        "application/xml",
        "image/svg+xml",
        "message/rfc822",
        "multipart/related",
        "text/html",
        "text/xml"
    };

    public static IEndpointRouteBuilder MapSettingsEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/usernames/suggestion", async (string? username, int? excludeUserId, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            return Results.Ok(await store.SuggestUsernameAsync(username ?? "", excludeUserId ?? 0, cancellationToken));
        });

        app.MapPost("/api/users", async (UserInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = CurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Settings", "Create", cancellationToken);
            var id = await store.SaveUserAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id });
        });

        app.MapPut("/api/users/{id:int}", async (int id, UserInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            input.Id = id;
            var currentUserId = CurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Settings", "Update", cancellationToken);
            var savedId = await store.SaveUserAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id = savedId });
        });

        app.MapDelete("/api/users/{id:int}", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = CurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Settings", "Delete", cancellationToken);
            await store.DeleteUserAsync(id, currentUserId, cancellationToken);
            return Results.NoContent();
        });

        app.MapPost("/api/lookups", async (LookupInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = CurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Settings", "Create", cancellationToken);
            var id = await store.SaveLookupAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id });
        });

        app.MapPut("/api/lookups/{id:int}", async (int id, LookupInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            input.Id = id;
            var currentUserId = CurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Settings", "Update", cancellationToken);
            var savedId = await store.SaveLookupAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id = savedId });
        });

        app.MapDelete("/api/lookups/{id:int}", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = CurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Settings", "Delete", cancellationToken);
            await store.DeleteLookupAsync(id, currentUserId, cancellationToken);
            return Results.NoContent();
        });

        app.MapPost("/api/holidays", async (HolidayInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = CurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Settings", "Create", cancellationToken);
            var id = await store.SaveHolidayAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id });
        });

        app.MapPut("/api/holidays/{id:int}", async (int id, HolidayInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            input.Id = id;
            var currentUserId = CurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Settings", "Update", cancellationToken);
            var savedId = await store.SaveHolidayAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id = savedId });
        });

        app.MapDelete("/api/holidays/{id:int}", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = CurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Settings", "Delete", cancellationToken);
            await store.DeleteHolidayAsync(id, currentUserId, cancellationToken);
            return Results.NoContent();
        });

        app.MapGet("/api/maintenance/recycle-bin", async (HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = ExplicitCurrentUserId(context);
            return Results.Ok(await store.GetMaintenanceRecycleBinAsync(currentUserId, cancellationToken));
        });

        app.MapPost("/api/maintenance/recycle-bin/preview", async (MaintenanceRecycleSelection selection, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            RequireMaintenanceRecycleSelection(selection);
            var currentUserId = ExplicitCurrentUserId(context);
            return Results.Ok(await store.ProcessMaintenanceRecycleBinAsync(selection, currentUserId, false, cancellationToken));
        });

        app.MapPost("/api/maintenance/recycle-bin/purge", async (MaintenanceRecycleSelection selection, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            RequireMaintenanceRecycleSelection(selection);
            var currentUserId = ExplicitCurrentUserId(context);
            return Results.Ok(await store.ProcessMaintenanceRecycleBinAsync(selection, currentUserId, true, cancellationToken));
        });

        app.MapGet("/api/maintenance/orphan-files", async (HttpContext context, IWebHostEnvironment environment, IConfiguration configuration, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = ExplicitCurrentUserId(context);
            var uploadStorage = UploadStorageOptions.From(configuration, environment.ContentRootPath);

            // Check Admin access before scanning a potentially remote upload folder.
            await store.FindReferencedUploadPathsAsync(Array.Empty<string>(), uploadStorage.RequestPath, currentUserId, cancellationToken);

            var candidates = ReadMaintenanceUploadFiles(uploadStorage.RootPath, currentUserId);
            var referencedPaths = candidates.Count == 0
                ? new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                : await store.FindReferencedUploadPathsAsync(
                    candidates.Select(file => file.RelativePath),
                    uploadStorage.RequestPath,
                    currentUserId,
                    cancellationToken);
            var files = candidates
                .Where(file => !referencedPaths.Contains(file.RelativePath))
                .ToList();

            return Results.Ok(new
            {
                files,
                totalCount = files.Count,
                totalByteLength = files.Sum(file => file.ByteLength)
            });
        });

        app.MapGet("/api/maintenance/orphan-files/preview", async (string? relativePath, HttpContext context, IWebHostEnvironment environment, IConfiguration configuration, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = ExplicitCurrentUserId(context);
            var uploadStorage = UploadStorageOptions.From(configuration, environment.ContentRootPath);
            var selectedFile = ValidateMaintenanceFileSelection(
                new MaintenanceFileSelection { RelativePaths = new List<string> { relativePath ?? "" } },
                uploadStorage.RootPath).Single();

            var referencedPaths = await store.FindReferencedUploadPathsAsync(
                new[] { selectedFile.RelativePath },
                uploadStorage.RequestPath,
                currentUserId,
                cancellationToken);
            if (referencedPaths.Contains(selectedFile.RelativePath))
            {
                return Results.NotFound(new { error = "The file is no longer orphaned." });
            }

            EnsureMaintenanceUploadRootExists(uploadStorage.RootPath);
            var cutoff = DateTime.UtcNow.Subtract(MaintenanceFileGracePeriod);
            if (!TryValidateMaintenanceFileForDeletion(
                    selectedFile.DirectoryPath,
                    selectedFile.FullPath,
                    cutoff,
                    out _,
                    out var validationMessage))
            {
                return Results.NotFound(new { error = validationMessage });
            }

            if (!MaintenanceContentTypes.TryGetContentType(Path.GetFileName(selectedFile.FullPath), out var contentType)
                || MaintenanceActiveContentTypes.Contains(contentType))
            {
                contentType = "text/plain; charset=utf-8";
            }

            context.Response.Headers["Cache-Control"] = "no-store";
            context.Response.Headers["Content-Security-Policy"] = "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'";
            context.Response.Headers["X-Content-Type-Options"] = "nosniff";
            return Results.File(selectedFile.FullPath, contentType, enableRangeProcessing: true);
        });

        app.MapPost("/api/maintenance/orphan-files/delete", async (MaintenanceFileSelection selection, HttpContext context, IWebHostEnvironment environment, IConfiguration configuration, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = ExplicitCurrentUserId(context);
            var uploadStorage = UploadStorageOptions.From(configuration, environment.ContentRootPath);
            var selectedFiles = ValidateMaintenanceFileSelection(selection, uploadStorage.RootPath);

            // This batch call both enforces Admin access and avoids touching files
            // that are already referenced before per-file processing begins.
            var referencedPaths = await store.FindReferencedUploadPathsAsync(
                selectedFiles.Select(file => file.RelativePath),
                uploadStorage.RequestPath,
                currentUserId,
                cancellationToken);
            EnsureMaintenanceUploadRootExists(uploadStorage.RootPath);

            var cutoff = DateTime.UtcNow.Subtract(MaintenanceFileGracePeriod);
            var result = new MaintenanceFileDeleteResult();

            foreach (var selectedFile in selectedFiles)
            {
                if (referencedPaths.Contains(selectedFile.RelativePath))
                {
                    AddMaintenanceFileResult(result, selectedFile.RelativePath, "referenced", "The file is now referenced and was not deleted.");
                    continue;
                }

                if (!TryValidateMaintenanceFileForDeletion(selectedFile.DirectoryPath, selectedFile.FullPath, cutoff, out var validationStatus, out var validationMessage))
                {
                    AddMaintenanceFileResult(result, selectedFile.RelativePath, validationStatus, validationMessage);
                    continue;
                }

                // Recheck this one file against current database references before
                // the final physical validation.
                var currentReferences = await store.FindReferencedUploadPathsAsync(
                    new[] { selectedFile.RelativePath },
                    uploadStorage.RequestPath,
                    currentUserId,
                    cancellationToken);
                if (currentReferences.Contains(selectedFile.RelativePath))
                {
                    AddMaintenanceFileResult(result, selectedFile.RelativePath, "referenced", "The file became referenced and was not deleted.");
                    continue;
                }

                // The database call above creates a race window for a folder or
                // file replacement. Revalidate the physical target immediately
                // before deleting it.
                if (!TryValidateMaintenanceFileForDeletion(selectedFile.DirectoryPath, selectedFile.FullPath, cutoff, out validationStatus, out validationMessage))
                {
                    AddMaintenanceFileResult(result, selectedFile.RelativePath, validationStatus, validationMessage);
                    continue;
                }

                // Make the database reference check the last operation before
                // File.Delete. This keeps the user-requested final safety check
                // as close to the permanent deletion as possible.
                currentReferences = await store.FindReferencedUploadPathsAsync(
                    new[] { selectedFile.RelativePath },
                    uploadStorage.RequestPath,
                    currentUserId,
                    cancellationToken);
                if (currentReferences.Contains(selectedFile.RelativePath))
                {
                    AddMaintenanceFileResult(result, selectedFile.RelativePath, "referenced", "The file became referenced and was not deleted.");
                    continue;
                }

                try
                {
                    File.Delete(selectedFile.FullPath);
                    AddMaintenanceFileResult(result, selectedFile.RelativePath, "deleted", "The file was permanently deleted.");
                }
                catch (FileNotFoundException)
                {
                    AddMaintenanceFileResult(result, selectedFile.RelativePath, "missing", "The file no longer exists.");
                }
                catch (DirectoryNotFoundException)
                {
                    AddMaintenanceFileResult(result, selectedFile.RelativePath, "missing", "The file no longer exists.");
                }
                catch (IOException)
                {
                    AddMaintenanceFileResult(result, selectedFile.RelativePath, "failed", "The file could not be deleted.");
                }
                catch (UnauthorizedAccessException)
                {
                    AddMaintenanceFileResult(result, selectedFile.RelativePath, "failed", "The file could not be deleted.");
                }
            }

            return Results.Ok(result);
        });

        return app;
    }

    private static void RequireMaintenanceRecycleSelection(MaintenanceRecycleSelection selection)
    {
        if (selection?.Items is null || selection.Items.Count == 0)
        {
            throw new InvalidOperationException("Select at least one recycle-bin item.");
        }
    }

    private static List<MaintenanceOrphanFileDto> ReadMaintenanceUploadFiles(string rootPath, int currentUserId)
    {
        var files = new List<MaintenanceOrphanFileDto>();
        var cutoff = DateTime.UtcNow.Subtract(MaintenanceFileGracePeriod);

        try
        {
            var root = new DirectoryInfo(rootPath);
            if (!root.Exists)
            {
                throw new InvalidOperationException("Upload storage could not be read.");
            }

            foreach (var directory in root.EnumerateDirectories("*", SearchOption.TopDirectoryOnly))
            {
                if (!IsValidMaintenanceStorageKind(directory.Name)
                    || (directory.Attributes & FileAttributes.ReparsePoint) != 0)
                {
                    continue;
                }

                foreach (var file in directory.EnumerateFiles("*", SearchOption.TopDirectoryOnly))
                {
                    if ((file.Attributes & FileAttributes.ReparsePoint) != 0
                        || file.LastWriteTimeUtc > cutoff)
                    {
                        continue;
                    }

                    files.Add(new MaintenanceOrphanFileDto
                    {
                        RelativePath = $"{directory.Name}/{file.Name}",
                        FileName = file.Name,
                        Category = directory.Name,
                        Url = MaintenancePreviewUrl(currentUserId, directory.Name, file.Name),
                        ByteLength = file.Length,
                        LastModifiedAt = DateTime.SpecifyKind(file.LastWriteTimeUtc, DateTimeKind.Utc)
                    });
                }
            }
        }
        catch (IOException exception)
        {
            throw new InvalidOperationException("Upload storage could not be read.", exception);
        }
        catch (UnauthorizedAccessException exception)
        {
            throw new InvalidOperationException("Upload storage could not be read.", exception);
        }

        return files
            .OrderBy(file => file.RelativePath, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static string MaintenancePreviewUrl(int currentUserId, string category, string fileName)
    {
        var relativePath = Uri.EscapeDataString($"{category}/{fileName}");
        return $"/api/maintenance/orphan-files/preview?relativePath={relativePath}&currentUserId={currentUserId}";
    }

    private static List<(string RelativePath, string DirectoryPath, string FullPath)> ValidateMaintenanceFileSelection(
        MaintenanceFileSelection selection,
        string rootPath)
    {
        if (selection?.RelativePaths is null || selection.RelativePaths.Count == 0)
        {
            throw new InvalidOperationException("Select at least one orphan file.");
        }

        var rootFullPath = Path.GetFullPath(rootPath);
        var rootPrefix = $"{rootFullPath.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)}{Path.DirectorySeparatorChar}";
        var pathComparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
        var pathComparer = OperatingSystem.IsWindows() ? StringComparer.OrdinalIgnoreCase : StringComparer.Ordinal;
        var seen = new HashSet<string>(pathComparer);
        var files = new List<(string RelativePath, string DirectoryPath, string FullPath)>();

        foreach (var suppliedPath in selection.RelativePaths)
        {
            var relativePath = (suppliedPath ?? "").Trim().Replace('\\', '/');
            var parts = relativePath.Split('/', StringSplitOptions.None);
            if (Path.IsPathRooted(relativePath)
                || parts.Length != 2
                || !IsValidMaintenanceStorageKind(parts[0])
                || !IsValidMaintenanceFileName(parts[1]))
            {
                throw new InvalidOperationException("One or more orphan-file paths are invalid.");
            }

            relativePath = $"{parts[0]}/{parts[1]}";
            if (!seen.Add(relativePath)) continue;

            string directoryPath;
            string fullPath;
            try
            {
                directoryPath = Path.GetFullPath(Path.Combine(rootFullPath, parts[0]));
                fullPath = Path.GetFullPath(Path.Combine(directoryPath, parts[1]));
            }
            catch (Exception exception) when (exception is ArgumentException or NotSupportedException or PathTooLongException)
            {
                throw new InvalidOperationException("One or more orphan-file paths are invalid.", exception);
            }

            if (!fullPath.StartsWith(rootPrefix, pathComparison)
                || !string.Equals(Path.GetDirectoryName(fullPath), directoryPath, pathComparison))
            {
                throw new InvalidOperationException("One or more orphan-file paths are invalid.");
            }

            files.Add((relativePath, directoryPath, fullPath));
        }

        return files;
    }

    private static bool IsValidMaintenanceStorageKind(string value)
    {
        return !string.IsNullOrWhiteSpace(value)
            && value.All(character => character is >= 'a' and <= 'z'
                || character is >= '0' and <= '9'
                || character == '-');
    }

    private static bool IsValidMaintenanceFileName(string value)
    {
        if (string.IsNullOrWhiteSpace(value)
            || value is "." or ".."
            || value.EndsWith(' ')
            || value.EndsWith('.')
            || !string.Equals(value, Path.GetFileName(value), StringComparison.Ordinal))
        {
            return false;
        }

        const string windowsInvalidCharacters = "<>:\"/\\|?*";
        return value.All(character => character >= ' '
            && !windowsInvalidCharacters.Contains(character)
            && Array.IndexOf(Path.GetInvalidFileNameChars(), character) < 0);
    }

    private static void EnsureMaintenanceUploadRootExists(string rootPath)
    {
        if (!new DirectoryInfo(rootPath).Exists)
        {
            throw new InvalidOperationException("Upload storage could not be accessed.");
        }
    }

    private static bool TryValidateMaintenanceFileForDeletion(
        string directoryPath,
        string fullPath,
        DateTime cutoff,
        out string status,
        out string message)
    {
        try
        {
            if ((File.GetAttributes(directoryPath) & FileAttributes.ReparsePoint) != 0
                || (File.GetAttributes(fullPath) & FileAttributes.ReparsePoint) != 0)
            {
                status = "failed";
                message = "The file could not be safely deleted.";
                return false;
            }

            if (new FileInfo(fullPath).LastWriteTimeUtc > cutoff)
            {
                status = "failed";
                message = "The file is inside the 24-hour upload safety window.";
                return false;
            }

            status = "";
            message = "";
            return true;
        }
        catch (FileNotFoundException)
        {
            status = "missing";
            message = "The file no longer exists.";
            return false;
        }
        catch (DirectoryNotFoundException)
        {
            status = "missing";
            message = "The file no longer exists.";
            return false;
        }
        catch (IOException)
        {
            status = "failed";
            message = "The file could not be checked.";
            return false;
        }
        catch (UnauthorizedAccessException)
        {
            status = "failed";
            message = "The file could not be checked.";
            return false;
        }
    }

    private static void AddMaintenanceFileResult(
        MaintenanceFileDeleteResult result,
        string relativePath,
        string status,
        string message)
    {
        result.Results.Add(new MaintenanceFileDeleteItemResult
        {
            RelativePath = relativePath,
            Status = status,
            Message = message
        });

        if (status == "deleted") result.DeletedCount += 1;
        else if (status == "failed") result.FailedCount += 1;
        else result.SkippedCount += 1;
    }
}
