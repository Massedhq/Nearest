# Nearest - admin sign-in: email only (no Apple/Facebook/Google). Run from the project folder:
#   powershell -ExecutionPolicy Bypass -File .\update-admin-signin.ps1
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "STOPPED: the build failed. Copy the red text above and send it to Claude." -ForegroundColor Red; exit 1 }
git add -A
git commit -q -m "Admin sign-in: email only"
git push
if ($LASTEXITCODE -eq 0) { Write-Host "Pushed - Vercel is deploying it now." -ForegroundColor Green }
