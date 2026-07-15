using System.Net;
using Microsoft.Extensions.FileProviders;
using PMT.Data;
using PMT.Endpoints;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddScoped<SqlPmtStore>();
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

app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var exception = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>()?.Error;
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        await context.Response.WriteAsJsonAsync(new
        {
            error = exception?.Message ?? "The request could not be completed."
        });
    });
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
        RequestPath = uploadStorage.RequestPath
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
app.MapUploadEndpoints(uploadStorageWarning);
app.MapDevelopmentEndpoints();

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
