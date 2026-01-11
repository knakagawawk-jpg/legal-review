"""Your Page - 過去の記録とノート管理"""
import streamlit as st
from streamlit_app.api_client import (
    get_my_submissions,
    get_my_short_answer_sessions,
    get_notebooks,
    get_notebook,
    create_notebook,
    update_notebook,
    delete_notebook,
    create_note_section,
    update_note_section,
    delete_note_section,
    create_note_page,
    update_note_page,
    delete_note_page
)
from streamlit_app.components.auth import is_authenticated, get_current_user
from datetime import datetime
import json


def render():
    """Your Pageを表示"""
    st.session_state.current_page = "Your Page"
    
    # ヘッダー
    from streamlit_app.components.styles import render_gradient_title
    col1, col2 = st.columns([3, 1])
    with col1:
        render_gradient_title("📚 Your Page", level=1)
        st.caption("過去の記録とノートを管理します")
    with col2:
        st.markdown("<br>", unsafe_allow_html=True)
        st.markdown("""
        <div style="text-align: right; color: #6c757d;">
            <small>個人管理ページ</small>
        </div>
        """, unsafe_allow_html=True)
    
    st.markdown("---")
    
    # 認証チェック（認証がOFFの場合は警告のみ）
    user = get_current_user()
    if not user:
        st.info("💡 ログインすると、過去の記録やノートを保存・管理できます。")
    
    # タブで過去の記録とノートを切り替え
    tab1, tab2 = st.tabs(["📝 過去の記録", "📓 ノート"])
    
    with tab1:
        _render_history()
    
    with tab2:
        _render_notes()


def _render_history():
    """過去の記録を表示"""
    st.header("過去の記録")
    
    # サブタブで講評と短答式を切り替え
    sub_tab1, sub_tab2 = st.tabs(["講評履歴", "短答式履歴"])
    
    with sub_tab1:
        _render_review_history()
    
    with sub_tab2:
        _render_short_answer_history()


def _render_review_history():
    """講評履歴を表示"""
    submissions = get_my_submissions(limit=100)
    
    if not submissions:
        st.info("講評履歴がありません。")
        return
    
    st.write(f"**全{len(submissions)}件の講評**")
    
    for sub in submissions:
        with st.expander(f"📄 {sub['subject']} - {sub['created_at'][:10]}", expanded=False):
            col1, col2 = st.columns([2, 1])
            
            with col1:
                if sub.get('question_text'):
                    st.markdown("**問題文**")
                    st.text_area("", sub['question_text'], height=100, key=f"q_{sub['id']}", disabled=True)
                
                st.markdown("**答案**")
                st.text_area("", sub['answer_text'], height=150, key=f"a_{sub['id']}", disabled=True)
            
            with col2:
                st.markdown("**講評**")
                if sub.get('review'):
                    review = sub['review']
                    if review.get('score'):
                        st.metric("スコア", f"{review['score']}点")
                    
                    if review.get('strengths'):
                        st.markdown("**良い点**")
                        for strength in review['strengths']:
                            st.write(f"✅ {strength}")
                    
                    if review.get('weaknesses'):
                        st.markdown("**改善点**")
                        for weakness in review['weaknesses']:
                            st.write(f"⚠️ {weakness}")
                else:
                    st.info("講評データがありません")


def _render_short_answer_history():
    """短答式履歴を表示"""
    sessions = get_my_short_answer_sessions(limit=100)
    
    if not sessions:
        st.info("📝 短答式履歴がありません。")
        return
    
    st.markdown(f"""
    <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); 
                padding: 1rem; 
                border-radius: 8px; 
                margin-bottom: 1.5rem;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h3 style="color: white; margin: 0;">📊 全{len(sessions)}件のセッション</h3>
    </div>
    """, unsafe_allow_html=True)
    
    for session in sessions:
        # 正答率に応じて色を変更
        accuracy = session['accuracy']
        if accuracy >= 80:
            color = "#28a745"  # 緑
        elif accuracy >= 60:
            color = "#ffc107"  # 黄
        else:
            color = "#dc3545"  # 赤
        
        with st.expander(
            f"📝 {session['exam_type']} {session.get('year', '')} {session['subject']} - "
            f"正答率: {session['accuracy']}% ({session['correct_count']}/{session['total_problems']})",
            expanded=False
        ):
            col1, col2, col3 = st.columns(3)
            with col1:
                st.metric("正答数", f"{session['correct_count']}/{session['total_problems']}")
            with col2:
                st.metric("正答率", f"{session['accuracy']}%")
            with col3:
                if session.get('completed_at'):
                    st.write(f"完了: {session['completed_at'][:19]}")
                else:
                    st.write(f"開始: {session['started_at'][:19]}")


def _render_notes():
    """ノート機能を表示"""
    st.header("📓 ノート")
    
    # 認証チェック
    if not is_authenticated():
        st.warning("ノート機能を使用するにはログインが必要です。")
        return
    
    # ノートブック一覧を取得
    notebooks = get_notebooks()
    
    # サイドバーにノートブック一覧を表示
    st.sidebar.markdown("### 📓 ノートブック")
    
    # 新規ノートブック作成
    if st.sidebar.button("➕ 新しいノートブック", use_container_width=True):
        st.session_state['show_create_notebook'] = True
    
    # ノートブック選択
    selected_notebook_id = None
    if 'selected_notebook_id' not in st.session_state:
        st.session_state.selected_notebook_id = None
    
    for nb in notebooks:
        if st.sidebar.button(
            f"📔 {nb['title']}",
            key=f"nb_{nb['id']}",
            use_container_width=True,
            type="primary" if st.session_state.selected_notebook_id == nb['id'] else "secondary"
        ):
            st.session_state.selected_notebook_id = nb['id']
            st.rerun()
    
    # 新規ノートブック作成フォーム
    if st.session_state.get('show_create_notebook', False):
        with st.sidebar:
            st.markdown("### 新しいノートブック")
            new_title = st.text_input("タイトル", key="new_notebook_title")
            new_description = st.text_area("説明", key="new_notebook_desc")
            new_color = st.color_picker("カラー", key="new_notebook_color")
            
            col1, col2 = st.columns(2)
            with col1:
                if st.button("作成", type="primary"):
                    if new_title:
                        try:
                            create_notebook(new_title, new_description, new_color)
                            st.success("ノートブックを作成しました")
                            st.session_state['show_create_notebook'] = False
                            st.session_state.selected_notebook_id = None
                            st.rerun()
                        except Exception as e:
                            st.error(f"エラー: {str(e)}")
            with col2:
                if st.button("キャンセル"):
                    st.session_state['show_create_notebook'] = False
                    st.rerun()
    
    # ノートブックが選択されている場合、詳細を表示
    if st.session_state.selected_notebook_id:
        _render_notebook_detail(st.session_state.selected_notebook_id)
    else:
        st.info("サイドバーからノートブックを選択するか、新しいノートブックを作成してください。")


def _render_notebook_detail(notebook_id: int):
    """ノートブック詳細を表示"""
    notebook = get_notebook(notebook_id)
    
    if not notebook:
        st.error("ノートブックが見つかりません。")
        return
    
    # ヘッダー（カード形式）
    notebook_color = notebook.get('color', '#667eea')
    col1, col2 = st.columns([4, 1])
    with col1:
        st.markdown(f"""
        <div style="background: linear-gradient(135deg, {notebook_color} 0%, #764ba2 100%); 
                    padding: 1.5rem; 
                    border-radius: 12px; 
                    margin-bottom: 1.5rem;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: white; margin: 0 0 0.5rem 0;">📔 {notebook['title']}</h2>
            {f'<p style="color: rgba(255,255,255,0.9); margin: 0;">{notebook.get("description", "")}</p>' if notebook.get('description') else ''}
        </div>
        """, unsafe_allow_html=True)
    with col2:
        st.markdown("<br>", unsafe_allow_html=True)
        if st.button("🗑️ 削除", type="secondary", use_container_width=True):
            if st.session_state.get('confirm_delete_notebook'):
                try:
                    delete_notebook(notebook_id)
                    st.success("ノートブックを削除しました")
                    st.session_state.selected_notebook_id = None
                    st.rerun()
                except Exception as e:
                    st.error(f"エラー: {str(e)}")
            else:
                st.session_state['confirm_delete_notebook'] = True
                st.rerun()
    
    # セクションとページを表示
    sections = notebook.get('sections', [])
    
    if not sections:
        st.info("このノートブックにはセクションがありません。")
        
        # 新規セクション作成
        if st.button("➕ 新しいセクションを作成"):
            st.session_state['show_create_section'] = True
    
    # セクション作成フォーム
    if st.session_state.get('show_create_section', False):
        st.markdown("### 新しいセクション")
        new_section_title = st.text_input("セクション名", key="new_section_title")
        col1, col2 = st.columns(2)
        with col1:
            if st.button("作成", type="primary"):
                if new_section_title:
                    try:
                        create_note_section(notebook_id, new_section_title)
                        st.success("セクションを作成しました")
                        st.session_state['show_create_section'] = False
                        st.rerun()
                    except Exception as e:
                        st.error(f"エラー: {str(e)}")
        with col2:
            if st.button("キャンセル"):
                st.session_state['show_create_section'] = False
                st.rerun()
    
    # セクションを表示
    for section in sections:
        with st.expander(f"📁 {section['title']}", expanded=True):
            pages = section.get('pages', [])
            
            # 新規ページ作成ボタン
            if st.button(f"➕ 新しいページを追加", key=f"add_page_{section['id']}"):
                st.session_state[f'show_create_page_{section["id"]}'] = True
            
            # ページ作成フォーム
            if st.session_state.get(f'show_create_page_{section["id"]}', False):
                new_page_title = st.text_input("ページ名", key=f"new_page_title_{section['id']}")
                col1, col2 = st.columns(2)
                with col1:
                    if st.button("作成", key=f"create_page_{section['id']}", type="primary"):
                        if new_page_title:
                            try:
                                create_note_page(section['id'], new_page_title)
                                st.success("ページを作成しました")
                                st.session_state[f'show_create_page_{section["id"]}'] = False
                                st.rerun()
                            except Exception as e:
                                st.error(f"エラー: {str(e)}")
                with col2:
                    if st.button("キャンセル", key=f"cancel_page_{section['id']}"):
                        st.session_state[f'show_create_page_{section["id"]}'] = False
                        st.rerun()
            
            # ページを表示
            if not pages:
                st.caption("このセクションにはページがありません。")
            else:
                for page in pages:
                    _render_page(page, section['id'])


def _render_page(page: dict, section_id: int):
    """ページを表示・編集"""
    page_id = page['id']
    
    # ページ編集モードの切り替え
    edit_key = f"edit_page_{page_id}"
    if edit_key not in st.session_state:
        st.session_state[edit_key] = False
    
    if st.session_state[edit_key]:
        # 編集モード
        st.markdown(f"### ✏️ {page['title']}")
        edited_title = st.text_input("タイトル", value=page['title'], key=f"page_title_{page_id}")
        edited_content = st.text_area(
            "内容（Markdown対応）",
            value=page.get('content', ''),
            height=300,
            key=f"page_content_{page_id}"
        )
        
        col1, col2, col3 = st.columns(3)
        with col1:
            if st.button("💾 保存", key=f"save_page_{page_id}", type="primary"):
                try:
                    update_note_page(page_id, edited_title, edited_content)
                    st.success("ページを保存しました")
                    st.session_state[edit_key] = False
                    st.rerun()
                except Exception as e:
                    st.error(f"エラー: {str(e)}")
        with col2:
            if st.button("❌ キャンセル", key=f"cancel_page_{page_id}"):
                st.session_state[edit_key] = False
                st.rerun()
        with col3:
            if st.button("🗑️ 削除", key=f"delete_page_{page_id}"):
                try:
                    delete_note_page(page_id)
                    st.success("ページを削除しました")
                    st.rerun()
                except Exception as e:
                    st.error(f"エラー: {str(e)}")
    else:
        # 表示モード
        st.markdown(f"### 📄 {page['title']}")
        if page.get('content'):
            st.markdown(page['content'])
        else:
            st.caption("（内容がありません）")
        
        if st.button("✏️ 編集", key=f"edit_btn_{page_id}"):
            st.session_state[edit_key] = True
            st.rerun()
