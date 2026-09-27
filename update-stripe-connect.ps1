# Nearest - payout accounts use Stripe's current method; messages show Stripe's exact words.
#   powershell -ExecutionPolicy Bypass -File .\update-stripe-connect.ps1
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
Write-Host "==> Practice run against your Stripe test account" -ForegroundColor Yellow
npm run stripe:check
Write-Host ""; Write-Host "==> Building" -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "STOPPED: the build failed. Copy the red text above and send it to Claude." -ForegroundColor Red; exit 1 }
git add -A
git commit -q -m "Payouts: create Stripe accounts with the current controller settings; show Stripe's exact message"
git push
if ($LASTEXITCODE -eq 0) { Write-Host "Pushed - Vercel is deploying it now." -ForegroundColor Green }
