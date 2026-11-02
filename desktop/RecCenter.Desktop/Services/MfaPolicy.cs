namespace RecCenter.Desktop.Services;

/// <summary>Debug builds match the website development server. Release builds match production.</summary>
public static class MfaPolicy
{
#if DEBUG
    public const bool DevelopmentLogin = true;
#else
    public const bool DevelopmentLogin = false;
#endif

    public static bool ShouldOffer(bool isStaff, bool canEdit) =>
        DevelopmentLogin ? isStaff : canEdit;

    public static bool MustFinish(bool canEdit) => !DevelopmentLogin && canEdit;
}
