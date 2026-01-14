-- ============================================================================
-- フリーチャット用クエリ例
-- ============================================================================

-- A) 「新しいチャット」を開始
-- 1. threads に INSERT（type='free_chat', titleはNULL/空でOK）
INSERT INTO threads (user_id, type, title)
VALUES (1, 'free_chat', NULL);

-- 2. 最初のユーザーメッセージを messages に INSERT
INSERT INTO messages (thread_id, role, content)
VALUES (1, 'user', 'こんにちは');

-- 3. threads.last_message_at = now() を更新
UPDATE threads
SET last_message_at = now()
WHERE id = 1;

-- B) 既存チャットに発言
-- 1. messages に INSERT
INSERT INTO messages (thread_id, role, content, model, input_tokens, output_tokens, cost_yen, request_id)
VALUES (
  1,
  'assistant',
  'こんにちは！何かお手伝いできることはありますか？',
  'claude-haiku-4-5-20251001',
  50,
  30,
  0.05,
  'req_1234567890'
);

-- 2. threads.last_message_at = now() 更新（これが無いと一覧が重くなります）
UPDATE threads
SET last_message_at = now()
WHERE id = 1;

-- C) チャット一覧表示（最新順）
SELECT 
  id, 
  title, 
  created_at, 
  last_message_at, 
  pinned,
  is_archived
FROM threads
WHERE user_id = 1
  AND type = 'free_chat'
  AND is_archived = false
ORDER BY pinned DESC, COALESCE(last_message_at, created_at) DESC;

-- D) チャット本文表示（最新N件など）
SELECT 
  role, 
  content, 
  created_at,
  model,
  cost_yen
FROM messages
WHERE thread_id = 1
ORDER BY created_at ASC
LIMIT 200;

-- E) スレッドのタイトル更新
UPDATE threads
SET title = '新しいタイトル'
WHERE id = 1;

-- F) スレッドのアーカイブ
UPDATE threads
SET is_archived = true
WHERE id = 1;

-- G) スレッドの固定表示
UPDATE threads
SET pinned = true
WHERE id = 1;

-- H) スレッドのコスト集計
SELECT 
  t.id,
  t.title,
  COUNT(m.id) as message_count,
  SUM(m.cost_yen) as total_cost,
  AVG(m.cost_yen) as avg_cost_per_message
FROM threads t
LEFT JOIN messages m ON m.thread_id = t.id
WHERE t.id = 1
GROUP BY t.id, t.title;

-- I) ユーザー全体のコスト集計（フリーチャット）
SELECT 
  DATE_TRUNC('day', m.created_at) as date,
  COUNT(DISTINCT t.id) as thread_count,
  COUNT(m.id) as message_count,
  SUM(m.cost_yen) as total_cost
FROM threads t
JOIN messages m ON m.thread_id = t.id
WHERE t.user_id = 1
  AND t.type = 'free_chat'
  AND m.cost_yen IS NOT NULL
GROUP BY DATE_TRUNC('day', m.created_at)
ORDER BY date DESC;

-- J) スレッドの削除（CASCADEでメッセージも自動削除）
DELETE FROM threads WHERE id = 1;

-- ============================================================================
-- 実装のコツ（事故が減る）
-- ============================================================================
-- 
-- 1. スレッドは先に作る（messagesはthread_id必須）
-- 2. メッセージ追加のたびに last_message_at を必ず更新
-- 3. コスト計測するなら、messages.cost_yen を基本にして集計できるようにする
-- 4. threads.type で「講評チャット」「短答チャット」も同じ仕組みに寄せられる（将来楽）
--
-- ============================================================================
