"""
Rule-based responses when Gemini is unavailable (quota, outage, or no API key).
Also attempts catalog search so users still get product cards.
"""
from __future__ import annotations

import re
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from app import models

from .category_index import load_category_aliases
from .extraction import extract_product_intent
from .responses import format_recommendation_results, format_search_results
from .search import recommend_products, search_products
from .types import ChatIntent, ProductSearchIntent

_GREETING_RE = re.compile(
    r"^\s*(?:hi|hello|hey|good\s+(?:morning|afternoon|evening)|howdy|greetings|"
    r"marhaba|salam|bonjour|salut)\b",
    re.IGNORECASE,
)
_THANKS_RE = re.compile(r"\b(?:thanks|thank\s+you|thx|merci|shukran)\b", re.IGNORECASE)

_POLICY_SNIPPETS = [
    (
        re.compile(r"\breturn|refund\b", re.IGNORECASE),
        (
            "For returns and refunds, please open a support ticket from your account or "
            "contact customer support with your order number. Our team will confirm eligibility "
            "and next steps."
        ),
    ),
    (
        re.compile(r"\bship|shipping|deliver|delivery\b", re.IGNORECASE),
        (
            "Shipping and delivery options depend on your location and order size. "
            "You can review delivery details at checkout, or contact support for help "
            "with a specific order."
        ),
    ),
    (
        re.compile(r"\bwarranty\b", re.IGNORECASE),
        (
            "Warranty coverage varies by product. Check the product page for details, "
            "or contact support with the item name and order number."
        ),
    ),
    (
        re.compile(r"\bcancel\b", re.IGNORECASE),
        (
            "To cancel an order, contact support as soon as possible with your order number. "
            "Orders already shipped may need to follow the return process instead."
        ),
    ),
    (
        re.compile(r"\bpayment|pay\b", re.IGNORECASE),
        (
            "We accept standard online payment methods shown at checkout. "
            "If a payment fails, try again or contact support for assistance."
        ),
    ),
    (
        re.compile(r"\bprivacy\b", re.IGNORECASE),
        (
            "We handle personal data according to our privacy policy. "
            "Contact support if you have questions about your account data."
        ),
    ),
]


def _greeting_reply() -> str:
    return (
        "Hello! I'm your shopping assistant. I can search our catalog by product name, "
        "category, or budget — for example, “tables under $200” or “what do you recommend?”"
    )


def _thanks_reply() -> str:
    return (
        "You're welcome! If you need anything else, ask about products, categories, "
        "or prices and I'll search the store for you."
    )


def _policy_reply(message: str) -> str:
    for pattern, answer in _POLICY_SNIPPETS:
        if pattern.search(message):
            return answer
    return (
        "I can point you to the right place for store policies. For returns, shipping, "
        "payments, or order issues, please contact customer support or open a ticket "
        "from your account — include your order number when you have one."
    )


def _general_reply() -> str:
    return (
        "I'm running in catalog mode right now. Tell me what you're looking for — "
        "a product name, category, or price range — and I'll search the store. "
        "Examples: “sofas under $500”, “cheapest item”, or “what categories do you have?”"
    )


def try_catalog_assist(
    db: Session,
    message: str,
    *,
    prefer_recommendation: bool = False,
) -> Tuple[Optional[str], List[models.DBProduct]]:
    """
    Attempt a catalog search/recommendation without Gemini.
    Returns (message, products) or (None, []) if nothing applicable.
    """
    aliases = load_category_aliases(db)
    intent = extract_product_intent(message, aliases)

    if prefer_recommendation and not intent.is_searchable():
        products = recommend_products(db, intent)
        if products:
            return format_recommendation_results(products), products
        return None, []

    if not intent.is_searchable():
        return None, []

    products = search_products(db, intent)
    if products:
        return format_search_results(products, intent), products

    return None, []


def offline_reply(
    db: Session,
    message: str,
    intent_type: ChatIntent,
) -> Tuple[str, List[models.DBProduct]]:
    """
    Produce a helpful response without calling Gemini.
    """
    if intent_type == ChatIntent.STORE_POLICY:
        catalog_msg, products = try_catalog_assist(db, message)
        if catalog_msg and products:
            return catalog_msg, products
        return _policy_reply(message), []

    if _GREETING_RE.search(message):
        return _greeting_reply(), []

    if _THANKS_RE.search(message):
        return _thanks_reply(), []

    catalog_msg, products = try_catalog_assist(
        db,
        message,
        prefer_recommendation=intent_type == ChatIntent.PRODUCT_RECOMMENDATION,
    )
    if catalog_msg:
        return catalog_msg, products

    if intent_type == ChatIntent.PRODUCT_RECOMMENDATION:
        products = recommend_products(db, ProductSearchIntent())
        if products:
            return format_recommendation_results(products), products

    return _general_reply(), []
