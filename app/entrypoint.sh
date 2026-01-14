#!/bin/bash
set -e

echo "=== Database Initialization Script ==="

# threads/messagesテーブルのマイグレーション（必要に応じて）
echo "Running threads/messages migration..."
if ! python3 /app/app/migrate_threads_tables.py; then
    echo "WARNING: Threads migration failed, but continuing..."
fi

# データベース初期化スクリプトを実行
echo "Running database initialization..."
if ! python3 /app/app/init_db.py; then
    echo "ERROR: Database initialization failed. Exiting."
    exit 1
fi

echo ""
echo "=== Initialization complete ==="
echo "Starting FastAPI application..."

# FastAPIアプリケーションを起動
exec "$@"
