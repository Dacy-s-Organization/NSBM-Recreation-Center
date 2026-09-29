using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
using Microsoft.AspNetCore.Components.WebView;
using RecCenter.Desktop.Services;

namespace RecCenter.Desktop;

public partial class MainWindow : Window
{
    private const double PreferredWidth = 1440;
    private const double PreferredHeight = 900;
    private const double PreferredMinWidth = 960;
    private const double PreferredMinHeight = 600;

    private readonly WindowSettings _settings;
    private readonly WindowThemeBridge _theme;
    private bool _maxButtonHot;
    private bool _maxButtonPressed;

    public MainWindow(IServiceProvider services, WindowSettings settings, WindowThemeBridge theme)
    {
        _settings = settings;
        _theme = theme;
        InitializeComponent();

        BlazorView.Services = services;
        BlazorView.BlazorWebViewInitializing += OnInitializing;

        ApplyTheme();
        _theme.ThemeChanged += OnThemeChanged;
        Activated += (_, _) => ApplyTheme();
        Deactivated += (_, _) => ApplyTheme();
        StateChanged += (_, _) => UpdateMaximizeState();

        ApplyInitialBounds();
        UpdateMaximizeState();
    }

    private static void OnInitializing(object? sender, BlazorWebViewInitializingEventArgs e)
    {
        // Keep WebView2 data (theme preference, cache) in a per-user folder so the exe can live anywhere.
        e.UserDataFolder = Path.Combine(AppPaths.LocalDataDirectory, "WebView2");
#if DEBUG
        var extraArgs = Environment.GetEnvironmentVariable("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS");
        if (!string.IsNullOrWhiteSpace(extraArgs))
            e.EnvironmentOptions = new Microsoft.Web.WebView2.Core.CoreWebView2EnvironmentOptions(extraArgs);
#endif
    }

    // ---- Theme ----

    private void OnThemeChanged(bool isDark)
    {
        Dispatcher.InvokeAsync(() =>
        {
            ApplyTheme();
            _settings.IsDark = isDark;
            _settings.Save();
        });
    }

    private void ApplyTheme()
    {
        var dark = _theme.IsDark;
        var active = IsActive;

        SetBrush("WindowBackgroundBrush", dark ? "#0F1A14" : "#F3F5EC");
        SetBrush("WindowBorderBrush", dark ? "#1AFFFFFF" : "#E4E4E7");
        SetBrush("TitleBarBrush", dark ? "#16241C" : "#FFFFFF");
        SetBrush("TitleTextBrush", (dark, active) switch
        {
            (true, true) => "#E8F0E3",
            (true, false) => "#7F8F84",
            (false, true) => "#14261A",
            (false, false) => "#8A948C",
        });
        SetBrush("TitleButtonHoverBrush", dark ? "#14FFFFFF" : "#0F000000");
        SetBrush("TitleButtonPressedBrush", dark ? "#24FFFFFF" : "#1F000000");
        UpdateMaximizeButtonVisual();
    }

    private void SetBrush(string key, string hex)
    {
        var brush = new SolidColorBrush((Color)ColorConverter.ConvertFromString(hex));
        brush.Freeze();
        Resources[key] = brush;
    }

    // ---- Caption buttons ----

    private void OnMinimize(object sender, RoutedEventArgs e) => SystemCommands.MinimizeWindow(this);

    private void OnMaximizeRestore(object sender, RoutedEventArgs e) => ToggleMaximize();

    private void OnClose(object sender, RoutedEventArgs e) => SystemCommands.CloseWindow(this);

    private void ToggleMaximize()
    {
        if (WindowState == WindowState.Maximized) SystemCommands.RestoreWindow(this);
        else SystemCommands.MaximizeWindow(this);
    }

    private void UpdateMaximizeState()
    {
        var maximized = WindowState == WindowState.Maximized;
        MaximizeButton.Content = maximized ? "\uE923" : "\uE922";
        MaximizeButton.ToolTip = maximized ? "Restore" : "Maximize";
        System.Windows.Automation.AutomationProperties.SetName(MaximizeButton, maximized ? "Restore" : "Maximize");
        // WM_GETMINMAXINFO keeps the maximized window inside the work area, so the 1px frame is only needed when restored.
        BorderThickness = maximized ? new Thickness(0) : new Thickness(1);
    }

    private void UpdateMaximizeButtonVisual()
    {
        if (_maxButtonPressed) MaximizeButton.Background = (Brush)Resources["TitleButtonPressedBrush"];
        else if (_maxButtonHot) MaximizeButton.Background = (Brush)Resources["TitleButtonHoverBrush"];
        else MaximizeButton.ClearValue(BackgroundProperty);
    }

    // ---- Bounds ----

    private void ApplyInitialBounds()
    {
        var monitors = NativeMonitors.All();
        var saved = SavedBounds();

        NativeMonitors.Monitor target;
        Rect bounds;
        if (saved is { } rect && monitors.FirstOrDefault(m => Overlap(m.WorkArea, rect) >= 100) is { } savedMonitor)
        {
            target = savedMonitor;
            bounds = rect;
        }
        else
        {
            target = NativeMonitors.UnderCursor(monitors);
            var work = target.WorkArea;
            var width = Math.Min(PreferredWidth, work.Width * 0.9);
            var height = Math.Min(PreferredHeight, work.Height * 0.9);
            bounds = new Rect(work.Left + (work.Width - width) / 2, work.Top + (work.Height - height) / 2, width, height);
        }

        MinWidth = Math.Min(PreferredMinWidth, Math.Floor(target.WorkArea.Width * 0.95));
        MinHeight = Math.Min(PreferredMinHeight, Math.Floor(target.WorkArea.Height * 0.95));

        Left = bounds.Left;
        Top = bounds.Top;
        Width = Math.Max(MinWidth, Math.Min(bounds.Width, target.WorkArea.Width));
        Height = Math.Max(MinHeight, Math.Min(bounds.Height, target.WorkArea.Height));
        if (_settings.Maximized) WindowState = WindowState.Maximized;
    }

    private Rect? SavedBounds()
    {
        if (_settings is { Left: { } l, Top: { } t, Width: { } w, Height: { } h } && w > 0 && h > 0)
            return new Rect(l, t, w, h);
        return null;
    }

    /// <summary>Smaller side of the intersection, so a sliver along one edge doesn't count as visible.</summary>
    private static double Overlap(Rect a, Rect b)
    {
        var i = Rect.Intersect(a, b);
        return i.IsEmpty ? 0 : Math.Min(i.Width, i.Height);
    }

    protected override void OnClosing(System.ComponentModel.CancelEventArgs e)
    {
        var restore = WindowState == WindowState.Normal ? new Rect(Left, Top, Width, Height) : RestoreBounds;
        if (!restore.IsEmpty)
        {
            _settings.Left = restore.Left;
            _settings.Top = restore.Top;
            _settings.Width = restore.Width;
            _settings.Height = restore.Height;
        }
        _settings.Maximized = WindowState == WindowState.Maximized;
        _settings.IsDark = _theme.IsDark;
        _settings.Save();
        base.OnClosing(e);
    }

    // ---- Native window messages ----

    protected override void OnSourceInitialized(EventArgs e)
    {
        base.OnSourceInitialized(e);
        HwndSource.FromHwnd(new WindowInteropHelper(this).Handle)?.AddHook(WndProc);
    }

    private IntPtr WndProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        switch (msg)
        {
            case Native.WM_GETMINMAXINFO:
                FitMaximizedToWorkArea(hwnd, lParam);
                break;

            case Native.WM_NCHITTEST:
                if (IsOverMaximizeButton(lParam))
                {
                    handled = true;
                    return new IntPtr(Native.HTMAXBUTTON);
                }
                if (_maxButtonHot) SetMaxButtonHot(false);
                break;

            case Native.WM_NCMOUSEMOVE:
                if (wParam.ToInt32() == Native.HTMAXBUTTON)
                {
                    if (!_maxButtonHot)
                    {
                        SetMaxButtonHot(true);
                        Native.TrackNonClientLeave(hwnd);
                    }
                }
                else if (_maxButtonHot)
                {
                    SetMaxButtonHot(false);
                }
                break;

            case Native.WM_NCMOUSELEAVE:
            case Native.WM_MOUSEMOVE:
                if (_maxButtonHot || _maxButtonPressed)
                {
                    _maxButtonPressed = false;
                    SetMaxButtonHot(false);
                }
                break;

            case Native.WM_NCLBUTTONDOWN:
            case Native.WM_NCLBUTTONDBLCLK:
                if (wParam.ToInt32() == Native.HTMAXBUTTON)
                {
                    _maxButtonPressed = true;
                    UpdateMaximizeButtonVisual();
                    handled = true;
                }
                break;

            case Native.WM_NCLBUTTONUP:
                if (wParam.ToInt32() == Native.HTMAXBUTTON)
                {
                    var wasPressed = _maxButtonPressed;
                    _maxButtonPressed = false;
                    UpdateMaximizeButtonVisual();
                    handled = true;
                    if (wasPressed) ToggleMaximize();
                }
                break;
        }
        return IntPtr.Zero;
    }

    private void SetMaxButtonHot(bool hot)
    {
        _maxButtonHot = hot;
        UpdateMaximizeButtonVisual();
    }

    private bool IsOverMaximizeButton(IntPtr lParam)
    {
        if (!MaximizeButton.IsVisible) return false;
        var x = (short)(lParam.ToInt64() & 0xFFFF);
        var y = (short)((lParam.ToInt64() >> 16) & 0xFFFF);
        var topLeft = MaximizeButton.PointToScreen(new Point(0, 0));
        var bottomRight = MaximizeButton.PointToScreen(new Point(MaximizeButton.ActualWidth, MaximizeButton.ActualHeight));
        return x >= topLeft.X && x < bottomRight.X && y >= topLeft.Y && y < bottomRight.Y;
    }

    /// <summary>Maximize to the monitor's work area (respecting the taskbar) instead of overhanging the screen edges.</summary>
    private static void FitMaximizedToWorkArea(IntPtr hwnd, IntPtr lParam)
    {
        var monitor = Native.MonitorFromWindow(hwnd, Native.MONITOR_DEFAULTTONEAREST);
        if (monitor == IntPtr.Zero) return;
        var info = new Native.MONITORINFO { cbSize = Marshal.SizeOf<Native.MONITORINFO>() };
        if (!Native.GetMonitorInfo(monitor, ref info)) return;

        var mmi = Marshal.PtrToStructure<Native.MINMAXINFO>(lParam);
        var work = info.rcWork;
        var full = info.rcMonitor;
        mmi.ptMaxPosition.X = work.Left - full.Left;
        mmi.ptMaxPosition.Y = work.Top - full.Top;
        mmi.ptMaxSize.X = work.Right - work.Left;
        mmi.ptMaxSize.Y = work.Bottom - work.Top;
        // An auto-hide taskbar needs a sliver of screen edge to stay reachable.
        if (Native.IsTaskbarAutoHide() && work.Bottom == full.Bottom) mmi.ptMaxSize.Y -= 2;
        Marshal.StructureToPtr(mmi, lParam, true);
    }
}

internal static class NativeMonitors
{
    public sealed record Monitor(Rect WorkArea, IntPtr Handle);

    /// <summary>All monitors with work areas in device-independent units (96 DPI = 1.0).</summary>
    public static List<Monitor> All()
    {
        var list = new List<Monitor>();
        Native.EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, (handle, _, _, _) =>
        {
            var info = new Native.MONITORINFO { cbSize = Marshal.SizeOf<Native.MONITORINFO>() };
            if (Native.GetMonitorInfo(handle, ref info)) list.Add(new Monitor(ToDips(handle, info.rcWork), handle));
            return true;
        }, IntPtr.Zero);
        if (list.Count == 0) list.Add(new Monitor(SystemParameters.WorkArea, IntPtr.Zero));
        return list;
    }

    public static Monitor UnderCursor(List<Monitor> monitors)
    {
        if (Native.GetCursorPos(out var pt))
        {
            var handle = Native.MonitorFromPoint(pt, Native.MONITOR_DEFAULTTONEAREST);
            var match = monitors.FirstOrDefault(m => m.Handle == handle);
            if (match is not null) return match;
        }
        return monitors[0];
    }

    private static Rect ToDips(IntPtr monitor, Native.RECT r)
    {
        var scale = 1.0;
        try
        {
            if (Native.GetDpiForMonitor(monitor, 0, out var dpiX, out _) == 0 && dpiX > 0) scale = dpiX / 96.0;
        }
        catch (DllNotFoundException)
        {
        }
        catch (EntryPointNotFoundException)
        {
        }
        return new Rect(r.Left / scale, r.Top / scale, (r.Right - r.Left) / scale, (r.Bottom - r.Top) / scale);
    }
}

internal static class Native
{
    public const int WM_GETMINMAXINFO = 0x0024;
    public const int WM_NCHITTEST = 0x0084;
    public const int WM_NCMOUSEMOVE = 0x00A0;
    public const int WM_NCLBUTTONDOWN = 0x00A1;
    public const int WM_NCLBUTTONUP = 0x00A2;
    public const int WM_NCLBUTTONDBLCLK = 0x00A3;
    public const int WM_NCMOUSELEAVE = 0x02A2;
    public const int WM_MOUSEMOVE = 0x0200;
    public const int HTMAXBUTTON = 9;
    public const uint MONITOR_DEFAULTTONEAREST = 2;

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT { public int X, Y; }

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    [StructLayout(LayoutKind.Sequential)]
    public struct MINMAXINFO
    {
        public POINT ptReserved;
        public POINT ptMaxSize;
        public POINT ptMaxPosition;
        public POINT ptMinTrackSize;
        public POINT ptMaxTrackSize;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MONITORINFO
    {
        public int cbSize;
        public RECT rcMonitor;
        public RECT rcWork;
        public uint dwFlags;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct TRACKMOUSEEVENT
    {
        public int cbSize;
        public uint dwFlags;
        public IntPtr hwndTrack;
        public uint dwHoverTime;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct APPBARDATA
    {
        public int cbSize;
        public IntPtr hWnd;
        public uint uCallbackMessage;
        public uint uEdge;
        public RECT rc;
        public IntPtr lParam;
    }

    public delegate bool MonitorEnumProc(IntPtr hMonitor, IntPtr hdc, IntPtr lprcMonitor, IntPtr dwData);

    [DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint flags);
    [DllImport("user32.dll")] public static extern IntPtr MonitorFromPoint(POINT pt, uint flags);
    [DllImport("user32.dll")] public static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO info);
    [DllImport("user32.dll")] public static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr clip, MonitorEnumProc proc, IntPtr data);
    [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT pt);
    [DllImport("user32.dll")] private static extern bool TrackMouseEvent(ref TRACKMOUSEEVENT e);
    [DllImport("shcore.dll")] public static extern int GetDpiForMonitor(IntPtr hmonitor, int dpiType, out uint dpiX, out uint dpiY);
    [DllImport("shell32.dll")] private static extern IntPtr SHAppBarMessage(uint msg, ref APPBARDATA data);

    public static void TrackNonClientLeave(IntPtr hwnd)
    {
        const uint TME_LEAVE = 0x2, TME_NONCLIENT = 0x10;
        var e = new TRACKMOUSEEVENT { cbSize = Marshal.SizeOf<TRACKMOUSEEVENT>(), dwFlags = TME_LEAVE | TME_NONCLIENT, hwndTrack = hwnd };
        TrackMouseEvent(ref e);
    }

    public static bool IsTaskbarAutoHide()
    {
        const uint ABM_GETSTATE = 0x4, ABS_AUTOHIDE = 0x1;
        var data = new APPBARDATA { cbSize = Marshal.SizeOf<APPBARDATA>() };
        return ((long)SHAppBarMessage(ABM_GETSTATE, ref data) & ABS_AUTOHIDE) != 0;
    }
}
