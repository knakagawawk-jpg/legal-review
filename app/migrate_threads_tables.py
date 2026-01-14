#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
threads/messagesテーブルのマイグレーションスクリプト
BigIntegerからIntegerに変更するため、テーブルを削除して再作成
"""

import sys
import logging
from pathlib import Path

# ロギング設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# プロジェクトルートをパスに追加
# Docker環境とローカル環境の両方に対応
BASE_DIR = Path("/app") if Path("/app").exists() else Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))

try:
    from app.db import SessionLocal, engine, Base
    from app.models import Thread, Message
except ImportError:
    # ローカル環境の場合
    import os
    os.chdir(str(BASE_DIR))
    from app.db import SessionLocal, engine, Base
    from app.models import Thread, Message

from sqlalchemy import text

def migrate_threads_tables():
    """threadsとmessagesテーブルを削除して再作成"""
    db = SessionLocal()
    
    try:
        logger.info("Starting threads/messages tables migration...")
        
        # 外部キー制約を無効化（SQLite用）
        db.execute(text("PRAGMA foreign_keys=OFF"))
        
        # messagesテーブルを削除（threadsより先に削除する必要がある）
        try:
            db.execute(text("DROP TABLE IF EXISTS messages"))
            logger.info("✓ Dropped messages table")
        except Exception as e:
            logger.warning(f"Could not drop messages table: {e}")
        
        # threadsテーブルを削除
        try:
            db.execute(text("DROP TABLE IF EXISTS threads"))
            logger.info("✓ Dropped threads table")
        except Exception as e:
            logger.warning(f"Could not drop threads table: {e}")
        
        # コミット
        db.commit()
        
        # 外部キー制約を再有効化
        db.execute(text("PRAGMA foreign_keys=ON"))
        
        # テーブルを再作成
        logger.info("Recreating threads and messages tables...")
        Thread.__table__.create(bind=engine, checkfirst=True)
        Message.__table__.create(bind=engine, checkfirst=True)
        
        logger.info("✓ Migration completed successfully")
        
    except Exception as e:
        db.rollback()
        logger.error(f"Migration failed: {str(e)}", exc_info=True)
        raise
    finally:
        db.close()

if __name__ == "__main__":
    try:
        migrate_threads_tables()
    except Exception as e:
        logger.error(f"Migration script failed: {str(e)}", exc_info=True)
        sys.exit(1)
