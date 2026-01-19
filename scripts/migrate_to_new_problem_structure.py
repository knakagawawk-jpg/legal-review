#!/usr/bin/env python
"""
既存のProblemテーブルから新しいProblemMetadata/ProblemDetails構造への移行スクリプト

使用方法:
    python migrate_to_new_problem_structure.py

注意:
    - 既存のProblemテーブルは保持されます（後方互換性のため）
    - 既存のSubmission.problem_idは新しいproblem_metadata_id/problem_details_idにマッピングされます
    - 重複チェックを行い、既に移行済みのデータはスキップします
"""

import sys
from pathlib import Path

# プロジェクトルートをパスに追加
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db import SessionLocal, engine, Base
from app.models import Problem, ProblemMetadata, ProblemDetails, Submission
from sqlalchemy import inspect, text

def create_tables_if_not_exist():
    """新しいテーブルが存在しない場合は作成"""
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    
    if "problem_metadata" not in existing_tables or "problem_details" not in existing_tables:
        print("新しいテーブル（problem_metadata, problem_details）を作成中...")
        Base.metadata.create_all(bind=engine, tables=[ProblemMetadata.__table__, ProblemDetails.__table__])
        print("[OK] テーブル作成完了")
    else:
        print("[OK] 新しいテーブルは既に存在します")
    
    # submissionsテーブルに新しいカラムを追加（既存の場合はスキップ）
    if "submissions" in existing_tables:
        db = SessionLocal()
        try:
            # problem_metadata_idカラムの存在確認と追加
            result = db.execute(text("PRAGMA table_info(submissions)"))
            columns = [row[1] for row in result]
            
            if "problem_metadata_id" not in columns:
                print("submissionsテーブルにproblem_metadata_idカラムを追加中...")
                db.execute(text("ALTER TABLE submissions ADD COLUMN problem_metadata_id INTEGER"))
                db.commit()
                print("[OK] problem_metadata_idカラムを追加しました")
            
            if "problem_details_id" not in columns:
                print("submissionsテーブルにproblem_details_idカラムを追加中...")
                db.execute(text("ALTER TABLE submissions ADD COLUMN problem_details_id INTEGER"))
                db.commit()
                print("[OK] problem_details_idカラムを追加しました")
        finally:
            db.close()

def migrate_problems():
    """既存のProblemテーブルから新しい構造へ移行"""
    db = SessionLocal()
    
    try:
        # 既存の問題を取得
        old_problems = db.query(Problem).all()
        
        if not old_problems:
            print("移行する問題が見つかりませんでした。")
            return
        
        print(f"見つかった問題: {len(old_problems)}件")
        print("-" * 60)
        
        migrated_count = 0
        skipped_count = 0
        error_count = 0
        
        for old_problem in old_problems:
            try:
                # 既にメタデータが存在するかチェック（重複防止）
                existing_metadata = db.query(ProblemMetadata).filter(
                    ProblemMetadata.exam_type == old_problem.exam_type,
                    ProblemMetadata.year == old_problem.year,
                    ProblemMetadata.subject == old_problem.subject
                ).first()
                
                if existing_metadata:
                    print(f"スキップ: {old_problem.exam_type} {old_problem.year}年 {old_problem.subject} (既に移行済み)")
                    skipped_count += 1
                    
                    # 既存の詳細情報（設問1）を取得
                    existing_detail = db.query(ProblemDetails).filter(
                        ProblemDetails.problem_metadata_id == existing_metadata.id,
                        ProblemDetails.question_number == 1
                    ).first()
                    
                    # 既存のSubmissionを新しい構造に更新
                    detail_id = existing_detail.id if existing_detail else None
                    updated_count = update_submissions_for_old_problem(db, old_problem.id, existing_metadata.id, detail_id)
                    if updated_count > 0:
                        print(f"  → Submission更新: {updated_count}件")
                    continue
                
                # 新しいメタデータを作成
                new_metadata = ProblemMetadata(
                    exam_type=old_problem.exam_type,
                    year=old_problem.year,
                    subject=old_problem.subject
                )
                db.add(new_metadata)
                db.flush()  # IDを取得するためにflush
                
                # 詳細情報を作成（設問1として全体の問題文を保存）
                new_detail = ProblemDetails(
                    problem_metadata_id=new_metadata.id,
                    question_number=1,  # 既存データは設問1として扱う
                    question_text=old_problem.question_text,
                    purpose=old_problem.purpose,
                    scoring_notes=old_problem.scoring_notes,
                    pdf_path=old_problem.pdf_path
                )
                db.add(new_detail)
                db.flush()  # IDを取得するためにflush
                
                # 既存のSubmissionを新しい構造に更新
                updated_count = update_submissions_for_old_problem(db, old_problem.id, new_metadata.id, new_detail.id)
                
                db.commit()
                
                print(f"移行完了: {old_problem.exam_type} {old_problem.year}年 {old_problem.subject}")
                print(f"  → メタデータID: {new_metadata.id}, 詳細ID: {new_detail.id}")
                if updated_count > 0:
                    print(f"  → Submission更新: {updated_count}件")
                migrated_count += 1
                
            except Exception as e:
                db.rollback()
                print(f"エラー: {old_problem.exam_type} {old_problem.year}年 {old_problem.subject} - {str(e)}")
                error_count += 1
        
        print("\n" + "=" * 60)
        print("移行処理完了:")
        print(f"  移行成功: {migrated_count}件")
        print(f"  スキップ: {skipped_count}件（既に移行済み）")
        print(f"  エラー: {error_count}件")
        
    finally:
        db.close()

def update_submissions_for_old_problem(db, old_problem_id: int, new_metadata_id: int, new_detail_id: int = None):
    """既存のSubmissionのproblem_idを新しい構造に更新"""
    submissions = db.query(Submission).filter(Submission.problem_id == old_problem_id).all()
    
    if not submissions:
        return 0
    
    updated_count = 0
    for submission in submissions:
        # 新しいIDを設定（既に設定されている場合はスキップ）
        updated = False
        if submission.problem_metadata_id is None:
            submission.problem_metadata_id = new_metadata_id
            updated = True
        if submission.problem_details_id is None and new_detail_id:
            submission.problem_details_id = new_detail_id
            updated = True
        
        if updated:
            updated_count += 1
    
    if updated_count > 0:
        db.commit()
        print(f"  → Submission更新: {updated_count}件")
    
    return updated_count

def verify_migration():
    """移行結果の検証"""
    db = SessionLocal()
    
    try:
        metadata_count = db.query(ProblemMetadata).count()
        details_count = db.query(ProblemDetails).count()
        submissions_with_metadata = db.query(Submission).filter(Submission.problem_metadata_id.isnot(None)).count()
        
        print("\n" + "=" * 60)
        print("移行結果の検証:")
        print(f"  メタデータ数: {metadata_count}件")
        print(f"  詳細情報数: {details_count}件")
        print(f"  新しい構造を使用しているSubmission: {submissions_with_metadata}件")
        
    finally:
        db.close()

if __name__ == "__main__":
    print("=" * 60)
    print("Problemテーブルの新構造への移行を開始します")
    print("=" * 60)
    print()
    
    # テーブル作成
    create_tables_if_not_exist()
    print()
    
    # データ移行
    migrate_problems()
    print()
    
    # 検証
    verify_migration()
    print()
    print("=" * 60)
    print("移行処理が完了しました")
    print("=" * 60)
