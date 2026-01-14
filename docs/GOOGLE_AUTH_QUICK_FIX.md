# Google認証エラー「続行できませんでした」のクイック修正

## 🎯 最も可能性が高い原因（90%）

### テストユーザーが追加されていない

**外部タイプ**を選択した場合、**テストユーザーを追加しないとログインできません**。

## ✅ 解決手順（5分で完了）

### Step 1: テストユーザーを追加

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. プロジェクトを選択
3. **「APIとサービス」→「OAuth同意画面」**を選択
4. **「テストユーザー」**セクションを確認
5. **「+ 追加」**をクリック
6. 使用するGmailアカウントのメールアドレスを入力
7. **「追加」**をクリック
8. **「保存」**をクリック

### Step 2: 環境変数の確認

#### バックエンド（`.env`ファイル）

```env
AUTH_ENABLED=true
GOOGLE_CLIENT_ID=あなたの実際のクライアントID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=あなたの実際のクライアントシークレット
SECRET_KEY=適当な長い文字列
```

#### フロントエンド（`web_next/.env.local`ファイル）

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=あなたの実際のクライアントID.apps.googleusercontent.com
BACKEND_INTERNAL_URL=http://localhost:8000
```

**重要:** `NEXT_PUBLIC_GOOGLE_CLIENT_ID`と`GOOGLE_CLIENT_ID`は**同じ値**である必要があります。

### Step 3: サーバーの再起動

環境変数を変更した後は、**必ずサーバーを再起動**してください：

```bash
# バックエンドを停止して再起動
# フロントエンドを停止して再起動
cd C:\Users\tvxqt\.shihou-zyuken2601\law-review\web_next
npm run dev
```

### Step 4: ブラウザのキャッシュをクリア

1. ブラウザで`Ctrl+Shift+R`を押してハードリロード
2. または、開発者ツール（F12）を開いて「ネットワーク」タブで「キャッシュを無効にする」にチェック

## 🔍 その他の確認項目

### 1. OAuth 2.0 クライアント IDの設定確認

1. 「APIとサービス」→「認証情報」を選択
2. 作成したOAuth 2.0 クライアント IDをクリック
3. 以下を確認:
   - **承認済みのJavaScript生成元**: `http://localhost:3000`が追加されているか
   - **承認済みのリダイレクト URI**: `http://localhost:3000`が追加されているか

### 2. ブラウザのコンソールでエラーを確認

1. ブラウザの開発者ツールを開く（F12）
2. 「Console」タブを確認
3. エラーメッセージを確認

**よくあるエラー:**
- `GOOGLE_CLIENT_ID is not set` → 環境変数が設定されていない
- `Invalid client` → クライアントIDが間違っている
- `redirect_uri_mismatch` → リダイレクトURIが設定されていない

### 3. バックエンドのログを確認

バックエンドサーバーのログで以下のエラーがないか確認：
- `Authentication attempt but AUTH_ENABLED is False`
- `GOOGLE_CLIENT_ID is not set`
- `Token verification failed`

## 📋 チェックリスト

- [ ] OAuth同意画面で「外部」タイプを選択した
- [ ] **テストユーザーに使用するGmailアカウントを追加した** ← 最重要
- [ ] OAuth 2.0 クライアント IDを作成した
- [ ] 承認済みのJavaScript生成元に`http://localhost:3000`を追加した
- [ ] 承認済みのリダイレクト URIに`http://localhost:3000`を追加した
- [ ] `.env`ファイルに`AUTH_ENABLED=true`を設定した
- [ ] `.env`ファイルに正しい`GOOGLE_CLIENT_ID`を設定した
- [ ] `.env`ファイルに正しい`GOOGLE_CLIENT_SECRET`を設定した
- [ ] `web_next/.env.local`ファイルを作成した
- [ ] `web_next/.env.local`に正しい`NEXT_PUBLIC_GOOGLE_CLIENT_ID`を設定した（バックエンドと同じ値）
- [ ] バックエンドサーバーを再起動した
- [ ] フロントエンドサーバーを再起動した
- [ ] ブラウザのキャッシュをクリアした

## 💡 デバッグのヒント

### ブラウザのコンソールで環境変数を確認

```javascript
// ブラウザのコンソール（F12）で実行
console.log('Client ID:', process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID)
```

`undefined`が表示される場合、環境変数が正しく読み込まれていません。

### ネットワークタブでAPIリクエストを確認

1. 開発者ツール（F12）を開く
2. 「ネットワーク」タブを選択
3. 「Googleでログイン」ボタンをクリック
4. `/api/auth/google`へのリクエストを確認
5. ステータスコードとレスポンスを確認

## 🎯 まとめ

**「Googleで続行できませんでした」エラーの90%は「テストユーザーが追加されていない」ことが原因です。**

まずは以下を確認してください：
1. ✅ OAuth同意画面でテストユーザーを追加したか
2. ✅ 環境変数が正しく設定されているか
3. ✅ サーバーを再起動したか

詳細なトラブルシューティングは`law-review/docs/GOOGLE_AUTH_TROUBLESHOOTING.md`を参照してください。
