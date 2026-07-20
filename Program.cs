using System.Net;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.FileProviders;
using PMT.Data;
using PMT.Endpoints;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddScoped<SqlPmtStore>();
builder.Services.AddHttpContextAccessor();
builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "PMT.Auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Strict;
        options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;
        options.ExpireTimeSpan = TimeSpan.FromDays(7);
        options.SlidingExpiration = true;
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
        options.Events.OnValidatePrincipal = async context =>
        {
            var cancellationToken = context.HttpContext.RequestAborted;
            var effectiveUserIdText = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
            var isImpersonating = int.TryParse(
                context.Principal?.FindFirstValue(EndpointHelpers.ImpersonatedUserIdClaim),
                out var impersonatedUserId)
                && impersonatedUserId > 0;
            var originalUserIdText = context.Principal?.FindFirstValue(EndpointHelpers.OriginalUserIdClaim);
            var effectiveUserVersionClaim = context.Principal?.FindFirstValue(EndpointHelpers.EffectiveUserVersionClaim);
            var originalUserVersionClaim = context.Principal?.FindFirstValue(EndpointHelpers.OriginalUserVersionClaim);
            var hasEffectiveUserId = int.TryParse(effectiveUserIdText, out var effectiveUserId) && effectiveUserId > 0;
            var hasOriginalUserId = int.TryParse(originalUserIdText, out var originalUserId) && originalUserId > 0;
            var store = context.HttpContext.RequestServices.GetRequiredService<SqlPmtStore>();
            var effectiveUser = hasEffectiveUserId
                ? await store.GetSessionUserAsync(effectiveUserId, cancellationToken)
                : null;
            var originalUser = isImpersonating && hasOriginalUserId
                ? await store.GetSessionUserAsync(originalUserId, cancellationToken)
                : effectiveUser;
            var effectiveUserVersionMatches = effectiveUser is not null
                && effectiveUser.RowVersion.Length > 0
                && Convert.ToBase64String(effectiveUser.RowVersion) == effectiveUserVersionClaim;
            var originalUserVersionMatches = originalUser is not null
                && originalUser.RowVersion.Length > 0
                && Convert.ToBase64String(originalUser.RowVersion) == originalUserVersionClaim;

            if (effectiveUserVersionMatches
                && originalUserVersionMatches
                && (!isImpersonating || originalUser?.IsAdmin == true)) return;

            var userWasRevoked = effectiveUser is null
                || originalUser is null
                || (isImpersonating && !originalUser.IsAdmin);
            if (userWasRevoked && isImpersonating && hasEffectiveUserId && hasOriginalUserId)
            {
                try
                {
                    await store.EndImpersonationAsync(originalUserId, effectiveUserId, cancellationToken);
                }
                catch (Exception exception)
                {
                    context.HttpContext.RequestServices
                        .GetRequiredService<ILoggerFactory>()
                        .CreateLogger("PMT.Impersonation")
                        .LogError(exception, "Could not audit an impersonation session ended by user revocation.");
                }
            }

            context.RejectPrincipal();
            await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            context.HttpContext.Response.Cookies.Delete("PMT.Auth");
        };
    });
builder.Services.Configure<Microsoft.AspNetCore.Http.Json.JsonOptions>(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
});

var app = builder.Build();
var configuredPathBase = NormalizePathBase(builder.Configuration["Deployment:PathBase"]);
const string uploadStorageUnavailableMessage = "File upload storage is unavailable or cannot be reached. Check UploadStorage:RootPath, credentials, and the PMT service account's folder permissions. PMT can still be used, but uploads and uploaded files are unavailable until PMT is restarted.";
var uploadStorageWarning = "";

app.Use(async (context, next) =>
{
    if (string.IsNullOrEmpty(configuredPathBase)
        || !string.IsNullOrEmpty(context.Request.PathBase.Value)
        || !context.Request.Path.StartsWithSegments(configuredPathBase, out var remainingPath))
    {
        await next();
        return;
    }

    var originalPath = context.Request.Path;
    var originalPathBase = context.Request.PathBase;
    context.Request.Path = remainingPath;
    context.Request.PathBase = configuredPathBase;

    try
    {
        await next();
    }
    finally
    {
        context.Request.Path = originalPath;
        context.Request.PathBase = originalPathBase;
    }
});

app.Use(async (context, next) =>
{
    if (HttpMethods.IsPut(context.Request.Method)
        && context.Request.Path == "/api/image-annotation/template-library")
    {
        if (context.Request.ContentLength > ImageAnnotationEndpoints.MaximumLibraryBytes)
        {
            context.Response.StatusCode = StatusCodes.Status413PayloadTooLarge;
            await context.Response.WriteAsJsonAsync(new
            {
                error = "The image annotation template library cannot exceed 50 MiB."
            });
            return;
        }

        var requestSizeFeature = context.Features.Get<IHttpMaxRequestBodySizeFeature>();
        if (requestSizeFeature is { IsReadOnly: false })
        {
            requestSizeFeature.MaxRequestBodySize = ImageAnnotationEndpoints.MaximumLibraryBytes;
        }
    }

    await next();
});

app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var exception = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>()?.Error;
        context.Response.StatusCode = exception is AuthenticationRequiredException
            ? StatusCodes.Status401Unauthorized
            : StatusCodes.Status400BadRequest;
        await context.Response.WriteAsJsonAsync(new
        {
            error = exception?.Message ?? "The request could not be completed."
        });
    });
});

app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (SaveConflictException exception)
    {
        if (context.Response.HasStarted) throw;

        context.Response.Clear();
        context.Response.StatusCode = StatusCodes.Status409Conflict;
        await context.Response.WriteAsJsonAsync(new
        {
            error = exception.Message,
            code = "save-conflict"
        });
    }
});

app.Use(async (context, next) =>
{
    if (HttpMethods.IsGet(context.Request.Method)
        && (string.IsNullOrEmpty(context.Request.Path.Value)
            || context.Request.Path == "/"
            || context.Request.Path == "/index.html"))
    {
        await ServeIndexAsync(context);
        return;
    }

    await next();
});

var uploadRequestPath = UploadStorageOptions.RequestPathFrom(builder.Configuration);
IDisposable? uploadStorageConnection = null;
StaticFileOptions? uploadStaticFileOptions = null;

try
{
    var uploadStorage = UploadStorageOptions.From(builder.Configuration, app.Environment.ContentRootPath);
    uploadRequestPath = uploadStorage.RequestPath;
    uploadStorageConnection = UploadStorageAccess.Connect(uploadStorage);
    Directory.CreateDirectory(uploadStorage.RootPath);
    uploadStaticFileOptions = new StaticFileOptions
    {
        // Uploaded files stay outside wwwroot. In production this path can be a
        // file share, while SQL stores only the URL and metadata.
        FileProvider = new PhysicalFileProvider(uploadStorage.RootPath),
        RequestPath = uploadStorage.RequestPath,
        OnPrepareResponse = context =>
        {
            context.Context.Response.Headers["X-Content-Type-Options"] = "nosniff";
            if (string.Equals(Path.GetExtension(context.File.Name), ".svg", StringComparison.OrdinalIgnoreCase))
            {
                // RTE SVGs are image assets, never executable same-origin documents.
                // The annotation editor emits only controlled SVG plus an embedded data image.
                context.Context.Response.Headers["Content-Security-Policy"] =
                    "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'";
            }
        }
    };
}
catch (Exception exception) when (IsUploadStorageStartupException(exception))
{
    uploadStorageConnection?.Dispose();
    uploadStorageConnection = null;
    uploadStorageWarning = uploadStorageUnavailableMessage;
    app.Logger.LogError(
        exception,
        "Upload storage initialization failed for {UploadRootPath}. PMT will continue without file upload storage.",
        builder.Configuration["UploadStorage:RootPath"] ?? "UploadedFiles");
}

if (!string.IsNullOrEmpty(uploadStorageWarning))
{
    app.Use(async (context, next) =>
    {
        if (context.Request.Path.StartsWithSegments(uploadRequestPath))
        {
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            await context.Response.WriteAsJsonAsync(new { error = uploadStorageWarning });
            return;
        }

        await next();
    });
}

app.UseStaticFiles();
if (uploadStaticFileOptions is not null)
{
    app.UseStaticFiles(uploadStaticFileOptions);
}

app.Use(async (context, next) =>
{
    if (!context.Request.Path.StartsWithSegments("/api"))
    {
        await next();
        return;
    }

    context.Response.Headers.CacheControl = "no-store";
    var isUnsafeMethod = !HttpMethods.IsGet(context.Request.Method)
        && !HttpMethods.IsHead(context.Request.Method)
        && !HttpMethods.IsOptions(context.Request.Method)
        && !HttpMethods.IsTrace(context.Request.Method);
    if (!isUnsafeMethod)
    {
        await next();
        return;
    }

    var fetchSite = context.Request.Headers["Sec-Fetch-Site"].ToString();
    var origin = context.Request.Headers.Origin.ToString();
    var fetchSiteAllowed = string.IsNullOrWhiteSpace(fetchSite)
        || fetchSite.Equals("same-origin", StringComparison.OrdinalIgnoreCase)
        || fetchSite.Equals("none", StringComparison.OrdinalIgnoreCase);
    var originAllowed = string.IsNullOrWhiteSpace(origin)
        || (Uri.TryCreate(origin, UriKind.Absolute, out var originUri)
            && originUri.Authority.Equals(context.Request.Host.Value, StringComparison.OrdinalIgnoreCase));
    if (!fetchSiteAllowed || !originAllowed)
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        await context.Response.WriteAsJsonAsync(new { error = "Cross-origin PMT changes are not allowed." });
        return;
    }

    await next();
});

app.UseAuthentication();

// The frontend loads all screen data through this one endpoint, then performs
// small save actions through focused endpoints below.
app.MapAuthenticationEndpoints();
app.MapInvitationEndpoints();
app.MapStateEndpoints();
app.MapProjectEndpoints();
app.MapSprintEndpoints();
app.MapWorkItemEndpoints();
app.MapWfhScheduleEndpoints();
app.MapAttendanceEndpoints();
app.MapSettingsEndpoints();
app.MapSecurityEndpoints();
app.MapContentEndpoints();
app.MapImageAnnotationEndpoints();
app.MapUploadEndpoints(uploadStorageWarning);
app.MapDevelopmentEndpoints();
app.MapGameScoreEndpoints();

app.MapFallback(ServeIndexAsync);

using var uploadStorageConnectionScope = uploadStorageConnection;
app.Run();

async Task ServeIndexAsync(HttpContext context)
{
    var indexPath = Path.Combine(app.Environment.WebRootPath, "index.html");
    var html = await File.ReadAllTextAsync(indexPath, context.RequestAborted);
    var pathBase = EffectivePathBase(context);
    var baseHref = string.IsNullOrEmpty(pathBase) ? "/" : $"{pathBase}/";

    html = html
        .Replace("<meta name=\"pmt-path-base\" content=\"\">", $"<meta name=\"pmt-path-base\" content=\"{WebUtility.HtmlEncode(pathBase)}\">")
        .Replace("<meta name=\"pmt-upload-storage-warning\" content=\"\">", $"<meta name=\"pmt-upload-storage-warning\" content=\"{WebUtility.HtmlEncode(uploadStorageWarning)}\">")
        .Replace("<base href=\"/\">", $"<base href=\"{WebUtility.HtmlEncode(baseHref)}\">");

    context.Response.ContentType = "text/html; charset=utf-8";
    await context.Response.WriteAsync(html, context.RequestAborted);
}

string EffectivePathBase(HttpContext context)
{
    if (!string.IsNullOrEmpty(configuredPathBase)) return configuredPathBase;
    return NormalizePathBase(context.Request.PathBase.Value);
}

static string NormalizePathBase(string? pathBase)
{
    var value = (pathBase ?? string.Empty).Trim().Replace('\\', '/');
    if (string.IsNullOrEmpty(value) || value == "/") return string.Empty;
    if (!value.StartsWith('/')) value = $"/{value}";
    return value.TrimEnd('/');
}

static bool IsUploadStorageStartupException(Exception exception)
{
    return exception is InvalidOperationException
        or IOException
        or UnauthorizedAccessException
        or ArgumentException
        or NotSupportedException
        or System.Security.SecurityException;
}
