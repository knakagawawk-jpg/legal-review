"""アプリケーション設定"""
import os
from pathlib import Path

# .envファイルの読み込み（python-dotenvがインストールされている場合）
try:
    from dotenv import load_dotenv
    # プロジェクトルートの.envファイルを読み込む
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        # NOTE:
        # 本番では docker-compose の env_file などで環境変数が注入される前提。
        # .env 側が空（ANTHROPIC_API_KEY= のように空文字）だと override=True により
        # 実行プロセス内の環境変数が空で上書きされ、LLMが「未設定扱い」になる。
        # そのため、既存の環境変数を空で上書きしないよう override=False にする。
        load_dotenv(env_path, override=False)
except ImportError:
    # python-dotenvがインストールされていない場合はスキップ
    pass

# FastAPIのベースURL（環境変数で設定可能、デフォルトはlocalhost:8000）
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")

# Anthropic API設定
# 注意: モデル名はユーザーが明示的に指定したものです。AIが勝手に変更しないでください。
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")

# 認証設定（デフォルトはOFF）
AUTH_ENABLED = os.getenv("AUTH_ENABLED", "false").lower() == "true"
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
SECRET_KEY = os.getenv("SECRET_KEY", "change-this-secret-key-in-production")
ALGORITHM = "HS256"

# トークン検証キャッシュ設定
TOKEN_CACHE_TTL = int(os.getenv("TOKEN_CACHE_TTL", "300"))  # デフォルト5分（秒）
TOKEN_CACHE_MAX_SIZE = int(os.getenv("TOKEN_CACHE_MAX_SIZE", "1000"))  # デフォルト1000エントリ

# JWTトークン設定
JWT_ACCESS_TOKEN_EXPIRE_DAYS = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_DAYS", "30"))  # デフォルト30日

# 管理者2段階認証（TOTP）設定
ADMIN_2FA_ENABLED = os.getenv("ADMIN_2FA_ENABLED", "false").lower() == "true"
ADMIN_2FA_EMAIL = os.getenv("ADMIN_2FA_EMAIL", "note.shihoushiken@gmail.com").lower()
ADMIN_2FA_TOTP_SECRET = os.getenv("ADMIN_2FA_TOTP_SECRET")
ADMIN_2FA_TOTP_VALID_WINDOW = int(os.getenv("ADMIN_2FA_TOTP_VALID_WINDOW", "1"))

# 環境判定
APP_ENV = os.getenv("APP_ENV", "").lower()
NODE_ENV = os.getenv("NODE_ENV", "").lower()
ENABLE_DEV_PAGE = os.getenv("ENABLE_DEV_PAGE", "false").lower() == "true"
IS_DEV_ENV = APP_ENV == "dev" or NODE_ENV == "development" or ENABLE_DEV_PAGE

# プラン制限有効/無効（未指定時: devは無効、それ以外は有効）
PLAN_LIMITS_ENABLED = os.getenv(
    "PLAN_LIMITS_ENABLED",
    "false" if IS_DEV_ENV else "true",
).lower() == "true"

# Stripe設定（課金）
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
STRIPE_REVIEW_TICKET_PRICE_YEN = int(os.getenv("STRIPE_REVIEW_TICKET_PRICE_YEN", "500"))
STRIPE_REVIEW_TICKET_PRODUCT_NAME = os.getenv("STRIPE_REVIEW_TICKET_PRODUCT_NAME", "Review追加チケット")
STRIPE_BASIC_PLAN_PRICE_YEN = int(os.getenv("STRIPE_BASIC_PLAN_PRICE_YEN", "3980"))
STRIPE_HIGH_PLAN_PRICE_YEN = int(os.getenv("STRIPE_HIGH_PLAN_PRICE_YEN", "7200"))
STRIPE_FIRST_MONTH_FM_DM_PRICE_YEN = int(os.getenv("STRIPE_FIRST_MONTH_FM_DM_PRICE_YEN", "1000"))
STRIPE_BASIC_PLAN_PRICE_ID = os.getenv("STRIPE_BASIC_PLAN_PRICE_ID", "")
STRIPE_HIGH_PLAN_PRICE_ID = os.getenv("STRIPE_HIGH_PLAN_PRICE_ID", "")
STRIPE_FIRST_MONTH_FM_DM_PRICE_ID = os.getenv("STRIPE_FIRST_MONTH_FM_DM_PRICE_ID", "")
FM_DM_SIGNUP_LINK = os.getenv("FM_DM_SIGNUP_LINK", "https://juristutor-ai.com/signup/fm-dm-first-month")

# β環境メール制限設定
# BETA_EMAIL_RESTRICTION_ENABLED=true の場合、許可リストにあるメールアドレスのみ新規登録可能
BETA_EMAIL_RESTRICTION_ENABLED = os.getenv("BETA_EMAIL_RESTRICTION_ENABLED", "false").lower() == "true"

def load_allowed_beta_emails() -> set:
    """
    β環境で許可されたメールアドレスのリストを読み込む
    config/allowed_beta_emails.txt から読み込み
    """
    allowed_emails = set()
    emails_file = Path(__file__).parent / "allowed_beta_emails.txt"
    
    if not emails_file.exists():
        return allowed_emails
    
    try:
        with open(emails_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                # 空行とコメント行をスキップ
                if line and not line.startswith('#'):
                    allowed_emails.add(line.lower())  # 小文字で統一
    except Exception:
        pass
    
    return allowed_emails

# 起動時に許可メールリストをロード
ALLOWED_BETA_EMAILS = load_allowed_beta_emails()

# デバッグ: 起動時に設定状態をログ出力
import logging
_settings_logger = logging.getLogger(__name__)
_settings_logger.info(f"BETA_EMAIL_RESTRICTION_ENABLED: {BETA_EMAIL_RESTRICTION_ENABLED}")
_settings_logger.info(f"ALLOWED_BETA_EMAILS count: {len(ALLOWED_BETA_EMAILS)}")
if ALLOWED_BETA_EMAILS:
    _settings_logger.info(f"ALLOWED_BETA_EMAILS: {ALLOWED_BETA_EMAILS}")
