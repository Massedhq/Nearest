# Nearest - read-only check of schools in your live database (changes nothing).
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
npm run schools:check
