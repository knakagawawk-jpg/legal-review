#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
reviews / user_review_history テーブルのマイグレーション

背景:
- 旧スキーマの reviews は (submission_id, review_markdown, review_json, ...) で管理していた
- 新スキーマの reviews は (user_id, source_type, official_question_id/custom_question_text, answer_text, kouhyo_kekka, ...) を前提としている
- SQLiteは create_all では既存テーブルの列追加・変更がされないため、古い dev.db だと挿入で落ちる

このスクリプトは以下を行う:
- reviews が旧スキーマの場合: 既存 reviews を reviews_old_* にリネーム → 新 reviews を作成 → 可能ならデータ移行
- user_review_history に新カラム（attempt_count, question_title, reference_text）が無い場合は追加

注意:
- 破壊的操作は避け、旧 reviews は残す（リネーム）方針
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
    from app.models import Review, UserReviewHistory
except ImportError:
    import os

    os.chdir(str(BASE_DIR))
    from app.db import SessionLocal, engine
    from app.models import Review, UserReviewHistory

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

def _get_table_info(db, table_name: str):
    return db.execute(text(f"PRAGMA table_info({table_name})")).fetchall()


def _sqlite_integer_primary_key(db, table_name: str, column_name: str) -> bool:
    """
    SQLiteで自動採番（rowid連動）を効かせるために必要な条件:
    - type が 'INTEGER'
    - pk が 1
    """
    rows = _get_table_info(db, table_name)
    for r in rows:
        # (cid, name, type, notnull, dflt_value, pk)
        if r[1] == column_name:
            col_type = (r[2] or "").upper()
            return (col_type == "INTEGER") and (int(r[5] or 0) == 1)
    return False


def _drop_reviews_indexes(db) -> None:
    """
    reviews を作り直す際、SQLiteでは「インデックス名がDB全体で一意」。
    旧テーブルに紐づくインデックス名が残っていると create_all が失敗する。
    """
    for idx in [
        # SQLAlchemyが自動生成する ix_*
        "ix_reviews_user_id",
        "ix_reviews_official_question_id",
        "ix_reviews_thread_id",
        # models.pyで定義している idx_*
        "idx_reviews_user_created",
        "idx_reviews_created",
        "idx_reviews_official_q",
        "idx_reviews_thread",
    ]:
        db.execute(text(f"DROP INDEX IF EXISTS {idx};"))


def _pick_backup_table_name(db, base: str = "reviews_old") -> str:
    name = base
    i = 1
    while _table_exists(db, name):
        i += 1
        name = f"{base}_{i}"
    return name


def _ensure_user_review_history_columns(db) -> None:
    if not _table_exists(db, "user_review_history"):
        # まだ無い環境ではテーブルを作成（checkfirstで冪等）
        UserReviewHistory.__table__.create(bind=engine, checkfirst=True)
        return

    # id が INTEGER PRIMARY KEY でないと自動採番されず INSERT が失敗するため、必要なら作り直す
    if not _sqlite_integer_primary_key(db, "user_review_history", "id"):
        logger.info("user_review_history has non-integer PK. Rebuilding to ensure autoincrement...")

        db.execute(text("PRAGMA foreign_keys=OFF"))
        backup_name = "user_review_history_old"
        # 既に存在する場合は連番を付ける
        i = 1
        while _table_exists(db, backup_name):
            i += 1
            backup_name = f"user_review_history_old_{i}"
        db.execute(text(f"ALTER TABLE user_review_history RENAME TO {backup_name};"))
        db.commit()
        db.execute(text("PRAGMA foreign_keys=ON"))

        # 旧インデックス名が残っていると衝突するため削除
        for idx in [
            "ix_user_review_history_user_id",
            "ix_user_review_history_review_id",
            "idx_user_review_history_created",
            "idx_user_review_history_review",
            "idx_user_review_history_subject",
            "idx_user_review_history_exam",
        ]:
            db.execute(text(f"DROP INDEX IF EXISTS {idx};"))
        db.commit()

        # 新テーブルを作成（SQLiteで確実に INTEGER PRIMARY KEY にするため手動DDL）
        db.execute(text("""
            CREATE TABLE user_review_history (
              id INTEGER NOT NULL PRIMARY KEY,
              user_id INTEGER NOT NULL,
              review_id INTEGER NOT NULL,
              subject VARCHAR(50),
              exam_type VARCHAR(20),
              year INTEGER,
              score NUMERIC(5, 2),
              score_breakdown TEXT,
              created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              attempt_count INTEGER NOT NULL DEFAULT 1,
              question_title VARCHAR(200),
              reference_text TEXT
            );
        """))
        # インデックス（冪等：CREATE INDEX IF NOT EXISTS）
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_user_review_history_created ON user_review_history(user_id, created_at);"))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_user_review_history_review ON user_review_history(review_id);"))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_user_review_history_subject ON user_review_history(user_id, subject, created_at);"))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_user_review_history_exam ON user_review_history(user_id, subject, exam_type, year);"))
        db.commit()

        # 同名列をコピー（best effort）
        old_cols = set(_get_columns(db, backup_name))
        new_cols = set(_get_columns(db, "user_review_history"))
        common = [c for c in [
            "id", "user_id", "review_id", "subject", "exam_type", "year", "score",
            "attempt_count", "question_title", "reference_text", "created_at"
        ] if (c in old_cols and c in new_cols)]
        if common:
            cols_sql = ", ".join(common)
            db.execute(text(f"INSERT OR IGNORE INTO user_review_history ({cols_sql}) SELECT {cols_sql} FROM {backup_name};"))
            db.commit()
        logger.info("✓ user_review_history rebuilt with INTEGER PRIMARY KEY")

    cols = set(_get_columns(db, "user_review_history"))

    # 追加カラム（新コードがINSERTする）
    if "attempt_count" not in cols:
        # NOT NULLで追加するにはDEFAULTが必須（SQLite）
        db.execute(text("ALTER TABLE user_review_history ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 1;"))
    if "question_title" not in cols:
        db.execute(text("ALTER TABLE user_review_history ADD COLUMN question_title VARCHAR(200);"))
    if "reference_text" not in cols:
        db.execute(text("ALTER TABLE user_review_history ADD COLUMN reference_text TEXT;"))


def migrate_reviews_tables(migrate_old_data: bool = True) -> None:
    """
    reviews が旧スキーマなら新スキーマへ移行する。

    migrate_old_data=True の場合:
    - 旧 reviews の (submission_id, review_json) を submissions から復元し、新 reviews に可能な範囲で移植する
      （review_id を維持して user_review_history との参照が生きるようにする）
    """
    db = SessionLocal()
    backup_table = None
    try:
        logger.info("Starting reviews/user_review_history migration...")

        # user_review_history: 列追加（先にやってもOK）
        _ensure_user_review_history_columns(db)
        db.commit()

        if not _table_exists(db, "reviews"):
            logger.info("reviews table not found. Creating new reviews table...")
            Review.__table__.create(bind=engine, checkfirst=True)
            db.commit()
            logger.info("✓ reviews table created")
            return

        cols = set(_get_columns(db, "reviews"))

        # 旧スキーマ判定: submission_id を持ち、source_type を持たない
        is_old_schema = ("submission_id" in cols) and ("source_type" not in cols)
        if not is_old_schema:
            # すでに新スキーマでも、id が INTEGER PRIMARY KEY でないと INSERT 時に id が入らず落ちる
            # （今回の NOT NULL constraint failed: reviews.id の原因）
            if not _sqlite_integer_primary_key(db, "reviews", "id"):
                logger.info("reviews table has non-integer PK. Rebuilding to ensure autoincrement...")

                db.execute(text("PRAGMA foreign_keys=OFF"))
                backup_table = _pick_backup_table_name(db, base="reviews_badid")
                db.execute(text(f"ALTER TABLE reviews RENAME TO {backup_table};"))
                db.commit()
                db.execute(text("PRAGMA foreign_keys=ON"))

                # 旧インデックス名が残っていると新規作成で衝突するため削除
                _drop_reviews_indexes(db)
                db.commit()

                Review.__table__.create(bind=engine, checkfirst=True)
                db.commit()

                # 可能な範囲でデータ移行（同名列をコピー）
                existing_cols = set(_get_columns(db, backup_table))
                target_cols = set(_get_columns(db, "reviews"))
                common = [c for c in [
                    "id", "user_id", "created_at", "updated_at", "source_type",
                    "official_question_id", "custom_question_text", "answer_text",
                    "kouhyo_kekka", "thread_id", "has_chat"
                ] if (c in existing_cols and c in target_cols)]

                if common:
                    cols_sql = ", ".join(common)
                    db.execute(text(f"INSERT OR IGNORE INTO reviews ({cols_sql}) SELECT {cols_sql} FROM {backup_table};"))
                    db.commit()
                logger.info("✓ reviews table rebuilt with INTEGER PRIMARY KEY")
                return

            # 追加の欠落列がある場合は最低限補完（将来の拡張用）
            logger.info("reviews table appears to be current schema. Ensuring required columns exist...")
            required = {
                "user_id": "BIGINT",
                "created_at": "DATETIME",
                "updated_at": "DATETIME",
                "source_type": "VARCHAR(10)",
                "official_question_id": "BIGINT",
                "custom_question_text": "TEXT",
                "answer_text": "TEXT",
                "kouhyo_kekka": "TEXT",
                "thread_id": "INTEGER",
                "has_chat": "BOOLEAN",
            }
            for col, col_type in required.items():
                if col not in cols:
                    # 可能な範囲でADD COLUMN（制約は後回し）
                    default_clause = ""
                    if col == "has_chat":
                        default_clause = " NOT NULL DEFAULT 0"
                    db.execute(text(f"ALTER TABLE reviews ADD COLUMN {col} {col_type}{default_clause};"))
            db.commit()
            logger.info("✓ reviews schema check completed")
            return

        logger.info("Old reviews schema detected. Renaming and recreating reviews table...")

        # 外部キー制約を無効化（SQLite用）
        db.execute(text("PRAGMA foreign_keys=OFF"))

        backup_table = _pick_backup_table_name(db, base="reviews_old")
        db.execute(text(f"ALTER TABLE reviews RENAME TO {backup_table};"))
        db.commit()

        # 外部キー制約を再有効化
        db.execute(text("PRAGMA foreign_keys=ON"))

        # 旧インデックス名が残っていると新規作成で衝突するため削除
        _drop_reviews_indexes(db)
        db.commit()

        # 新テーブル作成
        Review.__table__.create(bind=engine, checkfirst=True)
        db.commit()
        logger.info("✓ New reviews table created")

        # 旧データの移行（可能な範囲で）
        if migrate_old_data and backup_table:
            logger.info(f"Migrating data from {backup_table} -> reviews (best effort)...")
            # submissions から question_text / answer_text / user_id を復元
            # custom の CHECK 制約を満たすため custom_question_text は NULL にしない
            db.execute(
                text(f"""
                    INSERT OR IGNORE INTO reviews (
                      id,
                      user_id,
                      created_at,
                      updated_at,
                      source_type,
                      official_question_id,
                      custom_question_text,
                      answer_text,
                      kouhyo_kekka,
                      thread_id,
                      has_chat
                    )
                    SELECT
                      r.id,
                      s.user_id,
                      COALESCE(r.created_at, CURRENT_TIMESTAMP),
                      COALESCE(r.created_at, CURRENT_TIMESTAMP),
                      'custom',
                      NULL,
                      COALESCE(s.question_text, '(問題文なし)'),
                      s.answer_text,
                      COALESCE(r.review_json, '{{}}'),
                      NULL,
                      0
                    FROM {backup_table} r
                    JOIN submissions s ON s.id = r.submission_id
                """)
            )
            db.commit()
            logger.info("✓ Data migration completed (best effort)")

        logger.info("✓ reviews/user_review_history migration completed successfully")

    except Exception as e:
        db.rollback()
        logger.error(f"reviews migration failed: {str(e)}", exc_info=True)
        raise
    finally:
        db.close()


def migrate_reviews_and_history(migrate_old_data: bool = True) -> None:
    """外部から呼び出す用の統合関数（冪等）。"""
    migrate_reviews_tables(migrate_old_data=migrate_old_data)


if __name__ == "__main__":
    try:
        migrate_reviews_and_history(migrate_old_data=True)
    except Exception as e:
        logger.error(f"Migration script failed: {str(e)}", exc_info=True)
        sys.exit(1)

