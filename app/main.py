import json
import logging
from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from fastapi import Request
from sqlalchemy.orm import Session
from typing import Optional, List

logger = logging.getLogger(__name__)

from .db import SessionLocal, engine, Base
from .models import (
    Submission, Review, Problem,
    ProblemMetadata, ProblemDetails,
    ShortAnswerProblem, ShortAnswerSession, ShortAnswerAnswer,
    User, UserSubscription, SubscriptionPlan,
    Notebook, NoteSection, NotePage
)
from config.constants import FIXED_SUBJECTS
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
    SubmissionHistoryResponse, ShortAnswerHistoryResponse
)
from pydantic import BaseModel
from .llm_service import generate_review, chat_about_review, free_chat
from .auth import get_current_user, get_current_user_required, verify_google_token, get_or_create_user
from config.settings import AUTH_ENABLED

# テーブル作成はエントリーポイントスクリプト（app/init_db.py）で実行されるため、ここでは削除
# Base.metadata.create_all(bind=engine)

app = FastAPI(title="法律答案講評システム API", version="1.0.0")

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
    return {"status": "ok", "auth_enabled": AUTH_ENABLED}

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
    """Google認証エンドポイント"""
    if not AUTH_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="Authentication is not enabled"
        )
    
    # Googleトークンを検証
    google_info = await verify_google_token(req.token)
    
    # ユーザーを取得または作成
    user = get_or_create_user(google_info, db)
    
    return {
        "user_id": user.id,
        "email": user.email,
        "name": user.name,
        "is_active": user.is_active
    }

@app.get("/v1/users/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_user_required)
):
    """現在のユーザー情報を取得（認証必須）"""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "is_active": current_user.is_active,
        "is_admin": current_user.is_admin
    }

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
    subject: Optional[str] = Query(None, description="科目"),
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
    """利用可能な科目の一覧を取得（軽量版・改善版構造を使用）"""
    try:
        # 新しい構造（ProblemMetadata）から取得を試みる
        subjects_from_metadata = db.query(ProblemMetadata.subject).distinct().all()
        subjects_list = sorted(set(s[0] for s in subjects_from_metadata))
        
        # 新しい構造にデータがない場合は、既存構造（Problem）から取得（後方互換性）
        if not subjects_list:
            subjects_from_old = db.query(Problem.subject).distinct().all()
            subjects_list = sorted(set(s[0] for s in subjects_from_old))
        
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
    subject: Optional[str] = Query(None, description="科目"),
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
        
        metadata_list = query.order_by(ProblemMetadata.year.desc(), ProblemMetadata.subject).all()
        
        return ProblemMetadataListResponse(
            metadata_list=[ProblemMetadataResponse.model_validate(m) for m in metadata_list],
            total=len(metadata_list)
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
        
        return ProblemMetadataWithDetailsResponse(
            metadata=ProblemMetadataResponse.model_validate(metadata),
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
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # 1) 問題情報の取得（新しい構造を優先、既存構造は後方互換性のため）
        question_text = req.question_text
        subject = req.subject
        purpose_text = None
        problem_metadata_id = None
        problem_details_id = None
        problem_id = None  # 既存構造用（後方互換性）
        
        # 新しい構造を使用する場合（優先）
        if req.problem_metadata_id:
            metadata = db.query(ProblemMetadata).filter(ProblemMetadata.id == req.problem_metadata_id).first()
            if not metadata:
                raise HTTPException(status_code=404, detail="Problem metadata not found")
            
            subject = metadata.subject
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
            subject = problem.subject
            purpose_text = problem.purpose  # 出題趣旨を取得
            problem_id = problem.id
        
        # 2) Submission保存（認証されている場合はuser_idを設定）
        sub = Submission(
            user_id=current_user.id if current_user else None,
            problem_id=problem_id,  # 既存構造用（後方互換性）
            problem_metadata_id=problem_metadata_id,  # 新しい構造用
            problem_details_id=problem_details_id,  # 新しい構造用（設問指定）
            subject=subject,
            question_text=question_text,
            answer_text=req.answer_text,
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)

        # 3) LLMで講評を生成
        try:
            review_markdown, review_json, model_name = generate_review(
                subject=subject,
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
        rev = Review(
            submission_id=sub.id,
            review_markdown=review_markdown,
            review_json=json.dumps(review_json, ensure_ascii=False),
            model=model_name,
            prompt_version="v1",
        )
        db.add(rev)
        db.commit()

        # 5) レスポンスを返す
        return ReviewResponse(
            submission_id=sub.id,
            review_markdown=review_markdown,
            review_json=review_json,
            answer_text=req.answer_text,
            question_text=question_text,
            subject=subject,
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
def get_review(submission_id: int, db: Session = Depends(get_db)):
    """講評を取得"""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
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
    
    return ReviewResponse(
        submission_id=submission.id,
        review_markdown=review.review_markdown,
        review_json=review_json,
        answer_text=submission.answer_text,
        question_text=question_text,
        subject=submission.subject,
        purpose=purpose_text,
    )

@app.post("/v1/review/chat", response_model=ReviewChatResponse)
def chat_review(req: ReviewChatRequest, db: Session = Depends(get_db)):
    """講評に関する質問に答える"""
    # SubmissionとReviewを取得
    submission = db.query(Submission).filter(Submission.id == req.submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
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
    subject: Optional[str] = Query(None, description="科目"),
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
    
    problems = query.order_by(ShortAnswerProblem.year.desc(), ShortAnswerProblem.question_number).all()
    
    return ShortAnswerProblemListResponse(
        problems=[ShortAnswerProblemResponse(
            id=p.id,
            exam_type=p.exam_type,
            year=p.year,
            subject=p.subject,
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
        subject=problem.subject,
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
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """短答式解答セッションを作成"""
    db_session = ShortAnswerSession(
        user_id=current_user.id if current_user else None,
        exam_type=session_data.exam_type,
        year=session_data.year,
        subject=session_data.subject,
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
        subject=db_session.subject,
        is_random=db_session.is_random,
        problem_ids=problem_ids_list,
        started_at=db_session.started_at,
        completed_at=db_session.completed_at,
    )

@app.get("/v1/short-answer/sessions/{session_id}", response_model=ShortAnswerSessionResponse)
def get_short_answer_session(session_id: int, db: Session = Depends(get_db)):
    """短答式解答セッション情報を取得"""
    session = db.query(ShortAnswerSession).filter(ShortAnswerSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="ShortAnswerSession not found")
    
    problem_ids_list = json.loads(session.problem_ids)
    return ShortAnswerSessionResponse(
        id=session.id,
        exam_type=session.exam_type,
        year=session.year,
        subject=session.subject,
        is_random=session.is_random,
        problem_ids=problem_ids_list,
        started_at=session.started_at,
        completed_at=session.completed_at,
    )

@app.post("/v1/short-answer/answers", response_model=ShortAnswerAnswerResponse)
def create_short_answer_answer(answer_data: ShortAnswerAnswerCreate, db: Session = Depends(get_db)):
    """短答式解答を送信"""
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
def get_short_answer_session_answers(session_id: int, db: Session = Depends(get_db)):
    """セッション内の解答一覧を取得"""
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
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """自分の答案一覧を取得（認証オプション）"""
    query = db.query(Submission)
    
    if current_user:
        query = query.filter(Submission.user_id == current_user.id)
    else:
        # 認証されていない場合は空のリストを返す
        return []
    
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
            subject=session.subject,
            started_at=session.started_at,
            completed_at=session.completed_at,
            total_problems=total,
            correct_count=correct_count,
            accuracy=round(accuracy, 1)
        ))
    
    return result

# ノート機能のエンドポイント
@app.get("/v1/notebooks", response_model=List[NotebookResponse])
async def list_notebooks(
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """ノートブック一覧を取得"""
    query = db.query(Notebook)
    
    if current_user:
        query = query.filter(Notebook.user_id == current_user.id)
    else:
        # 認証されていない場合は空のリストを返す
        return []
    
    notebooks = query.order_by(Notebook.created_at.desc()).all()
    return [NotebookResponse.model_validate(nb) for nb in notebooks]

@app.post("/v1/notebooks", response_model=NotebookResponse)
async def create_notebook(
    notebook_data: NotebookCreate,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """ノートブックを作成"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    notebook = Notebook(
        user_id=current_user.id,
        title=notebook_data.title,
        description=notebook_data.description,
        color=notebook_data.color
    )
    db.add(notebook)
    db.commit()
    db.refresh(notebook)
    
    return NotebookResponse.model_validate(notebook)@app.get("/v1/notebooks/{notebook_id}", response_model=NotebookDetailResponse)
async def get_notebook(
    notebook_id: int,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """ノートブック詳細を取得"""
    notebook = db.query(Notebook).filter(Notebook.id == notebook_id).first()
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    
    if current_user and notebook.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # セクションとページを取得
    sections = db.query(NoteSection).filter(NoteSection.notebook_id == notebook_id).order_by(NoteSection.display_order).all()
    
    section_details = []
    for section in sections:
        pages = db.query(NotePage).filter(NotePage.section_id == section.id).order_by(NotePage.display_order).all()
        section_detail = NoteSectionDetailResponse.model_validate(section)
        section_detail.pages = [NotePageResponse.model_validate(p) for p in pages]
        section_details.append(section_detail)
    
    notebook_detail = NotebookDetailResponse.model_validate(notebook)
    notebook_detail.sections = section_details
    
    return notebook_detail

@app.put("/v1/notebooks/{notebook_id}", response_model=NotebookResponse)
async def update_notebook(
    notebook_id: int,
    notebook_data: NotebookUpdate,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """ノートブックを更新"""
    notebook = db.query(Notebook).filter(Notebook.id == notebook_id).first()
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    
    if not current_user or notebook.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if notebook_data.title is not None:
        notebook.title = notebook_data.title
    if notebook_data.description is not None:
        notebook.description = notebook_data.description
    if notebook_data.color is not None:
        notebook.color = notebook_data.color
    
    db.commit()
    db.refresh(notebook)
    
    return NotebookResponse.model_validate(notebook)

@app.delete("/v1/notebooks/{notebook_id}")
async def delete_notebook(
    notebook_id: int,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """ノートブックを削除"""
    notebook = db.query(Notebook).filter(Notebook.id == notebook_id).first()
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    
    if not current_user or notebook.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    db.delete(notebook)
    db.commit()
    
    return {"message": "Notebook deleted"}

# セクション関連のエンドポイント
@app.post("/v1/note-sections", response_model=NoteSectionResponse)
async def create_note_section(
    section_data: NoteSectionCreate,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """セクションを作成"""
    notebook = db.query(Notebook).filter(Notebook.id == section_data.notebook_id).first()
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    
    if not current_user or notebook.user_id != current_user.id:
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
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """セクションを更新"""
    section = db.query(NoteSection).filter(NoteSection.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    notebook = db.query(Notebook).filter(Notebook.id == section.notebook_id).first()
    if not current_user or notebook.user_id != current_user.id:
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
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """セクションを削除"""
    section = db.query(NoteSection).filter(NoteSection.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    notebook = db.query(Notebook).filter(Notebook.id == section.notebook_id).first()
    if not current_user or notebook.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    db.delete(section)
    db.commit()
    
    return {"message": "Section deleted"}

# ページ関連のエンドポイント
@app.post("/v1/note-pages", response_model=NotePageResponse)
async def create_note_page(
    page_data: NotePageCreate,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """ページを作成"""
    section = db.query(NoteSection).filter(NoteSection.id == page_data.section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    notebook = db.query(Notebook).filter(Notebook.id == section.notebook_id).first()
    if not current_user or notebook.user_id != current_user.id:
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
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """ページを更新"""
    page = db.query(NotePage).filter(NotePage.id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    section = db.query(NoteSection).filter(NoteSection.id == page.section_id).first()
    notebook = db.query(Notebook).filter(Notebook.id == section.notebook_id).first()
    if not current_user or notebook.user_id != current_user.id:
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
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """ページを削除"""
    page = db.query(NotePage).filter(NotePage.id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    section = db.query(NoteSection).filter(NoteSection.id == page.section_id).first()
    notebook = db.query(Notebook).filter(Notebook.id == section.notebook_id).first()
    if not current_user or notebook.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    db.delete(page)
    db.commit()
    
    return {"message": "Page deleted"}
