# Web環境で見ながら開発を進める際のワークフロー

## 概要

本ドキュメントは、**本番環境（juristutor-ai.com）で動作しているWebアプリケーションを見ながら開発を進める際のワークフロー**を整理したものです。

**重要な前提:**
- 本番環境は `juristutor-ai.com` で動作中（HTTPS、Basic認証あり）
- Docker Compose環境（3コンテナ構成: backend, web, proxy）
- コード変更はGit管理しており、GitHubにpush済み

---

## 1. 現状の確認（2026-01-11時点）

### 環境構成

- **ドメイン**: `juristutor-ai.com`
- **IPアドレス**: `160.16.50.238`
- **証明書**: Let's Encrypt（有効期限: 2026-04-11まで）
- **Basic認証**: 有効（ユーザー名: `admin`、パスワード: `lawreviewHype0111`）

### Docker Compose構成

```yaml
services:
  backend: FastAPI (uvicorn) / 8000（内部）
  web: Next.js / 3000（内部）
  proxy: Caddy / 80,443 を外部公開（webへリバプロ、Basic認証あり）
```

**起動コマンド:**
```bash
docker compose --profile production up -d --build
```

### 現在の状態

- ✅ すべてのコンテナが healthy
- ✅ HTTPS証明書取得済み
- ✅ Basic認証が動作中
- ✅ HTTP → HTTPS リダイレクト
- ✅ Git（mainブランチ）と GitHub（origin/main）が同期済み

---

## 2. Webで見ながら開発を進める際の注意点

### ⚠️ 重要な注意事項

1. **`.env` ファイルはGit管理外**
   - 秘密情報（APIキー、Basic認証hash等）が含まれる
   - Gitにコミットしないこと

2. **本番環境への直接変更は避ける**
   - コード変更はローカルで行い、GitHub経由で反映
   - 本番環境での直接編集は推奨されない

3. **再ビルドが必要**
   - Next.js/FastAPIのコード変更は再ビルドが必要
   - `docker compose build` と `docker compose up -d` を実行

4. **Basic認証の設定**
   - Caddyfile.production にBasic認証が設定されている
   - パスワードhashの `$` は `$$` にエスケープが必要（docker-composeの環境変数展開を避けるため）

---

## 3. 開発フロー（推奨）

### フロー1: ローカル開発 → GitHub → 本番反映（推奨）

**ステップ1: ローカルで開発**
```bash
# ローカル環境でコードを編集
cd C:\Users\tvxqt\.shihou-zyuken2601\law-review

# ファイルを編集（例: web_next/app/review/page.tsx）
# ...

# 変更をコミット
git add .
git commit -m "変更内容の説明"

# GitHubにプッシュ
git push
```

**ステップ2: 本番環境でGitHubから取得**
```bash
# 本番サーバー（VPS）にSSH接続
ssh user@160.16.50.238

# プロジェクトディレクトリに移動
cd /path/to/law-review

# GitHubから最新のコードを取得
git pull origin main

# 変更があったサービスを再ビルド
docker compose build web  # Next.jsの変更の場合
docker compose build backend  # FastAPIの変更の場合

# コンテナを再起動
docker compose --profile production up -d

# ログを確認
docker compose logs -f web
```

**ステップ3: Webで動作確認**
- `https://juristutor-ai.com` にアクセス
- Basic認証（admin/lawreviewHype0111）でログイン
- 変更内容を確認

### フロー2: 本番環境で直接編集（緊急時のみ）

**⚠️ 注意: この方法は推奨されません。緊急時のみ使用してください。**

```bash
# 本番サーバーにSSH接続
ssh user@160.16.50.238

# ファイルを直接編集（例: nano, vim）
nano web_next/app/review/page.tsx

# 変更をビルド・反映
docker compose build web
docker compose --profile production up -d

# ⚠️ 重要な注意: 変更をGitHubに反映すること
# ローカルでgit pullして、変更をマージ
```

---

## 4. コード変更の反映方法（サービスごと）

### Next.js（web）の変更

**変更ファイル例:**
- `web_next/app/**/*.tsx`
- `web_next/app/**/*.ts`
- `web_next/components/**/*.tsx`
- `web_next/next.config.js`

**反映コマンド:**
```bash
# 本番サーバーで
cd /path/to/law-review
git pull origin main
docker compose build web
docker compose --profile production up -d web
docker compose logs -f web
```

**反映時間:**
- ビルド時間: 1〜3分程度（変更内容による）
- ダウンタイム: ほぼなし（コンテナの再起動時のみ数秒）

### FastAPI（backend）の変更

**変更ファイル例:**
- `app/**/*.py`
- `app/main.py`
- `app/llm_service.py`
- `app/models.py`
- `app/schemas.py`

**反映コマンド:**
```bash
# 本番サーバーで
cd /path/to/law-review
git pull origin main
docker compose build backend
docker compose --profile production up -d backend
docker compose logs -f backend
```

**反映時間:**
- ビルド時間: 30秒〜1分程度
- ダウンタイム: ほぼなし（コンテナの再起動時のみ数秒）

### 設定ファイルの変更

**変更ファイル例:**
- `docker-compose.yml`
- `Caddyfile.production`
- `.env`（⚠️ Git管理外、直接編集）

**反映コマンド:**
```bash
# docker-compose.yml の変更
git pull origin main
docker compose --profile production up -d --build

# Caddyfile.production の変更
git pull origin main
docker compose restart proxy
# または
docker compose exec proxy caddy reload --config /etc/caddy/Caddyfile

# .env の変更（⚠️ Git管理外）
nano .env  # 直接編集
docker compose --profile production up -d  # 再起動
```

---

## 5. 開発時の推奨事項

### ローカル開発を優先

**推奨:**
- コード変更はローカルで行う
- ローカルで動作確認してからGitHubにpush
- 本番環境は動作確認用として使用

**理由:**
- 本番環境でのビルドは時間がかかる
- エラーが発生した場合の影響が大きい
- ローカル開発の方が高速

### 本番環境での確認

**適切なタイミング:**
- ローカルで動作確認済みの変更を反映
- 本番環境特有の問題の確認
- パフォーマンスの確認

**注意:**
- 本番環境での直接編集は避ける
- 緊急時のみ直接編集、その後GitHubに反映

### Gitワークフロー

**推奨フロー:**
1. ローカルで変更
2. コミット（適切なメッセージ）
3. GitHubにpush
4. 本番環境で `git pull`
5. 再ビルド・再起動
6. 動作確認

**ブランチ戦略（将来的に検討）:**
- `main`: 本番環境
- `develop`: 開発環境
- `feature/*`: 機能追加

---

## 6. トラブルシューティング

### コード変更が反映されない

**原因:**
- 再ビルドしていない
- コンテナが再起動していない
- キャッシュが残っている

**解決方法:**
```bash
# 強制的に再ビルド（キャッシュなし）
docker compose build --no-cache web

# コンテナを再起動
docker compose --profile production up -d web

# ログを確認
docker compose logs -f web
```

### ビルドエラーが発生する

**確認事項:**
- ログを確認: `docker compose logs web`
- TypeScriptの型エラーがないか
- 依存関係の問題がないか

**解決方法:**
```bash
# ログを確認
docker compose logs web | tail -50

# ローカルでビルドを確認（Next.jsの場合）
cd web_next
npm run build
```

### Basic認証が動作しない

**原因:**
- Caddyfile.production の `$` が環境変数展開されている
- パスワードhashが正しく設定されていない

**解決方法:**
```bash
# Caddyfile.production を確認
cat Caddyfile.production

# パスワードhashの $ を $$ にエスケープ
# 例: $2a$14$... → $$2a$$14$$...

# Caddyを再起動
docker compose restart proxy

# ログを確認
docker compose logs proxy | grep -i basic
```

---

## 7. 開発効率を上げるためのヒント

### ローカル開発環境の活用

**Next.js（web）の開発:**
```bash
# ローカルで開発サーバーを起動
cd web_next
npm run dev
# → http://localhost:3000 でアクセス
```

**FastAPI（backend）の開発:**
```bash
# ローカルでFastAPIを起動
uvicorn app.main:app --reload
# → http://localhost:8000 でアクセス
```

**メリット:**
- ホットリロードで変更が即座に反映
- ビルド時間が不要
- エラーメッセージが詳細

### 本番環境での確認

**効率的な確認方法:**
1. ローカルで開発・動作確認
2. GitHubにpush
3. 本番環境で `git pull` → 再ビルド → 動作確認
4. 問題があればローカルに戻って修正

**頻繁な確認を避ける:**
- 本番環境での再ビルドは時間がかかる
- ローカルで十分にテストしてから本番反映

---

## 8. セキュリティに関する注意

### 秘密情報の管理

**`.env` ファイル:**
- Git管理外（`.gitignore` に含まれている）
- 本番環境でのみ存在
- ローカル開発時は `.env.example` をコピーして使用

**Basic認証のパスワード:**
- 現在のパスワード: `lawreviewHype0111`
- Caddyfile.production に hash として保存
- ハッシュの `$` は `$$` にエスケープが必要

### Git管理されるファイル

**安全にコミットできるファイル:**
- ソースコード（`.py`, `.tsx`, `.ts`）
- 設定ファイル（`docker-compose.yml`, `Caddyfile.production`）
- ドキュメント（`.md`）

**Git管理外のファイル:**
- `.env`（秘密情報）
- `dev.db`（データベース）
- `node_modules/`（依存関係）
- `.next/`（ビルド成果物）

---

## 9. まとめ

### Webで見ながら開発を進める際の推奨フロー

1. **ローカルで開発**
   - コードを編集
   - ローカルで動作確認（`npm run dev` など）

2. **GitHubにpush**
   - 変更をコミット
   - GitHubにpush

3. **本番環境で反映**
   - `git pull origin main`
   - `docker compose build [service]`
   - `docker compose --profile production up -d [service]`

4. **Webで動作確認**
   - `https://juristutor-ai.com` にアクセス
   - Basic認証でログイン
   - 変更内容を確認

### 注意事項

- ✅ `.env` はGit管理外（秘密情報を含む）
- ✅ コード変更はローカルで行う（本番環境での直接編集は避ける）
- ✅ 変更は必ずGitHubにpushする（履歴を残す）
- ✅ 再ビルドが必要（Next.js/FastAPIのコード変更時）
- ✅ Basic認証のパスワードhashの `$` は `$$` にエスケープ

**結論: Webで見ながら開発を進めることは問題ありませんが、ローカル開発を優先し、本番環境は動作確認用として使用することを推奨します。**
