#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
JSONファイルのテキストを整形

PDFから抽出したテキストの整形：
- 不要な改行を削除
- 頁数表記を削除（例: "- 1 -", "- 2 -"）
- 連続する空白を1つに
- 段落を適切に整形
"""

import json
import re
from pathlib import Path

BASE_DIR = Path(__file__).parent
JSON_DIR = BASE_DIR / "json_data" / "予備試験" / "R7"

def clean_text(text: str) -> str:
    """テキストを整形"""
    if not text:
        return ""
    
    # 頁数表記を削除（例: "- 1 -", "- 2 -", "- 3 -"）
    text = re.sub(r'^-\s*\d+\s*-$', '', text, flags=re.MULTILINE)
    
    # 論文式試験問題集の見出しを削除（例: "論文式試験問題集［憲法・行政法］"）
    text = re.sub(r'^論文式試験問題集.*$', '', text, flags=re.MULTILINE)
    
    # 科目見出しを削除（例: "［憲 法］", "［行政法］"）
    text = re.sub(r'^［[^］]+］$', '', text, flags=re.MULTILINE)
    
    # 連続する改行を2つに統一（段落区切りとして）
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    # 行頭の空白を削除
    lines = text.split('\n')
    cleaned_lines = []
    for line in lines:
        # 空行はそのまま保持
        if not line.strip():
            cleaned_lines.append('')
        else:
            # 行頭の空白を削除し、連続する空白を1つに
            cleaned_line = re.sub(r'^\s+', '', line)
            cleaned_line = re.sub(r'\s+', ' ', cleaned_line)
            cleaned_lines.append(cleaned_line)
    
    text = '\n'.join(cleaned_lines)
    
    # 連続する空白を1つに
    text = re.sub(r' +', ' ', text)
    
    # 段落間の空行を整理（2つの空行を1つに）
    text = re.sub(r'\n\n\n+', '\n\n', text)
    
    # 前後の空白・改行を削除
    text = text.strip()
    
    return text

def format_json_files():
    """JSONファイルのテキストを整形"""
    json_files = list(JSON_DIR.glob("*.json"))
    
    if not json_files:
        print(f"JSONファイルが見つかりませんでした: {JSON_DIR}")
        return
    
    print(f"見つかったJSONファイル: {len(json_files)}件")
    print("-" * 60)
    
    formatted_count = 0
    
    for json_file in json_files:
        try:
            # JSONファイルを読み込み
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            # テキストを整形
            original_text = data.get("text", "")
            formatted_text = clean_text(original_text)
            
            if original_text != formatted_text:
                data["text"] = formatted_text
                
                # JSONファイルを保存
                with open(json_file, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                
                print(f"整形: {json_file.name}")
                print(f"  元の長さ: {len(original_text)} 文字")
                print(f"  整形後: {len(formatted_text)} 文字")
                formatted_count += 1
            else:
                print(f"変更なし: {json_file.name}")
                
        except Exception as e:
            print(f"エラー: {json_file.name} - {str(e)}")
    
    print("\n" + "=" * 60)
    print(f"処理完了: {formatted_count}件のJSONファイルを整形しました")

if __name__ == "__main__":
    format_json_files()
