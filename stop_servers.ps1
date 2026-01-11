# 実行中のサーバーを停止するスクリプト

Write-Host "実行中のPythonプロセスを停止します..." -ForegroundColor Yellow

# ポート8000と8501を使用しているプロセスを確認
$fastapiProcess = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
$streamlitProcess = Get-NetTCPConnection -LocalPort 8501 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique

if ($fastapiProcess) {
    Write-Host "FastAPIサーバー (PID: $fastapiProcess) を停止中..." -ForegroundColor Yellow
    Stop-Process -Id $fastapiProcess -Force -ErrorAction SilentlyContinue
    Write-Host "✓ FastAPIサーバーを停止しました" -ForegroundColor Green
} else {
    Write-Host "FastAPIサーバーは実行されていません" -ForegroundColor Gray
}

if ($streamlitProcess) {
    Write-Host "Streamlitアプリ (PID: $streamlitProcess) を停止中..." -ForegroundColor Yellow
    Stop-Process -Id $streamlitProcess -Force -ErrorAction SilentlyContinue
    Write-Host "✓ Streamlitアプリを停止しました" -ForegroundColor Green
} else {
    Write-Host "Streamlitアプリは実行されていません" -ForegroundColor Gray
}

# 残っているPythonプロセスを確認
$remainingPython = Get-Process | Where-Object {$_.ProcessName -like "*python*"} | Where-Object {$_.Id -ne $PID}
if ($remainingPython) {
    Write-Host ""
    Write-Host "残っているPythonプロセス:" -ForegroundColor Yellow
    $remainingPython | Format-Table Id, ProcessName, Path -AutoSize
    Write-Host "これらも停止しますか？ (Y/N)" -ForegroundColor Yellow
    $response = Read-Host
    if ($response -eq "Y" -or $response -eq "y") {
        $remainingPython | Stop-Process -Force
        Write-Host "✓ すべてのPythonプロセスを停止しました" -ForegroundColor Green
    }
} else {
    Write-Host ""
    Write-Host "✓ すべてのサーバーを停止しました" -ForegroundColor Green
}
