# Nearest - Show/Hide on every password box. Run from the project folder:
#   powershell -ExecutionPolicy Bypass -File .\update-show-password.ps1
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "STOPPED: the build failed. Copy the red text above and send it to Claude." -ForegroundColor Red; exit 1 }
git add -A
git commit -q -m "Show/Hide button on every password box"
git push
if ($LASTEXITCODE -eq 0) { Write-Host "Pushed - Vercel is deploying it now." -ForegroundColor Green }
