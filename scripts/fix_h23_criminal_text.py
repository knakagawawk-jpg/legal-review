#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""H23刑事系のtextを刑事系.pdfから取得して刑法・刑事訴訟法JSONを更新"""

import json
import re
from pathlib import Path

import pdfplumber

BASE = Path(__file__).parent.parent
H23_DIR = BASE / "data" / "json" / "judicial_exam" / "H23"
PDF_PATH = BASE / "data" / "pdfs" / "judicial_exam" / "H23" / "論述" / "試験問題" / "刑事系.pdf"
SOURCE_PDF = "data/pdfs/judicial_exam/H23/論述/試験問題/刑事系.pdf"


def clean_text_simple(text: str) -> str:
    if not text:
        return text
    result = text
    result = re.sub(r"\n{3,}", "\n\n", result)
    return result


def main():
    full_text = ""
    with pdfplumber.open(PDF_PATH) as pdf:
        for p in pdf.pages:
            t = p.extract_text()
            if t:
                full_text += t + "\n"

    q2 = full_text.find("\n〔第２問〕")
    if q2 == -1:
        q2 = full_text.find("〔第２問〕")
    # 刑法の末尾に第2問の見出しが入らないよう、より前で分割
    q2_header = full_text.find("論文式試験問題集［刑事系科目第２問］")
    if q2_header > 0 and (q2 <= 0 or q2_header < q2):
        q2 = q2_header

    kei_text = clean_text_simple(full_text[:q2].strip()) if q2 > 0 else clean_text_simple(full_text)
    keiji_text = clean_text_simple(full_text[q2:].strip()) if q2 > 0 else ""

    for fname, text in [("H23_司法_刑法.json", kei_text), ("H23_司法_刑事訴訟法.json", keiji_text)]:
        path = H23_DIR / fname
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        data["text"] = text
        data["source_pdf"] = SOURCE_PDF
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"{fname}: text updated ({len(text)} chars)")


if __name__ == "__main__":
    main()
