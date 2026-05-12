# record-demo.ps1
# Records a polished 60s demo of Annotated in action.
#
# PREREQ — content protection must be OFF:
#   Click the "PRIVATE" pill in the overlay header → it flips to "PUBLIC"
#   (Otherwise the overlay won't appear in the recording.)
#
# Run:    pwsh .\record-demo.ps1
# Output: dist\demo.mp4

param(
    [string]$Url = 'https://www.youtube.com/watch?v=raJmrhU6k_U',  # known TWiST clip with Jason + guest
    [int]$Seconds = 60
)

$root = $PSScriptRoot
$out = Join-Path $root 'dist\demo.mp4'
$audioTmp = "$env:TEMP\twist-demo-$(Get-Random).wav"

if (-not (Get-Process Annotated -ErrorAction SilentlyContinue)) {
    Start-Process "$env:LOCALAPPDATA\Programs\Annotated\Annotated.exe" -WindowStyle Hidden
    Write-Host 'Started Annotated, waiting 25s for boot...'
    Start-Sleep -Seconds 25
}

Write-Host '⚠  CONFIRM: click the PRIVATE pill in the overlay header to toggle to PUBLIC.'
Write-Host '   You have 8 seconds...'
Start-Sleep -Seconds 8

# Download a TWiST clip
Write-Host "Downloading clip: $Url"
& yt-dlp -x --audio-format wav -o $audioTmp.Replace('.wav','.%(ext)s') $Url 2>&1 | Out-Null
if (-not (Test-Path $audioTmp)) {
    $found = Get-ChildItem $env:TEMP -Filter 'twist-demo-*.wav' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($found) { $audioTmp = $found.FullName }
}
if (-not (Test-Path $audioTmp)) { Write-Host 'ERROR: download failed'; exit 1 }
Write-Host "Audio ready: $([math]::Round((Get-Item $audioTmp).Length/1MB,2)) MB"

# Start audio playback in background (system speakers — Annotated picks up via loopback)
$playProc = Start-Process ffplay -ArgumentList '-nodisp','-autoexit',$audioTmp -WindowStyle Hidden -PassThru

# Give Annotated a beat to ingest the first chunks before we start recording
Start-Sleep -Seconds 4

# Record screen for $Seconds seconds — 1080p, 30fps, h264 high quality
Write-Host "Recording $Seconds seconds → $out"
& ffmpeg -y -hide_banner -loglevel warning `
    -f gdigrab -framerate 30 -i desktop `
    -t $Seconds `
    -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p `
    -movflags +faststart `
    $out

# Cleanup
try { Stop-Process -Id $playProc.Id -Force -ErrorAction SilentlyContinue } catch {}
try { Remove-Item $audioTmp -Force } catch {}

if (Test-Path $out) {
    $sz = [math]::Round((Get-Item $out).Length/1MB,1)
    Write-Host "`n✅ Demo recorded: $out  ($sz MB)" -ForegroundColor Green
    Write-Host "   Attach this to the TWIST-BOUNTY-EMAIL alongside Annotated Setup 1.0.0.exe"
} else {
    Write-Host "`n❌ Recording failed" -ForegroundColor Red
}
