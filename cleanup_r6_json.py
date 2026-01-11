#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""R6のJSONファイルをクリーンアップ"""

import json
import re
from pathlib import Path

JSON_DIR = Path(__file__).parent / "data" / "json" / "preliminary_exam" / "R6"

def cleanup_purpose(purpose_text: str) -> str:
    """出題趣旨から問題文を除去し、「（出題の趣旨）」以降だけを抽出"""
    if not purpose_text:
        return ""
    
    # 「（出題の趣旨）」または「（出題の趣旨）」以降を抽出
    patterns = [
        r'（出題の趣旨）',
        r'（出題の趣旨）',
        r'\(出題の趣旨\)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, purpose_text)
        if match:
            # 「（出題の趣旨）」以降を取得
            purpose_only = purpose_text[match.end():].strip()
            # 次の科目の見出し（「［」で始まる）までを取得
            next_subject_match = re.search(r'^［', purpose_only, flags=re.MULTILINE)
            if next_subject_match:
                purpose_only = purpose_only[:next_subject_match.start()].strip()
            return purpose_only
    
    return purpose_text

def fix_subject_name(subject_name: str) -> str:
    """科目名をR7の形式に統一"""
    if subject_name == "民 事":
        return "実務基礎（民事）"
    elif subject_name == "刑 事":
        return "実務基礎（刑事）"
    return subject_name

def cleanup_json_files():
    """JSONファイルをクリーンアップ"""
    json_files = list(JSON_DIR.glob("*.json"))
    
    print(f"処理するJSONファイル: {len(json_files)}件")
    
    for json_file in json_files:
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            # 科目名を修正
            original_subject = data.get("subject", "")
            fixed_subject = fix_subject_name(original_subject)
            
            # 出題趣旨をクリーンアップ
            purpose = data.get("purpose", "")
            if purpose:
                cleaned_purpose = cleanup_purpose(purpose)
                data["purpose"] = cleaned_purpose
            
            # 科目名が変更された場合はファイル名も変更
            if fixed_subject != original_subject:
                data["subject"] = fixed_subject
                # ファイル名を変更
                safe_subject = fixed_subject.replace(" ", "_").replace("（", "_").replace("）", "_").replace("・", "_")
                new_filename = f"R6_予備_{safe_subject}.json"
                new_filepath = JSON_DIR / new_filename
                
                # 古いファイルを削除
                json_file.unlink()
                json_file = new_filepath
                print(f"  科目名変更: {original_subject} -> {fixed_subject}")
            
            # JSONファイルを保存
            with open(json_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            if purpose and cleaned_purpose != purpose:
                print(f"  出題趣旨をクリーンアップ: {json_file.name} ({len(purpose)} -> {len(cleaned_purpose)} 文字)")
        
        except Exception as e:
            print(f"  エラー: {json_file.name} - {e}")
    
    print("クリーンアップ完了")

if __name__ == "__main__":
    cleanup_json_files()
