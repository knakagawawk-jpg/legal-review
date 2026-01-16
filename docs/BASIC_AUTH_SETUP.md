# Basic認証セットアップガイド

このガイドでは、Caddyfile.productionのBasic認証を実運用できるように設定する手順を説明します。

## 1. パスワードハッシュの生成

Basic認証を有効化するには、パスワードのハッシュ値が必要です。以下のいずれかの方法でパスワードハッシュを生成してください。

### 方法1: Dockerコンテナ内でCaddyコマンドを使用（推奨）

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

### 方法2: ローカルにCaddyをインストールして使用

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

## 2. 環境変数の設定

生成したパスワードハッシュを `.env` ファイルに設定します。

### .env.example に追加する項目

`.env.example` ファイルに以下を追加してください：

```bash
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
```

**実際の .env ファイルで設定する場合:**

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

## 3. Caddyfile.productionの生成（環境変数から自動生成）

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

## 4. 本番起動手順（Caddyfile.productionを使用）

### 4-1. docker-compose.ymlの設定確認

`docker-compose.yml` の `proxy` サービスは、デフォルトで `Caddyfile.production` を使用するように設定されています。

**確認方法:**
```bash
# docker-compose.ymlのproxyサービスを確認
grep -A 10 "proxy:" docker-compose.yml | grep -A 5 "volumes:"
```

**期待される出力:**
```yaml
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

### 4-2. productionプロファイルで起動

```bash
# productionプロファイルで起動（自動的にCaddyfile.productionを使用）
docker compose --profile production up -d --build

# ログを確認
docker compose logs -f proxy
```

**重要:** 
- `docker-compose.yml` の `proxy` サービスは、デフォルトで `Caddyfile.production` を使用するように設定されています
- ローカル開発用の `proxy-local` サービスは、引き続き `./Caddyfile` を使用します（`--profile local` を使用）

### 4-3. 起動確認

```bash
# コンテナの状態を確認
docker compose ps

# 使用されるCaddyfileを確認（proxyコンテナ内）
docker compose exec proxy cat /etc/caddy/Caddyfile

# または、ローカルのCaddyfile.productionを確認
cat Caddyfile.production
```

## 5. Basic認証の動作確認

1. ブラウザで `https://your-domain.com` にアクセス
2. ユーザー名とパスワードの入力画面が表示されることを確認
3. 正しいユーザー名（`.env` で設定した `BASIC_AUTH_USER` の値）とパスワード（ハッシュ生成時に使用した元のパスワード）を入力
4. 認証成功後、Next.js UIが表示されることを確認

**トラブルシューティング:**
- 認証画面が表示されない場合:
  - `Caddyfile.production` の `basicauth` セクションが正しく有効化されているか確認
  - `docker compose logs proxy` でエラーログを確認
  - `docker compose exec proxy caddy validate --config /etc/caddy/Caddyfile` でCaddyfileの構文を確認

- 認証に失敗する場合:
  - `.env` ファイルの `BASIC_AUTH_USER` と `BASIC_AUTH_PASS_HASH` が正しく設定されているか確認
  - パスワードハッシュに余分な空白や改行が含まれていないか確認
  - パスワードハッシュを再生成して再設定

## 6. Basic認証を無効化する場合

### 方法1: 環境変数を変更（推奨）

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

### 方法2: Caddyfile.productionを手動で編集

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

## まとめ

1. **パスワードハッシュの生成**: `docker run --rm caddy:2-alpine caddy hash-password --plaintext "your-password"`
2. **環境変数の設定**: `.env` ファイルに `ENABLE_BASIC_AUTH=true`, `BASIC_AUTH_USER`, `BASIC_AUTH_PASS_HASH` を設定
3. **Caddyfile.productionの生成**: `./scripts/generate-caddyfile.sh` を実行
4. **本番起動**: `docker compose --profile production up -d --build`（自動的にCaddyfile.productionを使用）

詳細は `DEPLOY_PRODUCTION.md` の「13. Basic認証の有効化」セクションを参照してください。
