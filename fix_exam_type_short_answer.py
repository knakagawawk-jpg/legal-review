#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
短答式問題のexam_typeを「予備」から「予備試験」に統一
"""

import sys
from app.db import SessionLocal, engine, Base
from app.models import ShortAnswerProblem

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

def fix_exam_type():
    """exam_typeを「予備」から「予備試験」に更新"""
    db = SessionLocal()
    try:
        # 「予備」を「予備試験」に更新
        problems = db.query(ShortAnswerProblem).filter(
            ShortAnswerProblem.exam_type == "予備"
        ).all()
        
        print(f"更新対象: {len(problems)}件")
        
        for problem in problems:
            problem.exam_type = "予備試験"
            print(f"  更新: ID={problem.id}, {problem.exam_type} {problem.year} {problem.subject} 問題{problem.question_number}")
        
        db.commit()
        print(f"\n完了: {len(problems)}件のexam_typeを「予備試験」に更新しました")
        
    except Exception as e:
        db.rollback()
        print(f"エラー: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    fix_exam_type()
