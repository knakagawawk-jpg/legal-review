# 法律答案講評システム

法律答案の自動講評を生成するシステムです。LLM（Claude）を使用して答案を分析し、構造化された講評を提供します。

## 機能

- **講評生成**: 論文式答案に対して自動講評を生成
- **講評チャット**: 生成された講評について LLM に質問可能
- **短答式試験**: 短答式問題を解いて正誤を確認
- **フリーチャット**: LLM との自由な対話
- **ノート機能**: 学習ノートの作成・管理
- **ユーザーダッシュボード**: 過去の答案履歴や成績分析

## 技術スタック

- **バックエンド**: FastAPI (Python)
- **フロントエンド**: Next.js 14 (React, TypeScript)
- **データベース**: SQLite
- **LLM**: Anthropic Claude API
- **認証**: Google OAuth 2.0
- **リバースプロキシ**: Caddy

## プロジェクト構造

```
law-review/
├── app/                      # バックエンド（FastAPI）
│   ├── main.py              # APIエンドポイント定義
│   ├── models.py            # データベースモデル
│   ├── schemas.py           # Pydanticスキーマ
│   ├── llm_service.py       # LLM呼び出しサービス
│   ├── auth.py              # 認証処理
│   └── db.py                # データベース接続設定
│
├── web_next/                # フロントエンド（Next.js）
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # API Route Handlers (BFF)
│   │   ├── review/         # 講評生成ページ
│   │   ├── short-answer/  # 短答式試験ページ
│   │   ├── free-chat/      # フリーチャットページ
│   │   └── your-page/      # ユーザーページ
│   ├── components/         # Reactコンポーネント
│   ├── lib/                # ユーティリティ・APIクライアント
│   └── types/              # TypeScript型定義
│
├── config/                  # 設定ファイル
│   ├── settings.py         # アプリケーション設定
│   └── constants.py       # 定数定義
│
├── data/                    # データディレクトリ
│   ├── json/               # JSONデータ（年度別・科目別）
│   └── sample_problems.*   # サンプルデータ
│
├── docs/                    # ドキュメント
│   ├── AUTH_SETUP.md       # 認証設定ガイド
│   ├── DEPLOY.md           # デプロイ手順
│   └── ...                 # その他のドキュメント
│
├── scripts/                 # 管理用スクリプト
│   ├── *.py                # Pythonスクリプト（データ処理など）
│   ├── *.ps1               # PowerShellスクリプト（サーバー起動など）
│   └── *.sh                # Shellスクリプト
│
├── db_design/              # データベース設計
│   └── *.sql              # SQLスキーマファイル
│
├── prompts/                 # LLMプロンプト
│   ├── main/               # メインプロンプト
│   └── subjects/           # 科目別プロンプト
│
├── utils/                   # ユーティリティ関数
│   └── formatters.py      # 年度変換などのフォーマッター
│
├── archive/                 # アーカイブ（古いファイル）
│
├── docker-compose.yml      # Docker Compose設定
├── Dockerfile.*            # Dockerイメージ定義
├── Caddyfile*              # リバースプロキシ設定
└── requirements.txt         # Python依存関係
```

## セットアップ

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd law-review
```

### 2. 依存関係のインストール

#### Python（バックエンド）

```bash
pip install -r requirements.txt
```

#### Node.js（フロントエンド）

```bash
cd web_next
npm install
```

### 3. 環境変数の設定

`.env` ファイルを作成して、以下の環境変数を設定してください：

```bash
# LLM API設定
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# データベース設定
DATABASE_URL=sqlite:///./data/dev.db

# 認証設定（Google OAuth）
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# その他
NEXT_PUBLIC_API_URL=http://localhost:8000
```

詳細は [docs/AUTH_SETUP.md](./docs/AUTH_SETUP.md) と [docs/CLAUDE_API_SETUP.md](./docs/CLAUDE_API_SETUP.md) を参照してください。

### 4. データベースの初期化

```bash
python -m app.init_db
```

## API エンドポイント

### ヘルスチェック

#### `GET /api/health`

サーバーの状態を確認

**レスポンス:**

```json
{
  "status": "ok"
}
```

### 論文式問題管理

#### `GET /api/problems/metadata`

問題メタデータ一覧を取得（フィルタリング対応）

**クエリパラメータ:**

- `exam_type`: 試験種別（司法試験/予備試験）
- `year`: 年度（整数、例: 2024）
- `subject`: 科目

#### `GET /api/problems/metadata/{id}`

問題詳細を取得

### 講評生成

#### `POST /api/review`

答案の講評を生成

**リクエスト例:**

```json
{
  "problem_id": 1,
  "subject": "民法",
  "question_text": "問題文（problem_idがある場合は無視）",
  "answer_text": "答案本文"
}
```

**レスポンス例:**

```json
{
  "submission_id": 1,
  "review_markdown": "### 総評\n...",
  "review_json": {
    "score": 75,
    "strengths": ["良い点1", "良い点2"],
    "weaknesses": ["改善点1", "改善点2"],
    "next_actions": ["次にやること1", "次にやること2"]
  }
}
```

#### `POST /api/review/chat`

講評に関する質問に答える（チャット機能）

#### `GET /api/review/{id}`

講評詳細を取得

### 短答式問題管理

#### `GET /api/short-answer/problems`

短答式問題一覧を取得

**クエリパラメータ:**

- `exam_type`: 試験種別（司法試験/予備試験）
- `year`: 年度（文字列、例: "R7", "H30"）
- `subject`: 科目
- `is_random`: ランダム取得（"true"）

#### `POST /api/short-answer/sessions`

短答式セッションを作成

#### `POST /api/short-answer/answers`

回答を送信

詳細な API 仕様は http://localhost:8000/docs で確認できます。

## データベース

SQLite データベース（`data/dev.db`）に以下のテーブルが作成されます：

### 論文式問題関連

- **`problems`**: 問題情報
- **`submissions`**: 答案提出情報
- **`reviews`**: 講評情報

### 短答式問題関連

- **`short_answer_problems`**: 短答式問題情報
- **`short_answer_sessions`**: 短答式セッション情報
- **`short_answer_answers`**: 短答式回答情報

### ユーザー関連

- **`users`**: ユーザー情報
- **`user_preferences`**: ユーザー設定
- **`user_dashboard`**: ダッシュボード情報
- **`user_review_history`**: 講評履歴

### その他

- **`notebooks`**: ノートブック
- **`note_sections`**: ノートセクション
- **`note_pages`**: ノートページ
- **`threads`**: スレッド
- **`messages`**: メッセージ

詳細なスキーマは `db_design/` ディレクトリを参照してください。

## 管理者向け: 問題データの登録

### 方法 1: スクリプトから一括登録

```bash
python scripts/admin_import_problems.py data/sample_problems.json
python scripts/admin_import_problems.py data/sample_problems.csv
```

### 方法 2: API で登録

サーバー起動後、以下を実行：

**PowerShell:**

```powershell
$json = Get-Content data/sample_problems.json -Raw
Invoke-RestMethod -Uri http://localhost:8000/v1/problems/bulk -Method POST -ContentType "application/json" -Body $json
```

**curl:**

```bash
curl -X POST http://localhost:8000/v1/problems/bulk -H "Content-Type: application/json" -d @data/sample_problems.json
```

### データ形式

**JSON 形式:**

```json
[
  {
    "exam_type": "司法試験",
    "year": 2024,
    "subject": "民法",
    "question_text": "問題文",
    "scoring_notes": "採点実感",
    "purpose": "出題趣旨",
    "other_info": { "key": "value" }
  }
]
```

**CSV 形式:**

```csv
exam_type,year,subject,question_text,scoring_notes,purpose
司法試験,2024,民法,問題文,採点実感,出題趣旨
予備試験,2024,刑法,問題文,採点実感,出題趣旨
```

## デプロイ

本番環境へのデプロイ手順は [docs/DEPLOY.md](./docs/DEPLOY.md) を参照してください。

## 開発

### コードフォーマット

```bash
# Python
black app/ config/ utils/
isort app/ config/ utils/

# TypeScript/React
cd web_next
npm run lint
```

### テスト

```bash
# バックエンドテスト（実装予定）
pytest

# フロントエンドテスト（実装予定）
cd web_next
npm test
```

## トラブルシューティング

よくある問題と解決方法は `docs/` ディレクトリ内のドキュメントを参照してください：

- [認証設定ガイド](./docs/AUTH_SETUP.md)
- [環境変数設定](./docs/ENV_SETUP.md)
- [デプロイ手順](./docs/DEPLOY.md)

## ライセンス

（必要に応じて追加）

## 関連ドキュメント

- [プロジェクト概要](./docs/PROJECT_BRIEF.md)
- [認証実装詳細](./docs/AUTHENTICATION_IMPLEMENTATION.md)
- [データベース設計](./docs/DATABASE_SCHEMA.md)
