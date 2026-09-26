# Nearest - repair owner accounts right now (works against your live database).
#   powershell -ExecutionPolicy Bypass -File .\fix-owners.ps1
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
npx tsx scripts/fix-owners.ts
