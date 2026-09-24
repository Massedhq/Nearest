# Nearest - Phase 4 update (appointment day). Run once from the project folder:
#   powershell -ExecutionPolicy Bypass -File .\setup-phase4.ps1
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
function Step($text) { Write-Host ""; Write-Host "==> $text" -ForegroundColor Yellow }
function Check($what) { if ($LASTEXITCODE -ne 0) { Write-Host ""; Write-Host "STOPPED: $what failed. Copy the red text above and send it to Claude." -ForegroundColor Red; exit 1 } }
if (-not (Test-Path ".\src\lib\appointment.ts")) { Write-Host "Unzip nearest-phase4.zip into C:\Users\<you>\NearestWorkspace\nearest first." -ForegroundColor Red; exit 1 }
Step "1/4  Installing packages"
npm ci
Check "Installing packages"
Step "2/4  Adding appointment-day tables to Neon (nothing is removed)"
npx drizzle-kit push
Check "Updating the database"
Step "3/4  Production build"
npm run build
Check "The build"
Step "4/4  Saving to GitHub"
git add -A
git commit -q -m "Phase 4: appointment day - address unlock, check-in, messaging, finish flow, reviews, no-shows, incidents"
git push
if ($LASTEXITCODE -eq 0) { Write-Host "  Pushed - Vercel is deploying it now." -ForegroundColor Green }
Write-Host ""
Write-Host "Phase 4 is installed and builds cleanly." -ForegroundColor Green
Write-Host "Tip: pros should open My Business > Location and press Save once, so their address gets mapped for check-in."
Write-Host ""
$go = Read-Host "Start the app now? (Y/n)"
if ($go -ne "n" -and $go -ne "N") { npm run dev }
