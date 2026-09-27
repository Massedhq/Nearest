# Nearest - partner payout "Connect" button shows Stripe's reason in plain words. Run from the project folder:
#   powershell -ExecutionPolicy Bypass -File .\update-partner-connect.ps1
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "STOPPED: the build failed. Copy the red text above and send it to Claude." -ForegroundColor Red; exit 1 }
git add -A
git commit -q -m "Partner payouts: clear Stripe messages on Connect payout account"
git push
if ($LASTEXITCODE -eq 0) { Write-Host "Pushed - Vercel is deploying it now." -ForegroundColor Green }
