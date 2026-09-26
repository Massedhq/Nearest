# Nearest - delete accounts, resend/copy/delete invitations, and stop owners from accepting pro invites.
#   powershell -ExecutionPolicy Bypass -File .\update-admin-people.ps1
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
Write-Host ""; Write-Host "==> Building" -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "STOPPED: the build failed. Copy the red text above and send it to Claude." -ForegroundColor Red; exit 1 }
git add -A
git commit -q -m "Admin: delete accounts, resend/copy/delete invitations; invites can't attach to an owner account"
git push
if ($LASTEXITCODE -eq 0) { Write-Host "Pushed - Vercel is deploying it now." -ForegroundColor Green }
Write-Host ""; Write-Host "Done." -ForegroundColor Green
