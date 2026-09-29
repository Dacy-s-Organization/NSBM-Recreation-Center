using System.IO;
using System.Text;
using System.Windows;
using Microsoft.Win32;

namespace RecCenter.Desktop.Services;

/// <summary>Native Windows features used by the Blazor UI (save dialog, clipboard).</summary>
public sealed class DesktopBridge
{
    /// <returns>True when the user saved the file.</returns>
    public bool SaveTextFile(string suggestedName, string content)
    {
        return Application.Current.Dispatcher.Invoke(() =>
        {
            var dialog = new SaveFileDialog
            {
                FileName = suggestedName,
                DefaultExt = ".csv",
                Filter = "CSV files (*.csv)|*.csv|All files (*.*)|*.*",
            };
            if (dialog.ShowDialog(Application.Current.MainWindow) != true) return false;
            File.WriteAllText(dialog.FileName, content, new UTF8Encoding(false));
            return true;
        });
    }

    public bool CopyText(string text)
    {
        return Application.Current.Dispatcher.Invoke(() =>
        {
            try
            {
                Clipboard.SetText(text);
                return true;
            }
            catch (System.Runtime.InteropServices.ExternalException)
            {
                return false;
            }
        });
    }
}
