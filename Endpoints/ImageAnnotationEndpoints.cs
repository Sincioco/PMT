using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PMT.Data;
using static PMT.Endpoints.EndpointHelpers;

namespace PMT.Endpoints;

internal static class ImageAnnotationEndpoints
{
    internal const long MaximumLibraryBytes = 50L * 1024 * 1024;
    private const int MaximumTemplateCount = 50;

    public static IEndpointRouteBuilder MapImageAnnotationEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/image-annotation/template-library", async (HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = ExplicitCurrentUserId(context);
            var libraryJson = await store.GetUserImageAnnotationTemplateLibraryAsync(currentUserId, cancellationToken);
            return Results.Content(libraryJson, "application/json", Encoding.UTF8);
        });

        app.MapGet("/api/image-annotation/default-template-library", async (HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            _ = ExplicitCurrentUserId(context);
            var libraryJson = await store.GetImageAnnotationDefaultTemplateLibraryAsync(cancellationToken);
            return Results.Content(libraryJson, "application/json", Encoding.UTF8);
        });

        app.MapPut("/api/image-annotation/template-library", async (JsonElement library, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var libraryJson = ValidateLibrary(library);
            var currentUserId = ExplicitCurrentUserId(context);
            var savedJson = await store.SaveUserImageAnnotationTemplateLibraryAsync(libraryJson, currentUserId, cancellationToken);
            return Results.Content(savedJson, "application/json", Encoding.UTF8);
        });

        return app;
    }

    private static string ValidateLibrary(JsonElement library)
    {
        if (library.ValueKind != JsonValueKind.Object
            || !library.TryGetProperty("version", out var version)
            || version.ValueKind != JsonValueKind.Number
            || !version.TryGetInt32(out var versionNumber)
            || versionNumber != 1
            || !library.TryGetProperty("templates", out var templates)
            || templates.ValueKind != JsonValueKind.Array
            || !library.TryGetProperty("defaults", out var defaults)
            || defaults.ValueKind != JsonValueKind.Object)
        {
            throw new InvalidOperationException("The image annotation template library must be a version 1 JSON object with templates and defaults.");
        }

        if (templates.GetArrayLength() > MaximumTemplateCount)
        {
            throw new InvalidOperationException($"The image annotation template library cannot contain more than {MaximumTemplateCount} templates.");
        }

        var libraryJson = library.GetRawText();
        if (Encoding.UTF8.GetByteCount(libraryJson) > MaximumLibraryBytes)
        {
            throw new InvalidOperationException("The image annotation template library cannot exceed 50 MiB.");
        }

        return libraryJson;
    }
}
