#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
本番DBの subscription_plans / user_subscriptions を確認するスクリプト。
使い方:
  # 本番サーバー上で .env に DATABASE_URL=sqlite:////data/prod.db を設定した状態で:
  python3 scripts/check_prod_plans.py

  # または DATABASE_URL を直接指定:
  DATABASE_URL=sqlite:////data/prod.db python3 scripts/check_prod_plans.py
"""
import os
import sys
from pathlib import Path

# プロジェクトルートを path に追加
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# 環境変数が未設定なら本番用の例を表示
if not os.getenv("DATABASE_URL"):
    print("警告: DATABASE_URL が未設定です。例:")
    print("  export DATABASE_URL=sqlite:////data/prod.db")
    print("  python3 scripts/check_prod_plans.py")
    print()

from app.db import SessionLocal
from app.models import SubscriptionPlan, UserSubscription


def main():
    db = SessionLocal()
    try:
        print("=== subscription_plans ===")
        plans = db.query(SubscriptionPlan).order_by(SubscriptionPlan.display_order).all()
        if not plans:
            print("  レコードなし（Stripe Webhook で basic_plan 等が更新されません）")
        else:
            for p in plans:
                print(f"  id={p.id} plan_code={p.plan_code!r} name={p.name!r} is_active={p.is_active}")
        print()
        print("=== user_subscriptions (直近10件) ===")
        subs = (
            db.query(UserSubscription)
            .order_by(UserSubscription.started_at.desc())
            .limit(10)
            .all()
        )
        if not subs:
            print("  レコードなし")
        else:
            for s in subs:
                plan_code = s.plan.plan_code if s.plan else "?"
                print(f"  user_id={s.user_id} plan_code={plan_code} payment_id={s.payment_id} is_active={s.is_active} started_at={s.started_at}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
