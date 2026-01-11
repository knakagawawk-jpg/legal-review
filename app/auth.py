"""認証機能（設定でON/OFF可能）"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
from jose import JWTError, jwt

from .db import SessionLocal
from .models import User
from config.settings import AUTH_ENABLED, GOOGLE_CLIENT_ID, SECRET_KEY, ALGORITHM

security = HTTPBearer(auto_error=False)  # 認証がなくてもエラーにしない

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def verify_google_token(token: str) -> dict:
    """Google IDトークンを検証"""
    if not AUTH_ENABLED or not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not enabled"
        )
    
    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests
        
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
        if name:
            user.name = name
        if picture:
            user.google_picture = picture
        from sqlalchemy.sql import func
        user.last_login_at = func.now()
    else:
        # 新規ユーザーを作成（デフォルトは無料プラン）
        user = User(
            google_id=google_id,
            email=email,
            name=name,
            google_picture=picture
        )
        db.add(user)
        # デフォルトの無料プランを設定（subscription_plansテーブルから取得）
        # ここでは簡略化のため、後で実装
    
    db.commit()
    db.refresh(user)
    return user

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    現在のユーザーを取得（認証オプション）
    認証がOFFの場合、またはトークンがない場合はNoneを返す
    """
    if not AUTH_ENABLED:
        return None
    
    if not credentials:
        return None
    
    try:
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
    except HTTPException:
        raise
    except Exception:
        # 認証エラーは無視してNoneを返す（認証オプションのため）
        return None

async def get_current_user_required(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    現在のユーザーを取得（認証必須）
    認証がOFFの場合、またはトークンがない場合はエラーを返す
    """
    if not AUTH_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is required but not enabled"
        )
    
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
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
