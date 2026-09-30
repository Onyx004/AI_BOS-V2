# Generates the bitmaps used by packaging/installer-ui.nsh (System.Drawing only, no ImageMagick needed).
# Every image is produced at four DPI scales (100/125/150/200 %) because the installer is DPI-aware and the
# NSIS bitmap controls do not scale by themselves.  Re-run after changing the logo or the wording:
#   powershell -NoProfile -File packaging\assets\installer\generate-installer-ui.ps1
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$assetRoot = $PSScriptRoot
$iconRoot = Join-Path (Split-Path -Parent $assetRoot) "icons"
$outRoot = Join-Path $assetRoot "ui"
New-Item -ItemType Directory -Force $outRoot | Out-Null

$scales = @(100, 125, 150, 200)
$products = @(
  @{ Kind = "employee"; Name = "AI BOS Employee"; Logo = "AI-BOS-Employee.png" },
  @{ Kind = "admin"; Name = "AI BOS Admin"; Logo = "AI-BOS-Admin.png" }
)

function C([string]$hex) { [Drawing.ColorTranslator]::FromHtml($hex) }
$navy = C "#0B2447"; $muted = C "#5B6675"; $blue = C "#1677E5"; $line = C "#DCE6F1"

function New-Canvas([int]$w, [int]$h) {
  $bmp = New-Object Drawing.Bitmap $w, $h, ([Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = "HighQuality"; $g.InterpolationMode = "HighQualityBicubic"; $g.PixelOffsetMode = "HighQuality"
  $g.TextRenderingHint = "ClearTypeGridFit"
  $g.Clear([Drawing.Color]::White)
  return @{ Bmp = $bmp; G = $g }
}
function Save-Bmp($canvas, [string]$path) { $canvas.G.Dispose(); $canvas.Bmp.Save($path, [Drawing.Imaging.ImageFormat]::Bmp); $canvas.Bmp.Dispose() }

function Draw-Waves($g, [double]$s, [double]$x0, [double]$w, [double]$h) {
  foreach ($i in 0..5) {
    $pen = New-Object Drawing.Pen ([Drawing.Color]::FromArgb(70 - $i * 8, 120, 175, 235)), ([single](1.1 * $s))
    $y = $h * (0.25 + $i * 0.09)
    $p0 = New-Object Drawing.PointF ([single]$x0), ([single]($y + 22 * $s))
    $p1 = New-Object Drawing.PointF ([single]($x0 + $w * 0.30)), ([single]($y - 30 * $s))
    $p2 = New-Object Drawing.PointF ([single]($x0 + $w * 0.62)), ([single]($y + 46 * $s))
    $p3 = New-Object Drawing.PointF ([single]($x0 + $w)), ([single]($y - 8 * $s))
    $g.DrawBezier($pen, $p0, $p1, $p2, $p3); $pen.Dispose()
  }
}

foreach ($product in $products) {
  $logo = [Drawing.Image]::FromFile((Join-Path $iconRoot $product.Logo))
  foreach ($pct in $scales) {
    $s = $pct / 100.0

    # ---- banner: logo + product name + tagline (top of every page after Welcome), design size 760 x 84
    $w = [int](760 * $s); $h = [int](84 * $s)
    $cv = New-Canvas $w $h; $g = $cv.G
    $grad = New-Object Drawing.Drawing2D.LinearGradientBrush ((New-Object Drawing.Rectangle 0, 0, $w, $h)), (C "#FFFFFF"), (C "#EAF3FF"), 0.0
    $g.FillRectangle($grad, 0, 0, $w, $h); $grad.Dispose()
    Draw-Waves $g $s ($w * 0.50) ($w * 0.50) $h
    $g.DrawImage($logo, [single](24 * $s), [single](9 * $s), [single](66 * $s), [single](66 * $s))
    $titleFont = New-Object Drawing.Font "Segoe UI Semibold", ([single](22 * $s)), ([Drawing.FontStyle]::Regular), ([Drawing.GraphicsUnit]::Pixel)
    $subFont = New-Object Drawing.Font "Segoe UI", ([single](13.5 * $s)), ([Drawing.FontStyle]::Regular), ([Drawing.GraphicsUnit]::Pixel)
    $g.DrawString($product.Name, $titleFont, (New-Object Drawing.SolidBrush $navy), [single](104 * $s), [single](13 * $s))
    $g.DrawString("Enterprise AI Management Platform", $subFont, (New-Object Drawing.SolidBrush $muted), [single](106 * $s), [single](48 * $s))
    $g.FillRectangle((New-Object Drawing.SolidBrush $line), 0, $h - [int][Math]::Max(1, [Math]::Round($s)), $w, [int][Math]::Max(1, [Math]::Round($s)))
    Save-Bmp $cv (Join-Path $outRoot "$($product.Kind)-banner-$pct.bmp")

    # ---- sidebar for the Welcome / Finish pages, design size 164 x 314
    $w = [int](164 * $s); $h = [int](314 * $s)
    $cv = New-Canvas $w $h; $g = $cv.G
    $grad = New-Object Drawing.Drawing2D.LinearGradientBrush ((New-Object Drawing.Rectangle 0, 0, $w, $h)), (C "#FBFDFF"), (C "#EAF4FF"), 90.0
    $g.FillRectangle($grad, 0, 0, $w, $h); $grad.Dispose()
    $g.FillRectangle((New-Object Drawing.SolidBrush $blue), 0, 0, [int](5 * $s), $h)
    Draw-Waves $g $s 0 $w ($h * 1.55)
    $g.DrawImage($logo, [single](16 * $s), [single](38 * $s), [single](132 * $s), [single](132 * $s))
    $bigFont = New-Object Drawing.Font "Segoe UI Semibold", ([single](15 * $s)), ([Drawing.FontStyle]::Regular), ([Drawing.GraphicsUnit]::Pixel)
    $smallFont = New-Object Drawing.Font "Segoe UI", ([single](10.5 * $s)), ([Drawing.FontStyle]::Regular), ([Drawing.GraphicsUnit]::Pixel)
    $center = New-Object Drawing.StringFormat; $center.Alignment = "Center"
    $g.DrawString("ENTERPRISE AI", $bigFont, (New-Object Drawing.SolidBrush $navy), (New-Object Drawing.RectangleF 0, ([single](256 * $s)), $w, ([single](22 * $s))), $center)
    $g.DrawString("MANAGEMENT PLATFORM", $smallFont, (New-Object Drawing.SolidBrush $muted), (New-Object Drawing.RectangleF 0, ([single](278 * $s)), $w, ([single](18 * $s))), $center)
    Save-Bmp $cv (Join-Path $outRoot "$($product.Kind)-sidebar-$pct.bmp")
  }
  $logo.Dispose()
}

# ---- stepper markers (shared by both products), design size 22 x 22 on the white page background
foreach ($pct in $scales) {
  $s = $pct / 100.0; $size = [int][Math]::Round(22 * $s)
  foreach ($state in "done", "active", "todo") {
    $cv = New-Canvas $size $size; $g = $cv.G
    $pad = 1.5 * $s; $d = $size - 2 * $pad
    switch ($state) {
      "done" {
        $g.FillEllipse((New-Object Drawing.SolidBrush $blue), [single]$pad, [single]$pad, [single]$d, [single]$d)
        $pen = New-Object Drawing.Pen ([Drawing.Color]::White), ([single](2.2 * $s)); $pen.StartCap = "Round"; $pen.EndCap = "Round"; $pen.LineJoin = "Round"
        $pts = @((New-Object Drawing.PointF ([single](6.2 * $s)), ([single](11.4 * $s))), (New-Object Drawing.PointF ([single](9.6 * $s)), ([single](14.8 * $s))), (New-Object Drawing.PointF ([single](15.8 * $s)), ([single](7.6 * $s))))
        $g.DrawLines($pen, $pts)
      }
      "active" {
        $pen = New-Object Drawing.Pen $blue, ([single](2.4 * $s))
        $g.DrawEllipse($pen, [single]($pad + 1.2 * $s), [single]($pad + 1.2 * $s), [single]($d - 2.4 * $s), [single]($d - 2.4 * $s))
        $r = 4.6 * $s; $c = $size / 2.0
        $g.FillEllipse((New-Object Drawing.SolidBrush $blue), [single]($c - $r), [single]($c - $r), [single](2 * $r), [single](2 * $r))
      }
      "todo" {
        $g.FillEllipse((New-Object Drawing.SolidBrush (C "#C9CFD8")), [single]$pad, [single]$pad, [single]$d, [single]$d)
      }
    }
    Save-Bmp $cv (Join-Path $outRoot "step-$state-$pct.bmp")
  }
}

Write-Output "Generated $((Get-ChildItem $outRoot -Filter *.bmp).Count) bitmaps in $outRoot"
