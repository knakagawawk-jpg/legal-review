-- ============================================================================
-- 講評テーブルへのコスト管理カラム追加（マイグレーション）
-- ============================================================================

-- 既存のreviewsテーブルにコスト管理カラムを追加
ALTER TABLE reviews
  ADD COLUMN status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success','failed')),
  ADD COLUMN model TEXT,
  ADD COLUMN prompt_version TEXT,
  ADD COLUMN input_tokens INT,
  ADD COLUMN output_tokens INT,
  ADD COLUMN cost_yen NUMERIC(10,2),
  ADD COLUMN latency_ms INT;

-- インデックスを追加
CREATE INDEX idx_reviews_status ON reviews(status);
CREATE INDEX idx_reviews_model ON reviews(model);

-- ============================================================================
-- 注意事項
-- ============================================================================
-- 
-- 1. 既存データの処理
--    - status は DEFAULT 'success' が設定されているため、既存レコードは自動的に 'success' になる
--    - その他のカラムは NULL のまま（既存データにはコスト情報がないため）
--
-- 2. コスト計算
--    - cost_yen: 講評生成の1回分のコスト（固定）
--    - チャット部分のコストは messages.cost_yen を合算して表示
--
-- 3. ステータス管理
--    - 'success': 講評生成が成功した場合
--    - 'failed': 講評生成が失敗した場合（エラー時など）
--
-- ============================================================================
