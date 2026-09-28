# Nearest - "Create your owner login" on the admin sign-in (owner emails only). Run from the project folder:
#   powershell -ExecutionPolicy Bypass -File .\update-owner-signup.ps1
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "STOPPED: the build failed. Copy the red text above and send it to Claude." -ForegroundColor Red; exit 1 }
git add -A
git commit -q -m "Admin: owners can create their live login (owner emails only)"
git push
if ($LASTEXITCODE -eq 0) { Write-Host "Pushed - Vercel is deploying it now." -ForegroundColor Green }
