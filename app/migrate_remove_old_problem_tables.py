#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
旧ProblemMetadata/ProblemDetailsシステムを削除するマイグレーション

処理内容:
1. submissionsテーブルからproblem_metadata_idとproblem_details_idカラムを削除
2. problem_metadataテーブルを削除
3. problem_detailsテーブルを削除

冪等性:
- カラムが既に存在しない場合はスキップ
- テーブルが存在しない場合もスキップ
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
    from app.db import SessionLocal, DATABASE_URL
except ImportError:
    import os
    os.chdir(str(BASE_DIR))
    from app.db import SessionLocal, DATABASE_URL

from sqlalchemy import text, inspect


def _table_exists(db, name: str) -> bool:
    """テーブルが存在するかチェック"""
    inspector = inspect(db.bind)
    return name in inspector.get_table_names()


def _column_exists(db, table: str, column: str) -> bool:
    """カラムが存在するかチェック"""
    inspector = inspect(db.bind)
    columns = [col["name"] for col in inspector.get_columns(table)]
    return column in columns


def _is_sqlite(db) -> bool:
    """SQLiteかどうかを判定"""
    return "sqlite" in DATABASE_URL.lower()


def migrate_remove_old_problem_tables() -> None:
    """旧ProblemMetadata/ProblemDetailsシステムを削除"""
    db = SessionLocal()
    try:
        # 1. submissionsテーブルからproblem_metadata_idとproblem_details_idカラムを削除
        if _table_exists(db, "submissions"):
            if _column_exists(db, "submissions", "problem_metadata_id"):
                logger.info("Removing problem_metadata_id column from submissions...")
                if _is_sqlite(db):
                    # SQLiteはALTER TABLE DROP COLUMNをサポート（SQLite 3.35.0以降）
                    # 古いバージョンの場合は、新しいテーブルを作成してデータを移行する必要がある
                    try:
                        db.execute(text("ALTER TABLE submissions DROP COLUMN problem_metadata_id;"))
                        db.commit()
                        logger.info("✓ Removed problem_metadata_id column")
                    except Exception as e:
                        logger.warning(f"Failed to drop problem_metadata_id column (SQLite version may be old): {e}")
                        logger.info("Skipping column removal (will be handled by model update)")
                else:
                    # PostgreSQL
                    db.execute(text("ALTER TABLE submissions DROP COLUMN IF EXISTS problem_metadata_id;"))
                    db.commit()
                    logger.info("✓ Removed problem_metadata_id column")
            else:
                logger.info("problem_metadata_id column not found. Skipping.")

            if _column_exists(db, "submissions", "problem_details_id"):
                logger.info("Removing problem_details_id column from submissions...")
                if _is_sqlite(db):
                    try:
                        db.execute(text("ALTER TABLE submissions DROP COLUMN problem_details_id;"))
                        db.commit()
                        logger.info("✓ Removed problem_details_id column")
                    except Exception as e:
                        logger.warning(f"Failed to drop problem_details_id column (SQLite version may be old): {e}")
                        logger.info("Skipping column removal (will be handled by model update)")
                else:
                    # PostgreSQL
                    db.execute(text("ALTER TABLE submissions DROP COLUMN IF EXISTS problem_details_id;"))
                    db.commit()
                    logger.info("✓ Removed problem_details_id column")
            else:
                logger.info("problem_details_id column not found. Skipping.")
        else:
            logger.info("submissions table not found. Skipping column removal.")

        # 2. problem_metadataテーブルを削除
        if _table_exists(db, "problem_metadata"):
            logger.info("Dropping problem_metadata table...")
            db.execute(text("DROP TABLE IF EXISTS problem_metadata;"))
            db.commit()
            logger.info("✓ Dropped problem_metadata table")
        else:
            logger.info("problem_metadata table not found. Skipping.")

        # 3. problem_detailsテーブルを削除
        if _table_exists(db, "problem_details"):
            logger.info("Dropping problem_details table...")
            db.execute(text("DROP TABLE IF EXISTS problem_details;"))
            db.commit()
            logger.info("✓ Dropped problem_details table")
        else:
            logger.info("problem_details table not found. Skipping.")

        logger.info("✓ Migration completed successfully")

    except Exception as e:
        db.rollback()
        logger.error(f"Migration failed: {str(e)}", exc_info=True)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate_remove_old_problem_tables()
