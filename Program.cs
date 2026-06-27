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

app.UseDefaultFiles();
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
app.MapStateEndpoints();
app.MapProjectEndpoints();
app.MapSprintEndpoints();
app.MapWorkItemEndpoints();
app.MapWfhScheduleEndpoints();
app.MapSettingsEndpoints();
app.MapContentEndpoints();
app.MapUploadEndpoints();
app.MapDevelopmentEndpoints();

app.MapFallbackToFile("index.html");

app.Run();
