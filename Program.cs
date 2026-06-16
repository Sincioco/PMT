using System.Text.RegularExpressions;
using Microsoft.Extensions.FileProviders;
using PMT.Data;
using PMT.Models;

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
Directory.CreateDirectory(uploadStorage.RootPath);
app.UseStaticFiles(new StaticFileOptions
{
    // Uploaded files stay outside wwwroot. In production this path can be a
    // share on the database server, while SQL stores only the URL and metadata.
    FileProvider = new PhysicalFileProvider(uploadStorage.RootPath),
    RequestPath = uploadStorage.RequestPath
});

// The frontend loads all screen data through this one endpoint, then performs
// small save actions through focused endpoints below.
app.MapPost("/api/login", async (LoginInput input, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    var user = await store.LoginAsync(input, cancellationToken);
    return user is null ? Results.Unauthorized() : Results.Ok(new { userId = user.Id, nickname = user.Nickname, isAdmin = user.IsAdmin, role = user.Role });
});

app.MapPost("/api/change-password", async (ChangePasswordInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    await store.ChangePasswordAsync(CurrentUserId(context), input, cancellationToken);
    return Results.Ok(new { changed = true });
});

app.MapGet("/api/state", async (SqlPmtStore store, CancellationToken cancellationToken) =>
{
    return Results.Ok(await store.GetStateAsync(cancellationToken));
});

app.MapPost("/api/projects", async (ProjectInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    var id = await store.SaveProjectAsync(input, CurrentUserId(context), cancellationToken);
    return Results.Ok(new { id });
});

app.MapPut("/api/projects/{id:int}", async (int id, ProjectInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    input.Id = id;
    var savedId = await store.SaveProjectAsync(input, CurrentUserId(context), cancellationToken);
    return Results.Ok(new { id = savedId });
});

app.MapDelete("/api/projects/{id:int}", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    await store.DeleteProjectAsync(id, CurrentUserId(context), cancellationToken);
    return Results.NoContent();
});

app.MapPost("/api/sprints", async (SprintInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    var id = await store.SaveSprintAsync(input, CurrentUserId(context), cancellationToken);
    return Results.Ok(new { id });
});

app.MapPut("/api/sprints/{id:int}", async (int id, SprintInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    input.Id = id;
    var savedId = await store.SaveSprintAsync(input, CurrentUserId(context), cancellationToken);
    return Results.Ok(new { id = savedId });
});

app.MapPost("/api/sprints/{id:int}/finish", async (int id, FinishSprintInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    var newSprintId = await store.FinishSprintAsync(id, input, CurrentUserId(context), cancellationToken);
    return Results.Ok(new { id = newSprintId });
});

app.MapDelete("/api/sprints/{id:int}", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    await store.DeleteSprintAsync(id, CurrentUserId(context), cancellationToken);
    return Results.NoContent();
});

app.MapPost("/api/tasks", async (WorkTaskInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    var id = await store.SaveTaskAsync(input, CurrentUserId(context), cancellationToken);
    return Results.Ok(new { id });
});

app.MapPut("/api/tasks/{id:int}", async (int id, WorkTaskInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    input.Id = id;
    var savedId = await store.SaveTaskAsync(input, CurrentUserId(context), cancellationToken);
    return Results.Ok(new { id = savedId });
});

app.MapPost("/api/tasks/reorder", async (ReorderTasksInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    if (input.TaskIds.Count == 0)
    {
        return Results.BadRequest(new { error = "Select at least one task to reorder." });
    }

    await store.ReorderTasksAsync(input, CurrentUserId(context), cancellationToken);
    return Results.Ok(new { reordered = true });
});

app.MapPost("/api/tasks/{id:int}/duplicate", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    var newTaskId = await store.DuplicateTaskAsync(id, CurrentUserId(context), cancellationToken);
    return Results.Ok(new { id = newTaskId });
});

app.MapDelete("/api/tasks/{id:int}", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    await store.DeleteTaskAsync(id, CurrentUserId(context), cancellationToken);
    return Results.NoContent();
});

app.MapPost("/api/users", async (UserInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    var id = await store.SaveUserAsync(input, CurrentUserId(context), cancellationToken);
    return Results.Ok(new { id });
});

app.MapPut("/api/users/{id:int}", async (int id, UserInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    input.Id = id;
    var savedId = await store.SaveUserAsync(input, CurrentUserId(context), cancellationToken);
    return Results.Ok(new { id = savedId });
});

app.MapDelete("/api/users/{id:int}", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    await store.DeleteUserAsync(id, CurrentUserId(context), cancellationToken);
    return Results.NoContent();
});

app.MapPost("/api/lookups", async (LookupInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    var id = await store.SaveLookupAsync(input, CurrentUserId(context), cancellationToken);
    return Results.Ok(new { id });
});

app.MapPut("/api/lookups/{id:int}", async (int id, LookupInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    input.Id = id;
    var savedId = await store.SaveLookupAsync(input, CurrentUserId(context), cancellationToken);
    return Results.Ok(new { id = savedId });
});

app.MapDelete("/api/lookups/{id:int}", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    await store.DeleteLookupAsync(id, CurrentUserId(context), cancellationToken);
    return Results.NoContent();
});

app.MapPost("/api/holidays", async (HolidayInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    var id = await store.SaveHolidayAsync(input, CurrentUserId(context), cancellationToken);
    return Results.Ok(new { id });
});

app.MapPut("/api/holidays/{id:int}", async (int id, HolidayInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    input.Id = id;
    var savedId = await store.SaveHolidayAsync(input, CurrentUserId(context), cancellationToken);
    return Results.Ok(new { id = savedId });
});

app.MapDelete("/api/holidays/{id:int}", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    await store.DeleteHolidayAsync(id, CurrentUserId(context), cancellationToken);
    return Results.NoContent();
});

app.MapPost("/api/devlogs", async (DevLogInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    var id = await store.SaveDevLogAsync(input, CurrentUserId(context), cancellationToken);
    return Results.Ok(new { id });
});

app.MapPut("/api/devlogs/{id:int}", async (int id, DevLogInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    input.Id = id;
    var savedId = await store.SaveDevLogAsync(input, CurrentUserId(context), cancellationToken);
    return Results.Ok(new { id = savedId });
});

app.MapDelete("/api/devlogs/{id:int}", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    await store.DeleteDevLogAsync(id, CurrentUserId(context), cancellationToken);
    return Results.NoContent();
});

app.MapPost("/api/blogs", async (BlogInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    var id = await store.SaveBlogAsync(input, CurrentUserId(context), cancellationToken);
    return Results.Ok(new { id });
});

app.MapPut("/api/blogs/{id:int}", async (int id, BlogInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    input.Id = id;
    var savedId = await store.SaveBlogAsync(input, CurrentUserId(context), cancellationToken);
    return Results.Ok(new { id = savedId });
});

app.MapDelete("/api/blogs/{id:int}", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    await store.DeleteBlogAsync(id, CurrentUserId(context), cancellationToken);
    return Results.NoContent();
});

app.MapPost("/api/uploads/{kind}", async (string kind, HttpRequest request, IWebHostEnvironment environment, IConfiguration configuration, CancellationToken cancellationToken) =>
{
    var upload = await SaveUploadAsync(kind, request, environment, configuration, cancellationToken);
    return Results.Ok(upload);
});

app.MapPost("/api/tasks/{id:int}/attachments", async (int id, HttpRequest request, HttpContext context, IWebHostEnvironment environment, IConfiguration configuration, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    var upload = await SaveUploadAsync("tasks", request, environment, configuration, cancellationToken);
    var attachmentId = await store.AddTaskAttachmentAsync(id, upload, CurrentUserId(context), cancellationToken);
    return Results.Ok(new { id = attachmentId, upload });
});

app.MapPost("/api/blogs/{id:int}/attachments", async (int id, HttpRequest request, HttpContext context, IWebHostEnvironment environment, IConfiguration configuration, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    var upload = await SaveUploadAsync("blogs", request, environment, configuration, cancellationToken);
    var attachmentId = await store.AddBlogAttachmentAsync(id, upload, CurrentUserId(context), cancellationToken);
    return Results.Ok(new { id = attachmentId, upload });
});

app.MapPost("/api/development/clear-non-pmt", async (HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    await store.DevelopmentClearNonPmtAsync(CurrentUserId(context), cancellationToken);
    return Results.Ok(new { cleared = true });
});

app.MapPost("/api/development/clear-pmt", async (HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    await store.DevelopmentClearPmtAsync(CurrentUserId(context), cancellationToken);
    return Results.Ok(new { cleared = true });
});

app.MapPost("/api/development/clear-users", async (HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    await store.DevelopmentClearUsersAsync(CurrentUserId(context), cancellationToken);
    return Results.Ok(new { cleared = true });
});

app.MapPost("/api/development/restore-seed-data", async (HttpContext context, IWebHostEnvironment environment, SqlPmtStore store, CancellationToken cancellationToken) =>
{
    await store.RestoreInitialSeedDataAsync(environment.ContentRootPath, CurrentUserId(context), cancellationToken);
    return Results.Ok(new { restored = true });
});

app.MapFallbackToFile("index.html");

app.Run();

static int CurrentUserId(HttpContext context)
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

static async Task<UploadResult> SaveUploadAsync(string kind, HttpRequest request, IWebHostEnvironment environment, IConfiguration configuration, CancellationToken cancellationToken)
{
    // Uploaded files are copied to the configured file store. SQL keeps only
    // the URL and file metadata, not the file bytes.
    var form = await request.ReadFormAsync(cancellationToken);
    var file = form.Files.GetFile("file") ?? form.Files.FirstOrDefault();
    if (file is null || file.Length == 0)
    {
        throw new InvalidOperationException("No file was uploaded.");
    }

    var safeKind = Regex.Replace(kind.ToLowerInvariant(), "[^a-z0-9-]", "");
    if (string.IsNullOrWhiteSpace(safeKind))
    {
        safeKind = "misc";
    }

    var uploadStorage = UploadStorageOptions.From(configuration, environment.ContentRootPath);
    var originalFileName = Path.GetFileName(file.FileName);
    var extension = Path.GetExtension(originalFileName);
    var storedFileName = $"{Guid.NewGuid():N}{extension}";
    var uploadRoot = Path.Combine(uploadStorage.RootPath, safeKind);
    Directory.CreateDirectory(uploadRoot);

    var targetPath = Path.Combine(uploadRoot, storedFileName);
    await using (var targetStream = File.Create(targetPath))
    {
        await file.CopyToAsync(targetStream, cancellationToken);
    }

    return new UploadResult
    {
        FileName = originalFileName,
        Url = $"{uploadStorage.RequestPath.TrimEnd('/')}/{safeKind}/{storedFileName}",
        ContentType = file.ContentType,
        ByteLength = file.Length
    };
}

sealed class UploadStorageOptions
{
    public string RootPath { get; init; } = "";
    public string RequestPath { get; init; } = "/uploads";

    public static UploadStorageOptions From(IConfiguration configuration, string contentRootPath)
    {
        var rootPath = configuration["UploadStorage:RootPath"];
        if (string.IsNullOrWhiteSpace(rootPath))
        {
            rootPath = Path.Combine(contentRootPath, "UploadedFiles");
        }

        var requestPath = configuration["UploadStorage:RequestPath"];
        if (string.IsNullOrWhiteSpace(requestPath))
        {
            requestPath = "/uploads";
        }

        if (!requestPath.StartsWith('/'))
        {
            requestPath = "/" + requestPath;
        }

        return new UploadStorageOptions
        {
            RootPath = Path.GetFullPath(rootPath),
            RequestPath = requestPath
        };
    }
}
