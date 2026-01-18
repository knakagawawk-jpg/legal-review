#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
study_items テーブル追加（既存DB向けの軽量マイグレーション）
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
        CREATE TABLE IF NOT EXISTS study_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,

            entry_type INTEGER NOT NULL,
            subject_id INTEGER,

            item VARCHAR(500) NOT NULL,
            importance INTEGER NOT NULL DEFAULT 1,
            content TEXT NOT NULL,
            memo TEXT,

            official_question_id BIGINT,
            note_page_id INTEGER,

            is_favorite BOOLEAN NOT NULL DEFAULT 0,
            mastery_level INTEGER,
            view_count INTEGER NOT NULL DEFAULT 0,
            last_viewed_at DATETIME,

            tags TEXT,

            created_date DATETIME NOT NULL,
            position INTEGER NOT NULL,

            created_at DATETIME DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
            updated_at DATETIME DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
            deleted_at DATETIME,

            CONSTRAINT ck_study_item_entry_type CHECK (entry_type IN (1, 2)),
            CONSTRAINT ck_study_item_subject CHECK (subject_id IS NULL OR (subject_id BETWEEN 1 AND 18)),
            CONSTRAINT ck_study_item_importance CHECK (importance BETWEEN 1 AND 3),
            CONSTRAINT ck_study_item_mastery CHECK (mastery_level IS NULL OR (mastery_level BETWEEN 1 AND 5)),

            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(official_question_id) REFERENCES official_questions(id) ON DELETE SET NULL,
            FOREIGN KEY(note_page_id) REFERENCES note_pages(id) ON DELETE SET NULL
        );
        """))

        # インデックス（SQLAlchemy定義と同等レベル）
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_study_items_user_subject_type ON study_items (user_id, subject_id, entry_type, deleted_at);"))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_study_items_user_type_deleted ON study_items (user_id, entry_type, deleted_at);"))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_study_items_position ON study_items (user_id, subject_id, entry_type, position);"))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_study_items_favorite ON study_items (user_id, is_favorite, deleted_at);"))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_study_items_last_viewed ON study_items (user_id, last_viewed_at);"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_study_items_user_id ON study_items (user_id);"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_study_items_subject_id ON study_items (subject_id);"))

        # updated_at 自動更新（dashboard_items と同じ方針）
        db.execute(text("""
        CREATE TRIGGER IF NOT EXISTS trg_study_items_updated_at
        AFTER UPDATE ON study_items
        FOR EACH ROW
        WHEN NEW.updated_at = OLD.updated_at
        BEGIN
            UPDATE study_items
            SET updated_at = datetime('now')
            WHERE id = NEW.id;
        END;
        """))

        db.commit()
        logger.info("✓ study_items migration completed")
    except Exception as e:
        db.rollback()
        logger.error(f"study_items migration failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()

