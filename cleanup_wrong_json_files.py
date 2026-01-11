#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
誤って生成されたJSONファイルを削除
"""

import sys
from pathlib import Path

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = Path(__file__).parent
JSON_DIR = BASE_DIR / "json_data" / "予備試験" / "R7"

# 削除するファイルパターン
patterns_to_delete = [
    "R7_予備_短答_No.*.json",
    "R7_予備_短答_№*.json",
    "R7_予備_短答_会 話.json",
    "R7_予備_短答_記 述.json",
    "R7_予備_短答_語句群.json",
]

import glob

deleted_count = 0
for pattern in patterns_to_delete:
    for file_path in JSON_DIR.glob(pattern):
        file_path.unlink()
        print(f"削除: {file_path.name}")
        deleted_count += 1

print(f"\n合計 {deleted_count} 個のファイルを削除しました。")
