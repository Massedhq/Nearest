# Nearest - student sign-up finishes even if Clerk requires a username. Run from the project folder:
#   powershell -ExecutionPolicy Bypass -File .\update-student-username.ps1
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "STOPPED: the build failed. Copy the red text above and send it to Claude." -ForegroundColor Red; exit 1 }
git add -A
git commit -q -m "Student sign-up: auto-create a username if Clerk requires one; show only missing fields"
git push
if ($LASTEXITCODE -eq 0) { Write-Host "Pushed - Vercel is deploying it now." -ForegroundColor Green }
