#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
H24司法試験JSONに採点実感PDFから抽出したscoring_notesを追加するスクリプト

採点実感.pdfの構造:
- 平成２４年司法試験の採点実感等に関する意見（公法系科目第１問）→ 憲法
- 平成２４年司法試験の採点実感等に関する意見（公法系科目第２問）→ 行政法
- 民事系科目第１問 → 民法
- 民事系科目第２問 → 商法
- 民事系科目第３問 → 民事訴訟法
- 刑事系科目第１問 → 刑法
- 刑事系科目第２問 → 刑事訴訟法
- 選択科目: 倒産法, 労働法, 租税法, 経済法, 知的財産法, 環境法, 国際関係法（公法系）, 国際関係法（私法系）
"""

import json
import re
from pathlib import Path

import pdfplumber

BASE_DIR = Path(__file__).parent.parent
PDF_PATH = BASE_DIR / "data" / "pdfs" / "judicial_exam" / "H24" / "論述" / "採点実感.pdf"
H24_DIR = BASE_DIR / "data" / "json" / "judicial_exam" / "H24"

# PDF見出し → JSONのsubject_name（複数科目に紐づく場合あり）
HEADER_TO_SUBJECTS = {
    "公法系科目第１問": ["憲法"],
    "公法系科目第２問": ["行政法"],
    "民事系科目第１問": ["民法"],
    "民事系科目第２問": ["商法"],
    "民事系科目第３問": ["民事訴訟法"],
    "刑事系科目第１問": ["刑法"],
    "刑事系科目第２問": ["刑事訴訟法"],
    "憲法": ["憲法"],
    "行政法": ["行政法"],
    "民法": ["民法"],
    "商法": ["商法"],
    "民事訴訟法": ["民事訴訟法"],
    "刑法": ["刑法"],
    "刑事訴訟法": ["刑事訴訟法"],
    "倒産法": ["倒産法"],
    "労働法": ["労働法"],
    "租税法": ["租税法"],
    "経済法": ["経済法"],
    "知的財産法": ["知的財産法"],
    "環境法": ["環境法"],
    "国際関係法（公法系）": ["国際関係法_公法系_"],
    "国際関係法（私法系）": ["国際関係法_私法系_"],
}


def remove_unnecessary_linebreaks(text: str) -> str:
    """PDF由来の不要な改行を除去"""
    if not text:
        return text

    lines = text.split("\n")
    result_lines = []

    for i, line in enumerate(lines):
        line = line.strip()

        if not line:
            result_lines.append("")
            continue

        if result_lines and result_lines[-1]:
            prev_line = result_lines[-1]
            if prev_line.endswith(("。", "，", "、", "」", "）", "】", "』", "：", "；")):
                result_lines.append(line)
            elif re.match(
                r"^[「（【『（[0-9０-９]⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽①②③④⑤⑥⑦⑧⑨⑩]",
                line,
            ):
                result_lines.append(line)
            else:
                result_lines[-1] = prev_line + line
        else:
            result_lines.append(line)

    result = "\n".join(result_lines)
    result = re.sub(r"\n-\s*\d+\s*-\s*\n", "\n", result)
    result = re.sub(r"\n{3,}", "\n\n", result)
    return result


def clean_scoring_notes(text: str) -> str:
    """採点実感テキストの追加クリーニング"""
    if not text:
        return text
    result = remove_unnecessary_linebreaks(text)
    replacements = [
        (r"([０-９0-9]+)\n年", r"\1年"),
        (r"([０-９0-9]+)\n％", r"\1％"),
        (r"([０-９0-9]+)\n円", r"\1円"),
        (r"([兆億万])\n([０-９0-9])", r"\1\2"),
    ]
    for pattern, repl in replacements:
        result = re.sub(pattern, repl, result)
    return result.strip()


def extract_scoring_notes_from_pdf(pdf_path: Path) -> dict[str, str]:
    """採点実感PDFから各科目の採点実感を抽出"""
    notes_by_subject: dict[str, str] = {}

    if not pdf_path.exists():
        print(f"エラー: PDFが存在しません: {pdf_path}")
        return notes_by_subject

    try:
        with pdfplumber.open(pdf_path) as pdf:
            full_text = ""
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    full_text += page_text + "\n"
    except Exception as e:
        print(f"エラー: PDF読み込み失敗: {e}")
        return notes_by_subject

    # 見出しパターン: 平成２４年司法試験の採点実感等に関する意見（XXX）
    # 全角・半角数字に対応（24, ２４等）
    pattern = re.compile(
        r"平成[２４24]+年司法試験の採点実感等に関する意見\s*[（(]\s*([^）)\n]+)[）)]",
        re.MULTILINE,
    )
    matches = list(pattern.finditer(full_text))

    if not matches:
        alt_pattern = re.compile(r"採点実感等に関する意見\s*[（(]\s*([^）)\n]+)[）)]", re.MULTILINE)
        matches = list(alt_pattern.finditer(full_text))

    if not matches:
        print("警告: 採点実感の見出しが見つかりません")
        return notes_by_subject

    for i, match in enumerate(matches):
        header = match.group(1).strip()
        header = header.replace("　", " ")

        if i + 1 < len(matches):
            section_text = full_text[match.start() : matches[i + 1].start()]
        else:
            section_text = full_text[match.start() :]

        lines = section_text.split("\n")
        if lines and "採点実感等に関する意見" in lines[0]:
            section_text = "\n".join(lines[1:]).strip()
        else:
            section_text = section_text[match.end() :].strip()

        cleaned = clean_scoring_notes(section_text)

        subjects = HEADER_TO_SUBJECTS.get(header)
        if subjects:
            for subj in subjects:
                notes_by_subject[subj] = cleaned
        notes_by_subject[header] = cleaned

    return notes_by_subject


def add_scoring_notes_to_json(h24_dir: Path, notes_by_subject: dict[str, str]) -> None:
    """各JSONにscoring_notesを追加"""
    subject_aliases = {
        "国際関係法_公法系_": ["国際関係法（公法系）"],
        "国際関係法_私法系_": ["国際関係法（私法系）"],
    }

    for json_path in sorted(h24_dir.glob("H24_司法_*.json")):
        stem = json_path.stem
        subject_name = stem.replace("H24_司法_", "")

        notes = notes_by_subject.get(subject_name)
        if not notes and subject_name in subject_aliases:
            for alias in subject_aliases[subject_name]:
                notes = notes_by_subject.get(alias)
                if notes:
                    break
        if not notes:
            continue

        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        data["scoring_notes"] = notes

        ordered = {
            "year": data["year"],
            "exam_type": data["exam_type"],
            "subject_name": data["subject_name"],
            "text": data["text"],
            "source_pdf": data["source_pdf"],
        }
        if "subject" in data:
            ordered["subject"] = data["subject"]
        if "purpose" in data:
            ordered["purpose"] = data["purpose"]
        ordered["scoring_notes"] = data["scoring_notes"]

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(ordered, f, ensure_ascii=False, indent=2)

        print(f"  {json_path.name}")


def main():
    print("H24 採点実感 追加スクリプト")
    print(f"PDF: {PDF_PATH}")

    notes_by_subject = extract_scoring_notes_from_pdf(PDF_PATH)
    if not notes_by_subject:
        print("採点実感を抽出できませんでした。")
        return

    print(f"抽出: {len(notes_by_subject)}科目")
    add_scoring_notes_to_json(H24_DIR, notes_by_subject)
    print("完了しました。")


if __name__ == "__main__":
    main()
