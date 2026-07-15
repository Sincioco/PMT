using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
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
        app.MapPost("/api/login", async (LoginInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            if (context.User.Identity?.IsAuthenticated == true && IsImpersonating(context))
            {
                throw new InvalidOperationException("Exit impersonation before signing in as another user.");
            }

            var user = await store.LoginAsync(input, cancellationToken);
            if (user is null) return Results.Unauthorized();

            await SignInUserAsync(context, user, user, false);
            return Results.Ok(SessionPayload(user, user, false));
        });

        app.MapGet("/api/session", async (HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();

            var effectiveUser = await store.GetSessionUserAsync(CurrentUserId(context), cancellationToken);
            var originalUser = await store.GetSessionUserAsync(OriginalUserId(context), cancellationToken);
            if (effectiveUser is null || originalUser is null)
            {
                await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                return Results.Unauthorized();
            }

            var isImpersonating = IsImpersonating(context);
            return Results.Ok(SessionPayload(effectiveUser, originalUser, isImpersonating));
        });

        app.MapPost("/api/logout", async (
            HttpContext context,
            SqlPmtStore store,
            ILoggerFactory loggerFactory,
            CancellationToken cancellationToken) =>
        {
            var auditRecorded = true;
            if (context.User.Identity?.IsAuthenticated == true && IsImpersonating(context))
            {
                try
                {
                    await store.EndImpersonationAsync(OriginalUserId(context), CurrentUserId(context), cancellationToken);
                }
                catch (Exception exception)
                {
                    auditRecorded = false;
                    loggerFactory.CreateLogger("PMT.Impersonation").LogError(exception, "Could not audit the end of an impersonation session during logout.");
                }
            }

            await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Results.Ok(new { loggedOut = true, auditRecorded });
        });

        app.MapPost("/api/impersonation/start", async (
            ImpersonationInput input,
            HttpContext context,
            SqlPmtStore store,
            CancellationToken cancellationToken) =>
        {
            if (IsImpersonating(context))
            {
                throw new InvalidOperationException("Exit the current impersonation before starting another one.");
            }

            var admin = await store.GetSessionUserAsync(CurrentUserId(context), cancellationToken)
                ?? throw new AuthenticationRequiredException();
            var target = await store.BeginImpersonationAsync(admin.Id, input.UserId, cancellationToken)
                ?? throw new InvalidOperationException("The selected user is unavailable.");

            await SignInUserAsync(context, target, admin, true);
            return Results.Ok(SessionPayload(target, admin, true));
        });

        app.MapPost("/api/impersonation/stop", async (HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            if (!IsImpersonating(context))
            {
                throw new InvalidOperationException("No impersonation session is active.");
            }

            var adminUserId = OriginalUserId(context);
            var targetUserId = CurrentUserId(context);
            var admin = await store.GetSessionUserAsync(adminUserId, cancellationToken);
            if (admin is null)
            {
                await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                return Results.Unauthorized();
            }

            await store.EndImpersonationAsync(adminUserId, targetUserId, cancellationToken);
            await SignInUserAsync(context, admin, admin, false);
            return Results.Ok(SessionPayload(admin, admin, false));
        });

        app.MapPost("/api/change-password", async (ChangePasswordInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            await store.ChangePasswordAsync(CurrentUserId(context), input, cancellationToken);
            await RefreshSignInAsync(context, store, cancellationToken);
            return Results.Ok(new { changed = true });
        });

        app.MapPut("/api/users/{id:int}/password", async (int id, AdminResetPasswordInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = CurrentUserId(context);
            await store.AdminResetPasswordAsync(id, input, currentUserId, cancellationToken);
            if (id == currentUserId)
            {
                await RefreshSignInAsync(context, store, cancellationToken);
            }
            return Results.Ok(new { changed = true });
        });

        return app;
    }

    internal static async Task SignInUserAsync(HttpContext context, UserDto effectiveUser, UserDto originalUser, bool isImpersonating)
    {
        if (effectiveUser.RowVersion.Length == 0 || originalUser.RowVersion.Length == 0)
        {
            throw new InvalidOperationException("The user authentication version is unavailable.");
        }

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, effectiveUser.Id.ToString()),
            new(ClaimTypes.Name, effectiveUser.Nickname),
            new(OriginalUserIdClaim, originalUser.Id.ToString()),
            new(OriginalUserNameClaim, originalUser.Nickname),
            new(EffectiveUserVersionClaim, Convert.ToBase64String(effectiveUser.RowVersion)),
            new(OriginalUserVersionClaim, Convert.ToBase64String(originalUser.RowVersion))
        };
        if (isImpersonating)
        {
            claims.Add(new Claim(ImpersonatedUserIdClaim, effectiveUser.Id.ToString()));
        }

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        var properties = new AuthenticationProperties
        {
            AllowRefresh = !isImpersonating,
            IsPersistent = !isImpersonating,
            ExpiresUtc = isImpersonating
                ? DateTimeOffset.UtcNow.AddHours(4)
                : DateTimeOffset.UtcNow.AddDays(7)
        };
        await context.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identity),
            properties);
    }

    internal static async Task RefreshSignInAsync(HttpContext context, SqlPmtStore store, CancellationToken cancellationToken)
    {
        var isImpersonating = IsImpersonating(context);
        var effectiveUser = await store.GetSessionUserAsync(CurrentUserId(context), cancellationToken)
            ?? throw new AuthenticationRequiredException();
        var originalUser = isImpersonating
            ? await store.GetSessionUserAsync(OriginalUserId(context), cancellationToken)
            : effectiveUser;
        if (originalUser is null || (isImpersonating && !originalUser.IsAdmin))
        {
            throw new AuthenticationRequiredException();
        }

        await SignInUserAsync(context, effectiveUser, originalUser, isImpersonating);
    }

    private static object SessionPayload(UserDto effectiveUser, UserDto originalUser, bool isImpersonating)
    {
        return new
        {
            userId = effectiveUser.Id,
            nickname = effectiveUser.Nickname,
            isAdmin = effectiveUser.IsAdmin,
            role = effectiveUser.Role,
            originalUserId = originalUser.Id,
            originalUserName = originalUser.Nickname,
            isImpersonating,
            impersonatedUserName = isImpersonating ? effectiveUser.Nickname : ""
        };
    }
}
