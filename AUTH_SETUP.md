# 認証機能のセットアップガイド

## 現在の状態

✅ **実装完了:**
- データベースモデル（User, SubscriptionPlan, UserSubscription, MonthlyUsage）
- 認証コード（`app/auth.py`）
- FastAPI認証エンドポイント
- Streamlit認証コンポーネント
- 設定ファイル（認証ON/OFF切り替え可能）

⚠️ **現在の設定:**
- **認証機能はOFF（デフォルト）**
- 既存の機能は認証なしで動作します
- `user_id`はNULL許容なので、認証なしでもデータは保存されます

## 認証機能を有効にする方法

### 1. 環境変数を設定

`.env`ファイルを作成するか、環境変数を設定：

```bash
# 認証を有効にする
AUTH_ENABLED=true

# Google OAuth設定（Google Cloud Consoleで取得）
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# JWT用のシークレットキー（本番環境では必ず変更）
SECRET_KEY=your-secret-key-change-in-production
```

### 2. Google Cloud Consoleでの設定

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. プロジェクトを作成または選択
3. 「APIとサービス」→「認証情報」に移動
4. 「OAuth 2.0 クライアント ID」を作成
5. 承認済みのリダイレクト URIを設定：
   - `http://localhost:8501` (開発環境)
   - `https://yourdomain.com` (本番環境)

### 3. 必要なパッケージをインストール

```bash
pip install -r requirements.txt
```

### 4. データベーステーブルを作成

```bash
# Pythonで実行
python -c "from app.db import engine, Base; from app.models import User, SubscriptionPlan, UserSubscription, MonthlyUsage; Base.metadata.create_all(engine)"
```

または、アプリケーションを起動すると自動的に作成されます。

## 認証機能の動作

### 認証がOFFの場合（現在の状態）

- すべてのエンドポイントが認証なしで動作
- `user_id`はNULLで保存される
- 既存の機能はそのまま動作

### 認証がONの場合

- `/v1/auth/google` エンドポイントでGoogle認証が可能
- `/v1/users/me` エンドポイントでユーザー情報を取得可能
- `/v1/review` や `/v1/short-answer/sessions` で認証情報があれば`user_id`が設定される
- Streamlitでログインボタンが表示される

## 認証機能の使い方

### Streamlit側

```python
from streamlit_app.components.auth import is_authenticated, get_current_user, render_auth_status

# サイドバーに認証状態を表示
render_auth_status()

# 認証が必要なページで
if not is_authenticated():
    st.info("ログインが必要です")
    st.stop()

user = get_current_user()
st.write(f"ようこそ、{user['name']}さん")
```

### FastAPI側

```python
from app.auth import get_current_user, get_current_user_required

# 認証オプション（認証されていればuser_idを設定）
@app.post("/v1/review")
async def create_review(
    req: ReviewRequest,
    current_user: Optional[User] = Depends(get_current_user),  # オプション
    db: Session = Depends(get_db)
):
    # current_userがNoneの場合は認証なし
    # current_userが存在する場合はuser_idを設定
    pass

# 認証必須
@app.get("/v1/users/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_user_required)  # 必須
):
    return {"email": current_user.email}
```

## 注意事項

1. **認証がOFFの状態でも動作**: 既存の機能は認証なしで動作します
2. **段階的な有効化**: 認証をONにしても、既存のエンドポイントは認証オプションなので、認証なしでも動作します
3. **データの移行**: 既存のデータは`user_id`がNULLのままです。必要に応じてマイグレーションスクリプトを作成してください

## 次のステップ

認証機能を有効にする場合は、上記の手順に従って設定してください。
現在は認証機能がOFFなので、既存の機能はそのまま動作します。
