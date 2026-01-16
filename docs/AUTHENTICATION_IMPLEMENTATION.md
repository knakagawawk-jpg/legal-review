# Google認証実装ガイド

## 現状

✅ **完了していること:**
- データベース設計（`users`テーブルなど）
- 設計書の作成

❌ **まだ実装されていないこと:**
- 認証コード（`app/auth.py`）
- Google OAuth設定
- FastAPI認証エンドポイント
- Streamlit認証UI
- 環境変数の設定

## Google認証を実装するために必要なこと

### 1. Google Cloud Consoleでの設定（必須）

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. プロジェクトを作成または選択
3. 「APIとサービス」→「認証情報」に移動
4. 「OAuth 2.0 クライアント ID」を作成
5. 承認済みのリダイレクト URIを設定：
   - `http://localhost:8501` (開発環境)
   - `https://yourdomain.com` (本番環境)

### 2. 必要なパッケージのインストール

```bash
pip install python-jose[cryptography]>=3.3.0
pip install google-auth>=2.23.0
pip install google-auth-oauthlib>=1.1.0
pip install google-auth-httplib2>=0.1.1
```

### 3. 実装が必要なファイル

#### 3.1 `app/auth.py`（新規作成・必須）

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from google.oauth2 import id_token
from google.auth.transport import requests
from sqlalchemy.orm import Session
import os

from .db import SessionLocal
from .models import User

# 環境変数から設定を取得
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

security = HTTPBearer()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def verify_google_token(token: str) -> dict:
    """Google IDトークンを検証"""
    try:
        idinfo = id_token.verify_oauth2_token(
            token, requests.Request(), GOOGLE_CLIENT_ID
        )
        if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
            raise ValueError('Wrong issuer.')
        return idinfo
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials: {str(e)}"
        )

def get_or_create_user(google_info: dict, db: Session) -> User:
    """Google情報からユーザーを取得または作成"""
    google_id = google_info['sub']
    email = google_info['email']
    name = google_info.get('name')
    picture = google_info.get('picture')
    
    # 既存ユーザーを検索
    user = db.query(User).filter(
        (User.google_id == google_id) | (User.email == email)
    ).first()
    
    if user:
        # 既存ユーザーの情報を更新
        user.google_id = google_id
        user.email = email
        user.name = name or user.name
        user.google_picture = picture or user.google_picture
        user.last_login_at = func.now()
    else:
        # 新規ユーザーを作成
        user = User(
            google_id=google_id,
            email=email,
            name=name,
            google_picture=picture,
            subscription_plan="free"  # デフォルトは無料プラン
        )
        db.add(user)
    
    db.commit()
    db.refresh(user)
    return user

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """現在のユーザーを取得（認証必須）"""
    token = credentials.credentials
    
    # Googleトークンを検証
    google_info = await verify_google_token(token)
    
    # ユーザーを取得または作成
    user = get_or_create_user(google_info, db)
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )
    
    return user

async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User | None:
    """現在のユーザーを取得（認証オプション）"""
    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None
```

#### 3.2 `app/main.py`に認証エンドポイントを追加

```python
from fastapi import Depends
from .auth import get_current_user, get_or_create_user, verify_google_token
from .models import User

@app.post("/v1/auth/google")
async def google_auth(token: str, db: Session = Depends(get_db)):
    """Google認証エンドポイント"""
    # Googleトークンを検証
    google_info = await verify_google_token(token)
    
    # ユーザーを取得または作成
    user = get_or_create_user(google_info, db)
    
    # JWTトークンを生成（オプション）
    # またはセッションIDを返す
    
    return {
        "user_id": user.id,
        "email": user.email,
        "name": user.name,
        "subscription_plan": user.subscription_plan
    }

@app.get("/v1/users/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """現在のユーザー情報を取得"""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "subscription_plan": current_user.subscription_plan
    }
```

#### 3.3 `streamlit_app/components/auth.py`（新規作成・必須）

```python
import streamlit as st
import requests
from google_auth_oauthlib.flow import Flow
import os

# 環境変数から設定を取得
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
REDIRECT_URI = os.getenv("REDIRECT_URI", "http://localhost:8501")

def init_google_oauth():
    """Google OAuthフローを初期化"""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        st.error("Google OAuth設定が完了していません。環境変数を設定してください。")
        return None
    
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [REDIRECT_URI]
            }
        },
        scopes=["openid", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"]
    )
    return flow

def login_with_google():
    """Googleでログイン"""
    flow = init_google_oauth()
    if not flow:
        return False
    
    # 認証URLを生成
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true'
    )
    
    # 状態を保存
    st.session_state['oauth_state'] = state
    
    # 認証URLにリダイレクト
    st.markdown(f'<a href="{authorization_url}" target="_self">Googleでログイン</a>', unsafe_allow_html=True)
    
    return True

def handle_oauth_callback(code: str):
    """OAuthコールバックを処理"""
    flow = init_google_oauth()
    if not flow:
        return False
    
    # トークンを取得
    flow.fetch_token(code=code)
    
    # IDトークンを取得
    credentials = flow.credentials
    id_token = credentials.id_token
    
    # バックエンドAPIに送信
    response = requests.post(
        f"{API_BASE_URL}/v1/auth/google",
        json={"token": id_token}
    )
    
    if response.status_code == 200:
        user_data = response.json()
        st.session_state['user'] = user_data
        st.session_state['access_token'] = credentials.token
        return True
    else:
        st.error("認証に失敗しました。")
        return False

def get_current_user():
    """現在のユーザーを取得"""
    return st.session_state.get('user')

def is_authenticated():
    """認証済みかどうかを確認"""
    return 'user' in st.session_state and st.session_state['user'] is not None

def logout():
    """ログアウト"""
    if 'user' in st.session_state:
        del st.session_state['user']
    if 'access_token' in st.session_state:
        del st.session_state['access_token']
    if 'oauth_state' in st.session_state:
        del st.session_state['oauth_state']
```

#### 3.4 `web.py`または各ページに認証チェックを追加

```python
# web.py または streamlit_app/pages/review.py

from streamlit_app.components.auth import is_authenticated, login_with_google, get_current_user

if not is_authenticated():
    st.title("ログインが必要です")
    login_with_google()
    st.stop()

# 認証済みの場合、通常の処理を続行
user = get_current_user()
st.write(f"ようこそ、{user['name']}さん")
```

### 4. 環境変数の設定

`.env`ファイルを作成（または環境変数を設定）：

```bash
# .env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
SECRET_KEY=your-secret-key-for-jwt
API_BASE_URL=http://localhost:8000
REDIRECT_URI=http://localhost:8501
```

### 5. `requirements.txt`に追加

```txt
python-jose[cryptography]>=3.3.0
google-auth>=2.23.0
google-auth-oauthlib>=1.1.0
google-auth-httplib2>=0.1.1
python-dotenv>=1.0.0  # 環境変数管理用
```

## 実装のステップ

### Step 1: データベーステーブルの作成
```bash
# models.pyにUserモデルを追加後、マイグレーション実行
python -c "from app.db import engine, Base; from app.models import User; Base.metadata.create_all(engine)"
```

### Step 2: Google Cloud Consoleで設定
- OAuth 2.0 クライアント IDを作成
- リダイレクト URIを設定

### Step 3: 環境変数を設定
- `.env`ファイルを作成
- 必要な環境変数を設定

### Step 4: 認証コードを実装
- `app/auth.py`を作成
- `app/main.py`に認証エンドポイントを追加
- `streamlit_app/components/auth.py`を作成

### Step 5: UIに認証を統合
- `web.py`または各ページに認証チェックを追加

### Step 6: テスト
- ローカル環境でGoogle認証をテスト

## まとめ

**データベース設計だけでは認証は動作しません。**

認証機能を実装するには：
1. ✅ データベーステーブルの作成（設計済み）
2. ⚠️ Google Cloud Consoleでの設定（手動で実施）
3. ⚠️ 認証コードの実装（`app/auth.py`など）
4. ⚠️ Streamlit UIの実装（`streamlit_app/components/auth.py`）
5. ⚠️ 環境変数の設定

**次のステップ:** 上記の実装を進めますか？それとも、まずデータベーステーブルだけを作成しますか？
