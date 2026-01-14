# FastAPIサーバーとNext.jsアプリを起動するPowerShellスクリプト（ログファイル出力版）

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# ログディレクトリを作成
$logDir = Join-Path $scriptPath "logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

$fastapiLog = Join-Path $logDir "fastapi.log"
$nextjsLog = Join-Path $logDir "nextjs.log"

Write-Host "FastAPIサーバーとNext.jsアプリを起動します..." -ForegroundColor Green
Write-Host "ログファイル:" -ForegroundColor Cyan
Write-Host "  FastAPI: $fastapiLog" -ForegroundColor Cyan
Write-Host "  Next.js: $nextjsLog" -ForegroundColor Cyan
Write-Host ""

# 既存のログファイルをクリア
if (Test-Path $fastapiLog) {
    Clear-Content $fastapiLog
}
if (Test-Path $nextjsLog) {
    Clear-Content $nextjsLog
}

# FastAPIサーバーをバックグラウンドで起動（ログファイルに出力）
Write-Host "FastAPIサーバーを起動中..." -ForegroundColor Yellow
$fastapiJob = Start-Job -ScriptBlock {
    param($path, $logFile)
    Set-Location $path
    python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 *> $logFile
} -ArgumentList $scriptPath, $fastapiLog

# Next.jsアプリをバックグラウンドで起動（ログファイルに出力）
Start-Sleep -Seconds 3
Write-Host "Next.jsアプリを起動中..." -ForegroundColor Yellow
$nextjsJob = Start-Job -ScriptBlock {
    param($path, $logFile)
    Set-Location (Join-Path $path "web_next")
    npm run dev *> $logFile
} -ArgumentList $scriptPath, $nextjsLog

# サーバーの起動を待つ
Start-Sleep -Seconds 5

# サーバーの状態を確認
$fastapiRunning = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
$nextjsRunning = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue

if ($fastapiRunning) {
    Write-Host "✓ FastAPIサーバー: http://127.0.0.1:8000" -ForegroundColor Green
} else {
    Write-Host "✗ FastAPIサーバーの起動に失敗しました" -ForegroundColor Red
    Write-Host "  ログを確認: Get-Content $fastapiLog -Tail 20" -ForegroundColor Yellow
}

if ($nextjsRunning) {
    Write-Host "✓ Next.jsアプリ: http://localhost:3000" -ForegroundColor Green
} else {
    Write-Host "✗ Next.jsアプリの起動に失敗しました" -ForegroundColor Red
    Write-Host "  ログを確認: Get-Content $nextjsLog -Tail 20" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "ログを確認するコマンド:" -ForegroundColor Cyan
Write-Host "  FastAPI: Get-Content $fastapiLog -Tail 50 -Wait" -ForegroundColor Cyan
Write-Host "  Next.js: Get-Content $nextjsLog -Tail 50 -Wait" -ForegroundColor Cyan
Write-Host ""
Write-Host "サーバーを停止するには、このウィンドウを閉じるか、Ctrl+Cを押してください。" -ForegroundColor Cyan
Write-Host ""

# ジョブの状態を監視
try {
    while ($true) {
        Start-Sleep -Seconds 10
        
        # ジョブが失敗していないか確認
        $fastapiState = Get-Job -Id $fastapiJob.Id -ErrorAction SilentlyContinue | Select-Object -ExpandProperty State
        $nextjsState = Get-Job -Id $nextjsJob.Id -ErrorAction SilentlyContinue | Select-Object -ExpandProperty State
        
        if ($fastapiState -eq "Failed") {
            Write-Host "FastAPI server stopped. Check logs." -ForegroundColor Red
            Write-Host "Get-Content $fastapiLog -Tail 50" -ForegroundColor Yellow
        }
        
        if ($nextjsState -eq "Failed") {
            Write-Host "Next.js app stopped. Check logs." -ForegroundColor Red
            Write-Host "Get-Content $nextjsLog -Tail 50" -ForegroundColor Yellow
        }
    }
} finally {
    # Cleanup
    Write-Host "Stopping servers..." -ForegroundColor Yellow
    Stop-Job -Id $fastapiJob.Id -ErrorAction SilentlyContinue
    Stop-Job -Id $nextjsJob.Id -ErrorAction SilentlyContinue
    Remove-Job -Id $fastapiJob.Id -ErrorAction SilentlyContinue
    Remove-Job -Id $nextjsJob.Id -ErrorAction SilentlyContinue
}
