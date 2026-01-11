# サーバー再起動ガイド

## Cursor 内の PowerShell で再起動する方法

### 方法 1: スクリプトを使用（推奨）

```powershell
# プロジェクトディレクトリに移動
cd C:\Users\tvxqt\.shihou-zyuken2601\law-review

# サーバーを停止
.\stop_servers.ps1

# サーバーを再起動（ログファイルに出力）
.\start_servers_with_logs.ps1
```

### 方法 2: 手動で再起動

```powershell
# プロジェクトディレクトリに移動
cd C:\Users\tvxqt\.shihou-zyuken2601\law-review

# 1. 実行中のサーバーを停止
Get-Process | Where-Object {$_.ProcessName -like "*python*"} | Stop-Process -Force

# 2. FastAPIサーバーを起動（バックグラウンド）
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 *> logs\fastapi.log"

# 3. Streamlitアプリを起動（バックグラウンド）
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; python -m streamlit run web.py *> logs\streamlit.log"
```

### 方法 3: 1 行コマンドで再起動

```powershell
cd C:\Users\tvxqt\.shihou-zyuken2601\law-review; .\stop_servers.ps1; Start-Sleep -Seconds 2; .\start_servers_with_logs.ps1
```

## サーバーの状態確認

```powershell
# ポートを使用しているプロセスを確認
Get-NetTCPConnection -LocalPort 8000,8501 -ErrorAction SilentlyContinue | Select-Object LocalPort, State, OwningProcess

# ログファイルを確認
Get-Content logs\fastapi.log -Tail 20
Get-Content logs\streamlit.log -Tail 20
```

## トラブルシューティング

### サーバーが起動しない場合

1. **ポートが使用中か確認:**

   ```powershell
   Get-NetTCPConnection -LocalPort 8000,8501 -ErrorAction SilentlyContinue
   ```

2. **Python プロセスをすべて停止:**

   ```powershell
   Get-Process | Where-Object {$_.ProcessName -like "*python*"} | Stop-Process -Force
   ```

3. **ログファイルを確認:**
   ```powershell
   Get-Content logs\fastapi.log -Tail 50
   Get-Content logs\streamlit.log -Tail 50
   ```

### .env ファイルの変更を反映する場合

`.env`ファイルを変更した後は、**必ずサーバーを再起動**してください。`.env`ファイルの変更は、サーバー起動時にのみ読み込まれます。

```powershell
# 1. サーバーを停止
.\stop_servers.ps1

# 2. サーバーを再起動
.\start_servers_with_logs.ps1
```

## 便利なエイリアス（オプション）

PowerShell プロファイルにエイリアスを追加すると、より簡単に再起動できます：

```powershell
# PowerShellプロファイルを開く
notepad $PROFILE

# 以下のエイリアスを追加
function Restart-LawReviewServers {
    cd C:\Users\tvxqt\.shihou-zyuken2601\law-review
    .\stop_servers.ps1
    Start-Sleep -Seconds 2
    .\start_servers_with_logs.ps1
}

# 使用例
Restart-LawReviewServers
```
