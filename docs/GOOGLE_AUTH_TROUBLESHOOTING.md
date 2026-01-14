# Google 認証エラー「続行できませんでした」のトラブルシューティング

## 🔍 エラーの原因と解決方法

### 1. テストユーザーが追加されていない（最も一般的）

**症状:** 「Google で続行できませんでした」というエラー

**原因:**

- OAuth 同意画面で「外部」タイプを選択した場合、テストユーザーを追加する必要があります
- テストユーザーとして追加されていないアカウントはログインできません

**解決方法:**

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 「API とサービス」→「OAuth 同意画面」を選択
3. 「テストユーザー」セクションを確認
4. **「テストユーザーを追加」をクリック**
5. 使用する Gmail アカウントのメールアドレスを追加
6. **「保存」をクリック**
7. 再度ログインを試す

### 2. 承認済みの JavaScript 生成元が設定されていない

**症状:** ログインボタンをクリックしてもエラーが発生

**原因:**

- OAuth 2.0 クライアント ID の設定で、承認済みの JavaScript 生成元が設定されていない

**解決方法:**

1. 「API とサービス」→「認証情報」を選択
2. 作成した OAuth 2.0 クライアント ID をクリック
3. 「承認済みの JavaScript 生成元」セクションを確認
4. `http://localhost:3000`が追加されているか確認
5. 追加されていない場合は追加して保存

### 3. 環境変数が正しく設定されていない

**症状:** ログインボタンが表示されない、またはエラーが発生

**確認項目:**

#### バックエンド（`.env`ファイル）

```env
AUTH_ENABLED=true
GOOGLE_CLIENT_ID=正しいクライアントID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=正しいクライアントシークレット
```

#### フロントエンド（`web_next/.env.local`ファイル）

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=正しいクライアントID.apps.googleusercontent.com
BACKEND_INTERNAL_URL=http://localhost:8000
```

**注意:**

- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`と`GOOGLE_CLIENT_ID`は**同じ値**である必要があります
- 環境変数を変更した後は、**サーバーを再起動**してください

### 4. サーバーが再起動されていない

**症状:** 環境変数を設定したが反映されない

**解決方法:**

1. バックエンドサーバーを停止して再起動
2. フロントエンドサーバーを停止して再起動
3. ブラウザのキャッシュをクリア（Ctrl+Shift+R）

### 5. ブラウザのコンソールエラーを確認

**確認方法:**

1. ブラウザの開発者ツールを開く（F12）
2. 「Console」タブを確認
3. エラーメッセージを確認

**よくあるエラー:**

- `GOOGLE_CLIENT_ID is not set` → 環境変数が設定されていない
- `Invalid client` → クライアント ID が間違っている
- `redirect_uri_mismatch` → リダイレクト URI が設定されていない

## 🔧 ステップバイステップの確認手順

### Step 1: Google Cloud Console の設定確認

1. ✅ **同意画面の設定**

   - ユーザータイプ: 外部
   - テストユーザーが追加されているか確認

2. ✅ **OAuth 2.0 クライアント ID の設定**
   - 承認済みの JavaScript 生成元: `http://localhost:3000`
   - 承認済みのリダイレクト URI: `http://localhost:3000`

### Step 2: 環境変数の確認

#### バックエンド（`.env`）

```bash
cd C:\Users\tvxqt\.shihou-zyuken2601\law-review
# .envファイルを開いて確認
```

#### フロントエンド（`web_next/.env.local`）

```bash
cd C:\Users\tvxqt\.shihou-zyuken2601\law-review\web_next
# .env.localファイルを開いて確認
```

### Step 3: サーバーの再起動

```bash
# バックエンドを再起動
# フロントエンドを再起動
cd C:\Users\tvxqt\.shihou-zyuken2601\law-review\web_next
npm run dev
```

### Step 4: ブラウザの確認

1. ブラウザのキャッシュをクリア（Ctrl+Shift+R）
2. 開発者ツール（F12）でエラーを確認
3. ネットワークタブで API リクエストを確認

## 🎯 最も可能性が高い原因

**「Google で続行できませんでした」エラーの 90%は以下が原因:**

1. **テストユーザーが追加されていない** ← 最も可能性が高い
2. 環境変数が正しく設定されていない
3. サーバーが再起動されていない

## 📝 確認チェックリスト

- [ ] OAuth 同意画面で「外部」タイプを選択した
- [ ] テストユーザーに使用する Gmail アカウントを追加した
- [ ] OAuth 2.0 クライアント ID を作成した
- [ ] 承認済みの JavaScript 生成元に`http://localhost:3000`を追加した
- [ ] 承認済みのリダイレクト URI に`http://localhost:3000`を追加した
- [ ] `.env`ファイルに`AUTH_ENABLED=true`を設定した
- [ ] `.env`ファイルに正しい`GOOGLE_CLIENT_ID`を設定した
- [ ] `.env`ファイルに正しい`GOOGLE_CLIENT_SECRET`を設定した
- [ ] `web_next/.env.local`ファイルを作成した
- [ ] `web_next/.env.local`に正しい`NEXT_PUBLIC_GOOGLE_CLIENT_ID`を設定した
- [ ] バックエンドサーバーを再起動した
- [ ] フロントエンドサーバーを再起動した
- [ ] ブラウザのキャッシュをクリアした

## 💡 デバッグのヒント

### ブラウザのコンソールで確認

```javascript
// ブラウザのコンソールで実行
console.log(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
```

`undefined`が表示される場合、環境変数が正しく読み込まれていません。

### バックエンドのログを確認

バックエンドサーバーのログで以下のエラーがないか確認：

- `Authentication attempt but AUTH_ENABLED is False`
- `GOOGLE_CLIENT_ID is not set`
- `Token verification failed`

## 🔄 再設定手順（最初からやり直す場合）

1. Google Cloud Console で OAuth 2.0 クライアント ID を削除
2. 同意画面の設定を確認（テストユーザーが追加されているか）
3. 新しい OAuth 2.0 クライアント ID を作成
4. 環境変数を再設定
5. サーバーを再起動

## 📞 それでも解決しない場合

1. ブラウザのコンソールエラーを確認
2. バックエンドのログを確認
3. ネットワークタブで API リクエストのステータスコードを確認
4. エラーメッセージの全文を確認

最も可能性が高いのは「テストユーザーが追加されていない」ことです。まずはこれを確認してください。
