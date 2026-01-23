import json
import os
import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Dict, Any, Tuple

logger = logging.getLogger(__name__)

_missing_pricing_logged: set[str] = set()

# 料金体系（1$=160円換算）
# 単位: 円/1,000,000トークン
_PRICING_MAP: Dict[str, Dict[str, Decimal]] = {
    # Opus 4.5: 入力 $5/MTok = 800円/MTok, 出力 $25/MTok = 4000円/MTok
    "opus": {"input": Decimal("800"), "output": Decimal("4000")},
    # Sonnet 4.5: 入力 $3/MTok = 480円/MTok, 出力 $15/MTok = 2400円/MTok
    "sonnet": {"input": Decimal("480"), "output": Decimal("2400")},
    # Haiku 4.5: 入力 $1/MTok = 160円/MTok, 出力 $5/MTok = 800円/MTok
    "haiku": {"input": Decimal("160"), "output": Decimal("800")},
}


def _get_model_type(model: Optional[str]) -> Optional[str]:
    """
    モデル名からモデルタイプ（opus/sonnet/haiku）を判定
    
    Args:
        model: モデル名（例: "claude-haiku-4-5-20251001"）
    
    Returns:
        モデルタイプ（"opus", "sonnet", "haiku"）またはNone
    """
    if not model:
        return None
    model_lower = model.lower()
    if "opus" in model_lower:
        return "opus"
    elif "sonnet" in model_lower:
        return "sonnet"
    elif "haiku" in model_lower:
        return "haiku"
    return None


def _get_default_pricing(model: Optional[str]) -> Optional[Dict[str, Decimal]]:
    """
    デフォルトの料金体系から料金を取得
    
    Args:
        model: モデル名
    
    Returns:
        料金情報（{"input": Decimal, "output": Decimal}）またはNone
    """
    model_type = _get_model_type(model)
    if model_type:
        return _PRICING_MAP.get(model_type)
    return None


def _load_pricing_map() -> Dict[str, Dict[str, Decimal]]:
    """
    Load pricing map from env.

    Expected env: LLM_PRICING_YEN_PER_MILLION
    Example:
      {
        "claude-haiku-4-5-20251001": {"input": 0.5, "output": 2.0}
      }
    Values are in JPY per 1,000,000 tokens.
    """
    raw = (os.getenv("LLM_PRICING_YEN_PER_MILLION") or "").strip()
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except Exception as e:
        logger.warning(f"Invalid LLM_PRICING_YEN_PER_MILLION JSON: {e}")
        return {}
    out: Dict[str, Dict[str, Decimal]] = {}
    if not isinstance(data, dict):
        return out
    for model, rates in data.items():
        if not isinstance(rates, dict):
            continue
        inp = rates.get("input")
        outp = rates.get("output")
        try:
            inp_d = Decimal(str(inp)) if inp is not None else None
            out_d = Decimal(str(outp)) if outp is not None else None
        except Exception:
            continue
        if inp_d is None or out_d is None:
            continue
        out[str(model)] = {"input": inp_d, "output": out_d}
    return out


def _get_model_pricing(model: Optional[str]) -> Optional[Dict[str, Decimal]]:
    """
    モデルの料金情報を取得（環境変数優先、なければデフォルト料金体系）
    
    Args:
        model: モデル名
    
    Returns:
        料金情報（{"input": Decimal, "output": Decimal}）またはNone
    """
    if not model:
        return None
    # まず環境変数から読み込む（既存の仕組み）
    pricing_map = _load_pricing_map()
    if model in pricing_map:
        return pricing_map[model]
    # 環境変数にない場合はデフォルト料金体系を使用
    return _get_default_pricing(model)


def calculate_cost_yen(
    model: Optional[str],
    input_tokens: Optional[int],
    output_tokens: Optional[int],
) -> Optional[Decimal]:
    """
    合計コスト（円）を計算
    
    Args:
        model: モデル名
        input_tokens: 入力トークン数
        output_tokens: 出力トークン数
    
    Returns:
        合計コスト（円）またはNone
    """
    result = calculate_cost_yen_split(model, input_tokens, output_tokens)
    if result is None:
        return None
    input_cost, output_cost = result
    if input_cost is None and output_cost is None:
        return None
    total = (input_cost or Decimal("0")) + (output_cost or Decimal("0"))
    return total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calculate_cost_yen_split(
    model: Optional[str],
    input_tokens: Optional[int],
    output_tokens: Optional[int],
) -> Optional[Tuple[Optional[Decimal], Optional[Decimal]]]:
    """
    入力コストと出力コストを分けて計算（円）
    
    Args:
        model: モデル名
        input_tokens: 入力トークン数
        output_tokens: 出力トークン数
    
    Returns:
        (入力コスト（円）, 出力コスト（円）) のタプル、またはNone
    """
    if input_tokens is None and output_tokens is None:
        return None
    pricing = _get_model_pricing(model)
    if not pricing:
        if model and model not in _missing_pricing_logged:
            _missing_pricing_logged.add(model)
            logger.warning(
                f"Pricing not found for model '{model}'. "
                "Using default pricing or set LLM_PRICING_YEN_PER_MILLION to override."
            )
        return None
    per_million = Decimal("1000000")
    input_cost = None
    output_cost = None
    if input_tokens is not None:
        in_tok = Decimal(int(input_tokens))
        input_cost = (in_tok * pricing["input"] / per_million).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
    if output_tokens is not None:
        out_tok = Decimal(int(output_tokens))
        output_cost = (out_tok * pricing["output"] / per_million).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
    return (input_cost, output_cost)


def calculate_cost_usd_split(
    model: Optional[str],
    input_tokens: Optional[int],
    output_tokens: Optional[int],
) -> Optional[Tuple[Optional[Decimal], Optional[Decimal]]]:
    """
    入力コストと出力コストを分けて計算（ドル）
    
    Args:
        model: モデル名
        input_tokens: 入力トークン数
        output_tokens: 出力トークン数
    
    Returns:
        (入力コスト（ドル）, 出力コスト（ドル）) のタプル、またはNone
    """
    # 円換算の結果を取得
    yen_result = calculate_cost_yen_split(model, input_tokens, output_tokens)
    if yen_result is None:
        return None
    input_cost_yen, output_cost_yen = yen_result
    
    # 1$ = 160円で換算
    usd_rate = Decimal("160")
    input_cost_usd = None
    output_cost_usd = None
    if input_cost_yen is not None:
        input_cost_usd = (input_cost_yen / usd_rate).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )
    if output_cost_yen is not None:
        output_cost_usd = (output_cost_yen / usd_rate).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )
    return (input_cost_usd, output_cost_usd)


def build_llm_request_row(
    *,
    user_id: int,
    feature_type: str,
    review_id: Optional[int] = None,
    thread_id: Optional[int] = None,
    session_id: Optional[int] = None,
    model: Optional[str] = None,
    prompt_version: Optional[str] = None,
    input_tokens: Optional[int] = None,
    output_tokens: Optional[int] = None,
    request_id: Optional[str] = None,
    latency_ms: Optional[int] = None,
) -> Dict[str, Any]:
    """
    LLMリクエスト行を構築（コスト情報を含む）
    
    Returns:
        LLMリクエスト行の辞書（input_cost_yen, output_cost_yen, cost_yenを含む）
    """
    cost = calculate_cost_yen(model, input_tokens, output_tokens)
    cost_split = calculate_cost_yen_split(model, input_tokens, output_tokens)
    input_cost_yen = None
    output_cost_yen = None
    if cost_split:
        input_cost_yen, output_cost_yen = cost_split
    return {
        "user_id": user_id,
        "feature_type": feature_type,
        "review_id": review_id,
        "thread_id": thread_id,
        "session_id": session_id,
        "model": model,
        "prompt_version": prompt_version,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "input_cost_yen": input_cost_yen,
        "output_cost_yen": output_cost_yen,
        "cost_yen": cost,
        "request_id": request_id,
        "latency_ms": latency_ms,
    }
