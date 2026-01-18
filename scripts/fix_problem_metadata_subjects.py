#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
problem_metadata.subject の修復スクリプト

背景:
- 科目を「数値ID（1-18）」で管理する仕様にした後でも、
  旧インポートスクリプト等により subject に科目名（例: "一般教養科目"）が混入し得る。
- SQLite は型が厳密でないため、Integer列でも文字列が入り、その結果 API 側の検証で落ちることがある。

使い方:
  python scripts/fix_problem_metadata_subjects.py --dry-run
  python scripts/fix_problem_metadata_subjects.py
"""

import argparse
import sys
from pathlib import Path


def _normalize_subject_id(subject_value):
    if subject_value is None:
        return None
    if isinstance(subject_value, int):
        return subject_value if 1 <= subject_value <= 18 else None
    if isinstance(subject_value, str):
        # "倒 産 法" のように途中に空白が入っているケースがあるため除去
        s = "".join(subject_value.split())
        if s.isdigit():
            try:
                v = int(s)
                return v if 1 <= v <= 18 else None
            except Exception:
                return None
        from config.subjects import get_subject_id  # 遅延import（sys.path設定後に解決するため）
        mapped = get_subject_id(s)
        return mapped if (mapped is not None and 1 <= mapped <= 18) else None
    return None


def main():
    parser = argparse.ArgumentParser(description="problem_metadata.subject を科目ID（1-18）へ正規化します")
    parser.add_argument("--dry-run", action="store_true", help="更新せず、変更候補だけ表示します")
    args = parser.parse_args()

    # プロジェクトルートを import パスへ
    base_dir = Path(__file__).resolve().parent.parent
    sys.path.insert(0, str(base_dir))

    from app.db import SessionLocal
    from app.models import ProblemMetadata
    from config.subjects import get_subject_name

    db = SessionLocal()
    try:
        rows = db.query(ProblemMetadata).all()
        updated = 0
        skipped = 0
        invalid = 0

        for m in rows:
            current = m.subject
            normalized = _normalize_subject_id(current)

            if normalized is None:
                # NULL/不正はそのまま（ここで無理に埋めると別の不整合を生む）
                invalid += 1
                continue

            if current == normalized:
                skipped += 1
                continue

            print(
                f"[fix] id={m.id}: subject {current!r} -> {normalized} ({get_subject_name(normalized)})"
            )
            if not args.dry_run:
                m.subject = normalized
                updated += 1

        if not args.dry_run:
            db.commit()

        print("----")
        print(f"rows={len(rows)} updated={updated} skipped={skipped} invalid_or_null={invalid} dry_run={args.dry_run}")
    finally:
        db.close()


if __name__ == "__main__":
    main()

