# Nearest - Phase 6 update (launch features). Run once from the project folder:
#   powershell -ExecutionPolicy Bypass -File .\setup-phase6.ps1
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
function Step($text) { Write-Host ""; Write-Host "==> $text" -ForegroundColor Yellow }
function Check($what) { if ($LASTEXITCODE -ne 0) { Write-Host ""; Write-Host "STOPPED: $what failed. Copy the red text above and send it to Claude." -ForegroundColor Red; exit 1 } }
function EnvHas($name) { return (Test-Path ".\.env.local") -and ((Get-Content .\.env.local) -match "^$name=.+") }
function EnvSet($name, $value) {
  $lines = @(Get-Content .\.env.local | Where-Object { $_ -notmatch "^$name=" }) + "$name=$value"
  [System.IO.File]::WriteAllLines((Join-Path $PSScriptRoot ".env.local"), $lines, (New-Object System.Text.UTF8Encoding($false)))
}
if (-not (Test-Path ".\src\lib\notify.ts") -or -not (Test-Path ".\.env.local")) { Write-Host "Unzip nearest-phase6.zip into C:\Users\<you>\NearestWorkspace\nearest first." -ForegroundColor Red; exit 1 }

Step "1/6  Email (optional now - see docs\LAUNCH.md step 3)"
if (EnvHas "RESEND_API_KEY") { Write-Host "  Resend key already set." }
else {
  $r = (Read-Host "  Paste your Resend API key (starts with re_), or press Enter to skip").Trim().Trim('"')
  if ($r.StartsWith("re_")) { EnvSet "RESEND_API_KEY" $r; Write-Host "  Saved." -ForegroundColor Green } else { Write-Host "  Skipped - the app works; emails just won't send yet." -ForegroundColor DarkYellow }
}
if (-not (EnvHas "EMAIL_FROM")) { EnvSet "EMAIL_FROM" "Nearest <hello@usenearest.com>" }
if (-not (EnvHas "APP_URL")) { EnvSet "APP_URL" "https://usenearest.com" }

Step "2/6  Installing packages"
npm ci
Check "Installing packages"
Step "3/6  Adding Phase 6 fields to Neon (nothing is removed)"
npx drizzle-kit push
Check "Updating the database"
Step "4/6  Loading the DFW city list (existing cities are left as they are)"
npm run db:seed
Check "Loading cities"
Step "5/6  Production build"
npm run build
Check "The build"
Step "6/6  Saving to GitHub"
git add -A
git commit -q -m "Phase 6: emails, reminders, price step-up, Coverage and Marketing dashboards, launch checklist"
git push
if ($LASTEXITCODE -eq 0) { Write-Host "  Pushed - Vercel is deploying it now." -ForegroundColor Green }

Write-Host ""
Write-Host "Phase 6 is installed and builds cleanly." -ForegroundColor Green
Write-Host "Add these to Vercel > Environment Variables if they're not there yet:" -ForegroundColor Yellow
Get-Content .\.env.local | Where-Object { $_ -match "^(RESEND_API_KEY|EMAIL_FROM|APP_URL)=" } | ForEach-Object { if ($_ -match "^RESEND_API_KEY=") { Write-Host "  RESEND_API_KEY=(your key)" } else { Write-Host "  $_" } }
Write-Host "Your go-live steps are in docs\LAUNCH.md"
Write-Host ""
$go = Read-Host "Start the app now? (Y/n)"
if ($go -ne "n" -and $go -ne "N") { npm run dev }
