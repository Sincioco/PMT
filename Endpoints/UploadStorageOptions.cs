using Microsoft.Extensions.Configuration;

namespace PMT.Endpoints;

internal sealed class UploadStorageOptions
{
    public string RootPath { get; init; } = "";
    public string RequestPath { get; init; } = "/uploads";
    public string UserName { get; init; } = "";
    public string Password { get; init; } = "";

    public bool HasCredentials => !string.IsNullOrWhiteSpace(UserName) && !string.IsNullOrWhiteSpace(Password);

    public static UploadStorageOptions From(IConfiguration configuration, string contentRootPath)
    {
        var rootPath = configuration["UploadStorage:RootPath"];
        if (string.IsNullOrWhiteSpace(rootPath))
        {
            rootPath = Path.Combine(contentRootPath, "UploadedFiles");
        }

        var requestPath = RequestPathFrom(configuration);

        var userName = configuration["UploadStorage:UserName"];
        if (string.IsNullOrWhiteSpace(userName))
        {
            userName = configuration["UploadStorage:Username"];
        }

        var password = configuration["UploadStorage:Password"];
        var hasUserName = !string.IsNullOrWhiteSpace(userName);
        var hasPassword = !string.IsNullOrWhiteSpace(password);
        if (hasUserName != hasPassword)
        {
            throw new InvalidOperationException("UploadStorage:UserName and UploadStorage:Password must both be supplied or both be left blank.");
        }

        return new UploadStorageOptions
        {
            RootPath = Path.GetFullPath(rootPath),
            RequestPath = requestPath,
            UserName = userName?.Trim() ?? "",
            Password = password ?? ""
        };
    }

    public static string RequestPathFrom(IConfiguration configuration)
    {
        var requestPath = configuration["UploadStorage:RequestPath"];
        if (string.IsNullOrWhiteSpace(requestPath))
        {
            return "/uploads";
        }

        requestPath = requestPath.TrimEnd('/');
        if (requestPath.Length == 0)
        {
            return "/";
        }

        return requestPath.StartsWith('/') ? requestPath : "/" + requestPath;
    }
}
