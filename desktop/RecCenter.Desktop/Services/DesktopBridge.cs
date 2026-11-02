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
                FileName = SafeFileName(suggestedName),
                DefaultExt = ".csv",
                Filter = "CSV files (*.csv)|*.csv|All files (*.*)|*.*",
            };
            if (dialog.ShowDialog(Application.Current.MainWindow) != true) return false;
            File.WriteAllText(dialog.FileName, content, new UTF8Encoding(false));
            return true;
        });
    }

    /// <returns>True when the user saved the file.</returns>
    public bool SaveBinaryFile(string suggestedName, byte[] content)
    {
        return Application.Current.Dispatcher.Invoke(() =>
        {
            var extension = Path.GetExtension(SafeFileName(suggestedName));
            var dialog = new SaveFileDialog
            {
                FileName = SafeFileName(suggestedName),
                DefaultExt = extension,
                Filter = string.IsNullOrEmpty(extension)
                    ? "All files (*.*)|*.*"
                    : $"{extension.TrimStart('.').ToUpperInvariant()} files (*{extension})|*{extension}|All files (*.*)|*.*",
            };
            if (dialog.ShowDialog(Application.Current.MainWindow) != true) return false;
            File.WriteAllBytes(dialog.FileName, content);
            return true;
        });
    }

    private static string SafeFileName(string suggestedName)
    {
        var name = Path.GetFileName(suggestedName);
        foreach (var invalid in Path.GetInvalidFileNameChars())
            name = name.Replace(invalid, '_');
        return string.IsNullOrWhiteSpace(name) ? "download" : name;
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
