# Docker クイックスタートガイド

このガイドでは、ローカル環境でDocker Composeを使ってアプリケーションを起動する手順を説明します。

## 前提条件

- Docker Desktop（Windows/Mac）または Docker + Docker Compose（Linux）
- Git

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

**最低限設定が必要な項目:**
```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
```

その他の設定はデフォルト値で動作します。

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

### ステップ4: アクセス確認

ブラウザで以下のURLにアクセス：

- **ローカル開発**: http://localhost
- Streamlit UIが表示されるはずです

## 動作確認

### ログの確認

```bash
# 全サービスのログ
docker compose logs -f

# 特定のサービスのログ
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f proxy
```

### コンテナの状態確認

```bash
docker compose ps
```

すべてのコンテナが `Up` 状態であることを確認してください。

### サービス間の接続確認

```bash
# backendからfrontendに接続できるか確認
docker compose exec backend ping -c 3 frontend

# frontendからbackendに接続できるか確認（API呼び出し）
docker compose exec frontend curl http://backend:8000/health
```

### 講評生成のテスト

1. ブラウザで http://localhost にアクセス
2. 「講評生成」ページを開く
3. 問題を選択（または新規入力）
4. 答案を入力
5. 「講評を生成」ボタンをクリック
6. 講評が生成され、結果ページに遷移することを確認

## トラブルシューティング

### コンテナが起動しない

```bash
# ログを確認
docker compose logs

# コンテナを削除して再作成
docker compose down
docker compose up -d --build
```

### FastAPIに接続できない

```bash
# backendコンテナ内からテスト
docker compose exec backend curl http://localhost:8000/health

# 環境変数を確認
docker compose exec backend env | grep DATABASE_URL
docker compose exec backend env | grep ANTHROPIC_API_KEY
```

### Streamlitが表示されない

```bash
# frontendコンテナのログを確認
docker compose logs frontend

# 設定ファイルを確認
docker compose exec frontend cat /root/.streamlit/config.toml
```

### データベースエラー

```bash
# データベースファイルの存在確認
ls -la data/dev.db

# データベースファイルの権限確認
docker compose exec backend ls -la /data/dev.db
```

## 停止とクリーンアップ

```bash
# コンテナを停止（データは保持される）
docker compose down

# コンテナとボリュームを削除（データも削除される）
docker compose down -v

# イメージも削除
docker compose down -v --rmi all
```

## よくある質問

### Q: データベースはどこに保存されますか？

A: `./data/dev.db` に保存されます。このディレクトリはボリュームマウントされているため、コンテナを削除してもデータは保持されます。

### Q: APIキーはどこに設定しますか？

A: `.env` ファイルに設定します。このファイルはGitにコミットされません。

### Q: ポート番号を変更できますか？

A: `docker-compose.yml` の `proxy` サービスの `ports` セクションを編集してください。ただし、Caddyfileも併せて修正する必要があります。

### Q: ローカル開発ではHTTPSは不要ですか？

A: はい、ローカル開発ではHTTPで問題ありません。本番環境でドメインを設定すると、Caddyが自動でHTTPS証明書を取得します。
