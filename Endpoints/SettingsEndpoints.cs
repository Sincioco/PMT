using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PMT.Data;
using PMT.Models;
using static PMT.Endpoints.EndpointHelpers;

namespace PMT.Endpoints;

internal static class SettingsEndpoints
{
    public static IEndpointRouteBuilder MapSettingsEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/usernames/suggestion", async (string? username, int? excludeUserId, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            return Results.Ok(await store.SuggestUsernameAsync(username ?? "", excludeUserId ?? 0, cancellationToken));
        });

        app.MapPost("/api/users", async (UserInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = CurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Settings", "Create", cancellationToken);
            var id = await store.SaveUserAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id });
        });

        app.MapPut("/api/users/{id:int}", async (int id, UserInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            input.Id = id;
            var currentUserId = CurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Settings", "Update", cancellationToken);
            var savedId = await store.SaveUserAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id = savedId });
        });

        app.MapDelete("/api/users/{id:int}", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = CurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Settings", "Delete", cancellationToken);
            await store.DeleteUserAsync(id, currentUserId, cancellationToken);
            return Results.NoContent();
        });

        app.MapPost("/api/lookups", async (LookupInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = CurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Settings", "Create", cancellationToken);
            var id = await store.SaveLookupAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id });
        });

        app.MapPut("/api/lookups/{id:int}", async (int id, LookupInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            input.Id = id;
            var currentUserId = CurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Settings", "Update", cancellationToken);
            var savedId = await store.SaveLookupAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id = savedId });
        });

        app.MapDelete("/api/lookups/{id:int}", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = CurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Settings", "Delete", cancellationToken);
            await store.DeleteLookupAsync(id, currentUserId, cancellationToken);
            return Results.NoContent();
        });

        app.MapPost("/api/holidays", async (HolidayInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = CurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Settings", "Create", cancellationToken);
            var id = await store.SaveHolidayAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id });
        });

        app.MapPut("/api/holidays/{id:int}", async (int id, HolidayInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            input.Id = id;
            var currentUserId = CurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Settings", "Update", cancellationToken);
            var savedId = await store.SaveHolidayAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id = savedId });
        });

        app.MapDelete("/api/holidays/{id:int}", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = CurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Settings", "Delete", cancellationToken);
            await store.DeleteHolidayAsync(id, currentUserId, cancellationToken);
            return Results.NoContent();
        });

        return app;
    }
}
