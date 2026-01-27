"""認証機能（設定でON/OFF可能）"""
import logging
import hashlib
import time
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional, Dict, Tuple
from jose import JWTError, jwt

from .db import SessionLocal
from .models import User
from config.settings import (
    AUTH_ENABLED, GOOGLE_CLIENT_ID, SECRET_KEY, ALGORITHM,
    TOKEN_CACHE_TTL, TOKEN_CACHE_MAX_SIZE, JWT_ACCESS_TOKEN_EXPIRE_DAYS
)

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)  # 認証がなくてもエラーにしない

# トークン検証結果のキャッシュ（インメモリ）
# キー: トークンのハッシュ、値: (google_info, 有効期限のタイムスタンプ)
_token_cache: Dict[str, Tuple[dict, float]] = {}

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def _get_token_hash(token: str) -> str:
    """トークンのハッシュ値を取得（キャッシュキー用）"""
    return hashlib.sha256(token.encode()).hexdigest()

def _cleanup_expired_cache():
    """期限切れのキャッシュエントリを削除"""
    current_time = time.time()
    expired_keys = [
        key for key, (_, expiry) in _token_cache.items()
        if expiry < current_time
    ]
    for key in expired_keys:
        del _token_cache[key]
    
    # キャッシュサイズが大きすぎる場合は、古いエントリを削除
    if len(_token_cache) > TOKEN_CACHE_MAX_SIZE:
        # 有効期限が近い順にソートして、古いものを削除
        sorted_items = sorted(
            _token_cache.items(),
            key=lambda x: x[1][1]  # expiry timeでソート
        )
        # 半分を削除
        for key, _ in sorted_items[:len(sorted_items) // 2]:
            del _token_cache[key]
        logger.warning(
            f"Token cache size exceeded limit ({TOKEN_CACHE_MAX_SIZE}), "
            f"cleaned up to {len(_token_cache)} entries"
        )

async def verify_google_token(token: str) -> dict:
    """
    Google IDトークンを検証（キャッシュ付き）
    
    最適化:
    - 検証済みトークンの情報をキャッシュして再検証を回避
    - 詳細なエラーハンドリングとログ
    - トークンの有効期限に基づいたキャッシュTTL
    """
    if not AUTH_ENABLED or not GOOGLE_CLIENT_ID:
        logger.warning("Authentication attempt but AUTH_ENABLED is False or GOOGLE_CLIENT_ID is not set")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not enabled"
        )
    
    # キャッシュキーを生成
    cache_key = _get_token_hash(token)
    current_time = time.time()
    
    # キャッシュから取得を試みる
    if cache_key in _token_cache:
        cached_info, expiry_time = _token_cache[cache_key]
        if expiry_time > current_time:
            logger.debug(f"Token verification cache hit for key: {cache_key[:16]}...")
            return cached_info
        else:
            # 期限切れのキャッシュエントリを削除
            del _token_cache[cache_key]
            logger.debug(f"Token verification cache expired for key: {cache_key[:16]}...")
    
    # キャッシュにない、または期限切れの場合は検証を実行
    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests
        
        logger.debug("Verifying Google ID token with Google API")
        idinfo = id_token.verify_oauth2_token(
            token, requests.Request(), GOOGLE_CLIENT_ID
        )
        
        # 発行者の確認
        if idinfo.get('iss') not in ['accounts.google.com', 'https://accounts.google.com']:
            logger.warning(f"Invalid token issuer: {idinfo.get('iss')}")
            raise ValueError('Wrong issuer.')
        
        # 有効期限の確認とキャッシュTTLの設定
        exp = idinfo.get('exp')
        if exp:
            # トークンの有効期限までキャッシュ（ただし最大5分）
            cache_expiry = min(exp, current_time + TOKEN_CACHE_TTL)
        else:
            # 有効期限情報がない場合はデフォルトTTLを使用
            cache_expiry = current_time + TOKEN_CACHE_TTL
        
        # キャッシュに保存
        _cleanup_expired_cache()  # 定期的にクリーンアップ
        _token_cache[cache_key] = (idinfo, cache_expiry)
        logger.debug(f"Token verified and cached for key: {cache_key[:16]}... (expires at {cache_expiry})")
        
        return idinfo
        
    except ValueError as e:
        logger.warning(f"Token verification failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials: {str(e)}"
        )
    except Exception as e:
        # 予期しないエラー（ネットワークエラーなど）
        logger.error(f"Unexpected error during token verification: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Token verification service unavailable: {str(e)}"
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

def create_access_token(user_id: int, email: str) -> str:
    """
    JWTアクセストークンを発行
    
    Args:
        user_id: ユーザーID
        email: ユーザーのメールアドレス
    
    Returns:
        JWTトークン文字列
    """
    expire = datetime.utcnow() + timedelta(days=JWT_ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode = {
        "sub": str(user_id),  # subject: ユーザーID
        "email": email,
        "exp": expire,  # 有効期限
        "iat": datetime.utcnow(),  # 発行時刻
    }
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    logger.debug(f"JWT token created for user_id: {user_id}, expires at: {expire}")
    return encoded_jwt

def verify_jwt_token(token: str) -> dict:
    """
    JWTトークンを検証
    
    Args:
        token: JWTトークン文字列
    
    Returns:
        デコードされたトークンペイロード（user_id, emailなど）
    
    Raises:
        HTTPException: トークンが無効な場合
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str = payload.get("sub")
        email = payload.get("email")
        
        if user_id_str is None or email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload"
            )
        
        user_id: int = int(user_id_str)
        return {"user_id": user_id, "email": email}
    except JWTError as e:
        logger.warning(f"JWT token verification failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    except ValueError as e:
        logger.warning(f"JWT token payload invalid: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format"
        )

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    現在のユーザーを取得（認証オプション）
    認証がOFFの場合、またはトークンがない場合はNoneを返す
    
    トークンの種類を自動判定:
    1. JWTトークンの場合: 直接検証してユーザーを取得
    2. Google IDトークンの場合: Google APIで検証してからユーザーを取得または作成
    """
    if not AUTH_ENABLED:
        return None
    
    if not credentials:
        return None
    
    token = credentials.credentials
    
    try:
        # まずJWTトークンとして検証を試みる
        try:
            token_payload = verify_jwt_token(token)
            user_id = token_payload["user_id"]
            
            # データベースからユーザーを取得
            user = db.query(User).filter(User.id == user_id).first()
            
            if not user:
                logger.warning(f"JWT token valid but user not found: user_id={user_id}")
                return None
            
            if not user.is_active:
                logger.warning(f"Authentication attempt by disabled user: {user.email}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User account is disabled"
                )
            
            logger.debug(f"User authenticated via JWT: {user.email} (user_id: {user.id})")
            return user
            
        except HTTPException:
            # HTTPExceptionはそのまま再スロー
            raise
        except Exception:
            # JWTトークンとして検証失敗 → Google IDトークンとして試す
            pass
        
        # Google IDトークンとして検証（後方互換性のため）
        google_info = await verify_google_token(token)
        
        # ユーザーを取得または作成
        user = get_or_create_user(google_info, db)
        
        if not user.is_active:
            logger.warning(f"Authentication attempt by disabled user: {user.email}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is disabled"
            )
        
        logger.debug(f"User authenticated via Google ID token: {user.email} (user_id: {user.id})")
        return user
        
    except HTTPException:
        # HTTPExceptionはそのまま再スロー
        raise
    except Exception as e:
        # その他のエラーはログに記録してNoneを返す（認証オプションのため）
        logger.debug(f"Authentication failed (optional): {str(e)}", exc_info=True)
        return None

async def get_current_user_required(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    現在のユーザーを取得（認証必須）
    認証がOFFの場合、またはトークンがない場合はエラーを返す
    
    トークンの種類を自動判定:
    1. JWTトークンの場合: 直接検証してユーザーを取得
    2. Google IDトークンの場合: Google APIで検証してからユーザーを取得または作成
    
    最適化:
    - トークン検証結果のキャッシュ
    - 詳細なエラーハンドリングとログ
    """
    if not AUTH_ENABLED:
        logger.warning("Authentication required but AUTH_ENABLED is False")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is required but not enabled"
        )
    
    if not credentials:
        logger.debug("Authentication required but no credentials provided")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    token = credentials.credentials
    
    try:
        # まずJWTトークンとして検証を試みる
        try:
            token_payload = verify_jwt_token(token)
            user_id = token_payload["user_id"]
            
            # データベースからユーザーを取得
            user = db.query(User).filter(User.id == user_id).first()
            
            if not user:
                logger.warning(f"JWT token valid but user not found: user_id={user_id}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found"
                )
            
            if not user.is_active:
                logger.warning(f"Authentication attempt by disabled user: {user.email} (user_id: {user.id})")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User account is disabled"
                )
            
            logger.debug(f"User authenticated via JWT: {user.email} (user_id: {user.id})")
            return user
            
        except HTTPException:
            # HTTPExceptionはそのまま再スロー
            raise
        except Exception:
            # JWTトークンとして検証失敗 → Google IDトークンとして試す
            pass
        
        # Google IDトークンとして検証（後方互換性のため）
        google_info = await verify_google_token(token)
        
        # ユーザーを取得または作成
        user = get_or_create_user(google_info, db)
        
        if not user.is_active:
            logger.warning(f"Authentication attempt by disabled user: {user.email} (user_id: {user.id})")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is disabled"
            )
        
        logger.debug(f"User authenticated via Google ID token: {user.email} (user_id: {user.id})")
        return user
        
    except HTTPException:
        # HTTPExceptionはそのまま再スロー
        raise
    except Exception as e:
        # 予期しないエラー
        logger.error(f"Unexpected error during authentication: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service error"
        )

async def get_current_admin(
    current_user: User = Depends(get_current_user_required)
) -> User:
    """
    現在のユーザーが管理者かどうかを確認（認証必須）
    管理者でない場合は403エラーを返す
    """
    if not current_user.is_admin:
        logger.warning(f"Admin access attempt by non-admin user: {current_user.email} (user_id: {current_user.id})")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user
