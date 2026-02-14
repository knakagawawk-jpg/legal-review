#!/usr/bin/env python3
"""
指定ユーザーにサブスクリプションプランを設定するスクリプト

使用方法:
    # 1. プランをシードしてから実行
    python scripts/seed_beta_plan.py  # またはアプリ起動時に自動実行
    python scripts/set_user_plan.py note.shihoushiken@gmail.com planfordevelopper

    # データベースを指定する場合
    python scripts/set_user_plan.py note.shihoushiken@gmail.com planfordevelopper --database sqlite:////data/dev.db
"""
import sys
import os
import argparse
from datetime import datetime, timezone
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import User, SubscriptionPlan, UserSubscription


def set_user_plan(email: str, plan_code: str, database_url: str = None) -> bool:
    """指定メールアドレスのユーザーにプランを設定（無期限のUserSubscriptionを作成）"""
    if database_url is None:
        database_url = os.getenv("DATABASE_URL", "sqlite:///./data/dev.db")

    engine = create_engine(
        database_url,
        connect_args={"check_same_thread": False} if "sqlite" in database_url else {},
    )
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"[ERROR] ユーザー '{email}' が見つかりません。")
            return False

        plan = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.plan_code == plan_code,
            SubscriptionPlan.is_active == True,
        ).first()
        if not plan:
            print(f"[ERROR] プラン '{plan_code}' が見つかりません。")
            print("  先に python -m app.seed_beta_plan を実行してプランを投入してください。")
            return False

        # 既存のアクティブなサブスクを無効化
        db.query(UserSubscription).filter(
            UserSubscription.user_id == user.id,
            UserSubscription.is_active == True,
        ).update({"is_active": False})

        # 新規サブスクリプションを作成（無期限: expires_at=None）
        now = datetime.now(timezone.utc)
        sub = UserSubscription(
            user_id=user.id,
            plan_id=plan.id,
            is_active=True,
            started_at=now,
            expires_at=None,  # 無期限
            payment_method="admin_grant",
            payment_id=f"admin_{user.id}_{int(now.timestamp())}",
        )
        db.add(sub)
        db.commit()

        print(f"[SUCCESS] ユーザー '{email}' にプラン '{plan.name}' ({plan_code}) を設定しました。")
        print(f"   ユーザーID: {user.id}")
        print(f"   プランID: {plan.id}")
        print(f"   無期限（expires_at: なし）")
        return True

    except Exception as e:
        db.rollback()
        print(f"[ERROR] エラー: {str(e)}")
        return False
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(
        description="ユーザーにサブスクリプションプランを設定"
    )
    parser.add_argument("email", help="対象ユーザーのメールアドレス")
    parser.add_argument(
        "plan_code",
        help="プランコード（例: planfordevelopper, basic_plan, high_plan）",
    )
    parser.add_argument(
        "--database",
        help="データベースURL（例: sqlite:////data/dev.db）",
        default=None,
    )
    args = parser.parse_args()

    success = set_user_plan(args.email, args.plan_code, args.database)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
