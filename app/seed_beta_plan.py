# -*- coding: utf-8 -*-
"""
SubscriptionPlan（PlanA/PlanB/PlanC）を投入/更新するスクリプト。
既存 plan_code がある場合は指定内容で更新する。
"""
import json
import logging
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.db import SessionLocal, engine
from app.models import Base, SubscriptionPlan

PLAN_DEFINITIONS = [
    {
        "plan_code": "basic_plan",  # PlanA
        "name": "PlanA",
        "description": "レビュー8回 / フリーチャット200回 / 復習問題生成1日3回 / レビューチャット200回 / 合計コスト900円まで",
        "limits": {
            "max_reviews_total": 8,
            "max_review_chat_messages_total": 200,
            "max_free_chat_messages_total": 200,
            "recent_review_daily_limit": 3,
            "max_non_review_cost_yen_total": 900,
        },
        "display_order": 10,
    },
    {
        "plan_code": "first_month_fm_dm",  # PlanB
        "name": "PlanB",
        "description": "DMリンク登録の初月限定プラン（内容はPlanAと同一）",
        "limits": {
            "max_reviews_total": 8,
            "max_review_chat_messages_total": 200,
            "max_free_chat_messages_total": 200,
            "recent_review_daily_limit": 3,
            "max_non_review_cost_yen_total": 900,
        },
        "display_order": 20,
    },
    {
        "plan_code": "high_plan",  # PlanC
        "name": "PlanC",
        "description": "レビュー20回 / フリーチャット500回 / 復習問題生成1日5回 / レビューチャット500回 / 合計コスト2000円まで",
        "limits": {
            "max_reviews_total": 20,
            "max_review_chat_messages_total": 500,
            "max_free_chat_messages_total": 500,
            "recent_review_daily_limit": 5,
            "max_non_review_cost_yen_total": 2000,
        },
        "display_order": 30,
    },
]

DEFAULT_FEATURES = ["review_generation", "review_chat", "free_chat", "recent_review"]


def seed_subscription_plans():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        for p in PLAN_DEFINITIONS:
            existing = db.query(SubscriptionPlan).filter(
                SubscriptionPlan.plan_code == p["plan_code"]
            ).first()
            if existing:
                existing.name = p["name"]
                existing.description = p["description"]
                existing.limits = json.dumps(p["limits"], ensure_ascii=False)
                existing.features = json.dumps(DEFAULT_FEATURES, ensure_ascii=False)
                existing.is_active = True
                existing.display_order = p["display_order"]
                logger.info(f"Updated SubscriptionPlan: plan_code={p['plan_code']}, name={p['name']}")
            else:
                plan = SubscriptionPlan(
                    plan_code=p["plan_code"],
                    name=p["name"],
                    description=p["description"],
                    limits=json.dumps(p["limits"], ensure_ascii=False),
                    price_monthly=None,
                    price_yearly=None,
                    features=json.dumps(DEFAULT_FEATURES, ensure_ascii=False),
                    is_active=True,
                    display_order=p["display_order"],
                )
                db.add(plan)
                logger.info(f"Created SubscriptionPlan: plan_code={p['plan_code']}, name={p['name']}")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed_subscription_plans()
