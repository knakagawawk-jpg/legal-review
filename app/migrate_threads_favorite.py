#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
threads テーブルに favorite カラムを追加し、is_archived を削除するマイグレーション
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
    from app.models import Thread
except ImportError:
    import os
    os.chdir(str(BASE_DIR))
    from app.db import SessionLocal, engine
    from app.models import Thread

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


def migrate_threads_favorite() -> None:
    """threads テーブルに favorite カラムを追加し、is_archived を削除"""
    db = SessionLocal()
    try:
        logger.info("Starting threads favorite migration...")

        if not _table_exists(db, "threads"):
            logger.info("threads table not found. Creating table...")
            Thread.__table__.create(bind=engine, checkfirst=True)
            db.commit()
            logger.info("✓ threads table created")
            return

        cols = set(_get_columns(db, "threads"))

        # favoriteカラムが存在しない場合のみ追加
        if "favorite" not in cols:
            logger.info("Adding favorite column to threads...")
            # SQLiteではNOT NULLで追加するにはDEFAULTが必須
            db.execute(text("ALTER TABLE threads ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;"))
            db.commit()
            logger.info("✓ favorite column added to threads")
        else:
            logger.info("✓ favorite column already exists in threads")

        # is_archivedカラムが存在する場合は削除（SQLiteでは直接削除できないため、テーブル再作成）
        if "is_archived" in cols:
            logger.info("Removing is_archived column from threads...")
            # SQLiteではALTER TABLE DROP COLUMNが使えないため、テーブル再作成が必要
            # ただし、データを保持する必要があるため、バックアップ→再作成→データ移行
            db.execute(text("PRAGMA foreign_keys=OFF"))
            
            # バックアップテーブル作成
            db.execute(text("CREATE TABLE threads_backup AS SELECT * FROM threads;"))
            db.commit()
            
            # 旧インデックス削除
            for idx in [
                "idx_threads_user_type_archived_pinned_last",
                "idx_threads_user_type_archived_last",
            ]:
                db.execute(text(f"DROP INDEX IF EXISTS {idx};"))
            db.commit()
            
            # 旧テーブル削除
            db.execute(text("DROP TABLE threads;"))
            db.commit()
            
            # 新テーブル作成（is_archivedなし、favoriteあり）
            db.execute(text("""
                CREATE TABLE threads (
                    id INTEGER NOT NULL PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    type VARCHAR(20) NOT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    last_message_at DATETIME,
                    title VARCHAR(200),
                    favorite INTEGER NOT NULL DEFAULT 0,
                    pinned INTEGER NOT NULL DEFAULT 0,
                    CHECK (type IN ('free_chat', 'review_chat', 'short_answer_chat')),
                    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
                );
            """))
            db.commit()
            
            # データ移行（is_archivedを除外）
            db.execute(text("""
                INSERT INTO threads (id, user_id, type, created_at, last_message_at, title, favorite, pinned)
                SELECT id, user_id, type, created_at, last_message_at, title, 0, pinned
                FROM threads_backup;
            """))
            db.commit()
            
            # バックアップテーブル削除
            db.execute(text("DROP TABLE threads_backup;"))
            db.commit()
            
            # インデックス再作成
            db.execute(text("""
                CREATE INDEX idx_threads_user_type_archived_pinned_last 
                ON threads(user_id, type, pinned, last_message_at);
            """))
            db.execute(text("""
                CREATE INDEX idx_threads_user_type_archived_last 
                ON threads(user_id, type, last_message_at);
            """))
            db.execute(text("CREATE INDEX ix_threads_user_id ON threads(user_id);"))
            db.commit()
            
            db.execute(text("PRAGMA foreign_keys=ON"))
            logger.info("✓ is_archived column removed from threads")
        else:
            logger.info("✓ is_archived column does not exist in threads")

        logger.info("✓ threads favorite migration completed successfully")

    except Exception as e:
        db.rollback()
        logger.error(f"threads favorite migration failed: {str(e)}", exc_info=True)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    try:
        migrate_threads_favorite()
    except Exception as e:
        logger.error(f"Migration script failed: {str(e)}", exc_info=True)
        sys.exit(1)
