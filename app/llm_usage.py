import json
import os
import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

_missing_pricing_logged: set[str] = set()


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
    if not model:
        return None
    pricing_map = _load_pricing_map()
    return pricing_map.get(model)


def calculate_cost_yen(
    model: Optional[str],
    input_tokens: Optional[int],
    output_tokens: Optional[int],
) -> Optional[Decimal]:
    if input_tokens is None and output_tokens is None:
        return None
    pricing = _get_model_pricing(model)
    if not pricing:
        if model and model not in _missing_pricing_logged:
            _missing_pricing_logged.add(model)
            logger.warning(
                f"Pricing not found for model '{model}'. "
                "Set LLM_PRICING_YEN_PER_MILLION to enable cost calculation."
            )
        return None
    in_tok = Decimal(int(input_tokens or 0))
    out_tok = Decimal(int(output_tokens or 0))
    per_million = Decimal("1000000")
    cost = (in_tok * pricing["input"] + out_tok * pricing["output"]) / per_million
    return cost.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


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
    cost = calculate_cost_yen(model, input_tokens, output_tokens)
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
        "cost_yen": cost,
        "request_id": request_id,
        "latency_ms": latency_ms,
    }
