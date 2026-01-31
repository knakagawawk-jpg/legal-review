#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""H23司法試験JSON修正スクリプト
- 公法系、民事系、刑事系を個別科目に分割
- TextとPurposeからPDF由来の不要な改行を削除
"""

import json
import re
from pathlib import Path

H23_DIR = Path(__file__).parent.parent / "data" / "json" / "judicial_exam" / "H23"


def clean_text_simple(text: str) -> str:
    """シンプルな改行クリーニング（数字・単位の分割を主に修正）"""
    if not text:
        return text

    result = text

    result = re.sub(r'約\s*\n-\s*\d+\s*-\s*\n([０-９0-9]+％)', r'約\1', result)

    replacements = [
        (r'([０-９0-9]+)\n年', r'\1年'),
        (r'([０-９0-9]+)\n％', r'\1％'),
        (r'([０-９0-9．.]+)\n([０-９0-9]+％)', r'\1\2'),
        (r'([０-９0-9]+)\n円', r'\1円'),
        (r'([兆億万])\n([０-９0-9])', r'\1\2'),
        (r'(約)\n([０-９0-9])', r'\1\2'),
        (r'(」)\n(（以下)', r'\1\2'),
        (r'(法律」)\n(（以下)', r'\1\2'),
        (r'(種)\n(々)', r'\1\2'),
        (r'(第[０-９0-9]+条)\n(第)', r'\1\2'),
        (r'(メー)\n(トル)', r'\1\2'),
        (r'(土)\n(地)', r'\1\2'),
    ]

    for pattern, repl in replacements:
        result = re.sub(pattern, repl, result)

    result = re.sub(r'\n{3,}', '\n\n', result)

    return result


def split_public_law(data: dict) -> tuple[dict, dict]:
    """公法系を憲法と行政法に分割"""
    text = data["text"]
    purpose = data["purpose"]

    q2_start = text.find("\n〔第２問〕")
    if q2_start == -1:
        q2_start = text.find("〔第２問〕")

    const_text = clean_text_simple(text[:q2_start].strip()) if q2_start > 0 else clean_text_simple(text)
    admin_text = clean_text_simple(text[q2_start:].strip()) if q2_start > 0 else ""

    purpose_civil = purpose.find("\n【民事系科目】")
    public_purpose = purpose[:purpose_civil].strip() if purpose_civil > 0 else purpose

    purpose_q2 = public_purpose.find("\n〔第２問〕")
    if purpose_q2 == -1:
        purpose_q2 = public_purpose.find("〔第２問〕")

    const_purpose = clean_text_simple(public_purpose[:purpose_q2].strip()) if purpose_q2 > 0 else clean_text_simple(public_purpose)
    admin_purpose = clean_text_simple(public_purpose[purpose_q2:].strip()) if purpose_q2 > 0 else ""

    if const_purpose.startswith("】"):
        const_purpose = const_purpose[1:].strip()

    const = {
        "year": data["year"],
        "exam_type": data["exam_type"],
        "subject_name": "憲法",
        "text": const_text,
        "source_pdf": data["source_pdf"],
        "purpose": const_purpose,
    }
    admin = {
        "year": data["year"],
        "exam_type": data["exam_type"],
        "subject_name": "行政法",
        "text": admin_text,
        "source_pdf": data["source_pdf"],
        "purpose": admin_purpose,
    }
    return const, admin


def split_civil_law(data: dict) -> tuple[dict, dict, dict]:
    """民事系を民法（第1問）、商法（第2問）、民事訴訟法（第3問）に分割"""
    text = data["text"]
    purpose = data["purpose"]

    q2_start = text.find("\n〔第２問〕")
    if q2_start == -1:
        q2_start = text.find("〔第２問〕")
    if q2_start == -1:
        q2_start = text.find("論文式試験問題集［民事系科目第２問］")

    q3_start = text.find("\n〔第３問〕")
    if q3_start == -1:
        q3_start = text.find("〔第３問〕")

    civil_text = clean_text_simple(text[:q2_start].strip()) if q2_start > 0 else clean_text_simple(text)
    commercial_text = (
        clean_text_simple(text[q2_start:q3_start].strip())
        if q3_start > 0 and q2_start >= 0
        else clean_text_simple(text[q2_start:].strip())
        if q2_start >= 0
        else ""
    )
    minshu_text = (
        clean_text_simple(text[q3_start:].strip())
        if q3_start > 0
        else clean_text_simple(text[q2_start:].strip()) if q2_start >= 0 else ""
    )

    purpose_civil_start = purpose.find("【民事系科目】")
    if purpose_civil_start < 0:
        purpose_civil_start = purpose.find("〔第１問〕")
    if purpose_civil_start < 0:
        purpose_civil_start = 0
    purpose_criminal = purpose.find("\n【刑事系科目】")
    civil_purpose_block = purpose[purpose_civil_start:purpose_criminal].strip() if purpose_criminal > 0 else purpose[purpose_civil_start:].strip()

    purpose_q2 = civil_purpose_block.find("〔第２問〕")
    purpose_q3 = civil_purpose_block.find("〔第３問〕")

    civil_purpose = clean_text_simple(civil_purpose_block[:purpose_q2].strip()) if purpose_q2 > 0 else clean_text_simple(civil_purpose_block)
    commercial_purpose = (
        clean_text_simple(civil_purpose_block[purpose_q2:purpose_q3].strip())
        if purpose_q3 > 0 and purpose_q2 >= 0
        else clean_text_simple(civil_purpose_block[purpose_q2:].strip())
        if purpose_q2 >= 0
        else ""
    )
    minshu_purpose = (
        clean_text_simple(civil_purpose_block[purpose_q3:].strip())
        if purpose_q3 > 0
        else clean_text_simple(civil_purpose_block[purpose_q2:].strip()) if purpose_q2 >= 0 else ""
    )

    if civil_purpose.startswith("】"):
        civil_purpose = civil_purpose[1:].strip()

    civil = {
        "year": data["year"],
        "exam_type": data["exam_type"],
        "subject_name": "民法",
        "text": civil_text,
        "source_pdf": data["source_pdf"],
        "purpose": civil_purpose,
    }
    commercial = {
        "year": data["year"],
        "exam_type": data["exam_type"],
        "subject_name": "商法",
        "text": commercial_text,
        "source_pdf": data["source_pdf"],
        "purpose": commercial_purpose,
    }
    minshu = {
        "year": data["year"],
        "exam_type": data["exam_type"],
        "subject_name": "民事訴訟法",
        "text": minshu_text,
        "source_pdf": data["source_pdf"],
        "purpose": minshu_purpose,
    }
    return civil, commercial, minshu


def split_criminal_law(data: dict) -> tuple[dict, dict]:
    """刑事系を刑法と刑事訴訟法に分割"""
    text = data["text"]
    purpose = data["purpose"]

    q2_start = text.find("\n〔第２問〕")
    if q2_start == -1:
        q2_start = text.find("〔第２問〕")

    kei_text = clean_text_simple(text[:q2_start].strip()) if q2_start > 0 else clean_text_simple(text)
    keiji_text = clean_text_simple(text[q2_start:].strip()) if q2_start > 0 else ""

    purpose_criminal_start = purpose.find("【刑事系科目】")
    if purpose_criminal_start < 0:
        purpose_criminal_start = purpose.find("〔第１問〕")
    if purpose_criminal_start < 0:
        purpose_criminal_start = 0
    purpose_select = purpose.find("\n【選択科目】")
    criminal_purpose_block = purpose[purpose_criminal_start:purpose_select].strip() if purpose_select > 0 else purpose[purpose_criminal_start:].strip()

    purpose_q2 = criminal_purpose_block.find("〔第２問〕")
    kei_purpose = clean_text_simple(criminal_purpose_block[:purpose_q2].strip()) if purpose_q2 > 0 else clean_text_simple(criminal_purpose_block)
    keiji_purpose = clean_text_simple(criminal_purpose_block[purpose_q2:].strip()) if purpose_q2 > 0 else ""

    if kei_purpose.startswith("】"):
        kei_purpose = kei_purpose[1:].strip()

    kei = {
        "year": data["year"],
        "exam_type": data["exam_type"],
        "subject_name": "刑法",
        "text": kei_text,
        "source_pdf": data["source_pdf"],
        "purpose": kei_purpose,
    }
    keiji = {
        "year": data["year"],
        "exam_type": data["exam_type"],
        "subject_name": "刑事訴訟法",
        "text": keiji_text,
        "source_pdf": data["source_pdf"],
        "purpose": keiji_purpose,
    }
    return kei, keiji


def process_file(filepath: Path) -> bool:
    """単一ファイルのtextとpurposeをクリーニング"""
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    if "text" in data:
        data["text"] = clean_text_simple(data["text"])
    if "purpose" in data:
        data["purpose"] = clean_text_simple(data["purpose"])

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return True


def main():
    H23_DIR.mkdir(parents=True, exist_ok=True)

    # 1. 公法系を分割
    public_path = H23_DIR / "H23_司法_公法系.json"
    if public_path.exists():
        with open(public_path, "r", encoding="utf-8") as f:
            public_data = json.load(f)
        const_data, admin_data = split_public_law(public_data)
        with open(H23_DIR / "H23_司法_憲法.json", "w", encoding="utf-8") as f:
            json.dump(const_data, f, ensure_ascii=False, indent=2)
        with open(H23_DIR / "H23_司法_行政法.json", "w", encoding="utf-8") as f:
            json.dump(admin_data, f, ensure_ascii=False, indent=2)
        public_path.unlink()
        print("公法系 → 憲法, 行政法 に分割しました")

    # 2. 民事系を分割
    civil_path = H23_DIR / "H23_司法_民事系.json"
    if civil_path.exists():
        with open(civil_path, "r", encoding="utf-8") as f:
            civil_data = json.load(f)
        civil_d, commercial_d, minshu_d = split_civil_law(civil_data)
        with open(H23_DIR / "H23_司法_民法.json", "w", encoding="utf-8") as f:
            json.dump(civil_d, f, ensure_ascii=False, indent=2)
        with open(H23_DIR / "H23_司法_商法.json", "w", encoding="utf-8") as f:
            json.dump(commercial_d, f, ensure_ascii=False, indent=2)
        with open(H23_DIR / "H23_司法_民事訴訟法.json", "w", encoding="utf-8") as f:
            json.dump(minshu_d, f, ensure_ascii=False, indent=2)
        civil_path.unlink()
        print("民事系 → 民法, 商法, 民事訴訟法 に分割しました")

    # 3. 刑事系を分割
    criminal_path = H23_DIR / "H23_司法_刑事系.json"
    if criminal_path.exists():
        with open(criminal_path, "r", encoding="utf-8") as f:
            criminal_data = json.load(f)
        kei_d, keiji_d = split_criminal_law(criminal_data)
        with open(H23_DIR / "H23_司法_刑法.json", "w", encoding="utf-8") as f:
            json.dump(kei_d, f, ensure_ascii=False, indent=2)
        with open(H23_DIR / "H23_司法_刑事訴訟法.json", "w", encoding="utf-8") as f:
            json.dump(keiji_d, f, ensure_ascii=False, indent=2)
        criminal_path.unlink()
        print("刑事系 → 刑法, 刑事訴訟法 に分割しました")

    # 4. 残りのH23ファイルのtext/purposeをクリーニング
    for f in H23_DIR.glob("*.json"):
        process_file(f)

    print("H23の修正が完了しました。")


if __name__ == "__main__":
    main()
