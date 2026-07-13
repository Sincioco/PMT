using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PMT.Data;
using PMT.Models;
using static PMT.Endpoints.EndpointHelpers;

namespace PMT.Endpoints;

internal static class AuthenticationEndpoints
{
    public static IEndpointRouteBuilder MapAuthenticationEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/login", async (LoginInput input, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var user = await store.LoginAsync(input, cancellationToken);
            return user is null ? Results.Unauthorized() : Results.Ok(new { userId = user.Id, nickname = user.Nickname, isAdmin = user.IsAdmin, role = user.Role });
        });

        app.MapPost("/api/change-password", async (ChangePasswordInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            await store.ChangePasswordAsync(CurrentUserId(context), input, cancellationToken);
            return Results.Ok(new { changed = true });
        });

        app.MapPut("/api/users/{id:int}/password", async (int id, AdminResetPasswordInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            await store.AdminResetPasswordAsync(id, input, CurrentUserId(context), cancellationToken);
            return Results.Ok(new { changed = true });
        });

        return app;
    }
}
