#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
短答式PDFからJSONへの変換（科目ごとに分割）
問題文PDFと解答PDFを読み込んで、科目ごとにJSONファイルを生成
"""

import pdfplumber
import re
import json
from pathlib import Path
from typing import List, Dict, Optional
import sys

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

def extract_text_from_pdf(pdf_path: Path) -> str:
    """PDFからテキストを抽出"""
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text

def parse_answer_pdf(answer_text: str) -> Dict[int, Dict]:
    """解答PDFを解析して、問題番号ごとの正解情報を取得"""
    answers = {}
    
    lines = answer_text.split("\n")
    
    current_problem = None
    current_answers = []
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # ヘッダー行をスキップ
        if "問" in line and "No" in line and "解答" in line:
            continue
        
        # 数字のパターンを探す
        match = re.match(r'^(\d+)\s+(\d+)', line)
        if match:
            problem_num = int(match.group(1))
            answer_num = match.group(2)
            
            if current_problem is None:
                current_problem = problem_num
                current_answers = [answer_num]
            elif current_problem == problem_num:
                # 同じ問題の続き（複数の正解がある場合）
                current_answers.append(answer_num)
            else:
                # 前の問題を保存
                if current_problem is not None:
                    answers[current_problem] = {
                        "correct_answer": ",".join(sorted(current_answers, key=int)),
                        "correctness_pattern": None
                    }
                
                # 新しい問題を開始
                current_problem = problem_num
                current_answers = [answer_num]
    
    # 最後の問題を保存
    if current_problem is not None:
        answers[current_problem] = {
            "correct_answer": ",".join(sorted(current_answers, key=int)),
            "correctness_pattern": None
        }
    
    return answers

def parse_problem_text(text: str) -> List[Dict]:
    """問題文テキストを解析して問題リストを取得（科目情報も含む）"""
    problems = []
    
    # 問題番号のパターン
    problem_pattern = re.compile(r'〔第\s*(\d+)\s*問〕|問題\s*(\d+)|【問題\s*(\d+)】|第\s*(\d+)\s*問', re.IGNORECASE)
    
    # 科目マーカーのパターン
    subject_pattern = re.compile(r'［([^］]+)］|【([^】]+)】')
    
    lines = text.split("\n")
    
    current_problem_num = None
    current_question_text = ""
    current_choices = []
    current_subject = None
    in_problem = False
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        if not line:
            i += 1
            continue
        
        # 科目マーカーを探す
        subject_match = subject_pattern.search(line)
        if subject_match:
            current_subject = subject_match.group(1) or subject_match.group(2)
            # 科目名の正規化
            if "憲法" in current_subject:
                current_subject = "憲法"
            elif "行政法" in current_subject:
                current_subject = "行政法"
            elif "刑法" in current_subject and "刑事訴訟法" not in current_subject:
                current_subject = "刑法"
            elif "刑事訴訟法" in current_subject:
                current_subject = "刑事訴訟法"
            elif "民法" in current_subject and "民事訴訟法" not in current_subject and "商法" not in current_subject:
                current_subject = "民法"
            elif "商法" in current_subject:
                current_subject = "商法"
            elif "民事訴訟法" in current_subject:
                current_subject = "民事訴訟法"
        
        # 問題番号を探す
        match = problem_pattern.search(line)
        if match:
            # 前の問題を保存
            if current_problem_num is not None and current_question_text:
                if current_choices:
                    problems.append({
                        "question_number": current_problem_num,
                        "question_text": current_question_text.strip(),
                        "choices": current_choices,
                        "subject": current_subject
                    })
            
            # 新しい問題を開始
            current_problem_num = int(match.group(1) or match.group(2) or match.group(3) or match.group(4))
            current_question_text = ""
            current_choices = []
            in_problem = True
            
            # 問題番号の行の後のテキストを取得
            remaining = line[match.end():].strip()
            if remaining:
                current_question_text += remaining + "\n"
        
        elif in_problem:
            # 選択肢のパターンを探す
            choice_pattern = re.compile(r'^([1-4]|[ア-エ]|[A-D])[\.．、]\s*(.+)$')
            choice_match = choice_pattern.match(line)
            
            if choice_match:
                choice_label = choice_match.group(1)
                choice_text = choice_match.group(2).strip()
                
                # ア->1, イ->2, ウ->3, エ->4, A->1, B->2, C->3, D->4 に変換
                choice_num = None
                if choice_label == "ア" or choice_label == "A":
                    choice_num = "1"
                elif choice_label == "イ" or choice_label == "B":
                    choice_num = "2"
                elif choice_label == "ウ" or choice_label == "C":
                    choice_num = "3"
                elif choice_label == "エ" or choice_label == "D":
                    choice_num = "4"
                elif choice_label in ["1", "2", "3", "4"]:
                    choice_num = choice_label
                
                if choice_num:
                    current_choices.append({
                        "number": choice_num,
                        "text": choice_text
                    })
            else:
                # 問題文の一部として扱う
                # 次の問題番号が見つかったら終了
                next_problem_match = problem_pattern.search(line)
                if next_problem_match:
                    # 次の問題が見つかったので、現在の問題を保存
                    if current_problem_num is not None:
                        problems.append({
                            "question_number": current_problem_num,
                            "question_text": current_question_text.strip(),
                            "choices": current_choices,
                            "subject": current_subject
                        })
                    
                    # 新しい問題を開始
                    current_problem_num = int(next_problem_match.group(1) or next_problem_match.group(2) or next_problem_match.group(3) or next_problem_match.group(4))
                    current_question_text = ""
                    current_choices = []
                    remaining = line[next_problem_match.end():].strip()
                    if remaining:
                        current_question_text += remaining + "\n"
                else:
                    current_question_text += line + "\n"
        
        i += 1
    
    # 最後の問題を保存
    if current_problem_num is not None and current_question_text:
        problems.append({
            "question_number": current_problem_num,
            "question_text": current_question_text.strip(),
            "choices": current_choices,
            "subject": current_subject
        })
    
    return problems

def create_correctness_pattern(choices: List[Dict], correct_answer: str) -> str:
    """正誤パターンを作成（"〇☓☓☓"など）"""
    correct_set = set(correct_answer.split(","))
    pattern = ""
    
    sorted_choices = sorted(choices, key=lambda x: int(x["number"]))
    
    for choice in sorted_choices:
        if choice["number"] in correct_set:
            pattern += "〇"
        else:
            pattern += "☓"
    
    while len(pattern) < 4:
        pattern += "☓"
    
    return pattern[:4]

def process_short_answer_pdf(problem_pdf_path: Path, answer_pdf_path: Path, 
                              output_json_dir: Path, exam_type: str, year: str):
    """短答式PDFを処理して科目ごとにJSONファイルを生成"""
    
    print(f"問題文PDFを読み込み中: {problem_pdf_path.name}")
    problem_text = extract_text_from_pdf(problem_pdf_path)
    
    print(f"解答PDFを読み込み中: {answer_pdf_path.name}")
    answer_text = extract_text_from_pdf(answer_pdf_path)
    
    print(f"問題文を解析中...")
    problems = parse_problem_text(problem_text)
    print(f"  解析された問題数: {len(problems)}")
    
    print(f"解答を解析中...")
    answers = parse_answer_pdf(answer_text)
    print(f"  解析された解答数: {len(answers)}")
    
    # 科目ごとに問題を分類
    subject_problems: Dict[str, List[Dict]] = {}
    
    for problem in problems:
        problem_num = problem["question_number"]
        answer_info = answers.get(problem_num)
        
        if not answer_info:
            print(f"  警告: 問題{problem_num}の解答が見つかりませんでした")
            continue
        
        choices_sorted = sorted(problem["choices"], key=lambda x: int(x["number"]))
        
        if not choices_sorted:
            print(f"  警告: 問題{problem_num}の選択肢が見つかりませんでした")
            continue
        
        correctness_pattern = create_correctness_pattern(choices_sorted, answer_info["correct_answer"])
        
        problem_data = {
            "question_number": problem_num,
            "question_text": problem["question_text"],
            "choice_1": choices_sorted[0]["text"] if len(choices_sorted) > 0 else "",
            "choice_2": choices_sorted[1]["text"] if len(choices_sorted) > 1 else "",
            "choice_3": choices_sorted[2]["text"] if len(choices_sorted) > 2 else "",
            "choice_4": choices_sorted[3]["text"] if len(choices_sorted) > 3 else None,
            "correct_answer": answer_info["correct_answer"],
            "correctness_pattern": correctness_pattern
        }
        
        # 科目で分類
        subject = problem.get("subject", "不明")
        if subject not in subject_problems:
            subject_problems[subject] = []
        subject_problems[subject].append(problem_data)
    
    # 各科目ごとにJSONファイルを作成
    output_json_dir.mkdir(parents=True, exist_ok=True)
    
    for subject, subject_problems_list in subject_problems.items():
        # 問題番号を1から振り直す
        for idx, problem in enumerate(subject_problems_list, 1):
            problem["question_number"] = idx
        
        output_data = {
            "year": year,
            "exam_type": exam_type,
            "subject": subject,
            "source_pdf": str(problem_pdf_path.relative_to(Path.cwd())),
            "problems": subject_problems_list
        }
        
        output_json_path = output_json_dir / f"R7_予備_短答_{subject}.json"
        with open(output_json_path, "w", encoding="utf-8") as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        
        print(f"  → {subject}: {len(subject_problems_list)}問 → {output_json_path.name}")

if __name__ == "__main__":
    BASE_DIR = Path(__file__).parent
    PDF_DIR = BASE_DIR / "問題文元pdf" / "予備試験" / "R7"
    JSON_DIR = BASE_DIR / "json_data" / "予備試験" / "R7"
    
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
    
    print()
    
    # 各複合科目のPDFを処理
    subjects = [
        ("R7_予備_短答_憲法・行政法.pdf", "R7_予備_短答_解答(憲法・行政法).pdf"),
        ("R7_予備_短答_刑法・刑事訴訟法.pdf", "R7_予備_短答_解答(刑法・刑事訴訟法).pdf"),
        ("R7_予備_短答_民法・商法・民事訴訟法.pdf", "R7_予備_短答_解答(民法・商法・民事訴訟法).pdf"),
        ("R7_予備_短答_一般教養科目.pdf", "R7_予備_短答_解答(一般教養科目).pdf"),
    ]
    
    for problem_pdf_name, answer_pdf_name in subjects:
        problem_pdf = PDF_DIR / problem_pdf_name
        answer_pdf = PDF_DIR / answer_pdf_name
        
        if not problem_pdf.exists():
            print(f"エラー: 問題文PDFが見つかりません: {problem_pdf}")
            continue
        if not answer_pdf.exists():
            print(f"エラー: 解答PDFが見つかりません: {answer_pdf}")
            continue
        
        print(f"\n{'='*60}")
        print(f"処理中: {problem_pdf_name}")
        print('='*60)
        
        process_short_answer_pdf(
            problem_pdf, answer_pdf, JSON_DIR,
            "予備", "R7"
        )
