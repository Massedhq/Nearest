# Nearest - "Powered by Massed" footer on every screen. Run from the project folder:
#   powershell -ExecutionPolicy Bypass -File .\update-massed.ps1
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
Write-Host ""; Write-Host "==> Building" -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "STOPPED: the build failed. Copy the red text above and send it to Claude." -ForegroundColor Red; exit 1 }
git add -A
git commit -q -m "Powered by Massed footer on every screen"
git push
if ($LASTEXITCODE -eq 0) { Write-Host "Pushed - Vercel is deploying it now." -ForegroundColor Green }
Write-Host ""; Write-Host "Done. Start the app with: npm run dev" -ForegroundColor Green
