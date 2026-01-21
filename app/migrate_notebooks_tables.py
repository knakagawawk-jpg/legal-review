#!/usr/bin/env python3
"""
notebooks, note_sections, note_pages テーブルを作成するマイグレーションスクリプト

SQLite の create_all は既存DBに新しいテーブルを追加できるが、
念のため IF NOT EXISTS で安全に作成する。

使い方:
    cd law-review/app
    python migrate_notebooks_tables.py
"""

import logging
import sys
from sqlalchemy import text
from database import engine

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def migrate():
    """ノートブック関連のテーブルを作成"""
    
    ddl_statements = [
        # notebooks テーブル
        """
        CREATE TABLE IF NOT EXISTS notebooks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            subject_id INTEGER NOT NULL,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            color VARCHAR(20),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            CHECK (subject_id BETWEEN 1 AND 18)
        )
        """,
        
        # notebooks インデックス
        "CREATE INDEX IF NOT EXISTS ix_notebooks_id ON notebooks (id)",
        "CREATE INDEX IF NOT EXISTS ix_notebooks_user_id ON notebooks (user_id)",
        "CREATE INDEX IF NOT EXISTS ix_notebooks_subject_id ON notebooks (subject_id)",
        "CREATE INDEX IF NOT EXISTS idx_user_notebooks ON notebooks (user_id, created_at)",
        "CREATE INDEX IF NOT EXISTS idx_user_subject_notebooks ON notebooks (user_id, subject_id, created_at)",
        
        # note_sections テーブル
        """
        CREATE TABLE IF NOT EXISTS note_sections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            notebook_id INTEGER NOT NULL,
            title VARCHAR(200) NOT NULL,
            display_order INTEGER DEFAULT 0 NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            FOREIGN KEY(notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
        )
        """,
        
        # note_sections インデックス
        "CREATE INDEX IF NOT EXISTS ix_note_sections_id ON note_sections (id)",
        "CREATE INDEX IF NOT EXISTS ix_note_sections_notebook_id ON note_sections (notebook_id)",
        "CREATE INDEX IF NOT EXISTS idx_notebook_sections ON note_sections (notebook_id, display_order)",
        
        # note_pages テーブル
        """
        CREATE TABLE IF NOT EXISTS note_pages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            section_id INTEGER NOT NULL,
            title VARCHAR(200),
            content TEXT,
            display_order INTEGER DEFAULT 0 NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            FOREIGN KEY(section_id) REFERENCES note_sections(id) ON DELETE CASCADE
        )
        """,
        
        # note_pages インデックス
        "CREATE INDEX IF NOT EXISTS ix_note_pages_id ON note_pages (id)",
        "CREATE INDEX IF NOT EXISTS ix_note_pages_section_id ON note_pages (section_id)",
        "CREATE INDEX IF NOT EXISTS idx_section_pages ON note_pages (section_id, display_order)",
    ]
    
    with engine.connect() as conn:
        for stmt in ddl_statements:
            try:
                conn.execute(text(stmt.strip()))
                logger.info(f"Executed: {stmt.strip()[:60]}...")
            except Exception as e:
                # 既に存在する場合などはスキップ
                logger.warning(f"Skipped (may already exist): {e}")
        
        conn.commit()
    
    logger.info("✓ ノートブック関連テーブルのマイグレーション完了")


if __name__ == "__main__":
    try:
        migrate()
    except Exception as e:
        logger.error(f"Migration failed: {e}", exc_info=True)
        sys.exit(1)
