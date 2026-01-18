#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
problems.subject を「科目名文字列」→「科目ID(1-18)」へ移行するマイグレーション（SQLite想定）

サービス全体の強制ルール:
- 科目は 1〜18 の数字で保持
- 表示時のみ科目名へ変換
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
    from app.db import SessionLocal
except ImportError:
    import os
    os.chdir(str(BASE_DIR))
    from app.db import SessionLocal

from sqlalchemy import text
from config.subjects import get_subject_id


def _table_exists(db, table_name: str) -> bool:
    row = db.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name=:name"),
        {"name": table_name},
    ).fetchone()
    return bool(row)


def _subject_column_is_integer(db) -> bool:
    rows = db.execute(text("PRAGMA table_info(problems)")).fetchall()
    for r in rows:
        # (cid, name, type, notnull, dflt_value, pk)
        if r[1] == "subject":
            col_type = (r[2] or "").upper()
            return "INT" in col_type
    return False


def _coerce_subject_to_id(raw) -> int:
    if raw is None:
        return 1
    s = str(raw).strip()
    if s.isdigit():
        v = int(s)
        return v if 1 <= v <= 18 else 1
    sid = get_subject_id(s)
    return sid if sid and 1 <= sid <= 18 else 1


def migrate_problem_subject_to_int():
    db = SessionLocal()
    try:
        if not _table_exists(db, "problems"):
            return

        if _subject_column_is_integer(db):
            return

        logger.info("Migrating problems.subject to INTEGER (1-18)...")
        db.execute(text("PRAGMA foreign_keys=OFF"))

        # 新テーブル作成（subjectをINTEGERに）
        db.execute(text("""
            CREATE TABLE problems_new (
              id INTEGER PRIMARY KEY,
              exam_type VARCHAR(20) NOT NULL,
              year INTEGER NOT NULL,
              subject INTEGER NOT NULL CHECK(subject BETWEEN 1 AND 18),
              question_text TEXT NOT NULL,
              scoring_notes TEXT NULL,
              purpose TEXT NULL,
              other_info TEXT NULL,
              pdf_path VARCHAR(500) NULL,
              created_at DATETIME NULL,
              updated_at DATETIME NULL
            );
        """))

        rows = db.execute(text("""
            SELECT id, exam_type, year, subject, question_text, scoring_notes, purpose, other_info, pdf_path, created_at, updated_at
            FROM problems
        """)).fetchall()

        for r in rows:
            subject_id = _coerce_subject_to_id(r[3])
            if r[3] is not None and str(r[3]).strip() != str(subject_id):
                logger.info(f"Converted problem.subject {r[3]!r} -> {subject_id} (id={r[0]})")
            db.execute(
                text("""
                    INSERT INTO problems_new
                    (id, exam_type, year, subject, question_text, scoring_notes, purpose, other_info, pdf_path, created_at, updated_at)
                    VALUES
                    (:id, :exam_type, :year, :subject, :question_text, :scoring_notes, :purpose, :other_info, :pdf_path, :created_at, :updated_at)
                """),
                {
                    "id": r[0],
                    "exam_type": r[1],
                    "year": r[2],
                    "subject": subject_id,
                    "question_text": r[4],
                    "scoring_notes": r[5],
                    "purpose": r[6],
                    "other_info": r[7],
                    "pdf_path": r[8],
                    "created_at": r[9],
                    "updated_at": r[10],
                },
            )

        db.execute(text("DROP TABLE problems;"))
        db.execute(text("ALTER TABLE problems_new RENAME TO problems;"))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_problems_exam_year_subject ON problems(exam_type, year, subject);"))

        db.execute(text("PRAGMA foreign_keys=ON"))
        db.commit()
        logger.info("✓ problems.subject migration completed")
    except Exception as e:
        db.rollback()
        logger.error(f"problems.subject migration failed: {str(e)}", exc_info=True)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    try:
        migrate_problem_subject_to_int()
    except Exception as e:
        logger.error(f"Migration script failed: {str(e)}", exc_info=True)
        sys.exit(1)

