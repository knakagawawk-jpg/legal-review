# Docker Compose環境変数設定ガイド

## 📋 Docker Composeで必要な環境変数

Docker Composeを使用する場合、**プロジェクトルートの`.env`ファイル**（`law-review/.env`）に以下を設定します。

## 🔧 設定内容

### `law-review/.env`ファイルの内容

```env
# ============================================
# 認証設定
# ============================================
AUTH_ENABLED=true
GOOGLE_CLIENT_ID=あなたの実際のクライアントID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=あなたの実際のクライアントシークレット
SECRET_KEY=適当な長い文字列（本番環境では必ず変更）

# ============================================
# バックエンド設定
# ============================================
BACKEND_INTERNAL_URL=http://backend:8000
# 注意: Docker Composeでは localhost ではなく backend（コンテナ名）を使用

# ============================================
# フロントエンド設定（Next.js用）
# ============================================
NEXT_PUBLIC_GOOGLE_CLIENT_ID=あなたの実際のクライアントID.apps.googleusercontent.com
# 注意: GOOGLE_CLIENT_ID と同じ値である必要があります

# ============================================
# Anthropic API設定
# ============================================
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_MODEL=claude-haiku-4-5-20251001

# ============================================
# データベース設定
# ============================================
DATABASE_URL=sqlite:////data/dev.db
```

## ⚠️ 重要な違い

### `web_next/.env.local`との違い

| 項目 | `web_next/.env.local`<br>（ローカル開発用） | `law-review/.env`<br>（Docker Compose用） |
|------|-------------------------------------------|-------------------------------------------|
| `BACKEND_INTERNAL_URL` | `http://localhost:8000` | `http://backend:8000` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | 必要 | 必要（`docker-compose.yml`に追加が必要） |

### なぜ`http://backend:8000`なのか

Docker Composeでは、コンテナ間通信でサービス名（コンテナ名）を使用します：

```
┌─────────────────────────────────────┐
│  Docker Network                     │
│                                     │
│  ┌─────────────┐  ┌──────────────┐ │
│  │ webコンテナ  │  │backendコンテナ│ │
│  │ (Next.js)   │──│ (FastAPI)    │ │
│  │             │  │ :8000        │ │
│  └─────────────┘  └──────────────┘ │
│        │                  │         │
│        └──────────────────┘         │
│     http://backend:8000             │
│     ↑ サービス名を使用              │
└─────────────────────────────────────┘
```

## 🔧 `docker-compose.yml`の更新が必要

現在、`docker-compose.yml`の`web`サービスに`NEXT_PUBLIC_GOOGLE_CLIENT_ID`が設定されていないため、追加が必要です。

### 現在の設定（`docker-compose.yml`）

```yaml
web:
  environment:
    - BACKEND_INTERNAL_URL=${BACKEND_INTERNAL_URL:-http://backend:8000}
    - REVIEW_TIMEOUT_MS=${REVIEW_TIMEOUT_MS:-600000}
    - NODE_ENV=production
    # NEXT_PUBLIC_GOOGLE_CLIENT_ID が不足している
```

### 追加が必要な設定

```yaml
web:
  environment:
    - BACKEND_INTERNAL_URL=${BACKEND_INTERNAL_URL:-http://backend:8000}
    - REVIEW_TIMEOUT_MS=${REVIEW_TIMEOUT_MS:-600000}
    - NODE_ENV=production
    - NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}  # 追加
```

## 📝 手順まとめ

### Step 1: `law-review/.env`ファイルを作成

```env
AUTH_ENABLED=true
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
SECRET_KEY=xxx
BACKEND_INTERNAL_URL=http://backend:8000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
ANTHROPIC_API_KEY=sk-ant-api03-...
DATABASE_URL=sqlite:////data/dev.db
```

### Step 2: `docker-compose.yml`を更新（`NEXT_PUBLIC_GOOGLE_CLIENT_ID`を追加）

```yaml
web:
  environment:
    - BACKEND_INTERNAL_URL=${BACKEND_INTERNAL_URL:-http://backend:8000}
    - NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}  # 追加
    - REVIEW_TIMEOUT_MS=${REVIEW_TIMEOUT_MS:-600000}
    - NODE_ENV=production
```

### Step 3: Docker Composeで起動

```bash
docker compose --profile local up --build
```

## ✅ 確認事項

1. ✅ `BACKEND_INTERNAL_URL`は`http://backend:8000`（`localhost`ではない）
2. ✅ `NEXT_PUBLIC_GOOGLE_CLIENT_ID`と`GOOGLE_CLIENT_ID`は同じ値
3. ✅ `docker-compose.yml`に`NEXT_PUBLIC_GOOGLE_CLIENT_ID`が追加されている

## 📊 まとめ

**単純に`web_next/.env.local`の内容をコピーするのではなく：**

1. `BACKEND_INTERNAL_URL`を`http://backend:8000`に変更
2. `docker-compose.yml`に`NEXT_PUBLIC_GOOGLE_CLIENT_ID`を追加
3. バックエンド用の環境変数（`AUTH_ENABLED`, `GOOGLE_CLIENT_ID`など）も追加
