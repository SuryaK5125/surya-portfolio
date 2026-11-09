# Converts between JPEG and PNG with .NET's System.Drawing (Windows).
# Usage: powershell -File convert-image.ps1 <input> <output.(png|jpg)> [jpegQuality]
# Any other image tool works too; the pipeline only needs PNG in and out.
param(
    [Parameter(Mandatory = $true)][string]$InputPath,
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [int]$Quality = 92
)
Add-Type -AssemblyName System.Drawing
$image = [System.Drawing.Image]::FromFile((Resolve-Path $InputPath))
try {
    if ($OutputPath -match '\.jpe?g$') {
        $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
            Where-Object { $_.MimeType -eq 'image/jpeg' }
        $params = New-Object System.Drawing.Imaging.EncoderParameters 1
        $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
            [System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)
        $image.Save($OutputPath, $codec, $params)
    } else {
        $image.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
} finally {
    $image.Dispose()
}
Write-Output "wrote $OutputPath"
