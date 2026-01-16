#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
解答PDFの構造を詳しく分析
"""

import pdfplumber
from pathlib import Path
import sys

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = Path(__file__).parent
PDF_DIR = BASE_DIR / "問題文元pdf" / "予備試験" / "R7"

answer_pdf = PDF_DIR / "R7_予備_短答_解答(憲法・行政法).pdf"

print("解答PDFの全テキストを表示:")
print("=" * 60)

with pdfplumber.open(answer_pdf) as pdf:
    full_text = ""
    for page in pdf.pages:
        text = page.extract_text()
        if text:
            full_text += text + "\n"

print(full_text)
