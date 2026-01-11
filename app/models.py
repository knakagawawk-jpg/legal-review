from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Index, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .db import Base

# 新しい問題管理モデル（改善版）
class ProblemMetadata(Base):
    """問題のメタデータテーブル（識別情報のみ）"""
    __tablename__ = "problem_metadata"
    
    id = Column(Integer, primary_key=True, index=True)
    exam_type = Column(String(20), nullable=False)  # "司法試験" or "予備試験"
    year = Column(Integer, nullable=False)  # 年度（例: 2018, 2025）
    subject = Column(String(50), nullable=False)  # 科目
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # リレーションシップ
    details = relationship("ProblemDetails", back_populates="problem_metadata", cascade="all, delete-orphan", order_by="ProblemDetails.question_number")
    submissions = relationship("Submission", back_populates="problem_metadata")
    
    __table_args__ = (
        UniqueConstraint('exam_type', 'year', 'subject', name='uq_problem_metadata'),
        Index('idx_exam_year_subject', 'exam_type', 'year', 'subject'),
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
    subject = Column(String(50), nullable=False)  # 科目
    question_text = Column(Text, nullable=False)  # 問題文
    scoring_notes = Column(Text, nullable=True)  # 採点実感
    purpose = Column(Text, nullable=True)  # 出題趣旨
    other_info = Column(Text, nullable=True)  # その他の情報（JSON形式で保存）
    pdf_path = Column(String(500), nullable=True)  # PDFファイルの保存パス
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # 既存のSubmissionとの互換性のため、relationshipは残す
    old_submissions = relationship("Submission", foreign_keys="Submission.problem_id", back_populates="problem")

class Submission(Base):
    __tablename__ = "submissions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)  # ユーザーID（認証OFF時はNULL）
    
    # 既存の問題ID（後方互換性のため保持）
    problem_id = Column(Integer, ForeignKey("problems.id"), nullable=True)  # 旧Problemテーブルへの参照（移行用）
    
    # 新しい問題ID（改善版）
    problem_metadata_id = Column(Integer, ForeignKey("problem_metadata.id", ondelete="SET NULL"), nullable=True, index=True)  # 問題メタデータID
    problem_details_id = Column(Integer, ForeignKey("problem_details.id", ondelete="SET NULL"), nullable=True, index=True)  # 問題詳細ID（設問）
    
    subject = Column(String(50), nullable=False)
    question_text = Column(Text, nullable=True)  # 問題文（problem_details_idがある場合は詳細から取得、ない場合は手動入力）
    answer_text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="submissions")
    problem = relationship("Problem", foreign_keys=[problem_id], back_populates="old_submissions")  # 既存の参照
    problem_metadata = relationship("ProblemMetadata", back_populates="submissions")  # 新しいメタデータ参照
    problem_details = relationship("ProblemDetails", back_populates="submissions")  # 新しい詳細参照
    review = relationship("Review", back_populates="submission", uselist=False)
    
    __table_args__ = (
        Index('idx_user_created_at', 'user_id', 'created_at'),
        Index('idx_metadata_details', 'problem_metadata_id', 'problem_details_id'),
    )

class Review(Base):
    __tablename__ = "reviews"
    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False, unique=True)

    review_markdown = Column(Text, nullable=False)
    review_json = Column(Text, nullable=False)  # まずはJSON文字列で保存（簡単）
    model = Column(String(100), nullable=True)
    prompt_version = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    submission = relationship("Submission", back_populates="review")

# 短答式問題関連のモデル
class ShortAnswerProblem(Base):
    __tablename__ = "short_answer_problems"
    id = Column(Integer, primary_key=True, index=True)
    exam_type = Column(String(20), nullable=False)  # "司法試験" or "予備試験"
    year = Column(String(10), nullable=False)  # 年度（"R7", "H30"など）
    subject = Column(String(50), nullable=False)  # 科目
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
    
    answers = relationship("ShortAnswerAnswer", back_populates="problem")

class ShortAnswerSession(Base):
    __tablename__ = "short_answer_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)  # ユーザーID（認証OFF時はNULL）
    exam_type = Column(String(20), nullable=False)  # 試験種別（フィルター条件）
    year = Column(String(10), nullable=True)  # 年度（フィルター条件、NULL可）
    subject = Column(String(50), nullable=False)  # 科目（フィルター条件）
    is_random = Column(Boolean, default=False)  # ランダムモードかどうか
    problem_ids = Column(Text, nullable=False)  # JSON配列として問題IDを保存
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    user = relationship("User", back_populates="short_answer_sessions")
    answers = relationship("ShortAnswerAnswer", back_populates="session", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('idx_user_started_at', 'user_id', 'started_at'),
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
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)  # 認証OFF時はNULL
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
        Index('idx_user_notebooks', 'user_id', 'created_at'),
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
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=True)  # Markdown形式で保存
    display_order = Column(Integer, default=0, nullable=False)
    
    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # リレーションシップ
    section = relationship("NoteSection", back_populates="pages")
    
    __table_args__ = (
        Index('idx_section_pages', 'section_id', 'display_order'),
    )
