"""
1月1日から今日までの勉強時間テストデータを追加するスクリプト

使い方:
  cd law-review
  python -m scripts.add_timer_test_data --user_id 1

削除:
  python -m scripts.add_timer_test_data --user_id 1 --delete
"""
import sys
import os
import random
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

# プロジェクトルートをパスに追加
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import SessionLocal
from app.models import TimerDailyStats, User


def add_test_data(user_id: int, start_date: str = "2026-01-01"):
    """
    指定ユーザーに対して、start_dateから今日までの勉強時間テストデータを追加
    
    Args:
        user_id: ユーザーID
        start_date: 開始日（YYYY-MM-DD形式）
    """
    db = SessionLocal()
    
    try:
        # ユーザーの存在確認
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            print(f"エラー: ユーザーID {user_id} が見つかりません")
            return
        
        print(f"ユーザー: {user.email} (ID: {user_id})")
        
        # 開始日と終了日
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        
        # 今日の日付を取得（JST 4:00切替を考慮）
        USER_TIMEZONE = ZoneInfo("Asia/Tokyo")
        now_utc = datetime.now(ZoneInfo("UTC"))
        now_local = now_utc.astimezone(USER_TIMEZONE)
        current_hour = now_local.hour
        if current_hour < 4:
            today = (now_local.date() - timedelta(days=1))
        else:
            today = now_local.date()
        
        print(f"期間: {start} ～ {today}")
        
        # 既存のデータを確認
        existing_count = db.query(TimerDailyStats).filter(
            TimerDailyStats.user_id == user_id,
            TimerDailyStats.study_date >= start_date,
            TimerDailyStats.study_date <= today.isoformat()
        ).count()
        
        if existing_count > 0:
            print(f"警告: この期間に既存データが{existing_count}件あります。上書きします。")
        
        # 各日のデータを追加/更新
        current_date = start
        added_count = 0
        updated_count = 0
        
        while current_date <= today:
            study_date = current_date.isoformat()
            
            # 0～9時間のランダムな秒数（0～32400秒）
            # 週末は少し多めにする傾向を追加
            is_weekend = current_date.weekday() >= 5
            if is_weekend:
                hours = random.uniform(2, 9)  # 週末は2〜9時間
            else:
                hours = random.uniform(0, 7)  # 平日は0〜7時間
            
            total_seconds = int(hours * 3600)
            sessions_count = random.randint(1, 5) if total_seconds > 0 else 0
            
            # 既存レコードを確認
            existing = db.query(TimerDailyStats).filter(
                TimerDailyStats.user_id == user_id,
                TimerDailyStats.study_date == study_date
            ).first()
            
            if existing:
                existing.total_seconds = total_seconds
                existing.sessions_count = sessions_count
                existing.updated_at_utc = now_utc
                updated_count += 1
            else:
                new_stats = TimerDailyStats(
                    user_id=user_id,
                    study_date=study_date,
                    total_seconds=total_seconds,
                    sessions_count=sessions_count
                )
                db.add(new_stats)
                added_count += 1
            
            current_date += timedelta(days=1)
        
        db.commit()
        print(f"完了: 追加 {added_count}件, 更新 {updated_count}件")
        
    except Exception as e:
        db.rollback()
        print(f"エラー: {e}")
        raise
    finally:
        db.close()


def delete_test_data(user_id: int, start_date: str = "2026-01-01"):
    """
    指定ユーザーのテストデータを削除
    """
    db = SessionLocal()
    
    try:
        # 今日の日付を取得
        USER_TIMEZONE = ZoneInfo("Asia/Tokyo")
        now_utc = datetime.now(ZoneInfo("UTC"))
        now_local = now_utc.astimezone(USER_TIMEZONE)
        current_hour = now_local.hour
        if current_hour < 4:
            today = (now_local.date() - timedelta(days=1))
        else:
            today = now_local.date()
        
        deleted_count = db.query(TimerDailyStats).filter(
            TimerDailyStats.user_id == user_id,
            TimerDailyStats.study_date >= start_date,
            TimerDailyStats.study_date <= today.isoformat()
        ).delete()
        
        db.commit()
        print(f"削除完了: {deleted_count}件")
        
    except Exception as e:
        db.rollback()
        print(f"エラー: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="勉強時間テストデータを追加/削除")
    parser.add_argument("--user_id", type=int, required=True, help="ユーザーID")
    parser.add_argument("--start_date", type=str, default="2026-01-01", help="開始日（YYYY-MM-DD）")
    parser.add_argument("--delete", action="store_true", help="データを削除する")
    
    args = parser.parse_args()
    
    if args.delete:
        delete_test_data(args.user_id, args.start_date)
    else:
        add_test_data(args.user_id, args.start_date)
