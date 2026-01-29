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
