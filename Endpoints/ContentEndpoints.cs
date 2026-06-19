using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PMT.Data;
using PMT.Models;
using static PMT.Endpoints.EndpointHelpers;

namespace PMT.Endpoints;

internal static class ContentEndpoints
{
    public static IEndpointRouteBuilder MapContentEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/devlogs", async (DevLogInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var id = await store.SaveDevLogAsync(input, CurrentUserId(context), cancellationToken);
            return Results.Ok(new { id });
        });

        app.MapPut("/api/devlogs/{id:int}", async (int id, DevLogInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            input.Id = id;
            var savedId = await store.SaveDevLogAsync(input, CurrentUserId(context), cancellationToken);
            return Results.Ok(new { id = savedId });
        });

        app.MapDelete("/api/devlogs/{id:int}", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            await store.DeleteDevLogAsync(id, CurrentUserId(context), cancellationToken);
            return Results.NoContent();
        });

        app.MapPost("/api/blogs", async (BlogInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var id = await store.SaveBlogAsync(input, CurrentUserId(context), cancellationToken);
            return Results.Ok(new { id });
        });

        app.MapPut("/api/blogs/{id:int}", async (int id, BlogInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            input.Id = id;
            var savedId = await store.SaveBlogAsync(input, CurrentUserId(context), cancellationToken);
            return Results.Ok(new { id = savedId });
        });

        app.MapDelete("/api/blogs/{id:int}", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            await store.DeleteBlogAsync(id, CurrentUserId(context), cancellationToken);
            return Results.NoContent();
        });

        return app;
    }
}
