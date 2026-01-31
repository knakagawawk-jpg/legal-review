#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""H18～H20の司法試験JSONにsubject番号を付与するスクリプト"""

import json
import sys
from pathlib import Path

# configをインポートするためプロジェクトルートをパスに追加
sys.path.insert(0, str(Path(__file__).parent.parent))
from config.subjects import get_subject_id

BASE_DIR = Path(__file__).parent.parent / "data" / "json" / "judicial_exam"
YEARS = ["H18", "H19", "H20", "H23", "H24", "H25", "H26", "H27", "H28", "H29", "H30", "R1", "R2", "R3", "R4", "R5", "R6", "R7"]


def process_file(filepath: Path) -> bool:
    """単一ファイルにsubject番号を付与"""
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    subject_name = data.get("subject_name")
    if not subject_name:
        print(f"  スキップ（subject_nameなし）: {filepath.name}")
        return False

    subject_id = get_subject_id(subject_name)
    if subject_id is None:
        print(f"  警告: 科目名 '{subject_name}' に該当するIDがありません: {filepath.name}")
        return False

    data["subject"] = subject_id

    # キー順序: year, exam_type, subject_name, subject, text, source_pdf, purpose, scoring_notes
    ordered = {
        "year": data["year"],
        "exam_type": data["exam_type"],
        "subject_name": data["subject_name"],
        "subject": data["subject"],
        "text": data["text"],
        "source_pdf": data["source_pdf"],
    }
    if "purpose" in data:
        ordered["purpose"] = data["purpose"]
    if "scoring_notes" in data:
        ordered["scoring_notes"] = data["scoring_notes"]

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(ordered, f, ensure_ascii=False, indent=2)
    return True


def main():
    for year in YEARS:
        dir_path = BASE_DIR / year
        if not dir_path.exists():
            print(f"{year}: ディレクトリが存在しません")
            continue

        count = 0
        for f in sorted(dir_path.glob("*.json")):
            if process_file(f):
                count += 1
        print(f"{year}: {count}ファイルにsubjectを付与しました")

    print("完了しました。")


if __name__ == "__main__":
    main()
