# Nearest - brings everything up to date in one step (Phase 7 + every update since).
# Safe to run on top of whatever you have installed. Run from the project folder:
#   powershell -ExecutionPolicy Bypass -File .\setup-catch-up.ps1
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
function Step($text) { Write-Host ""; Write-Host "==> $text" -ForegroundColor Yellow }
function Check($what) { if ($LASTEXITCODE -ne 0) { Write-Host ""; Write-Host "STOPPED: $what failed. Copy the red text above and send it to Claude." -ForegroundColor Red; exit 1 } }
if (-not (Test-Path ".\src\app\fav-actions.ts") -or -not (Test-Path ".\.env.local")) { Write-Host "Unzip nearest-catch-up.zip into C:\Users\<you>\NearestWorkspace\nearest first." -ForegroundColor Red; exit 1 }

Write-Host "Owner emails in .env.local (should be ONLY your three owner emails):" -ForegroundColor Yellow
Get-Content .\.env.local | Where-Object { $_ -match "^(OWNER_EMAILS|MAIN_OWNER_EMAIL)=" } | ForEach-Object { Write-Host "  $_" }

# Files removed from Nearest (unzipping never deletes old files, so remove them here).
$retired = @(".\Claude outputs", ".\src\app\how-it-works", ".\src\app\(student)\verify\later", ".\src\components\FillingMarketBook.tsx", ".\src\app\admin\city-actions.ts", ".\src\lib\city-activation.ts")
foreach ($r in $retired) { if (Test-Path $r) { Remove-Item -Recurse -Force $r; Write-Host "Removed $r" -ForegroundColor DarkGray } }

Step "1/4  Installing packages"
npm ci
Check "Installing packages"
Step "2/4  Updating Neon (adds favorites, notifications, guardian consent and partner payout details - nothing is removed)"
# Neon can be slow to answer "Pulling schema" — retry up to 3 times before giving up.
$ok = $false
foreach ($try in 1..3) {
  npx drizzle-kit push
  if ($LASTEXITCODE -eq 0) { $ok = $true; break }
  Write-Host "  Database didn't answer in time (try $try of 3) - retrying in 5 seconds..." -ForegroundColor Yellow
  Start-Sleep -Seconds 5
}
if (-not $ok) { Write-Host "STOPPED: Updating the database failed 3 times. Run: npx drizzle-kit push   then run this installer again." -ForegroundColor Red; exit 1 }
Step "3/4  Loading all 254 Texas counties (existing counties, cities and markets are left as they are)"
npm run db:seed
Check "Loading counties"
Step "3/4  Production build"
# Clear leftovers from earlier builds or "Start the app" runs — they can point at removed pages and break the build.
if (Test-Path ".\.next") { Remove-Item -Recurse -Force ".\.next" -ErrorAction SilentlyContinue }
npm run build
Check "The build"
Step "4/4  Saving to GitHub"
git add -A
git commit -q -m "Services: categories expand/minimize (one open at a time), services fold to one line with Edit/Minimize"
git push
if ($LASTEXITCODE -eq 0) { Write-Host "  Pushed - Vercel is deploying it now." -ForegroundColor Green }
Write-Host ""
Write-Host "Everything is up to date and builds cleanly." -ForegroundColor Green
Write-Host ""
Write-Host "To load every school:  npm run schools:import -- --state TX   (then: npm run schools:import  for all states)" -ForegroundColor Yellow
Write-Host ""
$go = Read-Host "Start the app now? (Y/n)"
if ($go -ne "n" -and $go -ne "N") { npm run dev }
