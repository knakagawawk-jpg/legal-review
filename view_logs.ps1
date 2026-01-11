# ログファイルを表示するスクリプト

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$logDir = Join-Path $scriptPath "logs"

$fastapiLog = Join-Path $logDir "fastapi.log"
$streamlitLog = Join-Path $logDir "streamlit.log"

Write-Host "=== ログファイル表示 ===" -ForegroundColor Green
Write-Host ""

if ($args[0] -eq "fastapi") {
    if (Test-Path $fastapiLog) {
        Write-Host "FastAPIログ (最新50行):" -ForegroundColor Cyan
        Write-Host "---" -ForegroundColor Gray
        Get-Content $fastapiLog -Tail 50
    } else {
        Write-Host "FastAPIログファイルが見つかりません: $fastapiLog" -ForegroundColor Red
    }
} elseif ($args[0] -eq "streamlit") {
    if (Test-Path $streamlitLog) {
        Write-Host "Streamlitログ (最新50行):" -ForegroundColor Cyan
        Write-Host "---" -ForegroundColor Gray
        Get-Content $streamlitLog -Tail 50
    } else {
        Write-Host "Streamlitログファイルが見つかりません: $streamlitLog" -ForegroundColor Red
    }
} else {
    Write-Host "使用方法:" -ForegroundColor Yellow
    Write-Host "  .\view_logs.ps1 fastapi    - FastAPIログを表示" -ForegroundColor White
    Write-Host "  .\view_logs.ps1 streamlit - Streamlitログを表示" -ForegroundColor White
    Write-Host ""
    Write-Host "両方のログを表示:" -ForegroundColor Yellow
    Write-Host "  .\view_logs.ps1 all" -ForegroundColor White
    Write-Host ""
    
    if ($args[0] -eq "all") {
        Write-Host "=== FastAPIログ ===" -ForegroundColor Cyan
        if (Test-Path $fastapiLog) {
            Get-Content $fastapiLog -Tail 50
        } else {
            Write-Host "ログファイルが見つかりません" -ForegroundColor Red
        }
        Write-Host ""
        Write-Host "=== Streamlitログ ===" -ForegroundColor Cyan
        if (Test-Path $streamlitLog) {
            Get-Content $streamlitLog -Tail 50
        } else {
            Write-Host "ログファイルが見つかりません" -ForegroundColor Red
        }
    }
}
