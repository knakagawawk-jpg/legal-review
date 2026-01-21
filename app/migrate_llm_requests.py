#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
LLM共通ログ用テーブルを作成するマイグレーション

- llm_requests

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
    from app.models import LlmRequest
except ImportError:
    import os
    os.chdir(str(BASE_DIR))
    from app.db import SessionLocal, engine
    from app.models import LlmRequest

from sqlalchemy import text


def _table_exists(db, table_name: str) -> bool:
    row = db.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name=:name"),
        {"name": table_name},
    ).fetchone()
    return row is not None


def migrate_llm_requests() -> None:
    """LLM共通ログテーブルを作成（存在しなければ）"""
    db = SessionLocal()
    try:
        logger.info("Starting llm_requests migration...")
        if not _table_exists(db, "llm_requests"):
            logger.info("Creating llm_requests table...")
            LlmRequest.__table__.create(bind=engine, checkfirst=True)
            db.commit()
            logger.info("✓ llm_requests table created")
        else:
            logger.info("✓ llm_requests table already exists")
        logger.info("✓ llm_requests migration completed successfully")
    except Exception as e:
        db.rollback()
        logger.error(f"llm_requests migration failed: {str(e)}", exc_info=True)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    try:
        migrate_llm_requests()
    except Exception as e:
        logger.error(f"Migration script failed: {str(e)}", exc_info=True)
        sys.exit(1)
