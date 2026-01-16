# Docker デプロイ チェックリスト

このドキュメントは、Docker Composeでアプリケーションを起動するためのチェックリストです。

## 作成されたファイル一覧

✅ **必須ファイル**
- [x] `app/Dockerfile` - FastAPIバックエンド用
- [x] `Dockerfile.streamlit` - Streamlitフロントエンド用
- [x] `docker-compose.yml` - Docker Compose設定
- [x] `Caddyfile` - Caddy（リバースプロキシ）設定
- [x] `.env.example` - 環境変数のテンプレート
- [x] `.dockerignore` - Dockerビルドから除外するファイル
- [x] `DEPLOY.md` - デプロイ手順の詳細ドキュメント
- [x] `scripts/backup_sqlite.sh` - SQLiteバックアップスクリプト

✅ **修正されたファイル**
- [x] `app/db.py` - DATABASE_URLを環境変数から取得するように修正
- [x] `.gitignore` - `data/dev.db`、`backups/`、`.env`を追加

## クイックスタート（3ステップ）

### ステップ1: 環境変数ファイルの作成

```bash
# .env.exampleをコピー
cp .env.example .env

# .envファイルを編集して、Anthropic APIキーを設定
# Windows (PowerShell)
notepad .env

# Linux/Mac
nano .env
```

**最低限設定が必要:**
```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
```

### ステップ2: データディレクトリの準備

```bash
# 既存のdev.dbがある場合は、data/ディレクトリに移動
mkdir -p data
if [ -f dev.db ]; then
    cp dev.db data/dev.db
fi
```

**Windows (PowerShell):**
```powershell
if (-not (Test-Path data)) { New-Item -ItemType Directory -Path data }
if (Test-Path dev.db) { Copy-Item dev.db data/dev.db }
```

### ステップ3: Docker Composeで起動

```bash
docker compose up -d --build
```

## 起動確認（必須チェック項目）

### 1. コンテナの状態確認

```bash
docker compose ps
```

**期待される出力:**
```
NAME                      STATUS
law-review-backend        Up
law-review-frontend       Up
law-review-proxy          Up
```

すべてのコンテナが `Up` 状態であることを確認。

### 2. ログの確認（エラーがないか）

```bash
# 全サービスのログを確認
docker compose logs --tail=50

# エラーがないか確認
docker compose logs | grep -i error
```

**確認ポイント:**
- FastAPI: "Uvicorn running on http://0.0.0.0:8000"
- Streamlit: "You can now view your Streamlit app"
- Caddy: エラーメッセージがないこと

### 3. ブラウザでアクセス

- **URL**: http://localhost
- **期待**: Streamlit UIが表示される
- **確認**: サイドバーに「📝 講評生成」などのメニューが表示される

### 4. FastAPIへの接続確認

```bash
# backendコンテナ内からテスト
docker compose exec backend curl http://localhost:8000/health

# frontendコンテナ内からbackendに接続テスト
docker compose exec frontend curl http://backend:8000/health
```

**期待される出力:**
```json
{"status": "ok"}
```

### 5. 講評生成のテスト

1. ブラウザで http://localhost にアクセス
2. 「講評生成」ページを開く
3. 問題を選択（または新規入力）
4. 答案を入力（例: "テスト答案です"）
5. 「講評を生成」ボタンをクリック
6. **確認項目:**
   - ローディング表示が出る
   - エラーが発生しない
   - 講評が生成される
   - 結果ページに遷移する

### 6. データベースの永続化確認

```bash
# データベースファイルが作成されているか確認
ls -la data/dev.db

# ファイルサイズを確認（0バイトでなければOK）
du -h data/dev.db
```

**Windows (PowerShell):**
```powershell
Get-Item data\dev.db | Select-Object Name, Length, LastWriteTime
```

## トラブルシューティング

### エラー: "Cannot connect to Docker daemon"

**原因**: Dockerが起動していない

**解決方法:**
- Docker Desktopを起動する（Windows/Mac）
- Linux: `sudo systemctl start docker`

### エラー: "port is already allocated"

**原因**: ポート80または443が既に使用されている

**解決方法:**
```bash
# 使用中のポートを確認
# Windows (PowerShell)
Get-NetTCPConnection -LocalPort 80,443

# Linux
sudo lsof -i :80
sudo lsof -i :443

# 競合するサービスを停止するか、docker-compose.ymlのポート番号を変更
```

### エラー: "ANTHROPIC_API_KEY is not set"

**原因**: `.env` ファイルが作成されていない、またはAPIキーが設定されていない

**解決方法:**
```bash
# .envファイルが存在するか確認
ls -la .env

# .envファイルの内容を確認（APIキーが設定されているか）
cat .env | grep ANTHROPIC_API_KEY

# 設定されていない場合は編集
nano .env  # または notepad .env
```

### エラー: "database is locked"

**原因**: SQLiteデータベースファイルの権限または複数のプロセスからのアクセス

**解決方法:**
```bash
# データベースファイルの権限を確認
ls -la data/dev.db

# 権限を修正（必要に応じて）
chmod 666 data/dev.db

# コンテナを再起動
docker compose restart backend
```

### Streamlitが表示されない

**確認項目:**
1. frontendコンテナが起動しているか: `docker compose ps frontend`
2. frontendのログにエラーがないか: `docker compose logs frontend`
3. proxyコンテナが起動しているか: `docker compose ps proxy`
4. Caddyfileが正しいか: `cat Caddyfile`

**解決方法:**
```bash
# コンテナを再起動
docker compose restart frontend proxy

# ログを確認
docker compose logs -f frontend proxy
```

## よくある質問

### Q: データベースはどこに保存されますか？

A: `./data/dev.db` に保存されます。このディレクトリはボリュームマウントされているため、コンテナを削除してもデータは保持されます。

### Q: 既存のdev.dbをDocker環境で使いたい

A: `dev.db` を `data/dev.db` にコピーしてください：
```bash
cp dev.db data/dev.db
```

### Q: ポート番号を変更できますか？

A: `docker-compose.yml` の `proxy` サービスの `ports` セクションを編集してください。例: `"8080:80"` に変更すると、http://localhost:8080 でアクセスできます。

### Q: ローカル開発ではHTTPSは不要ですか？

A: はい、ローカル開発ではHTTPで問題ありません。本番環境でドメインを設定すると、Caddyが自動でHTTPS証明書を取得します。

### Q: バックアップスクリプトはどう実行しますか？

A: 
```bash
# 実行権限を付与
chmod +x scripts/backup_sqlite.sh

# 実行
./scripts/backup_sqlite.sh

# または、Dockerコンテナから実行
docker compose exec backend bash -c "cd /app && bash scripts/backup_sqlite.sh"
```

## 次のステップ

1. ✅ ローカルで動作確認が完了したら
2. 📖 `DEPLOY.md` を参照して、本番環境（Ubuntu VPS）へのデプロイ手順を確認
3. 🌐 ドメインを設定してHTTPSを有効化
4. 🔄 自動バックアップのcron設定
5. 📊 ログ監視とパフォーマンス監視の設定
