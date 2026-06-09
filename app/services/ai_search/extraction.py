from __future__ import annotations

import re
import string
from typing import List, Optional, Set

from .category_index import CategoryAlias, match_category
from .types import ProductSearchIntent

_TOKEN_RE = re.compile(r"[^\W_]+", re.UNICODE)

_NAME_STOP_WORDS: Set[str] = {
    "show", "find", "search", "want", "need", "looking", "for", "the", "a", "an", "is", "are",
    "there", "here", "this", "that", "these", "those", "what", "which", "who", "when", "where",
    "why", "how", "do", "does", "did", "have", "has", "had", "can", "could", "would", "should",
    "will", "with", "from", "your", "our", "any", "some", "about", "into", "onto", "called",
    "named", "product", "products", "item", "items", "like", "just", "also", "only", "very",
    "much", "more", "most", "other", "please", "tell", "me", "know", "if", "we", "you", "they",
    "book", "books", "something", "anything", "store", "shop", "inventory", "stock", "still",
    "price", "prices", "priced", "pricing", "cost", "costs", "buck", "bucks", "usd", "pay", "budget",
    "dollar", "dollars", "than", "less", "under", "below", "max", "maximum", "around", "about",
    "cheap", "cheaper", "cheapest", "expensive", "lowest", "highest", "recommend", "recommends",
    "recommended", "suggest", "suggestion", "best", "good", "nice", "ones", "one", "another",
    "different", "similar", "sale", "discount", "discounted", "deal", "deals", "available",
    "buy", "purchase", "shopping", "catalog", "catalogue", "category", "categories",
}

_AR_FR_STOP_WORDS: Set[str] = {
    "في", "من", "على", "إلى", "الى", "عن", "هل", "ما", "مع", "هذا", "هذه", "ذلك", "تلك",
    "أريد", "اريد", "ابحث", "عرض", "منتج", "منتجات", "رخيص", "رخيصة",
    "je", "tu", "le", "la", "les", "des", "un", "une", "pour", "avec", "dans", "sur", "est",
    "cher", "chère", "pas", "très", "tres", "produit", "produits", "recherche", "montre",
}

_PRICE_NOISE_TOKENS = _NAME_STOP_WORDS | {
    "price", "prices", "priced", "pricing", "cost", "costs", "buck", "bucks", "usd",
    "dollar", "dollars", "pay", "budget", "under", "below", "max", "maximum",
}


def tokenize_multilingual(text: str, *, min_len: int = 2) -> List[str]:
    tokens = [t.lower() for t in _TOKEN_RE.findall(text or "") if len(t) >= min_len]
    return tokens


def _is_price_like_token(token: str) -> bool:
    t = token.strip().lower()
    if not t:
        return False
    if re.fullmatch(r"\$?\d+(?:\.\d+)?(?:usd|dollars?|bucks?)?", t):
        return True
    if re.fullmatch(r"\d+(?:\.\d+)?\$", t):
        return True
    return False


def _parse_price_value(raw: str) -> Optional[float]:
    try:
        value = float(raw.replace(",", "."))
    except (TypeError, ValueError):
        return None
    if value < 0:
        return None
    return value


def extract_explicit_product_title(text: str) -> Optional[str]:
    patterns = [
        r"(?:product|products|item|items|book|books)\s+called\s+(.+)$",
        r"(?:product|products|item|items|book|books)\s+named\s+(.+)$",
        r"\bcalled\s+(.+)$",
        r"\bnamed\s+(.+)$",
        r"\btitled\s+(.+)$",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if not match:
            continue
        name = match.group(1).strip().strip("\"'" + string.whitespace)
        name = name.rstrip("?.!").strip()
        name = re.sub(r"\s+", " ", name)
        if len(name) >= 2:
            return name
    quoted = re.search(r'["\']([^"\']{2,})["\']', text)
    if quoted:
        return quoted.group(1).strip()
    return None


def extract_price_constraints(message: str) -> dict:
    message_lower = message.lower()
    result = {
        "min_price": None,
        "max_price": None,
        "max_price_inclusive": True,
        "exact_price": None,
    }

    exact_patterns = [
        r"\b(?:price|priced|cost|costs?)\s*(?:is|=|of|at)?\s*\$?\s*(\d+(?:[.,]\d+)?)\s*\$?\b",
        r"\bfor\s*\$?\s*(\d+(?:[.,]\d+)?)\s*\$?\b",
    ]
    for pattern in exact_patterns:
        match = re.search(pattern, message_lower)
        if match:
            exact_price = _parse_price_value(match.group(1))
            if exact_price is not None:
                result["exact_price"] = exact_price
                result["min_price"] = exact_price
                result["max_price"] = exact_price
                result["max_price_inclusive"] = True
                return result

    strict_patterns = [
        r"under\s*\$?\s*(\d+(?:[.,]\d+)?)",
        r"below\s*\$?\s*(\d+(?:[.,]\d+)?)",
        r"less\s*than\s*\$?\s*(\d+(?:[.,]\d+)?)",
        r"at\s+most\s*\$?\s*(\d+(?:[.,]\d+)?)",
    ]
    inclusive_patterns = [
        r"\$(\d+(?:[.,]\d+)?)",
        r"(\d+(?:[.,]\d+)?)\s*\$",
        r"(\d+(?:[.,]\d+)?)\s*dollars?",
        r"(\d+(?:[.,]\d+)?)\s*usd",
        r"max\s*\$?\s*(\d+(?:[.,]\d+)?)",
        r"maximum\s*\$?\s*(\d+(?:[.,]\d+)?)",
        r"up\s+to\s*\$?\s*(\d+(?:[.,]\d+)?)",
        r"around\s*\$?\s*(\d+(?:[.,]\d+)?)",
        r"about\s*\$?\s*(\d+(?:[.,]\d+)?)",
    ]

    strict_prices: List[float] = []
    for pattern in strict_patterns:
        strict_prices.extend(
            value
            for value in (_parse_price_value(m.group(1)) for m in re.finditer(pattern, message_lower))
            if value is not None
        )

    inclusive_prices: List[float] = []
    for pattern in inclusive_patterns:
        inclusive_prices.extend(
            value
            for value in (_parse_price_value(m.group(1)) for m in re.finditer(pattern, message_lower))
            if value is not None
        )

    if strict_prices:
        result["max_price"] = min(strict_prices)
        result["max_price_inclusive"] = False
    elif inclusive_prices:
        result["max_price"] = min(inclusive_prices)
        result["max_price_inclusive"] = True

    min_patterns = [
        r"over\s*\$?\s*(\d+(?:[.,]\d+)?)",
        r"above\s*\$?\s*(\d+(?:[.,]\d+)?)",
        r"more\s+than\s*\$?\s*(\d+(?:[.,]\d+)?)",
        r"at\s+least\s*\$?\s*(\d+(?:[.,]\d+)?)",
        r"min(?:imum)?\s*\$?\s*(\d+(?:[.,]\d+)?)",
    ]
    min_prices: List[float] = []
    for pattern in min_patterns:
        min_prices.extend(
            value
            for value in (_parse_price_value(m.group(1)) for m in re.finditer(pattern, message_lower))
            if value is not None
        )
    if min_prices:
        result["min_price"] = max(min_prices)

    return result


def _meaningful_terms(tokens: List[str]) -> List[str]:
    terms: List[str] = []
    for token in tokens:
        if token in _NAME_STOP_WORDS or token in _AR_FR_STOP_WORDS:
            continue
        if _is_price_like_token(token):
            continue
        if token.isdigit():
            continue
        terms.append(token)
    return terms


def _terms_are_price_noise(terms: List[str]) -> bool:
    if not terms:
        return True
    return all(
        t in _PRICE_NOISE_TOKENS or (t.isdigit() and len(t) <= 6)
        for t in terms
    )


def extract_product_intent(
    message: str,
    category_aliases: List[CategoryAlias],
) -> ProductSearchIntent:
    message_lower = message.lower()
    intent = ProductSearchIntent()

    price_data = extract_price_constraints(message)
    intent.min_price = price_data["min_price"]
    intent.max_price = price_data["max_price"]
    intent.max_price_inclusive = price_data["max_price_inclusive"]
    intent.exact_price = price_data["exact_price"]

    intent.category_name = match_category(message, category_aliases)

    if re.search(r"\b(?:on sale|discounted|discount|deal|deals|sale)\b", message_lower):
        intent.on_sale_only = True

    explicit_title = extract_explicit_product_title(message)
    if explicit_title:
        intent.query_text = explicit_title
        intent.query_terms = _meaningful_terms(tokenize_multilingual(explicit_title))
        return intent

    tokens = tokenize_multilingual(message)
    terms = _meaningful_terms(tokens)
    if terms:
        intent.query_terms = terms[:12]
        intent.query_text = " ".join(terms[:12])

    if intent.max_price is not None or intent.min_price is not None:
        if _terms_are_price_noise(intent.query_terms):
            intent.query_text = None
            intent.query_terms = []

    if intent.category_name and intent.query_terms:
        alias_tokens = set(tokenize_multilingual(intent.category_name))
        intent.query_terms = [t for t in intent.query_terms if t not in alias_tokens]
        if not intent.query_terms:
            intent.query_text = None
        else:
            intent.query_text = " ".join(intent.query_terms)

    return intent
