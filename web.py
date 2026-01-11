"""メインエントリーポイント - ルーティングのみ"""
import streamlit as st
from streamlit_app.components.sidebar import render_sidebar
from streamlit_app.components.styles import apply_custom_css
from streamlit_app.pages import review, short_answer, your_page, review_result, dev, free_chat

# ページ設定
st.set_page_config(
    page_title="答案講評システム",
    page_icon="⚖️",
    layout="wide",
    initial_sidebar_state="expanded",
    menu_items={
        'Get Help': None,
        'Report a bug': None,
        'About': "# 答案講評システム\n法律答案の自動講評を生成するシステムです。"
    }
)

# カスタムCSSを適用
apply_custom_css()

# サイドバーを表示して現在のページを取得
page = render_sidebar()

# ページに応じてルーティング
if page == "講評生成":
    review.render()
elif page == "講評結果":
    review_result.render()
elif page == "短答式試験":
    short_answer.render()
elif page == "Your Page":
    your_page.render()
elif page == "開発用":
    dev.render()
elif page == "フリーチャット":
    free_chat.render()
