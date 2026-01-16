# Next.jsローカル起動ガイド

## 前提条件

- Node.js 20以上
- Docker Desktop（Docker Compose使用時）

## ローカル開発（Docker Compose使用、推奨）

### 1. 環境変数ファイルの準備

```bash
# .env.exampleをコピー
cp .env.example .env

# .envファイルを編集
nano .env  # または notepad .env
```

最低限以下の設定が必要：

```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
BACKEND_INTERNAL_URL=http://backend:8000
DATABASE_URL=sqlite:////data/dev.db
REVIEW_TIMEOUT_MS=240000  # 講評生成のタイムアウト（ミリ秒、デフォルト: 240秒）
```

### 2. Docker Composeで起動

```bash
# localプロファイルで起動
docker compose --profile local up -d --build

# ログを確認
docker compose logs -f web
```

### 3. アクセス

- **URL**: http://localhost:8080
- Next.js UIが表示されるはずです

### 4. 動作確認

1. http://localhost:8080 にアクセス
2. `/review` ページが表示されることを確認
3. 問題を選択（または新規入力）
4. 答案を入力
5. 「講評を生成」ボタンをクリック
6. 講評が生成され、結果ページに遷移することを確認

## ローカル開発（Next.jsのみ、FastAPIは別途起動）

### 1. Next.jsの依存関係をインストール

```bash
cd web_next
npm install
```

### 2. 環境変数ファイルの準備

```bash
# web_next/.env.localを作成
cat > .env.local <<EOF
BACKEND_INTERNAL_URL=http://localhost:8000
EOF
```

### 3. Next.js開発サーバーを起動

```bash
npm run dev
```

### 4. アクセス

- **URL**: http://localhost:3000
- Next.js UIが表示されるはずです

**注意**: FastAPIは別途起動する必要があります（`uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`）

## トラブルシューティング

### コンテナが起動しない

```bash
# ログを確認
docker compose logs web

# コンテナを再ビルド
docker compose --profile local up -d --build --force-recreate web
```

### Next.jsのビルドエラー

```bash
# web_nextディレクトリで依存関係を再インストール
cd web_next
rm -rf node_modules package-lock.json
npm install
```

### API接続エラー

```bash
# backendコンテナが起動しているか確認
docker compose ps backend

# backendのヘルスチェック
docker compose exec backend curl http://localhost:8000/health

# webコンテナからbackendに接続できるか確認
docker compose exec web wget -O- http://backend:8000/health
```

### タイムアウトエラー（講評生成が150秒以上かかる場合）

Next.jsのRoute Handlerはデフォルトでタイムアウトが設定されていますが、`app/api/review/route.ts`で150秒のタイムアウトを設定しています。

それでもタイムアウトする場合は、`next.config.js`でタイムアウトを延長してください。
