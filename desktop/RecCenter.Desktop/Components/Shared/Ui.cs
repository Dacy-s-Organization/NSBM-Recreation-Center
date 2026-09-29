namespace RecCenter.Desktop.Components.Shared;

/// <summary>Shared Tailwind class lists, identical to the web app's components/ui primitives.</summary>
public static class Ui
{
    public const string Input =
        "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 dark:border-white/10 dark:bg-[var(--app-surface-2)] dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/20";

    public const string Select =
        "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 dark:border-white/10 dark:bg-[var(--app-surface-2)] dark:text-zinc-50 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/20";

    public const string Label = "mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300";

    public const string Card =
        "rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[var(--app-surface)] dark:shadow-none";

    public const string ButtonBase =
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50";

    public const string ButtonPrimary =
        "bg-emerald-600 text-white hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400";

    public const string ButtonSecondary =
        "border border-zinc-200 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10";

    public const string ButtonGhost =
        "bg-transparent text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white";

    public const string ButtonDanger =
        "bg-red-600 text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 dark:bg-red-500 dark:hover:bg-red-400";

    public const string ErrorBanner =
        "rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300";

    public const string ErrorText = "text-sm text-red-600 dark:text-red-300";

    public const string ModalPanel =
        "rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-white/10 dark:bg-[var(--app-surface)] dark:shadow-black/40";

    public const string TableHead = "border-b border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-white/5";

    public const string Th = "px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400";

    public static string Button(string variant) => variant switch
    {
        "secondary" => ButtonSecondary,
        "ghost" => ButtonGhost,
        "danger" => ButtonDanger,
        _ => ButtonPrimary,
    };

    public static string Cn(params string?[] classes) =>
        string.Join(" ", classes.Where(c => !string.IsNullOrWhiteSpace(c)));

    public static (string Bg, string Text, string Border) HouseStyle(string name) => name switch
    {
        "Ruby" => ("bg-red-100 dark:bg-red-950/60", "text-red-800 dark:text-red-300", "border-red-200 dark:border-red-800"),
        "Citrine" => ("bg-amber-100 dark:bg-amber-950/60", "text-amber-800 dark:text-amber-300", "border-amber-200 dark:border-amber-800"),
        "Emerald" => ("bg-emerald-100 dark:bg-emerald-950/60", "text-emerald-800 dark:text-emerald-300", "border-emerald-200 dark:border-emerald-800"),
        "Sapphire" => ("bg-blue-100 dark:bg-blue-950/60", "text-blue-800 dark:text-blue-300", "border-blue-200 dark:border-blue-800"),
        _ => ("bg-zinc-100 dark:bg-zinc-800", "text-zinc-800 dark:text-zinc-200", "border-zinc-200 dark:border-zinc-700"),
    };

    public static string FormatDate(DateTimeOffset value) =>
        value.ToLocalTime().ToString("d", System.Globalization.CultureInfo.CurrentCulture);

    public static string FormatDateTime(DateTimeOffset value)
    {
        var local = value.ToLocalTime();
        var culture = System.Globalization.CultureInfo.CurrentCulture;
        return $"{local.ToString("d", culture)}, {local.ToString("T", culture)}";
    }
}
