# Nearest - Phase 2 update. Run once from the project folder:
#   powershell -ExecutionPolicy Bypass -File .\setup-phase2.ps1
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

if (-not (Test-Path ".\.env.local") -or -not (Test-Path ".\src\lib\pro.ts")) {
  Write-Host "Run this inside C:\Users\<you>\NearestWorkspace\nearest after unzipping nearest-phase2.zip there." -ForegroundColor Red
  exit 1
}

Step "1/6  Photo storage (Vercel Blob)"
if (EnvHas "BLOB_READ_WRITE_TOKEN") {
  Write-Host "  Blob token already set."
} else {
  Write-Host "  In Vercel: nearest > Storage > Create Database > Blob > name it nearest-media > Create,"
  Write-Host "  then Connect it to the nearest project (all environments)."
  Write-Host "  Open the Blob store > .env.local tab > copy the BLOB_READ_WRITE_TOKEN value (starts with vercel_blob_rw_)."
  $t = (Read-Host "  Paste BLOB_READ_WRITE_TOKEN (or press Enter to skip for now)").Trim().Trim('"')
  if ($t -match '^BLOB_READ_WRITE_TOKEN=') { $t = $t.Substring(22).Trim('"') }
  if ($t.StartsWith("vercel_blob_rw_")) { EnvSet "BLOB_READ_WRITE_TOKEN" $t; Write-Host "  Saved." -ForegroundColor Green }
  else { Write-Host "  Skipped - photo uploads won't work on this computer until it's added." -ForegroundColor DarkYellow }
}

Step "2/6  Invite emails (Resend) - optional"
if (EnvHas "RESEND_API_KEY") {
  Write-Host "  Resend key already set."
} else {
  $r = (Read-Host "  Paste your Resend API key (starts with re_), or press Enter to skip").Trim().Trim('"')
  if ($r.StartsWith("re_")) {
    EnvSet "RESEND_API_KEY" $r
    EnvSet "EMAIL_FROM" "Nearest <invites@usenearest.com>"
    Write-Host "  Saved. Emails send once usenearest.com is verified in Resend > Domains." -ForegroundColor Green
  } else { Write-Host "  Skipped - invites still work with Copy link." -ForegroundColor DarkYellow }
}

Step "3/6  Installing packages"
npm ci
Check "Installing packages"

Step "4/6  Adding the Phase 2 tables to Neon (nothing is removed)"
npx drizzle-kit push
Check "Updating the database"

Step "5/6  Loading categories, suggested services and the new pricing rule"
npm run db:seed
Check "Loading starting data"

Step "6/6  Production build"
npm run build
Check "The build"

git add -A
git commit -q -m "Phase 2: professional setup, model calls, Available Today, verification queue"
git push
if ($LASTEXITCODE -ne 0) { Write-Host "  (Push didn't go through - run 'git push' later. Local app is fine.)" -ForegroundColor DarkYellow }
else { Write-Host "  Pushed to GitHub - Vercel is deploying it now." -ForegroundColor Green }

Write-Host ""
Write-Host "Phase 2 is installed and builds cleanly." -ForegroundColor Green
Write-Host "If you added a Resend key, also add RESEND_API_KEY and EMAIL_FROM in Vercel > nearest > Settings > Environment Variables."
Write-Host ""
$go = Read-Host "Start the app now? (Y/n)"
if ($go -ne "n" -and $go -ne "N") { npm run dev }
