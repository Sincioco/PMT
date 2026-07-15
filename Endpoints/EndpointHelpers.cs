using Microsoft.AspNetCore.Http;
using System.Security.Claims;

namespace PMT.Endpoints;

internal sealed class AuthenticationRequiredException : Exception
{
    public AuthenticationRequiredException() : base("A signed-in user is required.")
    {
    }
}

internal static class EndpointHelpers
{
    public const string OriginalUserIdClaim = "pmt:original-user-id";
    public const string OriginalUserNameClaim = "pmt:original-user-name";
    public const string ImpersonatedUserIdClaim = "pmt:impersonated-user-id";
    public const string EffectiveUserVersionClaim = "pmt:effective-user-version";
    public const string OriginalUserVersionClaim = "pmt:original-user-version";

    public static int ExplicitCurrentUserId(HttpContext context)
    {
        if (int.TryParse(context.User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) && userId > 0)
        {
            return userId;
        }

        throw new AuthenticationRequiredException();
    }

    public static int CurrentUserId(HttpContext context)
    {
        return ExplicitCurrentUserId(context);
    }

    public static int OriginalUserId(HttpContext context)
    {
        if (int.TryParse(context.User.FindFirstValue(OriginalUserIdClaim), out var userId) && userId > 0)
        {
            return userId;
        }

        return CurrentUserId(context);
    }

    public static bool IsImpersonating(HttpContext context)
    {
        return int.TryParse(context.User.FindFirstValue(ImpersonatedUserIdClaim), out var userId) && userId > 0;
    }
}
