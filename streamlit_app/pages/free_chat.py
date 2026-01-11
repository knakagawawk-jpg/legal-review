"""フリーチャットページ"""
from typing import Optional
import streamlit as st
from streamlit_app.api_client import free_chat
from streamlit_app.components.styles import render_gradient_title


def render():
    """フリーチャットページを表示"""
    # ページ状態を保持
    st.session_state.current_page = "フリーチャット"
    
    # ヘッダー
    col1, col2 = st.columns([3, 1])
    with col1:
        render_gradient_title("💬 フリーチャット", level=1)
        st.caption("LLMと自由にチャットできます")
    with col2:
        st.markdown("<br>", unsafe_allow_html=True)
        if st.button("🗑️ 履歴をクリア", use_container_width=True, key="clear_all_history"):
            if "free_chat_history" in st.session_state:
                del st.session_state["free_chat_history"]
            st.rerun()
    
    st.markdown("---")
    
    # チャット履歴の初期化
    if "free_chat_history" not in st.session_state:
        st.session_state["free_chat_history"] = []
    
    chat_history = st.session_state["free_chat_history"]
    
    # チャット履歴を表示（スクロール可能なコンテナ）
    st.markdown("""
    <style>
    .free-chat-container {
        max-height: calc(100vh - 400px);
        overflow-y: auto;
        padding: 1rem;
        margin-bottom: 1rem;
    }
    .free-chat-container::-webkit-scrollbar {
        width: 8px;
    }
    .free-chat-container::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 4px;
    }
    .free-chat-container::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 4px;
    }
    .free-chat-container::-webkit-scrollbar-thumb:hover {
        background: #555;
    }
    </style>
    """, unsafe_allow_html=True)
    
    # チャット履歴の表示
    if chat_history:
        for msg in chat_history:
            if msg["role"] == "user":
                with st.chat_message("user"):
                    st.write(msg["content"])
            else:
                with st.chat_message("assistant"):
                    st.markdown(msg["content"])
    else:
        st.info("💡 自由に質問や会話を始めてください。法律に関する質問も、一般的な質問も可能です。")
    
    st.markdown("---")
    
    # 質問入力欄（下部に固定）
    col_input1, col_input2 = st.columns([5, 1])
    
    with col_input1:
        user_input = st.text_input(
            "メッセージを入力してください",
            key="free_chat_input",
            placeholder="例: 民法の時効について教えてください、または、今日の天気は？",
            label_visibility="collapsed"
        )
    
    with col_input2:
        send_button = st.button("送信", type="primary", key="free_chat_send", use_container_width=True)
    
    # 質問を送信
    if send_button and user_input.strip():
        # ユーザーのメッセージを履歴に追加（即座に表示）
        chat_history.append({"role": "user", "content": user_input.strip()})
        st.session_state["free_chat_history"] = chat_history
        
        # LLMからの回答を取得
        with st.spinner("考えています..."):
            try:
                # チャット履歴をAPI用の形式に変換（最後のユーザーメッセージは除く）
                api_chat_history = []
                for msg in chat_history[:-1]:  # 最後のユーザーメッセージは除外（APIで送るquestionに含まれるため）
                    api_chat_history.append({
                        "role": msg["role"],
                        "content": msg["content"]
                    })
                
                # APIを呼び出し
                answer = free_chat(
                    question=user_input.strip(),
                    chat_history=api_chat_history if api_chat_history else None
                )
                
                # LLMの回答を履歴に追加
                chat_history.append({"role": "assistant", "content": answer})
                st.session_state["free_chat_history"] = chat_history
                
                # 入力欄をクリアするため、session_stateの入力値をリセット
                st.session_state["free_chat_input"] = ""
                
                st.rerun()
                
            except Exception as e:
                error_msg = str(e)
                # エラーメッセージを履歴に追加（ユーザーに表示）
                error_response = f"申し訳ございませんが、エラーが発生しました: {error_msg}"
                chat_history.append({"role": "assistant", "content": error_response})
                st.session_state["free_chat_history"] = chat_history
                
                if "ConnectionError" in error_msg or "接続" in error_msg:
                    st.error("FastAPIサーバーに接続できません。サーバーが起動しているか確認してください。")
                elif "Timeout" in error_msg or "タイムアウト" in error_msg:
                    st.error("リクエストがタイムアウトしました。")
                else:
                    st.error(f"エラーが発生しました: {error_msg}")
                
                st.rerun()
