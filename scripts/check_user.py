#!/usr/bin/env python3
"""
ユーザーを確認するスクリプト
"""
import sys
import os
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import User

database_url = os.getenv("DATABASE_URL", "sqlite:///./data/dev.db")
engine = create_engine(
    database_url,
    connect_args={"check_same_thread": False} if "sqlite" in database_url else {}
)

SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

try:
    users = db.query(User).all()
    print(f"データベース内のユーザー数: {len(users)}")
    print("\nユーザー一覧:")
    for user in users:
        admin_status = "[ADMIN]" if user.is_admin else ""
        active_status = "[ACTIVE]" if user.is_active else "[INACTIVE]"
        print(f"  ID: {user.id}, Email: {user.email}, Name: {user.name or '(未設定)'} {admin_status} {active_status}")
finally:
    db.close()
