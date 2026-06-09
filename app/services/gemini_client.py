"""
Gemini client with model fallback, quota circuit breaker, and offline handoff.

Prefers lighter models (gemini-2.5-flash-lite) to stay within free-tier limits.
"""
from __future__ import annotations

import os
import time
from typing import Dict, List, Optional

import google.generativeai as genai

gemini_api_key = os.getenv("GEMINI_API_KEY", "")

if gemini_api_key:
    genai.configure(api_key=gemini_api_key)

_CONVERSATION_MAX_OUTPUT_TOKENS = 512

# Lighter models first — they have separate quota pools on the free tier.
_DEFAULT_MODEL_CHAIN: List[str] = [
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
]

_env_model = os.getenv("GEMINI_MODEL", "").strip()
# Always try lite models first (separate free-tier quota); honour GEMINI_MODEL after them.
MODEL_CHAIN: List[str] = list(
    dict.fromkeys([*_DEFAULT_MODEL_CHAIN, _env_model] if _env_model else _DEFAULT_MODEL_CHAIN)
)

_model_cache: Dict[str, genai.GenerativeModel] = {}
_model_cooldown_until: Dict[str, float] = {}
_global_cooldown_until: float = 0.0
_last_working_model: Optional[str] = None

GLOBAL_COOLDOWN_SECONDS = float(os.getenv("GEMINI_COOLDOWN_SEC", "300"))
MODEL_COOLDOWN_SECONDS = float(os.getenv("GEMINI_MODEL_COOLDOWN_SEC", "120"))


def _is_quota_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return (
        "429" in str(exc)
        or "quota" in msg
        or "resource exhausted" in msg
        or ("rate" in msg and "limit" in msg)
    )


def _is_model_not_found(exc: Exception) -> bool:
    msg = str(exc).lower()
    return "404" in str(exc) or "not found" in msg or "not supported" in msg


def _get_model(model_name: str, system_instruction: Optional[str] = None) -> genai.GenerativeModel:
    cache_key = f"{model_name}::{hash(system_instruction or '')}"
    if cache_key not in _model_cache:
        try:
            _model_cache[cache_key] = genai.GenerativeModel(
                model_name,
                system_instruction=system_instruction,
            )
        except Exception:
            _model_cache[cache_key] = genai.GenerativeModel(model_name)
    return _model_cache[cache_key]


def _models_to_try() -> List[str]:
    if _last_working_model:
        ordered = [_last_working_model] + [m for m in MODEL_CHAIN if m != _last_working_model]
        return ordered
    return list(MODEL_CHAIN)


def _gemini_response_truncated(response) -> bool:
    try:
        finish_reason = response.candidates[0].finish_reason
        if hasattr(finish_reason, "name"):
            return finish_reason.name == "MAX_TOKENS"
        reason_text = str(finish_reason).upper()
        return "MAX_TOKENS" in reason_text or finish_reason == 2
    except (AttributeError, IndexError, TypeError):
        return False


def _trim_to_last_complete_sentence(text: str) -> str:
    if not text or text[-1] in ".!?":
        return text
    best_end = -1
    for punct in ".!?":
        idx = text.rfind(punct)
        if idx > best_end:
            best_end = idx
    if best_end >= max(len(text) // 4, 20):
        return text[: best_end + 1].strip()
    return text.rstrip(".,;:- ") + "."


def is_gemini_available() -> bool:
    if not gemini_api_key:
        return False
    return time.monotonic() >= _global_cooldown_until


def generate_chat_reply(
    message: str,
    conversation_history: Optional[List[Dict]] = None,
    *,
    policy_mode: bool = False,
) -> Optional[str]:
    """
    Call Gemini with model fallback. Returns None when all models are unavailable
    (quota exhausted or no API key) so the caller can use offline fallback.
    """
    global _last_working_model, _global_cooldown_until

    if not gemini_api_key:
        return None

    now = time.monotonic()
    if now < _global_cooldown_until:
        return None

    if policy_mode:
        system_instruction = (
            "You are a helpful AI assistant for an e-commerce store. "
            "Answer questions about store policies such as returns, refunds, shipping, "
            "delivery, warranties, cancellations, privacy, and payment methods. "
            "Do not invent specific policy details you were not given. "
            "If unsure, suggest contacting customer support. "
            "Never invent products, prices, or inventory. "
            "Keep replies concise and end with a complete sentence."
        )
    else:
        system_instruction = (
            "You are a friendly and helpful AI assistant for an e-commerce store. "
            "You can help with general questions. For product availability, prices, or "
            "recommendations, users should search the catalog directly in chat. "
            "Never invent products, prices, or stock levels. "
            "Keep replies concise and end with a complete sentence."
        )

    chat_history = []
    if conversation_history:
        for msg in conversation_history[-5:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "user":
                chat_history.append({"role": "user", "parts": [content]})
            elif role == "assistant":
                chat_history.append({"role": "model", "parts": [content]})

    quota_failures = 0
    for model_name in _models_to_try():
        if now < _model_cooldown_until.get(model_name, 0):
            continue

        try:
            model = _get_model(model_name, system_instruction)
            chat = model.start_chat(history=chat_history)
            response = chat.send_message(
                message,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=_CONVERSATION_MAX_OUTPUT_TOKENS,
                    temperature=0.7,
                ),
            )
            reply = (response.text or "").strip()
            if not reply:
                continue
            if _gemini_response_truncated(response):
                reply = _trim_to_last_complete_sentence(reply)
            _last_working_model = model_name
            return reply
        except Exception as exc:
            if _is_quota_error(exc):
                quota_failures += 1
                _model_cooldown_until[model_name] = time.monotonic() + MODEL_COOLDOWN_SECONDS
                continue
            if _is_model_not_found(exc):
                _model_cooldown_until[model_name] = time.monotonic() + 3600
                continue
            continue

    if quota_failures > 0:
        _global_cooldown_until = time.monotonic() + GLOBAL_COOLDOWN_SECONDS

    return None
