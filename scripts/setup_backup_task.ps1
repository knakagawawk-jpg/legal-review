# DB自動バックアップ用の Windows タスクスケジューラ登録
# 毎日 4:00（28:00）に scripts/backup_db.py を実行するタスクを作成する。
#
# 実行方法（管理者権限不要）:
#   cd law-review
#   .\scripts\setup_backup_task.ps1
#
# 事前に .env に BACKUP_ONEDRIVE_ROOT を設定しておくこと。
# タスクは「現在のユーザー」で実行される。

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$TaskName = "LawReview-DB-Backup"
$Description = "law-review DB backup (daily 4:00, weekly snapshot on Sunday)"
$ScriptPath = Join-Path $ProjectRoot "scripts\backup_db.py"

# Python のパス（py ランチャーまたは python）
$PythonExe = $null
foreach ($candidate in @("py", "python")) {
    $found = Get-Command $candidate -ErrorAction SilentlyContinue
    if ($found) {
        $PythonExe = $found.Source
        if ($candidate -eq "py") {
            # py はランチャーなので -3 で Python 3 を指定して実行する形にする
            $PythonExe = "py"
        }
        break
    }
}
if (-not $PythonExe) {
    Write-Host "エラー: Python (py または python) が見つかりません。" -ForegroundColor Red
    exit 1
}

# 実行引数: py の場合は -3 を先に、その後 script
if ($PythonExe -eq "py") {
    $Arguments = "-3 `"$ScriptPath`""
    $ExecPath = "py"
} else {
    $Arguments = "`"$ScriptPath`""
    $ExecPath = $PythonExe
}

$Action = New-ScheduledTaskAction -Execute $ExecPath -Argument $Arguments -WorkingDirectory $ProjectRoot
$Trigger = New-ScheduledTaskTrigger -Daily -At "04:00"
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
$Task = New-ScheduledTask -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Description $Description

try {
    Register-ScheduledTask -TaskName $TaskName -InputObject $Task -Force
    Write-Host "タスクを登録しました: $TaskName" -ForegroundColor Green
    Write-Host "  実行時刻: 毎日 4:00" -ForegroundColor Cyan
    Write-Host "  作業ディレクトリ: $ProjectRoot" -ForegroundColor Cyan
    Write-Host "  確認: タスクのスケジュール で「$TaskName」を表示" -ForegroundColor Gray
    Write-Host ""
    Write-Host "手動で1回実行してテスト: " -NoNewline
    Write-Host "Start-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Yellow
} catch {
    Write-Host "タスクの登録に失敗しました: $_" -ForegroundColor Red
    exit 1
}
