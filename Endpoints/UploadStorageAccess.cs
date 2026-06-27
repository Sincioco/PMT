using System.ComponentModel;
using System.Runtime.InteropServices;

namespace PMT.Endpoints;

internal static class UploadStorageAccess
{
    public static IDisposable Connect(UploadStorageOptions options)
    {
        if (!options.HasCredentials)
        {
            return NoopConnection.Instance;
        }

        return new NetworkShareConnection(options.RootPath, options.UserName, options.Password);
    }

    private static string ShareRootFor(string rootPath)
    {
        var normalizedPath = rootPath.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        if (!normalizedPath.StartsWith(@"\\", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("UploadStorage:RootPath must be a UNC path like \\\\fileserver\\share\\folder when UploadStorage:UserName and UploadStorage:Password are supplied.");
        }

        var parts = normalizedPath.Substring(2).Split(new[] { '\\', '/' }, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length < 2)
        {
            throw new InvalidOperationException("UploadStorage:RootPath must include a server and share when UploadStorage credentials are supplied.");
        }

        return $@"\\{parts[0]}\{parts[1]}";
    }

    private sealed class NetworkShareConnection : IDisposable
    {
        private readonly string _remoteName;
        private bool _connected;

        public NetworkShareConnection(string rootPath, string userName, string password)
        {
            if (!OperatingSystem.IsWindows())
            {
                throw new InvalidOperationException("UploadStorage fileshare credentials require Windows because they use Windows network-share authentication.");
            }

            _remoteName = ShareRootFor(rootPath);
            var resource = new NetResource
            {
                Type = ResourceTypeDisk,
                RemoteName = _remoteName
            };

            var result = WNetAddConnection2(ref resource, password, userName, 0);
            if (result == 0)
            {
                _connected = true;
                return;
            }

            if (result == ErrorSessionCredentialConflict)
            {
                throw new InvalidOperationException($"Could not connect to upload fileshare '{_remoteName}' because Windows already has a connection to it with different credentials.");
            }

            throw new InvalidOperationException($"Could not connect to upload fileshare '{_remoteName}'. Windows error {result}: {new Win32Exception(result).Message}");
        }

        public void Dispose()
        {
            if (!_connected)
            {
                return;
            }

            WNetCancelConnection2(_remoteName, 0, true);
            _connected = false;
        }
    }

    private sealed class NoopConnection : IDisposable
    {
        public static readonly NoopConnection Instance = new();

        public void Dispose()
        {
        }
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct NetResource
    {
        public int Scope;
        public int Type;
        public int DisplayType;
        public int Usage;
        public string? LocalName;
        public string? RemoteName;
        public string? Comment;
        public string? Provider;
    }

    private const int ResourceTypeDisk = 1;
    private const int ErrorSessionCredentialConflict = 1219;

    [DllImport("mpr.dll", CharSet = CharSet.Unicode)]
    private static extern int WNetAddConnection2(ref NetResource netResource, string? password, string? userName, int flags);

    [DllImport("mpr.dll", CharSet = CharSet.Unicode)]
    private static extern int WNetCancelConnection2(string name, int flags, bool force);
}
