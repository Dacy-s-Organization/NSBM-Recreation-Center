using Microsoft.AspNetCore.Components.WebView.Wpf;
using Microsoft.Extensions.FileProviders;

namespace RecCenter.Desktop;

/// <summary>BlazorWebView that serves wwwroot from embedded resources, so the single-file exe needs no loose files.</summary>
public sealed class EmbeddedBlazorWebView : BlazorWebView
{
    public override IFileProvider CreateFileProvider(string contentRootDir) =>
        new ManifestEmbeddedFileProvider(typeof(EmbeddedBlazorWebView).Assembly, "wwwroot");
}
