using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PMT.Data;
using PMT.Models;
using static PMT.Endpoints.EndpointHelpers;

namespace PMT.Endpoints;

internal static class SprintEndpoints
{
    public static IEndpointRouteBuilder MapSprintEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/sprints", async (SprintInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var id = await store.SaveSprintAsync(input, CurrentUserId(context), cancellationToken);
            return Results.Ok(new { id });
        });

        app.MapPut("/api/sprints/{id:int}", async (int id, SprintInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            input.Id = id;
            var savedId = await store.SaveSprintAsync(input, CurrentUserId(context), cancellationToken);
            return Results.Ok(new { id = savedId });
        });

        app.MapPost("/api/sprints/{id:int}/finish", async (int id, FinishSprintInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var newSprintId = await store.FinishSprintAsync(id, input, CurrentUserId(context), cancellationToken);
            return Results.Ok(new { id = newSprintId });
        });

        app.MapDelete("/api/sprints/{id:int}", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            await store.DeleteSprintAsync(id, CurrentUserId(context), cancellationToken);
            return Results.NoContent();
        });

        return app;
    }
}
