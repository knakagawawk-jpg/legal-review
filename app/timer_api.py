"""
タイマー関連のAPIエンドポイント
"""
from fastapi import Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
import uuid
from zoneinfo import ZoneInfo

from .db import get_db
from .models import TimerSession, TimerDailyChunk, TimerDailyStats, User
from .schemas import TimerSessionResponse, TimerDailyStatsResponse, TimerStartResponse, TimerStopResponse
from .timer_utils import get_study_date, split_session_by_date_boundary
from .auth import get_current_user_required


def update_daily_stats(db: Session, user_id: int, study_date: str, additional_seconds: int, additional_sessions: int = 0):
    """
    日次統計を更新（増分）
    
    Args:
        db: データベースセッション
        user_id: ユーザーID
        study_date: 学習日（YYYY-MM-DD）
        additional_seconds: 追加する秒数
        additional_sessions: 追加するセッション数（デフォルト0）
    """
    stats = db.query(TimerDailyStats).filter(
        TimerDailyStats.user_id == user_id,
        TimerDailyStats.study_date == study_date
    ).first()
    
    if stats:
        stats.total_seconds += additional_seconds
        stats.sessions_count += additional_sessions
        stats.updated_at_utc = datetime.now(ZoneInfo("UTC"))
    else:
        stats = TimerDailyStats(
            user_id=user_id,
            study_date=study_date,
            total_seconds=additional_seconds,
            sessions_count=additional_sessions
        )
        db.add(stats)
    
    db.commit()


def register_timer_routes(app):
    """タイマー関連のルートをアプリケーションに登録"""
    from fastapi import Depends
    from .db import get_db
    
    @app.post("/api/timer/start", response_model=TimerStartResponse)
    async def start_timer(
        device_id: Optional[str] = None,
        current_user: User = Depends(get_current_user_required),
        db: Session = Depends(get_db)
    ):
        """
        タイマーを開始
        
        仕様:
        - ユーザーにつきrunningは常に最大1件
        - 既存のrunningセッションがあれば自動停止
        - 新しいセッションを作成してrunningにする
        """
        now_utc = datetime.now(ZoneInfo("UTC"))
        study_date = get_study_date(now_utc)
        
        # 既存のrunningセッションを確認
        existing_running = db.query(TimerSession).filter(
            TimerSession.user_id == current_user.id,
            TimerSession.status == "running"
        ).first()
        
        if existing_running:
            # 既存のrunningセッションを自動停止
            existing_running.ended_at_utc = now_utc
            existing_running.status = "stopped"
            existing_running.stop_reason = "auto_replaced_by_new_start"
            existing_running.updated_at_utc = now_utc
            
            # 停止したセッションを4:00区切りで分割してchunksを作成
            chunks = split_session_by_date_boundary(existing_running.started_at_utc, now_utc)
            for chunk_study_date, chunk_start, chunk_end, chunk_seconds in chunks:
                chunk_id = str(uuid.uuid4())
                chunk = TimerDailyChunk(
                    id=chunk_id,
                    user_id=current_user.id,
                    session_id=existing_running.id,
                    study_date=chunk_study_date,
                    seconds=chunk_seconds
                )
                db.add(chunk)
                
                # 日次統計を更新
                update_daily_stats(db, current_user.id, chunk_study_date, chunk_seconds, 0)
            
            db.commit()
        
        # 新しいセッションを作成
        session_id = str(uuid.uuid4())
        new_session = TimerSession(
            id=session_id,
            user_id=current_user.id,
            device_id=device_id,
            started_at_utc=now_utc,
            status="running"
        )
        db.add(new_session)
        db.commit()
        db.refresh(new_session)
        
        # 今日の統計とセッション一覧を取得
        stats = db.query(TimerDailyStats).filter(
            TimerDailyStats.user_id == current_user.id,
            TimerDailyStats.study_date == study_date
        ).first()
        
        if not stats:
            stats = TimerDailyStats(
                user_id=current_user.id,
                study_date=study_date,
                total_seconds=0,
                sessions_count=0
            )
            db.add(stats)
            db.commit()
            db.refresh(stats)
        
        # 今日のセッション一覧を取得（最大5件）
        today_sessions = db.query(TimerSession).filter(
            TimerSession.user_id == current_user.id
        ).join(
            TimerDailyChunk,
            TimerSession.id == TimerDailyChunk.session_id
        ).filter(
            TimerDailyChunk.study_date == study_date
        ).distinct().order_by(TimerSession.started_at_utc.desc()).limit(5).all()
        
        # runningセッションも含める（chunkがまだない場合）
        running_session = db.query(TimerSession).filter(
            TimerSession.user_id == current_user.id,
            TimerSession.status == "running",
            TimerSession.id == session_id
        ).first()
        
        if running_session and running_session not in today_sessions:
            today_sessions.insert(0, running_session)
            today_sessions = today_sessions[:5]
        
        return TimerStartResponse(
            active_session_id=session_id,
            study_date=study_date,
            confirmed_total_seconds=stats.total_seconds,
            active_started_at_utc=new_session.started_at_utc,
            daily_stats=TimerDailyStatsResponse.model_validate(stats),
            sessions=[TimerSessionResponse.model_validate(s) for s in today_sessions]
        )


    @app.post("/api/timer/stop/{session_id}", response_model=TimerStopResponse)
    async def stop_timer(
        session_id: str,
        current_user: User = Depends(get_current_user_required),
        db: Session = Depends(get_db)
    ):
        """
        タイマーを停止
        
        仕様:
        - 対象セッションをstoppedにする
        - (started, ended)を4:00境界で分割してchunksを作成/更新
        - timer_daily_statsを合算更新
        """
        session = db.query(TimerSession).filter(
            TimerSession.id == session_id,
            TimerSession.user_id == current_user.id
        ).first()
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        if session.status != "running":
            raise HTTPException(status_code=400, detail="Session is not running")
        
        now_utc = datetime.now(ZoneInfo("UTC"))
        study_date = get_study_date(now_utc)
        
        # セッションを停止
        session.ended_at_utc = now_utc
        session.status = "stopped"
        session.stop_reason = "user_stop"
        session.updated_at_utc = now_utc
        
        # セッション開始時刻からstudy_dateを計算（セッションがどの日に属するか）
        session_study_date = get_study_date(session.started_at_utc)
        
        # セッションを4:00区切りで分割してchunksを作成
        chunks = split_session_by_date_boundary(session.started_at_utc, now_utc)
        
        # セッション全体のsessions_countを更新（セッション開始日のstudy_dateが今日の場合のみ）
        if session_study_date == study_date:
            update_daily_stats(db, current_user.id, study_date, 0, additional_sessions=1)
        
        # 各chunkの秒数を更新
        for chunk_study_date, chunk_start, chunk_end, chunk_seconds in chunks:
            chunk_id = str(uuid.uuid4())
            chunk = TimerDailyChunk(
                id=chunk_id,
                user_id=current_user.id,
                session_id=session.id,
                study_date=chunk_study_date,
                seconds=chunk_seconds
            )
            db.add(chunk)
            
            # 日次統計を更新（秒数のみ、sessions_countは既に更新済み）
            update_daily_stats(db, current_user.id, chunk_study_date, chunk_seconds, 0)
        
        db.commit()
        
        # 今日の統計を取得
        stats = db.query(TimerDailyStats).filter(
            TimerDailyStats.user_id == current_user.id,
            TimerDailyStats.study_date == study_date
        ).first()
        
        if not stats:
            stats = TimerDailyStats(
                user_id=current_user.id,
                study_date=study_date,
                total_seconds=0,
                sessions_count=0
            )
            db.add(stats)
            db.commit()
            db.refresh(stats)
        
        # 今日のセッション一覧を取得（最大5件）
        today_sessions = db.query(TimerSession).filter(
            TimerSession.user_id == current_user.id
        ).join(
            TimerDailyChunk,
            TimerSession.id == TimerDailyChunk.session_id
        ).filter(
            TimerDailyChunk.study_date == study_date
        ).distinct().order_by(TimerSession.started_at_utc.desc()).limit(5).all()
        
        return TimerStopResponse(
            study_date=study_date,
            confirmed_total_seconds=stats.total_seconds,
            daily_stats=TimerDailyStatsResponse.model_validate(stats),
            sessions=[TimerSessionResponse.model_validate(s) for s in today_sessions]
        )


    @app.get("/api/timer/daily-stats", response_model=TimerDailyStatsResponse)
    async def get_daily_stats(
        study_date: Optional[str] = Query(None, description="学習日（YYYY-MM-DD）。指定しない場合は今日"),
        current_user: User = Depends(get_current_user_required),
        db: Session = Depends(get_db)
    ):
        """
        日次統計を取得
        """
        if study_date is None:
            study_date = get_study_date()
        
        stats = db.query(TimerDailyStats).filter(
            TimerDailyStats.user_id == current_user.id,
            TimerDailyStats.study_date == study_date
        ).first()
        
        if not stats:
            stats = TimerDailyStats(
                user_id=current_user.id,
                study_date=study_date,
                total_seconds=0,
                sessions_count=0
            )
            db.add(stats)
            db.commit()
            db.refresh(stats)
        
        return TimerDailyStatsResponse.model_validate(stats)


    @app.get("/api/timer/sessions", response_model=List[TimerSessionResponse])
    async def get_timer_sessions(
        study_date: Optional[str] = Query(None, description="学習日（YYYY-MM-DD）。指定しない場合は今日"),
        limit: int = Query(5, ge=1, le=100, description="取得件数"),
        current_user: User = Depends(get_current_user_required),
        db: Session = Depends(get_db)
    ):
        """
        セッション一覧を取得
        """
        if study_date is None:
            study_date = get_study_date()
        
        # 今日のセッション一覧を取得
        sessions = db.query(TimerSession).filter(
            TimerSession.user_id == current_user.id
        ).join(
            TimerDailyChunk,
            TimerSession.id == TimerDailyChunk.session_id
        ).filter(
            TimerDailyChunk.study_date == study_date
        ).distinct().order_by(TimerSession.started_at_utc.desc()).limit(limit).all()
        
        # runningセッションも含める（chunkがまだない場合）
        running_sessions = db.query(TimerSession).filter(
            TimerSession.user_id == current_user.id,
            TimerSession.status == "running"
        ).all()
        
        for running_session in running_sessions:
            # このセッションが今日のstudy_dateに属するかチェック
            running_study_date = get_study_date(running_session.started_at_utc)
            if running_study_date == study_date and running_session not in sessions:
                sessions.insert(0, running_session)
                sessions = sessions[:limit]
        
        return [TimerSessionResponse.model_validate(s) for s in sessions]
