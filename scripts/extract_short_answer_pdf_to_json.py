#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
短答式PDFからJSONへの変換スクリプト
問題文PDFと解答PDFを読み込んで、JSONファイルを生成
"""

import pdfplumber
import re
import json
from pathlib import Path
from typing import List, Dict, Optional

def extract_text_from_pdf(pdf_path: Path) -> str:
    """PDFからテキストを抽出"""
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text

def parse_answer_pdf(answer_pdf_path: Path) -> Dict[int, Dict]:
    """解答PDFを解析して、問題番号ごとの正解情報を取得"""
    answers = {}
    text = extract_text_from_pdf(answer_pdf_path)
    
    # 問題番号と正解のパターンを探す
    # 例: "1 1 25 2" -> 問題1の正解は1, 配点25, 問題2の正解は2
    lines = text.split("\n")
    
    current_problem_num = None
    for line in lines:
        # 数字のパターンを探す
        numbers = re.findall(r'\d+', line)
        if len(numbers) >= 2:
            # 最初の数字が問題番号、次の数字が正解の可能性
            try:
                problem_num = int(numbers[0])
                correct_answer = numbers[1]
                
                # 正解が複数の場合（例: "1,2"）を処理
                if len(numbers) >= 3:
                    # 複数の正解がある場合
                    correct_answers = [numbers[i] for i in range(1, len(numbers)) if i % 2 == 1]
                    correct_answer = ",".join(correct_answers)
                
                answers[problem_num] = {
                    "correct_answer": correct_answer,
                    "correctness_pattern": None  # 後で計算
                }
            except ValueError:
                continue
    
    return answers

def parse_problem_text(text: str) -> List[Dict]:
    """問題文テキストを解析して問題リストを取得"""
    problems = []
    
    # 問題番号のパターンを探す（例: "【問題1】" や "問題1"）
    problem_pattern = re.compile(r'問題\s*(\d+)|【問題\s*(\d+)】|第\s*(\d+)\s*問', re.IGNORECASE)
    
    # テキストを行ごとに分割
    lines = text.split("\n")
    
    current_problem = None
    current_problem_num = None
    current_question_text = ""
    current_choices = []
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # 問題番号を探す
        match = problem_pattern.search(line)
        if match:
            # 前の問題を保存
            if current_problem_num is not None:
                problems.append({
                    "question_number": current_problem_num,
                    "question_text": current_question_text.strip(),
                    "choices": current_choices
                })
            
            # 新しい問題を開始
            current_problem_num = int(match.group(1) or match.group(2) or match.group(3))
            current_question_text = ""
            current_choices = []
        
        # 選択肢のパターンを探す（例: "1. 選択肢テキスト" や "ア. 選択肢テキスト"）
        choice_pattern = re.compile(r'^([1-4]|[ア-エ])[\.．]\s*(.+)$')
        choice_match = choice_pattern.match(line)
        
        if choice_match:
            choice_num = choice_match.group(1)
            choice_text = choice_match.group(2).strip()
            
            # ア->1, イ->2, ウ->3, エ->4 に変換
            if choice_num == "ア":
                choice_num = "1"
            elif choice_num == "イ":
                choice_num = "2"
            elif choice_num == "ウ":
                choice_num = "3"
            elif choice_num == "エ":
                choice_num = "4"
            
            current_choices.append({
                "number": choice_num,
                "text": choice_text
            })
        else:
            # 問題文の一部
            if current_problem_num is not None and line:
                current_question_text += line + "\n"
        
        i += 1
    
    # 最後の問題を保存
    if current_problem_num is not None:
        problems.append({
            "question_number": current_problem_num,
            "question_text": current_question_text.strip(),
            "choices": current_choices
        })
    
    return problems

def create_correctness_pattern(choices: List[Dict], correct_answer: str) -> str:
    """正誤パターンを作成（"〇☓☓☓"など）"""
    correct_set = set(correct_answer.split(","))
    pattern = ""
    
    for choice in sorted(choices, key=lambda x: int(x["number"])):
        if choice["number"] in correct_set:
            pattern += "〇"
        else:
            pattern += "☓"
    
    return pattern

def process_short_answer_pdf(problem_pdf_path: Path, answer_pdf_path: Path, output_json_path: Path, 
                              exam_type: str, year: str, subject: str):
    """短答式PDFを処理してJSONファイルを生成"""
    
    print(f"問題文PDFを読み込み中: {problem_pdf_path}")
    problem_text = extract_text_from_pdf(problem_pdf_path)
    
    print(f"解答PDFを読み込み中: {answer_pdf_path}")
    answers = parse_answer_pdf(answer_pdf_path)
    
    print(f"問題文を解析中...")
    problems = parse_problem_text(problem_text)
    
    # 問題と解答を結合
    result_problems = []
    for problem in problems:
        problem_num = problem["question_number"]
        answer_info = answers.get(problem_num)
        
        if not answer_info:
            print(f"警告: 問題{problem_num}の解答が見つかりませんでした")
            continue
        
        # 選択肢を整理（1-4の順序で）
        choices_sorted = sorted(problem["choices"], key=lambda x: int(x["number"]))
        
        # 正誤パターンを作成
        correctness_pattern = create_correctness_pattern(choices_sorted, answer_info["correct_answer"])
        
        # 問題データを作成
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
        
        result_problems.append(problem_data)
    
    # JSONファイルを作成
    output_data = {
        "year": year,
        "exam_type": exam_type,
        "subject": subject,
        "source_pdf": str(problem_pdf_path.relative_to(Path.cwd())),
        "problems": result_problems
    }
    
    # JSONファイルを保存
    output_json_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    print(f"JSONファイルを保存しました: {output_json_path}")
    print(f"問題数: {len(result_problems)}")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 6:
        print("使用方法: python extract_short_answer_pdf_to_json.py <問題文PDF> <解答PDF> <出力JSON> <試験種別> <年度> <科目>")
        print("例: python extract_short_answer_pdf_to_json.py problem.pdf answer.pdf output.json 予備 R7 憲法・行政法")
        sys.exit(1)
    
    problem_pdf = Path(sys.argv[1])
    answer_pdf = Path(sys.argv[2])
    output_json = Path(sys.argv[3])
    exam_type = sys.argv[4]
    year = sys.argv[5]
    subject = sys.argv[6]
    
    process_short_answer_pdf(problem_pdf, answer_pdf, output_json, exam_type, year, subject)
