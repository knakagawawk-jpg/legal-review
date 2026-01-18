from pydantic import BaseModel
from typing import Optional, Any, Dict, List
from datetime import datetime
import uuid

# Problem関連のスキーマ（改善版）
class ProblemMetadataResponse(BaseModel):
    """問題メタデータのレスポンス"""
    id: int
    exam_type: str
    year: int
    subject: int  # 科目ID（1-18）
    subject_name: str  # 科目名（表示用）
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ProblemDetailsResponse(BaseModel):
    """問題詳細情報のレスポンス"""
    id: int
    problem_metadata_id: int
    question_number: int
    question_text: str
    purpose: Optional[str] = None
    scoring_notes: Optional[str] = None
    pdf_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ProblemMetadataWithDetailsResponse(BaseModel):
    """問題メタデータ + 詳細情報のリスト"""
    metadata: ProblemMetadataResponse
    details: List[ProblemDetailsResponse]

class ProblemDetailsCreate(BaseModel):
    """問題詳細情報の作成用スキーマ"""
    question_number: int
    question_text: str
    purpose: Optional[str] = None
    scoring_notes: Optional[str] = None
    pdf_path: Optional[str] = None

class ProblemMetadataCreate(BaseModel):
    """問題メタデータの作成用スキーマ（詳細情報も含む）"""
    exam_type: str  # "司法試験" or "予備試験"
    year: int
    subject: Optional[int] = None  # 科目ID（1-18）
    subject_name: Optional[str] = None  # 科目名（subjectが指定されていない場合に使用）
    details: List[ProblemDetailsCreate]  # 設問ごとの詳細情報

class ProblemDetailsUpdate(BaseModel):
    """問題詳細情報の更新用スキーマ"""
    question_text: Optional[str] = None
    purpose: Optional[str] = None
    scoring_notes: Optional[str] = None
    pdf_path: Optional[str] = None

# 既存のProblem関連のスキーマ（後方互換性のため保持）
class ProblemCreate(BaseModel):
    exam_type: str  # "司法試験" or "予備試験"
    year: int
    subject: int  # 科目ID（1-18）
    question_text: str
    scoring_notes: Optional[str] = None
    purpose: Optional[str] = None
    other_info: Optional[Dict[str, Any]] = None
    pdf_path: Optional[str] = None

class ProblemUpdate(BaseModel):
    exam_type: Optional[str] = None
    year: Optional[int] = None
    subject: Optional[int] = None  # 科目ID（1-18）
    question_text: Optional[str] = None
    scoring_notes: Optional[str] = None
    purpose: Optional[str] = None
    other_info: Optional[Dict[str, Any]] = None

class ProblemResponse(BaseModel):
    id: int
    exam_type: str
    year: int
    subject: int  # 科目ID（1-18）
    subject_name: str  # 表示用（DBは数字で保持）
    question_text: str
    scoring_notes: Optional[str] = None
    purpose: Optional[str] = None
    other_info: Optional[Dict[str, Any]] = None
    pdf_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ProblemListResponse(BaseModel):
    problems: List[ProblemResponse]
    total: int

class ProblemMetadataListResponse(BaseModel):
    """問題メタデータのリストレスポンス（改善版）"""
    metadata_list: List[ProblemMetadataResponse]
    total: int

class ProblemBulkCreateResponse(BaseModel):
    success_count: int
    error_count: int
    errors: List[Dict[str, Any]]

class ProblemYearsResponse(BaseModel):
    years: List[int]

class ProblemSubjectsResponse(BaseModel):
    subjects: List[str]

# Review関連のスキーマ
class ReviewRequest(BaseModel):
    problem_id: Optional[int] = None  # 既存問題を選択する場合（旧形式、後方互換性のため保持）
    problem_metadata_id: Optional[int] = None  # 新しい問題メタデータID（改善版）
    problem_details_id: Optional[int] = None  # 新しい問題詳細ID（設問指定、改善版）
    subject: Optional[int] = None  # 科目ID（1-18）
    subject_name: Optional[str] = None  # 科目名（subjectが指定されていない場合に使用）
    question_text: Optional[str] = None  # problem_details_idがある場合は無視される
    answer_text: str
    question_title: Optional[str] = None  # 問題タイトル（任意）
    reference_text: Optional[str] = None  # 参照文章（任意、講評上参照してほしい解説等）

class ReviewResponse(BaseModel):
    review_id: Optional[int] = None
    submission_id: int
    review_markdown: str
    review_json: Dict[str, Any]
    answer_text: str
    question_text: Optional[str] = None
    subject: Optional[int] = None  # 科目ID（1-18）
    subject_name: Optional[str] = None  # 科目名（表示用）
    purpose: Optional[str] = None
    question_title: Optional[str] = None  # 問題タイトル（新規問題の場合）

class ReviewChatRequest(BaseModel):
    # 旧: submission_idベース（現在はreview_id中心のため非推奨）
    submission_id: Optional[int] = None
    review_id: Optional[int] = None
    question: str
    chat_history: Optional[List[Dict[str, str]]] = None  # [{"role": "user", "content": "..."}, ...]

class ReviewChatResponse(BaseModel):
    answer: str

class FreeChatRequest(BaseModel):
    question: str
    chat_history: Optional[List[Dict[str, str]]] = None  # [{"role": "user", "content": "..."}, ...]

class FreeChatResponse(BaseModel):
    answer: str

# 短答式問題関連のスキーマ
class ShortAnswerProblemCreate(BaseModel):
    exam_type: str
    year: str  # "R7", "H30"など
    subject: Optional[int] = None  # 科目ID（1-18）
    subject_name: Optional[str] = None  # 科目名（subjectが指定されていない場合に使用）
    question_number: int
    question_text: str
    choice_1: str
    choice_2: str
    choice_3: str
    choice_4: Optional[str] = None
    correct_answer: str  # "1", "2", "1,2"など
    correctness_pattern: str  # "〇☓☓☓"など
    source_pdf: Optional[str] = None

class ShortAnswerProblemResponse(BaseModel):
    id: int
    exam_type: str
    year: str
    subject: int  # 科目ID（1-18）
    subject_name: str  # 科目名（表示用）
    question_number: int
    question_text: str
    choice_1: str
    choice_2: str
    choice_3: str
    choice_4: Optional[str] = None
    correct_answer: str
    correctness_pattern: str
    source_pdf: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ShortAnswerProblemListResponse(BaseModel):
    problems: List[ShortAnswerProblemResponse]
    total: int

class ShortAnswerSessionCreate(BaseModel):
    exam_type: str
    year: Optional[str] = None
    subject: Optional[int] = None  # 科目ID（1-18）
    subject_name: Optional[str] = None  # 科目名（subjectが指定されていない場合に使用）
    is_random: bool = False
    problem_ids: List[int]

class ShortAnswerSessionResponse(BaseModel):
    id: int
    exam_type: str
    year: Optional[str] = None
    subject: int  # 科目ID（1-18）
    subject_name: str  # 科目名（表示用）
    is_random: bool
    problem_ids: List[int]
    started_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ShortAnswerAnswerCreate(BaseModel):
    session_id: int
    problem_id: int
    selected_answer: str  # "1", "2", "1,2"など

class ShortAnswerAnswerResponse(BaseModel):
    id: int
    session_id: int
    problem_id: int
    selected_answer: Optional[str] = None
    is_correct: Optional[bool] = None
    answered_at: datetime

    class Config:
        from_attributes = True

# ノート機能関連のスキーマ
class NotebookCreate(BaseModel):
    subject_id: int  # 科目ID（1-18）
    title: str
    description: Optional[str] = None
    color: Optional[str] = None

class NotebookUpdate(BaseModel):
    subject_id: Optional[int] = None  # 科目ID（1-18）
    title: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None

class NotebookResponse(BaseModel):
    id: int
    user_id: Optional[int]
    subject_id: int
    title: str
    description: Optional[str]
    color: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class NoteSectionCreate(BaseModel):
    notebook_id: int
    title: str
    display_order: Optional[int] = 0

class NoteSectionUpdate(BaseModel):
    title: Optional[str] = None
    display_order: Optional[int] = None

class NoteSectionResponse(BaseModel):
    id: int
    notebook_id: int
    title: str
    display_order: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class NotePageCreate(BaseModel):
    section_id: int
    title: Optional[str] = None
    content: Optional[str] = None
    display_order: Optional[int] = 0

class NotePageUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    display_order: Optional[int] = None

class NotePageResponse(BaseModel):
    id: int
    section_id: int
    title: Optional[str] = None
    content: Optional[str]
    display_order: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class NoteSectionDetailResponse(NoteSectionResponse):
    pages: List[NotePageResponse] = []

class NotebookDetailResponse(NotebookResponse):
    sections: List[NoteSectionDetailResponse] = []

# 過去の記録取得用スキーマ
class SubmissionHistoryResponse(BaseModel):
    id: int
    subject: Optional[int] = None  # 科目ID（1-18）
    question_text: Optional[str]
    answer_text: str
    created_at: datetime
    review: Optional[Dict[str, Any]] = None

class ShortAnswerHistoryResponse(BaseModel):
    session_id: int
    exam_type: str
    year: Optional[str]
    subject: int  # 科目ID（1-18）
    subject_name: str  # 科目名（表示用）
    started_at: datetime
    completed_at: Optional[datetime]
    total_problems: int
    correct_count: int
    accuracy: float

class UserReviewHistoryResponse(BaseModel):
    """ユーザー講評履歴レスポンス"""
    id: int
    review_id: int
    subject: Optional[int] = None  # 科目ID（1-18）
    subject_name: Optional[str] = None  # 科目名（表示用）
    exam_type: Optional[str]
    year: Optional[int]
    score: Optional[float]
    attempt_count: int
    question_title: Optional[str] = None
    reference_text: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# フリーチャット用スキーマ（threads/messagesベース）
class ThreadCreate(BaseModel):
    """スレッド作成用スキーマ"""
    title: Optional[str] = None

class ThreadResponse(BaseModel):
    """スレッドレスポンス"""
    id: int
    user_id: int
    type: str
    title: Optional[str] = None
    created_at: datetime
    last_message_at: Optional[datetime] = None
    is_archived: bool
    pinned: bool

    class Config:
        from_attributes = True

class ThreadListResponse(BaseModel):
    """スレッド一覧レスポンス"""
    threads: List[ThreadResponse]
    total: int

class MessageCreate(BaseModel):
    """メッセージ作成用スキーマ"""
    content: str

class MessageResponse(BaseModel):
    """メッセージレスポンス"""
    id: int
    thread_id: int
    role: str
    content: str
    created_at: datetime
    model: Optional[str] = None
    prompt_version: Optional[str] = None
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    cost_yen: Optional[float] = None
    request_id: Optional[str] = None

    class Config:
        from_attributes = True

class MessageListResponse(BaseModel):
    """メッセージ一覧レスポンス"""
    messages: List[MessageResponse]
    total: int

class ThreadMessageCreate(BaseModel):
    """スレッドにメッセージを送信する用スキーマ"""
    content: str

# ユーザー関連のスキーマ
class UserUpdate(BaseModel):
    """ユーザー情報更新用スキーマ"""
    name: Optional[str] = None
    email: Optional[str] = None

class UserResponse(BaseModel):
    """ユーザー情報レスポンス"""
    id: int
    email: str
    name: Optional[str]
    is_active: bool
    is_admin: bool

    class Config:
        from_attributes = True


# ============================================================================
# ダッシュボード項目関連のスキーマ
# ============================================================================

class DashboardItemCreate(BaseModel):
    """ダッシュボード項目作成用スキーマ"""
    dashboard_date: str  # 'YYYY-MM-DD'
    entry_type: int  # 1=Point, 2=Task
    subject: Optional[int] = None  # 1〜18、NULL可
    item: str  # 項目本文
    due_date: Optional[str] = None  # 'YYYY-MM-DD'、PointはNULL強制
    status: int = 1  # 1=未了, 2=作業中, 3=完了, 4=後で
    memo: Optional[str] = None
    position: Optional[int] = None  # 指定しない場合は自動採番

class DashboardItemUpdate(BaseModel):
    """ダッシュボード項目更新用スキーマ"""
    dashboard_date: Optional[str] = None
    entry_type: Optional[int] = None
    subject: Optional[int] = None
    item: Optional[str] = None
    due_date: Optional[str] = None
    status: Optional[int] = None
    memo: Optional[str] = None
    position: Optional[int] = None

class DashboardItemResponse(BaseModel):
    """ダッシュボード項目レスポンス"""
    id: int
    user_id: int
    dashboard_date: str
    entry_type: int
    subject: Optional[int]
    item: str
    due_date: Optional[str]
    status: int
    memo: Optional[str]
    position: int
    created_at: str
    updated_at: str
    deleted_at: Optional[str]

    class Config:
        from_attributes = True

class DashboardItemListResponse(BaseModel):
    """ダッシュボード項目リストレスポンス"""
    items: List[DashboardItemResponse]
    total: int


# ============================================================================
# タイマー関連スキーマ
# ============================================================================

class TimerSessionResponse(BaseModel):
    """タイマーセッションレスポンス"""
    id: str
    user_id: int
    device_id: Optional[str]
    started_at_utc: datetime
    ended_at_utc: Optional[datetime]
    status: str
    stop_reason: Optional[str]
    created_at_utc: datetime
    updated_at_utc: datetime

    class Config:
        from_attributes = True


class TimerDailyStatsResponse(BaseModel):
    """日次統計レスポンス"""
    user_id: int
    study_date: str
    total_seconds: int
    sessions_count: int
    updated_at_utc: datetime

    class Config:
        from_attributes = True


class TimerStartResponse(BaseModel):
    """タイマー開始レスポンス"""
    active_session_id: str
    study_date: str
    confirmed_total_seconds: int
    active_started_at_utc: datetime
    daily_stats: TimerDailyStatsResponse
    sessions: List[TimerSessionResponse]


class TimerStopResponse(BaseModel):
    """タイマー停止レスポンス"""
    study_date: str
    confirmed_total_seconds: int
    daily_stats: TimerDailyStatsResponse
    sessions: List[TimerSessionResponse]


# ============================================================================
# My規範・My論点: 科目別タグマスタ
# ============================================================================

class StudyTagCreate(BaseModel):
    subject_id: int  # 1-18
    name: str


class StudyTagResponse(BaseModel):
    id: int
    user_id: int
    subject_id: int
    name: str
    created_at: datetime

    class Config:
        from_attributes = True


class StudyItemCreate(BaseModel):
    entry_type: int  # 1=規範, 2=論点
    subject_id: int  # 1-18
    item: str = ""
    importance: int = 1  # 1-3
    mastery_level: Optional[int] = None  # 1-5
    content: str = ""
    memo: Optional[str] = ""
    tags: List[str] = []
    created_date: Optional[str] = None  # "YYYY-MM-DD"（任意）


class StudyItemUpdate(BaseModel):
    item: Optional[str] = None
    importance: Optional[int] = None
    mastery_level: Optional[int] = None
    content: Optional[str] = None
    memo: Optional[str] = None
    tags: Optional[List[str]] = None
    created_date: Optional[str] = None  # "YYYY-MM-DD"


class StudyItemResponse(BaseModel):
    id: int
    user_id: int
    entry_type: int
    subject_id: int
    item: str
    importance: int
    mastery_level: Optional[int]
    content: str
    memo: Optional[str]
    tags: List[str]
    created_date: datetime
    position: int
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime]

    class Config:
        from_attributes = True


class StudyItemReorderRequest(BaseModel):
    subject_id: int
    entry_type: int
    ordered_ids: List[int]
