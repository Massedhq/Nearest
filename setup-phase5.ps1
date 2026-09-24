# Nearest - Phase 5 update (enforcement, appeals, Sales Track). Run once from the project folder:
#   powershell -ExecutionPolicy Bypass -File .\setup-phase5.ps1
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
function Step($text) { Write-Host ""; Write-Host "==> $text" -ForegroundColor Yellow }
function Check($what) { if ($LASTEXITCODE -ne 0) { Write-Host ""; Write-Host "STOPPED: $what failed. Copy the red text above and send it to Claude." -ForegroundColor Red; exit 1 } }
function EnvHas($name) { return (Test-Path ".\.env.local") -and ((Get-Content .\.env.local) -match "^$name=.+") }
function EnvSet($name, $value) {
  $lines = @(Get-Content .\.env.local | Where-Object { $_ -notmatch "^$name=" }) + "$name=$value"
  [System.IO.File]::WriteAllLines((Join-Path $PSScriptRoot ".env.local"), $lines, (New-Object System.Text.UTF8Encoding($false)))
}
if (-not (Test-Path ".\src\lib\enforcement.ts") -or -not (Test-Path ".\.env.local")) { Write-Host "Unzip nearest-phase5.zip into C:\Users\<you>\NearestWorkspace\nearest first." -ForegroundColor Red; exit 1 }

Step "1/5  Settings"
if (-not (EnvHas "CRON_SECRET")) {
  $bytes = New-Object byte[] 24; (New-Object System.Security.Cryptography.RNGCryptoServiceProvider).GetBytes($bytes)
  EnvSet "CRON_SECRET" (([System.BitConverter]::ToString($bytes)) -replace "-", "").ToLower()
  Write-Host "  Created CRON_SECRET for the hourly check."
}
if (-not (EnvHas "MAIN_OWNER_EMAIL")) { EnvSet "MAIN_OWNER_EMAIL" "avy@usenearest.com"; Write-Host "  MAIN_OWNER_EMAIL = avy@usenearest.com (approves partner payouts)." }

Step "2/5  Installing packages"
npm ci
Check "Installing packages"
Step "3/5  Adding enforcement and Sales Track tables to Neon (nothing is removed)"
npx drizzle-kit push
Check "Updating the database"
Step "4/5  Production build"
npm run build
Check "The build"
Step "5/5  Saving to GitHub"
git add -A
git commit -q -m "Phase 5: enforcement, appeals, partner Sales Track, hourly checks"
git push
if ($LASTEXITCODE -eq 0) { Write-Host "  Pushed - Vercel is deploying it now." -ForegroundColor Green }

Write-Host ""
Write-Host "Phase 5 is installed and builds cleanly." -ForegroundColor Green
Write-Host "Add these two lines from .env.local to Vercel > nearest > Settings > Environment Variables:" -ForegroundColor Yellow
Get-Content .\.env.local | Where-Object { $_ -match "^(CRON_SECRET|MAIN_OWNER_EMAIL)=" } | ForEach-Object { Write-Host "  $_" }
Write-Host ""
$go = Read-Host "Start the app now? (Y/n)"
if ($go -ne "n" -and $go -ne "N") { npm run dev }
