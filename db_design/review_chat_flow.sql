-- ============================================================================
-- 講評チャットの典型フロー（threads.type='review_chat'を使用）
-- ============================================================================

-- A) 講評チャットを開始
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

-- B) 講評チャットに発言
-- 1. messages に INSERT
INSERT INTO messages (thread_id, role, content, model, cost_yen, request_id)
VALUES (
  456,
  'assistant',
  'この講評では、以下の点が評価されています...',
  'claude-haiku-4-5-20251001',
  0.10,
  'req_1234567890'
);

-- 2. threads.last_message_at = now() 更新
UPDATE threads
SET last_message_at = now()
WHERE id = 456;

-- C) 講評チャット一覧表示（最新順）
SELECT 
  t.id,
  t.title,
  t.created_at,
  t.last_message_at,
  t.pinned,
  r.id as review_id,
  r.source_type,
  r.official_question_id
FROM threads t
JOIN reviews r ON r.thread_id = t.id
WHERE t.user_id = 1
  AND t.type = 'review_chat'
  AND t.is_archived = false
ORDER BY t.pinned DESC, COALESCE(t.last_message_at, t.created_at) DESC;

-- D) 講評チャット本文表示
SELECT 
  m.role,
  m.content,
  m.created_at,
  m.model,
  m.cost_yen
FROM messages m
WHERE m.thread_id = 456
ORDER BY m.created_at ASC
LIMIT 200;

-- E) 講評チャットのコスト集計
SELECT 
  t.id,
  t.title,
  r.id as review_id,
  r.cost_yen as review_cost,
  COUNT(m.id) as message_count,
  SUM(m.cost_yen) as chat_cost,
  r.cost_yen + COALESCE(SUM(m.cost_yen), 0) as total_cost
FROM threads t
JOIN reviews r ON r.thread_id = t.id
LEFT JOIN messages m ON m.thread_id = t.id
WHERE t.id = 456
GROUP BY t.id, t.title, r.id, r.cost_yen;

-- ============================================================================
-- 設計のポイント
-- ============================================================================
-- 
-- 1. threads.type='review_chat'を使用
--    - フリーチャット（type='free_chat'）とは区別
--    - 同じthreads/messagesテーブルを使用して統一管理
--
-- 2. 講評チャット開始時のフロー
--    - threads に type='review_chat' のレコードを作成
--    - reviews.thread_id を設定
--    - reviews.has_chat = true を設定
--    - 最初のメッセージをmessagesに追加
--    - threads.last_message_at を更新
--
-- 3. コスト管理
--    - reviews.cost_yen: 講評生成のコスト（固定）
--    - messages.cost_yen: チャットのコスト（可変）
--    - 合計コスト = reviews.cost_yen + SUM(messages.cost_yen)
--
-- ============================================================================
