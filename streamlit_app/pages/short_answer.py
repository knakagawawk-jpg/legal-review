"""短答式試験ページ"""
import streamlit as st
from streamlit_app.api_client import (
    get_short_answer_problems,
    get_available_short_answer_years,
    get_available_short_answer_subjects,
    create_short_answer_session,
    submit_short_answer_answer
)
from streamlit_app.components.filters import render_short_answer_filters


def render():
    """短答式試験ページを表示"""
    # ページ状態を保持
    st.session_state.current_page = "短答式試験"
    
    # ヘッダー
    from streamlit_app.components.styles import render_gradient_title
    col1, col2 = st.columns([3, 1])
    with col1:
        render_gradient_title("📝 短答式試験", level=1)
        st.caption("短答式問題を解いて正誤を確認します")
    with col2:
        st.markdown("<br>", unsafe_allow_html=True)
        st.markdown("""
        <div style="text-align: right; color: #6c757d;">
            <small>問題演習システム</small>
        </div>
        """, unsafe_allow_html=True)
    
    st.markdown("---")
    
    # セッション状態の初期化
    if "short_answer_session_id" not in st.session_state:
        st.session_state.short_answer_session_id = None
    if "short_answer_problems" not in st.session_state:
        st.session_state.short_answer_problems = []
    if "short_answer_current_index" not in st.session_state:
        st.session_state.short_answer_current_index = 0
    if "short_answer_answers" not in st.session_state:
        st.session_state.short_answer_answers = {}
    if "short_answer_show_answer" not in st.session_state:
        st.session_state.short_answer_show_answer = False
    
    # 問題選択画面
    if st.session_state.short_answer_session_id is None:
        _render_problem_selection()
    else:
        _render_problem_display()


def _render_problem_selection():
    """問題選択画面を表示"""
    st.subheader("問題を選択")
    
    # フィルターを表示
    exam_type, year, subject = render_short_answer_filters()
    
    # ランダム選択オプション
    use_random = st.checkbox("科目のみ選択して全試験・年度からランダムに問題を選ぶ", key="short_answer_random")
    
    # 開始ボタン
    if st.button("問題を開始", type="primary", key="start_short_answer"):
        if use_random:
            if not subject:
                st.error("ランダム選択を使用する場合は科目を選択してください。")
            else:
                # ランダムモードで問題を取得
                problems = get_short_answer_problems(subject=subject, is_random=True)
                if problems:
                    _start_session("", "", subject, True, problems)
                else:
                    st.error("問題が見つかりませんでした。")
        else:
            if not exam_type or not year or not subject:
                st.error("試験種別、年度、科目をすべて選択してください。")
            else:
                # 通常モードで問題を取得
                problems = get_short_answer_problems(exam_type=exam_type, year=year, subject=subject)
                if problems:
                    _start_session(exam_type, year, subject, False, problems)
                else:
                    st.error("問題が見つかりませんでした。")


def _start_session(exam_type: str, year: str, subject: str, is_random: bool, problems: list):
    """セッションを開始"""
    try:
        session_data = create_short_answer_session(
            exam_type=exam_type,
            year=year,
            subject=subject,
            is_random=is_random,
            problem_ids=[p["id"] for p in problems]
        )
        st.session_state.short_answer_session_id = session_data["id"]
        st.session_state.short_answer_problems = problems
        st.session_state.short_answer_current_index = 0
        st.session_state.short_answer_answers = {}
        st.session_state.short_answer_show_answer = False
        st.rerun()
    except Exception as e:
        st.error(f"セッションの作成に失敗しました: {str(e)}")


def _render_problem_display():
    """問題表示画面を表示"""
    problems = st.session_state.short_answer_problems
    current_index = st.session_state.short_answer_current_index
    
    if not problems:
        st.error("問題が見つかりませんでした。")
        return
    
    current_problem = problems[current_index]
    total_problems = len(problems)
    
    # ヘッダー（試験種別、年度、問題番号）
    exam_type_display = current_problem.get("exam_type", "")
    year_display = current_problem.get("year", "")
    question_number = current_problem.get("question_number", 0)
    
    # 進捗表示をカード形式で
    col1, col2 = st.columns([3, 1])
    with col1:
        st.markdown(f"""
        <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); 
                    padding: 1rem; 
                    border-radius: 8px; 
                    margin-bottom: 1rem;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="color: white; margin: 0;">{exam_type_display} {year_display} 第{question_number}問</h3>
        </div>
        """, unsafe_allow_html=True)
    with col2:
        progress_percent = (current_index + 1) / total_problems
        st.markdown(f"""
        <div style="background: white; 
                    padding: 1rem; 
                    border-radius: 8px; 
                    border: 2px solid #4facfe;
                    text-align: center;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="font-size: 1.5rem; font-weight: 700; color: #4facfe;">{current_index + 1}/{total_problems}</div>
            <div style="font-size: 0.9rem; color: #6c757d;">進捗</div>
        </div>
        """, unsafe_allow_html=True)
    
    st.progress(progress_percent)
    
    if not st.session_state.short_answer_show_answer:
        _render_problem_mode(current_problem, current_index)
    else:
        _render_answer_mode(current_problem, current_index, total_problems)


def _render_problem_mode(problem: dict, current_index: int):
    """問題表示モード"""
    # 問題文をカード形式で表示
    st.markdown("""
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                padding: 1rem; 
                border-radius: 8px; 
                margin-bottom: 1rem;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h4 style="color: white; margin: 0;">📄 問題文</h4>
    </div>
    """, unsafe_allow_html=True)
    st.markdown(f"""
    <div style="background: #f8f9fa; 
                padding: 1.5rem; 
                border-radius: 8px; 
                border-left: 4px solid #667eea;
                margin-bottom: 1.5rem;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <p style="margin: 0; line-height: 1.8; font-size: 1.05rem;">{problem["question_text"]}</p>
    </div>
    """, unsafe_allow_html=True)
    
    # 選択肢
    st.markdown("""
    <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); 
                padding: 1rem; 
                border-radius: 8px; 
                margin-bottom: 1rem;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h4 style="color: white; margin: 0;">🔘 選択肢</h4>
    </div>
    """, unsafe_allow_html=True)
    
    choices = [
        problem.get("choice_1"),
        problem.get("choice_2"),
        problem.get("choice_3"),
        problem.get("choice_4")
    ]
    # choice_4がNoneの場合は3択問題
    choices = [c for c in choices if c is not None]
    
    for i, choice_text in enumerate(choices, 1):
        if st.button(f"{i}. {choice_text}", key=f"choice_{current_index}_{i}", use_container_width=True):
            st.session_state.short_answer_answers[problem["id"]] = str(i)
    
    # 回答を見るボタン
    if st.button("回答を見る", type="primary", key="show_answer"):
        st.session_state.short_answer_show_answer = True
        # 回答を送信（選択されていない場合も送信）
        selected_answer = st.session_state.short_answer_answers.get(problem["id"], "")
        
        try:
            submit_short_answer_answer(
                session_id=st.session_state.short_answer_session_id,
                problem_id=problem["id"],
                selected_answer=selected_answer
            )
        except Exception as e:
            st.error(f"回答の送信に失敗しました: {str(e)}")
        
        st.rerun()


def _render_answer_mode(problem: dict, current_index: int, total_problems: int):
    """回答表示モード"""
    problem_id = problem["id"]
    selected_answer = st.session_state.short_answer_answers.get(problem_id, "")
    correct_answer = problem.get("correct_answer", "")
    correctness_pattern = problem.get("correctness_pattern", "")
    
    # 正誤判定
    is_correct = selected_answer == correct_answer
    
    # 大きな正誤表示（カード形式）
    if is_correct:
        st.markdown("""
        <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); 
                    padding: 2rem; 
                    border-radius: 12px; 
                    margin: 1.5rem 0;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 3rem;">✅</h1>
            <h2 style="color: white; margin: 0.5rem 0 0 0;">正解</h2>
        </div>
        """, unsafe_allow_html=True)
    else:
        st.markdown("""
        <div style="background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%); 
                    padding: 2rem; 
                    border-radius: 12px; 
                    margin: 1.5rem 0;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 3rem;">❌</h1>
            <h2 style="color: white; margin: 0.5rem 0 0 0;">不正解</h2>
        </div>
        """, unsafe_allow_html=True)
    
    # 選択肢と正誤マーク
    st.write("**選択肢**")
    choices = [
        problem.get("choice_1"),
        problem.get("choice_2"),
        problem.get("choice_3"),
        problem.get("choice_4")
    ]
    choices = [c for c in choices if c is not None]
    
    for i, choice_text in enumerate(choices, 1):
        mark = correctness_pattern[i-1] if i-1 < len(correctness_pattern) else ""
        choice_num = str(i)
        is_selected = selected_answer == choice_num
        is_correct_choice = choice_num in correct_answer.split(",")
        
        if is_selected:
            if is_correct_choice:
                st.write(f"**{mark} {i}. {choice_text}** ← あなたの選択（正解）")
            else:
                st.write(f"**{mark} {i}. {choice_text}** ← あなたの選択（不正解）")
        else:
            if is_correct_choice:
                st.write(f"**{mark} {i}. {choice_text}** ← 正解")
            else:
                st.write(f"{mark} {i}. {choice_text}")
    
    # ナビゲーションボタン
    col1, col2, col3 = st.columns([1, 1, 1])
    
    with col1:
        if st.button("← 戻る", key="prev_problem"):
            if current_index > 0:
                st.session_state.short_answer_current_index = current_index - 1
                st.session_state.short_answer_show_answer = False
                st.rerun()
    
    with col2:
        if st.button("問題一覧に戻る", key="back_to_list"):
            st.session_state.short_answer_session_id = None
            st.session_state.short_answer_problems = []
            st.session_state.short_answer_current_index = 0
            st.session_state.short_answer_answers = {}
            st.session_state.short_answer_show_answer = False
            st.rerun()
    
    with col3:
        if st.button("次へ →", key="next_problem"):
            if current_index < total_problems - 1:
                st.session_state.short_answer_current_index = current_index + 1
                st.session_state.short_answer_show_answer = False
                st.rerun()
            else:
                st.info("最後の問題です。")
