import json
import logging
import calendar
import pyotp
from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import or_, cast, String, func
from sqlalchemy.exc import OperationalError as SQLAlchemyOperationalError
from sqlalchemy.orm import Session
from typing import Any, Optional, List, Tuple
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass
import uuid
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

from .db import SessionLocal, engine, Base, get_db_session_for_url
from .models import (
    Submission, Review, Problem,
    ShortAnswerProblem, ShortAnswerSession, ShortAnswerAnswer,
    User, UserSubscription, SubscriptionPlan, UserReviewTicketGrant,
    Notebook, NoteSection, NotePage,
    Thread, Message, LlmRequest,
    UserPreference, UserDashboard, UserDashboardHistory, UserReviewHistory,
    DashboardItem, Subject, OfficialQuestion,
    RecentReviewProblemSession, RecentReviewProblem, SavedReviewProblem, ContentUse,
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
    ShortAnswerProblemCreate, ShortAnswerProblemResponse, ShortAnswerProblemListResponse,
    ShortAnswerSessionCreate, ShortAnswerSessionResponse,
    ShortAnswerAnswerCreate, ShortAnswerAnswerResponse,
    NotebookCreate, NotebookUpdate, NotebookResponse, NotebookDetailResponse,
    NoteSectionCreate, NoteSectionUpdate, NoteSectionResponse, NoteSectionDetailResponse,
    NotePageCreate,
    AdminUserResponse, AdminUserListResponse, AdminStatsResponse, AdminFeatureStatsResponse, AdminUserUpdateRequest, NotePageUpdate, NotePageResponse,
    SubmissionHistoryResponse, ShortAnswerHistoryResponse, UserReviewHistoryResponse,
    AdminReviewHistoryItemResponse, AdminReviewHistoryListResponse,
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
    LlmRequestResponse, LlmRequestListResponse,
    AdminUserResponse, AdminUserListResponse, AdminStatsResponse, AdminFeatureStatsResponse,
    AdminUserUpdateRequest, AdminDatabaseInfoResponse,
    PlanLimitUsageResponse, ReviewTicketCheckoutRequest, ReviewTicketCheckoutResponse, ReviewTicketUsageResponse,
    SubscriptionCheckoutRequest, SubscriptionCheckoutResponse
)
from pydantic import BaseModel
from .llm_service import generate_review, chat_about_review, free_chat, generate_recent_review_problems, generate_chat_title
from .llm_usage import build_llm_request_row
from .auth import get_current_user, get_current_user_required, get_current_admin, verify_google_token, get_or_create_user, create_access_token
from . import plan_limits as plan_limits_module
from config.settings import AUTH_ENABLED
from config.settings import (
    ADMIN_2FA_ENABLED,
    ADMIN_2FA_EMAIL,
    ADMIN_2FA_TOTP_SECRET,
    ADMIN_2FA_TOTP_VALID_WINDOW,
    STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET,
    STRIPE_REVIEW_TICKET_PRICE_YEN,
    STRIPE_REVIEW_TICKET_PRODUCT_NAME,
    STRIPE_BASIC_PLAN_PRICE_ID,
    STRIPE_HIGH_PLAN_PRICE_ID,
    STRIPE_FIRST_MONTH_FM_DM_PRICE_ID,
)
from .timer_api import register_timer_routes
from .timer_utils import get_study_date as get_study_date_4am

try:
    import stripe
except Exception:
    stripe = None


def _add_one_month_jst(base_utc: datetime) -> datetime:
    """
    ひと月判定（日付基準）:
    - JST基準で「登録日の翌月同日の前日まで有効」
      例: 1/16登録 -> 2/15 23:59:59.999999 (JST) まで
    - 翌月に同日が無い場合は、月末日に合わせた上で前日を期限とする
    返り値はUTC datetime（期間終了時刻）。
    """
    jst = ZoneInfo("Asia/Tokyo")
    dt_jst = base_utc.astimezone(jst)
    year = dt_jst.year
    month = dt_jst.month + 1
    if month == 13:
        month = 1
        year += 1
    last_day = calendar.monthrange(year, month)[1]
    day = min(dt_jst.day, last_day)
    next_anchor_jst = dt_jst.replace(year=year, month=month, day=day)
    period_end_jst = (next_anchor_jst - timedelta(days=1)).replace(
        hour=23, minute=59, second=59, microsecond=999999
    )
    return period_end_jst.astimezone(timezone.utc)


def _get_plan_price_id(plan_code: str) -> str:
    mapping = {
        "basic_plan": STRIPE_BASIC_PLAN_PRICE_ID,
        "high_plan": STRIPE_HIGH_PLAN_PRICE_ID,
        "first_month_fm_dm": STRIPE_FIRST_MONTH_FM_DM_PRICE_ID,
    }
    return mapping.get(plan_code, "")


def _upsert_user_subscription(
    db: Session,
    *,
    user_id: int,
    plan_code: str,
    stripe_subscription_id: str,
    current_period_start_utc: datetime,
    current_period_end_utc: datetime,
    cancel_at_period_end: bool,
) -> None:
    plan = db.query(SubscriptionPlan).filter(
        SubscriptionPlan.plan_code == plan_code,
        SubscriptionPlan.is_active == True,
    ).first()
    if not plan:
        # 本番でプラン未登録だと決済後もプランが更新されない。subscription_plans に basic_plan 等を登録すること。
        all_plans = db.query(SubscriptionPlan).all()
        plan_codes = [p.plan_code for p in all_plans]
        logger.error(
            f"Subscription plan not found for plan_code='{plan_code}'. "
            f"Available plan_codes: {plan_codes}. "
            f"User: {user_id}, Stripe subscription: {stripe_subscription_id}"
        )
        raise HTTPException(
            status_code=503,
            detail=f"プラン '{plan_code}' がDBに登録されていません。subscription_plans に該当 plan_code を追加してください。登録済み: {plan_codes}",
        )

    existing = db.query(UserSubscription).filter(
        UserSubscription.user_id == user_id,
        UserSubscription.payment_id == stripe_subscription_id,
        UserSubscription.is_active == True,
    ).order_by(UserSubscription.started_at.desc()).first()

    if existing:
        existing.plan_id = plan.id
        existing.started_at = current_period_start_utc
        existing.expires_at = current_period_end_utc
        existing.cancelled_at = datetime.now(timezone.utc) if cancel_at_period_end else None
        existing.payment_method = "stripe_subscription"
        db.commit()
        return

    # 新規または過去行しかない場合は、現在アクティブを停止してから作成
    now_utc = datetime.now(timezone.utc)
    db.query(UserSubscription).filter(
        UserSubscription.user_id == user_id,
        UserSubscription.is_active == True,
    ).update({"is_active": False, "cancelled_at": now_utc}, synchronize_session=False)

    sub = UserSubscription(
        user_id=user_id,
        plan_id=plan.id,
        is_active=True,
        started_at=current_period_start_utc,
        expires_at=current_period_end_utc,
        payment_method="stripe_subscription",
        payment_id=stripe_subscription_id,
        cancelled_at=now_utc if cancel_at_period_end else None,
    )
    db.add(sub)
    db.commit()


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

    # content_usesテーブルとcandidate_pool_jsonカラムのマイグレーション
    try:
        from .migrate_content_uses import migrate_content_uses

        migrate_content_uses()
        logger.info("✓ Startup content_uses migration completed")
    except Exception as e:
        logger.warning(f"Startup content_uses migration skipped/failed: {str(e)}")

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

    # review追加チケット付与テーブルを作成
    try:
        from .migrate_review_ticket_grants import migrate_review_ticket_grants

        migrate_review_ticket_grants()
        logger.info("✓ Startup review ticket grants migration completed")
    except Exception as e:
        logger.warning(f"Startup review ticket grants migration skipped/failed: {str(e)}")

    # SubscriptionPlan を投入/更新
    try:
        from .seed_beta_plan import seed_subscription_plans

        seed_subscription_plans()
        logger.info("✓ Startup subscription plans seed completed")
    except Exception as e:
        logger.warning(f"Startup subscription plans seed skipped/failed: {str(e)}")

# DBロックなど（複数ユーザー同時アクセス時）→ ユーザー向けメッセージで表示
@app.exception_handler(SQLAlchemyOperationalError)
async def db_operational_error_handler(request: Request, exc: SQLAlchemyOperationalError):
    import traceback
    error_detail = traceback.format_exc()
    logger.warning(f"DB操作エラー（同時アクセス等）: {exc}\n{error_detail}")
    msg = str(exc).lower()
    if "locked" in msg or "busy" in msg or "timeout" in msg:
        detail = "データベースが一時的に使用中です。しばらく待ってから再試行してください。"
    else:
        detail = f"データベースの処理中にエラーが発生しました: {str(exc)}"
    return JSONResponse(status_code=503, content={"detail": detail})


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
            if official_q.shiken_type == "shihou":
                grading_impression_text = official_q.grading_impression_text or ""
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
    from config.llm_config import get_llm_config, USE_CASE_REVIEW, USE_CASE_REVIEW_CHAT, USE_CASE_FREE_CHAT, USE_CASE_REVISIT_PROBLEMS, USE_CASE_TITLE
    from app.llm_service import PROMPTS_DIR
    from pathlib import Path
    
    llm_config = get_llm_config()
    api_key_set = llm_config.is_available()
    api_key_preview = "設定済み" if api_key_set else "未設定"
    
    prompts_exist = {
        "input_processing": (PROMPTS_DIR / "main" / "input_processing.txt").exists(),
        "evaluation": (PROMPTS_DIR / "main" / "evaluation.txt").exists(),
    }
    
    return {
        "api_key_set": api_key_set,
        "api_key_preview": api_key_preview,
        "models": {
            "default": llm_config.get_model(),
            "review": llm_config.get_model(USE_CASE_REVIEW),
            "review_chat": llm_config.get_model(USE_CASE_REVIEW_CHAT),
            "free_chat": llm_config.get_model(USE_CASE_FREE_CHAT),
            "revisit_problems": llm_config.get_model(USE_CASE_REVISIT_PROBLEMS),
            "title": llm_config.get_model(USE_CASE_TITLE),
        },
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
        raise HTTPException(status_code=404, detail="Active official question not found")

    grading_text = oq.grading_impression_text if oq.shiken_type == "shihou" else None

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
    admin_otp_code: Optional[str] = None

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

    # 管理者アカウントのみ追加のTOTP認証を要求
    if ADMIN_2FA_ENABLED and user.email and user.email.lower() == ADMIN_2FA_EMAIL:
        otp_code = (req.admin_otp_code or "").strip()
        if not ADMIN_2FA_TOTP_SECRET:
            logger.error("ADMIN_2FA_ENABLED is true, but ADMIN_2FA_TOTP_SECRET is not configured")
            raise HTTPException(
                status_code=503,
                detail="Admin two-factor authentication is not configured"
            )
        if not otp_code:
            raise HTTPException(
                status_code=401,
                detail="管理者アカウントには2段階認証コードが必要です"
            )
        totp = pyotp.TOTP(ADMIN_2FA_TOTP_SECRET)
        if not totp.verify(otp_code, valid_window=ADMIN_2FA_TOTP_VALID_WINDOW):
            raise HTTPException(
                status_code=401,
                detail="2段階認証コードが正しくありません"
            )
    
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

def _plan_limit_int(value: Any) -> Optional[int]:
    """limits の値（JSON由来で float のことがある）を Optional[int] に変換。"""
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


@app.get("/v1/users/me/plan-limits", response_model=PlanLimitUsageResponse)
async def get_plan_limits_usage(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """現在のユーザーのプラン制限と使用量を取得（認証必須）"""
    try:
        plan = plan_limits_module.get_user_plan(db, current_user)
        logger.info(f"User {current_user.id} plan: {plan.plan_code if plan else 'None'}")
        
        limits = plan_limits_module.get_plan_limits(plan)
        review_tickets_total = plan_limits_module.count_review_ticket_count_total(db, current_user.id)
        review_ticket_bonus_total = plan_limits_module.count_review_ticket_bonus_total(db, current_user.id)
        effective_review_limit = plan_limits_module.get_effective_review_limit(db, current_user)
        reviews_used = plan_limits_module.count_reviews_total(db, current_user.id)
        review_chat_used = plan_limits_module.count_review_chat_user_messages(db, current_user.id)
        free_chat_used = plan_limits_module.count_free_chat_user_messages(db, current_user.id)
        try:
            non_review_cost_yen_used = float(plan_limits_module.get_non_review_cost_yen_total(db, current_user.id))
        except (TypeError, ValueError) as e:
            logger.warning(f"get_non_review_cost_yen_total coercion failed for user {current_user.id}: {e}")
            non_review_cost_yen_used = 0.0

        return PlanLimitUsageResponse(
            plan_name=plan.name if plan else None,
            plan_code=plan.plan_code if plan else None,
            reviews_used=reviews_used,
            reviews_limit=effective_review_limit,
            base_reviews_limit=_plan_limit_int(limits.get(plan_limits_module.LIMIT_MAX_REVIEWS_TOTAL)),
            review_ticket_count_total=review_tickets_total,
            review_ticket_bonus_total=review_ticket_bonus_total,
            review_chat_messages_used=review_chat_used,
            review_chat_messages_limit=_plan_limit_int(limits.get(plan_limits_module.LIMIT_MAX_REVIEW_CHAT_MESSAGES_TOTAL)),
            free_chat_messages_used=free_chat_used,
            free_chat_messages_limit=_plan_limit_int(limits.get(plan_limits_module.LIMIT_MAX_FREE_CHAT_MESSAGES_TOTAL)),
            recent_review_daily_limit=_plan_limit_int(limits.get(plan_limits_module.LIMIT_RECENT_REVIEW_DAILY)),
            non_review_cost_yen_used=non_review_cost_yen_used,
            non_review_cost_yen_limit=_plan_limit_int(limits.get(plan_limits_module.LIMIT_MAX_NON_REVIEW_COST_YEN_TOTAL)),
        )
    except Exception as e:
        logger.error(f"Error in get_plan_limits_usage for user {current_user.id}: {str(e)}", exc_info=True)
        raise


@app.get("/v1/users/me/review-tickets", response_model=ReviewTicketUsageResponse)
async def get_review_ticket_usage(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    """現在ユーザーの review 追加チケット利用状況を取得。"""
    return ReviewTicketUsageResponse(
        review_ticket_count_total=plan_limits_module.count_review_ticket_count_total(db, current_user.id),
        review_ticket_bonus_total=plan_limits_module.count_review_ticket_bonus_total(db, current_user.id),
        reviews_per_ticket=2,
    )


@app.post("/v1/users/me/subscription/cancel")
async def cancel_my_subscription(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    """
    次回更新停止（解約予約）。
    - 返金は行わない
    - expires_at までは利用可能
    """
    now_utc = datetime.now(timezone.utc)
    sub = (
        db.query(UserSubscription)
        .join(SubscriptionPlan, UserSubscription.plan_id == SubscriptionPlan.id)
        .filter(
            UserSubscription.user_id == current_user.id,
            UserSubscription.is_active == True,
            SubscriptionPlan.is_active == True,
        )
        .order_by(UserSubscription.started_at.desc())
        .first()
    )
    if not sub:
        raise HTTPException(status_code=404, detail="有効なサブスクリプションがありません。")

    # Stripe定期課金を次回更新停止へ
    stripe_sub_id = sub.payment_id or ""
    if stripe is not None and STRIPE_SECRET_KEY and stripe_sub_id:
        try:
            stripe.api_key = STRIPE_SECRET_KEY
            stripe.Subscription.modify(stripe_sub_id, cancel_at_period_end=True)
        except Exception as e:
            logger.warning(f"Failed to set cancel_at_period_end on Stripe: {str(e)}")

    # 期間上限が未設定の古いデータがあれば、開始時刻を基準に1か月で補完
    if sub.expires_at is None:
        base = sub.started_at if sub.started_at.tzinfo else sub.started_at.replace(tzinfo=timezone.utc)
        sub.expires_at = _add_one_month_jst(base)
    sub.cancelled_at = now_utc
    db.commit()
    db.refresh(sub)
    return {
        "message": "次回更新を停止しました。現在の期間終了までは利用できます。",
        "expires_at": sub.expires_at.isoformat() if sub.expires_at else None,
    }


@app.post("/v1/review-tickets/checkout", response_model=ReviewTicketCheckoutResponse)
async def create_review_ticket_checkout(
    req: ReviewTicketCheckoutRequest,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    """review追加チケット購入用の Stripe Checkout セッションを作成。"""
    if stripe is None:
        raise HTTPException(status_code=503, detail="Stripe SDK is not installed")
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Stripe is not configured")
    if req.quantity <= 0:
        raise HTTPException(status_code=400, detail="quantity must be greater than 0")
    if plan_limits_module.is_plan_limits_enabled() and not plan_limits_module.has_active_subscription(db, current_user):
        raise HTTPException(status_code=400, detail="プラン未登録のユーザーはチケットを購入できません。")

    stripe.api_key = STRIPE_SECRET_KEY
    session = stripe.checkout.Session.create(
        mode="payment",
        success_url=req.success_url,
        cancel_url=req.cancel_url,
        customer_email=current_user.email,
        metadata={
            "type": "review_ticket",
            "user_id": str(current_user.id),
            "ticket_count": str(req.quantity),
            "reviews_per_ticket": "2",
        },
        line_items=[
            {
                "price_data": {
                    "currency": "jpy",
                    "unit_amount": STRIPE_REVIEW_TICKET_PRICE_YEN,
                    "product_data": {
                        "name": STRIPE_REVIEW_TICKET_PRODUCT_NAME,
                        "description": "1回購入につきレビュー2回追加",
                    },
                },
                "quantity": req.quantity,
            }
        ],
    )
    return ReviewTicketCheckoutResponse(
        checkout_url=session.url,
        session_id=session.id,
    )


@app.post("/v1/subscriptions/checkout", response_model=SubscriptionCheckoutResponse)
async def create_subscription_checkout(
    req: SubscriptionCheckoutRequest,
    current_user: User = Depends(get_current_user_required),
):
    """プラン購入/変更用の Stripe Checkout セッションを作成。"""
    if stripe is None:
        raise HTTPException(status_code=503, detail="Stripe SDK is not installed")
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Stripe is not configured")

    allowed_plan_codes = {"basic_plan", "high_plan"}
    if req.via_fm_dm_link:
        allowed_plan_codes.add("first_month_fm_dm")
    if req.plan_code not in allowed_plan_codes:
        raise HTTPException(status_code=400, detail="選択できないプランです。")
    selected_price_id = _get_plan_price_id(req.plan_code)
    if not selected_price_id:
        raise HTTPException(
            status_code=503,
            detail="Stripe recurring price is not configured. Set STRIPE_*_PLAN_PRICE_ID.",
        )
    stripe.api_key = STRIPE_SECRET_KEY
    session = stripe.checkout.Session.create(
        mode="subscription",
        success_url=req.success_url,
        cancel_url=req.cancel_url,
        customer_email=current_user.email,
        metadata={
            "type": "subscription_plan",
            "user_id": str(current_user.id),
            "plan_code": req.plan_code,
            "via_fm_dm_link": "true" if req.via_fm_dm_link else "false",
        },
        subscription_data={
            "metadata": {
                "type": "subscription_plan",
                "user_id": str(current_user.id),
                "plan_code": req.plan_code,
                "renewal_plan_code": "basic_plan" if req.plan_code == "first_month_fm_dm" else req.plan_code,
            }
        },
        line_items=[
            {
                "price": selected_price_id,
                "quantity": 1,
            }
        ],
    )
    return SubscriptionCheckoutResponse(checkout_url=session.url, session_id=session.id)


def _safe_get(obj, key, default=None):
    """Stripe オブジェクトからキーを安全に取得（getattr / [] / .get すべて試す）"""
    if obj is None:
        return default
    try:
        v = getattr(obj, key, None)
        if v is not None:
            return v
    except Exception:
        pass
    try:
        if hasattr(obj, "__getitem__"):
            v = obj[key]
            if v is not None:
                return v
    except (KeyError, TypeError, IndexError):
        pass
    try:
        if hasattr(obj, "get"):
            return obj.get(key, default)
    except Exception:
        pass
    return default


def _get_subscription_period(stripe_sub_id: str) -> Tuple[datetime, datetime, bool]:
    """Stripe Subscription の期間を取得。
    API 2025-03-31 以降: current_period_start/end は SubscriptionItem に移動。
    3段階で取得を試みる:
      1. Subscription トップレベル（旧API互換）
      2. Subscription の埋め込み items.data[0]
      3. SubscriptionItem.list API（最も確実）
    """
    stripe_sub = stripe.Subscription.retrieve(stripe_sub_id, expand=["items"])
    cancel_at_period_end = bool(_safe_get(stripe_sub, "cancel_at_period_end") or False)

    start_ts = _safe_get(stripe_sub, "current_period_start")
    end_ts = _safe_get(stripe_sub, "current_period_end")

    # 2) Subscription 埋め込み items から取得
    if start_ts is None or end_ts is None:
        items = _safe_get(stripe_sub, "items")
        if items is not None:
            data = _safe_get(items, "data")
            if data and len(data) > 0:
                first = data[0]
                start_ts = start_ts or _safe_get(first, "current_period_start")
                end_ts = end_ts or _safe_get(first, "current_period_end")

    # 3) SubscriptionItem.list API で直接取得（最も確実）
    if start_ts is None or end_ts is None:
        try:
            si_list = stripe.SubscriptionItem.list(subscription=stripe_sub_id, limit=1)
            if si_list and hasattr(si_list, "data") and len(si_list.data) > 0:
                si = si_list.data[0]
                start_ts = start_ts or _safe_get(si, "current_period_start")
                end_ts = end_ts or _safe_get(si, "current_period_end")
        except Exception as e:
            logger.warning(f"SubscriptionItem.list failed for {stripe_sub_id}: {e}")

    # 4) 最終フォールバック: Subscription の created と 1ヶ月後を使用
    if start_ts is None:
        created = _safe_get(stripe_sub, "created")
        if created:
            start_ts = int(created)
            logger.warning(f"Falling back to subscription.created for period start: {start_ts}")
    if end_ts is None and start_ts is not None:
        end_ts = int(start_ts) + 30 * 24 * 3600  # 30日後
        logger.warning(f"Falling back to start + 30 days for period end: {end_ts}")

    if start_ts is None or end_ts is None:
        raise ValueError("Subscription missing current_period_start or current_period_end")

    current_start = datetime.fromtimestamp(int(start_ts), tz=timezone.utc)
    current_end = datetime.fromtimestamp(int(end_ts), tz=timezone.utc)
    return current_start, current_end, cancel_at_period_end


@app.post("/v1/webhooks/stripe")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Stripe Webhook（review追加チケットの付与）。"""
    if stripe is None:
        raise HTTPException(status_code=503, detail="Stripe SDK is not installed")
    if not STRIPE_SECRET_KEY or not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Stripe webhook is not configured")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")

    try:
        stripe.api_key = STRIPE_SECRET_KEY
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid webhook signature: {str(e)}")

    if event.get("type") == "checkout.session.completed":
        obj = event["data"]["object"]
        metadata = obj.get("metadata") or {}
        if metadata.get("type") == "review_ticket":
            user_id = int(metadata.get("user_id", "0"))
            ticket_count = int(metadata.get("ticket_count", "0"))
            reviews_per_ticket = int(metadata.get("reviews_per_ticket", "2"))
            payment_id = obj.get("payment_intent") or obj.get("id")

            if user_id > 0 and ticket_count > 0 and payment_id:
                already = db.query(UserReviewTicketGrant).filter(
                    UserReviewTicketGrant.payment_id == str(payment_id)
                ).first()
                if not already:
                    grant = UserReviewTicketGrant(
                        user_id=user_id,
                        ticket_count=ticket_count,
                        reviews_per_ticket=reviews_per_ticket,
                        total_bonus_reviews=ticket_count * reviews_per_ticket,
                        source_type="purchase",
                        payment_id=str(payment_id),
                        note="Stripe checkout.session.completed",
                    )
                    db.add(grant)
                    db.commit()
        elif metadata.get("type") == "subscription_plan":
            user_id = int(metadata.get("user_id", "0"))
            plan_code = metadata.get("plan_code")
            stripe_sub_id = obj.get("subscription")
            logger.info(
                f"Processing subscription_plan webhook: "
                f"user_id={user_id}, plan_code={plan_code}, stripe_sub_id={stripe_sub_id}"
            )
            if user_id > 0 and plan_code and stripe_sub_id:
                current_start, current_end, cancel_at_period_end = _get_subscription_period(str(stripe_sub_id))
                _upsert_user_subscription(
                    db,
                    user_id=user_id,
                    plan_code=plan_code,
                    stripe_subscription_id=str(stripe_sub_id),
                    current_period_start_utc=current_start,
                    current_period_end_utc=current_end,
                    cancel_at_period_end=cancel_at_period_end,
                )
                logger.info(f"Successfully processed subscription for user {user_id}, plan {plan_code}")

                # PlanBは初月のみ。次回請求からPlanAへ自動更新するため、価格だけ先に差し替える。
                if plan_code == "first_month_fm_dm":
                    basic_price_id = _get_plan_price_id("basic_plan")
                    if basic_price_id:
                        try:
                            si_list = stripe.SubscriptionItem.list(subscription=stripe_sub_id, limit=1)
                            if si_list and si_list.data:
                                first_id = _safe_get(si_list.data[0], "id")
                                if first_id:
                                    stripe.Subscription.modify(
                                        stripe_sub_id,
                                        items=[{"id": first_id, "price": basic_price_id}],
                                        proration_behavior="none",
                                    )
                        except Exception as e:
                            logger.warning(f"Failed to switch PlanB to PlanA for next cycle: {str(e)}")

    elif event.get("type") == "invoice.paid":
        obj = event["data"]["object"]
        stripe_sub_id = obj.get("subscription")
        if stripe_sub_id:
            stripe_sub = stripe.Subscription.retrieve(stripe_sub_id)
            metadata = _safe_get(stripe_sub, "metadata") or {}
            user_id = int(metadata.get("user_id", "0"))
            renewal_plan_code = metadata.get("renewal_plan_code") or metadata.get("plan_code")
            logger.info(
                f"Processing invoice.paid webhook: "
                f"user_id={user_id}, renewal_plan_code={renewal_plan_code}, stripe_sub_id={stripe_sub_id}"
            )
            if user_id > 0 and renewal_plan_code:
                current_start, current_end, cancel_at_period_end = _get_subscription_period(str(stripe_sub_id))
                _upsert_user_subscription(
                    db,
                    user_id=user_id,
                    plan_code=renewal_plan_code,
                    stripe_subscription_id=str(stripe_sub_id),
                    current_period_start_utc=current_start,
                    current_period_end_utc=current_end,
                    cancel_at_period_end=cancel_at_period_end,
                )
                logger.info(f"Successfully processed invoice.paid for user {user_id}, plan {renewal_plan_code}")

    return {"received": True}

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
            if official_q.shiken_type == "shihou":
                grading_impression_text = official_q.grading_impression_text

            problem_id = None
        
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

        # プラン制限: 講評の合計回数
        plan_limits_module.check_review_limit(db, current_user)

        # 2) Submission保存（認証されている場合はuser_idを設定）
        sub = Submission(
            user_id=current_user.id if current_user else None,
            problem_id=problem_id,  # 既存構造用（後方互換性）
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
    database_url: Optional[str] = Query(None, description="管理者用: データベースURL（指定時はそのDBから取得、管理者のみ）"),
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """review_idで講評を取得（認証必須）。database_url指定時は管理者のみ・指定DBから取得し所有チェックを省略。"""
    use_db = db
    db_gen = None

    if database_url:
        if not current_user.is_admin:
            raise HTTPException(status_code=403, detail="管理者のみデータベースを指定できます")
        if not database_url.startswith("sqlite:///"):
            raise HTTPException(status_code=400, detail="現在はSQLiteデータベースのみサポートしています")
        db_gen = get_db_session_for_url(database_url)
        use_db = next(db_gen)

    try:
        review = use_db.query(Review).filter(Review.id == review_id).first()
        if not review:
            raise HTTPException(status_code=404, detail="Review not found")

        # database_url未指定時はユーザー所有チェック
        if not database_url and review.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

        try:
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
            official_q = use_db.query(OfficialQuestion).filter(OfficialQuestion.id == review.official_question_id).first()
            if official_q:
                question_text = official_q.text
                purpose_text = official_q.syutudaisyusi
                if official_q.subject_id:
                    subject_id = official_q.subject_id  # 科目ID（1-18）
                    subject_name = get_subject_name(subject_id)
                # 司法試験のみ採点実感を返す（存在する場合）
                if official_q.shiken_type == "shihou":
                    grading_impression_text = official_q.grading_impression_text

        # 新規問題の場合：UserReviewHistoryからタイトルと参照文章を取得
        history = use_db.query(UserReviewHistory).filter(UserReviewHistory.review_id == review_id).first()
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
        from .llm_service import _format_markdown
        review_markdown = _format_markdown(subject_name or "不明", review_json)

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
    finally:
        if db_gen is not None:
            try:
                next(db_gen, None)
            except StopIteration:
                pass


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
    plan_limits_module.check_non_review_cost_limit(db, current_user)

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
        # subjectはDBに文字列（科目名）が混入している場合があるため正規化する
        review_data = None
        result.append(SubmissionHistoryResponse(
            id=sub.id,
            subject=_normalize_subject_id(sub.subject),
            question_text=sub.question_text,
            answer_text=sub.answer_text,
            created_at=sub.created_at,
            review=review_data
        ))
    
    return result

# 開発用エンドポイント（認証必須で全投稿取得）
@app.get("/v1/dev/submissions", response_model=List[SubmissionHistoryResponse])
def get_all_submissions_dev(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    database_url: Optional[str] = Query(None, description="データベースURL（指定時はそのDBから取得）"),
):
    """開発用：全投稿一覧を取得（認証必須、dev環境のみ）。database_url指定時はそのDBを使用。"""
    # dev環境以外ではアクセス不可
    enable_dev_page = os.getenv("ENABLE_DEV_PAGE", "false").lower() == "true"
    if not enable_dev_page:
        raise HTTPException(
            status_code=403,
            detail="開発者用ページはdev環境でのみ利用可能です"
        )

    use_db = db
    db_gen = None
    if database_url:
        if not database_url.startswith("sqlite:///"):
            raise HTTPException(status_code=400, detail="現在はSQLiteデータベースのみサポートしています")
        db_gen = get_db_session_for_url(database_url)
        use_db = next(db_gen)

    try:
        submissions = use_db.query(Submission).order_by(Submission.created_at.desc()).offset(offset).limit(limit).all()

        result = []
        for sub in submissions:
            # Reviewはreview_id中心で、Submissionとは紐付けない設計のためここでは返さない
            # subjectはDBに文字列（科目名）が混入している場合があるため正規化する
            review_data = None
            result.append(SubmissionHistoryResponse(
                id=sub.id,
                subject=_normalize_subject_id(sub.subject),
                question_text=sub.question_text,
                answer_text=sub.answer_text,
                created_at=sub.created_at,
                review=review_data
            ))

        return result
    finally:
        if db_gen is not None:
            try:
                next(db_gen, None)
            except StopIteration:
                pass


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
    
    # レスポンスにsubject_nameを追加（subjectはDBに文字列が混入し得るため正規化）
    result = []
    for h in histories:
        subject_id = _normalize_subject_id(h.subject)
        history_dict = {
            "id": h.id,
            "review_id": h.review_id,
            "subject": subject_id,
            "subject_name": get_subject_name(subject_id) if subject_id else None,
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


@app.get("/v1/admin/review-history", response_model=AdminReviewHistoryListResponse)
async def get_admin_review_history(
    database_url: Optional[str] = Query(None, description="データベースURL（指定時はそのDBから取得）"),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    subject: Optional[int] = Query(None, description="科目ID（1-18）でフィルタ"),
    exam_type: Optional[str] = Query(None, description="試験種別でフィルタ"),
):
    """管理者用：全ユーザーの講評履歴一覧を取得"""
    use_db = db
    db_gen = None
    if database_url:
        if not database_url.startswith("sqlite:///"):
            raise HTTPException(status_code=400, detail="現在はSQLiteデータベースのみサポートしています")
        db_gen = get_db_session_for_url(database_url)
        use_db = next(db_gen)

    try:
        query = use_db.query(UserReviewHistory)
        if subject is not None:
            # subject はDBに文字列が混入し得るため、正規化したIDと一致する行も取得するには
            # ここでは整数フィルタのみ（正規化済みのsubject_idと一致）
            query = query.filter(UserReviewHistory.subject == subject)
        if exam_type:
            query = query.filter(UserReviewHistory.exam_type == exam_type)

        total = query.count()
        rows = query.order_by(UserReviewHistory.created_at.desc()).offset(offset).limit(limit).all()

        items = []
        for h in rows:
            subject_id = _normalize_subject_id(h.subject)
            user = use_db.query(User).filter(User.id == h.user_id).first()
            user_email = user.email if user else None
            items.append(AdminReviewHistoryItemResponse(
                id=h.id,
                review_id=h.review_id,
                user_id=h.user_id,
                user_email=user_email,
                subject=subject_id,
                subject_name=get_subject_name(subject_id) if subject_id else None,
                exam_type=h.exam_type,
                year=h.year,
                score=float(h.score) if h.score else None,
                attempt_count=h.attempt_count,
                question_title=h.question_title,
                reference_text=h.reference_text,
                created_at=h.created_at,
            ))

        return AdminReviewHistoryListResponse(items=items, total=total)
    finally:
        if db_gen is not None:
            try:
                next(db_gen, None)
            except StopIteration:
                pass


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
    
    # レスポンス時にコストを計算
    from .llm_usage import calculate_cost_yen_split, calculate_cost_usd_split
    items = []
    for row in rows:
        # 円換算のコストを計算
        cost_split_yen = calculate_cost_yen_split(row.model, row.input_tokens, row.output_tokens)
        # ドル換算のコストを計算
        cost_split_usd = calculate_cost_usd_split(row.model, row.input_tokens, row.output_tokens)
        
        input_cost_usd = None
        output_cost_usd = None
        total_cost_usd = None
        total_cost_yen = None
        
        if cost_split_usd:
            input_cost_usd, output_cost_usd = cost_split_usd
            # Decimalをfloatに変換
            input_cost_usd = float(input_cost_usd) if input_cost_usd is not None else None
            output_cost_usd = float(output_cost_usd) if output_cost_usd is not None else None
            # 合計コスト（ドル）
            if input_cost_usd is not None or output_cost_usd is not None:
                total_cost_usd = (input_cost_usd or 0.0) + (output_cost_usd or 0.0)
        
        if cost_split_yen:
            input_cost_yen, output_cost_yen = cost_split_yen
            # 合計コスト（円）
            if input_cost_yen is not None or output_cost_yen is not None:
                total_cost_yen = float((input_cost_yen or Decimal("0")) + (output_cost_yen or Decimal("0")))
        
        # LlmRequestResponseオブジェクトを作成
        item = LlmRequestResponse(
            id=row.id,
            user_id=row.user_id,
            feature_type=row.feature_type,
            review_id=row.review_id,
            thread_id=row.thread_id,
            session_id=row.session_id,
            model=row.model,
            prompt_version=row.prompt_version,
            input_tokens=row.input_tokens,
            output_tokens=row.output_tokens,
            input_cost_usd=input_cost_usd,
            output_cost_usd=output_cost_usd,
            total_cost_usd=total_cost_usd,
            total_cost_yen=total_cost_yen,
            request_id=row.request_id,
            latency_ms=row.latency_ms,
            created_at=row.created_at,
        )
        items.append(item)
    
    return LlmRequestListResponse(
        items=items,
        total=total,
    )


@app.get("/v1/admin/llm-requests", response_model=LlmRequestListResponse)
async def list_admin_llm_requests(
    database_url: Optional[str] = Query(None, description="データベースURL（指定しない場合はデフォルトDB）"),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    feature_type: Optional[str] = Query(None),
    model: Optional[str] = Query(None),
    request_id: Optional[str] = Query(None),
    review_id: Optional[int] = Query(None),
    thread_id: Optional[int] = Query(None),
    session_id: Optional[int] = Query(None),
    user_id: Optional[int] = Query(None),
    created_from: Optional[str] = Query(None, description="ISO datetime"),
    created_to: Optional[str] = Query(None, description="ISO datetime"),
):
    """管理者用: 全ユーザーのLLMリクエストログを取得（データベース切り替え対応）"""
    try:
        # データベースURLが指定されている場合は、そのDBを使用
        if database_url:
            # セキュリティチェック: SQLiteファイルのみ許可
            if not database_url.startswith("sqlite:///"):
                raise HTTPException(
                    status_code=400,
                    detail="現在はSQLiteデータベースのみサポートしています"
                )
            # 一時的なセッションを作成
            db_gen = get_db_session_for_url(database_url)
            db = next(db_gen)
            try:
                return await _list_admin_llm_requests_internal(
                    db, limit, offset, feature_type, model, request_id,
                    review_id, thread_id, session_id, user_id, created_from, created_to
                )
            finally:
                try:
                    next(db_gen, None)  # ジェネレータをクリーンアップ
                except StopIteration:
                    pass
        else:
            # デフォルトのDBを使用
            return await _list_admin_llm_requests_internal(
                db, limit, offset, feature_type, model, request_id,
                review_id, thread_id, session_id, user_id, created_from, created_to
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin LLM requests error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"LLMログの取得に失敗しました: {str(e)}"
        )


async def _list_admin_llm_requests_internal(
    db: Session,
    limit: int,
    offset: int,
    feature_type: Optional[str],
    model: Optional[str],
    request_id: Optional[str],
    review_id: Optional[int],
    thread_id: Optional[int],
    session_id: Optional[int],
    user_id: Optional[int],
    created_from: Optional[str],
    created_to: Optional[str],
) -> LlmRequestListResponse:
    """LLMログ取得の内部実装"""
    try:
        query = db.query(LlmRequest)
        
        # ユーザーIDでフィルタ（指定された場合）
        if user_id is not None:
            query = query.filter(LlmRequest.user_id == user_id)
        
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
        
        # レスポンス時にコストを計算
        from .llm_usage import calculate_cost_yen_split, calculate_cost_usd_split
        from decimal import Decimal
        items = []
        for row in rows:
            # 円換算のコストを計算
            cost_split_yen = calculate_cost_yen_split(row.model, row.input_tokens, row.output_tokens)
            # ドル換算のコストを計算
            cost_split_usd = calculate_cost_usd_split(row.model, row.input_tokens, row.output_tokens)
            
            input_cost_usd = None
            output_cost_usd = None
            total_cost_usd = None
            total_cost_yen = None
            
            if cost_split_usd:
                input_cost_usd, output_cost_usd = cost_split_usd
                input_cost_usd = float(input_cost_usd) if input_cost_usd is not None else None
                output_cost_usd = float(output_cost_usd) if output_cost_usd is not None else None
                if input_cost_usd is not None or output_cost_usd is not None:
                    total_cost_usd = (input_cost_usd or 0.0) + (output_cost_usd or 0.0)
            
            if cost_split_yen:
                input_cost_yen, output_cost_yen = cost_split_yen
                if input_cost_yen is not None or output_cost_yen is not None:
                    total_cost_yen = float((input_cost_yen or Decimal("0")) + (output_cost_yen or Decimal("0")))
            
            # DBに保存されているcost_yenも使用（計算値がない場合のフォールバック）
            if total_cost_yen is None and row.cost_yen is not None:
                total_cost_yen = float(row.cost_yen)
            
            item = LlmRequestResponse(
                id=row.id,
                user_id=row.user_id,
                feature_type=row.feature_type,
                review_id=row.review_id,
                thread_id=row.thread_id,
                session_id=row.session_id,
                model=row.model,
                prompt_version=row.prompt_version,
                input_tokens=row.input_tokens,
                output_tokens=row.output_tokens,
                input_cost_usd=input_cost_usd,
                output_cost_usd=output_cost_usd,
                total_cost_usd=total_cost_usd,
                total_cost_yen=total_cost_yen,
                request_id=row.request_id,
                latency_ms=row.latency_ms,
                created_at=row.created_at,
            )
            items.append(item)
        
        return LlmRequestListResponse(items=items, total=total)
    except Exception as e:
        logger.error(f"Admin LLM requests internal error: {str(e)}", exc_info=True)
        raise

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

    # プラン制限: チャットメッセージ数（user）と Review 以外のコスト
    if thread.type == "review_chat":
        plan_limits_module.check_review_chat_message_limit(db, current_user, after_add=1)
    else:
        plan_limits_module.check_free_chat_message_limit(db, current_user, after_add=1)
    plan_limits_module.check_non_review_cost_limit(db, current_user)

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
        title_input_tokens = None
        title_output_tokens = None
        title_request_id = None
        title_latency_ms = None
        title_model_name = None
        if is_first_message and (not thread.title or thread.title.strip() == ""):
            try:
                auto_title, title_model_name, title_input_tokens, title_output_tokens, title_request_id, title_latency_ms = generate_chat_title(message_data.content)
                thread.title = auto_title
                
                # タイトル生成のLLM使用量を保存
                if title_input_tokens is not None or title_output_tokens is not None or title_request_id:
                    title_llm_row = LlmRequest(
                        **build_llm_request_row(
                            user_id=current_user.id,
                            feature_type="chat_title",
                            thread_id=thread_id,
                            model=title_model_name,
                            prompt_version="chat_title_v1",
                            input_tokens=title_input_tokens,
                            output_tokens=title_output_tokens,
                            request_id=title_request_id,
                            latency_ms=title_latency_ms,
                        )
                    )
                    db.add(title_llm_row)
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
        
    except SQLAlchemyOperationalError as e:
        db.rollback()
        msg = str(e).lower()
        if "locked" in msg or "busy" in msg or "timeout" in msg:
            detail = "データベースが一時的に使用中です。しばらく待ってから再試行してください。"
        else:
            detail = f"データベースの処理中にエラーが発生しました: {str(e)}"
        raise HTTPException(status_code=503, detail=detail)
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


# ============================================================================
# Candidate定義と取得ロジック
# ============================================================================

@dataclass
class Candidate:
    """復習問題生成の候補コンテンツ"""
    source_type: str
    source_id: int
    sub_id: Optional[int]
    content_date: str  # YYYY-MM-DD（ソースの日付）
    subject_id: Optional[int]
    content: str
    priority_score: float = 0.0


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


# ============================================================================
# Candidate取得関数
# ============================================================================

def _fetch_dashboard_item_candidates(
    db: Session, user_id: int, study_date: str, limit: int = 50
) -> list[Candidate]:
    """DashboardItemからCandidateを取得"""
    # 前日〜5日前（当日は含めない）
    ymds = _get_recent_ymds(study_date, 5)[1:]  # 最初の要素（当日）を除外
    
    items = (
        db.query(DashboardItem)
        .filter(
            DashboardItem.user_id == user_id,
            DashboardItem.deleted_at.is_(None),
            DashboardItem.dashboard_date.in_(ymds),
            ~((DashboardItem.entry_type == 2) & (DashboardItem.status.in_([1, 4])))  # Taskかつ未了/後でを除外
        )
        .order_by(DashboardItem.dashboard_date.asc(), DashboardItem.position.asc())  # 古い順
        .limit(limit)
        .all()
    )
    
    candidates = []
    for item in items:
        content = item.item
        if item.memo:
            content = f"{item.item}\n{item.memo}"
        
        candidates.append(Candidate(
            source_type="dashboard_item",
            source_id=item.id,
            sub_id=None,
            content_date=item.dashboard_date,
            subject_id=_normalize_subject_id(item.subject),
            content=content
        ))
    
    return candidates


def _fetch_review_candidates(
    db: Session, user_id: int, study_date: str, limit: int = 3
) -> list[Candidate]:
    """ReviewからCandidateを取得"""
    # 過去2週間（当日を含む）
    fourteen_days_ago = datetime.now(ZoneInfo("UTC")) - timedelta(days=14)
    
    reviews = (
        db.query(Review)
        .filter(
            Review.user_id == user_id,
            Review.created_at >= fourteen_days_ago
        )
        .order_by(Review.created_at.asc())  # 古い順
        .limit(limit)
        .all()
    )
    
    candidates = []
    for review in reviews:
        try:
            review_json_obj = json.loads(review.kouhyo_kekka) if isinstance(review.kouhyo_kekka, str) else (review.kouhyo_kekka or {})
        except Exception:
            review_json_obj = {}
        
        hist = db.query(UserReviewHistory).filter(UserReviewHistory.review_id == review.id).first()
        subject_id = _normalize_subject_id(hist.subject if hist else None)
        eval_subset = _safe_review_eval_subset(review_json_obj)
        
        # 1答案につき最大5件
        # review_weaknessの1,2、review_importantの1,2、review_futureの1を取得
        selected_items = []
        
        # weaknesses
        for w in eval_subset.get("weaknesses", [])[:2]:
            if w.get("block_number") in [1, 2]:
                selected_items.append(("review_weakness", w.get("block_number"), w.get("description", "")))
        
        # important_points
        for ip in eval_subset.get("important_points", [])[:2]:
            if ip.get("block_number") in [1, 2]:
                selected_items.append(("review_important", ip.get("block_number"), ip.get("what_is_lacking", "")))
        
        # future_considerations
        for fc in eval_subset.get("future_considerations", [])[:1]:
            if fc.get("block_number") == 1:
                content = fc.get("content", "") if isinstance(fc.get("content"), str) else ""
                selected_items.append(("review_future", fc.get("block_number"), content))
        
        # 5件に足りない場合は順次追加
        if len(selected_items) < 5:
            # weaknessesから追加
            for w in eval_subset.get("weaknesses", []):
                if len(selected_items) >= 5:
                    break
                if (w.get("block_number"), w.get("description", "")) not in [(item[1], item[2]) for item in selected_items]:
                    selected_items.append(("review_weakness", w.get("block_number"), w.get("description", "")))
            
            # important_pointsから追加
            for ip in eval_subset.get("important_points", []):
                if len(selected_items) >= 5:
                    break
                if (ip.get("block_number"), ip.get("what_is_lacking", "")) not in [(item[1], item[2]) for item in selected_items]:
                    selected_items.append(("review_important", ip.get("block_number"), ip.get("what_is_lacking", "")))
            
            # future_considerationsから追加
            for fc in eval_subset.get("future_considerations", []):
                if len(selected_items) >= 5:
                    break
                content = fc.get("content", "") if isinstance(fc.get("content"), str) else ""
                if (fc.get("block_number"), content) not in [(item[1], item[2]) for item in selected_items]:
                    selected_items.append(("review_future", fc.get("block_number"), content))
        
        # Candidate生成
        for source_type, block_number, content_text in selected_items[:5]:
            candidates.append(Candidate(
                source_type=source_type,
                source_id=review.id,
                sub_id=block_number,
                content_date=review.created_at.date().isoformat() if review.created_at else study_date,
                subject_id=subject_id,
                content=content_text
            ))
    
    return candidates


def _fetch_review_thread_candidates(
    db: Session, user_id: int, study_date: str, limit: int = 3
) -> list[Candidate]:
    """ReviewThreadからCandidateを取得"""
    # 過去2週間（当日は含めない）
    fourteen_days_ago = datetime.now(ZoneInfo("UTC")) - timedelta(days=14)
    study_dt = datetime.strptime(study_date, "%Y-%m-%d").replace(tzinfo=ZoneInfo("UTC"))
    today_4am = study_dt.replace(hour=4, minute=0, second=0, microsecond=0)
    
    threads = (
        db.query(Thread)
        .filter(
            Thread.user_id == user_id,
            Thread.type == "review_chat",
            Thread.last_message_at >= fourteen_days_ago,
            Thread.last_message_at < today_4am
        )
        .order_by(Thread.last_message_at.asc())  # 古い順
        .limit(limit)
        .all()
    )
    
    candidates = []
    for thread in threads:
        # role='user'のメッセージを取得
        messages = (
            db.query(Message)
            .filter(
                Message.thread_id == thread.id,
                Message.role == "user"
            )
            .order_by(Message.created_at.asc())
            .all()
        )
        
        if not messages:
            continue
        
        # 3件以上: 最初/真ん中/最後、3件未満: 1件のみ
        if len(messages) >= 3:
            selected_messages = [
                messages[0],
                messages[len(messages) // 2],
                messages[-1]
            ]
        else:
            selected_messages = [messages[0]]
        
        # 各メッセージ200文字まで（先頭）、\nで連結
        content_parts = []
        for msg in selected_messages:
            msg_content = msg.content[:200] if msg.content else ""
            content_parts.append(msg_content)
        
        content = "\n".join(content_parts)
        
        candidates.append(Candidate(
            source_type="review_thread",
            source_id=thread.id,
            sub_id=None,
            content_date=thread.last_message_at.date().isoformat() if thread.last_message_at else study_date,
            subject_id=None,
            content=content
        ))
    
    return candidates


def _fetch_free_thread_candidates(
    db: Session, user_id: int, study_date: str, limit: int = 3
) -> list[Candidate]:
    """FreeThreadからCandidateを取得"""
    # 過去2週間（当日は含めない）
    fourteen_days_ago = datetime.now(ZoneInfo("UTC")) - timedelta(days=14)
    study_dt = datetime.strptime(study_date, "%Y-%m-%d").replace(tzinfo=ZoneInfo("UTC"))
    today_4am = study_dt.replace(hour=4, minute=0, second=0, microsecond=0)
    
    threads = (
        db.query(Thread)
        .filter(
            Thread.user_id == user_id,
            Thread.type == "free_chat",
            Thread.last_message_at >= fourteen_days_ago,
            Thread.last_message_at < today_4am
        )
        .order_by(Thread.last_message_at.asc())  # 古い順
        .limit(limit)
        .all()
    )
    
    candidates = []
    for thread in threads:
        # role='user'のメッセージを取得
        messages = (
            db.query(Message)
            .filter(
                Message.thread_id == thread.id,
                Message.role == "user"
            )
            .order_by(Message.created_at.asc())
            .all()
        )
        
        if not messages:
            continue
        
        # 3件以上: 最初/真ん中/最後、3件未満: 1件のみ
        if len(messages) >= 3:
            selected_messages = [
                messages[0],
                messages[len(messages) // 2],
                messages[-1]
            ]
        else:
            selected_messages = [messages[0]]
        
        # 各メッセージ200文字まで（先頭）、\nで連結
        content_parts = []
        for msg in selected_messages:
            msg_content = msg.content[:200] if msg.content else ""
            content_parts.append(msg_content)
        
        content = "\n".join(content_parts)
        
        candidates.append(Candidate(
            source_type="free_thread",
            source_id=thread.id,
            sub_id=None,
            content_date=thread.last_message_at.date().isoformat() if thread.last_message_at else study_date,
            subject_id=None,
            content=content
        ))
    
    return candidates


def _fetch_note_candidates(
    db: Session, user_id: int, study_date: str, limit: int = 3
) -> list[Candidate]:
    """NoteからCandidateを取得"""
    # 前日〜5日前の範囲（当日は含めない）
    study_dt = datetime.strptime(study_date, "%Y-%m-%d").replace(tzinfo=ZoneInfo("UTC"))
    today_4am = study_dt.replace(hour=4, minute=0, second=0, microsecond=0)
    yesterday_4am = today_4am - timedelta(days=1)
    five_days_ago_4am = today_4am - timedelta(days=5)
    
    note_pages = (
        db.query(NotePage)
        .join(NoteSection)
        .join(Notebook)
        .filter(
            Notebook.user_id == user_id,
            NotePage.updated_at >= five_days_ago_4am,
            NotePage.updated_at < yesterday_4am
        )
        .order_by(NotePage.updated_at.asc())  # 古い順
        .limit(limit)
        .all()
    )
    
    candidates = []
    for note_page in note_pages:
        content = note_page.content[:500] if note_page.content else ""
        if not content:
            continue
        
        # NotePage → NoteSection → Notebook経由でsubject_idを取得
        subject_id = None
        if note_page.section and note_page.section.notebook:
            subject_id = _normalize_subject_id(note_page.section.notebook.subject_id)
        
        candidates.append(Candidate(
            source_type="note",
            source_id=note_page.id,
            sub_id=None,
            content_date=note_page.updated_at.date().isoformat() if note_page.updated_at else study_date,
            subject_id=subject_id,
            content=content
        ))
    
    return candidates


def _build_candidate_pool(db: Session, user_id: int, study_date: str) -> list[Candidate]:
    """全ソースタイプからCandidateプールを構築"""
    candidates = []
    
    # 各ソースタイプから取得
    dashboard_items = _fetch_dashboard_item_candidates(db, user_id, study_date)
    review_items = _fetch_review_candidates(db, user_id, study_date)
    review_thread_items = _fetch_review_thread_candidates(db, user_id, study_date)
    free_thread_items = _fetch_free_thread_candidates(db, user_id, study_date)
    note_items = _fetch_note_candidates(db, user_id, study_date)
    
    candidates.extend(dashboard_items)
    candidates.extend(review_items)
    candidates.extend(review_thread_items)
    candidates.extend(free_thread_items)
    candidates.extend(note_items)
    
    # デバッグログ
    logger.info(
        f"Candidate pool built for user_id={user_id}, study_date={study_date}: "
        f"dashboard={len(dashboard_items)}, review={len(review_items)}, "
        f"review_thread={len(review_thread_items)}, free_thread={len(free_thread_items)}, "
        f"note={len(note_items)}, total={len(candidates)}"
    )
    
    return candidates


# ============================================================================
# 優先度スコア計算とフィルタリング
# ============================================================================

def _calculate_priority_score(candidate: Candidate, study_date: str) -> float:
    """Candidateの優先度スコアを計算"""
    base_score = 100.0
    
    # 日付をdatetimeオブジェクトに変換
    study_dt = datetime.strptime(study_date, "%Y-%m-%d").date()
    content_dt = datetime.strptime(candidate.content_date, "%Y-%m-%d").date()
    
    # 日付の古さ（古いほど高スコア）
    date_diff = (study_dt - content_dt).days
    if date_diff < 0:
        date_score = 0.0  # 未来の日付は最低スコア
    elif date_diff == 0:
        # Reviewのみ当日を含む（他のソースタイプは当日を含めないためここには来ない）
        date_score = 100.0  # 当日（Reviewのみ）
    elif date_diff <= 1:
        date_score = 90.0   # 1日前
    elif date_diff <= 2:
        date_score = 80.0   # 2日前
    elif date_diff <= 3:
        date_score = 70.0   # 3日前
    elif date_diff <= 5:
        date_score = 60.0   # 4-5日前
    else:
        date_score = 50.0   # それ以上（古いほど高スコア）
    
    # ソースタイプによる重み付け
    type_weights = {
        "dashboard_item": 1.0,
        "review_weakness": 1.2,
        "review_important": 1.1,
        "review_future": 1.0,
        "review_thread": 0.9,
        "free_thread": 0.8,
        "note": 0.9,
    }
    type_weight = type_weights.get(candidate.source_type, 1.0)
    
    priority_score = base_score * (date_score / 100.0) * type_weight
    return priority_score


def _sort_candidates_by_priority(candidates: list[Candidate]) -> list[Candidate]:
    """優先度スコアの降順でソート（古い方が優先）"""
    return sorted(candidates, key=lambda c: c.priority_score, reverse=True)


def _apply_final_selection_filter(candidates: list[Candidate]) -> list[Candidate]:
    """
    優先度順にソート済みの候補から、以下の優先順位で選択：
    1. dashboard_itemから2問（優先度順）
    2. review系から1問（優先度順）
    3. noteから1問（優先度順）
    4. 合計5件に満たない場合は、全体の優先度順で補充
    """
    selected = []
    
    # 1. dashboard_itemから2問
    dashboard_items = [c for c in candidates if c.source_type == "dashboard_item"]
    selected.extend(dashboard_items[:2])
    
    # 2. review系から1問
    review_items = [c for c in candidates if c.source_type in ["review_weakness", "review_important", "review_future"]]
    if review_items and len(selected) < 5:
        selected.append(review_items[0])
    
    # 3. noteから1問
    note_items = [c for c in candidates if c.source_type == "note"]
    if note_items and len(selected) < 5:
        selected.append(note_items[0])
    
    # 4. 残りを優先度順で補充
    remaining = [c for c in candidates if c not in selected]
    selected.extend(remaining[:5 - len(selected)])
    
    return selected[:5]


# ============================================================================
# content_uses除外ロジックとフォールバック処理
# ============================================================================

def _cleanup_old_content_uses(db: Session, days: int = 14) -> None:
    """14日以上古いcontent_usesを削除"""
    cutoff = datetime.now(ZoneInfo("UTC")) - timedelta(days=days)
    db.query(ContentUse).filter(ContentUse.used_at < cutoff).delete()
    db.flush()


def _get_used_candidate_keys(db: Session, user_id: int) -> set[tuple]:
    """使用済みCandidateのキーセットを取得（自動削除も実行）"""
    # 古いレコードを削除
    _cleanup_old_content_uses(db, days=14)
    
    # 使用済みキーを取得
    used = (
        db.query(ContentUse.source_type, ContentUse.source_id, ContentUse.sub_id)
        .filter(ContentUse.user_id == user_id)
        .all()
    )
    return {(u.source_type, u.source_id, u.sub_id) for u in used}


def _filter_unused_candidates(
    candidates: list[Candidate], used_keys: set[tuple]
) -> list[Candidate]:
    """使用済みCandidateを除外"""
    return [
        c for c in candidates
        if (c.source_type, c.source_id, c.sub_id) not in used_keys
    ]


def _ensure_sufficient_candidates(
    db: Session, user_id: int, study_date: str,
    candidates: list[Candidate], used_keys: set[tuple], min_count: int = 5
) -> tuple[list[Candidate], list[Candidate]]:
    """
    候補が5件未満の場合のフォールバック処理
    1. 取得制限の緩和（優先）
    2. 重複許容モード（最後の手段）
    
    Returns:
        (selected_candidates, expanded_pool): 選択された候補と拡張されたプール全体
    """
    if len(candidates) >= min_count:
        return candidates, candidates
    
    # 1. 取得制限の緩和
    expanded_candidates = []
    
    # Dashboard: 50→100件
    expanded_candidates.extend(_fetch_dashboard_item_candidates(db, user_id, study_date, limit=100))
    
    # Review: 3→5件
    expanded_candidates.extend(_fetch_review_candidates(db, user_id, study_date, limit=5))
    
    # Thread: 3→5スレッド
    expanded_candidates.extend(_fetch_review_thread_candidates(db, user_id, study_date, limit=5))
    expanded_candidates.extend(_fetch_free_thread_candidates(db, user_id, study_date, limit=5))
    
    # Note: 3→5件
    expanded_candidates.extend(_fetch_note_candidates(db, user_id, study_date, limit=5))
    
    # 優先度計算と除外処理
    for c in expanded_candidates:
        c.priority_score = _calculate_priority_score(c, study_date)
    
    expanded_candidates = _sort_candidates_by_priority(expanded_candidates)
    expanded_candidates_filtered = _filter_unused_candidates(expanded_candidates, used_keys)
    
    if len(expanded_candidates_filtered) >= min_count:
        return expanded_candidates_filtered, expanded_candidates
    
    # 2. 重複許容モード（最後の手段）
    # 14日除外を部分的に解除（3日のみ除外）
    three_days_ago = datetime.now(ZoneInfo("UTC")) - timedelta(days=3)
    relaxed_used = (
        db.query(ContentUse.source_type, ContentUse.source_id, ContentUse.sub_id)
        .filter(
            ContentUse.user_id == user_id,
            ContentUse.used_at >= three_days_ago
        )
        .all()
    )
    relaxed_used_keys = {(u.source_type, u.source_id, u.sub_id) for u in relaxed_used}
    
    relaxed_candidates = _filter_unused_candidates(expanded_candidates, relaxed_used_keys)
    
    return relaxed_candidates, expanded_candidates


# ============================================================================
# Candidateプールの保存と読み込み
# ============================================================================

def _save_candidate_pool(candidates: list[Candidate]) -> str:
    """CandidateプールをJSON文字列に変換"""
    # Candidateを辞書に変換（priority_scoreは除外、後で再計算）
    candidate_dicts = [
        {
            "source_type": c.source_type,
            "source_id": c.source_id,
            "sub_id": c.sub_id,
            "content_date": c.content_date,
            "subject_id": c.subject_id,
            "content": c.content,
        }
        for c in candidates
    ]
    return json.dumps(candidate_dicts, ensure_ascii=False)


def _load_candidate_pool(pool_json: str) -> list[Candidate]:
    """JSON文字列からCandidateプールを復元"""
    try:
        candidate_dicts = json.loads(pool_json)
        candidates = [
            Candidate(
                source_type=d["source_type"],
                source_id=d["source_id"],
                sub_id=d.get("sub_id"),
                content_date=d["content_date"],
                subject_id=d.get("subject_id"),
                content=d["content"],
                priority_score=0.0  # 後で再計算
            )
            for d in candidate_dicts
        ]
        return candidates
    except Exception as e:
        logger.error(f"Failed to load candidate pool: {e}")
        return []


def _get_candidate_pool_from_session(
    db: Session, user_id: int, study_date: str
) -> Optional[list[Candidate]]:
    """同日の最初のセッション（mode="generate"）からCandidateプールを取得"""
    try:
        session = (
            db.query(RecentReviewProblemSession)
            .filter(
                RecentReviewProblemSession.user_id == user_id,
                RecentReviewProblemSession.study_date == study_date,
                RecentReviewProblemSession.mode == "generate"
            )
            .order_by(RecentReviewProblemSession.created_at.asc())
            .first()
        )
        
        if session:
            # candidate_pool_jsonカラムが存在しない場合はNoneを返す
            pool_json = getattr(session, 'candidate_pool_json', None)
            if pool_json:
                return _load_candidate_pool(pool_json)
    except Exception as e:
        logger.warning(f"Failed to get candidate pool from session: {str(e)}")
    
    return None


# ============================================================================
# content_usesへの登録
# ============================================================================

def _register_content_uses(
    db: Session, user_id: int, session_id: int, candidates: list[Candidate]
) -> None:
    """選択されたCandidate（最大5件）をcontent_usesに登録"""
    for candidate in candidates[:5]:
        content_use = ContentUse(
            user_id=user_id,
            content_date=candidate.content_date,
            session_id=session_id,
            source_type=candidate.source_type,
            source_id=candidate.source_id,
            sub_id=candidate.sub_id
        )
        db.add(content_use)
    db.flush()


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


def _build_recent_review_prompt_from_candidates(
    study_date: str, candidates: list[Candidate]
) -> str:
    """Candidateリストからプロンプトを生成"""
    template = _load_prompt_text("recent_review_problems")
    if not template:
        raise HTTPException(status_code=500, detail="recent_review_problems prompt not found")
    
    # CandidateをJSON形式に変換
    candidates_json = json.dumps(
        [
            {
                "source_type": c.source_type,
                "content_date": c.content_date,
                "subject_id": c.subject_id,
                "content": c.content,
            }
            for c in candidates
        ],
        ensure_ascii=False,
        indent=2
    )
    
    return (
        template.replace("{STUDY_DATE}", study_date)
        .replace("{CANDIDATES_JSON}", candidates_json)
    )


def _build_recent_review_prompt(
    *,
    study_date: str,
    dashboard_items_json: str,
    reviews_json: str,
    review_chat_threads_json: str,
    free_chat_threads_json: str,
    previous_questions_json: str,
) -> str:
    """旧形式（後方互換性のため残す）"""
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
    try:
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
        daily_limit = plan_limits_module.get_recent_review_daily_limit(db, current_user)
        effective_daily_limit = daily_limit if daily_limit is not None else RECENT_REVIEW_DAILY_LIMIT
        remaining = max(0, effective_daily_limit - used)

        return RecentReviewProblemSessionsResponse(
            study_date=sd,
            used_count=used,
            remaining_count=remaining,
            daily_limit=effective_daily_limit,
            sessions=session_resps,
            total=len(session_resps),
        )
    except Exception as e:
        logger.error(f"Failed to list recent review problem sessions: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"予期しないエラーが発生しました: {str(e)}"
        )


@app.post("/v1/recent-review-problems/sessions", response_model=RecentReviewProblemSessionResponse)
async def create_recent_review_problem_session(
    payload: RecentReviewProblemGenerateRequest,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    try:
        plan_limits_module.check_recent_review_daily_limit(db, current_user)
        plan_limits_module.check_non_review_cost_limit(db, current_user)

        sd = _get_current_study_date_4am()
        daily_limit = plan_limits_module.get_recent_review_daily_limit(db, current_user)
        effective_daily_limit = daily_limit if daily_limit is not None else RECENT_REVIEW_DAILY_LIMIT
        used = _count_recent_review_success_sessions(db, current_user.id, sd)
        if used >= effective_daily_limit:
            raise HTTPException(status_code=429, detail="本日の制限に達しました。")

        mode = "regenerate" if payload.source_session_id else "generate"

        # Candidateプール取得/読み込み
        candidate_pool: Optional[list[Candidate]] = None
        if mode == "regenerate":
            # 再生成: 同日の最初のセッションから読み込み
            candidate_pool = _get_candidate_pool_from_session(db, current_user.id, sd)
        
        if candidate_pool is None:
            # 初回生成または読み込み失敗: 新規にCandidateプールを作成
            candidate_pool = _build_candidate_pool(db, current_user.id, sd)
        
        if not candidate_pool:
            # より詳細なエラーメッセージを生成
            error_details = []
            dashboard_count = len(_fetch_dashboard_item_candidates(db, current_user.id, sd))
            review_count = len(_fetch_review_candidates(db, current_user.id, sd))
            review_thread_count = len(_fetch_review_thread_candidates(db, current_user.id, sd))
            free_thread_count = len(_fetch_free_thread_candidates(db, current_user.id, sd))
            note_count = len(_fetch_note_candidates(db, current_user.id, sd))
            
            if dashboard_count == 0:
                error_details.append("ダッシュボード項目（過去5日間）")
            if review_count == 0:
                error_details.append("講評データ（過去2週間）")
            if review_thread_count == 0:
                error_details.append("講評チャット（過去2週間）")
            if free_thread_count == 0:
                error_details.append("フリーチャット（過去2週間）")
            if note_count == 0:
                error_details.append("ノート（過去5日間）")
            
            detail_msg = "復習問題を生成するためのデータがありません。"
            if error_details:
                detail_msg += f" 以下のデータが見つかりませんでした: {', '.join(error_details)}"
            else:
                detail_msg += " データは存在しますが、すべて使用済みの可能性があります。"
            
            logger.warning(
                f"No candidate pool for user_id={current_user.id}, study_date={sd}: "
                f"dashboard={dashboard_count}, review={review_count}, "
                f"review_thread={review_thread_count}, free_thread={free_thread_count}, "
                f"note={note_count}"
            )
            
            raise HTTPException(status_code=400, detail=detail_msg)
        
        # 優先度計算
        for candidate in candidate_pool:
            candidate.priority_score = _calculate_priority_score(candidate, sd)
        candidate_pool = _sort_candidates_by_priority(candidate_pool)
        
        # 除外処理
        used_keys = _get_used_candidate_keys(db, current_user.id)
        candidate_pool = _filter_unused_candidates(candidate_pool, used_keys)
        
        # 最終選択フィルター
        selected_candidates = _apply_final_selection_filter(candidate_pool)
        
        # フォールバック: 5件未満の場合
        expanded_pool = candidate_pool  # フォールバックが発生した場合の拡張プール
        if len(selected_candidates) < 5:
            selected_candidates, expanded_pool = _ensure_sufficient_candidates(
                db, current_user.id, sd, selected_candidates, used_keys, min_count=5
            )
            # 再度最終選択フィルターを適用
            selected_candidates = _apply_final_selection_filter(selected_candidates)
        
        if len(selected_candidates) < 1:
            raise HTTPException(status_code=400, detail="十分な復習材料が見つかりませんでした")
        
        # セッション作成（status="failed"）
        session = RecentReviewProblemSession(
            user_id=current_user.id,
            study_date=sd,
            mode=mode,
            source_session_id=payload.source_session_id,
            status="failed",  # まず失敗で作り、成功で上書き
        )
        db.add(session)
        db.flush()

        # content_uses登録
        _register_content_uses(db, current_user.id, session.id, selected_candidates)
        
        # Candidateプール保存
        # 初回生成時、またはフォールバックが発生した場合は拡張プールを保存
        if mode == "generate":
            try:
                # フォールバックが発生した場合は拡張プールを保存（次回の重複を防ぐ）
                pool_to_save = expanded_pool if len(expanded_pool) > len(candidate_pool) else candidate_pool
                # candidate_pool_jsonカラムが存在しない場合はスキップ
                if hasattr(session, 'candidate_pool_json'):
                    session.candidate_pool_json = _save_candidate_pool(pool_to_save)
                else:
                    logger.warning("candidate_pool_json column does not exist, skipping pool save")
            except Exception as e:
                logger.warning(f"Failed to save candidate pool: {str(e)}")
        
        # LLM呼び出し
        prompt_text = _build_recent_review_prompt_from_candidates(sd, selected_candidates)
        items, raw_output, model_name, in_tok, out_tok, request_id, latency_ms = generate_recent_review_problems(prompt_text)
        session.llm_model = model_name
        session.prompt_version = "recent_review_problems_v2"
        session.llm_raw_output = _truncate_text(raw_output or "", limit=16000)

        if in_tok is not None or out_tok is not None or request_id:
            llm_row = LlmRequest(
                **build_llm_request_row(
                    user_id=current_user.id,
                    feature_type="recent_review",
                    session_id=session.id,
                    model=model_name,
                    prompt_version="recent_review_problems_v2",
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
    except HTTPException:
        # HTTPExceptionはそのまま再発生
        raise
    except Exception as e:
        # ロールバック（content_uses、Candidateプール保存も取り消し）
        try:
            db.rollback()
            if 'session' in locals():
                session.status = "failed"
                session.error_message = str(e)
                db.commit()
        except Exception as rollback_error:
            logger.error(f"Rollback failed: {str(rollback_error)}")
        
        # 詳細なエラーメッセージをログに記録
        logger.error(f"Failed to create recent review problem session: {str(e)}", exc_info=True)
        
        # セッションが作成されていた場合は返す
        if 'session' in locals():
            return RecentReviewProblemSessionResponse(
                id=session.id,
                study_date=session.study_date,
                mode=session.mode,
                status="failed",
                error_message=str(e),
                created_at=session.created_at,
                problems=[],
            )
        else:
            # セッション作成前にエラーが発生した場合
            raise HTTPException(
                status_code=500,
                detail=f"予期しないエラーが発生しました: {str(e)}"
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


# ============================================================================
# 管理者用APIエンドポイント
# ============================================================================

def get_database_name_from_url(db_url: str) -> str:
    """データベースURLから環境名を取得"""
    if not db_url:
        return "不明"
    
    # 小文字に変換して比較（大文字小文字を区別しない）
    db_url_lower = db_url.lower()
    
    if "dev.db" in db_url_lower or "/dev" in db_url_lower:
        return "dev"
    elif "beta.db" in db_url_lower or "/beta" in db_url_lower:
        return "beta"
    elif "production.db" in db_url_lower or "prod.db" in db_url_lower or "/production" in db_url_lower or "/prod" in db_url_lower:
        return "本番"
    else:
        # URLからファイル名を抽出
        if "/" in db_url:
            parts = db_url.split("/")
            for part in reversed(parts):
                if part.endswith(".db"):
                    filename = part.replace(".db", "")
                    # ファイル名から環境名を推測
                    if "dev" in filename.lower():
                        return "dev"
                    elif "beta" in filename.lower():
                        return "beta"
                    elif "production" in filename.lower() or "prod" in filename.lower():
                        return "本番"
                    return filename
        # デフォルトはdev
        logger.warning(f"Could not determine database name from URL: {db_url}, defaulting to 'dev'")
        return "dev"


def normalize_database_url(db_url: str) -> str:
    """データベースURLを正規化（相対パスと絶対パスを統一）"""
    # sqlite:///./data/dev.db -> sqlite:////data/dev.db
    # sqlite:////data/dev.db -> sqlite:////data/dev.db
    if db_url.startswith("sqlite:///./"):
        # 相対パスを絶対パスに変換
        return db_url.replace("sqlite:///./", "sqlite:////")
    return db_url


def is_valid_sqlite_db(file_path: str) -> bool:
    """SQLiteデータベースファイルが有効かどうかをチェック"""
    import os
    import sqlite3
    
    if not os.path.exists(file_path):
        return False
    
    # ファイルサイズが0の場合は無効
    if os.path.getsize(file_path) == 0:
        return False
    
    # SQLiteヘッダーをチェック
    try:
        with sqlite3.connect(file_path) as conn:
            conn.execute("SELECT 1")
        return True
    except Exception:
        return False


def get_db_file_path_from_url(db_url: str) -> str:
    """DATABASE_URLからファイルパスを抽出"""
    # sqlite:////data/dev.db -> /data/dev.db
    # sqlite:///./data/dev.db -> ./data/dev.db
    if db_url.startswith("sqlite:////"):
        return db_url.replace("sqlite:////", "/")
    elif db_url.startswith("sqlite:///"):
        return db_url.replace("sqlite:///", "")
    return db_url


@app.get("/v1/admin/databases", response_model=AdminDatabaseInfoResponse)
async def get_admin_databases(
    current_admin: User = Depends(get_current_admin),
):
    """管理者用: 利用可能なデータベース一覧を取得"""
    import os
    try:
        # 環境変数から取得（db.pyと同じロジック）
        current_db_url = os.getenv("DATABASE_URL", "sqlite:///./data/dev.db")
        logger.info(f"Current DATABASE_URL: {current_db_url}")
        
        normalized_current_url = normalize_database_url(current_db_url)
        
        # 利用可能なデータベースの候補リスト
        candidate_databases = [
            {
                "name": "dev",
                "url": "sqlite:////data/dev.db",
                "description": "開発環境"
            },
            {
                "name": "beta",
                "url": "sqlite:////data/beta.db",
                "description": "βテスト環境"
            },
            {
                "name": "本番",
                "url": "sqlite:////data/prod.db",
                "description": "本番環境"
            },
        ]
        
        # 実際に存在する有効なDBのみをフィルタリング
        available_databases = []
        for db in candidate_databases:
            file_path = get_db_file_path_from_url(db["url"])
            if is_valid_sqlite_db(file_path):
                available_databases.append(db)
            else:
                logger.info(f"Database not available: {db['name']} ({file_path})")
        
        # 現在のDBの環境名を取得
        current_db_name = get_database_name_from_url(current_db_url)
        logger.info(f"Detected database name: {current_db_name} from URL: {current_db_url}")
        
        # 現在のDBがリストに含まれているか確認し、含まれていない場合は追加
        current_in_list = False
        for db in available_databases:
            normalized_db_url = normalize_database_url(db["url"])
            if normalized_db_url == normalized_current_url:
                current_in_list = True
                # 現在のDBの情報を更新
                db["name"] = current_db_name
                db["description"] = f"現在接続中 ({current_db_name})"
                break
        
        if not current_in_list:
            # 現在のDBが候補にない場合でも、有効なら追加
            current_file_path = get_db_file_path_from_url(current_db_url)
            if is_valid_sqlite_db(current_file_path):
                available_databases.insert(0, {
                    "name": current_db_name,
                    "url": current_db_url,
                    "description": f"現在接続中 ({current_db_name})"
                })
        
        return AdminDatabaseInfoResponse(
            current_database_url=current_db_url,
            available_databases=available_databases
        )
    except Exception as e:
        logger.error(f"Error in get_admin_databases: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"データベース情報の取得に失敗しました: {str(e)}"
        )


@app.get("/v1/admin/users", response_model=AdminUserListResponse)
async def get_admin_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    database_url: Optional[str] = Query(None, description="データベースURL（指定しない場合はデフォルトDB）"),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """管理者用: ユーザー一覧を取得（データベース切り替え対応）"""
    try:
        # データベースURLが指定されている場合は、そのDBを使用
        if database_url:
            # セキュリティチェック: SQLiteファイルのみ許可（相対パスや危険なパスを防ぐ）
            if not database_url.startswith("sqlite:///"):
                raise HTTPException(
                    status_code=400,
                    detail="現在はSQLiteデータベースのみサポートしています"
                )
            # 一時的なセッションを作成
            db_gen = get_db_session_for_url(database_url)
            db = next(db_gen)
            try:
                return await _get_admin_users_internal(db, skip, limit, search, is_active)
            finally:
                try:
                    next(db_gen, None)  # ジェネレータをクリーンアップ
                except StopIteration:
                    pass
        else:
            # デフォルトのDBを使用
            return await _get_admin_users_internal(db, skip, limit, search, is_active)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin users error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"ユーザー一覧の取得に失敗しました: {str(e)}"
        )


async def _get_admin_users_internal(
    db: Session,
    skip: int,
    limit: int,
    search: Optional[str],
    is_active: Optional[bool]
) -> AdminUserListResponse:
    """ユーザー一覧取得の内部実装"""
    query = db.query(User)
    
    # 検索条件
    if search:
        query = query.filter(
            or_(
                User.email.ilike(f"%{search}%"),
                User.name.ilike(f"%{search}%")
            )
        )
    
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    
    # 総数を取得
    total = query.count()
    
    # ページネーション
    users = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()
    
    # 各ユーザーの統計情報を取得
    user_responses = []
    for user in users:
        # 講評数
        review_count = db.query(func.count(Review.id)).filter(Review.user_id == user.id).scalar() or 0
        
        # スレッド数
        thread_count = db.query(func.count(Thread.id)).filter(Thread.user_id == user.id).scalar() or 0
        
        # 短答式セッション数
        short_answer_session_count = db.query(func.count(ShortAnswerSession.id)).filter(
            ShortAnswerSession.user_id == user.id
        ).scalar() or 0
        
        # トークン数・コスト
        token_stats = db.query(
            func.sum(LlmRequest.input_tokens).label('input_tokens'),
            func.sum(LlmRequest.output_tokens).label('output_tokens'),
            func.sum(LlmRequest.cost_yen).label('cost_yen')
        ).filter(LlmRequest.user_id == user.id).first()
        
        total_tokens = (token_stats.input_tokens or 0) + (token_stats.output_tokens or 0) if token_stats else 0
        total_cost_yen = float(token_stats.cost_yen or 0) if token_stats else 0.0
        
        user_responses.append(AdminUserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            is_active=user.is_active,
            is_admin=user.is_admin,
            created_at=user.created_at,
            updated_at=user.updated_at,
            last_login_at=user.last_login_at,
            review_count=review_count,
            thread_count=thread_count,
            short_answer_session_count=short_answer_session_count,
            total_tokens=total_tokens,
            total_cost_yen=total_cost_yen
        ))
    
    return AdminUserListResponse(users=user_responses, total=total)


@app.get("/v1/admin/stats", response_model=AdminStatsResponse)
async def get_admin_stats(
    database_url: Optional[str] = Query(None, description="データベースURL（指定しない場合はデフォルトDB）"),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """管理者用: 全体統計情報を取得（データベース切り替え対応）"""
    try:
        # データベースURLが指定されている場合は、そのDBを使用
        if database_url:
            # セキュリティチェック: SQLiteファイルのみ許可
            if not database_url.startswith("sqlite:///"):
                raise HTTPException(
                    status_code=400,
                    detail="現在はSQLiteデータベースのみサポートしています"
                )
            # 一時的なセッションを作成
            db_gen = get_db_session_for_url(database_url)
            db = next(db_gen)
            try:
                return await _get_admin_stats_internal(db)
            finally:
                try:
                    next(db_gen, None)  # ジェネレータをクリーンアップ
                except StopIteration:
                    pass
        else:
            # デフォルトのDBを使用
            return await _get_admin_stats_internal(db)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin stats error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"統計情報の取得に失敗しました: {str(e)}"
        )


async def _get_admin_stats_internal(db: Session) -> AdminStatsResponse:
    """統計情報取得の内部実装"""
    try:
        # データベース接続テスト
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        from datetime import datetime, timedelta
        from zoneinfo import ZoneInfo
        
        jst = ZoneInfo("Asia/Tokyo")
        utc = ZoneInfo("UTC")
        now_jst = datetime.now(jst)
        now_utc = datetime.now(utc)
        
        # JSTの今日の開始時刻をUTCに変換
        today_start_jst = now_jst.replace(hour=0, minute=0, second=0, microsecond=0)
        today_start_utc = today_start_jst.astimezone(utc)
        
        # JSTの今月の開始時刻をUTCに変換
        month_start_jst = now_jst.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_start_utc = month_start_jst.astimezone(utc)
        
        # ユーザー統計
        total_users = db.query(func.count(User.id)).scalar() or 0
        active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar() or 0
        admin_users = db.query(func.count(User.id)).filter(User.is_admin == True).scalar() or 0
        
        # トークン・コスト統計（全体）
        token_stats = db.query(
            func.sum(LlmRequest.input_tokens).label('input_tokens'),
            func.sum(LlmRequest.output_tokens).label('output_tokens'),
            func.sum(LlmRequest.cost_yen).label('cost_yen')
        ).first()
        
        total_input_tokens = token_stats.input_tokens or 0 if token_stats else 0
        total_output_tokens = token_stats.output_tokens or 0 if token_stats else 0
        total_tokens = total_input_tokens + total_output_tokens
        total_cost_yen = float(token_stats.cost_yen or 0) if token_stats else 0.0
        
        # 今日の統計（UTCでフィルタ）
        today_stats = db.query(
            func.sum(LlmRequest.input_tokens + LlmRequest.output_tokens).label('tokens'),
            func.sum(LlmRequest.cost_yen).label('cost_yen')
        ).filter(LlmRequest.created_at >= today_start_utc).first()
        
        today_tokens = today_stats.tokens or 0 if today_stats else 0
        today_cost_yen = float(today_stats.cost_yen or 0) if today_stats else 0.0
        
        # 今月の統計（UTCでフィルタ）
        month_stats = db.query(
            func.sum(LlmRequest.input_tokens + LlmRequest.output_tokens).label('tokens'),
            func.sum(LlmRequest.cost_yen).label('cost_yen')
        ).filter(LlmRequest.created_at >= month_start_utc).first()
        
        this_month_tokens = month_stats.tokens or 0 if month_stats else 0
        this_month_cost_yen = float(month_stats.cost_yen or 0) if month_stats else 0.0
        
        # 機能別統計
        feature_stats_query = db.query(
            LlmRequest.feature_type,
            func.count(LlmRequest.id).label('count'),
            func.sum(LlmRequest.input_tokens).label('input_tokens'),
            func.sum(LlmRequest.output_tokens).label('output_tokens'),
            func.sum(LlmRequest.cost_yen).label('cost_yen'),
            func.avg(LlmRequest.latency_ms).label('avg_latency')
        ).group_by(LlmRequest.feature_type).all()
        
        feature_stats = {}
        for stat in feature_stats_query:
            feature_stats[stat.feature_type] = {
                "request_count": stat.count or 0,
                "total_tokens": (stat.input_tokens or 0) + (stat.output_tokens or 0),
                "total_input_tokens": stat.input_tokens or 0,
                "total_output_tokens": stat.output_tokens or 0,
                "total_cost_yen": float(stat.cost_yen or 0),
                "avg_latency_ms": float(stat.avg_latency) if stat.avg_latency else None
            }
        
        # アクセス統計
        review_count = db.query(func.count(Review.id)).scalar() or 0
        thread_count = db.query(func.count(Thread.id)).scalar() or 0
        short_answer_session_count = db.query(func.count(ShortAnswerSession.id)).scalar() or 0
        
        return AdminStatsResponse(
            total_users=total_users,
            active_users=active_users,
            admin_users=admin_users,
            total_tokens=total_tokens,
            total_input_tokens=total_input_tokens,
            total_output_tokens=total_output_tokens,
            total_cost_yen=total_cost_yen,
            feature_stats=feature_stats,
            review_count=review_count,
            thread_count=thread_count,
            short_answer_session_count=short_answer_session_count,
            today_tokens=today_tokens,
            today_cost_yen=today_cost_yen,
            this_month_tokens=this_month_tokens,
            this_month_cost_yen=this_month_cost_yen
        )
    except Exception as e:
        logger.error(f"Admin stats internal error: {str(e)}", exc_info=True)
        raise


@app.put("/v1/admin/users/{user_id}", response_model=AdminUserResponse)
async def update_admin_user(
    user_id: int,
    user_update: AdminUserUpdateRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """管理者用: ユーザー情報を更新（管理者権限の付与・剥奪、アクティブ状態の変更）"""
    # 対象ユーザーを取得
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    
    # 自分自身の管理者権限を剥奪しようとしている場合は拒否
    if user_id == current_admin.id and user_update.is_admin is False:
        raise HTTPException(
            status_code=400,
            detail="自分自身の管理者権限を剥奪することはできません"
        )
    
    # 更新
    if user_update.is_active is not None:
        target_user.is_active = user_update.is_active
    
    if user_update.is_admin is not None:
        target_user.is_admin = user_update.is_admin
    
    db.commit()
    db.refresh(target_user)
    
    # 統計情報を取得して返す
    review_count = db.query(func.count(Review.id)).filter(Review.user_id == target_user.id).scalar() or 0
    thread_count = db.query(func.count(Thread.id)).filter(Thread.user_id == target_user.id).scalar() or 0
    short_answer_session_count = db.query(func.count(ShortAnswerSession.id)).filter(
        ShortAnswerSession.user_id == target_user.id
    ).scalar() or 0
    
    token_stats = db.query(
        func.sum(LlmRequest.input_tokens).label('input_tokens'),
        func.sum(LlmRequest.output_tokens).label('output_tokens'),
        func.sum(LlmRequest.total_cost_yen).label('cost_yen')
    ).filter(LlmRequest.user_id == target_user.id).first()
    
    total_tokens = (token_stats.input_tokens or 0) + (token_stats.output_tokens or 0)
    total_cost_yen = float(token_stats.cost_yen or 0)
    
    return AdminUserResponse(
        id=target_user.id,
        email=target_user.email,
        name=target_user.name,
        is_active=target_user.is_active,
        is_admin=target_user.is_admin,
        created_at=target_user.created_at,
        updated_at=target_user.updated_at,
        last_login_at=target_user.last_login_at,
        review_count=review_count,
        thread_count=thread_count,
        short_answer_session_count=short_answer_session_count,
        total_tokens=total_tokens,
        total_cost_yen=total_cost_yen
    )