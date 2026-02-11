# dev2 (server) - start dev stack
# Usage: from law-review dir, run .\scripts\dev2-up.ps1
# Access: https://dev.juristutor-ai.com when behind main proxy

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

if (Test-Path Env:CADDYFILE_DEV_PATH) { Remove-Item Env:CADDYFILE_DEV_PATH }
$env:DEV_ENV_FILE = ".env.dev2"
docker compose --profile dev up -d

Write-Host ""
Write-Host "dev2 started." -ForegroundColor Green
Write-Host "Standalone: http://<server-ip>:8081 or https://<server-ip>:8444" -ForegroundColor Gray
Write-Host "Via main proxy: https://dev.juristutor-ai.com" -ForegroundColor Gray
Write-Host "Check status: docker compose --profile dev ps" -ForegroundColor Gray
