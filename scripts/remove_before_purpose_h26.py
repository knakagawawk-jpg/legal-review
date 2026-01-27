#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
H26以降のファイルについて、purposeフィールドに「出題趣旨」があれば、それ以前をすべて削除するスクリプト
"""

import json
import os
import re
from pathlib import Path

def is_h26_or_later(year_str):
    """
    年号がH26以降かどうかを判定
    H26, H27, H28, H29, H30, R1, R2, R3, R4, R5, R6, R7など
    """
    if not year_str:
        return False
    
    # H26以降（H26, H27, H28, H29, H30）
    if year_str.startswith('H'):
        match = re.match(r'H(\d+)', year_str)
        if match:
            year_num = int(match.group(1))
            return year_num >= 26
    
    # R1以降（R1, R2, R3, R4, R5, R6, R7など）
    if year_str.startswith('R'):
        return True
    
    return False

def remove_before_purpose_marker(file_path):
    """
    ファイルを読み込み、purposeから「出題趣旨」以前の部分を削除する
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if 'purpose' not in data:
            return False, "purposeフィールドが存在しません"
        
        if 'year' not in data:
            return False, "yearフィールドが存在しません"
        
        # H26以降のファイルのみ処理
        if not is_h26_or_later(data['year']):
            return False, f"H26以降ではありません（{data['year']}）"
        
        purpose = data['purpose']
        
        # 「出題趣旨」を検索（全角・半角の括弧の両方に対応）
        # 「出題趣旨」「(出題趣旨)」「（出題趣旨）」など
        patterns = [
            r'（出題趣旨）',
            r'\(出題趣旨\)',
            r'出題趣旨',
        ]
        
        purpose_marker_index = -1
        marker_length = 0
        
        for pattern in patterns:
            match = re.search(pattern, purpose)
            if match:
                purpose_marker_index = match.start()
                marker_length = match.end() - match.start()
                break
        
        if purpose_marker_index == -1:
            return False, "「出題趣旨」が見つかりません"
        
        # 「出題趣旨」以前の部分を削除
        new_purpose = purpose[purpose_marker_index:].strip()
        
        # 変更がない場合はスキップ
        if new_purpose == purpose.strip():
            return False, "変更なし"
        
        # データを更新
        data['purpose'] = new_purpose
        
        # ファイルに書き戻す
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        removed_length = purpose_marker_index
        return True, f"修正完了: {removed_length}文字を削除"
        
    except Exception as e:
        return False, f"エラー: {str(e)}"

def main():
    base_dir = Path(r"C:\Users\tvxqt\.shihou-zyuken2601\law-review\data\json\preliminary_exam")
    
    if not base_dir.exists():
        print(f"ディレクトリが見つかりません: {base_dir}")
        return
    
    # すべてのJSONファイルを取得
    json_files = list(base_dir.rglob("*.json"))
    
    print(f"検出されたJSONファイル数: {len(json_files)}")
    print("-" * 80)
    
    fixed_count = 0
    skipped_count = 0
    error_count = 0
    
    for json_file in sorted(json_files):
        success, message = remove_before_purpose_marker(json_file)
        
        if success:
            print(f"[OK] {json_file.relative_to(base_dir)}: {message}")
            fixed_count += 1
        elif "エラー" in message:
            print(f"[ERROR] {json_file.relative_to(base_dir)}: {message}")
            error_count += 1
        else:
            skipped_count += 1
    
    print("-" * 80)
    print(f"修正完了: {fixed_count}ファイル")
    print(f"スキップ: {skipped_count}ファイル")
    print(f"エラー: {error_count}ファイル")
    print(f"合計: {len(json_files)}ファイル")

if __name__ == "__main__":
    main()
