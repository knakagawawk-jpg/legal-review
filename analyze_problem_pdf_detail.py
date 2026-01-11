#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
問題文PDFの構造を詳しく分析（問題1の部分）
"""

import pdfplumber
from pathlib import Path
import sys

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = Path(__file__).parent
PDF_DIR = BASE_DIR / "問題文元pdf" / "予備試験" / "R7"

problem_pdf = PDF_DIR / "R7_予備_短答_憲法・行政法.pdf"

print("問題文PDFの4-5ページ目を表示（問題1の部分）:")
print("=" * 60)

with pdfplumber.open(problem_pdf) as pdf:
    # 4-5ページ目を表示
    for page_num in [3, 4]:
        if page_num < len(pdf.pages):
            page = pdf.pages[page_num]
            text = page.extract_text()
            if text:
                print(f"\n【ページ {page_num + 1}】")
                print("-" * 60)
                print(text)
