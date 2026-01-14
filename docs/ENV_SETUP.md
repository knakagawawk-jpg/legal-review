# 環境変数設定ガイド

## .envファイルの設定

### バックエンド（law-review/.env）

既存の`.env`ファイルに以下の認証設定を追加してください：

```env
# ============================================================================
# 認証設定
# ============================================================================

# 認証機能を有効にするかどうか（true/false）
# falseの場合: 認証なしで動作（開発用）
# trueの場合: Google認証が必要（本番環境推奨）
AUTH_ENABLED=false

# Google OAuth設定（Google Cloud Consoleで取得）
# https://console.cloud.google.com/ でOAuth 2.0 クライアント IDを作成
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# JWT用のシークレットキー（本番環境では必ず変更）
SECRET_KEY=change-this-secret-key-in-production

# トークン検証キャッシュ設定（オプション）
TOKEN_CACHE_TTL=300
TOKEN_CACHE_MAX_SIZE=1000
```

### フロントエンド（law-review/web_next/.env.local）

`web_next`ディレクトリに`.env.local`ファイルを作成し、以下を追加してください：

```env
# ============================================================================
# Next.js フロントエンド設定
# ============================================================================

# バックエンドAPIのURL（内部通信用）
BACKEND_INTERNAL_URL=http://localhost:8000

# Google OAuth設定（フロントエンド用）
# Google Cloud Consoleで作成したOAuth 2.0 クライアント ID
# 承認済みのJavaScript生成元に http://localhost:3000 を追加
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

## Localhostでの認証の必要性

### 推奨設定

**開発環境（Localhost）:**
- `AUTH_ENABLED=false` - **認証なしで開発を進める（推奨）**
- 開発中は認証をスキップして、機能実装に集中

**本番環境:**
- `AUTH_ENABLED=true` - **認証を必須にする**
- ユーザーデータの保護とセキュリティのため

### 現在の実装状況

#### AUTH_ENABLED=false の場合（デフォルト）

- ✅ `get_current_user`は`None`を返す（オプショナル認証）
- ❌ `get_current_user_required`を使っているエンドポイントは動作しない（503エラー）
- ⚠️ **現在、多くのエンドポイントが`get_current_user_required`を使用しているため、認証OFFでは動作しません**

**動作するエンドポイント:**
- `/v1/health` - ヘルスチェック
- `/v1/problems/*` - 問題取得（認証不要のもの）

**動作しないエンドポイント:**
- `/v1/review` - 講評生成（`get_current_user_required`を使用）
- `/v1/users/me` - ユーザー情報取得
- `/v1/threads/*` - チャット機能
- その他、`get_current_user_required`を使用しているエンドポイント

#### AUTH_ENABLED=true の場合

- ✅ Google認証が必須
- ✅ すべてのエンドポイントが動作
- ✅ ユーザーデータが保護される

## Localhostで認証を有効にする場合の手順

### 1. Google Cloud Consoleでの設定

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. プロジェクトを作成または選択
3. 「APIとサービス」→「認証情報」に移動
4. 「OAuth 2.0 クライアント ID」を作成
5. **承認済みのJavaScript生成元**に以下を追加:
   - `http://localhost:3000` (Next.js開発サーバー)
6. **承認済みのリダイレクト URI**に以下を追加:
   - `http://localhost:3000` (Next.js)

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

### 3. サーバーの再起動

環境変数を変更した後は、サーバーを再起動してください：

```bash
# バックエンド
# サーバーを停止して再起動

# フロントエンド
cd law-review/web_next
npm run dev
```

## まとめ

### Localhostでの認証は必須ですか？

**答え: 必須ではありません（開発効率のため）**

- **開発中**: `AUTH_ENABLED=false`で認証なしで開発（推奨）
- **本番環境**: `AUTH_ENABLED=true`で認証を必須にする

### 注意点

現在の実装では、多くのエンドポイントが`get_current_user_required`を使用しているため、認証OFFの場合は動作しません。開発中に認証なしで動作させるには、エンドポイントを`get_current_user`に変更する必要があります。

### 推奨される開発フロー

1. **開発初期**: `AUTH_ENABLED=false`で機能実装
2. **認証機能のテスト**: `AUTH_ENABLED=true`に設定してテスト
3. **本番デプロイ**: `AUTH_ENABLED=true`でデプロイ
