# Nearest - Phase 3A update. Run once from the project folder:
#   powershell -ExecutionPolicy Bypass -File .\setup-phase3a.ps1
# Native tools (npm, git) print harmless warnings; we check exit codes instead of stopping on them.
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

function Step($text) { Write-Host ""; Write-Host "==> $text" -ForegroundColor Yellow }
function Check($what) { if ($LASTEXITCODE -ne 0) { Write-Host ""; Write-Host "STOPPED: $what failed. Copy the red text above and send it to Claude." -ForegroundColor Red; exit 1 } }
function EnvHas($name) { return (Test-Path ".\.env.local") -and ((Get-Content .\.env.local) -match "^$name=.+") }
function EnvSet($name, $value) {
  $lines = @(Get-Content .\.env.local | Where-Object { $_ -notmatch "^$name=" }) + "$name=$value"
  [System.IO.File]::WriteAllLines((Join-Path $PSScriptRoot ".env.local"), $lines, (New-Object System.Text.UTF8Encoding($false)))
}

if (-not (Test-Path ".\.env.local") -or -not (Test-Path ".\src\lib\student.ts")) {
  Write-Host "Run this inside C:\Users\<you>\NearestWorkspace\nearest after unzipping nearest-phase3a.zip there." -ForegroundColor Red
  exit 1
}

Step "1/4  Installing packages"
npm ci
Check "Installing packages"

Step "2/4  Adding the Phase 3A tables to Neon (nothing is removed)"
npx drizzle-kit push
Check "Updating the database"

Step "3/4  Loading DFW starter schools"
npm run db:seed
Check "Loading starting data"

Step "4/4  Production build"
npm run build
Check "The build"

git add -A
git commit -q -m "Phase 3A: student verification, schools, search, model calls near me, pro profiles"
git push
if ($LASTEXITCODE -ne 0) { Write-Host "  (Push didn't go through - run 'git push' later. Local app is fine.)" -ForegroundColor DarkYellow }
else { Write-Host "  Pushed to GitHub - Vercel is deploying it now." -ForegroundColor Green }

Write-Host ""
Write-Host "Phase 3A is installed and builds cleanly." -ForegroundColor Green
Write-Host ""
$go = Read-Host "Start the app now? (Y/n)"
if ($go -ne "n" -and $go -ne "N") { npm run dev }
