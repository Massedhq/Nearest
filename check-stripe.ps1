# Nearest - check the Stripe secret key in .env.local (shows only the first characters).
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
npm run stripe:check
