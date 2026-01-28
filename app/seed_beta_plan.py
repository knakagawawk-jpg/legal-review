# -*- coding: utf-8 -*-
"""
beta用 SubscriptionPlan を1件投入するスクリプト。
既に plan_code が存在する場合はスキップする。
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

BETA_PLAN_CODE = "beta-for-260128"
BETA_PLAN_NAME = "beta-for-260128"

BETA_LIMITS = {
    "max_reviews_total": 2,
    "max_review_chat_messages_total": 50,
    "max_free_chat_messages_total": 100,
    "recent_review_daily_limit": 1,
    "max_non_review_cost_yen_total": 200,
}


def seed_beta_plan():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.plan_code == BETA_PLAN_CODE
        ).first()
        if existing:
            logger.info(f"Plan '{BETA_PLAN_CODE}' already exists. Skipping.")
            return
        plan = SubscriptionPlan(
            plan_code=BETA_PLAN_CODE,
            name=BETA_PLAN_NAME,
            description="beta用プラン（全ユーザー対象・特段の手続きなし）",
            limits=json.dumps(BETA_LIMITS, ensure_ascii=False),
            price_monthly=None,
            price_yearly=None,
            features=json.dumps(["review_generation", "review_chat", "free_chat", "recent_review"], ensure_ascii=False),
            is_active=True,
            display_order=0,
        )
        db.add(plan)
        db.commit()
        logger.info(f"Created SubscriptionPlan: plan_code={BETA_PLAN_CODE}, name={BETA_PLAN_NAME}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_beta_plan()
