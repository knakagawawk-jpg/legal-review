# ログ管理ガイド

PowerShellウィンドウが多すぎてエラーが見つけにくい場合、ログファイルを使用してエラーを確認できます。

## 使い方

### 1. サーバーを起動（ログファイルに出力）

```powershell
cd C:\Users\tvxqt\.shihou-zyuken2601\law-review
.\start_servers_with_logs.ps1
```

このスクリプトは：
- FastAPIサーバーとStreamlitアプリをバックグラウンドで起動
- すべての出力を`logs/fastapi.log`と`logs/streamlit.log`に保存
- PowerShellウィンドウは1つだけ開きます

### 2. ログを確認

**FastAPIログを確認:**
```powershell
.\view_logs.ps1 fastapi
```

**Streamlitログを確認:**
```powershell
.\view_logs.ps1 streamlit
```

**両方のログを確認:**
```powershell
.\view_logs.ps1 all
```

**リアルタイムでログを監視（別のPowerShellウィンドウで）:**
```powershell
# FastAPIログをリアルタイム監視
Get-Content logs\fastapi.log -Tail 50 -Wait

# Streamlitログをリアルタイム監視
Get-Content logs\streamlit.log -Tail 50 -Wait
```

### 3. サーバーを停止

```powershell
.\stop_servers.ps1
```

このスクリプトは：
- ポート8000（FastAPI）と8501（Streamlit）を使用しているプロセスを自動検出して停止
- 残っているPythonプロセスも確認して停止可能

## トラブルシューティング

### エラーが発生した場合

1. **ログファイルを確認:**
   ```powershell
   .\view_logs.ps1 all
   ```

2. **最新のエラーを確認:**
   ```powershell
   Get-Content logs\fastapi.log -Tail 100
   Get-Content logs\streamlit.log -Tail 100
   ```

3. **サーバーを再起動:**
   ```powershell
   .\stop_servers.ps1
   .\start_servers_with_logs.ps1
   ```

### ログファイルの場所

- FastAPIログ: `law-review/logs/fastapi.log`
- Streamlitログ: `law-review/logs/streamlit.log`

## 従来の方法（ウィンドウを開く方法）

従来通り、ウィンドウを開いて起動する場合は：

```powershell
.\start_servers.bat
```

この方法では、FastAPIとStreamlitがそれぞれ別のウィンドウで起動します。
