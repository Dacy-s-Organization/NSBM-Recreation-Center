param(
  [Parameter(Mandatory = $true)]
  [string] $ImagePath
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
$OutputEncoding = [Console]::OutputEncoding

function Fail([string] $Message) {
  [Console]::Error.WriteLine($Message)
  exit 1
}

if (-not (Test-Path -LiteralPath $ImagePath)) {
  Fail "Windows could not open this image."
}

Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null
Add-Type -TypeDefinition @"
public static class TeamCardContrast {
  public static byte[] Stretch(byte[] bytes) {
    for (int i = 0; i < bytes.Length; i += 4) {
      int luminance = (bytes[i + 2] * 77 + bytes[i + 1] * 150 + bytes[i] * 29) >> 8;
      int stretched = (luminance - 100) * 255 / 70;
      if (stretched < 0) stretched = 0;
      if (stretched > 255) stretched = 255;
      bytes[i] = bytes[i + 1] = bytes[i + 2] = (byte)stretched;
    }
    return bytes;
  }
}
"@

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq "AsTask" -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq "IAsyncOperation``1"
})[0]

function Await($Operation, $ResultType) {
  $task = $asTaskGeneric.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
  $task.Wait() | Out-Null
  if ($task.IsFaulted) { throw $task.Exception.GetBaseException() }
  return $task.Result
}

[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.FileAccessMode, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapTransform, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine, Windows.Media.Ocr, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.Buffer, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.DataWriter, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.IBuffer, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
[Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime] | Out-Null

$language = New-Object Windows.Globalization.Language "en"
if (-not [Windows.Media.Ocr.OcrEngine]::IsLanguageSupported($language)) {
  Fail "English OCR language is not installed. Add English under Windows Settings, Time and language, then add Optical character recognition."
}

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($language)
if ($null -eq $engine) {
  Fail "English OCR language is not installed. Add English under Windows Settings, Time and language, then add Optical character recognition."
}

try {
  $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($ImagePath)) ([Windows.Storage.StorageFile])
  $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
} catch {
  Fail "Windows could not open this image. For an HEIC photo, install the HEIF Image Extensions from the Microsoft Store."
}

$width = [double]$decoder.PixelWidth
$height = [double]$decoder.PixelHeight
$longest = [Math]::Max($width, $height)
$max = [double][Windows.Media.Ocr.OcrEngine]::MaxImageDimension
$native = 1.0
if ($longest -gt $max) { $native = $max / $longest }
$boostedTarget = $max
if ($longest -le $max) { $boostedTarget = [Math]::Min($max, [Math]::Max($longest, 2400)) }
$boosted = 1.0
if ($longest -gt 0) { $boosted = $boostedTarget / $longest }

function Boost-Contrast($bitmap) {
  $converted = [Windows.Graphics.Imaging.SoftwareBitmap]::Convert(
    $bitmap,
    [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8,
    [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied)
  $size = [uint32]($converted.PixelWidth * $converted.PixelHeight * 4)
  $buffer = New-Object Windows.Storage.Streams.Buffer $size
  $buffer.Length = $size
  $converted.CopyToBuffer($buffer)
  $reader = [Windows.Storage.Streams.DataReader]::FromBuffer($buffer)
  $bytes = New-Object byte[] $size
  $reader.ReadBytes($bytes)
  $bytes = [TeamCardContrast]::Stretch($bytes)
  $ibuffer = [System.Runtime.InteropServices.WindowsRuntime.WindowsRuntimeBufferExtensions]::AsBuffer($bytes)
  return [Windows.Graphics.Imaging.SoftwareBitmap]::CreateCopyFromBuffer(
    $ibuffer,
    [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8,
    [int]$converted.PixelWidth,
    [int]$converted.PixelHeight)
}

function Read-Pass([double] $Scale, [bool] $Contrast) {
  $transform = New-Object Windows.Graphics.Imaging.BitmapTransform
  $transform.ScaledWidth = [uint32][Math]::Max(1, [Math]::Floor($width * $Scale))
  $transform.ScaledHeight = [uint32][Math]::Max(1, [Math]::Floor($height * $Scale))
  $bitmap = Await ($decoder.GetSoftwareBitmapAsync(
    [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8,
    [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied,
    $transform,
    [Windows.Graphics.Imaging.ExifOrientationMode]::RespectExifOrientation,
    [Windows.Graphics.Imaging.ColorManagementMode]::DoNotColorManage
  )) ([Windows.Graphics.Imaging.SoftwareBitmap])
  if ($Contrast) { $bitmap = Boost-Contrast $bitmap }
  $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
  $lines = New-Object System.Collections.Generic.List[object]
  foreach ($line in $result.Lines) {
    foreach ($word in $line.Words) {
      $rect = $word.BoundingRect
      $clean = [regex]::Replace($word.Text, '[\x00-\x1F]', '')
      if ($clean.Length -eq 0) { continue }
      $lines.Add([pscustomobject]@{
        text = $clean
        x = [double]$rect.X
        y = [double]$rect.Y
        width = [double]$rect.Width
        height = [double]$rect.Height
      })
    }
  }
  return ,($lines.ToArray())
}

function To-JsonArray($items) {
  if ($null -eq $items) { return "[]" }
  if ($items -is [System.Array]) {
    if ($items.Length -eq 0) { return "[]" }
    if ($items.Length -eq 1) { return "[" + (ConvertTo-Json -InputObject $items[0] -Compress -Depth 4) + "]" }
    return ConvertTo-Json -InputObject $items -Compress -Depth 4
  }
  return "[" + (ConvertTo-Json -InputObject $items -Compress -Depth 4) + "]"
}

try {
  $first = Read-Pass $native $false
  $second = $null
  $third = $null
  if ([Math]::Abs($boosted - $native) -gt 0.05) {
    $second = Read-Pass $boosted $false
    $third = Read-Pass $boosted $true
  }
} catch {
  Fail "Windows could not read this image."
}

$json = "{""passes"":[" + (To-JsonArray $first)
if ($null -ne $second) { $json += "," + (To-JsonArray $second) }
if ($null -ne $third) { $json += "," + (To-JsonArray $third) }
$json += "]}"
Write-Output $json

