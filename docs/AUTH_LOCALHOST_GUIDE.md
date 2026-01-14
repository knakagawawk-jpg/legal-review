# Localhostでの認証設定ガイド

## Localhostでも認証は必要ですか？

### 推奨設定

**開発環境（Localhost）:**
- `AUTH_ENABLED=false` - 認証なしで開発を進める（推奨）
- 開発中は認証をスキップして、機能実装に集中

**本番環境:**
- `AUTH_ENABLED=true` - 認証を必須にする
- ユーザーデータの保護とセキュリティのため

### 認証の動作

#### AUTH_ENABLED=false の場合（デフォルト）

- ✅ すべてのエンドポイントが認証なしで動作
- ✅ `get_current_user`は`None`を返す（オプショナル）
- ✅ `get_current_user_required`を使っているエンドポイントは動作しない（503エラー）
- ✅ 開発・テストが容易

**現在の実装:**
- 多くのエンドポイントが`get_current_user_required`を使用しているため、認証OFFの場合は動作しません
- 認証OFFで動作させるには、エンドポイントを`get_current_user`に変更する必要があります

#### AUTH_ENABLED=true の場合

- ✅ Google認証が必須
- ✅ ユーザーデータが保護される
- ✅ 本番環境での使用に適している

## Localhostで認証を有効にする場合

### 1. Google Cloud Consoleでの設定

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. プロジェクトを作成または選択
3. 「APIとサービス」→「認証情報」に移動
4. 「OAuth 2.0 クライアント ID」を作成
5. **承認済みのJavaScript生成元**に以下を追加:
   - `http://localhost:3000` (Next.js開発サーバー)
   - `http://localhost:3001` (別ポートを使用する場合)
6. **承認済みのリダイレクト URI**に以下を追加:
   - `http://localhost:3000` (Next.js)
   - `http://localhost:8000` (FastAPI、必要に応じて)

### 2. 環境変数の設定

#### バックエンド（`.env`ファイル）

```env
AUTH_ENABLED=true
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
SECRET_KEY=your-secret-key-for-localhost
```

#### フロントエンド（`web_next/.env.local`ファイル）

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
BACKEND_INTERNAL_URL=http://localhost:8000
```

### 3. サーバーの起動

```bash
# バックエンド
cd law-review
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# フロントエンド（別ターミナル）
cd law-review/web_next
npm run dev
```

## 現在の実装状況

### 認証OFF（AUTH_ENABLED=false）の場合

**動作するエンドポイント:**
- `/v1/health` - ヘルスチェック
- `/v1/problems/*` - 問題取得（認証不要）
- `/v1/review` - 講評生成（`get_current_user_required`を使用しているため、認証OFFでは動作しない）

**動作しないエンドポイント:**
- `/v1/users/me` - 認証必須
- `/v1/review` - `get_current_user_required`を使用
- `/v1/threads/*` - 認証必須
- その他、`get_current_user_required`を使用しているエンドポイント

### 認証ON（AUTH_ENABLED=true）の場合

- すべてのエンドポイントが認証を要求
- Google認証が必要

## 推奨事項

### 開発中（Localhost）

1. **認証をOFFにする** (`AUTH_ENABLED=false`)
   - 開発効率が向上
   - テストが容易

2. **認証が必要な機能をテストする場合**
   - `AUTH_ENABLED=true`に設定
   - Google認証を設定
   - ログインしてテスト

### 本番環境

1. **必ず認証をONにする** (`AUTH_ENABLED=true`)
2. **適切なシークレットキーを設定**
3. **Google OAuth設定を本番ドメインに設定**

## まとめ

- **Localhostでの認証は必須ではありません**（開発効率のため）
- **本番環境では認証を必須にする**（セキュリティのため）
- 認証OFFでも動作するようにするには、エンドポイントの修正が必要です
