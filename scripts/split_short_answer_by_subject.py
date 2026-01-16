#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
短答式問題のJSONファイルを科目ごとに分割
"""

import json
import sys
import re
from pathlib import Path
from typing import Dict, List

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = Path(__file__).parent
JSON_DIR = BASE_DIR / "json_data" / "予備試験" / "R7"

# 科目マッピング（複合科目名 -> 個別科目名）
SUBJECT_MAPPING = {
    "憲法・行政法": ["憲法", "行政法"],
    "刑法・刑事訴訟法": ["刑法", "刑事訴訟法"],
    "民法・商法・民事訴訟法": ["民法", "商法", "民事訴訟法"],
    "一般教養科目": ["一般教養科目"],
}

def detect_subject_from_problem(problem_text: str, question_number: int) -> str:
    """問題文から科目を判定"""
    # 問題文に「［憲法］」「［行政法］」などのマーカーがあるか確認
    subject_markers = {
        "憲法": r"［憲法］|【憲法】",
        "行政法": r"［行政法］|【行政法】",
        "刑法": r"［刑法］|【刑法】",
        "刑事訴訟法": r"［刑事訴訟法］|【刑事訴訟法】",
        "民法": r"［民法］|【民法】",
        "商法": r"［商法］|【商法】",
        "民事訴訟法": r"［民事訴訟法］|【民事訴訟法】",
    }
    
    for subject, pattern in subject_markers.items():
        if re.search(pattern, problem_text):
            return subject
    
    # マーカーが見つからない場合は、問題番号から推測
    # これは暫定的な方法で、実際のPDF構造に合わせて調整が必要
    return None

def split_json_by_subject(input_json_path: Path, output_dir: Path):
    """JSONファイルを科目ごとに分割"""
    print(f"処理中: {input_json_path.name}")
    
    with open(input_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    original_subject = data["subject"]
    problems = data["problems"]
    source_pdf = data.get("source_pdf", "")
    
    # 科目ごとに問題を分類
    subject_problems: Dict[str, List] = {}
    
    for problem in problems:
        problem_text = problem.get("question_text", "")
        question_number = problem.get("question_number", 0)
        
        # 問題文から科目を判定
        detected_subject = detect_subject_from_problem(problem_text, question_number)
        
        if detected_subject:
            if detected_subject not in subject_problems:
                subject_problems[detected_subject] = []
            subject_problems[detected_subject].append(problem)
        else:
            # 科目が判定できない場合は、元の科目名を使用
            if original_subject not in subject_problems:
                subject_problems[original_subject] = []
            subject_problems[original_subject].append(problem)
    
    # 各科目ごとにJSONファイルを作成
    for subject, subject_problems_list in subject_problems.items():
        # 問題番号を1から振り直す
        for idx, problem in enumerate(subject_problems_list, 1):
            problem["question_number"] = idx
        
        output_data = {
            "year": data["year"],
            "exam_type": data["exam_type"],
            "subject": subject,
            "source_pdf": source_pdf,
            "problems": subject_problems_list
        }
        
        output_json_path = output_dir / f"R7_予備_短答_{subject}.json"
        with open(output_json_path, "w", encoding="utf-8") as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        
        print(f"  → {subject}: {len(subject_problems_list)}問")

def main():
    # 古いファイルを削除
    old_files = [
        "R7_予備_短答_憲法・行政法.json",
        "R7_予備_短答_刑法・刑事訴訟法.json",
        "R7_予備_短答_民法・商法・民事訴訟法.json",
    ]
    
    print("古いファイルを削除中...")
    for old_file in old_files:
        old_path = JSON_DIR / old_file
        if old_path.exists():
            old_path.unlink()
            print(f"  削除: {old_file}")
    
    # 各複合科目のJSONファイルを処理
    # ただし、実際にはPDFから直接科目ごとに分割する必要がある
    # ここでは、既存のJSONファイルがある場合にのみ処理
    
    # PDFから直接科目ごとに分割する処理を実行
    # これは create_short_answer_json.py を修正して科目ごとに分割する必要がある
    print("\n注意: PDFから直接科目ごとに分割する必要があります。")
    print("create_short_answer_json.py を修正して、科目ごとに分割する機能を追加してください。")

if __name__ == "__main__":
    main()
