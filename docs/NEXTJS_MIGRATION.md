# Next.js移行ガイド

## 概要

law-reviewアプリケーションのフロントエンドをStreamlitからNext.js（React）に移行しました。

- **新UI**: Next.js（`/web_next`）- 現在のメインUI
- **旧UI**: Streamlit（`/streamlit_app` + `web.py`）- 移行期間中のみ利用可能（廃止予定）

## アーキテクチャ

### BFF（Backend For Frontend）パターン

- ブラウザからFastAPIへ直接アクセスさせない（CORSやキー流出を避けるため）
- Next.js側に `/api/*` のRoute Handlerを実装し、そこから内部ネットワークでFastAPIへリクエスト
- フロントのfetchは常に同一オリジンの `/api/*` を叩く
- Docker内では Next.js -> backend:8000 に通信

### サービス構成

- **backend**: FastAPI（ポート8000、内部ネットワークのみ）
- **web**: Next.js（ポート3000、内部ネットワークのみ、proxy経由でアクセス）
- **proxy**: Caddy（ポート80/443、web:3000にreverse_proxy）
- **frontend**: Streamlit（移行期間中のみ、legacyプロファイルで起動可能）

## ローカル起動

```bash
# 環境変数ファイルの準備
cp .env.example .env
# .envファイルを編集してANTHROPIC_API_KEYを設定

# Docker Composeで起動（localプロファイル）
docker compose --profile local up -d --build

# アクセス
# http://localhost:8080
```

## 本番起動

```bash
# Docker Composeで起動（productionプロファイル）
docker compose --profile production up -d --build

# アクセス
# https://your-domain.com
```

## 環境変数

`.env` ファイルに以下を設定：

```bash
# Backend用
ANTHROPIC_API_KEY=sk-ant-api03-...
DATABASE_URL=sqlite:////data/dev.db

# Next.js用（FastAPIへの内部接続URL）
BACKEND_INTERNAL_URL=http://backend:8000

# Next.js用（講評生成のタイムアウト、ミリ秒、デフォルト: 240000 = 240秒）
REVIEW_TIMEOUT_MS=240000

# その他
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

## 実装済み機能

### ページ

- `/review` - 講評生成ページ（3ステップUI）
- `/review/[id]` - 講評結果ページ

### API Route Handlers

- `POST /api/review` - 講評を生成（FastAPI `/v1/review` へ転送）
- `GET /api/review/[id]` - 講評を取得（FastAPI `/v1/review/{id}` へ転送）
- `GET /api/problems/metadata` - 問題メタデータ一覧
- `GET /api/problems/metadata/[id]` - 問題メタデータと詳細
- `GET /api/problems/subjects` - 科目一覧

## 未実装機能（TODO）

以下の機能はStreamlit版にのみ存在し、Next.js版では未実装です：

- 短答式試験ページ
- マイページ
- フリーチャット
- 認証機能

これらは後で実装予定です。

## 技術スタック

- **Next.js 14.2.5** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui** (Radix UIベースのコンポーネント)
- **React Markdown** (講評のMarkdown表示)

## UIデザイン

- SaaS風の洗練されたUI
- 余白広め、タイポ階層明確
- 角丸12px程度
- アクセント紫 #667eea
