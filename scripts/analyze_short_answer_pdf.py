#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
短答式PDFの構造を詳しく分析
"""

import pdfplumber
from pathlib import Path
import re

BASE_DIR = Path(__file__).parent
PDF_DIR = BASE_DIR / "問題文元pdf" / "予備試験" / "R7"

def analyze_pdf(pdf_name: str):
    """PDFを分析"""
    pdf_path = PDF_DIR / pdf_name
    print(f"\n{'='*60}")
    print(f"分析: {pdf_name}")
    print('='*60)
    
    with pdfplumber.open(pdf_path) as pdf:
        print(f"総ページ数: {len(pdf.pages)}")
        
        # 最初の10ページを詳しく見る
        for page_num in range(min(10, len(pdf.pages))):
            page = pdf.pages[page_num]
            text = page.extract_text()
            
            if text:
                print(f"\n【ページ {page_num + 1}】")
                print("-" * 60)
                # 最初の1000文字を表示
                print(text[:1000])
                if len(text) > 1000:
                    print("...")

# 問題文PDFを分析
print("【問題文PDF】")
analyze_pdf("R7_予備_短答_憲法・行政法.pdf")

# 解答PDFを分析
print("\n\n【解答PDF】")
analyze_pdf("R7_予備_短答_解答(憲法・行政法).pdf")
