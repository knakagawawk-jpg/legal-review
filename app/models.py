import os
from sqlalchemy import Column, Integer, BigInteger, String, Text, DateTime, ForeignKey, Boolean, Index, UniqueConstraint, CheckConstraint, Numeric
from sqlalchemy.sql import func, text as sql_text
try:
    # PostgreSQL用（SQLiteではコンパイルできないため、使用はURL判定で制御する）
    from sqlalchemy.dialects.postgresql import JSONB  # type: ignore
except Exception:  # pragma: no cover
    JSONB = None  # type: ignore
from sqlalchemy.orm import relationship
from .db import Base

# ============================================================================
# 新しいDB設計: 科目管理
# ============================================================================

class Subject(Base):
    """
    科目テーブル
    
    設計のポイント:
    - 科目名を一元管理し、IDで参照
    - display_order で科目の表示順序を管理
    - 憲法=1, 行政法=2, 民法=3, ... の順序
    """
    __tablename__ = "subjects"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)  # 科目名
    display_order = Column(Integer, nullable=False, unique=True)  # 表示順序
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # 注意: Subjectテーブルは削除予定（科目は1-18の数字で管理）
    # OfficialQuestionはsubject_idで直接管理するため、リレーションシップは削除
    
    __table_args__ = (
        Index('idx_subjects_display_order', 'display_order'),
        Index('idx_subjects_name', 'name'),
    )


# ============================================================================
# 新しいDB設計: 公式問題管理
# ============================================================================

class OfficialQuestion(Base):
    """
    公式問題テーブル（バージョン管理対応）
    
    設計のポイント:
    - 同一の試験種別・年度・科目に対して複数のバージョンを持つことができる
    - status='active'のものは1つだけ（部分ユニークインデックスで保証）
    - 司法試験のみ採点実感を持つ（別テーブルで管理）
    """
    __tablename__ = "official_questions"
    
    # SQLiteで自動採番を効かせるには INTEGER PRIMARY KEY が必要なので variant を使う
    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    
    # 識別情報
    shiken_type = Column(String(10), nullable=False)  # 'shihou' or 'yobi'
    nendo = Column(Integer, nullable=False)  # 年度（2000以上）
    subject_id = Column(Integer, nullable=False, index=True)  # 科目ID（1-18）
    
    # バージョン管理
    version = Column(Integer, nullable=False)  # バージョン番号（1以上）
    status = Column(String(10), nullable=False)  # 'active' or 'old'
    
    # 問題文関連
    text = Column(Text, nullable=False)  # 問題文
    syutudaisyusi = Column(Text, nullable=True)  # 出題趣旨
    
    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # リレーションシップ
    # subject_idは1-18の数字で管理（Subjectテーブルへの参照は削除）
    reviews = relationship("Review", foreign_keys="Review.official_question_id", back_populates="official_question")
    grading_impression = relationship(
        "ShihouGradingImpression",
        back_populates="question",
        uselist=False,
        cascade="all, delete-orphan"
    )
    
    __table_args__ = (
        # CHECK制約
        CheckConstraint("shiken_type IN ('shihou', 'yobi')", name="ck_shiken_type"),
        CheckConstraint("nendo >= 2000", name="ck_nendo"),
        CheckConstraint("version >= 1", name="ck_version"),
        CheckConstraint("status IN ('active', 'old')", name="ck_status"),
        
        # バージョンごとのユニーク制約（oldを複数持つために必須）
        UniqueConstraint('shiken_type', 'nendo', 'subject_id', 'version', name='uq_question_version'),

        # status='active' を1つに制限（oldは複数可）
        Index(
            "uq_one_active_per_question",
            "shiken_type",
            "nendo",
            "subject_id",
            unique=True,
            sqlite_where=sql_text("status = 'active'"),
            postgresql_where=sql_text("status = 'active'"),
        ),
        
        # 検索用インデックス
        Index('idx_questions_lookup', 'shiken_type', 'nendo', 'subject_id', 'status'),
        Index('idx_questions_subject', 'subject_id'),
        CheckConstraint("subject_id BETWEEN 1 AND 18", name="ck_official_question_subject"),
        
        # 注意: 既存DBにはcreate_allが効かないので、別途マイグレーションで作成する
    )


class ShihouGradingImpression(Base):
    """
    司法試験の採点実感テーブル
    
    設計のポイント:
    - 司法試験の問題のみがこのテーブルにレコードを持つ
    - question_idがPRIMARY KEY（1対1の関係）
    - CASCADE削除で問題削除時に自動削除
    """
    __tablename__ = "shihou_grading_impressions"
    
    question_id = Column(
        BigInteger().with_variant(Integer, "sqlite"),
        ForeignKey("official_questions.id", ondelete="CASCADE"),
        primary_key=True
    )
    grading_impression_text = Column(Text, nullable=False)
    
    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # リレーションシップ
    question = relationship("OfficialQuestion", back_populates="grading_impression")


class Review(Base):
    """
    講評テーブル（新設計）
    
    設計のポイント:
    - 公式問題と自由問題の両方に対応
    - source_typeで区別（'official' または 'custom'）
    - 公式問題の場合: official_question_idを保存
    - 自由問題の場合: custom_question_textに問題文を直接保存
    - チャット機能: thread_idで管理（NULL可）
    - 講評チャットはthreads.type='review_chat'として管理
    - LLMの出力JSONはkouhyo_kekka（JSONB）に保存
    """
    __tablename__ = "reviews"
    
    # SQLiteで自動採番を効かせるには INTEGER PRIMARY KEY が必要なので variant を使う
    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    user_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)  # 作成者（NULL可で共有講評も可能）
    
    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # 問題の種類と参照
    source_type = Column(String(10), nullable=False)  # 'official' or 'custom'
    official_question_id = Column(
        BigInteger().with_variant(Integer, "sqlite"),
        ForeignKey("official_questions.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    custom_question_text = Column(Text, nullable=True)  # 自由問題の場合の問題文
    
    # ユーザー答案
    answer_text = Column(Text, nullable=False)
    
    # LLMの出力結果
    # - SQLite: Text（JSON文字列として保存）
    # - PostgreSQL: JSONB（DB URL 判定）
    _db_url = (os.getenv("DATABASE_URL") or "").lower()
    _use_jsonb = bool(JSONB) and (_db_url.startswith("postgresql://") or _db_url.startswith("postgres://"))
    kouhyo_kekka = Column(JSONB, nullable=False) if _use_jsonb else Column(Text, nullable=False)
    
    # チャット機能
    thread_id = Column(
        Integer,
        ForeignKey("threads.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )  # threads.id を参照
    has_chat = Column(Boolean, nullable=False, default=False)  # チャット有無フラグ（一覧表示の高速化用）
    
    # リレーションシップ
    user = relationship("User", back_populates="reviews")  # 作成者
    official_question = relationship("OfficialQuestion", foreign_keys=[official_question_id], back_populates="reviews")
    thread = relationship("Thread", foreign_keys=[thread_id], back_populates="reviews")
    user_history = relationship("UserReviewHistory", back_populates="review")
    
    __table_args__ = (
        # CHECK制約: source_typeと問題参照の整合性
        CheckConstraint(
            "(source_type='official' AND official_question_id IS NOT NULL AND custom_question_text IS NULL) "
            "OR (source_type='custom' AND official_question_id IS NULL AND custom_question_text IS NOT NULL)",
            name="ck_reviews_source_consistency"
        ),
        CheckConstraint("source_type IN ('official', 'custom')", name="ck_reviews_source_type"),
        
        # インデックス
        Index('idx_reviews_user_created', 'user_id', 'created_at'),
        Index('idx_reviews_created', 'created_at'),
        Index('idx_reviews_official_q', 'official_question_id'),
        Index('idx_reviews_thread', 'thread_id'),  # チャット検索用
    )


class Thread(Base):
    """
    チャットスレッドテーブル（会話の箱）
    
    設計のポイント:
    - 1つのチャットルーム = 1 thread
    - フリーチャットは type='free_chat' を使用
    - 講評チャット、短答チャットも同じ仕組みで管理可能（将来拡張）
    - last_message_at で一覧の並び替えを高速化
    """
    __tablename__ = "threads"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)  # 所有者
    
    # スレッドの種類
    type = Column(String(20), nullable=False)  # 'free_chat', 'review_chat', 'short_answer_chat' など
    
    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_message_at = Column(DateTime(timezone=True), nullable=True)  # 最終発言日時（一覧の並び替えに必須）
    
    # メタデータ
    title = Column(String(200), nullable=True)  # タイトル（空でもOK、後から自動生成・手動編集可能）
    is_archived = Column(Boolean, nullable=False, default=False)  # アーカイブフラグ（履歴整理用）
    pinned = Column(Boolean, nullable=False, default=False)  # 固定表示フラグ（任意）
    
    # リレーションシップ
    user = relationship("User", back_populates="threads")
    messages = relationship("Message", back_populates="thread", cascade="all, delete-orphan", order_by="Message.created_at")
    reviews = relationship("Review", foreign_keys="Review.thread_id", back_populates="thread")
    
    __table_args__ = (
        CheckConstraint("type IN ('free_chat', 'review_chat', 'short_answer_chat')", name="ck_thread_type"),
        
        # 一覧表示を高速化するインデックス
        # 完全版: (user_id, type, is_archived, pinned, last_message_at)
        Index('idx_threads_user_type_archived_pinned_last', 'user_id', 'type', 'is_archived', 'pinned', 'last_message_at'),
        # 最低限版: (user_id, type, is_archived, last_message_at DESC)
        Index('idx_threads_user_type_archived_last', 'user_id', 'type', 'is_archived', 'last_message_at'),
    )


class Message(Base):
    """
    メッセージテーブル（会話の中身）
    
    設計のポイント:
    - スレッドに紐づく発言を全てここに保存
    - role で user/assistant/system を区別
    - コスト管理のため、LLM呼び出し情報を記録
    - request_id で同一LLM呼び出しの重複計上を防止
    """
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    thread_id = Column(
        Integer,
        ForeignKey("threads.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # メッセージ内容
    role = Column(String(20), nullable=False)  # 'user', 'assistant', 'system'
    content = Column(Text, nullable=False)  # 本文
    
    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # LLM呼び出し情報（運用・コスト管理）
    model = Column(String(100), nullable=True)  # 使用したLLMモデル名
    prompt_version = Column(String(50), nullable=True)  # プロンプトのバージョン
    input_tokens = Column(Integer, nullable=True)  # 入力トークン数
    output_tokens = Column(Integer, nullable=True)  # 出力トークン数
    cost_yen = Column(Numeric(10, 2), nullable=True)  # コスト（円）
    request_id = Column(String(255), nullable=True)  # 同一LLM呼び出しの重複計上防止用
    
    # リレーションシップ
    thread = relationship("Thread", back_populates="messages")
    
    __table_args__ = (
        CheckConstraint("role IN ('user', 'assistant', 'system')", name="ck_message_role"),
        
        # スレッド表示を高速化するインデックス
        Index('idx_messages_thread_created', 'thread_id', 'created_at'),
        # コスト集計用インデックス
        Index('idx_messages_thread_cost', 'thread_id', 'cost_yen'),
    )


# ============================================================================
# 既存のモデル（後方互換性のため保持）
# ============================================================================

# 新しい問題管理モデル（改善版）
class ProblemMetadata(Base):
    """問題のメタデータテーブル（識別情報のみ）"""
    __tablename__ = "problem_metadata"
    
    id = Column(Integer, primary_key=True, index=True)
    exam_type = Column(String(20), nullable=False)  # "司法試験" or "予備試験"
    year = Column(Integer, nullable=False)  # 年度（例: 2018, 2025）
    subject = Column(Integer, nullable=True, index=True)  # 科目ID（1-18、NULL可）
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # リレーションシップ
    # subjectは1-18の数字で管理（Subjectテーブルへの参照は削除）
    details = relationship("ProblemDetails", back_populates="problem_metadata", cascade="all, delete-orphan", order_by="ProblemDetails.question_number")
    submissions = relationship("Submission", back_populates="problem_metadata")
    
    __table_args__ = (
        UniqueConstraint('exam_type', 'year', 'subject', name='uq_problem_metadata'),
        Index('idx_exam_year_subject', 'exam_type', 'year', 'subject'),
        CheckConstraint("subject BETWEEN 1 AND 18", name="ck_problem_metadata_subject"),
    )

class ProblemDetails(Base):
    """問題の詳細情報テーブル（設問ごとに管理）"""
    __tablename__ = "problem_details"
    
    id = Column(Integer, primary_key=True, index=True)
    problem_metadata_id = Column(Integer, ForeignKey("problem_metadata.id", ondelete="CASCADE"), nullable=False, index=True)
    question_number = Column(Integer, nullable=False)  # 設問番号（1, 2, ...）
    
    # 問題文関連
    question_text = Column(Text, nullable=False)  # 設問ごとの問題文
    
    # 出題趣旨・採点実感
    purpose = Column(Text, nullable=True)  # 出題趣旨
    scoring_notes = Column(Text, nullable=True)  # 採点実感
    
    # その他の情報
    pdf_path = Column(String(500), nullable=True)  # PDFファイルの保存パス
    
    # 今後追加される可能性のあるフィールド用のプレースホルダー
    # difficulty_level = Column(String(20), nullable=True)  # 難易度
    # estimated_time = Column(Integer, nullable=True)  # 目安時間（分）
    # key_points = Column(Text, nullable=True)  # 重要ポイント
    # related_articles = Column(Text, nullable=True)  # 関連条文
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # リレーションシップ
    problem_metadata = relationship("ProblemMetadata", back_populates="details")  # metadataは予約語のためproblem_metadataに変更
    submissions = relationship("Submission", back_populates="problem_details")
    
    __table_args__ = (
        UniqueConstraint('problem_metadata_id', 'question_number', name='uq_problem_details'),
        Index('idx_metadata_question', 'problem_metadata_id', 'question_number'),
    )

# 既存のProblemモデル（後方互換性のため暫定的に保持）
class Problem(Base):
    __tablename__ = "problems"
    id = Column(Integer, primary_key=True, index=True)
    exam_type = Column(String(20), nullable=False)  # "司法試験" or "予備試験"
    year = Column(Integer, nullable=False)  # 年度（例: 2024）
    # 科目ID（1-18）で管理（サービス全体の強制ルール）
    subject = Column(Integer, nullable=False)  # 科目ID
    question_text = Column(Text, nullable=False)  # 問題文
    scoring_notes = Column(Text, nullable=True)  # 採点実感
    purpose = Column(Text, nullable=True)  # 出題趣旨
    other_info = Column(Text, nullable=True)  # その他の情報（JSON形式で保存）
    pdf_path = Column(String(500), nullable=True)  # PDFファイルの保存パス
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # 既存のSubmissionとの互換性のため、relationshipは残す
    old_submissions = relationship("Submission", foreign_keys="Submission.problem_id", back_populates="problem")
    
    __table_args__ = (
        CheckConstraint("subject BETWEEN 1 AND 18", name="ck_problem_subject"),
        Index("idx_problems_exam_year_subject", "exam_type", "year", "subject"),
    )

class Submission(Base):
    __tablename__ = "submissions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)  # ユーザーID（認証OFF時はNULL）
    
    # 既存の問題ID（後方互換性のため保持）
    problem_id = Column(Integer, ForeignKey("problems.id"), nullable=True)  # 旧Problemテーブルへの参照（移行用）
    
    # 新しい問題ID（改善版）
    problem_metadata_id = Column(Integer, ForeignKey("problem_metadata.id", ondelete="SET NULL"), nullable=True, index=True)  # 問題メタデータID
    problem_details_id = Column(Integer, ForeignKey("problem_details.id", ondelete="SET NULL"), nullable=True, index=True)  # 問題詳細ID（設問）
    
    subject = Column(Integer, nullable=True, index=True)  # 科目ID（1-18、NULL可）
    question_text = Column(Text, nullable=True)  # 問題文（problem_details_idがある場合は詳細から取得、ない場合は手動入力）
    answer_text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="submissions")
    # subjectは1-18の数字で管理（Subjectテーブルへの参照は削除）
    problem = relationship("Problem", foreign_keys=[problem_id], back_populates="old_submissions")  # 既存の参照
    problem_metadata = relationship("ProblemMetadata", back_populates="submissions")  # 新しいメタデータ参照
    problem_details = relationship("ProblemDetails", back_populates="submissions")  # 新しい詳細参照
    # 注意: 新しいReviewクラスはSubmissionとは直接関係がないため、リレーションシップを削除
    # 新しいReviewはuser_idとofficial_question_id/custom_question_textで管理される
    
    __table_args__ = (
        Index('idx_user_created_at', 'user_id', 'created_at'),
        Index('idx_metadata_details', 'problem_metadata_id', 'problem_details_id'),
        # subjectがNULLの場合は許可、NULLでない場合は1-18の範囲内であることを確認
        CheckConstraint("subject IS NULL OR (subject BETWEEN 1 AND 18)", name="ck_submission_subject"),
    )

# 短答式問題関連のモデル
class ShortAnswerProblem(Base):
    __tablename__ = "short_answer_problems"
    id = Column(Integer, primary_key=True, index=True)
    exam_type = Column(String(20), nullable=False)  # "司法試験" or "予備試験"
    year = Column(String(10), nullable=False)  # 年度（"R7", "H30"など）
    subject = Column(Integer, nullable=True, index=True)  # 科目ID（1-18、NULL可）
    question_number = Column(Integer, nullable=False)  # 問題番号
    question_text = Column(Text, nullable=False)  # 問題本文
    choice_1 = Column(Text, nullable=False)  # 選択肢1
    choice_2 = Column(Text, nullable=False)  # 選択肢2
    choice_3 = Column(Text, nullable=False)  # 選択肢3
    choice_4 = Column(Text, nullable=True)  # 選択肢4（3択問題の場合はNULL）
    correct_answer = Column(String(20), nullable=False)  # 正解（"1", "2", "1,2"など）
    correctness_pattern = Column(String(10), nullable=False)  # 正誤パターン（"〇☓☓☓"など）
    source_pdf = Column(String(500), nullable=True)  # 元PDFファイルのパス
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # subjectは1-18の数字で管理（Subjectテーブルへの参照は削除）
    answers = relationship("ShortAnswerAnswer", back_populates="problem")
    
    __table_args__ = (
        CheckConstraint("subject BETWEEN 1 AND 18", name="ck_short_answer_problem_subject"),
    )

class ShortAnswerSession(Base):
    __tablename__ = "short_answer_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)  # ユーザーID（認証OFF時はNULL）
    exam_type = Column(String(20), nullable=False)  # 試験種別（フィルター条件）
    year = Column(String(10), nullable=True)  # 年度（フィルター条件、NULL可）
    subject = Column(Integer, nullable=True, index=True)  # 科目ID（1-18、NULL可）（フィルター条件）
    is_random = Column(Boolean, default=False)  # ランダムモードかどうか
    problem_ids = Column(Text, nullable=False)  # JSON配列として問題IDを保存
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # subjectは1-18の数字で管理（Subjectテーブルへの参照は削除）
    user = relationship("User", back_populates="short_answer_sessions")
    answers = relationship("ShortAnswerAnswer", back_populates="session", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('idx_user_started_at', 'user_id', 'started_at'),
        CheckConstraint("subject BETWEEN 1 AND 18", name="ck_short_answer_session_subject"),
    )

class ShortAnswerAnswer(Base):
    __tablename__ = "short_answer_answers"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("short_answer_sessions.id"), nullable=False)
    problem_id = Column(Integer, ForeignKey("short_answer_problems.id"), nullable=False)
    selected_answer = Column(String(20), nullable=True)  # 選択した選択肢（"1", "2", "1,2"など）
    is_correct = Column(Boolean, nullable=True)  # 正誤
    answered_at = Column(DateTime(timezone=True), server_default=func.now())
    
    session = relationship("ShortAnswerSession", back_populates="answers")
    problem = relationship("ShortAnswerProblem", back_populates="answers")

# ユーザー管理関連のモデル
class User(Base):
    __tablename__ = "users"
    
    # 基本情報
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=True)
    
    # Google認証情報
    google_id = Column(String(255), unique=True, nullable=True, index=True)
    google_picture = Column(String(500), nullable=True)
    
    # アカウント状態
    is_active = Column(Boolean, default=True, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    
    # ソフトデリート
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    
    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    
    # リレーションシップ
    subscriptions = relationship("UserSubscription", back_populates="user", order_by="desc(UserSubscription.started_at)")
    submissions = relationship("Submission", back_populates="user")
    short_answer_sessions = relationship("ShortAnswerSession", back_populates="user")
    monthly_usage = relationship("MonthlyUsage", back_populates="user")
    notebooks = relationship("Notebook", back_populates="user")
    reviews = relationship("Review", back_populates="user", order_by="desc(Review.created_at)")  # 作成した講評
    threads = relationship("Thread", back_populates="user", order_by="desc(Thread.last_message_at)")
    preference = relationship("UserPreference", back_populates="user", uselist=False, cascade="all, delete-orphan")
    dashboard = relationship("UserDashboard", back_populates="user", uselist=False, cascade="all, delete-orphan")
    dashboard_history = relationship("UserDashboardHistory", back_populates="user", order_by="desc(UserDashboardHistory.date)")
    review_history = relationship("UserReviewHistory", back_populates="user", order_by="desc(UserReviewHistory.created_at)")
    dashboard_items = relationship("DashboardItem", back_populates="user", order_by="DashboardItem.position")
    study_items = relationship("StudyItem", back_populates="user", order_by="StudyItem.position")
    timer_sessions = relationship("TimerSession", back_populates="user", order_by="desc(TimerSession.started_at_utc)")
    timer_daily_chunks = relationship("TimerDailyChunk", back_populates="user")
    timer_daily_stats = relationship("TimerDailyStats", back_populates="user")

class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    plan_code = Column(String(20), unique=True, nullable=False, index=True)  # "free", "basic", "premium"
    name = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    
    # 制限設定（JSON形式）
    limits = Column(Text, nullable=False)  # JSON形式: {"max_reviews_per_month": 50, ...}
    
    # 価格情報
    price_monthly = Column(Integer, nullable=True)
    price_yearly = Column(Integer, nullable=True)
    
    # 機能フラグ（JSON形式）
    features = Column(Text, nullable=True)  # JSON形式: ["review_generation", ...]
    
    # 表示設定
    is_active = Column(Boolean, default=True, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)
    
    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # リレーションシップ
    user_subscriptions = relationship("UserSubscription", back_populates="plan")

class UserSubscription(Base):
    __tablename__ = "user_subscriptions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_id = Column(Integer, ForeignKey("subscription_plans.id"), nullable=False, index=True)
    
    # サブスクリプション状態
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    started_at = Column(DateTime(timezone=True), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)  # NULL = 無期限
    
    # 支払い情報（将来の拡張用）
    payment_method = Column(String(50), nullable=True)
    payment_id = Column(String(255), nullable=True)
    
    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    
    # リレーションシップ
    user = relationship("User", back_populates="subscriptions")
    plan = relationship("SubscriptionPlan", back_populates="user_subscriptions")
    
    __table_args__ = (
        Index('idx_user_active_subscription', 'user_id', 'is_active'),
    )

class MonthlyUsage(Base):
    __tablename__ = "monthly_usage"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # 集計期間
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)  # 1-12
    
    # 使用量カウント
    review_count = Column(Integer, default=0, nullable=False)
    short_answer_session_count = Column(Integer, default=0, nullable=False)
    chat_message_count = Column(Integer, default=0, nullable=False)
    
    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # リレーションシップ
    user = relationship("User", back_populates="monthly_usage")
    
    __table_args__ = (
        UniqueConstraint('user_id', 'year', 'month', name='uq_user_monthly_usage'),
        Index('idx_user_year_month', 'user_id', 'year', 'month'),
    )

# ノート機能関連のモデル（OneNote風の階層構造）
class Notebook(Base):
    """ノートブック（最上位のコンテナ）"""
    __tablename__ = "notebooks"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # 科目ID（1-18）で管理（サービス全体の強制ルール）
    subject_id = Column(Integer, nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(20), nullable=True)  # カラーコード（例: "#FF5733"）
    
    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # リレーションシップ
    user = relationship("User", back_populates="notebooks")
    sections = relationship("NoteSection", back_populates="notebook", cascade="all, delete-orphan", order_by="NoteSection.display_order")
    
    __table_args__ = (
        CheckConstraint("subject_id BETWEEN 1 AND 18", name="ck_notebooks_subject_id"),
        Index('idx_user_notebooks', 'user_id', 'created_at'),
        Index('idx_user_subject_notebooks', 'user_id', 'subject_id', 'created_at'),
    )

class NoteSection(Base):
    """セクション（ノートブック内のセクション）"""
    __tablename__ = "note_sections"
    
    id = Column(Integer, primary_key=True, index=True)
    notebook_id = Column(Integer, ForeignKey("notebooks.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    display_order = Column(Integer, default=0, nullable=False)
    
    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # リレーションシップ
    notebook = relationship("Notebook", back_populates="sections")
    pages = relationship("NotePage", back_populates="section", cascade="all, delete-orphan", order_by="NotePage.display_order")
    
    __table_args__ = (
        Index('idx_notebook_sections', 'notebook_id', 'display_order'),
    )

class NotePage(Base):
    """ページ（セクション内のページ）"""
    __tablename__ = "note_pages"
    
    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("note_sections.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=True)
    content = Column(Text, nullable=True)  # Markdown形式で保存
    display_order = Column(Integer, default=0, nullable=False)
    
    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # リレーションシップ
    section = relationship("NoteSection", back_populates="pages")
    study_items = relationship("StudyItem", foreign_keys="StudyItem.note_page_id", back_populates="note_page")
    
    __table_args__ = (
        Index('idx_section_pages', 'section_id', 'display_order'),
    )

# ユーザー設定・プリファレンス
class UserPreference(Base):
    """ユーザー設定・プリファレンス"""
    __tablename__ = "user_preferences"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    
    # UI設定
    theme = Column(String(20), default="light", nullable=False)  # "light", "dark", "auto"
    language = Column(String(10), default="ja", nullable=False)  # "ja", "en"
    
    # 通知設定
    email_notifications = Column(Boolean, default=True, nullable=False)
    push_notifications = Column(Boolean, default=False, nullable=False)
    
    # 表示設定
    items_per_page = Column(Integer, default=20, nullable=False)
    default_view = Column(String(20), default="list", nullable=False)  # "list", "grid"
    
    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # リレーションシップ
    user = relationship("User", back_populates="preference", uselist=False)
    
    __table_args__ = (
        Index('idx_user_preferences', 'user_id'),
    )

# ユーザーダッシュボード情報
class UserDashboard(Base):
    """ユーザーの現在のダッシュボード情報（リアルタイム編集用）"""
    __tablename__ = "user_dashboards"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    
    # 今日の目標
    today_goal = Column(Text, nullable=True)
    
    # 集中メモ
    focus_memo = Column(Text, nullable=True)
    
    # 学習項目
    study_items = Column(Text, nullable=True)  # JSON配列として保存可能
    
    # タイマー設定
    timer_enabled = Column(Boolean, default=False, nullable=False)
    timer_elapsed_seconds = Column(Integer, default=0, nullable=False)  # 累計学習時間（秒）
    
    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # リレーションシップ
    user = relationship("User", back_populates="dashboard", uselist=False)
    
    __table_args__ = (
        Index('idx_user_dashboard', 'user_id'),
    )

# ユーザーダッシュボード日次履歴
class UserDashboardHistory(Base):
    """ユーザーのダッシュボード情報の日次履歴（毎朝4時に自動保存）"""
    __tablename__ = "user_dashboard_history"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # 日付（JST基準、YYYY-MM-DD形式）
    date = Column(String(10), nullable=False)  # "2024-01-15"形式
    
    # その日の目標
    today_goal = Column(Text, nullable=True)
    
    # 集中メモ
    focus_memo = Column(Text, nullable=True)
    
    # 学習項目
    study_items = Column(Text, nullable=True)  # JSON配列として保存可能
    
    # タイマー情報
    timer_elapsed_seconds = Column(Integer, default=0, nullable=False)  # その日の累計学習時間（秒）
    
    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # リレーションシップ
    user = relationship("User", back_populates="dashboard_history")
    
    __table_args__ = (
        UniqueConstraint('user_id', 'date', name='uq_user_dashboard_date'),
        Index('idx_user_dashboard_history_date', 'user_id', 'date'),
    )

# ユーザー講評使用履歴
class UserReviewHistory(Base):
    """ユーザーの講評利用履歴（簡易情報を重複保存）"""
    __tablename__ = "user_review_history"
    
    # SQLiteで自動採番を効かせるには INTEGER PRIMARY KEY が必要なので variant を使う
    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    user_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    review_id = Column(BigInteger().with_variant(Integer, "sqlite"), ForeignKey("reviews.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # 簡易情報（マイページ表示用）
    subject = Column(Integer, nullable=True, index=True)  # 科目ID（1-18、検索・フィルタ用）
    exam_type = Column(String(20), nullable=True)  # 試験種別（"司法試験" or "予備試験"）
    year = Column(Integer, nullable=True)  # 年度
    score = Column(Numeric(5, 2), nullable=True)  # 点数（講評結果から抽出）
    attempt_count = Column(Integer, nullable=False, default=1)  # 同一試験に関する講評の回数
    question_title = Column(String(200), nullable=True)  # 問題タイトル（任意）
    reference_text = Column(Text, nullable=True)  # 参照文章（任意、講評上参照してほしい解説等）
    
    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # subjectは1-18の数字で管理（Subjectテーブルへの参照は削除）
    user = relationship("User", back_populates="review_history")
    review = relationship("Review", back_populates="user_history")
    
    __table_args__ = (
        Index('idx_user_review_history_created', 'user_id', 'created_at'),
        Index('idx_user_review_history_review', 'review_id'),
        Index('idx_user_review_history_subject', 'user_id', 'subject', 'created_at'),
        Index('idx_user_review_history_exam', 'user_id', 'subject', 'exam_type', 'year'),
        CheckConstraint("subject IS NULL OR (subject BETWEEN 1 AND 18)", name="ck_review_history_subject"),
    )


# ============================================================================
# ダッシュボード項目管理
# ============================================================================

class DashboardItem(Base):
    """
    ダッシュボード項目テーブル
    
    設計のポイント:
    - Point（Today'sメモ）とTask（Today's Goals & Topics）を1テーブルで管理
    - Left（Topics to Revisit）は表示条件で生成（DB上の種別ではない）
    - entry_type: 1=Point, 2=Task
    - status: 1=未了, 2=作業中, 3=完了, 4=後で
    - positionは間隔方式（10,20,30...）で管理
    - ソフト削除対応（deleted_at）
    """
    __tablename__ = "dashboard_items"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    dashboard_date = Column(String(10), nullable=False)  # 'YYYY-MM-DD'
    
    entry_type = Column(Integer, nullable=False)  # 1=Point, 2=Task
    subject = Column(Integer, nullable=True)  # 1〜18、NULL可
    item = Column(Text, nullable=False)  # 項目本文
    
    due_date = Column(String(10), nullable=True)  # 'YYYY-MM-DD'、PointはNULL強制
    status = Column(Integer, nullable=False)  # 1=未了, 2=作業中, 3=完了, 4=後で
    memo = Column(Text, nullable=True)  # メモ（自由記述）
    position = Column(Integer, nullable=False)  # 並び順（間隔方式：10,20,30...）
    favorite = Column(Integer, nullable=False, default=0)  # お気に入りフラグ（0=OFF, 1=ON）
    
    created_at = Column(String(30), nullable=False, server_default=sql_text("datetime('now')"))
    updated_at = Column(String(30), nullable=False, server_default=sql_text("datetime('now')"))
    deleted_at = Column(String(30), nullable=True)  # ソフト削除日時
    
    # リレーションシップ
    user = relationship("User", back_populates="dashboard_items")
    
    __table_args__ = (
        CheckConstraint("entry_type IN (1, 2)", name="ck_entry_type"),
        CheckConstraint("subject IS NULL OR (subject BETWEEN 1 AND 18)", name="ck_subject"),
        CheckConstraint("status BETWEEN 1 AND 4", name="ck_status"),
        CheckConstraint("entry_type != 1 OR due_date IS NULL", name="ck_point_no_due_date"),
        
        # インデックス
        Index('idx_dashboard_items_user_date_type', 'user_id', 'dashboard_date', 'entry_type'),
        Index('idx_dashboard_items_user_date_status', 'user_id', 'dashboard_date', 'status'),
        Index('idx_dashboard_items_user_date_deleted', 'user_id', 'dashboard_date', 'deleted_at'),
        Index('idx_dashboard_items_position', 'user_id', 'dashboard_date', 'entry_type', 'position'),
    )


# ============================================================================
# タイマー管理
# ============================================================================

class TimerSession(Base):
    """
    タイマーセッション（生ログ）
    
    設計のポイント:
    - タイマーの開始・終了時刻を保持
    - 複数デバイス対応（device_id）
    - status: running / stopped
    - stop_reason: user_stop / auto_replaced_by_new_start / auto_timeout など
    """
    __tablename__ = "timer_sessions"
    
    id = Column(String(36), primary_key=True)  # UUID
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    device_id = Column(String(255), nullable=True)  # デバイス識別子（任意）
    
    started_at_utc = Column(DateTime(timezone=True), nullable=False, index=True)
    ended_at_utc = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), nullable=False)  # running / stopped
    stop_reason = Column(String(50), nullable=True)  # user_stop / auto_replaced_by_new_start / auto_timeout
    
    created_at_utc = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at_utc = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # リレーションシップ
    user = relationship("User", back_populates="timer_sessions")
    daily_chunks = relationship("TimerDailyChunk", back_populates="session", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('idx_timer_sessions_user_status', 'user_id', 'status'),
        Index('idx_timer_sessions_user_started', 'user_id', 'started_at_utc'),
    )


class TimerDailyChunk(Base):
    """
    日次内訳（4:00区切りへ配分）
    
    設計のポイント:
    - セッションが4:00を跨いだら複数行になる
    - study_dateはユーザーTZ基準（4:00開始の「学習日」）
    - secondsはそのstudy_dateに属する秒数
    """
    __tablename__ = "timer_daily_chunks"
    
    id = Column(String(36), primary_key=True)  # UUID
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(String(36), ForeignKey("timer_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    
    study_date = Column(String(10), nullable=False)  # 'YYYY-MM-DD'（ユーザーTZ基準、4:00開始）
    seconds = Column(Integer, nullable=False)  # そのstudy_dateに属する秒数
    
    created_at_utc = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # リレーションシップ
    user = relationship("User", back_populates="timer_daily_chunks")
    session = relationship("TimerSession", back_populates="daily_chunks")
    
    __table_args__ = (
        Index('idx_timer_daily_chunks_user_date', 'user_id', 'study_date'),
        Index('idx_timer_daily_chunks_session', 'session_id'),
    )


class TimerDailyStats(Base):
    """
    日次サマリ（高速表示用キャッシュ）
    
    設計のポイント:
    - 秒で持つ（分は表示用に切り捨て計算）
    - total_secondsが本体、total_minutesは計算で求める
    """
    __tablename__ = "timer_daily_stats"
    
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, primary_key=True)
    study_date = Column(String(10), nullable=False, primary_key=True)  # 'YYYY-MM-DD'
    
    total_seconds = Column(Integer, nullable=False, default=0)  # 確定分の合計秒
    sessions_count = Column(Integer, nullable=False, default=0)  # セッション数
    
    updated_at_utc = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # リレーションシップ
    user = relationship("User", back_populates="timer_daily_stats")
    
    __table_args__ = (
        Index('idx_timer_daily_stats_user_date', 'user_id', 'study_date'),
    )


# ============================================================================
# My規範・My論点管理
# ============================================================================

class StudyItem(Base):
    """
    My規範・My論点テーブル
    
    設計のポイント:
    - 規範（norm）と論点（point）を1テーブルで管理
    - entry_type: 1=規範(norm), 2=論点(point)
    - subject_id: 科目ID（1-18、NULL可）
    - importance: 重要度（1=High, 2=Middle, 3=Low）
    - mastery_level: 理解度（1=未習得, 2=初級, 3=中級, 4=上級, 5=完全習得）
    - position: 並び順（間隔方式：10,20,30...）
    - created_date: 作成日（Date型、mm/dd表示はフロントエンドで変換）
    - tags: タグ（JSON配列形式で保存、マルチセレクト対応）
    - ソフト削除対応（deleted_at）
    """
    __tablename__ = "study_items"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # 種類と科目
    entry_type = Column(Integer, nullable=False)  # 1=規範(norm), 2=論点(point)
    subject_id = Column(Integer, nullable=True, index=True)  # 科目ID（1-18、NULL可）
    
    # 内容
    item = Column(String(500), nullable=False)  # 項目
    importance = Column(Integer, nullable=False, default=1)  # 重要度（1=High, 2=Middle, 3=Low）
    content = Column(Text, nullable=False)  # 内容
    memo = Column(Text, nullable=True)  # メモ
    
    # 関連リソース
    official_question_id = Column(BigInteger, ForeignKey("official_questions.id", ondelete="SET NULL"), nullable=True, index=True)  # 関連する問題
    note_page_id = Column(Integer, ForeignKey("note_pages.id", ondelete="SET NULL"), nullable=True, index=True)  # 関連するノートページ
    
    # 学習管理・進捗
    is_favorite = Column(Boolean, nullable=False, default=False, index=True)  # お気に入りフラグ
    mastery_level = Column(Integer, nullable=True)  # 理解度（1=未習得, 2=初級, 3=中級, 4=上級, 5=完全習得）
    view_count = Column(Integer, nullable=False, default=0)  # 参照回数
    last_viewed_at = Column(DateTime(timezone=True), nullable=True)  # 最終閲覧日時
    
    # 分類・検索
    tags = Column(Text, nullable=True)  # タグ（JSON配列形式: ["重要", "頻出"]など、マルチセレクト対応）
    
    # 日付と並び順
    created_date = Column(DateTime(timezone=True), nullable=False)  # 作成日（Date型）
    position = Column(Integer, nullable=False)  # 並び順（間隔方式：10,20,30...）
    
    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)  # ソフト削除日時
    
    # リレーションシップ
    user = relationship("User", back_populates="study_items", foreign_keys=[user_id])
    official_question = relationship("OfficialQuestion", foreign_keys=[official_question_id])
    note_page = relationship("NotePage", foreign_keys=[note_page_id])
    
    __table_args__ = (
        CheckConstraint("entry_type IN (1, 2)", name="ck_study_item_entry_type"),
        CheckConstraint("subject_id IS NULL OR (subject_id BETWEEN 1 AND 18)", name="ck_study_item_subject"),
        CheckConstraint("importance BETWEEN 1 AND 3", name="ck_study_item_importance"),
        CheckConstraint("mastery_level IS NULL OR (mastery_level BETWEEN 1 AND 5)", name="ck_study_item_mastery"),
        
        # インデックス
        Index('idx_study_items_user_subject_type', 'user_id', 'subject_id', 'entry_type', 'deleted_at'),
        Index('idx_study_items_user_type_deleted', 'user_id', 'entry_type', 'deleted_at'),
        Index('idx_study_items_position', 'user_id', 'subject_id', 'entry_type', 'position'),
        Index('idx_study_items_favorite', 'user_id', 'is_favorite', 'deleted_at'),
        Index('idx_study_items_last_viewed', 'user_id', 'last_viewed_at'),
    )


# ============================================================================
# My規範・My論点: 科目別タグマスタ
# ============================================================================

class StudyTag(Base):
    """
    科目別タグマスタ（ユーザーごと）

    目的:
    - タグの候補（マルチセレクト）を科目ごとに分けて管理する
    - StudyItemのtags（JSON配列）とは独立して、候補リストを永続化
    """
    __tablename__ = "study_tags"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id = Column(Integer, nullable=False, index=True)  # 1-18
    name = Column(String(100), nullable=False)  # 表示名

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        CheckConstraint("subject_id BETWEEN 1 AND 18", name="ck_study_tags_subject"),
        UniqueConstraint("user_id", "subject_id", "name", name="uq_study_tags_user_subject_name"),
        Index("idx_study_tags_user_subject", "user_id", "subject_id"),
    )
