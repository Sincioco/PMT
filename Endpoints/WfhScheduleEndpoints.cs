using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PMT.Data;
using PMT.Models;
using static PMT.Endpoints.EndpointHelpers;

namespace PMT.Endpoints;

internal static class WfhScheduleEndpoints
{
    public static IEndpointRouteBuilder MapWfhScheduleEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/wfh-schedule", async (HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            return Results.Ok(await store.GetWfhScheduleAsync(CurrentUserId(context), cancellationToken));
        });

        app.MapPut("/api/wfh-schedule/{userId:int}", async (int userId, WfhScheduleInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            input.UserId = userId;
            await store.SaveWfhScheduleAsync(input, CurrentUserId(context), cancellationToken);
            return Results.Ok(new { saved = true });
        });

        app.MapPost("/api/wfh-schedule/reorder", async (ReorderWfhScheduleInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            if (input.UserIds.Count == 0)
            {
                return Results.BadRequest(new { error = "Select at least one user to reorder." });
            }

            await store.ReorderWfhScheduleAsync(input, CurrentUserId(context), cancellationToken);
            return Results.Ok(new { reordered = true });
        });

        app.MapPost("/api/wfh-schedule/reset", async (HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            await store.ResetWfhScheduleAsync(CurrentUserId(context), cancellationToken);
            return Results.Ok(new { reset = true });
        });

        return app;
    }
}
