# 本番環境（ステージング）デプロイ手順書

このドキュメントは、Ubuntu VPSへlaw-reviewアプリケーションをデプロイする手順を、初心者向けにコピペ可能なコマンドで説明します。

## 前提条件

- Ubuntu 20.04 以上のVPS
- SSHアクセス権限
- ルート権限またはsudo権限
- ドメイン名（例: `law-review.example.com`）

---

## 1. VPS準備（Docker導入）

### 1-1. サーバーにSSH接続

```bash
ssh user@your-server-ip
```

### 1-2. システムパッケージの更新

```bash
sudo apt update
sudo apt upgrade -y
```

### 1-3. Docker のインストール

```bash
# Dockerのインストールスクリプトをダウンロードして実行
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 現在のユーザーをdockerグループに追加（sudoなしでdockerコマンドを使えるように）
sudo usermod -aG docker $USER

# グループの変更を反映（ログアウト・ログインでも可）
newgrp docker

# Dockerのバージョン確認
docker --version
```

**期待される出力例:**
```
Docker version 24.0.0 以上
```

### 1-4. Gitのインストール（未インストールの場合）

```bash
sudo apt install git -y
```

### 1-5. ファイアウォール設定（UFW使用時）

```bash
# UFWが有効になっているか確認
sudo ufw status

# UFWが無効の場合は有効化
sudo ufw --force enable

# 必要なポートのみ開放（SSH、HTTP、HTTPS）
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 443/udp   # HTTP/3用（オプション）

# ファイアウォールの状態を確認
sudo ufw status
```

**期待される出力例:**
```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
443/udp                    ALLOW       Anywhere
```

---

## 2. リポジトリのクローン

### 2-1. プロジェクトディレクトリの作成

```bash
# 適切なディレクトリに移動（例: /opt または /home/user）
cd /opt

# リポジトリをクローン（<repository-url>を実際のURLに置き換え）
git clone <repository-url> law-review

# プロジェクトディレクトリに移動
cd law-review
```

**注意**: `<repository-url>` は実際のリポジトリURLに置き換えてください。

### 2-2. ディレクトリ構造の確認

```bash
# 必要なファイルが存在するか確認
ls -la docker-compose.yml
ls -la Caddyfile.production
ls -la .env.example
ls -la scripts/backup_sqlite.sh
```

---

## 3. 環境変数ファイル（.env）の作成

### 3-1. .envファイルの作成

```bash
# .env.exampleをコピー
cp .env.example .env

# .envファイルを編集
nano .env
```

### 3-2. .envファイルの設定値

以下の内容を`.env`ファイルに設定してください（`nano`エディタを使用する場合、`Ctrl+O`で保存、`Ctrl+X`で終了）：

```bash
# === 必須設定 ===

# Anthropic APIキー（必須）
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# データベースURL（Docker環境では/data/dev.dbを使用）
DATABASE_URL=sqlite:////data/dev.db

# FastAPIのベースURL（Docker環境ではbackend:8000を使用）
API_BASE_URL=http://backend:8000

# Next.js用（FastAPIへの内部接続URL）
BACKEND_INTERNAL_URL=http://backend:8000

# Next.js用（講評生成のタイムアウト、ミリ秒、デフォルト: 240000 = 240秒）
REVIEW_TIMEOUT_MS=240000

# === 推奨設定 ===

# 使用するClaudeモデル（高性能・バランス型を推奨）
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# === 本番環境用設定（必要に応じて） ===

# ドメイン名（CaddyでHTTPS証明書を取得するために必要）
CADDY_DOMAIN=law-review.example.com

# === Basic認証設定（任意、後で有効化可能） ===

# Basic認証の有効化（true で有効化）
ENABLE_BASIC_AUTH=false

# Basic認証のユーザー名
BASIC_AUTH_USER=admin

# Basic認証のパスワードハッシュ（パスワードそのものではなく、ハッシュ値を設定）
# ハッシュ値の生成方法:
#   docker run --rm caddy:2-alpine caddy hash-password --plaintext "your-password"
# 詳細は DEPLOY_PRODUCTION.md の「13. Basic認証の有効化」セクションを参照してください。
BASIC_AUTH_PASS_HASH=

# === その他の設定（デフォルトでOK） ===

AUTH_ENABLED=false
SECRET_KEY=change-this-secret-key-in-production-use-long-random-string
```

**重要な注意点:**
- `ANTHROPIC_API_KEY` は必ず設定してください（実際のAPIキーに置き換え）
- `CADDY_DOMAIN` は使用するドメイン名に置き換えてください（例: `law-review.example.com`）

### 3-3. .envファイルの権限設定（セキュリティ）

```bash
# .envファイルの権限を制限（所有者のみ読み書き可能）
chmod 600 .env

# 権限の確認
ls -la .env
```

**期待される出力例:**
```
-rw------- 1 user user ... .env
```

---

## 4. データディレクトリの準備

### 4-1. データディレクトリの作成

```bash
# dataディレクトリを作成（SQLiteデータベースを保存）
mkdir -p data

# バックアップディレクトリも作成
mkdir -p backups

# ディレクトリの確認
ls -ld data backups
```

### 4-2. 既存のデータベースがある場合の移行

```bash
# 既存のdev.dbがある場合、data/ディレクトリにコピー
# （初回デプロイの場合はスキップ）
if [ -f dev.db ]; then
    cp dev.db data/dev.db
    echo "既存のデータベースをコピーしました"
fi
```

---

## 5. Caddyfileの設定（本番環境用）

### 5-1. Caddyfile.productionの確認

```bash
# 本番環境用Caddyfileの内容を確認
cat Caddyfile.production
```

### 5-2. docker-compose.ymlでCaddyfile.productionを使用する設定確認

**重要:** `docker-compose.yml` の `proxy` サービスは、デフォルトで `Caddyfile.production` を使用するように設定されています。

**設定確認:**
```bash
# docker-compose.ymlのproxyサービスのvolumes設定を確認
grep -A 5 "proxy:" docker-compose.yml | grep -A 5 "volumes:"
```

**期待される出力:**
```yaml
  proxy:
    ...
    volumes:
      - ${CADDYFILE_PATH:-./Caddyfile.production}:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
```

**説明:**
- `${CADDYFILE_PATH:-./Caddyfile.production}` は、環境変数 `CADDYFILE_PATH` が設定されている場合はその値を使用し、未設定の場合は `./Caddyfile.production` を使用します
- デフォルトで `Caddyfile.production` が使用されるため、**追加の設定は不要**です

**カスタムCaddyfileを使用する場合（オプション）:**
```bash
# 環境変数 CADDYFILE_PATH を設定してカスタムCaddyfileを使用
export CADDYFILE_PATH=./Caddyfile.custom

# docker-composeで起動
docker compose --profile production up -d --build
```

**ローカル開発用（proxy-local）:**
- `proxy-local` サービスは、引き続き `./Caddyfile` を使用します（ローカル開発用）
- 本番環境（`--profile production`）のみ `Caddyfile.production` が使用されます

### 5-3. Caddyfile.productionのドメイン設定

```bash
# Caddyfile.productionを編集
nano Caddyfile.production
```

ドメイン名を実際のドメインに置き換え（例: `law-review.example.com`）：

```caddyfile
law-review.example.com {
    reverse_proxy web:3000
    
    # Basic認証は後で有効化（現在はコメントアウト）
    # basicauth {
    #     admin JDJhJDE0JE9nS0RXUUNmZGRuUG4yVnhvVGdX
    # }
    
    # セキュリティヘッダー
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
```

**重要**: `law-review.example.com` を実際のドメイン名に置き換えてください。

---

## 6. Docker Composeで起動（本番環境）

### 6-1. productionプロファイルで起動（Caddyfile.productionを使用）

**重要:** `docker-compose.yml` の `proxy` サービスは、デフォルトで `Caddyfile.production` を使用するように設定されています（`${CADDYFILE_PATH:-./Caddyfile.production}`）。

```bash
# 本番環境用プロファイルでビルドして起動
# 自動的に Caddyfile.production が使用されます
docker compose --profile production up -d --build
```

**Caddyfile.productionの確認:**
```bash
# 使用されるCaddyfileを確認（proxyコンテナ内）
docker compose exec proxy cat /etc/caddy/Caddyfile

# または、ローカルのCaddyfile.productionを確認
cat Caddyfile.production
```

**期待される出力例:**
```
[+] Building ...
[+] Running 4/4
 ✔ Container law-review-backend       Started
 ✔ Container law-review-frontend      Started
 ✔ Container law-review-proxy         Started
```

### 6-2. 起動確認

```bash
# コンテナの状態を確認（すべて「Up」であることを確認）
docker compose ps
```

**期待される出力例:**
```
NAME                      IMAGE                    STATUS
law-review-backend        law-review-backend       Up (healthy)
law-review-frontend       law-review-frontend      Up (healthy)
law-review-proxy          caddy:2-alpine           Up (healthy)
```

**重要な確認項目:**
- すべてのコンテナが `Up` 状態であること
- `(healthy)` と表示されていること（ヘルスチェックが成功）

---

## 7. ログ確認

### 7-1. 全サービスのログを確認

```bash
# 全サービスのログをリアルタイムで確認（Ctrl+Cで終了）
docker compose logs -f
```

### 7-2. 特定のサービスのログを確認

```bash
# backendのログ（最新50行）
docker compose logs --tail=50 backend

# frontendのログ（最新50行）
docker compose logs --tail=50 frontend

# proxy（Caddy）のログ（最新50行）
docker compose logs --tail=50 proxy
```

### 7-3. エラーログの確認

```bash
# エラーログのみを確認
docker compose logs | grep -i error
```

### 7-4. ヘルスチェックの状態確認

```bash
# 各サービスのヘルスチェック状態を確認
docker compose ps --format json | grep -E '"Name"|"Health"'
```

---

## 8. 動作確認

### 8-1. サービス間の接続確認

```bash
# backendのヘルスチェック
docker compose exec backend curl -f http://localhost:8000/health

# frontendからbackendに接続できるか確認
docker compose exec frontend curl -f http://backend:8000/health

# ネットワーク接続を確認
docker compose exec backend ping -c 3 frontend
```

**期待される出力例（backendヘルスチェック）:**
```json
{"status": "ok", "auth_enabled": false}
```

### 8-2. ブラウザでのアクセス確認

1. **HTTPでアクセス（まだHTTPS証明書が発行されていない場合）:**
   - `http://your-domain.com` にアクセス
   - Streamlit UIが表示されることを確認

2. **HTTPSでアクセス（証明書が発行された後）:**
   - `https://your-domain.com` にアクセス
   - ブラウザに鍵マークが表示されることを確認

### 8-3. 講評生成のテスト

1. ブラウザで `https://your-domain.com` にアクセス
2. 「講評生成」ページを開く
3. 問題を選択（または新規入力）
4. 答案を入力
5. 「講評を生成」ボタンをクリック
6. ローディング表示が出て、エラーが発生しないことを確認
7. 講評が正常に生成され、結果ページに遷移することを確認

---

## 9. DNS設定（ドメイン取得～Aレコード設定）

### 9-1. ドメイン取得

1. **ドメイン取得サービス（例: お名前.com、ムームードメイン、Cloudflare）でドメインを取得**
   - 例: `law-review.example.com` を取得

### 9-2. VPSのIPアドレス確認

```bash
# VPSのパブリックIPアドレスを確認
curl -4 ifconfig.me

# または
hostname -I | awk '{print $1}'
```

**メモ**: このIPアドレスを控えておいてください（DNS設定で使用）

### 9-3. DNSプロバイダーでAレコード設定

**お名前.comの場合の例:**

1. お名前.comの管理画面にログイン
2. 「ドメイン」→「ネームサーバーの設定」を選択
3. 対象ドメインを選択
4. 「DNS関連機能の設定」をクリック
5. 「DNSレコード設定を利用する」を選択
6. 以下のAレコードを追加：

```
タイプ: A
名前: law-review（またはサブドメイン名、ルートドメインの場合は @）
値: <VPSのIPアドレス>（9-2で確認したIP）
TTL: 3600（またはデフォルト値）
```

7. 設定を保存

**Cloudflareの場合の例:**

1. Cloudflareのダッシュボードにログイン
2. 対象ドメインを選択
3. 「DNS」タブを選択
4. 「レコードを追加」をクリック
5. 以下の設定を入力：

```
タイプ: A
名前: law-review（またはサブドメイン名、ルートドメインの場合は @）
IPv4アドレス: <VPSのIPアドレス>（9-2で確認したIP）
プロキシ: DNS only（オレンジの雲アイコンをオフ）
TTL: Auto
```

6. 「保存」をクリック

### 9-4. DNS設定の反映確認

```bash
# DNS設定の反映を確認（数分～最大48時間かかる場合がある）
dig +short law-review.example.com

# または
nslookup law-review.example.com

# または
host law-review.example.com
```

**期待される出力例:**
```
<VPSのIPアドレス>（9-2で確認したIPと一致することを確認）
```

**重要**: DNS設定が反映されるまで数分～最大48時間かかる場合があります。反映されるまで待ってから次のステップに進んでください。

---

## 10. HTTPS証明書の自動取得（Caddy）

### 10-1. HTTPS証明書の取得確認

DNS設定が反映されたら、Caddyが自動でLet's Encrypt証明書を取得します。

```bash
# Caddyのログを確認（証明書取得のログが出る）
docker compose logs proxy | grep -i certificate

# または、リアルタイムで確認
docker compose logs -f proxy
```

**証明書取得成功のログ例:**
```
certificate obtained successfully
```

### 10-2. HTTPS証明書の取得が成功する条件

- ✅ DNSのAレコードが正しく設定されている（9-4で確認済み）
- ✅ ポート80と443が開放されている（1-5で設定済み）
- ✅ Caddyfile.productionで正しいドメイン名が設定されている（5-3で確認済み）
- ✅ ファイアウォールで80/443が開放されている（1-5で設定済み）

### 10-3. HTTPS証明書取得が失敗する場合のチェック

#### チェック1: DNS設定の確認

```bash
# DNS設定が正しく反映されているか再確認
dig +short law-review.example.com
nslookup law-review.example.com
```

#### チェック2: ポート80/443の開放確認

```bash
# ポート80/443が開いているか確認
sudo netstat -tlnp | grep -E ':80|:443'

# または
sudo ss -tlnp | grep -E ':80|:443'
```

#### チェック3: ファイアウォールの確認

```bash
# UFWの状態確認
sudo ufw status verbose

# 必要に応じて再設定
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
```

#### チェック4: Caddyのログ確認

```bash
# エラーログを確認
docker compose logs proxy | grep -i error

# 証明書取得のエラーを確認
docker compose logs proxy | grep -i "acme\|challenge\|certificate"
```

#### チェック5: Caddyfile.productionの確認

```bash
# Caddyfile.productionのドメイン名が正しいか確認
cat Caddyfile.production | grep -v "^#" | grep -v "^$"
```

**よくあるエラーと解決方法:**

1. **"acme: authorization error"**
   - DNS設定がまだ反映されていない可能性 → 9-4で再確認
   - ドメイン名が間違っている可能性 → Caddyfile.productionを再確認

2. **"connection refused"**
   - ポート80/443が閉じられている可能性 → 1-5で再設定
   - ファイアウォールでブロックされている可能性 → チェック3を実行

3. **"rate limit exceeded"**
   - Let's Encryptのレート制限に達している → 24時間待つか、別のドメインを使用

### 10-4. 証明書の永続化確認

```bash
# Caddyの証明書が永続化されているか確認
docker compose exec proxy ls -la /data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/

# ボリュームの確認
docker volume inspect law-review_caddy_data
```

---

## 11. データを絶対に消さないための確認手順

### 11-1. SQLiteデータベースの場所確認

```bash
# データベースファイルがホスト側./data/dev.dbにあることを確認
ls -lh data/dev.db

# ファイルサイズと最終更新日時を確認
stat data/dev.db
```

**期待される出力例:**
```
-rw-r--r-- 1 user user 12345K Jan 1 12:00 data/dev.db
```

### 11-2. ボリュームマウントの確認

```bash
# docker-compose.ymlで./dataがマウントされていることを確認
grep -A 5 "backend:" docker-compose.yml | grep volumes

# コンテナ内から確認
docker compose exec backend ls -la /data/dev.db
```

**期待される出力:**
```yaml
volumes:
  - ./data:/data
```

### 11-3. データが永続化されることを確認（重要テスト）

```bash
# 1. 現在のデータベースファイルのサイズを記録
ls -lh data/dev.db

# 2. コンテナを停止
docker compose --profile production down

# 3. データベースファイルが残っていることを確認（消えていない！）
ls -lh data/dev.db

# 4. コンテナを再起動
docker compose --profile production up -d

# 5. データが保持されていることを確認（同じsubmission_idでアクセスできるか）
# ブラウザで https://your-domain.com にアクセスして、以前作成した講評が表示されることを確認
```

**重要**: `docker compose down` を実行しても `data/dev.db` ファイルが消えないことを確認してください。

### 11-4. 日次バックアップの設定（cron）

#### バックアップスクリプトの実行権限を付与

```bash
# バックアップスクリプトに実行権限を付与
chmod +x scripts/backup_sqlite.sh

# スクリプトの動作確認（手動実行）
cd /opt/law-review
./scripts/backup_sqlite.sh

# バックアップファイルが作成されているか確認
ls -lh backups/
```

#### cronで日次バックアップを設定

```bash
# crontabを編集
crontab -e
```

以下の行を追加（毎日午前2時にバックアップを実行）：

```cron
# law-review SQLiteバックアップ（毎日午前2時）
0 2 * * * cd /opt/law-review && ./scripts/backup_sqlite.sh >> /var/log/law-review-backup.log 2>&1
```

**注意**: `/opt/law-review` は実際のプロジェクトディレクトリに置き換えてください。

#### cron設定の確認

```bash
# 現在のcron設定を確認
crontab -l

# cronサービスの状態確認
sudo systemctl status cron
```

#### バックアップログの確認

```bash
# バックアップログを確認（実行後に作成される）
sudo tail -f /var/log/law-review-backup.log

# または、プロジェクトディレクトリにログを出力する場合
tail -f /opt/law-review/backup.log
```

#### バックアップファイルの確認

```bash
# バックアップディレクトリの内容を確認
ls -lh backups/

# 最新のバックアップファイルを確認
ls -lht backups/ | head -5
```

### 11-5. バックアップからの復元手順（万が一のため）

```bash
# 1. バックアップファイルを確認
ls -lh backups/

# 2. 復元するバックアップファイルを選択（例: dev_20250101_020000.db.gz）
# 3. 現在のデータベースをバックアップ（念のため）
cp data/dev.db data/dev.db.backup-$(date +%Y%m%d_%H%M%S)

# 4. コンテナを停止
docker compose --profile production down

# 5. バックアップファイルを復元
# 圧縮されている場合
gunzip -c backups/dev_20250101_020000.db.gz > data/dev.db

# 圧縮されていない場合
cp backups/dev_20250101_020000.db data/dev.db

# 6. 権限を設定
chmod 644 data/dev.db

# 7. コンテナを再起動
docker compose --profile production up -d

# 8. データが復元されていることを確認
docker compose exec backend ls -la /data/dev.db
```

---

## 12. アプリケーションの更新手順（git pull → build → up）

### 12-1. 最新のコードを取得

```bash
# プロジェクトディレクトリに移動
cd /opt/law-review

# 最新のコードを取得（GitHubから）
git pull origin main

# または、ブランチ名が異なる場合
git pull origin master
```

### 12-2. 環境変数の確認

```bash
# .envファイルが最新のコードと互換性があるか確認
# .env.exampleが更新されている場合は、.envも更新が必要な場合がある
diff .env.example .env | grep "^>" | grep -v "ANTHROPIC_API_KEY"
```

### 12-3. データベースのバックアップ（更新前の必須作業）

```bash
# 更新前に必ずバックアップを取得
./scripts/backup_sqlite.sh

# バックアップが成功したことを確認
ls -lh backups/ | tail -1
```

### 12-4. Docker Composeで再ビルドして起動

```bash
# 新しいコードで再ビルドして起動
docker compose --profile production up -d --build

# ログを確認してエラーがないか確認
docker compose logs --tail=50
```

### 12-5. 動作確認

```bash
# コンテナの状態を確認
docker compose ps

# ヘルスチェックを確認
docker compose exec backend curl -f http://localhost:8000/health

# ブラウザでアクセスして動作確認
# https://your-domain.com
```

---

## 13. Basic認証の有効化手順

### 13-1. パスワードハッシュの生成

```bash
# Caddyコンテナ内でパスワードハッシュを生成
docker compose exec proxy-local caddy hash-password --plaintext your-password

# または、proxyコンテナが起動している場合
docker compose exec proxy caddy hash-password --plaintext your-password
```

**期待される出力例:**
```
JDJhJDE0JE9nS0RXUUNmZGRuUG4yVnhvVGdX
```

**メモ**: このハッシュ値を控えておいてください（次のステップで使用）

### 13-2. パスワードハッシュの生成

Basic認証を有効化するには、パスワードのハッシュ値が必要です。以下のいずれかの方法でパスワードハッシュを生成してください。

#### 方法1: Dockerコンテナ内でCaddyコマンドを使用（推奨）

```bash
# Caddyコンテナが起動している場合
docker compose exec proxy caddy hash-password --plaintext "your-password-here"

# または、一時的にCaddyコンテナを起動してハッシュを生成
docker run --rm caddy:2-alpine caddy hash-password --plaintext "your-password-here"
```

**実行例:**
```bash
$ docker run --rm caddy:2-alpine caddy hash-password --plaintext "MySecurePassword123"
JDJhJDE0JE9nS0RXUUNmZGRuUG4yVnhvTGdX
```

**出力されたハッシュ値を控えておいてください**（次のステップで使用します）

#### 方法2: ローカルにCaddyをインストールして使用

```bash
# Caddyをインストール（Ubuntu/Debianの場合）
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy

# パスワードハッシュを生成
caddy hash-password --plaintext "your-password-here"
```

### 13-3. 環境変数の設定

生成したパスワードハッシュを `.env` ファイルに設定します：

```bash
# .envファイルを編集
nano .env
```

以下の環境変数を追加または更新：

```bash
# Basic認証の有効化（true で有効化）
ENABLE_BASIC_AUTH=true

# Basic認証のユーザー名
BASIC_AUTH_USER=admin

# Basic認証のパスワードハッシュ（上記の方法で生成したハッシュ値を設定）
BASIC_AUTH_PASS_HASH=JDJhJDE0JE9nS0RXUUNmZGRuUG4yVnhvTGdX
```

**重要:**
- `BASIC_AUTH_PASS_HASH` には、パスワードそのものではなく、**ハッシュ値**を設定してください
- ハッシュ値の前後に余分な空白や改行が含まれていないことを確認してください

### 13-4. Caddyfile.productionの生成（環境変数から自動生成）

`scripts/generate-caddyfile.sh` スクリプトを使用して、環境変数から `Caddyfile.production` を自動生成します：

```bash
# スクリプトを実行可能にする（初回のみ）
chmod +x scripts/generate-caddyfile.sh

# Caddyfile.productionを生成
./scripts/generate-caddyfile.sh
```

**出力例:**
```
✓ Caddyfile.productionを生成しました:
  - ドメイン: law-review.example.com
  - Basic認証: true
  - ユーザー名: admin
```

生成された `Caddyfile.production` の内容を確認：

```bash
cat Caddyfile.production
```

**期待される出力（Basic認証が有効化されている場合）:**
```caddyfile
# 本番環境用Caddyfile（自動生成）
# 生成日時: 2024-01-15 10:30:00
# ドメイン: law-review.example.com
# Basic認証: true

law-review.example.com {
    # Next.js（新UI）にリバースプロキシ
    reverse_proxy web:3000
    
    # Basic認証（環境変数から有効化）
    basicauth {
        admin JDJhJDE0JE9nS0RXUUNmZGRuUG4yVnhvTGdX
    }
    
    # セキュリティヘッダー
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
```

### 13-5. 手動でCaddyfile.productionを編集する場合（推奨方法ではない）

環境変数を使わずに手動で編集する場合：

```bash
# Caddyfile.productionを編集
nano Caddyfile.production
```

`basicauth` セクションのコメントを解除し、パスワードハッシュを設定：

```caddyfile
law-review.example.com {
    reverse_proxy web:3000
    
    # Basic認証を有効化
    basicauth {
        admin JDJhJDE0JE9nS0RXUUNmZGRuUG4yVnhvVGdX
    }
    
    # セキュリティヘッダー
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
```

**変更点:**
- `# basicauth {` → `basicauth {`（コメント解除）
- `#     admin ...` → `admin JDJhJDE0JE9nS0RXUUNmZGRuUG4yVnhvTGdX`（実際のハッシュ値に置き換え）
- `# }` → `}`（コメント解除）

### 13-3. Caddyの設定をリロード

```bash
# Caddyの設定をリロード（コンテナを再起動しなくても設定を反映）
docker compose exec proxy caddy reload --config /etc/caddy/Caddyfile

# または、コンテナを再起動（確実な方法）
docker compose restart proxy

# ログを確認
docker compose logs proxy | tail -20
```

### 13-8. Docker Composeで起動（Caddyfile.productionを使用）

```bash
# productionプロファイルで起動（自動的にCaddyfile.productionを使用）
docker compose --profile production up -d --build

# ログを確認
docker compose logs -f proxy
```

**重要:** `docker-compose.yml` の `proxy` サービスは、デフォルトで `Caddyfile.production` を使用するように設定されています（`${CADDYFILE_PATH:-./Caddyfile.production}`）。

### 13-8. Basic認証の動作確認

1. ブラウザで `https://your-domain.com` にアクセス
2. ユーザー名とパスワードの入力画面が表示されることを確認
3. 正しいユーザー名（`.env` で設定した `BASIC_AUTH_USER` の値）とパスワード（ハッシュ生成時に使用した元のパスワード）を入力
4. 認証成功後、Next.js UIが表示されることを確認

**トラブルシューティング:**
- 認証画面が表示されない場合:
  - `Caddyfile.production` の `basicauth` セクションが正しくコメント解除されているか確認
  - `docker compose logs proxy` でエラーログを確認
  - `docker compose exec proxy caddy validate --config /etc/caddy/Caddyfile` でCaddyfileの構文を確認

- 認証に失敗する場合:
  - `.env` ファイルの `BASIC_AUTH_USER` と `BASIC_AUTH_PASS_HASH` が正しく設定されているか確認
  - パスワードハッシュに余分な空白や改行が含まれていないか確認
  - パスワードハッシュを再生成して再設定

### 13-9. Basic認証を無効化する場合

```bash
# Caddyfile.productionを編集
nano Caddyfile.production
```

`basicauth` セクションをコメントアウト：

#### 方法1: 環境変数を変更（推奨）

```bash
# .envファイルを編集
nano .env
```

`ENABLE_BASIC_AUTH` を `false` に変更：

```bash
ENABLE_BASIC_AUTH=false
```

`Caddyfile.production` を再生成：

```bash
./scripts/generate-caddyfile.sh
```

#### 方法2: Caddyfile.productionを手動で編集

```bash
# Caddyfile.productionを編集
nano Caddyfile.production
```

`basicauth` セクションをコメントアウト：

```caddyfile
law-review.example.com {
    # Next.js（新UI）にリバースプロキシ
    reverse_proxy web:3000
    
    # Basic認証を無効化（コメントアウト）
    # basicauth {
    #     admin JDJhJDE0JE9nS0RXUUNmZGRuUG4yVnhvTGdX
    # }
    
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
```

```bash
# Caddyの設定をリロード
docker compose restart proxy

# または、リロード（コンテナ再起動なし）
docker compose exec proxy caddy reload --config /etc/caddy/Caddyfile
```

---

## 14. 環境変数でID/PASSを管理する案（高度な方法）

### 14-1. Caddyfile.productionを環境変数対応にする

現在のCaddyfile.productionでは、環境変数の直接参照が難しいため、以下の代替案があります：

#### 案1: 起動時にCaddyfileを動的生成（推奨）

```bash
# scripts/generate-caddyfile.sh を作成
cat > scripts/generate-caddyfile.sh << 'EOF'
#!/bin/bash
# Caddyfile.productionを環境変数から動的生成

DOMAIN="${CADDY_DOMAIN:-localhost}"
ENABLE_AUTH="${ENABLE_BASIC_AUTH:-false}"
AUTH_USER="${BASIC_AUTH_USER:-admin}"
AUTH_HASH="${BASIC_AUTH_PASS_HASH:-}"

cat > Caddyfile.production <<CADDYEOF
${DOMAIN} {
    reverse_proxy web:3000
    
EOF

if [ "${ENABLE_AUTH}" = "true" ] && [ -n "${AUTH_HASH}" ]; then
    cat >> Caddyfile.production <<CADDYEOF
    basicauth {
        ${AUTH_USER} ${AUTH_HASH}
    }
    
CADDYEOF
fi

cat >> Caddyfile.production <<CADDYEOF
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
CADDYEOF

echo "Caddyfile.productionを生成しました"
EOF

chmod +x scripts/generate-caddyfile.sh
```

#### 案2: docker-compose.ymlで環境変数を渡す

`.env` ファイルに以下を追加：

```bash
# Basic認証設定
ENABLE_BASIC_AUTH=true
BASIC_AUTH_USER=admin
BASIC_AUTH_PASS_HASH=JDJhJDE0JE9nS0RXUUNmZGRuUG4yVnhvTGdX
```

起動前にスクリプトを実行：

```bash
# Caddyfile.productionを生成
./scripts/generate-caddyfile.sh

# Docker Composeで起動
docker compose --profile production up -d --build
```

**注意**: この方法では、`.env` ファイルにパスワードハッシュを保存することになります。セキュリティ上、`.env` ファイルの権限は必ず `600` に設定してください。

---

## 15. よくあるトラブルシューティング

### 15-1. コンテナが起動しない

```bash
# ログを確認
docker compose logs

# コンテナの状態を確認
docker compose ps -a

# コンテナを削除して再作成
docker compose --profile production down
docker compose --profile production up -d --build
```

### 15-2. ポートが既に使用されている

```bash
# ポート80/443を使用しているプロセスを確認
sudo netstat -tlnp | grep -E ':80|:443'

# プロセスを終了（必要に応じて）
sudo kill -9 <PID>
```

### 15-3. データベースエラー

```bash
# データベースファイルの権限を確認
ls -la data/dev.db

# 権限を修正（必要に応じて）
chmod 644 data/dev.db

# データベースの整合性を確認（sqlite3がインストールされている場合）
sqlite3 data/dev.db "PRAGMA integrity_check;"
```

### 15-4. メモリ不足エラー

```bash
# 使用中のメモリを確認
free -h

# Dockerのメモリ使用量を確認
docker stats --no-stream

# 不要なイメージやコンテナを削除
docker system prune -a
```

---

## 16. 日常的な運用コマンド集

### 16-1. サービスの起動・停止

```bash
# 起動
docker compose --profile production up -d

# 停止（データは保持される）
docker compose --profile production down

# 再起動
docker compose --profile production restart
```

### 16-2. ログの確認

```bash
# 全サービスのログ
docker compose logs -f

# 特定のサービスのログ
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f proxy

# 最新100行のみ
docker compose logs --tail=100
```

### 16-3. コンテナの状態確認

```bash
# コンテナの状態とヘルスチェック
docker compose ps

# リソース使用量
docker stats

# ネットワークの確認
docker network inspect law-review_law-review-network
```

### 16-4. データベースのバックアップ

```bash
# 手動でバックアップを取得
cd /opt/law-review
./scripts/backup_sqlite.sh

# バックアップファイルの確認
ls -lh backups/
```

---

## まとめチェックリスト

デプロイ完了後、以下の項目を確認してください：

- [ ] Docker と Docker Compose がインストールされている
- [ ] ファイアウォールで80/443が開放されている
- [ ] `.env` ファイルが正しく設定されている（ANTHROPIC_API_KEYなど）
- [ ] `data/` ディレクトリが作成されている
- [ ] `docker-compose.yml` で `Caddyfile.production` が使用されている
- [ ] `Caddyfile.production` で正しいドメイン名が設定されている
- [ ] DNSのAレコードが正しく設定されている
- [ ] コンテナがすべて `Up (healthy)` 状態である
- [ ] HTTPS証明書が正常に取得されている
- [ ] `https://your-domain.com` でアクセスできる
- [ ] 講評生成が正常に動作する
- [ ] データベースが `./data/dev.db` に永続化されている
- [ ] `docker compose down` してもデータが消えないことを確認済み
- [ ] 日次バックアップのcron設定が完了している
- [ ] Basic認証が有効化されている（必要に応じて）

---

## 参考リンク

- [Docker公式ドキュメント](https://docs.docker.com/)
- [Docker Compose公式ドキュメント](https://docs.docker.com/compose/)
- [Caddy公式ドキュメント](https://caddyserver.com/docs/)
- [Let's Encrypt](https://letsencrypt.org/)
