#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
H29の一般教養以外とH30の憲法・行政法について、空のpurposeフィールドを追加するスクリプト
"""

import json
from pathlib import Path

BASE_DIR = Path(r"C:\Users\tvxqt\.shihou-zyuken2601\law-review")
JSON_DIR = BASE_DIR / "data" / "json" / "preliminary_exam"

def add_empty_purpose():
    """空のpurposeフィールドを追加"""
    
    # H29の一般教養以外のファイル
    h29_dir = JSON_DIR / "H29"
    h29_files = [f for f in h29_dir.glob("*.json") if "一般教養" not in f.name]
    
    # H30の憲法・行政法のファイル
    h30_dir = JSON_DIR / "H30"
    h30_files = [
        h30_dir / "H30_予備_憲法.json",
        h30_dir / "H30_予備_行政法.json"
    ]
    h30_files = [f for f in h30_files if f.exists()]
    
    all_files = list(h29_files) + list(h30_files)
    
    print(f"処理対象ファイル数: {len(all_files)}")
    print("-" * 80)
    
    fixed_count = 0
    skipped_count = 0
    error_count = 0
    
    for json_file in sorted(all_files):
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # 既にpurposeフィールドが存在する場合はスキップ
            if 'purpose' in data:
                print(f"[SKIP] {json_file.name}: 既にpurposeフィールドが存在します")
                skipped_count += 1
                continue
            
            # 空のpurposeフィールドを追加
            data['purpose'] = ""
            
            # JSONファイルを保存
            with open(json_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            print(f"[OK] {json_file.name}: 空のpurposeフィールドを追加しました")
            fixed_count += 1
        
        except Exception as e:
            print(f"[ERROR] {json_file.name}: {e}")
            error_count += 1
    
    print("-" * 80)
    print(f"修正完了: {fixed_count}ファイル")
    print(f"スキップ: {skipped_count}ファイル")
    print(f"エラー: {error_count}ファイル")
    print(f"合計: {len(all_files)}ファイル")

if __name__ == "__main__":
    add_empty_purpose()
