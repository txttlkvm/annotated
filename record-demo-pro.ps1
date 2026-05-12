# record-demo-pro.ps1 — production-grade demo recording
#
# Stages a clean shot: minimize every window except Brave (fullscreen TWiST)
# and Annotated overlay. Records 60s to dist/demo.mp4.
#
# PREREQ — content protection must be OFF (click PRIVATE → PUBLIC).
#
# Run:    powershell -NoProfile -ExecutionPolicy Bypass -File .\record-demo-pro.ps1

param(
    [string]$YouTubeId = '9BocSWG9hfI',  # TWiST E2281 — Jason + Lon, energetic dialog
    [int]$Seconds = 60
)

$root = $PSScriptRoot
$out = Join-Path $root 'dist\demo.mp4'

if (-not (Get-Process Annotated -ErrorAction SilentlyContinue)) {
    Start-Process "$env:LOCALAPPDATA\Programs\Annotated\Annotated.exe" -WindowStyle Hidden
    Start-Sleep -Seconds 20
}

# ── Minimize ALL existing windows so they don't appear in the recording ───
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WinAPI {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpfn, IntPtr lParam);
    [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Auto)] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
}
"@ -ErrorAction SilentlyContinue

# Show Desktop via Shell.Application (equivalent to Win+D)
$shell = New-Object -ComObject Shell.Application
$shell.MinimizeAll()
Start-Sleep -Milliseconds 800

# ── Launch Brave in kiosk-fullscreen at the TWiST autoplay URL ────────────
$bravePath = $null
foreach ($p in @(
    "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe",
    "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe",
    "${env:ProgramFiles(x86)}\BraveSoftware\Brave-Browser\Application\brave.exe"
)) {
    if (Test-Path $p) { $bravePath = $p; break }
}
if (-not $bravePath) {
    # Fallback to Chrome
    foreach ($p in @(
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
    )) { if (Test-Path $p) { $bravePath = $p; break } }
}
if (-not $bravePath) { Write-Host 'ERROR: no Brave or Chrome installed'; exit 1 }

$tempProfile = "$env:TEMP\demo-profile-$(Get-Random)"
New-Item -ItemType Directory -Path $tempProfile -Force | Out-Null

# Use embed URL with autoplay=1 + mute=0; --kiosk forces fullscreen.
$ytUrl = "https://www.youtube.com/embed/${YouTubeId}?autoplay=1&mute=0&playsinline=1&rel=0&modestbranding=1"

Write-Host "Launching Brave kiosk: $ytUrl"
$brave = Start-Process $bravePath -ArgumentList @(
    "--user-data-dir=$tempProfile",
    '--kiosk', $ytUrl,
    '--autoplay-policy=no-user-gesture-required',
    '--no-first-run', '--no-default-browser-check', '--disable-features=TranslateUI'
) -PassThru

# Wait for browser to load video and start playback
Start-Sleep -Seconds 8

# ── Bring Annotated overlay to front (overlay window has alwaysOnTop) ────
Get-Process Annotated -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -ne '' } | ForEach-Object {
    [WinAPI]::SetForegroundWindow($_.MainWindowHandle) | Out-Null
}
Start-Sleep -Milliseconds 500

# Bring Brave back forward so video gets focus, but Annotated overlay stays on top
[WinAPI]::SetForegroundWindow($brave.MainWindowHandle) | Out-Null
Start-Sleep -Seconds 3

# ── Record ────────────────────────────────────────────────────────────────
Write-Host "Recording $Seconds seconds → $out"
& ffmpeg -y -hide_banner -loglevel warning `
    -f gdigrab -framerate 30 -i desktop `
    -t $Seconds `
    -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p `
    -movflags +faststart `
    $out

# ── Cleanup: close kiosk Brave ────────────────────────────────────────────
try { Stop-Process -Id $brave.Id -Force -ErrorAction SilentlyContinue } catch {}
Get-Process brave -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like '*kiosk*' -or $_.Path -eq $bravePath } | ForEach-Object {
    if ($_.MainWindowTitle -ne '') { try { Stop-Process -Id $_.Id -Force } catch {} }
}
try { Remove-Item $tempProfile -Recurse -Force } catch {}

if (Test-Path $out) {
    $sz = [math]::Round((Get-Item $out).Length/1MB,1)
    Write-Host "`n[OK] Demo recorded: $out  ($sz MB)" -ForegroundColor Green
} else {
    Write-Host "`n[FAIL] Recording failed" -ForegroundColor Red
}
