#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
PDF保存用のフォルダ構造を作成

構造:
問題文元pdf/
  ├── 司法試験/
  │   ├── H18/
  │   ├── H19/
  │   ├── ...
  │   ├── R1/
  │   ├── ...
  │   └── R7/
  └── 予備試験/
      ├── H23/
      ├── H24/
      ├── ...
      ├── R1/
      ├── ...
      └── R7/
"""

import os
from pathlib import Path

# ベースディレクトリ
BASE_DIR = Path(__file__).parent
PDF_BASE_DIR = BASE_DIR / "問題文元pdf"

# 年度の範囲
# 司法試験: 平成18年（2006年）～令和7年（2025年）
# 予備試験: 平成23年（2011年）～令和7年（2025年）

def create_folders():
    """フォルダ構造を作成"""
    
    # ベースフォルダ
    pdf_base = PDF_BASE_DIR
    pdf_base.mkdir(exist_ok=True)
    print(f"作成: {pdf_base}")
    
    # 司法試験フォルダ
    judicial_dir = pdf_base / "司法試験"
    judicial_dir.mkdir(exist_ok=True)
    print(f"作成: {judicial_dir}")
    
    # 予備試験フォルダ
    preliminary_dir = pdf_base / "予備試験"
    preliminary_dir.mkdir(exist_ok=True)
    print(f"作成: {preliminary_dir}")
    
    # 司法試験の年度フォルダ（H18～R7）
    # 平成18年（2006年）～平成30年（2018年）
    for heisei_year in range(18, 31):  # H18～H30
        year_dir = judicial_dir / f"H{heisei_year}"
        year_dir.mkdir(exist_ok=True)
        print(f"作成: {year_dir}")
    
    # 令和1年（2019年）～令和7年（2025年）
    for reiwa_year in range(1, 8):  # R1～R7
        year_dir = judicial_dir / f"R{reiwa_year}"
        year_dir.mkdir(exist_ok=True)
        print(f"作成: {year_dir}")
    
    # 予備試験の年度フォルダ（H23～R7）
    # 平成23年（2011年）～平成30年（2018年）
    for heisei_year in range(23, 31):  # H23～H30
        year_dir = preliminary_dir / f"H{heisei_year}"
        year_dir.mkdir(exist_ok=True)
        print(f"作成: {year_dir}")
    
    # 令和1年（2019年）～令和7年（2025年）
    for reiwa_year in range(1, 8):  # R1～R7
        year_dir = preliminary_dir / f"R{reiwa_year}"
        year_dir.mkdir(exist_ok=True)
        print(f"作成: {year_dir}")
    
    print("\nフォルダ構造の作成が完了しました！")

if __name__ == "__main__":
    create_folders()
