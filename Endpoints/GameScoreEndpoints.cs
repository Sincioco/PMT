using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PMT.Data;
using PMT.Models;
using static PMT.Endpoints.EndpointHelpers;

namespace PMT.Endpoints;

internal static class GameScoreEndpoints
{
    public static IEndpointRouteBuilder MapGameScoreEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/game-scores/{gameKey}", async (
            string gameKey,
            int? top,
            HttpContext context,
            SqlPmtStore store,
            CancellationToken cancellationToken) =>
        {
            _ = ExplicitCurrentUserId(context);
            var scores = await store.GetGameScoresAsync(gameKey, Math.Clamp(top ?? 10, 1, 50), cancellationToken);
            return Results.Ok(scores);
        });

        app.MapPost("/api/game-scores", async (
            SaveGameScoreInput input,
            HttpContext context,
            SqlPmtStore store,
            CancellationToken cancellationToken) =>
        {
            var currentUserId = ExplicitCurrentUserId(context);
            var score = await store.AddGameScoreAsync(input, currentUserId, cancellationToken);
            return Results.Ok(score);
        });

        return app;
    }
}
