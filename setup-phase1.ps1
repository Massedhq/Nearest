# Nearest - Phase 1 setup. Run once from the project folder:
#   powershell -ExecutionPolicy Bypass -File .\setup-phase1.ps1
# Native tools (npm, git) print harmless warnings; we check exit codes instead of stopping on them.
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

function Step($text) { Write-Host ""; Write-Host "==> $text" -ForegroundColor Yellow }
function Check($what) { if ($LASTEXITCODE -ne 0) { Write-Host ""; Write-Host "STOPPED: $what failed. Copy the red text above and send it to Claude." -ForegroundColor Red; exit 1 } }
function Ask($prompt, $mustStart) {
  while ($true) {
    $v = (Read-Host $prompt).Trim()
    if ($v.StartsWith("psql ")) { $v = $v.Substring(5).Trim() }
    $v = $v.Trim('"').Trim("'")
    if ($v -and (-not $mustStart -or $v.StartsWith($mustStart))) { return $v }
    Write-Host "  That doesn't look right" -ForegroundColor Red -NoNewline
    if ($mustStart) { Write-Host " (it should start with $mustStart)" -ForegroundColor Red } else { Write-Host "" }
  }
}

if (-not (Test-Path ".\package.json") -or -not (Test-Path ".\src\proxy.ts")) {
  Write-Host "Run this from C:\Users\<you>\NearestWorkspace\nearest after unzipping nearest-complete.zip there." -ForegroundColor Red
  exit 1
}

Step "1/6  Removing Next.js starter files"
foreach ($f in @("src\app\page.module.css", "src\app\favicon.ico", "public\file.svg", "public\globe.svg", "public\next.svg", "public\vercel.svg", "public\window.svg")) {
  if (Test-Path $f) { Remove-Item $f }
}

Step "2/6  Connecting your Neon database and Clerk"
if (Test-Path ".\.env.local") {
  Write-Host "  .env.local already exists - keeping it."
} else {
  Write-Host "  Before you paste keys, make sure Clerk is set up (dashboard.clerk.com > your app > Configure):"
  Write-Host "    - Email address: ON, required, verify at sign-up with an email code"
  Write-Host "    - Phone number: OFF"
  Write-Host "    - Password: ON"
  Write-Host ""
  $db = Ask "  Neon connection string (Neon > Connect)" "postgres"
  $pk = Ask "  Clerk Publishable key (Clerk > API keys)" "pk_"
  $sk = Ask "  Clerk Secret key" "sk_"
  $owners = Ask "  Owner emails, comma-separated (the 3 partners)" ""
  $envText = @(
    "DATABASE_URL=$db",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$pk",
    "CLERK_SECRET_KEY=$sk",
    "NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in",
    "NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up",
    "OWNER_EMAILS=$owners"
  ) -join "`n"
  # UTF-8 without a byte-order mark, so the first key is read correctly.
  [System.IO.File]::WriteAllText((Join-Path $PSScriptRoot ".env.local"), "$envText`n", (New-Object System.Text.UTF8Encoding($false)))
  Write-Host "  Saved .env.local (it is git-ignored and never committed)."
}

Step "3/6  Installing the exact tested packages"
npm ci
Check "Installing packages"

Step "4/6  Creating the database tables in Neon"
npx drizzle-kit push
Check "Creating tables"

Step "5/6  Loading DFW counties, cities and the rules engine"
npm run db:seed
Check "Loading starting data"

Step "6/6  Production build"
npm run build
Check "The build"

if (-not (Test-Path ".\.git")) { git init -q }
git add -A
git commit -q -m "Phase 1: accounts, roles, founding invitations, admin shell"
if ($LASTEXITCODE -ne 0) { Write-Host "  (Git commit skipped - you can commit later. The app is fine.)" }
Write-Host ""
Write-Host "Phase 1 is installed and builds cleanly." -ForegroundColor Green
Write-Host ""
Write-Host "  Student app:  http://localhost:3000"
Write-Host "  Pro portal:   http://localhost:3000/pro"
Write-Host "  Admin:        http://localhost:3000/admin"
Write-Host ""
$go = Read-Host "Start the app now? (Y/n)"
if ($go -ne "n" -and $go -ne "N") {
  Start-Process "http://localhost:3000/admin"
  npm run dev
}
