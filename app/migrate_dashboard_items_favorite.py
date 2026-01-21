#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
dashboard_items テーブルに favorite カラムを追加するマイグレーション
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
    from app.models import DashboardItem
except ImportError:
    import os
    os.chdir(str(BASE_DIR))
    from app.db import SessionLocal, engine
    from app.models import DashboardItem

from sqlalchemy import text


def _table_exists(db, table_name: str) -> bool:
    row = db.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name=:name"),
        {"name": table_name},
    ).fetchone()
    return row is not None


def _get_columns(db, table_name: str) -> list[str]:
    rows = db.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
    # PRAGMA table_info: (cid, name, type, notnull, dflt_value, pk)
    return [r[1] for r in rows]


def migrate_dashboard_items_favorite() -> None:
    """dashboard_items テーブルに favorite カラムを追加"""
    db = SessionLocal()
    try:
        logger.info("Starting dashboard_items favorite column migration...")

        if not _table_exists(db, "dashboard_items"):
            logger.info("dashboard_items table not found. Creating table...")
            DashboardItem.__table__.create(bind=engine, checkfirst=True)
            db.commit()
            logger.info("✓ dashboard_items table created")
            return

        cols = set(_get_columns(db, "dashboard_items"))

        # favoriteカラムが存在しない場合のみ追加
        if "favorite" not in cols:
            logger.info("Adding favorite column to dashboard_items...")
            # SQLiteではNOT NULLで追加するにはDEFAULTが必須
            db.execute(text("ALTER TABLE dashboard_items ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;"))
            db.commit()
            logger.info("✓ favorite column added to dashboard_items")
        else:
            logger.info("✓ favorite column already exists in dashboard_items")

        logger.info("✓ dashboard_items favorite migration completed successfully")

    except Exception as e:
        db.rollback()
        logger.error(f"dashboard_items favorite migration failed: {str(e)}", exc_info=True)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    try:
        migrate_dashboard_items_favorite()
    except Exception as e:
        logger.error(f"Migration script failed: {str(e)}", exc_info=True)
        sys.exit(1)
