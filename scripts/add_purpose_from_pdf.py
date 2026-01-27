#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
予備試験のJSONファイルに、PDFから抽出した出題趣旨を追加するスクリプト
"""

import os
import json
import re
from pathlib import Path
import pdfplumber

# ベースディレクトリ
BASE_DIR = Path(__file__).parent.parent
JSON_DIR = BASE_DIR / "data" / "json" / "preliminary_exam"
PDF_DIR = BASE_DIR / "data" / "pdfs" / "preliminary_exam"

# 科目名のマッピング（PDFの見出し → JSONのsubject_name）
# 注意: PDFから抽出される科目名は年度によって異なる可能性がある
SUBJECT_MAPPING = {
    "憲法": "憲法",
    "行政法": "行政法",
    "民法": "民法",
    "商法": "商法",
    "民事訴訟法": "民事訴訟法",
    "刑法": "刑法",
    "刑事訴訟法": "刑事訴訟法",
    "実務基礎（民事）": "実務基礎_民事_",
    "実務基礎（刑事）": "実務基礎_刑事_",
    "実務基礎科目（民事）": "実務基礎_民事_",
    "実務基礎科目（刑事）": "実務基礎_刑事_",
    "一般教養科目": "一般教養科目",
    "倒産法": "倒産法",
    "労働法": "労働法",
    "知的財産法": "知的財産法",
    "環境法": "環境法",
    "租税法": "租税法",
    "経済法": "経済法",
    "国際関係法（公法系）": "国際関係法_公法系_",
    "国際関係法（私法系）": "国際関係法_私法系_",
    "国際関係法公法系": "国際関係法_公法系_",
    "国際関係法私法系": "国際関係法_私法系_",
}

def remove_unnecessary_linebreaks(text: str) -> str:
    """PDFから抽出したテキストの不要な改行を除去
    
    行末が句点、読点、閉じ括弧などで終わっていない場合、
    次の行と結合する（本来1つの段落であるべき部分を結合）
    """
    if not text:
        return text
    
    lines = text.split('\n')
    result_lines = []
    
    for i, line in enumerate(lines):
        line = line.strip()
        
        # 空行は保持
        if not line:
            result_lines.append('')
            continue
        
        # 前の行がある場合
        if result_lines and result_lines[-1]:
            prev_line = result_lines[-1]
            
            # 前の行の末尾をチェック
            # 句点、読点、閉じ括弧、閉じ括弧類で終わっている場合は改行を保持
            if prev_line.endswith(('。', '，', '、', '」', '）', '】', '』', '）', '：', '；')):
                result_lines.append(line)
            # 前の行が数字や記号で終わっている場合も改行を保持（例：第1問、⑴など）
            elif re.match(r'.*[0-9０-９]|[⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽]|^[①②③④⑤⑥⑦⑧⑨⑩]', prev_line[-1:]):
                result_lines.append(line)
            # 現在の行が開き括弧や数字で始まる場合は改行を保持
            elif re.match(r'^[「（【『（[0-9０-９]⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽①②③④⑤⑥⑦⑧⑨⑩]', line):
                result_lines.append(line)
            # それ以外の場合は前の行と結合
            else:
                result_lines[-1] = prev_line + line
        else:
            result_lines.append(line)
    
    # 結果を結合（空行は改行として保持）
    return '\n'.join(result_lines)

def extract_purpose_from_pdf(pdf_path: Path) -> dict[str, str]:
    """出題趣旨PDFから各科目の出題趣旨を抽出
    
    Returns:
        dict[str, str]: {科目名: 出題趣旨テキスト} の辞書
    """
    purposes = {}
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            full_text = ""
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    full_text += page_text + "\n"
    except Exception as e:
        print(f"エラー: {pdf_path.name} の読み込みに失敗しました: {e}")
        return purposes
    
    # 科目ごとに分割
    # パターン: 「［憲 法］」「［行政法］」など
    subject_pattern = r'［([^］]+)］'
    
    matches = list(re.finditer(subject_pattern, full_text))
    
    if not matches:
        print(f"警告: {pdf_path.name} に科目見出しが見つかりません")
        print(f"テキストの最初の2000文字:")
        print(full_text[:2000])
        return purposes
    
    # H29の場合は、別のパターンを試す（「憲 法」などの形式）
    if len(matches) == 1 and "一般教養" in matches[0].group(1):
        # 別のパターンで探す: 行頭に来る科目名
        alt_pattern = r'^(憲\s*法|行政法|民\s*法|商\s*法|民事訴訟法|刑\s*法|刑事訴訟法|実務基礎|倒産法|労働法|知的財産法|環境法|租税法|経済法|国際関係法)'
        alt_matches = list(re.finditer(alt_pattern, full_text, re.MULTILINE))
        if alt_matches:
            print(f"  代替パターンで {len(alt_matches)} 個の科目見出しを発見")
            # 代替パターンで抽出を試みる
            matches = alt_matches
            # 科目名の抽出方法を変更
            for i, match in enumerate(alt_matches):
                subject_name_raw = match.group(1).strip()
                subject_name = "".join(subject_name_raw.split())
                
                # 次の見出しまでのテキストを取得
                if i + 1 < len(alt_matches):
                    next_match = alt_matches[i + 1]
                    subject_text = full_text[match.end():next_match.start()]
                else:
                    subject_text = full_text[match.end():]
                
                subject_text = subject_text.strip()
                subject_text = remove_unnecessary_linebreaks(subject_text)
                
                mapped_name = SUBJECT_MAPPING.get(subject_name, subject_name)
                purposes[mapped_name] = subject_text
            return purposes
    
    # デバッグ: 抽出された科目名を表示
    if len(matches) < 10:
        print(f"  抽出された科目見出し: {[m.group(1).strip() for m in matches]}")
    
    # 各科目の出題趣旨を抽出
    for i, match in enumerate(matches):
        subject_name_raw = match.group(1).strip()
        # スペースを除去（ただし、「実務基礎（民事）」などの括弧内のスペースは保持）
        # まず括弧内の文字列を保護
        import re as re_module
        protected_parts = {}
        placeholder = "___PLACEHOLDER___"
        counter = 0
        temp_name = subject_name_raw
        for m in re_module.finditer(r'[（(]([^）)]+)[）)]', temp_name):
            key = f"{placeholder}{counter}"
            protected_parts[key] = m.group(0)
            temp_name = temp_name.replace(m.group(0), key)
            counter += 1
        # スペースを除去
        subject_name = "".join(temp_name.split())
        # 保護した部分を復元
        for key, value in protected_parts.items():
            subject_name = subject_name.replace(key, value)
        
        # 次の見出しまでのテキストを取得
        if i + 1 < len(matches):
            next_match = matches[i + 1]
            subject_text = full_text[match.start():next_match.start()]
        else:
            # 最後の科目は、見出しから最後まで
            subject_text = full_text[match.start():]
        
        # 見出し部分を除去（［科目名］の部分）
        subject_text = re.sub(r'^［[^］]+］\s*', '', subject_text, flags=re.MULTILINE)
        # 最初の数行が科目名の繰り返しや余分な情報の可能性があるので、最初の数行を確認
        lines = subject_text.split('\n')
        # 最初の数行が科目名や余分な情報の可能性があるので、実際の出題趣旨が始まる行を探す
        start_idx = 0
        for idx, line in enumerate(lines[:5]):
            line_clean = line.strip()
            # 科目名や「出題趣旨」などの見出しをスキップ
            if line_clean and not (subject_name in line_clean or '出題趣旨' in line_clean or line_clean.startswith('［')):
                start_idx = idx
                break
        subject_text = '\n'.join(lines[start_idx:])
        subject_text = subject_text.strip()
        
        # 不要な改行を除去
        subject_text = remove_unnecessary_linebreaks(subject_text)
        
        # マッピングに従って科目名を変換
        mapped_name = SUBJECT_MAPPING.get(subject_name, subject_name)
        # 元の科目名（スペース付き）と正規化した科目名（スペース除去）の両方を保持
        purposes[subject_name] = subject_text
        # スペースを除去した科目名も保持
        subject_name_no_space = "".join(subject_name.split())
        if subject_name_no_space != subject_name:
            purposes[subject_name_no_space] = subject_text
        # マッピングされた科目名も保持
        if mapped_name != subject_name and mapped_name != subject_name_no_space:
            purposes[mapped_name] = subject_text
    
    return purposes

def find_json_files_missing_purpose():
    """出題趣旨が欠けているJSONファイルのリストを取得（R7を除く）"""
    missing_files = []
    
    for json_file in JSON_DIR.rglob("*.json"):
        # R7を除外
        if "R7" in str(json_file):
            continue
        
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            purpose = data.get('purpose', '')
            has_purpose = False
            
            if purpose:
                # "（出題趣旨）"または"出題趣旨"という文字列が含まれているか
                if '（出題趣旨）' in purpose or '出題趣旨' in purpose:
                    has_purpose = True
                # 出題趣旨の説明が含まれているかチェック
                elif any(keyword in purpose for keyword in [
                    '本問は', '本件は', '設問', '〔第', 'について問う', 'について論じる',
                    'を問う', 'を論じる', 'を試す', 'を目的とする', 'を狙いとする'
                ]):
                    text = data.get('text', '')
                    if len(purpose) > len(text) * 1.2:
                        has_purpose = True
                    elif '本問は' in purpose or '本件は' in purpose:
                        has_purpose = True
            
            if not has_purpose:
                missing_files.append(json_file)
        
        except Exception as e:
            print(f"エラー: {json_file} の読み込みに失敗しました: {e}")
    
    return missing_files

def add_purpose_to_json(json_file: Path, purpose_text: str):
    """JSONファイルに出題趣旨を追加"""
    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 既存のpurposeフィールドがある場合は、出題趣旨部分を追加
        existing_purpose = data.get('purpose', '')
        
        if existing_purpose and existing_purpose.strip():
            # 既存の内容と出題趣旨を結合
            # 既存の内容が問題文のみの場合は、出題趣旨を追加
            if '（出題趣旨）' not in existing_purpose and '出題趣旨' not in existing_purpose:
                data['purpose'] = existing_purpose + '\n（出題趣旨）' + purpose_text
            else:
                # 既に出題趣旨が含まれている場合は更新しない
                print(f"スキップ: {json_file.name} には既に出題趣旨が含まれています")
                return False
        else:
            data['purpose'] = purpose_text
        
        # JSONファイルを保存
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return True
    
    except Exception as e:
        print(f"エラー: {json_file} の更新に失敗しました: {e}")
        return False

def main():
    """メイン処理"""
    # 出題趣旨が欠けているファイルを取得
    missing_files = find_json_files_missing_purpose()
    print(f"出題趣旨が欠けているファイル: {len(missing_files)}件\n")
    
    # 年度ごとにグループ化
    by_year = {}
    for json_file in missing_files:
        # パスから年度を抽出（例: H28, H29, R1など）
        parts = json_file.parts
        for part in parts:
            if part.startswith('H') or part.startswith('R'):
                year = part
                if year not in by_year:
                    by_year[year] = []
                by_year[year].append(json_file)
                break
    
    # 各年度のPDFから出題趣旨を抽出して追加
    for year in sorted(by_year.keys()):
        print(f"\n=== {year} ===")
        
        # 出題趣旨PDFのパス
        purpose_pdf = PDF_DIR / year / "論述" / "出題趣旨.pdf"
        
        if not purpose_pdf.exists():
            print(f"警告: {purpose_pdf} が見つかりません")
            continue
        
        # PDFから出題趣旨を抽出
        purposes = extract_purpose_from_pdf(purpose_pdf)
        print(f"抽出した科目数: {len(purposes)}")
        if purposes:
            # 抽出した科目名を表示（最初の5つまで）
            subject_names = list(purposes.keys())[:5]
            print(f"抽出した科目（最初の5つ）: {subject_names}")
        
        # 各JSONファイルに出題趣旨を追加
        for json_file in by_year[year]:
            with open(json_file, 'r', encoding='utf-8') as f:
                json_data = json.load(f)
            subject_name = json_data.get('subject_name', '')
            
            # 科目名のマッピングを確認
            # JSONのsubject_nameを正規化（括弧を統一、アンダースコアを括弧に変換、スペースを除去）
            subject_name_normalized = "".join(subject_name.split("_")).replace("（", "(").replace("）", ")")
            subject_name_clean = "".join(subject_name_normalized.split())
            
            # まず元の科目名で直接検索
            purpose_text = purposes.get(subject_name)
            
            if not purpose_text:
                # スペースを除去した科目名で検索
                subject_name_no_space = "".join(subject_name.split())
                purpose_text = purposes.get(subject_name_no_space)
            
            if not purpose_text:
                # PDFから抽出された科目名を正規化して直接比較
                for key, value in purposes.items():
                    # キーを正規化（スペースを除去、括弧を統一）
                    key_clean = "".join(key.split()).replace("（", "(").replace("）", ")")
                    if subject_name_clean == key_clean:
                        purpose_text = value
                        break
                    
                    # 部分一致も試す（実務基礎、国際関係法など）
                    if "実務基礎" in subject_name_clean and "実務基礎" in key_clean:
                        if ("民事" in subject_name_clean and "民事" in key_clean) or ("刑事" in subject_name_clean and "刑事" in key_clean):
                            purpose_text = value
                            break
                    elif "国際関係法" in subject_name_clean and "国際関係法" in key_clean:
                        if ("公法" in subject_name_clean and "公法" in key_clean) or ("私法" in subject_name_clean and "私法" in key_clean):
                            purpose_text = value
                            break
            
            if not purpose_text:
                # マッピングに従って変換を試す
                for pdf_name, json_name in SUBJECT_MAPPING.items():
                    json_name_normalized = "".join(json_name.split("_")).replace("（", "(").replace("）", ")")
                    json_name_clean = "".join(json_name_normalized.split())
                    if json_name_clean == subject_name_clean:
                        purpose_text = purposes.get(pdf_name)
                        if purpose_text:
                            break
            
            if not purpose_text:
                # マッピングが見つからない場合は、部分一致で探す
                for key, value in purposes.items():
                    # 実務基礎の特殊な表記に対応
                    if subject_name == "実務基礎（民事）" or subject_name == "実務基礎_民事_":
                        if "実務基礎" in key and ("民事" in key or "民事" in key.replace("（", "").replace("）", "").replace("(", "").replace(")", "")):
                            purpose_text = value
                            break
                    elif subject_name == "実務基礎（刑事）" or subject_name == "実務基礎_刑事_":
                        if "実務基礎" in key and ("刑事" in key or "刑事" in key.replace("（", "").replace("）", "").replace("(", "").replace(")", "")):
                            purpose_text = value
                            break
                    # 国際関係法の特殊な表記に対応
                    elif subject_name == "国際関係法_公法系_" or "国際関係法" in subject_name and "公法" in subject_name:
                        if "国際関係法" in key and ("公法" in key or "公法系" in key):
                            purpose_text = value
                            break
                    elif subject_name == "国際関係法_私法系_" or "国際関係法" in subject_name and "私法" in subject_name:
                        if "国際関係法" in key and ("私法" in key or "私法系" in key):
                            purpose_text = value
                            break
                    # 通常の科目名の比較（スペース、アンダースコア、括弧を除去）
                    subject_name_clean = "".join(subject_name.split("_")).replace("（", "").replace("）", "").replace("(", "").replace(")", "")
                    key_clean = "".join(key.split()).replace("（", "").replace("）", "").replace("(", "").replace(")", "")
                    if subject_name_clean == key_clean:
                        purpose_text = value
                        break
                    # 部分一致（主要な文字列が含まれているか）
                    elif len(subject_name_clean) > 2 and subject_name_clean in key_clean:
                        purpose_text = value
                        break
                    elif len(key_clean) > 2 and key_clean in subject_name_clean:
                        purpose_text = value
                        break
            
            if purpose_text:
                if add_purpose_to_json(json_file, purpose_text):
                    print(f"OK: {json_file.name}")
                else:
                    print(f"SKIP: {json_file.name} (スキップ)")
            else:
                # デバッグ: どの科目名が比較されているか表示
                available_keys = list(purposes.keys())[:5]
                print(f"NG: {json_file.name} (出題趣旨が見つかりません)")
                print(f"  JSONのsubject_name: '{subject_name}' -> 正規化: '{subject_name_clean}'")
                print(f"  PDFから抽出された科目（最初の5つ）: {available_keys}")

if __name__ == "__main__":
    main()
