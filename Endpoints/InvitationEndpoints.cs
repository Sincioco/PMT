using System.Security.Cryptography;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PMT.Data;
using PMT.Models;
using static PMT.Endpoints.EndpointHelpers;

namespace PMT.Endpoints;

internal static class InvitationEndpoints
{
    public static IEndpointRouteBuilder MapInvitationEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/invitations", async (CreateInvitationInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            input.ProjectIds = (input.ProjectIds ?? new List<int>()).Where(id => id > 0).Distinct().ToList();
            if (input.ProjectIds.Count == 0)
            {
                throw new InvalidOperationException("Select at least one project.");
            }

            var tokenBytes = RandomNumberGenerator.GetBytes(32);
            var token = Convert.ToHexString(tokenBytes).ToLowerInvariant();
            var tokenHash = SHA256.HashData(tokenBytes);
            var expiresAt = await store.CreateInvitationAsync(
                tokenHash,
                input,
                ExplicitCurrentUserId(context),
                cancellationToken);

            return Results.Ok(new { token, expiresAt });
        });

        app.MapGet("/api/invitations/{token}", async (string token, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            if (!TryHashToken(token, out var tokenHash))
            {
                return Results.NotFound();
            }

            var invitation = await store.GetInvitationAsync(tokenHash, cancellationToken);
            return invitation is null ? Results.NotFound() : Results.Ok(invitation);
        });

        app.MapPost("/api/invitations/{token}/accept", async (string token, AcceptInvitationInput input, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            if (!TryHashToken(token, out var tokenHash))
            {
                return Results.NotFound();
            }

            input.Nickname = (input.Nickname ?? "").Trim();
            input.AvatarUrl = (input.AvatarUrl ?? "").Trim();
            if (input.Nickname.Length == 0 || input.Nickname.Length > 80)
            {
                throw new InvalidOperationException("Username is required and cannot exceed 80 characters.");
            }

            if ((input.Password ?? "").Length < 8)
            {
                throw new InvalidOperationException("Password must be at least 8 characters.");
            }

            if (input.AvatarUrl.Length == 0 || input.AvatarUrl.Length > 500)
            {
                throw new InvalidOperationException("Select or upload a valid avatar before continuing.");
            }

            var result = await store.AcceptInvitationAsync(tokenHash, input, cancellationToken);
            return Results.Ok(result);
        });

        return app;
    }

    private static bool TryHashToken(string token, out byte[] tokenHash)
    {
        tokenHash = Array.Empty<byte>();
        if (string.IsNullOrWhiteSpace(token) || token.Length != 64)
        {
            return false;
        }

        try
        {
            var tokenBytes = Convert.FromHexString(token);
            if (tokenBytes.Length != 32)
            {
                return false;
            }

            tokenHash = SHA256.HashData(tokenBytes);
            return true;
        }
        catch (FormatException)
        {
            return false;
        }
    }
}
