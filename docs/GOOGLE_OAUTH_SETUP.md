# Google OAuth設定ガイド（同意画面の設定含む）

## 📋 手順1: 同意画面（OAuth Consent Screen）の設定

OAuth 2.0 クライアント IDを作成する前に、同意画面を設定する必要があります。

### 1. Google Cloud Consoleにアクセス

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. プロジェクトを作成または選択

### 2. 同意画面の設定

1. **左側のメニューから「APIとサービス」→「OAuth同意画面」を選択**

2. **ユーザータイプを選択**
   - **外部**（推奨）: 任意のGoogleアカウントでログイン可能
   - **内部**: Google Workspace組織内のみ（開発環境では通常「外部」を選択）

3. **アプリ情報を入力**
   - **アプリ名**: `Juristutor-AI`（任意の名前）
   - **ユーザーサポートメール**: あなたのメールアドレス
   - **アプリのロゴ**: オプション（スキップ可能）
   - **アプリのホームページ**: `http://localhost:3000`（開発環境の場合）
   - **アプリのプライバシーポリシーリンク**: オプション（スキップ可能）
   - **アプリの利用規約リンク**: オプション（スキップ可能）
   - **承認済みのドメイン**: オプション（開発環境では不要）

4. **スコープの設定**
   - **スコープを追加または削除**をクリック
   - 以下のスコープを追加:
     - `openid`
     - `email`
     - `profile`
   - **更新**をクリック

5. **テストユーザー（外部タイプの場合）**
   - **テストユーザーを追加**をクリック
   - 使用するGmailアカウントのメールアドレスを追加
   - **保存**をクリック

6. **保存して次へ**をクリック

7. **概要を確認して「ダッシュボードに戻る」をクリック**

## 📋 手順2: OAuth 2.0 クライアント IDの作成

同意画面の設定が完了したら、OAuth 2.0 クライアント IDを作成できます。

### 1. 認証情報ページに移動

1. **左側のメニューから「APIとサービス」→「認証情報」を選択**

### 2. OAuth 2.0 クライアント IDを作成

1. **「認証情報を作成」→「OAuth 2.0 クライアント ID」を選択**

2. **アプリケーションの種類（ApplicationType）を選択**
   - **ウェブアプリケーション（Web application）**を選択
   
   **選択肢の説明:**
   - **ウェブアプリケーション（Web application）**: ブラウザで動作するWebアプリ（Next.js、React、Vue.jsなど）
   - **Android**: Androidアプリ用
   - **iOS**: iOSアプリ用
   - **デスクトップアプリ**: デスクトップアプリ用
   - **Chrome アプリ**: Chrome拡張機能用
   - **TV および Limited Input デバイス**: TVやIoTデバイス用
   
   **このプロジェクトでは「ウェブアプリケーション」を選択してください。**

3. **名前を入力**
   - **名前**: `Juristutor-AI Localhost`（任意の名前）

4. **承認済みのJavaScript生成元を追加**
   - **URIを追加**をクリック
   - `http://localhost:3000`を追加
   - 必要に応じて`http://localhost:3001`なども追加可能

5. **承認済みのリダイレクト URIを追加**
   - **URIを追加**をクリック
   - `http://localhost:3000`を追加
   - 必要に応じて`http://localhost:8000`なども追加可能

6. **作成**をクリック

### 3. クライアント IDとシークレットをコピー

1. **クライアント ID**をコピー（例: `123456789-abcdefghijklmnop.apps.googleusercontent.com`）
2. **クライアント シークレット**をコピー（例: `GOCSPX-abcdefghijklmnopqrstuvwxyz`）
3. **OK**をクリック

## 📋 手順3: 環境変数の設定

### バックエンド（`.env`ファイル）

```env
AUTH_ENABLED=true
GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwxyz
SECRET_KEY=your-secret-key-for-development-change-this
```

### フロントエンド（`web_next/.env.local`ファイル）

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
BACKEND_INTERNAL_URL=http://localhost:8000
```

## ⚠️ 注意点

### 外部タイプの場合

- **テストユーザーを追加する必要があります**
- テストユーザーとして追加したGmailアカウントのみがログイン可能
- 本番環境では、アプリを公開する必要があります（またはテストユーザーを追加し続ける）

### 内部タイプの場合

- Google Workspace組織内のアカウントのみがログイン可能
- 開発環境では通常「外部」を選択します

## 🔄 サーバーの再起動

環境変数を設定した後、サーバーを再起動してください：

```bash
# バックエンド
# サーバーを停止して再起動

# フロントエンド
cd law-review/web_next
npm run dev
```

## ✅ 動作確認

1. ブラウザで`http://localhost:3000`にアクセス
2. 「Googleでログイン」ボタンをクリック
3. Googleアカウントでログイン
4. YourPageやフリーチャットが正常に動作することを確認

## 📝 まとめ

1. ✅ **同意画面の設定**（必須）
   - ユーザータイプ: 外部
   - アプリ情報の入力
   - スコープの追加（openid, email, profile）
   - テストユーザーの追加（外部タイプの場合）

2. ✅ **OAuth 2.0 クライアント IDの作成**
   - ウェブアプリケーションを選択
   - 承認済みのJavaScript生成元: `http://localhost:3000`
   - 承認済みのリダイレクト URI: `http://localhost:3000`

3. ✅ **環境変数の設定**
   - `.env`ファイルに認証設定を追加
   - `web_next/.env.local`ファイルを作成

4. ✅ **サーバーの再起動**

これで、1つのGmailアカウントでログインして使用できるようになります。
