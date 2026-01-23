"""LLM設定管理（API Keyとモデルの一元管理）"""
import os
from pathlib import Path
from typing import Optional
from anthropic import Anthropic

# .envファイルの読み込み（python-dotenvがインストールされている場合）
try:
    from dotenv import load_dotenv
    # プロジェクトルートの.envファイルを読み込む
    # コンテナ内では /app/.env にマウントされている可能性があるため、両方を試す
    env_paths = [
        Path(__file__).parent.parent / ".env",  # ローカル開発環境
        Path("/app/.env"),  # Dockerコンテナ内
    ]
    for env_path in env_paths:
        if env_path.exists():
            # NOTE: override=False で既存の環境変数を上書きしない
            load_dotenv(env_path, override=False)
            break
except ImportError:
    # python-dotenvがインストールされていない場合はスキップ
    pass

# 用途の定義
USE_CASE_REVIEW = "review"  # 答案の講評生成
USE_CASE_REVIEW_CHAT = "review_chat"  # 講評に関するチャット
USE_CASE_FREE_CHAT = "free_chat"  # フリーチャット
USE_CASE_REVISIT_PROBLEMS = "revisit_problems"  # 復習問題生成
USE_CASE_TITLE = "title"  # タイトル生成


class LLMConfig:
    """
    LLM設定管理クラス（シングルトン）
    API Keyとモデルを一箇所で管理し、用途別にモデルを切り替え可能
    """
    _instance: Optional['LLMConfig'] = None
    _client: Optional[Anthropic] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        
        # API Keyを取得
        self.api_key = os.getenv("ANTHROPIC_API_KEY")
        
        # デフォルトモデル
        self.default_model = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
        
        # 用途別モデル設定（環境変数が未設定または空文字列の場合はデフォルトを使用）
        def get_model_or_default(env_var_name: str) -> str:
            value = os.getenv(env_var_name)
            return value if value and value.strip() else self.default_model
        
        self.models = {
            USE_CASE_REVIEW: get_model_or_default("ANTHROPIC_MODEL_REVIEW"),
            USE_CASE_REVIEW_CHAT: get_model_or_default("ANTHROPIC_MODEL_REVIEW_CHAT"),
            USE_CASE_FREE_CHAT: get_model_or_default("ANTHROPIC_MODEL_FREE_CHAT"),
            USE_CASE_REVISIT_PROBLEMS: get_model_or_default("ANTHROPIC_MODEL_REVISIT_PROBLEMS"),
            USE_CASE_TITLE: get_model_or_default("ANTHROPIC_MODEL_TITLE"),
        }
        
        self._initialized = True

    def get_client(self) -> Optional[Anthropic]:
        """
        Anthropicクライアントを取得（シングルトン）
        
        Returns:
            Anthropicクライアント（API Keyが設定されていない場合はNone）
        """
        if not self.api_key:
            return None
        
        if self._client is None:
            self._client = Anthropic(api_key=self.api_key)
        
        return self._client

    def get_model(self, use_case: str = "default") -> str:
        """
        用途に応じたモデル名を取得
        
        Args:
            use_case: 用途（USE_CASE_* 定数を使用）
        
        Returns:
            モデル名（デフォルトモデルを返す）
        """
        return self.models.get(use_case, self.default_model)

    def is_available(self) -> bool:
        """
        LLM機能が利用可能かどうか
        
        Returns:
            API Keyが設定されている場合はTrue
        """
        return bool(self.api_key)


# グローバルインスタンス（後方互換性のため）
_llm_config = LLMConfig()


def get_llm_config() -> LLMConfig:
    """
    LLM設定インスタンスを取得
    
    Returns:
        LLMConfigインスタンス
    """
    return _llm_config


def get_llm_client() -> Optional[Anthropic]:
    """
    LLMクライアントを取得（後方互換性のため）
    
    Returns:
        Anthropicクライアント（API Keyが設定されていない場合はNone）
    """
    return _llm_config.get_client()


def get_llm_model(use_case: str = "default") -> str:
    """
    用途に応じたモデル名を取得（後方互換性のため）
    
    Args:
        use_case: 用途（USE_CASE_* 定数を使用）
    
    Returns:
        モデル名
    """
    return _llm_config.get_model(use_case)
