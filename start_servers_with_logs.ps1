# FastAPIサーバーとStreamlitアプリを起動するPowerShellスクリプト（ログファイル出力版）

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# ログディレクトリを作成
$logDir = Join-Path $scriptPath "logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

$fastapiLog = Join-Path $logDir "fastapi.log"
$streamlitLog = Join-Path $logDir "streamlit.log"

Write-Host "FastAPIサーバーとStreamlitアプリを起動します..." -ForegroundColor Green
Write-Host "ログファイル:" -ForegroundColor Cyan
Write-Host "  FastAPI: $fastapiLog" -ForegroundColor Cyan
Write-Host "  Streamlit: $streamlitLog" -ForegroundColor Cyan
Write-Host ""

# 既存のログファイルをクリア
if (Test-Path $fastapiLog) {
    Clear-Content $fastapiLog
}
if (Test-Path $streamlitLog) {
    Clear-Content $streamlitLog
}

# FastAPIサーバーをバックグラウンドで起動（ログファイルに出力）
Write-Host "FastAPIサーバーを起動中..." -ForegroundColor Yellow
$fastapiJob = Start-Job -ScriptBlock {
    param($path, $logFile)
    Set-Location $path
    python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 *> $logFile
} -ArgumentList $scriptPath, $fastapiLog

# Streamlitアプリをバックグラウンドで起動（ログファイルに出力）
Start-Sleep -Seconds 3
Write-Host "Streamlitアプリを起動中..." -ForegroundColor Yellow
$streamlitJob = Start-Job -ScriptBlock {
    param($path, $logFile)
    Set-Location $path
    python -m streamlit run web.py *> $logFile
} -ArgumentList $scriptPath, $streamlitLog

# サーバーの起動を待つ
Start-Sleep -Seconds 5

# サーバーの状態を確認
$fastapiRunning = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
$streamlitRunning = Get-NetTCPConnection -LocalPort 8501 -ErrorAction SilentlyContinue

if ($fastapiRunning) {
    Write-Host "✓ FastAPIサーバー: http://127.0.0.1:8000" -ForegroundColor Green
} else {
    Write-Host "✗ FastAPIサーバーの起動に失敗しました" -ForegroundColor Red
    Write-Host "  ログを確認: Get-Content $fastapiLog -Tail 20" -ForegroundColor Yellow
}

if ($streamlitRunning) {
    Write-Host "✓ Streamlitアプリ: http://localhost:8501" -ForegroundColor Green
} else {
    Write-Host "✗ Streamlitアプリの起動に失敗しました" -ForegroundColor Red
    Write-Host "  ログを確認: Get-Content $streamlitLog -Tail 20" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "ログを確認するコマンド:" -ForegroundColor Cyan
Write-Host "  FastAPI: Get-Content $fastapiLog -Tail 50 -Wait" -ForegroundColor Cyan
Write-Host "  Streamlit: Get-Content $streamlitLog -Tail 50 -Wait" -ForegroundColor Cyan
Write-Host ""
Write-Host "サーバーを停止するには、このウィンドウを閉じるか、Ctrl+Cを押してください。" -ForegroundColor Cyan
Write-Host ""

# ジョブの状態を監視
try {
    while ($true) {
        Start-Sleep -Seconds 10
        
        # ジョブが失敗していないか確認
        $fastapiState = Get-Job -Id $fastapiJob.Id -ErrorAction SilentlyContinue | Select-Object -ExpandProperty State
        $streamlitState = Get-Job -Id $streamlitJob.Id -ErrorAction SilentlyContinue | Select-Object -ExpandProperty State
        
        if ($fastapiState -eq "Failed") {
            Write-Host "FastAPI server stopped. Check logs." -ForegroundColor Red
            Write-Host "Get-Content $fastapiLog -Tail 50" -ForegroundColor Yellow
        }
        
        if ($streamlitState -eq "Failed") {
            Write-Host "Streamlit app stopped. Check logs." -ForegroundColor Red
            Write-Host "Get-Content $streamlitLog -Tail 50" -ForegroundColor Yellow
        }
    }
} finally {
    # Cleanup
    Write-Host "Stopping servers..." -ForegroundColor Yellow
    Stop-Job -Id $fastapiJob.Id -ErrorAction SilentlyContinue
    Stop-Job -Id $streamlitJob.Id -ErrorAction SilentlyContinue
    Remove-Job -Id $fastapiJob.Id -ErrorAction SilentlyContinue
    Remove-Job -Id $streamlitJob.Id -ErrorAction SilentlyContinue
}
