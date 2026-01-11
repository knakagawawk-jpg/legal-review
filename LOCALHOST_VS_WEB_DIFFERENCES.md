# localhostとWeb（Docker環境）での挙動の違い

## 概要

このドキュメントは、`localhost`（ローカル開発環境）と`Web`（Docker環境での本番ビルド）での挙動の違いを整理したものです。

---

## 1. Next.jsの実行モードの違い

### localhost（ローカル開発環境）

- **実行方法**: `npm run dev` または `next dev`
- **モード**: 開発モード（Development Mode）
- **特徴**:
  - ホットリロード（コード変更を自動反映）
  - ソースマップが有効（デバッグしやすい）
  - エラーメッセージが詳細
  - 最適化が最小限（ビルドが高速）
  - ポート: `http://localhost:3000`

### Web（Docker環境、本番ビルド）

- **実行方法**: `npm run build` → `node server.js`
- **モード**: 本番モード（Production Mode）
- **特徴**:
  - 最適化されたコード（バンドルサイズが小さい）
  - ソースマップなし（本番環境では不要）
  - エラーメッセージが簡潔（セキュリティ上の理由）
  - standalone出力（依存関係を最小化）
  - ポート: `http://web:3000`（Dockerネットワーク内）
  - 公開: `http://localhost:8080`（proxy経由）または `https://your-domain`（本番）

---

## 2. 環境変数の違い

### localhost（ローカル開発環境）

**環境変数の読み込み元:**
- `.env.local`（`web_next/.env.local`）
- `.env.development`（存在する場合）
- `.env`
- システム環境変数

**設定値（推奨）:**
```bash
# web_next/.env.local（ローカル開発用）
BACKEND_INTERNAL_URL=http://localhost:8000
REVIEW_TIMEOUT_MS=240000
```

**FastAPIへの接続:**
- `http://localhost:8000` を使用
- 同じマシン上でFastAPIが起動している必要がある
- `docker compose up backend` でFastAPIを起動、またはローカルで `uvicorn app.main:app` を実行

### Web（Docker環境）

**環境変数の読み込み元:**
- Docker Composeの `environment` セクション
- `.env` ファイル（docker-compose.ymlで読み込まれる）
- ビルド時に設定された環境変数

**設定値（docker-compose.yml）:**
```yaml
web:
  environment:
    - BACKEND_INTERNAL_URL=${BACKEND_INTERNAL_URL:-http://backend:8000}
    - REVIEW_TIMEOUT_MS=${REVIEW_TIMEOUT_MS:-240000}
    - NODE_ENV=production
```

**FastAPIへの接続:**
- `http://backend:8000` を使用（Dockerコンテナ名）
- Dockerネットワーク内で通信
- 外部からは直接アクセス不可（proxy経由のみ）

---

## 3. ネットワーク構成の違い

### localhost（ローカル開発環境）

```
[ブラウザ]
  ↓ HTTP
[Next.js (localhost:3000)]
  ↓ HTTP
[FastAPI (localhost:8000)]
```

- すべて同じマシン上で動作
- `localhost` または `127.0.0.1` でアクセス
- ポートの競合に注意（3000, 8000が使用中でないこと）

### Web（Docker環境）

```
[ブラウザ]
  ↓ HTTPS/HTTP
[Caddy (proxy:80/443)]
  ↓ HTTP (Dockerネットワーク)
[Next.js (web:3000)]
  ↓ HTTP (Dockerネットワーク)
[FastAPI (backend:8000)]
```

- Dockerコンテナ間で通信
- コンテナ名で解決（`backend`, `web`）
- 外部からは `proxy` 経由のみアクセス可能
- ポート: ローカル開発用は `8080:80`、本番は `80/443`

---

## 4. API Route Handlerの動作の違い

### localhost（ローカル開発環境）

**コード例（`web_next/app/api/review/route.ts`）:**
```typescript
const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://backend:8000"
// ローカル開発時は http://localhost:8000 を使用

const response = await fetch(`${BACKEND_URL}/v1/review`, {
  // ...
})
```

**動作:**
- 開発サーバーで直接実行（TypeScriptがトランスパイルされる）
- エラーメッセージが詳細（スタックトレースが表示される）
- ホットリロードで変更が即座に反映

### Web（Docker環境、本番ビルド）

**コード例（同じファイル）:**
```typescript
const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://backend:8000"
// Docker環境では http://backend:8000 を使用（コンテナ名で解決）

const response = await fetch(`${BACKEND_URL}/v1/review`, {
  // ...
})
```

**動作:**
- ビルド時にJavaScriptにコンパイル
- 本番環境で実行（最適化されたコード）
- エラーメッセージが簡潔（スタックトレースは制限される）
- コード変更は再ビルドが必要

---

## 5. ビルドプロセスの違い

### localhost（ローカル開発環境）

**実行コマンド:**
```bash
cd web_next
npm run dev
```

**ビルドプロセス:**
- ビルドは不要（開発モード）
- TypeScriptはオンザフライでコンパイル
- ページは必要に応じてコンパイル（オンデマンド）

### Web（Docker環境）

**実行コマンド（Dockerfile.nextjs内）:**
```bash
npm run build  # ビルドステージ
node server.js  # 実行ステージ
```

**ビルドプロセス:**
1. **依存関係のインストール** (`npm ci`)
2. **Next.jsのビルド** (`npm run build`)
   - すべてのページを事前にビルド
   - 最適化（コード分割、ツリーシェイキング）
   - standalone出力を生成
3. **本番実行** (`node server.js`)
   - standalone出力を実行
   - 静的ファイルとAPI Route Handlerを提供

**ビルド時間:**
- 初回ビルド: 数分かかる場合がある
- 依存関係の変更がない場合: 数十秒〜1分程度

---

## 6. パフォーマンスの違い

### localhost（ローカル開発環境）

- **起動時間**: 数秒
- **リクエスト応答**: 若干遅い（開発モードのため）
- **メモリ使用量**: 比較的多い（開発ツールが含まれる）
- **バンドルサイズ**: 大きい（最適化なし）

### Web（Docker環境、本番ビルド）

- **起動時間**: ビルド済みなので数秒（ビルド時間は別途必要）
- **リクエスト応答**: 高速（最適化されたコード）
- **メモリ使用量**: 少ない（最小限の依存関係）
- **バンドルサイズ**: 小さい（コード分割、最適化）

---

## 7. エラーハンドリングの違い

### localhost（ローカル開発環境）

**エラー表示:**
- 詳細なスタックトレース
- エラーが発生したファイル名と行番号
- ソースマップによる元のTypeScriptコードの表示
- 開発者向けのエラーメッセージ

**例:**
```
Error: Cannot read property 'id' of undefined
  at ReviewPage (web_next/app/review/[id]/page.tsx:45:12)
  ...
```

### Web（Docker環境、本番ビルド）

**エラー表示:**
- 簡潔なエラーメッセージ
- スタックトレースは制限される（セキュリティ上の理由）
- 本番環境向けのエラーメッセージ

**例:**
```
Internal Server Error
```

**ログ:**
- サーバーログに詳細なエラーが記録される
- `docker compose logs web` で確認可能

---

## 8. キャッシュの違い

### localhost（ローカル開発環境）

- **Next.jsキャッシュ**: `.next/cache` に保存
- **開発モード**: キャッシュが無効化される場合がある
- **ホットリロード**: 変更があったファイルのみ再読み込み

### Web（Docker環境、本番ビルド）

- **Next.jsキャッシュ**: ビルド時に生成
- **本番モード**: キャッシュが有効（パフォーマンス向上）
- **コード変更**: 再ビルドが必要（`docker compose build web`）

---

## 9. 実際の挙動の違い（具体例）

### ケース1: FastAPIへの接続

**localhost:**
```typescript
// BACKEND_INTERNAL_URL=http://localhost:8000
fetch('http://localhost:8000/v1/review', ...)
// → 同じマシンの8000番ポートにアクセス
```

**Web（Docker環境）:**
```typescript
// BACKEND_INTERNAL_URL=http://backend:8000
fetch('http://backend:8000/v1/review', ...)
// → Dockerネットワーク内のbackendコンテナにアクセス
// → 外部からは直接アクセス不可
```

### ケース2: タイムアウト設定

**localhost:**
- `REVIEW_TIMEOUT_MS` が設定されていない場合、デフォルト値（240000ms）を使用
- 開発中は短いタイムアウトでも動作確認可能

**Web（Docker環境）:**
- `REVIEW_TIMEOUT_MS` は環境変数で設定
- 本番環境では150秒の生成時間を考慮して設定

### ケース3: 環境変数の読み込み

**localhost:**
- `.env.local` が優先される
- `NEXT_PUBLIC_*` プレフィックスがない環境変数はサーバー側でのみ利用可能

**Web（Docker環境）:**
- Docker Composeの `environment` セクションから読み込まれる
- ビルド時と実行時で環境変数が異なる場合がある（注意が必要）

---

## 10. 開発時の推奨事項

### localhostでの開発

1. **`.env.local` を作成:**
   ```bash
   # web_next/.env.local
   BACKEND_INTERNAL_URL=http://localhost:8000
   REVIEW_TIMEOUT_MS=240000
   ```

2. **FastAPIを起動:**
   ```bash
   # 別のターミナルで
   cd law-review
   docker compose up backend
   # または
   uvicorn app.main:app --reload
   ```

3. **Next.jsを起動:**
   ```bash
   cd web_next
   npm run dev
   ```

4. **アクセス:**
   - `http://localhost:3000` でNext.js UIにアクセス
   - FastAPIは `http://localhost:8000` で利用可能

### Docker環境でのテスト

1. **`.env` ファイルを設定:**
   ```bash
   BACKEND_INTERNAL_URL=http://backend:8000
   REVIEW_TIMEOUT_MS=240000
   ```

2. **Docker Composeで起動:**
   ```bash
   docker compose --profile local up -d --build
   ```

3. **アクセス:**
   - `http://localhost:8080` でNext.js UIにアクセス（proxy経由）

---

## 11. トラブルシューティング

### localhostでFastAPIに接続できない

**原因:**
- FastAPIが起動していない
- ポートが異なる（8000以外）
- `BACKEND_INTERNAL_URL` が正しく設定されていない

**解決方法:**
```bash
# FastAPIの起動を確認
curl http://localhost:8000/health

# 環境変数を確認
cd web_next
cat .env.local
```

### Docker環境でFastAPIに接続できない

**原因:**
- `backend` コンテナが起動していない
- Dockerネットワークの問題
- 環境変数 `BACKEND_INTERNAL_URL` が設定されていない

**解決方法:**
```bash
# コンテナの状態を確認
docker compose ps

# backendコンテナ内でヘルスチェック
docker compose exec backend curl -f http://localhost:8000/health

# webコンテナ内からbackendにアクセスできるか確認
docker compose exec web wget -O- http://backend:8000/health

# 環境変数を確認
docker compose exec web printenv | grep BACKEND_INTERNAL_URL
```

### 本番ビルドでエラーが発生する

**原因:**
- ビルド時の環境変数が不足
- TypeScriptの型エラー
- 依存関係の問題

**解決方法:**
```bash
# ビルドログを確認
docker compose build web

# 型チェックを実行
cd web_next
npm run build

# 依存関係を再インストール
rm -rf node_modules package-lock.json
npm install
```

---

## まとめ

| 項目 | localhost（開発環境） | Web（Docker環境、本番ビルド） |
|------|---------------------|---------------------------|
| 実行モード | 開発モード | 本番モード |
| 起動コマンド | `npm run dev` | `npm run build` → `node server.js` |
| FastAPI接続 | `http://localhost:8000` | `http://backend:8000` |
| 環境変数 | `.env.local` | Docker Compose `environment` |
| ビルド | 不要（開発モード） | 必要（本番ビルド） |
| パフォーマンス | 低速（開発ツール含む） | 高速（最適化済み） |
| エラーメッセージ | 詳細 | 簡潔 |
| ホットリロード | あり | なし（再ビルド必要） |
| アクセス方法 | `http://localhost:3000` | `http://localhost:8080`（proxy経由） |

**推奨:**
- **開発時**: localhostで開発（`npm run dev`）
- **テスト時**: Docker環境で動作確認（`docker compose --profile local up`）
- **本番デプロイ**: Docker環境で本番ビルド（`docker compose --profile production up --build`）
