using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PMT.Data;
using PMT.Models;
using static PMT.Endpoints.EndpointHelpers;

namespace PMT.Endpoints;

internal static class AttendanceEndpoints
{
    public static IEndpointRouteBuilder MapAttendanceEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/attendance", async (
            DateTime startDate,
            DateTime endDate,
            HttpContext context,
            SqlPmtStore store,
            CancellationToken cancellationToken) =>
        {
            var currentUserId = ExplicitCurrentUserId(context);
            return Results.Ok(await store.GetAttendanceCalendarAsync(startDate, endDate, currentUserId, cancellationToken));
        });

        app.MapPost("/api/attendance", async (
            AttendanceInput input,
            HttpContext context,
            SqlPmtStore store,
            CancellationToken cancellationToken) =>
        {
            var currentUserId = ExplicitCurrentUserId(context);
            var id = await store.RecordAttendanceAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id });
        });

        app.MapPost("/api/vacations", async (
            VacationInput input,
            HttpContext context,
            SqlPmtStore store,
            CancellationToken cancellationToken) =>
        {
            input.Id = 0;
            var currentUserId = ExplicitCurrentUserId(context);
            var id = await store.SaveVacationAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id });
        });

        app.MapPut("/api/vacations/{id:int}", async (
            int id,
            VacationInput input,
            HttpContext context,
            SqlPmtStore store,
            CancellationToken cancellationToken) =>
        {
            input.Id = id;
            var currentUserId = ExplicitCurrentUserId(context);
            var savedId = await store.SaveVacationAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id = savedId });
        });

        app.MapDelete("/api/vacations/{id:int}", async (
            int id,
            HttpContext context,
            SqlPmtStore store,
            CancellationToken cancellationToken) =>
        {
            var currentUserId = ExplicitCurrentUserId(context);
            await store.CancelVacationAsync(id, currentUserId, cancellationToken);
            return Results.NoContent();
        });

        return app;
    }
}
