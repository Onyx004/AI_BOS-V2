# Developer helper: runs preview-<kind>.exe, clicks through Welcome/Directory, and saves PNGs of the setup window at the
# given seconds (window is captured with PrintWindow, so other windows on top do not matter).
# Usage: capture.ps1 -Kind employee -Shots 1,5,9 [-Clicks 2,3.5]
param(
  [ValidateSet("employee", "admin")] [string]$Kind = "employee",
  [double[]]$Shots = @(6, 10, 14),
  [double[]]$Clicks = @(2, 3.5),
  [string]$OutDir = (Join-Path $env:TEMP "aibos-installer-shots")
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System; using System.Runtime.InteropServices;
public class Cap {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] public static extern IntPtr GetDlgItem(IntPtr h, int id);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, int msg, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, int msg, IntPtr w, IntPtr l);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
}
"@
[void][Cap]::SetProcessDPIAware()   # measure and capture physical pixels, like the DPI-aware installer
New-Item -ItemType Directory -Force $OutDir | Out-Null
$exe = Join-Path $PSScriptRoot "preview-$Kind.exe"
$proc = Start-Process $exe -PassThru
$sw = [Diagnostics.Stopwatch]::StartNew()
$events = @()
foreach ($c in $Clicks) { $events += [pscustomobject]@{ At = $c; Type = "click" } }
foreach ($s in $Shots) { $events += [pscustomobject]@{ At = $s; Type = "shot" } }
try {
  foreach ($e in ($events | Sort-Object At)) {
    while ($sw.Elapsed.TotalSeconds -lt $e.At) { Start-Sleep -Milliseconds 50 }
    $proc.Refresh()
    if ($proc.HasExited) { Write-Output "installer exited at $([int]$sw.Elapsed.TotalSeconds)s"; break }
    $h = $proc.MainWindowHandle
    if ($h -eq [IntPtr]::Zero) { continue }
    if ($e.Type -eq "click") { [void][Cap]::PostMessage([Cap]::GetDlgItem($h, 1), 0x00F5, [IntPtr]::Zero, [IntPtr]::Zero); continue }
    $r = New-Object Cap+RECT; [void][Cap]::GetWindowRect($h, [ref]$r)
    $bmp = New-Object Drawing.Bitmap ($r.R - $r.L), ($r.B - $r.T)
    $g = [Drawing.Graphics]::FromImage($bmp); $hdc = $g.GetHdc()
    [void][Cap]::PrintWindow($h, $hdc, 2)
    $g.ReleaseHdc($hdc); $g.Dispose()
    $file = Join-Path $OutDir "$Kind-$($e.At).png"; $bmp.Save($file, [Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
    Write-Output "$file ($($r.R - $r.L)x$($r.B - $r.T))"
  }
} finally { if (-not $proc.HasExited) { $proc.Kill() } }
