#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
H29の一般教養科目以外の科目について、PDFから出題趣旨を抽出してJSONファイルに追加するスクリプト
問題文は入れずに「出題趣旨」部分だけを入れる
"""

import json
import re
from pathlib import Path
import pdfplumber

# ベースディレクトリ
BASE_DIR = Path(r"C:\Users\tvxqt\.shihou-zyuken2601\law-review")
JSON_DIR = BASE_DIR / "data" / "json" / "preliminary_exam" / "H29"
PDF_PATH = BASE_DIR / "data" / "pdfs" / "preliminary_exam" / "H29" / "論述" / "出題趣旨.pdf"

# 科目名のマッピング（PDFの見出し → JSONのsubject_name）
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
}

def remove_unnecessary_linebreaks(text: str) -> str:
    """PDFから抽出したテキストの不要な改行を除去"""
    if not text:
        return text
    
    lines = text.split('\n')
    result_lines = []
    
    for i, line in enumerate(lines):
        line = line.strip()
        
        if not line:
            result_lines.append('')
            continue
        
        if result_lines and result_lines[-1]:
            prev_line = result_lines[-1]
            
            if prev_line.endswith(('。', '，', '、', '」', '）', '】', '』', '）', '：', '；')):
                result_lines.append(line)
            elif re.match(r'.*[0-9０-９]|[⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽]|^[①②③④⑤⑥⑦⑧⑨⑩]', prev_line[-1:]):
                result_lines.append(line)
            elif re.match(r'^[「（【『（[0-9０-９]⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽①②③④⑤⑥⑦⑧⑨⑩]', line):
                result_lines.append(line)
            else:
                result_lines[-1] = prev_line + line
        else:
            result_lines.append(line)
    
    return '\n'.join(result_lines)

def extract_purpose_from_pdf(pdf_path: Path) -> dict[str, str]:
    """出題趣旨PDFから各科目の出題趣旨を抽出（問題文は除外）"""
    purposes = {}
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            full_text = ""
            for page in pdf.pages:
                # テーブルも含めて抽出を試みる
                page_text = page.extract_text()
                if page_text:
                    full_text += page_text + "\n"
                
                # テーブルがある場合はテーブルからも抽出
                tables = page.extract_tables()
                for table in tables:
                    for row in table:
                        if row:
                            row_text = ' '.join([str(cell) if cell else '' for cell in row])
                            if row_text.strip():
                                full_text += row_text + "\n"
    except Exception as e:
        print(f"エラー: PDFの読み込みに失敗しました: {e}")
        return purposes
    
    # デバッグ: 最初の3000文字を表示
    print(f"PDFテキストの最初の3000文字:")
    print(full_text[:3000])
    print()
    
    # 科目ごとに分割
    # H29の形式を確認: 「［科目名］」形式を試す
    subject_pattern = r'［([^］]+)］'
    matches = list(re.finditer(subject_pattern, full_text))
    
    print(f"「［科目名］」パターンで {len(matches)} 個の見出しを発見")
    if matches:
        print(f"見出し: {[m.group(1).strip() for m in matches[:10]]}")
    
    # もし見つからなければ、行頭の科目名を探す
    if not matches or len(matches) < 5:
        # 行頭に来る科目名パターン（より柔軟に）
        alt_patterns = [
            r'^(憲\s*法|行政法|民\s*法|商\s*法|民事訴訟法|刑\s*法|刑事訴訟法|実務基礎)',
            r'^([憲行民商刑実務基][^\n]{0,20})',
        ]
        
        for alt_pattern in alt_patterns:
            alt_matches = list(re.finditer(alt_pattern, full_text, re.MULTILINE))
            if alt_matches and len(alt_matches) > len(matches):
                print(f"  代替パターン {alt_pattern} で {len(alt_matches)} 個の科目見出しを発見")
                matches = alt_matches
                break
    
    if not matches:
        print("警告: 科目見出しが見つかりません")
        return purposes
    
    # 各科目の出題趣旨を抽出
    for i, match in enumerate(matches):
        if match.lastindex:
            subject_name_raw = match.group(1).strip()
        else:
            subject_name_raw = match.group(0).strip()
        
        subject_name = "".join(subject_name_raw.split())
        
        # 次の見出しまでのテキストを取得
        if i + 1 < len(matches):
            next_match = matches[i + 1]
            subject_text = full_text[match.end():next_match.start()]
        else:
            subject_text = full_text[match.end():]
        
        # 見出し部分を除去
        subject_text = re.sub(r'^［[^］]+］\s*', '', subject_text, flags=re.MULTILINE)
        subject_text = re.sub(r'^[憲行民商刑実務基][^\n]{0,20}\s*', '', subject_text, flags=re.MULTILINE)
        
        # 「出題趣旨」の部分だけを抽出
        purpose_text = extract_purpose_only(subject_text)
        
        if purpose_text:
            mapped_name = SUBJECT_MAPPING.get(subject_name, subject_name)
            purposes[mapped_name] = purpose_text
            purposes[subject_name] = purpose_text
            print(f"  抽出: {subject_name} -> {mapped_name} ({len(purpose_text)}文字)")
    
    return purposes

def extract_purpose_only(text: str) -> str:
    """テキストから「出題趣旨」の部分だけを抽出（問題文は除外）"""
    if not text:
        return ""
    
    # 「出題趣旨」という文字列を探す
    purpose_markers = [
        r'（出題趣旨）',
        r'\(出題趣旨\)',
        r'出題趣旨',
    ]
    
    purpose_start = -1
    for marker in purpose_markers:
        match = re.search(marker, text)
        if match:
            purpose_start = match.start()
            break
    
    if purpose_start == -1:
        # 「出題趣旨」が見つからない場合、テキスト全体を返す
        # ただし、問題文らしい部分（「次の文章を読んで」など）は除外
        lines = text.split('\n')
        filtered_lines = []
        skip_until_purpose = True
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # 「出題趣旨」関連のキーワードが見つかったら、それ以降を取得
            if any(keyword in line for keyword in ['出題趣旨', '本問は', '本件は', '設問', 'について問う', 'について論じる']):
                skip_until_purpose = False
            
            if not skip_until_purpose:
                # 問題文らしい部分をスキップ
                if any(problem_keyword in line for problem_keyword in [
                    '次の文章を読んで', '以下の事例', '次の事例', '【事実】', '【事例】',
                    '〔設問', '設問１', '設問２', '設問３'
                ]):
                    continue
                
                filtered_lines.append(line)
        
        if filtered_lines:
            return remove_unnecessary_linebreaks('\n'.join(filtered_lines))
        return ""
    
    # 「出題趣旨」以降のテキストを取得
    purpose_text = text[purpose_start:]
    
    # 「出題趣旨」マーカーを除去
    purpose_text = re.sub(r'^[（(]*出題趣旨[）)]*\s*', '', purpose_text)
    
    # 問題文らしい部分を除外
    lines = purpose_text.split('\n')
    filtered_lines = []
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # 問題文らしい部分をスキップ
        if any(problem_keyword in line for problem_keyword in [
            '次の文章を読んで', '以下の事例', '次の事例', '【事実】', '【事例】',
            '〔設問', '設問１', '設問２', '設問３', '解答に当たっては'
        ]):
            # ただし、「解答に当たっては」は出題趣旨の一部として含める
            if '解答に当たっては' in line:
                filtered_lines.append(line)
            continue
        
        filtered_lines.append(line)
    
    result = remove_unnecessary_linebreaks('\n'.join(filtered_lines))
    
    # 「（出題趣旨）」を先頭に追加
    if result and not result.startswith('（出題趣旨）'):
        result = '（出題趣旨）' + result
    
    return result.strip()

def main():
    """メイン処理"""
    if not PDF_PATH.exists():
        print(f"エラー: PDFファイルが見つかりません: {PDF_PATH}")
        return
    
    # PDFから出題趣旨を抽出
    print("PDFから出題趣旨を抽出中...")
    purposes = extract_purpose_from_pdf(PDF_PATH)
    print(f"抽出した科目数: {len(purposes)}")
    if purposes:
        print(f"抽出した科目: {list(purposes.keys())}")
    
    # H29のJSONファイルを処理（一般教養科目以外）
    json_files = list(JSON_DIR.glob("*.json"))
    json_files = [f for f in json_files if "一般教養" not in f.name]
    
    print(f"\n処理対象のJSONファイル数: {len(json_files)}")
    print("-" * 80)
    
    fixed_count = 0
    skipped_count = 0
    error_count = 0
    
    for json_file in sorted(json_files):
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # 既にpurposeが存在する場合はスキップ
            existing_purpose = data.get('purpose', '').strip()
            if existing_purpose and ('出題趣旨' in existing_purpose or len(existing_purpose) > 50):
                print(f"[SKIP] {json_file.name}: 既に出題趣旨が存在します")
                skipped_count += 1
                continue
            
            subject_name = data.get('subject_name', '')
            
            # 科目名で出題趣旨を検索
            purpose_text = None
            
            # 直接マッチ
            purpose_text = purposes.get(subject_name)
            
            # マッピングを試す
            if not purpose_text:
                for pdf_name, json_name in SUBJECT_MAPPING.items():
                    if json_name == subject_name:
                        purpose_text = purposes.get(pdf_name)
                        if purpose_text:
                            break
            
            # 正規化して比較
            if not purpose_text:
                subject_name_clean = "".join(subject_name.split("_")).replace("（", "(").replace("）", ")")
                for key, value in purposes.items():
                    key_clean = "".join(key.split()).replace("（", "(").replace("）", ")")
                    if subject_name_clean == key_clean:
                        purpose_text = value
                        break
            
            # 部分一致で探す（実務基礎など）
            if not purpose_text:
                if "実務基礎" in subject_name:
                    for key, value in purposes.items():
                        if "実務基礎" in key:
                            if ("民事" in subject_name and "民事" in key) or ("刑事" in subject_name and "刑事" in key):
                                purpose_text = value
                                break
            
            if purpose_text:
                # purposeフィールドを追加
                data['purpose'] = purpose_text
                
                # JSONファイルを保存
                with open(json_file, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                
                print(f"[OK] {json_file.name}: 出題趣旨を追加しました（{len(purpose_text)}文字）")
                fixed_count += 1
            else:
                print(f"[NG] {json_file.name}: 出題趣旨が見つかりません（subject_name: '{subject_name}'）")
                error_count += 1
        
        except Exception as e:
            print(f"[ERROR] {json_file.name}: {e}")
            error_count += 1
    
    print("-" * 80)
    print(f"修正完了: {fixed_count}ファイル")
    print(f"スキップ: {skipped_count}ファイル")
    print(f"エラー: {error_count}ファイル")
    print(f"合計: {len(json_files)}ファイル")

if __name__ == "__main__":
    main()
