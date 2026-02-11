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
    connect_args={
        "check_same_thread": False,  # SQLite用
        "timeout": 30,  # ロック時は最大30秒待ってから書き込み（競合時の503を減らす）
    },
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


def get_db_session_for_url(database_url: str) -> Generator:
    """
    指定されたデータベースURLでセッションを取得する関数（管理者用）
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # SQLiteの場合、ファイルパスを抽出して存在確認
        if "sqlite" in database_url:
            # sqlite:////data/dev.db -> /data/dev.db
            # sqlite:///./data/dev.db -> ./data/dev.db
            if database_url.startswith("sqlite:////"):
                file_path = database_url.replace("sqlite:////", "/")
            elif database_url.startswith("sqlite:///./"):
                file_path = database_url.replace("sqlite:///./", "./")
            elif database_url.startswith("sqlite:///"):
                file_path = database_url.replace("sqlite:///", "")
            else:
                file_path = database_url.replace("sqlite://", "")
            
            import os
            if not os.path.exists(file_path):
                logger.warning(f"Database file not found: {file_path} (URL: {database_url})")
                # ファイルが存在しない場合でもエンジンは作成する（新規作成される可能性があるため）
        
        # 新しいエンジンを作成
        sqlite_args = (
            {"check_same_thread": False, "timeout": 30} if "sqlite" in database_url else {}
        )
        temp_engine = create_engine(
            database_url,
            connect_args=sqlite_args,
        )
        TempSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=temp_engine)
        db = TempSessionLocal()
        try:
            # 接続テスト
            from sqlalchemy import text
            db.execute(text("SELECT 1"))
            yield db
        finally:
            db.close()
            temp_engine.dispose()  # エンジンをクリーンアップ
    except Exception as e:
        logger.error(f"Failed to create database session for URL {database_url}: {str(e)}", exc_info=True)
        raise
