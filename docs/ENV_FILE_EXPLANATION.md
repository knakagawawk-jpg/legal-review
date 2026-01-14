# 環境変数ファイル（.env）の説明

## 📁 プロジェクトルートとは

**プロジェクトルート** = `law-review/` ディレクトリ

```
law-review/                    ← これがプロジェクトルート
├── .env                       ← プロジェクトルートの.envファイル（Docker Compose用）
├── docker-compose.yml
├── app/
├── web_next/
│   └── .env.local            ← フロントエンド用の.envファイル（ローカル開発用）
└── ...
```

## 🔍 2つの`.env`ファイルの違い

### 1. プロジェクトルートの`.env`ファイル

**パス:** `law-review/.env`

**用途:**
- Docker Composeが自動的に読み込む環境変数ファイル
- バックエンド（FastAPI）とフロントエンド（Next.js）の両方のコンテナで使用される

**Docker Composeでの使用例:**
```yaml
# docker-compose.yml
web:
  environment:
    - BACKEND_INTERNAL_URL=${BACKEND_INTERNAL_URL:-http://backend:8000}
    # ↑ この${BACKEND_INTERNAL_URL}は、プロジェクトルートの.envファイルから読み込まれる
```

**設定例:**
```env
# law-review/.env
AUTH_ENABLED=true
GOOGLE_CLIENT_ID=あなたのクライアントID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=あなたのクライアントシークレット
SECRET_KEY=適当な長い文字列
ANTHROPIC_API_KEY=sk-ant-api03-...
BACKEND_INTERNAL_URL=http://backend:8000
```

### 2. フロントエンドの`.env.local`ファイル

**パス:** `law-review/web_next/.env.local`

**用途:**
- Next.jsアプリがローカル開発環境（`npm run dev`）で使用する環境変数ファイル
- Docker Composeでは使用されない

**設定例:**
```env
# law-review/web_next/.env.local
NEXT_PUBLIC_GOOGLE_CLIENT_ID=あなたのクライアントID.apps.googleusercontent.com
BACKEND_INTERNAL_URL=http://localhost:8000
```

## 📊 使い分けの表

| 環境 | 使用するファイル | 場所 | 用途 |
|------|----------------|------|------|
| **Docker Compose** | `.env` | `law-review/.env` | Docker Composeが自動的に読み込む |
| **ローカル開発**<br>（`npm run dev`） | `.env.local` | `law-review/web_next/.env.local` | Next.jsが自動的に読み込む |

## 🎯 具体的な例

### Docker Composeを使用する場合

1. **プロジェクトルートに`.env`ファイルを作成**
   ```
   law-review/.env
   ```

2. **内容を設定**
   ```env
   AUTH_ENABLED=true
   GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=xxx
   BACKEND_INTERNAL_URL=http://backend:8000
   ```

3. **Docker Composeで起動**
   ```bash
   docker compose --profile local up
   ```
   → Docker Composeが自動的に`.env`ファイルを読み込む

### ローカル開発（`npm run dev`）の場合

1. **`web_next`ディレクトリに`.env.local`ファイルを作成**
   ```
   law-review/web_next/.env.local
   ```

2. **内容を設定**
   ```env
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
   BACKEND_INTERNAL_URL=http://localhost:8000
   ```

3. **Next.jsを起動**
   ```bash
   cd web_next
   npm run dev
   ```
   → Next.jsが自動的に`.env.local`ファイルを読み込む

## ⚠️ 重要なポイント

1. **Docker Composeでは`.env.local`は使用されない**
   - Docker Composeはプロジェクトルートの`.env`ファイルのみを読み込む
   - `web_next/.env.local`は無視される

2. **`.env`ファイルはGitにコミットしない**
   - `.gitignore`に`.env`が含まれているため、自動的に除外される
   - 機密情報（APIキーなど）を含むため

3. **環境変数の読み込み順序（Docker Compose）**
   ```
   1. プロジェクトルートの.envファイル
   2. シェルの環境変数
   3. docker-compose.ymlのデフォルト値（${変数:-デフォルト値}）
   ```

## 📝 まとめ

**「プロジェクトルートの.envファイル」= `law-review/.env`**

- Docker Composeが自動的に読み込む
- バックエンドとフロントエンドの両方のコンテナで使用される
- `web_next/.env.local`とは別物
