"""講評結果表示ページ"""
from typing import Optional
import streamlit as st
from streamlit_app.api_client import get_review, chat_review
from streamlit_app.components.styles import render_gradient_title

# 固定レイアウト用のCSSとJavaScript
def _get_fixed_layout_script():
    """固定レイアウト用のCSSとJavaScriptを生成"""
    return """
    <style>
    /* 講評結果ページ専用の固定レイアウト */
    .review-panel-column {
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        background: #fafafa;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        height: calc(100vh - 500px);
        min-height: 500px;
    }
    
    .review-panel-column .stTabs {
        flex: 1;
        display: flex !important;
        flex-direction: column !important;
        min-height: 0;
        overflow: hidden;
    }
    
    .review-panel-column .stTabs [data-baseweb="tab-list"] {
        flex-shrink: 0;
        padding: 0.5rem 1rem 0 1rem;
    }
    
    .review-panel-column .stTabs [data-baseweb="tab-panel"] {
        flex: 1;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        padding: 1rem;
        min-height: 0;
        max-height: 100%;
    }
    
    .review-chat-wrapper {
        height: 300px;
        min-height: 300px;
        max-height: 300px;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        background: #ffffff;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        margin-top: 1rem;
    }
    
    .review-chat-header {
        padding: 0.75rem 1rem;
        background: #f8f9fa;
        border-bottom: 1px solid #e0e0e0;
        flex-shrink: 0;
    }
    
    .review-chat-messages-wrapper {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 1rem;
        min-height: 0;
    }
    
    .review-chat-input-wrapper {
        border-top: 1px solid #e0e0e0;
        padding: 1rem;
        background: #fafafa;
        flex-shrink: 0;
    }
    
    /* スクロールバーのスタイル */
    .review-panel-column .stTabs [data-baseweb="tab-panel"]::-webkit-scrollbar,
    .review-chat-messages-wrapper::-webkit-scrollbar {
        width: 8px;
    }
    
    .review-panel-column .stTabs [data-baseweb="tab-panel"]::-webkit-scrollbar-track,
    .review-chat-messages-wrapper::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 4px;
    }
    
    .review-panel-column .stTabs [data-baseweb="tab-panel"]::-webkit-scrollbar-thumb,
    .review-chat-messages-wrapper::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 4px;
    }
    
    .review-panel-column .stTabs [data-baseweb="tab-panel"]::-webkit-scrollbar-thumb:hover,
    .review-chat-messages-wrapper::-webkit-scrollbar-thumb:hover {
        background: #555;
    }
    </style>
    <script>
    function setFixedPanelHeight() {
        // st.columns要素を検索
        const columnContainers = document.querySelectorAll('[data-testid="column"]');
        if (columnContainers.length < 2) {
            setTimeout(setFixedPanelHeight, 200);
            return;
        }
        
        // ヘッダー、スライダー、チャット欄の高さを計算
        const headerHeight = document.querySelector('header')?.offsetHeight || 80;
        const sliderContainer = document.querySelector('[data-testid="stSlider"]')?.closest('.element-container');
        const sliderHeight = sliderContainer ? sliderContainer.offsetHeight + 60 : 120;
        const chatHeight = 350;
        const availableHeight = window.innerHeight - headerHeight - sliderHeight - chatHeight;
        const panelHeight = Math.max(500, availableHeight);
        
        // 各カラム内のタブコンテナを検索してラッパーで囲む
        columnContainers.forEach((col) => {
            // 既にラッパーが適用されているか確認
            let wrapper = col.querySelector('.review-panel-column');
            const tabsElement = col.querySelector('.stTabs');
            
            if (tabsElement) {
                if (!wrapper) {
                    // ラッパーが存在しない場合、タブ要素をラッパーで囲む
                    wrapper = document.createElement('div');
                    wrapper.className = 'review-panel-column';
                    wrapper.style.height = panelHeight + 'px';
                    tabsElement.parentNode.insertBefore(wrapper, tabsElement);
                    wrapper.appendChild(tabsElement);
                } else {
                    // 既存のラッパーの高さを更新
                    wrapper.style.height = panelHeight + 'px';
                }
            }
        });
    }
    
    // ページ読み込み時とリサイズ時に実行
    function initPanelHeight() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(setFixedPanelHeight, 500);
            });
        } else {
            setTimeout(setFixedPanelHeight, 500);
        }
    }
    
    initPanelHeight();
    window.addEventListener('resize', setFixedPanelHeight);
    
    // Streamlitの再実行後に再適用
    const observer = new MutationObserver(() => {
        setTimeout(setFixedPanelHeight, 500);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    </script>
    """


def render():
    """講評結果ページを表示"""
    # ページ状態を保持
    st.session_state.current_page = "講評結果"
    
    # session_stateまたはURLパラメータからsubmission_idを取得
    submission_id = None
    
    # まず一時的なsession_stateを確認（講評生成直後の遷移の場合）- これを最初に確認
    if "review_submission_id" in st.session_state:
        submission_id = st.session_state["review_submission_id"]
        # 永続的なキーに保存してから削除
        st.session_state["current_submission_id"] = submission_id
        del st.session_state["review_submission_id"]
    
    # 次に永続的なsession_stateを確認
    if not submission_id and "current_submission_id" in st.session_state:
        submission_id = st.session_state["current_submission_id"]
    
    # session_stateにない場合はURLパラメータを確認
    if not submission_id:
        query_params = st.query_params
        submission_id_param = query_params.get("submission_id", None)
        if submission_id_param:
            try:
                submission_id = int(submission_id_param)
                # 永続的なキーに保存
                st.session_state["current_submission_id"] = submission_id
            except ValueError:
                st.error("無効な講評IDです。")
                st.stop()
    
    if not submission_id:
        st.error("講評IDが指定されていません。")
        st.info("講評生成ページから講評を生成してください。")
        # デバッグ情報を表示（開発時のみ）
        with st.expander("デバッグ情報（クリックして展開）"):
            st.write("session_stateの内容:")
            st.json({
                "review_submission_id": st.session_state.get("review_submission_id", "なし"),
                "current_submission_id": st.session_state.get("current_submission_id", "なし"),
                "current_page": st.session_state.get("current_page", "なし"),
            })
            st.write("URLパラメータ:")
            st.json(dict(st.query_params))
        if st.button("講評生成ページに戻る"):
            st.session_state.current_page = "講評生成"
            st.rerun()
        st.stop()
    
    # ヘッダー
    col1, col2 = st.columns([3, 1])
    with col1:
        render_gradient_title("📊 講評結果", level=1)
        st.caption("生成された講評を表示します")
    with col2:
        st.markdown("<br>", unsafe_allow_html=True)
        if st.button("← 戻る", use_container_width=True):
            st.session_state.current_page = "講評生成"
            st.rerun()
    
    st.markdown("---")
    
    # 講評を取得
    with st.spinner("講評を読み込み中..."):
        try:
            result = get_review(submission_id)
        except Exception as e:
            error_msg = str(e)
            if "404" in error_msg or "not found" in error_msg.lower():
                st.error("講評が見つかりませんでした。")
            elif "ConnectionError" in error_msg or "接続" in error_msg:
                st.error("FastAPIサーバーに接続できません。サーバーが起動しているか確認してください。")
            else:
                st.error(f"講評の取得に失敗しました: {error_msg}")
            st.stop()
    
    # 表示割合の調整（デフォルト4:6、可変）
    ratio_key = f"panel_ratio_{submission_id}"
    if ratio_key not in st.session_state:
        st.session_state[ratio_key] = 4  # デフォルトは左側4
    
    # ヘッダー下部に表示割合調整UI
    col_ratio1, col_ratio2, col_ratio3 = st.columns([1, 2, 1])
    with col_ratio2:
        ratio_value = st.slider(
            "左右パネルの表示割合",
            min_value=1,
            max_value=9,
            value=st.session_state[ratio_key],
            key=f"ratio_slider_{submission_id}",
            help="左側の割合を調整します（右側は自動的に調整されます）"
        )
        st.session_state[ratio_key] = ratio_value
    
    # 左右パネルの割合を計算
    left_ratio = st.session_state[ratio_key]
    right_ratio = 10 - left_ratio
    
    # 固定レイアウト用のCSSとJavaScriptを適用
    st.markdown(_get_fixed_layout_script(), unsafe_allow_html=True)
    
    # 左右パネルをカラムで配置（Streamlitの標準機能を使用）
    left_col, right_col = st.columns([left_ratio, right_ratio], gap="medium")
    
    # 左パネル: 答案と問題文のタブ（JavaScriptで固定高さを設定）
    with left_col:
        left_tabs = st.tabs(["📝 答案", "📄 問題文"])
        
        # 答案タブ
        with left_tabs[0]:
            st.markdown("### 📝 提出答案")
            answer_text = result.get("answer_text", "")
            st.markdown(f"""
            <div style="background: white; padding: 1rem; border-radius: 8px; border: 2px solid #e0e0e0; white-space: pre-wrap; font-family: monospace; line-height: 1.6; margin-bottom: 1rem;">
            {answer_text.replace('<', '&lt;').replace('>', '&gt;').replace('&', '&amp;')}
            </div>
            """, unsafe_allow_html=True)
            
            # コピーボタン
            if st.button("📋 答案をコピー", key=f"copy_answer_{submission_id}", use_container_width=True):
                st.code(result.get("answer_text", ""), language=None)
                st.success("答案をクリップボードにコピーしました（表示されたコードを選択してCtrl+C）")
        
        # 問題文タブ
        with left_tabs[1]:
            if result.get("question_text"):
                st.markdown("### 📄 問題文")
                question_text = result.get("question_text", "")
                st.markdown(f"""
                <div style="background: white; padding: 1rem; border-radius: 8px; border: 2px solid #e0e0e0; white-space: pre-wrap; font-family: monospace; line-height: 1.6; margin-bottom: 1rem;">
                {question_text.replace('<', '&lt;').replace('>', '&gt;').replace('&', '&amp;')}
                </div>
                """, unsafe_allow_html=True)
                
                if result.get("purpose"):
                    st.markdown("#### 🎯 出題趣旨")
                    purpose_text = result.get("purpose", "")
                    st.markdown(f"""
                    <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; border: 2px solid #e0e0e0; white-space: pre-wrap; line-height: 1.6; margin-top: 1rem;">
                    {purpose_text.replace('<', '&lt;').replace('>', '&gt;').replace('&', '&amp;')}
                    </div>
                    """, unsafe_allow_html=True)
                
                if result.get("subject"):
                    st.info(f"**科目**: {result.get('subject')}")
            else:
                st.info("問題文がありません。")
    
    # 右パネル: 講評、問題文、詳細情報のタブ（JavaScriptで固定高さを設定）
    with right_col:
        right_tab_labels = ["📊 講評", "📄 問題文"]
        if result.get("review_json"):
            right_tab_labels.append("📋 詳細情報")
        
        right_tabs = st.tabs(right_tab_labels)
        
        # 講評タブ
        with right_tabs[0]:
            st.markdown("### 📊 講評結果")
            review_markdown = result.get("review_markdown", "")
            st.markdown("""
            <div style="background: white; 
                        padding: 1.5rem; 
                        border-radius: 8px; 
                        border-left: 4px solid #667eea;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        margin-bottom: 1rem;">
            """, unsafe_allow_html=True)
            st.markdown(review_markdown)
            st.markdown("</div>", unsafe_allow_html=True)
            st.info(f"📝 提出ID: {result['submission_id']}")
        
        # 問題文タブ
        with right_tabs[1]:
            if result.get("question_text"):
                st.markdown("### 📄 問題文")
                question_text = result.get("question_text", "")
                st.markdown(f"""
                <div style="background: white; padding: 1rem; border-radius: 8px; border: 2px solid #e0e0e0; white-space: pre-wrap; font-family: monospace; line-height: 1.6; margin-bottom: 1rem;">
                {question_text.replace('<', '&lt;').replace('>', '&gt;').replace('&', '&amp;')}
                </div>
                """, unsafe_allow_html=True)
                
                if result.get("purpose"):
                    st.markdown("#### 🎯 出題趣旨")
                    purpose_text = result.get("purpose", "")
                    st.markdown(f"""
                    <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; border: 2px solid #e0e0e0; white-space: pre-wrap; line-height: 1.6; margin-top: 1rem;">
                    {purpose_text.replace('<', '&lt;').replace('>', '&gt;').replace('&', '&amp;')}
                    </div>
                    """, unsafe_allow_html=True)
                
                if result.get("subject"):
                    st.info(f"**科目**: {result.get('subject')}")
            else:
                st.info("問題文がありません。")
        
        # 詳細情報タブ
        if len(right_tabs) > 2:
            with right_tabs[2]:
                st.markdown("### 📋 詳細情報（JSON）")
                st.json(result["review_json"])
    
    # 下部チャット欄（固定高さ）
    _render_chat_section(
        submission_id=submission_id
    )


def _render_chat_section(submission_id: Optional[int]):
    """講評に関するチャットセクションを表示（固定高さのスクロール可能なコンテナ）"""
    # submission_idが存在しない場合はエラーメッセージを表示して終了
    if not submission_id:
        st.markdown('<div class="review-chat-wrapper">', unsafe_allow_html=True)
        st.error("講評IDが指定されていません。")
        st.info("講評生成ページから講評を生成してください。")
        if st.button("講評生成ページに戻る", key="back_to_review_from_chat_section"):
            st.session_state.current_page = "講評生成"
            st.rerun()
        st.markdown("</div>", unsafe_allow_html=True)
        return
    
    # チャット履歴の初期化
    chat_history_key = f"chat_history_{submission_id}"
    if chat_history_key not in st.session_state:
        st.session_state[chat_history_key] = []
    
    chat_history = st.session_state[chat_history_key]
    
    # チャットコンテナの開始
    st.markdown('<div class="review-chat-wrapper">', unsafe_allow_html=True)
    
    # チャットヘッダー
    st.markdown("""
    <div class="review-chat-header">
        <h4 style="margin: 0; color: #2c3e50;">💬 講評について質問する</h4>
        <small style="color: #6c757d;">講評の内容について、LLMに自由に質問できます。</small>
    </div>
    """, unsafe_allow_html=True)
    
    # チャット履歴を表示（固定高さのスクロール可能なコンテナ）
    st.markdown('<div class="review-chat-messages-wrapper">', unsafe_allow_html=True)
    if chat_history:
        for i, msg in enumerate(chat_history):
            if msg["role"] == "user":
                with st.chat_message("user"):
                    st.write(msg["content"])
            else:
                with st.chat_message("assistant"):
                    st.markdown(msg["content"])
    else:
        st.info("💡 講評に関する質問を入力してください。")
    st.markdown("</div>", unsafe_allow_html=True)
    
    # 質問入力欄（下部に固定）
    st.markdown('<div class="review-chat-input-wrapper">', unsafe_allow_html=True)
    col_input1, col_input2, col_input3 = st.columns([6, 1, 1])
    
    with col_input1:
        user_question = st.text_input(
            "質問を入力してください",
            key=f"chat_input_{submission_id}",
            placeholder="例: この答案の改善点をもっと詳しく教えてください",
            label_visibility="collapsed"
        )
    
    with col_input2:
        send_button = st.button("送信", type="primary", key=f"chat_send_{submission_id}", use_container_width=True)
    
    with col_input3:
        if chat_history:
            clear_button = st.button("履歴クリア", key=f"chat_clear_{submission_id}", use_container_width=True)
        else:
            clear_button = False
    st.markdown("</div>", unsafe_allow_html=True)
    
    # チャットコンテナの終了
    st.markdown("</div>", unsafe_allow_html=True)
    
    # 履歴クリア
    if clear_button:
        st.session_state[chat_history_key] = []
        st.rerun()
    
    # 質問を送信
    if send_button and user_question.strip():
        # submission_idが存在するか確認
        if not submission_id:
            st.error("講評IDが指定されていません。ページを再読み込みしてください。")
            st.info("講評生成ページから講評を生成してください。")
            if st.button("講評生成ページに戻る", key="back_to_review_from_chat"):
                st.session_state.current_page = "講評生成"
                st.rerun()
        else:
            with st.spinner("回答を生成中..."):
                try:
                    # チャット履歴をAPI用の形式に変換
                    api_chat_history = []
                    for msg in chat_history:
                        api_chat_history.append({
                            "role": msg["role"],
                            "content": msg["content"]
                        })
                    
                    # APIを呼び出し
                    answer = chat_review(
                        submission_id=submission_id,
                        question=user_question,
                        chat_history=api_chat_history if api_chat_history else None
                    )
                    
                    # チャット履歴に追加
                    chat_history.append({"role": "user", "content": user_question})
                    chat_history.append({"role": "assistant", "content": answer})
                    st.session_state[chat_history_key] = chat_history
                    
                    # 入力欄をクリアするため、session_stateの入力値をリセット
                    st.session_state[f"chat_input_{submission_id}"] = ""
                    
                    st.rerun()
                    
                except Exception as e:
                    error_msg = str(e)
                    if "ConnectionError" in error_msg or "接続" in error_msg:
                        st.error("FastAPIサーバーに接続できません。サーバーが起動しているか確認してください。")
                    elif "Timeout" in error_msg or "タイムアウト" in error_msg:
                        st.error("リクエストがタイムアウトしました。")
                    elif "404" in error_msg or "not found" in error_msg.lower():
                        st.error("講評または提出が見つかりませんでした。ページを再読み込みしてください。")
                    else:
                        st.error(f"エラーが発生しました: {error_msg}")
