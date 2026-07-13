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

app.UseStaticFiles();

var uploadStorage = UploadStorageOptions.From(builder.Configuration, app.Environment.ContentRootPath);
using var uploadStorageConnection = UploadStorageAccess.Connect(uploadStorage);
Directory.CreateDirectory(uploadStorage.RootPath);
app.UseStaticFiles(new StaticFileOptions
{
    // Uploaded files stay outside wwwroot. In production this path can be a
    // file share, while SQL stores only the URL and metadata.
    FileProvider = new PhysicalFileProvider(uploadStorage.RootPath),
    RequestPath = uploadStorage.RequestPath
});

// The frontend loads all screen data through this one endpoint, then performs
// small save actions through focused endpoints below.
app.MapAuthenticationEndpoints();
app.MapInvitationEndpoints();
app.MapStateEndpoints();
app.MapProjectEndpoints();
app.MapSprintEndpoints();
app.MapWorkItemEndpoints();
app.MapWfhScheduleEndpoints();
app.MapSettingsEndpoints();
app.MapSecurityEndpoints();
app.MapContentEndpoints();
app.MapUploadEndpoints();
app.MapDevelopmentEndpoints();

app.MapFallback(ServeIndexAsync);

app.Run();

async Task ServeIndexAsync(HttpContext context)
{
    var indexPath = Path.Combine(app.Environment.WebRootPath, "index.html");
    var html = await File.ReadAllTextAsync(indexPath, context.RequestAborted);
    var pathBase = EffectivePathBase(context);
    var baseHref = string.IsNullOrEmpty(pathBase) ? "/" : $"{pathBase}/";

    html = html
        .Replace("<meta name=\"pmt-path-base\" content=\"\">", $"<meta name=\"pmt-path-base\" content=\"{WebUtility.HtmlEncode(pathBase)}\">")
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
