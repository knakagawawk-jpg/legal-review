# DB 設計ドキュメント

## 目次

1. [公式問題管理テーブル設計](#公式問題管理テーブル設計)
2. [講評テーブル設計](#講評テーブル設計)
3. [フリーチャット用テーブル設計](#フリーチャット用テーブル設計)

---

## 科目テーブル設計

### 概要

科目を一元管理するためのテーブルです。科目名を ID で参照することで、科目名の変更や追加が容易になります。

### テーブル構成

#### `subjects` - 科目テーブル

科目の基本情報を管理します。

**カラム:**

- `id`: SERIAL PRIMARY KEY
- `name`: TEXT NOT NULL UNIQUE - 科目名
- `display_order`: INT NOT NULL UNIQUE - 表示順序（憲法=1, 行政法=2, 民法=3, ...）
- `created_at`: TIMESTAMPTZ NOT NULL - 作成日時
- `updated_at`: TIMESTAMPTZ NOT NULL - 更新日時

**インデックス:**

- `idx_subjects_display_order`: (display_order) - 表示順序での検索
- `idx_subjects_name`: (name) - 科目名での検索

### 初期データ

予備試験・司法試験共通科目を初期データとして登録します。

```sql
INSERT INTO subjects (name, display_order) VALUES
  ('憲法', 1),
  ('行政法', 2),
  ('民法', 3),
  ('商法', 4),
  ('民事訴訟法', 5),
  ('刑法', 6),
  ('刑事訴訟法', 7),
  ('一般教養科目', 8),
  ('実務基礎科目（民事）', 9),
  ('実務基礎科目（刑事）', 10),
  ('労働法', 11),
  ('倒産法', 12),
  ('租税法', 13),
  ('経済法', 14),
  ('知的財産法', 15),
  ('環境法', 16),
  ('国際関係法（公法系）', 17),
  ('国際関係法（私法系）', 18);
```

### 設計のポイント

1. **科目の一元管理**

   - 科目名を一元管理し、ID で参照
   - 科目名の変更や追加が容易

2. **表示順序の管理**

   - `display_order` で科目の表示順序を管理
   - 憲法=1, 行政法=2, 民法=3, ... の順序

3. **既存テーブルとの統合**
   - `official_questions.kamoku` を `subjects.id` への外部キーに変更
   - `reviews` など他のテーブルでも `subjects.id` を使用可能

### 使用例

```sql
-- 科目一覧を表示順序で取得
SELECT id, name, display_order
FROM subjects
ORDER BY display_order;

-- 科目名で検索
SELECT * FROM subjects WHERE name = '民法';

-- official_questionsとJOINして科目名を取得
SELECT
  oq.id,
  oq.shiken_type,
  oq.nendo,
  s.name as kamoku_name
FROM official_questions oq
JOIN subjects s ON s.id = oq.subject_id
WHERE oq.status = 'active';
```

---

## 公式問題管理テーブル設計

### 概要

試験問題をバージョン管理しながら管理するためのテーブル設計です。

### テーブル構成

#### 1. `official_questions` - 公式問題テーブル

試験問題の本文とメタデータを管理します。

**カラム:**

- `id`: BIGSERIAL PRIMARY KEY
- `shiken_type`: TEXT NOT NULL - 試験種別（'shihou' または 'yobi'）
- `nendo`: INT NOT NULL - 年度（2000 以上）
- `kamoku`: TEXT NOT NULL - 科目名
- `version`: INT NOT NULL - バージョン番号（1 以上）
- `status`: TEXT NOT NULL - 状態（'active' または 'old'）
- `text`: TEXT NOT NULL - 問題文
- `syutudaisyusi`: TEXT - 出題趣旨
- `created_at`: TIMESTAMPTZ NOT NULL - 作成日時
- `updated_at`: TIMESTAMPTZ NOT NULL - 更新日時

**制約:**

- `uq_question_version`: (shiken_type, nendo, kamoku, version) の組み合わせがユニーク
- `uq_one_active_per_question`: status='active'の時のみ、(shiken_type, nendo, kamoku) がユニーク（部分ユニークインデックス）

**インデックス:**

- `idx_questions_lookup`: (shiken_type, nendo, kamoku, status) での検索を高速化

#### 2. `shihou_grading_impressions` - 司法試験の採点実感テーブル

司法試験のみが持つ採点実感を管理します。

**カラム:**

- `question_id`: BIGINT PRIMARY KEY - official_questions.id への外部キー
- `grading_impression_text`: TEXT NOT NULL - 採点実感の本文
- `created_at`: TIMESTAMPTZ NOT NULL - 作成日時
- `updated_at`: TIMESTAMPTZ NOT NULL - 更新日時

**制約:**

- `question_id` は `official_questions.id` への外部キー
- ON DELETE CASCADE により、問題削除時に自動削除

### 設計のポイント

#### 1. バージョン管理

同一の試験種別・年度・科目に対して複数のバージョンを持つことができます。

```sql
-- 例: 同じ問題の修正版を追加
-- まず科目IDを取得
SELECT id FROM subjects WHERE name = '民法'; -- 例: 3

INSERT INTO official_questions (shiken_type, nendo, subject_id, version, status, text)
VALUES ('shihou', 2024, 3, 1, 'old', '旧版の問題文');

INSERT INTO official_questions (shiken_type, nendo, subject_id, version, status, text)
VALUES ('shihou', 2024, 3, 2, 'active', '修正版の問題文');
```

#### 2. アクティブ問題の制限

部分ユニークインデックス `uq_one_active_per_question` により、`status='active'` の時のみ `(shiken_type, nendo, kamoku)` の組み合わせがユニークになります。

これにより、常に 1 つのアクティブな問題のみが存在することを保証します。

```sql
-- これは成功（versionが異なる）
INSERT INTO official_questions (shiken_type, nendo, subject_id, version, status, text)
VALUES ('shihou', 2024, 3, 1, 'active', '問題文1');

-- これは失敗（同じ試験種別・年度・科目でactiveが2つになる）
INSERT INTO official_questions (shiken_type, nendo, subject_id, version, status, text)
VALUES ('shihou', 2024, 3, 2, 'active', '問題文2');
-- ERROR: duplicate key value violates unique constraint "uq_one_active_per_question"
```

#### 3. 採点実感の管理

- 司法試験のみが採点実感を持つ（予備試験には存在しない）
- 1 対 1 の関係（`question_id` が PRIMARY KEY）
- CASCADE 削除で問題削除時に自動削除

```sql
-- 司法試験の問題に採点実感を追加
INSERT INTO shihou_grading_impressions (question_id, grading_impression_text)
VALUES (1, '採点実感の本文...');

-- 予備試験の問題には採点実感は追加しない（存在しないため）
```

### 使用例

#### 問題の追加

```sql
-- 新規問題を追加（version=1, status='active'）
-- まず科目IDを取得
SELECT id FROM subjects WHERE name = '民法'; -- 例: 3

INSERT INTO official_questions (shiken_type, nendo, subject_id, version, status, text, syutudaisyusi)
VALUES ('shihou', 2024, 3, 1, 'active', '問題文...', '出題趣旨...');
```

-- 司法試験の場合、採点実感も追加
INSERT INTO shihou_grading_impressions (question_id, grading_impression_text)
VALUES (1, '採点実感の本文...');

````

#### 問題の更新（バージョンアップ）

```sql
-- 1. 既存のactive問題をoldに変更
UPDATE official_questions
SET status = 'old'
WHERE shiken_type = 'shihou' AND nendo = 2024 AND subject_id = 3 AND status = 'active';

-- 2. 新しいバージョンをactiveとして追加
INSERT INTO official_questions (shiken_type, nendo, subject_id, version, status, text, syutudaisyusi)
VALUES ('shihou', 2024, 3, 2, 'active', '修正版の問題文...', '修正版の出題趣旨...');
````

#### 問題の検索

```sql
-- アクティブな問題のみを取得（科目名も含める）
SELECT
  oq.*,
  s.name as kamoku_name
FROM official_questions oq
JOIN subjects s ON s.id = oq.subject_id
WHERE oq.shiken_type = 'shihou' AND oq.nendo = 2024 AND oq.status = 'active';

-- 特定の科目の全バージョンを取得
SELECT
  oq.*,
  s.name as kamoku_name
FROM official_questions oq
JOIN subjects s ON s.id = oq.subject_id
WHERE oq.shiken_type = 'shihou' AND oq.nendo = 2024 AND oq.subject_id = 3
ORDER BY oq.version DESC;
```

### 注意事項

1. **部分ユニークインデックスのサポート**

   - PostgreSQL: 完全サポート（`WHERE` 句付きインデックス）
   - SQLite: サポートされていないため、アプリケーションレベルでの制約が必要

2. **データ移行時の注意**

   - 既存の `ProblemMetadata` / `ProblemDetails` からの移行時は、すべてのレコードを `version=1, status='active'` として登録

3. **採点実感の存在確認**
   - 司法試験の問題でも採点実感が存在しない場合がある
   - LEFT JOIN を使用して採点実感を取得する際は NULL チェックが必要

---

## 講評テーブル設計

### 概要

ユーザーが作成した答案に対する講評を管理するテーブルです。公式問題と自由問題の両方に対応しています。

### テーブル構成

#### `reviews` - 講評テーブル

ユーザーの答案と LLM による講評結果を保存します。

**カラム:**

- `id`: BIGSERIAL PRIMARY KEY
- `user_id`: BIGINT NOT NULL - ユーザー ID（users テーブルは別管理）
- `created_at`: TIMESTAMPTZ NOT NULL - 作成日時
- `updated_at`: TIMESTAMPTZ NOT NULL - 更新日時
- `source_type`: TEXT NOT NULL - 問題の種類（'official' または 'custom'）
- `official_question_id`: BIGINT - 公式問題 ID（source_type='official'の時必須）
- `custom_question_text`: TEXT - 自由問題の問題文（source_type='custom'の時必須）
- `answer_text`: TEXT NOT NULL - ユーザーの答案
- `kouhyo_kekka`: JSONB NOT NULL - LLM の出力 JSON
- `thread_id`: BIGINT - チャットスレッド ID（NULL 可）
- `has_chat`: BOOLEAN NOT NULL DEFAULT false - チャット有無フラグ
- `status`: TEXT NOT NULL DEFAULT 'success' - 講評生成のステータス（'success' または 'failed'）
- `model`: TEXT - 使用した LLM モデル名
- `prompt_version`: TEXT - プロンプトのバージョン
- `input_tokens`: INT - 入力トークン数
- `output_tokens`: INT - 出力トークン数
- `cost_yen`: NUMERIC(10,2) - 講評生成のコスト（円、1 回分）
- `latency_ms`: INT - レイテンシ（ミリ秒、任意）

**制約:**

- `ck_reviews_source_consistency`: source_type と問題参照の整合性を保証
  - `source_type='official'` の時: `official_question_id` 必須、`custom_question_text` は NULL
  - `source_type='custom'` の時: `custom_question_text` 必須、`official_question_id` は NULL
- `ck_reviews_status`: status は'success'または'failed'のみ

**インデックス:**

- `idx_reviews_user_created`: (user_id, created_at DESC) - ユーザー別の講評一覧取得
- `idx_reviews_official_q`: (official_question_id) - 公式問題別の講評検索
- `idx_reviews_thread`: (thread_id) - チャットスレッド別の検索
- `idx_reviews_status`: (status) - ステータス別の検索
- `idx_reviews_model`: (model) - モデル別の検索

### 設計のポイント

#### 1. 公式問題と自由問題の対応

**公式問題の場合:**

```sql
INSERT INTO reviews (user_id, source_type, official_question_id, answer_text, kouhyo_kekka)
VALUES (1, 'official', 123, 'ユーザーの答案...', '{"score": 85, "comments": [...]}');
```

**自由問題の場合:**

```sql
INSERT INTO reviews (user_id, source_type, custom_question_text, answer_text, kouhyo_kekka)
VALUES (1, 'custom', '好きな問題文...', 'ユーザーの答案...', '{"score": 80, "comments": [...]}');
```

#### 2. チャット機能

講評画面でチャットが開始された場合、`thread_id`を設定します。

```sql
-- チャット開始前
INSERT INTO reviews (user_id, source_type, official_question_id, answer_text, kouhyo_kekka, thread_id, has_chat)
VALUES (1, 'official', 123, '答案...', '{"score": 85}', NULL, false);

-- チャット開始後
UPDATE reviews SET thread_id = 456, has_chat = true WHERE id = 1;
```

`has_chat`フラグにより、チャット有無の一覧表示が高速化されます。

#### 3. LLM 出力の保存

`kouhyo_kekka`（JSONB）に LLM の出力 JSON を保存します。

```sql
-- JSONB型により、JSONクエリが可能（PostgreSQL）
SELECT * FROM reviews
WHERE kouhyo_kekka->>'score'::int > 80;

-- 特定のフィールドを取得
SELECT kouhyo_kekka->'comments' as comments FROM reviews WHERE id = 1;
```

#### 4. コスト管理

講評生成には 2 種類のコストが発生します：

1. **講評生成コスト（固定）**: `cost_yen` に保存

   - 答案から JSON 講評を生成する際のコスト
   - `input_tokens`, `output_tokens` でトークン数を記録
   - `model`, `prompt_version` で使用したモデルとプロンプトを記録

2. **チャットコスト（可変）**: `messages.cost_yen` を合算
   - 講評後のチャットで発生するコスト
   - `thread_id` で紐づく `messages` テーブルのコストを合算して表示

```sql
-- 講評生成コストを記録
INSERT INTO reviews (
  user_id, source_type, official_question_id, answer_text, kouhyo_kekka,
  status, model, prompt_version, input_tokens, output_tokens, cost_yen, latency_ms
)
VALUES (
  1, 'official', 123, '答案...', '{"score": 85}'::jsonb,
  'success', 'claude-haiku-4-5-20251001', 'v1.0', 1500, 2000, 0.15, 2500
);

-- チャットコストを含めた総コストを取得
SELECT
  r.id,
  r.cost_yen as review_cost,
  COALESCE(SUM(m.cost_yen), 0) as chat_cost,
  r.cost_yen + COALESCE(SUM(m.cost_yen), 0) as total_cost
FROM reviews r
LEFT JOIN messages m ON m.thread_id = r.thread_id
WHERE r.id = 1
GROUP BY r.id, r.cost_yen;
```

### 使用例

#### 講評の作成

```sql
-- 公式問題の講評を作成
INSERT INTO reviews (
  user_id, source_type, official_question_id, answer_text, kouhyo_kekka
)
VALUES (
  1,
  'official',
  123,
  'ユーザーの答案テキスト...',
  '{"score": 85, "comments": ["良い点", "改善点"], "detailed_review": "..."}'::jsonb
);

-- 自由問題の講評を作成
INSERT INTO reviews (
  user_id, source_type, custom_question_text, answer_text, kouhyo_kekka
)
VALUES (
  1,
  'custom',
  '好きな問題文をここに入力...',
  'ユーザーの答案テキスト...',
  '{"score": 80, "comments": ["良い点"], "detailed_review": "..."}'::jsonb
);
```

#### チャット開始（threads.type='review_chat'を使用）

講評チャットは`threads.type='review_chat'`として管理します。

```sql
-- 1. threads に INSERT（type='review_chat'）
INSERT INTO threads (user_id, type, title)
VALUES (1, 'review_chat', '講評チャット - 2024年 民法');

-- 2. 講評にthread_idを設定
UPDATE reviews
SET thread_id = 456, has_chat = true
WHERE id = 1;

-- 3. 最初のメッセージをmessagesに追加（講評に関する質問など）
INSERT INTO messages (thread_id, role, content)
VALUES (456, 'user', 'この講評について詳しく教えてください');

-- 4. threads.last_message_at = now() を更新
UPDATE threads
SET last_message_at = now()
WHERE id = 456;
```

**注意:** 講評チャットは`threads.type='review_chat'`を使用し、フリーチャット（`type='free_chat'`）とは区別します。

#### 講評の検索

```sql
-- ユーザー別の講評一覧（作成日時の降順）
SELECT * FROM reviews
WHERE user_id = 1
ORDER BY created_at DESC;

-- 公式問題別の講評一覧
SELECT * FROM reviews
WHERE official_question_id = 123
ORDER BY created_at DESC;

-- チャット有無の講評のみ取得
SELECT * FROM reviews
WHERE user_id = 1 AND has_chat = true
ORDER BY created_at DESC;

-- コスト別の集計
SELECT
  status,
  model,
  COUNT(*) as count,
  SUM(cost_yen) as total_cost,
  AVG(cost_yen) as avg_cost,
  AVG(latency_ms) as avg_latency_ms
FROM reviews
WHERE user_id = 1
GROUP BY status, model
ORDER BY total_cost DESC;
```

### 注意事項

1. **JSONB 型のサポート**

   - PostgreSQL: JSONB 型を完全サポート（JSON クエリ可能）
   - SQLite: JSONB 型はサポートされていないため、Text 型で JSON 文字列として保存

2. **ユーザー削除時の動作**

   - 現在は`user_id`に NOT NULL 制約のみ
   - ユーザー削除時の動作（CASCADE/SET NULL）は要検討

3. **threads テーブルとの関係**
   - 循環参照を避けるため、threads テーブルへの FK は後付けでも OK
   - アプリケーションレベルでの整合性チェックが必要
