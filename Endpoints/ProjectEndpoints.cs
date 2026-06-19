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
            var id = await store.SaveProjectAsync(input, CurrentUserId(context), cancellationToken);
            return Results.Ok(new { id });
        });

        app.MapPut("/api/projects/{id:int}", async (int id, ProjectInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            input.Id = id;
            var savedId = await store.SaveProjectAsync(input, CurrentUserId(context), cancellationToken);
            return Results.Ok(new { id = savedId });
        });

        app.MapDelete("/api/projects/{id:int}", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            await store.DeleteProjectAsync(id, CurrentUserId(context), cancellationToken);
            return Results.NoContent();
        });

        return app;
    }
}
