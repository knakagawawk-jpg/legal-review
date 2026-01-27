#!/usr/bin/env python3
"""
管理者権限を設定するスクリプト

使用方法:
    python scripts/set_admin.py <email> [--database <db_path>]
    
例:
    python scripts/set_admin.py note.shihoushiken@gmail.com
    python scripts/set_admin.py note.shihoushiken@gmail.com --database data/dev.db
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


def set_admin(email: str, database_url: str = None):
    """指定されたメールアドレスのユーザーを管理者に設定"""
    # データベースURLが指定されていない場合は環境変数から取得
    if database_url is None:
        database_url = os.getenv("DATABASE_URL", "sqlite:///./data/dev.db")
    
    # データベースエンジンを作成
    engine = create_engine(
        database_url,
        connect_args={"check_same_thread": False} if "sqlite" in database_url else {}
    )
    
    # セッションを作成
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    try:
        # ユーザーを検索
        user = db.query(User).filter(User.email == email).first()
        
        if not user:
            print(f"[INFO] メールアドレス '{email}' のユーザーが見つかりませんでした。")
            print("   新規ユーザーを作成して管理者権限を付与します...")
            
            # 新規ユーザーを作成
            user = User(
                email=email,
                name=None,
                is_active=True,
                is_admin=True  # 管理者として作成
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            
            print(f"[SUCCESS] ユーザー '{email}' を作成し、管理者権限を付与しました。")
            print(f"   ユーザーID: {user.id}")
            print(f"   名前: {user.name or '(未設定)'}")
            print(f"   アクティブ: {'はい' if user.is_active else 'いいえ'}")
            print(f"   管理者: はい")
            print("\n[注意] Google認証でログインする際に、このメールアドレスを使用してください。")
            return True
        
        # 既に管理者の場合は確認
        if user.is_admin:
            print(f"[INFO] ユーザー '{email}' は既に管理者権限を持っています。")
            return True
        
        # 管理者権限を付与
        user.is_admin = True
        db.commit()
        
        print(f"[SUCCESS] ユーザー '{email}' に管理者権限を付与しました。")
        print(f"   ユーザーID: {user.id}")
        print(f"   名前: {user.name or '(未設定)'}")
        print(f"   アクティブ: {'はい' if user.is_active else 'いいえ'}")
        return True
        
    except Exception as e:
        db.rollback()
        print(f"[ERROR] エラーが発生しました: {str(e)}")
        return False
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="ユーザーに管理者権限を付与")
    parser.add_argument("email", help="管理者権限を付与するユーザーのメールアドレス")
    parser.add_argument(
        "--database",
        help="データベースURL（例: sqlite:///./data/dev.db）",
        default=None
    )
    
    args = parser.parse_args()
    
    success = set_admin(args.email, args.database)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
