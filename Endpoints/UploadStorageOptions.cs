using Microsoft.Extensions.Configuration;

namespace PMT.Endpoints;

internal sealed class UploadStorageOptions
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
