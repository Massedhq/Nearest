# Nearest - student verification uses a live camera for the selfie and ID. Run from the project folder:
#   powershell -ExecutionPolicy Bypass -File .\update-selfie-camera.ps1
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "STOPPED: the build failed. Copy the red text above and send it to Claude." -ForegroundColor Red; exit 1 }
git add -A
git commit -q -m "Verification: live in-page camera for selfie and school ID"
git push
if ($LASTEXITCODE -eq 0) { Write-Host "Pushed - Vercel is deploying it now." -ForegroundColor Green }
