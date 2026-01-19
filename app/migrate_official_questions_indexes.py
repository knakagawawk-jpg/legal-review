#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
official_questions のインデックス/制約マイグレーション（SQLite/PostgreSQL共通の最低限）

- (shiken_type, nendo, subject_id, version) の一意性はテーブル制約で担保（create_all済み前提）
- status='active' は同一 (shiken_type, nendo, subject_id) で1件だけにする（部分ユニーク）

既存DBには create_all が適用されないので、IF NOT EXISTS で作成する。
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


def migrate_official_questions_indexes() -> None:
    db = SessionLocal()
    try:
        logger.info("Ensuring official_questions indexes...")

        # 公式問題テーブルが無い環境もあるため、存在チェック
        table_exists = db.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='official_questions'")
        ).fetchone()
        if not table_exists:
            logger.info("official_questions table not found. Skipping index migration.")
            return

        # activeを1つに制限（oldは複数可）
        # SQLite: 部分ユニークインデックスが使用可能
        db.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_per_question
            ON official_questions (shiken_type, nendo, subject_id)
            WHERE status = 'active';
        """))

        # 参照/検索用（冪等）
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_questions_lookup
            ON official_questions (shiken_type, nendo, subject_id, status);
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_questions_subject
            ON official_questions(subject_id);
        """))

        db.commit()
        logger.info("✓ official_questions index migration completed")
    except Exception as e:
        db.rollback()
        logger.error(f"official_questions index migration failed: {str(e)}", exc_info=True)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate_official_questions_indexes()

