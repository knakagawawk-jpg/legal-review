"""フィルターコンポーネント"""
import streamlit as st
from typing import Optional, Tuple
from utils.formatters import int_to_year_str, year_str_to_int
from streamlit_app.api_client import get_available_years

# 科目の固定リスト（順番も固定）
FIXED_SUBJECTS = [
    "憲法",
    "行政法",
    "民法",
    "商法",
    "民事訴訟法",
    "刑法",
    "刑事訴訟法",
    "実務基礎（民事）",
    "実務基礎（刑事）",
    "倒産法",
    "租税法",
    "経済法",
    "知的財産法",
    "労働法",
    "環境法",
    "国際関係法（公法系）",
    "国際関係法（私法系）",
    "一般教養科目",
]


def _get_cached_years() -> list:
    """年度データをキャッシュから取得（なければAPIから取得）"""
    if "cached_years" not in st.session_state:
        try:
            years = get_available_years()
            if years:
                st.session_state["cached_years"] = years
            else:
                st.session_state["cached_years"] = []
                st.warning("年度データが取得できませんでした。FastAPIサーバーが起動しているか確認してください。")
        except Exception as e:
            st.session_state["cached_years"] = []
            st.error(f"年度データの取得に失敗しました: {str(e)}")
    return st.session_state.get("cached_years", [])


def _get_available_subjects() -> list:
    """科目データを取得（固定値を使用、順番を保持）"""
    # リストのコピーを返して順番を確実に保持
    return list(FIXED_SUBJECTS)


def render_problem_filters(key_prefix: str = "") -> Tuple[Optional[str], Optional[int], Optional[str]]:
    """問題フィルターを表示（試験種別、年度、科目）
    
    Args:
        key_prefix: Streamlitのkeyのプレフィックス（複数フィルターを区別するため）
    
    Returns:
        (exam_type, year, subject) のタプル
    """
    col1, col2, col3 = st.columns(3)
    
    with col1:
        filter_exam_type = st.selectbox("試験種別", ["", "司法試験", "予備試験"], key=f"{key_prefix}filter_exam")
    
    with col2:
        # 年度の選択（キャッシュから取得）
        all_years = _get_cached_years()
        if all_years:
            year_options = [""] + [int_to_year_str(y) for y in all_years]
        else:
            year_options = [""]
        selected_year_str = st.selectbox("年度", year_options, key=f"{key_prefix}filter_year_str")
        # 文字列を整数に変換
        filter_year = year_str_to_int(selected_year_str) if selected_year_str else None
    
    with col3:
        # 科目の選択（固定値を使用、順番を保持）
        # FIXED_SUBJECTSを直接使用して順番を確実に保持
        # 空文字列を先頭に追加
        subject_options = [""] + list(FIXED_SUBJECTS)
        
        # デバッグ: 実際にselectboxに渡されるデータの順番を確認
        # 最初の3つと最後の3つを表示して順番を確認
        if st.session_state.get("debug_subjects", False):
            st.write(f"最初の3つ: {subject_options[1:4]}")
            st.write(f"最後の3つ: {subject_options[-3:]}")
        
        filter_subject = st.selectbox(
            "科目", 
            subject_options,
            key=f"{key_prefix}filter_subject",
        )
    
    return filter_exam_type if filter_exam_type else None, filter_year, filter_subject if filter_subject else None


def render_short_answer_filters() -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """短答式問題フィルターを表示（試験種別、年度、科目）
    
    Returns:
        (exam_type, year, subject) のタプル
    """
    from streamlit_app.api_client import get_available_short_answer_years, get_available_short_answer_subjects
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        exam_type = st.selectbox("試験種別", ["", "予備試験", "司法試験"], key="short_answer_exam_type")
    
    with col2:
        # 年度の選択
        if exam_type:
            years = get_available_short_answer_years(exam_type)
            if years:
                year = st.selectbox("年度", [""] + years, key="short_answer_year")
            else:
                st.info("該当する年度が見つかりませんでした。")
                year = ""
        else:
            year = ""
    
    with col3:
        # 科目の選択
        if exam_type:
            subjects = get_available_short_answer_subjects(exam_type, year if year else None)
            if subjects:
                subject = st.selectbox("科目", [""] + subjects, key="short_answer_subject")
            else:
                st.info("該当する科目が見つかりませんでした。")
                subject = ""
        else:
            subject = ""
    
    return exam_type if exam_type else None, year if year else None, subject if subject else None
