# -*- coding: utf-8 -*-
"""
ユーザープランとLLM使用制限の取得・判定

- プラン未割り当てユーザーはデフォルトプラン（beta-for-260128）を適用
- limits は SubscriptionPlan.limits の JSON
"""
import json
import logging
import os
from decimal import Decimal
from typing import Optional, Any

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from .models import (
    User,
    SubscriptionPlan,
    UserSubscription,
    Review,
    Thread,
    Message,
    LlmRequest,
)
from .timer_utils import get_study_date as get_study_date_4am
from datetime import datetime
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

DEFAULT_PLAN_CODE = os.getenv("DEFAULT_PLAN_CODE", "beta-for-260128")

# limits JSON のキー
LIMIT_MAX_REVIEWS_TOTAL = "max_reviews_total"
LIMIT_MAX_REVIEW_CHAT_MESSAGES_TOTAL = "max_review_chat_messages_total"
LIMIT_MAX_FREE_CHAT_MESSAGES_TOTAL = "max_free_chat_messages_total"
LIMIT_RECENT_REVIEW_DAILY = "recent_review_daily_limit"
LIMIT_MAX_NON_REVIEW_COST_YEN_TOTAL = "max_non_review_cost_yen_total"


def _parse_limits(limits_json: Optional[str]) -> dict[str, Any]:
    if not limits_json:
        return {}
    try:
        return json.loads(limits_json) if isinstance(limits_json, str) else (limits_json or {})
    except Exception:
        return {}


def get_default_plan(db: Session) -> Optional[SubscriptionPlan]:
    """デフォルトプラン（plan_code）を取得。未設定なら None。"""
    return db.query(SubscriptionPlan).filter(
        SubscriptionPlan.plan_code == DEFAULT_PLAN_CODE,
        SubscriptionPlan.is_active == True,
    ).first()


def get_user_plan(db: Session, user: User) -> Optional[SubscriptionPlan]:
    """
    ユーザーに適用されるプランを返す。
    - 有効な UserSubscription があればそのプラン
    - なければデフォルトプラン（全ユーザー対象の beta 想定）
    """
    sub = (
        db.query(UserSubscription)
        .join(SubscriptionPlan, UserSubscription.plan_id == SubscriptionPlan.id)
        .filter(
            UserSubscription.user_id == user.id,
            UserSubscription.is_active == True,
            SubscriptionPlan.is_active == True,
        )
        .order_by(UserSubscription.started_at.desc())
        .first()
    )
    if sub and sub.plan:
        return sub.plan
    return get_default_plan(db)


def get_plan_limits(plan: Optional[SubscriptionPlan]) -> dict[str, Any]:
    """プランの limits 辞書を返す。プランがなければ空辞書（制限なし扱い）。"""
    if not plan or not plan.limits:
        return {}
    return _parse_limits(plan.limits)


# ---------- 使用量取得 ----------


def count_reviews_total(db: Session, user_id: int) -> int:
    """Review の合計数（全期間）。"""
    return db.query(Review).filter(Review.user_id == user_id).count()


def count_review_chat_user_messages(db: Session, user_id: int) -> int:
    """講評チャットスレッド内の user ロールの Message 合計。"""
    return (
        db.query(Message.id)
        .join(Thread, Message.thread_id == Thread.id)
        .filter(Thread.user_id == user_id, Thread.type == "review_chat", Message.role == "user")
        .count()
    )


def count_free_chat_user_messages(db: Session, user_id: int) -> int:
    """フリーチャットスレッド内の user ロールの Message 合計。"""
    return (
        db.query(Message.id)
        .join(Thread, Message.thread_id == Thread.id)
        .filter(Thread.user_id == user_id, Thread.type == "free_chat", Message.role == "user")
        .count()
    )


def get_non_review_cost_yen_total(db: Session, user_id: int) -> Decimal:
    """Review 以外の LlmRequest の cost_yen 合計（全期間）。"""
    row = (
        db.query(func.coalesce(func.sum(LlmRequest.cost_yen), 0).label("total"))
        .filter(
            LlmRequest.user_id == user_id,
            LlmRequest.feature_type != "review",
        )
        .first()
    )
    if not row or row.total is None:
        return Decimal("0")
    return Decimal(str(row.total))


def count_recent_review_success_sessions(db: Session, user_id: int, study_date: str) -> int:
    """復習問題生成の成功セッション数（指定 study_date 内）。"""
    from .models import RecentReviewProblemSession
    return (
        db.query(RecentReviewProblemSession.id)
        .filter(
            RecentReviewProblemSession.user_id == user_id,
            RecentReviewProblemSession.study_date == study_date,
            RecentReviewProblemSession.status == "success",
        )
        .count()
    )


def _get_current_study_date_4am() -> str:
    return get_study_date_4am(datetime.now(ZoneInfo("UTC")))


# ---------- 制限チェック（超過時は HTTPException 429） ----------


def check_review_limit(db: Session, user: User) -> None:
    """講評作成: 全期間の Review 数が上限以内か。"""
    plan = get_user_plan(db, user)
    limits = get_plan_limits(plan)
    max_total = limits.get(LIMIT_MAX_REVIEWS_TOTAL)
    if max_total is None:
        return
    n = count_reviews_total(db, user.id)
    if n >= max_total:
        raise HTTPException(
            status_code=429,
            detail=f"講評の作成回数が上限（{max_total}回）に達しています。",
        )


def check_review_chat_message_limit(db: Session, user: User, *, after_add: int = 0) -> None:
    """講評チャット: user メッセージ数が上限以内か。after_add はこのリクエストで増える数（通常1）。"""
    plan = get_user_plan(db, user)
    limits = get_plan_limits(plan)
    max_total = limits.get(LIMIT_MAX_REVIEW_CHAT_MESSAGES_TOTAL)
    if max_total is None:
        return
    n = count_review_chat_user_messages(db, user.id) + after_add
    if n > max_total:
        raise HTTPException(
            status_code=429,
            detail=f"講評チャットのメッセージ数が上限（{max_total}件）に達しています。",
        )


def check_free_chat_message_limit(db: Session, user: User, *, after_add: int = 0) -> None:
    """フリーチャット: user メッセージ数が上限以内か。"""
    plan = get_user_plan(db, user)
    limits = get_plan_limits(plan)
    max_total = limits.get(LIMIT_MAX_FREE_CHAT_MESSAGES_TOTAL)
    if max_total is None:
        return
    n = count_free_chat_user_messages(db, user.id) + after_add
    if n > max_total:
        raise HTTPException(
            status_code=429,
            detail=f"フリーチャットのメッセージ数が上限（{max_total}件）に達しています。",
        )


def check_non_review_cost_limit(db: Session, user: User) -> None:
    """Review 以外の合計コスト（円）が上限以内か。"""
    plan = get_user_plan(db, user)
    limits = get_plan_limits(plan)
    max_yen = limits.get(LIMIT_MAX_NON_REVIEW_COST_YEN_TOTAL)
    if max_yen is None:
        return
    total = get_non_review_cost_yen_total(db, user.id)
    if total >= Decimal(str(max_yen)):
        raise HTTPException(
            status_code=429,
            detail=f"LLM利用額が上限（{max_yen}円）に達しています。（Review以外の合計）",
        )


def get_recent_review_daily_limit(db: Session, user: User) -> Optional[int]:
    """復習問題の日次上限。プランで未設定なら None（従来の定数にフォールバック）。"""
    plan = get_user_plan(db, user)
    limits = get_plan_limits(plan)
    return limits.get(LIMIT_RECENT_REVIEW_DAILY)


def check_recent_review_daily_limit(db: Session, user: User) -> None:
    """復習問題生成: 本日の成功セッション数が日次上限以内か。"""
    limit = get_recent_review_daily_limit(db, user)
    if limit is None:
        return
    sd = _get_current_study_date_4am()
    used = count_recent_review_success_sessions(db, user.id, sd)
    if used >= limit:
        raise HTTPException(
            status_code=429,
            detail="本日の制限に達しました。",
        )
