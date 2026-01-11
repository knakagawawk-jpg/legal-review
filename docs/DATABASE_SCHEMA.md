# SQLite データベーススキーマ

## テーブル一覧

SQLiteデータベース（`dev.db`）には以下のテーブルが保存されています。

---

## 1. 問題関連テーブル（全ユーザー共有データ）

### 1.1 `problem_metadata`（問題メタデータ - 改善版）
問題の識別情報のみを管理（試験種別、年度、科目の組み合わせ）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | Integer | 主キー |
| exam_type | String(20) | 試験種別（"司法試験" or "予備試験"） |
| year | Integer | 年度（例: 2018, 2025） |
| subject | String(50) | 科目 |
| created_at | DateTime | 作成日時 |
| updated_at | DateTime | 更新日時 |

**制約**: `(exam_type, year, subject)` の組み合わせは一意

### 1.2 `problem_details`（問題詳細 - 改善版）
設問ごとの詳細情報を管理（問題メタデータに紐づく）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | Integer | 主キー |
| problem_metadata_id | Integer | 外部キー（problem_metadata.id） |
| question_number | Integer | 設問番号（1, 2, ...） |
| question_text | Text | 設問ごとの問題文 |
| purpose | Text | 出題趣旨 |
| scoring_notes | Text | 採点実感 |
| pdf_path | String(500) | PDFファイルの保存パス |
| created_at | DateTime | 作成日時 |
| updated_at | DateTime | 更新日時 |

**制約**: `(problem_metadata_id, question_number)` の組み合わせは一意

### 1.3 `problems`（問題 - 既存構造・後方互換性用）
旧構造の問題データ（移行期間中に保持）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | Integer | 主キー |
| exam_type | String(20) | 試験種別 |
| year | Integer | 年度 |
| subject | String(50) | 科目 |
| question_text | Text | 問題文 |
| scoring_notes | Text | 採点実感 |
| purpose | Text | 出題趣旨 |
| other_info | Text | その他の情報（JSON形式） |
| pdf_path | String(500) | PDFファイルの保存パス |
| created_at | DateTime | 作成日時 |
| updated_at | DateTime | 更新日時 |

### 1.4 `short_answer_problems`（短答式問題）
短答式問題のデータ

| カラム | 型 | 説明 |
|--------|-----|------|
| id | Integer | 主キー |
| exam_type | String(20) | 試験種別 |
| year | String(10) | 年度（"R7", "H30"など） |
| subject | String(50) | 科目 |
| question_number | Integer | 問題番号 |
| question_text | Text | 問題本文 |
| choice_1 | Text | 選択肢1 |
| choice_2 | Text | 選択肢2 |
| choice_3 | Text | 選択肢3 |
| choice_4 | Text | 選択肢4（3択問題の場合はNULL） |
| correct_answer | String(20) | 正解（"1", "2", "1,2"など） |
| correctness_pattern | String(10) | 正誤パターン（"〇☓☓☓"など） |
| source_pdf | String(500) | 元PDFファイルのパス |
| created_at | DateTime | 作成日時 |
| updated_at | DateTime | 更新日時 |

---

## 2. ユーザー関連テーブル（ユーザー固有データ）

### 2.1 `users`（ユーザー）
ユーザーの基本情報

| カラム | 型 | 説明 |
|--------|-----|------|
| id | Integer | 主キー |
| email | String(255) | メールアドレス（ユニーク） |
| name | String(100) | 表示名 |
| google_id | String(255) | GoogleアカウントID（ユニーク） |
| google_picture | String(500) | プロフィール画像URL |
| is_active | Boolean | アカウント有効フラグ |
| is_admin | Boolean | 管理者フラグ |
| deleted_at | DateTime | ソフトデリート日時 |
| created_at | DateTime | 作成日時 |
| updated_at | DateTime | 更新日時 |
| last_login_at | DateTime | 最終ログイン日時 |

### 2.2 `subscription_plans`（サブスクリプションプラン）
課金プランの定義

| カラム | 型 | 説明 |
|--------|-----|------|
| id | Integer | 主キー |
| plan_code | String(20) | プランコード（"free", "basic", "premium"） |
| name | String(50) | プラン名 |
| description | Text | 説明 |
| limits | Text | 制限設定（JSON形式） |
| price_monthly | Integer | 月額価格 |
| price_yearly | Integer | 年額価格 |
| features | Text | 機能フラグ（JSON形式） |
| is_active | Boolean | 有効フラグ |
| display_order | Integer | 表示順序 |
| created_at | DateTime | 作成日時 |
| updated_at | DateTime | 更新日時 |

### 2.3 `user_subscriptions`（ユーザーサブスクリプション）
ユーザーのサブスクリプション履歴

| カラム | 型 | 説明 |
|--------|-----|------|
| id | Integer | 主キー |
| user_id | Integer | 外部キー（users.id） |
| plan_id | Integer | 外部キー（subscription_plans.id） |
| is_active | Boolean | アクティブフラグ |
| started_at | DateTime | 開始日時 |
| expires_at | DateTime | 有効期限（NULL = 無期限） |
| payment_method | String(50) | 支払い方法 |
| payment_id | String(255) | 支払いID |
| created_at | DateTime | 作成日時 |
| updated_at | DateTime | 更新日時 |
| cancelled_at | DateTime | キャンセル日時 |

### 2.4 `monthly_usage`（月間使用量）
ユーザーの月間使用量を集計

| カラム | 型 | 説明 |
|--------|-----|------|
| id | Integer | 主キー |
| user_id | Integer | 外部キー（users.id） |
| year | Integer | 年 |
| month | Integer | 月（1-12） |
| review_count | Integer | 講評生成回数 |
| short_answer_session_count | Integer | 短答式セッション数 |
| chat_message_count | Integer | チャットメッセージ数 |
| created_at | DateTime | 作成日時 |
| updated_at | DateTime | 更新日時 |

**制約**: `(user_id, year, month)` の組み合わせは一意

---

## 3. 講評関連テーブル（ユーザー固有データ）

### 3.1 `submissions`（答案）
ユーザーが作成した答案

| カラム | 型 | 説明 |
|--------|-----|------|
| id | Integer | 主キー |
| user_id | Integer | 外部キー（users.id、認証OFF時はNULL） |
| problem_id | Integer | 外部キー（problems.id、後方互換性用） |
| problem_metadata_id | Integer | 外部キー（problem_metadata.id、改善版） |
| problem_details_id | Integer | 外部キー（problem_details.id、設問指定） |
| subject | String(50) | 科目 |
| question_text | Text | 問題文 |
| answer_text | Text | 答案テキスト（必須） |
| created_at | DateTime | 作成日時 |

### 3.2 `reviews`（講評）
生成された講評結果

| カラム | 型 | 説明 |
|--------|-----|------|
| id | Integer | 主キー |
| submission_id | Integer | 外部キー（submissions.id、ユニーク） |
| review_markdown | Text | マークダウン形式の講評 |
| review_json | Text | JSON形式の講評（JSON文字列） |
| model | String(100) | 使用したLLMモデル名 |
| prompt_version | String(50) | プロンプトバージョン |
| created_at | DateTime | 作成日時 |

---

## 4. 短答式関連テーブル（ユーザー固有データ）

### 4.1 `short_answer_sessions`（短答式セッション）
短答式試験のセッション情報

| カラム | 型 | 説明 |
|--------|-----|------|
| id | Integer | 主キー |
| user_id | Integer | 外部キー（users.id、認証OFF時はNULL） |
| exam_type | String(20) | 試験種別 |
| year | String(10) | 年度 |
| subject | String(50) | 科目 |
| is_random | Boolean | ランダムモードフラグ |
| problem_ids | Text | 問題IDのリスト（JSON配列形式） |
| started_at | DateTime | 開始日時 |
| completed_at | DateTime | 完了日時 |

### 4.2 `short_answer_answers`（短答式回答）
ユーザーの回答記録

| カラム | 型 | 説明 |
|--------|-----|------|
| id | Integer | 主キー |
| session_id | Integer | 外部キー（short_answer_sessions.id） |
| problem_id | Integer | 外部キー（short_answer_problems.id） |
| selected_answer | String(20) | 選択した選択肢（"1", "2", "1,2"など） |
| is_correct | Boolean | 正誤 |
| answered_at | DateTime | 回答日時 |

---

## 5. ノート機能関連テーブル（ユーザー固有データ）

### 5.1 `notebooks`（ノートブック）
最上位のコンテナ（OneNote風の階層構造）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | Integer | 主キー |
| user_id | Integer | 外部キー（users.id、認証OFF時はNULL） |
| title | String(200) | タイトル |
| description | Text | 説明 |
| color | String(20) | カラーコード（例: "#FF5733"） |
| created_at | DateTime | 作成日時 |
| updated_at | DateTime | 更新日時 |

### 5.2 `note_sections`（セクション）
ノートブック内のセクション

| カラム | 型 | 説明 |
|--------|-----|------|
| id | Integer | 主キー |
| notebook_id | Integer | 外部キー（notebooks.id） |
| title | String(200) | タイトル |
| display_order | Integer | 表示順序 |
| created_at | DateTime | 作成日時 |
| updated_at | DateTime | 更新日時 |

### 5.3 `note_pages`（ページ）
セクション内のページ

| カラム | 型 | 説明 |
|--------|-----|------|
| id | Integer | 主キー |
| section_id | Integer | 外部キー（note_sections.id） |
| title | String(200) | タイトル |
| content | Text | コンテンツ（Markdown形式） |
| display_order | Integer | 表示順序 |
| created_at | DateTime | 作成日時 |
| updated_at | DateTime | 更新日時 |

---

## リレーションシップ図

```
users
├── subscriptions (user_subscriptions)
│   └── plan (subscription_plans)
├── submissions
│   ├── problem (problems) - 後方互換性用
│   ├── problem_metadata (problem_metadata) - 改善版
│   ├── problem_details (problem_details) - 改善版
│   └── review (reviews) [1:1]
├── short_answer_sessions
│   └── answers (short_answer_answers)
│       └── problem (short_answer_problems)
├── monthly_usage
└── notebooks
    └── sections (note_sections)
        └── pages (note_pages)

problem_metadata (共有データ)
└── details (problem_details) - 設問ごと

problems (共有データ・後方互換性用)
```

---

## データの分類

### 共有データ（全ユーザー共通・ユーザーID不要）
- ✅ `problem_metadata` - 問題メタデータ
- ✅ `problem_details` - 問題詳細
- ✅ `problems` - 旧構造の問題データ（後方互換性用）
- ✅ `short_answer_problems` - 短答式問題
- ✅ `subscription_plans` - サブスクリプションプラン定義

### ユーザー固有データ（ユーザーID必要）
- ✅ `users` - ユーザー情報
- ✅ `user_subscriptions` - サブスクリプション履歴
- ✅ `monthly_usage` - 月間使用量
- ✅ `submissions` - ユーザーの答案
- ✅ `reviews` - 生成された講評
- ✅ `short_answer_sessions` - 短答式セッション
- ✅ `short_answer_answers` - 短答式回答
- ✅ `notebooks` - ノートブック
- ✅ `note_sections` - セクション
- ✅ `note_pages` - ページ

---

## データベースファイル

- **ファイル名**: `dev.db`
- **場所**: `law-review/dev.db`
- **型**: SQLite 3
