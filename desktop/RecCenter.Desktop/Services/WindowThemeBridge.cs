namespace RecCenter.Desktop.Services;

/// <summary>Carries the web UI's light/dark theme to the native WPF title bar.</summary>
public sealed class WindowThemeBridge
{
    public bool IsDark { get; private set; }

    public event Action<bool>? ThemeChanged;

    public WindowThemeBridge(bool initialIsDark) => IsDark = initialIsDark;

    public void Set(bool isDark)
    {
        if (isDark == IsDark) return;
        IsDark = isDark;
        ThemeChanged?.Invoke(isDark);
    }
}
