# プッシュ後の手順（本番環境での確認）

## 概要

GitHubにプッシュした後、本番環境（Web）で変更を確認する手順です。

---

## ステップ1: GitHubにプッシュ（ローカル）

```powershell
cd C:\Users\tvxqt\.shihou-zyuken2601\law-review
git push
```

---

## ステップ2: 本番サーバーで最新コードを取得

### SSHで本番サーバーに接続

```bash
ssh user@160.16.50.238
```

### プロジェクトディレクトリに移動

```bash
cd /path/to/law-review  # 実際のパスに置き換えてください
```

### GitHubから最新コードを取得

```bash
git pull origin main
```

---

## ステップ3: Next.jsアプリを再ビルド・再起動

### Next.js（web）を再ビルド

```bash
docker compose build web
```

**所要時間**: 1〜3分程度（変更内容による）

### コンテナを再起動

```bash
docker compose --profile production up -d web
```

または、すべてのサービスを再起動する場合：

```bash
docker compose --profile production up -d
```

---

## ステップ4: ログを確認（必要に応じて）

```bash
# Next.js（web）のログを確認
docker compose logs -f web

# すべてのサービスのログを確認
docker compose logs -f

# 最新50行のみ表示
docker compose logs --tail 50 web
```

### 正常なログの例

```
web-1  | ▲ Next.js 14.x.x
web-1  | - Local:        http://localhost:3000
web-1  | ✓ Ready in X.Xs
```

---

## ステップ5: Webで確認

### アクセス

1. ブラウザで `https://juristutor-ai.com` を開く
2. Basic認証でログイン
   - **ユーザー名**: `admin`
   - **パスワード**: `lawreviewHype0111`

### 確認項目

- ✅ 新しいページが表示されるか（例：`/dev`、`/free-chat`、`/short-answer`）
- ✅ サイドバーに新しいリンクが表示されるか
- ✅ ページが正常に動作するか
- ✅ エラーが発生していないか

---

## トラブルシューティング

### ビルドエラーが発生する場合

```bash
# ログを確認
docker compose logs web | tail -50

# キャッシュなしで再ビルド
docker compose build --no-cache web
docker compose --profile production up -d web
```

### コンテナが起動しない場合

```bash
# コンテナの状態を確認
docker compose ps

# ログを確認
docker compose logs web

# コンテナを削除して再作成
docker compose --profile production down
docker compose --profile production up -d --build web
```

### コードが反映されない場合

```bash
# GitHubから最新コードを取得しているか確認
git log --oneline -5

# 再ビルドが必要な場合
docker compose build web
docker compose --profile production up -d web
```

---

## まとめ

### 完全な手順（コピペ用）

```bash
# 1. 本番サーバーにSSH接続
ssh user@160.16.50.238

# 2. プロジェクトディレクトリに移動
cd /path/to/law-review

# 3. GitHubから最新コードを取得
git pull origin main

# 4. Next.jsを再ビルド・再起動
docker compose build web
docker compose --profile production up -d web

# 5. ログを確認（必要に応じて）
docker compose logs -f web
```

### 所要時間の目安

- **git pull**: 数秒
- **docker compose build web**: 1〜3分
- **docker compose up -d web**: 10〜30秒
- **合計**: 約2〜4分

---

## 注意事項

- ⚠️ `.env` ファイルはGit管理外（本番サーバーに直接存在）
- ⚠️ コード変更は必ずGitHubにプッシュすること
- ⚠️ 本番環境での直接編集は避ける（緊急時のみ）
- ⚠️ 再ビルド中はサービスが一時的に停止する可能性がある
