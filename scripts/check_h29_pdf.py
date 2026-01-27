#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""H29のPDFの構造を確認するスクリプト"""

import pdfplumber
from pathlib import Path

PDF_PATH = Path(r"C:\Users\tvxqt\.shihou-zyuken2601\law-review\data\pdfs\preliminary_exam\H29\論述\出題趣旨.pdf")

with pdfplumber.open(PDF_PATH) as pdf:
    full_text = ""
    for i, page in enumerate(pdf.pages):
        page_text = page.extract_text()
        if page_text:
            full_text += page_text + "\n"
        if i < 3:  # 最初の3ページだけ表示
            print(f"=== Page {i+1} ===")
            print(page_text[:1000])
            print()

# 科目名のパターンを探す
import re

# 様々なパターンを試す
patterns = [
    r'［([^］]+)］',
    r'^([憲行民商刑実務基][^\\n]+)',
    r'(憲\s*法|行政法|民\s*法|商\s*法|民事訴訟法|刑\s*法|刑事訴訟法|実務基礎)',
]

print("=== 科目名の検索結果 ===")
for pattern in patterns:
    matches = re.findall(pattern, full_text, re.MULTILINE)
    if matches:
        print(f"パターン: {pattern}")
        print(f"  見つかった数: {len(matches)}")
        print(f"  最初の5つ: {matches[:5]}")
        print()

# 最初の2000文字を表示
print("=== 最初の2000文字 ===")
print(full_text[:2000])
