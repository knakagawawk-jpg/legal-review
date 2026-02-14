-- ============================================================================
-- threads に review_id を追加（同一答案に複数スレッド紐づけ用）
-- ============================================================================

-- PostgreSQL
ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS review_id BIGINT REFERENCES reviews(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_threads_review_id ON threads(review_id);

-- 既存の review_chat スレッドをバックフィル（Review.thread_id から）
UPDATE threads t
SET review_id = r.id
FROM reviews r
WHERE r.thread_id = t.id
  AND t.type = 'review_chat'
  AND t.review_id IS NULL;

-- ============================================================================
-- SQLite 用（必要に応じて実行）
-- ============================================================================
-- ALTER TABLE threads ADD COLUMN review_id INTEGER REFERENCES reviews(id);
-- CREATE INDEX idx_threads_review_id ON threads(review_id);
-- UPDATE threads SET review_id = (SELECT id FROM reviews WHERE reviews.thread_id = threads.id) WHERE type = 'review_chat' AND review_id IS NULL;
