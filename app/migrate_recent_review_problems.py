#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
最近の復習問題（ダッシュボード）用テーブルを作成するマイグレーション

- recent_review_problem_sessions
- recent_review_problems
- saved_review_problems

既存DBを壊さない方針:
- テーブルが無ければ作成
- 既にあれば何もしない（列追加などは将来必要になったら追記）
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
    from app.models import RecentReviewProblemSession, RecentReviewProblem, SavedReviewProblem
except ImportError:
    import os
    os.chdir(str(BASE_DIR))
    from app.db import SessionLocal, engine
    from app.models import RecentReviewProblemSession, RecentReviewProblem, SavedReviewProblem

from sqlalchemy import text


def _table_exists(db, table_name: str) -> bool:
    row = db.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name=:name"),
        {"name": table_name},
    ).fetchone()
    return row is not None


def migrate_recent_review_problems() -> None:
    """最近の復習問題用テーブルを作成（存在しなければ）"""
    db = SessionLocal()
    try:
        logger.info("Starting recent review problems migration...")

        # sessions
        if not _table_exists(db, "recent_review_problem_sessions"):
            logger.info("Creating recent_review_problem_sessions table...")
            RecentReviewProblemSession.__table__.create(bind=engine, checkfirst=True)
            db.commit()
            logger.info("✓ recent_review_problem_sessions table created")
        else:
            logger.info("✓ recent_review_problem_sessions table already exists")

        # problems
        if not _table_exists(db, "recent_review_problems"):
            logger.info("Creating recent_review_problems table...")
            RecentReviewProblem.__table__.create(bind=engine, checkfirst=True)
            db.commit()
            logger.info("✓ recent_review_problems table created")
        else:
            logger.info("✓ recent_review_problems table already exists")

        # saved
        if not _table_exists(db, "saved_review_problems"):
            logger.info("Creating saved_review_problems table...")
            SavedReviewProblem.__table__.create(bind=engine, checkfirst=True)
            db.commit()
            logger.info("✓ saved_review_problems table created")
        else:
            logger.info("✓ saved_review_problems table already exists")

        logger.info("✓ recent review problems migration completed successfully")

    except Exception as e:
        db.rollback()
        logger.error(f"recent review problems migration failed: {str(e)}", exc_info=True)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    try:
        migrate_recent_review_problems()
    except Exception as e:
        logger.error(f"Migration script failed: {str(e)}", exc_info=True)
        sys.exit(1)

