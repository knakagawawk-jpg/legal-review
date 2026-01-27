#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
purposeフィールドからtextと重複している問題文を削除するスクリプト
"""

import json
import os
from pathlib import Path

def remove_duplicate_from_purpose(file_path):
    """
    ファイルを読み込み、purposeからtextと重複している部分を削除する
    textの内容がpurpose内のどこかに含まれていれば、その部分を削除する
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if 'text' not in data or 'purpose' not in data:
            return False, "textまたはpurposeフィールドが存在しません"
        
        text = data['text']
        purpose = data['purpose']
        
        # textから末尾のページ番号（- X -）を削除
        import re
        text_cleaned = re.sub(r'\s*-\s*\d+\s*-\s*$', '', text).strip()
        
        if not text_cleaned:
            return False, "textが空です"
        
        # purpose内でtext_cleanedを検索（先頭から一致するかどうかに関わらず）
        text_in_purpose = purpose.find(text_cleaned)
        
        if text_in_purpose == -1:
            # 完全一致が見つからない場合、部分一致を試す
            # text_cleanedの大部分（80%以上）がpurpose内に含まれているか確認
            text_len = len(text_cleaned)
            if text_len < 50:
                return False, "textが短すぎます"
            
            threshold = max(100, int(text_len * 0.8))  # 最低100文字、またはtextの80%
            
            found_match = False
            match_start = -1
            match_end = -1
            
            # purpose内でtext_cleanedの先頭部分を検索
            search_range = len(purpose) - threshold + 1
            for i in range(max(0, search_range)):
                # 先頭から一致する部分を探す
                comparison_len = min(threshold, len(purpose) - i, text_len)
                if purpose[i:i+comparison_len] == text_cleaned[:comparison_len]:
                    # 一致する部分を見つけた
                    match_start = i
                    # 可能な限り長く一致する部分を探す
                    max_match_len = min(len(text_cleaned), len(purpose) - i)
                    for match_len in range(comparison_len, max_match_len + 1):
                        if purpose[i:i+match_len] == text_cleaned[:match_len]:
                            match_end = i + match_len
                        else:
                            break
                    found_match = True
                    break
            
            if found_match:
                text_in_purpose = match_start
                text_end_in_purpose = match_end
            else:
                return False, "重複なし（textと一致しない）"
        else:
            text_end_in_purpose = text_in_purpose + len(text_cleaned)
        
        # （出題趣旨）の位置を取得
        purpose_marker = '（出題趣旨）'
        purpose_marker_index = purpose.find(purpose_marker)
        
        # textの重複部分を削除
        # ただし、（出題趣旨）の部分は必ず残す
        if purpose_marker_index != -1:
            # （出題趣旨）が存在する場合
            # textの重複部分と（出題趣旨）の位置関係を確認
            if text_end_in_purpose <= purpose_marker_index:
                # textの重複部分が（出題趣旨）より前にある場合
                # textの重複部分を削除し、（出題趣旨）以降を残す
                new_purpose = purpose[:text_in_purpose] + purpose[purpose_marker_index:]
            elif text_in_purpose >= purpose_marker_index + len(purpose_marker):
                # textの重複部分が（出題趣旨）より後にある場合
                # （出題趣旨）からtextの重複部分の前まで + textの重複部分の後
                new_purpose = purpose[:text_in_purpose] + purpose[text_end_in_purpose:]
            else:
                # textの重複部分が（出題趣旨）と重なっている場合
                # （出題趣旨）を含む部分は残し、それ以外のtextの重複部分を削除
                if text_in_purpose < purpose_marker_index:
                    # textの重複部分が（出題趣旨）の前から始まっている
                    new_purpose = purpose[:text_in_purpose] + purpose[purpose_marker_index:]
                else:
                    # textの重複部分が（出題趣旨）の後から始まっている
                    new_purpose = purpose[:purpose_marker_index + len(purpose_marker)] + purpose[text_end_in_purpose:]
        else:
            # （出題趣旨）が存在しない場合、textの重複部分だけを削除
            new_purpose = purpose[:text_in_purpose] + purpose[text_end_in_purpose:]
        
        # 前後の空白を整理
        new_purpose = new_purpose.strip()
        
        # 変更がない場合はスキップ
        if new_purpose == purpose.strip():
            return False, "変更なし"
        
        # データを更新
        data['purpose'] = new_purpose
        
        # ファイルに書き戻す
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        removed_length = text_end_in_purpose - text_in_purpose
        return True, f"修正完了: {removed_length}文字の重複を削除"
        
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
        success, message = remove_duplicate_from_purpose(json_file)
        
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
