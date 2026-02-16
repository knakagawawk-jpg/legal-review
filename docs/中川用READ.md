# 中川用 環境・起動ガイド

---

## 1. サーバー接続・作業ディレクトリ

```bash
ssh -i $HOME\.ssh\id_ed25519_sakura ubuntu@160.16.50.238
cd /opt/law-review
```

---

## 2. 環境一覧・接続先

| 環境 | プロファイル | envファイル | DB | ドメイン/アクセス先 |
|------|-------------|-------------|-----|---------------------|
| 本番 | production | .env | prod.db | https://juristutor-ai.com |
| β | beta | .env.beta | beta.db | https://beta.juristutor-ai.com |
| dev（サーバー） | dev | .env.dev2 | dev.db | https://dev.juristutor-ai.com |
| dev（ローカル） | dev | .env.dev1 | dev.db | http://localhost:8081 |
| local（フロントのみ） | local | .env | dev.db | http://localhost:8080 |

- **本番**: `.env` の `DATABASE_URL=sqlite:////data/prod.db` にすること。
- **Next.js単体（npm run dev）**: `web_next/.env.local` で `BACKEND_INTERNAL_URL=http://127.0.0.1:8000` を設定。

---

## 3. 本番環境（production）

- **ドメイン**: https://juristutor-ai.com

### 状態確認（任意）

```bash
docker compose --profile production ps
```

### 停止 → 再起動

```bash
docker compose --profile production down
docker compose --profile production up -d --force-recreate
```

### デプロイ（まとめてコピー用）

```bash
cd /opt/law-review
git pull origin main
docker compose --profile production build web backend
docker compose --profile production up -d --force-recreate
```

### 反映確認・ログ（任意）

```bash
docker image inspect $(docker inspect law-review-web --format '{{.Image}}') --format 'WEB Created={{.Created}}'
docker image inspect $(docker inspect law-review-backend --format '{{.Image}}') --format 'BE Created={{.Created}}'
docker compose --profile production logs --tail=80 web backend
```

---

## 4. βテスト環境（beta）

- **ドメイン**: https://beta.juristutor-ai.com  
- **初回**: `cp .env.beta.example .env.beta` して編集。

### 停止 → 再起動

```bash
docker compose --profile beta down
docker compose --profile beta up -d --force-recreate
```

### デプロイ（まとめてコピー用）

```bash
cd /opt/law-review
git pull origin main
docker compose --profile beta build web-beta backend-beta
docker compose --profile beta up -d --force-recreate
```

### 反映確認・ログ（任意）

```bash
docker image inspect $(docker inspect law-review-web-beta --format '{{.Image}}') --format 'WEB-BETA Created={{.Created}}'
docker image inspect $(docker inspect law-review-backend-beta --format '{{.Image}}') --format 'BE-BETA Created={{.Created}}'
docker compose --profile beta logs --tail=80 web-beta backend-beta
```

---

## 5. 開発環境（dev）

- **dev1（ローカル）**: `.env.dev1` → http://localhost:8081（Basic認証なし）
- **dev2（サーバー）**: `.env.dev2` → https://dev.juristutor-ai.com（Basic認証あり）
- **初回**: ローカルは `cp .env.dev1.example .env.dev1`、サーバーは `cp .env.dev2.example .env.dev2` して編集。

### 起動（推奨: スクリプト）

| 環境 | コマンド | アクセス先 |
|------|----------|------------|
| dev1（ローカル） | `.\scripts\dev1-up.ps1` | http://localhost:8081（拒否時は http://localhost:3000） |
| dev2（サーバー） | `.\scripts\dev2-up.ps1` | https://dev.juristutor-ai.com |

### 手動起動（PowerShell）

```powershell
# dev1（ローカル）
$env:DEV_ENV_FILE=".env.dev1"; $env:CADDYFILE_DEV_PATH="./Caddyfile.dev.local"; docker compose --profile dev up -d

# dev2（サーバー）
$env:DEV_ENV_FILE=".env.dev2"; docker compose --profile dev up -d
```

### 停止 → 再起動（dev）

```bash
docker compose --profile dev down
# 再起動時は上記「起動」のスクリプト or 手動コマンドを実行
# 例（サーバー）:
# $env:DEV_ENV_FILE=".env.dev2"; docker compose --profile dev up -d --force-recreate
```

### デプロイ（まとめてコピー用・サーバーで dev2 の場合）

```bash
cd /opt/law-review
git pull origin main
# 事前に DEV_ENV_FILE=.env.dev2 を export している前提
docker compose --profile dev build web-dev-server backend-dev
docker compose --profile dev up -d --force-recreate
```

### devローカルでよくあること

- **8000 が「古いVer」**: dev のバックエンドはコンテナ内のみ。フロントは 8081 または 3000 でアクセス。
- **8081 が接続拒否**: `.env.dev1` があるか確認 → `.\scripts\dev1-up.ps1` で起動 → `docker compose --profile dev ps` で backend-dev / web-dev-server / proxy-dev が running か確認。
- **3000 で Google 認証が利かない**: Google Cloud Console の「承認済みの JavaScript 生成元」に `http://localhost:3000`（および必要なら `http://localhost:8081`）を追加。

---

## 6. ローカル開発（local・フロントのみ）

```bash
docker compose --profile local up -d --build
```

- アクセス: http://localhost:8080

---

## 7. 全環境の停止・再起動まとめ

### 停止（環境ごと）

```bash
docker compose --profile production down
docker compose --profile beta down
docker compose --profile dev down
```

### 依存関係が怪しい時のクリーンビルド＋起動（まとめてコピー用）

```bash
# 本番
docker compose --profile production build --no-cache web backend
docker compose --profile production up -d --force-recreate

# β
docker compose --profile beta build --no-cache web-beta backend-beta
docker compose --profile beta up -d --force-recreate

# 開発（事前に DEV_ENV_FILE を設定推奨）
docker compose --profile dev build --no-cache web-dev-server backend-dev
docker compose --profile dev up -d --force-recreate
```

### ログ確認（フォロー表示）

```bash
docker compose --profile production logs -f
docker compose --profile beta logs -f
docker compose --profile dev logs -f
```

---

## 8. 本番のデバッグ（エラー時）

- **backend 状態**: `docker ps -a --filter "name=law-review-backend"`
- **backend ログ**: `docker logs law-review-backend --tail=100`
- **ヘルス**: `docker inspect law-review-backend --format '{{json .State.Health}}' | python3 -m json.tool`
- **DBスキーマエラー時**:  
  `docker exec law-review-backend python3 /app/app/migrate_grading_impression_to_official_questions.py`  
  または `docker compose --profile production restart backend`
- **web/proxy が起動していない**: backend が healthy になってから  
  `docker compose --profile production up -d web proxy` または `docker compose --profile production up -d --force-recreate`
- **接続拒否・SSL**: `docker compose --profile production ps`、`docker logs law-review-web --tail=50`、`docker logs law-review-proxy --tail=100`、`sudo ss -tlnp | grep -E ':(80|443)'`

---

## 9. DB：JSONインポート・確認

### サーバーで JSON を DB に追加

```bash
cd /opt/law-review
git pull origin main
```

- **本番（prod.db）**:
```bash
docker compose --profile production run --rm -v /opt/law-review/scripts:/app/scripts:ro -v /opt/law-review/data:/app/data -v /opt/law-review/config:/app/config:ro backend python /app/scripts/import_all_json_to_db.py
```
- **β（beta.db）**: 上記の `backend` → `backend-beta`
- **開発（dev.db）**: 上記の `backend` → `backend-dev`

- 特定年度のみ: `--years R4 R6` を末尾に追加。
- 上書き: `--update` を追加。

### DB にデータが入っているか確認（例: 本番）

```bash
docker exec -it law-review-backend sqlite3 /data/prod.db "SELECT id, shiken_type, nendo, subject_id, status FROM official_questions WHERE shiken_type='shihou' ORDER BY nendo DESC LIMIT 20;"
```

（βは `law-review-backend-beta` と `/data/beta.db`、開発は `law-review-backend-dev` と `/data/dev.db` に読み替え。）

---

## 10. nano の編集・保存・終了

- **起動**: `nano ファイル名` で編集開始。
- **編集**: 通常どおり入力。矢印キーで移動。
- **保存して終了**:  
  `Ctrl + O` → Enter で保存 → `Ctrl + X` で終了。
- **保存せずに終了**: `Ctrl + X` → 「Save modified buffer?」で `N`。
- **キャンセル**: `Ctrl + C` で現在の操作キャンセル。最下部の `^` は Ctrl を表す。
