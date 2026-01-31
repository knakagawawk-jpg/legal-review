#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""H18 judicial exam JSON修正スクリプト
- 公法系、民事系、刑事系を個別科目に分割
- TextとPurposeからPDF由来の不要な改行を削除
"""

import json
import re
from pathlib import Path

H18_DIR = Path(__file__).parent.parent / "data" / "json" / "judicial_exam" / "H18"


def remove_unnecessary_newlines(text: str) -> str:
    """PDF由来の不要な改行を削除（数字・％・年・円などが分割されている場合を結合）"""
    if not text:
        return text
    
    # 数字と次の文字の間の改行を削除（例: ３\n年 → ３年, ３０\n％ → ３０％）
    # パターン: 数字（全角・半角）の後に改行、その後に年/％/円/倍/メートル等
    patterns = [
        (r'([０-９0-9．.]+)\n([年月日％％円億万倍メートル㎝件号条項])', r'\1\2'),
        (r'([０-９0-9]+)\n([年月日％％円億万倍メートル㎝])', r'\1\2'),
        # 小数点の途中の改行: ４０．\n５％ → ４０．５％
        (r'(\.)\n([０-９0-9]+)', r'\1\2'),
        # 漢数字・大きな数値の分割: ７兆\n４０００億円
        (r'([兆億万])\n([０-９0-9])', r'\1\2'),
        # 約の後の改行
        (r'(約)\n([０-９0-9])', r'\1\2'),
        # 第と数字の分割: 第２\n回
        (r'(第[０-９0-9一二三四五六七八九十]+)\n([回号項])', r'\1\2'),
        # 法律名の途中: 「製造たばこの警告表示に関する法律」\n（以下
        (r'(」)\n(（)', r'\1\2'),
        # フッターのページ番号による分割（- 2 -\n３０％）は前の文とつなげる
        (r'約\s*\n-\s*[0-9]+\s*-\s*\n([０-９0-9]+％)', r'約\1'),
    ]
    
    result = text
    for pattern, replacement in patterns:
        result = re.sub(pattern, replacement, result)
    
    # 短い行末の改行を削除（文の区切りでない場合）
    # 句点。！？）」の後の改行は段落区切りとして残す
    # 上記以外で、改行の前が短く、後が小文字や記号で始まる場合は結合
    lines = result.split('\n')
    output = []
    i = 0
    while i < len(lines):
        line = lines[i]
        # ページ番号だけの行（- 1 -, - 2 - など）は特別処理
        if re.match(r'^-\s*\d+\s*-$', line.strip()):
            # 前の行と結合する場合：前の行が「約」「から」などで終わる
            if output and re.search(r'(約|から|に|を|の|が|と)$', output[-1]):
                # 次の行を取得して結合
                if i + 1 < len(lines):
                    next_line = lines[i + 1]
                    # 次の行が数字で始まる場合、前の行+次の行に
                    if re.match(r'^[０-９0-9]', next_line):
                        output[-1] = output[-1].rstrip() + next_line
                        i += 2
                        continue
            output.append(line)
            i += 1
            continue
            
        # 通常の処理：不要な改行を検出
        if output and line and not re.match(r'^[〔【■□◆◇]', line):
            # 前の行が句点で終わっていない、かつ現在の行が小文字/記号で始まる
            prev = output[-1]
            if not re.search(r'[。．.!?）」]』\s]*$', prev):
                if re.match(r'^[０-９0-9a-zＡ-Ｚa-z（(「『]', line) or len(line) < 30:
                    # 結合
                    output[-1] = prev.rstrip() + line
                    i += 1
                    continue
        output.append(line)
        i += 1
    
    return '\n'.join(output)


def clean_text_simple(text: str) -> str:
    """シンプルな改行クリーニング（数字・単位の分割を主に修正）"""
    if not text:
        return text
    
    result = text
    
    # 「約\n- 2 -\n３０％」パターン（ページ番号で分断された数値）を先に処理
    result = re.sub(r'約\s*\n-\s*\d+\s*-\s*\n([０-９0-9]+％)', r'約\1', result)
    
    # 明確なパターンの置換
    replacements = [
        (r'([０-９0-9]+)\n年', r'\1年'),
        (r'([０-９0-9]+)\n％', r'\1％'),
        (r'([０-９0-9．.]+)\n([０-９0-9]+％)', r'\1\2'),
        (r'([０-９0-9]+)\n円', r'\1円'),
        (r'([兆億万])\n([０-９0-9])', r'\1\2'),
        (r'(約)\n([０-９0-9])', r'\1\2'),
        (r'(」)\n(（以下)', r'\1\2'),
        (r'(法律」)\n(（以下)', r'\1\2'),
        # 種\n々 → 種々
        (r'(種)\n(々)', r'\1\2'),
        # 第と数字の分割
        (r'(第[０-９0-9]+条)\n(第)', r'\1\2'),
        # メートル等の分割: １３メー\nトル
        (r'(メー)\n(トル)', r'\1\2'),
        # 土\n地
        (r'(土)\n(地)', r'\1\2'),
    ]
    
    for pattern, repl in replacements:
        result = re.sub(pattern, repl, result)
    
    # 連続する空白改行を1つに
    result = re.sub(r'\n{3,}', '\n\n', result)
    
    return result


def split_public_law(data: dict) -> tuple[dict, dict]:
    """公法系を憲法と行政法に分割"""
    text = data["text"]
    purpose = data["purpose"]
    
    # 第1問と第2問の境界を検出
    q2_start = text.find("\n〔第２問〕")
    if q2_start == -1:
        q2_start = text.find("〔第２問〕")
    
    const_text = clean_text_simple(text[:q2_start].strip()) if q2_start > 0 else clean_text_simple(text)
    admin_text = clean_text_simple(text[q2_start:].strip()) if q2_start > 0 else ""
    
    # purposeの分割（公法系は出題趣旨全体を含むので【民事系科目】までを抽出）
    purpose_civil = purpose.find("\n【民事系科目】")
    public_purpose = purpose[:purpose_civil].strip() if purpose_civil > 0 else purpose
    
    purpose_q2 = public_purpose.find("\n〔第２問〕")
    if purpose_q2 == -1:
        purpose_q2 = public_purpose.find("〔第２問〕")
    
    const_purpose = clean_text_simple(public_purpose[:purpose_q2].strip()) if purpose_q2 > 0 else clean_text_simple(public_purpose)
    admin_purpose = clean_text_simple(public_purpose[purpose_q2:].strip()) if purpose_q2 > 0 else ""
    
    # purposeの先頭の】を削除（出題趣旨の冒頭残骸）
    if const_purpose.startswith("】"):
        const_purpose = const_purpose[1:].strip()
    
    const = {
        "year": data["year"],
        "exam_type": data["exam_type"],
        "subject_name": "憲法",
        "text": const_text,
        "source_pdf": data["source_pdf"],
        "purpose": const_purpose,
    }
    admin = {
        "year": data["year"],
        "exam_type": data["exam_type"],
        "subject_name": "行政法",
        "text": admin_text,
        "source_pdf": data["source_pdf"],
        "purpose": admin_purpose,
    }
    return const, admin


def split_civil_law(data: dict) -> tuple[dict, dict, dict]:
    """民事系を民法、商法、民事訴訟法に分割"""
    text = data["text"]
    purpose = data["purpose"]
    
    # 民事系は第1問が商法（会社法）、第2問が民法・民訴融合
    # テキストの分割
    q2_start = text.find("\n〔第２問〕")
    if q2_start == -1:
        q2_start = text.find("論文式試験問題集［民事系科目第２問］")
    
    commercial_text = clean_text_simple(text[:q2_start].strip()) if q2_start > 0 else clean_text_simple(text)
    civil_minshu_text = clean_text_simple(text[q2_start:].strip()) if q2_start > 0 else ""
    
    # 民法と民事訴訟法は第2問に融合しているため、第2問を両方のファイルに同じテキストで持たせる
    # （設問1,2,4が民訴、設問3が民法・商法なので完全分離は困難）
    
    # purposeの分割（民事系ファイルのpurposeは民事系部分から始まる、または全体の場合は【民事系科目】から抽出）
    purpose_civil_start = purpose.find("【民事系科目】")
    if purpose_civil_start < 0:
        purpose_civil_start = 0
    purpose_criminal = purpose.find("\n【刑事系科目】")
    civil_purpose_block = purpose[purpose_civil_start:purpose_criminal].strip() if purpose_criminal > 0 else purpose[purpose_civil_start:].strip()
    
    purpose_q2 = civil_purpose_block.find("〔第２問〕")
    commercial_purpose = clean_text_simple(civil_purpose_block[:purpose_q2].strip()) if purpose_q2 > 0 else clean_text_simple(civil_purpose_block)
    civil_purpose = clean_text_simple(civil_purpose_block[purpose_q2:].strip()) if purpose_q2 > 0 else ""
    
    commercial = {
        "year": data["year"],
        "exam_type": data["exam_type"],
        "subject_name": "商法",
        "text": commercial_text,
        "source_pdf": data["source_pdf"],
        "purpose": commercial_purpose,
    }
    civil = {
        "year": data["year"],
        "exam_type": data["exam_type"],
        "subject_name": "民法",
        "text": civil_minshu_text,
        "source_pdf": data["source_pdf"],
        "purpose": civil_purpose,
    }
    minshu = {
        "year": data["year"],
        "exam_type": data["exam_type"],
        "subject_name": "民事訴訟法",
        "text": civil_minshu_text,
        "source_pdf": data["source_pdf"],
        "purpose": civil_purpose,
    }
    return civil, commercial, minshu


def split_criminal_law(data: dict) -> tuple[dict, dict]:
    """刑事系を刑法と刑事訴訟法に分割"""
    text = data["text"]
    purpose = data["purpose"]
    
    q2_start = text.find("\n〔第２問〕")
    if q2_start == -1:
        q2_start = text.find("〔第２問〕")
    
    kei_text = clean_text_simple(text[:q2_start].strip()) if q2_start > 0 else clean_text_simple(text)
    keiji_text = clean_text_simple(text[q2_start:].strip()) if q2_start > 0 else ""
    
    # purposeの分割（刑事系部分のみ、【刑事系科目】から【選択科目】の前まで）
    purpose_criminal_start = purpose.find("【刑事系科目】")
    if purpose_criminal_start < 0:
        purpose_criminal_start = 0
    purpose_select = purpose.find("\n【選択科目】")
    criminal_purpose_block = purpose[purpose_criminal_start:purpose_select].strip() if purpose_select > 0 else purpose[purpose_criminal_start:].strip()
    
    purpose_q2 = criminal_purpose_block.find("〔第２問〕")
    kei_purpose = clean_text_simple(criminal_purpose_block[:purpose_q2].strip()) if purpose_q2 > 0 else clean_text_simple(criminal_purpose_block)
    keiji_purpose = clean_text_simple(criminal_purpose_block[purpose_q2:].strip()) if purpose_q2 > 0 else ""
    
    if kei_purpose.startswith("】"):
        kei_purpose = kei_purpose[1:].strip()
    
    kei = {
        "year": data["year"],
        "exam_type": data["exam_type"],
        "subject_name": "刑法",
        "text": kei_text,
        "source_pdf": data["source_pdf"],
        "purpose": kei_purpose,
    }
    keiji = {
        "year": data["year"],
        "exam_type": data["exam_type"],
        "subject_name": "刑事訴訟法",
        "text": keiji_text,
        "source_pdf": data["source_pdf"],
        "purpose": keiji_purpose,
    }
    return kei, keiji


def process_file(filepath: Path) -> bool:
    """単一ファイルのtextとpurposeをクリーニング"""
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    if "text" in data:
        data["text"] = clean_text_simple(data["text"])
    if "purpose" in data:
        data["purpose"] = clean_text_simple(data["purpose"])
    
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return True


def main():
    H18_DIR.mkdir(parents=True, exist_ok=True)
    
    # 1. 公法系を分割
    public_path = H18_DIR / "H18_司法_公法系.json"
    if public_path.exists():
        with open(public_path, "r", encoding="utf-8") as f:
            public_data = json.load(f)
        const_data, admin_data = split_public_law(public_data)
        with open(H18_DIR / "H18_司法_憲法.json", "w", encoding="utf-8") as f:
            json.dump(const_data, f, ensure_ascii=False, indent=2)
        with open(H18_DIR / "H18_司法_行政法.json", "w", encoding="utf-8") as f:
            json.dump(admin_data, f, ensure_ascii=False, indent=2)
        public_path.unlink()
    
    # 2. 民事系を分割
    civil_path = H18_DIR / "H18_司法_民事系.json"
    if civil_path.exists():
        with open(civil_path, "r", encoding="utf-8") as f:
            civil_data = json.load(f)
        civil_d, commercial_d, minshu_d = split_civil_law(civil_data)
        with open(H18_DIR / "H18_司法_民法.json", "w", encoding="utf-8") as f:
            json.dump(civil_d, f, ensure_ascii=False, indent=2)
        with open(H18_DIR / "H18_司法_商法.json", "w", encoding="utf-8") as f:
            json.dump(commercial_d, f, ensure_ascii=False, indent=2)
        with open(H18_DIR / "H18_司法_民事訴訟法.json", "w", encoding="utf-8") as f:
            json.dump(minshu_d, f, ensure_ascii=False, indent=2)
        civil_path.unlink()
    
    # 3. 刑事系を分割
    criminal_path = H18_DIR / "H18_司法_刑事系.json"
    if criminal_path.exists():
        with open(criminal_path, "r", encoding="utf-8") as f:
            criminal_data = json.load(f)
        kei_d, keiji_d = split_criminal_law(criminal_data)
        with open(H18_DIR / "H18_司法_刑法.json", "w", encoding="utf-8") as f:
            json.dump(kei_d, f, ensure_ascii=False, indent=2)
        with open(H18_DIR / "H18_司法_刑事訴訟法.json", "w", encoding="utf-8") as f:
            json.dump(keiji_d, f, ensure_ascii=False, indent=2)
        criminal_path.unlink()
    
    # 4. 残りのH18ファイルのtext/purposeをクリーニング
    for f in H18_DIR.glob("*.json"):
        process_file(f)
    
    print("H18の修正が完了しました。")


if __name__ == "__main__":
    main()
