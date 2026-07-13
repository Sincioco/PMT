using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PMT.Data;
using PMT.Models;
using static PMT.Endpoints.EndpointHelpers;

namespace PMT.Endpoints;

internal static class ProjectEndpoints
{
    public static IEndpointRouteBuilder MapProjectEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/projects", async (ProjectInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = CurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Projects", "Create", cancellationToken);
            var id = await store.SaveProjectAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id });
        });

        app.MapPut("/api/projects/{id:int}", async (int id, ProjectInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            input.Id = id;
            var currentUserId = CurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Projects", "Update", cancellationToken);
            var savedId = await store.SaveProjectAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id = savedId });
        });

        app.MapDelete("/api/projects/{id:int}", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = CurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Projects", "Delete", cancellationToken);
            await store.DeleteProjectAsync(id, currentUserId, cancellationToken);
            return Results.NoContent();
        });

        return app;
    }
}
