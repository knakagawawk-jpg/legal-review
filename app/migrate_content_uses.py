#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
復習問題生成機能リニューアル用マイグレーション

- content_usesテーブルの作成
- recent_review_problem_sessionsテーブルにcandidate_pool_jsonカラムを追加

既存DBを壊さない方針:
- テーブルが無ければ作成
- カラムが無ければ追加
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
    from app.models import ContentUse, RecentReviewProblemSession
except ImportError:
    import os
    os.chdir(str(BASE_DIR))
    from app.db import SessionLocal, engine
    from app.models import ContentUse, RecentReviewProblemSession

from sqlalchemy import text, inspect


def _table_exists(db, table_name: str) -> bool:
    """テーブルが存在するか確認"""
    row = db.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name=:name"),
        {"name": table_name},
    ).fetchone()
    return row is not None


def _column_exists(db, table_name: str, column_name: str) -> bool:
    """カラムが存在するか確認"""
    inspector = inspect(engine)
    columns = [col["name"] for col in inspector.get_columns(table_name)]
    return column_name in columns


def migrate_content_uses() -> None:
    """content_usesテーブルとcandidate_pool_jsonカラムを作成"""
    db = SessionLocal()
    try:
        logger.info("Starting content_uses migration...")

        # content_usesテーブルの作成
        if not _table_exists(db, "content_uses"):
            logger.info("Creating content_uses table...")
            ContentUse.__table__.create(bind=engine, checkfirst=True)
            db.commit()
            logger.info("✓ content_uses table created")
        else:
            logger.info("✓ content_uses table already exists")

        # recent_review_problem_sessionsテーブルにcandidate_pool_jsonカラムを追加
        if _table_exists(db, "recent_review_problem_sessions"):
            if not _column_exists(db, "recent_review_problem_sessions", "candidate_pool_json"):
                logger.info("Adding candidate_pool_json column to recent_review_problem_sessions table...")
                db.execute(
                    text("ALTER TABLE recent_review_problem_sessions ADD COLUMN candidate_pool_json TEXT")
                )
                db.commit()
                logger.info("✓ candidate_pool_json column added")
            else:
                logger.info("✓ candidate_pool_json column already exists")
        else:
            logger.warning("recent_review_problem_sessions table does not exist, skipping column addition")

        logger.info("✓ content_uses migration completed successfully")

    except Exception as e:
        db.rollback()
        logger.error(f"content_uses migration failed: {str(e)}", exc_info=True)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    try:
        migrate_content_uses()
    except Exception as e:
        logger.error(f"Migration script failed: {str(e)}", exc_info=True)
        sys.exit(1)
