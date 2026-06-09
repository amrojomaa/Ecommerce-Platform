from __future__ import annotations

import re
from typing import Optional

from .types import ChatIntent, SearchSessionContext

_PRICE_SIGNAL_RE = [
    re.compile(r"\$\s*\d"),
    re.compile(r"\b(?:under|below|less\s+than|up\s+to|around|about)\s*\$?\s*\d"),
    re.compile(r"\b\d+(?:[.,]\d+)?\s*(?:dollars?|usd)\b"),
]

_PRODUCT_SIGNAL_WORDS = {
    "product", "products", "item", "items", "buy", "purchase", "shop", "shopping",
    "cheap", "cheaper", "expensive", "price", "prices", "cost", "affordable",
    "budget", "show", "find", "search", "discount", "sale", "deal", "stock",
    "catalog", "catalogue", "inventory",
}

_RECOMMENDATION_WORDS = {
    "recommend", "recommends", "recommended", "suggestion", "suggest", "suggests",
    "gift", "ideas", "inspire", "inspiration", "pick", "picks", "best",
}

_POLICY_PATTERNS = [
    re.compile(r"\breturn\s+policy\b"),
    re.compile(r"\brefund(?:\s+policy)?\b"),
    re.compile(r"\bhow\s+(?:do|can)\s+i\s+return\b"),
    re.compile(r"\bshipping\s+policy\b"),
    re.compile(r"\bdelivery\s+policy\b"),
    re.compile(r"\bhow\s+long\s+(?:does|will)\s+(?:shipping|delivery)\b"),
    re.compile(r"\bwarranty\b"),
    re.compile(r"\bcancel(?:lation)?\s+policy\b"),
    re.compile(r"\bprivacy\s+policy\b"),
    re.compile(r"\bterms\s+(?:of\s+service|and\s+conditions)\b"),
    re.compile(r"\bpayment\s+methods?\b"),
    re.compile(r"\bstore\s+hours?\b"),
    re.compile(r"\bcontact\s+support\b"),
]

_EXISTENCE_PATTERNS = [
    re.compile(r"\bdo you have\b"),
    re.compile(r"\bhave you got\b"),
    re.compile(r"\bdo you (?:sell|carry|stock)\b"),
    re.compile(r"\bis there (?:a|an|any)\b"),
    re.compile(r"\b(?:in stock|available)\b"),
]

_FOLLOW_UP_WORDS = {
    "cheaper", "cheapest", "more", "other", "another", "different", "similar",
    "ones", "these", "those", "else", "again", "instead", "alternatives",
}

_CATEGORY_LIST_RE = re.compile(
    r"\b(?:what\s+)?(?:categories|category\s+list|list\s+(?:of\s+)?categories)\b",
    re.IGNORECASE,
)
_CHEAPEST_RE = re.compile(r"\b(cheapest|lowest(?:\s+priced|\s+price)?)\b", re.IGNORECASE)
_EXPENSIVE_RE = re.compile(r"\b(most\s+expensive|highest(?:\s+priced|\s+price)?)\b", re.IGNORECASE)


def _has_price_signal(message_lower: str) -> bool:
    return any(pattern.search(message_lower) for pattern in _PRICE_SIGNAL_RE)


def _has_product_signal(message_lower: str) -> bool:
    if _has_price_signal(message_lower):
        return True
    if any(word in message_lower for word in _PRODUCT_SIGNAL_WORDS):
        return True
    if any(pattern.search(message_lower) for pattern in _EXISTENCE_PATTERNS):
        return True
    return False


def _has_recommendation_signal(message_lower: str) -> bool:
    return any(word in message_lower for word in _RECOMMENDATION_WORDS)


def _has_follow_up_signal(message_lower: str) -> bool:
    return any(word in message_lower for word in _FOLLOW_UP_WORDS)


def _is_policy_question(message_lower: str) -> bool:
    return any(pattern.search(message_lower) for pattern in _POLICY_PATTERNS)


def _had_recent_catalog_context(ctx: SearchSessionContext) -> bool:
    if ctx.last_intent_type in {
        ChatIntent.PRODUCT_SEARCH.value,
        ChatIntent.PRODUCT_RECOMMENDATION.value,
        ChatIntent.PRICE_CHEAPEST.value,
        ChatIntent.PRICE_EXPENSIVE.value,
    }:
        return True
    if ctx.last_result_ids:
        return True
    last = (ctx.last_message or "").lower()
    return any(token in last for token in ("found", "product", "recommend", "cheapest", "expensive"))


def classify_intent(message: str, ctx: Optional[SearchSessionContext] = None) -> ChatIntent:
    """
    Classify user message into catalog, recommendation, policy, or conversation intents.
    """
    message_lower = message.lower().strip()
    ctx = ctx or SearchSessionContext()

    if _CATEGORY_LIST_RE.search(message_lower):
        return ChatIntent.CATEGORY_LIST

    if _CHEAPEST_RE.search(message_lower):
        return ChatIntent.PRICE_CHEAPEST

    if _EXPENSIVE_RE.search(message_lower):
        return ChatIntent.PRICE_EXPENSIVE

    if _is_policy_question(message_lower):
        return ChatIntent.STORE_POLICY

    if _has_follow_up_signal(message_lower) and _had_recent_catalog_context(ctx):
        return ChatIntent.PRODUCT_SEARCH

    has_product = _has_product_signal(message_lower)
    has_recommend = _has_recommendation_signal(message_lower)

    if has_recommend and not has_product:
        return ChatIntent.PRODUCT_RECOMMENDATION

    if has_product:
        if has_recommend and not _has_price_signal(message_lower):
            # "recommend a sofa" still needs catalog path when product nouns exist.
            return ChatIntent.PRODUCT_SEARCH
        return ChatIntent.PRODUCT_SEARCH

    if has_recommend:
        return ChatIntent.PRODUCT_RECOMMENDATION

    return ChatIntent.GENERAL_CONVERSATION
