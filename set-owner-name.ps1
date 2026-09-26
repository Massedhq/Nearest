# Nearest - put your real name back on your owner login (database + Clerk).
#   powershell -ExecutionPolicy Bypass -File .\set-owner-name.ps1
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
$email = Read-Host "Your owner email (for example avy@usenearest.com)"
$first = Read-Host "First name"
$last = Read-Host "Last name"
npx tsx scripts/set-owner-name.ts $email.Trim() $first.Trim() $last.Trim()
