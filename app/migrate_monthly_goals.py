#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
ユーザー月別目標テーブル（user_monthly_goals）を作成するマイグレーション

- user_monthly_goals: 毎月の目標勉強時間・目標短答実施数・目標講評実施数

既存DBを壊さない方針:
- テーブルが無ければ作成
- 既にあれば何もしない
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
    from app.models import UserMonthlyGoal
except ImportError:
    import os
    os.chdir(str(BASE_DIR))
    from app.db import SessionLocal, engine
    from app.models import UserMonthlyGoal

from sqlalchemy import text


def _table_exists(db, table_name: str) -> bool:
    row = db.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name=:name"),
        {"name": table_name},
    ).fetchone()
    return row is not None


def _column_exists(db, table_name: str, column_name: str) -> bool:
    """SQLite: テーブルにカラムが存在するか"""
    if table_name != "user_monthly_goals":
        return False
    rows = db.execute(text("PRAGMA table_info(user_monthly_goals)")).fetchall()
    return any(r[1] == column_name for r in rows)


def migrate_monthly_goals() -> None:
    """user_monthly_goals テーブルを作成（存在しなければ）、不足カラムを追加"""
    db = SessionLocal()
    try:
        logger.info("Starting user_monthly_goals migration...")
        if not _table_exists(db, "user_monthly_goals"):
            logger.info("Creating user_monthly_goals table...")
            UserMonthlyGoal.__table__.create(bind=engine, checkfirst=True)
            db.commit()
            logger.info("✓ user_monthly_goals table created")
        else:
            logger.info("✓ user_monthly_goals table already exists")
            # 項目別 updated_at カラムを追加（既存DB用）
            for col in ("target_study_updated_at", "target_short_answer_updated_at", "target_review_updated_at"):
                if not _column_exists(db, "user_monthly_goals", col):
                    logger.info("Adding column user_monthly_goals.%s...", col)
                    db.execute(text(f"ALTER TABLE user_monthly_goals ADD COLUMN {col} DATETIME"))
                    db.commit()
                    logger.info("✓ user_monthly_goals.%s added", col)
        logger.info("✓ user_monthly_goals migration completed successfully")
    except Exception as e:
        db.rollback()
        logger.error(f"user_monthly_goals migration failed: {str(e)}", exc_info=True)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    try:
        migrate_monthly_goals()
    except Exception as e:
        logger.error(f"Migration script failed: {str(e)}", exc_info=True)
        sys.exit(1)
