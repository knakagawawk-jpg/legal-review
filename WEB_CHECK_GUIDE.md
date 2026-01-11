# Webでチェックする手順

## 概要

Next.jsアプリをWebで確認する方法を説明します。

## 方法1: ローカル環境で確認（推奨・高速）

### 手順

1. **Docker Composeで起動**
   ```powershell
   cd C:\Users\tvxqt\.shihou-zyuken2601\law-review
   docker compose --profile local up -d --build
   ```

2. **アクセス**
   - ブラウザで `http://localhost:8080` を開く
   - すべてのページ（講評生成、短答式試験、フリーチャット、開発用）にアクセス可能

3. **ログ確認（必要に応じて）**
   ```powershell
   docker compose logs -f web
   ```

4. **停止**
   ```powershell
   docker compose --profile local down
   ```

### メリット

- ✅ 高速（ローカルで動作）
- ✅ インターネット不要
- ✅ 安全（本番環境に影響なし）
- ✅ デバッグしやすい

---

## 方法2: 本番環境で確認（実際のWeb環境）

### 前提条件

- GitHubにコードがプッシュされている
- 本番サーバー（VPS）にSSHアクセス可能

### 手順

1. **ローカルで変更をコミット・プッシュ**
   ```powershell
   cd C:\Users\tvxqt\.shihou-zyuken2601\law-review
   git add .
   git commit -m "新しいページを実装"
   git push
   ```

2. **本番サーバーで最新コードを取得**
   ```bash
   # SSHで本番サーバーに接続
   ssh user@your-server-ip
   
   # プロジェクトディレクトリに移動
   cd /path/to/law-review
   
   # GitHubから最新コードを取得
   git pull origin main
   ```

3. **Next.jsアプリを再ビルド・再起動**
   ```bash
   # Next.js（web）を再ビルド
   docker compose build web
   
   # コンテナを再起動
   docker compose --profile production up -d web
   
   # ログを確認
   docker compose logs -f web
   ```

4. **Webでアクセス**
   - ブラウザで `https://juristutor-ai.com` を開く
   - Basic認証（admin / パスワード）でログイン
   - すべてのページにアクセス可能

### 注意事項

- ⚠️ 本番環境での再ビルドは時間がかかります（1〜3分程度）
- ⚠️ `.env` ファイルはGit管理外（本番サーバーに直接存在）
- ⚠️ コード変更は必ずGitHubにプッシュすること

---

## 現在の実装状況

### 実装済みページ

1. ✅ `/review` - 講評生成ページ
2. ✅ `/review/[id]` - 講評結果ページ
3. ✅ `/short-answer` - 短答式試験ページ
4. ✅ `/free-chat` - フリーチャットページ
5. ✅ `/dev` - 開発用ページ

### 未実装ページ

- `/your-page` - Your Page（過去の記録とノート）※実装不要

---

## トラブルシューティング

### ローカルで起動できない

**エラー: ポート8080が使用中**
```powershell
# ポート8080を使用しているプロセスを確認
Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue

# docker-compose.ymlを確認して、別のポートに変更
# 例: "8081:80" に変更
```

**エラー: Dockerが起動していない**
```powershell
# Docker Desktopが起動しているか確認
# Windows: Docker Desktopを起動
```

### ビルドエラーが発生する

**Next.jsのビルドエラー**
```powershell
# ログを確認
docker compose logs web

# ローカルでビルドを確認
cd web_next
npm install
npm run build
```

**TypeScriptエラー**
- エラーメッセージを確認
- 型定義を修正
- 再ビルド

### 本番環境でコードが反映されない

**原因: 再ビルドしていない**
```bash
# 必ず再ビルドが必要
docker compose build web
docker compose --profile production up -d web
```

**原因: Git pullしていない**
```bash
# GitHubから最新コードを取得
git pull origin main
```

---

## 推奨ワークフロー

1. **ローカルで開発・確認**
   - コードを編集
   - `docker compose --profile local up -d --build` でローカル確認
   - 問題なければ次のステップへ

2. **GitHubにプッシュ**
   - 変更をコミット
   - GitHubにプッシュ

3. **本番環境で確認（必要に応じて）**
   - 本番サーバーで `git pull`
   - 再ビルド・再起動
   - Webで確認

---

## まとめ

**ローカル環境で確認する場合:**
```powershell
cd C:\Users\tvxqt\.shihou-zyuken2601\law-review
docker compose --profile local up -d --build
# → http://localhost:8080 にアクセス
```

**本番環境で確認する場合:**
1. GitHubにプッシュ
2. 本番サーバーで `git pull`
3. `docker compose build web && docker compose --profile production up -d web`
4. `https://juristutor-ai.com` にアクセス
