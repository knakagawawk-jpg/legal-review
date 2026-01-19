#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
official_questions の id 自動採番（SQLite: INTEGER PRIMARY KEY）を保証するマイグレーション。

背景:
- SQLiteでは id が BIGINT PRIMARY KEY だと rowid と連動せず、自動採番されない
- その結果、INSERT時に id が NULL になり NOT NULL 制約で落ちる

方針:
- official_questions.id が INTEGER PRIMARY KEY でない場合、テーブルを再作成してコピーする
- 既存データがあっても id を維持してコピーする（外部参照の破壊を避ける）
"""

import sys
import logging
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

BASE_DIR = Path("/app") if Path("/app").exists() else Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))

try:
    from app.db import SessionLocal
except ImportError:
    import os
    os.chdir(str(BASE_DIR))
    from app.db import SessionLocal

from sqlalchemy import text


def _table_exists(db, name: str) -> bool:
    row = db.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name=:name"),
        {"name": name},
    ).fetchone()
    return row is not None


def _sqlite_integer_pk(db, table: str, col: str) -> bool:
    rows = db.execute(text(f"PRAGMA table_info({table})")).fetchall()
    for r in rows:
        if r[1] == col:
            return (str(r[2] or "").upper() == "INTEGER") and (int(r[5] or 0) == 1)
    return False


def migrate_official_questions_table() -> None:
    db = SessionLocal()
    try:
        if not _table_exists(db, "official_questions"):
            logger.info("official_questions table not found. Skipping.")
            return

        if _sqlite_integer_pk(db, "official_questions", "id"):
            logger.info("official_questions.id is already INTEGER PRIMARY KEY. Skipping.")
            return

        logger.info("Rebuilding official_questions to ensure INTEGER PRIMARY KEY...")

        db.execute(text("PRAGMA foreign_keys=OFF"))
        db.commit()

        # 旧テーブルを退避
        db.execute(text("ALTER TABLE official_questions RENAME TO official_questions_old;"))
        db.commit()

        # 旧インデックスは名前衝突するため削除（テーブルリネーム後も残る）
        for idx in ["uq_one_active_per_question", "idx_questions_lookup", "idx_questions_subject"]:
            db.execute(text(f"DROP INDEX IF EXISTS {idx};"))
        db.commit()

        # 新テーブルを作成（SQLite用）
        db.execute(text("""
            CREATE TABLE official_questions (
              id INTEGER NOT NULL PRIMARY KEY,
              shiken_type VARCHAR(10) NOT NULL,
              nendo INTEGER NOT NULL,
              subject_id INTEGER NOT NULL,
              version INTEGER NOT NULL,
              status VARCHAR(10) NOT NULL,
              text TEXT NOT NULL,
              syutudaisyusi TEXT,
              created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT ck_shiken_type CHECK (shiken_type IN ('shihou','yobi')),
              CONSTRAINT ck_nendo CHECK (nendo >= 2000),
              CONSTRAINT ck_version CHECK (version >= 1),
              CONSTRAINT ck_status CHECK (status IN ('active','old')),
              CONSTRAINT ck_official_question_subject CHECK (subject_id BETWEEN 1 AND 18),
              CONSTRAINT uq_question_version UNIQUE (shiken_type, nendo, subject_id, version)
            );
        """))

        # 部分ユニーク（activeは1件）
        db.execute(text("""
            CREATE UNIQUE INDEX uq_one_active_per_question
            ON official_questions (shiken_type, nendo, subject_id)
            WHERE status = 'active';
        """))
        db.execute(text("""
            CREATE INDEX idx_questions_lookup
            ON official_questions (shiken_type, nendo, subject_id, status);
        """))
        db.execute(text("""
            CREATE INDEX idx_questions_subject
            ON official_questions(subject_id);
        """))

        # データ移行（id維持）
        db.execute(text("""
            INSERT INTO official_questions (
              id, shiken_type, nendo, subject_id, version, status, text, syutudaisyusi, created_at, updated_at
            )
            SELECT
              id, shiken_type, nendo, subject_id, version, status, text, syutudaisyusi, created_at, updated_at
            FROM official_questions_old;
        """))
        db.commit()

        # 旧テーブルを保持したい場合は残す。不要なら drop できるが、ここでは残す。
        db.execute(text("PRAGMA foreign_keys=ON"))
        db.commit()

        logger.info("✓ official_questions table rebuilt")

    except Exception as e:
        db.rollback()
        logger.error(f"official_questions table migration failed: {str(e)}", exc_info=True)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate_official_questions_table()

