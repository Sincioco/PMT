using System.Net;
using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PMT.Data;
using PMT.Models;
using static PMT.Endpoints.EndpointHelpers;

namespace PMT.Endpoints;

internal static class ContentEndpoints
{
    public static IEndpointRouteBuilder MapContentEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/public/document/{token:guid}", async (Guid token, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var blog = await store.GetPublicBlogAsync(token, cancellationToken);
            return PublicBlogResult(context, blog, isDiagram: false);
        });

        app.MapGet("/public/diagram/{token:guid}", async (Guid token, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var blog = await store.GetPublicBlogAsync(token, cancellationToken);
            return PublicBlogResult(context, blog, isDiagram: true);
        });

        app.MapPost("/api/public-links", async (PublicBlogLinkInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = ExplicitCurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Documentation", "Read", cancellationToken);
            var link = await store.CreatePublicBlogLinkAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { token = link.Token.ToString("D"), expiresAt = link.ExpiresAt });
        });

        app.MapGet("/api/suggestions", async (HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            _ = CurrentUserId(context);
            return Results.Ok(await store.GetSuggestionsAsync(cancellationToken));
        });

        app.MapPost("/api/devlogs", async (DevLogInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = ExplicitCurrentUserId(context);
            var right = IsImport(input.AuditContext) ? "Import" : "Create";
            await store.RequirePermissionAsync(currentUserId, DevLogResource(input.LogType), right, cancellationToken);
            var id = await store.SaveDevLogAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id });
        });

        app.MapPut("/api/devlogs/{id:int}", async (int id, DevLogInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            input.Id = id;
            var currentUserId = ExplicitCurrentUserId(context);
            var right = IsImport(input.AuditContext) ? "Import" : "Update";
            await store.RequireDevLogPermissionAsync(currentUserId, id, right, cancellationToken);
            var savedId = await store.SaveDevLogAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id = savedId });
        });

        app.MapDelete("/api/devlogs/{id:int}", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = ExplicitCurrentUserId(context);
            await store.RequireDevLogPermissionAsync(currentUserId, id, "Delete", cancellationToken);
            await store.DeleteDevLogAsync(id, currentUserId, cancellationToken);
            return Results.NoContent();
        });

        app.MapPost("/api/blogs", async (BlogInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = ExplicitCurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Documentation", "Create", cancellationToken);
            var id = await store.SaveBlogAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id });
        });

        app.MapPut("/api/blogs/{id:int}", async (int id, BlogInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            input.Id = id;
            var currentUserId = ExplicitCurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Documentation", "Update", cancellationToken);
            var savedId = await store.SaveBlogAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id = savedId });
        });

        app.MapPut("/api/blogs/{id:int}/move", async (int id, MoveBlogInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = ExplicitCurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Documentation", "Update", cancellationToken);
            await store.MoveBlogAsync(id, input, currentUserId, cancellationToken);
            return Results.NoContent();
        });

        app.MapDelete("/api/blogs/{id:int}", async (int id, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = ExplicitCurrentUserId(context);
            await store.RequirePermissionAsync(currentUserId, "Documentation", "Delete", cancellationToken);
            await store.DeleteBlogAsync(id, currentUserId, cancellationToken);
            return Results.NoContent();
        });

        app.MapPost("/api/suggestions", async (SuggestionInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = CurrentUserId(context);
            input.Id = 0;
            var id = await store.SaveSuggestionAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id });
        });

        app.MapPut("/api/suggestions/{id:int}", async (int id, SuggestionInput input, HttpContext context, SqlPmtStore store, CancellationToken cancellationToken) =>
        {
            var currentUserId = CurrentUserId(context);
            input.Id = id;
            id = await store.SaveSuggestionAsync(input, currentUserId, cancellationToken);
            return Results.Ok(new { id });
        });

        return app;
    }

    private static string DevLogResource(string? logType) =>
        string.Equals(logType?.Trim(), "Log", StringComparison.OrdinalIgnoreCase) ? "PersonalLog" : "Scrum";

    private static bool IsImport(string? auditContext) =>
        string.Equals(auditContext?.Trim(), "Import", StringComparison.OrdinalIgnoreCase);

    private static IResult PublicBlogResult(HttpContext context, BlogPostDto? blog, bool isDiagram)
    {
        if (blog is null) return Results.NotFound("Public content was not found.");

        var html = PublicBlogPageHtml(context, blog, isDiagram);
        return Results.Content(html, "text/html; charset=utf-8", Encoding.UTF8);
    }

    private static string PublicBlogPageHtml(HttpContext context, BlogPostDto blog, bool isDiagram)
    {
        var safeTitle = Html(blog.Title);
        var subtitle = Html(PublicBlogSubtitle(blog, isDiagram));
        var bodyHtml = PublicBodyHtml(context, blog.BodyHtml);
        var attachments = PublicAttachmentsHtml(context, blog.Attachments);
        var builder = new StringBuilder();
        builder.AppendLine("<!doctype html>");
        builder.AppendLine("<html lang=\"en\" data-theme=\"light\">");
        builder.AppendLine("<head>");
        builder.AppendLine("  <meta charset=\"utf-8\">");
        builder.AppendLine("  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">");
        builder.AppendLine($"  <title>{safeTitle} - PMT</title>");
        builder.Append(PublicCssLinksHtml(context, isDiagram));
        builder.AppendLine("  <style>");
        builder.AppendLine("    :root { color-scheme: light; font-family: Arial, Helvetica, sans-serif; color: #17202a; background: #f6f8fb; }");
        builder.AppendLine("    * { box-sizing: border-box; }");
        builder.AppendLine("    body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; }");
        builder.AppendLine("    .public-pmt-header { height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 0 24px; border-bottom: 1px solid #d6dde8; background: #fff; flex: 0 0 auto; }");
        builder.AppendLine("    .public-pmt-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }");
        builder.AppendLine("    .public-pmt-brand img { width: 38px; height: 38px; object-fit: contain; }");
        builder.AppendLine("    .public-pmt-brand strong { display: block; font-size: 17px; }");
        builder.AppendLine("    .public-pmt-brand span { display: block; color: #5d6b7a; font-size: 12px; }");
        builder.AppendLine("    .public-content-title { min-width: 0; text-align: right; }");
        builder.AppendLine("    .public-content-title strong { display: block; font-size: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 52vw; }");
        builder.AppendLine("    .public-content-title span { color: #5d6b7a; font-size: 12px; }");
        builder.AppendLine("    main { flex: 1 1 auto; min-height: 0; }");
        builder.AppendLine("    .public-content-body { max-width: 1180px; margin: 0 auto; padding: 28px; line-height: 1.5; }");
        builder.AppendLine("    .public-content-body img { max-width: 100%; height: auto; }");
        builder.AppendLine("    .public-diagram-shell { height: calc(100vh - 64px); min-height: 0; display: flex; flex-direction: column; gap: 12px; overflow: auto; padding: 12px; background: var(--color-page, #f6f8fb); }");
        builder.AppendLine("    .public-diagram-shell > .pmt-diagram-ole { flex: 1 0 auto; width: 100%; height: calc(100vh - 88px); max-height: calc(100vh - 88px); margin: 0; }");
        builder.AppendLine("    .public-diagram-shell > .pmt-diagram-ole.is-maximized { margin: 0; }");
        builder.AppendLine("    .public-diagram-shell template { display: none; }");
        builder.AppendLine("    .public-attachments { margin-top: 28px; padding-top: 18px; border-top: 1px solid #d6dde8; }");
        builder.AppendLine("    .public-attachments a { display: inline-block; margin: 0 10px 10px 0; color: #175fbd; }");
        builder.AppendLine("    @media (max-width: 720px) {");
        builder.AppendLine("      .public-pmt-header { padding: 0 14px; }");
        builder.AppendLine("      .public-content-title strong { max-width: 42vw; }");
        builder.AppendLine("      .public-content-body { padding: 18px; }");
        builder.AppendLine("    }");
        builder.AppendLine("  </style>");
        builder.AppendLine("</head>");
        builder.AppendLine("<body>");
        builder.AppendLine("  <header class=\"public-pmt-header\">");
        builder.AppendLine("    <div class=\"public-pmt-brand\">");
        builder.AppendLine($"      <img src=\"{HtmlAttr(PublicPath(context, "/assets/project-pmt.svg?v=20260621-transparent"))}\" alt=\"\">");
        builder.AppendLine("      <div><strong>PMT</strong><span>Project Management Tool</span></div>");
        builder.AppendLine("    </div>");
        builder.AppendLine($"    <div class=\"public-content-title\"><strong>{safeTitle}</strong><span>{subtitle}</span></div>");
        builder.AppendLine("  </header>");
        builder.AppendLine("  <main>");
        builder.AppendLine(PublicMainHtml(isDiagram, bodyHtml, attachments, blog));
        builder.AppendLine("  </main>");
        builder.AppendLine(PublicScriptHtml(context, isDiagram));
        builder.AppendLine("</body>");
        builder.AppendLine("</html>");
        return builder.ToString();
    }

    private static string PublicBlogSubtitle(BlogPostDto blog, bool isDiagram)
    {
        if (!isDiagram) return "Public Document";

        var wasUpdated = blog.UpdatedAt > blog.CreatedAt.AddSeconds(1);
        var date = wasUpdated ? blog.UpdatedAt : blog.CreatedAt;
        return $"{(wasUpdated ? "Last modified" : "Created")}: {PublicDateTime(date)}";
    }

    private static string PublicDateTime(DateTime value)
    {
        var local = value.Kind == DateTimeKind.Utc
            ? value.ToLocalTime()
            : DateTime.SpecifyKind(value, DateTimeKind.Utc).ToLocalTime();
        return local.ToString("M/d/yyyy h:mm tt");
    }

    private static string PublicCssLinksHtml(HttpContext context, bool isDiagram)
    {
        if (!isDiagram) return "";

        return string.Join(Environment.NewLine,
            $"  <link rel=\"stylesheet\" href=\"{HtmlAttr(PublicPath(context, "/css/tokens.css?v=20260620-token-depth"))}\">",
            $"  <link rel=\"stylesheet\" href=\"{HtmlAttr(PublicPath(context, "/css/themes.css?v=20260621-paper-links"))}\">",
            $"  <link rel=\"stylesheet\" href=\"{HtmlAttr(PublicPath(context, "/css/components/forms.css?v=20260725-public-link-dialog-v2"))}\">",
            "");
    }

    private static string PublicMainHtml(bool isDiagram, string bodyHtml, string attachments, BlogPostDto blog)
    {
        if (!isDiagram)
        {
            return string.Join(Environment.NewLine,
                "    <article class=\"public-content-body rich-readonly\">",
                $"      {bodyHtml}",
                $"      {attachments}",
                "    </article>");
        }

        var header = HtmlAttr($"Linked Diagram: {blog.Title}");
        return string.Join(Environment.NewLine,
            "    <section class=\"public-diagram-shell\">",
            $"      <figure class=\"pmt-diagram-ole\" contenteditable=\"false\" data-public-linked-diagram data-header=\"{header}\">",
            "        <template data-public-diagram-source>",
            $"          {bodyHtml}",
            "        </template>",
            "      </figure>",
            $"      {attachments}",
            "    </section>");
    }

    private static string PublicScriptHtml(HttpContext context, bool isDiagram)
    {
        if (!isDiagram) return "";

        return $"  <script src=\"{HtmlAttr(PublicPath(context, "/js/public-linked-diagram-viewer.js?v=20260725-day36-v2"))}\"></script>";
    }

    private static string PublicAttachmentsHtml(HttpContext context, IReadOnlyCollection<AttachmentDto> attachments)
    {
        if (attachments.Count == 0) return "";

        var links = string.Join("", attachments.Select(file =>
            $"<a href=\"{HtmlAttr(PublicPath(context, file.Url))}\" target=\"_blank\" rel=\"noopener\">{Html(file.FileName)}</a>"));
        return $"<div class=\"public-attachments\"><strong>Attachments</strong><div>{links}</div></div>";
    }

    private static string PublicBodyHtml(HttpContext context, string html)
    {
        var basePath = (context.Request.PathBase.Value ?? "").TrimEnd('/');
        if (string.IsNullOrEmpty(basePath)) return html;

        return html
            .Replace("src=\"/", $"src=\"{basePath}/", StringComparison.OrdinalIgnoreCase)
            .Replace("href=\"/", $"href=\"{basePath}/", StringComparison.OrdinalIgnoreCase)
            .Replace("src='/", $"src='{basePath}/", StringComparison.OrdinalIgnoreCase)
            .Replace("href='/", $"href='{basePath}/", StringComparison.OrdinalIgnoreCase);
    }

    private static string PublicPath(HttpContext context, string path)
    {
        if (string.IsNullOrWhiteSpace(path)) return "";
        if (Uri.TryCreate(path, UriKind.Absolute, out _)) return path;
        var basePath = (context.Request.PathBase.Value ?? "").TrimEnd('/');
        var normalizedPath = path.StartsWith('/') ? path : $"/{path}";
        return $"{basePath}{normalizedPath}";
    }

    private static string Html(string value) => WebUtility.HtmlEncode(value ?? "");

    private static string HtmlAttr(string value) => WebUtility.HtmlEncode(value ?? "");
}
