#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
study_tags テーブル追加（既存DB向けの軽量マイグレーション）
"""

import logging
from sqlalchemy import text

from app.db import SessionLocal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main() -> None:
    db = SessionLocal()
    try:
        # SQLite向けに IF NOT EXISTS で作成（本番/ローカル両対応）
        db.execute(text("""
        CREATE TABLE IF NOT EXISTS study_tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            subject_id INTEGER NOT NULL,
            name VARCHAR(100) NOT NULL,
            created_at DATETIME DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
            CONSTRAINT ck_study_tags_subject CHECK (subject_id BETWEEN 1 AND 18),
            CONSTRAINT uq_study_tags_user_subject_name UNIQUE (user_id, subject_id, name),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """))

        db.execute(text("CREATE INDEX IF NOT EXISTS idx_study_tags_user_subject ON study_tags (user_id, subject_id);"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_study_tags_user_id ON study_tags (user_id);"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_study_tags_subject_id ON study_tags (subject_id);"))

        db.commit()
        logger.info("✓ study_tags migration completed")
    except Exception as e:
        db.rollback()
        logger.error(f"study_tags migration failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()

