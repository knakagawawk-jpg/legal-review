-- ============================================================================
-- 講評テーブル設計
-- ============================================================================

CREATE TABLE reviews (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  source_type TEXT NOT NULL CHECK (source_type IN ('official','custom')),

  official_question_id BIGINT REFERENCES official_questions(id) ON DELETE SET NULL,
  custom_question_text TEXT,

  answer_text TEXT NOT NULL,

  kouhyo_kekka JSONB NOT NULL,

  thread_id BIGINT, -- threads.id を参照（threads.type='review_chat'として管理）
  has_chat BOOLEAN NOT NULL DEFAULT false,

  -- コスト管理（講評生成の1回分）
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success','failed')),
  model TEXT,
  prompt_version TEXT,
  input_tokens INT,
  output_tokens INT,
  cost_yen NUMERIC(10,2),
  latency_ms INT, -- レイテンシ（ミリ秒、任意）

  CONSTRAINT ck_reviews_source_consistency CHECK (
    (source_type='official' AND official_question_id IS NOT NULL AND custom_question_text IS NULL)
 OR (source_type='custom'   AND official_question_id IS NULL AND custom_question_text IS NOT NULL)
  )
);

CREATE INDEX idx_reviews_user_created ON reviews(user_id, created_at DESC);
CREATE INDEX idx_reviews_official_q ON reviews(official_question_id);
CREATE INDEX idx_reviews_thread ON reviews(thread_id);
CREATE INDEX idx_reviews_status ON reviews(status);
CREATE INDEX idx_reviews_model ON reviews(model);

-- ============================================================================
-- 設計のポイント
-- ============================================================================
-- 
-- 1. 問題の種類
--    - 公式問題（official）: official_question_idでofficial_questionsテーブルを参照
--    - 自由問題（custom）: custom_question_textに問題文を直接保存
--    - CHECK制約により、source_typeと問題参照の整合性を保証
--
-- 2. チャット機能
--    - thread_idでチャットスレッドを管理（NULL可）
--    - threads.type='review_chat'として管理（フリーチャットとは区別）
--    - has_chatフラグでチャット有無を管理（一覧表示の高速化）
--    - 講評チャット開始時はthreadsテーブルにtype='review_chat'のレコードを作成
--
-- 3. LLM出力の保存
--    - kouhyo_kekka（JSONB）にLLMの出力JSONを保存
--    - JSONB型により、JSONクエリが可能（PostgreSQLの場合）
--
-- 4. ユーザー管理
--    - user_idはusersテーブルへの参照（usersテーブルは別管理）
--    - ユーザー削除時の動作は要検討（SET NULL or CASCADE）
--
-- ============================================================================
