# 法律答案講評システム

法律答案の自動講評を生成するシステムです。LLM（Claude）を使用して答案を分析し、構造化された講評を提供します。

> **重要**: フロントエンドは Next.js（新 UI）に移行しました。Streamlit（旧 UI）は移行期間中のみ利用可能です（廃止予定）。
>
> - **新 UI**: Next.js - 現在のメイン UI（`/web_next`）
> - **旧 UI**: Streamlit - 移行期間中のみ（`/streamlit_app` + `web.py`）
>
> 詳細は [NEXTJS_MIGRATION.md](./NEXTJS_MIGRATION.md) を参照してください。

## 機能

- **講評生成**: 論文式答案に対して自動講評を生成
- **講評チャット**: 生成された講評について LLM に質問可能
- **短答式試験**: 短答式問題を解いて正誤を確認

## 構成

- **バックエンド**: FastAPI
- **フロントエンド**: Streamlit
- **データベース**: SQLite
- **LLM**: Anthropic Claude API（オプション）

## プロジェクト構造

```
law-review/
├── web.py                    # Streamlitアプリのエントリーポイント
├── app/                      # バックエンド（FastAPI）
│   ├── main.py              # APIエンドポイント定義
│   ├── models.py            # データベースモデル
│   ├── schemas.py           # Pydanticスキーマ
│   ├── llm_service.py       # LLM呼び出しサービス
│   └── db.py                # データベース接続設定
├── streamlit_app/            # フロントエンド（Streamlit）
│   ├── api_client.py        # API呼び出しクライアント
│   ├── config.py            # 設定（後方互換性）
│   ├── components/          # UIコンポーネント
│   │   ├── sidebar.py       # サイドバーナビゲーション
│   │   ├── filters.py       # フィルターコンポーネント
│   │   └── problem_display.py # 問題表示コンポーネント
│   └── pages/               # ページ実装
│       ├── review.py        # 講評生成ページ
│       └── short_answer.py  # 短答式試験ページ
├── config/                  # 設定ファイル
│   ├── settings.py          # アプリケーション設定
│   └── constants.py         # 定数定義
├── utils/                   # ユーティリティ関数
│   └── formatters.py        # 年度変換などのフォーマッター
├── data/                    # データディレクトリ
│   ├── pdfs/                # PDFファイル
│   │   ├── preliminary_exam/  # 予備試験
│   │   └── judicial_exam/     # 司法試験
│   └── json/                # JSONファイル
│       └── preliminary_exam/
└── scripts/                 # 管理用スクリプト
    └── rename_data_directories.py
```

## セットアップ

### 1. 依存関係のインストール

```bash
cd law-review
pip install -r requirements.txt
```

### 2. 環境変数の設定（オプション）

LLM 機能を使用する場合は、Anthropic API キーを設定してください。

#### クイックスタート

1. **Anthropic アカウントを作成**

   - https://www.anthropic.com/ にアクセス
   - アカウントを作成してログイン

2. **支払い情報の登録（必須）**

   - ⚠️ **重要**: API を使用するには**クレジットカードの登録が必要**です
   - https://console.anthropic.com/settings/billing で支払い情報を登録

3. **前払いクレジットの設定（推奨）**

   - **推奨**: 「Add credits」で前払いクレジットを追加（$5〜$100）
   - 予算管理がしやすく、予期しない高額請求を防げます
   - 「Auto reload credits」を有効にすると、残高が少なくなったら自動で追加されます
   - Tier 1 では月間最大$100 のクレジットまで使用可能（使用量に応じて Tier が上がります）
   - クレジット残高がなくなった場合、自動的に従量課金制に切り替わります

4. **API キーを取得**

   - https://console.anthropic.com/settings/keys にアクセス
   - 「Create Key」をクリックして API キーを作成
   - ⚠️ API キーは一度しか表示されないため、必ずコピーして保存してください

5. **環境変数を設定**

   **方法 1: .env ファイルを使用（推奨）**

   ```bash
   # .env.exampleをコピー
   cp .env.example .env

   # .envファイルを編集してAPIキーを設定
   ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

   **方法 2: 環境変数で直接設定**

   Windows (PowerShell):

   ```powershell
   $env:ANTHROPIC_API_KEY="sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
   ```

   Linux/Mac:

   ```bash
   export ANTHROPIC_API_KEY="sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
   ```

6. **アプリケーションを再起動**
   - 環境変数の変更を反映するため、アプリケーションを再起動してください

#### モデルの選択

デフォルトで Claude 3 Opus (`claude-3-opus-20240229`) を使用します。
別のモデルを使用する場合は、`ANTHROPIC_MODEL` 環境変数を設定してください：

- `claude-3-5-sonnet-20241022` (推奨: 高性能・バランス型)
- `claude-3-opus-20240229` (最高性能)
- `claude-3-5-haiku-20241022` (高速・低コスト)

API キーが設定されていない場合、ダミー講評が返されます。

詳細は [CLAUDE_API_SETUP.md](./CLAUDE_API_SETUP.md) を参照してください。

### 3. サーバーの起動

#### バックエンド（FastAPI）

```bash
cd law-review
uvicorn app.main:app --reload
```

デフォルトで `http://localhost:8000` で起動します。
API ドキュメントは `http://localhost:8000/docs` で確認できます。

#### フロントエンド（Streamlit）

別のターミナルで：

```bash
cd law-review
streamlit run web.py
```

デフォルトで `http://localhost:8501` で起動します。

## 使用方法

### 講評生成

1. Streamlit アプリの「講評生成」ページを開く
2. 「既存問題を選択」または「新規入力」を選択
3. 既存問題を選択する場合は、フィルター（試験種別、年度、科目）で絞り込む
4. 答案を入力
5. 「講評を生成」ボタンをクリック
6. 講評結果が表示されます
7. 講評結果の下にある「💬 講評について質問する」セクションで、LLM に追加の質問ができます

### 短答式試験

1. Streamlit アプリの「短答式試験」ページを開く
2. 試験種別、年度、科目を選択（または科目のみ選択してランダムモード）
3. 「問題を開始」ボタンをクリック
4. 問題を読んで選択肢をクリック
5. 「回答を見る」ボタンで正誤を確認
6. 「← 戻る」「次へ →」ボタンで前後の問題に移動可能

## API エンドポイント

### ヘルスチェック

#### `GET /health`

サーバーの状態を確認

**レスポンス:**

```json
{
  "status": "ok"
}
```

### 論文式問題管理

#### `GET /v1/problems`

問題一覧を取得（フィルタリング対応）

**クエリパラメータ:**

- `exam_type`: 試験種別（司法試験/予備試験）
- `year`: 年度（整数、例: 2024）
- `subject`: 科目

**レスポンス例:**

```json
{
  "problems": [
    {
      "id": 1,
      "exam_type": "予備試験",
      "year": 2025,
      "subject": "民法",
      "question_text": "問題文...",
      "scoring_notes": "採点実感...",
      "purpose": "出題趣旨...",
      "pdf_path": "data/pdfs/preliminary_exam/R7/..."
    }
  ],
  "total": 1
}
```

#### `GET /v1/problems/{problem_id}`

問題詳細を取得

#### `POST /v1/problems`

問題を個別作成

#### `POST /v1/problems/bulk`

問題を一括作成

**リクエスト例:**

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

#### `PUT /v1/problems/{problem_id}`

問題を更新

### 講評生成

#### `POST /v1/review`

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

#### `POST /v1/review/chat`

講評に関する質問に答える（チャット機能）

**リクエスト例:**

```json
{
  "submission_id": 1,
  "question": "この答案の改善点をもっと詳しく教えてください",
  "chat_history": [
    { "role": "user", "content": "前の質問" },
    { "role": "assistant", "content": "前の回答" }
  ]
}
```

**レスポンス例:**

```json
{
  "answer": "改善点について詳しく説明します..."
}
```

### 短答式問題管理

#### `GET /v1/short-answer/problems`

短答式問題一覧を取得

**クエリパラメータ:**

- `exam_type`: 試験種別（司法試験/予備試験）
- `year`: 年度（文字列、例: "R7", "H30"）
- `subject`: 科目
- `is_random`: ランダム取得（"true"）

#### `GET /v1/short-answer/problems/{problem_id}`

短答式問題詳細を取得

#### `POST /v1/short-answer/sessions`

短答式セッションを作成

**リクエスト例:**

```json
{
  "exam_type": "予備試験",
  "year": "R7",
  "subject": "憲法",
  "is_random": false,
  "problem_ids": [1, 2, 3, 4, 5]
}
```

#### `GET /v1/short-answer/sessions/{session_id}`

セッション情報を取得

#### `POST /v1/short-answer/answers`

回答を送信

**リクエスト例:**

```json
{
  "session_id": 1,
  "problem_id": 1,
  "selected_answer": "1"
}
```

#### `GET /v1/short-answer/sessions/{session_id}/answers`

セッション内の回答一覧を取得

## データベース

SQLite データベース（`dev.db`）に以下のテーブルが作成されます：

### 論文式問題関連

- **`problems`**: 問題情報

  - `id`, `exam_type`, `year`, `subject`, `question_text`
  - `scoring_notes`, `purpose`, `other_info`, `pdf_path`
  - `created_at`, `updated_at`

- **`submissions`**: 答案提出情報

  - `id`, `problem_id`, `subject`, `question_text`, `answer_text`
  - `created_at`

- **`reviews`**: 講評情報
  - `id`, `submission_id`, `review_markdown`, `review_json`
  - `model`, `prompt_version`, `created_at`

### 短答式問題関連

- **`short_answer_problems`**: 短答式問題情報

  - `id`, `exam_type`, `year`, `subject`, `question_number`
  - `question_text`, `choice_1`, `choice_2`, `choice_3`, `choice_4`
  - `correct_answer`, `correctness_pattern`, `source_pdf`
  - `created_at`, `updated_at`

- **`short_answer_sessions`**: 短答式セッション情報

  - `id`, `user_id`, `exam_type`, `year`, `subject`
  - `is_random`, `problem_ids`, `started_at`, `completed_at`

- **`short_answer_answers`**: 短答式回答情報
  - `id`, `session_id`, `problem_id`, `selected_answer`
  - `is_correct`, `answered_at`

## 管理者向け: 問題データの登録

### 方法 1: スクリプトから一括登録

```bash
cd law-review
python admin_import_problems.py problems.json
python admin_import_problems.py problems.csv
```

### 方法 2: API で登録

サーバー起動後、以下を実行：

**PowerShell:**

```powershell
$json = Get-Content problems.json -Raw
Invoke-RestMethod -Uri http://localhost:8000/v1/problems/bulk -Method POST -ContentType "application/json" -Body $json
```

**curl:**

```bash
curl -X POST http://localhost:8000/v1/problems/bulk -H "Content-Type: application/json" -d @problems.json
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

## ディレクトリ構造の変更について

プロジェクトの整理により、以下のディレクトリ名が変更されました：

- `問題文元pdf/` → `data/pdfs/`
- `json_data/` → `data/json/`
- `予備試験/` → `preliminary_exam/`
- `司法試験/` → `judicial_exam/`

既存のスクリプトでこれらのパスを参照している場合は、更新が必要です。

## ライセンス

（必要に応じて追加）
