using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PMT.Data;
using static PMT.Endpoints.EndpointHelpers;

namespace PMT.Endpoints;

internal static class StateEndpoints
{
    public static IEndpointRouteBuilder MapStateEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/state", async (HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            return Results.Ok(await store.GetStateAsync(CurrentUserId(context), cancellationToken));
        });

        return app;
    }
}
