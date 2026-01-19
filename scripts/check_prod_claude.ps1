param(
  [string]$HostName = "160.16.50.238",
  [string]$UserName = "ubuntu",
  [string]$KeyPath = (Join-Path $env:USERPROFILE ".ssh\\id_ed25519_sakura"),
  [string]$RemoteDir = "/opt/law-review",
  [switch]$TestCall,
  [switch]$ShowBackendLogs,
  [switch]$FetchLlmConfig,
  [int]$LogTail = 200
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $KeyPath)) {
  Write-Error "SSH鍵が見つかりません: $KeyPath"
  exit 1
}

# backendコンテナ内で、キー有無とモデル名だけ確認（キー文字列は出さない）
$remoteCmd = (@'
cd __REMOTE_DIR__
docker compose exec -T backend sh -lc 'if [ -n "$ANTHROPIC_API_KEY" ]; then echo ANTHROPIC_API_KEY_set=true; else echo ANTHROPIC_API_KEY_set=false; fi; echo ANTHROPIC_MODEL=$ANTHROPIC_MODEL'
'@ -replace "__REMOTE_DIR__", $RemoteDir) -replace "(\r?\n)+", "; "

Write-Host "Connecting to $UserName@$HostName ..."
& ssh -i $KeyPath "$UserName@$HostName" $remoteCmd

if ($TestCall) {
  # 実際にAnthropicへ最小リクエストを投げて疎通確認（コスト最小）
  $remoteTestCmd = (@'
cd __REMOTE_DIR__
docker compose exec -T backend python -c "from anthropic import Anthropic; import os; key=os.getenv('ANTHROPIC_API_KEY'); model=os.getenv('ANTHROPIC_MODEL'); print('key_len='+str(0 if key is None else len(key))); client=Anthropic(api_key=key); msg=client.messages.create(model=model, max_tokens=1, messages=[{'role':'user','content':'ping'}]); print('anthropic_call_ok=true'); print('model='+str(model))"
'@ -replace "__REMOTE_DIR__", $RemoteDir) -replace "(\r?\n)+", "; "

  Write-Host "Testing Anthropic API call (minimal) ..."
  & ssh -i $KeyPath "$UserName@$HostName" $remoteTestCmd
}

if ($ShowBackendLogs) {
  $remoteLogsCmd = (@'
cd __REMOTE_DIR__
docker compose logs backend --tail __TAIL__
'@ -replace "__REMOTE_DIR__", $RemoteDir) -replace "__TAIL__", $LogTail -replace "(\r?\n)+", "; "

  Write-Host "Fetching backend logs (tail=$LogTail) ..."
  & ssh -i $KeyPath "$UserName@$HostName" $remoteLogsCmd
}

if ($FetchLlmConfig) {
  $remoteLlmConfigCmd = (@'
cd __REMOTE_DIR__
docker compose exec -T backend sh -lc 'curl -s http://localhost:8000/debug/llm-config'
'@ -replace "__REMOTE_DIR__", $RemoteDir) -replace "(\r?\n)+", "; "

  Write-Host "Fetching /debug/llm-config from backend ..."
  & ssh -i $KeyPath "$UserName@$HostName" $remoteLlmConfigCmd
}
