"""API呼び出し用のクライアント"""
import streamlit as st
import requests
from typing import Optional, List, Dict
from streamlit_app.config import API_BASE_URL
from streamlit_app.components.auth import get_current_user


def get_problems(exam_type: Optional[str] = None, year: Optional[int] = None, subject: Optional[str] = None) -> List[dict]:
    """問題一覧を取得"""
    try:
        params = {}
        if exam_type:
            params["exam_type"] = exam_type
        if year:
            params["year"] = year
        if subject:
            params["subject"] = subject
        
        response = requests.get(f"{API_BASE_URL}/v1/problems", params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        return data.get("problems", [])
    except Exception as e:
        st.error(f"問題の取得に失敗しました: {str(e)}")
        return []


def get_available_years() -> List[int]:
    """利用可能な年度の一覧を取得（エラー時は空リストを返す）"""
    try:
        response = requests.get(f"{API_BASE_URL}/v1/problems/years", timeout=10)
        response.raise_for_status()
        data = response.json()
        return data.get("years", [])
    except Exception:
        # エラーはキャッシュ関数側で処理されるため、ここでは静かに失敗
        return []


def get_available_subjects() -> List[str]:
    """利用可能な科目の一覧を取得（エラー時は空リストを返す）"""
    try:
        response = requests.get(f"{API_BASE_URL}/v1/problems/subjects", timeout=10)
        response.raise_for_status()
        data = response.json()
        return data.get("subjects", [])
    except Exception:
        # エラーはキャッシュ関数側で処理されるため、ここでは静かに失敗
        return []


def get_problem_metadata(
    exam_type: Optional[str] = None,
    year: Optional[int] = None,
    subject: Optional[str] = None
) -> List[dict]:
    """問題メタデータの一覧を取得（改善版）"""
    try:
        params = {}
        if exam_type:
            params["exam_type"] = exam_type
        if year:
            params["year"] = year
        if subject:
            params["subject"] = subject
        
        response = requests.get(f"{API_BASE_URL}/v1/problems/metadata", params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        return data.get("metadata_list", [])
    except Exception as e:
        st.error(f"メタデータの取得に失敗しました: {str(e)}")
        return []


def get_problem_metadata_with_details(metadata_id: int) -> dict:
    """問題メタデータと詳細情報を取得（改善版）"""
    try:
        response = requests.get(
            f"{API_BASE_URL}/v1/problems/metadata/{metadata_id}",
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        st.error(f"メタデータ詳細の取得に失敗しました: {str(e)}")
        return {}


def get_problem_details(metadata_id: int) -> List[dict]:
    """問題詳細情報の一覧を取得（改善版）"""
    try:
        response = requests.get(
            f"{API_BASE_URL}/v1/problems/metadata/{metadata_id}/details",
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        st.error(f"詳細情報の取得に失敗しました: {str(e)}")
        return []


def generate_review(
    problem_id: Optional[int] = None,
    problem_metadata_id: Optional[int] = None,
    problem_details_id: Optional[int] = None,
    subject: str = "",
    question_text: Optional[str] = None,
    answer_text: str = ""
) -> dict:
    """講評を生成（既存構造と新しい構造の両方に対応）"""
    payload = {
        "subject": subject,
        "question_text": question_text,
        "answer_text": answer_text,
    }
    
    # 既存構造（後方互換性）
    if problem_id:
        payload["problem_id"] = problem_id
    
    # 新しい構造（改善版・優先）
    if problem_metadata_id:
        payload["problem_metadata_id"] = problem_metadata_id
    if problem_details_id:
        payload["problem_details_id"] = problem_details_id
    
    response = requests.post(
        f"{API_BASE_URL}/v1/review",
        json=payload,
        timeout=300  # LLM処理に時間がかかるため、5分に延長
    )
    response.raise_for_status()
    return response.json()


def get_review(submission_id: int) -> dict:
    """講評を取得"""
    response = requests.get(
        f"{API_BASE_URL}/v1/review/{submission_id}",
        timeout=10
    )
    response.raise_for_status()
    return response.json()


def get_short_answer_problems(
    exam_type: Optional[str] = None,
    year: Optional[str] = None,
    subject: Optional[str] = None,
    is_random: bool = False
) -> List[dict]:
    """短答式問題一覧を取得"""
    try:
        params = {}
        if exam_type:
            params["exam_type"] = exam_type
        if year:
            params["year"] = year
        if subject:
            params["subject"] = subject
        if is_random:
            params["is_random"] = "true"
        
        response = requests.get(f"{API_BASE_URL}/v1/short-answer/problems", params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        return data.get("problems", [])
    except Exception as e:
        st.error(f"問題の取得に失敗しました: {str(e)}")
        return []


def get_available_short_answer_years(exam_type: Optional[str] = None) -> List[str]:
    """利用可能な年度の一覧を取得（短答式）"""
    try:
        params = {}
        if exam_type:
            params["exam_type"] = exam_type
        
        response = requests.get(f"{API_BASE_URL}/v1/short-answer/problems", params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        problems = data.get("problems", [])
        years = sorted(set(p["year"] for p in problems), reverse=True)
        return years
    except Exception:
        return []


def get_available_short_answer_subjects(exam_type: Optional[str] = None, year: Optional[str] = None) -> List[str]:
    """利用可能な科目の一覧を取得（短答式）"""
    try:
        params = {}
        if exam_type:
            params["exam_type"] = exam_type
        if year:
            params["year"] = year
        
        response = requests.get(f"{API_BASE_URL}/v1/short-answer/problems", params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        problems = data.get("problems", [])
        subjects = sorted(set(p["subject"] for p in problems))
        return subjects
    except Exception:
        return []


def create_short_answer_session(
    exam_type: str,
    year: str,
    subject: str,
    is_random: bool,
    problem_ids: List[int]
) -> dict:
    """短答式セッションを作成"""
    response = requests.post(
        f"{API_BASE_URL}/v1/short-answer/sessions",
        json={
            "exam_type": exam_type,
            "year": year,
            "subject": subject,
            "is_random": is_random,
            "problem_ids": problem_ids
        },
        timeout=10
    )
    response.raise_for_status()
    return response.json()


def submit_short_answer_answer(session_id: int, problem_id: int, selected_answer: str) -> dict:
    """短答式の回答を送信"""
    response = requests.post(
        f"{API_BASE_URL}/v1/short-answer/answers",
        json={
            "session_id": session_id,
            "problem_id": problem_id,
            "selected_answer": selected_answer
        },
        timeout=10
    )
    response.raise_for_status()
    return response.json()


def chat_review(submission_id: int, question: str, chat_history: Optional[List[dict]] = None) -> str:
    """講評に関する質問に答える"""
    payload = {
        "submission_id": submission_id,
        "question": question
    }
    if chat_history:
        payload["chat_history"] = chat_history
    
    response = requests.post(
        f"{API_BASE_URL}/v1/review/chat",
        json=payload,
        timeout=60
    )
    response.raise_for_status()
    data = response.json()
    return data.get("answer", "")


def free_chat(question: str, chat_history: Optional[List[dict]] = None) -> str:
    """フリーチャット（文脈に縛られない汎用的なチャット）"""
    payload = {
        "question": question
    }
    if chat_history:
        payload["chat_history"] = chat_history
    
    response = requests.post(
        f"{API_BASE_URL}/v1/chat",
        json=payload,
        timeout=60
    )
    response.raise_for_status()
    data = response.json()
    return data.get("answer", "")


def _get_auth_headers() -> dict:
    """認証ヘッダーを取得"""
    user = get_current_user()
    if user and 'access_token' in st.session_state:
        return {"Authorization": f"Bearer {st.session_state['access_token']}"}
    return {}


# 過去の記録取得
def get_my_submissions(limit: int = 50, offset: int = 0) -> List[dict]:
    """自分の答案一覧を取得"""
    try:
        headers = _get_auth_headers()
        response = requests.get(
            f"{API_BASE_URL}/v1/users/me/submissions",
            params={"limit": limit, "offset": offset},
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 401:
            return []  # 認証されていない場合は空リスト
        st.error(f"答案の取得に失敗しました: {str(e)}")
        return []
    except Exception as e:
        st.error(f"答案の取得に失敗しました: {str(e)}")
        return []


def get_all_submissions_dev(limit: int = 100, offset: int = 0) -> List[dict]:
    """開発用：全投稿一覧を取得（認証不要）"""
    try:
        response = requests.get(
            f"{API_BASE_URL}/v1/dev/submissions",
            params={"limit": limit, "offset": offset},
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        st.error(f"投稿の取得に失敗しました: {str(e)}")
        return []


def get_my_short_answer_sessions(limit: int = 50, offset: int = 0) -> List[dict]:
    """自分の短答式セッション一覧を取得"""
    try:
        headers = _get_auth_headers()
        response = requests.get(
            f"{API_BASE_URL}/v1/users/me/short-answer-sessions",
            params={"limit": limit, "offset": offset},
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 401:
            return []  # 認証されていない場合は空リスト
        st.error(f"短答式セッションの取得に失敗しました: {str(e)}")
        return []
    except Exception as e:
        st.error(f"短答式セッションの取得に失敗しました: {str(e)}")
        return []


# ノート機能
def get_notebooks() -> List[dict]:
    """ノートブック一覧を取得"""
    try:
        headers = _get_auth_headers()
        response = requests.get(
            f"{API_BASE_URL}/v1/notebooks",
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        if response.status_code == 401:
            return []
        st.error(f"ノートブックの取得に失敗しました: {str(e)}")
        return []


def get_notebook(notebook_id: int) -> dict:
    """ノートブック詳細を取得"""
    try:
        headers = _get_auth_headers()
        response = requests.get(
            f"{API_BASE_URL}/v1/notebooks/{notebook_id}",
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        st.error(f"ノートブックの取得に失敗しました: {str(e)}")
        return {}


def create_notebook(title: str, description: Optional[str] = None, color: Optional[str] = None) -> dict:
    """ノートブックを作成"""
    headers = _get_auth_headers()
    response = requests.post(
        f"{API_BASE_URL}/v1/notebooks",
        json={"title": title, "description": description, "color": color},
        headers=headers,
        timeout=10
    )
    response.raise_for_status()
    return response.json()


def update_notebook(notebook_id: int, title: Optional[str] = None, description: Optional[str] = None, color: Optional[str] = None) -> dict:
    """ノートブックを更新"""
    headers = _get_auth_headers()
    payload = {}
    if title is not None:
        payload["title"] = title
    if description is not None:
        payload["description"] = description
    if color is not None:
        payload["color"] = color
    
    response = requests.put(
        f"{API_BASE_URL}/v1/notebooks/{notebook_id}",
        json=payload,
        headers=headers,
        timeout=10
    )
    response.raise_for_status()
    return response.json()


def delete_notebook(notebook_id: int):
    """ノートブックを削除"""
    headers = _get_auth_headers()
    response = requests.delete(
        f"{API_BASE_URL}/v1/notebooks/{notebook_id}",
        headers=headers,
        timeout=10
    )
    response.raise_for_status()


def create_note_section(notebook_id: int, title: str, display_order: int = 0) -> dict:
    """セクションを作成"""
    headers = _get_auth_headers()
    response = requests.post(
        f"{API_BASE_URL}/v1/note-sections",
        json={"notebook_id": notebook_id, "title": title, "display_order": display_order},
        headers=headers,
        timeout=10
    )
    response.raise_for_status()
    return response.json()


def update_note_section(section_id: int, title: Optional[str] = None, display_order: Optional[int] = None) -> dict:
    """セクションを更新"""
    headers = _get_auth_headers()
    payload = {}
    if title is not None:
        payload["title"] = title
    if display_order is not None:
        payload["display_order"] = display_order
    
    response = requests.put(
        f"{API_BASE_URL}/v1/note-sections/{section_id}",
        json=payload,
        headers=headers,
        timeout=10
    )
    response.raise_for_status()
    return response.json()


def delete_note_section(section_id: int):
    """セクションを削除"""
    headers = _get_auth_headers()
    response = requests.delete(
        f"{API_BASE_URL}/v1/note-sections/{section_id}",
        headers=headers,
        timeout=10
    )
    response.raise_for_status()


def create_note_page(section_id: int, title: str, content: Optional[str] = None, display_order: int = 0) -> dict:
    """ページを作成"""
    headers = _get_auth_headers()
    response = requests.post(
        f"{API_BASE_URL}/v1/note-pages",
        json={"section_id": section_id, "title": title, "content": content, "display_order": display_order},
        headers=headers,
        timeout=10
    )
    response.raise_for_status()
    return response.json()


def update_note_page(page_id: int, title: Optional[str] = None, content: Optional[str] = None, display_order: Optional[int] = None) -> dict:
    """ページを更新"""
    headers = _get_auth_headers()
    payload = {}
    if title is not None:
        payload["title"] = title
    if content is not None:
        payload["content"] = content
    if display_order is not None:
        payload["display_order"] = display_order
    
    response = requests.put(
        f"{API_BASE_URL}/v1/note-pages/{page_id}",
        json=payload,
        headers=headers,
        timeout=10
    )
    response.raise_for_status()
    return response.json()


def delete_note_page(page_id: int):
    """ページを削除"""
    headers = _get_auth_headers()
    response = requests.delete(
        f"{API_BASE_URL}/v1/note-pages/{page_id}",
        headers=headers,
        timeout=10
    )
    response.raise_for_status()
