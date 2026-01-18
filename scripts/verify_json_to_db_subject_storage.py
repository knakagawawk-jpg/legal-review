#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
JSON→DB取り込み時に subject が「数値（INTEGER）」で保存されることを検証するスクリプト。

使い方:
  # 例: 一時DBに1件入れて、SQLiteの typeof(subject) を確認
  # PowerShell:
  #   $env:DATABASE_URL="sqlite:///./tmp_import_test.db"
  #   python scripts/verify_json_to_db_subject_storage.py "data/json/preliminary_exam/R6/R6_予備_倒 産 法.json"
"""

import json
import sqlite3
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))


def _normalize_subject_id(subject: object, subject_name: object) -> int:
    from config.subjects import get_subject_id
    # subject優先（int or str想定）。空白混入は除去。
    def _to_id(v: object) -> int | None:
        if v is None:
            return None
        if isinstance(v, int):
            return v
        s = "".join(str(v).split())
        if not s:
            return None
        if s.isdigit():
            return int(s)
        return get_subject_id(s)

    subject_id = _to_id(subject)
    if subject_id is None:
        subject_id = _to_id(subject_name)
    if subject_id is None or not (1 <= subject_id <= 18):
        raise ValueError(f"invalid subject/subject_name: subject={subject!r}, subject_name={subject_name!r}")
    return subject_id


def main():
    if len(sys.argv) >= 2:
        json_path = Path(sys.argv[1])
    else:
        # コマンドラインで日本語パスが文字化けする環境があるため、デフォルトで1件拾って検証する
        candidates = sorted((BASE_DIR / "data" / "json").rglob("*.json"))
        if not candidates:
            print("[ng] no json files under data/json")
            sys.exit(2)
        json_path = candidates[0]
        print(f"[info] using default json: {json_path}")
    data = json.loads(json_path.read_text(encoding="utf-8"))

    exam_type = data.get("exam_type")
    # 取り込み側の正規化に合わせる
    if exam_type == "予備":
        exam_type = "予備試験"
    elif exam_type == "司法":
        exam_type = "司法試験"

    # yearは本テストの主目的ではないので固定値（INTEGER）で入れる
    subject_id = _normalize_subject_id(data.get("subject"), data.get("subject_name"))

    # DB作成/投入
    from app.db import engine, Base, SessionLocal, DATABASE_URL
    from app.models import ProblemMetadata, ProblemDetails

    # SQLite環境では他テーブル（JSONB等）でDDLが失敗し得るため、必要なテーブルだけ作成する
    Base.metadata.drop_all(bind=engine, tables=[ProblemDetails.__table__, ProblemMetadata.__table__])
    Base.metadata.create_all(bind=engine, tables=[ProblemMetadata.__table__, ProblemDetails.__table__])

    db = SessionLocal()
    try:
        m = ProblemMetadata(exam_type=str(exam_type or ""), year=2024, subject=subject_id)
        db.add(m)
        db.flush()
        d = ProblemDetails(
            problem_metadata_id=m.id,
            question_number=1,
            question_text=(data.get("text") or "")[:10] + "...",
            purpose=None,
            scoring_notes=None,
            pdf_path=data.get("source_pdf"),
        )
        db.add(d)
        db.commit()
    finally:
        db.close()

    # SQLiteの場合のみ typeof(subject) を確認
    if not DATABASE_URL.startswith("sqlite:///"):
        print(f"[skip] DATABASE_URL is not sqlite: {DATABASE_URL}")
        sys.exit(0)

    sqlite_path = DATABASE_URL.replace("sqlite:///", "", 1)
    con = sqlite3.connect(sqlite_path)
    try:
        cur = con.cursor()
        cur.execute("select subject, typeof(subject) from problem_metadata limit 1")
        row = cur.fetchone()
    finally:
        con.close()

    print({"db": sqlite_path, "row": row})
    if not row:
        print("[ng] no row inserted")
        sys.exit(1)
    if row[1] != "integer":
        print("[ng] subject is not stored as INTEGER")
        sys.exit(1)
    print("[ok] subject stored as INTEGER")


if __name__ == "__main__":
    main()

