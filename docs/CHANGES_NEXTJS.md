# Next.js移行 - 変更内容まとめ

## 概要

StreamlitからNext.js（React）へのフロントエンド移行を実施しました。

## 作成・追加されたファイル

### Next.jsプロジェクト（/web_next）

#### 設定ファイル
- `web_next/package.json` - Next.js 14.2.5、TypeScript、Tailwind CSS、shadcn/ui
- `web_next/tsconfig.json` - TypeScript設定
- `web_next/next.config.js` - Next.js設定（standalone出力、タイムアウト対応）
- `web_next/tailwind.config.ts` - Tailwind設定（アクセント紫 #667eea、角丸12px）
- `web_next/postcss.config.js` - PostCSS設定
- `web_next/.eslintrc.json` - ESLint設定
- `web_next/.gitignore` - Next.js用gitignore

#### スタイル・レイアウト
- `web_next/app/globals.css` - グローバルスタイル（Tailwind、CSS変数）
- `web_next/app/layout.tsx` - ルートレイアウト
- `web_next/app/page.tsx` - ホームページ（/reviewにリダイレクト）

#### UIコンポーネント（shadcn/ui）
- `web_next/components/ui/button.tsx`
- `web_next/components/ui/card.tsx`
- `web_next/components/ui/badge.tsx`
- `web_next/components/ui/progress.tsx`
- `web_next/components/ui/alert.tsx`
- `web_next/components/ui/skeleton.tsx`
- `web_next/components/ui/accordion.tsx`
- `web_next/components/ui/tabs.tsx`
- `web_next/components/ui/textarea.tsx`

#### ユーティリティ
- `web_next/lib/utils.ts` - cn関数（Tailwindクラス結合）

#### 型定義
- `web_next/types/api.ts` - FastAPIスキーマに対応するTypeScript型

#### ページ
- `web_next/app/review/page.tsx` - 講評生成ページ（3ステップUI）
- `web_next/app/review/[id]/page.tsx` - 講評結果ページ

#### API Route Handlers（BFF）
- `web_next/app/api/review/route.ts` - POST /api/review（講評生成）
- `web_next/app/api/review/[id]/route.ts` - GET /api/review/[id]（講評取得）
- `web_next/app/api/problems/metadata/route.ts` - GET /api/problems/metadata（問題メタデータ一覧）
- `web_next/app/api/problems/metadata/[id]/route.ts` - GET /api/problems/metadata/[id]（問題詳細）
- `web_next/app/api/problems/subjects/route.ts` - GET /api/problems/subjects（科目一覧）
- `web_next/app/api/health/route.ts` - GET /api/health（ヘルスチェック）

### Docker関連

- `Dockerfile.nextjs` - Next.js用Dockerfile（マルチステージビルド、standalone出力）

### ドキュメント

- `NEXTJS_MIGRATION.md` - 移行ガイド
- `LOCAL_SETUP_NEXTJS.md` - ローカル起動手順

## 修正されたファイル

### Docker Compose

**`docker-compose.yml`**:
- `web`サービスを追加（Next.js、ポート3000）
- `frontend`サービスに`profiles: legacy`を追加（移行期間中のみ使用）
- `proxy`と`proxy-local`の`depends_on`を`web`に変更
- `web`サービスの環境変数: `BACKEND_INTERNAL_URL`

### Caddy設定

**`Caddyfile`**:
- `reverse_proxy frontend:8501` → `reverse_proxy web:3000`

**`Caddyfile.production`**:
- `reverse_proxy frontend:8501` → `reverse_proxy web:3000`

### その他

- `README.md` - Next.js移行の注意書きを追加
- `.gitignore` - `web_next/`関連の除外パターンを追加

## 主要な実装内容

### /review ページ（講評生成）

- **3ステップUI**: Step1（問題準備）→ Step2（答案入力）→ Step3（生成）
- **ステップインジケーター**: 現在ステップを紫で強調、完了は緑チェック、Progressバー
- **モード切替**: 既存問題選択 / 新規入力
- **既存問題選択**: 試験種別→年度→科目の段階選択、視覚的なフィルターUI
- **問題表示**: 読みやすい表示、コピーボタン、出題趣旨はAccordion
- **答案入力**: 大きめTextarea、文字数カウンター、localStorageで保持
- **生成**: ローディング表示（フェーズ表示＋Progress＋Skeleton）、150秒タイムアウト対応
- **エラー処理**: Alertで明確に表示

### /review/[id] ページ（講評結果）

- **総評**: スコア表示（Badge）、コメント表示
- **問題文・答案**: 2カラム表示
- **長所・改善点**: カテゴリ別表示、段落番号表示
- **重要なポイント**: Accordionで折りたたみ表示
- **今後の考慮事項**: リスト表示
- **詳細な講評**: Markdown形式で表示

### API Route Handlers（BFF）

- **POST /api/review**: FastAPI `/v1/review` へ転送、150秒タイムアウト
- **GET /api/review/[id]**: FastAPI `/v1/review/{id}` へ転送
- **エラー処理**: ユーザー向けメッセージに整形して返す

## ローカル起動手順（コピペ可能）

```bash
# 1. 環境変数ファイルの準備
cp .env.example .env
# .envファイルを編集してANTHROPIC_API_KEYを設定

# 2. Docker Composeで起動（localプロファイル）
docker compose --profile local up -d --build

# 3. ログ確認
docker compose logs -f web

# 4. アクセス
# http://localhost:8080
```

## 本番起動手順

```bash
# Docker Composeで起動（productionプロファイル）
docker compose --profile production up -d --build

# アクセス
# https://your-domain.com
```

## 環境変数

`.env`ファイルに以下を追加：

```bash
# Next.js用（FastAPIへの内部接続URL）
BACKEND_INTERNAL_URL=http://backend:8000
```

## 未実装機能（TODO）

以下の機能はStreamlit版にのみ存在し、Next.js版では未実装です：

- 短答式試験ページ
- マイページ
- フリーチャット
- 認証機能

これらは後で実装予定です。

## 注意事項

- Streamlit（旧UI）は`profiles: legacy`で起動可能（移行期間中のみ）
- 既存のStreamlitコードは削除していません（後で削除予定）
- Markdown表示は現在`whitespace-pre-wrap`で表示（後でreact-markdownを追加可能）
