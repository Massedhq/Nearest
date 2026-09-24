# Nearest - Phase 3B update (booking + payments). Run once from the project folder:
#   powershell -ExecutionPolicy Bypass -File .\setup-phase3b.ps1
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

if (-not (Test-Path ".\.env.local") -or -not (Test-Path ".\src\lib\bookings.ts")) {
  Write-Host "Run this inside C:\Users\<you>\NearestWorkspace\nearest after unzipping nearest-phase3b.zip there." -ForegroundColor Red
  exit 1
}

Step "1/5  Stripe test key"
if (EnvHas "STRIPE_SECRET_KEY") {
  Write-Host "  Stripe key already set."
} else {
  Write-Host "  In Stripe (Test mode ON): Developers > API keys > Secret key > Reveal > copy (starts with sk_test_)."
  while ($true) {
    $k = (Read-Host "  Paste the Stripe SECRET key").Trim().Trim('"')
    if ($k -match '^STRIPE_SECRET_KEY=') { $k = $k.Substring(18).Trim('"') }
    if ($k.StartsWith("sk_test_") -or $k.StartsWith("sk_live_") -or $k.StartsWith("rk_")) { break }
    Write-Host "  That doesn't look right (it should start with sk_test_)." -ForegroundColor Red
  }
  EnvSet "STRIPE_SECRET_KEY" $k
  Write-Host "  Saved to .env.local (never committed)." -ForegroundColor Green
}

Step "2/5  Installing packages"
npm ci
Check "Installing packages"

Step "3/5  Adding booking and payment tables to Neon (nothing is removed)"
npx drizzle-kit push
Check "Updating the database"

Step "4/5  Production build"
npm run build
Check "The build"

Step "5/5  Saving to GitHub"
git add -A
git commit -q -m "Phase 3B: booking, payments, credits, membership, Stripe Identity, payouts"
git push
if ($LASTEXITCODE -ne 0) { Write-Host "  (Push didn't go through - run 'git push' later.)" -ForegroundColor DarkYellow }
else { Write-Host "  Pushed - Vercel is deploying it now." -ForegroundColor Green }

Write-Host ""
Write-Host "Phase 3B is installed and builds cleanly." -ForegroundColor Green
Write-Host "Also add STRIPE_SECRET_KEY in Vercel > nearest > Settings > Environment Variables, then redeploy."
Write-Host "Turn on booking: Admin > Command Center > Marketplace status > Bookings."
Write-Host ""
$go = Read-Host "Start the app now? (Y/n)"
if ($go -ne "n" -and $go -ne "N") { npm run dev }
