"""問題表示コンポーネント"""
import streamlit as st


def render_problem_details(problem: dict, key_prefix: str = ""):
    """問題の詳細を表示
    
    Args:
        problem: 問題データの辞書
        key_prefix: Streamlitのkeyのプレフィックス
    """
    # 問題文カード
    st.markdown("""
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                padding: 1.5rem; 
                border-radius: 12px; 
                margin-bottom: 1.5rem;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <h3 style="color: white; margin-top: 0; margin-bottom: 1rem;">📄 問題文</h3>
    </div>
    """, unsafe_allow_html=True)
    st.text_area("問題文", value=problem["question_text"], height=300, disabled=True, key=f"{key_prefix}problem_text_display", label_visibility="collapsed")
    
    if problem.get("scoring_notes"):
        st.markdown("""
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); 
                    padding: 1rem; 
                    border-radius: 8px; 
                    margin-bottom: 1rem;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h4 style="color: white; margin: 0;">💡 採点実感</h4>
        </div>
        """, unsafe_allow_html=True)
        st.text_area("採点実感", value=problem["scoring_notes"], height=150, disabled=True, key=f"{key_prefix}scoring_notes_display", label_visibility="collapsed")
    
    if problem.get("purpose"):
        st.markdown("""
        <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); 
                    padding: 1rem; 
                    border-radius: 8px; 
                    margin-bottom: 1rem;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h4 style="color: white; margin: 0;">🎯 出題趣旨</h4>
        </div>
        """, unsafe_allow_html=True)
        st.text_area("出題趣旨", value=problem["purpose"], height=150, disabled=True, key=f"{key_prefix}purpose_display", label_visibility="collapsed")
