import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from typing import Generator

# 環境変数から取得、なければデフォルト値（ローカル開発用）
# 旧: sqlite:///./dev.db だと起動ディレクトリ依存で別DBを作ってしまうため、
# リポジトリ既定の data/dev.db をデフォルトにする。
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/dev.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # SQLite用
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator:
    """
    データベースセッションを取得する依存関数
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
