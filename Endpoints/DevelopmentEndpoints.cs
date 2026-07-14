using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PMT.Data;
using static PMT.Endpoints.EndpointHelpers;

namespace PMT.Endpoints;

internal static class DevelopmentEndpoints
{
    public static IEndpointRouteBuilder MapDevelopmentEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/development/clear-non-pmt", async (HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            await store.DevelopmentClearNonPmtAsync(ExplicitCurrentUserId(context), cancellationToken);
            return Results.Ok(new { cleared = true });
        });

        app.MapPost("/api/development/clear-pmt", async (HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            await store.DevelopmentClearPmtAsync(ExplicitCurrentUserId(context), cancellationToken);
            return Results.Ok(new { cleared = true });
        });

        app.MapPost("/api/development/clear-users", async (HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            await store.DevelopmentClearUsersAsync(ExplicitCurrentUserId(context), cancellationToken);
            return Results.Ok(new { cleared = true });
        });

        app.MapPost("/api/development/restore-seed-data", async (HttpContext context, IWebHostEnvironment environment, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            await store.RestoreInitialSeedDataAsync(environment.ContentRootPath, ExplicitCurrentUserId(context), cancellationToken);
            return Results.Ok(new { restored = true });
        });

        return app;
    }
}
