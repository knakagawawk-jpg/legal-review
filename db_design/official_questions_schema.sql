-- ============================================================================
-- 公式問題管理テーブル設計
-- ============================================================================

-- 公式問題テーブル（バージョン管理対応）
CREATE TABLE official_questions (
  id BIGSERIAL PRIMARY KEY,
  shiken_type TEXT NOT NULL CHECK (shiken_type IN ('shihou','yobi')),
  nendo INT NOT NULL CHECK (nendo >= 2000),
  subject_id INT NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,

  version INT NOT NULL CHECK (version >= 1),
  status TEXT NOT NULL CHECK (status IN ('active','old')),

  text TEXT NOT NULL,
  syutudaisyusi TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_question_version UNIQUE (shiken_type, nendo, subject_id, version)
);

-- active を1つに制限（超重要）
-- 部分ユニークインデックス: status='active'の時のみ有効
CREATE UNIQUE INDEX uq_one_active_per_question
  ON official_questions (shiken_type, nendo, subject_id)
  WHERE status = 'active';

-- 検索用インデックス
CREATE INDEX idx_questions_lookup
  ON official_questions (shiken_type, nendo, subject_id, status);

-- 科目テーブルとのJOIN用インデックス
CREATE INDEX idx_questions_subject ON official_questions(subject_id);

-- 司法試験の採点実感テーブル
CREATE TABLE shihou_grading_impressions (
  question_id BIGINT PRIMARY KEY
    REFERENCES official_questions(id) ON DELETE CASCADE,
  grading_impression_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 設計のポイント
-- ============================================================================
-- 
-- 1. バージョン管理
--    - 同一の試験種別・年度・科目に対して複数のバージョンを持つことができる
--    - version カラムでバージョン番号を管理
--    - status='active'のものは1つだけ（uq_one_active_per_question で保証）
--
-- 2. アクティブ問題の制限
--    - 部分ユニークインデックスにより、status='active'の時のみ
--      (shiken_type, nendo, kamoku) の組み合わせがユニークになる
--    - これにより、常に1つのアクティブな問題のみが存在することを保証
--
-- 3. 採点実感の管理
--    - 司法試験のみが採点実感を持つ（予備試験には存在しない）
--    - 1対1の関係（question_idがPRIMARY KEY）
--    - CASCADE削除で問題削除時に自動削除
--
-- 4. 命名規則
--    - shiken_type: 'shihou'（司法試験）または 'yobi'（予備試験）
--    - nendo: 年度（2000以上）
--    - kamoku: 科目名
--    - syutudaisyusi: 出題趣旨（両試験種別で使用）
--
-- ============================================================================
