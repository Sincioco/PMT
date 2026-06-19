using Microsoft.AspNetCore.Http;

namespace PMT.Endpoints;

internal static class EndpointHelpers
{
    public static int CurrentUserId(HttpContext context)
    {
        // Authentication is intentionally simple for the internal tool. The browser
        // sends the selected user id so the stored procedures can apply role rules.
        if (int.TryParse(context.Request.Headers["X-PMT-UserId"], out var headerUserId) && headerUserId > 0)
        {
            return headerUserId;
        }

        if (int.TryParse(context.Request.Query["currentUserId"], out var queryUserId) && queryUserId > 0)
        {
            return queryUserId;
        }

        return 1;
    }
}
