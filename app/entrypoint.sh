#!/bin/bash
set -e

echo "=== Database Initialization Script ==="

# threads/messagesテーブルのマイグレーション（必要に応じて）
echo "Running threads/messages migration..."
if ! python3 /app/app/migrate_threads_tables.py; then
    echo "WARNING: Threads migration failed, but continuing..."
fi

# problems.subject を数字化（1-18）するマイグレーション（後方互換）
echo "Running problems.subject migration..."
if ! python3 /app/app/migrate_problem_subject_to_int.py; then
    echo "WARNING: problems.subject migration failed, but continuing..."
fi

# ノートDBマイグレーション（科目別ノート対応）
echo "Running note DB migration..."
if ! python3 /app/app/migrate_note_db.py; then
    echo "WARNING: Note DB migration failed, but continuing..."
fi

# reviews / user_review_history マイグレーション（旧dev.db互換）
echo "Running reviews migration..."
if ! python3 /app/app/migrate_reviews_tables.py; then
    echo "WARNING: Reviews migration failed, but continuing..."
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
