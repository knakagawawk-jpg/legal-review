#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
短答式PDFの構造を確認（問題文と解答）
"""

import pdfplumber
from pathlib import Path

BASE_DIR = Path(__file__).parent
PROBLEM_PDF = BASE_DIR / "問題文元pdf" / "予備試験" / "R7" / "R7_予備_短答_憲法・行政法.pdf"
ANSWER_PDF = BASE_DIR / "問題文元pdf" / "予備試験" / "R7" / "R7_予備_短答_解答(憲法・行政法).pdf"

def check_problem_pdf():
    """問題文PDFの構造を確認"""
    print("=" * 60)
    print("【問題文PDF】")
    print(f"ファイル: {PROBLEM_PDF.name}")
    print("=" * 60)
    
    try:
        with pdfplumber.open(PROBLEM_PDF) as pdf:
            print(f"総ページ数: {len(pdf.pages)}\n")
            
            # 最初の数ページを確認
            for page_num in range(min(5, len(pdf.pages))):
                page = pdf.pages[page_num]
                text = page.extract_text()
                
                if text:
                    print(f"【ページ {page_num + 1}】")
                    print("-" * 60)
                    print(text[:1000])
                    if len(text) > 1000:
                        print("...")
                    print()
    
    except Exception as e:
        print(f"エラー: {e}")

def check_answer_pdf():
    """解答PDFの構造を確認"""
    print("\n" + "=" * 60)
    print("【解答PDF】")
    print(f"ファイル: {ANSWER_PDF.name}")
    print("=" * 60)
    
    try:
        with pdfplumber.open(ANSWER_PDF) as pdf:
            print(f"総ページ数: {len(pdf.pages)}\n")
            
            # 全ページを確認
            for page_num in range(len(pdf.pages)):
                page = pdf.pages[page_num]
                text = page.extract_text()
                
                if text:
                    print(f"【ページ {page_num + 1}】")
                    print("-" * 60)
                    print(text)
                    print()
    
    except Exception as e:
        print(f"エラー: {e}")

if __name__ == "__main__":
    check_problem_pdf()
    check_answer_pdf()
