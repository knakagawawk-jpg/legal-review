#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
司法試験の行政法JSONに、出題趣旨PDFから抽出したpurposeを追加するスクリプト。

公法系のpurposeが【民事系科目】までの短い前置きのみで、
〔第２問〕(行政法)の出題趣旨が含まれていない場合に対応。
出題趣旨.pdfから【公法系科目】内の〔第２問〕部分を抽出して行政法に設定する。
"""

import json
import re
from pathlib import Path

import pdfplumber

BASE_DIR = Path(__file__).parent.parent
PDF_BASE = BASE_DIR / "data" / "pdfs" / "judicial_exam"
JSON_BASE = BASE_DIR / "data" / "json" / "judicial_exam"
YEARS = ["H23", "H24", "H25", "H26", "H27", "H28", "H29", "H30", "R1", "R2", "R3", "R4", "R5", "R6", "R7"]


def clean_text(text: str) -> str:
    """不要な改行を除去"""
    if not text:
        return text
    result = re.sub(r"\n-\s*\d+\s*-\s*\n", "\n", text)
    result = re.sub(r"\n{3,}", "\n\n", result)
    return result.strip()


def extract_gyosei_purpose_from_pdf(pdf_path: Path) -> str | None:
    """出題趣旨PDFから行政法（公法系第2問）のpurposeを抽出"""
    if not pdf_path.exists():
        return None
    try:
        with pdfplumber.open(pdf_path) as pdf:
            full_text = ""
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    full_text += t + "\n"
    except Exception as e:
        print(f"  エラー: PDF読み込み失敗: {e}")
        return None

    # 【公法系科目】〜【民事系科目】の間を取得
    # または、冒頭から【民事系科目】まで（【公法系科目】がない場合）
    pub_start = full_text.find("【公法系科目】")
    if pub_start < 0:
        pub_start = full_text.find("公法系科目")
    if pub_start < 0:
        pub_start = 0

    civil_start = full_text.find("\n【民事系科目】")
    if civil_start < 0:
        civil_start = full_text.find("【民事系科目】")
    if civil_start < 0:
        civil_start = len(full_text)

    public_block = full_text[pub_start:civil_start]

    # 〔第２問〕以降が行政法
    q2 = public_block.find("\n〔第２問〕")
    if q2 < 0:
        q2 = public_block.find("〔第２問〕")
    if q2 < 0:
        # 公法系科目第２問 の形式
        q2 = public_block.find("公法系科目第２問")
    if q2 < 0:
        return None

    gyosei_text = public_block[q2:].strip()
    if gyosei_text.startswith("\n"):
        gyosei_text = gyosei_text[1:].strip()
    # 〔第２問〕の見出し行を除去（先頭が〔第２問〕で始まる場合、1行目は見出し）
    if gyosei_text.startswith("〔第２問〕"):
        first_nl = gyosei_text.find("\n")
        if first_nl > 0:
            gyosei_text = gyosei_text[first_nl:].strip()
        else:
            gyosei_text = gyosei_text[len("〔第２問〕"):].strip()

    return clean_text(gyosei_text) if gyosei_text else None


def main():
    for year in YEARS:
        json_path = JSON_BASE / year / f"{year}_司法_行政法.json"
        if not json_path.exists():
            continue
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if data.get("purpose", "").strip():
            print(f"{year} 行政法: purposeあり（スキップ）")
            continue

        pdf_path = PDF_BASE / year / "論述" / "出題趣旨.pdf"
        purpose = extract_gyosei_purpose_from_pdf(pdf_path)
        if not purpose:
            print(f"{year} 行政法: 抽出失敗")
            continue

        data["purpose"] = purpose
        ordered = {
            "year": data["year"],
            "exam_type": data["exam_type"],
            "subject_name": data["subject_name"],
            "subject": data["subject"],
            "text": data["text"],
            "source_pdf": data["source_pdf"],
            "purpose": data["purpose"],
        }
        if "scoring_notes" in data:
            ordered["scoring_notes"] = data["scoring_notes"]

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(ordered, f, ensure_ascii=False, indent=2)
        print(f"{year} 行政法: purposeを追加しました（{len(purpose)}文字）")


if __name__ == "__main__":
    main()
