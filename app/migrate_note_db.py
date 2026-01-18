#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
科目別ノートDBのマイグレーションスクリプト

NOTE_DB.md の要件に合わせて:
- notebooks に subject_id（1-18） を追加して科目に紐付け
- note_pages.title を nullable に変更（任意項目名）

SQLiteを想定し、必要に応じてテーブル再作成を行う。
"""

import sys
import logging
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# プロジェクトルートをパスに追加（Docker/ローカル両対応）
BASE_DIR = Path("/app") if Path("/app").exists() else Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))

try:
    from app.db import SessionLocal, engine
except ImportError:
    import os
    os.chdir(str(BASE_DIR))
    from app.db import SessionLocal, engine

from sqlalchemy import text


def _column_exists(db, table_name: str, column_name: str) -> bool:
    rows = db.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
    # PRAGMA table_info: (cid, name, type, notnull, dflt_value, pk)
    return any(r[1] == column_name for r in rows)


def _note_pages_title_is_notnull(db) -> bool:
    rows = db.execute(text("PRAGMA table_info(note_pages)")).fetchall()
    for r in rows:
        if r[1] == "title":
            return bool(r[3])  # notnull
    return False


def migrate_note_db(default_subject_id: int = 1):
    db = SessionLocal()
    try:
        logger.info("Starting note DB migration...")

        if not (1 <= default_subject_id <= 18):
            raise ValueError("default_subject_id must be 1-18")

        # 1) notebooks.subject_id 追加
        logger.info("Ensuring notebooks.subject_id column exists...")
        if not _column_exists(db, "notebooks", "subject_id"):
            db.execute(text("ALTER TABLE notebooks ADD COLUMN subject_id INTEGER;"))
            db.execute(text("CREATE INDEX IF NOT EXISTS idx_notebooks_user_subject_created ON notebooks(user_id, subject_id, created_at);"))
            db.commit()

        # 2) 既存notebookをデフォルト科目へ紐付け（移行元に科目情報が無いので一律）
        logger.info("Backfilling notebooks.subject_id with default...")
        db.execute(
            text("""
                UPDATE notebooks
                SET subject_id = :subject_id
                WHERE subject_id IS NULL
            """),
            {"subject_id": default_subject_id},
        )
        db.commit()

        # 3) note_pages.title を nullable に変更（SQLiteは列制約の変更ができないため再作成）
        logger.info("Ensuring note_pages.title is nullable...")
        # note_pagesが存在しない環境もあるので、存在チェック
        table_exists = db.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='note_pages'")
        ).fetchone()

        if table_exists and _note_pages_title_is_notnull(db):
            logger.info("Recreating note_pages table to make title nullable...")
            db.execute(text("PRAGMA foreign_keys=OFF"))

            db.execute(text("""
                CREATE TABLE note_pages_new (
                  id INTEGER NOT NULL PRIMARY KEY,
                  section_id INTEGER NOT NULL,
                  title VARCHAR(200) NULL,
                  content TEXT NULL,
                  display_order INTEGER NOT NULL DEFAULT 0,
                  created_at DATETIME NOT NULL,
                  updated_at DATETIME NOT NULL,
                  FOREIGN KEY(section_id) REFERENCES note_sections(id) ON DELETE CASCADE
                );
            """))

            db.execute(text("""
                INSERT INTO note_pages_new (id, section_id, title, content, display_order, created_at, updated_at)
                SELECT id, section_id, title, content, display_order, created_at, updated_at
                FROM note_pages;
            """))

            db.execute(text("DROP TABLE note_pages;"))
            db.execute(text("ALTER TABLE note_pages_new RENAME TO note_pages;"))
            db.execute(text("CREATE INDEX IF NOT EXISTS idx_section_pages ON note_pages(section_id, display_order);"))

            db.execute(text("PRAGMA foreign_keys=ON"))
            db.commit()

        logger.info("✓ Note DB migration completed successfully")
    except Exception as e:
        db.rollback()
        logger.error(f"Note DB migration failed: {str(e)}", exc_info=True)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    try:
        migrate_note_db()
    except Exception as e:
        logger.error(f"Migration script failed: {str(e)}", exc_info=True)
        sys.exit(1)

