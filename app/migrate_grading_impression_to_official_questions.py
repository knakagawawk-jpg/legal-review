#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
採点実感をOfficialQuestionテーブルに統合するマイグレーション

処理内容:
1. official_questionsテーブルにgrading_impression_textカラムを追加（NULL可）
2. 既存のshihou_grading_impressionsテーブルのデータをofficial_questionsに移行
3. shihou_grading_impressionsテーブルを削除

冪等性:
- grading_impression_textカラムが既に存在する場合はスキップ
- shihou_grading_impressionsテーブルが存在しない場合もスキップ
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


def migrate_grading_impression_to_official_questions() -> None:
    """採点実感をOfficialQuestionテーブルに統合"""
    db = SessionLocal()
    try:
        # official_questionsテーブルの存在確認
        if not _table_exists(db, "official_questions"):
            logger.info("official_questions table not found. Skipping.")
            return

        # grading_impression_textカラムが既に存在するかチェック
        if _column_exists(db, "official_questions", "grading_impression_text"):
            logger.info("grading_impression_text column already exists. Skipping column addition.")
        else:
            logger.info("Adding grading_impression_text column to official_questions...")
            if _is_sqlite(db):
                # SQLite
                db.execute(text("ALTER TABLE official_questions ADD COLUMN grading_impression_text TEXT;"))
            else:
                # PostgreSQL
                db.execute(text("ALTER TABLE official_questions ADD COLUMN grading_impression_text TEXT;"))
            db.commit()
            logger.info("✓ Added grading_impression_text column")

        # shihou_grading_impressionsテーブルの存在確認
        if not _table_exists(db, "shihou_grading_impressions"):
            logger.info("shihou_grading_impressions table not found. Skipping data migration.")
        else:
            # データ移行
            logger.info("Migrating data from shihou_grading_impressions to official_questions...")
            
            if _is_sqlite(db):
                # SQLite
                result = db.execute(text("""
                    UPDATE official_questions
                    SET grading_impression_text = (
                        SELECT grading_impression_text 
                        FROM shihou_grading_impressions 
                        WHERE shihou_grading_impressions.question_id = official_questions.id
                    )
                    WHERE EXISTS (
                        SELECT 1 
                        FROM shihou_grading_impressions 
                        WHERE shihou_grading_impressions.question_id = official_questions.id
                    );
                """))
            else:
                # PostgreSQL
                result = db.execute(text("""
                    UPDATE official_questions oq
                    SET grading_impression_text = sgi.grading_impression_text
                    FROM shihou_grading_impressions sgi
                    WHERE oq.id = sgi.question_id;
                """))
            
            migrated_count = result.rowcount
            db.commit()
            logger.info(f"✓ Migrated {migrated_count} records from shihou_grading_impressions")

            # shihou_grading_impressionsテーブルを削除
            logger.info("Dropping shihou_grading_impressions table...")
            db.execute(text("DROP TABLE IF EXISTS shihou_grading_impressions;"))
            db.commit()
            logger.info("✓ Dropped shihou_grading_impressions table")

        logger.info("✓ Migration completed successfully")

    except Exception as e:
        db.rollback()
        logger.error(f"Migration failed: {str(e)}", exc_info=True)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate_grading_impression_to_official_questions()
