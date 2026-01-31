#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
司法試験JSONに採点実感を追加するスクリプト（H26～R7対応）

H26: 採点実感.pdf（単一ファイル）
H27-R7: 採点実感/公法系.pdf, 民事系.pdf, 刑事系.pdf, 選択.pdf（科目別フォルダ）

使用例: python add_judicial_scoring_notes.py H26 H27 ...
引数なしの場合は H26～R7 を処理
"""

import json
import re
import sys
from pathlib import Path

import pdfplumber

BASE_DIR = Path(__file__).parent.parent
PDF_BASE = BASE_DIR / "data" / "pdfs" / "judicial_exam"
JSON_BASE = BASE_DIR / "data" / "json" / "judicial_exam"
DEFAULT_YEARS = ["H26", "H27", "H28", "H29", "H30", "R1", "R2", "R3", "R4", "R5", "R6", "R7"]

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
    # 括弧のネストで正規表現が最初の）で切れた場合の表記
    "国際関係法（公法系": ["国際関係法_公法系_"],
    "国際関係法（私法系": ["国際関係法_私法系_"],
}


def remove_unnecessary_linebreaks(text: str) -> str:
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
            prev = result_lines[-1]
            if prev.endswith(("。", "，", "、", "」", "）", "】", "』", "：", "；")):
                result_lines.append(line)
            elif re.match(r"^[「（【『（[0-9０-９]⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽①②③④⑤⑥⑦⑧⑨⑩]", line):
                result_lines.append(line)
            else:
                result_lines[-1] = prev + line
        else:
            result_lines.append(line)
    result = "\n".join(result_lines)
    result = re.sub(r"\n-\s*\d+\s*-\s*\n", "\n", result)
    result = re.sub(r"\n{3,}", "\n\n", result)
    return result


def clean_scoring_notes(text: str) -> str:
    if not text:
        return text
    result = remove_unnecessary_linebreaks(text)
    for pattern, repl in [(r"([０-９0-9]+)\n年", r"\1年"), (r"([０-９0-9]+)\n％", r"\1％"), (r"([０-９0-9]+)\n円", r"\1円"), (r"([兆億万])\n([０-９0-9])", r"\1\2")]:
        result = re.sub(pattern, repl, result)
    return result.strip()


def extract_from_single_pdf(pdf_path: Path, year: str) -> dict[str, str]:
    """単一PDF（H26形式）から抽出"""
    notes: dict[str, str] = {}
    if not pdf_path.exists():
        return notes
    try:
        with pdfplumber.open(pdf_path) as pdf:
            full_text = "".join((p.extract_text() or "") + "\n" for p in pdf.pages)
    except Exception as e:
        print(f"    エラー: {e}")
        return notes

    # 平成26年 or 令和X年 など
    era_pattern = r"(?:平成[０-９0-9一二三四五六七八九十百]+年|令和[０-９0-9一二三四五六七八九十百]+年)?\s*司法試験の採点実感等に関する意見\s*[（(]\s*([^）)\n]+)[）)]"
    pattern = re.compile(era_pattern, re.MULTILINE)
    matches = list(pattern.finditer(full_text))
    if not matches:
        alt = re.compile(r"採点実感等に関する意見\s*[（(]\s*([^）)\n]+)[）)]", re.MULTILINE)
        matches = list(alt.finditer(full_text))

    for i, m in enumerate(matches):
        header = m.group(1).strip().replace("　", " ")
        text = full_text[m.start() : (matches[i + 1].start() if i + 1 < len(matches) else None)]
        if "採点実感等に関する意見" in (text.split("\n")[0] if text else ""):
            text = "\n".join(text.split("\n")[1:]).strip()
        else:
            text = text[m.end() :].strip()
        cleaned = clean_scoring_notes(text)
        for subj in HEADER_TO_SUBJECTS.get(header, [header]):
            notes[subj] = cleaned
        notes[header] = cleaned
    return notes


def extract_from_folder(pdf_dir: Path, year: str) -> dict[str, str]:
    """採点実感/ フォルダ（H27+形式）から抽出

    各PDF内の構造:
    - 公法系.pdf: 公法系科目第１問(憲法)、公法系科目第２問(行政法)
    - 刑事系.pdf: 刑事系科目第１問(刑法)、刑事系科目第２問(刑事訴訟法)
    - 民事系.pdf: 民事系科目第１問(民法)、第２問(商法)、第３問(民事訴訟法)
    - 選択.pdf: ［倒産法］、［労働法］等

    見出し形式: 平成30年は「採点実感（XXX）」、H27等は「採点実感等に関する意見（XXX）」
    """
    notes: dict[str, str] = {}
    era_opt = r"(?:平成[０-９0-9一二三四五六七八九十百]+年|令和[０-９0-9一二三四五六七八九十百]+年)?\s*"
    patterns = [
        re.compile(era_opt + r"司法試験の採点実感等に関する意見\s*[（(]\s*([^）)\n]+)[）)]", re.MULTILINE),
        re.compile(era_opt + r"司法試験の採点実感\s*[（(]\s*([^）)\n]+)[）)]", re.MULTILINE),
        re.compile(r"採点実感等に関する意見\s*[（(]\s*([^）)\n]+)[）)]", re.MULTILINE),
        re.compile(r"採点実感\s*[（(]\s*([^）)\n]+)[）)]", re.MULTILINE),
    ]
    bracket_pat = re.compile(r"［([^］]+)］", re.MULTILINE)

    # 科目別の固定マーカー（パターンが一致しない場合のフォールバック）
    category_splits = {
        "公法系.pdf": [("公法系科目第１問", "憲法"), ("公法系科目第２問", "行政法")],
        "刑事系.pdf": [("刑事系科目第１問", "刑法"), ("刑事系科目第２問", "刑事訴訟法")],
        "民事系.pdf": [
            ("民事系科目第１問", "民法"),
            ("民事系科目第２問", "商法"),
            ("民事系科目第３問", "民事訴訟法"),
        ],
    }

    for filename in ["公法系.pdf", "民事系.pdf", "刑事系.pdf", "選択.pdf"]:
        p = pdf_dir / filename
        if not p.exists():
            continue
        try:
            with pdfplumber.open(p) as pdf:
                full_text = "".join((page.extract_text() or "") + "\n" for page in pdf.pages)
        except Exception as e:
            print(f"    {filename}: エラー {e}")
            continue

        matches = []
        for pat in patterns:
            matches = list(pat.finditer(full_text))
            if matches:
                break
        if not matches and "選択" in filename:
            matches = list(bracket_pat.finditer(full_text))
        if not matches and filename in category_splits:
            _extract_by_markers(notes, full_text, category_splits[filename])
            continue

        for i, m in enumerate(matches):
            header = (m.group(1) or "").strip().replace("　", " ")
            if not header or header in ("公法系", "民事系", "刑事系", "選択科目"):
                continue
            end = matches[i + 1].start() if i + 1 < len(matches) else len(full_text)
            text = full_text[m.start() : end]
            for sep in ["採点実感等に関する意見", "採点実感"]:
                if sep in (text.split("\n")[0] if text else ""):
                    text = "\n".join(text.split("\n")[1:]).strip()
                    break
            else:
                text = text[m.end() :].strip()
            cleaned = clean_scoring_notes(text)
            for subj in HEADER_TO_SUBJECTS.get(header, [header]):
                notes[subj] = cleaned
            notes[header] = cleaned
    return notes


def _extract_by_markers(notes: dict, full_text: str, markers: list[tuple[str, str]]) -> None:
    """固定マーカーで分割して科目に振り分け"""
    for i, (marker, subject) in enumerate(markers):
        start = full_text.find(marker)
        if start < 0:
            continue
        start = full_text.find("\n", start) + 1 if "\n" in full_text[start:] else start + len(marker)
        end = len(full_text)
        if i + 1 < len(markers):
            next_start = full_text.find(markers[i + 1][0])
            if next_start > start:
                end = next_start
        text = full_text[start:end].strip()
        text = re.sub(r"^[１２３]\s+", "", text, count=1)
        notes[subject] = clean_scoring_notes(text)


def add_notes_to_jsons(year_dir: Path, year: str, notes: dict[str, str]) -> int:
    prefix = f"{year}_司法_"
    count = 0
    subject_aliases = {"国際関係法_公法系_": ["国際関係法（公法系）"], "国際関係法_私法系_": ["国際関係法（私法系）"]}

    for jp in sorted(year_dir.glob(f"{prefix}*.json")):
        subject_name = jp.stem.replace(prefix, "")
        n = notes.get(subject_name)
        if not n and subject_name in subject_aliases:
            for a in subject_aliases[subject_name]:
                n = notes.get(a)
                if n:
                    break
        if not n:
            continue
        with open(jp, "r", encoding="utf-8") as f:
            data = json.load(f)
        data["scoring_notes"] = n
        ordered = {"year": data["year"], "exam_type": data["exam_type"], "subject_name": data["subject_name"]}
        if "subject" in data:
            ordered["subject"] = data["subject"]
        ordered["text"] = data["text"]
        ordered["source_pdf"] = data["source_pdf"]
        if "purpose" in data:
            ordered["purpose"] = data["purpose"]
        ordered["scoring_notes"] = data["scoring_notes"]
        with open(jp, "w", encoding="utf-8") as f:
            json.dump(ordered, f, ensure_ascii=False, indent=2)
        count += 1
    return count


def process_year(year: str) -> None:
    year_dir = JSON_BASE / year
    pdf_dir = PDF_BASE / year / "論述"
    if not year_dir.exists():
        print(f"  {year}: JSONディレクトリなし")
        return

    single_pdf = pdf_dir / "採点実感.pdf"
    folder_pdf = pdf_dir / "採点実感"

    if single_pdf.exists():
        notes = extract_from_single_pdf(single_pdf, year)
    elif folder_pdf.exists():
        notes = extract_from_folder(folder_pdf, year)
    else:
        print(f"  {year}: 採点実感PDFなし")
        return

    if not notes:
        print(f"  {year}: 抽出0件")
        return
    c = add_notes_to_jsons(year_dir, year, notes)
    print(f"  {year}: {c}件にscoring_notes追加")


def main():
    years = sys.argv[1:] if len(sys.argv) > 1 else DEFAULT_YEARS
    print("add_judicial_scoring_notes:", ", ".join(years))
    for year in years:
        process_year(year)


if __name__ == "__main__":
    main()
