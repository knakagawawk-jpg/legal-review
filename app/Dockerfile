FROM python:3.11-slim

WORKDIR /app

# システム依存関係のインストール（SQLite、PDF処理などに必要）
# curlはヘルスチェック用に追加
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# requirements.txtをコピーして依存関係をインストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコードをコピー
COPY app/ ./app/
COPY config/ ./config/
COPY prompts/ ./prompts/
COPY utils/ ./utils/

# インポートスクリプトとマイグレーションスクリプトをコピー
COPY import_json_to_db.py ./
COPY migrate_to_new_problem_structure.py ./

# エントリーポイントスクリプトをコピーして実行可能にする
COPY app/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# エントリーポイントを設定
ENTRYPOINT ["/app/entrypoint.sh"]

# FastAPIアプリケーションを起動
# --reloadなし（本番環境用）
# 0.0.0.0:8000でリッスン（Docker内からアクセス可能にするため）
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
