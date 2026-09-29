namespace RecCenter.Desktop.Services;

/// <summary>App-wide events: the nav's Refresh button asks the current page to reload from Supabase.</summary>
public sealed class AppState
{
    public event Func<Task>? RefreshRequested;

    public async Task RequestRefreshAsync()
    {
        var handlers = RefreshRequested;
        if (handlers is null) return;
        foreach (var handler in handlers.GetInvocationList().Cast<Func<Task>>())
        {
            await handler();
        }
    }
}
