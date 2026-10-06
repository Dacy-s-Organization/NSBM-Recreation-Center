using System.IO;
using System.Net.Http;
using System.Windows;
using Microsoft.Extensions.DependencyInjection;
using RecCenter.Core.Config;
using RecCenter.Core.Services;
using RecCenter.Core.Supabase;
using RecCenter.Core.TeamCards;
using RecCenter.Desktop.Ocr;
using RecCenter.Desktop.Services;

namespace RecCenter.Desktop;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        DispatcherUnhandledException += (_, args) =>
        {
            if (ConnectionState.IsConnectionFailure(args.Exception))
            {
                LogCrash(args.Exception);
                args.Handled = true;
                return;
            }

            ReportCrash(args.Exception);
            args.Handled = true;
            Shutdown(1);
        };
        AppDomain.CurrentDomain.UnhandledException += (_, args) =>
        {
            if (args.ExceptionObject is not Exception ex) return;
            if (ConnectionState.IsConnectionFailure(ex))
            {
                LogCrash(ex);
                return;
            }
            ReportCrash(ex);
        };

        var options = ConfigLoader.LoadSupabaseOptions();
        var windowSettings = WindowSettings.Load();
        var themeBridge = new WindowThemeBridge(windowSettings.IsDark ?? SystemPrefersDark());

        var services = new ServiceCollection();
        services.AddWpfBlazorWebView();
#if DEBUG
        services.AddBlazorWebViewDeveloperTools();
#endif
        services.AddSingleton(options);
        services.AddSingleton(new HttpClient { Timeout = TimeSpan.FromSeconds(60) });
        services.AddSingleton<ConnectionState>();
        services.AddSingleton<ISessionStore, ProtectedSessionStore>();
        services.AddSingleton<AuthService>();
        services.AddSingleton<PostgrestClient>();
        services.AddSingleton<ReferenceService>();
        services.AddSingleton<DashboardService>();
        services.AddSingleton<StudentsService>();
        services.AddSingleton<CertificateService>();
        services.AddSingleton<RecordsService>();
        services.AddSingleton<TracksService>();
        services.AddSingleton<AchievementsService>();
        services.AddSingleton<InventoryService>();
        services.AddSingleton<ImportService>();
        services.AddSingleton<TeamCardsService>();
        services.AddSingleton<IOcrService, WindowsOcrService>();
        services.AddSingleton<AppState>();
        services.AddSingleton<DesktopBridge>();
        services.AddSingleton(themeBridge);

        var window = new MainWindow(services.BuildServiceProvider(), windowSettings, themeBridge);
        window.Show();
    }

    private static bool SystemPrefersDark()
    {
        try
        {
            using var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize");
            return key?.GetValue("AppsUseLightTheme") is int light && light == 0;
        }
        catch (System.Security.SecurityException)
        {
            return false;
        }
    }

    private static void LogCrash(Exception ex)
    {
        var path = Path.Combine(AppPaths.LocalDataDirectory, "crash.log");
        try
        {
            Directory.CreateDirectory(AppPaths.LocalDataDirectory);
            File.AppendAllText(path, $"[{DateTime.Now:O}] {ex}{Environment.NewLine}{Environment.NewLine}");
        }
        catch
        {
        }
    }

    private static void ReportCrash(Exception ex)
    {
        LogCrash(ex);
        var path = Path.Combine(AppPaths.LocalDataDirectory, "crash.log");
        MessageBox.Show($"NSBM Recreation Center hit an unexpected error and needs to close.\n\n{ex.Message}\n\nDetails were saved to:\n{path}",
            "NSBM Recreation Center", MessageBoxButton.OK, MessageBoxImage.Error);
    }
}
