# ユーザー管理機能 実装計画

## 要件

1. **ログイン**: Gmail（Google OAuth 2.0）
2. **課金プラン**: 3パターン
3. **ユーザーデータ保持**:
   - 過去の答案（Submissions）
   - 講評（Reviews）
   - 短答正解歴（ShortAnswerAnswers）

## 技術的な難しさの評価

### ✅ 比較的簡単な部分

1. **データベーススキーマの拡張**
   - 既存テーブルに`user_id`を追加するだけ
   - マイグレーションスクリプトで対応可能

2. **ユーザーモデルの追加**
   - SQLAlchemyモデルとして追加
   - 課金プラン情報も含める

3. **APIエンドポイントの拡張**
   - 既存エンドポイントに認証チェックを追加
   - ユーザー関連のエンドポイントを追加

### ⚠️ 中程度の難しさ

1. **Google OAuth認証**
   - FastAPI側: `python-jose`, `passlib`を使用
   - Streamlit側: `streamlit-authenticator`または独自実装
   - OAuthフローの実装が必要

2. **認証ミドルウェア**
   - FastAPIの依存性注入で認証チェック
   - JWTトークンの管理

3. **Streamlitでの認証状態管理**
   - `st.session_state`で認証状態を保持
   - ページリロード時の状態維持

### 🔴 注意が必要な部分

1. **既存データの移行**
   - 既存の`submissions`や`reviews`に`user_id`がない
   - マイグレーション戦略が必要

2. **課金プランの実装**
   - プランごとの機能制限ロジック
   - プラン変更時の処理

3. **セキュリティ**
   - トークンの安全な保存
   - CSRF対策
   - ユーザー間のデータ分離

## 実装計画

### Phase 1: データベーススキーマの拡張

#### 1.1 ユーザーモデルの追加

```python
# app/models.py に追加

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=True)
    google_id = Column(String(255), unique=True, nullable=True, index=True)
    subscription_plan = Column(String(20), nullable=False, default="free")  # "free", "basic", "premium"
    subscription_started_at = Column(DateTime(timezone=True), nullable=True)
    subscription_expires_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    submissions = relationship("Submission", back_populates="user")
    short_answer_sessions = relationship("ShortAnswerSession", back_populates="user")
```

#### 1.2 既存テーブルへの`user_id`追加

```python
# Submission に追加
user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
user = relationship("User", back_populates="submissions")

# Review は Submission 経由でアクセス可能なので追加不要

# ShortAnswerSession の user_id を NOT NULL に変更（新規作成時）
# 既存データはマイグレーションで対応
```

#### 1.3 課金プランモデル（オプション）

```python
class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"
    id = Column(Integer, primary_key=True, index=True)
    plan_code = Column(String(20), unique=True, nullable=False)  # "free", "basic", "premium"
    name = Column(String(50), nullable=False)
    max_reviews_per_month = Column(Integer, nullable=True)  # NULL = 無制限
    max_short_answer_sessions_per_month = Column(Integer, nullable=True)
    price_monthly = Column(Integer, nullable=True)  # 円
    features = Column(Text, nullable=True)  # JSON形式で機能リスト
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

### Phase 2: 認証システムの実装

#### 2.1 必要なパッケージ

```txt
# requirements.txt に追加
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
python-multipart>=0.0.6
google-auth>=2.23.0
google-auth-oauthlib>=1.1.0
google-auth-httplib2>=0.1.1
```

#### 2.2 認証サービス

```python
# app/auth.py を新規作成

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from google.oauth2 import id_token
from google.auth.transport import requests
import os

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def verify_google_token(token: str):
    """Google IDトークンを検証"""
    try:
        idinfo = id_token.verify_oauth2_token(
            token, requests.Request(), GOOGLE_CLIENT_ID
        )
        return idinfo
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    """現在のユーザーを取得"""
    # JWTトークンからユーザー情報を取得
    # またはセッションから取得
    pass
```

#### 2.3 Streamlit認証コンポーネント

```python
# streamlit_app/components/auth.py を新規作成

import streamlit as st
import requests
from google_auth_oauthlib.flow import Flow

def init_google_oauth():
    """Google OAuthフローを初期化"""
    # OAuth設定
    pass

def login_with_google():
    """Googleでログイン"""
    # OAuthフローを開始
    pass

def get_current_user():
    """現在のユーザーを取得"""
    if "user" not in st.session_state:
        return None
    return st.session_state.user
```

### Phase 3: APIエンドポイントの拡張

#### 3.1 認証が必要なエンドポイントの保護

```python
# app/main.py

from .auth import get_current_user
from .models import User

@app.post("/v1/review", response_model=ReviewResponse)
def create_review(
    req: ReviewRequest,
    current_user: User = Depends(get_current_user),  # 認証必須
    db: Session = Depends(get_db)
):
    # ユーザーの課金プランをチェック
    # 制限を超えていないか確認
    
    # Submission作成時にuser_idを設定
    sub = Submission(
        user_id=current_user.id,
        problem_id=req.problem_id,
        # ...
    )
    # ...
```

#### 3.2 ユーザー関連エンドポイント

```python
@app.get("/v1/users/me")
def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """現在のユーザー情報を取得"""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "subscription_plan": current_user.subscription_plan,
    }

@app.get("/v1/users/me/submissions")
def get_my_submissions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """自分の答案一覧を取得"""
    submissions = db.query(Submission).filter(
        Submission.user_id == current_user.id
    ).all()
    return submissions

@app.get("/v1/users/me/reviews")
def get_my_reviews(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """自分の講評一覧を取得"""
    # Submission経由でReviewを取得
    pass
```

### Phase 4: 課金プランの実装

#### 4.1 プラン定義

```python
# config/subscription_plans.py

SUBSCRIPTION_PLANS = {
    "free": {
        "name": "無料プラン",
        "max_reviews_per_month": 5,
        "max_short_answer_sessions_per_month": 10,
        "features": ["基本的な講評生成", "短答式問題（制限あり）"]
    },
    "basic": {
        "name": "ベーシックプラン",
        "max_reviews_per_month": 50,
        "max_short_answer_sessions_per_month": 100,
        "price_monthly": 980,
        "features": ["講評生成（月50回）", "短答式問題（月100セッション）", "講評チャット"]
    },
    "premium": {
        "name": "プレミアムプラン",
        "max_reviews_per_month": None,  # 無制限
        "max_short_answer_sessions_per_month": None,
        "price_monthly": 2980,
        "features": ["講評生成（無制限）", "短答式問題（無制限）", "講評チャット", "優先サポート"]
    }
}
```

#### 4.2 使用量チェック

```python
# app/utils/usage_check.py

def check_review_limit(user: User, db: Session) -> bool:
    """講評生成の制限をチェック"""
    plan = SUBSCRIPTION_PLANS.get(user.subscription_plan, SUBSCRIPTION_PLANS["free"])
    max_reviews = plan.get("max_reviews_per_month")
    
    if max_reviews is None:
        return True  # 無制限
    
    # 今月の使用回数をカウント
    from datetime import datetime, timedelta
    start_of_month = datetime.now().replace(day=1, hour=0, minute=0, second=0)
    
    count = db.query(Review).join(Submission).filter(
        Submission.user_id == user.id,
        Review.created_at >= start_of_month
    ).count()
    
    return count < max_reviews
```

### Phase 5: マイグレーション

#### 5.1 既存データの処理

```python
# scripts/migrate_add_user_id.py

"""
既存のsubmissionsやshort_answer_sessionsにuser_idを追加するマイグレーション
匿名ユーザー用のダミーユーザーを作成するか、NULLのままにするか判断が必要
"""

def migrate_existing_data():
    # 1. 匿名ユーザーを作成（オプション）
    # 2. 既存データにuser_idを設定
    pass
```

## 実装の優先順位

1. **Phase 1**: データベーススキーマの拡張（必須）
2. **Phase 2**: 認証システムの実装（必須）
3. **Phase 3**: APIエンドポイントの拡張（必須）
4. **Phase 4**: 課金プランの実装（重要）
5. **Phase 5**: マイグレーション（重要）

## 技術的な難しさの総評

### 難易度: ⭐⭐⭐ (中程度)

**理由:**
- ✅ 既存のアーキテクチャが整理されているため、拡張しやすい
- ✅ SQLAlchemyとFastAPIの組み合わせで認証は標準的な実装パターンがある
- ⚠️ Google OAuthの実装は初回は学習コストがあるが、ライブラリが充実している
- ⚠️ Streamlitでの認証状態管理は少し工夫が必要
- 🔴 既存データの移行は慎重に設計する必要がある

**推奨アプローチ:**
1. まずは認証なしで`user_id`をNULL許容で追加
2. 認証機能を実装
3. 段階的に既存機能を認証必須に変更
4. 課金プランの制限を追加

## セキュリティ考慮事項

1. **トークンの保存**
   - JWTトークンはHTTPOnly Cookieに保存（推奨）
   - Streamlitでは`st.session_state`に保存（サーバーサイドのみ）

2. **CSRF対策**
   - SameSite Cookie属性の設定
   - CSRFトークンの実装（必要に応じて）

3. **データ分離**
   - すべてのクエリで`user_id`を必ずフィルタリング
   - 管理者権限の実装（必要に応じて）

## 参考リソース

- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Streamlit Authentication](https://github.com/mkhorasani/Streamlit-Authenticator)
