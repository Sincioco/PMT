using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PMT.Data;
using PMT.Models;
using static PMT.Endpoints.EndpointHelpers;

namespace PMT.Endpoints;

internal static class SecurityEndpoints
{
    public static IEndpointRouteBuilder MapSecurityEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPut("/api/security/{resourceKey}", async (
            string resourceKey,
            SaveSecurityPermissionsInput input,
            HttpContext context,
            SqlPmtStore store,
            CancellationToken cancellationToken) =>
        {
            await store.SaveSecurityPermissionsAsync(resourceKey, input, CurrentUserId(context), cancellationToken);
            return Results.Ok(new { saved = true });
        });

        return app;
    }
}
