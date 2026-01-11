#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
短答式PDFの構造を確認
"""

import pdfplumber
from pathlib import Path

PDF_PATH = Path("問題文元pdf/予備試験/R7/R7_予備_短答_憲法・行政法.pdf")

def check_pdf_structure():
    """PDFの構造を確認"""
    print(f"PDFファイルを読み込み中: {PDF_PATH}")
    print("=" * 60)
    
    try:
        with pdfplumber.open(PDF_PATH) as pdf:
            print(f"総ページ数: {len(pdf.pages)}")
            print("-" * 60)
            
            # 最初の数ページを確認
            for page_num in range(min(5, len(pdf.pages))):
                page = pdf.pages[page_num]
                text = page.extract_text()
                
                print(f"\n【ページ {page_num + 1}】")
                print("-" * 60)
                # 最初の500文字を表示
                if text:
                    print(text[:500])
                    if len(text) > 500:
                        print("...")
                else:
                    print("(テキストなし)")
                print()
    
    except Exception as e:
        print(f"エラー: {e}")

if __name__ == "__main__":
    check_pdf_structure()
