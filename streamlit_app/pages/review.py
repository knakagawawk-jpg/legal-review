"""講評生成ページ"""
import streamlit as st
from streamlit_app.api_client import (
    get_problems,  # 既存構造用（後方互換性）
    get_problem_metadata,  # 新しい構造用
    get_problem_metadata_with_details,  # 新しい構造用
    get_problem_details,  # 新しい構造用
    generate_review, chat_review
)
from streamlit_app.components.filters import render_problem_filters
from streamlit_app.components.problem_display import render_problem_details
from streamlit_app.components.styles import render_gradient_title, render_card
from utils.formatters import year_str_to_int


def render():
    """講評生成ページを表示"""
    # ページ状態を保持
    st.session_state.current_page = "講評生成"
    
    # ヘッダー
    col1, col2 = st.columns([3, 1])
    with col1:
        render_gradient_title("📝 答案講評生成", level=1)
        st.caption("LLMを使用して法律答案の自動講評を生成します")
    with col2:
        st.markdown("<br>", unsafe_allow_html=True)
        st.markdown("""
        <div style="text-align: right; color: #6c757d;">
            <small>AI 講評システム</small>
        </div>
        """, unsafe_allow_html=True)
    
    st.markdown("---")
    
    # 問題選択モード
    input_mode = st.radio(
        "問題文の入力方法",
        ["既存問題を選択", "新規入力"],
        horizontal=True
    )
    
    # 問題情報の保持（session_stateから読み込むか、初期化）
    selected_problem_id = st.session_state.get("review_selected_problem_id", None)  # 既存構造用（後方互換性）
    selected_problem_metadata_id = st.session_state.get("review_selected_problem_metadata_id", None)  # 新しい構造用
    selected_problem_details_id = st.session_state.get("review_selected_problem_details_id", None)  # 新しい構造用（設問指定）
    question_text = st.session_state.get("review_question_text", "")
    subject = st.session_state.get("review_subject", "")
    
    # 新しい問題選択時は初期化
    if input_mode == "既存問題を選択":
        # フィルターを表示（年度・科目はキャッシュから取得される）
        filter_exam_type, filter_year, filter_subject = render_problem_filters()
        
        # session_stateにフィルター値を保存（検証部分で使用）
        st.session_state["review_filter_exam_type"] = filter_exam_type
        st.session_state["review_filter_year"] = filter_year
        st.session_state["review_filter_subject"] = filter_subject
        
        # 問題一覧を取得（試験種類＋年度＋科目で一意に定まる）
        # 3つすべてが選択された時点で問題文を検索
        if filter_exam_type and filter_year and filter_subject:
            # 新しい構造（改善版）を優先的に使用
            metadata_list = get_problem_metadata(
                exam_type=filter_exam_type,
                year=filter_year,
                subject=filter_subject
            )
            
            if metadata_list and len(metadata_list) == 1:
                # 一意に定まるので自動的に問題を表示
                metadata = metadata_list[0]
                selected_problem_metadata_id = metadata['id']
                subject = metadata["subject"]
                
                # session_stateに保存
                st.session_state["review_selected_problem_metadata_id"] = selected_problem_metadata_id
                st.session_state["review_subject"] = subject
                
                # 詳細情報（設問）を取得
                details = get_problem_details(selected_problem_metadata_id)
                
                if details and len(details) == 1:
                    # 設問が1つだけの場合
                    detail = details[0]
                    selected_problem_details_id = detail['id']
                    question_text = detail["question_text"]
                    
                    # session_stateに保存
                    st.session_state["review_selected_problem_details_id"] = selected_problem_details_id
                    st.session_state["review_question_text"] = question_text
                    
                    # 問題文を表示（既存の表示関数を使用）
                    render_problem_details({
                        "exam_type": metadata["exam_type"],
                        "year": metadata["year"],
                        "subject": metadata["subject"],
                        "question_text": question_text,
                        "purpose": detail.get("purpose"),
                    })
                elif details and len(details) > 1:
                    # 設問が複数ある場合、ユーザーに選択させる（デフォルトで最初の設問を選択）
                    detail_options = {f"設問{d['question_number']}": d for d in details}
                    detail_options_list = list(detail_options.keys())
                    
                    # selectboxのキー（メタデータIDを含めて一意にする）
                    selectbox_key = f"review_detail_select_{selected_problem_metadata_id}"
                    
                    # session_stateから前回の選択を取得、なければ最初の設問
                    current_selected_key = st.session_state.get(selectbox_key)
                    if not current_selected_key or current_selected_key not in detail_options_list:
                        current_selected_key = detail_options_list[0] if detail_options_list else None
                        st.session_state[selectbox_key] = current_selected_key
                    
                    # 選択された設問を取得（st.selectboxの値は自動的にsession_stateに保存される）
                    selected_detail_key = st.selectbox(
                        "設問を選択してください（デフォルトで最初の設問が選択されています）",
                        options=detail_options_list,
                        index=0,  # 常に最初の設問をデフォルトに
                        key=selectbox_key
                    )
                    
                    # 選択された設問を使用（必ず有効な値が返される）
                    detail = detail_options.get(selected_detail_key, details[0])  # フォールバック: 最初の設問
                    
                    selected_problem_details_id = detail['id']
                    question_text = detail["question_text"]
                    
                    # session_stateに保存（即座に保存して、ボタン押下時に確実に利用可能にする）
                    st.session_state["review_selected_problem_details_id"] = selected_problem_details_id
                    st.session_state["review_question_text"] = question_text
                    
                    # 問題文を表示
                    render_problem_details({
                        "exam_type": metadata["exam_type"],
                        "year": metadata["year"],
                        "subject": metadata["subject"],
                        "question_text": question_text,
                        "purpose": detail.get("purpose"),
                    })
                else:
                    # 詳細情報がない場合（データ不整合の可能性）
                    st.warning("問題の詳細情報が見つかりませんでした。")
                    # session_stateをクリア
                    st.session_state["review_selected_problem_metadata_id"] = None
                    st.session_state["review_selected_problem_details_id"] = None
                    
            elif metadata_list and len(metadata_list) > 1:
                st.warning(f"複数の問題が見つかりました（{len(metadata_list)}件）。データベースを確認してください。")
            else:
                # 新しい構造にデータがない場合、既存構造を使用（後方互換性）
                problems = get_problems(
                    exam_type=filter_exam_type,
                    year=filter_year,
                    subject=filter_subject
                )
                
                if problems and len(problems) == 1:
                    # 一意に定まるので自動的に問題を表示
                    problem = problems[0]
                    selected_problem_id = problem['id']
                    subject = problem["subject"]
                    question_text = problem["question_text"]
                    
                    # session_stateに保存
                    st.session_state["review_selected_problem_id"] = selected_problem_id
                    st.session_state["review_subject"] = subject
                    st.session_state["review_question_text"] = question_text
                    # 新しい構造の値はクリア
                    st.session_state["review_selected_problem_metadata_id"] = None
                    st.session_state["review_selected_problem_details_id"] = None
                    
                    # 問題文を表示
                    render_problem_details(problem)
                elif problems and len(problems) > 1:
                    st.warning(f"複数の問題が見つかりました（{len(problems)}件）。データベースを確認してください。")
                else:
                    st.info("該当する問題が見つかりませんでした。")
        elif filter_exam_type or filter_year or filter_subject:
            # 一部のみ選択されている場合は何も表示しない
            pass
    else:
        # 新規入力モード
        # 固定の科目リストを使用（順番を保持）
        from streamlit_app.components.filters import FIXED_SUBJECTS
        subject_options = [""] + FIXED_SUBJECTS.copy()  # コピーを作成して順番を保持
        subject = st.selectbox("科目", subject_options, key="review_new_subject")
        question_text = st.text_area("問題文（任意）", height=180, placeholder="問題文を貼り付け", key="review_new_question_text")
        
        # session_stateを更新
        st.session_state["review_subject"] = subject
        st.session_state["review_question_text"] = question_text
        # 問題選択の値はクリア
        st.session_state["review_selected_problem_id"] = None
        st.session_state["review_selected_problem_metadata_id"] = None
        st.session_state["review_selected_problem_details_id"] = None
        
        # 変数を更新
        subject = st.session_state["review_subject"]
        question_text = st.session_state["review_question_text"]
    
    # 答案入力（既存問題選択モードと新規入力モードの両方で使用）
    answer_text = st.text_area("答案（必須）", height=320, placeholder="答案を貼り付け")
    
    submitted = st.button("講評を生成", type="primary")
    
    if submitted:
        if not answer_text.strip():
            st.error("答案が空です。貼り付けてください。")
            st.stop()
        
        # 既存問題選択モードの場合、問題が選択されているか確認
        # 新しい構造（problem_metadata_id）または既存構造（problem_id）のいずれかが設定されている必要がある
        if input_mode == "既存問題を選択":
            # フィルターが完全に選択されているか確認（session_stateから取得）
            filter_exam_type = st.session_state.get("review_filter_exam_type")
            filter_year = st.session_state.get("review_filter_year")
            filter_subject = st.session_state.get("review_filter_subject")
            if not (filter_exam_type and filter_year and filter_subject):
                st.error("試験種別、年度、科目をすべて選択してください。")
                st.stop()
            
            # session_stateから最新の値を取得（フィルターが選択されている場合のみ）
            selected_problem_metadata_id = st.session_state.get("review_selected_problem_metadata_id", None)
            selected_problem_id = st.session_state.get("review_selected_problem_id", None)
            selected_problem_details_id = st.session_state.get("review_selected_problem_details_id", None)
            subject = st.session_state.get("review_subject", "")
            question_text = st.session_state.get("review_question_text", "")
            
            # 問題が選択されていない場合、フィルターから再取得を試みる
            if not selected_problem_metadata_id and not selected_problem_id:
                # 新しい構造（改善版）を優先的に使用して再取得を試みる
                metadata_list = get_problem_metadata(
                    exam_type=filter_exam_type,
                    year=filter_year,
                    subject=filter_subject
                )
                
                if metadata_list and len(metadata_list) == 1:
                    # 問題が見つかった場合、session_stateに保存
                    metadata = metadata_list[0]
                    selected_problem_metadata_id = metadata['id']
                    subject = metadata["subject"]
                    st.session_state["review_selected_problem_metadata_id"] = selected_problem_metadata_id
                    st.session_state["review_subject"] = subject
                    
                    # 詳細情報（設問）を取得
                    details = get_problem_details(selected_problem_metadata_id)
                    if details and len(details) > 0:
                        # 最初の設問を使用（設問が複数ある場合も最初の設問を使用）
                        first_detail = details[0]
                        selected_problem_details_id = first_detail['id']
                        question_text = first_detail.get("question_text", "")
                        st.session_state["review_selected_problem_details_id"] = selected_problem_details_id
                        st.session_state["review_question_text"] = question_text
                else:
                    # 新しい構造にデータがない場合、既存構造を使用（後方互換性）
                    problems = get_problems(
                        exam_type=filter_exam_type,
                        year=filter_year,
                        subject=filter_subject
                    )
                    
                    if problems and len(problems) == 1:
                        # 問題が見つかった場合、session_stateに保存
                        problem = problems[0]
                        selected_problem_id = problem['id']
                        subject = problem["subject"]
                        question_text = problem["question_text"]
                        st.session_state["review_selected_problem_id"] = selected_problem_id
                        st.session_state["review_subject"] = subject
                        st.session_state["review_question_text"] = question_text
                    else:
                        st.error("問題を選択してください。該当する問題が見つかりませんでした。")
                        st.stop()
            
            # 問題が選択されているか最終確認
            if not selected_problem_metadata_id and not selected_problem_id:
                st.error("問題を選択してください。フィルターを選択して問題が表示されるまでお待ちください。")
                st.stop()
            
            # 新しい構造を使用しているが、設問が選択されていない場合（設問が複数ある場合）
            # 最初の設問を自動的に使用する
            if selected_problem_metadata_id and not selected_problem_details_id:
                details = get_problem_details(selected_problem_metadata_id)
                if details and len(details) > 0:
                    # 最初の設問を使用
                    first_detail = details[0]
                    selected_problem_details_id = first_detail['id']
                    question_text = first_detail.get("question_text", "")
                    st.session_state["review_selected_problem_details_id"] = selected_problem_details_id
                    st.session_state["review_question_text"] = question_text
        
        # FastAPIにリクエストを送信
        with st.spinner("講評を生成中..."):
            try:
                result = generate_review(
                    problem_id=selected_problem_id,  # 既存構造用（後方互換性）
                    problem_metadata_id=selected_problem_metadata_id,  # 新しい構造用
                    problem_details_id=selected_problem_details_id,  # 新しい構造用（設問指定）
                    subject=subject,
                    question_text=question_text if question_text.strip() else None,
                    answer_text=answer_text
                )
                
                # resultにsubmission_idが含まれているか確認
                if not result or "submission_id" not in result:
                    st.error("講評生成に失敗しました。submission_idが取得できませんでした。")
                    with st.expander("デバッグ情報（クリックして展開）"):
                        st.write("APIレスポンス:")
                        st.json(result if result else "None")
                    st.stop()
                
                # session_stateにsubmission_idを保存して結果ページに遷移
                st.session_state["review_submission_id"] = result["submission_id"]
                # 永続的なキーにも保存（念のため）
                st.session_state["current_submission_id"] = result["submission_id"]
                st.session_state.current_page = "講評結果"
                st.rerun()
                
            except Exception as e:
                error_msg = str(e)
                if "ConnectionError" in error_msg or "接続" in error_msg:
                    st.error("FastAPIサーバーに接続できません。サーバーが起動しているか確認してください。")
                    st.code("uvicorn app.main:app --reload", language="bash")
                elif "Timeout" in error_msg or "タイムアウト" in error_msg:
                    st.error("リクエストがタイムアウトしました。")
                elif "422" in error_msg:
                    st.error("入力データの形式が正しくありません。")
                else:
                    st.error(f"予期しないエラーが発生しました: {error_msg}")
                    # エラー詳細を表示（開発時のみ）
                    with st.expander("エラー詳細（クリックして展開）"):
                        import traceback
                        st.code(traceback.format_exc())


def _render_chat_section(submission_id: int, review_markdown: str):
    """講評に関するチャットセクションを表示"""
    st.divider()
    st.subheader("💬 講評について質問する")
    st.caption("講評の内容について、LLMに自由に質問できます。")
    
    # チャット履歴の初期化
    if f"chat_history_{submission_id}" not in st.session_state:
        st.session_state[f"chat_history_{submission_id}"] = []
    
    chat_history = st.session_state[f"chat_history_{submission_id}"]
    
    # チャット履歴を表示
    if chat_history:
        st.write("**会話履歴**")
        for i, msg in enumerate(chat_history):
            if msg["role"] == "user":
                with st.chat_message("user"):
                    st.write(msg["content"])
            else:
                with st.chat_message("assistant"):
                    st.markdown(msg["content"])
    
    # 質問入力
    user_question = st.text_input(
        "質問を入力してください",
        key=f"chat_input_{submission_id}",
        placeholder="例: この答案の改善点をもっと詳しく教えてください"
    )
    
    col1, col2 = st.columns([1, 5])
    with col1:
        send_button = st.button("送信", type="primary", key=f"chat_send_{submission_id}")
    
    with col2:
        if chat_history:
            clear_button = st.button("履歴をクリア", key=f"chat_clear_{submission_id}")
            if clear_button:
                st.session_state[f"chat_history_{submission_id}"] = []
                st.rerun()
    
    # 質問を送信
    if send_button and user_question.strip():
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
                st.session_state[f"chat_history_{submission_id}"] = chat_history
                
                st.rerun()
                
            except Exception as e:
                error_msg = str(e)
                if "ConnectionError" in error_msg or "接続" in error_msg:
                    st.error("FastAPIサーバーに接続できません。サーバーが起動しているか確認してください。")
                elif "Timeout" in error_msg or "タイムアウト" in error_msg:
                    st.error("リクエストがタイムアウトしました。")
                else:
                    st.error(f"エラーが発生しました: {error_msg}")
