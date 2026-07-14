using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Data.SqlClient;
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
            var currentUserId = CurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Projects", "Create", cancellationToken);
            try
            {
                var id = await store.SaveProjectAsync(input, currentUserId, cancellationToken);
                return (IResult)Results.Ok(new { id });
            }
            catch (SqlException exception) when (exception.Number == 50007)
            {
                return (IResult)Results.Conflict(new { error = exception.Message, code = "archived-project-code" });
            }
        });

        app.MapPut("/api/projects/{id:int}", async (int id, ProjectInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            input.Id = id;
            var currentUserId = CurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Projects", "Update", cancellationToken);
            try
            {
                var savedId = await store.SaveProjectAsync(input, currentUserId, cancellationToken);
                return (IResult)Results.Ok(new { id = savedId });
            }
            catch (SqlException exception) when (exception.Number == 50007)
            {
                return (IResult)Results.Conflict(new { error = exception.Message, code = "archived-project-code" });
            }
        });

        app.MapDelete("/api/projects/{id:int}", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = CurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Projects", "Delete", cancellationToken);
            await store.DeleteProjectAsync(id, currentUserId, cancellationToken);
            return Results.NoContent();
        });

        return app;
    }
}
