from pydantic import BaseModel
from typing import Optional, Any, Dict, List
from datetime import datetime

# Problem関連のスキーマ（改善版）
class ProblemMetadataResponse(BaseModel):
    """問題メタデータのレスポンス"""
    id: int
    exam_type: str
    year: int
    subject: str
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
    subject: str
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
    subject: str
    question_text: str
    scoring_notes: Optional[str] = None
    purpose: Optional[str] = None
    other_info: Optional[Dict[str, Any]] = None
    pdf_path: Optional[str] = None

class ProblemUpdate(BaseModel):
    exam_type: Optional[str] = None
    year: Optional[int] = None
    subject: Optional[str] = None
    question_text: Optional[str] = None
    scoring_notes: Optional[str] = None
    purpose: Optional[str] = None
    other_info: Optional[Dict[str, Any]] = None

class ProblemResponse(BaseModel):
    id: int
    exam_type: str
    year: int
    subject: str
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
    subject: str
    question_text: Optional[str] = None  # problem_details_idがある場合は無視される
    answer_text: str

class ReviewResponse(BaseModel):
    submission_id: int
    review_markdown: str
    review_json: Dict[str, Any]
    answer_text: str
    question_text: Optional[str] = None
    subject: Optional[str] = None
    purpose: Optional[str] = None

class ReviewChatRequest(BaseModel):
    submission_id: int
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
    subject: str
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
    subject: str
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
    subject: str
    is_random: bool = False
    problem_ids: List[int]

class ShortAnswerSessionResponse(BaseModel):
    id: int
    exam_type: str
    year: Optional[str] = None
    subject: str
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
    title: str
    description: Optional[str] = None
    color: Optional[str] = None

class NotebookUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None

class NotebookResponse(BaseModel):
    id: int
    user_id: Optional[int]
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
    title: str
    content: Optional[str] = None
    display_order: Optional[int] = 0

class NotePageUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    display_order: Optional[int] = None

class NotePageResponse(BaseModel):
    id: int
    section_id: int
    title: str
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
    subject: str
    question_text: Optional[str]
    answer_text: str
    created_at: datetime
    review: Optional[Dict[str, Any]] = None

class ShortAnswerHistoryResponse(BaseModel):
    session_id: int
    exam_type: str
    year: Optional[str]
    subject: str
    started_at: datetime
    completed_at: Optional[datetime]
    total_problems: int
    correct_count: int
    accuracy: float
