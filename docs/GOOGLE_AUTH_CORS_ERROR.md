# Google 認証 CORS エラーの解決方法

## 🔍 エラーの意味

### エラーメッセージの解釈

```
ERR_FAILED - ネットワークエラー
Server did not send the correct CORS headers - CORSヘッダーの問題
FedCM get() rejects - Google Identity Servicesのエラー
```

このエラーは、**Google Identity Services（GSI）が ID トークンを取得しようとした際に発生**しています。

## 🎯 原因と解決方法

### 1. 承認済みの JavaScript 生成元が設定されていない（最も可能性が高い）

**症状:** `ERR_FAILED`と`CORS headers`エラー

**原因:**

- OAuth 2.0 クライアント ID の設定で、承認済みの JavaScript 生成元が設定されていない
- Google Identity Services が`http://localhost:3000`からのリクエストを許可していない

**解決方法:**

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 「API とサービス」→「認証情報」を選択
3. 作成した OAuth 2.0 クライアント ID をクリック
4. **「承認済みの JavaScript 生成元」**セクションを確認
5. **「URI を追加」**をクリック
6. 実際に使用しているポートを追加:
   - 通常の開発環境: `http://localhost:3000`
   - Docker Compose 使用時: `http://localhost:8080`
7. **「保存」**をクリック
8. ブラウザのキャッシュをクリアして再試行

### 2. 環境変数が正しく設定されていない

**確認項目:**

#### フロントエンド（`web_next/.env.local`ファイル）

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=あなたの実際のクライアントID.apps.googleusercontent.com
BACKEND_INTERNAL_URL=http://localhost:8000
```

**重要:**

- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`が正しく設定されているか確認
- 環境変数を変更した後は、**フロントエンドサーバーを再起動**してください

### 3. クライアント ID が間違っている

**確認方法:**

1. Google Cloud Console で OAuth 2.0 クライアント ID を確認
2. `.env.local`ファイルの`NEXT_PUBLIC_GOOGLE_CLIENT_ID`と一致しているか確認
3. 完全に一致している必要があります（スペースや改行がないか確認）

### 4. ブラウザのコンソールで環境変数を確認

**確認方法:**

1. ブラウザの開発者ツールを開く（F12）
2. 「Console」タブを選択
3. 以下を実行:

```javascript
console.log("Client ID:", process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
```

**期待される結果:**

- クライアント ID が表示される（例: `123456789-abc.apps.googleusercontent.com`）

**問題がある場合:**

- `undefined`が表示される → 環境変数が読み込まれていない
- 空文字列が表示される → 環境変数が設定されていない
- 間違った値が表示される → `.env.local`ファイルを確認

## 🔧 ステップバイステップの解決手順

### Step 1: Google Cloud Console の設定確認

1. ✅ **OAuth 2.0 クライアント ID の設定**

   - 「API とサービス」→「認証情報」を選択
   - OAuth 2.0 クライアント ID をクリック
   - **承認済みの JavaScript 生成元**: 実際に使用しているポートを追加
     - 通常の開発環境: `http://localhost:3000`
     - Docker Compose 使用時: `http://localhost:8080`
   - **承認済みのリダイレクト URI**: 同じポートを追加
     - 通常の開発環境: `http://localhost:3000`
     - Docker Compose 使用時: `http://localhost:8080`

2. ✅ **同意画面の設定**
   - 「API とサービス」→「OAuth 同意画面」を選択
   - テストユーザーが追加されているか確認

### Step 2: 環境変数の確認

#### フロントエンド（`web_next/.env.local`）

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=あなたの実際のクライアントID.apps.googleusercontent.com
BACKEND_INTERNAL_URL=http://localhost:8000
```

**確認ポイント:**

- クライアント ID が正しいか（Google Cloud Console と一致しているか）
- スペースや改行が含まれていないか
- ファイルが正しく保存されているか

### Step 3: サーバーの再起動

環境変数を変更した後は、**必ずフロントエンドサーバーを再起動**してください：

```bash
# フロントエンドサーバーを停止（Ctrl+C）
# 再度起動
cd C:\Users\tvxqt\.shihou-zyuken2601\law-review\web_next
npm run dev
```

### Step 4: ブラウザのキャッシュをクリア

1. ブラウザで`Ctrl+Shift+R`を押してハードリロード
2. または、開発者ツール（F12）を開いて「ネットワーク」タブで「キャッシュを無効にする」にチェック

## 🎯 最も可能性が高い原因

**このエラーの 90%は以下が原因:**

1. **承認済みの JavaScript 生成元に`http://localhost:3000`が追加されていない** ← 最も可能性が高い
2. 環境変数`NEXT_PUBLIC_GOOGLE_CLIENT_ID`が正しく設定されていない
3. フロントエンドサーバーが再起動されていない

## 📋 確認チェックリスト

- [ ] OAuth 2.0 クライアント ID で「承認済みの JavaScript 生成元」に実際のポートを追加した（`http://localhost:3000`または`http://localhost:8080`）
- [ ] OAuth 2.0 クライアント ID で「承認済みのリダイレクト URI」に実際のポートを追加した（`http://localhost:3000`または`http://localhost:8080`）
- [ ] `web_next/.env.local`ファイルを作成した
- [ ] `web_next/.env.local`に正しい`NEXT_PUBLIC_GOOGLE_CLIENT_ID`を設定した（Google Cloud Console と完全に一致）
- [ ] フロントエンドサーバーを再起動した
- [ ] ブラウザのキャッシュをクリアした
- [ ] ブラウザのコンソールで環境変数を確認した（`undefined`ではない）

## 💡 デバッグのヒント

### ブラウザのコンソールで確認

```javascript
// ブラウザのコンソール（F12）で実行
console.log("Client ID:", process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
```

### ネットワークタブで確認

1. 開発者ツール（F12）を開く
2. 「ネットワーク」タブを選択
3. 「Google でログイン」ボタンをクリック
4. Google Identity Services へのリクエストを確認
5. エラーの詳細を確認

### Google Cloud Console で確認

1. 「API とサービス」→「認証情報」を選択
2. OAuth 2.0 クライアント ID をクリック
3. 「承認済みの JavaScript 生成元」に実際のポートが追加されているか確認
   - 通常の開発環境: `http://localhost:3000`
   - Docker Compose 使用時: `http://localhost:8080`
4. **重要:** `https://`ではなく、`http://`である必要があります

## 🔄 再設定手順

1. Google Cloud Console で OAuth 2.0 クライアント ID を編集
2. 「承認済みの JavaScript 生成元」に実際のポートを追加
   - 通常の開発環境: `http://localhost:3000`
   - Docker Compose 使用時: `http://localhost:8080`
3. 「承認済みのリダイレクト URI」に同じポートを追加
4. 保存
5. `.env.local`ファイルを確認
6. フロントエンドサーバーを再起動
7. ブラウザのキャッシュをクリア

## 📝 まとめ

**「Server did not send the correct CORS headers」エラーは、Google Identity Services が ID トークンを取得しようとした際に発生します。**

**最も可能性が高い原因:**

1. ✅ **承認済みの JavaScript 生成元に実際のポート（`http://localhost:3000`または`http://localhost:8080`）が追加されていない**
2. ✅ 環境変数が正しく設定されていない
3. ✅ サーバーが再起動されていない

**重要:** 使用しているポートを確認してください：

- 通常の開発環境（`npm run dev`）: `http://localhost:3000`
- Docker Compose 使用時: `http://localhost:8080`

まずは「承認済みの JavaScript 生成元」の設定を確認してください。
