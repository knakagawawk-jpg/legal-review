#!/usr/bin/env python3
"""
ユーザーIDで管理者権限を設定するスクリプト

使用方法:
    python scripts/set_admin_by_id.py <user_id> [--database <db_url>]
    
例:
    python scripts/set_admin_by_id.py 1
    python scripts/set_admin_by_id.py 1 --database sqlite:////data/dev.db
"""
import sys
import os
import argparse
from pathlib import Path

# プロジェクトルートをパスに追加
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import User


def set_admin_by_id(user_id: int, database_url: str = None):
    """指定されたユーザーIDのユーザーを管理者に設定"""
    # データベースURLが指定されていない場合は環境変数から取得
    if database_url is None:
        database_url = os.getenv("DATABASE_URL", "sqlite:///./data/dev.db")
    
    print(f"[INFO] データベースURL: {database_url}")
    
    # データベースエンジンを作成
    connect_args = {}
    if "sqlite" in database_url:
        connect_args["check_same_thread"] = False
    
    engine = create_engine(database_url, connect_args=connect_args)
    
    # セッションを作成
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    try:
        # ユーザーを検索
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            print(f"[ERROR] ユーザーID {user_id} のユーザーが見つかりませんでした。")
            return False
        
        # 既に管理者の場合は確認
        if user.is_admin:
            print(f"[INFO] ユーザーID {user_id} ({user.email}) は既に管理者権限を持っています。")
            print(f"   ユーザーID: {user.id}")
            print(f"   メールアドレス: {user.email}")
            print(f"   名前: {user.name or '(未設定)'}")
            print(f"   アクティブ: {'はい' if user.is_active else 'いいえ'}")
            print(f"   管理者: はい")
            return True
        
        # 管理者権限を付与
        user.is_admin = True
        db.commit()
        db.refresh(user)
        
        print(f"[SUCCESS] ユーザーID {user_id} ({user.email}) に管理者権限を付与しました。")
        print(f"   ユーザーID: {user.id}")
        print(f"   メールアドレス: {user.email}")
        print(f"   名前: {user.name or '(未設定)'}")
        print(f"   アクティブ: {'はい' if user.is_active else 'いいえ'}")
        print(f"   管理者: はい")
        return True
        
    except Exception as e:
        db.rollback()
        print(f"[ERROR] エラーが発生しました: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="ユーザーIDで管理者権限を付与")
    parser.add_argument("user_id", type=int, help="管理者権限を付与するユーザーID")
    parser.add_argument(
        "--database",
        help="データベースURL（例: sqlite:////data/dev.db）",
        default=None
    )
    
    args = parser.parse_args()
    
    success = set_admin_by_id(args.user_id, args.database)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
