#!/bin/bash
# dev / beta / 本番 の各DBにJSONをインポート（--update で既存を更新）
# 使用方法: ./scripts/import_to_all_envs.sh
# サーバー上で /opt/law-review から実行すること

set -e
cd "$(dirname "$0")/.."

echo "=== dev ==="
docker compose --profile dev run --rm \
  -v "$(pwd)/scripts:/app/scripts" \
  -v "$(pwd)/data:/app/data" \
  -e PYTHONPATH=/app \
  -e DATABASE_URL=sqlite:////data/dev.db \
  backend-dev \
  python3 /app/scripts/import_all_json_to_db.py --update

echo ""
echo "=== beta ==="
docker compose --profile beta run --rm \
  -v "$(pwd)/scripts:/app/scripts" \
  -v "$(pwd)/data:/app/data" \
  -e PYTHONPATH=/app \
  -e DATABASE_URL=sqlite:////data/beta.db \
  backend-beta \
  python3 /app/scripts/import_all_json_to_db.py --update

echo ""
echo "=== 本番 ==="
docker compose --profile production run --rm \
  -v "$(pwd)/scripts:/app/scripts" \
  -v "$(pwd)/data:/app/data" \
  -e PYTHONPATH=/app \
  -e DATABASE_URL=sqlite:////data/prod.db \
  backend \
  python3 /app/scripts/import_all_json_to_db.py --update

echo ""
echo "=== 完了 ==="
