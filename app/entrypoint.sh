#!/bin/bash
set -e

echo "=== Database Initialization Script ==="

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
