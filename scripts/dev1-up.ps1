# dev1 (local/localhost) - start dev stack
# Usage: from law-review dir, run .\scripts\dev1-up.ps1
# Access: http://localhost:8081

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$env:DEV_ENV_FILE = ".env.dev1"
$env:CADDYFILE_DEV_PATH = "./Caddyfile.dev.local"
docker compose --profile dev up -d

Write-Host ""
Write-Host "dev1 started." -ForegroundColor Green
Write-Host "  Proxy:  http://localhost:8081  (or http://127.0.0.1:8081)" -ForegroundColor Cyan
Write-Host "  Direct: http://localhost:3000  (use this if 8081 is refused)" -ForegroundColor Cyan
Write-Host "Check status: docker compose --profile dev ps" -ForegroundColor Gray
