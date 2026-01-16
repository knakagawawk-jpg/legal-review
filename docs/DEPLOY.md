# デプロイガイド

このドキュメントでは、law-reviewアプリケーションをDocker Compose + Caddyでデプロイする手順を説明します。

## 前提条件

- Docker 20.10以上
- Docker Compose 2.0以上
- ドメイン名（本番環境の場合、例: `law-review.example.com`）

## ローカル開発環境での起動

### 前提条件の確認

```bash
# DockerとDocker Composeがインストールされているか確認
docker --version
docker compose version

# バージョン例:
# Docker version 24.0.0 以上
# Docker Compose version 2.20.0 以上
```

### 1. リポジトリのクローン（既に完了している場合はスキップ）

```bash
git clone <repository-url>
cd law-review
```

### 2. 環境変数ファイルの作成

```bash
cp .env.example .env
```

`.env` ファイルを編集して、必要な値を設定してください：

```bash
# 必須: Anthropic APIキー
ANTHROPIC_API_KEY=sk-ant-api03-...

# 推奨: モデル選択
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# データベース（デフォルトのままでもOK）
DATABASE_URL=sqlite:////data/dev.db

# API URL（デフォルトのままでもOK）
API_BASE_URL=http://backend:8000
```

### 3. データディレクトリの準備

```bash
# 既存のdev.dbがある場合は、data/ディレクトリに移動
mkdir -p data
if [ -f dev.db ]; then
    cp dev.db data/dev.db
fi
```

### 4. Docker Composeで起動

```bash
docker compose up -d --build
```

### 5. 起動確認

#### ログを確認

```bash
# 全てのサービスのログを確認
docker compose logs -f

# 特定のサービスのログを確認
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f proxy
```

#### ブラウザでアクセス

- **ローカル開発**: http://localhost
- プロキシ経由でStreamlit UIが表示されるはずです

#### 動作確認（詳細）

1. **コンテナの状態確認**
   ```bash
   docker compose ps
   ```
   すべてのコンテナが `Up` 状態であることを確認

2. **Streamlit UIが表示されること**
   - ブラウザで http://localhost にアクセス
   - サイドバーに「📝 講評生成」などのメニューが表示される
   - エラーメッセージが表示されない

3. **FastAPIへの接続確認**
   ```bash
   # backendのヘルスチェック
   docker compose exec backend curl http://localhost:8000/health
   
   # frontendからbackendに接続できるか確認
   docker compose exec frontend curl http://backend:8000/health
   ```

4. **講評生成のテスト**
   - Streamlitの「講評生成」ページを開く
   - 問題を選択（または新規入力）
   - 答案を入力
   - 「講評を生成」ボタンをクリック
   - ローディング表示が出て、エラーが発生しない
   - 講評が正常に生成され、結果ページに遷移する

5. **データベースの永続化確認**
   ```bash
   # データベースファイルが作成されているか確認
   ls -la data/dev.db
   
   # コンテナを停止して再起動
   docker compose down
   docker compose up -d
   
   # データが保持されているか確認（同じsubmission_idでアクセスできるか）
   ```

### 6. サービスの停止

```bash
docker compose down
```

データは `./data/dev.db` に保存されているため、コンテナを停止してもデータは保持されます。

---

## Ubuntu (VPS) でのデプロイ手順

### 1. サーバーにSSH接続

```bash
ssh user@your-server-ip
```

### 2. Docker と Docker Compose のインストール

```bash
# システムパッケージの更新
sudo apt update
sudo apt upgrade -y

# Dockerのインストール
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 現在のユーザーをdockerグループに追加
sudo usermod -aG docker $USER

# ログアウトして再ログインするか、以下のコマンドを実行
newgrp docker

# Docker Composeのインストール（Docker Desktopを使用する場合は不要）
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# バージョン確認
docker --version
docker compose version
```

### 3. Gitのインストール（未インストールの場合）

```bash
sudo apt install git -y
```

### 4. リポジトリのクローン

```bash
# 適切なディレクトリに移動（例: /opt または /home/user）
cd /opt  # または cd ~

# リポジトリをクローン
git clone <repository-url> law-review
cd law-review
```

### 5. 環境変数ファイルの作成

```bash
# .env.exampleをコピー
cp .env.example .env

# .envファイルを編集（nanoまたはvimを使用）
nano .env
```

`.env` ファイルに以下の値を設定：

```bash
# 必須: Anthropic APIキー
ANTHROPIC_API_KEY=sk-ant-api03-...

# データベース（デフォルトでOK）
DATABASE_URL=sqlite:////data/dev.db

# API URL（デフォルトでOK）
API_BASE_URL=http://backend:8000

# その他の設定（必要に応じて）
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

### 6. データディレクトリの準備

```bash
# dataディレクトリを作成
mkdir -p data

# 既存のデータベースがある場合はコピー
# （初回デプロイの場合はスキップ）
# cp /path/to/existing/dev.db data/dev.db

# バックアップディレクトリも作成
mkdir -p backups
```

### 7. Caddyfileの設定（本番環境用）

```bash
nano Caddyfile
```

ドメインを設定（例: `law-review.example.com`）：

```caddyfile
law-review.example.com {
    reverse_proxy frontend:8501
    
    # 将来Basic認証を追加する場合の例（現在は無効化）
    # basicauth {
    #     username JDJhJDE0JE9nS0RXUUNmZGRuUG4yVnhvVGdX
    #     password JDJhJDE0JE9nS0RXUUNmZGRuUG4yVnhvVGdX
    # }
}
```

**注意**: ローカル開発用の `:80` 設定はコメントアウトしてください。

### 8. Docker Composeで起動

```bash
# ビルドして起動
docker compose up -d --build

# ログを確認
docker compose logs -f
```

### 9. 起動確認

```bash
# コンテナの状態を確認
docker compose ps

# 各サービスのログを確認
docker compose logs backend
docker compose logs frontend
docker compose logs proxy

# ネットワーク接続を確認
docker compose exec backend ping -c 3 frontend
docker compose exec frontend ping -c 3 backend
```

### 10. ファイアウォール設定（UFW使用時）

```bash
# UFWがインストールされている場合
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp  # HTTP/3用（オプション）

# ファイアウォールの状態を確認
sudo ufw status
```

### 11. DNS設定

DNSプロバイダーで以下のAレコードを設定：

```
タイプ: A
名前: law-review (または @ でルートドメイン)
値: <サーバーのIPアドレス>
TTL: 300（5分、またはデフォルト値）
```

### 12. HTTPS証明書の自動取得

Caddyが自動でLet's Encryptから証明書を取得します。

初回アクセス時に証明書が自動発行されます。証明書は `caddy_data` ボリュームに保存され、自動更新されます。

証明書の状態を確認：

```bash
docker compose exec proxy ls -la /data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/
```

---

## 日常的な運用

### ログの確認

```bash
# 全サービスのログ
docker compose logs -f

# 特定のサービスのログ（最新100行）
docker compose logs --tail=100 backend

# エラーログのみ
docker compose logs | grep -i error
```

### サービスの再起動

```bash
# 全サービスを再起動
docker compose restart

# 特定のサービスだけ再起動
docker compose restart backend
docker compose restart frontend
docker compose restart proxy
```

### アプリケーションの更新

```bash
# リポジトリから最新のコードを取得
git pull

# 新しいコードでビルドして再起動
docker compose up -d --build

# 古いイメージを削除（オプション）
docker image prune -f
```

### データベースのバックアップ

```bash
# 手動でバックアップを実行
./scripts/backup_sqlite.sh

# バックアップファイルの確認
ls -lh backups/
```

### 自動バックアップ（cron設定）

```bash
# crontabを編集
crontab -e

# 毎日午前2時にバックアップを実行する例
0 2 * * * cd /opt/law-review && ./scripts/backup_sqlite.sh >> /var/log/law-review-backup.log 2>&1
```

**注意**: `backup_sqlite.sh` に実行権限を付与：

```bash
chmod +x scripts/backup_sqlite.sh
```

### ストレージ使用量の確認

```bash
# データベースファイルのサイズ確認
du -h data/dev.db

# バックアップディレクトリのサイズ確認
du -sh backups/

# Dockerボリュームの使用量確認
docker system df
```

### パフォーマンスの監視

```bash
# コンテナのリソース使用状況を確認
docker stats

# 特定のコンテナの詳細情報
docker inspect law-review-backend
```

---

## トラブルシューティング

### コンテナが起動しない

```bash
# ログを確認
docker compose logs

# コンテナの状態を確認
docker compose ps -a

# コンテナを削除して再作成
docker compose down
docker compose up -d --build
```

### FastAPIに接続できない

```bash
# backendコンテナ内からテスト
docker compose exec backend curl http://localhost:8000/health

# frontendコンテナ内からbackendに接続テスト
docker compose exec frontend curl http://backend:8000/health

# ネットワークの確認
docker network inspect law-review_law-review-network
```

### Streamlitが表示されない

```bash
# frontendコンテナのログを確認
docker compose logs frontend

# frontendコンテナ内からテスト
docker compose exec frontend curl http://localhost:8501

# proxyコンテナのログを確認
docker compose logs proxy
```

### HTTPS証明書が発行されない

```bash
# Caddyのログを確認
docker compose logs proxy | grep -i certificate

# ドメインのDNS設定を確認
nslookup law-review.example.com

# Caddyfileの設定を確認
cat Caddyfile

# Caddyの設定をリロード
docker compose restart proxy
```

### データベースエラー

```bash
# データベースファイルの権限を確認
ls -la data/dev.db

# データベースファイルの整合性を確認（sqlite3がインストールされている場合）
sqlite3 data/dev.db "PRAGMA integrity_check;"

# データベースファイルをバックアップしてから削除（注意: データが消えます）
cp data/dev.db data/dev.db.backup
rm data/dev.db
```

### メモリ不足エラー

```bash
# 使用中のメモリを確認
free -h

# Dockerのメモリ使用量を確認
docker stats --no-stream

# 不要なイメージやコンテナを削除
docker system prune -a
```

---

## セキュリティのベストプラクティス

1. **環境変数の保護**
   - `.env` ファイルは絶対にGitにコミットしない
   - サーバー上で適切な権限を設定: `chmod 600 .env`

2. **ファイアウォール**
   - 必要最小限のポート（80, 443）のみ開放
   - SSHのポートは変更するか、鍵認証のみ使用

3. **定期的な更新**
   - Dockerイメージとベースイメージを定期的に更新
   - 依存関係を最新のセキュリティパッチに更新

4. **バックアップ**
   - データベースを定期的にバックアップ
   - バックアップファイルは別の場所にも保存

5. **ログの監視**
   - エラーログを定期的に確認
   - 異常なアクセスパターンを監視

---

## 参考情報

- [Docker公式ドキュメント](https://docs.docker.com/)
- [Docker Compose公式ドキュメント](https://docs.docker.com/compose/)
- [Caddy公式ドキュメント](https://caddyserver.com/docs/)
- [Let's Encrypt](https://letsencrypt.org/)
