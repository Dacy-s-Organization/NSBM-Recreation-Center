using System.IO;

namespace RecCenter.Desktop.Services;

public static class AppPaths
{
    public const string AppFolderName = "NSBM Recreation Center";

    /// <summary>%AppData%\NSBM Recreation Center — roaming settings and the signed-in session.</summary>
    public static string RoamingDataDirectory => Ensure(Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), AppFolderName));

    /// <summary>%LocalAppData%\NSBM Recreation Center — machine-local caches such as WebView2 data.</summary>
    public static string LocalDataDirectory => Ensure(Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), AppFolderName));

    private static string Ensure(string path)
    {
        Directory.CreateDirectory(path);
        return path;
    }
}
