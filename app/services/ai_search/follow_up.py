from __future__ import annotations

import re
from typing import List, Optional

from .extraction import extract_price_constraints, extract_product_intent, tokenize_multilingual
from .category_index import CategoryAlias
from .types import ProductSearchIntent, SearchSessionContext

_CHEAPER_RE = re.compile(r"\b(?:cheaper|cheapest|less\s+expensive|lower\s+price)\b", re.IGNORECASE)
_MORE_RE = re.compile(r"\b(?:more|other|another|else|alternatives?)\b", re.IGNORECASE)
_DIFFERENT_RE = re.compile(r"\b(?:different|something\s+else|instead)\b", re.IGNORECASE)
_SIMILAR_RE = re.compile(r"\b(?:similar|like\s+these|like\s+those)\b", re.IGNORECASE)


def _merge_terms(current: List[str], previous: List[str]) -> List[str]:
    merged: List[str] = []
    seen = set()
    for term in current + previous:
        if term not in seen:
            seen.add(term)
            merged.append(term)
    return merged[:12]


def apply_follow_up(
    message: str,
    current: ProductSearchIntent,
    ctx: SearchSessionContext,
    category_aliases: List[CategoryAlias],
) -> ProductSearchIntent:
    """
    Merge the current message with prior search context for refinement queries.
    """
    if not ctx.last_search_intent or not ctx.last_search_intent.is_searchable():
        return current

    previous = ctx.last_search_intent
    message_lower = message.lower()
    merged = ProductSearchIntent.from_dict(previous.to_dict())

    new_prices = extract_price_constraints(message)
    if new_prices["max_price"] is not None:
        merged.max_price = new_prices["max_price"]
        merged.max_price_inclusive = new_prices["max_price_inclusive"]
        merged.exact_price = new_prices["exact_price"]
    if new_prices["min_price"] is not None:
        merged.min_price = new_prices["min_price"]

    if current.category_name:
        merged.category_name = current.category_name
    if current.on_sale_only:
        merged.on_sale_only = True

    if current.query_text or current.query_terms:
        merged.query_text = current.query_text or merged.query_text
        merged.query_terms = _merge_terms(current.query_terms, merged.query_terms)
    elif _SIMILAR_RE.search(message_lower):
        merged.query_terms = previous.query_terms
        merged.query_text = previous.query_text

    if _CHEAPER_RE.search(message_lower):
        anchor_price = _resolve_cheaper_anchor(merged, ctx)
        if anchor_price is not None:
            merged.max_price = anchor_price
            merged.max_price_inclusive = False
            merged.exact_price = None
            if merged.min_price is not None and merged.min_price >= anchor_price:
                merged.min_price = None

    if _MORE_RE.search(message_lower) or _DIFFERENT_RE.search(message_lower):
        merged.exclude_product_ids = list(dict.fromkeys(ctx.last_result_ids))

    if _DIFFERENT_RE.search(message_lower) and not current.query_terms:
        merged.query_terms = []
        merged.query_text = None

    if not merged.is_searchable():
        refreshed = extract_product_intent(message, category_aliases)
        if refreshed.is_searchable():
            return refreshed

    return merged


def _resolve_cheaper_anchor(intent: ProductSearchIntent, ctx: SearchSessionContext) -> Optional[float]:
    if intent.max_price is not None and intent.max_price_inclusive is False:
        return round(intent.max_price * 0.85, 2)

    if intent.max_price is not None:
        return round(intent.max_price * 0.8, 2)

    if ctx.last_result_prices:
        return round(min(ctx.last_result_prices) * 0.95, 2)

    return None


def is_follow_up_message(message: str, ctx: SearchSessionContext) -> bool:
    message_lower = message.lower()
    if not _had_catalog_context(ctx):
        return False
    return bool(
        _CHEAPER_RE.search(message_lower)
        or _MORE_RE.search(message_lower)
        or _DIFFERENT_RE.search(message_lower)
        or _SIMILAR_RE.search(message_lower)
    )


def _had_catalog_context(ctx: SearchSessionContext) -> bool:
    return bool(ctx.last_search_intent and ctx.last_search_intent.is_searchable())
