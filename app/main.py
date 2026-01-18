import json
import logging
from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timedelta
import uuid
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

from .db import SessionLocal, engine, Base
from .models import (
    Submission, Review, Problem,
    ProblemMetadata, ProblemDetails,
    ShortAnswerProblem, ShortAnswerSession, ShortAnswerAnswer,
    User, UserSubscription, SubscriptionPlan,
    Notebook, NoteSection, NotePage,
    Thread, Message,
    UserPreference, UserDashboard, UserDashboardHistory, UserReviewHistory,
    DashboardItem, Subject, OfficialQuestion,
    TimerSession, TimerDailyChunk, TimerDailyStats,
    StudyTag, StudyItem as StudyItemModel
)
from config.constants import FIXED_SUBJECTS
from config.subjects import SUBJECT_MAP, SUBJECT_NAME_TO_ID, get_subject_name, get_subject_id
from .schemas import (
    ReviewRequest, ReviewResponse, ReviewChatRequest, ReviewChatResponse,
    FreeChatRequest, FreeChatResponse,
    ProblemCreate, ProblemUpdate, ProblemResponse, ProblemListResponse, ProblemBulkCreateResponse,
    ProblemYearsResponse, ProblemSubjectsResponse,
    ProblemMetadataResponse, ProblemDetailsResponse, ProblemMetadataWithDetailsResponse,
    ProblemMetadataListResponse, ProblemMetadataCreate, ProblemDetailsCreate,
    ShortAnswerProblemCreate, ShortAnswerProblemResponse, ShortAnswerProblemListResponse,
    ShortAnswerSessionCreate, ShortAnswerSessionResponse,
    ShortAnswerAnswerCreate, ShortAnswerAnswerResponse,
    NotebookCreate, NotebookUpdate, NotebookResponse, NotebookDetailResponse,
    NoteSectionCreate, NoteSectionUpdate, NoteSectionResponse, NoteSectionDetailResponse,
    NotePageCreate, NotePageUpdate, NotePageResponse,
    SubmissionHistoryResponse, ShortAnswerHistoryResponse, UserReviewHistoryResponse,
    ThreadCreate, ThreadResponse, ThreadListResponse,
    MessageCreate, MessageResponse, MessageListResponse, ThreadMessageCreate,
    UserUpdate, UserResponse,
    DashboardItemCreate, DashboardItemUpdate, DashboardItemResponse, DashboardItemListResponse,
    TimerSessionResponse, TimerDailyStatsResponse, TimerStartResponse, TimerStopResponse,
    StudyTagCreate, StudyTagResponse,
    StudyItemCreate, StudyItemUpdate, StudyItemResponse, StudyItemReorderRequest
)
from pydantic import BaseModel
from .llm_service import generate_review, chat_about_review, free_chat
from .auth import get_current_user, get_current_user_required, verify_google_token, get_or_create_user, create_access_token
from config.settings import AUTH_ENABLED
from .timer_api import register_timer_routes

# テーブル作成はエントリーポイントスクリプト（app/init_db.py）で実行されるため、ここでは削除
# Base.metadata.create_all(bind=engine)

app = FastAPI(title="法律答案講評システム API", version="1.0.0")

# CORS設定（Next.jsフロントエンドからのリクエストを許可）
import os
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "").split(",") if os.getenv("CORS_ORIGINS") else []
# デフォルトのオリジン（開発環境用）
default_origins = [
    "http://localhost:3000",  # 通常の開発環境（npm run dev）
    "http://127.0.0.1:3000",
    "http://localhost:8080",   # Docker Compose使用時
    "http://127.0.0.1:8080",
]
# 本番環境のオリジン
production_origins = [
    "https://juristutor-ai.com",
    "https://www.juristutor-ai.com",
]
# 環境変数で指定されたオリジンとデフォルトをマージ
all_origins = list(set(default_origins + production_origins + [origin.strip() for origin in CORS_ORIGINS if origin.strip()]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=all_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# タイマー関連のルートを登録
register_timer_routes(app)

# グローバルエラーハンドラーを追加（HTTPExceptionは除外）
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # HTTPExceptionはFastAPIが処理するので再発生させる
    if isinstance(exc, HTTPException):
        raise exc
    import traceback
    error_detail = traceback.format_exc()
    logger.error(f"未処理のエラーが発生しました: {str(exc)}\n{error_detail}")
    return JSONResponse(
        status_code=500,
        content={"detail": f"予期しないエラーが発生しました: {str(exc)}"}
    )

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/health")
def health():
    from config.settings import GOOGLE_CLIENT_ID
    return {
        "status": "ok",
        "auth_enabled": AUTH_ENABLED,
        "google_client_id_set": bool(GOOGLE_CLIENT_ID),
        "google_client_id_preview": f"{GOOGLE_CLIENT_ID[:20]}..." if GOOGLE_CLIENT_ID else None
    }

@app.get("/debug/llm-config")
def debug_llm_config():
    """LLM設定のデバッグ情報を返す（開発用）"""
    from app.llm_service import ANTHROPIC_API_KEY, ANTHROPIC_MODEL, PROMPTS_DIR
    from pathlib import Path
    
    api_key_set = bool(ANTHROPIC_API_KEY)
    api_key_preview = f"{ANTHROPIC_API_KEY[:10]}..." if ANTHROPIC_API_KEY else "未設定"
    
    prompts_exist = {
        "input_processing": (PROMPTS_DIR / "main" / "input_processing.txt").exists(),
        "evaluation": (PROMPTS_DIR / "main" / "evaluation.txt").exists(),
    }
    
    return {
        "api_key_set": api_key_set,
        "api_key_preview": api_key_preview,
        "model": ANTHROPIC_MODEL,
        "prompts_dir": str(PROMPTS_DIR),
        "prompts_exist": prompts_exist,
    }

# 認証関連のエンドポイント（認証がOFFの場合は動作しない）
class GoogleAuthRequest(BaseModel):
    token: str

@app.post("/v1/auth/google")
async def google_auth(req: GoogleAuthRequest, db: Session = Depends(get_db)):
    """
    Google認証エンドポイント
    
    レスポンス:
    - access_token: JWTトークン（長期有効、デフォルト30日）
    - user_id, email, name, is_active: ユーザー情報
    """
    if not AUTH_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="Authentication is not enabled"
        )
    
    # Googleトークンを検証
    google_info = await verify_google_token(req.token)
    
    # ユーザーを取得または作成
    user = get_or_create_user(google_info, db)
    
    # JWTアクセストークンを発行（長期有効）
    access_token = create_access_token(user_id=user.id, email=user.email)
    
    return {
        "access_token": access_token,  # JWTトークン
        "user_id": user.id,
        "email": user.email,
        "name": user.name,
        "is_active": user.is_active
    }

@app.get("/v1/users/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user_required)
):
    """現在のユーザー情報を取得（認証必須）"""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        is_active=current_user.is_active,
        is_admin=current_user.is_admin
    )

@app.put("/v1/users/me", response_model=UserResponse)
async def update_current_user_info(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """現在のユーザー情報を更新（認証必須）"""
    # 名前の更新
    if user_update.name is not None:
        current_user.name = user_update.name
    
    # メールアドレスの更新（Google認証の場合は変更不可にする場合もある）
    if user_update.email is not None:
        # メールアドレスの重複チェック
        existing_user = db.query(User).filter(
            User.email == user_update.email,
            User.id != current_user.id
        ).first()
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="このメールアドレスは既に使用されています"
            )
        current_user.email = user_update.email
    
    db.commit()
    db.refresh(current_user)
    
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        is_active=current_user.is_active,
        is_admin=current_user.is_admin
    )

def problem_to_response(problem: Problem) -> ProblemResponse:
    """ProblemモデルをProblemResponseに変換"""
    other_info_dict = None
    if problem.other_info:
        try:
            other_info_dict = json.loads(problem.other_info)
        except:
            other_info_dict = None
    
    return ProblemResponse(
        id=problem.id,
        exam_type=problem.exam_type,
        year=problem.year,
        subject=problem.subject,
        subject_name=get_subject_name(problem.subject),
        question_text=problem.question_text,
        scoring_notes=problem.scoring_notes,
        purpose=problem.purpose,
        other_info=other_info_dict,
        pdf_path=problem.pdf_path,
        created_at=problem.created_at,
        updated_at=problem.updated_at,
    )

# Problem関連のエンドポイント
@app.get("/v1/problems", response_model=ProblemListResponse)
def list_problems(
    exam_type: Optional[str] = Query(None, description="試験種別（司法試験/予備試験）"),
    year: Optional[int] = Query(None, description="年度"),
    subject: Optional[int] = Query(None, description="科目ID（1-18）"),
    db: Session = Depends(get_db)
):
    """問題一覧を取得"""
    query = db.query(Problem)
    
    if exam_type:
        query = query.filter(Problem.exam_type == exam_type)
    if year:
        query = query.filter(Problem.year == year)
    if subject:
        query = query.filter(Problem.subject == subject)
    
    problems = query.order_by(Problem.year.desc(), Problem.subject).all()
    
    return ProblemListResponse(
        problems=[problem_to_response(p) for p in problems],
        total=len(problems)
    )

@app.get("/v1/problems/years", response_model=ProblemYearsResponse)
def get_problem_years(db: Session = Depends(get_db)):
    """利用可能な年度の一覧を取得（軽量版・改善版構造を使用）"""
    try:
        # 新しい構造（ProblemMetadata）から取得を試みる
        years_from_metadata = db.query(ProblemMetadata.year).distinct().all()
        years_list = sorted(set(y[0] for y in years_from_metadata), reverse=True)
        
        # 新しい構造にデータがない場合は、既存構造（Problem）から取得（後方互換性）
        if not years_list:
            years_from_old = db.query(Problem.year).distinct().all()
            years_list = sorted(set(y[0] for y in years_from_old), reverse=True)
        
        return ProblemYearsResponse(years=years_list)
    except Exception as e:
        logger.error(f"年度データ取得エラー: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"年度データの取得に失敗しました: {str(e)}")

@app.get("/v1/problems/subjects", response_model=ProblemSubjectsResponse)
def get_problem_subjects(db: Session = Depends(get_db)):
    """利用可能な科目の一覧を取得（科目名のリストを返す）"""
    try:
        # 科目名のリストを返す（FIXED_SUBJECTSと同じ順序）
        subjects_list = list(SUBJECT_MAP.values())
        
        return ProblemSubjectsResponse(subjects=subjects_list)
    except Exception as e:
        logger.error(f"科目データ取得エラー: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"科目データの取得に失敗しました: {str(e)}")

# 新しい問題管理構造のエンドポイント（改善版）
# 注意: より具体的なパスを、パスパラメータを含むパスより前に定義する必要がある
@app.get("/v1/problems/metadata", response_model=ProblemMetadataListResponse)
def list_problem_metadata(
    exam_type: Optional[str] = Query(None, description="試験種別（司法試験/予備試験）"),
    year: Optional[int] = Query(None, description="年度"),
    subject: Optional[int] = Query(None, description="科目ID（1-18）"),
    subject_name: Optional[str] = Query(None, description="科目名（subjectが指定されていない場合に使用）"),
    db: Session = Depends(get_db)
):
    """問題メタデータの一覧を取得（改善版）"""
    try:
        query = db.query(ProblemMetadata)
        
        if exam_type:
            query = query.filter(ProblemMetadata.exam_type == exam_type)
        if year:
            query = query.filter(ProblemMetadata.year == year)
        if subject:
            query = query.filter(ProblemMetadata.subject == subject)
        elif subject_name:
            # 科目名からIDに変換
            subject_id = get_subject_id(subject_name)
            if subject_id:
                query = query.filter(ProblemMetadata.subject == subject_id)
            else:
                raise HTTPException(status_code=400, detail=f"無効な科目名: {subject_name}")
        
        metadata_list = query.order_by(ProblemMetadata.year.desc(), ProblemMetadata.subject).all()
        
        # レスポンスにsubject_nameを追加
        response_list = []
        for m in metadata_list:
            response_dict = {
                "id": m.id,
                "exam_type": m.exam_type,
                "year": m.year,
                "subject": m.subject,
                "subject_name": get_subject_name(m.subject),
                "created_at": m.created_at,
                "updated_at": m.updated_at,
            }
            response_list.append(ProblemMetadataResponse(**response_dict))
        
        return ProblemMetadataListResponse(
            metadata_list=response_list,
            total=len(response_list)
        )
    except Exception as e:
        logger.error(f"メタデータ取得エラー: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"メタデータの取得に失敗しました: {str(e)}")

@app.get("/v1/problems/metadata/{metadata_id}", response_model=ProblemMetadataWithDetailsResponse)
def get_problem_metadata_with_details(metadata_id: int, db: Session = Depends(get_db)):
    """問題メタデータと詳細情報を取得（改善版）"""
    try:
        metadata = db.query(ProblemMetadata).filter(ProblemMetadata.id == metadata_id).first()
        if not metadata:
            raise HTTPException(status_code=404, detail="Problem metadata not found")
        
        # 関連する詳細情報を取得（設問ごとにソート）
        details = db.query(ProblemDetails).filter(
            ProblemDetails.problem_metadata_id == metadata_id
        ).order_by(ProblemDetails.question_number).all()
        
        # レスポンスにsubject_nameを追加
        metadata_dict = {
            "id": metadata.id,
            "exam_type": metadata.exam_type,
            "year": metadata.year,
            "subject": metadata.subject,
            "subject_name": get_subject_name(metadata.subject),
            "created_at": metadata.created_at,
            "updated_at": metadata.updated_at,
        }
        
        return ProblemMetadataWithDetailsResponse(
            metadata=ProblemMetadataResponse(**metadata_dict),
            details=[ProblemDetailsResponse.model_validate(d) for d in details]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"メタデータ詳細取得エラー: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"メタデータ詳細の取得に失敗しました: {str(e)}")

@app.get("/v1/problems/metadata/{metadata_id}/details", response_model=List[ProblemDetailsResponse])
def get_problem_details(metadata_id: int, db: Session = Depends(get_db)):
    """問題詳細情報の一覧を取得（改善版）"""
    try:
        # メタデータの存在確認
        metadata = db.query(ProblemMetadata).filter(ProblemMetadata.id == metadata_id).first()
        if not metadata:
            raise HTTPException(status_code=404, detail="Problem metadata not found")
        
        # 詳細情報を取得（設問ごとにソート）
        details = db.query(ProblemDetails).filter(
            ProblemDetails.problem_metadata_id == metadata_id
        ).order_by(ProblemDetails.question_number).all()
        
        return [ProblemDetailsResponse.model_validate(d) for d in details]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"詳細情報取得エラー: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"詳細情報の取得に失敗しました: {str(e)}")

@app.get("/v1/problems/{problem_id}", response_model=ProblemResponse)
def get_problem(problem_id: int, db: Session = Depends(get_db)):
    """問題詳細を取得（既存構造用・後方互換性のため保持）"""
    problem = db.query(Problem).filter(Problem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    return problem_to_response(problem)

@app.post("/v1/problems", response_model=ProblemResponse)
def create_problem(problem: ProblemCreate, db: Session = Depends(get_db)):
    """問題を作成"""
    if not (1 <= problem.subject <= 18):
        raise HTTPException(status_code=400, detail="Invalid subject (must be 1-18)")
    db_problem = Problem(
        exam_type=problem.exam_type,
        year=problem.year,
        subject=problem.subject,
        question_text=problem.question_text,
        scoring_notes=problem.scoring_notes,
        purpose=problem.purpose,
        other_info=json.dumps(problem.other_info, ensure_ascii=False) if problem.other_info else None,
        pdf_path=problem.pdf_path,
    )
    db.add(db_problem)
    db.commit()
    db.refresh(db_problem)
    return problem_to_response(db_problem)

@app.put("/v1/problems/{problem_id}", response_model=ProblemResponse)
def update_problem(problem_id: int, problem: ProblemUpdate, db: Session = Depends(get_db)):
    """問題を更新"""
    db_problem = db.query(Problem).filter(Problem.id == problem_id).first()
    if not db_problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    
    update_data = problem.model_dump(exclude_unset=True)
    if "subject" in update_data and update_data["subject"] is not None:
        if not (1 <= int(update_data["subject"]) <= 18):
            raise HTTPException(status_code=400, detail="Invalid subject (must be 1-18)")
    if "other_info" in update_data and update_data["other_info"] is not None:
        update_data["other_info"] = json.dumps(update_data["other_info"], ensure_ascii=False)
    
    for key, value in update_data.items():
        setattr(db_problem, key, value)
    
    db.commit()
    db.refresh(db_problem)
    return problem_to_response(db_problem)

@app.post("/v1/problems/bulk", response_model=ProblemBulkCreateResponse)
def create_problems_bulk(problems: List[ProblemCreate], db: Session = Depends(get_db)):
    """問題を一括作成（既存構造用・後方互換性のため保持）"""
    success_count = 0
    error_count = 0
    errors = []
    
    for idx, problem in enumerate(problems):
        try:
            if not (1 <= problem.subject <= 18):
                raise HTTPException(status_code=400, detail="Invalid subject (must be 1-18)")
            db_problem = Problem(
                exam_type=problem.exam_type,
                year=problem.year,
                subject=problem.subject,
                question_text=problem.question_text,
                scoring_notes=problem.scoring_notes,
                purpose=problem.purpose,
                other_info=json.dumps(problem.other_info, ensure_ascii=False) if problem.other_info else None,
            )
            db.add(db_problem)
            db.commit()
            db.refresh(db_problem)
            success_count += 1
        except Exception as e:
            db.rollback()
            error_count += 1
            errors.append({
                "index": idx,
                "error": str(e),
                "data": {
                    "exam_type": problem.exam_type,
                    "year": problem.year,
                    "subject": problem.subject,
                }
            })
    
    return ProblemBulkCreateResponse(
        success_count=success_count,
        error_count=error_count,
        errors=errors
    )


@app.post("/v1/review", response_model=ReviewResponse)
async def create_review(
    req: ReviewRequest,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    try:
        # 1) 問題情報の取得（新しい構造を優先、既存構造は後方互換性のため）
        question_text = req.question_text
        subject_id = req.subject  # 科目ID（1-18）
        purpose_text = None
        problem_metadata_id = None
        problem_details_id = None
        problem_id = None  # 既存構造用（後方互換性）
        
        # 科目名からIDに変換（subject_nameが指定されている場合）
        if subject_id is None and req.subject_name:
            subject_id = get_subject_id(req.subject_name)
            if subject_id is None:
                raise HTTPException(status_code=400, detail=f"無効な科目名: {req.subject_name}")
        
        # 新しい構造を使用する場合（優先）
        if req.problem_metadata_id:
            metadata = db.query(ProblemMetadata).filter(ProblemMetadata.id == req.problem_metadata_id).first()
            if not metadata:
                raise HTTPException(status_code=404, detail="Problem metadata not found")
            
            subject_id = metadata.subject  # メタデータから科目IDを取得
            problem_metadata_id = metadata.id
            
            # 特定の設問が指定されている場合
            if req.problem_details_id:
                detail = db.query(ProblemDetails).filter(
                    ProblemDetails.id == req.problem_details_id,
                    ProblemDetails.problem_metadata_id == metadata.id
                ).first()
                if not detail:
                    raise HTTPException(status_code=404, detail="Problem details not found")
                question_text = detail.question_text
                purpose_text = detail.purpose
                problem_details_id = detail.id
            else:
                # 設問が指定されていない場合は、最初の設問（設問1）を使用
                detail = db.query(ProblemDetails).filter(
                    ProblemDetails.problem_metadata_id == metadata.id
                ).order_by(ProblemDetails.question_number).first()
                if detail:
                    question_text = detail.question_text
                    purpose_text = detail.purpose
                    problem_details_id = detail.id
                # 設問がない場合は、question_textが手動入力されたものとみなす
        
        # 既存構造を使用する場合（後方互換性）
        elif req.problem_id:
            problem = db.query(Problem).filter(Problem.id == req.problem_id).first()
            if not problem:
                raise HTTPException(status_code=404, detail="Problem not found")
            question_text = problem.question_text
            # 既存構造ではsubjectが文字列なので、IDに変換
            if isinstance(problem.subject, str):
                subject_id = get_subject_id(problem.subject)
                if subject_id is None:
                    subject_id = 1  # デフォルト値（憲法）
            else:
                subject_id = problem.subject
            purpose_text = problem.purpose  # 出題趣旨を取得
            problem_id = problem.id
        
        # 科目IDが未設定の場合も許可（NULL可）
        # subject_idがNoneの場合はそのままNULLとして保存
        
        # 2) Submission保存（認証されている場合はuser_idを設定）
        sub = Submission(
            user_id=current_user.id if current_user else None,
            problem_id=problem_id,  # 既存構造用（後方互換性）
            problem_metadata_id=problem_metadata_id,  # 新しい構造用
            problem_details_id=problem_details_id,  # 新しい構造用（設問指定）
            subject=subject_id,  # 科目ID（1-18）
            question_text=question_text,
            answer_text=req.answer_text,
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)

        # 3) LLMで講評を生成（科目名が必要）
        # subject_idがNoneの場合は"不明"を使用
        subject_name = get_subject_name(subject_id) if subject_id is not None else "不明"
        try:
            review_markdown, review_json, model_name = generate_review(
                subject=subject_name,  # LLMには科目名を渡す
                question_text=question_text,
                answer_text=req.answer_text,
                purpose_text=purpose_text,  # 出題趣旨を渡す
            )
        except FileNotFoundError as e:
            import traceback
            error_detail = traceback.format_exc()
            logger.error(f"プロンプトファイル読み込みエラー: {str(e)}\n{error_detail}")
            raise HTTPException(
                status_code=500,
                detail=f"プロンプトファイルが見つかりません: {str(e)}"
            )
        except json.JSONDecodeError as e:
            import traceback
            error_detail = traceback.format_exc()
            logger.error(f"JSONパースエラー: {str(e)}\n{error_detail}")
            raise HTTPException(
                status_code=500,
                detail=f"LLMからのレスポンスの解析に失敗しました: {str(e)}"
            )
        except Exception as e:
            import traceback
            error_detail = traceback.format_exc()
            error_type = type(e).__name__
            logger.error(f"LLM講評生成エラー [{error_type}]: {str(e)}\n{error_detail}")
            # エラーの種類に応じて詳細なメッセージを返す
            if "API key" in str(e).lower() or "authentication" in str(e).lower():
                error_msg = "Anthropic APIキーが設定されていないか、無効です。環境変数ANTHROPIC_API_KEYを確認してください。"
            elif "timeout" in str(e).lower():
                # API側のタイムアウトエラー（Anthropic APIのタイムアウトなど）
                error_msg = f"API側でタイムアウトが発生しました。Anthropic APIの応答が遅い可能性があります。エラー詳細: {str(e)}"
            elif "rate limit" in str(e).lower():
                error_msg = f"LLM APIのレート制限に達しました: {str(e)}"
            else:
                error_msg = f"講評の生成に失敗しました [{error_type}]: {str(e)}"
            raise HTTPException(
                status_code=500,
                detail=error_msg
            )

        # 4) Review保存
        # official_question_idを取得（可能な場合）
        official_question_id = None
        source_type = "custom"
        exam_type = None
        year = None
        
        # ProblemMetadataからOfficialQuestionを検索
        if problem_metadata_id:
            metadata = db.query(ProblemMetadata).filter(ProblemMetadata.id == problem_metadata_id).first()
            if metadata:
                # exam_typeをshiken_typeに変換
                shiken_type_map = {"司法試験": "shihou", "予備試験": "yobi"}
                shiken_type = shiken_type_map.get(metadata.exam_type)
                
                if shiken_type:
                    # metadata.subjectは科目ID（1-18）なので、そのまま使用
                    # OfficialQuestionを検索（subject_idは1-18の数字）
                    official_q = db.query(OfficialQuestion).filter(
                        OfficialQuestion.shiken_type == shiken_type,
                        OfficialQuestion.nendo == metadata.year,
                        OfficialQuestion.subject_id == metadata.subject,  # 科目ID（1-18）
                        OfficialQuestion.status == "active"
                    ).first()
                    
                    if official_q:
                        official_question_id = official_q.id
                        source_type = "official"
                        exam_type = metadata.exam_type
                        year = metadata.year
        
        rev = Review(
            user_id=current_user.id,
            source_type=source_type,
            official_question_id=official_question_id,
            custom_question_text=question_text if source_type == "custom" else None,
            answer_text=req.answer_text,
            kouhyo_kekka=json.dumps(review_json, ensure_ascii=False),
        )
        db.add(rev)
        db.commit()
        db.refresh(rev)
        
        # 5) UserReviewHistoryを作成
        # 講評結果から点数を抽出
        score = None
        if isinstance(review_json, dict):
            # review_jsonから点数を取得（構造に応じて調整が必要）
            if "総合評価" in review_json:
                eval_data = review_json["総合評価"]
                if isinstance(eval_data, dict) and "点数" in eval_data:
                    try:
                        score = float(eval_data["点数"])
                    except (ValueError, TypeError):
                        pass
            elif "score" in review_json:
                try:
                    score = float(review_json["score"])
                except (ValueError, TypeError):
                    pass
        
        # 同一試験の講評回数をカウント
        attempt_count = 1
        if exam_type and year and subject_id:
            # 同一試験（user_id, subject_id, exam_type, year）の講評回数をカウント
            existing_count = db.query(UserReviewHistory).filter(
                UserReviewHistory.user_id == current_user.id,
                UserReviewHistory.subject == subject_id,  # 科目ID（1-18）
                UserReviewHistory.exam_type == exam_type,
                UserReviewHistory.year == year
            ).count()
            attempt_count = existing_count + 1
        
        # UserReviewHistoryレコードを作成
        # 新規問題（custom）の場合のみ、question_titleとreference_textを保存
        question_title = None
        reference_text = None
        if source_type == "custom" and req.question_title is not None:
            question_title = req.question_title
        if source_type == "custom" and req.reference_text is not None:
            reference_text = req.reference_text
        
        history = UserReviewHistory(
            user_id=current_user.id,
            review_id=rev.id,
            subject=subject_id,  # 科目ID（1-18）
            exam_type=exam_type,
            year=year,
            score=score,
            attempt_count=attempt_count,
            question_title=question_title,
            reference_text=reference_text
        )
        db.add(history)
        db.commit()

        # 6) レスポンスを返す
        return ReviewResponse(
            review_id=rev.id,
            submission_id=sub.id,
            review_markdown=review_markdown,
            review_json=review_json,
            answer_text=req.answer_text,
            question_text=question_text,
            subject=subject_id,  # 科目ID（1-18）
            subject_name=subject_name,  # 科目名（表示用）
            purpose=purpose_text,
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        logger.error(f"講評生成エラー: {str(e)}\n{error_detail}")
        raise HTTPException(
            status_code=500,
            detail=f"予期しないエラーが発生しました: {str(e)}"
        )

@app.get("/v1/review/{submission_id}", response_model=ReviewResponse)
async def get_review(
    submission_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """講評を取得（認証必須）"""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # ユーザー所有チェック
    if submission.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    review = db.query(Review).filter(Review.submission_id == submission_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    try:
        review_json = json.loads(review.review_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Review JSON is invalid")
    
    # 問題情報を取得（新しい構造を優先、既存構造は後方互換性のため）
    purpose_text = None
    question_text = submission.question_text
    
    # 新しい構造を使用する場合（優先）
    if submission.problem_details_id:
        detail = db.query(ProblemDetails).filter(ProblemDetails.id == submission.problem_details_id).first()
        if detail:
            question_text = detail.question_text
            purpose_text = detail.purpose
    elif submission.problem_metadata_id:
        # メタデータのみが設定されている場合、最初の設問を取得
        detail = db.query(ProblemDetails).filter(
            ProblemDetails.problem_metadata_id == submission.problem_metadata_id
        ).order_by(ProblemDetails.question_number).first()
        if detail:
            question_text = detail.question_text
            purpose_text = detail.purpose
    
    # 既存構造を使用する場合（後方互換性）
    elif submission.problem_id:
        problem = db.query(Problem).filter(Problem.id == submission.problem_id).first()
        if problem:
            question_text = problem.question_text
            purpose_text = problem.purpose
    
    # 科目IDから科目名を取得
    subject_id = submission.subject  # 科目ID（1-18）
    subject_name = get_subject_name(subject_id)
    
    return ReviewResponse(
        submission_id=submission.id,
        review_markdown=review.review_markdown,
        review_json=review_json,
        answer_text=submission.answer_text,
        question_text=question_text,
        subject=subject_id,  # 科目ID（1-18）
        subject_name=subject_name,  # 科目名（表示用）
        purpose=purpose_text,
    )

@app.get("/v1/reviews/{review_id}", response_model=ReviewResponse)
async def get_review_by_id(
    review_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """review_idで講評を取得（認証必須）"""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    # ユーザー所有チェック
    if review.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        # kouhyo_kekkaからJSONを取得
        if isinstance(review.kouhyo_kekka, str):
            review_json = json.loads(review.kouhyo_kekka)
        else:
            review_json = review.kouhyo_kekka
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=500, detail="Review JSON is invalid")
    
    # 問題情報を取得
    question_text = review.custom_question_text or ""
    purpose_text = None
    subject_id = None
    subject_name = None
    question_title = None
    
    # 既存問題の場合：OfficialQuestionから全情報を取得
    if review.official_question_id:
        official_q = db.query(OfficialQuestion).filter(OfficialQuestion.id == review.official_question_id).first()
        if official_q:
            question_text = official_q.text
            purpose_text = official_q.syutudaisyusi
            if official_q.subject_id:
                subject_id = official_q.subject_id  # 科目ID（1-18）
                subject_name = get_subject_name(subject_id)
    
    # 新規問題の場合：UserReviewHistoryからタイトルと参照文章を取得
    history = db.query(UserReviewHistory).filter(UserReviewHistory.review_id == review_id).first()
    if history:
        if subject_id is None and history.subject:
            subject_id = history.subject  # 科目ID（1-18）
            subject_name = get_subject_name(subject_id)
        # 新規問題（custom）の場合、question_titleとreference_textを取得
        if review.source_type == "custom":
            if history.question_title:
                question_title = history.question_title
            if history.reference_text:
                purpose_text = history.reference_text
    
    # review_markdownを生成（JSONから）
    # llm_serviceの_format_markdown関数を使用
    from .llm_service import _format_markdown
    review_markdown = _format_markdown(subject_name or "不明", review_json)
    
    # submission_idは後方互換性のため、review_idを使用（存在しない場合は0）
    # 実際にはReviewResponseのsubmission_idは必須なので、ダミー値を設定
    return ReviewResponse(
        review_id=review.id,
        submission_id=0,  # review_idベースの場合は使用しない
        review_markdown=review_markdown,
        review_json=review_json,
        answer_text=review.answer_text,
        question_text=question_text,
        subject=subject_id,  # 科目ID（1-18）
        subject_name=subject_name,  # 科目名（表示用）
        purpose=purpose_text,
        question_title=question_title,
    )

@app.post("/v1/review/chat", response_model=ReviewChatResponse)
async def chat_review(
    req: ReviewChatRequest,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """講評に関する質問に答える（認証必須）"""
    # SubmissionとReviewを取得
    submission = db.query(Submission).filter(Submission.id == req.submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # ユーザー所有チェック
    if submission.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    review = db.query(Review).filter(Review.submission_id == req.submission_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    # LLMでチャット回答を生成
    answer = chat_about_review(
        submission_id=req.submission_id,
        question=req.question,
        question_text=submission.question_text or "",
        answer_text=submission.answer_text,
        review_markdown=review.review_markdown,
        chat_history=req.chat_history
    )
    
    return ReviewChatResponse(answer=answer)

# 短答式問題関連のエンドポイント
@app.get("/v1/short-answer/problems", response_model=ShortAnswerProblemListResponse)
def list_short_answer_problems(
    exam_type: Optional[str] = Query(None, description="試験種別（司法試験/予備試験）"),
    year: Optional[str] = Query(None, description="年度（R7, H30など）"),
    subject: Optional[int] = Query(None, description="科目ID（1-18）"),
    subject_name: Optional[str] = Query(None, description="科目名（subjectが指定されていない場合に使用）"),
    db: Session = Depends(get_db)
):
    """短答式問題一覧を取得"""
    query = db.query(ShortAnswerProblem)
    
    if exam_type:
        query = query.filter(ShortAnswerProblem.exam_type == exam_type)
    if year:
        query = query.filter(ShortAnswerProblem.year == year)
    if subject:
        query = query.filter(ShortAnswerProblem.subject == subject)
    elif subject_name:
        # 科目名からIDに変換
        subject_id = get_subject_id(subject_name)
        if subject_id:
            query = query.filter(ShortAnswerProblem.subject == subject_id)
        else:
            raise HTTPException(status_code=400, detail=f"無効な科目名: {subject_name}")
    
    problems = query.order_by(ShortAnswerProblem.year.desc(), ShortAnswerProblem.question_number).all()
    
    return ShortAnswerProblemListResponse(
        problems=[ShortAnswerProblemResponse(
            id=p.id,
            exam_type=p.exam_type,
            year=p.year,
            subject=p.subject,  # 科目ID（1-18）
            subject_name=get_subject_name(p.subject),  # 科目名（表示用）
            question_number=p.question_number,
            question_text=p.question_text,
            choice_1=p.choice_1,
            choice_2=p.choice_2,
            choice_3=p.choice_3,
            choice_4=p.choice_4,
            correct_answer=p.correct_answer,
            correctness_pattern=p.correctness_pattern,
            source_pdf=p.source_pdf,
            created_at=p.created_at,
            updated_at=p.updated_at,
        ) for p in problems],
        total=len(problems)
    )

@app.get("/v1/short-answer/problems/{problem_id}", response_model=ShortAnswerProblemResponse)
def get_short_answer_problem(problem_id: int, db: Session = Depends(get_db)):
    """短答式問題詳細を取得"""
    problem = db.query(ShortAnswerProblem).filter(ShortAnswerProblem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="ShortAnswerProblem not found")
    return ShortAnswerProblemResponse(
        id=problem.id,
        exam_type=problem.exam_type,
        year=problem.year,
        subject=problem.subject,  # 科目ID（1-18）
        subject_name=get_subject_name(problem.subject),  # 科目名（表示用）
        question_number=problem.question_number,
        question_text=problem.question_text,
        choice_1=problem.choice_1,
        choice_2=problem.choice_2,
        choice_3=problem.choice_3,
        choice_4=problem.choice_4,
        correct_answer=problem.correct_answer,
        correctness_pattern=problem.correctness_pattern,
        source_pdf=problem.source_pdf,
        created_at=problem.created_at,
        updated_at=problem.updated_at,
    )

@app.post("/v1/short-answer/sessions", response_model=ShortAnswerSessionResponse)
async def create_short_answer_session(
    session_data: ShortAnswerSessionCreate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """短答式解答セッションを作成（認証必須）"""
    # 科目名からIDに変換（subject_nameが指定されている場合）
    subject_id = session_data.subject
    if subject_id is None and session_data.subject_name:
        subject_id = get_subject_id(session_data.subject_name)
        if subject_id is None:
            raise HTTPException(status_code=400, detail=f"無効な科目名: {session_data.subject_name}")
    
    if subject_id is None:
        raise HTTPException(status_code=400, detail="科目IDまたは科目名を指定してください")
    
    db_session = ShortAnswerSession(
        user_id=current_user.id,
        exam_type=session_data.exam_type,
        year=session_data.year,
        subject=subject_id,  # 科目ID（1-18）
        is_random=session_data.is_random,
        problem_ids=json.dumps(session_data.problem_ids, ensure_ascii=False),
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    
    problem_ids_list = json.loads(db_session.problem_ids)
    return ShortAnswerSessionResponse(
        id=db_session.id,
        exam_type=db_session.exam_type,
        year=db_session.year,
        subject=db_session.subject,  # 科目ID（1-18）
        subject_name=get_subject_name(db_session.subject),  # 科目名（表示用）
        is_random=db_session.is_random,
        problem_ids=problem_ids_list,
        started_at=db_session.started_at,
        completed_at=db_session.completed_at,
    )

@app.get("/v1/short-answer/sessions/{session_id}", response_model=ShortAnswerSessionResponse)
async def get_short_answer_session(
    session_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """短答式解答セッション情報を取得（認証必須）"""
    session = db.query(ShortAnswerSession).filter(ShortAnswerSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="ShortAnswerSession not found")
    
    # ユーザー所有チェック
    if session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    problem_ids_list = json.loads(session.problem_ids)
    return ShortAnswerSessionResponse(
        id=session.id,
        exam_type=session.exam_type,
        year=session.year,
        subject=session.subject,  # 科目ID（1-18）
        subject_name=get_subject_name(session.subject),  # 科目名（表示用）
        is_random=session.is_random,
        problem_ids=problem_ids_list,
        started_at=session.started_at,
        completed_at=session.completed_at,
    )

@app.post("/v1/short-answer/answers", response_model=ShortAnswerAnswerResponse)
async def create_short_answer_answer(
    answer_data: ShortAnswerAnswerCreate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """短答式解答を送信（認証必須）"""
    # セッションの所有権を確認
    session = db.query(ShortAnswerSession).filter(ShortAnswerSession.id == answer_data.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="ShortAnswerSession not found")
    if session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # 問題を取得して正誤を判定
    problem = db.query(ShortAnswerProblem).filter(ShortAnswerProblem.id == answer_data.problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="ShortAnswerProblem not found")
    
    # 正誤判定（選択肢の順序を正規化して比較）
    selected_set = set(answer_data.selected_answer.split(","))
    correct_set = set(problem.correct_answer.split(","))
    is_correct = selected_set == correct_set
    
    # 既存の解答があるか確認
    existing_answer = db.query(ShortAnswerAnswer).filter(
        ShortAnswerAnswer.session_id == answer_data.session_id,
        ShortAnswerAnswer.problem_id == answer_data.problem_id
    ).first()
    
    if existing_answer:
        # 更新
        existing_answer.selected_answer = answer_data.selected_answer
        existing_answer.is_correct = is_correct
        db.commit()
        db.refresh(existing_answer)
        return ShortAnswerAnswerResponse(
            id=existing_answer.id,
            session_id=existing_answer.session_id,
            problem_id=existing_answer.problem_id,
            selected_answer=existing_answer.selected_answer,
            is_correct=existing_answer.is_correct,
            answered_at=existing_answer.answered_at,
        )
    else:
        # 新規作成
        db_answer = ShortAnswerAnswer(
            session_id=answer_data.session_id,
            problem_id=answer_data.problem_id,
            selected_answer=answer_data.selected_answer,
            is_correct=is_correct,
        )
        db.add(db_answer)
        db.commit()
        db.refresh(db_answer)
        return ShortAnswerAnswerResponse(
            id=db_answer.id,
            session_id=db_answer.session_id,
            problem_id=db_answer.problem_id,
            selected_answer=db_answer.selected_answer,
            is_correct=db_answer.is_correct,
            answered_at=db_answer.answered_at,
        )

@app.get("/v1/short-answer/sessions/{session_id}/answers", response_model=List[ShortAnswerAnswerResponse])
async def get_short_answer_session_answers(
    session_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """セッション内の解答一覧を取得（認証必須）"""
    # セッションの所有権を確認
    session = db.query(ShortAnswerSession).filter(ShortAnswerSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="ShortAnswerSession not found")
    if session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    answers = db.query(ShortAnswerAnswer).filter(
        ShortAnswerAnswer.session_id == session_id
    ).all()
    
    return [ShortAnswerAnswerResponse(
        id=a.id,
        session_id=a.session_id,
        problem_id=a.problem_id,
        selected_answer=a.selected_answer,
        is_correct=a.is_correct,
        answered_at=a.answered_at,
    ) for a in answers]

# 過去の記録取得エンドポイント
@app.get("/v1/users/me/submissions", response_model=List[SubmissionHistoryResponse])
async def get_my_submissions(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """自分の答案一覧を取得（認証必須）"""
    query = db.query(Submission).filter(Submission.user_id == current_user.id)
    
    submissions = query.order_by(Submission.created_at.desc()).offset(offset).limit(limit).all()
    
    result = []
    for sub in submissions:
        review_data = None
        review = db.query(Review).filter(Review.submission_id == sub.id).first()
        if review:
            try:
                review_data = json.loads(review.review_json)
            except:
                pass
        
        result.append(SubmissionHistoryResponse(
            id=sub.id,
            subject=sub.subject,
            question_text=sub.question_text,
            answer_text=sub.answer_text,
            created_at=sub.created_at,
            review=review_data
        ))
    
    return result

# 開発用エンドポイント（認証不要で全投稿取得）
@app.get("/v1/dev/submissions", response_model=List[SubmissionHistoryResponse])
def get_all_submissions_dev(
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0)
):
    """開発用：全投稿一覧を取得（認証不要）"""
    submissions = db.query(Submission).order_by(Submission.created_at.desc()).offset(offset).limit(limit).all()
    
    result = []
    for sub in submissions:
        review_data = None
        review = db.query(Review).filter(Review.submission_id == sub.id).first()
        if review:
            try:
                review_data = json.loads(review.review_json)
            except:
                pass
        
        result.append(SubmissionHistoryResponse(
            id=sub.id,
            subject=sub.subject,
            question_text=sub.question_text,
            answer_text=sub.answer_text,
            created_at=sub.created_at,
            review=review_data
        ))
    
    return result

@app.get("/v1/users/me/short-answer-sessions", response_model=List[ShortAnswerHistoryResponse])
async def get_my_short_answer_sessions(
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """自分の短答式セッション一覧を取得（認証オプション）"""
    query = db.query(ShortAnswerSession)
    
    if current_user:
        query = query.filter(ShortAnswerSession.user_id == current_user.id)
    else:
        return []
    
    sessions = query.order_by(ShortAnswerSession.started_at.desc()).offset(offset).limit(limit).all()
    
    result = []
    for session in sessions:
        # 回答を取得して正答数をカウント
        answers = db.query(ShortAnswerAnswer).filter(
            ShortAnswerAnswer.session_id == session.id
        ).all()
        
        total = len(answers)
        correct_count = sum(1 for a in answers if a.is_correct)
        accuracy = (correct_count / total * 100) if total > 0 else 0.0
        
        result.append(ShortAnswerHistoryResponse(
            session_id=session.id,
            exam_type=session.exam_type,
            year=session.year,
            subject=session.subject,  # 科目ID（1-18）
            subject_name=get_subject_name(session.subject),  # 科目名（表示用）
            started_at=session.started_at,
            completed_at=session.completed_at,
            total_problems=total,
            correct_count=correct_count,
            accuracy=round(accuracy, 1)
        ))
    
    return result

@app.get("/v1/users/me/review-history", response_model=List[UserReviewHistoryResponse])
async def get_my_review_history(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
    subject: Optional[int] = Query(None, description="科目ID（1-18）でフィルタ"),
    subject_name: Optional[str] = Query(None, description="科目名でフィルタ（subjectが指定されていない場合に使用）"),
    exam_type: Optional[str] = Query(None, description="試験種別でフィルタ（司法試験 or 予備試験）"),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0)
):
    """自分の講評履歴一覧を取得（認証必須）"""
    query = db.query(UserReviewHistory).filter(
        UserReviewHistory.user_id == current_user.id
    )
    
    if subject:
        query = query.filter(UserReviewHistory.subject == subject)
    elif subject_name:
        # 科目名からIDに変換
        subject_id = get_subject_id(subject_name)
        if subject_id:
            query = query.filter(UserReviewHistory.subject == subject_id)
        else:
            raise HTTPException(status_code=400, detail=f"無効な科目名: {subject_name}")
    if exam_type:
        query = query.filter(UserReviewHistory.exam_type == exam_type)
    
    histories = query.order_by(UserReviewHistory.created_at.desc()).offset(offset).limit(limit).all()
    
    # レスポンスにsubject_nameを追加
    result = []
    for h in histories:
        history_dict = {
            "id": h.id,
            "review_id": h.review_id,
            "subject": h.subject,  # 科目ID（1-18）
            "subject_name": get_subject_name(h.subject) if h.subject else None,  # 科目名（表示用）
            "exam_type": h.exam_type,
            "year": h.year,
            "score": float(h.score) if h.score else None,
            "attempt_count": h.attempt_count,
            "question_title": h.question_title,
            "reference_text": h.reference_text,
            "created_at": h.created_at,
        }
        result.append(UserReviewHistoryResponse(**history_dict))
    
    return result

# ノート機能のエンドポイント
@app.get("/v1/notebooks", response_model=List[NotebookResponse])
async def list_notebooks(
    subject_id: Optional[int] = Query(None, ge=1, le=18),
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """ノートブック一覧を取得（認証必須）"""
    query = db.query(Notebook).filter(Notebook.user_id == current_user.id)

    # 科目で絞り込み（各科目ページのノート用）
    if subject_id is not None:
        query = query.filter(Notebook.subject_id == subject_id)
    
    notebooks = query.order_by(Notebook.created_at.desc()).all()
    return [
        NotebookResponse(
            id=nb.id,
            user_id=nb.user_id,
            subject_id=nb.subject_id,
            title=nb.title,
            description=nb.description,
            color=nb.color,
            created_at=nb.created_at,
            updated_at=nb.updated_at,
        )
        for nb in notebooks
    ]

@app.post("/v1/notebooks", response_model=NotebookResponse)
async def create_notebook(
    notebook_data: NotebookCreate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """ノートブックを作成（認証必須）"""
    if not (1 <= notebook_data.subject_id <= 18):
        raise HTTPException(status_code=400, detail="Invalid subject_id (must be 1-18)")

    notebook = Notebook(
        user_id=current_user.id,
        subject_id=notebook_data.subject_id,
        title=notebook_data.title,
        description=notebook_data.description,
        color=notebook_data.color
    )
    db.add(notebook)
    db.commit()
    db.refresh(notebook)
    
    return NotebookResponse(
        id=notebook.id,
        user_id=notebook.user_id,
        subject_id=notebook.subject_id,
        title=notebook.title,
        description=notebook.description,
        color=notebook.color,
        created_at=notebook.created_at,
        updated_at=notebook.updated_at,
    )

@app.get("/v1/notebooks/{notebook_id}", response_model=NotebookDetailResponse)
async def get_notebook(
    notebook_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """ノートブック詳細を取得（認証必須）"""
    notebook = db.query(Notebook).filter(Notebook.id == notebook_id).first()
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    
    if notebook.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # セクションとページを取得
    sections = db.query(NoteSection).filter(NoteSection.notebook_id == notebook_id).order_by(NoteSection.display_order).all()
    
    section_details = []
    for section in sections:
        pages = db.query(NotePage).filter(NotePage.section_id == section.id).order_by(NotePage.display_order).all()
        section_detail = NoteSectionDetailResponse.model_validate(section)
        section_detail.pages = [NotePageResponse.model_validate(p) for p in pages]
        section_details.append(section_detail)
    
    notebook_detail = NotebookDetailResponse(
        id=notebook.id,
        user_id=notebook.user_id,
        subject_id=notebook.subject_id,
        title=notebook.title,
        description=notebook.description,
        color=notebook.color,
        created_at=notebook.created_at,
        updated_at=notebook.updated_at,
        sections=section_details,
    )
    
    return notebook_detail

@app.put("/v1/notebooks/{notebook_id}", response_model=NotebookResponse)
async def update_notebook(
    notebook_id: int,
    notebook_data: NotebookUpdate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """ノートブックを更新（認証必須）"""
    notebook = db.query(Notebook).filter(Notebook.id == notebook_id).first()
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    
    if notebook.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if notebook_data.subject_id is not None:
        if not (1 <= notebook_data.subject_id <= 18):
            raise HTTPException(status_code=400, detail="Invalid subject_id (must be 1-18)")
        notebook.subject_id = notebook_data.subject_id

    if notebook_data.title is not None:
        notebook.title = notebook_data.title
    if notebook_data.description is not None:
        notebook.description = notebook_data.description
    if notebook_data.color is not None:
        notebook.color = notebook_data.color
    
    db.commit()
    db.refresh(notebook)
    
    return NotebookResponse(
        id=notebook.id,
        user_id=notebook.user_id,
        subject_id=notebook.subject_id,
        title=notebook.title,
        description=notebook.description,
        color=notebook.color,
        created_at=notebook.created_at,
        updated_at=notebook.updated_at,
    )

@app.delete("/v1/notebooks/{notebook_id}")
async def delete_notebook(
    notebook_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """ノートブックを削除（認証必須）"""
    notebook = db.query(Notebook).filter(Notebook.id == notebook_id).first()
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    
    if notebook.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    db.delete(notebook)
    db.commit()
    
    return {"message": "Notebook deleted"}

# セクション関連のエンドポイント
@app.post("/v1/note-sections", response_model=NoteSectionResponse)
async def create_note_section(
    section_data: NoteSectionCreate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """セクションを作成（認証必須）"""
    notebook = db.query(Notebook).filter(Notebook.id == section_data.notebook_id).first()
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    
    if notebook.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    section = NoteSection(
        notebook_id=section_data.notebook_id,
        title=section_data.title,
        display_order=section_data.display_order or 0
    )
    db.add(section)
    db.commit()
    db.refresh(section)
    
    return NoteSectionResponse.model_validate(section)

@app.put("/v1/note-sections/{section_id}", response_model=NoteSectionResponse)
async def update_note_section(
    section_id: int,
    section_data: NoteSectionUpdate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """セクションを更新（認証必須）"""
    section = db.query(NoteSection).filter(NoteSection.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    notebook = db.query(Notebook).filter(Notebook.id == section.notebook_id).first()
    if notebook.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if section_data.title is not None:
        section.title = section_data.title
    if section_data.display_order is not None:
        section.display_order = section_data.display_order
    
    db.commit()
    db.refresh(section)
    
    return NoteSectionResponse.model_validate(section)

@app.delete("/v1/note-sections/{section_id}")
async def delete_note_section(
    section_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """セクションを削除（認証必須）"""
    section = db.query(NoteSection).filter(NoteSection.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    notebook = db.query(Notebook).filter(Notebook.id == section.notebook_id).first()
    if notebook.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    db.delete(section)
    db.commit()
    
    return {"message": "Section deleted"}

# ページ関連のエンドポイント
@app.post("/v1/note-pages", response_model=NotePageResponse)
async def create_note_page(
    page_data: NotePageCreate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """ページを作成（認証必須）"""
    section = db.query(NoteSection).filter(NoteSection.id == page_data.section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    notebook = db.query(Notebook).filter(Notebook.id == section.notebook_id).first()
    if notebook.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    page = NotePage(
        section_id=page_data.section_id,
        title=page_data.title,
        content=page_data.content,
        display_order=page_data.display_order or 0
    )
    db.add(page)
    db.commit()
    db.refresh(page)
    
    return NotePageResponse.model_validate(page)

@app.put("/v1/note-pages/{page_id}", response_model=NotePageResponse)
async def update_note_page(
    page_id: int,
    page_data: NotePageUpdate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """ページを更新（認証必須）"""
    page = db.query(NotePage).filter(NotePage.id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    section = db.query(NoteSection).filter(NoteSection.id == page.section_id).first()
    notebook = db.query(Notebook).filter(Notebook.id == section.notebook_id).first()
    if notebook.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if page_data.title is not None:
        page.title = page_data.title
    if page_data.content is not None:
        page.content = page_data.content
    if page_data.display_order is not None:
        page.display_order = page_data.display_order
    
    db.commit()
    db.refresh(page)
    
    return NotePageResponse.model_validate(page)

@app.delete("/v1/note-pages/{page_id}")
async def delete_note_page(
    page_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """ページを削除（認証必須）"""
    page = db.query(NotePage).filter(NotePage.id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    section = db.query(NoteSection).filter(NoteSection.id == page.section_id).first()
    notebook = db.query(Notebook).filter(Notebook.id == section.notebook_id).first()
    if notebook.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    db.delete(page)
    db.commit()
    
    return {"message": "Page deleted"}

# フリーチャット用エンドポイント（threads/messagesベース）
@app.post("/v1/threads", response_model=ThreadResponse)
async def create_thread(
    thread_data: ThreadCreate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """新しいフリーチャットスレッドを作成（認証必須）"""
    user_id = current_user.id
    
    thread = Thread(
        user_id=user_id,
        type="free_chat",
        title=thread_data.title
    )
    db.add(thread)
    db.commit()
    db.refresh(thread)
    
    return ThreadResponse.model_validate(thread)

@app.get("/v1/threads", response_model=ThreadListResponse)
async def list_threads(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    type: str = Query("free_chat", description="スレッドタイプ")
):
    """スレッド一覧を取得（直近N件）（認証必須）"""
    user_id = current_user.id
    
    query = db.query(Thread).filter(
        Thread.user_id == user_id,
        Thread.type == type,
        Thread.is_archived == False
    )
    
    total = query.count()
    threads = query.order_by(
        Thread.pinned.desc(),
        Thread.last_message_at.desc().nullslast(),
        Thread.created_at.desc()
    ).offset(offset).limit(limit).all()
    
    return ThreadListResponse(
        threads=[ThreadResponse.model_validate(t) for t in threads],
        total=total
    )

@app.get("/v1/threads/{thread_id}", response_model=ThreadResponse)
async def get_thread(
    thread_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """スレッド詳細を取得（認証必須）"""
    thread = db.query(Thread).filter(Thread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    
    if thread.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return ThreadResponse.model_validate(thread)

@app.get("/v1/threads/{thread_id}/messages", response_model=MessageListResponse)
async def list_messages(
    thread_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0)
):
    """スレッドのメッセージ一覧を取得（認証必須）"""
    thread = db.query(Thread).filter(Thread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    
    if thread.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = db.query(Message).filter(Message.thread_id == thread_id)
    total = query.count()
    messages = query.order_by(Message.created_at.asc()).offset(offset).limit(limit).all()
    
    return MessageListResponse(
        messages=[MessageResponse.model_validate(m) for m in messages],
        total=total
    )

@app.post("/v1/threads/{thread_id}/messages", response_model=MessageResponse)
async def create_message(
    thread_id: int,
    message_data: ThreadMessageCreate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """スレッドにメッセージを送信（LLM呼び出し含む）（認証必須）"""
    thread = db.query(Thread).filter(Thread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    
    if thread.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # 1. ユーザーメッセージを保存
    user_message = Message(
        thread_id=thread_id,
        role="user",
        content=message_data.content
    )
    db.add(user_message)
    db.commit()
    
    # 2. 既存のメッセージ履歴を取得（LLM用）
    existing_messages = db.query(Message).filter(
        Message.thread_id == thread_id
    ).order_by(Message.created_at.asc()).all()
    
    # チャット履歴を構築（最後のユーザーメッセージは除く）
    chat_history = []
    for msg in existing_messages[:-1]:  # 最後のユーザーメッセージは除く
        chat_history.append({
            "role": msg.role,
            "content": msg.content
        })
    
    # 3. LLMを呼び出し
    try:
        # 指示文を読み込む（一旦空でもOK）
        from pathlib import Path
        prompt_file = Path(__file__).parent.parent / "prompts" / "main" / "free_chat.txt"
        system_prompt = ""
        if prompt_file.exists():
            system_prompt = prompt_file.read_text(encoding="utf-8").strip()
        
        # free_chat関数を使用してLLM呼び出し
        from .llm_service import free_chat
        assistant_content = free_chat(
            question=message_data.content,
            chat_history=chat_history if chat_history else None
        )
        
        # 4. アシスタントメッセージを保存（コスト情報は一旦NULL）
        assistant_message = Message(
            thread_id=thread_id,
            role="assistant",
            content=assistant_content
        )
        db.add(assistant_message)
        
        # 5. threads.last_message_atを更新
        from datetime import datetime, timezone
        thread.last_message_at = datetime.now(timezone.utc)
        
        db.commit()
        db.refresh(assistant_message)
        
        return MessageResponse.model_validate(assistant_message)
        
    except Exception as e:
        # エラーが発生した場合もユーザーメッセージは保存済み
        db.rollback()
        raise HTTPException(status_code=500, detail=f"LLM呼び出しエラー: {str(e)}")


# ============================================================================
# ダッシュボード項目管理API
# ============================================================================

def get_next_position(db: Session, user_id: int, dashboard_date: str, entry_type: int) -> int:
    """次のpositionを取得（間隔方式：10,20,30...）"""
    last_item = db.query(DashboardItem).filter(
        DashboardItem.user_id == user_id,
        DashboardItem.dashboard_date == dashboard_date,
        DashboardItem.entry_type == entry_type,
        DashboardItem.deleted_at.is_(None)
    ).order_by(DashboardItem.position.desc()).first()
    
    if last_item:
        return last_item.position + 10
    return 10

def recalculate_positions(db: Session, user_id: int, dashboard_date: str, entry_type: int):
    """positionを再採番（10,20,30...）"""
    items = db.query(DashboardItem).filter(
        DashboardItem.user_id == user_id,
        DashboardItem.dashboard_date == dashboard_date,
        DashboardItem.entry_type == entry_type,
        DashboardItem.deleted_at.is_(None)
    ).order_by(DashboardItem.position.asc()).all()
    
    for idx, item in enumerate(items):
        item.position = (idx + 1) * 10
    db.commit()

@app.get("/v1/subjects", response_model=List[dict])
def get_subjects(db: Session = Depends(get_db)):
    """科目一覧を取得（IDと名前）"""
    # SUBJECT_MAPから科目一覧を返す（1-18の順序）
    return [{"id": id, "name": name} for id, name in SUBJECT_MAP.items()]


# ============================================================================
# My規範・My論点: 科目別タグマスタAPI
# ============================================================================

@app.get("/v1/study-tags", response_model=List[StudyTagResponse])
async def list_study_tags(
    subject_id: int = Query(..., ge=1, le=18),
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    """科目別タグ候補一覧を取得（認証必須）"""
    tags = db.query(StudyTag).filter(
        StudyTag.user_id == current_user.id,
        StudyTag.subject_id == subject_id,
    ).order_by(StudyTag.name.asc()).all()
    return [StudyTagResponse.model_validate(t) for t in tags]


@app.post("/v1/study-tags", response_model=StudyTagResponse)
async def create_study_tag(
    payload: StudyTagCreate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    """科目別タグ候補を作成（同名はupsert）（認証必須）"""
    if not (1 <= payload.subject_id <= 18):
        raise HTTPException(status_code=400, detail="Invalid subject_id (must be 1-18)")

    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    existing = db.query(StudyTag).filter(
        StudyTag.user_id == current_user.id,
        StudyTag.subject_id == payload.subject_id,
        StudyTag.name == name,
    ).first()
    if existing:
        return StudyTagResponse.model_validate(existing)

    tag = StudyTag(
        user_id=current_user.id,
        subject_id=payload.subject_id,
        name=name,
    )
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return StudyTagResponse.model_validate(tag)


@app.delete("/v1/study-tags/{tag_id}")
async def delete_study_tag(
    tag_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    """科目別タグ候補を削除（認証必須）"""
    tag = db.query(StudyTag).filter(
        StudyTag.id == tag_id,
        StudyTag.user_id == current_user.id,
    ).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    db.delete(tag)
    db.commit()
    return {"message": "deleted"}


# ============================================================================
# My規範・My論点: StudyItem API
# ============================================================================

def _parse_date_yyyy_mm_dd(date_str: str) -> datetime:
    # "YYYY-MM-DD" を Asia/Tokyo の 00:00 で保持
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return dt.replace(tzinfo=ZoneInfo("Asia/Tokyo"))
    except Exception:
        # ISO文字列も許容
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=ZoneInfo("Asia/Tokyo"))
        return dt


def _next_study_item_position(db: Session, user_id: int, subject_id: int, entry_type: int) -> int:
    last_item = db.query(StudyItemModel).filter(
        StudyItemModel.user_id == user_id,
        StudyItemModel.subject_id == subject_id,
        StudyItemModel.entry_type == entry_type,
        StudyItemModel.deleted_at.is_(None),
    ).order_by(StudyItemModel.position.desc()).first()
    return (last_item.position + 10) if last_item else 10


@app.get("/v1/study-items", response_model=List[StudyItemResponse])
async def list_study_items(
    subject_id: int = Query(..., ge=1, le=18),
    entry_type: int = Query(..., ge=1, le=2),
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    items = db.query(StudyItemModel).filter(
        StudyItemModel.user_id == current_user.id,
        StudyItemModel.subject_id == subject_id,
        StudyItemModel.entry_type == entry_type,
        StudyItemModel.deleted_at.is_(None),
    ).order_by(StudyItemModel.position.asc()).all()

    result: List[StudyItemResponse] = []
    for it in items:
        tags = []
        if it.tags:
            try:
                tags = json.loads(it.tags)
            except Exception:
                tags = []
        # memoはNULL可なのでそのまま
        result.append(StudyItemResponse(
            id=it.id,
            user_id=it.user_id,
            entry_type=it.entry_type,
            subject_id=it.subject_id,
            item=it.item,
            importance=it.importance,
            mastery_level=it.mastery_level,
            content=it.content,
            memo=it.memo,
            tags=tags if isinstance(tags, list) else [],
            created_date=it.created_date,
            position=it.position,
            created_at=it.created_at,
            updated_at=it.updated_at,
            deleted_at=it.deleted_at,
        ))
    return result


@app.post("/v1/study-items", response_model=StudyItemResponse)
async def create_study_item(
    payload: StudyItemCreate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    if payload.entry_type not in (1, 2):
        raise HTTPException(status_code=400, detail="Invalid entry_type (must be 1 or 2)")
    if not (1 <= payload.subject_id <= 18):
        raise HTTPException(status_code=400, detail="Invalid subject_id (must be 1-18)")
    if not (1 <= payload.importance <= 3):
        raise HTTPException(status_code=400, detail="Invalid importance (must be 1-3)")
    if payload.mastery_level is not None and not (1 <= payload.mastery_level <= 5):
        raise HTTPException(status_code=400, detail="Invalid mastery_level (must be 1-5)")

    created_date = datetime.now(ZoneInfo("Asia/Tokyo"))
    if payload.created_date:
        created_date = _parse_date_yyyy_mm_dd(payload.created_date)

    tags_json = json.dumps(payload.tags or [], ensure_ascii=False)
    position = _next_study_item_position(db, current_user.id, payload.subject_id, payload.entry_type)

    it = StudyItemModel(
        user_id=current_user.id,
        entry_type=payload.entry_type,
        subject_id=payload.subject_id,
        item=payload.item or "",
        importance=payload.importance,
        mastery_level=payload.mastery_level,
        content=payload.content or "",
        memo=payload.memo,
        tags=tags_json,
        created_date=created_date,
        position=position,
    )
    db.add(it)
    db.commit()
    db.refresh(it)

    tags = []
    if it.tags:
        try:
            tags = json.loads(it.tags)
        except Exception:
            tags = []

    return StudyItemResponse(
        id=it.id,
        user_id=it.user_id,
        entry_type=it.entry_type,
        subject_id=it.subject_id,
        item=it.item,
        importance=it.importance,
        mastery_level=it.mastery_level,
        content=it.content,
        memo=it.memo,
        tags=tags if isinstance(tags, list) else [],
        created_date=it.created_date,
        position=it.position,
        created_at=it.created_at,
        updated_at=it.updated_at,
        deleted_at=it.deleted_at,
    )


@app.put("/v1/study-items/{item_id}", response_model=StudyItemResponse)
async def update_study_item(
    item_id: int,
    payload: StudyItemUpdate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    it = db.query(StudyItemModel).filter(
        StudyItemModel.id == item_id,
        StudyItemModel.user_id == current_user.id,
        StudyItemModel.deleted_at.is_(None),
    ).first()
    if not it:
        raise HTTPException(status_code=404, detail="Study item not found")

    if payload.importance is not None and not (1 <= payload.importance <= 3):
        raise HTTPException(status_code=400, detail="Invalid importance (must be 1-3)")
    if payload.mastery_level is not None and payload.mastery_level != 0 and not (1 <= payload.mastery_level <= 5):
        raise HTTPException(status_code=400, detail="Invalid mastery_level (must be 1-5)")

    if payload.item is not None:
        it.item = payload.item
    if payload.importance is not None:
        it.importance = payload.importance
    if payload.mastery_level is not None:
        it.mastery_level = payload.mastery_level
    if payload.content is not None:
        it.content = payload.content
    if payload.memo is not None:
        it.memo = payload.memo
    if payload.tags is not None:
        it.tags = json.dumps(payload.tags, ensure_ascii=False)
    if payload.created_date is not None:
        it.created_date = _parse_date_yyyy_mm_dd(payload.created_date)

    db.commit()
    db.refresh(it)

    tags = []
    if it.tags:
        try:
            tags = json.loads(it.tags)
        except Exception:
            tags = []

    return StudyItemResponse(
        id=it.id,
        user_id=it.user_id,
        entry_type=it.entry_type,
        subject_id=it.subject_id,
        item=it.item,
        importance=it.importance,
        mastery_level=it.mastery_level,
        content=it.content,
        memo=it.memo,
        tags=tags if isinstance(tags, list) else [],
        created_date=it.created_date,
        position=it.position,
        created_at=it.created_at,
        updated_at=it.updated_at,
        deleted_at=it.deleted_at,
    )


@app.delete("/v1/study-items/{item_id}")
async def delete_study_item(
    item_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    it = db.query(StudyItemModel).filter(
        StudyItemModel.id == item_id,
        StudyItemModel.user_id == current_user.id,
        StudyItemModel.deleted_at.is_(None),
    ).first()
    if not it:
        raise HTTPException(status_code=404, detail="Study item not found")

    it.deleted_at = datetime.now(ZoneInfo("Asia/Tokyo"))
    db.commit()
    return {"message": "deleted"}


@app.post("/v1/study-items/reorder")
async def reorder_study_items(
    payload: StudyItemReorderRequest,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    if payload.entry_type not in (1, 2):
        raise HTTPException(status_code=400, detail="Invalid entry_type (must be 1 or 2)")
    if not (1 <= payload.subject_id <= 18):
        raise HTTPException(status_code=400, detail="Invalid subject_id (must be 1-18)")

    items = db.query(StudyItemModel).filter(
        StudyItemModel.user_id == current_user.id,
        StudyItemModel.subject_id == payload.subject_id,
        StudyItemModel.entry_type == payload.entry_type,
        StudyItemModel.deleted_at.is_(None),
    ).all()
    by_id = {it.id: it for it in items}

    # 指定されたIDだけを順に採番（その他は末尾）
    pos = 10
    for id_ in payload.ordered_ids:
        it = by_id.get(id_)
        if it:
            it.position = pos
            pos += 10

    # ordered_idsに含まれないものは後ろへ
    remaining = [it for it in items if it.id not in set(payload.ordered_ids)]
    remaining.sort(key=lambda x: x.position)
    for it in remaining:
        it.position = pos
        pos += 10

    db.commit()
    return {"message": "reordered"}

@app.get("/v1/dashboard/items", response_model=DashboardItemListResponse)
async def get_dashboard_items(
    dashboard_date: str = Query(..., description="表示日（YYYY-MM-DD）"),
    entry_type: Optional[int] = Query(None, description="種別（1=Point, 2=Task）"),
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """ダッシュボード項目を取得"""
    if not current_user:
        raise HTTPException(status_code=401, detail="認証が必要です")
    
    query = db.query(DashboardItem).filter(
        DashboardItem.user_id == current_user.id,
        DashboardItem.dashboard_date == dashboard_date,
        DashboardItem.deleted_at.is_(None)
    )
    
    if entry_type:
        query = query.filter(DashboardItem.entry_type == entry_type)
    
    items = query.order_by(DashboardItem.position.asc()).all()
    
    return DashboardItemListResponse(
        items=[DashboardItemResponse.model_validate(item) for item in items],
        total=len(items)
    )

@app.get("/v1/dashboard/items/left", response_model=DashboardItemListResponse)
async def get_dashboard_items_left(
    dashboard_date: str = Query(..., description="表示日（YYYY-MM-DD）"),
    period: str = Query("whole", description="期間（7days or whole）"),
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Left欄（持ち越しTask）を取得"""
    if not current_user:
        raise HTTPException(status_code=401, detail="認証が必要です")
    
    from datetime import datetime, timedelta
    
    query = db.query(DashboardItem).filter(
        DashboardItem.user_id == current_user.id,
        DashboardItem.dashboard_date < dashboard_date,
        DashboardItem.entry_type == 2,  # Taskのみ
        DashboardItem.status != 3,  # 完了以外
        DashboardItem.deleted_at.is_(None)
    )
    
    # 7daysの場合は過去7日間のみ
    if period == "7days":
        date_obj = datetime.strptime(dashboard_date, "%Y-%m-%d")
        seven_days_ago = (date_obj - timedelta(days=7)).strftime("%Y-%m-%d")
        query = query.filter(DashboardItem.dashboard_date >= seven_days_ago)
    
    items = query.order_by(DashboardItem.dashboard_date.asc(), DashboardItem.position.asc()).all()
    
    return DashboardItemListResponse(
        items=[DashboardItemResponse.model_validate(item) for item in items],
        total=len(items)
    )

@app.post("/v1/dashboard/items", response_model=DashboardItemResponse)
async def create_dashboard_item(
    item: DashboardItemCreate,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """ダッシュボード項目を作成"""
    if not current_user:
        raise HTTPException(status_code=401, detail="認証が必要です")
    
    # Pointの場合はdue_dateをNULLに強制
    if item.entry_type == 1:
        item.due_date = None
    
    # positionが指定されていない場合は自動採番
    position = item.position
    if position is None:
        position = get_next_position(db, current_user.id, item.dashboard_date, item.entry_type)
    
    db_item = DashboardItem(
        user_id=current_user.id,
        dashboard_date=item.dashboard_date,
        entry_type=item.entry_type,
        subject=item.subject,
        item=item.item,
        due_date=item.due_date,
        status=item.status,
        memo=item.memo,
        position=position
    )
    
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    
    return DashboardItemResponse.model_validate(db_item)

@app.put("/v1/dashboard/items/{item_id}", response_model=DashboardItemResponse)
async def update_dashboard_item(
    item_id: int,
    item_update: DashboardItemUpdate,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """ダッシュボード項目を更新"""
    if not current_user:
        raise HTTPException(status_code=401, detail="認証が必要です")
    
    db_item = db.query(DashboardItem).filter(
        DashboardItem.id == item_id,
        DashboardItem.user_id == current_user.id,
        DashboardItem.deleted_at.is_(None)
    ).first()
    
    if not db_item:
        raise HTTPException(status_code=404, detail="項目が見つかりません")
    
    # Pointの場合はdue_dateをNULLに強制
    entry_type = item_update.entry_type if item_update.entry_type is not None else db_item.entry_type
    if entry_type == 1:
        item_update.due_date = None
    
    # 更新
    update_data = item_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_item, key, value)
    
    # updated_atはトリガーで自動更新される
    db.commit()
    db.refresh(db_item)
    
    return DashboardItemResponse.model_validate(db_item)

@app.delete("/v1/dashboard/items/{item_id}")
async def delete_dashboard_item(
    item_id: int,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """ダッシュボード項目を削除（ソフト削除）"""
    if not current_user:
        raise HTTPException(status_code=401, detail="認証が必要です")
    
    db_item = db.query(DashboardItem).filter(
        DashboardItem.id == item_id,
        DashboardItem.user_id == current_user.id,
        DashboardItem.deleted_at.is_(None)
    ).first()
    
    if not db_item:
        raise HTTPException(status_code=404, detail="項目が見つかりません")
    
    from datetime import datetime
    db_item.deleted_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    db.commit()
    
    return {"message": "削除しました"}

@app.post("/v1/dashboard/items/{item_id}/reorder")
async def reorder_dashboard_item(
    item_id: int,
    new_position: int = Query(..., description="新しいposition"),
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """ダッシュボード項目の並び順を変更"""
    if not current_user:
        raise HTTPException(status_code=401, detail="認証が必要です")
    
    db_item = db.query(DashboardItem).filter(
        DashboardItem.id == item_id,
        DashboardItem.user_id == current_user.id,
        DashboardItem.deleted_at.is_(None)
    ).first()
    
    if not db_item:
        raise HTTPException(status_code=404, detail="項目が見つかりません")
    
    # 同じ日付・種別の他の項目を取得
    other_items = db.query(DashboardItem).filter(
        DashboardItem.user_id == current_user.id,
        DashboardItem.dashboard_date == db_item.dashboard_date,
        DashboardItem.entry_type == db_item.entry_type,
        DashboardItem.id != item_id,
        DashboardItem.deleted_at.is_(None)
    ).order_by(DashboardItem.position.asc()).all()
    
    # 新しい位置に挿入
    if new_position < db_item.position:
        # 前に移動
        for item in other_items:
            if item.position >= new_position and item.position < db_item.position:
                item.position += 10
    else:
        # 後ろに移動
        for item in other_items:
            if item.position > db_item.position and item.position <= new_position:
                item.position -= 10
    
    db_item.position = new_position
    db.commit()
    
    # positionが詰まった場合は再採番
    all_positions = [db_item.position] + [item.position for item in other_items]
    if max(all_positions) - min(all_positions) > len(all_positions) * 20:
        recalculate_positions(db, current_user.id, db_item.dashboard_date, db_item.entry_type)
    
    return {"message": "並び順を更新しました"}