# 「Authentication is not enabled」エラーの解決方法

## 🔍 エラーの原因

エラーメッセージ: `Error: Authentication is not enabled`

このエラーは、バックエンド（FastAPI）で`AUTH_ENABLED=false`になっているか、環境変数が正しく読み込まれていない場合に発生します。

## ✅ 解決手順

### Step 1: `.env`ファイルの確認

プロジェクトルート（`law-review/.env`）に以下が設定されているか確認：

```env
AUTH_ENABLED=true
GOOGLE_CLIENT_ID=あなたの実際のクライアントID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=あなたの実際のクライアントシークレット
SECRET_KEY=適当な長い文字列
```

**重要:**
- `AUTH_ENABLED=true`（`false`ではない）
- `GOOGLE_CLIENT_ID`が設定されている
- 値にスペースや改行が含まれていない

### Step 2: Docker Composeの再起動

環境変数を変更した後は、**必ずDocker Composeを再起動**してください：

```bash
# コンテナを停止
docker compose --profile local down

# 再度起動
docker compose --profile local up --build
```

### Step 3: バックエンドのログを確認

バックエンドコンテナのログを確認して、環境変数が正しく読み込まれているか確認：

```bash
# バックエンドのログを確認
docker compose logs backend | grep -i auth

# または、すべてのログを確認
docker compose logs backend
```

**期待されるログ:**
- `AUTH_ENABLED=True`が表示される
- `GOOGLE_CLIENT_ID`が設定されている

**問題がある場合のログ:**
- `Authentication attempt but AUTH_ENABLED is False`
- `GOOGLE_CLIENT_ID is not set`

### Step 4: 環境変数の確認（コンテナ内）

コンテナ内で環境変数が正しく設定されているか確認：

```bash
# バックエンドコンテナ内で環境変数を確認
docker compose exec backend printenv | grep AUTH_ENABLED
docker compose exec backend printenv | grep GOOGLE_CLIENT_ID
```

**期待される出力:**
```
AUTH_ENABLED=true
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
```

## 🔧 よくある問題と解決方法

### 問題1: `.env`ファイルが存在しない

**解決方法:**
プロジェクトルート（`law-review/.env`）にファイルを作成し、必要な環境変数を設定してください。

### 問題2: `.env`ファイルの値が間違っている

**確認ポイント:**
- `AUTH_ENABLED=true`（大文字小文字は関係ないが、`true`である必要がある）
- `GOOGLE_CLIENT_ID`の値が正しい（スペースや改行が含まれていない）
- 値の前後に余分なスペースがない

### 問題3: Docker Composeを再起動していない

**解決方法:**
環境変数を変更した後は、必ずDocker Composeを再起動してください：

```bash
docker compose --profile local down
docker compose --profile local up --build
```

### 問題4: `.env`ファイルの場所が間違っている

**正しい場所:**
```
law-review/.env  ← プロジェクトルート
```

**間違った場所:**
```
law-review/web_next/.env  ← これは間違い（Next.js用ではない）
```

## 📋 確認チェックリスト

- [ ] `law-review/.env`ファイルが存在する
- [ ] `AUTH_ENABLED=true`が設定されている
- [ ] `GOOGLE_CLIENT_ID`が設定されている（値が正しい）
- [ ] `GOOGLE_CLIENT_SECRET`が設定されている
- [ ] `SECRET_KEY`が設定されている
- [ ] Docker Composeを再起動した
- [ ] バックエンドのログで`AUTH_ENABLED=True`が確認できる

## 💡 デバッグのヒント

### バックエンドのヘルスチェック

```bash
# バックエンドのヘルスチェックエンドポイントを確認
curl http://localhost:8000/health
```

**期待されるレスポンス:**
```json
{
  "status": "ok",
  "auth_enabled": true
}
```

`auth_enabled`が`false`の場合、環境変数が正しく読み込まれていません。

### 環境変数の確認（コンテナ内）

```bash
# バックエンドコンテナ内で環境変数を確認
docker compose exec backend printenv | grep -E "AUTH_ENABLED|GOOGLE_CLIENT_ID"
```

## 📝 まとめ

**「Authentication is not enabled」エラーは、`AUTH_ENABLED=false`または環境変数が読み込まれていないことが原因です。**

**解決方法:**
1. ✅ `law-review/.env`ファイルに`AUTH_ENABLED=true`を設定
2. ✅ `GOOGLE_CLIENT_ID`と`GOOGLE_CLIENT_SECRET`を設定
3. ✅ Docker Composeを再起動
4. ✅ バックエンドのログで確認

最も可能性が高いのは「Docker Composeを再起動していない」ことです。環境変数を変更した後は、必ず再起動してください。
