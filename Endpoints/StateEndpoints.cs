using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PMT.Data;

namespace PMT.Endpoints;

internal static class StateEndpoints
{
    public static IEndpointRouteBuilder MapStateEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/state", async (SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            return Results.Ok(await store.GetStateAsync(cancellationToken));
        });

        return app;
    }
}
