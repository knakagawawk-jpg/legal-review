"""
講評履歴のテストデータを追加するスクリプト

使い方:
  cd law-review
  python -m scripts.add_review_history_test_data --user_id 1

削除:
  python -m scripts.add_review_history_test_data --user_id 1 --delete
"""
import sys
import os
import random
import json
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from decimal import Decimal

# プロジェクトルートをパスに追加
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import SessionLocal
from app.models import User, Review, UserReviewHistory
from config.subjects import SUBJECT_MAP


def add_test_data(user_id: int):
    """
    指定ユーザーに対して講評履歴のテストデータを追加
    
    Args:
        user_id: ユーザーID
    """
    db = SessionLocal()
    
    try:
        # ユーザーの存在確認
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            print(f"エラー: ユーザーID {user_id} が見つかりません")
            return
        
        print(f"ユーザー: {user.email} (ID: {user_id})")
        
        # 試験種別と年度の組み合わせ
        exam_types = ["司法試験", "予備試験"]
        years = list(range(2020, 2026))  # 2020-2025年
        
        # 科目ID（1-18、主要科目を多めに）
        subjects = [1, 2, 3, 4, 5, 6, 7]  # 主要7科目
        subjects.extend([11, 12, 13, 14, 15])  # 選択科目
        
        added_count = 0
        
        # 各試験種別・年度・科目の組み合わせでデータを作成
        for exam_type in exam_types:
            for year in years:
                # 各科目について1-3件のデータを作成
                for subject_id in subjects:
                    # 1-3回の試行回数
                    attempt_count = random.randint(1, 3)
                    
                    for attempt in range(1, attempt_count + 1):
                        # 点数を生成（30-90点の範囲、回数を重ねるごとに少し高めに）
                        base_score = random.uniform(30, 70)
                        if attempt > 1:
                            base_score += random.uniform(5, 20)  # 再試行時は少し高め
                        score = min(90, max(30, base_score))
                        
                        # 最小限のReviewレコードを作成
                        subject_name = SUBJECT_MAP.get(subject_id, "不明")
                        era_prefix = "R" if year >= 2019 else "H" if year >= 1989 else "S"
                        era_year = year - 2018 if year >= 2019 else year - 1988 if year >= 1989 else year - 1925
                        question_title = f"{era_prefix}{era_year}{subject_name}"
                        
                        review = Review(
                            user_id=user_id,
                            source_type="custom",  # 公式問題のIDは不要なのでcustom
                            custom_question_text=f"{question_title}の問題文（テスト用）",
                            answer_text="テスト用の答案テキスト",
                            kouhyo_kekka=json.dumps({
                                "総合評価": {
                                    "点数": float(score)
                                }
                            }, ensure_ascii=False)
                        )
                        db.add(review)
                        db.flush()  # review_idを取得するためにflush
                        
                        # UserReviewHistoryを作成
                        history = UserReviewHistory(
                            user_id=user_id,
                            review_id=review.id,
                            subject=subject_id,
                            exam_type=exam_type,
                            year=year,
                            score=Decimal(str(round(score, 1))),
                            attempt_count=attempt,
                            question_title=question_title,
                            created_at=datetime.now(ZoneInfo("UTC")) - timedelta(days=random.randint(0, 180))
                        )
                        db.add(history)
                        added_count += 1
        
        db.commit()
        print(f"完了: {added_count}件の講評履歴データを追加しました")
        
    except Exception as e:
        db.rollback()
        print(f"エラー: {e}")
        raise
    finally:
        db.close()


def delete_test_data(user_id: int):
    """
    指定ユーザーの講評履歴テストデータを削除
    """
    db = SessionLocal()
    
    try:
        # UserReviewHistoryを削除
        deleted_history_count = db.query(UserReviewHistory).filter(
            UserReviewHistory.user_id == user_id
        ).count()
        
        # 関連するReviewも削除（customタイプのみ）
        deleted_review_count = db.query(Review).filter(
            Review.user_id == user_id,
            Review.source_type == "custom",
            Review.answer_text == "テスト用の答案テキスト"
        ).count()
        
        # 削除実行
        db.query(UserReviewHistory).filter(
            UserReviewHistory.user_id == user_id
        ).delete(synchronize_session=False)
        
        db.query(Review).filter(
            Review.user_id == user_id,
            Review.source_type == "custom",
            Review.answer_text == "テスト用の答案テキスト"
        ).delete(synchronize_session=False)
        
        db.commit()
        print(f"削除完了: 講評履歴 {deleted_history_count}件, Review {deleted_review_count}件")
        
    except Exception as e:
        db.rollback()
        print(f"エラー: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="講評履歴テストデータを追加/削除")
    parser.add_argument("--user_id", type=int, required=True, help="ユーザーID")
    parser.add_argument("--delete", action="store_true", help="データを削除する")
    
    args = parser.parse_args()
    
    if args.delete:
        delete_test_data(args.user_id)
    else:
        add_test_data(args.user_id)
