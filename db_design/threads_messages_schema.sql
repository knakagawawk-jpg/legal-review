-- ============================================================================
-- フリーチャット用テーブル設計
-- ============================================================================

-- 1. threads（会話の箱）
CREATE TABLE threads (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,

  type TEXT NOT NULL CHECK (type IN ('free_chat', 'review_chat', 'short_answer_chat')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ, -- 最終発言日時（一覧の並び替えに必須）

  title TEXT, -- タイトル（空でもOK、後から自動生成・手動編集可能）
  is_archived BOOLEAN NOT NULL DEFAULT false, -- アーカイブフラグ（履歴整理用）
  pinned BOOLEAN NOT NULL DEFAULT false -- 固定表示フラグ（任意）
);

-- インデックス（一覧表示を高速化）
-- 完全版: (user_id, type, is_archived, pinned, last_message_at)
CREATE INDEX idx_threads_user_type_archived_pinned_last 
  ON threads(user_id, type, is_archived, pinned, last_message_at DESC);

-- 最低限版: (user_id, type, is_archived, last_message_at DESC)
CREATE INDEX idx_threads_user_type_archived_last 
  ON threads(user_id, type, is_archived, last_message_at DESC);

-- 2. messages（会話の中身）
CREATE TABLE messages (
  id BIGSERIAL PRIMARY KEY,
  thread_id BIGINT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,

  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- LLM呼び出し情報（運用・コスト管理）
  model TEXT,
  prompt_version TEXT,
  input_tokens INT,
  output_tokens INT,
  cost_yen NUMERIC(10,2),
  request_id TEXT -- 同一LLM呼び出しの重複計上防止用
);

-- インデックス（スレッド表示を高速化）
CREATE INDEX idx_messages_thread_created 
  ON messages(thread_id, created_at ASC);

-- コスト集計用インデックス
CREATE INDEX idx_messages_thread_cost 
  ON messages(thread_id, cost_yen);

-- ============================================================================
-- 設計のポイント
-- ============================================================================
-- 
-- 1. スレッド管理
--    - 1つのチャットルーム = 1 thread
--    - フリーチャットは type='free_chat' を使用
--    - 講評チャット、短答チャットも同じ仕組みで管理可能（将来拡張）
--
-- 2. 一覧表示の高速化
--    - last_message_at で最終発言日時を管理
--    - メッセージ追加のたびに last_message_at を必ず更新
--    - pinned があれば固定表示を優先
--
-- 3. コスト管理
--    - messages.cost_yen を基本にして集計
--    - request_id で同一LLM呼び出しの重複計上を防止
--
-- 4. 実装のコツ
--    - スレッドは先に作る（messagesはthread_id必須）
--    - メッセージ追加のたびに last_message_at を必ず更新
--    - コスト計測するなら、messages.cost_yen を基本にして集計
--
-- ============================================================================
