#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
review追加チケット付与テーブルを作成するマイグレーション

- user_review_ticket_grants
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
    from app.db import SessionLocal, engine
    from app.models import UserReviewTicketGrant
except ImportError:
    import os
    os.chdir(str(BASE_DIR))
    from app.db import SessionLocal, engine
    from app.models import UserReviewTicketGrant

from sqlalchemy import text


def _table_exists(db, table_name: str) -> bool:
    row = db.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name=:name"),
        {"name": table_name},
    ).fetchone()
    return row is not None


def migrate_review_ticket_grants() -> None:
    db = SessionLocal()
    try:
        logger.info("Starting review ticket grants migration...")
        if not _table_exists(db, "user_review_ticket_grants"):
            logger.info("Creating user_review_ticket_grants table...")
            UserReviewTicketGrant.__table__.create(bind=engine, checkfirst=True)
            db.commit()
            logger.info("✓ user_review_ticket_grants table created")
        else:
            logger.info("✓ user_review_ticket_grants table already exists")
        logger.info("✓ review ticket grants migration completed successfully")
    except Exception as e:
        db.rollback()
        logger.error(f"review ticket grants migration failed: {str(e)}", exc_info=True)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    try:
        migrate_review_ticket_grants()
    except Exception as e:
        logger.error(f"Migration script failed: {str(e)}", exc_info=True)
        sys.exit(1)
