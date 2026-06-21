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
            var id = await store.SaveTaskAsync(input, CurrentUserId(context), cancellationToken);
            return Results.Ok(new { id });
        });

        app.MapPut("/api/tasks/{id:int}", async (int id, WorkTaskInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            input.Id = id;
            var savedId = await store.SaveTaskAsync(input, CurrentUserId(context), cancellationToken);
            return Results.Ok(new { id = savedId });
        });

        app.MapPost("/api/backlog/tasks", async (WorkTaskInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var id = await store.SaveBacklogTaskAsync(input, CurrentUserId(context), cancellationToken);
            return Results.Ok(new { id });
        });

        app.MapPut("/api/backlog/tasks/{id:int}", async (int id, WorkTaskInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            input.Id = id;
            var savedId = await store.SaveBacklogTaskAsync(input, CurrentUserId(context), cancellationToken);
            return Results.Ok(new { id = savedId });
        });

        app.MapPost("/api/tasks/reorder", async (ReorderTasksInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            if (input.TaskIds.Count == 0)
            {
                return Results.BadRequest(new { error = "Select at least one task to reorder." });
            }

            await store.ReorderTasksAsync(input, CurrentUserId(context), cancellationToken);
            return Results.Ok(new { reordered = true });
        });

        app.MapPost("/api/tasks/{id:int}/duplicate", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var newTaskId = await store.DuplicateTaskAsync(id, CurrentUserId(context), cancellationToken);
            return Results.Ok(new { id = newTaskId });
        });

        app.MapPost("/api/backlog/tasks/{id:int}/duplicate", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var newTaskId = await store.DuplicateBacklogTaskAsync(id, CurrentUserId(context), cancellationToken);
            return Results.Ok(new { id = newTaskId });
        });

        app.MapDelete("/api/tasks/{id:int}", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            await store.DeleteTaskAsync(id, CurrentUserId(context), cancellationToken);
            return Results.NoContent();
        });

        app.MapDelete("/api/backlog/tasks/{id:int}", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            await store.DeleteBacklogTaskAsync(id, CurrentUserId(context), cancellationToken);
            return Results.NoContent();
        });

        return app;
    }
}
