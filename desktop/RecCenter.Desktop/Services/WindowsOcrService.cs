using RecCenter.Core.TeamCards;
using Windows.Globalization;
using Windows.Graphics.Imaging;
using Windows.Storage;
using WinOcr = Windows.Media.Ocr;

namespace RecCenter.Desktop.Ocr;

public sealed class WindowsOcrService : IOcrService
{
    public Task<IReadOnlyList<IReadOnlyList<OcrWord>>> RecognizePassesAsync(string imagePath) => ReadPassesAsync(imagePath);

    private async Task<IReadOnlyList<IReadOnlyList<OcrWord>>> ReadPassesAsync(string imagePath)
    {
        var language = new Language("en");
        if (!WinOcr.OcrEngine.IsLanguageSupported(language))
            throw new InvalidOperationException("English OCR language is not installed. Add English under Windows Settings, Time and language, then add Optical character recognition.");

        var engine = WinOcr.OcrEngine.TryCreateFromLanguage(language)
            ?? throw new InvalidOperationException("English OCR language is not installed. Add English under Windows Settings, Time and language, then add Optical character recognition.");

        StorageFile file;
        BitmapDecoder decoder;
        try
        {
            file = await StorageFile.GetFileFromPathAsync(imagePath);
            var stream = await file.OpenAsync(FileAccessMode.Read);
            decoder = await BitmapDecoder.CreateAsync(stream);
        }
        catch (Exception ex) when (ex is not InvalidOperationException)
        {
            throw new InvalidOperationException("Windows could not open this image. For an HEIC photo, install the HEIF Image Extensions from the Microsoft Store.", ex);
        }

        var width = (double)decoder.PixelWidth;
        var height = (double)decoder.PixelHeight;
        var longest = Math.Max(width, height);
        var max = (double)WinOcr.OcrEngine.MaxImageDimension;
        var native = longest > max ? max / longest : 1d;
        var boostedTarget = longest > max ? max : Math.Min(max, Math.Max(longest, 2400));
        var boosted = longest > 0 ? boostedTarget / longest : 1d;
        var passes = new List<IReadOnlyList<OcrWord>> { await ReadAsync(decoder, engine, width, height, native, 0) };
        if (Math.Abs(boosted - native) > 0.05)
        {
            passes.Add(await ReadAsync(decoder, engine, width, height, boosted, 0));
            passes.Add(await ReadAsync(decoder, engine, width, height, boosted, 1));
        }
        return passes;
    }

    private static async Task<IReadOnlyList<OcrWord>> ReadAsync(BitmapDecoder decoder, WinOcr.OcrEngine engine, double width, double height, double scale, int contrast)
    {
        var transform = new BitmapTransform
        {
            ScaledWidth = (uint)Math.Max(1, Math.Floor(width * scale)),
            ScaledHeight = (uint)Math.Max(1, Math.Floor(height * scale)),
        };

        SoftwareBitmap bitmap;
        WinOcr.OcrResult result;
        try
        {
            bitmap = await decoder.GetSoftwareBitmapAsync(
                BitmapPixelFormat.Bgra8,
                BitmapAlphaMode.Premultiplied,
                transform,
                ExifOrientationMode.RespectExifOrientation,
                ColorManagementMode.DoNotColorManage);
            if (contrast > 0) bitmap = BoostContrast(bitmap);
            result = await engine.RecognizeAsync(bitmap);
        }
        catch (Exception ex) when (ex is not InvalidOperationException)
        {
            throw new InvalidOperationException("Windows could not read this image.", ex);
        }

        var words = new List<OcrWord>();
        foreach (var line in result.Lines)
        {
            foreach (var word in line.Words)
            {
                var rect = word.BoundingRect;
                var text = new string(word.Text.Where(ch => !char.IsControl(ch)).ToArray());
                if (text.Length == 0) continue;
                words.Add(new OcrWord(text, rect.X, rect.Y, rect.Width, rect.Height));
            }
        }
        return words;
    }

    private static SoftwareBitmap BoostContrast(SoftwareBitmap source)
    {
        var converted = SoftwareBitmap.Convert(source, BitmapPixelFormat.Bgra8, BitmapAlphaMode.Premultiplied);
        var size = (uint)(converted.PixelWidth * converted.PixelHeight * 4);
        var buffer = new Windows.Storage.Streams.Buffer(size) { Length = size };
        converted.CopyToBuffer(buffer);
        var reader = Windows.Storage.Streams.DataReader.FromBuffer(buffer);
        var bytes = new byte[size];
        reader.ReadBytes(bytes);
        for (var i = 0; i < bytes.Length; i += 4)
        {
            var luminance = (bytes[i + 2] * 77 + bytes[i + 1] * 150 + bytes[i] * 29) >> 8;
            var stretched = (luminance - 100) * 255 / 70;
            if (stretched < 0) stretched = 0;
            if (stretched > 255) stretched = 255;
            bytes[i] = bytes[i + 1] = bytes[i + 2] = (byte)stretched;
        }
        var writer = new Windows.Storage.Streams.DataWriter();
        writer.WriteBytes(bytes);
        return SoftwareBitmap.CreateCopyFromBuffer(writer.DetachBuffer(), BitmapPixelFormat.Bgra8, converted.PixelWidth, converted.PixelHeight);
    }
}
