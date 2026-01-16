#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
PDF内の科目マーカーを詳しく分析
"""

import pdfplumber
import re
from pathlib import Path
import sys

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = Path(__file__).parent
PDF_DIR = BASE_DIR / "問題文元pdf" / "予備試験" / "R7"

pdf_path = PDF_DIR / "R7_予備_短答_憲法・行政法.pdf"

print("PDF内の科目マーカーを検索:")
print("=" * 60)

with pdfplumber.open(pdf_path) as pdf:
    full_text = ""
    for page in pdf.pages:
        text = page.extract_text()
        if text:
            full_text += text + "\n"

# 科目マーカーを探す
subject_markers = re.findall(r'［[^］]+］', full_text)
print("見つかったマーカー:")
for marker in set(subject_markers):
    print(f"  {marker}")

# 問題番号と科目マーカーの関係を確認
print("\n問題番号と科目マーカーの関係:")
lines = full_text.split("\n")
current_subject = None
for i, line in enumerate(lines):
    # 科目マーカーを探す
    marker_match = re.search(r'［([^］]+)］', line)
    if marker_match:
        current_subject = marker_match.group(1)
        print(f"\n行 {i+1}: 科目マーカー = {current_subject}")
    
    # 問題番号を探す
    problem_match = re.search(r'〔第\s*(\d+)\s*問〕', line)
    if problem_match:
        problem_num = problem_match.group(1)
        print(f"  問題{problem_num} (科目: {current_subject})")
