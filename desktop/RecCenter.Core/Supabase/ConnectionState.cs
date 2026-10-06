using System.Net.Sockets;

namespace RecCenter.Core.Supabase;

/// <summary>
/// Whether the last attempt to reach Supabase failed before a response arrived.
/// A later response clears the flag. The desktop shell listens to <see cref="Changed"/>.
/// </summary>
public sealed class ConnectionState
{
    public const string SignInMessage = "Connect to the internet to sign in.";
    public const string SessionMessage = "No internet connection. Reconnect to continue.";

    public bool Offline { get; private set; }

    public event Action? Changed;

    public void ReportOffline()
    {
        if (Offline) return;
        Offline = true;
        Changed?.Invoke();
    }

    public void ReportOnline()
    {
        if (!Offline) return;
        Offline = false;
        Changed?.Invoke();
    }

    /// <summary>
    /// True when the failure is a lost connection or a timeout, including when it is wrapped
    /// by the dispatcher or by <see cref="PostgrestException"/>.
    /// </summary>
    public static bool IsConnectionFailure(Exception? error)
    {
        if (error is null) return false;
        if (error.Message is SignInMessage or SessionMessage) return true;
        if (error is HttpRequestException or SocketException or TaskCanceledException or TimeoutException)
            return true;
        if (error is AggregateException aggregate && aggregate.InnerExceptions.Any(IsConnectionFailure))
            return true;
        return IsConnectionFailure(error.InnerException);
    }
}
