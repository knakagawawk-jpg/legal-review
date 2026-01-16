#!/usr/bin/env python
"""
管理者用: 問題データの一括インポートスクリプト

使用方法:
    python admin_import_problems.py problems.json
    python admin_import_problems.py problems.csv
"""

import sys
import json
import csv
import os
from pathlib import Path

# プロジェクトルートをパスに追加
sys.path.insert(0, str(Path(__file__).parent))

from app.db import SessionLocal
from app.models import Problem

def import_from_json(file_path: str):
    """JSONファイルから問題をインポート"""
    with open(file_path, 'r', encoding='utf-8') as f:
        problems = json.load(f)
    
    if not isinstance(problems, list):
        raise ValueError("JSONファイルは配列形式である必要があります。")
    
    db = SessionLocal()
    success_count = 0
    error_count = 0
    
    try:
        for idx, problem_data in enumerate(problems):
            try:
                # 必須フィールドの確認
                required_fields = ['exam_type', 'year', 'subject', 'question_text']
                missing_fields = [field for field in required_fields if field not in problem_data]
                if missing_fields:
                    print(f"エラー: 行 {idx + 1} に必須フィールドが不足しています: {', '.join(missing_fields)}")
                    error_count += 1
                    continue
                
                # 問題を作成
                db_problem = Problem(
                    exam_type=problem_data['exam_type'],
                    year=int(problem_data['year']),
                    subject=problem_data['subject'],
                    question_text=problem_data['question_text'],
                    scoring_notes=problem_data.get('scoring_notes'),
                    purpose=problem_data.get('purpose'),
                    other_info=json.dumps(problem_data.get('other_info'), ensure_ascii=False) if problem_data.get('other_info') else None,
                )
                db.add(db_problem)
                db.commit()
                success_count += 1
                print(f"✓ 登録成功: {problem_data['exam_type']} {problem_data['year']}年 {problem_data['subject']}")
                
            except Exception as e:
                db.rollback()
                error_count += 1
                print(f"✗ エラー (行 {idx + 1}): {str(e)}")
        
        print(f"\n完了: 成功 {success_count}件, 失敗 {error_count}件")
        
    finally:
        db.close()

def import_from_csv(file_path: str):
    """CSVファイルから問題をインポート"""
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        problems = list(reader)
    
    db = SessionLocal()
    success_count = 0
    error_count = 0
    
    try:
        for idx, problem_data in enumerate(problems):
            try:
                # 必須フィールドの確認
                required_fields = ['exam_type', 'year', 'subject', 'question_text']
                missing_fields = [field for field in required_fields if field not in problem_data or not problem_data[field]]
                if missing_fields:
                    print(f"エラー: 行 {idx + 2} に必須フィールドが不足しています: {', '.join(missing_fields)}")
                    error_count += 1
                    continue
                
                # 問題を作成
                db_problem = Problem(
                    exam_type=problem_data['exam_type'].strip(),
                    year=int(problem_data['year']),
                    subject=problem_data['subject'].strip(),
                    question_text=problem_data['question_text'].strip(),
                    scoring_notes=problem_data.get('scoring_notes', '').strip() or None,
                    purpose=problem_data.get('purpose', '').strip() or None,
                    other_info=None,  # CSVではother_infoは対応しない
                )
                db.add(db_problem)
                db.commit()
                success_count += 1
                print(f"✓ 登録成功: {problem_data['exam_type']} {problem_data['year']}年 {problem_data['subject']}")
                
            except Exception as e:
                db.rollback()
                error_count += 1
                print(f"✗ エラー (行 {idx + 2}): {str(e)}")
        
        print(f"\n完了: 成功 {success_count}件, 失敗 {error_count}件")
        
    finally:
        db.close()

def main():
    if len(sys.argv) < 2:
        print("使用方法: python admin_import_problems.py <ファイルパス>")
        print("対応形式: JSON (.json), CSV (.csv)")
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    if not os.path.exists(file_path):
        print(f"エラー: ファイルが見つかりません: {file_path}")
        sys.exit(1)
    
    file_ext = os.path.splitext(file_path)[1].lower()
    
    try:
        if file_ext == '.json':
            import_from_json(file_path)
        elif file_ext == '.csv':
            import_from_csv(file_path)
        else:
            print(f"エラー: サポートされていないファイル形式です: {file_ext}")
            print("対応形式: .json, .csv")
            sys.exit(1)
    except Exception as e:
        print(f"エラー: {str(e)}")
        sys.exception(e)
        sys.exit(1)

if __name__ == "__main__":
    main()
