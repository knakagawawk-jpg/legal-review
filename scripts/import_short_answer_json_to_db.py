#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
短答式問題のJSONファイルをデータベースにインポート
"""

import json
import sys
from pathlib import Path
from sqlalchemy.orm import Session
from app.db import SessionLocal, engine, Base
from app.models import ShortAnswerProblem
from config.subjects import get_subject_id, get_subject_name

def import_json_to_db(json_path: Path, db: Session):
    """JSONファイルをデータベースにインポート"""
    print(f"JSONファイルを読み込み中: {json_path}")
    
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    year = data["year"]
    exam_type = data["exam_type"]
    # 「予備」を「予備試験」に統一
    if exam_type == "予備":
        exam_type = "予備試験"
    subject_raw = data["subject"]
    source_pdf = data.get("source_pdf")
    problems = data["problems"]
    
    # 科目はID（1-18）で保存する
    subject_id = None
    if isinstance(subject_raw, int):
        subject_id = subject_raw
    elif isinstance(subject_raw, str):
        s = subject_raw.strip()
        subject_id = int(s) if s.isdigit() else get_subject_id(s)
    if subject_id is None or not (1 <= subject_id <= 18):
        raise ValueError(f"科目の形式が不正です: {subject_raw!r} ({json_path})")

    print(f"試験種別: {exam_type}, 年度: {year}, 科目: {get_subject_name(subject_id)}")
    print(f"問題数: {len(problems)}")
    
    success_count = 0
    error_count = 0
    
    for problem_data in problems:
        try:
            # 既存の問題を確認（同じ試験種別、年度、科目、問題番号）
            existing = db.query(ShortAnswerProblem).filter(
                ShortAnswerProblem.exam_type == exam_type,
                ShortAnswerProblem.year == year,
                ShortAnswerProblem.subject == subject_id,
                ShortAnswerProblem.question_number == problem_data["question_number"]
            ).first()
            
            if existing:
                # 更新
                existing.question_text = problem_data["question_text"]
                existing.choice_1 = problem_data["choice_1"]
                existing.choice_2 = problem_data["choice_2"]
                existing.choice_3 = problem_data["choice_3"]
                existing.choice_4 = problem_data.get("choice_4")
                existing.correct_answer = problem_data["correct_answer"]
                existing.correctness_pattern = problem_data["correctness_pattern"]
                if source_pdf:
                    existing.source_pdf = source_pdf
                print(f"  更新: 問題{problem_data['question_number']}")
            else:
                # 新規作成
                new_problem = ShortAnswerProblem(
                    exam_type=exam_type,
                    year=year,
                    subject=subject_id,
                    question_number=problem_data["question_number"],
                    question_text=problem_data["question_text"],
                    choice_1=problem_data["choice_1"],
                    choice_2=problem_data["choice_2"],
                    choice_3=problem_data["choice_3"],
                    choice_4=problem_data.get("choice_4"),
                    correct_answer=problem_data["correct_answer"],
                    correctness_pattern=problem_data["correctness_pattern"],
                    source_pdf=source_pdf
                )
                db.add(new_problem)
                print(f"  作成: 問題{problem_data['question_number']}")
            
            success_count += 1
        except Exception as e:
            error_count += 1
            print(f"  エラー: 問題{problem_data.get('question_number', '?')} - {str(e)}")
    
    db.commit()
    print(f"\n完了: 成功 {success_count}件, 失敗 {error_count}件")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("使用方法: python import_short_answer_json_to_db.py <JSONファイル> [JSONファイル2] ...")
        sys.exit(1)
    
    # データベーステーブルを作成
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        for json_path_str in sys.argv[1:]:
            json_path = Path(json_path_str)
            if not json_path.exists():
                print(f"エラー: ファイルが見つかりません: {json_path}")
                continue
            
            import_json_to_db(json_path, db)
    finally:
        db.close()
