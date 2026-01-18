#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
R1予備試験の論文PDFファイルからテキストを抽出し、科目ごとにJSONファイルとして保存
出題趣旨PDFから各科目の出題趣旨も抽出して追加

JSON構造:
{
    "year": "R1",
    "exam_type": "予備",
    "subject": 1,
    "subject_name": "憲法",
    "text": "抽出したテキスト（問題文）",
    "purpose": "出題趣旨",
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
PDF_DIR = BASE_DIR / "data" / "pdfs" / "preliminary_exam" / "R1"
JSON_OUTPUT_DIR = BASE_DIR / "data" / "json" / "preliminary_exam" / "R1"

def subject_name_to_id(subject_name: str) -> tuple[int, str]:
    s = "".join((subject_name or "").split())
    if s == "民事":
        s = "実務基礎（民事）"
    elif s == "刑事":
        s = "実務基礎（刑事）"
    s = s.replace("(", "（").replace(")", "）")
    if s.startswith("法律実務基礎科目"):
        s = s.replace("法律実務基礎科目", "実務基礎")

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

def extract_purpose_by_subjects(purpose_pdf_path: Path) -> dict[str, str]:
    """出題趣旨PDFから各科目の出題趣旨を抽出
    
    Returns:
        dict[str, str]: {科目名: 出題趣旨テキスト} の辞書
    """
    print(f"  出題趣旨PDFを読み込み中: {purpose_pdf_path.name}")
    purpose_text = extract_text_from_pdf(purpose_pdf_path)
    
    if not purpose_text:
        print(f"  警告: 出題趣旨PDFからテキストを抽出できませんでした")
        return {}
    
    print(f"  出題趣旨テキスト長: {len(purpose_text)} 文字")
    
    # 科目ごとに分割
    subjects = split_text_by_subjects(purpose_text)
    
    # 辞書形式に変換
    purpose_dict = {}
    for subject_name, subject_text in subjects:
        # 見出し部分を削除（最初の「［科目名］」を削除）
        cleaned_text = re.sub(r'^［[^］]+］\s*', '', subject_text, flags=re.MULTILINE).strip()
        
        # 「（出題の趣旨）」または「（出題の趣旨）」以降だけを抽出
        # 複数のパターンを試行
        purpose_patterns = [
            r'（出題の趣旨）',
            r'（出題の趣旨）',
            r'\(出題の趣旨\)',
            r'出題の趣旨',
        ]
        
        purpose_text = cleaned_text
        for pattern in purpose_patterns:
            purpose_match = re.search(pattern, purpose_text)
            if purpose_match:
                # 「（出題の趣旨）」の後のテキストを取得
                purpose_text = purpose_text[purpose_match.end():].strip()
                # 次の科目の見出し（「［」で始まる）までを取得
                next_subject_match = re.search(r'^［', purpose_text, flags=re.MULTILINE)
                if next_subject_match:
                    purpose_text = purpose_text[:next_subject_match.start()].strip()
                break
        
        # 実務基礎科目の名前を統一
        if subject_name == "民 事":
            subject_name = "実務基礎（民事）"
        elif subject_name == "刑 事":
            subject_name = "実務基礎（刑事）"
        
        purpose_dict[subject_name] = purpose_text
        print(f"    科目: {subject_name} ({len(purpose_text)} 文字)")
    
    return purpose_dict

def sanitize_filename(text: str) -> str:
    """ファイル名に使えない文字を置換"""
    # ファイル名に使えない文字を置換
    invalid_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|', '・', '（', '）']
    for char in invalid_chars:
        text = text.replace(char, '_')
    return text

def normalize_subject_name(subject_name: str) -> str:
    """科目名を正規化（出題趣旨PDFと問題文PDFで表記が異なる場合に対応）"""
    # スペースを削除して比較用の正規化名を作成
    normalized = subject_name.replace(' ', '').replace('　', '').replace('・', '').replace('（', '(').replace('）', ')')
    
    # よくある表記の違いを統一（出題趣旨PDFの表記に合わせる）
    # 出題趣旨PDFでは「憲 法」「行政法」のようにスペースが入っている
    mapping = {
        '憲法': '憲 法',
        '行政法': '行政法',
        '刑法': '刑 法',
        '刑事訴訟法': '刑事訴訟法',
        '民法': '民 法',
        '商法': '商 法',
        '民事訴訟法': '民事訴訟法',
        '労働法': '労 働 法',
        '倒産法': '倒 産 法',
        '租税法': '租 税 法',
        '経済法': '経 済 法',
        '知的財産法': '知的財産法',
        '環境法': '環 境 法',
        '国際関係法(公法系)': '国際関係法（公法系）',
        '国際関係法(私法系)': '国際関係法（私法系）',
        '実務基礎(民事)': '実務基礎（民事）',
        '実務基礎(刑事)': '実務基礎（刑事）',
    }
    
    # マッピングがあれば使用、なければ元の名前を返す
    for key, value in mapping.items():
        if normalized == key:
            return value
    
    return subject_name

def find_purpose_for_subject(subject_name: str, purpose_dict: dict[str, str]) -> str:
    """科目名から出題趣旨を検索（複数のパターンで試行）"""
    # 1. そのまま検索
    if subject_name in purpose_dict:
        return purpose_dict[subject_name]
    
    # 2. 正規化して検索
    normalized = normalize_subject_name(subject_name)
    if normalized in purpose_dict:
        return purpose_dict[normalized]
    
    # 3. スペースを削除して検索
    no_space = subject_name.replace(' ', '').replace('　', '')
    for key in purpose_dict.keys():
        if key.replace(' ', '').replace('　', '') == no_space:
            return purpose_dict[key]
    
    # 4. 部分一致で検索（「憲法・行政法」から「憲 法」を探す）
    if '・' in subject_name or '・' in subject_name:
        parts = re.split(r'[・・]', subject_name)
        for part in parts:
            part = part.strip()
            normalized_part = normalize_subject_name(part)
            if normalized_part in purpose_dict:
                return purpose_dict[normalized_part]
    
    return ""

def process_paper_pdfs():
    """論文PDFファイルを処理してJSONファイルを作成（科目ごとに分割）"""
    
    # 出力ディレクトリを作成
    JSON_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # 出題趣旨PDFを処理
    purpose_pdf = PDF_DIR / "R1_予備_論文_出題趣旨.pdf"
    purpose_dict = {}
    
    if purpose_pdf.exists():
        print("=" * 60)
        print("出題趣旨PDFを処理中...")
        print("=" * 60)
        purpose_dict = extract_purpose_by_subjects(purpose_pdf)
        print(f"抽出された科目数: {len(purpose_dict)}")
    else:
        print(f"警告: 出題趣旨PDFが見つかりませんでした: {purpose_pdf}")
    
    # PDFディレクトリ内の論文PDFファイルを取得（出題趣旨PDFを除く）
    pdf_files = [f for f in PDF_DIR.glob("*論文*.pdf") if "出題趣旨" not in f.name]
    
    if not pdf_files:
        print(f"論文PDFファイルが見つかりませんでした: {PDF_DIR}")
        return
    
    print("\n" + "=" * 60)
    print(f"見つかった論文PDFファイル: {len(pdf_files)}件")
    print("=" * 60)
    
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
            
            # 見出し部分を削除（最初の「［科目名］」を削除）
            cleaned_text = re.sub(r'^［[^］]+］\s*', '', subject_text, flags=re.MULTILINE).strip()
            
            # 複合科目名（「憲法・行政法」など）の場合はスキップ（個別科目のみ処理）
            if '・' in subject_name or '・' in subject_name:
                print(f"      スキップ: 複合科目名のため個別に分割済み")
                continue
            
            # テキストが短すぎる場合はスキップ（見出しのみの可能性）
            if len(cleaned_text) < 100:
                print(f"      スキップ: テキストが短すぎます（{len(cleaned_text)}文字）")
                continue
            
            # 実務基礎科目の名前を統一
            if subject_name == "民 事":
                subject_name = "実務基礎（民事）"
            elif subject_name == "刑 事":
                subject_name = "実務基礎（刑事）"

            try:
                subject_id, canonical_name = subject_name_to_id(subject_name)
            except Exception as e:
                print(f"      スキップ: 科目ID変換に失敗しました: {e}")
                continue
            
            # 出題趣旨を取得
            purpose = find_purpose_for_subject(subject_name, purpose_dict)
            
            if purpose:
                print(f"      出題趣旨を追加: {len(purpose)} 文字")
            else:
                print(f"      警告: 出題趣旨が見つかりませんでした（科目名: {subject_name}）")
            
            # JSONデータを作成
            json_data = {
                "year": "R1",
                "exam_type": "予備",
                "subject": subject_id,
                "subject_name": canonical_name,
                "text": cleaned_text,
                "source_pdf": pdf_relative_path
            }
            
            # 出題趣旨がある場合は追加
            if purpose:
                json_data["purpose"] = purpose
            
            # JSONファイル名を生成
            safe_subject = sanitize_filename(canonical_name)
            json_filename = f"R1_予備_{safe_subject}.json"
            json_path = JSON_OUTPUT_DIR / json_filename
            
            # 既存のファイルがある場合は上書き（選択科目PDFで重複する可能性があるため）
            if json_path.exists():
                print(f"      既存ファイルを上書き: {json_path.name}")
            
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
