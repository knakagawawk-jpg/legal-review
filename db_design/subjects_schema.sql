-- ============================================================================
-- 科目テーブル設計
-- ============================================================================

CREATE TABLE subjects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_order INT NOT NULL UNIQUE, -- 表示順序（憲法=1, 行政法=2, 民法=3, ...）
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- インデックス
CREATE INDEX idx_subjects_display_order ON subjects(display_order);
CREATE INDEX idx_subjects_name ON subjects(name);

-- 初期データ（予備試験・司法試験共通科目）
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
  ('国際関係法（私法系）', 18)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 設計のポイント
-- ============================================================================
-- 
-- 1. 科目の一元管理
--    - 科目名を一元管理し、IDで参照
--    - 科目名の変更や追加が容易
--
-- 2. 表示順序の管理
--    - display_order で科目の表示順序を管理
--    - 憲法=1, 行政法=2, 民法=3, ... の順序
--
-- 3. 既存テーブルとの統合
--    - official_questions.kamoku を subjects.id への外部キーに変更
--    - reviews など他のテーブルでも subjects.id を使用可能
--
-- ============================================================================
