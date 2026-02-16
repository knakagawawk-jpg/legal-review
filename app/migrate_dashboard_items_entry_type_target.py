#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
dashboard_items の entry_type に 3=Target を許可するマイグレーション
（CHECK 制約を (1, 2) → (1, 2, 3) に変更。SQLite は制約変更にテーブル再作成が必要）
"""

import sys
import logging
import re
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

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


def _get_table_sql(db, table_name: str) -> str | None:
    row = db.execute(
        text("SELECT sql FROM sqlite_master WHERE type='table' AND name=:name"),
        {"name": table_name},
    ).fetchone()
    return row[0] if row else None


def migrate_dashboard_items_entry_type_target() -> None:
    """entry_type に 3 (Target) を許可するよう CHECK 制約を更新"""
    db = SessionLocal()
    try:
        logger.info("Starting dashboard_items entry_type=3 (Target) migration...")

        if not _table_exists(db, "dashboard_items"):
            logger.info("dashboard_items table not found. Creating with current model...")
            DashboardItem.__table__.create(bind=engine, checkfirst=True)
            db.commit()
            logger.info("✓ dashboard_items table created")
            return

        sql = _get_table_sql(db, "dashboard_items")
        if not sql:
            logger.warning("Could not read dashboard_items schema")
            return

        # 既に新制約ならスキップ
        if "entry_type IN (1, 2, 3)" in sql or "ck_point_target_no_due_date" in sql:
            logger.info("✓ entry_type=3 already supported")
            return

        if "entry_type IN (1, 2)" not in sql:
            logger.info("✓ No old entry_type constraint found, skipping")
            return

        logger.info("Recreating dashboard_items with new constraints...")

        # 新テーブル用の CREATE 文を作成（制約のみ置換）
        new_sql = sql.replace("entry_type IN (1, 2)", "entry_type IN (1, 2, 3)")
        new_sql = re.sub(
            r"entry_type\s*!=\s*1\s+OR\s+due_date\s+IS\s+NULL",
            "(entry_type != 1 AND entry_type != 3) OR due_date IS NULL",
            new_sql,
            flags=re.IGNORECASE,
        )
        new_sql = new_sql.replace("ck_point_no_due_date", "ck_point_target_no_due_date")
        new_sql = new_sql.replace("CREATE TABLE dashboard_items ", "CREATE TABLE dashboard_items_new ")

        db.execute(text(new_sql))
        db.execute(text("INSERT INTO dashboard_items_new SELECT * FROM dashboard_items"))
        db.execute(text("DROP TABLE dashboard_items"))
        db.execute(text("ALTER TABLE dashboard_items_new RENAME TO dashboard_items"))

        # インデックスを再作成（DROP TABLE で削除されるため）
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_dashboard_items_user_date_type
            ON dashboard_items (user_id, dashboard_date, entry_type)
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_dashboard_items_user_date_status
            ON dashboard_items (user_id, dashboard_date, status)
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_dashboard_items_user_date_deleted
            ON dashboard_items (user_id, dashboard_date, deleted_at)
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_dashboard_items_position
            ON dashboard_items (user_id, dashboard_date, entry_type, position)
        """))

        db.commit()
        logger.info("✓ dashboard_items recreated with entry_type IN (1, 2, 3)")

    except Exception as e:
        db.rollback()
        logger.error(f"dashboard_items entry_type=3 migration failed: {str(e)}", exc_info=True)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    try:
        migrate_dashboard_items_entry_type_target()
    except Exception as e:
        logger.error(f"Migration script failed: {str(e)}", exc_info=True)
        sys.exit(1)
