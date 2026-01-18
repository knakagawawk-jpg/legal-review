#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
R7予備試験の論文PDFファイルからテキストを抽出し、科目ごとにJSONファイルとして保存

JSON構造:
{
    "year": "R7",
    "exam_type": "予備",
    "subject": 1,
    "subject_name": "憲法",
    "text": "抽出したテキスト",
    "source_pdf": "元のPDFファイルのパス"
}
"""

import os
import json
import re
from pathlib import Path
import pdfplumber
from config.subjects import get_subject_id, get_subject_name

# ベースディレクトリ
BASE_DIR = Path(__file__).parent
PDF_DIR = BASE_DIR / "問題文元pdf" / "予備試験" / "R7"
JSON_OUTPUT_DIR = BASE_DIR / "json_data" / "予備試験" / "R7"

def subject_name_to_id(subject_name: str) -> tuple[int, str]:
    """
    PDFの見出し（例: '憲 法'）を科目ID（1-18）へ変換する。
    JSON/DBでは科目は数値で統一する。
    """
    s = "".join((subject_name or "").split())
    # 実務基礎の表記ゆれ
    if s == "民事":
        s = "実務基礎（民事）"
    elif s == "刑事":
        s = "実務基礎（刑事）"

    subject_id = int(s) if s.isdigit() else get_subject_id(s)
    if subject_id is None or not (1 <= subject_id <= 18):
        raise ValueError(f"科目をIDに変換できません: {subject_name!r} -> {s!r}")
    return subject_id, get_subject_name(subject_id)

def extract_text_from_pdf(pdf_path: Path) -> str:
    """PDFファイルからテキストを抽出"""
    text_parts = []
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
    except Exception as e:
        print(f"エラー: {pdf_path.name} の読み込みに失敗しました: {e}")
        return ""
    
    return "\n".join(text_parts)

def split_text_by_subjects(text: str) -> list[tuple[str, str]]:
    """テキストを「［科目名］」の見出しで分割
    
    Returns:
        list[tuple[str, str]]: [(科目名, テキスト), ...] のリスト
    """
    # 「［」と「］」で囲まれた科目見出しを検出するパターン
    # 例: 「［憲 法］」「［行政法］」「［刑 法］」「［刑事訴訟法］」
    subject_pattern = r'［([^］]+)］'
    
    subjects = []
    matches = list(re.finditer(subject_pattern, text))
    
    if not matches:
        # 科目見出しが見つからない場合は、全体を1つの科目として扱う
        return [("不明", text)]
    
    # 各科目のテキストを抽出
    for i, match in enumerate(matches):
        subject_name = match.group(1).strip()
        
        # 次の見出しまでのテキストを取得
        if i + 1 < len(matches):
            next_match = matches[i + 1]
            subject_text = text[match.start():next_match.start()]
        else:
            # 最後の科目は、見出しから最後まで
            subject_text = text[match.start():]
        
        subjects.append((subject_name, subject_text))
    
    return subjects

def sanitize_filename(text: str) -> str:
    """ファイル名に使えない文字を置換"""
    # ファイル名に使えない文字を置換
    invalid_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|', '・', '（', '）']
    for char in invalid_chars:
        text = text.replace(char, '_')
    return text

def process_paper_pdfs():
    """論文PDFファイルを処理してJSONファイルを作成（科目ごとに分割）"""
    
    # 出力ディレクトリを作成
    JSON_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # PDFディレクトリ内の論文PDFファイルを取得
    pdf_files = list(PDF_DIR.glob("*論文*.pdf"))
    
    if not pdf_files:
        print(f"論文PDFファイルが見つかりませんでした: {PDF_DIR}")
        return
    
    print(f"見つかった論文PDFファイル: {len(pdf_files)}件")
    print("-" * 60)
    
    total_subjects = 0
    
    for pdf_file in pdf_files:
        print(f"\n処理中: {pdf_file.name}")
        
        # PDFファイルの相対パスを取得（データベース用）
        pdf_relative_path = str(pdf_file.relative_to(BASE_DIR)).replace("\\", "/")
        
        # PDFからテキストを抽出
        print("  テキスト抽出中...")
        text = extract_text_from_pdf(pdf_file)
        
        if not text:
            print(f"  警告: {pdf_file.name} からテキストを抽出できませんでした")
            continue
        
        print(f"  抽出されたテキスト長: {len(text)} 文字")
        
        # 科目ごとに分割
        print("  科目を分割中...")
        subjects = split_text_by_subjects(text)
        print(f"  見つかった科目数: {len(subjects)}")
        
        # 各科目ごとにJSONファイルを作成
        for subject_name, subject_text in subjects:
            print(f"    科目: {subject_name} ({len(subject_text)} 文字)")

            try:
                subject_id, canonical_name = subject_name_to_id(subject_name)
            except Exception as e:
                print(f"    警告: 科目ID変換に失敗したためスキップします: {e}")
                continue
            
            # JSONデータを作成
            json_data = {
                "year": "R7",
                "exam_type": "予備",
                "subject": subject_id,
                "subject_name": canonical_name,
                "text": subject_text,
                "source_pdf": pdf_relative_path
            }
            
            # JSONファイル名を生成
            safe_subject = sanitize_filename(canonical_name)
            json_filename = f"R7_予備_{safe_subject}.json"
            json_path = JSON_OUTPUT_DIR / json_filename
            
            # JSONファイルを保存
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(json_data, f, ensure_ascii=False, indent=2)
            
            print(f"    保存完了: {json_path.name}")
            total_subjects += 1
    
    print("\n" + "=" * 60)
    print(f"処理完了: {len(pdf_files)}件のPDFファイルから {total_subjects}件のJSONファイルを作成しました")
    print(f"JSONファイルの保存先: {JSON_OUTPUT_DIR}")

if __name__ == "__main__":
    process_paper_pdfs()
