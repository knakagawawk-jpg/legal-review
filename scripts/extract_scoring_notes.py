# -*- coding: utf-8 -*-
"""Extract text from 採点実感 PDFs and fill JSON scoring_notes where possible."""
import json
import re
import os
from pathlib import Path
from pypdf import PdfReader

BASE = Path(__file__).resolve().parent.parent
PDFS_BASE = BASE / "data" / "pdfs" / "judicial_exam"
JSON_BASE = BASE / "data" / "json" / "judicial_exam"

# Subject name in JSON -> possible section headers in PDF (for splitting single-file 採点実感.pdf)
SUBJECT_HEADERS = {
    "憲法": ["憲法", "〔憲法〕", "第.*憲法"],
    "行政法": ["行政法", "〔行政法〕", "第.*行政法"],
    "民法": ["民法", "〔民法〕", "第.*民法"],
    "商法": ["商法", "〔商法〕", "第.*商法"],
    "民事訴訟法": ["民事訴訟法", "〔民事訴訟法〕"],
    "刑法": ["刑法", "〔刑法〕", "第.*刑法"],
    "刑事訴訟法": ["刑事訴訟法", "〔刑事訴訟法〕"],
    "倒産法": ["倒産法", "〔倒産法〕"],
    "知的財産法": ["知的財産法", "〔知的財産法〕"],
    "経済法": ["経済法", "〔経済法〕"],
    "労働法": ["労働法", "〔労働法〕"],
    "環境法": ["環境法", "〔環境法〕"],
    "租税法": ["租税法", "〔租税法〕"],
    "国際関係法（公法系）": ["国際関係法.*公法", "国際関係法（公法系）", "公法系.*国際"],
    "国際関係法（私法系）": ["国際関係法.*私法", "国際関係法（私法系）", "私法系.*国際"],
}

def extract_pdf_text(pdf_path):
    """Extract full text from a PDF file."""
    if not pdf_path.exists():
        return None
    try:
        reader = PdfReader(str(pdf_path))
        parts = []
        for page in reader.pages:
            t = page.extract_text()
            if t:
                parts.append(t)
        return "\n".join(parts) if parts else None
    except Exception as e:
        print(f"  Error reading {pdf_path}: {e}")
        return None

def fill_from_single_pdf(year, pdf_path, json_subdir, subject_file_map):
    """
    year: e.g. H20
    pdf_path: path to 採点実感.pdf (one file with all subjects)
    subject_file_map: list of (subject_key, json_filename) to fill.
    subject_key is used to find section in PDF (e.g. "国際関係法（公法系）").
    """
    text = extract_pdf_text(pdf_path)
    if not text or not text.strip():
        return []
    filled = []
    # If we have only one or two subjects to fill, try to find section by header
    for subject_key, json_name in subject_file_map:
        json_path = JSON_BASE / year / json_name
        if not json_path.exists():
            continue
        # Try to extract section for this subject
        section_text = extract_section_by_header(text, subject_key)
        if section_text:
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                data["scoring_notes"] = section_text.strip()
                with open(json_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                filled.append(str(json_path.relative_to(JSON_BASE)))
            except Exception as e:
                print(f"  Write error {json_path}: {e}")
        else:
            # No clear section: assign full text to first missing subject only (conservative)
            if not filled and subject_file_map.index((subject_key, json_name)) == 0:
                try:
                    with open(json_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    data["scoring_notes"] = text.strip()
                    with open(json_path, "w", encoding="utf-8") as f:
                        json.dump(data, f, ensure_ascii=False, indent=2)
                    filled.append(str(json_path.relative_to(JSON_BASE)))
                except Exception as e:
                    print(f"  Write error {json_path}: {e}")
    return filled

def extract_section_by_header(full_text, subject_key):
    """Try to extract a section for subject_key from full_text using SUBJECT_HEADERS."""
    patterns = SUBJECT_HEADERS.get(subject_key, [subject_key])
    for pat in patterns:
        # Match line that looks like section header (often at start of line)
        regex = re.compile(r"^(?:" + pat + r")[^\n]*\n", re.MULTILINE)
        m = regex.search(full_text)
        if m:
            start = m.end()
            # Find next section (next similar header or end)
            next_m = None
            for other_key, other_pats in SUBJECT_HEADERS.items():
                if other_key == subject_key:
                    continue
                for p in other_pats:
                    r2 = re.compile(r"\n(?:" + p + r")[^\n]*\n", re.MULTILINE)
                    n = r2.search(full_text, start)
                    if n and (next_m is None or n.start() < next_m.start()):
                        next_m = n
            end = next_m.start() if next_m else len(full_text)
            return full_text[start:end].strip()
    return None

def fill_from_separate_pdfs(year, pdf_dir, mapping):
    """
    pdf_dir has 公法系.pdf, 刑事系.pdf, 民事系.pdf, 選択.pdf.
    mapping: list of (pdf_basename, list of (subject_key, json_filename)).
    """
    filled = []
    for pdf_name, subject_list in mapping:
        pdf_path = pdf_dir / pdf_name
        text = extract_pdf_text(pdf_path)
        if not text or not text.strip():
            continue
        for subject_key, json_name in subject_list:
            json_path = JSON_BASE / year / json_name
            if not json_path.exists():
                continue
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                continue
            if data.get("scoring_notes"):
                continue  # already filled
            # For 公法系 we have 憲法 and 行政法 - split or use full?
            # For 民事系 we have 民法 (and 民事訴訟法). For 選択 we have many.
            section = extract_section_by_header(text, subject_key)
            content = section if section else text.strip()
            data["scoring_notes"] = content
            try:
                with open(json_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                filled.append(str(json_path.relative_to(JSON_BASE)))
            except Exception as e:
                print(f"  Write error {json_path}: {e}")
    return filled

def main():
    filled_all = []
    not_filled = []

    # H18, H19: no 採点実感 PDF
    for y in ["H18", "H19"]:
        for f in (JSON_BASE / y).glob("*.json"):
            with open(f, "r", encoding="utf-8") as fp:
                d = json.load(fp)
            if not d.get("scoring_notes"):
                not_filled.append(str(f.relative_to(JSON_BASE)))

    # H20: 採点実感.pdf exists, only 2 JSON missing (国際関係法 公法系, 私法系)
    h20_pdf = PDFS_BASE / "H20" / "論述" / "採点実感.pdf"
    if h20_pdf.exists():
        r = fill_from_single_pdf("H20", h20_pdf, "H20", [
            ("国際関係法（公法系）", "H20_司法_国際関係法_公法系_.json"),
            ("国際関係法（私法系）", "H20_司法_国際関係法_私法系_.json"),
        ])
        filled_all.extend(r)
    for j in ["H20_司法_国際関係法_公法系_.json", "H20_司法_国際関係法_私法系_.json"]:
        p = JSON_BASE / "H20" / j
        if p.exists():
            with open(p, "r", encoding="utf-8") as fp:
                if not json.load(fp).get("scoring_notes"):
                    not_filled.append(f"H20/{j}")

    # H21: 採点実感.pdf, 11 subjects
    h21_pdf = PDFS_BASE / "H21" / "論述" / "採点実感.pdf"
    if h21_pdf.exists():
        # H21 uses 公法系, 刑事系, 民事系 (not 憲法/行政法 etc). So single PDF may have sections.
        subs = [
            ("H21_司法_倒産法.json", "倒産法"),
            ("H21_司法_公法系.json", "憲法"),  # or 公法系
            ("H21_司法_刑事系.json", "刑法"),
            ("H21_司法_労働法.json", "労働法"),
            ("H21_司法_国際関係法_公法系_.json", "国際関係法（公法系）"),
            ("H21_司法_国際関係法_私法系_.json", "国際関係法（私法系）"),
            ("H21_司法_民事系.json", "民法"),
            ("H21_司法_環境法.json", "環境法"),
            ("H21_司法_知的財産法.json", "知的財産法"),
            ("H21_司法_租税法.json", "租税法"),
            ("H21_司法_経済法.json", "経済法"),
        ]
        for jname, subkey in subs:
            r = fill_from_single_pdf("H21", h21_pdf, "H21", [(subkey, jname)])
            filled_all.extend(r)
    for j in (JSON_BASE / "H21").glob("*.json"):
        with open(j, "r", encoding="utf-8") as fp:
            if not json.load(fp).get("scoring_notes"):
                not_filled.append(str(j.relative_to(JSON_BASE)))

    # H22: same as H21
    h22_pdf = PDFS_BASE / "H22" / "論述" / "採点実感.pdf"
    if h22_pdf.exists():
        subs = [
            ("H22_司法_倒産法.json", "倒産法"),
            ("H22_司法_公法系.json", "憲法"),
            ("H22_司法_刑事系.json", "刑法"),
            ("H22_司法_労働法.json", "労働法"),
            ("H22_司法_国際関係法_公法系_.json", "国際関係法（公法系）"),
            ("H22_司法_国際関係法_私法系_.json", "国際関係法（私法系）"),
            ("H22_司法_民事系.json", "民法"),
            ("H22_司法_環境法.json", "環境法"),
            ("H22_司法_知的財産法.json", "知的財産法"),
            ("H22_司法_租税法.json", "租税法"),
            ("H22_司法_経済法.json", "経済法"),
        ]
        for jname, subkey in subs:
            r = fill_from_single_pdf("H22", h22_pdf, "H22", [(subkey, jname)])
            filled_all.extend(r)
    for j in (JSON_BASE / "H22").glob("*.json"):
        with open(j, "r", encoding="utf-8") as fp:
            if not json.load(fp).get("scoring_notes"):
                not_filled.append(str(j.relative_to(JSON_BASE)))

    # H23, H24, H25: only 国際関係法 2 files each
    for year in ["H23", "H24", "H25"]:
        pdf_path = PDFS_BASE / year / "論述" / "採点実感.pdf"
        if pdf_path.exists():
            r = fill_from_single_pdf(year, pdf_path, year, [
                ("国際関係法（公法系）", f"{year}_司法_国際関係法_公法系_.json"),
                ("国際関係法（私法系）", f"{year}_司法_国際関係法_私法系_.json"),
            ])
            filled_all.extend(r)
        for j in [f"{year}_司法_国際関係法_公法系_.json", f"{year}_司法_国際関係法_私法系_.json"]:
            p = JSON_BASE / year / j
            if p.exists():
                with open(p, "r", encoding="utf-8") as fp:
                    if not json.load(fp).get("scoring_notes"):
                        not_filled.append(f"{year}/{j}")

    # H27: only 行政法 missing -> 公法系.pdf
    h27_dir = PDFS_BASE / "H27" / "論述" / "採点実感"
    if h27_dir.exists():
        r = fill_from_separate_pdfs("H27", h27_dir, [
            ("公法系.pdf", [("行政法", "H27_司法_行政法.json")]),
        ])
        filled_all.extend(r)
    p27 = JSON_BASE / "H27" / "H27_司法_行政法.json"
    if p27.exists():
        with open(p27, "r", encoding="utf-8") as fp:
            if not json.load(fp).get("scoring_notes"):
                not_filled.append("H27/H27_司法_行政法.json")

    # H28: 憲法, 行政法 -> 公法系.pdf
    h28_dir = PDFS_BASE / "H28" / "論述" / "採点実感"
    if h28_dir.exists():
        r = fill_from_separate_pdfs("H28", h28_dir, [
            ("公法系.pdf", [
                ("憲法", "H28_司法_憲法.json"),
                ("行政法", "H28_司法_行政法.json"),
            ]),
        ])
        filled_all.extend(r)
    for j in ["H28_司法_憲法.json", "H28_司法_行政法.json"]:
        p = JSON_BASE / "H28" / j
        if p.exists():
            with open(p, "r", encoding="utf-8") as fp:
                if not json.load(fp).get("scoring_notes"):
                    not_filled.append(f"H28/{j}")

    # H30: 民法, 知的財産法, 商法 -> 民事系.pdf, 選択.pdf
    h30_dir = PDFS_BASE / "H30" / "論述" / "採点実感"
    if h30_dir.exists():
        r = fill_from_separate_pdfs("H30", h30_dir, [
            ("民事系.pdf", [("民法", "H30_司法_民法.json")]),
            ("選択.pdf", [
                ("知的財産法", "H30_司法_知的財産法.json"),
                ("商法", "H30_司法_商法.json"),
            ]),
        ])
        filled_all.extend(r)
    for j in ["H30_司法_民法.json", "H30_司法_知的財産法.json", "H30_司法_商法.json"]:
        p = JSON_BASE / "H30" / j
        if p.exists():
            with open(p, "r", encoding="utf-8") as fp:
                if not json.load(fp).get("scoring_notes"):
                    not_filled.append(f"H30/{j}")

    # Deduplicate not_filled
    not_filled = list(dict.fromkeys(not_filled))

    report_path = JSON_BASE / "fill_report.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("# 採点実感 埋め込み結果\n\n")
        f.write("## 埋められたファイル\n\n")
        for x in sorted(set(filled_all)):
            f.write(f"- {x}\n")
        f.write("\n## 埋められなかったファイル（PDFなし or 抽出・分割できず）\n\n")
        for x in sorted(not_filled):
            f.write(f"- {x}\n")
    print("Filled:", len(set(filled_all)))
    print("Not filled:", len(not_filled))
    print("Report:", report_path)

if __name__ == "__main__":
    main()
