using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PMT.Data;
using PMT.Models;
using static PMT.Endpoints.EndpointHelpers;

namespace PMT.Endpoints;

internal static class ContentEndpoints
{
    public static IEndpointRouteBuilder MapContentEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/devlogs", async (DevLogInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = CurrentUserId(context);
            var right = IsImport(input.AuditContext) ? "Import" : "Create";
            await store.RequirePermissionAsync(currentUserId, DevLogResource(input.LogType), right, cancellationToken);
            var id = await store.SaveDevLogAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id });
        });

        app.MapPut("/api/devlogs/{id:int}", async (int id, DevLogInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            input.Id = id;
            var currentUserId = CurrentUserId(context);
            var right = IsImport(input.AuditContext) ? "Import" : "Update";
            await store.RequireDevLogPermissionAsync(currentUserId, id, right, cancellationToken);
            var savedId = await store.SaveDevLogAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id = savedId });
        });

        app.MapDelete("/api/devlogs/{id:int}", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = CurrentUserId(context);
            await store.RequireDevLogPermissionAsync(currentUserId, id, "Delete", cancellationToken);
            await store.DeleteDevLogAsync(id, currentUserId, cancellationToken);
            return Results.NoContent();
        });

        app.MapPost("/api/blogs", async (BlogInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = CurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Documentation", "Create", cancellationToken);
            var id = await store.SaveBlogAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id });
        });

        app.MapPut("/api/blogs/{id:int}", async (int id, BlogInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            input.Id = id;
            var currentUserId = CurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Documentation", "Update", cancellationToken);
            var savedId = await store.SaveBlogAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id = savedId });
        });

        app.MapDelete("/api/blogs/{id:int}", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = CurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Documentation", "Delete", cancellationToken);
            await store.DeleteBlogAsync(id, currentUserId, cancellationToken);
            return Results.NoContent();
        });

        return app;
    }

    private static string DevLogResource(string? logType) =>
        string.Equals(logType?.Trim(), "Log", StringComparison.OrdinalIgnoreCase) ? "PersonalLog" : "Scrum";

    private static bool IsImport(string? auditContext) =>
        string.Equals(auditContext?.Trim(), "Import", StringComparison.OrdinalIgnoreCase);
}
