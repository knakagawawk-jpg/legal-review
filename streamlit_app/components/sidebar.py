"""サイドバーナビゲーション"""
import streamlit as st
from streamlit_app.components.auth import render_auth_status


def render_sidebar():
    """サイドバーを表示"""
    # セッション状態で現在のページを保持（リロード時も維持）
    if "current_page" not in st.session_state:
        st.session_state.current_page = "講評生成"
    
    # ロゴ・タイトル
    st.sidebar.markdown("""
    <div style="text-align: center; padding: 1rem 0; margin-bottom: 2rem;">
        <h1 style="font-size: 1.8rem; margin: 0; color: #1f77b4;">⚖️ 答案講評</h1>
        <p style="color: #6c757d; font-size: 0.9rem; margin: 0.5rem 0 0 0;">法律答案の自動講評システム</p>
    </div>
    """, unsafe_allow_html=True)
    
    # ページ選択
    st.sidebar.markdown("### 🧭 ナビゲーション")
    
    # ページボタン
    pages = [
        ("📝 講評生成", "講評生成", "答案の講評を生成"),
        ("📝 短答式試験", "短答式試験", "短答式問題を解く"),
        ("📚 Your Page", "Your Page", "過去の記録とノート"),
        ("💬 フリーチャット", "フリーチャット", "LLMと自由にチャット")
    ]
    
    for icon_title, page_key, description in pages:
        is_active = st.session_state.current_page == page_key
        button_type = "primary" if is_active else "secondary"
        
        if st.sidebar.button(
            icon_title,
            use_container_width=True,
            type=button_type,
            key=f"nav_{page_key}"
        ):
            st.session_state.current_page = page_key
            st.rerun()
    
    st.sidebar.markdown("---")
    
    # キャッシュクリアボタン
    if st.sidebar.button("🔄 キャッシュをクリア", use_container_width=True):
        # セッション状態のキャッシュをクリア
        if "cached_years" in st.session_state:
            del st.session_state["cached_years"]
        if "cached_subjects" in st.session_state:
            del st.session_state["cached_subjects"]
        st.success("キャッシュをクリアしました")
        st.rerun()
    
    # 開発用ボタン
    if st.sidebar.button("🔧 開発用", use_container_width=True):
        st.session_state.current_page = "開発用"
        st.rerun()
    
    st.sidebar.markdown("---")
    
    # 認証状態を表示
    render_auth_status()
    
    return st.session_state.current_page
