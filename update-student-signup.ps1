# Nearest - student sign-up rebuilt to match the mockups (5 steps). Run from the project folder:
#   powershell -ExecutionPolicy Bypass -File .\update-student-signup.ps1
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
function Step($text) { Write-Host ""; Write-Host "==> $text" -ForegroundColor Yellow }
function Check($what) { if ($LASTEXITCODE -ne 0) { Write-Host ""; Write-Host "STOPPED: $what failed. Copy the red text above and send it to Claude." -ForegroundColor Red; exit 1 } }
Step "1/3  Adding 3 sign-up fields to Neon (nothing is removed)"
npx drizzle-kit push
Check "Updating the database"
Step "2/3  Production build"
npm run build
Check "The build"
Step "3/3  Saving to GitHub"
git add -A
git commit -q -m "Student sign-up follows the mockups: 5 steps"
git push
if ($LASTEXITCODE -eq 0) { Write-Host "  Pushed - Vercel is deploying it now." -ForegroundColor Green }
Write-Host ""; Write-Host "Done. Start the app with: npm run dev" -ForegroundColor Green
