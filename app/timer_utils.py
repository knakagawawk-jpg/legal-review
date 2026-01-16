"""
タイマー関連のユーティリティ関数
"""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from typing import List

# ユーザーのタイムゾーン（デフォルトはAsia/Tokyo）
USER_TIMEZONE = ZoneInfo("Asia/Tokyo")


def get_study_date(date: datetime = None) -> str:
    """
    4:00境界で学習日を計算
    
    Args:
        date: 基準日時（UTC）。Noneの場合は現在時刻
    
    Returns:
        study_date (YYYY-MM-DD): 4:00開始の「学習日」
    """
    if date is None:
        date = datetime.now(ZoneInfo("UTC"))
    
    # UTCをユーザーTZに変換
    local_datetime = date.astimezone(USER_TIMEZONE)
    local_date = local_datetime.date()
    local_hour = local_datetime.hour
    
    # 4:00未満は前日扱い
    if local_hour < 4:
        study_date = local_date - timedelta(days=1)
    else:
        study_date = local_date
    
    return study_date.isoformat()


def split_session_by_date_boundary(started_at_utc: datetime, ended_at_utc: datetime) -> List[tuple]:
    """
    セッションを4:00境界で分割
    
    Args:
        started_at_utc: セッション開始時刻（UTC）
        ended_at_utc: セッション終了時刻（UTC）
    
    Returns:
        List[tuple]: [(study_date, chunk_start_utc, chunk_end_utc, seconds), ...]
    """
    chunks = []
    current_start = started_at_utc
    
    while current_start < ended_at_utc:
        # 現在のチャンクの開始日を取得
        current_study_date = get_study_date(current_start)
        
        # このstudy_dateの終了時刻（翌日4:00）を計算
        local_start = current_start.astimezone(USER_TIMEZONE)
        local_date = local_start.date()
        local_hour = local_start.hour
        
        # 4:00未満の場合は前日の4:00から、4:00以降は当日の4:00から
        if local_hour < 4:
            boundary_local = datetime.combine(local_date - timedelta(days=1), datetime.min.time().replace(hour=4))
        else:
            boundary_local = datetime.combine(local_date, datetime.min.time().replace(hour=4))
        
        # 翌日の4:00（このstudy_dateの終了時刻）
        next_boundary_local = boundary_local + timedelta(days=1)
        next_boundary_utc = next_boundary_local.replace(tzinfo=USER_TIMEZONE).astimezone(ZoneInfo("UTC"))
        
        # チャンクの終了時刻は、セッション終了時刻と次の境界のうち早い方
        chunk_end = min(ended_at_utc, next_boundary_utc)
        
        # 秒数を計算
        seconds = int((chunk_end - current_start).total_seconds())
        
        chunks.append((current_study_date, current_start, chunk_end, seconds))
        
        # 次のチャンクの開始時刻
        current_start = chunk_end
    
    return chunks
