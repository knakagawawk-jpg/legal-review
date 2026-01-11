"""開発用ページ - 各種ページの検証用"""
import streamlit as st
from streamlit_app.api_client import chat_review, get_all_submissions_dev
from streamlit_app.components.styles import render_gradient_title


def render():
    """開発用ページを表示"""
    st.session_state.current_page = "開発用"
    
    # ヘッダー
    col1, col2 = st.columns([3, 1])
    with col1:
        render_gradient_title("🔧 開発用ページ", level=1)
        st.caption("各種ページの検証とデバッグを行います")
    with col2:
        st.markdown("<br>", unsafe_allow_html=True)
        if st.button("← 戻る", use_container_width=True):
            st.session_state.current_page = "講評生成"
            st.rerun()
    
    st.markdown("---")
    
    # タブで各種ページへのアクセスを提供
    dev_tabs = st.tabs(["📊 講評結果検証", "📋 過去の講評一覧"])
    
    with dev_tabs[0]:
        _render_review_result_dev()
    
    with dev_tabs[1]:
        _render_submission_list()


def _render_review_result_dev():
    """講評結果ページの検証用ビュー"""
    st.markdown("### 📊 講評結果ページの検証")
    st.caption("空データや任意の入力で講評結果ページの動作を検証できます")
    
    # 入力データのセクション
    st.markdown("---")
    st.markdown("#### 📝 入力データ")
    
    col_input1, col_input2 = st.columns(2)
    
    with col_input1:
        # 講評ID（オプション）
        submission_id = st.number_input(
            "講評ID（既存の講評を表示する場合）",
            min_value=1,
            value=None,
            key="dev_submission_id",
            help="既存の講評IDを入力すると、そのデータを読み込みます"
        )
        
        # 既存の講評を読み込むボタン
        if submission_id and st.button("既存講評を読み込む", key="dev_load_review", use_container_width=True):
            try:
                from streamlit_app.api_client import get_review
                result = get_review(int(submission_id))
                st.session_state["dev_review_data"] = result
                st.success(f"✅ 講評ID {submission_id} を読み込みました")
            except Exception as e:
                st.error(f"講評の読み込みに失敗しました: {str(e)}")
    
    with col_input2:
        # データをクリアするボタン
        if st.button("データをクリア", key="dev_clear_data", use_container_width=True):
            if "dev_review_data" in st.session_state:
                del st.session_state["dev_review_data"]
            st.rerun()
    
    st.markdown("---")
    
    # 入力可能なデータ
    if "dev_review_data" not in st.session_state:
        st.session_state["dev_review_data"] = {}
    
    data = st.session_state["dev_review_data"]
    
    # データ入力セクション
    input_tabs = st.tabs(["📝 答案", "📄 問題文", "📊 講評結果", "ℹ️ その他"])
    
    with input_tabs[0]:
        answer_text = st.text_area(
            "答案テキスト",
            value=data.get("answer_text", ""),
            height=300,
            key="dev_answer_text",
            help="任意の答案テキストを入力できます"
        )
        st.session_state["dev_review_data"]["answer_text"] = answer_text
    
    with input_tabs[1]:
        question_text = st.text_area(
            "問題文",
            value=data.get("question_text", ""),
            height=200,
            key="dev_question_text",
            help="任意の問題文を入力できます"
        )
        st.session_state["dev_review_data"]["question_text"] = question_text
        
        purpose_text = st.text_area(
            "出題趣旨",
            value=data.get("purpose", ""),
            height=150,
            key="dev_purpose_text",
            help="任意の出題趣旨を入力できます"
        )
        st.session_state["dev_review_data"]["purpose"] = purpose_text
        
        subject_text = st.text_input(
            "科目",
            value=data.get("subject", ""),
            key="dev_subject_text",
            help="任意の科目を入力できます"
        )
        st.session_state["dev_review_data"]["subject"] = subject_text
    
    with input_tabs[2]:
        review_markdown = st.text_area(
            "講評結果（Markdown形式）",
            value=data.get("review_markdown", ""),
            height=400,
            key="dev_review_markdown",
            help="任意の講評結果（Markdown形式）を入力できます"
        )
        st.session_state["dev_review_data"]["review_markdown"] = review_markdown
        
        # JSONデータの入力
        import json
        review_json_str = st.text_area(
            "講評結果（JSON形式）",
            value=json.dumps(data.get("review_json", {}), ensure_ascii=False, indent=2) if data.get("review_json") else "{}",
            height=300,
            key="dev_review_json",
            help="任意の講評結果（JSON形式）を入力できます"
        )
        try:
            st.session_state["dev_review_data"]["review_json"] = json.loads(review_json_str)
        except:
            st.session_state["dev_review_data"]["review_json"] = {}
    
    with input_tabs[3]:
        submission_id_display = st.number_input(
            "表示用Submission ID",
            min_value=1,
            value=data.get("submission_id", 99999),
            key="dev_display_submission_id",
            help="表示用のSubmission ID（チャット機能で使用）"
        )
        st.session_state["dev_review_data"]["submission_id"] = submission_id_display
    
    st.markdown("---")
    
    # 表示割合の調整
    ratio_key = "dev_panel_ratio"
    if ratio_key not in st.session_state:
        st.session_state[ratio_key] = 4
    
    col_ratio1, col_ratio2, col_ratio3 = st.columns([1, 2, 1])
    with col_ratio2:
        ratio_value = st.slider(
            "左右パネルの表示割合",
            min_value=1,
            max_value=9,
            value=st.session_state[ratio_key],
            key="dev_ratio_slider",
            help="左側の割合を調整します"
        )
        st.session_state[ratio_key] = ratio_value
    
    st.markdown("---")
    
    # 講評結果ページと同様のレイアウトで表示
    left_ratio = st.session_state[ratio_key]
    right_ratio = 10 - left_ratio
    left_col, right_col = st.columns([left_ratio, right_ratio])
    
    # 左パネル: 答案と問題文
    with left_col:
        left_tabs = st.tabs(["📝 答案", "📄 問題文"])
        
        with left_tabs[0]:
            st.markdown("### 📝 提出答案")
            st.text_area(
                "答案",
                value=data.get("answer_text", ""),
                height=600,
                disabled=False,
                key="dev_display_answer",
                label_visibility="collapsed"
            )
        
        with left_tabs[1]:
            st.markdown("### 📄 問題文")
            st.text_area(
                "問題文",
                value=data.get("question_text", ""),
                height=400,
                disabled=False,
                key="dev_display_question",
                label_visibility="collapsed"
            )
            
            if data.get("purpose"):
                st.markdown("#### 🎯 出題趣旨")
                st.text_area(
                    "出題趣旨",
                    value=data.get("purpose", ""),
                    height=200,
                    disabled=False,
                    key="dev_display_purpose",
                    label_visibility="collapsed"
                )
            
            if data.get("subject"):
                st.info(f"**科目**: {data.get('subject')}")
    
    # 右パネル: 講評、問題文、詳細情報
    with right_col:
        right_tab_labels = ["📊 講評", "📄 問題文"]
        if data.get("review_json"):
            right_tab_labels.append("📋 詳細情報")
        
        right_tabs = st.tabs(right_tab_labels)
        
        with right_tabs[0]:
            st.markdown("### 📊 講評結果")
            if data.get("review_markdown"):
                st.markdown("""
                <div style="background: white; 
                            padding: 1.5rem; 
                            border-radius: 8px; 
                            border-left: 4px solid #667eea;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                            margin-bottom: 1rem;">
                """, unsafe_allow_html=True)
                st.markdown(data.get("review_markdown", ""))
                st.markdown("</div>", unsafe_allow_html=True)
            else:
                st.info("講評結果がありません。上記のタブから入力してください。")
            
            st.info(f"📝 提出ID: {data.get('submission_id', '未設定')}")
        
        with right_tabs[1]:
            if data.get("question_text"):
                st.markdown("### 📄 問題文")
                st.text_area(
                    "問題文",
                    value=data.get("question_text", ""),
                    height=400,
                    disabled=False,
                    key="dev_display_question_right",
                    label_visibility="collapsed"
                )
                
                if data.get("purpose"):
                    st.markdown("#### 🎯 出題趣旨")
                    st.text_area(
                        "出題趣旨",
                        value=data.get("purpose", ""),
                        height=200,
                        disabled=False,
                        key="dev_display_purpose_right",
                        label_visibility="collapsed"
                    )
                
                if data.get("subject"):
                    st.info(f"**科目**: {data.get('subject')}")
            else:
                st.info("問題文がありません。上記のタブから入力してください。")
        
        if len(right_tabs) > 2:
            with right_tabs[2]:
                st.markdown("### 📋 詳細情報（JSON）")
                st.json(data.get("review_json", {}))
    
    st.markdown("---")
    
    # チャット機能の検証
    _render_dev_chat_section(data.get("submission_id", 99999), data.get("review_markdown", ""), data.get("question_text", ""), data.get("answer_text", ""))


def _render_dev_chat_section(submission_id: int, review_markdown: str, question_text: str, answer_text: str):
    """開発用チャットセクション"""
    st.subheader("💬 チャット機能の検証")
    st.caption("任意の入力でチャット機能を試すことができます")
    
    # チャット履歴の初期化
    chat_history_key = f"dev_chat_history_{submission_id}"
    if chat_history_key not in st.session_state:
        st.session_state[chat_history_key] = []
    
    chat_history = st.session_state[chat_history_key]
    
    # チャット履歴を表示
    chat_container = st.container()
    with chat_container:
        if chat_history:
            st.write("**会話履歴**")
            for i, msg in enumerate(chat_history):
                if msg["role"] == "user":
                    with st.chat_message("user"):
                        st.write(msg["content"])
                else:
                    with st.chat_message("assistant"):
                        st.markdown(msg["content"])
    
    # 質問入力欄
    st.markdown("---")
    col_input1, col_input2, col_input3 = st.columns([6, 1, 1])
    
    with col_input1:
        user_question = st.text_input(
            "質問を入力してください",
            key=f"dev_chat_input_{submission_id}",
            placeholder="例: この答案の改善点をもっと詳しく教えてください",
            label_visibility="collapsed"
        )
    
    with col_input2:
        send_button = st.button("送信", type="primary", key=f"dev_chat_send_{submission_id}", use_container_width=True)
    
    with col_input3:
        if chat_history:
            clear_button = st.button("履歴クリア", key=f"dev_chat_clear_{submission_id}", use_container_width=True)
        else:
            clear_button = False
    
    # 履歴クリア
    if clear_button:
        st.session_state[chat_history_key] = []
        st.rerun()
    
    # 質問を送信（submission_idが有効な場合のみ）
    if send_button and user_question.strip():
        if submission_id and submission_id > 0:
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
                    
                    st.rerun()
                    
                except Exception as e:
                    error_msg = str(e)
                    if "ConnectionError" in error_msg or "接続" in error_msg:
                        st.error("FastAPIサーバーに接続できません。サーバーが起動しているか確認してください。")
                    elif "404" in error_msg or "not found" in error_msg.lower():
                        st.warning(f"講評ID {submission_id} が見つかりません。既存の講評IDを使用するか、新しい講評を生成してください。")
                    elif "Timeout" in error_msg or "タイムアウト" in error_msg:
                        st.error("リクエストがタイムアウトしました。")
                    else:
                        st.error(f"エラーが発生しました: {error_msg}")
        else:
            st.warning("有効なSubmission IDが必要です。「その他」タブで設定してください。")


def _render_submission_list():
    """過去の講評一覧を表示"""
    st.markdown("### 📋 過去の講評一覧（最新100件）")
    
    with st.spinner("講評一覧を取得中..."):
        try:
            submissions = get_all_submissions_dev(limit=100, offset=0)
            
            if not submissions:
                st.info("講評がありません。")
                return
            
            st.success(f"✅ {len(submissions)}件の講評を取得しました")
            
            # 検索・フィルター機能
            search_term = st.text_input("検索（科目で検索）", key="dev_search_submissions", placeholder="例: 憲法")
            
            # フィルタリング
            filtered_submissions = submissions
            if search_term:
                filtered_submissions = [s for s in submissions if search_term.lower() in s.get("subject", "").lower()]
                if not filtered_submissions:
                    st.warning(f"「{search_term}」に一致する講評が見つかりませんでした。")
            
            # 講評一覧を表示
            for sub in filtered_submissions[:50]:  # 最大50件まで表示
                sub_id = sub.get("id")
                subject = sub.get("subject", "（科目不明）")
                created_at = sub.get("created_at", "")
                has_review = sub.get("review") is not None
                
                # 日付のフォーマット
                date_str = created_at[:10] if created_at else "（日付不明）"
                
                # 講評があるかどうかの表示
                review_badge = "✅" if has_review else "⚠️"
                
                col_sub1, col_sub2 = st.columns([4, 1])
                with col_sub1:
                    st.markdown(f"**{review_badge} ID: {sub_id}** - {subject} ({date_str})")
                    if sub.get("question_text"):
                        question_preview = sub["question_text"][:100] + "..." if len(sub.get("question_text", "")) > 100 else sub["question_text"]
                        st.caption(f"問題: {question_preview}")
                
                with col_sub2:
                    if st.button("表示", key=f"dev_view_{sub_id}", use_container_width=True):
                        # 講評結果ページに遷移
                        st.session_state["review_submission_id"] = sub_id
                        st.session_state.current_page = "講評結果"
                        st.rerun()
            
            if len(filtered_submissions) > 50:
                st.info(f"他にも {len(filtered_submissions) - 50} 件の講評があります。検索で絞り込んでください。")
                
        except Exception as e:
            error_msg = str(e)
            if "ConnectionError" in error_msg or "接続" in error_msg:
                st.error("FastAPIサーバーに接続できません。サーバーが起動しているか確認してください。")
            else:
                st.error(f"講評一覧の取得に失敗しました: {error_msg}")
