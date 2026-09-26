# Nearest - full Terms of Service and Privacy Policy, plus age and guardian consent at sign-up.
#   powershell -ExecutionPolicy Bypass -File .\update-legal.ps1
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
function Check($what) { if ($LASTEXITCODE -ne 0) { Write-Host "STOPPED: $what failed. Copy the red text above and send it to Claude." -ForegroundColor Red; exit 1 } }
Write-Host ""; Write-Host "==> Adding guardian consent fields to Neon (nothing is removed)" -ForegroundColor Yellow
npx drizzle-kit push
Check "Updating the database"
Write-Host ""; Write-Host "==> Building" -ForegroundColor Yellow
npm run build
Check "The build"
git add -A
git commit -q -m "Full Terms of Service and Privacy Policy; age 13+ and guardian consent at sign-up"
git push
if ($LASTEXITCODE -eq 0) { Write-Host "Pushed - Vercel is deploying it now." -ForegroundColor Green }
Write-Host ""; Write-Host "Done. Fill in your company legal name and mailing address at the top of src\app\terms\page.tsx and src\app\privacy\page.tsx." -ForegroundColor Green
