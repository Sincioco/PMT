using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PMT.Data;
using PMT.Models;
using static PMT.Endpoints.EndpointHelpers;

namespace PMT.Endpoints;

internal static class WorkItemEndpoints
{
    public static IEndpointRouteBuilder MapWorkItemEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/tasks", async (WorkTaskInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = CurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, TaskResource(input.TaskType), IsImport(input.AuditContext) ? "Import" : "Create", cancellationToken);
            var id = await store.SaveTaskAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id });
        });

        app.MapPut("/api/tasks/{id:int}", async (int id, WorkTaskInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            input.Id = id;
            var currentUserId = CurrentUserId(context);
            await store.RequireTaskPermissionAsync(currentUserId, id, IsImport(input.AuditContext) ? "Import" : "Update", false, cancellationToken);
            var savedId = await store.SaveTaskAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id = savedId });
        });

        app.MapPost("/api/backlog/tasks", async (WorkTaskInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = CurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Backlog", IsImport(input.AuditContext) ? "Import" : "Create", cancellationToken);
            var id = await store.SaveBacklogTaskAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id });
        });

        app.MapPut("/api/backlog/tasks/{id:int}", async (int id, WorkTaskInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            input.Id = id;
            var currentUserId = CurrentUserId(context);
            await store.RequireTaskPermissionAsync(currentUserId, id, IsImport(input.AuditContext) ? "Import" : "Update", true, cancellationToken);
            var savedId = await store.SaveBacklogTaskAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id = savedId });
        });

        app.MapPost("/api/tasks/reorder", async (ReorderTasksInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            if (input.TaskIds.Count == 0)
            {
                return Results.BadRequest(new { error = "Select at least one task to reorder." });
            }

            var currentUserId = CurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Board", "Update", cancellationToken);
            await store.ReorderTasksAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { reordered = true });
        });

        app.MapPost("/api/tasks/{id:int}/duplicate", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = CurrentUserId(context);
            await store.RequireTaskPermissionAsync(currentUserId, id, "Create", false, cancellationToken);
            var newTaskId = await store.DuplicateTaskAsync(id, currentUserId, cancellationToken);
            return Results.Ok(new { id = newTaskId });
        });

        app.MapPost("/api/backlog/tasks/{id:int}/duplicate", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = CurrentUserId(context);
            await store.RequireTaskPermissionAsync(currentUserId, id, "Create", true, cancellationToken);
            var newTaskId = await store.DuplicateBacklogTaskAsync(id, currentUserId, cancellationToken);
            return Results.Ok(new { id = newTaskId });
        });

        app.MapPost("/api/tasks/{id:int}/convert-to-document", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = CurrentUserId(context);
            await store.RequireTaskPermissionAsync(currentUserId, id, "Update", false, cancellationToken);
            await store.RequirePermissionAsync(currentUserId, "Documentation", "Create", cancellationToken);
            var blogId = await store.ConvertTaskToBlogAsync(id, currentUserId, cancellationToken);
            return Results.Ok(new { blogId });
        });

        app.MapDelete("/api/tasks/{id:int}", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = CurrentUserId(context);
            await store.RequireTaskPermissionAsync(currentUserId, id, "Delete", false, cancellationToken);
            await store.DeleteTaskAsync(id, currentUserId, cancellationToken);
            return Results.NoContent();
        });

        app.MapDelete("/api/backlog/tasks/{id:int}", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = CurrentUserId(context);
            await store.RequireTaskPermissionAsync(currentUserId, id, "Delete", true, cancellationToken);
            await store.DeleteBacklogTaskAsync(id, currentUserId, cancellationToken);
            return Results.NoContent();
        });

        return app;
    }

    private static string TaskResource(string? taskType) =>
        string.Equals(taskType?.Trim(), "Bug", StringComparison.OrdinalIgnoreCase) ? "BugTracking" : "DevTasks";

    private static bool IsImport(string? auditContext) =>
        string.Equals(auditContext?.Trim(), "Import", StringComparison.OrdinalIgnoreCase);
}
