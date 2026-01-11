"""認証コンポーネント（設定でON/OFF可能）"""
import streamlit as st
import requests
from typing import Optional, Dict
import os

from streamlit_app.config import API_BASE_URL
from config.settings import AUTH_ENABLED, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

def is_authenticated() -> bool:
    """認証済みかどうかを確認"""
    if not AUTH_ENABLED:
        return False  # 認証がOFFの場合は常にFalse
    
    return 'user' in st.session_state and st.session_state.get('user') is not None

def get_current_user() -> Optional[Dict]:
    """現在のユーザーを取得"""
    if not AUTH_ENABLED:
        return None
    
    return st.session_state.get('user')

def login_with_google():
    """Googleでログイン（認証がOFFの場合は何もしない）"""
    if not AUTH_ENABLED:
        st.info("認証機能は現在無効になっています。")
        return False
    
    if not GOOGLE_CLIENT_ID:
        st.error("Google OAuth設定が完了していません。環境変数 GOOGLE_CLIENT_ID を設定してください。")
        return False
    
    try:
        from google_auth_oauthlib.flow import Flow
        
        redirect_uri = os.getenv("REDIRECT_URI", "http://localhost:8501")
        
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [redirect_uri]
                }
            },
            scopes=["openid", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"]
        )
        
        # 認証URLを生成
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'
        )
        
        # 状態を保存
        st.session_state['oauth_state'] = state
        st.session_state['oauth_flow'] = flow
        
        # 認証URLにリダイレクト
        st.markdown(f'<a href="{authorization_url}" target="_self">Googleでログイン</a>', unsafe_allow_html=True)
        
        return True
    except ImportError:
        st.error("google-auth-oauthlib がインストールされていません。pip install google-auth-oauthlib を実行してください。")
        return False
    except Exception as e:
        st.error(f"ログイン処理でエラーが発生しました: {str(e)}")
        return False

def handle_oauth_callback(code: str) -> bool:
    """OAuthコールバックを処理"""
    if not AUTH_ENABLED:
        return False
    
    try:
        flow = st.session_state.get('oauth_flow')
        if not flow:
            st.error("OAuthフローが見つかりません。再度ログインしてください。")
            return False
        
        # トークンを取得
        flow.fetch_token(code=code)
        
        # IDトークンを取得
        credentials = flow.credentials
        id_token = credentials.id_token
        
        if not id_token:
            st.error("IDトークンの取得に失敗しました。")
            return False
        
        # バックエンドAPIに送信
        response = requests.post(
            f"{API_BASE_URL}/v1/auth/google",
            json={"token": id_token}
        )
        
        if response.status_code == 200:
            user_data = response.json()
            st.session_state['user'] = user_data
            st.session_state['access_token'] = credentials.token
            # OAuthフローをクリア
            if 'oauth_flow' in st.session_state:
                del st.session_state['oauth_flow']
            if 'oauth_state' in st.session_state:
                del st.session_state['oauth_state']
            return True
        else:
            st.error(f"認証に失敗しました: {response.text}")
            return False
    except Exception as e:
        st.error(f"認証処理でエラーが発生しました: {str(e)}")
        return False

def logout():
    """ログアウト"""
    if 'user' in st.session_state:
        del st.session_state['user']
    if 'access_token' in st.session_state:
        del st.session_state['access_token']
    if 'oauth_state' in st.session_state:
        del st.session_state['oauth_state']
    if 'oauth_flow' in st.session_state:
        del st.session_state['oauth_flow']

def render_auth_status():
    """認証状態を表示（サイドバーなどで使用）"""
    if not AUTH_ENABLED:
        return
    
    if is_authenticated():
        user = get_current_user()
        st.sidebar.success(f"ログイン中: {user.get('name', user.get('email', 'Unknown'))}")
        if st.sidebar.button("ログアウト"):
            logout()
            st.rerun()
    else:
        st.sidebar.info("未ログイン")
        if st.sidebar.button("Googleでログイン"):
            login_with_google()
            st.rerun()
