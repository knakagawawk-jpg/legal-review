import json
import logging
from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import or_, cast, String, func
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timedelta, timezone
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
    Thread, Message, LlmRequest,
    UserPreference, UserDashboard, UserDashboardHistory, UserReviewHistory,
    DashboardItem, Subject, OfficialQuestion,
    RecentReviewProblemSession, RecentReviewProblem, SavedReviewProblem,
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
    RecentReviewProblemResponse, RecentReviewProblemSessionResponse, RecentReviewProblemSessionsResponse,
    RecentReviewProblemGenerateRequest, SaveReviewProblemResponse,
    TimerSessionResponse, TimerDailyStatsResponse, TimerStartResponse, TimerStopResponse,
    StudyTagCreate, StudyTagResponse,
    StudyItemCreate, StudyItemUpdate, StudyItemResponse, StudyItemReorderRequest,
    OfficialQuestionYearsResponse, OfficialQuestionActiveResponse,
    LlmRequestListResponse
)
from pydantic import BaseModel
from .llm_service import generate_review, chat_about_review, free_chat, generate_recent_review_problems, generate_chat_title
from .llm_usage import build_llm_request_row
from .auth import get_current_user, get_current_user_required, verify_google_token, get_or_create_user, create_access_token
from config.settings import AUTH_ENABLED
from .timer_api import register_timer_routes
from .timer_utils import get_study_date as get_study_date_4am


def _normalize_subject_id(subject_value) -> Optional[int]:
    """
    DB/入力から来る subject を「科目ID（int, 1-18）」へ正規化する。
    - SQLiteは型が厳密でないため、Integer列に文字列が混入し得る（例: "一般教養科目"）。
    """
    if subject_value is None:
        return None
    if isinstance(subject_value, int):
        return subject_value if 1 <= subject_value <= 18 else None
    if isinstance(subject_value, str):
        # "倒 産 法" のように途中に空白が入っているケースがあるため除去
        s = "".join(subject_value.split())
        # "18" のような数値文字列
        if s.isdigit():
            try:
                v = int(s)
                return v if 1 <= v <= 18 else None
            except Exception:
                return None
        # "一般教養科目" のような科目名
        mapped = get_subject_id(s)
        return mapped if (mapped is not None and 1 <= mapped <= 18) else None
    return None

# テーブル作成（起動時に新しいテーブルのみ追加、既存テーブルはスキップ）
Base.metadata.create_all(bind=engine)

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

# ローカル起動（uvicorn直起動）でもDB互換を保つため、軽量なマイグレーションを起動時に実行する。
# ※ threads/messages のような破壊的マイグレーションはここでは実行しない。
@app.on_event("startup")
def _startup_migrate_reviews():
    try:
        from .migrate_reviews_tables import migrate_reviews_and_history

        migrate_reviews_and_history(migrate_old_data=True)
        logger.info("✓ Startup reviews migration completed")
    except Exception as e:
        # 起動を止めない（ただし講評生成でエラーになる可能性はある）
        logger.warning(f"Startup reviews migration skipped/failed: {str(e)}")

    # official_questions の部分ユニークインデックス（active一意）を作成
    try:
        from .migrate_official_questions_indexes import migrate_official_questions_indexes

        migrate_official_questions_indexes()
        logger.info("✓ Startup official_questions index migration completed")
    except Exception as e:
        logger.warning(f"Startup official_questions index migration skipped/failed: {str(e)}")

    # official_questions.id の自動採番（SQLite: INTEGER PRIMARY KEY）を保証
    try:
        from .migrate_official_questions_table import migrate_official_questions_table

        migrate_official_questions_table()
        logger.info("✓ Startup official_questions table migration completed")
    except Exception as e:
        logger.warning(f"Startup official_questions table migration skipped/failed: {str(e)}")

    # official_questions が空なら seed（問題番号を廃止し official_question_id ベースへ移行するため）
    try:
        from .seed_official_questions import seed_official_questions_if_empty

        seed_official_questions_if_empty()
        logger.info("✓ Startup official_questions seed completed")
    except Exception as e:
        logger.warning(f"Startup official_questions seed skipped/failed: {str(e)}")

    # dashboard_items に favorite カラムを追加
    try:
        from .migrate_dashboard_items_favorite import migrate_dashboard_items_favorite

        migrate_dashboard_items_favorite()
        logger.info("✓ Startup dashboard_items favorite migration completed")
    except Exception as e:
        logger.warning(f"Startup dashboard_items favorite migration skipped/failed: {str(e)}")

    # threads に favorite カラムを追加、is_archived を削除
    try:
        from .migrate_threads_favorite import migrate_threads_favorite

        migrate_threads_favorite()
        logger.info("✓ Startup threads favorite migration completed")
    except Exception as e:
        logger.warning(f"Startup threads favorite migration skipped/failed: {str(e)}")

    # 最近の復習問題（ダッシュボード）用テーブルを作成
    try:
        from .migrate_recent_review_problems import migrate_recent_review_problems

        migrate_recent_review_problems()
        logger.info("✓ Startup recent review problems migration completed")
    except Exception as e:
        logger.warning(f"Startup recent review problems migration skipped/failed: {str(e)}")

    # LLM共通ログ用テーブルを作成
    try:
        from .migrate_llm_requests import migrate_llm_requests

        migrate_llm_requests()
        logger.info("✓ Startup llm_requests migration completed")
    except Exception as e:
        logger.warning(f"Startup llm_requests migration skipped/failed: {str(e)}")

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


def _truncate_text(text: str, limit: int = 12000) -> str:
    if not text:
        return ""
    if len(text) <= limit:
        return text
    head = text[: int(limit * 0.7)]
    tail = text[-int(limit * 0.25) :]
    return head + "\n...\n（中略）\n...\n" + tail


def _load_prompt_text(prompt_name: str) -> str:
    """prompts/main/{prompt_name}.txt を読み込む（無ければ空文字）"""
    try:
        from pathlib import Path

        p = Path(__file__).parent.parent / "prompts" / "main" / f"{prompt_name}.txt"
        if p.exists():
            return p.read_text(encoding="utf-8").strip()
    except Exception:
        pass
    return ""


def _build_review_chat_context_text(
    *,
    question_text: str,
    purpose_text: str,
    grading_impression_text: str,
    review_json_obj: dict,
) -> str:
    template = _load_prompt_text("review_chat_context")
    if not template:
        template = (
            "【問題文】\n{QUESTION_TEXT}\n\n"
            "【出題趣旨／参考文章】\n{PURPOSE_TEXT}\n\n"
            "【採点実感】\n{GRADING_IMPRESSION_TEXT}\n\n"
            "【講評JSON】\n{REVIEW_JSON}\n"
        )
    review_json_str = ""
    try:
        review_json_str = json.dumps(review_json_obj or {}, ensure_ascii=False, indent=2)
    except Exception:
        review_json_str = "{}"

    return template.replace("{QUESTION_TEXT}", _truncate_text(question_text or "（問題文なし）")).replace(
        "{PURPOSE_TEXT}", _truncate_text(purpose_text or "（出題趣旨／参考文章なし）")
    ).replace("{GRADING_IMPRESSION_TEXT}", _truncate_text(grading_impression_text or "（採点実感なし）")).replace(
        "{REVIEW_JSON}", _truncate_text(review_json_str or "{}", limit=14000)
    )


def _build_review_chat_user_prompt_text(question: str) -> str:
    template = _load_prompt_text("review_chat_user")
    if not template:
        template = "ユーザーの質問:\n{QUESTION}"
    return template.replace("{QUESTION}", (question or "").strip())


def _get_review_chat_context_by_review_id(
    *,
    review_id: int,
    current_user: User,
    db: Session,
) -> tuple[str, str, str, dict]:
    """
    review_id から講評チャット用のコンテキスト（問題文/趣旨/採点実感/講評JSON）を復元する。
    ここで作るコンテキストはDB（messages）には保存しない前提。
    """
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # review_json
    try:
        review_json_obj = json.loads(review.kouhyo_kekka) if isinstance(review.kouhyo_kekka, str) else (review.kouhyo_kekka or {})
    except Exception:
        review_json_obj = {}

    question_text = review.custom_question_text or ""
    purpose_text = ""
    grading_impression_text = ""

    if review.official_question_id:
        official_q = db.query(OfficialQuestion).filter(OfficialQuestion.id == review.official_question_id).first()
        if official_q:
            question_text = official_q.text or ""
            purpose_text = official_q.syutudaisyusi or ""
            if official_q.shiken_type == "shihou" and official_q.grading_impression:
                grading_impression_text = official_q.grading_impression.grading_impression_text or ""
    else:
        # custom: UserReviewHistory.reference_text を「参考文章」として使う
        history = db.query(UserReviewHistory).filter(UserReviewHistory.review_id == review_id).first()
        if history and history.reference_text:
            purpose_text = history.reference_text

    return question_text, purpose_text, grading_impression_text, review_json_obj

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


@app.get("/v1/official-questions/years", response_model=OfficialQuestionYearsResponse)
def list_official_question_years(
    shiken_type: Optional[str] = Query(None, description="shihou/yobi（省略可）"),
    db: Session = Depends(get_db),
):
    q = db.query(OfficialQuestion.nendo).distinct()
    if shiken_type:
        q = q.filter(OfficialQuestion.shiken_type == shiken_type)
    # UIは基本activeを選ぶので active の年度のみ返す
    q = q.filter(OfficialQuestion.status == "active").order_by(OfficialQuestion.nendo.desc())
    years = [r[0] for r in q.all()]

    # フォールバック: official_questions がまだ未投入の場合でも年度が出るようにする
    if not years:
        q2 = db.query(ProblemMetadata.year).distinct()
        if shiken_type:
            exam_type = "司法試験" if shiken_type == "shihou" else "予備試験"
            q2 = q2.filter(ProblemMetadata.exam_type == exam_type)
        q2 = q2.order_by(ProblemMetadata.year.desc())
        years = [r[0] for r in q2.all()]
    return OfficialQuestionYearsResponse(years=years)


@app.get("/v1/official-questions/active", response_model=OfficialQuestionActiveResponse)
def get_active_official_question(
    shiken_type: str = Query(..., description="shihou/yobi"),
    nendo: int = Query(..., ge=2000),
    subject_id: int = Query(..., ge=1, le=18),
    db: Session = Depends(get_db),
):
    oq = db.query(OfficialQuestion).filter(
        OfficialQuestion.shiken_type == shiken_type,
        OfficialQuestion.nendo == nendo,
        OfficialQuestion.subject_id == subject_id,
        OfficialQuestion.status == "active",
    ).first()
    if not oq:
        # フォールバック: official_questions が未投入/不足の場合は problem_metadata/problem_details から1件生成
        exam_type = "司法試験" if shiken_type == "shihou" else "予備試験"
        meta = db.query(ProblemMetadata).filter(
            ProblemMetadata.exam_type == exam_type,
            ProblemMetadata.year == nendo,
            ProblemMetadata.subject == subject_id,
        ).first()
        if meta:
            detail = db.query(ProblemDetails).filter(
                ProblemDetails.problem_metadata_id == meta.id
            ).order_by(ProblemDetails.question_number).first()
            if detail:
                try:
                    oq = OfficialQuestion(
                        shiken_type=shiken_type,
                        nendo=nendo,
                        subject_id=subject_id,
                        version=1,
                        status="active",
                        text=detail.question_text,
                        syutudaisyusi=detail.purpose,
                    )
                    db.add(oq)
                    db.flush()  # oq.id を確定

                    # 司法試験のみ採点実感を保存
                    if shiken_type == "shihou" and detail.scoring_notes:
                        db.add(
                            ShihouGradingImpression(
                                question_id=oq.id,
                                grading_impression_text=detail.scoring_notes,
                            )
                        )
                    db.commit()
                    db.refresh(oq)
                except Exception:
                    db.rollback()

        if not oq:
            raise HTTPException(status_code=404, detail="Active official question not found")

    grading_text = None
    if oq.shiken_type == "shihou" and oq.grading_impression:
        grading_text = oq.grading_impression.grading_impression_text

    return OfficialQuestionActiveResponse(
        id=oq.id,
        shiken_type=oq.shiken_type,
        nendo=oq.nendo,
        subject_id=oq.subject_id,
        version=oq.version,
        status=oq.status,
        text=oq.text,
        syutudaisyusi=oq.syutudaisyusi,
        grading_impression_text=grading_text,
    )

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
            # subjectは「科目ID（int）」で受けるが、DBが旧データだと科目名（文字列）混入があり得る。
            # その場合も検索できるように、subject列を文字列化＆空白除去した値とも比較する。
            subject_name = get_subject_name(subject)
            subject_str = str(subject)
            subject_col_str = cast(ProblemMetadata.subject, String)
            subject_col_norm = func.replace(func.replace(subject_col_str, " ", ""), "　", "")
            subject_name_norm = "".join(str(subject_name).split())

            query = query.filter(
                or_(
                    ProblemMetadata.subject == subject,  # 正常系（INTEGER）
                    subject_col_str == subject_str,  # "1" 等の数値文字列
                    subject_col_norm == subject_str,  # " 1 " 等
                    subject_col_norm == subject_name_norm,  # "憲 法" 等の空白混入
                )
            )
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
            normalized_subject = _normalize_subject_id(m.subject)
            # subjectがNULL/不正値の行は、既存問題選択UIでは扱えないため一覧から除外する
            if normalized_subject is None:
                logger.warning(
                    f"Skipping problem_metadata id={getattr(m, 'id', None)} due to invalid subject: {m.subject!r}"
                )
                continue
            response_dict = {
                "id": m.id,
                "exam_type": m.exam_type,
                "year": m.year,
                "subject": normalized_subject,
                "subject_name": get_subject_name(normalized_subject),
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
        normalized_subject = _normalize_subject_id(metadata.subject)
        if normalized_subject is None:
            raise HTTPException(
                status_code=500,
                detail=f"Invalid subject stored for problem_metadata id={metadata.id}: {metadata.subject!r}"
            )
        metadata_dict = {
            "id": metadata.id,
            "exam_type": metadata.exam_type,
            "year": metadata.year,
            "subject": normalized_subject,
            "subject_name": get_subject_name(normalized_subject),
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
        grading_impression_text = None
        problem_metadata_id = None
        problem_details_id = None
        problem_id = None  # 既存構造用（後方互換性）
        official_question_id_req = None
        
        # 科目名からIDに変換（subject_nameが指定されている場合）
        if subject_id is None and req.subject_name:
            subject_id = get_subject_id(req.subject_name)
            if subject_id is None:
                raise HTTPException(status_code=400, detail=f"無効な科目名: {req.subject_name}")
        
        # 公式問題を official_question_id で指定する場合（最優先）
        if req.official_question_id:
            official_q = db.query(OfficialQuestion).filter(OfficialQuestion.id == req.official_question_id).first()
            if not official_q:
                raise HTTPException(status_code=404, detail="Official question not found")

            official_question_id_req = official_q.id
            question_text = official_q.text
            purpose_text = official_q.syutudaisyusi
            subject_id = official_q.subject_id

            # 司法試験の場合のみ採点実感を参照（存在する場合）
            if official_q.shiken_type == "shihou" and official_q.grading_impression:
                grading_impression_text = official_q.grading_impression.grading_impression_text

            problem_metadata_id = None
            problem_details_id = None
            problem_id = None

        # 新しい構造（ProblemMetadata/ProblemDetails）を使用する場合（後方互換）
        elif req.problem_metadata_id:
            metadata = db.query(ProblemMetadata).filter(ProblemMetadata.id == req.problem_metadata_id).first()
            if not metadata:
                raise HTTPException(status_code=404, detail="Problem metadata not found")
            
            subject_id = _normalize_subject_id(metadata.subject)  # メタデータから科目IDを取得（旧データ対策）
            if subject_id is None:
                raise HTTPException(
                    status_code=500,
                    detail=f"Invalid subject stored for problem_metadata id={metadata.id}: {metadata.subject!r}"
                )
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
            review_markdown, review_json, model_name, in_tok, out_tok, request_id, latency_ms = generate_review(
                subject=subject_name,  # LLMには科目名を渡す
                question_text=question_text,
                answer_text=req.answer_text,
                purpose_text=purpose_text,  # 出題趣旨を渡す
                grading_impression_text=grading_impression_text,  # 司法試験のみ
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
        # - official_question_id 指定の場合: official
        # - それ以外: custom
        official_question_id = None
        source_type = "custom"
        exam_type = None
        year = None

        if official_question_id_req:
            source_type = "official"
            official_question_id = official_question_id_req
            # UserReviewHistory用に試験種別・年度を設定
            official_q = db.query(OfficialQuestion).filter(OfficialQuestion.id == official_question_id_req).first()
            if official_q:
                exam_type = "司法試験" if official_q.shiken_type == "shihou" else "予備試験"
                year = official_q.nendo
        
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

        # LLM使用量を保存（共通ログ）
        if in_tok is not None or out_tok is not None or request_id:
            llm_row = LlmRequest(
                **build_llm_request_row(
                    user_id=current_user.id,
                    feature_type="review",
                    review_id=rev.id,
                    model=model_name,
                    prompt_version="evaluation_v1",
                    input_tokens=in_tok,
                    output_tokens=out_tok,
                    request_id=request_id,
                    latency_ms=latency_ms,
                )
            )
            db.add(llm_row)
            db.commit()
        
        # 5) UserReviewHistoryを作成
        # 講評結果から点数を抽出
        score = None
        if isinstance(review_json, dict):
            # review_jsonから点数を取得（構造に応じて調整が必要）
            # 新しい形式: evaluation.overall_review.score
            if "evaluation" in review_json:
                eval_data = review_json["evaluation"]
                if isinstance(eval_data, dict) and "overall_review" in eval_data:
                    overall_review = eval_data["overall_review"]
                    if isinstance(overall_review, dict) and "score" in overall_review:
                        try:
                            score = float(overall_review["score"])
                        except (ValueError, TypeError):
                            pass
            # 旧形式1: 総合評価.点数
            elif "総合評価" in review_json:
                eval_data = review_json["総合評価"]
                if isinstance(eval_data, dict) and "点数" in eval_data:
                    try:
                        score = float(eval_data["点数"])
                    except (ValueError, TypeError):
                        pass
            # 旧形式2: 直接score
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
            source_type=source_type,
            reference_text=reference_text if source_type == "custom" else None,
            grading_impression_text=grading_impression_text,
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

@app.get("/v1/review/{review_id}", response_model=ReviewResponse)
async def get_review_legacy(
    review_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    """
    旧: /v1/review/{submission_id}

    現在は review_id ベースのため、/v1/reviews/{review_id} のエイリアスとして扱う。
    """
    return await get_review_by_id(review_id=review_id, current_user=current_user, db=db)

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
    grading_impression_text = None
    subject_id = None
    subject_name = None
    question_title = None
    reference_text = None
    
    # 既存問題の場合：OfficialQuestionから全情報を取得
    if review.official_question_id:
        official_q = db.query(OfficialQuestion).filter(OfficialQuestion.id == review.official_question_id).first()
        if official_q:
            question_text = official_q.text
            purpose_text = official_q.syutudaisyusi
            if official_q.subject_id:
                subject_id = official_q.subject_id  # 科目ID（1-18）
                subject_name = get_subject_name(subject_id)
            # 司法試験のみ採点実感を返す（存在する場合）
            if official_q.shiken_type == "shihou" and official_q.grading_impression:
                grading_impression_text = official_q.grading_impression.grading_impression_text
    
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
                reference_text = history.reference_text
    
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
        source_type=review.source_type,
        reference_text=reference_text if review.source_type == "custom" else None,
        grading_impression_text=grading_impression_text,
    )


@app.post("/v1/reviews/{review_id}/thread", response_model=ThreadResponse)
async def get_or_create_review_chat_thread(
    review_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    """講評チャット用のスレッドを取得/作成（認証必須）"""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # 既存のthreadがあればそれを返す
    if review.thread_id:
        thread = db.query(Thread).filter(Thread.id == review.thread_id).first()
        if thread and thread.user_id == current_user.id and thread.type == "review_chat":
            resp = ThreadResponse.model_validate(thread)
            resp.review_id = review.id
            return resp

    # 新規作成
    title = None
    try:
        history = db.query(UserReviewHistory).filter(UserReviewHistory.review_id == review_id).first()
        if history and history.question_title:
            title = f"講評チャット: {history.question_title}"
    except Exception:
        title = None

    thread = Thread(
        user_id=current_user.id,
        type="review_chat",
        title=title,
        favorite=0,
        pinned=False,
    )
    db.add(thread)
    db.flush()  # thread.id を確定

    review.thread_id = thread.id
    review.has_chat = True
    db.commit()
    db.refresh(thread)

    resp = ThreadResponse.model_validate(thread)
    resp.review_id = review.id
    return resp

@app.post("/v1/review/chat", response_model=ReviewChatResponse)
async def chat_review(
    req: ReviewChatRequest,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """講評に関する質問に答える（認証必須）"""
    # review_id優先（現行）
    if req.review_id is not None:
        review = db.query(Review).filter(Review.id == req.review_id).first()
        if not review:
            raise HTTPException(status_code=404, detail="Review not found")
        if review.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

        # 科目/問題文/出題趣旨（reference含む）を復元
        question_text = review.custom_question_text or ""
        purpose_text = None
        subject_id = None

        if review.official_question_id:
            official_q = db.query(OfficialQuestion).filter(OfficialQuestion.id == review.official_question_id).first()
            if official_q:
                question_text = official_q.text or ""
                purpose_text = official_q.syutudaisyusi
                subject_id = official_q.subject_id

        history = db.query(UserReviewHistory).filter(UserReviewHistory.review_id == req.review_id).first()
        if history:
            if subject_id is None and history.subject:
                subject_id = history.subject
            if review.source_type == "custom" and history.reference_text:
                purpose_text = history.reference_text

        # kouhyo_kekka → markdown復元
        try:
            review_json = json.loads(review.kouhyo_kekka) if isinstance(review.kouhyo_kekka, str) else (review.kouhyo_kekka or {})
        except Exception:
            review_json = {}
        from .llm_service import _format_markdown  # 既存の整形関数を利用
        subject_name = get_subject_name(subject_id) if subject_id is not None else "不明"
        review_markdown = _format_markdown(subject_name, review_json)

        answer, model_name, in_tok, out_tok, request_id, latency_ms = chat_about_review(
            submission_id=req.review_id,  # 互換のため引数名はそのまま
            question=req.question,
            question_text=question_text,
            answer_text=review.answer_text,
            review_markdown=review_markdown,
            chat_history=req.chat_history
        )
        if in_tok is not None or out_tok is not None or request_id:
            llm_row = LlmRequest(
                **build_llm_request_row(
                    user_id=current_user.id,
                    feature_type="review_chat",
                    review_id=review.id,
                    model=model_name,
                    prompt_version="review_chat_v1",
                    input_tokens=in_tok,
                    output_tokens=out_tok,
                    request_id=request_id,
                    latency_ms=latency_ms,
                )
            )
            db.add(llm_row)
            db.commit()
        return ReviewChatResponse(answer=answer)

    # 旧: submission_id（互換。必要なら後で対応拡張）
    raise HTTPException(status_code=400, detail="review_id is required")

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
        # Reviewはreview_id中心で、Submissionとは紐付けない設計のためここでは返さない
        review_data = None
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
        # Reviewはreview_id中心で、Submissionとは紐付けない設計のためここでは返さない
        review_data = None
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


@app.get("/v1/llm-requests", response_model=LlmRequestListResponse)
async def list_llm_requests(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    feature_type: Optional[str] = Query(None),
    model: Optional[str] = Query(None),
    request_id: Optional[str] = Query(None),
    review_id: Optional[int] = Query(None),
    thread_id: Optional[int] = Query(None),
    session_id: Optional[int] = Query(None),
    created_from: Optional[str] = Query(None, description="ISO datetime"),
    created_to: Optional[str] = Query(None, description="ISO datetime"),
):
    query = db.query(LlmRequest).filter(LlmRequest.user_id == current_user.id)

    if feature_type:
        query = query.filter(LlmRequest.feature_type == feature_type)
    if model:
        model_like = f"%{model.lower()}%"
        query = query.filter(func.lower(LlmRequest.model).like(model_like))
    if request_id:
        query = query.filter(LlmRequest.request_id == request_id)
    if review_id is not None:
        query = query.filter(LlmRequest.review_id == review_id)
    if thread_id is not None:
        query = query.filter(LlmRequest.thread_id == thread_id)
    if session_id is not None:
        query = query.filter(LlmRequest.session_id == session_id)

    def _parse_dt(value: Optional[str]) -> Optional[datetime]:
        if not value:
            return None
        try:
            dt = datetime.fromisoformat(value)
        except Exception:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt

    dt_from = _parse_dt(created_from)
    dt_to = _parse_dt(created_to)
    if dt_from:
        query = query.filter(LlmRequest.created_at >= dt_from)
    if dt_to:
        query = query.filter(LlmRequest.created_at <= dt_to)

    total = query.count()
    rows = query.order_by(LlmRequest.created_at.desc()).offset(offset).limit(limit).all()
    return LlmRequestListResponse(
        items=rows,
        total=total,
    )

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

    now = datetime.now(timezone.utc)
    notebook = Notebook(
        user_id=current_user.id,
        subject_id=notebook_data.subject_id,
        title=notebook_data.title,
        description=notebook_data.description,
        color=notebook_data.color,
        created_at=now,
        updated_at=now
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
    
    # SQLiteではonupdate=func.now()が動作しないため、明示的に更新
    notebook.updated_at = datetime.now(timezone.utc)
    
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
    
    now = datetime.now(timezone.utc)
    section = NoteSection(
        notebook_id=section_data.notebook_id,
        title=section_data.title,
        display_order=section_data.display_order or 0,
        created_at=now,
        updated_at=now
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
    
    # SQLiteではonupdate=func.now()が動作しないため、明示的に更新
    section.updated_at = datetime.now(timezone.utc)
    
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
    
    now = datetime.now(timezone.utc)
    page = NotePage(
        section_id=page_data.section_id,
        title=page_data.title,
        content=page_data.content,
        display_order=page_data.display_order or 0,
        created_at=now,
        updated_at=now
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
    
    # SQLiteではonupdate=func.now()が動作しないため、明示的に更新
    page.updated_at = datetime.now(timezone.utc)
    
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
    type: Optional[str] = Query(None, description="スレッドタイプ（指定しない場合は全タイプ）")
):
    """スレッド一覧を取得（直近N件）（認証必須）"""
    user_id = current_user.id
    
    query = db.query(Thread).filter(
        Thread.user_id == user_id
    )
    
    if type:
        query = query.filter(Thread.type == type)
    
    total = query.count()
    threads = query.order_by(
        Thread.pinned.desc(),
        Thread.last_message_at.desc().nullslast(),
        Thread.created_at.desc()
    ).offset(offset).limit(limit).all()
    
    # 講評チャットの場合、review_idを取得してレスポンスに含める
    thread_responses = []
    for t in threads:
        thread_response = ThreadResponse.model_validate(t)
        if t.type == "review_chat":
            review = db.query(Review).filter(Review.thread_id == t.id).first()
            if review:
                # review_idを追加
                thread_response.review_id = review.id
        thread_responses.append(thread_response)
    
    return ThreadListResponse(
        threads=thread_responses,
        total=total
    )

@app.get("/v1/threads/all", response_model=ThreadListResponse)
async def get_all_threads(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """全スレッドを取得（勉強管理ページ用）"""
    user_id = current_user.id
    
    threads = db.query(Thread).filter(
        Thread.user_id == user_id
    ).order_by(Thread.created_at.desc()).all()
    
    # 講評チャットの場合、review_idを取得してレスポンスに含める
    thread_responses = []
    for t in threads:
        thread_response = ThreadResponse.model_validate(t)
        if t.type == "review_chat":
            review = db.query(Review).filter(Review.thread_id == t.id).first()
            if review:
                # review_idを追加
                thread_response.review_id = review.id
        thread_responses.append(thread_response)
    
    return ThreadListResponse(
        threads=thread_responses,
        total=len(threads)
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

@app.get("/v1/threads/{thread_id}/review-id")
async def get_thread_review_id(
    thread_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """スレッドに関連するreview_idを取得（講評チャット用）"""
    thread = db.query(Thread).filter(Thread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    
    if thread.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if thread.type != "review_chat":
        raise HTTPException(status_code=400, detail="This thread is not a review chat")
    
    review = db.query(Review).filter(Review.thread_id == thread_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found for this thread")
    
    return {"review_id": review.id}

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
        # LLMには user/assistant のみ渡す（systemは除外）
        if msg.role in ("user", "assistant"):
            chat_history.append({
                "role": msg.role,
                "content": msg.content
            })
    
    # 3. LLMを呼び出し
    try:
        assistant_content = ""
        model_name = None
        input_tokens = None
        output_tokens = None
        request_id = None
        latency_ms = None

        if thread.type == "review_chat":
            # review_idは Review.thread_id から逆引きして復元（DBにはコンテキストを保存しない）
            review = db.query(Review).filter(Review.thread_id == thread_id).first()
            if not review:
                raise HTTPException(status_code=404, detail="Review not found for this thread")
            if review.user_id != current_user.id:
                raise HTTPException(status_code=403, detail="Access denied")

            # 初回のみコンテキストをLLMへ渡す（messagesには保存しない）
            is_first_turn = len(chat_history) == 0
            context_text = None
            if is_first_turn:
                question_text, purpose_text, grading_text, review_json_obj = _get_review_chat_context_by_review_id(
                    review_id=review.id,
                    current_user=current_user,
                    db=db,
                )
                context_text = _build_review_chat_context_text(
                    question_text=question_text,
                    purpose_text=purpose_text,
                    grading_impression_text=grading_text,
                    review_json_obj=review_json_obj,
                )

            system_prompt = _load_prompt_text("review_chat_system")
            user_prompt = _build_review_chat_user_prompt_text(message_data.content)
            messages_for_llm = []
            if context_text:
                messages_for_llm.append({"role": "user", "content": context_text})
            if chat_history:
                messages_for_llm.extend(chat_history)
            messages_for_llm.append({"role": "user", "content": user_prompt})

            from .llm_service import review_chat as llm_review_chat
            assistant_content, model_name, input_tokens, output_tokens, request_id, latency_ms = llm_review_chat(
                system_prompt=system_prompt,
                messages=messages_for_llm,
            )

            # Review側にもチャット有無を反映（一覧高速化）
            if not review.has_chat:
                review.has_chat = True

        else:
            # free_chat（従来）
            from pathlib import Path
            prompt_file = Path(__file__).parent.parent / "prompts" / "main" / "free_chat.txt"
            system_prompt = ""
            if prompt_file.exists():
                system_prompt = prompt_file.read_text(encoding="utf-8").strip()
            from .llm_service import free_chat as llm_free_chat
            assistant_content, model_name, input_tokens, output_tokens, request_id, latency_ms = llm_free_chat(
                question=message_data.content,
                chat_history=chat_history if chat_history else None
            )
        
        # 4. アシスタントメッセージを保存
        assistant_message = Message(
            thread_id=thread_id,
            role="assistant",
            content=assistant_content,
            model=model_name,
            prompt_version="review_chat_v1" if thread.type == "review_chat" else None,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )
        db.add(assistant_message)
        
        # 5. threads.last_message_atを更新
        from datetime import datetime, timezone
        thread.last_message_at = datetime.now(timezone.utc)
        
        # 6. 初回メッセージかつタイトルがない場合、タイトルを自動生成
        is_first_message = len(chat_history) == 0
        if is_first_message and (not thread.title or thread.title.strip() == ""):
            try:
                auto_title = generate_chat_title(message_data.content)
                thread.title = auto_title
            except Exception as title_error:
                # タイトル生成に失敗しても本体の処理は続行
                logger.warning(f"タイトル自動生成に失敗: {title_error}")
        
        # LLM使用量を保存（共通ログ）
        if input_tokens is not None or output_tokens is not None or request_id:
            review_id = None
            if thread.type == "review_chat":
                review = db.query(Review).filter(Review.thread_id == thread_id).first()
                if review:
                    review_id = review.id
            prompt_version = "review_chat_v1" if thread.type == "review_chat" else "free_chat_v1"
            llm_row = LlmRequest(
                **build_llm_request_row(
                    user_id=current_user.id,
                    feature_type="review_chat" if thread.type == "review_chat" else "free_chat",
                    review_id=review_id,
                    thread_id=thread_id,
                    model=model_name,
                    prompt_version=prompt_version,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    request_id=request_id,
                    latency_ms=latency_ms,
                )
            )
            db.add(llm_row)

        db.commit()
        db.refresh(assistant_message)
        
        return MessageResponse.model_validate(assistant_message)
        
    except Exception as e:
        # エラーが発生した場合もユーザーメッセージは保存済み
        db.rollback()
        raise HTTPException(status_code=500, detail=f"LLM呼び出しエラー: {str(e)}")


@app.delete("/v1/threads/{thread_id}/messages")
async def clear_thread_messages(
    thread_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    """スレッドのメッセージを全削除（認証必須）"""
    thread = db.query(Thread).filter(Thread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    if thread.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    db.query(Message).filter(Message.thread_id == thread_id).delete(synchronize_session=False)
    thread.last_message_at = None

    # review_chat の場合、Review.has_chat も下げる（thread自体は残す）
    if thread.type == "review_chat":
        review = db.query(Review).filter(Review.thread_id == thread_id).first()
        if review and review.user_id == current_user.id:
            review.has_chat = False

    db.commit()
    return {"message": "cleared"}

@app.put("/v1/threads/{thread_id}", response_model=ThreadResponse)
async def update_thread(
    thread_id: int,
    thread_update: dict,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """スレッドを更新（認証必須）"""
    thread = db.query(Thread).filter(Thread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    
    if thread.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # 更新
    if "favorite" in thread_update:
        thread.favorite = thread_update["favorite"]
    if "title" in thread_update:
        thread.title = thread_update.get("title")
    if "pinned" in thread_update:
        thread.pinned = thread_update["pinned"]
    
    db.commit()
    db.refresh(thread)
    
    return ThreadResponse.model_validate(thread)


@app.delete("/v1/threads/{thread_id}")
async def delete_thread(
    thread_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """スレッドを削除（認証必須）"""
    thread = db.query(Thread).filter(Thread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    
    if thread.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # review_chatの場合、関連するReviewのthread_idとhas_chatをリセット
    if thread.type == "review_chat":
        review = db.query(Review).filter(Review.thread_id == thread_id).first()
        if review:
            review.thread_id = None
            review.has_chat = False
    
    # スレッドを削除（CASCADE でメッセージも削除される）
    db.delete(thread)
    db.commit()
    
    return {"message": "deleted"}


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

@app.get("/v1/dashboard/items/all", response_model=DashboardItemListResponse)
async def get_all_dashboard_items(
    entry_type: Optional[int] = Query(None, description="種別（1=Point, 2=Task）"),
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """ダッシュボード項目を全期間で取得（勉強管理ページ用）"""
    if not current_user:
        raise HTTPException(status_code=401, detail="認証が必要です")
    
    query = db.query(DashboardItem).filter(
        DashboardItem.user_id == current_user.id,
        DashboardItem.deleted_at.is_(None)
    )
    
    if entry_type:
        query = query.filter(DashboardItem.entry_type == entry_type)
    
    items = query.order_by(DashboardItem.created_at.desc()).all()
    
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
        position=position,
        favorite=item.favorite if item.favorite is not None else 0
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


# ============================================================================
# 最近の復習問題（ダッシュボード）
# ============================================================================

RECENT_REVIEW_DAILY_LIMIT = 5


def _get_current_study_date_4am() -> str:
    return get_study_date_4am(datetime.now(ZoneInfo("UTC")))


def _get_recent_ymds(base_ymd: str, days: int) -> list[str]:
    base = datetime.strptime(base_ymd, "%Y-%m-%d").date()
    return [(base - timedelta(days=i)).isoformat() for i in range(days)]


def _safe_review_eval_subset(review_json_obj: dict) -> dict:
    """
    evaluationから必要な部分を抽出し、各要素にblock_numberを付与する
    
    - strengths: 各要素（dictまたはstring）にblock_numberを付与（重要度順に1,2,3...）
    - weaknesses: 各要素（dictまたはstring）にblock_numberを付与（重要度順に1,2,3...）
    - important_points: 各要素（dict）にblock_numberを付与（重要度順に1,2,3...）
    - future_considerations: 各要素（string）をdictに変換してblock_numberを付与（重要度順に1,2,3...）
    
    注: 復習問題生成ではstrengthsは使用しないが、データの共通化のため処理を追加
    """
    ev = (review_json_obj or {}).get("evaluation") or {}
    
    # strengthsにblock_numberを付与（復習問題生成では使用しないが、データ共通化のため処理）
    strengths_raw = ev.get("strengths") or []
    strengths: list[dict] = []
    for idx, item in enumerate(strengths_raw, start=1):
        if isinstance(item, dict):
            # 既にblock_numberがある場合はそのまま、ない場合は付与
            item_copy = item.copy()
            if "block_number" not in item_copy:
                item_copy["block_number"] = idx
            strengths.append(item_copy)
        elif isinstance(item, str):
            # 文字列の場合はdictに変換
            strengths.append({"content": item, "block_number": idx})
        else:
            # その他の型はスキップ
            continue
    
    # weaknessesにblock_numberを付与
    weaknesses_raw = ev.get("weaknesses") or []
    weaknesses: list[dict] = []
    for idx, item in enumerate(weaknesses_raw, start=1):
        if isinstance(item, dict):
            # 既にblock_numberがある場合はそのまま、ない場合は付与
            item_copy = item.copy()
            if "block_number" not in item_copy:
                item_copy["block_number"] = idx
            weaknesses.append(item_copy)
        elif isinstance(item, str):
            # 文字列の場合はdictに変換
            weaknesses.append({"content": item, "block_number": idx})
        else:
            # その他の型はスキップ
            continue
    
    # important_pointsにblock_numberを付与
    important_points_raw = ev.get("important_points") or []
    important_points: list[dict] = []
    for idx, item in enumerate(important_points_raw, start=1):
        if isinstance(item, dict):
            # 既にblock_numberがある場合はそのまま、ない場合は付与
            item_copy = item.copy()
            if "block_number" not in item_copy:
                item_copy["block_number"] = idx
            important_points.append(item_copy)
        else:
            # dict以外はスキップ
            continue
    
    # future_considerationsにblock_numberを付与（文字列をdictに変換）
    future_considerations_raw = ev.get("future_considerations") or []
    future_considerations: list[dict] = []
    for idx, item in enumerate(future_considerations_raw, start=1):
        if isinstance(item, str):
            future_considerations.append({"content": item, "block_number": idx})
        elif isinstance(item, dict):
            # 既にdictの場合はblock_numberを確認
            item_copy = item.copy()
            if "block_number" not in item_copy:
                item_copy["block_number"] = idx
            future_considerations.append(item_copy)
        else:
            # その他の型はスキップ
            continue
    
    subset = {
        "weaknesses": weaknesses,
        "important_points": important_points,
        "future_considerations": future_considerations,
    }
    return subset


def _format_dashboard_items_for_llm(items: list[DashboardItem]) -> list[dict]:
    out: list[dict] = []
    for it in items:
        out.append(
            {
                "dashboard_date": it.dashboard_date,
                "subject_id": _normalize_subject_id(it.subject),
                "item": it.item,
                "memo": it.memo,
            }
        )
    return out


def _format_free_chat_threads_for_llm(db: Session, user_id: int) -> list[dict]:
    threads = (
        db.query(Thread)
        .filter(
            Thread.user_id == user_id,
            Thread.type == "free_chat",
            Thread.last_message_at.isnot(None),
        )
        .order_by(Thread.last_message_at.desc())
        .limit(5)
        .all()
    )
    out: list[dict] = []
    for th in threads:
        msgs = (
            db.query(Message)
            .filter(Message.thread_id == th.id)
            .order_by(Message.created_at.desc())
            .limit(10)
            .all()
        )
        msgs = list(reversed(msgs))
        out.append(
            {
                "thread_id": th.id,
                "title": th.title,
                "last_message_at": th.last_message_at.isoformat() if th.last_message_at else None,
                "messages": [{"role": m.role, "content": m.content} for m in msgs],
            }
        )
    return out


def _format_review_chat_threads_for_llm(db: Session, reviews: list[Review]) -> list[dict]:
    out: list[dict] = []
    for r in reviews:
        if not r.thread_id:
            continue
        th = db.query(Thread).filter(Thread.id == r.thread_id).first()
        if not th or th.type != "review_chat":
            continue
        msgs = (
            db.query(Message)
            .filter(Message.thread_id == th.id)
            .order_by(Message.created_at.desc())
            .limit(10)
            .all()
        )
        msgs = list(reversed(msgs))
        out.append(
            {
                "review_id": r.id,
                "thread_id": th.id,
                "title": th.title,
                "messages": [{"role": m.role, "content": m.content} for m in msgs],
            }
        )
    return out


def _build_recent_review_prompt(
    *,
    study_date: str,
    dashboard_items_json: str,
    reviews_json: str,
    review_chat_threads_json: str,
    free_chat_threads_json: str,
    previous_questions_json: str,
) -> str:
    template = _load_prompt_text("recent_review_problems")
    if not template:
        raise HTTPException(status_code=500, detail="recent_review_problems prompt not found")
    return (
        template.replace("{STUDY_DATE}", study_date)
        .replace("{DASHBOARD_ITEMS_JSON}", dashboard_items_json)
        .replace("{REVIEWS_JSON}", reviews_json)
        .replace("{REVIEW_CHAT_THREADS_JSON}", review_chat_threads_json)
        .replace("{FREE_CHAT_THREADS_JSON}", free_chat_threads_json)
        .replace("{PREVIOUS_QUESTIONS_JSON}", previous_questions_json)
    )


def _count_recent_review_success_sessions(db: Session, user_id: int, study_date: str) -> int:
    return (
        db.query(RecentReviewProblemSession)
        .filter(
            RecentReviewProblemSession.user_id == user_id,
            RecentReviewProblemSession.study_date == study_date,
            RecentReviewProblemSession.status == "success",
        )
        .count()
    )


@app.get("/v1/recent-review-problems/sessions", response_model=RecentReviewProblemSessionsResponse)
async def list_recent_review_problem_sessions(
    study_date: Optional[str] = Query(None, description="学習日（YYYY-MM-DD, 4:00境界）。省略時は今日"),
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    sd = (study_date or "").strip() or _get_current_study_date_4am()

    sessions = (
        db.query(RecentReviewProblemSession)
        .filter(
            RecentReviewProblemSession.user_id == current_user.id,
            RecentReviewProblemSession.study_date == sd,
        )
        .order_by(RecentReviewProblemSession.created_at.desc())
        .all()
    )

    # problems と saved をまとめて解決
    all_problem_ids: list[int] = []
    by_session: dict[int, list[RecentReviewProblem]] = {}
    for s in sessions:
        probs = (
            db.query(RecentReviewProblem)
            .filter(RecentReviewProblem.session_id == s.id)
            .order_by(RecentReviewProblem.order_index.asc())
            .all()
        )
        by_session[s.id] = probs
        all_problem_ids.extend([p.id for p in probs])

    saved_map: dict[int, int] = {}
    if all_problem_ids:
        saved_rows = (
            db.query(SavedReviewProblem)
            .filter(
                SavedReviewProblem.user_id == current_user.id,
                SavedReviewProblem.source_problem_id.in_(all_problem_ids),
            )
            .all()
        )
        saved_map = {r.source_problem_id: r.id for r in saved_rows}

    session_resps: list[RecentReviewProblemSessionResponse] = []
    for s in sessions:
        probs = by_session.get(s.id, [])
        p_resps: list[RecentReviewProblemResponse] = []
        for p in probs:
            sid = saved_map.get(p.id)
            p_resps.append(
                RecentReviewProblemResponse(
                    id=p.id,
                    order_index=p.order_index,
                    subject_id=p.subject_id,
                    question_text=p.question_text,
                    answer_example=p.answer_example,
                    references=p.references,
                    saved=bool(sid),
                    saved_id=sid,
                )
            )
        session_resps.append(
            RecentReviewProblemSessionResponse(
                id=s.id,
                study_date=s.study_date,
                mode=s.mode,
                status=s.status,
                error_message=s.error_message,
                created_at=s.created_at,
                problems=p_resps,
            )
        )

    used = _count_recent_review_success_sessions(db, current_user.id, sd)
    remaining = max(0, RECENT_REVIEW_DAILY_LIMIT - used)

    return RecentReviewProblemSessionsResponse(
        study_date=sd,
        used_count=used,
        remaining_count=remaining,
        daily_limit=RECENT_REVIEW_DAILY_LIMIT,
        sessions=session_resps,
        total=len(session_resps),
    )


@app.post("/v1/recent-review-problems/sessions", response_model=RecentReviewProblemSessionResponse)
async def create_recent_review_problem_session(
    payload: RecentReviewProblemGenerateRequest,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    sd = _get_current_study_date_4am()
    used = _count_recent_review_success_sessions(db, current_user.id, sd)
    if used >= RECENT_REVIEW_DAILY_LIMIT:
        raise HTTPException(status_code=429, detail="本日の制限に達しました。")

    mode = "regenerate" if payload.source_session_id else "generate"

    # previous questions（同日セッションすべて）
    prev_questions: list[str] = []
    prev_sessions = (
        db.query(RecentReviewProblemSession.id)
        .filter(
            RecentReviewProblemSession.user_id == current_user.id,
            RecentReviewProblemSession.study_date == sd,
            RecentReviewProblemSession.status == "success",
        )
        .all()
    )
    prev_session_ids = [r[0] for r in prev_sessions]
    if prev_session_ids:
        prev_probs = (
            db.query(RecentReviewProblem.question_text)
            .filter(RecentReviewProblem.session_id.in_(prev_session_ids))
            .all()
        )
        prev_questions = [r[0] for r in prev_probs if r and r[0]]

    # dashboard items（直近4日、最大20件）
    ymds = _get_recent_ymds(sd, 4)
    dash_items = (
        db.query(DashboardItem)
        .filter(
            DashboardItem.user_id == current_user.id,
            DashboardItem.deleted_at.is_(None),
            DashboardItem.dashboard_date.in_(ymds),
        )
        .order_by(DashboardItem.dashboard_date.desc(), DashboardItem.position.asc())
        .limit(20)
        .all()
    )

    # reviews（直近1週間、最大2件）
    one_week_ago_utc = datetime.now(ZoneInfo("UTC")) - timedelta(days=7)
    reviews = (
        db.query(Review)
        .filter(
            Review.user_id == current_user.id,
            Review.created_at >= one_week_ago_utc,
        )
        .order_by(Review.created_at.desc())
        .limit(2)
        .all()
    )
    reviews_payload: list[dict] = []
    for r in reviews:
        try:
            review_json_obj = json.loads(r.kouhyo_kekka) if isinstance(r.kouhyo_kekka, str) else (r.kouhyo_kekka or {})
        except Exception:
            review_json_obj = {}
        hist = db.query(UserReviewHistory).filter(UserReviewHistory.review_id == r.id).first()
        reviews_payload.append(
            {
                "review_id": r.id,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "subject_id": _normalize_subject_id(hist.subject if hist else None),
                "question_title": (hist.question_title if hist else None),
                "evaluation_subset": _safe_review_eval_subset(review_json_obj),
            }
        )

    review_chat_threads_payload = _format_review_chat_threads_for_llm(db, reviews)
    free_chat_threads_payload = _format_free_chat_threads_for_llm(db, current_user.id)

    dashboard_items_json = json.dumps(_format_dashboard_items_for_llm(dash_items), ensure_ascii=False, indent=2)
    reviews_json = json.dumps(reviews_payload, ensure_ascii=False, indent=2)
    review_chat_threads_json = json.dumps(review_chat_threads_payload, ensure_ascii=False, indent=2)
    free_chat_threads_json = json.dumps(free_chat_threads_payload, ensure_ascii=False, indent=2)
    previous_questions_json = json.dumps(prev_questions, ensure_ascii=False, indent=2)

    prompt_text = _build_recent_review_prompt(
        study_date=sd,
        dashboard_items_json=_truncate_text(dashboard_items_json, limit=12000),
        reviews_json=_truncate_text(reviews_json, limit=12000),
        review_chat_threads_json=_truncate_text(review_chat_threads_json, limit=12000),
        free_chat_threads_json=_truncate_text(free_chat_threads_json, limit=12000),
        previous_questions_json=_truncate_text(previous_questions_json, limit=8000),
    )

    session = RecentReviewProblemSession(
        user_id=current_user.id,
        study_date=sd,
        mode=mode,
        source_session_id=payload.source_session_id,
        status="failed",  # まず失敗で作り、成功で上書き
    )
    db.add(session)
    db.flush()

    try:
        items, raw_output, model_name, in_tok, out_tok, request_id, latency_ms = generate_recent_review_problems(prompt_text)
        session.llm_model = model_name
        session.prompt_version = "recent_review_problems_v1"
        session.llm_raw_output = _truncate_text(raw_output or "", limit=16000)

        if in_tok is not None or out_tok is not None or request_id:
            llm_row = LlmRequest(
                **build_llm_request_row(
                    user_id=current_user.id,
                    feature_type="recent_review",
                    session_id=session.id,
                    model=model_name,
                    prompt_version="recent_review_problems_v1",
                    input_tokens=in_tok,
                    output_tokens=out_tok,
                    request_id=request_id,
                    latency_ms=latency_ms,
                )
            )
            db.add(llm_row)

        if not items:
            raise Exception("LLM returned empty items")

        # 保存
        idx = 1
        created_probs: list[RecentReviewProblem] = []
        for it in items[:5]:
            p = RecentReviewProblem(
                session_id=session.id,
                user_id=current_user.id,
                order_index=idx,
                subject_id=_normalize_subject_id(it.get("subject_id")),
                question_text=(it.get("question_text") or "").strip(),
                answer_example=(it.get("answer_example") or None),
                references=(it.get("references") or None),
            )
            db.add(p)
            created_probs.append(p)
            idx += 1

        session.status = "success"
        session.error_message = None
        db.commit()

        # response
        db.refresh(session)
        for p in created_probs:
            db.refresh(p)

        p_resps = [
            RecentReviewProblemResponse(
                id=p.id,
                order_index=p.order_index,
                subject_id=p.subject_id,
                question_text=p.question_text,
                answer_example=p.answer_example,
                references=p.references,
                saved=False,
                saved_id=None,
            )
            for p in created_probs
        ]
        return RecentReviewProblemSessionResponse(
            id=session.id,
            study_date=session.study_date,
            mode=session.mode,
            status=session.status,
            error_message=session.error_message,
            created_at=session.created_at,
            problems=p_resps,
        )
    except Exception as e:
        session.status = "failed"
        session.error_message = str(e)
        db.commit()
        return RecentReviewProblemSessionResponse(
            id=session.id,
            study_date=session.study_date,
            mode=session.mode,
            status=session.status,
            error_message=session.error_message,
            created_at=session.created_at,
            problems=[],
        )


@app.post("/v1/recent-review-problems/problems/{problem_id}/save", response_model=SaveReviewProblemResponse)
async def save_recent_review_problem(
    problem_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    p = (
        db.query(RecentReviewProblem)
        .filter(RecentReviewProblem.id == problem_id, RecentReviewProblem.user_id == current_user.id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")

    existing = (
        db.query(SavedReviewProblem)
        .filter(SavedReviewProblem.user_id == current_user.id, SavedReviewProblem.source_problem_id == p.id)
        .first()
    )
    if existing:
        return SaveReviewProblemResponse(saved_id=existing.id)

    row = SavedReviewProblem(
        user_id=current_user.id,
        source_problem_id=p.id,
        subject_id=p.subject_id,
        question_text=p.question_text,
        answer_example=p.answer_example,
        references=p.references,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return SaveReviewProblemResponse(saved_id=row.id)