# FastAPIサーバーとStreamlitアプリを起動するPowerShellスクリプト

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

Write-Host "FastAPIサーバーとStreamlitアプリを起動します..." -ForegroundColor Green
Write-Host ""

# FastAPIサーバーをバックグラウンドで起動
Write-Host "FastAPIサーバーを起動中..." -ForegroundColor Yellow
$fastapiJob = Start-Job -ScriptBlock {
    Set-Location $using:scriptPath
    python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
}

# Streamlitアプリをバックグラウンドで起動
Start-Sleep -Seconds 3
Write-Host "Streamlitアプリを起動中..." -ForegroundColor Yellow
$streamlitJob = Start-Job -ScriptBlock {
    Set-Location $using:scriptPath
    python -m streamlit run web.py
}

# サーバーの起動を待つ
Start-Sleep -Seconds 5

# サーバーの状態を確認
$fastapiRunning = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
$streamlitRunning = Get-NetTCPConnection -LocalPort 8501 -ErrorAction SilentlyContinue

if ($fastapiRunning) {
    Write-Host "✓ FastAPIサーバー: http://127.0.0.1:8000" -ForegroundColor Green
} else {
    Write-Host "✗ FastAPIサーバーの起動に失敗しました" -ForegroundColor Red
}

if ($streamlitRunning) {
    Write-Host "✓ Streamlitアプリ: http://localhost:8501" -ForegroundColor Green
} else {
    Write-Host "✗ Streamlitアプリの起動に失敗しました" -ForegroundColor Red
}

Write-Host ""
Write-Host "サーバーを停止するには、このウィンドウを閉じるか、Ctrl+Cを押してください。" -ForegroundColor Cyan
Write-Host ""

# ジョブの状態を監視
try {
    while ($true) {
        Start-Sleep -Seconds 10
        
        # ジョブが失敗していないか確認
        $fastapiState = Get-Job -Id $fastapiJob.Id | Select-Object -ExpandProperty State
        $streamlitState = Get-Job -Id $streamlitJob.Id | Select-Object -ExpandProperty State
        
        if ($fastapiState -eq "Failed") {
            Write-Host "FastAPIサーバーが停止しました。ログを確認してください。" -ForegroundColor Red
            Receive-Job -Id $fastapiJob.Id
        }
        
        if ($streamlitState -eq "Failed") {
            Write-Host "Streamlitアプリが停止しました。ログを確認してください。" -ForegroundColor Red
            Receive-Job -Id $streamlitJob.Id
        }
    }
} finally {
    # クリーンアップ
    Write-Host "サーバーを停止しています..." -ForegroundColor Yellow
    Stop-Job -Id $fastapiJob.Id -ErrorAction SilentlyContinue
    Stop-Job -Id $streamlitJob.Id -ErrorAction SilentlyContinue
    Remove-Job -Id $fastapiJob.Id -ErrorAction SilentlyContinue
    Remove-Job -Id $streamlitJob.Id -ErrorAction SilentlyContinue
}
