#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
threads テーブルに講評チャット用カラムを追加するマイグレーション
- conversation_summary, summary_up_to_turn（要約）
- last_section_mention_turn, last_section_paragraph_numbers（§N 次回・次々回用）
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


def _table_exists(db, table_name: str) -> bool:
    row = db.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name=:name"),
        {"name": table_name},
    ).fetchone()
    return row is not None


def _get_columns(db, table_name: str) -> list:
    rows = db.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
    return [r[1] for r in rows]


def migrate_threads_conversation_summary() -> None:
    """threads に conversation_summary, summary_up_to_turn, last_section_mention_turn, last_section_paragraph_numbers を追加"""
    db = SessionLocal()
    try:
        logger.info("Starting threads conversation_summary / section columns migration...")
        if not _table_exists(db, "threads"):
            logger.warning("threads table not found. Skipping.")
            return
        cols = set(_get_columns(db, "threads"))
        additions = [
            ("conversation_summary", "ALTER TABLE threads ADD COLUMN conversation_summary TEXT"),
            ("summary_up_to_turn", "ALTER TABLE threads ADD COLUMN summary_up_to_turn INTEGER"),
            ("last_section_mention_turn", "ALTER TABLE threads ADD COLUMN last_section_mention_turn INTEGER"),
            ("last_section_paragraph_numbers", "ALTER TABLE threads ADD COLUMN last_section_paragraph_numbers TEXT"),
        ]
        for name, stmt in additions:
            if name not in cols:
                db.execute(text(stmt))
                db.commit()
                logger.info("✓ Added column: %s", name)
            else:
                logger.info("✓ Column already exists: %s", name)
        logger.info("✓ threads conversation_summary migration completed successfully")
    except Exception as e:
        db.rollback()
        logger.error("threads conversation_summary migration failed: %s", e, exc_info=True)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate_threads_conversation_summary()
